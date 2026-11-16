
// =====================================================================
//  EXTRAS — your own textures on finishes, a printable PDF plan sheet, 360° panoramas, and video recording.
// =====================================================================

// ---------- textures from your own photos ----------
const TEX_MAT = { stucco: ['Stucco', M.stucco], siding: ['Board & batten', M.batten], stone: ['Stone veneer', M.stone], roof: ['Shingles', M.roof], floor: ['Main flooring', M.wood], paint: ['Wall paint', M.paint], cab: ['Cabinets', M.cab], counter: ['Countertops', M.counter], tile: ['Bath & mud tile', M.tile] };
const TEX_ORIG = {}; for (const k in TEX_MAT) if (TEX_MAT[k][1]) TEX_ORIG[k] = { map: TEX_MAT[k][1].map, color: TEX_MAT[k][1].color.getHex() };
function applyTex(key, url, tileFt = 4) {
  const m = TEX_MAT[key]?.[1]; if (!m) return;
  if (!url) { m.map = TEX_ORIG[key].map; m.color.setHex(TEX_ORIG[key].color); m.needsUpdate = true; renderer.shadowMap.needsUpdate = true; return; }
  new THREE.TextureLoader().load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / tileFt, 1 / tileFt); t.anisotropy = 8;
    m.map = t; m.color.set('#ffffff'); m.needsUpdate = true; renderer.shadowMap.needsUpdate = true; });
}
const texKey = k => 'walkthru-tex-' + k;
document.getElementById('finishBody').insertAdjacentHTML('beforeend', `<div class="grp"><h3>Your own texture</h3>
  
  <div class="tex-row"><select id="texFor">${Object.entries(TEX_MAT).filter(([, v]) => v[1]).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select><button class="btn" id="texUp" type="button">Upload…</button></div>
  <div class="tex-row"><label class="fld" style="margin:0">Pattern size (ft) <input id="texFt" type="number" min=".5" max="20" step=".5" value="4"></label><button class="btn" id="texClear" type="button" style="align-self:end">Remove</button></div>
  <input type="file" id="texFile" accept="image/*" hidden></div>`);
document.getElementById('texUp').onclick = () => document.getElementById('texFile').click();
document.getElementById('texFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const img = await createImageBitmap(f).catch(() => null); if (!img) return toast('That image could not be read');
  const c = document.createElement('canvas'), s = Math.min(1, 640 / Math.max(img.width, img.height)); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', .82), k = document.getElementById('texFor').value, ft = +document.getElementById('texFt').value || 4;
  try { localStorage.setItem(texKey(k), JSON.stringify({ url, ft })); } catch (er) { toast('Saved for now, but this browser has no room to keep it'); }
  applyTex(k, url, ft); toast(`Texture applied to ${TEX_MAT[k][0].toLowerCase()}`); window.wtTrack?.('texture_uploaded');
};
document.getElementById('texClear').onclick = () => { const k = document.getElementById('texFor').value; try { localStorage.removeItem(texKey(k)); } catch (e) { } applyTex(k, null); toast('Texture removed'); };
document.getElementById('texFt').onchange = () => { const k = document.getElementById('texFor').value; try { const v = JSON.parse(localStorage.getItem(texKey(k))); if (v) { v.ft = +document.getElementById('texFt').value || 4; localStorage.setItem(texKey(k), JSON.stringify(v)); applyTex(k, v.url, v.ft); } } catch (e) { } };
for (const k in TEX_MAT) try { const v = JSON.parse(localStorage.getItem(texKey(k)) || 'null'); if (v?.url) applyTex(k, v.url, v.ft); } catch (e) { }

// ---------- printable plan sheet (save as PDF from the print dialog) ----------
function drawSheetPlan(lv, W, H) {
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const g = c.getContext('2d'); g.scale(2, 2);
  const rs = BM.rooms.filter(r => r.level === lv), all = BM.rooms.length ? BM.rooms : rs;
  const x0 = Math.min(...all.map(r => r.x)) - 3, x1 = Math.max(...all.map(r => r.x + r.w)) + 3, z0 = Math.min(...all.map(r => r.z)) - 3, z1 = Math.max(...all.map(r => r.z + r.d)) + 3;
  const s = Math.min(W / (x1 - x0), H / (z1 - z0)), ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = (H - (z1 - z0) * s) / 2 - z0 * s, P = (x, z) => [x * s + ox, z * s + oy];
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const q of rs) { const [a, b] = P(q.x, q.z); g.fillStyle = (RT[q.type]?.color || '#eee') + '66'; g.fillRect(a, b, q.w * s, q.d * s); }
  for (const it of (BM.items || []).filter(i => i.level === lv)) { const c2 = CATALOG[it.kind]; if (!c2) continue; const [w, d] = itemDims(it), [a, b] = P(it.x - w / 2, it.z - d / 2); g.strokeStyle = '#999'; g.lineWidth = .8; g.strokeRect(a, b, w * s, d * s); }
  for (const w of planLevel(lv)) { // walls with gaps where doors and windows are
    const th = w.ext ? 3.2 : 1.8, cuts = (w.ops || []).map(o => [o.c - o.w / 2, o.c + o.w / 2]).sort((p, q) => p[0] - q[0]);
    let a = w.a; const segs = []; for (const [c0, c1] of cuts) { if (c0 > a) segs.push([a, c0]); a = Math.max(a, c1); } if (a < w.b) segs.push([a, w.b]);
    g.strokeStyle = w.rail ? '#4c7fd6' : '#111'; g.lineWidth = w.rail ? 1.2 : th; g.lineCap = 'square';
    for (const [p0, p1] of (w.open ? [] : segs)) { g.beginPath(); if (w.axis === 'x') { g.moveTo(...P(p0, w.c)); g.lineTo(...P(p1, w.c)); } else { g.moveTo(...P(w.c, p0)); g.lineTo(...P(w.c, p1)); } g.stroke(); }
    for (const o of w.ops || []) drawOpening(g, P, w, o, s, '#111', '#111');
  }
  for (const S of (BM.stairs || []).filter(t => t.level === lv)) { const r = stairRect(S, stairDirOf(S)), [a, b] = P(r.x, r.z); g.strokeStyle = '#555'; g.lineWidth = .8; g.strokeRect(a, b, r.w * s, r.d * s); const n = 12, ax = stairDirOf(S)[1] === 'x';
    g.beginPath(); for (let i = 1; i < n; i++) { if (ax) { g.moveTo(a + r.w * s * i / n, b); g.lineTo(a + r.w * s * i / n, b + r.d * s); } else { g.moveTo(a, b + r.d * s * i / n); g.lineTo(a + r.w * s, b + r.d * s * i / n); } } g.stroke(); }
  for (const q of rs) { const [a, b] = P(q.x + q.w / 2, q.z + q.d / 2); if (q.w * s < 34) continue; g.fillStyle = '#111'; g.font = `600 ${Math.max(8, Math.min(11, s * .9))}px Inter, sans-serif`; g.fillText(rname(q).toUpperCase(), a, b - 6);
    g.font = `${Math.max(7, Math.min(10, s * .8))}px "JetBrains Mono", monospace`; g.fillStyle = '#555'; g.fillText(`${ftin(q.w)} × ${ftin(q.d)}`, a, b + 6); }
  for (const d of (BM.dims || []).filter(i => i.level === lv)) { const [a, b] = P(d.x1, d.z1), [c2, e] = P(d.x2, d.z2); g.strokeStyle = '#c2410c'; g.lineWidth = .8; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, e); g.stroke(); g.fillStyle = '#c2410c'; g.font = '600 9px "JetBrains Mono", monospace'; g.fillText(ftin(Math.hypot(d.x2 - d.x1, d.z2 - d.z1)), (a + c2) / 2, (b + e) / 2 - 7); }
  for (const n of (BM.notes || []).filter(i => i.level === lv)) { const [a, b] = P(n.x, n.z); g.fillStyle = '#111'; g.beginPath(); g.arc(a, b, 2.5, 0, 7); g.fill(); g.textAlign = 'left'; g.font = 'italic 9px Inter, sans-serif'; g.fillText(n.text, a + 6, b - 6); g.textAlign = 'center'; }
  dimChains(g, P, lv, '#444');
  return { url: c.toDataURL('image/png'), scale: s };
}
// ---------- elevations: orthographic clay renders of each face, on white, with a ground line ----------
function captureElevations(W = 1400, H = 560) {
  const keep = { rs: RS, view: curView, sky: sky.visible, bg: scene.background, fog: scene.fog, site: G3.site.visible, trees: G3.trees.visible, base: G3.basement.visible, furnB: G3.furnB.visible, labels: showLabels, pr: renderer.getPixelRatio(), roof: showRoof };
  if (mode === 'walk') goView(curView, true);
  showRoof = true; showLabels = false; curView = 'front'; applyVisibility(); setRender('clay');
  scene.background = new THREE.Color('#ffffff'); G3.site.visible = G3.trees.visible = G3.basement.visible = G3.furnB.visible = false;
  const box = new THREE.Box3(); for (const g of [G3.main, G3.upper, G3.roof]) box.expandByObject(g);
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), top = box.max.y, out = [];
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  for (const [name, dx, dz] of [['Front', 0, -1], ['Rear', 0, 1], ['Left', -1, 0], ['Right', 1, 0]]) {
    const span = dx ? sz.z : sz.x, ht = top + 2, aspect = W / H;
    let hw = Math.max(span / 2 + 4, (ht / 2 + 2) * aspect); const hh = hw / aspect;
    const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, .1, 2000);
    cam.position.set(c.x + dx * 400, hh - 3, c.z + dz * 400); cam.lookAt(c.x, hh - 3, c.z); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(renderer.domElement, 0, 0, W, H);
    const gy = H * (1 - (0 + 3) / (2 * hh)); // grade line (y = 0) in pixels
    g.strokeStyle = '#111'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(0, gy + 1.5, W, H - gy);
    g.fillStyle = '#111'; g.font = '600 13px Inter, sans-serif'; g.fillText(`${name} elevation`, 14, H - 14);
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#555';
    const pxPerFt = H / (2 * hh); for (const [lbl, y] of [['Main floor', MF], ['2nd floor', UF], ['Top of roof', top]]) { if (lbl === '2nd floor' && !BM.rooms.some(r => r.level === 'U')) continue; const py = gy - y * pxPerFt; g.setLineDash([6, 4]); g.strokeStyle = '#999'; g.lineWidth = 1; g.beginPath(); g.moveTo(W - 210, py); g.lineTo(W - 10, py); g.stroke(); g.setLineDash([]); g.fillText(`${lbl} ${ftin(y)}`, W - 205, py - 4); }
    out.push({ name, url: cv.toDataURL('image/png'), scale: pxPerFt });
  }
  renderer.setPixelRatio(keep.pr); renderer.setSize(innerWidth, innerHeight, false);
  setRender(keep.rs); scene.background = keep.bg; scene.fog = keep.fog; sky.visible = keep.sky;
  G3.site.visible = keep.site; G3.trees.visible = keep.trees; G3.basement.visible = keep.base; G3.furnB.visible = keep.furnB; showLabels = keep.labels; showRoof = keep.roof; curView = keep.view; applyVisibility();
  return out;
}

function planSheet() {
  if (curHouse !== 3) return toast('Open a design (or Sample 3) to print its plan');
  const win = window.open('', '_blank'); if (!win) return toast('Allow pop-ups to open the plan sheet');
  const name = (H3P ? '1196 Campana Cres' : curDesign()?.name) || 'Design', date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const A = areaData(), LN = { B: 'Basement', M: 'Main floor', U: 'Second floor' }, levels = ['B', 'M', 'U'].filter(l => BM.rooms.some(r => r.level === l));
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const pages = levels.map((lv, i) => { const p = drawSheetPlan(lv, 980, 560), [bft, blab] = SCALE_BAR(), bar = bft * p.scale, sf = Math.round(A.lv[lv].filter(([n]) => !NOT_LIVING.test(n)).reduce((a, [, s]) => a + s, 0));
    return `<section class="sheet"><img src="${p.url}" alt="${LN[lv]} plan"><footer><div><b>${esc(name)}</b><span>${LN[lv]} plan</span></div><div><span>Finished area</span><b>${fmtArea(sf)}</b></div>
      <div><span>Scale</span><b class="bar"><i style="width:${bar}px"></i>${blab}</b></div><div><span>North</span><b>↑</b></div><div><span>Date</span><b>${date}</b></div><div><span>Sheet</span><b>A-${i + 1} of ${levels.length + 2}</b></div></footer>
      <p class="fine">For review only, not for construction. Check all dimensions on site. Prepared with Demo.</p></section>`; }).join('');
  const elev = captureElevations(), total = levels.length + 2;
  const elevPages = [elev.slice(0, 2), elev.slice(2)].map((pair, i) => `<section class="sheet">${pair.map(e => `<img src="${e.url}" alt="${e.name} elevation" style="margin-bottom:6px">`).join('')}<footer><div><b>${esc(name)}</b><span>Elevations</span></div><div><span>Views</span><b>${pair.map(e => e.name).join(' / ')}</b></div>
      <div><span>Scale</span><b class="bar"><i style="width:${SCALE_BAR()[0] * pair[0].scale}px"></i>${SCALE_BAR()[1]}</b></div><div><span>Height</span><b>${ftin(MF)} main floor</b></div><div><span>Date</span><b>${date}</b></div><div><span>Sheet</span><b>A-${levels.length + i + 1} of ${total}</b></div></footer></section>`).join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} · plan sheet</title><style>
    @page{size:landscape;margin:12mm} body{margin:0;font:12px/1.4 Inter,system-ui,sans-serif;color:#111} .sheet{page-break-after:always;padding:8px;border:1.5px solid #111;margin:0 auto 16px;max-width:1000px}
    .sheet img{display:block;width:100%} footer{display:grid;grid-template-columns:2fr repeat(5,1fr);border-top:1.5px solid #111;margin-top:6px} footer div{padding:6px 8px;border-left:1px solid #111;display:flex;flex-direction:column} footer div:first-child{border-left:0}
    footer span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#666} footer b{font-size:12px} .bar{display:flex;align-items:center;gap:4px} .bar i{display:inline-block;height:4px;background:#111}
    .fine{font-size:9px;color:#666;margin:6px 0 0} .tools{text-align:center;margin:16px} .tools button{font:500 14px Inter,sans-serif;padding:10px 16px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer} @media print{.tools{display:none}}
    </style></head><body><div class="tools"><button onclick="print()">Save as PDF or print</button></div>${pages}${elevPages}</body></html>`);
  win.document.close(); window.wtTrack?.('plan_sheet');
}

// ---------- 360° panorama ----------
async function panorama() {
  if (!uiReady) return; toast('Rendering 360° view…'); await new Promise(r => setTimeout(r, 50));
  const N = 1024, OW = 4096, OH = 2048, pr = renderer.getPixelRatio(), cam = new THREE.PerspectiveCamera(90, 1, .25, 2600), pos = camera.position.clone();
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  const UP = new THREE.Vector3(0, 1, 0), faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(f => { const F = new THREE.Vector3(...f), U = Math.abs(f[1]) ? new THREE.Vector3(0, 0, f[1] > 0 ? 1 : -1) : UP.clone(), R = new THREE.Vector3().crossVectors(F, U); return { F, U, R }; });
  renderer.setPixelRatio(1); renderer.setSize(N, N, false);
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = N; const sg = scratch.getContext('2d', { willReadFrequently: true });
  for (const f of faces) { cam.position.copy(pos); cam.up.copy(f.U); cam.lookAt(pos.clone().add(f.F)); renderer.render(scene, cam); sg.drawImage(renderer.domElement, 0, 0, N, N); f.px = sg.getImageData(0, 0, N, N).data; }
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  const out = document.createElement('canvas'); out.width = OW; out.height = OH; const og = out.getContext('2d'), img = og.createImageData(OW, OH), D = img.data;
  const rgt = new THREE.Vector3(-fwd.z, 0, fwd.x), d = new THREE.Vector3();
  for (let y = 0; y < OH; y++) { const lat = (.5 - (y + .5) / OH) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < OW; x++) { const lon = ((x + .5) / OW - .5) * 2 * Math.PI, c = Math.cos(lon) * cl, s = Math.sin(lon) * cl;
      d.set(fwd.x * c + rgt.x * s, sl, fwd.z * c + rgt.z * s);
      let best = faces[0], bv = -2; for (const f of faces) { const v = d.dot(f.F); if (v > bv) { bv = v; best = f; } }
      const sx = d.dot(best.R) / bv, sy = d.dot(best.U) / bv, px = Math.min(N - 1, Math.max(0, ((sx + 1) / 2 * N) | 0)), py = Math.min(N - 1, Math.max(0, ((1 - sy) / 2 * N) | 0)), i = (py * N + px) * 4, o = (y * OW + x) * 4;
      D[o] = best.px[i]; D[o + 1] = best.px[i + 1]; D[o + 2] = best.px[i + 2]; D[o + 3] = 255; } }
  og.putImageData(img, 0, 0);
  download(out.toDataURL('image/jpeg', .9), `${slug()}-360.jpg`); toast('Panorama saved'); window.wtTrack?.('panorama');
}

// ---------- video ----------
let REC = null;
function videoType() { return ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => window.MediaRecorder?.isTypeSupported?.(t)); }
function startRec(seconds) {
  if (REC) return stopRec(); const type = videoType(); if (!type || !renderer.domElement.captureStream) return toast('This browser can’t record video');
  const chunks = [], rec = new MediaRecorder(renderer.domElement.captureStream(30), { mimeType: type, videoBitsPerSecond: 8e6 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => { const b = new Blob(chunks, { type: type.split(';')[0] }), u = URL.createObjectURL(b); download(u, `${slug()}-walkthrough.${type.includes('mp4') ? 'mp4' : 'webm'}`); setTimeout(() => URL.revokeObjectURL(u), 5000); toast('Video saved'); };
  rec.start(250); REC = { rec, spin: null };
  if (seconds) { REC.spin = controls.autoRotate; controls.autoRotate = true; controls.autoRotateSpeed = 30 / seconds; /* speed 2 = one turn in 30 s */ REC.t = setTimeout(stopRec, seconds * 1000); toast('Recording'); }
  else toast('Recording');
  $u('recBtn').setAttribute('aria-pressed', 'true'); document.body.classList.add('recording'); window.wtTrack?.('video', { auto: !!seconds });
}
function stopRec() { if (!REC) return; clearTimeout(REC.t); if (REC.spin !== null) { controls.autoRotate = REC.spin; $u('optSpin').checked = REC.spin; } REC.rec.stop(); REC = null; $u('recBtn').setAttribute('aria-pressed', 'false'); document.body.classList.remove('recording'); }
$u('recBtn').onclick = () => startRec(0);
$u('exVideo').onclick = () => startRec(0); $u('exFly').onclick = () => { if (mode === 'walk') goView(curView); startRec(12); };
$u('exPano').onclick = panorama; $u('exPdf').onclick = planSheet;
