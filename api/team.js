// GET    /api/team                       → members and pending invites of the active workspace
// POST   /api/team {email, role}         → invite someone (owners and admins)
// PATCH  /api/team {userId, role}        → change a member's role
// DELETE /api/team?user= | ?invite=      → remove a member / withdraw an invite (members can remove themselves)
// POST   /api/team?action=reset {userId}  → one-time password reset link for a member (24 h), also emailed to them
import { route, send, fail, body } from './_lib/http.js';
import { db, now } from './_lib/db.js';
import { who, canManage, ROLES, validEmail, token, sha, INVITE_DAYS } from './_lib/auth.js';
import { sendMail, layout, appUrl } from './_lib/mail.js';

async function owners(c, org) { return (await c.execute({ sql: "SELECT COUNT(*) AS n FROM members WHERE org_id = ? AND role = 'owner'", args: [org] })).rows[0].n; }

export default route({
  async GET(req, res) {
    const w = await who(req); if (!w?.org) return fail(res, 401, 'Sign in first');
    const c = await db();
    const [m, i] = await Promise.all([
      c.execute({ sql: 'SELECT u.id, u.email, u.name, m.role, m.created_at FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY m.created_at', args: [w.org.id] }),
      c.execute({ sql: 'SELECT token, email, role, created_at FROM invites WHERE org_id = ? AND accepted_at IS NULL ORDER BY created_at DESC', args: [w.org.id] }),
    ]);
    send(res, 200, { org: w.org, role: w.role, me: w.user.id, members: m.rows, invites: canManage(w) ? i.rows.map(r => ({ ...r, expired: now() - r.created_at >= INVITE_DAYS * 864e5 })) : [] });
  },
  async POST(req, res) {
    const w = await who(req); if (!canManage(w) || !w.org) return fail(res, 403, 'Only owners and admins can do that');
    if (req.query.action === 'reset') {
      const c = await db(), uid = body(req).userId;
      const m = (await c.execute({ sql: 'SELECT u.id, u.email, u.name, m.role FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.user_id = ?', args: [w.org.id, uid] })).rows[0];
      if (!m) return fail(res, 404, 'Not a member');
      if (m.role === 'owner' && w.role !== 'owner') return fail(res, 403, 'Only an owner can reset an owner’s password');
      const raw = token(24); await c.execute({ sql: 'INSERT INTO resets (id, user_id, expires_at) VALUES (?, ?, ?)', args: [sha(raw), m.id, now() + 864e5] });
      const url = `${appUrl(req)}/account#reset/${raw}`;
      await sendMail(m.email, 'Set a new password', layout({ heading: 'Set a new password', lines: [`${w.user.name || w.user.email} sent you a link to choose a new password. It works once, for 24 hours.`], cta: 'Choose a password', url }));
      return send(res, 201, { url });
    }
    const c = await db(), b = body(req), email = String(b.email || '').trim().toLowerCase(), role = ROLES.includes(b.role) && b.role !== 'owner' ? b.role : 'editor';
    if (!validEmail(email)) return fail(res, 400, 'Enter a valid email address');
    if ((await c.execute({ sql: 'SELECT 1 FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND u.email = ?', args: [w.org.id, email] })).rows.length) return fail(res, 409, 'That person is already in the workspace');
    const t = token(18);
    await c.execute({ sql: 'DELETE FROM invites WHERE org_id = ? AND email = ? AND accepted_at IS NULL', args: [w.org.id, email] }); // a new invite replaces an old one
    await c.execute({ sql: 'INSERT INTO invites (token, org_id, email, role, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: [t, w.org.id, email, role, w.user.id, now()] });
    await sendMail(email, `${w.user.name || w.user.email} invited you to ${w.org.name}`, layout({ heading: `Join ${w.org.name} on Walkthru`, lines: [`${w.user.name || w.user.email} invited you as ${role === 'viewer' ? 'a viewer' : `an ${role}`}. Walkthru is where the team designs homes and shares them with buyers in 3D.`], cta: 'Accept invite', url: `${appUrl(req)}/account#invite/${t}` }));
    send(res, 201, { token: t });
  },
  async PATCH(req, res) {
    const w = await who(req); if (!canManage(w) || !w.org) return fail(res, 403, 'Only owners and admins can change roles');
    const c = await db(), b = body(req); if (!ROLES.includes(b.role)) return fail(res, 400, 'Unknown role');
    const m = (await c.execute({ sql: 'SELECT role FROM members WHERE org_id = ? AND user_id = ?', args: [w.org.id, b.userId] })).rows[0]; if (!m) return fail(res, 404, 'Not a member');
    if ((m.role === 'owner' || b.role === 'owner') && w.role !== 'owner') return fail(res, 403, 'Only an owner can change who owns the workspace');
    if (m.role === 'owner' && b.role !== 'owner' && await owners(c, w.org.id) < 2) return fail(res, 400, 'A workspace needs at least one owner');
    await c.execute({ sql: 'UPDATE members SET role = ? WHERE org_id = ? AND user_id = ?', args: [b.role, w.org.id, b.userId] });
    send(res, 200, { ok: true });
  },
  async DELETE(req, res) {
    const w = await who(req); if (!w?.org) return fail(res, 401, 'Sign in first');
    const c = await db();
    if (req.query.invite) { if (!canManage(w)) return fail(res, 403, 'Only owners and admins can withdraw invites'); await c.execute({ sql: 'DELETE FROM invites WHERE token = ? AND org_id = ?', args: [req.query.invite, w.org.id] }); return send(res, 200, { ok: true }); }
    const uid = req.query.user; if (uid !== w.user.id && !canManage(w)) return fail(res, 403, 'Only owners and admins can remove people');
    const m = (await c.execute({ sql: 'SELECT role FROM members WHERE org_id = ? AND user_id = ?', args: [w.org.id, uid] })).rows[0]; if (!m) return fail(res, 404, 'Not a member');
    if (m.role === 'owner' && await owners(c, w.org.id) < 2) return fail(res, 400, 'A workspace needs at least one owner. Make someone else an owner first.');
    await c.execute({ sql: 'DELETE FROM members WHERE org_id = ? AND user_id = ?', args: [w.org.id, uid] });
    send(res, 200, { ok: true });
  },
});
