import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { mediaUrl } from "@/lib/media";
import { getPropertyDetail } from "@/lib/domain/properties";
import {
  getPropertyCollaboration,
  getShareDirectory,
} from "@/lib/domain/network";
import { getPropertyInterests } from "@/lib/domain/interests";
import {
  revokeShareAction,
  setNetworkPublicationAction,
} from "@/app/(app)/network/actions";
import { SharePanel } from "./SharePanel";
import { PublicLinkPanel } from "./PublicLinkPanel";
import {
  formatPrice,
  OPERATION_LABELS,
  propertyHref,
  STATUS_LABELS,
} from "../labels";
import { PropertyGallery } from "./PropertyGallery";
import { PropertyMap } from "./PropertyMap";
import { PropertyInterests } from "./PropertyInterests";
import { AvailabilityToggle } from "./AvailabilityToggle";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPropertyDetail(id);

  // Canonicalize: any legacy UUID link (tasks, network, notifications,
  // bookmarks) redirects to the clean slug URL.
  if (
    detail.status === "ready" &&
    detail.property.slug &&
    id !== detail.property.slug
  ) {
    redirect(propertyHref(detail.property));
  }

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
  const [collaboration, directory, propertyInterests, headerList] =
    await Promise.all([
      getPropertyCollaboration(property.id),
      getShareDirectory(),
      getPropertyInterests(property.id),
      headers(),
    ]);

  const host = headerList.get("host") ?? "domika.io";
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const publicUrl = collaboration.publicLinkSlug
    ? `${protocol}://${host}/p/${collaboration.publicLinkSlug}`
    : null;

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

  // Cover photo (served same-origin so the Instagram Web Share fetch isn't
  // blocked by cross-origin rules) + a caption line for social posts.
  const coverMedia = media.find((item) => item.is_cover) ?? media[0] ?? null;
  const shareImagePath = coverMedia
    ? `/api/media/${coverMedia.storage_path}`
    : null;
  const shareSubtitle = [
    formatPrice(property.price, property.currency),
    [property.zone, property.city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

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
            <AvailabilityToggle
              propertyId={property.id}
              active={property.active}
            />
            <Link className={styles.secondaryButton} href="/properties">
              ← Inventario
            </Link>
            <Link
              className={styles.secondaryButton}
              href={`/brochures?property=${property.id}`}
            >
              Generar folleto
            </Link>
            <Link
              className={styles.primaryButton}
              href={`${propertyHref(property)}/edit`}
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
              <PropertyGallery
                images={media.map((item) => ({
                  id: item.id,
                  src: mediaUrl(item.storage_path),
                  alt: item.alt_text ?? property.title,
                }))}
              />
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

          <PropertyMap
            address={property.address}
            latitude={property.latitude}
            longitude={property.longitude}
            mapUrl={property.map_url}
          />

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Compradores potenciales</span>
                <h2>Prospectos interesados</h2>
              </div>
            </div>
            <PropertyInterests
              propertyId={property.id}
              linked={propertyInterests.linked}
              options={propertyInterests.options}
            />
          </section>

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

          <section className={styles.panel}>
            <PublicLinkPanel
              propertyId={property.id}
              propertyTitle={property.title}
              propertySubtitle={shareSubtitle}
              shareImagePath={shareImagePath}
              active={collaboration.publicLinkActive}
              publicUrl={publicUrl}
            />
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Colaboración</span>
                <h2>Red de agentes</h2>
              </div>
              <form action={setNetworkPublicationAction}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input
                  type="hidden"
                  name="publish"
                  value={collaboration.isPublished ? "false" : "true"}
                />
                <button
                  className={
                    collaboration.isPublished
                      ? styles.secondaryButton
                      : styles.primaryButton
                  }
                  type="submit"
                >
                  {collaboration.isPublished
                    ? "Quitar de la red Domika"
                    : "Publicar en la red Domika"}
                </button>
              </form>
            </div>
            <p className={styles.mutedText}>
              {collaboration.isPublished
                ? "Visible para agentes de otras organizaciones (sin datos del propietario)."
                : "Publica esta propiedad para que agentes de otras organizaciones la vean, o compártela directamente abajo."}
            </p>

            <SharePanel propertyId={property.id} directory={directory} />

            {collaboration.shares.length > 0 ? (
              <div className={styles.fieldList}>
                {collaboration.shares.map((share) => (
                  <article className={styles.fieldRow} key={share.shareId}>
                    <strong>{share.recipientLabel}</strong>
                    <span>
                      {share.permission === "full"
                        ? "Completo"
                        : share.permission === "view"
                          ? "Ver ficha"
                          : "Ver sin propietario"}
                      {" · "}
                      {share.viewCount} vista{share.viewCount === 1 ? "" : "s"}
                      {share.expiresAt
                        ? ` · expira ${new Date(share.expiresAt).toLocaleDateString("es")}`
                        : ""}
                    </span>
                    <form action={revokeShareAction}>
                      <input type="hidden" name="shareId" value={share.shareId} />
                      <input
                        type="hidden"
                        name="propertyId"
                        value={property.id}
                      />
                      <button className={styles.ghostButton} type="submit">
                        Revocar
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
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
