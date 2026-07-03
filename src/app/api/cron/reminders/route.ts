import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Task-reminder job (§12 decision: Vercel Cron + route handlers).
// Runs every 15 minutes (vercel.json): finds open tasks due within the next
// hour (or overdue) whose reminder hasn't been sent, and creates an in-app
// notification for the assignee. Email/WhatsApp channels attach in Phase 3.

const LOOKAHEAD_MINUTES = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return Response.json({ error: "CRON_SECRET no configurado." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!hasSupabaseServerConfig()) {
    return Response.json({ error: "Supabase no configurado." }, { status: 503 });
  }

  const supabase = createAdminSupabaseClient();
  const horizon = new Date(
    Date.now() + LOOKAHEAD_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: dueTasks, error } = await supabase
    .from("tasks")
    .select("*")
    .in("status", ["todo", "in_progress"])
    .not("due_at", "is", null)
    .lte("due_at", horizon)
    .is("metadata->>reminder_sent_at", null)
    .not("assigned_to", "is", null)
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;

  for (const task of dueTasks ?? []) {
    const dueAt = new Date(task.due_at as string);
    const overdue = dueAt.getTime() < Date.now();

    const { error: notifyError } = await supabase.from("notifications").insert({
      organization_id: task.organization_id,
      profile_id: task.assigned_to,
      title: overdue ? `Tarea vencida: ${task.title}` : `Tarea próxima: ${task.title}`,
      body: `Vence ${dueAt.toLocaleString("es", {
        dateStyle: "medium",
        timeStyle: "short",
      })}.`,
      metadata: { task_id: task.id, kind: "task_reminder" },
    });

    if (notifyError) {
      continue;
    }

    const metadata =
      task.metadata && typeof task.metadata === "object"
        ? (task.metadata as Record<string, unknown>)
        : {};

    await supabase
      .from("tasks")
      .update({
        metadata: { ...metadata, reminder_sent_at: new Date().toISOString() },
      })
      .eq("id", task.id);

    notified += 1;
  }

  return Response.json({ ok: true, checked: dueTasks?.length ?? 0, notified });
}
