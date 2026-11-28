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

Its distinguishing feature is the real-ground model: the impedance over lossy soil is solved with Sommerfeld
integrals, as NEC-2 does, so radials a few centimetres above the ground, low dipoles and feed lines near the soil
agree with NEC-2, ground loss included. That is where the name comes from.

This RF.Guru edition of Sommerwire was made by **ON9PK Koen Van den Heuvel** and
**[ON6URE](https://on6ure.be) Joeri Van Dooren** ([RF.Guru](https://shop.rf.guru)).
Koen created Sommerwire with Claude Opus 5.5 in November 2026 and maintains the
[upstream project](https://github.com/KoenVdH/sommerwire). Joeri co-developed this edition, including its RF.Guru antenna
presets, polarization readouts, calculation improvements and editable model links.

The [contribution history](CONTRIBUTION-HISTORY.md) documents the original app, upstream fixes and RF.Guru additions.
GitHub lists [every pull request merged into RF.Guru main](https://github.com/Guru-RF/sommerwire/pulls?q=is%3Apr+is%3Amerged+base%3Amain).
Original RF.Guru fork contributions are offered under [Apache-2.0](LICENSES/Apache-2.0.txt). Upstream material remains under the [Unlicense](LICENSES/Unlicense.txt). See [Licence](#licence) for scope.

## Features

- **Geometry** as editable tables (with expressions such as `R/4` or `33*F`) or drawn in a **3D editor** with snapping,
  wire splitting, undo/redo and live recalculation while you drag.
- **Sources** with an optional ideal balun or unun (4:1, 49:1…), **loads** (series L–C or parallel L–C traps with coil and
  capacitor loss and coil self-capacitance, or R + jX) and **transmission lines** across feed gaps, like NEC's TL card, with
  velocity factor and cable loss, for example a coax centre line in a hexbeam.
- **Insulated wire** (thin-sheath approximation, as NEC-4) and wire materials from copper to magnetic steel.
- **Tube elements**: build telescoping Yagi elements from their sections; steps in diameter are solved directly (no
  NEC-2-style substitution needed), and the DL6WU/G3SEK boom correction handles elements through a metal boom.
- **Ground**: free space, perfect ground, or real ground with εr and conductivity. Impedance over real ground with
  **Sommerfeld integrals** (default), a complex image (fast approximation) or a perfect mirror (as MININEC/MMANA-GAL);
  far field with Fresnel reflection.
- **Buildings**: a house beside the antenna with a metal roof as a wire grid, rain gutters and downpipes to earth.
- **Far field**: azimuth and elevation plots, horizontal/vertical/total polarization, a rotatable 3D pattern, and an angle summary (low-angle V and H, high-angle total, RDF). The readout shows the H and V peak gains, each over the whole pattern with its own elevation and azimuth and apart from the total-field Max gain, plus the H and V peaks side by side in a stated 5–30° low-angle (DX) window and in a 60–90° high-angle window, with the component of the antenna's own modelled polarization at that frequency highlighted (H for mostly-H, V for mostly-V, neither for *Mixed H+V*) and no propagation or dominance claim; the high-angle window is called NVIS only inside the amateur bands from 160 m to 30 m and is a high-angle antenna figure, not a propagation prediction, ground-wave figure or coverage promise; it also shows RDF beside F/B and names the polarization from the whole pattern (for example *Mixed H+V*), apart from the components toward the maximum; the 3D editor can draw the total, H, V or H + V far field on one scale. SWR always comes from the feedpoint of the coupled solve of all wires, never from the pattern.
- **HF, VHF and UHF**: the same solver from 160 m to 23 cm; long passive wires such as masts are coarsened automatically
  when a VHF/UHF model would otherwise exceed the 2500-unknown limit.
- **Frequency sweep** over a custom range, one HF or VHF/UHF amateur band, both 2 m and 70 cm at once (split axis), or the whole
  HF range (IARU Region 1, 2 or 3), with SWR,
  R/jX, gain and F/B charts, a Smith chart and a per-band summary. Runs on all processor cores.
- **Optimizer** (bounded Nelder–Mead) for lengths, positions and load values against SWR, jX, gain, F/B and
  elevation goals over several frequencies.
- **Examples**: Yagi, a 20 m Yagi of telescoping tubes on a metal boom, dipoles, inverted V, ground plane, quad loop, loaded dipole, 80/40 m trap dipole, fan dipole, OCF dipole, G5RV, ZS6BKW, delta loop, horizontal loop, Moxon,
  two-element quad, spiderbeam-style tri-band wire Yagi, 14–30 MHz LPDA, 160 m inverted-L, 40 m 4-square, 20 m magnetic loop, 40/20 m trap vertical, 160 m Beverage, a G3TXQ 5-band hexbeam tuned per band,
  an EFOC29 end-fed flat top, an EFHW-8010 end-fed half-wave for 80–10 m, RF.Guru EFHW16080 (160/80 m, 68:1) and EFHW8040 (80/40 m, 70:1) end-fed inverted-Ls, an RF.Guru EFOC29 (80–10 m, 4:1) flat top with its coax return section, the DX Commander vertical with 16 radials, and a dual-band 2 m/70 cm Yagi pair
  on a mast.
- **Share link**: copies a link with the editable model in its `#` fragment (no server, no upload): opening it in any
  browser loads the same model and calculates it again; results are not stored in it. Anyone with the link can read the
  model. Links are validated and bounded before anything loads; models too large for a link go through **Save .maa**.
- A complete **Help** tab: how to use everything, the physics behind each model, sources, validation, limitations
  and open questions.

- **RF.Guru theme**: the only look of this edition, in the app and the standalone Help page: dark, RF.Guru gold
  actions and links, the Sommerwire mark in RF.Guru colours and a GitHub link in the header. There is no theme switch.
- **Opens on the RF.Guru EFOC29**: an ordinary visit loads and calculates the eight-band RF.Guru EFOC29 example, the
  same model as in the Examples menu. A share link, an opened `.maa` file or another example replaces it.
- **Band strip**: under the readout, the antenna name, then **Bands** on its own row, then one button per band
  (SWR, impedance, F/B and RDF) in equal columns that start at the same place on every row and stack into one
  column on a narrow screen. A button makes that band the calculation frequency.
- **Embeddable 3D view**: `?embed=1` turns the app into a read-only presentation for another site: the band pickers
  in one row and the turning 3D view, nothing else. See [Embedding](#embedding).
- **Phone layout**: up to 640 px wide the same app is laid out in one column: Examples, the file and share buttons
  and **Calculate** at the top, a two-column readout led by frequency and SWR, a tab bar that stays on screen (the
  arrow keys, Home and End also move between tabs), a larger 3D view placed straight after the mode buttons, and
  touch-sized controls. A finger on empty space turns the 3D view in Select mode; two fingers zoom. Wide tables
  scroll inside their own frame, never the page. Nothing is removed, and larger screens and the `?embed=1`
  presentation are laid out as before.
- **Callsign plates**: the footer credit shows Belgian-style callsign plates, drawn locally in HTML, CSS and an
  inline SVG: ON9PK Koen Van den Heuvel (to his [QRZ.com page](https://www.qrz.com/db/ON9PK)) and ON6URE Joeri Van
  Dooren (to [on6ure.be](https://on6ure.be/)).
- **What changed**: dated change notes in Help (linked under the name and from the footer). The edition carries no
  version number.

## Source and upstream

- [Try the RF.Guru edition online](https://sommerwire.app/).
- This RF.Guru edition: <https://github.com/Guru-RF/sommerwire>
  ([merged pull requests](https://github.com/Guru-RF/sommerwire/pulls?q=is%3Apr+is%3Amerged+base%3Amain),
  [contribution history](CONTRIBUTION-HISTORY.md)).
- Koen’s upstream project: <https://github.com/KoenVdH/sommerwire>.
  [Try Koen’s upstream app online](https://koenvdh.github.io/sommerwire/).

## Running it

Sommerwire is plain HTML and JavaScript with no build step and no dependencies. It loads its engine into Web
Workers, so it must be served over HTTP rather than opened as a file:

```bash
python3 -m http.server 8000
```

from the repository folder, then open <http://localhost:8000>. Any static web host works too, for example GitHub
Pages serving the repository root.

## Embedding

Add `?embed=1` to the address and Sommerwire shows a read-only presentation for another web page: a **Bands** label,
one row of compact band pickers (`80m`, `40m` …; the frequency is in each picker's tooltip and accessible name, for
example "80 m, 3.6 MHz") and the existing 3D view of the antenna with its currents and far field, turning slowly.
Choosing a picker calculates that frequency and updates the view. There is no header, readout, editor, table, chart or
footer, and nothing can be edited: a drag turns the view, the mouse wheel and vertical swipes scroll the page around
it, and a pointer over the view pauses the turning for a few seconds, as in the 3D editor. With *reduce motion* set in
the visitor's system the view stands still.

Without a share link it opens the eight-band **RF.Guru EFOC29**, the same model as the app's default. This responsive
iframe fits a product page's side column (about 250 px wide and up; all eight pickers fit at 250 px):

```html
<iframe src="https://sommerwire.app/?embed=1"
        title="RF.Guru EFOC29 antenna in 3D, Sommerwire" loading="lazy"
        style="display:block;width:100%;aspect-ratio:1/1;min-height:280px;border:0"></iframe>
```

The frame fills whatever width the page gives it; the 3D view takes the height below the picker row, so change
`aspect-ratio` (for example `4/5` for a taller view) to suit the column. When there are more pickers than fit, or the
frame is narrower, the picker row scrolls sideways inside itself; the page does not.

**Any model**: make a share link in the app (**Share link**) and put `?embed=1` in front of its `#`:

```text
https://sommerwire.app/#sw=1.d.…          the share link
https://sommerwire.app/?embed=1#sw=1.d.…  the same model, embedded
```

The fragment is the unchanged share format: the same validation and limits apply, and the same link still opens the
full app without `?embed=1`. The pickers are the model's bands; a model without bands, or a link whose calculation
frequency is not one of them, also gets a picker for that frequency. A link that cannot be opened shows the reason
above the view and falls back to the EFOC29.

The presentation is made to work inside a frame from another site. It reads and writes no browser storage (a
cross-site frame is often denied it, and it does not need it), sends nothing to the embedding page and listens to
nothing from it (no `postMessage`), and changes no security setting of either page. It solves only the frequency on
show, in a Web Worker, as the app does. The site sets no `X-Frame-Options` or `frame-ancestors` rule; a host page
with its own Content Security Policy must allow `https://sommerwire.app` in `frame-src`.

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
| Modelled (representative) | feed 3.7 m, bend 16 m (mast cap): 12.3 m vertical + 69.7 m horizontal (custom vertical length below the published ~18–20 m range) | feed 1 m, bend 13.5 m: 12.5 m vertical + 28.36 m horizontal (horizontal inside the published 10–15 m range) |
| Return wire (representative) | 8 m shield exterior, feed down to 0.5 m, 5 mm radius | 4 m shield exterior, feed down to 1 m, 5 mm radius |

The 68:1 and 70:1 values are impedance ratios, entered as the source's ideal *Balun n:1* (the ideal turns ratios,
about 8.25:1 and 8.37:1, are not what the solver takes). The choke is ideal (open end of the shield wire). Lower-
conductivity soil (εr 5, 1 mS/m), Sommerfeld ground; every wire is above the soil so the perfect-mirror fallback is not
triggered, which is why the optional ground stake is left out. Not modelled: XLPE insulation (thickness not published),
transformer loss and parasitics, choke impedance, sag and surroundings. The EFHW8040 uses 40.86 m total as a modelled
compromise: with the rest of the geometry fixed, the horizontal length alone does not align both SWR dips, so 28.36 m
minimises the larger SWR at the two band frequencies (2.45 at 3.65 MHz and 2.45 at 7.10 MHz; a 1 kHz scan places the
dips at 3.522 and 7.260 MHz, SWR 1.08 and 1.50). The EFHW16080 keeps the full 82 m; its feed and bend heights come from an
engine grid search (feed 1–4 m, bend 10–16 m, 0.5 m then 0.1 m steps) for the lowest larger SWR at 1.85 and 3.65 MHz:
4.43 and 1.87 (dips at 1.740 and 3.594 MHz). The bend lands on the 16 m cap, and the 1.85 MHz SWR only spans 4.43–4.53
over the whole searched range: the fixed length, not the heights, keeps the 160 m dip below the band. RF.Guru advises
fine-tuning on site. The examples calculate both listed band frequencies by default (the strip under the readout shows SWR and
impedance at each), and open the Pattern tab in *Horizontal + vertical*: the H and V polarization components of
the same azimuth and elevation cuts, against one 0 dB reference (the total-field maximum).

Under the cuts, a table gives an angle summary per band: mean and peak V and H gain at low angles (5–30°, all azimuths),
mean and peak total gain at high angles (60–90°; a figure for how much goes up, not a propagation prediction, and called an
NVIS candidate only for frequencies inside the amateur bands 160, 80, 60, 40 and 30 m of the chosen band plan), and RDF toward the total-field maximum for two stated noise assumptions (whole visible sky with the published
4π convention, and 0–30° elevation only). Means are linear power weighted by solid angle. “Dominant” or “favoured” is
printed only for a difference of 3 dB or more. In the model, on the lower band of each example the high angles are
favoured (by 9.0 dB at 1.85 MHz and 7.4 dB at 3.65 MHz) and low-angle H exceeds V by 3.7 and 3.2 dB; on the upper band
neither holds (high minus low 2.1 and 0.8 dB, V minus H −2.5 and −0.7 dB). The vertical section does not make either
example V-dominant at low angles on this soil. Max gain and F/B keep their meaning (total-field maximum, and that maximum
against the opposite azimuth at the same elevation) and are now labelled as such.
These are model results, not measurements; no SWR, loss or gain figure from RF.Guru is reproduced.

## RF.Guru EFOC29 example: provenance and assumptions

Built by `rfGuruEfoc29()` in [efhwgen.js](efhwgen.js); checked by `node --test tests/` ([tests/efoc29.test.js](tests/efoc29.test.js)).
Sources (RF.Guru, retrieved 2026-11-27): [EFOC29 product page](https://shop.rf.guru/products/efoc29),
[EFOC29 installation guide](https://shop.rf.guru/pages/efoc29-antenna-installation-guide). It sits beside, and does not
replace, the maintainer's own *EFOC29 end-fed, flat top at 8 m* example.

| | Sourced | Modelled |
|---|---|---|
| Radiator | 29 m starting dimension, supplied longer for fold-back tuning | 29 m straight, untrimmed, 1 mm radius (assumed; gauge not published) |
| Transformer | integrated 4:1 unun | ideal lossless 4:1 (*Balun n:1* = 4) |
| Layout | flat top, feedpoint about 7–18 m; 7–8 m reference installation | flat top at 8 m (assumed) |
| Return path | coax-counterpoise version: about the first 12 m of coax exterior, ended by the first choke at about 12 m | 12 m shield exterior, straight, perpendicular to the radiator, from 8 m down to 2 m at the choke (route assumed), 3.6 mm radius (assumed) |
| Choke | six turns through the supplied ferrite core | ideal boundary: open end of the shield wire, no coax beyond it |
| Ground | — | Sommerfeld, lower-conductivity soil εr 5, 1 mS/m (assumed, as the EFHW examples) |

Default calculation frequencies, one per band 80–10 m: 3.6 MHz (80 m, the guide's tuning target), 7.1, 10.125, 14.175,
18.118, 21.225 and 24.94 MHz (Region 1 band centres) and 28.5 MHz (10 m, the lower part where the guide places the
resonance). 60 m is left out (RF.Guru says it needs a tuner); 30 and 15 m are included although they may need one. The
modelled SWR on the 50 Ω side is 2.58 (3.6 MHz), 2.86 (7.1), 17.50 (10.125), 3.13 (14.175), 1.53 (18.118), 5.88 (21.225),
8.94 (24.94) and 2.84 (28.5); on 30 m the 29 m wire is about one wavelength long and presents about 3410 − j540 Ω at the
feedpoint, 854 − j136 Ω on the 50 Ω side of the 4:1, so that band needs a tuner in this model. Doubling the segment density moves these by 3 % or less. These are model figures for the stated assumptions. They are not
measurements and are not compared with RF.Guru's typical installed VSWR (below 2.5:1, below about 3:1 on 80 m), which
RF.Guru gives as a setup target for a tuned installation, not a guarantee. No length was trimmed to approach it. Not modelled: XLPE
insulation, transformer loss and parasitics, the choke's finite impedance, the station-side coax and second choke, other
coax routes (zig-zag, near the ground), the 13 m wire-counterpoise version, the inverted-L, inverted-U and sloper layouts,
sag and nearby objects. RF.Guru advises measuring the installed antenna and tuning it by folding back the surplus wire.
Like the EFHW examples, it opens the Pattern tab in *Horizontal + vertical*.

**10 m mast with a buried coax return: study, no preset.** A separate study,
[validation/efoc29-mast](validation/efoc29-mast/README.md), asks for the feed height that minimises the worst SWR at these
eight frequencies with the 29 m wire rising from the feedpoint to a 10 m mast top and then running horizontally (an
assumed inverted-L), and the 12 m coax return running down the mast and then buried to the choke. Neither Sommerwire nor
NEC-2 can model a buried wire (both reject it), so the study sweeps explicitly labelled above-soil proxies and a truncated
bound instead. It finds no defensible buried optimum: 30 m decides the worst SWR (12.6–18.7 at the best feed height of
every proxy and soil), that best height sits on an edge of the searched 0.75–9 m range for every above-soil proxy and
flips between the two edges with the proxy height, and the truncated bound gives a different antenna altogether. No mast preset was added
for that reason.

## How it works

- **Wires**: thin-wire method of moments in the MININEC style: pulse currents at the nodes, constant charge per
  segment, reduced kernel, point matching, k − 1 unknowns at a k-wire junction, tapered segmentation as in
  MMANA-GAL.
- **Real ground**: the reflected field is split into a quasi-static image (the perfect mirror scaled by
  (εc − 1)/(εc + 1), integrated with the same reduced kernel as the wires) and a smooth remainder from the Sommerfeld half-space
  integrals, tabulated once per frequency and interpolated during the matrix fill: the same organisation as NEC-2,
  with the formulas derived independently and written without numerical cancellation.
- **Far field**: sum over all segments with Fresnel reflection; gain relative to input power, so wire, load and
  ground losses lower it.

The Help tab describes every model in detail, with references.

## Validation

Compared with nec2c (the C translation of the public-domain NEC-2), same geometry and comparable segmentation (NEC-2
feeds the centre of an odd segment, Sommerwire a node between even ones), average ground (εr 13, 5 mS/m), Sommerfeld
ground in both. The gains are the peaks of one elevation cut:

| Case | nec2c | Sommerwire |
|---|---|---|
| 20 m dipole at 0.3 m | 100.3 + j55.0 Ω, −5.77 dBi | 100.1 + j53.4 Ω, −5.78 dBi |
| 20 m dipole at 1 m | 63.9 + j8.5 Ω, −0.76 dBi | 63.7 + j7.0 Ω, −0.77 dBi |
| 20 m dipole at 10 m | 71.2 − j12.7 Ω, 7.06 dBi | 71.0 − j14.2 Ω, 7.06 dBi |
| Vertical dipole, bottom at 0.5 m | 89.6 − j2.9 Ω, 0.27 dBi | 89.3 − j4.6 Ω, 0.27 dBi |
| λ/4 vertical, 16 × 5 m radials at 5 cm, 7.1 MHz | 44.9 − j35.9 Ω, −1.21 dBi | 44.2 − j38.5 Ω, −1.18 dBi |

Resistance agrees within 1–3 %, gain within 0.1 dB; the reactance offset of 1–4 Ω is the usual difference between
MININEC- and NEC-style current expansions. On the DX Commander's small, crowded hub the codes differ more; a power
balance over perfect ground shows NEC-2 losing about 20 % of the input power there while Sommerwire conserves it,
which points to NEC-2 but does not prove either result. These are comparisons between programs, not measurements.
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
tests/               node --test regression tests (embedded presentation and band strip layout, RF.Guru EFHW inverted-L and EFOC29 examples, band strip, H + V pattern view, angle summary and RDF, polarization label and editor far-field views, H / V peak readout, low- and high-angle window tiles and the NVIS naming rule)
validation/nec2c/    comparison with NEC-2: decks, outputs, scripts
validation/efoc29-mast/  EFOC29 on a 10 m mast with a buried return: feed-height study on above-soil proxies, with a nec2c check
```

## Acknowledgements

Sommerwire was written from published methods; no code from MMANA-GAL, MININEC or NEC was used. It builds on the
work behind MININEC (Julian, Logan and Rockway), NEC-2 (Burke and Poggio), Sommerfeld's half-space solution, and
MMANA-GAL, whose `.maa` format it shares. The hexbeam example follows Steve Hunt G3TXQ's broadband design.

The RF.Guru EFHW inverted-L and EFOC29 examples were modelled and contributed by [ON6URE](https://on6ure.be) Joeri Van Dooren
([RF.Guru](https://shop.rf.guru)) from RF.Guru's
published dimensions; see [provenance and assumptions](#rfguru-efhw-inverted-l-examples-provenance-and-assumptions) and
[the EFOC29 example](#rfguru-efoc29-example-provenance-and-assumptions).

## Licence

Original RF.Guru fork contributions are offered under [Apache-2.0](LICENSES/Apache-2.0.txt). Upstream material remains under the [Unlicense](LICENSES/Unlicense.txt). This includes upstream code merged after the fork. In mixed files each license applies to its respective portions. Earlier Unlicense grants for published fork contributions remain available. Third-party material retains its applicable terms. See [LICENSE](LICENSE).
