// Playground designs saved to your account.
// GET    /api/designs              → your designs (no JSON)
// GET    /api/designs?id=          → one design with its plan
// POST   /api/designs {name, bm}   → save a new one
// PUT    /api/designs?id= {name?, bm?}
// DELETE /api/designs?id=
import { route, send, fail, body } from './_lib/http.js';
import { db, now } from './_lib/db.js';
import { who, token } from './_lib/auth.js';
import { putJSON, getJSON, delBlob } from './_lib/blob.js';

const key = id => `designs/${id}.json`;
const MAX = 2_000_000;
async function mine(c, w, id) { return (await c.execute({ sql: 'SELECT * FROM designs WHERE id = ? AND user_id = ?', args: [id, w.user.id] })).rows[0]; }
function check(bm) { if (!bm || !Array.isArray(bm.rooms)) return 'That is not a floor plan'; if (JSON.stringify(bm).length > MAX) return 'This design is too large to save'; return null; }

export default route({
  async GET(req, res) {
    const w = await who(req); if (!w?.user) return fail(res, 401, 'Sign in to see your saved designs');
    const c = await db();
    if (req.query.id) { const d = await mine(c, w, req.query.id); if (!d) return fail(res, 404, 'Design not found'); return send(res, 200, { design: { ...d, bm: await getJSON(key(d.id)) } }); }
    const r = await c.execute({ sql: 'SELECT id, name, rooms, created_at, updated_at FROM designs WHERE user_id = ? ORDER BY updated_at DESC', args: [w.user.id] });
    send(res, 200, { designs: r.rows });
  },
  async POST(req, res) {
    const w = await who(req); if (!w?.user) return fail(res, 401, 'Sign in to save designs');
    const b = body(req), bad = check(b.bm); if (bad) return fail(res, 400, bad);
    const c = await db(), id = token(9), t = now();
    await putJSON(key(id), b.bm);
    await c.execute({ sql: 'INSERT INTO designs (id, user_id, org_id, name, rooms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [id, w.user.id, w.org?.id || null, String(b.name || 'Untitled design').slice(0, 60), b.bm.rooms.length, t, t] });
    send(res, 201, { id, updated_at: t });
  },
  async PUT(req, res) {
    const w = await who(req); if (!w?.user) return fail(res, 401, 'Sign in to save designs');
    const c = await db(), d = await mine(c, w, req.query.id); if (!d) return fail(res, 404, 'Design not found');
    const b = body(req), t = now();
    if (b.bm !== undefined) { const bad = check(b.bm); if (bad) return fail(res, 400, bad); await putJSON(key(d.id), b.bm); }
    await c.execute({ sql: 'UPDATE designs SET name = ?, rooms = ?, updated_at = ? WHERE id = ?', args: [typeof b.name === 'string' ? b.name.slice(0, 60) : d.name, b.bm ? b.bm.rooms.length : d.rooms, t, d.id] });
    send(res, 200, { ok: true, updated_at: t });
  },
  async DELETE(req, res) {
    const w = await who(req); if (!w?.user) return fail(res, 401, 'Sign in first');
    const c = await db(), d = await mine(c, w, req.query.id); if (!d) return fail(res, 404, 'Design not found');
    await delBlob(key(d.id)); await c.execute({ sql: 'DELETE FROM designs WHERE id = ?', args: [d.id] });
    send(res, 200, { ok: true });
  },
});
