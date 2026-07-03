import { redirect } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import { getSessionProfile } from "@/lib/auth/session";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>
          Agrega los valores de `.env.example` y recarga esta ruta para
          completar el onboarding.
        </p>
      </div>
    );
  }

  if (session.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (session.status === "authenticated") {
    redirect("/dashboard");
  }

  return (
    <div className={styles.page}>
      <div className={styles.onboardingPanel}>
        <span className={styles.eyebrow}>Bienvenido a Domika</span>
        <h1>Crea tu espacio de trabajo</h1>
        <p className={styles.mutedText}>
          Tu cuenta {session.user.email ?? ""} está lista. Crea la organización
          de tu equipo: serás el propietario, y el embudo de ventas se
          configurará automáticamente con las etapas estándar (Nuevo →
          Contactado → Visitó → Negociación → Cierre).
        </p>
        <OnboardingForm defaultFullName={session.user.fullName} />
      </div>
    </div>
  );
}
