"use server";

import { revalidatePath } from "next/cache";
import { updateOrganizationPlan } from "@/lib/domain/admin";

export async function updateOrganizationPlanAction(formData: FormData) {
  const result = await updateOrganizationPlan({
    organizationId: String(formData.get("organizationId") ?? ""),
    plan: String(formData.get("plan") ?? ""),
    maxUsers: Number(formData.get("maxUsers") ?? 0),
    billingStatus: String(formData.get("billingStatus") ?? ""),
  });

  if (result.ok) {
    revalidatePath("/admin");
  }
}
