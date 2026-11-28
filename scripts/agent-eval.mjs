// Agent eval: send fixed requests to the real model and score what it builds.   npm run eval:agent -- [options]
//   --only full2,narrow   run some cases          --runs 3            repeat each case (the model varies)
//   --model NAME          set AGENT_MODEL         --backup NAME|none  set AGENT_BACKUP_MODEL
//   --drawing plan.png    add a "build this drawing" case (PNG, JPEG, WebP, GIF, or PDF)
//   --pause 6             seconds between requests, to stay under a free tier's per-minute limit
//   --start plan.json --text "…"   add a case: your request on your plan (--only custom to run just it)
// It runs the real /api/agent handler in-process with the key from .env, and the same pass loop as the chat
// (agentPass / agentNext in src/agentplan.js). Each request counts against the model's quota.
// Results print as a table and are saved to .data/agent-eval/<time>.json for comparing models and prompt changes.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);

// ---------- options and environment ----------
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const fromFile = {};
for (const name of ['.env', '.env.local']) {
  if (!existsSync(name)) continue;
  for (const line of readFileSync(name, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) fromFile[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
}
for (const [k, v] of Object.entries(fromFile)) if (!(k in process.env)) process.env[k] = v;
if (opt.model) process.env.AGENT_MODEL = opt.model;
if (opt.backup) process.env.AGENT_BACKUP_MODEL = opt.backup;
mkdirSync('.data/agent-eval', { recursive: true });
const dbFile = `.data/agent-eval/db-${process.pid}.db`; // a throwaway database, so the eval never touches your projects
process.env.TURSO_DATABASE_URL = `file:${dbFile}`; delete process.env.TURSO_AUTH_TOKEN;
process.env.AGENT_DAILY_LIMIT = '100000'; process.env.VERCEL = '1'; delete process.env.RESEND_API_KEY;

const { agentProvider } = await import('../api/_lib/ai.js');
const ai = agentProvider();
if (!ai) { console.error('No GEMINI_API_KEY or OPENROUTER_API_KEY in .env'); process.exit(1); }
const agent = (await import('../api/agent.js')).default, auth = (await import('../api/auth.js')).default;
const { agentPass, agentNext, agentApplied, agentWantsEdit, agentAsks, agentNewHouseAsk, agentWantsFix, agentIssues, agentRepairFailed, agentBadness, AGENT_PASSES } = await import('../src/agentplan.js');

// ---------- a signed-in user, like one browser ----------
let cookie = '';
async function call(handler, method, query, data) {
  const out = { code: 200, text: '', headers: {} };
  const res = {
    set statusCode(c) { out.code = c; }, get statusCode() { return out.code; },
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, getHeader(k) { return out.headers[k.toLowerCase()]; },
    status(c) { out.code = c; return res; }, json(b) { out.body = b; }, write(t) { out.text += t; }, end() { },
  };
  await handler({ method, query, body: data, headers: { cookie, host: 'eval.local', 'content-type': 'application/json', 'x-forwarded-for': '10.42.0.1' } }, res);
  const sc = out.headers['set-cookie']; if (sc) cookie = String(sc).split(';')[0];
  return out;
}
await call(auth, 'POST', { action: 'signup' }, { email: `eval-${process.pid}@example.test`, password: `eval-${Date.now()}-pass`, workspace: 'Agent eval' });
if (!cookie) { console.error('Could not create the eval user'); process.exit(1); }

// ---------- the house most edit cases start from: two clean floors and a stair ----------
const room = (id, type, level, name, x, z, w, d) => ({ id, type, level, name, x, z, w, d });
const HOUSE = () => ({
  roof: 'hip', walls: {}, items: [],
  rooms: [
    room(1, 'foyer', 'M', 'Foyer', 0, 0, 8, 10), room(2, 'hall', 'M', 'Hall', 0, 10, 8, 18), room(3, 'living', 'M', 'Living', 8, 0, 16, 16),
    room(4, 'great', 'M', 'Family', 8, 16, 16, 12), room(5, 'dining', 'M', 'Dining', 24, 0, 12, 12), room(6, 'kitchen', 'M', 'Kitchen', 24, 12, 12, 16),
    // upstairs, the hall runs front to back over the main hall, so the whole stair opening lands in it
    room(7, 'primary', 'U', 'Primary', 8, 0, 16, 14), room(8, 'ensuite', 'U', 'Ensuite', 0, 0, 8, 8), room(9, 'walkin', 'U', 'Walk-in', 8, 14, 8, 6),
    room(10, 'bedroom', 'U', 'Bed 1', 24, 0, 12, 20), room(11, 'hall', 'U', 'Upper Hall', 0, 8, 8, 20), room(12, 'bedroom', 'U', 'Bed 2', 8, 20, 14, 8),
    room(13, 'bath', 'U', 'Bath', 16, 14, 8, 6), room(14, 'bedroom', 'U', 'Bed 3', 22, 20, 14, 8),
  ],
  stairs: [{ id: 15, level: 'M', cx: 4, cz: 16, W: 3.5, L: 12 }], // in the hall, under the upper hall (opening and all)
});
const EMPTY = () => ({ roof: 'hip', rooms: [], stairs: [], walls: {}, items: [] });
const named = (plan, n) => plan.rooms.find(r => String(r.name).toLowerCase() === n.toLowerCase());
const beds = (plan, lv) => plan.rooms.filter(r => (r.type === 'bedroom' || r.type === 'primary') && (!lv || r.level === lv));
const touches = (a, b) => a && b && a.level === b.level && (
  ((Math.abs(a.x + a.w - b.x) < .25 || Math.abs(b.x + b.w - a.x) < .25) && Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z) > .5) ||
  ((Math.abs(a.z + a.d - b.z) < .25 || Math.abs(b.z + b.d - a.z) < .25) && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > .5));

// Each check returns the reasons it failed (an empty list passes). `start` is the plan before the message.
const CASES = [
  { id: 'full2', start: EMPTY, text: 'Design a two storey 4 bedroom house with a basement.',
    check: p => [
      beds(p, 'U').length < 4 && `${beds(p, 'U').length} bedrooms upstairs, wanted 4`,
      !p.rooms.some(r => r.level === 'B') && 'no basement',
      !p.stairs.some(s => s.level === 'M') && 'no stair from the main floor',
      !p.stairs.some(s => s.level === 'B') && 'no stair from the basement',
    ] },
  { id: 'bungalow', start: EMPTY, text: 'Design a one storey 3 bedroom house with an attached two car garage.',
    check: p => [
      p.rooms.some(r => r.level !== 'M') && 'rooms off the main floor',
      beds(p, 'M').length < 3 && `${beds(p, 'M').length} bedrooms, wanted 3`,
      !p.rooms.some(r => r.type === 'garage') && 'no garage',
    ] },
  { id: 'ranch', start: EMPTY, text: 'Build a 3 story home, raised ranch, with 5 beds and 3 bathrooms', // the landing page video's request
    check: p => [
      beds(p).length !== 5 && `${beds(p).length} bedrooms, wanted 5`,
      p.rooms.filter(r => ['bath', 'ensuite'].includes(r.type)).length < 3 && 'fewer than 3 bathrooms',
      ['B', 'M', 'U'].some(l => !p.rooms.some(r => r.level === l)) && 'not three floors',
      !p.stairs.some(s => s.level === 'M') && 'no stair from the main floor',
      !p.stairs.some(s => s.level === 'B') && 'no stair from the basement',
    ] },
  { id: 'narrow', start: HOUSE, text: 'Make the living room 4 feet narrower.',
    check: (p, s) => [named(p, 'Living')?.w !== named(s, 'Living').w - 4 && `living is ${named(p, 'Living')?.w} ft wide, wanted ${named(s, 'Living').w - 4}`,
      p.rooms.length !== s.rooms.length && 'room count changed'] },
  { id: 'deeper', start: HOUSE, text: 'Make the kitchen 2 feet deeper.',
    check: (p, s) => [named(p, 'Kitchen')?.d !== named(s, 'Kitchen').d + 2 && `kitchen is ${named(p, 'Kitchen')?.d} ft deep, wanted ${named(s, 'Kitchen').d + 2}`] },
  { id: 'remove', start: HOUSE, text: 'Remove the dining room.',
    check: (p, s) => [named(p, 'Dining') && 'dining is still there', p.rooms.length !== s.rooms.length - 1 && `${s.rooms.length - p.rooms.length} rooms removed, wanted 1`] },
  { id: 'add', start: HOUSE, text: 'Add a 10 by 12 foot office on the main floor, beside the family room.',
    check: p => { const o = p.rooms.find(r => r.type === 'office'); return [!o && 'no office',
      o && !((o.w === 10 && o.d === 12) || (o.w === 12 && o.d === 10)) && `office is ${o.w} × ${o.d}`,
      o && o.level !== 'M' && 'office is not on the main floor',
      o && !touches(o, named(p, 'Family')) && 'office does not touch the family room'] } },
  { id: 'question', start: HOUSE, text: 'How many bedrooms does this house have, counting the primary? Just answer.', question: true,
    check: (p, s, r) => [r.edits > 0 && 'changed the house', !/\b4\b|\bfour\b/i.test(r.said) && `answer was "${r.said.slice(0, 80)}"`] },
  { id: 'ambiguous', start: HOUSE, text: 'Remove the bedroom.',
    check: (p, s, r) => [!r.asked && 'did not ask which bedroom', p.rooms.length !== s.rooms.length && 'removed a room without asking'] },
];
// The house from a real bug report: notches, a gap, a second floor hanging past the main floor, a stair arriving in a bedroom.
const BROKEN = () => ({ roof: 'hip', walls: {}, items: [], rooms: [
  room(1, 'living', 'M', 'Living', 0, 0, 12, 16), room(2, 'kitchen', 'M', 'Kitchen', 12, 12, 16, 8), room(3, 'foyer', 'M', 'Foyer', 12, 4, 8, 8),
  room(4, 'dining', 'M', 'Dining', 20, 0, 16, 12), room(5, 'hall', 'M', 'Hall', 0, 20, 32, 4), room(6, 'powder', 'M', 'Powder', 28, 12, 8, 8),
  room(7, 'garage', 'M', 'Garage', 32, 20, 16, 20), room(8, 'primary', 'U', 'Primary', 0, 0, 16, 14), room(9, 'bedroom', 'U', 'Bed2', 16, 0, 16, 14),
  room(10, 'hall', 'U', 'UpperHall', 0, 14, 28, 6), room(11, 'bedroom', 'U', 'Bed3', 0, 20, 16, 14), room(12, 'bedroom', 'U', 'Bed4', 16, 20, 16, 14),
], stairs: [{ id: 15, level: 'M', cx: 2, cz: 22, W: 3, L: 10 }] });
// behaviour: answer what was asked, change only what was asked, never pretend
const same = (p, s) => JSON.stringify(p.rooms) === JSON.stringify(s.rooms) && JSON.stringify(p.stairs) === JSON.stringify(s.stairs);
const greenish = hex => { const m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(String(hex || '')); if (!m) return false; const [r, g, b] = m.slice(1).map(h => parseInt(h, 16)); return g > r && g > b; };
CASES.push(
  { id: 'offtopic', start: HOUSE, text: 'Whats 2 + 2', question: true,
    check: (p, s, r) => [!same(p, s) && 'changed the house', /\b4\b|four/i.test(r.said) && 'answered an off-topic question'] },
  { id: 'canbuild', start: HOUSE, text: 'can u build a house?', question: true,
    check: (p, s) => [!same(p, s) && 'changed the house for a yes/no question'] },
  { id: 'green', start: HOUSE, text: 'Make the house green.',
    check: (p, s) => [!greenish(p.finishes?.stucco) && !greenish(p.finishes?.siding) && `outside walls not green (${JSON.stringify(p.finishes || {})})`, !same(p, s) && 'changed rooms for a colour'] },
  { id: 'shaders', start: HOUSE, text: 'use diff shaders', question: true,
    check: (p, s, r) => [!same(p, s) && 'changed rooms for something it cannot do', /\b(changing|updated|switched|applied)\b.*shader/i.test(r.said) && 'pretended to change shaders'] },
  { id: 'newhouse', start: HOUSE, text: 'Build a two storey 3 bedroom house.',
    check: (p, s, r) => [!r.asked && 'did not ask before replacing the house', !same(p, s) && 'replaced the house without asking'] },
);
CASES.push({ id: 'repair', start: BROKEN, text: 'Fix the layout problems in this house.',
  check: (p, s) => [beds(p, 'U').length < 4 && `${beds(p, 'U').length} bedrooms upstairs, it had 4`] });
if (opt.drawing) {
  const file = String(opt.drawing), ext = path.extname(file).slice(1).toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' }[ext];
  if (!mime || !existsSync(file)) { console.error(`--drawing needs an existing PNG, JPEG, WebP, GIF, or PDF: ${file}`); process.exit(1); }
  const data = `data:${mime};base64,${readFileSync(file).toString('base64')}`;
  CASES.push({ id: 'drawing', start: EMPTY, text: 'Build the house from this drawing.', files: [{ name: path.basename(file), mime, data }],
    check: p => [p.rooms.length < 3 && `only ${p.rooms.length} rooms built`] });
}

// ---------- one message, with the chat's own pass loop ----------
const planFor = p => ({ ...p, rooms: p.rooms.map(r => ({ ...r })), stairs: p.stairs.map(s => ({ ...s })), checks: [] }); // what the browser sends (editor checks need the 3D builder, so none here)
async function runCase(c) {
  const plan = c.start(), start = JSON.parse(JSON.stringify(plan));
  const user = { role: 'user', text: c.text, files: c.files || [] }, reply = { role: 'assistant', raw: '', steps: [] };
  const before = new Set(agentWantsFix(c.text) ? [] : agentIssues(plan)), build = agentWantsEdit(c.text, c.files) && !agentAsks(c.text);
  const r = { passes: 0, edits: 0, errors: 0, asked: false, said: '', models: [], failure: '', ms: 0 };
  const t0 = Date.now();
  if (agentNewHouseAsk(c.text, plan, c.files)) { r.asked = true; r.said = 'asked: start over or change this house'; r.issues = []; r.misses = c.check(plan, start, r).filter(Boolean); r.pass = !r.misses.length; r.plan = plan; r.steps = []; r.raw = ''; return r; } // the chat asks this in code
  let extra = null, rechecked = false;
  while (r.passes < AGENT_PASSES) {
    r.passes++;
    const messages = [user, ...(reply.raw ? [{ role: 'assistant', text: reply.raw }] : []), ...(extra ? [{ role: 'user', text: agentApplied(reply.steps) + extra }] : [])];
    if (pause && (r.passes > 1 || results.length)) await new Promise(ok => setTimeout(ok, pause));
    const res = await call(agent, 'POST', {}, { messages, plan: planFor(plan) });
    if (res.code !== 200) {
      r.failure = `${res.code} ${res.body?.error || ''}`.trim();
      if (/allowance|busy/i.test(r.failure)) r.skipped = true; // the provider said no: not the model's fault, so not scored
      break;
    }
    r.models.push(res.headers['x-agent-model'] || '?');
    const pass = agentPass(plan);
    const note = list => { for (const x of list) { if (x.kind === 'act' || x.kind === 'say' || x.kind === 'err') reply.steps.push({ k: x.kind, t: x.text }); if (x.kind === 'say' || x.kind === 'done' || x.kind === 'ask') r.said += (x.text || '') + ' '; } };
    for (const line of res.text.split('\n')) { note(pass.line(line)); if (pass.out.ended) break; }
    note(pass.end());
    const turn = pass.out;
    r.edits += turn.edits; r.errors += turn.errors.length; if (turn.ask) r.asked = true;
    reply.raw = [reply.raw, turn.raw].filter(Boolean).join('\n').slice(-8000);
    const next = agentNext(turn, { step: r.passes, build, rechecked, acted: reply.steps.some(s => s.k === 'act'), fresh: () => agentIssues(plan).filter(i => !before.has(i)) });
    if (next.finish || next.stop) break;
    if (next.rechecked) rechecked = true;
    extra = next.extra;
  }
  r.ms = Date.now() - t0;
  if (agentRepairFailed(agentWantsFix(c.text), reply.steps.some(s => s.k === 'act'), agentBadness(start), plan)) { // as the chat does
    for (const k of Object.keys(plan)) delete plan[k]; Object.assign(plan, JSON.parse(JSON.stringify(start))); r.reverted = true;
  }
  r.issues = agentIssues(plan).filter(i => !before.has(i));
  r.misses = r.failure ? [r.failure] : [r.reverted && 'the repair made things worse, so it was undone', ...c.check(plan, start, r)].filter(Boolean);
  r.pass = !r.failure && !r.misses.length && !r.issues.length;
  r.plan = plan; r.steps = reply.steps; r.raw = reply.raw;
  return r;
}

// --start plan.json --text "…": one request of your own on your own plan (scored on plan issues only)
if (opt.start || opt.text) { const f = opt.start && JSON.parse(readFileSync(String(opt.start), 'utf8')); const bm = f?.bm || f;
  CASES.push({ id: 'custom', start: () => JSON.parse(JSON.stringify(bm || EMPTY())), text: String(opt.text || 'Fix the layout problems in this house.'), check: () => [] }); }
// ---------- run and report ----------
const only = opt.only ? String(opt.only).split(',') : null, runs = Math.max(1, +opt.runs || 1), pause = Math.max(0, +opt.pause || 0) * 1000;
const cases = CASES.filter(c => !only || only.includes(c.id));
console.log(`Agent eval · ${ai.name} ${ai.model}${ai.backup ? ` (backup ${ai.backup})` : ''} · ${cases.length} cases × ${runs}\n`);
const results = [];
running: for (const c of cases) for (let n = 1; n <= runs; n++) {
  process.stdout.write(`${c.id}${runs > 1 ? ` #${n}` : ''} … `);
  let r;
  try { r = await runCase(c); } catch (e) { r = { pass: false, misses: [`crashed: ${e.message}`], issues: [], passes: 0, edits: 0, errors: 0, models: [], ms: 0 }; }
  results.push({ id: c.id, run: n, ...r });
  const why = [...r.misses, ...r.issues.map(i => `issue: ${i}`)];
  if (r.skipped) { console.log(`SKIP  ${r.failure}\nStopping: the provider is refusing requests. Try later, or use --pause.`); break running; }
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${(r.ms / 1000).toFixed(0)}s  ${r.passes} passes  ${r.edits} edits  ${r.errors} errors  ${[...new Set(r.models)].join(', ')}`);
  for (const w of why.slice(0, 5)) console.log(`      - ${w}`);
  if (why.length > 5) console.log(`      - and ${why.length - 5} more`);
}
const scored = results.filter(r => !r.skipped), passed = scored.filter(r => r.pass).length;
const secs = results.reduce((a, r) => a + r.ms, 0) / 1000;
console.log(`\nScore: ${passed}/${scored.length} passed${results.length > scored.length ? ` (${results.length - scored.length} skipped)` : ''} · ${results.reduce((a, r) => a + r.issues.length, 0)} plan issues left · ${results.reduce((a, r) => a + r.passes, 0)} requests · ${secs.toFixed(0)}s`);
const out = `.data/agent-eval/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), provider: ai.name, model: ai.model, backup: ai.backup || null, runs, passed, total: scored.length, skipped: results.length - scored.length, results }, null, 1));
console.log(`Saved ${out}`);
for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) try { rmSync(f); } catch { /* not there */ }
process.exit(0);
