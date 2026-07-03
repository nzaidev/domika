import "server-only";

import type { PipelineStageRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function getPipelineStages(): Promise<PipelineStageRow[]> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return [];
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("organization_id", session.profile.organization_id)
    .eq("business_unit", "general")
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export type PipelineMutationResult =
  | { ok: true }
  | { ok: false; error: string };

type AdminContext =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

async function requirePipelineAdmin(): Promise<AdminContext> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return {
      ok: false,
      error: "Solo propietarios y administradores pueden editar el embudo.",
    };
  }

  return { ok: true, organizationId: session.profile.organization_id };
}

export async function createStage(input: {
  name: string;
}): Promise<PipelineMutationResult> {
  const context = await requirePipelineAdmin();

  if (context.ok === false) {
    return context;
  }

  const name = input.name.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la etapa es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: lastStage } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("organization_id", context.organizationId)
    .eq("business_unit", "general")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("pipeline_stages").insert({
    organization_id: context.organizationId,
    business_unit: "general",
    name,
    position: (lastStage?.position ?? 0) + 1,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function renameStage(input: {
  stageId: string;
  name: string;
}): Promise<PipelineMutationResult> {
  const context = await requirePipelineAdmin();

  if (context.ok === false) {
    return context;
  }

  const name = input.name.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la etapa es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .update({ name })
    .eq("id", input.stageId)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function moveStage(input: {
  stageId: string;
  direction: "up" | "down";
}): Promise<PipelineMutationResult> {
  const context = await requirePipelineAdmin();

  if (context.ok === false) {
    return context;
  }

  const supabase = createAdminSupabaseClient();
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, position, business_unit")
    .eq("id", input.stageId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (!stage) {
    return { ok: false, error: "La etapa no existe." };
  }

  const { data: neighbor } = await supabase
    .from("pipeline_stages")
    .select("id, position")
    .eq("organization_id", context.organizationId)
    .eq("business_unit", stage.business_unit)
    .order("position", { ascending: input.direction === "down" })
    .filter(
      "position",
      input.direction === "up" ? "lt" : "gt",
      stage.position,
    )
    .limit(1)
    .maybeSingle();

  if (!neighbor) {
    return { ok: true }; // Already at the edge.
  }

  // Swap positions via a temporary slot to satisfy the unique constraint.
  const updates = [
    { id: stage.id, position: -1 },
    { id: neighbor.id, position: stage.position },
    { id: stage.id, position: neighbor.position },
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: update.position })
      .eq("id", update.id)
      .eq("organization_id", context.organizationId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function deleteStage(input: {
  stageId: string;
}): Promise<PipelineMutationResult> {
  const context = await requirePipelineAdmin();

  if (context.ok === false) {
    return context;
  }

  const supabase = createAdminSupabaseClient();
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, business_unit")
    .eq("id", input.stageId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (!stage) {
    return { ok: false, error: "La etapa no existe." };
  }

  const { count: stageCount } = await supabase
    .from("pipeline_stages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organizationId)
    .eq("business_unit", stage.business_unit);

  if ((stageCount ?? 0) <= 1) {
    return { ok: false, error: "El embudo necesita al menos una etapa." };
  }

  // Reparent this stage's leads onto the first remaining stage so they stay
  // visible on the board instead of silently losing their stage.
  const { data: fallbackStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("business_unit", stage.business_unit)
    .neq("id", stage.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackStage) {
    const { error: reparentError } = await supabase
      .from("leads")
      .update({ stage_id: fallbackStage.id })
      .eq("organization_id", context.organizationId)
      .eq("stage_id", stage.id);

    if (reparentError) {
      return { ok: false, error: reparentError.message };
    }
  }

  const { error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", stage.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
