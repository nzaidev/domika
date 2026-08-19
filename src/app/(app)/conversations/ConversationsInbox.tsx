"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { MessageChannel } from "@/lib/database.types";
import type { ConversationSummary } from "@/lib/domain/conversations";
import {
  convertConversationAction,
  loadConversationAction,
  searchMessagesAction,
  sendReplyAction,
  type ConversationNote,
  type LoadedMessage,
} from "./actions";

const CHANNEL: Record<MessageChannel, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#25d366" },
  instagram: { label: "Instagram", color: "#c13584" },
  messenger: { label: "Messenger", color: "#0084ff" },
};

const CONNECT_OPTIONS = [
  { slug: "whatsapp", label: "WhatsApp", color: "#25d366" },
  { slug: "instagram", label: "Instagram", color: "#c13584" },
  { slug: "facebook", label: "Facebook", color: "#0084ff" },
];

export type ConversationDetailView = {
  messages: LoadedMessage[];
  leadId: string | null;
  contactName: string;
  contactPhone: string;
  channel: MessageChannel;
  email: string | null;
  source: string | null;
  stageName: string | null;
  assigneeName: string | null;
  zone: string | null;
  budgetLabel: string | null;
  notes: ConversationNote[];
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
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function clockLabel(value: string): string {
  return new Date(value).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daySeparator(value: string): string {
  const d = new Date(value);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hoy";
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "long" });
}

function ConnectButtons() {
  return (
    <div className={styles.connectRow}>
      {CONNECT_OPTIONS.map((c) => (
        <a
          key={c.slug}
          className={styles.connectBtn}
          href={`/api/integrations/zernio/${c.slug}`}
        >
          <span className={styles.connectDot} style={{ background: c.color }} />
          Conectar {c.label}
        </a>
      ))}
    </div>
  );
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
  const [filter, setFilter] = useState<"all" | MessageChannel>("all");
  const [query, setQuery] = useState("");
  const [matchedIds, setMatchedIds] = useState<Set<string> | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = convos.find((c) => c.id === activeId) ?? null;
  const leadId = detail?.leadId ?? active?.leadId ?? null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
      setError("Conecta un canal para responder desde Domika.");
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

  function convertById(threadId: string) {
    setError(null);
    startTransition(async () => {
      const res = await convertConversationAction(threadId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setConvos((prev) =>
        prev.map((c) => (c.id === threadId ? { ...c, leadId: res.leadId } : c)),
      );
      if (threadId === activeId) {
        setDetail((d) => (d ? { ...d, leadId: res.leadId } : d));
      }
    });
  }

  function convert() {
    if (activeId) convertById(activeId);
  }

  // Debounced message-content search across the chat history.
  function onSearch(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = value.trim();
    if (q.length < 2) {
      setMatchedIds(null);
      return;
    }
    searchTimer.current = setTimeout(() => {
      searchMessagesAction(q).then((ids) => setMatchedIds(new Set(ids)));
    }, 250);
  }

  if (convos.length === 0) {
    return (
      <div className={styles.inboxConnect}>
        <span className={styles.inboxConnectIcon}>💬</span>
        <h2>Todas tus conversaciones, en un solo lugar</h2>
        <p className={styles.mutedText}>
          Conecta tus canales para recibir y responder mensajes dentro de
          Domika, y convertir cada chat en un prospecto.
        </p>
        <ConnectButtons />
      </div>
    );
  }

  const counts = {
    all: convos.length,
    whatsapp: convos.filter((c) => c.channel === "whatsapp").length,
    messenger: convos.filter((c) => c.channel === "messenger").length,
    instagram: convos.filter((c) => c.channel === "instagram").length,
  };
  const q = query.trim().toLowerCase();
  const filtered = convos
    .filter((c) => filter === "all" || c.channel === filter)
    .filter(
      (c) =>
        q === "" ||
        c.contactName.toLowerCase().includes(q) ||
        (matchedIds?.has(c.id) ?? false),
    );

  const phoneDigits = active ? active.contactPhone.replace(/[^\d]/g, "") : "";
  const status = detail?.stageName ?? (leadId ? "Prospecto" : "Nuevo");

  // Activity timeline built from the message flow.
  const activity: Array<{ label: string; at: string }> = [];
  if (detail && detail.messages[0]) {
    activity.push({
      label: "Conversación iniciada",
      at: detail.messages[0].sent_at,
    });
    for (const m of detail.messages.slice(-5)) {
      activity.push({
        label: m.direction === "inbound" ? "Mensaje recibido" : "Mensaje enviado",
        at: m.sent_at,
      });
    }
  }

  return (
    <div className={styles.inbox3}>
      {/* ── Conversation list ── */}
      <aside className={styles.inboxList}>
        <div className={styles.channelTabs}>
          {(
            [
              ["all", "Todos", "var(--app-green)", counts.all],
              ["whatsapp", "", CHANNEL.whatsapp.color, counts.whatsapp],
              ["messenger", "", CHANNEL.messenger.color, counts.messenger],
              ["instagram", "", CHANNEL.instagram.color, counts.instagram],
            ] as const
          ).map(([key, label, color, n]) => (
            <button
              key={key}
              type="button"
              className={
                filter === key
                  ? `${styles.channelTab} ${styles.channelTabActive}`
                  : styles.channelTab
              }
              onClick={() => setFilter(key)}
              title={key === "all" ? "Todos" : CHANNEL[key as MessageChannel].label}
            >
              <span className={styles.channelTabDot} style={{ background: color }} />
              {label ? <span>{label}</span> : null}
              <span className={styles.channelTabCount}>{n}</span>
            </button>
          ))}
          <button
            type="button"
            className={styles.connectPlus}
            onClick={() => setShowConnect((v) => !v)}
            title="Conectar un canal"
            aria-expanded={showConnect}
          >
            +
          </button>
        </div>
        {showConnect ? (
          <div className={styles.connectMenu}>
            <ConnectButtons />
          </div>
        ) : null}
        <div className={styles.inboxSearchRow}>
          <input
            className={styles.inboxSearch}
            type="search"
            placeholder="Buscar por nombre o mensaje…"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className={styles.inboxListScroll}>
          {filtered.map((c) => (
            <button
              type="button"
              key={c.id}
              className={
                c.id === activeId
                  ? `${styles.convRow} ${styles.convRowActive}`
                  : styles.convRow
              }
              onClick={() => selectConversation(c.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", c.id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(c.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropActive(false);
              }}
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
              {c.unread > 0 ? (
                <span className={styles.convUnread}>{c.unread}</span>
              ) : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className={styles.inboxListEmpty}>Sin conversaciones aquí.</p>
          ) : null}
        </div>
        {dragId ? (
          <div
            className={
              dropActive
                ? `${styles.dropZone} ${styles.dropZoneActive}`
                : styles.dropZone
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              convertById(id);
              setDragId(null);
              setDropActive(false);
            }}
          >
            ➕ Suelta aquí para agregar al flujo de ventas
          </div>
        ) : null}
      </aside>

      {/* ── Chat ── */}
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
                <strong>
                  {active.contactName}{" "}
                  <span
                    className={styles.chatHeadChannelDot}
                    style={{ background: CHANNEL[active.channel].color }}
                  />
                </strong>
                <span className={styles.mutedText}>
                  {detail?.source
                    ? `Origen: ${detail.source}`
                    : `${CHANNEL[active.channel].label} · ${active.contactPhone}`}
                </span>
              </div>
              {leadId ? (
                <Link className={styles.secondaryButton} href={`/leads/${leadId}`}>
                  Ver contacto
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={convert}
                  disabled={pending}
                >
                  {pending ? "…" : "Ver contacto"}
                </button>
              )}
            </header>

            <div className={styles.inboxMessages} ref={scrollRef}>
              {loading ? (
                <p className={styles.mutedText}>Cargando conversación…</p>
              ) : detail && detail.messages.length > 0 ? (
                detail.messages.map((m, i) => {
                  const prev = detail.messages[i - 1];
                  const showDay =
                    !prev ||
                    new Date(prev.sent_at).toDateString() !==
                      new Date(m.sent_at).toDateString();
                  return (
                    <div key={m.id}>
                      {showDay ? (
                        <div className={styles.daySep}>
                          <span>{daySeparator(m.sent_at)}</span>
                        </div>
                      ) : null}
                      <div
                        className={`${styles.chatBubble} ${
                          m.direction === "inbound"
                            ? styles.chatInbound
                            : styles.chatOutbound
                        }`}
                      >
                        {m.body ? <p>{m.body}</p> : null}
                        <time>
                          {clockLabel(m.sent_at)}
                          {m.direction === "outbound" ? (
                            <span className={styles.chatReceipt}> ✓✓</span>
                          ) : null}
                        </time>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className={styles.mutedText}>
                  Aún no hay mensajes en esta conversación.
                </p>
              )}
            </div>

            {error ? <p className={styles.formError}>{error}</p> : null}

            <form className={styles.inboxComposer} onSubmit={submitReply}>
              <div className={styles.composerChannel}>
                <span
                  className={styles.convChannelDot}
                  style={{ background: CHANNEL[active.channel].color }}
                />
                {CHANNEL[active.channel].label}
              </div>
              <div className={styles.composerBox}>
                <input
                  className={styles.composerInput}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    canReply ? "Escribe un mensaje…" : "Conecta un canal para responder"
                  }
                  disabled={!canReply || pending}
                />
                <div className={styles.composerToolbar}>
                  <span className={styles.composerTools}>
                    <span className={styles.composerTool}>😊</span>
                    <span className={styles.composerTool}>📎</span>
                    <span className={styles.composerTool}>📅</span>
                    <span className={styles.composerTool}>🖼️</span>
                  </span>
                  <button
                    className={styles.composerSend}
                    type="submit"
                    disabled={!canReply || pending || text.trim().length === 0}
                    aria-label="Enviar"
                  >
                    ➤
                  </button>
                </div>
              </div>
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

      {/* ── Contact context ── */}
      {active ? (
        <aside className={styles.inboxContext}>
          <div className={styles.ctxHead}>
            <span className={`${styles.convAvatar} ${styles.ctxAvatar}`}>
              {initials(active.contactName)}
            </span>
            <strong className={styles.ctxName}>{active.contactName}</strong>
            <span
              className={
                leadId ? styles.ctxStatus : `${styles.ctxStatus} ${styles.ctxStatusNew}`
              }
            >
              {status}
            </span>
            <div className={styles.ctxQuick}>
              {phoneDigits ? (
                <a
                  className={styles.ctxQuickBtn}
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬
                </a>
              ) : null}
              <a className={styles.ctxQuickBtn} href={`tel:${active.contactPhone}`}>
                📞
              </a>
              {detail?.email ? (
                <a className={styles.ctxQuickBtn} href={`mailto:${detail.email}`}>
                  ✉️
                </a>
              ) : null}
            </div>
          </div>

          <div className={styles.ctxSection}>
            <span className={styles.eyebrow}>Sobre el contacto</span>
            <div className={styles.ctxRow}>
              <span>Teléfono</span>
              <strong>{active.contactPhone}</strong>
            </div>
            <div className={styles.ctxRow}>
              <span>Correo</span>
              <strong>{detail?.email ?? "—"}</strong>
            </div>
            <div className={styles.ctxRow}>
              <span>Origen</span>
              <strong>{detail?.source ?? CHANNEL[active.channel].label}</strong>
            </div>
            <div className={styles.ctxRow}>
              <span>Zona</span>
              <strong>{detail?.zone ?? "—"}</strong>
            </div>
            <div className={styles.ctxRow}>
              <span>Presupuesto</span>
              <strong>{detail?.budgetLabel ?? "—"}</strong>
            </div>
            <div className={styles.ctxRow}>
              <span>Asignado a</span>
              <strong>{detail?.assigneeName ?? "—"}</strong>
            </div>
            {leadId ? (
              <Link className={styles.ctxMore} href={`/leads/${leadId}`}>
                Ver más información →
              </Link>
            ) : null}
          </div>

          <div className={styles.ctxSection}>
            <span className={styles.eyebrow}>Acciones rápidas</span>
            <div className={styles.ctxActions}>
              {leadId ? (
                <Link className={styles.ctxActionBtn} href={`/leads/${leadId}`}>
                  👤 Ver prospecto
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.ctxActionBtn}
                  onClick={convert}
                  disabled={pending}
                >
                  ➕ Agregar a flujo
                </button>
              )}
              <Link
                className={styles.ctxActionBtn}
                href={leadId ? `/tasks?lead=${leadId}` : "/tasks"}
              >
                ✅ Crear tarea
              </Link>
              <Link
                className={styles.ctxActionBtn}
                href={leadId ? `/tasks?lead=${leadId}` : "/tasks"}
              >
                📅 Agendar visita
              </Link>
              <Link
                className={styles.ctxActionBtn}
                href={leadId ? `/leads/${leadId}` : "/leads"}
              >
                📇 Ver contacto
              </Link>
            </div>
          </div>

          <div className={styles.ctxSection}>
            <div className={styles.ctxSectionHead}>
              <span className={styles.eyebrow}>Notas</span>
              {leadId ? (
                <Link className={styles.ctxAddNote} href={`/leads/${leadId}`}>
                  + Nueva nota
                </Link>
              ) : null}
            </div>
            {detail && detail.notes.length > 0 ? (
              detail.notes.map((n) => (
                <div className={styles.ctxNote} key={n.id}>
                  <p>{n.body ?? n.title}</p>
                  <time>{timeLabel(n.at)}</time>
                </div>
              ))
            ) : (
              <p className={styles.mutedText}>Sin notas todavía.</p>
            )}
          </div>

          <div className={styles.ctxSection}>
            <span className={styles.eyebrow}>Flujo de conversaciones</span>
            <div className={styles.ctxActivity}>
              {activity.map((a, i) => (
                <div className={styles.ctxActivityItem} key={i}>
                  <span className={styles.ctxActivityDot} />
                  <span>{a.label}</span>
                  <time>{clockLabel(a.at)}</time>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
