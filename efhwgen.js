/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* RF.Guru low-band EFHW inverted-L examples (EFHW16080 and EFHW8040).
 *
 * Sourced (RF.Guru pages, retrieved 2026-11-26):
 *   EFHW16080: integrated 68:1 unun, ~82 m 2 mm wire, "~18–20 m vertical + remainder horizontal",
 *              horizontal >= 15 m above ground, feedpoint >= 1 m, "the coax shield forms the counterpoise",
 *              high-CMR choke ~8 m from the feedpoint.
 *   EFHW8040:  integrated 70:1 unun, 41 m 2 mm wire, horizontal 10–15 m above ground, feedpoint >= 1 m
 *              (best 2–5 m), common-mode choke ~4 m from the feedpoint.
 * Band frequencies (bands, MHz): the app calculates every listed band after each full calculation.
 * Soil (eps, sigma): both use lower-conductivity soil, εr 5, 1 mS/m (Sommerfeld).
 * EFHW8040 horizontal trim (horiz): with the vertical (12.5 m, feedpoint 1 m, bend 13.5 m), the 4 m shield ending at
 *   1 m and 70:1 fixed, length alone cannot centre both SWR dips (the 40 m dip sits at about 2.06 times the 80 m dip).
 *   28.36 m minimises the larger SWR at 3.65 and 7.1 MHz at 1 cm steps (2.45 / 2.45; dips 3.522 and 7.260 MHz on
 *   a 1 kHz scan). The supplied 41 m (28.5 m horizontal) gives 2.66 / 2.22.
 * EFHW16080 heights (feed, bend): 82 m total, 8 m shield ending at 0.5 m and 68:1 fixed; engine grid search of
 *   feedpoint 1–4 m and bend 10–16 m (0.5 m coarse, then 0.1 m fine around the best) for the lowest larger SWR at
 *   1.85 and 3.65 MHz: feedpoint 3.7 m, bend 16 m gives 4.43 / 1.87 (dips 1.740 and 3.594 MHz). The bend is on the
 *   16 m cap; the 1.85 MHz SWR spans only 4.43–4.53 over the grid, so the fixed length dominates. The former
 *   feedpoint 1 m, bend 17 m gave 4.44 / 1.87 on this soil and 6.02 / 2.26 on average soil (εr 13, 5 mS/m).
 * Representative (chosen inside the sourced ranges, adjustable): feedpoint height, bend height, the
 * coax route, the shield radius and the soil. Not modelled: XLPE insulation (thickness not published),
 * transformer loss and parasitics (ideal n:1 impedance transformer), the optional ground stake (a wire
 * into the soil would switch the impedance solve to the perfect mirror), the choke's finite impedance
 * (an ideal choke = open end of the shield wire), sag and nearby objects.
 *
 * Wires: 1 vertical radiator (feed -> bend), 2 horizontal radiator (+X), 3 coax shield exterior from the
 * feedpoint to the choke (-Y, sloping down, all above the soil). Source at w1b = the gap between the
 * transformer's antenna terminal (radiator) and its return terminal (shield).
 */
(function (root) {
  const fm = v => String(+v.toFixed(4));
  const SRC = {
    article: 'https://shop.rf.guru/pages/why-rf-guru-recommends-only-inverted-l-for-160-80m-and-80m-40m-with-68-70-1-transformers-for-end-fed-antennas',
    p16080: 'https://shop.rf.guru/products/2024-efhw16080-4000',
    o16080: 'https://shop.rf.guru/pages/efhw16080-inverted-l-technical-overview',
    p8040: 'https://shop.rf.guru/products/2024-efhw8040-4000'
  };
  // total: sourced radiator wire length; horiz: modelled horizontal length when trimmed (else total minus the vertical);
  // feed/bend: heights (m); choke: shield length to the choke; chokeZ: its height; bands: default calculation frequencies (MHz)
  const RFGURU_EFHW = {
    '16080': { name: 'RF.Guru EFHW16080 inverted-L, 160/80 m, 68:1', freq: 1.85, bands: [1.85, 3.65], ratio: 68, total: 82, feed: 3.7, bend: 16, choke: 8, chokeZ: 0.5, eps: 5, sigma: 0.001,
      sourced: '68:1 unun, ~82 m 2 mm wire, ~18–20 m vertical with the remainder horizontal and high (horizontal at least 15 m), feedpoint at least 1 m, coax shield as the counterpoise with a high-CMR choke about 8 m from the feedpoint (' + SRC.p16080 + ', ' + SRC.o16080 + ')',
      chosen: 'feedpoint 3.7 m and bend 16 m (12.3 m vertical, 69.7 m horizontal at 16 m, the mast height cap); this custom vertical length is below the published ~18–20 m range',
      trim: 'the full supplied 82 m is kept. The feedpoint (1–4 m) and bend (10–16 m) heights were searched on this soil for the lowest larger SWR at 1.85 and 3.65 MHz: 3.7 m and 16 m give 4.43 at 1.85 and 1.87 at 3.65 MHz (dips near 1.740 and 3.594 MHz). The bend sits on the 16 m cap and the 160 m SWR hardly moves with height (4.43–4.53 over the searched range), so the wire length, not the heights, keeps the 160 m dip below the band' },
    '8040': { name: 'RF.Guru EFHW8040 inverted-L, 80/40 m, 70:1', freq: 3.65, bands: [3.65, 7.1], ratio: 70, total: 41, horiz: 28.36, feed: 1, bend: 13.5, choke: 4, chokeZ: 1, eps: 5, sigma: 0.001,
      sourced: '70:1 unun, 41 m 2 mm wire, horizontal 10–15 m above ground, feedpoint at least 1 m and best 2–5 m, common-mode choke about 4 m from the feedpoint (' + SRC.p8040 + ')',
      chosen: 'feedpoint 1 m and bend 13.5 m (12.5 m vertical, 28.36 m horizontal at 13.5 m, inside the published 10–15 m range)',
      trim: 'the horizontal wire is set to 28.36 m (40.86 m in all, 14 cm less than the supplied 41 m): the length alone cannot put both SWR dips on 3.65 and 7.1 MHz (the 40 m dip sits at about 2.06 times the 80 m dip), so 28.36 m is the compromise that minimises the larger SWR at both (about 2.45; dips near 3.522 and 7.260 MHz). With the supplied 41 m the SWR is 2.66 at 3.65 and 2.22 at 7.1 MHz. No reactive components were added' }
  };
  function rfGuruEfhwInvL(key) {
    const d = RFGURU_EFHW[key];
    if (!d) throw new Error('Unknown RF.Guru EFHW example: ' + key);
    const vert = d.bend - d.feed, horiz = d.horiz != null ? d.horiz : d.total - vert;
    const dy = Math.sqrt(d.choke * d.choke - (d.feed - d.chokeZ) ** 2);
    const w = (a, b, r) => ({ x1: fm(a[0]), y1: fm(a[1]), z1: fm(a[2]), x2: fm(b[0]), y2: fm(b[1]), z2: fm(b[2]), r: String(r), seg: '-1' });
    return {
      name: d.name, freq: d.freq, bands: d.bands.slice(),
      wires: [w([0, 0, d.feed], [0, 0, d.bend], 1), w([0, 0, d.bend], [horiz, 0, d.bend], 1), w([0, 0, d.feed], [0, -dy, d.chokeZ], 5)],
      sources: [{ pos: 'w1b', phase: 0, mag: 1, ratio: d.ratio }], loads: [],
      ground: { type: 2, height: 0, eps: d.eps, sigma: d.sigma }, material: 1, z0: 50,
      comment: 'Sourced from RF.Guru: ' + d.sourced + '. Background: ' + SRC.article + ' (ratio follows the installed load; ' + d.ratio + ':1 is an impedance ratio, ideal turns ratio about ' + Math.sqrt(d.ratio).toFixed(2) + ':1). ' +
        'Representative, adjustable: ' + d.chosen + '; wire 3 is the outside of the coax shield, ' + d.choke + ' m from the feedpoint down to ' + d.chokeZ + ' m at the choke, which is modelled as an ideal choke (open end); shield radius 5 mm, lower-conductivity soil (εr ' + d.eps + ', ' + d.sigma * 1000 + ' mS/m). ' +
        'Balun ' + d.ratio + ':1 is an ideal lossless transformer: the SWR is the 50 Ω side, "At the antenna" is the wire end. Not modelled: XLPE insulation, transformer loss, choke impedance, the optional ground stake (it would touch the soil and switch the impedance to the perfect mirror), sag and nearby objects. RF.Guru advises measuring and fine-tuning on site (trim wire 2 to move the dips): ' + d.trim + '. Calculated by default at ' + d.bands.join(' and ') + ' MHz. No measured SWR or loss is implied.'
    };
  }
  // wire roles, for tests and documentation only (kept out of the model so editing wires cannot desync it)
  rfGuruEfhwInvL.ROLES = ['radiator', 'radiator', 'return'];
  root.RFGURU_EFHW = RFGURU_EFHW;
  root.rfGuruEfhwInvL = rfGuruEfhwInvL;
})(typeof globalThis !== 'undefined' ? globalThis : self);
