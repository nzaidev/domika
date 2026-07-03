"use server";

import { revalidatePath } from "next/cache";
import type { AppRole } from "@/lib/database.types";
import { createInvitation, revokeInvitation } from "@/lib/domain/invitations";

export type InviteFormState = {
  error: string | null;
  invitedEmail: string | null;
  inviteToken: string | null;
};

const VALID_ROLES: AppRole[] = ["owner", "admin", "agent"];

export async function createInvitationAction(
  _previousState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const email = String(formData.get("email") ?? "");
  const rawRole = String(formData.get("role") ?? "agent");
  const role = VALID_ROLES.includes(rawRole as AppRole)
    ? (rawRole as AppRole)
    : "agent";

  const result = await createInvitation({ email, role });

  if (result.ok === false) {
    return { error: result.error, invitedEmail: null, inviteToken: null };
  }

  revalidatePath("/settings");

  return {
    error: null,
    invitedEmail: email.trim().toLowerCase(),
    inviteToken: result.token,
  };
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");

  if (invitationId) {
    await revokeInvitation(invitationId);
    revalidatePath("/settings");
  }
}
