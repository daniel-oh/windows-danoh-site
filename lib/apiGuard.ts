import { cookies } from "next/headers";
import { query, hasDatabase } from "@/lib/db";
import { isLocal } from "@/lib/isLocal";
import { getCodeHash } from "@/lib/accessCode";
import { hasOwnAnthropicKey } from "@/lib/api/hasOwnAnthropicKey";

const MAX_GENERATIONS_PER_HOUR = 20;

export async function checkAccess(
  req: Request,
  endpoint: string
): Promise<Response | null> {
  // Skip protection entirely if not in local mode or no database configured.
  // Prod cost ceilings live in costGuard — see lib/api/costGuard.ts.
  if (!isLocal() || !hasDatabase()) {
    return null;
  }

  // Bypass access code if visitor provides their own Anthropic API key.
  if (await hasOwnAnthropicKey(req)) {
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

  // Check if session exists and whether it's an invite code session
  const sessionResult = await query(
    "SELECT id, code_hash, invite_code_hash FROM sessions WHERE id = $1",
    [sessionId]
  );

  if (!sessionResult || sessionResult.rows.length === 0) {
    cookieStore.delete("lr_session");
    return new Response(
      JSON.stringify({ error: "Session expired. Please re-enter access code." }),
      { status: 401 }
    );
  }

  const session = sessionResult.rows[0];

  // Invite-code session: lookup + increment by hash, not plaintext.
  // The plaintext code only ever existed in the verify request body
  // and the admin's clipboard; nothing here re-derives it.
  if (session.invite_code_hash) {
    const inviteResult = await query(
      "SELECT total_uses, used, expires_at FROM invite_codes WHERE code_hash = $1",
      [session.invite_code_hash]
    );

    if (!inviteResult || inviteResult.rows.length === 0) {
      cookieStore.delete("lr_session");
      return new Response(
        JSON.stringify({ error: "This code is no longer valid." }),
        { status: 401 }
      );
    }

    const invite = inviteResult.rows[0];

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This code has expired." }),
        { status: 403 }
      );
    }

    if (invite.used >= invite.total_uses) {
      return new Response(
        JSON.stringify({
          error: `This code has been fully used (${invite.total_uses}/${invite.total_uses} generations).`,
        }),
        { status: 429 }
      );
    }

    // Record generation and increment invite usage
    await query(
      "INSERT INTO generations (session_id, endpoint) VALUES ($1, $2)",
      [sessionId, endpoint]
    );
    await query(
      "UPDATE invite_codes SET used = used + 1 WHERE code_hash = $1",
      [session.invite_code_hash]
    );

    return null;
  }

  // Master code session: check hourly rate limit
  const currentHash = getCodeHash();
  if (session.code_hash !== currentHash) {
    cookieStore.delete("lr_session");
    return new Response(
      JSON.stringify({ error: "Session expired. Please re-enter access code." }),
      { status: 401 }
    );
  }

  const countResult = await query(
    "SELECT COUNT(*) as count FROM generations WHERE session_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
    [sessionId]
  );

  const count = countResult ? parseInt(countResult.rows[0].count, 10) : 0;

  if (count >= MAX_GENERATIONS_PER_HOUR) {
    return new Response(
      JSON.stringify({
        error: `You've reached the limit of ${MAX_GENERATIONS_PER_HOUR} generations per hour. Take a break and try again soon.`,
      }),
      { status: 429 }
    );
  }

  await query(
    "INSERT INTO generations (session_id, endpoint) VALUES ($1, $2)",
    [sessionId, endpoint]
  );

  return null;
}
