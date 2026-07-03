import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("prefixes bare Bolivian local numbers with +591", () => {
    expect(normalizePhone("70000001")).toBe("+59170000001");
    expect(normalizePhone("700 000 01")).toBe("+59170000001");
    expect(normalizePhone("7-000-0001")).toBe("+59170000001");
    expect(normalizePhone("(591) 7000-0001")).toBe("+59170000001");
  });

  it("normalizes numbers that already carry the country code", () => {
    expect(normalizePhone("+591 70000001")).toBe("+59170000001");
    expect(normalizePhone("59170000001")).toBe("+59170000001"); // wa_id style
    expect(normalizePhone("0059170000001")).toBe("+59170000001");
  });

  it("keeps foreign international numbers untouched", () => {
    expect(normalizePhone("+1 555 123 4567")).toBe("+15551234567");
  });

  it("returns null for empty or non-numeric input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("dedupes across sources: CSV local + WhatsApp wa_id converge", () => {
    expect(normalizePhone("70011122")).toBe(normalizePhone("59170011122"));
  });
});
