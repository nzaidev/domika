"use client";

import { useActionState, useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { BrochureTemplateRow } from "@/lib/database.types";
import {
  BROCHURE_SECTIONS,
  DEFAULT_LAYOUT,
  SECTION_LABELS,
  type BrochureSection,
} from "@/lib/brochures/types";
import {
  generateBrochureAction,
  type BrochureStudioState,
} from "./actions";

const initialState: BrochureStudioState = {
  error: null,
  url: null,
  format: null,
  savedTemplate: null,
};

export function BrochureStudio({
  properties,
  templates,
  defaultPropertyId,
}: {
  properties: Array<{ id: string; title: string }>;
  templates: BrochureTemplateRow[];
  defaultPropertyId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    generateBrochureAction,
    initialState,
  );
  const [sections, setSections] = useState<BrochureSection[]>(
    DEFAULT_LAYOUT.sections,
  );
  const [templateId, setTemplateId] = useState("");

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((entry) => entry.id === id);
    const layout = template?.layout as
      | { sections?: BrochureSection[] }
      | undefined;

    if (layout?.sections?.length) {
      setSections(
        layout.sections.filter((section) =>
          BROCHURE_SECTIONS.includes(section),
        ),
      );
    }
  }

  function toggleSection(section: BrochureSection) {
    setSections((current) =>
      current.includes(section)
        ? current.filter((entry) => entry !== section)
        : [...current, section],
    );
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) {
      return;
    }
    setSections((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form className={styles.formGrid} action={formAction}>
      <input type="hidden" name="templateId" value={templateId} />
      {sections.map((section) => (
        <input type="hidden" name="sections" value={section} key={section} />
      ))}

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Propiedad</span>
          <select
            className={styles.textInput}
            name="propertyId"
            defaultValue={defaultPropertyId ?? ""}
            required
          >
            <option value="" disabled>
              Selecciona una propiedad…
            </option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.formField}>
          <span>Formato</span>
          <select className={styles.textInput} name="format" defaultValue="pdf">
            <option value="pdf">Folleto PDF (A4)</option>
            <option value="flyer">Flyer WhatsApp (imagen vertical)</option>
          </select>
        </label>
      </div>

      {templates.length > 0 ? (
        <label className={styles.formField}>
          <span>Plantilla</span>
          <select
            className={styles.textInput}
            value={templateId}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            <option value="">Diseño personalizado</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className={styles.formField}>
        <span>Secciones (en orden)</span>
        <div className={styles.fieldList}>
          {sections.map((section, index) => (
            <div className={styles.stageEditRow} key={section}>
              <span>{SECTION_LABELS[section]}</span>
              <div className={styles.stageEditActions}>
                <button
                  className={styles.ghostButton}
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveSection(index, -1)}
                  aria-label="Subir sección"
                >
                  ↑
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  disabled={index === sections.length - 1}
                  onClick={() => moveSection(index, 1)}
                  aria-label="Bajar sección"
                >
                  ↓
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  disabled={sections.length <= 1}
                  onClick={() => toggleSection(section)}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          {BROCHURE_SECTIONS.filter(
            (section) => !sections.includes(section),
          ).map((section) => (
            <div className={styles.stageEditRow} key={section}>
              <span className={styles.mutedText}>{SECTION_LABELS[section]}</span>
              <button
                className={styles.ghostButton}
                type="button"
                onClick={() => toggleSection(section)}
              >
                Agregar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Guardar diseño como plantilla (opcional)</span>
          <input
            className={styles.textInput}
            name="templateName"
            placeholder="Ej. Flyer premium"
            maxLength={80}
          />
        </label>
        <div className={styles.formField}>
          <span>&nbsp;</span>
          <button
            className={styles.secondaryButton}
            type="submit"
            name="intent"
            value="save_template"
            disabled={pending}
          >
            Guardar plantilla
          </button>
        </div>
      </div>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.savedTemplate ? (
        <p className={styles.mutedText}>
          Plantilla “{state.savedTemplate}” guardada.
        </p>
      ) : null}

      {state.url ? (
        <div className={styles.inviteSuccess}>
          <p>
            {state.format === "flyer"
              ? "Flyer generado — listo para WhatsApp:"
              : "Folleto PDF generado:"}
          </p>
          {state.format === "flyer" ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated asset preview
            <img
              src={state.url}
              alt="Flyer generado"
              className={styles.flyerPreview}
            />
          ) : null}
          <a
            className={styles.primaryButton}
            href={state.url}
            target="_blank"
            rel="noreferrer"
          >
            {state.format === "flyer" ? "Abrir imagen" : "Abrir PDF"}
          </a>
        </div>
      ) : null}

      <button
        className={styles.primaryButton}
        type="submit"
        name="intent"
        value="generate"
        disabled={pending}
      >
        {pending ? "Generando…" : "Generar"}
      </button>
    </form>
  );
}
