import "server-only";

import type {
  LeadRow,
  LeadTagRow,
  PipelineStageRow,
} from "@/lib/database.types";
import { normalizePhone } from "@/lib/phone";
import { runNewLeadAutomation } from "@/lib/domain/automation";
import { listTags, tagsForLeads } from "@/lib/domain/tags";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type BoardLead = LeadRow & { tags: LeadTagRow[] };

export type LeadsBoardStage = PipelineStageRow & {
  leads: BoardLead[];
};

export type LeadFilters = {
  q?: string;
  source?: LeadRow["source"];
  assignedTo?: string;
  businessUnit?: string;
  tagId?: string;
  stageId?: string;
};

export type BoardMember = { id: string; full_name: string };

export type LeadsBoard =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      stages: LeadsBoardStage[];
      totalLeads: number;
      members: BoardMember[];
      tags: LeadTagRow[];
    };

export async function getLeadsBoard(
  filters: LeadFilters = {},
): Promise<LeadsBoard> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  // Tag filter: restrict to lead IDs carrying the selected tag.
  let tagLeadIds: string[] | null = null;
  if (filters.tagId) {
    const { data: tagged } = await supabase
      .from("lead_tag_assignments")
      .select("lead_id")
      .eq("organization_id", organizationId)
      .eq("tag_id", filters.tagId);
    tagLeadIds = (tagged ?? []).map((row) => row.lead_id);
    if (tagLeadIds.length === 0) {
      tagLeadIds = ["00000000-0000-0000-0000-000000000000"]; // match nothing
    }
  }

  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId);

  if (tagLeadIds) {
    leadsQuery = leadsQuery.in("id", tagLeadIds);
  }

  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      leadsQuery = leadsQuery.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }

  if (filters.source) {
    leadsQuery = leadsQuery.eq("source", filters.source);
  }

  if (filters.assignedTo) {
    leadsQuery = leadsQuery.eq("assigned_to", filters.assignedTo);
  }

  if (filters.businessUnit) {
    leadsQuery = leadsQuery.eq("business_unit", filters.businessUnit);
  }

  if (filters.stageId) {
    leadsQuery = leadsQuery.eq("stage_id", filters.stageId);
  }

  const [stagesResult, leadsResult, membersResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true }),
    leadsQuery.order("created_at", { ascending: false }).limit(500),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (stagesResult.error) {
    throw stagesResult.error;
  }

  if (leadsResult.error) {
    throw leadsResult.error;
  }

  if (membersResult.error) {
    throw membersResult.error;
  }

  const stages = stagesResult.data ?? [];
  const rawLeads = leadsResult.data ?? [];

  const [tagMap, allTags] = await Promise.all([
    tagsForLeads(rawLeads.map((lead) => lead.id)),
    listTags(),
  ]);
  const leads: BoardLead[] = rawLeads.map((lead) => ({
    ...lead,
    tags: tagMap.get(lead.id) ?? [],
  }));

  const byStage = new Map<string, BoardLead[]>(
    stages.map((stage) => [stage.id, []]),
  );
  const unstaged: BoardLead[] = [];

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

  return {
    status: "ready",
    stages: boardStages,
    totalLeads: leads.length,
    members: (membersResult.data ?? []) as BoardMember[],
    tags: allTags,
  };
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

  await runNewLeadAutomation({
    organizationId,
    leadId: lead.id,
    leadName: fullName,
    stageId: firstStage?.id ?? null,
    assignedTo: session.profile.id,
    actorProfileId: session.profile.id,
  });

  return { ok: true, leadId: lead.id };
}
