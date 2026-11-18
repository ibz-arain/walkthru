// =====================================================================
//  AGENT — chat beside the plan. A question gets an answer. A request to
//  build or change the house comes back as commands, applied one at a time
//  so the 3D model updates while the agent checks its work and continues.
// =====================================================================
const CHAT_KEY = 'walkthru-agent';
const CHAT_MAX_FILES = 4, CHAT_MAX_BYTES = 8 * 1024 * 1024;
const CHAT_MIME = { 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image', 'application/pdf': 'pdf' };
let chatMsgs = [];
let chatPending = [];
let chatBusy = false;
let chatGen = 0;
try {
  const saved = JSON.parse(sessionStorage.getItem(CHAT_KEY) || '[]');
  if (Array.isArray(saved)) chatMsgs = saved.flatMap(m => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return [];
    const files = Array.isArray(m.files) ? m.files.flatMap(f => f && typeof f.name === 'string' ? [{ name: f.name.slice(0, 120), kind: f.kind === 'image' ? 'image' : 'pdf' }] : []) : [];
    const steps = Array.isArray(m.steps) ? m.steps.flatMap(s => s && typeof s.t === 'string' && ['think', 'act', 'say', 'err'].includes(s.k) ? [{ k: s.k, t: s.t.slice(0, 600) }] : []).slice(0, 80) : [];
    const options = Array.isArray(m.ask?.options) ? m.ask.options.flatMap(o => o && typeof o.label === 'string' ? [{ id: String(o.id || o.label).slice(0, 80), label: o.label.slice(0, 160) }] : []).slice(0, 6) : [];
    return [{ role: m.role, text: m.text, files, ...(steps.length ? { steps } : {}), ...(options.length ? { ask: { q: String(m.ask.q || '').slice(0, 300), options } } : {}) }];
  });
} catch (e) { }

const chatEsc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function saveChat() {
  try {
    const slim = chatMsgs.map(m => ({ role: m.role, text: m.text, files: (m.files || []).map(f => ({ name: f.name, kind: f.kind })), steps: (m.steps || []).map(s => ({ k: s.k, t: s.t })), ...(m.ask?.options?.length ? { ask: m.ask } : {}) }));
    sessionStorage.setItem(CHAT_KEY, JSON.stringify(slim));
  } catch (e) { }
}

function fileBits(files) {
  return (files || []).map(f => {
    if (f.kind === 'image' && f.data) return `<img class="chat-shot" alt="" src="${f.data}">`;
    const icon = f.kind === 'pdf' ? 'i-pdf' : 'i-clip';
    return `<span class="chat-file"><svg class="ic"><use href="#${icon}"/></svg><b>${chatEsc(f.name)}</b></span>`;
  }).join('');
}
const STEP_VERB = /^(Added|Updated|Removed|Opened|Closed|Cleared|Set|Put)\b/;
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
  const caret = '<i class="chat-caret" aria-hidden="true"></i>';
  log.innerHTML = chatMsgs.map((m, i) => {
    const bits = m.files?.length ? `<span class="chat-files">${fileBits(m.files)}</span>` : '';
    const writing = chatBusy && i === chatMsgs.length - 1 && m.role === 'assistant';
    let body = '';
    if (m.steps?.length) {
      const parts = []; let work = [];
      const flush = open => {
        if (!work.length) return;
        const n = work.length, label = n === 1 ? '1 step' : `${n} steps`;
        parts.push(`<details class="chat-work"${open ? ' open' : ''}><summary>${label}</summary><div class="chat-work-b">${work.join('')}</div></details>`);
        work = [];
      };
      m.steps.forEach((s, n) => {
        const mark = writing && n === m.steps.length - 1 ? caret : '';
        if (s.k === 'say') { flush(false); parts.push(stepHtml(s, mark)); }
        else work.push(stepHtml(s, mark));
      });
      flush(writing);
      body = parts.join('');
    } else if (m.text || writing) body = `<span class="chat-text">${chatEsc(m.text)}${writing ? caret : ''}</span>`;
    const choices = !writing && m.ask?.options?.length && i === chatMsgs.length - 1
      ? `<div class="chat-ask" role="group" aria-label="${chatEsc(m.ask.q || 'Choose')}">${m.ask.options.map((o, n) => `<button type="button" class="chat-opt" data-opt="${n}">${chatEsc(o.label)}</button>`).join('')}</div>`
      : '';
    return `<div class="chat-row ${m.role}"><div class="chat-bubble">${bits}${body}${choices}</div></div>`;
  }).join('') + (chatBusy && chatMsgs[chatMsgs.length - 1]?.role !== 'assistant' ? `<div class="chat-row assistant"><div class="chat-bubble chat-wait" aria-label="Agent is working">${caret}</div></div>` : '');
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
function syncSend() { $u('agentSend').disabled = chatBusy || (!$u('agentInput').value.trim() && !chatPending.length); }

let chatDraw = 0;
function paintChat() { cancelAnimationFrame(chatDraw); chatDraw = requestAnimationFrame(() => { chatDraw = 0; renderChat(); }); }

function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
async function addFiles(list) {
  const files = [...list || []];
  for (const file of files) {
    if (chatPending.length >= CHAT_MAX_FILES) { toast('You can attach up to 4 drawings.'); break; }
    const mime = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
    const kind = CHAT_MIME[mime];
    if (!kind) { toast('Use a PDF, PNG, JPEG, WebP, or GIF.'); continue; }
    if (file.size > CHAT_MAX_BYTES) { toast(`${file.name} is over 8 MB.`); continue; }
    try {
      const data = await readFile(file);
      chatPending.push({ id: Math.random().toString(36).slice(2), name: file.name || (kind === 'pdf' ? 'drawing.pdf' : 'drawing'), kind, mime, data });
    } catch { toast(`Couldn’t read ${file.name}.`); }
  }
  renderPending(); syncSend();
}

function agentPlan() {
  return {
    roof: BM.roof || 'hip',
    rooms: BM.rooms.map(r => ({ id: r.id, type: r.type, level: r.level, name: r.name || '', x: r.x, z: r.z, w: r.w, d: r.d })),
    stairs: (BM.stairs || []).map(s => ({ id: s.id, level: s.level, cx: s.cx, cz: s.cz, W: s.W, L: s.L })),
    walls: BM.walls || {},
    levels: BM.levels || {},
    items: (BM.items || []).map(it => ({ id: it.id, kind: it.kind, name: (typeof CATALOG !== 'undefined' && CATALOG[it.kind]?.[0]) || it.kind, level: it.level, x: it.x, z: it.z })),
  };
}
let agentUndo = false;
function agentShow() {
  if (typeof H3P !== 'undefined' && H3P) usePreset(false);
  if (curHouse !== 3) setHouse(3);
  if (!agentUndo) { pushHist(); agentUndo = true; }
  resetBID(); planChanged(); clearTimeout(peTimer); rebuildHouse3();
  if (HOUSES?.[3]?.views?.aerial) goView('aerial', true);
}
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
  if (res.kind === 'err') return;
  if (res.kind === 'ask') {
    reply.ask = { q: res.text, options: (res.options || []).slice(0, 6) };
    if (res.text) reply.steps.push({ k: 'say', t: res.text });
  } else if ((res.kind === 'done' || res.kind === 'more') && res.text) reply.steps.push({ k: 'say', t: res.text });
  else if (res.kind !== 'done' && res.kind !== 'more') reply.steps.push({ k: res.kind === 'act' ? 'act' : res.kind, t: res.text });
  reply.text = reply.steps.filter(s => s.k === 'say' || s.k === 'act').map(s => s.t).join('\n');
  if (!chatMsgs.includes(reply)) chatMsgs.push(reply);
  paintChat();
}
// One pass: stream the model's lines, and apply each edit as it arrives.
async function agentTurn(gen, reply, extra) {
  const r = await fetch('/api/agent', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: agentApiMessages(extra), plan: agentPlan() }),
  });
  if (gen !== chatGen) return { stop: true };
  if (!r.ok || !r.body) {
    let msg = 'The agent could not reply.';
    try { msg = (await r.json()).error || msg; } catch { /* not JSON */ }
    agentNote(reply, { kind: 'say', text: msg });
    return { stop: true };
  }
  const buf = { plan: BM, types: new Set(Object.keys(RT)), hold: '' };
  const reader = r.body.getReader(), dec = new TextDecoder();
  let raw = '', pending = '';
  const out = { done: false, more: false, edited: false, errors: [], raw: '' };
  const take = async list => {
    for (const res of list) {
      if (gen !== chatGen || out.ask) return;
      agentNote(reply, res);
      if (res.kind === 'ask') { out.ask = true; out.done = true; }
      if (res.kind === 'done') out.done = true;
      if (res.kind === 'more') out.more = true;
      if (res.kind === 'err') out.errors.push(res.text);
      if (res.edit) { out.edited = true; agentShow(); await new Promise(r => requestAnimationFrame(r)); }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (gen !== chatGen) { reader.cancel(); return { stop: true }; }
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    if (!chunk) continue;
    raw += chunk; pending += chunk;
    const lines = pending.split('\n'); pending = lines.pop() || '';
    for (const line of lines) await take(feedAgentLine(buf, line));
  }
  if (pending) await take(feedAgentLine(buf, pending));
  await take(flushAgentLine(buf));
  out.raw = raw;
  return out;
}
async function sendChat(text, files) {
  const gen = ++chatGen;
  const pendingAsk = chatMsgs.at(-1);
  if (pendingAsk?.ask) delete pendingAsk.ask;
  if (!text && files.length) text = 'Build the house from this drawing.';
  chatMsgs.push({ role: 'user', text, files });
  chatBusy = true; agentUndo = false; saveChat(); renderChat(); syncSend();
  const reply = { role: 'assistant', text: '', raw: '', steps: [] };
  const build = files.length || /\b(build|add|design|draw|make|create|widen|narrow|remove|delete|move|resize|change|replace|start over|floor plan)\b/i.test(text);
  try {
    let extra = null, step = 0, finished = false, review = false;
    while (step < 5) {
      if (gen !== chatGen) return;
      step++;
      const turn = await agentTurn(gen, reply, extra);
      if (gen !== chatGen || turn.stop) return;
      reply.raw = [reply.raw, turn.raw].filter(Boolean).join('\n').slice(-8000);
      if (turn.ask) { finished = true; break; }
      if (turn.errors.length) {
        review = true;
        extra = `A command failed. The user does not see this note:\n${turn.errors.map(e => '- ' + e).join('\n')}\nRead the design block and do the edit. Remove a room or stair with @@del and its id. If two rooms have the same name, @@ask with those choices and stop. Otherwise fix it. Do not repeat the failed command, and do not quote this failure to the user.`;
        continue;
      }
      if (turn.done) { finished = true; break; }
      if (!turn.edited && !turn.more) {
        if (!build || step > 1) break;
        extra = 'That reply did not change the house. This is a remove or edit. Use the design block: the back is the larger z. Remove each matching room with @@del and its id, or resize with @@set, then @@done. Do not answer with only a question.';
        continue;
      }
      if (!turn.edited) break;
      extra = 'Continue the same request. The design block is the house as it stands now. Do not add a room that is already listed. If the request is already done, @@done with no new rooms.';
    }
    if (!finished && step >= 5 && reply.steps?.some(s => s.k === 'act')) agentNote(reply, { kind: 'say', text: 'I paused here so you can look. Tell me what to change, or say continue.' });
    else if (!finished && review && !reply.ask && !reply.text) agentNote(reply, { kind: 'say', text: 'I need you to tell me which room or stair you mean.' });
    if (!reply.text && !reply.steps?.length) agentNote(reply, { kind: 'say', text: 'The agent returned an empty reply.' });
  } catch (e) {
    if (gen !== chatGen) return;
    if (!reply.text) agentNote(reply, { kind: 'say', text: 'Couldn’t reach the agent.' });
  } finally {
    if (gen === chatGen) { chatBusy = false; saveChat(); renderChat(); syncSend(); $u('agentInput').focus(); }
  }
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
  chatGen++; chatMsgs = []; chatPending = []; chatBusy = false; saveChat();
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
  const t = $u('agentInput'), text = t.value.trim();
  if (chatBusy || (!text && !chatPending.length)) return;
  const files = chatPending; chatPending = []; renderPending();
  t.value = ''; fitComposer(); sendChat(text, files);
};
renderChat();
