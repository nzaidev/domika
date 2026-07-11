"use server";

import { revalidatePath } from "next/cache";
import type { SharePermission } from "@/lib/database.types";
import {
  revokeShare,
  setNetworkPublication,
  shareProperty,
} from "@/lib/domain/network";

export type ShareFormState = {
  error: string | null;
  shared: boolean;
};

const PERMISSIONS: SharePermission[] = ["view", "view_without_owner", "full"];

export async function sharePropertyAction(
  _previousState: ShareFormState,
  formData: FormData,
): Promise<ShareFormState> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const rawPermission = String(formData.get("permission") ?? "view_without_owner");
  const expiresDays = Number(formData.get("expiresDays") ?? 0);

  const result = await shareProperty({
    propertyId,
    recipient: String(formData.get("recipient") ?? ""),
    permission: (PERMISSIONS.includes(rawPermission as SharePermission)
      ? rawPermission
      : "view_without_owner") as SharePermission,
    expiresDays: Number.isFinite(expiresDays) && expiresDays > 0 ? expiresDays : null,
  });

  if (result.ok === false) {
    return { error: result.error, shared: false };
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/network");

  return { error: null, shared: true };
}

export async function revokeShareAction(formData: FormData) {
  const shareId = String(formData.get("shareId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");

  if (shareId) {
    await revokeShare(shareId);
    revalidatePath("/network");
    if (propertyId) {
      revalidatePath(`/properties/${propertyId}`);
    }
  }
}

export async function setNetworkPublicationAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const publish = formData.get("publish") === "true";

  if (propertyId) {
    await setNetworkPublication({ propertyId, publish });
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath("/network");
    revalidatePath("/listings");
  }
}
