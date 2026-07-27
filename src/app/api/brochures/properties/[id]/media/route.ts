import { getBrochurePropertyMedia } from "@/lib/domain/brochures";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await getBrochurePropertyMedia(id);

  if (result.ok === false) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  return Response.json(result);
}
