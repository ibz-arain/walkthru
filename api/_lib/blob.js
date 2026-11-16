// Object storage for design documents (the JSON house plans).
// The app only ever calls put / get / del with a key like "projects/<id>/v3.json".
// Default driver "db" keeps the documents in a Turso table so the demo runs anywhere.
// To move to S3, R2, GCS, Vercel Blob, etc.: add a driver with the same three methods and set BLOB_DRIVER.
import { db, now } from './db.js';

const drivers = {
  db: {
    async put(key, text) { const c = await db(); await c.execute({ sql: 'INSERT INTO blobs (key, body, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at', args: [key, text, now()] }); },
    async get(key) { const c = await db(); const r = await c.execute({ sql: 'SELECT body FROM blobs WHERE key = ?', args: [key] }); return r.rows[0]?.body ?? null; },
    async del(key) { const c = await db(); await c.execute({ sql: 'DELETE FROM blobs WHERE key = ?', args: [key] }); },
  },
  // s3: { put, get, del }  ← add your object storage here later
};

const store = drivers[process.env.BLOB_DRIVER || 'db'];
if (!store) throw new Error(`Unknown BLOB_DRIVER "${process.env.BLOB_DRIVER}"`);

export const putJSON = (key, value) => store.put(key, JSON.stringify(value));
export const getJSON = async key => { const t = await store.get(key); return t == null ? null : JSON.parse(t); };
export const delBlob = key => store.del(key);
export const keys = {
  version: (projectId, v) => `projects/${projectId}/v${v}.json`,
  share: token => `shares/${token}.json`,
};
