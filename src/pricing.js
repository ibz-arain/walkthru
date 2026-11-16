
// =====================================================================
//  PRICING — the workspace price list on top of the design: upgrade prices on finish choices, add-on
//  packages, a running total, and a selections sheet to print or sign. The list lives in /api/catalog.
//  Picks are the finishes (FIN_CUR) plus BM.addons (ids of add-ons the buyer ticked).
// =====================================================================
var PRICE = { cat: null, canEdit: false, ready: false };
const usd = v => '$' + Math.round(v).toLocaleString();
function pricesChanged() { if (PRICE && PRICE.ready) renderPriceBits(); } // called while the app is still starting, before this file runs
async function loadCatalog() {
  try {
    const kind = CL.route?.kind;
    const j = kind === 'customer' ? await cloudApi('GET', `catalog?token=${encodeURIComponent(CL.route.token)}`) : ACC.user ? await accApi('GET', 'catalog') : null;
    PRICE.cat = j?.catalog || null; PRICE.canEdit = !!j?.canEdit;
  } catch (e) { PRICE.cat = null; }
  PRICE.ready = true; renderPriceBits(); $c('stPrices').hidden = !PRICE.canEdit;
}
const finPrice = key => { const v = FIN_CUR[key]; return typeof v === 'number' ? (PRICE.cat?.finish?.[key]?.[v] || 0) : 0; };
const basePrice = () => CL.route?.kind === 'project' ? (CL.project?.project?.base_price ?? PRICE.cat?.base ?? 0) : PRICE.cat?.base || 0;
function selections() { // [{group, item, choice, price}] plus totals
  const rows = [];
  for (const [sec, items] of FIN) for (const [key, label, opts] of items) { const v = FIN_CUR[key]; if (v === undefined) continue; rows.push({ group: sec, item: label, choice: typeof v === 'number' ? opts[v]?.[0] : `Custom ${v}`, price: finPrice(key) }); }
  for (const a of PRICE.cat?.addons || []) if ((BM.addons || []).includes(a.id)) rows.push({ group: a.group || 'Options', item: a.name, choice: 'Included', price: a.price });
  const options = rows.reduce((s, r) => s + r.price, 0), base = basePrice();
  return { rows, base, options, total: base + options };
}
const hasPricing = () => !!PRICE.cat && (PRICE.cat.base > 0 || Object.keys(PRICE.cat.finish || {}).length > 0 || (PRICE.cat.addons || []).length > 0 || basePrice() > 0);

function renderPriceBits() {
  const cat = PRICE.cat, on = hasPricing();
  for (const [, items] of FIN) for (const [key, , opts] of items) opts.forEach((_, i) => { // price tags on the swatches
    const b = document.getElementById(`sw-${key}-${i}`); if (!b) return; let em = b.querySelector('em'); const p = cat?.finish?.[key]?.[i];
    if (p) { if (!em) { em = document.createElement('em'); b.appendChild(em); } em.textContent = '+' + usd(p); } else em?.remove();
  });
  const fb = document.getElementById('finishBody'); let bar = document.getElementById('priceBar'), box = document.getElementById('addonsBox');
  if (!on) { bar?.remove(); box?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'priceBar'; fb.prepend(bar); }
  const S = selections(), canPick = !(CL.route?.kind === 'customer' && CL.share?.access === 'view');
  bar.innerHTML = `<div><span>Base</span><b>${usd(S.base)}</b></div><div><span>Options</span><b>+${usd(S.options)}</b></div><div class="tot"><span>Total</span><b>${usd(S.total)}</b></div>`;
  const adds = cat.addons || [];
  if (!adds.length) { box?.remove(); return; }
  if (!box) { box = document.createElement('div'); box.id = 'addonsBox'; box.className = 'grp'; fb.insertBefore(box, bar.nextSibling); }
  const groups = [...new Set(adds.map(a => a.group || 'Options'))];
  box.innerHTML = '<h3>Add-ons</h3>' + groups.map(g => `<p class="ad-g">${g}</p>` + adds.filter(a => (a.group || 'Options') === g).map(a => `<label class="sw-row ad"><span>${a.name.replace(/</g, '&lt;')}<small>+${usd(a.price)}</small></span><input type="checkbox" data-addon="${a.id}" ${(BM.addons || []).includes(a.id) ? 'checked' : ''} ${canPick ? '' : 'disabled'}><span class="tg"></span></label>`).join('')).join('');
  box.querySelectorAll('[data-addon]').forEach(i => i.onchange = () => { const id = i.dataset.addon, s = new Set(BM.addons || []); if (i.checked) s.add(id); else s.delete(id); BM.addons = [...s]; saveBM(); renderPriceBits(); window.wtTrack?.('addon_toggled'); });
}

// ---------- selections sheet ----------
function sheetName() { return CL.route?.kind === 'project' ? CL.project.project.name : CL.route?.kind === 'customer' ? CL.share.project.name : $c('designNow').textContent; }
function selectionsSheet() {
  const S = selections(), win = window.open('', '_blank'); if (!win) return toast('Allow pop-ups to open the sheet');
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const who = CL.route?.kind === 'customer' ? CL.share.customer : CL.route?.kind === 'project' ? (CL.project.project.client || '') : '';
  const addr = CL.route?.kind === 'project' ? CL.project.project.address : CL.route?.kind === 'customer' ? CL.share.project.address : '';
  let last = '';
  const body = S.rows.map(r => { const g = r.group !== last ? `<tr class="g"><td colspan="3">${esc(r.group)}</td></tr>` : ''; last = r.group; return `${g}<tr><td>${esc(r.item)}</td><td>${esc(r.choice)}</td><td>${r.price ? '+' + usd(r.price) : 'Included'}</td></tr>`; }).join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(sheetName())} · selections</title><style>
    @page{margin:14mm} body{font:12.5px/1.45 Inter,system-ui,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px} h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em} .m{color:#666;margin:0 0 20px}
    table{width:100%;border-collapse:collapse} td{padding:7px 0;border-bottom:1px solid #e5e5e5} td:last-child{text-align:right;white-space:nowrap} tr.g td{padding-top:16px;font-weight:600;border-bottom:1.5px solid #111}
    .sum td{border:0;padding:4px 0} .sum .t td{font-size:16px;font-weight:700;border-top:2px solid #111;padding-top:10px} .sig{display:grid;grid-template-columns:2fr 1fr;gap:28px;margin-top:48px} .sig div{border-top:1px solid #111;padding-top:6px;color:#666;font-size:11px}
    .tools{text-align:center;margin-bottom:16px} .tools button{font:500 14px Inter,sans-serif;padding:10px 16px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer} @media print{.tools{display:none}}
    </style></head><body><div class="tools"><button onclick="print()">Save as PDF or print</button></div>
    <h1>${esc(sheetName())}</h1><p class="m">Selections${who ? ' for ' + esc(who) : ''}${addr ? ' · ' + esc(addr) : ''} · ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <table>${body}</table>
    <table class="sum" style="margin-top:22px"><tr><td>Base price</td><td></td><td>${usd(S.base)}</td></tr><tr><td>Options</td><td></td><td>+${usd(S.options)}</td></tr><tr class="t"><td>Total</td><td></td><td>${usd(S.total)}</td></tr></table>
    <div class="sig"><div>Buyer signature</div><div>Date</div><div>Builder signature</div><div>Date</div></div></body></html>`);
  win.document.close(); window.wtTrack?.('selections_sheet');
}
function selectionsCsv() {
  const S = selections(), q = c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c;
  const rows = [['Group', 'Item', 'Selection', 'Price'], ...S.rows.map(r => [r.group, r.item, r.choice, r.price]), [], ['', 'Base price', '', S.base], ['', 'Options', '', S.options], ['', 'Total', '', S.total]];
  downloadText(rows.map(r => r.map(q).join(',')).join('\n'), `${slug()}-selections.csv`, 'text/csv'); toast('Selections saved');
}
$c('exSel').onclick = selectionsSheet; $c('exSelCsv').onclick = selectionsCsv;

// ---------- the price tab in a project / on a customer link ----------
function priceSideHTML(studio) {
  const S = selections();
  return `${studio ? `<form class="cl-form" id="bpForm" onsubmit="return false"><label>Base price for this home <input id="bpIn" type="number" min="0" step="1000" value="${CL.project.project.base_price ?? ''}" placeholder="${PRICE.cat?.base || 0}"></label></form>` : ''}
    <div class="cl-item"><h4><span>Total</span><span>${usd(S.total)}</span></h4><small>Base ${usd(S.base)} · options +${usd(S.options)}</small></div>
    ${S.rows.filter(r => r.price).map(r => `<div class="cl-ev"><i></i><span>${r.item}: ${r.choice}</span><small>+${usd(r.price)}</small></div>`).join('') || '<p class="cl-sub">No paid options picked yet.</p>'}
    <div class="cl-acts"><button class="btn" type="button" id="psSheet">Selections sheet</button><button class="btn" type="button" id="psCsv">CSV</button>${studio && PRICE.canEdit ? '<button class="btn" type="button" id="psList">Price list</button>' : ''}</div>`;
}
function wirePriceSide(studio) {
  $c('psSheet').onclick = selectionsSheet; $c('psCsv').onclick = selectionsCsv; if ($c('psList')) $c('psList').onclick = () => openPriceList();
  if (studio) $c('bpIn').onchange = async e => { const v = e.target.value; await cloudApi('PUT', `project?id=${encodeURIComponent(CL.route.id)}`, { base_price: v === '' ? null : +v }); CL.project.project.base_price = v === '' ? null : +v; renderPriceBits(); renderSide(); };
}

// ---------- price list editor (Studio) ----------
function openPriceList() {
  const cat = JSON.parse(JSON.stringify(PRICE.cat || { base: 0, finish: {}, addons: [] })), f = $c('priceForm');
  const draw = () => {
    f.innerHTML = `<h2>Price list</h2><label>Default base price <input id="plBase" type="number" min="0" step="1000" value="${cat.base || ''}" placeholder="0"></label>
      <div class="pl-scroll">${FIN.map(([sec, items]) => `<div class="cl-sec">${sec} finishes</div>` + items.map(([key, label, opts]) => `<div class="pl-row"><b>${label}</b>${opts.map(([n], i) => `<label>${n}<input type="number" min="0" step="100" data-fk="${key}" data-fi="${i}" value="${cat.finish?.[key]?.[i] || ''}" placeholder="Included"></label>`).join('')}</div>`).join('')).join('')}
      <div class="cl-sec">Add-ons</div>${(cat.addons || []).map((a, i) => `<div class="pl-add"><input data-ag="${i}" value="${a.group || ''}" placeholder="Group"><input data-an="${i}" value="${a.name.replace(/"/g, '&quot;')}" placeholder="Name"><input data-ap="${i}" type="number" min="0" step="100" value="${a.price || ''}" placeholder="Price"><button class="btn" type="button" data-ax="${i}" aria-label="Remove">✕</button></div>`).join('')}
      <button class="btn" type="button" id="plAdd">Add an option</button></div>
      <div class="st-row"><button class="btn st-ghost" type="button" id="plCancel">Cancel</button><button class="btn st-primary" type="submit">Save prices</button></div><p class="st-err" id="plErr"></p>`;
    f.querySelectorAll('[data-fk]').forEach(i => i.oninput = () => { const k = i.dataset.fk; cat.finish[k] = cat.finish[k] || {}; if (i.value) cat.finish[k][i.dataset.fi] = +i.value; else delete cat.finish[k][i.dataset.fi]; });
    f.querySelectorAll('[data-ag],[data-an],[data-ap]').forEach(i => i.oninput = () => { const a = cat.addons[i.dataset.ag ?? i.dataset.an ?? i.dataset.ap]; if (i.dataset.ag !== undefined) a.group = i.value; else if (i.dataset.an !== undefined) a.name = i.value; else a.price = +i.value || 0; });
    f.querySelectorAll('[data-ax]').forEach(b => b.onclick = () => { cat.addons.splice(+b.dataset.ax, 1); draw(); });
    $c('plAdd').onclick = () => { cat.addons.push({ id: Math.random().toString(36).slice(2, 10), group: 'Packages', name: '', price: 0 }); draw(); f.querySelector(`[data-an="${cat.addons.length - 1}"]`).focus(); };
    $c('plBase').oninput = e => cat.base = +e.target.value || 0;
    $c('plCancel').onclick = () => f.hidden = true;
  };
  f.onsubmit = async e => { e?.preventDefault(); try { const j = await accApi('PUT', 'catalog', cat); PRICE.cat = j.catalog; f.hidden = true; renderPriceBits(); toast('Prices saved'); if (CL.route?.kind === 'project') renderSide(); } catch (e) { $c('plErr').textContent = e.message; } };
  draw(); f.hidden = false;
}
$c('stPrices').onclick = () => openPriceList();
