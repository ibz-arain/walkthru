// POST /api/agent  { messages: [{ role, text, files?: [{ name, mime, data }] }] }
// files are data URLs: a PDF or an image. Streams the reply as plain text. The key stays on the server.
import { route, fail, body } from './_lib/http.js';
import { who } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { agentBrief } from './_lib/agentplan.js';
import { agentProvider, cleanKey } from './_lib/ai.js';

const SYSTEM = `You are the design agent inside Walkthru. You answer questions about the house the person is looking at, and you change it.

THE HOUSE
Rooms are rectangles in feet. x grows to the right. z grows from the front yard toward the back, so the front is the smaller z. Floors: B basement, M main, U second. On one floor, rooms share edges exactly: no overlaps, no gaps.
Room types: living, great, kitchen, dining, foyer, hall, bedroom, primary, bath, ensuite, powder, closet, walkin, pantry, office, laundry, mud, garage, rec, theatre, storage, porch, deck, balcony. Porch and deck go on M, balcony on U.
Touching living, great, kitchen, dining, foyer, hall, and rec rooms join into one open space. A bedroom touching a hall, bath, or closet gets a door. Any other shared edge is a solid wall. Windows, the front door, and the garage door are added for you.
A stair is not a room. It sits inside a hall or foyer. One on M reaches U; one on B reaches M.

THE DESIGN BLOCK
The latest user message ends with the design block: every room with its id, position, size, neighbours and furniture, every stair, and the issues. It is the house right now. Trust it over your memory and over your earlier replies. A room in it already exists: never add it again.

REPLY FORMAT
Reply in lines only, never markdown or code fences. A line that starts with @@ is a command, with its JSON on that same line. Any other line is spoken to the user, so keep those few and short.
Commands (the JSON fields are listed; write your own values):
- @@think, then one sentence on what you are about to do.
- @@add, then JSON with type, level, name, x, z, w, d. Example: @@add {"type":"living","level":"M","name":"Living","x":0,"z":0,"w":16,"d":18}
- @@set, then JSON with id and the fields that change (x, z, w, d, type, name). For a stair id: cx, cz, w, l.
- @@del, then JSON with id.
- @@wall, then JSON with a and b (room names or ids) and mode.
- @@stair, then JSON with level, cx, cz (its centre), w, and l.
- @@roof, then hip, gable, shed, or flat.
- @@clear, alone.
- @@more, then a short note of what the next pass will do.
- @@done, then one sentence on what you finished.
- @@ask, then JSON with q and 2 to 4 options, each naming a room from the design block.
@@more, @@done, or @@ask is the last line of every reply. Nothing after it is read.

HOW COMMANDS BEHAVE
@@set of x or z moves only that room: place it where it fits, then read the issues. @@set of w or d keeps the plan together for you. Growing a room pushes the rooms beyond that edge out; shrinking it pulls them in. Their furniture and stairs go with them, and rooms above and below shift or stretch so the floors stay lined up. Never @@set neighbours just to make space. A room listed with a triangle, round, or drawn outline keeps that shape inside its box.
@@add refuses a room that sits on a listed one or repeats a name on its floor. Change the listed room with @@set instead.
@@wall only when the automatic wall is wrong. Its mode is open, door, or wall.
@@clear only when the user asked to start over or to build a new house from a drawing.
A failed command comes back to you in a note the user does not see. Fix it, or @@ask. Do not mention the failure.

SMALL CHANGES AND QUESTIONS
A question: answer in a sentence or two, then @@done, with no commands.
An edit (resize, remove, move, rename, open a wall): do it in this reply with @@set, @@del, or @@wall, then @@done. When the user says to remove or resize something and the design block shows which rooms those are, change them now, even if several rooms make one open space. @@ask only when two listed rooms share the name the user gave. Offer 2 to 4 options from the design block, and send no command after @@ask.
Each size the user asks for is applied once. "4 feet narrower" means one @@set to the listed width minus 4.

A NEW HOUSE
Work in passes, one floor per reply, ending with @@more. A reply is cut off after 14 changes, so keep each pass to one floor:
1. Main floor. Pick a compact footprint first, about 36 to 56 ft wide and 28 to 44 ft deep, and fill it in two or three rows: living and dining at the front, kitchen behind them, foyer at the front door, a hall linking the rest. A garage sits at one side, 20 to 24 ft square.
2. Second floor, when the user asked for two storeys. Bedrooms, baths, and closets go here, every room over the main floor footprint. Put the upper hall over the main stair.
3. Basement, when asked: rec, storage, a bedroom and bath, under the main footprint.
4. Stairs (@@stair on M inside the hall or foyer, and on B under it), the roof, then @@done.
A one-storey house keeps its bedrooms on M, in a back row or wing.
Typical sizes in feet: bedroom 11×12 to 13×14, primary 14×16, bath 8×10, ensuite 8×12, closet 4×6, walkin 6×8, powder 5×6, hall 4 to 6 wide, foyer 8×10, kitchen 12×14, living 16×18.
When a drawing is attached, look at it. If it is not a floor plan, elevation, or section, say so and @@done. Otherwise build only the rooms you can see, at the sizes it shows.

ISSUES
Every issue in the design block is yours to fix before the next floor and before @@done: overlaps, gaps, rooms touching nothing, upper rooms hanging past the main floor, floors stretched into one long strip, missing stairs.`;
// Each pass of a reply is one request. A message usually takes 1 to 3 passes, so this is about 50 to 100 messages a day.
const DAILY_LIMIT = () => Math.max(1, +process.env.AGENT_DAILY_LIMIT || 200);
const busyUntil = new Map(), BUSY_FOR = 120_000, QUOTA_FOR = 600_000; // a model that was overloaded is skipped for a while (per warm server instance)
const START_LIMIT = 15_000; // how long one attempt may take to start answering before the next is tried
const TIME_LIMIT = 52_000; // Vercel stops the function at 60 s (vercel.json maxDuration): finish the reply well before that
// Count one request for this person today; false when they are over the limit.
async function spend(w) {
  const c = await db(), key = w.user?.id || 'studio-key', day = new Date().toISOString().slice(0, 10);
  await c.execute({ sql: 'INSERT INTO agent_use (who, day, n) VALUES (?, ?, 1) ON CONFLICT (who, day) DO UPDATE SET n = n + 1', args: [key, day] });
  const n = (await c.execute({ sql: 'SELECT n FROM agent_use WHERE who = ? AND day = ?', args: [key, day] })).rows[0]?.n || 0;
  return n <= DAILY_LIMIT();
}
const FILE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);

// A data URL the model can see. Anything else is dropped before the request.
function filePart(f, google) {
  const m = String(f?.data || '').match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!m || !FILE_MIME.has(m[1]) || m[2].length > 12_000_000) return null;
  const url = `data:${m[1]};base64,${m[2].replace(/\s/g, '')}`;
  if (m[1] === 'application/pdf' && !google) return { type: 'file', file: { filename: String(f.name || 'drawing.pdf').slice(0, 120), file_data: url } };
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
      const part = filePart(f, !!cleanKey('GEMINI_API_KEY')); if (!part) continue;
      partsOf[i].push(part); fileBudget--;
    }
    const plan = body(req).plan;
    let brief = '';
    if (plan && typeof plan === 'object' && !Array.isArray(plan)) {
      try { if (JSON.stringify(plan).length <= 40000) brief = agentBrief(plan, plan.checks); } catch { /* a bad plan is ignored */ }
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
    const ai = agentProvider();
    if (!ai) return fail(res, 503, 'The agent is not configured');
    if (!(await spend(w))) return fail(res, 429, 'You’ve used the design agent a lot today. It will be ready again tomorrow.');

    // A busy model (503, or 429 that is not the daily quota) gets one retry, then the backup model if there is one.
    const started = Date.now(), signal = AbortSignal.timeout(TIME_LIMIT); // covers every attempt and reading the stream below
    const backup = ai.backup && ai.backup !== ai.model ? [ai.backup] : [];
    const tries = backup.length && busyUntil.get(ai.model) > Date.now() ? backup : [ai.model, ai.model, ...backup]; // recently overloaded: go straight to the backup
    let upstream, model;
    for (let i = 0; i < tries.length; i++) {
      model = tries[i];
      const ctl = new AbortController(), stop = () => ctl.abort(signal.reason);
      signal.addEventListener('abort', stop, { once: true });
      const slow = setTimeout(() => ctl.abort(new Error('slow start')), START_LIMIT); // a hung attempt gives way to the next one
      try {
        upstream = await fetch(ai.url, {
          method: 'POST', signal: ctl.signal,
          headers: { authorization: `Bearer ${ai.key}`, 'content-type': 'application/json', 'http-referer': 'https://walkthru.app', 'x-title': 'Walkthru' },
          body: JSON.stringify({ model, stream: true, temperature: 0.3, ...ai.options, messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
        });
      } catch (e) {
        clearTimeout(slow); upstream = null;
        const slowStart = ctl.signal.reason?.message === 'slow start';
        if (slowStart) busyUntil.set(model, Date.now() + BUSY_FOR);
        console.error('agent', ai.name, model, slowStart ? 'did not start in time' : e.name || e.message);
        if (slowStart && i < tries.length - 1 && !signal.aborted) continue;
        return fail(res, 504, slowStart ? 'The model is busy right now. Try again in a moment.' : 'Could not reach the agent');
      }
      clearTimeout(slow);
      if (upstream.ok || ![429, 500, 503].includes(upstream.status) || i === tries.length - 1 || Date.now() - started > TIME_LIMIT / 2) break;
      const peek = await upstream.clone().text().catch(() => '');
      if (/quota|per day|exhausted/i.test(peek)) { // out of allowance: waiting will not help, but another model has its own quota
        const other = tries.findIndex((m, k) => k > i && m !== model);
        if (other < 0) break;
        busyUntil.set(model, Date.now() + QUOTA_FOR);
        console.error('agent', ai.name, upstream.status, model, 'out of quota, trying', tries[other]);
        i = other - 1; continue;
      }
      busyUntil.set(model, Date.now() + BUSY_FOR);
      console.error('agent', ai.name, upstream.status, model, 'busy, trying again');
      if (tries[i + 1] === model) await new Promise(r => setTimeout(r, 1200));
    }
    if (!upstream.ok || !upstream.body) {
      let detail = '';
      try { let j = await upstream.json(); if (Array.isArray(j)) j = j[0]; detail = j?.error?.message || (typeof j?.error === 'string' ? j.error : ''); } catch { /* empty body */ } // Google can wrap its error in a list
      console.error('agent', ai.name, upstream.status, String(detail).slice(0, 200));
      const why = upstream.status === 429 || upstream.status === 503 ? (/quota|per day|exhausted/i.test(detail) ? 'The agent has used its free allowance for now. Try again later.' : 'The model is busy right now. Try again in a moment.')
        : upstream.status === 401 || upstream.status === 403 || /api key/i.test(detail) ? `${ai.name} rejected the API key.`
        : upstream.status === 404 ? `${ai.name} has no model called ${model}. Check AGENT_MODEL.`
        : (String(detail || '').trim().slice(0, 180) || 'The agent could not reply');
      return fail(res, 502, why);
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-agent-model', model); // which model answered: the main one or the backup
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
          if (Array.isArray(j)) j = j[0];
          if (j?.error) { if (!wrote) res.write(j.error.message || 'The agent could not reply'); wrote = true; return; }
          const piece = textOf(j.choices?.[0]?.delta);
          if (piece) { res.write(piece); wrote = true; }
        }
      }
    } catch (e) { // out of time (or the model hung up): tell the client to carry on in a new pass rather than stop half way
      console.error('agent stream', e.name || e.message);
      res.write(wrote ? '\n@@more\n' : 'The agent took too long to answer. Try again.'); // a bare @@more: the chat runs another pass from the house as it stands
    }
    finally { res.end(); }
  },
});
