import { cookies } from "next/headers";
import { query, hasDatabase } from "@/lib/db";
import { isLocal } from "@/lib/isLocal";
import { getCodeHash } from "@/lib/accessCode";

const MAX_GENERATIONS_PER_HOUR = 20;

export async function checkAccess(
  _req: Request,
  endpoint: string
): Promise<Response | null> {
  // Skip protection entirely if not in local mode or no database configured
  if (!isLocal() || !hasDatabase()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Access code required" }),
      { status: 401 }
    );
  }

  // Single query: validate session + check rate limit + record generation
  const currentHash = getCodeHash();
  const result = await query(
    `WITH valid_session AS (
      SELECT id FROM sessions WHERE id = $1 AND code_hash = $2
    ), rate_check AS (
      SELECT COUNT(*) as count FROM generations
      WHERE session_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
    ), insert_gen AS (
      INSERT INTO generations (session_id, endpoint)
      SELECT $1, $3
      WHERE EXISTS (SELECT 1 FROM valid_session)
        AND (SELECT count FROM rate_check) < $4
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM valid_session) as session_valid,
      (SELECT count FROM rate_check) as gen_count,
      (SELECT COUNT(*) FROM insert_gen) as inserted`,
    [sessionId, currentHash, endpoint, MAX_GENERATIONS_PER_HOUR]
  );

  if (!result || result.rows.length === 0) {
    return new Response(
      JSON.stringify({ error: "Access code required" }),
      { status: 401 }
    );
  }

  const { session_valid, gen_count, inserted } = result.rows[0];

  if (parseInt(session_valid, 10) === 0) {
    cookieStore.delete("lr_session");
    return new Response(
      JSON.stringify({ error: "Session expired. Please re-enter access code." }),
      { status: 401 }
    );
  }

  if (parseInt(gen_count, 10) >= MAX_GENERATIONS_PER_HOUR || parseInt(inserted, 10) === 0) {
    return new Response(
      JSON.stringify({
        error: `You've reached the limit of ${MAX_GENERATIONS_PER_HOUR} generations per hour. Take a break and try again soon.`,
      }),
      { status: 429 }
    );
  }

  return null;
}
