import { query } from "@/lib/db";
import crypto from "crypto";

function isAdmin(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !process.env.ACCESS_CODE) return false;
  return auth === `Bearer ${process.env.ACCESS_CODE}`;
}

// GET /api/invite — list all invite codes
export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const result = await query(
    "SELECT code, label, total_uses, used, created_at, expires_at FROM invite_codes ORDER BY created_at DESC"
  );

  return new Response(JSON.stringify(result?.rows || []), { status: 200 });
}

// POST /api/invite — create a new invite code
export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const {
    code = crypto.randomBytes(4).toString("hex"),
    label = "",
    total_uses = 50,
    expires_days,
  } = body;

  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await query(
    "INSERT INTO invite_codes (code, label, total_uses, expires_at) VALUES ($1, $2, $3, $4)",
    [code, label, total_uses, expires_at]
  );

  return new Response(JSON.stringify({ code, label, total_uses, expires_at }), { status: 201 });
}

// DELETE /api/invite — delete an invite code
export async function DELETE(req: Request) {
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { code } = await req.json();
  await query("DELETE FROM invite_codes WHERE code = $1", [code]);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
