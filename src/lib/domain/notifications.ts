import "server-only";

import type { NotificationRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type NotificationsFeed =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "ready"; notifications: NotificationRow[]; unread: number };

export async function getNotificationsFeed(): Promise<NotificationsFeed> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", session.profile.organization_id)
    .eq("profile_id", session.profile.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  const notifications = data ?? [];

  return {
    status: "ready",
    notifications,
    unread: notifications.filter((n) => n.status === "unread").length,
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return 0;
  }

  const supabase = createAdminSupabaseClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", session.profile.organization_id)
    .eq("profile_id", session.profile.id)
    .eq("status", "unread");

  return count ?? 0;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return;
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("organization_id", session.profile.organization_id)
    .eq("profile_id", session.profile.id);
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return;
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("organization_id", session.profile.organization_id)
    .eq("profile_id", session.profile.id)
    .eq("status", "unread");
}
