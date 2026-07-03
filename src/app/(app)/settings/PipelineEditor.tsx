"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { PipelineStageRow } from "@/lib/database.types";
import { pipelineAction, type PipelineFormState } from "./actions";

const initialState: PipelineFormState = { error: null };

export function PipelineEditor({ stages }: { stages: PipelineStageRow[] }) {
  const addFormRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: PipelineFormState, formData: FormData) => {
      const next = await pipelineAction(previous, formData);
      if (!next.error && formData.get("intent") === "add") {
        addFormRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <div className={styles.formGrid}>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}

      <div className={styles.fieldList}>
        {stages.map((stage, index) => (
          <form className={styles.stageEditRow} action={formAction} key={stage.id}>
            <input type="hidden" name="stageId" value={stage.id} />
            <input
              className={styles.textInput}
              name="name"
              defaultValue={stage.name}
              maxLength={60}
              aria-label={`Nombre de la etapa ${stage.name}`}
            />
            <div className={styles.stageEditActions}>
              <button
                className={styles.secondaryButton}
                type="submit"
                name="intent"
                value="rename"
                disabled={pending}
              >
                Renombrar
              </button>
              <button
                className={styles.ghostButton}
                type="submit"
                name="intent"
                value="move_up"
                disabled={pending || index === 0}
                aria-label="Subir etapa"
              >
                ↑
              </button>
              <button
                className={styles.ghostButton}
                type="submit"
                name="intent"
                value="move_down"
                disabled={pending || index === stages.length - 1}
                aria-label="Bajar etapa"
              >
                ↓
              </button>
              <button
                className={styles.ghostButton}
                type="submit"
                name="intent"
                value="delete"
                disabled={pending || stages.length <= 1}
              >
                Eliminar
              </button>
            </div>
          </form>
        ))}
      </div>

      <form className={styles.stageEditRow} action={formAction} ref={addFormRef}>
        <input
          className={styles.textInput}
          name="name"
          placeholder="Nueva etapa (ej. Visita agendada)"
          required
          minLength={2}
          maxLength={60}
        />
        <button
          className={styles.primaryButton}
          type="submit"
          name="intent"
          value="add"
          disabled={pending}
        >
          Agregar etapa
        </button>
      </form>
    </div>
  );
}
