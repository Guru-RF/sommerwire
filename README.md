<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo-light.svg" alt="Sommerwire, Wire Antenna Modeler" width="300">
  </picture>
</p>

# Sommerwire

A wire antenna modeler that runs in your browser. Sommerwire calculates feed impedance, SWR, gain and radiation
patterns of wire antennas with the method of moments, over free space, perfect ground or real soil, and reads and
writes MMANA-GAL `.maa` files.

For wires elevated above flat, homogeneous soil, the default impedance solve includes soil coupling through
Sommerfeld integrals. The archived comparisons include 14.05 MHz dipoles at heights of 0.3, 1, 3 and 10 m
and a 7.1 MHz vertical with elevated radials at 0.05, 0.3 and 2 m.

Sommerwire was made by **ON9PK Koen Van den Heuvel** with the help of Claude Opus 5.5 in November 2026. Free and unencumbered software, released into the public domain (see [LICENSE](LICENSE)).

## Features

- **Geometry** as editable tables (with expressions such as `R/4` or `33*F`) or drawn in a **3D editor** with snapping,
  wire splitting, undo/redo and live recalculation while you drag.
- **Sources** with an optional ideal balun or unun (4:1, 49:1…), **loads** (series L–C or parallel L–C traps with coil and
  capacitor loss and coil self-capacitance, or R + jX) and **transmission lines** across feed gaps, like NEC's TL card, with
  velocity factor and optional cable loss. The line transfers differential power between ports without radiating.
  Draw the coax shield exterior as a wire to model common-mode current.
- **Insulated wire** (thin-sheath approximation, as NEC-4) and wire materials from copper to magnetic steel.
- **Ground**: free space, perfect ground, or real ground with εr and conductivity. Impedance over real ground with
  **Sommerfeld integrals** (default), a complex image (fast approximation) or a perfect mirror (as MININEC/MMANA-GAL);
  far field with Fresnel reflection.
- **Buildings**: a house beside the antenna with a metal roof as a wire grid, rain gutters and downpipes to earth.
- **Far field**: azimuth and elevation plots, horizontal/vertical/total polarization, a rotatable 3D pattern.
- **HF, VHF and UHF**: the same solver from 160 m to 23 cm; long passive wires such as masts are coarsened automatically
  when a VHF/UHF model would otherwise exceed the 2500-unknown limit. Check the affected wires at finer
  counts as described in the segmentation section of the help. Run `node validation/mesh-sensitivity.js`
  for a free-space example comparing feed R, X and gain in one fixed direction.
- **Frequency sweep** over a custom range, one HF or VHF/UHF amateur band, both 2 m and 70 cm at once (split axis), or the whole
  HF range (IARU Region 1, 2 or 3), with SWR,
  R/jX, gain and F/B charts, a Smith chart and a per-band summary. Runs on all processor cores.
- **Optimizer** (bounded Nelder–Mead) for lengths, positions and load values against SWR, jX, gain, F/B and
  elevation goals over several frequencies.
- **Examples**: Yagi, dipoles, inverted V, ground plane, quad loop, loaded dipole, 80/40 m trap dipole, fan dipole, OCF dipole, G5RV, ZS6BKW, delta loop, horizontal loop, Moxon,
  two-element quad, spiderbeam-style tri-band wire Yagi, 14–30 MHz LPDA, 160 m inverted-L, 40 m 4-square, 20 m magnetic loop, 40/20 m trap vertical, 160 m Beverage, a G3TXQ 5-band hexbeam tuned per band,
  an EFOC29 end-fed flat top, an EFHW-8010 end-fed half-wave for 80–10 m, RF.Guru EFHW16080 (160/80 m, 68:1) and EFHW8040 (80/40 m, 70:1) end-fed inverted-Ls, the DX Commander vertical with 16 radials, and a dual-band 2 m/70 cm Yagi pair
  on a mast.
- A complete **Help** tab: how to use everything, the physics behind each model, sources, validation, limitations
  and open questions.

**Try it online:** <https://koenvdh.github.io/sommerwire/>

## Running it

Sommerwire is plain HTML and JavaScript with no build step and no dependencies. It loads its engine into Web
Workers, so it must be served over HTTP rather than opened as a file:

```bash
python3 -m http.server 8000
```

from the repository folder, then open <http://localhost:8000>. Any static web host works too, for example GitHub
Pages serving the repository root.

## RF.Guru EFHW inverted-L examples: provenance and assumptions

Built by [efhwgen.js](efhwgen.js); checked by `node --test tests/`. Sources (RF.Guru, retrieved 2026-11-26):
[low-band inverted-L and 68:1 / 70:1 ratios](https://shop.rf.guru/pages/why-rf-guru-recommends-only-inverted-l-for-160-80m-and-80m-40m-with-68-70-1-transformers-for-end-fed-antennas),
[EFHW16080 product](https://shop.rf.guru/products/2024-efhw16080-4000),
[EFHW16080 technical overview](https://shop.rf.guru/pages/efhw16080-inverted-l-technical-overview),
[EFHW8040 product](https://shop.rf.guru/products/2024-efhw8040-4000).

| | EFHW16080, 160/80 m | EFHW8040, 80/40 m |
|---|---|---|
| Transformer (sourced) | 68:1 | 70:1 |
| Wire (sourced) | ~82 m, 2 mm | 41 m, 2 mm |
| Layout (sourced) | ~18–20 m vertical, rest horizontal, horizontal ≥ 15 m, feed ≥ 1 m | horizontal 10–15 m, feed ≥ 1 m (best 2–5 m) |
| Return (sourced) | coax shield as counterpoise, choke ~8 m from the feed | choke ~4 m from the feed |
| Modelled (representative) | feed 1 m, bend 17 m: 16 m vertical + 66 m horizontal (custom vertical length below the published ~18–20 m range) | feed 3 m, bend 19 m: 16 m vertical + 25 m horizontal (custom height above the published 10–15 m range) |
| Return wire (representative) | 8 m shield exterior, feed down to 0.5 m, 5 mm radius | 4 m shield exterior, feed down to 1 m, 5 mm radius |

The 68:1 and 70:1 values are impedance ratios, entered as the source's ideal *Balun n:1* (the ideal turns ratios,
about 8.25:1 and 8.37:1, are not what the solver takes). The choke is ideal (open end of the shield wire). Average soil
(εr 13, 5 mS/m), Sommerfeld ground; every wire is above the soil so the perfect-mirror fallback is not triggered, which
is why the optional ground stake is left out. Not modelled: XLPE insulation (thickness not published), transformer loss
and parasitics, choke impedance, sag and surroundings. The wire is the full supplied length, untrimmed: in the model the
lowest dip falls below 160 m (EFHW16080) and at the bottom edge of 80 m (EFHW8040); RF.Guru advises fine-tuning on site.
These are model results, not measurements; no SWR, loss or gain figure from RF.Guru is reproduced.

## How it works

- **Wires**: thin-wire method of moments in the MININEC style: pulse currents at the nodes, constant charge per
  segment, reduced kernel, point matching, k − 1 unknowns at a k-wire junction, tapered segmentation as in
  MMANA-GAL.
- **Real ground**: the reflected field is split into a quasi-static image (the perfect mirror scaled by
  (εc − 1)/(εc + 1), integrated with the reduced wire kernel) and a smooth remainder from the Sommerfeld half-space
  integrals, tabulated once per frequency and interpolated during the matrix fill: the same organisation as NEC-2,
  with the formulas derived independently and written without numerical cancellation.
- **Far field** uses the solved currents and Fresnel reflection for the sky wave over real soil. Gain uses net
  power accepted across all driven ports and includes modeled losses. Realized gain at the transmitter also
  depends on mismatch and any unmodeled feed-system losses. See the [mixed-ground gain limit](help.html#mixgain)
  for mirror-solved currents over real soil.

The Help tab describes every model in detail, with references.

## Validation

The archived nec2c comparison checks feed impedance and peak gain sampled on one elevation cut at azimuth 0°.
The table shows selected fine-mesh results over average soil (εr 13, 5 mS/m) with Sommerfeld ground in both
solvers. The geometry is shared. A centre feed uses an odd segment count in nec2c and an even count in Sommerwire.

| Case | nec2c | Sommerwire |
|---|---|---|
| 20 m dipole at 0.3 m | 100.3 + j55.0 Ω, −5.77 dBi | 100.1 + j53.4 Ω, −5.78 dBi |
| 20 m dipole at 1 m | 63.9 + j8.5 Ω, −0.76 dBi | 63.7 + j7.0 Ω, −0.77 dBi |
| 20 m dipole at 10 m | 71.2 − j12.7 Ω, 7.06 dBi | 71.0 − j14.2 Ω, 7.06 dBi |
| Vertical dipole, bottom at 0.5 m | 89.6 − j2.9 Ω, 0.27 dBi | 89.3 − j4.6 Ω, 0.27 dBi |
| λ/4 vertical, 16 × 5 m radials at 5 cm, 7.1 MHz | 44.9 − j35.9 Ω, −1.21 dBi | 44.2 − j38.5 Ω, −1.18 dBi |

For the rows shown, gain differs by less than 0.1 dB.
For the 7.1 MHz vertical with radials at 0.3 m, Sommerwire reactance changes from −52.93 to −48.60 Ω
on refinement. Two mesh densities give no general near-ground error bound. The archive also lacks a
systematic validation of Sommerfeld-table interpolation and calibrated installed impedance, current,
efficiency or field-strength measurements.

For the separate lossless DX Commander case over perfect ground at 14.175 MHz, integrating the archived NEC gain
over the hemisphere gives a radiated-to-accepted power ratio of 0.782. The discrepancy leaves the accuracy
of the hub currents unresolved.
These are comparisons between programs, not measurements.
The decks, outputs and scripts are in [validation/nec2c](validation/nec2c).

## Limitations

Thin wires only; a wire touching the ground switches the impedance to the perfect mirror, and the gain is then
approximate (marked ≈, and limited so the pattern never holds more power than the feed supplies); no buried wires, layered
soil or ground wave; walls and other dielectrics apart from wire insulation are not modelled; baluns are ideal
transformers; at most 2500 unknowns. The
Help tab lists these and the open questions in full.

## Repository layout

```
index.html           the application, with engine.js, structgen.js, hexgen.js, efhwgen.js and help.html beside it
brand/               logo and icon (light, dark and auto-switching SVG)
tools/               make_logo.py, which generates the logo files
models/              example model files (.maa)
tests/               node --test regression tests (RF.Guru EFHW inverted-L examples)
validation/nec2c/    comparison with NEC-2: decks, outputs, scripts
```

## Acknowledgements

Sommerwire was written from published methods; no code from MMANA-GAL, MININEC or NEC was used. It builds on the
work behind MININEC (Julian, Logan and Rockway), NEC-2 (Burke and Poggio), Sommerfeld's half-space solution, and
MMANA-GAL, whose `.maa` format it shares. The hexbeam example follows Steve Hunt G3TXQ's broadband design.

## Licence

Public domain under the [Unlicense](LICENSE): anyone may copy, modify, publish, use, compile, sell or distribute
Sommerwire, for any purpose. It comes without any warranty.
