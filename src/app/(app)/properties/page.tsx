import {
  PageHeader,
  PropertyGrid,
} from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { appProperties } from "@/lib/domika-app-data";

export default function PropertiesPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Propiedades"
        title="Inventario inmobiliario"
        description="Administra propiedades, borradores, fotos, estado de publicación y acciones para compartir con agentes."
        actions={
          <>
            <button className={styles.secondaryButton}>Filtrar</button>
            <button className={styles.primaryButton}>Nueva propiedad</button>
          </>
        }
      />

      <div className={styles.filters} aria-label="Filtros de propiedades">
        <span className={`${styles.filterChip} ${styles.filterChipActive}`}>
          Todas
        </span>
        <span className={styles.filterChip}>Publicadas</span>
        <span className={styles.filterChip}>Compartidas</span>
        <span className={styles.filterChip}>Borradores</span>
      </div>

      <PropertyGrid properties={appProperties} />
    </div>
  );
}

