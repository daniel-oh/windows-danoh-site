import { query, hasDatabase } from "@/lib/db";

// Emoji set. Change here to add/remove reaction types — the UI reads this list.
export const REACTION_TYPES = ["like", "love", "fire"] as const;
type Reaction = (typeof REACTION_TYPES)[number];

// Per-IP sliding-window rate limit for POST /api/reactions. Defends
// against an attacker who forges visitor_ids client-side to inflate
// counts. In-memory is fine for single-container deploy.
const RL_MAX = 200;
const RL_WINDOW_MS = 10 * 60 * 1000;
type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimit(req: Request): Response | null {
  const ip = getClientIP(req);
  const now = Date.now();
  const prev = attempts.get(ip);
  if (prev && now - prev.firstAt > RL_WINDOW_MS) attempts.delete(ip);
  const cur = attempts.get(ip);
  if (cur && cur.count >= RL_MAX) {
    return Response.json(
      { error: "Too many reactions. Slow down." },
      { status: 429 }
    );
  }
  return null;
}

function recordAttempt(req: Request): void {
  const ip = getClientIP(req);
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur) attempts.set(ip, { count: 1, firstAt: now });
  else cur.count++;
}

const EMPTY_COUNTS: Record<Reaction, number> = { like: 0, love: 0, fire: 0 };

function isValidReaction(r: unknown): r is Reaction {
  return typeof r === "string" && (REACTION_TYPES as readonly string[]).includes(r);
}

function isValidSlug(s: unknown): s is string {
  return typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s);
}

function isValidVisitor(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

async function getState(slug: string, visitorId: string | null) {
  if (!hasDatabase()) return { counts: EMPTY_COUNTS, mine: [] as Reaction[] };

  const countsResult = await query(
    `SELECT reaction, COUNT(*)::int AS count
     FROM post_reactions
     WHERE post_slug = $1
     GROUP BY reaction`,
    [slug]
  );

  const counts: Record<Reaction, number> = { ...EMPTY_COUNTS };
  for (const row of countsResult?.rows ?? []) {
    const r: unknown = row.reaction;
    if (isValidReaction(r)) counts[r] = row.count;
  }

  let mine: Reaction[] = [];
  if (visitorId) {
    const mineResult = await query(
      `SELECT reaction FROM post_reactions
       WHERE post_slug = $1 AND visitor_id = $2`,
      [slug, visitorId]
    );
    mine = (mineResult?.rows ?? [])
      .map((r: { reaction: string }) => r.reaction)
      .filter(isValidReaction);
  }

  return { counts, mine };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const visitorId = url.searchParams.get("visitorId");

  if (!isValidSlug(slug)) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }
  const visitor = isValidVisitor(visitorId) ? visitorId : null;

  const state = await getState(slug, visitor);
  return Response.json(state);
}

export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  recordAttempt(req);

  if (!hasDatabase()) {
    return Response.json({ counts: EMPTY_COUNTS, mine: [] });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, reaction, visitorId } = (body ?? {}) as {
    slug?: unknown;
    reaction?: unknown;
    visitorId?: unknown;
  };

  if (!isValidSlug(slug)) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }
  if (!isValidReaction(reaction)) {
    return Response.json({ error: "Invalid reaction" }, { status: 400 });
  }
  if (!isValidVisitor(visitorId)) {
    return Response.json({ error: "Invalid visitor id" }, { status: 400 });
  }

  // Toggle: if the row exists, delete; otherwise insert.
  const existing = await query(
    `SELECT 1 FROM post_reactions
     WHERE post_slug = $1 AND reaction = $2 AND visitor_id = $3`,
    [slug, reaction, visitorId]
  );

  if (existing && existing.rows.length > 0) {
    await query(
      `DELETE FROM post_reactions
       WHERE post_slug = $1 AND reaction = $2 AND visitor_id = $3`,
      [slug, reaction, visitorId]
    );
  } else {
    await query(
      `INSERT INTO post_reactions (post_slug, reaction, visitor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_slug, reaction, visitor_id) DO NOTHING`,
      [slug, reaction, visitorId]
    );
  }

  const state = await getState(slug, visitorId);
  return Response.json(state);
}
