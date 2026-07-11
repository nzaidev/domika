import "server-only";

import { normalizePhone } from "@/lib/phone";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { runNewLeadAutomation } from "@/lib/domain/automation";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

// Shapes from the Meta leadgen webhook payload.
export type LeadgenChangeValue = {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  created_time?: number;
};

export type MetaLeadsWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: LeadgenChangeValue }>;
  }>;
};

export type MetaLeadsIngestSummary = {
  received: number;
  created: number;
  duplicates: number;
  unroutable: number;
};

type LeadFieldData = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

// Pulls the submitted form answers from the Graph API. Lead Ads webhooks only
// carry IDs; the actual name/email/phone require a page access token.
async function fetchLeadFieldData(
  leadgenId: string,
  accessToken: string,
): Promise<LeadFieldData | null> {
  try {
    // Token in the Authorization header, never the URL (query strings leak
    // into proxy/access logs far more readily than headers).
    const response = await fetch(
      `${GRAPH_API_BASE}/${leadgenId}?fields=field_data`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      field_data?: Array<{ name?: string; values?: string[] }>;
    };

    const fields = new Map(
      (payload.field_data ?? [])
        .filter((field) => field.name)
        .map((field) => [field.name as string, field.values?.[0] ?? null]),
    );

    return {
      fullName:
        fields.get("full_name") ??
        ([fields.get("first_name"), fields.get("last_name")]
          .filter(Boolean)
          .join(" ") ||
          null),
      email: fields.get("email") ?? null,
      phone: normalizePhone(fields.get("phone_number") ?? fields.get("phone")),
    };
  } catch {
    return null;
  }
}

export async function ingestMetaLeadsWebhook(
  payload: MetaLeadsWebhookPayload,
): Promise<MetaLeadsIngestSummary> {
  const summary: MetaLeadsIngestSummary = {
    received: 0,
    created: 0,
    duplicates: 0,
    unroutable: 0,
  };

  const supabase = createAdminSupabaseClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") {
        continue;
      }

      const value = change.value;
      const leadgenId = value?.leadgen_id;
      const pageId = value?.page_id ?? entry.id;

      if (!leadgenId || !pageId) {
        continue;
      }

      summary.received += 1;

      const { data: page } = await supabase
        .from("meta_lead_pages")
        .select("organization_id, access_token")
        .eq("page_id", pageId)
        .eq("active", true)
        .maybeSingle();

      if (!page) {
        summary.unroutable += 1;
        continue;
      }

      const organizationId = page.organization_id;

      // Webhook deliveries can repeat; leadgen_id is the idempotency key.
      const { data: existingByLeadgen } = await supabase
        .from("leads")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("source_meta->>leadgen_id", leadgenId)
        .maybeSingle();

      if (existingByLeadgen) {
        summary.duplicates += 1;
        continue;
      }

      let pageToken: string | null = null;
      try {
        pageToken = decryptSecret(page.access_token);
      } catch (error) {
        console.error("[meta-leads] token decrypt failed:", error);
      }

      const fieldData = pageToken
        ? await fetchLeadFieldData(leadgenId, pageToken)
        : null;

      // Same person may submit several forms; fold into the existing lead.
      let existingLead: { id: string } | null = null;

      if (fieldData?.phone) {
        const { data } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("phone", fieldData.phone)
          .maybeSingle();
        existingLead = data;
      }

      if (!existingLead && fieldData?.email) {
        const { data } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("email", fieldData.email)
          .maybeSingle();
        existingLead = data;
      }

      const sourceMeta = {
        leadgen_id: leadgenId,
        page_id: pageId,
        form_id: value?.form_id ?? null,
        ad_id: value?.ad_id ?? null,
        adgroup_id: value?.adgroup_id ?? null,
        campaign_id: value?.campaign_id ?? null,
      };

      if (existingLead) {
        await supabase.from("lead_activities").insert({
          organization_id: organizationId,
          lead_id: existingLead.id,
          activity_type: "note",
          title: "Nuevo formulario de Meta Ads",
          body: "El contacto envió otro formulario de Lead Ads.",
          metadata: sourceMeta,
        });
        summary.duplicates += 1;
        continue;
      }

      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("organization_id", organizationId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          organization_id: organizationId,
          stage_id: firstStage?.id ?? null,
          full_name: fieldData?.fullName || `Lead Meta Ads ${leadgenId}`,
          phone: fieldData?.phone ?? null,
          email: fieldData?.email ?? null,
          source: "meta_ads",
          source_meta: sourceMeta,
        })
        .select("id")
        .single();

      if (leadError || !newLead) {
        throw leadError ?? new Error("No se pudo crear el lead de Meta Ads.");
      }

      await supabase.from("lead_activities").insert({
        organization_id: organizationId,
        lead_id: newLead.id,
        activity_type: "message",
        title: "Prospecto creado desde Meta Ads",
        body: fieldData
          ? "Formulario de Lead Ads recibido con datos de contacto."
          : "Formulario recibido; configura el token de página para importar los datos de contacto.",
        metadata: sourceMeta,
      });

      await runNewLeadAutomation({
        organizationId,
        leadId: newLead.id,
        leadName: fieldData?.fullName || `Lead Meta Ads ${leadgenId}`,
        stageId: firstStage?.id ?? null,
      });

      summary.created += 1;
    }
  }

  return summary;
}
