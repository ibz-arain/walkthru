
// =====================================================================
//  FURNITURE & FIXTURES (positions follow the symbols drawn on the plans)
// =====================================================================
// side helpers: return sub-rect of [x0,x1,z0,z1] hugging side `s` with depth d
function edge(r, s, d) {
  const [x0, x1, z0, z1] = r;
  return s === 'n' ? [x0, x1, z0, z0 + d] : s === 's' ? [x0, x1, z1 - d, z1] : s === 'w' ? [x0, x0 + d, z0, z1] : [x1 - d, x1, z0, z1];
}
const bx = (p, r, y0, y1, m, o) => box(p, r[0], r[1], y0, y1, r[2], r[3], m, o);
function inset(r, a) { return [r[0] + a, r[1] - a, r[2] + a, r[3] - a]; }

function bed(p, r, y, head, o = {}) {
  bx(p, r, y, y + 1.0, M.walnut, { solid: true });
  bx(p, inset(r, .1), y + 1.0, y + 1.85, M.bedding);
  const hb = edge(r, head, .3); bx(p, hb, y, y + 4.0, o.hb ?? M.fabric2, { solid: true });
  const pil = edge(inset(r, .4), head, 1.3); bx(p, pil, y + 1.85, y + 2.25, M.bedding);
  const foot = edge(inset(r, .05), ({ n: 's', s: 'n', e: 'w', w: 'e' })[head], (head === 'n' || head === 's' ? r[3] - r[2] : r[1] - r[0]) * .32);
  bx(p, foot, y + 1.86, y + 1.95, M.throwc);
  // nightstands
  const along = head === 'n' || head === 's';
  for (const sgn of [-1, 1]) {
    let ns;
    if (along) { const xs = sgn < 0 ? [r[0] - 2.0, r[0] - .2] : [r[1] + .2, r[1] + 2.0]; const e = edge(r, head, 1.6); ns = [xs[0], xs[1], e[2], e[3]]; }
    else { const zs = sgn < 0 ? [r[2] - 2.0, r[2] - .2] : [r[3] + .2, r[3] + 2.0]; const e = edge(r, head, 1.6); ns = [e[0], e[1], zs[0], zs[1]]; }
    bx(p, ns, y, y + 2.1, M.walnut); const c = [(ns[0] + ns[1]) / 2, (ns[2] + ns[3]) / 2];
    cyl(p, c[0], c[1], .35, y + 2.1, y + 3.2, M.white, 12);
  }
}
function sofa(p, r, y, back, m = M.fabric) {
  bx(p, r, y, y + 1.45, m, { solid: true });
  bx(p, edge(r, back, .8), y + 1.45, y + 2.75, m);
  const along = back === 'n' || back === 's';
  if (along) { bx(p, [r[0], r[0] + .6, r[2], r[3]], y + 1.45, y + 2.15, m); bx(p, [r[1] - .6, r[1], r[2], r[3]], y + 1.45, y + 2.15, m); }
  else { bx(p, [r[0], r[1], r[2], r[2] + .6], y + 1.45, y + 2.15, m); bx(p, [r[0], r[1], r[3] - .6, r[3]], y + 1.45, y + 2.15, m); }
}
function table(p, r, y, h = 2.5, m = M.walnut, o = {}) {
  bx(p, r, y + h - .15, y + h, m, { solid: !o.open });
  if (o.pedestal) { const c = [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2]; cyl(p, c[0], c[1], .3, y, y + h - .15, m, 12); return; }
  const l = .2; for (const [x, z] of [[r[0], r[2]], [r[1] - l, r[2]], [r[0], r[3] - l], [r[1] - l, r[3] - l]]) box(p, x + .1, x + l + .1 - .1, y, y + h - .15, z + .1, z + l, m);
}
function chair(p, x, z, y, face, m = M.fabric2) {
  const r = [x - .85, x + .85, z - .85, z + .85];
  bx(p, inset(r, .05), y + 1.4, y + 1.6, m); for (const [a, b] of [[-.7, -.6], [.6, .7]]) for (const [c, d] of [[-.7, -.6], [.6, .7]]) box(p, x + a, x + b, y, y + 1.4, z + c, z + d, M.walnut);
  bx(p, edge(r, ({ n: 's', s: 'n', e: 'w', w: 'e' })[face], .15), y + 1.6, y + 3.0, m);
}
function stool(p, x, z, y) { cyl(p, x, z, .65, y + 2.4, y + 2.6, M.leather, 14); cyl(p, x, z, .08, y, y + 2.4, M.black, 6); }
function lowerCab(p, r, y, front, o = {}) {
  bx(p, r, y + .3, y + 3.0, o.m ?? M.cab, { solid: true }); bx(p, inset(r, .15), y, y + .3, M.black);
  bx(p, [r[0] - (front === 'w' ? .08 : 0), r[1] + (front === 'e' ? .08 : 0), r[2] - (front === 'n' ? .08 : 0), r[3] + (front === 's' ? .08 : 0)], y + 3.0, y + 3.13, o.top ?? M.counter, { solid: true });
}
function upperCab(p, r, y0, y1) { bx(p, r, y0, y1, M.cab, { cast: false }); }
function sink(p, x, z, y, rx = .9, rz = .7) {
  box(p, x - rx, x + rx, y - .02, y + .02, z - rz, z + rz, M.steel, { cast: false });
  cyl(p, x, z - rz - .15, .06, y, y + 1.3, M.steel, 8);
}
function basin(p, x, z, y) { cyl(p, x, z, .7, y, y + .35, M.porcelain, 20); }
function vanity(p, r, y, front, sinks, mirror = true) {
  lowerCab(p, r, y, front, { m: M.walnut, top: M.counter });
  for (const [x, z] of sinks) basin(p, x, z, y + 3.13);
  if (mirror) { const back = ({ n: 's', s: 'n', e: 'w', w: 'e' })[front]; const e = edge(r, back, .08); const m = e.slice();
    if (back === 'n' || back === 's') { m[2] = back === 'n' ? r[2] - .02 : r[3] - .06; m[3] = m[2] + .08; } else { m[0] = back === 'w' ? r[0] - .02 : r[1] - .06; m[1] = m[0] + .08; }
    bx(p, m, y + 4.0, y + 7.0, M.glass); bx(p, m.map((v, i) => v + (i % 2 ? .01 : -.01)), y + 4.0, y + 7.0, M.steel, { cast: false }); }
}
function toilet(p, x, z, y, face) {
  const d = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[face];
  const tx = x - d[0] * .9, tz = z - d[1] * .9;
  box(p, tx - (d[0] ? .35 : .9), tx + (d[0] ? .35 : .9), y + 1.3, y + 2.6, tz - (d[1] ? .35 : .9), tz + (d[1] ? .35 : .9), M.porcelain, { solid: true });
  cyl(p, x + d[0] * .2, z + d[1] * .2, .7, y, y + 1.4, M.porcelain, 20, { r2: .5 });
}
function tub(p, r, y) { bx(p, r, y, y + 1.9, M.porcelain, { solid: true }); bx(p, inset(r, .35), y + 1.9, y + 1.92, M.pooltile, { cast: false }); }
function closet(p, r, y, front, h = 7.9) {
  bx(p, r, y, y + h, M.white, { solid: true });
  const f = edge(r, front, .04); const fr = f.map((v, i) => v + ((front === 'w' && i === 0) || (front === 'n' && i === 2) ? -.04 : (front === 'e' && i === 1) || (front === 's' && i === 3) ? .04 : 0));
  const along = front === 'n' || front === 's'; const L = along ? r[1] - r[0] : r[3] - r[2]; const n = Math.max(2, Math.round(L / 2.5));
  for (let i = 1; i < n; i++) { const s = (along ? r[0] : r[2]) + L * i / n; along ? box(p, s - .03, s + .03, y, y + h - .2, fr[2] - .02, fr[3] + .02, M.black) : box(p, fr[0] - .02, fr[1] + .02, y, y + h - .2, s - .03, s + .03, M.black); }
}
function shelving(p, r, y, front) {
  bx(p, r, y, y + .3, M.white, { solid: true });
  for (const h of [5.2, 6.4, 7.6]) bx(p, r, y + h, y + h + .08, M.white);
  const along = front === 'n' || front === 's', L = along ? r[1] - r[0] : r[3] - r[2];
  const rr = Math.random;
  for (let s = .2; s < L - .2; s += .32) {
    const m = M.clothes[(rr() * M.clothes.length) | 0], len = 2.2 + rr() * 1.6;
    if (along) box(p, r[0] + s, r[0] + s + .22, y + 5.0 - len, y + 5.0, r[2] + .15, r[3] - .15, m, { cast: false });
    else box(p, r[0] + .15, r[1] - .15, y + 5.0 - len, y + 5.0, r[2] + s, r[2] + s + .22, m, { cast: false });
  }
}
function rug(p, r, y, m = M.rug) { box(p, r[0], r[1], y, y + .04, r[2], r[3], m, { cast: false }); }
function pendant(p, x, z, top, drop, r = .45) { cyl(p, x, z, .02, top - drop, top, M.black, 4); cyl(p, x, z, r, top - drop - .6, top - drop, M.black, 16, { r2: r * .4 }); cyl(p, x, z, r * .8, top - drop - .62, top - drop - .58, M.bulb, 16); }
function fireplaceWall(p, r, y, top, face, fb) {
  bx(p, r, y, top, M.stone, { solid: true });
  const [x0, x1, z0, z1] = fb; // firebox rect on the face
  box(p, x0, x1, y + 1.4, y + 3.0, z0, z1, M.black);
  box(p, x0 + .3, x1 - .3, y + 1.6, y + 2.1, z0 + (face === 'n' ? -.01 : 0), z1, M.flame);
}
function tv(p, r, y0, y1) { bx(p, r, y0, y1, M.tv); }

// ---------------- Main floor ----------------
{
  const F = G.furnM, y = MF;
  // Living room — fireplace on west wall (plan: "ADDITIONAL FIREPLACE")
  fireplaceWall(F, [0.67, 2.1, 5.05, 10.56], y, MC, 'e', [2.1, 2.14, 6.1, 9.5]);
  sofa(F, [8.2, 11.0, 4.3, 11.3], y, 'e'); chair(F, 4.6, 3.2, y, 's', M.fabric); chair(F, 4.6, 12.4, y, 'n', M.fabric);
  table(F, [4.2, 6.6, 6.4, 9.2], y, 1.4, M.walnut); rug(F, [3.0, 11.2, 3.0, 12.6], y);
  // Foyer
  rug(F, [13.6, 18.2, 2.0, 10.0], y, M.rug2); pendant(F, 15.9, 6.5, MC, 1.5, .9);
  // Dining room
  table(F, [22.6, 28.6, 5.6, 9.4], y, 2.5, M.oak);
  for (const x of [23.9, 25.6, 27.3]) { chair(F, x, 4.6, y, 's'); chair(F, x, 10.4, y, 'n'); }
  pendant(F, 25.6, 7.5, MC, 2.2, .9); bx(F, [29.6, 31.05, 4.0, 10.5], y, y + 2.8, M.walnut, { solid: true });
  // Kitchen — perimeter run on garage wall, range, tall fridge/pantry, island w/ sink
  lowerCab(F, [27.15, 29.1, 18.1, 24.3], y, 'w'); lowerCab(F, [27.15, 29.1, 27.0, 32.2], y, 'w');
  bx(F, [27.15, 29.1, 24.3, 27.0], y, y + 3.0, M.steel, { solid: true }); bx(F, [27.1, 29.1, 24.3, 27.0], y + 3.0, y + 3.1, M.black);
  bx(F, [27.6, 29.1, 24.2, 27.1], y + 6.0, y + 8.6, M.steel);
  upperCab(F, [27.95, 29.1, 18.1, 24.2], y + 4.6, y + 8.3); upperCab(F, [27.95, 29.1, 27.1, 32.2], y + 4.6, y + 8.3);
  sink(F, 28.1, 30.0, y + 3.14);
  bx(F, [27.0, 29.1, 36.8, 42.9], y, y + 8.3, M.cab, { solid: true }); bx(F, [26.97, 27.0, 38.4, 41.4], y + .3, y + 7.0, M.steel);
  lowerCab(F, [20.0, 23.1, 18.1, 26.9], y, 'w'); bx(F, [19.8, 23.3, 18.0, 27.0], y + 3.0, y + 3.15, M.counter, { solid: true });
  sink(F, 21.6, 22.5, y + 3.16, .8, 1.1);
  for (const z of [19.6, 21.6, 23.6, 25.6]) stool(F, 18.9, z, y);
  for (const z of [19.8, 22.5, 25.2]) pendant(F, 21.55, z, MC, 2.6, .5);
  // Kitchen table (second rectangle on plan)
  table(F, [19.8, 23.3, 30.5, 39.3], y, 2.5, M.oak);
  for (const z of [32.0, 34.9, 37.8]) { chair(F, 18.7, z, y, 'e'); chair(F, 24.4, z, y, 'w'); }
  chair(F, 21.55, 29.4, y, 's'); chair(F, 21.55, 40.4, y, 'n');
  pendant(F, 21.55, 33.0, MC, 2.4, .7); pendant(F, 21.55, 36.8, MC, 2.4, .7);
  // Great room — linear fireplace + TV on south wall, sofas
  fireplaceWall(F, [8.4, 15.9, 42.5, 43.33], y, MC, 'n', [10.2, 14.1, 42.48, 42.52]);
  tv(F, [10.3, 14.0, 42.38, 42.5], y + 4.6, y + 7.0);
  sofa(F, [6.0, 15.5, 31.5, 34.4], y, 'n'); sofa(F, [3.0, 5.8, 34.0, 40.0], y, 'w', M.fabric);
  table(F, [8.2, 13.2, 36.4, 39.0], y, 1.4, M.walnut); rug(F, [3.5, 16.5, 31.0, 41.6], y);
  // Mud room
  bx(F, [29.6, 36.6, 29.5, 31.1], y, y + 1.6, M.walnut, { solid: true }); bx(F, [29.6, 36.6, 29.5, 29.9], y + 1.6, y + 7.5, M.cab);
  bx(F, [29.6, 36.6, 29.5, 31.1], y + 6.5, y + 7.5, M.cab);
  lowerCab(F, [33.0, 40.0, 39.1, 40.75], y, 'n'); sink(F, 36.7, 40.2, y + 3.14);
  closet(F, [40.45, 48.6, 31.55, 33.4], y, 's'); closet(F, [40.45, 48.6, 38.8, 40.75], y, 'n'); closet(F, [29.6, 32.4, 38.8, 40.75], y, 'n');
  // Powder room
  vanity(F, [49.4, 52.6, 31.55, 33.2], y, 's', [[51.0, 32.4]]); toilet(F, 51.0, 39.5, y, 'n');
  // Garage
  const car = new THREE.Group(); box(car, -7.6, 7.6, 1.1, 3.3, -3.1, 3.1, M.car); box(car, -3.4, 3.8, 3.3, 4.9, -2.7, 2.7, M.glass); box(car, -3.0, 3.4, 4.9, 5.0, -2.6, 2.6, M.car);
  for (const [x, z] of [[-4.8, -3.1], [4.8, -3.1], [-4.8, 3.1], [4.8, 3.1]]) { const w = cyl(car, 0, 0, 1.15, -.4, .4, M.black, 16); w.rotation.x = Math.PI / 2; w.position.set(x, 1.15, z); }
  car.position.set(41.5, GF, 18.2); car.traverse(o => o.castShadow = true); F.add(car);
  box(F, 41.5 - 7.6, 41.5 + 7.6, GF, GF + 5, 18.2 - 3.1, 18.2 + 3.1, M.glass, { solid: true, cast: false }).visible = false;
  bx(F, [32.0, 33.6, 3.0, 13.0], GF, GF + 7, M.walnut, { solid: true });
  // Patio
  table(F, [-9.4, -4.4, 26.0, 29.4], 2.1, 2.5, M.walnut);
  for (const x of [-8.2, -5.6]) { chair(F, x, 25.0, 2.1, 's', M.fabric); chair(F, x, 30.4, 2.1, 'n', M.fabric); }
  for (const z of [36.5, 39.5]) bx(F, [-10, -4.5, z, z + 2.2], 2.1, 3.2, M.fabric2, { solid: true });
}

// ---------------- 2nd floor (local coords) ----------------
{
  const F = G.furnU, y = UF;
  // Bedroom 3
  bed(F, [0.6, 7.3, 2.35, 7.35], y, 'w'); closet(F, [1.0, 7.7, 10.35, 12.4], y, 'n'); rug(F, [3.0, 9.5, 1.8, 8.2], y, M.rug2);
  table(F, [9.6, 12.2, 0.7, 2.6], y, 2.5, M.oak); chair(F, 10.9, 3.5, y, 'n');
  // Jack & Jill bath
  vanity(F, [12.8, 14.6, 3.8, 7.6], y, 'e', [[13.7, 5.7]]); vanity(F, [18.0, 19.8, -2.0, 2.4], y, 'w', [[18.9, 0.2]]);
  toilet(F, 18.7, 13.6, y, 'n'); box(F, 13.1, 16.6, y, y + .2, 8.8, 14.5, M.btile, { walk: true });
  // Bedroom 2
  bed(F, [24.0, 30.7, 5.7, 10.7], y, 'e'); closet(F, [20.6, 30.75, 18.9, 20.7], y, 'n'); closet(F, [17.1, 20.6, 18.9, 20.7], y, 'w');
  rug(F, [22.0, 29.0, 4.2, 12.2], y);
  // Primary suite — sitting area, king bed
  table(F, [3.6, 5.4, 22.5, 24.3], y, 2.3, M.walnut, { pedestal: true });
  for (const [x, z, f] of [[2.6, 21.6, 's'], [6.4, 21.6, 's'], [2.6, 25.2, 'n'], [6.4, 25.2, 'n']]) chair(F, x, z, y, f, M.fabric);
  bed(F, [9.7, 16.7, 32.1, 38.6], y, 'e', { hb: M.fabric }); bx(F, [7.7, 9.2, 32.6, 38.1], y, y + 1.6, M.fabric2, { solid: true });
  rug(F, [5.5, 15.5, 30.0, 40.0], y); bx(F, [0.65, 2.3, 34.0, 36.6], y, y + 3.0, M.walnut, { solid: true });
  // Laundry
  for (const [x0, x1] of [[17.4, 19.9], [20.1, 22.6]]) { bx(F, [x0, x1, 25.0, 27.5], y, y + 3.2, M.white, { solid: true }); cyl(F, (x0 + x1) / 2, 24.98, .8, y + 1.0, y + 1.0, M.black).rotation.x = Math.PI / 2; }
  for (const [x0, x1] of [[17.4, 19.9], [20.1, 22.6]]) { const c = cyl(F, (x0 + x1) / 2, 24.97, .75, -.02, .02, M.black, 20); c.rotation.x = Math.PI / 2; c.position.y = y + 1.5; }
  lowerCab(F, [22.8, 28.6, 25.4, 27.5], y, 'n'); sink(F, 27.0, 26.6, y + 3.14); upperCab(F, [17.3, 28.6, 26.4, 27.5], y + 4.6, y + 7.6);
  // Primary bath
  tub(F, [40.5, 45.9, 21.4, 24.3], y);
  vanity(F, [50.3, 52.3, 21.4, 26.9], y, 'w', [[51.3, 24.15]]); vanity(F, [50.3, 52.3, 31.6, 37.1], y, 'w', [[51.3, 34.35]]);
  table(F, [50.8, 52.3, 27.4, 31.1], y, 2.5, M.walnut); chair(F, 49.6, 29.25, y, 'e', M.fabric);
  bx(F, [52.15, 52.3, 27.6, 30.9], y + 3.5, y + 6.5, M.glass);
  toilet(F, 32.4, 27.45, y, 'e'); box(F, 31.3, 36.2, y, y + .2, 20.9, 25.1, M.btile, { walk: true });
  bx(F, [31.3, 32.5, 21.0, 25.0], y, y + 1.6, M.btile);
  // Walk-in closets
  shelving(F, [17.1, 19.0, 30.8, 40.2], y, 'e'); shelving(F, [27.0, 28.8, 34.6, 40.2], y, 'w'); closet(F, [21.5, 28.5, 27.9, 29.7], y, 's');
  shelving(F, [29.4, 39.6, 29.8, 31.5], y, 's'); shelving(F, [29.4, 39.6, 35.9, 37.6], y, 'n');
  // Balcony
  for (const z of [27, 31]) bx(F, [-9.5, -4.0, z, z + 2.2], UF, UF + 1.1, M.fabric2, { solid: true });
  table(F, [-7.6, -5.8, 29.6, 30.6], UF, 1.6, M.walnut);
}

// ---------------- Basement ----------------
{
  const F = G.furnB, y = BF;
  bed(F, [3.5, 8.5, 8.4, 15.05], y, 's'); closet(F, [0.9, 7.8, 0.8, 2.7], y, 's'); rug(F, [2.5, 10, 6, 13], y);
  // Theatre
  box(F, 21.5, 29.5, y + 1.6, y + 6.4, 0.7, 0.78, M.white);
  for (const [z, h] of [[8.6, 0], [11.9, .7]]) { if (h) box(F, 20.2, 30.8, y, y + h, 10.9, 14.2, M.carpet, { walk: true }); for (const x of [22.0, 24.6, 27.2, 29.6]) sofa(F, [x - 1.2, x + 1.2, z, z + 2.6], y + h, 's', M.leather); }
  // Rec room
  fireplaceWall(F, [8.0, 14.0, 42.7, 43.33], y, BC, 'n', [9.6, 12.4, 42.68, 42.72]); tv(F, [9.5, 12.5, 42.6, 42.7], y + 4.0, y + 6.2);
  sofa(F, [5.5, 15.5, 33.0, 35.8], y, 'n'); table(F, [8.0, 13.0, 37.0, 39.5], y, 1.4); rug(F, [4.5, 16.5, 32.5, 41.5], y, M.rug2);
  bx(F, [20.5, 27.5, 30.0, 34.0], y + 2.3, y + 2.6, M.walnut, { solid: true }); bx(F, [20.9, 27.1, 30.4, 33.6], y + 2.6, y + 2.65, M.felt);
  bx(F, [21.5, 26.5, 30.8, 33.2], y, y + 2.3, M.walnut);
  // Bath
  vanity(F, [0.9, 4.8, 23.4, 25.2], y, 's', [[2.85, 24.3]]); toilet(F, 2.8, 30.2, y, 'n');
  box(F, 7.2, 11.2, y, y + 7, 27.3, 27.36, M.glass, { solid: true });
  // Mechanical
  bx(F, [19.0, 22.0, 21.6, 24.5], y, y + 5.2, M.steel, { solid: true }); cyl(F, 26.1, 23.5, 1.1, y, y + 5, M.white, 18, { solid: true });
  // Storage + cold cellar
  shelving(F, [29.5, 52.5, 31.0, 32.6], y, 's'); shelving(F, [44, 52.5, 39.0, 40.6], y, 'n');
  bx(F, [10.8, 20.8, -5.2, -4.0], y, y + 6, M.oak, { solid: true });
}
