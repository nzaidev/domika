import "server-only";

import { randomUUID } from "node:crypto";
import type { BrochureRow, BrochureTemplateRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import { hasR2Config, r2Download, r2Upload } from "@/lib/storage/r2";
import {
  fetchRemoteImageAsJpeg,
  fetchStorageImageAsJpeg,
} from "@/lib/brochures/images";
import { renderBrochurePdf } from "@/lib/brochures/pdf";
import { renderFlyerImage } from "@/lib/brochures/flyer";
import { buildBrochureQrImages } from "@/lib/brochures/qr";
import {
  MAX_GALLERY_PHOTOS,
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

type MediaRow = {
  id: string;
  storage_path: string;
  public_url: string | null;
  is_cover: boolean;
  position: number;
};

async function loadMediaJpegs(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rows: MediaRow[],
  mediaBaseUrl?: string | null,
): Promise<Buffer[]> {
  const jpegs: Buffer[] = [];

  for (const row of rows) {
    const jpeg = await fetchStorageImageAsJpeg(
      row.storage_path,
      row.public_url,
      supabase,
      mediaBaseUrl,
    );
    if (jpeg) {
      jpegs.push(jpeg);
    }
  }

  return jpegs;
}

function selectMediaRows(
  media: MediaRow[],
  heroMediaId: string | null | undefined,
  stripMediaIds: string[] | undefined,
): { hero: MediaRow | null; strip: MediaRow[] } {
  if (media.length === 0) {
    return { hero: null, strip: [] };
  }

  const byId = new Map(media.map((row) => [row.id, row]));

  if (heroMediaId && byId.has(heroMediaId)) {
    const hero = byId.get(heroMediaId)!;
    const stripIds = (stripMediaIds ?? [])
      .filter((id) => id !== heroMediaId && byId.has(id))
      .slice(0, MAX_GALLERY_PHOTOS);
    const strip = stripIds.map((id) => byId.get(id)!);
    return { hero, strip };
  }

  const hero = media[0] ?? null;
  const strip = media
    .slice(1, 1 + MAX_GALLERY_PHOTOS)
    .filter((row) => row.id !== hero?.id);

  return { hero, strip };
}

async function buildBrochureData(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  propertyId: string,
  agent: { full_name: string; phone: string | null },
  listingUrl: string | null,
  layout: BrochureLayout,
  mediaSelection?: {
    heroMediaId?: string | null;
    stripMediaIds?: string[];
  },
  mediaBaseUrl?: string | null,
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
        .select("name, brand_color, logo_url")
        .eq("id", organizationId)
        .single(),
      supabase
        .from("property_media")
        .select("id, storage_path, public_url, is_cover, position")
        .eq("property_id", propertyId)
        .eq("organization_id", organizationId)
        .order("is_cover", { ascending: false })
        .order("position", { ascending: true })
        .limit(20),
    ]);

  if (!property || !organization) {
    return null;
  }

  const { hero, strip } = selectMediaRows(
    (media ?? []) as MediaRow[],
    mediaSelection?.heroMediaId,
    mediaSelection?.stripMediaIds,
  );

  const [coverJpeg, galleryJpegs, logoJpeg] = await Promise.all([
    hero
      ? fetchStorageImageAsJpeg(
          hero.storage_path,
          hero.public_url,
          supabase,
          mediaBaseUrl,
        )
      : Promise.resolve(null),
    loadMediaJpegs(supabase, strip, mediaBaseUrl),
    organization.logo_url
      ? fetchRemoteImageAsJpeg(organization.logo_url)
      : Promise.resolve(null),
  ]);

  const { listingQrPng, whatsappQrPng } = await buildBrochureQrImages({
    listingUrl,
    agentPhone: agent.phone,
    includeListing: layout.qrListing !== false && Boolean(listingUrl),
    includeWhatsapp: layout.qrWhatsapp !== false && Boolean(agent.phone),
    size: 280,
  });

  const currencySymbol = property.currency === "BOB" ? "Bs" : "$";
  const priceLabel =
    property.price !== null
      ? `${currencySymbol}${Math.round(property.price).toLocaleString("en-US")}`
      : "Precio a consultar";

  return {
    title: property.title,
    priceLabel,
    operationLabel: OPERATION_LABELS[property.operation] ?? property.operation,
    location: [property.zone, property.city].filter(Boolean).join(", "),
    specs: [
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
    ].filter(Boolean) as Array<{ label: string; value: string }>,
    description: property.description,
    amenities: Array.isArray(property.amenities)
      ? (property.amenities as string[])
      : [],
    organizationName: organization.name,
    brandColor: organization.brand_color || "#0B1B3A",
    agentName: agent.full_name,
    agentPhone: agent.phone,
    coverJpeg,
    logoJpeg,
    galleryJpegs,
    listingUrl,
    listingQrPng,
    whatsappQrPng,
  };
}

async function ensureListingUrl(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  propertyId: string,
  publishedBy: string,
  baseUrl: string | null,
): Promise<string | null> {
  if (!baseUrl) {
    return null;
  }

  const { data: property } = await supabase
    .from("properties")
    .select("title")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!property) {
    return null;
  }

  const { data: existing } = await supabase
    .from("listing_publications")
    .select("public_slug, status")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .eq("channel", "public_link")
    .maybeSingle();

  let slug = existing?.public_slug ?? null;

  if (!slug) {
    slug = `${property.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)}-${randomUUID().slice(0, 6)}`;

    await supabase.from("listing_publications").insert({
      organization_id: organizationId,
      property_id: propertyId,
      channel: "public_link",
      status: "published",
      public_slug: slug,
      published_by: publishedBy,
      published_at: new Date().toISOString(),
      options: { hide_owner: true },
    });
  } else if (existing?.status !== "published") {
    await supabase
      .from("listing_publications")
      .update({ status: "published", unpublished_at: null })
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .eq("channel", "public_link");
  }

  return `${baseUrl.replace(/\/+$/, "")}/p/${slug}`;
}

export type BrochurePropertyMedia = {
  id: string;
  url: string;
  isCover: boolean;
  position: number;
};

export async function getBrochurePropertyMedia(
  propertyId: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; media: BrochurePropertyMedia[] }
> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No autorizado." };
  }

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("property_media")
    .select("id, storage_path, public_url, is_cover, position")
    .eq("property_id", propertyId)
    .eq("organization_id", session.profile.organization_id)
    .order("is_cover", { ascending: false })
    .order("position", { ascending: true });

  return {
    ok: true,
    media: (data ?? []).map((row) => ({
      id: row.id,
      url: row.public_url ?? mediaUrl(row.storage_path),
      isCover: row.is_cover,
      position: row.position,
    })),
  };
}

export type GenerateBrochureResult =
  | { ok: true; url: string; format: BrochureFormat }
  | { ok: false; error: string };

export async function generateBrochure(input: {
  propertyId: string;
  layout: BrochureLayout;
  templateId?: string | null;
  baseUrl?: string | null;
  heroMediaId?: string | null;
  stripMediaIds?: string[];
}): Promise<GenerateBrochureResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();
  const layout = sanitizeLayout(input.layout);

  const listingUrl = await ensureListingUrl(
    supabase,
    organizationId,
    input.propertyId,
    session.profile.id,
    input.baseUrl ?? null,
  );

  const data = await buildBrochureData(
    supabase,
    organizationId,
    input.propertyId,
    { full_name: session.profile.full_name, phone: session.profile.phone },
    listingUrl,
    layout,
    {
      heroMediaId: input.heroMediaId,
      stripMediaIds: input.stripMediaIds,
    },
    input.baseUrl ?? null,
  );

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
      branding: {
        organizationName: string;
        brandColor: string;
        logoUrl: string | null;
      };
    };

export async function getBrochuresOverview(): Promise<BrochuresOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [templates, history, properties, organization] = await Promise.all([
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
    supabase
      .from("organizations")
      .select("name, brand_color, logo_url")
      .eq("id", organizationId)
      .single(),
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
    branding: {
      organizationName: organization.data?.name ?? "",
      brandColor: organization.data?.brand_color ?? "#0B1B3A",
      logoUrl: organization.data?.logo_url ?? null,
    },
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
