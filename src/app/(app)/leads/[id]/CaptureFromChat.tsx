"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import type { ApplyCapturesInput } from "@/lib/domain/lead-capture";
import { applyCapturesAction, suggestCapturesAction } from "./actions";

type ChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  sent_at: string;
  media: unknown;
};

type LeadValues = {
  budget_min: number | null;
  budget_max: number | null;
  desired_zone: string | null;
  desired_property_type: string | null;
  desired_operation: "buy" | "rent" | "invest" | null;
};

type Field =
  | "budget_min"
  | "budget_max"
  | "desired_zone"
  | "desired_property_type"
  | "desired_operation"
  | "timeline";

const FIELD_META: Record<Field, { label: string; kind: "number" | "text" | "operation" }> = {
  budget_max: { label: "Presupuesto máx.", kind: "number" },
  budget_min: { label: "Presupuesto mín.", kind: "number" },
  desired_zone: { label: "Zona", kind: "text" },
  desired_property_type: { label: "Tipo", kind: "text" },
  desired_operation: { label: "Operación", kind: "operation" },
  timeline: { label: "Plazo", kind: "text" },
};
const FIELD_ORDER = Object.keys(FIELD_META) as Field[];
const OPERATION_LABELS: Record<string, string> = {
  buy: "Compra",
  rent: "Alquiler",
  invest: "Inversión",
};
const CONFIDENCE_LABELS: Record<string, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

type Staged = {
  id: string;
  field: Field;
  value: string;
  confidence?: "high" | "medium" | "low";
  evidence?: string;
  checked: boolean;
};

let counter = 0;

// "150 mil" → 150000, "1.2M" → 1200000, "$120,000" → 120000.
function parseAmount(text: string): string {
  const t = text.toLowerCase().replace(/[$,]/g, "");
  const match = t.match(/([\d.]+)\s*(mill(?:o|ó)n(?:es)?|mil|k|m)?/);
  if (!match) {
    return "";
  }
  let n = parseFloat(match[1]);
  if (!Number.isFinite(n)) {
    return "";
  }
  const unit = match[2];
  if (unit === "mil" || unit === "k") n *= 1000;
  else if (unit === "m" || unit?.startsWith("mill")) n *= 1_000_000;
  return String(Math.round(n));
}

function guessOperation(text: string): "buy" | "rent" | "invest" {
  const t = text.toLowerCase();
  if (t.includes("alqu") || t.includes("renta") || t.includes("rent")) return "rent";
  if (t.includes("invers") || t.includes("invest")) return "invest";
  return "buy";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CaptureFromChat({
  leadId,
  messages,
  lead,
}: {
  leadId: string;
  messages: ChatMessage[];
  lead: LeadValues;
}) {
  const router = useRouter();
  const [staged, setStaged] = useState<Staged[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{
    text: string;
    top: number;
    left: number;
    field: Field;
  } | null>(null);

  function fieldEmpty(field: Field): boolean {
    switch (field) {
      case "budget_min":
        return lead.budget_min == null;
      case "budget_max":
        return lead.budget_max == null;
      case "desired_zone":
        return !lead.desired_zone;
      case "desired_property_type":
        return !lead.desired_property_type;
      case "desired_operation":
        return !lead.desired_operation;
      default:
        return true; // timeline has no column — always "new"
    }
  }

  // One staged row per field; a new capture for the same field replaces it.
  function upsert(row: Staged) {
    setStaged((prev) => [...prev.filter((r) => r.field !== row.field), row]);
  }

  function runAi() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await suggestCapturesAction(leadId);
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      setSummary(res.summary || "");
      setStaged((prev) => {
        const byField = new Map(prev.map((r) => [r.field, r]));
        for (const s of res.suggestions) {
          byField.set(s.field, {
            id: `ai-${counter++}`,
            field: s.field,
            value: String(s.value),
            confidence: s.confidence,
            evidence: s.quote,
            checked: s.confidence === "high" && fieldEmpty(s.field),
          });
        }
        return [...byField.values()];
      });
      if (res.suggestions.length === 0 && !res.summary) {
        setNotice("La IA no encontró datos nuevos en la conversación.");
      }
    });
  }

  function onMouseUp() {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || !selection || selection.rangeCount === 0) {
      setSel(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!transcriptRef.current?.contains(range.commonAncestorContainer)) {
      setSel(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSel({
      text,
      top: rect.bottom + 6,
      left: rect.left,
      field: /\d/.test(text) ? "budget_max" : "desired_zone",
    });
  }

  function addManual() {
    if (!sel) {
      return;
    }
    const meta = FIELD_META[sel.field];
    let value = sel.text;
    if (meta.kind === "number") value = parseAmount(sel.text) || sel.text;
    else if (meta.kind === "operation") value = guessOperation(sel.text);
    upsert({
      id: `m-${counter++}`,
      field: sel.field,
      value,
      evidence: sel.text,
      checked: true,
    });
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  function apply() {
    setError(null);
    const active = staged.filter((r) => r.checked);
    if (active.length === 0) {
      setError("Selecciona al menos un dato para aplicar.");
      return;
    }
    const input: ApplyCapturesInput = {};
    const notes: string[] = [];
    if (summary) notes.push(summary);
    for (const r of active) {
      switch (r.field) {
        case "budget_min":
          input.budgetMin = Number(r.value) || null;
          break;
        case "budget_max":
          input.budgetMax = Number(r.value) || null;
          break;
        case "desired_zone":
          input.desiredZone = r.value;
          break;
        case "desired_property_type":
          input.desiredPropertyType = r.value;
          break;
        case "desired_operation":
          input.desiredOperation = r.value as "buy" | "rent" | "invest";
          break;
        case "timeline":
          notes.push(`Plazo: ${r.value}`);
          break;
      }
    }
    if (notes.length > 0) input.note = notes.join(" · ");

    startTransition(async () => {
      const res = await applyCapturesAction(leadId, input);
      if (res.error) {
        setError(res.error);
        return;
      }
      setStaged([]);
      setSummary("");
      setNotice("Datos aplicados al prospecto.");
      router.refresh();
    });
  }

  const checkedCount = staged.filter((r) => r.checked).length;

  return (
    <>
      <div className={styles.captureBar}>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={runAi}
          disabled={pending || messages.length === 0}
        >
          {pending ? "Analizando…" : "Capturar con IA"}
        </button>
        <span className={styles.mutedText}>
          o resalta texto en la conversación para añadirlo a mano
        </span>
      </div>

      {error ? <p className={styles.formError}>{error}</p> : null}
      {notice ? <p className={styles.captureNotice}>{notice}</p> : null}

      {messages.length > 0 ? (
        <div
          className={styles.chatList}
          ref={transcriptRef}
          onMouseUp={onMouseUp}
        >
          {messages.map((message) => {
            const attachments = Array.isArray(message.media)
              ? (message.media as Array<Record<string, unknown>>).filter(
                  (item) => typeof item.url === "string",
                )
              : [];
            return (
              <div
                className={`${styles.chatBubble} ${
                  message.direction === "inbound"
                    ? styles.chatInbound
                    : styles.chatOutbound
                }`}
                key={message.id}
              >
                {attachments.map((item) =>
                  String(item.mime_type ?? "").startsWith("image/") ? (
                    <a
                      href={item.url as string}
                      target="_blank"
                      rel="noreferrer"
                      key={item.url as string}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- re-hosted whatsapp attachment */}
                      <img
                        src={item.url as string}
                        alt="Adjunto de WhatsApp"
                        className={styles.chatImage}
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      href={item.url as string}
                      target="_blank"
                      rel="noreferrer"
                      key={item.url as string}
                      className={styles.chatAttachment}
                    >
                      📎 {String(item.filename ?? "Adjunto")}
                    </a>
                  ),
                )}
                {message.body ? <p>{message.body}</p> : null}
                <time>{formatDateTime(message.sent_at)}</time>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.mutedText}>
          Cuando este contacto escriba al WhatsApp del equipo, la conversación
          aparecerá aquí automáticamente.
        </p>
      )}

      {staged.length > 0 ? (
        <div className={styles.captureTray}>
          <span className={styles.eyebrow}>Por capturar</span>
          {staged.map((row) => {
            const meta = FIELD_META[row.field];
            return (
              <div className={styles.captureRow} key={row.id}>
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) =>
                    setStaged((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, checked: e.target.checked } : r,
                      ),
                    )
                  }
                  aria-label={`Aplicar ${meta.label}`}
                />
                <div className={styles.captureField}>
                  <span className={styles.captureLabel}>
                    {meta.label}
                    {row.confidence ? (
                      <span className={styles.captureConfidence}>
                        {CONFIDENCE_LABELS[row.confidence]}
                      </span>
                    ) : null}
                  </span>
                  {row.evidence ? (
                    <span className={styles.captureEvidence}>
                      “{row.evidence}”
                    </span>
                  ) : null}
                </div>
                {meta.kind === "operation" ? (
                  <select
                    className={styles.textInput}
                    value={row.value}
                    onChange={(e) =>
                      setStaged((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, value: e.target.value } : r,
                        ),
                      )
                    }
                  >
                    {Object.entries(OPERATION_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={styles.textInput}
                    inputMode={meta.kind === "number" ? "numeric" : "text"}
                    value={row.value}
                    onChange={(e) =>
                      setStaged((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, value: e.target.value } : r,
                        ),
                      )
                    }
                  />
                )}
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() =>
                    setStaged((prev) => prev.filter((r) => r.id !== row.id))
                  }
                  aria-label="Quitar"
                >
                  ×
                </button>
              </div>
            );
          })}
          <div className={styles.captureTrayFoot}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={apply}
              disabled={pending || checkedCount === 0}
            >
              {pending
                ? "Aplicando…"
                : `Aplicar ${checkedCount} ${checkedCount === 1 ? "cambio" : "cambios"}`}
            </button>
          </div>
        </div>
      ) : null}

      {sel ? (
        <div
          className={styles.capturePopover}
          style={{ top: sel.top, left: sel.left }}
        >
          <span className={styles.mutedText}>Añadir a</span>
          <select
            className={styles.textInput}
            value={sel.field}
            onChange={(e) => setSel({ ...sel, field: e.target.value as Field })}
          >
            {FIELD_ORDER.map((f) => (
              <option key={f} value={f}>
                {FIELD_META[f].label}
              </option>
            ))}
          </select>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={addManual}
          >
            Añadir
          </button>
          <button
            className={styles.ghostButton}
            type="button"
            onClick={() => setSel(null)}
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </>
  );
}
