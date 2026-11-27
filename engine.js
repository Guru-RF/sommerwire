/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* Sommerwire engine — thin-wire method-of-moments solver in the MININEC style.
 * Pulse current expansion centred on nodes, constant charge per segment,
 * reduced thin-wire kernel, point matching at nodes, image theory for ground.
 * Written from the published method; not derived from MMANA-GAL source.
 */

/* Sommerfeld half-space ground, NEC-2 style.
 * Source: current element (unit I dl) at height zs in air above a homogeneous ground (eps_c = er - j ei).
 * Reflected field = Gamma x (perfect-mirror image field)  +  remainder,  Gamma = (eps_c - 1) / (eps_c + 1).
 * The remainder comes from Sommerfeld integrals (Hertz potentials, e^{jwt}, u_i = sqrt(lambda^2 - k_i^2)):
 *   VED:  Pi_z^r = int Rv e^{-u0 Z} J0 lam/u0          Rv = (k1^2 u0 - k0^2 u1) / (k1^2 u0 + k0^2 u1)
 *   HED:  Pi_x^r = int Rh e^{-u0 Z} J0 lam/u0          Rh = (u0 - u1) / (u0 + u1)
 *         Pi_z^r = d/dx int P e^{-u0 Z} J0 lam          P  = 2 (u0 - u1) / (k1^2 u0 + k0^2 u1)
 * E = k0^2 Pi + grad div Pi, times I dl / (4 pi j w eps0). With Gamma subtracted (Rv -> Rv - Gamma,
 * Rh -> Rh + Gamma) the remainder is only weakly singular (~1/R' at the image point), so R' e^{jkR'} x remainder
 * is smooth and is tabulated on a grid in (R', theta) around the image point.
 * Field of a source with direction s, seen at offset (rho_vec, Z = z + zs), rho_hat horizontal unit, phi_hat = z x rho_hat:
 *   E = sz (A1 z + A2 rho) + (s.rho)(Hr rho - A2 z) + (s.phi) Hf phi
 *   A1 = int (Rv-G) e J0 lam^3/u0,  A2 = int (Rv-G) e J1 lam^2,
 *   Hr = k0^2 I3 - I4 + I5,  Hf = k0^2 I3 - I5,  I3 = int (Rh+G)/u0 e J0 lam,
 *   I4 = int g e J0 lam^3,  I5 = int g e (J1/rho) lam^2,  g = (Rh+G)/u0 - u0 P.            */
(function (root) {
  // Bessel J0, J1 of real argument (rational approximations, about 1e-8)
  function bj0(x) {
    const ax = Math.abs(x);
    if (ax < 8) {
      const y = x * x;
      return (57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))))) /
        (57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y)))));
    }
    const z = 8 / ax, y = z * z, xx = ax - 0.785398164;
    const p1 = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
    const p2 = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
    return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
  }
  function bj1(x) {
    const ax = Math.abs(x);
    if (ax < 8) {
      const y = x * x;
      return x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606)))))) /
        (144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y)))));
    }
    const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
    const p1 = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
    const p2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
    const a = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
    return x < 0 ? -a : a;
  }
  const GLc = {};
  function gauss(n) {
    if (GLc[n]) return GLc[n];
    const x = new Float64Array(n), w = new Float64Array(n);
    for (let i = 0; i < (n + 1) >> 1; i++) {
      let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 1;
      for (let it = 0; it < 100; it++) {
        let p1 = 1, p2 = 0;
        for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1); }
        pp = n * (z * p1 - p2) / (z * z - 1);
        const z1 = z; z = z1 - p1 / pp; if (Math.abs(z - z1) < 1e-15) break;
      }
      x[i] = -z; x[n - 1 - i] = z; w[i] = w[n - 1 - i] = 2 / ((1 - z * z) * pp * pp);
    }
    return (GLc[n] = { x, w });
  }
  function csqrt(a, b) {            // principal root, Re >= 0
    const m = Math.hypot(a, b);
    const r = Math.sqrt((m + a) / 2); let i = Math.sqrt(Math.max(0, (m - a) / 2)); if (b < 0) i = -i;
    return [r, i];
  }

  // ground context: k0 (rad/m), eps_c = er - j ei.   mode 'pec': full mirror-image integrals (for tests)
  function context(k0, er, ei, mode) {
    const k1r = k0 * k0 * er, k1i = -k0 * k0 * ei;
    const dr = er + 1, di = -ei, nr = er - 1, ni = -ei, dd = dr * dr + di * di;
    const G = mode === 'pec' ? [0, 0] : [(nr * dr + ni * di) / dd, (ni * dr - nr * di) / dd];
    const k1 = csqrt(k1r, k1i);
    const fine = 0.05 / Math.sqrt(Math.hypot(er, ei));
    const km1r = k0 * k0 * (er - 1), km1i = -k0 * k0 * ei;            // k0^2 (eps_c - 1) = k1^2 - k0^2
    return { k0, k1r, k1i, k1re: Math.abs(k1[0]), G, pec: mode === 'pec', fine, er, eim: -ei, ep1r: er + 1, ep1i: -ei, km1r, km1i };
  }

  // integrand at real lam with given u0, weight w (includes dlam/dt); adds 5 complex values to acc.
  // Written without cancellation, using delta = u0 - u1 = k0^2 (eps_c - 1) / (u0 + u1) and W = eps_c u0 + u1:
  //   Rv - G = 2 eps_c delta / ((eps_c + 1) W),   Rh + G = delta / (u0 + u1) + G,
  //   g = (Rh + G)/u0 - u0 P = 2 delta / ((eps_c + 1) u0 W).
  function integrand(c, lam, u0r, u0i, w, rho, Z, acc) {
    const ud = u0r * u0r + u0i * u0i, iur = u0r / ud, iui = -u0i / ud;            // 1/u0
    let dvr, dvi, dhr, dhi, gr, gi;
    if (c.pec) { dvr = 1; dvi = 0; dhr = -1; dhi = 0; gr = -iur; gi = -iui; }
    else {
      const [u1r, u1i] = csqrt(lam * lam - c.k1r, -c.k1i);
      const sr = u0r + u1r, si = u0i + u1i, sd = sr * sr + si * si, isr = sr / sd, isi = -si / sd;   // 1/s
      const dr = c.km1r * isr - c.km1i * isi, di = c.km1r * isi + c.km1i * isr;                  // delta
      const Wr = c.er * u0r - c.eim * u0i + u1r, Wi = c.er * u0i + c.eim * u0r + u1i;           // W
      // q = 2 delta / ((eps_c + 1) W)
      const pr = c.ep1r * Wr - c.ep1i * Wi, pi = c.ep1r * Wi + c.ep1i * Wr, pd = pr * pr + pi * pi;
      const qr = 2 * (dr * pr + di * pi) / pd, qi = 2 * (di * pr - dr * pi) / pd;
      dvr = c.er * qr - c.eim * qi; dvi = c.er * qi + c.eim * qr;                                // eps_c q
      dhr = dr * isr - di * isi + c.G[0]; dhi = dr * isi + di * isr + c.G[1];
      gr = qr * iur - qi * iui; gi = qr * iui + qi * iur;                                        // q / u0
    }
    const ea = Math.exp(-u0r * Z), er = ea * Math.cos(u0i * Z) * w, ei = -ea * Math.sin(u0i * Z) * w;   // w e^{-u0 Z}
    const x = lam * rho, J0 = bj0(x), J1 = bj1(x), J1r = rho > 1e-12 ? J1 / rho : lam / 2;
    const l2 = lam * lam, l3 = l2 * lam;
    const hr = dhr * iur - dhi * iui, hi = dhr * iui + dhi * iur;     // dh/u0
    const vr = dvr * iur - dvi * iui, vi = dvr * iui + dvi * iur;     // dv/u0
    let f, fr, fi;
    fr = vr * er - vi * ei; fi = vr * ei + vi * er; f = J0 * l3; acc[0] += fr * f; acc[1] += fi * f;          // I1
    fr = dvr * er - dvi * ei; fi = dvr * ei + dvi * er; f = J1 * l2; acc[2] += fr * f; acc[3] += fi * f;      // I2
    fr = hr * er - hi * ei; fi = hr * ei + hi * er; f = J0 * lam; acc[4] += fr * f; acc[5] += fi * f;         // I3
    fr = gr * er - gi * ei; fi = gr * ei + gi * er; f = J0 * l3; acc[6] += fr * f; acc[7] += fi * f;          // I4
    f = J1r * l2; acc[8] += fr * f; acc[9] += fi * f;                                                       // I5
  }

  // Wynn epsilon extrapolation of a real sequence (returns best estimate)
  function wynn(s) {
    const n = s.length; if (n < 3) return s[n - 1];
    let e0 = new Float64Array(n + 1), e1 = Float64Array.from(s);
    let best = s[n - 1];
    for (let k = 1; k < n; k++) {
      const e2 = new Float64Array(n - k);
      for (let i = 0; i < n - k; i++) {
        const d = e1[i + 1] - e1[i];
        if (Math.abs(d) <= 1e-15 * Math.abs(e1[i + 1]) + 1e-300) return (k - 1) % 2 === 0 ? e1[i + 1] : best;   // converged column
        e2[i] = e0[i + 1] + 1 / d;
      }
      if (k % 2 === 0) best = e2[n - k - 1];
      e0 = e1; e1 = e2;
    }
    return best;
  }

  // the five integrals at (rho, Z); returns Float64Array(10)
  function point(c, rho, Z) {
    const acc = new Float64Array(10), k0 = c.k0;
    const quad = (a, b, n, fn) => { const g = gauss(n), h = (b - a) / 2, m = (a + b) / 2; for (let q = 0; q < n; q++) fn(m + h * g.x[q], h * g.w[q]); };
    const osc = Math.max(1, Math.ceil(k0 * rho / 2));
    // breakpoints graded toward the branch point lam = k0, where the reflection coefficients change over a
    // width of about 1/|sqrt(eps_c)| in the substituted variable
    const graded = (len, n) => {
      const br = []; for (let s = 0; s <= n; s++) br.push(len * s / n);
      let w = len / n; while (w > c.fine) { w /= 4; br.push(w); }
      return [...new Set(br)].sort((x, y) => x - y);
    };
    // (i) 0..k0:  lam = k0 sin t,  u0 = j k0 cos t   (tau = pi/2 - t, graded toward tau = 0)
    const b1 = graded(Math.PI / 2, 2 + osc);
    for (let s = 0; s + 1 < b1.length; s++) quad(b1[s], b1[s + 1], 10, (tau, w) => {
      const ct = Math.sin(tau); integrand(c, k0 * Math.cos(tau), 0, k0 * ct, w * k0 * ct, rho, Z, acc);
    });
    // (ii) k0..2k0:  lam = k0 cosh s,  u0 = k0 sinh s   (graded toward s = 0)
    const b2 = graded(Math.acosh(2), 2 + osc);
    for (let s = 0; s + 1 < b2.length; s++) quad(b2[s], b2[s + 1], 10, (t, w) => {
      const sh = Math.sinh(t); integrand(c, k0 * Math.cosh(t), k0 * sh, 0, w * k0 * sh, rho, Z, acc);
    });
    // (iii) 2k0..lamB, breakpoints at Re k1
    const lamB = Math.max(3 * k0, Math.min(1.5 * c.k1re, Z > 0 ? 45 / Z : Infinity));
    const brk = [2 * k0]; if (c.k1re > 2 * k0 && c.k1re < lamB) brk.push(c.k1re); brk.push(lamB);
    const step = Math.min(rho > 0 ? Math.PI / rho : Infinity, Z > 0 ? 2 / Z : Infinity, k0);
    for (let b = 0; b + 1 < brk.length; b++) {
      const a0 = brk[b], a1 = brk[b + 1], n = Math.max(1, Math.ceil((a1 - a0) / step));
      for (let s = 0; s < n; s++) quad(a0 + (a1 - a0) * s / n, a0 + (a1 - a0) * (s + 1) / n, 10, (l, w) => integrand(c, l, Math.sqrt(l * l - k0 * k0), 0, w, rho, Z, acc));
    }
    // (iv) tail: partial sums over intervals, Wynn extrapolation when oscillating
    const dl = Math.min(rho > 0 ? Math.PI / rho : Infinity, Z > 0 ? 3 / Z : Infinity);
    const seq = Array.from({ length: 10 }, () => []);
    const part = new Float64Array(10);
    let a = lamB, prev = null, stable = 0;
    for (let it = 0; it < 300; it++) {
      quad(a, a + dl, 10, (l, w) => integrand(c, l, Math.sqrt(l * l - k0 * k0), 0, w, rho, Z, part));
      a += dl;
      for (let q = 0; q < 10; q++) seq[q].push(part[q]);
      if (Math.exp(-a * Z) * a * a * a < 1e-14 * (1 + Math.abs(part[0]) + Math.abs(part[6]))) { prev = Array.from(part); break; }
      if (it >= 4) {
        const est = seq.map(s => wynn(s.slice(-14)));
        if (prev) {
          let d = 0, m = 0; for (let q = 0; q < 10; q++) { d = Math.max(d, Math.abs(est[q] - prev[q])); m = Math.max(m, Math.abs(est[q]) + Math.abs(acc[q])); }
          stable = d < 1e-9 * m ? stable + 1 : 0;
        }
        prev = est;
        if (stable >= 2) break;
      }
    }
    for (let q = 0; q < 10; q++) acc[q] += prev ? prev[q] : part[q];
    return acc;
  }

  // field quantities [A1, A2, Hr, Hf] as 8 reals from the five integrals
  function fields(c, I) {
    const k0s = c.k0 * c.k0;
    return [I[0], I[1], I[2], I[3],
      k0s * I[4] - I[6] + I[8], k0s * I[5] - I[7] + I[9],
      k0s * I[4] - I[8], k0s * I[5] - I[9]];
  }

  /* Interpolation table of the remainder fields around the image point.
   * T(R', theta) = R' e^{j k0 R'} F(rho = R' sin theta, Z = R' cos theta), F = [A1, A2, Hr, Hf] (complex).
   * The R' grid is uniform in xi = ln R' + R'/Rc: geometric (ratio q) close to the image, steps of lambda/nl far
   * away. Theta is uniform. Both directions use 4-point Lagrange interpolation with closed-form weights. */
  function table(c, Rmin, Rmax, thMax, opt) {
    opt = opt || {};
    const dx = Math.log(opt.q || 1.12), Rc = 2 * Math.PI / c.k0 / (opt.nl || 24) / dx, nt = Math.max(3, opt.nt || 18);
    const xiOf = R => Math.log(R) + R / Rc;
    const x0 = xiOf(Rmin * 0.999) - dx, nr = Math.max(4, Math.ceil((xiOf(Rmax * 1.001) - x0) / dx) + 2);
    const th = Math.min(Math.PI / 2, thMax * 1.0001), dth = th / nt;
    const T = new Float64Array(nr * (nt + 1) * 8);
    let R = Rmin;
    for (let i = 0; i < nr; i++) {
      const xi = x0 + i * dx;
      for (let it = 0; it < 50; it++) { const d = (Math.log(R) + R / Rc - xi) / (1 / R + 1 / Rc); R -= d; if (R <= 0) R = 1e-12; if (Math.abs(d) < 1e-14 * R) break; }
      for (let j = 0; j <= nt; j++) {
        const t = j * dth, F = fields(c, point(c, R * Math.sin(t), R * Math.cos(t)));
        const cr = R * Math.cos(c.k0 * R), ci = R * Math.sin(c.k0 * R), o = (i * (nt + 1) + j) * 8;
        for (let m = 0; m < 4; m++) { T[o + 2 * m] = F[2 * m] * cr - F[2 * m + 1] * ci; T[o + 2 * m + 1] = F[2 * m] * ci + F[2 * m + 1] * cr; }
      }
    }
    const k0 = c.k0, NT = nt + 1;
    const w4 = (u, w) => { w[0] = -u * (u - 1) * (u - 2) / 6; w[1] = (u + 1) * (u - 1) * (u - 2) / 2; w[2] = -(u + 1) * u * (u - 2) / 2; w[3] = (u + 1) * u * (u - 1) / 6; };
    const wR = new Float64Array(4), wT = new Float64Array(4);
    function evalF(rho, Z, out) {
      const R = Math.sqrt(rho * rho + Z * Z), t = Math.atan2(rho, Z);
      const fx = (Math.log(R) + R / Rc - x0) / dx; let i0 = Math.floor(fx) - 1; if (i0 < 0) i0 = 0; else if (i0 > nr - 4) i0 = nr - 4;
      const ft = t / dth; let j0 = Math.floor(ft) - 1; if (j0 < 0) j0 = 0; else if (j0 > nt - 3) j0 = nt - 3;
      w4(fx - i0 - 1, wR); w4(ft - j0 - 1, wT);
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0, a7 = 0;
      for (let a = 0; a < 4; a++) {
        let o = ((i0 + a) * NT + j0) * 8;
        for (let b = 0; b < 4; b++, o += 8) {
          const w = wR[a] * wT[b];
          a0 += w * T[o]; a1 += w * T[o + 1]; a2 += w * T[o + 2]; a3 += w * T[o + 3];
          a4 += w * T[o + 4]; a5 += w * T[o + 5]; a6 += w * T[o + 6]; a7 += w * T[o + 7];
        }
      }
      const cr = Math.cos(k0 * R) / R, ci = -Math.sin(k0 * R) / R;     // e^{-jk0R'}/R'
      out[0] = a0 * cr - a1 * ci; out[1] = a0 * ci + a1 * cr; out[2] = a2 * cr - a3 * ci; out[3] = a2 * ci + a3 * cr;
      out[4] = a4 * cr - a5 * ci; out[5] = a4 * ci + a5 * cr; out[6] = a6 * cr - a7 * ci; out[7] = a6 * ci + a7 * cr;
      return out;
    }
    return { evalF, points: nr * NT, nr, nt };
  }

  root.SOMM = { bj0, bj1, gauss, context, point, fields, wynn, table, integrand };
})(typeof globalThis !== 'undefined' ? globalThis : self);

(function (root) {
  'use strict';
  const C0 = 299.792458;          // speed of light, m/us  -> lambda(m) = C0 / f(MHz)
  const ETA = 376.730313668;      // free-space impedance
  const MU0 = 4e-7 * Math.PI;
  const GL_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
                 0.1834346424956498,  0.5255324099163290,  0.7966664774136267,  0.9602898564975363];
  const GL_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
                0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
  const MATERIALS = [
    { name: 'Lossless', sigma: Infinity },
    { name: 'Copper', sigma: 5.8e7 },
    { name: 'Aluminium', sigma: 3.5e7 },
    { name: 'Iron (as MMANA, non-magnetic)', sigma: 1.0e7 },
    { name: 'Steel, galvanised (µr 100)', sigma: 6.0e6, mu: 100 },
    { name: 'Stainless steel', sigma: 1.4e6 },
    { name: 'Brass', sigma: 1.5e7 }
  ];

  const lambdaOf = f => C0 / f;

  /* ---------- expression evaluator (numbers, + - * / ( ), constants R=lambda, I=inch, F=foot) ---------- */
  function evalExpr(str, lambda) {
    if (typeof str === 'number') return str;
    const s = String(str).replace(/\s+/g, '');
    if (s === '') return NaN;
    let i = 0;
    const consts = { R: lambda, r: lambda, I: 0.0254, i: 0.0254, F: 0.3048, f: 0.3048 };
    function num() {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      const c = s[i];
      if (c in consts) { i++; return consts[c]; }
      throw new Error('Unexpected "' + (c || 'end') + '"');
    }
    function factor() {
      if (s[i] === '-') { i++; return -factor(); }
      if (s[i] === '+') { i++; return factor(); }
      if (s[i] === '(') { i++; const v = expr(); if (s[i] !== ')') throw new Error('Missing )'); i++; return v; }
      return num();
    }
    function term() {
      let v = factor();
      while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const w = factor(); v = op === '*' ? v * w : v / w; }
      return v;
    }
    function expr() {
      let v = term();
      while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const w = term(); v = op === '+' ? v + w : v - w; }
      return v;
    }
    try { const v = expr(); if (i !== s.length) return NaN; return v; } catch (e) { return NaN; }
  }

  /* ---------- vector helpers ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);

  /* ---------- position spec "w3c" / "w3b" / "w3e" ---------- */
  function parsePos(spec) {
    const m = /^\s*w\s*(\d+)\s*([bce])/i.exec(String(spec));
    if (!m) return null;
    return { wire: parseInt(m[1], 10) - 1, where: m[2].toLowerCase() };
  }

  /* ---------- segmentation ---------- */
  function segmentLengths(L, mode, lambda, seg, radius, needCenter) {
    const dmax = lambda / seg.dm2;
    const dmin = Math.min(dmax, Math.max(lambda / (seg.sc * seg.dm1), 2 * radius));
    let lens;
    if (mode > 0) {
      let n = Math.round(mode); if (needCenter && n % 2) n++;
      lens = new Array(n).fill(L / n);
    } else if (mode === 0 || L <= 2 * dmin) {
      let n = Math.max(1, Math.ceil(L / dmax - 1e-9)); if (needCenter && n % 2) n++;
      lens = new Array(n).fill(L / n);
    } else {
      const both = mode === -1 || mode < -3;
      const taper = [];
      for (let d = dmin; d < dmax * 0.999; d *= 2) taper.push(d);
      const sides = both ? 2 : 1;
      let k = taper.length;
      const sumT = n => taper.slice(0, n).reduce((a, b) => a + b, 0);
      while (k > 0 && sides * sumT(k) > L) k--;
      let rem, n;
      for (;;) {
        rem = L - sides * sumT(k);
        n = rem > 1e-9 ? Math.ceil(rem / dmax - 1e-9) : 0;
        if (both && needCenter && n % 2) n++;
        if (k > 0 && n > 0 && rem / n < 0.5 * taper[k - 1]) { k--; continue; }
        break;
      }
      const T = taper.slice(0, k);
      const mid = n > 0 ? new Array(n).fill(rem / n) : [];
      if (mode === -1 || mode < -3) lens = T.concat(mid, T.slice().reverse());
      else if (mode === -2) lens = T.concat(mid);
      else lens = mid.concat(T.slice().reverse());
      const tot = lens.reduce((a, b) => a + b, 0);
      lens = lens.map(x => x * L / tot);
    }
    return lens;
  }

  /* ---------- mesh build ---------- */
  const GROUND_CONTACT_TOL = 1e-4; // metres
  function buildMesh(model, f) {
    const lambda = lambdaOf(f);
    const g = model.ground || { type: 0, height: 0 };
    const hasGround = g.type > 0;
    const H = hasGround ? (+g.height || 0) : 0;
    const segCfg = Object.assign({ dm1: 400, dm2: 40, sc: 2, ec: 1 }, model.seg || {});
    const warnings = [];

    const centerWires = new Set();
    (model.sources || []).concat(model.loads || []).forEach(s => {
      const p = parsePos(s.pos); if (p && p.where === 'c') centerWires.add(p.wire);
    });

    const nodes = [];      // {p:[x,y,z], inc:[{seg, isEnd}], ground:bool}
    const nodeMap = new Map();
    const tol = 1e-5;
    function nodeId(p) {
      const key = Math.round(p[0] / tol) + ',' + Math.round(p[1] / tol) + ',' + Math.round(p[2] / tol);
      let id = nodeMap.get(key);
      if (id === undefined) {
        id = nodes.length;
        nodes.push({ p: p.slice(), inc: [], ground: hasGround && Math.abs(p[2]) < GROUND_CONTACT_TOL });
        nodeMap.set(key, id);
      }
      return id;
    }

    const segs = [];       // {n0, n1, p0, p1, len, dir, a, wire}
    const wireSegs = [];
    model.wires.forEach((w, wi) => {
      const A = [w.x1, w.y1, w.z1 + H], B = [w.x2, w.y2, w.z2 + H];
      const L = len(sub(B, A));
      const a = Math.abs(w.r);
      wireSegs.push([]);
      if (!(L > 0) || !(a > 0)) { if (!(L > 0)) warnings.push('Wire ' + (wi + 1) + ' has zero length.'); return; }
      if (hasGround && (A[2] < -GROUND_CONTACT_TOL || B[2] < -GROUND_CONTACT_TOL)) warnings.push('Wire ' + (wi + 1) + ' goes below ground.');
      const lens = segmentLengths(L, w.seg | 0, lambda, segCfg, a, centerWires.has(wi));
      const u = scl(sub(B, A), 1 / L);
      let t = 0, prev = nodeId(A);
      lens.forEach((dl, k) => {
        t += dl;
        const pt = k === lens.length - 1 ? B : add(A, scl(u, t));
        const nx = nodeId(pt);
        const si = segs.length;
        segs.push({ n0: prev, n1: nx, len: dl, dir: u, a, wire: wi });
        nodes[prev].inc.push({ seg: si, isEnd: false });
        nodes[nx].inc.push({ seg: si, isEnd: true });
        wireSegs[wi].push(si);
        prev = nx;
      });
    });
    segs.forEach(s => { s.p0 = nodes[s.n0].p; s.p1 = nodes[s.n1].p; s.mid = scl(add(s.p0, s.p1), 0.5); });

    // halves: index 2*s is the half touching n0, 2*s+1 touches n1
    const halves = [];
    segs.forEach(s => {
      halves.push({ seg: s, p0: s.p0, p1: s.mid, len: s.len / 2, mid: scl(add(s.p0, s.mid), 0.5) });
      halves.push({ seg: s, p0: s.mid, p1: s.p1, len: s.len / 2, mid: scl(add(s.mid, s.p1), 0.5) });
    });

    // basis functions
    const bases = [];
    nodes.forEach((nd, ni) => {
      const inc = nd.inc;
      const part = (e, into) => {
        const s = segs[e.seg];
        // flow direction: into node, or out of node
        const towardNode = e.isEnd ? s.dir : scl(s.dir, -1);
        const d = into ? towardNode : scl(towardNode, -1);
        return { seg: e.seg, half: 2 * e.seg + (e.isEnd ? 1 : 0), d, c: (into ? -1 : 1) / s.len };
      };
      if (nd.ground) {
        inc.forEach(e => bases.push({ node: ni, a: part(e, true), b: null }));
      } else if (inc.length >= 2) {
        for (let k = 1; k < inc.length; k++) bases.push({ node: ni, a: part(inc[0], true), b: part(inc[k], false) });
      }
    });

    return { lambda, f, segs, nodes, halves, bases, wireSegs, hasGround, H, warnings };
  }

  /* ---------- kernel integral psi(r) = int e^{-jkR}/R dl over a straight piece ----------
   * Far pieces (centre > 8 lengths away): midpoint rule. Medium (> 2.5 lengths): 4-point Gauss.
   * Near: exact static part (asinh) plus 8-point Gauss on the smooth remainder. */
  const G4_X = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
  const G4_W = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];
  function psi(r, p0, p1, a, k, out, o) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const L2 = dx * dx + dy * dy + dz * dz, L = Math.sqrt(L2);
    const mx = (p0[0] + p1[0]) / 2 - r[0], my = (p0[1] + p1[1]) / 2 - r[1], mz = (p0[2] + p1[2]) / 2 - r[2];
    const R0sq = mx * mx + my * my + mz * mz;
    if (R0sq > 64 * L2) {
      const R = Math.sqrt(R0sq + a * a), kr = k * R;
      out[o] = L * Math.cos(kr) / R; out[o + 1] = -L * Math.sin(kr) / R; return;
    }
    const ux = dx / L, uy = dy / L, uz = dz / L;
    const wx = r[0] - p0[0], wy = r[1] - p0[1], wz = r[2] - p0[2];
    const t0 = wx * ux + wy * uy + wz * uz;
    let rho2 = wx * wx + wy * wy + wz * wz - t0 * t0; if (rho2 < 0) rho2 = 0; rho2 += a * a;
    const h = L / 2;
    let re = 0, im = 0;
    if (R0sq > 6.25 * L2) {
      for (let q = 0; q < 4; q++) {
        const t = h + h * G4_X[q], R = Math.sqrt((t - t0) * (t - t0) + rho2), kr = k * R;
        re += G4_W[q] * h * Math.cos(kr) / R; im -= G4_W[q] * h * Math.sin(kr) / R;
      }
      out[o] = re; out[o + 1] = im; return;
    }
    const rho = Math.sqrt(rho2);
    re = Math.asinh((L - t0) / rho) + Math.asinh(t0 / rho);
    for (let q = 0; q < 8; q++) {
      const t = h + h * GL_X[q];
      const R = Math.sqrt((t - t0) * (t - t0) + rho2);
      const kr = k * R;
      // (e^{-jkR} - 1)/R
      re += GL_W[q] * h * (Math.cos(kr) - 1) / R;
      im -= GL_W[q] * h * Math.sin(kr) / R;
    }
    out[o] = re; out[o + 1] = im;
  }
  const mirror = p => [p[0], p[1], -p[2]];

  /* ---------- real ground for the impedance: complex image (Wait / Bannister) ----------
   * Lossy ground reflects roughly like a perfect mirror buried at a complex depth
   *   d = 1 / (j k0 sqrt(eps_c - 1)),   eps_c = eps_r - j 60 lambda sigma,
   * so the image of a point at height z sits at z' = -(z + 2d). Image currents and charges keep the
   * perfect-mirror signs. Good ground -> d -> 0 (perfect mirror); eps_c -> 1 -> d -> infinity (free space). */
  function complexDepth(eps, sigma, lambda) {
    const er = eps - 1, ei = -60 * lambda * sigma;            // eps_c - 1
    const m = Math.hypot(er, ei);
    if (m < 1e-9) return null;                                 // no ground at all
    let sr = Math.sqrt((m + er) / 2), si = Math.sqrt(Math.max(0, (m - er) / 2)); if (ei < 0) si = -si;
    const k0 = 2 * Math.PI / lambda;
    const gr = -k0 * si, gi = k0 * sr;                         // gamma = j k0 sqrt(eps_c - 1)
    const den = gr * gr + gi * gi;
    return [gr / den, -gi / den];                              // d = 1 / gamma
  }
  // psi of the image of piece p0-p1 at complex depth d = (dr, di), seen from r
  function psiImg(r, p0, p1, a, k, dr, di, out, o) {
    const ex = p1[0] - p0[0], ey = p1[1] - p0[1], ez = p1[2] - p0[2];
    const L = Math.sqrt(ex * ex + ey * ey + ez * ez), h = L / 2;
    const one = (t, w) => {
      const sx = p0[0] + ex * t, sy = p0[1] + ey * t, sz = p0[2] + ez * t;
      const dx = r[0] - sx, dy = r[1] - sy, dzr = r[2] + sz + 2 * dr, dzi = 2 * di;
      const R2r = dx * dx + dy * dy + dzr * dzr - dzi * dzi + a * a, R2i = 2 * dzr * dzi;
      const m = Math.hypot(R2r, R2i);
      const Rr = Math.sqrt((m + R2r) / 2); let Ri = Math.sqrt(Math.max(0, (m - R2r) / 2)); if (R2i < 0) Ri = -Ri;
      const amp = Math.exp(k * Ri), er = amp * Math.cos(k * Rr), ei = -amp * Math.sin(k * Rr);
      const den = Rr * Rr + Ri * Ri;
      return [w * (er * Rr + ei * Ri) / den, w * (ei * Rr - er * Ri) / den];
    };
    // far pieces: one point; otherwise 8-point Gauss (the image is never singular: it lies at least |2d| away)
    const cx = r[0] - (p0[0] + p1[0]) / 2, cy = r[1] - (p0[1] + p1[1]) / 2, cz = r[2] + (p0[2] + p1[2]) / 2 + 2 * dr;
    if (cx * cx + cy * cy + cz * cz + 4 * di * di > 64 * L * L) { const v = one(0.5, L); out[o] = v[0]; out[o + 1] = v[1]; return; }
    let re = 0, im = 0;
    for (let q = 0; q < 8; q++) { const v = one(0.5 + 0.5 * GL_X[q], GL_W[q] * h); re += v[0]; im += v[1]; }
    out[o] = re; out[o + 1] = im;
  }

  /* ---------- complex LU factorisation with partial pivoting (row-major, in place) ----------
   * Factor once, then solve for as many right-hand sides as needed (sources and line ports). */
  function luFactor(n, Ar, Ai) {
    const piv = new Int32Array(n);
    for (let c = 0; c < n; c++) {
      let p = c, best = -1;
      for (let r = c; r < n; r++) { const m = Ar[r * n + c] ** 2 + Ai[r * n + c] ** 2; if (m > best) { best = m; p = r; } }
      if (best === 0) throw new Error('Singular matrix — check that wires connect properly.');
      piv[c] = p;
      if (p !== c) {
        for (let j = 0; j < n; j++) {
          let t = Ar[c * n + j]; Ar[c * n + j] = Ar[p * n + j]; Ar[p * n + j] = t;
          t = Ai[c * n + j]; Ai[c * n + j] = Ai[p * n + j]; Ai[p * n + j] = t;
        }
      }
      const rc = c * n, pr = Ar[rc + c], pi = Ai[rc + c], pm = pr * pr + pi * pi;
      for (let r = c + 1; r < n; r++) {
        const rr = r * n, xr = Ar[rr + c], xi = Ai[rr + c];
        if (xr === 0 && xi === 0) continue;
        const fr = (xr * pr + xi * pi) / pm, fi = (xi * pr - xr * pi) / pm;
        Ar[rr + c] = fr; Ai[rr + c] = fi;            // keep the multiplier (L part)
        for (let j = c + 1; j < n; j++) {
          const ar = Ar[rc + j], ai = Ai[rc + j];
          Ar[rr + j] -= fr * ar - fi * ai; Ai[rr + j] -= fr * ai + fi * ar;
        }
      }
    }
    return { n, Ar, Ai, piv };
  }
  function luSolve(F, br0, bi0) {
    const { n, Ar, Ai, piv } = F;
    const br = Float64Array.from(br0), bi = Float64Array.from(bi0);
    for (let c = 0; c < n; c++) { const p = piv[c]; if (p !== c) { let t = br[c]; br[c] = br[p]; br[p] = t; t = bi[c]; bi[c] = bi[p]; bi[p] = t; } }
    for (let c = 0; c < n; c++) {
      const vr = br[c], vi = bi[c]; if (vr === 0 && vi === 0) continue;
      for (let r = c + 1; r < n; r++) {
        const fr = Ar[r * n + c], fi = Ai[r * n + c];
        if (fr === 0 && fi === 0) continue;
        br[r] -= fr * vr - fi * vi; bi[r] -= fr * vi + fi * vr;
      }
    }
    const xr = new Float64Array(n), xi = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let sr = br[r], si = bi[r];
      for (let j = r + 1; j < n; j++) {
        const ar = Ar[r * n + j], ai = Ai[r * n + j];
        sr -= ar * xr[j] - ai * xi[j]; si -= ar * xi[j] + ai * xr[j];
      }
      const pr = Ar[r * n + r], pi = Ai[r * n + r], pm = pr * pr + pi * pi;
      xr[r] = (sr * pr + si * pi) / pm; xi[r] = (si * pr - sr * pi) / pm;
    }
    return [xr, xi];
  }

  /* ---------- locate a feed/load gap: returns {seg, half, wireDir} ---------- */
  function locate(mesh, spec) {
    const p = parsePos(spec);
    if (!p) return null;
    const list = mesh.wireSegs[p.wire];
    if (!list || !list.length) return null;
    let si, atEnd;
    if (p.where === 'b') { si = list[0]; atEnd = false; }
    else if (p.where === 'e') { si = list[list.length - 1]; atEnd = true; }
    else {
      // node nearest the wire centre
      let tot = 0; list.forEach(s => tot += mesh.segs[s].len);
      let t = 0, best = 0, bd = Infinity;
      for (let k = 0; k < list.length - 1; k++) { t += mesh.segs[list[k]].len; const d = Math.abs(t - tot / 2); if (d < bd) { bd = d; best = k; } }
      if (list.length === 1) { si = list[0]; atEnd = false; } else { si = list[best]; atEnd = true; }
    }
    return { seg: si, half: 2 * si + (atEnd ? 1 : 0), dir: mesh.segs[si].dir };
  }

  /* basis participation in a half: returns sign (+1/-1) of flow vs. dir, or 0 */
  function partSign(b, half, dir) {
    let s = 0;
    if (b.a && b.a.half === half) s += dot(b.a.d, dir) > 0 ? 1 : -1;
    if (b.b && b.b.half === half) s += dot(b.b.d, dir) > 0 ? 1 : -1;
    return s;
  }

  /* ---------- main solve ---------- */
  /* Sommerfeld remainder: for every pair of half segments (test i, source j), with unit directions u,
   *   G_ij = int_i int_j u_i . E_rem(r_i; r_j, u_j) dl dl,   E_rem from the interpolation table,
   * then Z_mn += (eta / 4 pi) (j / k) sum s s' G over the pieces of test basis m and source basis n.
   * Reciprocity makes G symmetric, so only j >= i is computed. */
  function sommerfeldFill(mesh, sctx, k, pre, Zr, Zi) {
    const { halves, bases } = mesh, Hn = halves.length, N = bases.length;
    let zmin = Infinity, zmax = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, Lmax = 0;
    halves.forEach(h => [h.p0, h.p1].forEach(p => {
      zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    }));
    halves.forEach(h => { Lmax = Math.max(Lmax, h.len); });
    const rhoMax = Math.hypot(x1 - x0, y1 - y0), Rmin = Math.max(2 * zmin, 1e-4);
    const tab = SOMM.table(sctx, Rmin, Math.hypot(rhoMax, 2 * zmax) + 1e-6, Math.max(0.2, Math.atan2(rhoMax, Rmin)));
    mesh.sommPoints = tab.points;
    const used = new Uint8Array(Hn);
    bases.forEach(b => [b.a, b.b].forEach(pp => { if (pp) used[pp.half] = 1; }));
    const list = []; for (let h = 0; h < Hn; h++) if (used[h]) list.push(h);
    const idx = new Int32Array(Hn).fill(-1); list.forEach((h, i) => { idx[h] = i; });
    const M = list.length, Gr = new Float64Array(M * M), Gi = new Float64Array(M * M);
    const F = new Float64Array(8);
    const GQ = { 1: { x: [0], w: [2] } }; [2, 3, 4, 6].forEach(n => { GQ[n] = SOMM.gauss(n); });
    const field = (r, s, t, out) => {      // t . E at r from unit element s at source point (s carries the point)
      const dx = r[0] - s[0], dy = r[1] - s[1], rho = Math.hypot(dx, dy), Z = r[2] + s[2];
      tab.evalF(rho, Z, F);
      let cx = 1, cy = 0; if (rho > 1e-9) { cx = dx / rho; cy = dy / rho; }
      const u = s[3], v = s[4], w = s[5];
      const sr = u * cx + v * cy, sf = -u * cy + v * cx, tr = t[0] * cx + t[1] * cy, tf = -t[0] * cy + t[1] * cx, tz = t[2];
      const a1 = w * tz, a2 = w * tr - sr * tz, hr = sr * tr, hf = sf * tf;
      out[0] += a1 * F[0] + a2 * F[2] + hr * F[4] + hf * F[6];
      out[1] += a1 * F[1] + a2 * F[3] + hr * F[5] + hf * F[7];
    };
    const acc = new Float64Array(2), sp = new Float64Array(6), rp = [0, 0, 0];
    for (let a = 0; a < M; a++) {
      const hi = halves[list[a]], ui = hi.seg.dir, mi = hi.mid;
      for (let b = a; b < M; b++) {
        const hj = halves[list[b]], uj = hj.seg.dir, mj = hj.mid;
        const Rimg = Math.hypot(mi[0] - mj[0], mi[1] - mj[1], mi[2] + mj[2]), L = Math.max(hi.len, hj.len);
        const nq = Rimg > 4 * L ? 1 : Rimg > 2 * L ? 2 : Rimg > 1 * L ? 3 : Rimg > 0.5 * L ? 4 : 6;
        const g = GQ[nq];
        acc[0] = 0; acc[1] = 0;
        sp[3] = uj[0]; sp[4] = uj[1]; sp[5] = uj[2];
        for (let p = 0; p < nq; p++) {
          const tp = (1 + g.x[p]) / 2, wp = g.w[p] / 2 * hi.len;
          rp[0] = hi.p0[0] + (hi.p1[0] - hi.p0[0]) * tp; rp[1] = hi.p0[1] + (hi.p1[1] - hi.p0[1]) * tp; rp[2] = hi.p0[2] + (hi.p1[2] - hi.p0[2]) * tp;
          for (let q = 0; q < nq; q++) {
            const tq = (1 + g.x[q]) / 2, wq = g.w[q] / 2 * hj.len;
            sp[0] = hj.p0[0] + (hj.p1[0] - hj.p0[0]) * tq; sp[1] = hj.p0[1] + (hj.p1[1] - hj.p0[1]) * tq; sp[2] = hj.p0[2] + (hj.p1[2] - hj.p0[2]) * tq;
            const a0 = acc[0], a1 = acc[1];
            field(rp, sp, ui, acc);
            acc[0] = a0 + (acc[0] - a0) * wp * wq; acc[1] = a1 + (acc[1] - a1) * wp * wq;
          }
        }
        Gr[a * M + b] = Gr[b * M + a] = acc[0]; Gi[a * M + b] = Gi[b * M + a] = acc[1];
      }
    }
    // assemble: Z += pre (j/k) G  ->  Zr += -pre Gi / k, Zi += pre Gr / k
    const c = pre / k, pI = new Int32Array(2 * N).fill(-1), pS = new Float64Array(2 * N);
    bases.forEach((b, n) => [b.a, b.b].forEach((x, q) => { if (x) { pI[2 * n + q] = idx[x.half]; pS[2 * n + q] = Math.sign(dot(x.d, halves[x.half].seg.dir)); } }));
    for (let m = 0; m < N; m++) for (let qa = 0; qa < 2; qa++) {
      const oa = pI[2 * m + qa]; if (oa < 0) continue;
      const sa = pS[2 * m + qa] * c, row = m * N, oM = oa * M;
      for (let n = 0; n < N; n++) for (let qb = 0; qb < 2; qb++) {
        const ob = pI[2 * n + qb]; if (ob < 0) continue;
        const o = oM + ob, w = sa * pS[2 * n + qb];
        Zr[row + n] -= w * Gi[o]; Zi[row + n] += w * Gr[o];
      }
    }
  }

  /* If a model has more unknowns than the solver allows, long passive wires (longer than one wavelength,
   * carrying no source, load or transmission line, such as a mast or a long boom) are cut into coarser
   * segments, longest first: first lambda/20, then lambda/10. Their current usually varies slowly, so this
   * mostly changes the results little, but a passive wire close to the antenna carries induced current and
   * the effect depends on that coupling; the warning gives the counts so it can be checked. Models that fit are untouched. */
  const MAX_UNKNOWNS = 2500;
  function fitMesh(model, f) {
    const mesh = buildMesh(model, f);
    if (mesh.bases.length <= MAX_UNKNOWNS) return mesh;
    const lambda = lambdaOf(f);
    const active = new Set();
    (model.sources || []).concat(model.loads || []).forEach(s => { const p = parsePos(s.pos); if (p) active.add(p.wire); });
    (model.tls || []).forEach(t => [t.p1, t.p2].forEach(x => { const p = parsePos(x); if (p) active.add(p.wire); }));
    const lenOf = w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1, w.z2 - w.z1);
    const cand = (model.wires || []).map((w, i) => ({ i, L: lenOf(w) })).filter(o => !active.has(o.i) && o.L > lambda).sort((a, b) => b.L - a.L);
    if (!cand.length) return mesh;
    const segs = (model.wires || []).map(w => w.seg), done = [];
    for (const per of [20, 10]) {
      for (const c of cand) {
        segs[c.i] = Math.max(2, Math.ceil(c.L / (lambda / per)));
        if (!done.includes(c.i)) done.push(c.i);
        const m2 = Object.assign({}, model, { wires: model.wires.map((w, i) => (segs[i] === w.seg ? w : Object.assign({}, w, { seg: segs[i] }))) });
        const mesh2 = buildMesh(m2, f);
        if (mesh2.bases.length <= MAX_UNKNOWNS) {
          mesh2.warnings.push('To stay within ' + MAX_UNKNOWNS + ' unknowns, the long passive wire' + (done.length > 1 ? 's ' : ' ') +
            done.map(i => 'w' + (i + 1)).join(', ') + ' (no source, load or line on ' + (done.length > 1 ? 'them' : 'it') + ') ' + (done.length > 1 ? 'were' : 'was') +
            ' cut into coarser segments, about λ/' + per + ' at ' + f + ' MHz (' + done.map(i => 'w' + (i + 1) + ': ' + mesh2.wireSegs[i].length + ' segments').join(', ') + '). This usually changes the results little, but a passive wire close to the antenna carries induced current. To check, set Seg on those wires to these counts, then try finer counts on one wire at a time and compare impedance and gain.');
          return mesh2;
        }
      }
    }
    return mesh;
  }

  function checkGroundGeometry(model) {
    if (!model.ground || !(model.ground.type > 0)) return;
    const height = +model.ground.height || 0;
    const buried = model.wires.findIndex(w =>
      w.z1 + height <= -GROUND_CONTACT_TOL || w.z2 + height <= -GROUND_CONTACT_TOL);
    if (buried !== -1) throw new Error('Wire ' + (buried + 1) + ' extends below ground after the height offset. Buried wires and wires crossing the ground plane beyond the contact tolerance are unsupported.');
  }

  /* ---------- boom correction ----------
   * An element mounted through a metal boom resonates as if it were shorter than it is, so it must be cut longer
   * than its free-space length. DL6WU's measurements, curve-fitted by G3SEK: for a round boom bonded to the element,
   * the correction to the total element length is BC * boom diameter with
   *   BC = 733 B (0.055 - B) - 504 B (0.03 - B),  B = boom diameter in wavelengths (valid up to about 0.055),
   * and about half of that for an element insulated from the boom. The element length is not a parameter.
   * Sommerwire takes the entered lengths as built (through the boom) and shortens each element electrically by the
   * correction, so the boom itself is not drawn. Elements are straight open chains of wires square to the boom. */
  function straightGroups(wires) {
    const key = (x, y, z) => Math.round(x / 1e-5) + ',' + Math.round(y / 1e-5) + ',' + Math.round(z / 1e-5);
    const ends = new Map(), add = (k, i, e) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push([i, e]); };
    const ok = wires.map(w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1, w.z2 - w.z1) > 0);
    wires.forEach((w, i) => { if (!ok[i]) return; add(key(w.x1, w.y1, w.z1), i, 0); add(key(w.x2, w.y2, w.z2), i, 1); });
    const dirOf = w => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1, w.z2 - w.z1); return [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L, (w.z2 - w.z1) / L]; };
    const seen = new Set(), groups = [];
    wires.forEach((w0, i0) => {
      if (!ok[i0] || seen.has(i0)) return;
      const d0 = dirOf(w0), members = [i0]; seen.add(i0); let straight = true;
      const queue = [i0];
      while (queue.length) {
        const i = queue.pop(), w = wires[i];
        for (const k of [key(w.x1, w.y1, w.z1), key(w.x2, w.y2, w.z2)]) {
          const at = ends.get(k);
          if (at.length > 2) straight = false;
          for (const [j] of at) if (!seen.has(j)) {
            seen.add(j); members.push(j); queue.push(j);
            const d = dirOf(wires[j]); if (Math.abs(Math.abs(d[0] * d0[0] + d[1] * d0[1] + d[2] * d0[2]) - 1) > 1e-6) straight = false;
          }
        }
      }
      if (straight) groups.push({ members, dir: d0 });
    });
    return groups;
  }
  function boomFraction(B) { return 733 * B * (0.055 - B) - 504 * B * (0.03 - B); }
  function applyBoom(model, f) {
    const bm = model.boom;
    if (!bm || !(+bm.d > 0) || !(bm.mount === 'bonded' || bm.mount === 'insulated')) return model;
    const lambda = lambdaOf(f), D = +bm.d / 1000, B = D / lambda;
    const axis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[bm.axis] || [1, 0, 0];
    const notes = [];
    let frac = boomFraction(Math.min(B, 0.055));
    if (B > 0.055) notes.push('The boom is ' + B.toFixed(3) + ' λ thick, beyond the 0.055 λ the DL6WU/G3SEK correction covers; the correction for 0.055 λ was used.');
    if (bm.mount === 'insulated') frac *= 0.5;
    const corr = Math.max(0, frac * D);          // metres off the total element length
    if (!(corr > 0)) return model;
    const m = Object.assign({}, model, { wires: model.wires.map(w => Object.assign({}, w)) });
    const done = [];
    for (const g of straightGroups(model.wires)) {
      if (Math.abs(g.dir[0] * axis[0] + g.dir[1] * axis[1] + g.dir[2] * axis[2]) > 0.05) continue;   // not square to the boom
      // the two outer ends of the chain: the extreme projections on its direction
      let lo = Infinity, hi = -Infinity;
      const proj = (x, y, z) => x * g.dir[0] + y * g.dir[1] + z * g.dir[2];
      g.members.forEach(i => { const w = model.wires[i]; for (const t of [proj(w.x1, w.y1, w.z1), proj(w.x2, w.y2, w.z2)]) { lo = Math.min(lo, t); hi = Math.max(hi, t); } });
      if (hi - lo <= 2 * corr) continue;
      const moveEnd = (w, e, sgn) => { const k = e ? ['x2', 'y2', 'z2'] : ['x1', 'y1', 'z1']; k.forEach((c, q) => { w[c] += sgn * g.dir[q] * corr / 2; }); };
      g.members.forEach(i => {
        const w0 = model.wires[i], w = m.wires[i];
        if (Math.abs(proj(w0.x1, w0.y1, w0.z1) - lo) < 1e-6) moveEnd(w, 0, 1); else if (Math.abs(proj(w0.x1, w0.y1, w0.z1) - hi) < 1e-6) moveEnd(w, 0, -1);
        if (Math.abs(proj(w0.x2, w0.y2, w0.z2) - lo) < 1e-6) moveEnd(w, 1, 1); else if (Math.abs(proj(w0.x2, w0.y2, w0.z2) - hi) < 1e-6) moveEnd(w, 1, -1);
      });
      done.push(g.members.slice().sort((a, b) => a - b)[0]);
    }
    if (done.length) notes.push('Boom correction (' + (bm.mount === 'insulated' ? 'insulated' : 'bonded') + ' through a ' + (+bm.d) + ' mm boom): ' + done.length + ' element' + (done.length > 1 ? 's' : '') + ' (starting at ' + done.slice(0, 6).map(i => 'w' + (i + 1)).join(', ') + (done.length > 6 ? ' …' : '') + ') solved ' + (corr * 1000).toFixed(1) + ' mm shorter than drawn, so the lengths you entered are the lengths to cut.');
    else notes.push('Boom correction is on, but no straight element square to the ' + (bm.axis || 'x').toUpperCase() + ' axis was found.');
    m._boomNotes = notes;
    return m;
  }

  function solve(model, f) {
    checkGroundGeometry(model);
    model = applyBoom(model, f);
    const mesh = fitMesh(model, f);
    if (model._boomNotes) mesh.warnings.push(...model._boomNotes);
    const { segs, nodes, halves, bases, hasGround } = mesh;
    const N = bases.length;
    if (!segs.length) throw new Error('No wires defined.');
    if (!N) throw new Error('No connected current paths — every wire has two free ends and no source can drive it.');
    if (N > MAX_UNKNOWNS) throw new Error('Model too large (' + N + ' unknowns, maximum ' + MAX_UNKNOWNS + '), even with long passive wires cut into λ/10 segments. Reduce segment density.');
    const k = 2 * Math.PI / mesh.lambda;
    const omega = 2 * Math.PI * f * 1e6;
    const S = segs.length, Hn = halves.length;

    // Kernel tables are built one row at a time: all half pieces seen from a node, and all segments
    // seen from a test point. Bases are ordered by node and run along the wires, so rows are reused.
    const nNodes = nodes.length;
    const pt = i => (i < nNodes ? nodes[i].p : segs[i - nNodes].mid);
    const segM0 = segs.map(s => mirror(s.p0)), segM1 = segs.map(s => mirror(s.p1));
    // real ground (type 2): complex image unless the perfect mirror (as MININEC) was chosen
    const gnd = model.ground || {};
    // real ground (type 2) for the impedance: Sommerfeld (default), complex image, or perfect mirror (as MININEC)
    const wantSomm = hasGround && gnd.type === 2 && (gnd.nf === undefined || gnd.nf === '' || gnd.nf === 'sommerfeld' || gnd.nf === 'somm-pec-test');
    const wantComplex = hasGround && gnd.type === 2 && gnd.nf === 'complex';
    const earthed = new Set();
    // Structures connected to a ground node (found through the wire junctions). If there are any, the whole
    // model uses the perfect image: a perfect image for some wires and a complex one for others is not
    // energy-consistent (the feed resistance can even go negative), and a complex image cannot carry current
    // into the soil.
    {
      const par = nodes.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
      segs.forEach(sg => { const a = find(sg.n0), b = find(sg.n1); if (a !== b) par[a] = b; });
      const gc = new Set(); nodes.forEach((nd, i) => { if (nd.ground) gc.add(find(i)); });
      if (gc.size) segs.forEach(sg => { if (gc.has(find(sg.n0))) earthed.add(sg.wire); });
    }
    if ((wantComplex || wantSomm) && earthed.size) mesh.warnings.push('Wires touching the ground (' + [...earthed].map(w => 'w' + (w + 1)).slice(0, 6).join(', ') + (earthed.size > 6 ? ' …' : '') + '): the impedance is solved over perfect ground for the whole model, as MMANA does, because the complex image cannot carry current into the soil and mixing the two images is not energy-consistent. The far field still uses the real ground. Ground loss at those wires is only the load you place at their base (house downpipes include their earth resistance). This applies even to a wire far away or not connected to the antenna: if such a wire is not part of what you want to model, raise it off the ground or remove it.');
    const cdepth = wantComplex ? complexDepth(+gnd.eps || 13, Number.isFinite(+gnd.sigma) && gnd.sigma !== '' ? +gnd.sigma : 0.005, mesh.lambda) : null;
    const noImage = wantComplex && !cdepth;
    const allPec = earthed.size > 0;
    const somm = wantSomm && !allPec;
    // Sommerfeld ground: quasi-static image (perfect-mirror geometry scaled by Gamma) plus the tabulated remainder
    let gR = 1, gI = 0, sctx = null;
    if (somm) {
      const epsr = +gnd.eps || 13, epsi = 60 * mesh.lambda * (Number.isFinite(+gnd.sigma) && gnd.sigma !== '' ? +gnd.sigma : 0.005);
      sctx = SOMM.context(k, epsr, epsi, gnd.nf === 'somm-pec-test' ? 'pec' : undefined);
      gR = sctx.G[0]; gI = sctx.G[1];
    }
    if (cdepth && !allPec) {
      // the single complex image is an approximation that degrades toward the soil: for a 20 m dipole it reads
      // 0.7 dB too high at 0.14 lambda, 3.5 dB at 0.05 lambda and 5.9 dB at 0.014 lambda (against Sommerfeld)
      const lowW = new Set(); segs.forEach(sg => { if (Math.min(sg.p0[2], sg.p1[2]) < 0.2 * mesh.lambda) lowW.add(sg.wire); });
      if (lowW.size) mesh.warnings.push('Wires ' + [...lowW].map(w => 'w' + (w + 1)).slice(0, 6).join(', ') + (lowW.size > 6 ? ' …' : '') + ' run less than 0.2 λ (' + (0.2 * mesh.lambda).toFixed(1) + ' m) above real ground. The complex image underestimates ground loss there, so the feed resistance comes out too low and the gain too high (for a 20 m dipole about 0.7 dB at 3 m, 3.5 dB at 1 m), and very close to the soil the resistance can even go negative. Choose Sommerfeld for the impedance over real ground.');
    }
    const halfM0 = halves.map(h => mirror(h.p0)), halfM1 = halves.map(h => mirror(h.p1));
    let hNode = -1;
    const hRow = new Float64Array(Hn * 2), hRowI = hasGround ? new Float64Array(Hn * 2) : null;
    function halfRow(ni) {
      if (ni === hNode) return;
      hNode = ni; const r = nodes[ni].p;
      for (let hh = 0; hh < Hn; hh++) {
        const hv = halves[hh];
        psi(r, hv.p0, hv.p1, hv.seg.a, k, hRow, 2 * hh);
        if (hasGround) { const pec = allPec; if (cdepth && !pec) psiImg(r, hv.p0, hv.p1, hv.seg.a, k, cdepth[0], cdepth[1], hRowI, 2 * hh); else if (noImage && !pec) { hRowI[2 * hh] = 0; hRowI[2 * hh + 1] = 0; } else psi(r, halfM0[hh], halfM1[hh], hv.seg.a, k, hRowI, 2 * hh); }
      }
    }
    const fullCache = new Map();
    function fullRow(pi) {
      let e = fullCache.get(pi); if (e) return e;
      const r = pt(pi), row = new Float64Array(S * 2), rowI = hasGround ? new Float64Array(S * 2) : null;
      for (let q = 0; q < S; q++) {
        const sg = segs[q];
        psi(r, sg.p0, sg.p1, sg.a, k, row, 2 * q);
        if (hasGround) { const pec = allPec; if (cdepth && !pec) psiImg(r, sg.p0, sg.p1, sg.a, k, cdepth[0], cdepth[1], rowI, 2 * q); else if (noImage && !pec) { rowI[2 * q] = 0; rowI[2 * q + 1] = 0; } else psi(r, segM0[q], segM1[q], sg.a, k, rowI, 2 * q); }
      }
      e = [row, rowI]; fullCache.set(pi, e);
      if (fullCache.size > 8) fullCache.delete(fullCache.keys().next().value);
      return e;
    }
    const bH = new Int32Array(N * 2).fill(-1), bS = new Int32Array(N * 2), bC = new Float64Array(N * 2), bD = new Float64Array(N * 6);
    bases.forEach((b, n) => [b.a, b.b].forEach((pp, q) => {
      if (!pp) return;
      bH[2 * n + q] = pp.half; bS[2 * n + q] = pp.seg; bC[2 * n + q] = pp.c;
      bD[6 * n + 3 * q] = pp.d[0]; bD[6 * n + 3 * q + 1] = pp.d[1]; bD[6 * n + 3 * q + 2] = pp.d[2];
    }));

    const Zr = new Float64Array(N * N), Zi = new Float64Array(N * N);
    const pre = ETA / (4 * Math.PI);
    for (let m = 0; m < N; m++) {
      const bm = bases[m];
      halfRow(bm.node);
      const t = add(scl(bm.a.d, segs[bm.a.seg].len / 2), bm.b ? scl(bm.b.d, segs[bm.b.seg].len / 2) : [0, 0, 0]);
      const tx = t[0], ty = t[1], tz = t[2];
      const [FA, FAi] = fullRow(nNodes + bm.a.seg);
      const [FB, FBi] = fullRow(bm.b ? nNodes + bm.b.seg : bm.node);
      const row = m * N;
      for (let n = 0; n < N; n++) {
        // vector potential jk t_m . sum d psi_half(P_m) and scalar potential (1/jk) sum c [psi(pb) - psi(pa)]
        let ar = 0, ai = 0, sr = 0, si = 0, iar = 0, iai = 0, isr = 0, isi = 0;
        for (let q = 0; q < 2; q++) {
          const hh = bH[2 * n + q]; if (hh < 0) continue;
          const od = 6 * n + 3 * q, dx = bD[od], dy = bD[od + 1], dz = bD[od + 2];
          const td = tx * dx + ty * dy + tz * dz;
          ar += td * hRow[2 * hh]; ai += td * hRow[2 * hh + 1];
          const s2 = 2 * bS[2 * n + q], c = bC[2 * n + q];
          sr += c * (FB[s2] - FA[s2]); si += c * (FB[s2 + 1] - FA[s2 + 1]);
          if (hasGround) {
            // image current (-Jx, -Jy, Jz), image charge negated
            const ti = -tx * dx - ty * dy + tz * dz;
            iar += ti * hRowI[2 * hh]; iai += ti * hRowI[2 * hh + 1];
            isr -= c * (FBi[s2] - FAi[s2]); isi -= c * (FBi[s2 + 1] - FAi[s2 + 1]);
          }
        }
        let zr = pre * (-k * ai + si / k), zi = pre * (k * ar - sr / k);
        if (hasGround) {
          const yr = pre * (-k * iai + isi / k), yi = pre * (k * iar - isr / k);
          zr += gR * yr - gI * yi; zi += gR * yi + gI * yr;
        }
        Zr[row + n] = zr; Zi[row + n] = zi;
      }
    }

    if (somm) sommerfeldFill(mesh, sctx, k, pre, Zr, Zi);

    // conductor loss (skin effect) on shared halves
    let hMap = null;
    const byHalf = () => {
      if (hMap) return hMap; hMap = new Map();
      bases.forEach((b, i) => [b.a, b.b].forEach(pp => { if (pp) { if (!hMap.has(pp.half)) hMap.set(pp.half, []); hMap.get(pp.half).push([i, pp.d]); } }));
      return hMap;
    };
    const mat = MATERIALS[model.material | 0] || MATERIALS[0];
    if (isFinite(mat.sigma)) {
      const Rs = Math.sqrt(omega * MU0 * (mat.mu || 1) / (2 * mat.sigma));
      // a magnetic wire also has internal inductance equal to its skin resistance
      const Xs = mat.mu > 1 ? Rs : 0;
      byHalf().forEach((list, hi) => {
        const h = halves[hi]; const r = Rs / (2 * Math.PI * h.seg.a) * h.len, x = Xs / (2 * Math.PI * h.seg.a) * h.len;
        for (const [i, di] of list) for (const [j, dj] of list) { const d = dot(di, dj); Zr[i * N + j] += r * d; Zi[i * N + j] += x * d; }
      });
    }
    // insulated wire: a distributed series impedance per metre (the thin-sheath approximation NEC-4 also uses)
    //   Z' = j omega mu0/(2 pi) (1 - 1/eps*) ln(b/a),  eps* = eps_r (1 - j tan d)
    const ins = model.ins;
    if (ins && +ins.t > 0 && +ins.er >= 1) {
      const er = +ins.er, td = +ins.tand > 0 ? +ins.tand : 0, dd = er * (1 + td * td);
      const A = 1 - 1 / dd, B = td / dd, set = Array.isArray(ins.wires) ? new Set(ins.wires) : null;
      byHalf().forEach((list, hi) => {
        const h = halves[hi]; if (set && !set.has(h.seg.wire)) return;
        const a = h.seg.a, b = a + ins.t / 1000;
        const X0 = omega * MU0 / (2 * Math.PI) * Math.log(b / a) * h.len;
        const r = X0 * B, x = X0 * A;
        for (const [i, di] of list) for (const [j, dj] of list) { const d = dot(di, dj); Zr[i * N + j] += r * d; Zi[i * N + j] += x * d; }
      });
    }

    // lumped loads
    const loadsUsed = [];
    (model.loads || []).forEach(ld => {
      const loc = locate(mesh, ld.pos); if (!loc) return;
      let zr, zi;
      if (ld.type === 1) { zr = +ld.R || 0; zi = +ld.X || 0; }
      else {
        // coil: omega*L/Q in series with jwL, optionally across its own self-capacitance Cp;
        // capacitor: -j/(wC) with loss 1/(wC Qc) in series. Type 0 puts them in series, type 2 in parallel (trap).
        const L = (+ld.L || 0) * 1e-6, Cc = (+ld.C || 0) * 1e-12, Cp = (+ld.Cp || 0) * 1e-12;
        const par = (ar, ai, br, bi) => { const nr = ar * br - ai * bi, ni = ar * bi + ai * br, [qr, qi] = divC(nr, ni, ar + br, ai + bi); return [qr, qi]; };
        let lr = L > 0 && ld.Q > 0 ? omega * L / ld.Q : 0, li = omega * L;
        if (L > 0 && Cp > 0) [lr, li] = par(lr, li, 0, -1 / (omega * Cp));
        const cr = Cc > 0 && ld.Qc > 0 ? 1 / (omega * Cc * ld.Qc) : 0, ci = Cc > 0 ? -1 / (omega * Cc) : 0;
        if (ld.type === 2) {
          if (!(Cc > 0)) { zr = lr; zi = li; }
          else if (!(L > 0)) { zr = cr; zi = ci; }
          else [zr, zi] = par(lr, li, cr, ci);
        } else { zr = lr + cr; zi = li + ci; }
        if (+ld.R) zr += +ld.R;
      }
      const sg = bases.map(b => partSign(b, loc.half, loc.dir));
      for (let i = 0; i < N; i++) if (sg[i]) for (let j = 0; j < N; j++) if (sg[j]) { Zr[i * N + j] += zr * sg[i] * sg[j]; Zi[i * N + j] += zi * sg[i] * sg[j]; }
      loadsUsed.push(ld);
    });

    // ---- transmission lines ----
    // Like NEC's TL card: each line end is connected in parallel across a feed gap ("port").
    // The antenna is solved once per port (unit gap voltage); the ports then form a small network
    //   (Y_antenna + Y_lines) V = J,
    // where J is non-zero only at ports driven by a source. Sources elsewhere stay ordinary series sources.
    const fac = luFactor(N, Zr, Zi);
    const ports = [], portByHalf = new Map();
    const gapOf = spec => {
      const loc = locate(mesh, spec); if (!loc) return null;
      const sg = new Float64Array(N); let any = false;
      bases.forEach((b, i) => { const sv = partSign(b, loc.half, loc.dir); if (sv) { sg[i] = sv; any = true; } });
      if (!any) return null;
      const sgm = segs[loc.seg];
      return { loc, sg, pt: loc.half % 2 ? sgm.p1 : sgm.p0 };
    };
    const portIndex = g => {
      if (portByHalf.has(g.loc.half)) return portByHalf.get(g.loc.half);
      ports.push({ sg: g.sg, pt: g.pt, src: null }); portByHalf.set(g.loc.half, ports.length - 1);
      return ports.length - 1;
    };
    const lines = [];
    (model.tls || []).forEach((t, ti) => {
      const ga = gapOf(t.p1), gb = gapOf(t.p2);
      if (!ga || !gb || ga.loc.half === gb.loc.half) {
        mesh.warnings.push('Transmission line ' + (ti + 1) + ' (' + t.p1 + ' to ' + t.p2 + ') needs two different points on wires, not free wire ends. It was left out.');
        return;
      }
      const a = portIndex(ga), b = portIndex(gb);
      const L = +t.len > 0 ? +t.len : len(sub(ga.pt, gb.pt));
      if (!(L > 0)) { mesh.warnings.push('Transmission line ' + (ti + 1) + ' has zero length. It was left out.'); return; }
      // matched loss in dB per 100 m, given at lossF MHz and scaled with sqrt(f) (skin effect), or as is without lossF
      const dbm = +t.loss > 0 ? +t.loss / 100 * (+t.lossF > 0 ? Math.sqrt(f / +t.lossF) : 1) : 0;
      lines.push({ a, b, z0: +t.z0 > 0 ? +t.z0 : 50, vf: +t.vf > 0 ? Math.min(1, +t.vf) : 1, L, rev: !!t.rev, alpha: dbm / (20 / Math.LN10) });
    });

    // ---- sources: on a line port they drive the network, elsewhere they are series gap sources ----
    const br = new Float64Array(N), bi = new Float64Array(N);
    const srcs = [];
    (model.sources || []).forEach(sc => {
      const loc = locate(mesh, sc.pos); if (!loc) return;
      const ph = (+sc.phase || 0) * Math.PI / 180, mag = (sc.mag === undefined || sc.mag === '') ? 1 : +sc.mag;
      const vr = mag * Math.cos(ph), vi = mag * Math.sin(ph);
      if (portByHalf.has(loc.half)) {
        const k = portByHalf.get(loc.half);
        if (ports[k].src) { mesh.warnings.push('Two sources on the same feed point ' + sc.pos + '; only the first is used.'); return; }
        ports[k].src = { vr, vi }; srcs.push({ spec: sc.pos, vr, vi, port: k, ratio: +sc.ratio > 0 ? +sc.ratio : 1 }); return;
      }
      const sg = bases.map(b => partSign(b, loc.half, loc.dir));
      if (!sg.some(x => x)) { mesh.warnings.push('Source ' + sc.pos + ' sits on a free wire end and cannot be fed.'); return; }
      sg.forEach((sv, i) => { if (sv) { br[i] += sv * vr; bi[i] += sv * vi; } });
      srcs.push({ spec: sc.pos, vr, vi, sg, ratio: +sc.ratio > 0 ? +sc.ratio : 1 });
    });
    if (!srcs.length) throw new Error('No valid source. Add a source such as "w1c" (wire 1 centre).');

    const [x0r, x0i] = luSolve(fac, br, bi);
    let Ir = x0r, Ii = x0i;
    const P = ports.length;
    const Ytr = new Float64Array(P * P), Yti = new Float64Array(P * P);
    const g0r = new Float64Array(P), g0i = new Float64Array(P), Vr = new Float64Array(P), Vi = new Float64Array(P);
    if (P) {
      const dotS = (sg, vr, vi) => { let a = 0, b = 0; for (let i = 0; i < N; i++) if (sg[i]) { a += sg[i] * vr[i]; b += sg[i] * vi[i]; } return [a, b]; };
      const Xr = [], Xi = [];
      ports.forEach(pt => { const [r, im] = luSolve(fac, pt.sg, new Float64Array(N)); Xr.push(r); Xi.push(im); });
      for (let a = 0; a < P; a++) {
        for (let b = 0; b < P; b++) { const [yr, yi] = dotS(ports[a].sg, Xr[b], Xi[b]); Ytr[a * P + b] = yr; Yti[a * P + b] = yi; }
        const [gr, gi] = dotS(ports[a].sg, x0r, x0i); g0r[a] = gr; g0i[a] = gi;
      }
      // line with gamma = alpha + j beta: Y11 = Y22 = coth(gamma l)/Z0, Y12 = Y21 = -csch(gamma l)/Z0
      // (sign flipped when reversed); lossless this is -j cot(bl)/Z0 and +j csc(bl)/Z0
      const k0 = 2 * Math.PI * f / C0;
      lines.forEach(l => {
        const al = l.alpha * l.L;
        let th = k0 / l.vf * l.L; if (al < 1e-9 && Math.abs(Math.sin(th)) < 1e-9) th += 1e-6;
        const shr = Math.sinh(al) * Math.cos(th), shi = Math.cosh(al) * Math.sin(th);
        const chr = Math.cosh(al) * Math.cos(th), chi = Math.sinh(al) * Math.sin(th);
        const [ctr, cti] = divC(chr, chi, shr, shi), [csr, csi] = divC(1, 0, shr, shi), sg = l.rev ? -1 : 1;
        Ytr[l.a * P + l.a] += ctr / l.z0; Yti[l.a * P + l.a] += cti / l.z0;
        Ytr[l.b * P + l.b] += ctr / l.z0; Yti[l.b * P + l.b] += cti / l.z0;
        Ytr[l.a * P + l.b] -= sg * csr / l.z0; Yti[l.a * P + l.b] -= sg * csi / l.z0;
        Ytr[l.b * P + l.a] -= sg * csr / l.z0; Yti[l.b * P + l.a] -= sg * csi / l.z0;
      });
      const U = [], F = [];
      ports.forEach((pt, kk) => { if (pt.src) { F.push(kk); Vr[kk] = pt.src.vr; Vi[kk] = pt.src.vi; } else U.push(kk); });
      if (U.length) {
        const n = U.length, Ar = new Float64Array(n * n), Ai = new Float64Array(n * n), rr = new Float64Array(n), ri = new Float64Array(n);
        U.forEach((pu, r) => {
          U.forEach((qu, c) => { Ar[r * n + c] = Ytr[pu * P + qu]; Ai[r * n + c] = Yti[pu * P + qu]; });
          let sr = -g0r[pu], si = -g0i[pu];
          F.forEach(qf => { const yr = Ytr[pu * P + qf], yi = Yti[pu * P + qf]; sr -= yr * Vr[qf] - yi * Vi[qf]; si -= yr * Vi[qf] + yi * Vr[qf]; });
          rr[r] = sr; ri[r] = si;
        });
        const [vr, vi] = luSolve(luFactor(n, Ar, Ai), rr, ri);
        U.forEach((pu, r) => { Vr[pu] = vr[r]; Vi[pu] = vi[r]; });
      }
      Ir = Float64Array.from(x0r); Ii = Float64Array.from(x0i);
      for (let kk = 0; kk < P; kk++) {
        const vr = Vr[kk], vi = Vi[kk]; if (vr === 0 && vi === 0) continue;
        const XR = Xr[kk], XI = Xi[kk];
        for (let i = 0; i < N; i++) { Ir[i] += XR[i] * vr - XI[i] * vi; Ii[i] += XR[i] * vi + XI[i] * vr; }
      }
    }

    // source results
    let Pin = 0;
    const sourceResults = srcs.map(sr => {
      let ir = 0, ii = 0;
      if (sr.port !== undefined) {
        // current delivered by the source = current into the antenna gap + current into the lines
        const kk = sr.port; ir = g0r[kk]; ii = g0i[kk];
        for (let q = 0; q < P; q++) { const yr = Ytr[kk * P + q], yi = Yti[kk * P + q]; ir += yr * Vr[q] - yi * Vi[q]; ii += yr * Vi[q] + yi * Vr[q]; }
      } else sr.sg.forEach((g, i) => { if (g) { ir += g * Ir[i]; ii += g * Ii[i]; } });
      const den = ir * ir + ii * ii;
      const zr = (sr.vr * ir + sr.vi * ii) / den, zi = (sr.vi * ir - sr.vr * ii) / den;
      const pw = 0.5 * (sr.vr * ir + sr.vi * ii);
      Pin += pw;
      // an ideal feed transformer (balun / unun, impedance ratio n:1) divides the impedance seen by the feeder
      return { spec: sr.spec, R: zr / sr.ratio, X: zi / sr.ratio, Rant: zr, Xant: zi, ratio: sr.ratio, Ir: ir, Ii: ii, V: Math.hypot(sr.vr, sr.vi), P: pw };
    });

    // half currents along segment direction
    const hr = new Float64Array(Hn), hiA = new Float64Array(Hn);
    bases.forEach((b, i) => [b.a, b.b].forEach(pp => {
      if (!pp) return;
      const sg = dot(pp.d, segs[pp.seg].dir) > 0 ? 1 : -1;
      hr[pp.half] += sg * Ir[i]; hiA[pp.half] += sg * Ii[i];
    }));
    const segCur = segs.map((s, i) => {
      const r = 0.5 * (hr[2 * i] + hr[2 * i + 1]), im = 0.5 * (hiA[2 * i] + hiA[2 * i + 1]);
      return { re: r, im, mag: Math.hypot(r, im) };
    });

    if (sourceResults.some(sr => sr.R < 0)) mesh.warnings.push('Negative feed resistance: this result is not physical. Usually a ground approximation is stretched too far (see any ground warning) or the segmentation is too coarse.');
    // currents solved over a perfect mirror while the pattern uses real-ground (Fresnel) reflection, as MMANA does:
    // the two do not conserve energy, and close to the ground the gain comes out too high
    const mirrorMix = hasGround && gnd.type === 2 && (allPec || (!wantSomm && !wantComplex) || gnd.nf === 'somm-pec-test');
    return { f, lambda: mesh.lambda, k, mesh, sources: sourceResults, Pin, halfRe: hr, halfIm: hiA, segCur, N, warnings: mesh.warnings, mirrorMix, earthed: [...earthed].sort((a, b) => a - b) };
  }

  /* ---------- far field ---------- */
  function sqrtC(re, im) {
    const m = Math.hypot(re, im);
    let r = Math.sqrt((m + re) / 2), i = Math.sqrt(Math.max(0, (m - re) / 2));
    if (im < 0) i = -i;
    return [r, i];
  }
  function divC(ar, ai, br, bi) { const d = br * br + bi * bi; return [(ar * br + ai * bi) / d, (ai * br - ar * bi) / d]; }

  function makePattern(res, model) {
    const { mesh, k } = res;
    const g = model.ground || { type: 0 };
    const H = mesh.halves;
    const n = H.length;
    const X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n);
    const Jr = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    const Ji = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    H.forEach((h, i) => {
      X[i] = h.mid[0]; Y[i] = h.mid[1]; Z[i] = h.mid[2];
      const d = h.seg.dir;
      for (let c = 0; c < 3; c++) { Jr[c][i] = res.halfRe[i] * h.len * d[c]; Ji[c][i] = res.halfIm[i] * h.len * d[c]; }
    });
    const lambda = mesh.lambda;
    const epsC = [(+g.eps || 13), -60 * lambda * (Number.isFinite(+g.sigma) && g.sigma !== '' ? +g.sigma : 0.005)];
    const Pin = res.Pin;
    const K = ETA * k * k / (32 * Math.PI * Math.PI);

    // returns gains in linear (relative to isotropic): {tot, v, h}
    function gain(elDeg, azDeg) {
      const e = elDeg * Math.PI / 180, a = azDeg * Math.PI / 180;
      if (g.type > 0 && e < 0) return { tot: 0, v: 0, h: 0 };
      const ce = Math.cos(e), se = Math.sin(e), ca = Math.cos(a), sa = Math.sin(a);
      const ux = ce * ca, uy = ce * sa, uz = se;
      const th = [se * ca, se * sa, -ce], ph = [-sa, ca, 0];
      let dtr = 0, dti = 0, dpr = 0, dpi = 0, itr = 0, iti = 0, ipr = 0, ipi = 0;
      for (let i = 0; i < n; i++) {
        const phase = k * (ux * X[i] + uy * Y[i] + uz * Z[i]);
        const c = Math.cos(phase), s = Math.sin(phase);
        const jxr = Jr[0][i], jyr = Jr[1][i], jzr = Jr[2][i], jxi = Ji[0][i], jyi = Ji[1][i], jzi = Ji[2][i];
        const atr = jxr * th[0] + jyr * th[1] + jzr * th[2], ati = jxi * th[0] + jyi * th[1] + jzi * th[2];
        const apr = jxr * ph[0] + jyr * ph[1], api = jxi * ph[0] + jyi * ph[1];
        dtr += atr * c - ati * s; dti += atr * s + ati * c;
        dpr += apr * c - api * s; dpi += apr * s + api * c;
        if (g.type > 0) {
          const p2 = k * (ux * X[i] + uy * Y[i] - uz * Z[i]);
          const c2 = Math.cos(p2), s2 = Math.sin(p2);
          // image current (-Jx,-Jy,Jz)
          const btr = -jxr * th[0] - jyr * th[1] + jzr * th[2], bti = -jxi * th[0] - jyi * th[1] + jzi * th[2];
          const bpr = -jxr * ph[0] - jyr * ph[1], bpi = -jxi * ph[0] - jyi * ph[1];
          itr += btr * c2 - bti * s2; iti += btr * s2 + bti * c2;
          ipr += bpr * c2 - bpi * s2; ipi += bpr * s2 + bpi * c2;
        }
      }
      if (g.type === 1) { dtr += itr; dti += iti; dpr += ipr; dpi += ipi; }
      else if (g.type === 2) {
        const cos2 = ce * ce;
        const [qr, qi] = sqrtC(epsC[0] - cos2, epsC[1]);
        const [rvr, rvi] = divC(epsC[0] * se - qr, epsC[1] * se - qi, epsC[0] * se + qr, epsC[1] * se + qi);
        const [rhr, rhi] = divC(se - qr, -qi, se + qr, qi);
        dtr += rvr * itr - rvi * iti; dti += rvr * iti + rvi * itr;
        // horizontal: -Rh * image
        dpr += -(rhr * ipr - rhi * ipi); dpi += -(rhr * ipi + rhi * ipr);
      }
      const v = 4 * Math.PI * K * (dtr * dtr + dti * dti) / Pin * scale;
      const h = 4 * Math.PI * K * (dpr * dpr + dpi * dpi) / Pin * scale;
      return { tot: v + h, v, h };
    }

    // Radiated power over input power: the mean gain over the sphere (hemisphere above ground), midpoint rule
    function powerRatio() {
      const de = 2, da = 5, e0 = g.type > 0 ? 0 : -90, r = Math.PI / 180;
      let sum = 0;
      for (let e = e0 + de / 2; e < 90; e += de) {
        let ring = 0; for (let a = da / 2; a < 360; a += da) ring += gain(e, a).tot;
        sum += ring * Math.cos(e * r) * de * r * da * r;
      }
      return sum / (4 * Math.PI);
    }
    // With mirror currents and real-ground reflection the pattern can hold more power than the feed supplies.
    // Then scale it down so radiated power equals input power: still optimistic, but no longer impossible.
    let scale = 1, ratio = null;
    if (res.mirrorMix && Pin > 0) { ratio = powerRatio(); if (ratio > 1) scale = 1 / ratio; }

    function findMax() {
      const e0 = g.type > 0 ? 0 : -90;
      let best = { g: -1, el: 0, az: 0 };
      const els = [];
      for (let el = e0; el <= 90; el += 5) els.push(el);
      els.sort((x, y) => Math.abs(x) - Math.abs(y));   // ties resolve toward the horizon
      for (const el of els) for (let az = 0; az < 360; az += 5) {
        const G = gain(el, az).tot; if (G > best.g * (1 + 1e-9)) best = { g: G, el, az };
      }
      for (let step of [1.5, 0.5, 0.25]) {
        const c = best;
        for (let el = c.el - 3 * step; el <= c.el + 3 * step; el += step) {
          if (el < e0 || el > 90) continue;
          for (let az = c.az - 3 * step; az <= c.az + 3 * step; az += step) {
            const G = gain(el, az).tot; if (G > best.g * (1 + 1e-9)) best = { g: G, el, az: (az + 360) % 360 };
          }
        }
      }
      return best;
    }
    return { gain, findMax, powerRatio, ratio, scale };
  }

  const dB = x => (x > 1e-30 ? 10 * Math.log10(x) : -300);

  function analyze(model, f, opts) {
    const res = solve(model, f);
    const pat = makePattern(res, model);
    const mx = pat.findMax();
    const front = pat.gain(mx.el, mx.az), back = pat.gain(mx.el, (mx.az + 180) % 360);
    const s0 = res.sources[0];
    const z0 = +(model.z0 || 50);
    const gr = divC(s0.R - z0, s0.X, s0.R + z0, s0.X);
    const gm = Math.hypot(gr[0], gr[1]);
    const swr = gm >= 1 ? Infinity : (1 + gm) / (1 - gm);
    const capDb = pat.scale < 1 ? -dB(pat.scale) : 0;
    if (res.mirrorMix) res.warnings.push(capDb > 0
      ? 'Gain is approximate and was limited: the currents are solved over a perfect mirror while the pattern uses real-ground reflection. The pattern held ' + pat.ratio.toFixed(2) + ' times the input power, which is impossible, so all gains were lowered by ' + capDb.toFixed(1) + ' dB to make radiated power equal input power. The real gain is lower still, because the soil absorbs power. Impedance and SWR are those over the perfect mirror.'
      : 'Gain is approximate: the currents are solved over a perfect mirror while the pattern uses real-ground reflection, as MMANA-GAL does. Close to the ground this overstates gain.');
    return {
      res, pat, f, R: s0.R, X: s0.X, swr, z0, approx: !!res.mirrorMix, capDb,
      gain: dB(mx.g), el: mx.el, az: mx.az, fb: (fbRaw => (Math.abs(fbRaw) < 1e-9 ? 0 : fbRaw))(dB(front.tot) - dB(back.tot)),
      pol: front.h >= front.v ? 'Horizontal' : 'Vertical',
      gainH: dB(front.h), gainV: dB(front.v)
    };
  }

  /* ---------- angle summary and RDF ----------
   * Both work on one sampling of the pattern over the visible sky (skyGrid): every `de` degrees of elevation from the
   * horizon (free space: from -90) to the zenith, every `da` degrees of azimuth. All averages are averages of LINEAR
   * power gain weighted by solid angle (dOmega = cos(el) d el d az), never averages of dB values.
   * The elevation weights integrate a gain that is piecewise linear between the samples exactly, so a constant gain
   * returns the exact solid angle; the azimuth sum is the periodic trapezoid rule.
   * "V" and "H" are the theta and phi components, as everywhere else in the program. */
  const RAD = Math.PI / 180;
  function skyGrid(pat, hasGround, opts) {
    const de = (opts && opts.de) || 1, da = (opts && opts.da) || 4;
    const e0 = hasGround ? 0 : -90, nE = Math.round((90 - e0) / de) + 1, nA = Math.round(360 / da);
    if (!(de > 0 && da > 0) || Math.abs((nE - 1) * de - (90 - e0)) > 1e-9 || Math.abs(nA * da - 360) > 1e-9) throw new Error('Sky grid: the steps must divide 90 and 360 degrees');
    const els = Array.from({ length: nE }, (_, i) => e0 + i * de), azs = Array.from({ length: nA }, (_, i) => i * da);
    const tot = new Float64Array(nE * nA), v = new Float64Array(nE * nA), h = new Float64Array(nE * nA);
    for (let i = 0; i < nE; i++) for (let j = 0; j < nA; j++) {
      const G = pat.gain(els[i], azs[j]), k = i * nA + j;
      if (!(G.v >= 0 && G.h >= 0 && Number.isFinite(G.v + G.h))) throw new Error('The pattern is not finite at ' + els[i] + '° elevation, ' + azs[j] + '° azimuth');
      v[k] = G.v; h[k] = G.h; tot[k] = G.v + G.h;
    }
    return { els, azs, de, da, e0, nA, tot, v, h, hasGround: !!hasGround, gain: pat.gain };
  }
  function gridIndex(grid, el, what) {
    const i = Math.round((el - grid.e0) / grid.de);
    if (!Number.isFinite(el) || i < 0 || i >= grid.els.length || Math.abs(grid.els[i] - el) > 1e-9) throw new Error(what + ': ' + el + '° is not an elevation of the sky grid (' + grid.e0 + ' to 90° in steps of ' + grid.de + '°)');
    return i;
  }
  // band of elevations [a, b] (deg), all azimuths: solid angle, solid-angle mean of the linear gains, and the largest samples
  function bandStats(grid, a, b) {
    const ia = gridIndex(grid, a, 'Band start'), ib = gridIndex(grid, b, 'Band end');
    if (ib <= ia) throw new Error('Band: the end elevation must be above the start');
    const hR = grid.de * RAD, daR = grid.da * RAD, nA = grid.nA;
    const sum = { tot: 0, v: 0, h: 0 }, peak = { tot: { g: -1 }, v: { g: -1 }, h: { g: -1 } };
    let horizE = 0;
    for (let i = ia; i <= ib; i++) {
      const e = grid.els[i] * RAD, c = Math.cos(e), se2 = Math.sin(e) ** 2;
      // integral of the hat function of node i times cos(el), clipped to the band
      const w = ((i > ia ? c - Math.cos(e - hR) : 0) + (i < ib ? c - Math.cos(e + hR) : 0)) / hR + (i === ia ? -Math.sin(e) : 0) + (i === ib ? Math.sin(e) : 0);
      let rt = 0, rv = 0, rh = 0;
      for (let j = 0; j < nA; j++) {
        const k = i * nA + j; rt += grid.tot[k]; rv += grid.v[k]; rh += grid.h[k];
        for (const p of ['tot', 'v', 'h']) if (grid[p][k] > peak[p].g) peak[p] = { g: grid[p][k], el: grid.els[i], az: grid.azs[j] };
      }
      sum.tot += w * rt * daR; sum.v += w * rv * daR; sum.h += w * rh * daR; horizE += w * (rh + rv * se2) * daR;
    }
    const sr = 2 * Math.PI * (Math.sin(b * RAD) - Math.sin(a * RAD));
    return { el0: a, el1: b, sr, integral: sum, mean: { tot: sum.tot / sr, v: sum.v / sr, h: sum.h / sr }, peak,
      horizE: sum.tot > 0 ? horizE / sum.tot : null };   // share of the band's power whose E field is horizontal
  }
  /* H / V by angle. Two elevation bands, all azimuths:
   *   low  (default 5-30 deg):  mean and peak of V and of H. `dominant` is 'V' or 'H' only when the two means differ by
   *        at least `margin` dB (default 3), otherwise null: no dominance is claimed.
   *   high (default 60-90 deg): mean and peak of the total field. These are the angles a near-vertical-incidence (NVIS)
   *        path would use; whether such a path exists depends on the ionosphere, which is not modelled, so this is a
   *        candidate figure, not a propagation prediction. Close to the zenith theta and phi are both horizontal
   *        E fields (which is which depends only on the azimuth), so no V/H dominance is derived there; `horizE` gives
   *        the share of the power whose E field is horizontal (never below sin^2(60 deg) = 75 % in the default band).
   *   `favoured` is 'high' or 'low' only when the mean total gains of the two bands differ by at least `margin` dB. */
  const ANGLE_BANDS = { low: [5, 30], high: [60, 90], margin: 3 };
  function angleSummary(grid, opts) {
    const o = Object.assign({}, ANGLE_BANDS, opts);
    const fin = x => (Number.isFinite(x) ? x : null);
    const dbs = b => Object.assign(b, { meanDb: { tot: dB(b.mean.tot), v: dB(b.mean.v), h: dB(b.mean.h) },
      peakDb: { tot: dB(b.peak.tot.g), v: dB(b.peak.v.g), h: dB(b.peak.h.g) } });
    const low = dbs(bandStats(grid, o.low[0], o.low[1])), high = dbs(bandStats(grid, o.high[0], o.high[1]));
    const some = low.mean.tot > 1e-30 && high.mean.tot > 1e-30;
    // a component that is absent has no dB value: no difference is given, and the other one dominates
    const hasV = low.mean.v > 1e-30, hasH = low.mean.h > 1e-30;
    low.vMinusH = hasV && hasH ? fin(low.meanDb.v - low.meanDb.h) : null;
    low.dominant = low.vMinusH == null ? (hasV ? 'V' : hasH ? 'H' : null) : low.vMinusH >= o.margin ? 'V' : low.vMinusH <= -o.margin ? 'H' : null;
    const highMinusLow = some ? fin(high.meanDb.tot - low.meanDb.tot) : null;
    return { low, high, margin: o.margin, highMinusLow, favoured: highMinusLow == null ? null : highMinusLow >= o.margin ? 'high' : highMinusLow <= -o.margin ? 'low' : null };
  }
  /* Receiving directivity factor: RDF = 10 log10( G(desired direction) / mean G over the noise ), in dB.
   *   desired {el, az} (required): the direction the wanted signal arrives from; its total-field gain is the numerator.
   *   domain [el0, el1]: the elevations noise arrives from, all azimuths, spread evenly per unit solid angle
   *        (default: the whole visible sky, horizon to zenith over ground, the full sphere in free space).
   *   pol 'tot' | 'v' | 'h': the polarization component that receives the noise (default 'tot': unpolarized noise).
   *   ref '4pi' | 'domain': the solid angle the noise integral is divided by. '4pi' is the published convention
   *        (RDF = directivity; forward gain minus average gain): over ground it is 3.01 dB above the mean over the
   *        hemisphere, in free space the two are the same. 'domain' is the plain mean over the noise domain.
   * Named background assumptions (RDF_BACKGROUNDS):
   *   sky: noise from the whole visible sky, unpolarized, '4pi'. Comparable with published RDF tables.
   *   low: noise only from 0-30 deg elevation, unpolarized, mean over that band. Not comparable with `sky` in absolute
   *        value: it answers how much the desired direction stands above the low-angle average.
   * Losses cancel (numerator and denominator are the same pattern), so RDF is a pattern-shape figure. It says nothing
   * about real noise, which is neither uniform nor known here. */
  const RDF_BACKGROUNDS = { sky: { domain: null, pol: 'tot', ref: '4pi' }, low: { domain: [0, 30], pol: 'tot', ref: 'domain' } };
  function rdf(grid, opts) {
    const o = Object.assign({}, RDF_BACKGROUNDS.sky, opts), d = o.desired;
    if (!d || !Number.isFinite(d.el) || !Number.isFinite(d.az)) throw new Error('RDF needs a desired direction {el, az}');
    if (d.el < grid.e0 || d.el > 90) throw new Error('RDF: the desired elevation ' + d.el + '° is outside the pattern');
    if (!['tot', 'v', 'h'].includes(o.pol)) throw new Error('RDF: unknown polarization ' + o.pol);
    if (o.ref !== '4pi' && o.ref !== 'domain') throw new Error('RDF: unknown reference ' + o.ref);
    const dom = o.domain || [grid.e0, 90];
    if (o.ref === '4pi' && (dom[0] !== grid.e0 || dom[1] !== 90)) throw new Error('RDF: the 4 pi reference needs the whole visible sky as the noise domain');
    const b = bandStats(grid, dom[0], dom[1]);
    const gDes = grid.gain(d.el, d.az).tot, mean = b.integral[o.pol] / (o.ref === '4pi' ? 4 * Math.PI : b.sr);
    const ok = gDes > 1e-30 && mean > 1e-30 && Number.isFinite(gDes / mean);
    return { rdf: ok ? 10 * Math.log10(gDes / mean) : null, desired: { el: d.el, az: d.az }, gDes, gDesDb: dB(gDes), mean, meanDb: dB(mean), domain: dom, sr: b.sr, pol: o.pol, ref: o.ref };
  }
  /* Polarization, for display only (nothing here feeds back into the solve). Two different things, kept apart:
   *   share / vMinusH / kind: how the radiated power over the whole visible sky divides between the H (phi) and the
   *        V (theta) component, linear power weighted by solid angle. `kind` is 'mixed' when the two are within
   *        `margin` dB (default 3), else 'H' or 'V'; `pure` when the weaker one is at least `pure` dB down (default 20)
   *        or absent. null when nothing is radiated. This is what the H and V plots show, summed over direction.
   *   peak: the theta and phi gains toward one direction {el, az} (the total-field maximum). These are the LOCAL
   *        spherical components: at elevation el the theta unit vector is tilted el from the vertical, so of the
   *        theta power only cos^2(el) is a vertical E field in space. `horizE` is the share of the power toward that
   *        direction whose E field is horizontal in space, (h + v sin^2 el) / (h + v); `nearZenith` (el >= `zenith`,
   *        default 60 deg, the start of the high band) marks directions where theta and phi are both nearly
   *        horizontal and which of the two is larger depends on the azimuth only.
   * Neither says which wire radiates what: every component is the sum over all the currents of one coupled solution. */
  const POL_RULE = { margin: 3, pure: 20, zenith: ANGLE_BANDS.high[0] };
  function polarization(grid, peak, opts) {
    const o = Object.assign({}, POL_RULE, opts);
    if (!peak || !Number.isFinite(peak.el) || !Number.isFinite(peak.az)) throw new Error('Polarization needs a direction {el, az}');
    const b = bandStats(grid, grid.e0, 90), P = b.integral, some = P.tot > 1e-30;
    const hasV = some && P.v > 1e-30 * P.tot, hasH = some && P.h > 1e-30 * P.tot;
    const vMinusH = hasV && hasH ? 10 * Math.log10(P.v / P.h) : null;
    const kind = !some ? null : vMinusH == null ? (hasV ? 'V' : 'H') : Math.abs(vMinusH) < o.margin ? 'mixed' : vMinusH > 0 ? 'V' : 'H';
    const G = grid.gain(peak.el, peak.az), tot = G.v + G.h, s2 = Math.sin(peak.el * RAD) ** 2;
    return { share: some ? { h: P.h / P.tot, v: P.v / P.tot } : null, vMinusH, kind, pure: some && (vMinusH == null || Math.abs(vMinusH) >= o.pure),
      margin: o.margin, pureDb: o.pure, horizE: b.horizE,
      peak: { el: peak.el, az: peak.az, vDb: dB(G.v), hDb: dB(G.h), vMinusH: G.v > 1e-30 && G.h > 1e-30 ? dB(G.v) - dB(G.h) : null,
        horizE: tot > 1e-30 ? (G.h + G.v * s2) / tot : null, nearZenith: peak.el >= o.zenith } };
  }
  /* Summary of one analyze() result for the user interface. Flags that make every figure in it approximate:
   *   approx:  currents over the perfect mirror with a real-ground pattern (see analyze); the pattern shape is not exact.
   *   coarse:  the sky grid misses the main lobe (its largest sample is over 1 dB below the refined maximum), so the
   *            averages are unreliable for this narrow a beam.
   *   overUnity: the pattern holds over 5 % more power than the sources supply, which is not physical. */
  function patternSummary(a, model, opts) {
    const hasGround = ((model.ground || {}).type | 0) > 0;
    const grid = skyGrid(a.pat, hasGround, opts);
    const desired = { el: a.el, az: a.az };
    const sky = rdf(grid, Object.assign({}, RDF_BACKGROUNDS.sky, { desired }));
    const gridMax = grid.tot.reduce((m, x) => Math.max(m, x), 0), skyPower = sky.mean;
    const strip = b => ({ el0: b.el0, el1: b.el1, meanDb: b.meanDb, peakDb: b.peakDb, horizE: b.horizE, vMinusH: b.vMinusH, dominant: b.dominant,
      peakAt: { tot: [b.peak.tot.el, b.peak.tot.az], v: [b.peak.v.el, b.peak.v.az], h: [b.peak.h.el, b.peak.h.az] } });
    const out = { hasGround, approx: !!a.approx, coarse: !(gridMax * 1.2589 >= sky.gDes), overUnity: skyPower > 1.05, skyPower, desired,
      rdf: { sky: { rdf: sky.rdf, meanDb: sky.meanDb, domain: sky.domain, ref: sky.ref } }, hv: null };
    if (hasGround) {
      const low = rdf(grid, Object.assign({}, RDF_BACKGROUNDS.low, { desired }));
      out.rdf.low = { rdf: low.rdf, meanDb: low.meanDb, domain: low.domain, ref: low.ref };
      const s = angleSummary(grid);
      out.hv = { low: strip(s.low), high: strip(s.high), margin: s.margin, highMinusLow: s.highMinusLow, favoured: s.favoured };
    }
    out.pol = polarization(grid, desired);
    out.uncertain = out.approx || out.coarse || out.overUnity;
    return out;
  }

  /* ---------- MAA files ---------- */
  function parseMAA(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    let i = 0;
    const next = () => (i < lines.length ? lines[i++] : null);
    const isHdr = l => /^\s*\*\*\*|^\s*###/.test(l);
    const nums = l => l.split(/[,\t]+/).map(s => s.trim()).filter(s => s !== '');
    const model = { name: (next() || 'Untitled').trim(), wires: [], sources: [], loads: [], seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 },
      ground: { type: 0, height: 0, eps: 13, sigma: 0.005 }, material: 0, z0: 50, comment: '', tls: [], objects: [] };
    let l;
    while ((l = next()) !== null) {
      if (/^\s*\*\s*$/.test(l)) continue;
      if (!isHdr(l) && !model.freq && parseFloat(l) > 0) { model.freq = parseFloat(l); continue; }
      const h = l.toLowerCase();
      if (/wire/.test(h)) {
        const n = parseInt(next(), 10) || 0;
        for (let k = 0; k < n; k++) {
          const v = nums(next() || '');
          model.wires.push({ x1: v[0], y1: v[1], z1: v[2], x2: v[3], y2: v[4], z2: v[5], r: v[6], seg: parseInt(v[7], 10) || 0 });
        }
      } else if (/source/.test(h)) {
        const n = parseInt(nums(next() || '0')[0], 10) || 0;
        for (let k = 0; k < n; k++) { const v = nums(next() || ''); model.sources.push({ pos: v[0], phase: +v[1] || 0, mag: v[2] !== undefined ? +v[2] : 1, ratio: 1 }); }
      } else if (/load/.test(h)) {
        const n = parseInt(nums(next() || '0')[0], 10) || 0;
        for (let k = 0; k < n; k++) {
          const v = nums(next() || '');
          const type = parseInt(v[1], 10) || 0;
          if (type === 1) model.loads.push({ pos: v[0], type: 1, R: +v[2] || 0, X: +v[3] || 0 });
          else model.loads.push({ pos: v[0], type: type === 2 ? 2 : 0, L: +v[2] || 0, C: +v[3] || 0, Q: +v[4] || 0, R: 0 });
        }
      } else if (/segment/.test(h)) {
        const v = nums(next() || '');
        model.seg = { dm1: +v[0] || 400, dm2: +v[1] || 40, sc: +v[2] || 2, ec: +v[3] || 1 };
      } else if (/g\/h/.test(h)) {
        const v = nums(next() || '');
        model.ground.type = Math.min(2, Math.max(0, parseInt(v[0], 10) || 0));
        model.ground.height = +v[1] || 0;
        // MMANA material numbers above 3 have no match here and were always lossless; Sommerwire's own
        // materials 4 and up come from a 'Sommerwire MAT' line instead
        model.material = (m => (m >= 0 && m <= 3 ? m : 0))(parseInt(v[2], 10) || 0);
        model.z0 = +v[3] || 50;
      } else if (/comment/.test(h)) {
        const rest = []; let c; while ((c = next()) !== null) rest.push(c);
        const keep = [], extra = [];
        rest.forEach(line => {
          const hh = /^\s*(?:Sommerwire|WireModel) HOUSE:\s*(.*)$/i.exec(line);
          if (hh) {
            const v = hh[1].split(/[,\t]+/).map(x => x.trim());
            model.objects.push({ type: 'house', x: +v[0] || 0, y: +v[1] || 0, len: +v[2] || 10, wid: +v[3] || 8, eave: +v[4] || 0, ridge: +v[5] || 0, rot: +v[6] || 0, roof: v[7] === 'metal' ? 'metal' : 'none', grid: +v[8] || 1, gutters: v[9] === 'metal' ? 'metal' : 'none', pipes: +v[10] || 0, rEarth: v[11] !== undefined ? +v[11] || 0 : 50 });
            return;
          }
          const ex = /^\s*Sommerwire (SRC|LOAD|INS|MAT|BOOM):\s*(.*)$/i.exec(line);
          if (ex) { extra.push([ex[1].toUpperCase(), ex[2].split(/[,\t]+/).map(x => x.trim())]); return; }
          const mm = /^\s*(?:Sommerwire|WireModel) TL:\s*(.*)$/i.exec(line);
          if (!mm) { keep.push(line); return; }
          const v = mm[1].split(/[,\t]+/).map(x => x.trim());
          model.tls.push({ p1: v[0], p2: v[1], z0: +v[2] || 50, vf: +v[3] || 1, len: +v[4] > 0 ? +v[4] : '', rev: v[5] === '1', loss: +v[6] > 0 ? +v[6] : '', lossF: +v[7] > 0 ? +v[7] : '' });
        });
        model.comment = keep.join('\n').trim();
        // Sommerwire extensions that MMANA's own sections have no room for
        extra.forEach(([kind, v]) => {
          if (kind === 'SRC') { const s = model.sources[(+v[0] || 0) - 1]; if (s) s.ratio = +v[1] > 0 ? +v[1] : 1; }
          else if (kind === 'LOAD') { const d = model.loads[(+v[0] || 0) - 1]; if (d) { d.Qc = +v[1] || 0; d.Cp = +v[2] || 0; } }
          else if (kind === 'INS') model.ins = { t: +v[0] || 0, er: +v[1] || 1, tand: +v[2] || 0, wires: v.slice(3).join(',') };
          else if (kind === 'BOOM') model.boom = { d: +v[0] || 0, mount: ['bonded', 'insulated'].includes(v[1]) ? v[1] : 'none', axis: ['x', 'y', 'z'].includes(v[2]) ? v[2] : 'x' };
          else if (kind === 'MAT') { const m = parseInt(v[0], 10); if (m >= 0 && m < MATERIALS.length) model.material = m; }
        });
      }
    }
    if (!model.freq) model.freq = 14.0;
    return model;
  }

  function toMAA(model) {
    const L = [];
    const f = x => (typeof x === 'number' ? (+x.toFixed(6)).toString() : String(x));
    L.push(model.name || 'Untitled', '*', (+model.freq).toFixed(3), '***Wires***', String(model.wires.length));
    model.wires.forEach(w => L.push([w.x1, w.y1, w.z1, w.x2, w.y2, w.z2].map(f).join(',\t') + ',\t' + (+w.r).toExponential(3) + ',\t' + (w.seg | 0)));
    L.push('*** Source ***', model.sources.length + ',\t1');
    model.sources.forEach(s => L.push(s.pos + ',\t' + (+s.phase).toFixed(1) + ',\t' + (+s.mag).toFixed(1)));
    L.push('*** Load ***', model.loads.length + ',\t1');
    model.loads.forEach(d => L.push(d.type === 1 ? d.pos + ',\t1,\t' + d.R + ',\t' + d.X : d.pos + ',\t' + (d.type === 2 ? 2 : 0) + ',\t' + d.L + ',\t' + d.C + ',\t' + (d.Q || 0)));
    L.push('*** Segmentation ***', [model.seg.dm1, model.seg.dm2, model.seg.sc, model.seg.ec].join(',\t'));
    // MMANA gets its nearest material (steel as iron, brass as copper); Sommerwire's own is named in a separate line
    const mat = model.material | 0;
    L.push('*** G/H/M/R/AzEl/X ***', [model.ground.type, (+model.ground.height).toFixed(2), [0, 1, 2, 3, 3, 3, 1][mat] ?? 0, (+model.z0).toFixed(1), 120, 60, 0.0].join(',\t'));
    const tl = (model.tls || []).map(t => 'Sommerwire TL: ' + [t.p1, t.p2, +t.z0 || 50, +t.vf || 1, +t.len > 0 ? +t.len : 0, t.rev ? 1 : 0].concat(+t.loss > 0 ? [+t.loss, +t.lossF > 0 ? +t.lossF : 0] : []).join(', '));
    const ext = [];
    if (mat > 3) ext.push('Sommerwire MAT: ' + mat);
    model.sources.forEach((s, i) => { if (+s.ratio > 0 && +s.ratio !== 1) ext.push('Sommerwire SRC: ' + (i + 1) + ', ' + +s.ratio); });
    model.loads.forEach((d, i) => { if (d.type !== 1 && (+d.Qc > 0 || +d.Cp > 0)) ext.push('Sommerwire LOAD: ' + (i + 1) + ', ' + (+d.Qc || 0) + ', ' + (+d.Cp || 0)); });
    const bm = model.boom; if (bm && +bm.d > 0 && (bm.mount === 'bonded' || bm.mount === 'insulated')) ext.push('Sommerwire BOOM: ' + [+bm.d, bm.mount, bm.axis || 'x'].join(', '));
    const ins = model.ins; if (ins && +ins.t > 0) ext.push('Sommerwire INS: ' + [+ins.t, +ins.er || 1, +ins.tand || 0].join(', ') + (ins.wires && String(ins.wires).trim() ? ', ' + String(ins.wires).trim() : ''));
    const ho = (model.objects || []).filter(o => o.type === 'house').map(o => 'Sommerwire HOUSE: ' + [o.x, o.y, o.len, o.wid, o.eave, o.ridge, o.rot, o.roof, o.grid, o.gutters || 'none', +o.pipes || 0, +o.rEarth || 0].map(v => (typeof v === 'number' ? +(+v).toFixed(4) : v)).join(', '));
    L.push('### Comment ###', [model.comment || ''].concat(tl, ho, ext).filter(x => x !== '').join('\r\n'));
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- optimizer variables ----------
   * var = { type: 'len-c'|'len-b'|'pos'|'end'|'load', idx, axis:'x'|'y'|'z', end:'b'|'e', field:'L'|'C'|'R'|'X', min, max }
   * len-c: wire length, centre fixed · len-b: wire length, begin fixed · pos: wire centre coordinate
   * end: one end point coordinate · load: a load value. Moved points drag every wire end that touches them.
   */
  const AX = { x: 0, y: 1, z: 2 };
  const wirePts = w => [[w.x1, w.y1, w.z1], [w.x2, w.y2, w.z2]];
  function setPt(w, k, p) { if (k === 0) { w.x1 = p[0]; w.y1 = p[1]; w.z1 = p[2]; } else { w.x2 = p[0]; w.y2 = p[1]; w.z2 = p[2]; } }
  function movePoint(m, old, np) {
    const t = 1e-6;
    m.wires.forEach(w => wirePts(w).forEach((p, k) => {
      if (Math.abs(p[0] - old[0]) < t && Math.abs(p[1] - old[1]) < t && Math.abs(p[2] - old[2]) < t) setPt(w, k, np);
    }));
  }
  function varValue(m, v) {
    if (v.type === 'load') { const l = m.loads[v.idx]; return l ? +l[v.field] || 0 : NaN; }
    const w = m.wires[v.idx]; if (!w) return NaN;
    const [A, B] = wirePts(w);
    if (v.type === 'len-c' || v.type === 'len-b') return len(sub(B, A));
    if (v.type === 'pos') return (A[AX[v.axis]] + B[AX[v.axis]]) / 2;
    if (v.type === 'end') return (v.end === 'b' ? A : B)[AX[v.axis]];
    return NaN;
  }
  function applyVar(m, v, val) {
    if (v.type === 'load') { if (m.loads[v.idx]) m.loads[v.idx][v.field] = val; return; }
    const w = m.wires[v.idx]; if (!w) return;
    const [A, B] = wirePts(w);
    const L = len(sub(B, A)); const u = L > 0 ? scl(sub(B, A), 1 / L) : [0, 0, 0];
    if (v.type === 'len-c') {
      const c = scl(add(A, B), 0.5);
      movePoint(m, A, sub(c, scl(u, val / 2))); movePoint(m, B, add(c, scl(u, val / 2)));
    } else if (v.type === 'len-b') {
      movePoint(m, B, add(A, scl(u, val)));
    } else if (v.type === 'pos') {
      const k = AX[v.axis], d = val - (A[k] + B[k]) / 2;
      const nA = A.slice(), nB = B.slice(); nA[k] += d; nB[k] += d;
      movePoint(m, A, nA); movePoint(m, B, nB);
    } else if (v.type === 'end') {
      const P = v.end === 'b' ? A : B, nP = P.slice(); nP[AX[v.axis]] = val;
      movePoint(m, P, nP);
    }
  }
  function applyVars(model, vars, vals) {
    const m = JSON.parse(JSON.stringify(model));
    vars.forEach((v, i) => applyVar(m, v, vals[i]));
    return m;
  }

  /* goals = { swr:{w,target}, jx:{w}, gain:{w}, fb:{w,cap}, el:{w,target} } — cost is minimised */
  function evalGoals(model, freqs, goals) {
    const needPat = goals.gain.w > 0 || goals.fb.w > 0 || goals.el.w > 0;
    const z0 = +model.z0 || 50;
    let cost = 0; const per = [];
    for (const f of freqs) {
      let r;
      if (needPat) { const a = analyze(model, f); r = { f, R: a.R, X: a.X, swr: a.swr, gain: a.gain, fb: a.fb, el: a.el, approx: a.approx }; }
      else {
        const res = solve(model, f), s = res.sources[0];
        const g = divC(s.R - z0, s.X, s.R + z0, s.X), gm = Math.hypot(g[0], g[1]);
        r = { f, R: s.R, X: s.X, swr: gm >= 1 ? Infinity : (1 + gm) / (1 - gm), gain: NaN, fb: NaN, el: NaN, approx: !!res.mirrorMix };
      }
      let c = 0;
      if (goals.swr.w) c += goals.swr.w * Math.max(0, Math.min(r.swr, 50) - goals.swr.target);
      if (goals.jx.w) c += goals.jx.w * Math.abs(r.X) / z0;
      if (goals.gain.w) c -= goals.gain.w * r.gain / 3;
      if (goals.fb.w) c -= goals.fb.w * Math.min(r.fb, goals.fb.cap) / 10;
      if (goals.el.w) c += goals.el.w * Math.abs(r.el - goals.el.target) / 5;
      cost += c; per.push(r);
    }
    return { cost: cost / freqs.length, per, approx: per.some(r => r.approx) };
  }

  /* Bounded Nelder–Mead on variables scaled to [0,1], restarted with smaller steps. step() runs one evaluation. */
  function makeOptimizer(model, vars, goals, freqs, maxEval) {
    checkGroundGeometry(model);
    const n = vars.length;
    const lo = vars.map(v => +v.min), hi = vars.map(v => +v.max);
    const clamp = t => Math.min(1, Math.max(0, t));
    const toVals = x => x.map((t, i) => lo[i] + (hi[i] - lo[i]) * clamp(t));
    const x0 = vars.map((v, i) => clamp((varValue(model, v) - lo[i]) / ((hi[i] - lo[i]) || 1)));
    const st = { evals: 0, best: null, start: null, history: [], done: false };
    function f(x) {
      st.evals++;
      const vals = toVals(x);
      let r;
      try { r = evalGoals(applyVars(model, vars, vals), freqs, goals); if (!Number.isFinite(r.cost)) r.cost = 1e6; }
      catch (e) {
        if (!st.start) throw e;
        r = { cost: 1e6, per: [] };
      }
      let pen = x.reduce((s, t) => s + (t < 0 ? -t : t > 1 ? t - 1 : 0), 0) * 10;
      // A trial that makes a wire touch the ground switches the whole model to the perfect mirror (approximate
      // impedance, and over real ground an approximate, often too high gain). That is a change of model, not an
      // improvement, so when the start was a proper solve such trials are ruled out.
      if (st.start && !st.start.approx && r.approx) { pen += 1000; st.switched = (st.switched || 0) + 1; }
      const c = r.cost + pen;
      if (!st.start) st.start = { cost: c, vals, per: r.per, approx: !!r.approx };
      if (!st.best || c < st.best.cost) st.best = { cost: c, vals, per: r.per, x: x.map(clamp) };
      st.history.push(st.best.cost);
      return c;
    }
    function* nm(xs, step) {
      let S = [xs.slice()];
      for (let i = 0; i < n; i++) { const p = xs.slice(); p[i] += p[i] + step <= 1 ? step : -step; S.push(p); }
      let F = [];
      for (const p of S) { F.push(f(p)); yield; }
      while (st.evals < maxEval) {
        const idx = F.map((v, i) => i).sort((a, b) => F[a] - F[b]);
        S = idx.map(i => S[i]); F = idx.map(i => F[i]);
        let spread = 0;
        for (let i = 1; i <= n; i++) for (let j = 0; j < n; j++) spread = Math.max(spread, Math.abs(S[i][j] - S[0][j]));
        if (spread < 2e-4 || F[n] - F[0] < 1e-10) return;
        const c = new Array(n).fill(0);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
        const W = S[n];
        const xr = c.map((v, j) => v + (v - W[j])); const fr = f(xr); yield;
        if (fr < F[0]) {
          const xe = c.map((v, j) => v + 2 * (v - W[j])); const fe = f(xe); yield;
          if (fe < fr) { S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; }
        } else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
        else {
          const outside = fr < F[n];
          const xc = outside ? c.map((v, j) => v + 0.5 * (xr[j] - v)) : c.map((v, j) => v + 0.5 * (W[j] - v));
          const fc = f(xc); yield;
          if (fc < (outside ? fr : F[n])) { S[n] = xc; F[n] = fc; }
          else {
            for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); F[i] = f(S[i]); yield; }
          }
        }
      }
    }
    function* run() {
      let x = x0, step = 0.15;
      for (let round = 0; round < 4 && st.evals < maxEval; round++) { yield* nm(x, step); x = st.best.x; step *= 0.35; }
    }
    const gen = run();
    st.step = () => { if (st.done) return true; const r = gen.next(); if (r.done || st.evals >= maxEval) st.done = true; return st.done; };
    return st;
  }

  function portPoint(mesh, spec) {
    const loc = locate(mesh, spec); if (!loc) return null;
    const sg = mesh.segs[loc.seg]; return loc.half % 2 ? sg.p1 : sg.p0;
  }

  root.MM = { skyGrid, bandStats, angleSummary, rdf, polarization, patternSummary, ANGLE_BANDS, RDF_BACKGROUNDS, POL_RULE, boomFraction, straightGroups, complexDepth, portPoint, evalExpr, buildMesh, solve, makePattern, analyze, parseMAA, toMAA, parsePos, MATERIALS, lambdaOf, dB, C0,
    varValue, applyVars, evalGoals, makeOptimizer };
})(typeof globalThis !== 'undefined' ? globalThis : self);
