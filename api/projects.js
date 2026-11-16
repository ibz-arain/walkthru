// GET  /api/projects            → studio dashboard list
// POST /api/projects {name, client, address, bm, summary, preview} → new project
import { route, send, fail, newId, body } from './_lib/http.js';
import { who, canEdit } from './_lib/auth.js';
import { db, now, logEvent } from './_lib/db.js';
import { putJSON, keys } from './_lib/blob.js';

export default route({
  async GET(req, res) {
    const w = await who(req); if (!w || (!w.super && !w.org)) return fail(res, 401, 'Sign in to open the Studio');
    const c = await db();
    const r = await c.execute({ sql: `SELECT p.*,
        (SELECT COUNT(*) FROM shares s WHERE s.project_id = p.id AND s.revoked = 0) AS shares,
        (SELECT COUNT(*) FROM shares s WHERE s.project_id = p.id AND s.status = 'submitted') AS submitted,
        (SELECT COUNT(*) FROM comments m WHERE m.project_id = p.id AND m.resolved = 0 AND m.author_role = 'customer') AS open_comments,
        (SELECT MAX(created_at) FROM events e WHERE e.project_id = p.id) AS last_activity
      FROM projects p ${w.super ? '' : 'WHERE p.org_id = ?'} ORDER BY p.updated_at DESC`, args: w.super ? [] : [w.org.id] });
    send(res, 200, { projects: r.rows.map(p => ({ ...p, summary: p.summary ? JSON.parse(p.summary) : null, preview: p.preview ? JSON.parse(p.preview) : null })) });
  },
  async POST(req, res) {
    const w = await who(req); if (!canEdit(w)) return fail(res, w ? 403 : 401, w ? 'Viewers can’t create projects' : 'Sign in to open the Studio');
    const b = body(req); if (!b.name || !b.bm || !Array.isArray(b.bm.rooms)) return fail(res, 400, 'Name and a design are required');
    const c = await db(), id = newId(6), t = now();
    await putJSON(keys.version(id, 1), b.bm);
    await c.batch([
      { sql: 'INSERT INTO projects (id, name, client, address, summary, preview, created_at, updated_at, org_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [id, String(b.name).slice(0, 80), b.client || null, b.address || null, JSON.stringify(b.summary || null), JSON.stringify(b.preview || null), t, t, w.org?.id || null, w.user?.id || null] },
      { sql: 'INSERT INTO versions (project_id, version, blob_key, note, created_at) VALUES (?, 1, ?, ?, ?)', args: [id, keys.version(id, 1), b.from ? `Started from ${b.from}` : 'Created', t] },
    ], 'write');
    await logEvent(c, id, 'created', { detail: { from: b.from || null } });
    send(res, 201, { id });
  },
});
