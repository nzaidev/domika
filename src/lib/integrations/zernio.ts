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

// One Zernio profile per Domika organization, so each tenant's connected
// accounts live in their own container instead of everything piling into the
// shared "Default" profile (which also holds unrelated accounts from other
// products on the same Zernio API key). Named deterministically so it can be
// found again without storing the id — matches Zernio's own convention.
// GET /v1/profiles → find by name, else POST /v1/profiles.
export async function ensureZernioProfile(
  organizationId: string,
): Promise<string | null> {
  const name = `domika:${organizationId}`;
  try {
    const res = await zernioFetch(`/v1/profiles`);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const rows: Array<Record<string, unknown>> = Array.isArray(data?.profiles)
        ? data.profiles
        : [];
      const found = rows.find((p) => p.name === name);
      if (found?._id) {
        return String(found._id);
      }
    }
    const created = await zernioFetch(`/v1/profiles`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!created.ok) {
      console.error(`[zernio] create profile ${created.status}`);
      return null;
    }
    const data = await created.json().catch(() => ({}));
    return data?.profile?._id ? String(data.profile._id) : null;
  } catch (error) {
    console.error("[zernio] ensure profile failed:", error);
    return null;
  }
}

export type ZernioAccount = {
  id: string;
  platform: MessageChannelName;
  displayName: string | null;
  phone: string | null;
  isActive: boolean;
};

// Lists the channel accounts connected under a Zernio profile. This is the real
// source of truth after an embedded-signup completes: Meta redirects to Zernio's
// own callback (redirect_uri=zernio.com/.../connect/whatsapp/callback), Zernio
// stores the account, then bounces the user back to us WITHOUT the account
// details — so we read them here rather than from return-leg query params.
// GET /v1/accounts?profileId=
export async function listZernioAccounts(
  profileId: string,
): Promise<ZernioAccount[]> {
  try {
    const res = await zernioFetch(
      `/v1/accounts?profileId=${encodeURIComponent(profileId)}`,
    );
    if (!res.ok) {
      console.error(`[zernio] accounts ${res.status}`);
      return [];
    }
    const data = await res.json().catch(() => ({}));
    const rows: Array<Record<string, unknown>> = Array.isArray(data?.accounts)
      ? data.accounts
      : [];
    return rows
      .map((a) => {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        return {
          id: String(a._id ?? a.id ?? ""),
          platform: normalizePlatform(a.platform),
          displayName:
            (a.displayName as string) ??
            (meta.verifiedName as string) ??
            (a.name as string) ??
            null,
          // The WhatsApp number lives in metadata.displayPhoneNumber, not a
          // top-level field.
          phone:
            (a.phone as string) ??
            (meta.displayPhoneNumber as string) ??
            (a.phoneNumber as string) ??
            null,
          isActive: a.isActive !== false && a.enabled !== false,
        };
      })
      .filter((a) => a.id !== "" && a.id !== "undefined");
  } catch (error) {
    console.error("[zernio] list accounts failed:", error);
    return [];
  }
}

export type ZernioConversation = {
  id: string;
  accountId: string | null;
  platform: MessageChannelName;
  contactName: string | null;
  contactPhone: string | null;
  lastMessage: string | null;
  updatedTime: string | null;
  unreadCount: number;
};

// Lists the existing conversations for ONE connected account. Zernio already
// holds the number's chat history after coexistence sync — we pull it here so
// the inbox isn't limited to whatever arrives on the webhook after connecting.
// Scoped by accountId (not profileId) so a shared Zernio profile can never leak
// another tenant's conversations into this org's inbox.
// GET /v1/inbox/conversations?accountId=
export async function listZernioConversations(
  accountId: string,
): Promise<ZernioConversation[]> {
  try {
    const res = await zernioFetch(
      `/v1/inbox/conversations?accountId=${encodeURIComponent(accountId)}`,
    );
    if (!res.ok) {
      console.error(`[zernio] conversations ${res.status}`);
      return [];
    }
    const data = await res.json().catch(() => ({}));
    const rows: Array<Record<string, unknown>> = Array.isArray(data?.data)
      ? data.data
      : [];
    return rows
      .map((c) => ({
        id: String(c.id ?? c._id ?? ""),
        accountId: (c.accountId as string) ?? null,
        platform: normalizePlatform(c.platform),
        contactName:
          (c.participantName as string) ??
          (c.participantUsername as string) ??
          null,
        contactPhone:
          (c.participantUsername as string) ??
          (c.participantId as string) ??
          null,
        lastMessage: (c.lastMessage as string) ?? null,
        updatedTime: (c.updatedTime as string) ?? null,
        unreadCount: typeof c.unreadCount === "number" ? c.unreadCount : 0,
      }))
      .filter((c) => c.id !== "");
  } catch (error) {
    console.error("[zernio] list conversations failed:", error);
    return [];
  }
}

// Disconnects a connected account at the provider. DELETE /v1/accounts/{id}.
// Treats "already gone" as success so a retry can't get stuck.
export async function disconnectZernioAccount(
  accountId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await zernioFetch(
      `/v1/accounts/${encodeURIComponent(accountId)}`,
      { method: "DELETE" },
    );
    if (res.ok || res.status === 404) {
      return { ok: true };
    }
    const detail = (await res.text()).slice(0, 200);
    console.error(`[zernio] disconnect ${res.status}: ${detail}`);
    return { ok: false, error: `Zernio ${res.status}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "error",
    };
  }
}

export type ZernioContact = {
  phone: string;
  name: string | null;
  lastMessageAt: string | null;
};

// The agent's WhatsApp contacts (synced by Meta coexistence at onboarding).
// GET /v1/whatsapp/contacts?accountId=&limit=&skip=  → paginated 50 at a time.
export async function listZernioContacts(
  accountId: string,
  max = 500,
): Promise<ZernioContact[]> {
  const out: ZernioContact[] = [];
  let skip = 0;
  try {
    while (out.length < max) {
      const res = await zernioFetch(
        `/v1/whatsapp/contacts?accountId=${encodeURIComponent(accountId)}&limit=50&skip=${skip}`,
      );
      if (!res.ok) break;
      const data = await res.json().catch(() => ({}));
      const rows: Array<Record<string, unknown>> = Array.isArray(data?.contacts)
        ? data.contacts
        : [];
      for (const c of rows) {
        const phone = (c.phone as string) ?? (c.waId as string) ?? null;
        if (!phone) continue;
        const name = (c.name as string) ?? null;
        out.push({
          phone,
          // Zernio falls back to the number as the name; treat that as unnamed.
          name: name && name !== phone ? name : null,
          lastMessageAt: (c.lastMessageReceivedAt as string) ?? null,
        });
      }
      if (!data?.pagination?.hasMore || rows.length === 0) break;
      skip += rows.length;
    }
  } catch (error) {
    console.error("[zernio] list contacts failed:", error);
  }
  return out;
}

// Opens a new conversation by sending the first message to a phone number.
// POST /v1/inbox/conversations { accountId, participantUsername, message }
export async function startZernioConversation(
  accountId: string,
  phone: string,
  message: string,
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  try {
    const res = await zernioFetch(`/v1/inbox/conversations`, {
      method: "POST",
      body: JSON.stringify({
        accountId,
        participantUsername: phone,
        message,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        typeof data?.error === "string" ? data.error : `Zernio ${res.status}`;
      console.error(`[zernio] start conversation ${res.status}: ${detail}`);
      return { ok: false, error: detail };
    }
    const id =
      data?.conversation?.id ??
      data?.conversation?._id ??
      data?.id ??
      data?.conversationId ??
      null;
    return { ok: true, conversationId: id ? String(id) : undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "error",
    };
  }
}

export type ZernioHistoryMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  sentAt: string;
};

// Lists messages in a conversation. The accountId query param is required.
// GET /v1/inbox/conversations/{id}/messages?accountId=
export async function listZernioMessages(
  conversationId: string,
  accountId: string,
): Promise<ZernioHistoryMessage[]> {
  try {
    const res = await zernioFetch(
      `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?accountId=${encodeURIComponent(accountId)}`,
    );
    if (!res.ok) {
      return [];
    }
    const data = await res.json().catch(() => ({}));
    const rows: Array<Record<string, unknown>> = Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data?.data)
        ? data.data
        : [];
    return rows
      .map((m) => ({
        id: String(m.id ?? m._id ?? ""),
        direction:
          m.direction === "outgoing" || m.direction === "outbound"
            ? ("outbound" as const)
            : ("inbound" as const),
        body:
          (m.message as string) ??
          (m.text as string) ??
          (m.body as string) ??
          null,
        sentAt:
          (m.sentAt as string) ??
          (m.createdAt as string) ??
          new Date().toISOString(),
      }))
      .filter((m) => m.id !== "");
  } catch (error) {
    console.error("[zernio] list messages failed:", error);
    return [];
  }
}

// Registers our inbound webhook once. POST /v1/webhooks/settings.
// Idempotent: every connect used to POST again, stacking duplicate webhooks for
// the same URL (and duplicate inbound deliveries), so skip if it already exists.
export async function registerZernioWebhook(
  callbackUrl: string,
  secret: string,
): Promise<boolean> {
  try {
    const existing = await zernioFetch(`/v1/webhooks/settings`);
    if (existing.ok) {
      const data = await existing.json().catch(() => ({}));
      const rows: Array<Record<string, unknown>> = Array.isArray(data?.webhooks)
        ? data.webhooks
        : [];
      if (rows.some((w) => w.url === callbackUrl && w.isActive !== false)) {
        return true;
      }
    }
  } catch {
    // Fall through and attempt registration.
  }
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
// Body must be { accountId, message } — accountId is required and the text
// field is `message` (verified against the live API; a { type, text } body is
// rejected with missing_required_field).
export async function sendZernioMessage(
  conversationId: string,
  accountId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await zernioFetch(
      `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ accountId, message: text }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error(`[zernio] send ${res.status}: ${detail}`);
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
