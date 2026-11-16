// POST /api/log {kind: 'error'|'event', name, detail?, path?}  → keep client errors and product events
// GET  /api/log?days=7                                       → counts for owners/admins (and the studio key)
import { route, send, fail, body } from './_lib/http.js';
import { db, now } from './_lib/db.js';
import { who, canManage } from './_lib/auth.js';

const KINDS = ['error', 'event'];
export default route({
  async POST(req, res) {
    const b = body(req); if (!KINDS.includes(b.kind) || !b.name) return send(res, 204, {});
    const w = await who(req).catch(() => null), c = await db();
    // Cheap flood guard: at most 300 rows a minute overall.
    const n = (await c.execute({ sql: 'SELECT COUNT(*) AS n FROM logs WHERE created_at > ?', args: [now() - 60e3] })).rows[0].n; if (n > 300) return send(res, 202, { ok: false });
    await c.execute({ sql: 'INSERT INTO logs (kind, name, detail, path, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: [b.kind, String(b.name).slice(0, 200), b.detail ? JSON.stringify(b.detail).slice(0, 4000) : null, String(b.path || '').slice(0, 300), w?.user?.id || null, now()] });
    send(res, 202, { ok: true });
  },
  async GET(req, res) {
    const w = await who(req); if (!canManage(w)) return fail(res, 403, 'Owners and admins only');
    const since = now() - Math.min(90, +req.query.days || 7) * 864e5, c = await db();
    const [events, errors] = await Promise.all([
      c.execute({ sql: "SELECT name, COUNT(*) AS n FROM logs WHERE kind = 'event' AND created_at > ? GROUP BY name ORDER BY n DESC", args: [since] }),
      c.execute({ sql: "SELECT name, path, COUNT(*) AS n, MAX(created_at) AS last FROM logs WHERE kind = 'error' AND created_at > ? GROUP BY name, path ORDER BY last DESC LIMIT 50", args: [since] }),
    ]);
    send(res, 200, { events: events.rows, errors: errors.rows });
  },
});
