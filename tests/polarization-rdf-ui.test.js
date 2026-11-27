/* Polarization wording, RDF on the dashboard, the editor's far-field views, and where SWR comes from.
 * Run from the repository root:  node --test tests/
 * 1. MM.polarization: the H / V split of the radiated power over all directions (the basis of the label), kept apart
 *    from the theta / phi components toward the maximum, which near the zenith are both horizontal fields in space.
 * 2. EFHW8040 at 3.65 and 7.1 MHz: "Mixed H+V" at both, derived from the pattern (other patterns get other labels).
 * 3. The page: RDF beside F/B with its assumptions, approximate / unavailable / stale treatment, the band strip,
 *    the editor's Total / H / V / H+V far field with one common reference, and the mini cuts that follow it.
 * 4. SWR: from the feed impedance of the coupled solve of every modelled wire, never from the far field; each leg and
 *    the return path move it (sensitivity control), and no display mode can. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine.js'));
require(path.join(ROOT, 'structgen.js'));
require(path.join(ROOT, 'efhwgen.js'));
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
const plain = v => JSON.parse(JSON.stringify(v));

/* ---------- 1. analytical ---------- */
test('polarization: a horizontal dipole in free space radiates 75 % H and 25 % V; mostly H, not mixed, not pure', () => {
  // dipole along X: E_theta ~ sin(el) cos(az), E_phi ~ sin(az)
  const p = MM.polarization(MM.skyGrid(pat((el, az) => 1.5 * (sin(el) * cos(az)) ** 2, (el, az) => 1.5 * sin(az) ** 2), false), { el: 0, az: 90 });
  near(p.share.h, 0.75, 1e-3); near(p.share.v, 0.25, 1e-3); near(p.vMinusH, db(1 / 3), 0.02);
  assert.deepEqual([p.kind, p.pure, p.margin], ['H', false, 3]);
  // toward the maximum (broadside, on the horizon) only H is present, and that field is horizontal in space
  assert.equal(p.peak.vMinusH, null); near(p.peak.hDb, db(1.5), 1e-9); near(p.peak.horizE, 1, 1e-12); assert.equal(p.peak.nearZenith, false);
});

test('polarization: equal H and V power is mixed; one component alone is pure; an empty pattern has no label', () => {
  const mixed = MM.polarization(MM.skyGrid(pat(() => 1, () => 1), true), { el: 20, az: 0 });
  assert.deepEqual([mixed.kind, mixed.pure], ['mixed', false]); near(mixed.share.v, 0.5, 1e-12); near(mixed.vMinusH, 0, 1e-9);
  // 2.9 dB apart: still mixed; 3.1 dB apart: the stronger one is named
  assert.equal(MM.polarization(MM.skyGrid(pat(() => 1, () => 10 ** 0.29), true), { el: 20, az: 0 }).kind, 'mixed');
  assert.equal(MM.polarization(MM.skyGrid(pat(() => 1, () => 10 ** 0.31), true), { el: 20, az: 0 }).kind, 'H');
  const v = MM.polarization(MM.skyGrid(pat(el => 3 * cos(el) ** 2), true), { el: 0, az: 0 });
  assert.deepEqual([v.kind, v.pure, v.vMinusH], ['V', true, null]); near(v.share.v, 1, 1e-12);
  // 20 dB apart counts as one polarization, 19 dB does not
  assert.equal(MM.polarization(MM.skyGrid(pat(() => 100, () => 1), true), { el: 20, az: 0 }).pure, true);
  assert.equal(MM.polarization(MM.skyGrid(pat(() => 79, () => 1), true), { el: 20, az: 0 }).pure, false);
  const none = MM.polarization(MM.skyGrid(pat(() => 0), true), { el: 20, az: 0 });
  assert.deepEqual([none.kind, none.share, none.vMinusH], [null, null, null]);
});

test('polarization toward a maximum near the zenith: the "V" (theta) component is a horizontal field in space', () => {
  // all the power in theta, maximum at 85.5 deg elevation: the old label said "Vertical"
  const p = MM.polarization(MM.skyGrid(pat(el => sin(el) ** 2), true), { el: 85.5, az: 0 });
  assert.equal(p.peak.nearZenith, true);
  near(p.peak.horizE, sin(85.5) ** 2, 1e-12, 'share of the E field that is horizontal in space');
  assert.ok(p.peak.horizE > 0.99);
  assert.equal(p.peak.el, 85.5);
  // at a low angle theta really is close to vertical
  const low = MM.polarization(MM.skyGrid(pat(el => cos(el) ** 2), true), { el: 10, az: 0 });
  assert.equal(low.peak.nearZenith, false); near(low.peak.horizE, sin(10) ** 2, 1e-12);
  assert.throws(() => MM.polarization(MM.skyGrid(pat(() => 1), true), {}), /direction/);
});

/* ---------- 2. the engine on the EFHW8040 ---------- */
const app = vm.createContext({ MM, WMStruct: globalThis.WMStruct, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, clone: o => JSON.parse(JSON.stringify(o)) });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker'), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const appModel = n => { const i = EXAMPLES.findIndex(e => e.name.startsWith(n)); assert.ok(i >= 0, n); return vm.runInContext('S.model = normalize(clone(EXAMPLES[' + i + '])); numericModel()', app); };
const workerSrc = section('const WORKER_SRC = `', '`;\nlet worker').replace('const WORKER_SRC = `', '');
const pack = new Function('self', 'MM', workerSrc + '; return pack;')({ postMessage() {} }, MM);
const swrOf = (s, z0 = 50) => { const g = Math.hypot(s.R - z0, s.X) / Math.hypot(s.R + z0, s.X); return (1 + g) / (1 - g); };

// engine figures: share of the radiated power in H (%), V - H over all directions (dB), V and H toward the maximum (dBi)
const CASES = [
  { ex: 'RF.Guru EFHW8040', f: 3.65, el: 85.5, legacy: 'Vertical', hPct: 61.2, vH: -1.97, pkV: 3.57, pkH: -10.43, zen: true, swr: 2.4507, sky: 7.12, low: 8.73 },
  { ex: 'RF.Guru EFHW8040', f: 7.1, el: 34.75, legacy: 'Horizontal', hPct: 62.9, vH: -2.29, pkV: -3.98, pkH: 1.89, zen: false, swr: 2.4536, sky: 6.64, low: 4.78 },
  { ex: 'RF.Guru EFHW16080', f: 1.85, el: 90, legacy: 'Vertical', hPct: 61.3, vH: -1.99, pkV: 3.92, pkH: -39.97, zen: true, swr: 4.4343, sky: 7.90, low: 10.49 },
  { ex: 'RF.Guru EFHW16080', f: 3.65, el: 53.5, legacy: 'Vertical', hPct: 51.6, vH: -0.28, pkV: 4.07, pkH: -21.86, zen: false, swr: 1.8687, sky: 7.41, low: 7.26 }
];
const packed = {};
for (const c of CASES) {
  test(c.ex + ' at ' + c.f + ' MHz: mixed H+V over all directions; the components toward the maximum are reported apart', () => {
    const model = appModel(c.ex), a = MM.analyze(model, c.f), p = MM.patternSummary(a, model).pol;
    assert.equal(p.kind, 'mixed', 'neither component is 3 dB above the other over the sky');
    near(100 * p.share.h, c.hPct, 0.1, 'H share'); near(p.share.h + p.share.v, 1, 1e-9); near(p.vMinusH, c.vH, 0.03);
    assert.deepEqual([p.peak.el, p.peak.az], [a.el, a.az], 'the direction Max gain refers to');
    near(p.peak.vDb, c.pkV, 0.03); near(p.peak.hDb, c.pkH, 0.03); near(p.peak.vDb, a.gainV, 1e-9); near(p.peak.hDb, a.gainH, 1e-9);
    assert.equal(p.peak.nearZenith, c.zen); assert.equal(a.el, c.el);
    if (c.zen) assert.ok(p.peak.horizE > 0.99, 'overhead the field is horizontal in space whichever component carries it');
    // the solver is untouched: analyze() still reports its larger-component flag, which the page no longer prints
    assert.equal(a.pol, c.legacy);
    near(a.swr, c.swr, 2e-4);
    packed[c.ex + c.f] = pack(model, c.f);
    assert.deepEqual(plain(packed[c.ex + c.f].sum.pol), plain(p), 'pack() carries it');
  });
}

/* ---------- 3. the page ---------- */
const nodeSet = () => { const nodes = {}; const $ = id => nodes[id] ||= { offsetParent: {}, textContent: '', innerHTML: '', title: '', value: '', className: '', checked: true, hidden: false, classList: { on: new Set(), toggle(c, f) { f ? this.on.add(c) : this.on.delete(c); } } }; return { nodes, $ }; };
const fmt = (x, d = 2) => x.toFixed(d);
const helpers = section('function patSummaryHtml', "$('#polSel').onchange");
const pageFns = () => { const ctx = { fmt }; vm.runInNewContext(helpers, ctx); return ctx; };
const cp = o => JSON.parse(JSON.stringify(o));
const R80 = () => packed['RF.Guru EFHW80403.65'], R40 = () => packed['RF.Guru EFHW80407.1'];

test('page: the label is derived, not fixed: mixed, mostly one, one alone, or none', () => {
  const { polLabel } = pageFns();
  assert.equal(polLabel({ kind: 'mixed' }), 'Mixed H+V');
  assert.equal(polLabel({ kind: 'H', pure: false }), 'Mostly H'); assert.equal(polLabel({ kind: 'V', pure: false }), 'Mostly V');
  assert.equal(polLabel({ kind: 'H', pure: true }), 'Horizontal'); assert.equal(polLabel({ kind: 'V', pure: true }), 'Vertical');
  assert.equal(polLabel({ kind: null }), 'n/a'); assert.equal(polLabel(null), 'n/a');
  assert.doesNotMatch(html, /set\('#roPol', r\.pol\)/, 'the larger-component-at-the-maximum flag is no longer the readout');
  assert.doesNotMatch(section('function renderResults', 'const r = S.last'), /r\.pol \+/);
});

function readout(last, dirty) {
  const { nodes, $ } = nodeSet();
  const ctx = { $, $$: () => [], S: { last, dirty: !!dirty }, fmt };
  vm.runInNewContext(helpers + section('function setStatus', '/* ---------------- tables'), ctx);
  ctx.renderReadout();
  return { nodes, ctx };
}

test('page: EFHW8040 shows Mixed H+V on both bands, with what that means and what the maximum looks like', () => {
  assert.ok(R80() && R40(), 'engine cases ran first');
  for (const [r, c] of [[R80(), CASES[0]], [R40(), CASES[1]]]) {
    const { nodes } = readout(r), t = nodes['#roPol'].title;
    assert.equal(nodes['#roPol'].innerHTML, 'Mixed H+V');
    assert.match(nodes['#roPolS'].textContent, new RegExp('^H ' + Math.round(c.hPct) + ' % · V ' + (100 - Math.round(c.hPct)) + ' % of radiated power$'));
    assert.match(t, /all directions/); assert.match(t, /within 3 dB/);
    assert.match(t, new RegExp('Toward the maximum \\(' + c.el.toFixed(1) + '° elevation'));
    assert.match(t, new RegExp('V \\(θ\\) ' + r.gainV.toFixed(2) + ' dBi, H \\(φ\\) ' + r.gainH.toFixed(2) + ' dBi'));
    assert.equal(/both are nearly horizontal fields in space/.test(t), c.zen, 'zenith note only for a maximum near the zenith');
    assert.doesNotMatch(nodes['#roPol'].innerHTML, /Vertical|Horizontal/);
  }
});

test('page: RDF sits beside F/B with its own label, its assumed direction and noise', () => {
  assert.match(html, /id="roFB">–<\/div><\/div>\s*<div class="ro"><div class="k" title="[^"]*">RDF all-sky<\/div><div class="v" id="roRdf">–<\/div><div class="s" id="roRdfS"><\/div><\/div>/);
  for (const [r, c] of [[R80(), CASES[0]], [R40(), CASES[1]]]) {
    const { nodes } = readout(r), t = nodes['#roRdf'].title;
    assert.equal(nodes['#roRdf'].innerHTML, c.sky.toFixed(2) + ' <small>dB</small>');
    assert.equal(nodes['#roRdfS'].textContent, 'low-angle noise ' + c.low.toFixed(2) + ' dB');
    assert.match(t, new RegExp('desired direction: the total-field maximum, ' + r.el.toFixed(1) + '° elevation, ' + r.az.toFixed(1) + '° azimuth'));
    assert.match(t, /whole visible sky, even per solid angle, unpolarized/); assert.match(t, /0–30° elevation/);
    assert.match(t, /not a signal-to-noise prediction/);
    assert.equal(nodes['#roFB'].innerHTML, r.fb.toFixed(1) + ' <small>dB</small>', 'F/B stays');
    assert.equal(nodes['#roSWR'].innerHTML, c.swr.toFixed(2));
  }
});

test('page: approximate, unavailable and empty RDF / polarization are shown as such', () => {
  const ap = cp(R40()); ap.sum.approx = ap.sum.uncertain = true;
  let n = readout(ap).nodes;
  assert.match(n['#roRdf'].innerHTML, /^≈ 6\.64/); assert.match(n['#roRdf'].title, /^Approximate: the currents were solved over a perfect mirror/);
  assert.match(n['#roRdfS'].textContent, /^low-angle noise ≈ 4\.78 dB$/);
  assert.match(n['#roPol'].innerHTML, /^≈ Mixed H\+V$/);
  const co = cp(R40()); co.sum.coarse = co.sum.uncertain = true;
  assert.match(readout(co).nodes['#roRdf'].title, /^Approximate: the main lobe is narrower than the 1° × 4° averaging grid/);
  // no summary (the engine could not make one): not a number, not a dash that looks like "not calculated"
  const no = cp(R40()); no.sum = null;
  n = readout(no).nodes;
  assert.equal(n['#roRdf'].innerHTML, 'n/a'); assert.match(n['#roRdf'].title, /^RDF is not available for this result/);
  assert.equal(n['#roPol'].innerHTML, 'n/a'); assert.equal(n['#roRdfS'].textContent, ''); assert.equal(n['#roPolS'].textContent, '');
  assert.equal(n['#roFB'].innerHTML, no.fb.toFixed(1) + ' <small>dB</small>', 'F/B does not depend on the summary');
  // free space: all-sky only
  const fr = cp(R40()); delete fr.sum.rdf.low; fr.sum.hv = null;
  assert.equal(readout(fr).nodes['#roRdfS'].textContent, '');
  // nothing calculated yet
  n = readout(null).nodes;
  for (const id of ['#roRdf', '#roPol', '#roFB', '#roSWR']) assert.equal(n[id].innerHTML, '–');
});

test('page: a changed model marks the readout stale until the next result', () => {
  assert.match(html, /\.readout\.stale \.v[^{]*\{[^}]*opacity/);
  const { nodes, ctx } = readout(R80(), true);
  ctx.setStatus('stale', 'Press Calculate to update the results.');
  assert.ok(nodes['.readout'].classList.on.has('stale'));
  assert.match(nodes['.readout'].title, /model has changed/);
  ctx.S.dirty = false; ctx.setStatus('ok', '');
  assert.ok(!nodes['.readout'].classList.on.has('stale')); assert.equal(nodes['.readout'].title, '');
  ctx.S.last = null; ctx.S.dirty = true; ctx.setStatus('stale', '');
  assert.ok(!nodes['.readout'].classList.on.has('stale'), 'nothing to be stale before the first result');
});

function bands(rows, calcFreq) {
  const { nodes, $ } = nodeSet();
  const ctx = { $, $$: () => [], S: { model: { name: 'm', bands: [3.65, 7.1] }, calcFreq, bandRes: rows && { rows } }, fmt, swrClass: () => 'good' };
  vm.runInNewContext(section('function renderBands', "$('#bandRes').onclick"), ctx);
  ctx.renderBands();
  return nodes['#bandRes'].innerHTML;
}

test('page: every band shows F/B and RDF beside SWR; the selected band is marked; unsolved bands show nothing stale', () => {
  const h = bands([R80(), R40()], 7.1);
  const btn = f => h.match(new RegExp('<button[^>]*data-band="' + f + '"[^>]*>(.*?)</button>'))[0];
  assert.match(btn(3.65), /SWR <span class="good">2\.45<\/span>/);
  assert.match(btn(3.65), /F\/B 0\.2 dB · RDF 7\.12 dB/); assert.match(btn(7.1), /F\/B 2\.0 dB · RDF 6\.64 dB/);
  assert.match(btn(7.1), /class="on"/); assert.doesNotMatch(btn(3.65), /class="on"/);
  assert.match(h, /RDF: all-sky noise, toward each band’s own maximum/);
  const ap = cp(R40()); ap.sum.uncertain = true; const no = cp(R80()); no.sum = null;
  const h2 = bands([no, ap], 3.65);
  assert.match(h2, /RDF n\/a/); assert.match(h2, /RDF ≈ 6\.64 dB/);
  const h0 = bands(null, 3.65);
  assert.doesNotMatch(h0, /RDF|F\/B|SWR/); assert.match(h0, /Not calculated for the current model yet/);
});

test('page: the Far field tab explains the three things apart: all directions, toward the maximum, wire geometry', () => {
  const { polDetailHtml, wireRuns } = pageFns();
  near(wireRuns(R80().segs).vert, 12.5, 1e-6, 'vertical run'); near(wireRuns(R80().segs).horiz, 28.36 + 4, 1e-6, 'horizontal run');
  const h = polDetailHtml([R80(), R40()]);
  const rows = [...h.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<td>(.*?)<\/td>/g)].map(x => x[1]));
  assert.deepEqual(rows.map(r => r[0]), ['3.650', '7.100']);
  assert.deepEqual(rows.map(r => r[1]), ['Mixed H+V', 'Mixed H+V']);
  assert.equal(rows[0][2], '61 / 39'); assert.equal(rows[1][2], '63 / 37');
  assert.equal(rows[0][4], '85.5° el, 168.8° az'); assert.equal(rows[0][5], '3.57 / -10.43');
  assert.match(rows[0][6], /^99 %/); assert.match(rows[0][6], /near the zenith/); assert.doesNotMatch(rows[1][6], /zenith/);
  assert.match(h, /12\.50 m of vertical run and 32\.36 m of horizontal run/);
  assert.match(h, /not assigned to individual wires/);
  assert.match(h, /θ and φ/);
  assert.equal(polDetailHtml([{ f: 7, sum: null }]), ''); assert.equal(polDetailHtml([null]), '');
  // a pattern with one polarization only keeps its plain name
  const v = cp(R40()); Object.assign(v.sum.pol, { kind: 'V', pure: true, share: { h: 0.001, v: 0.999 }, vMinusH: 30 });
  assert.match(polDetailHtml([v]), /<td>Vertical<\/td>/);
  assert.match(section('<!-- PATTERN -->', '3D pattern'), /<div id="patSum"><\/div>\s*<div id="polDetail"><\/div>/);
  assert.match(section('function drawPatterns', 'function patSummaryHtml'), /\$\('#polDetail'\)\.innerHTML = polDetailHtml\(/);
});

/* ---------- the editor's far field ---------- */
const edSection = section('/* mini far-field plots', '/* ---------------- 3D far field');
function editor(mode, last, dirty) {
  const { nodes, $ } = nodeSet(), calls = [];
  $('#edPol').value = mode;
  const ctx = { $, S: { last, dirty: !!dirty }, css: v => v, prep() {}, fmt, drawView() {}, drawPolar: (cv, series, half, ref) => calls.push({ series, half, ref }) };
  vm.runInNewContext(edSection, ctx);
  return { nodes, ctx, calls };
}

test('editor: the far field can be Total, H, V or H + V, in the colours of the 2D plots', () => {
  const sel = html.match(/<select id="edPol"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(sel, 'a view menu beside the Far field switch');
  assert.deepEqual([...sel[1].matchAll(/value="(\w+)"/g)].map(m => m[1]), ['tot', 'h', 'v', 'hv']);
  const { ctx } = editor('tot', null);
  assert.deepEqual(plain(ctx.lobeLayers('tot')), [{ key: 'tot', color: null }]);
  assert.deepEqual(plain(ctx.lobeLayers('h')), [{ key: 'h', color: '--trace2' }]);
  assert.deepEqual(plain(ctx.lobeLayers('v')), [{ key: 'v', color: '--trace3' }]);
  assert.deepEqual(plain(ctx.lobeLayers('hv')), [{ key: 'h', color: '--trace2' }, { key: 'v', color: '--trace3' }]);
  assert.deepEqual(plain(ctx.lobeLayers('nonsense')), [{ key: 'tot', color: null }]);
  // drawView draws those layers, every one against the total-field maximum
  const dv = section('function drawView', '// wires, coloured by current');
  assert.match(dv, /lobeLayers\(\$\('#edPol'\)\.value\)/);
  assert.match(dv, /ref = S\.last\.gain/);
  assert.match(dv, /edLobeLegendHtml\(/);
});

test('editor: the legend names each surface and the one reference they share; a stale or hidden far field says so', () => {
  const { ctx } = editor('hv', null), r = R80();
  const hv = ctx.edLobeLegendHtml(r, 'hv', false, true);
  assert.match(hv, /var\(--trace2\)[^<]*<\/i>H \(φ\)/); assert.match(hv, /var\(--trace3\)[^<]*<\/i>V \(θ\)/);
  assert.match(hv, /0 dB = 3\.74 dBi, the total-field maximum, for every view/);
  assert.match(hv, /−40 dB at the centre/); assert.match(hv, /3\.650 MHz/);
  assert.doesNotMatch(hv, /model has changed/);
  assert.match(ctx.edLobeLegendHtml(r, 'tot', false, true), /Far field: total \(H \+ V power\)/);
  assert.match(ctx.edLobeLegendHtml(r, 'h', false, true), /Far field: H \(φ\) only/);
  assert.match(ctx.edLobeLegendHtml(r, 'v', false, true), /Far field: V \(θ\) only/);
  assert.match(ctx.edLobeLegendHtml(r, 'v', true, true), /from the last calculation; the model has changed/);
  const ap = cp(r); ap.approx = true;
  assert.match(ctx.edLobeLegendHtml(ap, 'tot', false, true), /≈ approximate pattern/);
  assert.equal(ctx.edLobeLegendHtml(r, 'hv', false, false), ''); assert.equal(ctx.edLobeLegendHtml(null, 'hv', false, true), '');
  assert.match(html, /<div class="legend" id="edLobeLegend"><\/div>/);
});

test('editor: the mini cuts follow the same view, against the same reference', () => {
  const r = R80();
  const col = (cut, c) => cut.map(p => [p[0], p[c]]);
  for (const [mode, want] of [['tot', [['--accent', 1]]], ['h', [['--trace2', 2]]], ['v', [['--trace3', 3]]], ['hv', [['--trace2', 2], ['--trace3', 3]]]]) {
    const { nodes, ctx, calls } = editor(mode, r);
    ctx.drawEdPolar();
    assert.equal(calls.length, 2, 'azimuth and elevation');
    for (const [i, cut] of [[0, r.cutAz], [1, r.cutEl]]) {
      assert.equal(calls[i].ref, r.gain, 'common 0 dB = the total-field maximum');
      assert.deepEqual(plain(calls[i].series.map(s => s.color)), want.map(w => w[0]));
      want.forEach((w, k) => assert.deepEqual(plain(calls[i].series[k].pts), col(cut, w[1])));
    }
    assert.equal(calls[0].half, false); assert.equal(calls[1].half, true);
    assert.match(nodes['#edPolTxt'].textContent, /3\.74 dBi at 85\.5° elevation, 168\.8° azimuth · F\/B 0\.2 dB · RDF all-sky 7\.12 dB/);
  }
  const { nodes, ctx } = editor('hv', null); ctx.drawEdPolar();
  assert.equal(nodes['#edPolTxt'].textContent, '');
  // an example that opens in H + V on the Far field tab opens the editor the same way; the existing switch is kept
  const ex = section("$('#exampleSel').onchange", "$('#openBtn')");
  assert.match(ex, /if \(ex\.pol\) \$\('#polSel'\)\.value = ex\.pol/);
  assert.match(ex, /\$\('#edPol'\)\.value = ex\.pol/);
});

/* ---------- 4. SWR ---------- */
const vary = { vertical: m => { m.wires[0].z2 -= 0.5; m.wires[1].z1 -= 0.5; m.wires[1].z2 -= 0.5; }, horizontal: m => { m.wires[1].x2 -= 0.5; }, 'return': m => { m.wires[2].y2 *= 0.75; } };
for (const f of [3.65, 7.1]) {
  test('SWR at ' + f + ' MHz is the feedpoint of one coupled solve of all three wires, with no far field involved', () => {
    const model = appModel('RF.Guru EFHW8040');
    const res = MM.solve(model, f), s = res.sources[0];
    assert.equal(model.wires.length, 3, 'vertical leg, horizontal leg, return (coax shield)');
    // one solution holds the current on every wire: both legs and the return path carry part of it
    const peakI = [0, 0, 0]; res.mesh.segs.forEach((g, i) => { peakI[g.wire] = Math.max(peakI[g.wire], res.segCur[i].mag); });
    assert.ok(peakI.every(x => x > 0.05 * Math.max(...peakI)), 'current on all three wires: ' + peakI.map(x => x.toExponential(2)).join(', '));
    // solve() never builds a pattern (its result has no gain, pattern or polarization field); analyze() adds one
    // afterwards and reports the same impedance and SWR to the last bit
    assert.deepEqual(Object.keys(res).filter(k => /pat|gain|pol/i.test(k)), []);
    const a = MM.analyze(model, f);
    assert.equal(a.swr, swrOf(s)); assert.equal(a.R, s.R); assert.equal(a.X, s.X);
    assert.equal(pack(model, f).swr, a.swr);
    // sensitivity control: shortening either leg or the return path moves the feed impedance and the SWR
    for (const [name, change] of Object.entries(vary)) {
      const m = cp(model); change(m);
      const t = MM.solve(m, f).sources[0], dZ = Math.hypot(t.R - s.R, t.X - s.X);
      assert.ok(dZ > 1, name + ' wire: feed impedance moved by ' + dZ.toFixed(2) + ' Ω');
      assert.ok(Math.abs(swrOf(t) - a.swr) > 0.05, name + ' wire: SWR ' + a.swr.toFixed(3) + ' -> ' + swrOf(t).toFixed(3));
    }
    // without the return conductor the source sits on a free wire end with nothing to work against: no feedpoint at all
    const lone = cp(model); lone.wires.pop();
    assert.throws(() => MM.solve(lone, f), /No valid source/);
  });
}

test('SWR cannot depend on a display mode: the solve gets the model and the frequency, the views only redraw', () => {
  assert.doesNotMatch(workerSrc, /polSel|edPol|edLobe/, 'the worker never sees a view setting');
  assert.match(workerSrc, /function pack\(model, f\)/);
  assert.match(html, /\$\('#polSel'\)\.onchange = drawPatterns;/);
  assert.match(html, /\$\('#edPol'\)\.onchange = \(\) => \{ drawView\(\); drawEdPolar\(\); \};/);
  assert.match(html, /\$\('#edLobe'\)\.onchange = \(\) => drawView\(\);/);
  // the readout prints the same SWR whatever the view menus say
  const r = R80(), seen = new Set();
  for (const mode of ['tot', 'h', 'v', 'hv']) {
    const { nodes, $ } = nodeSet();
    $('#edPol').value = mode; $('#polSel').value = mode;
    const ctx = { $, $$: () => [], S: { last: r, dirty: false }, fmt };
    vm.runInNewContext(helpers + section('function setStatus', '/* ---------------- tables'), ctx);
    ctx.renderReadout();
    seen.add(nodes['#roSWR'].innerHTML + '|' + nodes['#roZ'].innerHTML);
  }
  assert.deepEqual([...seen], ['2.45|43.3 − j42.6']);
});

test('wording: the SWR label and the help say where SWR comes from, and what H and V mean', () => {
  assert.match(html, /<div class="k" id="roSwrK" title="[^"]*one coupled solution of every modelled wire[^"]*not from the far field[^"]*">SWR 50 Ω<\/div>/);
  assert.match(help, /id="m-swr"/);
  assert.match(help, /one coupled solution of every modelled wire/);
  assert.match(help, /no polarization view changes it/);
  assert.match(help, /Mixed H\+V/); assert.match(help, /within 3 dB/); assert.match(help, /both are nearly horizontal fields in space/);
  assert.match(help, /RDF all-sky/);
  assert.doesNotMatch(help, /Polarization is horizontal or vertical according to which component is larger toward the maximum\./);
  assert.doesNotMatch(help, /the polarization component that is larger there/);
});

test('licence and credits are untouched', () => {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'LICENSE'))).digest('hex'), '6b0382b16279f26ff69014300541967a356a666eb0b91b422f6862f6b7dad17e');
  for (const t of [html, help, fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')]) assert.match(t, /ON9PK Koen Van den Heuvel/);
  const credit = /Contributions by <b><a href="https:\/\/on6ure\.be" target="_blank" rel="noopener">ON6URE<\/a> Joeri Van Dooren<\/b>/;
  assert.match(html, credit); assert.match(help, credit);
  assert.match(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'), /\[ON6URE\]\(https:\/\/on6ure\.be\) Joeri Van Dooren/);
  for (const f of ['engine.js', 'efhwgen.js', 'structgen.js', 'hexgen.js']) assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')[0], /ON9PK Koen Van den Heuvel.*public domain/);
});
