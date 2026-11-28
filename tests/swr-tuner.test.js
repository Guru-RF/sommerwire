const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function section(start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i);
  assert.ok(i >= 0 && j > i, start);
  return html.slice(i, j);
}

function page(S = {}) {
  const nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, {});
    return nodes.get(id);
  };
  const options = section('<select id="swrTuner"', '</select>');
  const [, defaultMode] = options.match(/<option value="([^"]+)" selected>/);
  $('#swrTuner').value = defaultMode;
  const ctx = {
    $, S, fmt: (x, d = 2) => x.toFixed(d),
    angleKeys: () => ({}), bandsFor: () => [[3.5, 3.8, '80m']]
  };
  vm.runInNewContext(
    section('function swrClass', '/* ---------------- tables') +
    section('function renderBands', "$('#bandRes').onclick") +
    section('function renderBandTable', '// Range dropdown') +
    html.match(/^\$\('#swrTuner'\)\.onchange = .*$/m)[0], ctx
  );
  return ctx;
}

test('SWR tuner thresholds use the unrounded ratio with strict tuner cutoffs', () => {
  const { $, swrClass } = page();
  assert.equal($('#swrTuner').value, 'none');
  assert.deepEqual([1.5, 1.5001, 2.5, 2.5001].map(swrClass), ['good', 'warn', 'warn', 'bad']);
  $('#swrTuner').value = 'internal';
  assert.deepEqual([2.9999, 3, 3.0001].map(swrClass), ['good', 'bad', 'bad']);
  $('#swrTuner').value = 'external';
  assert.deepEqual([4.9999, 5, 9.9999, 10, Infinity].map(swrClass), ['good', 'warn', 'warn', 'bad', 'bad']);
});

test('changing tuner recolours cached headline, band and sweep results immediately', () => {
  const r = Object.freeze({ stage: 'z', f: 3.6, R: 250, X: 0, z0: 50, swr: 5, gain: 2, fb: 0 });
  const S = Object.freeze({
    last: r, calcFreq: r.f, model: { bands: [r.f], name: 'Antenna' },
    bandRes: { rows: [r] }, sweep: [r, { ...r, f: 3.7, swr: 10 }]
  });
  const { $ } = page(S);
  for (const [mode, cls] of [['none', 'bad'], ['external', 'warn'], ['internal', 'bad'], ['none', 'bad']]) {
    $('#swrTuner').value = mode;
    $('#swrTuner').onchange();
    assert.equal($('#roSWR').className, 'v ' + cls);
    assert.equal($('#roSWR').innerHTML, '5.00');
    assert.ok($('#bandRes').innerHTML.includes('<span class="' + cls + '">5.00</span>'));
    assert.ok($('#swBands').innerHTML.includes('<td class="' + cls + '">5.00 at 3.600</td>'));
  }
});
