import "server-only";

import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { BrochureData, BrochureSection } from "./types";

// Serverless containers have no system fonts; point fontconfig at the
// bundled font BEFORE sharp initializes librsvg, or SVG text renders empty.
if (process.env.VERCEL && !process.env.FONTCONFIG_PATH) {
  process.env.FONTCONFIG_PATH = path.join(process.cwd(), "fonts");
}

// Vertical WhatsApp flyer (1080×1350): cover photo on top, branded info
// panel below, rendered as an SVG overlay and composited with sharp.

const WIDTH = 1080;
const HEIGHT = 1350;
const COVER_HEIGHT = 720;

const FONT_FAMILY = "Plus Jakarta Sans, Helvetica, Arial, sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function renderFlyerImage(
  data: BrochureData,
  sections: BrochureSection[],
): Promise<Buffer> {
  const showCover = sections.includes("cover") && data.coverJpeg;
  const panelTop = showCover ? COVER_HEIGHT : 0;
  const panelHeight = HEIGHT - panelTop;

  const specLine = data.specs
    .slice(0, 4)
    .map((spec) => `${spec.label} ${spec.value}`)
    .join("   ·   ");

  const amenityLine = sections.includes("amenities")
    ? data.amenities.slice(0, 5).join("  ·  ")
    : "";

  const lines: string[] = [];
  let cursor = panelTop + 96;

  lines.push(
    `<text x="60" y="${cursor}" font-size="52" font-weight="700" fill="#ffffff" font-family="${FONT_FAMILY}">${escapeXml(truncate(data.title, 34))}</text>`,
  );
  cursor += 52;

  if (data.location) {
    lines.push(
      `<text x="60" y="${cursor}" font-size="30" fill="rgba(255,255,255,0.85)" font-family="${FONT_FAMILY}">${escapeXml(truncate(data.location, 52))}</text>`,
    );
    cursor += 62;
  } else {
    cursor += 20;
  }

  if (sections.includes("price")) {
    lines.push(
      `<text x="60" y="${cursor + 30}" font-size="72" font-weight="700" fill="#ffffff" font-family="${FONT_FAMILY}">${escapeXml(data.priceLabel)}</text>`,
    );
    lines.push(
      `<text x="${WIDTH - 60}" y="${cursor + 30}" text-anchor="end" font-size="30" fill="rgba(255,255,255,0.85)" font-family="${FONT_FAMILY}">${escapeXml(data.operationLabel)}</text>`,
    );
    cursor += 110;
  }

  if (sections.includes("specs") && specLine) {
    lines.push(
      `<text x="60" y="${cursor}" font-size="28" fill="rgba(255,255,255,0.92)" font-family="${FONT_FAMILY}">${escapeXml(truncate(specLine, 70))}</text>`,
    );
    cursor += 52;
  }

  if (amenityLine) {
    lines.push(
      `<text x="60" y="${cursor}" font-size="26" fill="rgba(255,255,255,0.75)" font-family="${FONT_FAMILY}">${escapeXml(truncate(amenityLine, 74))}</text>`,
    );
  }

  const footer = sections.includes("agent")
    ? `${data.agentName}${data.agentPhone ? `  ·  ${data.agentPhone}` : ""}  ·  ${data.organizationName}`
    : data.organizationName;

  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${panelTop}" width="${WIDTH}" height="${panelHeight}" fill="${escapeXml(data.brandColor)}"/>
  ${lines.join("\n  ")}
  <rect x="0" y="${HEIGHT - 96}" width="${WIDTH}" height="96" fill="rgba(0,0,0,0.25)"/>
  <text x="60" y="${HEIGHT - 38}" font-size="28" font-weight="700" fill="#ffffff" font-family="${FONT_FAMILY}">${escapeXml(truncate(footer, 68))}</text>
</svg>`;

  const overlays: OverlayOptions[] = [];

  if (showCover && data.coverJpeg) {
    const cover = await sharp(data.coverJpeg)
      .resize(WIDTH, COVER_HEIGHT, { fit: "cover", position: "attention" })
      .toBuffer();
    overlays.push({ input: cover, top: 0, left: 0 });
  }

  overlays.push({ input: Buffer.from(svg), top: 0, left: 0 });

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite(overlays)
    .jpeg({ quality: 88 })
    .toBuffer();
}
