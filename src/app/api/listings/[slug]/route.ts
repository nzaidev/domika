import { getPublicListing } from "@/lib/domain/listing-distribution";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const result = await getPublicListing(slug);

  if (result.status === "ok") {
    return Response.json({ listing: result.data });
  }

  if (result.status === "not_configured") {
    return Response.json(
      { error: "Supabase no está configurado." },
      { status: 503 },
    );
  }

  if (result.status === "not_found") {
    return Response.json({ error: "Propiedad no encontrada." }, { status: 404 });
  }

  return Response.json(
    { error: "No se pudo cargar la propiedad." },
    { status: 500 },
  );
}
