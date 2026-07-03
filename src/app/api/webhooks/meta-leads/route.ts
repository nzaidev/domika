import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import {
  handleMetaVerification,
  isValidMetaSignature,
} from "@/lib/integrations/meta-webhook";
import {
  ingestMetaLeadsWebhook,
  type MetaLeadsWebhookPayload,
} from "@/lib/domain/meta-leads";

// Meta Lead Ads webhook: leadgen form submissions auto-create CRM leads.

export async function GET(request: Request) {
  return handleMetaVerification(request);
}

export async function POST(request: Request) {
  if (!hasSupabaseServerConfig() || !process.env.META_APP_SECRET) {
    return Response.json({ error: "Webhook no configurado." }, { status: 503 });
  }

  const rawBody = await request.text();

  if (
    !isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))
  ) {
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: MetaLeadsWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as MetaLeadsWebhookPayload;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (payload.object !== "page") {
    return Response.json({ ignored: true }, { status: 200 });
  }

  try {
    const summary = await ingestMetaLeadsWebhook(payload);
    return Response.json({ ok: true, ...summary }, { status: 200 });
  } catch (error) {
    // Return 200 so Meta does not retry-storm; the failure is logged for us.
    console.error("[webhooks/meta-leads] ingest failed:", error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
