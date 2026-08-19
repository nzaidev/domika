import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import {
  parseZernioInbound,
  verifyZernioSignature,
} from "@/lib/integrations/zernio";
import { ingestZernioInbound } from "@/lib/domain/conversations";

// Zernio inbound webhook (message.received). Signed with HMAC-SHA256 using the
// secret we registered the webhook with (ZERNIO_WEBHOOK_SECRET).

export async function POST(request: Request) {
  if (!hasSupabaseServerConfig() || !process.env.ZERNIO_WEBHOOK_SECRET) {
    return Response.json({ error: "Webhook no configurado." }, { status: 503 });
  }

  const rawBody = await request.text();
  // Signature header name isn't published; check the common candidates.
  const signature =
    request.headers.get("x-zernio-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("x-webhook-signature");

  if (!verifyZernioSignature(rawBody, signature)) {
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const message = parseZernioInbound(payload, new Date().toISOString());
    if (!message) {
      return Response.json({ ignored: true }, { status: 200 });
    }
    const result = await ingestZernioInbound(message);
    return Response.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    // 200 so the provider doesn't retry-storm; failure is logged.
    console.error("[webhooks/zernio] ingest failed:", error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
