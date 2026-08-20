"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { PipelineStageRow } from "@/lib/database.types";
import type { BoardLead } from "@/lib/domain/leads";
import { restoreToPipelineAction } from "./actions";

// Contacts are leads parked outside the funnel. From here they can be sent back
// into the pipeline at any stage.
export function ContactsList({
  contacts,
  stages,
}: {
  contacts: BoardLead[];
  stages: PipelineStageRow[];
}) {
  const [rows, setRows] = useState(contacts);
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function restore(leadId: string, stageId?: string) {
    setError(null);
    setOpenFor(null);
    startTransition(async () => {
      const res = await restoreToPipelineAction(leadId, stageId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRows((prev) => prev.filter((c) => c.id !== leadId));
    });
  }

  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>Todavía no hay contactos</h2>
        <p className={styles.mutedText}>
          Cuando saques un prospecto del embudo, aparecerá aquí — con su
          historial, etiquetas y conversaciones intactos.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.contactsWrap}>
      {error ? <p className={styles.formError}>{error}</p> : null}
      <table className={styles.contactsTable}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Origen</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((contact) => (
            <tr key={contact.id}>
              <td>
                <Link
                  className={styles.contactName}
                  href={`/leads/${contact.id}`}
                >
                  {contact.full_name}
                </Link>
                {contact.tags.length > 0 ? (
                  <span className={styles.contactTags}>
                    {contact.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className={styles.contactTag}
                        style={{ background: tag.color ?? undefined }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </span>
                ) : null}
              </td>
              <td>{contact.phone ?? "—"}</td>
              <td>{contact.email ?? "—"}</td>
              <td>{contact.source}</td>
              <td className={styles.contactActionCell}>
                {openFor === contact.id ? (
                  <span className={styles.contactStagePick}>
                    {stages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        className={styles.contactStageBtn}
                        disabled={pending}
                        onClick={() => restore(contact.id, stage.id)}
                      >
                        {stage.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={styles.contactCancel}
                      onClick={() => setOpenFor(null)}
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.contactRestoreBtn}
                    disabled={pending}
                    onClick={() =>
                      stages.length > 1
                        ? setOpenFor(contact.id)
                        : restore(contact.id)
                    }
                  >
                    Mover al embudo
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
