/* H and V peak gains on the readout (engine.js: componentPeak, componentPeaks, patternSummary; index.html: peakReadouts).
 * Run from the repository root:  node --test tests/
 * 1. Analytical patterns: each component's peak is found on its own, in its own direction, off the sampling grid,
 *    and apart from the total-field maximum; the windows clip the search; free space and absent components.
 * 2. The two RF.Guru EFHW inverted-Ls at both bands: pinned engine figures, checked against a dense brute-force search,
 *    with the solver's own Max gain, direction and SWR unchanged.
 * 3. The page: the four tiles, their stated windows and wording (no dominance or propagation claim), ≈, n/a, stale. */
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
const pat = (v, h = () => 0) => ({ gain: (el, az) => { const V = v(el, az), H = h(el, az); return { v: V, h: H, tot: V + H }; } });
// a smooth lobe of height A centred on (el0, az0), by great-circle distance so azimuth wrap and the zenith need no care
const lobe = (A, el0, az0, w = 15) => (el, az) => {
  const c = sin(el) * sin(el0) + cos(el) * cos(el0) * cos(az - az0), d = Math.acos(Math.max(-1, Math.min(1, c))) / R;
  return A * Math.exp(-((d / w) ** 2));
};
const angDist = (a, b) => Math.acos(Math.max(-1, Math.min(1, sin(a.el) * sin(b.el) + cos(a.el) * cos(b.el) * cos(a.az - b.az)))) / R;

/* ---------- 1. analytical ---------- */
test('H and V peaks are found apart, off the 1° × 4° grid, each in its own direction, and apart from the total', () => {
  // V lobe 4 (6.02 dBi) at 12.3° el, 37.7° az; H lobe 2.5 (3.98 dBi) at 71.6° el, 201.3° az: neither on a grid sample
  const V = lobe(4, 12.3, 37.7), H = lobe(2.5, 71.6, 201.3), g = MM.skyGrid(pat(V, H), true), P = MM.componentPeaks(g);
  near(P.v.db, db(4), 2e-3, 'V peak'); near(P.h.db, db(2.5), 2e-3, 'H peak');
  assert.ok(angDist(P.v, { el: 12.3, az: 37.7 }) < 0.3, 'V direction'); assert.ok(angDist(P.h, { el: 71.6, az: 201.3 }) < 0.3, 'H direction');
  // each value is the component itself in the reported direction, not the total there
  near(P.v.g, V(P.v.el, P.v.az), 1e-12); near(P.h.g, H(P.h.el, P.h.az), 1e-12);
  // the total-field maximum is its own figure: it carries the other component's tail, so it is above the V peak
  const T = MM.componentPeak(g, 'tot');
  assert.ok(T.g >= P.v.g * (1 - 1e-6) && T.g >= P.h.g); near(T.db, P.v.db, 1e-3, 'the H lobe is far away, so its tail is tiny');
  // two lobes 20° apart: the total peaks between them, above either component and in neither component's direction
  const V2 = lobe(2, 20, 90), H2 = lobe(2, 40, 90), g2 = MM.skyGrid(pat(V2, H2), true), P2 = MM.componentPeaks(g2), T2 = MM.componentPeak(g2, 'tot');
  near(P2.v.el, 20, 0.3); near(P2.h.el, 40, 0.3); near(P2.v.db, db(2), 0.02); near(P2.h.db, db(2), 0.02);
  near(T2.el, 30, 0.3); assert.ok(T2.db > P2.v.db + 0.5 && T2.db > P2.h.db + 0.5, 'the total is a different, larger figure');
  // windows: V peaks inside 5-30, H inside 60-90, so the window peaks are the full peaks
  assert.deepEqual([P.lowV.el0, P.lowV.el1, P.highH.el0, P.highH.el1], [5, 30, 60, 90]);
  near(P.lowV.db, P.v.db, 1e-9); near(P.highH.db, P.h.db, 1e-9);
  assert.deepEqual(P.windows, { low: [5, 30], high: [60, 90] });
});

test('windows clip the search: a lobe outside its window gives the window edge, never a direction outside it', () => {
  // V peaks at 45° el (above the low window), H at 30° el (below the high window)
  const V = lobe(3, 45, 100), H = lobe(2, 30, 250), P = MM.componentPeaks(MM.skyGrid(pat(V, H), true));
  near(P.v.el, 45, 0.3); near(P.h.el, 30, 0.3);
  assert.equal(P.lowV.el, 30, 'on the upper edge of 5-30'); near(P.lowV.az, 100, 0.5); near(P.lowV.g, V(30, P.lowV.az), 1e-12);
  assert.equal(P.highH.el, 60, 'on the lower edge of 60-90'); near(P.highH.az, 250, 0.5);
  assert.ok(P.lowV.g < P.v.g && P.highH.g < P.h.g);
  near(P.lowV.db, db(3) + db(Math.exp(-((15 / 15) ** 2))), 0.01, 'lobe value 15° off its centre');
  // custom windows travel with the result
  const C = MM.componentPeaks(MM.skyGrid(pat(V, H), true), { low: [0, 20], high: [70, 90] });
  assert.deepEqual([C.lowV.el, C.highH.el, C.windows.low, C.windows.high].map(x => JSON.parse(JSON.stringify(x))), [20, 70, [0, 20], [70, 90]]);
  assert.throws(() => MM.componentPeak(MM.skyGrid(pat(V), true), 'v', 30, 5), /end elevation/);
  assert.throws(() => MM.componentPeak(MM.skyGrid(pat(V), true), 'v', 5.5, 30), /not an elevation/);
  assert.throws(() => MM.componentPeak(MM.skyGrid(pat(V), true), 'x'), /unknown component/);
});

test('horizontal dipole in free space: H 1.76 dBi broadside on the horizon, V 1.76 dBi along the axis overhead; no windows', () => {
  // dipole along X: E_theta ~ sin(el) cos(az), E_phi ~ sin(az); both components reach 1.5 but in different directions
  const P = MM.componentPeaks(MM.skyGrid(pat((el, az) => 1.5 * (sin(el) * cos(az)) ** 2, (el, az) => 1.5 * sin(az) ** 2), false));
  near(P.h.db, db(1.5), 1e-9); assert.equal(P.h.el, -90 + 0, 'every elevation ties at az 90: the lowest sample wins'); assert.equal(P.h.az, 90);
  near(P.v.db, db(1.5), 1e-9); assert.equal(Math.abs(P.v.el), 90); near(cos(P.v.az) ** 2, 1, 1e-12);
  assert.equal(P.lowV, null); assert.equal(P.highH, null, 'the windows are elevations above a ground');
  assert.equal(P.h.el0, -90, 'free space: the whole sphere');
});

test('a component with no power has no peak (null), not a −300 dB number', () => {
  const P = MM.componentPeaks(MM.skyGrid(pat(el => 3 * cos(el) ** 2), true));
  assert.equal(P.h, null); assert.equal(P.highH, null);
  near(P.v.db, db(3), 1e-9); assert.equal(P.v.el, 0); near(P.lowV.db, db(3 * cos(5) ** 2), 1e-9); assert.equal(P.lowV.el, 5);
});

/* ---------- 2. the RF.Guru presets ---------- */
const app = vm.createContext({ MM, WMStruct: globalThis.WMStruct, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29: globalThis.rfGuruEfoc29, clone: o => JSON.parse(JSON.stringify(o)) });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker'), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const appModel = n => { const i = EXAMPLES.findIndex(e => e.name.startsWith(n)); assert.ok(i >= 0, n); return vm.runInContext('S.model = normalize(clone(EXAMPLES[' + i + '])); numericModel()', app); };
const workerSrc = section('const WORKER_SRC = `', '`;\nlet worker').replace('const WORKER_SRC = `', '');
const pack = new Function('self', 'MM', workerSrc + '; return pack;')({ postMessage() {} }, MM);

// [dBi, el, az] of: total max (solver), H peak, V peak, low-angle V 5-30°, high-angle H 60-90°; SWR as before
const CASES = [
  { ex: 'RF.Guru EFHW8040', f: 3.65, tot: [3.739, 85.5, 168.75], h: [3.700, 90, 90.25], v: [3.739, 85.5, 180], lowV: [-2.212, 30, 179.5], highH: [3.700, 90, 90.25], swr: 2.4507 },
  { ex: 'RF.Guru EFHW8040', f: 7.1, tot: [2.890, 34.75, 290], h: [2.018, 38, 65.75], v: [0.429, 73.75, 359.75], lowV: [0.114, 26.75, 181.25], highH: [0.813, 60, 73.5], swr: 2.4536 },
  { ex: 'RF.Guru EFHW16080', f: 1.85, tot: [3.923, 90, 0], h: [3.923, 90, 89.75], v: [3.923, 90, 359.75], lowV: [-4.695, 30, 178.75], highH: [3.923, 90, 89.75], swr: 4.4343 },
  { ex: 'RF.Guru EFHW16080', f: 3.65, tot: [4.084, 53.5, 178], h: [2.776, 40.5, 50.5], v: [4.083, 53.5, 180.25], lowV: [0.978, 30, 179.75], highH: [1.005, 60, 48.5], swr: 1.8687 }
];
const packed = {};
for (const c of CASES) {
  test(c.ex + ' at ' + c.f + ' MHz: H and V peaks over the whole pattern and in the windows, the total unchanged', () => {
    const model = appModel(c.ex), a = MM.analyze(model, c.f), s = MM.patternSummary(a, model), P = s.peaks;
    // the solver's total maximum, direction and SWR are what they were
    near(a.gain, c.tot[0], 1e-3); assert.deepEqual([a.el, a.az], c.tot.slice(1)); near(a.swr, c.swr, 2e-4);
    for (const k of ['h', 'v', 'lowV', 'highH']) {
      near(P[k].db, c[k][0], 1e-3, k + ' dBi'); assert.deepEqual([P[k].el, P[k].az], c[k].slice(1), k + ' direction');
      const comp = k === 'h' || k === 'highH' ? 'h' : 'v';
      near(P[k].g, a.pat.gain(P[k].el, P[k].az)[comp], 1e-12, k + ' is that component in that direction');
      assert.ok(P[k].g <= a.pat.gain(a.el, a.az).tot * (1 + 1e-6) || P[k].g <= 10 ** (a.gain / 10) * 1.001, k + ' not above the total maximum');
    }
    assert.deepEqual([P.lowV.el0, P.lowV.el1, P.highH.el0, P.highH.el1], [5, 30, 60, 90]);
    assert.ok(P.lowV.el >= 5 && P.lowV.el <= 30 && P.highH.el >= 60 && P.highH.el <= 90);
    assert.ok(P.lowV.g <= P.v.g && P.highH.g <= P.h.g, 'a window cannot beat the whole pattern');
    // a dense brute-force search (1° × 1°) does not find a larger value than the refined peaks
    const brute = (comp, e0, e1) => { let m = 0; for (let el = e0; el <= e1; el++) for (let az = 0; az < 360; az++) m = Math.max(m, a.pat.gain(el, az)[comp]); return db(m); };
    assert.ok(P.h.db >= brute('h', 0, 90) - 1e-6, 'H'); assert.ok(P.v.db >= brute('v', 0, 90) - 1e-6, 'V');
    assert.ok(P.lowV.db >= brute('v', 5, 30) - 1e-6, 'low V'); assert.ok(P.highH.db >= brute('h', 60, 90) - 1e-6, 'high H');
    assert.equal(s.uncertain, false);
    packed[c.ex + c.f] = pack(model, c.f);
    assert.deepEqual(JSON.parse(JSON.stringify(packed[c.ex + c.f].sum.peaks)), JSON.parse(JSON.stringify(P)), 'pack() carries the peaks');
    assert.equal(packed[c.ex + c.f].swr, a.swr, 'SWR from the same solve');
  });
}

/* ---------- 3. the page ---------- */
const fmt = (x, d = 2) => x.toFixed(d);
const nodeSet = () => { const nodes = {}; const $ = id => nodes[id] ||= { offsetParent: {}, textContent: '', innerHTML: '', title: '', value: '', className: '', checked: true, hidden: false, classList: { on: new Set(), toggle(c, f) { f ? this.on.add(c) : this.on.delete(c); } } }; return { nodes, $ }; };
const helpers = section('function patSummaryHtml', "$('#polSel').onchange");
function readout(last, dirty) {
  const { nodes, $ } = nodeSet();
  const ctx = { $, $$: () => [], S: { last, dirty: !!dirty }, fmt };
  vm.runInNewContext(helpers + section('function setStatus', '/* ---------------- tables'), ctx);
  ctx.renderReadout();
  return { nodes, ctx };
}
const cp = o => JSON.parse(JSON.stringify(o));
const TILES = ['#roPkH', '#roPkV', '#roLoV', '#roHiH'];

test('page: four peak tiles after Polarization, the total Max gain kept as its own tile', () => {
  assert.match(html, /id="roPolS"><\/div><\/div>\s*<div class="ro"><div class="k" title="[^"]*">H peak<\/div><div class="v" id="roPkH">–<\/div><div class="s" id="roPkHS"><\/div><\/div>\s*<div class="ro"><div class="k" title="[^"]*">V peak<\/div><div class="v" id="roPkV">/);
  assert.match(html, /<div class="k" title="Largest total-field gain[^"]*">Max gain<\/div><div class="v" id="roG">–<\/div><div class="s" id="roGS"><\/div>/);
  assert.match(html, /id="roLoVK" title="[^"]*DX only names the window: no path, propagation or dominance is implied\.">Low-angle V · DX</);
  assert.match(html, /id="roHiHK" title="[^"]*NVIS only names the window: no path, propagation or dominance is implied\.">High-angle H · NVIS</);
  assert.deepEqual(cp(vm.runInNewContext(helpers + '; MM_WINDOWS', { fmt })), cp(MM.PEAK_WINDOWS), 'page fallback windows match the engine');
});

for (const c of CASES) {
  test('page: ' + c.ex + ' at ' + c.f + ' MHz shows each peak with its own direction and window, and no verdict', () => {
    const r = packed[c.ex + c.f]; assert.ok(r, 'engine case ran first');
    const { nodes } = readout(r), P = r.sum.peaks;
    const where = p => (p.el >= 90 ? fmt(p.el, 1) + '° el (zenith)' : fmt(p.el, 1) + '° el, ' + fmt(p.az, 1) + '° az');
    assert.equal(nodes['#roPkH'].innerHTML, fmt(P.h.db, 2) + ' <small>dBi</small>'); assert.equal(nodes['#roPkHS'].textContent, where(P.h));
    assert.equal(nodes['#roPkV'].innerHTML, fmt(P.v.db, 2) + ' <small>dBi</small>'); assert.equal(nodes['#roPkVS'].textContent, where(P.v));
    assert.equal(nodes['#roLoV'].innerHTML, fmt(P.lowV.db, 2) + ' <small>dBi</small>'); assert.equal(nodes['#roLoVS'].textContent, '5–30° window · ' + where(P.lowV));
    assert.equal(nodes['#roHiH'].innerHTML, fmt(P.highH.db, 2) + ' <small>dBi</small>'); assert.equal(nodes['#roHiHS'].textContent, '60–90° window · ' + where(P.highH));
    assert.equal(nodes['#roLoVK'].textContent, 'Low-angle V 5–30° · DX'); assert.equal(nodes['#roHiHK'].textContent, 'High-angle H 60–90° · NVIS');
    // Max gain stays the total, toward its own maximum
    assert.equal(nodes['#roG'].innerHTML, fmt(r.gain, 2) + ' <small>dBi</small>');
    assert.equal(nodes['#roGS'].textContent, 'total H+V · ' + fmt(r.el, 1) + '° el, ' + fmt(r.az, 1) + '° az');
    for (const id of TILES) {
      const t = nodes[id].title, all = nodes[id].innerHTML + nodes[id + 'S'].textContent + t;
      assert.match(t, /searched for this component on its own/); assert.match(t, /Max gain is a different figure: the total field/);
      assert.doesNotMatch(all, /dominant|favoured|stronger|better|good for|works|will reach/i, 'no verdict or propagation claim');
    }
    assert.match(nodes['#roLoV'].title, /^DX names this window only\. Largest V \(θ\) gain over 5–30° elevation, all azimuths/);
    assert.match(nodes['#roHiH'].title, /^NVIS names this window only\. Largest H \(φ\) gain over 60–90° elevation, all azimuths/);
    assert.match(nodes['#roLoV'].title, /not a statement that a DX path exists or that one component dominates: the ionosphere is not modelled/);
    assert.match(nodes['#roHiH'].title, /not a statement that an NVIS path exists or that one component dominates/);
    assert.match(nodes['#roPkH'].title, /whole visible pattern, horizon to zenith/);
    assert.equal(/edge of the window/.test(nodes['#roLoV'].title), P.lowV.el === 30 || P.lowV.el === 5);
    assert.equal(/edge of the window/.test(nodes['#roHiH'].title), P.highH.el === 60, 'the zenith is not an edge');
    assert.equal(/every azimuth is the same direction/.test(nodes['#roPkH'].title), P.h.el === 90);
    // SWR, F/B and RDF untouched by the new tiles
    near(+nodes['#roSWR'].innerHTML, c.swr, 0.006); assert.equal(nodes['#roFB'].innerHTML, fmt(r.fb, 1) + ' <small>dB</small>');
  });
}

test('page: approximate, free space, absent, unavailable and not-yet-calculated peaks', () => {
  const base = packed['RF.Guru EFHW80407.1'];
  const ap = cp(base); ap.sum.approx = ap.sum.uncertain = true;
  let n = readout(ap).nodes;
  for (const id of TILES) { assert.match(n[id].innerHTML, /^≈ -?\d/); assert.match(n[id].title, /^Approximate: the currents were solved over a perfect mirror/); }
  const fr = cp(base); fr.sum.hasGround = false; fr.sum.peaks.lowV = fr.sum.peaks.highH = null; fr.sum.peaks.h.el0 = -90;
  n = readout(fr).nodes;
  assert.match(n['#roPkH'].innerHTML, /dBi/); assert.match(n['#roPkH'].title, /full sphere \(free space\)/);
  for (const id of ['#roLoV', '#roHiH']) { assert.equal(n[id].innerHTML, 'n/a'); assert.equal(n[id + 'S'].textContent, 'needs a ground'); assert.match(n[id].title, /free space/); }
  const ab = cp(base); ab.sum.peaks.h = null; ab.sum.peaks.highH = null;
  n = readout(ab).nodes;
  assert.equal(n['#roPkH'].innerHTML, 'none'); assert.equal(n['#roPkHS'].textContent, 'no H power');
  assert.equal(n['#roHiHS'].textContent, 'no H power in 60–90°'); assert.match(n['#roPkV'].innerHTML, /dBi/);
  const no = cp(base); no.sum = null;
  n = readout(no).nodes;
  for (const id of TILES) { assert.equal(n[id].innerHTML, 'n/a'); assert.match(n[id].title, /^Not available for this result/); }
  assert.equal(n['#roG'].innerHTML, fmt(no.gain, 2) + ' <small>dBi</small>', 'Max gain does not depend on the summary');
  n = readout(null).nodes;
  for (const id of TILES.concat(['#roG'])) assert.equal(n[id].innerHTML, '–');
  for (const id of TILES) assert.equal(n[id + 'S'].textContent, '');
  assert.equal(n['#roGS'].textContent, '');
});

test('page: the peak tiles dim with the rest of the strip when the model changes', () => {
  assert.match(html, /\.readout\.stale \.v, \.readout\.stale \.s \{[^}]*opacity/);
  const { nodes, ctx } = readout(packed['RF.Guru EFHW80403.65'], true);
  ctx.setStatus('stale', '');
  assert.ok(nodes['.readout'].classList.on.has('stale'));
  assert.match(section('<section class="readout"', '</section>'), /id="roHiH"/, 'inside the strip that is dimmed');
});
