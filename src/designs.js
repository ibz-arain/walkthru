
// =====================================================================
//  DESIGNS — several saved My Design plans: + makes a new one, ▾ switches, renames, duplicates, deletes.
// =====================================================================
const dmEl = document.getElementById('designMenu');
function designLabel() { const t = document.getElementById('designTab'); t.textContent = curDesign()?.name || 'My design'; t.title = 'Design: ' + t.textContent; uiSync(); }
function openDesign(id) {
  const was = H3P; if (H3P) usePreset(false);
  saveBM(); DS.cur = id; const d = curDesign(); BM = d.bm && Array.isArray(d.bm.rooms) ? d.bm : permitPlan(); resetBID(); normalizeStairs(BM);
  PE.sel = null; PE.selStair = null; PE.selWall = null; PE.hist = [];
  saveBM(); designLabel(); fillDesignMenu(); rebuildHouse3(); if (PE.open) { peFit(); peDraw(); peInspector(); }
  if (curHouse !== 3 || was) setHouse(3);
}
function newDesign(from) {
  window.wtTrack?.('design_created', { from });
  const id = Math.max(0, ...DS.list.map(x => x.id)) + 1, n = DS.list.length + 1;
  const bm = from === 'campana' ? campanaPlan() : from === 'blank' ? { roof: 'hip', rooms: [], stairs: [] } : from === 'copy' ? JSON.parse(JSON.stringify(BM)) : permitPlan();
  DS.list.push({ id, name: from === 'campana' ? '1196 Campana' : from === 'copy' ? `${curDesign().name} copy` : `Design ${n}`, bm }); openDesign(id);
  const inp = document.getElementById('designName'); if (!dmEl.hidden) { inp.focus(); inp.select(); }
}
function fillDesignMenu() {
  document.getElementById('designName').value = curDesign()?.name || '';
  document.getElementById('designList').innerHTML = DS.list.map(d => `<button type="button" data-design="${d.id}" aria-current="${d.id === DS.cur && tabHouse() === 3}">${d.name.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}<small>${d.bm?.rooms?.length || 0} rooms</small></button>`).join('');
  document.querySelectorAll('#segHouse [data-house]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.house === tabHouse())));
  document.querySelectorAll('[data-design]').forEach(b => b.onclick = () => openDesign(+b.dataset.design));
  document.getElementById('designDel').disabled = DS.list.length < 2;
}
document.getElementById('designAdd').onclick = e => { e.stopPropagation(); newDesign('permit'); const inp = document.getElementById('designName'); inp.focus(); inp.select(); };
document.getElementById('designName').oninput = e => { const d = curDesign(); if (!d) return; d.name = e.target.value.trim() || 'Untitled design'; saveBM(); designLabel();
  const b = document.querySelector(`[data-design="${d.id}"]`); if (b) b.firstChild.textContent = d.name; };
document.getElementById('designDup').onclick = () => newDesign('copy');
document.getElementById('designNewPermit').onclick = () => newDesign('permit');
document.getElementById('designNewBlank').onclick = () => newDesign('blank');
let delArm = 0;
document.getElementById('designDel').onclick = e => { // two clicks: confirm inside the menu (no browser dialogs here)
  const b = e.currentTarget; if (DS.list.length < 2) return;
  if (Date.now() - delArm > 2500) { delArm = Date.now(); b.textContent = 'Click again to delete'; setTimeout(() => b.textContent = 'Delete', 2500); return; }
  delArm = 0; b.textContent = 'Delete'; const i = DS.list.findIndex(x => x.id === DS.cur); forgetCloudDesign(DS.list[i]); DS.list.splice(i, 1); openDesign(DS.list[Math.max(0, i - 1)].id);
};
designLabel();
// On House 3 the edit button copies the plan into your designs first, so House 3 itself never changes.
document.getElementById('editBtn').addEventListener('click', e => { if (curHouse === 1 && !PE.open) { e.stopImmediatePropagation(); newDesign('permit'); curDesign().name = 'Sample 1 copy'; designLabel(); saveBM(); openEditor(true); return; } if (!H3P) return; e.stopImmediatePropagation(); newDesign('campana'); openEditor(true); }, true);
