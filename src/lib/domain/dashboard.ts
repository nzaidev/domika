import "server-only";

import type { ProfileRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import type { PropertyWithCover } from "@/lib/domain/properties";

export type StageSummary = {
  id: string;
  name: string;
  count: number;
  leads: Array<{ id: string; name: string; subtitle: string }>;
};

export type InboxThread = {
  id: string;
  leadId: string | null;
  name: string;
  snippet: string;
  time: string | null;
};

export type SourceCount = { source: string; label: string; count: number };

export type UpcomingTask = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  leadId: string | null;
  taskType: string;
  overdue: boolean;
};

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
      stages: StageSummary[];
      inbox: InboxThread[];
      leadSources: SourceCount[];
      upcomingTasks: UpcomingTask[];
    };

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  portal: "Portal",
  referral: "Referidos",
  listing: "Publicaciones",
  other: "Otro",
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

  const [stageRows, leadRows, threads, taskRows] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true })
      .limit(6),
    supabase
      .from("leads")
      .select("id, full_name, stage_id, source, desired_zone, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("whatsapp_threads")
      .select("id, lead_id, contact_name, contact_phone, last_message_at")
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false })
      .limit(4),
    supabase
      .from("tasks")
      .select("id, title, due_at, priority, lead_id, task_type")
      .eq("organization_id", organizationId)
      .in("status", ["todo", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
  ]);

  const threadRows = threads.data ?? [];
  let lastMessageByThread = new Map<string, string>();

  if (threadRows.length > 0) {
    const { data: recentMessages } = await supabase
      .from("whatsapp_messages")
      .select("thread_id, body, sent_at")
      .eq("organization_id", organizationId)
      .in(
        "thread_id",
        threadRows.map((thread) => thread.id),
      )
      .order("sent_at", { ascending: false })
      .limit(40);

    lastMessageByThread = new Map();
    for (const message of recentMessages ?? []) {
      if (!lastMessageByThread.has(message.thread_id)) {
        lastMessageByThread.set(message.thread_id, message.body ?? "");
      }
    }
  }

  const allLeads = leadRows.data ?? [];
  const sourceCounts = new Map<string, number>();
  for (const lead of allLeads) {
    sourceCounts.set(lead.source, (sourceCounts.get(lead.source) ?? 0) + 1);
  }

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
      .select("property_id, storage_path, is_cover, position")
      .eq("organization_id", organizationId)
      .in(
        "property_id",
        recentRows.map((row) => row.id),
      )
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true });

    for (const item of media ?? []) {
      if (!covers.has(item.property_id)) {
        covers.set(item.property_id, mediaUrl(item.storage_path));
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
    stages: (stageRows.data ?? []).map((stage) => {
      const stageLeads = allLeads.filter((lead) => lead.stage_id === stage.id);
      return {
        id: stage.id,
        name: stage.name,
        count: stageLeads.length,
        leads: stageLeads.slice(0, 3).map((lead) => ({
          id: lead.id,
          name: lead.full_name,
          subtitle: [SOURCE_LABELS[lead.source] ?? lead.source, lead.desired_zone]
            .filter(Boolean)
            .join(" · "),
        })),
      };
    }),
    inbox: threadRows.map((thread) => ({
      id: thread.id,
      leadId: thread.lead_id,
      name: thread.contact_name ?? thread.contact_phone,
      snippet: lastMessageByThread.get(thread.id) ?? "—",
      time: thread.last_message_at,
    })),
    leadSources: [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({
        source,
        label: SOURCE_LABELS[source] ?? source,
        count,
      })),
    upcomingTasks: (taskRows.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.due_at,
      priority: task.priority,
      leadId: task.lead_id,
      taskType: task.task_type,
      overdue: Boolean(
        task.due_at && new Date(task.due_at).getTime() < Date.now(),
      ),
    })),
  };
}
