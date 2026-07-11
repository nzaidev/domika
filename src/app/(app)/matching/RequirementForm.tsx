"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import {
  createRequirementAction,
  type RequirementFormState,
} from "./actions";

const initialState: RequirementFormState = { error: null, created: false };

const PROPERTY_TYPES = [
  "Casa",
  "Departamento",
  "Terreno",
  "Oficina",
  "Local comercial",
  "Otro",
];

export function RequirementForm({
  leadOptions,
}: {
  leadOptions: Array<{ id: string; full_name: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: RequirementFormState, formData: FormData) => {
      const next = await createRequirementAction(previous, formData);
      if (next.created) {
        formRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction} ref={formRef}>
      <label className={styles.formField}>
        <span>Prospecto (opcional)</span>
        <select className={styles.textInput} name="leadId" defaultValue="">
          <option value="">Búsqueda independiente</option>
          {leadOptions.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.full_name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Tipo</span>
          <select
            className={styles.textInput}
            name="propertyType"
            defaultValue=""
          >
            <option value="">Cualquiera</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.formField}>
          <span>Operación</span>
          <select className={styles.textInput} name="operation" defaultValue="">
            <option value="">Cualquiera</option>
            <option value="sale">Compra</option>
            <option value="rent">Alquiler</option>
            <option value="investment">Inversión</option>
          </select>
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
          />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Ciudad</span>
          <input className={styles.textInput} name="city" maxLength={80} />
        </label>
        <label className={styles.formField}>
          <span>Zona</span>
          <input className={styles.textInput} name="zone" maxLength={80} />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Dormitorios mín.</span>
          <input
            className={styles.textInput}
            name="bedroomsMin"
            type="number"
            min={0}
            step="1"
          />
        </label>
        <label className={styles.formField}>
          <span>Superficie mín. (m²)</span>
          <input
            className={styles.textInput}
            name="areaMinSqm"
            type="number"
            min={0}
            step="1"
          />
        </label>
      </div>

      <label className={styles.formField}>
        <span>Notas</span>
        <input
          className={styles.textInput}
          name="notes"
          placeholder="Ej. Cliente busca mudarse antes de fin de año"
          maxLength={300}
        />
      </label>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.created ? (
        <p className={styles.mutedText}>
          Requerimiento creado — coincidencias calculadas.
        </p>
      ) : null}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Buscando coincidencias…" : "Crear requerimiento"}
      </button>
    </form>
  );
}
