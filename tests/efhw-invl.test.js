/* Regression test for the RF.Guru EFHW inverted-L built-in examples (efhwgen.js).
 * Run from the repository root:  node --test tests/
 * Checks the sourced geometry, the explicit ideal transformer ratio, that every wire stays above the soil (so the
 * Sommerfeld ground is used, not the perfect-mirror fallback), and that engine solves on both bands of each
 * example are finite with primary-side Z = antenna-side Z / ratio. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine.js'));
require(path.join(ROOT, 'efhwgen.js'));
const MM = globalThis.MM;
const { rfGuruEfhwInvL, RFGURU_EFHW } = globalThis;

// the same conversion the app does in numericModel() for these plain models (radius in mm in the tables)
function numeric(m) {
  const lam = MM.lambdaOf(+m.freq), ev = v => MM.evalExpr(v, lam);
  return {
    name: m.name, freq: +m.freq, z0: m.z0, material: m.material,
    wires: m.wires.map(w => ({ x1: ev(w.x1), y1: ev(w.y1), z1: ev(w.z1), x2: ev(w.x2), y2: ev(w.y2), z2: ev(w.z2), r: ev(w.r) / 1000, seg: Math.round(ev(w.seg)) || 0 })),
    sources: m.sources.map(s => ({ pos: s.pos, phase: +s.phase || 0, mag: +s.mag, ratio: +s.ratio })),
    loads: [], tls: [], ins: null,
    seg: Object.assign({ dm1: 400, dm2: 40, sc: 2, ec: 1 }, m.seg || {}),
    ground: Object.assign({ nf: 'sommerfeld' }, m.ground)
  };
}
const len = w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1, w.z2 - w.z1);

const CASES = [
  // product page: EFHW16080 has an integrated 68:1, ~82 m wire, choke ~8 m from the feedpoint
  { key: '16080', ratio: 68, radiator: 82, shield: 8, bands: [1.85, 3.65] },
  // product page: EFHW8040 has an integrated 70:1, 41 m wire, choke ~4 m from the feedpoint
  { key: '8040', ratio: 70, radiator: 41, shield: 4, bands: [3.65, 7.1] }
];

for (const c of CASES) {
  test('EFHW' + c.key + ': sourced ratio, wire lengths and return path', () => {
    const m = rfGuruEfhwInvL(c.key);
    assert.equal(m.sources.length, 1);
    assert.equal(m.sources[0].ratio, c.ratio, 'explicit ideal impedance ratio n:1 (not a turns ratio)');
    assert.equal(RFGURU_EFHW[c.key].ratio, c.ratio);
    assert.equal(m.z0, 50);
    const n = numeric(m);
    const rad = n.wires.filter((_, i) => rfGuruEfhwInvL.ROLES[i] === 'radiator'), sh = n.wires.filter((_, i) => rfGuruEfhwInvL.ROLES[i] === 'return');
    assert.equal(rad[0].z2 - rad[0].z1, c.key === '8040' ? 16 : 26, 'vertical wire length');
    assert.ok(Math.abs(rad.reduce((a, w) => a + len(w), 0) - c.radiator) < 1e-3, 'radiator length');
    assert.equal(sh.length, 1, 'one finite return conductor (coax shield exterior up to the choke)');
    assert.ok(Math.abs(len(sh[0]) - c.shield) < 1e-3, 'return path length = choke distance');
    for (const w of n.wires) assert.ok(Math.min(w.z1, w.z2) > 0.25, 'every wire clear of the soil');
    assert.match(m.comment, /shop\.rf\.guru/, 'provenance in the comment');
    assert.match(m.comment, /[Rr]epresentative/, 'representative dimensions are labelled');
  });

  for (const f of c.bands) {
    test('EFHW' + c.key + ' at ' + f + ' MHz: finite, Sommerfeld (no fallback), Z primary = Z antenna / ' + c.ratio, () => {
      const n = numeric(rfGuruEfhwInvL(c.key));
      const res = MM.solve(n, f);
      assert.equal(res.mirrorMix, false, 'no perfect-mirror fallback');
      assert.ok(!res.warnings.some(w => /touching the ground/i.test(w)), 'no ground-contact warning');
      const s = res.sources[0];
      for (const v of [s.R, s.X, s.Rant, s.Xant, s.P]) assert.ok(Number.isFinite(v), 'finite result');
      assert.ok(s.Rant > 0 && s.R > 0, 'positive resistance');
      assert.equal(s.ratio, c.ratio);
      assert.ok(Math.abs(s.Rant / s.R - c.ratio) < 1e-9 && Math.abs(s.Xant / s.X - c.ratio) < 1e-9, 'impedance ratio');
      const a = MM.analyze(n, f);
      assert.equal(a.approx, false, 'gain not marked approximate');
      assert.ok(Number.isFinite(a.swr) && a.swr >= 1);
    });
  }
}

test('index.html offers both examples from efhwgen.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<script src="efhwgen\.js"><\/script>/);
  assert.match(html, /rfGuruEfhwInvL\('16080'\)/);
  assert.match(html, /rfGuruEfhwInvL\('8040'\)/);
});
