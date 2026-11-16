
// =====================================================================
//  DESIGNER TOOLS — furniture you place by hand, notes, dimension lines, multi-select (align, copy, paste),
//  mirror, door and window sizes, roof style and pitch, and site settings. Everything lives in BM:
//  BM.items, BM.notes, BM.dims, BM.ops (opening sizes per wall), BM.pitch, BM.site.
// =====================================================================
PE.multi = new Set(); PE.selX = null; PE.tool = null;
const NIL = () => .5; // furniture helpers that want a random source get a fixed one, so pieces look the same every rebuild
// kind: [name, width, depth, plan colour, build(group, y)] — built facing +z (toward the back of the plan), centred on 0,0.
const CATALOG = {
  sofa: ['Sofa', 7.5, 3.2, '#8d9091', (g, y) => sofa(g, [-3.75, 3.75, -1.6, 1.6], y, 'n')],
  loveseat: ['Loveseat', 5.5, 3.2, '#8d9091', (g, y) => sofa(g, [-2.75, 2.75, -1.6, 1.6], y, 'n')],
  armchair: ['Armchair', 2.8, 2.8, '#5d6b74', (g, y) => armchair(g, 0, 0, y, 's', M.fabric2)],
  coffee: ['Coffee table', 4, 2.2, '#b48b5e', (g, y) => table(g, [-2, 2, -1.1, 1.1], y, 1.4, M.oak)],
  tvunit: ['TV and console', 6, 1.6, '#2a2b2c', (g, y) => media(g, 0, -.4, y, 6, 's')],
  queen: ['Queen bed', 5.2, 7, '#ecebe6', (g, y) => bed(g, [-2.6, 2.6, -3.5, 3.5], y, 'n')],
  king: ['King bed', 6.6, 7.2, '#ecebe6', (g, y) => bed(g, [-3.3, 3.3, -3.6, 3.6], y, 'n')],
  single: ['Single bed', 3.4, 6.6, '#ecebe6', (g, y) => bed(g, [-1.7, 1.7, -3.3, 3.3], y, 'n')],
  crib: ['Crib', 4.4, 2.6, '#f6f6f3', (g, y) => crib(g, [-2.2, 2.2, -1.3, 1.3], y)],
  dresser: ['Dresser', 5, 1.8, '#6c4a31', (g, y) => dresser(g, [-2.5, 2.5, -.9, .9], y, NIL)],
  wardrobe: ['Wardrobe', 4, 2, '#f2f2ef', (g, y) => closet(g, [-2, 2, -1, 1], y, 's')],
  dining6: ['Dining table, 6', 6.5, 3.4, '#5e4330', (g, y) => { table(g, [-3.25, 3.25, -1.7, 1.7], y); for (const x of [-2, 0, 2]) { chair(g, x, -2.6, y, 's'); chair(g, x, 2.6, y, 'n'); } }],
  round4: ['Round table, 4', 4, 4, '#5e4330', (g, y) => { table(g, [-1.9, 1.9, -1.9, 1.9], y, 2.5, M.walnut, { pedestal: true }); for (const [x, z, f] of [[0, -2.7, 's'], [0, 2.7, 'n'], [-2.7, 0, 'e'], [2.7, 0, 'w']]) chair(g, x, z, y, f); }],
  desk: ['Desk and chair', 5, 4, '#b48b5e', (g, y) => { table(g, [-2.5, 2.5, -2, -.2], y, 2.5, M.oak); chair(g, 0, 1, y, 'n'); }],
  bookcase: ['Bookcase', 3.2, 1.2, '#6c4a31', (g, y) => bookshelf(g, [-1.6, 1.6, -.6, .6], y, NIL)],
  island: ['Kitchen island', 7, 3.6, '#f2f2ef', (g, y) => { lowerCab(g, [-3.5, 3.5, -1.8, 1.8], y, 's'); for (const x of [-2, 0, 2]) stool(g, x, 2.6, y); }],
  tub: ['Bathtub', 5.4, 2.6, '#fbfbfb', (g, y) => tub(g, [-2.7, 2.7, -1.3, 1.3], y)],
  vanity: ['Vanity', 4, 1.9, '#f2f2ef', (g, y) => vanity(g, [-2, 2, -.95, .95], y, 's', 1, false)],
  toilet: ['Toilet', 1.8, 2.4, '#fbfbfb', (g, y) => toilet(g, 0, -.4, y, 's')],
  washer: ['Washer and dryer', 5.4, 2.4, '#e5e7ea', (g, y) => { for (const x of [-1.4, 1.4]) { box(g, x - 1.25, x + 1.25, y, y + 3.2, -1.2, 1.2, M.white, { solid: true }); cyl(g, x, 1.21, .7, y + 1.2, y + 2.6, M.steel, 20).rotation.x = Math.PI / 2; } }],
  rug: ['Rug', 8, 5.5, '#c3b9a9', (g, y) => rug(g, [-4, 4, -2.75, 2.75], y + .01)],
  plant: ['Plant', 1.6, 1.6, '#4f7a37', (g, y) => plant(g, 0, 0, y, NIL)],
  lamp: ['Floor lamp', 1.2, 1.2, '#2a2b2c', (g, y) => floorLamp(g, 0, 0, y)],
  piano: ['Piano', 5, 2.2, '#1b1c1e', (g, y) => { box(g, -2.5, 2.5, y, y + 4.2, -1.1, .2, M.black, { solid: true }); box(g, -2.5, 2.5, y + 2.3, y + 2.6, .2, 1.1, M.black); box(g, -2.3, 2.3, y + 2.6, y + 2.7, .3, 1, M.porcelain); }],
  hottub: ['Hot tub', 7, 7, '#7cc3dc', (g, y) => { box(g, -3.5, 3.5, y, y + 3, -3.5, 3.5, M.deck, { solid: true }); box(g, -3, 3, y + 2.9, y + 2.95, -3, 3, M.water); }],
  bbq: ['Grill', 4, 2, '#2d2f33', (g, y) => { box(g, -2, 2, y, y + 3, -1, 1, M.metal, { solid: true }); box(g, -1.6, 1.6, y + 3, y + 3.6, -.8, .8, M.black); }],
};
const ITEM_GROUPS = [['Living', ['sofa', 'loveseat', 'armchair', 'coffee', 'tvunit', 'rug', 'piano']], ['Bedroom', ['queen', 'king', 'single', 'crib', 'dresser', 'wardrobe']],
  ['Kitchen & dining', ['dining6', 'round4', 'island']], ['Bath & laundry', ['tub', 'vanity', 'toilet', 'washer']], ['Work & decor', ['desk', 'bookcase', 'plant', 'lamp']], ['Outdoor', ['hottub', 'bbq']]];
const itemDims = it => { const c = CATALOG[it.kind]; return it.rot % 2 ? [c[2], c[1]] : [c[1], c[2]]; };

// 3D: builder.js calls this at the end of buildHouse3.
function placeItems() {
  const furn = { B: G3.furnB, M: G3.furnM, U: G3.furnU };
  for (const it of BM.items || []) {
    const c = CATALOG[it.kind]; if (!c || !furn[it.level]) continue;
    const g = new THREE.Group(); g.position.set(it.x, 0, it.z); g.rotation.y = -(it.rot || 0) * Math.PI / 2;
    const before = walkables.length; c[4](g, LV_Y[it.level] + (it.level === 'M' ? 0 : 0)); walkables.splice(before);
    furn[it.level].add(g);
  }
}

// ---------- library: furniture section ----------
document.getElementById('pePalette').insertAdjacentHTML('beforeend', ITEM_GROUPS.map(([g, ks]) => `<h3>${g}</h3>` + ks.map(k => `<button type="button" data-item="${k}" title="Click to add, or drag onto the plan"><i style="background:${CATALOG[k][3]};border-radius:50%"></i>${CATALOG[k][0]}</button>`).join('')).join(''));
document.getElementById('pePalette').insertAdjacentHTML('afterbegin', '<h3 class="lib-tab">Rooms</h3>');
const furnHead = [...document.querySelectorAll('#pePalette h3')].find(h => h.textContent === 'Living' && h.nextElementSibling?.dataset.item); furnHead?.insertAdjacentHTML('beforebegin', '<h3 class="lib-tab">Furniture</h3>');
function viewCentre() { const r = pc.getBoundingClientRect(); return S2W(r.width / 2, r.height / 2); }
function addItem(kind, at) {
  pushHist(); const host = BM.rooms.find(r => r.id === PE.sel && r.level === PE.lv);
  const [x, z] = at || (host ? [host.x + host.w / 2, host.z + host.d / 2] : viewCentre());
  const it = { id: BID++, kind, level: PE.lv, x: snapH(x), z: snapH(z), rot: 0 };
  (BM.items = BM.items || []).push(it); selectX({ kind: 'item', id: it.id }); planChanged();
}
document.querySelectorAll('[data-item]').forEach(b => {
  let st = null, ghost = null;
  b.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, moved: false }; try { b.setPointerCapture(e.pointerId); } catch (er) { } });
  b.addEventListener('pointermove', e => { if (!st) return; if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 5) { st.moved = true; ghost = document.createElement('div'); ghost.id = 'pegDrop'; ghost.textContent = CATALOG[b.dataset.item][0]; ghost.style.background = CATALOG[b.dataset.item][3]; ghost.style.color = '#111'; document.body.appendChild(ghost); }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; } });
  b.addEventListener('pointerup', e => { const s0 = st; st = null; ghost?.remove(); ghost = null; if (!s0) return; if (!s0.moved) return addItem(b.dataset.item);
    const r = pc.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; addItem(b.dataset.item, S2W(e.clientX - r.left, e.clientY - r.top)); });
});

// ---------- selection of items / notes / dimensions ----------
function selectX(x) { PE.selX = x; if (x) { PE.sel = null; PE.selStair = null; PE.selWall = null; PE.multi.clear(); } peInspector(); peDraw(); }
const curItem = () => PE.selX?.kind === 'item' && (BM.items || []).find(i => i.id === PE.selX.id);
const curNote = () => PE.selX?.kind === 'note' && (BM.notes || []).find(i => i.id === PE.selX.id);
function itemAt(wx, wz) { const L = (BM.items || []).filter(i => i.level === PE.lv); for (let k = L.length - 1; k >= 0; k--) { const it = L[k], [w, d] = itemDims(it); if (Math.abs(wx - it.x) < w / 2 && Math.abs(wz - it.z) < d / 2) return it; } return null; }
function noteAt(sx, sy) { return (BM.notes || []).find(n => { if (n.level !== PE.lv) return false; const [a, b] = W2S(n.x, n.z); return sx > a - 8 && sx < a + 8 + (n._w || 60) && sy > b - 22 && sy < b + 8; }); }
function dimAt(sx, sy) {
  return (BM.dims || []).find(d => { if (d.level !== PE.lv) return false; const [a, b] = W2S(d.x1, d.z1), [c, e] = W2S(d.x2, d.z2), L2 = (c - a) ** 2 + (e - b) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((sx - a) * (c - a) + (sy - b) * (e - b)) / L2)); return Math.hypot(sx - (a + t * (c - a)), sy - (b + t * (e - b))) < 7; });
}
// editor.js asks these first; returning true means the event was handled here.
function peToolDown(e, sx, sy, wx, wz) {
  if (e.button !== 0) return false;
  if (PE.tool === 'note') { const text = prompt('Note text'); setTool(null); if (!text?.trim()) return true; pushHist(); const n = { id: BID++, level: PE.lv, x: snapH(wx), z: snapH(wz), text: text.trim().slice(0, 140) }; (BM.notes = BM.notes || []).push(n); selectX({ kind: 'note', id: n.id }); planChanged(); return true; }
  if (PE.tool === 'dim') { const p = [snapToWalls(wx, 'x', .8), snapToWalls(wz, 'z', .8)]; PE.drag = { kind: 'dimNew', x1: p[0], z1: p[1], x2: p[0], z2: p[1] }; return true; }
  const n = noteAt(sx, sy); if (n) { selectX({ kind: 'note', id: n.id }); PE.drag = { kind: 'noteMove', n, dx: wx - n.x, dz: wz - n.z, before: snapshot() }; return true; }
  const it = itemAt(wx, wz); if (it) { selectX({ kind: 'item', id: it.id }); PE.drag = { kind: 'itemMove', it, dx: wx - it.x, dz: wz - it.z, before: snapshot() }; return true; }
  const d = dimAt(sx, sy); if (d) { selectX({ kind: 'dim', id: d.id }); return true; }
  if (PE.selX) { PE.selX = null; }
  return false;
}
function peToolMove(e, wx, wz) {
  const D = PE.drag; if (!D) return false;
  if (D.kind === 'dimNew') { let x = snapToWalls(wx, 'x', .8), z = snapToWalls(wz, 'z', .8); if (Math.abs(x - D.x1) > Math.abs(z - D.z1)) z = D.z1; else x = D.x1; D.x2 = x; D.z2 = z; peDraw(); return true; }
  if (D.kind === 'itemMove') { D.it.x = snapH(wx - D.dx); D.it.z = snapH(wz - D.dz); peDraw(); return true; }
  if (D.kind === 'noteMove') { D.n.x = snapH(wx - D.dx); D.n.z = snapH(wz - D.dz); peDraw(); return true; }
  return false;
}
function peToolUp() {
  const D = PE.drag; if (!D || !['dimNew', 'itemMove', 'noteMove'].includes(D.kind)) return false; PE.drag = null;
  if (D.kind === 'dimNew') { setTool(null); if (Math.hypot(D.x2 - D.x1, D.z2 - D.z1) >= 1) { pushHist(); const d = { id: BID++, level: PE.lv, x1: D.x1, z1: D.z1, x2: D.x2, z2: D.z2 }; (BM.dims = BM.dims || []).push(d); selectX({ kind: 'dim', id: d.id }); planChanged(); } else peDraw(); return true; }
  if (D.before !== snapshot()) { PE.hist.push(D.before); PE.redo = []; planChanged(); } else peDraw();
  return true;
}
function setTool(t) { PE.tool = t; document.getElementById('peNoteBtn').setAttribute('aria-pressed', String(t === 'note')); document.getElementById('peDimBtn').setAttribute('aria-pressed', String(t === 'dim')); pc.style.cursor = t ? 'crosshair' : ''; if (t) toast(t === 'note' ? 'Click the plan where the note goes' : 'Drag along a wall or across a room'); }
document.getElementById('peNoteBtn').onclick = () => setTool(PE.tool === 'note' ? null : 'note');
document.getElementById('peDimBtn').onclick = () => setTool(PE.tool === 'dim' ? null : 'dim');

// ---------- drawing (called at the end of peDraw) ----------
function peDrawExtras(s) {
  px.save(); px.textBaseline = 'middle';
  for (const it of (BM.items || []).filter(i => i.level === PE.lv)) {
    const c = CATALOG[it.kind]; if (!c) continue; const [w, d] = itemDims(it), [a, b] = W2S(it.x - w / 2, it.z - d / 2), sel = PE.selX?.kind === 'item' && PE.selX.id === it.id;
    px.fillStyle = c[3] + 'cc'; px.strokeStyle = sel ? css('--accent') : 'rgba(17,17,20,.55)'; px.lineWidth = sel ? 2.2 : 1; px.beginPath(); px.roundRect?.(a, b, w * s, d * s, Math.min(4, s * .3)) ?? px.rect(a, b, w * s, d * s); px.fill(); px.stroke();
    const fx = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] }[it.rot % 4]; // front edge marker
    px.strokeStyle = 'rgba(17,17,20,.7)'; px.lineWidth = 2; px.beginPath(); const cx = a + w * s / 2, cy = b + d * s / 2;
    px.moveTo(cx + fx[0] * w * s / 2 - fx[1] * w * s * .25, cy + fx[1] * d * s / 2 + fx[0] * d * s * .25); px.lineTo(cx + fx[0] * w * s / 2 + fx[1] * w * s * .25, cy + fx[1] * d * s / 2 - fx[0] * d * s * .25); px.stroke();
    if (w * s > 46 && d * s > 16) { px.fillStyle = '#111114'; px.font = '500 10px Inter, system-ui, sans-serif'; px.textAlign = 'center'; px.fillText(c[0], cx, cy); }
  }
  for (const d of (BM.dims || []).filter(i => i.level === PE.lv)) drawDim(d, PE.selX?.kind === 'dim' && PE.selX.id === d.id);
  if (PE.drag?.kind === 'dimNew') drawDim(PE.drag, true);
  for (const n of (BM.notes || []).filter(i => i.level === PE.lv)) {
    const [a, b] = W2S(n.x, n.z), sel = PE.selX?.kind === 'note' && PE.selX.id === n.id;
    px.font = '500 11.5px Inter, system-ui, sans-serif'; const tw = Math.min(220, px.measureText(n.text).width); n._w = tw + 16;
    px.fillStyle = sel ? css('--accent') : '#111114'; px.beginPath(); px.arc(a, b, 3.5, 0, Math.PI * 2); px.fill();
    px.fillStyle = 'rgba(255,248,214,.97)'; px.strokeStyle = sel ? css('--accent') : 'rgba(17,17,20,.35)'; px.lineWidth = sel ? 2 : 1; px.beginPath(); px.rect(a + 6, b - 22, tw + 12, 20); px.fill(); px.stroke();
    px.fillStyle = '#111114'; px.textAlign = 'left'; px.fillText(n.text, a + 12, b - 12, 220);
  }
  // several rooms selected
  if (PE.multi.size) { px.strokeStyle = css('--accent'); px.lineWidth = 2; px.setLineDash([5, 3]); for (const q of BM.rooms.filter(r => PE.multi.has(r.id) && r.level === PE.lv)) { const [a, b] = W2S(q.x, q.z); px.strokeRect(a + 1, b + 1, q.w * s - 2, q.d * s - 2); } px.setLineDash([]); }
  px.restore();
}
function drawDim(d, sel) {
  const [a, b] = W2S(d.x1, d.z1), [c, e] = W2S(d.x2, d.z2), L = Math.hypot(d.x2 - d.x1, d.z2 - d.z1); if (L < .1) return;
  const nx = -(e - b) / Math.hypot(c - a, e - b), ny = (c - a) / Math.hypot(c - a, e - b), col = sel ? css('--accent') : '#c2410c';
  px.strokeStyle = col; px.fillStyle = col; px.lineWidth = 1.4; px.beginPath(); px.moveTo(a, b); px.lineTo(c, e);
  for (const [x, y] of [[a, b], [c, e]]) { px.moveTo(x + nx * 6, y + ny * 6); px.lineTo(x - nx * 6, y - ny * 6); px.moveTo(x - 4 * (ny + nx), y - 4 * (ny - nx)); px.lineTo(x + 4 * (ny + nx), y + 4 * (ny - nx)); }
  px.stroke(); const t = ftin(L); px.font = '600 11px "JetBrains Mono", monospace'; px.textAlign = 'center'; const tw = px.measureText(t).width + 8, mx = (a + c) / 2 + nx * 11, my = (b + e) / 2 + ny * 11;
  px.fillStyle = 'rgba(255,255,255,.95)'; px.fillRect(mx - tw / 2, my - 8, tw, 16); px.fillStyle = col; px.fillText(t, mx, my + .5);
}

// ---------- inspector for items, notes, dimensions and several rooms ----------
document.getElementById('peSide').insertAdjacentHTML('beforeend', '<div id="peX" class="pe-card" hidden></div>');
function peExtraInspector() {
  const el = document.getElementById('peX'), it = curItem(), n = curNote(), multi = BM.rooms.filter(r => PE.multi.has(r.id));
  if (multi.length > 1) {
    el.hidden = false; const sf = Math.round(multi.reduce((a, q) => a + q.w * q.d, 0));
    el.innerHTML = `<h3>${multi.length} rooms <span class="pe-area">${sf.toLocaleString()} sf</span></h3><p class="pe-note" style="margin-top:0">Shift-click to add or remove rooms. Drag any of them to move them together.</p>
      <h3 style="font-weight:500;font-size:11.5px;color:var(--ink-3)">Align</h3><div class="seg full pe-wm al"><button data-al="l" title="Left edges">Left</button><button data-al="cx" title="Centres, left to right">Centre</button><button data-al="r" title="Right edges">Right</button></div>
      <div class="seg full pe-wm al"><button data-al="t" title="Front edges">Front</button><button data-al="cz" title="Centres, front to back">Middle</button><button data-al="b" title="Back edges">Back</button></div>
      <div class="pe-row"><button class="btn" data-al="w">Same width</button><button class="btn" data-al="d">Same depth</button></div>
      <div class="pe-row"><button class="btn" id="mxCopy" title="⌘C then ⌘V">Copy</button><button class="btn" id="mxDup">Duplicate</button><button class="btn danger" id="mxDel">Delete</button></div>`;
    el.querySelectorAll('[data-al]').forEach(b => b.onclick = () => alignRooms(b.dataset.al));
    el.querySelector('#mxCopy').onclick = copySel; el.querySelector('#mxDup').onclick = () => { copySel(); pasteClip(); }; el.querySelector('#mxDel').onclick = deleteSel;
    return true;
  }
  if (it) {
    const c = CATALOG[it.kind], [w, d] = itemDims(it); el.hidden = false;
    el.innerHTML = `<h3>${c[0]} <span class="pe-area">${ftin(w)} × ${ftin(d)}</span></h3><label class="fld">Swap for <select id="ixKind">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${k === it.kind ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <div class="pe-row"><button class="btn" id="ixRot" title="R">Rotate</button><button class="btn" id="ixDup">Duplicate</button><button class="btn danger" id="ixDel">Delete</button></div><p class="pe-note">Drag to move. The dark edge is the front.</p>`;
    el.querySelector('#ixKind').onchange = e => { pushHist(); it.kind = e.target.value; planChanged(); };
    el.querySelector('#ixRot').onclick = () => { pushHist(); it.rot = ((it.rot || 0) + 1) % 4; planChanged(); };
    el.querySelector('#ixDup').onclick = () => { pushHist(); const c2 = { ...it, id: BID++, x: it.x + 2, z: it.z + 2 }; BM.items.push(c2); selectX({ kind: 'item', id: c2.id }); planChanged(); };
    el.querySelector('#ixDel').onclick = deleteSel; return true;
  }
  if (n) {
    el.hidden = false; el.innerHTML = `<h3>Note</h3><label class="fld">Text <input id="nxText" maxlength="140" value="${n.text.replace(/"/g, '&quot;')}"></label><div class="pe-row"><button class="btn danger" id="nxDel">Delete</button></div>`;
    el.querySelector('#nxText').oninput = e => { n.text = e.target.value || ' '; planChanged(); }; el.querySelector('#nxDel').onclick = deleteSel; return true;
  }
  if (PE.selX?.kind === 'dim') {
    const d = (BM.dims || []).find(x => x.id === PE.selX.id); if (!d) { el.hidden = true; return false; }
    el.hidden = false; el.innerHTML = `<h3>Dimension <span class="pe-area">${ftin(Math.hypot(d.x2 - d.x1, d.z2 - d.z1))}</span></h3><div class="pe-row"><button class="btn danger" id="dxDel">Delete</button></div>`;
    el.querySelector('#dxDel').onclick = deleteSel; return true;
  }
  el.hidden = true; return false;
}
function deleteSel() {
  pushHist();
  if (PE.multi.size > 1) { BM.rooms = BM.rooms.filter(r => !PE.multi.has(r.id)); PE.multi.clear(); }
  else if (PE.selX) { const list = { item: 'items', note: 'notes', dim: 'dims' }[PE.selX.kind]; BM[list] = (BM[list] || []).filter(x => x.id !== PE.selX.id); PE.selX = null; }
  planChanged();
}
function alignRooms(k) {
  const rs = BM.rooms.filter(r => PE.multi.has(r.id)); if (rs.length < 2) return; pushHist();
  const x0 = Math.min(...rs.map(r => r.x)), x1 = Math.max(...rs.map(r => r.x + r.w)), z0 = Math.min(...rs.map(r => r.z)), z1 = Math.max(...rs.map(r => r.z + r.d)), first = rs[0];
  for (const r of rs) {
    if (k === 'l') r.x = x0; if (k === 'r') r.x = +(x1 - r.w).toFixed(2); if (k === 't') r.z = z0; if (k === 'b') r.z = +(z1 - r.d).toFixed(2);
    if (k === 'cx') r.x = snapH((x0 + x1) / 2 - r.w / 2); if (k === 'cz') r.z = snapH((z0 + z1) / 2 - r.d / 2);
    if (k === 'w') r.w = first.w; if (k === 'd') r.d = first.d;
  }
  planChanged();
}
let CLIP = null;
function copySel() {
  const ids = PE.multi.size ? [...PE.multi] : PE.sel ? [PE.sel] : [];
  if (ids.length) { CLIP = { rooms: JSON.parse(JSON.stringify(BM.rooms.filter(r => ids.includes(r.id)))) }; toast(`Copied ${ids.length} room${ids.length > 1 ? 's' : ''}`); return; }
  const it = curItem(); if (it) { CLIP = { items: [{ ...it }] }; toast('Copied'); }
}
function pasteClip() {
  if (!CLIP) return; pushHist(); PE.multi.clear();
  for (const r of CLIP.rooms || []) { const c = { ...JSON.parse(JSON.stringify(r)), id: BID++, level: PE.lv, x: r.x + 2, z: r.z + 2 }; delete c.group; BM.rooms.push(c); PE.multi.add(c.id); }
  for (const i of CLIP.items || []) { const c = { ...i, id: BID++, level: PE.lv, x: i.x + 2, z: i.z + 2 }; (BM.items = BM.items || []).push(c); selectX({ kind: 'item', id: c.id }); }
  if (PE.multi.size === 1) { PE.sel = [...PE.multi][0]; PE.multi.clear(); } else PE.sel = null;
  CLIP = JSON.parse(JSON.stringify({ rooms: (CLIP.rooms || []).map(r => ({ ...r, x: r.x + 2, z: r.z + 2 })), items: (CLIP.items || []).map(i => ({ ...i, x: i.x + 2, z: i.z + 2 })) }));
  planChanged();
}

// ---------- mirror the whole design ----------
function mirrorPlan(axis) {
  if (!BM.rooms.length) return; pushHist();
  const X = axis === 'x', lo = Math.min(...BM.rooms.map(r => X ? r.x : r.z)), hi = Math.max(...BM.rooms.map(r => X ? r.x + r.w : r.z + r.d)), S = lo + hi;
  const f = v => +(S - v).toFixed(2), swapOut = o => X ? ({ '+x': '-x', '-x': '+x' })[o] || o : ({ '+z': '-z', '-z': '+z' })[o] || o;
  for (const r of BM.rooms) { if (X) r.x = f(r.x + r.w); else r.z = f(r.z + r.d); if (r.rot !== undefined) r.rot = X ? (4 - r.rot) % 4 : (6 - r.rot) % 4; }
  for (const s of BM.stairs || []) { if (X) s.cx = f(s.cx); else s.cz = f(s.cz); if (s.dir) s.dir = swapOut(s.dir); }
  for (const it of BM.items || []) { if (X) it.x = f(it.x); else it.z = f(it.z); it.rot = X ? (4 - (it.rot || 0)) % 4 : (6 - (it.rot || 0)) % 4; }
  for (const n of BM.notes || []) { if (X) n.x = f(n.x); else n.z = f(n.z); }
  for (const d of BM.dims || []) { if (X) { d.x1 = f(d.x1); d.x2 = f(d.x2); } else { d.z1 = f(d.z1); d.z2 = f(d.z2); } }
  for (const k of ['ext', 'ops']) if (BM[k]) BM[k] = Object.fromEntries(Object.entries(BM[k]).map(([key, v]) => { const m = key.match(/^(\d+):(.+)$/); return [m ? `${m[1]}:${swapOut(m[2])}` : key, v]; }));
  if (BM.extras?.gables) for (const g of BM.extras.gables) { if (X) [g.x0, g.x1] = [f(g.x1), f(g.x0)]; else [g.z0, g.z1] = [f(g.z1), f(g.z0)]; }
  planChanged(); toast(X ? 'Flipped left to right' : 'Flipped front to back');
}

// ---------- door and window sizes on the selected wall ----------
document.getElementById('peWall').insertAdjacentHTML('beforeend', '<div id="peOp" hidden></div>');
function opKey() { const w = PE.selWall; if (!w) return null; return w.ext ? extKey(w.R, w.out) : pairKey(w.A, w.B); }
function peOpPanel() {
  const w = PE.selWall, el = document.getElementById('peOp'); if (!w) { el.hidden = true; return; }
  const mode = w.ext ? extMode(w.R, w.out) : wallMode(w.A, w.B), kind = mode === 'window' ? 'window' : mode === 'door' ? 'door' : null;
  if (!kind || (w.ext && w.R.level === 'B' && kind === 'window')) { el.hidden = true; return; }
  const o = BM.ops?.[opKey()] || {}, L = w.b - w.a, num = (id, label, v, min, max, step, ph) => `<label class="fld" for="${id}">${label} <input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${v ?? ''}" placeholder="${ph}"></label>`;
  el.hidden = false;
  el.innerHTML = `<h3 style="font-weight:500;font-size:11.5px;color:var(--ink-3);margin-top:12px">${kind === 'door' ? 'Door' : 'Windows'} on this wall <span class="pe-area">${ftin(L)} wall</span></h3>
    <div class="pe-wd">${kind === 'window' ? num('opN', 'How many', o.n, 1, 8, 1, 'Auto') : ''}${num('opW', 'Width (ft)', o.w, kind === 'door' ? 2 : 1.5, Math.floor(L), .5, kind === 'door' ? (w.ext ? '3' : '2.67') : 'Auto')}${num('opH', 'Height (ft)', o.h, kind === 'door' ? 6 : 1, 9.5, .5, kind === 'door' ? '6.67' : 'Auto')}${kind === 'window' ? num('opS', 'Sill (ft)', o.sill, 0, 6, .5, '2.3') : ''}</div>
    ${kind === 'door' || (o.n || 1) === 1 ? `<label class="fld">Position along the wall <input id="opP" type="range" min="0" max="100" value="${o.pos == null ? 50 : Math.round(o.pos * 100)}"></label>` : ''}
    <div class="pe-row"><button class="btn" id="opReset" type="button">Reset to auto</button></div>${kind === 'door' && L >= 6 ? '<p class="pe-note">Wider than 5\'-6" on an outside wall becomes a sliding door.</p>' : ''}`;
  const set = (k, v) => { pushHist(); BM.ops = BM.ops || {}; const cur = { ...(BM.ops[opKey()] || {}) }; if (v === null || Number.isNaN(v)) delete cur[k]; else cur[k] = v; BM.ops[opKey()] = cur; planChanged(); };
  for (const [id, k] of [['opN', 'n'], ['opW', 'w'], ['opH', 'h'], ['opS', 'sill']]) { const i = el.querySelector('#' + id); if (i) i.onchange = () => set(k, i.value === '' ? null : +i.value); }
  const p = el.querySelector('#opP'); if (p) { p.oninput = () => { BM.ops = BM.ops || {}; BM.ops[opKey()] = { ...(BM.ops[opKey()] || {}), pos: +p.value / 100 }; peDraw(); clearTimeout(p.t); p.t = setTimeout(() => planChanged(false), 200); }; p.onpointerdown = () => pushHist(); }
  el.querySelector('#opReset').onclick = () => { pushHist(); if (BM.ops) delete BM.ops[opKey()]; planChanged(); };
}

// ---------- roof style, pitch, site ----------
document.getElementById('pePlanPop').insertAdjacentHTML('beforeend', `
  <h6>Roof pitch <output id="pitchV" class="pop-out"></output></h6><input type="range" id="pitchR" min="3" max="12" step="1" class="pop-range">
  <h6>Site</h6>
  <label class="fld">Distance to the street (ft) <input id="stSet" type="number" min="15" max="200" step="1" placeholder="48"></label>
  <div class="pe-wd"><label class="fld">Lot width (ft) <input id="stLW" type="number" min="30" max="400" step="1" placeholder="None"></label><label class="fld">Lot depth (ft) <input id="stLD" type="number" min="30" max="600" step="1" placeholder="None"></label></div>
  <div class="pe-wd"><label class="fld">Shift on lot (ft) <input id="stOX" type="number" min="-100" max="100" step="1" placeholder="0"></label><label class="fld">Trees <input id="stTr" type="number" min="0" max="8" step="1" placeholder="4"></label></div>
  <h6>Flip the whole design</h6><div class="dm-row"><button class="btn" id="mirX" type="button">Left ↔ right</button><button class="btn" id="mirZ" type="button">Front ↔ back</button></div>`);
const roofSeg = document.querySelector('#pePlanPop [data-roof="flat"]').parentElement;
roofSeg.innerHTML = '<button type="button" data-roof="hip">Hip</button><button type="button" data-roof="gable">Gable</button><button type="button" data-roof="shed">Shed</button><button type="button" data-roof="flat">Flat</button>';
roofSeg.querySelectorAll('[data-roof]').forEach(b => b.onclick = () => { pushHist(); BM.roof = b.dataset.roof; peLvlButtons(); syncPlanPop(); planChanged(); });
function syncPlanPop() {
  const p = BM.pitch || (BM.style === 'batten' ? 7 : 5); document.getElementById('pitchR').value = p; document.getElementById('pitchV').textContent = `${p}:12`;
  document.getElementById('pitchR').disabled = BM.roof === 'flat';
  const S = BM.site || {}; for (const [id, k] of [['stSet', 'setback'], ['stLW', 'lotW'], ['stLD', 'lotD'], ['stOX', 'offsetX'], ['stTr', 'trees']]) { const i = document.getElementById(id); if (document.activeElement !== i) i.value = S[k] ?? ''; }
}
document.getElementById('pitchR').onpointerdown = () => pushHist();
document.getElementById('pitchR').oninput = e => { BM.pitch = +e.target.value; document.getElementById('pitchV').textContent = `${BM.pitch}:12`; clearTimeout(e.target.t); e.target.t = setTimeout(() => planChanged(false), 150); };
for (const [id, k] of [['stSet', 'setback'], ['stLW', 'lotW'], ['stLD', 'lotD'], ['stOX', 'offsetX'], ['stTr', 'trees']]) document.getElementById(id).onchange = e => { pushHist(); BM.site = { ...(BM.site || {}) }; if (e.target.value === '') delete BM.site[k]; else BM.site[k] = +e.target.value; planChanged(false); };
document.getElementById('mirX').onclick = () => mirrorPlan('x'); document.getElementById('mirZ').onclick = () => mirrorPlan('z');

// ---------- keys ----------
addEventListener('keydown', e => {
  if (!PE.open || e.target.closest?.('input,select,textarea') || mode === 'walk') return;
  const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (mod && k === 'c') { e.preventDefault(); copySel(); }
  else if (mod && k === 'v') { e.preventDefault(); pasteClip(); }
  else if (mod && k === 'a') { e.preventDefault(); PE.multi = new Set(lvRooms().map(r => r.id)); PE.sel = null; PE.selX = null; peInspector(); peDraw(); }
  else if ((k === 'delete' || k === 'backspace') && (PE.multi.size > 1 || PE.selX)) { e.preventDefault(); deleteSel(); }
  else if (k === 'escape' && (PE.tool || PE.multi.size || PE.selX)) { setTool(null); PE.multi.clear(); selectX(null); }
  else if (!mod && k === 'r' && curItem()) { pushHist(); curItem().rot = (curItem().rot + 1) % 4; planChanged(); }
  else if (!mod && e.key.startsWith('Arrow') && (curItem() || curNote())) { e.preventDefault(); e.stopImmediatePropagation(); const t = curItem() || curNote(), st = e.shiftKey ? 2 : .5; pushHist();
    t.x += e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0; t.z += e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0; planChanged(); }
  else if (!mod && e.key.startsWith('Arrow') && PE.multi.size > 1) { e.preventDefault(); e.stopImmediatePropagation(); const st = e.shiftKey ? 2 : .5; pushHist();
    for (const r of BM.rooms.filter(r => PE.multi.has(r.id))) { r.x = +(r.x + (e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0)).toFixed(2); r.z = +(r.z + (e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0)).toFixed(2); } planChanged(); }
}, true);
