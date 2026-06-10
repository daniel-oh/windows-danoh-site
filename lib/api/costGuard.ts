// Server-side cost guardrails for every AI-backed endpoint.
//
// The existing per-user paths (getUser → canGenerate, or user-supplied
// apiKey) gate paid/authenticated flows correctly. What was missing is
// a hard production ceiling on anonymous + cheap-model usage. Before
// this, /api/program on the cheap path was unrate-limited in prod
// (apiGuard.ts skips when !isLocal), so a single curl loop or a spike
// from Hacker News could run up a real Anthropic bill.
//
// costGuard applies three layered limits:
//   1. Per-IP hourly — catches abuse from a single source even when
//      it cycles visitor IDs.
//   2. Per-visitor hourly + daily — discourages any one person from
//      treating generation as a toy. Visitor ID comes from the
//      cookie-mirrored localStorage key so anonymous visitors still
//      carry a stable identity across tabs.
//   3. Global daily — a kill-switch. Once the whole site hits N
//      generations in a UTC day, we stop and surface a polite error
//      until tomorrow. Configurable via GLOBAL_AI_DAILY_CAP.
//
// Any visitor supplying their own Anthropic apiKey is bypassed — they
// pay their own bill. Logged-in users aren't bypassed by default;
// the frequency cap is still a useful backup to the token balance.

import { getClientIP } from "@/lib/api/clientIP";
import { hasOwnAnthropicKey } from "@/lib/api/hasOwnAnthropicKey";
import { createRateLimitBucket } from "@/lib/api/rateLimit";
import { captureServerEvent } from "@/lib/capture";
import { query, hasDatabase } from "@/lib/db";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const PER_IP_HOURLY = 30;
// Requests without the danoh_visitor cookie get a tighter per-IP cap.
// Every real browser visit mirrors the cookie (lib/visitorId.ts), so a
// missing cookie means a script — which would otherwise dodge the
// per-visitor limits entirely by simply not sending one.
const PER_IP_HOURLY_NO_VISITOR = 12;
const PER_VISITOR_HOURLY = 10;
const PER_VISITOR_DAILY = 40;
const GLOBAL_DAILY_DEFAULT = 500;

const ipBucket = createRateLimitBucket();
const visitorHourBucket = createRateLimitBucket();
const visitorDayBucket = createRateLimitBucket();
// Same bucket pattern as the others; keyed by the UTC day string so
// the count resets naturally at midnight. Yesterday's entry ages out
// via the bucket's own window check next time any request lands.
const globalBucket = createRateLimitBucket();

function globalCap(): number {
  const raw = process.env.GLOBAL_AI_DAILY_CAP;
  if (!raw) return GLOBAL_DAILY_DEFAULT;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : GLOBAL_DAILY_DEFAULT;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Visitor ID pulled from a cookie mirrored from localStorage. Name
// matches the client-side VISITOR_KEY in lib/visitorId.ts; mirroring
// is a one-liner on the client (document.cookie) but until that ships
// we fall through gracefully if the cookie is absent.
function getVisitorId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)danoh_visitor=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]).trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(raw)) return null;
  return raw;
}

function reject(
  reason: string,
  retryHint: string,
  req: Request
): Response {
  console.warn("[costGuard] rejected", reason);
  // Fire-and-forget; telemetry must never block the response.
  void captureServerEvent(
    "cost_guard_hit",
    { reason, path: new URL(req.url).pathname },
    req
  );
  return new Response(
    JSON.stringify({
      error:
        "Generation limit reached. " +
        retryHint +
        " To keep running now, drop your own Anthropic API key into Settings.",
      reason,
    }),
    { status: 429, headers: { "content-type": "application/json" } }
  );
}

// Global daily counter persisted in Postgres. Watchtower recreates the
// container on every deploy (often several times a day), which resets
// the in-memory buckets — without this, the global kill-switch was
// effectively "per deploy" rather than per UTC day. Returns null when
// the DB is unavailable so the caller can fall back to the in-memory
// bucket (fail-open to memory, never fail-closed on a DB blip).
async function tripGlobalDailyInDb(cap: number): Promise<boolean | null> {
  if (!hasDatabase()) return null;
  try {
    const res = await query(
      `INSERT INTO cost_guard_daily (day, count) VALUES ($1, 1)
       ON CONFLICT (day) DO UPDATE SET count = cost_guard_daily.count + 1
       RETURNING count`,
      [todayKey()]
    );
    const count = Number(res?.rows?.[0]?.count);
    if (!Number.isFinite(count)) return null;
    return count > cap;
  } catch (err) {
    console.warn("[costGuard] global counter DB error:", err);
    return null;
  }
}

export async function costGuard(req: Request): Promise<Response | null> {
  // Visitor bringing their own key pays their own bill — skip.
  if (await hasOwnAnthropicKey(req)) return null;

  const ip = getClientIP(req);
  const visitorId = getVisitorId(req);
  const ipCap = visitorId ? PER_IP_HOURLY : PER_IP_HOURLY_NO_VISITOR;
  if (ipBucket.tripAndRecord(ip, ipCap, HOUR_MS)) {
    return reject("ip_hour", "Try again in an hour.", req);
  }

  if (visitorId) {
    if (
      visitorHourBucket.tripAndRecord(visitorId, PER_VISITOR_HOURLY, HOUR_MS)
    ) {
      return reject("visitor_hour", "Try again in an hour.", req);
    }
    if (visitorDayBucket.tripAndRecord(visitorId, PER_VISITOR_DAILY, DAY_MS)) {
      return reject("visitor_day", "Try again tomorrow.", req);
    }
  }

  const dbTripped = await tripGlobalDailyInDb(globalCap());
  const globalTripped =
    dbTripped !== null
      ? dbTripped
      : globalBucket.tripAndRecord(todayKey(), globalCap(), DAY_MS);
  if (globalTripped) {
    console.warn("[costGuard] global daily cap reached");
    void captureServerEvent(
      "cost_guard_hit",
      { reason: "global_day", path: new URL(req.url).pathname },
      req
    );
    return new Response(
      JSON.stringify({
        error:
          "The site hit its daily generation budget. Come back tomorrow, or drop your own Anthropic API key into Settings to keep running.",
        reason: "global_day",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  return null;
}
