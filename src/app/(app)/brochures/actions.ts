"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  deleteBrochureTemplate,
  generateBrochure,
  saveBrochureTemplate,
  sanitizeLayout,
} from "@/lib/domain/brochures";
import type { BrochureFormat, BrochureSection } from "@/lib/brochures/types";

export type BrochureStudioState = {
  error: string | null;
  url: string | null;
  format: BrochureFormat | null;
  savedTemplate: string | null;
};

function layoutFromFormData(formData: FormData) {
  return sanitizeLayout({
    format: String(formData.get("format") ?? "flyer") as BrochureFormat,
    sections: formData.getAll("sections").map(String) as BrochureSection[],
    qrListing: formData.get("qrListing") === "on",
    qrWhatsapp: formData.get("qrWhatsapp") === "on",
  });
}

export async function generateBrochureAction(
  _previousState: BrochureStudioState,
  formData: FormData,
): Promise<BrochureStudioState> {
  const intent = String(formData.get("intent") ?? "generate");
  const layout = layoutFromFormData(formData);

  if (intent === "save_template") {
    const result = await saveBrochureTemplate({
      name: String(formData.get("templateName") ?? ""),
      layout,
    });

    if (result.ok === false) {
      return { error: result.error, url: null, format: null, savedTemplate: null };
    }

    revalidatePath("/brochures");
    return {
      error: null,
      url: null,
      format: null,
      savedTemplate: String(formData.get("templateName") ?? "").trim(),
    };
  }

  const propertyId = String(formData.get("propertyId") ?? "");

  if (!propertyId) {
    return {
      error: "Selecciona una propiedad.",
      url: null,
      format: null,
      savedTemplate: null,
    };
  }

  const heroMediaId = String(formData.get("heroMediaId") ?? "") || null;
  const stripMediaIds = formData.getAll("stripMediaIds").map(String);

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${protocol}://${host}` : null;

  const result = await generateBrochure({
    propertyId,
    layout,
    templateId: String(formData.get("templateId") ?? "") || null,
    baseUrl,
    heroMediaId,
    stripMediaIds,
  });

  if (result.ok === false) {
    return { error: result.error, url: null, format: null, savedTemplate: null };
  }

  revalidatePath("/brochures");

  return {
    error: null,
    url: result.url,
    format: result.format,
    savedTemplate: null,
  };
}

export async function deleteTemplateAction(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");

  if (templateId) {
    await deleteBrochureTemplate(templateId);
    revalidatePath("/brochures");
  }
}
