import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Shapes from the Meta Cloud API webhook payload (WhatsApp Business Platform).
export type MetaWebhookMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string };
};

export type MetaWebhookValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: MetaWebhookMessage[];
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: MetaWebhookValue }>;
  }>;
};

export type IngestSummary = {
  received: number;
  stored: number;
  duplicates: number;
  unroutable: number;
  leadsCreated: number;
};

function messageBody(message: MetaWebhookMessage): string | null {
  switch (message.type) {
    case "text":
      return message.text?.body ?? null;
    case "image":
      return message.image?.caption ?? "[Imagen]";
    case "video":
      return message.video?.caption ?? "[Video]";
    case "audio":
      return "[Audio]";
    case "document":
      return message.document?.filename
        ? `[Documento] ${message.document.filename}`
        : "[Documento]";
    case "location":
      return message.location?.name
        ? `[Ubicación] ${message.location.name}`
        : "[Ubicación]";
    default:
      return `[${message.type}]`;
  }
}

function messageMedia(message: MetaWebhookMessage) {
  const media = message.image ?? message.video ?? message.audio ?? message.document;
  return media ? [{ type: message.type, ...media }] : [];
}

export async function ingestWhatsappWebhook(
  payload: MetaWebhookPayload,
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    received: 0,
    stored: 0,
    duplicates: 0,
    unroutable: 0,
    leadsCreated: 0,
  };

  const supabase = createAdminSupabaseClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = value?.messages ?? [];

      if (messages.length === 0) {
        continue; // Delivery/read status updates, template events, etc.
      }

      summary.received += messages.length;

      if (!phoneNumberId) {
        summary.unroutable += messages.length;
        continue;
      }

      const { data: account } = await supabase
        .from("whatsapp_accounts")
        .select("organization_id")
        .eq("phone_number_id", phoneNumberId)
        .eq("active", true)
        .maybeSingle();

      if (!account) {
        summary.unroutable += messages.length;
        continue;
      }

      const organizationId = account.organization_id;
      const contactNames = new Map(
        (value?.contacts ?? [])
          .filter((contact) => contact.wa_id)
          .map((contact) => [contact.wa_id as string, contact.profile?.name]),
      );

      for (const message of messages) {
        const stored = await ingestMessage(supabase, {
          organizationId,
          message,
          contactName: contactNames.get(message.from) ?? null,
        });

        if (stored === "stored") {
          summary.stored += 1;
        } else if (stored === "duplicate") {
          summary.duplicates += 1;
        } else if (stored === "stored_new_lead") {
          summary.stored += 1;
          summary.leadsCreated += 1;
        }
      }
    }
  }

  return summary;
}

type IngestOutcome = "stored" | "stored_new_lead" | "duplicate";

async function ingestMessage(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  input: {
    organizationId: string;
    message: MetaWebhookMessage;
    contactName: string | null;
  },
): Promise<IngestOutcome> {
  const { organizationId, message, contactName } = input;
  const contactPhone = message.from;

  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("external_message_id", message.id)
    .maybeSingle();

  if (existing) {
    return "duplicate";
  }

  let createdLead = false;

  // Thread per (org, channel, contact phone).
  const { data: thread } = await supabase
    .from("whatsapp_threads")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("channel", "whatsapp")
    .eq("contact_phone", contactPhone)
    .maybeSingle();

  let threadId = thread?.id ?? null;
  let leadId = thread?.lead_id ?? null;

  if (!leadId) {
    const { data: leadByPhone } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", contactPhone)
      .maybeSingle();

    leadId = leadByPhone?.id ?? null;
  }

  if (!leadId) {
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        organization_id: organizationId,
        stage_id: firstStage?.id ?? null,
        full_name: contactName ?? `WhatsApp ${contactPhone}`,
        phone: contactPhone,
        source: "whatsapp",
        source_meta: { wa_id: contactPhone },
      })
      .select("id")
      .single();

    if (leadError || !newLead) {
      throw leadError ?? new Error("No se pudo crear el lead de WhatsApp.");
    }

    leadId = newLead.id;
    createdLead = true;

    await supabase.from("lead_activities").insert({
      organization_id: organizationId,
      lead_id: leadId,
      activity_type: "message",
      title: "Prospecto creado desde WhatsApp",
      body: "Primer mensaje entrante de un número desconocido.",
    });
  }

  const sentAt = message.timestamp
    ? new Date(Number(message.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  if (threadId) {
    await supabase
      .from("whatsapp_threads")
      .update({
        lead_id: leadId,
        contact_name: contactName ?? thread?.contact_name ?? null,
        last_message_at: sentAt,
      })
      .eq("id", threadId);
  } else {
    const { data: newThread, error: threadError } = await supabase
      .from("whatsapp_threads")
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        channel: "whatsapp",
        contact_phone: contactPhone,
        contact_name: contactName,
        last_message_at: sentAt,
      })
      .select("id")
      .single();

    if (threadError || !newThread) {
      throw threadError ?? new Error("No se pudo crear el hilo de WhatsApp.");
    }

    threadId = newThread.id;
  }

  const { error: messageError } = await supabase.from("whatsapp_messages").insert({
    organization_id: organizationId,
    thread_id: threadId,
    lead_id: leadId,
    external_message_id: message.id,
    direction: "inbound",
    body: messageBody(message),
    media: messageMedia(message),
    sent_at: sentAt,
  });

  if (messageError) {
    // 23505 = unique_violation: a concurrent delivery already stored it.
    if (messageError.code === "23505") {
      return "duplicate";
    }
    throw messageError;
  }

  return createdLead ? "stored_new_lead" : "stored";
}
