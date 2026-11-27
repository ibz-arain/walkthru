// Turso (libSQL) holds the metadata: projects, share links, comments, activity, version history.
// Locally it falls back to a SQLite file so the demo runs with no account.
import { createClient } from '@libsql/client';

let client = null, ready = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT, address TEXT,
     status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
     summary TEXT, preview TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS versions (
     project_id TEXT NOT NULL, version INTEGER NOT NULL, blob_key TEXT NOT NULL, note TEXT, created_at INTEGER NOT NULL,
     PRIMARY KEY (project_id, version))`,
  `CREATE TABLE IF NOT EXISTS shares (
     token TEXT PRIMARY KEY, project_id TEXT NOT NULL, customer TEXT NOT NULL, email TEXT,
     access TEXT NOT NULL DEFAULT 'view', status TEXT NOT NULL DEFAULT 'sent', message TEXT, has_copy INTEGER NOT NULL DEFAULT 0,
     revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, opened_at INTEGER, updated_at INTEGER, submitted_at INTEGER, submit_note TEXT)`,
  `CREATE INDEX IF NOT EXISTS shares_project ON shares(project_id)`,
  `CREATE TABLE IF NOT EXISTS comments (
     id TEXT PRIMARY KEY, project_id TEXT NOT NULL, share_token TEXT, author_role TEXT NOT NULL, author TEXT,
     body TEXT NOT NULL, pin TEXT, resolved INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS comments_project ON comments(project_id)`,
  `CREATE TABLE IF NOT EXISTS events (
     id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, share_token TEXT, kind TEXT NOT NULL, detail TEXT, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS events_project ON events(project_id, created_at)`,
  // Demo object store (see blob.js). Replace the driver and this table goes unused.
  `CREATE TABLE IF NOT EXISTS blobs (key TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  // Accounts: people, workspaces (orgs) they belong to with a role, login sessions, invites, password resets.
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, pass_hash TEXT NOT NULL, notify INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orgs (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS members (org_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (org_id, user_id))`,
  `CREATE INDEX IF NOT EXISTS members_user ON members(user_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS invites (token TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, invited_by TEXT, created_at INTEGER NOT NULL, accepted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS resets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)`,
  // Playground designs saved to the account (the design JSON lives in object storage).
  `CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT, name TEXT NOT NULL, rooms INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS designs_user ON designs(user_id, updated_at)`,
  // Emails sent (or queued when no mail provider is set up), and client errors / product events.
  `CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, to_addr TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL, detail TEXT, path TEXT, user_id TEXT, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS logs_kind ON logs(kind, created_at)`,
  // Failed sign-in / link-password attempts, for rate limiting.
  // Workspace price list (base price, finish upgrades, add-ons) as one JSON document.
  `CREATE TABLE IF NOT EXISTS catalogs (org_id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, n INTEGER NOT NULL, first_at INTEGER NOT NULL, locked_until INTEGER)`,
  // Design agent requests per person per day (UTC), so one account can't run up the model bill.
  `CREATE TABLE IF NOT EXISTS agent_use (who TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (who, day))`,
  `CREATE TABLE IF NOT EXISTS quota (key TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (key, day))`,
];
// Columns added after the first release. SQLite has no "ADD COLUMN IF NOT EXISTS", so each one is tried and "duplicate column" is ignored.
const COLUMNS = [
  ['projects', 'org_id TEXT'], ['projects', 'created_by TEXT'],
  ['shares', 'expires_at INTEGER'], ['shares', 'pass_hash TEXT'],
  ['projects', 'base_price INTEGER'], ['projects', 'thumb TEXT'], ['projects', 'design_rev INTEGER NOT NULL DEFAULT 0'],
];

export async function db() {
  if (!client) client = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:.data/local.db', authToken: process.env.TURSO_AUTH_TOKEN });
  if (!ready) ready = (async () => {
    await client.batch(SCHEMA, 'write');
    for (const [t, col] of COLUMNS) try { await client.execute(`ALTER TABLE ${t} ADD COLUMN ${col}`); } catch (e) { if (!/duplicate column/i.test(String(e.message))) throw e; }
  })().catch(e => { ready = null; throw e; });
  await ready;
  return client;
}

export const now = () => Date.now();

export async function logEvent(c, projectId, kind, { token = null, detail = null } = {}) {
  await c.execute({ sql: 'INSERT INTO events (project_id, share_token, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)', args: [projectId, token, kind, detail ? JSON.stringify(detail) : null, now()] });
}

// Count one use of `key` today; false once it is over `limit`. For things that cost money or reach strangers (email).
export async function spendQuota(key, limit) {
  const c = await db(), day = new Date().toISOString().slice(0, 10);
  const r = await c.execute({ sql: 'INSERT INTO quota (key, day, n) VALUES (?, ?, 1) ON CONFLICT (key, day) DO UPDATE SET n = n + 1 RETURNING n', args: [String(key), day] });
  return (r.rows[0]?.n || 0) <= limit;
}
