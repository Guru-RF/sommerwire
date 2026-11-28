// solve: parity with the app's own pipeline and the repository's pinned figures, warnings and fallback flags,
// labels, the time budget (the worker is killed) and the concurrency limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, call, appForParity, dipole } from './helpers.js';

const P = appForParity();
const EFOC = 'RF.Guru EFOC29 end-fed off-centre, 80–10 m, 4:1, flat top';
// tests/efoc29.test.js: modelled SWR on the 50 ohm side of the ideal 4:1 (model figures, not measurements)
const SWR = { 3.6: 2.580, 7.1: 2.865, 10.125: 17.505, 14.175: 3.131, 18.118: 1.527, 21.225: 5.881, 24.94: 8.944, 28.5: 2.841 };
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), what + ': ' + a + ' vs ' + b);

let S;
test.before(async () => { S = await connect(); });
test.after(async () => { await S.close(); });

test('EFOC29 (the app\'s default example): eight bands match the pinned SWRs and the app pipeline exactly', async () => {
  const { isError, data } = await call(S.client, 'solve', { example: EFOC });
  assert.equal(isError, false);
  assert.deepEqual(data.frequencies, Object.keys(SWR).map(Number));
  const ex = P.EXAMPLES.find(e => e.name === EFOC), num = P.numeric(P.build(ex));
  for (const r of data.results) {
    assert.ok(Math.abs(r.swr - SWR[r.f]) < 0.01, r.f + ' MHz SWR ' + r.swr);
    assert.equal(r.flags.perfect_mirror_fallback, false); assert.equal(r.approx, false);
    // the same solve, analyze and summary the page runs (engine + index.html, loaded independently of mcp/src)
    const a = P.MM.analyze(num, r.f), sum = P.MM.patternSummary(a, num);
    for (const k of ['R', 'X', 'swr', 'gain', 'gainH', 'gainV', 'fb', 'el', 'az']) close(r[k], a[k], r.f + ' ' + k);
    assert.equal(r.pol, a.pol); assert.equal(r.N, a.res.N); assert.equal(r.nseg, a.res.mesh.segs.length);
    assert.deepEqual(r.warnings, a.res.warnings);
    close(r.sum.rdf.sky.rdf, sum.rdf.sky.rdf, 'RDF'); assert.equal(r.sum.uncertain, sum.uncertain);
    assert.equal(r.sources[0].ratio ?? 4, 4);
  }
  assert.match(data.notice, /^Simulation, not measurement/);
  assert.ok(data.assumptions.some(a => /ideal lossless 4:1 impedance transformer/.test(a)));
  assert.ok(data.assumptions.some(a => /permittivity 5, conductivity 0.001/.test(a)));
  assert.match(data.model_comment, /No measured SWR or match is implied/);
});

test('ground contact: the perfect-mirror fallback is flagged and its warnings are kept verbatim', async () => {
  const { data } = await call(S.client, 'solve', { example: 'Beverage receive antenna, 150 m' });
  const r = data.results[0];
  assert.equal(r.approx, true);
  assert.equal(r.flags.perfect_mirror_fallback, true); assert.equal(r.flags.uncertain, true);
  assert.deepEqual(r.flags.earthed_wires, ['w1', 'w2', 'w3'], 'the drops touch the soil; the top wire is connected to them');
  assert.ok(r.warnings.some(w => /touching the ground/.test(w)), 'ground contact warning');
  assert.ok(r.warnings.some(w => /Gain is approximate/.test(w)), 'approximate gain warning');
  assert.equal(r.flags.warnings, r.warnings.length);
});

test('complex image close to the soil: the low-height warning comes through', async () => {
  const { data } = await call(S.client, 'solve', { model: dipole({ wires: [{ x1: 0, y1: '-R/4', z1: 2, x2: 0, y2: 'R/4', z2: 2, r: 1, seg: -1 }], ground: { type: 2, nf: 'complex' } }) });
  assert.ok(data.results[0].warnings.some(w => /less than 0.2 λ/.test(w)));
  assert.ok(data.assumptions.some(a => /impedance method complex/.test(a)));
});

test('frequency and include_bands choose what is solved', async () => {
  const one = await call(S.client, 'solve', { example: EFOC, frequency: 7.1, include_bands: false });
  assert.deepEqual(one.data.frequencies, [7.1]); assert.ok(Math.abs(one.data.results[0].swr - SWR[7.1]) < 0.01);
  const fs = await call(S.client, 'solve', { model: dipole(), frequency: 14.3 });
  assert.deepEqual(fs.data.frequencies, [14.3]);
});

test('time budget: a solve past it is stopped (worker killed) and the server goes on', async () => {
  const slow = await connect({ SOMMERWIRE_MCP_SOLVE_TIMEOUT_MS: '1000' });
  try {
    const t0 = Date.now();
    const r = await call(slow.client, 'solve', { example: 'Dual-band Yagi pair, 2 m and 70 cm, on a mast' });
    assert.equal(r.isError, true); assert.match(r.data.error, /longer than its 1 s budget/);
    assert.ok(Date.now() - t0 < 10000, 'stopped promptly');
    const ok = await call(slow.client, 'solve', { model: dipole() });
    assert.equal(ok.isError, false, 'next solve runs');
  } finally { await slow.close(); }
});

test('concurrency: a second solve while one runs is refused, not queued', async () => {
  const [a, b] = await Promise.all([
    call(S.client, 'solve', { example: 'G3TXQ hexbeam, tuned per band, 50 Ω coax centre' }),
    new Promise(r => setTimeout(r, 300)).then(() => call(S.client, 'solve', { model: dipole() }))
  ]);
  assert.equal(a.isError, false);
  assert.equal(b.isError, true); assert.match(b.data.error, /already running 1 solve/);
});

test('cancellation: a cancelled solve frees its worker at once', async () => {
  const ac = new AbortController();
  const t0 = Date.now();
  const slow = call(S.client, 'solve', { example: 'Dual-band Yagi pair, 2 m and 70 cm, on a mast' }, { signal: ac.signal });
  setTimeout(() => ac.abort(), 500);
  await assert.rejects(slow);
  // the 37 s solve was stopped: the next one is not refused as busy
  await new Promise(r => setTimeout(r, 100));
  const next = await call(S.client, 'solve', { model: dipole() });
  assert.equal(next.isError, false, JSON.stringify(next.data).slice(0, 200));
  assert.ok(Date.now() - t0 < 15000);
});
