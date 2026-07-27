import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  DEFAULT_LAYOUT,
  MAX_GALLERY_PHOTOS,
  sanitizeLayout,
  type BrochureData,
} from "@/lib/brochures/types";
import { renderBrochurePdf } from "@/lib/brochures/pdf";
import { renderFlyerImage } from "@/lib/brochures/flyer";
import { buildBrochureQrImages, whatsappUrl } from "@/lib/brochures/qr";

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
    ).toEqual({
      format: "flyer",
      sections: ["price", "cover"],
      qrListing: true,
      qrWhatsapp: true,
    });
  });

  it("never returns an empty section list", () => {
    expect(sanitizeLayout({ format: "pdf", sections: ["bogus"] }).sections)
      .toEqual(DEFAULT_LAYOUT.sections);
  });

  it("respects QR toggles", () => {
    expect(
      sanitizeLayout({ format: "flyer", sections: ["cover"], qrListing: false }),
    ).toMatchObject({ qrListing: false, qrWhatsapp: true });
  });
});

async function sampleJpeg(color: string): Promise<Buffer> {
  return sharp({
    create: { width: 400, height: 300, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

async function sampleData(
  galleryCount = 0,
): Promise<BrochureData> {
  const coverJpeg = await sampleJpeg("#3b82f6");
  const galleryJpegs: Buffer[] = [];

  for (let index = 0; index < galleryCount; index += 1) {
    galleryJpegs.push(await sampleJpeg(index % 2 === 0 ? "#10b981" : "#f59e0b"));
  }

  const { listingQrPng, whatsappQrPng } = await buildBrochureQrImages({
    listingUrl: "https://domika.io/p/casa-equipetrol-abc123",
    agentPhone: "+59170000001",
    includeListing: true,
    includeWhatsapp: true,
    size: 200,
  });

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
    logoJpeg: null,
    galleryJpegs,
    listingUrl: "https://domika.io/p/casa-equipetrol-abc123",
    listingQrPng,
    whatsappQrPng,
  };
}

describe("whatsappUrl", () => {
  it("builds a wa.me link from E.164 phone", () => {
    expect(whatsappUrl("+59170000001")).toBe("https://wa.me/59170000001");
  });

  it("returns null for empty input", () => {
    expect(whatsappUrl(null)).toBeNull();
  });
});

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

  it("renders with a 12-photo gallery strip", async () => {
    const flyer = await renderFlyerImage(
      await sampleData(MAX_GALLERY_PHOTOS),
      ["cover", "gallery", "price", "agent"],
    );
    expect((await sharp(flyer).metadata()).height).toBe(1350);
  });

  it("renders without gallery when section omitted", async () => {
    const flyer = await renderFlyerImage(
      await sampleData(6),
      ["cover", "price", "agent"],
    );
    expect((await sharp(flyer).metadata()).width).toBe(1080);
  });

  it("handles hostile titles without crashing", async () => {
    const data = {
      ...(await sampleData()),
      title: `Casa <svg> & "quotes" 'apos'`,
    };
    const flyer = await renderFlyerImage(data, ["cover", "price", "agent"]);
    expect((await sharp(flyer).metadata()).width).toBe(1080);
  });

  it("produces a non-blank flyer with gallery and QR codes", async () => {
    const data = await sampleData(MAX_GALLERY_PHOTOS);
    const flyer = await renderFlyerImage(data, [...DEFAULT_LAYOUT.sections]);

    expect(flyer.length).toBeGreaterThan(40_000);
    expect(data.listingQrPng).not.toBeNull();
    expect(data.whatsappQrPng).not.toBeNull();
    expect(data.listingQrPng!.length).toBeGreaterThan(500);
    expect(data.whatsappQrPng!.length).toBeGreaterThan(500);

    const { data: pixels, info } = await sharp(flyer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    function avgRgb(y: number, x: number, w = 40, h = 40) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      const channels = info.channels;
      for (let row = y; row < y + h; row += 1) {
        for (let col = x; col < x + w; col += 1) {
          const offset = (row * info.width + col) * channels;
          r += pixels[offset];
          g += pixels[offset + 1];
          b += pixels[offset + 2];
          count += 1;
        }
      }
      return { r: r / count, g: g / count, b: b / count };
    }

    const banner = avgRgb(10, 10);
    const hero = avgRgb(200, 400);
    const strip = avgRgb(600, 400);
    const footer = avgRgb(1280, 400);

    expect(banner.r + banner.g + banner.b).toBeLessThan(200);
    expect(hero.r + hero.g + hero.b).toBeGreaterThan(50);
    expect(strip.r + strip.g + strip.b).toBeGreaterThan(100);
    expect(footer.r + footer.g + footer.b).toBeLessThan(250);
  });
});
