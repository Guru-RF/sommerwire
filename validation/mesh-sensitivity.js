// Run from the repository root with node validation/mesh-sensitivity.js.
const assert = require('node:assert/strict');
require('../engine.js');

const f = 100; // MHz. Parallel, offset wires in free space. Dimensions in metres.
const model = {
  wires: [
    { x1: 0, x2: 0, y1: -0.7, y2: 0.7, z1: 1, z2: 1, r: 0.001, seg: 32 },
    { x1: 0.3, x2: 0.3, y1: -2, y2: 2.5, z1: 1, z2: 1, r: 0.0002, seg: 2502 }
  ],
  sources: [{ pos: 'w1c', phase: 0, mag: 1 }], loads: [], tls: [],
  seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 }, ground: { type: 0 }, material: 0, z0: 50
};

function sample(requested) {
  model.wires[1].seg = requested;
  const result = MM.solve(model, f);
  const [driven, passive] = result.mesh.wireSegs.map(s => s.length);
  assert.equal(driven, 32);
  const { R, X } = result.sources[0];
  const gain = 10 * Math.log10(MM.makePattern(result, model).gain(0, 0).tot);
  assert.ok([R, X, gain].every(Number.isFinite));
  console.log([requested, passive, result.N, R.toFixed(4), X.toFixed(4), gain.toFixed(4)].join('\t'));
  return { passive, warnings: result.warnings };
}

console.log('w2 requested\tw2 used\tunknowns\tR (ohm)\tX (ohm)\tgain (dBi, el=0 az=0)');
const baseline = sample(2502); // Trigger the production size limit before solving.
const warning = baseline.warnings.find(w => w.includes('long passive wire'));
assert.match(warning, /w2/);
assert.ok(warning.includes(`w2=${baseline.passive}`));
assert.match(warning, /set Seg on every listed wire to its reported count/i);
assert.match(warning, /compare feed impedance and pattern/i);
assert.ok(baseline.passive < 2502);
for (const factor of [2, 4]) {
  const count = factor * baseline.passive;
  assert.equal(sample(count).passive, count);
}
