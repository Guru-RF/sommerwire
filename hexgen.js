/* Sommerwire — by ON9PK Koen Van den Heuvel. Upstream material: Unlicense. Original RF.Guru fork contributions: Apache-2.0. See repository LICENSE for scope and earlier grants. */
/* Hexbeam geometry from a G3TXQ-style dimension table.
 * Every wire of a band lies on that band's hexagon (corners at 30°, 90°, ... 330°, radius R).
 * Front is +X. Driver ("W"): centre post -> 30° corner (length R) -> along the edge toward 90° (length d).
 * Reflector ("M"): corners 90° -> 150° -> 210° -> 270°, plus tails from the 90°/270° corners back along the
 * edge toward the front (length t). Driver tip and reflector tail sit on the same edge, gap g apart.
 *   A = R + d,   B = 3R + 2t,   d + g + t = R   =>   R = (A + g + B/2) / 3.5
 * centre: 'twin' = 2-wire line inside the centre post (as in the original file),
 *         'coax' = a 15 mm bridge at every driver, linked by transmission lines (z0, vf).
 */
(function (root) {
  const fm = v => String(+v.toFixed(4));
  function hexbeamFromTable(bands, opts) {
    const o = Object.assign({ base: 0.15, spacing: 0.0075, rElem: 0.8, rPost: 1, centre: 'twin', z0: 50, vf: 0.66 }, opts || {});
    const deg = Math.PI / 180, S = o.spacing;
    const corner = (R, a, z) => [R * Math.cos(a * deg), R * Math.sin(a * deg), z];
    const wires = [], geo = [];
    const add = (p, q, r) => wires.push({ x1: fm(p[0]), y1: fm(p[1]), z1: fm(p[2]), x2: fm(q[0]), y2: fm(q[1]), z2: fm(q[2]), r: String(r), seg: '-1' });
    // bands sorted from the top (largest) down; heights relative to the lowest band
    const B = bands.slice().sort((a, b) => b.up - a.up);
    B.forEach(b => {
      const R = (b.A + b.g + b.B / 2) / 3.5, d = b.A - R, t = (b.B - 3 * R) / 2, z = o.base + b.up;
      if (!(d > 0 && t > 0)) throw new Error(b.name + ': the dimensions do not fit a hexbeam (driver edge ' + d.toFixed(3) + ' m, tail ' + t.toFixed(3) + ' m).');
      geo.push({ name: b.name, R, d, t, z });
      [1, -1].forEach(sg => {
        const c30 = corner(R, 30 * sg, z), c90 = corner(R, 90 * sg, z), c150 = corner(R, 150 * sg, z);
        const u = [(c90[0] - c30[0]) / R, (c90[1] - c30[1]) / R, 0];
        add([0, S * sg, z], c30, o.rElem);                                            // driver: post -> 30° corner
        add(c30, [c30[0] + u[0] * d, c30[1] + u[1] * d, z], o.rElem);                  // driver: along the edge
        add(c150, c90, o.rElem);                                                      // reflector side
        add(c90, [c90[0] - u[0] * t, c90[1] - u[1] * t, z], o.rElem);                  // reflector tail
      });
      add(corner(R, -150, z), corner(R, 150, z), o.rElem);                            // reflector back side
    });
    const zs = geo.map(g => g.z);                                                     // top first
    const nElem = wires.length;
    const sources = [], tls = [];
    if (o.centre === 'twin') {
      // feed bridge at the top driver, 2-wire line down the post
      add([0, -S, zs[0]], [0, S, zs[0]], o.rPost);
      sources.push({ pos: 'w' + wires.length + 'c', phase: 0, mag: 1 });
      for (let i = 0; i < zs.length - 1; i++) [1, -1].forEach(sg => add([0, S * sg, zs[i]], [0, S * sg, zs[i + 1]], o.rPost));
    } else {
      zs.forEach(z => add([0, -S, z], [0, S, z], o.rPost));
      sources.push({ pos: 'w' + (nElem + 1) + 'c', phase: 0, mag: 1 });
      for (let i = 0; i < zs.length - 1; i++) tls.push({ p1: 'w' + (nElem + 1 + i) + 'c', p2: 'w' + (nElem + 2 + i) + 'c', z0: o.z0, vf: o.vf, len: '', rev: false });
    }
    return { wires, sources, tls, geo };
  }
  root.hexbeamFromTable = hexbeamFromTable;
})(typeof globalThis !== 'undefined' ? globalThis : self);
