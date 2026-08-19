import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import type { MessageChannel } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { registerZernioWebhook } from "@/lib/integrations/zernio";

// Return leg of the embedded signup. Attaches the connected account (for the
// channel the agent chose) to the org that started it, and ensures our inbound
// webhook is registered.

export async function GET(request: NextRequest) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "domika.io";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const raw = request.cookies.get("zernio_connect")?.value;
  let state: { org?: string; by?: string; channel?: MessageChannel } = {};
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = {};
    }
  }
  if (!state.org || !state.channel) {
    return NextResponse.redirect(`${origin}/conversations?connect=expired`);
  }

  // Connection details come back as query params; field names aren't published,
  // so read the likely candidates.
  const q = request.nextUrl.searchParams;
  // Log the real params so we can lock the field mapping on the first live connect.
  console.log(
    "[zernio callback] params:",
    JSON.stringify(Object.fromEntries(q.entries())),
  );
  const externalAccountId =
    q.get("accountId") ??
    q.get("account_id") ??
    q.get("phoneNumberId") ??
    q.get("phone_number_id") ??
    q.get("pageId") ??
    q.get("wabaId") ??
    q.get("id");
  const phone =
    q.get("phone") ?? q.get("phoneNumber") ?? q.get("display_phone_number");
  const displayName =
    q.get("name") ?? q.get("displayName") ?? q.get("username") ?? phone;

  if (!externalAccountId) {
    return NextResponse.redirect(`${origin}/conversations?connect=incomplete`);
  }

  const supabase = createAdminSupabaseClient();
  await supabase.from("channel_connections").upsert(
    {
      organization_id: state.org,
      provider: "zernio",
      platform: state.channel,
      external_account_id: externalAccountId,
      display_name: displayName,
      phone,
      connected_by: state.by ?? null,
      status: "active",
    },
    { onConflict: "provider,external_account_id" },
  );

  if (process.env.ZERNIO_WEBHOOK_SECRET) {
    await registerZernioWebhook(
      `${origin}/api/webhooks/zernio`,
      process.env.ZERNIO_WEBHOOK_SECRET,
    );
  }

  const response = NextResponse.redirect(`${origin}/conversations?connected=1`);
  response.cookies.delete("zernio_connect");
  return response;
}
