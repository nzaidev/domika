import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { normalizePhone } from "@/lib/phone";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import { hasR2Config, r2Upload } from "@/lib/storage/r2";

export type AccountResult = { ok: true } | { ok: false; error: string };

// Own profile: any member may edit their name/phone (printed on brochures
// and contracts, so it must be self-serviceable).
export async function updateOwnProfile(input: {
  fullName: string;
  phone?: string | null;
}): Promise<AccountResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const fullName = input.fullName.trim();

  if (fullName.length < 2) {
    return { ok: false, error: "El nombre es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: normalizePhone(input.phone) })
    .eq("id", session.profile.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// Org branding: drives flyers, brochures, contracts, and the public
// listing pages. Owner/admin only.
export async function updateOrganizationBranding(input: {
  name: string;
  brandColor: string;
}): Promise<AccountResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return { ok: false, error: "Solo propietarios y administradores." };
  }

  const name = input.name.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la organización es muy corto." };
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(input.brandColor.trim())) {
    return { ok: false, error: "El color debe tener formato #RRGGBB." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name, brand_color: input.brandColor.trim() })
    .eq("id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_ACCEPTED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

export async function uploadOrganizationLogo(
  file: File,
): Promise<AccountResult & { logoUrl?: string }> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return { ok: false, error: "Solo propietarios y administradores." };
  }

  if (!LOGO_ACCEPTED.has(file.type)) {
    return { ok: false, error: "Formato de logo no soportado." };
  }

  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "El logo supera 5 MB." };
  }

  if (!hasR2Config()) {
    return { ok: false, error: "El almacenamiento R2 no está configurado." };
  }

  const organizationId = session.profile.organization_id;
  const original = Buffer.from(await file.arrayBuffer());
  const processed = await sharp(original)
    .rotate()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();

  const storagePath = `${organizationId}/branding/logo-${randomUUID().slice(0, 8)}.webp`;
  const upload = await r2Upload(storagePath, processed, "image/webp");

  if (upload.ok === false) {
    return { ok: false, error: upload.error };
  }

  const logoUrl = mediaUrl(storagePath);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, logoUrl };
}

export type BrandingState = {
  organizationName: string;
  brandColor: string;
  logoUrl: string | null;
  profileName: string;
  profilePhone: string | null;
};

export async function getBrandingState(): Promise<BrandingState | null> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("name, brand_color, logo_url")
    .eq("id", session.profile.organization_id)
    .single();

  return {
    organizationName: organization?.name ?? "",
    brandColor: organization?.brand_color ?? "#0B1B3A",
    logoUrl: organization?.logo_url ?? null,
    profileName: session.profile.full_name,
    profilePhone: session.profile.phone,
  };
}
