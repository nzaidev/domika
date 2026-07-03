// Section-based brochure layout, persisted as jsonb in brochure_templates.
// PDF-rendering decision (plan §12 / risk 5): pdf-lib + sharp, no headless
// Chromium on serverless.

export const BROCHURE_SECTIONS = [
  "cover",
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
};

export const SECTION_LABELS: Record<BrochureSection, string> = {
  cover: "Foto de portada",
  price: "Precio",
  specs: "Ficha técnica",
  description: "Descripción",
  amenities: "Amenidades",
  agent: "Contacto del agente",
};

export const DEFAULT_LAYOUT: BrochureLayout = {
  format: "pdf",
  sections: ["cover", "price", "specs", "description", "amenities", "agent"],
};

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
};
