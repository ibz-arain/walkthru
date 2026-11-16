import { route, send, adminLocked, brand } from './_lib/http.js';
import { db } from './_lib/db.js';
// accounts: the Studio uses sign-in; adminLocked: the old shared studio key also still works.
export default route({ async GET(req, res) { await db(); send(res, 200, { ok: true, adminLocked: adminLocked(), brand: brand(), accounts: true, mail: !!process.env.RESEND_API_KEY }); } });
