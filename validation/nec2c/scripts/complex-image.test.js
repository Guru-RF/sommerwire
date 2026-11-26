const assert = require('node:assert/strict');
const { test } = require('node:test');
const archive = require('../decks/results.json');
require('../../../engine.js');

// Reproduce the fine dipole cases from necmp.js without regenerating its decks.
for (const row of archive.filter(r => r.dens === 2 && r.ground === 'real' && r.name.startsWith('20 m dipole'))) {
  test(row.name, () => {
    const h = Number(row.name.match(/at ([\d.]+) m/)[1]);
    const poor = row.name.includes('poor ground');
    const model = {
      wires: [{ x1: 0, y1: -5.17, z1: h, x2: 0, y2: 5.17, z2: h, r: 0.001, seg: 80 }],
      sources: [{ pos: 'w1c', phase: 0, mag: 1 }], loads: [], tls: [],
      seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 }, material: 0, z0: 50,
      ground: { type: 2, height: 0, eps: poor ? 5 : 13, sigma: poor ? 0.001 : 0.005 }
    };
    for (const [method, reference] of [['default', row.wm], ['complex', row.wc]]) {
      if (method === 'complex') model.ground.nf = method;
      const res = MM.solve(model, 14.05);
      const pattern = MM.makePattern(res, model);
      let peak = -Infinity;
      for (let el = 0; el <= 89; el++) peak = Math.max(peak, 10 * Math.log10(pattern.gain(el, 0).tot));
      // Numerical reproducibility tolerances, in ohms and dB.
      assert.ok(Math.abs(res.sources[0].R - reference.Z[0]) < 0.1);
      assert.ok(Math.abs(res.sources[0].X - reference.Z[1]) < 0.1);
      assert.ok(Math.abs(peak - reference.g) < 0.02);
      assert.equal(res.warnings.some(w => /compare.*Sommerfeld/i.test(w)), method === 'complex');
    }
  });
}
