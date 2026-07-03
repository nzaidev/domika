import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getSessionProfile } from "@/lib/auth/session";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";

export default async function LeadsImportPage() {
  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (session.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (session.status === "profile_missing") {
    redirect("/onboarding");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Prospectos"
        title="Importar contactos desde CSV"
        description="Sube tu lista, mapea las columnas y revisa los duplicados antes de importar. Exporta tu Excel como CSV para usarlo aquí."
        actions={
          <Link className={styles.secondaryButton} href="/leads">
            ← Volver al embudo
          </Link>
        }
      />

      <section className={styles.panel}>
        <ImportWizard />
      </section>
    </div>
  );
}
