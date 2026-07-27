"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { BrochureTemplateRow } from "@/lib/database.types";
import {
  BROCHURE_SECTIONS,
  DEFAULT_LAYOUT,
  MAX_GALLERY_PHOTOS,
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

type PropertyMedia = {
  id: string;
  url: string;
  isCover: boolean;
  position: number;
};

type Branding = {
  organizationName: string;
  brandColor: string;
  logoUrl: string | null;
};

function defaultHeroId(media: PropertyMedia[]): string {
  return media.find((item) => item.isCover)?.id ?? media[0]?.id ?? "";
}

function defaultStripIds(media: PropertyMedia[], heroId: string): string[] {
  return media
    .filter((item) => item.id !== heroId)
    .slice(0, MAX_GALLERY_PHOTOS)
    .map((item) => item.id);
}

export function BrochureStudio({
  properties,
  templates,
  defaultPropertyId,
  branding,
}: {
  properties: Array<{ id: string; title: string }>;
  templates: BrochureTemplateRow[];
  defaultPropertyId?: string;
  branding: Branding;
}) {
  const [state, formAction, pending] = useActionState(
    generateBrochureAction,
    initialState,
  );
  const [sections, setSections] = useState<BrochureSection[]>(
    DEFAULT_LAYOUT.sections,
  );
  const [templateId, setTemplateId] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? "");
  const [media, setMedia] = useState<PropertyMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [heroMediaId, setHeroMediaId] = useState("");
  const [stripMediaIds, setStripMediaIds] = useState<string[]>([]);

  useEffect(() => {
    if (!propertyId) {
      setMedia([]);
      setHeroMediaId("");
      setStripMediaIds([]);
      return;
    }

    let cancelled = false;
    setMediaLoading(true);

    fetch(`/api/brochures/properties/${propertyId}/media`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { media?: PropertyMedia[] } | null) => {
        if (cancelled) {
          return;
        }
        const rows = payload?.media ?? [];
        setMedia(rows);
        const hero = defaultHeroId(rows);
        setHeroMediaId(hero);
        setStripMediaIds(defaultStripIds(rows, hero));
      })
      .finally(() => {
        if (!cancelled) {
          setMediaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const stripSet = useMemo(() => new Set(stripMediaIds), [stripMediaIds]);

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

  function setHero(id: string) {
    setHeroMediaId(id);
    setStripMediaIds((current) => {
      const withoutHero = current.filter((entry) => entry !== id);
      if (withoutHero.length > 0) {
        return withoutHero.slice(0, MAX_GALLERY_PHOTOS);
      }
      return defaultStripIds(media, id);
    });
  }

  function toggleStrip(id: string) {
    if (id === heroMediaId) {
      return;
    }
    setStripMediaIds((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      if (current.length >= MAX_GALLERY_PHOTOS) {
        return current;
      }
      return [...current, id];
    });
  }

  const whatsappShareUrl =
    state.url && state.format === "flyer"
      ? `https://wa.me/?text=${encodeURIComponent(`Mira esta propiedad: ${state.url}`)}`
      : null;

  return (
    <form className={styles.formGrid} action={formAction}>
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="heroMediaId" value={heroMediaId} />
      {stripMediaIds.map((id) => (
        <input type="hidden" name="stripMediaIds" value={id} key={id} />
      ))}
      {sections.map((section) => (
        <input type="hidden" name="sections" value={section} key={section} />
      ))}

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Propiedad</span>
          <select
            className={styles.textInput}
            name="propertyId"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
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
          <select className={styles.textInput} name="format" defaultValue="flyer">
            <option value="flyer">Flyer WhatsApp (imagen vertical)</option>
            <option value="pdf">Folleto PDF (A4)</option>
          </select>
        </label>
      </div>

      {propertyId ? (
        <div className={styles.formField}>
          <span>Fotos del folleto</span>
          {mediaLoading ? (
            <p className={styles.mutedText}>Cargando fotos…</p>
          ) : media.length > 0 ? (
            <>
              <p className={styles.mutedText}>
                Elige la foto principal y hasta {MAX_GALLERY_PHOTOS} para la
                franja inferior.
              </p>
              <div className={styles.brochurePhotoGrid}>
                {media.map((item) => {
                  const isHero = item.id === heroMediaId;
                  const inStrip = stripSet.has(item.id);
                  return (
                    <div className={styles.brochurePhotoTile} key={item.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- property thumb */}
                      <img src={item.url} alt="" />
                      <div className={styles.brochurePhotoActions}>
                        <label className={styles.brochurePhotoLabel}>
                          <input
                            type="radio"
                            name="heroPick"
                            checked={isHero}
                            onChange={() => setHero(item.id)}
                          />
                          Portada
                        </label>
                        <label className={styles.brochurePhotoLabel}>
                          <input
                            type="checkbox"
                            checked={inStrip}
                            disabled={isHero}
                            onChange={() => toggleStrip(item.id)}
                          />
                          Franja
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className={styles.mutedText}>
              Esta propiedad no tiene fotos — agrega imágenes en la ficha de la
              propiedad.
            </p>
          )}
        </div>
      ) : null}

      <div
        className={styles.brochurePreviewMock}
        style={{ borderColor: branding.brandColor }}
      >
        <div
          className={styles.brochurePreviewBanner}
          style={{ background: branding.brandColor }}
        >
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className={styles.brochurePreviewLogo} />
          ) : null}
          <span>{branding.organizationName}</span>
        </div>
        <p className={styles.mutedText}>
          Vista previa de marca — el folleto incluirá banner, franja de fotos y
          códigos QR en el pie.
        </p>
      </div>

      <div className={styles.formRow}>
        <label className={styles.checkboxField}>
          <input type="checkbox" name="qrListing" defaultChecked />
          <span>QR con enlace a la ficha pública</span>
        </label>
        <label className={styles.checkboxField}>
          <input type="checkbox" name="qrWhatsapp" defaultChecked />
          <span>QR de WhatsApp (tu teléfono)</span>
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
          <div className={styles.formRow}>
            <a
              className={styles.primaryButton}
              href={state.url}
              target="_blank"
              rel="noreferrer"
            >
              {state.format === "flyer" ? "Abrir imagen" : "Abrir PDF"}
            </a>
            {whatsappShareUrl ? (
              <a
                className={styles.secondaryButton}
                href={whatsappShareUrl}
                target="_blank"
                rel="noreferrer"
              >
                Compartir por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        className={styles.primaryButton}
        type="submit"
        name="intent"
        value="generate"
        disabled={pending || !propertyId}
      >
        {pending ? "Generando…" : "Generar"}
      </button>
    </form>
  );
}
