import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getLeadsBoard } from "@/lib/domain/leads";
import { CreateLeadForm } from "./CreateLeadForm";
import { LeadsBoard } from "./LeadsBoard";

export const dynamic = "force-dynamic";

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
          <>
            <span className={styles.pill}>
              {board.totalLeads} prospecto{board.totalLeads === 1 ? "" : "s"}
            </span>
            <Link className={styles.secondaryButton} href="/leads/import">
              Importar contactos
            </Link>
          </>
        }
      />

      <div className={styles.leadsGrid}>
        <LeadsBoard stages={board.stages} />
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
