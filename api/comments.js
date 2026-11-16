// GET   /api/comments?token=   (customer) | ?project= (studio)
// POST  /api/comments?token= {body, pin}  (customer)   | {projectId, token?, body, pin} (studio reply / note)
// PATCH /api/comments?id= {resolved}  (studio)
// New customer comments email the team; a studio reply on a customer's thread emails that customer.
import { route, send, fail, newId, body, brand } from './_lib/http.js';
import { db, now, logEvent } from './_lib/db.js';
import { who, canEdit, ownsProject } from './_lib/auth.js';
import { liveShare } from './_lib/shares.js';
import { sendMail, notifyTeam, layout, appUrl } from './_lib/mail.js';

const clean = pin => pin && Number.isFinite(pin.x) && Number.isFinite(pin.y) && Number.isFinite(pin.z) ? JSON.stringify({ x: +pin.x.toFixed(2), y: +pin.y.toFixed(2), z: +pin.z.toFixed(2), level: pin.level || null }) : null;
const rows = r => r.rows.map(m => ({ ...m, pin: m.pin ? JSON.parse(m.pin) : null }));
const project = async (c, id) => (await c.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] })).rows[0];
function deny(res, r) { res.status(r.error[0]).json({ error: r.error[1], needPass: !!r.needPass }); }

export default route({
  async GET(req, res) {
    const c = await db();
    if (req.query.token) { const r = await liveShare(c, req); if (r.error) return deny(res, r); return send(res, 200, { comments: rows(await c.execute({ sql: 'SELECT * FROM comments WHERE share_token = ? ORDER BY created_at ASC', args: [r.s.token] })) }); }
    const w = await who(req); if (!w) return fail(res, 401, 'Sign in to open the Studio');
    if (!ownsProject(w, await project(c, req.query.project))) return fail(res, 404, 'Project not found');
    send(res, 200, { comments: rows(await c.execute({ sql: 'SELECT * FROM comments WHERE project_id = ? ORDER BY created_at ASC', args: [req.query.project] })) });
  },
  async POST(req, res) {
    const c = await db(), b = body(req), text = String(b.body || '').trim().slice(0, 2000); if (!text) return fail(res, 400, 'Write something first');
    const id = newId(8);
    if (req.query.token) {
      const r = await liveShare(c, req); if (r.error) return deny(res, r); const s = r.s;
      await c.execute({ sql: 'INSERT INTO comments (id, project_id, share_token, author_role, author, body, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [id, s.project_id, s.token, 'customer', s.customer, text, clean(b.pin), now()] });
      await logEvent(c, s.project_id, 'comment', { token: s.token, detail: { customer: s.customer, text: text.slice(0, 120) } });
      const p = await project(c, s.project_id);
      await notifyTeam(req, p?.org_id, `New comment from ${s.customer} on ${p?.name}`, layout({ heading: `${s.customer} left a comment`, lines: [p?.name || '', `“${text.slice(0, 400)}”`], cta: 'Reply in Studio', url: `${appUrl(req)}/playground#admin/p/${s.project_id}`, foot: 'Turn these emails off in Account settings.' }));
      return send(res, 201, { id });
    }
    const w = await who(req); if (!canEdit(w)) return fail(res, w ? 403 : 401, 'Sign in as an editor to comment');
    if (!b.projectId) return fail(res, 400, 'Missing project');
    const p = await project(c, b.projectId); if (!ownsProject(w, p)) return fail(res, 404, 'Project not found');
    const author = b.author || w.user?.name || 'Studio';
    await c.execute({ sql: 'INSERT INTO comments (id, project_id, share_token, author_role, author, body, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [id, b.projectId, b.token || null, 'studio', author, text, clean(b.pin), now()] });
    if (b.token) {
      const s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ? AND revoked = 0', args: [b.token] })).rows[0];
      if (s?.email) await sendMail(s.email, `${author} replied about ${p.name}`, layout({ heading: `${author} replied to you`, lines: [`“${text.slice(0, 600)}”`], cta: 'Open your home', url: `${appUrl(req)}/playground#c/${s.token}`, foot: `Sent by ${brand().name} about ${p.name}.` }));
    }
    send(res, 201, { id });
  },
  async PATCH(req, res) {
    const w = await who(req); if (!canEdit(w)) return fail(res, w ? 403 : 401, 'Sign in as an editor');
    const c = await db(), m = (await c.execute({ sql: 'SELECT project_id FROM comments WHERE id = ?', args: [req.query.id] })).rows[0];
    if (!m || !ownsProject(w, await project(c, m.project_id))) return fail(res, 404, 'Comment not found');
    await c.execute({ sql: 'UPDATE comments SET resolved = ? WHERE id = ?', args: [body(req).resolved ? 1 : 0, req.query.id] });
    send(res, 200, { ok: true });
  },
});
