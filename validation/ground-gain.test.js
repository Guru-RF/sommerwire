const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
require('../engine.js');
const { MM } = globalThis;
const frequency = 14.05;
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const worker = html.match(/const WORKER_SRC = `([\s\S]*?)`;/)[1];

function model(type, nf, contact) {
  const wires = [{ x1: 0, y1: -5.17, z1: 1, x2: 0, y2: 5.17, z2: 1, r: 0.001, seg: 40 }];
  if (contact) wires.push({ x1: 20, y1: 0, z1: 0, x2: 20, y2: 0, z2: 1, r: 0.001, seg: 4 });
  return { wires, sources: [{ pos: 'w1c', mag: 1, phase: 0 }], loads: [], tls: [], material: 0,
    ground: { type, nf, height: 0, eps: 13, sigma: 0.005 }, z0: 50 };
}

function powerRatio(pattern, type, step) {
  const rad = Math.PI / 180;
  let sum = 0;
  for (let el = (type ? 0 : -90) + step / 2; el < 90; el += step)
    for (let az = step / 2; az < 360; az += step)
      sum += pattern.gain(el, az).tot * Math.cos(el * rad);
  return sum * (step * rad) ** 2 / (4 * Math.PI);
}

for (const [name, type, nf, contact, impedance, field, blocked] of [
  ['free', 0, undefined, false, 'direct', 'direct', false],
  ['PEC', 1, undefined, false, 'perfect mirror', 'perfect image', false],
  ['elevated soil', 2, undefined, false, 'Sommerfeld', 'Fresnel', false],
  ['explicit mirror', 2, 'perfect', false, 'perfect mirror', 'Fresnel', true],
  ['isolated contact', 2, undefined, true, 'perfect mirror', 'Fresnel', true],
]) test(name, () => {
  const m = model(type, nf, contact);
  const a = MM.analyze(m, frequency);
  if (Number.isFinite(a.gain)) {
    const coarse = powerRatio(a.pat, type, 6), fine = powerRatio(a.pat, type, 3);
    console.log(name, { R: a.R, X: a.X, peak: a.gain, coarse, fine });
    assert.ok(Math.abs(coarse - fine) < 0.005);
    if (blocked) assert.ok(fine > 1.5);
    else if (type === 2) assert.ok(fine > 0 && fine < 1);
    else assert.ok(Math.abs(1 - fine) < 0.01);
  }
  // Numerical fingerprints of this fixed mesh, independent of the availability flag.
  const [R, X, peak] = type === 0 ? [71.312, -4.440, 2.137]
    : type === 1 || blocked ? [4.895, -9.924, 8.974] : [63.545, 6.014, -0.770];
  assert.ok(Math.abs(a.R - R) < 0.005 && Math.abs(a.X - X) < 0.005);
  if (!blocked) assert.ok(Math.abs(a.gain - peak) < 0.005);
  assert.ok(a.R > 0 && a.res.Pin > 0);
  assert.equal(Number.isFinite(a.gain), !blocked);
  assert.deepEqual(a.res.groundMethods, { impedance, field });
  assert.equal(Number.isFinite(a.pat.gain(30, 0).tot), !blocked);
  assert.equal(Number.isFinite(a.pat.findMax().g), !blocked);
  const messages = [];
  const self = { postMessage(msg) { messages.push(msg); } };
  new Function('self', 'MM', worker)(self, MM);
  for (const kind of ['calc', 'sweep']) {
    self.onmessage({ data: { kind, model: m, f: frequency, freqs: [frequency] } });
    const msg = messages.at(-1);
    assert.equal(msg.ok, true, msg.error);
    const row = kind === 'calc' ? msg.data : msg.data[0];
    assert.equal(Number.isFinite(row.gain), !blocked);
    if (kind === 'calc') {
      assert.equal(Boolean(row.grid), !blocked);
      assert.equal(row.cutAz.length > 0, !blocked);
      assert.equal(row.cutEl.length > 0, !blocked);
      if (blocked) checkPatternViews(row);
    }
  }
  if (blocked) {
    const goals = { gain: { w: 1 }, swr: { w: 0 }, jx: { w: 0 }, fb: { w: 0 }, el: { w: 0 } };
    const opt = { kind: 'opt', model: m, goals, freqs: [frequency], maxEval: 2,
      vars: [{ type: 'len-c', idx: 0, min: 10, max: 11 }] };
    self.onmessage({ data: opt });
    assert.match(messages.at(-1).error, /pattern unavailable/i);
    goals.gain.w = 0;
    goals.jx.w = 1;
    self.onmessage({ data: opt });
    assert.ok(Number.isFinite(messages.at(-1).data.best.cost));
  }
});

// Execute the actual display functions with a previously drawn pattern in each canvas.
function checkPatternViews(row) {
  const elements = new Map();
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, { offsetParent: true, textContent: 'old pattern' });
    return elements.get(selector);
  };
  const prep = canvas => {
    canvas.cleared = true;
    return { c: { fillText(label) { canvas.label = label; } } };
  };
  const views = ['drawPatterns', 'drawEdPolar', 'drawFF3D'].map(name => {
    const start = html.indexOf('function ' + name + '()');
    return html.slice(start, html.indexOf('\n}', start) + 2);
  });
  new Function('S', '$', 'prep', 'css', views.join('\n') + '\ndrawPatterns(); drawEdPolar();')(
    { last: row }, $, prep, () => '');
  for (const id of ['#azPlot', '#elPlot', '#edAz', '#edEl', '#ff3d']) assert.ok($(id).cleared, id);
  for (const id of ['#azTitle', '#edPolTxt']) assert.match($(id).textContent, /pattern unavailable/i);
  assert.match($('#ff3d').label, /pattern unavailable/i);
}
