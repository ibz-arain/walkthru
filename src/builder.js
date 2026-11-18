
// =====================================================================
//  BUILDER — "My Design": an editable house made of rooms.
//  A room is a rectangle on a level (B / M / U), or a triangle, round room, or custom outline in that box.
//  Shared room edges are the walls,
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
// ---------- Floors ----------
// The basement, main and 2nd floor heights come from BM.levels (see core.js). On top of those a design can add any number
// of extra floors, BM.levels.extra = [{ id, name, rel (floor level, feet from the main floor), h (floor to ceiling) }]:
// floors above the 2nd, half levels in between (split entries) or levels below the basement. BM.levels.names renames floors.
// levelList() gives every floor as { id, name, y, h } sorted bottom to top. 'M' is always the ground floor (front door,
// garage, porches); floors below grade are basements. Stairs climb to the next floor up with rooms where they arrive.
const JOIST = 1.04; // floor structure between a ceiling and the floor above
const LV_DEFNAME = { B: 'Basement', M: 'Main floor', U: '2nd floor' };
function levelList(m = BM) {
  const L = levelsOf(m), mf = L.main, mc = mf + L.mainH, uf = mc + JOIST, bc = mf - 1.08, nm = id => L.names?.[id] || LV_DEFNAME[id];
  const out = [{ id: 'B', name: nm('B'), y: +(bc - L.baseH).toFixed(2), h: L.baseH }, { id: 'M', name: nm('M'), y: mf, h: L.mainH }, { id: 'U', name: nm('U'), y: +uf.toFixed(2), h: L.upH }];
  for (const e of Array.isArray(L.extra) ? L.extra : []) out.push({ id: e.id, name: e.name || e.id, y: +(mf + e.rel).toFixed(2), h: e.h, extra: true });
  return out.sort((a, b) => a.y - b.y);
}
const DEFAULT_LEVELS = levelList({});
const lvOf = id => levelList().find(l => l.id === id);
// LV_Y / LV_C / LV_NAME read the current design (applyLevels' Object.assign onto them is harmless)
const LV_Y = new Proxy({}, { get: (_, k) => lvOf(k)?.y }), LV_C = new Proxy({}, { get: (_, k) => { const l = lvOf(k); return l ? l.y + l.h : undefined; } });
const LV_NAME = new Proxy({}, { get: (_, k) => lvOf(k)?.name || String(k) });
const levelIds = () => levelList().map(l => l.id);
const levelAbove = id => { const L = levelList(), i = L.findIndex(l => l.id === id); return i >= 0 && i < L.length - 1 ? L[i + 1].id : null; };
const levelBelow = id => { const L = levelList(), i = L.findIndex(l => l.id === id); return i > 0 ? L[i - 1].id : null; };
const levelsAbove = id => { const L = levelList(), i = L.findIndex(l => l.id === id); return i < 0 ? [] : L.slice(i + 1).map(l => l.id); };
const belowGrade = id => (LV_Y[id] ?? 0) < 0;
const upperLevel = id => id !== 'M' && !belowGrade(id); // any floor above grade other than the main floor
// the floor someone standing at height y is on: the highest floor at or below their feet (with a little slack for stairs)
const levelAtY = y => { let id = levelList()[0].id; for (const l of levelList()) if (y >= l.y - .6) id = l.id; return id; };
function editLevels(fn) { const L = { ...(BM.levels || {}) }; L.extra = (L.extra || []).map(e => ({ ...e })); L.names = { ...(L.names || {}) }; fn(L); if (!L.extra?.length) delete L.extra; if (!Object.keys(L.names || {}).length) delete L.names; BM.levels = L; applyLevels(BM); }
// A floor's ceiling height changed: extra floors stacked on it move with it (below grade, the ones under it drop instead).
function setLevelHeight(id, h) {
  const l = lvOf(id); if (!l) return; const d = +(h - l.h).toFixed(2); if (!d) return;
  const down = l.y < 0 && id !== 'M', top = l.y + l.h, mf = LV_Y.M;
  editLevels(L => {
    for (const e of L.extra) { if (e.id === id) continue; const y = mf + e.rel; if (down ? y <= l.y + .01 : y >= top - .01) e.rel = +(e.rel + (down ? -d : d)).toFixed(2); }
    if (id === 'B') L.baseH = h; else if (id === 'M') L.mainH = h; else if (id === 'U') L.upH = h; else { const e = L.extra.find(q => q.id === id); e.h = h; if (down) e.rel = +(e.rel - d).toFixed(2); }
  });
}
function addLevel(where, ref) { // where: 'top' | 'bottom' | 'half' (between ref and the floor above it)
  let id = 'L1'; for (let i = 1; levelIds().includes(id = 'L' + i); i++);
  const L = levelList(), top = L[L.length - 1], bot = L[0], mf = LV_Y.M; let e;
  if (where === 'top') e = { id, name: `${ordinal(L.filter(q => q.y > 0).length + 1)} floor`, rel: top.y + top.h + JOIST - mf, h: 8 };
  else if (where === 'bottom') e = { id, name: 'Lower basement', rel: bot.y - JOIST - 8 - mf, h: 8 };
  else { const r = lvOf(ref) || lvOf('M'), up = L[L.indexOf(L.find(q => q.id === r.id)) + 1], y = up ? (r.y + up.y) / 2 : r.y + (r.h + JOIST) / 2;
    e = { id, name: up ? `Half level (${r.name} ↕ ${up.name})` : `Half level above ${r.name}`, rel: y - mf, h: 8 }; }
  e.rel = +e.rel.toFixed(2); editLevels(L2 => L2.extra.push(e)); return id;
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
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
// grey fieldstone (House 4 style): random-height courses in greys and warm tans
TX.fstone = ctex(512, 5, (g, s, r) => { g.fillStyle = '#6e6a64'; g.fillRect(0, 0, s, s); let y = 0;
  while (y < s) { const h = Math.min(s - y, 46 + r() * 44 | 0); let x = -r() * 120;
    while (x < s) { const w = 90 + r() * 140, t = r(), hue = t < .14 ? 30 : t < .3 ? 210 : 40, sat = t < .14 ? 16 : t < .3 ? 5 : 4 + r() * 6, l = t < .3 && t >= .14 ? 40 + r() * 14 | 0 : 60 + r() * 22 | 0;
      g.fillStyle = `hsl(${hue},${sat}%,${l}%)`; g.fillRect(x + 3, y + 3, w - 5, h - 5);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 3, y + 3, w - 5, 3); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 3, y + h - 6, w - 5, 3);
      for (let k = 0; k < 40; k++) { const q = l + (r() - .5) * 20 | 0; g.fillStyle = `hsla(${hue},${sat}%,${q}%,.5)`; g.fillRect(x + 3 + r() * (w - 8), y + 3 + r() * (h - 8), 3, 3); }
      x += w; }
    y += h; } }, 53);
TX.dsiding = ctex(256, 3, (g, s, r) => { noise(g, s, r, 150, 14, 5000, 2); for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * s / 12, s, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, i * s / 12 + 2, s, 2); } }, 59);
Object.assign(M, { fstone: std({ map: TX.fstone, color: '#ffffff', roughness: .95 }), dsiding: std({ map: TX.dsiding, color: '#8a927f', roughness: .8, side: THREE.DoubleSide }),
  gdoor2: std({ color: '#d9d9d5', roughness: .55 }), gravel: std({ map: TX.concrete, color: '#8b8d90', roughness: 1 }), curb: std({ color: '#a8a8a4', roughness: .9 }), flowers: [std({ color: '#d9507a', roughness: 1 }), std({ color: '#e8a23a', roughness: 1 }), std({ color: '#f1f1ea', roughness: 1 })] });
// modern style: each volume picks its own cladding (r.clad)
TX.cedar = ctex(256, 3, (g, s, r) => { for (let i = 0; i < 10; i++) { const v = 150 + r() * 50 | 0; g.fillStyle = `rgb(${v},${v * .72 | 0},${v * .5 | 0})`; g.fillRect(i * s / 10, 0, s / 10, s);
  for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(80,45,20,${.08 + r() * .1})`; g.fillRect(i * s / 10 + r() * s / 10, 0, 1.5, s); } g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(i * s / 10, 0, 2, s); } }, 61);
const DS2 = { side: THREE.DoubleSide }; // gable ends are drawn as single faces: cladding must show from both sides
Object.assign(M, { cedar: std({ map: TX.cedar, color: '#ffffff', roughness: .7, ...DS2 }), panel: std({ map: TX.seam, color: '#3a3c40', roughness: .55, metalness: .3, ...DS2 }), render: std({ map: TX.stucco, color: '#f6f5f1', roughness: .9, ...DS2 }),
  limeW: std({ map: TX.limestone, color: '#efebe3', roughness: .9, ...DS2 }), wood2: std({ map: TX.cedar, color: '#ffffff', roughness: .7 }), poolTile: std({ color: '#2f7fa3', roughness: .3 }), soffitM: std({ color: '#ecebe7', roughness: .8, side: THREE.DoubleSide }), panelSlat: std({ color: '#33363a', roughness: .6 }), gdoorDark: std({ color: '#5a5e63', roughness: .55, metalness: .1 }), seamRoof: std({ map: TX.seam, color: '#26282b', roughness: .75, metalness: .1, side: THREE.DoubleSide }) });
const CLAD = () => ({ cedar: M.cedar, dark: M.panel, render: M.render, stone: M.limeW, fstone: M.fstone });
let BM;
try { BM = JSON.parse(localStorage.getItem('walkthru-builder-v1') || 'null'); } catch (e) { }
if (!BM || !Array.isArray(BM.rooms)) BM = starterPlan();

// Several saved designs: { cur, list: [{ id, name, bm }] }. The first one picks up whatever was saved before.
let DS = null;
try { DS = JSON.parse(localStorage.getItem('walkthru-designs-v1') || 'null'); } catch (e) { }
if (!DS || !Array.isArray(DS.list) || !DS.list.length) DS = { cur: 1, list: [{ id: 1, name: 'My design', bm: BM }] };
{ const d = DS.list.find(x => x.id === DS.cur) || DS.list[0]; DS.cur = d.id; BM = d.bm && Array.isArray(d.bm.rooms) ? d.bm : starterPlan(); }
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
// A door's size and place along its wall: the defaults, or what was set for that wall in the plan editor (BM.ops).
function opAt(w, key, defW, defH) { const o = BM.ops?.[key] || {}, L = w.b - w.a, ww = Math.max(2, Math.min(o.w || defW, L - .5)), h = Math.max(6, Math.min(o.h || defH, 9.5));
  const c = o.pos == null ? (w.a + w.b) / 2 : Math.max(w.a + ww / 2 + .25, Math.min(w.b - ww / 2 - .25, w.a + o.pos * L)); return { c, w: ww, h, o }; }
// Outside doors: the style picks the kind of unit; single doors can hinge either side and swing out.
const extDoorOp = (o, def) => { const st = o.o.style; return { k: st === 'slider' ? 'slider' : st === 'double' || st === 'french' ? 'front' : st === 'single' ? 'extdoor' : def, style: st, hinge: o.o.hinge, outSwing: !!o.o.out, color: o.o.color }; };
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
// ---------- Room outlines: rectangle, right triangle, ellipse, or a custom polygon ----------
// Custom points are stored in feet from the room's origin (r.pts). Triangle and round are drawn from the width and depth.
const SHAPE_SEG = 16;
function roomPoly(r) {
  if (!r || r.shape === 'round') return r?.shape === 'round' ? roundPoly(r) : null;
  if (r.shape === 'tri') return triPoly(r);
  if (r.shape === 'poly' && r.pts?.length >= 3) return r.pts.map(([u, v]) => [r.x + u, r.z + v]);
  return null;
}
function roundPoly(r) {
  const cx = r.x + r.w / 2, cz = r.z + r.d / 2, rx = r.w / 2, rz = r.d / 2, pts = [];
  for (let i = 0; i < SHAPE_SEG; i++) { const t = -Math.PI / 2 + i * 2 * Math.PI / SHAPE_SEG; pts.push([+(cx + Math.cos(t) * rx).toFixed(3), +(cz + Math.sin(t) * rz).toFixed(3)]); }
  return pts;
}
function triPoly(r) {
  const x = r.x, z = r.z, x1 = r.x + r.w, z1 = r.z + r.d;
  return [[[x, z], [x1, z], [x, z1]], [[x1, z], [x1, z1], [x, z]], [[x1, z1], [x, z1], [x1, z]], [[x, z1], [x, z], [x1, z1]]][(r.spin || 0) % 4];
}
function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; a += x0 * z1 - x1 * z0; } return Math.abs(a) / 2; }
function polyCentroid(pts) {
  let x = 0, z = 0, a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], c = x0 * z1 - x1 * z0; a += c; x += (x0 + x1) * c; z += (z0 + z1) * c; }
  if (Math.abs(a) < 1e-6) return [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
  return [x / (3 * a), z / (3 * a)];
}
const roomArea = r => { const p = roomPoly(r); return p ? polyArea(p) : r.w * r.d; };
function pointInPoly(x, z, pts) {
  let inn = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi) inn = !inn;
  }
  return inn;
}
function insideRoom(r, x, z) {
  if (x <= r.x || x >= r.x + r.w || z <= r.z || z >= r.z + r.d) return false;
  const p = roomPoly(r); return p ? pointInPoly(x, z, p) : true;
}
function fitShapeBox(r) {
  if (r.shape !== 'poly' || r.pts?.length < 3) return;
  const abs = r.pts.map(([u, v]) => [r.x + u, r.z + v]);
  const x0 = Math.min(...abs.map(p => p[0])), z0 = Math.min(...abs.map(p => p[1])), x1 = Math.max(...abs.map(p => p[0])), z1 = Math.max(...abs.map(p => p[1]));
  r.x = +x0.toFixed(2); r.z = +z0.toFixed(2); r.w = +(x1 - x0).toFixed(2); r.d = +(z1 - z0).toFixed(2);
  r.pts = abs.map(([x, z]) => [+(x - r.x).toFixed(2), +(z - r.z).toFixed(2)]);
}
function edgeOut(poly, p, q) {
  const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz) || 1, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
  let nx = -dz / len, nz = dx / len;
  if (pointInPoly(mx + nx * .35, mz + nz * .35, poly)) { nx = -nx; nz = -nz; }
  return [nx, nz, mx, mz, len];
}
function bboxEdges(r) {
  return [
    { side: 'n', axis: 'x', c: r.z, a: r.x, b: r.x + r.w, out: '-z' }, { side: 's', axis: 'x', c: r.z + r.d, a: r.x, b: r.x + r.w, out: '+z' },
    { side: 'w', axis: 'z', c: r.x, a: r.z, b: r.z + r.d, out: '-x' }, { side: 'e', axis: 'z', c: r.x + r.w, a: r.z, b: r.z + r.d, out: '+x' }];
}
function edgesOf(r) {
  const poly = roomPoly(r);
  if (!poly || r.shape === 'round') return poly ? [] : bboxEdges(r);
  const edges = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    if (len < .4) continue;
    const horiz = Math.abs(dz) < .08, vert = Math.abs(dx) < .08; if (!horiz && !vert) continue;
    const [nx, nz] = edgeOut(poly, p, q), side = horiz ? (nz > 0 ? 's' : 'n') : (nx > 0 ? 'e' : 'w'), out = horiz ? (nz > 0 ? '+z' : '-z') : (nx > 0 ? '+x' : '-x');
    edges.push({ side, axis: horiz ? 'x' : 'z', c: horiz ? (p[1] + q[1]) / 2 : (p[0] + q[0]) / 2, a: horiz ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]), b: horiz ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]), out, idx: r.shape === 'poly' ? [i, (i + 1) % poly.length] : null });
  }
  return edges;
}
const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
const extKey = (r, out) => `${r.id}:${out}`;
const extMode = (r, out) => BM.ext?.[extKey(r, out)] || 'auto';
// Railing on an open edge of a catwalk, deck or balcony: set per stretch (key with where it starts) or for the whole room; glass if unset.
const railKey = (r, out, a) => `${r.id}:${out}:${(+a).toFixed(1)}`;
// the stretches of a room's side that are open (not against another indoor room): where its railing runs
function railSegments(R, out) { const e = edgesOf(R).find(x => x.out === out); if (!e) return [];
  return sub1d([e.a, e.b], BM.rooms.filter(o => o.level === R.level && !isOut(o) && o !== R).flatMap(o => { const f = edgesOf(o).find(x => x.side === OPP[e.side]); return f && Math.abs(f.c - e.c) < EPS ? [[f.a, f.b]] : []; })); }
const railFor = (r, out, a) => BM.rails?.[railKey(r, out, a)] ?? BM.rails?.[`${r.id}:*`] ?? 'glass';
const pairKey = (a, b) => a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
const wallMode = (a, b) => BM.walls?.[pairKey(a, b)] || (openPair(a, b) ? 'open' : doorPair(a, b) ? 'door' : 'wall');
// Close slivers of "outside" between rooms that almost touch: stretch the given rooms to meet their neighbours.
function closeGaps(ids, maxGap = 1.5) {
  let n = 0;
  for (const R of BM.rooms.filter(r => !ids || ids.includes(r.id))) for (const O of BM.rooms) {
    if (O === R || O.level !== R.level || roomPoly(R) || roomPoly(O)) continue;
    const zo = Math.min(R.z + R.d, O.z + O.d) - Math.max(R.z, O.z), xo = Math.min(R.x + R.w, O.x + O.w) - Math.max(R.x, O.x);
    if (zo > 1) { let g = O.x - (R.x + R.w); if (g > .05 && g <= maxGap) { R.w = +(R.w + g).toFixed(2); n++; }
      g = R.x - (O.x + O.w); if (g > .05 && g <= maxGap) { R.x = +(O.x + O.w).toFixed(2); R.w = +(R.w + g).toFixed(2); n++; } }
    if (xo > 1) { let g = O.z - (R.z + R.d); if (g > .05 && g <= maxGap) { R.d = +(R.d + g).toFixed(2); n++; }
      g = R.z - (O.z + O.d); if (g > .05 && g <= maxGap) { R.z = +(O.z + O.d).toFixed(2); R.d = +(R.d + g).toFixed(2); n++; } }
  }
  return n;
}
// Basement windows: small ones up under the joists while the basement is deep in the ground; once enough of it stands
// above grade (raised or bi-level houses) they become proper windows from just above the ground to the top of the foundation.
function shapeCutsOn(e, lv) {
  const cuts = [];
  for (const r of BM.rooms) {
    if (r.level !== lv || isOut(r) || !roomPoly(r)) continue;
    const poly = roomPoly(r);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if (e.axis === 'x' && Math.abs(p[1] - e.c) < EPS && Math.abs(q[1] - e.c) < EPS) cuts.push([Math.min(p[0], q[0]), Math.max(p[0], q[0])]);
      if (e.axis === 'z' && Math.abs(p[0] - e.c) < EPS && Math.abs(q[0] - e.c) < EPS) cuts.push([Math.min(p[1], q[1]), Math.max(p[1], q[1])]);
    }
  }
  return cuts;
}
function addShapeWalls(lv, walls) {
  const outs = BM.rooms.filter(r => r.level === lv && isOut(r));
  for (const A of BM.rooms) {
    if (A.level !== lv || isOut(A) || !roomPoly(A)) continue;
    const poly = roomPoly(A);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], [nx, nz, mx, mz, len] = edgeOut(poly, p, q);
      if (len < .3) continue;
      const neighbor = BM.rooms.find(o => o !== A && o.level === lv && !isOut(o) && insideRoom(o, mx + nx * .55, mz + nz * .55));
      if (neighbor && (wallMode(A, neighbor) === 'open' || A.id > neighbor.id)) continue;
      const horiz = Math.abs(q[1] - p[1]) < .08, vert = Math.abs(q[0] - p[0]) < .08;
      const out = Math.abs(nx) > Math.abs(nz) ? (nx > 0 ? '+x' : '-x') : (nz > 0 ? '+z' : '-z');
      if ((horiz || vert) && len > .4) {
        const c = horiz ? (p[1] + q[1]) / 2 : (p[0] + q[0]) / 2, a = horiz ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]), b = horiz ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]);
        if (neighbor) walls.push({ ext: false, axis: horiz ? 'x' : 'z', c, a, b, rooms: [A, neighbor], ops: [], door: wallMode(A, neighbor) === 'door' });
        else if (extMode(A, out) !== 'open') {
          const off = { '-z': [0, -.6], '+z': [0, .6], '-x': [-.6, 0], '+x': [.6, 0] }[out], px = horiz ? (a + b) / 2 : c + off[0], pz = horiz ? c + off[1] : (a + b) / 2;
          walls.push({ ext: true, axis: horiz ? 'x' : 'z', c, a, b, out, room: A, ops: [], toOut: outs.find(o => insideRoom(o, px, pz)) });
        }
        continue;
      }
      if (!neighbor && extMode(A, out) === 'open') continue;
      const cardinal = Math.max(Math.abs(nx), Math.abs(nz)) > .96;
      walls.push({ angled: true, x0: p[0], z0: p[1], x1: q[0], z1: q[1], nx, nz, ext: !neighbor, room: A, out, ops: [], win: !neighbor && !!RT[A.type]?.win && (A.shape === 'round' ? cardinal : len >= 6) });
    }
  }
}
function baseWin(c, L, lv = 'B') { const fl = LV_Y[lv], ceil = LV_C[lv], top = Math.min(TF, ceil + JOIST), exposed = top - .3; if (exposed < 3.2) return { c, w: 3.5, b: ceil - 2.2, h: 1.6 };
  const sill = Math.max(.6, fl + 2.5); return { c, w: Math.min(5, L - 1.5), b: sill, h: top - .3 - sill }; }
function planLevel(lv) {
  const rs = BM.rooms.filter(r => r.level === lv && !isOut(r)), outs = BM.rooms.filter(r => r.level === lv && isOut(r)), walls = [];
  for (const A of rs) { if (roomPoly(A)) continue; for (const e of edgesOf(A)) {
    const shared = [];
    for (const B of rs) { if (B === A || roomPoly(B)) continue; const f = edgesOf(B).find(x => x.side === OPP[e.side]);
      if (!f || Math.abs(f.c - e.c) > EPS) continue; const s0 = Math.max(e.a, f.a), s1 = Math.min(e.b, f.b); if (s1 - s0 > .3) shared.push([s0, s1, B]); }
    for (const [a, b] of sub1d([e.a, e.b], shared.concat(shapeCutsOn(e, lv)))) {
      const m = (a + b) / 2, off = { '-z': [0, -.6], '+z': [0, .6], '-x': [-.6, 0], '+x': [.6, 0] }[e.out], px = e.axis === 'x' ? m : e.c + off[0], pz = e.axis === 'x' ? e.c + off[1] : m;
      const toOut = outs.find(o => insideRoom(o, px, pz));
      if (A.type === 'bridge') { walls.push({ rail: true, kind: railFor(A, e.out, a), out: e.out, axis: e.axis, c: e.c, a, b, room: A, ops: [] }); continue; } // catwalk edges get railings (or not: per stretch)
      walls.push({ ext: true, axis: e.axis, c: e.c, a, b, out: e.out, room: A, ops: [], toOut });
    }
    for (const [a, b, B] of shared) if (A.id < B.id) {
      const mode = BM.walls?.[pairKey(A, B)];
      if (mode ? mode === 'open' : openPair(A, B)) continue;
      walls.push({ ext: false, axis: e.axis, c: e.c, a, b, rooms: [A, B], ops: [], door: mode ? mode === 'door' : doorPair(A, B) });
    }
  } }
  addShapeWalls(lv, walls);
  // openings
  let frontDone = lv !== 'M';
  const frontCands = walls.filter(w => !w.angled && w.ext && w.out === '-z' && extMode(w.room, w.out) === 'auto' && (RT[w.room.type]?.entry || w.room.type === 'living' || w.room.type === 'great') && w.b - w.a >= 4).sort((p, q) => (RT[q.room.type]?.entry ? 1 : 0) - (RT[p.room.type]?.entry ? 1 : 0) || (q.b - q.a) - (p.b - p.a));
  if (!frontDone && frontCands[0]) { const w = frontCands[0], L = w.b - w.a, o = opAt(w, extKey(w.room, w.out), L >= 7.5 ? 5.67 : 3, 8); w.ops.push({ c: o.c, w: o.w, b: LV_Y.M, h: o.h, ...extDoorOp(o, o.w >= 5 ? 'front' : 'extdoor') }); w.front = true; frontDone = true; }
  const gUsed = new Set();
  walls.sort((p, q) => (q.out === '-z') - (p.out === '-z'));
  for (const w of walls) {
    if (w.angled) continue;
    const L = w.b - w.a, mid = (w.a + w.b) / 2, y = LV_Y[lv];
    if (!w.ext) { if (w.door && L >= 2.9) { const o = opAt(w, pairKey(...w.rooms), Math.min(2.67, L - .5), 6.67); w.ops.push({ c: o.c, w: o.w, b: y, h: o.h, k: 'door', sw: o.o.flip ? -1 : 1, hinge: o.o.hinge, style: o.o.style, color: o.o.color }); } continue; }
    if (w.front) continue;
    const xm = extMode(w.room, w.out);
    if (xm === 'solid') continue;
    if (xm === 'open') { w.open = true; continue; } // no wall: the room is open to the outside here
    if (w.toOut && xm === 'auto' && L >= 3.2 && !RT[w.room.type]?.garage) { const big = L >= 8; w.ops.push({ c: mid, w: big ? 6 : 3, b: y, h: big ? 7.5 : 6.67, k: big ? 'slider' : 'extdoor' }); continue; }
    if (xm === 'door' && L >= 3.2) { const o = opAt(w, extKey(w.room, w.out), 3, 6.67); w.ops.push({ c: o.c, w: o.w, b: lv === 'M' && w.room.type === 'garage' ? GF : y, h: o.h, ...extDoorOp(o, o.w >= 5.5 ? 'slider' : 'extdoor') }); continue; }
    if (xm === 'window' && !belowGrade(lv) && L >= 3.5) { const ov = BM.ops?.[extKey(w.room, w.out)] || {}, n = Math.max(1, Math.min(8, ov.n || Math.min(3, Math.floor(L / 7)))), ww = Math.max(1.5, Math.min(ov.w || 4.5, L / n - .8)), hh = Math.min(ov.h || (lv === 'M' ? 6 : 5), 8.6 - (ov.sill ?? 2.3)), sill = ov.sill ?? 2.3;
      for (let i = 0; i < n; i++) { const c = n === 1 && ov.pos != null ? Math.max(w.a + ww / 2 + .3, Math.min(w.b - ww / 2 - .3, w.a + ov.pos * L)) : w.a + L * (i + .5) / n; w.ops.push({ c, w: ww, b: y + sill, h: hh, style: ov.style, lites: ov.style === 'grid' }); } continue; }
    if (xm === 'window' && belowGrade(lv) && L >= 4) { w.ops.push(baseWin(mid, L, lv)); continue; }
    const T = RT[w.room.type] || {};
    if (T.garage && lv === 'M' && BM.style === 'modern' && w.out === '-z' && L >= 18 && !gUsed.has(w.room.group || w.room.id)) { w.ops.push({ c: (w.a + w.b) / 2, w: 16, b: GF, h: 8, k: 'garage', fm: M.gdoorDark, plain: true }); gUsed.add(w.room.group || w.room.id); w.garageDoor = true; continue; }
    if (T.garage && lv === 'M' && BM.style === 'stone' && w.out === '-z' && L >= 18 && !gUsed.has(w.room.group || w.room.id)) { // two single doors with a stone pier between
      w.ops.push({ c: w.a + L * .26, w: 8.5, b: GF, h: 8, k: 'garage', fm: M.gdoor2 }, { c: w.b - L * .26, w: 8.5, b: GF, h: 8, k: 'garage', fm: M.gdoor2 }); gUsed.add(w.room.group || w.room.id); w.garageDoor = true; continue; }
    if (T.garage && lv === 'M' && BM.style === 'batten' && w.out === '-z' && L >= 26 && !gUsed.has(w.room.group || w.room.id)) { // triple garage: single + double door, brick pier between
      w.ops.push({ c: w.a + 6.1, w: 9, b: GF, h: 8, k: 'garage', top: 1, fm: M.gdoor }, { c: w.b - 10.2, w: 16, b: GF, h: 8, k: 'garage', top: 1, fm: M.gdoor }); gUsed.add(w.room.group || w.room.id); w.garageDoor = true; continue; }
    if (T.garage && lv === 'M') { const key = w.room.group || w.room.id; if (L >= 10 && !gUsed.has(key) && (w.out === '-z' || L >= 16)) { const gw = L >= 18.5 ? 16 : 9; w.ops.push({ c: mid, w: gw, b: GF, h: 8, k: 'garage' }); gUsed.add(key); w.garageDoor = true; } continue; }
    if (belowGrade(lv)) { if (L >= 5 && (T.win || T.private)) w.ops.push(baseWin(mid, L, lv)); continue; }
    if (T.small) { if (L >= 4) w.ops.push({ c: mid, w: 2.5, b: y + 4.2, h: 3 }); continue; }
    if (T.win && L >= 4.5) { const n = Math.max(1, Math.min(3, Math.floor(L / 7))), ww = Math.min(4.5, L / n - 1.6);
      const inPt = c => { const d = { '-z': [0, .8], '+z': [0, -.8], '-x': [.8, 0], '+x': [-.8, 0] }[w.out]; return w.axis === 'x' ? [c, w.c + d[1]] : [w.c + d[0], c]; };
      for (let i = 0; i < n; i++) { const c = w.a + L * (i + .5) / n, tallWin = w.room.tall && [-ww / 2, 0, ww / 2].every(k => inTall(lv, ...inPt(c + k)));
        w.ops.push({ c, w: ww, b: y + (tallWin ? 1.5 : 2.3), h: tallWin ? 14 : lv === 'M' ? 6 : 5 }); } }
  }
  return walls;
}

// ---------- 3D groups ----------
const HOUSE3 = new THREE.Group(); scene.add(HOUSE3); HOUSE3.visible = false;
const G3 = {};
for (const k of ['basement', 'basementCeil', 'main', 'mainCeil', 'upper', 'upperCeil', 'roof', 'furnB', 'furnM', 'furnU', 'site', 'trees']) { G3[k] = new THREE.Group(); HOUSE3.add(G3[k]); }
// each floor's groups: walls and floors, ceilings (hidden in cutaway views), furniture. Extra floors get groups on first use.
const LG_FIX = { B: ['basement', 'basementCeil', 'furnB'], M: ['main', 'mainCeil', 'furnM'], U: ['upper', 'upperCeil', 'furnU'] };
function LG(id) { const k = LG_FIX[id] || [`lv_${id}`, `lvCeil_${id}`, `furn_${id}`]; for (const n of k) if (!G3[n]) { G3[n] = new THREE.Group(); HOUSE3.add(G3[n]); } return { g: G3[k[0]], ceil: G3[k[1]], furn: G3[k[2]] }; }
let H3_LOT = null, ROOMS3 = [], OUTLINE3 = { B: [], M: [], U: [] }, H3_WALK = [], H3_FRONT = [15, -20, Math.PI, 1], H3_DRIVE = [45, -30, Math.PI, 1];
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
// Double height stays a main-floor feature: it opens into the 2nd floor (extra floors and half levels don't change that).
const tallInto = lv => lv === 'M' ? 'U' : null;
const upSolid = lv => { const up = tallInto(lv); return up ? BM.rooms.filter(u => u.level === up && u.type !== 'bridge' && u.type !== 'balcony') : []; };
const coveredAt = (lv, x, z) => upSolid(lv).some(u => x > u.x && x < u.x + u.w && z > u.z && z < u.z + u.d);
const canTall = lv => !!tallInto(lv);
const tallParts = r => canTall(r.level) ? rectCells([r], .5, upSolid(r.level)) : [];   // the open (double-height) parts of a room
const isTall = r => r.tall && tallParts(r).length > 0;   // at least part of it is open above
const fullyTall = r => isTall(r) && !upSolid(r.level).some(u => ovl(u, r));
const inTall = (lv, x, z) => canTall(lv) && !coveredAt(lv, x, z) && BM.rooms.some(r => r.level === lv && r.tall && insideRoom(r, x, z));
// ---------- Stairs layer ----------
// Staircases are their own objects (BM.stairs), sitting inside rooms: they don't take a room slot, make walls or change connections.
// S = { id, level (where it starts), to? (the floor it climbs to; missing = automatic), cx, cz (centre), W (width), L (run length), dir? ('+x','+z','-x','-z'; missing = automatic) }
function stairsOn(lv) { return (BM.stairs || []).filter(s => s.level === lv); }
function stairRect(S, dir) { const ax = dir[1] === 'x', w = ax ? S.L : S.W, d = ax ? S.W : S.L; return { x: S.cx - w / 2, z: S.cz - d / 2, w, d }; }
// Where a flight goes: the floor picked for it (S.to), else the next floor up with rooms around its top (so a half level off to
// one side doesn't capture the main stair), else simply the next floor up.
function stairUp(S) {
  const ups = levelsAbove(S.level); if (!ups.length) return null; if (S.to && ups.includes(S.to)) return S.to;
  const r = Math.max(S.L, S.W) / 2 + 2.5, box = { x: S.cx - r, z: S.cz - r, w: 2 * r, d: 2 * r };
  return ups.find(l => BM.rooms.some(o => o.level === l && !isOut(o) && ovl(o, box))) || ups[0];
}
const stairBelow = S => levelBelow(S.level);
function roomAt3(lv, x, z) { return BM.rooms.find(o => o.level === lv && !isOut(o) && insideRoom(o, x, z)); }
// Stair shapes: straight, U-turn (two flights side by side with a flat landing) or curved (the flights joined by a half-circle of
// winder steps). Turning stairs climb up one half of their box, turn at the far end and arrive back beside where they started.
const STAIR_SHAPES = ['auto', 'straight', 'u', 'curved'];
function turnTop(S, dir) { // where a turning stair arrives: just past its starting end, on the second half
  const r = stairRect(S, dir), s = dir[0] === '+' ? 1 : -1, ax = dir[1] === 'x', lo = ax ? (s > 0 ? r.x : r.x + r.w) : (s > 0 ? r.z : r.z + r.d), c2 = ax ? r.z + r.d * .75 : r.x + r.w * .75;
  return ax ? [lo - 2 * s, c2] : [c2, lo - 2 * s]; }
const stairShape = S => { // Auto: curved when the box is wide enough and the turn lands on 2nd-floor floor, otherwise straight
  if (S.shape && S.shape !== 'auto') return S.shape; if (belowGrade(S.level) || !(S.W >= 5.5 && S.L >= 8)) return 'straight'; // Auto keeps basement flights straight; pick a shape to turn them
  const dirs = S.dir ? [S.dir] : STAIR_DIRS;
  return dirs.some(d => roomAt3(stairUp(S), ...turnTop(S, d))) ? 'curved' : 'straight'; };
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
  const near = lv => lv ? stairsOn(lv).find(o => o !== S && Math.hypot(o.cx - S.cx, o.cz - S.cz) < 3) : null;
  // a basement flight under the stair above follows it: the same way under a straight flight (so it runs underneath with headroom
  // all the way down, and the upper flight never starts over the opening), unless that would start it against a wall
  if (belowGrade(S.level)) { const m = near(stairUp(S)); if (m) { const d = stairDirOf(m); if (turns(m)) return OPP_DIR[d]; return stairScore(S, d) >= stairScore(S, OPP_DIR[d]) ? d : OPP_DIR[d]; } } /* stacked over basement stairs: both entrances together */
  let best = '+x', bs = -1; for (const d of STAIR_DIRS) { const sc = stairScore(S, d); if (sc > bs) { bs = sc; best = d; } } return best; }
function stairPair(S) { const mine = stairRect(S, stairDirOf(S)), other = belowGrade(S.level) ? stairUp(S) : stairBelow(S); return other ? stairsOn(other).find(o => ovl(stairRect(o, stairDirOf(o)), mine)) : null; }
function stairStatus(S) {
  const dir = stairDirOf(S), e = stairEnds(S, dir), up = stairUp(S);
  if (!up) return { msg: 'No floor above: add one under Floors', dir };
  if (!BM.rooms.some(r => r.level === up)) return { msg: `Leads nowhere yet: add ${LV_NAME[up]} rooms above it`, dir };
  if (!roomAt3(up, ...e.top)) return { msg: `The top lands outside: put a ${LV_NAME[up]} room where it arrives`, dir };
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
  if (!BM.rooms.some(r => r.level === lv)) return [];
  return (BM.stairs || []).filter(s => stairUp(s) === lv).map(s => laneOf(s, 0)); } // every flight opens its whole box above (no automatic halving: stacked stairs keep the width you gave them)
function clearGroup(g) { for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.isMesh) o.geometry?.dispose(); }); } }
const floorMat = t => ({ wood: M.wood, tile: M.tile, carpet: M.carpet, concrete: M.concrete, lvp: M.lvp, deck: M.deck })[RT[t]?.floor] || M.wood;
// ---------- finishes per room (r.finish = { floor, paint, accent: { side, color } }) ----------
const _finMats = new Map();
function finMat(base, hex) { const k = base.uuid + hex; if (!_finMats.has(k)) { const m = base.clone(); m.color.set(hex); _finMats.set(k, m); } return _finMats.get(k); }
const _rfBase = {}; const rfBase = (map, rough) => _rfBase[map + rough] ||= std({ map: TX[map], color: '#ffffff', roughness: rough });
const RF = (name, map, rough, hex) => [name, () => rfBase(map, rough), hex];
const ROOM_FLOORS = { oak: RF('Light oak', 'wood', .6, '#e0c49c'), natural: RF('Natural oak', 'wood', .6, '#bf9364'), walnut: RF('Walnut', 'wood', .6, '#7a563c'), greyoak: RF('Grey oak', 'wood', .6, '#b9b2a8'),
  herring: RF('Herringbone oak', 'herring', .55, '#c9a273'), lvp: RF('Vinyl plank', 'wood', .6, '#b7a58c'), tile: RF('Light tile', 'tile', .35, '#e4e2dc'), darktile: RF('Dark tile', 'tile', .35, '#5b5f63'),
  bigtile: RF('Large tile', 'bigtile', .3, '#dcdad4'), mosaic: RF('Mosaic', 'mosaic', .3, '#e4e2dc'), marble: RF('Marble', 'marble', .15, '#f2f1ec'), slate: RF('Slate', 'slate', .7, '#8a8884'),
  terrazzo: RF('Terrazzo', 'terrazzo', .3, '#f0eee8'), carpet: RF('Carpet, oat', 'carpet', 1, '#cfc6b8'), carpetgrey: RF('Carpet, grey', 'carpet', 1, '#8f9296'), concrete: RF('Polished concrete', 'concrete', .35, '#b9b7b2') };
const floorFor = r => { const f = ROOM_FLOORS[r.finish?.floor]; return f ? finMat(f[1](), f[2]) : floorMat(r.type); };
const paintFor = (r, side) => { const F = r.finish || {}; const hex = side && F.accent?.side === side ? F.accent.color : F.paint; return hex ? finMat(M.paint, hex) : M.paint; };
// which side of room r a wall at coordinate c runs along
const sideOfRoom = (r, axis, c) => axis === 'x' ? (Math.abs(c - r.z) < Math.abs(c - (r.z + r.d)) ? 'n' : 's') : (Math.abs(c - r.x) < Math.abs(c - (r.x + r.w)) ? 'w' : 'e');
const likeOf = t => RT[t]?.like || t;
const isOut = r => !!RT[r.type]?.outdoor;
function rectCells(rooms, step = .5, minus = []) { // occupancy grid (rooms minus `minus`) → maximal rectangles, for roofs
  if (!rooms.length) return [];
  const x0 = Math.min(...rooms.map(r => r.x)), z0 = Math.min(...rooms.map(r => r.z));
  const X = Math.ceil((Math.max(...rooms.map(r => r.x + r.w)) - x0) / step), Z = Math.ceil((Math.max(...rooms.map(r => r.z + r.d)) - z0) / step);
  const g = new Uint8Array(X * Z);
  const stamp = (r, v) => { const poly = roomPoly(r); for (let i = Math.round((r.x - x0) / step); i < Math.round((r.x + r.w - x0) / step); i++) for (let j = Math.round((r.z - z0) / step); j < Math.round((r.z + r.d - z0) / step); j++) if (i >= 0 && j >= 0 && i < X && j < Z && (!poly || pointInPoly(x0 + (i + .5) * step, z0 + (j + .5) * step, poly))) g[j * X + i] = v; };
  for (const r of rooms) stamp(r, 1);
  for (const r of minus) stamp(r, 0);
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
    for (const e of edgesOf(A)) { const f = edgesOf(Bq).find(x => x.side === OPP[e.side]); if (!f || Math.abs(f.c - e.c) > EPS) continue; const a = Math.max(e.a, f.a), b = Math.min(e.b, f.b); if (b - a > .3 && b - a <= 10) add(e.axis, e.c, a, b, 2.4, -99); } }
  for (const S of stairsOn(lv)) { const r = stairRect(S, stairDirOf(S)); Z.push({ x0: r.x - 2.6, x1: r.x + r.w + 2.6, z0: r.z - 2.6, z1: r.z + r.d + 2.6, yMin: -99 }); }
  for (const S of (BM.stairs || []).filter(t => stairUp(t) === lv)) { const r = stairRect(S, stairDirOf(S)); Z.push({ x0: r.x - 2.6, x1: r.x + r.w + 2.6, z0: r.z - 2.6, z1: r.z + r.d + 2.6, yMin: -99 }); }
  return Z;
}
// Guard rail round a floor opening, only along the stretches where you could actually walk up to the edge:
// floor on the far side, no wall already on that line, not beside another flight or opening, not over a double-height void.
function guardRail(par, lv, hole, e, a, b, y, kind = 'glass') {
  const inward = { n: 1, s: -1, w: 1, e: -1 }[e.side], at = (t, off) => e.axis === 'x' ? [t, e.c + off] : [e.c + off, t];
  const blocked = (x, z) => stairsOn(lv).some(S => { const r = stairRect(S, stairDirOf(S)); return x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d; })
    || flightLanes(lv).some(L => L !== hole && x > L.x && x < L.x + L.w && z > L.z && z < L.z + L.d);
  const need = t => { const [ox, oz] = at(t, -inward * .45), [ix, iz] = at(t, inward * .45), out = roomAt3(lv, ox, oz), inn = roomAt3(lv, ix, iz);
    if (!out || blocked(ox, oz)) return false;                                  // nothing to stand on beside it
    if (RT[out.type]?.rail && Math.abs((e.axis === 'x' ? (e.side === 'n' ? out.z + out.d : out.z) : (e.side === 'w' ? out.x + out.w : out.x)) - e.c) < EPS) return false; // a catwalk's own edge: its railing setting decides
    if (inn && out !== inn && wallMode(inn, out) !== 'open') return false;      // a wall already runs along this edge
    return true; };
  const step = .5; let s0 = null;
  for (let t = a; t <= b + 1e-6; t += step) { const tt = Math.min(t + step / 2, b), ok = t < b && need(tt);
    if (ok && s0 === null) s0 = t; if ((!ok || t + step > b) && s0 !== null) { const s1 = ok ? b : t; if (s1 - s0 > .4) railing(par, e.axis, e.c, s0, s1, y, kind); s0 = null; } }
}
// Railings come in four kinds: glass panels, wood (walnut cap and balusters), black metal bars, or none.
const RAIL_KINDS = [['none', 'None'], ['glass', 'Glass'], ['wood', 'Wood'], ['metal', 'Metal']];
const railMats = k => k === 'wood' ? { cap: M.walnut, post: M.walnut } : k === 'metal' ? { cap: M.trim2, post: M.trim2 } : { cap: M.trim, post: M.trim };
function railing(par, axis, c, a, b, y, kind = 'glass') { // level railing along a line
  if (b - a < .3 || kind === 'none') return; const h = 3.4, R = railMats(kind), bx2 = (a0, a1, y0, y1, n0, n1, m, o) => axis === 'x' ? box(par, a0, a1, y0, y1, n0, n1, m, o) : box(par, n0, n1, y0, y1, a0, a1, m, o);
  if (kind === 'glass') { bx2(a, b, y, y + h, c - .05, c + .05, M.glass, { solid: true }); bx2(a, b, y + h, y + h + .15, c - .1, c + .1, M.trim); return; }
  const capW = kind === 'wood' ? .14 : .07, bar = kind === 'wood' ? .07 : .04, gap = kind === 'wood' ? .42 : .36;
  bx2(a, b, y + h - .02, y + h + .15, c - capW, c + capW, R.cap, { solid: true });
  if (kind === 'wood') bx2(a, b, y + .25, y + .38, c - .07, c + .07, R.cap);
  for (const p of [a + .1, b - .1]) bx2(p - .09, p + .09, y, y + h, c - .09, c + .09, R.post);
  for (let t = a + gap; t < b - .15; t += gap) bx2(t - bar, t + bar, y + (kind === 'wood' ? .38 : .05), y + h - .02, c - bar, c + bar, R.post);
}
// A railing that climbs with a flight: from (s0, y0) at the bottom step to (s1, y1) at the top, on the line c across the run.
function slopedRail(par, alongX, c, s0, s1, y0, y1, kind) {
  if (kind === 'none') return; const h = 3, R = railMats(kind), ds = s1 - s0, dy = y1 - y0, len = Math.hypot(ds, dy), mid = (s0 + s1) / 2, my = (y0 + y1) / 2;
  const strip = (thick, height, yOff, mat) => { const g = new THREE.BoxGeometry(alongX ? len : thick, height, alongX ? thick : len), m = new THREE.Mesh(g, mat);
    if (alongX) { m.position.set(mid, my + yOff, c); m.rotation.z = Math.atan2(dy, ds); } else { m.position.set(c, my + yOff, mid); m.rotation.x = Math.atan2(-dy, ds); }
    m.castShadow = mat !== M.glass; m.receiveShadow = true; par.add(m); return m; };
  const at = t => y0 + dy * (t - s0) / ds, post = (t, y, top, w) => alongX ? box(par, t - w, t + w, y, top, c - w, c + w, R.post) : box(par, c - w, c + w, y, top, t - w, t + w, R.post);
  if (kind === 'glass') strip(.05, h - .3, h / 2 - .05, M.glass);
  strip(kind === 'wood' ? .26 : .14, .16, h, R.cap);
  for (const t of [s0, s1]) post(t, at(t) - .6, at(t) + h + .05, .09);
  if (kind !== 'glass') { const gap = kind === 'wood' ? .42 : .36, n = Math.floor(Math.abs(ds) / gap), w = kind === 'wood' ? .06 : .035;
    for (let i = 1; i < n; i++) { const t = s0 + ds * i / n; post(t, at(t), at(t) + h, w); } }
}
const stairRail = S => S.rail ?? 'glass';   // the railing kind a staircase uses (along the flight and round its opening upstairs)
// Which long sides of a straight flight get a railing: 'auto' = the sides open to the room (a drop), or the user's pick.
function flightSides(S, lane, dir, lv) {
  const ax = dir[1] === 'x', s = dir[0] === '+' ? 1 : -1, lo = ax ? lane.z : lane.x, hi = lo + (ax ? lane.d : lane.w);
  const left = ax ? (s > 0 ? lo : hi) : (s > 0 ? hi : lo), right = left === lo ? hi : lo; // facing up the stairs
  const pick = S.railSides || 'auto'; if (pick !== 'auto') return { left: pick === 'left' || pick === 'both' ? left : null, right: pick === 'right' || pick === 'both' ? right : null };
  const host = roomAt3(lv, S.cx, S.cz), open = side => { const off = side === lo ? -.5 : .5, run0 = ax ? lane.x : lane.z, run1 = run0 + (ax ? lane.w : lane.d);
    return [.25, .5, .75].some(f => { const t = run0 + (run1 - run0) * f, [x, z] = ax ? [t, side + off] : [side + off, t], q = roomAt3(lv, x, z);
      return q && (q === host || (host && wallMode(q, host) === 'open')) && !stairsOn(lv).some(o => o !== S && ovl(stairRect(o, stairDirOf(o)), { x: x - .05, z: z - .05, w: .1, d: .1 })); }); };
  return { left: open(left) ? left : null, right: open(right) ? right : null };
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
  applyLevels(BM); // this design's floor heights (see core.js)
  for (const k in G3) clearGroup(G3[k]);
  for (const m of H3_WALK) { const i = walkables.indexOf(m); if (i >= 0) walkables.splice(i, 1); }
  const before = walkables.length;
  const rooms = BM.rooms, has = lv => rooms.some(r => r.level === lv);
  const parent = new Proxy({}, { get: (_, k) => LG(k).g }), furn = new Proxy({}, { get: (_, k) => LG(k).furn });
  let carDone = false;
  for (const lv of levelIds()) {
    const rs = rooms.filter(r => r.level === lv); if (!rs.length) continue;
    const P = parent[lv], CEIL = LG(lv).ceil, y = LV_Y[lv], yc = LV_C[lv], below = levelBelow(lv);
    const lanes = flightLanes(lv), zones = clearZones(lv);
    // flights leaving this floor: its ceilings open over them, so you don't climb into a white ceiling
    const upLanes = (BM.stairs || []).filter(s => s.level === lv && stairUp(s) && has(stairUp(s))).map(s => turns(s) ? stairRect(s, stairDirOf(s)) : laneOf(s, 0));
    const holed = (rc, z) => { let ps = [rc]; for (const L of upLanes) ps = ps.flatMap(p => cutRect(p, L)); for (const [a0, a1, b0, b1] of ps) flat(CEIL, rect(a0, a1, b0, b1), [], z, M.ceil); };
    for (const r of rs) {
      const poly = roomPoly(r), rr = rect(r.x, r.x + r.w, r.z, r.z + r.d), g = r.type === 'garage' && lv === 'M', T = RT[r.type] || {};
      if (T.outdoor) { // decks, porches, balconies
        if (poly) {
          const up = lv !== 'M', fy = up ? y : y - .35, kind = BM.rails?.[`${r.id}:*`] ?? 'glass';
          if (up) slab(P, poly, [], Math.max(0, fy - 1.04), fy, M.stucco, { walk: true });
          else slab(P, poly, [], 0, fy, T.covered ? M.concrete : M.deck, { walk: true });
          flat(P, poly, [], fy + .01, floorFor(r), { walk: true });
          if (T.covered) flat(CEIL, poly, [], yc - .62, BM.style === 'modern' ? M.soffitM : M.soffit);
          if (T.rail) for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], [nx, nz, mx, mz, len] = edgeOut(poly, a, b); if (len < .3) continue; if (BM.rooms.some(o => o.level === lv && !isOut(o) && insideRoom(o, mx + nx * .5, mz + nz * .5))) continue; segRail(P, a[0], a[1], b[0], b[1], fy, kind); }
          if (showFurnBuild) furnish(furn[lv], r, fy, zones);
          continue;
        }
        const up = lv !== 'M', fy = up ? y : y - .35, mat = floorFor(r);
        if (up) box(P, r.x, r.x + r.w, fy - 1.04, fy, r.z, r.z + r.d, M.stucco, { walk: true });
        else box(P, r.x, r.x + r.w, 0, fy, r.z, r.z + r.d, T.covered ? M.concrete : M.deck, { walk: true });
        flat(P, rr, [], fy + .01, mat, { walk: true });
        const corners = [[r.x, r.z], [r.x + r.w, r.z], [r.x, r.z + r.d], [r.x + r.w, r.z + r.d]];
        const indoorAt = (x, z) => BM.rooms.some(o => o.level === lv && !isOut(o) && x > o.x - .2 && x < o.x + o.w + .2 && z > o.z - .2 && z < o.z + o.d + .2);
        if (up && !belowGrade(lv)) for (const [cx, cz] of corners) if (!BM.rooms.some(o => LV_Y[o.level] < y - .1 && !belowGrade(o.level) && cx >= o.x - .1 && cx <= o.x + o.w + .1 && cz >= o.z - .1 && cz <= o.z + o.d + .1)) { const sx = cx === r.x ? .3 : -.3, sz = cz === r.z ? .3 : -.3; box(P, cx + Math.min(0, sx * 2), cx + Math.max(0, sx * 2), 0, fy - 1.04, cz + Math.min(0, sz * 2), cz + Math.max(0, sz * 2), M.white, { solid: true }); }
        const STY = BM.style === 'batten' || BM.style === 'stone', PIER = BM.style === 'stone' ? M.fstone : M.brick, SIDE = BM.style === 'stone' ? M.dsiding : M.batten, frontSide = r.z < Math.min(...BM.rooms.filter(o => o.level === 'M' && !isOut(o)).map(o => o.z + o.d / 2));
        if (T.covered) { for (const [cx, cz] of corners) if (!indoorAt(cx, cz) && BM.style !== 'modern') { const sx = cx === r.x ? 1 : -1, sz = cz === r.z ? 1 : -1, A = (k, wd) => [k + Math.min(0, (k === cx ? sx : sz) * wd), k + Math.max(0, (k === cx ? sx : sz) * wd)];
            if (STY) { const ins = (k, s2, wd) => [k + s2 * .15, k + s2 * (.15 + wd)].sort((p, q) => p - q);
              if (frontSide) { const [a0, a1] = ins(cx, sx, 1.5), [b0, b1] = ins(cz, sz, 1.5); box(P, a0, a1, fy, fy + 2.8, b0, b1, PIER, { solid: true }); box(P, a0 - .08, a1 + .08, fy + 2.8, fy + 2.95, b0 - .08, b1 + .08, M.concrete); }
              const d = frontSide ? .42 : 0, [a0, a1] = ins(cx + sx * d, sx, .65), [b0, b1] = ins(cz + sz * d, sz, .65); box(P, a0, a1, fy, yc - .6, b0, b1, M.trim, { solid: true }); }
            else box(P, ...A(cx, 1.1), fy, yc - .6, ...A(cz, 1.1), M.stone, { solid: true }); }
          box(P, r.x, r.x + r.w, yc - .6, yc, r.z, r.z + r.d, BM.style === 'modern' ? M.trim2 : STY ? SIDE : M.stucco); flat(CEIL, rr, [], yc - .62, BM.style === 'modern' ? M.soffitM : M.soffit); }
        if (T.rail) for (const e of edgesOf(r)) { // railings on the open edges
          const segs = sub1d([e.a, e.b], BM.rooms.filter(o => o.level === lv && !isOut(o) && o !== r).flatMap(o => { const f = edgesOf(o).find(x => x.side === OPP[e.side]); return f && Math.abs(f.c - e.c) < EPS ? [[f.a, f.b]] : []; }));
          for (const [a, b] of segs) railing(P, e.axis, e.c, a, b, fy, railFor(r, e.out, a));
        }
        if (showFurnBuild) furnish(furn[lv], r, fy, zones);
        continue;
      }
      if (poly) {
        const holes = list => list.filter(L => [[L.x + .2, L.z + .2], [L.x + L.w - .2, L.z + .2], [L.x + .2, L.z + L.d - .2], [L.x + L.w - .2, L.z + L.d - .2]].every(([x, z]) => pointInPoly(x, z, poly))).map(L => rect(L.x, L.x + L.w, L.z, L.z + L.d));
        if (g) slab(P, poly, holes(lanes), 0, GF, M.concrete, { walk: true });
        else { slab(P, poly, holes(lanes), y - 1.04, y, M.ceil, { walk: true, cast: false }); flat(P, poly, [], y + .01, floorFor(r), { walk: true }); }
        flat(CEIL, poly, isTall(r) ? [] : holes(upLanes), (isTall(r) ? LV_C[tallInto(lv)] : yc) - .02, M.ceil);
        if (showFurnBuild && !r.nofurn) { if (r.type === 'garage') { if (carDone) r._car = true; carDone = true; } furnish(furn[lv], r, g ? GF : y, zones); delete r._car; }
        continue;
      }
      let pieces = [[r.x, r.x + r.w, r.z, r.z + r.d]];
      for (const L of lanes) pieces = pieces.flatMap(p => cutRect(p, L)); // open only above the flight arriving from below
      for (const [a0, a1, b0, b1] of pieces) {
        if (g) box(P, a0, a1, 0, GF, b0, b1, M.concrete, { walk: true });
        else { box(P, a0, a1, y - 1.04, y, b0, b1, M.ceil, { cast: false }); flat(P, rect(a0, a1, b0, b1), [], y + .01, floorFor(r), { walk: true }); }
      }
      if (isTall(r)) { const open = tallParts(r);
        for (const [a0, a1, b0, b1] of open) flat(CEIL, rect(a0, a1, b0, b1), [], LV_C[tallInto(lv)] - .02, M.ceil);
        if (!fullyTall(r)) for (const q of rectCells([r], .5, open.map(([a0, a1, b0, b1]) => ({ x: a0, z: b0, w: a1 - a0, d: b1 - b0 })))) holed(q, yc - .02); }
      else holed([r.x, r.x + r.w, r.z, r.z + r.d], yc - .02);
      if (showFurnBuild && !r.nofurn) { if (r.type === 'garage') { if (carDone) r._car = true; carDone = true; } furnish(furn[lv], r, g ? GF : y, zones); delete r._car; }
    }
    // staircases starting on this level
    for (const S of stairsOn(lv)) {
      const upLv = stairUp(S); if (!upLv || !has(upLv)) continue; const upY = LV_Y[upLv];
      const dir = stairDirOf(S), pair = stairPair(S), UP = parent[upLv];
      if (turns(S)) { // turning stairs: rail round the whole opening except the half you arrive on
        const g = turnRun(P, S, dir, y, upY), r = stairRect(S, dir), startSide = { '+x': 'w', '-x': 'e', '+z': 'n', '-z': 's' }[dir];
        const RK = stairRail(S), guard = S.guard !== false ? RK : 'none';
        for (const e of edgesOf(r)) { if (e.side !== startSide) { guardRail(UP, upLv, r, e, e.a, e.b, upY, guard); continue; } guardRail(UP, upLv, r, e, g.a0, g.a0 + g.hw, upY, guard); }
        continue; }
      const lane = laneOf(S, 0), RK = stairRail(S); // the whole width you gave it, never cut in half
      stairRun(P, lane, y, upY, 0, false, dir);
      { const ax = dir[1] === 'x', sg = dir[0] === '+' ? 1 : -1, L = ax ? lane.w : lane.d, run = Math.min(L, 15 * .9) / 15, st0 = (ax ? lane.x : lane.z) + (L - run * 15) / 2,
          b0 = sg > 0 ? st0 : st0 + run * 15, b1 = sg > 0 ? st0 + run * 15 : st0, sides = flightSides(S, lane, dir, lv); // railings up the open sides of the flight
        for (const c of [sides.left, sides.right]) if (c != null) slopedRail(P, ax, c + (c === (ax ? lane.z : lane.x) ? .12 : -.12), b0, b1, y + (upY - y) / 16, upY, RK); }
      const topSide = { '+x': 'e', '-x': 'w', '+z': 's', '-z': 'n' }[dir], over = (BM.stairs || []).find(o => o.level === upLv && Math.hypot(o.cx - S.cx, o.cz - S.cz) < 3), overStart = over && !turns(over) && stairDirOf(over) === dir ? { '+x': 'w', '-x': 'e', '+z': 'n', '-z': 's' }[dir] : null; // guard rail round the opening, open at the arrival end
      if (S.guard !== false) for (const e of edgesOf(lane)) if (e.side !== topSide && e.side !== overStart) guardRail(UP, upLv, lane, e, e.a, e.b, upY, RK);
    }
    // walls
    for (const w of planLevel(lv)) {
      if (w.angled) {
        const ext = w.ext, y0 = belowGrade(lv) ? y : lv === 'M' ? (ext ? TF : y) : ext ? y - JOIST : y;
        let y1 = belowGrade(lv) ? (ext ? Math.min(TF, yc + JOIST) : yc) : yc;
        if (canTall(lv) && w.room.tall && isTall(w.room)) y1 = LV_C[tallInto(lv)];
        const STY = BM.style === 'batten', STN = BM.style === 'stone', MOD = BM.style === 'modern';
        const outer = !ext ? paintFor(w.room) : belowGrade(lv) ? M.found : CLAD()[w.room.clad] || (STY ? M.batten : STN ? M.fstone : MOD ? M.render : M.stucco);
        segWall(P, w.x0, w.z0, w.x1, w.z1, { t: ext ? EXT : INT, y0, y1, mat: outer, inner: paintFor(w.room), nx: w.nx, nz: w.nz, win: w.win });
        continue;
      }
      if (w.rail) { railing(P, w.axis, w.c, w.a, w.b, LV_Y[lv], w.kind); continue; }
      if (w.open) continue; // Open: nothing at all on this edge, upstairs too
      const horiz = w.axis === 'x', ext = w.ext, garageRoom = (ext ? w.room.type : w.rooms.some(q => q.type === 'garage')) === 'garage' || (!ext && w.rooms.some(q => q.type === 'garage'));
      const t = ext ? EXT : INT, ex = ext ? t / 2 : 0;
      const y0 = belowGrade(lv) ? y : lv === 'M' ? (garageRoom ? 0 : ext ? TF : y) : ext ? y - JOIST : y, aboveC = canTall(lv) ? LV_C[tallInto(lv)] : yc;
      const nrm = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] };
      const tallSide = canTall(lv) && (ext ? w.room.tall : w.rooms.some(q => q.tall));
      // split where a 2nd-floor room's edge crosses above, so each stretch gets its own height
      const cuts = tallSide ? [...new Set(upSolid(lv).flatMap(u => horiz ? [u.x, u.x + u.w] : [u.z, u.z + u.d]))].filter(c => c > w.a + .3 && c < w.b - .3).sort((p, q) => p - q) : [];
      const bounds = [w.a, ...cuts, w.b];
      for (let si = 0; si < bounds.length - 1; si++) {
        const sa = bounds[si], sb = bounds[si + 1], mid = (sa + sb) / 2;
        const probe = (dx, dz) => horiz ? [mid, w.c + dz] : [w.c + dx, mid];
        let y1 = belowGrade(lv) ? (ext ? Math.min(TF, yc + JOIST) : yc) : yc;
        if (tallSide && ext) { const [ox, oz] = nrm[w.out], [ix, iz] = probe(-ox * .6, -oz * .6); if (inTall(lv, ix, iz)) y1 = aboveC; }
        if (tallSide && !ext) { // rise to full height unless a 2nd-floor room's wall already covers the upper part
          const [px1, pz1] = probe(-.6, -.6), [px2, pz2] = probe(.6, .6), t1 = inTall(lv, px1, pz1), t2 = inTall(lv, px2, pz2), u1 = coveredAt(lv, px1, pz1), u2 = coveredAt(lv, px2, pz2);
          if ((t1 || t2) && !(u1 || u2)) y1 = aboveC;          // both sides open above (or one open, one normal room): wall the whole height
          if ((t1 && u2) || (t2 && u1)) y1 = yc;           // the 2nd-floor box's own wall closes the upper part
        }
        const ops = w.ops.filter(op => op.c >= sa - .01 && op.c < sb + .01 || (si === 0 && op.c < sa) || (si === bounds.length - 2 && op.c >= sb));
        const o = { t, y0, y1, ops }, faceOf = q => horiz ? (q.z + q.d / 2 > w.c ? '+z' : '-z') : (q.x + q.w / 2 > w.c ? '+x' : '-x');
        o.faceMat = {}; for (const q of ext ? [w.room] : w.rooms) if (q.finish) o.faceMat[faceOf(q)] = paintFor(q, sideOfRoom(q, w.axis, w.c));
        if (ext) {
          const [ox, oz] = nrm[w.out], [qx, qz] = probe(ox * .6, oz * .6), overVoid = lv === 'U' && inTall('M', qx, qz);
          const STY = BM.style === 'batten', STN = BM.style === 'stone', MOD = BM.style === 'modern';
          Object.assign(o, { out: w.out, outer: overVoid ? M.paint : belowGrade(lv) ? M.found : CLAD()[w.room.clad] || (STY ? M.batten : STN ? M.fstone : MOD ? M.render : M.stucco), skirt: lv === 'M' && !STN && !MOD });
          if (STY && lv === 'M') Object.assign(o, w.out === '-z' ? { skirtMat: M.brick, skirtTop: MF + 1.5 } : { skirtMat: M.found, skirtTop: TF + .2 });
          if (overVoid) { o.y0 = MC; o.ops = []; } // the box's face drops to the main ceiling line, so the floor edge is covered
        }
        const a = sa - (si === 0 ? ex : 0), b = sb + (si === bounds.length - 2 ? ex : 0);
        if (horiz) wall(P, a, w.c, b, w.c, o); else wall(P, w.c, a, w.c, b, o);
      }
      if (lv === 'M' && !ext && w.rooms.some(q => q.type === 'garage') && !w.rooms.every(q => q.type === 'garage')) for (const op of w.ops) if (op.k === 'door') {
        const gar = w.rooms.find(q => q.type === 'garage'), gc = horiz ? gar.z + gar.d / 2 : gar.x + gar.w / 2, sgn = gc > w.c ? 1 : -1, n = Math.max(1, Math.ceil((MF - GF) / .65)), rise = (MF - GF) / n;
        op.b = MF; // door sits at house floor height; steps (as many as the height needs) climb to it from the garage
        for (let k = 1; k <= n; k++) { const top = GF + k * rise, n0 = w.c + sgn * t / 2, n1 = n0 + sgn * (n + 1 - k) * .95, a0 = op.c - op.w / 2 - .4, a1 = op.c + op.w / 2 + .4;
          if (horiz) box(P, a0, a1, GF, top, Math.min(n0, n1), Math.max(n0, n1), M.concrete, { walk: true }); else box(P, Math.min(n0, n1), Math.max(n0, n1), GF, top, a0, a1, M.concrete, { walk: true }); }
      }
    }
  }
  // roofs: top-most footprint per level, decomposed into big rectangles
  const up = rooms.filter(r => r.level === 'U' && !isOut(r)), main = rooms.filter(r => r.level === 'M' && (!isOut(r) || RT[r.type].covered));
  const balc = rooms.filter(r => r.level === 'U' && r.type === 'balcony');
  const upLike = up.concat(main.filter(isTall));
  // one roof per level over its whole footprint (see roof.js): the 2nd floor's, then the main floor's where nothing sits on it
  ROOF3 = [];
  const pitch = (BM.pitch || (BM.style === 'batten' ? 7 : 5)) / 12, gw = BM.style === 'batten' ? M.batten : BM.style === 'stone' ? M.fstone : BM.style === 'modern' ? M.render : M.stucco, rmo = BM.style === 'modern' ? { roofMat: M.seamRoof, soffitMat: M.soffitM } : {}, e = EXT / 2;
  const outer = rs => rs.map(([x0, x1, z0, z1]) => [x0 - e, x1 + e, z0 - e, z1 + e]), ov = BM.ov ?? 1.5;
  const ownRoof = main.filter(r => r.roof === 'gable'); // single-storey rooms with a gable roof of their own (a garage, say)
  // extra floors (see levelList): the 2nd-floor and main roofs stop where one sits on top of them, and each gets its own roof below
  const xtra = levelList().filter(l => l.extra && !belowGrade(l.id)), xRooms = l => rooms.filter(r => r.level === l.id && !isOut(r));
  const overU = xtra.filter(l => l.y > LV_Y.U).flatMap(xRooms), overM = xtra.flatMap(xRooms);
  const upR = outer(rectCells(upLike, .5, overU)), mainR = outer(rectCells(main)), mainOnly = outer(rectCells(main, .5, upLike.concat(balc, ownRoof, overM))), balcR = outer(rectCells(balc)), ownR = outer(rectCells(ownRoof));
  const flatSlabs = list => { for (const [[x0, x1, z0, z1], plate] of list) {
      const MO = BM.style === 'modern', o2 = MO ? (BM.ovFlat ?? BM.ov ?? 2) : .8;
      // a lower roof stops at the wall of a taller volume next to it, instead of running into that room (or its overhang showing inside)
      const taller = plate === MC ? upR.concat(ownR) : [], hit = (x, z) => taller.some(([a0, a1, b0, b1]) => x > a0 && x < a1 && z > b0 && z < b1), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const ow = hit(x0 - .5, mz) ? -e : o2, oe = hit(x1 + .5, mz) ? -e : o2, on = hit(mx, z0 - .5) ? -e : o2, os = hit(mx, z1 + .5) ? -e : o2; // -e: stop at the wall's centre line, clear of the room's face
      box(G3.roof, x0 - ow, x1 + oe, plate, plate + .9, z0 - on, z1 + os, MO ? M.white : flatRoofMat); box(G3.roof, x0 - ow - .05, x1 + oe + .05, plate + .9, plate + 1.05, z0 - on - .05, z1 + os + .05, M.trim);
      if (MO) flat(G3.roof, rect(x0 - ow, x1 + oe, z0 - on, z1 + os), [], plate - .01, M.soffitM); } };
  const flatInfo = (plate, name) => ({ name, plate, pitch: 0, asked: 0, eaveH: plate + .9, maxH: plate + 1.05, style: 'flat', heightAt: () => null });
  if (BM.roof === 'flat') {
    flatSlabs([...upR.map(q => [q, UC]), ...mainOnly.map(q => [q, MC])]);
    ROOF3.push(...[[upR, UC, '2nd floor roof'], [mainOnly, MC, 'Main floor roof']].filter(q => q[0].length).map(([, plate, name]) => flatInfo(plate, name)));
  } else {
    const style = BM.roof === 'gable' || BM.roof === 'shed' ? BM.roof : 'hip', P = style === 'shed' ? Math.min(pitch, 4 / 12) : pitch;
    if (upR.length) roofLevel(G3.roof, { name: '2nd floor roof', eaves: upR, plate: UC, pitch: P, ov, style, wallMat: gw, ...rmo });
    // mainRoof 'flat': the single-storey parts get flat canopies under the pitched upper roof
    if (mainOnly.length && BM.mainRoof === 'flat') { flatSlabs(mainOnly.map(q => [q, MC])); ROOF3.push(flatInfo(MC, 'Main floor roof')); }
    // a lower roof that meets the storey above slopes away from it, and is kept below the 2nd-floor windows
    else if (mainOnly.length) roofLevel(G3.roof, { ...rmo, name: 'Main floor roof', eaves: mainOnly, inner: mainR, solid: upR.concat(balcR), plate: MC + .03, pitch: P, ov, style, wallMat: gw, cap: upR.length ? UC - .5 : null, windows: upR.length ? planLevel('U').filter(w => w.ext).flatMap(w => w.ops.map(op => ({ axis: w.axis, c: w.c, a0: op.c - op.w / 2, a1: op.c + op.w / 2, sill: op.b }))) : [] });
  }
  { const all = levelList().filter(l => !belowGrade(l.id)), style = BM.roof === 'gable' || BM.roof === 'shed' ? BM.roof : 'hip', P = style === 'shed' ? Math.min(pitch, 4 / 12) : pitch;
    for (const l of [...xtra].reverse()) { // top extra floor first
      const own = xRooms(l), higher = all.filter(k => k.y > l.y + .01).flatMap(k => rooms.filter(r => r.level === k.id && (!isOut(r) || r.type === 'balcony')));
      const eaves = outer(rectCells(own, .5, higher)), plate = LV_C[l.id], name = `${l.name} roof`; if (!eaves.length) continue;
      if (BM.roof === 'flat') { flatSlabs(eaves.map(q => [q, plate])); ROOF3.push(flatInfo(plate, name)); continue; }
      const cover = outer(rectCells(higher.filter(r => !isOut(r)))), nextUp = all.find(k => k.y > l.y + .01 && rooms.some(r => r.level === k.id && !isOut(r)));
      if (!higher.length) roofLevel(G3.roof, { name, eaves, plate, pitch: P, ov, style, wallMat: gw, ...rmo });
      else roofLevel(G3.roof, { ...rmo, name, eaves, inner: outer(rectCells(own)), solid: cover, plate: plate + .03, pitch: P, ov, style, wallMat: gw, cap: nextUp ? LV_C[nextUp.id] - .5 : null,
        windows: nextUp ? planLevel(nextUp.id).filter(w => w.ext).flatMap(w => w.ops.map(op => ({ axis: w.axis, c: w.c, a0: op.c - op.w / 2, a1: op.c + op.w / 2, sill: op.b }))) : [] });
    } }
  for (const r of ownRoof) { const x0 = r.x - e, x1 = r.x + r.w + e, z0 = r.z - e, z1 = r.z + r.d + e; // ridge runs front to back: a gable end faces the street
    hipRoof(G3.roof, { x0, x1, z0: z0 - 1.4, z1, plate: MC + .03, pitch, ov: 1.4, slopes: { e: true, w: true }, mat: rmo.roofMat, soffit: rmo.soffitMat, wall: CLAD()[r.clad] || gw, gables: [{ edge: 'n', at: z0 }, { edge: 's', at: z1 }] }); }
  // front gables (same pitch as the main roof, so each one dies into it a few feet back)
  for (const gb of BM.extras?.gables || []) hipRoof(G3.roof, { x0: gb.x0, x1: gb.x1, z0: gb.z0, z1: gb.z1, plate: gb.plate + .05, pitch: (gb.pitch || 7) / 12, ov: gb.ov ?? 1.2, slopes: { e: true, w: true }, wall: gb.wall === 'siding' ? M.dsiding : gb.wall === 'stone' ? M.fstone : M.batten,
    gables: [{ edge: 'n', at: gb.z0 + (gb.at ?? 1.05) }, ...(gb.back ? [{ edge: 's', at: gb.z1 }] : [])] });
  // dormers: a dark-sided box with a window, poking out of the roof, with its own gabled roof
  for (const dm of BM.extras?.dormers || []) { const cx = (dm.x0 + dm.x1) / 2, ww = Math.min(5, (dm.x1 - dm.x0) - 1.6);
    box(G3.roof, dm.x0 + .35, dm.x1 - .35, dm.y0, dm.plate, dm.z0 + .35, dm.z0 + 1.1, M.dsiding, { solid: true });
    box(G3.roof, cx - ww / 2 - .2, cx + ww / 2 + .2, dm.plate - 2.85, dm.plate - .35, dm.z0 + .3, dm.z0 + .4, M.trim);
    box(G3.roof, cx - ww / 2, cx + ww / 2, dm.plate - 2.7, dm.plate - .5, dm.z0 + .24, dm.z0 + .3, M.glass); box(G3.roof, cx - .05, cx + .05, dm.plate - 2.7, dm.plate - .5, dm.z0 + .2, dm.z0 + .32, M.trim);
    hipRoof(G3.roof, { x0: dm.x0, x1: dm.x1, z0: dm.z0, z1: dm.z1, plate: dm.plate, pitch: (dm.pitch || 9) / 12, ov: .9, slopes: { e: true, w: true }, wall: M.dsiding, gables: [{ edge: 'n', at: dm.z0 + .7 }] }); }
  // landscaping for the stone house: shrubs and a gravel bed along the front, flower pots by the steps
  for (const sb of BM.extras?.shrubs || []) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(sb[2], 1), sb[3] === 'f' ? M.flowers[(sb[0] * 7 | 0) % 3] : (sb[0] * 3 | 0) % 2 ? M.leaf : M.leaf2);
    m.position.set(sb[0], (sb[4] || 0) + sb[2] * .8, sb[1]); m.scale.y = .8; m.castShadow = true; G3.site.add(m); }
  for (const t of BM.extras?.trees || []) tree(t[0], t[1], t[2], G3.trees);
  for (const pl of BM.extras?.pools || []) { const [x0, x1, z0, z1] = pl; // pool: paver deck, coping and water
    flat(G3.site, rect(x0 - 5, x1 + 5, z0 - 5, z1 + 5), [rect(x0 - 1, x1 + 1, z0 - 1, z1 + 1)], .05, M.pavers, { walk: true });
    for (const [a0, a1, b0, b1] of [[x0 - 1, x1 + 1, z0 - 1, z0], [x0 - 1, x1 + 1, z1, z1 + 1], [x0 - 1, x0, z0, z1], [x1, x1 + 1, z0, z1]]) box(G3.site, a0, a1, 0, .25, b0, b1, M.white, { walk: true });
    flat(G3.site, rect(x0, x1, z0, z1), [], .03, M.poolTile); flat(G3.site, rect(x0, x1, z0, z1), [], .12, M.water); }
  for (const pt of BM.extras?.planters || []) { box(G3.site, pt[0], pt[1], 0, pt[4] || 1.6, pt[2], pt[3], M.panel, { solid: true }); flat(G3.site, rect(pt[0] + .2, pt[1] - .2, pt[2] + .2, pt[3] - .2), [], (pt[4] || 1.6) + .01, M.bark); }
  for (const sc of BM.extras?.screens || []) { const [x0, x1, z0, z1, y0, y1] = sc, along = x1 - x0 >= z1 - z0; for (let t = along ? x0 : z0; t < (along ? x1 : z1); t += .5) along ? box(G3.roof, t, t + .22, y0, y1, z0, z1, M.panelSlat) : box(G3.roof, x0, x1, y0, y1, t, t + .22, M.panelSlat); }
  for (const sl of BM.extras?.slabs || []) box(G3.site, sl[0], sl[1], sl[2], sl[3], sl[4], sl[5], M.concrete, { walk: true });
  for (const gv of BM.extras?.beds || []) { flat(G3.site, gv.pts, [], .06, M.gravel); }
  // site: ground, street, driveway to the garage door, walk to the front door
  const all = rooms.filter(r => !belowGrade(r.level)); const minX = Math.min(...all.map(r => r.x), 0), maxX = Math.max(...all.map(r => r.x + r.w), 30), minZ = Math.min(...all.map(r => r.z), 0), maxZ = Math.max(...all.map(r => r.z + r.d), 30);
  const bsm = rooms.filter(r => belowGrade(r.level));
  if (!bsm.length) flat(G3.site, rect(-420, 420, -420, 420), [], 0, M.grass, { walk: true });
  else { // open the ground over the basement so stairs and cutaway views work
    const bb = { x: Math.min(minX, ...bsm.map(r => r.x)) - 1, z: Math.min(minZ, ...bsm.map(r => r.z)) - 1 }; bb.w = Math.max(maxX, ...bsm.map(r => r.x + r.w)) + 1 - bb.x; bb.d = Math.max(maxZ, ...bsm.map(r => r.z + r.d)) + 1 - bb.z;
    flat(G3.site, rect(-420, 420, -420, 420), [rect(bb.x, bb.x + bb.w, bb.z, bb.z + bb.d)], 0, M.grass, { walk: true });
    for (const [a0, a1, b0, b1] of rectCells([bb], .5, bsm)) flat(G3.site, rect(a0, a1, b0, b1), [], 0, M.grass, { walk: true });
  }
  const SITE = BM.site || {}, roadZ = minZ - (SITE.setback ?? 48);
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
  if (fd) { const op = fd.ops[0]; box(G3.site, op.c - 2, op.c + 2, 0, .1, roadZ, fd.c - .4, M.pavers, { walk: true }); box(G3.site, op.c - 3.5, op.c + 3.5, 0, Math.max(.1, MF - .35), fd.c - 4, fd.c - .3, M.concrete, { walk: true });
    { const top = MF - .35, n = Math.ceil(top / .62); for (let k = 1; k < n; k++) box(G3.site, op.c - 3.5, op.c + 3.5, 0, top * (n - k) / n, fd.c - 4 - k * 1.05, fd.c - 4 - (k - 1) * 1.05, M.concrete, { walk: true }); } /* a step every 7½" or so down to the walk */ H3_FRONT = [op.c, fd.c - 14, Math.PI, 1]; }
  else H3_FRONT = [(minX + maxX) / 2, minZ - 14, Math.PI, 1];
  const nTrees = SITE.trees ?? 4, spots = [[minX - 18, minZ - 20, 1.1], [maxX + 18, minZ - 15, 1], [minX - 20, maxZ + 15, 1.2], [maxX + 22, maxZ + 10, 1], [(minX + maxX) / 2, maxZ + 28, 1.15], [minX - 26, (minZ + maxZ) / 2, .95], [maxX + 26, (minZ + maxZ) / 2, 1.05], [maxX + 10, maxZ + 30, .9]];
  for (const [x, z, s] of spots.slice(0, nTrees)) tree(x, z, s, G3.trees);
  H3_LOT = null;
  if (SITE.lotW && SITE.lotD) { // property line: low hedge around the lot, front edge at the sidewalk
    const cx = (minX + maxX) / 2 + (SITE.offsetX || 0), lx0 = cx - SITE.lotW / 2, lx1 = cx + SITE.lotW / 2, lz0 = roadZ + 5, lz1 = lz0 + SITE.lotD; H3_LOT = [lx0, lx1, lz0, lz1];
    for (const [a0, a1, b0, b1] of [[lx0, lx1, lz1 - .6, lz1], [lx0, lx0 + .6, lz0 + 3, lz1], [lx1 - .6, lx1, lz0 + 3, lz1]]) box(G3.site, a0, a1, 0, 2.2, b0, b1, M.leaf2, { solid: true });
  }
  placeItems();
  // HUD data
  ROOMS3 = rooms.map(r => { const poly = roomPoly(r), c = poly ? polyCentroid(poly) : [r.x + r.w / 2, r.z + r.d / 2], row = [rname(r), r.level, [[r.x, r.x + r.w, r.z, r.z + r.d]], [c[0], c[1], Math.PI]]; if (poly) { row.area = polyArea(poly); row.poly = poly; } return row; });
  OUTLINE3 = {}; for (const l of levelIds()) OUTLINE3[l] = (l === 'M' ? main : l === 'U' ? up : rooms.filter(r => r.level === l && !isOut(r))).map(r => roomPoly(r) || rect(r.x, r.x + r.w, r.z, r.z + r.d));
  H3_WALK = walkables.slice(before);
}
let showFurnBuild = true;

