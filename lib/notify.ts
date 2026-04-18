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
  /** Sets Resend's reply_to header so a "Reply" on the admin inbox
   * lands back at the visitor. Only set when a valid email was captured. */
  replyTo?: string;
};

/**
 * Returns true if the Resend integration is configured. Call sites
 * can use this to fall back to mailto UX when we can't send server-side.
 */
export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends via Resend and returns true on 2xx, false otherwise.
 * Unlike the old fire-and-forget variant, callers that care (e.g. the
 * contact endpoint) can surface a real error to the user instead of
 * lying about success.
 */
export async function notifyAdmin(payload: NotifyPayload): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const to = process.env.ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  const from = process.env.NOTIFY_FROM_EMAIL || FROM_EMAIL_DEFAULT;
  try {
    const body: Record<string, unknown> = {
      from,
      to: [to],
      subject: payload.subject,
      text: payload.text,
    };
    if (payload.replyTo) body.reply_to = payload.replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        "[notify] Resend returned non-2xx",
        res.status,
        await res.text().catch(() => "")
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] send failed:", err);
    return false;
  }
}
