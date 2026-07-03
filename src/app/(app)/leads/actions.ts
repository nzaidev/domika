"use server";

import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/domain/leads";

export type CreateLeadFormState = {
  error: string | null;
  createdLeadName: string | null;
};

export async function createLeadAction(
  _previousState: CreateLeadFormState,
  formData: FormData,
): Promise<CreateLeadFormState> {
  const fullName = String(formData.get("fullName") ?? "");
  const result = await createLead({
    fullName,
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    desiredZone: String(formData.get("desiredZone") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (result.ok === false) {
    return { error: result.error, createdLeadName: null };
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");

  return { error: null, createdLeadName: fullName.trim() };
}
