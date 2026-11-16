import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- Units: everything is stored in feet; these only change what people see and type ----------
var METRIC = false; try { METRIC = localStorage.getItem('walkthru-units') === 'metric'; } catch (e) { }
const ftin = v => { if (METRIC) { const m = v * .3048; return Math.abs(m) < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`; } const t = Math.round(v * 12); return `${Math.floor(t / 12)}'-${t % 12}"`; };
const fmtArea = sf => METRIC ? `${(sf * .092903).toLocaleString(undefined, { maximumFractionDigits: sf * .0929 < 100 ? 1 : 0 })} m²` : `${Math.round(sf).toLocaleString()} sf`;
const U_LEN = () => METRIC ? 'm' : 'ft', U_AREA = () => METRIC ? 'm²' : 'sq ft';
const toDisp = ft => METRIC ? +(ft * .3048).toFixed(2) : +(+ft).toFixed(2), fromDisp = v => METRIC ? v / .3048 : v;
const SCALE_BAR = () => METRIC ? [3 / .3048, '3 m'] : [10, "10'"];

// ---------- Levels (feet, grade = 0) from wall section A-2.01 ----------
const BF = -6.75, BC = 1.25, TF = 1.17, MF = 2.33, MC = 11.43, UF = 12.47, UC = 20.56, GF = 0.5;
const UZ = 2.54; // 2nd floor plan is set back 2'-6½" from the main front wall
const EXT = 0.67, INT = 0.4;
// Built-in sample houses and the sample plan are hidden: everything starts empty. Set true to bring them back.
const SAMPLES = false;
const blankPlan = () => ({ roof: 'hip', rooms: [], stairs: [] });
const starterPlan = () => SAMPLES ? permitPlan() : blankPlan();

// ---------- Renderer / scene ----------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // shadows are re-rendered only when the scene changes
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
labelRenderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.fog = new THREE.Fog(0xcfd9e2, 350, 1100);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 2600);
camera.rotation.order = 'YXZ';

// ---------- Procedural textures (world UVs are in feet) ----------
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function ctex(size, ft, draw, seed = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size, rnd(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / ft, 1 / ft); t.anisotropy = 8; return t;
}
function noise(g, s, r, base, amp, n = 9000, sz = 2) {
  g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { const v = base + (r() - .5) * amp | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * s, r() * s, sz, sz); }
}
const TX = {
  stucco: ctex(256, 6, (g, s, r) => noise(g, s, r, 238, 22, 14000, 2)),
  paint: ctex(128, 8, (g, s, r) => noise(g, s, r, 246, 8, 3000, 2)),
  limestone: ctex(512, 8, (g, s, r) => {
    g.fillStyle = '#d9d5cd'; g.fillRect(0, 0, s, s);
    const rh = s / 6;
    for (let i = 0; i < 6; i++) { let x = -r() * 200;
      while (x < s) { const w = 110 + r() * 150; const v = 238 + r() * 16 | 0;
        g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(x + 2, i * rh + 2, w - 3, rh - 3);
        for (let k = 0; k < 120; k++) { const q = v - 8 + r() * 12 | 0; g.fillStyle = `rgba(${q},${q - 2},${q - 6},.5)`; g.fillRect(x + r() * w, i * rh + r() * rh, 2, 2); }
        x += w; } }
  }, 37),
  seam: ctex(128, 1.5, (g, s, r) => { noise(g, s, r, 200, 14, 800, 2); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, 3, s); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(3, 0, 2, s); }, 41),
  stone: ctex(512, 6, (g, s, r) => {
    g.fillStyle = '#9a968f'; g.fillRect(0, 0, s, s);
    let y = 0; while (y < s) { const h = 10 + r() * 22 | 0; let x = -r() * 80;
      while (x < s) { const w = 40 + r() * 120; const v = 170 + r() * 80 | 0;
        g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x + 2, y + 2, w - 3, h - 3);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + 2, y + h - 4, w - 3, 2); x += w; }
      y += h; }
  }, 7),
  shingle: ctex(512, 4, (g, s, r) => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, s, s);
    const rows = 12, rh = s / rows;
    for (let i = 0; i < rows; i++) { let x = (i % 2) * 20 - 20;
      while (x < s) { const w = 26 + r() * 34; const v = 150 + r() * 60 | 0;
        g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, i * rh, w - 2, rh - 3);
        for (let k = 0; k < 30; k++) { const q = v + (r() - .5) * 50 | 0; g.fillStyle = `rgb(${q},${q},${q})`; g.fillRect(x + r() * w, i * rh + r() * rh, 2, 2); }
        x += w; }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * rh + rh - 3, s, 3); }
  }, 3),
  wood: ctex(512, 4, (g, s, r) => {
    const pw = s / 8;
    for (let i = 0; i < 8; i++) { let y = -r() * 300;
      while (y < s) { const l = 160 + r() * 260; const v = 175 + r() * 55 | 0;
        g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * pw, y, pw, l);
        for (let k = 0; k < 14; k++) { const q = v - 15 - r() * 25 | 0; g.strokeStyle = `rgba(${q},${q},${q},.5)`; g.lineWidth = 1;
          g.beginPath(); const gx = i * pw + r() * pw; g.moveTo(gx, y); g.bezierCurveTo(gx + 4, y + l / 3, gx - 4, y + 2 * l / 3, gx + (r() - .5) * 6, y + l); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(i * pw, y, pw, 1.5); y += l; }
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(i * pw, 0, 1.5, s); }
  }, 11),
  tile: ctex(256, 4, (g, s, r) => { noise(g, s, r, 235, 14, 4000, 2); g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, 0, s, 2); g.fillRect(0, s / 2, s, 2); g.fillRect(0, 0, 2, s); g.fillRect(s / 2, 0, 2, s); }, 5),
  carpet: ctex(128, 2, (g, s, r) => noise(g, s, r, 225, 40, 6000, 1), 9),
  grass: ctex(256, 10, (g, s, r) => { g.fillStyle = '#5f8a3e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16000; i++) { const h = 80 + r() * 50, l = 25 + r() * 25; g.fillStyle = `hsl(${h},45%,${l}%)`; g.fillRect(r() * s, r() * s, 1.5, 3); } }, 13),
  concrete: ctex(256, 10, (g, s, r) => noise(g, s, r, 205, 30, 12000, 2), 17),
  asphalt: ctex(256, 10, (g, s, r) => noise(g, s, r, 70, 40, 16000, 2), 19),
  pavers: ctex(256, 4, (g, s, r) => { g.fillStyle = '#8f8a80'; g.fillRect(0, 0, s, s);
    const h = s / 4; for (let i = 0; i < 4; i++) for (let j = -1; j < 3; j++) { const v = 190 + r() * 40 | 0;
      g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(j * s / 2 + (i % 2) * s / 4 + 2, i * h + 2, s / 2 - 4, h - 4); } }, 23),
  deck: ctex(256, 4, (g, s, r) => { for (let i = 0; i < 8; i++) { const v = 150 + r() * 40 | 0;
      g.fillStyle = `rgb(${v},${v * .78 | 0},${v * .6 | 0})`; g.fillRect(0, i * s / 8, s, s / 8 - 3); } }, 29),
  water: ctex(256, 12, (g, s, r) => { g.fillStyle = '#3aa3c8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(255,255,255,${.05 + r() * .12})`; g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 22, y); g.stroke(); } }, 31),
};

// ---------- Materials ----------
const std = (o) => new THREE.MeshStandardMaterial(o);
const M = {
  stucco: std({ map: TX.stucco, color: '#f1f0ec', roughness: .95 }),
  paint: std({ map: TX.paint, color: '#f4f3ef', roughness: .9 }),
  ceil: std({ color: '#fbfbf9', roughness: .95, side: THREE.DoubleSide, emissive: '#e9e8e3', emissiveIntensity: .45 }),
  stone: std({ map: TX.stone, color: '#dcd6ca', roughness: .9 }),
  roof: std({ map: TX.shingle, color: '#45474a', roughness: .9, side: THREE.DoubleSide }),
  trim: std({ color: '#1e1f22', roughness: .5, metalness: .2 }),
  // House 2 exterior (fixed photo look)
  lime: std({ map: null, color: '#f3f1ec', roughness: .92, side: THREE.DoubleSide }),
  roof2: std({ map: null, color: '#26272a', roughness: .85, side: THREE.DoubleSide }),
  trim2: std({ color: '#151618', roughness: .45, metalness: .25 }),
  metal: std({ map: null, color: '#2d2f33', roughness: .38, metalness: .55, side: THREE.DoubleSide }),
  soffit: std({ color: '#2a2b2e', roughness: .7, side: THREE.DoubleSide }),
  white: std({ color: '#f6f6f3', roughness: .55 }),
  glass: new THREE.MeshStandardMaterial({ color: '#9db8c6', roughness: .05, metalness: .1, transparent: true, opacity: .26, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 }),
  frost: std({ color: '#dfe7ea', roughness: .3, transparent: true, opacity: .75 }),
  wood: std({ map: TX.wood, color: '#e0c49c', roughness: .6 }),
  tile: std({ map: TX.tile, color: '#e4e2dc', roughness: .35 }),
  btile: std({ map: TX.tile, color: '#cfd3d4', roughness: .3 }),
  carpet: std({ map: TX.carpet, color: '#cfc6b8', roughness: 1 }),
  lvp: std({ map: TX.wood, color: '#b7a58c', roughness: .6 }),
  concrete: std({ map: TX.concrete, color: '#c9c7c2', roughness: .95 }),
  found: std({ map: TX.concrete, color: '#a9a7a2', roughness: .95 }),
  grass: std({ map: TX.grass, color: '#ffffff', roughness: 1 }),
  asphalt: std({ map: TX.asphalt, color: '#ffffff', roughness: .95 }),
  pavers: std({ map: TX.pavers, color: '#ffffff', roughness: .9 }),
  deck: std({ map: TX.deck, color: '#ffffff', roughness: .8 }),
  water: std({ map: TX.water, color: '#ffffff', roughness: .08, metalness: .1, transparent: true, opacity: .88 }),
  pooltile: std({ color: '#7cc3dc', roughness: .4 }),
  cab: std({ color: '#f2f2ef', roughness: .5 }),
  counter: std({ color: '#f2f2f0', roughness: .2 }),
  steel: std({ color: '#b9bdc1', roughness: .3, metalness: .75 }),
  black: std({ color: '#1b1c1e', roughness: .35 }),
  porcelain: std({ color: '#fbfbfb', roughness: .15 }),
  fabric: std({ color: '#8d9091', roughness: 1 }),
  fabric2: std({ color: '#5d6b74', roughness: 1 }),
  leather: std({ color: '#7a5236', roughness: .6 }),
  bedding: std({ color: '#ecebe6', roughness: 1 }),
  throwc: std({ color: '#3f5568', roughness: 1 }),
  walnut: std({ color: '#5e4330', roughness: .55 }),
  oak: std({ color: '#b48b5e', roughness: .6 }),
  rug: std({ color: '#c3b9a9', roughness: 1 }),
  rug2: std({ color: '#7e8790', roughness: 1 }),
  tv: std({ color: '#0d0e10', roughness: .15, metalness: .4 }),
  flame: new THREE.MeshBasicMaterial({ color: '#ffae4a' }),
  bulb: new THREE.MeshBasicMaterial({ color: '#fff3d6' }),
  felt: std({ color: '#2f6b4a', roughness: 1 }),
  leaf: std({ color: '#4f7a37', roughness: 1 }),
  leaf2: std({ color: '#3d6630', roughness: 1 }),
  bark: std({ color: '#5a4636', roughness: 1 }),
  fence: std({ color: '#8a7059', roughness: .9 }),
  car: std({ color: '#3d4f63', roughness: .25, metalness: .6 }),
  clothes: [std({ color: '#2f3e52', roughness: 1 }), std({ color: '#c9b79a', roughness: 1 }), std({ color: '#8a3b33', roughness: 1 }), std({ color: '#e8e5de', roughness: 1 }), std({ color: '#55684b', roughness: 1 })],
};

M.lime.map = TX.limestone; M.roof2.map = TX.shingle; M.metal.map = TX.seam;

// ---------- Scene graph per level ----------
const G = {};
for (const k of ['site', 'basement', 'main', 'mainCeil', 'upper', 'upperCeil', 'roof', 'furnB', 'furnM', 'furnU', 'furnS'])
  G[k] = new THREE.Group();
G.upper.position.z = UZ; G.upperCeil.position.z = UZ; G.furnU.position.z = UZ;
const HOUSE1 = new THREE.Group(); scene.add(HOUSE1);
for (const k in G) HOUSE1.add(G[k]);
const walkables = [];

// ---------- Geometry helpers ----------
function worldUV(g, cx, cy, cz) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, y = p.getY(i) + cy, z = p.getZ(i) + cz;
    if (Math.abs(n.getX(i)) > .5) uv.setXY(i, z, y); else if (Math.abs(n.getY(i)) > .5) uv.setXY(i, x, z); else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}
function box(parent, x0, x1, y0, y1, z0, z1, mat, o = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (z1 < z0) [z0, z1] = [z1, z0];
  const w = x1 - x0, h = y1 - y0, d = z1 - z0; if (w < .005 || h < .005 || d < .005) return null;
  const g = new THREE.BoxGeometry(w, h, d); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  worldUV(g, cx, cy, cz);
  const m = new THREE.Mesh(g, mat); m.position.set(cx, cy, cz);
  m.castShadow = o.cast !== false && mat !== M.glass; m.receiveShadow = true;
  if (o.solid) m.userData.solid = true; if (o.walk) walkables.push(m);
  parent.add(m); return m;
}
function cyl(parent, x, z, r, y0, y1, mat, seg = 20, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, o.r2 ?? r, y1 - y0, seg), mat);
  m.position.set(x, (y0 + y1) / 2, z); m.castShadow = true; m.receiveShadow = true;
  if (o.solid) m.userData.solid = true; parent.add(m); return m;
}
function shapeOf(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
function flat(parent, pts, holes, y, mat, o = {}) {
  const g = new THREE.ShapeGeometry(shapeOf(pts, holes)); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; m.castShadow = !!o.cast;
  if (o.walk) walkables.push(m); parent.add(m); return m;
}
function slab(parent, pts, holes, y0, y1, mat, o = {}) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts, holes), { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = y0; m.castShadow = o.cast !== false; m.receiveShadow = true;
  if (o.walk) walkables.push(m); parent.add(m); return m;
}
// box addressed by (along, normal) coordinates for axis-aligned walls
function boxAN(parent, horiz, sa, sb, ya, yb, na, nb, mat, o) {
  return horiz ? box(parent, sa, sb, ya, yb, na, nb, mat, o) : box(parent, na, nb, ya, yb, sa, sb, mat, o);
}
