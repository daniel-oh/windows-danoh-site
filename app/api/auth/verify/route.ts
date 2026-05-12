import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getCodeHash } from "@/lib/accessCode";
import { hashInviteCode } from "@/lib/inviteHash";
import { getClientIP } from "@/lib/api/clientIP";
import crypto from "crypto";

function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(a);
  bufB.write(b);
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

// Per-IP sliding-window rate limit for access-code attempts. In-memory is
// fine for single-container deploy; move to Redis if scaled horizontally.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

function rateLimit(req: Request): Response | null {
  const ip = getClientIP(req);
  const now = Date.now();
  const prev = attempts.get(ip);
  if (prev && now - prev.firstAt > RATE_LIMIT_WINDOW_MS) {
    attempts.delete(ip);
  }
  const cur = attempts.get(ip);
  if (cur && cur.count >= RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ error: "Too many attempts. Try again later." }),
      { status: 429 }
    );
  }
  return null;
}

function recordFailure(req: Request): void {
  const ip = getClientIP(req);
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur) {
    attempts.set(ip, { count: 1, firstAt: now });
  } else {
    cur.count++;
  }
}

function recordSuccess(req: Request): void {
  attempts.delete(getClientIP(req));
}

export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const { code } = await req.json();

  if (typeof code !== "string" || code.length === 0) {
    return new Response(JSON.stringify({ error: "Access code required" }), {
      status: 403,
    });
  }

  // Check invite codes first. We look up by SHA-256(code) so the
  // submitted plaintext never has to be compared against a stored
  // plaintext — the DB only holds hashes after the refactor.
  const inviteCodeHash = hashInviteCode(code);
  const inviteResult = await query(
    "SELECT code_hash, total_uses, used, expires_at FROM invite_codes WHERE code_hash = $1",
    [inviteCodeHash]
  );

  if (inviteResult && inviteResult.rows.length > 0) {
    const invite = inviteResult.rows[0];

    if (invite.used >= invite.total_uses) {
      recordFailure(req);
      return new Response(
        JSON.stringify({ error: "This code has been fully used." }),
        { status: 403 }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      recordFailure(req);
      return new Response(
        JSON.stringify({ error: "This code has expired." }),
        { status: 403 }
      );
    }

    const sessionId = crypto.randomUUID();
    // Sessions row carries the hash, not the plaintext, so the
    // session table is also safe in a DB-breach scenario.
    await query(
      "INSERT INTO sessions (id, code_hash, invite_code_hash) VALUES ($1, $2, $3)",
      [sessionId, inviteCodeHash, inviteCodeHash]
    );

    const cookieStore = await cookies();
    cookieStore.set("lr_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    recordSuccess(req);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Fall back to master access code
  if (!process.env.ACCESS_CODE) {
    recordFailure(req);
    return new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 403,
    });
  }

  if (!constantTimeEqual(code, process.env.ACCESS_CODE)) {
    recordFailure(req);
    return new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 403,
    });
  }

  const sessionId = crypto.randomUUID();
  const codeHash = getCodeHash();

  await query("INSERT INTO sessions (id, code_hash) VALUES ($1, $2)", [sessionId, codeHash]);

  const cookieStore = await cookies();
  cookieStore.set("lr_session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  recordSuccess(req);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
