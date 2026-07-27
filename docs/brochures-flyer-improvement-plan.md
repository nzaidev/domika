# Brochures & Flyer Improvement Plan

**Date:** July 27, 2026  
**Scope:** `/brochures` — WhatsApp flyer + PDF brochure generation  
**Goal:** Flyers that showcase listing photos with a branded banner and footer

---

## Current state

`/brochures` already generates two formats from live property data:

| Piece | PDF (A4) | WhatsApp flyer (1080×1350) |
|-------|----------|----------------------------|
| Listing photos | Cover only | Cover only (top 720px) |
| Brand header | Org name + operation in `brand_color` band | No dedicated banner — brand color fills the info panel |
| Brand footer | Agent + org in `brand_color` band | Semi-transparent band with agent, org, listing URL |
| Org logo | Not used | Not used |
| Brand color | From `/settings` → Marca | Same |
| Studio UX | Section toggles, no live preview | Inline preview only after generate |

**Pipeline:** `BrochureStudio` → `generateBrochure` → `buildBrochureData` → `renderFlyerImage` / `renderBrochurePdf`.

**Key files:**

- `src/app/(app)/brochures/page.tsx` — page shell
- `src/app/(app)/brochures/BrochureStudio.tsx` — generator UI
- `src/lib/domain/brochures.ts` — data assembly + storage
- `src/lib/brochures/flyer.ts` — WhatsApp flyer renderer
- `src/lib/brochures/pdf.ts` — A4 PDF renderer
- `src/lib/brochures/types.ts` — layout sections + `BrochureData`
- `src/app/(app)/settings/AccountPanels.tsx` — org branding (name + color only today)

---

## Gaps vs target

Target: **listing images + branding banner + footer**.

| Gap | Detail |
|-----|--------|
| Single image only | `buildBrochureData` loads one photo (`.limit(1)` on `property_media`) |
| Logo unused | `organizations.logo_url` exists in schema; never passed to renderers; no upload UI in settings |
| Flyer layout | No dedicated brand banner; no photo strip; footer is a semi-transparent overlay, not a branded band |

---

## Target flyer layout

Fixed structure for WhatsApp flyer (1080×1350):

```
┌─────────────────────────┐
│  BRAND BANNER (~80px)    │  logo + org name, brand_color background
├─────────────────────────┤
│  HERO PHOTO (~480px)     │  cover image, cover-fit
├─────────────────────────┤
│  PHOTO STRIP (~160px)    │  up to 12 additional listing photos
├─────────────────────────┤
│  INFO PANEL (flex)       │  title, price, specs, amenities
├─────────────────────────┤
│  FOOTER (~140px)         │  agent · phone · listing URL + QR codes (listing + WhatsApp)
└─────────────────────────┘
```

### QR codes

- **Listing QR:** encodes the public property URL (`/p/{slug}`), placed in the footer with label "Ver ficha".
- **WhatsApp QR:** encodes `https://wa.me/{digits}` from the agent's profile phone (E.164 via `normalizePhone`), label "WhatsApp".
- **Toggles:** studio checkboxes `qrListing` / `qrWhatsapp` (both on by default).
- **PDF:** same QR PNGs embedded in the footer band (56×56px).
- **Library:** `qrcode` npm package → PNG buffers embedded by canvas (flyer) and pdf-lib (PDF).

### Photo strip rules

- **Capacity:** up to **12 images** in the strip (excluding the hero).
- **Source:** remaining `property_media` rows after cover, ordered by `is_cover DESC`, `position ASC`.
- **Layout:** horizontal scroll-style grid within the 160px band — e.g. 6 columns × 2 rows when 7–12 photos, fewer rows when fewer photos.
- **Fallback:** if no extra photos, omit the strip (hero expands or info panel gains space).
- **Studio control:** photo picker lets agents choose which images appear in hero vs strip (default: cover = hero, next 12 = strip).

---

## Implementation phases

### Phase A — Flyer layout (highest impact)

Redesign `renderFlyerImage` to the structure above.

**Files:** `src/lib/brochures/flyer.ts`, `src/lib/brochures/types.ts`, `src/lib/domain/brochures.ts`

**Data changes:**

- Extend `BrochureData`:
  - `logoJpeg: Buffer | null`
  - `galleryJpegs: Buffer[]` — up to 12 images for the photo strip
- Load up to **13 photos** total in `buildBrochureData` (1 hero + 12 strip), reusing existing fetch/normalize path (public URL → R2 → Supabase fallback → sharp JPEG).

```typescript
// src/lib/brochures/types.ts
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
  galleryJpegs: Buffer[]; // max 12 — photo strip
  listingUrl: string | null;
};
```

```typescript
// buildBrochureData — media query
.limit(13) // was .limit(1): 1 hero + up to 12 strip

// After normalize loop:
coverJpeg = jpegs[0] ?? null;
galleryJpegs = jpegs.slice(1, 13); // max 12
logoJpeg = await fetchAndNormalizeLogo(organization.logo_url);
```

**Photo strip rendering (flyer.ts):**

- Strip height: **160px** fixed.
- Tile each gallery image with `cover` fit into equal-width cells.
- Suggested grid by count:
  - 1–3 photos: single row
  - 4–6 photos: one row, smaller tiles
  - 7–12 photos: two rows of up to 6 columns
- 2px gutter between tiles; white or brand-color background in gaps.

---

### Phase B — Wire org logo into branding

1. **Settings:** logo upload in `BrandingPanel` → store in R2/documents bucket → save `organizations.logo_url`.
2. **Brochure data:** fetch logo in `buildBrochureData`, normalize with sharp (PNG/WebP → JPEG for canvas).
3. **Renderers:** draw logo left-aligned in banner; org name beside it; text-only fallback if no logo.

**Files:** `src/app/(app)/settings/AccountPanels.tsx`, `src/lib/domain/account.ts`, `src/lib/brochures/flyer.ts`, `src/lib/brochures/pdf.ts`

---

### Phase C — Studio UX

| Feature | Why |
|---------|-----|
| Live preview | Pick property + format → see layout before generating |
| Photo picker | Checkbox grid of property photos; default = cover hero + next 12 in strip |
| Default format = flyer | WhatsApp-first market; PDF secondary |
| Post-generate actions | "Descargar" + deep-link to WhatsApp with image URL |

Minimal preview: when property is selected, show thumbnail strip + mock banner/footer using org brand color from page props or a lightweight preview endpoint.

---

### Phase D — Align PDF with same branding model

Apply the same `BrochureData` shape to `pdf.ts`:

- Logo in header band
- Optional gallery section (new `"gallery"` section type) — up to 12 thumbnails on A4 (may need second page or compact grid)
- Footer with listing URL (PDF footer currently omits public link)

Add `"gallery"` to `BROCHURE_SECTIONS` in `types.ts` and expose in `BrochureStudio`.

---

## Out of scope (for now)

- **Freeform drag-drop canvas** — backlog; section-based layout is enough for V1 flyers
- **Headless Chromium** — keep `@napi-rs/canvas` + pdf-lib for serverless
- **Multiple flyer templates** — one polished WhatsApp layout first

---

## Suggested first slice (1–2 days)

1. Load up to 13 photos + logo in `buildBrochureData`
2. Redesign flyer: brand banner → hero → **12-image photo strip** → info → branded footer
3. Add logo upload to `/settings` → Marca
4. Default studio to **flyer** format; show thumbnail picker when property is selected

**Exit criteria:** agent selects a property with 12+ photos, generates a WhatsApp flyer with org logo in the banner, hero cover, up to 12 photos in the strip, and agent + listing URL in the branded footer.

---

## Tests to add

- `renderFlyerImage` with 0, 1, 6, 12 gallery images — output remains 1080×1350 JPEG
- Photo strip omitted when `galleryJpegs` is empty
- Logo present vs absent in banner
- `buildBrochureData` caps gallery at 12 when property has 20+ photos

**File:** `tests/brochures.test.ts`
