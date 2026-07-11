// Builds the browser-facing URL for a stored media object.
//
// Canonical serving: the R2 bucket's public custom domain
// (NEXT_PUBLIC_MEDIA_BASE_URL, e.g. https://domika-fotos.tinkuai.com).
// Fallback when unset: the same-origin /api/media proxy, which streams
// from whichever backend holds the object.
export function mediaUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

  if (base) {
    return `${base.replace(/\/+$/, "")}/${storagePath}`;
  }

  return `/api/media/${storagePath}`;
}
