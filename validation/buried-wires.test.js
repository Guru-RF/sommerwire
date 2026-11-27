const assert = require('node:assert/strict');
const test = require('node:test');
require('../engine.js');

function model(type, z1, z2, height = 0, nf) {
  return {
    ground: { type, height, nf },
    wires: [{ x1: 0, y1: 0, z1, x2: 3, y2: 0, z2, r: 0.001, seg: 6 }],
    sources: [{ pos: 'w1c', mag: 1, phase: 0 }]
  };
}

for (const [name, antenna] of [
  ['at the excluded lower contact boundary', model(2, -0.0001, 1)],
  ['just outside the contact tolerance', model(2, -0.000101, 1)],
  ['wholly buried over perfect ground', model(1, -1, -1)],
  ['crossing into real ground', model(2, 1, -1)],
  ['crossing out of real ground after a height offset', model(2, 1, 3, -2, 'complex')]
]) {
  test(name, () => {
    assert.throws(() => MM.solve(antenna, 14), /Wire 1.*below ground.*unsupported/i);
  });
}

for (const [name, antenna] of [
  ['touching just inside the negative contact tolerance', model(2, -0.000099, 1)],
  ['touching just inside the positive contact tolerance', model(2, 0.000099, 1)],
  ['elevated just beyond contact tolerance', model(2, 0.000101, 1)],
  ['touching real ground after a height offset', model(2, -1, 2, 1)],
  ['elevated above real ground', model(2, -1, -1, 2)],
  ['negative coordinates in free space', model(0, -2, -1)]
]) {
  test(name, () => {
    const result = MM.solve(antenna, 14);
    assert.ok(Number.isFinite(result.sources[0].R));
    assert.ok(Number.isFinite(result.sources[0].X));
    assert.equal(result.warnings.some(w => w.includes('Wires touching the ground')), name.startsWith('touching'));
  });
}

const goals = { swr: { w: 1, target: 1 }, jx: { w: 0 }, gain: { w: 0 }, fb: { w: 0 }, el: { w: 0 } };
function optimizer(z, min, max) {
  const variable = { type: 'end', idx: 0, axis: 'z', end: 'b', min, max };
  return MM.makeOptimizer(model(1, z, 2), [variable], goals, [14], 2);
}

test('optimizer reports a buried input even if bounds lift the endpoint', () => {
  assert.throws(() => optimizer(-1, 1, 2).step(), /Wire 1.*below ground.*unsupported/i);
});

test('optimizer reports a buried starting point introduced by bounds', () => {
  assert.throws(() => optimizer(1, -2, -1).step(), /Wire 1.*below ground.*unsupported/i);
});

test('optimizer keeps a valid start when its next trial goes below ground', () => {
  const run = optimizer(0.1, -1, 0.1);
  while (!run.step()) {}
  assert.equal(run.evals, 2);
  assert.deepEqual(run.best.vals, run.start.vals);
  assert.ok(Number.isFinite(run.best.per[0].R));
});
