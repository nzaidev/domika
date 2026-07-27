"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { createTagAction, type TagFormState } from "./actions";

const initialState: TagFormState = { error: null, created: false };

const SWATCHES = [
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#EF4444",
  "#14B8A6",
  "#6366F1",
];

export function NewTagForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: TagFormState, formData: FormData) => {
      const next = await createTagAction(previous, formData);
      if (next.created) {
        formRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction} ref={formRef}>
      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Nombre de la etiqueta</span>
          <input
            className={styles.textInput}
            name="name"
            placeholder="Ej. Inversionista, Turista, AirBNB, Comprador"
            required
            minLength={2}
            maxLength={40}
          />
        </label>
        <label className={styles.formField}>
          <span>Color</span>
          <input
            className={styles.colorInput}
            name="color"
            type="color"
            defaultValue={SWATCHES[0]}
            list="tag-swatches"
          />
          <datalist id="tag-swatches">
            {SWATCHES.map((color) => (
              <option value={color} key={color} />
            ))}
          </datalist>
        </label>
      </div>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.created ? (
        <p className={styles.mutedText}>Etiqueta creada.</p>
      ) : null}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear etiqueta"}
      </button>
    </form>
  );
}
