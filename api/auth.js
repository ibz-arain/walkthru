// GET   /api/auth                     → { user, org, role, orgs } for the signed-in person, or { user: null }
// POST  /api/auth?action=signup        {email, password, name, workspace, invite?}
//       /api/auth?action=login         {email, password}
//       /api/auth?action=logout
//       /api/auth?action=forgot        {email}            → emails a reset link
//       /api/auth?action=reset         {token, password}
//       /api/auth?action=switch        {orgId}            → change the active workspace
//       /api/auth?action=accept        {invite}           → join a workspace you were invited to
// PATCH /api/auth                      {name?, notify?, current?, password?, workspace?}
import { route, send, fail, body } from './_lib/http.js';
import { db, now } from './_lib/db.js';
import { who, hashPass, checkPass, startSession, endSession, createWorkspace, validEmail, token, sha, canManage, ROLES, signupsOpen, inviteLive, clientIp, throttled, failed, cleared } from './_lib/auth.js';
import { sendMail, layout, appUrl } from './_lib/mail.js';

async function me(c, w) {
  if (!w?.user) return { user: null, signups: signupsOpen() };
  const orgs = await c.execute({ sql: 'SELECT o.id, o.name, m.role FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.name', args: [w.user.id] });
  return { user: { ...w.user, notify: !!w.user.notify }, org: w.org, role: w.role, orgs: orgs.rows, signups: signupsOpen() };
}
async function joinInvite(c, inviteToken, user) {
  const inv = (await c.execute({ sql: 'SELECT * FROM invites WHERE token = ? AND accepted_at IS NULL', args: [inviteToken] })).rows[0];
  if (!inviteLive(inv)) return null;
  if (inv.email.toLowerCase() !== user.email.toLowerCase()) throw Object.assign(new Error(`This invite was sent to ${inv.email}`), { status: 403 });
  await c.batch([
    { sql: 'INSERT OR IGNORE INTO members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)', args: [inv.org_id, user.id, ROLES.includes(inv.role) ? inv.role : 'editor', now()] },
    { sql: 'UPDATE invites SET accepted_at = ? WHERE token = ?', args: [now(), inv.token] },
  ], 'write');
  return inv.org_id;
}
const tooShort = pw => typeof pw !== 'string' || pw.length < 8;

export default route({
  async GET(req, res) { const c = await db(); send(res, 200, await me(c, await who(req))); },

  async POST(req, res) {
    const c = await db(), b = body(req), a = req.query.action;
    if (a === 'signup') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!validEmail(email)) return fail(res, 400, 'Enter a valid email address');
      const sKey = `signup-ip:${clientIp(req)}`, sWait = await throttled(c, sKey); if (sWait) return fail(res, 429, `Too many sign-ups from here. Try again in ${sWait} minutes.`); await failed(c, sKey, 10, 3600e3, 3600e3);
      if (tooShort(b.password)) return fail(res, 400, 'Use at least 8 characters for your password');
      if ((await c.execute({ sql: 'SELECT 1 FROM users WHERE email = ?', args: [email] })).rows.length) return fail(res, 409, 'There is already an account with that email. Sign in instead.');
      if (!signupsOpen()) {
        let invited = b.invite && (await c.execute({ sql: 'SELECT * FROM invites WHERE token = ? AND accepted_at IS NULL', args: [b.invite] })).rows[0]; if (!inviteLive(invited)) invited = null;
        const first = (await c.execute('SELECT COUNT(*) AS n FROM users')).rows[0].n === 0;
        if (!first && (!invited || invited.email.toLowerCase() !== email)) return fail(res, 403, 'Sign-ups are closed. Ask your team for an invite.');
      }
      const id = token(9), name = String(b.name || '').trim().slice(0, 80) || email.split('@')[0];
      await c.execute({ sql: 'INSERT INTO users (id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)', args: [id, email, name, hashPass(b.password), now()] });
      const user = { id, email };
      let orgId = null; if (b.invite) try { orgId = await joinInvite(c, b.invite, user); } catch (e) { orgId = null; }
      if (!orgId) {
        orgId = await createWorkspace(c, id, String(b.workspace || '').trim() || `${name}'s workspace`);
        // The very first workspace inherits projects made before accounts existed.
        const first = (await c.execute('SELECT COUNT(*) AS n FROM orgs')).rows[0].n === 1;
        if (first) await c.execute({ sql: 'UPDATE projects SET org_id = ? WHERE org_id IS NULL', args: [orgId] });
      }
      await startSession(req, res, id, orgId);
      return send(res, 201, await me(c, await who({ headers: { cookie: res.getHeader('set-cookie') } })));
    }
    if (a === 'login') {
      const email = String(b.email || '').trim().toLowerCase(), eKey = `login:${email}`, iKey = `login-ip:${clientIp(req)}`;
      const wait = Math.max(await throttled(c, eKey), await throttled(c, iKey));
      if (wait) return fail(res, 429, `Too many attempts. Try again in ${wait} minute${wait > 1 ? 's' : ''}.`);
      const u = (await c.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];
      if (!u || !checkPass(b.password, u.pass_hash)) { await failed(c, eKey, 5); await failed(c, iKey, 30); return fail(res, 401, 'That email and password don’t match'); }
      await cleared(c, eKey);
      await startSession(req, res, u.id, null);
      return send(res, 200, await me(c, await who({ headers: { cookie: res.getHeader('set-cookie') } })));
    }
    if (a === 'logout') { await endSession(req, res); return send(res, 200, { ok: true }); }
    if (a === 'forgot') {
      const u = (await c.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [String(b.email || '').trim().toLowerCase()] })).rows[0];
      if (u) { // same answer either way, so the form can't be used to find out who has an account
        const raw = token(24); await c.execute({ sql: 'INSERT INTO resets (id, user_id, expires_at) VALUES (?, ?, ?)', args: [sha(raw), u.id, now() + 3600e3] });
        await sendMail(u.email, 'Reset your Demo password', layout({ heading: 'Reset your password', lines: ['Someone asked to reset the password for this account. The link works for one hour.'], cta: 'Choose a new password', url: `${appUrl(req)}/account#reset/${raw}`, foot: 'If this wasn’t you, ignore this email: your password stays the same.' }));
      }
      return send(res, 200, { ok: true });
    }
    if (a === 'reset') {
      if (tooShort(b.password)) return fail(res, 400, 'Use at least 8 characters for your password');
      const r = (await c.execute({ sql: 'SELECT * FROM resets WHERE id = ?', args: [sha(b.token)] })).rows[0];
      if (!r || r.used || r.expires_at < now()) return fail(res, 400, 'This reset link has expired. Ask for a new one.');
      await c.batch([
        { sql: 'UPDATE users SET pass_hash = ? WHERE id = ?', args: [hashPass(b.password), r.user_id] },
        { sql: 'UPDATE resets SET used = 1 WHERE id = ?', args: [r.id] },
        { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [r.user_id] },
      ], 'write');
      await startSession(req, res, r.user_id, null);
      return send(res, 200, { ok: true });
    }
    const w = await who(req); if (!w?.user) return fail(res, 401, 'Sign in first');
    if (a === 'switch') {
      const m = (await c.execute({ sql: 'SELECT 1 FROM members WHERE user_id = ? AND org_id = ?', args: [w.user.id, b.orgId] })).rows[0]; if (!m) return fail(res, 403, 'You are not in that workspace');
      await c.execute({ sql: 'UPDATE sessions SET org_id = ? WHERE id = ?', args: [b.orgId, w.session] });
      return send(res, 200, await me(c, await who(req)));
    }
    if (a === 'accept') {
      try { const org = await joinInvite(c, b.invite, w.user); if (!org) return fail(res, 404, 'This invite was already used or withdrawn');
        await c.execute({ sql: 'UPDATE sessions SET org_id = ? WHERE id = ?', args: [org, w.session] }); return send(res, 200, await me(c, await who(req))); }
      catch (e) { return fail(res, e.status || 400, e.message); }
    }
    if (a === 'workspace') { const id = await createWorkspace(c, w.user.id, String(b.name || '').trim() || 'New workspace'); await c.execute({ sql: 'UPDATE sessions SET org_id = ? WHERE id = ?', args: [id, w.session] }); return send(res, 201, await me(c, await who(req))); }
    fail(res, 400, 'Unknown action');
  },

  async PATCH(req, res) {
    const c = await db(), w = await who(req); if (!w?.user) return fail(res, 401, 'Sign in first');
    const b = body(req);
    if (typeof b.name === 'string' && b.name.trim()) await c.execute({ sql: 'UPDATE users SET name = ? WHERE id = ?', args: [b.name.trim().slice(0, 80), w.user.id] });
    if (typeof b.notify === 'boolean') await c.execute({ sql: 'UPDATE users SET notify = ? WHERE id = ?', args: [b.notify ? 1 : 0, w.user.id] });
    if (typeof b.workspace === 'string' && b.workspace.trim()) { if (!canManage(w)) return fail(res, 403, 'Only owners and admins can rename the workspace'); await c.execute({ sql: 'UPDATE orgs SET name = ? WHERE id = ?', args: [b.workspace.trim().slice(0, 80), w.org.id] }); }
    if (b.password) {
      const u = (await c.execute({ sql: 'SELECT pass_hash FROM users WHERE id = ?', args: [w.user.id] })).rows[0];
      if (!checkPass(b.current, u.pass_hash)) return fail(res, 400, 'Your current password is not right');
      if (tooShort(b.password)) return fail(res, 400, 'Use at least 8 characters for your password');
      await c.execute({ sql: 'UPDATE users SET pass_hash = ? WHERE id = ?', args: [hashPass(b.password), w.user.id] });
      await c.execute({ sql: 'DELETE FROM sessions WHERE user_id = ? AND id != ?', args: [w.user.id, w.session] });
    }
    send(res, 200, await me(c, await who(req)));
  },
});
