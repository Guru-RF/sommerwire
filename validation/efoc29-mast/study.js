/* Sommerwire — by ON9PK Koen Van den Heuvel. Upstream material: Unlicense. Original RF.Guru fork contributions: Apache-2.0. See repository LICENSE for scope and earlier grants. */
/* EFOC29 on a 10 m mast: feed-height study with an ABOVE-SOIL PROXY for a buried coax return. See README.md here.
 *
 * Run from the repository root:   node validation/efoc29-mast/study.js            (full study, writes results.json)
 *                                  node validation/efoc29-mast/study.js --quick    (coarse grid only, prints, writes nothing)
 *
 * Intended (literal) installation, from the task, NOT solvable here:
 *   29 m radiator, fixed; feedpoint at height h on a 10 m non-conductive mast; the wire rises vertically from the
 *   feedpoint to the 10 m mast top, then runs horizontally (+X) for the rest of the 29 m (19 + h metres).
 *   4:1 ideal unun at the feedpoint. Coax return: the shield exterior goes straight down the mast from the feedpoint
 *   to the soil, then runs BURIED (-Y, perpendicular to the radiator) to the first choke, ~12 m of shield from the
 *   feedpoint in all (RF.Guru: "approximately the first 12 m of coax exterior"). Ideal choke = open end.
 * Sommerwire throws on any wire below the soil (engine.js, "Buried wires ... are unsupported") and switches a wire
 * touching the soil to the perfect mirror; nec2c (NEC-2) stops with "SEGMENT ... EXTENDS BELOW GROUND". Neither can
 * solve the buried run, so this study records those rejections (section "literal") and sweeps explicitly labelled
 * proxies instead:
 *   P05, P10, P25, P50: the shield goes down the mast to zp = 5, 10, 25 or 50 cm ABOVE the soil, then runs
 *                       horizontally at zp for the rest of the 12 m (Sommerfeld ground, every wire above the soil).
 *   T05:                truncated bound: the shield stops at 5 cm above the soil after the mast drop (the buried run
 *                       contributes nothing, the limit of a strongly soil-damped run).
 * A buried run in lossy soil is expected to lie between these (closer to the soil, more loss and more coupling than
 * P05; not fully damped like T05), but that is not proven here. None of them is a buried model.
 * Objective: the largest SWR (50 Ω side of the ideal 4:1) over the eight band frequencies F, minimised over h. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.join(__dirname, '../..');
require(path.join(ROOT, 'engine.js'));
const MM = globalThis.MM;

const F = [3.6, 7.1, 10.125, 14.175, 18.118, 21.225, 24.94, 28.5];
const BAND = ['80 m', '40 m', '30 m', '20 m', '17 m', '15 m', '12 m', '10 m'];
const SOILS = { poor: [5, 0.001], average: [13, 0.005], good: [20, 0.03] };
const PROXIES = { P05: { zp: 0.05 }, P10: { zp: 0.10 }, P25: { zp: 0.25 }, P50: { zp: 0.50 }, T05: { zp: 0.05, truncate: true } };
const MAST = 10, TOTAL = 29, SHIELD = 12, R_WIRE = 0.001, R_SHIELD = 0.0036;
const SEG = { normal: { dm1: 400, dm2: 40, sc: 2, ec: 1 }, x2: { dm1: 800, dm2: 80, sc: 2, ec: 1 }, x4: { dm1: 1600, dm2: 160, sc: 2, ec: 1 } };

// wires in metres; dir: direction of the near-soil return run ('-y' perpendicular to the radiator, '-x' away from it)
function geometry(h, proxy, dir = '-y', zRun) {
  const p = PROXIES[proxy] || { zp: zRun };
  const zp = zRun != null ? zRun : p.zp;
  const w = (a, b, r) => ({ x1: a[0], y1: a[1], z1: a[2], x2: b[0], y2: b[1], z2: b[2], r, seg: -1 });
  const run = SHIELD - (h - zp), end = dir === '-x' ? [-run, 0, zp] : [0, -run, zp];
  const wires = [w([0, 0, h], [0, 0, MAST], R_WIRE), w([0, 0, MAST], [TOTAL - (MAST - h), 0, MAST], R_WIRE), w([0, 0, h], [0, 0, zp], R_SHIELD)];
  if (!p.truncate) wires.push(w([0, 0, zp], end, R_SHIELD));
  return wires;
}
function model(h, proxy, soil, opt = {}) {
  return { wires: geometry(h, proxy, opt.dir, opt.zRun), sources: [{ pos: 'w1b', phase: 0, mag: 1, ratio: 4 }], loads: [], tls: [],
    seg: SEG[opt.seg || 'normal'], ground: { type: 2, height: 0, eps: SOILS[soil][0], sigma: SOILS[soil][1], nf: 'sommerfeld' }, material: 1, z0: 50 };
}
const swrOf = (R, X, z0 = 50) => { const g = Math.sqrt(((R - z0) ** 2 + X * X) / ((R + z0) ** 2 + X * X)); return g >= 1 ? Infinity : (1 + g) / (1 - g); };
function evaluate(job) {
  const m = model(job.h, job.proxy, job.soil, job);
  const per = F.map(f => { const r = MM.solve(m, f), s = r.sources[0];
    return { f, R: s.R, X: s.X, swr: swrOf(s.R, s.X), mirrorMix: r.mirrorMix, N: r.N }; });
  return Object.assign({}, job, { per, max: Math.max(...per.map(p => p.swr)), mirrorMix: per.some(p => p.mirrorMix) });
}

if (!isMainThread) {
  parentPort.on('message', jobs => parentPort.postMessage(jobs.map(evaluate)));
  return;
}
module.exports = { F, BAND, SOILS, PROXIES, geometry, model, evaluate };
if (require.main !== module) return;

function pool(jobs) {
  const n = Math.min(Math.max(1, os.cpus().length - 1), jobs.length), chunks = Array.from({ length: n }, () => []);
  jobs.forEach((j, i) => chunks[i % n].push(j));
  return Promise.all(chunks.map(c => new Promise((res, rej) => {
    const w = new Worker(__filename); w.once('message', r => { res(r); w.terminate(); }); w.once('error', rej); w.postMessage(c);
  }))).then(r => r.flat());
}
const r3 = x => Math.round(x * 1000) / 1000, fmt = x => Number.isFinite(x) ? x.toFixed(2) : '∞';
const grid = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(r3(x)); return o; };
const slim = e => ({ h: e.h, proxy: e.proxy, soil: e.soil, dir: e.dir || '-y', seg: e.seg || 'normal', max: r3(e.max),
  swr: e.per.map(p => r3(p.swr)), Z50: e.per.map(p => [r3(p.R), r3(p.X)]), N: e.per.map(p => p.N), mirrorMix: e.mirrorMix });

(async () => {
  const quick = process.argv.includes('--quick'), t0 = Date.now(), out = { F, BAND, SOILS, PROXIES, MAST, TOTAL, SHIELD, R_WIRE, R_SHIELD, SEG };
  // 1. the literal buried geometry: record how each solver path treats it
  out.literal = {};
  for (const [k, zRun] of [['buried 0.3 m', -0.3], ['on the soil surface', 0]]) {
    const m = { wires: geometry(2, null, '-y', zRun), sources: [{ pos: 'w1b', phase: 0, mag: 1, ratio: 4 }], loads: [], tls: [], seg: SEG.normal,
      ground: { type: 2, height: 0, eps: 5, sigma: 0.001, nf: 'sommerfeld' }, material: 1, z0: 50 };
    try { const r = MM.solve(m, 3.6); out.literal[k] = { solved: true, mirrorMix: r.mirrorMix, warnings: r.warnings.map(w => w.slice(0, 120)) }; }
    catch (e) { out.literal[k] = { solved: false, error: e.message }; }
  }
  console.log('literal:', JSON.stringify(out.literal, null, 1));

  // 2. coarse grid of feed heights
  const H = grid(0.75, 9, 0.25), fams = [];
  for (const soil of Object.keys(SOILS)) for (const proxy of Object.keys(PROXIES)) fams.push({ soil, proxy });
  const coarse = await pool(fams.flatMap(fm => H.filter(h => h > PROXIES[fm.proxy].zp + 0.2).map(h => ({ h, ...fm }))));
  const bad = coarse.filter(e => e.mirrorMix);
  if (bad.length) throw new Error('perfect-mirror fallback in ' + bad.length + ' proxy runs: the proxy touches the soil');
  console.log('coarse: ' + coarse.length + ' points, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  const key = e => e.soil + '/' + e.proxy;
  const best = {};
  for (const fm of fams) {
    const c = coarse.filter(e => key(e) === key(fm)).sort((a, b) => a.h - b.h);
    // secondary diagnostic only (not the objective): the largest SWR without 30 m, which RF.Guru says may need a tuner
    const ex30 = e => Math.max(...e.per.filter(p => p.f !== 10.125).map(p => p.swr));
    const sec = [...c].sort((a, b) => ex30(a) - ex30(b))[0];
    best[key(fm)] = { coarse: c.map(e => [e.h, r3(e.max)].concat(e.per.map(p => r3(p.swr)))), top: [...c].sort((a, b) => a.max - b.max).slice(0, 5).map(slim),
      without30: { h: sec.h, max: r3(ex30(sec)), swr: sec.per.map(p => r3(p.swr)), atBoundary: sec.h === Math.min(...c.map(e => e.h)) || sec.h === Math.max(...c.map(e => e.h)) } };
  }
  if (!quick) {
    // 3. refine at 5 cm around the coarse optimum of each family
    const fine = await pool(fams.flatMap(fm => { const b = best[key(fm)].top[0].h;
      return grid(Math.max(H[0], b - 0.25), Math.min(H[H.length - 1], b + 0.25), 0.05).map(h => ({ h, ...fm })); }));
    for (const fm of fams) {
      const all = fine.filter(e => key(e) === key(fm)).sort((a, b) => a.max - b.max);
      best[key(fm)].fine = all.slice(0, 5).map(slim);
      const o = all[0];
      best[key(fm)].opt = slim(o);
      best[key(fm)].atBoundary = o.h <= Math.min(...H) + 1e-9 || o.h >= Math.max(...H) - 1e-9;
    }
    // 4. mesh check and return-direction sensitivity at each optimum
    const checks = await pool(fams.flatMap(fm => { const h = best[key(fm)].opt.h;
      return [{ h, ...fm, seg: 'x2' }, { h, ...fm, seg: 'x4' }, { h, ...fm, dir: '-x' }]; }));
    for (const fm of fams) {
      const c = checks.filter(e => key(e) === key(fm)), o = best[key(fm)].opt;
      const dev = e => r3(Math.max(...e.per.map((p, i) => Math.abs(p.swr - o.swr[i]) / o.swr[i])) * 100);
      best[key(fm)].mesh = c.filter(e => e.seg).map(e => ({ seg: e.seg, max: r3(e.max), swr: e.per.map(p => r3(p.swr)), maxRelDevPct: dev(e) }));
      const d = c.find(e => e.dir === '-x');
      best[key(fm)].dirX = { max: r3(d.max), swr: d.per.map(p => r3(p.swr)), maxRelDevPct: dev(d) };
    }
  }
  out.families = best;
  out.runtimeS = Math.round((Date.now() - t0) / 1000);
  // summary
  console.log('\nfamily            h_opt  maxSWR  per band (' + BAND.join(' ') + ')   runner-ups (h:max)   mesh x2/x4 dev %   -x dev %');
  for (const k of Object.keys(best)) {
    const b = best[k], o = b.opt || b.top[0], ru = (b.fine || b.top).slice(1, 4).map(e => e.h + ':' + fmt(e.max)).join(' ');
    console.log(k.padEnd(16), String(o.h).padStart(5), fmt(o.max).padStart(7), ' ', o.swr.map(fmt).join(' '), '  ', ru,
      b.mesh ? '  ' + b.mesh.map(m => m.maxRelDevPct).join('/') : '', b.dirX ? '  ' + b.dirX.maxRelDevPct : '', b.atBoundary ? ' BOUNDARY' : '',
      '| without 30 m: h ' + b.without30.h + ' max ' + fmt(b.without30.max) + (b.without30.atBoundary ? ' BOUNDARY' : ''));
  }
  if (!quick) fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('\n' + out.runtimeS + ' s');
})().catch(e => { console.error(e); process.exit(1); });
