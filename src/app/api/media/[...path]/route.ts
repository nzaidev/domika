import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Same-origin proxy for property-media storage objects. The browser only
// ever talks to our own domain, so image rendering cannot break on
// build-time image config, DNS/ad-block rules against *.supabase.co, or
// bucket URL changes. Sits behind the auth wall like every page that
// embeds these images.

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!hasSupabaseServerConfig()) {
    return new Response("Supabase no configurado.", { status: 503 });
  }

  const { path } = await context.params;
  const storagePath = (path ?? []).join("/");

  if (!storagePath || storagePath.includes("..")) {
    return new Response("Ruta inválida.", { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from("property-media")
    .download(storagePath);

  if (error || !data) {
    return new Response("No encontrado.", { status: 404 });
  }

  return new Response(data, {
    status: 200,
    headers: {
      "content-type": data.type || "application/octet-stream",
      // Files are content-addressed (uuid names, never rewritten) — safe to
      // cache long in the browser; keep it private to stay auth-safe.
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
