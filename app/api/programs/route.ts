import { query, hasDatabase } from "@/lib/db";
import { cookies } from "next/headers";
import { parseJson, requireJson } from "@/lib/api/json";

// Upper bounds on what a session may store per program. The generation
// stream is capped at 5 MB elsewhere; this row store had no limit at
// all, so a session holder could park arbitrarily large blobs in
// Postgres. Icons are small data URIs from /api/icon; prompts come from
// the Run box (2000 chars max there).
const MAX_ID = 200;
const MAX_NAME = 200;
const MAX_PROMPT = 4000;
const MAX_ICON = 200_000;
const MAX_CODE = 6_000_000;
// Matches PROGRAM_LIMIT in state/programs.tsx, the client's own ceiling.
// Without a server-side count one session could park 6 MB rows forever.
const MAX_PROGRAMS_PER_SESSION = 50;

// A cookie can outlive its sessions row (24h expiry, runCleanup, a rebuilt
// volume). The FK on programs.session_id then turned every save into an
// unhandled 500. Treat it like checkAccess does: drop the dead cookie.
async function sessionExists(sessionId: string): Promise<boolean> {
  const res = await query("SELECT 1 FROM sessions WHERE id = $1", [sessionId]);
  return !!res && res.rows.length > 0;
}

function optionalString(v: unknown, max: number): string | null | undefined {
  if (v == null) return v as null | undefined;
  if (typeof v !== "string" || v.length > max) return undefined;
  return v;
}

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
  // The one JSON write route that skipped this gate (see lib/api/json.ts).
  const notJson = requireJson(req);
  if (notJson) return notJson;

  if (!hasDatabase()) {
    return Response.json({ ok: true });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  // No session is a normal state, not an error: own-key visitors never get
  // one and keep their programs in the browser only. Stay a quiet no-op so
  // their console isn't littered with 401s on every save.
  if (!sessionId) {
    return Response.json({ ok: true });
  }
  if (!(await sessionExists(sessionId))) {
    cookieStore.delete("lr_session");
    return Response.json({ error: "Session expired" }, { status: 401 });
  }

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const { id, name, prompt, code, icon } = (parsed.body ?? {}) as {
    id?: unknown;
    name?: unknown;
    prompt?: unknown;
    code?: unknown;
    icon?: unknown;
  };

  if (typeof id !== "string" || !id || id.length > MAX_ID) {
    return Response.json({ error: "Invalid program id" }, { status: 400 });
  }
  if (typeof name !== "string" || name.length > MAX_NAME) {
    return Response.json({ error: "Invalid program name" }, { status: 400 });
  }
  if (typeof prompt !== "string" || prompt.length > MAX_PROMPT) {
    return Response.json({ error: "Invalid program prompt" }, { status: 400 });
  }
  const safeCode = optionalString(code, MAX_CODE);
  if (safeCode === undefined && code != null) {
    return Response.json({ error: "Program code too large" }, { status: 413 });
  }
  const safeIcon = optionalString(icon, MAX_ICON);
  if (safeIcon === undefined && icon != null) {
    return Response.json({ error: "Program icon too large" }, { status: 413 });
  }

  // Updates to an existing program always go through; only NEW rows count
  // against the cap.
  const usage = await query(
    `SELECT count(*)::int AS n,
            bool_or(id = $2) AS has_this
       FROM programs WHERE session_id = $1`,
    [sessionId, id]
  );
  const row = usage?.rows[0];
  if (row && !row.has_this && row.n >= MAX_PROGRAMS_PER_SESSION) {
    return Response.json(
      { error: `Program limit reached (${MAX_PROGRAMS_PER_SESSION})` },
      { status: 409 }
    );
  }

  await query(
    `INSERT INTO programs (id, session_id, name, prompt, code, icon)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id, session_id)
     DO UPDATE SET name = $3, prompt = $4, code = $5, icon = $6`,
    [id, sessionId, name, prompt, safeCode ?? null, safeIcon ?? null]
  );

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const notJson = requireJson(req);
  if (notJson) return notJson;

  if (!hasDatabase()) {
    return Response.json({ ok: true });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  if (!sessionId) {
    return Response.json({ ok: true });
  }

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const { id } = (parsed.body ?? {}) as { id?: unknown };
  if (typeof id !== "string" || !id || id.length > MAX_ID) {
    return Response.json({ error: "Invalid program id" }, { status: 400 });
  }

  await query(
    "DELETE FROM programs WHERE id = $1 AND session_id = $2",
    [id, sessionId]
  );

  return Response.json({ ok: true });
}
