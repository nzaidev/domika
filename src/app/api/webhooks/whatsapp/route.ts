import { createHmac, timingSafeEqual } from "node:crypto";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import {
  ingestWhatsappWebhook,
  type MetaWebhookPayload,
} from "@/lib/domain/whatsapp";

// Meta Cloud API webhook (WhatsApp Business Platform).
// GET  → subscription verification handshake.
// POST → inbound messages/status updates, signed with X-Hub-Signature-256.

export async function GET(request: Request) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    return new Response("Webhook no configurado.", { status: 503 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verificación inválida.", { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret || !signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(received, "utf8"),
  );
}

export async function POST(request: Request) {
  if (!hasSupabaseServerConfig() || !process.env.META_APP_SECRET) {
    return Response.json({ error: "Webhook no configurado." }, { status: 503 });
  }

  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: MetaWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return Response.json({ ignored: true }, { status: 200 });
  }

  try {
    const summary = await ingestWhatsappWebhook(payload);
    return Response.json({ ok: true, ...summary }, { status: 200 });
  } catch (error) {
    // Return 200 so Meta does not retry-storm; the failure is logged for us.
    console.error("[webhooks/whatsapp] ingest failed:", error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
