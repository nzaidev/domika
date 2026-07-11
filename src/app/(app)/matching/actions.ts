"use server";

import { revalidatePath } from "next/cache";
import {
  createBuyerRequirement,
  deactivateRequirement,
} from "@/lib/domain/matching";

export type RequirementFormState = {
  error: string | null;
  created: boolean;
};

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createRequirementAction(
  _previousState: RequirementFormState,
  formData: FormData,
): Promise<RequirementFormState> {
  const rawOperation = String(formData.get("operation") ?? "");

  const result = await createBuyerRequirement({
    leadId: String(formData.get("leadId") ?? "") || null,
    propertyType: String(formData.get("propertyType") ?? "") || null,
    operation: ["sale", "rent", "investment"].includes(rawOperation)
      ? (rawOperation as "sale" | "rent" | "investment")
      : null,
    budgetMin: numberOrNull(formData.get("budgetMin")),
    budgetMax: numberOrNull(formData.get("budgetMax")),
    city: String(formData.get("city") ?? "") || null,
    zone: String(formData.get("zone") ?? "") || null,
    bedroomsMin: numberOrNull(formData.get("bedroomsMin")),
    areaMinSqm: numberOrNull(formData.get("areaMinSqm")),
    notes: String(formData.get("notes") ?? "") || null,
  });

  if (result.ok === false) {
    return { error: result.error, created: false };
  }

  revalidatePath("/matching");

  return { error: null, created: true };
}

export async function deactivateRequirementAction(formData: FormData) {
  const requirementId = String(formData.get("requirementId") ?? "");

  if (requirementId) {
    await deactivateRequirement(requirementId);
    revalidatePath("/matching");
  }
}
