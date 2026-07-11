"use server";

import { revalidatePath } from "next/cache";
import type { AppRole } from "@/lib/database.types";
import { createInvitation, revokeInvitation } from "@/lib/domain/invitations";
import {
  createStage,
  deleteStage,
  moveStage,
  renameStage,
} from "@/lib/domain/pipeline";

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

export type PipelineFormState = {
  error: string | null;
};

export async function pipelineAction(
  _previousState: PipelineFormState,
  formData: FormData,
): Promise<PipelineFormState> {
  const intent = String(formData.get("intent") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  const name = String(formData.get("name") ?? "");

  let result: { ok: true } | { ok: false; error: string };

  switch (intent) {
    case "add":
      result = await createStage({ name });
      break;
    case "rename":
      result = await renameStage({ stageId, name });
      break;
    case "move_up":
      result = await moveStage({ stageId, direction: "up" });
      break;
    case "move_down":
      result = await moveStage({ stageId, direction: "down" });
      break;
    case "delete":
      result = await deleteStage({ stageId });
      break;
    default:
      result = { ok: false, error: "Acción desconocida." };
  }

  if (result.ok === false) {
    return { error: result.error };
  }

  revalidatePath("/settings");
  revalidatePath("/leads");

  return { error: null };
}

export type IntegrationFormState = {
  error: string | null;
  saved: boolean;
};

export async function whatsappAccountAction(
  _previousState: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { upsertWhatsappAccount } = await import("@/lib/domain/integrations");
  const result = await upsertWhatsappAccount({
    phoneNumberId: String(formData.get("phoneNumberId") ?? ""),
    displayPhoneNumber: String(formData.get("displayPhoneNumber") ?? ""),
    wabaId: String(formData.get("wabaId") ?? ""),
    accessToken: String(formData.get("accessToken") ?? ""),
  });

  if (result.ok === false) {
    return { error: result.error, saved: false };
  }

  revalidatePath("/settings");
  return { error: null, saved: true };
}

export async function metaPageAction(
  _previousState: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { upsertMetaLeadPage } = await import("@/lib/domain/integrations");
  const result = await upsertMetaLeadPage({
    pageId: String(formData.get("pageId") ?? ""),
    pageName: String(formData.get("pageName") ?? ""),
    accessToken: String(formData.get("accessToken") ?? ""),
  });

  if (result.ok === false) {
    return { error: result.error, saved: false };
  }

  revalidatePath("/settings");
  return { error: null, saved: true };
}

export async function deleteWhatsappAccountAction(formData: FormData) {
  const { deleteWhatsappAccount } = await import("@/lib/domain/integrations");
  const accountId = String(formData.get("accountId") ?? "");

  if (accountId) {
    await deleteWhatsappAccount(accountId);
    revalidatePath("/settings");
  }
}

export async function deleteMetaPageAction(formData: FormData) {
  const { deleteMetaLeadPage } = await import("@/lib/domain/integrations");
  const pageId = String(formData.get("pageId") ?? "");

  if (pageId) {
    await deleteMetaLeadPage(pageId);
    revalidatePath("/settings");
  }
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");

  if (invitationId) {
    await revokeInvitation(invitationId);
    revalidatePath("/settings");
  }
}
