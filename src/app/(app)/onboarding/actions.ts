"use server";

import { redirect } from "next/navigation";
import { createOrganizationWithOwner } from "@/lib/domain/onboarding";

export type OnboardingFormState = {
  error: string | null;
};

export async function completeOnboardingAction(
  _previousState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const result = await createOrganizationWithOwner({
    organizationName: String(formData.get("organizationName") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });

  if (result.ok === false) {
    return { error: result.error };
  }

  redirect("/dashboard");
}
