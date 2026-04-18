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
import {
  createRateLimitBucket,
  type Bucket,
} from "@/lib/api/rateLimit";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const PER_IP_HOURLY = 30;
const PER_VISITOR_HOURLY = 10;
const PER_VISITOR_DAILY = 40;
const GLOBAL_DAILY_DEFAULT = 500;

const ipBucket = createRateLimitBucket();
const visitorHourBucket = createRateLimitBucket();
const visitorDayBucket = createRateLimitBucket();

// Global bucket is a single-entry Map that resets at UTC midnight.
const globalBucket = new Map<string, Bucket>();

function globalCap(): number {
  const raw = process.env.GLOBAL_AI_DAILY_CAP;
  if (!raw) return GLOBAL_DAILY_DEFAULT;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : GLOBAL_DAILY_DEFAULT;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function checkGlobalDaily(): { ok: boolean; count: number } {
  const key = todayKey();
  // Drop entries for any previous day so the map stays O(1).
  for (const k of globalBucket.keys()) {
    if (k !== key) globalBucket.delete(k);
  }
  const cur = globalBucket.get(key);
  const cap = globalCap();
  if (cur && cur.count >= cap) return { ok: false, count: cur.count };
  if (!cur) globalBucket.set(key, { count: 1, firstAt: Date.now() });
  else cur.count++;
  return { ok: true, count: (globalBucket.get(key)?.count ?? 0) };
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

function reject(reason: string, retryHint: string): Response {
  console.warn("[costGuard] rejected", reason);
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

export async function costGuard(req: Request): Promise<Response | null> {
  // Visitor bringing their own key pays their own bill — skip.
  if (await hasOwnAnthropicKey(req)) return null;

  const ip = getClientIP(req);
  if (ipBucket.tripAndRecord(ip, PER_IP_HOURLY, HOUR_MS)) {
    return reject("ip_hour", "Try again in an hour.");
  }

  const visitorId = getVisitorId(req);
  if (visitorId) {
    if (
      visitorHourBucket.tripAndRecord(visitorId, PER_VISITOR_HOURLY, HOUR_MS)
    ) {
      return reject("visitor_hour", "Try again in an hour.");
    }
    if (visitorDayBucket.tripAndRecord(visitorId, PER_VISITOR_DAILY, DAY_MS)) {
      return reject("visitor_day", "Try again tomorrow.");
    }
  }

  const global = checkGlobalDaily();
  if (!global.ok) {
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
