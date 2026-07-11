// Pure demand-matching scorer: compares a buyer requirement against a
// property. Only criteria the requirement actually specifies count toward
// the score, which is normalized to 0–100. An operation mismatch (rent vs
// sale) disqualifies outright.

export type MatchRequirement = {
  property_type: string | null;
  operation: "sale" | "rent" | "investment" | null;
  budget_min: number | null;
  budget_max: number | null;
  city: string | null;
  zone: string | null;
  bedrooms_min: number | null;
  area_min_sqm: number | null;
};

export type MatchProperty = {
  property_type: string | null;
  operation: "sale" | "rent" | "investment";
  price: number | null;
  city: string | null;
  zone: string | null;
  bedrooms: number | null;
  area_sqm: number | null;
};

export type MatchResult = {
  score: number; // 0–100
  reasons: string[];
};

export const MATCH_THRESHOLD = 50;

const WEIGHTS = {
  operation: 15,
  type: 20,
  budget: 25,
  zone: 15,
  city: 10,
  bedrooms: 10,
  area: 5,
} as const;

function norm(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function scoreMatch(
  requirement: MatchRequirement,
  property: MatchProperty,
): MatchResult {
  // Hard filter: wanting to rent ≠ property for sale.
  if (requirement.operation && requirement.operation !== property.operation) {
    return { score: 0, reasons: [] };
  }

  let possible = 0;
  let earned = 0;
  const reasons: string[] = [];

  if (requirement.operation) {
    possible += WEIGHTS.operation;
    earned += WEIGHTS.operation;
    reasons.push("Operación coincide");
  }

  if (requirement.property_type) {
    possible += WEIGHTS.type;
    if (norm(requirement.property_type) === norm(property.property_type)) {
      earned += WEIGHTS.type;
      reasons.push("Tipo de propiedad coincide");
    }
  }

  if (requirement.budget_min !== null || requirement.budget_max !== null) {
    possible += WEIGHTS.budget;
    if (property.price !== null) {
      // 10% tolerance on both ends: near-misses are still worth showing.
      const min = requirement.budget_min !== null ? requirement.budget_min * 0.9 : null;
      const max = requirement.budget_max !== null ? requirement.budget_max * 1.1 : null;
      const aboveMin = min === null || property.price >= min;
      const belowMax = max === null || property.price <= max;
      if (aboveMin && belowMax) {
        earned += WEIGHTS.budget;
        reasons.push("Precio dentro del presupuesto");
      }
    }
  }

  if (requirement.zone) {
    possible += WEIGHTS.zone;
    const a = norm(requirement.zone);
    const b = norm(property.zone);
    if (a && b && (a.includes(b) || b.includes(a))) {
      earned += WEIGHTS.zone;
      reasons.push("Zona coincide");
    }
  }

  if (requirement.city) {
    possible += WEIGHTS.city;
    const a = norm(requirement.city);
    const b = norm(property.city);
    if (a && b && (a.includes(b) || b.includes(a))) {
      earned += WEIGHTS.city;
      reasons.push("Ciudad coincide");
    }
  }

  if (requirement.bedrooms_min !== null) {
    possible += WEIGHTS.bedrooms;
    if (
      property.bedrooms !== null &&
      property.bedrooms >= requirement.bedrooms_min
    ) {
      earned += WEIGHTS.bedrooms;
      reasons.push("Dormitorios suficientes");
    }
  }

  if (requirement.area_min_sqm !== null) {
    possible += WEIGHTS.area;
    if (
      property.area_sqm !== null &&
      property.area_sqm >= requirement.area_min_sqm
    ) {
      earned += WEIGHTS.area;
      reasons.push("Superficie suficiente");
    }
  }

  if (possible === 0) {
    return { score: 0, reasons: [] };
  }

  return { score: Math.round((earned / possible) * 100), reasons };
}
