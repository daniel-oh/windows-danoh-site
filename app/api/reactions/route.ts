import { query, hasDatabase } from "@/lib/db";
import { getClientIP } from "@/lib/api/clientIP";
import { createRateLimitBucket } from "@/lib/api/rateLimit";
import { parseJson, requireJson } from "@/lib/api/json";
import { sortedPosts } from "@/content/blog/posts";

// One reaction: a like. Older rows may carry "love" or "fire" from the
// three-emoji bar this replaced; each visitor still counts once, as a like.
const LIKE = "like";

// Per-IP sliding-window rate limit for POST /api/reactions. Defends
// against an attacker who forges visitor_ids client-side to inflate
// counts.
const RL_MAX = 200;
const RL_WINDOW_MS = 10 * 60 * 1000;
const bucket = createRateLimitBucket();

function rateLimit(req: Request): Response | null {
  const ip = getClientIP(req);
  if (bucket.tripAndRecord(ip, RL_MAX, RL_WINDOW_MS)) {
    return Response.json(
      { error: "Too many reactions. Slow down." },
      { status: 429 }
    );
  }
  return null;
}

// Only posts that exist. The pattern alone let anyone mint rows (and a
// count) for any slug they liked the look of.
const SLUGS = new Set(sortedPosts.map((p) => p.slug));

function isValidSlug(s: unknown): s is string {
  return typeof s === "string" && SLUGS.has(s);
}

function isValidVisitor(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

type LikeState = { count: number; liked: boolean };

async function getState(slug: string, visitorId: string | null): Promise<LikeState> {
  if (!hasDatabase()) return { count: 0, liked: false };
  // Distinct visitors, not rows: someone who left two of the old emoji
  // is one like.
  const countResult = await query(
    `SELECT COUNT(DISTINCT visitor_id)::int AS count
     FROM post_reactions
     WHERE post_slug = $1`,
    [slug]
  );
  let liked = false;
  if (visitorId) {
    const mine = await query(
      `SELECT 1 FROM post_reactions
       WHERE post_slug = $1 AND visitor_id = $2
       LIMIT 1`,
      [slug, visitorId]
    );
    liked = (mine?.rows.length ?? 0) > 0;
  }
  return { count: countResult?.rows[0]?.count ?? 0, liked };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const visitorId = url.searchParams.get("visitorId");
  if (!isValidSlug(slug)) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }
  const visitor = isValidVisitor(visitorId) ? visitorId : null;
  return Response.json(await getState(slug, visitor));
}

// Sets the like to the state the client asks for instead of toggling.
// A toggle made a fast double-tap race itself: two requests in flight
// could land in either order and leave the opposite of what the visitor
// saw. With an explicit `liked`, the last request wins and is idempotent.
export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  if (!hasDatabase()) {
    return Response.json({ count: 0, liked: false });
  }

  const notJson = requireJson(req);
  if (notJson) return notJson;
  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const { slug, liked, visitorId } = (parsed.body ?? {}) as {
    slug?: unknown;
    liked?: unknown;
    visitorId?: unknown;
  };

  if (!isValidSlug(slug)) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }
  if (typeof liked !== "boolean") {
    return Response.json({ error: "liked must be a boolean" }, { status: 400 });
  }
  if (!isValidVisitor(visitorId)) {
    return Response.json({ error: "Invalid visitor id" }, { status: 400 });
  }

  if (liked) {
    await query(
      `INSERT INTO post_reactions (post_slug, reaction, visitor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_slug, reaction, visitor_id) DO NOTHING`,
      [slug, LIKE, visitorId]
    );
  } else {
    // Every row this visitor has on the post, old emoji included, so an
    // unlike always takes them out of the count.
    await query(
      `DELETE FROM post_reactions WHERE post_slug = $1 AND visitor_id = $2`,
      [slug, visitorId]
    );
  }

  return Response.json(await getState(slug, visitorId));
}
