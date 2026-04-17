import { query, hasDatabase } from "@/lib/db";

// Per-IP rate limit to make it harder to inflate the counter by forging
// visitor_ids client-side.
const RL_MAX = 30;
const RL_WINDOW_MS = 10 * 60 * 1000;
type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimit(req: Request): boolean {
  const ip = getClientIP(req);
  const now = Date.now();
  const prev = attempts.get(ip);
  if (prev && now - prev.firstAt > RL_WINDOW_MS) attempts.delete(ip);
  const cur = attempts.get(ip);
  if (cur && cur.count >= RL_MAX) return true;
  if (!cur) attempts.set(ip, { count: 1, firstAt: now });
  else cur.count++;
  return false;
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
  return Response.json({ total });
}

export async function POST(req: Request) {
  if (rateLimit(req)) {
    return Response.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
