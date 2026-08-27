import { query, hasDatabase } from "@/lib/db";
import { getClientIP } from "@/lib/api/clientIP";
import { createRateLimitBucket } from "@/lib/api/rateLimit";
import { parseJson, requireJson } from "@/lib/api/json";

// Per-IP rate limit to make it harder to inflate the counter by forging
// visitor_ids client-side.
const RL_MAX = 30;
const RL_WINDOW_MS = 10 * 60 * 1000;
const bucket = createRateLimitBucket();

function rateLimit(req: Request): boolean {
  return bucket.tripAndRecord(getClientIP(req), RL_MAX, RL_WINDOW_MS);
}

function isValidVisitor(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

async function getTotal(): Promise<number> {
  if (!hasDatabase()) return 0;
  const r = await query("SELECT COUNT(*)::int AS total FROM visits");
  return r?.rows?.[0]?.total ?? 0;
}

export async function GET() {
  const total = await getTotal();
  // Live counter: never let an intermediary heuristically cache it.
  return Response.json({ total }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (rateLimit(req)) {
    return Response.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  const notJson = requireJson(req);
  if (notJson) return notJson;
  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const { visitorId } = (body ?? {}) as { visitorId?: unknown };
  if (!isValidVisitor(visitorId)) {
    return Response.json({ error: "Invalid visitor id" }, { status: 400 });
  }

  if (!hasDatabase()) {
    return Response.json({ total: 0 });
  }

  await query(
    `INSERT INTO visits (visitor_id) VALUES ($1) ON CONFLICT (visitor_id) DO NOTHING`,
    [visitorId]
  );
  const total = await getTotal();
  return Response.json({ total });
}
