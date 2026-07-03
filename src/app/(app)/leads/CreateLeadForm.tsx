"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { createLeadAction, type CreateLeadFormState } from "./actions";

const initialState: CreateLeadFormState = {
  error: null,
  createdLeadName: null,
};

export function CreateLeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: CreateLeadFormState, formData: FormData) => {
      const next = await createLeadAction(previous, formData);
      if (!next.error) {
        formRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction} ref={formRef}>
      <label className={styles.formField}>
        <span>Nombre completo</span>
        <input
          className={styles.textInput}
          name="fullName"
          placeholder="Ej. Patricia Gómez"
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Teléfono / WhatsApp</span>
          <input
            className={styles.textInput}
            name="phone"
            type="tel"
            placeholder="+591 700 00000"
            maxLength={30}
          />
        </label>
        <label className={styles.formField}>
          <span>Email</span>
          <input
            className={styles.textInput}
            name="email"
            type="email"
            placeholder="nombre@correo.com"
            maxLength={160}
          />
        </label>
      </div>
      <label className={styles.formField}>
        <span>Zona de interés</span>
        <input
          className={styles.textInput}
          name="desiredZone"
          placeholder="Ej. Equipetrol"
          maxLength={120}
        />
      </label>
      <label className={styles.formField}>
        <span>Notas</span>
        <input
          className={styles.textInput}
          name="notes"
          placeholder="Contexto del contacto"
          maxLength={500}
        />
      </label>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.createdLeadName ? (
        <p className={styles.mutedText}>
          {state.createdLeadName} se agregó a la etapa inicial del embudo.
        </p>
      ) : null}
      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Agregar prospecto"}
      </button>
    </form>
  );
}
