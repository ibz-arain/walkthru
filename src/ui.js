
// =====================================================================
//  UI SHELL — dockable toolbar, popovers, one side panel at a time, and the viewer tools
//  (render styles, measure, sun study, saved views, export / import, areas & estimate, shortcuts).
//  Functions other files call early (uiSync, setEditLabel, uiInsets, closePanel, closePops, toast, uiEditing)
//  are hoisted declarations that do nothing until this file has run.
// =====================================================================
var uiReady = false;
const $u = id => document.getElementById(id);
const ST = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const press = (sel, key, val) => document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === String(val))));
const dockSide = () => ['top', 'bottom', 'left', 'right'].find(d => document.body.classList.contains('dock-' + d)) || 'top';
const VIEW_NAME = { front: 'Front', rear: 'Rear', aerial: 'Aerial', left: 'Left', right: 'Right', top: 'Top', B: 'Basement', M: 'Main floor', U: '2nd floor', saved: 'Saved view' };

function setEditLabel(t) { const el = document.getElementById('editLabel'); if (el) el.textContent = t; const b = document.getElementById('editBtn'); if (b) b.dataset.tip = `${t} (E)`; }
function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); }
function uiInsets() {
  const b = document.body, hidden = b.classList.contains('ui-hidden'), H = hidden ? 0 : 66, W = hidden ? 0 : 70; // bar + its gap on both sides
  const side = !document.getElementById('side')?.hidden;
  return { t: b.classList.contains('dock-top') ? H : 0, b: b.classList.contains('dock-bottom') ? H : 0, l: b.classList.contains('dock-left') ? W : 0, r: b.classList.contains('dock-right') ? W : 0, p: side && innerWidth > 760 && !hidden ? 318 : 0 };
}

// ---------- dock + theme ----------
function setDock(d) {
  document.body.classList.remove('dock-top', 'dock-bottom', 'dock-left', 'dock-right'); document.body.classList.add('dock-' + d);
  ST.set('walkthru-dock', d); press('[data-dock]', 'dock', d); closePops(); relayout();
}
function setTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  ST.set('walkthru-theme', t); press('[data-theme-set]', 'themeSet', t); if (PE.open) peDraw();
}
function relayout() { updateViewOffset(); if (PE.open) requestAnimationFrame(() => peSize()); }
document.querySelectorAll('[data-dock]').forEach(b => b.onclick = () => setDock(b.dataset.dock));
document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => setTheme(b.dataset.themeSet));
// Units: lengths and areas everywhere switch at once; the design itself is always stored in feet.
function setUnits(u) {
  METRIC = u === 'metric'; ST.set('walkthru-units', u); press('[data-units]', 'units', u);
  document.querySelectorAll('.u-len').forEach(e => e.textContent = U_LEN());
  for (const o of labelObjs) if (o.userData.dims) { const [n, w, d] = o.userData.dims; o.element.innerHTML = `${n}<small>${ftin(w)} × ${ftin(d)}</small>`; }
  if (PE.open) { peInspector(); peDraw(); } if (popOpen === 'pePlanPop') syncPlanPop(); uiSync(); renderInfo();
}
document.querySelectorAll('[data-units]').forEach(b => b.onclick = () => setUnits(b.dataset.units));

// ---------- popovers ----------
let popOpen = null, popBtn = null;
const POP_OPEN = {
  designMenu: () => fillDesignMenu(), viewPop: () => { renderNav(); renderSaved(); }, mePop: () => syncMe(),
  dockPop: () => { press('[data-units]', 'units', METRIC ? 'metric' : 'imperial'); press('[data-dock]', 'dock', dockSide()); press('[data-theme-set]', 'themeSet', ST.get('walkthru-theme', 'auto')); },
  peFloorsPop: () => renderFloorsPop(),
  pePlanPop: () => { $u('peFurnT').checked = !!PE.furn; $u('peChainT').checked = PE.autoDims !== false; $u('peGridT').checked = PE.grid; $u('peDimsT').checked = PE.dims; $u('peAreaT').checked = PE.areas; syncPlanPop(); },
};
function openPop(id, btn) {
  if (popOpen === id) return closePops();
  closePops(); hideTip();
  const el = $u(id); el.hidden = false; popOpen = id; popBtn = btn; btn?.setAttribute('aria-expanded', 'true');
  POP_OPEN[id]?.(); placePop(el, btn);
}
function closePops() { if (!popOpen) return; const el = document.getElementById(popOpen); if (el) el.hidden = true; popBtn?.setAttribute('aria-expanded', 'false'); popOpen = popBtn = null; }
function placePop(el, btn) {
  const r = btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, d = dockSide(), m = 8;
  let x = r.left, y = r.bottom + 6;
  if (d === 'bottom') y = r.top - h - 6; else if (d === 'left') { x = r.right + 8; y = r.top; } else if (d === 'right') { x = r.left - w - 8; y = r.top; }
  el.style.left = clampN(x, m, innerWidth - w - m) + 'px'; el.style.top = clampN(y, m, innerHeight - h - m) + 'px';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pop]'); if (b) { e.preventDefault(); openPop(b.dataset.pop, b); return; }
  // picking something from a menu closes it (rows that open another menu don't)
  if (e.target.closest('#designMenu [data-house], #designMenu [data-design], #viewPop [data-view], #viewPop [data-saved], #navList [data-go], .pop .menu button:not([data-pop]):not(.del):not(#designAdd)')) setTimeout(closePops, 0);
});
addEventListener('pointerdown', e => { if (popOpen && !e.target.closest('.pop, [data-pop]')) closePops(); }, true);
addEventListener('resize', () => { closePops(); relayout(); });

// ---------- dialogs: one at a time; Esc or a click outside closes them ----------
const DIALOGS = ['stNewForm', 'stEditForm', 'stDelForm'];
new MutationObserver(ms => { for (const m of ms) if (!m.target.hidden && DIALOGS.includes(m.target.id)) for (const id of DIALOGS) if (id !== m.target.id) $u(id).hidden = true; })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
const openDialog = () => DIALOGS.map($u).find(d => d && !d.hidden);
addEventListener('pointerdown', e => { const d = openDialog(); if (d && !d.contains(e.target) && !e.target.closest('[data-pop], .pop, #stNew')) d.hidden = true; }, true);

// ---------- tooltips ----------
const tipEl = $u('tip'); let tipT = 0;
function hideTip() { clearTimeout(tipT); tipEl.hidden = true; }
function showTip(t) {
  if (t.getAttribute('aria-expanded') === 'true' || !t.isConnected) return;
  tipEl.textContent = t.dataset.tip; tipEl.hidden = false;
  const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, inBar = !!t.closest('.tb'), d = inBar ? dockSide() : 'bottom';
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
  if (d === 'bottom') y = inBar ? r.top - h - 8 : r.bottom + 8; if (!inBar) y = r.top - h - 8;
  if (d === 'left') { x = r.right + 8; y = r.top + r.height / 2 - h / 2; } if (d === 'right') { x = r.left - w - 8; y = r.top + r.height / 2 - h / 2; }
  tipEl.style.left = clampN(x, 6, innerWidth - w - 6) + 'px'; tipEl.style.top = clampN(y, 6, innerHeight - h - 6) + 'px';
}
document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-tip]'); if (!t || e.pointerType === 'touch') return; clearTimeout(tipT); tipT = setTimeout(() => showTip(t), 380); });
document.addEventListener('pointerout', e => { if (e.target.closest?.('[data-tip]')) hideTip(); });
addEventListener('pointerdown', hideTip, true);

// ---------- side panels ----------
let panel = null;
const PANEL_OPEN = { info: () => renderInfo() };
function openPanel(name) {
  if (panel === name) return closePanel();
  document.querySelectorAll('#side .sp').forEach(s => s.hidden = s.dataset.panel !== name);
  $u('side').hidden = false; panel = name; document.body.classList.add('panel-open');
  press('[data-panel-btn]', 'panelBtn', name); PANEL_OPEN[name]?.(); updateViewOffset();
}
function closePanel() {
  if (!uiReady || !panel) return;
  $u('side').hidden = true; panel = null; document.body.classList.remove('panel-open'); press('[data-panel-btn]', 'panelBtn', ''); updateViewOffset();
}
document.querySelectorAll('[data-panel-btn]').forEach(b => b.onclick = () => openPanel(b.dataset.panelBtn));
document.querySelectorAll('#side [data-close]').forEach(b => b.onclick = closePanel);
$u('helpBtn').onclick = $u('helpBtn2').onclick = () => { closePops(); openPanel('help'); };

// ---------- navigate ----------
let navKey = '';
function renderNav() {
  const sel = $u('goto'), key = curHouse + ':' + sel.innerHTML.length; if (key === navKey && $u('navList').childElementCount) return; navKey = key;
  $u('navList').innerHTML = [...sel.querySelectorAll('optgroup')].map(g => `<p>${g.label}</p><div>` + [...g.querySelectorAll('option')].map(o => `<button type="button" data-go="${o.value}">${o.textContent}</button>`).join('') + '</div>').join('');
  $u('navList').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { sel.value = b.dataset.go; sel.dispatchEvent(new Event('change')); });
}

// ---------- areas, estimate, schedule ----------
const NOT_LIVING = /porch|patio|balcony|deck|bridge|garage|open space/i;
function areaData() {
  const lv = Object.fromEntries((curHouse === 3 ? levelIds() : ['B', 'M', 'U']).map(l => [l, []]));
  for (const [name, l, rs] of roomsOf(curHouse)) lv[l]?.push([name, rs.reduce((a, r) => a + (r[1] - r[0]) * (r[3] - r[2]), 0)]);
  const living = l => lv[l].filter(([n]) => !NOT_LIVING.test(n)).reduce((a, [, s]) => a + s, 0);
  const names = Object.values(lv).flat().map(([n]) => n);
  const beds = names.filter(n => /bed|nursery|guest/i.test(n) && !/bath/i.test(n)).length;
  const baths = names.filter(n => /bath|ensuite/i.test(n)).length + names.filter(n => /powder/i.test(n)).length * .5;
  const ids = Object.keys(lv), under = l => curHouse === 3 ? belowGrade(l) : l === 'B';
  return { lv, above: ids.filter(l => !under(l)).reduce((a, l) => a + living(l), 0), base: ids.filter(under).reduce((a, l) => a + living(l), 0), beds, baths };
}
const fmtSf = v => fmtArea(v);
function renderInfo() {
  const A = areaData();
  $u('infoStats').innerHTML = [[fmtSf(A.above), 'Above grade'], [A.base ? fmtSf(A.base) : '—', 'Basement'], [A.beds, 'Bedrooms'], [A.baths, 'Bathrooms']].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  const LN = curHouse === 3 ? LV_NAME : { M: 'Main floor', U: '2nd floor', B: 'Basement' };
  $u('schedule').innerHTML = '<table class="sched">' + Object.keys(A.lv).reverse().filter(l => A.lv[l].length).map(l => `<tr class="lv"><td>${LN[l]}</td><td>${fmtSf(A.lv[l].reduce((a, [, s]) => a + s, 0))}</td></tr>` + A.lv[l].map(([n, s]) => `<tr><td>${n}</td><td>${fmtSf(s)}</td></tr>`).join('')).join('') + '</table>';
}

// ---------- display: render style, layers, sun, camera ----------
let RS = 'real';
const RS_MAT = {
  clay: new THREE.MeshStandardMaterial({ color: '#eeece7', roughness: .9 }),
  xray: new THREE.MeshBasicMaterial({ color: '#5d7cff', transparent: true, opacity: .09, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  wire: new THREE.MeshBasicMaterial({ color: '#3f4656', wireframe: true }),
};
const RS_BG = { clay: '#e7e9ec', xray: '#0b0e1a', wire: '#f5f6f8' }, FOG = scene.fog;
function applyRS() {
  for (const root of [HOUSE1, HOUSE2, HOUSE3]) root.traverse(o => {
    if (!o.isMesh) return; if (!o.userData.m0) o.userData.m0 = o.material;
    o.material = RS === 'real' || root !== HOUSES[curHouse].root ? o.userData.m0 : RS_MAT[RS];
  });
}
function setRender(rs) {
  RS = rs; press('[data-rs]', 'rs', rs); applyRS();
  sky.visible = rs === 'real'; scene.background = rs === 'real' ? null : new THREE.Color(RS_BG[rs]); scene.fog = rs === 'real' ? FOG : null;
  sun.castShadow = $u('optShadow').checked && rs !== 'xray' && rs !== 'wire'; renderer.shadowMap.needsUpdate = true;
}
document.querySelectorAll('[data-rs]').forEach(b => b.onclick = () => setRender(b.dataset.rs));
$u('optTrees').onchange = e => { showTrees = e.target.checked; applyVisibility(); };
function setRoof(on) { showRoof = on; $u('optRoof').checked = on; applyVisibility(); }
$u('optRoof').onchange = e => setRoof(e.target.checked);
$u('roofBtn').onclick = () => setRoof(!showRoof);
$u('doorsBtn').onclick = () => setAllDoors(!allDoorsClosed());
$u('optShadow').onchange = e => { sun.castShadow = e.target.checked && RS !== 'xray' && RS !== 'wire'; renderer.shadowMap.needsUpdate = true; };
$u('optSpin').onchange = e => { controls.autoRotate = e.target.checked; controls.autoRotateSpeed = .7; };
const SEASON = { summer: 1.15, equinox: .85, winter: .55 };
document.querySelectorAll('[data-season]').forEach(b => b.onclick = () => { sunSeason = SEASON[b.dataset.season]; press('[data-season]', 'season', b.dataset.season); setSun(sunH); });
$u('north').oninput = e => { sunNorth = +e.target.value * Math.PI / 180; $u('northv').textContent = e.target.value + '°'; setSun(sunH); };
$u('expo').oninput = e => { renderer.toneMappingExposure = +e.target.value; $u('expov').textContent = (+e.target.value).toFixed(2); };
$u('fov').oninput = e => { orbitFov = +e.target.value; $u('fovv').textContent = e.target.value + '°'; if (mode !== 'walk') { camera.fov = orbitFov; camera.updateProjectionMatrix(); } };
let sunPlay = false;
$u('sunPlay').onclick = () => { sunPlay = !sunPlay; $u('sunPlay').setAttribute('aria-pressed', String(sunPlay)); $u('sunPlay').innerHTML = `<svg class="ic"><use href="#i-${sunPlay ? 'pause' : 'play'}"/></svg>`; };

// ---------- you: body and height ----------
const fmtH = ft => { const t = Math.round(ft * 12); return `${Math.floor(t / 12)}'${t % 12}"`; };
function syncMe() {
  $u('meH').value = Math.round(ME.h * 12); $u('meHv').textContent = fmtH(ME.h);
  document.querySelectorAll('[data-hpre]').forEach(b => b.setAttribute('aria-pressed', String(Math.round(+b.dataset.hpre * 12) === Math.round(ME.h * 12))));
}
document.querySelectorAll('[data-hpre]').forEach(b => b.onclick = () => { setMe({ h: +b.dataset.hpre }); syncMe(); });
$u('meH').oninput = e => { setMe({ h: +e.target.value / 12 }); syncMe(); };
$u('mePlay').onclick = () => { closePops(); fadeCut(() => setMode('walk')); };
$u('peg').addEventListener('pointerup', () => setTimeout(closePops, 0));

// ---------- measure ----------
const MEAS = { on: false, a: null, down: null, group: new THREE.Group() }; scene.add(MEAS.group);
const mRay = new THREE.Raycaster(), mNdc = new THREE.Vector2(), mDot = new THREE.SphereGeometry(.28, 12, 8);
const mMat = new THREE.MeshBasicMaterial({ color: '#3b5bfd', depthTest: false }), mLine = new THREE.LineBasicMaterial({ color: '#3b5bfd', depthTest: false });
function setMeasure(on) {
  if (on) window.wtTrack?.('measure');
  if (on && mode === 'walk') goView(curView);
  MEAS.on = on; MEAS.a = null; document.body.classList.toggle('measuring', on); $u('measureBar').hidden = !on;
  $u('measureBtn').setAttribute('aria-pressed', String(on)); $u('measureMsg').textContent = 'Click two points to measure';
  if (!on) clearMeasure();
}
function clearMeasure() { for (const o of [...MEAS.group.children]) { MEAS.group.remove(o); o.geometry?.dispose?.(); } MEAS.a = null; }
function measurePoint(e) {
  mNdc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mRay.setFromCamera(mNdc, camera);
  return mRay.intersectObject(HOUSES[curHouse].root, true).find(h => h.object.isMesh && shown(h.object))?.point.clone();
}
function addDot(p) { const m = new THREE.Mesh(mDot, mMat); m.position.copy(p); m.renderOrder = 999; MEAS.group.add(m); }
renderer.domElement.addEventListener('pointerdown', e => { if (MEAS.on) MEAS.down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!MEAS.on || !MEAS.down || Math.hypot(e.clientX - MEAS.down[0], e.clientY - MEAS.down[1]) > 5) return; MEAS.down = null;
  const p = measurePoint(e); if (!p) return; addDot(p);
  if (!MEAS.a) { MEAS.a = p; $u('measureMsg').textContent = 'Now click the second point'; return; }
  const a = MEAS.a, line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, p]), mLine); line.renderOrder = 998; MEAS.group.add(line);
  const d = a.distanceTo(p), dh = Math.abs(p.y - a.y), el = document.createElement('div'); el.className = 'mlbl'; el.textContent = ftin(d);
  const lab = new CSS2DObject(el); lab.position.copy(a).lerp(p, .5); MEAS.group.add(lab);
  $u('measureMsg').textContent = `${ftin(d)}${dh > .25 ? ` · rise ${ftin(dh)}` : ''} · click two more points`; MEAS.a = null;
});
$u('measureBtn').onclick = () => setMeasure(!MEAS.on);
$u('measureClear').onclick = () => { clearMeasure(); $u('measureMsg').textContent = 'Click two points to measure'; };
$u('measureDone').onclick = () => setMeasure(false);

// ---------- saved views ----------
const savedList = () => { try { return JSON.parse(ST.get('walkthru-views', '[]')); } catch (e) { return []; } };
function renderSaved() {
  const L = savedList();
  $u('savedViews').innerHTML = L.length ? L.map((v, i) => `<div class="row"><button type="button" data-saved="${i}">${v.name.replace(/</g, '&lt;')}<small>${v.house}</small></button><button type="button" class="del" data-del="${i}" aria-label="Delete view"><svg class="ic"><use href="#i-x"/></svg></button></div>`).join('') : '<p class="pop-note">No saved views.</p>';
  $u('savedViews').querySelectorAll('[data-saved]').forEach(b => b.onclick = () => flyTo(L[+b.dataset.saved]));
  $u('savedViews').querySelectorAll('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); L.splice(+b.dataset.del, 1); ST.set('walkthru-views', JSON.stringify(L)); renderSaved(); });
}
function flyTo(v) {
  if (mode === 'walk') goView(curView, true);
  curView = 'saved'; applyVisibility();
  anim = { from: { p: camera.position.clone(), t: controls.target.clone() }, to: { p: new THREE.Vector3(...v.p), t: new THREE.Vector3(...v.t) }, t: 0 };
}
$u('saveView').onclick = () => {
  if (mode === 'walk') return toast('Switch to orbit to save a view');
  const L = savedList(); L.push({ name: `View ${L.length + 1}`, house: $u('designNow').textContent, p: camera.position.toArray().map(n => +n.toFixed(2)), t: controls.target.toArray().map(n => +n.toFixed(2)) });
  ST.set('walkthru-views', JSON.stringify(L)); renderSaved(); toast('View saved');
};

// ---------- export / import ----------
const slug = () => $u('designNow').textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'walkthru';
function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function downloadText(text, name, type) { const u = URL.createObjectURL(new Blob([text], { type })); download(u, name); setTimeout(() => URL.revokeObjectURL(u), 4000); }
function shot(scale = 1) {
  const pr = renderer.getPixelRatio(); if (scale !== 1) renderer.setPixelRatio(pr * scale);
  renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png');
  if (scale !== 1) renderer.setPixelRatio(pr);
  window.wtTrack?.('screenshot', { scale });
  download(url, `${slug()}-${VIEW_NAME[curView]?.toLowerCase().replace(/\s/g, '-') || 'view'}.png`); toast(scale > 1 ? 'High-res render saved' : 'Screenshot saved');
}
$u('shotBtn').onclick = () => shot(1); $u('exShot').onclick = () => shot(1); $u('exShot2').onclick = () => shot(2);
$u('exPlan').onclick = () => { // the level you're looking at (main floor otherwise), drawn like the plan sheet
  const lv = PE.open ? PE.lv : ['B', 'M', 'U'].includes(curView) ? curView : 'M';
  if (!BM.rooms.some(r => r.level === lv)) return toast('There is no floor plan to save yet');
  download(drawSheetPlan(lv, 2000, 1250).url, `${slug()}-plan-${({ B: 'basement', M: 'main', U: 'upper' })[lv]}.png`); toast('Floor plan saved'); };
$u('exCsv').onclick = () => {
  const A = areaData(), LN = { M: 'Main floor', U: '2nd floor', B: 'Basement' };
  const rows = [['Level', 'Room', `Area (${METRIC ? 'm²' : 'sf'})`], ...['M', 'U', 'B'].flatMap(l => A.lv[l].map(([n, s]) => [LN[l], n, METRIC ? +(s * .092903).toFixed(1) : Math.round(s)]))];
  downloadText(rows.map(r => r.map(c => /[",]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n'), `${slug()}-rooms.csv`, 'text/csv'); toast('Room schedule saved');
};
$u('exJson').onclick = () => {
  if (curHouse !== 3) return toast('Samples 1 and 2 are fixed models. Open a design to export it.');
  downloadText(JSON.stringify({ app: 'walkthru', v: 1, name: $u('designNow').textContent, bm: BM }, null, 1), `${slug()}.json`, 'application/json'); toast('Design file saved');
};
const pickImport = () => { if (CL.on && CL.route?.kind !== 'none') return toast('Import works in the playground, not inside a project'); $u('importFile').click(); };
$u('exImport').onclick = pickImport; $u('designImport').onclick = () => { closePops(); pickImport(); };
$u('importFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), bm = j.bm || j; if (!Array.isArray(bm.rooms)) throw new Error();
    const id = Math.max(0, ...DS.list.map(x => x.id)) + 1; DS.list.push({ id, name: (j.name || f.name.replace(/\.json$/i, '')).slice(0, 40), bm }); openDesign(id); toast('Design imported'); window.wtTrack?.('design_imported');
  } catch (err) { toast('That file is not a Walkthru design'); }
};
// Share link: a public, view-only link to the project. Anyone with it can look around, walk through and try finishes; nothing they do is saved.
$u('exLink').onclick = async () => {
  let url = location.href;
  if (CL.route?.kind === 'project') { try { const j = await cloudApi('POST', 'share', { projectId: CL.route.id, public: true }); url = `${location.origin}/playground#c/${j.token}`; } catch (e) { return toast(e.message || 'Could not make a link'); } }
  try { await navigator.clipboard.writeText(url); toast('Share link copied: anyone with it can view this home'); } catch (e) { prompt('Copy this link', url); }
};

// ---------- editor extras ----------
let libOn = ST.get('walkthru-lib', '1') === '1';
function uiEditing(on) {
  if (!uiReady) return;
  closePops(); if (on && MEAS.on) setMeasure(false); if (on) { closePanel(); window.wtTrack?.('editor_opened'); }
  $u('planEd').classList.toggle('lib-off', !libOn); $u('peLibBtn').setAttribute('aria-pressed', String(libOn));
  if (on) requestAnimationFrame(() => requestAnimationFrame(() => { peSize(); peFit(); peDraw(); }));
}
$u('peLibBtn').onclick = () => { libOn = !libOn; ST.set('walkthru-lib', libOn ? '1' : '0'); uiEditing(true); };
$u('peLibHide').onclick = $u('peLibShow').onclick = () => $u('peLibBtn').click();
$u('peFind').oninput = e => {
  const q = e.target.value.trim().toLowerCase();
  $u('pePalette').querySelectorAll('[data-add],[data-item]').forEach(b => b.hidden = !!q && !b.textContent.toLowerCase().includes(q));
  $u('pePalette').querySelectorAll('h3').forEach(h => { let n = h.nextElementSibling, any = false; while (n && n.tagName !== 'H3') { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; });
};
$u('peGridT').onchange = e => { PE.grid = e.target.checked; peDraw(); };
$u('peDimsT').onchange = e => { PE.dims = e.target.checked; peDraw(); };
$u('peAreaT').onchange = e => { PE.areas = e.target.checked; peDraw(); };
$u('peFurnT').onchange = e => { PE.furn = e.target.checked; if (!PE.furn && PE.selX?.kind === 'item') selectX(null); peDraw(); };
$u('peChainT').onchange = e => { PE.autoDims = e.target.checked; peDraw(); };
$u('peZoomIn').onclick = () => peZoom(1.2); $u('peZoomOut').onclick = () => peZoom(1 / 1.2); $u('peZoomFit').onclick = () => { peFit(); peDraw(); };

// ---------- misc tools ----------
$u('fullBtn').onclick = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen is not available here')); };
document.addEventListener('fullscreenchange', () => $u('fullBtn').setAttribute('aria-pressed', String(!!document.fullscreenElement)));
function setUIHidden(on) { closePops(); document.body.classList.toggle('ui-hidden', on); $u('showUI').hidden = !on; relayout(); }
$u('hideUI').onclick = () => setUIHidden(true); $u('showUI').onclick = () => setUIHidden(false);

// ---------- keyboard ----------
addEventListener('keydown', e => {
  if (e.target.closest?.('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { const dlg = openDialog(); if (dlg) { dlg.hidden = true; return; } if (popOpen) closePops(); else if (MEAS.on) setMeasure(false); else if (document.body.classList.contains('ui-hidden')) setUIHidden(false); else if (panel) closePanel(); return; }
  if (mode === 'walk') return;
  if (k === '\\') return setUIHidden(!document.body.classList.contains('ui-hidden'));
  if (k === '?') return openPanel('help');
  if (/^[1-9]$/.test(k)) { const L = curHouse === 3 ? levelList() : DEFAULT_LEVELS, lv = L[+k - 1]?.id; if (!lv) return; if (PE.open) peSetLevel(lv); else if (!document.querySelector(`[data-view="${lv}"]`)?.hidden) goView(lv); return; }
  if (k === 'e') { if (PE.open) $u('peDone').click(); else if (!$u('editBtn').hidden) $u('editBtn').click(); return; }
  if (k === 'm') return setMeasure(!MEAS.on);
  if (k === 'h') return setRoof(!showRoof);
  if (k === 'o') return setAllDoors(!allDoorsClosed());
  if (k === 'l') return $u('optLabels').click();
  if (k === 'p') return shot(1);
  if (PE.open) return; // the plan editor owns the rest of the letters
  const V = { f: 'front', b: 'rear', t: 'top', v: 'aerial' }[k]; if (V) goView(V);
});

// ---------- sync ----------
function uiSync() {
  if (!uiReady) return;
  const t = tabHouse(); $u('designNow').textContent = t === 3 ? (curDesign()?.name || 'My design') : `Sample ${t === 4 ? 3 : t}`;
  $u('viewNow').textContent = mode === 'walk' ? 'Walking' : (curHouse === 3 && lvOf(curView)?.name) || VIEW_NAME[curView] || 'Custom';
  $u('roofBtn').setAttribute('aria-pressed', String(!showRoof)); $u('optRoof').checked = showRoof;
  $u('doorsLbl').textContent = allDoorsClosed() ? 'Open all doors' : 'Close all doors';
  if (RS !== 'real') applyRS();
  if (panel === 'info') renderInfo();
  if (popOpen === 'pePlanPop') POP_OPEN.pePlanPop();
}
// Room labels never stack: bigger rooms keep theirs, labels that would overlap fade out until there is room.
let declutterT = 0;
function declutterLabels() {
  const shown = labelObjs.filter(o => o.visible && o.element.isConnected && o.element.style.display !== 'none')
    .sort((a, b) => (b.userData.dims ? b.userData.dims[1] * b.userData.dims[2] : 0) - (a.userData.dims ? a.userData.dims[1] * a.userData.dims[2] : 0));
  const kept = [];
  for (const o of shown) {
    const r = o.element.getBoundingClientRect(), hit = kept.some(k => r.left < k.right + 4 && r.right > k.left - 4 && r.top < k.bottom + 3 && r.bottom > k.top - 3);
    o.element.classList.toggle('lbl-off', hit); if (!hit) kept.push(r);
  }
}
const uiClock = new THREE.Clock();
(function tick() { // sun study: sweep the day while the play button is on
  const dt = Math.min(uiClock.getDelta(), .1);
  if (sunPlay) { let h = +$u('tod').value + dt * 1.4; if (h > 20) h = 6; $u('tod').value = h; setSun(h); }
  if ((declutterT += dt) > .25) { declutterT = 0; if (showLabels) declutterLabels(); }
  requestAnimationFrame(tick);
})();

setDock(['top', 'bottom', 'left', 'right'].includes(ST.get('walkthru-dock', 'top')) ? ST.get('walkthru-dock', 'top') : 'top');
press('[data-rs]', 'rs', 'real'); press('[data-season]', 'season', 'summer'); syncMe(); document.querySelectorAll('.u-len').forEach(e => e.textContent = U_LEN());
uiReady = true; uiSync(); uiEditing(PE.open); updateViewOffset();
