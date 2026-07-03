import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getSharedPropertyView } from "@/lib/domain/network";
import {
  formatPrice,
  OPERATION_LABELS,
  STATUS_LABELS,
} from "@/app/(app)/properties/labels";
import { PropertyGallery } from "@/app/(app)/properties/[id]/PropertyGallery";

export const dynamic = "force-dynamic";

export default async function SharedPropertyPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const view = await getSharedPropertyView(shareId);

  if (view.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (view.status === "not_found") {
    notFound();
  }

  if (view.status === "expired") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Compartida</span>
        <h1>Este acceso compartido expiró</h1>
        <p>Pide a la organización propietaria que vuelva a compartir la propiedad.</p>
      </div>
    );
  }

  const { property, permission, sharedByOrganization, media } = view;

  const specs = [
    { label: "Tipo", value: property.property_type },
    { label: "Operación", value: OPERATION_LABELS[property.operation] },
    { label: "Estado", value: STATUS_LABELS[property.status] },
    { label: "Precio", value: formatPrice(property.price, property.currency) },
    property.city ? { label: "Ciudad", value: property.city } : null,
    property.zone ? { label: "Zona", value: property.zone } : null,
    property.bedrooms !== null
      ? { label: "Dormitorios", value: String(property.bedrooms) }
      : null,
    property.bathrooms !== null
      ? { label: "Baños", value: String(property.bathrooms) }
      : null,
    property.area_sqm !== null
      ? { label: "Sup. construida", value: `${property.area_sqm} m²` }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`Compartida por ${sharedByOrganization}`}
        title={property.title}
        description={
          permission === "full"
            ? "Acceso completo, incluye datos del propietario."
            : "Los datos del propietario están protegidos por la organización que comparte."
        }
        actions={
          <Link className={styles.secondaryButton} href="/network">
            ← Red de agentes
          </Link>
        }
      />

      <div className={styles.leadsGrid}>
        <div className={styles.leadStack}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Galería</span>
                <h2>
                  {media.length} foto{media.length === 1 ? "" : "s"}
                </h2>
              </div>
            </div>
            {media.length > 0 ? (
              <PropertyGallery
                images={media.map((item) => ({
                  id: item.id,
                  src: item.url,
                  alt: item.alt,
                }))}
              />
            ) : (
              <p className={styles.mutedText}>Sin fotos.</p>
            )}
          </section>

          {property.description ? (
            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Descripción</span>
                  <h2>Sobre la propiedad</h2>
                </div>
              </div>
              <p className={styles.mutedText}>{property.description}</p>
            </section>
          ) : null}
        </div>

        <aside className={styles.detailRail}>
          <div className={styles.fieldList}>
            {specs.map((spec) => (
              <article className={styles.fieldRow} key={spec.label}>
                <strong>{spec.label}</strong>
                <span>{spec.value}</span>
              </article>
            ))}
          </div>

          {permission === "full" && property.owner_name ? (
            <div className={styles.ownerSection}>
              <span className={styles.eyebrow}>Propietario</span>
              <div className={styles.fieldList}>
                <article className={styles.fieldRow}>
                  <strong>Nombre</strong>
                  <span>{property.owner_name}</span>
                </article>
                {property.owner_phone ? (
                  <article className={styles.fieldRow}>
                    <strong>Teléfono</strong>
                    <span>{property.owner_phone}</span>
                  </article>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
