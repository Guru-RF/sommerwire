/* Multiband defaults for built-in examples (index.html, efhwgen.js).
 * Run from the repository root:  node --test tests/
 * 1. Which examples carry band frequencies (model.bands, MHz), and that each one is defensible: inside an IARU
 *    Region 1 amateur band and stated in the example itself (or the midpoint of a range it states).
 *    Only the two RF.Guru EFHW inverted-Ls carry bands; every other example stays single-band.
 * 2. Engine values at those frequencies, so the band list and the example's own claims stay in step.
 * 3. The UI flow: one full calculation also solves the other bands; edits clear them; late results are dropped.
 * 4. The pattern view: the EFHW examples open with horizontal + vertical polarization on the same cuts. */
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

// the app's own example table, normalize() and numericModel(), run in a sandbox
const app = vm.createContext({ MM, WMStruct: globalThis.WMStruct, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, clone: o => JSON.parse(JSON.stringify(o)) });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker') + section('/* amateur HF bands per IARU region', 'const hfBands'), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const HAM1 = vm.runInContext('HAM_BANDS[1]', app);
const appModel = i => vm.runInContext('S.model = normalize(clone(EXAMPLES[' + i + '])); numericModel()', app);
const plain = v => JSON.parse(JSON.stringify(v)); // vm arrays have another realm's prototype
const byName = n => { const i = EXAMPLES.findIndex(e => e.name.startsWith(n)); assert.ok(i >= 0, n); return i; };

// examples that state their operating frequencies; everything else stays single-band
const EXPECTED = {
  'RF.Guru EFHW16080': [1.85, 3.65],
  'RF.Guru EFHW8040': [3.65, 7.1]
};

test('band frequencies only on the examples that state them', () => {
  const got = {};
  EXAMPLES.forEach(e => { if (e.bands) got[Object.keys(EXPECTED).find(k => e.name.startsWith(k)) || e.name] = e.bands; });
  assert.deepEqual(plain(got), EXPECTED);
});

for (const [name, bands] of Object.entries(EXPECTED)) {
  test(name + ': bands are amateur frequencies stated by the example, the first is the design frequency', () => {
    const ex = EXAMPLES[byName(name)];
    assert.equal(ex.freq, bands[0], 'loading the example starts at the first band');
    for (const f of bands) {
      assert.ok(HAM1.some(([lo, hi]) => f >= lo && f <= hi), f + ' MHz inside an IARU Region 1 band');
      const ranges = [...ex.comment.matchAll(/(\d+\.\d+)-(\d+\.\d+) MHz|(\d+\.\d+)-(\d+\.\d+)(?=,| and)/g)].map(m => [+(m[1] || m[3]), +(m[2] || m[4])]);
      const stated = new RegExp('\\b' + String(f).replace('.', '\\.') + '0?\\b').test(ex.comment) || ranges.some(([a, b]) => Math.abs((a + b) / 2 - f) < 1e-9);
      assert.ok(stated, f + ' MHz is stated in the comment (or is the midpoint of a stated range)');
    }
  });
}

test('normalize keeps valid band lists and gives every other model an empty one', () => {
  const norm = m => vm.runInContext('normalize(' + JSON.stringify(m) + ').bands', app);
  assert.deepEqual(plain(norm({ bands: [3.65, '7.1', -1, 'x'] })), [3.65, 7.1]);
  assert.deepEqual(plain(norm({})), []);
});

// EFHW8040: horizontal trimmed for the minimax SWR at 3.65 and 7.1 MHz (vertical 12.5 m, feed 1 m, bend 13.5 m, 4 m shield to 1 m,
// 70:1, soil εr 5, 1 mS/m)
test('EFHW8040 horizontal trim minimises the larger SWR at 3.65 and 7.1 MHz', () => {
  const d = globalThis.RFGURU_EFHW['8040'];
  assert.equal(d.total, 41, 'sourced wire length kept as the reference');
  assert.equal(d.horiz, 28.36, 'chosen horizontal length');
  assert.deepEqual([d.feed, d.bend, d.choke, d.chokeZ, d.eps, d.sigma], [1, 13.5, 4, 1, 5, 0.001], 'feedpoint, bend, shield and soil');
  const m = globalThis.rfGuruEfhwInvL('8040');
  assert.deepEqual(m.bands, [3.65, 7.1]);
  assert.match(m.comment, /28\.36 m/); assert.match(m.comment, /41 m/);
  const n = appModel(byName('RF.Guru EFHW8040'));
  assert.equal(n.wires[0].z1, 1); assert.equal(n.wires[0].z2 - n.wires[0].z1, 12.5); assert.equal(n.sources[0].ratio, 70);
  assert.ok(Math.abs(n.wires[1].x2 - n.wires[1].x1 - 28.36) < 1e-9);
  const s80 = MM.analyze(n, 3.65).swr, s40 = MM.analyze(n, 7.1).swr;
  assert.ok(Math.max(s80, s40) < 2.5 && Math.abs(s80 - s40) < 0.05, 'SWR ' + s80.toFixed(3) + ' / ' + s40.toFixed(3));
  // minimax at 1 cm: 1 cm shorter or longer raises the larger of the two SWRs
  const worst = h => { d.horiz = h; const v = vm.runInContext('S.model = normalize(clone(' + JSON.stringify(globalThis.rfGuruEfhwInvL('8040')) + ')); numericModel()', app);
    return Math.max(MM.analyze(v, 3.65).swr, MM.analyze(v, 7.1).swr); };
  try { assert.ok(worst(28.35) > Math.max(s80, s40) && worst(28.37) > Math.max(s80, s40), 'minimax at 28.36 m'); } finally { d.horiz = 28.36; }
  // local SWR minima: below 3.65 on 80 m and above 7.1 on 40 m (length alone cannot align both)
  const dip = (a, b) => { let best = [0, Infinity]; for (let f = a; f <= b + 1e-9; f += 0.01) { const s = MM.analyze(n, f).swr; if (s < best[1]) best = [f, s]; } return best; };
  const d80 = dip(3.45, 3.6), d40 = dip(7.2, 7.35);
  assert.ok(d80[1] < 1.15 && d80[0] > 3.50 && d80[0] < 3.55, '80 m dip ' + d80.map(v => v.toFixed(3)));
  assert.ok(d40[1] < 1.55 && d40[0] > 7.23 && d40[0] < 7.29, '40 m dip ' + d40.map(v => v.toFixed(3)));
});

// EFHW16080: 82 m kept; feedpoint 3.7 m and bend 16 m (the cap) from an engine grid search of feed 1–4 m, bend 10–16 m
// for the lowest larger SWR at 1.85 and 3.65 MHz on soil εr 5, 1 mS/m (see efhwgen.js)
test('EFHW16080 keeps its sourced length, lists its two bands and uses the searched heights', () => {
  const d = globalThis.RFGURU_EFHW['16080'];
  const m = globalThis.rfGuruEfhwInvL('16080');
  assert.deepEqual(m.bands, [1.85, 3.65]);
  assert.equal(d.horiz, undefined);
  assert.deepEqual([d.total, d.feed, d.bend, d.choke, d.chokeZ, d.ratio, d.eps, d.sigma], [82, 3.7, 16, 8, 0.5, 68, 5, 0.001]);
  const n = appModel(byName('RF.Guru EFHW16080'));
  const s160 = MM.analyze(n, 1.85).swr, s80 = MM.analyze(n, 3.65).swr;
  assert.ok(Math.abs(s160 - 4.434) < 0.01 && Math.abs(s80 - 1.869) < 0.01, 'SWR ' + s160.toFixed(3) + ' / ' + s80.toFixed(3));
  // 0.1 m away from the chosen feedpoint (bend on the 16 m cap) the larger SWR is not lower
  const worst = f => { d.feed = f; const v = vm.runInContext('S.model = normalize(clone(' + JSON.stringify(globalThis.rfGuruEfhwInvL('16080')) + ')); numericModel()', app);
    return Math.max(MM.analyze(v, 1.85).swr, MM.analyze(v, 3.65).swr); };
  try { assert.ok(worst(3.6) >= s160 - 1e-6 && worst(3.8) >= s160 - 1e-6, 'best sampled feedpoint'); } finally { d.feed = 3.7; }
});

/* ---------- UI flow ---------- */
function ui(bands, calcFreq = bands[0] || 3.65) {
  const nodes = {}, jobs = [];
  const $ = id => nodes[id] ||= { contains: () => false, innerHTML: '', hidden: false, value: '', checked: false };
  const S = { model: { name: 'm', v: 1, bands }, calcFreq, history: [], dirty: true };
  const ctx = { $, $$: () => [], S, fmt: (x, d = 2) => x.toFixed(d), swrClass: () => 'good',
    numericModel: () => ({ v: S.model.v }), invalidateSweep() {}, validateCells() {}, drawView() {}, renderVars() {}, setStatus() {},
    renderResults() {}, renderReadout() {}, drawPatterns() {}, drawSmith() {}, drawEdPolar() {}, setSweepDefaults() {},
    performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {}, document: {},
    job: msg => new Promise(resolve => jobs.push({ msg, resolve })) };
  vm.runInNewContext(section('let calcTimer', "document.addEventListener('input'") + section('async function calculate', 'const GNAME'), ctx);
  const answer = (i, extra) => jobs[i].resolve(Object.assign({ f: jobs[i].msg.f, R: 50 + jobs[i].msg.f, X: 1, swr: 1 + jobs[i].msg.f / 10, z0: 50, warnings: [], sources: [] }, extra));
  return { ctx, S, $, jobs, answer, flush: () => new Promise(setImmediate) };
}

test('UI: one full calculation also solves the other bands of a multiband model', async () => {
  const { ctx, S, $, jobs, answer, flush } = ui([3.65, 7.1]);
  const run = ctx.calculate();
  answer(0); await flush();
  assert.equal(jobs.length, 2, 'main solve reused for the first band, one more for the second');
  assert.equal(jobs[1].msg.f, 7.1);
  answer(1); await run; await flush();
  assert.deepEqual(plain(S.bandRes.rows.map(r => r.f)), [3.65, 7.1]);
  assert.equal(S.history.length, 1, 'band solves do not flood the results list');
  const box = $('#bandRes');
  assert.equal(box.hidden, false);
  assert.match(box.innerHTML, /3\.65 MHz/); assert.match(box.innerHTML, /7\.1 MHz/); assert.match(box.innerHTML, /1\.71/);
});

test('UI: single-band model: no extra solves and no band strip', async () => {
  const { ctx, S, $, jobs, answer, flush } = ui([], 14.1);
  const run = ctx.calculate(); answer(0); await run; await flush();
  assert.equal(jobs.length, 1);
  assert.equal(S.bandRes, null);
  assert.equal($('#bandRes').hidden, true);
});

test('UI: a model edit clears the band numbers and drops a late band result', async () => {
  const { ctx, S, $, jobs, answer, flush } = ui([3.65, 7.1]);
  const run = ctx.calculate(); answer(0); await flush();
  S.model.v = 2; ctx.changed();
  assert.equal(S.bandRes, null);
  answer(1); await run; await flush();
  assert.equal(S.bandRes, null, 'the 7.1 MHz result belonged to the old model');
  assert.doesNotMatch($('#bandRes').innerHTML, /SWR/);
  const again = ctx.calculate(); await flush();
  answer(2); await flush(); answer(3); await again; await flush();
  assert.deepEqual(plain(S.bandRes.rows.map(r => r.f)), [3.65, 7.1]);
});

test('UI: a band result for an older model is dropped even when the edit comes during the main solve', async () => {
  const { ctx, S, jobs, answer, flush } = ui([3.65, 7.1]);
  const run = ctx.calculate();
  S.model.v = 2; ctx.changed();
  answer(0); await run; await flush();
  assert.equal(jobs.length, 1, 'no band solves for a result that is already out of date');
  assert.equal(S.bandRes, null);
});

test('UI: changing only the calculation frequency keeps the band results without re-solving them', async () => {
  const { ctx, S, $, jobs, answer, flush } = ui([3.65, 7.1]);
  let run = ctx.calculate(); answer(0); await flush(); answer(1); await run; await flush();
  S.calcFreq = 7.1; ctx.changed(false, false);
  assert.ok(S.bandRes, 'still valid');
  run = ctx.calculate(); answer(2); await run; await flush();
  assert.equal(jobs.length, 3, 'only the main solve');
  assert.match($('#bandRes').innerHTML, /class="on"[^>]*data-band="7.1"|data-band="7.1"[^>]*class="on"/);
});

test('UI: live calculations while dragging skip the band solves', async () => {
  const { ctx, S, jobs, answer, flush } = ui([3.65, 7.1]);
  const run = ctx.calculate({ live: true }); answer(0); await run; await flush();
  assert.equal(jobs.length, 1);
  assert.equal(S.bandRes, undefined);
});

test('UI: clicking a band makes it the calculation frequency', () => {
  const { ctx, S, $ } = ui([3.65, 7.1]);
  ctx.renderBands();
  $('#bandRes').onclick({ target: { closest: () => ({ dataset: { band: '7.1' } }) } });
  assert.equal(S.calcFreq, 7.1);
  assert.equal($('#cFreq').value, 7.1);
});

test('index.html has the band strip under the readout', () => {
  assert.match(html, /<div class="bandres" id="bandRes"[^>]*hidden/);
});

/* ---------- H + V pattern view ---------- */
test('pattern menu offers Horizontal + vertical and keeps the other modes', () => {
  const sel = html.match(/<select id="polSel"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...sel.matchAll(/value="(\w+)"/g)].map(m => m[1]), ['tot', 'h', 'v', 'hv', 'all']);
});

test('both EFHW examples open in H + V; no other example sets a pattern view', () => {
  const withPol = EXAMPLES.filter(e => e.pol).map(e => [e.name.slice(0, 17), e.pol]);
  assert.deepEqual(plain(withPol), [['RF.Guru EFHW16080', 'hv'], ['RF.Guru EFHW8040 ', 'hv']]);
  assert.match(section("$('#exampleSel').onchange", "$('#openBtn')"), /if \(ex\.pol\) \$\('#polSel'\)\.value = ex\.pol/);
});

test('H + V draws the H and V columns of the same cuts against the total-field maximum, labelled', () => {
  const calls = [], nodes = {};
  const node = id => nodes[id] ||= { offsetParent: {}, textContent: '', innerHTML: '', value: '' };
  const r = { gain: 3, el: 30, az: 0, fb: 0, f: 3.65, ground: 2,
    cutAz: [[0, 3, 1, 2], [90, 0, -5, -1]], cutEl: [[0, -40, -60, -40], [30, 3, 1, 2], [60, 1, 0.5, -3], [150, 2, -1, 1.5]] };
  const ctx = { S: { last: r, held: null }, css: v => v, prep() {}, drawFF3D() {}, fmt: (x, d = 2) => x.toFixed(d),
    $: id => (id === '#polSel' ? { value: 'hv' } : node(id)), drawPolar: (cv, series, half, ref) => calls.push({ cv, series, half, ref }) };
  vm.runInNewContext(section('function drawPatterns', "$('#polSel').onchange"), ctx);
  ctx.drawPatterns();
  assert.equal(calls.length, 2, 'azimuth and elevation');
  const el = calls[1];
  assert.equal(el.half, true);
  assert.equal(el.ref, 3, 'common 0 dB = the total-field maximum');
  assert.deepEqual(plain(el.series.map(s => s.color)), ['--trace2', '--trace3']);
  assert.deepEqual(plain(el.series[0].pts), r.cutEl.map(p => [p[0], p[2]]), 'H column of the elevation cut');
  assert.deepEqual(plain(el.series[1].pts), r.cutEl.map(p => [p[0], p[3]]), 'V column of the same cut');
  assert.match(node('#elTitle').textContent, /H and V polarization · H max 1\.00 dBi at 30°, V max 2\.00 dBi at 30°/);
  assert.match(node('#patLegend').innerHTML, /Horizontal polarization \(H\)[\s\S]*Vertical polarization \(V\)[\s\S]*0 dB = 3\.00 dBi, the total-field maximum \(common to H and V\)/);
});
