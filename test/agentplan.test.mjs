import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAgentLine, agentIssues, agentBrief, feedAgentLine, agentRepairFailed, agentWantsFix, agentBadness, agentFixStairs, agentPass } from '../src/agentplan.js';

test('agent commands build a floor, then a bad command is refused', () => {
  const plan = { roof: 'hip', rooms: [], stairs: [], walls: {} };
  const added = applyAgentLine(plan, '@@add {"type":"living","level":"M","name":"Living","x":0,"z":0,"w":16,"d":18}');
  assert.equal(added.edit, true);
  applyAgentLine(plan, '@@add {"type":"kitchen","level":"M","name":"Kitchen","x":16,"z":0,"w":14,"d":14}');
  assert.equal(agentIssues(plan).length, 0, 'rooms that share an edge are a clean plan');

  applyAgentLine(plan, '@@add {"type":"dining","level":"M","name":"Dining","x":10,"z":4,"w":12,"d":12}');
  assert.ok(agentIssues(plan).some(i => /overlaps/.test(i)));

  assert.equal(applyAgentLine(plan, '@@set {"name":"Living","w":18}').edit, true);
  assert.equal(plan.rooms[0].w, 18);
  applyAgentLine(plan, '@@wall {"a":"Living","b":"Kitchen","mode":"door"}');
  assert.equal(plan.walls['1-2'], 'door');
  applyAgentLine(plan, '@@stair {"level":"M","cx":8,"cz":10,"w":3.5,"l":12}');
  assert.equal(plan.stairs[0].level, 'M');

  assert.equal(applyAgentLine(plan, '@@add {"type":"lounge","level":"M","x":0,"z":0,"w":10,"d":10}').kind, 'err');
  assert.equal(applyAgentLine(plan, '@@add {"type":"balcony","level":"M","x":0,"z":40,"w":12,"d":6}').kind, 'err');
  assert.equal(plan.rooms.some(r => r.type === 'lounge' || r.type === 'balcony'), false);

  applyAgentLine(plan, '@@del Dining');
  assert.equal(plan.rooms.some(r => r.name === 'Dining'), false);
  assert.match(agentBrief(plan), /Kitchen/);
  assert.equal(applyAgentLine(plan, 'The kitchen is on the main floor.').kind, 'say');
  assert.equal(applyAgentLine(plan, '@@think, placing the kitchen').kind, 'think', 'punctuation after a command name is ignored');
  assert.equal(applyAgentLine(plan, '{"id":8}').kind, 'err', 'bare JSON is a broken command, not speech');

  const buf = { plan, hold: '' };
  assert.equal(feedAgentLine(buf, '@@add {"type":"hall","level":"M","name":"Hall","x":0,').length, 0);
  const rest = feedAgentLine(buf, '"z":20,"w":6,"d":10}');
  assert.equal(rest[0].edit, true);
  assert.ok(plan.rooms.some(r => r.name === 'Hall'));

  applyAgentLine(plan, '@@clear');
  assert.equal(plan.rooms.length, 0);
  assert.equal(plan.stairs.length, 0);
});

test('widening a room shifts the neighbours and their furniture', () => {
  const plan = {
    rooms: [
      { id: 1, type: 'foyer', level: 'M', name: 'Foyer', x: 0, z: 0, w: 8, d: 12 },
      { id: 2, type: 'dining', level: 'M', name: 'Dining', x: 8, z: 0, w: 14, d: 12 },
      { id: 3, type: 'kitchen', level: 'M', name: 'Kitchen', x: 22, z: 0, w: 12, d: 12 },
      { id: 4, type: 'bath', level: 'M', name: 'Bath', x: 0, z: 12, w: 8, d: 8 },
    ],
    stairs: [{ id: 5, level: 'M', cx: 15, cz: 6, W: 3.5, L: 10 }],
    items: [{ id: 9, kind: 'dining6', name: 'Dining table', level: 'M', x: 15, z: 6 }],
  };
  const res = applyAgentLine(plan, '@@set {"id":1,"w":20}');
  assert.equal(plan.rooms[0].w, 20);
  assert.equal(plan.rooms[0].x, 0);
  assert.equal(plan.rooms.find(r => r.id === 2).x, 20, 'dining slides east with the foyer edge');
  assert.equal(plan.rooms.find(r => r.id === 3).x, 34, 'the kitchen beyond dining slides too');
  assert.equal(plan.rooms.find(r => r.id === 4).x, 0, 'the bath on the south edge stays put');
  assert.equal(plan.items[0].x, 27);
  assert.equal(plan.stairs[0].cx, 27);
  assert.match(res.text, /Dining/);
  assert.match(res.text, /Kitchen/);
  assert.equal(agentIssues(plan).some(i => /overlaps/.test(i)), false);
  const brief = agentBrief(plan);
  assert.match(brief, /left: Dining #2/, 'east is the left as seen from the street');
  assert.match(brief, /Dining table/);
});

test('deleting a stair id removes the stair, and two stairs become a question', () => {
  const plan = { rooms: [], stairs: [
    { id: 48, level: 'M', cx: 10, cz: 20, W: 3.5, L: 12 },
    { id: 49, level: 'B', cx: 4, cz: 8, W: 3.5, L: 10 },
  ] };
  const one = { rooms: [{ id: 1, type: 'hall', level: 'M', name: 'Hall', x: 0, z: 0, w: 8, d: 16 }], stairs: [{ id: 48, level: 'M', cx: 4, cz: 8, W: 3.5, L: 12 }] };
  const gone = applyAgentLine(one, '@@del {"id":48}');
  assert.equal(gone.kind, 'act');
  assert.equal(one.stairs.length, 0);
  assert.equal(one.rooms.length, 1);
  const asked = applyAgentLine(plan, '@@del staircase');
  assert.equal(asked.kind, 'ask');
  assert.deepEqual(asked.options.map(o => o.id), ['48', '49']);
  assert.equal(plan.stairs.length, 2);
});

test('an ambiguous room becomes a multiple choice question', () => {
  const plan = { rooms: [
    { id: 33, type: 'foyer', level: 'M', name: 'Foyer', x: 0, z: 0, w: 8, d: 12 },
    { id: 41, type: 'foyer', level: 'M', name: 'Foyer', x: 20, z: 0, w: 6, d: 8 },
    { id: 35, type: 'playroom', level: 'M', name: 'Playroom', x: 8, z: 0, w: 12, d: 12 },
  ] };
  const res = applyAgentLine(plan, '@@wall {"a":"foyer","b":"Playroom","mode":"wall"}');
  assert.equal(res.kind, 'ask');
  assert.match(res.text, /Which foyer/i);
  assert.deepEqual(res.options.map(o => o.id), ['33', '41']);
  assert.equal(plan.walls, undefined);
  const asked = applyAgentLine(plan, '@@ask {"q":"Grow the foyer which way?","options":["Toward the playroom","Toward the front yard"]}');
  assert.equal(asked.kind, 'ask');
  assert.equal(asked.options.length, 2);
  assert.equal(asked.options[0].label, 'Toward the playroom');
});

test('agent notices a gap and a missing stair', () => {
  const gap = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 10, d: 10 },
    { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 12, z: 0, w: 10, d: 10 },
  ], stairs: [] };
  assert.ok(agentIssues(gap).some(i => /gap/.test(i)));
  const up = { rooms: [{ id: 1, type: 'bedroom', level: 'U', name: 'Bedroom', x: 0, z: 0, w: 12, d: 12 }], stairs: [] };
  assert.ok(agentIssues(up).some(i => /stair/.test(i)));
  up.stairs.push({ id: 2, level: 'M', cx: 6, cz: 6, W: 3.5, L: 12 });
  assert.equal(agentIssues(up).some(i => /stair/.test(i)), false);
});

test('deleting or clearing rooms drops their walls, openings, rails and furniture', () => {
  const plan = { roof: 'hip', rooms: [], stairs: [], walls: {}, ext: {}, ops: {}, rails: {}, items: [] };
  applyAgentLine(plan, '@@add {"type":"living","level":"M","name":"Living","x":0,"z":0,"w":16,"d":18}');
  applyAgentLine(plan, '@@add {"type":"kitchen","level":"M","name":"Kitchen","x":16,"z":0,"w":14,"d":14}');
  const [a, b] = plan.rooms.map(r => r.id);
  plan.walls[`${a}-${b}`] = 'door'; plan.ext[`${b}:out`] = 'x'; plan.ops[`${a}-${b}`] = ['o']; plan.rails[`${b}:out:3`] = 1; plan.rails[`${a}:*`] = 1;
  plan.items.push({ x: 20, z: 5, level: 'M' }, { x: 5, z: 5, level: 'M' });
  applyAgentLine(plan, '@@del Kitchen');
  assert.deepEqual(plan.walls, {}); assert.deepEqual(plan.ext, {}); assert.deepEqual(plan.ops, {});
  assert.deepEqual(Object.keys(plan.rails), [`${a}:*`], 'the living room keeps its own rail');
  assert.equal(plan.items.length, 1, 'furniture in the kitchen goes with it');
  applyAgentLine(plan, '@@clear');
  assert.equal(plan.rooms.length, 0); assert.deepEqual(plan.rails, {}); assert.equal(plan.items.length, 0);
});

test('adding a room on top of a listed one, or with its name, is refused', () => {
  const plan = { rooms: [{ id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 16, d: 18 }], stairs: [] };
  const same = applyAgentLine(plan, '@@add {"type":"great","level":"M","name":"Great Room","x":1,"z":1,"w":15,"d":16}');
  assert.equal(same.kind, 'err'); assert.match(same.text, /#1/);
  assert.equal(applyAgentLine(plan, '@@add {"type":"living","level":"M","name":"living","x":30,"z":0,"w":12,"d":12}').kind, 'err');
  assert.equal(applyAgentLine(plan, '@@add {"type":"living","level":"U","name":"Living","x":0,"z":0,"w":16,"d":18}').kind, 'act', 'another floor is fine');
  assert.equal(plan.rooms.length, 2);
});

test('shrinking a room pulls its neighbours in, unless something is in the way', () => {
  const plan = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 16, d: 12 },
    { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 16, z: 0, w: 12, d: 12 },
    { id: 3, type: 'pantry', level: 'M', name: 'Pantry', x: 28, z: 0, w: 4, d: 12 },
  ], stairs: [], items: [{ level: 'M', x: 20, z: 6 }] };
  const res = applyAgentLine(plan, '@@set {"id":1,"w":12}');
  assert.equal(plan.rooms[1].x, 12); assert.equal(plan.rooms[2].x, 24); assert.equal(plan.items[0].x, 16);
  assert.match(res.text, /Kitchen/); assert.deepEqual(agentIssues(plan), []);

  const stuck = { rooms: [
    { id: 1, type: 'bedroom', level: 'M', name: 'Bed', x: 0, z: 0, w: 12, d: 12 },
    { id: 2, type: 'hall', level: 'M', name: 'Hall', x: 0, z: 12, w: 24, d: 4 },
    { id: 3, type: 'bath', level: 'M', name: 'Bath', x: 12, z: 0, w: 12, d: 12 },
  ], stairs: [] };
  const left = applyAgentLine(stuck, '@@set {"id":1,"d":10}');
  assert.equal(stuck.rooms[1].z, 12, 'the hall would run into the bath, so it stays'); assert.match(left.text, /gap/);
});

test('a plain move does not drag the rooms it leaves', () => {
  const plan = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 12, d: 12 },
    { id: 2, type: 'office', level: 'M', name: 'Office', x: 12, z: 0, w: 10, d: 10 },
  ], stairs: [] };
  plan.rooms.push({ id: 3, type: 'bedroom', level: 'U', name: 'Bed', x: 14, z: 0, w: 8, d: 10 });
  applyAgentLine(plan, '@@set {"id":2,"z":20}');
  assert.equal(plan.rooms[0].x, 0); assert.equal(plan.rooms[0].z, 0);
  plan.items = [{ level: 'M', x: 5, z: 5 }];
  applyAgentLine(plan, '@@set {"id":1,"x":4}');
  assert.equal(plan.rooms[2].x, 14, 'moving a room leaves the other floors alone');
  assert.equal(plan.items[0].x, 9, 'its furniture goes with it');
  const push = { rooms: [{ id: 1, type: 'hall', level: 'M', name: 'Hall', x: 0, z: 0, w: 6, d: 20 }, { id: 2, type: 'den', level: 'M', name: 'Den', x: 6, z: 0, w: 10, d: 10 }], stairs: [] };
  applyAgentLine(push, '@@set {"id":1,"x":4}');
  assert.equal(push.rooms[1].x, 6, 'a move never shoves a neighbour; the overlap is listed instead');
  assert.ok(agentIssues(push).some(i => /overlaps/.test(i)));
});

test('a resize keeps the floor above lined up', () => {
  const plan = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 16, d: 12 },
    { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 16, z: 0, w: 12, d: 12 },
    { id: 3, type: 'primary', level: 'U', name: 'Primary', x: 8, z: 0, w: 12, d: 12 },
    { id: 4, type: 'bath', level: 'U', name: 'Bath', x: 20, z: 0, w: 8, d: 12 },
    { id: 5, type: 'bedroom', level: 'U', name: 'Bed 2', x: 0, z: 0, w: 8, d: 12 },
  ], stairs: [], items: [{ level: 'U', x: 24, z: 6 }] };
  const res = applyAgentLine(plan, '@@set {"id":1,"w":20}');
  assert.equal(plan.rooms[1].x, 20);
  assert.equal(plan.rooms[2].x, 8); assert.equal(plan.rooms[2].w, 16, 'the room over both stretches');
  assert.equal(plan.rooms[3].x, 24, 'the room over the kitchen moves with it');
  assert.equal(plan.rooms[4].x, 0, 'the room over the living room alone stays');
  assert.equal(plan.items[0].x, 28);
  assert.match(res.text, /Lined up/);
  assert.equal(agentIssues(plan).some(i => /overlaps|gap/.test(i)), false);
});

test('a drawn outline scales with its room, and the editor warnings reach the brief', () => {
  const plan = { rooms: [{ id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 10, d: 10, shape: 'poly', pts: [[0, 0], [10, 0], [0, 10]] }], stairs: [] };
  applyAgentLine(plan, '@@set {"id":1,"w":20}');
  assert.deepEqual(plan.rooms[0].pts, [[0, 0], [20, 0], [0, 10]]);
  const brief = agentBrief(plan, ['Stair 4 on the main floor: The top lands outside.', '<b>x']);
  assert.match(brief, /drawn outline/); assert.match(brief, /Stair 4/); assert.doesNotMatch(brief, /<b>/);
});

test('layout checks: upper rooms past the main floor, long strips, loose rooms', () => {
  const row = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, type: 'bedroom', level: 'M', name: `Bed ${i + 1}`, x: i * 12, z: 0, w: 12, d: 14 }));
  const plan = { rooms: [...row,
    { id: 20, type: 'bedroom', level: 'U', name: 'Loft', x: 120, z: 0, w: 12, d: 12 },
    { id: 21, type: 'office', level: 'M', name: 'Office', x: 0, z: 20, w: 10, d: 10 },
    { id: 22, type: 'porch', level: 'M', name: 'Porch', x: 0, z: -6, w: 12, d: 6 },
  ], stairs: [{ id: 30, level: 'M', cx: 6, cz: 7 }] };
  const issues = agentIssues(plan);
  assert.ok(issues.some(i => /Loft .*144 sq ft over nothing/.test(i)));
  assert.ok(issues.some(i => /main floor is a 96 × 30 ft strip/.test(i)), issues.join('\n'));
  assert.ok(issues.some(i => /Office .*touches no other room/.test(i)));
  assert.equal(issues.some(i => /Porch/.test(i)), false, 'outdoor spaces are left out');

  const tidy = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 20, d: 16 },
    { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 20, z: 0, w: 16, d: 16 },
    { id: 3, type: 'primary', level: 'U', name: 'Primary', x: 0, z: 0, w: 16, d: 16 },
    { id: 7, type: 'hall', level: 'U', name: 'Landing', x: 16, z: 0, w: 4, d: 16 },
    { id: 4, type: 'bedroom', level: 'U', name: 'Bed 2', x: 20, z: 0, w: 16, d: 16 },
  ], stairs: [{ id: 5, level: 'M', cx: 18, cz: 8 }] };
  assert.deepEqual(agentIssues(tidy), []);
  tidy.rooms.push({ id: 6, type: 'garage', level: 'M', name: 'Garage', x: 36, z: 0, w: 26, d: 16 });
  assert.equal(agentIssues(tidy).some(i => /strip/.test(i)), false, 'an attached garage is not a strip');
});

test('a stair moves with @@set and its id', () => {
  const plan = { rooms: [{ id: 1, type: 'hall', level: 'M', name: 'Hall', x: 0, z: 0, w: 8, d: 20 }], stairs: [{ id: 2, level: 'M', cx: 4, cz: 6, W: 3.5, L: 12 }] };
  assert.equal(applyAgentLine(plan, '@@set {"id":2,"cz":12,"l":14}').kind, 'act');
  assert.deepEqual([plan.stairs[0].cx, plan.stairs[0].cz, plan.stairs[0].L], [4, 12, 14]);
  assert.equal(plan.rooms[0].z, 0);
  assert.equal(applyAgentLine(plan, '@@set {"id":2}').kind, 'err');
});

test('the room over a resized room changes with it, so the floor above stays closed', () => {
  const plan = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 16, d: 12 },
    { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 16, z: 0, w: 12, d: 12 },
    { id: 3, type: 'primary', level: 'U', name: 'Primary', x: 0, z: 0, w: 16, d: 12 },
    { id: 4, type: 'bedroom', level: 'U', name: 'Bed 2', x: 16, z: 0, w: 12, d: 12 },
  ], stairs: [] };
  applyAgentLine(plan, '@@set {"id":1,"w":12}');
  assert.deepEqual(plan.rooms.map(r => [r.x, r.w]), [[0, 12], [12, 12], [0, 12], [12, 12]]);
  applyAgentLine(plan, '@@set {"id":1,"w":20}');
  assert.deepEqual(plan.rooms.map(r => [r.x, r.w]), [[0, 20], [20, 12], [0, 20], [20, 12]]);
  assert.equal(agentIssues(plan).some(i => /overlaps|gap/.test(i)), false);
});

test('rooms on either side of a hall are not a gap', () => {
  const plan = { rooms: [
    { id: 1, type: 'bedroom', level: 'U', name: 'Bed 1', x: 0, z: 0, w: 12, d: 12 },
    { id: 2, type: 'hall', level: 'U', name: 'Hall', x: 0, z: 12, w: 24, d: 4 },
    { id: 3, type: 'bedroom', level: 'U', name: 'Bed 2', x: 0, z: 16, w: 12, d: 12 },
  ], stairs: [{ id: 4, level: 'M', cx: 2, cz: 2 }] };
  assert.equal(agentIssues(plan).some(i => /gap/.test(i)), false);
  plan.rooms.splice(1, 1);
  assert.ok(agentIssues(plan).some(i => /Bed 1 and Bed 2 have a 4.0 ft gap/.test(i)), 'without the hall it is a gap');
});

test('the plan from a bug report: notches, gaps, an overhang, and a stair arriving in a bedroom', () => {
  const R = [[1, 'Living', 'living', 'M', 0, 0, 12, 16], [2, 'Kitchen', 'kitchen', 'M', 12, 12, 16, 8], [3, 'Foyer', 'foyer', 'M', 12, 4, 8, 8], [4, 'Dining', 'dining', 'M', 20, 0, 16, 12],
    [5, 'Hall', 'hall', 'M', 0, 20, 32, 4], [6, 'Powder', 'powder', 'M', 28, 12, 8, 8], [7, 'Garage', 'garage', 'M', 32, 20, 16, 20], [8, 'Primary', 'primary', 'U', 0, 0, 16, 14],
    [9, 'Bed2', 'bedroom', 'U', 16, 0, 16, 14], [10, 'UpperHall', 'hall', 'U', 0, 14, 28, 6], [11, 'Bed3', 'bedroom', 'U', 0, 20, 16, 14], [12, 'Bed4', 'bedroom', 'U', 16, 20, 16, 14]];
  const plan = { rooms: R.map(([id, name, type, level, x, z, w, d]) => ({ id, name, type, level, x, z, w, d })), stairs: [{ id: 15, level: 'M', cx: 2, cz: 22 }] };
  const issues = agentIssues(plan).join('\n');
  assert.match(issues, /main floor outline has a 8 × 4 ft notch \(x 12–20, z 0–4\)/);
  assert.match(issues, /Living and Hall have a 4.0 ft gap on the main floor/);
  assert.match(issues, /Bed2 and Bed4 have a 6.0 ft gap on the second floor/);
  assert.match(issues, /Bed3 on the second floor has 160 sq ft over nothing/);
  assert.match(issues, /Stair 15 comes up inside Bed3/);
});

test('a hole inside a floor, a stair outside any room, and a normal corner step', () => {
  const ring = { rooms: [
    { id: 1, type: 'living', level: 'M', name: 'A', x: 0, z: 0, w: 30, d: 8 }, { id: 2, type: 'dining', level: 'M', name: 'B', x: 0, z: 18, w: 30, d: 8 },
    { id: 3, type: 'hall', level: 'M', name: 'C', x: 0, z: 8, w: 10, d: 10 }, { id: 4, type: 'office', level: 'M', name: 'D', x: 20, z: 8, w: 10, d: 10 },
  ], stairs: [{ id: 5, level: 'M', cx: 40, cz: 5 }] };
  const issues = agentIssues(ring).join('\n');
  assert.match(issues, /empty 10 × 10 ft space inside the main floor/);
  assert.match(issues, /Stair 5 on the main floor is not inside a room/);
  const step = { rooms: [{ id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 16, d: 18 }, { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 16, z: 0, w: 14, d: 14 }], stairs: [] };
  assert.deepEqual(agentIssues(step), [], 'a 4 ft step at a corner is just the outline');
});

test('a repair that does not reduce the problems is undone', () => {
  const plan = { rooms: [{ id: 1, type: 'living', level: 'M', name: 'Living', x: 0, z: 0, w: 10, d: 10 }, { id: 2, type: 'kitchen', level: 'M', name: 'Kitchen', x: 12, z: 0, w: 10, d: 10 }], stairs: [] };
  const before = agentBadness(plan);
  assert.equal(before, 3, 'the gap, and each room touches nothing');
  assert.ok(agentWantsFix('fix the alignment of the top floor')); assert.equal(agentWantsFix('add a bedroom'), false);
  applyAgentLine(plan, '@@set {"id":2,"x":5}');
  assert.equal(agentIssues(plan, Infinity).length, 1, 'one problem left, but it is an overlap');
  assert.equal(agentRepairFailed(true, true, before, plan), true, 'an overlap is worse than a gap: put it back');
  applyAgentLine(plan, '@@set {"id":2,"x":10,"z":0}');
  assert.equal(agentRepairFailed(true, true, before, plan), false, 'fixed: keep it');
  assert.equal(agentRepairFailed(false, true, 0, plan), false, 'only repairs are judged this way');
});

const plan2 = (R, stairs) => ({ rooms: R.map(([id, name, type, level, x, z, w, d]) => ({ id, name, type, level, x, z, w, d })), stairs });
test('stairs through the roof move under the upper hall, and a stacked twin goes', () => {
  // the repaired house from a bug report: two stairs in the one-storey back hall, climbing through the roof
  const plan = plan2([[1, 'Living', 'living', 'M', 0, -6, 12, 20], [2, 'Kitchen', 'kitchen', 'M', 12, 6, 14, 8], [3, 'Foyer', 'foyer', 'M', 12, -6, 6, 12], [4, 'Dining', 'dining', 'M', 18, -6, 16, 12],
    [5, 'Hall', 'hall', 'M', 0, 14, 30, 10], [6, 'Powder', 'powder', 'M', 26, 6, 8, 8], [7, 'Garage', 'garage', 'M', 30, 20, 16, 20], [8, 'Primary', 'primary', 'U', 0, -6, 14, 14],
    [9, 'Bed2', 'bedroom', 'U', 14, -6, 14, 14], [10, 'UpperHall', 'hall', 'U', 0, 8, 28, 6], [11, 'Bed3', 'bedroom', 'U', 0, 14, 14, 6], [12, 'Bed4', 'bedroom', 'U', 14, 14, 14, 6]],
    [{ id: 15, level: 'M', cx: 2, cz: 22, W: 3, L: 10 }, { id: 16, level: 'M', cx: 4, cz: 22, W: 3, L: 10 }]);
  assert.match(agentIssues(plan).join(' '), /Stair 15 comes up into empty space/);
  const notes = agentFixStairs(plan).map(n => n.text).join(' ');
  assert.equal(plan.stairs.length, 1); assert.match(notes, /Removed stair 16/);
  assert.match(notes, /Moved stair 15 in Living, under UpperHall/);
  assert.deepEqual([plan.stairs[0].cx, plan.stairs[0].cz], [5, 11], 'the nearest place that works');
  assert.equal(agentIssues(plan).some(i => /Stair/.test(i)), false);
});

test('a new stair asked for in the wrong place lands where it works, or is refused with what to build', () => {
  const plan = plan2([[1, 'Hall', 'hall', 'M', 0, 0, 6, 16], [2, 'Bed', 'bedroom', 'M', 6, 0, 12, 16], [3, 'Landing', 'hall', 'U', 0, 0, 6, 16], [4, 'Bed 2', 'bedroom', 'U', 6, 0, 12, 16]], []);
  const res = applyAgentLine(plan, '@@stair {"level":"M","cx":12,"cz":8,"w":3.5,"l":12}');
  assert.equal(res.kind, 'act'); assert.match(res.text, /in Hall, under Landing/); assert.deepEqual([plan.stairs[0].cx, plan.stairs[0].cz], [3, 8]);
  const none = plan2([[1, 'Bed', 'bedroom', 'M', 0, 0, 12, 12], [2, 'Bed 2', 'bedroom', 'U', 0, 0, 12, 12]], []);
  const refused = applyAgentLine(none, '@@stair {"level":"M","cx":6,"cz":6}');
  assert.equal(refused.kind, 'err'); assert.match(refused.text, /needs a hall or foyer/); assert.equal(none.stairs.length, 0);
});

test('a pass that changed the house settles its stairs at the end', () => {
  const plan = plan2([[1, 'Hall', 'hall', 'M', 0, 0, 6, 16], [2, 'Den', 'great', 'M', 6, 0, 12, 16], [3, 'Landing', 'hall', 'U', 0, 0, 6, 16], [4, 'Bed 2', 'bedroom', 'U', 6, 0, 12, 16]],
    [{ id: 5, level: 'M', cx: 3, cz: 8, W: 3.5, L: 12 }]);
  const pass = agentPass(plan);
  pass.line('@@set {"id":3,"x":6}'); pass.line('@@set {"id":4,"x":0,"w":6}'); // the landing and a bedroom swap sides upstairs
  const end = pass.end().map(r => r.text).join(' ');
  assert.match(end, /Moved stair 5 in Den, under Landing/); assert.equal(plan.stairs[0].cx, 9);
});

test('a basement stair stacks under the main stair instead of cutting through the floor beside it', () => {
  const plan = plan2([[1, 'Hall', 'hall', 'M', 0, 0, 8, 24], [2, 'Living', 'living', 'M', 8, 0, 16, 24], [3, 'Landing', 'hall', 'U', 0, 0, 8, 24], [4, 'Bed', 'bedroom', 'U', 8, 0, 16, 24],
    [5, 'Rec', 'rec', 'B', 0, 0, 24, 24]], [{ id: 6, level: 'M', cx: 4, cz: 12, W: 3.5, L: 12 }, { id: 7, level: 'B', cx: 4, cz: 4, W: 3.5, L: 12 }]);
  assert.match(agentIssues(plan).join(' '), /Stairs 6 and 7 run into each other/);
  const notes = agentFixStairs(plan).map(n => n.text).join(' ');
  assert.match(notes, /Moved stair 7 under stair 6, as one stairwell/);
  assert.deepEqual([plan.stairs[1].cx, plan.stairs[1].cz], [4, 12]);
  assert.equal(agentIssues(plan).some(i => /run into each other/.test(i)), false);
  const fresh = plan2([[1, 'Hall', 'hall', 'M', 0, 0, 8, 24], [5, 'Rec', 'rec', 'B', 0, 0, 24, 24]], [{ id: 6, level: 'M', cx: 4, cz: 12, W: 3.5, L: 12 }]);
  assert.match(applyAgentLine(fresh, '@@stair {"level":"B","cx":20,"cz":20}').text, /under stair 6, as one stairwell/);
});

test('a stair whose flight pokes out of its room is caught, and one across open rooms is fine', () => {
  const plan = plan2([[1, 'Rec', 'rec', 'B', 20, 0, 16, 14], [2, 'Hall', 'hall', 'M', 30, 0, 6, 28]], [{ id: 3, level: 'B', cx: 33, cz: 12, W: 4, L: 10 }]);
  assert.match(agentIssues(plan).join(' '), /Stair 3 does not fit inside Rec: its 4 × 10 ft flight runs out through the walls into the ground/);
  const open = plan2([[1, 'Hall', 'hall', 'M', 0, 0, 6, 10], [2, 'Living', 'living', 'M', 6, 0, 14, 10]], [{ id: 3, level: 'M', cx: 7, cz: 5, W: 3.5, L: 12 }]);
  assert.equal(agentIssues(open).some(i => /Stair 3/.test(i)), false, 'a flight from the hall into the open living room is fine');
});

test('when the basement flight has nowhere to go, both stairs move to where they stack', () => {
  const R = [[1, 'Kitchen', 'kitchen', 'M', 16, 0, 14, 14], [2, 'Hall', 'hall', 'M', 30, 0, 6, 28], [3, 'Hall 2', 'hall', 'U', 32, 0, 6, 26], [4, 'Rec', 'rec', 'B', 20, 0, 16, 14], [5, 'Storage', 'storage', 'B', 12, 14, 8, 10]];
  const plan = plan2(R, [{ id: 22, level: 'M', cx: 33, cz: 14, W: 4, L: 10 }, { id: 23, level: 'B', cx: 33, cz: 14, W: 4, L: 10 }]);
  assert.ok(agentIssues(plan).some(i => /Stair 23/.test(i)));
  assert.match(agentFixStairs(plan).map(n => n.text).join(' '), /Moved stairs 22 and 23/);
  assert.deepEqual(plan.stairs.map(s => [s.cx, s.cz]), [[34, 9], [34, 9]]);
  assert.equal(agentIssues(plan).some(i => /Stair/.test(i)), false);
});
