
// =====================================================================
//  LIGHT, SKY
// =====================================================================
const hemi = new THREE.HemisphereLight(0xdfeaf5, 0xb9b2a2, 0.55); scene.add(hemi);
const amb = new THREE.AmbientLight(0xfff6ea, 0.45); scene.add(amb);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera; sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 1; sc.far = 600;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.target.position.set(10, 0, 22); scene.add(sun, sun.target);
const skyGeo = new THREE.SphereGeometry(1400, 32, 16), skyCol = [];
{ const p = skyGeo.attributes.position, top = new THREE.Color('#5d8fc4'), hor = new THREE.Color('#dfe8ee'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / 1400); c.copy(hor).lerp(top, Math.pow(t, .55)); skyCol.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3)); }
const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);
let sunSeason = 1.15, sunNorth = 0, sunH = 15; // season scales how high the sun climbs; north turns the compass
function setSun(h) {
  sunH = h;
  // Lakeshore ON ~42°N, early summer: sunrise ~5:50 east, sunset ~21:00 west; +z is south
  const t = (h - 6) / 14, az = Math.PI * (0.05 + 0.9 * t), el = Math.sin(Math.PI * Math.min(1, Math.max(0, (h - 5.6) / 15.2))) * sunSeason;
  const d = 260, a2 = az + sunNorth, x = Math.cos(a2) * d * Math.cos(el), z = Math.sin(a2) * d * Math.cos(el);
  sun.position.set(10 + x, Math.max(8, Math.sin(el) * d), 22 + z);
  const low = Math.max(0, 1 - Math.sin(el) * 2.2);
  sun.color.setRGB(1, 0.95 - low * .35, 0.86 - low * .5); sun.intensity = 0.6 + 2.4 * Math.min(1, Math.sin(el) * 2);
  skyMat.color.setRGB(1, 1 - low * .18, 1 - low * .3); hemi.intensity = .25 + .35 * Math.min(1, Math.sin(el) * 2);
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  renderer.shadowMap.needsUpdate = true;
  document.getElementById('todv').textContent = `${((hh + 11) % 12) + 1}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'am' : 'pm'}`;
}

// =====================================================================
//  ROOMS (rects in world coords; upper floor converted from plan coords)
// =====================================================================
const u = (x0, x1, z0, z1) => [x0, x1, z0 + UZ, z1 + UZ];
const ROOMS = [
  // name, level, rects, spawn [x,z,yaw]
  ['Foyer', 'M', [[12.3, 19.4, 0.67, 12.7]], [15.9, 3.0, Math.PI]],
  ['Living Room', 'M', [[0.67, 12.0, 0.67, 15.1]], [10.3, 12.8, Math.PI * 0.3]],
  ['Dining Room', 'M', [[19.9, 31.0, 0.67, 15.0]], [21.2, 13.6, -Math.PI * 0.75]],
  ['Kitchen', 'M', [[17.0, 29.2, 15.1, 28.0]], [25.0, 28.5, 0.1]],
  ['Great Room', 'M', [[0.67, 17.0, 23.4, 43.3], [10.8, 17.0, 15.1, 23.4], [17.0, 29.2, 28.0, 43.3]], [17.5, 27.0, Math.PI * 0.78]],
  ['Mud Room', 'M', [[29.5, 48.7, 29.45, 41.0]], [31.0, 35.2, -Math.PI / 2]],
  ['Powder Room', 'M', [[49.1, 53.0, 31.5, 40.8]], [50.6, 35.4, 0]],
  ['Garage', 'M', [[29.6, 52.7, 2.2, 29.2], [37, 40.3, 29.2, 31.35]], [36.0, 27.0, -0.6]],
  ['Front Porch', 'M', [[9.6, 22.2, -7.4, 0]], [15.9, -18.0, Math.PI]],
  ['Covered Patio', 'M', [[-13.7, 0, 21.8, 44.0]], [-11.5, 33.0, -Math.PI / 2]],
  ['Primary Bedroom', 'U', [u(0.6, 10.2, 20.6, 25.4), u(0.6, 16.9, 25.4, 40.2), u(10.2, 16.9, 25.4, 30.6)], [14.5, 27.5 + UZ, Math.PI * 0.7]],
  ['Primary Bath', 'U', [u(31.3, 52.3, 20.9, 29.4), u(41.2, 52.3, 29.4, 37.6)], [41.8, 33.6 + UZ, -Math.PI * 0.6]],
  ['Walk-in Closets', 'U', [u(17.1, 28.8, 27.9, 40.2), u(29.2, 41.0, 29.8, 37.6)], [18.5, 29.2 + UZ, -Math.PI * 0.6]],
  ['Laundry', 'U', [u(17.1, 28.8, 21.1, 27.5)], [18.2, 23.3 + UZ, -Math.PI * 0.6]],
  ['Bedroom 2', 'U', [u(20.4, 30.7, 0.6, 18.7), u(17.1, 20.4, 14.9, 18.7)], [18.5, 16.8 + UZ, -Math.PI * 0.8]],
  ['Bedroom 3', 'U', [u(0.6, 12.4, 0.6, 12.4)], [10.9, 11.0 + UZ, Math.PI * 0.25]],
  ['Jack & Jill Bath', 'U', [u(10.7, 20.0, -2.3, 14.5)], [15.0, 6.0 + UZ, 0]],
  ['Upstairs Hall', 'U', [u(9.7, 16.9, 12.6, 25.4)], [13.5, 18.4 + UZ, 0]],
  ['Balcony', 'U', [u(-13.2, 0.3, 19.76, 40.96)], [-1.5, 38.4 + UZ, Math.PI * 0.5]],
  ['Rec Room', 'B', [[0.67, 28.6, 25.9, 43.3], [11.6, 18.4, 23.15, 25.9]], [24.0, 41.5, Math.PI * 0.2]],
  ['Theatre', 'B', [[19.8, 31.0, 0.67, 14.3]], [25.5, 13.6, 0]],
  ['Basement Bedroom', 'B', [[0.67, 12.0, 0.67, 15.1]], [10.5, 3.0, Math.PI * 0.75]],
  ['Basement Bath', 'B', [[0.67, 11.4, 23.4, 31.0]], [10.0, 25.0, Math.PI * 0.6]],
  ['Basement Hall', 'B', [[12.0, 19.8, 0.67, 23.15]], [15.5, 20.0, 0]],
  ['Mechanical', 'B', [[18.6, 28.4, 14.6, 25.5]], [20.0, 16.5, -Math.PI * 0.7]],
  ['Storage', 'B', [[28.95, 53.0, 30.9, 40.8]], [30.5, 35.2, -Math.PI / 2]],
  ['Cold Cellar', 'B', [[10.3, 21.1, -5.6, 0.3]], [15.6, -1.0, 0]],
];
const LEVEL_Y = { B: BF, M: MF, U: UF };
const ftin = v => { const t = Math.round(v * 12); return `${Math.floor(t / 12)}'-${t % 12}"`; };
const labelObjs = [];
const LEVEL_Y2 = { M: MF2, U: UF2 };
for (const [house, list, LY] of [[1, ROOMS, LEVEL_Y], [2, ROOMS2, LEVEL_Y2]]) for (const [name, lv, rs] of list) {
  const r = rs[0], el = document.createElement('div'); el.className = 'lbl';
  el.innerHTML = `${name}<small>${ftin(r[1] - r[0])} × ${ftin(r[3] - r[2])}</small>`;
  const o = new CSS2DObject(el); o.position.set((r[0] + r[1]) / 2, LY[lv] + (lv === 'M' && name === 'Garage' ? -1.5 : 0.5), (r[2] + r[3]) / 2);
  o.userData.lv = lv; o.userData.house = house; scene.add(o); labelObjs.push(o);
}

// =====================================================================
//  VIEWS
// =====================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 8; controls.maxDistance = 520;
const VIEWS = {
  front: { pos: [-38, 26, -68], tgt: [20, 9, 18] },
  rear: { pos: [-58, 30, 96], tgt: [10, 8, 26] },
  aerial: { pos: [110, 130, -90], tgt: [12, 0, 20] },
  B: { pos: [24, 105, 78], tgt: [24, BF, 21] },
  M: { pos: [24, 100, 82], tgt: [22, MF, 20] },
  U: { pos: [24, 112, 82], tgt: [24, UF, 21] },
};
const VIEWS_H2 = {
  front: { pos: [44, 20, -96], tgt: [26, 12, -6] },
  rear: { pos: [78, 50, 150], tgt: [18, 5, 36] },
  aerial: { pos: [-95, 150, 150], tgt: [20, 0, 25] },
  M: { pos: [28, 96, 56], tgt: [28, MF2, 6] },
  U: { pos: [28, 106, 58], tgt: [28, UF2, 6] },
};
const HOUSES = {
  1: { root: HOUSE1, G, trees, views: VIEWS, levelY: LEVEL_Y, front: [15.9, -18, Math.PI, 1], yard: [-34, 58, Math.PI * .15, 3], drive: [78, 15, Math.PI / 2, 3],
       note: `Lakeshore, ON · 2-storey + basement<br>Main 1,525 sf · 2nd 1,675 sf · 53'-3½" × 44'-0"<br>Built from permit set A-1.01 – A-3.02, rev. 04/06/2022` },
  2: { root: HOUSE2, G: G2, trees: TREES_H2, views: VIEWS_H2, levelY: LEVEL_Y2, front: [25, -44, Math.PI, 1], yard: [16, 47, Math.PI, 3], drive: [46, -52, Math.PI, 1],
       note: `Concept · French-modern, from your photo<br>Main ≈1,700 sf · 2nd ≈1,560 sf · 58' × 50'<br>Garage and entry face Old Tecumseh Rd` },
  3: { root: HOUSE3, G: G3, trees: G3.trees, views: {}, levelY: LEVEL_Y, get front() { return H3_FRONT; }, get yard() { return [H3_FRONT[0], H3_FRONT[1] + 90, 0, 3]; }, get drive() { return H3_DRIVE; },
       note: `Your editable design<br>Drag walls and rooms in the floor plan editor<br>Walls, doors, windows and roof are built for you` },
};
const roomsOf = n => n === 1 ? ROOMS : n === 2 ? ROOMS2 : ROOMS3;
const outlineOf = n => n === 1 ? OUTLINE : n === 2 ? OUTLINE2 : OUTLINE3;
const HASHES = { 1: '', 2: '#house-2', 3: '#my-design', 4: '#house-3' };
const houseFromHash = () => /^#(admin|c\/)/.test(location.hash) ? 3 : ({ '#house-2': 2, '#my-design': 3, '#house-3': 4 })[location.hash] || 1; // Studio and customer links draw through My Design
const startHouse = houseFromHash();
let curHouse = startHouse === 4 ? 3 : startHouse; // House 3 (tab 4) is drawn by the builder, like My Design
const tabHouse = () => curHouse === 3 && H3P ? 4 : curHouse;
const H3_NOTE = `1196 Campana Cres, Belle River · 2-storey + basement<br>Main 1,171 sf · 2nd 1,267 sf · basement 1,082 sf<br>From the iGUIDE plans · living room open to below`;
let mode = 'orbit', curView = 'front', anim = null, showLabels = true, showFurn = true, showTrees = true, showRoof = true, orbitFov = 50;
function applyVisibility() {
  const v = mode === 'walk' ? 'full' : curView;
  const lvl = { B: 0, M: 1, U: 2 }[v];
  const cut = lvl !== undefined;
  const H = HOUSES[curHouse], g = H.G;
  HOUSE1.visible = curHouse === 1; HOUSE2.visible = curHouse === 2; HOUSE3.visible = curHouse === 3;
  if (g.basement) g.basement.visible = true;
  g.main.visible = !cut || lvl >= 1; g.mainCeil.visible = !cut;
  g.upper.visible = !cut || lvl >= 2; g.upperCeil.visible = !cut && showRoof; g.roof.visible = !cut && showRoof;
  if (g.furnB) g.furnB.visible = showFurn; H.trees.visible = !cut && showTrees; if (g.site) g.site.visible = showTrees || cut; g.furnM.visible = showFurn && g.main.visible; g.furnU.visible = showFurn && g.upper.visible; if (g.furnS) g.furnS.visible = showFurn;
  for (const o of labelObjs) o.visible = showLabels && cut && o.userData.lv === v && o.userData.house === curHouse;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(mode === 'orbit' && b.dataset.view === curView)));
  uiSync();
}
function goView(v, instant) {
  if (mode === 'walk') exitWalk();
  if (curHouse === 2 && v === 'B') v = 'M';
  curView = v; applyVisibility();
  const V = HOUSES[curHouse].views[v] ?? VIEWS[v] ?? autoView(v); const from = { p: camera.position.clone(), t: controls.target.clone() };
  const to = { p: new THREE.Vector3(...V.pos), t: new THREE.Vector3(...V.tgt) };
  if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { camera.position.copy(to.p); controls.target.copy(to.t); controls.update(); return; }
  anim = { from, to, t: 0 };
}

// Left / right / top views framed on whatever house is showing.
function autoView(v) {
  const b = new THREE.Box3().setFromObject(HOUSES[curHouse].G.main), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.z, 30);
  if (v === 'top') return { pos: [c.x, r * 2.3, c.z + .01], tgt: [c.x, 0, c.z] };
  const sx = v === 'left' ? -1 : 1; return { pos: [c.x + sx * r * 1.6, r * .5, c.z + r * .25], tgt: [c.x, 8, c.z] };
}
// =====================================================================
//  WALK MODE
// =====================================================================
const player = { x: 15.9, z: -18, feet: 0, yaw: Math.PI, pitch: -0.05, vy: 0 };
const keys = {}; let colliders = []; window.__house = { player, keys, renderer, cols: () => colliders, step: dt => stepWalk(dt), view: v => goView(v, true), rebuild: () => rebuildHouse3(), draw: (p, t) => { if (p) { camera.position.set(...p); controls.target.set(...t); } controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); } };
function buildColliders() {
  scene.updateMatrixWorld(true); colliders = [];
  scene.traverse(o => {
    if (!o.isMesh || !o.userData.solid) return;
    const b = new THREE.Box3().setFromObject(o); b.mesh = o.parent; colliders.push(b);
  });
}
const ray = new THREE.Raycaster(); ray.far = 40; const DOWN = new THREE.Vector3(0, -1, 0), tmpV = new THREE.Vector3();
function groundAt(x, z, from) { tmpV.set(x, from, z); ray.set(tmpV, DOWN); const h = ray.intersectObjects(walkables, false).find(i => shown(i.object)); return h ? h.point.y : null; }
function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function enterWalk(spawn, third = false) {
  mode = 'walk'; controls.enabled = false; anim = null;
  if (spawn) { player.x = spawn[0]; player.z = spawn[1]; player.yaw = spawn[2]; player.pitch = -0.05; player.feet = spawn[3] ?? 40; const g = groundAt(player.x, player.z, player.feet + 1.3); player.feet = g ?? 0; }
  camera.fov = 72; camera.updateProjectionMatrix();
  for (const id of ['room', 'mini', 'hintWalk']) document.getElementById(id).hidden = false;
  document.getElementById('hintOrbit').hidden = true;
  document.getElementById('pad').hidden = !matchMedia('(pointer: coarse)').matches;
  player.vy = 0; setThird(third); const tip = document.getElementById('lockTip'); tip.textContent = third ? 'Hold left click and move to look around' : 'Click to look around with your mouse'; tip.hidden = locked;
  applyVisibility();
}
function exitWalk() {
  releaseAll();
  if (locked) document.exitPointerLock?.(); document.getElementById('lockTip').hidden = true;
  avatar.visible = false; AV.blob.visible = false; AV.third = false; queueMicrotask(syncModes);
  mode = 'orbit'; controls.enabled = true; camera.fov = orbitFov; camera.updateProjectionMatrix();
  for (const id of ['room', 'mini', 'hintWalk', 'pad']) document.getElementById(id).hidden = true;
  document.getElementById('hintOrbit').hidden = false;
}
function collide() {
  const r = 0.85, lo = player.feet + 1.0, hi = player.feet + 5.6;
  for (const b of colliders) {
    if (b.max.y < lo || b.min.y > hi || !shown(b.mesh)) continue;
    if (player.x + r <= b.min.x || player.x - r >= b.max.x || player.z + r <= b.min.z || player.z - r >= b.max.z) continue;
    const a = player.x + r - b.min.x, bb = b.max.x - (player.x - r), c = player.z + r - b.min.z, d = b.max.z - (player.z - r);
    const m = Math.min(a, bb, c, d);
    if (m === a) player.x -= a; else if (m === bb) player.x += bb; else if (m === c) player.z -= c; else player.z += d;
  }
}
// ---------- Avatar: blocky character for third-person "play" mode ----------
const avatar = new THREE.Group(); avatar.visible = false; scene.add(avatar);
const AV = { yaw: 0, phase: 0, amp: 0, third: false, dist: 12, pitch: .32, boom: 12, camY: 0, t: 0 };
const rig = new THREE.Group(); avatar.add(rig); avatar.scale.setScalar(.82);
{
  const skin = std({ color: '#d9a68b', roughness: .6 }), shirt = std({ color: '#26324a', roughness: .75 }), pants = std({ color: '#3a3d44', roughness: .8 }), shoe = std({ color: '#3a2a1f', roughness: .6 });
  const hair = std({ color: '#6b5440', roughness: .9 }), collar = std({ color: '#b9cbe6', roughness: .7 });
  // Hand-drawn head textures: forties, short salt-and-pepper hair, blue eyes, grey stubble, big smile.
  const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const SKIN = '#d9a68b';
  const hairFill = (g, x, y, w, h) => { g.fillStyle = '#7d7670'; g.fillRect(x, y, w, h);
    for (let i = 0; i < w * h / 7; i++) { const v = rnd(); g.fillStyle = v < .4 ? '#4f4741' : v < .75 ? '#9a948e' : '#c4bfb9'; g.fillRect(x + rnd() * w, y + rnd() * h, 2, 3); } };
  const stubble = (g, x, y, w, h, dens) => { for (let i = 0; i < w * h * dens; i++) { const v = rnd(); g.fillStyle = v < .5 ? 'rgba(90,80,72,.45)' : 'rgba(150,145,140,.45)'; g.fillRect(x + rnd() * w, y + rnd() * h, 1.6, 1.6); } };
  const faceTex = tex(g => {
    g.fillStyle = SKIN; g.fillRect(0, 0, 256, 256);
    const sh = g.createRadialGradient(128, 120, 40, 128, 128, 170); sh.addColorStop(0, 'rgba(255,230,210,.18)'); sh.addColorStop(1, 'rgba(120,70,50,.18)'); g.fillStyle = sh; g.fillRect(0, 0, 256, 256);
    hairFill(g, 0, 0, 256, 34); // short hairline, a little higher at the temples
    g.fillStyle = SKIN; g.beginPath(); g.moveTo(0, 34); g.quadraticCurveTo(30, 18, 52, 34); g.fill(); g.beginPath(); g.moveTo(256, 34); g.quadraticCurveTo(226, 18, 204, 34); g.fill();
    // forehead lines
    g.strokeStyle = 'rgba(140,90,70,.35)'; g.lineWidth = 2; for (const y of [58, 68]) { g.beginPath(); g.moveTo(92, y); g.quadraticCurveTo(128, y - 4, 164, y); g.stroke(); }
    // brows
    g.fillStyle = '#5b514a'; for (const x of [70, 150]) { g.beginPath(); g.moveTo(x, 92); g.quadraticCurveTo(x + 18, 80, x + 38, 90); g.lineTo(x + 38, 96); g.quadraticCurveTo(x + 18, 88, x, 98); g.fill(); }
    // eyes: whites, blue iris, pupil, glint, crow's feet
    for (const cx of [88, 168]) {
      g.fillStyle = '#f7f3ee'; g.beginPath(); g.ellipse(cx, 112, 16, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5f8fc4'; g.beginPath(); g.arc(cx, 112, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b2430'; g.beginPath(); g.arc(cx, 112, 3.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + 3, 109, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(120,75,55,.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, 113, 17, 10, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      const o = cx < 128 ? -1 : 1; g.strokeStyle = 'rgba(140,90,70,.4)'; g.lineWidth = 1.5;
      for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(cx + o * 19, 112 + d * .6); g.lineTo(cx + o * 28, 110 + d); g.stroke(); }
    }
    // nose
    g.strokeStyle = 'rgba(130,80,60,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(124, 118); g.quadraticCurveTo(118, 150, 128, 156); g.quadraticCurveTo(138, 158, 142, 152); g.stroke();
    // smile lines
    g.strokeStyle = 'rgba(130,80,60,.45)'; g.lineWidth = 2.5; for (const o of [-1, 1]) { g.beginPath(); g.moveTo(128 + o * 30, 150); g.quadraticCurveTo(128 + o * 46, 172, 128 + o * 40, 192); g.stroke(); }
    // grey stubble beard and moustache
    stubble(g, 50, 160, 156, 96, .55); stubble(g, 96, 158, 64, 16, .9); stubble(g, 34, 130, 26, 90, .35); stubble(g, 196, 130, 26, 90, .35);
    // big open smile with teeth
    g.fillStyle = '#7a2e2a'; g.beginPath(); g.moveTo(94, 180); g.quadraticCurveTo(128, 222, 162, 180); g.quadraticCurveTo(128, 192, 94, 180); g.fill();
    g.fillStyle = '#fbfaf6'; g.beginPath(); g.moveTo(98, 182); g.quadraticCurveTo(128, 196, 158, 182); g.lineTo(156, 190); g.quadraticCurveTo(128, 200, 100, 190); g.fill();
  });
  const sideTex = tex(g => { g.fillStyle = SKIN; g.fillRect(0, 0, 256, 256); hairFill(g, 0, 0, 256, 92); hairFill(g, 150, 92, 106, 50);
    g.fillStyle = '#c99479'; g.beginPath(); g.ellipse(118, 128, 18, 30, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,75,55,.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(118, 128, 10, 20, 0, -1, 2.2); g.stroke();
    stubble(g, 0, 150, 120, 106, .45); });
  const backTex = tex(g => { g.fillStyle = SKIN; g.fillRect(0, 0, 256, 256); hairFill(g, 0, 0, 256, 200); });
  const topTex = tex(g => hairFill(g, 0, 0, 256, 256));
  const part = (w, h, d, mat, x, y, z, par = rig) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); par.add(m); return m; };
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), [std({ map: sideTex, roughness: .7 }), std({ map: sideTex, roughness: .7 }), std({ map: topTex, roughness: .9 }), skin, std({ map: backTex, roughness: .85 }), std({ map: faceTex, roughness: .6 })]);
  head.position.y = 4.95; rig.add(head); AV.head = head;
  part(1.4, 1.9, .7, shirt, 0, 3.45, 0); part(.5, .35, .05, collar, 0, 4.22, -.37);
  const limb = (x, y, mat, len, w, end) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); rig.add(pv); part(w, len, w, mat, 0, -len / 2, 0, pv); if (end) part(w + .02, .35, w + (end === shoe ? .15 : .02), end, 0, -len + .17, end === shoe ? -.07 : 0, pv); return pv; };
  AV.armL = limb(-.94, 4.3, shirt, 1.95, .42, skin); AV.armR = limb(.94, 4.3, shirt, 1.95, .42, skin);
  AV.legL = limb(-.33, 2.5, pants, 2.5, .62, shoe); AV.legR = limb(.33, 2.5, pants, 2.5, .62, shoe);
  AV.blob = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false }));
  AV.blob.rotation.x = -Math.PI / 2; AV.blob.visible = false; scene.add(AV.blob);
}
const camRay = new THREE.Ray(), hitV = new THREE.Vector3(), headV = new THREE.Vector3(), boomV = new THREE.Vector3();
function boomLength(from, dir, max) { // pull the camera in front of any wall between it and the avatar
  camRay.set(from, dir); let best = max;
  for (const b of colliders) {
    if (b.max.y - b.min.y < 6 || b.distanceToPoint(from) > best || !shown(b.mesh)) continue;
    if (camRay.intersectBox(b, hitV)) { const d = hitV.distanceTo(from); if (d < best) best = d; }
  }
  return Math.max(1.2, best - .45);
}
function syncModes() {
  const m = mode !== 'walk' ? 'drone' : AV.third ? 'char' : 'walk';
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  uiSync();
}
let groundMode = 'char';
function setThird(on) {
  if (on && locked && !holdLock) document.exitPointerLock?.();
  AV.third = on; avatar.visible = on; AV.blob.visible = on; groundMode = on ? 'char' : 'walk';
  if (on) { AV.yaw = player.yaw; AV.pitch = .32; AV.boom = AV.dist; }
  syncModes();
  camera.fov = on ? 60 : 72; camera.updateProjectionMatrix();
  document.getElementById('hintWalk').innerHTML = on
    ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> run · <kbd>Space</kbd> jump · <kbd>Shift</kbd> sprint<br>Hold left click to turn the camera · scroll to zoom<br><kbd>Esc</kbd> or <b>Drone</b> to leave'
    : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · <kbd>Space</kbd> jump · <kbd>Shift</kbd> hurry<br>Click to look with the mouse<br><kbd>Esc</kbd> frees the mouse, again to leave';
}
function stepWalk(dt) {
  let f = 0, s = 0;
  if (keys.KeyW || keys.ArrowUp || keys.f) f += 1; if (keys.KeyS || keys.ArrowDown || keys.b) f -= 1;
  if (keys.KeyA || keys.l) s -= 1; if (keys.KeyD || keys.r) s += 1;
  if (keys.ArrowLeft) player.yaw += dt * 1.8; if (keys.ArrowRight) player.yaw -= dt * 1.8;
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 13 : 6.5) * dt;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const n = Math.hypot(f, s) || 1;
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    player.x += ((fx * f - fz * s) / n) * sp / steps; player.z += ((fz * f + fx * s) / n) * sp / steps;
    collide();
  }
  const g = groundAt(player.x, player.z, player.feet + 1.4);
  if (keys.Space && player.vy === 0 && g !== null && Math.abs(player.feet - g) < .35) player.vy = 15;
  if (player.vy !== 0 || (g !== null && player.feet > g + 1.6)) {
    player.vy -= 44 * dt; player.feet += player.vy * dt;
    if (g !== null && player.feet <= g) { player.feet = g; player.vy = 0; }
  } else if (g !== null) player.feet += (g - player.feet) * Math.min(1, dt * (g > player.feet ? 14 : 9));
  // HUD room lookup (also tells the camera whether there is a ceiling overhead)
  const lv = player.feet < -0.6 ? 'B' : player.feet < 9 ? 'M' : 'U';
  const RM = roomsOf(curHouse);
  let hit = null; for (const rm of RM) if (rm[1] === lv && rm[2].some(r => player.x >= r[0] && player.x <= r[1] && player.z >= r[2] && player.z <= r[3])) { hit = rm; break; }
  if (AV.third) {
    const moving = f !== 0 || s !== 0, sprint = keys.ShiftLeft || keys.ShiftRight, air = player.vy !== 0;
    AV.t += dt;
    if (moving) {
      const mx = fx * f - fz * s, mz = fz * f + fx * s; let d = Math.atan2(-mx, -mz) - AV.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      AV.yaw += d * Math.min(1, dt * 10);
      AV.phase += dt * (sprint ? 13 : 9);
    }
    AV.amp += ((moving && !air ? (sprint ? .85 : .6) : 0) - AV.amp) * Math.min(1, dt * 8);
    const sw = Math.sin(AV.phase) * AV.amp, ease = Math.min(1, dt * 14);
    const tgt = air ? { lL: .45, lR: -.3, aL: -.9, aR: -.9 } : { lL: sw, lR: -sw, aL: -sw * .8 + Math.sin(AV.t * 1.6) * .03, aR: sw * .8 - Math.sin(AV.t * 1.6) * .03 };
    AV.legL.rotation.x += (tgt.lL - AV.legL.rotation.x) * ease; AV.legR.rotation.x += (tgt.lR - AV.legR.rotation.x) * ease;
    AV.armL.rotation.x += (tgt.aL - AV.armL.rotation.x) * ease; AV.armR.rotation.x += (tgt.aR - AV.armR.rotation.x) * ease;
    AV.armL.rotation.z = -.06; AV.armR.rotation.z = .06;
    rig.position.y = Math.abs(Math.sin(AV.phase)) * .18 * AV.amp + (moving ? 0 : Math.sin(AV.t * 2) * .03);
    rig.rotation.x = -.12 * AV.amp;
    avatar.position.set(player.x, player.feet, player.z); avatar.rotation.y = AV.yaw;
    AV.blob.position.set(player.x, (g ?? player.feet) + .04, player.z);
    // camera: boom behind and above, eases back out after a wall pushes it in, never pokes through the ceiling
    headV.set(player.x, player.feet + 4.3, player.z);
    const e = AV.pitch; boomV.set(Math.sin(player.yaw) * Math.cos(e), Math.sin(e), Math.cos(player.yaw) * Math.cos(e));
    const want = boomLength(headV, boomV, AV.dist);
    AV.boom = want < AV.boom ? want : AV.boom + (want - AV.boom) * Math.min(1, dt * 3);
    camera.position.copy(headV).addScaledVector(boomV, AV.boom);
    const cap = hit ? player.feet + 7.4 : Infinity;
    AV.camY = Math.min(camera.position.y, cap);
    camera.position.y = AV.camY;
    camera.lookAt(headV.x, headV.y + .4, headV.z);
    avatar.visible = AV.boom > 2.4; AV.blob.visible = true;
  } else {
    camera.position.set(player.x, player.feet + 5.4, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }
  const lvName = { B: 'Basement', M: 'Main floor', U: '2nd floor' }[lv];
  document.getElementById('roomName').textContent = hit ? hit[0] : (lv === 'M' && player.feet < 1.5 ? 'Outside' : lvName);
  document.getElementById('roomDim').textContent = hit ? `${lvName} · ${ftin(hit[2][0][1] - hit[2][0][0])} × ${ftin(hit[2][0][3] - hit[2][0][2])}` : 'Lot 49 · 39.62 m × 41.86 m';
  drawMini(lv);
}
// drag to look
let drag = null;
// Looking around: drag (touch or mouse), or click once to lock the mouse so the view follows it like a game.
let locked = false;
function look(dx, dy, k) {
  player.yaw -= dx * k;
  if (AV.third) AV.pitch = Math.max(-.05, Math.min(1.2, AV.pitch + dy * k * .9));
  else player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - dy * k));
}
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === renderer.domElement; if (!locked) holdLock = false; document.getElementById('lockTip').hidden = true; });
renderer.domElement.addEventListener('pointerdown', e => {
  if (mode !== 'walk') return;
  const wantLock = e.pointerType === 'mouse' && !locked && renderer.domElement.requestPointerLock && (!AV.third || e.button === 0);
  if (wantLock) { holdLock = AV.third; try { const r = renderer.domElement.requestPointerLock(); r?.catch?.(() => { }); } catch (err) { } }
  drag = { x: e.clientX, y: e.clientY }; document.getElementById('lockTip').hidden = true;
});
let holdLock = false;
renderer.domElement.addEventListener('pointermove', e => {
  if (mode !== 'walk') return;
  if (locked) return look(e.movementX, e.movementY, AV.third ? .0035 : .0028);
  if (!drag) return;
  look(e.clientX - drag.x, e.clientY - drag.y, e.pointerType === 'mouse' ? .009 : .007); drag = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('wheel', e => { if (mode === 'walk' && AV.third) { AV.dist = Math.max(4, Math.min(24, AV.dist + e.deltaY * .012)); e.preventDefault(); } }, { passive: false });
addEventListener('pointerup', () => { drag = null; if (holdLock) { holdLock = false; document.exitPointerLock?.(); } });
// Movement keys. Browsers sometimes never send the "key released" event (after a ⌘/Ctrl shortcut, a focus change,
// or a dialog), which used to leave the character walking on its own. So: release everything on
// those events, and let go of any key that stops sending its held-down repeats.
const releaseAll = () => { for (const k in keys) keys[k] = false; };
addEventListener('keydown', e => {
  if (e.target.closest?.('select,input,textarea')) return;
  if (e.metaKey || (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight')) { releaseAll(); return; } // shortcuts, not movement
  keys[e.code] = true;
  if (e.code === 'Escape' && mode === 'walk') goView(curView);
  if (mode === 'walk' && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.key === 'Meta' || e.key === 'Control') releaseAll(); });
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
addEventListener('contextmenu', releaseAll);
document.querySelectorAll('#pad button').forEach(b => {
  const k = b.dataset.k; b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys[k] = false);
});

// minimap
const mini = document.getElementById('miniC'), mg = mini.getContext('2d');
const OUTLINE = { B: [P_B], M: [P_M, P_GAR], U: [P_U.map(([x, z]) => [x, z + UZ])] };
function drawMini(lv) {
  const W = mini.width, H = mini.height, s = 4.6, ox = 70, oz = 14;
  const X = x => (x + ox - 50) * s + 20, Z = z => (z + oz) * s;
  const css = getComputedStyle(document.documentElement);
  mg.clearRect(0, 0, W, H);
  mg.lineWidth = 2; mg.strokeStyle = css.getPropertyValue('--ink-2'); mg.fillStyle = css.getPropertyValue('--paper-2');
  for (const poly of outlineOf(curHouse)[lv] || []) { mg.beginPath(); poly.forEach(([x, z], i) => i ? mg.lineTo(X(x), Z(z)) : mg.moveTo(X(x), Z(z))); mg.closePath(); mg.fill(); mg.stroke(); }
  mg.lineWidth = 1; mg.strokeStyle = css.getPropertyValue('--rule');
  for (const rm of roomsOf(curHouse)) if (rm[1] === lv) for (const r of rm[2]) mg.strokeRect(X(r[0]), Z(r[2]), (r[1] - r[0]) * s, (r[3] - r[2]) * s);
  const px = X(player.x), pz = Z(player.z), fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  mg.fillStyle = css.getPropertyValue('--accent');
  mg.beginPath(); mg.moveTo(px + fx * 16, pz + fz * 16); mg.lineTo(px - fz * 7 - fx * 5, pz + fx * 7 - fz * 5); mg.lineTo(px + fz * 7 - fx * 5, pz - fx * 7 - fz * 5); mg.closePath(); mg.fill();
}

// =====================================================================
//  FINISHES
// =====================================================================
const FIN = [
  ['Exterior', [
    ['stucco', 'Stucco (EIFS)', [['White', '#f1f0ec'], ['Warm white', '#ebe3d4'], ['Pale grey', '#cfd0cc'], ['Charcoal', '#55585c']], c => M.stucco.color.set(c)],
    ['siding', 'Board & batten', [['Charcoal', '#767a80'], ['Black', '#4f5256'], ['White', '#f0efeb'], ['Sage', '#9aa58f']], c => M.batten.color.set(c)],
    ['stone', 'Stone veneer', [['Light ledgestone', '#dcd6ca'], ['Limestone', '#d2bd98'], ['Charcoal', '#727170']], c => M.stone.color.set(c)],
    ['roof', 'Shingles', [['Charcoal', '#45474a'], ['Black', '#28292c'], ['Weathered', '#6b5a49']], c => M.roof.color.set(c)],
    ['trim', 'Windows & fascia', [['Black', '#1e1f22'], ['Bronze', '#4d3b2c'], ['White', '#ecebe7']], c => M.trim.color.set(c)],
  ]],
  ['Interior', [
    ['floor', 'Main flooring', [['Light oak', '#e0c49c'], ['Natural oak', '#bf9364'], ['Walnut', '#7a563c'], ['Grey oak', '#b9b2a8']], c => M.wood.color.set(c)],
    ['paint', 'Wall paint', [['Gallery white', '#f4f3ef'], ['Greige', '#ddd4c6'], ['Warm grey', '#c9c4bc'], ['Sage', '#c7cdb9'], ['Mist blue', '#cbd5dc']], c => M.paint.color.set(c)],
    ['cab', 'Cabinets', [['White', '#f2f2ef'], ['Navy', '#2f3b52'], ['Walnut', '#6c4a31'], ['Matte black', '#2a2b2c'], ['Sage', '#97a38b']], c => M.cab.color.set(c)],
    ['counter', 'Countertops', [['White quartz', '#f2f2f0'], ['Black granite', '#2c2c2e'], ['Concrete', '#aaa79f']], c => M.counter.color.set(c)],
    ['tile', 'Bath & mud tile', [['Warm white', '#e4e2dc'], ['Stone grey', '#a9a8a3'], ['Slate', '#5b5f63']], c => M.tile.color.set(c)],
  ]],
];
let saved = {}; try { saved = JSON.parse(localStorage.getItem('walkthru-finishes-v2') || '{}'); } catch (e) { }
// Finishes belong to the design when it lives in the Studio (cloud.js sets finishHook); otherwise they're remembered in this browser.
let finishHook = null, finishMute = false; const FIN_PICK = {};
function applyFinishes(map) { finishMute = true; for (const k in FIN_PICK) FIN_PICK[k](map?.[k] ?? 0); finishMute = false; }
const fb = document.getElementById('finishBody');
for (const [sec, items] of FIN) {
  const h = document.createElement('div'); h.className = 'grp'; h.dataset.sec = sec; h.innerHTML = `<h3>${sec}</h3>`; fb.appendChild(h);
  for (const [key, label, opts, apply] of items) {
    const g = document.createElement('div'); g.className = 'grp'; g.dataset.sec = sec; g.innerHTML = `<h3 style="text-transform:none;letter-spacing:0;color:var(--ink)">${label}</h3>`;
    const sw = document.createElement('div'); sw.className = 'sw'; g.appendChild(sw); fb.appendChild(g);
    const pick = (i) => { i = Math.min(i, opts.length - 1); apply(opts[i][1]); sw.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      if (finishHook) { if (!finishMute) finishHook(key, i); return; } saved[key] = i; try { localStorage.setItem('walkthru-finishes-v2', JSON.stringify(saved)); } catch (e) { } };
    FIN_PICK[key] = pick;
    opts.forEach(([n, c], i) => { const b = document.createElement('button'); b.id = `sw-${key}-${i}`; b.innerHTML = `<i style="background:${c}"></i>${n}`; b.onclick = () => pick(i); sw.appendChild(b); });
    pick(Math.min(saved[key] ?? 0, opts.length - 1));
  }
}

// =====================================================================
//  UI wiring
// =====================================================================
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => goView(b.dataset.view));
function setMode(m) {
  if (m === 'drone') { if (mode === 'walk') goView(curView); return; }
  if (mode === 'walk') setThird(m === 'char'); else enterWalk(HOUSES[curHouse].front, m === 'char');
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { setMode(b.dataset.mode); b.blur(); });
document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => b.blur()));
const sel = document.getElementById('goto');
function fillGoto() {
  const RM = roomsOf(curHouse), lvls = curHouse === 2 ? ['M', 'U'] : ['M', 'U', 'B'].filter(l => RM.some(r => r[1] === l));
  sel.innerHTML = '<option value="">Choose a room…</option>' + lvls.map(lv => `<optgroup label="${{ M: 'Main floor', U: '2nd floor', B: 'Basement' }[lv]}">` + RM.map((r, i) => r[1] === lv ? `<option value="${i}">${r[0]}</option>` : '').join('') + '</optgroup>').join('')
    + '<optgroup label="Outside"><option value="yard">Backyard &amp; pool</option><option value="drive">Driveway</option></optgroup>';
  uiSync();
}
sel.onchange = () => {
  const v = sel.value; sel.value = ''; sel.blur(); if (!v) return;
  const H = HOUSES[curHouse];
  const third = mode === 'walk' ? AV.third : groundMode === 'char';
  if (v === 'yard') return enterWalk(H.yard, third);
  if (v === 'drive') return enterWalk(H.drive, third);
  const r = roomsOf(curHouse)[+v]; enterWalk([r[3][0], r[3][1], r[3][2], H.levelY[r[1]] + 1], third);
};
// House 1 / House 2 tabs
function setHouse(n, fromHash) {
  const tab = n; if (n === 4) n = 3;
  if (n === 3 && usePreset(tab === 4)) { PE.sel = PE.selStair = PE.selWall = null; PE.hist = []; if (PE.open && tab === 4) openEditor(false); rebuildHouse3(); }
  curHouse = n;
  document.querySelectorAll('[data-house]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.house === tab)));
  document.querySelector('#brand h1').textContent = tab === 4 ? '1196 Campana Cres' : n === 3 ? 'My design' : `Sample house ${n}`;
  const eb = document.getElementById('editBtn'); eb.hidden = n !== 3; setEditLabel(tab === 4 ? 'Edit a copy' : 'Edit plan'); eb.title = tab === 4 ? 'Copy House 3 into your designs and edit it' : '';
  if (n !== 3 && PE.open) openEditor(false);
  document.getElementById('houseNote').innerHTML = tab === 4 ? H3_NOTE : HOUSES[n].note;
  document.querySelector('[data-view="B"]').hidden = n === 2;
  document.querySelectorAll('[data-sec="Exterior"]').forEach(el => el.hidden = n === 2);
  fillGoto();
  if (!fromHash) try { history.replaceState(null, '', HASHES[tab] || location.pathname + location.search); } catch (e) { }
  goView(curView === 'B' && n === 2 ? 'M' : curView, true);
}
document.querySelectorAll('[data-house]').forEach(b => b.onclick = () => { if (+b.dataset.house !== tabHouse()) setHouse(+b.dataset.house); });
addEventListener('hashchange', () => { const n = houseFromHash(); if (n !== tabHouse()) setHouse(n, true); });
{
  const peg = document.getElementById('peg'), ghost = document.getElementById('pegGhost'), ndc = new THREE.Vector2(), pr = new THREE.Raycaster();
  let st = null;
  peg.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, moved: false }; peg.setPointerCapture(e.pointerId); e.preventDefault(); });
  peg.addEventListener('pointermove', e => {
    if (!st) return; if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 6) st.moved = true;
    if (st.moved) { ghost.hidden = false; ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  });
  peg.addEventListener('pointerup', e => {
    const s0 = st; st = null; ghost.hidden = true; if (!s0) return;
    if (!s0.moved) return enterWalk(HOUSES[curHouse].front, true);
    if (document.elementFromPoint(e.clientX, e.clientY) !== renderer.domElement) return;
    if (mode === 'walk') exitWalk();
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); pr.setFromCamera(ndc, camera);
    const h = pr.intersectObjects(walkables, false).find(i => shown(i.object));
    if (!h) return enterWalk(HOUSES[curHouse].front, true);
    const yaw = Math.atan2(-(h.point.x - camera.position.x), -(h.point.z - camera.position.z));
    curView = 'front'; enterWalk([h.point.x, h.point.z, yaw, h.point.y + .5], true);
  });
}
const tod = document.getElementById('tod'); tod.oninput = () => setSun(+tod.value);
document.getElementById('optLabels').onchange = e => { showLabels = e.target.checked; applyVisibility(); };
document.getElementById('optFurn').onchange = e => { showFurn = e.target.checked; applyVisibility(); };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; updateViewOffset(); renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight); });

// =====================================================================
//  START
// =====================================================================
// Merge static meshes that share a material into one draw call per group (big speed-up).
function mergeStatic(root) {
  const walkSet = new Set(walkables);
  const clean = g => { const out = new THREE.BufferGeometry(); out.setAttribute('position', g.attributes.position);
    if (!g.attributes.normal) g.computeVertexNormals(); out.setAttribute('normal', g.attributes.normal);
    out.setAttribute('uv', g.attributes.uv ?? new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return out; };
  const slice = (g, start, count) => { const out = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k]; if (a) out.setAttribute(k, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize)); }
    return out; };
  root.traverse(obj => {
    if (!obj.children.length) return;
    const buckets = new Map(), victims = [];
    for (const m of obj.children) {
      if (!m.isMesh || walkSet.has(m) || !m.visible || m.children.length) continue;
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(m.matrix);
      const mats = Array.isArray(m.material) ? m.material : null;
      const parts = mats ? (g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }]).map(gr => [slice(g, gr.start, gr.count), mats[gr.materialIndex]]) : [[g, m.material]];
      for (const [pg, mat] of parts) { if (!mat) continue; const key = mat.uuid + (m.castShadow ? 'c' : ''); if (!buckets.has(key)) buckets.set(key, { mat, cast: m.castShadow, list: [] }); buckets.get(key).list.push(clean(pg)); }
      victims.push(m);
    }
    if (victims.length < 2) return;
    for (const v of victims) { obj.remove(v); v.geometry.dispose(); }
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.list, false); if (!merged) continue;
      const mm = new THREE.Mesh(merged, b.mat); mm.castShadow = b.cast; mm.receiveShadow = true; obj.add(mm);
    }
  });
}
setSun(15); buildColliders(); mergeStatic(HOUSE1); mergeStatic(HOUSE2);
const baseColliders = colliders.slice();
// Rebuild "My Design" from the room plan: geometry, colliders, merged meshes, labels, camera views.
function rebuildHouse3() {
  buildHouse3();
  scene.updateMatrixWorld(true);
  const cols = []; HOUSE3.traverse(o => { if (o.isMesh && o.userData.solid) { const b = new THREE.Box3().setFromObject(o); b.mesh = o.parent; cols.push(b); } });
  colliders = baseColliders.concat(cols);
  mergeStatic(HOUSE3);
  for (const o of labelObjs.filter(o => o.userData.house === 3)) { scene.remove(o); labelObjs.splice(labelObjs.indexOf(o), 1); }
  for (const [name, lv, rs] of ROOMS3) { const r = rs[0], el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = `${name}<small>${ftin(r[1] - r[0])} × ${ftin(r[3] - r[2])}</small>`;
    const o = new CSS2DObject(el); o.position.set((r[0] + r[1]) / 2, LEVEL_Y[lv] + .5, (r[2] + r[3]) / 2); o.userData.lv = lv; o.userData.house = 3; scene.add(o); labelObjs.push(o); }
  updateViews3();
  if (curHouse === 3) { applyVisibility(); fillGoto(); }
  renderer.shadowMap.needsUpdate = true;
}
// Camera views for My Design, framed on the design (pulled back a little while the editor narrows the screen).
function updateViews3() {
  const rs = BM.rooms.length ? BM.rooms : [{ x: 0, z: 0, w: 30, d: 30 }];
  const x0 = Math.min(...rs.map(r => r.x)), x1 = Math.max(...rs.map(r => r.x + r.w)), z0 = Math.min(...rs.map(r => r.z)), z1 = Math.max(...rs.map(r => r.z + r.d)), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const sz = Math.max(x1 - x0, z1 - z0, 30) * (editorWidth() ? Math.min(1.7, .55 + .45 * innerWidth / Math.max(260, innerWidth - editorWidth())) : 1), V = HOUSES[3].views;
  V.front = { pos: [cx - sz * .9, sz * .55, z0 - sz * 1.3], tgt: [cx, 8, cz] }; V.rear = { pos: [cx + sz * .9, sz * .6, z1 + sz * 1.3], tgt: [cx, 8, cz] };
  V.aerial = { pos: [cx + sz * 1.6, sz * 2.2, z0 - sz * 1.4], tgt: [cx, 0, cz] };
  for (const [k, y] of [['B', BF], ['M', MF], ['U', UF]]) V[k] = { pos: [cx, sz * 1.7, cz + sz * .85], tgt: [cx, y, cz] };
}
// While the floor plan editor covers the left side, shift the 3D picture so its centre sits in the visible right panel.
function editorWidth() { return PE.open && innerWidth > 760 ? document.getElementById('planEd').getBoundingClientRect().width : 0; }
// Keep the picture centred in the space the toolbar, editor and side panel leave free.
function updateViewOffset() {
  const E = editorWidth(), I = uiInsets(), x = (I.r + I.p - I.l - E) / 2, y = (I.b - I.t) / 2;
  if (x || y) camera.setViewOffset(innerWidth, innerHeight, x, y, innerWidth, innerHeight); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
rebuildHouse3();
setHouse(startHouse, true); goView('front', true); syncModes();
document.getElementById('loading').remove();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === 'walk') stepWalk(dt);
  else {
    if (anim) { anim.t = Math.min(1, anim.t + dt / 0.9); const e = 1 - Math.pow(1 - anim.t, 3);
      camera.position.lerpVectors(anim.from.p, anim.to.p, e); controls.target.lerpVectors(anim.from.t, anim.to.t, e); if (anim.t >= 1) anim = null; }
    controls.update();
  }
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
});
