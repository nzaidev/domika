import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getContractsOverview } from "@/lib/domain/contracts";
import {
  contractStatusAction,
  deactivateTemplateAction,
} from "./actions";
import { ContractStudio } from "./ContractStudio";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  generated: "Generado",
  sent: "Enviado",
  signed: "Firmado",
  void: "Anulado",
};

const SIGNATURE_LABELS: Record<string, string> = {
  not_required: "Sin firma",
  pending: "Firma pendiente",
  signed: "Firmado",
  declined: "Rechazado",
  expired: "Expirado",
};

export default async function ContractsPage() {
  const overview = await getContractsOverview();

  if (overview.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (overview.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (overview.status === "profile_missing") {
    redirect("/onboarding");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Documentos"
        title="Contratos"
        description="Plantillas con variables, generación en PDF y seguimiento de firma. Los PDFs se guardan en almacenamiento privado."
        actions={
          <span className={styles.pill}>
            {overview.contracts.length} contrato
            {overview.contracts.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className={styles.leadsGrid}>
        <div className={styles.leadStack}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Biblioteca</span>
                <h2>Contratos generados</h2>
              </div>
            </div>
            {overview.contracts.length > 0 ? (
              <div className={styles.fieldList}>
                {overview.contracts.map((contract) => (
                  <article className={styles.fieldRow} key={contract.id}>
                    <strong>{contract.title}</strong>
                    <span className={styles.mutedText}>
                      {[
                        STATUS_LABELS[contract.status] ?? contract.status,
                        SIGNATURE_LABELS[contract.signature_status] ??
                          contract.signature_status,
                        contract.leadName,
                        contract.propertyTitle,
                        new Date(contract.created_at).toLocaleDateString("es"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <div className={styles.inviteRowActions}>
                      {contract.storage_path ? (
                        <a
                          className={styles.secondaryButton}
                          href={`/api/documents/${contract.storage_path}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir PDF
                        </a>
                      ) : null}
                      {contract.lead_id ? (
                        <Link
                          className={styles.ghostButton}
                          href={`/leads/${contract.lead_id}`}
                        >
                          Prospecto
                        </Link>
                      ) : null}
                      <form
                        action={contractStatusAction}
                        className={styles.inviteRowActions}
                      >
                        <input
                          type="hidden"
                          name="contractId"
                          value={contract.id}
                        />
                        <select
                          className={styles.textInput}
                          name="status"
                          defaultValue={contract.status}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          className={styles.textInput}
                          name="signatureStatus"
                          defaultValue={contract.signature_status}
                        >
                          {Object.entries(SIGNATURE_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                        <button
                          className={styles.ghostButton}
                          type="submit"
                        >
                          Actualizar
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>
                Genera el primer contrato desde el panel derecho.
              </p>
            )}
          </section>

          {overview.templates.length > 0 ? (
            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Plantillas</span>
                  <h2>Activas</h2>
                </div>
              </div>
              <div className={styles.fieldList}>
                {overview.templates.map((template) => (
                  <article className={styles.fieldRow} key={template.id}>
                    <strong>
                      {template.name}{" "}
                      <span className={styles.pill}>{template.contract_type}</span>
                    </strong>
                    <span className={styles.mutedText}>
                      {template.body.slice(0, 120)}…
                    </span>
                    <form action={deactivateTemplateAction}>
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <button className={styles.ghostButton} type="submit">
                        Desactivar
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Generador</span>
              <h2>Nuevo contrato</h2>
            </div>
          </div>
          <ContractStudio
            templates={overview.templates}
            leadOptions={overview.leadOptions}
            propertyOptions={overview.propertyOptions}
          />
        </aside>
      </div>
    </div>
  );
}
