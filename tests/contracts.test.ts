import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fillTemplate } from "@/lib/domain/contracts";
import { renderContractPdf } from "@/lib/brochures/contract-pdf";

describe("fillTemplate", () => {
  it("substitutes known variables", () => {
    const { text, missing } = fillTemplate(
      "Entre {{organization_name}} y {{lead_name}}, precio {{property_price}}.",
      {
        organization_name: "SAILE",
        lead_name: "Ana Suárez",
        property_price: "$325,000",
      },
    );
    expect(text).toBe("Entre SAILE y Ana Suárez, precio $325,000.");
    expect(missing).toEqual([]);
  });

  it("blanks missing values and reports them once", () => {
    const { text, missing } = fillTemplate(
      "{{lead_name}} — {{lead_email}} — {{lead_email}}",
      { lead_name: "Ana", lead_email: null },
    );
    expect(text).toBe("Ana — ________ — ________");
    expect(missing).toEqual(["lead_email"]);
  });

  it("tolerates whitespace and case in placeholders", () => {
    const { text } = fillTemplate("Hola {{ Lead_Name }}", { lead_name: "Ana" });
    expect(text).toBe("Hola Ana");
  });

  it("leaves unknown variables as blanks, not crashes", () => {
    const { text, missing } = fillTemplate("{{no_existe}}", {});
    expect(text).toBe("________");
    expect(missing).toEqual(["no_existe"]);
  });
});

describe("renderContractPdf", () => {
  it("renders long bodies across multiple pages", async () => {
    const body = Array.from(
      { length: 120 },
      (_, i) =>
        `Cláusula ${i + 1}: el presente documento establece obligaciones entre las partes conforme a la normativa vigente.`,
    ).join("\n");

    const pdf = await renderContractPdf({
      title: "Contrato de reserva — Ana Suárez",
      body,
      organizationName: "SAILE Business Group",
    });

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBeGreaterThan(1);
  });
});
