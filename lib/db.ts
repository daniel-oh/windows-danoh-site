import pg from "pg";

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

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_generations_session_created ON generations(session_id, created_at DESC);
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
