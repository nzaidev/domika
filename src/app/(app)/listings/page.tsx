import {
  CampaignChannels,
  PageHeader,
  PropertyGrid,
} from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { appProperties, campaignChannels } from "@/lib/domika-app-data";

export default function ListingsPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Promoción"
        title="Publicar y promocionar propiedades"
        description="Configura páginas públicas, feeds de portales, campañas pagadas y difusión por WhatsApp para cada propiedad."
        actions={
          <>
            <button className={styles.secondaryButton}>Vista pública</button>
            <button className={styles.primaryButton}>Publicar propiedad</button>
          </>
        }
      />

      <div className={styles.splitGrid}>
        <CampaignChannels channels={campaignChannels} />
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Presupuesto</span>
              <h2>Promoción activa</h2>
            </div>
            <span className={styles.pill}>$650</span>
          </div>
          <div className={styles.channelList}>
            <label className={styles.fieldRow}>
              <input type="checkbox" defaultChecked readOnly />
              <span>Optimizar para prospectos de WhatsApp</span>
            </label>
            <label className={styles.fieldRow}>
              <input type="checkbox" defaultChecked readOnly />
              <span>Ocultar datos del propietario</span>
            </label>
            <label className={styles.fieldRow}>
              <input type="checkbox" readOnly />
              <span>Enviar reporte semanal al propietario</span>
            </label>
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Propiedades destacadas</span>
            <h2>Listas para campaña</h2>
          </div>
        </div>
        <PropertyGrid properties={appProperties} limit={3} />
      </section>
    </div>
  );
}
