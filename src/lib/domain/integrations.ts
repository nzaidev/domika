import "server-only";

import type {
  MetaLeadPageRow,
  WhatsappAccountRow,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Self-service connection of Meta integrations (WhatsApp Cloud API number,
// Lead Ads page). Access tokens are write-only from the UI: reads expose
// only whether a token is present, never its value.

export type WhatsappAccountView = Omit<WhatsappAccountRow, "access_token"> & {
  hasToken: boolean;
};

export type MetaPageView = Omit<MetaLeadPageRow, "access_token"> & {
  hasToken: boolean;
};

export type IntegrationsState = {
  whatsappAccounts: WhatsappAccountView[];
  metaPages: MetaPageView[];
};

export async function getIntegrationsState(): Promise<IntegrationsState> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { whatsappAccounts: [], metaPages: [] };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [accounts, pages] = await Promise.all([
    supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("meta_lead_pages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    whatsappAccounts: (accounts.data ?? []).map(
      ({ access_token, ...rest }) => ({
        ...rest,
        hasToken: Boolean(access_token),
      }),
    ),
    metaPages: (pages.data ?? []).map(({ access_token, ...rest }) => ({
      ...rest,
      hasToken: Boolean(access_token),
    })),
  };
}

export type IntegrationResult = { ok: true } | { ok: false; error: string };

type AdminContext =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<AdminContext> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return {
      ok: false,
      error: "Solo propietarios y administradores pueden configurar integraciones.",
    };
  }

  return { ok: true, organizationId: session.profile.organization_id };
}

export async function upsertWhatsappAccount(input: {
  phoneNumberId: string;
  displayPhoneNumber?: string | null;
  wabaId?: string | null;
  accessToken?: string | null; // empty = keep existing
}): Promise<IntegrationResult> {
  const context = await requireAdmin();

  if (context.ok === false) {
    return context;
  }

  const phoneNumberId = input.phoneNumberId.trim();

  if (!/^\d{5,}$/.test(phoneNumberId)) {
    return {
      ok: false,
      error: "El phone_number_id debe ser el ID numérico de Meta (no el teléfono).",
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: existing } = await supabase
    .from("whatsapp_accounts")
    .select("id, organization_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (existing && existing.organization_id !== context.organizationId) {
    return {
      ok: false,
      error: "Ese número ya está conectado a otra organización.",
    };
  }

  const values: Partial<WhatsappAccountRow> = {
    organization_id: context.organizationId,
    phone_number_id: phoneNumberId,
    display_phone_number: input.displayPhoneNumber?.trim() || null,
    waba_id: input.wabaId?.trim() || null,
    active: true,
  };

  if (input.accessToken?.trim()) {
    values.access_token = input.accessToken.trim();
  }

  const { error } = existing
    ? await supabase
        .from("whatsapp_accounts")
        .update(values)
        .eq("id", existing.id)
    : await supabase.from("whatsapp_accounts").insert(values);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteWhatsappAccount(
  accountId: string,
): Promise<IntegrationResult> {
  const context = await requireAdmin();

  if (context.ok === false) {
    return context;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_accounts")
    .delete()
    .eq("id", accountId)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function upsertMetaLeadPage(input: {
  pageId: string;
  pageName?: string | null;
  accessToken?: string | null;
}): Promise<IntegrationResult> {
  const context = await requireAdmin();

  if (context.ok === false) {
    return context;
  }

  const pageId = input.pageId.trim();

  if (!/^\d{5,}$/.test(pageId)) {
    return { ok: false, error: "El page_id debe ser el ID numérico de la página." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: existing } = await supabase
    .from("meta_lead_pages")
    .select("id, organization_id")
    .eq("page_id", pageId)
    .maybeSingle();

  if (existing && existing.organization_id !== context.organizationId) {
    return {
      ok: false,
      error: "Esa página ya está conectada a otra organización.",
    };
  }

  const values: Partial<MetaLeadPageRow> = {
    organization_id: context.organizationId,
    page_id: pageId,
    page_name: input.pageName?.trim() || null,
    active: true,
  };

  if (input.accessToken?.trim()) {
    values.access_token = input.accessToken.trim();
  }

  const { error } = existing
    ? await supabase.from("meta_lead_pages").update(values).eq("id", existing.id)
    : await supabase.from("meta_lead_pages").insert(values);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteMetaLeadPage(
  pageId: string,
): Promise<IntegrationResult> {
  const context = await requireAdmin();

  if (context.ok === false) {
    return context;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("meta_lead_pages")
    .delete()
    .eq("id", pageId)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
