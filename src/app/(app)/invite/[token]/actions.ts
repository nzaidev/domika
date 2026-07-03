"use server";

import { redirect } from "next/navigation";
import { acceptInvitation } from "@/lib/domain/invitations";

export type AcceptInviteFormState = {
  error: string | null;
};

export async function acceptInvitationAction(
  _previousState: AcceptInviteFormState,
  formData: FormData,
): Promise<AcceptInviteFormState> {
  const token = String(formData.get("token") ?? "");
  const result = await acceptInvitation(token);

  if (result.ok === false) {
    return { error: result.error };
  }

  redirect("/dashboard");
}
