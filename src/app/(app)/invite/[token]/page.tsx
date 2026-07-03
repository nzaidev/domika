import { redirect } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import { getInvitationPreview } from "@/lib/domain/invitations";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  owner: "propietario",
  admin: "administrador",
  agent: "agente",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);

  if (preview.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (preview.status === "already_member") {
    redirect("/dashboard");
  }

  if (preview.status === "invalid" || preview.status === "expired") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Invitación no disponible</span>
        <h1>
          {preview.status === "expired"
            ? "Esta invitación expiró"
            : "Esta invitación no existe o ya fue utilizada"}
        </h1>
        <p>
          Pide al administrador de tu organización que genere una nueva
          invitación desde Ajustes → Equipo.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.onboardingPanel}>
        <span className={styles.eyebrow}>Invitación a Domika</span>
        <h1>Únete a {preview.organizationName}</h1>
        <p className={styles.mutedText}>
          Fuiste invitado como {ROLE_LABELS[preview.role] ?? preview.role} con
          el email {preview.email}. Asegúrate de haber iniciado sesión con ese
          email antes de aceptar.
        </p>
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
