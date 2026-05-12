import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => {
      console.error("Unexpected pool error:", err);
    });
  }
  return pool;
}

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      code_hash TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Add code_hash column if missing (existing installs)
  await p.query(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS code_hash TEXT;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS generations (
      id SERIAL PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      label TEXT,
      total_uses INT NOT NULL DEFAULT 50,
      used INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    );
  `);
  await p.query(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invite_code TEXT;
  `);
  // Invite-code hash storage. Plaintext is never persisted going
  // forward — the admin sees the code once at creation and saves it
  // themselves. The hash is the lookup key for /api/auth/verify and
  // for the per-request guard's UPDATE-used counter. Existing
  // plaintext rows get a code_hash backfilled below so they keep
  // working through the transition; the plaintext `code` column
  // becomes vestigial and can be dropped manually once the admin is
  // confident no row predates the hash refactor.
  await p.query(`
    ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
  `);
  await p.query(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invite_code_hash TEXT;
  `);
  // Backfill code_hash for rows that predate the column. Idempotent —
  // the WHERE clause selects only rows still missing the hash, so on
  // every subsequent boot this is a no-op SELECT returning zero rows.
  const legacyInvites = await p.query(
    `SELECT code FROM invite_codes WHERE code_hash IS NULL AND code IS NOT NULL`
  );
  for (const row of legacyInvites?.rows ?? []) {
    const hash = crypto
      .createHash("sha256")
      .update(row.code)
      .digest("hex");
    await p.query(
      `UPDATE invite_codes SET code_hash = $1 WHERE code = $2`,
      [hash, row.code]
    );
  }
  const legacySessions = await p.query(
    `SELECT id, invite_code FROM sessions WHERE invite_code IS NOT NULL AND invite_code_hash IS NULL`
  );
  for (const row of legacySessions?.rows ?? []) {
    const hash = crypto
      .createHash("sha256")
      .update(row.invite_code)
      .digest("hex");
    await p.query(
      `UPDATE sessions SET invite_code_hash = $1 WHERE id = $2`,
      [hash, row.id]
    );
  }
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_hash
    ON invite_codes(code_hash)
    WHERE code_hash IS NOT NULL;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS programs (
      id TEXT NOT NULL,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      code TEXT,
      icon TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (id, session_id)
    );
  `);
  // Anonymous blog post reactions. visitor_id is a client-generated UUID
  // stored in localStorage; no account required. PK prevents double-voting.
  await p.query(`
    CREATE TABLE IF NOT EXISTS post_reactions (
      post_slug TEXT NOT NULL,
      reaction TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (post_slug, reaction, visitor_id)
    );
  `);
  // Anonymous hit counter. One row per unique visitor_id. COUNT(*) gives
  // the "you are visitor #N" display. Small enough that COUNT is fine.
  await p.query(`
    CREATE TABLE IF NOT EXISTS visits (
      visitor_id TEXT PRIMARY KEY,
      first_seen TIMESTAMP DEFAULT NOW()
    );
  `);
  // Stripe webhook dedup. Inserting event.id is the first DB write
  // the handler does; PK unique violation on a retry tells the handler
  // the event was already processed. Self-managed in the app's own
  // Postgres (not Supabase) so it auto-migrates on deploy without a
  // separate migration step.
  await p.query(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      processed_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Guestbook messages, passed through an AI classifier on submit.
  // status: 'pending' (AI unavailable) | 'approved' | 'rejected' | 'spam'.
  // Only 'approved' messages are rendered on the wall.
  await p.query(`
    CREATE TABLE IF NOT EXISTS guestbook (
      id SERIAL PRIMARY KEY,
      name TEXT,
      message TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      moderation_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Add forensics columns to existing deployments.
  await p.query(`ALTER TABLE guestbook ADD COLUMN IF NOT EXISTS ip TEXT;`);
  await p.query(`ALTER TABLE guestbook ADD COLUMN IF NOT EXISTS user_agent TEXT;`);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_generations_session_created ON generations(session_id, created_at DESC);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_programs_session ON programs(session_id);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_code_hash ON sessions(code_hash);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_reactions_slug ON post_reactions(post_slug);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_guestbook_status_created
      ON guestbook(status, created_at DESC);
  `);

  initialized = true;
}

// Run cleanup on startup and every 6 hours
let cleanupScheduled = false;

async function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  await runCleanup();
  setInterval(runCleanup, 6 * 60 * 60 * 1000);
}

async function runCleanup() {
  const p = getPool();
  if (!p) return;
  try {
    // Delete sessions older than 90 days (cascades to generations + programs)
    await p.query(`DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '90 days'`);
    // Delete generations older than 7 days (rate limit only needs 1 hour, keep 7 days for analytics)
    await p.query(`DELETE FROM generations WHERE created_at < NOW() - INTERVAL '7 days'`);
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

// Initialize tables and cleanup on first pool access
let initPromise: Promise<void> | null = null;

function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await ensureTables();
    await scheduleCleanup();
  })();
  return initPromise;
}

export async function query(text: string, params?: unknown[]) {
  const p = getPool();
  if (!p) return null;
  await ensureInit();
  return p.query(text, params);
}

export function hasDatabase() {
  return !!process.env.DATABASE_URL;
}
