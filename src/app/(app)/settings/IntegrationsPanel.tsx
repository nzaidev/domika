"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type {
  MetaPageView,
  WhatsappAccountView,
} from "@/lib/domain/integrations";
import {
  deleteMetaPageAction,
  deleteWhatsappAccountAction,
  metaPageAction,
  whatsappAccountAction,
  type IntegrationFormState,
} from "./actions";

const initialState: IntegrationFormState = { error: null, saved: false };

export function WhatsappPanel({
  accounts,
}: {
  accounts: WhatsappAccountView[];
}) {
  const [state, formAction, pending] = useActionState(
    whatsappAccountAction,
    initialState,
  );

  return (
    <div className={styles.formGrid}>
      {accounts.length > 0 ? (
        <div className={styles.fieldList}>
          {accounts.map((account) => (
            <article className={styles.fieldRow} key={account.id}>
              <strong>
                {account.display_phone_number ?? account.phone_number_id}
              </strong>
              <span className={styles.mutedText}>
                phone_number_id: {account.phone_number_id}
                {account.waba_id ? ` · WABA: ${account.waba_id}` : ""} ·{" "}
                {account.hasToken
                  ? "token configurado (permite descargar fotos/audio entrantes)"
                  : "sin token — los mensajes llegan, los adjuntos no se descargan"}
              </span>
              <form action={deleteWhatsappAccountAction}>
                <input type="hidden" name="accountId" value={account.id} />
                <button className={styles.ghostButton} type="submit">
                  Desconectar
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>
          Conecta el número de WhatsApp Business para capturar conversaciones
          como prospectos. Los IDs están en Meta → WhatsApp → Configuración de
          API.
        </p>
      )}

      <form className={styles.formGrid} action={formAction}>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>phone_number_id (numérico)</span>
            <input
              className={styles.textInput}
              name="phoneNumberId"
              placeholder="Ej. 123456789012345"
              required
              inputMode="numeric"
            />
          </label>
          <label className={styles.formField}>
            <span>Teléfono visible</span>
            <input
              className={styles.textInput}
              name="displayPhoneNumber"
              placeholder="+591 700 00000"
            />
          </label>
        </div>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>WABA ID (opcional)</span>
            <input className={styles.textInput} name="wabaId" />
          </label>
          <label className={styles.formField}>
            <span>Access token (se guarda, nunca se muestra)</span>
            <input
              className={styles.textInput}
              name="accessToken"
              type="password"
              autoComplete="off"
              placeholder={
                accounts.some((account) => account.hasToken)
                  ? "Dejar vacío para mantener el actual"
                  : "EAAG…"
              }
            />
          </label>
        </div>
        {state.error ? <p className={styles.formError}>{state.error}</p> : null}
        {state.saved ? (
          <p className={styles.mutedText}>Cuenta de WhatsApp guardada.</p>
        ) : null}
        <button
          className={styles.secondaryButton}
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando…" : "Guardar cuenta de WhatsApp"}
        </button>
      </form>
    </div>
  );
}

export function MetaPagesPanel({ pages }: { pages: MetaPageView[] }) {
  const [state, formAction, pending] = useActionState(
    metaPageAction,
    initialState,
  );

  return (
    <div className={styles.formGrid}>
      {pages.length > 0 ? (
        <div className={styles.fieldList}>
          {pages.map((page) => (
            <article className={styles.fieldRow} key={page.id}>
              <strong>{page.page_name ?? page.page_id}</strong>
              <span className={styles.mutedText}>
                page_id: {page.page_id} ·{" "}
                {page.hasToken
                  ? "token configurado (importa nombre/teléfono del formulario)"
                  : "sin token — los leads llegan sin datos de contacto"}
              </span>
              <form action={deleteMetaPageAction}>
                <input type="hidden" name="pageId" value={page.id} />
                <button className={styles.ghostButton} type="submit">
                  Desconectar
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>
          Conecta tu página de Facebook para que los formularios de Lead Ads
          creen prospectos automáticamente.
        </p>
      )}

      <form className={styles.formGrid} action={formAction}>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>page_id (numérico)</span>
            <input
              className={styles.textInput}
              name="pageId"
              placeholder="Ej. 987654321098765"
              required
              inputMode="numeric"
            />
          </label>
          <label className={styles.formField}>
            <span>Nombre de la página</span>
            <input className={styles.textInput} name="pageName" />
          </label>
        </div>
        <label className={styles.formField}>
          <span>Page access token (se guarda, nunca se muestra)</span>
          <input
            className={styles.textInput}
            name="accessToken"
            type="password"
            autoComplete="off"
            placeholder={
              pages.some((page) => page.hasToken)
                ? "Dejar vacío para mantener el actual"
                : "EAAG…"
            }
          />
        </label>
        {state.error ? <p className={styles.formError}>{state.error}</p> : null}
        {state.saved ? (
          <p className={styles.mutedText}>Página guardada.</p>
        ) : null}
        <button
          className={styles.secondaryButton}
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando…" : "Guardar página de Meta"}
        </button>
      </form>
    </div>
  );
}
