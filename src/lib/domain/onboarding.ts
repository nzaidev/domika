import "server-only";

import { auth } from "@clerk/nextjs/server";
import { normalizePhone } from "@/lib/phone";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Mirrors supabase/seed.sql so self-service orgs match the demo org layout.
const DEFAULT_PIPELINE_STAGES = [
  { name: "Nuevo", position: 1, color: "#3B82F6", is_closed: false },
  { name: "Contactado", position: 2, color: "#6366F1", is_closed: false },
  { name: "Visito", position: 3, color: "#8B5CF6", is_closed: false },
  { name: "Negociacion", position: 4, color: "#EC4899", is_closed: false },
  { name: "Cierre", position: 5, color: "#10B981", is_closed: true },
  { name: "Perdido", position: 6, color: "#EF4444", is_closed: true },
] as const;

export type OnboardingInput = {
  organizationName: string;
  fullName: string;
  phone?: string;
};

export type OnboardingResult =
  | { ok: true }
  | { ok: false; error: string };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createOrganizationWithOwner(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false, error: "No hay una sesión activa." };
  }

  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return { ok: false, error: "El backend todavía no está configurado." };
  }

  if (session.status === "authenticated") {
    return { ok: true };
  }

  const organizationName = input.organizationName.trim();
  const fullName = input.fullName.trim();

  if (organizationName.length < 2) {
    return { ok: false, error: "El nombre de la organización es muy corto." };
  }

  if (fullName.length < 2) {
    return { ok: false, error: "Ingresa tu nombre completo." };
  }

  const supabase = createAdminSupabaseClient();
  const baseSlug = slugify(organizationName) || "organizacion";

  let organizationId: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug =
      attempt === 0 ? baseSlug : `${baseSlug}-${userId.slice(-6)}${attempt}`;
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: organizationName, slug })
      .select("id")
      .single();

    if (!error && data) {
      organizationId = data.id;
      break;
    }

    lastError = error?.message ?? "No se pudo crear la organización.";

    // 23505 = unique_violation on slug; retry with a suffixed slug.
    if (error?.code !== "23505") {
      return { ok: false, error: lastError };
    }
  }

  if (!organizationId) {
    return { ok: false, error: lastError ?? "No se pudo crear la organización." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    clerk_user_id: userId,
    organization_id: organizationId,
    role: "owner",
    full_name: fullName,
    phone: normalizePhone(input.phone),
  });

  if (profileError) {
    await supabase.from("organizations").delete().eq("id", organizationId);
    return { ok: false, error: profileError.message };
  }

  const { error: stagesError } = await supabase.from("pipeline_stages").insert(
    DEFAULT_PIPELINE_STAGES.map((stage) => ({
      organization_id: organizationId,
      business_unit: "general",
      ...stage,
    })),
  );

  if (stagesError) {
    return { ok: false, error: stagesError.message };
  }

  return { ok: true };
}
