
// =====================================================================
//  MY DESIGN — furniture. Several layouts per room type, picked per room (Shuffle changes it),
//  laid out in the room's own frame so the whole layout can be rotated (↻) away from doors.
//  Local frame: x0..x1 left→right, z0 = "back" wall, z1 = "front" (open) side.
// =====================================================================
const FAB = ['#8d9091', '#5d6b74', '#b39b7d', '#6e7f62', '#2f3e52', '#a35f4c', '#d8d0c4', '#7a6a8a'].map(c => std({ color: c, roughness: 1 }));
const RUGS = ['#c3b9a9', '#7e8790', '#b9876a', '#9fae9a', '#d9d2c5', '#5b6470', '#c9a77c'].map(c => std({ color: c, roughness: 1 }));
const WOODS = [M.walnut, M.oak, std({ color: '#d8c3a0', roughness: .6 }), std({ color: '#2b2622', roughness: .5 })];
const BOOKS = ['#8a3b33', '#2f3e52', '#c9a14a', '#55684b', '#e8e5de', '#6b4a7a', '#b0603a'].map(c => std({ color: c, roughness: .9 }));
const ART = ['#d9663f', '#2f5d8a', '#e2c35a', '#6d8f6a', '#a24d6b', '#1d2733'].map(c => std({ color: c, roughness: .8 }));
const POT = std({ color: '#e8e2d8', roughness: .8 }), POT2 = std({ color: '#3a3d42', roughness: .6 }), LEAF3 = std({ color: '#5f8f45', roughness: 1 });
function rngFor(r) { let s = ((r.id || 1) * 7919 + (r.var || 0) * 104729) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];

// ---- small pieces ----
function plant(F, x, z, y, R, big = true) {
  const h = big ? 1.6 : .9, r = big ? .7 : .45; cyl(F, x, z, r, y, y + h, R() > .5 ? POT : POT2, 14, { r2: r * .8 });
  const n = big ? 3 : 2; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry((big ? 1.1 : .6) * (.8 + R() * .4), 0), R() > .5 ? LEAF3 : M.leaf2);
    m.position.set(x + (R() - .5) * .6, y + h + (big ? .9 : .5) + i * (big ? .7 : .35), z + (R() - .5) * .6); m.castShadow = true; F.add(m); }
}
function floorLamp(F, x, z, y) { cyl(F, x, z, .45, y, y + .1, M.black, 12); cyl(F, x, z, .05, y, y + 5, M.black, 6); cyl(F, x, z, .6, y + 4.8, y + 5.7, M.bulb, 16, { r2: .45 }); }
function art(F, x, z, y, w, h, R, axis = 'x', inward = 1) { // framed picture on a wall
  const f = pick(R, ART), d = .08;
  if (axis === 'x') { box(F, x - w / 2, x + w / 2, y, y + h, z, z + inward * d, M.trim); box(F, x - w / 2 + .15, x + w / 2 - .15, y + .15, y + h - .15, z + inward * d, z + inward * (d + .01), f); }
  else { box(F, x, x + inward * d, y, y + h, z - w / 2, z + w / 2, M.trim); box(F, x + inward * d, x + inward * (d + .01), y + .15, y + h - .15, z - w / 2 + .15, z + w / 2 - .15, f); }
}
function bookshelf(F, r4, y, R, h = 7) {
  const [a0, a1, b0, b1] = r4; bx(F, r4, y, y + h, pick(R, WOODS), { solid: true });
  const along = a1 - a0 >= b1 - b0;
  for (let k = 1; k < 5; k++) { const yy = y + k * h / 5.2; let p = along ? a0 + .15 : b0 + .15; const end = along ? a1 - .15 : b1 - .15;
    while (p < end - .2) { const bw = .12 + R() * .2, bh = .7 + R() * .45, m = pick(R, BOOKS);
      if (along) box(F, p, Math.min(p + bw, end), yy, yy + bh, b0 - .02, b1 + .02, m, { cast: false }); else box(F, a0 - .02, a1 + .02, yy, yy + bh, p, Math.min(p + bw, end), m, { cast: false }); p += bw + .02; } }
}
function dresser(F, r4, y, R) { bx(F, r4, y, y + 2.8, pick(R, WOODS), { solid: true }); const [a0, a1, b0, b1] = r4; for (const yy of [y + .9, y + 1.8]) box(F, a0 + .05, a1 - .05, yy, yy + .04, b0 - .01, b1 + .01, M.black, { cast: false }); }
function armchair(F, x, z, y, face, m) { const r = [x - 1.3, x + 1.3, z - 1.3, z + 1.3]; sofa(F, r, y, ({ n: 's', s: 'n', e: 'w', w: 'e' })[face], m); }
function media(F, x, z, y, w, face) { // console + TV on a wall; face = which way the screen looks
  const hz = face === 'n' || face === 's', d = 1.4, s = face === 's' || face === 'e' ? 1 : -1;
  const r4 = hz ? [x - w / 2, x + w / 2, z, z + s * d] : [x, x + s * d, z - w / 2, z + w / 2];
  bx(F, r4, y, y + 1.8, M.walnut, { solid: true });
  if (hz) box(F, x - w * .35, x + w * .35, y + 3.6, y + 6.1, z + s * .05, z + s * .15, M.tv); else box(F, x + s * .05, x + s * .15, y + 3.6, y + 6.1, z - w * .35, z + w * .35, M.tv);
}
function crib(F, r4, y) { bx(F, r4, y + 1, y + 1.2, M.white); const [a0, a1, b0, b1] = r4; for (let x = a0; x <= a1; x += .45) { box(F, x, x + .08, y, y + 3.2, b0, b0 + .08, M.white); box(F, x, x + .08, y, y + 3.2, b1 - .08, b1, M.white); }
  box(F, a0, a1, y + 3.1, y + 3.25, b0, b1, M.white); bx(F, [a0 + .1, a1 - .1, b0 + .1, b1 - .1], y + 1.2, y + 1.6, M.bedding); }

// ---- the room layouts ----
function furnishRoom(F, r, y) {
  const R = rngFor(r), x0 = r.x, x1 = r.x + r.w, z0 = r.z, z1 = r.z + r.d, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = r.w, D = r.d, t = likeOf(r.type), fab = pick(R, FAB), fab2 = pick(R, FAB), rugM = pick(R, RUGS);
  const corner = (dx, dz) => [dx < 0 ? x0 + 1 : x1 - 1, dz < 0 ? z0 + 1 : z1 - 1];
  if (r.type === 'balcony' || r.type === 'deck') { if (W >= 6 && D >= 5) { armchair(F, cx - 1.6, cz, y, 's', fab); armchair(F, cx + 1.6, cz, y, 's', fab); cyl(F, cx, cz + 1.8, .9, y, y + 1.4, M.walnut, 16); }
    if (W >= 8) plant(F, ...corner(-1, -1), y, R); if (r.type === 'deck' && W >= 12 && D >= 10) { cyl(F, x1 - 3.5, z1 - 3.5, 2, y + 2.3, y + 2.45, M.walnut, 24); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; chair(F, x1 - 3.5 + Math.cos(a) * 2.6, z1 - 3.5 + Math.sin(a) * 2.6, y, ['w', 'n', 'e', 's'][k], fab2); } } return; }
  if (r.type === 'porch') { if (W >= 8) { bx(F, [cx - 2.5, cx + 2.5, z0 + .4, z0 + 1.9], y, y + 1.5, M.walnut, { solid: true }); plant(F, x0 + 1, z0 + 1, y, R); plant(F, x1 - 1, z0 + 1, y, R); } return; }
  if (W < 4 || D < 4) { if (W >= 3 && D >= 3 && (t === 'closet')) shelving(F, [x0 + .2, x1 - .2, z0 + .2, z0 + 1.7], y, 's'); return; }
  const v = Math.floor(R() * 3);
  if (r.type === 'nursery') { crib(F, [cx - 2, cx + 2, z0 + .4, z0 + 2.6], y); armchair(F, x1 - 1.8, z1 - 1.8, y, 'n', fab); dresser(F, [x0 + .3, x0 + 4, z1 - 1.9, z1 - .3], y, R); rug(F, [cx - 3, cx + 3, cz - 2, cz + 2], y, rugM); plant(F, x0 + 1, z0 + 1, y, R, false); return; }
  if (t === 'bedroom' || t === 'primary') {
    const king = t === 'primary' || r.type === 'guest' && W >= 13, bw = king ? 6.4 : 5, bl = king ? 7 : 6.7;
    const sideHead = v === 2 && D >= bw + 4 && W >= bl + 4;
    if (!sideHead && W >= bw + 4.2 && D >= bl + 2) { bed(F, [cx - bw / 2, cx + bw / 2, z0 + .4, z0 + .4 + bl], y, 'n', { hb: fab }); rug(F, [cx - bw / 2 - 1.2, cx + bw / 2 + 1.2, z0 + 3, Math.min(z1 - .4, z0 + bl + 2)], y, rugM); art(F, cx, z0 + .02, y + 5, 3.5, 2.2, R); }
    else if (sideHead) { bed(F, [x0 + .4, x0 + .4 + bl, cz - bw / 2, cz + bw / 2], y, 'w', { hb: fab }); rug(F, [x0 + 3, x0 + bl + 2, cz - bw / 2 - 1.2, cz + bw / 2 + 1.2], y, rugM); art(F, x0 + .02, cz, y + 5, 3.5, 2.2, R, 'z'); }
    if (D >= 11) dresser(F, sideHead ? [x1 - 1.9, x1 - .3, cz - 2.2, cz + 2.2] : [cx - 2.2, cx + 2.2, z1 - 1.9, z1 - .3], y, R);
    if (W >= 13 && D >= 12) { if (v === 1) { table(F, [x1 - 4.5, x1 - .4, z1 - 4.2, z1 - 2.4], y, 2.5, pick(R, WOODS)); chair(F, x1 - 2.4, z1 - 4.9, y, 's'); }
      else { armchair(F, x1 - 1.9, z1 - 2.2, y, 'w', fab2); floorLamp(F, x1 - .9, z1 - 4, y); } }
    plant(F, ...corner(-1, 1), y, R); return;
  }
  if (t === 'living' || t === 'great' || t === 'rec') {
    rug(F, [x0 + 1.5, x1 - 1.5, z0 + 1.5, z1 - 1.5], y, rugM);
    if (W < 10 || D < 10) { sofa(F, [cx - 3.5, cx + 3.5, z0 + .4, z0 + 3.2], y, 'n', fab); plant(F, x1 - 1, z1 - 1, y, R); return; }
    if (v === 0) { // sofa + armchairs facing a TV wall
      sofa(F, [cx - 4, cx + 4, z0 + .5, z0 + 3.3], y, 'n', fab); armchair(F, cx - 3.2, z1 - 3, y, 'n', fab2); armchair(F, cx + 3.2, z1 - 3, y, 'n', fab2);
      table(F, [cx - 2, cx + 2, cz - 1, cz + 1], y, 1.4, pick(R, WOODS)); floorLamp(F, cx + 5, z0 + 1.2, y);
      if (r.type === 'sunroom') plant(F, cx, z1 - 1.2, y, R); else art(F, cx, z0 + .02, y + 5, 4.5, 2.5, R);
    } else if (v === 1) { // L-sectional in a corner, TV on the opposite wall
      sofa(F, [x0 + .5, x0 + 9, z0 + .5, z0 + 3.3], y, 'n', fab); sofa(F, [x0 + .5, x0 + 3.3, z0 + 3.3, Math.min(z1 - 2, z0 + 10)], y, 'w', fab);
      table(F, [x0 + 4.5, x0 + 8, z0 + 4.5, z0 + 7], y, 1.4, pick(R, WOODS)); media(F, x1 - .3, z0 + 6, y, 6, 'w'); floorLamp(F, x0 + 9.8, z0 + 1, y);
    } else { // two sofas facing each other around a fireplace
      fireplaceWall(F, [cx - 3, cx + 3, z0 + .02, z0 + 1.4], y, y + 8.5, 's', [cx - 1.6, cx + 1.6, z0 + 1.4, z0 + 1.44]);
      sofa(F, [x0 + .8, x0 + 3.6, cz - 3.5, cz + 3.5], y, 'w', fab); sofa(F, [x1 - 3.6, x1 - .8, cz - 3.5, cz + 3.5], y, 'e', fab2); table(F, [cx - 1.5, cx + 1.5, cz - 1.5, cz + 1.5], y, 1.4, pick(R, WOODS));
    }
    plant(F, ...corner(1, 1), y, R); if (W >= 16) plant(F, ...corner(-1, 1), y, R, false); return;
  }
  if (t === 'kitchen') {
    const shape = W >= 12 && D >= 10 ? v : v === 2 ? 0 : v;
    lowerCab(F, [x0 + .3, x1 - 3.45, z0 + .25, z0 + 2.25], y, 's'); upperCab(F, [x0 + .3, x0 + 2.35, z0 + .25, z0 + 1.35], y + 4.6, y + 7.6); upperCab(F, [x0 + 4.55, x1 - 3.6, z0 + .25, z0 + 1.35], y + 4.6, y + 7.6); // cabinets stop at the fridge and either side of the hood
    bx(F, [x1 - 3.4, x1 - .3, z0 + .25, z0 + 2.4], y, y + 7.2, M.steel, { solid: true }); sink(F, cx - 1, z0 + 1.2, y + 3.14);
    bx(F, [x0 + 2.2, x0 + 4.7, z0 + .3, z0 + 2.2], y + 3.13, y + 3.17, M.black); bx(F, [x0 + 2.4, x0 + 4.5, z0 + .25, z0 + 1.3], y + 6.2, y + 8.4, M.steel);
    if (shape >= 1 && D >= 8) lowerCab(F, [x0 + .25, x0 + 2.25, z0 + 2.25, Math.min(z1 - 2.5, z0 + 9)], y, 'e');                 // L
    if (shape === 2 && D >= 9) lowerCab(F, [x1 - 2.25, x1 - .25, z0 + 2.4, Math.min(z1 - 2.5, z0 + 8)], y, 'w');                // U
    if (W >= 11 && D >= 12) { const iw = Math.min(8, W - 7); lowerCab(F, [cx - iw / 2, cx + iw / 2, cz + .4, cz + 3.4], y, 'n'); bx(F, [cx - iw / 2 - .2, cx + iw / 2 + .2, cz + .2, cz + 4.4], y + 3, y + 3.15, M.counter, { solid: true });
      for (let k = 0; k < Math.floor(iw / 2); k++) stool(F, cx - iw / 2 + 1 + k * 2, cz + 5.1, y); for (const dx of [-iw / 4, iw / 4]) pendant(F, cx + dx, cz + 1.9, y + 9, 2.6, .5); }
    else if (D >= 9 && shape === 0 && W >= 8) lowerCab(F, [x0 + .3, x1 - .3, z1 - 2.25, z1 - .25], y, 'n');                   // galley
    plant(F, x1 - .9, z1 - .9, y, R, false); return;
  }
  if (t === 'dining') {
    const round = v === 1 && Math.abs(W - D) < 4 && W <= 13;
    if (round) { cyl(F, cx, cz, 2.3, y + 2.35, y + 2.5, pick(R, WOODS), 28, { solid: true }); cyl(F, cx, cz, .35, y, y + 2.35, M.black, 10); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; chair(F, cx + Math.cos(a) * 3.2, cz + Math.sin(a) * 3.2, y, Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'w' : 'e') : (Math.sin(a) > 0 ? 'n' : 's'), fab); } }
    else if (W >= 8 && D >= 8) { const a = W >= D, L = Math.min(8, (a ? W : D) - 4); table(F, a ? [cx - L / 2, cx + L / 2, cz - 1.75, cz + 1.75] : [cx - 1.75, cx + 1.75, cz - L / 2, cz + L / 2], y, 2.5, pick(R, WOODS));
      const n = Math.max(2, Math.floor(L / 2)); for (let k = 0; k < n; k++) { const p = -L / 2 + (k + .5) * L / n; if (a) { chair(F, cx + p, cz - 2.7, y, 's', fab); chair(F, cx + p, cz + 2.7, y, 'n', fab); } else { chair(F, cx - 2.7, cz + p, y, 'e', fab); chair(F, cx + 2.7, cz + p, y, 'w', fab); } } }
    pendant(F, cx, cz, y + 9, 2.4, .9); rug(F, [cx - 4.5, cx + 4.5, cz - 3.8, cz + 3.8], y, rugM);
    if (D >= 11) bx(F, [cx - 2.5, cx + 2.5, z0 + .3, z0 + 1.8], y, y + 2.8, pick(R, WOODS), { solid: true }); art(F, cx, z0 + .02, y + 4.8, 3.8, 2.4, R); plant(F, ...corner(1, 1), y, R); return;
  }
  if (t === 'bath') {
    const double = W >= 8 && r.type !== 'powder';
    vanity(F, [x0 + .3, Math.min(x1 - .3, x0 + (double ? 6 : 3.8)), z0 + .25, z0 + 2], y, 's', double ? [[x0 + 1.8, z0 + 1.1], [x0 + 4.5, z0 + 1.1]] : [[x0 + 2, z0 + 1.1]]);
    if (D >= 6) toilet(F, x1 - 1.4, z0 + 1.2, y, 's');
    if (r.type !== 'powder' && W >= 7 && D >= 8) { if (v !== 1 && W >= 8) tub(F, [x0 + .3, x0 + 5.6, z1 - 2.9, z1 - .3], y);
      else { box(F, x1 - 4, x1 - .2, y, y + .15, z1 - 4, z1 - .2, M.btile, { walk: true }); box(F, x1 - 4.05, x1 - 3.98, y, y + 7, z1 - 4, z1 - .2, M.glass, { solid: true }); box(F, x1 - 4, x1 - .2, y, y + 7, z1 - 4.05, z1 - 3.98, M.glass, { solid: true }); } }
    if (W >= 7) plant(F, x0 + .8, z1 - .8, y, R, false); return;
  }
  if (t === 'office') {
    if (v === 1 && W >= 9 && D >= 9) { table(F, [x0 + .4, x0 + 6, z0 + .4, z0 + 2.6], y, 2.5, pick(R, WOODS)); table(F, [x0 + .4, x0 + 2.6, z0 + 2.6, z0 + 6], y, 2.5, pick(R, WOODS)); chair(F, x0 + 3.6, z0 + 3.6, y, 'n', fab); }
    else { table(F, [cx - 2.6, cx + 2.6, z0 + .5, z0 + 2.7], y, 2.5, pick(R, WOODS)); chair(F, cx, z0 + 3.6, y, 'n', fab); }
    bookshelf(F, [x1 - 1.4, x1 - .3, z0 + .5, Math.min(z1 - .5, z0 + 7)], y, R);
    if (r.type === 'library') { bookshelf(F, [x0 + .3, x0 + 1.4, z0 + 3, z1 - .5], y, R); armchair(F, cx + 1, z1 - 2.2, y, 'n', fab2); floorLamp(F, cx + 3, z1 - 1.2, y); }
    plant(F, ...corner(-1, 1), y, R); rug(F, [x0 + 1.5, x1 - 1.5, z0 + 3, z1 - 1.5], y, rugM); return;
  }
  if (r.type === 'gym') { bx(F, [x0 + .6, x0 + 3, z0 + .6, z0 + 6.5], y, y + 1.2, M.black, { solid: true }); bx(F, [x0 + .8, x0 + 2.8, z0 + .8, z0 + 1.4], y + 1.2, y + 4.2, M.black);
    bx(F, [cx - .8, cx + .8, cz - 2, cz + 2], y, y + 1.5, fab, { solid: true }); bx(F, [x1 - 1.2, x1 - .3, z0 + 1, z1 - 1], y, y + 3.2, M.steel, { solid: true }); box(F, x0 + .05, x0 + .1, y + 1, y + 7, z0 + 7, z1 - 1, M.glass); rug(F, [cx - 3, cx + 3, cz + 2.5, z1 - .5], y, M.rug2); return; }
  if (r.type === 'playroom') { rug(F, [x0 + 1, x1 - 1, z0 + 1, z1 - 1], y, pick(R, RUGS)); table(F, [cx - 1.5, cx + 1.5, cz - 1, cz + 1], y, 1.6, M.white); for (const [dx, f] of [[-2.2, 'e'], [2.2, 'w']]) chair(F, cx + dx, cz, y, f, pick(R, ART));
    for (let k = 0; k < 3; k++) bx(F, [x0 + .4 + k * 1.8, x0 + 2 + k * 1.8, z0 + .4, z0 + 1.8], y, y + 1.5, pick(R, ART), { solid: true });
    for (const [px2, pz2] of [[x1 - 1.6, z1 - 1.6], [x1 - 3.4, z1 - 1.4]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), pick(R, ART)); b.scale.y = .6; b.position.set(px2, y + .6, pz2); b.castShadow = true; F.add(b); } return; }
  if (r.type === 'workshop') { bx(F, [x0 + .3, Math.min(x1 - .3, x0 + 8), z0 + .3, z0 + 2.5], y, y + 3, M.walnut, { solid: true }); box(F, x0 + .3, Math.min(x1 - .3, x0 + 8), y + 4, y + 7, z0 + .05, z0 + .15, M.oak); shelving(F, [x1 - 1.9, x1 - .3, z0 + .5, z1 - .5], y, 'w'); return; }
  if (r.type === 'wine') { for (const e of [[x0 + .3, x0 + 1.4, z0 + .3, z1 - .3], [x1 - 1.4, x1 - .3, z0 + .3, z1 - .3]]) { bx(F, e, y, y + 7, M.walnut, { solid: true }); for (let yy = y + .4; yy < y + 6.8; yy += .5) for (let zz = e[2] + .3; zz < e[3] - .2; zz += .4) box(F, e[0] - .02, e[1] + .02, yy, yy + .15, zz, zz + .15, M.black, { cast: false }); } table(F, [cx - 1, cx + 1, cz - 1, cz + 1], y, 3.4, M.walnut); return; }
  if (r.type === 'pantry') { for (const e of [[x0 + .3, x1 - .3, z0 + .3, z0 + 1.6], [x0 + .3, x0 + 1.6, z0 + 1.6, z1 - .3]]) { bx(F, e, y, y + .1, M.white); for (const h of [1.5, 3, 4.5, 6]) { bx(F, e, y + h, y + h + .08, M.white); for (let p = e[0] + .2; p < e[1] - .3; p += .5) box(F, p, p + .35, y + h + .08, y + h + .6, e[2] + .2, e[2] + .6, pick(R, BOOKS), { cast: false }); } } return; }
  if (t === 'closet') { shelving(F, [x0 + .3, x1 - .3, z0 + .2, z0 + 1.9], y, 's'); if (r.type === 'walkin' && D >= 7) { shelving(F, [x0 + .2, x0 + 1.9, z0 + 2, z1 - .3], y, 'e'); if (W >= 7) shelving(F, [x1 - 1.9, x1 - .2, z0 + 2, z1 - .3], y, 'w'); if (W >= 8 && D >= 8) bx(F, [cx - 1.5, cx + 1.5, cz, cz + 2], y, y + 3, pick(R, WOODS), { solid: true }); } return; }
  if (t === 'laundry') { for (const [a, b] of [[x0 + .4, x0 + 2.9], [x0 + 3.1, x0 + 5.6]]) if (b < x1) { bx(F, [a, b, z0 + .3, z0 + 2.8], y, y + 3.2, M.white, { solid: true }); const c = cyl(F, (a + b) / 2, z0 + 2.82, .75, -.02, .02, M.black, 20); c.rotation.x = Math.PI / 2; c.position.y = y + 1.6; }
    if (W >= 8) { lowerCab(F, [x0 + 5.8, x1 - .3, z0 + .3, z0 + 2.3], y, 's'); sink(F, x1 - 1.6, z0 + 1.2, y + 3.14); } upperCab(F, [x0 + .3, x1 - .3, z0 + .3, z0 + 1.4], y + 4.8, y + 7.4); return; }
  if (t === 'mud') { bx(F, [x0 + .3, Math.min(x1 - .3, x0 + 6), z0 + .3, z0 + 1.9], y, y + 1.6, pick(R, WOODS), { solid: true }); box(F, x0 + .3, Math.min(x1 - .3, x0 + 6), y + 4.5, y + 5, z0 + .05, z0 + .4, M.oak);
    for (let p = x0 + .8; p < Math.min(x1 - .5, x0 + 5.7); p += 1.1) cyl(F, p, z0 + .5, .06, y + 4.3, y + 4.5, M.black, 6); rug(F, [x0 + 1, x1 - 1, cz, z1 - .8], y, rugM); return; }
  if (t === 'theatre' && W >= 10) { for (const [row, hh] of [[cz - 1, 0], [cz + 2.6, .6]]) { if (hh) box(F, x0 + .3, x1 - .3, y, y + hh, row - .2, z1 - .3, M.carpet, { walk: true }); for (let k = 0; k < Math.floor((W - 2) / 2.8); k++) sofa(F, [x0 + 1 + k * 2.8, x0 + 3.4 + k * 2.8, row, row + 2.6], y + hh, 's', M.leather); }
    box(F, cx - Math.min(5, W / 2 - 1), cx + Math.min(5, W / 2 - 1), y + 1.5, y + 7, z0 + .1, z0 + .2, M.white); return; }
  if (t === 'hall' || t === 'foyer') { if (W >= 6 && D >= 6) { bx(F, [cx - 2, cx + 2, z0 + .3, z0 + 1.4], y, y + 2.8, pick(R, WOODS), { solid: true }); art(F, cx, z0 + .02, y + 4.6, 3, 2, R); plant(F, cx + 2.8, z0 + .9, y, R, false);
      rug(F, [cx - Math.min(3, W / 2 - 1), cx + Math.min(3, W / 2 - 1), z0 + 2.5, z1 - 1], y, rugM); } else if (D >= 10 && W >= 3.5) rug(F, [x0 + .8, x1 - .8, z0 + 1.5, z1 - 1.5], y, rugM); return; }
  if (t === 'storage') { shelving(F, [x0 + .3, x1 - .3, z0 + .2, z0 + 1.9], y, 's'); return; }
  if (t === 'garage' && W >= 13 && D >= 18 && !r._car) { const along = D >= W; const car = makeSedan(); car.rotation.y = along ? -Math.PI / 2 : Math.PI; car.position.set(cx, GF, cz); F.add(car);
    const k = box(F, along ? cx - 3.1 : cx - 8, along ? cx + 3.1 : cx + 8, GF, GF + 4.6, along ? cz - 8 : cz - 3.1, along ? cz + 8 : cz + 3.1, M.glass, { solid: true, cast: false }); k.visible = false;
    shelving(F, along ? [x0 + .3, x0 + 1.9, z0 + 2, z1 - 4] : [x0 + 2, x1 - 4, z0 + .3, z0 + 1.9], GF, along ? 'e' : 's'); return; }
}
// Furnish a room in its own rotated frame: r.rot quarter-turns, so the layout can be turned away from a door.
function layoutGroup(r, y, rot, vr) {
  rot = ((rot % 4) + 4) % 4; const odd = rot % 2, W = odd ? r.d : r.w, D = odd ? r.w : r.d;
  const g = new THREE.Group(); g.position.set(r.x + r.w / 2, 0, r.z + r.d / 2); g.rotation.y = -rot * Math.PI / 2;
  const before = walkables.length; furnishRoom(g, { ...r, var: vr, x: -W / 2, z: -D / 2, w: W, d: D }, y); g.userData.walk = walkables.splice(before);
  return g;
}
const _fb = new THREE.Box3();
function conflicts(g, zones, y) { // how many furniture pieces sit in a keep-clear zone
  g.updateMatrixWorld(true); let n = 0;
  g.traverse(o => { if (!o.isMesh || !o.visible) return; _fb.setFromObject(o); if (_fb.max.y - y < .3) return; // rugs and mats are fine
    for (const z of zones) if (_fb.max.x > z.x0 && _fb.min.x < z.x1 && _fb.max.z > z.z0 && _fb.min.z < z.z1 && _fb.max.y > z.yMin) { n++; break; } });
  return n;
}
// Furnish a room: if you haven't turned it yourself, try each orientation (and a second layout) and keep the one that blocks the fewest doors, openings and windows.
function furnish(F, r, y, zones = []) {
  const near = zones.filter(z => z.x1 > r.x - .5 && z.x0 < r.x + r.w + .5 && z.z1 > r.z - .5 && z.z0 < r.z + r.d + .5);
  const tries = r.rot !== undefined ? [[r.rot, r.var || 0]] : [0, 1, 2, 3].map(k => [k, r.var || 0]).concat([0, 1, 2, 3].map(k => [k, (r.var || 0) + 1]));
  let best = null;
  for (const [rot, vr] of tries) {
    const g = layoutGroup(r, y, rot, vr), sc = near.length ? conflicts(g, near, y) : 0;
    if (!best || sc < best.sc) { if (best) dropLayout(best.g); best = { g, sc }; } else dropLayout(g);
    if (best.sc === 0) break;
  }
  F.add(best.g); walkables.push(...best.g.userData.walk);
}
function dropLayout(g) { g.traverse(o => { if (o.isMesh) o.geometry?.dispose(); }); }
