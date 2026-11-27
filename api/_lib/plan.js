// Every saved design passes through here: it must be a floor plan of a sane size, and the names people type into it
// (rooms, floors) lose < and > so no saved design can carry markup into someone else's page.
export const PLAN_MAX = 2_000_000; // characters of JSON
const clean = v => typeof v === 'string' ? v.replace(/[<>]/g, '').slice(0, 80) : v;
export function planProblem(bm) {
  if (!bm || typeof bm !== 'object' || !Array.isArray(bm.rooms)) return 'That is not a floor plan';
  if (JSON.stringify(bm).length > PLAN_MAX) return 'This design is too large to save';
  return null;
}
export function cleanPlan(bm) {
  for (const r of bm.rooms) if (r && typeof r === 'object' && r.name != null) r.name = clean(r.name);
  const L = bm.levels;
  if (L && typeof L === 'object') {
    if (L.names && typeof L.names === 'object') for (const k of Object.keys(L.names)) L.names[k] = clean(L.names[k]);
    if (Array.isArray(L.extra)) for (const e of L.extra) if (e && typeof e === 'object' && e.name != null) e.name = clean(e.name);
  }
  return bm;
}
