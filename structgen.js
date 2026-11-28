/* Sommerwire — by ON9PK Koen Van den Heuvel. Upstream material: Unlicense. Original RF.Guru fork contributions: Apache-2.0. See repository LICENSE for scope and earlier grants. */
/* Structures next to the antenna, expanded into wires for the solver.
 * house: { type:'house', x, y (centre of the footprint, m), len (along the ridge), wid, eave (wall height),
 *          ridge (ridge height; equal to eave for a flat roof), rot (degrees, ridge direction from +X),
 *          roof: 'metal' | 'none', grid (mesh spacing, m),
 *          gutters: 'metal' | 'none', pipes: 0 | 2 | 4 (downpipes from the gutter ends to the ground),
 *          rEarth (earth resistance of each downpipe, ohm; 0 = perfect connection) }
 * Gutters run along both eave sides, 0.15 m outside and 0.1 m below the roof edge (not bonded to the roof).
 * Downpipes run from the ground (their begin end) up to the gutter ends; the earth resistance is a load there.
 * A metal roof becomes a wire grid (each roof plane meshed along and across the slope, all wires joined at
 * the crossings). Wire radius follows the equal-area rule r = spacing / (2 pi), the usual NEC practice for
 * grids that stand in for solid sheets. Walls are drawn for reference only: stone, brick and wood are not
 * conductors and a thin-wire solver cannot model them.
 */
(function (root) {
  const r4 = v => Math.round(v * 1e4) / 1e4;
  function houseGeometry(o) {
    const len = Math.max(0.5, +o.len || 10), wid = Math.max(0.5, +o.wid || 8);
    const eave = Math.max(0, +o.eave || 0), ridge = Math.max(eave, +o.ridge || eave);
    const a = (+o.rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const cx = +o.x || 0, cy = +o.y || 0;
    // local (u along the ridge, v across) -> world
    const P = (u, v, z) => [r4(cx + u * ca - v * sa), r4(cy + u * sa + v * ca), r4(z)];
    const hl = len / 2, hw = wid / 2;
    const foot = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]];
    const walls = [];
    foot.forEach(([u, v], i) => {
      const [u2, v2] = foot[(i + 1) % 4];
      walls.push([P(u, v, 0), P(u2, v2, 0)], [P(u, v, eave), P(u2, v2, eave)], [P(u, v, 0), P(u, v, eave)]);
    });
    if (ridge > eave) {   // gable ends
      walls.push([P(-hl, -hw, eave), P(-hl, 0, ridge)], [P(-hl, 0, ridge), P(-hl, hw, eave)], [P(hl, -hw, eave), P(hl, 0, ridge)], [P(hl, 0, ridge), P(hl, hw, eave)]);
    }
    return { P, len, wid, eave, ridge, hl, hw, walls };
  }
  // roof planes as (corner, edge along u, edge across) in local coordinates
  function roofWires(o) {
    const g = houseGeometry(o);
    if (o.roof !== 'metal') return [];
    const s = Math.max(0.1, +o.grid || 1), rad = s / (2 * Math.PI);
    const planes = g.ridge > g.eave
      ? [[-g.hw, 0, g.eave, g.ridge], [g.hw, 0, g.eave, g.ridge]]          // v from eave to ridge, z from eave to ridge
      : [[-g.hw, g.hw, g.eave, g.eave]];
    const out = [], seen = new Set();
    const add = (p, q) => {
      const key = p.join() + '|' + q.join(), key2 = q.join() + '|' + p.join();
      if (seen.has(key) || seen.has(key2)) return; seen.add(key);
      out.push({ x1: p[0], y1: p[1], z1: p[2], x2: q[0], y2: q[1], z2: q[2], r: rad, seg: -1 });
    };
    planes.forEach(([v0, v1, z0, z1]) => {
      const slope = Math.hypot(v1 - v0, z1 - z0);
      const nu = Math.max(1, Math.round(g.len / s)), nv = Math.max(1, Math.round(slope / s));
      const pt = (i, j) => { const t = j / nv; return g.P(-g.hl + g.len * i / nu, v0 + (v1 - v0) * t, z0 + (z1 - z0) * t); };
      for (let j = 0; j <= nv; j++) for (let i = 0; i < nu; i++) add(pt(i, j), pt(i + 1, j));     // along the ridge
      for (let i = 0; i <= nu; i++) for (let j = 0; j < nv; j++) add(pt(i, j), pt(i, j + 1));     // up the slope
    });
    return out;
  }
  // gutters and downpipes; returns wires and, per downpipe, its index in that list (begin end at ground)
  function drainWires(o) {
    const g = houseGeometry(o), wires = [], pipes = [];
    if (o.gutters !== 'metal' || g.eave <= 0.2) return { wires, pipes };
    const rg = 0.04, off = 0.15, zg = g.eave - 0.1;
    const n = +o.pipes === 4 ? 4 : +o.pipes === 2 ? 2 : 0;
    [-1, 1].forEach(side => {
      const v = side * (g.hw + off), a = g.P(-g.hl, v, zg), b = g.P(g.hl, v, zg);
      wires.push({ x1: a[0], y1: a[1], z1: a[2], x2: b[0], y2: b[1], z2: b[2], r: rg, seg: -1 });
      // 2 pipes: opposite corners; 4 pipes: every corner
      const ends = n === 4 ? [a, b] : n === 2 ? [side < 0 ? a : b] : [];
      ends.forEach(e => { pipes.push(wires.length); wires.push({ x1: e[0], y1: e[1], z1: 0, x2: e[0], y2: e[1], z2: e[2], r: rg, seg: -1 }); });
    });
    return { wires, pipes };
  }
  function expandObjects(objects) {
    const wires = [], walls = [], earth = [];
    (objects || []).forEach((o, k) => {
      if (o.type !== 'house') return;
      roofWires(o).forEach(w => wires.push(Object.assign(w, { obj: k })));
      const d = drainWires(o), base = wires.length;
      d.wires.forEach(w => wires.push(Object.assign(w, { obj: k })));
      d.pipes.forEach(i => earth.push({ index: base + i, R: Math.max(0, +o.rEarth || 0) }));
      walls.push(...houseGeometry(o).walls.map(e => ({ e, obj: k })));
    });
    return { wires, walls, earth };
  }
  root.WMStruct = { expandObjects, houseGeometry, roofWires, drainWires };
})(typeof globalThis !== 'undefined' ? globalThis : self);
