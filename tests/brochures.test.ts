import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  DEFAULT_LAYOUT,
  sanitizeLayout,
  type BrochureData,
} from "@/lib/brochures/types";
import { renderBrochurePdf } from "@/lib/brochures/pdf";
import { renderFlyerImage } from "@/lib/brochures/flyer";

describe("sanitizeLayout", () => {
  it("falls back to the default layout on garbage input", () => {
    expect(sanitizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout({ format: "docx", sections: "nope" })).toEqual(
      DEFAULT_LAYOUT,
    );
  });

  it("drops unknown sections and keeps order", () => {
    expect(
      sanitizeLayout({
        format: "flyer",
        sections: ["price", "hack_the_db", "cover"],
      }),
    ).toEqual({ format: "flyer", sections: ["price", "cover"] });
  });

  it("never returns an empty section list", () => {
    expect(sanitizeLayout({ format: "pdf", sections: ["bogus"] }).sections)
      .toEqual(DEFAULT_LAYOUT.sections);
  });
});

async function sampleData(): Promise<BrochureData> {
  const coverJpeg = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#3b82f6" },
  })
    .jpeg()
    .toBuffer();

  return {
    title: "Casa familiar en Equipetrol con jardín",
    priceLabel: "$325,000",
    operationLabel: "En venta",
    location: "Equipetrol, Santa Cruz de la Sierra",
    specs: [
      { label: "Tipo", value: "Casa" },
      { label: "Dorm.", value: "4" },
      { label: "Baños", value: "3" },
    ],
    description: "Amplia casa familiar con piscina y parrillero.",
    amenities: ["Piscina", "Parrillero", "Jardín"],
    organizationName: "SAILE Business Group",
    brandColor: "#0B1B3A",
    agentName: "María Fernández",
    agentPhone: "+59170000001",
    coverJpeg,
  };
}

describe("renderBrochurePdf", () => {
  it("produces a parseable one-page A4 PDF", async () => {
    const pdf = await renderBrochurePdf(await sampleData(), [
      ...DEFAULT_LAYOUT.sections,
    ]);
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);
    const { width, height } = parsed.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("renders without a cover photo", async () => {
    const data = { ...(await sampleData()), coverJpeg: null };
    const pdf = await renderBrochurePdf(data, ["price", "specs", "agent"]);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});

describe("renderFlyerImage", () => {
  it("produces a 1080x1350 JPEG", async () => {
    const flyer = await renderFlyerImage(await sampleData(), [
      ...DEFAULT_LAYOUT.sections,
    ]);
    const meta = await sharp(flyer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
  });

  it("escapes XML-hostile titles instead of crashing", async () => {
    const data = {
      ...(await sampleData()),
      title: `Casa <svg> & "quotes" 'apos'`,
    };
    const flyer = await renderFlyerImage(data, ["cover", "price", "agent"]);
    expect((await sharp(flyer).metadata()).width).toBe(1080);
  });
});
