import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getNetworkOverview } from "@/lib/domain/network";
import { formatPrice } from "@/app/(app)/properties/labels";
import { revokeShareAction } from "./actions";

export const dynamic = "force-dynamic";

const PERMISSION_LABELS: Record<string, string> = {
  view: "Ver ficha",
  view_without_owner: "Ver sin propietario",
  full: "Completo",
};

export default async function NetworkPage() {
  const overview = await getNetworkOverview();

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
        eyebrow="Red de agentes"
        title="Colaboración entre organizaciones"
        description="Propiedades publicadas en la red Domika y compartidas contigo. Los datos del propietario nunca salen de su organización."
        actions={
          <span className={styles.pill}>
            {overview.networkListings.length} en la red
          </span>
        }
      />

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Red Domika</span>
            <h2>Propiedades de otras organizaciones</h2>
          </div>
        </div>
        {overview.networkListings.length > 0 ? (
          <div className={styles.propertyGrid}>
            {overview.networkListings.map((listing) => (
              <Link
                className={styles.propertyCard}
                href={`/network/listing/${listing.slug}`}
                key={listing.publicationId}
              >
                {listing.coverUrl ? (
                  <Image
                    src={listing.coverUrl}
                    alt={listing.title}
                    className={styles.propertyImage}
                    width={900}
                    height={506}
                    sizes="(max-width: 820px) 100vw, 30vw"
                  />
                ) : (
                  <div className={styles.propertyImagePlaceholder}>
                    Sin fotos
                  </div>
                )}
                <div className={styles.propertyBody}>
                  <div className={styles.propertyTitleBlock}>
                    <strong>{listing.title}</strong>
                    <span className={styles.propertyMeta}>
                      {[listing.zone, listing.city].filter(Boolean).join(", ")}
                      {" · "}
                      {listing.organizationName}
                    </span>
                  </div>
                  <div className={styles.propertyFooter}>
                    <strong>
                      {formatPrice(listing.price, listing.currency)}
                    </strong>
                    <span className={styles.pill}>
                      {listing.viewCount} vista
                      {listing.viewCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.mutedText}>
            Todavía no hay propiedades publicadas por otras organizaciones.
          </p>
        )}
      </section>

      <div className={styles.splitGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Recibidas</span>
              <h2>Compartidas conmigo</h2>
            </div>
          </div>
          {overview.sharedWithMe.length > 0 ? (
            <div className={styles.fieldList}>
              {overview.sharedWithMe.map((share) => (
                <Link
                  className={styles.fieldRow}
                  href={`/network/shared/${share.shareId}`}
                  key={share.shareId}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <strong>{share.title}</strong>
                  <span>
                    {share.sharedByOrganization} ·{" "}
                    {PERMISSION_LABELS[share.permission]} ·{" "}
                    {formatPrice(share.price, share.currency)}
                    {share.expiresAt
                      ? ` · expira ${new Date(share.expiresAt).toLocaleDateString("es")}`
                      : ""}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>
              Nadie te ha compartido propiedades todavía.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Enviadas</span>
              <h2>Compartidas por mi organización</h2>
            </div>
          </div>
          {overview.myShares.length > 0 ? (
            <div className={styles.fieldList}>
              {overview.myShares.map((share) => (
                <article className={styles.fieldRow} key={share.shareId}>
                  <strong>
                    <Link href={`/properties/${share.propertyId}`}>
                      {share.propertyTitle}
                    </Link>
                  </strong>
                  <span>
                    → {share.recipientLabel} ·{" "}
                    {PERMISSION_LABELS[share.permission]} · {share.viewCount}{" "}
                    vista{share.viewCount === 1 ? "" : "s"}
                    {share.expiresAt
                      ? ` · expira ${new Date(share.expiresAt).toLocaleDateString("es")}`
                      : ""}
                  </span>
                  <form action={revokeShareAction}>
                    <input type="hidden" name="shareId" value={share.shareId} />
                    <input
                      type="hidden"
                      name="propertyId"
                      value={share.propertyId}
                    />
                    <button className={styles.ghostButton} type="submit">
                      Revocar
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>
              Comparte una propiedad desde su página de detalle.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
