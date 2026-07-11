import "server-only";

import path from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import type { BrochureData, BrochureSection } from "./types";

// Vertical WhatsApp flyer (1080×1350): cover photo on top, branded info panel
// below. Rendered with @napi-rs/canvas using the bundled brand font,
// registered explicitly — NO dependency on system fonts (Vercel's Linux
// containers ship none, which is why SVG-text rendering produced blank
// flyers in production).

const WIDTH = 1080;
const HEIGHT = 1350;
const COVER_HEIGHT = 720;
const FONT = "Plus Jakarta Sans";

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
    // If registration fails, canvas falls back to its built-in font — still
    // renders text (unlike the old SVG path, which rendered nothing).
  }
  fontReady = true;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function renderFlyerImage(
  data: BrochureData,
  sections: BrochureSection[],
): Promise<Buffer> {
  ensureFont();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const showCover = sections.includes("cover") && data.coverJpeg;
  const panelTop = showCover ? COVER_HEIGHT : 0;

  // White base.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Cover photo (cover-fit into the top band).
  if (showCover && data.coverJpeg) {
    try {
      const image = await loadImage(data.coverJpeg);
      const scale = Math.max(WIDTH / image.width, COVER_HEIGHT / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      ctx.drawImage(
        image,
        (WIDTH - drawW) / 2,
        (COVER_HEIGHT - drawH) / 2,
        drawW,
        drawH,
      );
    } catch {
      // Bad image → fall back to a full brand panel below.
    }
  }

  // Brand-color info panel.
  ctx.fillStyle = data.brandColor || "#0B1B3A";
  ctx.fillRect(0, panelTop, WIDTH, HEIGHT - panelTop);

  ctx.textBaseline = "alphabetic";
  let y = panelTop + 96;

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 52px "${FONT}"`;
  ctx.fillText(truncate(data.title, 34), 60, y);
  y += 52;

  if (data.location) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `400 30px "${FONT}"`;
    ctx.fillText(truncate(data.location, 52), 60, y);
    y += 62;
  } else {
    y += 20;
  }

  if (sections.includes("price")) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 72px "${FONT}"`;
    ctx.fillText(data.priceLabel, 60, y + 30);

    ctx.font = `400 30px "${FONT}"`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "right";
    ctx.fillText(data.operationLabel, WIDTH - 60, y + 30);
    ctx.textAlign = "left";
    y += 110;
  }

  if (sections.includes("specs") && data.specs.length > 0) {
    const specLine = data.specs
      .slice(0, 4)
      .map((spec) => `${spec.label} ${spec.value}`)
      .join("   ·   ");
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `400 28px "${FONT}"`;
    ctx.fillText(truncate(specLine, 70), 60, y);
    y += 52;
  }

  if (sections.includes("amenities") && data.amenities.length > 0) {
    const amenityLine = data.amenities.slice(0, 5).join("  ·  ");
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `400 26px "${FONT}"`;
    ctx.fillText(truncate(amenityLine, 74), 60, y);
  }

  // Footer bar.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, HEIGHT - 96, WIDTH, 96);
  const footer = sections.includes("agent")
    ? `${data.agentName}${data.agentPhone ? `  ·  ${data.agentPhone}` : ""}  ·  ${data.organizationName}`
    : data.organizationName;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 28px "${FONT}"`;
  ctx.fillText(truncate(footer, 68), 60, HEIGHT - 38);

  return canvas.toBuffer("image/jpeg", 88);
}
