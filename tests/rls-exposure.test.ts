import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// RLS exposure suite: the anon key is public by definition (it ships to
// every browser), so anyone can query PostgREST directly with it. These
// tests run against the REAL Supabase project and assert that the anon
// role can reach exactly what the design allows — and nothing else.
//
// Runs when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are available (from the
// environment or .env.local); skips otherwise (e.g. plain CI).
//
// Known limitation (tracked in development-completed.md): authenticated-
// role simulation needs the project JWT secret or a local Supabase stack;
// this suite covers the anonymous surface only.

function loadEnv(): Record<string, string> {
  const fromProcess: Record<string, string> = {};
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]) {
    if (process.env[key]) {
      fromProcess[key] = process.env[key] as string;
    }
  }

  const envFile = path.join(__dirname, "..", ".env.local");

  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0 && !line.startsWith("#")) {
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (value && !(key in fromProcess)) {
          fromProcess[key] = value;
        }
      }
    }
  }

  return fromProcess;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasEnv = Boolean(url && anonKey);

const anon = hasEnv ? createClient(url, anonKey) : null;

// Every table that must be COMPLETELY invisible to the anonymous role.
const FULLY_PRIVATE_TABLES = [
  "organizations",
  "profiles",
  "invitations",
  "pipeline_stages",
  "leads",
  "pipeline_events",
  "lead_activities",
  "whatsapp_accounts", // holds access tokens
  "whatsapp_threads",
  "whatsapp_messages",
  "meta_lead_pages", // holds access tokens
  "properties", // holds owner PII + address
  "property_media",
  "listing_engagement_events",
  "listing_lead_attributions",
  "property_shares",
  "tasks",
  "brochure_templates",
  "brochures",
  "contract_templates",
  "contracts",
  "buyer_requirements",
  "demand_matches",
  "notifications",
  "email_accounts", // will hold OAuth tokens
  "email_messages",
  "email_sequences",
  "audit_log",
  "automation_rules",
];

describe.skipIf(!hasEnv)("RLS anon exposure (live project)", () => {
  for (const table of FULLY_PRIVATE_TABLES) {
    it(`anon cannot read any row of ${table}`, async () => {
      const { data, error } = await anon!.from(table).select("*").limit(5);
      // RLS yields an empty result set (or a permission error) — never rows.
      if (error) {
        expect(error.message).toBeTruthy();
      } else {
        expect(data).toEqual([]);
      }
    });
  }

  it("anon cannot read the owner-safe view directly (agents-only)", async () => {
    const { data } = await anon!
      .from("properties_network_safe")
      .select("*")
      .limit(5);
    // If this fails with rows, migration 202607110007 has NOT been applied to
    // this project — the anon key can read every org's inventory. Apply it.
    expect(
      data ?? [],
      "properties_network_safe is readable by anon — apply migration 202607110007_lock_down_network_safe_view.sql",
    ).toEqual([]);
  });

  it("anon sees at most published listing_publications (no drafts/unpublished)", async () => {
    const { data, error } = await anon!
      .from("listing_publications")
      .select("status, channel")
      .limit(50);

    if (!error) {
      for (const row of data ?? []) {
        expect(row.status).toBe("published");
        expect(["public_link", "domika_network", "waiboom_feed"]).toContain(
          row.channel,
        );
      }
    }
  });

  it("anon cannot insert a lead directly", async () => {
    const { error } = await anon!.from("leads").insert({
      organization_id: "00000000-0000-4000-8000-000000000001",
      full_name: "RLS Probe",
    });
    expect(error).toBeTruthy();
  });

  it("anon cannot update organizations", async () => {
    const { data, error } = await anon!
      .from("organizations")
      .update({ name: "hacked" })
      .eq("id", "00000000-0000-4000-8000-000000000001")
      .select();
    // Either an explicit error or zero affected rows is acceptable.
    if (!error) {
      expect(data ?? []).toEqual([]);
    }
  });

  it("anon cannot download from the private documents bucket", async () => {
    const { data, error } = await anon!.storage
      .from("documents")
      .download("does-not-matter/probe.pdf");
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it("anon cannot list the private documents bucket", async () => {
    const { data } = await anon!.storage.from("documents").list();
    expect(data ?? []).toEqual([]);
  });

  it("anon CAN call get_public_listing (the sanctioned public read)", async () => {
    const { error } = await anon!.rpc("get_public_listing", {
      p_slug: "rls-probe-nonexistent-slug",
    });
    // Empty result is fine; a permission error is not.
    expect(error).toBeNull();
  });
});
