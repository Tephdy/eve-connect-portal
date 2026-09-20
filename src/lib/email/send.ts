import "server-only";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendEmail] RESEND_API_KEY not set — email skipped");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Apartment Portal <noreply@example.com>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[sendEmail] failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendEmail] error:", err);
    return false;
  }
}
