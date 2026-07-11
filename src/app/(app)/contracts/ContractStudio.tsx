"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { ContractTemplateRow } from "@/lib/database.types";
import {
  contractStudioAction,
  type ContractFormState,
} from "./actions";

const initialState: ContractFormState = {
  error: null,
  generatedId: null,
  missing: [],
  savedTemplate: false,
};

const CONTRACT_TYPES = [
  "captación",
  "reserva",
  "alquiler",
  "promesa",
  "comisión",
];

const VARIABLE_HINT =
  "{{lead_name}} {{lead_phone}} {{lead_email}} {{property_title}} {{property_address}} {{property_price}} {{owner_name}} {{owner_phone}} {{organization_name}} {{agent_name}} {{agent_phone}} {{date}}";

export function ContractStudio({
  templates,
  leadOptions,
  propertyOptions,
}: {
  templates: ContractTemplateRow[];
  leadOptions: Array<{ id: string; full_name: string }>;
  propertyOptions: Array<{ id: string; title: string }>;
}) {
  const templateFormRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: ContractFormState, formData: FormData) => {
      const next = await contractStudioAction(previous, formData);
      if (next.savedTemplate) {
        templateFormRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <div className={styles.formGrid}>
      <form className={styles.formGrid} action={formAction}>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Plantilla</span>
            <select
              className={styles.textInput}
              name="templateId"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Selecciona plantilla…
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.contract_type})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Prospecto</span>
            <select className={styles.textInput} name="leadId" defaultValue="">
              <option value="">Sin prospecto</option>
              {leadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.formField}>
            <span>Propiedad</span>
            <select
              className={styles.textInput}
              name="propertyId"
              defaultValue=""
            >
              <option value="">Sin propiedad</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state.error ? <p className={styles.formError}>{state.error}</p> : null}
        {state.generatedId ? (
          <div className={styles.inviteSuccess}>
            <p>
              Contrato generado.
              {state.missing.length > 0
                ? ` Campos sin datos (quedaron como “________”): ${state.missing.join(", ")}.`
                : " Todos los campos se completaron."}
            </p>
          </div>
        ) : null}

        <button
          className={styles.primaryButton}
          type="submit"
          name="intent"
          value="generate"
          disabled={pending || templates.length === 0}
        >
          {pending ? "Generando…" : "Generar contrato PDF"}
        </button>
      </form>

      <form
        className={styles.formGrid}
        action={formAction}
        ref={templateFormRef}
      >
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Nueva plantilla</span>
            <h2>Crear plantilla de contrato</h2>
          </div>
        </div>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Nombre</span>
            <input
              className={styles.textInput}
              name="templateName"
              placeholder="Ej. Reserva estándar"
              maxLength={120}
            />
          </label>
          <label className={styles.formField}>
            <span>Tipo</span>
            <select
              className={styles.textInput}
              name="contractType"
              defaultValue="reserva"
            >
              {CONTRACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.formField}>
          <span>Cuerpo — usa variables entre llaves dobles</span>
          <textarea
            className={styles.textArea}
            name="templateBody"
            rows={8}
            placeholder={`En la ciudad de {{property_city}}, a {{date}}, entre {{organization_name}} representada por {{agent_name}} y {{lead_name}}...\n\nVariables: ${VARIABLE_HINT}`}
          />
        </label>
        <p className={styles.mutedText}>Variables disponibles: {VARIABLE_HINT}</p>
        {state.savedTemplate ? (
          <p className={styles.mutedText}>Plantilla guardada.</p>
        ) : null}
        <button
          className={styles.secondaryButton}
          type="submit"
          name="intent"
          value="save_template"
          disabled={pending}
        >
          Guardar plantilla
        </button>
      </form>
    </div>
  );
}
