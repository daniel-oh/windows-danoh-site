import { adminEmail, canSendEmail, notifyAdmin, sendEmail } from "@/lib/notify";
import { renderContactNotice, renderVisitorReceipt } from "@/lib/email/templates";
import { getClientIP } from "@/lib/api/clientIP";
import { parseJson, requireJson } from "@/lib/api/json";
import {
  createLastSeenBucket,
  createRateLimitBucket,
} from "@/lib/api/rateLimit";

const MAX_NAME = 60;
const MAX_EMAIL = 120;
const MAX_SUBJECT = 140;
const MAX_MESSAGE = 4000;
const MIN_ELAPSED_MS = 2000;
const MAX_URLS_IN_BODY = 3; // cheap spam signal — legit contact rarely needs more

// Same defense layers as the guestbook: an IP ceiling, a visitor ceiling,
// and a per-visitor cooldown. Different limits because a contact form is
// higher-intent than a drive-by guestbook signature — we want to block
// spam loops, not friction a determined human.
const IP_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60 * 1000;
const VISITOR_LIMIT = 5;
const VISITOR_WINDOW_MS = 24 * 60 * 60 * 1000;
const VISITOR_COOLDOWN_MS = 30 * 1000;

const ipBucket = createRateLimitBucket();
const visitorBucket = createRateLimitBucket();
const visitorLastAt = createLastSeenBucket(VISITOR_COOLDOWN_MS);

// Per-recipient cap for the visitor-confirmation email. The contact
// form sends a courtesy confirmation to whatever reply-to address the
// visitor supplies — which is also a potential spam-relay vector:
// fill the form with attacker-controlled body content + a victim's
// email, victim receives a "Your note arrived" message from
// noreply@danoh.com quoting the attacker's text. Capping at 1
// confirmation per recipient per 24 h prevents any one address from
// being weaponised even if attackers rotate visitor IDs and IPs.
const CONFIRM_PER_DEST_LIMIT = 1;
const CONFIRM_PER_DEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const confirmDestBucket = createRateLimitBucket();

function isValidVisitor(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

function isValidEmail(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length <= MAX_EMAIL &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  );
}

function clean(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().slice(0, max);
  return trimmed || null;
}

function countUrls(s: string): number {
  const matches = s.match(/\bhttps?:\/\/[^\s]+/gi);
  return matches ? matches.length : 0;
}

// The receipt goes to an address the VISITOR typed, so whatever it quotes
// is text a stranger can have delivered to someone else from
// noreply@danoh.com. The per-recipient daily cap limits how often; this
// limits how much: enough to recognise your own note, not enough to carry
// a payload (it used to echo the full 4000 characters).
const QUOTE_BACK_MAX = 300;
function clipForQuote(message: string): string {
  return message.length > QUOTE_BACK_MAX
    ? `${message.slice(0, QUOTE_BACK_MAX).trimEnd()}…`
    : message;
}

export async function POST(req: Request) {
  const notJson = requireJson(req);
  if (notJson) return notJson;
  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const {
    name,
    replyTo,
    subject,
    message,
    visitorId,
    website, // honeypot
    elapsedMs,
  } = (body ?? {}) as {
    name?: unknown;
    replyTo?: unknown;
    subject?: unknown;
    message?: unknown;
    visitorId?: unknown;
    website?: unknown;
    elapsedMs?: unknown;
  };

  const ip = getClientIP(req);

  // --- Silent drop paths (look like success so the bot can't probe) ---
  if (typeof website === "string" && website.trim().length > 0) {
    console.warn("[contact] honeypot tripped", { ip });
    return Response.json({ status: "sent" });
  }
  if (typeof elapsedMs === "number" && elapsedMs < MIN_ELAPSED_MS) {
    console.warn("[contact] too-fast submit", { ip, elapsedMs });
    return Response.json({ status: "sent" });
  }

  if (!isValidVisitor(visitorId)) {
    return Response.json({ error: "Invalid visitor id" }, { status: 400 });
  }

  const cleanMessage = clean(message, MAX_MESSAGE);
  if (!cleanMessage) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }
  if (countUrls(cleanMessage) > MAX_URLS_IN_BODY) {
    // Silent-drop rather than tell a bot which heuristic fired.
    console.warn("[contact] too many URLs, silent drop", {
      ip,
      count: countUrls(cleanMessage),
    });
    return Response.json({ status: "sent" });
  }
  const cleanName = clean(name, MAX_NAME);
  const cleanSubject = clean(subject, MAX_SUBJECT);
  const cleanReplyTo = isValidEmail(replyTo) ? (replyTo as string) : null;

  if (ipBucket.tripAndRecord(ip, IP_LIMIT, IP_WINDOW_MS)) {
    return Response.json(
      { error: "Too many messages from your network. Try again later." },
      { status: 429 }
    );
  }
  if (visitorBucket.tripAndRecord(visitorId, VISITOR_LIMIT, VISITOR_WINDOW_MS)) {
    return Response.json(
      { error: "You've reached the daily send limit." },
      { status: 429 }
    );
  }
  const lastAt = visitorLastAt.get(visitorId);
  if (lastAt && Date.now() - lastAt < VISITOR_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (VISITOR_COOLDOWN_MS - (Date.now() - lastAt)) / 1000
    );
    return Response.json(
      { error: `Easy there. Try again in ${waitSec}s.` },
      { status: 429 }
    );
  }
  visitorLastAt.set(visitorId, Date.now());

  if (!canSendEmail()) {
    return Response.json(
      { error: "Email delivery is not configured on this instance." },
      { status: 503 }
    );
  }

  const ok = await notifyAdmin({
    ...renderContactNotice({
      name: cleanName,
      replyTo: cleanReplyTo,
      subject: cleanSubject,
      message: cleanMessage,
      visitorId,
      ip,
    }),
    replyTo: cleanReplyTo ?? undefined,
  });

  // Bonus delight: if the visitor gave us a reply-to address, send
  // them a brief confirmation so they know the form actually delivered.
  // Fire-and-forget — the admin already has the message, the visitor
  // has already seen the inline "Sent" state, so a Resend hiccup here
  // shouldn't block or alter the response.
  //
  // Spam-relay defense: cap per recipient via confirmDestBucket. Without
  // this an attacker could weaponise the confirmation to spam a target
  // by filling the form with malicious body content + the target's
  // email. 1-per-24h-per-destination limit kills that vector while
  // letting a legit visitor still get their note-arrived receipt.
  if (
    ok &&
    cleanReplyTo &&
    !confirmDestBucket.tripAndRecord(
      cleanReplyTo.toLowerCase(),
      CONFIRM_PER_DEST_LIMIT,
      CONFIRM_PER_DEST_WINDOW_MS
    )
  ) {
    void sendEmail({
      to: cleanReplyTo,
      ...renderVisitorReceipt({
        name: cleanName,
        quote: clipForQuote(cleanMessage),
      }),
      // The receipt is sent from noreply@, and it invites a reply. Without
      // this, a visitor who answered it was writing to a mailbox nobody
      // reads.
      replyTo: adminEmail(),
    });
  }

  if (!ok) {
    return Response.json(
      { error: "Couldn't deliver your message. Try again in a minute." },
      { status: 502 }
    );
  }
  return Response.json({ status: "sent" });
}
