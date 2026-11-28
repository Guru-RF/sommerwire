/* The two angle-window tiles of the readout and the NVIS naming rule
 * (engine.js: componentPeaks; index.html: lowBandPlan, lowBandOf, angleKeys, peakReadouts, patSummaryHtml).
 * Run from the repository root:  node --test tests/
 * 1. Engine: H and V peaks in both windows come from the one shared search, each inside its window.
 * 2. Highlight: H for a mostly-H result, V for a mostly-V one, neither for Mixed H+V, always from the polarization
 *    class of that result (r.sum.pol.kind), never from the angle, the band or the larger number.
 * 3. NVIS name: only inside the amateur bands 160, 80, 60, 40 and 30 m of the selected band plan, edges included;
 *    not between them, not above 30 m, not in free space. The figures stay on show everywhere.
 * 4. A change of the selected band (the result on show) moves the name and the highlight, also while the far field
 *    of the new band is pending. Absent patterns, components and summaries.
 * 5. SWR, F/B, RDF and Max gain are what they were. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine.js'));
const MM = globalThis.MM;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const help = fs.readFileSync(path.join(ROOT, 'help.html'), 'utf8');
function section(start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i);
  assert.ok(i >= 0 && j > i, 'section ' + start);
  return html.slice(i, j);
}
const R = Math.PI / 180, sin = d => Math.sin(d * R), cos = d => Math.cos(d * R), db = x => 10 * Math.log10(x);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' got ' + a + ', expected ' + b + ' ± ' + tol);
const pat = (v, h = () => 0) => ({ gain: (el, az) => { const V = v(el, az), H = h(el, az); return { v: V, h: H, tot: V + H }; } });
const lobe = (A, el0, az0, w = 15) => (el, az) => {
  const c = sin(el) * sin(el0) + cos(el) * cos(el0) * cos(az - az0), d = Math.acos(Math.max(-1, Math.min(1, c))) / R;
  return A * Math.exp(-((d / w) ** 2));
};
const fmt = (x, d = 2) => x.toFixed(d), cp = o => JSON.parse(JSON.stringify(o));

/* the page helpers and renderReadout, in a sandbox with a settable band-plan menu */
const helpers = section('function patSummaryHtml', "$('#polSel').onchange");
function page(region) {
  const nodes = {}, $ = id => nodes[id] ||= { offsetParent: {}, textContent: '', innerHTML: '', title: '', value: '', className: '', classList: { on: new Set(), toggle(c, f) { f ? this.on.add(c) : this.on.delete(c); } } };
  if (region != null) $('#swRegion').value = String(region);
  const ctx = { $, $$: () => [], S: { last: null, dirty: false }, fmt };
  vm.runInNewContext(helpers + section('function setStatus', '/* ---------------- tables'), ctx);
  return { nodes, ctx, show(r) { ctx.S.last = r; ctx.renderReadout(); return nodes; } };
}
// a result as pack() makes it, from an analytical pattern over ground (or in free space)
function result(f, p, o = {}) {
  const ground = o.ground == null ? 2 : o.ground, T = MM.componentPeak(MM.skyGrid(p, ground > 0), 'tot') || { el: 20, az: 0, db: -300 };
  const a = { pat: p, el: T.el, az: T.az, approx: !!o.approx };
  return { f, R: 50, X: 0, swr: 1.23, z0: 50, gain: T.db, fb: 4.5, el: T.el, az: T.az, ground, approx: !!o.approx, sum: MM.patternSummary(a, { ground: { type: ground } }) };
}
// 6 dB (H) and 10 dB (V) apart over all directions: named, not pure; equal power: mixed
const MOSTLY_H = pat(lobe(0.5, 20, 40, 40), lobe(2, 25, 200, 40));
const MOSTLY_V = pat(lobe(3, 15, 90, 40), lobe(0.3, 70, 10, 40));
const MIXED = pat(lobe(2, 18, 90, 40), lobe(2, 75, 270, 40));
const spans = h => [...h.matchAll(/<span( class="(\w+)")?>([HV]) ([^<]*)<\/span>/g)].map(m => ({ c: m[3], cls: m[2] || '', val: m[4] }));

/* ---------- 1. engine ---------- */
test('engine: H and V peaks in both windows, each inside its window, from the same search as the existing ones', () => {
  // V lobe at 12° (in the low window) with a tail into the high one; H lobe at 75° with a tail into the low one
  const V = lobe(4, 12, 40, 30), H = lobe(2.5, 75, 200, 30), g = MM.skyGrid(pat(V, H), true), P = MM.componentPeaks(g);
  for (const [k, c, w] of [['lowV', 'v', [5, 30]], ['lowH', 'h', [5, 30]], ['highH', 'h', [60, 90]], ['highV', 'v', [60, 90]]]) {
    assert.deepEqual(cp(P[k]), cp(MM.componentPeak(g, c, w[0], w[1])), k + ' is componentPeak of that window');
    assert.ok(P[k].el >= w[0] && P[k].el <= w[1]); near(P[k].g, (c === 'v' ? V : H)(P[k].el, P[k].az), 1e-12);
  }
  assert.equal(P.lowH.el, 30, 'the H tail peaks on the upper edge of the low window'); assert.equal(P.highV.el, 60, 'the V tail on the lower edge of the high one');
  assert.ok(P.lowH.g < P.h.g && P.highV.g < P.v.g);
  // free space: no windows at all; a missing component: null in both windows
  const F = MM.componentPeaks(MM.skyGrid(pat(V, H), false));
  assert.deepEqual([F.lowV, F.lowH, F.highH, F.highV], [null, null, null, null]);
  const O = MM.componentPeaks(MM.skyGrid(pat(el => 3 * cos(el) ** 2), true));
  assert.deepEqual([O.lowH, O.highH], [null, null]); assert.ok(O.lowV && O.highV);
  assert.deepEqual(cp(MM.PEAK_WINDOWS), { low: [5, 30], high: [60, 90] }, 'the windows are the existing angle bands');
  assert.equal(MM.PEAK_WINDOWS.low, MM.ANGLE_BANDS.low); assert.equal(MM.PEAK_WINDOWS.high, MM.ANGLE_BANDS.high);
});

/* ---------- 2. highlight ---------- */
test('mostly H: H highlighted in both windows, V dimmed but shown', () => {
  const r = result(3.65, MOSTLY_H), n = page().show(r), P = r.sum.peaks;
  assert.deepEqual([r.sum.pol.kind, r.sum.pol.pure], ['H', false]);
  for (const [id, pH, pV] of [['#roLo', P.lowH, P.lowV], ['#roHi', P.highH, P.highV]]) {
    assert.deepEqual(spans(n[id].innerHTML), [{ c: 'H', cls: 'hl', val: fmt(pH.db, 2) }, { c: 'V', cls: 'dim', val: fmt(pV.db, 2) }]);
    assert.match(n[id].innerHTML, / <small>dBi<\/small>$/); assert.equal(n[id].className, 'v two');
    assert.match(n[id + 'S'].textContent, /^Mostly H: H highlighted · H \d/);
    assert.match(n[id].title, /Highlighted: H \(φ\), because the modelled polarization of this antenna at 3\.650 MHz is Mostly H \(H \d+ %, V \d+ % of the radiated power over all directions\); the other component stays on show\./);
    assert.match(n[id].title, /The highlight follows this model at this frequency; it is not a rule about which polarization these angles need\./);
  }
});

test('mostly V and pure vertical: V highlighted; an absent H reads none', () => {
  const r = result(7.1, MOSTLY_V), n = page().show(r), P = r.sum.peaks;
  assert.deepEqual([r.sum.pol.kind, r.sum.pol.pure], ['V', false]);
  assert.deepEqual(spans(n['#roLo'].innerHTML), [{ c: 'H', cls: 'dim', val: fmt(P.lowH.db, 2) }, { c: 'V', cls: 'hl', val: fmt(P.lowV.db, 2) }]);
  assert.deepEqual(spans(n['#roHi'].innerHTML).map(x => x.cls), ['dim', 'hl']);
  assert.match(n['#roLoS'].textContent, /^Mostly V: V highlighted · /);
  const m = result(7.1, pat(el => 3 * cos(el) ** 2)), q = page().show(m);
  assert.deepEqual([m.sum.pol.kind, m.sum.pol.pure], ['V', true]);
  assert.deepEqual(spans(q['#roLo'].innerHTML), [{ c: 'H', cls: 'dim', val: 'none' }, { c: 'V', cls: 'hl', val: fmt(m.sum.peaks.lowV.db, 2) }]);
  assert.match(q['#roLoS'].textContent, /^Vertical: V highlighted · H no power · V 5\.0° el/);
  assert.match(q['#roLo'].title, /H \(φ\): no power in this window\./);
});

test('mixed H+V: both shown alike, neither highlighted, and the tile says so', () => {
  const r = result(3.65, MIXED), n = page().show(r), P = r.sum.peaks;
  assert.equal(r.sum.pol.kind, 'mixed');
  for (const [id, pH, pV] of [['#roLo', P.lowH, P.lowV], ['#roHi', P.highH, P.highV]]) {
    assert.deepEqual(spans(n[id].innerHTML), [{ c: 'H', cls: '', val: fmt(pH.db, 2) }, { c: 'V', cls: '', val: fmt(pV.db, 2) }]);
    assert.doesNotMatch(n[id].innerHTML, /class=/);
    assert.match(n[id + 'S'].textContent, /^Mixed H\+V: neither highlighted · H /);
    assert.match(n[id].title, /Neither is highlighted: the modelled polarization of this antenna at 3\.650 MHz is Mixed H\+V \(H \d+ %, V \d+ %[^)]*\), so both are shown alike\./);
  }
});

test('the highlight follows the polarization class of the result, not the larger figure in the window', () => {
  // V carries most of the power (all of it above 30°); inside 5-30° H is 10 dB above V. Class: Mostly V, so V is highlighted.
  const r = result(3.65, pat(el => (el > 30 ? 10 : 0.1), () => 1)), n = page().show(r), P = r.sum.peaks;
  assert.equal(r.sum.pol.kind, 'V'); assert.ok(P.lowH.db - P.lowV.db > 9);
  assert.deepEqual(spans(n['#roLo'].innerHTML).map(x => x.cls), ['dim', 'hl']);
  // and the same pattern is highlighted the same way at any frequency: no band or angle rule
  for (const f of [1.85, 14.2, 28.5]) assert.deepEqual(spans(page().show(Object.assign(cp(r), { f }))['#roLo'].innerHTML).map(x => x.cls), ['dim', 'hl']);
  assert.match(section('function peakReadouts', '// vertical and horizontal extent'), /kind = pol && pol\.kind, hl = kind === 'H' \? 'h' : kind === 'V' \? 'v' : null/);
});

/* ---------- 3. the NVIS name ---------- */
const hiKey = (f, region, p = MIXED) => page(region).show(result(f, p))['#roHiK'].textContent;
test('NVIS is named only inside the 160, 80, 60, 40 and 30 m bands of the band plan, edges included', () => {
  const IN = [[1.81, '160 m'], [2.0, '160 m'], [3.5, '80 m'], [3.8, '80 m'], [5.3515, '60 m'], [5.3665, '60 m'], [7.0, '40 m'], [7.2, '40 m'], [10.1, '30 m'], [10.15, '30 m']];
  for (const [f, b] of IN) assert.equal(hiKey(f, 1), 'High-angle 60–90° · NVIS ' + b, f + ' MHz');
  // just outside an edge, between the bands (not amateur allocations), and every band above 30 m
  for (const f of [1.8, 1.8099, 2.0001, 3.4999, 3.8001, 4.5, 5.0, 5.3514, 5.3666, 6.0, 6.9999, 7.2001, 9.0, 10.0999, 10.1501, 14.0, 14.2, 18.1, 21.2, 24.9, 28.5, 50.1, 145])
    assert.equal(hiKey(f, 1), 'High-angle 60–90°', f + ' MHz');
  // the low-angle tile keeps its name at every frequency
  for (const f of [1.85, 4.5, 14.2]) assert.equal(page(1).show(result(f, MIXED))['#roLoK'].textContent, 'Low-angle 5–30° · DX');
});

test('the band plan decides the edges: Regions 2 and 3, and a missing menu falls back to Region 1', () => {
  assert.equal(hiKey(1.8, 2), 'High-angle 60–90° · NVIS 160 m'); assert.equal(hiKey(1.8, 3), 'High-angle 60–90° · NVIS 160 m');
  assert.equal(hiKey(3.9, 1), 'High-angle 60–90°'); assert.equal(hiKey(3.9, 3), 'High-angle 60–90° · NVIS 80 m'); assert.equal(hiKey(3.95, 3), 'High-angle 60–90°');
  assert.equal(hiKey(4.0, 2), 'High-angle 60–90° · NVIS 80 m'); assert.equal(hiKey(7.25, 1), 'High-angle 60–90°'); assert.equal(hiKey(7.25, 2), 'High-angle 60–90° · NVIS 40 m');
  assert.equal(hiKey(5.34, 1), 'High-angle 60–90°'); assert.equal(hiKey(5.34, 2), 'High-angle 60–90° · NVIS 60 m');
  assert.equal(hiKey(3.65, null), 'High-angle 60–90° · NVIS 80 m'); assert.equal(hiKey(3.65, 9), 'High-angle 60–90° · NVIS 80 m');
  const ctx = {}; vm.runInNewContext(helpers + '; plan = lowBandPlan(); none = [lowBandOf(NaN), lowBandOf(undefined)]', ctx);
  assert.deepEqual(cp(ctx.plan.bands.map(b => b[2])), ['160m', '80m', '60m', '40m', '30m'], 'the page works without a menu (tests, worker)');
  assert.equal(ctx.plan.text, 'IARU Region 1: 160 m 1.810–2.000, 80 m 3.500–3.800, 60 m 5.3515–5.3665, 40 m 7.000–7.200, 30 m 10.100–10.150 MHz');
  assert.deepEqual(cp(ctx.none), [null, null]);
  // one band table for the sweep and for the name
  assert.equal(html.match(/const HAM_BANDS = /g).length, 1);
  assert.match(html, /\$\('#swRegion'\)\.onchange = \(\) => \{ fillRangeOptions\(\); updateSweepControls\(\); drawSweep\(\); renderReadout\(\); drawPatterns\(\); \};/);
});

test('high-angle tile: says what it is and is not, in a band and outside one; the figures are shown either way', () => {
  const r = result(3.65, MOSTLY_H), n = page(1).show(r), t = n['#roHi'].title;
  assert.match(t, /^NVIS names this window only, and only inside the amateur bands from 160 m to 30 m \(IARU Region 1: 160 m 1\.810–2\.000, 80 m 3\.500–3\.800, 60 m 5\.3515–5\.3665, 40 m 7\.000–7\.200, 30 m 10\.100–10\.150 MHz\); 3\.650 MHz is in the 80 m band\. /);
  assert.match(t, /gain over 60–90° elevation, all azimuths/);
  assert.match(t, /a high-angle antenna figure for the elevations a local or regional skywave \(near-vertical incidence\) path would use\./);
  assert.match(t, /It is not a propagation prediction: the ionosphere is not modelled, so no coverage is promised\./);
  assert.match(t, /It is not ground wave either, which travels along the ground and not through this window\./);
  assert.match(n['#roHiS'].textContent, / · skywave angles, not ground wave or coverage$/);
  const o = page(1).show(Object.assign(cp(r), { f: 14.2 })), u = o['#roHi'].title;
  assert.equal(o['#roHi'].innerHTML, n['#roHi'].innerHTML, 'same figures, same highlight');
  assert.match(u, /^Not called NVIS: 14\.200 MHz is outside the amateur bands from 160 m to 30 m \(IARU Region 1: [^)]*\), the only frequencies where this window gets that name; the frequencies between those bands are not amateur allocations\. /);
  assert.match(u, /It is not a propagation prediction/); assert.match(u, /It is not ground wave either/);
  assert.match(o['#roHiS'].textContent, / · no NVIS name outside the 160–30 m amateur bands$/);
  assert.match(page(1).show(Object.assign(cp(r), { f: 4.5 }))['#roHi'].title, /^Not called NVIS: 4\.500 MHz is outside the amateur bands/);
  // the low-angle tile makes no NVIS or skywave statement, and neither tile claims a path, coverage or a verdict
  assert.doesNotMatch(n['#roLo'].title + n['#roLoS'].textContent, /NVIS|skywave/);
  assert.match(n['#roLo'].title, /^DX names this window only\. .*a low-angle antenna figure\. It is not a statement that a DX path exists: the ionosphere is not modelled\./);
  for (const x of [n, o]) for (const id of ['#roLo', '#roHi'])
    assert.doesNotMatch(x[id].innerHTML + x[id + 'S'].textContent + x[id].title, /dominant|dominates|favoured|stronger|better|good for|works|will reach|guarantee/i);
});

test('Far field summary: NVIS wording only for rows inside the 160–30 m bands', () => {
  const sum = (rows, region) => { const p = page(region); return p.ctx.patSummaryHtml(rows); };
  const a = result(3.65, MOSTLY_H), b = result(14.2, MOSTLY_H), c = result(7.1, MIXED);
  const both = sum([a, b], 1);
  assert.match(both, /The high band is a high-angle antenna figure: how much the pattern sends upward\. At 3\.650 MHz \(80 m\), inside the amateur bands from 160 m to 30 m, it holds the angles a near-vertical \(NVIS\) local or regional skywave path would use: a candidate figure, not a propagation prediction, since the ionosphere is not modelled; it is not ground wave and promises no coverage\. The other rows lie outside those bands and are not called NVIS\. /);
  const low = sum([a, c], 1);
  assert.match(low, /At 3\.650 MHz \(80 m\), 7\.100 MHz \(40 m\), inside the amateur bands/); assert.doesNotMatch(low, /The other rows lie outside/);
  const high = sum([b], 1);
  assert.match(high, /No row lies inside the amateur bands from 160 m to 30 m \(IARU Region 1: [^)]*MHz\), so it is not called NVIS here; it is not a propagation prediction either\./);
  assert.doesNotMatch(high, /near-vertical/);
  assert.match(sum([Object.assign(cp(a), { f: 3.9 })], 1), /No row lies inside/); assert.match(sum([Object.assign(cp(a), { f: 3.9 })], 3), /At 3\.900 MHz \(80 m\)/);
  // free space: no angle bands, so no high-band wording at all
  assert.doesNotMatch(sum([result(3.65, MOSTLY_H, { ground: 0 })], 1), /NVIS|high band/);
});

/* ---------- 4. selected band, pending far field, absent patterns ---------- */
test('changing the selected band moves the NVIS name and the highlight with the result on show', () => {
  const p = page(1), r80 = result(3.65, MOSTLY_H), r40 = result(7.1, MIXED), r20 = result(14.2, MOSTLY_V);
  let n = p.show(r80);
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 80 m'); assert.deepEqual(spans(n['#roHi'].innerHTML).map(x => x.cls), ['hl', 'dim']);
  n = p.show(r40);
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 40 m'); assert.deepEqual(spans(n['#roHi'].innerHTML).map(x => x.cls), ['', '']);
  assert.match(n['#roLoS'].textContent, /^Mixed H\+V: neither highlighted/); assert.match(n['#roHi'].title, /7\.100 MHz is in the 40 m band/);
  n = p.show(r20);
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90°'); assert.deepEqual(spans(n['#roHi'].innerHTML).map(x => x.cls), ['dim', 'hl']);
  assert.deepEqual(spans(n['#roLo'].innerHTML).map(x => x.cls), ['dim', 'hl']); assert.match(n['#roHi'].title, /^Not called NVIS: 14\.200 MHz/);
  n = p.show(r80);
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 80 m'); assert.match(n['#roLoS'].textContent, /^Mostly H: H highlighted/);
  // a change of band plan with the same result on show
  p.nodes['#swRegion'].value = '3'; n = p.show(Object.assign(cp(r80), { f: 3.85 }));
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 80 m');
  p.nodes['#swRegion'].value = '1'; p.ctx.renderReadout();
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90°');
});

test('staged rendering: while the far field of a new band is pending, the name already follows its frequency', () => {
  const p = page(1), z = f => ({ stage: 'z', f, R: 50, X: 0, swr: 1.5, z0: 50 });
  let n = p.show(result(3.65, MOSTLY_H));
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 80 m');
  n = p.show(z(14.2));
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90°', 'no NVIS name left over from the previous band');
  assert.equal(n['#roLoK'].textContent, 'Low-angle 5–30° · DX');
  for (const id of ['#roLo', '#roHi']) { assert.equal(n[id].innerHTML, '…'); assert.equal(n[id].className, 'v pending'); assert.equal(n[id + 'S'].textContent, ''); assert.match(n[id].title, /Computing the far field/); }
  assert.equal(n['#roSWR'].innerHTML, '1.50', 'impedance and SWR are there at once');
  n = p.show(z(7.1));
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 40 m');
  n = p.show(Object.assign(z(7.1), { detailError: 'boom' }));
  for (const id of ['#roLo', '#roHi']) { assert.equal(n[id].innerHTML, 'n/a'); assert.match(n[id].title, /not available: boom/); }
  n = p.show(null);
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90°'); assert.equal(n['#roLoK'].textContent, 'Low-angle 5–30° · DX');
  for (const id of ['#roLo', '#roHi']) { assert.equal(n[id].innerHTML, '–'); assert.equal(n[id].className, 'v'); assert.equal(n[id + 'S'].textContent, ''); assert.equal(n[id].title, ''); }
});

test('absent patterns: no summary, an empty pattern, an empty window, free space', () => {
  const base = result(3.65, MOSTLY_H);
  // no summary at all
  let n = page(1).show(Object.assign(cp(base), { sum: null }));
  for (const id of ['#roLo', '#roHi']) { assert.equal(n[id].innerHTML, 'n/a'); assert.equal(n[id].className, 'v'); assert.match(n[id].title, /^Not available for this result/); assert.equal(n[id + 'S'].textContent, ''); }
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90° · NVIS 80 m', 'the name is about the frequency, not about the figure');
  // a pattern that radiates nothing: no class, no figure, no unit, no highlight
  const none = result(3.65, pat(() => 0)); n = page(1).show(none);
  assert.equal(none.sum.pol.kind, null);
  for (const id of ['#roLo', '#roHi']) {
    assert.equal(n[id].innerHTML, '<span>H none</span> · <span>V none</span>');
    assert.match(n[id + 'S'].textContent, /^no polarization class: neither highlighted · H no power · V no power/);
    assert.match(n[id].title, /Neither is highlighted: no polarization class could be made for this result\./);
  }
  // power only above the low window: the low tile has neither component, the high tile both
  const up = result(3.65, pat(el => (el >= 45 ? 1 : 0), el => (el >= 45 ? 3 : 0))); n = page(1).show(up);
  assert.deepEqual(spans(n['#roLo'].innerHTML), [{ c: 'H', cls: 'hl', val: 'none' }, { c: 'V', cls: 'dim', val: 'none' }]);
  assert.doesNotMatch(n['#roLo'].innerHTML, /dBi/); assert.match(n['#roHi'].innerHTML, /dBi/);
  // approximate pattern: marked once, in front
  const ap = cp(base); ap.sum.approx = ap.sum.uncertain = true; n = page(1).show(ap);
  for (const id of ['#roLo', '#roHi']) { assert.match(n[id].innerHTML, /^≈ <span class="hl">H /); assert.match(n[id].title, /^Approximate: the currents were solved over a perfect mirror/); }
  // free space: the windows need a ground, and no NVIS name is given
  const fr = result(3.65, MOSTLY_H, { ground: 0 }); n = page(1).show(fr);
  assert.equal(fr.sum.hasGround, false);
  for (const id of ['#roLo', '#roHi']) { assert.equal(n[id].innerHTML, 'n/a'); assert.equal(n[id + 'S'].textContent, 'needs a ground'); }
  assert.equal(n['#roHiK'].textContent, 'High-angle 60–90°');
  assert.match(n['#roPkH'].innerHTML, /dBi/, 'the whole-pattern peaks are still given');
});

/* ---------- 5. nothing else moved ---------- */
test('SWR, Max gain, F/B, RDF and polarization tiles are unchanged by the window tiles', () => {
  const r = result(3.65, MOSTLY_H), n = page(1).show(r), s = r.sum;
  assert.equal(n['#roSWR'].innerHTML, '1.23'); assert.equal(n['#roSwrK'].textContent, 'SWR 50 Ω'); assert.equal(n['#roZ'].innerHTML, '50.0 + j0.0');
  assert.equal(n['#roG'].innerHTML, fmt(r.gain, 2) + ' <small>dBi</small>'); assert.equal(n['#roFB'].innerHTML, '4.5 <small>dB</small>');
  assert.equal(n['#roRdf'].innerHTML, fmt(s.rdf.sky.rdf, 2) + ' <small>dB</small>'); assert.equal(n['#roRdfS'].textContent, 'low-angle noise ' + fmt(s.rdf.low.rdf, 2) + ' dB');
  assert.equal(n['#roPol'].innerHTML, 'Mostly H'); assert.equal(n['#roEl'].innerHTML, fmt(r.el, 1) + '<small>°</small>');
  assert.equal(n['#roPkH'].innerHTML, fmt(s.peaks.h.db, 2) + ' <small>dBi</small>'); assert.equal(n['#roPkV'].innerHTML, fmt(s.peaks.v.db, 2) + ' <small>dBi</small>');
  // the same figures at another frequency: only the names of the window tiles depend on it
  const o = page(1).show(Object.assign(cp(r), { f: 21.2 }));
  for (const id of ['#roSWR', '#roG', '#roFB', '#roRdf', '#roPol', '#roPkH', '#roPkV', '#roLo', '#roHi']) assert.equal(o[id].innerHTML, n[id].innerHTML, id);
  // the page asks the engine for nothing new: the tiles read the summary that pack() already carries
  assert.doesNotMatch(section('function peakReadouts', '// vertical and horizontal extent'), /MM\.|analyze|solve\(/);
});

test('markup and help: two wide tiles with their windows; the help states the rule and the band ranges', () => {
  const strip = section('<section class="readout"', '</section>');
  assert.match(strip, /<div class="ro wide"><div class="k" id="roLoK" title="[^"]*">Low-angle 5–30° · DX<\/div><div class="v" id="roLo">–<\/div><div class="s" id="roLoS"><\/div><\/div>/);
  assert.match(strip, /<div class="ro wide"><div class="k" id="roHiK" title="[^"]*">High-angle 60–90°<\/div><div class="v" id="roHi">–<\/div><div class="s" id="roHiS"><\/div><\/div>/);
  assert.doesNotMatch(html, /roLoV|roHiH/);
  assert.match(html, /\.ro \.v \.hl \{[^}]*font-weight/); assert.match(html, /\.ro \.v \.dim \{/);
  assert.match(help, /id="m-windows"/);
  assert.match(help, /160 m 1\.810–2\.000, 80 m 3\.500–3\.800, 60 m 5\.3515–5\.3665, 40 m 7\.000–7\.200 and 30 m 10\.100–10\.150 MHz/);
  assert.match(help, /not ground wave/); assert.match(help, /not a propagation prediction/);
});
