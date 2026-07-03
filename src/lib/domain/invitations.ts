import "server-only";

import { randomBytes } from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import type {
  AppRole,
  InvitationRow,
  ProfileRow,
} from "@/lib/database.types";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const INVITATION_TTL_DAYS = 7;

export type TeamOverview =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | {
      status: "ready";
      profile: ProfileRow;
      organizationName: string;
      maxUsers: number;
      members: ProfileRow[];
      pendingInvitations: InvitationRow[];
    };

export async function getTeamOverview(): Promise<TeamOverview> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { status: session.status };
  }

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [organization, members, invitations] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, max_users")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (organization.error) {
    throw organization.error;
  }

  if (members.error) {
    throw members.error;
  }

  if (invitations.error) {
    throw invitations.error;
  }

  return {
    status: "ready",
    profile: session.profile,
    organizationName: organization.data.name,
    maxUsers: organization.data.max_users,
    members: members.data ?? [],
    pendingInvitations: (invitations.data ?? []).filter(
      (invitation) => new Date(invitation.expires_at).getTime() > Date.now(),
    ),
  };
}

export type CreateInvitationResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export async function createInvitation(input: {
  email: string;
  role: AppRole;
}): Promise<CreateInvitationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return { ok: false, error: "Solo propietarios y administradores pueden invitar." };
  }

  const email = input.email.trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Ingresa un email válido." };
  }

  // Only owners can mint other owners.
  const role: AppRole =
    input.role === "owner" && session.profile.role !== "owner"
      ? "admin"
      : input.role;

  const organizationId = session.profile.organization_id;
  const supabase = createAdminSupabaseClient();

  const [organization, memberCount, existingInvite] = await Promise.all([
    supabase
      .from("organizations")
      .select("max_users")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("active", true),
    supabase
      .from("invitations")
      .select("id, expires_at")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (organization.error) {
    return { ok: false, error: organization.error.message };
  }

  if ((memberCount.count ?? 0) >= organization.data.max_users) {
    return {
      ok: false,
      error: `El plan actual permite hasta ${organization.data.max_users} usuarios.`,
    };
  }

  if (
    existingInvite.data &&
    new Date(existingInvite.data.expires_at).getTime() > Date.now()
  ) {
    return { ok: false, error: "Ya existe una invitación pendiente para ese email." };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("invitations").insert({
    organization_id: organizationId,
    email,
    role,
    token,
    status: "pending",
    invited_by: session.profile.id,
    expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, token };
}

export type RevokeInvitationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function revokeInvitation(
  invitationId: string,
): Promise<RevokeInvitationResult> {
  const session = await getSessionProfile();

  if (session.status !== "authenticated") {
    return { ok: false, error: "No hay una sesión activa con perfil." };
  }

  if (session.profile.role === "agent") {
    return { ok: false, error: "Solo propietarios y administradores pueden revocar." };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("organization_id", session.profile.organization_id)
    .eq("status", "pending");

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export type InvitationPreview =
  | { status: "not_configured" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "already_member" }
  | {
      status: "ready";
      organizationName: string;
      email: string;
      role: AppRole;
    };

export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreview> {
  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return { status: "not_configured" };
  }

  if (session.status === "authenticated") {
    return { status: "already_member" };
  }

  const supabase = createAdminSupabaseClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (!invitation) {
    return { status: "invalid" };
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", invitation.organization_id)
    .single();

  return {
    status: "ready",
    organizationName: organization?.name ?? "Domika",
    email: invitation.email,
    role: invitation.role,
  };
}

export type AcceptInvitationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptInvitation(
  token: string,
): Promise<AcceptInvitationResult> {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false, error: "Inicia sesión para aceptar la invitación." };
  }

  const session = await getSessionProfile();

  if (session.status === "not_configured") {
    return { ok: false, error: "El backend todavía no está configurado." };
  }

  if (session.status === "authenticated") {
    return { ok: false, error: "Este usuario ya pertenece a una organización." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (!invitation) {
    return { ok: false, error: "La invitación no existe o ya fue utilizada." };
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    return { ok: false, error: "La invitación expiró. Pide una nueva." };
  }

  const clerkUser = await currentUser();
  const userEmails = (clerkUser?.emailAddresses ?? []).map((entry) =>
    entry.emailAddress.toLowerCase(),
  );

  if (!userEmails.includes(invitation.email.toLowerCase())) {
    return {
      ok: false,
      error: `La invitación es para ${invitation.email}. Inicia sesión con ese email.`,
    };
  }

  const [organization, memberCount] = await Promise.all([
    supabase
      .from("organizations")
      .select("max_users")
      .eq("id", invitation.organization_id)
      .single(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", invitation.organization_id)
      .eq("active", true),
  ]);

  if (organization.error) {
    return { ok: false, error: organization.error.message };
  }

  if ((memberCount.count ?? 0) >= organization.data.max_users) {
    return {
      ok: false,
      error: "La organización alcanzó el máximo de usuarios de su plan.",
    };
  }

  const fullName =
    clerkUser?.fullName?.trim() || invitation.email.split("@")[0];

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      clerk_user_id: userId,
      organization_id: invitation.organization_id,
      role: invitation.role,
      full_name: fullName,
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      error: profileError?.message ?? "No se pudo crear el perfil.",
    };
  }

  await supabase
    .from("invitations")
    .update({
      status: "accepted",
      accepted_by: profile.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  return { ok: true };
}
