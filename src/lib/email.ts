import "server-only";

// Transactional email via Resend. Sends only when RESEND_API_KEY (and
// EMAIL_FROM) are configured; otherwise it logs and no-ops so the app works
// without an email provider. Failures never throw into the caller.
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log(
      `[email] not configured — would send to ${input.to}: ${input.subject}`,
    );
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!response.ok) {
      console.error("[email] send failed:", response.status);
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("[email] send error:", error);
    return { sent: false };
  }
}
