// The workspace price list: base price, upgrade prices on finish choices, and add-on packages.
// GET /api/catalog            → for a signed-in member of the workspace
// GET /api/catalog?token=     → for a buyer on a customer link (read-only)
// PUT /api/catalog {base, finish: {key: {index: price}}, addons: [{id, name, price, group}]}  → owners and admins
import { route, send, fail, body } from './_lib/http.js';
import { db, now } from './_lib/db.js';
import { who, canManage } from './_lib/auth.js';
import { liveShare } from './_lib/shares.js';

const EMPTY = { base: 0, finish: {}, addons: [] };
const money = v => Math.max(0, Math.min(1e8, Math.round(+v || 0)));
function clean(b) { // keep only what the app understands, with sane sizes
  const finish = {};
  for (const [k, m] of Object.entries(b.finish || {}).slice(0, 40)) { if (!/^[a-z]{2,20}$/.test(k)) continue; finish[k] = {}; for (const [i, p] of Object.entries(m || {})) if (/^\d{1,2}$/.test(i) && money(p)) finish[k][i] = money(p); }
  const addons = (Array.isArray(b.addons) ? b.addons : []).slice(0, 100).map(a => ({ id: String(a.id || '').slice(0, 24) || Math.random().toString(36).slice(2, 10), name: String(a.name || '').trim().slice(0, 80), price: money(a.price), group: String(a.group || 'Options').trim().slice(0, 40) })).filter(a => a.name);
  return { base: money(b.base), finish, addons };
}
async function load(c, org) { const r = (await c.execute({ sql: 'SELECT body FROM catalogs WHERE org_id = ?', args: [org] })).rows[0]; return r ? { ...EMPTY, ...JSON.parse(r.body) } : EMPTY; }

export default route({
  async GET(req, res) {
    const c = await db();
    if (req.query.token) {
      const r = await liveShare(c, req); if (r.error) return res.status(r.error[0]).json({ error: r.error[1] });
      const p = (await c.execute({ sql: 'SELECT org_id, base_price FROM projects WHERE id = ?', args: [r.s.project_id] })).rows[0];
      const cat = p?.org_id ? await load(c, p.org_id) : EMPTY;
      return send(res, 200, { catalog: { ...cat, base: p?.base_price ?? cat.base } });
    }
    const w = await who(req); if (!w?.org) return send(res, 200, { catalog: EMPTY });
    send(res, 200, { catalog: await load(c, w.org.id), canEdit: canManage(w) });
  },
  async PUT(req, res) {
    const w = await who(req); if (!canManage(w) || !w.org) return fail(res, 403, 'Only owners and admins can change prices');
    const c = await db(), cat = clean(body(req));
    await c.execute({ sql: 'INSERT INTO catalogs (org_id, body, updated_at) VALUES (?, ?, ?) ON CONFLICT(org_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at', args: [w.org.id, JSON.stringify(cat), now()] });
    send(res, 200, { catalog: cat });
  },
});
