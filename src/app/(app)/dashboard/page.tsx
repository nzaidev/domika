import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import {
  BuildingIcon,
  MegaphoneIcon,
  TaskIcon,
  UsersIcon,
} from "@/components/domika/icons";
import { getDashboardOverview } from "@/lib/domain/dashboard";
import { setTaskStatusAction } from "@/app/(app)/tasks/actions";
import {
  formatPrice,
  propertyHref,
  STATUS_LABELS,
} from "@/app/(app)/properties/labels";
import { PipelineCard, type PipelineStage } from "./PipelineCard";

export const dynamic = "force-dynamic";

const TASK_TYPE_LABELS: Record<string, string> = {
  call: "Llamada",
  visit: "Visita",
  document: "Documento",
  follow_up: "Seguimiento",
  meeting: "Reunión",
  other: "Otra",
};

// Green-family palette for the capture-channel donut (charts may use green;
// stage colors stay reserved for status).
const DONUT_PALETTE = [
  "#0e9f6e",
  "#31be93",
  "#0c3a32",
  "#8fd7bf",
  "#5f6f69",
  "#b4beb8",
];

// Availability-style badge for the featured properties.
function statusBadgeClass(status: string): string {
  if (status === "available") {
    return `${styles.statusBadge} ${styles.badgeDisponible}`;
  }
  return `${styles.statusBadge} ${styles.badgeBorrador}`;
}

function Donut({
  segments,
  total,
}: {
  segments: Array<{ key: string; color: string; value: number }>;
  total: number;
}) {
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const seg = (value: number) => (total > 0 ? (value / total) * c : 0);
  // Precompute each arc's length + cumulative offset without mutation.
  const arcs = segments.map((s, i) => ({
    key: s.key,
    color: s.color,
    len: seg(s.value),
    offset: segments.slice(0, i).reduce((sum, p) => sum + seg(p.value), 0),
  }));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Distribución de canales de captación"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--app-soft-2)"
        strokeWidth={stroke}
      />
      {arcs.map((a) => (
        <circle
          key={a.key}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={a.color}
          strokeWidth={stroke}
          strokeDasharray={`${a.len} ${c - a.len}`}
          strokeDashoffset={-a.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        fontSize="28"
        fontWeight="800"
        fill="var(--app-ink)"
        fontFamily="var(--font-display)"
      >
        {total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.08em"
        fill="var(--app-muted)"
      >
        PROSPECTOS
      </text>
    </svg>
  );
}

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

  const firstName = overview.profile.full_name.split(" ")[0] || "Agente";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const kpis = [
    {
      label: "Prospectos",
      value: overview.counts.leads,
      href: "/leads",
      link: "Ver prospectos",
      Icon: UsersIcon,
    },
    {
      label: "Propiedades",
      value: overview.counts.properties,
      href: "/properties",
      link: "Ver propiedades",
      Icon: BuildingIcon,
    },
    {
      label: "Propiedades publicadas",
      value: overview.counts.publishedListings,
      href: "/listings",
      link: "Ver publicaciones",
      Icon: MegaphoneIcon,
    },
    {
      label: "Tareas abiertas",
      value: overview.counts.openTasks,
      href: "/tasks",
      link: "Ver tareas",
      Icon: TaskIcon,
    },
  ];

  const pipelineStages: PipelineStage[] = overview.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    count: stage.count,
    value: stage.value,
    firstLead: stage.leads[0]?.name ?? null,
  }));

  const totalProspects = overview.leadSources.reduce(
    (sum, s) => sum + s.count,
    0,
  );
  const donutSegments = overview.leadSources.map((source, i) => ({
    key: source.source,
    color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    value: source.count,
    label: source.label,
    pct: totalProspects > 0 ? Math.round((source.count / totalProspects) * 100) : 0,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.dashHead}>
        <div>
          <h1 className={styles.dashTitle}>Escritorio</h1>
          <p className={styles.dashSubtitle}>
            Resumen de prospectos, inventario y tareas de tu operación.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <Link className={styles.kpiCard} href={kpi.href} key={kpi.label}>
            <span className={styles.kpiTile}>
              <kpi.Icon />
            </span>
            <span className={styles.kpiBody}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <span className={styles.kpiValue}>{kpi.value}</span>
              <span className={styles.kpiLink}>{kpi.link} →</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Hero + pipeline */}
      <div className={styles.dashHeroRow}>
        <section className={styles.hero}>
          <div>
            <div className={styles.heroEyebrow}>{greeting},</div>
            <h2 className={styles.heroName}>{firstName} 👋</h2>
            <p className={styles.heroPhrase}>
              Cada conversación es una oportunidad. Hoy es un gran día para hacer
              seguimiento y cerrar. 🔥
            </p>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatLabel}>Prospectos</div>
              <div className={styles.heroStatValue}>{overview.counts.leads}</div>
              <div className={styles.heroStatNote}>en el pipeline</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatLabel}>Inventario</div>
              <div className={styles.heroStatValue}>
                {formatPrice(overview.inventory.value, overview.inventory.currency)}
              </div>
              <div className={styles.heroStatNote}>
                {overview.inventory.count} propiedad
                {overview.inventory.count === 1 ? "" : "es"}
              </div>
            </div>
          </div>
        </section>

        <PipelineCard
          stages={pipelineStages}
          currency={overview.inventory.currency}
          inventoryValue={overview.inventory.value}
        />
      </div>

      {/* Bottom row: channels · tasks · featured */}
      <div className={styles.dashBottomGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Origen</span>
              <h2>Canales de captación</h2>
            </div>
          </div>
          {totalProspects > 0 ? (
            <div className={styles.donutRow}>
              <Donut segments={donutSegments} total={totalProspects} />
              <div className={styles.donutLegend}>
                {donutSegments.map((s) => (
                  <div className={styles.donutLegendItem} key={s.key}>
                    <span
                      className={styles.donutDot}
                      style={{ background: s.color }}
                    />
                    <span>{s.label}</span>
                    <strong>{s.pct}%</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.dashEmpty}>
              <span className={styles.dashEmptyIcon}>
                <UsersIcon />
              </span>
              <strong>Aún no hay prospectos</strong>
              <p className={styles.mutedText}>
                Captura tu primer contacto para ver los canales aquí.
              </p>
              <Link className={styles.primaryButton} href="/leads">
                Capturar prospecto
              </Link>
            </div>
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
                        <Link href={`/leads/${task.leadId}`}>Ver prospecto</Link>
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.dashEmpty}>
              <span className={styles.dashEmptyIcon}>
                <TaskIcon />
              </span>
              <strong>Todo al día</strong>
              <p className={styles.mutedText}>
                No tienes tareas pendientes. Crea una para no perder seguimiento.
              </p>
              <Link className={styles.primaryButton} href="/tasks">
                Crear tarea
              </Link>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Inventario</span>
              <h2>Propiedades listas para mover</h2>
            </div>
            <Link className={styles.secondaryButton} href="/properties">
              Ver todo
            </Link>
          </div>
          {overview.recentProperties.length > 0 ? (
            <div className={styles.leadStack}>
              {overview.recentProperties.map((property) => (
                <Link
                  className={styles.featuredCard}
                  href={propertyHref(property)}
                  key={property.id}
                >
                  {property.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- storage assets are pre-normalized; skip the optimizer
                    <img
                      src={property.coverUrl}
                      alt={property.title}
                      className={styles.featuredImg}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.featuredImgPlaceholder}>Sin fotos</div>
                  )}
                  <div className={styles.featuredBody}>
                    <strong>{property.title}</strong>
                    <span className={styles.propertyMeta}>
                      {[property.zone, property.city]
                        .filter(Boolean)
                        .join(", ") || property.property_type}
                    </span>
                    <div className={styles.featuredFooter}>
                      <span className={styles.featuredPrice}>
                        {formatPrice(property.price, property.currency)}
                      </span>
                      <span className={statusBadgeClass(property.status)}>
                        {STATUS_LABELS[property.status]}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.dashEmpty}>
              <span className={styles.dashEmptyIcon}>
                <BuildingIcon />
              </span>
              <strong>Todavía no hay propiedades</strong>
              <p className={styles.mutedText}>
                Crea tu primera propiedad para empezar a moverla.
              </p>
              <Link className={styles.primaryButton} href="/properties/new">
                Nueva propiedad
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
