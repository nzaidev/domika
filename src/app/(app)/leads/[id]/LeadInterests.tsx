"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { InterestProperty } from "@/lib/domain/interests";
import { formatPrice } from "@/app/(app)/properties/labels";
import { addInterestAction, removeInterestAction } from "./actions";

export function LeadInterests({
  leadId,
  linked,
  options,
}: {
  leadId: string;
  linked: InterestProperty[];
  options: Array<{ id: string; title: string }>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className={styles.leadTagsBlock}>
      <span className={styles.eyebrow}>Propiedades de interés</span>

      {linked.length > 0 ? (
        <div className={styles.fieldList}>
          {linked.map((p) => (
            <article className={styles.interestRow} key={p.interestId}>
              <div className={styles.photoMeta}>
                <strong>
                  <Link href={`/properties/${p.propertyId}`}>{p.title}</Link>
                </strong>
                <span className={styles.mutedText}>
                  {[
                    formatPrice(p.price, p.currency),
                    [p.zone, p.city].filter(Boolean).join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <form action={removeInterestAction}>
                <input type="hidden" name="leadId" value={leadId} />
                <input type="hidden" name="propertyId" value={p.propertyId} />
                <button className={styles.ghostButton} type="submit">
                  Quitar
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>Sin propiedades vinculadas.</p>
      )}

      {options.length === 0 ? null : adding ? (
        <form action={addInterestAction} className={styles.tagAddRow}>
          <input type="hidden" name="leadId" value={leadId} />
          <select
            className={styles.textInput}
            name="propertyId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Elige una propiedad…
            </option>
            {options.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button className={styles.secondaryButton} type="submit">
            Vincular
          </button>
        </form>
      ) : (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => setAdding(true)}
        >
          + Vincular propiedad
        </button>
      )}
    </div>
  );
}
