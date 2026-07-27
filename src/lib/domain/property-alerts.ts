import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

type Supabase = ReturnType<typeof createAdminSupabaseClient>;

type Recipient = {
  profileId: string;
  organizationId: string;
  clerkUserId: string;
};

// Expands a property's shares into concrete recipient profiles (direct agent
// shares + every active member of org-level shares).
async function shareRecipients(
  supabase: Supabase,
  ownerOrgId: string,
  propertyId: string,
): Promise<Recipient[]> {
  const { data: shares } = await supabase
    .from("property_shares")
    .select("shared_with_profile_id, shared_with_organization_id")
    .eq("organization_id", ownerOrgId)
    .eq("property_id", propertyId);

  if (!shares || shares.length === 0) {
    return [];
  }

  const profileIds = new Set<string>();
  const orgIds = new Set<string>();
  for (const share of shares) {
    if (share.shared_with_profile_id) profileIds.add(share.shared_with_profile_id);
    if (share.shared_with_organization_id)
      orgIds.add(share.shared_with_organization_id);
  }

  if (orgIds.size > 0) {
    const { data: members } = await supabase
      .from("profiles")
      .select("id")
      .in("organization_id", [...orgIds])
      .eq("active", true);
    for (const m of members ?? []) profileIds.add(m.id);
  }

  if (profileIds.size === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, organization_id, clerk_user_id")
    .in("id", [...profileIds]);

  return (profiles ?? []).map((p) => ({
    profileId: p.id,
    organizationId: p.organization_id,
    clerkUserId: p.clerk_user_id,
  }));
}

async function notifyRecipients(
  supabase: Supabase,
  recipients: Recipient[],
  message: { title: string; body: string; propertyId: string },
): Promise<void> {
  if (recipients.length === 0) {
    return;
  }

  // In-app (bell). Notification lives in each recipient's own org so their
  // feed picks it up. Linked to /network (they view shared props there).
  await supabase.from("notifications").insert(
    recipients.map((r) => ({
      organization_id: r.organizationId,
      profile_id: r.profileId,
      title: message.title,
      body: message.body,
      metadata: { network_property_id: message.propertyId, kind: "property_alert" },
    })),
  );

  // Email (best-effort; needs RESEND_API_KEY + EMAIL_FROM + Clerk lookup).
  try {
    const client = await clerkClient();
    await Promise.allSettled(
      recipients.map(async (r) => {
        const user = await client.users.getUser(r.clerkUserId);
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          await sendEmail({
            to: email,
            subject: message.title,
            text: message.body,
          });
        }
      }),
    );
  } catch (error) {
    console.error("[property-alerts] email step failed:", error);
  }
}

// #5 — a fresh share was created; tell the recipient(s).
export async function notifyNewShare(input: {
  ownerOrgId: string;
  propertyId: string;
  propertyTitle: string;
  sharedByName: string;
  recipient: { kind: "org" | "agent"; id: string };
}): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    let recipients: Recipient[] = [];

    if (input.recipient.kind === "agent") {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, organization_id, clerk_user_id")
        .eq("id", input.recipient.id)
        .maybeSingle();
      if (p)
        recipients = [
          {
            profileId: p.id,
            organizationId: p.organization_id,
            clerkUserId: p.clerk_user_id,
          },
        ];
    } else {
      const { data: members } = await supabase
        .from("profiles")
        .select("id, organization_id, clerk_user_id")
        .eq("organization_id", input.recipient.id)
        .eq("active", true);
      recipients = (members ?? []).map((p) => ({
        profileId: p.id,
        organizationId: p.organization_id,
        clerkUserId: p.clerk_user_id,
      }));
    }

    await notifyRecipients(supabase, recipients, {
      title: `Nueva propiedad compartida: ${input.propertyTitle}`,
      body: `${input.sharedByName} compartió una propiedad contigo en la red Domika.`,
      propertyId: input.propertyId,
    });
  } catch (error) {
    console.error("[property-alerts] notifyNewShare failed:", error);
  }
}

// #6 — a property changed (price / status); tell everyone it was shared with.
export async function notifyPropertyChange(input: {
  ownerOrgId: string;
  propertyId: string;
  propertyTitle: string;
  changes: string[];
}): Promise<void> {
  if (input.changes.length === 0) {
    return;
  }

  try {
    const supabase = createAdminSupabaseClient();
    const recipients = await shareRecipients(
      supabase,
      input.ownerOrgId,
      input.propertyId,
    );

    await notifyRecipients(supabase, recipients, {
      title: `Actualización: ${input.propertyTitle}`,
      body: input.changes.join(" · "),
      propertyId: input.propertyId,
    });
  } catch (error) {
    console.error("[property-alerts] notifyPropertyChange failed:", error);
  }
}
