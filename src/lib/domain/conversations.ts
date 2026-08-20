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
  computeServiceWindow,
  windowClosedMessage,
  type ServiceWindow,
} from "@/lib/whatsapp/policy";
import {
  disconnectZernioAccount,
  hasZernioConfig,
  listZernioContacts,
  listZernioConversations,
  listZernioMessages,
  sendZernioMessage,
  startZernioConversation,
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
  unread: number;
};

export type ConnectedChannel = {
  displayName: string | null;
  phone: string | null;
};

export type ConversationsOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      conversations: ConversationSummary[];
      connected: boolean;
      connection: ConnectedChannel | null;
      canReply: boolean;
    };

// Contact context shown in the right rail — populated from the linked lead.
export type ConversationContact = {
  leadId: string | null;
  email: string | null;
  source: string | null;
  stageName: string | null;
  assigneeName: string | null;
  zone: string | null;
  budgetLabel: string | null;
  notes: Array<{ id: string; title: string; body: string | null; at: string }>;
};

export type ConversationDetail =
  | { status: "not_found" }
  | {
      status: "ready";
      thread: WhatsappThreadRow;
      messages: WhatsappMessageRow[];
      canReply: boolean;
      contact: ConversationContact;
      window: ServiceWindow;
    };

// Marker stored on `media` for messages pulled in by the coexistence history
// import. Meta only opens the 24h service window on a LIVE inbound message, so
// these must be excluded from window math or every reply fails with 131047
// ("Re-engagement message").
const HISTORY_SOURCE = "coexistence_history";

function isHistoryMessage(media: unknown): boolean {
  return (
    media != null &&
    !Array.isArray(media) &&
    typeof media === "object" &&
    (media as Record<string, unknown>).source === HISTORY_SOURCE
  );
}

// Newest inbound that actually arrived live, i.e. the one Meta counts.
async function lastLiveInboundAt(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  threadId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("sent_at, media")
    .eq("organization_id", organizationId)
    .eq("thread_id", threadId)
    .eq("direction", "inbound")
    .order("sent_at", { ascending: false })
    .limit(50);
  const live = (data ?? []).find((m) => !isHistoryMessage(m.media));
  return live?.sent_at ?? null;
}

// phone digits → newest LIVE inbound timestamp, across the org's threads.
async function liveInboundByPhone(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: threads } = await supabase
    .from("whatsapp_threads")
    .select("id, contact_phone")
    .eq("organization_id", organizationId)
    .eq("channel", "whatsapp")
    .limit(500);
  if (!threads || threads.length === 0) return map;

  const { data: msgs } = await supabase
    .from("whatsapp_messages")
    .select("thread_id, sent_at, media")
    .eq("organization_id", organizationId)
    .eq("direction", "inbound")
    .in(
      "thread_id",
      threads.map((t) => t.id),
    )
    .order("sent_at", { ascending: false })
    .limit(1000);

  const newestLive = new Map<string, string>();
  for (const m of msgs ?? []) {
    if (isHistoryMessage(m.media)) continue;
    if (!newestLive.has(m.thread_id)) newestLive.set(m.thread_id, m.sent_at);
  }
  for (const t of threads) {
    const at = newestLive.get(t.id);
    if (!at || !t.contact_phone) continue;
    map.set(t.contact_phone.replace(/[^\d]/g, ""), at);
  }
  return map;
}

type ThreadStat = {
  body: string | null;
  direction: "inbound" | "outbound";
  unread: number;
  sealed: boolean;
};

// Last message + a lightweight "unread" = trailing inbound messages (i.e. the
// unanswered ones at the end of the thread).
async function threadStats(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  threadIds: string[],
): Promise<Map<string, ThreadStat>> {
  const map = new Map<string, ThreadStat>();
  if (threadIds.length === 0) {
    return map;
  }
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("thread_id, body, direction, sent_at")
    .eq("organization_id", organizationId)
    .in("thread_id", threadIds)
    .order("sent_at", { ascending: false })
    .limit(600);
  for (const row of data ?? []) {
    let stat = map.get(row.thread_id);
    if (!stat) {
      stat = { body: row.body, direction: row.direction, unread: 0, sealed: false };
      map.set(row.thread_id, stat);
    }
    if (!stat.sealed) {
      if (row.direction === "inbound") {
        stat.unread += 1;
      } else {
        stat.sealed = true;
      }
    }
  }
  return map;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  portal: "Portal",
  referral: "Referido",
  listing: "Publicación",
  other: "Otro",
};

function budgetLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  if (min != null && max != null && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((max ?? min) as number);
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
      .select("id, display_name, phone")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(1),
  ]);

  // Per-agent isolation (JS-side so it tolerates pre-migration rows where the
  // owner column doesn't exist yet): my own conversations + unowned/legacy.
  const me = session.profile.id;
  const threads = (threadsRes.data ?? []).filter(
    (t) =>
      (t.owner_profile_id == null || t.owner_profile_id === me) &&
      // Hide the original demo/seed threads now that real chats sync in.
      !(
        typeof t.external_thread_id === "string" &&
        t.external_thread_id.startsWith("zc_")
      ),
  );
  const stats = await threadStats(
    supabase,
    organizationId,
    threads.map((t) => t.id),
  );

  const conversations: ConversationSummary[] = threads.map((thread) => {
    const stat = stats.get(thread.id);
    return {
      id: thread.id,
      channel: thread.channel,
      contactName: thread.contact_name ?? thread.contact_phone,
      contactPhone: thread.contact_phone,
      leadId: thread.lead_id,
      lastMessage: stat?.body ?? null,
      lastMessageAt: thread.last_message_at,
      lastDirection: stat?.direction ?? null,
      unread: stat?.unread ?? 0,
    };
  });

  const connectionRow = (connectionsRes.data ?? [])[0] ?? null;
  return {
    status: "ready",
    conversations,
    connected: connectionRow != null,
    connection: connectionRow
      ? {
          displayName: connectionRow.display_name,
          phone: connectionRow.phone,
        }
      : null,
    canReply: hasZernioConfig(),
  };
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

  if (
    !thread ||
    (thread.owner_profile_id != null &&
      thread.owner_profile_id !== session.profile.id)
  ) {
    return { status: "not_found" };
  }

  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true })
    .limit(300);

  const contact: ConversationContact = {
    leadId: thread.lead_id,
    email: null,
    source: null,
    stageName: null,
    assigneeName: null,
    zone: null,
    budgetLabel: null,
    notes: [],
  };

  if (thread.lead_id) {
    const [{ data: lead }, { data: activities }] = await Promise.all([
      supabase
        .from("leads")
        .select("email, source, desired_zone, budget_min, budget_max, stage_id, assigned_to")
        .eq("id", thread.lead_id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("lead_activities")
        .select("id, title, body, created_at, activity_type")
        .eq("organization_id", organizationId)
        .eq("lead_id", thread.lead_id)
        .eq("activity_type", "note")
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    if (lead) {
      contact.email = lead.email;
      contact.source = lead.source ? (SOURCE_LABELS[lead.source] ?? lead.source) : null;
      contact.zone = lead.desired_zone;
      contact.budgetLabel = budgetLabel(lead.budget_min, lead.budget_max);
      if (lead.stage_id) {
        const { data: stage } = await supabase
          .from("pipeline_stages")
          .select("name")
          .eq("id", lead.stage_id)
          .maybeSingle();
        contact.stageName = stage?.name ?? null;
      }
      if (lead.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", lead.assigned_to)
          .maybeSingle();
        contact.assigneeName = profile?.full_name ?? null;
      }
    }
    contact.notes = (activities ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      at: a.created_at,
    }));
  }

  // Only a live inbound opens the 24h free-reply window — imported history
  // doesn't count, so the composer reflects what Meta will actually accept.
  const lastInboundAt =
    [...(messages ?? [])]
      .reverse()
      .find((m) => m.direction === "inbound" && !isHistoryMessage(m.media))
      ?.sent_at ?? null;

  return {
    status: "ready",
    thread,
    messages: messages ?? [],
    canReply: hasZernioConfig(),
    contact,
    window: computeServiceWindow(lastInboundAt),
  };
}

// Full-text-ish search across message bodies → the thread ids that contain a
// match. The inbox only reveals conversations it already loaded (agent-scoped),
// so this never leaks another agent's threads.
export async function searchConversationThreadIds(
  query: string,
): Promise<string[]> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return [];
  }
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("thread_id")
    .eq("organization_id", session.profile.organization_id)
    .ilike("body", `%${q}%`)
    .limit(300);
  return [...new Set((data ?? []).map((r) => r.thread_id))];
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
    .select("*")
    .eq("id", input.threadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (
    !thread ||
    (thread.owner_profile_id != null &&
      thread.owner_profile_id !== session.profile.id)
  ) {
    return { ok: false, error: "La conversación no existe." };
  }
  if (!thread.external_thread_id) {
    return { ok: false, error: "Esta conversación no está vinculada a un canal." };
  }

  // Meta only allows free-form replies inside the 24h service window; outside
  // it a paid template is required, so block rather than incur a charge.
  const window = computeServiceWindow(
    await lastLiveInboundAt(supabase, organizationId, thread.id),
  );
  if (!window.open) {
    return { ok: false, error: windowClosedMessage(window) };
  }

  // Zernio requires the connected account id on send, so resolve the org's
  // active connection for this thread's channel.
  const { data: connection } = await supabase
    .from("channel_connections")
    .select("external_account_id")
    .eq("organization_id", organizationId)
    .eq("provider", "zernio")
    .eq("platform", thread.channel)
    .eq("status", "active")
    .maybeSingle();

  if (!connection?.external_account_id) {
    return {
      ok: false,
      error: "Conecta WhatsApp para responder desde Domika.",
    };
  }

  const sent = await sendZernioMessage(
    thread.external_thread_id,
    connection.external_account_id,
    text,
  );
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
    .select("*")
    .eq("id", threadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (
    !thread ||
    (thread.owner_profile_id != null &&
      thread.owner_profile_id !== session.profile.id)
  ) {
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
  let ownerProfileId: string | null = null;
  if (msg.externalAccountId) {
    const { data } = await supabase
      .from("channel_connections")
      .select("organization_id, connected_by")
      .eq("external_account_id", msg.externalAccountId)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      organizationId = data.organization_id;
      ownerProfileId = data.connected_by;
    }
  }
  if (!organizationId) {
    // Fallback: a single active connection (common pilot case).
    const { data } = await supabase
      .from("channel_connections")
      .select("organization_id, connected_by")
      .eq("status", "active")
      .limit(2);
    if ((data ?? []).length === 1) {
      organizationId = data![0].organization_id;
      ownerProfileId = data![0].connected_by;
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
        owner_profile_id: ownerProfileId,
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

// Pulls existing conversations + messages from Zernio into our inbox. The
// webhook only delivers NEW inbound messages, so without this a freshly
// connected number shows an empty inbox even though the history is already in
// Zernio. Idempotent: threads keyed by (org, external_thread_id), messages by
// (org, external_message_id). Scope to one org, or all connections when omitted.
export async function syncZernioConversations(options?: {
  organizationId?: string;
  maxConversations?: number;
}): Promise<{ threads: number; messages: number }> {
  if (!hasZernioConfig()) {
    return { threads: 0, messages: 0 };
  }
  const supabase = createAdminSupabaseClient();

  // Connected accounts → their owning org + agent, for attribution/isolation.
  let query = supabase
    .from("channel_connections")
    .select("external_account_id, organization_id, connected_by")
    .eq("provider", "zernio")
    .eq("status", "active");
  if (options?.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }
  const { data: connections } = await query;
  const acctMap = new Map<string, { org: string; owner: string | null }>();
  for (const conn of connections ?? []) {
    if (conn.external_account_id) {
      acctMap.set(conn.external_account_id, {
        org: conn.organization_id,
        owner: conn.connected_by,
      });
    }
  }
  if (acctMap.size === 0) {
    return { threads: 0, messages: 0 };
  }

  // Pull per connected account so we only ever see this org's conversations.
  const perAccount = await Promise.all(
    [...acctMap.keys()].map((accountId) => listZernioConversations(accountId)),
  );
  const scoped = perAccount
    .flat()
    .filter((c) => c.accountId && acctMap.has(c.accountId))
    .slice(0, options?.maxConversations ?? 100);

  let threadCount = 0;
  let messageCount = 0;

  for (const conv of scoped) {
    const target = acctMap.get(conv.accountId as string);
    if (!target) continue;
    const { org, owner } = target;

    const { data: existing } = await supabase
      .from("whatsapp_threads")
      .select("id")
      .eq("organization_id", org)
      .eq("external_thread_id", conv.id)
      .maybeSingle();

    let threadId = existing?.id ?? null;
    if (!threadId) {
      const { data: created } = await supabase
        .from("whatsapp_threads")
        .insert({
          organization_id: org,
          channel: "whatsapp",
          external_thread_id: conv.id,
          contact_phone: conv.contactPhone ?? conv.id,
          contact_name: conv.contactName,
          last_message_at: conv.updatedTime,
          owner_profile_id: owner,
        })
        .select("id")
        .single();
      threadId = created?.id ?? null;
      if (threadId) threadCount += 1;
    }
    if (!threadId) continue;

    const history = await listZernioMessages(conv.id, conv.accountId as string);
    for (const msg of history) {
      const { data: dupe } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("organization_id", org)
        .eq("external_message_id", msg.id)
        .maybeSingle();
      if (dupe) continue;
      await supabase.from("whatsapp_messages").insert({
        organization_id: org,
        thread_id: threadId,
        direction: msg.direction,
        external_message_id: msg.id,
        body: msg.body,
        // Tag history-imported messages so the 24h window logic can ignore
        // them (Meta doesn't treat them as customer-initiated).
        media: msg.fromHistory ? { source: HISTORY_SOURCE } : [],
        sent_at: msg.sentAt,
      });
      messageCount += 1;
    }

    if (conv.updatedTime) {
      await supabase
        .from("whatsapp_threads")
        .update({ last_message_at: conv.updatedTime })
        .eq("id", threadId)
        .eq("organization_id", org);
    }
  }

  return { threads: threadCount, messages: messageCount };
}

export type DisconnectResult = { ok: true } | { ok: false; error: string };

// Disconnects this org's WhatsApp number. Chat history stays in Domika — only
// the live connection is removed, so nothing the agent already received is lost.
// Reconnecting means going through the WhatsApp signup again.
export async function disconnectWhatsapp(): Promise<DisconnectResult> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }
  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: connection } = await supabase
    .from("channel_connections")
    .select("id, external_account_id")
    .eq("organization_id", organizationId)
    .eq("provider", "zernio")
    .eq("platform", "whatsapp")
    .eq("status", "active")
    .maybeSingle();

  if (!connection?.external_account_id) {
    return { ok: false, error: "No hay una cuenta de WhatsApp conectada." };
  }

  const removed = await disconnectZernioAccount(connection.external_account_id);
  if (removed.ok === false) {
    return {
      ok: false,
      error: `No se pudo desconectar (${removed.error ?? "error"}).`,
    };
  }

  await supabase
    .from("channel_connections")
    .delete()
    .eq("id", connection.id)
    .eq("organization_id", organizationId);

  return { ok: true };
}

export type WhatsappContact = {
  phone: string;
  name: string | null;
  /** Free-form reachable now (they messaged within 24h). */
  windowOpen: boolean;
  hoursLeft: number;
};

// The agent's WhatsApp address book, for starting a new chat from Domika.
export async function getWhatsappContacts(): Promise<WhatsappContact[]> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated" || !hasZernioConfig()) {
    return [];
  }
  const supabase = createAdminSupabaseClient();
  const { data: connection } = await supabase
    .from("channel_connections")
    .select("external_account_id")
    .eq("organization_id", session.profile.organization_id)
    .eq("provider", "zernio")
    .eq("platform", "whatsapp")
    .eq("status", "active")
    .maybeSingle();
  if (!connection?.external_account_id) {
    return [];
  }
  const contacts = await listZernioContacts(connection.external_account_id);

  // Reachability is decided by LIVE inbound only. The provider's
  // lastMessageReceivedAt reflects when history was imported, not when the
  // customer actually wrote, so trusting it would mark closed windows as open
  // and every send would fail with 131047.
  const liveByPhone = await liveInboundByPhone(
    supabase,
    session.profile.organization_id,
  );

  return contacts
    .map((c) => {
      const digits = c.phone.replace(/[^\d]/g, "");
      const window = computeServiceWindow(liveByPhone.get(digits) ?? null);
      return {
        phone: c.phone,
        name: c.name,
        windowOpen: window.open,
        hoursLeft: window.hoursLeft,
      };
    })
    // Reachable-now contacts first: those are the ones an agent can actually
    // message for free right now.
    .sort((a, b) => {
      if (a.windowOpen !== b.windowOpen) return a.windowOpen ? -1 : 1;
      return (a.name ?? a.phone).localeCompare(b.name ?? b.phone);
    });
}

export type StartConversationResult =
  | { ok: true; threadId: string | null }
  | { ok: false; error: string };

// Opens a brand-new WhatsApp chat with a number and records it locally.
export async function startWhatsappConversation(input: {
  phone: string;
  text: string;
  name?: string | null;
}): Promise<StartConversationResult> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }
  const phone = input.phone.trim();
  const text = input.text.trim();
  if (!phone) return { ok: false, error: "Ingresa un número." };
  if (!text) return { ok: false, error: "Escribe un mensaje." };

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: connection } = await supabase
    .from("channel_connections")
    .select("external_account_id")
    .eq("organization_id", organizationId)
    .eq("provider", "zernio")
    .eq("platform", "whatsapp")
    .eq("status", "active")
    .maybeSingle();
  if (!connection?.external_account_id) {
    return { ok: false, error: "Conecta WhatsApp para iniciar un chat." };
  }

  // Opening a chat is only free (and only allowed without a paid template) if
  // the contact messaged us within 24h. Resolve that server-side rather than
  // trusting the client: prefer our own inbound history, then the provider's
  // contact record.
  const normalized = normalizePhone(phone) ?? phone;
  const { data: knownThread } = await supabase
    .from("whatsapp_threads")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_phone", normalized)
    .maybeSingle();

  const lastInboundAt = knownThread?.id
    ? await lastLiveInboundAt(supabase, organizationId, knownThread.id)
    : null;

  const window = computeServiceWindow(lastInboundAt);
  if (!window.open) {
    return { ok: false, error: windowClosedMessage(window) };
  }

  const started = await startZernioConversation(
    connection.external_account_id,
    phone,
    text,
  );
  if (started.ok === false) {
    return { ok: false, error: started.error ?? "No se pudo iniciar el chat." };
  }

  const nowIso = new Date().toISOString();
  let threadId: string | null = null;

  if (started.conversationId) {
    const { data: existing } = await supabase
      .from("whatsapp_threads")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("external_thread_id", started.conversationId)
      .maybeSingle();
    threadId = existing?.id ?? null;
    if (!threadId) {
      const { data: created } = await supabase
        .from("whatsapp_threads")
        .insert({
          organization_id: organizationId,
          channel: "whatsapp",
          external_thread_id: started.conversationId,
          contact_phone: normalizePhone(phone) ?? phone,
          contact_name: input.name ?? null,
          last_message_at: nowIso,
          owner_profile_id: session.profile.id,
        })
        .select("id")
        .single();
      threadId = created?.id ?? null;
    }
    if (threadId) {
      await supabase.from("whatsapp_messages").insert({
        organization_id: organizationId,
        thread_id: threadId,
        direction: "outbound",
        sender_profile_id: session.profile.id,
        body: text,
        media: [],
        sent_at: nowIso,
      });
    }
  }

  return { ok: true, threadId };
}

// Session-scoped sync for the "Sincronizar" button: pulls the signed-in agent's
// org conversations from Zernio.
export async function syncMyConversations(): Promise<{
  threads: number;
  messages: number;
}> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { threads: 0, messages: 0 };
  }
  return syncZernioConversations({
    organizationId: session.profile.organization_id,
  });
}
