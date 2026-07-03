import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Property photo upload: validates, normalizes on ingest (EXIF rotation,
// max 1600px, WebP), stores under "{org}/{property}/{uuid}.webp" in the
// shared bucket, and records a property_media row.

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: propertyId } = await context.params;
  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!property) {
    return Response.json({ error: "La propiedad no existe." }, { status: 404 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "No se recibieron archivos." }, { status: 400 });
  }

  const { data: lastMedia } = await supabase
    .from("property_media")
    .select("position, is_cover")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: existingCount } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId);

  let position = (lastMedia?.position ?? -1) + 1;
  let hasAnyMedia = (existingCount ?? 0) > 0;
  const uploaded: Array<{ id: string; url: string | null }> = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      errors.push(`${file.name}: formato no soportado (${file.type || "?"}).`);
      continue;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${file.name}: supera el máximo de 15 MB.`);
      continue;
    }

    try {
      const original = Buffer.from(await file.arrayBuffer());
      const processed = await sharp(original)
        .rotate() // Apply EXIF orientation.
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      const storagePath = `${organizationId}/${propertyId}/${randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("property-media")
        .upload(storagePath, processed, {
          contentType: "image/webp",
          cacheControl: "31536000",
        });

      if (uploadError) {
        errors.push(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("property-media")
        .getPublicUrl(storagePath);

      const { data: mediaRow, error: insertError } = await supabase
        .from("property_media")
        .insert({
          organization_id: organizationId,
          property_id: propertyId,
          storage_path: storagePath,
          public_url: publicUrlData.publicUrl,
          media_type: "image",
          alt_text: file.name.replace(/\.[^.]+$/, ""),
          position,
          is_cover: !hasAnyMedia,
          metadata: { original_name: file.name, original_bytes: file.size },
        })
        .select("id, public_url")
        .single();

      if (insertError || !mediaRow) {
        await supabase.storage.from("property-media").remove([storagePath]);
        errors.push(`${file.name}: ${insertError?.message ?? "error al registrar"}`);
        continue;
      }

      uploaded.push({ id: mediaRow.id, url: mediaRow.public_url });
      position += 1;
      hasAnyMedia = true;
    } catch {
      errors.push(`${file.name}: no se pudo procesar la imagen.`);
    }
  }

  return Response.json(
    { uploaded: uploaded.length, media: uploaded, errors },
    { status: uploaded.length > 0 ? 200 : 422 },
  );
}
