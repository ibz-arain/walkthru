// Studio:   POST  /api/share {projectId, customer, email, access, message} → new customer link
//           PATCH /api/share?token= {access?, revoked?}
// Customer: GET   /api/share?token=            → what they see (their copy if they changed it, else the builder's design)
//           PUT   /api/share?token= {bm}       → save their copy (needs finishes or edit access)
//           POST  /api/share?token=&action=submit {note} | action=reset
import { route, send, fail, isAdmin, newId, body, brand, ACCESS } from './_lib/http.js';
import { db, now, logEvent } from './_lib/db.js';
import { putJSON, getJSON, delBlob, keys } from './_lib/blob.js';

async function share(c, token) { return token && (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ?', args: [token] })).rows[0]; }

export default route({
  async POST(req, res) {
    const c = await db();
    if (req.query.token) { // customer actions
      const s = await share(c, req.query.token); if (!s || s.revoked) return fail(res, 404, 'This link is no longer active');
      if (req.query.action === 'submit') {
        const note = String(body(req).note || '').slice(0, 2000);
        await c.execute({ sql: "UPDATE shares SET status = 'submitted', submitted_at = ?, submit_note = ?, updated_at = ? WHERE token = ?", args: [now(), note, now(), s.token] });
        await logEvent(c, s.project_id, 'submitted', { token: s.token, detail: { customer: s.customer, note, changed: !!s.has_copy } });
        return send(res, 200, { ok: true });
      }
      if (req.query.action === 'reset') {
        await delBlob(keys.share(s.token));
        await c.execute({ sql: "UPDATE shares SET has_copy = 0, status = 'opened', updated_at = ? WHERE token = ?", args: [now(), s.token] });
        await logEvent(c, s.project_id, 'reset', { token: s.token, detail: { customer: s.customer } });
        return send(res, 200, { ok: true });
      }
      return fail(res, 400, 'Unknown action');
    }
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const b = body(req), access = ACCESS.includes(b.access) ? b.access : 'view';
    if (!b.projectId || !b.customer) return fail(res, 400, 'Pick a project and enter the customer name');
    const token = newId(16);
    await c.execute({ sql: 'INSERT INTO shares (token, project_id, customer, email, access, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [token, b.projectId, String(b.customer).slice(0, 80), b.email || null, access, b.message ? String(b.message).slice(0, 1000) : null, now()] });
    await c.execute({ sql: "UPDATE projects SET status = CASE WHEN status = 'draft' THEN 'shared' ELSE status END, updated_at = ? WHERE id = ?", args: [now(), b.projectId] });
    await logEvent(c, b.projectId, 'shared', { token, detail: { customer: b.customer, access } });
    send(res, 201, { token });
  },
  async PATCH(req, res) {
    if (!isAdmin(req)) return fail(res, 401, 'Studio key required');
    const c = await db(), s = await share(c, req.query.token); if (!s) return fail(res, 404, 'Link not found');
    const b = body(req);
    if (b.access && ACCESS.includes(b.access)) await c.execute({ sql: 'UPDATE shares SET access = ? WHERE token = ?', args: [b.access, s.token] });
    if (typeof b.revoked === 'boolean') await c.execute({ sql: 'UPDATE shares SET revoked = ? WHERE token = ?', args: [b.revoked ? 1 : 0, s.token] });
    send(res, 200, { ok: true });
  },
  async GET(req, res) {
    const c = await db(), s = await share(c, req.query.token); if (!s || s.revoked) return fail(res, 404, 'This link is no longer active');
    const p = (await c.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [s.project_id] })).rows[0]; if (!p) return fail(res, 404, 'This project was removed');
    const studio = req.query.as === 'studio' && isAdmin(req); // the studio previewing a link doesn't count as the customer opening it
    if (!studio) {
      if (!s.opened_at) { await c.execute({ sql: "UPDATE shares SET opened_at = ?, status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END WHERE token = ?", args: [now(), s.token] }); await logEvent(c, p.id, 'opened', { token: s.token, detail: { customer: s.customer } }); }
    }
    const bm = s.has_copy ? await getJSON(keys.share(s.token)) : await getJSON(keys.version(p.id, p.version));
    const comments = await c.execute({ sql: 'SELECT * FROM comments WHERE project_id = ? AND (share_token = ? OR (share_token IS NULL AND author_role = ?)) ORDER BY created_at ASC', args: [p.id, s.token, 'studio-public'] });
    send(res, 200, { brand: brand(), project: { name: p.name, address: p.address, version: p.version }, customer: s.customer, access: s.access, status: s.status, message: s.message,
      changed: !!s.has_copy, bm, comments: comments.rows.map(m => ({ ...m, pin: m.pin ? JSON.parse(m.pin) : null })) });
  },
  async PUT(req, res) {
    const c = await db(), s = await share(c, req.query.token); if (!s || s.revoked) return fail(res, 404, 'This link is no longer active');
    if (s.access === 'view') return fail(res, 403, 'This link is view-only');
    const b = body(req); if (!b.bm || !Array.isArray(b.bm.rooms)) return fail(res, 400, 'Bad design');
    if (s.access === 'finishes') { // finishes-only links can't move rooms: keep the builder's layout, take only their finish picks
      const p = (await c.execute({ sql: 'SELECT id, version FROM projects WHERE id = ?', args: [s.project_id] })).rows[0];
      const base = await getJSON(keys.version(p.id, p.version)); b.bm = { ...base, finishes: b.bm.finishes || {} };
    }
    await putJSON(keys.share(s.token), b.bm);
    const first = !s.has_copy || (now() - (s.updated_at || 0)) > 10 * 60e3; // one activity entry per editing session
    await c.execute({ sql: "UPDATE shares SET has_copy = 1, status = 'editing', updated_at = ? WHERE token = ?", args: [now(), s.token] });
    if (first) await logEvent(c, s.project_id, s.access === 'finishes' ? 'finishes' : 'edited', { token: s.token, detail: { customer: s.customer } });
    send(res, 200, { ok: true });
  },
});
