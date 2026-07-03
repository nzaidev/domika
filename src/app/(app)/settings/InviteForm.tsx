"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { createInvitationAction, type InviteFormState } from "./actions";
import { CopyInviteLinkButton } from "./CopyInviteLinkButton";

const initialState: InviteFormState = {
  error: null,
  invitedEmail: null,
  inviteToken: null,
};

export function InviteForm({ canInviteOwners }: { canInviteOwners: boolean }) {
  const [state, formAction, pending] = useActionState(
    createInvitationAction,
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction}>
      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Email del agente</span>
          <input
            className={styles.textInput}
            name="email"
            type="email"
            placeholder="agente@inmobiliaria.com"
            required
            maxLength={160}
          />
        </label>
        <label className={styles.formField}>
          <span>Rol</span>
          <select className={styles.textInput} name="role" defaultValue="agent">
            <option value="agent">Agente</option>
            <option value="admin">Administrador</option>
            {canInviteOwners ? (
              <option value="owner">Propietario</option>
            ) : null}
          </select>
        </label>
      </div>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.invitedEmail && state.inviteToken ? (
        <div className={styles.inviteSuccess}>
          <p className={styles.mutedText}>
            Invitación creada para {state.invitedEmail}. Comparte este enlace
            (válido por 7 días):
          </p>
          <CopyInviteLinkButton token={state.inviteToken} />
        </div>
      ) : null}
      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Creando invitación…" : "Invitar al equipo"}
      </button>
    </form>
  );
}
