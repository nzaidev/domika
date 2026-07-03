import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getSessionProfile } from "@/lib/auth/session";
import { PropertyForm } from "../PropertyForm";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
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
        eyebrow="Propiedades"
        title="Nueva propiedad"
        description="Registra la ficha completa. Las fotos se agregan después de crearla."
        actions={
          <Link className={styles.secondaryButton} href="/properties">
            ← Volver al inventario
          </Link>
        }
      />
      <section className={styles.panel}>
        <PropertyForm />
      </section>
    </div>
  );
}
