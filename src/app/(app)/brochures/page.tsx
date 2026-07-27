import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getBrochuresOverview } from "@/lib/domain/brochures";
import { BrochureStudio } from "./BrochureStudio";
import { deleteTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function BrochuresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const overview = await getBrochuresOverview();

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

  const defaultPropertyId = firstParam(params.property) || undefined;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Folletos"
        title="Diseñador de folletos y flyers"
        description="Genera folletos PDF y flyers verticales para WhatsApp con los datos y fotos de la propiedad, con la marca de tu organización."
        actions={
          <span className={styles.pill}>
            {overview.history.length} generado
            {overview.history.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className={styles.leadsGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Generador</span>
              <h2>Diseña y exporta</h2>
            </div>
          </div>
          {overview.properties.length > 0 ? (
            <BrochureStudio
              properties={overview.properties}
              templates={overview.templates}
              defaultPropertyId={defaultPropertyId}
              branding={overview.branding}
            />
          ) : (
            <p className={styles.mutedText}>
              Crea una propiedad primero para poder generar folletos.
            </p>
          )}
        </section>

        <aside className={styles.leadStack}>
          {overview.templates.length > 0 ? (
            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Plantillas</span>
                  <h2>Biblioteca</h2>
                </div>
              </div>
              <div className={styles.fieldList}>
                {overview.templates.map((template) => (
                  <article className={styles.fieldRow} key={template.id}>
                    <strong>{template.name}</strong>
                    <form action={deleteTemplateAction}>
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <button className={styles.ghostButton} type="submit">
                        Eliminar
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Historial</span>
                <h2>Generados recientemente</h2>
              </div>
            </div>
            {overview.history.length > 0 ? (
              <div className={styles.fieldList}>
                {overview.history.map((item) => (
                  <article className={styles.fieldRow} key={item.id}>
                    <strong>{item.title}</strong>
                    <span>
                      {new Date(item.createdAt).toLocaleString("es", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {item.url ? (
                      <a
                        className={styles.secondaryButton}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>
                Todavía no se generaron folletos.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
