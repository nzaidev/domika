/**
 * Live verification: real Supabase property media → brochure render pipeline.
 * Run: npx vitest run tests/brochures-live.test.ts
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { renderFlyerImage } from "@/lib/brochures/flyer";
import { buildBrochureQrImages } from "@/lib/brochures/qr";
import {
  fetchRemoteImageAsJpeg,
  fetchStorageImageAsJpeg,
} from "@/lib/brochures/images";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DEFAULT_LAYOUT, type BrochureData } from "@/lib/brochures/types";
import { writeFileSync } from "node:fs";

const hasLive =
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

describe.skipIf(!hasLive)("brochures live pipeline", () => {
  it("renders a flyer from real property media in Supabase", async () => {
    const supabase = createAdminSupabaseClient();

    const { data: mediaRows, error: mediaError } = await supabase
      .from("property_media")
      .select(
        "id, property_id, organization_id, storage_path, public_url, is_cover, position",
      )
      .order("created_at", { ascending: false })
      .limit(20);

    expect(mediaError).toBeNull();
    expect(mediaRows?.length ?? 0).toBeGreaterThan(0);

    const propertyId = mediaRows![0].property_id;
    const organizationId = mediaRows![0].organization_id;

    const propertyMedia = mediaRows!
      .filter((row) => row.property_id === propertyId)
      .sort((a, b) => {
        if (a.is_cover !== b.is_cover) {
          return a.is_cover ? -1 : 1;
        }
        return a.position - b.position;
      });

    const [{ data: property }, { data: organization }] = await Promise.all([
      supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .single(),
      supabase
        .from("organizations")
        .select("name, brand_color, logo_url")
        .eq("id", organizationId)
        .single(),
    ]);

    expect(property).toBeTruthy();
    expect(organization).toBeTruthy();

    const jpegs: Buffer[] = [];
    for (const row of propertyMedia.slice(0, 13)) {
      const jpeg = await fetchStorageImageAsJpeg(
        row.storage_path,
        row.public_url,
        supabase,
      );
      if (jpeg) {
        jpegs.push(jpeg);
      }
    }

    expect(jpegs.length).toBeGreaterThan(0);

    const listingUrl = "http://localhost:3000/p/casa-equipetrol-demo";
    const agentPhone = "+59170000001";

    const { listingQrPng, whatsappQrPng } = await buildBrochureQrImages({
      listingUrl,
      agentPhone,
      includeListing: true,
      includeWhatsapp: true,
      size: 280,
    });

    const logoJpeg = organization!.logo_url
      ? await fetchRemoteImageAsJpeg(organization!.logo_url)
      : null;

    const data: BrochureData = {
      title: property!.title,
      priceLabel: property!.price ? `$${property!.price}` : "Precio a consultar",
      operationLabel: "En venta",
      location: [property!.zone, property!.city].filter(Boolean).join(", "),
      specs: [],
      description: property!.description,
      amenities: Array.isArray(property!.amenities)
        ? (property!.amenities as string[])
        : [],
      organizationName: organization!.name,
      brandColor: organization!.brand_color || "#0B1B3A",
      agentName: "Agente Demo",
      agentPhone,
      coverJpeg: jpegs[0] ?? null,
      logoJpeg,
      galleryJpegs: jpegs.slice(1, 13),
      listingUrl,
      listingQrPng,
      whatsappQrPng,
    };

    const flyer = await renderFlyerImage(data, DEFAULT_LAYOUT.sections);
    const meta = await sharp(flyer).metadata();

    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
    expect(flyer.length).toBeGreaterThan(30_000);

    const out = "/tmp/domika-flyer-live.jpg";
    writeFileSync(out, flyer);

    console.log(
      `[live] property=${property!.title} photos=${jpegs.length} gallery=${data.galleryJpegs.length} logo=${logoJpeg ? "yes" : "no"} → ${out} (${flyer.length} bytes)`,
    );
  }, 60_000);
});

describe.skipIf(!hasLive)("brochures live HTTP", () => {
  it("GET /brochures redirects unauthenticated users to sign-in", async () => {
    const res = await fetch("http://localhost:3000/brochures", {
      redirect: "manual",
    });
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/sign-in/);
  });

  it("GET media API returns 401 without session", async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: row } = await supabase
      .from("property_media")
      .select("property_id")
      .limit(1)
      .maybeSingle();

    if (!row?.property_id) {
      return;
    }

    const res = await fetch(
      `http://localhost:3000/api/brochures/properties/${row.property_id}/media`,
    );
    expect(res.status).toBe(401);
  });
});
