import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getNetworkListingView } from "@/lib/domain/network";
import {
  formatPrice,
  OPERATION_LABELS,
} from "@/app/(app)/properties/labels";
import { PropertyGallery } from "@/app/(app)/properties/[id]/PropertyGallery";

export const dynamic = "force-dynamic";

export default async function NetworkListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const view = await getNetworkListingView(slug);

  if (view.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (view.status === "not_found") {
    notFound();
  }

  const { property, organizationName, media, viewCount } = view;

  const specs = [
    { label: "Organización", value: organizationName },
    { label: "Tipo", value: property.property_type },
    { label: "Operación", value: OPERATION_LABELS[property.operation] },
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
        eyebrow={`Red Domika · ${organizationName}`}
        title={property.title}
        description="Publicación de la red de agentes. Los datos del propietario no se comparten."
        actions={
          <>
            <span className={styles.pill}>
              {viewCount} vista{viewCount === 1 ? "" : "s"}
            </span>
            <Link className={styles.secondaryButton} href="/network">
              ← Red de agentes
            </Link>
          </>
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
        </aside>
      </div>
    </div>
  );
}
