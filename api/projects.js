// GET  /api/projects            → studio dashboard list
// POST /api/projects {name, client, address, bm, summary, preview} → new project
import { route, send, fail, isAdmin, newId, body } from './_lib/http.js';
import { db, now, logEvent } from './_lib/db.js';
import { putJSON, keys } from './_lib/blob.js';

export default route({
  async GET(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db();
    const r = await c.execute(`SELECT p.*,
        (SELECT COUNT(*) FROM shares s WHERE s.project_id = p.id AND s.revoked = 0) AS shares,
        (SELECT COUNT(*) FROM shares s WHERE s.project_id = p.id AND s.status = 'submitted') AS submitted,
        (SELECT COUNT(*) FROM comments m WHERE m.project_id = p.id AND m.resolved = 0 AND m.author_role = 'customer') AS open_comments,
        (SELECT MAX(created_at) FROM events e WHERE e.project_id = p.id) AS last_activity
      FROM projects p ORDER BY p.updated_at DESC`);
    send(res, 200, { projects: r.rows.map(p => ({ ...p, summary: p.summary ? JSON.parse(p.summary) : null, preview: p.preview ? JSON.parse(p.preview) : null })) });
  },
  async POST(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const b = body(req); if (!b.name || !b.bm || !Array.isArray(b.bm.rooms)) return fail(res, 400, 'Name and a design are required');
    const c = await db(), id = newId(6), t = now();
    await putJSON(keys.version(id, 1), b.bm);
    await c.batch([
      { sql: 'INSERT INTO projects (id, name, client, address, summary, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [id, String(b.name).slice(0, 80), b.client || null, b.address || null, JSON.stringify(b.summary || null), JSON.stringify(b.preview || null), t, t] },
      { sql: 'INSERT INTO versions (project_id, version, blob_key, note, created_at) VALUES (?, 1, ?, ?, ?)', args: [id, keys.version(id, 1), b.from ? `Started from ${b.from}` : 'Created', t] },
    ], 'write');
    await logEvent(c, id, 'created', { detail: { from: b.from || null } });
    send(res, 201, { id });
  },
});
