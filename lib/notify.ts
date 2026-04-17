// Admin email notifications via Resend's REST API. Fire-and-forget;
// failures are logged server-side but never block the request path.
//
// Configure in the environment:
//   RESEND_API_KEY     — required; without it notifications silently no-op
//   ADMIN_EMAIL        — recipient (defaults to danohwebsite@gmail.com)
//   NOTIFY_FROM_EMAIL  — sender (defaults to Resend's shared onboarding
//                        address; swap for a verified sender once you
//                        verify a domain in Resend)

const ADMIN_EMAIL_DEFAULT = "danohwebsite@gmail.com";
const FROM_EMAIL_DEFAULT = "onboarding@resend.dev";

export type NotifyPayload = {
  subject: string;
  text: string;
};

export async function notifyAdmin(payload: NotifyPayload): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = process.env.ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  const from = process.env.NOTIFY_FROM_EMAIL || FROM_EMAIL_DEFAULT;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        text: payload.text,
      }),
    });
    if (!res.ok) {
      console.error(
        "[notify] Resend returned non-2xx",
        res.status,
        await res.text().catch(() => "")
      );
    }
  } catch (err) {
    console.error("[notify] send failed:", err);
  }
}
