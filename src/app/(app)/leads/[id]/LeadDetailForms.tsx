"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { PipelineStageRow } from "@/lib/database.types";
import {
  addLeadNoteAction,
  changeLeadStageAction,
  type LeadDetailFormState,
} from "./actions";

const initialState: LeadDetailFormState = { error: null };

export function StageForm({
  leadId,
  stages,
  currentStageId,
}: {
  leadId: string;
  stages: PipelineStageRow[];
  currentStageId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    changeLeadStageAction,
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <label className={styles.formField}>
        <span>Etapa del embudo</span>
        <select
          className={styles.textInput}
          name="stageId"
          defaultValue={currentStageId ?? ""}
          key={currentStageId ?? "none"}
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button className={styles.secondaryButton} type="submit" disabled={pending}>
        {pending ? "Moviendo…" : "Mover de etapa"}
      </button>
    </form>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: LeadDetailFormState, formData: FormData) => {
      const next = await addLeadNoteAction(previous, formData);
      if (!next.error) {
        formRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction} ref={formRef}>
      <input type="hidden" name="leadId" value={leadId} />
      <label className={styles.formField}>
        <span>Agregar nota</span>
        <textarea
          className={styles.textArea}
          name="body"
          placeholder="Ej. Pidió visitar el sábado por la mañana."
          rows={3}
          required
          maxLength={2000}
        />
      </label>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button className={styles.secondaryButton} type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar nota"}
      </button>
    </form>
  );
}
