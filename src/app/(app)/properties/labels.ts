import type { PropertyRow } from "@/lib/database.types";

export const STATUS_LABELS: Record<PropertyRow["status"], string> = {
  draft: "Borrador",
  available: "Disponible",
  reserved: "Reservada",
  sold: "Vendida",
  rented: "Alquilada",
  archived: "Archivada",
};

export const OPERATION_LABELS: Record<PropertyRow["operation"], string> = {
  sale: "Venta",
  rent: "Alquiler",
  investment: "Inversión",
};

export const PROPERTY_TYPE_OPTIONS = [
  "Casa",
  "Departamento",
  "Terreno",
  "Oficina",
  "Local comercial",
  "Otro",
];

export function formatPrice(price: number | null, currency: string) {
  if (price === null) {
    return "Precio a consultar";
  }
  return `${currency === "BOB" ? "Bs" : "$"}${Math.round(price).toLocaleString("en-US")}`;
}

// Canonical property URL. Prefers the human-readable slug; falls back to the
// UUID (which the detail route also resolves) when a slug isn't loaded yet.
export function propertyHref(property: {
  slug?: string | null;
  id: string;
}): string {
  return `/properties/${property.slug ?? property.id}`;
}
