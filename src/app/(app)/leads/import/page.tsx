import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getSessionProfile } from "@/lib/auth/session";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";

export default async function LeadsImportPage() {
  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (session.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (session.status === "profile_missing") {
    redirect("/onboarding");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Prospectos"
        title="Importar contactos desde CSV"
        description="Sube tu lista, mapea las columnas y revisa los duplicados antes de importar. Exporta tu Excel como CSV para usarlo aquí."
        actions={
          <Link className={styles.secondaryButton} href="/leads">
            ← Volver al embudo
          </Link>
        }
      />

      <div className={styles.leadsGrid}>
        <section className={styles.panel}>
          <ImportWizard />
        </section>

        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Cómo importar</span>
              <h2>Instrucciones</h2>
            </div>
          </div>

          <a
            className={styles.primaryButton}
            href="/plantilla-prospectos-domika.csv"
            download="plantilla-prospectos-domika.csv"
          >
            ⬇ Descargar plantilla CSV
          </a>

          <ol className={styles.instructionList}>
            <li>
              <strong>Descarga la plantilla</strong> y ábrela en Excel o Google
              Sheets.
            </li>
            <li>
              <strong>Completa una fila por prospecto.</strong> La única columna
              obligatoria es <em>Nombre completo</em>. Borra las filas de
              ejemplo antes de subir.
            </li>
            <li>
              <strong>Guarda como CSV</strong> (en Excel: Archivo → Guardar como
              → «CSV UTF-8»). Sirven separadores por coma o punto y coma.
            </li>
            <li>
              <strong>Súbela aquí</strong> y revisa que cada columna quede
              asignada al campo correcto (se detectan solas por el
              encabezado).
            </li>
            <li>
              <strong>Verifica duplicados</strong> y luego confirma la
              importación.
            </li>
          </ol>

          <div className={styles.instructionNote}>
            <strong>Columnas de la plantilla</strong>
            <ul>
              <li>
                <code>Nombre completo</code> — obligatorio
              </li>
              <li>
                <code>Teléfono</code> — sin prefijo se asume{" "}
                <strong>+591</strong> (ej. <code>70011122</code> →{" "}
                <code>+59170011122</code>)
              </li>
              <li>
                <code>Correo</code>, <code>Zona de interés</code>,{" "}
                <code>Notas</code> — opcionales
              </li>
            </ul>
          </div>

          <div className={styles.instructionNote}>
            <strong>Qué hace Domika</strong>
            <ul>
              <li>
                Detecta duplicados contra tus prospectos existentes (por
                teléfono o correo) y también dentro del mismo archivo.
              </li>
              <li>
                Solo importa las filas nuevas; las repetidas se omiten sin
                borrar nada.
              </li>
              <li>
                Los prospectos entran en la primera etapa del embudo, asignados
                a ti.
              </li>
              <li>Máximo 2.000 filas por archivo.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
