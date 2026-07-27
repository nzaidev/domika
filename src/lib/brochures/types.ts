// Section-based brochure layout, persisted as jsonb in brochure_templates.
// PDF-rendering decision (plan §12 / risk 5): pdf-lib + sharp, no headless
// Chromium on serverless.

export const BROCHURE_SECTIONS = [
  "cover",
  "gallery",
  "price",
  "specs",
  "description",
  "amenities",
  "agent",
] as const;

export type BrochureSection = (typeof BROCHURE_SECTIONS)[number];

export type BrochureFormat = "pdf" | "flyer";

export type BrochureLayout = {
  format: BrochureFormat;
  sections: BrochureSection[];
  qrListing?: boolean;
  qrWhatsapp?: boolean;
};

export const SECTION_LABELS: Record<BrochureSection, string> = {
  cover: "Foto de portada",
  gallery: "Galería de fotos",
  price: "Precio",
  specs: "Ficha técnica",
  description: "Descripción",
  amenities: "Amenidades",
  agent: "Contacto del agente",
};

export const DEFAULT_LAYOUT: BrochureLayout = {
  format: "flyer",
  sections: [
    "cover",
    "gallery",
    "price",
    "specs",
    "description",
    "amenities",
    "agent",
  ],
  qrListing: true,
  qrWhatsapp: true,
};

export const MAX_GALLERY_PHOTOS = 12;

export function sanitizeLayout(input: unknown): BrochureLayout {
  const raw = (input ?? {}) as Partial<BrochureLayout>;
  const format: BrochureFormat = raw.format === "pdf" ? "pdf" : "flyer";
  const sections = Array.isArray(raw.sections)
    ? (raw.sections.filter((section) =>
        BROCHURE_SECTIONS.includes(section as BrochureSection),
      ) as BrochureSection[])
    : DEFAULT_LAYOUT.sections;

  return {
    format,
    sections: sections.length > 0 ? sections : DEFAULT_LAYOUT.sections,
    qrListing: raw.qrListing !== false,
    qrWhatsapp: raw.qrWhatsapp !== false,
  };
}

export type BrochureData = {
  title: string;
  priceLabel: string;
  operationLabel: string;
  location: string;
  specs: Array<{ label: string; value: string }>;
  description: string | null;
  amenities: string[];
  organizationName: string;
  brandColor: string;
  agentName: string;
  agentPhone: string | null;
  coverJpeg: Buffer | null;
  logoJpeg: Buffer | null;
  galleryJpegs: Buffer[];
  listingUrl: string | null;
  listingQrPng: Buffer | null;
  whatsappQrPng: Buffer | null;
};
