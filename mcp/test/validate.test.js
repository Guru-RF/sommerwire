// validate_model and the input checks every tool shares: strict schema, share bounds, ill-formed and unsupported
// models, oversized inputs. Every refusal is a tool error with a reason; none crashes the server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, call, dipole } from './helpers.js';

let S;
test.before(async () => { S = await connect(); });
test.after(async () => { await S.close(); });
const refused = async (args, re, tool = 'validate_model') => {
  let r;
  try { r = await call(S.client, tool, args); } catch (e) { assert.match(String(e.message), re); return; }   // protocol-level InvalidParams
  assert.equal(r.isError, true, JSON.stringify(args).slice(0, 120));
  assert.match(r.data.error || r.raw.content[0].text, re);
};

// a share link with a source that has no magnitude, as share.js makes it
const P_encode = async m => { const { appForParity } = await import('./helpers.js'); return appForParity().SWShare.encode({ model: m }); };

test('absent source phase and magnitude get the app defaults (0°, 1 V)', async () => {
  const { data } = await call(S.client, 'solve', { model: dipole({ sources: [{ pos: 'w1c' }] }) });
  const r = data.results[0];
  assert.ok(Number.isFinite(r.R) && Number.isFinite(r.swr), 'finite impedance');
  assert.equal(r.flags.non_finite_result, false);
});

test('a valid model: counts, frequencies, mesh, assumptions, the cleaned model', async () => {
  const { isError, data } = await call(S.client, 'validate_model', { model: dipole({ bands: [14.15, 21.2] }) });
  assert.equal(isError, false);
  assert.deepEqual(data.frequencies, [14.15, 21.2]);
  assert.equal(data.counts.wires, 1); assert.equal(data.mesh.length, 2);
  assert.ok(data.mesh.every(m => m.fits && m.unknowns > 0));
  assert.ok(data.estimate.segments >= data.mesh[1].segments, 'the share estimate bounds the real mesh');
  assert.equal(data.model.wires[0].y1, '-R/4', 'expressions kept as typed');
});

test('exactly one source', async () => {
  await refused({}, /exactly one model source/);
  await refused({ model: dipole(), example: 'Half-wave dipole, 20 m' }, /exactly one model source/);
});

test('strict schema: unknown keys, wrong types, unsupported values', async () => {
  await refused({ model: Object.assign(dipole(), { evil: 1 }) }, /evil|Unrecognized|unrecognized/);
  await refused({ model: dipole({ wires: [{ x1: 0, y1: 0, z1: 0, x2: 0, y2: 1, z2: 0, r: 1, seg: -1, extra: 2 }] }) }, /extra|nrecognized/);
  await refused({ model: dipole({ ground: { type: 3 } }) }, /type|Invalid/);
  await refused({ model: dipole({ ground: { type: 2, nf: 'somm-pec-test' } }) }, /nf|Invalid/);
  await refused({ model: dipole({ material: 99 }) }, /material|Too big|too_big|Invalid/);
  await refused({ model: dipole({ wires: [] }) }, /wires|Too small|too_small/);
  await refused({ example: 'No such antenna' }, /example|Invalid/);
  await refused({ model: dipole(), frequency: 0.001 }, /frequency|Too small|too_small/);
});

test('share bounds: frequency, coordinates, segments, house wires, counts', async () => {
  await refused({ model: dipole({ freq: 20000 }) }, /frequency from 0.01 to 10000 MHz/);
  await refused({ model: dipole({ wires: [{ x1: 0, y1: 0, z1: 10, x2: 0, y2: 2e5, z2: 10, r: 1, seg: -1 }] }) }, /beyond 100000 m/);
  await refused({ model: dipole({ wires: [{ x1: 0, y1: 0, z1: 10, x2: 0, y2: 10, z2: 10, r: 1, seg: 30000 }] }) }, /asks for 30000 segments/);
  await refused({ model: dipole({ freq: 1000, wires: [{ x1: 0, y1: 0, z1: 10, x2: 0, y2: 20000, z2: 10, r: 1, seg: -1 }] }) }, /segments at 1000 MHz, more than 25000/);
  await refused({ model: dipole({ objects: [{ x: 0, y: 30, len: 200, wid: 200, eave: 5, ridge: 9, roof: 'metal', grid: 0.1 }] }) }, /more than 4000 grid wires/);
  const many = Array.from({ length: 3001 }, (_, i) => ({ x1: i, y1: 0, z1: 10, x2: i, y2: 1, z2: 10, r: 1, seg: 1 }));
  await refused({ model: dipole({ wires: many }) }, /wires|Too big|too_big/);
});

test('ill-formed and unsupported models', async () => {
  await refused({ model: dipole({ wires: [{ x1: 0, y1: 'R/4+', z1: 10, x2: 0, y2: 'R/4', z2: 10, r: 1, seg: -1 }] }) }, /not a number or valid expression/);
  await refused({ model: dipole({ sources: [{ pos: 'w9c' }] }) }, /names wire 9, but the model has 1 wires/);
  await refused({ model: dipole({ sources: [{ pos: 'middle' }] }) }, /not a wire position/);
  await refused({ model: dipole({ sources: [] }) }, /no source/);
  await refused({ model: dipole({ wires: [{ x1: 0, y1: -5, z1: -1, x2: 0, y2: 5, z2: -1, r: 1, seg: -1 }] }) }, /below ground/);
  await refused({ model: dipole({ wires: [{ x1: 0, y1: -5, z1: 10, x2: 0, y2: 5, z2: 10, r: 0, seg: -1 }] }) }, /no radius/);
  await refused({ model: dipole({ tls: [{ p1: 'w1c', p2: 'w7b' }] }) }, /Line 1 end 2/);
  // a source magnitude the app would turn into NaN (the page always writes a number there)
  await refused({ model: dipole({ sources: [{ pos: 'w1c', mag: 'R/4' }] }) }, /Source 1 mag is not a finite number/);
  const link = await P_encode(dipole({ sources: [{ pos: 'w1c' }] }));
  await refused({ share_link: link }, /Source 1 mag is not a finite number/);
  // the same checks guard solve before any worker starts
  await refused({ model: dipole({ wires: [{ x1: 0, y1: -5, z1: -1, x2: 0, y2: 5, z2: -1, r: 1, seg: -1 }] }) }, /below ground/, 'solve');
});

test('share links and .maa text that are damaged, hostile or oversized', async () => {
  await refused({ share_link: 'https://sommerwire.app/' }, /no #sw= fragment/);
  await refused({ share_link: 'javascript:alert(1)#sw=1.j.e30' }, /must be a link/);
  await refused({ share_link: '#sw=1.d.!!!!' }, /damaged/);
  await refused({ share_link: '#sw=9.d.AAAA' }, /newer Sommerwire/);
  const proto = Buffer.from(JSON.stringify({ app: 'sommerwire', v: 1, model: { __proto__: { x: 1 }, freq: 14, wires: [] } })).toString('base64url');
  await refused({ share_link: '#sw=1.j.' + proto }, /no wires/);
  await refused({ share_link: '#sw=1.j.' + 'A'.repeat(70000) }, /share_link|Too big|too_big|longer than/);
  await refused({ maa: 'garbage' }, /No wires found/);
  await refused({ maa: 'x'.repeat(600 * 1024) }, /maa|Too big|too_big/);
  // about 700 KiB of JSON: under the 1 MiB message cap, over the 512 KiB model budget (as a share link's payload)
  const pad = v => (v + '.').padEnd(26, '0');
  const big = dipole({ wires: Array.from({ length: 3000 }, (_, i) => ({ x1: pad(i), y1: pad(0), z1: pad(10), x2: pad(i), y2: pad(1), z2: pad(10), r: pad(1), seg: pad(1) })) });
  assert.ok(JSON.stringify(big).length > 512 * 1024 && JSON.stringify(big).length < 1000 * 1024);
  await refused({ model: big }, /larger than 512 KiB as JSON/);
});

test('after all of that the server still answers', async () => {
  const r = await call(S.client, 'validate_model', { example: 'Half-wave dipole, 20 m' });
  assert.equal(r.isError, false);
});
