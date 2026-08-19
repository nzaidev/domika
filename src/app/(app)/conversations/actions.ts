"use server";

import { revalidatePath } from "next/cache";
import {
  convertConversationToLead,
  getConversationDetail,
  sendConversationReply,
} from "@/lib/domain/conversations";
import type { MessageChannel } from "@/lib/database.types";

export type LoadedMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  sent_at: string;
  media: unknown;
};

export type LoadConversationResult =
  | { ok: false }
  | {
      ok: true;
      messages: LoadedMessage[];
      leadId: string | null;
      contactName: string;
      contactPhone: string;
      channel: MessageChannel;
    };

export async function loadConversationAction(
  threadId: string,
): Promise<LoadConversationResult> {
  const detail = await getConversationDetail(threadId);
  if (detail.status !== "ready") {
    return { ok: false };
  }
  return {
    ok: true,
    messages: detail.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      sent_at: m.sent_at,
      media: m.media,
    })),
    leadId: detail.thread.lead_id,
    contactName: detail.thread.contact_name ?? detail.thread.contact_phone,
    contactPhone: detail.thread.contact_phone,
    channel: detail.thread.channel,
  };
}

export async function sendReplyAction(
  threadId: string,
  text: string,
): Promise<{ error: string | null }> {
  const result = await sendConversationReply({ threadId, text });
  if (result.ok === false) {
    return { error: result.error };
  }
  revalidatePath("/conversations");
  return { error: null };
}

export async function convertConversationAction(
  threadId: string,
): Promise<{ error: string | null; leadId: string | null }> {
  const result = await convertConversationToLead(threadId);
  if (result.ok === false) {
    return { error: result.error, leadId: null };
  }
  revalidatePath("/conversations");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { error: null, leadId: result.leadId };
}
