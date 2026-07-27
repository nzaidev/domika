"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { LeadTagRow } from "@/lib/database.types";
import { assignTagAction, unassignTagAction } from "./actions";

export function LeadTags({
  leadId,
  tags,
  allTags,
}: {
  leadId: string;
  tags: LeadTagRow[];
  allTags: LeadTagRow[];
}) {
  const assignedIds = new Set(tags.map((tag) => tag.id));
  const available = allTags.filter((tag) => !assignedIds.has(tag.id));
  const [adding, setAdding] = useState(false);

  return (
    <div className={styles.formGrid}>
      {tags.length > 0 ? (
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <form action={unassignTagAction} key={tag.id}>
              <input type="hidden" name="leadId" value={leadId} />
              <input type="hidden" name="tagId" value={tag.id} />
              <button
                className={styles.tagRemoveChip}
                style={{ background: tag.color }}
                type="submit"
                title="Quitar etiqueta"
              >
                {tag.name} <span aria-hidden>✕</span>
              </button>
            </form>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>Sin etiquetas.</p>
      )}

      {allTags.length === 0 ? (
        <p className={styles.mutedText}>
          Crea etiquetas en <Link href="/tags">Etiquetas</Link> para clasificar
          este contacto.
        </p>
      ) : available.length === 0 ? null : adding ? (
        <form action={assignTagAction} className={styles.tagAddRow}>
          <input type="hidden" name="leadId" value={leadId} />
          <select
            className={styles.textInput}
            name="tagId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Elige una etiqueta…
            </option>
            {available.map((tag) => (
              <option value={tag.id} key={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <button className={styles.secondaryButton} type="submit">
            Agregar
          </button>
        </form>
      ) : (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => setAdding(true)}
        >
          + Agregar etiqueta
        </button>
      )}
    </div>
  );
}
