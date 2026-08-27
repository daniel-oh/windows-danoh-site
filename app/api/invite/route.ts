import { query } from "@/lib/db";
import { hashInviteCode } from "@/lib/inviteHash";
import { getClientIP } from "@/lib/api/clientIP";
import { createRateLimitBucket } from "@/lib/api/rateLimit";
import { parseJson } from "@/lib/api/json";
import crypto from "crypto";

// Admin credential is its own secret. It used to be ACCESS_CODE, the
// same string visitors type into the gate, so anyone handed the code
// could also list, mint and delete invite codes.
const ADMIN_TOKEN = process.env.INVITE_ADMIN_TOKEN;

// Failed-attempt lockout is per client IP. The old single global
// counter meant five bad guesses from anyone locked the real admin out.
const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const failBucket = createRateLimitBucket();

function isAdmin(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !ADMIN_TOKEN) return false;

  const ip = getClientIP(req);
  if (failBucket.tripAndRecord(ip, FAIL_LIMIT, FAIL_WINDOW_MS)) {
    return false;
  }

  const expected = `Bearer ${ADMIN_TOKEN}`;
  const maxLen = Math.max(auth.length, expected.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(auth);
  bufB.write(expected);
  return crypto.timingSafeEqual(bufA, bufB) && auth.length === expected.length;
}

// One gate for all three handlers: 503 when the admin token was never
// configured (so a missing env var reads as "not set up", not "wrong
// password"), 401 otherwise.
function gate(req: Request): Response | null {
  if (!ADMIN_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Invite admin is not configured (INVITE_ADMIN_TOKEN unset)" }),
      { status: 503 }
    );
  }
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return null;
}

// GET /api/invite — list all invite codes.
//
// Returns code_hash as the public-ish identifier and label/usage stats,
// but never the plaintext code. The admin saves the plaintext at
// creation time; if they need to delete one later they pass the
// code_hash from this listing.
export async function GET(req: Request) {
  const denied = gate(req);
  if (denied) return denied;

  const result = await query(
    `SELECT code_hash, label, total_uses, used, created_at, expires_at
     FROM invite_codes
     WHERE code_hash IS NOT NULL
     ORDER BY created_at DESC`
  );

  return new Response(JSON.stringify(result?.rows || []), { status: 200 });
}

// POST /api/invite — create a new invite code.
//
// The plaintext code is returned ONCE in this response and never
// stored. Only the SHA-256 hash is persisted. The admin must save
// the plaintext at this moment; there is no way to recover it later.
export async function POST(req: Request) {
  const denied = gate(req);
  if (denied) return denied;

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as {
    code?: unknown;
    label?: unknown;
    total_uses?: unknown;
    expires_days?: unknown;
  };

  const code =
    typeof body.code === "string" && body.code
      ? body.code
      : crypto.randomBytes(12).toString("hex");
  const label = typeof body.label === "string" ? body.label : "";
  const total_uses =
    typeof body.total_uses === "number" && body.total_uses > 0
      ? Math.floor(body.total_uses)
      : 50;
  const expires_days =
    typeof body.expires_days === "number" && body.expires_days > 0
      ? body.expires_days
      : null;

  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const code_hash = hashInviteCode(code);

  await query(
    `INSERT INTO invite_codes (code_hash, label, total_uses, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [code_hash, label, total_uses, expires_at]
  );

  return new Response(
    JSON.stringify({
      code,
      code_hash,
      label,
      total_uses,
      expires_at,
      note: "Save the code now. It will not be shown again.",
    }),
    { status: 201 }
  );
}

// DELETE /api/invite — delete an invite code by its hash.
//
// The admin pulls the code_hash from the GET listing and passes it
// here. (Pre-refactor this took the plaintext code; if you only have
// the plaintext you can compute its hash via the same SHA-256 the
// site uses.)
export async function DELETE(req: Request) {
  const denied = gate(req);
  if (denied) return denied;

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as { code_hash?: unknown; code?: unknown };

  // Accept either code_hash directly or a plaintext code for
  // backwards-compat with anyone already scripting the old shape.
  const code_hash: string | undefined =
    typeof body.code_hash === "string"
      ? body.code_hash
      : typeof body.code === "string" && body.code
        ? hashInviteCode(body.code)
        : undefined;

  if (!code_hash) {
    return new Response(
      JSON.stringify({ error: "code_hash or code required" }),
      { status: 400 }
    );
  }

  await query("DELETE FROM invite_codes WHERE code_hash = $1", [code_hash]);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
