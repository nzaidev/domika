import "server-only";

import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { BrochureData, BrochureSection } from "./types";

// A4 brochure composed with pdf-lib (no headless browser).

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function hexToRgb(hex: string): RGB {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.padEnd(6, "0");
  const int = Number.parseInt(full.slice(0, 6), 16);

  if (Number.isNaN(int)) {
    return rgb(0.04, 0.11, 0.23);
  }

  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function renderBrochurePdf(
  data: BrochureData,
  sections: BrochureSection[],
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(data.brandColor);
  const muted = rgb(0.4, 0.45, 0.44);
  const ink = rgb(0.13, 0.2, 0.19);

  let y = PAGE_HEIGHT;

  // Brand header band.
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 56,
    width: PAGE_WIDTH,
    height: 56,
    color: brand,
  });
  page.drawText(data.organizationName.slice(0, 60), {
    x: MARGIN,
    y: PAGE_HEIGHT - 36,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(data.operationLabel, {
    x:
      PAGE_WIDTH -
      MARGIN -
      bold.widthOfTextAtSize(data.operationLabel, 12),
    y: PAGE_HEIGHT - 34,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y = PAGE_HEIGHT - 80;

  // Cover photo. embedJpg is strict about JPEG variants (progressive,
  // CMYK, unusual markers) and can throw; a bad cover must never fail the
  // whole document, so skip it on error.
  if (sections.includes("cover") && data.coverJpeg) {
    try {
      const image = await doc.embedJpg(data.coverJpeg);
      const maxHeight = 260;
      const scale = Math.min(
        CONTENT_WIDTH / image.width,
        maxHeight / image.height,
      );
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: MARGIN + (CONTENT_WIDTH - width) / 2,
        y: y - height,
        width,
        height,
      });
      y -= height + 18;
    } catch (error) {
      console.error("[brochure-pdf] cover embed skipped:", error);
    }
  }

  // Title + location.
  for (const line of wrapText(data.title, bold, 20, CONTENT_WIDTH).slice(0, 2)) {
    page.drawText(line, { x: MARGIN, y: y - 20, size: 20, font: bold, color: ink });
    y -= 26;
  }

  if (data.location) {
    page.drawText(data.location.slice(0, 90), {
      x: MARGIN,
      y: y - 14,
      size: 12,
      font,
      color: muted,
    });
    y -= 22;
  }

  // Price.
  if (sections.includes("price")) {
    page.drawText(data.priceLabel, {
      x: MARGIN,
      y: y - 24,
      size: 24,
      font: bold,
      color: brand,
    });
    y -= 40;
  }

  // Specs, two columns.
  if (sections.includes("specs") && data.specs.length > 0) {
    const columnWidth = CONTENT_WIDTH / 2;
    const rows = Math.ceil(data.specs.length / 2);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        const spec = data.specs[row * 2 + column];
        if (!spec) {
          continue;
        }
        const x = MARGIN + column * columnWidth;
        page.drawText(`${spec.label}: `, {
          x,
          y: y - 14,
          size: 11,
          font: bold,
          color: ink,
        });
        page.drawText(spec.value.slice(0, 40), {
          x: x + bold.widthOfTextAtSize(`${spec.label}: `, 11),
          y: y - 14,
          size: 11,
          font,
          color: muted,
        });
      }
      y -= 18;
    }
    y -= 8;
  }

  // Description.
  if (sections.includes("description") && data.description) {
    const lines = wrapText(data.description, font, 11, CONTENT_WIDTH).slice(0, 12);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y: y - 13, size: 11, font, color: ink });
      y -= 15;
    }
    y -= 8;
  }

  // Amenities.
  if (sections.includes("amenities") && data.amenities.length > 0) {
    const text = data.amenities.slice(0, 12).join("  ·  ");
    for (const line of wrapText(text, font, 11, CONTENT_WIDTH).slice(0, 3)) {
      page.drawText(line, { x: MARGIN, y: y - 13, size: 11, font, color: muted });
      y -= 15;
    }
  }

  // Agent footer band.
  if (sections.includes("agent")) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 52,
      color: brand,
    });
    const contact = `${data.agentName}${data.agentPhone ? `  ·  ${data.agentPhone}` : ""}  ·  ${data.organizationName}`;
    page.drawText(contact.slice(0, 100), {
      x: MARGIN,
      y: 20,
      size: 12,
      font: bold,
      color: rgb(1, 1, 1),
    });
  }

  return Buffer.from(await doc.save());
}
