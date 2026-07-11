import { describe, expect, it } from "vitest";
import {
  MATCH_THRESHOLD,
  scoreMatch,
  type MatchProperty,
  type MatchRequirement,
} from "@/lib/matching";

const baseProperty: MatchProperty = {
  property_type: "Casa",
  operation: "sale",
  price: 300000,
  city: "Santa Cruz de la Sierra",
  zone: "Equipetrol",
  bedrooms: 4,
  area_sqm: 260,
};

const emptyRequirement: MatchRequirement = {
  property_type: null,
  operation: null,
  budget_min: null,
  budget_max: null,
  city: null,
  zone: null,
  bedrooms_min: null,
  area_min_sqm: null,
};

describe("scoreMatch", () => {
  it("scores 100 when every specified criterion matches", () => {
    const { score, reasons } = scoreMatch(
      {
        ...emptyRequirement,
        property_type: "casa",
        operation: "sale",
        budget_min: 250000,
        budget_max: 350000,
        zone: "equipetrol",
        bedrooms_min: 3,
      },
      baseProperty,
    );
    expect(score).toBe(100);
    expect(reasons).toContain("Precio dentro del presupuesto");
  });

  it("disqualifies on operation mismatch (rent vs sale)", () => {
    const { score } = scoreMatch(
      { ...emptyRequirement, operation: "rent", zone: "equipetrol" },
      baseProperty,
    );
    expect(score).toBe(0);
  });

  it("normalizes: sparse requirements can still reach 100", () => {
    const { score } = scoreMatch(
      { ...emptyRequirement, zone: "Equipetrol" },
      baseProperty,
    );
    expect(score).toBe(100);
  });

  it("applies 10% budget tolerance", () => {
    const { score } = scoreMatch(
      { ...emptyRequirement, budget_max: 280000 },
      baseProperty, // 300k ≤ 280k * 1.1 = 308k
    );
    expect(score).toBe(100);
  });

  it("fails budget outside tolerance", () => {
    const { score } = scoreMatch(
      { ...emptyRequirement, budget_max: 250000 },
      baseProperty, // 300k > 275k
    );
    expect(score).toBe(0);
  });

  it("matches accents-insensitively on location", () => {
    const { score } = scoreMatch(
      { ...emptyRequirement, zone: "EQUIPÉTROL" },
      baseProperty,
    );
    expect(score).toBe(100);
  });

  it("partial matches land proportionally", () => {
    const { score } = scoreMatch(
      {
        ...emptyRequirement,
        property_type: "Departamento", // no (20)
        budget_max: 350000, // yes (25)
        zone: "Equipetrol", // yes (15)
      },
      baseProperty,
    );
    // (25 + 15) / 60 ≈ 67
    expect(score).toBe(67);
    expect(score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it("returns 0 for a requirement with no criteria", () => {
    expect(scoreMatch(emptyRequirement, baseProperty).score).toBe(0);
  });

  it("unpriced properties do not earn budget points", () => {
    const { score } = scoreMatch(
      { ...emptyRequirement, budget_max: 350000, zone: "Equipetrol" },
      { ...baseProperty, price: null },
    );
    // 15/40 ≈ 38 → below threshold
    expect(score).toBeLessThan(MATCH_THRESHOLD);
  });
});
