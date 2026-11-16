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
];

export async function db() {
  if (!client) client = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:.data/local.db', authToken: process.env.TURSO_AUTH_TOKEN });
  if (!ready) ready = client.batch(SCHEMA, 'write').catch(e => { ready = null; throw e; });
  await ready;
  return client;
}

export const now = () => Date.now();

export async function logEvent(c, projectId, kind, { token = null, detail = null } = {}) {
  await c.execute({ sql: 'INSERT INTO events (project_id, share_token, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)', args: [projectId, token, kind, detail ? JSON.stringify(detail) : null, now()] });
}
