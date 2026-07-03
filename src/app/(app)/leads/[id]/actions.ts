"use server";

import { revalidatePath } from "next/cache";
import { addLeadNote, changeLeadStage } from "@/lib/domain/lead-detail";

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
