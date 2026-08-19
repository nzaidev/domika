import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { MessageChannel } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import {
  ZERNIO_CONNECT_SLUG,
  getConnectUrl,
  hasZernioConfig,
} from "@/lib/integrations/zernio";

// "Conectar {canal}" → Zernio embedded signup for WhatsApp / Instagram /
// Facebook (Messenger). The route segment is the channel; on return the
// callback stores the connection.
const CHANNELS: Record<string, MessageChannel> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  facebook: "messenger",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  const headerList = await headers();
  const host = headerList.get("host") ?? "domika.io";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const channel = CHANNELS[platform];
  if (!channel) {
    return NextResponse.redirect(`${origin}/conversations?connect=badchannel`);
  }

  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const profileId = process.env.ZERNIO_PROFILE_ID;
  if (!hasZernioConfig() || !profileId) {
    return NextResponse.redirect(`${origin}/conversations?connect=unconfigured`);
  }

  const redirectUrl = `${origin}/api/integrations/zernio/${platform}/callback`;
  const url = await getConnectUrl(
    ZERNIO_CONNECT_SLUG[channel],
    profileId,
    redirectUrl,
  );
  if (!url) {
    return NextResponse.redirect(`${origin}/conversations?connect=error`);
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(
    "zernio_connect",
    JSON.stringify({
      org: session.profile.organization_id,
      by: session.profile.id,
      channel,
    }),
    { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" },
  );
  return response;
}
