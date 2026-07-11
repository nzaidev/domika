"use server";

import { revalidatePath } from "next/cache";
import type { PropertyRow } from "@/lib/database.types";
import { redirect } from "next/navigation";
import {
  createProperty,
  deleteMedia,
  deleteProperty,
  moveMedia,
  setCoverMedia,
  updateProperty,
  type PropertyInput,
} from "@/lib/domain/properties";

export type PropertyFormState = {
  error: string | null;
  // Set on success; the client uploads staged photos (create flow) and then
  // navigates to the property page.
  propertyId: string | null;
};

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function inputFromFormData(formData: FormData): PropertyInput {
  const operation = String(formData.get("operation") ?? "sale");
  const status = String(formData.get("status") ?? "draft");

  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    propertyType: String(formData.get("propertyType") ?? "Otro"),
    operation: (["sale", "rent", "investment"].includes(operation)
      ? operation
      : "sale") as PropertyRow["operation"],
    status: ([
      "draft",
      "available",
      "reserved",
      "sold",
      "rented",
      "archived",
    ].includes(status)
      ? status
      : "draft") as PropertyRow["status"],
    price: numberOrNull(formData.get("price")),
    currency: String(formData.get("currency") ?? "USD"),
    city: String(formData.get("city") ?? ""),
    zone: String(formData.get("zone") ?? ""),
    address: String(formData.get("address") ?? ""),
    bedrooms: numberOrNull(formData.get("bedrooms")),
    bathrooms: numberOrNull(formData.get("bathrooms")),
    parkingSpaces: numberOrNull(formData.get("parkingSpaces")),
    areaSqm: numberOrNull(formData.get("areaSqm")),
    lotSqm: numberOrNull(formData.get("lotSqm")),
    amenities: String(formData.get("amenities") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    legalStatus: String(formData.get("legalStatus") ?? ""),
    videoUrl: String(formData.get("videoUrl") ?? ""),
    virtualTourUrl: String(formData.get("virtualTourUrl") ?? ""),
    ownerName: String(formData.get("ownerName") ?? ""),
    ownerPhone: String(formData.get("ownerPhone") ?? ""),
    ownerEmail: String(formData.get("ownerEmail") ?? ""),
    ownerNotes: String(formData.get("ownerNotes") ?? ""),
  };
}

export async function savePropertyAction(
  _previousState: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const input = inputFromFormData(formData);

  const result = propertyId
    ? await updateProperty(propertyId, input)
    : await createProperty(input);

  if (result.ok === false) {
    return { error: result.error, propertyId: null };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${result.propertyId}`);
  revalidatePath("/dashboard");

  return { error: null, propertyId: result.propertyId };
}

export type DeletePropertyFormState = {
  error: string | null;
};

export async function deletePropertyAction(
  _previousState: DeletePropertyFormState,
  formData: FormData,
): Promise<DeletePropertyFormState> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const result = await deleteProperty(propertyId);

  if (result.ok === false) {
    return { error: result.error };
  }

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/network");

  redirect("/properties");
}

export async function setCoverAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  await setCoverMedia({
    propertyId,
    mediaId: String(formData.get("mediaId") ?? ""),
  });
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/edit`);
  revalidatePath("/properties");
}

export async function moveMediaAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveMedia({
    propertyId,
    mediaId: String(formData.get("mediaId") ?? ""),
    direction,
  });
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/edit`);
}

export async function deleteMediaAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  await deleteMedia({
    propertyId,
    mediaId: String(formData.get("mediaId") ?? ""),
  });
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/edit`);
  revalidatePath("/properties");
}
