import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { LeadRow } from "@/lib/database.types";
import { getLeadsBoard, type LeadsBoardStage } from "@/lib/domain/leads";
import { CreateLeadForm } from "./CreateLeadForm";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<LeadRow["source"], string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  portal: "Portal",
  referral: "Referido",
  listing: "Publicación",
  other: "Otro",
};

function leadSubtitle(lead: LeadRow) {
  const parts = [SOURCE_LABELS[lead.source]];
  if (lead.desired_zone) {
    parts.push(lead.desired_zone);
  }
  if (lead.phone) {
    parts.push(lead.phone);
  }
  return parts.join(" · ");
}

function StageBoard({ stages }: { stages: LeadsBoardStage[] }) {
  return (
    <section className={styles.lifecycle}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Ciclo de vida del prospecto</span>
          <h2>Del contacto de WhatsApp al cierre</h2>
        </div>
        <span className={styles.pill}>Embudo activo</span>
      </div>
      <div className={styles.stageGrid}>
        {stages.map((stage) => (
          <article className={styles.stage} key={stage.id}>
            <div className={styles.stageHead}>
              <strong>{stage.name}</strong>
              <span>{stage.leads.length}</span>
            </div>
            <div className={styles.leadStack}>
              {stage.leads.map((lead) => (
                <Link
                  className={styles.leadCard}
                  href={`/leads/${lead.id}`}
                  key={lead.id}
                >
                  <strong>{lead.full_name}</strong>
                  <small>{leadSubtitle(lead)}</small>
                </Link>
              ))}
              {stage.leads.length === 0 ? (
                <p className={styles.mutedText}>Sin prospectos</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function LeadsPage() {
  const board = await getLeadsBoard();

  if (board.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>
          Agrega los valores de `.env.example` y recarga esta ruta para ver el
          embudo de prospectos con datos reales.
        </p>
      </div>
    );
  }

  if (board.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (board.status === "profile_missing") {
    redirect("/onboarding");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Prospectos"
        title="Embudo de prospectos con contactos en vivo"
        description="Gestiona cada contacto desde su entrada por WhatsApp hasta la visita, oferta y cierre."
        actions={
          <span className={styles.pill}>
            {board.totalLeads} prospecto{board.totalLeads === 1 ? "" : "s"}
          </span>
        }
      />

      <div className={styles.leadsGrid}>
        <StageBoard stages={board.stages} />
        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Captura manual</span>
              <h2>Nuevo prospecto</h2>
            </div>
          </div>
          <CreateLeadForm />
        </aside>
      </div>
    </div>
  );
}
