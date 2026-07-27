import "server-only";

import type { LeadTagRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Etiquetas: org-managed labels tagged onto prospectos/contactos.

export type TagWithCount = LeadTagRow & { leadCount: number };

export type TagsOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "ready"; tags: TagWithCount[] };

export async function getTagsOverview(): Promise<TagsOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: tags, error } = await supabase
    .from("lead_tags")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    // Table missing (migration 0008 not applied yet) → show empty state.
    return { status: "ready", tags: [] };
  }

  const { data: assignments } = await supabase
    .from("lead_tag_assignments")
    .select("tag_id")
    .eq("organization_id", organizationId);

  const counts = new Map<string, number>();
  for (const row of assignments ?? []) {
    counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  }

  return {
    status: "ready",
    tags: (tags ?? []).map((tag) => ({
      ...tag,
      leadCount: counts.get(tag.id) ?? 0,
    })),
  };
}

// All tags for the org (for pickers). Returns [] if the table is missing.
export async function listTags(): Promise<LeadTagRow[]> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return [];
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("lead_tags")
    .select("*")
    .eq("organization_id", session.profile.organization_id)
    .order("name", { ascending: true });

  return error ? [] : (data ?? []);
}

// tags assigned to each of the given leads, keyed by lead_id.
export async function tagsForLeads(
  leadIds: string[],
): Promise<Map<string, LeadTagRow[]>> {
  const result = new Map<string, LeadTagRow[]>();

  if (leadIds.length === 0) {
    return result;
  }

  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return result;
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: assignments, error } = await supabase
    .from("lead_tag_assignments")
    .select("lead_id, tag_id")
    .eq("organization_id", organizationId)
    .in("lead_id", leadIds);

  if (error || !assignments || assignments.length === 0) {
    return result;
  }

  const { data: tags } = await supabase
    .from("lead_tags")
    .select("*")
    .eq("organization_id", organizationId);

  const tagById = new Map((tags ?? []).map((tag) => [tag.id, tag]));

  for (const row of assignments) {
    const tag = tagById.get(row.tag_id);
    if (!tag) {
      continue;
    }
    const list = result.get(row.lead_id) ?? [];
    list.push(tag);
    result.set(row.lead_id, list);
  }

  return result;
}

export type TagMutationResult = { ok: true } | { ok: false; error: string };

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function createTag(input: {
  name: string;
  color: string;
}): Promise<TagMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const name = input.name.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la etiqueta es muy corto." };
  }

  const color = HEX.test(input.color) ? input.color : "#3B82F6";
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("lead_tags").insert({
    organization_id: session.profile.organization_id,
    name,
    color,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe una etiqueta con ese nombre." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updateTag(input: {
  tagId: string;
  name: string;
  color: string;
}): Promise<TagMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const name = input.name.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la etiqueta es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("lead_tags")
    .update({ name, color: HEX.test(input.color) ? input.color : "#3B82F6" })
    .eq("id", input.tagId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe una etiqueta con ese nombre." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteTag(tagId: string): Promise<TagMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("id", tagId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function assignTag(input: {
  leadId: string;
  tagId: string;
}): Promise<TagMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  // Confirm both lead and tag belong to the caller's org.
  const [lead, tag] = await Promise.all([
    supabase
      .from("leads")
      .select("id")
      .eq("id", input.leadId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("lead_tags")
      .select("id")
      .eq("id", input.tagId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (!lead.data || !tag.data) {
    return { ok: false, error: "Prospecto o etiqueta no encontrados." };
  }

  const { error } = await supabase.from("lead_tag_assignments").upsert(
    {
      organization_id: organizationId,
      lead_id: input.leadId,
      tag_id: input.tagId,
    },
    { onConflict: "organization_id,lead_id,tag_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function unassignTag(input: {
  leadId: string;
  tagId: string;
}): Promise<TagMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("lead_tag_assignments")
    .delete()
    .eq("organization_id", session.profile.organization_id)
    .eq("lead_id", input.leadId)
    .eq("tag_id", input.tagId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
