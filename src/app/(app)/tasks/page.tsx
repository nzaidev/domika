import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { TaskType } from "@/lib/database.types";
import {
  getTasksOverview,
  type TaskGroupKey,
  type TaskWithLinks,
} from "@/lib/domain/tasks";
import { setTaskStatusAction } from "./actions";
import { NewTaskForm } from "./NewTaskForm";

export const dynamic = "force-dynamic";

const GROUP_TITLES: Array<{ key: TaskGroupKey; title: string }> = [
  { key: "overdue", title: "Vencidas" },
  { key: "today", title: "Hoy" },
  { key: "week", title: "Esta semana" },
  { key: "later", title: "Más adelante" },
  { key: "no_date", title: "Sin fecha" },
  { key: "done", title: "Completadas (últimas 30)" },
];

const TYPE_LABELS: Record<TaskType, string> = {
  call: "Llamada",
  visit: "Visita",
  document: "Documento",
  follow_up: "Seguimiento",
  meeting: "Reunión",
  other: "Otra",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function formatDue(value: string | null) {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TaskItem({ task }: { task: TaskWithLinks }) {
  const isOpen = task.status === "todo" || task.status === "in_progress";
  const due = formatDue(task.due_at);

  return (
    <article className={styles.taskRow}>
      <form action={setTaskStatusAction}>
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="status" value={isOpen ? "done" : "todo"} />
        <button
          className={styles.taskCheck}
          type="submit"
          aria-label={isOpen ? "Marcar como completada" : "Reabrir tarea"}
          title={isOpen ? "Marcar como completada" : "Reabrir tarea"}
        >
          {isOpen ? "○" : "✓"}
        </button>
      </form>
      <div className={styles.taskBody}>
        <strong className={isOpen ? undefined : styles.taskDone}>
          {task.title}
          {task.auto_generated ? (
            <span className={styles.pill}> auto</span>
          ) : null}
        </strong>
        <span className={styles.mutedText}>
          {[
            TYPE_LABELS[task.task_type],
            PRIORITY_LABELS[task.priority],
            task.assigneeName,
            due,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {(task.leadName && task.lead_id) ||
        (task.propertyTitle && task.property_id) ? (
          <span className={styles.taskLinks}>
            {task.leadName && task.lead_id ? (
              <Link href={`/leads/${task.lead_id}`}>👤 {task.leadName}</Link>
            ) : null}
            {task.propertyTitle && task.property_id ? (
              <Link href={`/properties/${task.property_id}`}>
                🏠 {task.propertyTitle}
              </Link>
            ) : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const assignee = firstParam(params.assignee);
  const type = firstParam(params.type);

  const overview = await getTasksOverview({
    assignedTo: assignee || undefined,
    taskType: (Object.keys(TYPE_LABELS).includes(type)
      ? type
      : undefined) as TaskType | undefined,
  });

  if (overview.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (overview.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (overview.status === "profile_missing") {
    redirect("/onboarding");
  }

  const hasFilters = Boolean(assignee || type);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Tareas"
        title="Agenda y seguimiento del equipo"
        description="Tareas vinculadas a prospectos y propiedades, recordatorios y reglas automáticas."
        actions={
          <>
            <span className={styles.pill}>
              {overview.openCount} abierta{overview.openCount === 1 ? "" : "s"}
            </span>
            {overview.overdueCount > 0 ? (
              <span className={`${styles.pill} ${styles.pillAlert}`}>
                {overview.overdueCount} vencida
                {overview.overdueCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </>
        }
      />

      <form className={styles.filterBar} method="get" action="/tasks">
        <select
          className={styles.textInput}
          name="assignee"
          defaultValue={assignee}
        >
          <option value="">Responsable: todos</option>
          {overview.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
        <select className={styles.textInput} name="type" defaultValue={type}>
          <option value="">Tipo: todos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className={styles.secondaryButton} type="submit">
          Filtrar
        </button>
        {hasFilters ? (
          <Link className={styles.ghostButton} href="/tasks">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className={styles.leadsGrid}>
        <div className={styles.leadStack}>
          {GROUP_TITLES.map(({ key, title }) => {
            const tasks = overview.groups[key];
            if (tasks.length === 0) {
              return null;
            }
            return (
              <section className={styles.panel} key={key}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.eyebrow}>{title}</span>
                    <h2>
                      {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
                    </h2>
                  </div>
                </div>
                <div className={styles.fieldList}>
                  {tasks.map((task) => (
                    <TaskItem task={task} key={task.id} />
                  ))}
                </div>
              </section>
            );
          })}

          {overview.openCount === 0 && overview.groups.done.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.eyebrow}>Agenda</span>
              <h1>Sin tareas todavía</h1>
              <p>
                Crea la primera tarea, o mueve un prospecto de etapa para que
                las reglas automáticas generen seguimientos.
              </p>
            </div>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Equipo</span>
                <h2>Productividad</h2>
              </div>
            </div>
            <div className={styles.fieldList}>
              {overview.productivity.map((agent) => (
                <article className={styles.fieldRow} key={agent.profileId}>
                  <strong>{agent.name}</strong>
                  <span>
                    {agent.open} abiertas · {agent.overdue} vencidas ·{" "}
                    {agent.doneLast30} completadas (30d) ·{" "}
                    {agent.completionRate}% completado
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Nueva tarea</span>
              <h2>Agendar acción</h2>
            </div>
          </div>
          <NewTaskForm
            members={overview.members}
            leadOptions={overview.leadOptions}
            propertyOptions={overview.propertyOptions}
            defaultAssignee={overview.members[0]?.id ?? ""}
          />
        </aside>
      </div>
    </div>
  );
}
