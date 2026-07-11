"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { LeadRow } from "@/lib/database.types";
import { updateLeadAction, type LeadDetailFormState } from "./actions";

const initialState: LeadDetailFormState = { error: null };

export function EditLeadForm({
  lead,
  members,
}: {
  lead: LeadRow;
  members: Array<{ id: string; full_name: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    updateLeadAction,
    initialState,
  );

  return (
    <details className={styles.editDetails}>
      <summary className={styles.secondaryButton}>Editar contacto</summary>
      <form className={styles.formGrid} action={formAction}>
        <input type="hidden" name="leadId" value={lead.id} />

        <label className={styles.formField}>
          <span>Nombre completo</span>
          <input
            className={styles.textInput}
            name="fullName"
            defaultValue={lead.full_name}
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
              defaultValue={lead.phone ?? ""}
              maxLength={30}
            />
          </label>
          <label className={styles.formField}>
            <span>Email</span>
            <input
              className={styles.textInput}
              name="email"
              type="email"
              defaultValue={lead.email ?? ""}
              maxLength={160}
            />
          </label>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Zona de interés</span>
            <input
              className={styles.textInput}
              name="desiredZone"
              defaultValue={lead.desired_zone ?? ""}
              maxLength={120}
            />
          </label>
          <label className={styles.formField}>
            <span>Tipo buscado</span>
            <input
              className={styles.textInput}
              name="desiredPropertyType"
              defaultValue={lead.desired_property_type ?? ""}
              maxLength={80}
            />
          </label>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Presupuesto mín.</span>
            <input
              className={styles.textInput}
              name="budgetMin"
              type="number"
              min={0}
              step="0.01"
              defaultValue={lead.budget_min ?? ""}
            />
          </label>
          <label className={styles.formField}>
            <span>Presupuesto máx.</span>
            <input
              className={styles.textInput}
              name="budgetMax"
              type="number"
              min={0}
              step="0.01"
              defaultValue={lead.budget_max ?? ""}
            />
          </label>
        </div>

        <label className={styles.formField}>
          <span>Responsable</span>
          <select
            className={styles.textInput}
            name="assignedTo"
            defaultValue={lead.assigned_to ?? ""}
          >
            <option value="">Sin asignar</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </select>
        </label>

        {state.error ? <p className={styles.formError}>{state.error}</p> : null}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </details>
  );
}
