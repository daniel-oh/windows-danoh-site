import { cookies } from "next/headers";
import { query, hasDatabase } from "@/lib/db";
import { isLocal } from "@/lib/isLocal";
import { getCodeHash } from "@/lib/accessCode";

const MAX_GENERATIONS_PER_HOUR = 20;

// Anthropic keys start with sk-ant- and are 90+ chars
const ANTHROPIC_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{80,}$/;

function isValidApiKey(key: unknown): boolean {
  return typeof key === "string" && ANTHROPIC_KEY_PATTERN.test(key);
}

async function checkForOwnApiKey(req: Request): Promise<boolean> {
  try {
    const url = new URL(req.url);
    // Check GET request (program generation)
    const settingsParam = url.searchParams.get("settings");
    if (settingsParam) {
      const parsed = JSON.parse(decodeURIComponent(settingsParam));
      if (isValidApiKey(parsed?.apiKey)) return true;
    }
    // Check POST request body (chat, help, name, icon)
    if (req.method === "POST") {
      const cloned = req.clone();
      const body = await cloned.json().catch(() => null);
      if (isValidApiKey(body?.settings?.apiKey)) return true;
    }
  } catch { /* ignore parse errors */ }
  return false;
}

export async function checkAccess(
  req: Request,
  endpoint: string
): Promise<Response | null> {
  // Skip protection entirely if not in local mode or no database configured
  if (!isLocal() || !hasDatabase()) {
    return null;
  }

  // Bypass access code if user provides their own API key
  const hasOwnKey = await checkForOwnApiKey(req);
  if (hasOwnKey) {
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
    "SELECT id, code_hash, invite_code FROM sessions WHERE id = $1",
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

  // Invite code session: check total usage against invite limit
  if (session.invite_code) {
    const inviteResult = await query(
      "SELECT total_uses, used, expires_at FROM invite_codes WHERE code = $1",
      [session.invite_code]
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
      "UPDATE invite_codes SET used = used + 1 WHERE code = $1",
      [session.invite_code]
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
