import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { LeadActivityRow } from "@/lib/database.types";
import { getLeadDetail } from "@/lib/domain/lead-detail";
import { NoteForm, StageForm } from "./LeadDetailForms";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<LeadActivityRow["activity_type"], string> = {
  note: "Nota",
  call: "Llamada",
  message: "Mensaje",
  email: "Email",
  stage_change: "Etapa",
  task: "Tarea",
  property: "Propiedad",
  document: "Documento",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBudget(min: number | null, max: number | null) {
  if (min === null && max === null) {
    return null;
  }

  const fmt = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

  if (min !== null && max !== null) {
    return `${fmt(min)} – ${fmt(max)}`;
  }

  return fmt((min ?? max) as number);
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getLeadDetail(id);

  if (detail.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (detail.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (detail.status === "profile_missing") {
    redirect("/onboarding");
  }

  if (detail.status === "not_found") {
    notFound();
  }

  const { lead, stages, currentStage, assignee, activities, thread, messages } =
    detail;
  const budget = formatBudget(lead.budget_min, lead.budget_max);

  const facts = [
    lead.phone ? { label: "Teléfono", value: lead.phone } : null,
    lead.email ? { label: "Email", value: lead.email } : null,
    lead.desired_zone ? { label: "Zona de interés", value: lead.desired_zone } : null,
    lead.desired_property_type
      ? { label: "Tipo de propiedad", value: lead.desired_property_type }
      : null,
    budget ? { label: "Presupuesto", value: budget } : null,
    assignee ? { label: "Asignado a", value: assignee.full_name } : null,
    { label: "Creado", value: formatDateTime(lead.created_at) },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`Prospecto · ${currentStage?.name ?? "Sin etapa"}`}
        title={lead.full_name}
        description={`Origen: ${lead.source}${
          lead.business_unit !== "general" ? ` · ${lead.business_unit}` : ""
        }`}
        actions={
          <Link className={styles.secondaryButton} href="/leads">
            ← Volver al embudo
          </Link>
        }
      />

      <div className={styles.leadsGrid}>
        <div className={styles.leadStack}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>WhatsApp</span>
                <h2>
                  {thread
                    ? `Conversación con ${thread.contact_name ?? thread.contact_phone}`
                    : "Sin conversación vinculada"}
                </h2>
              </div>
              {thread?.last_message_at ? (
                <span className={styles.pill}>
                  Último: {formatDateTime(thread.last_message_at)}
                </span>
              ) : null}
            </div>
            {messages.length > 0 ? (
              <div className={styles.chatList}>
                {messages.map((message) => {
                  const attachments = Array.isArray(message.media)
                    ? (message.media as Array<Record<string, unknown>>).filter(
                        (item) => typeof item.url === "string",
                      )
                    : [];

                  return (
                    <div
                      className={`${styles.chatBubble} ${
                        message.direction === "inbound"
                          ? styles.chatInbound
                          : styles.chatOutbound
                      }`}
                      key={message.id}
                    >
                      {attachments.map((item) =>
                        String(item.mime_type ?? "").startsWith("image/") ? (
                          <a
                            href={item.url as string}
                            target="_blank"
                            rel="noreferrer"
                            key={item.url as string}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- re-hosted whatsapp attachment */}
                            <img
                              src={item.url as string}
                              alt="Adjunto de WhatsApp"
                              className={styles.chatImage}
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          <a
                            href={item.url as string}
                            target="_blank"
                            rel="noreferrer"
                            key={item.url as string}
                            className={styles.chatAttachment}
                          >
                            📎 {String(item.filename ?? "Adjunto")}
                          </a>
                        ),
                      )}
                      <p>{message.body}</p>
                      <time>{formatDateTime(message.sent_at)}</time>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.mutedText}>
                Cuando este contacto escriba al WhatsApp del equipo, la
                conversación aparecerá aquí automáticamente.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Actividad</span>
                <h2>Línea de tiempo</h2>
              </div>
            </div>
            <div className={styles.fieldList}>
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <article className={styles.fieldRow} key={activity.id}>
                    <strong>
                      {ACTIVITY_LABELS[activity.activity_type]} · {activity.title}
                    </strong>
                    {activity.body ? <span>{activity.body}</span> : null}
                    <span>{formatDateTime(activity.created_at)}</span>
                  </article>
                ))
              ) : (
                <p className={styles.mutedText}>Sin actividad registrada.</p>
              )}
            </div>
          </section>
        </div>

        <aside className={styles.detailRail}>
          <div className={styles.detailHeader}>
            <span className={styles.avatarLarge}>
              {lead.full_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>{lead.full_name}</h2>
              <span className={styles.mutedText}>
                {currentStage?.name ?? "Sin etapa"}
              </span>
            </div>
          </div>

          <div className={styles.fieldList}>
            {facts.map((fact) => (
              <article className={styles.fieldRow} key={fact.label}>
                <strong>{fact.label}</strong>
                <span>{fact.value}</span>
              </article>
            ))}
          </div>

          <StageForm
            leadId={lead.id}
            stages={stages}
            currentStageId={lead.stage_id}
          />
          <NoteForm leadId={lead.id} />

          {lead.notes ? (
            <div className={styles.matchBox}>
              <span className={styles.eyebrow}>Notas iniciales</span>
              <p className={styles.mutedText}>{lead.notes}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
