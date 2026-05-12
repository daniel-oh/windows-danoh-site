import { query } from "@/lib/db";
import { hashInviteCode } from "@/lib/inviteHash";
import crypto from "crypto";

let failedAttempts = 0;
let lastFailedAt = 0;

function isAdmin(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !process.env.ACCESS_CODE) return false;

  // Rate limit: block after 5 failed attempts for 15 minutes
  if (failedAttempts >= 5 && Date.now() - lastFailedAt < 15 * 60 * 1000) {
    return false;
  }

  const expected = `Bearer ${process.env.ACCESS_CODE}`;
  const maxLen = Math.max(auth.length, expected.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(auth);
  bufB.write(expected);
  const valid = crypto.timingSafeEqual(bufA, bufB) && auth.length === expected.length;

  if (!valid) {
    failedAttempts++;
    lastFailedAt = Date.now();
  } else {
    failedAttempts = 0;
  }

  return valid;
}

// GET /api/invite — list all invite codes.
//
// Returns code_hash as the public-ish identifier and label/usage stats,
// but never the plaintext code. The admin saves the plaintext at
// creation time; if they need to delete one later they pass the
// code_hash from this listing.
export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

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
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const {
    code = crypto.randomBytes(12).toString("hex"),
    label = "",
    total_uses = 50,
    expires_days,
  } = body;

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
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  // Accept either code_hash directly or a plaintext code for
  // backwards-compat with anyone already scripting the old shape.
  const code_hash: string | undefined =
    body.code_hash ?? (body.code ? hashInviteCode(body.code) : undefined);

  if (!code_hash) {
    return new Response(
      JSON.stringify({ error: "code_hash or code required" }),
      { status: 400 }
    );
  }

  await query("DELETE FROM invite_codes WHERE code_hash = $1", [code_hash]);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
