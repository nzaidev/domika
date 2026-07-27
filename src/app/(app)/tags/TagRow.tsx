"use client";

import { useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { TagWithCount } from "@/lib/domain/tags";
import { deleteTagAction, updateTagAction } from "./actions";

export function TagRow({ tag }: { tag: TagWithCount }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <>
        <form
          className={styles.tagEditRow}
          action={(formData) => {
            startTransition(async () => {
              const result = await updateTagAction(formData);
              if (result.error) {
                setError(result.error);
              } else {
                // Persisted + revalidated → close and show the updated chip.
                setError(null);
                setEditing(false);
              }
            });
          }}
        >
          <input type="hidden" name="tagId" value={tag.id} />
          <input
            className={styles.colorInput}
            name="color"
            type="color"
            defaultValue={tag.color}
            style={{ width: 44 }}
          />
          <input
            className={styles.textInput}
            name="name"
            defaultValue={tag.name}
            required
            minLength={2}
            maxLength={40}
          />
          <button
            className={styles.secondaryButton}
            type="submit"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            className={styles.ghostButton}
            type="button"
            onClick={() => {
              setError(null);
              setEditing(false);
            }}
          >
            Cancelar
          </button>
        </form>
        {error ? <p className={styles.formError}>{error}</p> : null}
      </>
    );
  }

  return (
    <article className={styles.tagRow}>
      <span className={styles.tagChip} style={{ background: tag.color }}>
        {tag.name}
      </span>
      <span className={styles.mutedText}>
        {tag.leadCount} prospecto{tag.leadCount === 1 ? "" : "s"}
      </span>
      <div className={styles.inviteRowActions}>
        <button
          className={styles.ghostButton}
          type="button"
          onClick={() => setEditing(true)}
        >
          Editar
        </button>
        <form
          action={deleteTagAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `¿Eliminar la etiqueta "${tag.name}"? Se quitará de ${tag.leadCount} prospecto${tag.leadCount === 1 ? "" : "s"}.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="tagId" value={tag.id} />
          <button className={styles.ghostButton} type="submit">
            Eliminar
          </button>
        </form>
      </div>
    </article>
  );
}
