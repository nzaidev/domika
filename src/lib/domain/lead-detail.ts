import "server-only";

import type {
  LeadActivityRow,
  LeadRow,
  PipelineStageRow,
  ProfileRow,
  WhatsappMessageRow,
  WhatsappThreadRow,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type LeadDetail =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "not_found" }
  | {
      status: "ready";
      lead: LeadRow;
      stages: PipelineStageRow[];
      currentStage: PipelineStageRow | null;
      assignee: ProfileRow | null;
      activities: LeadActivityRow[];
      thread: WhatsappThreadRow | null;
      messages: WhatsappMessageRow[];
    };

export async function getLeadDetail(leadId: string): Promise<LeadDetail> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!lead) {
    return { status: "not_found" };
  }

  const [stages, activities, thread, assignee] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true }),
    supabase
      .from("lead_activities")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("whatsapp_threads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("lead_id", leadId)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    lead.assigned_to
      ? supabase
          .from("profiles")
          .select("*")
          .eq("id", lead.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (stages.error) {
    throw stages.error;
  }

  if (activities.error) {
    throw activities.error;
  }

  let messages: WhatsappMessageRow[] = [];

  if (thread.data) {
    const { data: messageRows, error: messagesError } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("thread_id", thread.data.id)
      .order("sent_at", { ascending: true })
      .limit(200);

    if (messagesError) {
      throw messagesError;
    }

    messages = messageRows ?? [];
  }

  const stageList = stages.data ?? [];

  return {
    status: "ready",
    lead,
    stages: stageList,
    currentStage: stageList.find((stage) => stage.id === lead.stage_id) ?? null,
    assignee: assignee.data ?? null,
    activities: activities.data ?? [],
    thread: thread.data ?? null,
    messages,
  };
}

export type ChangeLeadStageResult =
  | { ok: true }
  | { ok: false; error: string };

export async function changeLeadStage(input: {
  leadId: string;
  toStageId: string;
}): Promise<ChangeLeadStageResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [lead, toStage] = await Promise.all([
    supabase
      .from("leads")
      .select("id, stage_id")
      .eq("id", input.leadId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("id", input.toStageId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (!lead.data) {
    return { ok: false, error: "El prospecto no existe." };
  }

  if (!toStage.data) {
    return { ok: false, error: "La etapa no existe." };
  }

  if (lead.data.stage_id === toStage.data.id) {
    return { ok: true };
  }

  const fromStageId = lead.data.stage_id;

  const { error: updateError } = await supabase
    .from("leads")
    .update({ stage_id: toStage.data.id })
    .eq("id", input.leadId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await Promise.all([
    supabase.from("pipeline_events").insert({
      organization_id: organizationId,
      lead_id: input.leadId,
      from_stage_id: fromStageId,
      to_stage_id: toStage.data.id,
      changed_by: session.profile.id,
    }),
    supabase.from("lead_activities").insert({
      organization_id: organizationId,
      lead_id: input.leadId,
      actor_profile_id: session.profile.id,
      activity_type: "stage_change",
      title: `Movido a ${toStage.data.name}`,
      body: `Cambio de etapa realizado por ${session.profile.full_name}.`,
    }),
  ]);

  return { ok: true };
}

export type AddLeadNoteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addLeadNote(input: {
  leadId: string;
  body: string;
}): Promise<AddLeadNoteResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const body = input.body.trim();

  if (body.length === 0) {
    return { ok: false, error: "Escribe una nota antes de guardar." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", input.leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "El prospecto no existe." };
  }

  const { error } = await supabase.from("lead_activities").insert({
    organization_id: organizationId,
    lead_id: input.leadId,
    actor_profile_id: session.profile.id,
    activity_type: "note",
    title: "Nota",
    body,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
