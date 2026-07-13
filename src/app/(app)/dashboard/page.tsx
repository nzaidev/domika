import Link from "next/link";
import { redirect } from "next/navigation";
import { MetricGrid, PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getDashboardOverview } from "@/lib/domain/dashboard";
import { setTaskStatusAction } from "@/app/(app)/tasks/actions";

const TASK_TYPE_LABELS: Record<string, string> = {
  call: "Llamada",
  visit: "Visita",
  document: "Documento",
  follow_up: "Seguimiento",
  meeting: "Reunión",
  other: "Otra",
};
import {
  formatPrice,
  STATUS_LABELS,
} from "@/app/(app)/properties/labels";

export const dynamic = "force-dynamic";

function SetupState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.eyebrow}>Configuración del backend</span>
      <h1>Clerk o Supabase todavía no están configurados</h1>
      <p>
        Agrega los valores de `.env.example`, ejecuta la migración de identidad
        de Clerk y recarga esta ruta para verificar el módulo autenticado del App
        Router.
      </p>
      <div className={styles.codeList}>
        <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
        <code>CLERK_SECRET_KEY</code>
        <code>NEXT_PUBLIC_SUPABASE_URL</code>
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        <code>SUPABASE_SERVICE_ROLE_KEY</code>
      </div>
    </div>
  );
}

function AuthState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.eyebrow}>Inicio de sesión requerido</span>
      <h1>Inicia sesión para verificar el dashboard</h1>
      <p>
        El backend está configurado, pero esta solicitud no tiene una sesión
        activa de Clerk. Usa `/sign-in` o `/sign-up` y luego conecta el ID de
        usuario de Clerk con un perfil de Domika.
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  if (overview.status === "not_configured") {
    return <SetupState />;
  }

  if (overview.status === "unauthenticated") {
    return <AuthState />;
  }

  if (overview.status === "profile_missing") {
    redirect("/onboarding");
  }

  const metrics = [
    { label: "Prospectos", value: overview.counts.leads, tone: "green" },
    { label: "Propiedades", value: overview.counts.properties, tone: "blue" },
    {
      label: "Propiedades publicadas",
      value: overview.counts.publishedListings,
      tone: "mint",
    },
    { label: "Tareas abiertas", value: overview.counts.openTasks, tone: "amber" },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Resumen"
        title={`Hola, ${overview.profile.full_name}`}
        description="Centro de control para revisar prospectos, propiedades publicadas, tareas críticas y colaboración con agentes."
        actions={
          <>
            <Link className={styles.secondaryButton} href="/network">
              Compartir propiedad
            </Link>
            <Link className={styles.primaryButton} href="/leads">
              Capturar contacto
            </Link>
          </>
        }
      />

      <MetricGrid metrics={metrics} />

      <div className={styles.contentGrid}>
        <section className={styles.lifecycle}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Ciclo de vida del prospecto</span>
              <h2>Embudo por etapa</h2>
            </div>
            <Link className={styles.secondaryButton} href="/leads">
              Abrir embudo
            </Link>
          </div>
          <div className={styles.stageGrid}>
            {overview.stages.map((stage) => (
              <article className={styles.stage} key={stage.id}>
                <div className={styles.stageHead}>
                  <strong>{stage.name}</strong>
                  <span>{stage.count}</span>
                </div>
                <div className={styles.leadStack}>
                  {stage.leads.map((lead) => (
                    <Link
                      className={styles.leadCard}
                      href={`/leads/${lead.id}`}
                      key={lead.id}
                    >
                      <strong>{lead.name}</strong>
                      <small>{lead.subtitle}</small>
                    </Link>
                  ))}
                  {stage.count === 0 ? (
                    <p className={styles.mutedText}>Sin prospectos</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.leadStack}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Captura de contactos</span>
                <h2>Bandeja de WhatsApp</h2>
              </div>
            </div>
            {overview.inbox.length > 0 ? (
              <div className={styles.messageList}>
                {overview.inbox.map((thread) => (
                  <Link
                    className={styles.messageRow}
                    href={thread.leadId ? `/leads/${thread.leadId}` : "/leads"}
                    key={thread.id}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className={styles.avatar}>
                      {thread.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{thread.name}</strong>
                      <span>{thread.snippet.slice(0, 60)}</span>
                    </div>
                    <time className={styles.mutedText}>
                      {thread.time
                        ? new Date(thread.time).toLocaleDateString("es", {
                            day: "numeric",
                            month: "short",
                          })
                        : ""}
                    </time>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>
                Cuando lleguen mensajes de WhatsApp, aparecerán aquí.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Origen</span>
                <h2>Canales de captación</h2>
              </div>
            </div>
            {overview.leadSources.length > 0 ? (
              <div className={styles.channelList}>
                {overview.leadSources.slice(0, 4).map((source) => (
                  <article className={styles.channelRow} key={source.source}>
                    <strong>{source.label}</strong>
                    <span>
                      {source.count} prospecto{source.count === 1 ? "" : "s"}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>Sin prospectos todavía.</p>
            )}
          </section>
        </div>
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Inventario reciente</span>
              <h2>Propiedades listas para mover</h2>
            </div>
            <Link className={styles.secondaryButton} href="/properties">
              Ver todo
            </Link>
          </div>
          {overview.recentProperties.length > 0 ? (
            <section className={styles.propertyGrid} aria-label="Propiedades">
              {overview.recentProperties.map((property) => (
                <Link
                  className={styles.propertyCard}
                  href={`/properties/${property.id}`}
                  key={property.id}
                >
                  {property.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- storage assets are pre-normalized; skip the optimizer
                    <img
                      src={property.coverUrl}
                      alt={property.title}
                      className={styles.propertyImage}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.propertyImagePlaceholder}>
                      Sin fotos
                    </div>
                  )}
                  <div className={styles.propertyBody}>
                    <div className={styles.propertyTitleBlock}>
                      <strong>{property.title}</strong>
                      <span className={styles.propertyMeta}>
                        {[property.zone, property.city]
                          .filter(Boolean)
                          .join(", ") || property.property_type}
                      </span>
                    </div>
                    <div className={styles.propertyFooter}>
                      <strong>
                        {formatPrice(property.price, property.currency)}
                      </strong>
                      <span className={styles.pill}>
                        {STATUS_LABELS[property.status]}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          ) : (
            <p className={styles.mutedText}>
              Todavía no hay propiedades.{" "}
              <Link href="/properties/new">Crea la primera</Link>.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Tareas</span>
              <h2>Próximas acciones</h2>
            </div>
            <Link className={styles.secondaryButton} href="/tasks">
              Ver agenda
            </Link>
          </div>
          {overview.upcomingTasks.length > 0 ? (
            <div className={styles.taskList}>
              {overview.upcomingTasks.map((task) => (
                <article className={styles.taskRow} key={task.id}>
                  {/* Complete the task without leaving the dashboard. */}
                  <form action={setTaskStatusAction}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="status" value="done" />
                    <button
                      className={styles.taskCheck}
                      type="submit"
                      aria-label={`Marcar "${task.title}" como completada`}
                      title="Marcar como completada"
                    >
                      ○
                    </button>
                  </form>
                  <div className={styles.taskBody}>
                    <strong>{task.title}</strong>
                    <span
                      className={
                        task.overdue ? styles.taskOverdue : styles.mutedText
                      }
                    >
                      {[
                        TASK_TYPE_LABELS[task.taskType] ?? task.taskType,
                        task.dueAt
                          ? new Date(task.dueAt).toLocaleString("es", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Sin fecha",
                        task.overdue ? "vencida" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {task.leadId ? (
                      <span className={styles.taskLinks}>
                        <Link href={`/leads/${task.leadId}`}>
                          Ver prospecto
                        </Link>
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>
              Sin tareas pendientes. <Link href="/tasks">Crea una</Link>.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

