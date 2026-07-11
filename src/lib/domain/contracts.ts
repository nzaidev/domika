import "server-only";

import { randomUUID } from "node:crypto";
import type {
  ContractRow,
  ContractTemplateRow,
  DocumentStatus,
  SignatureStatus,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { renderContractPdf } from "@/lib/brochures/contract-pdf";

// Contracts: {{variable}} templates auto-filled from lead + property + org
// + agent, rendered to PDF, stored in the PRIVATE `documents` bucket
// (migration 0006) and served only through the authed, org-checked
// /api/documents route — never through the public media domain.

export const CONTRACT_TYPES = [
  "captación",
  "reserva",
  "alquiler",
  "promesa",
  "comisión",
] as const;

export const CONTRACT_VARIABLES = [
  "lead_name",
  "lead_phone",
  "lead_email",
  "property_title",
  "property_address",
  "property_city",
  "property_zone",
  "property_price",
  "owner_name",
  "owner_phone",
  "organization_name",
  "agent_name",
  "agent_phone",
  "date",
] as const;

export function fillTemplate(
  body: string,
  values: Record<string, string | null | undefined>,
): { text: string; missing: string[] } {
  const missing = new Set<string>();

  const text = body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, raw) => {
    const key = String(raw).toLowerCase();
    const value = values[key];

    if (value === null || value === undefined || value === "") {
      missing.add(key);
      return "________";
    }

    return value;
  });

  return { text, missing: [...missing] };
}

export type ContractsOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      templates: ContractTemplateRow[];
      contracts: Array<
        ContractRow & { leadName: string | null; propertyTitle: string | null }
      >;
      leadOptions: Array<{ id: string; full_name: string }>;
      propertyOptions: Array<{ id: string; title: string }>;
    };

export async function getContractsOverview(): Promise<ContractsOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [templates, contracts, leads, properties] = await Promise.all([
    supabase
      .from("contract_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("contracts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("leads")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("properties")
      .select("id, title")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const leadNames = new Map(
    (leads.data ?? []).map((lead) => [lead.id, lead.full_name]),
  );
  const propertyTitles = new Map(
    (properties.data ?? []).map((property) => [property.id, property.title]),
  );

  return {
    status: "ready",
    templates: templates.data ?? [],
    contracts: (contracts.data ?? []).map((contract) => ({
      ...contract,
      leadName: contract.lead_id
        ? (leadNames.get(contract.lead_id) ?? null)
        : null,
      propertyTitle: contract.property_id
        ? (propertyTitles.get(contract.property_id) ?? null)
        : null,
    })),
    leadOptions: leads.data ?? [],
    propertyOptions: properties.data ?? [],
  };
}

export type TemplateMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createContractTemplate(input: {
  name: string;
  contractType: string;
  body: string;
}): Promise<TemplateMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const name = input.name.trim();
  const body = input.body.trim();

  if (name.length < 2) {
    return { ok: false, error: "El nombre de la plantilla es muy corto." };
  }

  if (body.length < 20) {
    return { ok: false, error: "El cuerpo del contrato es muy corto." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("contract_templates").insert({
    organization_id: session.profile.organization_id,
    name,
    contract_type: input.contractType.trim() || "reserva",
    body,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deactivateContractTemplate(
  templateId: string,
): Promise<TemplateMutationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contract_templates")
    .update({ active: false })
    .eq("id", templateId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export type GenerateContractResult =
  | { ok: true; contractId: string; missing: string[] }
  | { ok: false; error: string };

export async function generateContract(input: {
  templateId: string;
  leadId?: string | null;
  propertyId?: string | null;
}): Promise<GenerateContractResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [template, lead, property, organization] = await Promise.all([
    supabase
      .from("contract_templates")
      .select("*")
      .eq("id", input.templateId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    input.leadId
      ? supabase
          .from("leads")
          .select("full_name, phone, email")
          .eq("id", input.leadId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.propertyId
      ? supabase
          .from("properties")
          .select("title, address, city, zone, price, currency, owner_name, owner_phone")
          .eq("id", input.propertyId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single(),
  ]);

  if (!template.data) {
    return { ok: false, error: "La plantilla no existe." };
  }

  const priceLabel =
    property.data?.price !== null && property.data?.price !== undefined
      ? `${property.data.currency === "BOB" ? "Bs" : "$"}${Math.round(property.data.price).toLocaleString("en-US")}`
      : null;

  const values: Record<string, string | null | undefined> = {
    lead_name: lead.data?.full_name,
    lead_phone: lead.data?.phone,
    lead_email: lead.data?.email,
    property_title: property.data?.title,
    property_address: property.data?.address,
    property_city: property.data?.city,
    property_zone: property.data?.zone,
    property_price: priceLabel,
    owner_name: property.data?.owner_name,
    owner_phone: property.data?.owner_phone,
    organization_name: organization.data?.name,
    agent_name: session.profile.full_name,
    agent_phone: session.profile.phone,
    date: new Date().toLocaleDateString("es", { dateStyle: "long" }),
  };

  const { text, missing } = fillTemplate(template.data.body, values);
  const title = `${template.data.name}${lead.data ? ` — ${lead.data.full_name}` : ""}`;

  let pdf: Buffer;

  try {
    pdf = await renderContractPdf({
      title,
      body: text,
      organizationName: organization.data?.name ?? "Domika",
    });
  } catch (error) {
    console.error("[contracts] render failed:", error);
    return { ok: false, error: "No se pudo generar el PDF." };
  }

  const storagePath = `${organizationId}/contracts/${randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, pdf, { contentType: "application/pdf" });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: contract, error: insertError } = await supabase
    .from("contracts")
    .insert({
      organization_id: organizationId,
      lead_id: input.leadId || null,
      property_id: input.propertyId || null,
      template_id: template.data.id,
      created_by: session.profile.id,
      status: "generated",
      signature_status: "pending",
      title,
      variables: { filled: values, missing },
      storage_path: storagePath,
    })
    .select("id")
    .single();

  if (insertError || !contract) {
    await supabase.storage.from("documents").remove([storagePath]);
    return {
      ok: false,
      error: insertError?.message ?? "No se pudo registrar el contrato.",
    };
  }

  if (input.leadId) {
    await supabase.from("lead_activities").insert({
      organization_id: organizationId,
      lead_id: input.leadId,
      actor_profile_id: session.profile.id,
      activity_type: "document",
      title: `Contrato generado: ${template.data.name}`,
    });
  }

  return { ok: true, contractId: contract.id, missing };
}

export type ContractStatusResult = { ok: true } | { ok: false; error: string };

export async function setContractStatus(input: {
  contractId: string;
  status?: DocumentStatus;
  signatureStatus?: SignatureStatus;
}): Promise<ContractStatusResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const update: Partial<ContractRow> = {};

  if (input.status) {
    update.status = input.status;
  }
  if (input.signatureStatus) {
    update.signature_status = input.signatureStatus;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("contracts")
    .update(update)
    .eq("id", input.contractId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
