// API tests: run each /api handler in-process against a throwaway SQLite file.  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync } from 'node:fs';

mkdirSync('.data', { recursive: true });
const file = `.data/test-${process.pid}.db`;
process.env.TURSO_DATABASE_URL = `file:${file}`; delete process.env.ADMIN_KEY; delete process.env.RESEND_API_KEY; process.env.VERCEL = '1'; // VERCEL=1 keeps mail quiet
const H = {};
for (const n of ['auth', 'team', 'designs', 'projects', 'project', 'share', 'comments', 'log']) H[n] = (await import(`../api/${n}.js`)).default;

// A tiny client that keeps its own cookie, like one browser.
function client() {
  let cookie = '';
  return async (name, method = 'GET', query = {}, data, headers = {}) => {
    const req = { method, query, headers: { cookie, host: 'test.local', 'content-type': 'application/json', ...headers }, body: data };
    const out = { code: 200, headers: {} };
    const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, getHeader(k) { return out.headers[k.toLowerCase()]; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; } };
    await H[name](req, res);
    const sc = out.headers['set-cookie']; if (sc) cookie = sc.split(';')[0];
    return out;
  };
}
const bm = { roof: 'hip', rooms: [{ id: 1, type: 'living', level: 'M', x: 0, z: 0, w: 14, d: 12 }] };

test('accounts, workspaces and project isolation', async () => {
  const ann = client(), bob = client(), anon = client();
  let r = await ann('auth', 'POST', { action: 'signup' }, { email: 'ann@example.com', password: 'longpassword', name: 'Ann', workspace: 'Ann Homes' });
  assert.equal(r.code, 201); assert.equal(r.body.org.name, 'Ann Homes'); assert.equal(r.body.role, 'owner');
  r = await ann('auth', 'POST', { action: 'signup' }, { email: 'ann@example.com', password: 'longpassword' }); assert.equal(r.code, 409);
  r = await bob('auth', 'POST', { action: 'signup' }, { email: 'bob@example.com', password: 'short' }); assert.equal(r.code, 400);
  r = await bob('auth', 'POST', { action: 'signup' }, { email: 'bob@example.com', password: 'otherpassword', workspace: 'Bob Builds' }); assert.equal(r.code, 201);

  assert.equal((await anon('projects')).code, 401);
  r = await ann('projects', 'POST', {}, { name: 'Lot 12', bm }); assert.equal(r.code, 201); const pid = r.body.id;
  assert.equal((await ann('projects')).body.projects.length, 1);
  assert.equal((await bob('projects')).body.projects.length, 0, 'other workspaces must not see the project');
  assert.equal((await bob('project', 'GET', { id: pid })).code, 404);
  assert.equal((await ann('project', 'GET', { id: pid })).code, 200);

  // login / logout
  const ann2 = client();
  assert.equal((await ann2('auth', 'POST', { action: 'login' }, { email: 'ann@example.com', password: 'wrong' })).code, 401);
  assert.equal((await ann2('auth', 'POST', { action: 'login' }, { email: 'ANN@example.com', password: 'longpassword' })).code, 200);
  assert.equal((await ann2('auth')).body.user.email, 'ann@example.com');
  await ann2('auth', 'POST', { action: 'logout' }); assert.equal((await ann2('auth')).body.user, null);
});

test('invites and roles', async () => {
  const own = client(), cat = client();
  await own('auth', 'POST', { action: 'signup' }, { email: 'own@example.com', password: 'longpassword', workspace: 'Team' });
  let r = await own('team', 'POST', {}, { email: 'cat@example.com', role: 'viewer' }); assert.equal(r.code, 201);
  const inv = r.body.token;
  r = await cat('auth', 'POST', { action: 'signup' }, { email: 'cat@example.com', password: 'longpassword', invite: inv }); assert.equal(r.code, 201);
  assert.equal(r.body.org.name, 'Team'); assert.equal(r.body.role, 'viewer');
  assert.equal((await cat('projects', 'POST', {}, { name: 'Nope', bm })).code, 403, 'viewers cannot create');
  assert.equal((await cat('team', 'POST', {}, { email: 'x@example.com' })).code, 403);
  const me = (await own('team')).body; const catId = me.members.find(m => m.email === 'cat@example.com').id;
  assert.equal((await own('team', 'PATCH', {}, { userId: catId, role: 'editor' })).code, 200);
  assert.equal((await cat('projects', 'POST', {}, { name: 'Now ok', bm })).code, 201);
  assert.equal((await own('team', 'DELETE', { user: me.me })).code, 400, 'last owner cannot leave');
});

test('customer links: expiry, password, comments', async () => {
  const b = client(), cust = client();
  await b('auth', 'POST', { action: 'signup' }, { email: 'b@example.com', password: 'longpassword' });
  const pid = (await b('projects', 'POST', {}, { name: 'House', bm })).body.id;
  let r = await b('share', 'POST', {}, { projectId: pid, customer: 'Jane', email: 'jane@example.com', access: 'edit', password: 'opensesame', expiresDays: 7 });
  assert.equal(r.code, 201); const tok = r.body.token; assert.equal(r.body.mailed, 'queued');
  r = await cust('share', 'GET', { token: tok }); assert.equal(r.code, 401); assert.equal(r.body.needPass, true);
  r = await cust('share', 'GET', { token: tok }, undefined, { 'x-share-pass': 'opensesame' }); assert.equal(r.code, 200); assert.equal(r.body.customer, 'Jane');
  r = await cust('comments', 'POST', { token: tok }, { body: 'Bigger kitchen?' }, { 'x-share-pass': 'opensesame' }); assert.equal(r.code, 201);
  await b('share', 'PATCH', { token: tok }, { expiresDays: 0, password: '' });
  assert.equal((await cust('share', 'GET', { token: tok })).code, 200, 'password removed, no expiry');
  const { db } = await import('../api/_lib/db.js'); const c = await db();
  await c.execute({ sql: 'UPDATE shares SET expires_at = ? WHERE token = ?', args: [Date.now() - 1000, tok] });
  assert.equal((await cust('share', 'GET', { token: tok })).code, 410);
  const mails = (await c.execute("SELECT to_addr, subject FROM outbox WHERE to_addr IN ('jane@example.com','b@example.com')")).rows;
  assert.ok(mails.some(m => m.to_addr === 'jane@example.com'), 'customer got the link email');
  assert.ok(mails.some(m => m.to_addr === 'b@example.com' && /comment/i.test(m.subject)), 'team got the comment email');
});

test('saved designs belong to their owner', async () => {
  const a = client(), z = client();
  await a('auth', 'POST', { action: 'signup' }, { email: 'd1@example.com', password: 'longpassword' });
  await z('auth', 'POST', { action: 'signup' }, { email: 'd2@example.com', password: 'longpassword' });
  let r = await a('designs', 'POST', {}, { name: 'Mine', bm }); assert.equal(r.code, 201); const id = r.body.id;
  assert.equal((await a('designs', 'GET', { id })).body.design.bm.rooms.length, 1);
  assert.equal((await z('designs', 'GET', { id })).code, 404);
  assert.equal((await a('designs', 'PUT', { id }, { name: 'Renamed', bm: { ...bm, rooms: [] } })).code, 200);
  assert.equal((await a('designs')).body.designs[0].name, 'Renamed');
  assert.equal((await a('designs', 'POST', {}, { name: 'bad', bm: {} })).code, 400);
});

test('password reset', async () => {
  const u = client();
  await u('auth', 'POST', { action: 'signup' }, { email: 'r@example.com', password: 'longpassword' });
  assert.equal((await u('auth', 'POST', { action: 'forgot' }, { email: 'r@example.com' })).code, 200);
  const { db } = await import('../api/_lib/db.js'); const c = await db();
  const body = (await c.execute("SELECT body FROM outbox WHERE to_addr = 'r@example.com' ORDER BY id DESC LIMIT 1")).rows[0].body;
  const tok = body.match(/#reset\/([\w-]+)/)[1];
  assert.equal((await u('auth', 'POST', { action: 'reset' }, { token: tok, password: 'newpassword1' })).code, 200);
  assert.equal((await u('auth', 'POST', { action: 'reset' }, { token: tok, password: 'again12345' })).code, 400, 'reset links work once');
  assert.equal((await client()('auth', 'POST', { action: 'login' }, { email: 'r@example.com', password: 'newpassword1' })).code, 200);
});

test.after(() => { try { rmSync(file); } catch (e) { } });
