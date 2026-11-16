// GET   /api/comments?token=   (customer) | ?project= (studio)
// POST  /api/comments?token= {body, pin}  (customer)   | {projectId, token?, body, pin} (studio reply / note)
// PATCH /api/comments?id= {resolved}  (studio)
import { route, send, fail, isAdmin, newId, body } from './_lib/http.js';
import { db, now, logEvent } from './_lib/db.js';

const clean = pin => pin && Number.isFinite(pin.x) && Number.isFinite(pin.y) && Number.isFinite(pin.z) ? JSON.stringify({ x: +pin.x.toFixed(2), y: +pin.y.toFixed(2), z: +pin.z.toFixed(2), level: pin.level || null }) : null;

export default route({
  async GET(req, res) {
    const c = await db();
    if (req.query.token) {
      const s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ? AND revoked = 0', args: [req.query.token] })).rows[0]; if (!s) return fail(res, 404, 'Link not found');
      const r = await c.execute({ sql: 'SELECT * FROM comments WHERE share_token = ? ORDER BY created_at ASC', args: [s.token] });
      return send(res, 200, { comments: r.rows.map(m => ({ ...m, pin: m.pin ? JSON.parse(m.pin) : null })) });
    }
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const r = await c.execute({ sql: 'SELECT * FROM comments WHERE project_id = ? ORDER BY created_at ASC', args: [req.query.project] });
    send(res, 200, { comments: r.rows.map(m => ({ ...m, pin: m.pin ? JSON.parse(m.pin) : null })) });
  },
  async POST(req, res) {
    const c = await db(), b = body(req), text = String(b.body || '').trim().slice(0, 2000); if (!text) return fail(res, 400, 'Write something first');
    const id = newId(8);
    if (req.query.token) {
      const s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ? AND revoked = 0', args: [req.query.token] })).rows[0]; if (!s) return fail(res, 404, 'Link not found');
      await c.execute({ sql: 'INSERT INTO comments (id, project_id, share_token, author_role, author, body, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [id, s.project_id, s.token, 'customer', s.customer, text, clean(b.pin), now()] });
      await logEvent(c, s.project_id, 'comment', { token: s.token, detail: { customer: s.customer, text: text.slice(0, 120) } });
      return send(res, 201, { id });
    }
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    if (!b.projectId) return fail(res, 400, 'Missing project');
    await c.execute({ sql: 'INSERT INTO comments (id, project_id, share_token, author_role, author, body, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [id, b.projectId, b.token || null, 'studio', b.author || 'Studio', text, clean(b.pin), now()] });
    send(res, 201, { id });
  },
  async PATCH(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db(); await c.execute({ sql: 'UPDATE comments SET resolved = ? WHERE id = ?', args: [body(req).resolved ? 1 : 0, req.query.id] });
    send(res, 200, { ok: true });
  },
});
