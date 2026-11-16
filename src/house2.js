
// =====================================================================
//  HOUSE 2 — a separate design in the French-modern style of the reference photo.
//  Street-facing on Old Tecumseh Rd: front-gable west wing with a two-storey black window bay,
//  recessed entry with a flat limestone portico and dormer, front-gable double garage,
//  hip roof over the main body, limestone chimney, rear covered terrace and pool behind.
//  Local plan coords: x east, z toward the back; the building sits at z + OZ in the world.
// =====================================================================
const GF2 = .4, MF2 = 2.0, MC2 = 11.0, UF2 = 12.0, UC2 = 21.0, UCEIL2 = 20.1, OZ = -20;
const HOUSE2 = new THREE.Group(); scene.add(HOUSE2); HOUSE2.visible = false;
const G2 = {};
for (const k of ['main', 'mainCeil', 'upper', 'upperCeil', 'roof', 'furnM', 'furnU', 'site']) {
  G2[k] = new THREE.Group(); if (k !== 'site') G2[k].position.z = OZ; HOUSE2.add(G2[k]);
}
const TREES_H2 = new THREE.Group(); G2.site.add(TREES_H2);
const P2M = [[0, 0], [16, 0], [16, 2], [34, 2], [34, 30], [46, 30], [46, 42], [34, 42], [34, 50], [0, 50]];
const P2G = [[34, 0], [58, 0], [58, 42], [46, 42], [46, 30], [34, 30]];
const P2U = [[0, 0], [16, 0], [16, 2], [34, 2], [34, 50], [0, 50]];
const H2HOLE = rect(30, 33.6, 10.5, 23.3);
const W2 = (c, w, b, h, k) => ({ c, w, b, h, k });

function win2(par, axis, c, at, yb, w, h) { // small black-framed window set into a gable or dormer face
  const t = .17, d = .3, A = (s0, s1, y0, y1, m) => axis === 'z' ? box(par, s0, s1, y0, y1, at - d / 2, at + d / 2, m) : box(par, at - d / 2, at + d / 2, y0, y1, s0, s1, m);
  A(c - w / 2, c + w / 2, yb + t, yb + h - t, M.glass);
  A(c - w / 2, c + w / 2, yb, yb + t, M.trim2); A(c - w / 2, c + w / 2, yb + h - t, yb + h, M.trim2);
  A(c - w / 2, c - w / 2 + t, yb, yb + h, M.trim2); A(c + w / 2 - t, c + w / 2, yb, yb + h, M.trim2);
  A(c - .04, c + .04, yb, yb + h, M.trim2); A(c - w / 2, c + w / 2, yb + h * .6 - .04, yb + h * .6 + .04, M.trim2);
}
function lamp2(par, x, y, z, face) { // coach light (emissive only — no extra lights, keeps it fast)
  const d = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[face], cx = x + d[0] * .35, cz = z + d[1] * .35, ax = d[0] ? .45 : .7, az = d[1] ? .45 : .7;
  box(par, cx - ax / 2, cx + ax / 2, y - .8, y + .55, cz - az / 2, cz + az / 2, M.black);
  box(par, cx - ax / 2 + .08, cx + ax / 2 - .08, y - .6, y + .3, cz - az / 2 - .02, cz + az / 2 + .02, M.bulb, { cast: false });
}

// ---------------- Main floor ----------------
{
  const A = G2.main;
  slab(A, P2M, [], 1.0, MF2, M.ceil);
  flat(A, P2M, [], MF2 + .005, M.wood, { walk: true });
  flat(A, rect(16.2, 29.8, 2.3, 23.5), [], MF2 + .015, M.tile, { walk: true });
  flat(A, rect(34.2, 45.7, 30.2, 41.7), [], MF2 + .015, M.tile, { walk: true });
  slab(A, P2G, [], 0, GF2, M.concrete, { walk: true });
  box(A, 38.6, 41.4, GF2, 1.2, 28.0, 29.75, M.concrete, { walk: true });
  box(A, 38.6, 41.4, GF2, MF2, 28.9, 29.75, M.concrete, { walk: true });
  const C = G2.mainCeil;
  flat(C, P2G, [], 9.9, M.ceil); flat(C, rect(34, 46, 30, 42), [], 9.9, M.ceil);

  const ex = { t: EXT, y0: 1.0, y1: MC2, outer: M.lime, frame: M.trim2, lites: true };
  wall(A, .335, 0, .335, 50, { ...ex, out: '-x', ops: [W2(4.5, 3, MF2 + 1.5, 5.5), W2(24, 4, MF2, 8), W2(42, 4, MF2, 8)] });
  wall(A, 0, .335, 16, .335, { ...ex, out: '-z', ops: [W2(8, 8, MF2, 8.3)] });
  wall(A, 15.665, 0, 15.665, 2.3, { ...ex, out: '+x' });
  wall(A, 16, 2.335, 34, 2.335, { ...ex, out: '-z', ops: [W2(21.2, 1.6, MF2, 8.5), W2(25, 5.8, MF2, 8.5, 'front'), W2(28.8, 1.6, MF2, 8.5)] });
  wall(A, 34, .335, 58, .335, { ...ex, y0: 0, out: '-z', ops: [W2(46, 16, GF2, 8, 'garage')] });
  wall(A, 34.335, 0, 34.335, 2.3, { ...ex, y0: 0, y1: 10.25, out: '-x' });
  wall(A, 57.665, 0, 57.665, 42, { ...ex, y0: 0, out: '+x', ops: [W2(15, 3, 5, 4), W2(36, 3, 5, 4)] });
  wall(A, 46, 30, 46, 42, { t: .5, y0: 0, y1: MC2 });                                   // mud room | garage storage bay
  wall(A, 34, 41.665, 58, 41.665, { ...ex, y0: 0, out: '+z', ops: [W2(37, 3, MF2 + 3, 4), W2(52, 9, GF2, 8, 'garage')] }); // back wall with rear garage door
  wall(A, 33.665, 42, 33.665, 50, { ...ex, out: '+x', ops: [W2(46, 3, MF2 + 3.5, 4)] });
  wall(A, 0, 49.665, 34, 49.665, { ...ex, out: '+z', ops: [W2(10, 12, MF2, 8, 'slider'), W2(27, 6, MF2 + 3.5, 4)] });
  // house ↔ garage / mud room
  wall(A, 34, 2, 34, 30, { t: .5, y0: 0, y1: MC2 });
  wall(A, 34, 30, 34, 42, { t: .5, ops: [{ c: 36, w: 3, b: MF2, h: 7, k: 'open' }] });
  wall(A, 34, 30, 46, 30, { t: .5, y0: 0, y1: MC2, ops: [{ c: 40, w: 2.83, b: MF2, h: 6.67, k: 'door', sw: 1 }] });
  // interior
  const iy = { y0: MF2, y1: MC2 }, D = (c, w, sw = 1) => ({ c, w, b: MF2, h: 6.67, k: 'door', sw });
  wall(A, 16, 2, 16, 18, { ...iy, ops: [D(13, 2.67, -1)] });
  wall(A, .67, 18, 16, 18, iy);
  wall(A, 30, 24, 30, 29.6, { ...iy, ops: [D(26.8, 2.4, -1)] });
  wall(A, 30, 24, 34, 24, iy); wall(A, 30, 29.6, 34, 29.6, iy);
  wall(A, 40, 36, 40, 41.7, iy);
  wall(A, 40, 36, 46, 36, { ...iy, ops: [D(43, 2.5, 1)] });
  // straight stair up from the foyer, along the garage wall
  for (let i = 1; i < 16; i++) { const top = MF2 + i * .625, z0 = 10.5 + (i - 1) * .8533; box(A, 30, 33.6, top - .7, top, z0, z0 + .8533, M.wood, { walk: true }); }
  box(A, 29.7, 29.9, MF2, MF2 + 3, 10.5, 16.5, M.walnut, { solid: true });
  wall(A, 29.8, 16.5, 29.8, 23.3, { ...iy, t: .3 });
  // front porch + flat portico columns
  box(A, 17, 33, 0, MF2 - .05, -4.5, 2, M.lime, { walk: true });
  box(A, 21, 29, 0, 1.3, -6.1, -4.5, M.lime, { walk: true }); box(A, 21, 29, 0, .65, -7.7, -6.1, M.lime, { walk: true });
  for (const x of [18.6, 31.4]) box(A, x - .8, x + .8, MF2, 10.2, -4.2, -2.6, M.lime, { solid: true });
  // rear covered terrace
  box(A, 4, 28, 0, 1.85, 50, 62, M.pavers, { walk: true });
  box(A, 10, 22, 0, 1.2, 62, 63.3, M.pavers, { walk: true }); box(A, 10, 22, 0, .6, 63.3, 64.6, M.pavers, { walk: true });
  for (const x of [4.8, 27.2]) box(A, x - .8, x + .8, 1.85, 10.2, 60.4, 62, M.lime, { solid: true });
  // chimney on the west wall
  box(A, -2.6, 0, 0, 37, 30, 36, M.lime, { solid: true }); box(A, -2.9, .3, 37, 37.6, 29.7, 36.3, M.trim2);
  // tall black bay: spandrel panel between the stacked west-wing front windows
  box(A, 4, 12, 10.3, 13.2, -.12, .05, M.trim2);
  lamp2(A, 19.8, MF2 + 6.5, 2, 'n'); lamp2(A, 30.2, MF2 + 6.5, 2, 'n');
  lamp2(A, 36.6, GF2 + 7.6, 0, 'n'); lamp2(A, 55.4, GF2 + 7.6, 0, 'n');
  lamp2(A, 46.9, GF2 + 7.6, 42, 's'); lamp2(A, 57.1, GF2 + 7.6, 42, 's');
}

// ---------------- Upper floor ----------------
{
  const U = G2.upper;
  slab(U, P2U, [H2HOLE], MC2, UF2, M.ceil);
  flat(U, P2U, [H2HOLE], UF2 + .005, M.wood, { walk: true });
  flat(U, rect(.7, 9.8, 18.2, 27.8), [], UF2 + .015, M.tile, { walk: true });
  flat(U, rect(20.2, 33.3, 38.2, 49.3), [], UF2 + .015, M.tile, { walk: true });
  flat(G2.upperCeil, P2U, [], UCEIL2, M.ceil, { cast: true });
  const ex = { t: EXT, y0: MC2, y1: UC2, outer: M.lime, frame: M.trim2, lites: true };
  wall(U, .335, 0, .335, 50, { ...ex, out: '-x', ops: [W2(6, 3, UF2 + 2.3, 4.6), W2(23, 2.5, UF2 + 3.5, 3), W2(41, 3, UF2 + 2.3, 5), W2(46.5, 3, UF2 + 2.3, 5)] });
  wall(U, 0, .335, 16, .335, { ...ex, out: '-z', ops: [W2(8, 8, UF2 + 1.2, 6.3)] });
  wall(U, 15.665, 0, 15.665, 2.3, { ...ex, out: '+x' });
  wall(U, 16, 2.335, 34, 2.335, { ...ex, out: '-z', ops: [W2(22, 5, UF2 + 2.3, 4.6)] });
  wall(U, 33.665, 2, 33.665, 50, { ...ex, out: '+x', ops: [W2(20, 3, UF2 + 3, 4), W2(45, 4, UF2 + 3.5, 4)] });
  wall(U, 0, 49.665, 34, 49.665, { ...ex, out: '+z', ops: [W2(6, 4, UF2 + 2.3, 5), W2(14, 4, UF2 + 2.3, 5), W2(27, 4, UF2 + 3.5, 4)] });
  const iy = { y0: UF2, y1: UC2 }, D = (c, w, sw = 1) => ({ c, w, b: UF2, h: 6.67, k: 'door', sw });
  wall(U, 16, 2, 16, 18, iy);
  wall(U, .67, 18, 16, 18, { ...iy, ops: [D(13, 2.67, -1)] });
  wall(U, 16, 18, 29.6, 18, { ...iy, ops: [D(20, 2.67, -1)] });
  wall(U, 29.6, 2, 29.6, 18, iy);
  wall(U, 10, 18, 10, 28, { ...iy, ops: [D(23, 2.5, -1)] });
  wall(U, .67, 28, 34, 28, { ...iy, ops: [D(13, 2.67, 1)] });
  wall(U, 20, 28, 20, 50, { ...iy, ops: [D(33, 2.5, 1)] });
  wall(U, 20, 38, 34, 38, { ...iy, ops: [D(24, 2.5, 1)] });
  box(U, 29.7, 29.95, UF2, UF2 + 3.4, 18, 23.3, M.walnut, { solid: true });
  box(U, 29.7, 33.6, UF2, UF2 + 3.4, 10.3, 10.5, M.walnut, { solid: true });
}

// ---------------- Roofs ----------------
{
  const R = G2.roof, rs = { mat: M.roof2, trim: M.trim2, wall: M.lime, fascia: .45 };
  // main body: 10/12 hip (front eave is added separately so it never cuts through the west-wing bedroom)
  hipRoof(R, { ...rs, pitch: 10 / 12, ov: 1, x0: 0, x1: 34, z0: 2, z1: 50, plate: UC2, slopes: { n: true, e: true, s: true, w: true }, hidden: ['n'] });
  box(R, 15.9, 35, 19.72, 20.29, .78, 1, M.trim2); box(R, 16, 34, 19.72, 19.77, 1, 2, M.soffit);
  // west wing: front-facing gable over the two-storey black window bay
  hipRoof(R, { ...rs, pitch: 10 / 12, ov: 1, x0: 0, x1: 16, z0: -1, z1: 30, plate: UC2 - .06, slopes: { e: true, w: true }, hidden: ['w'], gables: [{ edge: 'n', at: -.02 }] });
  box(R, -1.22, -1, 19.66, 20.23, -1, 1, M.trim2);
  win2(R, 'z', 8, -.05, 22.2, 2.6, 3.2);
  // garage: steep 12/12 front gable with three windows above the door
  hipRoof(R, { ...rs, pitch: 1, ov: 1, eaveOv: 1, x0: 34, x1: 58, z0: -1, z1: 31, plate: MC2, slopes: { e: true, w: .001 }, hidden: ['w'], gables: [{ edge: 'n', at: -.02 }, { edge: 's', at: 30.02 }] });
  box(R, 33.78, 34, 9.55, 10.12, -1, 2, M.trim2);
  win2(R, 'z', 42.2, -.05, 12.6, 2.4, 4); win2(R, 'z', 46, -.05, 12.6, 3, 5.2); win2(R, 'z', 49.8, -.05, 12.6, 2.4, 4);
  win2(R, 'z', 46, 30.05, 13, 3, 4.4);
  // mud room wing
  hipRoof(R, { ...rs, pitch: 6 / 12, ov: 1, eaveOv: 1, x0: 34, x1: 58, z0: 30, z1: 42, plate: MC2, slopes: { n: .001, e: true, s: true }, hidden: ['n'] });
  // entry dormer over the front door
  box(R, 22, 28, UCEIL2 + .05, 25.5, 1.95, 8, M.lime);
  win2(R, 'z', 25, 1.9, 21.4, 3.2, 3.2);
  hipRoof(R, { ...rs, pitch: 1, ov: .4, x0: 22, x1: 28, z0: 1.5, z1: 12, plate: 25.5, slopes: { e: true, w: true }, gables: [{ edge: 'n', at: 1.92 }] });
  // flat portico + black standing-seam cap
  box(R, 17.8, 32.2, 10.2, 11.6, -5, 2.0, M.lime); box(R, 17.6, 32.4, 11.6, 11.8, -5.2, 2.0, M.metal);
  flat(R, rect(17.8, 32.2, -5, 2), [], 10.19, M.soffit);
  // black metal awning over the west-wing main window
  hipRoof(R, { mat: M.metal, trim: M.trim2, fascia: .2, pitch: 6 / 12, ov: .3, x0: 3.5, x1: 12.5, z0: -2.2, z1: 0, plate: 11.0, slopes: { n: true, e: true, w: true } });
  // rear terrace roof
  box(R, 4, 28, 10.2, 11.6, 50, 62, M.lime); box(R, 3.8, 28.2, 11.6, 11.8, 50, 62.2, M.metal);
  flat(R, rect(4, 28, 50, 62), [], 10.19, M.soffit);
}

// ---------------- Furniture ----------------
{
  const F = G2.furnM, y = MF2;
  // study
  table(F, [8.5, 14, 12, 14.5], y, 2.5, M.walnut); chair(F, 11.25, 15.4, y, 'n'); bx(F, [.7, 2.0, 8.5, 16.5], y, y + 7.5, M.walnut, { solid: true }); rug(F, [4, 15, 3, 17], y, M.rug2);
  // foyer
  rug(F, [18.5, 27, 5, 17], y); pendant(F, 23, 10, MC2, 1.6, .9);
  // great room — fireplace on the chimney wall
  fireplaceWall(F, [.67, 2.2, 30, 36], y, MC2, 'e', [2.2, 2.24, 31.3, 34.7]); tv(F, [2.2, 2.32, 31.4, 34.6], y + 4.5, y + 6.7);
  sofa(F, [9.5, 12.3, 28.5, 37.5], y, 'e'); chair(F, 5.2, 27.3, y, 's', M.fabric); chair(F, 5.2, 38.8, y, 'n', M.fabric);
  table(F, [4.6, 7.2, 31, 35], y, 1.4, M.walnut); rug(F, [3, 13.5, 26, 40], y);
  // dining
  table(F, [20, 27.4, 25, 28.4], y, 2.5, M.oak);
  for (const x of [21.4, 23.7, 26]) { chair(F, x, 24, y, 's'); chair(F, x, 29.4, y, 'n'); }
  pendant(F, 23.7, 26.7, MC2, 2.4, .9);
  // kitchen
  lowerCab(F, [22, 30, 36.6, 39.9], y, 'n'); bx(F, [21.8, 30.2, 35.8, 40.1], y + 3.0, y + 3.15, M.counter, { solid: true });
  for (const x of [23.5, 26, 28.5]) stool(F, x, 35.0, y);
  for (const x of [23, 26, 29]) pendant(F, x, 38.2, MC2, 2.6, .5);
  lowerCab(F, [31.6, 33.6, 38, 42], y, 'w'); lowerCab(F, [31.6, 33.6, 44.5, 49.3], y, 'w');
  bx(F, [31.6, 33.6, 42, 44.5], y, y + 3.0, M.steel, { solid: true }); bx(F, [32.3, 33.6, 41.9, 44.6], y + 6.0, y + 8.6, M.steel);
  upperCab(F, [32.4, 33.6, 38, 42], y + 4.6, y + 8.3);
  lowerCab(F, [21, 31.6, 47.3, 49.3], y, 'n'); sink(F, 27, 48.4, y + 3.14);
  bx(F, [31.6, 33.6, 30, 33.3], y, y + 7, M.steel, { solid: true });
  shelving(F, [30.3, 33.7, 27.6, 29.3], y, 'n');
  // mud room + powder
  bx(F, [34.4, 39.6, 30.3, 31.9], y, y + 1.6, M.walnut, { solid: true }); bx(F, [34.4, 39.6, 30.3, 30.7], y + 1.6, y + 7.5, M.cab);
  vanity(F, [40.25, 42, 38, 40.6], y, 'e', [[41.1, 39.3]]); toilet(F, 44.2, 41.0, y, 'n');
  // garage — car facing the street door
  const car = new THREE.Group(); box(car, -7.6, 7.6, 1.1, 3.3, -3.1, 3.1, M.car); box(car, -3.4, 3.8, 3.3, 4.9, -2.7, 2.7, M.glass); box(car, -3.0, 3.4, 4.9, 5.0, -2.6, 2.6, M.car);
  for (const [x, z] of [[-4.8, -3.1], [4.8, -3.1], [-4.8, 3.1], [4.8, 3.1]]) { const w = cyl(car, 0, 0, 1.15, -.4, .4, M.black, 16); w.rotation.x = Math.PI / 2; w.position.set(x, 1.15, z); }
  car.rotation.y = Math.PI / 2; car.position.set(42, GF2, 14); F.add(car);
  const k = box(F, 42 - 3.1, 42 + 3.1, GF2, GF2 + 5, 14 - 7.6, 14 + 7.6, M.glass, { solid: true, cast: false }); k.visible = false; k.userData.ghost = true;
  bx(F, [55.8, 57.3, 6, 24], GF2, GF2 + 7, M.walnut, { solid: true });
  shelving(F, [46.4, 48, 31, 40], GF2, 'e'); bx(F, [55.9, 57.3, 31, 39], GF2, GF2 + 3.2, M.walnut, { solid: true });
  // terrace
  sofa(F, [6, 15, 51, 53.8], 1.85, 'n', M.fabric2); table(F, [8, 13, 55, 57.5], 1.85, 1.4, M.walnut);
  table(F, [18, 25, 54, 57.5], 1.85, 2.5, M.walnut); for (const x of [19.5, 23.5]) { chair(F, x, 53, 1.85, 's', M.fabric); chair(F, x, 58.5, 1.85, 'n', M.fabric); }
}
{
  const F = G2.furnU, y = UF2;
  bed(F, [.67, 7.4, 6.5, 11.5], y, 'w'); closet(F, [.8, 7.0, 15.6, 17.8], y, 'n'); rug(F, [3, 12, 4, 14], y, M.rug2);
  bed(F, [20.3, 25.3, 11.3, 17.8], y, 's'); closet(F, [26.2, 29.4, 2.7, 7], y, 'w');
  vanity(F, [.7, 2.5, 19, 24], y, 'e', [[1.6, 21.5]]); toilet(F, 8.4, 19.0, y, 's'); tub(F, [.7, 5.7, 25.2, 27.8], y);
  bed(F, [.67, 7.7, 35.5, 42], y, 'w', { hb: M.fabric }); bx(F, [8.6, 10.1, 36, 41.5], y, y + 1.6, M.fabric2, { solid: true });
  chair(F, 14, 46, y, 'n', M.fabric); chair(F, 17, 46, y, 'n', M.fabric); rug(F, [3, 15, 31, 46], y);
  shelving(F, [20.4, 22.2, 28.6, 37.6], y, 'e'); shelving(F, [31.6, 33.4, 28.6, 37.6], y, 'w'); bx(F, [25.2, 28.8, 31.2, 35], y, y + 3, M.walnut, { solid: true });
  tub(F, [25, 31, 46.3, 49.1], y); vanity(F, [31.6, 33.6, 39, 45], y, 'w', [[32.6, 40.5], [32.6, 43.5]]); toilet(F, 21.3, 46.5, y, 'e');
  box(F, 20.4, 24.6, y, y + 7, 42.15, 42.22, M.glass, { solid: true }); box(F, 24.55, 24.62, y, y + 7, 38.4, 41.0, M.glass, { solid: true });
  closet(F, [30.1, 33.5, 2.7, 10.25], y, 's');
}

// ---------------- Site: interior lot, street in front, fenced backyard with pool behind ----------------
const POOL_H2 = rect(-3, 37, 58, 76);
{
  const S = G2.site, T = TREES_H2;
  flat(S, rect(-420, 420, -420, 420), [POOL_H2], 0, M.grass, { walk: true });
  const lot = [[-25, -67.9], [80, -44.9], [80, 100], [-25, 100], [-25, -67.9]];
  const ll = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lot.map(([x, z]) => new THREE.Vector3(x, .2, z))), new THREE.LineDashedMaterial({ color: 0xf5f5f0, dashSize: 4, gapSize: 3 }));
  ll.computeLineDistances(); S.add(ll);
  // Old Tecumseh Rd + sidewalk
  const A0 = [-53.3, -84.4], dir = [0.977, 0.2115], nrm = [0.2115, -0.977];
  const p = (t, off = 0) => [A0[0] + dir[0] * t - nrm[0] * off, A0[1] + dir[1] * t - nrm[1] * off];
  flat(S, [p(-260), p(190), p(190, -26), p(-260, -26)], [], .03, M.asphalt, { walk: true });
  flat(S, [p(-260, 4), p(190, 4), p(190, 9), p(-260, 9)], [], .06, M.concrete, { walk: true });
  const zAt = (x, off) => -84.4 + (x + 53.3) * 0.2165 + off;
  for (const x of [-95, -60, -25, -5, 80, 110, 145]) tree(x, zAt(x, 16), .9, T);
  for (const x of [-40, 20, 66]) { const z = zAt(x, 11); cyl(S, x, z, .18, 0, 12, M.black, 8, { solid: true }); box(S, x - .5, x + .5, 11.4, 12.6, z - .5, z + .5, M.bulb, { cast: false }); }
  cyl(S, 58.5, zAt(58.5, 11), .15, 0, 3.6, M.black, 6); box(S, 57.9, 59.1, 3.6, 4.6, zAt(58.5, 11) - .9, zAt(58.5, 11) + .9, M.black);
  // driveway to the street-facing garage, front walk from the portico
  box(S, 37, 55, 0, .12, zAt(46, 0), -20, M.concrete, { walk: true });
  box(S, 34, 58, 0, .12, zAt(46, -4), zAt(46, 6), M.concrete, { walk: true });
  box(S, 23, 27, 0, .1, -36, -27.7, M.pavers, { walk: true }); box(S, 23, 37, 0, .1, -36, -32, M.pavers, { walk: true });
  for (let z = -56; z <= -26; z += 10) for (const x of [36.2, 55.8]) { cyl(S, x, z, .25, 0, 2.6, M.black, 10); cyl(S, x, z, .2, 2.0, 2.4, M.bulb, 10); }
  box(S, .5, 15.5, 0, 1.8, -23.6, -21.8, M.leaf2, { solid: true });
  box(S, 17.4, 20.6, 0, 1.6, -27.6, -26.0, M.leaf2); box(S, 29.4, 32.6, 0, 1.6, -27.6, -26.0, M.leaf2);
  tree(-14, -36, 1, T); tree(70, -30, .9, T);
  // neighbours
  const nb1 = std({ map: TX.stucco, color: '#d9d5cc', roughness: .95 }), nb2 = std({ map: TX.stone, color: '#cbbfae', roughness: .9 });
  const nbRoof = std({ map: TX.shingle, color: '#5b5d61', roughness: .9, side: THREE.DoubleSide });
  for (const [x0, x1, z0, z1, m, d0] of [[-82, -42, -58, -16, nb1, -62], [102, 144, -36, 6, nb2, 118]]) {
    box(S, x0, x1, 0, 21, z0, z1, m, { solid: true });
    for (let x = x0 + 5; x < x1 - 4; x += 9) for (const yy of [3.5, 13.5]) box(S, x, x + 4, yy, yy + 5, z0 - .1, z0 + .05, M.glass);
    hipRoof(S, { x0, x1, z0, z1, plate: 21, pitch: 6 / 12, ov: 1.5, slopes: { n: true, e: true, s: true, w: true }, mat: nbRoof });
    box(S, d0 - 9, d0 + 9, 0, .1, zAt(d0, 0) + 1, z0, M.concrete, { walk: true });
  }
  // backyard fence with side gates
  const Fn = (x0, x1, z0, z1) => { box(S, x0, x1, 0, 6, z0, z1, M.fence, { solid: true }); box(S, x0 - .1, x1 + .1, 6, 6.25, z0 - .1, z1 + .1, M.walnut); };
  Fn(-25.3, -24.7, 0, 100); Fn(79.7, 80.3, 0, 100); Fn(-25, 80, 99.7, 100.3);
  Fn(-25, -19, -.3, .3); Fn(-15, 0, -.3, .3);
  Fn(58, 66, -.3, .3); Fn(70, 80, -.3, .3);
  // pool, coping, deck joining the terrace steps
  for (const r of [[-3, 37, 58, 58.3], [-3, 37, 75.7, 76], [-3, -2.7, 58, 76], [36.7, 37, 58, 76]]) box(S, r[0], r[1], -5, 0, r[2], r[3], M.pooltile);
  flat(S, POOL_H2, [], -5, M.pooltile);
  flat(S, POOL_H2, [], -0.45, M.water, { walk: true });
  for (const r of [[-4.2, 38.2, 56.8, 58], [-4.2, 38.2, 76, 77.2], [-4.2, -3, 56.8, 77.2], [37, 38.2, 56.8, 77.2]]) box(S, r[0], r[1], 0, .18, r[2], r[3], M.white, { walk: true });
  slab(S, rect(-10, 46, 44.6, 82), [rect(-4.2, 38.2, 56.8, 77.2)], 0, .12, M.pavers, { walk: true });
  for (const x of [-1, 3.5, 30.5, 35]) {
    box(S, x - 1.15, x + 1.15, 0, 1.0, 48.5, 55, M.white, { solid: true }); box(S, x - 1.0, x + 1.0, 1.0, 1.35, 48.7, 54.8, M.bedding);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, .35, 2.4), M.bedding); back.position.set(x, 2.0, 49.6); back.rotation.x = .8; back.castShadow = true; S.add(back);
  }
  for (const x of [1.2, 32.8]) { cyl(S, x, 51.8, .1, 0, 8.5, M.white, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(5, 1.6, 8), M.bedding); u.position.set(x, 9.0, 51.8); u.castShadow = true; S.add(u); }
  box(S, 46.5, 57.5, 0, .12, 22, 29, M.concrete, { walk: true });
  box(S, 50.5, 54, 0, .1, 29, 52, M.pavers, { walk: true });
  // cabana + outdoor kitchen
  box(S, 50, 64, 0, .15, 52, 72, M.pavers, { walk: true });
  for (const [x, z] of [[50.4, 52.4], [63.6, 52.4], [50.4, 71.6], [63.6, 71.6]]) box(S, x - .7, x + .7, 0, 9, z - .7, z + .7, M.lime, { solid: true });
  box(S, 49.4, 64.6, 9, 10.2, 51.4, 72.6, M.lime); box(S, 49.2, 64.8, 10.2, 10.4, 51.2, 72.8, M.metal);
  flat(S, rect(49.4, 64.6, 51.4, 72.6), [], 8.98, M.soffit);
  box(S, 61.4, 63.8, 0, 3.0, 54, 70, M.lime, { solid: true }); box(S, 61.2, 63.9, 3.0, 3.15, 53.8, 70.2, M.black); box(S, 61.8, 63.6, 3.15, 4.0, 58, 62, M.steel);
  table(S, [53, 58, 58.5, 65.5], 0.15, 2.5, M.walnut);
  for (const z of [60, 64]) { chair(S, 52, z, .15, 'e', M.fabric); chair(S, 59, z, .15, 'w', M.fabric); }
  // fire pit
  const pad = cyl(S, 63, 86, 8.5, 0, .12, M.pavers, 40); walkables.push(pad);
  cyl(S, 63, 86, 2.4, .12, 1.4, M.lime, 24, { solid: true }); cyl(S, 63, 86, 1.7, 1.4, 1.42, M.black, 24); cyl(S, 63, 86, .9, 1.42, 2.3, M.flame, 10, { r2: .1 });
  for (const [a, f] of [[0, 'w'], [1.26, 'n'], [2.5, 'e'], [3.8, 'e'], [5.0, 's']]) chair(S, 63 + Math.cos(a) * 5.5, 86 + Math.sin(a) * 5.5, .12, f, M.oak);
  // planting
  box(S, -24, 50, 0, .5, 93, 99, M.bark);
  for (let x = -21; x < 50; x += 7) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), x % 2 ? M.leaf : M.leaf2); b.position.set(x, 2.0, 96); b.castShadow = true; S.add(b); }
  for (const t of [[-19, 92, .9], [-19, 40, .8], [74, 40, .8]]) tree(t[0], t[1], t[2], T);
}

// ---------------- Rooms (world coords) ----------------
const r2 = (x0, x1, z0, z1) => [x0, x1, z0 + OZ, z1 + OZ];
const ROOMS2 = [
  ['Front Entry', 'M', [r2(17, 33, -7.7, 2)], [25, -44, Math.PI]],
  ['Foyer', 'M', [r2(16.2, 29.8, 2.3, 23.5)], [24, -15, Math.PI]],
  ['Study', 'M', [r2(.7, 16, .7, 18)], [14.5, -7, Math.PI / 2]],
  ['Great Room', 'M', [r2(.7, 18, 18, 49.3)], [16, 6, Math.PI * .75]],
  ['Dining', 'M', [r2(18, 29.6, 23.5, 30)], [28.5, 10.5, Math.PI * .7]],
  ['Kitchen', 'M', [r2(18, 33.6, 30, 49.3)], [20, 13, -Math.PI * .7]],
  ['Pantry', 'M', [r2(30.2, 33.8, 24.2, 29.4)], [28.5, 6.8, -Math.PI / 2]],
  ['Mud Room', 'M', [r2(34.2, 40, 30.2, 41.8), r2(40, 45.8, 30.2, 36)], [36, 19, -Math.PI / 2]],
  ['Powder Room', 'M', [r2(40.2, 45.8, 36.2, 41.8)], [43, 18.5, Math.PI]],
  ['Garage', 'M', [r2(34.2, 57.8, .3, 29.8), r2(46.2, 57.8, 29.8, 41.8)], [37, 6, 0]],
  ['Rear Terrace', 'M', [r2(4, 28, 50, 62)], [16, 41, 0]],
  ['Bedroom 2', 'U', [r2(.7, 16, .7, 18)], [13.5, -3.5, Math.PI * .6]],
  ['Bedroom 3', 'U', [r2(16.2, 29.4, 2.3, 18)], [20, -3.5, Math.PI * .8]],
  ['Upstairs Hall', 'U', [r2(10, 29.6, 18, 28), r2(29.6, 33.6, 23.3, 28)], [31.8, 4.5, Math.PI * .85]],
  ['Hall Bath', 'U', [r2(.7, 10, 18, 28)], [9, 3, Math.PI * .6]],
  ['Primary Bedroom', 'U', [r2(.7, 20, 28, 49.3)], [16, 10, Math.PI * .75]],
  ['Walk-in Closet', 'U', [r2(20, 33.6, 28, 38)], [21.5, 13, -Math.PI * .7]],
  ['Primary Bath', 'U', [r2(20, 33.6, 38, 49.3)], [24, 20, -Math.PI * .8]],
];
const OUTLINE2 = { M: [P2M.map(([x, z]) => [x, z + OZ]), P2G.map(([x, z]) => [x, z + OZ])], U: [P2U.map(([x, z]) => [x, z + OZ])] };
