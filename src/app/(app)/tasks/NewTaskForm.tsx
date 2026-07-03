"use client";

import { useActionState, useRef } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { createTaskAction, type TaskFormState } from "./actions";

const initialState: TaskFormState = { error: null, createdTitle: null };

export function NewTaskForm({
  members,
  leadOptions,
  propertyOptions,
  defaultAssignee,
}: {
  members: Array<{ id: string; full_name: string }>;
  leadOptions: Array<{ id: string; full_name: string }>;
  propertyOptions: Array<{ id: string; title: string }>;
  defaultAssignee: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: TaskFormState, formData: FormData) => {
      const next = await createTaskAction(previous, formData);
      if (!next.error) {
        formRef.current?.reset();
      }
      return next;
    },
    initialState,
  );

  return (
    <form className={styles.formGrid} action={formAction} ref={formRef}>
      <label className={styles.formField}>
        <span>Título</span>
        <input
          className={styles.textInput}
          name="title"
          placeholder="Ej. Llamar para confirmar visita"
          required
          minLength={2}
          maxLength={140}
        />
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Tipo</span>
          <select
            className={styles.textInput}
            name="taskType"
            defaultValue="follow_up"
          >
            <option value="call">Llamada</option>
            <option value="visit">Visita</option>
            <option value="document">Documento</option>
            <option value="follow_up">Seguimiento</option>
            <option value="meeting">Reunión</option>
            <option value="other">Otra</option>
          </select>
        </label>
        <label className={styles.formField}>
          <span>Prioridad</span>
          <select
            className={styles.textInput}
            name="priority"
            defaultValue="medium"
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Fecha límite</span>
          <input className={styles.textInput} name="dueDate" type="date" />
        </label>
        <label className={styles.formField}>
          <span>Hora</span>
          <input
            className={styles.textInput}
            name="dueTime"
            type="time"
            defaultValue="09:00"
          />
        </label>
      </div>

      <label className={styles.formField}>
        <span>Responsable</span>
        <select
          className={styles.textInput}
          name="assignedTo"
          defaultValue={defaultAssignee}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Prospecto (opcional)</span>
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
          <span>Propiedad (opcional)</span>
          <select className={styles.textInput} name="propertyId" defaultValue="">
            <option value="">Sin propiedad</option>
            {propertyOptions.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.formField}>
        <span>Descripción (opcional)</span>
        <textarea
          className={styles.textArea}
          name="description"
          rows={2}
          maxLength={2000}
        />
      </label>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.createdTitle ? (
        <p className={styles.mutedText}>
          Tarea “{state.createdTitle}” creada.
        </p>
      ) : null}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear tarea"}
      </button>
    </form>
  );
}
