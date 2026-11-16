
// =====================================================================
//  FLOOR PLAN EDITOR (2D) — drag walls, move rooms, add / resize / delete, auto-layout.
//  Every change rebuilds the 3D "My Design" house shortly after.
// =====================================================================
const PE = { guide: {}, lv: 'M', sel: null, selWall: null, selStair: null, s: 10, ox: 40, oy: 40, drag: null, hover: null, hist: [], redo: [], open: false, grid: true, dims: true, areas: false };
const pc = document.getElementById('peCanvas'), px = pc.getContext('2d');
const snapH = v => Math.round(v * 2) / 2; // 6" grid
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const lvRooms = () => BM.rooms.filter(r => r.level === PE.lv);
const W2S = (x, z) => [x * PE.s + PE.ox, z * PE.s + PE.oy];
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
  px.setTransform(d, 0, 0, d, 0, 0); peDraw();
}
// The plan area changes height when the bottom strip grows or shrinks (e.g. a room gets selected): keep the canvas in step.
if (window.ResizeObserver) new ResizeObserver(() => { if (PE.open) peSize(); }).observe(pc.parentElement);
function overlaps(a) { return lvRooms().some(b => b !== a && a.x < b.x + b.w - .05 && a.x + a.w > b.x + .05 && a.z < b.z + b.d - .05 && a.z + a.d > b.z + .05); }
function peDraw() {
  const r = pc.getBoundingClientRect(), W = r.width, H = r.height, s = PE.s;
  px.fillStyle = css('--paper'); px.fillRect(0, 0, W, H);
  // grid: 1 ft and 5 ft
  const [gx0, gz0] = S2W(0, 0), [gx1, gz1] = S2W(W, H);
  for (const [step, a] of PE.grid ? [[1, .07], [5, .16]] : []) { if (step * s < 5) continue; px.strokeStyle = `rgba(31,63,209,${a})`; px.lineWidth = 1; px.beginPath();
    for (let x = Math.floor(gx0 / step) * step; x <= gx1; x += step) { const X = Math.round(x * s + PE.ox) + .5; px.moveTo(X, 0); px.lineTo(X, H); }
    for (let z = Math.floor(gz0 / step) * step; z <= gz1; z += step) { const Y = Math.round(z * s + PE.oy) + .5; px.moveTo(0, Y); px.lineTo(W, Y); } px.stroke(); }
  // the floor below, dashed, to line things up
  const gm = guideMode(), guideLv = gm === 'none' ? null : ({ B: { above: 'M' }, M: { below: 'B', above: 'U' }, U: { below: 'M' } })[PE.lv][gm];
  const guide = guideLv ? BM.rooms.filter(q => q.level === guideLv) : [];
  if (guide.length) { px.setLineDash([5, 4]); px.strokeStyle = css('--ink-2'); px.lineWidth = 1; px.textAlign = 'center'; px.textBaseline = 'middle';
    for (const q of guide) { const [a, b] = W2S(q.x, q.z); px.strokeRect(a, b, q.w * s, q.d * s);
      if (q.w * s > 50 && q.d * s > 22 && !lvRooms().some(o => ovl(o, q))) { px.fillStyle = css('--ink-2'); px.globalAlpha = .55; px.font = '11px Inter, system-ui, sans-serif'; px.fillText(rname(q), a + q.w * s / 2, b + q.d * s / 2); px.globalAlpha = 1; } }
    px.setLineDash([]); }
  // double-height rooms show as open to below on the 2nd floor
  if (PE.lv === 'U') for (const q of BM.rooms.filter(isTall)) { const [a, b] = W2S(q.x, q.z); px.save(); px.beginPath(); for (const [a0, a1, b0, b1] of tallParts(q)) { const [c, d] = W2S(a0, b0); px.rect(c, d, (a1 - a0) * s, (b1 - b0) * s); } px.clip();
    px.strokeStyle = 'rgba(31,63,209,.35)'; px.lineWidth = 1; px.beginPath(); for (let k = -q.d * s; k < q.w * s; k += 10) { px.moveTo(a + k, b + q.d * s); px.lineTo(a + k + q.d * s, b); } px.stroke(); px.restore();
    px.fillStyle = css('--ink-2'); px.font = '600 11px Inter, system-ui, sans-serif'; px.textAlign = 'center'; px.fillText(`Open to below · ${rname(q)}`, a + q.w * s / 2, b + q.d * s / 2); }
  // rooms
  px.textAlign = 'center'; px.textBaseline = 'middle';
  for (const q of lvRooms()) {
    const [a, b] = W2S(q.x, q.z); px.fillStyle = (RT[q.type]?.color || '#ddd') + 'd9'; px.fillRect(a, b, q.w * s, q.d * s);
    if (RT[q.type]?.outdoor) { px.setLineDash([3, 3]); px.strokeStyle = '#4c7fd6'; px.lineWidth = 1.5; px.strokeRect(a + 1, b + 1, q.w * s - 2, q.d * s - 2); px.setLineDash([]);
      const lv = RT[q.type].levels; if (lv && lv !== q.level) { px.fillStyle = '#ff6b6b'; px.font = '600 11px Inter, system-ui, sans-serif'; px.fillText(lv === 'U' ? 'Balconies go on the 2nd floor' : 'Put this on the main floor', a + q.w * s / 2, b + q.d * s + 13); } }
    if (q.type === 'stairs') { // draw the treads and which way they go
      const st = stairStatus(q), sd = stairDir(q), alongX = sd[1] === 'x', n = 12;
      px.strokeStyle = 'rgba(24,32,43,.35)'; px.lineWidth = 1; px.beginPath();
      for (let i = 1; i < n; i++) { if (alongX) { const x = a + q.w * s * i / n; px.moveTo(x, b + 2); px.lineTo(x, b + q.d * s - 2); } else { const y = b + q.d * s * i / n; px.moveTo(a + 2, y); px.lineTo(a + q.w * s - 2, y); } }
      px.stroke();
      const lab = st.msg ? '' : st.opening ? 'OPEN TO BELOW' : [st.up && 'UP', st.down && 'DOWN'].filter(Boolean).join(' / ');
      if (lab) { px.fillStyle = '#18181b'; px.font = '600 10px "JetBrains Mono", monospace'; px.fillText(({ '+x': '→ ', '-x': '← ', '+z': '↓ ', '-z': '↑ ' })[sd] + lab, a + q.w * s / 2, b + q.d * s - 9); }
      if (st.msg) { px.strokeStyle = '#d33'; px.lineWidth = 2; px.strokeRect(a + 1, b + 1, q.w * s - 2, q.d * s - 2);
        px.fillStyle = '#ff6b6b'; px.font = '600 11px Inter, system-ui, sans-serif'; px.fillText(st.msg, a + q.w * s / 2, b + q.d * s + 13); }
    }
    if (overlaps(q)) { px.strokeStyle = '#d33'; px.lineWidth = 2; px.setLineDash([4, 3]); px.strokeRect(a + 2, b + 2, q.w * s - 4, q.d * s - 4); px.setLineDash([]); }
    if (q.w * s > 44 && q.d * s > 26) { px.fillStyle = '#18181b'; px.font = `500 ${Math.max(10, Math.min(14, s * 1.1))}px Inter, system-ui, sans-serif`; px.fillText(rname(q), a + q.w * s / 2, b + q.d * s / 2 - 7);
      px.font = `${Math.max(9, Math.min(12, s))}px "JetBrains Mono", monospace`; px.fillStyle = '#5b5b66'; const sub = [PE.dims && `${ftin(q.w)} × ${ftin(q.d)}`, PE.areas && fmtArea(q.w * q.d)].filter(Boolean).join(' · '); if (sub) px.fillText(sub, a + q.w * s / 2, b + q.d * s / 2 + 8);
      if (q.tall && q.level === 'M') { px.font = '600 10px "JetBrains Mono", monospace'; px.fillStyle = isTall(q) ? '#1f3fd1' : '#c0392b'; px.fillText(fullyTall(q) ? '↑ double height' : isTall(q) ? '↑ double height (part)' : '↑ blocked above', a + q.w * s / 2, b + q.d * s / 2 + 21); } }
  }
  // walls + openings from the same generator the 3D uses
  for (const w of planLevel(PE.lv)) {
    if (w.rail) { px.strokeStyle = '#4c7fd6'; px.lineWidth = 2; px.beginPath(); if (w.axis === 'x') { px.moveTo(...W2S(w.a, w.c)); px.lineTo(...W2S(w.b, w.c)); } else { px.moveTo(...W2S(w.c, w.a)); px.lineTo(...W2S(w.c, w.b)); } px.stroke(); continue; }
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
  const ARW = { '+x': '→', '-x': '←', '+z': '↓', '-z': '↑' };
  for (const S of (BM.stairs || [])) {
    const here = S.level === PE.lv, above = stairUp(S) === PE.lv; if (!here && !above) continue;
    const dir = stairDirOf(S), r = stairRect(S, dir), [a, b] = W2S(r.x, r.z), st = stairStatus(S), ax = dir[1] === 'x', n = 14;
    if (above) { px.setLineDash([5, 4]); px.strokeStyle = css('--accent'); px.lineWidth = 1.5; px.strokeRect(a, b, r.w * s, r.d * s); px.setLineDash([]);
      px.fillStyle = css('--ink-2'); px.font = '600 10px "JetBrains Mono", monospace'; px.textAlign = 'center'; px.fillText('STAIRS FROM BELOW', a + r.w * s / 2, b + r.d * s / 2); continue; }
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
    px.fillStyle = '#18181b'; px.font = '700 13px "JetBrains Mono", monospace'; px.textAlign = 'center'; px.fillText(turns(S) ? `${ARW[dir]} UP ↺` : `${ARW[dir]} UP`, a + r.w * s / 2, b + r.d * s / 2);
    if (!st.ok) { px.fillStyle = '#ff6b6b'; px.font = '600 11px Inter, system-ui, sans-serif'; px.fillText(st.msg, a + r.w * s / 2, b + r.d * s + 13); }
    if (S.id === PE.selStair) { px.strokeStyle = css('--accent'); px.lineWidth = 3; px.strokeRect(a - 2, b - 2, r.w * s + 4, r.d * s + 4); }
  }
  // hovered / dragged wall and selected room
  for (const q of lvRooms()) for (const o of lvRooms()) { if (q.id >= o.id) continue; // open connections, dashed so they can be clicked
    for (const e of edgesOf(q)) { const f = edgesOf(o).find(x => x.side === OPP[e.side]); if (Math.abs(f.c - e.c) > EPS) continue; const a = Math.max(e.a, f.a), b = Math.min(e.b, f.b); if (b - a < .3 || wallMode(q, o) !== 'open') continue;
      px.setLineDash([6, 5]); px.strokeStyle = css('--ink-2'); px.lineWidth = 1.2; px.beginPath(); if (e.axis === 'x') { px.moveTo(...W2S(a, e.c)); px.lineTo(...W2S(b, e.c)); } else { px.moveTo(...W2S(e.c, a)); px.lineTo(...W2S(e.c, b)); } px.stroke(); px.setLineDash([]); } }
  if (PE.selWall) { const w = PE.selWall; px.strokeStyle = css('--accent'); px.lineWidth = 6; px.beginPath(); if (w.axis === 'x') { px.moveTo(...W2S(w.a, w.c)); px.lineTo(...W2S(w.b, w.c)); } else { px.moveTo(...W2S(w.c, w.a)); px.lineTo(...W2S(w.c, w.b)); } px.stroke(); }
  const hv = PE.drag?.kind === 'wall' ? PE.drag : PE.hover;
  if (hv?.kind === 'wall') { px.strokeStyle = css('--accent'); px.lineWidth = 4; px.beginPath();
    if (hv.axis === 'x') { px.moveTo(...W2S(hv.a, hv.c + (hv.delta || 0))); px.lineTo(...W2S(hv.b, hv.c + (hv.delta || 0))); } else { px.moveTo(...W2S(hv.c + (hv.delta || 0), hv.a)); px.lineTo(...W2S(hv.c + (hv.delta || 0), hv.b)); } px.stroke(); }
  const sel = BM.rooms.find(q => q.id === PE.sel);
  if (sel && sel.level === PE.lv) { const [a, b] = W2S(sel.x, sel.z); px.strokeStyle = css('--accent'); px.lineWidth = 2.5; px.strokeRect(a, b, sel.w * s, sel.d * s); }
  // empty floor: say what to do instead of showing a blank grid
  if (!lvRooms().length && !guide.length) { px.textAlign = 'center'; px.fillStyle = css('--ink'); px.font = '600 15px Inter, system-ui, sans-serif';
    px.fillText(`No ${LV_NAME[PE.lv].toLowerCase()} rooms yet`, W / 2, H / 2); }
  // scale bar
  px.fillStyle = css('--ink-2'); px.font = '11px "JetBrains Mono", monospace'; px.textAlign = 'left'; const [bft, blab] = SCALE_BAR(), bar = bft * s; px.fillRect(14, H - 58, bar, 3); px.fillText(blab, 18 + bar, H - 56);
  peDrawExtras(s);
  peStatus();
}
const LV_LONG = { B: 'Basement', M: 'Main floor', U: '2nd floor' };
function peStatus() {
  const rs = lvRooms(), sf = Math.round(rs.filter(q => !RT[q.type]?.outdoor && q.type !== 'garage' && q.type !== 'open').reduce((a, q) => a + q.w * q.d, 0));
  const el = document.getElementById('peStatus'); if (el) el.textContent = `${LV_LONG[PE.lv]} · ${rs.length} room${rs.length === 1 ? '' : 's'} · ${fmtArea(sf)}`;
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
function roomAt(wx, wz) { const rs = lvRooms(); for (let i = rs.length - 1; i >= 0; i--) { const q = rs[i]; if (wx > q.x && wx < q.x + q.w && wz > q.z && wz < q.z + q.d) return q; } return null; }
const snapshot = () => JSON.stringify(BM);
function pushHist() { PE.redo = []; PE.hist.push(snapshot()); if (PE.hist.length > 80) PE.hist.shift(); }
let peTimer = 0;
function planChanged(redraw = true) { delete BM.extras; saveBM(); if (redraw) peDraw(); peInspector(); clearTimeout(peTimer); peTimer = setTimeout(() => { rebuildHouse3(); renderChecks(); }, 260); }

pc.addEventListener('pointerdown', e => {
  const r = pc.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, [wx, wz] = S2W(sx, sy);
  try { pc.setPointerCapture(e.pointerId); } catch (er) { }
  if (peToolDown(e, sx, sy, wx, wz)) { peDraw(); return; }
  const w = e.button === 0 ? wallAt(wx, wz, 7 / PE.s) : null;
  PE.selWall = null;
  const se = e.button === 0 ? stairEdgeAt(wx, wz, 6 / PE.s) : null;
  if (se) { const dir = stairDirOf(se.S); PE.selStair = se.S.id; PE.sel = null; PE.drag = { kind: 'stairEdge', S: se.S, side: se.side, r0: { ...se.r }, dir, before: snapshot() }; peInspector(); peDraw(); return; }
  const S = e.button === 0 ? (BM.stairs || []).find(o => { if (o.level !== PE.lv) return false; const r = stairRect(o, stairDirOf(o)); return wx > r.x && wx < r.x + r.w && wz > r.z && wz < r.z + r.d; }) : null;
  if (S) { PE.selStair = S.id; PE.sel = null; PE.drag = { kind: 'stair', S, dx: wx - S.cx, dz: wz - S.cz, before: snapshot() }; peInspector(); peDraw(); return; }
  PE.selStair = null;
  if (w) { PE.drag = { ...w, pickAlong: w.axis === 'x' ? wx : wz, start: w.axis === 'x' ? wz : wx, base: w.members.map(m => ({ q: m.q, side: m.e.side, x: m.q.x, z: m.q.z, w: m.q.w, d: m.q.d })), before: snapshot(), delta: 0 }; return; }
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
  const r = pc.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, [wx, wz] = S2W(sx, sy), D = PE.drag;
  if (peToolMove(e, wx, wz)) return;
  if (!D) { const se = stairEdgeAt(wx, wz, 6 / PE.s); if (se) { PE.hover = null; pc.style.cursor = se.side === 'n' || se.side === 's' ? 'ns-resize' : 'ew-resize'; peDraw(); return; }
    PE.hover = wallAt(wx, wz, 7 / PE.s); pc.style.cursor = PE.hover ? (PE.hover.axis === 'x' ? 'ns-resize' : 'ew-resize') : roomAt(wx, wz) ? 'move' : 'grab'; peDraw(); return; }
  if (D.kind === 'pan') { PE.ox = D.ox + e.clientX - D.sx; PE.oy = D.oy + e.clientY - D.sy; peDraw(); return; }
  if (D.kind === 'wall') {
    let delta = snapH((D.axis === 'x' ? wz : wx) - D.start);
    for (const b of D.base) { const size = D.axis === 'x' ? b.d : b.w; if (b.side === 'w' || b.side === 'n') delta = Math.min(delta, size - 3); else delta = Math.max(delta, 3 - size); }
    D.delta = delta;
    for (const b of D.base) { if (b.side === 'w') { b.q.x = b.x + delta; b.q.w = b.w - delta; } else if (b.side === 'e') b.q.w = b.w + delta; else if (b.side === 'n') { b.q.z = b.z + delta; b.q.d = b.d - delta; } else b.q.d = b.d + delta; }
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
    PE.hist.push(D.before); PE.redo = []; planChanged(); return;
  }
  if (D?.kind === 'wall') { pickWall(D); PE.sel = null; peInspector(); }
  peDraw();
});
// Find the two rooms either side of the clicked spot on a wall line.
function pickWall(D) {
  const at = D.pickAlong, side = (m, s) => m.e.side === s && at >= m.e.a - .05 && at <= m.e.b + .05;
  const lo = D.members.find(m => side(m, D.axis === 'x' ? 's' : 'e')), hi = D.members.find(m => side(m, D.axis === 'x' ? 'n' : 'w'));
  PE.selWall = lo && hi ? { A: lo.q, B: hi.q, axis: D.axis, c: D.c, a: Math.max(lo.e.a, hi.e.a), b: Math.min(lo.e.b, hi.e.b) } : { ext: true, R: (lo || hi).q, out: (lo || hi).e.out, axis: D.axis, c: D.c, a: (lo || hi).e.a, b: (lo || hi).e.b };
}
pc.addEventListener('wheel', e => { e.preventDefault(); const r = pc.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, [wx, wz] = S2W(sx, sy);
  PE.s = Math.max(3, Math.min(40, PE.s * Math.exp(-e.deltaY * .0015))); PE.ox = sx - wx * PE.s; PE.oy = sy - wz * PE.s; peDraw(); }, { passive: false });

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
    peAdd(b.dataset.add, S2W(e.clientX - r.left, e.clientY - r.top));
  });
});
function peAdd(type, at) {
  if (type === 'stairs') return peAddStair(at);
  pushHist();
  const want = RT[type].levels; if (want && want !== PE.lv && PE.lv !== 'B') { PE.lv = want; PE.sel = null; peLvlButtons(); if (curHouse === 3) goView(PE.lv); }
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
  if (w.ext) { info.textContent = `${rname(w.R)} · outside wall`; btns.hidden = true; xb.hidden = false;
    const m = extMode(w.R, w.out); xb.querySelectorAll('[data-xm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.xm === m))); return; }
  btns.hidden = false; xb.hidden = true; info.textContent = `Between ${rname(w.A)} and ${rname(w.B)}`;
  const m = wallMode(w.A, w.B); btns.querySelectorAll('[data-wm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wm === m)));
}
document.querySelectorAll('[data-xm]').forEach(b => b.onclick = () => { const w = PE.selWall; if (!w || !w.ext) return; pushHist(); BM.ext = BM.ext || {}; if (b.dataset.xm === 'auto') delete BM.ext[extKey(w.R, w.out)]; else BM.ext[extKey(w.R, w.out)] = b.dataset.xm; planChanged(); });
document.querySelectorAll('[data-wm]').forEach(b => b.onclick = () => { const w = PE.selWall; if (!w || w.ext) return; pushHist(); BM.walls = BM.walls || {}; BM.walls[pairKey(w.A, w.B)] = b.dataset.wm; planChanged(); });
document.getElementById('peGaps').onclick = () => { pushHist(); const n = closeGaps(BM.rooms.filter(r => r.level === PE.lv).map(r => r.id)); toast(n ? `Closed ${n} gap${n > 1 ? 's' : ''}` : 'No gaps found'); planChanged(); };
function peStairPanel() {
  const S = (BM.stairs || []).find(o => o.id === PE.selStair), el = document.getElementById('peStair'); el.hidden = !S; if (!S) return;
  const inp = document.getElementById('peSW'); if (document.activeElement !== inp) inp.value = toDisp(S.W);
  document.querySelectorAll('[data-sshape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sshape === (S.shape || 'auto'))));
  document.getElementById('peSShape').hidden = S.level === 'B';
  const st = stairStatus(S); document.getElementById('peSNote').textContent = st.ok ? `Climbs ${({ '+x': 'east', '-x': 'west', '+z': 'toward the back', '-z': 'toward the front' })[st.dir]} to the ${st.up === 'U' ? '2nd floor' : 'main floor'}${S.dir ? '' : ' · direction picked automatically'}.` : st.msg;
}
const curStair = () => (BM.stairs || []).find(o => o.id === PE.selStair);
document.getElementById('peSRot').onclick = () => { const S = curStair(); if (!S) return; pushHist(); S.dir = STAIR_DIRS[(STAIR_DIRS.indexOf(stairDirOf(S)) + 1) % 4]; planChanged(); };
document.getElementById('peSAuto').onclick = () => { const S = curStair(); if (!S) return; pushHist(); delete S.dir; planChanged(); };
document.getElementById('peSDel').onclick = () => peDeleteStair();
document.querySelectorAll('[data-sshape]').forEach(b => b.onclick = () => { const S = curStair(); if (!S) return; pushHist(); if (b.dataset.sshape === 'auto') delete S.shape; else S.shape = b.dataset.sshape; if (S.shape && S.shape !== 'straight' && S.W < 5.5) S.W = 6; planChanged(); });
document.getElementById('peSW').onchange = e => { const S = curStair(), v = fromDisp(parseFloat(e.target.value)); if (!S || !(v >= 3 && v <= 10)) return; pushHist(); S.W = snapH(v); planChanged(); };
function peDeleteStair() { const i = (BM.stairs || []).findIndex(o => o.id === PE.selStair); if (i < 0) return; pushHist(); BM.stairs.splice(i, 1); PE.selStair = null; planChanged(); }
function peAddStair(at) {
  pushHist(); if (PE.lv === 'U') { PE.lv = 'M'; peLvlButtons(); if (curHouse === 3) goView('M'); }
  const host = BM.rooms.find(r => r.id === PE.sel && r.level === PE.lv) || lvRooms()[0];
  const c = at || (host ? [host.x + host.w / 2, host.z + host.d / 2] : [0, 0]);
  const S = { id: BID++, level: PE.lv, cx: snapH(c[0]), cz: snapH(c[1]), W: 3.5, L: 12.5 };
  BM.stairs = BM.stairs || []; BM.stairs.push(S); PE.selStair = S.id; PE.sel = null; planChanged();
}
function peInspector() {
  peSideFollow(); peWallPanel(); peStairPanel(); peOpPanel(); const extra = peExtraInspector();
  const q = BM.rooms.find(r => r.id === PE.sel), box = document.getElementById('peInspect');
  box.hidden = !q; document.getElementById('peEmpty').hidden = !!(q || PE.selStair || PE.selWall || extra);
  document.getElementById('planEd').classList.toggle('has-sel', !!(q || PE.selStair || PE.selWall || extra)); if (!q) return;
  document.getElementById('peArea').textContent = fmtArea(q.w * q.d);
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
for (const [id, k] of [['peW', 'w'], ['peD', 'd']]) document.getElementById(id).onchange = e => { const q = BM.rooms.find(r => r.id === PE.sel); const v = fromDisp(parseFloat(e.target.value)); if (!q || !(v >= 3 && v <= 120)) return; pushHist(); q[k] = snapH(v); closeGaps([q.id]); planChanged(); };
document.getElementById('peDup').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); const c = { ...q, id: BID++, x: q.x + q.w }; delete c.group; BM.rooms.push(c); PE.sel = c.id; planChanged(); };
document.getElementById('peDel').onclick = () => peDelete();
document.getElementById('peRot').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); q.rot = ((q.rot || 0) + 1) % 4; planChanged(); };
document.getElementById('peShuf').onclick = () => { const q = BM.rooms.find(r => r.id === PE.sel); if (!q) return; pushHist(); q.var = (q.var || 0) + 1; planChanged(); };
function peDelete() { const i = BM.rooms.findIndex(r => r.id === PE.sel); if (i < 0) return; pushHist(); BM.rooms.splice(i, 1); PE.sel = null; planChanged(); }
function peUndo() { const s = PE.hist.pop(); if (!s) return; PE.redo.push(snapshot()); BM = JSON.parse(s); planChanged(); }
function peRedo() { const s = PE.redo.pop(); if (!s) return; PE.hist.push(snapshot()); BM = JSON.parse(s); planChanged(); }
document.getElementById('peRedo').onclick = peRedo;
document.getElementById('peUndo').onclick = peUndo;
document.getElementById('peReset').onclick = () => { closePops(); pushHist(); BM = starterPlan(); PE.sel = null; peFit(); planChanged(); };
document.getElementById('peClear').onclick = () => { closePops(); pushHist(); BM = { roof: BM.roof, rooms: [] }; PE.sel = null; planChanged(); };
document.querySelectorAll('[data-pelv]').forEach(b => b.onclick = () => { PE.lv = b.dataset.pelv; PE.sel = null; peLvlButtons(); peInspector(); peDraw(); if (curHouse === 3) goView(PE.lv); });
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
function guideMode() { return PE.guide[PE.lv] || (PE.lv === 'B' ? 'above' : 'below'); }
document.querySelectorAll('[data-guide]').forEach(b => b.onclick = () => { PE.guide[PE.lv] = b.dataset.guide; peLvlButtons(); peDraw(); });
function peLvlButtons() {
  const can = { below: PE.lv !== 'B', above: PE.lv !== 'U', none: true }, gm = guideMode();
  document.querySelectorAll('[data-guide]').forEach(b => { b.disabled = !can[b.dataset.guide]; b.setAttribute('aria-pressed', String(b.dataset.guide === gm)); });
  document.getElementById('peTrace').hidden = PE.lv !== 'B'; document.querySelectorAll('[data-pelv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pelv === PE.lv))); document.querySelectorAll('[data-roof]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roof === (BM.roof || 'hip')))); }
document.querySelectorAll('[data-roof]').forEach(b => b.onclick = () => { pushHist(); BM.roof = b.dataset.roof; peLvlButtons(); planChanged(); });
// auto-layout form
const peAuto = document.getElementById('peAuto');
document.getElementById('peAutoCancel').onclick = () => closePops();
document.getElementById('peAutoGo').onclick = () => {
  pushHist(); const v = id => document.getElementById(id);
  autoLayout({ beds: +v('paBeds').value, baths: +v('paBaths').value, garage: +v('paGarage').value, storeys: +v('paStoreys').value, office: v('paOffice').checked, basement: v('paBase').checked });
  closePops(); PE.sel = null; PE.lv = 'M'; peLvlButtons(); peFit(); planChanged();
};
addEventListener('keydown', e => {
  if (!PE.open || e.target.closest?.('input,select,textarea')) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && PE.selStair) { e.preventDefault(); peDeleteStair(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && PE.sel) { e.preventDefault(); peDelete(); }
  const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? peRedo() : peUndo(); return; }
  if (mod && k === 'y') { e.preventDefault(); peRedo(); return; }
  if (mod && k === 'd') { e.preventDefault(); document.getElementById('peDup').click(); return; }
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
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0, dz = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  const q = BM.rooms.find(r => r.id === PE.sel), S = (BM.stairs || []).find(o => o.id === PE.selStair);
  if (q) { q.x = +(q.x + dx).toFixed(2); q.z = +(q.z + dz).toFixed(2); } else if (S) { S.cx = +(S.cx + dx).toFixed(2); S.cz = +(S.cz + dz).toFixed(2); }
  planChanged();
}
const edEl = document.getElementById('planEd'), rz = document.getElementById('peResize');
let edW = 0; try { edW = +localStorage.getItem('walkthru-edw') || 0; } catch (e) { }
function applyEdW() { if (innerWidth <= 760) { edEl.style.width = ''; return; } if (edW) edEl.style.width = Math.max(520, Math.min(innerWidth - 260, edW)) + 'px'; }
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
  if (sb) { const [a, b] = W2S(sb[0], sb[1]), [c, d] = W2S(sb[2], sb[3]); L = a + C.left - B.left; T = b + C.top - B.top; R = c + C.left - B.left; Bt = d + C.top - B.top; }
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
pc.addEventListener('contextmenu', e => e.preventDefault()); // right-click selects too; no browser menu over the plan
addEventListener('wheel', () => { if (document.getElementById('planEd').classList.contains('has-sel')) requestAnimationFrame(pePlaceSide); }, { passive: true });
