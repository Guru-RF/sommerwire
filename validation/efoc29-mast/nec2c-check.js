/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* Independent check of the ABOVE-SOIL PROXY points of study.js with nec2c (NEC-2). It checks the solver on the proxy
 * geometry only: NEC-2 cannot model the buried run either (it stops with "SEGMENT ... EXTENDS BELOW GROUND"), so
 * nothing here validates a buried return. nec2c is GPL-3.0 third-party software and is not in this repository; build it
 * as validation/nec2c/README.md describes, or point NEC2C at a binary:
 *   NEC2C=/path/to/nec2c node validation/efoc29-mast/nec2c-check.js
 * Decks and outputs go to a new folder under validation/nec2c/runs/ (git-ignored); results print as a table and are
 * written to nec2c-results.json here.
 * NEC-2 feeds the centre of segment 1 of the vertical radiator (half a segment above the junction where Sommerwire
 * feeds the node); uniform segments of `ds` metres, run at two densities to show the offset shrinking. Copper wire
 * (LD 5, 5.8e7 S/m), Sommerfeld ground (GN 2). The 4:1 unun is applied as Z50 = Zant / 4. */
'use strict';
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '../..');
require(path.join(ROOT, 'engine.js'));
const MM = globalThis.MM;
const NEC = process.env.NEC2C || path.join(ROOT, 'validation/nec2c/bin/nec2c');
const DIR = require(path.join(ROOT, 'validation/nec2c/scripts/run-directory.js'))(__filename);
const F = [3.6, 7.1, 10.125, 14.175, 18.118, 21.225, 24.94, 28.5];
const SOILS = { poor: [5, 0.001], average: [13, 0.005], good: [20, 0.03] };
const MAST = 10, TOTAL = 29, SHIELD = 12;
const swrOf = (R, X) => { const g = Math.sqrt(((R - 50) ** 2 + X * X) / ((R + 50) ** 2 + X * X)); return (1 + g) / (1 - g); };
// the optimum of each kind of proxy on poor soil (results.json), plus one low-feed point on average soil
const CASES = [
  { soil: 'poor', h: 0.75, zp: 0.05, truncate: false, tag: 'p05' },
  { soil: 'poor', h: 9, zp: 0.25, truncate: false, tag: 'p25' },
  { soil: 'poor', h: 8.4, zp: 0.05, truncate: true, tag: 't05' },
  { soil: 'average', h: 0.75, zp: 0.10, truncate: false, tag: 'a10' }
];
function wires(c) {
  const run = SHIELD - (c.h - c.zp);
  const w = [[[0, 0, c.h], [0, 0, MAST], 0.001], [[0, 0, MAST], [TOTAL - (MAST - c.h), 0, MAST], 0.001], [[0, 0, c.h], [0, 0, c.zp], 0.0036]];
  if (!c.truncate) w.push([[0, 0, c.zp], [0, -run, c.zp], 0.0036]);
  return w;
}
function runNEC(c, f, ds) {
  const L = ['CM EFOC29 10 m mast, above-soil proxy ' + c.tag, 'CE'];
  wires(c).forEach(([a, b, r], i) => L.push(`GW ${i + 1} ${Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / ds))} ${a.join(' ')} ${b.join(' ')} ${r}`));
  const [eps, sig] = SOILS[c.soil];
  L.push('GE 1', 'LD 5 0 0 0 5.8e7', `GN 2 0 0 0 ${eps} ${sig}`, 'EX 0 1 1 0 1 0', `FR 0 1 0 0 ${f} 0`, 'XQ', 'EN');
  const tag = c.tag + '-' + f + '-' + ds;
  fs.writeFileSync(path.join(DIR, tag + '.nec'), L.join('\n') + '\n');
  execFileSync(NEC, ['-i' + tag + '.nec', '-o' + tag + '.out'], { cwd: DIR });
  const txt = fs.readFileSync(path.join(DIR, tag + '.out'), 'utf8'), ia = txt.indexOf('ANTENNA INPUT PARAMETERS');
  if (ia < 0) throw new Error('nec2c gave no input impedance for ' + tag);
  for (const l of txt.slice(ia).split('\n').slice(1, 12)) {
    const v = l.trim().split(/\s+/).map(Number);
    if (v.length >= 10 && v[0] === 1 && Number.isFinite(v[6])) return [v[6] / 4, v[7] / 4];
  }
  throw new Error('could not parse ' + tag);
}
function runSW(c, f) {
  const m = { wires: wires(c).map(([a, b, r]) => ({ x1: a[0], y1: a[1], z1: a[2], x2: b[0], y2: b[1], z2: b[2], r, seg: -1 })),
    sources: [{ pos: 'w1b', phase: 0, mag: 1, ratio: 4 }], loads: [], tls: [], seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 },
    ground: { type: 2, height: 0, eps: SOILS[c.soil][0], sigma: SOILS[c.soil][1], nf: 'sommerfeld' }, material: 1, z0: 50 };
  const r = MM.solve(m, f);
  if (r.mirrorMix) throw new Error('perfect-mirror fallback');
  return [r.sources[0].R, r.sources[0].X];
}
const rows = [];
for (const c of CASES) {
  console.log(`\n${c.soil} soil, feed ${c.h} m, ${c.truncate ? 'truncated at' : 'return run at'} ${c.zp} m (${c.tag})`);
  console.log('   MHz | Sommerwire Z50, SWR      | nec2c 0.2 m seg Z50, SWR  | nec2c 0.1 m seg Z50, SWR');
  for (const f of F) {
    const s = runSW(c, f), n2 = runNEC(c, f, 0.2), n1 = runNEC(c, f, 0.1);
    const z = v => `${v[0].toFixed(1).padStart(7)} ${v[1] < 0 ? '-' : '+'} j${Math.abs(v[1]).toFixed(1).padEnd(6)} ${swrOf(...v).toFixed(2).padStart(6)}`;
    console.log(`${String(f).padStart(7)} | ${z(s)} | ${z(n2)} | ${z(n1)}`);
    rows.push({ ...c, f, sommerwire: s, nec2c_02: n2, nec2c_01: n1, swr: { sommerwire: swrOf(...s), nec2c_02: swrOf(...n2), nec2c_01: swrOf(...n1) } });
  }
}
fs.writeFileSync(path.join(__dirname, 'nec2c-results.json'), JSON.stringify({ nec2c: 'nec2c 1.3 (KJ7LNW/nec2c)', rows }, null, 1) + '\n');
