import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getCodeHash } from "@/lib/accessCode";
import { hashInviteCode } from "@/lib/inviteHash";
import { getClientIP } from "@/lib/api/clientIP";
import { parseJson } from "@/lib/api/json";
import { createRateLimitBucket } from "@/lib/api/rateLimit";
import { constantTimeEqual } from "@/lib/api/constantTimeEqual";
import crypto from "crypto";

// Per-IP lockout for access-code attempts: failures only, cleared on
// success. Shares the swept bucket in lib/api/rateLimit.ts; this route
// used to keep its own Map that never evicted anything.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const attempts = createRateLimitBucket();

function rateLimit(req: Request): Response | null {
  if (attempts.isTripped(getClientIP(req), RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return new Response(
      JSON.stringify({ error: "Too many attempts. Try again later." }),
      { status: 429 }
    );
  }
  return null;
}

function recordFailure(req: Request): void {
  attempts.record(getClientIP(req), RATE_LIMIT_WINDOW_MS);
}

function recordSuccess(req: Request): void {
  attempts.reset(getClientIP(req));
}

export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const { code } = (parsed.body ?? {}) as { code?: unknown };

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
