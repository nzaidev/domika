import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import { getPublicListingView } from "@/lib/domain/network";
import {
  formatPrice,
  OPERATION_LABELS,
} from "@/app/(app)/properties/labels";
import { PropertyGallery } from "@/app/(app)/properties/[id]/PropertyGallery";
import { InquiryForm } from "./InquiryForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await getPublicListingView(slug);

  if (view.status !== "ready") {
    return { title: "Propiedad no disponible — Domika" };
  }

  const description = [
    OPERATION_LABELS[view.property.operation],
    formatPrice(view.property.price, view.property.currency),
    [view.property.zone, view.property.city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${view.property.title} — ${view.organizationName}`,
    description,
    openGraph: {
      title: view.property.title,
      description,
      type: "website",
      images: view.media.slice(0, 1).map((item) => ({ url: item.url })),
    },
  };
}

export default async function PublicListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const view = await getPublicListingView(slug);

  if (view.status !== "ready") {
    notFound();
  }

  const { property, organizationName, media } = view;

  const specs = [
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
    property.parking_spaces !== null
      ? { label: "Parqueos", value: String(property.parking_spaces) }
      : null,
    property.area_sqm !== null
      ? { label: "Sup. construida", value: `${property.area_sqm} m²` }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const amenities = Array.isArray(property.amenities)
    ? (property.amenities as string[])
    : [];

  return (
    <div className={styles.publicShell}>
      <header className={styles.publicHeader}>
        <strong>{organizationName}</strong>
        <span className={styles.pill}>
          {OPERATION_LABELS[property.operation]}
        </span>
      </header>

      <main className={styles.publicMain}>
        <h1>{property.title}</h1>
        <p className={styles.publicPrice}>
          {formatPrice(property.price, property.currency)}
          <span className={styles.mutedText}>
            {" "}
            · {[property.zone, property.city].filter(Boolean).join(", ")}
          </span>
        </p>

        {media.length > 0 ? (
          <PropertyGallery
            images={media.map((item) => ({
              id: item.id,
              src: item.url,
              alt: item.alt,
            }))}
          />
        ) : null}

        {property.description ? (
          <section className={styles.panel}>
            <h2>Descripción</h2>
            <p className={styles.mutedText}>{property.description}</p>
          </section>
        ) : null}

        <section className={styles.panel}>
          <h2>Detalles</h2>
          <div className={styles.fieldList}>
            {specs.map((spec) => (
              <article className={styles.fieldRow} key={spec.label}>
                <strong>{spec.label}</strong>
                <span>{spec.value}</span>
              </article>
            ))}
          </div>
        </section>

        {amenities.length > 0 ? (
          <section className={styles.panel}>
            <h2>Amenidades</h2>
            <div className={styles.filters}>
              {amenities.map((amenity) => (
                <span className={styles.filterChip} key={amenity}>
                  {amenity}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.panel}>
          <h2>¿Te interesa esta propiedad?</h2>
          <InquiryForm slug={slug} organizationName={organizationName} />
        </section>
      </main>

      <footer className={styles.publicFooter}>
        Publicado por {organizationName} · Impulsado por Domika
      </footer>
    </div>
  );
}
