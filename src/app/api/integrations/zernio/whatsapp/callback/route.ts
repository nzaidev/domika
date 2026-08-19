import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { registerZernioWebhook } from "@/lib/integrations/zernio";

// Return leg of Zernio's embedded signup. Attaches the connected account to the
// org that started it, and ensures our inbound webhook is registered.

export async function GET(request: NextRequest) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "domika.io";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const raw = request.cookies.get("zernio_connect")?.value;
  let state: { org?: string; by?: string } = {};
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = {};
    }
  }
  if (!state.org) {
    return NextResponse.redirect(`${origin}/settings?zernio=expired`);
  }

  // Connection details come back as query params; field names aren't published,
  // so read the likely candidates.
  const q = request.nextUrl.searchParams;
  const externalAccountId =
    q.get("accountId") ??
    q.get("account_id") ??
    q.get("phoneNumberId") ??
    q.get("phone_number_id") ??
    q.get("wabaId") ??
    q.get("id");
  const phone =
    q.get("phone") ?? q.get("phoneNumber") ?? q.get("display_phone_number");
  const displayName = q.get("name") ?? q.get("displayName") ?? phone;

  if (!externalAccountId) {
    return NextResponse.redirect(`${origin}/settings?zernio=incomplete`);
  }

  const supabase = createAdminSupabaseClient();
  await supabase.from("channel_connections").upsert(
    {
      organization_id: state.org,
      provider: "zernio",
      platform: "whatsapp",
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
