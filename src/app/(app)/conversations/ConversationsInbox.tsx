"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { MessageChannel } from "@/lib/database.types";
import type { ConversationSummary } from "@/lib/domain/conversations";
import {
  convertConversationAction,
  loadConversationAction,
  sendReplyAction,
  type LoadedMessage,
} from "./actions";

const CHANNEL: Record<MessageChannel, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#25d366" },
  instagram: { label: "Instagram", color: "#c13584" },
  messenger: { label: "Messenger", color: "#0084ff" },
};

export type ConversationDetailView = {
  messages: LoadedMessage[];
  leadId: string | null;
  contactName: string;
  contactPhone: string;
  channel: MessageChannel;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function ConversationsInbox({
  conversations,
  canReply,
  initialActiveId,
  initialDetail,
}: {
  conversations: ConversationSummary[];
  canReply: boolean;
  initialActiveId: string | null;
  initialDetail: ConversationDetailView | null;
}) {
  const [convos, setConvos] = useState(conversations);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [detail, setDetail] = useState<ConversationDetailView | null>(
    initialDetail,
  );
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = convos.find((c) => c.id === activeId) ?? null;

  // Pin the message list to the latest (DOM only — no state, so no effect lint).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [detail?.messages.length, loading]);

  function selectConversation(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    setDetail(null);
    setLoading(true);
    setError(null);
    loadConversationAction(id).then((res) => {
      setDetail(res.ok ? res : null);
      setLoading(false);
    });
  }

  function submitReply(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || !activeId) return;
    if (!canReply) {
      setError("Conecta WhatsApp para responder desde Domika.");
      return;
    }
    setError(null);
    const optimistic: LoadedMessage = {
      id: `tmp-${Date.now()}`,
      direction: "outbound",
      body: value,
      sent_at: new Date().toISOString(),
      media: [],
    };
    setDetail((d) => (d ? { ...d, messages: [...d.messages, optimistic] } : d));
    setText("");
    const threadId = activeId;
    startTransition(async () => {
      const res = await sendReplyAction(threadId, value);
      if (res.error) {
        setError(res.error);
        setDetail((d) =>
          d
            ? { ...d, messages: d.messages.filter((m) => m.id !== optimistic.id) }
            : d,
        );
        setText(value);
      }
    });
  }

  function convert() {
    if (!activeId) return;
    setError(null);
    const threadId = activeId;
    startTransition(async () => {
      const res = await convertConversationAction(threadId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDetail((d) => (d ? { ...d, leadId: res.leadId } : d));
      setConvos((prev) =>
        prev.map((c) => (c.id === threadId ? { ...c, leadId: res.leadId } : c)),
      );
    });
  }

  if (convos.length === 0) {
    return (
      <div className={styles.inboxConnect}>
        <span className={styles.inboxConnectIcon}>💬</span>
        <h2>Todas tus conversaciones, en un solo lugar</h2>
        <p className={styles.mutedText}>
          Conecta tu WhatsApp Business para recibir y responder mensajes dentro
          de Domika, y convertir cada chat en un prospecto.
        </p>
        <a
          className={styles.primaryButton}
          href="/api/integrations/zernio/whatsapp"
        >
          Conectar WhatsApp
        </a>
      </div>
    );
  }

  const leadId = detail?.leadId ?? active?.leadId ?? null;

  return (
    <div className={styles.inbox}>
      <aside className={styles.inboxList}>
        <div className={styles.inboxListHead}>
          <span className={styles.eyebrow}>Entradas</span>
          <span className={styles.inboxCount}>{convos.length}</span>
        </div>
        <div className={styles.inboxListScroll}>
          {convos.map((c) => (
            <button
              type="button"
              key={c.id}
              className={
                c.id === activeId
                  ? `${styles.convRow} ${styles.convRowActive}`
                  : styles.convRow
              }
              onClick={() => selectConversation(c.id)}
            >
              <span className={styles.convAvatar}>
                {initials(c.contactName)}
                <span
                  className={styles.convChannelDot}
                  style={{ background: CHANNEL[c.channel].color }}
                  title={CHANNEL[c.channel].label}
                />
              </span>
              <span className={styles.convMeta}>
                <span className={styles.convTopline}>
                  <strong className={styles.convName}>{c.contactName}</strong>
                  <span className={styles.convTime}>
                    {timeLabel(c.lastMessageAt)}
                  </span>
                </span>
                <span className={styles.convSnippet}>
                  {c.lastDirection === "outbound" ? "Tú: " : ""}
                  {c.lastMessage ?? "Sin mensajes"}
                </span>
              </span>
              {!c.leadId ? (
                <span className={styles.convNewDot} title="Sin prospecto" />
              ) : null}
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.inboxChat}>
        {active ? (
          <>
            <header className={styles.inboxChatHead}>
              <span className={styles.convAvatar}>
                {initials(active.contactName)}
                <span
                  className={styles.convChannelDot}
                  style={{ background: CHANNEL[active.channel].color }}
                />
              </span>
              <div className={styles.inboxChatWho}>
                <strong>{active.contactName}</strong>
                <span className={styles.mutedText}>
                  {CHANNEL[active.channel].label} · {active.contactPhone}
                </span>
              </div>
              {leadId ? (
                <Link
                  className={styles.secondaryButton}
                  href={`/leads/${leadId}`}
                >
                  Ver prospecto
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={convert}
                  disabled={pending}
                >
                  {pending ? "Convirtiendo…" : "Convertir en prospecto"}
                </button>
              )}
            </header>

            <div className={styles.inboxMessages} ref={scrollRef}>
              {loading ? (
                <p className={styles.mutedText}>Cargando conversación…</p>
              ) : detail && detail.messages.length > 0 ? (
                detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.chatBubble} ${
                      m.direction === "inbound"
                        ? styles.chatInbound
                        : styles.chatOutbound
                    }`}
                  >
                    {m.body ? <p>{m.body}</p> : null}
                    <time>{timeLabel(m.sent_at)}</time>
                  </div>
                ))
              ) : (
                <p className={styles.mutedText}>
                  Aún no hay mensajes en esta conversación.
                </p>
              )}
            </div>

            {error ? <p className={styles.formError}>{error}</p> : null}

            <form className={styles.inboxComposer} onSubmit={submitReply}>
              <input
                className={styles.textInput}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  canReply
                    ? "Escribe un mensaje…"
                    : "Conecta WhatsApp para responder"
                }
                disabled={!canReply || pending}
              />
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={!canReply || pending || text.trim().length === 0}
              >
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className={styles.inboxEmpty}>
            <p className={styles.mutedText}>
              Selecciona una conversación para verla aquí.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
