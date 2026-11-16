// Local demo data: a studio account you can sign in with at /account.  npm run seed
// Uses the same database as `npm run dev` (.data/local.db unless .env.local says otherwise).
import { existsSync, readFileSync } from 'node:fs';
if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
export const DEMO = { email: 'demo@walkthru.test', password: 'walkthru-demo-1', name: 'Demo Builder', workspace: 'Demo Homes' };
const { db } = await import('../api/_lib/db.js');
const { hashPass, createWorkspace, token } = await import('../api/_lib/auth.js');
const c = await db();
if ((await c.execute({ sql: 'SELECT 1 FROM users WHERE email = ?', args: [DEMO.email] })).rows.length) console.log(`Demo account already exists: ${DEMO.email}`);
else {
  const id = token(9);
  await c.execute({ sql: 'INSERT INTO users (id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)', args: [id, DEMO.email, DEMO.name, hashPass(DEMO.password), Date.now()] });
  const org = await createWorkspace(c, id, DEMO.workspace);
  await c.execute({ sql: 'UPDATE projects SET org_id = ? WHERE org_id IS NULL', args: [org] });
  console.log(`Created ${DEMO.email} / ${DEMO.password} in workspace "${DEMO.workspace}"`);
}
