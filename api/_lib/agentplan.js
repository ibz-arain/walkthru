// Server copy of src/agentplan.js. The Vercel function only bundles files under api/.
// =====================================================================
//  AGENT PLAN — turn the model's command lines into rooms, stairs and walls.
//  The same functions run in the browser (against the live design) and in tests.
// =====================================================================
const AGENT_TYPES = new Set(['open', 'living', 'great', 'kitchen', 'dining', 'foyer', 'hall', 'bedroom', 'primary', 'bath', 'closet', 'office', 'laundry', 'mud', 'garage', 'rec', 'theatre', 'storage', 'pantry', 'powder', 'ensuite', 'walkin', 'nursery', 'guest', 'gym', 'library', 'sunroom', 'playroom', 'bonus', 'workshop', 'wine', 'balcony', 'deck', 'porch', 'bridge']);
const AGENT_LOCK = { balcony: 'U', bridge: 'U', deck: 'M', porch: 'M' };
const AGENT_ROOF = new Set(['hip', 'gable', 'shed', 'flat']);
const AGENT_WALL = new Set(['open', 'door', 'wall']);
const AGENT_LV = { B: 'basement', M: 'main floor', U: 'second floor' };

const agentNum = (v, lo, hi) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? +v : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n * 100) / 100));
};
const agentName = v => String(v ?? '').replace(/[\r\n<>]/g, '').trim().slice(0, 60);
const agentJson = s => { try { return JSON.parse(s); } catch { return null; } };

function agentLevelOk(plan, lv) {
  if (lv === 'B' || lv === 'M' || lv === 'U') return true;
  const extra = plan?.levels?.extra;
  return Array.isArray(extra) && extra.some(e => e && e.id === lv);
}
function agentNextId(plan) {
  let n = 1;
  for (const r of plan.rooms || []) n = Math.max(n, (+r.id || 0) + 1);
  for (const s of plan.stairs || []) n = Math.max(n, (+s.id || 0) + 1);
  return n;
}
function agentRooms(plan, ref) {
  const rooms = plan.rooms || [];
  if (ref && typeof ref === 'object') ref = ref.id ?? ref.name;
  if (typeof ref === 'number' || (typeof ref === 'string' && /^\d+$/.test(ref.trim()))) {
    const id = +ref;
    const hit = rooms.find(r => r.id === id);
    return hit ? [hit] : [];
  }
  const n = agentName(ref).toLowerCase();
  if (!n) return [];
  const named = rooms.filter(r => agentName(r.name).toLowerCase() === n);
  if (named.length) return named;
  return rooms.filter(r => r.type === n);
}
function agentRoom(plan, ref) {
  const hits = agentRooms(plan, ref);
  if (hits.length === 1) return { room: hits[0] };
  if (hits.length > 1) return { choices: hits, name: agentName(ref) || String(ref) };
  return { error: `No room called "${agentName(ref) || ref}".` };
}
function roomChoice(r) {
  return { id: String(r.id), label: `${agentLabel(r)} ${r.id} · ${AGENT_LV[r.level] || r.level} · ${r.w} × ${r.d} ft` };
}
function stairChoice(s) {
  return { id: String(s.id), label: `Stair ${s.id} · ${AGENT_LV[s.level] || s.level} · at ${s.cx ?? s.x}, ${s.cz ?? s.z}` };
}
function agentStairHits(plan, ref) {
  const stairs = plan.stairs || [];
  if (ref && typeof ref === 'object') ref = ref.id ?? ref.name;
  const n = String(ref ?? '').trim();
  if (/^\d+$/.test(n)) return stairs.filter(s => String(s.id) === String(+n));
  if (/stair/i.test(n)) return stairs.slice();
  return [];
}
function roomMiss(found) {
  if (found.choices) return { kind: 'ask', text: `Which ${found.name}?`, options: found.choices.slice(0, 6).map(roomChoice) };
  if (found.error) return { kind: 'err', text: found.error };
  return null;
}
function askOptions(list) {
  return (Array.isArray(list) ? list : []).slice(0, 6).flatMap(o => {
    if (typeof o === 'string' && o.trim()) return [{ id: o.trim().slice(0, 80), label: o.trim().slice(0, 160) }];
    if (o && (o.label || o.id)) return [{ id: String(o.id ?? o.label).slice(0, 80), label: String(o.label || o.id).slice(0, 160) }];
    return [];
  });
}
const agentLabel = r => agentName(r.name) || r.type;
const agentOverlap = (a, b) => a.x < b.x + b.w - .05 && a.x + a.w > b.x + .05 && a.z < b.z + b.d - .05 && a.z + a.d > b.z + .05;
const agentSpan = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const agentInside = (r, p) => p && p.level === r.level && p.x > r.x && p.x < r.x + r.w && p.z > r.z && p.z < r.z + r.d;

// Which edge a neighbour shares, and how much of it.
function agentTouch(a, b) {
  if (!a || !b || a === b || a.level !== b.level) return null;
  const zo = agentSpan(a.z, a.z + a.d, b.z, b.z + b.d), xo = agentSpan(a.x, a.x + a.w, b.x, b.x + b.w);
  if (zo > .5 && Math.abs(a.x + a.w - b.x) < .25) return { side: 'east', along: zo, room: b };
  if (zo > .5 && Math.abs(b.x + b.w - a.x) < .25) return { side: 'west', along: zo, room: b };
  if (xo > .5 && Math.abs(a.z + a.d - b.z) < .25) return { side: 'south', along: xo, room: b };
  if (xo > .5 && Math.abs(b.z + b.d - a.z) < .25) return { side: 'north', along: xo, room: b };
  return null;
}
function agentGrew(before, after) {
  const out = [];
  const east = +((after.x + after.w) - (before.x + before.w)).toFixed(2);
  const west = +(before.x - after.x).toFixed(2);
  const south = +((after.z + after.d) - (before.z + before.d)).toFixed(2);
  const north = +(before.z - after.z).toFixed(2);
  if (east > .05) out.push({ axis: 'x', sign: 1, edge: before.x + before.w, delta: east });
  if (west > .05) out.push({ axis: 'x', sign: -1, edge: before.x, delta: west });
  if (south > .05) out.push({ axis: 'z', sign: 1, edge: before.z + before.d, delta: south });
  if (north > .05) out.push({ axis: 'z', sign: -1, edge: before.z, delta: north });
  return out;
}
// A room grown into its neighbours pushes that whole side, and the furniture in it, so nothing merges.
function agentFit(plan, room, before) {
  const after = { x: room.x, z: room.z, w: room.w, d: room.d };
  const shifts = new Map();
  for (const push of agentGrew(before, after)) {
    const dx = push.axis === 'x' ? push.sign * push.delta : 0;
    const dz = push.axis === 'z' ? push.sign * push.delta : 0;
    const moved = new Set([room.id]);
    const queue = (plan.rooms || []).filter(r => {
      if (r.level !== room.level || r.id === room.id || moved.has(r.id)) return false;
      const touch = agentTouch(before, r);
      const onEdge = touch && ((push.sign > 0 && touch.side === (push.axis === 'x' ? 'east' : 'south')) || (push.sign < 0 && touch.side === (push.axis === 'x' ? 'west' : 'north')));
      return onEdge || (agentOverlap(after, r) && !agentOverlap(before, r));
    });
    while (queue.length) {
      const r = queue.pop();
      if (!r || moved.has(r.id)) continue;
      moved.add(r.id);
      r.x = +(r.x + dx).toFixed(2); r.z = +(r.z + dz).toFixed(2);
      const prev = shifts.get(r.id) || { dx: 0, dz: 0, name: agentLabel(r) };
      shifts.set(r.id, { dx: +(prev.dx + dx).toFixed(2), dz: +(prev.dz + dz).toFixed(2), name: prev.name });
      for (const o of plan.rooms || []) if (o.level === room.level && !moved.has(o.id) && agentOverlap(r, o)) queue.push(o);
    }
  }
  let furn = 0;
  const carry = (p, xk, zk) => {
    if (!p || p.level !== room.level) return;
    for (const [id, sh] of shifts) {
      const r = (plan.rooms || []).find(q => q.id === id); if (!r) continue;
      const old = { ...r, x: +(r.x - sh.dx).toFixed(2), z: +(r.z - sh.dz).toFixed(2) };
      if (agentInside(old, { level: p.level, x: p[xk], z: p[zk] })) { p[xk] = +(p[xk] + sh.dx).toFixed(2); p[zk] = +(p[zk] + sh.dz).toFixed(2); furn++; return; }
    }
    if (!agentInside(before, { level: p.level, x: p[xk], z: p[zk] })) return;
    p[xk] = +Math.min(room.x + room.w - .5, Math.max(room.x + .5, p[xk])).toFixed(2);
    p[zk] = +Math.min(room.z + room.d - .5, Math.max(room.z + .5, p[zk])).toFixed(2);
  };
  for (const it of plan.items || []) carry(it, 'x', 'z');
  for (const s of plan.stairs || []) carry(s, 'cx', 'cz');
  return { rooms: [...shifts.values()], furn };
}

export function agentIssues(plan) {
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [], stairs = Array.isArray(plan?.stairs) ? plan.stairs : [], out = [];
  const levels = new Set(rooms.map(r => r.level));
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i], b = rooms[j];
    if (a.level !== b.level) continue;
    const overlap = a.x < b.x + b.w - .05 && a.x + a.w > b.x + .05 && a.z < b.z + b.d - .05 && a.z + a.d > b.z + .05;
    if (overlap) out.push(`${agentLabel(a)} overlaps ${agentLabel(b)} on the ${AGENT_LV[a.level] || a.level}.`);
    if (out.length >= 8) return out;
    const zo = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z), xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    let gap = 0;
    if (zo > 1) gap = a.x + a.w <= b.x ? b.x - (a.x + a.w) : b.x + b.w <= a.x ? a.x - (b.x + b.w) : 0;
    else if (xo > 1) gap = a.z + a.d <= b.z ? b.z - (a.z + a.d) : b.z + b.d <= a.z ? a.z - (b.z + b.d) : 0;
    if (gap > .2 && gap < 3) out.push(`${agentLabel(a)} and ${agentLabel(b)} have a ${gap.toFixed(1)} ft gap. Make their edges meet.`);
    if (out.length >= 8) return out;
  }
  if (levels.has('U') && !stairs.some(s => s.level === 'M')) out.push('The second floor has no stair up from the main floor.');
  if (levels.has('B') && !stairs.some(s => s.level === 'B')) out.push('The basement has no stair up to the main floor.');
  return out.slice(0, 8);
}

export function agentBrief(plan) {
  const rooms = (Array.isArray(plan?.rooms) ? plan.rooms : []).slice(0, 80);
  const stairs = (Array.isArray(plan?.stairs) ? plan.stairs : []).slice(0, 20);
  const walls = plan?.walls && typeof plan.walls === 'object' ? Object.entries(plan.walls).slice(0, 40) : [];
  const floors = Array.isArray(plan?.levels?.extra) ? plan.levels.extra.map(e => e && `${e.id} (${e.name || e.id})`).filter(Boolean) : [];
  const lines = [`roof ${AGENT_ROOF.has(plan?.roof) ? plan.roof : 'hip'}`, 'Front is the smaller z, back is the larger z. Left is the smaller x, right is the larger x. Resizing a room shifts the rooms and furniture on that side. Rooms stay separate.'];
  if (floors.length) lines.push(`extra floors: ${floors.join(', ')}`);
  lines.push(rooms.length ? 'rooms:' : 'rooms: none');
  const sideWord = { east: 'right', west: 'left', south: 'back', north: 'front' };
  for (const r of rooms) {
    const neighbours = rooms.map(o => agentTouch(r, o)).filter(Boolean).slice(0, 4)
      .map(t => `${sideWord[t.side] || t.side}: ${agentLabel(t.room)} #${t.room.id} ${t.room.w}x${t.room.d}`).join(', ');
    const pieces = (Array.isArray(plan?.items) ? plan.items : []).filter(it => agentInside(r, it)).slice(0, 6).map(it => it.name || it.kind);
    lines.push(`${r.id} ${r.type} ${r.level} "${agentName(r.name)}" ${r.x},${r.z} ${r.w}x${r.d}${neighbours ? ` | ${neighbours}` : ''}${pieces.length ? ` | furn: ${pieces.join(', ')}` : ''}`);
  }
  lines.push(stairs.length ? 'stairs (not rooms; remove one with @@del and its id):' : 'stairs: none');
  for (const s of stairs) lines.push(`${s.id} ${s.level} at ${s.cx ?? s.x},${s.cz ?? s.z} ${s.W ?? s.w}x${s.L ?? s.l}`);
  if (walls.length) lines.push('wall overrides: ' + walls.map(([k, v]) => `${k}=${v}`).join(' '));
  const issues = agentIssues(plan);
  lines.push(issues.length ? 'Issues:\n' + issues.map(i => '- ' + i).join('\n') : 'Issues: none');
  return lines.join('\n').slice(0, 8000);
}

// One complete command line. `types` is the live room-type list when the editor has one.
export function applyAgentLine(plan, line, types) {
  if (!plan.rooms) plan.rooms = [];
  if (!plan.stairs) plan.stairs = [];
  const raw = String(line ?? '').trim();
  if (!raw) return { kind: 'say', text: '' };
  if (!raw.startsWith('@@')) return { kind: 'say', text: raw };
  const sp = raw.indexOf(' ');
  const cmd = (sp < 0 ? raw.slice(2) : raw.slice(2, sp)).toLowerCase();
  const rest = sp < 0 ? '' : raw.slice(sp + 1).trim();
  const say = (kind, text, edit) => ({ kind, text, edit: !!edit });
  if (cmd === 'think') return say('think', rest);
  if (cmd === 'say') return say('say', rest);
  if (cmd === 'done') return say('done', rest);
  if (cmd === 'more') return say('more', rest);
  if (cmd === 'ask') {
    const spec = rest.startsWith('{') ? agentJson(rest) : null;
    const q = String(spec?.q || (rest.startsWith('{') ? '' : rest)).replace(/[\r\n<>]/g, '').trim().slice(0, 300);
    const options = askOptions(spec?.options);
    if (!q) return say('err', 'A question needs some text.');
    if (!options.length) return say('say', q);
    return { kind: 'ask', text: q, options };
  }
  if (cmd === 'clear') {
    plan.rooms = []; plan.stairs = []; plan.walls = {};
    return say('act', 'Cleared the rooms and started over.', true);
  }
  if (cmd === 'roof') {
    const roof = rest.replace(/["']/g, '').trim().toLowerCase();
    if (!AGENT_ROOF.has(roof)) return say('err', 'Roof must be hip, gable, shed, or flat.');
    plan.roof = roof;
    return say('act', `Set the roof to ${roof}.`, true);
  }
  const body = rest.startsWith('{') ? agentJson(rest) : null;
  if (cmd === 'add') {
    if (!body) return say('err', 'Could not read that add command.');
    const type = String(body.type || '').toLowerCase();
    const known = types ? types.has(type) : AGENT_TYPES.has(type);
    if (type === 'stairs') return say('err', 'Stairs are not a room. Use @@stair.');
    if (!known) return say('err', `Unknown room type "${type}".`);
    const level = String(body.level || 'M').toUpperCase();
    if (!agentLevelOk(plan, level)) return say('err', `Unknown floor "${level}". Use B, M, or U.`);
    if (AGENT_LOCK[type] && AGENT_LOCK[type] !== level) return say('err', `A ${type} goes on the ${AGENT_LOCK[type] === 'U' ? 'second floor (U)' : 'main floor (M)'}.`);
    const x = agentNum(body.x, -40, 300), z = agentNum(body.z, -40, 300), w = agentNum(body.w, 3, 80), d = agentNum(body.d, 3, 80);
    if (x == null || z == null || w == null || d == null) return say('err', 'A room needs x, z, w, and d in feet.');
    const name = agentName(body.name);
    const room = { id: agentNextId(plan), type, level, x, z, w, d };
    if (name) room.name = name;
    plan.rooms.push(room);
    return say('act', `Added ${name || type} on the ${AGENT_LV[level] || level}, ${w} × ${d} ft.`, true);
  }
  if ((cmd === 'set' || cmd === 'wall') && !body) return say('err', 'Could not read that command.');
  if (cmd === 'set') {
    const found = agentRoom(plan, body.id ?? body.name);
    const setMiss = roomMiss(found); if (setMiss) return setMiss;
    const r = found.room;
    const before = { x: r.x, z: r.z, w: r.w, d: r.d, level: r.level };
    if (body.type) {
      const type = String(body.type).toLowerCase();
      const known = types ? types.has(type) : AGENT_TYPES.has(type);
      if (!known || type === 'stairs') return say('err', `Unknown room type "${type}".`);
      r.type = type;
    }
    if (body.name != null && body.id != null) r.name = agentName(body.name);
    if (body.x != null) { const n = agentNum(body.x, -40, 300); if (n == null) return say('err', 'Bad x.'); r.x = n; }
    if (body.z != null) { const n = agentNum(body.z, -40, 300); if (n == null) return say('err', 'Bad z.'); r.z = n; }
    if (body.w != null) { const n = agentNum(body.w, 3, 80); if (n == null) return say('err', 'Bad width.'); r.w = n; }
    if (body.d != null) { const n = agentNum(body.d, 3, 80); if (n == null) return say('err', 'Bad depth.'); r.d = n; }
    const geom = before.x !== r.x || before.z !== r.z || before.w !== r.w || before.d !== r.d;
    const fit = geom ? agentFit(plan, r, before) : { rooms: [], furn: 0 };
    const names = [...new Set(fit.rooms.map(s => s.name))];
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
    const sized = before.w !== r.w || before.d !== r.d;
    let text = sized ? `Resized ${agentLabel(r)} to ${r.w} × ${r.d} ft.` : geom ? `Moved ${agentLabel(r)}.` : `Updated ${agentLabel(r)}.`;
    if (names.length) text += ` Shifted ${shown} so the rooms stay separate.`;
    if (fit.furn) text += ' Furniture moved with them.';
    return say('act', text, true);
  }
  if (cmd === 'del') {
    const ref = body ? (body.id ?? body.name) : rest;
    const rooms = agentRooms(plan, ref), stairs = agentStairHits(plan, ref);
    if (rooms.length > 1) return roomMiss({ choices: rooms, name: agentName(ref) || String(ref) });
    if (!rooms.length && stairs.length > 1) return { kind: 'ask', text: 'Which stair?', options: stairs.slice(0, 6).map(stairChoice) };
    if (rooms.length === 1 && !stairs.length) return removeRoom(plan, rooms[0]);
    if (!rooms.length && stairs.length === 1) return removeStair(plan, stairs[0]);
    return say('err', `Nothing called "${agentName(ref) || ref}". Rooms and stairs are listed by id.`);
  }
  if (cmd === 'wall') {
    const A = agentRoom(plan, body.a), B = agentRoom(plan, body.b);
    const wallMiss = roomMiss(A) || roomMiss(B); if (wallMiss) return wallMiss;
    if (A.room === B.room) return say('err', 'Pick two different rooms.');
    if (A.room.level !== B.room.level) return say('err', 'Those rooms are on different floors.');
    const mode = String(body.mode || '').toLowerCase();
    if (!AGENT_WALL.has(mode)) return say('err', 'A wall mode is open, door, or wall.');
    const key = A.room.id < B.room.id ? `${A.room.id}-${B.room.id}` : `${B.room.id}-${A.room.id}`;
    plan.walls = plan.walls || {};
    plan.walls[key] = mode;
    const word = mode === 'open' ? 'Opened' : mode === 'door' ? 'Put a door in' : 'Closed';
    return say('act', `${word} the wall between ${agentLabel(A.room)} and ${agentLabel(B.room)}.`, true);
  }
  if (cmd === 'stair') {
    const spec = body || {};
    if (!body && rest) return say('err', 'Could not read that stair.');
    const level = String(spec.level || 'M').toUpperCase();
    if (!agentLevelOk(plan, level) || level === 'U') return say('err', 'A stair starts on B or M.');
    const cx = agentNum(spec.cx ?? spec.x, -40, 300), cz = agentNum(spec.cz ?? spec.z, -40, 300);
    const W = agentNum(spec.w ?? spec.W ?? 3.5, 3, 8), L = agentNum(spec.l ?? spec.L ?? 12, 6, 24);
    if (cx == null || cz == null || W == null || L == null) return say('err', 'A stair needs a center cx, cz.');
    plan.stairs = plan.stairs || [];
    plan.stairs.push({ id: agentNextId(plan), level, cx, cz, W, L });
    return say('act', `Added a stair on the ${AGENT_LV[level] || level}.`, true);
  }
  return say('err', `Unknown command @@${cmd}.`);
}

function removeStair(plan, stair) {
  plan.stairs = (plan.stairs || []).filter(s => s !== stair);
  return { kind: 'act', text: `Removed the stair on the ${AGENT_LV[stair.level] || stair.level}.`, edit: true };
}
function removeRoom(plan, room) {
  plan.rooms = plan.rooms.filter(r => r !== room);
  if (plan.walls) for (const k of Object.keys(plan.walls)) if (k.split('-').includes(String(room.id))) delete plan.walls[k];
  return { kind: 'act', text: `Removed ${agentLabel(room)}.`, edit: true };
}

// Streamed lines. A command whose JSON spills onto the next line is held until it closes.
export function feedAgentLine(buf, line) {
  const t = String(line ?? '').trim().replace(/^[-*]\s+/, '');
  if (!t || t.startsWith('```')) return [];
  if (buf.hold) {
    if (t.startsWith('@@')) { buf.hold = ''; return [{ kind: 'err', text: 'A command was cut off.' }, ...feedAgentLine(buf, t)]; }
    buf.hold += t;
    if (!buf.hold.includes('}')) return [];
    const s = buf.hold; buf.hold = '';
    return [applyAgentLine(buf.plan, s, buf.types)];
  }
  if (t.startsWith('@@') && t.includes('{') && !t.includes('}')) { buf.hold = t; return []; }
  return keepAgent(applyAgentLine(buf.plan, t, buf.types));
}
export function flushAgentLine(buf) {
  if (!buf.hold) return [];
  const s = buf.hold; buf.hold = '';
  return keepAgent(applyAgentLine(buf.plan, s, buf.types));
}
function keepAgent(res) {
  if ((res.kind === 'say' || res.kind === 'think') && !res.text) return [];
  return [res];
}
