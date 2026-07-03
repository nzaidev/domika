import { notFound } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import { getAdminOverview } from "@/lib/domain/admin";
import { updateOrganizationPlanAction } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es", { dateStyle: "medium" });
}

export default async function AdminPage() {
  const overview = await getAdminOverview();

  if (overview.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Supabase todavía no está configurado</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  // Hide the panel's existence from non-staff users.
  if (overview.status === "forbidden") {
    notFound();
  }

  return (
    <div className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <span className={styles.eyebrow}>Domika · Panel interno</span>
        <h1>Organizaciones ({overview.organizations.length})</h1>
        <p className={styles.mutedText}>
          Gestión de planes y límites por organización. Acceso restringido al
          equipo de OneUpAI vía SUPER_ADMIN_EMAILS.
        </p>
      </header>

      <div className={styles.fieldList}>
        {overview.organizations.map((organization) => (
          <article className={styles.adminOrgCard} key={organization.id}>
            <div>
              <h2>{organization.name}</h2>
              <p className={styles.mutedText}>
                /{organization.slug} · creada {formatDate(organization.created_at)}
              </p>
              <p className={styles.mutedText}>
                {organization.memberCount} usuario
                {organization.memberCount === 1 ? "" : "s"} ·{" "}
                {organization.leadCount} prospecto
                {organization.leadCount === 1 ? "" : "s"} ·{" "}
                {organization.propertyCount} propiedad
                {organization.propertyCount === 1 ? "" : "es"}
              </p>
            </div>

            <form
              className={styles.adminPlanForm}
              action={updateOrganizationPlanAction}
            >
              <input
                type="hidden"
                name="organizationId"
                value={organization.id}
              />
              <label className={styles.formField}>
                <span>Plan</span>
                <input
                  className={styles.textInput}
                  name="plan"
                  defaultValue={organization.plan}
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Máx. usuarios</span>
                <input
                  className={styles.textInput}
                  name="maxUsers"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={organization.max_users}
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Facturación</span>
                <select
                  className={styles.textInput}
                  name="billingStatus"
                  defaultValue={organization.billing_status}
                >
                  <option value="manual">Manual</option>
                  <option value="active">Activa</option>
                  <option value="past_due">Vencida</option>
                  <option value="suspended">Suspendida</option>
                </select>
              </label>
              <button className={styles.primaryButton} type="submit">
                Guardar
              </button>
            </form>
          </article>
        ))}

        {overview.organizations.length === 0 ? (
          <p className={styles.mutedText}>Sin organizaciones todavía.</p>
        ) : null}
      </div>
    </div>
  );
}
