// share_link and export_maa: links the browser app decodes to the same model, every example round-tripped through
// share_link -> validate_model(share_link), .maa text exactly as the app's Save .maa, and the format-loss report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, call, appForParity, dipole } from './helpers.js';

const P = appForParity();
let S;
test.before(async () => { S = await connect(); });
test.after(async () => { await S.close(); });

test('every example: share_link decodes (share.js) to the same solver input, frequency and view; validate_model reads it back', async () => {
  for (const ex of P.EXAMPLES) {
    const m = P.build(ex), f = (m.bands && m.bands[1]) || +m.freq;
    const { isError, data } = await call(S.client, 'share_link', { example: ex.name, frequency: f });
    assert.equal(isError, false, ex.name);
    assert.ok(data.url.length <= P.SWShare.LIMITS.link, ex.name);
    const back = await P.SWShare.decode(data.fragment);
    assert.deepEqual(P.numeric(back.model), P.numeric(m), ex.name);
    assert.equal(back.calcFreq, f, ex.name);
    if (ex.pol) assert.equal(back.view.pol, ex.pol, ex.name);
    const v = await call(S.client, 'validate_model', { share_link: data.url });
    assert.equal(v.data.calc_frequency, f); assert.deepEqual(P.numeric(v.data.model), P.numeric(m), ex.name);
  }
});

test('share_link: the pol view is set, a link from the app is read, and results never travel', async () => {
  const m = dipole();
  const appHash = await P.SWShare.encode({ model: m, calcFreq: 14.2, view: { pol: 'v' } });
  const v = await call(S.client, 'validate_model', { share_link: 'https://sommerwire.app/?embed=1' + appHash });
  assert.equal(v.data.calc_frequency, 14.2); assert.equal(v.data.view.pol, 'v');
  const l = await call(S.client, 'share_link', { share_link: appHash, pol: 'hv' });
  const back = await P.SWShare.decode(l.data.fragment);
  assert.equal(back.view.pol, 'hv'); assert.equal(back.calcFreq, 14.2);
  assert.doesNotMatch(JSON.stringify(back), /swr|gain/i);
  assert.ok(l.data.notes.some(n => /Anyone with the link can read the model/.test(n)));
});

test('export_maa: the app\'s own .maa text; reopened it gives the same solver input', async () => {
  for (const f of ['Dual-band Yagi pair 2 m 70 cm.maa', 'DX Commander 16 radials.maa', 'EFHW-8010.maa']) {
    const text = (await import('node:fs')).readFileSync(new URL('../../models/' + f, import.meta.url), 'utf8');
    const { isError, data } = await call(S.client, 'export_maa', { maa: text });
    assert.equal(isError, false, f);
    assert.deepEqual(P.numeric(P.fromMAA(data.maa)), P.numeric(P.fromMAA(text)), f);
    assert.ok(!data.format_loss.some(l => /Reopening the file changes/.test(l)), f + ': ' + data.format_loss.join(' | '));
  }
});

test('export_maa reports what .maa loses: soil, method, bands, calculation frequency, view, expressions', async () => {
  const { data } = await call(S.client, 'export_maa', { example: 'RF.Guru EFOC29 end-fed off-centre, 80–10 m, 4:1, flat top', frequency: 7.1 });
  const all = data.format_loss.join('\n');
  assert.equal(data.lossless, false);
  assert.match(all, /Soil: .maa stores no permittivity or conductivity; 5 \/ 0.001 S\/m are lost/);
  assert.match(all, /Band list \(3.6, 7.1, 10.125/);
  assert.match(all, /Calculation frequency 7.1 MHz is not stored/);
  assert.match(all, /Pattern view "hv" is not stored/);
  assert.match(all, /Balun|Transformer ratios/);
  assert.match(data.file_name, /\.maa$/);
  const e = await call(S.client, 'export_maa', { model: dipole({ ground: { type: 2, nf: 'complex' } }) });
  assert.match(e.data.format_loss.join('\n'), /Ground method "complex" is not stored/);
  assert.match(e.data.format_loss.join('\n'), /Expressions are written as numbers at 14.15 MHz: w1.y1 = -R\/4/);
});

test('export_maa: a numeric free-space model is lossless; a lossy edit is caught by reopening the file', async () => {
  const plainDipole = { name: 'FS', freq: 14.15, wires: [{ x1: 0, y1: -5.2, z1: 0, x2: 0, y2: 5.2, z2: 0, r: 1, seg: -1 }], sources: [{ pos: 'w1c', phase: 0, mag: 1 }], ground: { type: 0 } };
  const a = await call(S.client, 'export_maa', { model: plainDipole });
  assert.deepEqual(a.data.format_loss, []); assert.equal(a.data.lossless, true);
  // a source phase with more decimals than .maa keeps
  const b = await call(S.client, 'export_maa', { model: Object.assign({}, plainDipole, { sources: [{ pos: 'w1c', phase: 12.345, mag: 1 }] }) });
  assert.match(b.data.format_loss.join('\n'), /Reopening the file changes the solver input: sources\[0\]\.phase: 12.345 -> 12.3/);
});
