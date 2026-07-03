import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import type { OrganizationRow } from "@/lib/database.types";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// The super-admin panel is for internal (vendor) staff, not tenant users.
// Access is allow-listed by Clerk account email via SUPER_ADMIN_EMAILS
// (comma-separated).

export async function isSuperAdmin(): Promise<boolean> {
  const allowList = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length === 0) {
    return false;
  }

  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((entry) =>
    entry.emailAddress.toLowerCase(),
  );

  return emails.some((email) => allowList.includes(email));
}

export type AdminOrganization = OrganizationRow & {
  memberCount: number;
  leadCount: number;
  propertyCount: number;
};

export type AdminOverview =
  | { status: "not_configured" }
  | { status: "forbidden" }
  | { status: "ready"; organizations: AdminOrganization[] };

export async function getAdminOverview(): Promise<AdminOverview> {
  if (!hasSupabaseServerConfig()) {
    return { status: "not_configured" };
  }

  if (!(await isSuperAdmin())) {
    return { status: "forbidden" };
  }

  const supabase = createAdminSupabaseClient();
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const enriched = await Promise.all(
    (organizations ?? []).map(async (organization) => {
      const [members, leads, properties] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .eq("active", true),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id),
        supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id),
      ]);

      return {
        ...organization,
        memberCount: members.count ?? 0,
        leadCount: leads.count ?? 0,
        propertyCount: properties.count ?? 0,
      };
    }),
  );

  return { status: "ready", organizations: enriched };
}

export type UpdateOrganizationPlanResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateOrganizationPlan(input: {
  organizationId: string;
  plan: string;
  maxUsers: number;
  billingStatus: string;
}): Promise<UpdateOrganizationPlanResult> {
  if (!(await isSuperAdmin())) {
    return { ok: false, error: "Acceso restringido." };
  }

  const plan = input.plan.trim();
  const billingStatus = input.billingStatus.trim();

  if (!plan || !billingStatus) {
    return { ok: false, error: "Plan y estado de facturación son requeridos." };
  }

  if (!Number.isInteger(input.maxUsers) || input.maxUsers < 1) {
    return { ok: false, error: "max_users debe ser un entero positivo." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      plan,
      max_users: input.maxUsers,
      billing_status: billingStatus,
    })
    .eq("id", input.organizationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
