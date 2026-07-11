"use server";

import { revalidatePath } from "next/cache";
import {
  addLeadNote,
  changeLeadStage,
  updateLead,
} from "@/lib/domain/lead-detail";

export type LeadDetailFormState = {
  error: string | null;
};

export async function changeLeadStageAction(
  _previousState: LeadDetailFormState,
  formData: FormData,
): Promise<LeadDetailFormState> {
  const leadId = String(formData.get("leadId") ?? "");
  const toStageId = String(formData.get("stageId") ?? "");

  const result = await changeLeadStage({ leadId, toStageId });

  if (result.ok === false) {
    return { error: result.error };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");

  return { error: null };
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function updateLeadAction(
  _previousState: LeadDetailFormState,
  formData: FormData,
): Promise<LeadDetailFormState> {
  const leadId = String(formData.get("leadId") ?? "");

  const result = await updateLead(leadId, {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    desiredZone: String(formData.get("desiredZone") ?? ""),
    desiredPropertyType: String(formData.get("desiredPropertyType") ?? ""),
    budgetMin: numberOrNull(formData.get("budgetMin")),
    budgetMax: numberOrNull(formData.get("budgetMax")),
    assignedTo: String(formData.get("assignedTo") ?? "") || null,
  });

  if (result.ok === false) {
    return { error: result.error };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");

  return { error: null };
}

export async function addLeadNoteAction(
  _previousState: LeadDetailFormState,
  formData: FormData,
): Promise<LeadDetailFormState> {
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "");

  const result = await addLeadNote({ leadId, body });

  if (result.ok === false) {
    return { error: result.error };
  }

  revalidatePath(`/leads/${leadId}`);

  return { error: null };
}
