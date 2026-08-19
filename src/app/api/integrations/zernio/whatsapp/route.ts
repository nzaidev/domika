import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSessionProfile } from "@/lib/auth/session";
import { getWhatsappConnectUrl, hasZernioConfig } from "@/lib/integrations/zernio";

// "Conectar WhatsApp" → kicks off Zernio's embedded signup and redirects the
// agent to Meta's signup. On return, the callback route stores the connection.

export async function GET() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "domika.io";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const profileId = process.env.ZERNIO_PROFILE_ID;
  if (!hasZernioConfig() || !profileId) {
    return NextResponse.redirect(`${origin}/settings?zernio=unconfigured`);
  }

  const redirectUrl = `${origin}/api/integrations/zernio/whatsapp/callback`;
  const url = await getWhatsappConnectUrl(profileId, redirectUrl);
  if (!url) {
    return NextResponse.redirect(`${origin}/settings?zernio=error`);
  }

  const response = NextResponse.redirect(url);
  // Remember who started the connect, to attach the connection on callback.
  response.cookies.set(
    "zernio_connect",
    JSON.stringify({
      org: session.profile.organization_id,
      by: session.profile.id,
    }),
    { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" },
  );
  return response;
}
