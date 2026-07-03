import "server-only";

import type { ProfileRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
  const [leads, properties, publishedListings, openTasks] = await Promise.all([
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
  ]);

  for (const result of [leads, properties, publishedListings, openTasks]) {
    if (result.error) {
      throw result.error;
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
  };
}
