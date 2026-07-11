import "server-only";

import { normalizePhone } from "@/lib/phone";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
