// POST /api/agent  { messages: [{ role, text, files?: [{ name, mime, data }] }] }
// files are data URLs: a PDF or an image. Streams the reply as plain text. The key stays on the server.
import { route, fail, body } from './_lib/http.js';
import { who } from './_lib/auth.js';
import { agentBrief } from './_lib/agentplan.js';

const MODEL = 'nvidia/nemotron-3.5-super-vl';
const SYSTEM = `You are the design agent inside Walkthru. You answer questions, and you change the house the person is looking at.

The house is rooms: axis-aligned rectangles in feet. x grows to the right, z grows from the front yard toward the back. Rooms on one floor must share edges exactly. They must not overlap and must not leave a gap. The design block lists every room, the neighbour on each side, and the furniture inside it. Read that before you change a size.

Floors: B basement, M main, U second. A stair is not a room. It is listed under stairs. Remove it with @@del and its id. If the user did not say which stair, @@ask and list each stair.

Room types: living, great, kitchen, dining, foyer, hall, bedroom, primary, bath, ensuite, powder, closet, walkin, pantry, office, laundry, mud, garage, rec, theatre, storage, porch, deck, balcony. Touching living, great, kitchen, dining, foyer, hall, or rec rooms join into one open space. A bedroom touching a hall, bath, or closet gets a door. Any other shared edge is a solid wall. Windows, the front door, and the garage door are added for you.

Reply in lines only. A line that starts with @@ is a command. Any other line is spoken to the user. Never use markdown or code fences.

Commands, one per line, JSON on that same line:
@@think what you are about to do, in one sentence
@@add {"type":"living","level":"M","name":"Living","x":0,"z":0,"w":16,"d":18}
@@set {"id":3,"w":20}
@@del {"id":3}
@@wall {"a":"Living","b":"Kitchen","mode":"open"}
@@stair {"level":"M","cx":8,"cz":20,"w":3.5,"l":13}
@@roof gable
@@clear
@@more what you will do next
@@done what you finished
@@ask {"q":"Which foyer?","options":["Foyer 33, main floor, 8×12, beside the playroom","Foyer 41, main floor, 6×8, at the front door"]}

@@wall mode is open, door, or wall, and only when the automatic wall is wrong. @@clear only when the user asked to start over or to build a new house from a drawing. A @@stair sits inside a hall or foyer: one on M reaches U, one on B reaches M.

@@set of x, z, w, or d keeps the rooms separate for you. The rooms beyond the edge you moved, and the furniture and stairs inside them, shift by the same amount. Do not @@set those neighbours yourself just to make space. Each room stays its own rectangle.

When a file is attached, look at it. If it is not a floor plan, elevation, or section, say so and @@done. Do not invent a house from it. If it is a drawing, build only the rooms you can actually see.

Work in passes, the way an engineer checks a drawing. When the job changes the house, do one floor or one small change, then @@more, so you can read the updated design and its issues before you continue. No more than 12 commands in a reply. When the request is finished, @@done. When the user only asked a question, answer in a sentence or two and @@done, with no @@add.

The back of the house is the rooms with the larger z. The front is the smaller z. An open space is every touching living, great, kitchen, dining, foyer, hall, or rec room in that part of the house. When the user says to remove or resize something, and the design block shows which rooms those are, change them in this reply: one @@del per room you remove, or @@set for a new size. Do that even when several rooms make up one open space. @@ask only when two listed rooms have the same name and the request does not say which. Give 2 to 4 options from the design list, and do not emit any command after @@ask. Never answer a remove or resize with only a question.

A failed command is handed back to you, not shown to the user. Read it against the design, then fix it or @@ask. Do not repeat the failure in your reply.

The design block on the latest user message is the house right now. Trust it over your memory. Never add a room that is already listed. Fix every issue before you add the next floor.`;
const FILE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);

// A data URL the model can see. Anything else is dropped before the request.
function filePart(f) {
  const m = String(f?.data || '').match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!m || !FILE_MIME.has(m[1]) || m[2].length > 12_000_000) return null;
  const url = `data:${m[1]};base64,${m[2].replace(/\s/g, '')}`;
  if (m[1] === 'application/pdf') return { type: 'file', file: { filename: String(f.name || 'drawing.pdf').slice(0, 120), file_data: url } };
  return { type: 'image_url', image_url: { url } };
}

const textOf = delta => {
  const c = delta?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(p => (typeof p === 'string' ? p : p?.text || '')).join('');
  return '';
};

export default route({
  async POST(req, res) {
    const w = await who(req); if (!w?.user && !w?.super) return fail(res, 401, 'Sign in to talk to the agent');
    const raw = body(req).messages;
    if (!Array.isArray(raw)) return fail(res, 400, 'Send a message');
    const picked = raw.slice(-12).flatMap(m => {
      const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'user' ? 'user' : null;
      return role ? [{ role, text: String(m?.text ?? '').trim().slice(0, role === 'assistant' ? 9000 : 4000), files: role === 'user' && Array.isArray(m.files) ? m.files : [] }] : [];
    });
    const partsOf = picked.map(() => []);
    let fileBudget = 4;
    for (let i = picked.length - 1; i >= 0 && fileBudget > 0; i--) for (const f of picked[i].files) {
      if (fileBudget <= 0) break;
      const part = filePart(f); if (!part) continue;
      partsOf[i].push(part); fileBudget--;
    }
    const plan = body(req).plan;
    let brief = '';
    if (plan && typeof plan === 'object' && !Array.isArray(plan)) {
      try { if (JSON.stringify(plan).length <= 40000) brief = agentBrief(plan); } catch { /* a bad plan is ignored */ }
    }
    let lastUser = -1;
    for (let i = picked.length - 1; i >= 0; i--) if (picked[i].role === 'user') { lastUser = i; break; }
    const messages = picked.flatMap((m, i) => {
      const parts = partsOf[i];
      let text = m.text;
      if (i === lastUser && brief) text = `Design right now:\n${brief}\n\n${text || 'Look at the attached drawing.'}`;
      if (!text && !parts.length) return [];
      return [{ role: m.role, content: parts.length ? [{ type: 'text', text: text || 'Look at this drawing.' }, ...parts] : text }];
    });
    if (!messages.length || messages[messages.length - 1].role !== 'user') return fail(res, 400, 'Send a message');
    const lastIn = picked[picked.length - 1];
    if (lastIn?.files.length && !partsOf[partsOf.length - 1].length) return fail(res, 400, 'Use a PDF, PNG, JPEG, WebP, or GIF.');
    let key = String(process.env.OPENROUTER_API_KEY || '').trim().replace(/^OPENROUTER_API_KEY=/i, '').replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');
    if (!key) return fail(res, 503, 'The agent is not configured');

    let upstream;
    try {
      upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'http-referer': 'https://walkthru.app', 'x-title': 'Walkthru' },
        body: JSON.stringify({ model: MODEL, stream: true, max_tokens: 1800, temperature: 0.3, reasoning: { enabled: false }, messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) { console.error('agent', e.name || e.message); return fail(res, 502, 'Could not reach the agent'); }
    if (!upstream.ok || !upstream.body) {
      let detail = '';
      try { const j = await upstream.json(); detail = j?.error?.message || (typeof j?.error === 'string' ? j.error : ''); } catch { /* empty body */ }
      console.error('agent', upstream.status, String(detail).slice(0, 200));
      const why = upstream.status === 429 ? 'The model is busy. Try again in a moment.'
        : upstream.status === 401 || upstream.status === 403 ? 'OpenRouter rejected the API key.'
        : (String(detail || '').trim().slice(0, 180) || 'The agent could not reply');
      return fail(res, 502, why);
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    let buf = '', wrote = false;
    try {
      const reader = upstream.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          const s = line.trim(); if (!s.startsWith('data:')) continue;
          const data = s.slice(5).trim(); if (!data || data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          if (j.error) { if (!wrote) res.write(j.error.message || 'The agent could not reply'); wrote = true; return; }
          const piece = textOf(j.choices?.[0]?.delta);
          if (piece) { res.write(piece); wrote = true; }
        }
      }
    } catch (e) { console.error('agent stream', e.name || e.message); if (!wrote) res.write('The reply was cut off.'); }
    finally { res.end(); }
  },
});
