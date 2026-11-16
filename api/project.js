// GET    /api/project?id=            → project, current design, share links, comments, activity, versions
// PUT    /api/project?id=  {bm?, name?, client?, address?, status?, summary?, preview?}  → autosave
// POST   /api/project?id=&action=accept&token=  → adopt a customer's version as a new version
// POST   /api/project?id=&action=restore&version=  → roll back to an earlier version (as a new version)
// DELETE /api/project?id=
import { route, send, fail, isAdmin, body } from './_lib/http.js';
import { db, now, logEvent } from './_lib/db.js';
import { putJSON, getJSON, delBlob, keys } from './_lib/blob.js';

async function load(c, id) { return (await c.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] })).rows[0]; }
async function newVersion(c, p, bm, note) {
  const v = p.version + 1, t = now();
  await putJSON(keys.version(p.id, v), bm);
  await c.batch([
    { sql: 'INSERT INTO versions (project_id, version, blob_key, note, created_at) VALUES (?, ?, ?, ?, ?)', args: [p.id, v, keys.version(p.id, v), note, t] },
    { sql: 'UPDATE projects SET version = ?, updated_at = ? WHERE id = ?', args: [v, t, p.id] },
  ], 'write');
  return v;
}

export default route({
  async GET(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db(), p = await load(c, req.query.id); if (!p) return fail(res, 404, 'Project not found');
    const [shares, comments, events, versions] = await Promise.all([
      c.execute({ sql: 'SELECT * FROM shares WHERE project_id = ? ORDER BY created_at DESC', args: [p.id] }),
      c.execute({ sql: 'SELECT * FROM comments WHERE project_id = ? ORDER BY created_at ASC', args: [p.id] }),
      c.execute({ sql: 'SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC LIMIT 60', args: [p.id] }),
      c.execute({ sql: 'SELECT version, note, created_at FROM versions WHERE project_id = ? ORDER BY version DESC', args: [p.id] }),
    ]);
    const bm = await getJSON(keys.version(p.id, p.version));
    send(res, 200, { project: { ...p, summary: p.summary ? JSON.parse(p.summary) : null }, bm, shares: shares.rows, versions: versions.rows,
      comments: comments.rows.map(m => ({ ...m, pin: m.pin ? JSON.parse(m.pin) : null })), events: events.rows.map(e => ({ ...e, detail: e.detail ? JSON.parse(e.detail) : null })) });
  },
  async PUT(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db(), p = await load(c, req.query.id); if (!p) return fail(res, 404, 'Project not found');
    const b = body(req);
    if (b.bm) { if (!Array.isArray(b.bm.rooms)) return fail(res, 400, 'Bad design'); await putJSON(keys.version(p.id, p.version), b.bm); }
    const sets = [], args = [];
    for (const k of ['name', 'client', 'address', 'status']) if (typeof b[k] === 'string') { sets.push(`${k} = ?`); args.push(b[k].slice(0, 120)); }
    for (const k of ['summary', 'preview']) if (b[k] !== undefined) { sets.push(`${k} = ?`); args.push(JSON.stringify(b[k])); }
    sets.push('updated_at = ?'); args.push(now());
    await c.execute({ sql: `UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, args: [...args, p.id] });
    send(res, 200, { ok: true, version: p.version });
  },
  async POST(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db(), p = await load(c, req.query.id); if (!p) return fail(res, 404, 'Project not found');
    if (req.query.action === 'accept') {
      const s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ? AND project_id = ?', args: [req.query.token, p.id] })).rows[0];
      if (!s || !s.has_copy) return fail(res, 400, 'That customer has no changes to accept');
      const bm = await getJSON(keys.share(s.token));
      const v = await newVersion(c, p, bm, `Accepted changes from ${s.customer}`);
      await c.execute({ sql: "UPDATE shares SET status = 'accepted', has_copy = 0, updated_at = ? WHERE token = ?", args: [now(), s.token] });
      await delBlob(keys.share(s.token));
      await logEvent(c, p.id, 'accepted', { token: s.token, detail: { customer: s.customer, version: v } });
      return send(res, 200, { ok: true, version: v });
    }
    if (req.query.action === 'restore') {
      const want = +req.query.version, bm = await getJSON(keys.version(p.id, want)); if (!bm) return fail(res, 404, 'Version not found');
      const v = await newVersion(c, p, bm, `Restored version ${want}`);
      await logEvent(c, p.id, 'restored', { detail: { from: want, version: v } });
      return send(res, 200, { ok: true, version: v });
    }
    if (req.query.action === 'snapshot') {
      const bm = await getJSON(keys.version(p.id, p.version)), note = String(body(req).note || 'Saved version').slice(0, 120);
      const v = await newVersion(c, p, bm, note); await logEvent(c, p.id, 'snapshot', { detail: { version: v, note } });
      return send(res, 200, { ok: true, version: v });
    }
    fail(res, 400, 'Unknown action');
  },
  async DELETE(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db(), p = await load(c, req.query.id); if (!p) return fail(res, 404, 'Project not found');
    const vs = await c.execute({ sql: 'SELECT blob_key FROM versions WHERE project_id = ?', args: [p.id] });
    const ss = await c.execute({ sql: 'SELECT token FROM shares WHERE project_id = ?', args: [p.id] });
    for (const r of vs.rows) await delBlob(r.blob_key);
    for (const r of ss.rows) await delBlob(keys.share(r.token));
    await c.batch(['versions', 'shares', 'comments', 'events'].map(t => ({ sql: `DELETE FROM ${t} WHERE project_id = ?`, args: [p.id] })).concat([{ sql: 'DELETE FROM projects WHERE id = ?', args: [p.id] }]), 'write');
    send(res, 200, { ok: true });
  },
});
