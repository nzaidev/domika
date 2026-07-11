import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getPromotionOverview } from "@/lib/domain/promotion";
import { setNetworkPublicationAction } from "@/app/(app)/network/actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  published: "Publicada",
  unpublished: "Despublicada",
  draft: "Borrador",
  pending: "Pendiente",
  failed: "Fallida",
};

export default async function ListingsPage() {
  const overview = await getPromotionOverview();

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

  const activePublications = overview.publications.filter(
    (pub) => pub.status === "published",
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Promoción"
        title="Publicar y promocionar propiedades"
        description="Publicaciones activas, su alcance por canal y las propiedades listas para publicar."
        actions={
          <>
            <span className={styles.pill}>
              {activePublications.length} activa
              {activePublications.length === 1 ? "" : "s"}
            </span>
            <Link className={styles.primaryButton} href="/brochures">
              Crear folleto
            </Link>
          </>
        }
      />

      <div className={styles.splitGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Canales</span>
              <h2>Alcance por canal</h2>
            </div>
          </div>
          <div className={styles.channelList}>
            {overview.channels.length > 0 ? (
              overview.channels.map((channel) => (
                <article className={styles.channelRow} key={channel.channel}>
                  <strong>{channel.label}</strong>
                  <span>
                    {channel.published} publicada
                    {channel.published === 1 ? "" : "s"} · {channel.views} vista
                    {channel.views === 1 ? "" : "s"}
                  </span>
                </article>
              ))
            ) : (
              <p className={styles.mutedText}>
                Todavía no hay publicaciones. Publica una propiedad desde su
                página o desde la lista de abajo.
              </p>
            )}
            <article className={styles.channelRow}>
              <strong>Folletos generados</strong>
              <span>
                {overview.brochureCount} en total ·{" "}
                <Link href="/brochures">crear más</Link>
              </span>
            </article>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Sin publicar</span>
              <h2>Listas para la red Domika</h2>
            </div>
          </div>
          {overview.unpublished.length > 0 ? (
            <div className={styles.fieldList}>
              {overview.unpublished.slice(0, 6).map((property) => (
                <article className={styles.fieldRow} key={property.id}>
                  <strong>
                    <Link href={`/properties/${property.id}`}>
                      {property.title}
                    </Link>
                  </strong>
                  <form action={setNetworkPublicationAction}>
                    <input
                      type="hidden"
                      name="propertyId"
                      value={property.id}
                    />
                    <input type="hidden" name="publish" value="true" />
                    <button className={styles.secondaryButton} type="submit">
                      Publicar en la red
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>
              Todas tus propiedades activas ya están publicadas.
            </p>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Publicaciones</span>
            <h2>Estado y rendimiento</h2>
          </div>
        </div>
        {overview.publications.length > 0 ? (
          <div className={styles.fieldList}>
            {overview.publications.map((pub) => (
              <article className={styles.publicationRow} key={pub.publicationId}>
                {pub.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- storage assets are pre-normalized
                  <img
                    src={pub.coverUrl}
                    alt={pub.propertyTitle}
                    className={styles.photoThumb}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.photoThumb} />
                )}
                <div className={styles.photoMeta}>
                  <strong>
                    <Link href={`/properties/${pub.propertyId}`}>
                      {pub.propertyTitle}
                    </Link>
                  </strong>
                  <span className={styles.mutedText}>
                    {STATUS_LABELS[pub.status] ?? pub.status}
                    {" · "}
                    {pub.views} vista{pub.views === 1 ? "" : "s"}
                    {pub.leads > 0 ? ` · ${pub.leads} prospectos` : ""}
                    {pub.publishedAt
                      ? ` · desde ${new Date(pub.publishedAt).toLocaleDateString("es")}`
                      : ""}
                  </span>
                </div>
                {pub.status === "published" ? (
                  <form action={setNetworkPublicationAction}>
                    <input
                      type="hidden"
                      name="propertyId"
                      value={pub.propertyId}
                    />
                    <input type="hidden" name="publish" value="false" />
                    <button className={styles.ghostButton} type="submit">
                      Despublicar
                    </button>
                  </form>
                ) : (
                  <form action={setNetworkPublicationAction}>
                    <input
                      type="hidden"
                      name="propertyId"
                      value={pub.propertyId}
                    />
                    <input type="hidden" name="publish" value="true" />
                    <button className={styles.secondaryButton} type="submit">
                      Republicar
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.mutedText}>Sin publicaciones todavía.</p>
        )}
      </section>
    </div>
  );
}
