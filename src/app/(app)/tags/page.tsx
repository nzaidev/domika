import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getTagsOverview } from "@/lib/domain/tags";
import { NewTagForm } from "./NewTagForm";
import { TagRow } from "./TagRow";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const overview = await getTagsOverview();

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
        eyebrow="Etiquetas"
        title="Etiquetas de prospectos"
        description="Crea etiquetas para clasificar a tus contactos (AirBNB, inversionista, turista, comprador…) y asígnalas desde la ficha de cada prospecto."
        actions={
          <span className={styles.pill}>
            {overview.tags.length} etiqueta{overview.tags.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className={styles.leadsGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Tus etiquetas</span>
              <h2>Administrar</h2>
            </div>
          </div>

          {overview.tags.length > 0 ? (
            <div className={styles.fieldList}>
              {overview.tags.map((tag) => (
                <TagRow tag={tag} key={tag.id} />
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>
              Todavía no hay etiquetas. Crea la primera a la derecha; luego podrás
              asignarla a un prospecto desde su ficha.
            </p>
          )}
        </section>

        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Nueva etiqueta</span>
              <h2>Crear</h2>
            </div>
          </div>
          <NewTagForm />
        </aside>
      </div>
    </div>
  );
}
