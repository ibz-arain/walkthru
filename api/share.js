// Studio:   POST  /api/share {projectId, customer, email, access, message, expiresDays?, password?} → new customer link
//           POST  /api/share {projectId, public: true} → the project's public view-only link (made once, then reused)
//           PATCH /api/share?token= {access?, revoked?, expiresDays?, password?}   (password '' removes it)
// Customer: GET   /api/share?token=            → what they see (their copy if they changed it, else the builder's design)
//           PUT   /api/share?token= {bm}       → save their copy (needs finishes or edit access)
//           POST  /api/share?token=&action=submit {note} | action=reset
// A link with a password needs it in the x-share-pass header; an expired link answers 410.
import { route, send, fail, newId, body, brand, ACCESS } from './_lib/http.js';
import { db, now, logEvent } from './_lib/db.js';
import { putJSON, getJSON, delBlob, keys } from './_lib/blob.js';
import { who, canEdit, ownsProject, hashPass } from './_lib/auth.js';
import { liveShare, expiryFrom } from './_lib/shares.js';
import { sendMail, notifyTeam, layout, appUrl } from './_lib/mail.js';

const PUBLIC = 'Anyone with the link'; // the customer name on a project's public view-only link
const project = async (c, id) => (await c.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] })).rows[0];
const shareUrl = (req, token) => `${appUrl(req)}/playground#c/${token}`;
const studioUrl = (req, id) => `${appUrl(req)}/playground#admin/p/${id}`;
function deny(res, r) { res.status(r.error[0]).json({ error: r.error[1], needPass: !!r.needPass }); }

export default route({
  async POST(req, res) {
    const c = await db();
    if (req.query.token) { // customer actions
      const r = await liveShare(c, req); if (r.error) return deny(res, r); const s = r.s;
      if (req.query.action === 'submit') {
        const note = String(body(req).note || '').slice(0, 2000);
        await c.execute({ sql: "UPDATE shares SET status = 'submitted', submitted_at = ?, submit_note = ?, updated_at = ? WHERE token = ?", args: [now(), note, now(), s.token] });
        await logEvent(c, s.project_id, 'submitted', { token: s.token, detail: { customer: s.customer, note, changed: !!s.has_copy } });
        const p = await project(c, s.project_id);
        await notifyTeam(req, p?.org_id, `${s.customer} sent ${s.has_copy ? 'changes' : 'feedback'} on ${p?.name}`, layout({ heading: `${s.customer} sent ${s.has_copy ? 'changes' : 'feedback'} for review`, lines: [p?.name || '', ...(note ? [`“${note}”`] : [])], cta: 'Review in Studio', url: studioUrl(req, s.project_id), foot: 'You get these because you are an editor in this workspace. Turn them off in Account settings.' }));
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
    const w = await who(req); if (!canEdit(w)) return fail(res, w ? 403 : 401, w ? 'Viewers can’t share projects' : 'Sign in to open the Studio');
    const b = body(req), access = ACCESS.includes(b.access) ? b.access : 'view';
    if (b.public) { // "Share link": anyone with it can look around, no sign-in, nothing they do is saved
      const p = await project(c, b.projectId); if (!ownsProject(w, p)) return fail(res, 404, 'Project not found');
      const old = (await c.execute({ sql: "SELECT token FROM shares WHERE project_id = ? AND customer = ? AND access = 'view' AND revoked = 0 AND pass_hash IS NULL AND expires_at IS NULL LIMIT 1", args: [p.id, PUBLIC] })).rows[0];
      if (old) return send(res, 200, { token: old.token });
      const token = newId(16);
      await c.execute({ sql: 'INSERT INTO shares (token, project_id, customer, email, access, message, created_at, expires_at, pass_hash) VALUES (?, ?, ?, NULL, ?, NULL, ?, NULL, NULL)', args: [token, p.id, PUBLIC, 'view', now()] });
      await logEvent(c, p.id, 'shared', { token, detail: { customer: PUBLIC, access: 'view' } });
      return send(res, 201, { token });
    }
    if (!b.projectId || !b.customer) return fail(res, 400, 'Pick a project and enter the customer name');
    const p = await project(c, b.projectId); if (!ownsProject(w, p)) return fail(res, 404, 'Project not found');
    const token = newId(16), email = b.email ? String(b.email).trim().slice(0, 160) : null;
    await c.execute({ sql: 'INSERT INTO shares (token, project_id, customer, email, access, message, created_at, expires_at, pass_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [token, b.projectId, String(b.customer).slice(0, 80), email, access, b.message ? String(b.message).slice(0, 1000) : null, now(), expiryFrom(b.expiresDays), b.password ? hashPass(b.password) : null] });
    await c.execute({ sql: "UPDATE projects SET status = CASE WHEN status = 'draft' THEN 'shared' ELSE status END, updated_at = ? WHERE id = ?", args: [now(), b.projectId] });
    await logEvent(c, b.projectId, 'shared', { token, detail: { customer: b.customer, access } });
    let mailed = null;
    if (email && b.sendEmail !== false) {
      const what = { view: 'look around it in 3D and leave comments', finishes: 'look around, pick finishes and leave comments', edit: 'look around, pick finishes, change the floor plan and leave comments' }[access];
      mailed = await sendMail(email, `${brand().name}: your home ${p.name} is ready to view`, layout({ heading: `Hi ${String(b.customer).split(' ')[0]}, your home is ready to explore`, lines: [`${p.name}${p.address ? ` · ${p.address}` : ''}`, ...(b.message ? [String(b.message)] : []), `You can ${what}.`, ...(b.password ? ['Your builder will give you the password for this link.'] : [])], cta: 'Open your home', url: shareUrl(req, token) }));
    }
    send(res, 201, { token, mailed });
  },
  async PATCH(req, res) {
    const w = await who(req); if (!canEdit(w)) return fail(res, w ? 403 : 401, 'Sign in as an editor to change links');
    const c = await db(), s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ?', args: [req.query.token] })).rows[0]; if (!s) return fail(res, 404, 'Link not found');
    if (!ownsProject(w, await project(c, s.project_id))) return fail(res, 404, 'Link not found');
    const b = body(req);
    if (b.access && ACCESS.includes(b.access)) await c.execute({ sql: 'UPDATE shares SET access = ? WHERE token = ?', args: [b.access, s.token] });
    if (typeof b.revoked === 'boolean') await c.execute({ sql: 'UPDATE shares SET revoked = ? WHERE token = ?', args: [b.revoked ? 1 : 0, s.token] });
    if (b.expiresDays !== undefined) await c.execute({ sql: 'UPDATE shares SET expires_at = ? WHERE token = ?', args: [expiryFrom(b.expiresDays), s.token] });
    if (typeof b.password === 'string') await c.execute({ sql: 'UPDATE shares SET pass_hash = ? WHERE token = ?', args: [b.password ? hashPass(b.password) : null, s.token] });
    send(res, 200, { ok: true });
  },
  async GET(req, res) {
    const c = await db(), w = req.query.as === 'studio' ? await who(req) : null;
    let s;
    if (w) { s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ?', args: [req.query.token] })).rows[0]; if (!s || !ownsProject(w, await project(c, s.project_id))) return fail(res, 404, 'Link not found'); }
    else { const r = await liveShare(c, req); if (r.error) return deny(res, r); s = r.s; }
    const p = await project(c, s.project_id); if (!p) return fail(res, 404, 'This project was removed');
    if (!w && !s.opened_at) { // the studio previewing a link doesn't count as the customer opening it
      await c.execute({ sql: "UPDATE shares SET opened_at = ?, status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END WHERE token = ?", args: [now(), s.token] });
      await logEvent(c, p.id, 'opened', { token: s.token, detail: { customer: s.customer } });
    }
    const bm = s.has_copy ? await getJSON(keys.share(s.token)) : await getJSON(keys.version(p.id, p.version));
    const comments = await c.execute({ sql: 'SELECT * FROM comments WHERE project_id = ? AND (share_token = ? OR (share_token IS NULL AND author_role = ?)) ORDER BY created_at ASC', args: [p.id, s.token, 'studio-public'] });
    const org = p.org_id && (await c.execute({ sql: 'SELECT name FROM orgs WHERE id = ?', args: [p.org_id] })).rows[0];
    send(res, 200, { brand: { ...brand(), name: org?.name || brand().name }, project: { name: p.name, address: p.address, version: p.version, base_price: p.base_price }, customer: s.customer, public: s.customer === PUBLIC, access: s.access, status: s.status, message: s.message,
      changed: !!s.has_copy, expires_at: s.expires_at, bm, comments: comments.rows.map(m => ({ ...m, pin: m.pin ? JSON.parse(m.pin) : null })) });
  },
  async PUT(req, res) {
    const c = await db(), r = await liveShare(c, req); if (r.error) return deny(res, r); const s = r.s;
    if (s.access === 'view') return fail(res, 403, 'This link is view-only');
    const b = body(req); if (!b.bm || !Array.isArray(b.bm.rooms)) return fail(res, 400, 'Bad design');
    if (s.access === 'finishes') { // finishes-only links can't move rooms: keep the builder's layout, take only their finish picks
      const p = await project(c, s.project_id);
      const base = await getJSON(keys.version(p.id, p.version)); b.bm = { ...base, finishes: b.bm.finishes || {}, addons: Array.isArray(b.bm.addons) ? b.bm.addons.slice(0, 100) : [] };
    }
    await putJSON(keys.share(s.token), b.bm);
    const first = !s.has_copy || (now() - (s.updated_at || 0)) > 10 * 60e3; // one activity entry per editing session
    await c.execute({ sql: "UPDATE shares SET has_copy = 1, status = 'editing', updated_at = ? WHERE token = ?", args: [now(), s.token] });
    if (first) await logEvent(c, s.project_id, s.access === 'finishes' ? 'finishes' : 'edited', { token: s.token, detail: { customer: s.customer } });
    send(res, 200, { ok: true });
  },
});
