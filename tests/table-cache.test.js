/* Exact-repeat reuse of the Sommerfeld interpolation table between solves (SOMM.tableCache).
 * Run from the repository root:  node --test tests/
 * Checks that a cached solve is bit-identical to an uncached one, that every input of the table is in its key (a
 * change, even of one ulp in frequency, misses: no reuse across frequency), that changes outside the key (loads,
 * sources, material, Z0) reuse it, that the cache stays within its bounds, and that each worker thread has its own
 * cache. The mesh is never cached (there is no MM.meshCache). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { Worker } = require('node:worker_threads');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine.js'));
const MM = globalThis.MM, SOMM = globalThis.SOMM;
const TC = SOMM.tableCache;
const DEF_T = TC.stats();

// 20 m dipole, 10 m up, over Sommerfeld ground; seg 0 = automatic segmentation (depends on the frequency)
function dipole(over) {
  return Object.assign({
    name: 'dipole', freq: 14.1,
    wires: [{ x1: 0, y1: -5.1, z1: 0, x2: 0, y2: 5.1, z2: 0, r: 0.001, seg: 0 }],
    sources: [{ pos: 'w1c', phase: 0, mag: 1, ratio: 1 }], loads: [], tls: [], boom: null, ins: null,
    seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 },
    ground: { type: 2, height: 10, eps: 13, sigma: 0.005, nf: 'sommerfeld' }, material: 1, z0: 50
  }, over || {});
}
const withWire = (m, w) => Object.assign({}, m, { wires: [Object.assign({}, m.wires[0], w)] });
const withGround = (m, g) => Object.assign({}, m, { ground: Object.assign({}, m.ground, g) });
const bits = a => Buffer.from(Float64Array.from(a).buffer).toString('hex');
const sig = r => bits([...r.halfRe, ...r.halfIm, ...r.sources.flatMap(s => [s.R, s.X, s.Ir, s.Ii]), r.Pin]);
function fresh() { TC.configure({ maxEntries: DEF_T.maxEntries, maxBytes: DEF_T.maxBytes }); TC.clear(); }
function uncached(fn) {
  TC.configure({ maxEntries: 0 });
  try { return fn(); } finally { fresh(); }
}
// table hits/misses caused by fn
function tableDelta(fn) { const a = TC.stats(); fn(); const b = TC.stats(); return { hits: b.hits - a.hits, misses: b.misses - a.misses }; }

test('a cached solve is bit-identical to an uncached one, cold and warm', () => {
  const models = [dipole(), dipole({ loads: [{ pos: 'w1c', type: 0, L: 1, C: 0, Q: 200, R: 0, X: 0 }] }),
    withGround(dipole(), { nf: 'somm-pec-test' }), dipole({ material: 0 })];
  for (const m of models) for (const f of [7.05, 14.1]) {
    const ref = uncached(() => sig(MM.solve(m, f)));
    fresh();
    assert.equal(sig(MM.solve(m, f)), ref, 'cold');
    assert.equal(sig(MM.solve(m, f)), ref, 'warm');
    const a = MM.analyze(m, f), b = uncached(() => MM.analyze(m, f));
    assert.equal(bits([a.gain, a.fb, a.el, a.az, a.swr]), bits([b.gain, b.fb, b.el, b.az, b.swr]), 'analyze');
  }
});

test('a repeat at the same frequency and geometry reuses the table', () => {
  fresh();
  const m = dipole();
  assert.deepEqual(tableDelta(() => MM.solve(m, 14.1)), { hits: 0, misses: 1 });
  assert.deepEqual(tableDelta(() => MM.solve(m, 14.1)), { hits: 1, misses: 0 });
  // inputs that the table does not read: loads, source amplitude and phase, material, Z0, insulation
  const others = [
    dipole({ loads: [{ pos: 'w1c', type: 1, L: 0, C: 0, Q: 0, R: 10, X: 5 }] }),
    dipole({ sources: [{ pos: 'w1c', phase: 30, mag: 2, ratio: 4 }] }),
    dipole({ material: 3 }), dipole({ z0: 75 }), dipole({ ins: { t: 1, er: 3, tand: 0 } })];
  for (const o of others) assert.deepEqual(tableDelta(() => MM.solve(o, 14.1)), { hits: 1, misses: 0 });
});

test('every input of the table is in its key', () => {
  fresh();
  const base = dipole(), f = 14.1;
  MM.solve(base, f);
  const next = x => { const b = new Float64Array([x]), u = new BigUint64Array(b.buffer); u[0] += 1n; return b[0]; };
  const changes = {
    'frequency + 1 ulp': [base, next(f)],
    'frequency 1 kHz away': [base, f + 0.001],
    permittivity: [withGround(base, { eps: 13.000001 }), f],
    conductivity: [withGround(base, { sigma: 0.0050001 }), f],
    'perfect-ground test mode': [withGround(base, { nf: 'somm-pec-test' }), f],
    'height (Rmin, Rmax)': [withGround(base, { height: 10.001 }), f],
    'horizontal extent (Rmax, thMax)': [withWire(base, { y2: 5.2 }), f],
    'height of one end (zmax)': [withWire(base, { z2: 0.5 }), f]
  };
  for (const [what, [m, fq]] of Object.entries(changes)) {
    assert.deepEqual(tableDelta(() => MM.solve(m, fq)), { hits: 0, misses: 1 }, what);
    // and the result equals a solve that never saw the cache
    assert.equal(sig(MM.solve(m, fq)), uncached(() => sig(MM.solve(m, fq))), what);
    MM.solve(base, f);   // keep the base table recent
  }
});

test('the cache stays within its bounds and can be turned off', () => {
  fresh();
  TC.configure({ maxEntries: 3 });
  const at = h => withGround(dipole(), { height: h });      // a distinct table per height
  for (let h = 10; h < 16; h++) MM.solve(at(h), 14.1);
  assert.equal(TC.stats().entries, 3);
  assert.ok(TC.stats().bytes > 0 && TC.stats().bytes <= TC.stats().maxBytes);
  // least recently used goes first: 13 is the oldest left, 15 the newest
  assert.deepEqual(tableDelta(() => MM.solve(at(13), 14.1)), { hits: 1, misses: 0 });
  assert.deepEqual(tableDelta(() => MM.solve(at(12), 14.1)), { hits: 0, misses: 1 });
  assert.deepEqual(tableDelta(() => MM.solve(at(14), 14.1)), { hits: 0, misses: 1 }, '14 was evicted by 12');
  const m = dipole();
  // byte budget below one table: nothing is kept, results are still produced
  TC.configure({ maxEntries: 8, maxBytes: 1000 });
  assert.equal(TC.stats().entries, 0);
  MM.solve(m, 14.1); assert.equal(TC.stats().entries, 0);
  // off
  TC.configure({ maxEntries: 0, maxBytes: DEF_T.maxBytes });
  MM.solve(m, 14.1); MM.solve(m, 14.1);
  assert.equal(TC.stats().entries, 0);
  fresh();
});

test('no mesh cache and no cross-frequency reuse', () => {
  assert.equal('meshCache' in MM, false);
  fresh();
  const m = withWire(dipole(), { seg: 22 });          // the same segment layout at both frequencies
  const a = MM.solve(m, 14.1), b = MM.solve(m, 14.1);
  assert.notEqual(a.mesh.segs, b.mesh.segs, 'each solve builds its own mesh');
  assert.deepEqual(tableDelta(() => MM.solve(m, 14.2)), { hits: 0, misses: 1 }, 'new frequency, new table');
  assert.deepEqual(tableDelta(() => MM.solve(m, 14.1)), { hits: 1, misses: 0 }, 'exact repeat');
});

test('distinct-frequency sweep: no table hits, retained memory bounded', () => {
  fresh();
  const m = dipole();
  const d = tableDelta(() => { for (let i = 0; i < 20; i++) MM.solve(m, 13.9 + i * 0.03); });
  assert.deepEqual(d, { hits: 0, misses: 20 });
  assert.ok(TC.stats().entries <= DEF_T.maxEntries && TC.stats().bytes <= DEF_T.maxBytes);
});

test('each worker thread has its own cache and gets the same results', async () => {
  fresh();
  const m = dipole();
  const ref = sig(MM.solve(m, 14.1));
  const before = TC.stats();
  const src = `
    const { parentPort, workerData } = require('node:worker_threads');
    require(${JSON.stringify(path.join(ROOT, 'engine.js'))});
    const bits = a => Buffer.from(Float64Array.from(a).buffer).toString('hex');
    const sig = r => bits([...r.halfRe, ...r.halfIm, ...r.sources.flatMap(s => [s.R, s.X, s.Ir, s.Ii]), r.Pin]);
    const s0 = globalThis.SOMM.tableCache.stats();
    const a = sig(MM.solve(workerData, 14.1)), b = sig(MM.solve(workerData, 14.1));
    parentPort.postMessage({ s0, a, b, s1: globalThis.SOMM.tableCache.stats() });`;
  const run = () => new Promise((resolve, reject) => {
    const w = new Worker(src, { eval: true, workerData: m });
    w.once('message', resolve); w.once('error', reject);
  });
  const [x, y] = await Promise.all([run(), run()]);
  for (const r of [x, y]) {
    assert.equal(r.s0.entries, 0, 'a new worker starts empty');
    assert.equal(r.a, ref); assert.equal(r.b, ref);
    assert.equal(r.s1.misses, 1); assert.equal(r.s1.hits, 1);
  }
  assert.deepEqual(TC.stats(), before, 'workers do not touch the main thread cache');
});
