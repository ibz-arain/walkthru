import { randomBytes } from 'node:crypto';

export const send = (res, code, body) => { res.status(code).json(body); };
export const fail = (res, code, message) => send(res, code, { error: message });

// Studio access. Set ADMIN_KEY in Vercel; with it unset (local demo) the studio is open.
export const adminLocked = () => !!process.env.ADMIN_KEY;
export const isAdmin = req => !adminLocked() || req.headers['x-admin-key'] === process.env.ADMIN_KEY;

export const newId = (n = 9) => randomBytes(n).toString('base64url');
export const body = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
export const brand = () => ({ name: 'Walkthru', tagline: 'Design review' });

export function route(handlers) {
  return async (req, res) => {
    const h = handlers[req.method];
    if (!h) return fail(res, 405, 'Method not allowed');
    try { await h(req, res); }
    catch (e) { console.error(e); fail(res, 500, 'Something went wrong on the server'); }
  };
}
export const ACCESS = ['view', 'finishes', 'edit'];
