import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { RequirementWithMatches } from "@/lib/domain/matching";
import { getMatchingOverview } from "@/lib/domain/matching";
import { formatPrice } from "@/app/(app)/properties/labels";
import { deactivateRequirementAction } from "./actions";
import { RequirementForm } from "./RequirementForm";

export const dynamic = "force-dynamic";

const OPERATION_LABELS: Record<string, string> = {
  sale: "Compra",
  rent: "Alquiler",
  investment: "Inversión",
};

function criteriaSummary(requirement: RequirementWithMatches): string {
  const parts = [
    requirement.property_type,
    requirement.operation ? OPERATION_LABELS[requirement.operation] : null,
    requirement.budget_min !== null || requirement.budget_max !== null
      ? `$${requirement.budget_min?.toLocaleString("en-US") ?? "0"} – $${requirement.budget_max?.toLocaleString("en-US") ?? "∞"}`
      : null,
    [requirement.zone, requirement.city].filter(Boolean).join(", ") || null,
    requirement.bedrooms_min !== null
      ? `${requirement.bedrooms_min}+ dorm.`
      : null,
    requirement.area_min_sqm !== null
      ? `${requirement.area_min_sqm}+ m²`
      : null,
  ].filter(Boolean);

  return parts.join(" · ") || "Sin criterios";
}

export default async function MatchingPage() {
  const overview = await getMatchingOverview();

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

  const totalMatches = overview.requirements.reduce(
    (sum, requirement) => sum + requirement.matches.length,
    0,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Demanda"
        title="Coincidencias oferta–demanda"
        description="Registra lo que buscan tus clientes; el sistema cruza automáticamente contra tu inventario y la red Domika cuando entran propiedades nuevas."
        actions={
          <span className={styles.pill}>
            {totalMatches} coincidencia{totalMatches === 1 ? "" : "s"}
          </span>
        }
      />

      <div className={styles.leadsGrid}>
        <div className={styles.leadStack}>
          {overview.requirements.length > 0 ? (
            overview.requirements.map((requirement) => (
              <section className={styles.panel} key={requirement.id}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.eyebrow}>
                      {requirement.leadName
                        ? `Para ${requirement.leadName}`
                        : "Búsqueda independiente"}
                    </span>
                    <h2>{criteriaSummary(requirement)}</h2>
                  </div>
                  <form action={deactivateRequirementAction}>
                    <input
                      type="hidden"
                      name="requirementId"
                      value={requirement.id}
                    />
                    <button className={styles.ghostButton} type="submit">
                      Archivar
                    </button>
                  </form>
                </div>

                {requirement.notes ? (
                  <p className={styles.mutedText}>{requirement.notes}</p>
                ) : null}

                {requirement.matches.length > 0 ? (
                  <div className={styles.fieldList}>
                    {requirement.matches.map((match) => (
                      <article
                        className={styles.publicationRow}
                        key={match.matchId}
                      >
                        {match.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- storage assets pre-normalized
                          <img
                            src={match.coverUrl}
                            alt={match.title}
                            className={styles.photoThumb}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.photoThumb} />
                        )}
                        <div className={styles.photoMeta}>
                          <strong>
                            {match.isNetwork ? (
                              match.networkSlug ? (
                                <Link
                                  href={`/network/listing/${match.networkSlug}`}
                                >
                                  {match.title}
                                </Link>
                              ) : (
                                match.title
                              )
                            ) : (
                              <Link href={`/properties/${match.propertyId}`}>
                                {match.title}
                              </Link>
                            )}
                          </strong>
                          <span className={styles.mutedText}>
                            {[
                              formatPrice(match.price, match.currency),
                              [match.zone, match.city]
                                .filter(Boolean)
                                .join(", "),
                              match.isNetwork
                                ? `Red Domika · ${match.organizationName}`
                                : "Tu inventario",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className={styles.mutedText}>
                            {match.reasons.join(" · ")}
                          </span>
                        </div>
                        <span
                          className={`${styles.pill} ${
                            match.score >= 80 ? styles.pillStrong : ""
                          }`}
                        >
                          {match.score}%
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.mutedText}>
                    Sin coincidencias todavía — se recalcula al entrar
                    propiedades nuevas.
                  </p>
                )}
              </section>
            ))
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.eyebrow}>Demanda</span>
              <h1>Sin requerimientos activos</h1>
              <p>
                Registra lo que busca un cliente y el sistema vigilará el
                inventario propio y la red Domika por ti.
              </p>
            </div>
          )}
        </div>

        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Nuevo requerimiento</span>
              <h2>¿Qué busca tu cliente?</h2>
            </div>
          </div>
          <RequirementForm leadOptions={overview.leadOptions} />
        </aside>
      </div>
    </div>
  );
}
