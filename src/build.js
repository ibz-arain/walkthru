
// =====================================================================
//  BASEMENT  (A-2.01 foundation plan)
// =====================================================================
const P_B = [[0, 0], [10, 0], [10, -5.9], [21.4, -5.9], [21.4, 0], [31.7, 0], [31.7, 14.6], [28.95, 14.6], [28.95, 30.2], [53.3, 30.2], [53.3, 41.3], [29.68, 41.3], [29.68, 44], [0, 44]];
const STAIR_HOLE = rect(0.67, 10.0, 15.5, 22.95);
{
  const B = G.basement, fy = { y0: BF, y1: TF, t: EXT, mat: M.paint, outer: M.found };
  slab(B, P_B, [], BF - .4, BF, M.found, { cast: false });
  flat(B, P_B, [], BF + .005, M.concrete, { walk: true });
  // finished floors (LVP) in living spaces, tile in bath
  for (const r of [[0.67, 12, 0.67, 15.1], [12, 18.4, 0.67, 25.9], [19.8, 31.0, 0.67, 14.3], [0.67, 28.6, 25.9, 43.3], [11.4, 18.4, 23.15, 25.9]]) flat(B, rect(...r), [], BF + .015, M.lvp, { walk: true });
  flat(B, rect(0.67, 11.4, 23.35, 31.0), [], BF + .02, M.tile, { walk: true });
  flat(G.mainCeil, P_B, [STAIR_HOLE], BC - .01, M.ceil);
  // foundation walls
  wall(B, 0.335, 0, 0.335, 44, { ...fy, out: '-x', ops: [{ c: 8.2, w: 4, b: -0.75, h: 1.9 }] });
  wall(B, 0, 0.335, 31.7, 0.335, { ...fy, out: '-z', ops: [{ c: 15.6, w: 2.83, b: BF, h: 6.67, k: 'door', sw: -1 }] });
  wall(B, 10.335, -5.9, 10.335, 0, { ...fy, out: '-x' });
  wall(B, 10, -5.565, 21.4, -5.565, { ...fy, out: '-z' });
  wall(B, 21.065, -5.9, 21.065, 0, { ...fy, out: '+x' });
  wall(B, 31.365, 0, 31.365, 14.6, { ...fy, out: '+x' });
  wall(B, 28.6, 14.45, 31.7, 14.45, { ...fy, out: '+z' });
  wall(B, 28.615, 14.45, 28.615, 30.2, { ...fy, out: '+x' });
  wall(B, 28.95, 30.535, 53.3, 30.535, { ...fy, out: '-z' });
  wall(B, 52.965, 30.2, 52.965, 41.3, { ...fy, out: '+x' });
  wall(B, 29.68, 40.965, 53.3, 40.965, { ...fy, out: '+z' });
  wall(B, 29.345, 41.0, 29.345, 44, { ...fy, out: '+x' });
  wall(B, 0, 43.665, 29.68, 43.665, { ...fy, out: '+z', ops: [{ c: 4.75, w: 4, b: -0.75, h: 1.9 }, { c: 25.1, w: 4, b: -0.75, h: 1.9 }] });
  // interior partitions
  const iy = { y0: BF, y1: BC };
  wall(B, 12.0, 0.67, 12.0, 15.3, { ...iy, ops: [{ c: 10.7, w: 2.5, b: BF, h: 6.67, k: 'door', sw: -1 }] });
  wall(B, 0.67, 15.3, 12.0, 15.3, iy);
  wall(B, 0.67, 23.15, 11.6, 23.15, iy);
  wall(B, 11.6, 23.15, 11.6, 31.2, { ...iy, ops: [{ c: 25.2, w: 2.5, b: BF, h: 6.67, k: 'door', sw: -1 }] });
  wall(B, 0.67, 31.2, 11.6, 31.2, iy);
  wall(B, 19.8, 0.67, 19.8, 3.6, { ...iy, t: .5 });
  wall(B, 18.4, 14.45, 28.6, 14.45, iy);
  wall(B, 18.4, 14.45, 18.4, 25.7, { ...iy, ops: [{ c: 17.0, w: 2.67, b: BF, h: 6.67, k: 'door', sw: -1 }] });
  wall(B, 18.4, 25.7, 28.6, 25.7, iy);
  wall(B, 28.785, 30.2, 28.785, 41.0, { ...iy, ops: [{ c: 35.2, w: 2.83, b: BF, h: 6.67, k: 'door', sw: -1 }] });
  wall(B, 4.2, 19.2, 10.0, 19.2, { y0: BF, y1: MF });
  // steel beam + post (W8x20)
  box(B, 18.1, 18.5, BC - .7, BC, 25.7, 43.3, M.steel); box(B, 18.15, 18.45, BF, BC - .7, 34.0, 34.3, M.steel, { solid: true });
  // stair down from main (south strip) → landing → north strip to basement
  flight(B, 4.2, 10.0, 19.4, 22.95, MF - 4.54, MF, 7);
  box(B, 0.67, 4.2, MF - 4.54 - .7, MF - 4.54, 15.5, 22.95, M.wood, { walk: true });
  flight(B, 10.0, 4.2, 15.5, 19.0, BF, MF - 4.54, 7);
}

// =====================================================================
//  MAIN FLOOR  (A-2.02)
// =====================================================================
const P_M = [[0, 0], [31.7, 0], [31.7, 15.0], [29.35, 15.0], [29.35, 29.25], [37.0, 29.25], [37.0, 31.35], [53.3, 31.35], [53.3, 41.3], [29.68, 41.3], [29.68, 44], [0, 44]];
const P_GAR = [[31.7, 1.67], [53.3, 1.67], [53.3, 31.35], [37.0, 31.35], [37.0, 29.25], [29.35, 29.25], [29.35, 15.0], [31.7, 15.0]];
{
  const A = G.main;
  slab(A, P_M, [STAIR_HOLE], BC, MF, M.ceil);
  flat(A, P_M, [STAIR_HOLE], MF + .005, M.wood, { walk: true });
  flat(A, rect(12.3, 19.4, 0.67, 12.7), [], MF + .015, M.tile, { walk: true });       // foyer
  flat(A, rect(29.5, 48.7, 29.45, 40.8), [], MF + .015, M.tile, { walk: true });       // mud room
  flat(A, rect(49.1, 52.65, 31.55, 40.8), [], MF + .015, M.tile, { walk: true });      // powder
  slab(A, P_GAR, [], 0, GF, M.concrete, { walk: true });
  // garage → mud room steps (2'-0" rise)
  box(A, 37.2, 40.3, GF, 1.11, 29.6, 31.15, M.concrete, { walk: true });
  box(A, 37.2, 40.3, GF, 1.72, 30.2, 31.15, M.concrete, { walk: true });
  box(A, 37.2, 40.3, GF, MF, 30.75, 31.15, M.concrete, { walk: true });
  // ceilings for one-storey parts (hidden in plan views)
  const C = G.mainCeil;
  flat(C, rect(0, 31.7, 0, UZ), [], MC - .01, M.ceil);
  flat(C, P_GAR, [], MC - .01, M.ceil);
  flat(C, rect(29.35, 53.3, 31.35, 41.3), [], MC - .01, M.ceil);

  const ex = { t: EXT, y0: TF, y1: MC, out: '', skirt: true };
  const W = (c, w, b, h, k) => ({ c, w, b, h, k });
  wall(A, 0.335, 0, 0.335, 44, { ...ex, out: '-x', ops: [W(2.6, 2.33, MF, 8.08), W(13.0, 2.33, MF, 8.08), W(19.4, 6, 3.8, 2), W(29.05, 7.92, MF, 7.95, 'slider'), W(38.25, 7.92, MF, 7.95, 'slider')] });
  wall(A, 0, 0.335, 31.7, 0.335, { ...ex, out: '-z', ops: [W(3.9, 4.08, MF, 8.08), W(8.6, 4.08, MF, 8.08), W(16.0, 5.67, MF, 8.0, 'front'), W(23.2, 4.08, MF, 8.08), W(28.25, 4.08, MF, 8.08)] });
  wall(A, 31.365, 0, 31.365, 15.0, { t: .55, y0: TF, y1: MC, out: '+x', outer: M.paint });
  wall(A, 31.7, 2.005, 53.3, 2.005, { ...ex, y0: 0, out: '-z', ops: [W(36.2, 4.08, MF, 8.08), W(42.45, 4.08, MF, 8.08), W(48.35, 4.08, MF, 8.08)] });
  wall(A, 52.965, 1.67, 52.965, 41.3, { ...ex, y0: 0, out: '+x', ops: [W(8.25, 9, GF, 8, 'garage'), W(18.15, 9, GF, 8, 'garage')] });
  wall(A, 29.68, 40.965, 53.3, 40.965, { ...ex, out: '+z', ops: [W(36.7, 5.5, 5.1, 4)] });
  wall(A, 29.345, 41.0, 29.345, 44, { ...ex, out: '+x' });
  wall(A, 0, 43.665, 29.68, 43.665, { ...ex, out: '+z', ops: [W(20.3, 8.33, 8.06, 2)] });
  // house ↔ garage
  wall(A, 29.35, 15.0, 31.6, 15.0, { t: .5, y0: 0 });
  wall(A, 29.35, 15.0, 29.35, 41.0, { t: .5, y0: 0, ops: [{ c: 35.15, w: 2.9, b: MF, h: 6.9, k: 'open' }] });
  wall(A, 29.35, 29.25, 37.0, 29.25, { y0: 0 });
  wall(A, 37.0, 29.25, 37.0, 33.7, { y0: 0 });
  wall(A, 37.0, 31.35, 52.97, 31.35, { y0: 0, ops: [{ c: 38.85, w: 2.83, b: MF, h: 6.67, k: 'door', sw: 1 }] });
  // interior
  wall(A, 12.05, 0.67, 12.05, 4.3); wall(A, 19.65, 0.67, 19.65, 4.3);
  box(A, 10.8, 12.3, MF, MC, 12.7, 15.1, M.paint, { solid: true });
  box(A, 19.4, 20.9, MF, MC, 12.7, 15.1, M.paint, { solid: true });
  wall(A, 0.67, 15.3, 10.8, 15.3); wall(A, 0.67, 23.15, 10.8, 23.15);
  wall(A, 4.2, 19.2, 11.3, 19.2, { y0: MF, y1: MC });
  wall(A, 40.2, 31.35, 40.2, 33.6); wall(A, 40.2, 36.6, 40.2, 40.97);
  wall(A, 48.9, 31.35, 48.9, 40.97, { ops: [{ c: 35.4, w: 2.5, b: MF, h: 6.67, k: 'door', sw: 1 }] });
  // stairs up: north strip westward → landing → south strip eastward
  flight(A, 10.0, 4.2, 15.5, 19.0, MF, MF + 5.07, 8);
  box(A, 0.67, 4.2, MF + 5.07 - .7, MF + 5.07, 15.5, 22.95, M.wood, { walk: true });
  flight(A, 4.2, 10.0, 19.4, 22.95, MF + 5.07, UF, 8);
  for (const z of [16.0, 22.4]) box(A, 0.75, 9.8, MF + 3.2, MF + 3.32, z - .06, z + .06, M.walnut);

  // ---- front porch, columns ----
  box(A, 9.65, 22.2, BC, 2.15, -5.9, 0, M.concrete, { walk: true });
  for (const [a, b, c, d] of [[9.65, 22.2, -5.9, -5.5], [9.65, 10.05, -5.9, 0], [21.8, 22.2, -5.9, 0]]) box(A, a, b, -0.4, BC, c, d, M.stone);
  box(A, 12.4, 19.3, 0, 1.45, -6.65, -5.9, M.concrete, { walk: true });
  box(A, 12.4, 19.3, 0, 0.75, -7.4, -6.65, M.concrete, { walk: true });
  for (const x of [11.15, 20.65]) box(A, x - 1.1, x + 1.1, 2.15, 10.43, -5.8, -3.6, M.stone, { solid: true });
  // ---- covered rear patio (west), stone piers ----
  box(A, -13.7, 0, 1.9, 2.1, 21.8, 44.0, M.deck, { walk: true });
  for (const [a, b, c, d] of [[-13.7, -13.4, 21.8, 44], [-13.7, 0, 21.8, 22.1], [-13.7, 0, 43.7, 44]]) box(A, a, b, 0, 1.9, c, d, M.walnut);
  box(A, -15.4, -13.7, 0, 1.4, 29.5, 36.5, M.deck, { walk: true });
  box(A, -16.9, -15.4, 0, 0.7, 29.5, 36.5, M.deck, { walk: true });
  for (const z of [23.4, 42.5]) box(A, -13.4, -10.9, 0, 10.43, z - 1.25, z + 1.25, M.stone, { solid: true });
}

// =====================================================================
//  2ND FLOOR  (A-2.03) — local coords, group offset z +2'-6½"
// =====================================================================
const P_U = [[0, 0], [10.1, 0], [10.1, -2.6], [21.5, -2.6], [21.5, 0], [31.3, 0], [31.3, 20.5], [52.9, 20.5], [52.9, 38.2], [29.2, 38.2], [29.2, 40.8], [0, 40.8]];
const U_HOLE = rect(0.67, 9.7, 12.96, 20.41);
{
  const U = G.upper;
  slab(U, P_U, [U_HOLE], MC, UF, M.ceil);
  flat(U, P_U, [U_HOLE], UF + .005, M.wood, { walk: true });
  for (const r of [[10.7, 20.9, -2.3, 0.6], [12.8, 20.0, 0.6, 14.5], [17.1, 28.8, 21.1, 27.5], [31.3, 52.3, 20.9, 29.4], [41.2, 52.3, 29.4, 37.6], [36.4, 41.2, 29.4, 29.6]])
    flat(U, rect(...r), [], UF + .015, M.tile, { walk: true });
  flat(G.upperCeil, P_U, [], UC - .02, M.ceil, { cast: true });

  const ex = { t: 0.6, y0: MC, y1: UC, out: '' };
  const W = (c, w, b, h, k) => ({ c, w, b, h, k });
  wall(U, 0.3, 0, 0.3, 40.8, { ...ex, out: '-x', ops: [W(1.9, 2.33, 15.3, 3.92), W(16.95, 6, 17.4, 2), W(26.5, 7, 14.9, 5), W(31.37, 2.33, 14.9, 5), W(38.4, 2.67, UF, 6.67, 'extdoor')] });
  wall(U, 0, 0.3, 10.1, 0.3, { ...ex, out: '-z', ops: [W(5.0, 8, 15.4, 3.83)] });
  wall(U, 10.4, -2.6, 10.4, 0.3, { ...ex, out: '-x' });
  wall(U, 10.1, -2.3, 21.5, -2.3, { ...ex, out: '-z', ops: [W(15.8, 8.17, 15.4, 3.83)] });
  wall(U, 21.2, -2.6, 21.2, 0.3, { ...ex, out: '+x' });
  wall(U, 21.5, 0.3, 31.3, 0.3, { ...ex, out: '-z', ops: [W(26.45, 8, 15.4, 3.83)] });
  wall(U, 31.0, 0, 31.0, 20.8, { ...ex, out: '+x', ops: [W(1.9, 2.33, 15.3, 3.92)] });
  wall(U, 31.3, 20.8, 52.9, 20.8, { ...ex, out: '-z', ops: [W(46.85, 6.92, 15.7, 3.5)] });
  wall(U, 52.6, 20.5, 52.6, 38.2, { ...ex, out: '+x' });
  wall(U, 29.2, 37.9, 52.9, 37.9, { ...ex, out: '+z', ops: [W(46.85, 6.92, 15.7, 3.5)] });
  wall(U, 29.5, 37.9, 29.5, 40.8, { ...ex, out: '+x' });
  wall(U, 0, 40.5, 29.5, 40.5, { ...ex, out: '+z', ops: [W(22.8, 6.92, 15.7, 3.5)] });
  // EIFS sill band at the floor line (A-3.01 "EIFS sill w/ grooved drip edge")
  box(U, -0.25, 0.6, 11.3, 12.5, -0.0, 40.8, M.stucco);
  box(U, 0, 29.5, 11.3, 12.5, 40.2, 41.46, M.stucco);
  box(U, 29.2, 53.3, 11.3, 12.5, 37.6, 38.76, M.stucco);
  box(U, 52.3, 53.55, 11.3, 12.5, 20.5, 38.76, M.stucco);

  const iy = { y0: UF, y1: UC };
  const D = (c, w, sw = 1, hinge) => ({ c, w, b: UF, h: 6.67, k: 'door', sw, hinge });
  wall(U, 12.6, 0.3, 12.6, 14.7, { ...iy, ops: [D(2.4, 2.5, 1)] });
  wall(U, 0.3, 12.6, 12.6, 12.6, { ...iy, ops: [D(10.95, 2.5, -1)] });
  wall(U, 9.5, 12.6, 9.5, 16.4, iy);
  wall(U, 3.9, 16.4, 11.15, 16.4, { y0: MC, y1: UC });
  wall(U, 0.3, 20.35, 10.6, 20.35, iy);
  wall(U, 10.4, 20.35, 10.4, 25.4, iy);
  wall(U, 10.4, 25.4, 16.9, 25.4, { ...iy, ops: [D(12.2, 2.67, 1)] });
  wall(U, 16.9, 14.7, 16.9, 27.9, { ...iy, ops: [D(16.85, 2.67, 1), D(23.3, 2.67, 1)] });
  wall(U, 12.6, 14.7, 20.2, 14.7, iy);
  wall(U, 20.2, 0.3, 20.2, 14.7, { ...iy, ops: [D(5.5, 2.5, 1)] });
  wall(U, 12.6, 8.6, 20.2, 8.6, { ...iy, ops: [{ c: 14.85, w: 3.5, b: UF, h: 7.2, k: 'open' }, D(18.7, 2.17, 1)] });
  wall(U, 16.9, 8.6, 16.9, 14.7, iy);
  box(U, 19.8, 20.9, UF, UC, -2.0, 0.3, M.paint, { solid: true });
  wall(U, 16.9, 20.9, 29.2, 20.9, iy);
  wall(U, 16.9, 27.7, 29.2, 27.7, iy);
  wall(U, 29.0, 20.9, 29.0, 29.6, iy);
  box(U, 29.2, 31.3, UF, UC, 20.9, 29.6, M.paint, { solid: true });
  wall(U, 31.3, 25.3, 36.4, 25.3, iy);
  wall(U, 36.4, 25.3, 36.4, 29.6, { ...iy, ops: [D(27.45, 2.33, 1)] });
  wall(U, 29.2, 29.6, 41.0, 29.6, iy);
  wall(U, 41.0, 29.6, 41.0, 37.9, { ...iy, ops: [{ c: 33.65, w: 3.3, b: UF, h: 7.4, k: 'open' }] });
  wall(U, 29.0, 29.6, 29.0, 40.5, { ...iy, ops: [{ c: 33.5, w: 3.8, b: UF, h: 6.9, k: 'open' }] });
  wall(U, 16.9, 30.6, 16.9, 40.5, iy);
  // shower glass
  box(U, 13.1, 16.6, UF, UF + 7, 8.75, 8.8, M.glass, { solid: true });
  box(U, 36.25, 36.32, UF, UF + 7, 20.9, 24.0, M.glass, { solid: true });
  // balcony over the covered patio
  box(U, -13.7, 0.3, 10.43, UF, 19.26, 41.46, M.stucco, { walk: true });
  flat(U, rect(-13.2, 0.3, 19.76, 40.96), [], UF + .01, M.tile, { walk: true });
  flat(U, rect(-13.7, 0.3, 19.26, 41.46), [], 10.42, M.soffit);
  for (const r of [[-13.7, -13.2, 19.26, 41.46], [-13.7, 0.3, 19.26, 19.76], [-13.7, 0.3, 40.96, 41.46]]) box(U, r[0], r[1], UF, UF + 3.5, r[2], r[3], M.stucco, { solid: true });
  for (const r of [[-13.8, -13.1, 19.16, 41.56], [-13.8, 0.3, 19.16, 19.86], [-13.8, 0.3, 40.86, 41.56]]) box(U, r[0], r[1], UF + 3.5, UF + 3.62, r[2], r[3], M.trim);
}

// =====================================================================
//  ROOFS  (A-2.03 roof plan, 4/12 hip, 3'-0" overhang)
// =====================================================================
{
  const R = G.roof;
  hipRoof(R, { x0: 0, x1: 31.3, z0: UZ, z1: UZ + 40.8, plate: UC, slopes: { n: true, e: true, s: true, w: true } });
  hipRoof(R, { x0: 13, x1: 52.9, z0: UZ + 20.5, z1: UZ + 38.2, plate: UC, slopes: { n: true, e: true, s: true, w: true }, hidden: ['w'] });
  hipRoof(R, { x0: 10.1, x1: 21.5, z0: UZ - 2.6, z1: 14.0, plate: UC, slopes: { n: true, e: true, s: true, w: true }, hidden: ['s'] });
  hipRoof(R, { x0: 31.3, x1: 53.3, z0: 1.67, z1: UZ + 20.5, plate: MC, slopes: { n: true, e: true } });
  hipRoof(R, { x0: 0, x1: 31.3, z0: 0, z1: UZ, plate: MC, slopes: { n: true, w: true } });
  hipRoof(R, { x0: 9.65, x1: 22.2, z0: -5.9, z1: 0, plate: MC, ov: 1.5, slopes: { n: true, e: true, w: true } });
  box(R, 9.65, 22.2, 9.9, 10.43, -5.9, -3.5, M.stucco);
  flat(R, rect(9.65, 22.2, -5.9, 0), [], 9.89, M.soffit);
}

// =====================================================================
//  SITE  (A-1.01: lot 39.62 m × 41.86 m, Bay St east, Old Tecumseh Rd north)
// =====================================================================
const POOL = rect(-43.2, -25.3, 6.2, 46.1);
{
  const S = G.site;
  flat(S, rect(-420, 420, -420, 420), [P_B, POOL], 0, M.grass, { walk: true });
  // lot line
  const lot = [[-53.3, -74.1], [28.5, -56.2], [76.7, -45.6], [76.7, 62.9], [-53.3, 62.9], [-53.3, -74.1]];
  const lg = new THREE.BufferGeometry().setFromPoints(lot.map(([x, z]) => new THREE.Vector3(x, .2, z)));
  const ll = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xf5f5f0, dashSize: 4, gapSize: 3 })); ll.computeLineDistances(); S.add(ll);
  // roads
  flat(S, rect(84, 112, -260, 220), [], .03, M.asphalt, { walk: true });
  const A0 = [-53.3, -84.4], dir = [0.977, 0.2115], nrm = [0.2115, -0.977];
  const p = t => [A0[0] + dir[0] * t, A0[1] + dir[1] * t];
  const a = p(-260), b = p(190);
  flat(S, [a, b, [b[0] + nrm[0] * 26, b[1] + nrm[1] * 26], [a[0] + nrm[0] * 26, a[1] + nrm[1] * 26]], [], .07, M.asphalt, { walk: true });
  // driveway, walk
  box(S, 53.3, 84, 0, .12, 1.9, 28.5, M.concrete, { walk: true });
  box(S, 13.9, 17.9, 0, .1, -14, -7.4, M.pavers, { walk: true });
  box(S, 13.9, 53.3, 0, .1, -14, -10, M.pavers, { walk: true });
  // pool + deck
  slab(S, rect(-49.7, -16.9, 0.2, 52.1), [rect(-44.4, -24.1, 5.0, 47.3)], 0, .1, M.pavers, { walk: true });
  for (const r of [[-44.4, -24.1, 5.0, 6.2], [-44.4, -24.1, 46.1, 47.3], [-44.4, -43.2, 5.0, 47.3], [-25.3, -24.1, 5.0, 47.3]]) box(S, r[0], r[1], 0, .16, r[2], r[3], M.white, { walk: true });
  for (const r of [[-43.2, -25.3, 6.2, 6.5], [-43.2, -25.3, 45.8, 46.1], [-43.2, -42.9, 6.2, 46.1], [-25.6, -25.3, 6.2, 46.1]]) box(S, r[0], r[1], -5, 0, r[2], r[3], M.pooltile);
  flat(S, POOL, [], -5, M.pooltile);
  flat(S, POOL, [], -0.45, M.water, { walk: true });
  // window wells for basement windows
  for (const [x0, x1, z0, z1] of [[2.7, 6.8, 44, 46.5], [23.05, 27.15, 44, 46.5], [-2.5, 0, 6.15, 10.25]]) {
    box(S, x0, x1, -1, .4, z0, z1, M.found);
  }
  // fence on W and S lot lines, hedges
  box(S, -53.6, -53.0, 0, 6, -70, 62.9, M.fence, { solid: true });
  box(S, -53.3, 76.7, 0, 6, 62.6, 63.2, M.fence, { solid: true });
  for (const [x0, x1] of [[0.5, 9.2], [22.6, 31.2]]) box(S, x0, x1, 0, 2.6, -3.2, -1.4, M.leaf2, { solid: true });
  box(S, 32, 52.5, 0, 2.2, -1.2, 0.8, M.leaf2, { solid: true });
}
const trees = new THREE.Group(); G.site.add(trees);
function tree(x, z, s = 1, par = trees) {
  const S = par; cyl(S, x, z, .45 * s, 0, 9 * s, M.bark, 8, { solid: true });
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(7 * s, 1), Math.random() > .5 ? M.leaf : M.leaf2);
  m.position.set(x, 13 * s, z); m.scale.y = 1.15; m.castShadow = true; S.add(m);
}
[[-40, -60, 1.2], [-15, -64, 1], [60, -38, 1.1], [68, 52, 1.2], [-46, 56, 1], [25, 55, 1.3], [-48, -20, 1], [44, 54, .9], [-10, 58, .9], [40, -32, .9]].forEach(t => tree(...t));
