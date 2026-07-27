import "server-only";

import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { BrochureData, BrochureSection } from "./types";

// A4 brochure composed with pdf-lib (no headless browser).

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 72;
const QR_SIZE = 56;

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

async function embedLogo(doc: PDFDocument, logoJpeg: Buffer | null) {
  if (!logoJpeg) {
    return null;
  }

  try {
    return await doc.embedJpg(logoJpeg);
  } catch {
    try {
      return await doc.embedPng(logoJpeg);
    } catch {
      return null;
    }
  }
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
  const hasFooterQr =
    data.listingQrPng !== null || data.whatsappQrPng !== null;
  const footerReserve = sections.includes("agent")
    ? FOOTER_HEIGHT + (hasFooterQr ? 8 : 0)
    : 0;

  let y = PAGE_HEIGHT;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 56,
    width: PAGE_WIDTH,
    height: 56,
    color: brand,
  });

  const logo = await embedLogo(doc, data.logoJpeg);
  let headerTextX = MARGIN;

  if (logo) {
    const logoHeight = 36;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - 48,
      width: logoWidth,
      height: logoHeight,
    });
    headerTextX = MARGIN + logoWidth + 10;
  }

  page.drawText(data.organizationName.slice(0, 60), {
    x: headerTextX,
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

  if (sections.includes("cover") && data.coverJpeg) {
    try {
      const image = await doc.embedJpg(data.coverJpeg);
      const maxHeight = 220;
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
      y -= height + 14;
    } catch (error) {
      console.error("[brochure-pdf] cover embed skipped:", error);
    }
  }

  if (sections.includes("gallery") && data.galleryJpegs.length > 0) {
    const thumbs = data.galleryJpegs.slice(0, 6);
    const cols = Math.min(thumbs.length, 3);
    const thumbW = (CONTENT_WIDTH - (cols - 1) * 6) / cols;
    const thumbH = 56;
    let rowY = y;

    for (let index = 0; index < thumbs.length; index += 1) {
      try {
        const image = await doc.embedJpg(thumbs[index]);
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = MARGIN + col * (thumbW + 6);
        const drawY = rowY - row * (thumbH + 6) - thumbH;
        const scale = Math.min(thumbW / image.width, thumbH / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: x + (thumbW - width) / 2,
          y: drawY + (thumbH - height) / 2,
          width,
          height,
        });
        if (col === cols - 1 || index === thumbs.length - 1) {
          rowY = drawY - 10;
        }
      } catch {
        // skip bad thumb
      }
    }
    y = rowY;
  }

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

  const drawPrice = () => {
    page.drawText(data.priceLabel, {
      x: MARGIN,
      y: y - 24,
      size: 24,
      font: bold,
      color: brand,
    });
    y -= 40;
  };

  const drawSpecs = () => {
    if (data.specs.length === 0) {
      return;
    }
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
  };

  const drawDescription = () => {
    if (!data.description) {
      return;
    }
    const maxLines = Math.max(
      3,
      Math.floor((y - footerReserve - MARGIN) / 15),
    );
    const lines = wrapText(data.description, font, 11, CONTENT_WIDTH).slice(
      0,
      maxLines,
    );
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y: y - 13, size: 11, font, color: ink });
      y -= 15;
    }
    y -= 8;
  };

  const drawAmenities = () => {
    if (data.amenities.length === 0) {
      return;
    }
    const text = data.amenities.slice(0, 12).join("  ·  ");
    for (const line of wrapText(text, font, 11, CONTENT_WIDTH).slice(0, 3)) {
      page.drawText(line, { x: MARGIN, y: y - 13, size: 11, font, color: muted });
      y -= 15;
    }
  };

  const bodyRenderers: Partial<Record<BrochureSection, () => void>> = {
    price: drawPrice,
    specs: drawSpecs,
    description: drawDescription,
    amenities: drawAmenities,
  };

  for (const section of sections) {
    bodyRenderers[section]?.();
  }

  if (sections.includes("agent")) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: FOOTER_HEIGHT,
      color: brand,
    });

    const contact = `${data.agentName}${data.agentPhone ? `  ·  ${data.agentPhone}` : ""}  ·  ${data.organizationName}`;
    page.drawText(contact.slice(0, 72), {
      x: MARGIN,
      y: 44,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });

    if (data.listingUrl) {
      page.drawText(data.listingUrl.replace(/^https?:\/\//, "").slice(0, 80), {
        x: MARGIN,
        y: 26,
        size: 10,
        font,
        color: rgb(1, 1, 1),
      });
    }

    let qrX = PAGE_WIDTH - MARGIN - QR_SIZE;
    if (data.whatsappQrPng) {
      try {
        const qr = await doc.embedPng(data.whatsappQrPng);
        page.drawImage(qr, {
          x: qrX,
          y: 8,
          width: QR_SIZE,
          height: QR_SIZE,
        });
        qrX -= QR_SIZE + 8;
      } catch {
        // skip
      }
    }
    if (data.listingQrPng) {
      try {
        const qr = await doc.embedPng(data.listingQrPng);
        page.drawImage(qr, {
          x: qrX,
          y: 8,
          width: QR_SIZE,
          height: QR_SIZE,
        });
      } catch {
        // skip
      }
    }
  }

  return Buffer.from(await doc.save());
}
