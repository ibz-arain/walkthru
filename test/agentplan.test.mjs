import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAgentLine, agentIssues, agentBrief, feedAgentLine } from '../src/agentplan.js';

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
  assert.match(brief, /right: Dining #2/);
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
