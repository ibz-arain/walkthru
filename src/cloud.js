
// =====================================================================
//  CLOUD — Studio (admin) and customer links, backed by the /api functions (Turso + object storage).
//  Routes:  #admin → project dashboard · #admin/p/<id> → project workspace · #c/<token> → customer view.
//  Without the API (e.g. the Claude artifact) none of this shows and the app runs on this browser alone.
// =====================================================================
const CL = { on: false, brand: { name: 'Walkthru' }, locked: false, route: null, project: null, share: null, view: null, poll: 0, saveT: 0, dirty: false };
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
document.addEventListener('submit', e => { if (e.target.closest('#studio, #clWelcome')) e.preventDefault(); }, true);

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
  const r = parseRoute(), prev = CL.route; CL.route = r; clearInterval(CL.poll);
  $c('studio').hidden = r.kind !== 'studio';
  const inDesign = r.kind === 'project' || r.kind === 'customer';
  document.body.classList.toggle('cl-on', inDesign);
  $c('clHead').hidden = !inDesign; if (inDesign) closePanel(); $c('clBanner').hidden = true; $c('clWelcome').hidden = true;
  if (!inDesign) { if (prev && (prev.kind === 'project' || prev.kind === 'customer')) leaveCloudDesign(); }
  if (r.kind === 'studio') return studioHome();
  if (r.kind === 'project') return openProject(r.id);
  if (r.kind === 'customer') return openShare(r.token);
}
const goRoute = h => { if (location.hash !== h) location.hash = h; else cloudRoute(); };

// ---------- Studio dashboard ----------
let stProjects = [];
async function studioHome() {
  document.title = 'Projects · Walkthru';
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
  document.body.classList.toggle('cl-customer', cust); if (!cust) document.body.classList.remove('cl-view');
  if (cust) { eb.hidden = CL.share.access !== 'edit'; setEditLabel('Make changes'); }
  else if (CL.route?.kind === 'project') { eb.hidden = !!review; setEditLabel('Edit plan'); if (review && PE.open) openEditor(false); }
}
function banner(html) { const b = $c('clBanner'); b.hidden = !html; b.innerHTML = html || ''; return b; }
// ---------- Studio: project workspace ----------
async function openProject(id, keepView) {
  let j; try { j = await cloudApi('GET', `project?id=${encodeURIComponent(id)}`); }
  catch (e) { if (e.status === 401) return goRoute('#admin'); banner(`${clEsc(e.message)} <button class="btn" type="button" onclick="location.hash='#admin'">Back to projects</button>`); return; }
  const first = !CL.project || CL.project.project.id !== id;
  CL.project = j; CL.view = 'base';
  showDesign(j.bm, { save: projectSave }); if (first && !keepView) goView('front', true);
  $c('clBrand').textContent = '';
  const t = $c('clTitle'); t.readOnly = false; t.value = j.project.name; fitTitle(); document.title = `${j.project.name} · ${CL.brand.name}`;
  $c('clSub').textContent = [j.project.client, j.project.address].filter(Boolean).join(' · '); t.title = $c('clSub').textContent || 'Click to rename';
  setSave('Saved'); banner(''); chrome();
  if (first) setTimeout(saveThumb, 2500);
}
let thumbAt = 0;
async function saveThumb() {
  if (CL.route?.kind !== 'project' || CL.view !== 'base' || Date.now() - thumbAt < 120e3) return; thumbAt = Date.now();
  const t = captureThumb(); if (t) try { await cloudApi('PUT', `project?id=${encodeURIComponent(CL.route.id)}`, { thumb: t }); } catch (e) { }
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
// ---------- Customer link ----------
async function openShare(token) {
  let j; try { j = await cloudApi('GET', `share?token=${encodeURIComponent(token)}`); }
  catch (e) { if (e.needPass) return askSharePass(token, !!sharePass()); showNotice('This link isn’t available', e.message === 'This link is no longer active' ? 'Ask your builder for a new link.' : e.message); return; }
  CL.share = j; CL.view = 'base';
  const canSave = j.access !== 'view';
  showDesign(j.bm, { save: canSave ? shareSave : null }); goView('front', true);
  $c('clBrand').textContent = j.brand.name; CL.brand = j.brand;
  const t = $c('clTitle'); t.readOnly = true; t.value = j.project.name; fitTitle(); document.title = `${j.project.name} · ${j.brand.name}`;
  $c('clSub').textContent = [j.public ? null : `Prepared for ${j.customer}`, j.project.address].filter(Boolean).join(' · ');
  document.body.classList.toggle('cl-view', j.access === 'view');
  shareStatus(); chrome();
  let seen = false; try { seen = localStorage.getItem('welcomed-' + token) === '1'; } catch (e) { }
  if (!seen && !j.public) welcome();
}
function shareStatus() {
  const s = CL.share, sent = s.status === 'submitted', acc = s.status === 'accepted';
  setSave(sent ? `Sent to ${CL.brand.name}` : acc ? `${CL.brand.name} accepted your changes` : s.changed ? 'Your changes are saved' : s.access === 'view' ? 'View only' : 'Make it yours: changes save as you go');
  banner('');
}
function shareSave() {
  CL.share.changed = true; if (CL.share.status === 'submitted' || CL.share.status === 'accepted') CL.share.status = 'editing';
  setSave('Saving…'); clearTimeout(CL.saveT);
  CL.saveT = setTimeout(async () => { try { await cloudApi('PUT', `share?token=${CL.route.token}`, { bm: BM }); shareStatus(); } catch (e) { setSave(`Not saved: ${e.message}`); } }, 800);
}
function welcome() {
  const s = CL.share, w = $c('clWelcome');
  w.innerHTML = `<h2>Hi ${clEsc(s.customer.split(' ')[0])}, welcome to your home</h2>${s.message ? `<blockquote>${clEsc(s.message)}</blockquote>` : ''}
    <p>This is <b>${clEsc(s.project.name)}</b> in 3D. Look around and walk inside${s.access === 'edit' ? ', and try changes to the layout and finishes' : s.access === 'finishes' ? ', and try different finishes' : ''}. ${s.access !== 'view' ? 'Your changes save to your own copy as you go.' : ''}</p>
    <div class="st-row"><button class="btn st-primary" type="button" id="wcGo">Start exploring</button></div>`;
  w.hidden = false; $c('wcGo').onclick = () => { w.hidden = true; try { localStorage.setItem('welcomed-' + CL.route.token, '1'); } catch (e) { } };
}
function askSharePass(token, wrong) {
  const w = $c('clWelcome');
  w.innerHTML = `<h2>This home is password protected</h2><p>Enter the password your builder gave you.</p><form class="cl-form" id="spForm" onsubmit="return false"><input id="spIn" type="password" autocomplete="off" aria-label="Password" placeholder="Password"><p class="st-err">${wrong ? 'That password didn’t work.' : ''}</p><div class="st-row"><button class="btn st-primary" type="submit">Open</button></div></form>`;
  w.hidden = false; $c('clHead').hidden = true; $c('spIn').focus();
  $c('spForm').onsubmit = () => { try { sessionStorage.setItem('share-pass-' + token, $c('spIn').value); } catch (e) { } w.hidden = true; $c('clHead').hidden = false; openShare(token); };
}
function showNotice(title, text) { const w = $c('clWelcome'); w.innerHTML = `<h2>${clEsc(title)}</h2><p>${clEsc(text)}</p>`; w.hidden = false; $c('clHead').hidden = true; }

// ---------- boot ----------
(async () => {
  let h = null;
  try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 3000); const r = await fetch('/api/health', { signal: ctl.signal }); if (r.ok) h = await r.json(); } catch (e) { }
  if (!h?.ok) { if (parseRoute().kind !== 'none') showNotice('This link needs the online version', 'Open it from the website your builder sent you.'); return; }
  CL.on = true; CL.brand = h.brand; CL.locked = h.adminLocked;
  addEventListener('hashchange', cloudRoute); cloudRoute();
})();
