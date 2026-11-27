/* Regression test for the EFOC29 10 m mast study (validation/efoc29-mast). Run from the repository root: node --test tests/
 * Pins the study's claims against its own data: the literal buried return is rejected by the solver (and a return on the
 * soil surface falls back to the perfect mirror), so only above-soil proxies are swept; no proxy touches the soil; the
 * stored results reproduce; and 30 m sets the worst SWR at every optimum, which sits on the edge of the searched feed
 * heights for every above-soil proxy. These are proxy results, not a buried model and not measurements. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const study = require(path.join(ROOT, 'validation/efoc29-mast/study.js'));
const results = require(path.join(ROOT, 'validation/efoc29-mast/results.json'));
const MM = globalThis.MM;
const literal = zRun => Object.assign(study.model(2, 'P05', 'poor'), { wires: study.geometry(2, null, '-y', zRun) });

test('mast study: a buried return is rejected, a return on the soil switches to the perfect mirror', () => {
  assert.throws(() => MM.solve(literal(-0.3), 3.6), /below ground.*unsupported/i);
  assert.equal(MM.solve(literal(0), 3.6).mirrorMix, true);
  assert.equal(results.literal['buried 0.3 m'].solved, false);
  assert.equal(results.literal['on the soil surface'].mirrorMix, true);
});

test('mast study: geometry is 29 m rising to the 10 m mast top, 12 m of shield, every proxy wire above the soil', () => {
  for (const proxy of Object.keys(study.PROXIES)) for (const h of [0.75, 4, 9]) {
    const w = study.geometry(h, proxy), L = x => Math.hypot(x.x2 - x.x1, x.y2 - x.y1, x.z2 - x.z1);
    assert.ok(Math.abs(L(w[0]) + L(w[1]) - 29) < 1e-9 && w[0].z2 === 10 && w[1].z1 === 10 && w[1].z2 === 10);
    const shield = w.slice(2).reduce((a, x) => a + L(x), 0);
    assert.ok(Math.abs(shield - (study.PROXIES[proxy].truncate ? h - 0.05 : 12)) < 1e-9, proxy + ' shield length');
    for (const x of w) assert.ok(Math.min(x.z1, x.z2) >= 0.05, 'above the soil');
  }
});

test('mast study: stored optimum reproduces, without mirror fallback (poor soil, P05)', () => {
  const o = results.families['poor/P05'].opt, e = study.evaluate({ h: o.h, proxy: 'P05', soil: 'poor' });
  assert.equal(e.mirrorMix, false);
  e.per.forEach((p, i) => assert.ok(Math.abs(p.swr - o.swr[i]) < 1e-3, p.f + ' MHz'));
});

test('mast study: 30 m sets the worst SWR everywhere; above-soil optima sit on the searched edge', () => {
  for (const [k, fam] of Object.entries(results.families)) {
    const o = fam.opt;
    assert.equal(o.swr.indexOf(Math.max(...o.swr)), study.F.indexOf(10.125), k);
    assert.ok(o.max > 12, k + ' worst SWR ' + o.max);
    if (!k.endsWith('T05')) assert.equal(fam.atBoundary, true, k);
    for (const m of fam.mesh) assert.ok(m.maxRelDevPct < 5, k + ' mesh ' + m.seg);
  }
});
