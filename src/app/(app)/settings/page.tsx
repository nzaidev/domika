import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { AppRole } from "@/lib/database.types";
import { getTeamOverview } from "@/lib/domain/invitations";
import { getPipelineStages } from "@/lib/domain/pipeline";
import { revokeInvitationAction } from "./actions";
import { CopyInviteLinkButton } from "./CopyInviteLinkButton";
import { InviteForm } from "./InviteForm";
import { PipelineEditor } from "./PipelineEditor";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  agent: "Agente",
};

const integrations = [
  {
    title: "WhatsApp Business",
    description: "Captura automática de contactos, mensajes y origen de campaña.",
    status: "Pendiente",
  },
  {
    title: "Clerk",
    description: "Autenticación, sesiones y perfiles conectados por ID de usuario.",
    status: "Activo",
  },
  {
    title: "Supabase",
    description: "Base de datos, almacenamiento y consultas por organización.",
    status: "Activo",
  },
  {
    title: "Portales inmobiliarios",
    description: "Feeds de publicación y sincronización de inventario.",
    status: "Próximo",
  },
];

export default async function SettingsPage() {
  const team = await getTeamOverview();

  if (team.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>
          Agrega los valores de `.env.example` y recarga esta ruta para
          administrar el equipo.
        </p>
      </div>
    );
  }

  if (team.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (team.status === "profile_missing") {
    redirect("/onboarding");
  }

  const canManageTeam = team.profile.role !== "agent";
  const stages = await getPipelineStages();

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Ajustes"
        title={`Configuración de ${team.organizationName}`}
        description="Administra el equipo, integraciones, fuentes de prospectos y reglas operativas del CRM."
        actions={
          <span className={styles.pill}>
            {team.members.length} / {team.maxUsers} usuarios
          </span>
        }
      />

      <div className={styles.splitGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Equipo</span>
              <h2>Miembros de la organización</h2>
            </div>
          </div>
          <div className={styles.fieldList}>
            {team.members.map((member) => (
              <article className={styles.fieldRow} key={member.id}>
                <strong>{member.full_name}</strong>
                <span>
                  {ROLE_LABELS[member.role]}
                  {member.phone ? ` · ${member.phone}` : ""}
                </span>
              </article>
            ))}
          </div>

          {team.pendingInvitations.length > 0 ? (
            <>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Pendientes</span>
                  <h2>Invitaciones enviadas</h2>
                </div>
              </div>
              <div className={styles.fieldList}>
                {team.pendingInvitations.map((invitation) => (
                  <article className={styles.fieldRow} key={invitation.id}>
                    <strong>{invitation.email}</strong>
                    <span>
                      {ROLE_LABELS[invitation.role]} · expira{" "}
                      {new Date(invitation.expires_at).toLocaleDateString("es")}
                    </span>
                    {canManageTeam ? (
                      <div className={styles.inviteRowActions}>
                        <CopyInviteLinkButton token={invitation.token} />
                        <form action={revokeInvitationAction}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={invitation.id}
                          />
                          <button
                            className={styles.ghostButton}
                            type="submit"
                          >
                            Revocar
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Invitar</span>
              <h2>Agregar un agente al equipo</h2>
            </div>
          </div>
          {canManageTeam ? (
            <InviteForm canInviteOwners={team.profile.role === "owner"} />
          ) : (
            <p className={styles.mutedText}>
              Solo propietarios y administradores pueden invitar nuevos
              miembros.
            </p>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Embudo de ventas</span>
            <h2>Etapas del pipeline</h2>
          </div>
        </div>
        {canManageTeam ? (
          <PipelineEditor stages={stages} />
        ) : (
          <div className={styles.fieldList}>
            {stages.map((stage) => (
              <article className={styles.fieldRow} key={stage.id}>
                <strong>{stage.name}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.threeGrid}>
        {integrations.map((setting) => (
          <article className={styles.panel} key={setting.title}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>{setting.status}</span>
                <h2>{setting.title}</h2>
              </div>
            </div>
            <p className={styles.mutedText}>{setting.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
