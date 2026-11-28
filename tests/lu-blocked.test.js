/* Blocked complex LU (engine.js: luFactor, luFactorSimple, luFactorBlocked, luSolve).
 * Run from the repository root:  node --test tests/
 * The blocked factorisation reorders the loops but not the arithmetic, so its factors, pivots and
 * solutions must be bit-identical (including signed zeros) to the simple column-by-column loop:
 * 1. Random dense matrices at sizes around the block edges, with small blocks and odd strip widths.
 * 2. Matrices with exact zeros (skipped steps), zeros that travel with row swaps, and a multiplier
 *    that underflows to zero (not skipped).
 * 3. Singular matrices throw the same error from both.
 * 4. The dispatcher picks the blocked form from LU_BLOCK_MIN up and the residual of a solve stays at
 *    rounding level.
 * 5. Whole solves (Sommerfeld ground; a transmission line, so several right-hand sides) give exactly the
 *    same impedance, gain and currents with the blocked path switched off. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('node:vm');
require(path.join(__dirname, '..', 'engine.js'));
const { luFactor, luFactorSimple, luFactorBlocked, luSolve, LU_BLOCK_MIN } = globalThis.MM._lu;

let seed = 7;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296) * 2 - 1; };
function randomMatrix(n, zeroFrac = 0) {
  const r = new Float64Array(n * n), i = new Float64Array(n * n);
  for (let k = 0; k < n * n; k++) if (Math.abs(rnd()) >= zeroFrac) { r[k] = rnd(); i[k] = rnd(); } else { r[k] = rnd() < 0 ? -0 : 0; i[k] = rnd() < 0 ? -0 : 0; }
  return [r, i];
}
function identical(a, b, what) {
  assert.equal(a.length, b.length, what + ' length');
  for (let k = 0; k < a.length; k++) if (!Object.is(a[k], b[k])) assert.fail(what + ' differs at ' + k + ': ' + a[k] + ' vs ' + b[k]);
}
function sameFactors(n, r, i, nb, jb, label) {
  const A = luFactorSimple(n, r.slice(), i.slice()), B = luFactorBlocked(n, r.slice(), i.slice(), nb, jb);
  identical(A.Ar, B.Ar, label + ' Re'); identical(A.Ai, B.Ai, label + ' Im'); identical(A.piv, B.piv, label + ' pivots');
  const br = new Float64Array(n).map(rnd), bi = new Float64Array(n).map(rnd);
  const [xa, ya] = luSolve(A, br, bi), [xb, yb] = luSolve(B, br, bi);
  identical(xa, xb, label + ' x Re'); identical(ya, yb, label + ' x Im');
}

test('blocked LU is bit-identical to the simple loop on dense random matrices', () => {
  for (const n of [1, 2, 3, 4, 5, 7, 8, 9, 16, 17, 31, 33, 64, 65, 100])
    for (const [nb, jb] of [[1, 1], [2, 3], [4, 7], [8, 5], [32, 512], [200, 1000]]) {
      const [r, i] = randomMatrix(n);
      sameFactors(n, r, i, nb, jb, 'n=' + n + ' nb=' + nb + ' jb=' + jb);
    }
});

test('blocked LU is bit-identical with exact zeros, skipped steps and an underflowing multiplier', () => {
  for (const frac of [0.3, 0.7, 0.9]) for (const n of [12, 40, 97]) {
    const [r, i] = randomMatrix(n, frac);
    for (let k = 0; k < n; k++) { r[k * n + k] = 1 + Math.abs(rnd()); }   // keep it regular
    sameFactors(n, r, i, 4, 9, 'zeros ' + frac + ' n=' + n);
    sameFactors(n, r, i, 32, 512, 'zeros ' + frac + ' n=' + n + ' default blocks');
  }
  // tiny entry below a huge pivot: the multiplier underflows to zero, so the step runs with f = 0
  // (the simple loop does not skip it) and can turn a -0 into +0 further right
  const n = 6, [r, i] = randomMatrix(n);
  r[0] = 1e300; i[0] = 0; r[1 * n] = 1e-300; i[1 * n] = 0; r[1 * n + 3] = -0; i[1 * n + 3] = -0;
  sameFactors(n, r, i, 2, 2, 'underflow');
  sameFactors(n, r, i, 1, 1, 'underflow nb=1');
});

test('singular matrices throw the same error from both forms', () => {
  for (const n of [5, 50, 140]) {
    const [r, i] = randomMatrix(n);
    for (let k = 0; k < n; k++) { r[k * n + 3] = 0; i[k * n + 3] = 0; }        // zero column
    let e1, e2;
    try { luFactorSimple(n, r.slice(), i.slice()); } catch (e) { e1 = e.message; }
    try { luFactorBlocked(n, r.slice(), i.slice(), 4, 7); } catch (e) { e2 = e.message; }
    assert.match(e1, /Singular matrix/); assert.equal(e2, e1);
    // two equal rows: singular only after elimination
    const [s, t] = randomMatrix(n);
    for (let j = 0; j < n; j++) { s[(n - 1) * n + j] = s[j]; t[(n - 1) * n + j] = t[j]; }
    let f1 = null, f2 = null;
    try { luFactorSimple(n, s.slice(), t.slice()); } catch (e) { f1 = e.message; }
    try { luFactorBlocked(n, s.slice(), t.slice(), 4, 7); } catch (e) { f2 = e.message; }
    assert.equal(f2, f1);   // rounding may leave a non-zero pivot; whatever happens must match
  }
});

test('dispatcher uses the blocked form from LU_BLOCK_MIN; residual stays at rounding level', () => {
  for (const n of [LU_BLOCK_MIN - 1, LU_BLOCK_MIN, 300]) {
    const [r, i] = randomMatrix(n);
    const F = luFactor(n, r.slice(), i.slice()), G = luFactorSimple(n, r.slice(), i.slice());
    identical(F.Ar, G.Ar, 'dispatch n=' + n); identical(F.piv, G.piv, 'dispatch piv n=' + n);
    const br = new Float64Array(n).map(rnd), bi = new Float64Array(n).map(rnd);
    const [xr, xi] = luSolve(F, br, bi);
    let num = 0, den = 0, an = 0, xn = 0;
    for (let a = 0; a < n; a++) {
      let sr = -br[a], si = -bi[a];
      for (let b = 0; b < n; b++) { const ar = r[a * n + b], ai = i[a * n + b]; sr += ar * xr[b] - ai * xi[b]; si += ar * xi[b] + ai * xr[b]; an = Math.max(an, Math.hypot(ar, ai)); }
      num = Math.max(num, Math.hypot(sr, si)); xn = Math.max(xn, Math.hypot(xr[a], xi[a])); den = Math.max(den, Math.hypot(br[a], bi[a]));
    }
    const rel = num / (n * an * xn + den);
    assert.ok(rel < 1e-13, 'n=' + n + ' scaled residual ' + rel);
  }
});

test('whole solves match exactly with the blocked path on and off', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8');
  assert.match(code, /const LU_BLOCK_MIN = \d+,/);
  const load = c => { const ctx = vm.createContext({ Math, Float64Array, Int32Array, Uint8Array, Array, Map, Set, Object, Error, Number, JSON, String, isFinite, isNaN }); vm.runInContext(c, ctx); return ctx.MM; };
  const on = load(code), off = load(code.replace(/const LU_BLOCK_MIN = \d+,/, 'const LU_BLOCK_MIN = Infinity,'));
  const base = { freq: 14.1, loads: [], seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 }, material: 0, z0: 50 };
  const models = [
    Object.assign({}, base, { name: 'dipole over Sommerfeld ground', wires: [{ x1: 0, y1: -5.1, z1: 10, x2: 0, y2: 5.1, z2: 10, r: 0.001, seg: 201 }],
      sources: [{ pos: 'w1c', phase: 0, mag: 1 }], tls: [], ground: { type: 2, height: 0, eps: 13, sigma: 0.005, nf: 'sommerfeld' } }),
    Object.assign({}, base, { name: 'two dipoles joined by a line, free space', wires: [
        { x1: 0, y1: -5.1, z1: 10, x2: 0, y2: 5.1, z2: 10, r: 0.001, seg: 101 }, { x1: 3, y1: -5.3, z1: 10, x2: 3, y2: 5.3, z2: 10, r: 0.001, seg: 101 }],
      sources: [{ pos: 'w1c', phase: 0, mag: 1 }], tls: [{ p1: 'w1c', p2: 'w2c', z0: 75, vf: 0.66, len: 4 }], ground: { type: 0 } }),
  ];
  for (const m of models) {
    const a = on.analyze(m, m.freq), b = off.analyze(m, m.freq);
    for (const k of ['R', 'X', 'swr', 'gain', 'fb', 'el', 'az']) assert.ok(Object.is(a[k], b[k]), m.name + ' ' + k + ': ' + a[k] + ' vs ' + b[k]);
    identical(a.res.halfRe, b.res.halfRe, m.name + ' currents Re'); identical(a.res.halfIm, b.res.halfIm, m.name + ' currents Im');
    assert.ok(a.res.N >= LU_BLOCK_MIN, m.name + ' is large enough to take the blocked path (' + a.res.N + ' unknowns)');
  }
});
