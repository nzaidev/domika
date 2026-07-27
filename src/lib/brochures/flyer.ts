import "server-only";

import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import type { BrochureData, BrochureSection } from "./types";

// Vertical WhatsApp flyer (1080×1350):
// brand banner → hero photo → photo strip (up to 12) → info panel → footer + QR codes.

const WIDTH = 1080;
const HEIGHT = 1350;
const BANNER_HEIGHT = 80;
const STRIP_HEIGHT = 160;
const FOOTER_HEIGHT = 140;
const HERO_HEIGHT = 480;
const FONT = "Plus Jakarta Sans";
const QR_SIZE = 96;
const QR_GAP = 16;

let fontReady = false;
function ensureFont() {
  if (fontReady) {
    return;
  }
  try {
    GlobalFonts.registerFromPath(
      path.join(process.cwd(), "fonts", "PlusJakartaSans.ttf"),
      FONT,
    );
  } catch {
    // canvas built-in fallback
  }
  fontReady = true;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) {
    return { r: 11, g: 27, b: 58 };
  }
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

async function drawCoverFit(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  image: Image,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / image.width, h / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

async function loadJpeg(buffer: Buffer | null): Promise<Image | null> {
  if (!buffer) {
    return null;
  }
  try {
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

async function drawPhotoStrip(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  galleryJpegs: Buffer[],
  top: number,
) {
  const count = galleryJpegs.length;
  if (count === 0) {
    return;
  }

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, top, WIDTH, STRIP_HEIGHT);

  const cols = count <= 3 ? count : count <= 6 ? count : 6;
  const rows = Math.ceil(count / cols);
  const gutter = 2;
  const cellW = (WIDTH - gutter * (cols + 1)) / cols;
  const cellH = (STRIP_HEIGHT - gutter * (rows + 1)) / rows;

  for (let index = 0; index < count; index += 1) {
    const image = await loadJpeg(galleryJpegs[index]);
    if (!image) {
      continue;
    }
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = gutter + col * (cellW + gutter);
    const y = top + gutter + row * (cellH + gutter);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();
    await drawCoverFit(ctx, image, x, y, cellW, cellH);
    ctx.restore();
  }
}

async function drawBanner(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  data: BrochureData,
) {
  ctx.fillStyle = data.brandColor || "#0B1B3A";
  ctx.fillRect(0, 0, WIDTH, BANNER_HEIGHT);

  const logo = await loadJpeg(data.logoJpeg);
  let textX = 60;

  if (logo) {
    const logoSize = 56;
    ctx.drawImage(logo, 20, 12, logoSize, logoSize);
    textX = 88;
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 28px "${FONT}"`;
  ctx.textBaseline = "middle";
  ctx.fillText(truncate(data.organizationName, 36), textX, BANNER_HEIGHT / 2);

  ctx.font = `600 22px "${FONT}"`;
  ctx.textAlign = "right";
  ctx.fillText(data.operationLabel, WIDTH - 24, BANNER_HEIGHT / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

async function drawQrBlock(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  png: Buffer | null,
  label: string,
  x: number,
  footerTop: number,
) {
  if (!png) {
    return;
  }

  const image = await loadImage(png);
  if (!image) {
    return;
  }

  const qrY = footerTop + (FOOTER_HEIGHT - QR_SIZE - 22) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 4, qrY - 4, QR_SIZE + 8, QR_SIZE + 8);
  ctx.drawImage(image, x, qrY, QR_SIZE, QR_SIZE);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `400 18px "${FONT}"`;
  ctx.textAlign = "center";
  ctx.fillText(label, x + QR_SIZE / 2, qrY + QR_SIZE + 18);
  ctx.textAlign = "left";
}

export async function renderFlyerImage(
  data: BrochureData,
  sections: BrochureSection[],
): Promise<Buffer> {
  ensureFont();

  const showGallery =
    sections.includes("gallery") && data.galleryJpegs.length > 0;
  const showCover = sections.includes("cover") && data.coverJpeg;
  const hasQr =
    data.listingQrPng !== null || data.whatsappQrPng !== null;

  const stripTop = BANNER_HEIGHT + HERO_HEIGHT;
  const infoTop =
    BANNER_HEIGHT +
    HERO_HEIGHT +
    (showGallery ? STRIP_HEIGHT : 0);
  const footerTop = HEIGHT - FOOTER_HEIGHT;
  const infoHeight = footerTop - infoTop;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  await drawBanner(ctx, data);

  if (showCover && data.coverJpeg) {
    const hero = await loadJpeg(data.coverJpeg);
    if (hero) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, BANNER_HEIGHT, WIDTH, HERO_HEIGHT);
      ctx.clip();
      await drawCoverFit(ctx, hero, 0, BANNER_HEIGHT, WIDTH, HERO_HEIGHT);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = data.brandColor || "#0B1B3A";
    ctx.fillRect(0, BANNER_HEIGHT, WIDTH, HERO_HEIGHT);
  }

  if (showGallery) {
    await drawPhotoStrip(ctx, data.galleryJpegs, stripTop);
  }

  const brand = hexToRgb(data.brandColor || "#0B1B3A");
  ctx.fillStyle = `rgb(${brand.r}, ${brand.g}, ${brand.b})`;
  ctx.fillRect(0, infoTop, WIDTH, infoHeight);

  ctx.textBaseline = "alphabetic";
  let y = infoTop + 56;

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 44px "${FONT}"`;
  for (const line of wrapLines(truncate(data.title, 80), 28)) {
    ctx.fillText(line, 48, y);
    y += 48;
  }
  y += 8;

  if (data.location) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `400 26px "${FONT}"`;
    ctx.fillText(truncate(data.location, 52), 48, y);
    y += 40;
  }

  const drawPrice = () => {
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 64px "${FONT}"`;
    ctx.fillText(data.priceLabel, 48, y + 24);
    y += 88;
  };

  const drawSpecs = () => {
    if (data.specs.length === 0) {
      return;
    }
    const specLine = data.specs
      .slice(0, 4)
      .map((spec) => `${spec.label} ${spec.value}`)
      .join("   ·   ");
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `400 26px "${FONT}"`;
    ctx.fillText(truncate(specLine, 68), 48, y);
    y += 44;
  };

  const drawDescription = () => {
    if (!data.description) {
      return;
    }
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `400 24px "${FONT}"`;
    ctx.fillText(truncate(data.description, 72), 48, y);
    y += 38;
  };

  const drawAmenities = () => {
    if (data.amenities.length === 0) {
      return;
    }
    const amenityLine = data.amenities.slice(0, 5).join("  ·  ");
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `400 24px "${FONT}"`;
    ctx.fillText(truncate(amenityLine, 72), 48, y);
    y += 38;
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

  const footerBrand = hexToRgb(data.brandColor || "#0B1B3A");
  ctx.fillStyle = `rgb(${Math.max(0, footerBrand.r - 20)}, ${Math.max(0, footerBrand.g - 20)}, ${Math.max(0, footerBrand.b - 20)})`;
  ctx.fillRect(0, footerTop, WIDTH, FOOTER_HEIGHT);

  let qrX = WIDTH - 24;
  if (hasQr) {
    if (data.whatsappQrPng) {
      qrX -= QR_SIZE;
      await drawQrBlock(ctx, data.whatsappQrPng, "WhatsApp", qrX, footerTop);
      qrX -= QR_GAP;
    }
    if (data.listingQrPng) {
      qrX -= QR_SIZE;
      await drawQrBlock(ctx, data.listingQrPng, "Ver ficha", qrX, footerTop);
    }
  }

  const showAgent = sections.includes("agent");
  const footerLine = showAgent
    ? `${data.agentName}${data.agentPhone ? `  ·  ${data.agentPhone}` : ""}`
    : data.organizationName;

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 26px "${FONT}"`;
  ctx.fillText(truncate(footerLine, 42), 48, footerTop + 44);

  if (data.listingUrl) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `400 22px "${FONT}"`;
    ctx.fillText(
      truncate(data.listingUrl.replace(/^https?:\/\//, ""), 48),
      48,
      footerTop + 78,
    );
  } else if (showAgent) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `400 22px "${FONT}"`;
    ctx.fillText(truncate(data.organizationName, 48), 48, footerTop + 78);
  }

  return canvas.toBuffer("image/jpeg", 88);
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
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

  return lines.slice(0, 2);
}
