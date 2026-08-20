"use server";

import { revalidatePath } from "next/cache";
import {
  convertConversationToLead,
  disconnectWhatsapp,
  getConversationDetail,
  getWhatsappContacts,
  searchConversationThreadIds,
  sendConversationReply,
  startWhatsappConversation,
  syncMyConversations,
  type WhatsappContact,
} from "@/lib/domain/conversations";
import type { MessageChannel } from "@/lib/database.types";

export async function searchMessagesAction(query: string): Promise<string[]> {
  return searchConversationThreadIds(query);
}

export async function syncConversationsAction(): Promise<{
  threads: number;
  messages: number;
}> {
  const result = await syncMyConversations();
  revalidatePath("/conversations");
  return result;
}

export async function loadContactsAction(): Promise<WhatsappContact[]> {
  return getWhatsappContacts();
}

export async function disconnectWhatsappAction(): Promise<{
  error: string | null;
}> {
  const result = await disconnectWhatsapp();
  if (result.ok === false) {
    return { error: result.error };
  }
  revalidatePath("/conversations");
  return { error: null };
}

export async function startConversationAction(
  phone: string,
  text: string,
  name: string | null,
): Promise<{ error: string | null; threadId: string | null }> {
  const result = await startWhatsappConversation({ phone, text, name });
  if (result.ok === false) {
    return { error: result.error, threadId: null };
  }
  revalidatePath("/conversations");
  return { error: null, threadId: result.threadId };
}

export type LoadedMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  sent_at: string;
  media: unknown;
};

export type ConversationNote = {
  id: string;
  title: string;
  body: string | null;
  at: string;
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
      email: string | null;
      source: string | null;
      stageName: string | null;
      assigneeName: string | null;
      zone: string | null;
      budgetLabel: string | null;
      notes: ConversationNote[];
      windowOpen: boolean;
      windowHoursLeft: number;
      windowNeverMessaged: boolean;
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
    email: detail.contact.email,
    source: detail.contact.source,
    stageName: detail.contact.stageName,
    assigneeName: detail.contact.assigneeName,
    zone: detail.contact.zone,
    budgetLabel: detail.contact.budgetLabel,
    notes: detail.contact.notes,
    windowOpen: detail.window.open,
    windowHoursLeft: detail.window.hoursLeft,
    windowNeverMessaged: detail.window.neverMessaged,
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
