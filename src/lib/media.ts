// Builds the same-origin URL for a storage object (see /api/media route).
// All UI rendering of property photos/brochures must use this instead of
// the raw Supabase public URL.
export function mediaUrl(storagePath: string): string {
  return `/api/media/${storagePath}`;
}
