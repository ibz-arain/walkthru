
// ---------- Walls with openings ----------
// out: which face is exterior ('-x','+x','-z','+z'); ops: {c,w,b,h,k,sw,hinge}
const FACE = { '+x': 0, '-x': 1, '+z': 4, '-z': 5 };
function wallMats(inner, outer, out) {
  const a = [inner, inner, inner, inner, inner, inner];
  if (out) a[FACE[out]] = outer; return a;
}
function wall(parent, x0, z0, x1, z1, o = {}) {
  const t = o.t ?? INT, y0 = o.y0 ?? MF, y1 = o.y1 ?? MC;
  const horiz = Math.abs(z1 - z0) < 1e-6;
  const s0 = (horiz ? Math.min(x0, x1) : Math.min(z0, z1)) + .012, s1 = (horiz ? Math.max(x0, x1) : Math.max(z0, z1)) - .012;
  const c = horiz ? z0 : x0;
  const inner = o.mat ?? M.paint, outer = o.outer ?? M.stucco;
  const mats = wallMats(inner, outer, o.out);
  for (const f in o.faceMat || {}) if (f !== o.out) mats[FACE[f]] = o.faceMat[f]; // a room's own paint or accent wall
  const osign = o.out ? (o.out[0] === '+' ? 1 : -1) : 0;
  const ops = (o.ops || []).slice().sort((a, b) => a.c - b.c);
  const piece = (a, b, ya, yb) => { if (b - a > .01 && yb - ya > .01) boxAN(parent, horiz, Math.max(s0, a - .004), Math.min(s1, b + .004), ya, yb, c - t / 2, c + t / 2, mats, { solid: true }); };
  let cur = s0;
  for (const op of ops) {
    const a = op.c - op.w / 2, b = op.c + op.w / 2;
    piece(cur, a, y0, y1);
    if (op.b > y0) piece(a, b, y0, op.b);
    if (op.b + op.h < y1) piece(a, b, op.b + op.h, y1);
    fillOpening(parent, horiz, c, t, osign, { ...op, fm: op.fm ?? o.frame, om: outer, lites: op.lites ?? o.lites });
    cur = b;
  }
  piece(cur, s1, y0, y1);
  // stone skirt on the exterior face (A-3.01: stone base from grade to main floor)
  if (o.skirt && osign) {
    const top = o.skirtTop ?? MF; let a0 = s0 - (o.skirtExt ?? 0.13);
    const cuts = ops.filter(op => op.b < top - .05).map(op => [op.c - op.w / 2, op.c + op.w / 2]);
    const spans = []; for (const [a, b] of cuts) { spans.push([a0, a]); a0 = b; } spans.push([a0, s1 + (o.skirtExt ?? 0.13)]);
    const n0 = c + osign * t / 2, n1 = n0 + osign * 0.15;
    for (const [a, b] of spans) if (b - a > .05) boxAN(parent, horiz, a, b, -0.4, top, n0, n1, o.skirtMat ?? M.stone);
  }
}
function fillOpening(p, horiz, c, t, os, op) {
  const a = op.c - op.w / 2, b = op.c + op.w / 2, yb = op.b, yt = op.b + op.h;
  const k = op.k || 'win', FM = op.fm ?? M.trim;
  const nIn = os ? -os : 1; // direction pointing into the room
  if (k === 'open') { casing(p, horiz, c, t, a, b, yb, yt); return; }
  if (k === 'door') {
    const st = op.style || 'single', sw = (op.sw ?? 1), n0 = c + sw * t / 2;
    if (st !== 'barn') casing(p, horiz, c, t, a, b, yb, yt);
    if (st === 'cased') return; // just a trimmed opening
    const leaf = (h0, len, glass) => { // a leaf standing open at hinge position h0, sticking `len` into the room
      boxAN(p, horiz, h0, h0 + .14, yb, yt - .04, n0, n0 + sw * len, M.white);
      if (glass) boxAN(p, horiz, h0 - .01, h0 + .15, yb + .6, yt - .5, n0 + sw * .25, n0 + sw * (len - .25), M.glass);
    };
    if (st === 'double' || st === 'french') { leaf(a + .05, op.w / 2 - .08, st === 'french'); leaf(b - .19, op.w / 2 - .08, st === 'french'); return; }
    if (st === 'bifold') { for (const h0 of [a + .05, b - .19]) leaf(h0, Math.min(1, op.w / 4), false); return; }
    if (st === 'pocket') { const s0 = op.hinge === 'b' ? b - .4 : a - op.w + .4; boxAN(p, horiz, s0, s0 + op.w, yb, yt - .04, c - .06, c + .06, M.white); return; } // slid into the wall, the edge shows
    if (st === 'barn') { // a slab on the face of the wall, slid to one side, hanging from a rail
      const side = op.hinge === 'b' ? -1 : 1, s0 = side > 0 ? b - .3 : a - op.w + .3, nf = c + sw * (t / 2 + .05);
      boxAN(p, horiz, Math.min(a, s0) - .3, Math.max(b, s0 + op.w) + .3, yt + .25, yt + .4, nf + sw * .02, nf + sw * .14, M.black);
      boxAN(p, horiz, s0, s0 + op.w, yb + .05, yt + .3, nf + sw * .14, nf + sw * .3, M.walnut);
      return;
    }
    leaf(op.hinge === 'b' ? b - .19 : a + .05, op.w - .1, false);
    return;
  }
  // exterior units: frame sits toward the outside face
  const fc = c + (os || 0) * (t / 2 - .22);
  const f0 = fc - .16, f1 = fc + .16, fw = .17;
  const frame = (sa, sb, ya, yb2) => boxAN(p, horiz, sa, sb, ya, yb2, f0, f1, FM);
  frame(a, b, yt - fw, yt); frame(a, a + fw, yb, yt); frame(b - fw, b, yb, yt);
  if (k !== 'garage' && k !== 'front' && k !== 'extdoor') frame(a, b, yb, yb + fw);
  // inner jamb return (painted)
  boxAN(p, horiz, a - .02, b + .02, yt, yt + .02, c - t / 2, c + t / 2, M.paint);
  if (k === 'win') {
    boxAN(p, horiz, a + fw, b - fw, yb + fw, yt - fw, fc - .02, fc + .02, M.glass, { solid: true });
    const st = op.style || 'casement', mid = (yb + yt) / 2;
    const n = st === 'picture' || st === 'grid' ? 0 : st === 'slider' ? 1 : op.w > 7.5 ? 2 : op.w > 5 ? 1 : 0;
    for (let i = 1; i <= n; i++) { const m = a + (op.w * i) / (n + 1); frame(m - .06, m + .06, yb, yt); }
    if (st === 'doublehung') { frame(a, b, mid - .07, mid + .07); boxAN(p, horiz, a + fw, b - fw, yb + fw, mid, fc - .08, fc - .03, M.glass); }
    else if (st === 'awning') frame(a, b, yt - (yt - yb) * .38 - .06, yt - (yt - yb) * .38 + .06);
    else if (st === 'transom') frame(a, b, yb + (yt - yb) * .74 - .06, yb + (yt - yb) * .74 + .06);
    else if (op.h > 6 && !op.lites && st === 'casement') frame(a, b, yb + 1.4, yb + 1.52); // lower awning rail on tall units
    if (op.lites) { // divided lites with a transom on tall units
      const mb = (sa, sb, ya, yb2) => boxAN(p, horiz, sa, sb, ya, yb2, fc - .07, fc + .07, FM);
      const x0 = a + fw, iw = op.w - 2 * fw, y0 = yb + fw, ih = op.h - 2 * fw, tall = op.h > 6, ty = y0 + ih * .74;
      if (tall) mb(x0, x0 + iw, ty - .06, ty + .06);
      const nv = Math.max(1, Math.round(iw / 1.4));
      for (let q = 1; q < nv; q++) { const m = x0 + iw * q / nv; mb(m - .04, m + .04, tall ? ty : y0, y0 + ih); }
      if (tall && iw > 3) mb(x0 + iw / 2 - .04, x0 + iw / 2 + .04, y0, ty);
    }
    // sill outside + stool inside
    if (os) boxAN(p, horiz, a - .15, b + .15, yb - .12, yb, c + os * t / 2 - .05, c + os * (t / 2 + .22), (op.om ?? M.stucco));
    return;
  }
  if (k === 'slider') {
    const mid = (a + b) / 2;
    boxAN(p, horiz, a + fw, mid + .1, yb + fw, yt - fw, fc - .04 + .12, fc + .04 + .12, M.glass, { solid: true });
    frame(mid - .05, mid + .15, yb, yt);
    boxAN(p, horiz, a + fw + .3, mid - .05, yb + fw, yt - fw, fc - .1, fc - .04, M.glass); // slid-open panel parked behind
    frame(a, b, yb, yb + .1);
    return;
  }
  if (k === 'garage') {
    const n0 = fc - .12, n1 = fc + .12;
    boxAN(p, horiz, a + fw, b - fw, yb, yt - fw, n0, n1, FM, { solid: true });
    const pw = b - a - 2 * fw, ph = yt - yb - fw;
    if (op.plain) { for (let r = 1; r < 8; r++) boxAN(p, horiz, a + fw, b - fw, yb + ph * r / 8 - .02, yb + ph * r / 8, n0 - .03, n1 + .03, M.black); return; }
    if (op.top) { const n = Math.max(3, Math.round(pw / 3.4)); for (let q = 0; q < n; q++) { const sx = a + fw + pw * (q + .1) / n; boxAN(p, horiz, sx, sx + pw * .8 / n, yb + ph * .79, yb + ph * .92, n0 - .02, n1 + .02, M.frost); } } // a row of lites along the top panel
    else for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) {
      const sx = a + fw + pw * (0.12 + q * 0.5), sy = yb + ph * (0.14 + r * 0.22);
      boxAN(p, horiz, sx, sx + pw * 0.26, sy, sy + ph * 0.09, n0 - .02, n1 + .02, M.frost);
    }
    for (let r = 1; r < 4; r++) boxAN(p, horiz, a + fw, b - fw, yb + ph * r / 4 - .03, yb + ph * r / 4, n0 - .03, n1 + .03, M.black);
    return;
  }
  if (k === 'front' || k === 'extdoor') {
    // leaves swung open into the house so you can walk through
    const leaves = k === 'front' ? [[a + fw, (a + b) / 2, 0], [(a + b) / 2, b - fw, 1]] : [[a + fw, b - fw, op.hinge === 'b' ? 1 : 0]];
    const dir = op.outSwing ? -nIn : nIn, glassy = op.style === 'french';
    for (const [la, lb, right] of leaves) {
      const lw = lb - la, hx = right ? lb - .2 : la + .02, n0 = c + dir * t / 2, n1 = n0 + dir * lw;
      boxAN(p, horiz, hx, hx + .18, yb, yt - fw, n0, n1, FM);
      boxAN(p, horiz, hx - .01, hx + .19, glassy ? yb + .35 : yb + .5, yt - fw - (glassy ? .35 : .5), n0 + dir * (glassy ? .2 : .3), n1 - dir * (glassy ? .2 : .3), k === 'front' && !glassy ? M.frost : M.glass);
    }
    boxAN(p, horiz, a, b, yb - .02, yb + .03, c - t / 2, c + t / 2, M.walnut, { walk: true });
  }
}
function casing(p, horiz, c, t, a, b, yb, yt) {
  const n0 = c - t / 2 - .04, n1 = c + t / 2 + .04, w = .25;
  boxAN(p, horiz, a - w, b + w, yt, yt + w, n0, n1, M.white);
  boxAN(p, horiz, a - w, a, yb, yt, n0, n1, M.white);
  boxAN(p, horiz, b, b + w, yb, yt, n0, n1, M.white);
}

// ---------- Hip roofs (4:12, Prairie-style 3'-0" overhang) ----------
// walls: x0,x1,z0,z1; slopes: {n,e,s,w}: overhang or false; hidden: edges with no fascia
function hipRoof(parent, r) {
  const P = r.pitch ?? 4 / 12, ov = r.ov ?? 3, TR = r.trim ?? M.trim, SO = r.soffit ?? M.soffit;
  const s = r.slopes;
  const ex0 = r.x0 - (s.w !== undefined && s.w !== false ? (s.w === true ? ov : s.w) : 0);
  const ex1 = r.x1 + (s.e !== undefined && s.e !== false ? (s.e === true ? ov : s.e) : 0);
  const ez0 = r.z0 - (s.n !== undefined && s.n !== false ? (s.n === true ? ov : s.n) : 0);
  const ez1 = r.z1 + (s.s !== undefined && s.s !== false ? (s.s === true ? ov : s.s) : 0);
  const eaveH = r.plate - P * (r.eaveOv ?? ov);
  const D = { n: p => p[1] - ez0, s: p => ez1 - p[1], w: p => p[0] - ex0, e: p => ex1 - p[0] };
  const keys = ['n', 'e', 's', 'w'].filter(k => s[k] !== undefined && s[k] !== false);
  const base = rect(ex0, ex1, ez0, ez1);
  const pos = [], uv = [];
  for (const k of keys) {
    let poly = base;
    for (const j of keys) if (j !== k) poly = clip(poly, p => D[k](p) - D[j](p));
    if (poly.length < 3) continue;
    const vs = poly.map(p => { const d = D[k](p); return [p[0], eaveH + P * d, p[1], (k === 'n' || k === 's') ? p[0] : p[1], d * 1.054]; });
    for (let i = 1; i < vs.length - 1; i++) for (const v of [vs[0], vs[i], vs[i + 1]]) { pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, r.mat ?? M.roof); m.castShadow = true; m.receiveShadow = true; parent.add(m);
  // fascia + soffit on visible sloped edges
  const fb = eaveH - (r.fascia ?? .75), hid = r.hidden || [];
  for (const k of keys) {
    if (hid.includes(k)) continue;
    if (k === 'n') { box(parent, ex0, ex1, fb, eaveH + .12, ez0 - .22, ez0, TR); box(parent, ex0, ex1, fb, fb + .05, ez0, r.z0, SO, { cast: false }); }
    if (k === 's') { box(parent, ex0, ex1, fb, eaveH + .12, ez1, ez1 + .22, TR); box(parent, ex0, ex1, fb, fb + .05, r.z1, ez1, SO, { cast: false }); }
    if (k === 'w') { box(parent, ex0 - .22, ex0, fb, eaveH + .12, ez0, ez1, TR); box(parent, ex0, r.x0, fb, fb + .05, ez0, ez1, SO, { cast: false }); }
    if (k === 'e') { box(parent, ex1, ex1 + .22, fb, eaveH + .12, ez0, ez1, TR); box(parent, r.x1, ex1, fb, fb + .05, ez0, ez1, SO, { cast: false }); }
  }
  // gable end walls under the roof (n/s edges at z = at, e/w edges at x = at) with rake trim
  for (const gb of r.gables || []) {
    const ns = gb.edge === 'n' || gb.edge === 's', a0 = ns ? ex0 : ez0, a1 = ns ? ex1 : ez1, N = 48, base = gb.base ?? fb;
    const H = t => { const pt = ns ? [t, gb.at] : [gb.at, t]; return eaveH + P * Math.min(...keys.map(k => D[k](pt))); };
    const gp = [], gu = [], V = (t, y) => { if (ns) gp.push(t, y, gb.at); else gp.push(gb.at, y, t); gu.push(t, y); };
    for (let i = 0; i < N; i++) { const t0 = a0 + (a1 - a0) * i / N, t1 = a0 + (a1 - a0) * (i + 1) / N, h0 = H(t0), h1 = H(t1);
      V(t0, base); V(t1, base); V(t1, h1); V(t0, base); V(t1, h1); V(t0, h0); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2)); gg.computeVertexNormals();
    const gm = new THREE.Mesh(gg, gb.mat ?? r.wall ?? M.stucco); gm.castShadow = true; gm.receiveShadow = true; parent.add(gm);
    let pt = a0, ph = -1; for (let i = 0; i <= N; i++) { const t = a0 + (a1 - a0) * i / N, h = H(t); if (h > ph) { ph = h; pt = t; } }
    const fh = r.fascia ?? .75;
    for (const [ta, tb] of [[a0, pt], [pt, a1]]) {
      const ha = H(ta), hb = H(tb), len = Math.hypot(tb - ta, hb - ha); if (len < .1) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, fh, .35), TR), out = gb.edge === 'n' || gb.edge === 'w' ? -.18 : .18;
      const cx = (ta + tb) / 2, cy = (ha + hb) / 2 - fh / 2 + .1;
      if (ns) { m.position.set(cx, cy, gb.at + out); m.rotation.z = Math.atan2(hb - ha, tb - ta); }
      else { m.position.set(gb.at + out, cy, cx); m.rotation.order = 'YXZ'; m.rotation.y = -Math.PI / 2; m.rotation.z = Math.atan2(hb - ha, tb - ta); }
      m.castShadow = true; parent.add(m);
    }
  }
  return { eaveH };
}
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// ---------- Stairs ----------
// flight running along x between xa (bottom) and xb (top), z range, from yBottom to yTop with n risers
function flight(parent, xa, xb, z0, z1, yb, yt, n) {
  const r = (yt - yb) / n, treads = n - 1, d = (xb - xa) / treads;
  for (let i = 1; i <= treads; i++) {
    const top = yb + i * r, s0 = xa + (i - 1) * d, s1 = xa + i * d;
    box(parent, s0, s1, top - .7, top, z0, z1, M.wood, { walk: true });
    box(parent, Math.min(s0, s1) - .01, Math.max(s0, s1) + .01, top - .72, top - .55, z0 - .01, z1 + .01, M.white, { cast: false });
  }
}
