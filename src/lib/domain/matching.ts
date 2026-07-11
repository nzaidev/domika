import "server-only";

import type {
  BuyerRequirementRow,
  NetworkSafePropertyRow,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MATCH_THRESHOLD, scoreMatch } from "@/lib/matching";
import { mediaUrl } from "@/lib/media";

// Demand matching (plan §8): buyer requirements auto-match against the
// org's own inventory AND other orgs' domika_network-published listings.
// Cross-org candidates are read through the owner-safe view, and match
// cards never carry owner data.

type Supabase = ReturnType<typeof createAdminSupabaseClient>;

async function candidatePropertiesFor(
  supabase: Supabase,
  organizationId: string,
): Promise<Array<NetworkSafePropertyRow & { isNetwork: boolean }>> {
  const [own, published] = await Promise.all([
    supabase
      .from("properties_network_safe")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["available", "reserved"]),
    supabase
      .from("listing_publications")
      .select("property_id, organization_id")
      .eq("channel", "domika_network")
      .eq("status", "published")
      .neq("organization_id", organizationId),
  ]);

  const networkIds = (published.data ?? []).map((pub) => pub.property_id);
  let networkProperties: NetworkSafePropertyRow[] = [];

  if (networkIds.length > 0) {
    const { data } = await supabase
      .from("properties_network_safe")
      .select("*")
      .in("id", networkIds)
      .in("status", ["available", "reserved"]);
    networkProperties = data ?? [];
  }

  return [
    ...(own.data ?? []).map((property) => ({ ...property, isNetwork: false })),
    ...networkProperties.map((property) => ({ ...property, isNetwork: true })),
  ];
}

async function upsertMatches(
  supabase: Supabase,
  requirement: BuyerRequirementRow,
  candidates: Array<NetworkSafePropertyRow & { isNetwork: boolean }>,
): Promise<number> {
  const { data: existing } = await supabase
    .from("demand_matches")
    .select("id, property_id, score")
    .eq("organization_id", requirement.organization_id)
    .eq("buyer_requirement_id", requirement.id);

  const existingByProperty = new Map(
    (existing ?? []).map((match) => [match.property_id, match]),
  );

  let created = 0;

  for (const property of candidates) {
    const { score, reasons } = scoreMatch(requirement, property);
    const current = existingByProperty.get(property.id);

    if (score < MATCH_THRESHOLD) {
      continue;
    }

    if (current) {
      if (Number(current.score) !== score) {
        await supabase
          .from("demand_matches")
          .update({ score, reasons })
          .eq("id", current.id);
      }
      continue;
    }

    const { error } = await supabase.from("demand_matches").insert({
      organization_id: requirement.organization_id,
      buyer_requirement_id: requirement.id,
      property_id: property.id,
      score,
      reasons,
    });

    if (!error) {
      created += 1;
    }
  }

  return created;
}

async function notifyNewMatches(
  supabase: Supabase,
  requirement: BuyerRequirementRow,
  newCount: number,
): Promise<void> {
  if (newCount === 0 || !requirement.created_by) {
    return;
  }

  await supabase.from("notifications").insert({
    organization_id: requirement.organization_id,
    profile_id: requirement.created_by,
    title: `${newCount} nueva${newCount === 1 ? "" : "s"} coincidencia${newCount === 1 ? "" : "s"} de demanda`,
    body: requirement.notes
      ? `Requerimiento: ${requirement.notes.slice(0, 80)}`
      : "Revisa las propiedades sugeridas.",
    metadata: { requirement_id: requirement.id, kind: "demand_match" },
  });
}

export async function runMatchingForRequirement(
  requirementId: string,
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data: requirement } = await supabase
      .from("buyer_requirements")
      .select("*")
      .eq("id", requirementId)
      .eq("active", true)
      .maybeSingle();

    if (!requirement) {
      return;
    }

    const candidates = await candidatePropertiesFor(
      supabase,
      requirement.organization_id,
    );
    const created = await upsertMatches(supabase, requirement, candidates);
    await notifyNewMatches(supabase, requirement, created);
  } catch (error) {
    console.error("[matching] requirement run failed:", error);
  }
}

export async function runMatchingForProperty(
  propertyId: string,
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    const [{ data: property }, { data: publication }] = await Promise.all([
      supabase
        .from("properties_network_safe")
        .select("*")
        .eq("id", propertyId)
        .maybeSingle(),
      supabase
        .from("listing_publications")
        .select("id")
        .eq("property_id", propertyId)
        .eq("channel", "domika_network")
        .eq("status", "published")
        .maybeSingle(),
    ]);

    if (!property || !["available", "reserved"].includes(property.status)) {
      return;
    }

    // Own-org requirements always; other orgs' only if network-published.
    let query = supabase.from("buyer_requirements").select("*").eq("active", true);

    if (!publication) {
      query = query.eq("organization_id", property.organization_id);
    }

    const { data: requirements } = await query.limit(500);

    for (const requirement of requirements ?? []) {
      const isOwn = requirement.organization_id === property.organization_id;

      if (!isOwn && !publication) {
        continue;
      }

      const created = await upsertMatches(supabase, requirement, [
        { ...property, isNetwork: !isOwn },
      ]);
      await notifyNewMatches(supabase, requirement, created);
    }
  } catch (error) {
    console.error("[matching] property run failed:", error);
  }
}

export type RequirementInput = {
  leadId?: string | null;
  propertyType?: string | null;
  operation?: "sale" | "rent" | "investment" | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  city?: string | null;
  zone?: string | null;
  bedroomsMin?: number | null;
  areaMinSqm?: number | null;
  notes?: string | null;
};

export type RequirementResult = { ok: true } | { ok: false; error: string };

export async function createBuyerRequirement(
  input: RequirementInput,
): Promise<RequirementResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const hasCriteria = Boolean(
    input.propertyType ||
      input.operation ||
      input.budgetMin ||
      input.budgetMax ||
      input.city ||
      input.zone ||
      input.bedroomsMin ||
      input.areaMinSqm,
  );

  if (!hasCriteria) {
    return { ok: false, error: "Define al menos un criterio de búsqueda." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: requirement, error } = await supabase
    .from("buyer_requirements")
    .insert({
      organization_id: organizationId,
      lead_id: input.leadId || null,
      created_by: session.profile.id,
      property_type: input.propertyType?.trim() || null,
      operation: input.operation || null,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      city: input.city?.trim() || null,
      zone: input.zone?.trim() || null,
      bedrooms_min: input.bedroomsMin ?? null,
      area_min_sqm: input.areaMinSqm ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !requirement) {
    return { ok: false, error: error?.message ?? "No se pudo crear." };
  }

  if (input.leadId) {
    await supabase.from("lead_activities").insert({
      organization_id: organizationId,
      lead_id: input.leadId,
      actor_profile_id: session.profile.id,
      activity_type: "note",
      title: "Requerimiento de búsqueda registrado",
    });
  }

  await runMatchingForRequirement(requirement.id);

  return { ok: true };
}

export async function deactivateRequirement(
  requirementId: string,
): Promise<RequirementResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("buyer_requirements")
    .update({ active: false })
    .eq("id", requirementId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export type MatchCard = {
  matchId: string;
  score: number;
  reasons: string[];
  propertyId: string;
  title: string;
  price: number | null;
  currency: string;
  city: string | null;
  zone: string | null;
  coverUrl: string | null;
  isNetwork: boolean;
  organizationName: string | null;
  networkSlug: string | null;
};

export type RequirementWithMatches = BuyerRequirementRow & {
  leadName: string | null;
  matches: MatchCard[];
};

export type MatchingOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      requirements: RequirementWithMatches[];
      leadOptions: Array<{ id: string; full_name: string }>;
    };

export async function getMatchingOverview(): Promise<MatchingOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [requirements, leads] = await Promise.all([
    supabase
      .from("buyer_requirements")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const requirementRows = requirements.data ?? [];
  const leadNames = new Map(
    (leads.data ?? []).map((lead) => [lead.id, lead.full_name]),
  );

  if (requirementRows.length === 0) {
    return {
      status: "ready",
      requirements: [],
      leadOptions: leads.data ?? [],
    };
  }

  const { data: matches } = await supabase
    .from("demand_matches")
    .select("*")
    .eq("organization_id", organizationId)
    .in(
      "buyer_requirement_id",
      requirementRows.map((requirement) => requirement.id),
    )
    .order("score", { ascending: false });

  const matchRows = matches ?? [];
  const propertyIds = [...new Set(matchRows.map((match) => match.property_id))];

  let propertiesById = new Map<string, NetworkSafePropertyRow>();
  const covers = new Map<string, string>();
  const orgNames = new Map<string, string>();
  const slugs = new Map<string, string>();

  if (propertyIds.length > 0) {
    const [properties, media, organizations, publications] = await Promise.all([
      supabase.from("properties_network_safe").select("*").in("id", propertyIds),
      supabase
        .from("property_media")
        .select("property_id, storage_path, is_cover, position")
        .in("property_id", propertyIds)
        .order("is_cover", { ascending: false })
        .order("position", { ascending: true }),
      supabase.from("organizations").select("id, name"),
      supabase
        .from("listing_publications")
        .select("property_id, public_slug")
        .eq("channel", "domika_network")
        .eq("status", "published")
        .in("property_id", propertyIds),
    ]);

    propertiesById = new Map(
      (properties.data ?? []).map((property) => [property.id, property]),
    );
    for (const item of media.data ?? []) {
      if (!covers.has(item.property_id)) {
        covers.set(item.property_id, mediaUrl(item.storage_path));
      }
    }
    for (const org of organizations.data ?? []) {
      orgNames.set(org.id, org.name);
    }
    for (const pub of publications.data ?? []) {
      if (pub.public_slug) {
        slugs.set(pub.property_id, pub.public_slug);
      }
    }
  }

  const matchesByRequirement = new Map<string, MatchCard[]>();

  for (const match of matchRows) {
    const property = propertiesById.get(match.property_id);

    if (!property) {
      continue;
    }

    const isNetwork = property.organization_id !== organizationId;
    const card: MatchCard = {
      matchId: match.id,
      score: Number(match.score),
      reasons: Array.isArray(match.reasons) ? (match.reasons as string[]) : [],
      propertyId: property.id,
      title: property.title,
      price: property.price,
      currency: property.currency,
      city: property.city,
      zone: property.zone,
      coverUrl: covers.get(property.id) ?? null,
      isNetwork,
      organizationName: isNetwork
        ? (orgNames.get(property.organization_id) ?? "Organización")
        : null,
      networkSlug: isNetwork ? (slugs.get(property.id) ?? null) : null,
    };

    const list = matchesByRequirement.get(match.buyer_requirement_id) ?? [];
    list.push(card);
    matchesByRequirement.set(match.buyer_requirement_id, list);
  }

  return {
    status: "ready",
    requirements: requirementRows.map((requirement) => ({
      ...requirement,
      leadName: requirement.lead_id
        ? (leadNames.get(requirement.lead_id) ?? null)
        : null,
      matches: matchesByRequirement.get(requirement.id) ?? [],
    })),
    leadOptions: leads.data ?? [],
  };
}
