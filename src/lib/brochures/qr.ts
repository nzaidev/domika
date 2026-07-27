import "server-only";

import QRCode from "qrcode";
import { normalizePhone } from "@/lib/phone";

export function whatsappUrl(rawPhone: string | null | undefined): string | null {
  const normalized = normalizePhone(rawPhone);

  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export async function renderQrPng(
  payload: string,
  size: number,
): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0B1B3A", light: "#FFFFFF" },
  });
}

export async function buildBrochureQrImages(input: {
  listingUrl: string | null;
  agentPhone: string | null;
  includeListing: boolean;
  includeWhatsapp: boolean;
  size?: number;
}): Promise<{ listingQrPng: Buffer | null; whatsappQrPng: Buffer | null }> {
  const size = input.size ?? 280;
  const listingQrPng =
    input.includeListing && input.listingUrl
      ? await renderQrPng(input.listingUrl, size)
      : null;

  const waUrl = input.includeWhatsapp ? whatsappUrl(input.agentPhone) : null;
  const whatsappQrPng = waUrl ? await renderQrPng(waUrl, size) : null;

  return { listingQrPng, whatsappQrPng };
}
