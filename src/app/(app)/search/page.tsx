import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getLeadsBoard } from "@/lib/domain/leads";
import { listProperties } from "@/lib/domain/properties";
import { formatPrice, STATUS_LABELS } from "@/app/(app)/properties/labels";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q).trim();

  const [board, properties] = await Promise.all([
    q ? getLeadsBoard({ q }) : Promise.resolve(null),
    q ? listProperties({ q }) : Promise.resolve(null),
  ]);

  if (board?.status === "unauthenticated" || properties?.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (board?.status === "profile_missing" || properties?.status === "profile_missing") {
    redirect("/onboarding");
  }

  const leads =
    board?.status === "ready"
      ? board.stages.flatMap((stage) =>
          stage.leads.map((lead) => ({ ...lead, stageName: stage.name })),
        )
      : [];
  const foundProperties =
    properties?.status === "ready" ? properties.properties : [];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Búsqueda"
        title={q ? `Resultados para “${q}”` : "Buscar"}
        description="Busca en prospectos (nombre, teléfono, email) y propiedades (título, ciudad, zona, dirección)."
      />

      <form className={styles.filterBar} method="get" action="/search">
        <input
          className={styles.textInput}
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Ej. Patricia, +59170011122, Equipetrol…"
          autoFocus
        />
        <button className={styles.primaryButton} type="submit">
          Buscar
        </button>
      </form>

      {q ? (
        <div className={styles.splitGrid}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Prospectos</span>
                <h2>
                  {leads.length} resultado{leads.length === 1 ? "" : "s"}
                </h2>
              </div>
            </div>
            {leads.length > 0 ? (
              <div className={styles.fieldList}>
                {leads.map((lead) => (
                  <Link
                    className={styles.fieldRow}
                    href={`/leads/${lead.id}`}
                    key={lead.id}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <strong>{lead.full_name}</strong>
                    <span>
                      {[lead.stageName, lead.phone, lead.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>Sin prospectos que coincidan.</p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Propiedades</span>
                <h2>
                  {foundProperties.length} resultado
                  {foundProperties.length === 1 ? "" : "s"}
                </h2>
              </div>
            </div>
            {foundProperties.length > 0 ? (
              <div className={styles.fieldList}>
                {foundProperties.map((property) => (
                  <Link
                    className={styles.fieldRow}
                    href={`/properties/${property.id}`}
                    key={property.id}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <strong>{property.title}</strong>
                    <span>
                      {[
                        STATUS_LABELS[property.status],
                        [property.zone, property.city].filter(Boolean).join(", "),
                        formatPrice(property.price, property.currency),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>Sin propiedades que coincidan.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
