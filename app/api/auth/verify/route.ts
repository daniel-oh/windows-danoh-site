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

  if (!process.env.ACCESS_CODE) {
    return new Response(JSON.stringify({ error: "Access code not configured" }), {
      status: 500,
    });
  }

  if (typeof code !== "string" || !constantTimeEqual(code, process.env.ACCESS_CODE)) {
    return new Response(JSON.stringify({ error: "Invalid access code" }), {
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
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
