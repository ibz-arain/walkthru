// The house shown on the landing page: a modern two-storey home built from separate volumes
// (white render, limestone, charcoal metal panels), flat roofs at two heights, a double-height great room,
// a roof-top balcony and a rear balcony over the patio, and a pool.
// Writes scripts/landing-house.json, a design the playground can load (localStorage 'walkthru-designs-v1').
// Run: node scripts/landing-house.mjs
import { writeFileSync } from 'node:fs';
let id = 1;
const R = (type, level, x0, x1, z0, z1, extra = {}) => ({ id: id++, type, level, x: x0, z: z0, w: +(x1 - x0).toFixed(2), d: +(z1 - z0).toFixed(2), ...extra });
// furniture layouts are picked by a seeded random per room (see furnish3.js): find a seed that gives layout `v` and the wanted fabrics
const draws = (rid, v) => { let s = ((rid * 7919 + v * 104729) % 2147483647) || 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; return [0, 0, 0, 0].map((_, i) => Math.floor(R() * [8, 8, 7, 3][i]) % [8, 8, 7, 3][i]); };
const seed = (rid, ok) => { for (let v = 0; v < 5000; v++) if (ok(draws(rid, v))) return v; return 0; };
const NEUTRAL = [0, 2, 6, 3]; // grey, tan, cream, sage

const rooms = [
  // main floor (street is -z; the garage sits on the right as seen from the street)
  R('garage', 'M', 0, 22, 0, 24, { clad: 'stone', roof: 'gable' }),
  R('porch', 'M', 22, 31, -1, 6, { name: 'Entry' }),
  R('foyer', 'M', 22, 31, 6, 22, { clad: 'stone' }),
  R('office', 'M', 31, 45, -3, 16, { clad: 'dark', nofurn: true, finish: { floor: 'walnut', paint: '#efece6' } }),
  R('guest', 'M', 45, 63, 4, 16, { clad: 'stone' }),
  R('stairs', 'M', 22, 31, 22, 34),
  R('dining', 'M', 31, 45, 16, 34, { finish: { floor: 'natural' } }),
  R('great', 'M', 45, 63, 16, 46, { name: 'Great Room', tall: true, clad: 'render', nofurn: true, finish: { floor: 'natural', paint: '#f4f1eb', accent: { side: 'n', color: '#3b3d40' } } }),
  R('kitchen', 'M', 22, 45, 34, 48, { finish: { floor: 'natural' } }),
  R('mud', 'M', 0, 11, 24, 34), R('powder', 'M', 11, 22, 24, 34, { name: 'Powder' }),
  R('laundry', 'M', 0, 11, 34, 44), R('pantry', 'M', 11, 22, 34, 44),
  R('deck', 'M', 45, 63, 46, 56, { name: 'Terrace' }),
  // 2nd floor: one volume over the middle of the house, the garage and great room stay lower
  R('hall', 'U', 22, 31, 12, 22), R('stairs', 'U', 22, 31, 22, 34),
  R('bedroom', 'U', 31, 45, 0, 16, { name: 'Bedroom 2', clad: 'render' }),
  R('bath', 'U', 31, 38, 16, 24, { clad: 'render' }), R('walkin', 'U', 38, 45, 16, 24, { name: 'Walk-in', clad: 'render' }),
  R('ensuite', 'U', 31, 45, 24, 34, { clad: 'render' }),
  R('primary', 'U', 22, 45, 34, 46, { name: 'Primary', clad: 'dark' }),
  R('balcony', 'U', 45, 60, 4, 15.5, { name: 'Roof Terrace' }),
  R('balcony', 'U', 24, 43, 46, 52, { name: 'Balcony' }),
];
const rid = n => rooms.find(r => r.name === n || r.type === n).id;
for (const r of rooms.filter(r => ['bedroom', 'primary', 'guest', 'office', 'dining', 'kitchen'].includes(r.type))) r.var = seed(r.id, d => NEUTRAL.includes(d[0]) && NEUTRAL.includes(d[1]) && [0, 4, 6].includes(d[2]));

const big = (n, w, h, sill = .3) => ({ n, w, h, sill, style: 'picture' });
const ext = {}, ops = {};
const win = (name, out, o, lv) => { const r = rooms.find(q => (q.name === name || q.type === name) && (!lv || q.level === lv)); ext[`${r.id}:${out}`] = 'window'; ops[`${r.id}:${out}`] = o; };
win('office', '-z', big(1, 7, 6, 2));
win('guest', '-z', big(2, 4, 5, 2.5));
win('Bedroom 2', '-z', big(1, 6, 5, 2));
win('Bedroom 2', '-x', big(1, 3, 6.5, 1));
win('Primary', '+x', big(1, 3, 6.5, 1));
win('dining', '+x', big(1, 3, 8.3));
win('kitchen', '-x', big(1, 3, 6, 2));

// great room: furnished by hand round a full-height stone fireplace (catalog kinds from designer.js)
let iid = 1; const I = (kind, x, z, rot = 0, o = {}) => ({ id: iid++, kind, level: 'M', x, z, rot, ...o });
const items = [
  // great room
  I('fireplace', 54, 16.75, 0, { h: 17.5 }), I('rug', 54, 24, 0, { w: 14, d: 11, color: '#d6cfc2' }),
  I('sofa', 54, 29.4, 2, { w: 9, color: '#e4ddd0' }), I('armchair', 48.6, 23.5, 3, { color: '#8a6b52' }), I('armchair', 59.4, 23.5, 1, { color: '#8a6b52' }),
  I('coffee', 54, 23.8), I('walltv', 54, 17.5, 0, { w: 5, y: 5.4 }), I('ottoman', 54, 20.4, 0, { color: '#b39b7d' }), I('sidetable', 48.9, 29.6), I('sidetable', 59.1, 29.6), I('lamp', 46.6, 26.5), I('plant', 46.4, 33), I('plant', 61.6, 44.4),
  I('bookcase', 47.8, 16.95), I('bookcase', 60.2, 16.95), I('art', 47.8, 16.6, 0, { y: 8.6, w: 3, h: 3.4, pick: .5 }), I('art', 60.2, 16.6, 0, { y: 8.6, w: 3, h: 3.4, pick: .2 }),
  // dining by the tall windows: table for six under a row of pendants
  I('rug', 58, 38, 0, { w: 8, d: 11, color: '#cfc8bb' }), I('dining6', 58, 38, 1), I('pendant', 58, 38, 1, { n: 3, top: 18.1, drop: 11.2 }),
  I('console', 62.2, 30.8, 1), I('piano', 50, 44.6, 2), I('plant', 46.4, 44.4),
  // office, seen through the big front window
  I('rug', 38, 5, 0, { w: 10, d: 8, color: '#b9876a' }), I('desk', 38, .2), I('bookcase', 33.8, 15.2, 2), I('bookcase', 37.2, 15.2, 2), I('bookcase', 40.6, 15.2, 2),
  I('armchair', 42.5, 8.5, 1, { color: '#3f5568' }), I('lamp', 43.6, 6), I('plant', 32.2, -1.8), I('plant', 43.8, -1.8), I('art', 31.6, 8, 3, { y: 4.4, w: 4, h: 2.6, pick: .8 }),
];
const design = { roof: 'gable', mainRoof: 'flat', pitch: 6, style: 'modern', ov: 1.6, ovFlat: 2.2, site: { trees: 0 }, rooms, items, ext, ops, extras: {
  trees: [[-30, 60, 1.15], [88, 36, 1.25], [36, 92, 1.3], [-44, 104, 1], [80, 76, 1.1], [92, -18, .9], [74, -8, .62]],
  pools: [[22, 44, 58, 72]],
  planters: [[31.5, 44.5, -7.5, -5.5, 1.4], [46, 62, -1.5, .5, 1.4]],
  screens: [[22.2, 22.5, -1, 6, .1, 10.8]],                       // charcoal slats beside the entry
  shrubs: [[33, -6.5, .9, 0, 1.1], [35.5, -6.6, 1, 0, 1.1], [38, -6.5, .8, 0, 1.1], [40.5, -6.6, .9, 0, 1.1], [43, -6.5, .8, 0, 1.1], [47.5, -.5, .8, 0, 1.1], [50.5, -.6, .9, 0, 1.1], [53.5, -.5, .8, 0, 1.1], [56.5, -.6, .9, 0, 1.1], [59.5, -.5, .8, 0, 1.1], [24.5, -2.2, .9], [27, -2.4, .8], [29.5, -2.2, .9], [65, 2, 1.3], [65, 8, 1.1], [65, 13, 1.2], [-2, 6, 1.2], [-2, 14, 1.3]],
  beds: [{ pts: [[22.6, -1], [31, -1], [31, -3.5], [22.6, -3.5]] }],
} };
writeFileSync(new URL('./landing-house.json', import.meta.url), JSON.stringify(design));
