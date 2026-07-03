import {
  AgentExchange,
  AgentMeshNetwork,
  PageHeader,
} from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { networkListings } from "@/lib/domika-app-data";

export default function NetworkPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Red de agentes"
        title="Propiedades compartidas y compradores compatibles"
        description="Coordina co-broker, referidos, permisos de datos y oportunidades de colaboración entre agentes."
        actions={
          <>
            <button className={styles.secondaryButton}>Invitar agente</button>
            <button className={styles.primaryButton}>Compartir inventario</button>
          </>
        }
      />

      <AgentMeshNetwork />

      <section className={styles.exchangeGrid}>
        <div className={styles.marketMap}>
          {["Piantini", "Naco", "Cap Cana", "Bávaro", "Bella Vista"].map(
            (zone, index) => (
              <div
                className={`${styles.mapZone} ${styles[`mapZone_${index}`]}`}
                key={zone}
              >
                <strong>{zone}</strong>
                <span>{index + 4} coincidencias</span>
              </div>
            ),
          )}
        </div>
        <AgentExchange listings={networkListings} />
        <aside className={styles.sharePanel}>
          <span className={styles.eyebrow}>Configuración compartida</span>
          <h2>Penthouse con vista al mar en Cap Cana</h2>
          {[
            "Ocultar datos del propietario",
            "Requerir acuerdo de comisión",
            "Permitir notas de agentes",
          ].map((option, index) => (
            <label className={styles.fieldRow} key={option}>
              <input type="checkbox" defaultChecked={index !== 2} readOnly />
              <span>{option}</span>
            </label>
          ))}
          <button className={styles.primaryButton}>Publicar en la red</button>
        </aside>
      </section>
    </div>
  );
}
