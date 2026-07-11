"use server";

import { capturePublicListingLead } from "@/lib/domain/network";

export type PublicInquiryState = {
  error: string | null;
  sent: boolean;
};

export async function publicInquiryAction(
  _previousState: PublicInquiryState,
  formData: FormData,
): Promise<PublicInquiryState> {
  // Honeypot: bots fill every field; humans never see this one.
  if (String(formData.get("website") ?? "").length > 0) {
    return { error: null, sent: true };
  }

  const result = await capturePublicListingLead({
    slug: String(formData.get("slug") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  });

  if (result.ok === false) {
    return { error: result.error, sent: false };
  }

  return { error: null, sent: true };
}
