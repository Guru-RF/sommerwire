/* Angle-aware H / V summary and RDF (engine.js: skyGrid, bandStats, angleSummary, rdf, patternSummary; index.html: patSummaryHtml).
 * Run from the repository root:  node --test tests/
 * 1. Analytical patterns with closed-form answers: solid-angle weighting, linear-power averaging, both RDF backgrounds,
 *    the dominance margin, and the guards (bad input, empty pattern, lobes the grid misses, non-physical power).
 * 2. The two RF.Guru EFHW inverted-L examples at both of their bands: the engine's own figures, with a verdict
 *    asserted only where the engine finds one. Neither is V-dominant at low angles; two of the four cases have no verdict.
 * 3. The page: pack() carries the summary, and the table prints a verdict only where there is one. */
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
const R = Math.PI / 180, sin = d => Math.sin(d * R), cos = d => Math.cos(d * R), db = x => 10 * Math.log10(x);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' got ' + a + ', expected ' + b + ' ± ' + tol);
// analytical pattern: v(el, az) and h(el, az) in linear gain
const pat = (v, h = () => 0) => ({ gain: (el, az) => { const V = v(el, az), H = h(el, az); return { v: V, h: H, tot: V + H }; } });
const ground = p => MM.skyGrid(p, true), free = p => MM.skyGrid(p, false);

/* ---------- analytical ---------- */
test('solid angle of a band is exact; a constant gain averages to itself', () => {
  const g = ground(pat(() => 0.7, () => 0.3));
  for (const [a, b] of [[0, 90], [5, 30], [60, 90], [0, 30]]) {
    const s = MM.bandStats(g, a, b);
    near(s.sr, 2 * Math.PI * (sin(b) - sin(a)), 1e-12, 'solid angle');
    near(s.integral.tot, s.sr, 1e-12, 'integral of 1');
    near(s.mean.v, 0.7, 1e-12); near(s.mean.h, 0.3, 1e-12);
  }
  near(MM.bandStats(free(pat(() => 1)), -90, 90).sr, 4 * Math.PI, 1e-12, 'full sphere');
});

test('means are weighted by solid angle, not by elevation', () => {
  // G = sin(el): solid-angle mean over the hemisphere is 1/2; an unweighted mean over elevation would be 2/pi
  near(MM.bandStats(ground(pat(el => sin(el))), 0, 90).mean.tot, 0.5, 1e-4);
  // G = sin^2(el) over 5-30 deg: (sin^3 b - sin^3 a) / (3 (sin b - sin a))
  near(MM.bandStats(ground(pat(() => 0, el => sin(el) ** 2)), 5, 30).mean.h, (sin(30) ** 3 - sin(5) ** 3) / (3 * (sin(30) - sin(5))), 1e-4);
});

test('means are of linear power, not of dB', () => {
  // 20 dBi over half the azimuths, 0 dBi over the other half: 10 log10(50.5) = 17.03 dBi, not the 10 dBi a dB mean gives
  const s = MM.angleSummary(ground(pat((el, az) => (az < 180 ? 100 : 1))));
  near(s.low.meanDb.v, db(50.5), 1e-9); near(s.high.meanDb.tot, db(50.5), 1e-9);
  assert.ok(Math.abs(s.low.meanDb.v - 10) > 7);
});

test('RDF all-sky equals directivity for patterns with a known one', () => {
  // isotropic in free space: 0 dB; isotropic over the hemisphere above ground: 3.01 dB by the 4 pi convention, 0 dB against the hemisphere mean
  near(MM.rdf(free(pat(() => 1)), { desired: { el: 0, az: 0 } }).rdf, 0, 1e-9);
  near(MM.rdf(ground(pat(() => 1)), { desired: { el: 20, az: 0 } }).rdf, db(2), 1e-9);
  near(MM.rdf(ground(pat(() => 1)), { desired: { el: 20, az: 0 }, ref: 'domain' }).rdf, 0, 1e-9);
  // short dipole in free space, 1.5 cos^2(el): 1.76 dB; short monopole over perfect ground, 3 cos^2(el): 4.77 dB
  near(MM.rdf(free(pat(el => 1.5 * cos(el) ** 2)), { desired: { el: 0, az: 0 } }).rdf, db(1.5), 1e-3);
  const mono = ground(pat(el => 3 * cos(el) ** 2)), r = MM.rdf(mono, { desired: { el: 0, az: 90 } });
  near(r.rdf, db(3), 1e-3); near(r.mean, 1, 1e-4, 'lossless: mean gain 1');
  assert.deepEqual([r.domain, r.ref, r.pol], [[0, 90], '4pi', 'tot']);
  // losses cancel: half the gain everywhere, same RDF
  near(MM.rdf(ground(pat(el => 1.5 * cos(el) ** 2)), { desired: { el: 0, az: 90 } }).rdf, r.rdf, 1e-9);
  // off the maximum the desired direction counts: toward 60 deg elevation cos^2 = 1/4, 6.02 dB less
  near(MM.rdf(mono, { desired: { el: 60, az: 0 } }).rdf, db(3) - db(4), 1e-3);
});

test('RDF backgrounds differ: low-angle noise is the mean over 0-30 deg only', () => {
  const mono = ground(pat(el => 3 * cos(el) ** 2)), d = { desired: { el: 0, az: 0 } };
  // mean of 3 cos^2 over 0-30 deg = 3 (1 - sin^2(30)/3) = 2.75
  const low = MM.rdf(mono, Object.assign({}, MM.RDF_BACKGROUNDS.low, d));
  near(low.mean, 2.75, 5e-4); near(low.rdf, db(3 / 2.75), 1e-3);
  assert.deepEqual([low.domain, low.ref], [[0, 30], 'domain']);
  assert.ok(MM.rdf(mono, d).rdf - low.rdf > 4, 'all-sky and low-angle figures are different quantities');
  // noise polarization: a pattern that is V at low angles and H elsewhere hears no H-polarized low-angle noise
  const split = ground(pat(el => (el <= 30 ? 1 : 0), el => (el > 30 ? 1 : 0)));
  assert.equal(MM.rdf(split, Object.assign({}, MM.RDF_BACKGROUNDS.low, d, { domain: [0, 29], pol: 'h' })).rdf, null);
  near(MM.rdf(split, Object.assign({}, MM.RDF_BACKGROUNDS.low, d, { domain: [0, 29], pol: 'v' })).rdf, 0, 1e-9);
});

test('V or H dominance and high or low favour need the margin; below it nothing is claimed', () => {
  const s = k => MM.angleSummary(ground(pat(() => k, () => 1)));
  assert.equal(s(1).low.dominant, null); near(s(1).low.vMinusH, 0, 1e-9);
  assert.equal(s(1.9).low.dominant, null, '2.79 dB');
  assert.equal(s(2.1).low.dominant, 'V', '3.22 dB');
  assert.equal(s(1 / 1.9).low.dominant, null);
  assert.equal(s(1 / 2.1).low.dominant, 'H');
  assert.equal(MM.angleSummary(ground(pat(() => 1.9, () => 1)), { margin: 2 }).low.dominant, 'V', 'margin is an option');
  const f = k => MM.angleSummary(ground(pat(el => (el >= 45 ? k : 1))));
  assert.equal(f(1).favoured, null); assert.equal(f(1.9).favoured, null);
  assert.equal(f(2.1).favoured, 'high'); assert.equal(f(1 / 2.1).favoured, 'low');
  near(f(2.1).highMinusLow, db(2.1), 1e-9);
  assert.deepEqual([MM.ANGLE_BANDS.low, MM.ANGLE_BANDS.high, MM.ANGLE_BANDS.margin], [[5, 30], [60, 90], 3]);
});

test('high band: peaks are located, and the horizontal share of the field is geometric', () => {
  // only V (theta) everywhere: over 60-90 deg its E field is still horizontal for (1 - sin^3(60)) / (3 (1 - sin 60)) of the power
  const s = MM.angleSummary(ground(pat(() => 1)));
  near(s.high.horizE, (1 - sin(60) ** 3) / (3 * (1 - sin(60))), 1e-4);
  assert.ok(s.high.horizE > 0.75, 'never below sin^2(60 deg)');
  assert.equal(s.high.dominant, undefined, 'no V/H verdict is derived near the zenith');
  near(MM.angleSummary(ground(pat(() => 0, () => 1))).high.horizE, 1, 1e-12);
  const p = MM.angleSummary(ground(pat((el, az) => Math.exp(-(((el - 72) / 10) ** 2) - (((az - 120) / 40) ** 2)))));
  assert.deepEqual([p.high.peak.tot.el, p.high.peak.tot.az], [72, 120]);
});

test('guards: bad input is refused, an empty pattern gives no figure', () => {
  const g = ground(pat(() => 1));
  assert.throws(() => MM.rdf(g, {}), /desired direction/);
  assert.throws(() => MM.rdf(g, { desired: { el: -5, az: 0 } }), /outside the pattern/);
  assert.throws(() => MM.rdf(g, { desired: { el: 10, az: 0 }, domain: [0, 30] }), /whole visible sky/);
  assert.throws(() => MM.rdf(g, { desired: { el: 10, az: 0 }, pol: 'x' }), /polarization/);
  assert.throws(() => MM.bandStats(g, 5.5, 30), /not an elevation of the sky grid/);
  assert.throws(() => MM.bandStats(g, 30, 30), /above the start/);
  assert.throws(() => MM.bandStats(g, -10, 30), /not an elevation/);
  assert.throws(() => MM.skyGrid(pat(() => NaN), true), /not finite/);
  assert.throws(() => MM.skyGrid(pat(() => -1), true), /not finite/);
  assert.throws(() => MM.skyGrid(pat(() => 1), true, { de: 7 }), /divide/);
  const none = ground(pat(() => 0)), s = MM.angleSummary(none);
  assert.equal(MM.rdf(none, { desired: { el: 10, az: 0 } }).rdf, null);
  assert.deepEqual([s.low.dominant, s.low.vMinusH, s.favoured, s.highMinusLow], [null, null, null, null]);
  // only V at low angles: V - H has no finite value, so no figure is given; V is the only component there
  const onlyV = MM.angleSummary(ground(pat(() => 1)));
  assert.deepEqual([onlyV.low.vMinusH, onlyV.low.dominant], [null, 'V']);
  assert.deepEqual(MM.angleSummary(ground(pat(() => 0, () => 1))).low.dominant, 'H');
});

test('patternSummary flags approximate patterns: mirror currents, lobes the grid misses, power above the input', () => {
  const sum = (p, el, az, approx) => MM.patternSummary({ pat: p, el, az, approx }, { ground: { type: 2 } });
  const mono = pat(el => 3 * cos(el) ** 2);
  const ok = sum(mono, 0, 0, false);
  assert.deepEqual([ok.approx, ok.coarse, ok.overUnity, ok.uncertain], [false, false, false, false]);
  near(ok.rdf.sky.rdf, db(3), 1e-3); near(ok.rdf.low.rdf, db(3 / 2.75), 1e-3); near(ok.skyPower, 1, 1e-4);
  assert.deepEqual(ok.desired, { el: 0, az: 0 });
  assert.deepEqual([ok.hv.low.dominant, ok.hv.low.vMinusH], ['V', null], 'V only');
  const mm = sum(mono, 0, 0, true);
  assert.deepEqual([mm.approx, mm.uncertain], [true, true]);
  // a 1 deg wide lobe between the samples: the grid's largest sample is far below the maximum
  const needle = pat((el, az) => 1e-3 + 100 * Math.exp(-(((el - 20.5) / 0.3) ** 2) - (((az - 2) / 0.6) ** 2)));
  const nd = sum(needle, 20.5, 2, false);
  assert.deepEqual([nd.coarse, nd.uncertain], [true, true]);
  const hot = sum(pat(() => 2.2), 30, 0, false);
  near(hot.skyPower, 1.1, 1e-9); assert.deepEqual([hot.overUnity, hot.uncertain], [true, true]);
  // free space: all-sky RDF only, no ground-referenced bands
  const fs0 = MM.patternSummary({ pat: pat(el => 1.5 * cos(el) ** 2), el: 0, az: 0, approx: false }, { ground: { type: 0 } });
  assert.equal(fs0.hv, null); assert.equal(fs0.rdf.low, undefined); near(fs0.rdf.sky.rdf, db(1.5), 1e-3);
  assert.deepEqual(fs0.rdf.sky.domain, [-90, 90]);
});

/* ---------- the engine on real models ---------- */
const app = vm.createContext({ MM, WMStruct: globalThis.WMStruct, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29: globalThis.rfGuruEfoc29, clone: o => JSON.parse(JSON.stringify(o)) });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker'), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const appModel = n => { const i = EXAMPLES.findIndex(e => e.name.startsWith(n)); assert.ok(i >= 0, n); return vm.runInContext('S.model = normalize(clone(EXAMPLES[' + i + '])); numericModel()', app); };
// pack() as the worker and the main-thread fallback run it
const pack = new Function('self', 'MM', section('const WORKER_SRC = `', '`;\nlet worker').replace('const WORKER_SRC = `', '') + '; return pack;')({ postMessage() {} }, MM);

/* Engine figures (dB), soil er 5, 1 mS/m, as the examples ship. vH: low-angle mean V minus mean H; hl: high minus low mean total.
 * dom / fav: the verdict, null where the difference is under the 3 dB margin. No case is V-dominant at low angles. */
const CASES = [
  { ex: 'RF.Guru EFHW16080', f: 1.85, lowV: -11.02, lowH: -7.31, vH: -3.71, dom: 'H', high: 3.22, hl: 8.99, fav: 'high', sky: 7.90, low: 10.49, el: 90 },
  { ex: 'RF.Guru EFHW16080', f: 3.65, lowV: -6.83, lowH: -4.32, vH: -2.51, dom: null, high: -0.29, hl: 2.10, fav: null, sky: 7.41, low: 7.26, el: 53.5 },
  { ex: 'RF.Guru EFHW8040', f: 3.65, lowV: -9.08, lowH: -5.91, vH: -3.17, dom: 'H', high: 3.21, hl: 7.41, fav: 'high', sky: 7.12, low: 8.73, el: 85.5 },
  { ex: 'RF.Guru EFHW8040', f: 7.1, lowV: -4.49, lowH: -3.81, vH: -0.68, dom: null, high: -0.37, hl: 0.76, fav: null, sky: 6.64, low: 4.78, el: 34.75 }
];
const packed = {};
for (const c of CASES) {
  test(c.ex + ' at ' + c.f + ' MHz: angle summary and RDF, verdicts only where the margin is met', () => {
    const model = appModel(c.ex), a = MM.analyze(model, c.f), s = MM.patternSummary(a, model), h = s.hv;
    assert.deepEqual([s.approx, s.coarse, s.overUnity, s.uncertain], [false, false, false, false], 'Sommerfeld solve, resolved pattern');
    near(h.low.meanDb.v, c.lowV, 0.03, 'low V'); near(h.low.meanDb.h, c.lowH, 0.03, 'low H'); near(h.low.vMinusH, c.vH, 0.03, 'V - H');
    near(h.high.meanDb.tot, c.high, 0.03, 'high total'); near(h.highMinusLow, c.hl, 0.03, 'high - low');
    assert.equal(h.low.dominant, c.dom); assert.equal(h.favoured, c.fav);
    assert.notEqual(h.low.dominant, 'V', 'low-angle radiation of this inverted-L is not V-dominant');
    assert.equal(h.low.dominant !== null, Math.abs(h.low.vMinusH) >= 3); assert.equal(h.favoured !== null, Math.abs(h.highMinusLow) >= 3);
    assert.ok(h.high.horizE > 0.75 && h.high.horizE <= 1);
    // RDF: desired direction is the total-field maximum that Max gain reports
    assert.deepEqual(s.desired, { el: a.el, az: a.az }); assert.equal(a.el, c.el);
    near(s.rdf.sky.rdf, c.sky, 0.03, 'RDF all-sky'); near(s.rdf.low.rdf, c.low, 0.03, 'RDF low-angle');
    near(s.rdf.sky.rdf, a.gain - s.rdf.sky.meanDb, 1e-9, 'RDF = max gain - mean gain');
    // the mean over the sky is the radiated share of the input power: below 1 on lossy soil, and equal to the
    // engine's independent midpoint-rule integral (2 x 5 deg)
    assert.ok(s.skyPower > 0.2 && s.skyPower < 1); near(s.skyPower, a.pat.powerRatio(), 0.002 * s.skyPower, 'power integral');
    // existing figures unchanged in meaning: gain is the total-field maximum, F/B its ratio to the opposite azimuth at the same elevation
    const front = a.pat.gain(a.el, a.az), back = a.pat.gain(a.el, (a.az + 180) % 360);
    near(a.gain, db(front.tot), 1e-9); near(a.fb, db(front.tot / back.tot), 1e-9);
    assert.ok(a.fb < 2.5, 'F/B stays small for these antennas and is reported as it is');
    const p = packed[c.ex + c.f] = pack(model, c.f);
    assert.deepEqual(JSON.parse(JSON.stringify(p.sum)), JSON.parse(JSON.stringify(s)), 'pack() carries the same summary');
    assert.equal(p.fb, a.fb, 'F/B retained');
  });
}

test('a wire on real ground switches to mirror currents: the summary is marked approximate', () => {
  const model = { wires: [{ x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 10, r: 0.001, seg: -1 }], sources: [{ pos: 'w1b', phase: 0, mag: 1, ratio: 1 }], loads: [], tls: [],
    seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 }, ground: { type: 2, height: 0, eps: 13, sigma: 0.005, nf: 'sommerfeld' }, material: 1, z0: 50 };
  const a = MM.analyze(model, 7.1), s = MM.patternSummary(a, model);
  assert.equal(a.approx, true);
  assert.deepEqual([s.approx, s.uncertain], [true, true]);
  assert.equal(s.hv.low.dominant, 'V', 'a ground-mounted vertical is V-dominant at low angles');
});

/* ---------- the page ---------- */
const sumHtml = (rows) => { const ctx = { fmt: (x, d = 2) => x.toFixed(d) }; vm.runInNewContext(section('function patSummaryHtml', "$('#polSel').onchange"), ctx); return ctx.patSummaryHtml(rows); };
const cells = h => [...h.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<td>(.*?)<\/td>/g)].map(x => x[1]));

test('page: the table gives both bands, labels gain, F/B and RDF, and prints a verdict only where there is one', () => {
  for (const ex of ['RF.Guru EFHW16080', 'RF.Guru EFHW8040']) {
    const cs = CASES.filter(c => c.ex === ex), rows = cs.map(c => packed[c.ex + c.f]);
    assert.ok(rows.every(Boolean), 'engine cases ran first');
    const h = sumHtml(rows), t = cells(h);
    assert.equal(t.length, 2, 'one row per band');
    cs.forEach((c, i) => {
      assert.equal(t[i].length, 11);
      assert.equal(t[i][0], c.f.toFixed(3));
      assert.equal(t[i][3], rows[i].fb.toFixed(1), 'F/B kept');
      assert.match(t[i][6], c.dom ? new RegExp(c.dom + ' dominant$') : /neither dominates$/);
      assert.match(t[i][8], c.fav ? new RegExp(c.fav + ' angles favoured$') : /neither favoured$/);
      assert.doesNotMatch(t[i].join('|'), /V dominant|≈/);
      assert.equal(t[i][9], rows[i].sum.rdf.sky.rdf.toFixed(2)); assert.equal(t[i][10], rows[i].sum.rdf.low.rdf.toFixed(2));
    });
    assert.match(h, /Low 5–30° mean V \/ H dBi/); assert.match(h, /High 60–90° total mean \/ peak dBi/);
    assert.match(h, /RDF all-sky dB/); assert.match(h, /RDF low-angle noise dB/);
    assert.match(h, /<b>Max gain<\/b> is the largest total-field gain/);
    assert.match(h, /<b>F\/B<\/b> compares it with the direction 180° away in azimuth at the same elevation/);
    assert.match(h, /candidate figure, not a propagation prediction/);
    assert.match(h, /mean of linear power weighted by solid angle/);
    assert.match(h, /only for a difference of at least 3 dB; otherwise neither is claimed/);
    assert.match(h, /not comparable in absolute value/);
    assert.doesNotMatch(h, /approximate:/);
  }
});

test('page: approximate summaries are marked, free-space models get RDF only, results without a summary print nothing', () => {
  const base = packed['RF.Guru EFHW80407.1'], cp = o => JSON.parse(JSON.stringify(o));
  const ap = cp(base); ap.sum.approx = ap.sum.uncertain = true;
  const h = sumHtml([ap]), t = cells(h)[0];
  assert.match(t[4], /^≈ /); assert.match(t[7], /^≈ /); assert.match(t[9], /^≈ /); assert.match(t[10], /^≈ /);
  assert.match(h, /≈ approximate:<\/b> the currents were solved over a perfect mirror/);
  const co = cp(base); co.sum.coarse = co.sum.uncertain = true;
  assert.match(sumHtml([co]), /main lobe is narrower than the 1° × 4° averaging grid/);
  const fr = cp(base); fr.sum.hv = null; delete fr.sum.rdf.low;
  const hf = sumHtml([fr]);
  assert.equal(cells(hf)[0].length, 5); assert.doesNotMatch(hf, /NVIS|low-angle noise|H \/ V/);
  assert.equal(sumHtml([{ f: 7, gain: 1, fb: 0, el: 1, az: 1 }]), '');
  assert.equal(sumHtml([null]), '');
});

test('page: readout and results labels say what gain and F/B measure; F/B stays; the summary sits on the Far field tab', () => {
  assert.match(html, /<div class="k" title="Largest total-field gain[^"]*">Max gain<\/div><div class="v" id="roG">/);
  assert.match(html, /<div class="k" title="Front-to-back: the total-field maximum against the direction 180° away in azimuth at the same elevation\.[^"]*">F\/B<\/div><div class="v" id="roFB">/);
  assert.match(html, /<th title="[^"]*">Max gain dBi<\/th><th title="[^"]*">F\/B dB<\/th>/);
  assert.match(section('<!-- PATTERN -->', '3D pattern'), /<div id="patSum"><\/div>/);
  assert.match(section('function pack', 'let worker'), /sum = MM\.patternSummary\(a, model\)/);
  // the other bands redraw the summary when they arrive, and only rows of the current model are shown
  assert.match(section('async function calcBands', 'function renderBands'), /renderBands\(\);\n  drawPatterns\(\);/);
});

test('page: drawPatterns shows every solved band of the current model, else only the latest result', () => {
  const nodes = {}, node = id => nodes[id] ||= { offsetParent: {}, textContent: '', innerHTML: '', value: '' };
  const a = packed['RF.Guru EFHW80403.65'], b = packed['RF.Guru EFHW80407.1'];
  const S = { last: a, held: null, bandRes: { rows: [a, b] } };
  const ctx = { S, css: v => v, prep() {}, drawFF3D() {}, drawPolar() {}, fmt: (x, d = 2) => x.toFixed(d), $: id => (id === '#polSel' ? { value: 'hv' } : node(id)) };
  vm.runInNewContext(section('function drawPatterns', "$('#polSel').onchange"), ctx);
  ctx.drawPatterns();
  assert.deepEqual(cells(node('#patSum').innerHTML).map(r => r[0]), ['3.650', '7.100']);
  S.bandRes = null; ctx.drawPatterns();
  assert.deepEqual(cells(node('#patSum').innerHTML).map(r => r[0]), ['3.650']);
  S.bandRes = { rows: [b] }; ctx.drawPatterns();
  assert.deepEqual(cells(node('#patSum').innerHTML).map(r => r[0]), ['3.650'], 'band rows that do not include this frequency are not mixed in');
  S.last = null; ctx.drawPatterns();
  assert.equal(node('#patSum').innerHTML, '');
});
