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
  ['wholly buried over perfect ground', model(1, -1, -1)],
  ['crossing into real ground', model(2, 1, -1)],
  ['crossing out of real ground after a height offset', model(2, 1, 3, -2, 'complex')]
]) {
  test(name, () => {
    assert.throws(() => MM.solve(antenna, 14), /Wire 1.*below ground.*unsupported/i);
  });
}

for (const [name, antenna] of [
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
