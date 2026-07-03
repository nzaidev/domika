"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import {
  acceptInvitationAction,
  type AcceptInviteFormState,
} from "./actions";

const initialState: AcceptInviteFormState = { error: null };

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction}>
      <input type="hidden" name="token" value={token} />
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Uniéndote al equipo…" : "Aceptar invitación"}
      </button>
    </form>
  );
}
