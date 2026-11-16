// Accounts: scrypt password hashes, cookie sessions, and who-can-do-what inside a workspace.
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db, now } from './db.js';

export const ROLES = ['owner', 'admin', 'editor', 'viewer'];
// ALLOW_SIGNUPS=false closes public sign-up. Invited people can still join, and the very first account can always be made.
export const signupsOpen = () => !/^(0|false|no|off)$/i.test(String(process.env.ALLOW_SIGNUPS ?? 'true').trim());
const COOKIE = 'wt_session', DAYS = 30;

export function hashPass(pw) { const salt = randomBytes(16); return `s1$${salt.toString('base64url')}$${scryptSync(String(pw), salt, 32).toString('base64url')}`; }
export function checkPass(pw, stored) {
  const [v, salt, hash] = String(stored || '').split('$'); if (v !== 's1' || !salt || !hash) return false;
  const a = scryptSync(String(pw), Buffer.from(salt, 'base64url'), 32), b = Buffer.from(hash, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}
export const sha = s => createHash('sha256').update(String(s)).digest('base64url');
export const token = (n = 24) => randomBytes(n).toString('base64url');
export const validEmail = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 160;

function cookies(req) { const out = {}; for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } return out; }
const secure = req => (req.headers['x-forwarded-proto'] || '').includes('https') || process.env.VERCEL === '1';
export function setSessionCookie(req, res, value, maxAge = DAYS * 86400) {
  res.setHeader('set-cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`);
}
export async function startSession(req, res, userId, orgId) {
  const c = await db(), raw = token(32);
  await c.execute({ sql: 'INSERT INTO sessions (id, user_id, org_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', args: [sha(raw), userId, orgId, now() + DAYS * 864e5, now()] });
  setSessionCookie(req, res, raw);
}
export async function endSession(req, res) {
  const raw = cookies(req)[COOKIE]; if (raw) await (await db()).execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sha(raw)] });
  setSessionCookie(req, res, '', 0);
}

// Who is calling: { user, org, role } for a signed-in member, { super: true } for the legacy ADMIN_KEY, or null.
export async function who(req) {
  if (process.env.ADMIN_KEY && req.headers['x-admin-key'] === process.env.ADMIN_KEY) return { super: true, role: 'owner' };
  const raw = cookies(req)[COOKIE]; if (!raw) return null;
  const c = await db(), s = (await c.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sha(raw)] })).rows[0];
  if (!s || s.expires_at < now()) return null;
  const user = (await c.execute({ sql: 'SELECT id, email, name, notify, created_at FROM users WHERE id = ?', args: [s.user_id] })).rows[0]; if (!user) return null;
  let m = s.org_id && (await c.execute({ sql: 'SELECT m.role, o.id, o.name FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.org_id = ?', args: [user.id, s.org_id] })).rows[0];
  if (!m) { m = (await c.execute({ sql: 'SELECT m.role, o.id, o.name FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1', args: [user.id] })).rows[0]; if (m) await c.execute({ sql: 'UPDATE sessions SET org_id = ? WHERE id = ?', args: [m.id, s.id] }); }
  return { user, session: s.id, org: m ? { id: m.id, name: m.name } : null, role: m?.role || null };
}
export const canEdit = w => !!w && (w.super || ['owner', 'admin', 'editor'].includes(w.role));
export const canManage = w => !!w && (w.super || ['owner', 'admin'].includes(w.role));
// Does this caller's workspace own the project? (The legacy studio key sees everything.)
export const ownsProject = (w, p) => !!w && !!p && (w.super || (w.org && p.org_id === w.org.id));

export const INVITE_DAYS = 7;
export const inviteLive = inv => !!inv && !inv.accepted_at && now() - inv.created_at < INVITE_DAYS * 864e5;
export const clientIp = req => String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
// Rate limiting: `max` failures inside `windowMs` locks the key for `lockMs`.
export async function throttled(c, key) {
  const r = (await c.execute({ sql: 'SELECT locked_until FROM attempts WHERE key = ?', args: [key] })).rows[0];
  return r?.locked_until && r.locked_until > now() ? Math.ceil((r.locked_until - now()) / 60e3) : 0;
}
export async function failed(c, key, max, windowMs = 15 * 60e3, lockMs = 15 * 60e3) {
  const r = (await c.execute({ sql: 'SELECT * FROM attempts WHERE key = ?', args: [key] })).rows[0], t = now();
  if (!r || t - r.first_at > windowMs) return c.execute({ sql: 'INSERT OR REPLACE INTO attempts (key, n, first_at, locked_until) VALUES (?, 1, ?, NULL)', args: [key, t] });
  const n = r.n + 1; await c.execute({ sql: 'UPDATE attempts SET n = ?, locked_until = ? WHERE key = ?', args: [n, n >= max ? t + lockMs : null, key] });
}
export const cleared = (c, key) => c.execute({ sql: 'DELETE FROM attempts WHERE key = ?', args: [key] });

export async function createWorkspace(c, userId, name) {
  const id = token(6), t = now();
  await c.batch([
    { sql: 'INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)', args: [id, String(name).slice(0, 80), t] },
    { sql: 'INSERT INTO members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)', args: [id, userId, 'owner', t] },
  ], 'write');
  return id;
}
