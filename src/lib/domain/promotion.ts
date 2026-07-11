import "server-only";

import type { ListingChannel, PropertyRow } from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";

// Promotion overview: the org's distribution state — what is published
// where, how it performs, and what is not yet published.

export type PublicationSummary = {
  publicationId: string;
  propertyId: string;
  propertyTitle: string;
  coverUrl: string | null;
  channel: ListingChannel;
  status: string;
  publishedAt: string | null;
  views: number;
  leads: number;
};

export type UnpublishedProperty = {
  id: string;
  title: string;
  status: PropertyRow["status"];
  coverUrl: string | null;
};

export type ChannelStat = {
  channel: string;
  label: string;
  published: number;
  views: number;
};

export type PromotionOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      publications: PublicationSummary[];
      unpublished: UnpublishedProperty[];
      channels: ChannelStat[];
      brochureCount: number;
    };

const CHANNEL_LABELS: Record<string, string> = {
  domika_network: "Red Domika",
  public_link: "Enlace público",
  whatsapp_flyer: "Flyer WhatsApp",
  pdf_brochure: "Folleto PDF",
  waiboom_feed: "Feed Waiboom",
  external_portal: "Portal externo",
};

export async function getPromotionOverview(): Promise<PromotionOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [publications, properties, media, brochures] = await Promise.all([
    supabase
      .from("listing_publications")
      .select("*")
      .eq("organization_id", organizationId)
      .order("published_at", { ascending: false })
      .limit(100),
    supabase
      .from("properties")
      .select("id, title, status")
      .eq("organization_id", organizationId)
      .in("status", ["available", "reserved", "draft"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("property_media")
      .select("property_id, storage_path, is_cover, position")
      .eq("organization_id", organizationId)
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true }),
    supabase
      .from("brochures")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  const covers = new Map<string, string>();
  for (const item of media.data ?? []) {
    if (!covers.has(item.property_id)) {
      covers.set(item.property_id, mediaUrl(item.storage_path));
    }
  }

  const pubs = publications.data ?? [];
  const engagement = new Map<string, { views: number; leads: number }>();

  if (pubs.length > 0) {
    const { data: events } = await supabase
      .from("listing_engagement_events")
      .select("listing_publication_id, event_type")
      .eq("organization_id", organizationId)
      .in(
        "listing_publication_id",
        pubs.map((pub) => pub.id),
      );

    for (const event of events ?? []) {
      const entry = engagement.get(event.listing_publication_id) ?? {
        views: 0,
        leads: 0,
      };
      if (event.event_type === "view") {
        entry.views += 1;
      } else if (event.event_type === "lead") {
        entry.leads += 1;
      }
      engagement.set(event.listing_publication_id, entry);
    }
  }

  const propertyTitles = new Map(
    (properties.data ?? []).map((property) => [property.id, property.title]),
  );

  // Titles for published properties not in the recent list.
  const missingIds = [
    ...new Set(
      pubs
        .map((pub) => pub.property_id)
        .filter((id) => !propertyTitles.has(id)),
    ),
  ];

  if (missingIds.length > 0) {
    const { data: extra } = await supabase
      .from("properties")
      .select("id, title")
      .eq("organization_id", organizationId)
      .in("id", missingIds);
    for (const property of extra ?? []) {
      propertyTitles.set(property.id, property.title);
    }
  }

  const publicationSummaries: PublicationSummary[] = pubs.map((pub) => ({
    publicationId: pub.id,
    propertyId: pub.property_id,
    propertyTitle: propertyTitles.get(pub.property_id) ?? "Propiedad",
    coverUrl: covers.get(pub.property_id) ?? null,
    channel: pub.channel,
    status: pub.status,
    publishedAt: pub.published_at,
    views: engagement.get(pub.id)?.views ?? 0,
    leads: engagement.get(pub.id)?.leads ?? 0,
  }));

  const channelStats = new Map<string, ChannelStat>();
  for (const pub of publicationSummaries) {
    const entry = channelStats.get(pub.channel) ?? {
      channel: pub.channel,
      label: CHANNEL_LABELS[pub.channel] ?? pub.channel,
      published: 0,
      views: 0,
    };
    if (pub.status === "published") {
      entry.published += 1;
    }
    entry.views += pub.views;
    channelStats.set(pub.channel, entry);
  }

  const publishedPropertyIds = new Set(
    pubs
      .filter((pub) => pub.status === "published")
      .map((pub) => pub.property_id),
  );

  const unpublished: UnpublishedProperty[] = (properties.data ?? [])
    .filter((property) => !publishedPropertyIds.has(property.id))
    .slice(0, 12)
    .map((property) => ({
      id: property.id,
      title: property.title,
      status: property.status as PropertyRow["status"],
      coverUrl: covers.get(property.id) ?? null,
    }));

  return {
    status: "ready",
    publications: publicationSummaries,
    unpublished,
    channels: [...channelStats.values()],
    brochureCount: brochures.count ?? 0,
  };
}
