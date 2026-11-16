// Customer links: look one up and check it is still usable (not revoked, not expired, right password).
import { checkPass } from './auth.js';
import { now } from './db.js';

export async function liveShare(c, req) {
  const t = req.query.token; if (!t) return { error: [404, 'This link is no longer active'] };
  const s = (await c.execute({ sql: 'SELECT * FROM shares WHERE token = ?', args: [t] })).rows[0];
  if (!s || s.revoked) return { error: [404, 'This link is no longer active'] };
  if (s.expires_at && s.expires_at < now()) return { error: [410, 'This link has expired. Ask your builder for a new one.'] };
  if (s.pass_hash && !checkPass(req.headers['x-share-pass'] || '', s.pass_hash)) return { error: [401, 'This link needs a password'], needPass: true };
  return { s };
}
export const expiryFrom = days => { const d = +days; return d > 0 && d <= 365 ? now() + d * 864e5 : null; };
