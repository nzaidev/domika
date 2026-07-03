"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import {
  completeOnboardingAction,
  type OnboardingFormState,
} from "./actions";

const initialState: OnboardingFormState = { error: null };

export function OnboardingForm({
  defaultFullName,
}: {
  defaultFullName?: string;
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction}>
      <label className={styles.formField}>
        <span>Nombre de la inmobiliaria u organización</span>
        <input
          className={styles.textInput}
          name="organizationName"
          placeholder="Ej. SAILE Business Group"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label className={styles.formField}>
        <span>Tu nombre completo</span>
        <input
          className={styles.textInput}
          name="fullName"
          defaultValue={defaultFullName}
          placeholder="Ej. María Fernández"
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label className={styles.formField}>
        <span>Teléfono (opcional)</span>
        <input
          className={styles.textInput}
          name="phone"
          type="tel"
          placeholder="+591 700 00000"
          maxLength={30}
        />
      </label>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Creando espacio de trabajo…" : "Crear organización"}
      </button>
    </form>
  );
}
