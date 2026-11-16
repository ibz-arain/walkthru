
// =====================================================================
//  ACCOUNT — who is signed in, the toolbar account menu, and syncing "My designs" to the account.
//  Signed out (or without the API) everything stays in this browser exactly as before.
// =====================================================================
var ACC = { user: null, org: null, role: null, sync: 'local' }; // sync: local | saving | saved | error
const accEl = id => document.getElementById(id);
async function accApi(method, path, data) {
  const r = await fetch('/api/' + path, { method, headers: { 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  let j = {}; try { j = await r.json(); } catch (e) { }
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status });
  return j;
}
const signInUrl = (mode = 'login') => `/account#${mode}?next=${encodeURIComponent(location.pathname + location.hash)}`;
function writeDS() { try { localStorage.setItem('walkthru-designs-v1', JSON.stringify(DS)); } catch (e) { } }

// ---------- sync ----------
let syncT = 0, syncing = null;
// builder.js calls this after every local save of a design.
function designSynced() {
  if (!ACC) return; // called during start-up, before this file has run
  const d = typeof curDesign === 'function' && curDesign(); if (!d || H3P || cloudSave) return;
  d.t = Date.now(); if (!ACC.user) return;
  ACC.sync = 'saving'; accRender(); clearTimeout(syncT); syncT = setTimeout(() => pushDesign(d), 1200);
}
async function pushDesign(d) {
  if (!ACC.user || !d) return;
  try {
    if (d.cid) await accApi('PUT', `designs?id=${encodeURIComponent(d.cid)}`, { name: d.name, bm: d.bm });
    else { const j = await accApi('POST', 'designs', { name: d.name, bm: d.bm }); d.cid = j.id; writeDS(); }
    d.st = Date.now(); writeDS(); ACC.sync = 'saved';
  } catch (e) { ACC.sync = e.status === 404 ? (delete d.cid, writeDS(), 'error') : 'error'; }
  accRender();
}
function forgetCloudDesign(d) { if (ACC.user && d?.cid) accApi('DELETE', `designs?id=${encodeURIComponent(d.cid)}`).catch(() => { }); }
// After sign-in: bring down designs saved from other devices, upload ones that only live here.
async function pullDesigns() {
  if (!ACC.user || syncing) return syncing; ACC.sync = 'saving'; accRender();
  syncing = (async () => {
    const { designs } = await accApi('GET', 'designs'); let changed = false;
    for (const r of designs) {
      const local = DS.list.find(d => d.cid === r.id);
      if (local && (local.t || 0) >= r.updated_at) continue;
      const { design } = await accApi('GET', `designs?id=${encodeURIComponent(r.id)}`);
      if (local) { local.bm = design.bm; local.name = design.name; local.t = r.updated_at; }
      else DS.list.push({ id: Math.max(0, ...DS.list.map(x => x.id)) + 1, cid: r.id, name: design.name, bm: design.bm, t: r.updated_at });
      changed = true;
    }
    for (const d of DS.list) if (!d.cid || !designs.some(r => r.id === d.cid)) { delete d.cid; await pushDesign(d); }
    writeDS(); ACC.sync = 'saved';
    if (changed && !H3P && !cloudSave) { const cur = curDesign(); if (cur) { BM = cur.bm; resetBID(); normalizeStairs(BM); rebuildHouse3(); } designLabel(); }
  })().catch(() => { ACC.sync = 'error'; }).finally(() => { syncing = null; accRender(); });
  return syncing;
}

// ---------- toolbar menu ----------
function accRender() {
  const b = accEl('acctBtn'); if (!b) return;
  const u = ACC.user, initials = u ? (u.name || u.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') : '';
  b.innerHTML = u ? `<span class="avatar">${initials}</span>` : '<svg class="ic"><use href="#i-user"/></svg>';
  b.dataset.tip = u ? `${u.name || u.email}` : 'Sign in to save your designs';
  const st = accEl('syncState'); if (st) st.textContent = !u ? 'Designs are saved in this browser only.' : { saving: 'Saving to your account…', saved: 'All designs saved to your account.', error: 'Couldn’t reach the server. Changes are kept here and will retry.', local: 'Saved in this browser.' }[ACC.sync];
  const p = accEl('acctPop'); if (!p) return;
  p.querySelector('#accIn').hidden = !u; p.querySelector('#accOut').hidden = !!u;
  if (u) { accEl('accName').textContent = u.name || u.email; accEl('accMail').textContent = u.email; accEl('accOrg').textContent = ACC.org ? `${ACC.org.name} · ${ACC.role}` : 'No workspace'; }
}
accEl('accSignIn').onclick = () => { location.href = signInUrl('login'); };
accEl('accSignUp').onclick = () => { location.href = signInUrl('signup'); };
accEl('accSettings').onclick = () => { location.href = '/account'; };
accEl('accStudio').onclick = () => { closePops(); location.hash = '#admin'; };
accEl('accOutBtn').onclick = async () => { await accApi('POST', 'auth?action=logout').catch(() => { }); location.reload(); };

(async () => {
  try { const me = await accApi('GET', 'auth'); ACC.user = me.user; ACC.org = me.org; ACC.role = me.role; accEl('acctBtn').hidden = false; }
  catch (e) { document.documentElement.classList.remove('gate'); return; } // no API (the single-file build): stays a local demo
  // Only signed-in people use the app. Customer links (#c/…) are for buyers and stay open.
  if (!ACC.user && !/^#c\//.test(location.hash)) { location.replace(signInUrl('login')); return; }
  document.documentElement.classList.remove('gate');
  addEventListener('hashchange', () => { if (!ACC.user && !/^#c\//.test(location.hash)) location.replace(signInUrl('login')); });
  accRender(); if (ACC.user) { pullDesigns(); loadCatalog(); }
  // Signed-in people start on their Projects page; the bare playground is one click away from there.
  let sandbox = false; try { sandbox = sessionStorage.getItem('wt-sandbox') === '1'; } catch (e) { }
  if (ACC.user && !sandbox && (location.hash === '' || location.hash === '#')) location.hash = '#admin';
})();
