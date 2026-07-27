import "server-only";

import sharp from "sharp";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import { hasR2Config, r2Download } from "@/lib/storage/r2";

type SupabaseAdmin = ReturnType<typeof createAdminSupabaseClient>;

export async function fetchUrlBytes(url: string): Promise<ArrayBuffer | null> {
  if (!/^https?:\/\//.test(url)) {
    return null;
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function fetchStorageBytes(
  storagePath: string,
  publicUrl: string | null,
  supabase: SupabaseAdmin,
  mediaBaseUrl?: string | null,
): Promise<ArrayBuffer | null> {
  // Server-side fetch() needs an ABSOLUTE URL. In production both mediaUrl()
  // and the stored public_url are relative "/api/media/..." paths, so build an
  // absolute URL against the app origin (mediaBaseUrl) — that same-origin proxy
  // serves the object and is exactly what the public pages already use.
  const proxyUrl = mediaBaseUrl
    ? `${mediaBaseUrl.replace(/\/+$/, "")}/api/media/${storagePath}`
    : null;
  const candidates = [publicUrl, mediaUrl(storagePath), proxyUrl].filter(
    (url): url is string => Boolean(url) && /^https?:\/\//.test(url as string),
  );

  for (const url of candidates) {
    const bytes = await fetchUrlBytes(url);
    if (bytes) {
      return bytes;
    }
  }

  if (hasR2Config()) {
    const fromR2 = await r2Download(storagePath);
    if (fromR2?.body) {
      return fromR2.body;
    }
  }

  const { data: file } = await supabase.storage
    .from("property-media")
    .download(storagePath);
  return file ? await file.arrayBuffer() : null;
}

export async function bytesToBrochureJpeg(bytes: ArrayBuffer): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(bytes))
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .jpeg({ quality: 85, progressive: false, mozjpeg: false })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function fetchStorageImageAsJpeg(
  storagePath: string,
  publicUrl: string | null,
  supabase: SupabaseAdmin,
  mediaBaseUrl?: string | null,
): Promise<Buffer | null> {
  const bytes = await fetchStorageBytes(
    storagePath,
    publicUrl,
    supabase,
    mediaBaseUrl,
  );
  return bytes ? await bytesToBrochureJpeg(bytes) : null;
}

export async function fetchRemoteImageAsJpeg(url: string): Promise<Buffer | null> {
  const bytes = await fetchUrlBytes(url);
  return bytes ? await bytesToBrochureJpeg(bytes) : null;
}
