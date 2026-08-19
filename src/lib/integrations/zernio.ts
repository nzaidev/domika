import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Zernio (OpenAI-style REST) is our WhatsApp/omnichannel transport — it wraps
// Meta's Embedded Signup so each agent connects a number without a Meta app.
// Docs: https://docs.zernio.com  ·  base https://zernio.com/api  ·  Bearer auth.

const BASE_URL = "https://zernio.com/api";

export function hasZernioConfig(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

async function zernioFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) {
    throw new Error("ZERNIO_API_KEY no está configurado.");
  }
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

// Zernio connect slug per channel. Confirmed for WhatsApp
// (GET /v1/connect/whatsapp); instagram/facebook follow the same
// documented pattern and the platform naming in Zernio's inbox API.
export const ZERNIO_CONNECT_SLUG: Record<
  MessageChannelName,
  "whatsapp" | "instagram" | "facebook"
> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  messenger: "facebook",
};

// Embedded signup: returns the provider signup URL to redirect the agent to.
// GET /v1/connect/{slug}?profileId=&redirect_url=
export async function getConnectUrl(
  slug: string,
  profileId: string,
  redirectUrl: string,
): Promise<string | null> {
  try {
    const res = await zernioFetch(
      `/v1/connect/${slug}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(redirectUrl)}`,
    );
    if (!res.ok) {
      console.error(`[zernio] connect ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    // Field name for the returned auth URL isn't fixed in the docs excerpt.
    return data?.url ?? data?.authUrl ?? data?.connectUrl ?? data?.data?.url ?? null;
  } catch (error) {
    console.error("[zernio] connect failed:", error);
    return null;
  }
}

// Registers our inbound webhook once. POST /v1/webhooks/settings.
export async function registerZernioWebhook(
  callbackUrl: string,
  secret: string,
): Promise<boolean> {
  try {
    const res = await zernioFetch(`/v1/webhooks/settings`, {
      method: "POST",
      body: JSON.stringify({
        name: "Domika inbound",
        url: callbackUrl,
        events: ["message.received"],
        secret,
        isActive: true,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error("[zernio] register webhook failed:", error);
    return false;
  }
}

// Sends a text reply into a conversation.
// POST /v1/inbox/conversations/{id}/messages
export async function sendZernioMessage(
  conversationId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await zernioFetch(
      `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        // Send-body schema isn't fully documented; { type, text } is the
        // standard shape. Confirmed against a live send before relying on it.
        body: JSON.stringify({ type: "text", text }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `Zernio ${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, messageId: data?.id ?? data?.messageId ?? undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "envío falló",
    };
  }
}

// Verifies an inbound webhook's HMAC-SHA256 signature against ZERNIO_WEBHOOK_SECRET
// (the secret we registered the webhook with).
export function verifyZernioSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) {
    return false;
  }
  const received = signatureHeader.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (expected.length !== received.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
  } catch {
    return false;
  }
}

export type ZernioInboundMessage = {
  conversationId: string;
  platform: MessageChannelName;
  externalMessageId: string | null;
  externalAccountId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  text: string | null;
  sentAt: string;
};

type MessageChannelName = "whatsapp" | "instagram" | "messenger";

function normalizePlatform(value: unknown): MessageChannelName {
  const v = String(value ?? "").toLowerCase();
  if (v === "instagram") return "instagram";
  if (v === "messenger" || v === "facebook") return "messenger";
  return "whatsapp";
}

// Normalizes a `message.received` event. The exact field names aren't published,
// so extraction is defensive across the likely shapes and is the single place
// to adjust once a real event is captured.
export function parseZernioInbound(
  payload: unknown,
  nowIso: string,
): ZernioInboundMessage | null {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root.message ?? root) as Record<string, unknown>;
  const conv = (data.conversation ?? data) as Record<string, unknown>;

  const conversationId =
    data.conversationId ?? conv.id ?? conv.conversationId ?? null;
  if (!conversationId) {
    return null;
  }

  const media = data.media ?? data.attachment ?? null;
  const text =
    (data.text as string) ??
    (data.body as string) ??
    ((data.message as Record<string, unknown>)?.text as string) ??
    (media ? "[Adjunto]" : null);

  return {
    conversationId: String(conversationId),
    platform: normalizePlatform(data.platform ?? conv.platform),
    externalMessageId:
      (data.id as string) ?? (data.messageId as string) ?? null,
    externalAccountId:
      (data.accountId as string) ??
      (conv.accountId as string) ??
      (data.accountUsername as string) ??
      (conv.accountUsername as string) ??
      null,
    contactName:
      (data.participantName as string) ??
      (conv.participantName as string) ??
      (data.senderName as string) ??
      null,
    contactPhone:
      (data.from as string) ??
      (data.sender as string) ??
      (data.phone as string) ??
      (conv.phone as string) ??
      null,
    text: typeof text === "string" ? text : null,
    sentAt:
      (data.timestamp as string) ??
      (data.sentAt as string) ??
      (data.createdTime as string) ??
      nowIso,
  };
}
