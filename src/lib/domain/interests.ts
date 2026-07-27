import "server-only";

import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";

// Buyer-interest links between prospectos (leads) and propiedades.
// Optional, bidirectional. Soft-guarded so pages don't crash before
// migration 0009 is applied.

export type InterestedLead = {
  interestId: string;
  leadId: string;
  fullName: string;
  phone: string | null;
  stageName: string | null;
};

export type InterestProperty = {
  interestId: string;
  propertyId: string;
  title: string;
  price: number | null;
  currency: string;
  city: string | null;
  zone: string | null;
  status: string;
  coverUrl: string | null;
};

// Properties a lead is interested in + candidates to add.
export async function getLeadInterests(leadId: string): Promise<{
  linked: InterestProperty[];
  options: Array<{ id: string; title: string }>;
}> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { linked: [], options: [] };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: interests, error } = await supabase
    .from("lead_property_interests")
    .select("id, property_id")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId);

  const { data: allProps } = await supabase
    .from("properties")
    .select("id, title, price, currency, city, zone, status")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(300);

  const propsById = new Map((allProps ?? []).map((p) => [p.id, p]));
  const linkedRows = error ? [] : (interests ?? []);
  const linkedIds = linkedRows.map((r) => r.property_id);

  const covers = await coversFor(supabase, organizationId, linkedIds);

  const linked: InterestProperty[] = linkedRows
    .map((row) => {
      const p = propsById.get(row.property_id);
      if (!p) return null;
      return {
        interestId: row.id,
        propertyId: p.id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        city: p.city,
        zone: p.zone,
        status: p.status,
        coverUrl: covers.get(p.id) ?? null,
      };
    })
    .filter(Boolean) as InterestProperty[];

  const linkedSet = new Set(linkedIds);
  const options = (allProps ?? [])
    .filter((p) => !linkedSet.has(p.id))
    .map((p) => ({ id: p.id, title: p.title }));

  return { linked, options };
}

// Prospectos interested in a property + candidates to add.
export async function getPropertyInterests(propertyId: string): Promise<{
  linked: InterestedLead[];
  options: Array<{ id: string; full_name: string }>;
}> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { linked: [], options: [] };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: interests, error } = await supabase
    .from("lead_property_interests")
    .select("id, lead_id")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId);

  const [{ data: allLeads }, { data: stages }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, phone, stage_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("organization_id", organizationId),
  ]);

  const leadsById = new Map((allLeads ?? []).map((l) => [l.id, l]));
  const stageNames = new Map((stages ?? []).map((s) => [s.id, s.name]));
  const linkedRows = error ? [] : (interests ?? []);

  const linked: InterestedLead[] = linkedRows
    .map((row) => {
      const l = leadsById.get(row.lead_id);
      if (!l) return null;
      return {
        interestId: row.id,
        leadId: l.id,
        fullName: l.full_name,
        phone: l.phone,
        stageName: l.stage_id ? (stageNames.get(l.stage_id) ?? null) : null,
      };
    })
    .filter(Boolean) as InterestedLead[];

  const linkedSet = new Set(linkedRows.map((r) => r.lead_id));
  const options = (allLeads ?? [])
    .filter((l) => !linkedSet.has(l.id))
    .map((l) => ({ id: l.id, full_name: l.full_name }));

  return { linked, options };
}

export type InterestResult = { ok: true } | { ok: false; error: string };

export async function addInterest(input: {
  leadId: string;
  propertyId: string;
}): Promise<InterestResult> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  // Both records must belong to the caller's org.
  const [lead, property] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name")
      .eq("id", input.leadId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, title")
      .eq("id", input.propertyId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (!lead.data || !property.data) {
    return { ok: false, error: "Prospecto o propiedad no encontrados." };
  }

  const { error } = await supabase.from("lead_property_interests").upsert(
    {
      organization_id: organizationId,
      lead_id: input.leadId,
      property_id: input.propertyId,
      created_by: session.profile.id,
    },
    { onConflict: "organization_id,lead_id,property_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  // Timeline entry on the lead for context.
  await supabase.from("lead_activities").insert({
    organization_id: organizationId,
    lead_id: input.leadId,
    actor_profile_id: session.profile.id,
    activity_type: "property",
    title: `Interesado en: ${property.data.title}`,
  });

  return { ok: true };
}

export async function removeInterest(input: {
  leadId: string;
  propertyId: string;
}): Promise<InterestResult> {
  const session = await getSessionProfile();
  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("lead_property_interests")
    .delete()
    .eq("organization_id", session.profile.organization_id)
    .eq("lead_id", input.leadId)
    .eq("property_id", input.propertyId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

async function coversFor(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  organizationId: string,
  propertyIds: string[],
): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (propertyIds.length === 0) {
    return covers;
  }
  const { data } = await supabase
    .from("property_media")
    .select("property_id, storage_path, is_cover, position")
    .eq("organization_id", organizationId)
    .in("property_id", propertyIds)
    .order("is_cover", { ascending: false })
    .order("position", { ascending: true });
  for (const item of data ?? []) {
    if (!covers.has(item.property_id)) {
      covers.set(item.property_id, mediaUrl(item.storage_path));
    }
  }
  return covers;
}
