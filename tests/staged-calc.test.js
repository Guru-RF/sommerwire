/* Impedance first, far field after, cuts and 3D grid only for a view that shows them.
 * Run from the repository root:  node --test tests/
 * 1. Engine: analyzeSolved(solve()) is analyze() to the last bit; feedpoint() gives its R, X and SWR without a pattern.
 * 2. Worker: a calc job posts the impedance before the far field, and both come from one solve. The cuts and the grid
 *    are added later from the kept solve (kind 'detail') without solving again; a lost solve is solved once more.
 *    Every staged result equals pack() (the whole result) exactly, warnings included.
 * 3. The main-thread fallback runs the same code and gives the same results as the worker.
 * 4. The page: what is asked for follows the visible tab; the readout says the far field is pending; parts that
 *    arrive for an older result are kept with it but never drawn as the latest; a far-field failure is reported. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine.js'));
require(path.join(ROOT, 'structgen.js'));
require(path.join(ROOT, 'efhwgen.js'));
const MM = globalThis.MM;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function section(start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i);
  assert.ok(i >= 0 && j > i, 'section ' + start);
  return html.slice(i, j);
}
const app = vm.createContext({ MM, WMStruct: globalThis.WMStruct, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29: globalThis.rfGuruEfoc29, clone: o => JSON.parse(JSON.stringify(o)) });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker'), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const appModel = n => { const i = EXAMPLES.findIndex(e => e.name.startsWith(n)); assert.ok(i >= 0, n); return vm.runInContext('S.model = normalize(clone(EXAMPLES[' + i + '])); numericModel()', app); };
const workerSrc = section('const WORKER_SRC = `', '`;\nlet worker').replace('const WORKER_SRC = `', '');
const pack = new Function('self', 'MM', workerSrc + '; return pack;')({ postMessage() {} }, MM);
const same = (a, b, msg) => assert.deepEqual(structuredClone(a), structuredClone(b), msg);
const omit = (o, ...k) => { const c = Object.assign({}, o); k.forEach(x => delete c[x]); return c; };

// a small spread of the examples: free space, perfect ground, Sommerfeld ground, and a mirror-current case
const mirror = () => { const m = appModel('Inverted V, 40 m'); m.ground.nf = 'mirror'; return m; };
const CASES = [
  { name: 'Half-wave dipole', model: () => appModel('Half-wave dipole') },
  { name: '3-el Yagi', model: () => appModel('3-element Yagi') },
  { name: 'RF.Guru EFHW8040 7.1', model: () => appModel('RF.Guru EFHW8040'), f: 7.1 },
  { name: 'Inverted V over real ground, mirror currents', model: mirror, mirror: true }
];
for (const c of CASES) { const m = c.model(); c.m = m; c.f = c.f || m.freq; }

// counts every solve: MM.solve directly, MM.analyze (which solves inside the engine) as well
function counting(fn) {
  const solve = MM.solve, analyze = MM.analyze; let n = 0;
  MM.solve = (...a) => { n++; return solve(...a); }; MM.analyze = (...a) => { n++; return analyze(...a); };
  try { fn(); } finally { MM.solve = solve; MM.analyze = analyze; }
  return n;
}
// the worker source on a fake worker scope; messages are structured-cloned as postMessage does
function worker() {
  const out = [], self = { postMessage: m => out.push(structuredClone(m)) };
  new Function('self', 'MM', workerSrc)(self, MM);
  return { send: d => self.onmessage({ data: structuredClone(d) }), out };
}

/* ---------- 1. engine ---------- */
test('engine: analyzeSolved on a solve equals analyze; feedpoint gives the same impedance and SWR without a pattern', () => {
  for (const c of CASES) {
    const a = MM.analyze(c.m, c.f), res = MM.solve(c.m, c.f), b = MM.analyzeSolved(res, c.m), fp = MM.feedpoint(MM.solve(c.m, c.f), c.m);
    for (const k of ['f', 'R', 'X', 'swr', 'z0', 'approx', 'capDb', 'gain', 'el', 'az', 'fb', 'pol', 'gainH', 'gainV']) assert.equal(b[k], a[k], c.name + ' ' + k);
    same(b.res.warnings, a.res.warnings, c.name + ' warnings');
    assert.deepEqual([fp.R, fp.X, fp.swr, fp.z0], [a.R, a.X, a.swr, a.z0], c.name);
    assert.equal(b.res, res, 'the solve passed in is the one used');
  }
});

/* ---------- 2. worker ---------- */
test('worker: impedance is posted before the far field, from one solve, and the staged result equals pack()', () => {
  for (const c of CASES) {
    const w = worker(), full = pack(c.m, c.f);
    const n = counting(() => w.send({ id: 7, kind: 'calc', model: c.m, f: c.f, want: { cuts: true, grid: true }, early: true }));
    assert.equal(n, 1, c.name + ': one solve for impedance and far field');
    assert.equal(w.out.length, 2);
    const [p, d] = w.out;
    assert.equal(p.id, 7); assert.equal(p.progress.stage, 'z'); assert.equal(d.ok, true); assert.equal(d.data.stage, 'done');
    // the impedance stage has no far-field figure at all, and what it has is what the final result has
    for (const k of ['gain', 'fb', 'el', 'az', 'sum', 'cutAz', 'grid', 'pol']) assert.equal(k in p.progress, false, k);
    for (const k of ['f', 'R', 'X', 'swr', 'z0', 'N', 'nseg', 'Pin', 'ground', 'height']) assert.equal(p.progress[k], d.data[k], c.name + ' ' + k);
    same(p.progress.segs, d.data.segs); same(p.progress.sources, d.data.sources); same(p.progress.earthed, d.data.earthed);
    same(omit(d.data, 'ref'), full, c.name + ': staged = pack()');
    assert.equal(d.data.ref, 7);
  }
});

test('worker: warnings are kept; the impedance stage has the solve warnings, the result adds the far-field ones', () => {
  const c = CASES.find(x => x.mirror), w = worker(), full = pack(c.m, c.f);
  w.send({ id: 1, kind: 'calc', model: c.m, f: c.f, want: {}, early: true });
  const z = w.out[0].progress, d = w.out[1].data;
  assert.ok(full.warnings.some(x => /^Gain is approximate/.test(x)), 'the mirror-current case warns');
  same(d.warnings, full.warnings, 'every warning of pack(), in the same order');
  same(z.warnings, full.warnings.filter(x => !/^Gain is approximate/.test(x)), 'before the far field: the solve warnings');
  assert.equal(d.approx, true);
});

test('worker: cuts and grid come later from the kept solve, identical to pack(), without solving again', () => {
  for (const c of CASES) {
    const w = worker(), full = pack(c.m, c.f);
    w.send({ id: 3, kind: 'calc', model: c.m, f: c.f, want: { cuts: false, grid: false } });
    const d = w.out[0].data;
    for (const k of ['cutAz', 'cutEl', 'grid']) assert.equal(k in d, false, 'not made: ' + k);
    same(omit(d, 'ref'), omit(full, 'cutAz', 'cutEl', 'grid'), c.name + ': everything else as pack()');
    let n = counting(() => w.send({ id: 4, kind: 'detail', ref: 3, model: c.m, f: c.f, want: { cuts: true } }));
    assert.equal(n, 0, 'no solve for the cuts');
    let x = w.out[1].data;
    assert.equal(x.resolved, false); same(x.cutAz, full.cutAz); same(x.cutEl, full.cutEl); assert.equal('grid' in x, false);
    n = counting(() => w.send({ id: 5, kind: 'detail', ref: 3, model: c.m, f: c.f, want: { grid: true } }));
    assert.equal(n, 0, 'no solve for the grid');
    same(w.out[2].data.grid, full.grid, c.name + ' grid');
  }
});

test('worker: a solve that is no longer kept is solved once more, gives the same parts, and says so', () => {
  const c = CASES[1], w = worker(), full = pack(c.m, c.f);
  // a fresh worker (as after the worker was replaced) has nothing kept
  const n = counting(() => w.send({ id: 9, kind: 'detail', ref: 1, model: c.m, f: c.f, want: { cuts: true, grid: true } }));
  assert.equal(n, 1);
  const x = w.out[0].data;
  assert.equal(x.resolved, true); same(x.cutAz, full.cutAz); same(x.cutEl, full.cutEl); same(x.grid, full.grid);
  // the kept solves are bounded: the oldest drops out, recent ones stay
  const v = worker(), m = CASES[0].m;
  for (let i = 1; i <= 14; i++) v.send({ id: i, kind: 'calc', model: m, f: CASES[0].f, want: {} });
  assert.equal(counting(() => v.send({ id: 20, kind: 'detail', ref: 14, model: m, f: CASES[0].f, want: { cuts: true } })), 0, 'recent: kept');
  assert.equal(counting(() => v.send({ id: 21, kind: 'detail', ref: 1, model: m, f: CASES[0].f, want: { cuts: true } })), 1, 'oldest: dropped');
});

test('worker: the worker source never sees a view setting; the page decides what is wanted', () => {
  assert.doesNotMatch(workerSrc, /polSel|edPol|edLobe|S\.tab/);
});

/* ---------- 3. fallback ---------- */
function fallbackJob() {
  const ctx = { MM, WORKER_SRC: workerSrc, worker: null, S: { seq: 0, opt: {} }, setTimeout, performance };
  vm.runInNewContext(section('const fallback', '/* ---------------- status'), ctx);
  return ctx.job;
}
test('fallback: the main thread gives the same staged results as the worker, impedance first', async () => {
  for (const c of CASES) {
    const job = fallbackJob(), w = worker(), seen = [];
    const want = { cuts: true, grid: true };
    // impedance first: when it is handed over, no far-field work has been done yet
    const as0 = MM.analyzeSolved; let farField = 0, atZ = null;
    MM.analyzeSolved = (...a) => { farField++; return as0(...a); };
    let r; try { r = await job({ kind: 'calc', model: c.m, f: c.f, want, early: true }, z => { atZ = farField; seen.push(z); }); } finally { MM.analyzeSolved = as0; }
    assert.equal(atZ, 0, c.name + ': far field not started when the impedance is shown'); assert.equal(farField, 1);
    w.send({ id: 1, kind: 'calc', model: c.m, f: c.f, want, early: true });
    assert.equal(seen.length, 1); assert.equal(seen[0].stage, 'z');
    same(seen[0], w.out[0].progress, c.name + ': impedance stage');
    same(r, w.out[1].data, c.name + ': result (both are job 1)');
    // cuts later from the fallback's own kept solve
    const job2 = fallbackJob(), r2 = await job2({ kind: 'calc', model: c.m, f: c.f, want: {} });
    const solves = [];
    const s0 = MM.solve, a0 = MM.analyze; MM.solve = (...a) => (solves.push(1), s0(...a)); MM.analyze = (...a) => (solves.push(1), a0(...a));
    let d; try { d = await job2({ kind: 'detail', ref: r2.ref, model: c.m, f: c.f, want }); } finally { MM.solve = s0; MM.analyze = a0; }
    assert.equal(solves.length, 0, 'no second solve on the main thread either');
    same(d.cutAz, r.cutAz); same(d.grid, r.grid); assert.equal(d.resolved, false);
  }
});
test('fallback: without early the result comes in one piece and no progress is sent', async () => {
  const job = fallbackJob(), seen = [];
  const r = await job({ kind: 'calc', model: CASES[0].m, f: CASES[0].f }, z => seen.push(z));
  assert.equal(seen.length, 0); assert.equal(r.stage, 'done');
});

/* ---------- 4. the page ---------- */
function ui(tab, lobe = true) {
  const nodes = {}, jobs = [], draws = { readout: 0, view: 0, patterns: 0, ed: 0 };
  const $ = id => nodes[id] ||= { contains: () => false, innerHTML: '', hidden: false, value: '', checked: id === '#edLobe' ? lobe : false };
  const S = { model: { name: 'm', v: 1, bands: [] }, calcFreq: 14, history: [], dirty: true, tab };
  const ctx = { $, $$: () => [], S, fmt: (x, d = 2) => x.toFixed(d), swrClass: () => 'good',
    numericModel: () => ({ v: S.model.v }), invalidateSweep() {}, validateCells() {}, renderVars() {}, setStatus: (k, t) => (S.status = [k, t]),
    renderResults() {}, renderReadout: () => draws.readout++, drawView: () => draws.view++, drawPatterns: () => draws.patterns++, drawSmith() {}, drawEdPolar: () => draws.ed++,
    setSweepDefaults() {}, invalidateBands() {}, renderBands() {}, performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {}, document: {},
    job: (msg, onProgress) => new Promise((resolve, reject) => jobs.push({ msg, onProgress, resolve, reject })) };
  vm.runInNewContext(section('let calcTimer', "document.addEventListener('input'") + section('async function calculate', 'const GNAME'), ctx);
  return { ctx, S, jobs, draws, flush: () => new Promise(setImmediate) };
}
const Z = (extra) => Object.assign({ stage: 'z', f: 14, R: 50, X: 1, swr: 1.02, z0: 50, N: 9, nseg: 9, warnings: ['solve'], sources: [], segs: [] }, extra);
const DONE = (extra) => Object.assign(Z(), { stage: 'done', ref: 1, gain: 2, fb: 0, el: 0, az: 90, sum: {}, warnings: ['solve', 'far'] }, extra);

test('page: what a calculation asks for follows the visible tab', () => {
  const want = (tab, lobe) => structuredClone(ui(tab, lobe).ctx.detailWanted());
  assert.deepEqual(want('calc'), { cuts: false, grid: false });
  assert.deepEqual(want('geometry'), { cuts: false, grid: false });
  assert.deepEqual(want('sweep'), { cuts: false, grid: false });
  assert.deepEqual(want('view', true), { cuts: true, grid: true });
  assert.deepEqual(want('view', false), { cuts: true, grid: false }, 'the editor without its far-field lobe needs only the mini cuts');
  assert.deepEqual(want('pattern', false), { cuts: true, grid: true });
});

test('page: a full calculation shows the impedance first, then the far field; only the result enters the list', async () => {
  const { ctx, S, jobs, draws, flush } = ui('calc');
  const run = ctx.calculate();
  assert.equal(jobs.length, 1);
  assert.deepEqual(structuredClone(jobs[0].msg), { kind: 'calc', model: { v: 1 }, f: 14, want: { cuts: false, grid: false }, early: true });
  const z = Z(); jobs[0].onProgress(z);
  assert.equal(S.last, z); assert.equal(S.last.stage, 'z'); assert.equal(S.history.length, 0);
  assert.equal(S.dirty, false); assert.equal(draws.readout, 1);
  assert.match(S.status[1], /Impedance and SWR ready/);
  const r = DONE(); jobs[0].resolve(r); await run; await flush();
  assert.equal(S.last, r); assert.deepEqual(S.history, [r]); assert.equal(S.status[0], 'ok');
});

test('page: live calculations come in one piece', async () => {
  const { ctx, S, jobs } = ui('view');
  const run = ctx.calculate({ live: true });
  assert.equal(jobs[0].msg.early, false); assert.equal(jobs[0].onProgress, null);
  jobs[0].resolve(DONE()); await run;
  assert.equal(S.history.length, 0);
});

test('page: impedance stays on screen when the far field fails, and says why', async () => {
  const { ctx, S, jobs } = ui('calc');
  const run = ctx.calculate();
  const z = Z(); jobs[0].onProgress(z); jobs[0].reject(new Error('boom')); await run;
  assert.equal(S.last, z); assert.equal(z.detailError, 'boom'); assert.equal(S.status[0], 'err');
  assert.equal(S.calcBusy, false);
});

test('page: missing cuts are fetched once from the kept solve; for an older result they are kept but not drawn', async () => {
  const { ctx, S, jobs, draws, flush } = ui('calc');
  let run = ctx.calculate(); const r = DONE({ ref: 1 }); jobs[0].resolve(r); await run;
  S.tab = 'pattern';
  ctx.ensureDetail(r); ctx.ensureDetail(r);
  assert.equal(jobs.length, 2, 'one detail request while one is on its way');
  assert.deepEqual(structuredClone(jobs[1].msg), { kind: 'detail', ref: 1, model: { v: 1 }, f: 14, want: { cuts: true, grid: true } });
  // a newer calculation replaces the result before its parts arrive
  run = ctx.calculate(); const r2 = DONE({ ref: 3 }); jobs[2].resolve(r2); await run;
  const before = draws.patterns;
  jobs[1].resolve({ ref: 1, resolved: false, cutAz: [[0, 1, 2, 3]], cutEl: [[0, 1, 2, 3]], grid: { els: [0] } }); await flush();
  assert.ok(r.cutAz && r.grid, 'kept with their own result');
  assert.equal(S.last, r2); assert.equal(draws.patterns, before, 'not drawn over the newer result');
  // a result that already has its parts asks for nothing; the latest result is drawn when its parts arrive
  ctx.ensureDetail(r); assert.equal(jobs.length, 3);
  ctx.ensureDetail(r2); assert.equal(jobs.length, 4);
  jobs[3].resolve({ ref: 3, resolved: true, cutAz: [[0]], cutEl: [[0]], grid: { els: [] } }); await flush();
  assert.equal(draws.patterns, before + 1); assert.equal(r2.resolved, 1, 'a second solve is counted on the result');
  // an impedance-only result never asks: its far field is still on its way in the calc job
  ctx.ensureDetail(Z()); assert.equal(jobs.length, 4);
});

test('page: a failed detail request is reported once, not retried in a loop', async () => {
  const { ctx, S, jobs, flush } = ui('pattern');
  const run = ctx.calculate(); const r = DONE({ ref: 1 }); jobs[0].resolve(r); await run;
  ctx.ensureDetail(r); jobs[1].reject(new Error('lost')); await flush();
  assert.equal(r.detailError, 'lost');
  ctx.ensureDetail(r); assert.equal(jobs.length, 2);
});

const nodeSet = () => { const nodes = {}; const $ = id => nodes[id] ||= { offsetParent: {}, textContent: '', innerHTML: '', title: '', value: '', className: '', checked: true, hidden: false, classList: { on: new Set(), toggle(c, f) { f ? this.on.add(c) : this.on.delete(c); } } }; return { nodes, $ }; };
test('page: the readout shows impedance and SWR at once and marks the far-field tiles as pending', () => {
  const run = last => { const { nodes, $ } = nodeSet(); const ctx = { $, $$: () => [], S: { last, dirty: false }, fmt: (x, d = 2) => x.toFixed(d) };
    vm.runInNewContext(section('function patSummaryHtml', "$('#polSel').onchange") + section('function setStatus', '/* ---------------- tables'), ctx); ctx.renderReadout(); return nodes; };
  const n = run(Z({ R: 43.3, X: -42.6, swr: 2.45 }));
  assert.equal(n['#roZ'].innerHTML, '43.3 − j42.6'); assert.equal(n['#roSWR'].innerHTML, '2.45');
  for (const id of ['#roG', '#roFB', '#roRdf', '#roEl', '#roPol', '#roPkH', '#roPkV', '#roLoV', '#roHiH']) {
    assert.equal(n[id].innerHTML, '…', id); assert.match(n[id].className, /pending/); assert.match(n[id].title, /Computing the far field/);
  }
  const e = run(Z({ detailError: 'boom' }));
  assert.equal(e['#roG'].innerHTML, 'n/a'); assert.match(e['#roG'].title, /not available: boom/);
});
