"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import {
  deletePropertyAction,
  type DeletePropertyFormState,
} from "../actions";

const initialState: DeletePropertyFormState = { error: null };

export function DeletePropertyButton({
  propertyId,
  propertyTitle,
}: {
  propertyId: string;
  propertyTitle: string;
}) {
  const [state, formAction, pending] = useActionState(
    deletePropertyAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `¿Eliminar "${propertyTitle}" definitivamente?\n\nSe borrarán sus fotos, folletos, publicaciones en la red, compartidos y tareas vinculadas. Esta acción no se puede deshacer.\n\nSi solo quieres sacarla del inventario activo, usa el estado "Archivada".`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className={styles.formGrid}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button
        className={styles.dangerButton}
        type="submit"
        disabled={pending}
      >
        {pending ? "Eliminando…" : "Eliminar propiedad"}
      </button>
    </form>
  );
}
