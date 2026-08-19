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

  // Hydrate the first conversation server-side so the chat is filled on load.
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
      };
    }
  }

  return (
    <ConversationsInbox
      conversations={overview.conversations}
      canReply={overview.canReply}
      initialActiveId={first?.id ?? null}
      initialDetail={initialDetail}
    />
  );
}
