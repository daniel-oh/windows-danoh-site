import { query, hasDatabase } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  if (!hasDatabase()) {
    return Response.json([]);
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  if (!sessionId) {
    return Response.json([]);
  }

  const result = await query(
    "SELECT id, name, prompt, code, icon FROM programs WHERE session_id = $1",
    [sessionId]
  );

  if (!result) {
    return Response.json([]);
  }

  return Response.json(result.rows);
}

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return Response.json({ ok: true });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  if (!sessionId) {
    return Response.json({ ok: true });
  }

  const body = await req.json();
  const { id, name, prompt, code, icon } = body;

  await query(
    `INSERT INTO programs (id, session_id, name, prompt, code, icon)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id, session_id)
     DO UPDATE SET name = $3, prompt = $4, code = $5, icon = $6`,
    [id, sessionId, name, prompt, code ?? null, icon ?? null]
  );

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!hasDatabase()) {
    return Response.json({ ok: true });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  if (!sessionId) {
    return Response.json({ ok: true });
  }

  const body = await req.json();
  const { id } = body;

  await query(
    "DELETE FROM programs WHERE id = $1 AND session_id = $2",
    [id, sessionId]
  );

  return Response.json({ ok: true });
}
