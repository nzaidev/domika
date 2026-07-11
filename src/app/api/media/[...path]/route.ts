import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasR2Config, r2Download } from "@/lib/storage/r2";

// Fallback media endpoint. Canonical serving is the R2 public domain
// (NEXT_PUBLIC_MEDIA_BASE_URL); this route exists for cached pages that
// still reference /api/media paths and for pre-migration objects that only
// exist in supabase storage. Tries R2 first, then supabase.

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const storagePath = (path ?? []).join("/");

  if (!storagePath || storagePath.includes("..")) {
    return new Response("Ruta inválida.", { status: 400 });
  }

  if (hasR2Config()) {
    const object = await r2Download(storagePath);

    if (object) {
      return new Response(object.body, {
        status: 200,
        headers: {
          "content-type": object.contentType,
          "cache-control": "private, max-age=86400, immutable",
        },
      });
    }
  }

  if (hasSupabaseServerConfig()) {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase.storage
      .from("property-media")
      .download(storagePath);

    if (data) {
      return new Response(data, {
        status: 200,
        headers: {
          "content-type": data.type || "application/octet-stream",
          "cache-control": "private, max-age=86400, immutable",
        },
      });
    }
  }

  return new Response("No encontrado.", { status: 404 });
}
