
// =====================================================================
//  CLOUD — Studio (admin) and customer links, backed by the /api functions (Turso + object storage).
//  Routes:  #admin → project dashboard · #admin/p/<id> → project workspace · #c/<token> → customer view.
//  Without the API (e.g. the Claude artifact) none of this shows and the app runs on this browser alone.
// =====================================================================
const CL = { on: false, brand: { name: 'Demo' }, locked: false, route: null, project: null, share: null, view: null, comments: [], pinning: false, pinDraft: null, poll: 0, saveT: 0, dirty: false };
const $c = id => document.getElementById(id);
const clEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clAgo = t => { if (!t) return ''; const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`; return new Date(t).toLocaleDateString(); };
const ACCESS_NAME = { view: 'View & comment', finishes: 'Finishes', edit: 'Floor plan changes' };
const STATUS_NAME = { draft: 'Draft', shared: 'Shared', sent: 'Sent', opened: 'Opened', editing: 'Editing', submitted: 'Changes sent', accepted: 'Accepted' };
const studioKey = () => { try { return localStorage.getItem('studio-key') || ''; } catch (e) { return ''; } };
const sharePass = () => { try { return sessionStorage.getItem('share-pass-' + (CL.route?.token || '')) || ''; } catch (e) { return ''; } };

async function cloudApi(method, path, data) {
  const h = { 'content-type': 'application/json' }; if (studioKey()) h['x-admin-key'] = studioKey(); if (sharePass()) h['x-share-pass'] = sharePass();
  const r = await fetch('/api/' + path, { method, headers: h, body: data === undefined ? undefined : JSON.stringify(data) });
  let j = {}; try { j = await r.json(); } catch (e) { }
  if (!r.ok) { const err = new Error(j.error || `Request failed (${r.status})`); err.status = r.status; err.needPass = !!j.needPass; throw err; }
  return j;
}

// Forms here are handled in JS; never let the browser submit them (that would reload the page).
document.addEventListener('submit', e => { if (e.target.closest('#studio, #clSide, #clWelcome')) e.preventDefault(); }, true);

// ---------- design helpers ----------
const BEDS = new Set(['bedroom', 'primary', 'guest', 'nursery']);
function summarize(bm) {
  const rs = bm.rooms || [], seen = new Set(), one = r => { const k = r.group ? r.level + r.group : r.id; if (seen.has(k)) return false; seen.add(k); return true; };
  let beds = 0, baths = 0, sf = 0, garage = 0;
  for (const r of rs) {
    const T = RT[r.type] || {}; if (!T.outdoor && !T.garage && r.level !== 'B') sf += r.w * r.d; if (T.garage) garage += r.w * r.d;
    if (BEDS.has(r.type) && one(r)) beds++; else if ((r.type === 'bath' || r.type === 'ensuite') && one(r)) baths += 1; else if (r.type === 'powder' && one(r)) baths += .5;
  }
  return { beds, baths, sf: Math.round(sf), storeys: rs.some(r => r.level === 'U') ? 2 : 1, basement: rs.some(r => r.level === 'B'), garage: Math.round(garage / 250) };
}
const specLine = s => s ? [`${s.beds} bed`, `${s.baths} bath`, fmtArea(s.sf), s.garage ? `${s.garage}-car` : null].filter(Boolean).join(' · ') : '';
const previewOf = bm => (bm.rooms || []).filter(r => r.level === 'M').map(r => [r.x, r.z, r.w, r.d, (RT[r.type] || {}).color || '#ddd']);
function drawPreview(cv, prev) {
  const W = cv.width = cv.clientWidth * 2 || 520, H = cv.height = 300, g = cv.getContext('2d');
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--paper-2'); g.fillRect(0, 0, W, H);
  if (!prev?.length) return;
  const x0 = Math.min(...prev.map(p => p[0])), x1 = Math.max(...prev.map(p => p[0] + p[2])), z0 = Math.min(...prev.map(p => p[1])), z1 = Math.max(...prev.map(p => p[1] + p[3]));
  const s = Math.min((W - 40) / (x1 - x0), (H - 40) / (z1 - z0)), ox = (W - (x1 - x0) * s) / 2, oz = (H - (z1 - z0) * s) / 2;
  for (const [x, z, w, d, col] of prev) { g.fillStyle = col; g.fillRect(ox + (x - x0) * s, oz + (z - z0) * s, w * s, d * s); }
  g.strokeStyle = 'rgba(24,24,27,.55)'; g.lineWidth = 1.5; for (const [x, z, w, d] of prev) g.strokeRect(ox + (x - x0) * s, oz + (z - z0) * s, w * s, d * s);
}
const cloneBM = bm => JSON.parse(JSON.stringify(bm));
const TEMPLATES = () => [
  ['campana', '1196 Campana Cres (House 3)', () => campanaPlan()],
  ['permit', 'Sample: 2-storey with basement', () => permitPlan()],
  ['blank', 'Blank plan', () => ({ roof: 'hip', rooms: [], stairs: [] })],
  ...DS.list.map(d => [`local-${d.id}`, `Saved in this browser: ${d.name}`, () => cloneBM(d.bm)]),
];

// Show a design in the 3D view (through the My Design engine) without touching this browser's saved designs.
function showDesign(bm, { save = null } = {}) {
  if (H3P) usePreset(false);
  cloudSave = save; BM = bm && Array.isArray(bm.rooms) ? bm : { roof: 'hip', rooms: [], stairs: [] };
  resetBID(); normalizeStairs(BM); PE.sel = PE.selStair = PE.selWall = null; PE.hist = [];
  finishHook = save ? (k, i) => { BM.finishes = { ...(BM.finishes || {}), [k]: i }; saveBM(); } : () => { };
  applyFinishes(BM.finishes || {});
  rebuildHouse3(); if (curHouse !== 3) setHouse(3, true); else { applyVisibility(); fillGoto(); }
}
function leaveCloudDesign() { // back to this browser's own designs
  cloudSave = null; finishHook = null; applyFinishes(saved);
  const d = curDesign(); BM = d?.bm && Array.isArray(d.bm.rooms) ? d.bm : starterPlan(); resetBID(); normalizeStairs(BM); PE.hist = [];
  if (PE.open) openEditor(false); rebuildHouse3();
}

// ---------- routing ----------
function parseRoute() {
  const h = location.hash;
  let m = h.match(/^#c\/([\w-]+)/); if (m) return { kind: 'customer', token: m[1] };
  m = h.match(/^#admin\/p\/([\w-]+)/); if (m) return { kind: 'project', id: m[1] };
  if (h.startsWith('#admin')) return { kind: 'studio' };
  return { kind: 'none' };
}
async function cloudRoute() {
  const r = parseRoute(), prev = CL.route; CL.route = r; clearInterval(CL.poll); clStopPin();
  $c('studio').hidden = r.kind !== 'studio';
  const inDesign = r.kind === 'project' || r.kind === 'customer';
  document.body.classList.toggle('cl-on', inDesign);
  $c('clHead').hidden = $c('clSide').hidden = $c('clSideBtn').hidden = !inDesign; $c('clSideBtn').setAttribute('aria-pressed', String(inDesign)); if (inDesign) closePanel(); $c('clBanner').hidden = true; $c('clWelcome').hidden = true;
  document.body.classList.toggle('cl-side-open', inDesign);
  if (!inDesign) { clearPins(); if (prev && (prev.kind === 'project' || prev.kind === 'customer')) leaveCloudDesign(); }
  if (r.kind === 'studio') return studioHome();
  if (r.kind === 'project') return openProject(r.id);
  if (r.kind === 'customer') return openShare(r.token);
}
const goRoute = h => { if (location.hash !== h) location.hash = h; else cloudRoute(); };

// ---------- Studio dashboard ----------
let stProjects = [];
async function studioHome() {
  document.title = 'Projects · Demo';
  $c('stNew').hidden = ACC.role === 'viewer'; $c('stAvatar').hidden = !ACC.user;
  if (ACC.user) { const u = ACC.user; $c('stInit').textContent = (u.name || u.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    $c('stName').textContent = u.name || u.email; $c('stMail').textContent = u.email; $c('stOrg').textContent = ACC.org ? `${ACC.org.name} · ${ACC.role}` : ''; }
  try { const j = await cloudApi('GET', 'projects'); stProjects = j.projects; $c('stKey').hidden = true; $c('stHead').hidden = false; renderStudio(); }
  catch (e) { if (e.status === 401) { $c('stKey').hidden = false; $c('stHead').hidden = true; $c('stList').innerHTML = ''; $c('stEmpty').hidden = true; $c('stKeyAlt').hidden = !CL.locked; $c('stSignIn').href = `/account#login?next=${encodeURIComponent('/playground#admin')}`; $c('stSignUp').href = `/account#signup?next=${encodeURIComponent('/playground#admin')}`; } else { $c('stList').innerHTML = `<p class="st-err">${clEsc(e.message)}</p>`; } }
}
function renderStudio() {
  const q = $c('stSearch').value.trim().toLowerCase(), list = stProjects.filter(p => !q || `${p.name} ${p.client || ''} ${p.address || ''}`.toLowerCase().includes(q));
  const tot = (k) => stProjects.reduce((a, p) => a + (p[k] || 0), 0);
  $c('stStats').innerHTML = `<span class="st-stat"><b>${stProjects.length}</b> project${stProjects.length === 1 ? '' : 's'}</span>`;
  $c('stEmpty').hidden = stProjects.length > 0;
  $c('stList').innerHTML = list.map(p => { const sub = [p.client, p.address].filter(Boolean).join(' · ');
    return `<div class="st-card" role="link" tabindex="0" data-pid="${clEsc(p.id)}" aria-label="${clEsc(p.name)}">${p.thumb ? `<img class="st-thumb" src="${p.thumb}" alt="">` : '<canvas aria-hidden="true"></canvas>'}
      <button class="st-more" type="button" aria-label="Project options" aria-haspopup="menu" data-tip="Options"><svg class="ic"><use href="#i-dots"/></svg></button>
      <div class="st-meta">
      <h3 title="${clEsc(p.name)}">${clEsc(p.name)}</h3>${sub ? `<p title="${clEsc(sub)}">${clEsc(sub)}</p>` : ''}<span class="st-spec">${clEsc(specLine(p.summary))}</span>
      <div class="st-flags"><span class="chip">Version ${p.version}</span></div>
      <p><small>${p.last_activity ? 'Active ' + clAgo(p.last_activity) : ''}</small></p></div></div>`; }).join('');
  $c('stList').querySelectorAll('[data-pid]').forEach((b, i) => { const cv = b.querySelector('canvas'); if (cv) drawPreview(cv, list[i].preview);
    const open = () => { if (!b.querySelector('.st-rename')) goRoute(`#admin/p/${b.dataset.pid}`); };
    b.onclick = e => { if (!e.target.closest('.st-more, .st-cmenu, .st-rename')) open(); };
    b.onkeydown = e => { if (e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } };
    b.querySelector('.st-more').onclick = e => { e.stopPropagation(); stCardMenu(b, list[i]); }; });
}
// ⋯ on a project card: edit its details, or delete it
function stCardMenu(card, p) {
  const had = card.querySelector('.st-cmenu'); document.querySelectorAll('.st-cmenu').forEach(m => m.remove()); document.querySelectorAll('.st-card.menu-open').forEach(c => c.classList.remove('menu-open')); if (had) return;
  const m = document.createElement('div'); m.className = 'st-cmenu'; m.setAttribute('role', 'menu');
  m.innerHTML = '<button type="button" role="menuitem" data-a="edit">Edit details</button><button type="button" role="menuitem" data-a="delete" class="danger">Delete</button>';
  card.appendChild(m); card.classList.add('menu-open');
  const close = () => { m.remove(); card.classList.remove('menu-open'); removeEventListener('pointerdown', away, true); };
  const away = e => { if (!e.target.closest('.st-cmenu, .st-more')) close(); }; addEventListener('pointerdown', away, true);
  m.querySelector('[data-a="edit"]').onclick = e => { e.stopPropagation(); close(); stEdit(p); };
  m.querySelector('[data-a="delete"]').onclick = e => { e.stopPropagation(); close(); stDelete(p); };
}
let stEditing = null;
async function stEdit(p) {
  stEditing = { p, bm: null }; $c('seName').value = p.name; $c('seLW').value = $c('seLD').value = ''; $c('seErr').textContent = '';
  document.querySelectorAll('#stEditForm .u-len').forEach(e => e.textContent = U_LEN());
  const lot = document.querySelector('#stEditForm .sn-lot'); lot.dataset.loading = ''; $c('stEditForm').hidden = false; $c('seName').focus(); $c('seName').select();
  try { const j = await cloudApi('GET', `project?id=${encodeURIComponent(p.id)}`); if (stEditing?.p !== p) return; stEditing.bm = j.bm; const S = j.bm?.site || {};
    if (S.lotW) $c('seLW').value = +toDisp(S.lotW).toFixed(2); if (S.lotD) $c('seLD').value = +toDisp(S.lotD).toFixed(2); }
  catch (e) { $c('seErr').textContent = 'Couldn’t load the lot size.'; } finally { delete lot.dataset.loading; }
}
$c('seCancel').onclick = () => { $c('stEditForm').hidden = true; stEditing = null; };
$c('stEditForm').onsubmit = async () => {
  const E = stEditing; if (!E) return; const name = $c('seName').value.trim(); if (!name) { $c('seErr').textContent = 'Give the project a name.'; return; }
  const lw = parseFloat($c('seLW').value), ld = parseFloat($c('seLD').value);
  if ((lw > 0) !== (ld > 0)) { $c('seErr').textContent = 'Enter both the width and depth of the lot, or leave both empty.'; return; }
  const body = { name };
  if (E.bm) { const site = { ...(E.bm.site || {}) }; if (lw > 0) { site.lotW = +fromDisp(lw).toFixed(2); site.lotD = +fromDisp(ld).toFixed(2); } else { delete site.lotW; delete site.lotD; }
    if (JSON.stringify(site) !== JSON.stringify(E.bm.site || {})) body.bm = { ...E.bm, site }; }
  $c('seGo').disabled = true;
  try { await cloudApi('PUT', `project?id=${encodeURIComponent(E.p.id)}`, body); E.p.name = name; $c('stEditForm').hidden = true; stEditing = null; renderStudio(); }
  catch (e) { $c('seErr').textContent = e.message || 'Couldn’t save.'; } finally { $c('seGo').disabled = false; }
};
let stDeleting = null;
function stDelete(p) { stDeleting = p; $c('sdName').textContent = p.name; $c('sdErr').textContent = ''; $c('stDelForm').hidden = false; $c('sdCancel').focus(); }
$c('sdCancel').onclick = () => { $c('stDelForm').hidden = true; stDeleting = null; };
$c('stDelForm').onsubmit = async () => {
  const p = stDeleting; if (!p) return; $c('sdGo').disabled = true;
  try { await cloudApi('DELETE', `project?id=${encodeURIComponent(p.id)}`); stProjects = stProjects.filter(x => x.id !== p.id); $c('stDelForm').hidden = true; stDeleting = null; renderStudio(); toast('Project deleted'); }
  catch (e) { $c('sdErr').textContent = e.status === 403 ? 'Only workspace owners can delete projects.' : 'Couldn’t delete the project.'; } finally { $c('sdGo').disabled = false; }
};
$c('stSearch').oninput = renderStudio;
$c('stKey').onsubmit = async () => { try { localStorage.setItem('studio-key', $c('stKeyIn').value.trim()); } catch (e) { } $c('stKeyErr').textContent = ''; await studioHome(); if (!$c('stKey').hidden) $c('stKeyErr').textContent = 'That key didn’t work.'; };
const stMenu = open => { $c('stMenu').hidden = !open; $c('stAvatar').setAttribute('aria-expanded', String(open)); };
$c('stAvatar').onclick = e => { e.stopPropagation(); stMenu($c('stMenu').hidden); };
addEventListener('pointerdown', e => { if (!$c('stMenu').hidden && !e.target.closest('.st-acct')) stMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') stMenu(false); });
$c('stOut').onclick = async () => { await fetch('/api/auth?action=logout', { method: 'POST' }).catch(() => { }); location.href = '/'; };
$c('stHome') && ($c('stHome').onclick = () => { location.href = '/'; });
$c('stNew').onclick = () => {
  $c('snName').value = ''; $c('snLW').value = ''; $c('snLD').value = ''; document.querySelectorAll('#stNewForm .u-len').forEach(e => e.textContent = U_LEN()); $c('snErr').textContent = ''; $c('stNewForm').hidden = false; $c('snName').focus();
};
$c('snCancel').onclick = () => { $c('stNewForm').hidden = true; };
$c('stNewForm').onsubmit = async () => {
  const name = $c('snName').value.trim(); if (!name) { $c('snErr').textContent = 'Give the project a name.'; return; }
  // every project starts as an empty plan; a lot size, if given, draws the property line
  const lw = parseFloat($c('snLW').value), ld = parseFloat($c('snLD').value), bm = { roof: 'hip', rooms: [], stairs: [] };
  if ((lw > 0) !== (ld > 0)) { $c('snErr').textContent = 'Enter both the width and depth of the lot, or leave both empty.'; return; }
  if (lw > 0) bm.site = { lotW: +fromDisp(lw).toFixed(2), lotD: +fromDisp(ld).toFixed(2) };
  $c('snGo').disabled = true;
  try { const j = await cloudApi('POST', 'projects', { name, bm, from: 'Blank plan', summary: summarize(bm), preview: previewOf(bm) }); $c('stNewForm').hidden = true; goRoute(`#admin/p/${j.id}`); }
  catch (e) { $c('snErr').textContent = e.message; } finally { $c('snGo').disabled = false; }
};

// ---------- shared chrome ----------
// the name box is as wide as the name
function fitTitle() { const t = $c('clTitle'); t.size = Math.max(4, Math.min(28, t.value.length + 1)); }
$c('clTitle').addEventListener('input', fitTitle);
function setSave(text) { $c('clSave').textContent = text; fitHead(); }
function fitHead() { requestAnimationFrame(() => document.documentElement.style.setProperty('--clh', $c('clHead').offsetHeight + 'px')); } // keep Finishes just below the project card
addEventListener('resize', fitHead);
function chrome() { // what the toolbar shows for the current role
  const eb = $c('editBtn'), cust = CL.route?.kind === 'customer', review = CL.view && CL.view !== 'base';
  document.body.classList.toggle('cl-customer', cust);
  if (cust) { eb.hidden = CL.share.access !== 'edit'; setEditLabel('Make changes'); }
  else if (CL.route?.kind === 'project') { eb.hidden = !!review; setEditLabel('Edit plan'); if (review && PE.open) openEditor(false); }
}
function banner(html) { const b = $c('clBanner'); b.hidden = !html; b.innerHTML = html || ''; return b; }
function sideTabs(tabs) {
  if (!tabs.some(t => t[0] === CL.tab)) CL.tab = tabs[0][0];
  $c('clTabs').innerHTML = tabs.map(([k, n]) => `<button type="button" data-tab="${k}" aria-pressed="${k === CL.tab}">${n}</button>`).join('') + '<button type="button" class="x" title="Hide panel" aria-label="Hide panel"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>';
  $c('clTabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { CL.tab = b.dataset.tab; renderSide(); });
  $c('clTabs').querySelector('.x').onclick = () => toggleSide(false);
}
function toggleSide(open) { if (open) closePanel(); $c('clSide').hidden = !open; $c('clSideBtn').setAttribute('aria-pressed', String(open)); document.body.classList.toggle('cl-side-open', open); updateViewOffset(); }
$c('clSideBtn').onclick = () => toggleSide($c('clSide').hidden);
function renderSide() { if (CL.route?.kind === 'project') renderProjectSide(); else if (CL.route?.kind === 'customer') renderShareSide(); }

// ---------- comments + 3D pins ----------
const pinObjs = [];
function clearPins() { for (const o of pinObjs) scene.remove(o); pinObjs.length = 0; }
function renderPins() {
  clearPins(); let n = 0;
  const list = CL.comments.filter(c => c.pin).map(c => [c, ++n]);
  if (CL.pinDraft) list.push([{ id: '_draft', pin: CL.pinDraft, draft: true }, '+']);
  for (const [c, num] of list) {
    const el = document.createElement('div'); el.className = `pin3d${c.resolved ? ' res' : ''}${c.draft ? ' new' : ''}`; el.innerHTML = `<span>${num}</span>`; el.title = c.body || 'New comment';
    el.onclick = e => { e.stopPropagation(); if (c.draft) return; CL.hi = c.id; CL.tab = 'comments'; toggleSide(true); renderSide(); };
    const o = new CSS2DObject(el); o.position.set(c.pin.x, c.pin.y + .4, c.pin.z); o.userData.pin = c.pin; scene.add(o); pinObjs.push(o); c._num = num;
  }
}
setInterval(() => { // only show the pins that belong to the floor being viewed
  if (!pinObjs.length) return; const lv = mode === 'walk' ? null : ({ B: 'B', M: 'M', U: 'U' })[curView];
  for (const o of pinObjs) o.visible = !lv || o.userData.pin.level === lv;
}, 400);
const rc3 = new THREE.Raycaster(), v2c = new THREE.Vector2(); let pinDown = null;
function pickPoint(e) {
  const r = renderer.domElement.getBoundingClientRect(); v2c.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); rc3.setFromCamera(v2c, camera);
  for (const h of rc3.intersectObjects(scene.children, true)) { let o = h.object, vis = true; while (o) { if (!o.visible) { vis = false; break; } o = o.parent; } if (vis && h.object.material !== M.glass) return h.point; }
  return null;
}
function clStartPin() { CL.pinning = true; document.body.classList.add('cl-pinning'); setSave('Click a spot in the 3D view to pin your comment'); }
function clStopPin() { CL.pinning = false; document.body.classList.remove('cl-pinning'); }
renderer.domElement.addEventListener('pointerdown', e => { if (CL.pinning) pinDown = [e.clientX, e.clientY]; }, true);
renderer.domElement.addEventListener('pointerup', e => {
  if (!CL.pinning || !pinDown || Math.hypot(e.clientX - pinDown[0], e.clientY - pinDown[1]) > 6) return; pinDown = null;
  const p = pickPoint(e); if (!p) return;
  CL.pinDraft = { x: p.x, y: p.y, z: p.z, level: p.y < MF - .3 ? 'B' : p.y < UF - .3 ? 'M' : 'U' }; clStopPin(); setSave('Pinned. Write your comment and post it.'); renderPins(); CL.tab = 'comments'; toggleSide(true); renderSide();
  setTimeout(() => $c('cmText')?.focus(), 30);
}, true);
function commentHTML(c, studio) {
  const who = c.author_role === 'customer' ? clEsc(c.author || 'Customer') : studio ? (c.share_token ? 'You → ' + clEsc(shareName(c.share_token)) : 'Internal note') : clEsc(CL.brand.name);
  return `<div class="cl-item${c.resolved ? ' res' : ''}${CL.hi === c.id ? ' hi' : ''}" data-cid="${clEsc(c.id)}"><h4><span>${c._num ? `<span class="chip pin">#${c._num}</span> ` : ''}${who}</span><small>${clAgo(c.created_at)}</small></h4><p>${clEsc(c.body)}</p>
    <div class="cl-acts">${c.pin ? '<button class="btn" type="button" data-act="show">Show in 3D</button>' : ''}${studio && c.author_role === 'customer' ? `<button class="btn" type="button" data-act="reply">Reply</button><button class="btn" type="button" data-act="resolve">${c.resolved ? 'Reopen' : 'Resolve'}</button>` : ''}</div></div>`;
}
function wireComments(root, studio) {
  root.querySelectorAll('[data-cid]').forEach(el => {
    const c = CL.comments.find(x => x.id === el.dataset.cid); if (!c) return;
    el.querySelector('[data-act="show"]')?.addEventListener('click', () => { CL.hi = c.id; goView(c.pin.level || 'front'); renderSide(); });
    el.querySelector('[data-act="reply"]')?.addEventListener('click', () => { CL.replyTo = c.share_token; renderSide(); $c('cmText')?.focus(); });
    el.querySelector('[data-act="resolve"]')?.addEventListener('click', async () => { await cloudApi('PATCH', `comments?id=${encodeURIComponent(c.id)}`, { resolved: !c.resolved }); c.resolved = c.resolved ? 0 : 1; renderSide(); renderPins(); });
  });
  if (CL.hi) root.querySelector(`[data-cid="${CSS.escape(CL.hi)}"]`)?.scrollIntoView({ block: 'nearest' });
}
function composerHTML(studio) {
  const opts = studio ? `<label>To <select id="cmTo"><option value="">Internal note (only the studio sees it)</option>${(CL.project?.shares || []).filter(s => !s.revoked).map(s => `<option value="${clEsc(s.token)}"${CL.replyTo === s.token ? ' selected' : ''}>${clEsc(s.customer)}</option>`).join('')}</select></label>` : '';
  return `<div class="cl-form">${opts}<textarea id="cmText" rows="3" placeholder="${studio ? 'Write a note or reply' : 'Ask a question or suggest a change'}"></textarea>
    <div class="cl-acts"><button class="btn" type="button" id="cmPin">${CL.pinDraft ? 'Pinned' : 'Pin to a spot'}</button>${CL.pinDraft ? '<button class="btn" type="button" id="cmUnpin">Remove pin</button>' : ''}<span style="flex:1"></span><button class="btn st-primary" type="button" id="cmPost">Post</button></div></div>`;
}
function wireComposer(studio, afterPost) {
  $c('cmPin').onclick = () => clStartPin();
  if ($c('cmUnpin')) $c('cmUnpin').onclick = () => { CL.pinDraft = null; renderPins(); renderSide(); };
  $c('cmPost').onclick = async () => {
    const text = $c('cmText').value.trim(); if (!text) return $c('cmText').focus();
    $c('cmPost').disabled = true;
    try {
      if (studio) await cloudApi('POST', 'comments', { projectId: CL.route.id, token: $c('cmTo').value || null, body: text, pin: CL.pinDraft });
      else await cloudApi('POST', `comments?token=${CL.route.token}`, { body: text, pin: CL.pinDraft });
      CL.pinDraft = null; CL.replyTo = null; await afterPost();
    } catch (e) { setSave(e.message); } finally { if ($c('cmPost')) $c('cmPost').disabled = false; }
  };
}

// ---------- Studio: project workspace ----------
const shareName = token => (CL.project?.shares || []).find(s => s.token === token)?.customer || 'customer';
const shareURL = token => `${location.origin}${location.pathname}#c/${token}`;
async function openProject(id, keepView) {
  let j; try { j = await cloudApi('GET', `project?id=${encodeURIComponent(id)}`); }
  catch (e) { if (e.status === 401) return goRoute('#admin'); banner(`${clEsc(e.message)} <button class="btn" type="button" onclick="location.hash='#admin'">Back to projects</button>`); return; }
  const first = !CL.project || CL.project.project.id !== id;
  CL.project = j; CL.comments = j.comments; CL.view = 'base'; CL.hi = null; CL.pinDraft = null;
  showDesign(j.bm, { save: projectSave }); if (first && !keepView) goView('front', true);
  $c('clBrand').textContent = '';
  const t = $c('clTitle'); t.readOnly = false; t.value = j.project.name; fitTitle(); document.title = `${j.project.name} · ${CL.brand.name}`;
  $c('clSub').textContent = [j.project.client, j.project.address].filter(Boolean).join(' · '); t.title = $c('clSub').textContent || 'Click to rename';
  setSave('Saved'); banner(''); chrome(); renderPins();
  CL.tab = 'history'; toggleSide(false); renderSide();
  CL.poll = setInterval(refreshProject, 20000);
  if (first) setTimeout(saveThumb, 2500);
}
let thumbAt = 0;
async function saveThumb() {
  if (CL.route?.kind !== 'project' || CL.view !== 'base' || Date.now() - thumbAt < 120e3) return; thumbAt = Date.now();
  const t = captureThumb(); if (t) try { await cloudApi('PUT', `project?id=${encodeURIComponent(CL.route.id)}`, { thumb: t }); } catch (e) { }
}
async function refreshProject() {
  if (CL.route?.kind !== 'project' || document.hidden) return;
  try { const j = await cloudApi('GET', `project?id=${encodeURIComponent(CL.route.id)}`); const p = CL.project; p.shares = j.shares; p.events = j.events; p.versions = j.versions; CL.comments = j.comments;
    if (CL.view === 'base') renderPins(); if (!document.activeElement?.closest?.('#clSide')) renderSide(); } catch (e) { }
}
function projectSave() {
  if (CL.view !== 'base') return; CL.dirty = true; setSave('Saving…'); clearTimeout(CL.saveT);
  CL.saveT = setTimeout(async () => {
    try { await cloudApi('PUT', `project?id=${encodeURIComponent(CL.route.id)}`, { bm: BM, summary: summarize(BM), preview: previewOf(BM) }); CL.dirty = false; setTimeout(saveThumb, 1500); setSave('Saved'); }
    catch (e) { setSave(`Not saved: ${e.message}`); }
  }, 800);
}
$c('clTitle').onchange = async () => {
  if (CL.route?.kind !== 'project') return; const name = $c('clTitle').value.trim(); if (!name) { $c('clTitle').value = CL.project.project.name; return; }
  CL.project.project.name = name; await cloudApi('PUT', `project?id=${encodeURIComponent(CL.route.id)}`, { name }); setSave('Renamed');
};
async function viewCustomerVersion(token) {
  const s = await cloudApi('GET', `share?token=${token}&as=studio`); CL.view = token;
  showDesign(s.bm, { save: null }); chrome(); clearPins();
  banner(`Viewing <b>${clEsc(s.customer)}</b>’s version${s.status === 'submitted' ? ' · they sent it for review' : ''} <button class="btn" type="button" id="bnAccept">Accept as version ${CL.project.project.version + 1}</button><button class="btn" type="button" id="bnBack">Back to your design</button>`);
  $c('bnAccept').onclick = () => acceptShare(token); $c('bnBack').onclick = backToBase;
}
function backToBase() { CL.view = 'base'; showDesign(CL.project.bm, { save: projectSave }); banner(''); chrome(); renderPins(); renderSide(); }
async function acceptShare(token) {
  try { const j = await cloudApi('POST', `project?id=${encodeURIComponent(CL.route.id)}&action=accept&token=${token}`); await openProject(CL.route.id, true); setSave(`Accepted · now version ${j.version}`); }
  catch (e) { setSave(e.message); }
}
const EV = {
  created: e => ['', 'Project created' + (e.detail?.from ? ` from ${e.detail.from}` : '')], shared: e => ['', `Shared with ${e.detail?.customer} (${ACCESS_NAME[e.detail?.access] || ''})`],
  opened: e => ['', `${e.detail?.customer} opened their link`], edited: e => ['', `${e.detail?.customer} changed the floor plan`], finishes: e => ['', `${e.detail?.customer} picked finishes`],
  comment: e => ['', `${e.detail?.customer}: “${e.detail?.text}”`], submitted: e => ['', `${e.detail?.customer} sent ${e.detail?.changed ? 'changes' : 'feedback'} for review${e.detail?.note ? `: “${e.detail.note}”` : ''}`],
  accepted: e => ['', `You accepted ${e.detail?.customer}’s changes (v${e.detail?.version})`], reset: e => ['', `${e.detail?.customer} undid their changes`],
  restored: e => ['', `Restored version ${e.detail?.from} as v${e.detail?.version}`], snapshot: e => ['', `Saved version ${e.detail?.version}: ${e.detail?.note}`],
};
function renderProjectSide() {
  const P = CL.project;
  sideTabs([['history', 'History']]);
  const B = $c('clBody'), F = $c('clFoot'); F.innerHTML = '';
  B.innerHTML = `<form class="cl-form" id="vsForm" onsubmit="return false"><label>Save this version <input id="vsNote" maxlength="120" placeholder="e.g. Sent for first review"></label><button class="btn" type="submit">Save version</button></form>
    <div class="cl-sec">Versions</div>` + P.versions.map(v => `<div class="cl-ev ver"><i></i><span>Version ${v.version}${v.version === P.project.version ? ' <span class="chip ok">current</span>' : ''} · ${clEsc(v.note || '')}${v.version !== P.project.version ? ` <button class="linkish" type="button" data-ver="${v.version}">Restore</button>` : ''}</span><small>${clAgo(v.created_at)}</small></div>`).join('')
    + `<div class="cl-sec">Activity</div>` + (P.events.length ? P.events.map(e => { const [, tx] = (EV[e.kind] || (() => ['', e.kind]))(e); return `<div class="cl-ev ev-${clEsc(e.kind)}"><i></i><span>${clEsc(tx)}</span><small>${clAgo(e.created_at)}</small></div>`; }).join('') : '<p class="cl-sub">Nothing yet.</p>');
  $c('vsForm').onsubmit = async () => { await cloudApi('POST', `project?id=${encodeURIComponent(CL.route.id)}&action=snapshot`, { note: $c('vsNote').value.trim() || 'Saved version' }); await openProject(CL.route.id, true); CL.tab = 'history'; renderSide(); };
  B.querySelectorAll('[data-ver]').forEach(b => b.onclick = async () => { await cloudApi('POST', `project?id=${encodeURIComponent(CL.route.id)}&action=restore&version=${b.dataset.ver}`); await openProject(CL.route.id, true); CL.tab = 'history'; renderSide(); });
}

// ---------- Customer link ----------
async function openShare(token) {
  let j; try { j = await cloudApi('GET', `share?token=${encodeURIComponent(token)}`); }
  catch (e) { if (e.needPass) return askSharePass(token, !!sharePass()); showNotice('This link isn’t available', e.message === 'This link is no longer active' ? 'Ask your builder for a new link.' : e.message); return; }
  CL.share = j; CL.comments = j.comments; CL.view = 'base'; CL.hi = null; CL.pinDraft = null;
  const canSave = j.access !== 'view';
  showDesign(j.bm, { save: canSave ? shareSave : null }); goView('front', true);
  $c('clBrand').textContent = j.brand.name; CL.brand = j.brand;
  const t = $c('clTitle'); t.readOnly = true; t.value = j.project.name; fitTitle(); document.title = `${j.project.name} · ${j.brand.name}`;
  $c('clSub').textContent = [`Prepared for ${j.customer}`, j.project.address].filter(Boolean).join(' · ');
  shareStatus(); chrome(); renderPins(); CL.tab = 'comments'; toggleSide(innerWidth > 760); renderSide();
  let seen = false; try { seen = localStorage.getItem('welcomed-' + token) === '1'; } catch (e) { }
  if (!seen) welcome();
  CL.poll = setInterval(async () => { if (document.hidden) return; try { const r = await cloudApi('GET', `comments?token=${token}`); if (r.comments.length !== CL.comments.length) { CL.comments = r.comments; renderPins(); renderSide(); } } catch (e) { } }, 20000);
}
function shareStatus() {
  const s = CL.share, sent = s.status === 'submitted', acc = s.status === 'accepted';
  setSave(sent ? `Sent to ${CL.brand.name}` : acc ? `${CL.brand.name} accepted your changes` : s.changed ? 'Your changes are saved' : s.access === 'view' ? 'View only · you can comment' : 'Make it yours: changes save as you go');
  if (s.changed && !sent) banner(`You’ve made changes. <button class="btn st-primary" type="button" id="bnSend">Send to ${clEsc(CL.brand.name)}</button>`).querySelector('#bnSend').onclick = () => { CL.tab = 'send'; toggleSide(true); renderSide(); };
  else banner('');
}
function shareSave() {
  CL.share.changed = true; if (CL.share.status === 'submitted' || CL.share.status === 'accepted') CL.share.status = 'editing';
  setSave('Saving…'); clearTimeout(CL.saveT);
  CL.saveT = setTimeout(async () => { try { await cloudApi('PUT', `share?token=${CL.route.token}`, { bm: BM }); shareStatus(); } catch (e) { setSave(`Not saved: ${e.message}`); } }, 800);
}
function renderShareSide() {
  const s = CL.share, canSave = s.access !== 'view';
  sideTabs([['comments', `Comments${CL.comments.length ? ` (${CL.comments.length})` : ''}`], ['send', 'Send'], ['help', 'How to']]);
  $c('clSideCount').textContent = CL.comments.length || '';
  const B = $c('clBody'), F = $c('clFoot'); F.innerHTML = '';
  if (CL.tab === 'comments') {
    B.innerHTML = (s.message ? `<div class="cl-item"><h4><span>${clEsc(CL.brand.name)}</span></h4><p>${clEsc(s.message)}</p></div>` : '') +
      (CL.comments.length ? CL.comments.map(c => commentHTML(c, false)).join('') : '<p class="cl-sub">Questions or ideas? Pin a comment to any spot in the house and we’ll see exactly what you mean.</p>');
    wireComments(B, false); F.innerHTML = composerHTML(false);
    wireComposer(false, async () => { const r = await cloudApi('GET', `comments?token=${CL.route.token}`); CL.comments = r.comments; renderPins(); renderSide(); setSave('Comment posted'); });
  } else if (CL.tab === 'send') {
    const sent = s.status === 'submitted';
    B.innerHTML = `<p class="cl-sub">${canSave ? (s.changed ? 'Your version is saved. When you’re happy with it, send it over and we’ll review your changes and comments.' : 'You haven’t changed anything yet. You can still send your comments.') : 'Send your comments when you’re ready.'}</p>
      <form class="cl-form" id="sdForm" onsubmit="return false"><label>Note for ${clEsc(CL.brand.name)} (optional) <textarea id="sdNote" rows="3" placeholder="Anything we should know?"></textarea></label>
      <button class="btn st-primary" type="submit">${sent ? 'Send again' : `Send to ${clEsc(CL.brand.name)}`}</button></form>
      ${sent ? `<p class="cl-sub">Sent. We’ll be in touch.</p>` : ''}
      ${s.changed ? '<div class="cl-sec">Start over</div><button class="btn" type="button" id="sdReset">Undo all my changes</button>' : ''}`;
    $c('sdForm').onsubmit = async () => { await cloudApi('POST', `share?token=${CL.route.token}&action=submit`, { note: $c('sdNote').value.trim() }); s.status = 'submitted'; shareStatus(); renderSide(); };
    if ($c('sdReset')) { let armed = 0; $c('sdReset').onclick = async e => { if (Date.now() - armed > 3000) { armed = Date.now(); e.target.textContent = 'Click again to undo everything'; return; }
      await cloudApi('POST', `share?token=${CL.route.token}&action=reset`); await openShare(CL.route.token); }; }
  } else {
    B.innerHTML = `<div class="cl-item"><h4>Look around</h4><p>Drag to orbit, scroll to zoom. Use <b>Front · Rear · Aerial</b> for views, or pick a floor to see it with the roof off.</p></div>
      <div class="cl-item"><h4>Walk inside</h4><p>Switch to <b>Walk</b> or <b>Character</b>, or drag the little person onto the house. Move with WASD or the arrow keys.</p></div>
      ${s.access !== 'view' ? '<div class="cl-item"><h4>Make it yours</h4><p>Pick finishes in the <b>Finishes</b> panel' + (s.access === 'edit' ? ', or press <b>Make changes</b> to move rooms and walls' : '') + '. Everything saves as you go, and the builder’s original stays untouched.</p></div>' : ''}
      <div class="cl-item"><h4>Comment</h4><p>Press <b>Pin to a spot</b>, click anywhere in the house, and write your note.</p></div>`;
  }
}
function welcome() {
  const s = CL.share, w = $c('clWelcome');
  w.innerHTML = `<h2>Hi ${clEsc(s.customer.split(' ')[0])}, welcome to your home</h2>${s.message ? `<blockquote>${clEsc(s.message)}</blockquote>` : ''}
    <p>This is <b>${clEsc(s.project.name)}</b> in 3D. Look around, walk inside, ${s.access === 'edit' ? 'try changes to the layout and finishes, ' : s.access === 'finishes' ? 'try different finishes, ' : ''}and pin comments anywhere. ${s.access !== 'view' ? 'Your changes save to your own copy as you go.' : ''}</p>
    <div class="st-row"><button class="btn st-primary" type="button" id="wcGo">Start exploring</button></div>`;
  w.hidden = false; $c('wcGo').onclick = () => { w.hidden = true; try { localStorage.setItem('welcomed-' + CL.route.token, '1'); } catch (e) { } };
}
function askSharePass(token, wrong) {
  const w = $c('clWelcome');
  w.innerHTML = `<h2>This home is password protected</h2><p>Enter the password your builder gave you.</p><form class="cl-form" id="spForm" onsubmit="return false"><input id="spIn" type="password" autocomplete="off" aria-label="Password" placeholder="Password"><p class="st-err">${wrong ? 'That password didn’t work.' : ''}</p><div class="st-row"><button class="btn st-primary" type="submit">Open</button></div></form>`;
  w.hidden = false; $c('clHead').hidden = $c('clSide').hidden = $c('clSideBtn').hidden = true; $c('spIn').focus();
  $c('spForm').onsubmit = () => { try { sessionStorage.setItem('share-pass-' + token, $c('spIn').value); } catch (e) { } w.hidden = true; $c('clHead').hidden = false; $c('clSideBtn').hidden = false; openShare(token); };
}
function showNotice(title, text) { const w = $c('clWelcome'); w.innerHTML = `<h2>${clEsc(title)}</h2><p>${clEsc(text)}</p>`; w.hidden = false; $c('clHead').hidden = $c('clSide').hidden = $c('clSideBtn').hidden = true; }

// ---------- boot ----------
(async () => {
  let h = null;
  try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 3000); const r = await fetch('/api/health', { signal: ctl.signal }); if (r.ok) h = await r.json(); } catch (e) { }
  if (!h?.ok) { if (parseRoute().kind !== 'none') showNotice('This link needs the online version', 'Open it from the website your builder sent you.'); return; }
  CL.on = true; CL.brand = h.brand; CL.locked = h.adminLocked;
  const sb = document.createElement('button'); sb.className = 'tb-b'; sb.id = 'studioBtn'; sb.type = 'button'; sb.innerHTML = '<svg class="ic"><use href="#i-studio"/></svg><span class="tb-t">Projects</span>'; sb.dataset.tip = 'All projects';
  sb.onclick = () => goRoute('#admin'); $c('tbCloud').append(sb);
  addEventListener('hashchange', cloudRoute); cloudRoute();
})();
