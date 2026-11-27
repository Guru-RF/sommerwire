/* Regression test for the RF.Guru EFOC29 built-in example (rfGuruEfoc29 in efhwgen.js).
 * Run from the repository root:  node --test tests/
 * Checks the sourced dimensions (29 m radiator, 4:1, ~12 m coax return ended by the choke), that the assumed geometry
 * and the limitations are labelled in the comment, that no wire touches the soil (Sommerfeld, no perfect-mirror
 * fallback), the ideal 4:1 ratio, and pins the modelled SWR at the seven default band frequencies. These SWRs are the
 * model's figures for the stated assumptions (ideal unun and choke, untrimmed 29 m); they are not measurements. */
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
const { rfGuruEfoc29, RFGURU_EFOC29 } = globalThis;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function section(start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i);
  assert.ok(i >= 0 && j > i, 'section ' + start);
  return html.slice(i, j);
}
const app = vm.createContext({ MM, WMStruct: globalThis.WMStruct, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29, clone: o => JSON.parse(JSON.stringify(o)) });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker'), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const idx = EXAMPLES.findIndex(e => e.name.startsWith('RF.Guru EFOC29'));
const appModel = () => vm.runInContext('S.model = normalize(clone(EXAMPLES[' + idx + '])); numericModel()', app);
const len = w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1, w.z2 - w.z1);

const BANDS = [3.6, 7.1, 14.175, 18.118, 21.225, 24.94, 28.5];
// modelled SWR (50 Ω side of the ideal 4:1) for the assumed geometry; see efhwgen.js
const SWR = { 3.6: 2.580, 7.1: 2.865, 14.175: 3.131, 18.118: 1.527, 21.225: 5.881, 24.94: 8.944, 28.5: 2.841 };

test('EFOC29: in the Examples menu from efhwgen.js, multiband, opens in H + V', () => {
  assert.ok(idx >= 0);
  assert.match(html, /Object\.assign\(rfGuruEfoc29\(\), \{ pol: 'hv' \}\)/);
  assert.equal(EXAMPLES[idx].pol, 'hv');
  assert.deepEqual(JSON.parse(JSON.stringify(EXAMPLES[idx].bands)), BANDS);
  assert.equal(EXAMPLES[idx].freq, 3.6, 'starts on 80 m at the guide\'s 3.6 MHz target');
});

test('EFOC29: sourced 29 m radiator, 4:1, ~12 m return path to an ideal choke boundary', () => {
  const m = rfGuruEfoc29(), n = appModel();
  assert.deepEqual([RFGURU_EFOC29.total, RFGURU_EFOC29.ratio, RFGURU_EFOC29.choke], [29, 4, 12]);
  assert.equal(m.sources.length, 1); assert.equal(m.sources[0].pos, 'w1b'); assert.equal(n.sources[0].ratio, 4);
  assert.equal(n.wires.length, 2);
  const [rad, sh] = n.wires;
  assert.deepEqual(rfGuruEfoc29.ROLES, ['radiator', 'return']);
  assert.ok(Math.abs(len(rad) - 29) < 1e-9, 'radiator 29 m, untrimmed');
  assert.equal(rad.z1, 8); assert.equal(rad.z2, 8, 'flat top at the assumed 8 m (7–8 m reference installation)');
  assert.ok(Math.abs(len(sh) - 12) < 1e-3, 'return = 12 m of shield exterior');
  assert.deepEqual([sh.x1, sh.y1, sh.z1], [rad.x1, rad.y1, rad.z1], 'return starts at the feedpoint');
  assert.equal(Math.min(sh.z1, sh.z2), 2, 'choke end at the assumed 2 m');
  assert.equal(n.loads.length, 0, 'no choke impedance: the open end of wire 2 is the ideal boundary');
  for (const w of n.wires) assert.ok(Math.min(w.z1, w.z2) > 0.25, 'every wire clear of the soil');
  assert.deepEqual([m.ground.type, m.ground.eps, m.ground.sigma], [2, 5, 0.001]);
});

test('EFOC29: provenance, assumptions and limitations are in the comment; no measured claim', () => {
  const c = rfGuruEfoc29().comment;
  assert.match(c, /https:\/\/shop\.rf\.guru\/products\/efoc29/);
  assert.match(c, /https:\/\/shop\.rf\.guru\/pages\/efoc29-antenna-installation-guide/);
  assert.match(c, /Assumed, not published/);
  assert.match(c, /ideal boundary/);
  assert.match(c, /ideal lossless transformer/);
  assert.match(c, /Not modelled:/);
  assert.match(c, /not a guarantee/);
  assert.match(c, /No measured SWR or match is implied/);
  for (const f of BANDS) assert.ok(c.includes(String(f)), f + ' MHz stated');
});

for (const f of BANDS) {
  test('EFOC29 at ' + f + ' MHz: Sommerfeld (no fallback), Z primary = Z antenna / 4, SWR ' + SWR[f], () => {
    const n = appModel(), res = MM.solve(n, f), s = res.sources[0];
    assert.equal(res.mirrorMix, false, 'no perfect-mirror fallback');
    assert.ok(!res.warnings.some(w => /touching the ground/i.test(w)));
    for (const v of [s.R, s.X, s.Rant, s.Xant]) assert.ok(Number.isFinite(v));
    assert.ok(Math.abs(s.Rant / s.R - 4) < 1e-9 && Math.abs(s.Xant / s.X - 4) < 1e-9, 'ideal 4:1');
    const a = MM.analyze(n, f);
    assert.equal(a.approx, false);
    assert.ok(Math.abs(a.swr - SWR[f]) < 0.01, 'SWR ' + a.swr.toFixed(4));
  });
}

test('the maintainer\'s own EFOC29 flat-top example is left as it was', () => {
  const k = EXAMPLES.find(e => e.name === 'EFOC29 end-fed, flat top at 8 m');
  assert.ok(k);
  assert.equal(k.freq, 3.6); assert.equal(k.bands, undefined); assert.equal(k.pol, undefined);
  assert.equal(k.sources[0].ratio, 4); assert.deepEqual([k.ground.eps, k.ground.sigma], [13, 0.005]);
  assert.doesNotMatch(k.comment, /rf\.guru/i);
});
