import "server-only";

import type { PublicListingRow } from "@/lib/database.types";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Public listing read for the legacy /api/listings/[slug] JSON endpoint.
//
// NOTE: the write-side commands (publish/share/engagement/capture-lead) that
// used to live here were removed — they were dead code that looked up a
// publication by id WITHOUT an org filter and wrote into the publication's
// org, a cross-tenant-write landmine (security review, 2026-07). The live
// paths are network.ts (setNetworkPublication, shareProperty,
// capturePublicListingLead) and the property/network domains, all of which
// bind writes to the caller's organization.

type ListingDistributionResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_configured" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function getPublicListing(
  slug: string,
): Promise<ListingDistributionResult<PublicListingRow>> {
  if (!hasSupabasePublicConfig()) {
    return { status: "not_configured" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_listing", {
    p_slug: slug,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const listing = data?.[0];

  if (!listing) {
    return { status: "not_found" };
  }

  return { status: "ok", data: listing };
}
