
// =====================================================================
//  FLOOR PLAN EDITOR (2D) — drag walls, move rooms, add / resize / delete, auto-layout.
//  Every change rebuilds the 3D "My Design" house shortly after.
// =====================================================================
const PE = { guide: {}, lv: 'M', sel: null, selWall: null, selStair: null, s: 10, ox: 40, oy: 40, drag: null, hover: null, hist: [], redo: [], open: false, grid: true, dims: true, areas: false };
const pc = document.getElementById('peCanvas'), px = pc.getContext('2d');
{ const fill = px.fillText.bind(px), SWAP = { left: 'right', right: 'left', start: 'end', end: 'start', top: 'bottom', bottom: 'top' };
  // text on the turned canvas: turned back about its own anchor so it reads normally, its alignment swapped so it still
  // runs the same way across the plan as it was laid out
  px.fillText = (t, x, y, mw) => { const a = px.textAlign, b = px.textBaseline; px.save(); px.translate(x, y); px.scale(-1, -1); px.textAlign = SWAP[a] || a; px.textBaseline = SWAP[b] || b;
    if (mw === undefined) fill(t, 0, 0); else fill(t, 0, 0, mw); px.restore(); }; }
const snapH = v => Math.round(v * 2) / 2; // 6" grid
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const lvRooms = () => BM.rooms.filter(r => r.level === PE.lv);
// The plan is drawn as you'd see the house standing in the street: front at the bottom, its left on your left. That is the
// old top-down view turned half way round, so the canvas is rotated 180° (see peSize) and these keep working in "plan
// space" (x and y measured from the far corner). Pointer positions come in through planX / planY, and text is turned back.
const W2S = (x, z) => [x * PE.s + PE.ox, z * PE.s + PE.oy];
const planX = (e, r = pc.getBoundingClientRect()) => r.right - e.clientX, planY = (e, r = pc.getBoundingClientRect()) => r.bottom - e.clientY;
const S2W = (sx, sy) => [(sx - PE.ox) / PE.s, (sy - PE.oy) / PE.s];
function peFit() {
  const rs = BM.rooms.length ? BM.rooms : [{ x: 0, z: 0, w: 40, d: 40 }], r = pc.getBoundingClientRect();
  const x0 = Math.min(...rs.map(q => q.x)), x1 = Math.max(...rs.map(q => q.x + q.w)), z0 = Math.min(...rs.map(q => q.z)), z1 = Math.max(...rs.map(q => q.z + q.d));
  PE.s = Math.max(4, Math.min(30, Math.min((r.width - 150) / (x1 - x0 + 4), (r.height - 150) / (z1 - z0 + 4)))); // room for dimension strings
  PE.ox = (r.width - (x1 - x0) * PE.s) / 2 - x0 * PE.s + 20; PE.oy = (r.height - (z1 - z0) * PE.s) / 2 - z0 * PE.s + 16;
}
function peSize() {
  const r = pc.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2), w = Math.round(r.width * d), h = Math.round(r.height * d);
  if (!w || !h) return;
  if (pc.width !== w || pc.height !== h) { pc.width = w; pc.height = h; }
  px.setTransform(-d, 0, 0, -d, w, h); peDraw(); // turned half way round: the street at the bottom, the house's left on your left
}
// The plan area changes height when the bottom strip grows or shrinks (e.g. a room gets selected): keep the canvas in step.
if (window.ResizeObserver) new ResizeObserver(() => { if (PE.open) peSize(); }).observe(pc.parentElement);
function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 && o2 && o3 && o4 && o1 !== o2 && o3 !== o4;
}
function shapeOverlap(a, b) {
  if (!(a.x < b.x + b.w - .05 && a.x + a.w > b.x + .05 && a.z < b.z + b.d - .05 && a.z + a.d > b.z + .05)) return false;
  const pa = roomPoly(a), pb = roomPoly(b); if (!pa && !pb) return true;
  const A = pa || rect(a.x, a.x + a.w, a.z, a.z + a.d), B = pb || rect(b.x, b.x + b.w, b.z, b.z + b.d);
  const inn = (pts, other) => { const c = polyCentroid(pts); return pts.some(([x, z]) => { const L = Math.hypot(c[0] - x, c[1] - z) || 1; return pointInPoly(x + (c[0] - x) / L * .3, z + (c[1] - z) / L * .3, other); }); };
  if (inn(A, B) || inn(B, A)) return true;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segsCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
  return false;
}
function overlaps(a) { return lvRooms().some(b => b !== a && shapeOverlap(a, b)); }
function traceRoom(q) {
  const p = roomPoly(q); px.beginPath();
  if (!p) { const [a, b] = W2S(q.x, q.z); px.rect(a, b, q.w * PE.s, q.d * PE.s); return; }
  p.forEach(([x, z], i) => { const [X, Y] = W2S(x, z); i ? px.lineTo(X, Y) : px.moveTo(X, Y); }); px.closePath();
}
function shapeDim(q) {
  if (q.shape === 'round') return `⌀ ${ftin(q.w)} × ${ftin(q.d)}`;
  if (q.shape === 'tri') return `${ftin(q.w)} × ${ftin(q.d)} △`;
  if (q.shape === 'poly') return `custom ${ftin(q.w)} × ${ftin(q.d)}`;
  return `${ftin(q.w)} × ${ftin(q.d)}`;
}
let warnBoxes = []; // red warnings already drawn this frame: the next one moves down instead of printing over them
function warnText(t, x, y) {
  px.font = '600 11px Inter, system-ui, sans-serif'; px.textAlign = 'center'; const w = px.measureText(t).width + 8;
  while (warnBoxes.some(([bx, by, bw]) => Math.abs(by - y) < 13 && x - w / 2 < bx + bw / 2 && x + w / 2 > bx - bw / 2)) y += 14;
  warnBoxes.push([x, y, w]); px.fillStyle = 'rgba(255,255,255,.85)'; px.fillRect(x - w / 2, y - 7, w, 14); px.fillStyle = '#e5484d'; px.fillText(t, x, y + .5);
}
function warnBadge(x, y) { px.fillStyle = '#e5484d'; px.beginPath(); px.arc(x - 7, y + 7, 7, 0, Math.PI * 2); px.fill(); px.fillStyle = '#fff'; px.font = '700 10px Inter, system-ui, sans-serif'; px.textAlign = 'center'; px.fillText('!', x - 7, y + 7.5); }
// '#1d1d21', '#fff' or 'rgb(…)' → [r, g, b]
function toRGB(c) {
  c = String(c).trim(); if (c[0] === '#') { const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
}
// The site as the 3D builder last laid it out, under the main floor: you see the house where it sits on the lot.
function drawSite(s, W, H) {
  // solid colours, each a tint of the plan's own background: where shapes meet (a crossing, a drive over the sidewalk) the
  // later one simply covers the earlier, instead of two see-through layers doubling up
  const bg = toRGB(css('--paper')), tint = (rgb, a) => `rgb(${rgb.map((c, i) => Math.round(c * a + bg[i] * (1 - a))).join(',')})`;
  const R = ([x0, x1, z0, z1], fill) => { const [a, b] = W2S(x0, z0); px.fillStyle = fill; px.fillRect(a, b, (x1 - x0) * s, (z1 - z0) * s); };
  px.save();
  for (const r of SITE2D.roads) R(r, tint([70, 72, 78], .55));
  for (const r of SITE2D.walks) R(r, tint([196, 196, 202], .32));
  for (const r of SITE2D.drives) R(r, tint([196, 196, 202], .38));
  for (const r of SITE2D.paths) R(r, tint([212, 196, 160], .42));
  for (const r of SITE2D.steps) R(r, tint([196, 196, 202], .5));
  if (SITE2D.lot) { const [x0, x1, z0, z1] = SITE2D.lot, [a, b] = W2S(x0, z0); px.strokeStyle = 'rgba(92,160,80,.85)'; px.lineWidth = 1.5; px.setLineDash([6, 4]); px.strokeRect(a, b, (x1 - x0) * s, (z1 - z0) * s); px.setLineDash([]); }
  for (const [x, z, r] of SITE2D.trees) { const [a, b] = W2S(x, z); px.beginPath(); px.arc(a, b, r * s, 0, Math.PI * 2); px.fillStyle = 'rgba(79,122,55,.38)'; px.fill(); px.strokeStyle = 'rgba(79,122,55,.75)'; px.lineWidth = 1; px.stroke();
    px.beginPath(); px.arc(a, b, Math.max(1.5, .5 * s), 0, Math.PI * 2); px.fillStyle = 'rgba(96,72,48,.9)'; px.fill(); }
  // name each street where it shows, along its length
  px.font = '600 11px Inter, system-ui, sans-serif'; px.fillStyle = 'rgba(255,255,255,.7)'; px.textAlign = 'center'; px.textBaseline = 'middle';
  const [vx0, vz0] = S2W(0, 0), [vx1, vz1] = S2W(W, H);
  for (const [x0, x1, z0, z1] of SITE2D.roads) {
    const cx = (Math.max(x0, Math.min(vx0, vx1)) + Math.min(x1, Math.max(vx0, vx1))) / 2, cz = (Math.max(z0, Math.min(vz0, vz1)) + Math.min(z1, Math.max(vz0, vz1))) / 2;
    if (x1 - x0 > z1 - z0) { const [a, b] = W2S(cx, (z0 + z1) / 2); px.fillText('Street', a, b); }
    else { const [a, b] = W2S((x0 + x1) / 2, cz); px.save(); px.translate(a, b); px.rotate(Math.PI / 2); px.fillText('Side street', 0, 0); px.restore(); }
  }
  px.restore();
}
function peDraw() {
  warnBoxes = [];
  const r = pc.getBoundingClientRect(), W = r.width, H = r.height, s = PE.s;
  px.fillStyle = css('--paper'); px.fillRect(0, 0, W, H);
  // grid: 1 ft and 5 ft
  const [gx0, gz0] = S2W(0, 0), [gx1, gz1] = S2W(W, H);
  for (const [step, a] of PE.grid ? [[1, .07], [5, .16]] : []) { if (step * s < 5) continue; px.strokeStyle = `rgba(31,63,209,${a})`; px.lineWidth = 1; px.beginPath();
    for (let x = Math.floor(gx0 / step) * step; x <= gx1; x += step) { const X = Math.round(x * s + PE.ox) + .5; px.moveTo(X, 0); px.lineTo(X, H); }
    for (let z = Math.floor(gz0 / step) * step; z <= gz1; z += step) { const Y = Math.round(z * s + PE.oy) + .5; px.moveTo(0, Y); px.lineTo(W, Y); } px.stroke(); }
  if (PE.lv === 'M' && SITE2D) drawSite(s, W, H); // the street, sidewalks, driveway, front walk, lot and trees round the house
  // the floor below, dashed, to line things up
  const gm = guideMode(), guideLv = gm === 'none' ? null : gm === 'above' ? levelAbove(PE.lv) : levelBelow(PE.lv);
  const guide = guideLv ? BM.rooms.filter(q => q.level === guideLv) : [];
  if (guide.length) { px.setLineDash([5, 4]); px.strokeStyle = css('--ink-2'); px.lineWidth = 1; px.textAlign = 'center'; px.textBaseline = 'middle';
    for (const q of guide) { traceRoom(q); px.stroke();
      if (q.w * s > 50 && q.d * s > 22 && !lvRooms().some(o => ovl(o, q))) { const c = roomPoly(q) ? polyCentroid(roomPoly(q)) : [q.x + q.w / 2, q.z + q.d / 2], [X, Y] = W2S(c[0], c[1]); px.fillStyle = css('--ink-2'); px.globalAlpha = .55; px.font = '11px Inter, system-ui, sans-serif'; px.fillText(rname(q), X, Y); px.globalAlpha = 1; } }
    px.setLineDash([]); }
  // double-height rooms show as open to below on the 2nd floor
  if (PE.lv === 'U') for (const q of BM.rooms.filter(r => r.level === 'M' && isTall(r))) { const [a, b] = W2S(q.x, q.z); px.save(); const poly = roomPoly(q); if (poly) traceRoom(q); else { px.beginPath(); for (const [a0, a1, b0, b1] of tallParts(q)) { const [c, d] = W2S(a0, b0); px.rect(c, d, (a1 - a0) * s, (b1 - b0) * s); } } px.clip();
    px.strokeStyle = 'rgba(31,63,209,.35)'; px.lineWidth = 1; px.beginPath(); for (let k = -q.d * s; k < q.w * s; k += 10) { px.moveTo(a + k, b + q.d * s); px.lineTo(a + k + q.d * s, b); } px.stroke(); px.restore();
    px.fillStyle = css('--ink-2'); px.font = '600 11px Inter, system-ui, sans-serif'; px.textAlign = 'center'; px.fillText(`Open to below · ${rname(q)}`, a + q.w * s / 2, b + q.d * s / 2); }
  // rooms
  px.textAlign = 'center'; px.textBaseline = 'middle'; const roomLabels = [];
  for (const q of lvRooms()) {
    const [a, b] = W2S(q.x, q.z); px.fillStyle = (RT[q.type]?.color || '#ddd') + 'd9'; traceRoom(q); px.fill();
    if (RT[q.type]?.outdoor) { px.setLineDash([3, 3]); px.strokeStyle = '#4c7fd6'; px.lineWidth = 1.5; traceRoom(q); px.stroke(); px.setLineDash([]);
      const lv = RT[q.type].levels; if (!lvOK(q.type, q.level)) { px.fillStyle = '#ff6b6b'; px.font = '600 11px Inter, system-ui, sans-serif'; px.fillText(lv === 'U' ? 'Balconies go on the 2nd floor' : 'Put this on the main floor', a + q.w * s / 2, b + q.d * s + 13); } }
    if (q.type === 'stairs') { // draw the treads and which way they go
      const st = stairStatus(q), sd = stairDir(q), alongX = sd[1] === 'x', n = 12;
      px.strokeStyle = 'rgba(24,32,43,.35)'; px.lineWidth = 1; px.beginPath();
      for (let i = 1; i < n; i++) { if (alongX) { const x = a + q.w * s * i / n; px.moveTo(x, b + 2); px.lineTo(x, b + q.d * s - 2); } else { const y = b + q.d * s * i / n; px.moveTo(a + 2, y); px.lineTo(a + q.w * s - 2, y); } }
      px.stroke();
      const lab = st.msg ? '' : st.opening ? 'OPEN TO BELOW' : [st.up && 'UP', st.down && 'DOWN'].filter(Boolean).join(' / ');
      if (lab) { px.fillStyle = '#18181b'; px.font = '600 10px "JetBrains Mono", monospace'; px.fillText(({ '+x': '← ', '-x': '→ ', '+z': '↑ ', '-z': '↓ ' })[sd] + lab, a + q.w * s / 2, b + q.d * s - 9); }
      if (st.msg) { px.strokeStyle = '#d33'; px.lineWidth = 2; px.strokeRect(a + 1, b + 1, q.w * s - 2, q.d * s - 2);
        if (q.id === PE.sel) warnText(st.msg, a + q.w * s / 2, b + q.d * s + 13); else warnBadge(a + q.w * s - 2, b + 2); }
    }
    if (overlaps(q)) { px.strokeStyle = '#d33'; px.lineWidth = 2; px.setLineDash([4, 3]); traceRoom(q); px.stroke(); px.setLineDash([]); }
    if (q.w * s > 44 && q.d * s > 26) roomLabels.push(() => { // name, size and notes, moved off staircases and furniture; drawn last so nothing covers them
      const nameF = `500 ${Math.max(10, Math.min(14, s * 1.1))}px Inter, system-ui, sans-serif`, subF = `${Math.max(9, Math.min(12, s))}px "JetBrains Mono", monospace`;
      let sub = [PE.dims && shapeDim(q), PE.areas && fmtArea(roomArea(q))].filter(Boolean).join(' · '), tallTxt = q.tall && q.level === 'M' ? (fullyTall(q) ? '↑ double height' : isTall(q) ? '↑ double height (part)' : '↑ blocked above') : '';
      const measure = () => { px.font = nameF; let w = px.measureText(rname(q)).width; px.font = subF; if (sub) w = Math.max(w, px.measureText(sub).width); return [w, 16 + (sub ? 15 : 0) + (tallTxt ? 13 : 0)]; };
      let [tw, th] = measure(), [lx, ly] = labelSpot(q, tw + 10, th + 6, s);
      if (lx === null && (sub || tallTxt)) { const keep = [sub, tallTxt]; sub = ''; tallTxt = ''; [tw, th] = measure(); [lx, ly] = labelSpot(q, tw + 10, th + 6, s); if (lx === null) [sub, tallTxt] = keep, [tw, th] = measure(); } // squeezed: the name alone
      if (lx === null) { px.fillStyle = 'rgba(255,255,255,.88)'; px.fillRect(a + q.w * s / 2 - tw / 2 - 5, b + q.d * s / 2 - th / 2 - 3, tw + 10, th + 6); } // nowhere free: keep it readable on top
      const X = lx ?? a + q.w * s / 2, Y0 = (ly ?? b + q.d * s / 2) + th / 2 - 8; // the top line: up the mirrored canvas is +y
      px.fillStyle = '#18181b'; px.font = nameF; px.fillText(rname(q), X, Y0);
      px.font = subF; px.fillStyle = '#5b5b66'; if (sub) px.fillText(sub, X, Y0 - 15);
      if (tallTxt) { px.font = '600 10px "JetBrains Mono", monospace'; px.fillStyle = isTall(q) ? '#1f3fd1' : '#c0392b'; px.fillText(tallTxt, X, Y0 - (sub ? 28 : 15)); } });
  }
  // walls + openings from the same generator the 3D uses
  for (const w of planLevel(PE.lv)) {
    if (w.angled) { const [x0, y0] = W2S(w.x0, w.z0), [x1, y1] = W2S(w.x1, w.z1), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1; px.strokeStyle = css('--ink'); px.lineWidth = Math.max(2, (w.ext ? EXT : INT) * s); px.lineCap = 'butt'; px.beginPath();
      if (w.win && L > 8) { const g = .22; px.moveTo(x0, y0); px.lineTo(x0 + dx * ( .5 - g), y0 + dy * (.5 - g)); px.moveTo(x0 + dx * (.5 + g), y0 + dy * (.5 + g)); px.lineTo(x1, y1); } else { px.moveTo(x0, y0); px.lineTo(x1, y1); } px.stroke(); continue; }
    if (w.rail) { px.strokeStyle = w.kind === 'none' ? css('--ink-3') : '#4c7fd6'; px.lineWidth = 2; px.setLineDash(w.kind === 'none' ? [4, 4] : []); px.beginPath(); if (w.axis === 'x') { px.moveTo(...W2S(w.a, w.c)); px.lineTo(...W2S(w.b, w.c)); } else { px.moveTo(...W2S(w.c, w.a)); px.lineTo(...W2S(w.c, w.b)); } px.stroke(); px.setLineDash([]); continue; }
    if (w.open) { px.strokeStyle = css('--ink-2'); px.lineWidth = 1.5; px.setLineDash([5, 4]); px.beginPath(); if (w.axis === 'x') { px.moveTo(...W2S(w.a, w.c)); px.lineTo(...W2S(w.b, w.c)); } else { px.moveTo(...W2S(w.c, w.a)); px.lineTo(...W2S(w.c, w.b)); } px.stroke(); px.setLineDash([]); continue; }
    const hz = w.axis === 'x', th = Math.max(2, (w.ext ? EXT : INT) * s);
    const seg = (a, b, col, t) => { px.strokeStyle = col; px.lineWidth = t; px.beginPath(); if (hz) { px.moveTo(...W2S(a, w.c)); px.lineTo(...W2S(b, w.c)); } else { px.moveTo(...W2S(w.c, a)); px.lineTo(...W2S(w.c, b)); } px.stroke(); };
    seg(w.a - (w.ext ? EXT / 2 : 0), w.b + (w.ext ? EXT / 2 : 0), css('--ink'), th);
    for (const o of w.ops) {
      const a = o.c - o.w / 2, b = o.c + o.w / 2; seg(a, b, css('--paper'), th + 1);
      drawOpening(px, W2S, w, o, s, '#111114', '#4c7fd6');
    }
  }
  // staircases: their own layer, drawn over the rooms
  const ARW = { '+x': '←', '-x': '→', '+z': '↑', '-z': '↓' }; // the plan is turned half way round: toward the back is up, +x is left
  for (const S of (BM.stairs || [])) {
    const here = S.level === PE.lv, above = stairUp(S) === PE.lv; if (!here && !above) continue;
    const dir = stairDirOf(S), r = stairRect(S, dir), [a, b] = W2S(r.x, r.z), st = stairStatus(S), ax = dir[1] === 'x', n = 14;
    if (above) { px.setLineDash([5, 4]); px.strokeStyle = css('--accent'); px.lineWidth = 1.5; px.strokeRect(a, b, r.w * s, r.d * s); px.setLineDash([]);
      const under = stairsOn(PE.lv).some(o => ovl(stairRect(o, stairDirOf(o)), r)); // a flight starting here sits on top: its label says enough
      if (!under && r.w * s > 70) { px.fillStyle = css('--ink-2'); px.font = '600 10px "JetBrains Mono", monospace'; px.textAlign = 'center'; px.fillText(r.w * s > 120 ? 'STAIRS FROM BELOW' : 'FROM BELOW', a + r.w * s / 2, b + r.d * s / 2); }
      if (PE.selStair === S.id) { px.strokeStyle = css('--accent'); px.lineWidth = 3; px.strokeRect(a - 2, b - 2, r.w * s + 4, r.d * s + 4); } continue; }
    px.fillStyle = 'rgba(215,195,168,.92)'; px.fillRect(a, b, r.w * s, r.d * s);
    px.strokeStyle = 'rgba(24,32,43,.55)'; px.lineWidth = 1; px.beginPath();
    if (turns(S)) { // two flights side by side, joined at the far end (dashed: the turn)
      const sg = dir[0] === '+' ? 1 : -1, L = ax ? r.w : r.d, Wd = ax ? r.d : r.w, hw = Wd / 2, lo = ax ? (sg > 0 ? r.x : r.x + r.w) : (sg > 0 ? r.z : r.z + r.d), a0 = ax ? r.z : r.x;
      const P2 = (p, q) => W2S(...(ax ? [lo + sg * p, a0 + q] : [a0 + q, lo + sg * p])), ln = (p0, q0, p1, q1) => { px.moveTo(...P2(p0, q0)); px.lineTo(...P2(p1, q1)); };
      ln(0, hw, L - hw, hw); for (let i = 1; i < 7; i++) { const p = (L - hw) * i / 7; ln(p, 0, p, Wd); }
      if (stairShape(S) === "curved") for (let k = 1; k < 4; k++) { const t = Math.PI * k / 4; ln(L - hw, hw, L - hw + Math.sin(t) * hw, hw - Math.cos(t) * hw); }
      else ln(L - hw, 0, L - hw, Wd);
    } else for (let i = 1; i < n; i++) { if (ax) { const x = a + r.w * s * i / n; px.moveTo(x, b); px.lineTo(x, b + r.d * s); } else { const y2 = b + r.d * s * i / n; px.moveTo(a, y2); px.lineTo(a + r.w * s, y2); } }
    px.stroke(); px.strokeStyle = st.ok ? '#18202b' : '#d33'; px.lineWidth = st.ok ? 1.5 : 2.5; px.strokeRect(a, b, r.w * s, r.d * s);
    { const fromBelow = (BM.stairs || []).some(o => o !== S && stairUp(o) === PE.lv && ovl(stairRect(o, stairDirOf(o)), r)), t = (turns(S) ? `${ARW[dir]} UP ↺` : `${ARW[dir]} UP`) + (fromBelow ? ' · ↓' : '');
      px.font = '700 12px "JetBrains Mono", monospace'; px.textAlign = 'center'; let tt = t, tw = px.measureText(tt).width + 10; const across = ax ? r.d * s : r.w * s, along = ax ? r.w * s : r.d * s;
      const rot = tw > across && tw <= along ? 1 : 0; if (tw > Math.max(across, along)) { tt = ARW[dir]; tw = px.measureText(tt).width + 10; } // too narrow either way: just the arrow
      if (rot && !ax) tt = tt.replace(/[↑↓]/g, c => c === '↑' ? '→' : '←'); // the text turns a quarter, so pre-turn the arrows to still point the way the stairs go
      px.save(); px.translate(a + r.w * s / 2, b + r.d * s / 2); if (rot && !ax) px.rotate(-Math.PI / 2); // runs along the flight when it doesn't fit across it
      px.fillStyle = 'rgba(255,255,255,.9)'; px.fillRect(-tw / 2, -9, tw, 18); px.fillStyle = '#18181b'; px.fillText(tt, 0, .5); px.restore(); }
    if (!turns(S) && stairRail(S) !== 'none') { const sd = flightSides(S, r, dir, PE.lv); px.strokeStyle = '#4c7fd6'; px.lineWidth = 2.5; px.beginPath(); // railings along the flight
      for (const c of [sd.left, sd.right]) if (c != null) { if (ax) { px.moveTo(...W2S(r.x, c)); px.lineTo(...W2S(r.x + r.w, c)); } else { px.moveTo(...W2S(c, r.z)); px.lineTo(...W2S(c, r.z + r.d)); } } px.stroke(); }
    if (!st.ok) { if (S.id === PE.selStair) warnText(st.msg, a + r.w * s / 2, b + r.d * s + 13); else warnBadge(a + r.w * s - 2, b + 2); } // the full sentence only when selected (it is in the menu too)
    if (S.id === PE.selStair) { px.strokeStyle = css('--accent'); px.lineWidth = 3; px.strokeRect(a - 2, b - 2, r.w * s + 4, r.d * s + 4); }
  }
  // hovered / dragged wall and selected room
  for (const q of lvRooms()) for (const o of lvRooms()) { if (q.id >= o.id) continue; // open connections, dashed so they can be clicked
    for (const e of edgesOf(q)) { const f = edgesOf(o).find(x => x.side === OPP[e.side]); if (!f || Math.abs(f.c - e.c) > EPS) continue; const a = Math.max(e.a, f.a), b = Math.min(e.b, f.b); if (b - a < .3 || wallMode(q, o) !== 'open') continue;
      px.setLineDash([6, 5]); px.strokeStyle = css('--ink-2'); px.lineWidth = 1.2; px.beginPath(); if (e.axis === 'x') { px.moveTo(...W2S(a, e.c)); px.lineTo(...W2S(b, e.c)); } else { px.moveTo(...W2S(e.c, a)); px.lineTo(...W2S(e.c, b)); } px.stroke(); px.setLineDash([]); } }
  if (PE.selWall && !(PE.drag?.kind === 'wall')) { const w = PE.selWall, line = w.scope === 'line', a0 = line ? w.la : w.a, b0 = line ? w.lb : w.b; px.strokeStyle = css('--accent'); px.lineWidth = 6; px.beginPath(); if (w.axis === 'x') { px.moveTo(...W2S(a0, w.c)); px.lineTo(...W2S(b0, w.c)); } else { px.moveTo(...W2S(w.c, a0)); px.lineTo(...W2S(w.c, b0)); } px.stroke();
    if (w.scope === 'seg') { px.fillStyle = css('--accent'); for (const t of [a0, b0]) { const [X, Y] = w.axis === 'x' ? W2S(t, w.c) : W2S(w.c, t); px.beginPath(); px.arc(X, Y, 4.5, 0, 7); px.fill(); } } }
  const hv = PE.drag?.kind === 'wall' ? PE.drag : PE.hover;
  if (hv?.kind === 'wall') { px.strokeStyle = css('--accent'); px.lineWidth = 4; px.beginPath();
    if (hv.axis === 'x') { px.moveTo(...W2S(hv.a, hv.c + (hv.delta || 0))); px.lineTo(...W2S(hv.b, hv.c + (hv.delta || 0))); } else { px.moveTo(...W2S(hv.c + (hv.delta || 0), hv.a)); px.lineTo(...W2S(hv.c + (hv.delta || 0), hv.b)); } px.stroke(); }
  const sel = BM.rooms.find(q => q.id === PE.sel);
  if (sel && sel.level === PE.lv) { px.strokeStyle = css('--accent'); px.lineWidth = 2.5; traceRoom(sel); px.stroke(); drawShapeHandles(sel); }
  // empty floor: say what to do instead of showing a blank grid
  if (!lvRooms().length && !guide.length) { px.textAlign = 'center'; px.fillStyle = css('--ink'); px.font = '600 15px Inter, system-ui, sans-serif';
    px.fillText(`No ${LV_NAME[PE.lv].toLowerCase()} rooms yet`, W / 2, H / 2); }
  // scale bar
  px.fillStyle = css('--ink-2'); px.font = '11px "JetBrains Mono", monospace'; px.textAlign = 'left'; const [bft, blab] = SCALE_BAR(), bar = bft * s; px.fillRect(14, H - 58, bar, 3); px.fillText(blab, 18 + bar, H - 56);
  peDrawExtras(s);
  px.textAlign = 'center'; px.textBaseline = 'middle'; for (const f of roomLabels) f();
  peStatus();
}
// Where a room's label fits without sitting on a staircase (screen px): the centre if free, else the nearest free spot inside the room; [null, null] if none.
function labelSpot(q, w, h, s) {
  const [a, b] = W2S(q.x, q.z), A = q.w * s, B = q.d * s, poly = roomPoly(q), blocks = (BM.stairs || []).filter(o => o.level === PE.lv || stairUp(o) === PE.lv).map(o => { const r = stairRect(o, stairDirOf(o)), [x, y] = W2S(r.x, r.z); return [x - 4, y - 4, r.w * s + 8, r.d * s + 8]; })
    .concat((BM.items || []).filter(i => i.level === PE.lv && i.kind !== 'rug').map(i => { const [iw, id] = itemDims(i), [x, y] = W2S(i.x - iw / 2, i.z - id / 2); return [x - 2, y - 2, iw * s + 4, id * s + 4]; })); // and placed furniture (rugs are fine to sit on)
  const free = (cx, cy) => { const [wx, wz] = S2W(cx, cy); return cx - w / 2 >= a + 2 && cx + w / 2 <= a + A - 2 && cy - h / 2 >= b + 2 && cy + h / 2 <= b + B - 2 && (!poly || pointInPoly(wx, wz, poly)) && !blocks.some(([x, y, bw, bh]) => cx + w / 2 > x && cx - w / 2 < x + bw && cy + h / 2 > y && cy - h / 2 < y + bh); };
  const c0 = poly ? polyCentroid(poly) : [q.x + q.w / 2, q.z + q.d / 2], [cx0, cy0] = W2S(c0[0], c0[1]); if (free(cx0, cy0)) return [cx0, cy0];
  let best = null, bd = Infinity; for (let gy = b + h / 2 + 2; gy <= b + B - h / 2 - 2; gy += 6) for (let gx = a + w / 2 + 2; gx <= a + A - w / 2 - 2; gx += 6) { const d = Math.hypot(gx - cx0, gy - cy0); if (d < bd && free(gx, gy)) { bd = d; best = [gx, gy]; } }
  return best || [null, null];
}
// can this room type go on this floor? Decks and porches sit on the main floor, balconies and catwalks on any floor above it
const lvOK = (type, lv) => { const want = RT[type]?.levels; return !want || (want === 'M' ? lv === 'M' : upperLevel(lv)); };
function peStatus() {
  const rs = lvRooms(), sf = Math.round(rs.filter(q => !RT[q.type]?.outdoor && q.type !== 'garage' && q.type !== 'open').reduce((a, q) => a + roomArea(q), 0));
  const el = document.getElementById('peStatus'); if (el) el.textContent = `${LV_NAME[PE.lv]} · ${rs.length} room${rs.length === 1 ? '' : 's'} · ${fmtArea(sf)}`;
  const z = document.getElementById('peZoomV'); if (z) z.textContent = Math.round(PE.s / 10 * 100) + '%';
}
function peZoom(k) { const r = pc.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, [wx, wz] = S2W(cx, cy); PE.s = Math.max(3, Math.min(40, PE.s * k)); PE.ox = cx - wx * PE.s; PE.oy = cy - wz * PE.s; peDraw(); }
// which wall line is under the pointer: all collinear room edges that chain together
function wallAt(wx, wz, tol) {
  let best = null;
  for (const q of lvRooms()) for (const e of edgesOf(q)) {
    const along = e.axis === 'x' ? wx : wz, perp = e.axis === 'x' ? wz : wx;
    if (along < e.a - tol || along > e.b + tol) continue; const d = Math.abs(perp - e.c); if (d < tol && (!best || d < best.d)) best = { d, e };
  }
  if (!best) return null;
  const e0 = best.e; let a = e0.a, b = e0.b; const members = [];
  const all = lvRooms().flatMap(q => edgesOf(q).map(e => ({ q, e }))).filter(({ e }) => e.axis === e0.axis && Math.abs(e.c - e0.c) < EPS);
  let grew = true; const used = new Set();
  while (grew) { grew = false; for (const m of all) { if (used.has(m)) continue; if (m.e.b >= a - EPS && m.e.a <= b + EPS) { used.add(m); members.push(m); a = Math.min(a, m.e.a); b = Math.max(b, m.e.b); grew = true; } } }
  return { kind: 'wall', axis: e0.axis, c: e0.c, a, b, members };
}
// the staircase under a point: one starting on this level, else one arriving from the level below (shown dashed), so every flight can be picked
function stairHit(wx, wz) { const inS = o => { const r = stairRect(o, stairDirOf(o)); return wx > r.x && wx < r.x + r.w && wz > r.z && wz < r.z + r.d; }, L = BM.stairs || [];
  return L.find(o => o.level === PE.lv && inS(o)) || L.find(o => stairUp(o) === PE.lv && inS(o)) || null; }
function stairEdgeAt(wx, wz, tol) {
  for (const S of (BM.stairs || [])) { if (S.level !== PE.lv) continue; const r = stairRect(S, stairDirOf(S));
    const inX = wx > r.x - tol && wx < r.x + r.w + tol, inZ = wz > r.z - tol && wz < r.z + r.d + tol;
    if (inZ && Math.abs(wx - r.x) < tol) return { S, side: 'w', r }; if (inZ && Math.abs(wx - (r.x + r.w)) < tol) return { S, side: 'e', r };
    if (inX && Math.abs(wz - r.z) < tol) return { S, side: 'n', r }; if (inX && Math.abs(wz - (r.z + r.d)) < tol) return { S, side: 's', r }; }
  return null;
}
function snapToWalls(v, axis, tol = 1.2) { // nearest room edge on this level within tol, else the 6" grid
  let best = null; for (const o of lvRooms()) for (const e of axis === 'x' ? [o.x, o.x + o.w] : [o.z, o.z + o.d]) { const d = Math.abs(e - v); if (d < tol && (best === null || d < Math.abs(best - v))) best = e; }
  return best !== null ? best : snapH(v);
}
function setStairRect(S, dir, r) { const ax = dir[1] === 'x'; S.cx = +(r.x + r.w / 2).toFixed(2); S.cz = +(r.z + r.d / 2).toFixed(2); S.L = +(ax ? r.w : r.d).toFixed(2); S.W = +(ax ? r.d : r.w).toFixed(2); }
function roomAt(wx, wz) { const rs = lvRooms(); for (let i = rs.length - 1; i >= 0; i--) if (insideRoom(rs[i], wx, wz)) return rs[i]; return null; }
function drawShapeHandles(q) {
  const dot = (x, z) => { const [X, Y] = W2S(x, z); px.beginPath(); px.arc(X, Y, 5, 0, 7); px.fillStyle = '#fff'; px.fill(); px.lineWidth = 2; px.strokeStyle = css('--accent'); px.stroke(); };
  if (q.shape === 'poly') for (const [u, v] of q.pts || []) dot(q.x + u, q.z + v);
  else if (q.shape === 'round') { dot(q.x + q.w, q.z + q.d / 2); dot(q.x, q.z + q.d / 2); dot(q.x + q.w / 2, q.z); dot(q.x + q.w / 2, q.z + q.d); }
  else if (q.shape === 'tri') for (const [x, z] of roomPoly(q)) dot(x, z);
}
function shapeHandleAt(wx, wz) {
  const q = BM.rooms.find(r => r.id === PE.sel && r.level === PE.lv && r.shape && r.shape !== 'rect'); if (!q) return null;
  const tol = 9 / PE.s; let best = null; const near = (x, z, hit) => { const d = Math.hypot(x - wx, z - wz); if (d < tol && (!best || d < best.d)) best = { ...hit, d, q }; };
  if (q.shape === 'poly') (q.pts || []).forEach((p, i) => near(q.x + p[0], q.z + p[1], { kind: 'pt', i }));
  else if (q.shape === 'round') { near(q.x + q.w, q.z + q.d / 2, { kind: 'round', side: 'e' }); near(q.x, q.z + q.d / 2, { kind: 'round', side: 'w' }); near(q.x + q.w / 2, q.z, { kind: 'round', side: 'n' }); near(q.x + q.w / 2, q.z + q.d, { kind: 'round', side: 's' }); }
  else if (q.shape === 'tri') roomPoly(q).forEach((p, i) => near(p[0], p[1], { kind: 'tri', i }));
  return best;
}
const snapshot = () => JSON.stringify(BM);
function pushHist() { PE.redo = []; PE.hist.push(snapshot()); if (PE.hist.length > 80) PE.hist.shift(); }
let peTimer = 0;
function planChanged(redraw = true) { delete BM.extras; saveBM(); if (redraw) peDraw(); peInspector(); clearTimeout(peTimer); peTimer = setTimeout(() => { rebuildHouse3(); }, 260); }

pc.addEventListener('pointerdown', e => {
  const r = pc.getBoundingClientRect(), sx = planX(e, r), sy = planY(e, r), [wx, wz] = S2W(sx, sy);
  try { pc.setPointerCapture(e.pointerId); } catch (er) { }
  if (e.button === 2) { peMenuAt(sx, sy, wx, wz); return; }
  PE.menu = e.pointerType === 'touch'; // a click (or drag) only selects; its menu opens on right-click. Touch has no right-click, so a tap opens it.
  if (peToolDown(e, sx, sy, wx, wz)) { peDraw(); return; }
  const hd = e.button === 0 ? shapeHandleAt(wx, wz) : null;
  if (hd) { PE.sel = hd.q.id; PE.selWall = null; PE.selStair = null; const q = hd.q; PE.drag = { kind: hd.kind, q, i: hd.i, side: hd.side, x: q.x, z: q.z, w: q.w, d: q.d, pts: q.pts && q.pts.map(p => p.slice()), poly: roomPoly(q), before: snapshot() }; peInspector(); peDraw(); return; }
  const w = e.button === 0 ? wallAt(wx, wz, 7 / PE.s) : null;
  const prevSel = w && onSelWall(w, w.axis === 'x' ? wx : wz) ? PE.selWall : null;
  PE.selWall = null;
  const se = e.button === 0 ? stairEdgeAt(wx, wz, 6 / PE.s) : null;
  if (se) { const dir = stairDirOf(se.S); PE.selStair = se.S.id; PE.sel = null; PE.drag = { kind: 'stairEdge', S: se.S, side: se.side, r0: { ...se.r }, dir, before: snapshot() }; peInspector(); peDraw(); return; }
  const S = e.button === 0 ? stairHit(wx, wz) : null;
  if (S) { PE.selStair = S.id; PE.sel = null; PE.drag = { kind: 'stair', S, dx: wx - S.cx, dz: wz - S.cz, before: snapshot() }; peInspector(); peDraw(); return; }
  PE.selStair = null;
  if (w) { // a whole wall line drags every room along it; once you've clicked into one room's part of it, only that part moves
    const seg = prevSel?.scope === 'seg', ids = seg ? (prevSel.ext ? [prevSel.R.id] : [prevSel.A.id, prevSel.B.id]) : null;
    const members = seg ? w.members.filter(m => ids.includes(m.q.id) && (!prevSel.ext || m.e.out === prevSel.out)) : w.members;
    const ext = seg ? { a: Math.min(...members.map(m => m.e.a)), b: Math.max(...members.map(m => m.e.b)) } : {};
    PE.drag = { ...w, ...ext, members, prevSel, pickAlong: w.axis === 'x' ? wx : wz, start: w.axis === 'x' ? wz : wx, base: members.map(m => ({ q: m.q, side: m.e.side, x: m.q.x, z: m.q.z, w: m.q.w, d: m.q.d, pts: m.q.pts && m.q.pts.map(p => p.slice()), idx: m.e.idx })), before: snapshot(), delta: 0 }; return; }
  const q = e.button === 0 ? roomAt(wx, wz) : null;
  if (q && e.shiftKey) { // shift-click builds a multi-selection
    if (!PE.multi.size && PE.sel) PE.multi.add(PE.sel); if (PE.multi.has(q.id)) PE.multi.delete(q.id); else PE.multi.add(q.id);
    PE.sel = PE.multi.size === 1 ? [...PE.multi][0] : null; if (PE.multi.size === 1) PE.multi.clear(); PE.selStair = null; PE.drag = null; peInspector(); peDraw(); return; }
  if (q) { if (!PE.multi.has(q.id)) PE.multi.clear();
    const group = BM.rooms.filter(o => PE.multi.has(o.id) && o !== q).map(o => ({ r: o, x: o.x, z: o.z }));
    PE.sel = PE.multi.size ? null : q.id; PE.selStair = null; PE.drag = { kind: 'move', q, dx: wx - q.x, dz: wz - q.z, x0: q.x, z0: q.z, group, before: snapshot() }; peInspector(); peDraw(); return; }
  PE.sel = null; PE.multi.clear(); peInspector(); PE.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: PE.ox, oy: PE.oy }; peDraw();
});
pc.addEventListener('pointermove', e => {
  const r = pc.getBoundingClientRect(), sx = planX(e, r), sy = planY(e, r), [wx, wz] = S2W(sx, sy), D = PE.drag;
  if (peToolMove(e, wx, wz)) return;
  if (!D) { const hd = shapeHandleAt(wx, wz); if (hd) { PE.hover = null; pc.style.cursor = 'grab'; peDraw(); return; }
    const se = stairEdgeAt(wx, wz, 6 / PE.s); if (se) { PE.hover = null; pc.style.cursor = se.side === 'n' || se.side === 's' ? 'ns-resize' : 'ew-resize'; peDraw(); return; }
    PE.hover = wallAt(wx, wz, 7 / PE.s); if (PE.hover && PE.selWall?.scope === 'seg' && onSelWall(PE.hover, PE.hover.axis === 'x' ? wx : wz)) Object.assign(PE.hover, { a: PE.selWall.a, b: PE.selWall.b });
    pc.style.cursor = PE.hover ? (PE.hover.axis === 'x' ? 'ns-resize' : 'ew-resize') : roomAt(wx, wz) ? 'move' : 'grab'; peDraw(); return; }
  if (D.kind === 'pt' || D.kind === 'round' || D.kind === 'tri') {
    const q = D.q; q.x = D.x; q.z = D.z; q.w = D.w; q.d = D.d; if (D.pts) q.pts = D.pts.map(p => p.slice());
    if (D.kind === 'pt') {
      q.pts[D.i] = [snapH(wx - D.x), snapH(wz - D.z)];
      const xs = q.pts.map(p => p[0]), zs = q.pts.map(p => p[1]);
      if (Math.max(...xs) - Math.min(...xs) >= 1 && Math.max(...zs) - Math.min(...zs) >= 1) fitShapeBox(q); else { q.pts = D.pts.map(p => p.slice()); q.x = D.x; q.z = D.z; q.w = D.w; q.d = D.d; }
    } else if (D.kind === 'round') {
      const x1 = D.x + D.w, z1 = D.z + D.d;
      if (D.side === 'e') q.w = Math.max(3, +(snapH(wx) - D.x).toFixed(2));
      if (D.side === 'w') { q.x = Math.min(snapH(wx), x1 - 3); q.w = +(x1 - q.x).toFixed(2); }
      if (D.side === 's') q.d = Math.max(3, +(snapH(wz) - D.z).toFixed(2));
      if (D.side === 'n') { q.z = Math.min(snapH(wz), z1 - 3); q.d = +(z1 - q.z).toFixed(2); }
    } else {
      const p = D.poly[D.i]; let x = D.x, z = D.z, x1 = D.x + D.w, z1 = D.z + D.d;
      if (Math.abs(p[0] - D.x) < .05) x = snapH(wx); else x1 = snapH(wx);
      if (Math.abs(p[1] - D.z) < .05) z = snapH(wz); else z1 = snapH(wz);
      if (x1 - x >= 3 && z1 - z >= 3) { q.x = +x.toFixed(2); q.z = +z.toFixed(2); q.w = +(x1 - x).toFixed(2); q.d = +(z1 - z).toFixed(2); }
    }
    peDraw(); peInspector(); return;
  }
  if (D.kind === 'pan') { PE.ox = D.ox - (e.clientX - D.sx); PE.oy = D.oy - (e.clientY - D.sy); peDraw(); return; }
  if (D.kind === 'wall') {
    let delta = snapH((D.axis === 'x' ? wz : wx) - D.start);
    for (const b of D.base) { const size = D.axis === 'x' ? b.d : b.w; if (b.side === 'w' || b.side === 'n') delta = Math.min(delta, size - 3); else delta = Math.max(delta, 3 - size); }
    D.delta = delta;
    for (const b of D.base) {
      if (b.pts && b.idx) { b.q.x = b.x; b.q.z = b.z; b.q.w = b.w; b.q.d = b.d; b.q.pts = b.pts.map(p => p.slice()); for (const i of b.idx) { if (D.axis === 'x') b.q.pts[i][1] = +(b.pts[i][1] + delta).toFixed(2); else b.q.pts[i][0] = +(b.pts[i][0] + delta).toFixed(2); } fitShapeBox(b.q); continue; }
      if (b.side === 'w') { b.q.x = b.x + delta; b.q.w = b.w - delta; } else if (b.side === 'e') b.q.w = b.w + delta; else if (b.side === 'n') { b.q.z = b.z + delta; b.q.d = b.d - delta; } else b.q.d = b.d + delta;
    }
    peDraw(); return;
  }
  if (D.kind === 'stair') {
    const dir = stairDirOf(D.S), r = stairRect(D.S, dir), cx = wx - D.dx, cz = wz - D.dz;
    let x0 = cx - r.w / 2, z0 = cz - r.d / 2;
    const sx0 = snapToWalls(x0, 'x'), sx1 = snapToWalls(x0 + r.w, 'x') - r.w, sz0 = snapToWalls(z0, 'z'), sz1 = snapToWalls(z0 + r.d, 'z') - r.d;
    x0 = Math.abs(sx0 - x0) <= Math.abs(sx1 - x0) ? sx0 : sx1; z0 = Math.abs(sz0 - z0) <= Math.abs(sz1 - z0) ? sz0 : sz1;
    D.S.cx = +(x0 + r.w / 2).toFixed(2); D.S.cz = +(z0 + r.d / 2).toFixed(2); peDraw(); peInspector(); return;
  }
  if (D.kind === 'stairEdge') {
    const r = { ...D.r0 }, ax = D.dir[1] === 'x';
    if (D.side === 'w') { const x = Math.min(snapToWalls(wx, 'x'), r.x + r.w - 3); r.w = r.x + r.w - x; r.x = x; }
    if (D.side === 'e') { const x = Math.max(snapToWalls(wx, 'x'), r.x + 3); r.w = x - r.x; }
    if (D.side === 'n') { const z = Math.min(snapToWalls(wz, 'z'), r.z + r.d - 3); r.d = r.z + r.d - z; r.z = z; }
    if (D.side === 's') { const z = Math.max(snapToWalls(wz, 'z'), r.z + 3); r.d = z - r.z; }
    if (ax) { r.w = Math.max(r.w, 8); r.d = Math.min(r.d, 10); } else { r.d = Math.max(r.d, 8); r.w = Math.min(r.w, 10); } // run at least 8', width at most 10'
    D.S.dir = D.dir; setStairRect(D.S, D.dir, r); peDraw(); peInspector(); return;
  }
  if (D.kind === 'move') { // snap to the grid, then to nearby room edges (auto-connect)
    let nx = snapH(wx - D.dx), nz = snapH(wz - D.dz); const q = D.q, tol = 1.2;
    let bx = null, bz = null;
    for (const o of lvRooms()) { if (o === q) continue;
      for (const [mine, theirs] of [[nx, o.x], [nx, o.x + o.w], [nx + q.w, o.x], [nx + q.w, o.x + o.w]]) { const dd = theirs - mine; if (Math.abs(dd) < tol && (bx === null || Math.abs(dd) < Math.abs(bx))) bx = dd; }
      for (const [mine, theirs] of [[nz, o.z], [nz, o.z + o.d], [nz + q.d, o.z], [nz + q.d, o.z + o.d]]) { const dd = theirs - mine; if (Math.abs(dd) < tol && (bz === null || Math.abs(dd) < Math.abs(bz))) bz = dd; } }
    if (D.group?.length) { bx = bz = 0; } // a group moves on the grid only, so the rooms keep their spacing
    q.x = +(nx + (bx || 0)).toFixed(2); q.z = +(nz + (bz || 0)).toFixed(2);
    for (const g of D.group || []) { g.r.x = +(g.x + q.x - D.x0).toFixed(2); g.r.z = +(g.z + q.z - D.z0).toFixed(2); }
    peDraw(); peInspector();
  }
});
pc.addEventListener('pointerup', () => {
  if (peToolUp()) return;
  const D = PE.drag; PE.drag = null;
  if (D && D.before && D.before !== snapshot()) {
    const moved = D.kind === 'move' ? (D.group?.length ? null : [D.q.id]) : D.kind === 'wall' ? D.base.map(b => b.q.id) : null;
    if (moved) closeGaps(moved);
    if (D.kind === 'wall' && D.prevSel?.scope === 'seg') PE.selWall = { ...D.prevSel, c: +(D.prevSel.c + D.delta).toFixed(2) }; // keep the part you moved selected
    PE.hist.push(D.before); PE.redo = []; planChanged(); return;
  }
  if (D?.kind === 'wall') { // first click: the whole wall line; click it again: just the part between the rooms you clicked
    const prev = D.prevSel; pickWall(D); PE.selWall.scope = prev ? 'seg' : 'line'; PE.selWall.la = D.a; PE.selWall.lb = D.b; PE.sel = null; peInspector(); }
  peDraw();
});
// Right-click: select whatever is under the pointer (keeping a multi-selection it's part of) and open its menu there.
function peMenuAt(sx, sy, wx, wz) {
  const clear = () => { PE.sel = null; PE.selStair = null; PE.selWall = null; PE.selX = null; };
  const n = noteAt(sx, sy), it = n ? null : itemAt(wx, wz), d = n || it ? null : dimAt(sx, sy);
  if (n || it || d) selectX(n ? { kind: 'note', id: n.id } : it ? { kind: 'item', id: it.id } : { kind: 'dim', id: d.id });
  else {
    const w = wallAt(wx, wz, 7 / PE.s), S = w ? null : stairHit(wx, wz), q = w || S ? null : roomAt(wx, wz);
    if (w) { clear(); PE.multi.clear(); pickWall({ ...w, pickAlong: w.axis === 'x' ? wx : wz }); }
    else if (S) { clear(); PE.multi.clear(); PE.selStair = S.id; }
    else if (q) { if (!PE.multi.has(q.id)) { PE.multi.clear(); clear(); PE.sel = q.id; } }
    else { clear(); PE.multi.clear(); }
  }
  PE.menu = !!(PE.sel || PE.selStair || PE.selWall || PE.selX || PE.multi.size); PE.drag = null;
  peInspector(); peDraw(); requestAnimationFrame(pePlaceSide);
}
// is this spot on the wall line (or the part of it) that's selected?
function onSelWall(w, along) { const sw = PE.selWall; if (!sw || sw.axis !== w.axis || Math.abs(sw.c - w.c) > EPS) return false;
  const [a, b] = sw.scope === 'line' ? [sw.la ?? sw.a, sw.lb ?? sw.b] : [sw.a, sw.b]; return along >= a - .05 && along <= b + .05; }
// Find the two rooms either side of the clicked spot on a wall line.
function pickWall(D) {
  const at = D.pickAlong, side = (m, s) => m.e.side === s && at >= m.e.a - .05 && at <= m.e.b + .05;
  const lo = D.members.find(m => side(m, D.axis === 'x' ? 's' : 'e')), hi = D.members.find(m => side(m, D.axis === 'x' ? 'n' : 'w'));
  PE.selWall = lo && hi ? { A: lo.q, B: hi.q, axis: D.axis, c: D.c, a: Math.max(lo.e.a, hi.e.a), b: Math.min(lo.e.b, hi.e.b) } : { ext: true, R: (lo || hi).q, out: (lo || hi).e.out, axis: D.axis, c: D.c, a: (lo || hi).e.a, b: (lo || hi).e.b, at };
  const w = PE.selWall; if (w.ext && RT[w.R.type]?.rail) { const seg = railSegments(w.R, w.out).find(([s0, s1]) => at >= s0 - .05 && at <= s1 + .05); if (seg) { w.a = seg[0]; w.b = seg[1]; w.railSeg = seg; } } // a railing stretch: just that part
}
pc.addEventListener('wheel', e => { e.preventDefault(); const r = pc.getBoundingClientRect(), sx = planX(e, r), sy = planY(e, r), [wx, wz] = S2W(sx, sy);
  PE.s = Math.max(3, Math.min(40, PE.s * Math.exp(-e.deltaY * .0015))); PE.ox = sx - wx * PE.s; PE.oy = sy - wz * PE.s; peDraw(); }, { passive: false });
// Pinch with two fingers to zoom (and move) the plan around the point between them. The second finger turns the gesture
// into a pinch: the plan stops taking those touches (no room moves) until both fingers lift. Mouse and pen are untouched.
const pinch = { pts: new Map(), on: false };
const pinchMid = () => { const [a, b] = [...pinch.pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
pc.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch.pts.size === 2) {
    PE.drag = null; PE.menu = false;
    const r = pc.getBoundingClientRect(), m = pinchMid();
    Object.assign(pinch, { on: true, s0: PE.s, d0: Math.max(10, m.d), w: S2W(r.right - m.x, r.bottom - m.y) });
  }
  if (pinch.on) e.stopImmediatePropagation();
}, true);
pc.addEventListener('pointermove', e => {
  if (!pinch.pts.has(e.pointerId)) return;
  pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinch.on) return; e.stopImmediatePropagation();
  if (pinch.pts.size < 2) return;
  const r = pc.getBoundingClientRect(), m = pinchMid();
  PE.s = Math.max(3, Math.min(40, pinch.s0 * m.d / pinch.d0)); PE.ox = r.right - m.x - pinch.w[0] * PE.s; PE.oy = r.bottom - m.y - pinch.w[1] * PE.s; peDraw();
}, true);
const pinchUp = e => { if (!pinch.pts.delete(e.pointerId) || !pinch.on) return; e.stopImmediatePropagation(); if (!pinch.pts.size) pinch.on = false; };
pc.addEventListener('pointerup', pinchUp, true); pc.addEventListener('pointercancel', pinchUp, true);

// ---------- side panel ----------
const PE_GROUPS = [['Fill', ['open']], ['Living', ['living', 'great', 'kitchen', 'dining', 'foyer', 'hall', 'stairs', 'sunroom', 'bonus', 'rec', 'playroom', 'theatre']],
  ['Bedrooms', ['primary', 'bedroom', 'guest', 'nursery', 'walkin', 'closet']], ['Baths', ['bath', 'ensuite', 'powder']],
  ['Work & utility', ['office', 'library', 'gym', 'laundry', 'mud', 'pantry', 'storage', 'workshop', 'wine', 'garage']], ['Outside', ['porch', 'deck', 'balcony', 'bridge']]];
document.getElementById('pePalette').innerHTML = PE_GROUPS.map(([g, ks]) => `<h3>${g}</h3>` + ks.filter(k => RT[k]).map(k => `<button type="button" data-add="${k}" title="Click to add, or drag onto the plan"><i style="background:${RT[k].color}"></i>${RT[k].name}</button>`).join('')).join('');
document.getElementById('peType').innerHTML = Object.entries(RT).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
document.querySelectorAll('[data-add]').forEach(b => {
  let st = null, ghost = null;
  b.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, moved: false }; try { b.setPointerCapture(e.pointerId); } catch (er) { } });
  b.addEventListener('pointermove', e => {
    if (!st) return; if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 5) { st.moved = true; ghost = document.createElement('div'); ghost.id = 'pegDrop'; ghost.textContent = RT[b.dataset.add].name; ghost.style.background = RT[b.dataset.add].color; document.body.appendChild(ghost); }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  });
  b.addEventListener('pointerup', e => {
    const s0 = st; st = null; ghost?.remove(); ghost = null; if (!s0) return;
    if (!s0.moved) return peAdd(b.dataset.add);
    const r = pc.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    peAdd(b.dataset.add, S2W(planX(e, r), planY(e, r)));
  });
});
function peAdd(type, at) {
  if (type === 'stairs') return peAddStair(at);
  pushHist();
  const want = RT[type].levels; if (!lvOK(type, PE.lv) && !belowGrade(PE.lv)) { PE.lv = want === 'M' ? 'M' : levelAbove('M') || 'M'; PE.sel = null; peLvlButtons(); if (curHouse === 3) goView(PE.lv); }
  const [w, d] = RT[type].size, rs = lvRooms(), sel = rs.find(q => q.id === PE.sel);
  const cand = [];
  const anchor = sel || rs[rs.length - 1];
  if (anchor) cand.push([anchor.x + anchor.w, anchor.z], [anchor.x, anchor.z + anchor.d], [anchor.x - w, anchor.z], [anchor.x, anchor.z - d]);
  if (rs.length) { const x1 = Math.max(...rs.map(q => q.x + q.w)), z0 = Math.min(...rs.map(q => q.z)); cand.push([x1, z0]); } else cand.push([0, 0]);
  const q = R(type, PE.lv, 0, w, 0, d);
  if (at) { q.x = snapH(at[0] - w / 2); q.z = snapH(at[1] - d / 2); }
  else for (const [x, z] of cand) { q.x = x; q.z = z; if (!overlaps(q)) break; }
  BM.rooms.push(q); PE.sel = q.id; if (at) closeGaps([q.id]); planChanged();
}
function peWallPanel() {
  const w = PE.selWall, el = document.getElementById('peWall'); el.hidden = !w; if (!w) return;
  const info = document.getElementById('peWallInfo'), btns = document.getElementById('peWallBtns');
  const xb = document.getElementById('peExtBtns');
  const rb = document.getElementById('peRailBtns'); rb.hidden = true;
  if (w.ext && RT[w.R.type]?.rail) { // catwalk, deck or balcony edge: its railing, this stretch
    document.querySelector('#peWall h3').textContent = 'Railing'; info.textContent = `${rname(w.R)} · ${ftin(w.b - w.a)} stretch`; btns.hidden = true; xb.hidden = true; rb.hidden = false;
    const k = railFor(w.R, w.out, w.a); rb.querySelectorAll('[data-rk]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rk === k))); return; }
  document.querySelector('#peWall h3').textContent = 'Wall';
  const hint = document.getElementById('peWallHint'); if (hint) hint.textContent = w.scope === 'line' ? 'Whole wall selected: dragging moves every room along it. Click it again to pick just this room\'s part.' : w.scope === 'seg' ? 'Just this room\'s part: dragging moves only these rooms.' : '';
  if (w.ext) { info.textContent = `${rname(w.R)} · outside wall`; btns.hidden = true; xb.hidden = false;
    const m = extMode(w.R, w.out); xb.querySelectorAll('[data-xm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.xm === m))); return; }
  btns.hidden = false; xb.hidden = true; info.textContent = `Between ${rname(w.A)} and ${rname(w.B)}`;
  const m = wallMode(w.A, w.B); btns.querySelectorAll('[data-wm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wm === m)));
}
document.querySelectorAll('[data-xm]').forEach(b => b.onclick = () => { const w = PE.selWall; if (!w || !w.ext) return; pushHist(); BM.ext = BM.ext || {}; if (b.dataset.xm === 'auto') delete BM.ext[extKey(w.R, w.out)]; else BM.ext[extKey(w.R, w.out)] = b.dataset.xm; planChanged(); });
document.querySelectorAll('[data-wm]').forEach(b => b.onclick = () => { const w = PE.selWall; if (!w || w.ext) return; pushHist(); BM.walls = BM.walls || {}; BM.walls[pairKey(w.A, w.B)] = b.dataset.wm; planChanged(); });
document.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => { const w = PE.selWall; if (!w?.ext) return; pushHist(); BM.rails = BM.rails || {}; BM.rails[railKey(w.R, w.out, w.a)] = b.dataset.rk; planChanged(); });
document.getElementById('peRailAll').onclick = () => { const w = PE.selWall; if (!w?.ext) return; pushHist(); const k = railFor(w.R, w.out, w.a); BM.rails = Object.fromEntries(Object.entries(BM.rails || {}).filter(([key]) => !key.startsWith(w.R.id + ':'))); BM.rails[`${w.R.id}:*`] = k; planChanged(); toast(`${RAIL_KINDS.find(x => x[0] === k)[1]} railings on every open side`); };
document.getElementById('peGaps').onclick = () => { pushHist(); const n = closeGaps(BM.rooms.filter(r => r.level === PE.lv).map(r => r.id)); toast(n ? `Closed ${n} gap${n > 1 ? 's' : ''}` : 'No gaps found'); planChanged(); };
function peStairPanel() {
  const S = (BM.stairs || []).find(o => o.id === PE.selStair), el = document.getElementById('peStair'); el.hidden = !S; if (!S) return;
  const inp = document.getElementById('peSW'); if (document.activeElement !== inp) inp.value = toDisp(S.W);
  document.querySelectorAll('[data-sshape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sshape === (S.shape || 'auto'))));
  document.getElementById('peSShape').hidden = false; // every flight can be straight, U-turn or curved, basement ones too
  const inL = document.getElementById('peSL'); if (document.activeElement !== inL) inL.value = toDisp(S.L);
  const to = document.getElementById('peSTo'), ups = levelsAbove(S.level); to.parentElement.hidden = ups.length < 2;
  to.innerHTML = `<option value="">Automatic (${escH(LV_NAME[stairUp({ ...S, to: null })] || '—')})</option>` + ups.map(l => `<option value="${escH(l)}">${escH(LV_NAME[l])}</option>`).join(''); to.value = S.to && ups.includes(S.to) ? S.to : '';
  document.querySelectorAll('[data-srail]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.srail === stairRail(S))));
  document.querySelectorAll('[data-ssides]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ssides === (S.railSides || 'auto'))));
  document.getElementById('peSSides').hidden = turns(S) || stairRail(S) === 'none'; // turning stairs have their centre wall; the sides only matter with a railing
  const gd = document.getElementById('peSGuard'); gd.checked = S.guard !== false; gd.disabled = stairRail(S) === 'none';
  const st = stairStatus(S); document.getElementById('peSNote').textContent = st.ok ? `Climbs ${({ '+x': 'east', '-x': 'west', '+z': 'toward the back', '-z': 'toward the front' })[st.dir]} to the ${LV_NAME[st.up].toLowerCase()} (${ftin(LV_Y[st.up] - LV_Y[S.level])} rise)${S.dir ? '' : ' · direction picked automatically'}.` : st.msg;
}
const curStair = () => (BM.stairs || []).find(o => o.id === PE.selStair);
document.getElementById('peSRot').onclick = () => { const S = curStair(); if (!S) return; pushHist(); S.dir = STAIR_DIRS[(STAIR_DIRS.indexOf(stairDirOf(S)) + 1) % 4]; planChanged(); };
document.getElementById('peSAuto').onclick = () => { const S = curStair(); if (!S) return; pushHist(); delete S.dir; planChanged(); };
document.getElementById('peSDel').onclick = () => peDeleteStair();
document.querySelectorAll('[data-srail]').forEach(b => b.onclick = () => { const S = curStair(); if (!S) return; pushHist(); if (b.dataset.srail === 'glass') delete S.rail; else S.rail = b.dataset.srail; planChanged(); });
document.querySelectorAll('[data-ssides]').forEach(b => b.onclick = () => { const S = curStair(); if (!S) return; pushHist(); if (b.dataset.ssides === 'auto') delete S.railSides; else S.railSides = b.dataset.ssides; planChanged(); });
document.getElementById('peSGuard').onchange = e => { const S = curStair(); if (!S) return; pushHist(); if (e.target.checked) delete S.guard; else S.guard = false; planChanged(); };
document.getElementById('peSDup').onclick = () => peDupStair();
// Duplicate a staircase beside itself (to the side first, then in front or behind), on the same level, same settings.
function peDupStair() {
  const S = curStair(); if (!S) return; pushHist(); const r = stairRect(S, stairDirOf(S));
  const c = { ...S, id: BID++ }, free = (cx, cz) => { const t = { ...c, cx, cz }, q = stairRect(t, stairDirOf(t)); return !stairsOn(S.level).some(o => ovl(stairRect(o, stairDirOf(o)), q)); };
  const tries = [[r.w + 1, 0], [-(r.w + 1), 0], [0, r.d + 1], [0, -(r.d + 1)]].map(([dx, dz]) => [snapH(S.cx + dx), snapH(S.cz + dz)]);
  [c.cx, c.cz] = tries.find(([x, z]) => free(x, z)) || tries[0];
  BM.stairs.push(c); PE.selStair = c.id; PE.sel = null; planChanged(); toast('Stairs duplicated');
}
document.querySelectorAll('[data-sshape]').forEach(b => b.onclick = () => { const S = curStair(); if (!S) return; pushHist(); if (b.dataset.sshape === 'auto') delete S.shape; else S.shape = b.dataset.sshape; if (S.shape && S.shape !== 'straight' && S.W < 5.5) S.W = 6; planChanged(); });
document.getElementById('peSW').onchange = e => { const S = curStair(), v = fromDisp(parseFloat(e.target.value)); if (!S || !(v >= 3 && v <= 12)) return; pushHist(); S.W = snapH(v); planChanged(); };
document.getElementById('peSL').onchange = e => { const S = curStair(), v = fromDisp(parseFloat(e.target.value)); if (!S || !(v >= 4 && v <= 30)) return; pushHist(); S.L = snapH(v); planChanged(); };
document.getElementById('peSTo').onchange = e => { const S = curStair(); if (!S) return; pushHist(); if (e.target.value) S.to = e.target.value; else delete S.to; planChanged(); };
function peDeleteStair() { const i = (BM.stairs || []).findIndex(o => o.id === PE.selStair); if (i < 0) return; pushHist(); BM.stairs.splice(i, 1); PE.selStair = null; planChanged(); }
function peAddStair(at) {
  pushHist(); if (!levelAbove(PE.lv)) { PE.lv = levelBelow(PE.lv) || PE.lv; peLvlButtons(); if (curHouse === 3) goView(PE.lv); }
  const host = BM.rooms.find(r => r.id === PE.sel && r.level === PE.lv) || lvRooms()[0];
  const c = at || (host ? [host.x + host.w / 2, host.z + host.d / 2] : [0, 0]);
  const S = { id: BID++, level: PE.lv, cx: snapH(c[0]), cz: snapH(c[1]), W: 3.5, L: 12.5 };
  BM.stairs = BM.stairs || []; BM.stairs.push(S); PE.selStair = S.id; PE.sel = null; planChanged();
}
function peInspector() {
  peSideFollow(); peWallPanel(); peStairPanel(); peOpPanel(); const extra = peExtraInspector();
  const q = BM.rooms.find(r => r.id === PE.sel), box = document.getElementById('peInspect');
  box.hidden = !q; document.getElementById('peEmpty').hidden = !!(q || PE.selStair || PE.selWall || extra);
  const anySel = !!(q || PE.selStair || PE.selWall || extra); if (!anySel) PE.menu = false;
  document.getElementById('planEd').classList.toggle('has-sel', anySel); document.getElementById('planEd').classList.toggle('pe-menu', anySel && !!PE.menu); if (!q) return;
  document.getElementById('peArea').textContent = fmtArea(roomArea(q));
  const shape = q.shape || 'rect';
  document.querySelectorAll('[data-rshape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rshape === shape)));
  const more = document.getElementById('peShapeMore'); more.hidden = shape === 'rect';
  document.getElementById('peShapeTurnRow').hidden = shape !== 'tri';
  document.getElementById('pePolyWrap').hidden = document.getElementById('pePolyBtns').hidden = shape !== 'poly';
  const note = document.getElementById('peShapeNote');
  note.textContent = shape === 'tri' ? 'The triangle fills this width and depth. Turn the corner to change which way it points, or drag a corner.' : shape === 'round' ? 'Width and depth are the diameters. Drag the four handles to resize.' : shape === 'poly' ? 'One point per line, in feet: x, z. Drag a point on the plan, or drag a straight wall.' : '';
  const polyIn = document.getElementById('pePoly'); if (shape === 'poly' && document.activeElement !== polyIn) polyIn.value = (roomPoly(q) || []).map(([x, z]) => `${+x.toFixed(2)}, ${+z.toFixed(2)}`).join('\n');
  const set = (id, v) => { const el = document.getElementById(id); if (document.activeElement !== el) el.value = v; };
  set('peName', rname(q)); set('peType', q.type); set('peW', toDisp(q.w)); set('peD', toDisp(q.d));
  document.getElementById('peCeilWrap').hidden = q.level !== 'M'; set('peCeil', q.tall ? 'tall' : 'std');
  const sn = document.getElementById('peStairNote'), st = q.type === 'stairs' ? stairStatus(q) : null;
  if (!st && q.tall && q.level === 'M' && !isTall(q)) { sn.hidden = false; sn.textContent = 'Double height needs open space above it: move or shrink the 2nd-floor rooms over this room.'; }
  else if (!st && q.tall && q.level === 'M' && !fullyTall(q)) { sn.hidden = false; sn.textContent = 'Part of this room has 2nd-floor rooms above: that part keeps a normal ceiling, the rest goes double height.'; }
  else sn.hidden = !st; if (st) sn.textContent = st.msg || (st.opening ? 'Opening over the stairs coming up from the main floor.' : `Steps go ${[st.up && 'up to the 2nd floor', st.down && 'down to the basement'].filter(Boolean).join(' and ')}.`) + (st.msg ? '' : q.w < 3.5 || q.d < 3.5 ? ' Tip: make it at least 3\'-6" wide.' : '');
}
document.getElementById('peName').oninput = e => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; q.name = e.target.value; planChanged(); };
document.getElementById('peCeil').onchange = e => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); if (e.target.value === 'tall') q.tall = true; else delete q.tall; planChanged(); };
document.getElementById('peType').onchange = e => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); q.type = e.target.value; delete q.name; planChanged(); };
for (const [id, k] of [['peW', 'w'], ['peD', 'd']]) document.getElementById(id).onchange = e => { const q = BM.rooms.find(r => r.id === PE.sel); const v = fromDisp(parseFloat(e.target.value)); if (!q || !(v >= 3 && v <= 120)) return; pushHist(); if (q.shape === 'poly' && q.pts && q[k] > 0) q.pts = q.pts.map(([u, vv]) => k === 'w' ? [+(u * v / q.w).toFixed(2), vv] : [u, +(vv * v / q.d).toFixed(2)]); q[k] = snapH(v); if (!roomPoly(q)) closeGaps([q.id]); planChanged(); };
function setRoomShape(q, shape) {
  if ((q.shape || 'rect') === shape) return; pushHist();
  if (shape === 'rect') { delete q.shape; delete q.pts; delete q.spin; }
  else if (shape === 'poly') { const abs = roomPoly(q) || [[q.x, q.z], [q.x + q.w, q.z], [q.x + q.w, q.z + q.d], [q.x, q.z + q.d]]; q.shape = 'poly'; delete q.spin; q.pts = abs.map(([x, z]) => [+(x - q.x).toFixed(2), +(z - q.z).toFixed(2)]); }
  else { q.shape = shape; delete q.pts; if (shape === 'tri') q.spin = q.spin || 0; else delete q.spin; }
  planChanged();
}
document.querySelectorAll('[data-rshape]').forEach(b => b.onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (q) setRoomShape(q, b.dataset.rshape); });
document.getElementById('peShapeTurn').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q || q.shape !== 'tri') return; pushHist(); q.spin = ((q.spin || 0) + 1) % 4; planChanged(); };
function parsePolyText(text) {
  const pts = [];
  for (const line of text.split(/\n/)) { if (!line.trim()) continue; const m = line.trim().match(/^(-?\d*\.?\d+)\s*[, ]\s*(-?\d*\.?\d+)$/); if (!m) return null; pts.push([+m[1], +m[2]]); }
  return pts.length >= 3 ? pts : null;
}
document.getElementById('pePoly').onchange = e => {
  const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return;
  const cur = (roomPoly(q) || []).map(([x, z]) => `${+x.toFixed(2)}, ${+z.toFixed(2)}`).join('\n');
  if (e.target.value.trim() === cur.trim()) return;
  const pts = parsePolyText(e.target.value); if (!pts) { peInspector(); return toast('Use one point per line, like 12, 4'); }
  const x0 = Math.min(...pts.map(p => p[0])), z0 = Math.min(...pts.map(p => p[1])), x1 = Math.max(...pts.map(p => p[0])), z1 = Math.max(...pts.map(p => p[1]));
  if (x1 - x0 < 1 || z1 - z0 < 1) { peInspector(); return toast('The shape needs at least a foot each way'); }
  pushHist(); q.shape = 'poly'; delete q.spin; q.x = +x0.toFixed(2); q.z = +z0.toFixed(2); q.w = +(x1 - x0).toFixed(2); q.d = +(z1 - z0).toFixed(2); q.pts = pts.map(([x, z]) => [+(x - q.x).toFixed(2), +(z - q.z).toFixed(2)]); planChanged();
};
document.getElementById('pePolyAdd').onclick = () => {
  const q = BM.rooms.find(r => r.id === PE.sel); if (!q?.pts || q.pts.length < 3) return; pushHist();
  let bi = 0, bl = -1; for (let i = 0; i < q.pts.length; i++) { const a = q.pts[i], b = q.pts[(i + 1) % q.pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > bl) { bl = L; bi = i; } }
  const a = q.pts[bi], b = q.pts[(bi + 1) % q.pts.length]; q.pts.splice(bi + 1, 0, [+((a[0] + b[0]) / 2).toFixed(2), +((a[1] + b[1]) / 2).toFixed(2)]); planChanged();
};
document.getElementById('pePolyDel').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q?.pts || q.pts.length <= 3) return toast('A custom shape needs at least 3 points'); pushHist(); q.pts.pop(); fitShapeBox(q); planChanged(); };
document.getElementById('peDup').onclick = () => { // a copy next to it, on the first free side (right, left, behind, in front)
  const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); const c = JSON.parse(JSON.stringify({ ...q, id: BID++ })); delete c.group;
  const spots = [[q.x + q.w, q.z], [q.x - q.w, q.z], [q.x, q.z + q.d], [q.x, q.z - q.d]], clear = ([x, z]) => !BM.rooms.some(o => o.level === q.level && ovl(o, { x, z, w: q.w, d: q.d }));
  [c.x, c.z] = spots.find(clear) || [q.x + q.w + 2, q.z];
  for (const it of (BM.items || []).filter(i => i.level === q.level && i.x > q.x && i.x < q.x + q.w && i.z > q.z && i.z < q.z + q.d)) BM.items.push({ ...it, id: BID++, x: it.x + c.x - q.x, z: it.z + c.z - q.z }); // and its placed furniture
  BM.rooms.push(c); PE.sel = c.id; planChanged(); toast(`${rname(q)} duplicated`); };
document.getElementById('peDel').onclick = () => peDelete();
document.getElementById('peRot').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); q.rot = ((q.rot || 0) + 1) % 4; planChanged(); };
document.getElementById('peShuf').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); q.var = (q.var || 0) + 1; planChanged(); };
function peDelete() { const i = BM.rooms.findIndex(r => r.id === PE.sel); if (i < 0) return; pushHist(); BM.rooms.splice(i, 1); PE.sel = null; planChanged(); }
function peUndo() { const s = PE.hist.pop(); if (!s) return; PE.redo.push(snapshot()); BM = JSON.parse(s); planChanged(); }
function peRedo() { const s = PE.redo.pop(); if (!s) return; PE.hist.push(snapshot()); BM = JSON.parse(s); planChanged(); }
document.getElementById('peRedo').onclick = peRedo;
document.getElementById('peUndo').onclick = peUndo;
document.getElementById('peReset').onclick = () => { closePops(); pushHist(); BM = starterPlan(); PE.sel = null; peFit(); planChanged(); };
document.getElementById('peClear').onclick = () => { closePops(); pushHist(); BM = { roof: BM.roof, rooms: [], levels: BM.levels }; PE.sel = null; planChanged(); };
document.getElementById('segPeLvl').addEventListener('click', e => { const b = e.target.closest('[data-pelv]'); if (b) peSetLevel(b.dataset.pelv); });
function peSetLevel(lv) { PE.lv = lv; PE.sel = null; PE.selWall = null; peLvlButtons(); peInspector(); peDraw(); if (curHouse === 3) goView(PE.lv); }
const TRACE = { living: 'rec', great: 'rec', kitchen: 'rec', dining: 'rec', foyer: 'rec', hall: 'rec', sunroom: 'rec', bonus: 'rec', rec: 'rec', playroom: 'rec',
  bedroom: 'bedroom', primary: 'bedroom', guest: 'bedroom', nursery: 'bedroom', bath: 'bath', ensuite: 'bath', powder: 'bath', office: 'office', library: 'office', theatre: 'theatre', gym: 'gym' };
function peTrace() {
  pushHist(); let n = 0;
  for (const m of BM.rooms.filter(r => r.level === 'M' && r.type !== 'garage' && !RT[r.type]?.outdoor)) {
    const q = R(TRACE[m.type] || 'storage', 'B', m.x, m.x + m.w, m.z, m.z + m.d);
    if (q.type === 'rec') q.group = 'bsm-open';
    if (BM.rooms.some(o => o.level === 'B' && ovl(o, q))) continue;
    BM.rooms.push(q); n++;
  }
  BM.stairs = BM.stairs || [];
  for (const S of stairsOn('M')) if (!stairsOn('B').some(o => Math.hypot(o.cx - S.cx, o.cz - S.cz) < 3)) BM.stairs.push({ id: BID++, level: 'B', cx: S.cx, cz: S.cz, W: S.W, L: S.L });
  PE.sel = null; planChanged();
  toast(n ? `Added ${n} basement rooms` : 'The basement already covers the main floor');
}
document.getElementById('peTrace').onclick = peTrace;
function guideMode() { return PE.guide[PE.lv] || (levelBelow(PE.lv) ? 'below' : 'above'); }
document.querySelectorAll('[data-guide]').forEach(b => b.onclick = () => { PE.guide[PE.lv] = b.dataset.guide; peLvlButtons(); peDraw(); });
function peLvlButtons() {
  if (!lvOf(PE.lv)) PE.lv = 'M'; renderLevelSegs();
  const can = { below: !!levelBelow(PE.lv), above: !!levelAbove(PE.lv), none: true }, gm = guideMode();
  document.querySelectorAll('[data-guide]').forEach(b => { b.disabled = !can[b.dataset.guide]; b.setAttribute('aria-pressed', String(b.dataset.guide === gm)); });
  document.getElementById('peTrace').hidden = PE.lv !== 'B'; document.querySelectorAll('[data-pelv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pelv === PE.lv))); document.querySelectorAll('[data-roof]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roof === (BM.roof || 'hip')))); }
document.querySelectorAll('[data-roof]').forEach(b => b.onclick = () => { pushHist(); BM.roof = b.dataset.roof; peLvlButtons(); planChanged(); });
addEventListener('keydown', e => {
  if (!PE.open || e.target.closest?.('input,select,textarea')) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && PE.selStair) { e.preventDefault(); peDeleteStair(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && PE.sel) { e.preventDefault(); peDelete(); }
  const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? peRedo() : peUndo(); return; }
  if (mod && k === 'y') { e.preventDefault(); peRedo(); return; }
  if (mod && k === 'd') { e.preventDefault(); if (PE.selStair) peDupStair(); else if (curItem()) document.getElementById('ixDup')?.click(); else document.getElementById('peDup').click(); return; }
  if (mod || e.altKey || mode === 'walk') return;
  if (e.key.startsWith('Arrow') && (PE.sel || PE.selStair)) { e.preventDefault(); peNudge(e.key, e.shiftKey ? 2 : .5); return; }
  if (k === 'r' && PE.sel) document.getElementById('peRot').click();
  else if (k === 'g') { PE.grid = !PE.grid; uiSync(); peDraw(); }
  else if (k === 'd') { PE.dims = !PE.dims; uiSync(); peDraw(); }
  else if (k === '0') { peFit(); peDraw(); }
  else if (k === '=' || k === '+') peZoom(1.2);
  else if (k === '-' || k === '_') peZoom(1 / 1.2);
});
let nudgeT = 0;
function peNudge(key, step) { // arrows move the selected room or stairs; one undo step per burst of presses
  if (Date.now() - nudgeT > 700) pushHist(); nudgeT = Date.now();
  const dx = key === 'ArrowLeft' ? step : key === 'ArrowRight' ? -step : 0, dz = key === 'ArrowUp' ? step : key === 'ArrowDown' ? -step : 0; // up the screen is toward the back
  const q = BM.rooms.find(r => r.id === PE.sel), S = (BM.stairs || []).find(o => o.id === PE.selStair);
  if (q) { q.x = +(q.x + dx).toFixed(2); q.z = +(q.z + dz).toFixed(2); } else if (S) { S.cx = +(S.cx + dx).toFixed(2); S.cz = +(S.cz + dz).toFixed(2); }
  planChanged();
}
const edEl = document.getElementById('planEd'), rz = document.getElementById('peResize');
let edW = 0; try { edW = +localStorage.getItem('walkthru-edw') || 0; } catch (e) { }
function applyEdW() { if (innerWidth <= 760) { edEl.style.width = ''; return; } if (edW) edEl.style.width = Math.max(420, Math.min(innerWidth - 260, edW)) + 'px'; }
rz.addEventListener('pointerdown', e => { rz.dataset.drag = '1'; try { rz.setPointerCapture(e.pointerId); } catch (er) { } e.preventDefault(); });
rz.addEventListener('pointermove', e => { if (!rz.dataset.drag) return; edW = e.clientX - edEl.getBoundingClientRect().left; applyEdW(); updateViewOffset(); });
rz.addEventListener('pointerup', () => { if (!rz.dataset.drag) return; delete rz.dataset.drag; try { localStorage.setItem('walkthru-edw', edW); } catch (e) { } updateViews3(); goView(PE.lv, true); });
rz.addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; edW = edEl.getBoundingClientRect().width + (e.key === 'ArrowRight' ? 40 : -40); applyEdW(); updateViewOffset(); updateViews3(); goView(PE.lv, true); try { localStorage.setItem('walkthru-edw', edW); } catch (er) { } });
function openEditor(on) {
  applyEdW();
  PE.open = on; document.getElementById('planEd').hidden = !on; document.body.classList.toggle('editing', on);
  updateViewOffset(); updateViews3();
  if (on) { if (curHouse !== 3) setHouse(3); goView(PE.lv); peLvlButtons(); requestAnimationFrame(() => { peFit(); peSize(); peInspector(); }); }
  document.getElementById('editBtn').setAttribute('aria-pressed', String(on));
  uiEditing(on);
}
document.getElementById('editBtn').onclick = () => openEditor(!PE.open);
document.getElementById('peDone').onclick = () => { openEditor(false); goView('front'); };
addEventListener('resize', () => { if (PE.open) peSize(); });
window.__pe = { PE, get BM() { return BM; } };
window.__pe.planLevel = planLevel;

// ---------- The selection's options float beside what's selected (like a right-click menu), never on top of it if there's room ----------
let pePt = null, peSelKey = '';
function peSelBox() { // the selection's extent in plan feet: [x0, z0, x1, z1]
  const U = a => a.length ? [Math.min(...a.map(b => b[0])), Math.min(...a.map(b => b[1])), Math.max(...a.map(b => b[2])), Math.max(...a.map(b => b[3]))] : null;
  if (PE.multi?.size) return U(BM.rooms.filter(r => PE.multi.has(r.id)).map(r => [r.x, r.z, r.x + r.w, r.z + r.d]));
  const q = BM.rooms.find(r => r.id === PE.sel); if (q) return [q.x, q.z, q.x + q.w, q.z + q.d];
  const S = (BM.stairs || []).find(o => o.id === PE.selStair); if (S) { const r = stairRect(S, stairDirOf(S)); return [r.x, r.z, r.x + r.w, r.z + r.d]; }
  const w = PE.selWall; if (w) return w.axis === 'x' ? [w.a, w.c - .5, w.b, w.c + .5] : [w.c - .5, w.a, w.c + .5, w.b];
  const X = PE.selX; if (!X) return null;
  if (X.kind === 'item') { const it = (BM.items || []).find(i => i.id === X.id); if (it) { const [a, b] = itemDims(it); return [it.x - a / 2, it.z - b / 2, it.x + a / 2, it.z + b / 2]; } }
  if (X.kind === 'note') { const n = (BM.notes || []).find(i => i.id === X.id); if (n) return [n.x - 1, n.z - 1, n.x + 1, n.z + 1]; }
  if (X.kind === 'dim') { const d = (BM.dims || []).find(i => i.id === X.id); if (d) return [Math.min(d.x1, d.x2), Math.min(d.z1, d.z2), Math.max(d.x1, d.x2), Math.max(d.z1, d.z2)]; }
  return null;
}
function pePlaceSide() {
  const el = document.getElementById('peSide'), body = el.parentElement;
  if (innerWidth <= 760) { el.style.left = el.style.top = ''; return; }
  const B = body.getBoundingClientRect(), C = pc.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, g = 16, m = 8, sb = peSelBox();
  let L, T, R, Bt; // the selection on screen, relative to the editor body
  if (sb) { const [a, b] = W2S(sb[0], sb[1]), [c, d] = W2S(sb[2], sb[3]); L = C.right - c - B.left; T = C.bottom - d - B.top; R = C.right - a - B.left; Bt = C.bottom - b - B.top; } // plan space → screen: turned half way round
  else if (pePt) { L = R = pePt[0] - B.left; T = Bt = pePt[1] - B.top; } else return;
  const minX = C.left - B.left + m, maxX = B.width - m, clampY = y => Math.max(m, Math.min(y, B.height - h - m)), clampX = x => Math.max(minX, Math.min(x, maxX - w));
  const opts = [ // [x, y, free space on that side]
    [R + g, clampY(T), maxX - (R + g) - w],
    [L - g - w, clampY(T), (L - g - w) - minX],
    [clampX(L), Bt + g, B.height - m - (Bt + g) - h],
    [clampX(L), T - g - h, (T - g - h) - m],
  ];
  const fit = opts.find(o => o[2] >= 0) || opts.reduce((p, o) => o[2] > p[2] ? o : p);
  el.style.left = clampX(fit[0]) + 'px'; el.style.top = clampY(fit[1]) + 'px';
}
function peSideFollow() { // called after every inspector refresh: move when the selection changes or moves, not while you're typing in it
  const el = document.getElementById('peSide'); if (!el) return;
  const k = [PE.sel, PE.selStair, PE.selWall && JSON.stringify(PE.selWall), PE.selX && PE.selX.kind + PE.selX.id, PE.multi?.size].join('|');
  if (k !== peSelKey || !el.contains(document.activeElement)) { peSelKey = k; requestAnimationFrame(pePlaceSide); }
}
// the menu steps aside only while you actually drag something; a plain click leaves it where it is
let peDown = null;
pc.addEventListener('pointerdown', e => { pePt = [e.clientX, e.clientY]; peDown = pePt; });
addEventListener('pointermove', e => { if (peDown && Math.hypot(e.clientX - peDown[0], e.clientY - peDown[1]) > 4) pc.parentElement.parentElement.classList.add('pe-busy'); });
addEventListener('pointerup', () => { peDown = null; const b = pc.parentElement.parentElement; if (!b.classList.contains('pe-busy')) return; b.classList.remove('pe-busy'); requestAnimationFrame(pePlaceSide); });
pc.addEventListener('contextmenu', e => e.preventDefault()); // right-click opens the selection menu (peMenuAt), not the browser's
addEventListener('wheel', () => { if (document.getElementById('planEd').classList.contains('has-sel')) requestAnimationFrame(pePlaceSide); }, { passive: true });

// ---------- Floors: level buttons and the Floors popover ----------
let lvSegKey = '';
function renderLevelSegs() { // the floor buttons in the toolbar (view a floor / edit a floor) follow the design's floors
  const L = typeof curHouse === 'undefined' || curHouse === 3 ? levelList() : DEFAULT_LEVELS, key = JSON.stringify(L.map(l => [l.id, l.name]));
  if (key !== lvSegKey) {
    lvSegKey = key;
    const SH = { B: ['Basement', 'B'], M: ['Main', 'M'], U: ['Upper', 'U'] };
    const lab = l => { if (SH[l.id] && l.name === LV_DEFNAME[l.id]) return SH[l.id];
      const n = l.name.replace(/\s*\(.*\)$/, ''); return [n.length > 14 ? n.slice(0, 13) + '…' : n, n.match(/^\d+/)?.[0] || n.replace(/[^A-Za-z]/g, '').slice(0, 2) || l.id]; };
    const html = attr => L.map(l => { const [lg, sh] = lab(l); return `<button type="button" ${attr}="${escH(l.id)}" data-tip="${attr === 'data-view' ? 'See' : 'Edit'} ${escH(l.name.toLowerCase())}"><span class="l">${escH(lg)}</span><span class="s">${escH(sh)}</span></button>`; }).join('');
    document.getElementById('segLvl').innerHTML = html('data-view'); document.getElementById('segPeLvl').innerHTML = html('data-pelv');
  }
  if (typeof curHouse !== 'undefined') { const b = document.querySelector('#segLvl [data-view="B"]'); if (b) b.hidden = curHouse === 2;
    document.querySelectorAll('#segLvl [data-view]').forEach(b => b.setAttribute('aria-pressed', String(mode === 'orbit' && b.dataset.view === curView))); }
  document.querySelectorAll('#segPeLvl [data-pelv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pelv === PE.lv)));
}
document.getElementById('segLvl').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b && !b.onclick) goView(b.dataset.view); });
function renderFloorsPop() {
  const el = document.getElementById('peFloorList'); if (!el) return;
  const L = [...levelList()].reverse(), my = LV_Y.M;
  el.innerHTML = `<div class="fl-row fl-head"><span>Floor</span><span title="Floor to ceiling">Ceiling</span><span title="Floor level, measured from the main floor">Level</span><span></span></div>` + L.map(l => {
    const n = BM.rooms.filter(r => r.level === l.id).length, fixed = !l.extra;
    return `<div class="fl-row${l.id === PE.lv ? ' on' : ''}" data-flid="${escH(l.id)}"><input data-fl="name" value="${escH(l.name)}" aria-label="Floor name" title="${n} room${n === 1 ? '' : 's'} · click to edit this floor">` +
      `<input data-fl="h" type="number" step="any" min="6" max="30" value="${toDisp(l.h)}" aria-label="Ceiling height">` +
      `<input data-fl="y" type="number" step="any" value="${toDisp(l.y - my)}" aria-label="Floor level from the main floor"${fixed ? ' disabled title="Set by the floor heights (Plan settings → Levels)"' : ''}>` +
      `<button type="button" data-fl="del" aria-label="Remove ${escH(l.name)}" title="${fixed ? 'Built-in floors stay (leave them empty to skip them)' : 'Remove this floor'}"${fixed ? ' disabled' : ''}><svg class="ic"><use href="#i-x"/></svg></button></div>`; }).join('');
}
function floorsChanged() { if (!lvOf(PE.lv)) PE.lv = 'M'; planChanged(); peLvlButtons(); renderFloorsPop(); updateViews3(); }
const flList = document.getElementById('peFloorList');
flList.addEventListener('focusin', e => { const row = e.target.closest('[data-flid]'); if (row && row.dataset.flid !== PE.lv) { peSetLevel(row.dataset.flid); flList.querySelectorAll('.fl-row').forEach(r => r.classList.toggle('on', r === row)); } });
flList.addEventListener('change', e => {
  const row = e.target.closest('[data-flid]'), id = row?.dataset.flid, k = e.target.dataset.fl; if (!id) return;
  if (k === 'name') { const v = e.target.value.trim().slice(0, 40); if (!v) return renderFloorsPop(); pushHist();
    editLevels(L => { const x = L.extra.find(q => q.id === id); if (x) x.name = v; else if (v === LV_DEFNAME[id]) delete L.names[id]; else L.names[id] = v; if (!Object.keys(L.names).length) delete L.names; }); return floorsChanged(); }
  const v = fromDisp(parseFloat(e.target.value)); if (!isFinite(v)) return renderFloorsPop();
  if (k === 'h') { if (v < 6 || v > 30) { toast('Ceiling heights go from 6 to 30 ft'); return renderFloorsPop(); } pushHist(); setLevelHeight(id, +v.toFixed(2)); return floorsChanged(); }
  if (k === 'y') { if (Math.abs(v) > 120) return renderFloorsPop(); pushHist(); editLevels(L => { const x = L.extra.find(q => q.id === id); if (x) x.rel = +v.toFixed(2); }); return floorsChanged(); }
});
flList.addEventListener('click', e => {
  const b = e.target.closest('[data-fl="del"]'), id = b?.closest('[data-flid]')?.dataset.flid; if (!id || !lvOf(id)?.extra) return;
  const n = BM.rooms.filter(r => r.level === id).length + (BM.stairs || []).filter(s => s.level === id).length;
  if (n && !confirm(`Remove ${LV_NAME[id]} and the ${n} room${n === 1 ? '' : 's'} and stairs on it?`)) return;
  pushHist(); for (const k of ['rooms', 'stairs', 'items', 'notes', 'dims']) if (Array.isArray(BM[k])) BM[k] = BM[k].filter(o => o.level !== id);
  for (const S of BM.stairs || []) if (S.to === id) delete S.to;
  editLevels(L => { L.extra = L.extra.filter(q => q.id !== id); if (!L.extra.length) delete L.extra; }); if (PE.lv === id) PE.lv = 'M'; floorsChanged();
});
for (const [btn, where] of [['peFlTop', 'top'], ['peFlHalf', 'half'], ['peFlBot', 'bottom']]) document.getElementById(btn).onclick = () => {
  pushHist(); const id = addLevel(where, PE.lv); PE.lv = id; PE.sel = null; floorsChanged(); if (curHouse === 3) goView(id); toast(`Added ${LV_NAME[id]}`); };
