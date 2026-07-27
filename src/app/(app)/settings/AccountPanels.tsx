"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { BrandingState } from "@/lib/domain/account";
import {
  updateBrandingAction,
  updateProfileAction,
  uploadLogoAction,
  type AccountFormState,
} from "./actions";

const initialState: AccountFormState = { error: null, saved: false };

export function ProfilePanel({ branding }: { branding: BrandingState }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction}>
      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Tu nombre (aparece en folletos y contratos)</span>
          <input
            className={styles.textInput}
            name="fullName"
            defaultValue={branding.profileName}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className={styles.formField}>
          <span>Tu teléfono</span>
          <input
            className={styles.textInput}
            name="phone"
            type="tel"
            defaultValue={branding.profilePhone ?? ""}
            maxLength={30}
          />
        </label>
      </div>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.saved ? <p className={styles.mutedText}>Perfil actualizado.</p> : null}
      <button className={styles.secondaryButton} type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}

export function BrandingPanel({ branding }: { branding: BrandingState }) {
  const [state, formAction, pending] = useActionState(
    updateBrandingAction,
    initialState,
  );
  const [logoState, logoAction, logoPending] = useActionState(
    uploadLogoAction,
    initialState,
  );

  return (
    <div className={styles.formGrid}>
      <form className={styles.formGrid} action={formAction}>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Nombre de la organización</span>
            <input
              className={styles.textInput}
              name="name"
              defaultValue={branding.organizationName}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label className={styles.formField}>
            <span>Color de marca (folletos y página pública)</span>
            <input
              className={styles.colorInput}
              name="brandColor"
              type="color"
              defaultValue={branding.brandColor}
            />
          </label>
        </div>
        {state.error ? <p className={styles.formError}>{state.error}</p> : null}
        {state.saved ? (
          <p className={styles.mutedText}>
            Marca actualizada — los próximos folletos y páginas públicas la usan.
          </p>
        ) : null}
        <button className={styles.secondaryButton} type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar marca"}
        </button>
      </form>

      <form className={styles.formGrid} action={logoAction}>
        <label className={styles.formField}>
          <span>Logo (banner de folletos)</span>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt="Logo actual"
              className={styles.brochurePreviewLogo}
              style={{ height: 48, width: 48, marginBottom: 8 }}
            />
          ) : (
            <p className={styles.mutedText}>Sin logo — se muestra solo el nombre.</p>
          )}
          <input
            className={styles.textInput}
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
          />
        </label>
        {logoState.error ? <p className={styles.formError}>{logoState.error}</p> : null}
        {logoState.saved ? (
          <p className={styles.mutedText}>Logo actualizado.</p>
        ) : null}
        <button
          className={styles.secondaryButton}
          type="submit"
          disabled={logoPending}
        >
          {logoPending ? "Subiendo…" : "Subir logo"}
        </button>
      </form>
    </div>
  );
}
