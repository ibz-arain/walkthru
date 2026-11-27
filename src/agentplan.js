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
const agentArea = (a, b) => Math.max(0, agentSpan(a.x, a.x + a.w, b.x, b.x + b.w)) * Math.max(0, agentSpan(a.z, a.z + a.d, b.z, b.z + b.d));
// A drawn outline (r.pts, in feet from the room's corner) stretches with its box, as the editor does.
function agentResize(r, w, d) {
  if (r.shape === 'poly' && Array.isArray(r.pts) && r.w > 0 && r.d > 0) r.pts = r.pts.map(([u, v]) => [+(u * w / r.w).toFixed(2), +(v * d / r.d).toFixed(2)]);
  r.w = +w.toFixed(2); r.d = +d.toFixed(2);
}
// The edges of a room that moved: delta > 0 grew outward, < 0 came in.
function agentEdges(before, after) {
  const e = (axis, sign, edge, delta) => ({ axis, sign, edge, delta: +delta.toFixed(2) });
  return [
    e('x', 1, before.x + before.w, (after.x + after.w) - (before.x + before.w)),
    e('x', -1, before.x, before.x - after.x),
    e('z', 1, before.z + before.d, (after.z + after.d) - (before.z + before.d)),
    e('z', -1, before.z, before.z - after.z),
  ].filter(m => Math.abs(m.delta) > .05);
}
const EDGE_SIDE = { x1: 'east', 'x-1': 'west', z1: 'south', 'z-1': 'north' };
// A resized room keeps the plan whole. Growing pushes the rooms on that side out; shrinking pulls them in when they can
// follow without hitting anything. Rooms above and below the ones that moved shift or stretch the same way, so floors stay lined up.
function agentFit(plan, room, before) {
  const after = { x: room.x, z: room.z, w: room.w, d: room.d };
  const rooms = plan.rooms || [];
  const shifts = new Map(), lined = new Map(), gaps = [];
  const shift = (r, dx, dz) => {
    const prev = shifts.get(r.id) || { dx: 0, dz: 0, name: agentLabel(r), level: r.level, old: { level: r.level, x: r.x, z: r.z, w: r.w, d: r.d } };
    r.x = +(r.x + dx).toFixed(2); r.z = +(r.z + dz).toFixed(2);
    shifts.set(r.id, { ...prev, dx: +(prev.dx + dx).toFixed(2), dz: +(prev.dz + dz).toFixed(2) });
  };
  for (const m of agentEdges(before, after)) {
    const amount = m.sign * m.delta, dx = m.axis === 'x' ? amount : 0, dz = m.axis === 'z' ? amount : 0, side = EDGE_SIDE[m.axis + m.sign];
    const same = rooms.filter(r => r.level === room.level && r.id !== room.id);
    const group = new Set(), olds = new Map();
    const take = r => { if (group.has(r.id)) return false; group.add(r.id); olds.set(r.id, { x: r.x, z: r.z, w: r.w, d: r.d }); return true; };
    if (m.delta > 0) {
      const queue = same.filter(r => agentTouch(before, r)?.side === side || (agentOverlap(after, r) && !agentOverlap(before, r)));
      while (queue.length) {
        const r = queue.pop(); if (!take(r)) continue;
        r.x = +(r.x + dx).toFixed(2); r.z = +(r.z + dz).toFixed(2);
        for (const o of same) if (!group.has(o.id) && agentOverlap(r, o)) queue.push(o);
      }
    } else {
      const queue = same.filter(r => agentTouch(before, r)?.side === side);
      while (queue.length) {
        const r = queue.pop(); if (!take(r)) continue;
        for (const o of same) if (!group.has(o.id) && agentTouch(r, o)?.side === side) queue.push(o);
      }
      for (const id of group) { const r = rooms.find(q => q.id === id); r.x = +(r.x + dx).toFixed(2); r.z = +(r.z + dz).toFixed(2); }
      const blocked = [...group].some(id => { const r = rooms.find(q => q.id === id); return [room, ...same].some(o => !group.has(o.id) && agentOverlap(r, o)); });
      if (blocked) { // something is in the way: leave them, and say there is a gap to fix
        for (const id of group) { const r = rooms.find(q => q.id === id), o = olds.get(id); r.x = o.x; r.z = o.z; }
        gaps.push(...[...group].map(id => agentLabel(rooms.find(q => q.id === id))).slice(0, 2));
        group.clear();
      }
    }
    for (const id of group) { // record the move once, from where the room was before this edge
      const r = rooms.find(q => q.id === id), o = olds.get(id);
      const prev = shifts.get(id) || { dx: 0, dz: 0, name: agentLabel(r), level: r.level, old: { level: r.level, ...o } };
      shifts.set(id, { ...prev, dx: +(prev.dx + dx).toFixed(2), dz: +(prev.dz + dz).toFixed(2) });
    }
    if (!group.size) continue;
    // Other floors: rooms over (or under) the ones that moved follow the edge.
    const moved = [...group].map(id => olds.get(id));
    const perp = (a, b) => m.axis === 'x' ? agentSpan(a.z, a.z + a.d, b.z, b.z + b.d) : agentSpan(a.x, a.x + a.w, b.x, b.x + b.w);
    for (const o of rooms) {
      if (o.level === room.level || !moved.some(r => perp(r, o) > .5)) continue;
      const lo = m.axis === 'x' ? o.x : o.z, hi = lo + (m.axis === 'x' ? o.w : o.d), E = m.edge;
      const beyond = m.sign > 0 ? lo >= E - .05 : hi <= E + .05, across = !beyond && (m.sign > 0 ? hi >= E - .05 : lo <= E + .05); // a room ending on the edge stretches with it, like the one below
      if (beyond) shift(o, dx, dz);
      else if (across) { // it spans the edge: stretch it (or shrink it) by the same amount
        const size = (m.axis === 'x' ? o.w : o.d) + m.delta;
        if (size < 3) continue;
        if (m.sign < 0) { if (m.axis === 'x') o.x = +(o.x + amount).toFixed(2); else o.z = +(o.z + amount).toFixed(2); }
        agentResize(o, m.axis === 'x' ? size : o.w, m.axis === 'z' ? size : o.d);
      } else continue;
      lined.set(o.id, agentLabel(o));
    }
  }
  let furn = 0;
  const carry = (p, xk, zk) => {
    if (!p) return;
    for (const [, sh] of shifts) {
      if (sh.level !== p.level || !agentInside(sh.old, { level: p.level, x: p[xk], z: p[zk] })) continue;
      p[xk] = +(p[xk] + sh.dx).toFixed(2); p[zk] = +(p[zk] + sh.dz).toFixed(2); furn++; return;
    }
    if (p.level !== room.level || !agentInside(before, { level: p.level, x: p[xk], z: p[zk] })) return;
    p[xk] = +Math.min(room.x + room.w - .5, Math.max(room.x + .5, p[xk])).toFixed(2);
    p[zk] = +Math.min(room.z + room.d - .5, Math.max(room.z + .5, p[zk])).toFixed(2);
  };
  for (const it of plan.items || []) carry(it, 'x', 'z');
  for (const s of plan.stairs || []) carry(s, 'cx', 'cz');
  const here = [...shifts.values()].filter(s => s.level === room.level);
  return { rooms: here, lined: [...lined.values()], gaps: [...new Set(gaps)], furn };
}

// How a floor reads as a house: upper rooms need a floor under them, a floor should not be one long strip, and every room
// should touch another. Porches, decks and balconies sit outside the walls, so they are left out.
const AGENT_OUTSIDE = new Set(['porch', 'deck', 'balcony', 'bridge']);
const AGENT_LANDING = new Set(['hall', 'foyer', 'open', 'great', 'living', 'rec', 'mud']); // where a stair may start and arrive
const ft = n => String(+n.toFixed(1));
const agentAt = (rooms, lv, x, z) => rooms.find(r => r.level === lv && x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d);
const agentUp = lv => ({ B: 'M', M: 'U' })[lv];

// ---------- stairs: placed by code, where the flight starts and arrives in a hall or open room ----------
const stairXY = s => [+(s.cx ?? s.x), +(s.cz ?? s.z)];
const agentInsideRooms = plan => (plan.rooms || []).filter(r => !AGENT_OUTSIDE.has(r.type));
// The whole flight stands in rooms a stair may be in (one room, or open rooms that join), one way round or the other:
// every corner of its W × L box, a few inches in, lands in such a room. Otherwise it runs through a wall or into the ground.
function flightFits(inside, s) {
  const [cx, cz] = stairXY(s), W = s.W ?? 3.5, L = s.L ?? 12, ok = (x, z) => { const r = agentAt(inside, s.level, x, z); return !!r && AGENT_LANDING.has(r.type); };
  return [[L, W], [W, L]].some(([a, b]) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([i, j]) => ok(cx + i * (a / 2 - .3), cz + j * (b / 2 - .3))));
}
// The stair starts in a hall or open room, and (when the floor above has rooms) comes up in one.
export function agentStairOk(plan, s) {
  const inside = agentInsideRooms(plan), [cx, cz] = stairXY(s), up = agentUp(s.level);
  const here = agentAt(inside, s.level, cx, cz);
  if (!here || !AGENT_LANDING.has(here.type)) return false;
  if (!flightFits(inside, s)) return false; // the flight pokes out through a wall, or into the ground
  if (!up || !inside.some(r => r.level === up)) return true;
  const above = agentAt(inside, up, cx, cz);
  return !!above && AGENT_LANDING.has(above.type);
}
// The best centre for a W × L flight on `level`: inside a hall or open room there, under a hall or open room on the floor
// above, with 2 ft to step on at its foot, clear of other stairs, and nearest to (nx, nz). Null when there is no such place.
export function agentStairSpot(plan, level, W, L, nx, nz, skip) {
  const inside = agentInsideRooms(plan), up = agentUp(level);
  const lows = inside.filter(r => r.level === level && AGENT_LANDING.has(r.type));
  const highs = up && inside.some(r => r.level === up) ? inside.filter(r => r.level === up && AGENT_LANDING.has(r.type)) : null;
  const others = (plan.stairs || []).filter(o => o !== skip && o.level === level);
  // a basement flight goes straight under the main stair when the room below has space for it (one stairwell, as in real houses)
  if (level === 'B') for (const m of (plan.stairs || []).filter(o => o !== skip && o.level === 'M')) {
    const [mx, mz] = stairXY(m), low = agentAt(inside, 'B', mx, mz);
    if (low && AGENT_LANDING.has(low.type) && (low.w >= L + 2 && low.d >= W || low.d >= L + 2 && low.w >= W) && !stairClash(plan, { level, cx: mx, cz: mz, W, L }, skip))
      return { cx: mx, cz: mz, dist: 0, low, high: agentAt(inside, 'M', mx, mz) || null, stacked: m };
  }
  let best = null;
  for (const low of lows) for (const high of highs || [low]) {
    const x0 = Math.max(low.x, high.x), x1 = Math.min(low.x + low.w, high.x + high.w), z0 = Math.max(low.z, high.z), z1 = Math.min(low.z + low.d, high.z + high.d);
    const w = x1 - x0, d = z1 - z0; if (w <= 0 || d <= 0) continue;
    const alongX = w >= L && d >= W && low.w >= L + 2, alongZ = d >= L && w >= W && low.d >= L + 2;
    if (!alongX && !alongZ) continue;
    const cx = +((x0 + x1) / 2).toFixed(2), cz = +((z0 + z1) / 2).toFixed(2);
    if (others.some(o => { const [ox, oz] = stairXY(o); return Math.abs(ox - cx) < (W + (o.W ?? 3.5)) / 2 + .5 && Math.abs(oz - cz) < (L + (o.L ?? 12)) / 2; })) continue;
    if (stairClash(plan, { level, cx, cz, W, L }, skip)) continue;
    const dist = Math.hypot(cx - nx, cz - nz);
    if (!best || dist < best.dist) best = { cx, cz, dist, low, high: highs ? high : null };
  }
  return best;
}
// Two flights on neighbouring floors share a floor: the lower one's opening is cut into it, and the upper one stands on it.
// They may stack (centres within 3 ft: the builder runs them as one stairwell), but must not otherwise overlap there.
// Which way a flight runs is the builder's choice, so each counts as an L × L square around its centre.
function stairClash(plan, s, skip) {
  const [cx, cz] = stairXY(s), L = s.L ?? 12;
  return (plan.stairs || []).filter(o => o !== skip && o !== s && (agentUp(o.level) === s.level || agentUp(s.level) === o.level)).find(o => {
    const [ox, oz] = stairXY(o), reach = (L + (o.L ?? 12)) / 2 + 1;
    return Math.hypot(ox - cx, oz - cz) >= 3 && Math.abs(ox - cx) < reach && Math.abs(oz - cz) < reach;
  }) || null;
}
const spotWords = (spot, level) => spot.stacked ? `under stair ${spot.stacked.id}, as one stairwell` : spot.high ? `in ${agentLabel(spot.low)}, under ${agentLabel(spot.high)} on the ${AGENT_LV[agentUp(level)] || agentUp(level)}` : `in ${agentLabel(spot.low)}`;
// After a pass: a stair stacked on another goes, and a stair that would come up through the roof or into a bedroom moves
// to the nearest place that works. Returns what changed, as results the chat can show.
export function agentFixStairs(plan) {
  const out = [], stairs = plan.stairs || [];
  for (const s of [...stairs].sort((a, b) => (+b.id || 0) - (+a.id || 0))) { // the newest of a stacked pair goes
    const [cx, cz] = stairXY(s);
    const twin = stairs.find(o => o !== s && o.level === s.level && (+o.id || 0) < (+s.id || 0) && Math.hypot(stairXY(o)[0] - cx, stairXY(o)[1] - cz) < 4);
    if (twin) { plan.stairs = plan.stairs.filter(o => o !== s); out.push({ kind: 'act', text: `Removed stair ${s.id}: stair ${twin.id} is already there.`, edit: true }); }
  }
  for (const s of [...(plan.stairs || [])].sort((a, b) => (a.level === 'B' ? 0 : 1) - (b.level === 'B' ? 0 : 1))) { // the basement flight gives way to the main one
    if (agentStairOk(plan, s) && !stairClash(plan, s)) continue;
    const [cx, cz] = stairXY(s), spot = agentStairSpot(plan, s.level, s.W ?? 3.5, s.L ?? 12, cx, cz, s);
    if (!spot) continue; // nowhere better: the issue list says what is wrong
    s.cx = spot.cx; s.cz = spot.cz; delete s.x; delete s.z;
    out.push({ kind: 'act', text: `Moved stair ${s.id} ${spotWords(spot, s.level)}, so it reaches the next floor.`, edit: true });
  }
  return out;
}

// Empty space on one floor, found on a half-foot grid: a slot between two rooms is a gap, an enclosed space is a hole,
// and a small bite out of the outline is a notch. A long step in the outline (beside a garage, say) is left alone.
function agentEmpty(on, where) {
  const S = 2, out = [];
  const x0 = Math.floor(Math.min(...on.map(r => r.x))), x1 = Math.ceil(Math.max(...on.map(r => r.x + r.w)));
  const z0 = Math.floor(Math.min(...on.map(r => r.z))), z1 = Math.ceil(Math.max(...on.map(r => r.z + r.d)));
  const W = (x1 - x0) * S, D = (z1 - z0) * S;
  if (!(W > 0 && D > 0) || W * D > 250_000) return out;
  const full = new Uint8Array(W * D);
  for (const r of on) {
    const i0 = Math.max(0, Math.round((r.x - x0) * S)), i1 = Math.min(W, Math.round((r.x + r.w - x0) * S));
    const j0 = Math.max(0, Math.round((r.z - z0) * S)), j1 = Math.min(D, Math.round((r.z + r.d - z0) * S));
    for (let j = j0; j < j1; j++) full.fill(1, j * W + i0, j * W + i1);
  }
  const span = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  for (let start = 0; start < full.length; start++) {
    if (full[start]) continue;
    let n = 0, edge = false, ci0 = W, ci1 = 0, cj0 = D, cj1 = 0;
    const stack = [start]; full[start] = 2;
    while (stack.length) {
      const c = stack.pop(), i = c % W, j = (c - i) / W; n++;
      if (i < ci0) ci0 = i; if (i > ci1) ci1 = i; if (j < cj0) cj0 = j; if (j > cj1) cj1 = j;
      if (i === 0 || j === 0 || i === W - 1 || j === D - 1) edge = true;
      for (const k of [i > 0 && c - 1, i < W - 1 && c + 1, j > 0 && c - W, j < D - 1 && c + W]) if (k !== false && !full[k]) { full[k] = 2; stack.push(k); }
    }
    const area = n / (S * S); if (area < 1) continue;
    const rx0 = x0 + ci0 / S, rx1 = x0 + (ci1 + 1) / S, rz0 = z0 + cj0 / S, rz1 = z0 + (cj1 + 1) / S, w = rx1 - rx0, d = rz1 - rz0;
    const at = `(x ${ft(rx0)}–${ft(rx1)}, z ${ft(rz0)}–${ft(rz1)})`;
    const left = on.find(r => Math.abs(r.x + r.w - rx0) < .3 && span(r.z, r.z + r.d, rz0, rz1) > .4), right = on.find(r => Math.abs(r.x - rx1) < .3 && span(r.z, r.z + r.d, rz0, rz1) > .4);
    const front = on.find(r => Math.abs(r.z + r.d - rz0) < .3 && span(r.x, r.x + r.w, rx0, rx1) > .4), back = on.find(r => Math.abs(r.z - rz1) < .3 && span(r.x, r.x + r.w, rx0, rx1) > .4);
    if (w <= 6 && left && right) out.push(`${agentLabel(left)} and ${agentLabel(right)} have a ${w.toFixed(1)} ft gap on the ${where} ${at}. Make their edges meet.`);
    else if (d <= 6 && front && back) out.push(`${agentLabel(front)} and ${agentLabel(back)} have a ${d.toFixed(1)} ft gap on the ${where} ${at}. Make their edges meet.`);
    else if (!edge) out.push(`There is an empty ${ft(w)} × ${ft(d)} ft space inside the ${where} ${at}. Grow a neighbour into it, or add a room there.`);
    else if (area <= 72 && ((left && right) || (front && back) ? Math.min(w, d) <= 8 : Math.min(w, d) <= 3)) { // a recess between rooms, or a thin sliver at a corner (a wider corner step is just the outline)
      const by = [...new Set([left, right, front, back].filter(Boolean).map(agentLabel))].slice(0, 2);
      out.push(`The ${where} outline has a ${ft(w)} × ${ft(d)} ft notch ${at}${by.length ? ` next to ${by.join(' and ')}` : ''}. Grow a neighbour into it so the outside walls run straight.`);
    }
  }
  return out;
}

// How each floor reads as a house: no empty space, upper rooms over the floor below, no long strips, no loose rooms,
// and stairs that start and arrive in a hall or open room.
function agentLayout(rooms, stairs) {
  const out = [], inside = rooms.filter(r => !AGENT_OUTSIDE.has(r.type)), main = inside.filter(r => r.level === 'M');
  for (const lv of new Set(inside.map(r => r.level))) {
    const on = inside.filter(r => r.level === lv), where = AGENT_LV[lv] || lv;
    if (on.length >= 2) out.push(...agentEmpty(rooms.filter(r => r.level === lv), where)); // a porch or deck may fill a notch
    const body = on.filter(r => r.type !== 'garage'); // an attached garage makes a long house, not a strip
    if (body.length >= 2) {
      const x0 = Math.min(...body.map(r => r.x)), x1 = Math.max(...body.map(r => r.x + r.w)), z0 = Math.min(...body.map(r => r.z)), z1 = Math.max(...body.map(r => r.z + r.d));
      const long = Math.max(x1 - x0, z1 - z0), short = Math.min(x1 - x0, z1 - z0);
      if (long > 60 && long > 2.5 * short) out.push(`The ${where} is a ${Math.round(x1 - x0)} × ${Math.round(z1 - z0)} ft strip. Arrange its rooms in two or three rows instead.`);
    }
    if (on.length >= 2) for (const r of on) if (!on.some(o => agentTouch(r, o)) && !on.some(o => o !== r && agentOverlap(r, o))) out.push(`${agentLabel(r)} on the ${where} touches no other room.`);
  }
  if (main.length) for (const r of inside.filter(q => q.level === 'U')) { // the second floor stands on the main floor (a garage counts)
    const loose = r.w * r.d - main.reduce((a, m) => a + agentArea(r, m), 0);
    if (loose > Math.max(4, .05 * r.w * r.d)) out.push(`${agentLabel(r)} on the second floor has ${Math.round(loose)} sq ft over nothing. Keep it over main-floor rooms, or grow the main floor under it.`);
  }
  for (const s of stairs) {
    const cx = +(s.cx ?? s.x), cz = +(s.cz ?? s.z), where = AGENT_LV[s.level] || s.level, up = agentUp(s.level);
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
    const here = agentAt(inside, s.level, cx, cz), W = s.W ?? 3.5, L = s.L ?? 12;
    if (!here) out.push(`Stair ${s.id} on the ${where} is not inside a room. Put it in a hall or foyer.`);
    else if (!AGENT_LANDING.has(here.type)) out.push(`Stair ${s.id} starts inside ${agentLabel(here)}. Put it in a hall or foyer.`);
    else if (!flightFits(inside, s)) out.push(`Stair ${s.id} does not fit inside ${agentLabel(here)}: its ${W} × ${L} ft flight runs out through the walls${s.level === 'B' ? ' into the ground' : ''}. Move it, or make the room bigger.`);
    const clash = stairClash({ stairs }, s);
    if (clash && (+clash.id || 0) > (+s.id || 0)) out.push(`Stairs ${s.id} and ${clash.id} run into each other: one comes up through the floor where the other stands. Stack the lower flight under the upper one, or move one.`);
    if (!up || !inside.some(r => r.level === up)) continue;
    const above = agentAt(inside, up, cx, cz), there = AGENT_LV[up] || up;
    if (!above) out.push(`Stair ${s.id} comes up into empty space on the ${there}. Put a hall over it.`);
    else if (!AGENT_LANDING.has(above.type)) out.push(`Stair ${s.id} comes up inside ${agentLabel(above)} on the ${there}. Put a hall over it.`);
  }
  return out;
}

// The first `limit` problems in the plan (Infinity to count them all).
export function agentIssues(plan, limit = 10) {
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [], stairs = Array.isArray(plan?.stairs) ? plan.stairs : [], out = [];
  const levels = new Set(rooms.map(r => r.level));
  const most = limit === Infinity ? Infinity : Math.min(5, limit);
  for (let i = 0; i < rooms.length && out.length < most; i++) for (let j = i + 1; j < rooms.length && out.length < most; j++) {
    const a = rooms[i], b = rooms[j];
    if (a.level === b.level && agentOverlap(a, b)) out.push(`${agentLabel(a)} overlaps ${agentLabel(b)} on the ${AGENT_LV[a.level] || a.level}.`);
  }
  out.push(...agentLayout(rooms, stairs));
  if (levels.has('U') && !stairs.some(s => s.level === 'M')) out.push('The second floor has no stair up from the main floor.');
  if (levels.has('B') && !stairs.some(s => s.level === 'B')) out.push('The basement has no stair up to the main floor.');
  return out.slice(0, limit);
}

// `checks` are the editor's own warnings (stairs that land outside, rooms on the wrong floor), sent with the plan by the browser.
export function agentBrief(plan, checks) {
  const rooms = (Array.isArray(plan?.rooms) ? plan.rooms : []).slice(0, 80);
  const stairs = (Array.isArray(plan?.stairs) ? plan.stairs : []).slice(0, 20);
  const walls = plan?.walls && typeof plan.walls === 'object' ? Object.entries(plan.walls).slice(0, 40) : [];
  const floors = Array.isArray(plan?.levels?.extra) ? plan.levels.extra.map(e => e && `${e.id} (${e.name || e.id})`).filter(Boolean) : [];
  const lines = [`roof ${AGENT_ROOF.has(plan?.roof) ? plan.roof : 'hip'}`, 'Front is the smaller z, back is the larger z. Left is the smaller x, right is the larger x. Growing a room pushes the rooms on that side out, shrinking pulls them in, and the floors above and below follow. Rooms stay separate.'];
  if (floors.length) lines.push(`extra floors: ${floors.join(', ')}`);
  lines.push(rooms.length ? 'rooms:' : 'rooms: none');
  const sideWord = { east: 'right', west: 'left', south: 'back', north: 'front' };
  for (const r of rooms) {
    const neighbours = rooms.map(o => agentTouch(r, o)).filter(Boolean).slice(0, 4)
      .map(t => `${sideWord[t.side] || t.side}: ${agentLabel(t.room)} #${t.room.id} ${t.room.w}x${t.room.d}`).join(', ');
    const pieces = (Array.isArray(plan?.items) ? plan.items : []).filter(it => agentInside(r, it)).slice(0, 6).map(it => it.name || it.kind);
    const shape = r.shape && r.shape !== 'rect' ? ` ${r.shape === 'tri' ? 'triangle' : r.shape === 'round' ? 'round' : 'drawn outline'} in its box` : '';
    lines.push(`${r.id} ${r.type} ${r.level} "${agentName(r.name)}" ${r.x},${r.z} ${r.w}x${r.d}${shape}${neighbours ? ` | ${neighbours}` : ''}${pieces.length ? ` | furn: ${pieces.join(', ')}` : ''}`);
  }
  lines.push(stairs.length ? 'stairs (not rooms; remove one with @@del and its id):' : 'stairs: none');
  for (const s of stairs) lines.push(`${s.id} ${s.level} at ${s.cx ?? s.x},${s.cz ?? s.z} ${s.W ?? s.w}x${s.L ?? s.l}`);
  if (walls.length) lines.push('wall overrides: ' + walls.map(([k, v]) => `${k}=${v}`).join(' '));
  const seen = (Array.isArray(checks) ? checks : []).map(c => String(c ?? '').replace(/[\r\n<>]/g, ' ').trim().slice(0, 200)).filter(Boolean);
  const issues = [...new Set([...agentIssues(plan), ...seen])].slice(0, 12);
  lines.push(issues.length ? 'Issues:\n' + issues.map(i => '- ' + i).join('\n') : 'Issues: none');
  return lines.join('\n').slice(0, 8000);
}

// One complete command line. `types` is the live room-type list when the editor has one.
export function applyAgentLine(plan, line, types) {
  if (!plan.rooms) plan.rooms = [];
  if (!plan.stairs) plan.stairs = [];
  const raw = String(line ?? '').trim();
  if (!raw) return { kind: 'say', text: '' };
  if (/^\{.*\}$/.test(raw)) return { kind: 'err', text: 'That line was a command without its @@ name.' }; // bare JSON is never meant for the user
  if (!raw.startsWith('@@')) return { kind: 'say', text: raw };
  const sp = raw.indexOf(' ');
  const cmd = (sp < 0 ? raw.slice(2) : raw.slice(2, sp)).toLowerCase().replace(/[^a-z]+$/, ''); // "@@think," is still @@think
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
  if (cmd === 'clear') { // a fresh house: nothing tied to the old rooms may land on the new ones (ids start over)
    plan.rooms = []; plan.stairs = []; plan.walls = {}; plan.items = [];
    for (const k of ROOM_KEYED) if (plan[k]) plan[k] = {};
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
    const where = AGENT_LV[level] || level;
    const twin = name && plan.rooms.find(o => o.level === level && agentName(o.name).toLowerCase() === name.toLowerCase());
    if (twin) return say('err', `${name} is already on the ${where} (#${twin.id}). Change it with @@set {"id":${twin.id}}, or give the new room another name.`);
    const clash = plan.rooms.find(o => o.level === level && agentArea(o, { x, z, w, d }) > .5 * Math.min(o.w * o.d, w * d));
    if (clash) return say('err', `${agentLabel(clash)} (#${clash.id}) is already there on the ${where}. Change it with @@set {"id":${clash.id}}, or @@del it first.`);
    const room = { id: agentNextId(plan), type, level, x, z, w, d };
    if (name) room.name = name;
    plan.rooms.push(room);
    return say('act', `Added ${name || type} on the ${AGENT_LV[level] || level}, ${w} × ${d} ft.`, true);
  }
  if ((cmd === 'set' || cmd === 'wall') && !body) return say('err', 'Could not read that command.');
  if (cmd === 'set') {
    const stair = body.id != null && !body.name ? (plan.stairs || []).find(q => String(q.id) === String(body.id)) : null;
    if (stair) return setStair(plan, stair, body);
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
    let w = r.w, d = r.d;
    if (body.w != null) { const n = agentNum(body.w, 3, 80); if (n == null) return say('err', 'Bad width.'); w = n; }
    if (body.d != null) { const n = agentNum(body.d, 3, 80); if (n == null) return say('err', 'Bad depth.'); d = n; }
    agentResize(r, w, d);
    const geom = before.x !== r.x || before.z !== r.z || before.w !== r.w || before.d !== r.d;
    const sized = before.w !== r.w || before.d !== r.d;
    const fit = sized ? agentFit(plan, r, before) : { rooms: [], lined: [], gaps: [], furn: 0 }; // a move places only that room; a resize keeps the plan together
    if (geom && !sized) { // its furniture and stairs go with it
      const dx = r.x - before.x, dz = r.z - before.z;
      for (const [p, xk, zk] of [...(plan.items || []).map(it => [it, 'x', 'z']), ...(plan.stairs || []).map(st => [st, 'cx', 'cz'])])
        if (agentInside(before, { level: p.level, x: p[xk], z: p[zk] })) { p[xk] = +(p[xk] + dx).toFixed(2); p[zk] = +(p[zk] + dz).toFixed(2); fit.furn++; }
    }
    const names = [...new Set(fit.rooms.map(s => s.name))];
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
    let text = sized ? `Resized ${agentLabel(r)} to ${r.w} × ${r.d} ft.` : geom ? `Moved ${agentLabel(r)}.` : `Updated ${agentLabel(r)}.`;
    if (names.length) text += ` Shifted ${shown} to keep the rooms together.`;
    if (fit.lined.length) text += ` Lined up ${fit.lined.slice(0, 3).join(', ')}${fit.lined.length > 3 ? ` and ${fit.lined.length - 3} more` : ''} on the other floor.`;
    if (fit.gaps.length) text += ` ${fit.gaps.join(' and ')} could not move in, so there is a gap to fix.`;
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
    const stair = { id: agentNextId(plan), level, cx, cz, W, L };
    if (agentStairOk(plan, stair) && !stairClash(plan, stair)) { plan.stairs.push(stair); return say('act', `Added a stair on the ${AGENT_LV[level] || level}.`, true); }
    const spot = agentStairSpot(plan, level, W, L, cx, cz); // the spot asked for does not work: use the nearest one that does
    if (!spot) {
      const up = AGENT_LV[agentUp(level)] || 'floor above';
      return say('err', `No place fits a ${W} × ${L} ft stair on the ${AGENT_LV[level] || level}: it needs a hall or foyer there with a hall over it on the ${up}, overlapping at least ${W} × ${L} ft. Make that space, then add the stair.`);
    }
    stair.cx = spot.cx; stair.cz = spot.cz; plan.stairs.push(stair);
    return say('act', `Added a stair ${spotWords(spot, level)}, so it reaches the next floor.`, true);
  }
  return say('err', `Unknown command @@${cmd}.`);
}

function setStair(plan, stair, body) {
  const num = (k, lo, hi) => body[k] == null ? undefined : agentNum(body[k], lo, hi);
  const cx = num('cx', -40, 300) ?? num('x', -40, 300), cz = num('cz', -40, 300) ?? num('z', -40, 300), W = num('w', 3, 8), L = num('l', 6, 24);
  if ([cx, cz, W, L].some(v => v === null)) return { kind: 'err', text: 'A stair takes cx, cz, w, and l in feet.' };
  if (cx === undefined && cz === undefined && W === undefined && L === undefined) return { kind: 'err', text: 'Give the stair a new cx, cz, w, or l.' };
  if (cx !== undefined) stair.cx = cx; if (cz !== undefined) stair.cz = cz; if (W !== undefined) stair.W = W; if (L !== undefined) stair.L = L;
  return { kind: 'act', text: `Moved the stair on the ${AGENT_LV[stair.level] || stair.level}.`, edit: true };
}
function removeStair(plan, stair) {
  plan.stairs = (plan.stairs || []).filter(s => s !== stair);
  return { kind: 'act', text: `Removed the stair on the ${AGENT_LV[stair.level] || stair.level}.`, edit: true };
}
// Settings stored per room id: walls "a-b", outside walls and openings "id:side" or "a-b", railings "id:side:at" / "id:*".
const ROOM_KEYED = ['walls', 'ext', 'ops', 'rails'];
const keyHasRoom = (key, id) => String(key).split(':')[0].split('-').includes(String(id));
function removeRoom(plan, room) {
  plan.rooms = plan.rooms.filter(r => r !== room);
  for (const k of ROOM_KEYED) if (plan[k]) for (const key of Object.keys(plan[k])) if (keyHasRoom(key, room.id)) delete plan[k][key];
  if (Array.isArray(plan.items)) plan.items = plan.items.filter(it => !agentInside(room, it)); // its placed furniture goes with it
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

// ---------- one message: the passes the chat runs (shared with scripts/agent-eval.mjs so both behave the same) ----------
export const AGENT_PASSES = 5, AGENT_PASS_EDITS = 14;
// A request to repair the plan: then every problem counts, not only the ones this message made.
export const agentWantsFix = text => /\b(fix|align|line up|overlap|gap|hole|notch|tidy|clean ?up|repair|straighten|sort out)/i.test(String(text || ''));
export const agentWantsEdit = (text, files) => !!files?.length || /\b(build|add|design|draw|make|create|widen|narrow|remove|delete|move|resize|change|replace|start over|floor plan)\b/i.test(String(text || ''));
// Reads one streamed reply line by line. A pass ends at its first @@more, @@done or @@ask (anything after is ignored),
// or after AGENT_PASS_EDITS changes, so the next pass reads the plan and its issues. Each call returns the results to show.
export function agentPass(plan, types) {
  const buf = { plan, types, hold: '' };
  const out = { done: false, more: false, ask: false, edited: false, ended: false, edits: 0, errors: [], raw: '' };
  const take = list => {
    const shown = [];
    for (const res of list) {
      if (out.ended) break;
      shown.push(res);
      if (res.kind === 'ask') out.ask = out.done = true;
      if (res.kind === 'done') out.done = true;
      if (res.kind === 'more') out.more = true;
      if (res.kind === 'ask' || res.kind === 'done' || res.kind === 'more') out.ended = true;
      if (res.kind === 'err') out.errors.push(res.text);
      if (res.edit) { out.edited = true; out.edits++; }
      if (out.edits >= AGENT_PASS_EDITS && !out.ended) out.ended = out.more = true;
    }
    return shown;
  };
  const settle = () => { const fixed = out.edited ? agentFixStairs(plan) : []; if (fixed.length) out.edited = true; return fixed; }; // stairs are placed by code once the pass's rooms are in
  return { out, line: l => { if (out.ended) return []; out.raw += l + '\n'; return take(feedAgentLine(buf, l)); }, end: () => [...(out.ended ? [] : take(flushAgentLine(buf))), ...settle()] };
}
// What to do after a pass: { finish }, { stop }, or the hidden note (extra) that starts the next pass.
// s: { step, build, rechecked, acted (anything changed this message), fresh() (problems this message added) }
export function agentNext(turn, s) {
  if (turn.ask) return { finish: true };
  if (turn.errors.length) return { review: true, extra: `A command failed. The user does not see this note:\n${turn.errors.map(e => '- ' + e).join('\n')}\nRead the design block and do the edit. Remove a room or stair with @@del and its id. If two rooms have the same name, @@ask with those choices and stop. Otherwise fix it. Do not repeat the failed command, and do not quote this failure to the user.` };
  if (turn.done) { // check the work before taking "done": anything this message broke gets one more pass
    const fresh = s.rechecked || s.step >= AGENT_PASSES || !s.acted ? [] : s.fresh();
    if (!fresh.length) return { finish: true };
    return { rechecked: true, extra: `You said done, but the plan now has these problems. The user does not see this note:\n${fresh.map(i => '- ' + i).join('\n')}\nFix each one with @@set or @@del using the design block, then @@done. If one cannot be fixed, say so in a sentence.` };
  }
  if (!turn.edited && !turn.more) {
    if (!s.build || s.step > 1) return { stop: true };
    return { extra: 'That reply did not change the house. This is a remove or edit. Use the design block: the back is the larger z. Remove each matching room with @@del and its id, or resize with @@set, then @@done. Do not answer with only a question.' };
  }
  if (!turn.edited) return { stop: true };
  return { extra: 'Continue the same request. The design block is the house as it stands now. Do not add a room that is already listed. If the request is already done, @@done with no new rooms.' };
}
// The changes already made this message, put in front of each follow-up note so nothing is done twice.
export function agentApplied(steps) {
  const acts = (steps || []).filter(s => s.k === 'act').map(s => '- ' + s.t).slice(-30);
  return acts.length ? `Already done for this message (do not repeat these; each size change is applied and final):\n${acts.join('\n')}\n\n` : '';
}
// A repair that left the plan with as many problems as before (or more) is undone: a failed fix must not make things worse.
// How bad a plan is: overlaps weigh most, then rooms over nothing and stair problems, then gaps, notches, and loose rooms.
export const agentBadness = plan => agentIssues(plan, Infinity).reduce((a, i) => a + (/overlaps/.test(i) ? 3 : /over nothing|not inside a room|comes up|starts inside|no stair/.test(i) ? 2 : 1), 0);
export const agentRepairFailed = (fixing, acted, before, plan) => fixing && acted && agentBadness(plan) >= before;
export const AGENT_REVERTED = 'I couldn’t improve the plan this time, so I put it back the way it was. Try one fix at a time, like “close the gap between Living and Hall”.';
export const agentLeftNote = left => `Still to fix: ${left.slice(0, 3).map(i => i.replace(/\.$/, '').replace(/\. .*$/, '')).join('; ')}${left.length > 3 ? `; and ${left.length - 3} more` : ''}. Ask me to fix them, or adjust them in the plan.`;
