"use client";

import { useActionState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { PropertyRow } from "@/lib/database.types";
import { savePropertyAction, type PropertyFormState } from "./actions";

const initialState: PropertyFormState = { error: null };

const PROPERTY_TYPES = [
  "Casa",
  "Departamento",
  "Terreno",
  "Oficina",
  "Local comercial",
  "Otro",
];

const STATUS_OPTIONS: Array<{ value: PropertyRow["status"]; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Reservada" },
  { value: "sold", label: "Vendida" },
  { value: "rented", label: "Alquilada" },
  { value: "archived", label: "Archivada" },
];

export function PropertyForm({ property }: { property?: PropertyRow }) {
  const [state, formAction, pending] = useActionState(
    savePropertyAction,
    initialState,
  );

  const amenities = Array.isArray(property?.amenities)
    ? (property?.amenities as string[]).join(", ")
    : "";

  return (
    <form className={styles.formGrid} action={formAction}>
      {property ? (
        <input type="hidden" name="propertyId" value={property.id} />
      ) : null}

      <label className={styles.formField}>
        <span>Título</span>
        <input
          className={styles.textInput}
          name="title"
          defaultValue={property?.title ?? ""}
          placeholder="Ej. Casa familiar en Equipetrol"
          required
          minLength={3}
          maxLength={140}
        />
      </label>

      <label className={styles.formField}>
        <span>Descripción</span>
        <textarea
          className={styles.textArea}
          name="description"
          defaultValue={property?.description ?? ""}
          rows={4}
          maxLength={4000}
        />
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Tipo</span>
          <select
            className={styles.textInput}
            name="propertyType"
            defaultValue={property?.property_type ?? "Casa"}
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.formField}>
          <span>Operación</span>
          <select
            className={styles.textInput}
            name="operation"
            defaultValue={property?.operation ?? "sale"}
          >
            <option value="sale">Venta</option>
            <option value="rent">Alquiler</option>
            <option value="investment">Inversión</option>
          </select>
        </label>
        <label className={styles.formField}>
          <span>Estado</span>
          <select
            className={styles.textInput}
            name="status"
            defaultValue={property?.status ?? "draft"}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Precio</span>
          <input
            className={styles.textInput}
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={property?.price ?? ""}
          />
        </label>
        <label className={styles.formField}>
          <span>Moneda</span>
          <select
            className={styles.textInput}
            name="currency"
            defaultValue={property?.currency ?? "USD"}
          >
            <option value="USD">USD</option>
            <option value="BOB">BOB</option>
          </select>
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Ciudad</span>
          <input
            className={styles.textInput}
            name="city"
            defaultValue={property?.city ?? ""}
            maxLength={80}
          />
        </label>
        <label className={styles.formField}>
          <span>Zona</span>
          <input
            className={styles.textInput}
            name="zone"
            defaultValue={property?.zone ?? ""}
            maxLength={80}
          />
        </label>
      </div>

      <label className={styles.formField}>
        <span>Dirección (visible solo para tu organización)</span>
        <input
          className={styles.textInput}
          name="address"
          defaultValue={property?.address ?? ""}
          maxLength={200}
        />
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Dormitorios</span>
          <input
            className={styles.textInput}
            name="bedrooms"
            type="number"
            min={0}
            step="0.5"
            defaultValue={property?.bedrooms ?? ""}
          />
        </label>
        <label className={styles.formField}>
          <span>Baños</span>
          <input
            className={styles.textInput}
            name="bathrooms"
            type="number"
            min={0}
            step="0.5"
            defaultValue={property?.bathrooms ?? ""}
          />
        </label>
        <label className={styles.formField}>
          <span>Parqueos</span>
          <input
            className={styles.textInput}
            name="parkingSpaces"
            type="number"
            min={0}
            step="1"
            defaultValue={property?.parking_spaces ?? ""}
          />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Superficie construida (m²)</span>
          <input
            className={styles.textInput}
            name="areaSqm"
            type="number"
            min={0}
            step="0.01"
            defaultValue={property?.area_sqm ?? ""}
          />
        </label>
        <label className={styles.formField}>
          <span>Superficie de terreno (m²)</span>
          <input
            className={styles.textInput}
            name="lotSqm"
            type="number"
            min={0}
            step="0.01"
            defaultValue={property?.lot_sqm ?? ""}
          />
        </label>
      </div>

      <label className={styles.formField}>
        <span>Amenidades (separadas por coma)</span>
        <input
          className={styles.textInput}
          name="amenities"
          defaultValue={amenities}
          placeholder="Piscina, Parrillero, Jardín"
          maxLength={500}
        />
      </label>

      <label className={styles.formField}>
        <span>Situación legal</span>
        <input
          className={styles.textInput}
          name="legalStatus"
          defaultValue={property?.legal_status ?? ""}
          placeholder="Ej. Folio real verificado"
          maxLength={200}
        />
      </label>

      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Video (URL)</span>
          <input
            className={styles.textInput}
            name="videoUrl"
            type="url"
            defaultValue={property?.video_url ?? ""}
            maxLength={500}
          />
        </label>
        <label className={styles.formField}>
          <span>Tour virtual (URL)</span>
          <input
            className={styles.textInput}
            name="virtualTourUrl"
            type="url"
            defaultValue={property?.virtual_tour_url ?? ""}
            maxLength={500}
          />
        </label>
      </div>

      <div className={styles.ownerSection}>
        <span className={styles.eyebrow}>
          Datos del propietario · privados, nunca se comparten fuera de tu
          organización
        </span>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span>Nombre</span>
            <input
              className={styles.textInput}
              name="ownerName"
              defaultValue={property?.owner_name ?? ""}
              maxLength={120}
            />
          </label>
          <label className={styles.formField}>
            <span>Teléfono</span>
            <input
              className={styles.textInput}
              name="ownerPhone"
              type="tel"
              defaultValue={property?.owner_phone ?? ""}
              maxLength={30}
            />
          </label>
          <label className={styles.formField}>
            <span>Email</span>
            <input
              className={styles.textInput}
              name="ownerEmail"
              type="email"
              defaultValue={property?.owner_email ?? ""}
              maxLength={160}
            />
          </label>
        </div>
        <label className={styles.formField}>
          <span>Notas del propietario</span>
          <textarea
            className={styles.textArea}
            name="ownerNotes"
            defaultValue={property?.owner_notes ?? ""}
            rows={2}
            maxLength={2000}
          />
        </label>
      </div>

      {state.error ? <p className={styles.formError}>{state.error}</p> : null}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending
          ? "Guardando…"
          : property
            ? "Guardar cambios"
            : "Crear propiedad"}
      </button>
    </form>
  );
}
