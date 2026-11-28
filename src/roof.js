
// =====================================================================
//  ROOFS: one roof per level, built from the whole footprint
// ---------------------------------------------------------------------
//  Every point of an equal-pitch hip roof sits at  pitch × (distance to the nearest eave), measured the way
//  the roof planes meet. For square-cornered plans that distance is the "chessboard" distance (the largest
//  square centred on the point that still fits inside the eave outline), so a distance transform over a fine
//  grid gives the exact straight-skeleton roof: ridges, hips and valleys all fall out of it and every slope
//  drains to an eave. No pockets, no flat troughs between wings.
//  Gable ends are made by letting the outline run on past a wing's short end (the slope there never turns
//  the corner), and the triangle under it is filled with wall.
// =====================================================================
const RG = 1 / 8; // grid step, feet (1½")
// Roof edge choices (BM.eave): how tall the fascia board is, and whether the level eaves carry gutters.
const ROOF_EDGE = { slim: { fascia: .46, gutter: false }, standard: { fascia: .6, gutter: true }, deep: { fascia: .77, gutter: true } };
const EDGE_COLORS = { black: '#1e1f22', white: '#eeeeea', bronze: '#4a3b2e', grey: '#8a8d90' };
const edgeMats = {};
function roofEdge(m = BM) { // the eave the plan asks for, with its materials
  const e = m.eave || {}, base = ROOF_EDGE[e.fascia] || ROOF_EDGE.standard, color = EDGE_COLORS[e.color] ? e.color : 'black';
  const mat = edgeMats[color] ||= std({ color: EDGE_COLORS[color], roughness: .55, metalness: .15 });
  return { ...base, gutter: e.gutter ?? base.gutter, mat, gutterMat: mat };
}
let ROOF3 = []; // what was built, per roof: { name, plate, pitch, eaveH, maxH, heightAt(x, z) }

function roofLevel(parent, o) {
  // o: { name, eaves: [[x0,x1,z0,z1]…] outer wall faces of the part that gets this roof,
  //      solid: rects that count as roof for drainage but are not drawn (the storey above, balconies),
  //      inner: rects that count as roof for drainage too (the rest of this storey under the storey above),
  //      plate, pitch, ov, style ('hip' | 'gable' | 'shed'), cap (highest the roof may reach), wallMat }
  const ov = o.ov, style = o.style, ex = r => [r[0] - ov, r[1] + ov, r[2] - ov, r[3] + ov];
  const drawn = o.eaves.map(ex), field = drawn.concat(o.inner || [], (o.inner || []).map(ex), o.solid || []);
  if (!drawn.length) return null;
  // gables run the slope on past a wing's end, so the grid needs room out there (half the widest wing is enough)
  const all = field.concat(drawn), M0 = style === 'gable' ? Math.ceil(Math.max(...drawn.map(r => Math.min(r[1] - r[0], r[3] - r[2]))) / 2 / RG) + 4 : 2;
  const X0 = Math.floor(Math.min(...all.map(r => r[0])) / RG) * RG - M0 * RG, Z0 = Math.floor(Math.min(...all.map(r => r[2])) / RG) * RG - M0 * RG;
  const NX = Math.ceil((Math.max(...all.map(r => r[1])) - X0) / RG) + M0, NZ = Math.ceil((Math.max(...all.map(r => r[3])) - Z0) / RG) + M0;
  const C = (NX) * (NZ), occ = new Uint8Array(C), draw = new Uint8Array(C), wall = new Uint8Array(C), hole = new Uint8Array(C);
  const fill = (arr, r, v = 1) => { const i0 = Math.max(0, Math.round((r[0] - X0) / RG)), i1 = Math.min(NX, Math.round((r[1] - X0) / RG)), j0 = Math.max(0, Math.round((r[2] - Z0) / RG)), j1 = Math.min(NZ, Math.round((r[3] - Z0) / RG));
    for (let j = j0; j < j1; j++) arr.fill(v, j * NX + i0, j * NX + i1); };
  for (const r of field) fill(occ, r);
  for (const r of drawn) fill(draw, r);
  for (const r of o.eaves) fill(wall, r);
  for (const r of o.solid || []) { fill(draw, r, 0); fill(hole, r); }
  for (const r of o.inner || []) fill(wall, r); // walls of this storey that carry the storey above: no gable fill there

  // gable ends: a wing's short end that is open to the outside keeps going (for the distance only)
  const gableEnds = [];
  if (style === 'gable') {
    const cellOcc = (x, z) => { const i = Math.floor((x - X0) / RG), j = Math.floor((z - Z0) / RG); return i >= 0 && j >= 0 && i < NX && j < NZ && occ[j * NX + i]; };
    const openRun = (pts) => pts.filter(([x, z]) => !cellOcc(x, z)).length >= pts.length * .5; // at least half the end is open to the outside
    const sideRun = (r, side) => { const pts = [], X = side === 'w' || side === 'e', at = { w: r[0], e: r[1], n: r[2], s: r[3] }[side], o = side === 'w' || side === 'n' ? -RG * 1.5 : RG * 1.5;
      for (let t = (X ? r[2] : r[0]) + RG / 2; t < (X ? r[3] : r[1]); t += RG) pts.push(X ? [at + o, t] : [t, at + o]); return pts; };
    const extFor = (r, side, len) => ({ w: [r[0] - len, r[0], r[2], r[3]], e: [r[1], r[1] + len, r[2], r[3]], n: [r[0], r[1], r[2] - len, r[2]], s: [r[0], r[1], r[3], r[3] + len] })[side];
    for (const r of drawn) {
      const w = r[1] - r[0], d = r[3] - r[2], open = s => openRun(sideRun(r, s)), attached = ['n', 's', 'e', 'w'].filter(s => !open(s));
      // a wing joined to the house on one side only: its gable faces the other way (a front gable on a bump-out)
      if (attached.length === 1) { const end = { n: 's', s: 'n', e: 'w', w: 'e' }[attached[0]], across = end === 'n' || end === 's' ? w : d; gableEnds.push(extFor(r, end, across / 2 + 1)); continue; }
      const alongX = w >= d;
      for (const side of alongX ? ['w', 'e'] : ['n', 's']) if (open(side)) gableEnds.push(extFor(r, side, Math.min(w, d) / 2 + 1));
    }
  }
  // distance (in cells) from each grid node to the eave line
  const NXn = NX + 1, NZn = NZ + 1, dist = new Float32Array(NXn * NZn);
  const ocv = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && occ[j * NX + i];
  // cells past a gable end count as inside for the distance
  const ext = new Uint8Array(C); if (gableEnds.length) { for (const r of gableEnds) fill(ext, r); }
  const inF = (i, j) => ocv(i, j) || (i >= 0 && j >= 0 && i < NX && j < NZ && ext[j * NX + i]);
  for (let j = 0; j < NZn; j++) for (let i = 0; i < NXn; i++) dist[j * NXn + i] = inF(i - 1, j - 1) && inF(i, j - 1) && inF(i - 1, j) && inF(i, j) ? 1e9 : 0;
  for (let j = 0; j < NZn; j++) for (let i = 0; i < NXn; i++) { const k = j * NXn + i; let v = dist[k]; if (!v) continue;
    if (i) v = Math.min(v, dist[k - 1] + 1); if (j) { v = Math.min(v, dist[k - NXn] + 1); if (i) v = Math.min(v, dist[k - NXn - 1] + 1); if (i < NXn - 1) v = Math.min(v, dist[k - NXn + 1] + 1); } dist[k] = v; }
  for (let j = NZn - 1; j >= 0; j--) for (let i = NXn - 1; i >= 0; i--) { const k = j * NXn + i; let v = dist[k]; if (!v) continue;
    if (i < NXn - 1) v = Math.min(v, dist[k + 1] + 1); if (j < NZn - 1) { v = Math.min(v, dist[k + NXn] + 1); if (i < NXn - 1) v = Math.min(v, dist[k + NXn + 1] + 1); if (i) v = Math.min(v, dist[k + NXn - 1] + 1); } dist[k] = v; }

  // heights at the nodes. A lower roof that would climb past `cap` (where it meets the storey above) gets a flatter
  // pitch, worked out separately for each separate piece of roof so one deep piece doesn't flatten the others.
  const shedZ0 = Math.min(...drawn.map(r => r[2]));
  const rise = (i, j) => style === 'shed' ? Math.max(0, Z0 + j * RG - shedZ0) : dist[j * NXn + i] * RG;
  // how high a lower roof may reach against the storey above: under any window there (sill less 3"), else `cap`
  const capAt = (x, z) => { let lim = o.cap; for (const w of o.windows || []) if (w.axis === 'x' ? Math.abs(z - w.c) < 1.2 && x > w.a0 - .4 && x < w.a1 + .4 : Math.abs(x - w.c) < 1.2 && z > w.a0 - .4 && z < w.a1 + .4) lim = Math.min(lim, w.sill - .25); return lim; };
  const comp = new Int32Array(C).fill(-1), compP = []; let nc = 0;
  for (let s0 = 0; s0 < C; s0++) { if (!draw[s0] || comp[s0] >= 0) continue; const st = [s0]; comp[s0] = nc; let maxP = o.pitch;
    while (st.length) { const c = st.pop(), i = c % NX, j = (c / NX) | 0;
      if (o.cap != null && ((i > 0 && hole[c - 1]) || (i < NX - 1 && hole[c + 1]) || (j > 0 && hole[c - NX]) || (j < NZ - 1 && hole[c + NX]))) { // where it meets the storey above
        const run = Math.max(rise(i, j), rise(i + 1, j), rise(i, j + 1), rise(i + 1, j + 1)), lim = capAt(X0 + (i + .5) * RG, Z0 + (j + .5) * RG);
        if (run > ov) maxP = Math.min(maxP, Math.max(1 / 12, (lim - o.plate) / (run - ov))); }
      for (const n of [i > 0 ? c - 1 : -1, i < NX - 1 ? c + 1 : -1, j > 0 ? c - NX : -1, j < NZ - 1 ? c + NX : -1]) if (n >= 0 && draw[n] && comp[n] < 0) { comp[n] = nc; st.push(n); } }
    compP.push(Math.min(o.pitch, maxP)); nc++; }
  const P = compP.length ? Math.min(...compP) : o.pitch, eaveH = o.plate - o.pitch * ov;
  const H = new Float32Array(NXn * NZn); let maxH = -1e9;
  for (let j = 0; j < NZn; j++) for (let i = 0; i < NXn; i++) { let c = -1;
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < NX && jj < NZ && comp[jj * NX + ii] >= 0) { c = comp[jj * NX + ii]; break; } }
    const p = c >= 0 ? compP[c] : o.pitch; H[j * NXn + i] = o.plate - p * ov + p * rise(i, j); }
  const hAt = (i, j) => H[j * NXn + i], X = i => X0 + i * RG, Z = j => Z0 + j * RG;

  // ---------- roof surface ----------
  const pos = [], uv = [], under = [], k = Math.sqrt(1 + o.pitch * o.pitch);
  const tri = (a, b, c, soffit) => { // a, b, c: [x, y, z]; UVs run along the slope so shingle courses stay level
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2], uy = b[1] - a[1], vy = c[1] - a[1], det = ux * vz - uz * vx;
    const gx = det ? (uy * vz - uz * vy) / det : 0, gz = det ? (ux * vy - uy * vx) / det : 0;
    for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); maxH = Math.max(maxH, p[1]);
      if (Math.abs(gx) > Math.abs(gz) + 1e-4) uv.push(p[2], Math.sign(gx) * p[0] * k); else if (Math.abs(gz) > 1e-4) uv.push(p[0], Math.sign(gz) * p[2] * k); else uv.push(p[0], p[2]); }
    if (soffit) for (const p of [a, c, b]) under.push(p[0], p[1] - .32, p[2]);
  };
  const gradOK = (a, b, c) => { const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2], uy = b[1] - a[1], vy = c[1] - a[1], det = ux * vz - uz * vx; if (!det) return false;
    const gx = (uy * vz - uz * vy) / det, gz = (ux * vy - uy * vx) / det; return Math.min(Math.abs(gx), Math.abs(gz)) < 1e-3 * (1 + o.pitch); };
  for (let j = 0; j < NZ; j++) {
    let run = null; // a stretch of flat-plane cells in this row, drawn as one quad
    const flush = () => { if (!run) return; const { i0, i1, sof } = run, p00 = [X(i0), hAt(i0, j), Z(j)], p10 = [X(i1), hAt(i1, j), Z(j)], p01 = [X(i0), hAt(i0, j + 1), Z(j + 1)], p11 = [X(i1), hAt(i1, j + 1), Z(j + 1)];
      tri(p00, p01, p10, sof); tri(p10, p01, p11, sof); run = null; };
    for (let i = 0; i <= NX; i++) {
      const c = j * NX + i, on = i < NX && draw[c];
      if (!on) { flush(); continue; }
      const a = hAt(i, j), b = hAt(i + 1, j), cc = hAt(i, j + 1), d = hAt(i + 1, j + 1), sof = !wall[c] && !hole[c];
      if (Math.abs(a + d - b - cc) < 1e-5) { const gx = Math.round((b - a) * 1e4), gz = Math.round((cc - a) * 1e4);
        if (run && run.gx === gx && run.gz === gz && run.sof === sof) { run.i1 = i + 1; continue; } flush(); run = { i0: i, i1: i + 1, gx, gz, sof }; continue; }
      flush();
      const p00 = [X(i), a, Z(j)], p10 = [X(i + 1), b, Z(j)], p01 = [X(i), cc, Z(j + 1)], p11 = [X(i + 1), d, Z(j + 1)];
      const A = gradOK(p00, p01, p11) && gradOK(p00, p11, p10), B = gradOK(p00, p01, p10) && gradOK(p10, p01, p11);
      if (A && !B || (!B && a + d >= b + cc)) { tri(p00, p01, p11, sof); tri(p00, p11, p10, sof); } else { tri(p00, p01, p10, sof); tri(p10, p01, p11, sof); }
    }
  }
  const mesh = (arr, mat, uvs) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); else g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(arr.length / 3 * 2).fill(0), 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  mesh(pos, o.roofMat || M.roof, uv); if (under.length) mesh(under, o.soffitMat || M.soffit);
  // a second skin a hair below the first: the long merged strips meet at T-junctions, and this hides the hairline cracks there
  const skin = []; for (let q = 0; q < pos.length; q += 3) skin.push(pos[q], pos[q + 1] - .04, pos[q + 2]); mesh(skin, o.roofMat || M.roof, uv); // casts shadow too, so sunlight can't leak through those cracks either

  // ---------- the roof edge, built like a real one (level at the eaves, sloped up the rakes) ----------
  //  a shingle lip that overhangs the board by ¾" and casts a fine shadow line, a 1" fascia board (5½"–9¼" tall, see
  //  ROOF_EDGE), and on the level eaves an optional K-style gutter
  const E = o.edge || roofEdge(), FT = .08, FH = E.fascia, LIP = .06;
  const fas = [], lip = [], gut = [];
  // each face is wound to face `want` (out, up, down): the materials are one-sided, so a face wound the other way is
  // culled and the board vanishes but for a thin edge (it did on every north and east eave)
  const q = (arr, a, b, c, d, want) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) arr.push(...a, ...b, ...c, ...a, ...c, ...d); else arr.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  // a box-section strip along an edge: from `in` to `out` feet beyond it, between `lo` and `hi` below the roof line there
  const strip = (arr, x0, z0, x1, z1, h0, h1, nx, nz, inn, out, lo, hi, faces = 'otb') => {
    const P = (x, z, h, d, y) => [x + nx * d, h + y, z + nz * d];
    const A = (d, y) => P(x0, z0, h0, d, y), B = (d, y) => P(x1, z1, h1, d, y);
    if (faces.includes('o')) q(arr, A(out, lo), B(out, lo), B(out, hi), A(out, hi), [nx, 0, nz]);
    if (faces.includes('t')) q(arr, A(inn, hi), A(out, hi), B(out, hi), B(inn, hi), [0, 1, 0]);
    if (faces.includes('b')) q(arr, A(inn, lo), B(inn, lo), B(out, lo), A(out, lo), [0, -1, 0]);
  };
  // K-style gutter on a level eave: flat bottom, a chamfer into the front face, a rolled top lip, and a dark channel inside
  const GW = .42, GH = .38;
  const gutter = (x0, z0, x1, z1, h, nx, nz) => {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 1) return;
    const tx = (x1 - x0) / len, tz = (z1 - z0) / len, ext = FT + GW; // run on past the ends so two gutters meet at a corner
    const ax = x0 - tx * ext, az = z0 - tz * ext, bx = x1 + tx * ext, bz = z1 + tz * ext, top = h - .1, bot = top - GH;
    const W = (x, z, u, y) => [x + nx * (FT + u), y, z + nz * (FT + u)];
    const prof = [[0, top], [0, bot], [GW * .78, bot], [GW, bot + GH * .3], [GW, top], [GW - .05, top]]; // u outward, y up
    for (let k = 0; k < prof.length - 1; k++) { const [u0, y0] = prof[k], [u1, y1] = prof[k + 1];
      const want = [nx * (y1 - y0), -(u1 - u0), nz * (y1 - y0)]; // the profile's outward normal, turned into the world
      q(gut, W(ax, az, u0, y0), W(bx, bz, u0, y0), W(bx, bz, u1, y1), W(ax, az, u1, y1), k === 0 ? [-nx, 0, -nz] : want); }
    q(gut, W(ax, az, .02, top - .07), W(bx, bz, .02, top - .07), W(bx, bz, GW - .05, top - .07), W(ax, az, GW - .05, top - .07), [0, 1, 0]); // the channel
    for (const [ex, ez, s] of [[ax, az, -1], [bx, bz, 1]]) { const ring = prof.slice(0, 5).map(([u, y]) => W(ex, ez, u, y)); // end caps
      for (let k = 1; k < ring.length - 1; k++) q(gut, ring[0], ring[k], ring[k + 1], ring[k + 1], [tx * s, 0, tz * s]); }
  };
  const ribbon = (x0, z0, x1, z1, h0, h1, nx, nz) => {
    strip(fas, x0, z0, x1, z1, h0, h1, nx, nz, 0, FT, -FH, -.04);         // the fascia board
    strip(lip, x0, z0, x1, z1, h0, h1, nx, nz, 0, FT + LIP, -.05, .03);   // the shingle edge over it
    if (E.gutter && Math.abs(h1 - h0) < 1e-3) gutter(x0, z0, x1, z1, h0, nx, nz); // gutters hang on level eaves, never up a rake
  };
  // edges against the storey above (within a few inches of its walls) get no fascia: it would poke out past the wall ends
  const nearHole = new Uint8Array(C), R3 = 3;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) if (hole[j * NX + i]) for (let dj = -R3; dj <= R3; dj++) for (let di = -R3; di <= R3; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < NX && jj < NZ) nearHole[jj * NX + ii] = 1; }
  const outside = (i, j) => !(i >= 0 && j >= 0 && i < NX && j < NZ) || (!draw[j * NX + i] && !nearHole[j * NX + i]);
  // horizontal edges (along x) at node row j, and vertical edges (along z) at node column i; merged while the slope stays the same
  for (let j = 0; j <= NZ; j++) for (const side of [-1, 1]) {
    let s = null; const end = (i) => { if (s) { ribbon(X(s.i0), Z(j), X(i), Z(j), hAt(s.i0, j), hAt(i, j), 0, side); s = null; } };
    for (let i = 0; i <= NX; i++) { const inside = i < NX && (side < 0 ? j < NZ && draw[j * NX + i] && outside(i, j - 1) : j > 0 && draw[(j - 1) * NX + i] && outside(i, j));
      if (!inside) { end(i); continue; } const sl = Math.round((hAt(i + 1, j) - hAt(i, j)) * 1e4); if (s && s.sl !== sl) end(i); if (!s) s = { i0: i, sl }; }
  }
  for (let i = 0; i <= NX; i++) for (const side of [-1, 1]) {
    let s = null; const end = (j) => { if (s) { ribbon(X(i), Z(s.j0), X(i), Z(j), hAt(i, s.j0), hAt(i, j), side, 0); s = null; } };
    for (let j = 0; j <= NZ; j++) { const inside = j < NZ && (side < 0 ? i < NX && draw[j * NX + i] && outside(i - 1, j) : i > 0 && draw[j * NX + i - 1] && outside(i, j));
      if (!inside) { end(j); continue; } const sl = Math.round((hAt(i, j + 1) - hAt(i, j)) * 1e4); if (s && s.sl !== sl) end(j); if (!s) s = { j0: j, sl }; }
  }
  const flatMesh = (arr, mat) => { if (!arr.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(arr.length / 3 * 2).fill(.5), 2)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); };
  flatMesh(fas, E.mat || M.trim); flatMesh(lip, o.roofMat || M.roof); flatMesh(gut, E.gutterMat || E.mat || M.trim);

  // ---------- wall under gables and shed sides: from the plate up to the roof ----------
  const gw = [], gu = [];
  const tallEdges = [];
  const wallOut = (i, j) => !(i >= 0 && j >= 0 && i < NX && j < NZ) || (!wall[j * NX + i] && !hole[j * NX + i]);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) { const a = j < NZ && wall[j * NX + i], b = j > 0 && wall[(j - 1) * NX + i];
    if (a && !b && wallOut(i, j - 1) || b && !a && wallOut(i, j)) { const h0 = hAt(i, j), h1 = hAt(i + 1, j); if (Math.max(h0, h1) > o.plate + .05) tallEdges.push([X(i), Z(j), X(i + 1), Z(j), h0, h1]); } }
  for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) { const a = i < NX && wall[j * NX + i], b = i > 0 && wall[j * NX + i - 1];
    if (a && !b && wallOut(i - 1, j) || b && !a && wallOut(i, j)) { const h0 = hAt(i, j), h1 = hAt(i, j + 1); if (Math.max(h0, h1) > o.plate + .05) tallEdges.push([X(i), Z(j), X(i), Z(j + 1), h0, h1]); } }
  for (const [x0, z0, x1, z1, h0, h1] of tallEdges) { const b = o.plate - .2, t0 = Math.max(b, h0 + .02), t1 = Math.max(b, h1 + .02); // tucked up under the roof, so no light slips between
    for (const v of [[x0, b, z0], [x1, b, z1], [x1, t1, z1], [x0, b, z0], [x1, t1, z1], [x0, t0, z0], [x1, b, z1], [x0, b, z0], [x0, t0, z0], [x1, b, z1], [x0, t0, z0], [x1, t1, z1]]) gw.push(...v);
    const a0 = x0 === x1 ? z0 : x0, a1 = x0 === x1 ? z1 : x1; // walls run along x or z: u is the distance along them
    for (const v of [[a0, b], [a1, b], [a1, t1], [a0, b], [a1, t1], [a0, t0], [a1, b], [a0, b], [a0, t0], [a1, b], [a0, t0], [a1, t1]]) gu.push(v[0], v[1]); }
  if (gw.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gw, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, o.wallMat || M.stucco); m.castShadow = true; m.receiveShadow = true; parent.add(m); }

  const info = { edge: E, name: o.name, plate: o.plate, pitch: P, asked: o.pitch, eaveH, maxH, style, bounds: [Math.min(...drawn.map(r => r[0])), Math.max(...drawn.map(r => r[1])), Math.min(...drawn.map(r => r[2])), Math.max(...drawn.map(r => r[3]))],
    heightAt: (x, z) => { const fi = (x - X0) / RG, fj = (z - Z0) / RG, i = Math.floor(fi), j = Math.floor(fj); if (i < 0 || j < 0 || i >= NX || j >= NZ || !occ[j * NX + i]) return null;
      const u = fi - i, v = fj - j; return (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v; } };
  ROOF3.push(info); return info;
}
window.wtRoofs = () => ROOF3.map(r => ({ name: r.name, style: r.style, pitch: +(r.pitch * 12).toFixed(2), asked: +(r.asked * 12).toFixed(2), eave: +r.eaveH.toFixed(2), top: +r.maxH.toFixed(2) })); // for checking roofs from the console
