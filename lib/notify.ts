// Email delivery via Resend's REST API.
//
// Now that danoh.com is verified in Resend we send from a real
// branded address (noreply@danoh.com, displayed as "danoh.com") so:
//   1. Inbox preview shows "danoh.com" instead of a noreply@resend
//      address, which reads as junk to most filters.
//   2. SPF/DKIM align with the canonical domain, lifting deliverability
//      out of the shared-pool penalty box.
//   3. Replies to the admin inbox use Resend's reply_to when set so
//      a Reply lands back at the visitor without me typing their
//      address in.
//
// Configure in the environment:
//   RESEND_API_KEY     — required; without it sends silently no-op
//   ADMIN_EMAIL        — admin recipient (defaults to hello@danoh.com)
//   NOTIFY_FROM_EMAIL  — sender address (defaults to noreply@danoh.com)
//   NOTIFY_FROM_NAME   — friendly From-name (defaults to "danoh.com")

const ADMIN_EMAIL_DEFAULT = "hello@danoh.com";
const FROM_EMAIL_DEFAULT = "noreply@danoh.com";
const FROM_NAME_DEFAULT = "danoh.com";

function fromHeader(): string {
  const email = process.env.NOTIFY_FROM_EMAIL || FROM_EMAIL_DEFAULT;
  const name = process.env.NOTIFY_FROM_NAME || FROM_NAME_DEFAULT;
  // "Name <email@domain>" — RFC 5322 mailbox-with-display-name format.
  return `${name} <${email}>`;
}

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  /** Sets Resend's reply_to header so a Reply on the recipient's
   * mail client lands at the visitor's address instead of the
   * noreply alias. Only set when a valid email was captured. */
  replyTo?: string;
};

/**
 * Returns true if the Resend integration is configured. Call sites
 * can use this to fall back to mailto UX when we can't send
 * server-side.
 */
export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Strips CR/LF so untrusted input can't inject extra email headers
 * when it ends up in the `subject` or `reply_to` fields. Resend sends
 * its own JSON body to SMTP, but defense-in-depth — if we ever swap
 * transports to a raw SMTP client, this prevents header smuggling.
 */
function stripHeaderNewlines(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Core send. Returns true on 2xx from Resend, false otherwise (failure
 * is logged server-side but never thrown — callers decide how visible
 * to make a delivery failure).
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const body: Record<string, unknown> = {
      from: fromHeader(),
      to: [payload.to],
      subject: stripHeaderNewlines(payload.subject),
      text: payload.text, // text body may contain newlines — legitimate
    };
    if (payload.replyTo) {
      body.reply_to = stripHeaderNewlines(payload.replyTo);
    }
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

/**
 * Thin wrapper that targets the admin inbox. Use for guestbook
 * moderation alerts, contact-form notifications, etc.
 */
export async function notifyAdmin(
  payload: Omit<EmailPayload, "to">
): Promise<boolean> {
  const to = process.env.ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  return sendEmail({ ...payload, to });
}
