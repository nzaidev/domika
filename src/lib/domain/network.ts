import "server-only";

import { randomBytes } from "node:crypto";
import type {
  NetworkSafePropertyRow,
  PropertyRow,
  SharePermission,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import { runMatchingForProperty } from "@/lib/domain/matching";

// Agent collaboration network: direct shares (agent/org, permission levels,
// expiry, view tracking via audit_log) and the Domika network channel
// (listing_publications channel = domika_network).
//
// PII posture: every cross-org read goes through the properties_network_safe
// VIEW, which physically excludes owner_* and address at the database level
// (migration 0006) — application code cannot leak what it never receives.
// Only a "full"-permission share fetches owner fields, via an explicit
// separate query.

// PropertyRow shape with owner_*/address nulled; cross-org pages consume this.
export type SafeProperty = PropertyRow;

function toSafeProperty(row: NetworkSafePropertyRow): SafeProperty {
  return {
    ...row,
    address: null,
    owner_name: null,
    owner_phone: null,
    owner_email: null,
    owner_notes: null,
  };
}

async function coversFor(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  propertyIds: string[],
): Promise<Map<string, string | null>> {
  const covers = new Map<string, string | null>();

  if (propertyIds.length === 0) {
    return covers;
  }

  const { data } = await supabase
    .from("property_media")
    .select("property_id, storage_path, is_cover, position")
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

export type NetworkListing = {
  publicationId: string;
  slug: string | null;
  organizationName: string;
  title: string;
  propertyType: string;
  operation: PropertyRow["operation"];
  price: number | null;
  currency: string;
  city: string | null;
  zone: string | null;
  coverUrl: string | null;
  viewCount: number;
};

export type IncomingShare = {
  shareId: string;
  permission: SharePermission;
  expiresAt: string | null;
  sharedByOrganization: string;
  title: string;
  city: string | null;
  zone: string | null;
  price: number | null;
  currency: string;
  coverUrl: string | null;
};

export type OutgoingShare = {
  shareId: string;
  propertyId: string;
  propertyTitle: string;
  recipientLabel: string;
  permission: SharePermission;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
};

export type NetworkOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      networkListings: NetworkListing[];
      sharedWithMe: IncomingShare[];
      myShares: OutgoingShare[];
    };

function isActiveShare(share: { expires_at: string | null }): boolean {
  return !share.expires_at || new Date(share.expires_at).getTime() > Date.now();
}

export async function getNetworkOverview(): Promise<NetworkOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const profileId = session.profile.id;
  const supabase = createAdminSupabaseClient();

  const [publications, incoming, outgoing, organizations] = await Promise.all([
    supabase
      .from("listing_publications")
      .select("*")
      .eq("channel", "domika_network")
      .eq("status", "published")
      .neq("organization_id", organizationId)
      .order("published_at", { ascending: false })
      .limit(100),
    supabase
      .from("property_shares")
      .select("*")
      .or(
        `shared_with_profile_id.eq.${profileId},shared_with_organization_id.eq.${organizationId}`,
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("property_shares")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("organizations").select("id, name"),
  ]);

  const orgNames = new Map(
    (organizations.data ?? []).map((org) => [org.id, org.name]),
  );

  // --- Network feed (other orgs' published listings) ---
  const pubs = publications.data ?? [];
  const pubPropertyIds = pubs.map((pub) => pub.property_id);

  const [pubProperties, pubCovers, viewEvents] = await Promise.all([
    pubPropertyIds.length > 0
      ? supabase
          .from("properties_network_safe")
          .select("*")
          .in("id", pubPropertyIds)
      : Promise.resolve({ data: [] as NetworkSafePropertyRow[], error: null }),
    coversFor(supabase, pubPropertyIds),
    pubs.length > 0
      ? supabase
          .from("listing_engagement_events")
          .select("listing_publication_id")
          .in(
            "listing_publication_id",
            pubs.map((pub) => pub.id),
          )
          .eq("event_type", "view")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const viewCounts = new Map<string, number>();
  for (const event of viewEvents.data ?? []) {
    viewCounts.set(
      event.listing_publication_id,
      (viewCounts.get(event.listing_publication_id) ?? 0) + 1,
    );
  }

  const propertyById = new Map(
    (pubProperties.data ?? []).map((property) => [property.id, property]),
  );

  const networkListings: NetworkListing[] = pubs
    .map((pub) => {
      const property = propertyById.get(pub.property_id);
      if (!property) {
        return null;
      }
      return {
        publicationId: pub.id,
        slug: pub.public_slug,
        organizationName: orgNames.get(pub.organization_id) ?? "Organización",
        title: property.title,
        propertyType: property.property_type,
        operation: property.operation,
        price: property.price,
        currency: property.currency,
        city: property.city,
        zone: property.zone,
        coverUrl: pubCovers.get(property.id) ?? null,
        viewCount: viewCounts.get(pub.id) ?? 0,
      };
    })
    .filter(Boolean) as NetworkListing[];

  // --- Shares addressed to me / my org ---
  const incomingShares = (incoming.data ?? []).filter(
    (share) => share.organization_id !== organizationId && isActiveShare(share),
  );
  const incomingPropertyIds = incomingShares.map((share) => share.property_id);

  const [incomingProperties, incomingCovers] = await Promise.all([
    incomingPropertyIds.length > 0
      ? supabase
          .from("properties_network_safe")
          .select("*")
          .in("id", incomingPropertyIds)
      : Promise.resolve({ data: [] as NetworkSafePropertyRow[], error: null }),
    coversFor(supabase, incomingPropertyIds),
  ]);

  const incomingPropertyById = new Map(
    (incomingProperties.data ?? []).map((property) => [property.id, property]),
  );

  const sharedWithMe: IncomingShare[] = incomingShares
    .map((share) => {
      const property = incomingPropertyById.get(share.property_id);
      if (!property) {
        return null;
      }
      return {
        shareId: share.id,
        permission: share.permission,
        expiresAt: share.expires_at,
        sharedByOrganization:
          orgNames.get(share.organization_id) ?? "Organización",
        title: property.title,
        city: property.city,
        zone: property.zone,
        price: property.price,
        currency: property.currency,
        coverUrl: incomingCovers.get(property.id) ?? null,
      };
    })
    .filter(Boolean) as IncomingShare[];

  // --- Shares my org created ---
  const outgoingShares = outgoing.data ?? [];
  const outgoingPropertyIds = [
    ...new Set(outgoingShares.map((share) => share.property_id)),
  ];

  const [outgoingProperties, recipients, shareViews] = await Promise.all([
    outgoingPropertyIds.length > 0
      ? supabase
          .from("properties")
          .select("id, title")
          .in("id", outgoingPropertyIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("id, full_name, organization_id"),
    outgoingShares.length > 0
      ? supabase
          .from("audit_log")
          .select("target_id")
          .eq("action", "share_viewed")
          .in(
            "target_id",
            outgoingShares.map((share) => share.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const outgoingTitles = new Map(
    (outgoingProperties.data ?? []).map((p) => [p.id, p.title]),
  );
  const profileNames = new Map(
    (recipients.data ?? []).map((p) => [
      p.id,
      { name: p.full_name, orgId: p.organization_id },
    ]),
  );
  const shareViewCounts = new Map<string, number>();
  for (const view of shareViews.data ?? []) {
    if (view.target_id) {
      shareViewCounts.set(
        view.target_id,
        (shareViewCounts.get(view.target_id) ?? 0) + 1,
      );
    }
  }

  const myShares: OutgoingShare[] = outgoingShares.map((share) => {
    let recipientLabel = "—";

    if (share.shared_with_profile_id) {
      const profile = profileNames.get(share.shared_with_profile_id);
      const orgName = profile ? orgNames.get(profile.orgId) : null;
      recipientLabel = profile
        ? `${profile.name}${orgName ? ` (${orgName})` : ""}`
        : "Agente";
    } else if (share.shared_with_organization_id) {
      recipientLabel = `Org: ${orgNames.get(share.shared_with_organization_id) ?? "—"}`;
    }

    return {
      shareId: share.id,
      propertyId: share.property_id,
      propertyTitle: outgoingTitles.get(share.property_id) ?? "Propiedad",
      recipientLabel,
      permission: share.permission,
      expiresAt: share.expires_at,
      viewCount: shareViewCounts.get(share.id) ?? 0,
      createdAt: share.created_at,
    };
  });

  return { status: "ready", networkListings, sharedWithMe, myShares };
}

export type Directory = {
  organizations: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string; organizationName: string }>;
};

export async function getShareDirectory(): Promise<Directory> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { organizations: [], agents: [] };
  }

  const supabase = createAdminSupabaseClient();
  const [organizations, profiles] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .neq("id", session.profile.organization_id)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, organization_id")
      .neq("organization_id", session.profile.organization_id)
      .eq("active", true)
      .order("full_name"),
  ]);

  const orgNames = new Map(
    (organizations.data ?? []).map((org) => [org.id, org.name]),
  );

  return {
    organizations: organizations.data ?? [],
    agents: (profiles.data ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name,
      organizationName: orgNames.get(profile.organization_id) ?? "—",
    })),
  };
}

export type ShareResult = { ok: true } | { ok: false; error: string };

export async function shareProperty(input: {
  propertyId: string;
  recipient: string; // "org:<id>" | "agent:<id>"
  permission: SharePermission;
  expiresDays?: number | null;
}): Promise<ShareResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", input.propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!property) {
    return { ok: false, error: "La propiedad no existe." };
  }

  const [kind, recipientId] = input.recipient.split(":");

  if (!recipientId || (kind !== "org" && kind !== "agent")) {
    return { ok: false, error: "Selecciona un destinatario." };
  }

  const expiresAt =
    input.expiresDays && input.expiresDays > 0
      ? new Date(
          Date.now() + input.expiresDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

  const { error } = await supabase.from("property_shares").insert({
    organization_id: organizationId,
    property_id: input.propertyId,
    shared_by: session.profile.id,
    shared_with_profile_id: kind === "agent" ? recipientId : null,
    shared_with_organization_id: kind === "org" ? recipientId : null,
    permission: input.permission,
    expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function revokeShare(shareId: string): Promise<ShareResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("property_shares")
    .delete()
    .eq("id", shareId)
    .eq("organization_id", session.profile.organization_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function setNetworkPublication(input: {
  propertyId: string;
  publish: boolean;
  channel?: "domika_network" | "public_link";
}): Promise<ShareResult> {
  const channel = input.channel ?? "domika_network";
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, title")
    .eq("id", input.propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!property) {
    return { ok: false, error: "La propiedad no existe." };
  }

  const { data: existing } = await supabase
    .from("listing_publications")
    .select("id, public_slug")
    .eq("organization_id", organizationId)
    .eq("property_id", input.propertyId)
    .eq("channel", channel)
    .maybeSingle();

  if (input.publish) {
    const slug =
      existing?.public_slug ??
      `${property.title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)}-${randomBytes(3).toString("hex")}`;

    const { error } = existing
      ? await supabase
          .from("listing_publications")
          .update({
            status: "published",
            published_by: session.profile.id,
            published_at: new Date().toISOString(),
            unpublished_at: null,
          })
          .eq("id", existing.id)
      : await supabase.from("listing_publications").insert({
          organization_id: organizationId,
          property_id: input.propertyId,
          channel,
          status: "published",
          public_slug: slug,
          published_by: session.profile.id,
          published_at: new Date().toISOString(),
          options: { hide_owner: true },
        });

    if (error) {
      return { ok: false, error: error.message };
    }

    // Publishing exposes the property to every org's requirements.
    await runMatchingForProperty(input.propertyId);
  } else if (existing) {
    const { error } = await supabase
      .from("listing_publications")
      .update({
        status: "unpublished",
        unpublished_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export type CollaborationState = {
  isPublished: boolean;
  publicSlug: string | null;
  publicLinkActive: boolean;
  publicLinkSlug: string | null;
  shares: OutgoingShare[];
};

export async function getPropertyCollaboration(
  propertyId: string,
): Promise<CollaborationState> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return {
      isPublished: false,
      publicSlug: null,
      publicLinkActive: false,
      publicLinkSlug: null,
      shares: [],
    };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [publications, shares, organizations, profiles] = await Promise.all([
    supabase
      .from("listing_publications")
      .select("channel, status, public_slug")
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .in("channel", ["domika_network", "public_link"]),
    supabase
      .from("property_shares")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name"),
    supabase.from("profiles").select("id, full_name, organization_id"),
  ]);

  const orgNames = new Map(
    (organizations.data ?? []).map((org) => [org.id, org.name]),
  );
  const profileNames = new Map(
    (profiles.data ?? []).map((p) => [
      p.id,
      { name: p.full_name, orgId: p.organization_id },
    ]),
  );

  const shareRows = shares.data ?? [];
  const viewCounts = new Map<string, number>();

  if (shareRows.length > 0) {
    const { data: views } = await supabase
      .from("audit_log")
      .select("target_id")
      .eq("action", "share_viewed")
      .in(
        "target_id",
        shareRows.map((share) => share.id),
      );

    for (const view of views ?? []) {
      if (view.target_id) {
        viewCounts.set(
          view.target_id,
          (viewCounts.get(view.target_id) ?? 0) + 1,
        );
      }
    }
  }

  return {
    isPublished:
      (publications.data ?? []).find((pub) => pub.channel === "domika_network")
        ?.status === "published",
    publicSlug:
      (publications.data ?? []).find((pub) => pub.channel === "domika_network")
        ?.public_slug ?? null,
    publicLinkActive:
      (publications.data ?? []).find((pub) => pub.channel === "public_link")
        ?.status === "published",
    publicLinkSlug:
      (publications.data ?? []).find((pub) => pub.channel === "public_link")
        ?.public_slug ?? null,
    shares: shareRows.map((share) => {
      let recipientLabel = "—";
      if (share.shared_with_profile_id) {
        const profile = profileNames.get(share.shared_with_profile_id);
        const orgName = profile ? orgNames.get(profile.orgId) : null;
        recipientLabel = profile
          ? `${profile.name}${orgName ? ` (${orgName})` : ""}`
          : "Agente";
      } else if (share.shared_with_organization_id) {
        recipientLabel = `Org: ${orgNames.get(share.shared_with_organization_id) ?? "—"}`;
      }
      return {
        shareId: share.id,
        propertyId: share.property_id,
        propertyTitle: "",
        recipientLabel,
        permission: share.permission,
        expiresAt: share.expires_at,
        viewCount: viewCounts.get(share.id) ?? 0,
        createdAt: share.created_at,
      };
    }),
  };
}

export type SharedPropertyView =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "expired" }
  | {
      status: "ready";
      property: SafeProperty;
      permission: SharePermission;
      sharedByOrganization: string;
      media: Array<{ id: string; url: string; alt: string }>;
    };

export async function getSharedPropertyView(
  shareId: string,
): Promise<SharedPropertyView> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: "unauthenticated" };
  }

  const supabase = createAdminSupabaseClient();
  const { data: share } = await supabase
    .from("property_shares")
    .select("*")
    .eq("id", shareId)
    .maybeSingle();

  if (!share) {
    return { status: "not_found" };
  }

  const isRecipient =
    share.shared_with_profile_id === session.profile.id ||
    share.shared_with_organization_id === session.profile.organization_id ||
    share.organization_id === session.profile.organization_id; // owner can preview

  if (!isRecipient) {
    return { status: "not_found" };
  }

  if (!isActiveShare(share)) {
    return { status: "expired" };
  }

  const [{ data: safeRow }, { data: owner }, { data: media }] =
    await Promise.all([
      supabase
        .from("properties_network_safe")
        .select("*")
        .eq("id", share.property_id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("name")
        .eq("id", share.organization_id)
        .maybeSingle(),
      supabase
        .from("property_media")
        .select("id, storage_path, alt_text, position, is_cover")
        .eq("property_id", share.property_id)
        .order("position", { ascending: true }),
    ]);

  if (!safeRow) {
    return { status: "not_found" };
  }

  let property = toSafeProperty(safeRow);

  // Only a "full" share reads owner PII (and the private address), via an
  // explicit second query against the base table.
  if (share.permission === "full") {
    const { data: ownerFields } = await supabase
      .from("properties")
      .select("address, owner_name, owner_phone, owner_email, owner_notes")
      .eq("id", share.property_id)
      .maybeSingle();

    if (ownerFields) {
      property = { ...property, ...ownerFields };
    }
  }

  // Record the view (who/when) unless the owner org is previewing.
  if (share.organization_id !== session.profile.organization_id) {
    await supabase.from("audit_log").insert({
      organization_id: share.organization_id,
      actor_profile_id: session.profile.id,
      action: "share_viewed",
      target_table: "property_shares",
      target_id: share.id,
      metadata: {
        viewer_name: session.profile.full_name,
        viewer_organization_id: session.profile.organization_id,
      },
    });
  }

  return {
    status: "ready",
    property,
    permission: share.permission,
    sharedByOrganization: owner?.name ?? "Organización",
    media: (media ?? []).map((item) => ({
      id: item.id,
      url: mediaUrl(item.storage_path),
      alt: item.alt_text ?? property.title,
    })),
  };
}

export type PublicListingView =
  | { status: "not_found" }
  | {
      status: "ready";
      property: SafeProperty;
      organizationName: string;
      brandColor: string;
      media: Array<{ id: string; url: string; alt: string }>;
    };

// Consumer-facing view: NO session required (this is the shareable page).
// Reads through the owner-safe view; records an anonymous engagement event.
export async function getPublicListingView(
  slug: string,
): Promise<PublicListingView> {
  const supabase = createAdminSupabaseClient();
  const { data: publication } = await supabase
    .from("listing_publications")
    .select("*")
    .eq("public_slug", slug)
    .eq("channel", "public_link")
    .eq("status", "published")
    .maybeSingle();

  if (!publication) {
    return { status: "not_found" };
  }

  const [{ data: safeRow }, { data: owner }, { data: media }] =
    await Promise.all([
      supabase
        .from("properties_network_safe")
        .select("*")
        .eq("id", publication.property_id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("name, brand_color")
        .eq("id", publication.organization_id)
        .maybeSingle(),
      supabase
        .from("property_media")
        .select("id, storage_path, alt_text, position")
        .eq("property_id", publication.property_id)
        .order("position", { ascending: true }),
    ]);

  if (!safeRow) {
    return { status: "not_found" };
  }

  await supabase.from("listing_engagement_events").insert({
    organization_id: publication.organization_id,
    listing_publication_id: publication.id,
    property_id: publication.property_id,
    event_type: "view",
    source: "public_link",
  });

  const property = toSafeProperty(safeRow);

  return {
    status: "ready",
    property,
    organizationName: owner?.name ?? "Domika",
    brandColor: owner?.brand_color ?? "#0B1B3A",
    media: (media ?? []).map((item) => ({
      id: item.id,
      url: mediaUrl(item.storage_path),
      alt: item.alt_text ?? property.title,
    })),
  };
}

export type NetworkListingView =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | {
      status: "ready";
      property: SafeProperty;
      organizationName: string;
      media: Array<{ id: string; url: string; alt: string }>;
      viewCount: number;
    };

export async function getNetworkListingView(
  slug: string,
): Promise<NetworkListingView> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: "unauthenticated" };
  }

  const supabase = createAdminSupabaseClient();
  const { data: publication } = await supabase
    .from("listing_publications")
    .select("*")
    .eq("public_slug", slug)
    .eq("channel", "domika_network")
    .eq("status", "published")
    .maybeSingle();

  if (!publication) {
    return { status: "not_found" };
  }

  const [{ data: safeRow }, { data: owner }, { data: media }] =
    await Promise.all([
      supabase
        .from("properties_network_safe")
        .select("*")
        .eq("id", publication.property_id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("name")
        .eq("id", publication.organization_id)
        .maybeSingle(),
      supabase
        .from("property_media")
        .select("id, storage_path, alt_text, position")
        .eq("property_id", publication.property_id)
        .order("position", { ascending: true }),
    ]);

  if (!safeRow) {
    return { status: "not_found" };
  }

  const property = toSafeProperty(safeRow);

  // Track the view unless it's the owning org looking at itself.
  if (publication.organization_id !== session.profile.organization_id) {
    await supabase.from("listing_engagement_events").insert({
      organization_id: publication.organization_id,
      listing_publication_id: publication.id,
      property_id: publication.property_id,
      event_type: "view",
      actor_profile_id: session.profile.id,
      source: "domika_network",
    });
  }

  const { count: viewCount } = await supabase
    .from("listing_engagement_events")
    .select("id", { count: "exact", head: true })
    .eq("listing_publication_id", publication.id)
    .eq("event_type", "view");

  return {
    status: "ready",
    property,
    organizationName: owner?.name ?? "Organización",
    media: (media ?? []).map((item) => ({
      id: item.id,
      url: mediaUrl(item.storage_path),
      alt: item.alt_text ?? property.title,
    })),
    viewCount: viewCount ?? 0,
  };
}
