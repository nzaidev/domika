"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { InterestedLead } from "@/lib/domain/interests";
import {
  addInterestAction,
  removeInterestAction,
} from "@/app/(app)/leads/[id]/actions";

export function PropertyInterests({
  propertyId,
  linked,
  options,
}: {
  propertyId: string;
  linked: InterestedLead[];
  options: Array<{ id: string; full_name: string }>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className={styles.formGrid}>
      {linked.length > 0 ? (
        <div className={styles.fieldList}>
          {linked.map((lead) => (
            <article className={styles.interestRow} key={lead.interestId}>
              <div className={styles.photoMeta}>
                <strong>
                  <Link href={`/leads/${lead.leadId}`}>{lead.fullName}</Link>
                </strong>
                <span className={styles.mutedText}>
                  {[lead.stageName, lead.phone].filter(Boolean).join(" · ") ||
                    "Prospecto"}
                </span>
              </div>
              <form action={removeInterestAction}>
                <input type="hidden" name="leadId" value={lead.leadId} />
                <input type="hidden" name="propertyId" value={propertyId} />
                <button className={styles.ghostButton} type="submit">
                  Quitar
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>
          Ningún prospecto vinculado como comprador potencial.
        </p>
      )}

      {options.length === 0 ? (
        <p className={styles.mutedText}>
          Crea prospectos para vincularlos a esta propiedad.
        </p>
      ) : adding ? (
        <form action={addInterestAction} className={styles.tagAddRow}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <select
            className={styles.textInput}
            name="leadId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Elige un prospecto…
            </option>
            {options.map((lead) => (
              <option value={lead.id} key={lead.id}>
                {lead.full_name}
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
          + Vincular prospecto
        </button>
      )}
    </div>
  );
}
