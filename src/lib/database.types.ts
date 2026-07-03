// Placeholder for Supabase generated types.
// Replace this file with `supabase gen types typescript` output once the
// dev/prod Supabase projects are linked.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

export type AppRole = "owner" | "admin" | "agent";
export type ListingChannel =
  | "domika_network"
  | "public_link"
  | "whatsapp_flyer"
  | "pdf_brochure"
  | "waiboom_feed"
  | "external_portal";
export type ListingPublicationStatus =
  | "draft"
  | "pending"
  | "published"
  | "failed"
  | "unpublished";
export type ListingEngagementType =
  | "view"
  | "click"
  | "share"
  | "download"
  | "whatsapp_send"
  | "lead";
export type SharePermission = "view" | "view_without_owner" | "full";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  max_users: number;
  brand_color: string;
  logo_url: string | null;
  billing_status: string;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  clerk_user_id: string;
  organization_id: string;
  role: AppRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: AppRole;
  token: string;
  status: InvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsappAccountRow = {
  id: string;
  organization_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  waba_id: string | null;
  access_token: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MetaLeadPageRow = {
  id: string;
  organization_id: string;
  page_id: string;
  page_name: string | null;
  access_token: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MessageChannel = "whatsapp" | "instagram" | "messenger";

export type WhatsappThreadRow = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  channel: MessageChannel;
  external_thread_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsappMessageRow = {
  id: string;
  organization_id: string;
  thread_id: string;
  lead_id: string | null;
  external_message_id: string | null;
  direction: "inbound" | "outbound";
  sender_profile_id: string | null;
  body: string | null;
  media: Json;
  sent_at: string;
  created_at: string;
};

export type PipelineStageRow = {
  id: string;
  organization_id: string;
  business_unit: string;
  name: string;
  position: number;
  color: string | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
};

export type PipelineEventRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

export type LeadActivityRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  actor_profile_id: string | null;
  activity_type:
    | "note"
    | "call"
    | "message"
    | "email"
    | "stage_change"
    | "task"
    | "property"
    | "document";
  title: string;
  body: string | null;
  metadata: Json;
  created_at: string;
};

export type LeadRow = {
  id: string;
  organization_id: string;
  stage_id: string | null;
  assigned_to: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: "manual" | "whatsapp" | "meta_ads" | "portal" | "referral" | "listing" | "other";
  source_meta: Json;
  business_unit: string;
  desired_property_type: string | null;
  desired_zone: string | null;
  budget_min: number | null;
  budget_max: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  property_type: string;
  operation: "sale" | "rent" | "investment";
  status: "draft" | "available" | "reserved" | "sold" | "rented" | "archived";
  price: number | null;
  currency: string;
  city: string | null;
  zone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  area_sqm: number | null;
  lot_sqm: number | null;
  amenities: Json;
  legal_status: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_notes: string | null;
  video_url: string | null;
  virtual_tour_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingPublicationRow = {
  id: string;
  organization_id: string;
  property_id: string;
  channel: ListingChannel;
  status: ListingPublicationStatus;
  public_slug: string | null;
  external_id: string | null;
  published_by: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  failure_reason: string | null;
  options: Json;
  created_at: string;
  updated_at: string;
};

export type ListingEngagementEventRow = {
  id: string;
  organization_id: string;
  listing_publication_id: string;
  property_id: string;
  event_type: ListingEngagementType;
  actor_profile_id: string | null;
  lead_id: string | null;
  source: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  metadata: Json;
  created_at: string;
};

export type ListingLeadAttributionRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  listing_publication_id: string;
  property_id: string;
  source: string;
  metadata: Json;
  created_at: string;
};

export type PropertyShareRow = {
  id: string;
  organization_id: string;
  property_id: string;
  listing_publication_id: string | null;
  shared_by: string | null;
  shared_with_profile_id: string | null;
  shared_with_organization_id: string | null;
  permission: SharePermission;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  property_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicListingRow = {
  listing_id: string;
  property_id: string;
  organization_id: string;
  channel: ListingChannel;
  status: ListingPublicationStatus;
  public_slug: string;
  title: string;
  description: string | null;
  property_type: string;
  operation: "sale" | "rent" | "investment";
  price: number | null;
  currency: string;
  city: string | null;
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  area_sqm: number | null;
  lot_sqm: number | null;
  amenities: Json;
  video_url: string | null;
  virtual_tour_url: string | null;
  published_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<OrganizationRow>;
      profiles: Table<ProfileRow>;
      invitations: Table<InvitationRow>;
      whatsapp_accounts: Table<WhatsappAccountRow>;
      meta_lead_pages: Table<MetaLeadPageRow>;
      whatsapp_threads: Table<WhatsappThreadRow>;
      whatsapp_messages: Table<WhatsappMessageRow>;
      pipeline_stages: Table<PipelineStageRow>;
      leads: Table<LeadRow>;
      lead_activities: Table<LeadActivityRow>;
      pipeline_events: Table<PipelineEventRow>;
      properties: Table<PropertyRow>;
      listing_publications: Table<ListingPublicationRow>;
      listing_engagement_events: Table<ListingEngagementEventRow>;
      listing_lead_attributions: Table<ListingLeadAttributionRow>;
      property_shares: Table<PropertyShareRow>;
      tasks: Table<TaskRow>;
    };
    Views: Record<string, never>;
    Functions: {
      get_public_listing: {
        Args: { p_slug: string };
        Returns: PublicListingRow[];
      };
    };
    Enums: {
      app_role: AppRole;
      listing_channel: ListingChannel;
      listing_publication_status: ListingPublicationStatus;
      listing_engagement_type: ListingEngagementType;
      share_permission: SharePermission;
    };
    CompositeTypes: Record<string, never>;
  };
};
