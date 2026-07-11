"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { publicInquiryAction, type PublicInquiryState } from "./actions";

const initialState: PublicInquiryState = { error: null, sent: false };

export function InquiryForm({
  slug,
  organizationName,
}: {
  slug: string;
  organizationName: string;
}) {
  const [state, formAction, pending] = useActionState(
    publicInquiryAction,
    initialState,
  );

  if (state.sent) {
    return (
      <div className={styles.inviteSuccess}>
        <p>
          ¡Consulta enviada! {organizationName} te contactará a la brevedad.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.formGrid} action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      {/* Honeypot — hidden from humans, filled by bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0 }}
      />

      <label className={styles.formField}>
        <span>Tu nombre</span>
        <input
          className={styles.textInput}
          name="fullName"
          required
          minLength={2}
          maxLength={120}
          placeholder="Nombre y apellido"
        />
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Teléfono / WhatsApp</span>
          <input
            className={styles.textInput}
            name="phone"
            type="tel"
            maxLength={30}
            placeholder="+591 700 00000"
          />
        </label>
        <label className={styles.formField}>
          <span>Email</span>
          <input
            className={styles.textInput}
            name="email"
            type="email"
            maxLength={160}
            placeholder="nombre@correo.com"
          />
        </label>
      </div>

      <label className={styles.formField}>
        <span>Mensaje (opcional)</span>
        <textarea
          className={styles.textArea}
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="Me interesa esta propiedad, ¿podemos coordinar una visita?"
        />
      </label>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Quiero más información"}
      </button>
    </form>
  );
}
