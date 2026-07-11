import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { getPropertyDetail } from "@/lib/domain/properties";
import { getSessionProfile } from "@/lib/auth/session";
import { PropertyForm } from "../../PropertyForm";
import { PhotoManager } from "../PhotoManager";
import { DeletePropertyButton } from "../DeletePropertyButton";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, session] = await Promise.all([
    getPropertyDetail(id),
    getSessionProfile(),
  ]);

  if (detail.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (detail.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (detail.status === "profile_missing") {
    redirect("/onboarding");
  }

  if (detail.status === "not_found") {
    notFound();
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Propiedades"
        title={`Editar: ${detail.property.title}`}
        description="Actualiza la ficha, las fotos y los datos privados del propietario."
        actions={
          <Link
            className={styles.secondaryButton}
            href={`/properties/${detail.property.id}`}
          >
            ← Ver propiedad
          </Link>
        }
      />

      <div className={styles.leadsGrid}>
        <section className={styles.panel}>
          <PropertyForm property={detail.property} />
        </section>

        <div className={styles.leadStack}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Fotos</span>
                <h2>Galería y portada</h2>
              </div>
            </div>
            <PhotoManager
              propertyId={detail.property.id}
              media={detail.media}
            />
          </section>

          {session.status === "authenticated" &&
          session.profile.role !== "agent" ? (
            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Zona de riesgo</span>
                  <h2>Eliminar propiedad</h2>
                </div>
              </div>
              <p className={styles.mutedText}>
                Borra la propiedad con sus fotos, folletos, publicaciones y
                compartidos. Para retirarla sin borrar datos, usa el estado
                “Archivada” en la ficha.
              </p>
              <DeletePropertyButton
                propertyId={detail.property.id}
                propertyTitle={detail.property.title}
              />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
