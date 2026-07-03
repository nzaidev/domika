import "server-only";

import type { ProfileRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PropertyWithCover } from "@/lib/domain/properties";

export type DashboardOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing"; email?: string }
  | {
      status: "ready";
      profile: ProfileRow;
      counts: {
        leads: number;
        properties: number;
        publishedListings: number;
        openTasks: number;
      };
      recentProperties: PropertyWithCover[];
    };

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return { status: "not_configured" };
  }

  if (session.status === "unauthenticated") {
    return { status: "unauthenticated" };
  }

  if (session.status === "profile_missing") {
    return { status: "profile_missing", email: session.user.email };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();
  const [leads, properties, publishedListings, openTasks, recent] =
    await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("listing_publications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "published"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "done"),
    supabase
      .from("properties")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  for (const result of [leads, properties, publishedListings, openTasks, recent]) {
    if (result.error) {
      throw result.error;
    }
  }

  const recentRows = recent.data ?? [];
  const covers = new Map<string, string | null>();

  if (recentRows.length > 0) {
    const { data: media } = await supabase
      .from("property_media")
      .select("property_id, public_url, is_cover, position")
      .eq("organization_id", organizationId)
      .in(
        "property_id",
        recentRows.map((row) => row.id),
      )
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true });

    for (const item of media ?? []) {
      if (!covers.has(item.property_id)) {
        covers.set(item.property_id, item.public_url);
      }
    }
  }

  return {
    status: "ready",
    profile: session.profile,
    counts: {
      leads: leads.count ?? 0,
      properties: properties.count ?? 0,
      publishedListings: publishedListings.count ?? 0,
      openTasks: openTasks.count ?? 0,
    },
    recentProperties: recentRows.map((row) => ({
      ...row,
      coverUrl: covers.get(row.id) ?? null,
    })),
  };
}
