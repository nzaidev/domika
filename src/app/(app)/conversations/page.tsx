import { redirect } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import {
  getConversationDetail,
  getConversationsOverview,
} from "@/lib/domain/conversations";
import {
  ConversationsInbox,
  type ConversationDetailView,
} from "./ConversationsInbox";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const overview = await getConversationsOverview();

  if (overview.status === "unauthenticated") {
    redirect("/sign-in");
  }
  if (overview.status === "profile_missing") {
    redirect("/onboarding");
  }
  if (overview.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  const first = overview.conversations[0];
  let initialDetail: ConversationDetailView | null = null;
  if (first) {
    const d = await getConversationDetail(first.id);
    if (d.status === "ready") {
      initialDetail = {
        messages: d.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          sent_at: m.sent_at,
          media: m.media,
        })),
        leadId: d.thread.lead_id,
        contactName: d.thread.contact_name ?? d.thread.contact_phone,
        contactPhone: d.thread.contact_phone,
        channel: d.thread.channel,
        email: d.contact.email,
        source: d.contact.source,
        stageName: d.contact.stageName,
        assigneeName: d.contact.assigneeName,
        zone: d.contact.zone,
        budgetLabel: d.contact.budgetLabel,
        notes: d.contact.notes,
      };
    }
  }

  return (
    <div className={styles.convPage}>
      <div className={styles.convHeader}>
        <h1 className={styles.dashTitle}>Conversaciones</h1>
        <p className={styles.dashSubtitle}>
          Centraliza tus chats y gestiona cada oportunidad.
        </p>
      </div>
      <ConversationsInbox
        conversations={overview.conversations}
        canReply={overview.canReply}
        initialActiveId={first?.id ?? null}
        initialDetail={initialDetail}
      />
    </div>
  );
}
