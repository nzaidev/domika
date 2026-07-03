"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { parseCsv } from "@/lib/csv";
import type {
  ImportRowAnalysis,
  ImportRowInput,
  ImportRowStatus,
} from "@/lib/domain/lead-import";
import { importLeadsAction, previewImportAction } from "./actions";

type LeadField = "full_name" | "phone" | "email" | "desired_zone" | "notes" | "skip";

const FIELD_OPTIONS: Array<{ value: LeadField; label: string }> = [
  { value: "skip", label: "No importar" },
  { value: "full_name", label: "Nombre completo" },
  { value: "phone", label: "Teléfono / WhatsApp" },
  { value: "email", label: "Email" },
  { value: "desired_zone", label: "Zona de interés" },
  { value: "notes", label: "Notas" },
];

const STATUS_LABELS: Record<ImportRowStatus, string> = {
  new: "Nuevo",
  invalid: "Sin nombre",
  duplicate_in_file: "Repetido en el archivo",
  duplicate_phone: "Ya existe (teléfono)",
  duplicate_email: "Ya existe (email)",
};

function guessField(header: string): LeadField {
  const value = header.toLowerCase();

  if (/nombre|name/.test(value)) return "full_name";
  if (/tel|cel|movil|móvil|phone|whatsapp/.test(value)) return "phone";
  if (/mail|correo/.test(value)) return "email";
  if (/zona|zone|barrio|sector/.test(value)) return "desired_zone";
  if (/nota|notes|comentario|obs/.test(value)) return "notes";
  return "skip";
}

function buildRows(
  data: string[][],
  mapping: LeadField[],
): ImportRowInput[] {
  return data.map((cells) => {
    const row: ImportRowInput = { fullName: "" };

    mapping.forEach((field, columnIndex) => {
      const value = cells[columnIndex]?.trim() ?? "";
      if (!value || field === "skip") {
        return;
      }
      if (field === "full_name") row.fullName = value;
      if (field === "phone") row.phone = value;
      if (field === "email") row.email = value;
      if (field === "desired_zone") row.desiredZone = value;
      if (field === "notes") row.notes = value;
    });

    return row;
  });
}

export function ImportWizard() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<LeadField[]>([]);
  const [preview, setPreview] = useState<ImportRowAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    setPreview(null);
    setDone(null);

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));

      if (parsed.length < 2) {
        setError("El archivo necesita una fila de encabezados y al menos un contacto.");
        setHeaders([]);
        setData([]);
        setMapping([]);
        return;
      }

      const [headerRow, ...rows] = parsed;
      setHeaders(headerRow);
      setData(rows);
      setMapping(headerRow.map(guessField));
    };
    reader.readAsText(file);
  }

  function runPreview() {
    setError(null);
    startTransition(async () => {
      const rows = buildRows(data, mapping);
      const result = await previewImportAction(rows);

      if (result.ok === false) {
        setError(result.error);
        return;
      }

      setPreview(result.rows);
    });
  }

  function runImport() {
    setError(null);
    startTransition(async () => {
      const rows = buildRows(data, mapping);
      const result = await importLeadsAction(rows);

      if (result.ok === false) {
        setError(result.error);
        return;
      }

      setDone({ created: result.created, skipped: result.skipped });
      setPreview(null);
    });
  }

  const importableCount =
    preview?.filter((row) => row.status === "new").length ?? 0;
  const hasFullNameColumn = mapping.includes("full_name");

  if (done) {
    return (
      <div className={styles.formGrid}>
        <div className={styles.inviteSuccess}>
          <p>
            Importación completa: {done.created} prospecto
            {done.created === 1 ? "" : "s"} creado
            {done.created === 1 ? "" : "s"}
            {done.skipped > 0
              ? `, ${done.skipped} omitido${done.skipped === 1 ? "" : "s"} (duplicados o inválidos)`
              : ""}
            .
          </p>
        </div>
        <Link className={styles.primaryButton} href="/leads">
          Ver el embudo
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.formGrid}>
      <label className={styles.formField}>
        <span>Archivo CSV (primera fila: encabezados)</span>
        <input
          className={styles.textInput}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
        />
      </label>

      {headers.length > 0 ? (
        <>
          <div className={styles.fieldList}>
            {headers.map((header, index) => (
              <div className={styles.stageEditRow} key={`${header}-${index}`}>
                <span>
                  <strong>{header || `Columna ${index + 1}`}</strong>
                  <span className={styles.mutedText}>
                    {" "}
                    · ej: {data[0]?.[index]?.slice(0, 40) || "—"}
                  </span>
                </span>
                <select
                  className={styles.textInput}
                  value={mapping[index]}
                  onChange={(event) => {
                    const next = [...mapping];
                    next[index] = event.target.value as LeadField;
                    setMapping(next);
                    setPreview(null);
                  }}
                >
                  {FIELD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!hasFullNameColumn ? (
            <p className={styles.formError}>
              Asigna una columna a “Nombre completo” para continuar.
            </p>
          ) : null}

          <p className={styles.mutedText}>
            {data.length} fila{data.length === 1 ? "" : "s"} detectada
            {data.length === 1 ? "" : "s"}. Los teléfonos sin prefijo
            internacional recibirán +591 automáticamente.
          </p>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={runPreview}
            disabled={pending || !hasFullNameColumn}
          >
            {pending && !preview ? "Verificando…" : "Verificar duplicados"}
          </button>
        </>
      ) : null}

      {error ? <p className={styles.formError}>{error}</p> : null}

      {preview ? (
        <>
          <div className={styles.fieldList}>
            {preview.slice(0, 50).map((row) => (
              <article className={styles.fieldRow} key={row.index}>
                <strong>{row.fullName || "(sin nombre)"}</strong>
                <span>
                  {[row.phone, row.email].filter(Boolean).join(" · ") || "—"}
                </span>
                <span
                  className={
                    row.status === "new" ? undefined : styles.mutedText
                  }
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </article>
            ))}
            {preview.length > 50 ? (
              <p className={styles.mutedText}>
                … y {preview.length - 50} filas más.
              </p>
            ) : null}
          </div>

          <button
            className={styles.primaryButton}
            type="button"
            onClick={runImport}
            disabled={pending || importableCount === 0}
          >
            {pending
              ? "Importando…"
              : `Importar ${importableCount} prospecto${importableCount === 1 ? "" : "s"}`}
          </button>
        </>
      ) : null}
    </div>
  );
}
