import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getCodeHash } from "@/lib/accessCode";
import crypto from "crypto";

function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(a);
  bufB.write(b);
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

export async function POST(req: Request) {
  const { code } = await req.json();

  if (typeof code !== "string" || code.length === 0) {
    return new Response(JSON.stringify({ error: "Access code required" }), {
      status: 403,
    });
  }

  // Check invite codes first
  const inviteResult = await query(
    "SELECT code, total_uses, used, expires_at FROM invite_codes WHERE code = $1",
    [code]
  );

  if (inviteResult && inviteResult.rows.length > 0) {
    const invite = inviteResult.rows[0];

    if (invite.used >= invite.total_uses) {
      return new Response(
        JSON.stringify({ error: "This code has been fully used." }),
        { status: 403 }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This code has expired." }),
        { status: 403 }
      );
    }

    const sessionId = crypto.randomUUID();
    await query(
      "INSERT INTO sessions (id, code_hash, invite_code) VALUES ($1, $2, $3)",
      [sessionId, code, code]
    );

    const cookieStore = await cookies();
    cookieStore.set("lr_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Fall back to master access code
  if (!process.env.ACCESS_CODE) {
    return new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 403,
    });
  }

  if (!constantTimeEqual(code, process.env.ACCESS_CODE)) {
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

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
