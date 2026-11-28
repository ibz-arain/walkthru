
// =====================================================================
//  DESIGNER TOOLS — furniture you place by hand, notes, dimension lines, multi-select (align, copy, paste),
//  mirror, door and window sizes, roof style and pitch, and site settings. Everything lives in BM:
//  BM.items, BM.notes, BM.dims, BM.ops (opening sizes per wall), BM.pitch, BM.site.
// =====================================================================
PE.multi = new Set(); PE.selX = null; PE.tool = null;
const NIL = () => .5; // furniture helpers that want a random source get a fixed one, so pieces look the same every rebuild
// kind: [name, width, depth, plan colour, build(group, y)] — built facing +z (toward the back of the plan), centred on 0,0.
const BOOKS2 = [std({ color: '#8a3b33', roughness: .9 })];
const fabOf = it => it?.color ? finMat(M.fabric, it.color) : undefined; // optional fabric colour per placed piece
const CATALOG = {
  sofa: ['Sofa', 7.5, 3.2, '#8d9091', (g, y, it) => { const w = (it?.w || 7.5) / 2; sofa(g, [-w, w, -1.6, 1.6], y, 'n', fabOf(it)); }],
  sectional: ['Sectional sofa', 9.5, 7, '#8d9091', (g, y, it) => { sofa(g, [-4.75, 4.75, -3.5, -.3], y, 'n', fabOf(it)); sofa(g, [-4.75, -1.55, -.3, 3.5], y, 'w', fabOf(it)); }],
  art: ['Wall art', 4, .4, '#d9663f', (g, y, it) => art(g, 0, -.2, y + (it?.y ?? 4.2), it?.w || 4, it?.h || 3, () => it?.pick ?? .1, 'x', 1)],
  pendant: ['Pendant light', 2, 2, '#1b1c1e', (g, y, it) => { const top = y + (it?.top ?? 8.8), drop = it?.drop ?? 1.5; for (const dx of it?.n === 3 ? [-2.2, 0, 2.2] : [0]) pendant(g, dx, 0, top, drop, .8); }],
  walltv: ['TV, wall-mounted', 5, .3, '#0d0e10', (g, y, it) => { const w = (it?.w || 5) / 2, yb = y + (it?.y ?? 4), h = w * 1.125; box(g, -w, w, yb, yb + h, -.15, .05, M.tv); box(g, -w + .06, w - .06, yb + .06, yb + h - .06, .05, .06, M.black); }],
  sidetable: ['Side table and lamp', 1.8, 1.8, '#5e4330', (g, y) => { cyl(g, 0, 0, .9, y + 1.8, y + 1.95, M.walnut, 20); cyl(g, 0, 0, .12, y, y + 1.8, M.black, 8); cyl(g, 0, 0, .3, y + 1.95, y + 3.1, M.porcelain, 12, { r2: .35 }); cyl(g, 0, 0, .55, y + 3.1, y + 3.8, M.bulb, 16, { r2: .4 }); }],
  ottoman: ['Ottoman', 2.4, 2.4, '#8d9091', (g, y, it) => { bx(g, [-1.2, 1.2, -1.2, 1.2], y + .3, y + 1.4, fabOf(it) || M.leather, { solid: true }); for (const [a, b] of [[-1, -.85], [.85, 1]]) for (const [c, d] of [[-1, -.85], [.85, 1]]) box(g, a, b, y, y + .3, c, d, M.black); }],
  console: ['Console table', 5, 1.4, '#5e4330', (g, y, it) => { table(g, [-2.5, 2.5, -.7, .7], y, 2.6, M.walnut); box(g, -2.3, -1.6, y + 2.6, y + 3.3, -.3, .3, BOOKS2[0]); cyl(g, 1.4, 0, .25, y + 2.6, y + 3.8, M.porcelain, 12, { r2: .18 }); }],
  fireplace: ['Fireplace wall', 8, 1.4, '#9a968f', (g, y, it) => fireplaceWall(g, [-4, 4, -.7, .7], y, y + (it?.h || 9), 's', [-2.4, 2.4, .7, .74])],
  loveseat: ['Loveseat', 5.5, 3.2, '#8d9091', (g, y, it) => sofa(g, [-2.75, 2.75, -1.6, 1.6], y, 'n', fabOf(it))],
  armchair: ['Armchair', 2.8, 2.8, '#5d6b74', (g, y, it) => armchair(g, 0, 0, y, 's', fabOf(it) || M.fabric2)],
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
  rug: ['Rug', 8, 5.5, '#c3b9a9', (g, y, it) => { const w = (it?.w || 8) / 2, d = (it?.d || 5.5) / 2; rug(g, [-w, w, -d, d], y + .01, it?.color ? finMat(M.rug, it.color) : undefined); }],
  plant: ['Plant', 1.6, 1.6, '#4f7a37', (g, y) => plant(g, 0, 0, y, NIL)],
  lamp: ['Floor lamp', 1.2, 1.2, '#2a2b2c', (g, y) => floorLamp(g, 0, 0, y)],
  piano: ['Piano', 5, 2.2, '#1b1c1e', (g, y) => { box(g, -2.5, 2.5, y, y + 4.2, -1.1, .2, M.black, { solid: true }); box(g, -2.5, 2.5, y + 2.3, y + 2.6, .2, 1.1, M.black); box(g, -2.3, 2.3, y + 2.6, y + 2.7, .3, 1, M.porcelain); }],
  // ----- kitchen: cabinets and appliances (back against a wall on −z, doors facing +z) -----
  base: ['Base cabinets', 4, 2, '#f2f2ef', (g, y, it) => { const w = (it?.w || 4) / 2; lowerCab(g, [-w, w, -1, 1], y, 's'); }],
  sinkbase: ['Sink cabinet', 3, 2, '#f2f2ef', (g, y, it) => { const w = (it?.w || 3) / 2; lowerCab(g, [-w, w, -1, 1], y, 's'); sink(g, 0, .05, y + 3.13); }],
  upper: ['Upper cabinets', 4, 1.1, '#e6e6e2', (g, y, it) => { const w = (it?.w || 4) / 2; upperCab(g, [-w, w, -.55, .55], y + 4.6, y + 7.4); for (let x = -w + 1; x < w - .1; x += 1) box(g, x - .02, x + .02, y + 4.65, y + 7.35, .55, .57, M.black, { cast: false }); }],
  tall: ['Pantry cabinet', 2, 2, '#f2f2ef', (g, y, it) => { const w = (it?.w || 2) / 2; box(g, -w, w, y, y + 7.5, -1, 1, M.cab, { solid: true }); box(g, -.02, .02, y + .3, y + 7.3, 1, 1.02, M.black, { cast: false }); }],
  corner: ['Corner cabinet', 3, 3, '#f2f2ef', (g, y) => { lowerCab(g, [-1.5, 1.5, -1.5, -.5], y, 's'); lowerCab(g, [-1.5, -.5, -.5, 1.5], y, 'e'); }],
  fridge: ['Refrigerator', 3, 2.6, '#c9ccd0', (g, y) => { box(g, -1.5, 1.5, y, y + 5.9, -1.3, 1.3, M.steel, { solid: true }); box(g, -.03, .03, y + 2, y + 5.8, 1.3, 1.33, M.black, { cast: false }); for (const x of [-.25, .25]) box(g, x - .04, x + .04, y + 3.2, y + 4.8, 1.33, 1.42, M.black); }],
  range: ['Range, 30"', 2.5, 2.2, '#2d2f33', (g, y) => { box(g, -1.25, 1.25, y, y + 3, -1.1, 1.1, M.steel, { solid: true }); box(g, -1.2, 1.2, y + 3, y + 3.06, -1.05, 1.05, M.black); for (const [x, z] of [[-.6, -.5], [.6, -.5], [-.6, .45], [.6, .45]]) cyl(g, x, z, .32, y + 3.06, y + 3.1, M.metal, 20); box(g, -1.05, 1.05, y + .6, y + 2.3, 1.1, 1.13, M.black, { cast: false }); }],
  hood: ['Range hood', 2.5, 1.7, '#b9bdc1', (g, y) => { box(g, -1.25, 1.25, y + 5.4, y + 5.8, -.85, .85, M.steel); box(g, -.45, .45, y + 5.8, y + 8.6, -.85, -.1, M.steel); }],
  dishwasher: ['Dishwasher', 2, 2, '#c9ccd0', (g, y) => { box(g, -1, 1, y + .3, y + 2.9, -1, 1, M.steel, { solid: true }); box(g, -1, 1, y + 2.9, y + 3.03, -1, 1.08, M.counter); box(g, -.7, .7, y + 2.5, y + 2.58, 1, 1.08, M.black); }],
  walloven: ['Wall ovens', 2.5, 2.2, '#2d2f33', (g, y) => { box(g, -1.25, 1.25, y, y + 7.5, -1.1, 1.1, M.cab, { solid: true }); for (const yy of [2.2, 4.4]) box(g, -1.05, 1.05, y + yy, y + yy + 1.9, 1.1, 1.13, M.tv, { cast: false }); }],
  microwave: ['Microwave, built-in', 2, 1.4, '#2d2f33', (g, y) => { box(g, -1, 1, y + 4.6, y + 6, -.7, .7, M.tv); }],
  hottub: ['Hot tub', 7, 7, '#7cc3dc', (g, y) => { box(g, -3.5, 3.5, y, y + 3, -3.5, 3.5, M.deck, { solid: true }); box(g, -3, 3, y + 2.9, y + 2.95, -3, 3, M.water); }],
  // ----- the yard: placed on the main-floor plan, built on the ground (see OUTDOOR) -----
  treeS: ['Tree, small', 8, 8, '#4f7a37', (g, y, it) => { const k = (it?.w || 8) / 8; cyl(g, 0, 0, .35 * k, y, y + 6 * k, M.bark, 8, { solid: true }); crown(g, 0, y + 8.5 * k, 0, 4 * k, M.leaf, 1.15); }],
  treeL: ['Tree, large', 14, 14, '#3f6a2e', (g, y, it) => { const k = (it?.w || 14) / 14; cyl(g, 0, 0, .5 * k, y, y + 9 * k, M.bark, 8, { solid: true }); crown(g, 0, y + 13 * k, 0, 7 * k, M.leaf2, 1.15); }], // sized by w (starting trees vary)
  shrub: ['Shrub', 3, 3, '#5b8a3c', (g, y) => crown(g, 0, y + 1.1, 0, 1.4, M.leaf, .8)],
  pool: ['Pool', 14, 28, '#2f7fa3', (g, y, it) => { const w = (it?.w || 14) / 2, d = (it?.d || 28) / 2; // coping round the edge, tile under the water
    for (const [a0, a1, b0, b1] of [[-w, w, -d, -d + 1], [-w, w, d - 1, d], [-w, -w + 1, -d + 1, d - 1], [w - 1, w, -d + 1, d - 1]]) box(g, a0, a1, y, y + .25, b0, b1, M.white, { walk: true });
    flat(g, rect(-w + 1, w - 1, -d + 1, d - 1), [], y + .03, M.poolTile); flat(g, rect(-w + 1, w - 1, -d + 1, d - 1), [], y + .12, M.water); }],
  patio: ['Patio', 12, 12, '#bdb7ad', (g, y, it) => { const w = (it?.w || 12) / 2, d = (it?.d || 12) / 2; box(g, -w, w, y, y + .15, -d, d, M.pavers, { walk: true }); }],
  planter: ['Planter', 6, 2, '#6b6f72', (g, y, it) => { const w = (it?.w || 6) / 2, d = (it?.d || 2) / 2; box(g, -w, w, y, y + 1.6, -d, d, M.panel, { solid: true }); flat(g, rect(-w + .2, w - .2, -d + .2, d - .2), [], y + 1.61, M.bark);
    for (let x = -w + 1; x <= w - .9; x += 1.8) crown(g, x, y + 2.1, 0, .7, M.leaf2, .8); }],
  bed: ['Garden bed', 8, 3, '#8b7d6b', (g, y, it) => { const w = (it?.w || 8) / 2, d = (it?.d || 3) / 2; flat(g, rect(-w, w, -d, d), [], y + .06, M.bark);
    for (let x = -w + 1.2; x <= w - 1.1; x += 2.4) crown(g, x, y + .8, 0, Math.min(1, d * .7), M.leaf, .8); }],
  bbq: ['Grill', 4, 2, '#2d2f33', (g, y) => { box(g, -2, 2, y, y + 3, -1, 1, M.metal, { solid: true }); box(g, -1.6, 1.6, y + 3, y + 3.6, -.8, .8, M.black); }],
};
const ITEM_GROUPS = [['Living', ['sofa', 'sectional', 'loveseat', 'armchair', 'coffee', 'tvunit', 'walltv', 'fireplace', 'rug', 'art', 'sidetable', 'ottoman', 'console', 'pendant', 'piano']], ['Bedroom', ['queen', 'king', 'single', 'crib', 'dresser', 'wardrobe']],
  ['Kitchen', ['base', 'sinkbase', 'corner', 'upper', 'tall', 'fridge', 'range', 'hood', 'dishwasher', 'walloven', 'microwave', 'island']], ['Dining', ['dining6', 'round4']], ['Bath & laundry', ['tub', 'vanity', 'toilet', 'washer']], ['Work & decor', ['desk', 'bookcase', 'plant', 'lamp']], ['Yard', ['treeS', 'treeL', 'shrub', 'pool', 'patio', 'planter', 'bed', 'hottub', 'bbq']]];
// Yard pieces: always on the ground, always shown on the main-floor plan, sized by width and depth.
const OUTDOOR = new Set(['treeS', 'treeL', 'shrub', 'pool', 'patio', 'planter', 'bed']), RESIZE2 = new Set(['pool', 'patio', 'planter', 'bed']);
function crown(g, x, y, z, r, mat, sy) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat); m.position.set(x, y, z); m.scale.y = sy; m.castShadow = true; g.add(m); return m; }
const RESIZABLE = new Set(['base', 'sinkbase', 'upper', 'tall']), WALL_ITEMS = new Set(['base', 'sinkbase', 'upper', 'tall', 'corner', 'fridge', 'range', 'hood', 'dishwasher', 'walloven', 'microwave', 'wardrobe', 'dresser', 'bookcase', 'tvunit', 'vanity', 'toilet', 'washer', 'tub', 'piano', 'desk']);
const itemDims = it => { const c = CATALOG[it.kind], w = it.w || c[1], d = it.d || c[2]; return it.rot % 2 ? [d, w] : [w, d]; };

// 3D: builder.js calls this at the end of buildHouse3.
function placeItems() {
  const furn = new Proxy({}, { get: (_, k) => lvOf(k) ? LG(k).furn : null });
  for (const it of BM.items || []) {
    const c = CATALOG[it.kind]; if (!c || !furn[it.level]) continue;
    // yard pieces, and anything set down outside the main floor's rooms, stand on the ground, not at floor height in mid-air
    const inRoom = BM.rooms.some(r => r.level === it.level && it.x > r.x && it.x < r.x + r.w && it.z > r.z && it.z < r.z + r.d);
    const ground = OUTDOOR.has(it.kind) || (it.level === 'M' && !inRoom);
    const g = new THREE.Group(); g.position.set(it.x, 0, it.z); g.rotation.y = -(it.rot || 0) * Math.PI / 2; g.scale.set(.996, 1, .996); // a hair smaller, so pieces pushed together don't share faces and flicker
    const before = walkables.length; c[4](g, ground ? 0 : LV_Y[it.level], it); walkables.splice(before);
    g.userData.item = it.id; (ground ? G3.site : furn[it.level]).add(g); // tagged so a right-click in 3D finds the piece
  }
}

// ---------- library: furniture section ----------
document.getElementById('pePalette').insertAdjacentHTML('beforeend', ITEM_GROUPS.map(([g, ks]) => `<h3>${g}</h3>` + ks.map(k => `<button type="button" data-item="${k}"><i style="background:${CATALOG[k][3]};border-radius:50%"></i>${CATALOG[k][0]}</button>`).join('')).join(''));
document.getElementById('pePalette').insertAdjacentHTML('afterbegin', '<h3 class="lib-tab">Rooms</h3>');
const furnHead = [...document.querySelectorAll('#pePalette h3')].find(h => h.textContent === 'Living' && h.nextElementSibling?.dataset.item); furnHead?.insertAdjacentHTML('beforebegin', '<h3 class="lib-tab">Furniture</h3>');
function viewCentre() { const r = pc.getBoundingClientRect(); return S2W(r.width / 2, r.height / 2); }
function addItem(kind, at) {
  pushHist(); const host = BM.rooms.find(r => r.id === PE.sel && r.level === PE.lv);
  const [x, z] = at || (host ? [host.x + host.w / 2, host.z + host.d / 2] : viewCentre());
  const it = { id: BID++, kind, level: OUTDOOR.has(kind) ? 'M' : PE.lv, x: snapH(x), z: snapH(z), rot: 0 }; // the yard is drawn with the main floor
  (BM.items = BM.items || []).push(it); selectX({ kind: 'item', id: it.id }); planChanged();
}
document.querySelectorAll('[data-item]').forEach(b => {
  let st = null, ghost = null;
  b.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, moved: false }; try { b.setPointerCapture(e.pointerId); } catch (er) { } });
  b.addEventListener('pointermove', e => { if (!st) return; if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 5) { st.moved = true; ghost = document.createElement('div'); ghost.id = 'pegDrop'; ghost.textContent = CATALOG[b.dataset.item][0]; ghost.style.background = CATALOG[b.dataset.item][3]; ghost.style.color = '#111'; document.body.appendChild(ghost); }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; } });
  b.addEventListener('pointerup', e => { const s0 = st; st = null; ghost?.remove(); ghost = null; if (!s0) return; if (!s0.moved) return addItem(b.dataset.item);
    const r = pc.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; addItem(b.dataset.item, S2W(planX(e, r), planY(e, r))); });
});

// ---------- selection of items / notes / dimensions ----------
function selectX(x) { PE.selX = x; if (x) { PE.sel = null; PE.selStair = null; PE.selWall = null; PE.multi.clear(); } peInspector(); peDraw(); }
const curItem = () => PE.selX?.kind === 'item' && (BM.items || []).find(i => i.id === PE.selX.id);
const curNote = () => PE.selX?.kind === 'note' && (BM.notes || []).find(i => i.id === PE.selX.id);
// Furniture lives in the 3D view: the plan only shows it with Plan settings → Furniture on, or the piece you're placing right now.
const itemOnPlan = it => PE.furn || OUTDOOR.has(it.kind) || (PE.selX?.kind === 'item' && PE.selX.id === it.id);
function itemAt(wx, wz) { const L = (BM.items || []).filter(i => i.level === PE.lv && itemOnPlan(i)); for (let k = L.length - 1; k >= 0; k--) { const it = L[k], [w, d] = itemDims(it); if (Math.abs(wx - it.x) < w / 2 && Math.abs(wz - it.z) < d / 2) return it; } return null; }
function noteAt(sx, sy) { return (BM.notes || []).find(n => { if (n.level !== PE.lv) return false; const [a, b] = W2S(n.x, n.z); return sx > a - 8 && sx < a + 8 + (n._w || 60) && sy > b - 22 && sy < b + 8; }); }
function dimAt(sx, sy) {
  return (BM.dims || []).find(d => { if (d.level !== PE.lv) return false; const [a, b] = W2S(d.x1, d.z1), [c, e] = W2S(d.x2, d.z2), L2 = (c - a) ** 2 + (e - b) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((sx - a) * (c - a) + (sy - b) * (e - b)) / L2)); return Math.hypot(sx - (a + t * (c - a)), sy - (b + t * (e - b))) < 7; });
}
// editor.js asks these first; returning true means the event was handled here.
function peToolDown(e, sx, sy, wx, wz) {
  if (e.button !== 0) return false;
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
  if (D.kind === 'itemMove') { D.it.x = snapH(wx - D.dx); D.it.z = snapH(wz - D.dz); if (WALL_ITEMS.has(D.it.kind) && !e.altKey) snapToWall(D.it); peDraw(); return true; }
  if (D.kind === 'noteMove') { D.n.x = snapH(wx - D.dx); D.n.z = snapH(wz - D.dz); peDraw(); return true; }
  return false;
}
function peToolUp() {
  const D = PE.drag; if (!D || !['dimNew', 'itemMove', 'noteMove'].includes(D.kind)) return false; PE.drag = null;
  if (D.kind === 'dimNew') { setTool(null); if (Math.hypot(D.x2 - D.x1, D.z2 - D.z1) >= 1) { pushHist(); const d = { id: BID++, level: PE.lv, x1: D.x1, z1: D.z1, x2: D.x2, z2: D.z2 }; (BM.dims = BM.dims || []).push(d); selectX({ kind: 'dim', id: d.id }); planChanged(); } else peDraw(); return true; }
  if (D.before !== snapshot()) { PE.hist.push(D.before); PE.redo = []; planChanged(); } else peDraw();
  return true;
}
function setTool(t) { PE.tool = t; document.getElementById('peDimBtn').setAttribute('aria-pressed', String(t === 'dim')); pc.style.cursor = t ? 'crosshair' : ''; }
document.getElementById('peDimBtn').onclick = () => setTool(PE.tool === 'dim' ? null : 'dim');

// ---------- drawing (called at the end of peDraw) ----------
function peDrawExtras(s) {
  px.save(); px.textBaseline = 'middle';
  for (const it of (BM.items || []).filter(i => i.level === PE.lv && itemOnPlan(i))) {
    const c = CATALOG[it.kind]; if (!c) continue; const [w, d] = itemDims(it), [a, b] = W2S(it.x - w / 2, it.z - d / 2), sel = PE.selX?.kind === 'item' && PE.selX.id === it.id;
    if (it.kind === 'treeS' || it.kind === 'treeL' || it.kind === 'shrub') { // seen from above: a round crown, the trunk in the middle
      const [cx, cy] = W2S(it.x, it.z), rr = Math.min(w, d) / 2 * s;
      px.beginPath(); px.arc(cx, cy, rr, 0, Math.PI * 2); px.fillStyle = c[3] + 'b0'; px.fill(); px.strokeStyle = sel ? css('--accent') : 'rgba(40,70,30,.9)'; px.lineWidth = sel ? 2.2 : 1; px.stroke();
      if (it.kind !== 'shrub') { px.beginPath(); px.arc(cx, cy, Math.max(1.5, .45 * s), 0, Math.PI * 2); px.fillStyle = '#5e4330'; px.fill(); }
      continue;
    }
    if (it.kind === 'pool') { // coping round the water
      px.fillStyle = '#e9e7e2'; px.fillRect(a, b, w * s, d * s); px.fillStyle = '#3f9fc6'; px.fillRect(a + s, b + s, (w - 2) * s, (d - 2) * s);
      px.strokeStyle = sel ? css('--accent') : 'rgba(17,17,20,.55)'; px.lineWidth = sel ? 2.2 : 1; px.strokeRect(a, b, w * s, d * s);
      if (w * s > 46 && d * s > 16) { px.fillStyle = '#ffffff'; px.font = '600 10px Inter, system-ui, sans-serif'; px.textAlign = 'center'; px.fillText('Pool', a + w * s / 2, b + d * s / 2); }
      continue;
    }
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
  if (PE.multi.size) { px.strokeStyle = css('--accent'); px.lineWidth = 2; px.setLineDash([5, 3]); for (const q of BM.rooms.filter(r => PE.multi.has(r.id) && r.level === PE.lv)) { traceRoom(q); px.stroke(); } px.setLineDash([]); }
  px.restore();
  if (PE.autoDims !== false) dimChains(px, W2S, PE.lv, css('--ink-2'));
}
function drawDim(d, sel) {
  const [a, b] = W2S(d.x1, d.z1), [c, e] = W2S(d.x2, d.z2), L = Math.hypot(d.x2 - d.x1, d.z2 - d.z1); if (L < .1) return;
  const nx = -(e - b) / Math.hypot(c - a, e - b), ny = (c - a) / Math.hypot(c - a, e - b), col = sel ? css('--accent') : '#c2410c';
  px.strokeStyle = col; px.fillStyle = col; px.lineWidth = 1.4; px.beginPath(); px.moveTo(a, b); px.lineTo(c, e);
  for (const [x, y] of [[a, b], [c, e]]) { px.moveTo(x + nx * 6, y + ny * 6); px.lineTo(x - nx * 6, y - ny * 6); px.moveTo(x - 4 * (ny + nx), y - 4 * (ny - nx)); px.lineTo(x + 4 * (ny + nx), y + 4 * (ny - nx)); }
  px.stroke(); const t = ftin(L); px.font = '600 11px "JetBrains Mono", monospace'; px.textAlign = 'center'; const tw = px.measureText(t).width + 8, mx = (a + c) / 2 + nx * 11, my = (b + e) / 2 + ny * 11;
  px.fillStyle = 'rgba(255,255,255,.95)'; px.fillRect(mx - tw / 2, my - 8, tw, 16); px.fillStyle = col; px.fillText(t, mx, my + .5);
}

// ---------- a room's furniture: Auto (laid out for you), Editable (real pieces you move, swap and delete) or None ----------
const itemsIn = r => (BM.items || []).filter(i => i.level === r.level && i.x > r.x && i.x < r.x + r.w && i.z > r.z && i.z < r.z + r.d);
const furnMode = r => r.nofurn ? (itemsIn(r).length ? 'edit' : 'off') : 'auto';
// A starter set of catalog pieces for the room (backs to the front wall unless noted; rot 0 faces the back of the plan).
function starterPieces(r) {
  const x0 = r.x, x1 = r.x + r.w, z0 = r.z, z1 = r.z + r.d, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = r.w, D = r.d, t = likeOf(r.type), out = [];
  const P = (kind, x, z, rot = 0, o = {}) => { const c = CATALOG[kind], [w, d] = rot % 2 ? [c[2], o.w || c[1]] : [o.w || c[1], c[2]]; if (w > W - .4 || d > D - .4) return; out.push({ kind, level: r.level, x: snapH(x), z: snapH(z), rot, ...o }); };
  if (t === 'bedroom' || t === 'primary') { const king = t === 'primary' || W >= 14, bw = king ? 6.6 : 5.2, bd = king ? 7.2 : 7;
    P('rug', cx, z0 + bd * .7, 0, { w: Math.min(W - 2, bw + 4), d: Math.min(D - 2, 6) }); P(king ? 'king' : 'queen', cx, z0 + .3 + bd / 2);
    if (W >= bw + 4.4) { P('sidetable', cx - bw / 2 - 1.1, z0 + 1.1); P('sidetable', cx + bw / 2 + 1.1, z0 + 1.1); }
    if (D >= bd + 4) P('dresser', cx, z1 - 1.1, 2); P('plant', x1 - 1, z1 - 1); return out; }
  if (['living', 'great', 'rec', 'sunroom', 'bonus', 'playroom'].includes(t)) { const sw = Math.min(9, W - 4);
    P('rug', cx, cz, 0, { w: Math.min(W - 3, 11), d: Math.min(D - 4, 8) }); P('tvunit', cx, z0 + .9); P('sofa', cx, Math.min(z1 - 1.8, z0 + 10), 2, { w: Math.max(5, sw) }); P('coffee', cx, (z0 + Math.min(z1 - 1.8, z0 + 10)) / 2 + .6);
    if (W >= 15) { P('armchair', x0 + 2, cz, 3); P('armchair', x1 - 2, cz, 1); } P('lamp', x1 - 1, z1 - 1); P('plant', x0 + 1, z1 - 1); return out; }
  if (t === 'dining') { const along = W >= D; P('rug', cx, cz, 0, { w: Math.min(W - 2, along ? 10 : 7.5), d: Math.min(D - 2, along ? 7.5 : 10) }); P('dining6', cx, cz, along ? 0 : 1); P('pendant', cx, cz, along ? 0 : 1); P('plant', x1 - 1, z1 - 1); return out; }
  if (t === 'kitchen') { P('fridge', x0 + 1.7, z0 + 1.3); P('range', x1 - 1.45, z0 + 1.1); const bw = (x1 - 2.8) - (x0 + 3.3); if (bw >= 2) P('base', (x0 + 3.3 + x1 - 2.8) / 2, z0 + 1, 0, { w: snapH(bw) });
    if (W >= 11 && D >= 12) P('island', cx, cz + 1); return out; }
  if (t === 'office') { P('rug', cx, cz + 1, 0, { w: Math.min(W - 2, 8), d: Math.min(D - 3, 6) }); P('desk', cx, z0 + 2.1); P('bookcase', x1 - .7, cz, 1); P('plant', x0 + 1, z1 - 1); return out; }
  if (t === 'bath') { P('vanity', x0 + 2.3, z0 + 1); P('toilet', x1 - 1.1, z0 + 1.3); if (r.type !== 'powder' && W >= 7 && D >= 8) P('tub', x0 + 3, z1 - 1.4); return out; }
  if (t === 'laundry') { P('washer', x0 + 3, z0 + 1.3); return out; }
  if (t === 'foyer' || t === 'mud' || t === 'hall') { if (W >= 6 && D >= 5) { P('console', cx, z0 + .8); P('plant', x1 - 1, z0 + 1); } return out; }
  return out;
}
function setFurnMode(r, mode) {
  pushHist(); const inRoom = new Set(itemsIn(r).map(i => i.id));
  if (mode !== 'edit' || !inRoom.size) BM.items = (BM.items || []).filter(i => !inRoom.has(i.id)); // switching modes clears the room's placed pieces
  if (mode === 'auto') delete r.nofurn; else r.nofurn = true;
  if (mode === 'edit' && !inRoom.size) { BM.items = BM.items || []; for (const p of starterPieces(r)) BM.items.push({ id: BID++, ...p }); }
  planChanged(); if (mode === 'edit') toast('Click a piece in the plan to move it, or right-click it to swap or delete');
}
document.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { const r = BM.rooms.find(q => q.id === PE.sel); if (r) setFurnMode(r, b.dataset.rf); });

// Right-click furniture in the 3D view beside the plan: a placed piece opens its own menu (swap, rotate, duplicate, delete);
// furniture laid out for you opens its room's menu, where it can be made editable or cleared.
const rc3f = new THREE.Raycaster(), v2f = new THREE.Vector2();
renderer.domElement.addEventListener('contextmenu', e => {
  if (!PE.open) return; e.preventDefault();
  const R = renderer.domElement.getBoundingClientRect(); v2f.set((e.clientX - R.left) / R.width * 2 - 1, -(e.clientY - R.top) / R.height * 2 + 1); rc3f.setFromCamera(v2f, camera);
  const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  for (const h of rc3f.intersectObjects(levelIds().map(l => LG(l).furn), true)) { if (!vis(h.object)) continue;
    let o = h.object; while (o && o.userData.item == null && o.userData.room == null) o = o.parent; if (!o) continue;
    const it = o.userData.item != null && (BM.items || []).find(i => i.id === o.userData.item), rm = !it && BM.rooms.find(q => q.id === o.userData.room); if (!it && !rm) continue;
    PE.lv = (it || rm).level; peLvlButtons(); PE.sel = null; PE.selStair = null; PE.selWall = null; PE.multi.clear();
    if (it) selectX({ kind: 'item', id: it.id }); else { PE.selX = null; PE.sel = rm.id; }
    PE.menu = true; pePt = [e.clientX, e.clientY]; peInspector(); peDraw(); requestAnimationFrame(pePlaceSide); return; }
});

// ---------- inspector for items, notes, dimensions and several rooms ----------
document.getElementById('peSide').insertAdjacentHTML('beforeend', '<div id="peX" class="pe-card" hidden></div>');
function peExtraInspector() {
  roomFinishPanel();
  { const r = BM.rooms.find(q => q.id === PE.sel); if (r) { const m = furnMode(r); document.querySelectorAll('[data-rf]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rf === m))); document.getElementById('peAutoFurn').hidden = m !== 'auto'; } }
  const el = document.getElementById('peX'), it = curItem(), n = curNote(), multi = BM.rooms.filter(r => PE.multi.has(r.id));
  if (multi.length > 1) {
    el.hidden = false; const sf = Math.round(multi.reduce((a, q) => a + q.w * q.d, 0));
    el.innerHTML = `<h3>${multi.length} rooms <span class="pe-area">${fmtArea(sf)}</span></h3>
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
      ${RESIZABLE.has(it.kind) || RESIZE2.has(it.kind) ? `<label class="fld"><span>Width (${U_LEN()})</span> <input id="ixW" type="number" step="any" value="${toDisp(it.w || c[1])}"></label>` : ''}${RESIZE2.has(it.kind) ? `<label class="fld"><span>Depth (${U_LEN()})</span> <input id="ixD" type="number" step="any" value="${toDisp(it.d || c[2])}"></label>` : ''}<div class="pe-row"><button class="btn" id="ixRot" title="R">Rotate</button><button class="btn" id="ixDup">Duplicate</button><button class="btn danger" id="ixDel">Delete</button></div>`;
    el.querySelector('#ixKind').onchange = e => { pushHist(); it.kind = e.target.value; planChanged(); };
    const most = RESIZE2.has(it.kind) ? 60 : 16; // a pool or patio can be far bigger than a cabinet run
    el.querySelector('#ixW')?.addEventListener('change', e => { const v = fromDisp(+e.target.value); if (!(v >= 1 && v <= most)) return; pushHist(); it.w = snapH(v); planChanged(); });
    el.querySelector('#ixD')?.addEventListener('change', e => { const v = fromDisp(+e.target.value); if (!(v >= 1 && v <= most)) return; pushHist(); it.d = snapH(v); planChanged(); });
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
  for (const r of BM.rooms) if (r.finish?.accent) r.finish.accent.side = (X ? { w: 'e', e: 'w' } : { n: 's', s: 'n' })[r.finish.accent.side] || r.finish.accent.side;
  for (const s of BM.stairs || []) { if (X) s.cx = f(s.cx); else s.cz = f(s.cz); if (s.dir) s.dir = swapOut(s.dir); }
  if (X && BM.site?.corner) BM.site.corner = BM.site.corner === 'left' ? 'right' : 'left'; // the side street flips with the house
  for (const it of BM.items || []) { if (X) it.x = f(it.x); else it.z = f(it.z); it.rot = X ? (4 - (it.rot || 0)) % 4 : (6 - (it.rot || 0)) % 4; }
  for (const n of BM.notes || []) { if (X) n.x = f(n.x); else n.z = f(n.z); }
  for (const d of BM.dims || []) { if (X) { d.x1 = f(d.x1); d.x2 = f(d.x2); } else { d.z1 = f(d.z1); d.z2 = f(d.z2); } }
  for (const k of ['ext', 'ops']) if (BM[k]) BM[k] = Object.fromEntries(Object.entries(BM[k]).map(([key, v]) => { const m = key.match(/^(\d+):(.+)$/); return [m ? `${m[1]}:${swapOut(m[2])}` : key, v]; }));
  if (BM.extras?.gables) for (const g of BM.extras.gables) { if (X) [g.x0, g.x1] = [f(g.x1), f(g.x0)]; else [g.z0, g.z1] = [f(g.z1), f(g.z0)]; }
  planChanged(); toast(X ? 'Flipped left to right' : 'Flipped front to back');
}

// ---------- door and window sizes on the selected wall ----------
const DOOR_COLORS = [['#f6f6f3', 'White'], ['#1d1e20', 'Black'], ['#4a4e54', 'Charcoal'], ['#7a563c', 'Walnut'], ['#c69c6d', 'Oak'], ['#2f4a6b', 'Navy'], ['#5f7a5c', 'Sage'], ['#9b3b32', 'Red'], ['#d9b44a', 'Mustard']];
document.getElementById('peWall').insertAdjacentHTML('beforeend', '<div id="peOp" hidden></div>');
function opKey() { const w = PE.selWall; if (!w) return null; return w.ext ? extKey(w.R, w.out) : pairKey(w.A, w.B); }
function peOpPanel() {
  const w = PE.selWall, el = document.getElementById('peOp'); if (!w) { el.hidden = true; return; }
  const isFront = w.ext && planLevel(w.R.level).some(x => x.front && x.room === w.R && x.out === w.out);
  const mode = w.ext ? extMode(w.R, w.out) : wallMode(w.A, w.B), kind = mode === 'window' ? 'window' : mode === 'door' || isFront ? 'door' : null;
  if (!kind || (w.ext && belowGrade(w.R.level) && kind === 'window')) { el.hidden = true; return; }
  const o = BM.ops?.[opKey()] || {}, L = w.b - w.a, num = (id, label, v, min, max, step, ph, len = true) => `<label class="fld" for="${id}">${label}${len ? ` (${U_LEN()})` : ''} <input id="${id}" type="number" min="${len ? toDisp(min) : min}" max="${len ? toDisp(max) : max}" step="any" value="${v == null ? '' : len ? toDisp(v) : v}" placeholder="${len && ph !== 'Auto' ? toDisp(+ph) : ph}"></label>`;
  el.hidden = false;
  el.innerHTML = `<h3 style="font-weight:500;font-size:11.5px;color:var(--ink-3);margin-top:12px">${kind === 'door' ? 'Door' : 'Windows'} on this wall <span class="pe-area">${ftin(L)} wall</span></h3>
    <div class="pe-wd">${kind === 'window' ? num('opN', 'How many', o.n, 1, 8, 1, 'Auto', false) : ''}${num('opW', 'Width', o.w, kind === 'door' ? 2 : 1.5, Math.floor(L), .5, kind === 'door' ? (w.ext ? '3' : '2.67') : 'Auto')}${num('opH', 'Height', o.h, kind === 'door' ? 6 : 1, 9.5, .5, kind === 'door' ? '6.67' : 'Auto')}${kind === 'window' ? num('opS', 'Sill', o.sill, 0, 6, .5, '2.3') : ''}</div>
    <label class="fld">Style <select id="opSt">${(kind === 'window' ? [['casement', 'Casement'], ['doublehung', 'Double-hung'], ['slider', 'Sliding'], ['picture', 'Picture'], ['awning', 'Awning'], ['grid', 'Divided lites'], ['transom', 'With transom']]
      : w.ext ? [['', 'Auto'], ['single', 'Single'], ['double', 'Double'], ['french', 'French'], ['slider', 'Sliding']]
      : [['single', 'Single'], ['double', 'Double'], ['french', 'French'], ['pocket', 'Pocket'], ['barn', 'Barn'], ['bifold', 'Bifold'], ['cased', 'Cased opening']]).map(([v, n]) => `<option value="${v}" ${(o.style || (kind === 'window' ? 'casement' : w.ext ? '' : 'single')) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${kind === 'door' && !['double', 'french', 'bifold', 'cased', 'slider'].includes(o.style) && !(isFront && !o.style && (w.b - w.a) >= 7.5) ? `<div class="seg full pe-wm"><button type="button" data-hinge="a" aria-pressed="${o.hinge !== 'b'}">Hinge left</button><button type="button" data-hinge="b" aria-pressed="${o.hinge === 'b'}">Hinge right</button></div>` : ''}
    ${kind === 'door' && !['pocket', 'barn', 'cased', 'slider'].includes(o.style) ? `<div class="seg full pe-wm"><button type="button" data-swing="in" aria-pressed="${w.ext ? !o.out : !o.flip}">${w.ext ? 'Swings in' : 'Swing this side'}</button><button type="button" data-swing="out" aria-pressed="${w.ext ? !!o.out : !!o.flip}">${w.ext ? 'Swings out' : 'Other side'}</button></div>` : ''}
    ${kind === 'door' || (o.n || 1) === 1 ? `<label class="fld">Position along the wall <input id="opP" type="range" min="0" max="100" value="${o.pos == null ? 50 : Math.round(o.pos * 100)}"></label>` : ''}
    ${kind === 'door' && o.style !== 'cased' ? `<div class="fld fld-stack">Door colour <div class="chips"><button type="button" data-dc="" class="def" aria-pressed="${!o.color}" title="Default" aria-label="Default"></button>${DOOR_COLORS.map(([c, n]) => `<button type="button" data-dc="${c}" title="${n}" aria-pressed="${o.color === c}" style="background:${c}"></button>`).join('')}<label class="chip-c" title="Any colour"><input type="color" id="dcC" value="${o.color || '#f6f6f3'}"></label></div></div>` : ''}
    <div class="pe-row"><button class="btn" id="opReset" type="button">Reset to auto</button></div>`;
  const set = (k, v) => { pushHist(); BM.ops = BM.ops || {}; const cur = { ...(BM.ops[opKey()] || {}) }; if (v === null || Number.isNaN(v)) delete cur[k]; else cur[k] = v; BM.ops[opKey()] = cur; planChanged(); };
  for (const [id, k] of [['opN', 'n'], ['opW', 'w'], ['opH', 'h'], ['opS', 'sill']]) { const i = el.querySelector('#' + id); if (i) i.onchange = () => set(k, i.value === '' ? null : k === 'n' ? +i.value : +fromDisp(+i.value).toFixed(3)); }
  const p = el.querySelector('#opP'); if (p) { p.oninput = () => { BM.ops = BM.ops || {}; BM.ops[opKey()] = { ...(BM.ops[opKey()] || {}), pos: +p.value / 100 }; peDraw(); clearTimeout(p.t); p.t = setTimeout(() => planChanged(false), 200); }; p.onpointerdown = () => pushHist(); }
  el.querySelector('#opSt').onchange = e => set('style', e.target.value || null);
  el.querySelectorAll('[data-hinge]').forEach(b => b.onclick = () => set('hinge', b.dataset.hinge === 'b' ? 'b' : null));
  el.querySelectorAll('[data-swing]').forEach(b => b.onclick = () => set(w.ext ? 'out' : 'flip', b.dataset.swing === 'out' ? true : null));
  el.querySelectorAll('[data-dc]').forEach(b => b.onclick = () => set('color', b.dataset.dc || null));
  el.querySelector('#dcC')?.addEventListener('change', e => set('color', e.target.value));
  el.querySelector('#opReset').onclick = () => { pushHist(); if (BM.ops) delete BM.ops[opKey()]; planChanged(); };
}

// ---------- roof style, pitch, site ----------
document.getElementById('pePlanPop').insertAdjacentHTML('beforeend', `
  <h6>Roof pitch <output id="pitchV" class="pop-out"></output></h6><input type="range" id="pitchR" min="2" max="12" step="1" class="pop-range">
  <h6>Overhang <output id="ovV" class="pop-out"></output></h6><input type="range" id="ovR" min="0" max="3" step=".25" class="pop-range">
  <h6>Roof edge</h6>
  <div class="seg full" id="eaveF"><button type="button" data-eave-f="slim" title="A 1×6 fascia board">Slim</button><button type="button" data-eave-f="standard" title="A 1×8 fascia board">Standard</button><button type="button" data-eave-f="deep" title="A 1×10 fascia board">Deep</button></div>
  <div class="seg full" id="eaveG" style="margin-top:6px"><button type="button" data-eave-g="1" title="Gutters on the level eaves">Gutters</button><button type="button" data-eave-g="0" title="A bare fascia, no gutters">No gutters</button></div>
  <div class="fld fld-stack" style="margin-top:6px">Fascia and gutter colour <div class="chips" id="eaveC">${Object.entries(EDGE_COLORS).map(([k, c]) => `<button type="button" data-eave-c="${k}" title="${k[0].toUpperCase() + k.slice(1)}" style="background:${c}"></button>`).join('')}</div></div>
  <h6>Site</h6>
  <label class="fld"><span>Distance to the street (<span class="u-len">ft</span>)</span> <input id="stSet" type="number" step="any"></label>
  <div class="fld fld-stack">Corner lot <div class="seg full" id="stCorner"><button type="button" data-corner="">No</button><button type="button" data-corner="left" title="A side street down the left">Street on the left</button><button type="button" data-corner="right" title="A side street down the right">On the right</button></div></div>
  <div id="stCornerMore"><div class="fld fld-stack">Driveway to <div class="seg full" id="stDrive"><button type="button" data-drive="front">Front street</button><button type="button" data-drive="side" title="The garage door faces the side street, with the front door still on the front">Side street</button></div></div>
  <label class="fld"><span>Distance to the side street (<span class="u-len">ft</span>)</span> <input id="stSide" type="number" step="any" placeholder="24"></label></div>
  <div class="pe-wd"><label class="fld"><span>Lot width (<span class="u-len">ft</span>)</span> <input id="stLW" type="number" step="any" placeholder="None"></label><label class="fld"><span>Lot depth (<span class="u-len">ft</span>)</span> <input id="stLD" type="number" step="any" placeholder="None"></label></div>
  <div class="pe-wd"><label class="fld"><span>Shift on lot (<span class="u-len">ft</span>)</span> <input id="stOX" type="number" step="any" placeholder="0"></label><label class="fld">Trees <input id="stTr" type="number" min="0" max="8" step="1" placeholder="0"></label></div>
  <h6>Flip the whole design</h6><div class="dm-row"><button class="btn" id="mirX" type="button">Left ↔ right</button><button class="btn" id="mirZ" type="button">Front ↔ back</button></div>`);
const roofSeg = document.querySelector('#pePlanPop [data-roof="flat"]').parentElement;
roofSeg.innerHTML = '<button type="button" data-roof="hip" title="Slopes on every side, worked out from the whole outline">Auto</button><button type="button" data-roof="gable" title="Gable walls at the ends of each wing">Gable</button><button type="button" data-roof="shed" title="One slope rising toward the back">Shed</button><button type="button" data-roof="flat">Flat</button>';
roofSeg.querySelectorAll('[data-roof]').forEach(b => b.onclick = () => { pushHist(); BM.roof = b.dataset.roof; peLvlButtons(); syncPlanPop(); planChanged(); });
// ---------- levels: how the house sits in the ground and how tall each storey is ----------
const LEVEL_SLIDERS = [['lvMain', 'main', 'Main floor above ground', .5, 6, .25], ['lvMainH', 'mainH', 'Main floor ceiling', 8, 12, .5], ['lvUpH', 'upH', '2nd floor ceiling', 7.5, 10, .5], ['lvBaseH', 'baseH', 'Basement ceiling', 7, 10, .5]];
document.getElementById('pePlanPop').insertAdjacentHTML('afterbegin', `<h6>Levels</h6>
  <div class="seg full" id="lvPreset">${Object.entries(LEVEL_PRESETS).map(([k, [n, , t]]) => `<button type="button" data-lvp="${k}" title="${t}">${n}</button>`).join('')}</div>
  ${LEVEL_SLIDERS.map(([id, , label, min, max, step]) => `<h6>${label} <output id="${id}V" class="pop-out"></output></h6><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" class="pop-range">`).join('')}
  <p class="pop-note" id="lvNote"></p>`);
function setLevels(patch) { const L = { ...(BM.levels || {}), ...patch }; for (const k in L) if (Math.abs(L[k] - LEVELS_DEF[k]) < .01) delete L[k]; if (Object.keys(L).length) BM.levels = L; else delete BM.levels; }
function syncLevels() {
  const L = levelsOf(BM); for (const [id, k] of LEVEL_SLIDERS) { const el = document.getElementById(id); if (document.activeElement !== el) el.value = L[k]; document.getElementById(id + 'V').textContent = ftin(L[k]); }
  const pk = Object.entries(LEVEL_PRESETS).find(([, [, v]]) => Math.abs(v.main - L.main) < .01)?.[0];
  document.querySelectorAll('[data-lvp]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lvp === pk)));
  const exposed = L.main - 1.16, base = BM.rooms.some(r => r.level === 'B'); // top of the foundation above the ground, as in baseWin()
  document.getElementById('lvNote').textContent = L.main < .8 ? 'Slab on grade: the main floor is a step above the ground.' + (base ? ' The basement sits fully underground.' : '')
    : !base ? `Main floor ${ftin(L.main)} above the ground.` : exposed >= 3.5 ? `The basement stands ${ftin(Math.min(exposed, L.baseH))} out of the ground, with full-size windows.` : 'The basement is below ground, with small windows near the ceiling.';
}
document.querySelectorAll('[data-lvp]').forEach(b => b.onclick = () => { pushHist(); setLevels({ ...LEVELS_DEF, ...LEVEL_PRESETS[b.dataset.lvp][1] }); syncLevels(); planChanged(false); });
for (const [id, k] of LEVEL_SLIDERS) { const el = document.getElementById(id); el.onpointerdown = () => pushHist();
  el.oninput = () => { setLevels({ [k]: +el.value }); syncLevels(); clearTimeout(el.t); el.t = setTimeout(() => planChanged(false), 150); }; }
function syncPlanPop() {
  syncLevels();
  const p = BM.pitch || (BM.style === 'batten' ? 7 : 5); document.getElementById('pitchR').value = p; document.getElementById('pitchV').textContent = `${p}:12`;
  document.getElementById('pitchR').disabled = BM.roof === 'flat';
  { const e = BM.eave || {}, f = ROOF_EDGE[e.fascia] ? e.fascia : 'standard', g = e.gutter ?? ROOF_EDGE[f].gutter, c = EDGE_COLORS[e.color] ? e.color : 'black', flat = BM.roof === 'flat';
    document.querySelectorAll('[data-eave-f]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.eaveF === f)); b.disabled = flat; });
    document.querySelectorAll('[data-eave-g]').forEach(b => { b.setAttribute('aria-pressed', String((b.dataset.eaveG === '1') === g)); b.disabled = flat; });
    document.querySelectorAll('[data-eave-c]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.eaveC === c))); }
  const ov = BM.ov ?? 1.5; document.getElementById('ovR').value = ov; document.getElementById('ovV').textContent = ftin(ov); document.getElementById('ovR').disabled = BM.roof === 'flat';
  const S = BM.site || {}; document.getElementById('stSet').placeholder = toDisp(48);
  document.querySelectorAll('[data-corner]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.corner === (S.corner || ''))));
  document.querySelectorAll('[data-drive]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.drive === (S.drive === 'side' ? 'side' : 'front'))));
  document.getElementById('stCornerMore').hidden = !S.corner; { const i = document.getElementById('stSide'); if (document.activeElement !== i) i.value = S.sideSetback == null ? '' : toDisp(S.sideSetback); } for (const [id, k] of [['stSet', 'setback'], ['stLW', 'lotW'], ['stLD', 'lotD'], ['stOX', 'offsetX'], ['stTr', 'trees']]) { const i = document.getElementById(id); if (document.activeElement !== i) i.value = S[k] == null ? '' : k === 'trees' ? S[k] : toDisp(S[k]); }
}
// the roof edge: fascia size, gutters, colour (BM.eave; see ROOF_EDGE in roof.js)
const setEave = patch => { pushHist(); BM.eave = { ...(BM.eave || {}), ...patch }; syncPlanPop(); planChanged(false); };
document.querySelectorAll('[data-eave-f]').forEach(b => b.onclick = () => setEave({ fascia: b.dataset.eaveF }));
document.querySelectorAll('[data-eave-g]').forEach(b => b.onclick = () => setEave({ gutter: b.dataset.eaveG === '1' }));
document.querySelectorAll('[data-eave-c]').forEach(b => b.onclick = () => setEave({ color: b.dataset.eaveC }));
document.getElementById('pitchR').onpointerdown = () => pushHist();
document.getElementById('ovR').onpointerdown = () => pushHist();
document.getElementById('ovR').oninput = e => { BM.ov = +e.target.value; document.getElementById('ovV').textContent = ftin(BM.ov); clearTimeout(e.target.t); e.target.t = setTimeout(() => planChanged(false), 150); };
document.getElementById('pitchR').oninput = e => { BM.pitch = +e.target.value; document.getElementById('pitchV').textContent = `${BM.pitch}:12`; clearTimeout(e.target.t); e.target.t = setTimeout(() => planChanged(false), 150); };
for (const [id, k] of [['stSet', 'setback'], ['stLW', 'lotW'], ['stLD', 'lotD'], ['stOX', 'offsetX'], ['stTr', 'trees']]) document.getElementById(id).onchange = e => { pushHist(); BM.site = { ...(BM.site || {}) }; if (e.target.value === '') delete BM.site[k]; else BM.site[k] = k === 'trees' ? Math.max(0, Math.min(8, +e.target.value)) : +fromDisp(+e.target.value).toFixed(2);
  if (k === 'trees') { BM.items = (BM.items || []).filter(i => !i.auto); BM.site.treesPlaced = false; seedTrees(BM); } // the starting trees again, this many; the ones you added stay
  planChanged(false); };
// corner lot: which side the second street runs down, and which street the driveway goes to
const setSite = patch => { pushHist(); BM.site = { ...(BM.site || {}), ...patch }; for (const k in patch) if (patch[k] == null || patch[k] === '') delete BM.site[k]; syncPlanPop(); planChanged(false); };
document.querySelectorAll('[data-corner]').forEach(b => b.onclick = () => setSite({ corner: b.dataset.corner || null, ...(b.dataset.corner ? {} : { drive: null }) }));
document.querySelectorAll('[data-drive]').forEach(b => b.onclick = () => setSite({ drive: b.dataset.drive === 'side' ? 'side' : null }));
document.getElementById('stSide').onchange = e => { const v = e.target.value === '' ? null : fromDisp(+e.target.value); if (v != null && !(v >= 5 && v <= 200)) return syncPlanPop(); setSite({ sideSetback: v == null ? null : snapH(v) }); };
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
    t.x += e.key === 'ArrowLeft' ? st : e.key === 'ArrowRight' ? -st : 0; t.z += e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0; planChanged(); }
  else if (!mod && e.key.startsWith('Arrow') && PE.multi.size > 1) { e.preventDefault(); e.stopImmediatePropagation(); const st = e.shiftKey ? 2 : .5; pushHist();
    for (const r of BM.rooms.filter(r => PE.multi.has(r.id))) { r.x = +(r.x + (e.key === 'ArrowLeft' ? st : e.key === 'ArrowRight' ? -st : 0)).toFixed(2); r.z = +(r.z + (e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0)).toFixed(2); } planChanged(); }
}, true);

// ---------- automatic dimension strings: room-by-room chains on the top and left, overall size outside them ----------
function dimChains(g, P, lv, col) {
  const rs = BM.rooms.filter(r => r.level === lv && !RT[r.type]?.outdoor); if (!rs.length) return;
  const x0 = Math.min(...rs.map(r => r.x)), x1 = Math.max(...rs.map(r => r.x + r.w)), z0 = Math.min(...rs.map(r => r.z)), z1 = Math.max(...rs.map(r => r.z + r.d));
  const uniq = a => [...new Set(a.map(v => +v.toFixed(2)))].sort((p, q) => p - q);
  const xs = uniq([x0, x1, ...rs.filter(r => r.z - z0 < .6).flatMap(r => [r.x, r.x + r.w])]), zs = uniq([z0, z1, ...rs.filter(r => r.x - x0 < .6).flatMap(r => [r.z, r.z + r.d])]);
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1; g.font = '500 10px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const [ax, ay] = P(x0, z0), [bx, by] = P(x1, z1);
  const run = (horiz, stops, off) => { // one chain of dimensions `off` pixels outside the plan
    const at = horiz ? ay - off : ax - off;
    g.beginPath(); const p0 = horiz ? P(stops[0], z0)[0] : P(x0, stops[0])[1], p1 = horiz ? P(stops.at(-1), z0)[0] : P(x0, stops.at(-1))[1];
    if (horiz) { g.moveTo(p0, at); g.lineTo(p1, at); } else { g.moveTo(at, p0); g.lineTo(at, p1); }
    for (const v of stops) { const q = horiz ? P(v, z0)[0] : P(x0, v)[1]; if (horiz) { g.moveTo(q, at - 4); g.lineTo(q, at + 4); g.moveTo(q - 3, at + 3); g.lineTo(q + 3, at - 3); } else { g.moveTo(at - 4, q); g.lineTo(at + 4, q); g.moveTo(at - 3, q + 3); g.lineTo(at + 3, q - 3); } }
    g.stroke();
    for (let i = 0; i < stops.length - 1; i++) {
      const a = horiz ? P(stops[i], z0)[0] : P(x0, stops[i])[1], b = horiz ? P(stops[i + 1], z0)[0] : P(x0, stops[i + 1])[1], t = ftin(stops[i + 1] - stops[i]);
      if (Math.abs(b - a) < g.measureText(t).width + 6) continue;
      g.save(); if (horiz) g.translate((a + b) / 2, at - 8); else { g.translate(at - 8, (a + b) / 2); g.rotate(-Math.PI / 2); } g.fillText(t, 0, 0); g.restore();
    }
  };
  if (xs.length > 2) run(true, xs, 18); run(true, [x0, x1], xs.length > 2 ? 40 : 18);
  if (zs.length > 2) run(false, zs, 18); run(false, [z0, z1], zs.length > 2 ? 40 : 18);
  g.restore();
}

// ---------- plan symbols for doors and windows (editor and PDF share this) ----------
// P maps (x, z) in feet to the screen; s is pixels per foot.
function drawOpening(g, P, w, o, s, col, winCol) {
  const hz = w.axis === 'x', a = o.c - o.w / 2, b = o.c + o.w / 2, at = (u, n = 0) => hz ? P(u, w.c + n) : P(w.c + n, u);
  const inward = w.ext ? ({ '-z': 1, '+z': -1, '-x': 1, '+x': -1 })[w.out] * (o.outSwing ? -1 : 1) : (o.sw ?? 1);
  const line = (p0, p1) => { g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); };
  const swing = (hingeAt, len, toward) => { // leaf drawn open at 90°, with its arc back to the closed position
    const h = at(hingeAt), tip = at(hingeAt, inward * len), shut = at(hingeAt + toward * len);
    line(h, tip); g.beginPath(); g.moveTo(...tip); g.quadraticCurveTo(...at(hingeAt + toward * len, inward * len), ...shut); g.stroke();
  };
  g.save(); g.strokeStyle = col; g.lineWidth = 1;
  const k = o.k, st = o.style;
  if (k === 'door' || k === 'front' || k === 'extdoor') {
    if (st === 'cased') { /* opening only */ }
    else if (st === 'pocket') { g.setLineDash([3, 2]); const s0 = o.hinge === 'b' ? b : a - o.w; line(at(s0), at(s0 + o.w)); g.setLineDash([]); }
    else if (st === 'barn') { const s0 = o.hinge === 'b' ? a - o.w : b; line(at(s0, inward * .4), at(s0 + o.w, inward * .4)); line(at(Math.min(a, s0), inward * .3), at(Math.max(b, s0 + o.w), inward * .3)); }
    else if (st === 'bifold') { for (const [h0, d] of [[a, 1], [b, -1]]) { const q = o.w / 4; g.beginPath(); g.moveTo(...at(h0)); g.lineTo(...at(h0 + d * q / 2, inward * q * .85)); g.lineTo(...at(h0 + d * q)); g.stroke(); } }
    else if (k === 'front' || st === 'double' || st === 'french') { swing(a, o.w / 2, 1); swing(b, o.w / 2, -1); }
    else { const hb = o.hinge === 'b'; swing(hb ? b : a, o.w, hb ? -1 : 1); }
  } else if (k === 'slider') { line(at(a, -.12), at(o.c + .3, -.12)); line(at(o.c - .3, .12), at(b, .12)); }
  else if (k === 'garage') { g.setLineDash([4, 3]); line(at(a), at(b)); g.setLineDash([]); }
  else { g.strokeStyle = winCol; for (const n of [-.18, 0, .18]) line(at(a, n), at(b, n)); }
  g.restore();
}

// ---------- finishes for the selected room ----------
const PAINTS = [['#f4f3ef', 'White'], ['#ddd4c6', 'Greige'], ['#c9c4bc', 'Warm grey'], ['#c7cdb9', 'Sage'], ['#cbd5dc', 'Mist'], ['#2f3b52', 'Navy'], ['#3f4a3c', 'Forest'], ['#8a5a44', 'Terracotta'], ['#1f2023', 'Black']];
const SIDE_NAME = { n: 'Front wall', s: 'Back wall', w: 'Left wall', e: 'Right wall' };
function roomFinishPanel() {
  const q = BM.rooms.find(r => r.id === PE.sel), el = document.getElementById('peFin'); if (!q || !el) return;
  if (RT[q.type]?.outdoor) { el.innerHTML = ''; return; }
  const F = q.finish || {}, sw = (attr, cur) => PAINTS.map(([c, n]) => `<button type="button" ${attr}="${c}" title="${n}" aria-pressed="${cur === c}" style="background:${c}"></button>`).join('');
  el.innerHTML = `<h3 style="font-weight:500;font-size:11.5px;color:var(--ink-3);margin-top:14px">Finishes</h3>
    <label class="fld">Floor <select id="rfFloor"><option value="">House default</option>${Object.entries(ROOM_FLOORS).map(([k, v]) => `<option value="${k}" ${F.floor === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
    <div class="fld fld-stack">Wall paint <div class="chips"><button type="button" data-rp="" class="def" aria-pressed="${!F.paint}" title="House default" aria-label="House default"></button>${sw('data-rp', F.paint)}<label class="chip-c" title="Any colour"><input type="color" id="rpC" value="${F.paint || '#f4f3ef'}"></label></div></div>
    <label class="fld">Accent wall <select id="rfSide"><option value="">None</option>${Object.entries(SIDE_NAME).map(([k, n]) => `<option value="${k}" ${F.accent?.side === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${F.accent ? `<div class="fld fld-stack"><div class="chips">${sw('data-ra', F.accent.color)}<label class="chip-c"><input type="color" id="raC" value="${F.accent.color}"></label></div></div>` : ''}`;
  const set = fn => { pushHist(); q.finish = { ...(q.finish || {}) }; fn(q.finish); for (const k of Object.keys(q.finish)) if (q.finish[k] == null) delete q.finish[k]; if (!Object.keys(q.finish).length) delete q.finish; planChanged(); };
  el.querySelector('#rfFloor').onchange = e => set(f => f.floor = e.target.value || null);
  el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => set(f => f.paint = b.dataset.rp || null));
  el.querySelector('#rpC').onchange = e => set(f => f.paint = e.target.value);
  el.querySelector('#rfSide').onchange = e => set(f => f.accent = e.target.value ? { side: e.target.value, color: f.accent?.color || '#2f3b52' } : null);
  el.querySelectorAll('[data-ra]').forEach(b => b.onclick = () => set(f => f.accent = { ...f.accent, color: b.dataset.ra }));
  el.querySelector('#raC')?.addEventListener('change', e => set(f => f.accent = { ...f.accent, color: e.target.value }));
}

// Wall pieces (cabinets, appliances, wardrobes…) slide their back against the nearest wall and turn to face the room.
function snapToWall(it, reach = 1.6) {
  const depth = CATALOG[it.kind][2], rooms = BM.rooms.filter(r => r.level === it.level && !RT[r.type]?.outdoor); let best = null;
  for (const r of rooms) for (const e of edgesOf(r)) {
    const horiz = e.axis === 'x', along = horiz ? it.x : it.z; if (along < e.a - .5 || along > e.b + .5) continue;
    const inside = { n: 1, s: -1, w: 1, e: -1 }[e.side], want = e.c + inside * (INT / 2 + depth / 2), gap = Math.abs((horiz ? it.z : it.x) - want);
    if (gap < reach && (!best || gap < best.gap)) best = { gap, horiz, want, rot: { n: 0, s: 2, w: 3, e: 1 }[e.side] };
  }
  if (!best) return;
  it.rot = best.rot; if (best.horiz) it.z = +best.want.toFixed(2); else it.x = +best.want.toFixed(2);
}

