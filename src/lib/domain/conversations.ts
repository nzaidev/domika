import "server-only";

import type {
  MessageChannel,
  WhatsappMessageRow,
  WhatsappThreadRow,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import {
  hasZernioConfig,
  sendZernioMessage,
  type ZernioInboundMessage,
} from "@/lib/integrations/zernio";

export type ConversationSummary = {
  id: string;
  channel: MessageChannel;
  contactName: string;
  contactPhone: string;
  leadId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastDirection: "inbound" | "outbound" | null;
};

export type ConversationsOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      conversations: ConversationSummary[];
      connected: boolean;
      canReply: boolean;
    };

export type ConversationDetail =
  | { status: "not_found" }
  | {
      status: "ready";
      thread: WhatsappThreadRow;
      messages: WhatsappMessageRow[];
      canReply: boolean;
    };

async function lastMessageByThread(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  threadIds: string[],
): Promise<Map<string, { body: string | null; direction: "inbound" | "outbound" }>> {
  const map = new Map<string, { body: string | null; direction: "inbound" | "outbound" }>();
  if (threadIds.length === 0) {
    return map;
  }
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("thread_id, body, direction, sent_at")
    .eq("organization_id", organizationId)
    .in("thread_id", threadIds)
    .order("sent_at", { ascending: false })
    .limit(400);
  for (const row of data ?? []) {
    if (!map.has(row.thread_id)) {
      map.set(row.thread_id, { body: row.body, direction: row.direction });
    }
  }
  return map;
}

export async function getConversationsOverview(): Promise<ConversationsOverview> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [threadsRes, connectionsRes] = await Promise.all([
    supabase
      .from("whatsapp_threads")
      .select("*")
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("channel_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(1),
  ]);

  const threads = threadsRes.data ?? [];
  const lastMessages = await lastMessageByThread(
    supabase,
    organizationId,
    threads.map((t) => t.id),
  );

  const conversations: ConversationSummary[] = threads.map((thread) => {
    const last = lastMessages.get(thread.id);
    return {
      id: thread.id,
      channel: thread.channel,
      contactName: thread.contact_name ?? thread.contact_phone,
      contactPhone: thread.contact_phone,
      leadId: thread.lead_id,
      lastMessage: last?.body ?? null,
      lastMessageAt: thread.last_message_at,
      lastDirection: last?.direction ?? null,
    };
  });

  const connected = (connectionsRes.data ?? []).length > 0;
  return { status: "ready", conversations, connected, canReply: hasZernioConfig() };
}

export async function getConversationDetail(
  threadId: string,
): Promise<ConversationDetail> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { status: "not_found" };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: thread } = await supabase
    .from("whatsapp_threads")
    .select("*")
    .eq("id", threadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!thread) {
    return { status: "not_found" };
  }

  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true })
    .limit(300);

  return {
    status: "ready",
    thread,
    messages: messages ?? [],
    canReply: hasZernioConfig(),
  };
}

export type SendReplyResult = { ok: true } | { ok: false; error: string };

export async function sendConversationReply(input: {
  threadId: string;
  text: string;
}): Promise<SendReplyResult> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const text = input.text.trim();
  if (!text) {
    return { ok: false, error: "Escribe un mensaje." };
  }
  if (!hasZernioConfig()) {
    return { ok: false, error: "Conecta WhatsApp para responder desde Domika." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: thread } = await supabase
    .from("whatsapp_threads")
    .select("id, external_thread_id")
    .eq("id", input.threadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!thread) {
    return { ok: false, error: "La conversación no existe." };
  }
  if (!thread.external_thread_id) {
    return { ok: false, error: "Esta conversación no está vinculada a un canal." };
  }

  const sent = await sendZernioMessage(thread.external_thread_id, text);
  if (!sent.ok) {
    return { ok: false, error: `No se pudo enviar (${sent.error ?? "error"}).` };
  }

  const nowIso = new Date().toISOString();
  await supabase.from("whatsapp_messages").insert({
    organization_id: organizationId,
    thread_id: thread.id,
    direction: "outbound",
    sender_profile_id: session.profile.id,
    external_message_id: sent.messageId ?? null,
    body: text,
    media: [],
    sent_at: nowIso,
  });
  await supabase
    .from("whatsapp_threads")
    .update({ last_message_at: nowIso })
    .eq("id", thread.id)
    .eq("organization_id", organizationId);

  return { ok: true };
}

export type ConvertResult =
  | { ok: true; leadId: string }
  | { ok: false; error: string };

// Inbox-first: a conversation becomes a lead only when the agent converts it.
export async function convertConversationToLead(
  threadId: string,
): Promise<ConvertResult> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: thread } = await supabase
    .from("whatsapp_threads")
    .select("id, lead_id, contact_name, contact_phone, channel")
    .eq("id", threadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!thread) {
    return { ok: false, error: "La conversación no existe." };
  }
  if (thread.lead_id) {
    return { ok: true, leadId: thread.lead_id };
  }

  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const source = thread.channel === "whatsapp" ? "whatsapp" : "other";

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      organization_id: organizationId,
      stage_id: firstStage?.id ?? null,
      full_name: thread.contact_name ?? thread.contact_phone,
      phone: thread.contact_phone,
      source,
      assigned_to: session.profile.id,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { ok: false, error: error?.message ?? "No se pudo crear el prospecto." };
  }

  await supabase
    .from("whatsapp_threads")
    .update({ lead_id: lead.id })
    .eq("id", thread.id)
    .eq("organization_id", organizationId);

  await supabase.from("lead_activities").insert({
    organization_id: organizationId,
    lead_id: lead.id,
    actor_profile_id: session.profile.id,
    activity_type: "message",
    title: "Prospecto creado desde Conversaciones",
    body: `Convertido desde el chat de ${thread.contact_name ?? thread.contact_phone}.`,
  });

  return { ok: true, leadId: lead.id };
}

// Called from the Zernio webhook (no session). Routes to an org by the connected
// account, upserts the thread + message. Does NOT auto-create a lead (inbox-first).
export async function ingestZernioInbound(
  msg: ZernioInboundMessage,
): Promise<"stored" | "duplicate" | "unroutable"> {
  const supabase = createAdminSupabaseClient();

  let organizationId: string | null = null;
  if (msg.externalAccountId) {
    const { data } = await supabase
      .from("channel_connections")
      .select("organization_id")
      .eq("external_account_id", msg.externalAccountId)
      .eq("status", "active")
      .maybeSingle();
    organizationId = data?.organization_id ?? null;
  }
  if (!organizationId) {
    // Fallback: a single active connection (common pilot case).
    const { data } = await supabase
      .from("channel_connections")
      .select("organization_id")
      .eq("status", "active")
      .limit(2);
    if ((data ?? []).length === 1) {
      organizationId = data![0].organization_id;
    }
  }
  if (!organizationId) {
    return "unroutable";
  }

  const contactPhone =
    normalizePhone(msg.contactPhone) ?? msg.contactPhone ?? msg.conversationId;

  // Upsert the thread by the provider conversation id.
  const { data: existing } = await supabase
    .from("whatsapp_threads")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("external_thread_id", msg.conversationId)
    .maybeSingle();

  let threadId = existing?.id ?? null;
  if (!threadId) {
    const { data: created } = await supabase
      .from("whatsapp_threads")
      .insert({
        organization_id: organizationId,
        channel: msg.platform,
        external_thread_id: msg.conversationId,
        contact_phone: contactPhone,
        contact_name: msg.contactName,
        last_message_at: msg.sentAt,
      })
      .select("id")
      .single();
    threadId = created?.id ?? null;
  }
  if (!threadId) {
    return "unroutable";
  }

  // Dedupe by provider message id.
  if (msg.externalMessageId) {
    const { data: dupe } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("external_message_id", msg.externalMessageId)
      .maybeSingle();
    if (dupe) {
      return "duplicate";
    }
  }

  await supabase.from("whatsapp_messages").insert({
    organization_id: organizationId,
    thread_id: threadId,
    direction: "inbound",
    external_message_id: msg.externalMessageId,
    body: msg.text,
    media: [],
    sent_at: msg.sentAt,
  });
  await supabase
    .from("whatsapp_threads")
    .update({
      last_message_at: msg.sentAt,
      contact_name: msg.contactName ?? undefined,
    })
    .eq("id", threadId)
    .eq("organization_id", organizationId);

  return "stored";
}
