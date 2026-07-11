import "server-only";

import { normalizePhone } from "@/lib/phone";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const MAX_IMPORT_ROWS = 2000;
const INSERT_CHUNK_SIZE = 500;

export type ImportRowInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  desiredZone?: string | null;
  notes?: string | null;
};

export type ImportRowStatus =
  | "new"
  | "invalid"
  | "duplicate_in_file"
  | "duplicate_phone"
  | "duplicate_email";

export type ImportRowAnalysis = {
  index: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: ImportRowStatus;
};

export type ImportPreview =
  | { ok: true; rows: ImportRowAnalysis[] }
  | { ok: false; error: string };

type AnalysisContext = {
  organizationId: string;
};

async function analyzeRows(
  rows: ImportRowInput[],
  context: AnalysisContext,
): Promise<ImportRowAnalysis[]> {
  const supabase = createAdminSupabaseClient();

  const normalized = rows.map((row, index) => ({
    index,
    fullName: row.fullName.trim(),
    phone: normalizePhone(row.phone),
    email: row.email?.trim().toLowerCase() || null,
    desiredZone: row.desiredZone?.trim() || null,
    notes: row.notes?.trim() || null,
  }));

  const phones = [
    ...new Set(normalized.map((row) => row.phone).filter(Boolean)),
  ] as string[];
  const emails = [
    ...new Set(normalized.map((row) => row.email).filter(Boolean)),
  ] as string[];

  const [existingByPhone, existingByEmail] = await Promise.all([
    phones.length > 0
      ? supabase
          .from("leads")
          .select("phone")
          .eq("organization_id", context.organizationId)
          .in("phone", phones)
      : Promise.resolve({ data: [], error: null }),
    emails.length > 0
      ? supabase
          .from("leads")
          .select("email")
          .eq("organization_id", context.organizationId)
          .in("email", emails)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (existingByPhone.error) {
    throw existingByPhone.error;
  }

  if (existingByEmail.error) {
    throw existingByEmail.error;
  }

  const knownPhones = new Set(
    (existingByPhone.data ?? []).map((lead) => lead.phone),
  );
  const knownEmails = new Set(
    (existingByEmail.data ?? []).map((lead) => lead.email),
  );

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  return normalized.map((row) => {
    let status: ImportRowStatus = "new";

    if (row.fullName.length < 2) {
      status = "invalid";
    } else if (
      (row.phone && seenPhones.has(row.phone)) ||
      (row.email && seenEmails.has(row.email))
    ) {
      status = "duplicate_in_file";
    } else if (row.phone && knownPhones.has(row.phone)) {
      status = "duplicate_phone";
    } else if (row.email && knownEmails.has(row.email)) {
      status = "duplicate_email";
    }

    if (row.phone) {
      seenPhones.add(row.phone);
    }
    if (row.email) {
      seenEmails.add(row.email);
    }

    return {
      index: row.index,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      status,
    };
  });
}

export async function previewLeadsImport(
  rows: ImportRowInput[],
): Promise<ImportPreview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (rows.length === 0) {
    return { ok: false, error: "El archivo no contiene filas." };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Máximo ${MAX_IMPORT_ROWS} filas por importación.`,
    };
  }

  const analyzed = await analyzeRows(rows, {
    organizationId: session.profile.organization_id,
  });

  return { ok: true, rows: analyzed };
}

export type ImportResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string };

export async function importLeads(
  rows: ImportRowInput[],
): Promise<ImportResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (rows.length === 0 || rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: "Cantidad de filas inválida." };
  }

  const organizationId = session.profile.organization_id;

  // Re-analyze server-side; the client preview is advisory only.
  const analyzed = await analyzeRows(rows, { organizationId });
  const importable = analyzed.filter((row) => row.status === "new");

  if (importable.length === 0) {
    return { ok: true, created: 0, skipped: rows.length };
  }

  const supabase = createAdminSupabaseClient();
  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const importedAt = new Date().toISOString();
  const inserts = importable.map((row) => {
    const source = rows[row.index];
    return {
      organization_id: organizationId,
      stage_id: firstStage?.id ?? null,
      assigned_to: session.profile.id,
      full_name: row.fullName,
      phone: row.phone,
      email: row.email,
      desired_zone: source.desiredZone?.trim() || null,
      notes: source.notes?.trim() || null,
      source: "manual" as const,
      source_meta: { import: true, imported_at: importedAt },
    };
  });

  // Bulk import intentionally does NOT fire new-lead automation: a 500-row
  // CSV is a migration, not organic inflow, and per-row follow-up tasks
  // would flood the agenda. Organic paths (manual/WhatsApp/Meta/public) do.
  let created = 0;

  for (let offset = 0; offset < inserts.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = inserts.slice(offset, offset + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from("leads").insert(chunk);

    if (error) {
      return {
        ok: false,
        error: `Se importaron ${created} filas antes de un error: ${error.message}`,
      };
    }

    created += chunk.length;
  }

  return { ok: true, created, skipped: rows.length - created };
}
