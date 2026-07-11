import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { BrochureRow, BrochureTemplateRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import { hasR2Config, r2Download, r2Upload } from "@/lib/storage/r2";
import { renderBrochurePdf } from "@/lib/brochures/pdf";
import { renderFlyerImage } from "@/lib/brochures/flyer";
import {
  sanitizeLayout,
  type BrochureData,
  type BrochureFormat,
  type BrochureLayout,
} from "@/lib/brochures/types";

export { sanitizeLayout };

const OPERATION_LABELS: Record<string, string> = {
  sale: "En venta",
  rent: "En alquiler",
  investment: "Inversión",
};

async function buildBrochureData(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  propertyId: string,
  agent: { full_name: string; phone: string | null },
): Promise<BrochureData | null> {
  const [{ data: property }, { data: organization }, { data: media }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("name, brand_color")
        .eq("id", organizationId)
        .single(),
      supabase
        .from("property_media")
        .select("storage_path, public_url, is_cover, position")
        .eq("property_id", propertyId)
        .eq("organization_id", organizationId)
        .order("is_cover", { ascending: false })
        .order("position", { ascending: true })
        .limit(1),
    ]);

  if (!property || !organization) {
    return null;
  }

  let coverJpeg: Buffer | null = null;
  const cover = (media ?? [])[0];

  if (cover) {
    // R2 is canonical; fall back to supabase storage for pre-migration files.
    let bytes: ArrayBuffer | null = null;
    const fromR2 = hasR2Config() ? await r2Download(cover.storage_path) : null;

    if (fromR2) {
      bytes = fromR2.body;
    } else {
      const { data: file } = await supabase.storage
        .from("property-media")
        .download(cover.storage_path);
      bytes = file ? await file.arrayBuffer() : null;
    }

    if (bytes) {
      // Stored photos are WebP; normalize to a baseline sRGB JPEG with no
      // alpha — the variant pdf-lib's embedJpg reliably accepts (progressive
      // / CMYK / alpha JPEGs make it throw).
      try {
        coverJpeg = await sharp(Buffer.from(bytes))
          .flatten({ background: "#ffffff" })
          .toColourspace("srgb")
          .jpeg({ quality: 85, progressive: false, mozjpeg: false })
          .toBuffer();
      } catch (error) {
        console.error("[brochures] cover normalize failed:", error);
      }
    }
  }

  const currencySymbol = property.currency === "BOB" ? "Bs" : "$";
  const priceLabel =
    property.price !== null
      ? `${currencySymbol}${Math.round(property.price).toLocaleString("en-US")}`
      : "Precio a consultar";

  const specs = [
    property.property_type
      ? { label: "Tipo", value: property.property_type }
      : null,
    property.bedrooms !== null
      ? { label: "Dorm.", value: String(property.bedrooms) }
      : null,
    property.bathrooms !== null
      ? { label: "Baños", value: String(property.bathrooms) }
      : null,
    property.parking_spaces !== null
      ? { label: "Parqueos", value: String(property.parking_spaces) }
      : null,
    property.area_sqm !== null
      ? { label: "Sup.", value: `${property.area_sqm} m²` }
      : null,
    property.lot_sqm !== null
      ? { label: "Terreno", value: `${property.lot_sqm} m²` }
      : null,
    property.legal_status
      ? { label: "Legal", value: property.legal_status }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return {
    title: property.title,
    priceLabel,
    operationLabel: OPERATION_LABELS[property.operation] ?? property.operation,
    location: [property.zone, property.city].filter(Boolean).join(", "),
    specs,
    description: property.description,
    amenities: Array.isArray(property.amenities)
      ? (property.amenities as string[])
      : [],
    organizationName: organization.name,
    brandColor: organization.brand_color || "#0B1B3A",
    agentName: agent.full_name,
    agentPhone: agent.phone,
    coverJpeg,
  };
}

export type GenerateBrochureResult =
  | { ok: true; url: string; format: BrochureFormat }
  | { ok: false; error: string };

export async function generateBrochure(input: {
  propertyId: string;
  layout: BrochureLayout;
  templateId?: string | null;
}): Promise<GenerateBrochureResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();
  const layout = sanitizeLayout(input.layout);

  const data = await buildBrochureData(supabase, organizationId, input.propertyId, {
    full_name: session.profile.full_name,
    phone: session.profile.phone,
  });

  if (!data) {
    return { ok: false, error: "La propiedad no existe." };
  }

  let file: Buffer;
  let extension: string;
  let contentType: string;

  try {
    if (layout.format === "flyer") {
      file = await renderFlyerImage(data, layout.sections);
      extension = "jpg";
      contentType = "image/jpeg";
    } else {
      file = await renderBrochurePdf(data, layout.sections);
      extension = "pdf";
      contentType = "application/pdf";
    }
  } catch (error) {
    console.error(
      `[brochures] render failed (format=${layout.format}, property=${input.propertyId}):`,
      error,
    );
    return {
      ok: false,
      error: `No se pudo generar el ${layout.format === "flyer" ? "flyer" : "folleto"}. Intenta de nuevo o revisa las fotos de la propiedad.`,
    };
  }

  const storagePath = `${organizationId}/brochures/${input.propertyId}/${randomUUID()}.${extension}`;

  if (!hasR2Config()) {
    return {
      ok: false,
      error: "El almacenamiento R2 no está configurado (R2_ACCOUNT_ID / claves).",
    };
  }

  const upload = await r2Upload(storagePath, file, contentType);

  if (upload.ok === false) {
    return { ok: false, error: upload.error };
  }

  await supabase.from("brochures").insert({
    organization_id: organizationId,
    property_id: input.propertyId,
    template_id: input.templateId || null,
    created_by: session.profile.id,
    title: `${data.title} — ${layout.format === "flyer" ? "Flyer WhatsApp" : "Folleto PDF"}`,
    output_format: layout.format,
    storage_path: storagePath,
    metadata: { public_url: mediaUrl(storagePath), layout },
  });

  return { ok: true, url: mediaUrl(storagePath), format: layout.format };
}

export type BrochureHistoryItem = {
  id: string;
  title: string;
  format: string;
  url: string | null;
  createdAt: string;
};

export type BrochuresOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      templates: BrochureTemplateRow[];
      history: BrochureHistoryItem[];
      properties: Array<{ id: string; title: string }>;
    };

export async function getBrochuresOverview(): Promise<BrochuresOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [templates, history, properties] = await Promise.all([
    supabase
      .from("brochure_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("brochures")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("properties")
      .select("id, title")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return {
    status: "ready",
    templates: templates.data ?? [],
    history: (history.data ?? []).map((row: BrochureRow) => ({
      id: row.id,
      title: row.title,
      format: row.output_format,
      url: row.storage_path ? mediaUrl(row.storage_path) : null,
      createdAt: row.created_at,
    })),
    properties: properties.data ?? [],
  };
}

export type SaveTemplateResult = { ok: true } | { ok: false; error: string };

export async function saveBrochureTemplate(input: {
  name: string;
  layout: BrochureLayout;
}): Promise<SaveTemplateResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const name = input.name.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la plantilla es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("brochure_templates").insert({
    organization_id: session.profile.organization_id,
    name,
    layout: sanitizeLayout(input.layout),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteBrochureTemplate(
  templateId: string,
): Promise<SaveTemplateResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("brochure_templates")
    .update({ active: false })
    .eq("id", templateId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
