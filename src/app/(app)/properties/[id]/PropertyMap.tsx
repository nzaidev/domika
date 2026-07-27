import styles from "@/components/domika/domika-app.module.css";

// Keyless Google Maps: the classic `maps.google.com?q=…&output=embed` embed
// needs no API key. Priority: pasted map URL → coordinates → address.
export function PropertyMap({
  address,
  latitude,
  longitude,
  mapUrl,
}: {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
}) {
  const coords =
    latitude !== null && longitude !== null ? `${latitude},${longitude}` : null;
  const embedQuery = coords ?? (address || null);
  const linkHref =
    mapUrl ||
    (embedQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(embedQuery)}`
      : null);

  if (!embedQuery && !mapUrl) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Ubicación</span>
          <h2>Mapa</h2>
        </div>
        {linkHref ? (
          <a
            className={styles.secondaryButton}
            href={linkHref}
            target="_blank"
            rel="noreferrer"
          >
            Ver en Google Maps
          </a>
        ) : null}
      </div>

      {embedQuery ? (
        <iframe
          title="Mapa de la propiedad"
          className={styles.mapEmbed}
          src={`https://www.google.com/maps?q=${encodeURIComponent(embedQuery)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <p className={styles.mutedText}>
          Abre la ubicación con el botón “Ver en Google Maps”.
        </p>
      )}
    </section>
  );
}
