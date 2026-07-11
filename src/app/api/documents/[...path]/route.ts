import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Serves objects from the PRIVATE `documents` bucket (contracts, signed
// PDFs). Unlike property photos, these are never public: the caller must
// have a session, and the object's org prefix must match the caller's
// organization.

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return new Response("No autorizado.", { status: 401 });
  }

  const { path } = await context.params;
  const storagePath = (path ?? []).join("/");

  if (!storagePath || storagePath.includes("..")) {
    return new Response("Ruta inválida.", { status: 400 });
  }

  // Tenant check: paths are "{organization_id}/...".
  if (!storagePath.startsWith(`${session.profile.organization_id}/`)) {
    return new Response("No encontrado.", { status: 404 });
  }

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.storage
    .from("documents")
    .download(storagePath);

  if (!data) {
    return new Response("No encontrado.", { status: 404 });
  }

  return new Response(data, {
    status: 200,
    headers: {
      "content-type": data.type || "application/pdf",
      "cache-control": "private, max-age=3600",
    },
  });
}
