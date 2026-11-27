// =====================================================================
//  AGENT — chat beside the plan. A question gets an answer. A request to
//  build or change the house comes back as commands, applied one at a time
//  so the 3D model updates while the agent checks its work and continues.
// =====================================================================
const CHAT_KEY = 'walkthru-agent';
const CHAT_MAX_FILES = 4, CHAT_MAX_BYTES = 8 * 1024 * 1024; // what you can pick; images are shrunk before sending
const CHAT_SEND_BUDGET = 3_400_000; // all attachments together, as data URLs: the hosting takes request bodies up to 4.5 MB
const CHAT_IMG_PX = 1800;           // longest side of an image as sent: plenty to read a floor plan
const CHAT_MIME = { 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image', 'application/pdf': 'pdf' };
let chatMsgs = [];
let chatPending = [];
let chatBusy = false;
let chatGen = 0;
// Each design keeps its own conversation (a Studio project, a customer link, or one of this browser's designs), so the
// agent never answers about the last house you had open.
const chatKey = () => { const r = typeof CL !== 'undefined' ? CL.route : null;
  return `${CHAT_KEY}:${r?.kind === 'project' ? `p:${r.id}` : r?.kind === 'customer' ? `c:${r.token}` : `d:${typeof DS !== 'undefined' ? DS.cur : ''}`}`; };
let chatAt = null;
function loadChat(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
    return !Array.isArray(saved) ? [] : saved.flatMap(m => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return [];
      const files = Array.isArray(m.files) ? m.files.flatMap(f => f && typeof f.name === 'string' ? [{ name: f.name.slice(0, 120), kind: f.kind === 'image' ? 'image' : 'pdf' }] : []) : [];
      const steps = Array.isArray(m.steps) ? m.steps.flatMap(s => s && typeof s.t === 'string' && ['think', 'act', 'say', 'err', 'note'].includes(s.k) ? [{ k: s.k, t: s.t.slice(0, 600) }] : []).slice(0, 80) : [];
      const options = Array.isArray(m.ask?.options) ? m.ask.options.flatMap(o => o && typeof o.label === 'string' ? [{ id: String(o.id || o.label).slice(0, 80), label: o.label.slice(0, 160) }] : []).slice(0, 6) : [];
      return [{ role: m.role, text: m.text, files, ...(steps.length ? { steps } : {}), ...(options.length ? { ask: { q: String(m.ask.q || '').slice(0, 300), options } } : {}) }];
    });
  } catch (e) { return []; }
}
// Another design is open: put this conversation away and bring that one's back (a reply in flight is stopped).
function syncChatDesign() {
  const key = chatKey(); if (key === chatAt) return;
  if (chatAt !== null && chatBusy) { chatCtl?.abort(); chatCtl = null; chatGen++; chatBusy = false; }
  chatAt = key; chatMsgs = loadChat(key); chatPending = [];
  if (typeof renderChat === 'function' && $u('agentLog')) { renderPending(); renderChat(); syncSend(); }
}

const chatEsc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function saveChat() {
  try {
    const slim = chatMsgs.map(m => ({ role: m.role, text: m.text, files: (m.files || []).map(f => ({ name: f.name, kind: f.kind })), steps: (m.steps || []).map(s => ({ k: s.k, t: s.t })), ...(m.ask?.options?.length ? { ask: m.ask } : {}) }));
    sessionStorage.setItem(chatAt || chatKey(), JSON.stringify(slim));
  } catch (e) { }
}

function fileBits(files) {
  return (files || []).map(f => {
    if (f.kind === 'image' && f.data) return `<img class="chat-shot" alt="" src="${f.data}">`;
    const icon = f.kind === 'pdf' ? 'i-pdf' : 'i-clip';
    return `<span class="chat-file"><svg class="ic"><use href="#${icon}"/></svg><b>${chatEsc(f.name)}</b></span>`;
  }).join('');
}
const STEP_VERB = /^(Added|Updated|Removed|Opened|Closed|Cleared|Set|Put|Resized|Moved)\b/;
function stepHtml(s, caret) {
  const verb = s.k === 'act' ? (s.t.match(STEP_VERB) || [])[1] : '';
  const text = chatEsc(s.t).replace(STEP_VERB, m => `<b class="chat-verb">${m}</b>`);
  return `<span class="chat-step ${s.k}${verb ? ` v-${verb.toLowerCase()}` : ''}">${text}${caret}</span>`;
}
function renderChat() {
  const log = $u('agentLog');
  if (!chatMsgs.length && !chatBusy) {
    log.innerHTML = '<div class="chat-empty"><svg class="ic"><use href="#i-msg"/></svg><b>Design agent</b><p>Drop a floor plan and ask for a house, or describe a change. It builds the plan floor by floor.</p></div>';
    return;
  }
  const caret = '<i class="chat-caret" aria-hidden="true"></i>', thinking = '<span class="chat-thinking" role="status">Thinking<i></i><i></i><i></i></span>';
  log.innerHTML = chatMsgs.map((m, i) => {
    const bits = m.files?.length ? `<span class="chat-files">${fileBits(m.files)}</span>` : '';
    const writing = chatBusy && i === chatMsgs.length - 1 && m.role === 'assistant';
    let body = '';
    if (m.steps?.length) {
      const parts = []; let work = [];
      const flush = open => {
        if (!work.length) return;
        const kinds = work.map(w => w.k), acts = kinds.filter(k => k === 'act').length, errs = kinds.filter(k => k === 'err').length, n = work.length;
        const label = (acts ? `${acts} change${acts === 1 ? '' : 's'}` : `${n} step${n === 1 ? '' : 's'}`) + (errs ? ` · ${errs} didn’t apply` : '');
        work = work.map(w => w.html);
        parts.push(`<details class="chat-work"${open ? ' open' : ''}><summary>${label}</summary><div class="chat-work-b">${work.join('')}</div></details>`);
        work = [];
      };
      m.steps.forEach((s, n) => {
        const mark = writing && n === m.steps.length - 1 ? caret : '';
        if (s.k === 'say' || s.k === 'note') { flush(false); parts.push(stepHtml(s, mark)); } // the app's own notes ("Still to fix…") sit apart from the agent's words
        else work.push({ k: s.k, html: stepHtml(s, mark) });
      });
      flush(writing);
      body = parts.join('');
    } else if (m.text) body = `<span class="chat-text">${chatEsc(m.text)}${writing ? caret : ''}</span>`;
    else if (writing) body = thinking;
    const choices = !writing && m.ask?.options?.length && i === chatMsgs.length - 1
      ? `<div class="chat-ask" role="group" aria-label="${chatEsc(m.ask.q || 'Choose')}">${m.ask.options.map((o, n) => `<button type="button" class="chat-opt" data-opt="${n}">${chatEsc(o.label)}</button>`).join('')}</div>`
      : '';
    return `<div class="chat-row ${m.role}"><div class="chat-bubble">${bits}${body}${choices}</div></div>`;
  }).join('') + (chatBusy && chatMsgs[chatMsgs.length - 1]?.role !== 'assistant' ? `<div class="chat-row assistant"><div class="chat-bubble">${thinking}</div></div>` : '');
  log.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => pickAsk(+b.dataset.opt));
  log.scrollTop = log.scrollHeight;
}
function pickAsk(n) {
  const m = chatMsgs.at(-1), o = m?.ask?.options?.[n];
  if (!o || chatBusy) return;
  delete m.ask;
  sendChat(/^\d+$/.test(o.id) ? `Use room ${o.id}. ${o.label}` : o.label, []);
}
function renderPending() {
  const box = $u('agentPending');
  box.hidden = !chatPending.length;
  box.innerHTML = chatPending.map(f => `<span class="chat-chip">${f.kind === 'image' ? `<img alt="" src="${f.data}">` : '<svg class="ic"><use href="#i-pdf"/></svg>'}<span>${chatEsc(f.name)}</span><button type="button" data-rm="${f.id}" aria-label="Remove ${chatEsc(f.name)}"><svg class="ic"><use href="#i-x"/></svg></button></span>`).join('');
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { chatPending = chatPending.filter(f => f.id !== b.dataset.rm); renderPending(); syncSend(); });
}

function fitComposer() {
  const t = $u('agentInput');
  t.style.height = 'auto';
  t.style.height = Math.min(120, t.scrollHeight) + 'px';
  t.style.overflowY = t.scrollHeight > 120 ? 'auto' : 'hidden';
}
function syncSend() { // while the agent works, the send button is a Stop button
  const b = $u('agentSend'), stop = chatBusy;
  b.disabled = !stop && !$u('agentInput').value.trim() && !chatPending.length;
  if (b.dataset.stop !== String(stop)) { b.dataset.stop = String(stop); b.classList.toggle('stop', stop); b.setAttribute('aria-label', stop ? 'Stop' : 'Send'); b.innerHTML = `<svg class="ic"><use href="#${stop ? 'i-stop' : 'i-send'}"/></svg>`; }
}

let chatDraw = 0;
function paintChat() { cancelAnimationFrame(chatDraw); chatDraw = requestAnimationFrame(() => { chatDraw = 0; renderChat(); }); }

function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
// A photo or scan of a drawing, shrunk to CHAT_IMG_PX on its longest side and re-encoded, so it fits the upload budget.
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, CHAT_IMG_PX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return { data: c.toDataURL('image/jpeg', .85), mime: 'image/jpeg' };
}
const pendingBytes = () => chatPending.reduce((n, f) => n + f.data.length, 0);
async function addFiles(list) {
  const files = [...list || []];
  for (const file of files) {
    if (chatPending.length >= CHAT_MAX_FILES) { toast('You can attach up to 4 drawings.'); break; }
    const mime = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
    const kind = CHAT_MIME[mime];
    if (!kind) { toast('Use a PDF, PNG, JPEG, WebP, or GIF.'); continue; }
    if (file.size > CHAT_MAX_BYTES) { toast(`${file.name} is over 8 MB.`); continue; }
    try {
      const got = kind === 'image' && mime !== 'image/gif' ? await shrinkImage(file) : { data: await readFile(file), mime };
      if (pendingBytes() + got.data.length > CHAT_SEND_BUDGET) { toast(kind === 'pdf' ? `${file.name} is too large to send. Try a PDF under 2.5 MB, or a screenshot of the plan.` : 'That’s more than one message can carry. Send fewer drawings.'); continue; }
      chatPending.push({ id: Math.random().toString(36).slice(2), name: file.name || (kind === 'pdf' ? 'drawing.pdf' : 'drawing'), kind, mime: got.mime, data: got.data });
    } catch { toast(`Couldn’t read ${file.name}.`); }
  }
  renderPending(); syncSend();
}

// The warnings the plan editor draws in red, worded for the agent.
function agentChecks() {
  const out = [];
  try {
    for (const S of BM.stairs || []) { const st = stairStatus(S); if (!st.ok) out.push(`Stair ${S.id} on the ${LV_NAME[S.level]}: ${st.msg.replace(/ or ↻ rotate (it|them)$/, '')}.`); }
    for (const r of BM.rooms) if (!lvOK(r.type, r.level)) out.push(`${r.name || r.type} #${r.id} is on the wrong floor for a ${r.type}.`);
  } catch { /* checks are a help, never a blocker */ }
  return out.slice(0, 8);
}
function agentPlan() {
  return {
    roof: BM.roof || 'hip',
    rooms: BM.rooms.map(r => ({ id: r.id, type: r.type, level: r.level, name: r.name || '', x: r.x, z: r.z, w: r.w, d: r.d, ...(r.shape && r.shape !== 'rect' ? { shape: r.shape } : {}) })),
    stairs: (BM.stairs || []).map(s => ({ id: s.id, level: s.level, cx: s.cx, cz: s.cz, W: s.W, L: s.L })),
    walls: BM.walls || {},
    levels: BM.levels || {},
    checks: agentChecks(),
    items: (BM.items || []).map(it => ({ id: it.id, kind: it.kind, name: (typeof CATALOG !== 'undefined' && CATALOG[it.kind]?.[0]) || it.kind, level: it.level, x: it.x, z: it.z })),
  };
}
// Undo: the house as it was before this message, pushed once when the first edit lands (so one ⌘Z undoes the whole reply).
let agentUndoSnap = null, agentViewed = false;
function agentShow() {
  if (typeof H3P !== 'undefined' && H3P) usePreset(false);
  if (curHouse !== 3) setHouse(3);
  if (agentUndoSnap) { PE.redo = []; PE.hist.push(agentUndoSnap); if (PE.hist.length > 80) PE.hist.shift(); agentUndoSnap = null; }
  resetBID(); planChanged(); // saves, redraws the plan, and rebuilds the 3D a moment after the edits stop arriving
  if (!agentViewed && mode !== 'walk' && !PE.open && HOUSES?.[3]?.views?.aerial) { agentViewed = true; goView('aerial'); } // one look from above per message, not a jump per edit
}
function agentSettle() { clearTimeout(peTimer); rebuildHouse3(); } // end of a pass: the 3D catches up at once
function agentApiMessages(extra) {
  const list = chatMsgs.filter(m => m.text || m.raw || m.files?.some(f => f.data)).slice(-10).map(m => ({
    role: m.role,
    text: m.role === 'assistant' ? (m.raw || m.text || '') : (m.text || ''),
    files: (m.files || []).filter(f => f.data).map(f => ({ name: f.name, mime: f.mime, data: f.data })),
  }));
  if (extra) list.push({ role: 'user', text: extra, files: [] });
  return list;
}
function agentNote(reply, res) {
  if (!reply.steps) reply.steps = [];
  if (res.kind === 'err') { reply.steps.push({ k: 'err', t: res.text }); if (!chatMsgs.includes(reply)) chatMsgs.push(reply); paintChat(); return; } // shown in the steps, and handed back to the model
  if (res.kind === 'ask') {
    reply.ask = { q: res.text, options: (res.options || []).slice(0, 6) };
    if (res.text) reply.steps.push({ k: 'say', t: res.text });
  } else if ((res.kind === 'done' || res.kind === 'more') && res.text) reply.steps.push({ k: 'say', t: res.text });
  else if (res.kind !== 'done' && res.kind !== 'more') reply.steps.push({ k: res.kind === 'act' ? 'act' : res.kind, t: res.text });
  reply.text = reply.steps.filter(s => s.k === 'say' || s.k === 'act' || s.k === 'note').map(s => s.t).join('\n');
  if (!chatMsgs.includes(reply)) chatMsgs.push(reply);
  paintChat();
}
// One pass: stream the model's lines, and apply each edit as it arrives.
let chatCtl = null; // aborts the request in flight (Stop, or New chat)
async function agentTurn(gen, reply, extra) {
  const r = await fetch('/api/agent', {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: chatCtl?.signal,
    body: JSON.stringify({ messages: agentApiMessages(extra), plan: agentPlan() }),
  });
  if (gen !== chatGen) return { stop: true };
  if (!r.ok || !r.body) {
    let msg = 'The agent could not reply.';
    try { msg = (await r.json()).error || msg; } catch { /* not JSON */ }
    agentNote(reply, { kind: 'note', text: msg });
    return { stop: true };
  }
  const pass = agentPass(BM, new Set(Object.keys(RT)));
  const show = async list => {
    for (const res of list) {
      if (gen !== chatGen) return;
      agentNote(reply, res);
      if (res.edit) { agentShow(); await new Promise(r => requestAnimationFrame(r)); }
    }
  };
  const reader = r.body.getReader(), dec = new TextDecoder();
  let pending = '';
  while (true) {
    const { done, value } = await reader.read();
    if (gen !== chatGen) { reader.cancel(); return { stop: true }; }
    if (done) break;
    pending += dec.decode(value, { stream: true });
    const lines = pending.split('\n'); pending = lines.pop() || '';
    for (const line of lines) { await show(pass.line(line)); if (pass.out.ended) break; }
    if (pass.out.ended) { reader.cancel().catch(() => {}); pending = ''; break; } // the rest of the reply is ignored
  }
  if (pending) await show(pass.line(pending));
  await show(pass.end());
  if (pass.out.edited) agentSettle();
  return pass.out;
}
async function sendChat(text, files) {
  syncChatDesign();
  const gen = ++chatGen;
  const pendingAsk = chatMsgs.at(-1);
  if (pendingAsk?.ask) delete pendingAsk.ask;
  if (!text && files.length) text = 'Build the house from this drawing.';
  chatMsgs.push({ role: 'user', text, files });
  chatBusy = true; agentUndoSnap = snapshot(); agentViewed = false; chatCtl = new AbortController(); saveChat(); renderChat(); syncSend();
  const reply = { role: 'assistant', text: '', raw: '', steps: [] };
  const fixing = agentWantsFix(text), problems = () => [...agentIssues(BM), ...agentChecks()], before = new Set(fixing ? [] : problems()); // asked to fix: every problem counts
  const startSnap = agentUndoSnap, startCount = agentBadness(BM);
  const build = agentWantsEdit(text, files);
  try {
    let extra = null, step = 0, finished = false, review = false, rechecked = false;
    while (step < AGENT_PASSES) {
      if (gen !== chatGen) return;
      step++;
      const turn = await agentTurn(gen, reply, extra && agentApplied(reply.steps) + extra);
      if (gen !== chatGen || turn.stop) return;
      reply.raw = [reply.raw, turn.raw].filter(Boolean).join('\n').slice(-8000);
      const next = agentNext(turn, { step, build, rechecked, acted: !!reply.steps?.some(s => s.k === 'act'), fresh: () => problems().filter(i => !before.has(i)) });
      if (next.finish) { finished = true; break; }
      if (next.stop) break;
      if (next.review) review = true;
      if (next.rechecked) rechecked = true;
      extra = next.extra;
    }
    if (agentRepairFailed(fixing, !!reply.steps?.some(s => s.k === 'act'), startCount, BM) && startSnap) { // the repair made things worse: put the house back
      BM = JSON.parse(startSnap); if (PE.hist.at(-1) === startSnap) PE.hist.pop();
      resetBID(); planChanged(); agentSettle();
      agentNote(reply, { kind: 'note', text: AGENT_REVERTED });
    }
    const left = reply.steps?.some(s => s.k === 'act') && !reply.ask ? problems().filter(i => !before.has(i)) : [];
    if (left.length) agentNote(reply, { kind: 'note', text: agentLeftNote(left) });
    const lastErr = reply.steps?.at(-1)?.k === 'err';
    if (!finished && step >= AGENT_PASSES && reply.steps?.some(s => s.k === 'act')) agentNote(reply, { kind: 'note', text: 'I paused here so you can look. Tell me what to change, or say continue.' });
    else if (!finished && lastErr) agentNote(reply, { kind: 'note', text: 'Some of that didn’t go through. Open the steps to see what, and tell me how to fix it.' });
    else if (!finished && review && !reply.ask && !reply.text) agentNote(reply, { kind: 'note', text: 'I need you to tell me which room or stair you mean.' });
    if (!reply.text && !reply.steps?.length) agentNote(reply, { kind: 'note', text: 'The agent returned an empty reply.' });
  } catch (e) {
    if (gen !== chatGen) return;
    if (!reply.text) agentNote(reply, { kind: 'note', text: 'Couldn’t reach the agent.' });
  } finally {
    if (gen === chatGen) { chatBusy = false; chatCtl = null; saveChat(); renderChat(); syncSend(); $u('agentInput').focus(); }
  }
}
// Stop: cancel the request; whatever was already built stays (one ⌘Z undoes it).
function stopChat() {
  if (!chatBusy) return;
  chatCtl?.abort(); chatGen++; chatBusy = false; chatCtl = null;
  const last = chatMsgs.at(-1);
  if (last?.role === 'assistant') agentNote(last, { kind: 'note', text: 'Stopped.' }); else chatMsgs.push({ role: 'assistant', text: 'Stopped.', steps: [{ k: 'note', t: 'Stopped.' }] });
  if (PE.hist.length || BM.rooms.length) agentSettle();
  saveChat(); renderChat(); syncSend();
}

// Drop a drawing on the open chat only. A counter keeps the highlight up while the pointer crosses child elements.
let chatDrag = 0;
const agentPanel = $u('agentPanel'), agentDrop = $u('agentDrop');
function chatFileDrag(e) { return [...(e.dataTransfer?.types || [])].includes('Files'); }
function chatOpen() { const side = $u('side'); return agentPanel && !agentPanel.hidden && side && !side.hidden; }
agentPanel.addEventListener('dragenter', e => {
  if (!chatFileDrag(e) || !chatOpen()) return;
  e.preventDefault(); chatDrag++; agentDrop.hidden = false;
});
agentPanel.addEventListener('dragover', e => {
  if (!chatFileDrag(e) || !chatOpen()) return;
  e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
agentPanel.addEventListener('dragleave', () => { if (--chatDrag <= 0) { chatDrag = 0; agentDrop.hidden = true; } });
agentPanel.addEventListener('drop', e => {
  if (!chatFileDrag(e) || !chatOpen()) return;
  e.preventDefault(); chatDrag = 0; agentDrop.hidden = true; addFiles(e.dataTransfer.files);
});
// Keep a file dropped outside the chat from navigating the page. It is not accepted.
document.addEventListener('dragover', e => { if (chatFileDrag(e)) e.preventDefault(); });
document.addEventListener('drop', e => { if (chatFileDrag(e)) e.preventDefault(); });
$u('agentPick').onclick = () => $u('agentFile').click();
$u('agentFile').onchange = e => { addFiles(e.target.files); e.target.value = ''; };

function newChat() {
  chatCtl?.abort(); chatCtl = null; chatGen++; chatMsgs = []; chatPending = []; chatBusy = false; saveChat();
  renderPending(); renderChat(); syncSend();
  const t = $u('agentInput'); t.value = ''; fitComposer(); t.focus();
}
// Drag the left edge to make the chat wider or narrower. The width is remembered.
let chatW = 0; try { chatW = +localStorage.getItem('walkthru-chatw') || 0; } catch (e) { }
function applyChatW() {
  const side = $u('side');
  if (!document.body.classList.contains('agent-open') || innerWidth <= 760) { side.style.width = ''; return; }
  const max = Math.max(360, innerWidth - 160);
  side.style.width = Math.max(320, Math.min(max, chatW || 400)) + 'px';
}
const chatResize = $u('chatResize');
chatResize.addEventListener('pointerdown', e => { chatResize.dataset.drag = '1'; try { chatResize.setPointerCapture(e.pointerId); } catch (er) { } e.preventDefault(); });
chatResize.addEventListener('pointermove', e => {
  if (!chatResize.dataset.drag) return;
  chatW = $u('side').getBoundingClientRect().right - e.clientX; applyChatW(); updateViewOffset();
});
chatResize.addEventListener('pointerup', () => { if (!chatResize.dataset.drag) return; delete chatResize.dataset.drag; try { localStorage.setItem('walkthru-chatw', String(chatW)); } catch (e) { } });
chatResize.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  chatW = $u('side').getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 40 : -40);
  applyChatW(); updateViewOffset(); try { localStorage.setItem('walkthru-chatw', String(chatW)); } catch (er) { }
});
new MutationObserver(applyChatW).observe(document.body, { attributes: true, attributeFilter: ['class'] });
addEventListener('resize', applyChatW);
PANEL_OPEN.agent = () => { applyChatW(); renderChat(); const t = $u('agentInput'); t.focus(); fitComposer(); };
const agentNew = $u('agentNew'); if (agentNew) agentNew.onclick = newChat;
$u('agentInput').addEventListener('input', () => { fitComposer(); syncSend(); });
$u('agentInput').addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePanel(); return; }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $u('agentForm').requestSubmit(); }
});
$u('agentForm').onsubmit = e => {
  e.preventDefault();
  if (chatBusy) return stopChat();
  const t = $u('agentInput'), text = t.value.trim();
  if (!text && !chatPending.length) return;
  const files = chatPending; chatPending = []; renderPending();
  t.value = ''; fitComposer(); sendChat(text, files);
};
renderChat();

// ---------- Plan check: what's wrong with this house, for everyone who can edit it (not just the agent) ----------
// The agent's layout checks plus the editor's own stair warnings, after every rebuild. Hidden when the plan is clean,
// on the sample houses, and for customers on a share link.
let planProblems = [];
function planCheck() {
  syncChatDesign(); // a rebuild follows every design switch, so the right conversation is up by then
  const btn = $u('planChkBtn'); if (!btn) return;
  planProblems = curHouse === 3 ? [...new Set([...agentIssues(BM, Infinity), ...agentChecks()])] : [];
  btn.hidden = !planProblems.length || document.body.classList.contains('cl-customer');
  $u('planChkN').textContent = planProblems.length;
  btn.dataset.tip = `${planProblems.length} problem${planProblems.length === 1 ? '' : 's'} in this plan`;
  $u('planChkList').innerHTML = planProblems.map(p => `<li>${escH(p)}</li>`).join('');
  $u('planChkFix').hidden = !document.body.classList.contains('agent-on');
}
$u('planChkFix').onclick = () => {
  closePops?.(); openPanel('agent');
  if (!chatBusy) sendChat('Fix the problems the plan check lists.', []);
};
