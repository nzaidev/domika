import "server-only";

import type {
  PropertyMediaRow,
  PropertyRow,
} from "@/lib/database.types";
import { mediaUrl } from "@/lib/media";
import { r2Delete } from "@/lib/storage/r2";
import { normalizePhone } from "@/lib/phone";
import { runMatchingForProperty } from "@/lib/domain/matching";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const PROPERTY_TYPES = [
  "Casa",
  "Departamento",
  "Terreno",
  "Oficina",
  "Local comercial",
  "Otro",
] as const;

export type PropertyFilters = {
  q?: string;
  status?: PropertyRow["status"];
  operation?: PropertyRow["operation"];
  propertyType?: string;
};

export type PropertyWithCover = PropertyRow & {
  coverUrl: string | null;
};

export type PropertiesList =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "ready"; properties: PropertyWithCover[]; total: number };

export async function listProperties(
  filters: PropertyFilters = {},
): Promise<PropertiesList> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("properties")
    .select("*")
    .eq("organization_id", organizationId);

  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,city.ilike.%${term}%,zone.ilike.%${term}%,address.ilike.%${term}%`,
      );
    }
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.operation) {
    query = query.eq("operation", filters.operation);
  }

  if (filters.propertyType) {
    query = query.eq("property_type", filters.propertyType);
  }

  const { data: properties, error } = await query
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const rows = properties ?? [];
  const covers = new Map<string, string | null>();

  if (rows.length > 0) {
    const { data: media } = await supabase
      .from("property_media")
      .select("property_id, storage_path, is_cover, position")
      .eq("organization_id", organizationId)
      .in(
        "property_id",
        rows.map((row) => row.id),
      )
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true });

    for (const item of media ?? []) {
      if (!covers.has(item.property_id)) {
        covers.set(item.property_id, mediaUrl(item.storage_path));
      }
    }
  }

  return {
    status: "ready",
    properties: rows.map((row) => ({
      ...row,
      coverUrl: covers.get(row.id) ?? null,
    })),
    total: rows.length,
  };
}

export type PropertyDetail =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "not_found" }
  | { status: "ready"; property: PropertyRow; media: PropertyMediaRow[] };

export async function getPropertyDetail(
  propertyId: string,
): Promise<PropertyDetail> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!property) {
    return { status: "not_found" };
  }

  const { data: media, error } = await supabase
    .from("property_media")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return { status: "ready", property, media: media ?? [] };
}

export type PropertyInput = {
  title: string;
  description?: string | null;
  propertyType: string;
  operation: PropertyRow["operation"];
  status: PropertyRow["status"];
  price?: number | null;
  currency?: string;
  city?: string | null;
  zone?: string | null;
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  areaSqm?: number | null;
  lotSqm?: number | null;
  amenities?: string[];
  legalStatus?: string | null;
  videoUrl?: string | null;
  virtualTourUrl?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerNotes?: string | null;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// Pull coordinates out of a pasted Google Maps link. Handles the common
// desktop/app URL shapes; short links (maps.app.goo.gl) carry no coords, so
// they return null and we keep the URL only.
export function parseLatLngFromMapUrl(
  url: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!url) {
    return null;
  }

  const inRange = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // .../@-17.78,-63.18,15z
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // ...!3d-17.78!4d-63.18
    /[?&](?:q|query|ll|sll|center|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/, // ?q=lat,lng
    /(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/, // bare "lat, lng"
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (inRange(lat, lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export type PropertyMutationResult =
  | { ok: true; propertyId: string }
  | { ok: false; error: string };

const STATUS_ALERT_LABELS: Record<string, string> = {
  draft: "Borrador",
  available: "Disponible",
  reserved: "Reservada",
  sold: "Vendida",
  rented: "Alquilada",
  archived: "Archivada",
};

// #7 — availability on/off. When off, unpublish from network + public link
// so it disappears from the network feed, public page, and matching.
export async function setPropertyActive(
  propertyId: string,
  active: boolean,
): Promise<PropertyMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("properties")
    .update({ active })
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "La propiedad no existe." };
  }

  if (!active) {
    await supabase
      .from("listing_publications")
      .update({ status: "unpublished", unpublished_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .eq("status", "published");
  }

  await runMatchingForProperty(propertyId);

  return { ok: true, propertyId };
}

function propertyRowFromInput(input: PropertyInput) {
  const mapUrl = input.mapUrl?.trim() || null;
  // Prefer explicit coordinates; otherwise try to lift them off a pasted
  // Google Maps link so a dropped pin becomes a precise map location.
  const parsed =
    input.latitude == null || input.longitude == null
      ? parseLatLngFromMapUrl(mapUrl)
      : null;
  const latitude = input.latitude ?? parsed?.lat ?? null;
  const longitude = input.longitude ?? parsed?.lng ?? null;

  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    property_type: input.propertyType.trim() || "Otro",
    operation: input.operation,
    status: input.status,
    price: input.price ?? null,
    currency: input.currency?.trim() || "USD",
    city: input.city?.trim() || null,
    zone: input.zone?.trim() || null,
    address: input.address?.trim() || null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    parking_spaces: input.parkingSpaces ?? null,
    area_sqm: input.areaSqm ?? null,
    lot_sqm: input.lotSqm ?? null,
    amenities: input.amenities ?? [],
    legal_status: input.legalStatus?.trim() || null,
    video_url: input.videoUrl?.trim() || null,
    virtual_tour_url: input.virtualTourUrl?.trim() || null,
    owner_name: input.ownerName?.trim() || null,
    owner_phone: normalizePhone(input.ownerPhone),
    owner_email: input.ownerEmail?.trim().toLowerCase() || null,
    owner_notes: input.ownerNotes?.trim() || null,
    map_url: mapUrl,
    latitude,
    longitude,
  };
}

export async function createProperty(
  input: PropertyInput,
): Promise<PropertyMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (input.title.trim().length < 3) {
    return { ok: false, error: "El título es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({
      organization_id: session.profile.organization_id,
      created_by: session.profile.id,
      assigned_to: session.profile.id,
      ...propertyRowFromInput(input),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear la propiedad." };
  }

  await runMatchingForProperty(data.id);

  return { ok: true, propertyId: data.id };
}

export async function updateProperty(
  propertyId: string,
  input: PropertyInput,
): Promise<PropertyMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (input.title.trim().length < 3) {
    return { ok: false, error: "El título es muy corto." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  // Snapshot price/status before the write to detect changes worth alerting on.
  const { data: before } = await supabase
    .from("properties")
    .select("price, currency, status, title")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("properties")
    .update(propertyRowFromInput(input))
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "La propiedad no existe." };
  }

  await runMatchingForProperty(propertyId);

  // #6 — alert agents this property was shared with, on price/status change.
  if (before) {
    const changes: string[] = [];
    const symbol = (input.currency ?? "USD") === "BOB" ? "Bs" : "$";
    if ((before.price ?? null) !== (input.price ?? null)) {
      changes.push(
        `Nuevo precio: ${input.price !== null && input.price !== undefined ? `${symbol}${Math.round(input.price).toLocaleString("en-US")}` : "a consultar"}`,
      );
    }
    if (before.status !== input.status) {
      changes.push(`Estado: ${STATUS_ALERT_LABELS[input.status] ?? input.status}`);
    }
    if (changes.length > 0) {
      const { notifyPropertyChange } = await import(
        "@/lib/domain/property-alerts"
      );
      await notifyPropertyChange({
        ownerOrgId: organizationId,
        propertyId,
        propertyTitle: input.title.trim() || before.title,
        changes,
      });
    }
  }

  return { ok: true, propertyId };
}

export type DeletePropertyResult = { ok: true } | { ok: false; error: string };

export async function deleteProperty(
  propertyId: string,
): Promise<DeletePropertyResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return {
      ok: false,
      error: "Solo propietarios y administradores pueden eliminar propiedades.",
    };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!property) {
    return { ok: false, error: "La propiedad no existe." };
  }

  // Collect storage objects before the rows cascade away.
  const [{ data: media }, { data: brochures }] = await Promise.all([
    supabase
      .from("property_media")
      .select("storage_path")
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId),
    supabase
      .from("brochures")
      .select("storage_path")
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId),
  ]);

  const storagePaths = [
    ...(media ?? []).map((item) => item.storage_path),
    ...(brochures ?? [])
      .map((item) => item.storage_path)
      .filter((path): path is string => Boolean(path)),
  ];

  // FKs cascade: media, shares, publications, engagement events, brochures,
  // and property-linked tasks are removed with the property row.
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (storagePaths.length > 0) {
    // R2 is canonical; also try supabase storage for pre-migration objects.
    await r2Delete(storagePaths);
    await supabase.storage.from("property-media").remove(storagePaths);
  }

  return { ok: true };
}

export type MediaMutationResult = { ok: true } | { ok: false; error: string };

export async function setCoverMedia(input: {
  propertyId: string;
  mediaId: string;
}): Promise<MediaMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { error: clearError } = await supabase
    .from("property_media")
    .update({ is_cover: false })
    .eq("organization_id", organizationId)
    .eq("property_id", input.propertyId);

  if (clearError) {
    return { ok: false, error: clearError.message };
  }

  const { error } = await supabase
    .from("property_media")
    .update({ is_cover: true })
    .eq("id", input.mediaId)
    .eq("organization_id", organizationId)
    .eq("property_id", input.propertyId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function moveMedia(input: {
  propertyId: string;
  mediaId: string;
  direction: "up" | "down";
}): Promise<MediaMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: media } = await supabase
    .from("property_media")
    .select("id, position")
    .eq("organization_id", organizationId)
    .eq("property_id", input.propertyId)
    .order("position", { ascending: true });

  const items = media ?? [];
  const index = items.findIndex((item) => item.id === input.mediaId);

  if (index === -1) {
    return { ok: false, error: "La foto no existe." };
  }

  const neighborIndex = input.direction === "up" ? index - 1 : index + 1;

  if (neighborIndex < 0 || neighborIndex >= items.length) {
    return { ok: true }; // Already at the edge.
  }

  const current = items[index];
  const neighbor = items[neighborIndex];

  const updates = [
    { id: current.id, position: neighbor.position },
    { id: neighbor.id, position: current.position },
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from("property_media")
      .update({ position: update.position })
      .eq("id", update.id)
      .eq("organization_id", organizationId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

// Drag-and-drop reorder: persist the given order as sequential positions.
export async function reorderMedia(input: {
  propertyId: string;
  orderedIds: string[];
}): Promise<MediaMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  for (let index = 0; index < input.orderedIds.length; index += 1) {
    const { error } = await supabase
      .from("property_media")
      .update({ position: index })
      .eq("id", input.orderedIds[index])
      .eq("organization_id", organizationId)
      .eq("property_id", input.propertyId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function deleteMedia(input: {
  propertyId: string;
  mediaId: string;
}): Promise<MediaMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: media } = await supabase
    .from("property_media")
    .select("id, storage_path")
    .eq("id", input.mediaId)
    .eq("organization_id", organizationId)
    .eq("property_id", input.propertyId)
    .maybeSingle();

  if (!media) {
    return { ok: false, error: "La foto no existe." };
  }

  const { error } = await supabase
    .from("property_media")
    .delete()
    .eq("id", media.id)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await r2Delete([media.storage_path]);
  await supabase.storage.from("property-media").remove([media.storage_path]);

  return { ok: true };
}
