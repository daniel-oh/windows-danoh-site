import { canSendEmail, notifyAdmin } from "@/lib/notify";
import { getClientIP } from "@/lib/api/clientIP";
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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
    subject: `[danoh.com contact] ${cleanSubject ?? "Hello"} — ${
      cleanName ?? "Anonymous"
    }`,
    text:
      `From: ${cleanName ?? "(no name)"}\n` +
      `Reply-To: ${cleanReplyTo ?? "(none provided)"}\n` +
      `Visitor: ${visitorId}\n` +
      `IP: ${ip}\n` +
      `\n` +
      `${cleanMessage}\n`,
    replyTo: cleanReplyTo ?? undefined,
  });

  if (!ok) {
    return Response.json(
      { error: "Couldn't deliver your message. Try again in a minute." },
      { status: 502 }
    );
  }
  return Response.json({ status: "sent" });
}
