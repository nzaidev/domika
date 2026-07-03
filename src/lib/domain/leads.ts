import "server-only";

import type { LeadRow, PipelineStageRow } from "@/lib/database.types";
import { normalizePhone } from "@/lib/phone";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type LeadsBoardStage = PipelineStageRow & {
  leads: LeadRow[];
};

export type LeadsBoard =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "ready"; stages: LeadsBoardStage[]; totalLeads: number };

export async function getLeadsBoard(): Promise<LeadsBoard> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [stagesResult, leadsResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true }),
    supabase
      .from("leads")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (stagesResult.error) {
    throw stagesResult.error;
  }

  if (leadsResult.error) {
    throw leadsResult.error;
  }

  const stages = stagesResult.data ?? [];
  const leads = leadsResult.data ?? [];

  const byStage = new Map<string, LeadRow[]>(
    stages.map((stage) => [stage.id, []]),
  );
  const unstaged: LeadRow[] = [];

  for (const lead of leads) {
    const bucket = lead.stage_id ? byStage.get(lead.stage_id) : undefined;
    if (bucket) {
      bucket.push(lead);
    } else {
      unstaged.push(lead);
    }
  }

  const boardStages: LeadsBoardStage[] = stages.map((stage) => ({
    ...stage,
    leads: byStage.get(stage.id) ?? [],
  }));

  // Leads whose stage was deleted still need to be visible somewhere.
  if (unstaged.length > 0 && boardStages.length > 0) {
    boardStages[0].leads.unshift(...unstaged);
  }

  return { status: "ready", stages: boardStages, totalLeads: leads.length };
}

export type CreateLeadInput = {
  fullName: string;
  phone?: string;
  email?: string;
  desiredZone?: string;
  notes?: string;
};

export type CreateLeadResult =
  | { ok: true; leadId: string }
  | { ok: false; error: string };

export async function createLead(
  input: CreateLeadInput,
): Promise<CreateLeadResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const fullName = input.fullName.trim();

  if (fullName.length < 2) {
    return { ok: false, error: "Ingresa el nombre del prospecto." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      organization_id: organizationId,
      stage_id: firstStage?.id ?? null,
      assigned_to: session.profile.id,
      full_name: fullName,
      phone: normalizePhone(input.phone),
      email: input.email?.trim() || null,
      desired_zone: input.desiredZone?.trim() || null,
      notes: input.notes?.trim() || null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { ok: false, error: error?.message ?? "No se pudo crear el prospecto." };
  }

  await supabase.from("lead_activities").insert({
    organization_id: organizationId,
    lead_id: lead.id,
    actor_profile_id: session.profile.id,
    activity_type: "note",
    title: "Prospecto creado",
    body: `Creado manualmente por ${session.profile.full_name}.`,
  });

  return { ok: true, leadId: lead.id };
}
