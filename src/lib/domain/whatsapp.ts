import "server-only";

import { randomUUID } from "node:crypto";
import type { Json } from "@/lib/database.types";
import { normalizePhone } from "@/lib/phone";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { runAutomationRules } from "@/lib/domain/automation";
import { hasR2Config, r2Upload } from "@/lib/storage/r2";
import { mediaUrl } from "@/lib/media";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
};

// Inbound attachments arrive as Meta media IDs; the binary must be pulled
// from the Graph API with the account's access token (media URLs expire in
// minutes) and re-hosted in our own storage.
async function downloadInboundMedia(input: {
  mediaId: string;
  accessToken: string;
  organizationId: string;
  threadKey: string;
}): Promise<{ storagePath: string; mimeType: string } | null> {
  try {
    const meta = await fetch(`${GRAPH_API_BASE}/${input.mediaId}`, {
      headers: { authorization: `Bearer ${input.accessToken}` },
      cache: "no-store",
    });

    if (!meta.ok) {
      return null;
    }

    const info = (await meta.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };

    if (!info.url || (info.file_size ?? 0) > MAX_MEDIA_BYTES) {
      return null;
    }

    const file = await fetch(info.url, {
      headers: { authorization: `Bearer ${input.accessToken}` },
      cache: "no-store",
    });

    if (!file.ok) {
      return null;
    }

    const mimeType = info.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream";
    const extension = MEDIA_EXTENSIONS[mimeType.split(";")[0]] ?? "bin";
    const storagePath = `${input.organizationId}/whatsapp/${input.threadKey}/${randomUUID()}.${extension}`;
    const body = Buffer.from(await file.arrayBuffer());

    const upload = await r2Upload(storagePath, body, mimeType);

    if (upload.ok === false) {
      return null;
    }

    return { storagePath, mimeType };
  } catch {
    return null;
  }
}

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

async function messageMedia(
  message: MetaWebhookMessage,
  context: { organizationId: string; accessToken: string | null },
) {
  const media =
    message.image ?? message.video ?? message.audio ?? message.document;

  if (!media) {
    return [];
  }

  const entry: Record<string, unknown> = { type: message.type, ...media };

  // Re-host the binary when the account has a token; otherwise keep only
  // the metadata (Meta media URLs expire within minutes).
  if (context.accessToken && hasR2Config() && media.id) {
    const downloaded = await downloadInboundMedia({
      mediaId: media.id,
      accessToken: context.accessToken,
      organizationId: context.organizationId,
      threadKey: normalizePhone(message.from)?.replace("+", "") ?? "unknown",
    });

    if (downloaded) {
      entry.storage_path = downloaded.storagePath;
      entry.url = mediaUrl(downloaded.storagePath);
      entry.mime_type = downloaded.mimeType;
    }
  }

  return [entry];
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
        .select("organization_id, access_token")
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
          accessToken: account.access_token,
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
    accessToken: string | null;
  },
): Promise<IngestOutcome> {
  const { organizationId, message, contactName } = input;
  const contactPhone = normalizePhone(message.from) ?? message.from;

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

    await runAutomationRules("new_message", {
      organizationId,
      leadId,
      leadName: contactName ?? contactPhone,
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
    media: (await messageMedia(message, {
      organizationId,
      accessToken: input.accessToken,
    })) as Json,
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
