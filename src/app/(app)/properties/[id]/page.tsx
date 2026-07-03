import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getPropertyDetail } from "@/lib/domain/properties";
import {
  formatPrice,
  OPERATION_LABELS,
  STATUS_LABELS,
} from "../labels";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPropertyDetail(id);

  if (detail.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (detail.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (detail.status === "profile_missing") {
    redirect("/onboarding");
  }

  if (detail.status === "not_found") {
    notFound();
  }

  const { property, media } = detail;

  const specs = [
    { label: "Tipo", value: property.property_type },
    { label: "Operación", value: OPERATION_LABELS[property.operation] },
    { label: "Estado", value: STATUS_LABELS[property.status] },
    {
      label: "Precio",
      value: formatPrice(property.price, property.currency),
    },
    property.city ? { label: "Ciudad", value: property.city } : null,
    property.zone ? { label: "Zona", value: property.zone } : null,
    property.address ? { label: "Dirección", value: property.address } : null,
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
    property.lot_sqm !== null
      ? { label: "Sup. terreno", value: `${property.lot_sqm} m²` }
      : null,
    property.legal_status
      ? { label: "Situación legal", value: property.legal_status }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const amenities = Array.isArray(property.amenities)
    ? (property.amenities as string[])
    : [];

  const hasOwnerData = Boolean(
    property.owner_name ||
      property.owner_phone ||
      property.owner_email ||
      property.owner_notes,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`Propiedad · ${STATUS_LABELS[property.status]}`}
        title={property.title}
        description={
          [property.zone, property.city].filter(Boolean).join(", ") ||
          OPERATION_LABELS[property.operation]
        }
        actions={
          <>
            <Link className={styles.secondaryButton} href="/properties">
              ← Inventario
            </Link>
            <Link
              className={styles.primaryButton}
              href={`/properties/${property.id}/edit`}
            >
              Editar ficha
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
              <div className={styles.galleryGrid}>
                {media.map((item) =>
                  item.public_url ? (
                    <Image
                      key={item.id}
                      src={item.public_url}
                      alt={item.alt_text ?? property.title}
                      className={styles.galleryImage}
                      width={800}
                      height={450}
                      sizes="(max-width: 820px) 100vw, 45vw"
                    />
                  ) : null,
                )}
              </div>
            ) : (
              <p className={styles.mutedText}>
                Sin fotos todavía. Agrégalas desde “Editar ficha”.
              </p>
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

          {amenities.length > 0 ? (
            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Amenidades</span>
                  <h2>Incluye</h2>
                </div>
              </div>
              <div className={styles.filters}>
                {amenities.map((amenity) => (
                  <span className={styles.filterChip} key={amenity}>
                    {amenity}
                  </span>
                ))}
              </div>
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

          {property.video_url || property.virtual_tour_url ? (
            <div className={styles.fieldList}>
              {property.video_url ? (
                <a
                  className={styles.secondaryButton}
                  href={property.video_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver video
                </a>
              ) : null}
              {property.virtual_tour_url ? (
                <a
                  className={styles.secondaryButton}
                  href={property.virtual_tour_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tour virtual
                </a>
              ) : null}
            </div>
          ) : null}

          {hasOwnerData ? (
            <div className={styles.ownerSection}>
              <span className={styles.eyebrow}>
                Propietario · solo visible para tu organización
              </span>
              <div className={styles.fieldList}>
                {property.owner_name ? (
                  <article className={styles.fieldRow}>
                    <strong>Nombre</strong>
                    <span>{property.owner_name}</span>
                  </article>
                ) : null}
                {property.owner_phone ? (
                  <article className={styles.fieldRow}>
                    <strong>Teléfono</strong>
                    <span>{property.owner_phone}</span>
                  </article>
                ) : null}
                {property.owner_email ? (
                  <article className={styles.fieldRow}>
                    <strong>Email</strong>
                    <span>{property.owner_email}</span>
                  </article>
                ) : null}
                {property.owner_notes ? (
                  <article className={styles.fieldRow}>
                    <strong>Notas</strong>
                    <span>{property.owner_notes}</span>
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
