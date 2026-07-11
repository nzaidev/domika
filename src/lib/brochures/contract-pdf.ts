import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Multi-page A4 text document for contracts (pdf-lib, no browser).

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 11;
const LINE_HEIGHT = 16;

function wrapLine(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  if (!text.trim()) {
    return [""];
  }

  const words = text.split(/\s+/);
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

export async function renderContractPdf(input: {
  title: string;
  body: string;
  organizationName: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const ink = rgb(0.1, 0.1, 0.12);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPageIfNeeded(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  // Header: org name + title.
  page.drawText(input.organizationName.slice(0, 70), {
    x: MARGIN,
    y: y - 12,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.48),
  });
  y -= 34;

  for (const line of wrapLine(input.title, bold, 16, CONTENT_WIDTH).slice(0, 3)) {
    page.drawText(line, { x: MARGIN, y: y - 16, size: 16, font: bold, color: ink });
    y -= 22;
  }
  y -= 14;

  // Body paragraphs.
  for (const paragraph of input.body.split("\n")) {
    const lines = wrapLine(paragraph, font, BODY_SIZE, CONTENT_WIDTH);
    for (const line of lines) {
      newPageIfNeeded(LINE_HEIGHT);
      if (line) {
        page.drawText(line, {
          x: MARGIN,
          y: y - BODY_SIZE,
          size: BODY_SIZE,
          font,
          color: ink,
        });
      }
      y -= LINE_HEIGHT;
    }
  }

  // Signature block.
  newPageIfNeeded(120);
  y -= 48;
  const half = CONTENT_WIDTH / 2 - 20;
  for (const [index, label] of ["Firma — Parte A", "Firma — Parte B"].entries()) {
    const x = MARGIN + index * (half + 40);
    page.drawLine({
      start: { x, y },
      end: { x: x + half, y },
      thickness: 0.8,
      color: ink,
    });
    page.drawText(label, {
      x,
      y: y - 14,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.48),
    });
  }

  return Buffer.from(await doc.save());
}
