import "server-only";

import type {
  Json,
  ListingChannel,
  ListingEngagementType,
  ListingPublicationRow,
  PublicListingRow,
  SharePermission,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ListingDistributionResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export type PublishListingCommand = {
  propertyId: string;
  channels: ListingChannel[];
  options?: Json;
  publicSlug?: string;
};

export type ShareListingCommand = {
  propertyId: string;
  listingPublicationId?: string;
  sharedWithProfileId?: string;
  sharedWithOrganizationId?: string;
  permission: SharePermission;
  expiresAt?: string;
};

export type RecordListingEngagementCommand = {
  listingPublicationId: string;
  eventType: ListingEngagementType;
  source?: string;
  leadId?: string;
  metadata?: Json;
};

export type CaptureListingLeadCommand = {
  listingPublicationId: string;
  source: string;
  contact: {
    fullName: string;
    phone?: string;
    email?: string;
  };
  metadata?: Json;
};

async function getAuthorizedContext() {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const supabase = createAdminSupabaseClient();

  return { status: "ok" as const, session, supabase };
}

export async function publishListing(
  command: PublishListingCommand,
): Promise<ListingDistributionResult<ListingPublicationRow[]>> {
  const context = await getAuthorizedContext();

  if (context.status !== "ok") {
    return { status: context.status };
  }

  const rows = command.channels.map((channel) => ({
    organization_id: context.session.profile.organization_id,
    property_id: command.propertyId,
    channel,
    status: "published" as const,
    public_slug:
      channel === "public_link" || channel === "waiboom_feed"
        ? command.publicSlug
        : null,
    published_by: context.session.profile.id,
    published_at: new Date().toISOString(),
    unpublished_at: null,
    failure_reason: null,
    options: command.options ?? {},
  }));

  const { data, error } = await context.supabase
    .from("listing_publications")
    .upsert(rows, {
      onConflict: "organization_id,property_id,channel",
    })
    .select("*");

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "ok", data: data ?? [] };
}

export async function unpublishListing(
  propertyId: string,
  channels: ListingChannel[],
): Promise<ListingDistributionResult<ListingPublicationRow[]>> {
  const context = await getAuthorizedContext();

  if (context.status !== "ok") {
    return { status: context.status };
  }

  const { data, error } = await context.supabase
    .from("listing_publications")
    .update({
      status: "unpublished",
      unpublished_at: new Date().toISOString(),
    })
    .eq("organization_id", context.session.profile.organization_id)
    .eq("property_id", propertyId)
    .in("channel", channels)
    .select("*");

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "ok", data: data ?? [] };
}

export async function shareListing(
  command: ShareListingCommand,
): Promise<ListingDistributionResult<{ id: string }>> {
  const context = await getAuthorizedContext();

  if (context.status !== "ok") {
    return { status: context.status };
  }

  const { data, error } = await context.supabase
    .from("property_shares")
    .insert({
      organization_id: context.session.profile.organization_id,
      property_id: command.propertyId,
      listing_publication_id: command.listingPublicationId ?? null,
      shared_by: context.session.profile.id,
      shared_with_profile_id: command.sharedWithProfileId ?? null,
      shared_with_organization_id: command.sharedWithOrganizationId ?? null,
      permission: command.permission,
      expires_at: command.expiresAt ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "ok", data };
}

export async function recordListingEngagement(
  command: RecordListingEngagementCommand,
): Promise<ListingDistributionResult<{ id: string }>> {
  const context = await getAuthorizedContext();

  if (context.status !== "ok") {
    return { status: context.status };
  }

  const { data: publication, error: publicationError } = await context.supabase
    .from("listing_publications")
    .select("id, organization_id, property_id")
    .eq("id", command.listingPublicationId)
    .single();

  if (publicationError || !publication) {
    return { status: "not_found" };
  }

  const { data, error } = await context.supabase
    .from("listing_engagement_events")
    .insert({
      organization_id: publication.organization_id,
      listing_publication_id: publication.id,
      property_id: publication.property_id,
      event_type: command.eventType,
      actor_profile_id: context.session.profile.id,
      lead_id: command.leadId ?? null,
      source: command.source ?? null,
      metadata: command.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "ok", data };
}

export async function captureListingLead(
  command: CaptureListingLeadCommand,
): Promise<ListingDistributionResult<{ leadId: string }>> {
  const context = await getAuthorizedContext();

  if (context.status !== "ok") {
    return { status: context.status };
  }

  const { data: publication, error: publicationError } = await context.supabase
    .from("listing_publications")
    .select("id, organization_id, property_id")
    .eq("id", command.listingPublicationId)
    .single();

  if (publicationError || !publication) {
    return { status: "not_found" };
  }

  const { data: lead, error: leadError } = await context.supabase
    .from("leads")
    .insert({
      organization_id: publication.organization_id,
      full_name: command.contact.fullName,
      phone: command.contact.phone ?? null,
      email: command.contact.email ?? null,
      source: "listing",
      source_meta: {
        listing_publication_id: publication.id,
        property_id: publication.property_id,
        source: command.source,
        metadata: command.metadata ?? {},
      },
    })
    .select("id")
    .single();

  if (leadError) {
    return { status: "error", message: leadError.message };
  }

  const { error: attributionError } = await context.supabase
    .from("listing_lead_attributions")
    .insert({
      organization_id: publication.organization_id,
      lead_id: lead.id,
      listing_publication_id: publication.id,
      property_id: publication.property_id,
      source: command.source,
      metadata: command.metadata ?? {},
    });

  if (attributionError) {
    return { status: "error", message: attributionError.message };
  }

  return { status: "ok", data: { leadId: lead.id } };
}

export async function getPublicListing(
  slug: string,
): Promise<ListingDistributionResult<PublicListingRow>> {
  if (!hasSupabasePublicConfig()) {
    return { status: "not_configured" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_listing", {
    p_slug: slug,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const listing = data?.[0];

  if (!listing) {
    return { status: "not_found" };
  }

  return { status: "ok", data: listing };
}
