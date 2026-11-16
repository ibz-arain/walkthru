
// =====================================================================
//  BUILDER — "My Design": an editable house made of rooms.
//  A room is an axis-aligned rectangle on a level (B / M / U). Shared room edges are the walls,
//  so dragging a wall resizes the rooms on both sides. The 3D house (walls, doors, windows,
//  front door, garage door, stairs, floors, ceilings, roof, furniture) is generated from the rooms.
// =====================================================================
const RT = { // room types
  open:     { name: 'Open Space', color: '#e9e7e1', floor: 'wood', win: 1, open: 1, plain: 1, size: [8, 8] },
  living:   { name: 'Living Room', color: '#f2d7a0', floor: 'wood', win: 1, open: 1, size: [16, 16] },
  great:    { name: 'Great Room', color: '#f0cf95', floor: 'wood', win: 1, open: 1, size: [18, 20] },
  kitchen:  { name: 'Kitchen', color: '#f5c39b', floor: 'tile', win: 1, open: 1, size: [14, 14] },
  dining:   { name: 'Dining', color: '#f1e09c', floor: 'wood', win: 1, open: 1, size: [12, 14] },
  foyer:    { name: 'Foyer', color: '#e6dccb', floor: 'tile', open: 1, entry: 1, size: [8, 12] },
  hall:     { name: 'Hall', color: '#e4e3dd', floor: 'wood', open: 1, size: [4, 16] },
  stairs:   { name: 'Stairs', color: '#d7c3a8', floor: 'wood', stairs: 1, open: 1, size: [8, 12] },
  bedroom:  { name: 'Bedroom', color: '#c6daef', floor: 'carpet', win: 1, private: 1, size: [12, 12] },
  primary:  { name: 'Primary Bedroom', color: '#b2cce8', floor: 'carpet', win: 1, private: 1, size: [16, 15] },
  bath:     { name: 'Bathroom', color: '#bce2da', floor: 'tile', small: 1, wet: 1, size: [8, 10] },
  closet:   { name: 'Closet', color: '#e7dacb', floor: 'wood', size: [6, 6] },
  office:   { name: 'Office', color: '#d6ccef', floor: 'wood', win: 1, size: [11, 11] },
  laundry:  { name: 'Laundry', color: '#dce6c4', floor: 'tile', wet: 1, size: [8, 8] },
  mud:      { name: 'Mud Room', color: '#e0dac9', floor: 'tile', size: [8, 10] },
  garage:   { name: 'Garage', color: '#d2d2d2', floor: 'concrete', garage: 1, size: [22, 24] },
  rec:      { name: 'Rec Room', color: '#e8d2b8', floor: 'lvp', win: 1, open: 1, size: [18, 16] },
  theatre:  { name: 'Theatre', color: '#c7bfd9', floor: 'carpet', size: [14, 16] },
  storage:  { name: 'Storage', color: '#d9d6cf', floor: 'concrete', size: [10, 10] },
  pantry:   { name: 'Pantry', color: '#ead9b5', floor: 'tile', like: 'closet', size: [6, 7] },
  powder:   { name: 'Powder Room', color: '#c7e6df', floor: 'tile', small: 1, wet: 1, like: 'bath', size: [5, 7] },
  ensuite:  { name: 'Ensuite', color: '#afdbd1', floor: 'tile', small: 1, wet: 1, like: 'bath', size: [10, 12] },
  walkin:   { name: 'Walk-in Closet', color: '#e3d3c1', floor: 'carpet', like: 'closet', size: [8, 8] },
  nursery:  { name: 'Nursery', color: '#d6e6f4', floor: 'carpet', win: 1, private: 1, like: 'bedroom', size: [10, 10] },
  guest:    { name: 'Guest Room', color: '#c3d4ea', floor: 'carpet', win: 1, private: 1, like: 'bedroom', size: [12, 11] },
  gym:      { name: 'Gym', color: '#d3dccb', floor: 'lvp', win: 1, size: [12, 12] },
  library:  { name: 'Library', color: '#dccab3', floor: 'wood', win: 1, like: 'office', size: [12, 12] },
  sunroom:  { name: 'Sunroom', color: '#f6e7a8', floor: 'tile', win: 1, sun: 1, like: 'living', size: [12, 12] },
  playroom: { name: 'Playroom', color: '#f2cfd6', floor: 'carpet', win: 1, like: 'rec', size: [12, 12] },
  bonus:    { name: 'Bonus Room', color: '#e9d5bf', floor: 'carpet', win: 1, like: 'living', size: [14, 16] },
  workshop: { name: 'Workshop', color: '#cfcac0', floor: 'concrete', win: 1, size: [12, 14] },
  wine:     { name: 'Wine Cellar', color: '#b9a3a6', floor: 'tile', like: 'closet', size: [8, 8] },
  // outdoor spaces and walkways
  balcony:  { name: 'Balcony', color: '#c9e2bd', floor: 'deck', outdoor: 1, rail: 1, levels: 'U', size: [12, 6] },
  deck:     { name: 'Deck', color: '#d9c5a3', floor: 'deck', outdoor: 1, rail: 1, levels: 'M', size: [14, 12] },
  porch:    { name: 'Porch', color: '#d8d4cb', floor: 'concrete', outdoor: 1, covered: 1, levels: 'M', size: [16, 7] },
  bridge:   { name: 'Bridge / Catwalk', color: '#e1dccf', floor: 'wood', open: 1, rail: 1, levels: 'U', size: [4, 14] },
};
const LV_Y = { B: BF, M: MF, U: UF }, LV_C = { B: BC, M: MC, U: UC }, LV_NAME = { B: 'Basement', M: 'Main floor', U: '2nd floor' };
let BID = 1;
const R = (type, level, x0, x1, z0, z1, extra = {}) => ({ id: BID++, type, level, x: +x0.toFixed(2), z: +z0.toFixed(2), w: +(x1 - x0).toFixed(2), d: +(z1 - z0).toFixed(2), ...extra });

// Starting design: your permit plan (House 1) simplified to rooms on wall centrelines.
function permitPlan() {
  BID = 1;
  const u = 2.54;
  return normalizeStairs({ roof: 'hip', rooms: [
    // main floor
    R('living', 'M', 0, 12.05, 0, 15.3), R('foyer', 'M', 12.05, 19.65, 0, 15.3), R('dining', 'M', 19.65, 31.37, 0, 15.3),
    R('stairs', 'M', 0, 10.8, 15.3, 23.15), R('hall', 'M', 10.8, 17.5, 15.3, 23.15),
    R('great', 'M', 0, 17.5, 23.15, 43.67), R('kitchen', 'M', 17.5, 29.35, 15.3, 29.25), R('dining', 'M', 17.5, 29.35, 29.25, 43.67, { name: 'Breakfast' }),
    R('garage', 'M', 31.37, 52.97, 2.0, 15.3, { group: 'g' }), R('garage', 'M', 29.35, 52.97, 15.3, 31.35, { group: 'g' }),
    R('mud', 'M', 29.35, 48.9, 31.35, 40.97), R('bath', 'M', 48.9, 52.97, 31.35, 40.97, { name: 'Powder' }),
    // 2nd floor
    R('bedroom', 'U', 0, 12.6, u + .3, u + 12.6, { name: 'Bedroom 3' }), R('bath', 'U', 12.6, 20.2, u + .3, u + 14.7, { name: 'Jack & Jill', group: 'jj' }),
    R('bath', 'U', 10.4, 21.2, u - 2.6, u + .3, { name: 'Jack & Jill', group: 'jj' }),
    R('bedroom', 'U', 20.2, 31.3, u + .3, u + 18.7, { name: 'Bedroom 2', group: 'b2' }), R('bedroom', 'U', 16.9, 20.2, u + 14.7, u + 18.7, { name: 'Bedroom 2', group: 'b2' }),
    R('stairs', 'U', 0, 10.6, u + 12.6, u + 20.35), R('hall', 'U', 10.6, 16.9, u + 12.6, u + 25.4),
    R('laundry', 'U', 16.9, 29.2, u + 20.9, u + 27.7), R('primary', 'U', 0, 16.9, u + 20.35, u + 40.5),
    R('closet', 'U', 16.9, 29.0, u + 27.7, u + 40.5, { name: 'Walk-in Closet' }), R('closet', 'U', 29.0, 31.3, u + 20.9, u + 40.5, { name: 'Walk-in Closet 2' }),
    R('bath', 'U', 31.3, 52.6, u + 20.5, u + 38.2, { name: 'Primary Bath' }),
    // basement
    R('bedroom', 'B', 0, 12.0, 0, 15.3), R('hall', 'B', 12.0, 19.8, 0, 25.9), R('theatre', 'B', 19.8, 31.37, 0, 14.45),
    R('stairs', 'B', 0, 10.8, 15.3, 23.15), R('bath', 'B', 0, 11.6, 23.15, 31.2), R('storage', 'B', 19.8, 28.6, 14.45, 25.9, { name: 'Mechanical' }),
    R('rec', 'B', 0, 28.6, 31.2, 43.67), R('rec', 'B', 11.6, 19.8, 25.9, 31.2, { group: 'rec' }),
  ] });
}
// House 3: 1196 Campana Cres, Belle River (iGUIDE plans, 2026-11-05). Street side is -z (the plans' east side).
// Measured off the plan images: x = plan south→north, z = street → back yard, in feet on wall centrelines.
function campanaPlan() {
  BID = 1;
  const rooms = [
    // main floor
    R('garage', 'M', 19.25, 50.45, 0, 24.09), R('mud', 'M', 19.25, 30.34, 24.09, 30.91, { name: 'Mudroom' }),
    R('powder', 'M', 30.34, 35.9, 24.09, 30.91, { name: '2pc Bath' }), R('pantry', 'M', 35.9, 42.27, 24.09, 30.91),
    R('dining', 'M', 19.25, 30.34, 30.91, 45.68), R('kitchen', 'M', 30.34, 42.27, 30.91, 45.68),
    R('living', 'M', 0, 19.25, 30.91, 45.68, { tall: true }), R('stairs', 'M', 0, 11.82, 24.09, 30.91),
    R('foyer', 'M', 11.82, 19.25, 12.73, 30.91), R('office', 'M', 0, 11.82, 10.23, 24.09),
    R('porch', 'M', 16.8, 31.6, 45.68, 59.5, { name: 'Patio' }),
    // 2nd floor (the living room is open to below)
    R('primary', 'U', 19.25, 33.39, 27.15, 45.68, { name: 'Primary' }), R('ensuite', 'U', 33.39, 41.83, 32.93, 45.68, { name: '5pc Ensuite' }),
    R('walkin', 'U', 36.15, 41.83, 22.56, 32.93, { name: 'WIC', group: 'wic' }), R('walkin', 'U', 33.39, 36.15, 27.15, 32.93, { name: 'WIC', group: 'wic' }),
    R('laundry', 'U', 30.64, 36.15, 20.08, 27.15), R('closet', 'U', 36.15, 41.83, 20.08, 22.56, { name: 'Closet' }),
    R('bedroom', 'U', 30.64, 41.83, 8.16, 20.08, { name: 'Bedroom 2' }), R('bedroom', 'U', 19.25, 30.64, 6.04, 16.9, { name: 'Bedroom 3' }),
    R('walkin', 'U', 13.58, 19.25, 12.75, 16.9, { name: 'WIC 3' }),
    R('hall', 'U', 26.8, 30.64, 16.9, 23.3), R('closet', 'U', 24.5, 26.8, 16.9, 23.3, { name: 'Linen' }), R('bath', 'U', 13.58, 24.5, 16.9, 23.3, { name: '5pc Bath' }),
    R('hall', 'U', 11.65, 30.64, 23.3, 27.15), R('bridge', 'U', 11.65, 19.25, 27.15, 30.91, { name: 'Landing' }), R('stairs', 'U', 0, 11.65, 23.3, 30.91),
    R('bedroom', 'U', 0, 11.1, 9.72, 23.3, { name: 'Bedroom 4' }), R('hall', 'U', 11.1, 13.58, 19.6, 23.3), R('closet', 'U', 11.1, 13.58, 9.72, 19.6, { name: 'Closet' }),
    // basement
    R('storage', 'B', 0, 40, 32, 45.68, { name: 'Unfinished' }), R('stairs', 'B', 0, 9.45, 24.44, 30.91), R('hall', 'B', 0, 9.45, 30.91, 32), R('hall', 'B', 9.45, 18.07, 24.44, 32),
    R('storage', 'B', 18.07, 40, 26.17, 32, { name: 'Utility' }), R('storage', 'B', 0, 18.07, 14.5, 24.44),
  ];
  for (const r of rooms) r.x = +(50.45 - r.x - r.w).toFixed(2); // the plans are drawn mirrored to the street photo: garage goes on the right
  rooms.push(R('porch', 'M', 31.2, 38.63, 7, 12.73, { name: 'Front Porch' }));
  // exterior from the listing photos: charcoal board-and-batten, red brick base on the front, steep front gables, split garage doors
  return normalizeStairs({ roof: 'hip', style: 'batten', rooms, extras: { gables: [
    { x0: 10.3, x1: 31.5, z0: -1.4, z1: 5.74, plate: MC, back: true },   // over the double garage door
    { x0: 19.52, x1: 31.49, z0: 4.74, z1: 15, plate: UC },              // centre gable, bedroom 3
    { x0: 39.06, x1: 50.74, z0: 8.42, z1: 18, plate: UC },              // left gable, bedroom 4
  ] } });
}
// board-and-batten siding and red brick (House 3 style)
TX.batten = ctex(256, 4, (g, s, r) => { noise(g, s, r, 190, 16, 6000, 2); for (let i = 0; i < 3; i++) { const x = i * s / 3; g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(x, 0, 3, s); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + 3, 0, 7, s); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 10, 0, 2, s); } }, 43);
TX.brick = ctex(256, 4, (g, s, r) => { g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, s, s); const rows = 18, rh = s / rows, bw = s / 6;
  for (let i = 0; i < rows; i++) for (let j = -1; j < 7; j++) { const x = j * bw + (i % 2) * bw / 2, h = 8 + r() * 14, l = 30 + r() * 12;
    g.fillStyle = `hsl(${h},${38 + r() * 14}%,${l}%)`; g.fillRect(x + 1.5, i * rh + 1.5, bw - 3, rh - 3); } }, 47);
Object.assign(M, { batten: std({ map: TX.batten, color: '#767a80', roughness: .85, side: THREE.DoubleSide }), brick: std({ map: TX.brick, color: '#ffffff', roughness: .92 }),
  gdoor: std({ color: '#4a4d52', roughness: .55, metalness: .2 }), fence: std({ map: TX.deck, color: '#c9a07a', roughness: .85 }), lamp: std({ color: '#ffe2a8', emissive: '#ffcf7a', emissiveIntensity: 1.2 }) });
let BM;
try { BM = JSON.parse(localStorage.getItem('walkthru-builder-v1') || 'null'); } catch (e) { }
if (!BM || !Array.isArray(BM.rooms)) BM = permitPlan();

// Several saved designs: { cur, list: [{ id, name, bm }] }. The first one picks up whatever was saved before.
let DS = null;
try { DS = JSON.parse(localStorage.getItem('walkthru-designs-v1') || 'null'); } catch (e) { }
if (!DS || !Array.isArray(DS.list) || !DS.list.length) DS = { cur: 1, list: [{ id: 1, name: 'My Design', bm: BM }] };
{ const d = DS.list.find(x => x.id === DS.cur) || DS.list[0]; DS.cur = d.id; BM = d.bm && Array.isArray(d.bm.rooms) ? d.bm : permitPlan(); }
function resetBID() { BID = Math.max(1, ...BM.rooms.map(r => r.id + 1), ...(BM.stairs || []).map(s => s.id + 1)); }
let H3P = false, userBM = null; // H3P: House 3 (the Campana plan) is showing in place of your design
function usePreset(on) { if (on === H3P) return false; if (on) { userBM = BM; BM = campanaPlan(); } else { BM = userBM; resetBID(); } H3P = on; return true; }
let cloudSave = null; // set by cloud.js: Studio projects and customer links save to the server instead of this browser
function saveBM() { if (H3P) return; if (cloudSave) return cloudSave(); const d = DS.list.find(x => x.id === DS.cur); if (d) d.bm = BM; try { localStorage.setItem('walkthru-designs-v1', JSON.stringify(DS)); } catch (e) { } designSynced(); }
const curDesign = () => DS.list.find(x => x.id === DS.cur);
resetBID(); normalizeStairs(BM);
const rname = r => r.name || RT[r.type]?.name || r.type;

// ---------- Plan analysis: walls (shared vs exterior), doors, windows ----------
const EPS = .06;
const openPair = (a, b) => (RT[a.type]?.open && RT[b.type]?.open && !(a.type === 'stairs' && b.type === 'stairs')) || (a.group && a.group === b.group) || (a.type === b.type && (a.type === 'hall' || a.type === 'garage'));
function doorPair(a, b) {
  const t = [likeOf(a.type), likeOf(b.type)], has = x => t.includes(x);
  if (has('garage')) return has('mud') || has('laundry') || has('hall') || has('kitchen') || has('foyer');
  if (has('hall') || has('foyer') || has('stairs') || has('mud') || has('open')) return true;
  if ((has('bedroom') || has('primary')) && (has('bath') || has('closet'))) return true;
  if (has('living') || has('great') || has('kitchen') || has('dining') || has('rec')) return !has('bedroom') && !has('primary');
  return has('office') || has('laundry') || has('theatre') || has('storage');
}
function sub1d(range, cuts) { // subtract intervals from [a,b]
  let out = [range];
  for (const [c0, c1] of cuts) { const nx = []; for (const [a, b] of out) { if (c1 <= a + EPS || c0 >= b - EPS) { nx.push([a, b]); continue; } if (c0 > a + EPS) nx.push([a, c0]); if (c1 < b - EPS) nx.push([c1, b]); } out = nx; }
  return out.filter(([a, b]) => b - a > .3);
}
function edgesOf(r) {
  return [
    { side: 'n', axis: 'x', c: r.z, a: r.x, b: r.x + r.w, out: '-z' }, { side: 's', axis: 'x', c: r.z + r.d, a: r.x, b: r.x + r.w, out: '+z' },
    { side: 'w', axis: 'z', c: r.x, a: r.z, b: r.z + r.d, out: '-x' }, { side: 'e', axis: 'z', c: r.x + r.w, a: r.z, b: r.z + r.d, out: '+x' }];
}
const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
const extKey = (r, out) => `${r.id}:${out}`;
const extMode = (r, out) => BM.ext?.[extKey(r, out)] || 'auto';
const pairKey = (a, b) => a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
const wallMode = (a, b) => BM.walls?.[pairKey(a, b)] || (openPair(a, b) ? 'open' : doorPair(a, b) ? 'door' : 'wall');
// Close slivers of "outside" between rooms that almost touch: stretch the given rooms to meet their neighbours.
function closeGaps(ids, maxGap = 1.5) {
  let n = 0;
  for (const R of BM.rooms.filter(r => !ids || ids.includes(r.id))) for (const O of BM.rooms) {
    if (O === R || O.level !== R.level) continue;
    const zo = Math.min(R.z + R.d, O.z + O.d) - Math.max(R.z, O.z), xo = Math.min(R.x + R.w, O.x + O.w) - Math.max(R.x, O.x);
    if (zo > 1) { let g = O.x - (R.x + R.w); if (g > .05 && g <= maxGap) { R.w = +(R.w + g).toFixed(2); n++; }
      g = R.x - (O.x + O.w); if (g > .05 && g <= maxGap) { R.x = +(O.x + O.w).toFixed(2); R.w = +(R.w + g).toFixed(2); n++; } }
    if (xo > 1) { let g = O.z - (R.z + R.d); if (g > .05 && g <= maxGap) { R.d = +(R.d + g).toFixed(2); n++; }
      g = R.z - (O.z + O.d); if (g > .05 && g <= maxGap) { R.z = +(O.z + O.d).toFixed(2); R.d = +(R.d + g).toFixed(2); n++; } }
  }
  return n;
}
function planLevel(lv) {
  const rs = BM.rooms.filter(r => r.level === lv && !isOut(r)), outs = BM.rooms.filter(r => r.level === lv && isOut(r)), walls = [];
  for (const A of rs) for (const e of edgesOf(A)) {
    const shared = [];
    for (const B of rs) { if (B === A) continue; const f = edgesOf(B).find(x => x.side === OPP[e.side]);
      if (Math.abs(f.c - e.c) > EPS) continue; const s0 = Math.max(e.a, f.a), s1 = Math.min(e.b, f.b); if (s1 - s0 > .3) shared.push([s0, s1, B]); }
    for (const [a, b] of sub1d([e.a, e.b], shared)) {
      const m = (a + b) / 2, off = { '-z': [0, -.6], '+z': [0, .6], '-x': [-.6, 0], '+x': [.6, 0] }[e.out], px = e.axis === 'x' ? m : e.c + off[0], pz = e.axis === 'x' ? e.c + off[1] : m;
      const toOut = outs.find(o => px > o.x && px < o.x + o.w && pz > o.z && pz < o.z + o.d);
      if (A.type === 'bridge') { walls.push({ rail: true, axis: e.axis, c: e.c, a, b, room: A, ops: [] }); continue; } // catwalk edges get railings
      walls.push({ ext: true, axis: e.axis, c: e.c, a, b, out: e.out, room: A, ops: [], toOut });
    }
    for (const [a, b, B] of shared) if (A.id < B.id) {
      const mode = BM.walls?.[pairKey(A, B)];
      if (mode ? mode === 'open' : openPair(A, B)) continue;
      walls.push({ ext: false, axis: e.axis, c: e.c, a, b, rooms: [A, B], ops: [], door: mode ? mode === 'door' : doorPair(A, B) });
    }
  }
  // openings
  let frontDone = lv !== 'M';
  const frontCands = walls.filter(w => w.ext && w.out === '-z' && extMode(w.room, w.out) === 'auto' && (RT[w.room.type]?.entry || w.room.type === 'living' || w.room.type === 'great') && w.b - w.a >= 4).sort((p, q) => (RT[q.room.type]?.entry ? 1 : 0) - (RT[p.room.type]?.entry ? 1 : 0) || (q.b - q.a) - (p.b - p.a));
  if (!frontDone && frontCands[0]) { const w = frontCands[0], L = w.b - w.a; w.ops.push({ c: (w.a + w.b) / 2, w: L >= 7.5 ? 5.67 : 3, b: MF, h: 8, k: L >= 7.5 ? 'front' : 'extdoor' }); w.front = true; frontDone = true; }
  const gUsed = new Set();
  walls.sort((p, q) => (q.out === '-z') - (p.out === '-z'));
  for (const w of walls) {
    const L = w.b - w.a, mid = (w.a + w.b) / 2, y = LV_Y[lv];
    if (!w.ext) { if (w.door && L >= 2.9) w.ops.push({ c: mid, w: Math.min(2.67, L - .5), b: y, h: 6.67, k: 'door', sw: 1 }); continue; }
    if (w.front) continue;
    const xm = extMode(w.room, w.out);
    if (xm === 'solid') continue;
    if (xm === 'open') { w.open = true; continue; } // no wall: the room is open to the outside here
    if (w.toOut && xm === 'auto' && L >= 3.2 && !RT[w.room.type]?.garage) { const big = L >= 8; w.ops.push({ c: mid, w: big ? 6 : 3, b: y, h: big ? 7.5 : 6.67, k: big ? 'slider' : 'extdoor' }); continue; }
    if (xm === 'door' && L >= 3.2) { w.ops.push({ c: mid, w: 3, b: lv === 'M' && w.room.type === 'garage' ? GF : y, h: 6.67, k: 'extdoor' }); continue; }
    if (xm === 'window' && lv !== 'B' && L >= 3.5) { const n = Math.max(1, Math.min(3, Math.floor(L / 7))), ww = Math.min(4.5, L / n - 1.4);
      for (let i = 0; i < n; i++) w.ops.push({ c: w.a + L * (i + .5) / n, w: ww, b: y + 2.3, h: lv === 'M' ? 6 : 5 }); continue; }
    if (xm === 'window' && lv === 'B' && L >= 4) { w.ops.push({ c: mid, w: 3.5, b: BC - 2.2, h: 1.6 }); continue; }
    const T = RT[w.room.type] || {};
    if (T.garage && lv === 'M' && BM.style === 'batten' && w.out === '-z' && L >= 26 && !gUsed.has(w.room.group || w.room.id)) { // triple garage: single + double door, brick pier between
      w.ops.push({ c: w.a + 6.1, w: 9, b: GF, h: 8, k: 'garage', top: 1, fm: M.gdoor }, { c: w.b - 10.2, w: 16, b: GF, h: 8, k: 'garage', top: 1, fm: M.gdoor }); gUsed.add(w.room.group || w.room.id); w.garageDoor = true; continue; }
    if (T.garage && lv === 'M') { const key = w.room.group || w.room.id; if (L >= 10 && !gUsed.has(key) && (w.out === '-z' || L >= 16)) { const gw = L >= 18.5 ? 16 : 9; w.ops.push({ c: mid, w: gw, b: GF, h: 8, k: 'garage' }); gUsed.add(key); w.garageDoor = true; } continue; }
    if (lv === 'B') { if (L >= 5 && (T.win || T.private)) w.ops.push({ c: mid, w: 3.5, b: BC - 2.2, h: 1.6 }); continue; }
    if (T.small) { if (L >= 4) w.ops.push({ c: mid, w: 2.5, b: y + 4.2, h: 3 }); continue; }
    if (T.win && L >= 4.5) { const n = Math.max(1, Math.min(3, Math.floor(L / 7))), ww = Math.min(4.5, L / n - 1.6);
      const inPt = c => { const d = { '-z': [0, .8], '+z': [0, -.8], '-x': [.8, 0], '+x': [-.8, 0] }[w.out]; return w.axis === 'x' ? [c, w.c + d[1]] : [w.c + d[0], c]; };
      for (let i = 0; i < n; i++) { const c = w.a + L * (i + .5) / n, tallWin = lv === 'M' && w.room.tall && [-ww / 2, 0, ww / 2].every(k => inTall(...inPt(c + k)));
        w.ops.push({ c, w: ww, b: y + (tallWin ? 1.5 : 2.3), h: tallWin ? 14 : lv === 'M' ? 6 : 5 }); } }
  }
  return walls;
}

// ---------- 3D groups ----------
const HOUSE3 = new THREE.Group(); scene.add(HOUSE3); HOUSE3.visible = false;
const G3 = {};
for (const k of ['basement', 'main', 'mainCeil', 'upper', 'upperCeil', 'roof', 'furnB', 'furnM', 'furnU', 'site', 'trees']) { G3[k] = new THREE.Group(); HOUSE3.add(G3[k]); }
let ROOMS3 = [], OUTLINE3 = { B: [], M: [], U: [] }, H3_WALK = [], H3_FRONT = [15, -20, Math.PI, 1], H3_DRIVE = [45, -30, Math.PI, 1];
const flatRoofMat = std({ color: '#5f6266', roughness: .9 });
const ovl = (a, b) => a.x < b.x + b.w - .05 && a.x + a.w > b.x + .05 && a.z < b.z + b.d - .05 && a.z + a.d > b.z + .05;
function laneOf(S, half) { const dir = stairDirOf(S), r = stairRect(S, dir), alongX = dir[1] === 'x';
  if (half) { if (alongX) { r.d = r.d / 2; if (half === 2) r.z += r.d; } else { r.w = r.w / 2; if (half === 2) r.x += r.w; } } return r; }
function cutRect([a0, a1, b0, b1], c) { // rectangle minus rectangle → up to 4 pieces
  const ix0 = Math.max(a0, c.x), ix1 = Math.min(a1, c.x + c.w), iz0 = Math.max(b0, c.z), iz1 = Math.min(b1, c.z + c.d);
  if (ix1 - ix0 < .05 || iz1 - iz0 < .05) return [[a0, a1, b0, b1]];
  const o = []; if (iz0 - b0 > .05) o.push([a0, a1, b0, iz0]); if (b1 - iz1 > .05) o.push([a0, a1, iz1, b1]); if (ix0 - a0 > .05) o.push([a0, ix0, iz0, iz1]); if (a1 - ix1 > .05) o.push([ix1, a1, iz0, iz1]); return o; }
// Double-height main-floor rooms: open up to the 2nd-floor ceiling (only where nothing is built above).
// Double height: a "tall" main-floor room rises to the 2nd-floor ceiling wherever nothing is built above it.
// 2nd-floor rooms over part of it sit in the void as a box with its own ceiling underneath.
const upSolid = () => BM.rooms.filter(u => u.level === 'U' && u.type !== 'bridge' && u.type !== 'balcony');
const coveredAt = (x, z) => upSolid().some(u => x > u.x && x < u.x + u.w && z > u.z && z < u.z + u.d);
const tallParts = r => rectCells([r], .5, upSolid());                       // the open (double-height) parts of a room
const isTall = r => r.level === 'M' && r.tall && tallParts(r).length > 0;   // at least part of it is open above
const fullyTall = r => isTall(r) && !upSolid().some(u => ovl(u, r));
const inTall = (x, z) => !coveredAt(x, z) && BM.rooms.some(r => r.level === 'M' && r.tall && x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d);
const upperAt = (x, z) => BM.rooms.some(r => r.level === 'U' && x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d);
// ---------- Stairs layer ----------
// Staircases are their own objects (BM.stairs), sitting inside rooms: they don't take a room slot, make walls or change connections.
// S = { id, level: 'B'|'M' (where it starts), cx, cz (centre), W (width), L (run length), dir? ('+x','+z','-x','-z'; missing = automatic) }
function stairsOn(lv) { return (BM.stairs || []).filter(s => s.level === lv); }
function stairRect(S, dir) { const ax = dir[1] === 'x', w = ax ? S.L : S.W, d = ax ? S.W : S.L; return { x: S.cx - w / 2, z: S.cz - d / 2, w, d }; }
const stairUp = S => S.level === 'B' ? 'M' : 'U';
function roomAt3(lv, x, z) { return BM.rooms.find(o => o.level === lv && !isOut(o) && x > o.x && x < o.x + o.w && z > o.z && z < o.z + o.d); }
// Stair shapes: straight, U-turn (two flights side by side with a flat landing) or curved (the flights joined by a half-circle of
// winder steps). Turning stairs climb up one half of their box, turn at the far end and arrive back beside where they started.
const STAIR_SHAPES = ['auto', 'straight', 'u', 'curved'];
function turnTop(S, dir) { // where a turning stair arrives: just past its starting end, on the second half
  const r = stairRect(S, dir), s = dir[0] === '+' ? 1 : -1, ax = dir[1] === 'x', lo = ax ? (s > 0 ? r.x : r.x + r.w) : (s > 0 ? r.z : r.z + r.d), c2 = ax ? r.z + r.d * .75 : r.x + r.w * .75;
  return ax ? [lo - 2 * s, c2] : [c2, lo - 2 * s]; }
const stairShape = S => { // Auto: curved when the box is wide enough and the turn lands on 2nd-floor floor, otherwise straight
  if (S.level === 'B') return 'straight'; if (S.shape && S.shape !== 'auto') return S.shape; if (!(S.W >= 5.5 && S.L >= 8)) return 'straight';
  const dirs = S.dir ? [S.dir] : STAIR_DIRS;
  return dirs.some(d => roomAt3('U', ...turnTop(S, d))) ? 'curved' : 'straight'; };
const turns = S => stairShape(S) !== 'straight';
function stairEnds(S, dir) { // points just before the bottom step, just inside it, and just past the top
  const r = stairRect(S, dir), s = dir[0] === '+' ? 1 : -1, ax = dir[1] === 'x';
  const lo = ax ? (s > 0 ? r.x : r.x + r.w) : (s > 0 ? r.z : r.z + r.d), hi = ax ? (s > 0 ? r.x + r.w : r.x) : (s > 0 ? r.z + r.d : r.z);
  if (turns(S)) { const c1 = ax ? r.z + r.d / 4 : r.x + r.w / 4, Q = (c, off, n) => ax ? [c + off * s, n] : [n, c + off * s];
    return { start: Q(lo, -2, c1), startIn: Q(lo, .6, c1), top: turnTop(S, dir) }; }
  const P = (c, off) => ax ? [c + off * s, S.cz] : [S.cx, c + off * s];
  return { start: P(lo, -2), startIn: P(lo, .6), top: P(hi, 2) };
}
function stairFits(S, dir) { // the flight stays inside one room (or rooms open to each other), never through a wall
  const r = stairRect(S, dir), pts = [[r.x + .3, r.z + .3], [r.x + r.w - .3, r.z + .3], [r.x + .3, r.z + r.d - .3], [r.x + r.w - .3, r.z + r.d - .3], [S.cx, S.cz]];
  const rs = pts.map(p => roomAt3(S.level, ...p)); if (rs.some(q => !q)) return 0;
  return rs.every(q => q === rs[0] || wallMode(q, rs[0]) === 'open') ? 2 : 1;
}
function stairScore(S, dir) {
  const e = stairEnds(S, dir), a = roomAt3(S.level, ...e.start), b = roomAt3(S.level, ...e.startIn), t = roomAt3(stairUp(S), ...e.top);
  return stairFits(S, dir) * 4 + (a ? 2 : 0) + (a && b && (a === b || wallMode(a, b) === 'open') ? 2 : 0) + (t ? 3 : 0);
}
const OPP_DIR = { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z' };
function stairDirOf(S) { if (S.dir) return S.dir;
  // stacked stairs keep both entrances together: a turning main stair picks its way and the basement flight follows; otherwise the reverse
  if (S.level === 'B') { const m = stairsOn('M').find(o => Math.hypot(o.cx - S.cx, o.cz - S.cz) < 3); if (m && turns(m)) return OPP_DIR[stairDirOf(m)]; }
  if (S.level === 'M' && !turns(S)) { const b = stairsOn('B').find(o => Math.hypot(o.cx - S.cx, o.cz - S.cz) < 3); if (b) return OPP_DIR[stairDirOf(b)]; } /* stacked over basement stairs: both entrances together */
  let best = '+x', bs = -1; for (const d of STAIR_DIRS) { const sc = stairScore(S, d); if (sc > bs) { bs = sc; best = d; } } return best; }
function stairPair(S) { const mine = stairRect(S, stairDirOf(S)); return stairsOn(S.level === 'B' ? 'M' : 'B').find(o => ovl(stairRect(o, stairDirOf(o)), mine)); }
function stairStatus(S) {
  const dir = stairDirOf(S), e = stairEnds(S, dir), up = stairUp(S);
  if (up === 'U' && !BM.rooms.some(r => r.level === 'U')) return { msg: 'Leads nowhere yet: add 2nd-floor rooms above it', dir };
  if (!roomAt3(up, ...e.top)) return { msg: `The top lands outside: put a ${up === 'U' ? '2nd-floor' : 'main-floor'} room where it arrives`, dir };
  if (!roomAt3(S.level, ...e.start)) return { msg: 'The bottom step faces a wall or outside: move it or ↻ rotate it', dir };
  if (stairFits(S, dir) < 2) return { msg: 'These stairs cross a wall: move them inside one room or ↻ rotate them', dir };
  return { ok: true, dir, up };
}
// Old plans used a "Stairs" room: turn each into a hall plus a staircase object in the same spot.
function normalizeStairs(m) {
  m.stairs = m.stairs || [];
  for (const r of m.rooms) if (r.type === 'stairs') {
    if (r.level !== 'U') m.stairs.push({ id: BID++, level: r.level, cx: +(r.x + r.w / 2).toFixed(2), cz: +(r.z + r.d / 2).toFixed(2), W: Math.min(r.w, r.d), L: Math.max(r.w, r.d) });
    r.type = 'hall'; if (!r.name) r.name = 'Stair Hall'; delete r.rot;
  }
  return m;
}
function flightLanes(lv) { // footprints of the flights that arrive at this level from the one below
  const from = lv === 'U' ? 'M' : lv === 'M' ? 'B' : null; if (!from) return [];
  if (from === 'M' && !BM.rooms.some(r => r.level === 'U')) return [];
  return stairsOn(from).map(s => { const p = stairPair(s); return laneOf(s, from === 'M' && turns(s) ? 0 : p ? (from === 'B' ? (turns(p) ? 2 : 1) : 2) : 0); }); }
function clearGroup(g) { for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.isMesh) o.geometry?.dispose(); }); } }
const floorMat = t => ({ wood: M.wood, tile: M.tile, carpet: M.carpet, concrete: M.concrete, lvp: M.lvp, deck: M.deck })[RT[t]?.floor] || M.wood;
const likeOf = t => RT[t]?.like || t;
const isOut = r => !!RT[r.type]?.outdoor;
function rectCells(rooms, step = .5, minus = []) { // occupancy grid (rooms minus `minus`) → maximal rectangles, for roofs
  if (!rooms.length) return [];
  const x0 = Math.min(...rooms.map(r => r.x)), z0 = Math.min(...rooms.map(r => r.z));
  const X = Math.ceil((Math.max(...rooms.map(r => r.x + r.w)) - x0) / step), Z = Math.ceil((Math.max(...rooms.map(r => r.z + r.d)) - z0) / step);
  const g = new Uint8Array(X * Z);
  for (const r of rooms) for (let i = Math.round((r.x - x0) / step); i < Math.round((r.x + r.w - x0) / step); i++) for (let j = Math.round((r.z - z0) / step); j < Math.round((r.z + r.d - z0) / step); j++) if (i >= 0 && j >= 0 && i < X && j < Z) g[j * X + i] = 1;
  for (const r of minus) for (let i = Math.round((r.x - x0) / step); i < Math.round((r.x + r.w - x0) / step); i++) for (let j = Math.round((r.z - z0) / step); j < Math.round((r.z + r.d - z0) / step); j++) if (i >= 0 && j >= 0 && i < X && j < Z) g[j * X + i] = 0;
  const out = [];
  for (let guard = 0; guard < 40; guard++) {
    let best = null; const h = new Int32Array(X);
    for (let j = 0; j < Z; j++) {
      for (let i = 0; i < X; i++) h[i] = g[j * X + i] ? h[i] + 1 : 0;
      const st = [];
      for (let i = 0; i <= X; i++) { const hh = i < X ? h[i] : 0; let s = i;
        while (st.length && st[st.length - 1][1] >= hh) { const [si, sh] = st.pop(); const area = sh * (i - si); if (!best || area > best.area) best = { area, i0: si, i1: i, j1: j + 1, j0: j + 1 - sh }; s = si; }
        st.push([s, hh]); }
    }
    if (!best || best.area < 16) break;
    for (let j = best.j0; j < best.j1; j++) for (let i = best.i0; i < best.i1; i++) g[j * X + i] = 0;
    out.push([x0 + best.i0 * step, x0 + best.i1 * step, z0 + best.j0 * step, z0 + best.j1 * step]);
  }
  return out;
}
// Areas furniture must keep clear on a level: in front of doors, short openings between rooms, around stairs, and in front of windows (for tall pieces).
function clearZones(lv) {
  const Z = [], y = LV_Y[lv];
  const add = (axis, c, a, b, depth, yMin) => Z.push(axis === 'x' ? { x0: a, x1: b, z0: c - depth, z1: c + depth, yMin } : { x0: c - depth, x1: c + depth, z0: a, z1: b, yMin });
  for (const w of planLevel(lv)) for (const op of w.ops) {
    if (op.k === 'garage') continue;
    const door = op.k === 'door' || op.k === 'front' || op.k === 'extdoor' || op.k === 'slider' || op.k === 'open';
    if (door) add(w.axis, w.c, op.c - op.w / 2 - .35, op.c + op.w / 2 + .35, 3.4, -99);
    else add(w.axis, w.c, op.c - op.w / 2, op.c + op.w / 2, 1.5, op.b - .3);
  }
  const rs = BM.rooms.filter(r => r.level === lv);
  for (const A of rs) for (const Bq of rs) { if (A.id >= Bq.id || wallMode(A, Bq) !== 'open') continue; // doorway-sized openings stay clear
    for (const e of edgesOf(A)) { const f = edgesOf(Bq).find(x => x.side === OPP[e.side]); if (Math.abs(f.c - e.c) > EPS) continue; const a = Math.max(e.a, f.a), b = Math.min(e.b, f.b); if (b - a > .3 && b - a <= 10) add(e.axis, e.c, a, b, 2.4, -99); } }
  for (const S of stairsOn(lv)) { const r = stairRect(S, stairDirOf(S)); Z.push({ x0: r.x - 2.6, x1: r.x + r.w + 2.6, z0: r.z - 2.6, z1: r.z + r.d + 2.6, yMin: -99 }); }
  for (const S of stairsOn(lv === 'U' ? 'M' : lv === 'M' ? 'B' : 'X')) { const r = stairRect(S, stairDirOf(S)); Z.push({ x0: r.x - 2.6, x1: r.x + r.w + 2.6, z0: r.z - 2.6, z1: r.z + r.d + 2.6, yMin: -99 }); }
  return Z;
}
// Guard rail round a floor opening, only along the stretches where you could actually walk up to the edge:
// floor on the far side, no wall already on that line, not beside another flight or opening, not over a double-height void.
function guardRail(par, lv, hole, e, a, b, y) {
  const inward = { n: 1, s: -1, w: 1, e: -1 }[e.side], at = (t, off) => e.axis === 'x' ? [t, e.c + off] : [e.c + off, t];
  const blocked = (x, z) => stairsOn(lv).some(S => { const r = stairRect(S, stairDirOf(S)); return x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d; })
    || flightLanes(lv).some(L => L !== hole && x > L.x && x < L.x + L.w && z > L.z && z < L.z + L.d);
  const need = t => { const [ox, oz] = at(t, -inward * .45), [ix, iz] = at(t, inward * .45), out = roomAt3(lv, ox, oz), inn = roomAt3(lv, ix, iz);
    if (!out || blocked(ox, oz)) return false;                                  // nothing to stand on beside it
    if (inn && out !== inn && wallMode(inn, out) !== 'open') return false;      // a wall already runs along this edge
    return true; };
  const step = .5; let s0 = null;
  for (let t = a; t <= b + 1e-6; t += step) { const tt = Math.min(t + step / 2, b), ok = t < b && need(tt);
    if (ok && s0 === null) s0 = t; if ((!ok || t + step > b) && s0 !== null) { const s1 = ok ? b : t; if (s1 - s0 > .4) railing(par, e.axis, e.c, s0, s1, y); s0 = null; } }
}
function railing(par, axis, c, a, b, y) { // glass panel with a dark top rail
  if (b - a < .3) return; const h = 3.4;
  if (axis === 'x') { box(par, a, b, y, y + h, c - .05, c + .05, M.glass, { solid: true }); box(par, a, b, y + h, y + h + .15, c - .1, c + .1, M.trim); }
  else { box(par, c - .05, c + .05, y, y + h, a, b, M.glass, { solid: true }); box(par, c - .1, c + .1, y + h, y + h + .15, a, b, M.trim); }
}
// Which way a staircase climbs: starts along the room's long side, each ↻ Rotate turns it a quarter.
const STAIR_DIRS = ['+x', '+z', '-x', '-z'];
const stairDir = r => STAIR_DIRS[((r.w >= r.d ? 0 : 1) + (r.rot || 0)) % 4];
function stairRun(par, r, y0, y1, half, reverse, dirArg) { // straight flight
  const dir = dirArg || stairDir(r), alongX = dir[1] === 'x', n = 16, rise = (y1 - y0) / n;
  if (dir[0] === '-') reverse = !reverse;
  let sa = alongX ? r.x : r.z, L = alongX ? r.w : r.d, na = alongX ? r.z : r.x, W = alongX ? r.d : r.w;
  if (half === 1) W /= 2; if (half === 2) { na += W / 2; W /= 2; }
  const run = Math.min(L, 15 * .9) / 15, start = sa + (L - run * 15) / 2;
  for (let i = 1; i < n; i++) { const top = y0 + i * rise, s0 = reverse ? start + run * 15 - i * run : start + (i - 1) * run;
    if (alongX) box(par, s0, s0 + run, top - .6, top, na + .1, na + W - .1, M.wood, { walk: true });
    else box(par, na + .1, na + W - .1, top - .6, top, s0, s0 + run, M.wood, { walk: true }); }
}

function turnRun(par, S, dir, y0, y1) { // U-turn or curved staircase filling the stair box
  const r = stairRect(S, dir), ax = dir[1] === 'x', s = dir[0] === '+' ? 1 : -1, curved = stairShape(S) === 'curved', n = 16, rise = (y1 - y0) / n;
  const lo = ax ? (s > 0 ? r.x : r.x + r.w) : (s > 0 ? r.z : r.z + r.d), L = ax ? r.w : r.d, a0 = ax ? r.z : r.x, W = ax ? r.d : r.w, hw = W / 2;
  const T = (p0, p1, q0, q1, top) => { const A = lo + s * p0, B2 = lo + s * p1; // p along the climb from the low end, q across
    if (ax) box(par, A, B2, top - .6, top, a0 + q0, a0 + q1, M.wood, { walk: true }); else box(par, a0 + q0, a0 + q1, top - .6, top, A, B2, M.wood, { walk: true }); };
  const nA = curved ? 6 : 7, nW = curved ? 4 : 1, nB = n - 1 - nA - nW, runA = (L - hw) / nA, runB = (L - hw) / nB;
  for (let i = 1; i <= nA; i++) T((i - 1) * runA, i * runA, .05, hw - .05, y0 + i * rise);                      // first flight, up one half
  if (!curved) T(L - hw, L, .05, W - .05, y0 + (nA + 1) * rise);                                              // flat landing across the far end
  else { // winders: four wedges round a half-circle at the far end
    const cp = L - hw, cq = hw, R = hw - .05, world = (p, q) => ax ? [lo + s * p, a0 + q] : [a0 + q, lo + s * p];
    const [Cx, Cz] = world(cp, cq);
    for (let k = 0; k < nW; k++) { const top = y0 + (nA + k + 1) * rise, pts = [[0, 0]];
      for (let j = 0; j <= 6; j++) { const t = Math.PI * (k + j / 6) / nW, p = cp + Math.sin(t) * R, q = cq - Math.cos(t) * R, [wx, wz] = world(p, q); pts.push([wx - Cx, -(wz - Cz)]); }
      const sh = new THREE.Shape(); pts.forEach(([u, v], i) => i ? sh.lineTo(u, v) : sh.moveTo(u, v)); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: .6, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, M.wood); m.position.set(Cx, top - .6, Cz); m.castShadow = true; m.receiveShadow = true; par.add(m); walkables.push(m); }
  }
  for (let k = 1; k <= nB; k++) T(L - hw - (k - 1) * runB, L - hw - k * runB, hw + .05, W - .05, y0 + (nA + nW + k) * rise); // second flight, back down the other half
  // a thin wall between the two flights, like a real U stair
  const wq = hw, w0 = .3, w1 = L - hw - (curved ? .2 : 0);
  if (ax) box(par, Math.min(lo + s * w0, lo + s * w1), Math.max(lo + s * w0, lo + s * w1), y0, y0 + (nA + nW) * rise + 3, a0 + wq - .12, a0 + wq + .12, M.paint, { solid: true });
  else box(par, a0 + wq - .12, a0 + wq + .12, y0, y0 + (nA + nW) * rise + 3, Math.min(lo + s * w0, lo + s * w1), Math.max(lo + s * w0, lo + s * w1), M.paint, { solid: true });
  return { lo, ax, s, a0, W, hw };
}

// ---------- Build the 3D house from the rooms ----------
function buildHouse3() {
  for (const k in G3) clearGroup(G3[k]);
  for (const m of H3_WALK) { const i = walkables.indexOf(m); if (i >= 0) walkables.splice(i, 1); }
  const before = walkables.length;
  const rooms = BM.rooms, has = lv => rooms.some(r => r.level === lv);
  const parent = { B: G3.basement, M: G3.main, U: G3.upper }, furn = { B: G3.furnB, M: G3.furnM, U: G3.furnU };
  const stairs = lv => rooms.filter(r => r.level === lv && r.type === 'stairs');
  let carDone = false;
  for (const lv of ['B', 'M', 'U']) {
    const rs = rooms.filter(r => r.level === lv); if (!rs.length) continue;
    const P = parent[lv], y = LV_Y[lv], yc = LV_C[lv];
    const lanes = flightLanes(lv), zones = clearZones(lv);
    for (const r of rs) {
      const rr = rect(r.x, r.x + r.w, r.z, r.z + r.d), g = r.type === 'garage' && lv === 'M', T = RT[r.type] || {};
      if (T.outdoor) { // decks, porches, balconies
        const fy = lv === 'U' ? UF : MF - .35, mat = floorMat(r.type);
        if (lv === 'U') box(P, r.x, r.x + r.w, fy - 1.04, fy, r.z, r.z + r.d, M.stucco, { walk: true });
        else box(P, r.x, r.x + r.w, 0, fy, r.z, r.z + r.d, T.covered ? M.concrete : M.deck, { walk: true });
        flat(P, rr, [], fy + .01, mat, { walk: true });
        const corners = [[r.x, r.z], [r.x + r.w, r.z], [r.x, r.z + r.d], [r.x + r.w, r.z + r.d]];
        const indoorAt = (x, z) => BM.rooms.some(o => o.level === lv && !isOut(o) && x > o.x - .2 && x < o.x + o.w + .2 && z > o.z - .2 && z < o.z + o.d + .2);
        if (lv === 'U') for (const [cx, cz] of corners) if (!BM.rooms.some(o => o.level === 'M' && cx >= o.x - .1 && cx <= o.x + o.w + .1 && cz >= o.z - .1 && cz <= o.z + o.d + .1)) { const sx = cx === r.x ? .3 : -.3, sz = cz === r.z ? .3 : -.3; box(P, cx + Math.min(0, sx * 2), cx + Math.max(0, sx * 2), 0, fy - 1.04, cz + Math.min(0, sz * 2), cz + Math.max(0, sz * 2), M.white, { solid: true }); }
        const STY = BM.style === 'batten', frontSide = r.z < Math.min(...BM.rooms.filter(o => o.level === 'M' && !isOut(o)).map(o => o.z + o.d / 2));
        if (T.covered) { for (const [cx, cz] of corners) if (!indoorAt(cx, cz)) { const sx = cx === r.x ? 1 : -1, sz = cz === r.z ? 1 : -1, A = (k, wd) => [k + Math.min(0, (k === cx ? sx : sz) * wd), k + Math.max(0, (k === cx ? sx : sz) * wd)];
            if (STY) { const ins = (k, s2, wd) => [k + s2 * .15, k + s2 * (.15 + wd)].sort((p, q) => p - q);
              if (frontSide) { const [a0, a1] = ins(cx, sx, 1.5), [b0, b1] = ins(cz, sz, 1.5); box(P, a0, a1, fy, fy + 2.8, b0, b1, M.brick, { solid: true }); box(P, a0 - .08, a1 + .08, fy + 2.8, fy + 2.95, b0 - .08, b1 + .08, M.concrete); }
              const d = frontSide ? .42 : 0, [a0, a1] = ins(cx + sx * d, sx, .65), [b0, b1] = ins(cz + sz * d, sz, .65); box(P, a0, a1, fy, MC - .6, b0, b1, M.trim, { solid: true }); }
            else box(P, ...A(cx, 1.1), fy, MC - .6, ...A(cz, 1.1), M.stone, { solid: true }); }
          box(P, r.x, r.x + r.w, MC - .6, MC, r.z, r.z + r.d, STY ? M.batten : M.stucco); flat(G3.mainCeil, rr, [], MC - .62, M.soffit); }
        if (T.rail) for (const e of edgesOf(r)) { // railings on the open edges
          const segs = sub1d([e.a, e.b], BM.rooms.filter(o => o.level === lv && !isOut(o) && o !== r).flatMap(o => { const f = edgesOf(o).find(x => x.side === OPP[e.side]); return Math.abs(f.c - e.c) < EPS ? [[f.a, f.b]] : []; }));
          for (const [a, b] of segs) railing(P, e.axis, e.c, a, b, fy);
        }
        if (showFurnBuild) furnish(furn[lv], r, fy, zones);
        continue;
      }
      let pieces = [[r.x, r.x + r.w, r.z, r.z + r.d]];
      for (const L of lanes) pieces = pieces.flatMap(p => cutRect(p, L)); // open only above the flight arriving from below
      for (const [a0, a1, b0, b1] of pieces) {
        if (g) box(P, a0, a1, 0, GF, b0, b1, M.concrete, { walk: true });
        else { box(P, a0, a1, y - 1.04, y, b0, b1, M.ceil, { cast: false }); flat(P, rect(a0, a1, b0, b1), [], y + .01, floorMat(r.type), { walk: true }); }
      }
      if (lv === 'M' && isTall(r)) { const open = tallParts(r).map(([a0, a1, b0, b1]) => rect(a0, a1, b0, b1));
        for (const q of open) flat(G3.mainCeil, q, [], UC - .02, M.ceil);
        if (!fullyTall(r)) flat(G3.mainCeil, rr, open, yc - .02, M.ceil); }
      else flat(lv === 'U' ? G3.upperCeil : G3.mainCeil, rr, [], (lv === 'U' ? UC : yc) - .02, M.ceil);
      if (showFurnBuild) { if (r.type === 'garage') { if (carDone) r._car = true; carDone = true; } furnish(furn[lv], r, g ? GF : y, zones); delete r._car; }
    }
    // staircases starting on this level
    for (const S of stairsOn(lv)) {
      const upLv = stairUp(S), upY = LV_Y[upLv]; if (upLv === 'U' && !has('U')) continue;
      const dir = stairDirOf(S), pair = stairPair(S), UP = parent[upLv];
      if (turns(S)) { // turning stairs: rail round the whole opening except the half you arrive on
        const g = turnRun(P, S, dir, y, upY), r = stairRect(S, dir), startSide = { '+x': 'w', '-x': 'e', '+z': 'n', '-z': 's' }[dir];
        for (const e of edgesOf(r)) { if (e.side !== startSide) { guardRail(UP, upLv, r, e, e.a, e.b, upY); continue; } guardRail(UP, upLv, r, e, g.a0, g.a0 + g.hw, upY); }
        continue; }
      const half = pair ? (lv === 'B' ? (turns(pair) ? 2 : 1) : 2) : 0, lane = laneOf(S, half);
      stairRun(P, lane, y, upY, 0, false, dir);
      const topSide = { '+x': 'e', '-x': 'w', '+z': 's', '-z': 'n' }[dir]; // guard rail round the opening, open at the arrival end
      for (const e of edgesOf(lane)) if (e.side !== topSide) guardRail(UP, upLv, lane, e, e.a, e.b, upY);
    }
    // walls
    for (const w of planLevel(lv)) {
      if (w.rail) { railing(P, w.axis, w.c, w.a, w.b, LV_Y[lv]); continue; }
      if (w.open) continue; // Open: nothing at all on this edge, upstairs too
      const horiz = w.axis === 'x', ext = w.ext, garageRoom = (ext ? w.room.type : w.rooms.some(q => q.type === 'garage')) === 'garage' || (!ext && w.rooms.some(q => q.type === 'garage'));
      const t = ext ? EXT : INT, ex = ext ? t / 2 : 0;
      const y0 = lv === 'B' ? BF : lv === 'M' ? (garageRoom ? 0 : ext ? TF : MF) : ext ? MC : UF;
      const nrm = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] };
      const tallSide = lv === 'M' && (ext ? w.room.tall : w.rooms.some(q => q.tall));
      // split where a 2nd-floor room's edge crosses above, so each stretch gets its own height
      const cuts = tallSide ? [...new Set(upSolid().flatMap(u => horiz ? [u.x, u.x + u.w] : [u.z, u.z + u.d]))].filter(c => c > w.a + .3 && c < w.b - .3).sort((p, q) => p - q) : [];
      const bounds = [w.a, ...cuts, w.b];
      for (let si = 0; si < bounds.length - 1; si++) {
        const sa = bounds[si], sb = bounds[si + 1], mid = (sa + sb) / 2;
        const probe = (dx, dz) => horiz ? [mid, w.c + dz] : [w.c + dx, mid];
        let y1 = lv === 'B' ? (ext ? TF : BC) : lv === 'M' ? MC : UC;
        if (tallSide && ext) { const [ox, oz] = nrm[w.out], [ix, iz] = probe(-ox * .6, -oz * .6); if (inTall(ix, iz)) y1 = UC; }
        if (tallSide && !ext) { // rise to full height unless a 2nd-floor room's wall already covers the upper part
          const [px1, pz1] = probe(-.6, -.6), [px2, pz2] = probe(.6, .6), t1 = inTall(px1, pz1), t2 = inTall(px2, pz2), u1 = coveredAt(px1, pz1), u2 = coveredAt(px2, pz2);
          if ((t1 || t2) && !(u1 || u2)) y1 = UC;          // both sides open above (or one open, one normal room): wall the whole height
          if ((t1 && u2) || (t2 && u1)) y1 = MC;           // the 2nd-floor box's own wall closes the upper part
        }
        const ops = w.ops.filter(op => op.c >= sa - .01 && op.c < sb + .01 || (si === 0 && op.c < sa) || (si === bounds.length - 2 && op.c >= sb));
        const o = { t, y0, y1, ops };
        if (ext) {
          const [ox, oz] = nrm[w.out], [qx, qz] = probe(ox * .6, oz * .6), overVoid = lv === 'U' && inTall(qx, qz);
          const STY = BM.style === 'batten';
          Object.assign(o, { out: w.out, outer: overVoid ? M.paint : lv === 'B' ? M.found : STY ? M.batten : M.stucco, skirt: lv === 'M' });
          if (STY && lv === 'M') Object.assign(o, w.out === '-z' ? { skirtMat: M.brick, skirtTop: MF + 1.5 } : { skirtMat: M.found, skirtTop: TF + .2 });
          if (overVoid) { o.y0 = MC; o.ops = []; } // the box's face drops to the main ceiling line, so the floor edge is covered
        }
        const a = sa - (si === 0 ? ex : 0), b = sb + (si === bounds.length - 2 ? ex : 0);
        if (horiz) wall(P, a, w.c, b, w.c, o); else wall(P, w.c, a, w.c, b, o);
      }
      if (lv === 'M' && !ext && w.rooms.some(q => q.type === 'garage') && !w.rooms.every(q => q.type === 'garage')) for (const op of w.ops) if (op.k === 'door') {
        const gar = w.rooms.find(q => q.type === 'garage'), gc = horiz ? gar.z + gar.d / 2 : gar.x + gar.w / 2, sgn = gc > w.c ? 1 : -1, n = 3, rise = (MF - GF) / n;
        op.b = MF; // door sits at house floor height; three steps climb to it from the garage
        for (let k = 1; k <= n; k++) { const top = GF + k * rise, n0 = w.c + sgn * t / 2, n1 = n0 + sgn * (n + 1 - k) * .95, a0 = op.c - op.w / 2 - .4, a1 = op.c + op.w / 2 + .4;
          if (horiz) box(P, a0, a1, GF, top, Math.min(n0, n1), Math.max(n0, n1), M.concrete, { walk: true }); else box(P, Math.min(n0, n1), Math.max(n0, n1), GF, top, a0, a1, M.concrete, { walk: true }); }
      }
    }
  }
  // roofs: top-most footprint per level, decomposed into big rectangles
  const up = rooms.filter(r => r.level === 'U' && !isOut(r)), main = rooms.filter(r => r.level === 'M' && (!isOut(r) || RT[r.type].covered));
  const balc = rooms.filter(r => r.level === 'U' && r.type === 'balcony');
  const upLike = up.concat(main.filter(isTall));
  const roofRects = [...rectCells(upLike).map(q => [q, UC])];
  const mainOnly = rectCells(main, .5, upLike.concat(balc)); // parts of the main floor not under the 2nd floor or a balcony
  roofRects.push(...mainOnly.map(q => [q, MC]));
  for (let [i, [[x0, x1, z0, z1], plate]] of roofRects.entries()) {
    plate += i * .03;
    const e = EXT / 2; x0 -= e; x1 += e; z0 -= e; z1 += e; // roof sits on the outer face of the walls
    if (BM.roof === 'flat') { box(G3.roof, x0 - .8, x1 + .8, plate, plate + .9, z0 - .8, z1 + .8, flatRoofMat); box(G3.roof, x0 - .85, x1 + .85, plate + .9, plate + 1.05, z0 - .85, z1 + .85, M.trim); }
    else hipRoof(G3.roof, { x0, x1, z0, z1, plate, pitch: BM.style === 'batten' ? 7 / 12 : 5 / 12, ov: 1.5, slopes: { n: true, e: true, s: true, w: true } });
  }
  // front gables (same pitch as the main roof, so each one dies into it a few feet back)
  for (const gb of BM.extras?.gables || []) hipRoof(G3.roof, { x0: gb.x0, x1: gb.x1, z0: gb.z0, z1: gb.z1, plate: gb.plate + .05, pitch: 7 / 12, ov: 1.2, slopes: { e: true, w: true }, wall: M.batten,
    gables: [{ edge: 'n', at: gb.z0 + 1.05 }, ...(gb.back ? [{ edge: 's', at: gb.z1 }] : [])] });
  // site: ground, street, driveway to the garage door, walk to the front door
  const all = rooms.filter(r => r.level !== 'B'); const minX = Math.min(...all.map(r => r.x), 0), maxX = Math.max(...all.map(r => r.x + r.w), 30), minZ = Math.min(...all.map(r => r.z), 0), maxZ = Math.max(...all.map(r => r.z + r.d), 30);
  const bsm = rooms.filter(r => r.level === 'B');
  if (!bsm.length) flat(G3.site, rect(-420, 420, -420, 420), [], 0, M.grass, { walk: true });
  else { // open the ground over the basement so stairs and cutaway views work
    const bb = { x: Math.min(minX, ...bsm.map(r => r.x)) - 1, z: Math.min(minZ, ...bsm.map(r => r.z)) - 1 }; bb.w = Math.max(maxX, ...bsm.map(r => r.x + r.w)) + 1 - bb.x; bb.d = Math.max(maxZ, ...bsm.map(r => r.z + r.d)) + 1 - bb.z;
    flat(G3.site, rect(-420, 420, -420, 420), [rect(bb.x, bb.x + bb.w, bb.z, bb.z + bb.d)], 0, M.grass, { walk: true });
    for (const [a0, a1, b0, b1] of rectCells([bb], .5, bsm)) flat(G3.site, rect(a0, a1, b0, b1), [], 0, M.grass, { walk: true });
  }
  const roadZ = minZ - 48;
  flat(G3.site, rect(-420, 420, roadZ - 26, roadZ), [], .03, M.asphalt, { walk: true });
  flat(G3.site, rect(-420, 420, roadZ, roadZ + 5), [], .05, M.concrete, { walk: true });
  const mw = planLevel('M'), fd = mw.find(w => w.front), gd = mw.find(w => w.garageDoor);
  if (gd && gd.axis === 'x' && gd.out === '-z') { const gops = gd.ops.filter(o => o.k === 'garage'), d0 = Math.min(...gops.map(o => o.c - o.w / 2)) - 1, d1 = Math.max(...gops.map(o => o.c + o.w / 2)) + 1;
    box(G3.site, d0, d1, 0, .12, roadZ, gd.c, M.concrete, { walk: true }); H3_DRIVE = [(d0 + d1) / 2, (roadZ + gd.c) / 2, Math.PI, 1];
    if (BM.style === 'batten') for (const lx of [d0 + .4, ...gops.slice(1).map((o, i) => (gops[i].c + gops[i].w / 2 + o.c - o.w / 2) / 2), d1 - .4]) { // coach lights
      box(G3.site, lx - .3, lx + .3, 6.2, 7.4, gd.c - EXT / 2 - .45, gd.c - EXT / 2, M.trim); box(G3.site, lx - .2, lx + .2, 6.4, 7.2, gd.c - EXT / 2 - .5, gd.c - EXT / 2 - .4, M.lamp); } }
  if (BM.style === 'batten') { // wood privacy fence round the back yard and a dark garden shed
    const fx0 = minX - 10, fx1 = maxX + 10, fz0 = minZ + 28, fz1 = maxZ + 36;
    const fence = (ax, c, a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); if (hi - lo < .5) return;
      if (ax === 'x') box(G3.site, lo, hi, .3, 6, c - .08, c + .08, M.fence, { solid: true }); else box(G3.site, c - .08, c + .08, .3, 6, lo, hi, M.fence, { solid: true });
      for (let t = lo; t <= hi + .01; t += 8) { const q = Math.min(t, hi); if (ax === 'x') box(G3.site, q - .2, q + .2, 0, 6.3, c - .2, c + .2, M.fence); else box(G3.site, c - .2, c + .2, 0, 6.3, q - .2, q + .2, M.fence); } };
    const wallAtZ = (z, side) => { const xs = rooms.filter(r => r.level === 'M' && !isOut(r) && z > r.z && z < r.z + r.d).flatMap(r => [r.x, r.x + r.w]); return xs.length ? (side < 0 ? Math.min(...xs) : Math.max(...xs)) : side < 0 ? minX : maxX; };
    fence('x', fz1, fx0, fx1); fence('z', fx0, fz0, fz1); fence('z', fx1, fz0, fz1); fence('x', fz0, fx0, wallAtZ(fz0, -1)); fence('x', fz0, wallAtZ(fz0, 1), fx1);
    const sx = fx1 - 12, sz = fz1 - 10; box(G3.site, sx, sx + 10, 0, .3, sz, sz + 8, M.concrete, { walk: true }); box(G3.site, sx, sx + 10, .3, 7.5, sz, sz + 8, M.batten, { solid: true });
    box(G3.site, sx + 3.5, sx + 6.5, .3, 6.8, sz - .05, sz, M.trim); hipRoof(G3.site, { x0: sx, x1: sx + 10, z0: sz, z1: sz + 8, plate: 7.5, pitch: 4 / 12, ov: .6, slopes: { n: true, e: true, s: true, w: true } }); }
  if (fd) { const op = fd.ops[0]; box(G3.site, op.c - 2, op.c + 2, 0, .1, roadZ, fd.c - .4, M.pavers, { walk: true }); box(G3.site, op.c - 3.5, op.c + 3.5, 0, MF - .35, fd.c - 4, fd.c - .3, M.concrete, { walk: true }); box(G3.site, op.c - 3.5, op.c + 3.5, 0, 1.0, fd.c - 5.2, fd.c - 4, M.concrete, { walk: true }); H3_FRONT = [op.c, fd.c - 14, Math.PI, 1]; }
  else H3_FRONT = [(minX + maxX) / 2, minZ - 14, Math.PI, 1];
  for (const [x, z, s] of [[minX - 18, minZ - 20, 1.1], [maxX + 18, minZ - 15, 1], [minX - 20, maxZ + 15, 1.2], [maxX + 22, maxZ + 10, 1]]) tree(x, z, s, G3.trees);
  // HUD data
  ROOMS3 = rooms.map(r => [rname(r), r.level, [[r.x, r.x + r.w, r.z, r.z + r.d]], [r.x + r.w / 2, r.z + r.d / 2, Math.PI]]);
  OUTLINE3 = { B: rooms.filter(r => r.level === 'B').map(r => rect(r.x, r.x + r.w, r.z, r.z + r.d)), M: main.map(r => rect(r.x, r.x + r.w, r.z, r.z + r.d)), U: up.map(r => rect(r.x, r.x + r.w, r.z, r.z + r.d)) };
  H3_WALK = walkables.slice(before);
}
let showFurnBuild = true;

// ---------- Auto-layout from a brief ----------
// Rows of rooms, each row touching a central hall so every room connects; the last room in a row stretches to square it off.
function autoLayout({ beds = 3, baths = 2, garage = 2, storeys = 2, office = true, basement = false }) {
  BID = 1; const rooms = [];
  const row = (lv, x0, z, d, items, total) => {
    let x = x0; const sum = items.reduce((s, it) => s + it[1], 0), grow = total ? Math.max(0, total - sum) : 0;
    items.forEach((it, i) => { const w = it[1] + (i === items.length - 1 ? grow : 0); if (w > .5) rooms.push(R(it[0], lv, x, x + w, z, z + d, it[2] || {})); x += w; });
    return x - x0; };
  const gW = garage ? (garage === 2 ? 22 : 13) : 0;
  const front = []; if (garage) front.push(['garage', gW]); front.push(['foyer', 8], ['living', 16], ['kitchen', 14], ['dining', 12]);
  const tot = row('M', 0, 0, 22, front);
  if (storeys === 1) {
    row('M', 0, 22, 5, basement ? [['stairs', 12], ['hall', 0]] : [['hall', 0]], tot);
    const b = []; for (let i = 0; i < beds; i++) b.push(i === 0 ? ['primary', 15] : ['bedroom', 12]);
    for (let i = 0; i < baths; i++) b.push(['bath', 9]); if (office) b.push(['office', 11]); b.push(['laundry', 8]);
    row('M', 0, 27, 14, b, tot);
  } else {
    row('M', 0, 22, 6, [...(garage ? [['mud', gW]] : []), ['stairs', 13], ['hall', 0]], tot);
    row('M', 0, 28, 12, [...(garage ? [['laundry', gW]] : [['laundry', 8]]), ['bath', 7, { name: 'Powder' }], office ? ['office', 12] : ['dining', 12, { name: 'Den' }], ['great', 0, { name: 'Family Room' }]], tot);
    const uw = tot - gW, ub = []; for (let i = 0; i < beds; i++) ub.push(i === 0 ? ['primary', 16] : ['bedroom', 12]);
    const nf = Math.max(1, Math.ceil(beds / 2));
    row('U', gW, 0, 15, ub.slice(0, nf), uw);
    row('U', gW, 15, 7, [['hall', 0]], uw);
    row('U', gW, 22, 6, [['stairs', 13], ['hall', 0]], uw);
    const bk = ub.slice(nf); for (let i = 0; i < Math.max(1, baths - 1); i++) bk.push(['bath', 9]); bk.push(['closet', 6, { name: 'Linen' }]);
    row('U', gW, 28, 12, bk, uw);
  }
  if (basement) { const s = rooms.find(r => r.level === 'M' && r.type === 'stairs'), mD = Math.max(...rooms.filter(r => r.level === 'M').map(r => r.z + r.d));
    rooms.push(R('stairs', 'B', s.x, s.x + s.w, s.z, s.z + s.d));
    if (s.x - gW > 3) rooms.push(R('rec', 'B', gW, s.x, 0, mD, { group: 'rec' }));
    rooms.push(R('rec', 'B', s.x + s.w, tot, 0, mD, { group: 'rec' })); rooms.push(R('storage', 'B', s.x, s.x + s.w, 0, s.z)); rooms.push(R('bath', 'B', s.x, s.x + s.w, s.z + s.d, mD)); }
  BM = normalizeStairs({ roof: BM.roof || 'hip', rooms });
}
