import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CampaignChannels,
  LifecycleBoard,
  MetricGrid,
  PageHeader,
  PropertyGrid,
  TaskList,
  WhatsAppInbox,
} from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import {
  appProperties,
  campaignChannels,
  lifecycleColumns,
  tasks,
  whatsappInbox,
} from "@/lib/domika-app-data";
import { getDashboardOverview } from "@/lib/domain/dashboard";

export const dynamic = "force-dynamic";

function SetupState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.eyebrow}>Configuración del backend</span>
      <h1>Clerk o Supabase todavía no están configurados</h1>
      <p>
        Agrega los valores de `.env.example`, ejecuta la migración de identidad
        de Clerk y recarga esta ruta para verificar el módulo autenticado del App
        Router.
      </p>
      <div className={styles.codeList}>
        <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
        <code>CLERK_SECRET_KEY</code>
        <code>NEXT_PUBLIC_SUPABASE_URL</code>
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        <code>SUPABASE_SERVICE_ROLE_KEY</code>
      </div>
    </div>
  );
}

function AuthState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.eyebrow}>Inicio de sesión requerido</span>
      <h1>Inicia sesión para verificar el dashboard</h1>
      <p>
        El backend está configurado, pero esta solicitud no tiene una sesión
        activa de Clerk. Usa `/sign-in` o `/sign-up` y luego conecta el ID de
        usuario de Clerk con un perfil de Domika.
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  if (overview.status === "not_configured") {
    return <SetupState />;
  }

  if (overview.status === "unauthenticated") {
    return <AuthState />;
  }

  if (overview.status === "profile_missing") {
    redirect("/onboarding");
  }

  const metrics = [
    { label: "Prospectos", value: overview.counts.leads, tone: "green" },
    { label: "Propiedades", value: overview.counts.properties, tone: "blue" },
    {
      label: "Propiedades publicadas",
      value: overview.counts.publishedListings,
      tone: "mint",
    },
    { label: "Tareas abiertas", value: overview.counts.openTasks, tone: "amber" },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Resumen"
        title={`Hola, ${overview.profile.full_name}`}
        description="Centro de control para revisar prospectos, propiedades publicadas, tareas críticas y colaboración con agentes."
        actions={
          <>
            <Link className={styles.secondaryButton} href="/network">
              Compartir propiedad
            </Link>
            <Link className={styles.primaryButton} href="/leads">
              Capturar contacto
            </Link>
          </>
        }
      />

      <MetricGrid metrics={metrics} />

      <div className={styles.contentGrid}>
        <LifecycleBoard columns={lifecycleColumns} />
        <div className={styles.leadStack}>
          <WhatsAppInbox messages={whatsappInbox} />
          <CampaignChannels channels={campaignChannels.slice(0, 3)} />
        </div>
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Inventario reciente</span>
              <h2>Propiedades listas para mover</h2>
            </div>
            <Link className={styles.secondaryButton} href="/properties">
              Ver todo
            </Link>
          </div>
          <PropertyGrid properties={appProperties} limit={3} />
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Tareas</span>
              <h2>Próximas acciones</h2>
            </div>
            <Link className={styles.secondaryButton} href="/tasks">
              Ver agenda
            </Link>
          </div>
          <TaskList items={tasks.slice(0, 4)} />
        </section>
      </div>
    </div>
  );
}

