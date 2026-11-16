import { route, send, adminLocked, brand } from './_lib/http.js';
import { db } from './_lib/db.js';
export default route({ async GET(req, res) { await db(); send(res, 200, { ok: true, adminLocked: adminLocked(), brand: brand() }); } });
