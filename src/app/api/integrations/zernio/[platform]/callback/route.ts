import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import type { MessageChannel } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  ensureZernioProfile,
  listZernioAccounts,
  registerZernioWebhook,
} from "@/lib/integrations/zernio";
import { syncZernioConversations } from "@/lib/domain/conversations";

// Reconciling accounts + backfilling initial conversations can take a moment.
export const maxDuration = 60;

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

  // Meta redirects to Zernio's own callback, so the return leg to us carries no
  // account details. Read the truth from Zernio's API instead and reconcile the
  // account(s) the agent just connected into channel_connections.
  // Same profile the connect leg used, so we only inspect this org's accounts.
  const profileId =
    (await ensureZernioProfile(state.org)) ?? process.env.ZERNIO_PROFILE_ID;
  if (!profileId) {
    return NextResponse.redirect(`${origin}/conversations?connect=misconfigured`);
  }

  const supabase = createAdminSupabaseClient();

  // Accounts already claimed by anyone — so we attribute only the NEW one(s) to
  // the agent who started this connect (per-agent isolation on a shared profile).
  const { data: existingRows } = await supabase
    .from("channel_connections")
    .select("external_account_id")
    .eq("provider", "zernio");
  const known = new Set(
    (existingRows ?? []).map((r) => r.external_account_id),
  );

  const accounts = await listZernioAccounts(profileId);
  // Only claim accounts for the channel the agent chose (WhatsApp) that we
  // haven't already attributed to someone.
  const fresh = accounts.filter(
    (a) => a.platform === state.channel && !known.has(a.id),
  );

  if (fresh.length === 0) {
    // Nothing new for this channel — the signup didn't finish (e.g. no WhatsApp
    // number was selected). Don't claim unrelated/stale accounts.
    return NextResponse.redirect(`${origin}/conversations?connect=incomplete`);
  }

  await supabase.from("channel_connections").upsert(
    fresh.map((a) => ({
      organization_id: state.org,
      provider: "zernio",
      platform: state.channel,
      external_account_id: a.id,
      display_name: a.displayName ?? a.phone,
      phone: a.phone,
      connected_by: state.by ?? null,
      status: a.isActive ? "active" : "inactive",
    })),
    { onConflict: "provider,external_account_id" },
  );

  if (process.env.ZERNIO_WEBHOOK_SECRET) {
    await registerZernioWebhook(
      `${origin}/api/webhooks/zernio`,
      process.env.ZERNIO_WEBHOOK_SECRET,
    );
  }

  // Backfill the newly connected number's existing chats so the inbox isn't
  // empty on arrival. Capped + best-effort so a slow sync never blocks connect.
  try {
    await syncZernioConversations({
      organizationId: state.org,
      maxConversations: 25,
    });
  } catch (error) {
    console.error("[zernio callback] backfill failed:", error);
  }

  const response = NextResponse.redirect(`${origin}/conversations?connected=1`);
  response.cookies.delete("zernio_connect");
  return response;
}
