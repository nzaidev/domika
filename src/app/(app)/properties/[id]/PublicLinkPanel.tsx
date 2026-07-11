"use client";

import styles from "@/components/domika/domika-app.module.css";
import { setPublicLinkAction } from "@/app/(app)/network/actions";
import { SocialShare } from "./SocialShare";

export function PublicLinkPanel({
  propertyId,
  propertyTitle,
  active,
  publicUrl,
}: {
  propertyId: string;
  propertyTitle: string;
  active: boolean;
  publicUrl: string | null;
}) {
  return (
    <div className={styles.formGrid}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Página pública</span>
          <h2>Compartir en redes</h2>
        </div>
        <form action={setPublicLinkAction}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="publish" value={active ? "false" : "true"} />
          <button
            className={active ? styles.secondaryButton : styles.primaryButton}
            type="submit"
          >
            {active ? "Desactivar enlace público" : "Crear enlace público"}
          </button>
        </form>
      </div>

      {active && publicUrl ? (
        <>
          <p className={styles.mutedText}>
            Página para compradores (sin datos del propietario):{" "}
            <a href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
          <SocialShare url={publicUrl} title={propertyTitle} />
        </>
      ) : (
        <p className={styles.mutedText}>
          Genera una página pública de esta propiedad para compartirla en
          WhatsApp, Facebook y LinkedIn con foto y precio.
        </p>
      )}
    </div>
  );
}
