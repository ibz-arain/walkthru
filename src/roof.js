
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
let ROOF3 = []; // what was built, per roof: { name, plate, pitch, eaveH, maxH, heightAt(x, z) }

function roofLevel(parent, o) {
  // o: { name, eaves: [[x0,x1,z0,z1]…] outer wall faces of the part that gets this roof,
  //      solid: rects that count as roof for drainage but are not drawn (the storey above, balconies),
  //      inner: rects that count as roof for drainage too (the rest of this storey under the storey above),
  //      plate, pitch, ov, style ('hip' | 'gable' | 'shed'), cap (highest the roof may reach), wallMat }
  const ov = o.ov, style = o.style, ex = r => [r[0] - ov, r[1] + ov, r[2] - ov, r[3] + ov];
  const drawn = o.eaves.map(ex), field = drawn.concat(o.inner || [], (o.inner || []).map(ex), o.solid || []);
  if (!drawn.length) return null;
  const all = field.concat(drawn), M0 = 2;
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
    for (const r of drawn) {
      const w = r[1] - r[0], d = r[3] - r[2], alongX = w >= d, ext = 60;
      const ends = alongX ? [['w', r[0]], ['e', r[1]]] : [['n', r[2]], ['s', r[3]]];
      for (const [side, at] of ends) {
        const pts = []; for (let t = (alongX ? r[2] : r[0]) + RG / 2; t < (alongX ? r[3] : r[1]); t += RG) pts.push(alongX ? [side === 'w' ? at - RG / 2 : at + RG / 2, t] : [t, side === 'n' ? at - RG / 2 : at + RG / 2]);
        if (!openRun(pts)) continue;
        gableEnds.push(alongX ? [side === 'w' ? at - ext : at, side === 'w' ? at : at + ext, r[2], r[3]] : [r[0], r[1], side === 'n' ? at - ext : at, side === 'n' ? at : at + ext]);
      }
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
  mesh(pos, M.roof, uv); if (under.length) mesh(under, M.soffit);
  // a second skin a hair below the first: the long merged strips meet at T-junctions, and this hides the hairline cracks there
  const skin = []; for (let q = 0; q < pos.length; q += 3) skin.push(pos[q], pos[q + 1] - .04, pos[q + 2]); mesh(skin, M.roof, uv).castShadow = false;

  // ---------- fascia along every open edge (level at the eaves, sloped up the rakes) ----------
  const fas = [], FT = .22, FB = .75;
  const ribbon = (x0, z0, x1, z1, h0, h1, nx, nz) => { // outer face + top + bottom of a board along an edge, pushed out by (nx, nz)
    const o0 = [x0 + nx * FT, z0 + nz * FT], o1 = [x1 + nx * FT, z1 + nz * FT];
    const q = (a, b, c, d) => fas.push(...a, ...b, ...c, ...a, ...c, ...d);
    q([o0[0], h0 - FB, o0[1]], [o1[0], h1 - FB, o1[1]], [o1[0], h1 + .1, o1[1]], [o0[0], h0 + .1, o0[1]]);
    q([x0, h0 + .1, z0], [o0[0], h0 + .1, o0[1]], [o1[0], h1 + .1, o1[1]], [x1, h1 + .1, z1]);
    q([x0, h0 - FB, z0], [x1, h1 - FB, z1], [o1[0], h1 - FB, o1[1]], [o0[0], h0 - FB, o0[1]]);
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
  if (fas.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fas, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, M.trim); m.castShadow = true; parent.add(m); }

  // ---------- wall under gables and shed sides: from the plate up to the roof ----------
  const gw = [], gu = [];
  const tallEdges = [];
  const wallOut = (i, j) => !(i >= 0 && j >= 0 && i < NX && j < NZ) || (!wall[j * NX + i] && !hole[j * NX + i]);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) { const a = j < NZ && wall[j * NX + i], b = j > 0 && wall[(j - 1) * NX + i];
    if (a && !b && wallOut(i, j - 1) || b && !a && wallOut(i, j)) { const h0 = hAt(i, j), h1 = hAt(i + 1, j); if (Math.max(h0, h1) > o.plate + .05) tallEdges.push([X(i), Z(j), X(i + 1), Z(j), h0, h1]); } }
  for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) { const a = i < NX && wall[j * NX + i], b = i > 0 && wall[j * NX + i - 1];
    if (a && !b && wallOut(i - 1, j) || b && !a && wallOut(i, j)) { const h0 = hAt(i, j), h1 = hAt(i, j + 1); if (Math.max(h0, h1) > o.plate + .05) tallEdges.push([X(i), Z(j), X(i), Z(j + 1), h0, h1]); } }
  for (const [x0, z0, x1, z1, h0, h1] of tallEdges) { const b = o.plate - .2, t0 = Math.max(b, h0 - .05), t1 = Math.max(b, h1 - .05);
    for (const v of [[x0, b, z0], [x1, b, z1], [x1, t1, z1], [x0, b, z0], [x1, t1, z1], [x0, t0, z0], [x1, b, z1], [x0, b, z0], [x0, t0, z0], [x1, b, z1], [x0, t0, z0], [x1, t1, z1]]) gw.push(...v);
    const a0 = x0 === x1 ? z0 : x0, a1 = x0 === x1 ? z1 : x1; // walls run along x or z: u is the distance along them
    for (const v of [[a0, b], [a1, b], [a1, t1], [a0, b], [a1, t1], [a0, t0], [a1, b], [a0, b], [a0, t0], [a1, b], [a0, t0], [a1, t1]]) gu.push(v[0], v[1]); }
  if (gw.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gw, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, o.wallMat || M.stucco); m.castShadow = true; m.receiveShadow = true; parent.add(m); }

  const info = { name: o.name, plate: o.plate, pitch: P, asked: o.pitch, eaveH, maxH, style, bounds: [Math.min(...drawn.map(r => r[0])), Math.max(...drawn.map(r => r[1])), Math.min(...drawn.map(r => r[2])), Math.max(...drawn.map(r => r[3]))],
    heightAt: (x, z) => { const fi = (x - X0) / RG, fj = (z - Z0) / RG, i = Math.floor(fi), j = Math.floor(fj); if (i < 0 || j < 0 || i >= NX || j >= NZ || !occ[j * NX + i]) return null;
      const u = fi - i, v = fj - j; return (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v; } };
  ROOF3.push(info); return info;
}
window.wtRoofs = () => ROOF3.map(r => ({ name: r.name, style: r.style, pitch: +(r.pitch * 12).toFixed(2), asked: +(r.asked * 12).toFixed(2), eave: +r.eaveH.toFixed(2), top: +r.maxH.toFixed(2) })); // for checking roofs from the console
