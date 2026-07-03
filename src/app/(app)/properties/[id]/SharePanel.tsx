"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import {
  sharePropertyAction,
  type ShareFormState,
} from "@/app/(app)/network/actions";
import type { Directory } from "@/lib/domain/network";

const initialState: ShareFormState = { error: null, shared: false };

export function SharePanel({
  propertyId,
  directory,
}: {
  propertyId: string;
  directory: Directory;
}) {
  const [state, formAction, pending] = useActionState(
    sharePropertyAction,
    initialState,
  );

  const hasRecipients =
    directory.organizations.length > 0 || directory.agents.length > 0;

  if (!hasRecipients) {
    return (
      <p className={styles.mutedText}>
        Todavía no hay otras organizaciones en la red para compartir.
      </p>
    );
  }

  return (
    <form className={styles.formGrid} action={formAction}>
      <input type="hidden" name="propertyId" value={propertyId} />

      <label className={styles.formField}>
        <span>Compartir con</span>
        <select className={styles.textInput} name="recipient" defaultValue="">
          <option value="" disabled>
            Selecciona destinatario…
          </option>
          {directory.organizations.length > 0 ? (
            <optgroup label="Organizaciones (todo su equipo)">
              {directory.organizations.map((org) => (
                <option key={org.id} value={`org:${org.id}`}>
                  {org.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {directory.agents.length > 0 ? (
            <optgroup label="Agentes">
              {directory.agents.map((agent) => (
                <option key={agent.id} value={`agent:${agent.id}`}>
                  {agent.name} · {agent.organizationName}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Permiso</span>
          <select
            className={styles.textInput}
            name="permission"
            defaultValue="view_without_owner"
          >
            <option value="view_without_owner">Ver (sin datos del propietario)</option>
            <option value="view">Ver ficha</option>
            <option value="full">Completo (incluye propietario)</option>
          </select>
        </label>
        <label className={styles.formField}>
          <span>Expira en (días, 0 = nunca)</span>
          <input
            className={styles.textInput}
            name="expiresDays"
            type="number"
            min={0}
            step={1}
            defaultValue={30}
          />
        </label>
      </div>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.shared ? (
        <p className={styles.mutedText}>Propiedad compartida.</p>
      ) : null}

      <button className={styles.secondaryButton} type="submit" disabled={pending}>
        {pending ? "Compartiendo…" : "Compartir propiedad"}
      </button>
    </form>
  );
}
