import "server-only";

import type { TaskRow, TaskType } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TaskWithLinks = TaskRow & {
  leadName: string | null;
  propertyTitle: string | null;
  assigneeName: string | null;
};

export type TaskGroupKey =
  | "overdue"
  | "today"
  | "week"
  | "later"
  | "no_date"
  | "done";

export type AgentProductivity = {
  profileId: string;
  name: string;
  open: number;
  overdue: number;
  doneLast30: number;
  completionRate: number; // done / (done + open) over the fetched window
};

export type TaskFilters = {
  assignedTo?: string;
  taskType?: TaskType;
  includeDone?: boolean;
};

export type TasksOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      groups: Record<TaskGroupKey, TaskWithLinks[]>;
      openCount: number;
      overdueCount: number;
      members: Array<{ id: string; full_name: string }>;
      leadOptions: Array<{ id: string; full_name: string }>;
      propertyOptions: Array<{ id: string; title: string }>;
      productivity: AgentProductivity[];
    };

function groupKeyFor(task: TaskRow, now: Date): TaskGroupKey {
  if (task.status === "done" || task.status === "cancelled") {
    return "done";
  }

  if (!task.due_at) {
    return "no_date";
  }

  const due = new Date(task.due_at);

  if (due.getTime() < now.getTime()) {
    return "overdue";
  }

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (due.getTime() <= endOfToday.getTime()) {
    return "today";
  }

  const endOfWeek = new Date(endOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  if (due.getTime() <= endOfWeek.getTime()) {
    return "week";
  }

  return "later";
}

export async function getTasksOverview(
  filters: TaskFilters = {},
): Promise<TasksOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  let tasksQuery = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId);

  if (filters.assignedTo) {
    tasksQuery = tasksQuery.eq("assigned_to", filters.assignedTo);
  }

  if (filters.taskType) {
    tasksQuery = tasksQuery.eq("task_type", filters.taskType);
  }

  const [tasksResult, membersResult, leadsResult, propertiesResult] =
    await Promise.all([
      tasksQuery.order("due_at", { ascending: true }).limit(500),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("leads")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("properties")
        .select("id, title")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  const tasks = tasksResult.data ?? [];
  const members = membersResult.data ?? [];
  const memberNames = new Map(members.map((m) => [m.id, m.full_name]));
  const leadNames = new Map(
    (leadsResult.data ?? []).map((l) => [l.id, l.full_name]),
  );
  const propertyTitles = new Map(
    (propertiesResult.data ?? []).map((p) => [p.id, p.title]),
  );

  // Resolve link names for tasks pointing at older records not in the
  // recent-200 option lists.
  const missingLeadIds = [
    ...new Set(
      tasks
        .map((t) => t.lead_id)
        .filter((id): id is string => Boolean(id) && !leadNames.has(id as string)),
    ),
  ];

  if (missingLeadIds.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .in("id", missingLeadIds);
    for (const lead of data ?? []) {
      leadNames.set(lead.id, lead.full_name);
    }
  }

  const missingPropertyIds = [
    ...new Set(
      tasks
        .map((t) => t.property_id)
        .filter(
          (id): id is string => Boolean(id) && !propertyTitles.has(id as string),
        ),
    ),
  ];

  if (missingPropertyIds.length > 0) {
    const { data } = await supabase
      .from("properties")
      .select("id, title")
      .eq("organization_id", organizationId)
      .in("id", missingPropertyIds);
    for (const property of data ?? []) {
      propertyTitles.set(property.id, property.title);
    }
  }

  const now = new Date();
  const groups: Record<TaskGroupKey, TaskWithLinks[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    no_date: [],
    done: [],
  };

  for (const task of tasks) {
    const enriched: TaskWithLinks = {
      ...task,
      leadName: task.lead_id ? (leadNames.get(task.lead_id) ?? null) : null,
      propertyTitle: task.property_id
        ? (propertyTitles.get(task.property_id) ?? null)
        : null,
      assigneeName: task.assigned_to
        ? (memberNames.get(task.assigned_to) ?? null)
        : null,
    };
    groups[groupKeyFor(task, now)].push(enriched);
  }

  // Done newest-first; cap what the UI renders.
  groups.done.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  groups.done = groups.done.slice(0, 30);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const productivity: AgentProductivity[] = members.map((member) => {
    const memberTasks = tasks.filter((t) => t.assigned_to === member.id);
    const open = memberTasks.filter(
      (t) => t.status === "todo" || t.status === "in_progress",
    ).length;
    const overdue = memberTasks.filter(
      (t) =>
        (t.status === "todo" || t.status === "in_progress") &&
        t.due_at &&
        new Date(t.due_at).getTime() < now.getTime(),
    ).length;
    const doneLast30 = memberTasks.filter(
      (t) =>
        t.status === "done" && new Date(t.updated_at).getTime() >= thirtyDaysAgo.getTime(),
    ).length;
    const done = memberTasks.filter((t) => t.status === "done").length;
    const denominator = done + open;

    return {
      profileId: member.id,
      name: member.full_name,
      open,
      overdue,
      doneLast30,
      completionRate: denominator > 0 ? Math.round((done / denominator) * 100) : 0,
    };
  });

  const openCount =
    groups.overdue.length +
    groups.today.length +
    groups.week.length +
    groups.later.length +
    groups.no_date.length;

  return {
    status: "ready",
    groups,
    openCount,
    overdueCount: groups.overdue.length,
    members,
    leadOptions: leadsResult.data ?? [],
    propertyOptions: propertiesResult.data ?? [],
    productivity,
  };
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  taskType: TaskType;
  priority: TaskRow["priority"];
  dueAt?: string | null;
  assignedTo?: string | null;
  leadId?: string | null;
  propertyId?: string | null;
};

export type TaskMutationResult = { ok: true } | { ok: false; error: string };

export async function createTask(
  input: CreateTaskInput,
): Promise<TaskMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const title = input.title.trim();

  if (title.length < 2) {
    return { ok: false, error: "El título de la tarea es muy corto." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("tasks").insert({
    organization_id: organizationId,
    lead_id: input.leadId || null,
    property_id: input.propertyId || null,
    assigned_to: input.assignedTo || session.profile.id,
    created_by: session.profile.id,
    task_type: input.taskType,
    title,
    description: input.description?.trim() || null,
    priority: input.priority,
    status: "todo",
    due_at: input.dueAt || null,
    reminder_channels: ["in_app"],
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (input.leadId) {
    await supabase.from("lead_activities").insert({
      organization_id: organizationId,
      lead_id: input.leadId,
      actor_profile_id: session.profile.id,
      activity_type: "task",
      title: `Tarea creada: ${title}`,
    });
  }

  return { ok: true };
}

export async function setTaskStatus(input: {
  taskId: string;
  status: TaskRow["status"];
}): Promise<TaskMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: input.status })
    .eq("id", input.taskId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
