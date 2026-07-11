import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { NotificationRow } from "@/lib/database.types";
import { getNotificationsFeed } from "@/lib/domain/notifications";
import { markAllReadAction, markReadAction } from "./actions";

export const dynamic = "force-dynamic";

function notificationLink(notification: NotificationRow): string | null {
  const metadata =
    notification.metadata && typeof notification.metadata === "object"
      ? (notification.metadata as Record<string, unknown>)
      : {};

  if (typeof metadata.task_id === "string") {
    return "/tasks";
  }
  if (typeof metadata.requirement_id === "string") {
    return "/matching";
  }
  if (typeof metadata.lead_id === "string") {
    return `/leads/${metadata.lead_id}`;
  }
  if (typeof metadata.property_id === "string") {
    return `/properties/${metadata.property_id}`;
  }
  return null;
}

export default async function NotificationsPage() {
  const feed = await getNotificationsFeed();

  if (feed.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (feed.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (feed.status === "profile_missing") {
    redirect("/onboarding");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Notificaciones"
        title="Tu actividad"
        description="Recordatorios de tareas y avisos del CRM."
        actions={
          feed.unread > 0 ? (
            <form action={markAllReadAction}>
              <button className={styles.secondaryButton} type="submit">
                Marcar todas leídas ({feed.unread})
              </button>
            </form>
          ) : (
            <span className={styles.pill}>Al día</span>
          )
        }
      />

      <section className={styles.panel}>
        {feed.notifications.length > 0 ? (
          <div className={styles.fieldList}>
            {feed.notifications.map((notification) => {
              const link = notificationLink(notification);
              return (
                <article
                  className={`${styles.fieldRow} ${
                    notification.status === "unread"
                      ? styles.notificationUnread
                      : ""
                  }`}
                  key={notification.id}
                >
                  <strong>{notification.title}</strong>
                  {notification.body ? <span>{notification.body}</span> : null}
                  <span className={styles.mutedText}>
                    {new Date(notification.created_at).toLocaleString("es", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <div className={styles.inviteRowActions}>
                    {link ? (
                      <Link className={styles.secondaryButton} href={link}>
                        Abrir
                      </Link>
                    ) : null}
                    {notification.status === "unread" ? (
                      <form action={markReadAction}>
                        <input
                          type="hidden"
                          name="notificationId"
                          value={notification.id}
                        />
                        <button className={styles.ghostButton} type="submit">
                          Marcar leída
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.mutedText}>
            Sin notificaciones. Los recordatorios de tareas aparecerán aquí.
          </p>
        )}
      </section>
    </div>
  );
}
