# Sommerwire

A wire antenna modeler that runs in your browser. Sommerwire calculates feed impedance, SWR, gain and radiation
patterns of wire antennas with the method of moments, over free space, perfect ground or real soil, and reads and
writes MMANA-GAL `.maa` files.

Its distinguishing feature is the real-ground model: the impedance over lossy soil is solved with Sommerfeld
integrals, as NEC-2 does, so radials a few centimetres above the ground, low dipoles and feed lines near the soil
come out right, ground loss included. That is where the name comes from.

By **ON9PK Koen Van den Heuvel**. Free and unencumbered software, released into the public domain (see [LICENSE](LICENSE)).

## Features

- **Geometry** as editable tables (with expressions such as `R/4` or `33*F`) or drawn in a **3D editor** with snapping,
  wire splitting, undo/redo and live recalculation while you drag.
- **Sources, loads** (series L–C with Q, or R + jX) and **transmission lines** (ideal lines across feed gaps, like
  NEC's TL card), for example a coax centre line in a hexbeam.
- **Ground**: free space, perfect ground, or real ground with εr and conductivity. Impedance over real ground with
  **Sommerfeld integrals** (default), a complex image (fast approximation) or a perfect mirror (as MININEC/MMANA-GAL);
  far field with Fresnel reflection.
- **Buildings**: a house beside the antenna with a metal roof as a wire grid, rain gutters and downpipes to earth.
- **Far field**: azimuth and elevation plots, horizontal/vertical/total polarization, a rotatable 3D pattern.
- **Frequency sweep** over a custom range, one amateur band or the whole HF range (IARU Region 1, 2 or 3), with SWR,
  R/jX, gain and F/B charts, a Smith chart and a per-band summary. Runs on all processor cores.
- **Optimizer** (bounded Nelder–Mead) for lengths, positions and load values against SWR, jX, gain, F/B and
  elevation goals over several frequencies.
- **Examples**: Yagi, dipoles, inverted V, ground plane, quad, loaded dipole, G3TXQ hexbeams, EFOC29 end-fed
  set-ups (one beside a house) and the DX Commander vertical with 16 radials.
- A complete **Help** tab: how to use everything, the physics behind each model, sources, validation, limitations
  and open questions.

## Running it

Sommerwire is plain HTML and JavaScript with no build step and no dependencies. It loads its engine into Web
Workers, so it must be served over HTTP rather than opened as a file:

```bash
python3 -m http.server 8000 --directory sommerwire
```

then open <http://localhost:8000>. Any static web host works too, for example GitHub Pages pointed at the
`sommerwire` folder.

## How it works

- **Wires**: thin-wire method of moments in the MININEC style: pulse currents at the nodes, constant charge per
  segment, reduced kernel, point matching, k − 1 unknowns at a k-wire junction, tapered segmentation as in
  MMANA-GAL.
- **Real ground**: the reflected field is split into a quasi-static image (the perfect mirror scaled by
  (εc − 1)/(εc + 1), integrated with the exact kernel) and a smooth remainder from the Sommerfeld half-space
  integrals, tabulated once per frequency and interpolated during the matrix fill: the same organisation as NEC-2,
  with the formulas derived independently and written without numerical cancellation.
- **Far field**: sum over all segments with Fresnel reflection; gain relative to input power, so wire, load and
  ground losses lower it.

The Help tab describes every model in detail, with references.

## Validation

Compared with nec2c (the C translation of the public-domain NEC-2), same geometry and segmentation, average ground
(εr 13, 5 mS/m), Sommerfeld ground in both:

| Case | nec2c | Sommerwire |
|---|---|---|
| 20 m dipole at 0.3 m | 100.3 + j55.0 Ω, −5.77 dBi | 100.1 + j53.4 Ω, −5.78 dBi |
| 20 m dipole at 1 m | 63.9 + j8.5 Ω, −0.76 dBi | 63.7 + j7.0 Ω, −0.77 dBi |
| 20 m dipole at 10 m | 71.2 − j12.7 Ω, 7.06 dBi | 71.0 − j14.2 Ω, 7.06 dBi |
| Vertical dipole, bottom at 0.5 m | 89.6 − j2.9 Ω, 0.27 dBi | 89.3 − j4.6 Ω, 0.27 dBi |
| λ/4 vertical, 16 × 5 m radials at 5 cm, 7.1 MHz | 44.9 − j35.9 Ω, −1.21 dBi | 44.2 − j38.5 Ω, −1.18 dBi |

Resistance agrees within 1–3 %, gain within 0.1 dB; the reactance offset of 1–4 Ω is the usual difference between
MININEC- and NEC-style current expansions. On the DX Commander's small, crowded hub the codes differ more; a power
balance over perfect ground shows NEC-2 losing about 20 % of the input power there while Sommerwire conserves it.
The decks, outputs and scripts are in [validation/nec2c](validation/nec2c).

## Limitations

Thin wires only; a wire touching the ground switches the impedance to the perfect mirror; no buried wires, layered
soil or ground wave; dielectrics (insulated wire, walls) and baluns are not modelled; at most 2500 unknowns. The
Help tab lists these and the open questions in full.

## Repository layout

```
sommerwire/          the application (index.html, engine.js, structgen.js, hexgen.js, help.html)
models/              example model files (.maa)
validation/nec2c/    comparison with NEC-2: decks, outputs, scripts
```

## Acknowledgements

Sommerwire was written from published methods; no code from MMANA-GAL, MININEC or NEC was used. It builds on the
work behind MININEC (Julian, Logan and Rockway), NEC-2 (Burke and Poggio), Sommerfeld's half-space solution, and
MMANA-GAL, whose `.maa` format it shares. The hexbeam examples follow Steve Hunt G3TXQ's broadband design; the EFOC29
examples follow rf.guru's installation guide.

## Licence

Public domain under the [Unlicense](LICENSE): anyone may copy, modify, publish, use, compile, sell or distribute
Sommerwire, for any purpose. It comes without any warranty.
