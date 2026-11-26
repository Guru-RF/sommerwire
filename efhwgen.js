/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* RF.Guru low-band EFHW inverted-L examples (EFHW16080 and EFHW8040).
 *
 * Sourced (RF.Guru pages, retrieved 2026-11-26):
 *   EFHW16080: integrated 68:1 unun, ~82 m 2 mm wire, "~18–20 m vertical + remainder horizontal",
 *              horizontal >= 15 m above ground, feedpoint >= 1 m, "the coax shield forms the counterpoise",
 *              high-CMR choke ~8 m from the feedpoint.
 *   EFHW8040:  integrated 70:1 unun, 41 m 2 mm wire, horizontal 10–15 m above ground, feedpoint >= 1 m
 *              (best 2–5 m), common-mode choke ~4 m from the feedpoint.
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
  // total: radiator wire length; feed/bend: heights (m); choke: shield length to the choke; drop: height lost by the coax to the choke
  const RFGURU_EFHW = {
    '16080': { name: 'RF.Guru EFHW16080 inverted-L, 160/80 m, 68:1', freq: 1.85, ratio: 68, total: 82, feed: 1, bend: 20, choke: 8, chokeZ: 0.5,
      sourced: '68:1 unun, ~82 m 2 mm wire, ~18–20 m vertical with the remainder horizontal and high (horizontal at least 15 m), feedpoint at least 1 m, coax shield as the counterpoise with a high-CMR choke about 8 m from the feedpoint (' + SRC.p16080 + ', ' + SRC.o16080 + ')',
      chosen: 'feedpoint 1 m and bend 20 m (19 m vertical, 63 m horizontal at 20 m)' },
    '8040': { name: 'RF.Guru EFHW8040 inverted-L, 80/40 m, 70:1', freq: 3.65, ratio: 70, total: 41, feed: 3, bend: 12, choke: 4, chokeZ: 1,
      sourced: '70:1 unun, 41 m 2 mm wire, horizontal 10–15 m above ground, feedpoint at least 1 m and best 2–5 m, common-mode choke about 4 m from the feedpoint (' + SRC.p8040 + ')',
      chosen: 'feedpoint 3 m and bend 12 m (9 m vertical, 32 m horizontal at 12 m); RF.Guru gives no vertical length for this model' }
  };
  function rfGuruEfhwInvL(key) {
    const d = RFGURU_EFHW[key];
    if (!d) throw new Error('Unknown RF.Guru EFHW example: ' + key);
    const vert = d.bend - d.feed, horiz = d.total - vert;
    const dy = Math.sqrt(d.choke * d.choke - (d.feed - d.chokeZ) ** 2);
    const w = (a, b, r) => ({ x1: fm(a[0]), y1: fm(a[1]), z1: fm(a[2]), x2: fm(b[0]), y2: fm(b[1]), z2: fm(b[2]), r: String(r), seg: '-1' });
    return {
      name: d.name, freq: d.freq,
      wires: [w([0, 0, d.feed], [0, 0, d.bend], 1), w([0, 0, d.bend], [horiz, 0, d.bend], 1), w([0, 0, d.feed], [0, -dy, d.chokeZ], 5)],
      sources: [{ pos: 'w1b', phase: 0, mag: 1, ratio: d.ratio }], loads: [],
      ground: { type: 2, height: 0, eps: 13, sigma: 0.005 }, material: 1, z0: 50,
      comment: 'Sourced from RF.Guru: ' + d.sourced + '. Background: ' + SRC.article + ' (ratio follows the installed load; ' + d.ratio + ':1 is an impedance ratio, ideal turns ratio about ' + Math.sqrt(d.ratio).toFixed(2) + ':1). ' +
        'Representative, adjustable: ' + d.chosen + '; wire 3 is the outside of the coax shield, ' + d.choke + ' m from the feedpoint down to ' + d.chokeZ + ' m at the choke, which is modelled as an ideal choke (open end); shield radius 5 mm, average soil (εr 13, 5 mS/m). ' +
        'Balun ' + d.ratio + ':1 is an ideal lossless transformer: the SWR is the 50 Ω side, "At the antenna" is the wire end. Not modelled: XLPE insulation, transformer loss, choke impedance, the optional ground stake (it would touch the soil and switch the impedance to the perfect mirror), sag and nearby objects. RF.Guru advises measuring and fine-tuning on site: the full supplied wire length is used here untrimmed, so the model\'s dips may sit below the band; trim wire 2 to move them. No measured SWR or loss is implied.'
    };
  }
  // wire roles, for tests and documentation only (kept out of the model so editing wires cannot desync it)
  rfGuruEfhwInvL.ROLES = ['radiator', 'radiator', 'return'];
  root.RFGURU_EFHW = RFGURU_EFHW;
  root.rfGuruEfhwInvL = rfGuruEfhwInvL;
})(typeof globalThis !== 'undefined' ? globalThis : self);
