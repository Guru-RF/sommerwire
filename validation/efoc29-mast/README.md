# EFOC29 on a 10 m mast with a buried coax return: feed-height study

> **Result: no defensible literal buried optimum.** Neither solver available here can model a buried wire, so every
> number below comes from an **above-soil proxy** or a **truncated bound**. None of them is a buried model, and none was
> shipped as a preset. These are model figures, not measurements.

Reproduce from the repository root (Node.js only; about 40 s on 32 cores):

    node validation/efoc29-mast/study.js                                 # writes results.json
    NEC2C=/path/to/nec2c node validation/efoc29-mast/nec2c-check.js      # writes nec2c-results.json
    node --test tests/                                                   # tests/efoc29-mast-study.test.js pins the claims

## Question

What feed height h minimises the **worst SWR** (50 Ω side of an ideal 4:1) over eight target frequencies, 3.6, 7.1,
10.125, 14.175, 18.118, 21.225, 24.94 and 28.5 MHz (80, 40, 30, 20, 17, 15, 12 and 10 m, the same frequencies as the
RF.Guru EFOC29 preset), for this installation:

| | Value | Basis |
|---|---|---|
| Radiator | 29 m, fixed (not trimmed) | RF.Guru 29 m starting dimension |
| Layout | **assumed:** vertical from the feedpoint at h up to the 10 m mast top, then horizontal (+X) for the remaining 19 + h m; an inverted-L | task; RF.Guru's own inverted-L is 26–28 m with 7–12 m vertical and 15–20 m horizontal, so 29 m is outside its published inverted-L range |
| Mast | 10 m, **assumed** non-conductive (not modelled) | task |
| Transformer | ideal lossless 4:1 unun at the feedpoint | RF.Guru (integrated 4:1) |
| Return path | coax shield exterior, about 12 m from the feedpoint to the first choke; **assumed** to go straight down the mast to the soil, then **buried**, run perpendicular to the radiator (−Y) | RF.Guru: "approximately the first 12 m of coax exterior is an intentional part of the RF return path" |
| Choke | ideal: open end of the shield wire, no coax beyond it | RF.Guru: six turns through the ferrite at ~12 m |
| Wires | radiator 1 mm radius, shield 3.6 mm radius, copper | assumed (as the preset) |
| Feed height | swept 0.75–9 m (0.25 m grid, then 0.05 m around the best) | practical range on a 10 m mast |
| Soil | poor εr 5, 1 mS/m · average εr 13, 5 mS/m · good εr 20, 30 mS/m | realistic range |

## What RF.Guru says about the return route

From the [EFOC29 installation guide](https://shop.rf.guru/pages/efoc29-antenna-installation-guide) (retrieved
2026-11-27): the ~12 m section "may run horizontally, follow a gentle zig-zag or lie near the ground when the site
demands it. Slight elevation can reduce ground coupling, while every route changes the installed RF circuit." The kit
ships about 26 m of EXTRAFLEX-BURY-7 (direct-burial-rated) coax, but the guide **does not describe burying the return
section**. The [return-path article](https://shop.rf.guru/pages/counterpoise-return-path-coax-current-choke-boundary)
lists "on-ground or buried conductors" only as a branch whose geometry and soil must be declared. A buried return is
therefore the task's assumption, not an RF.Guru instruction.

## Why the buried run cannot be solved here

- **Sommerwire** throws on any wire below the soil (`engine.js`: "Buried wires and wires crossing the ground plane beyond
  the contact tolerance are unsupported"). A return lying *on* the soil is solved, but the whole impedance switches to
  the perfect mirror (`mirrorMix`), which ignores soil loss and coupling. Both are recorded in `results.json` →
  `literal`, and both are excluded from the study.
- **nec2c (NEC-2)** stops with "GEOMETRY DATA ERROR -- SEGMENT … EXTENDS BELOW GROUND" (`geometry.c`). NEC-2 has no
  buried-wire model.
- NEC-4 models buried wires, but it is licensed and not available here. No FDTD solver (for example openEMS) is
  installed, and none has been validated for this case. So **no credible buried-capable independent solver was
  available**.

## Proxies swept instead (explicitly not buried)

| Name | Return path in the model |
|---|---|
| P05, P10, P25, P50 | shield down the mast to zp = 5, 10, 25 or 50 cm **above** the soil, then horizontal at zp for the rest of the 12 m |
| T05 | truncated bound: shield down the mast to 5 cm above the soil and stops there (the buried run contributes nothing, the limit of a strongly soil-damped run) |

Every proxy wire is above the soil, so Sommerwire uses its Sommerfeld ground with no mirror fallback; the study aborts
if any point falls back. A real buried run in lossy soil is expected to fall somewhere between "P05" (low loss, weakly
coupled) and "T05" (fully damped). That is a physical expectation, not something shown here.

## Results (Sommerwire, `results.json`)

Worst SWR over the eight frequencies at the best feed height of each proxy and soil, with the per-band SWR at that height:

| Soil | Proxy | Best h (m) | Worst SWR | 80 | 40 | 30 | 20 | 17 | 15 | 12 | 10 | Runner-ups h: worst | On search edge | Mesh ×2 / ×4 (max %) | Run toward −X (max %) | Best h without 30 m: worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| poor | P05 | 0.75 | 17.45 | 4.18 | 1.07 | 17.45 | 2.44 | 2.00 | 8.67 | 4.11 | 1.98 | 0.8: 17.57, 0.85: 17.68 | yes | 1.0 / 1.2 | 11.9 | 8.5: 6.34 |
| poor | P10 | 9 | 18.41 | 2.87 | 1.48 | 18.41 | 2.09 | 1.38 | 5.89 | 8.46 | 2.87 | 8.95: 18.45, 8.9: 18.49 | yes | 2.7 / 3.2 | 4.0 | 2.5: 6.31 |
| poor | P25 | 9 | 17.71 | 2.64 | 1.82 | 17.71 | 2.75 | 1.54 | 6.10 | 10.32 | 3.34 | 8.95: 17.75, 8.9: 17.78 | yes | 2.5 / 3.1 | 4.4 | 2.5: 5.59 |
| poor | P50 | 9 | 17.26 | 2.50 | 2.14 | 17.26 | 3.43 | 1.73 | 6.26 | 11.53 | 3.60 | 8.95: 17.29, 8.9: 17.32 | yes | 2.4 / 3.0 | 4.9 | 0.75: 6.09 (edge) |
| poor | T05 | 8.4 | 13.64 | 3.51 | 8.68 | 13.64 | 13.19 | 8.69 | 13.49 | 5.00 | 1.76 | 8.45: 13.65, 8.5: 13.66 | no | 2.1 / 2.6 | 0.0 | 6.75: 13.33 |
| average | P05 | 0.75 | 14.94 | 7.00 | 1.23 | 14.94 | 2.91 | 2.23 | 8.45 | 4.46 | 2.20 | 0.8: 15.05, 0.85: 15.15 | yes | 1.0 / 1.2 | 7.2 | 8.75: 6.03 |
| average | P10 | 0.75 | 18.03 | 5.85 | 1.18 | 18.03 | 2.40 | 1.70 | 7.87 | 4.25 | 1.82 | 0.8: 18.12, 0.85: 18.21 | yes | 1.0 / 1.4 | 7.2 | 2.25: 6.68 |
| average | P25 | 9 | 17.39 | 3.92 | 1.64 | 17.39 | 2.46 | 1.43 | 6.01 | 10.24 | 3.49 | 8.95: 17.43, 8.9: 17.47 | yes | 2.6 / 3.1 | 3.2 | 2.25: 5.67 |
| average | P50 | 9 | 16.73 | 3.55 | 1.96 | 16.73 | 3.20 | 1.65 | 6.19 | 11.95 | 3.86 | 8.95: 16.76, 8.9: 16.79 | yes | 2.4 / 3.0 | 3.8 | 0.75: 6.38 (edge) |
| average | T05 | 8.4 | 13.08 | 3.79 | 8.39 | 13.08 | 12.73 | 8.11 | 12.99 | 4.91 | 1.77 | 8.45: 13.09, 8.5: 13.10 | no | 1.9 / 2.4 | 0.0 | 8.5: 12.86 |
| good | P05 | 0.75 | 15.29 | 9.51 | 1.24 | 15.29 | 2.99 | 2.27 | 8.51 | 4.51 | 2.21 | 0.8: 15.41, 0.85: 15.53 | yes | 1.1 / 0.9 | 5.7 | 9: 7.77 (edge) |
| good | P10 | 9 | 18.68 | 6.58 | 1.64 | 18.68 | 1.71 | 1.28 | 5.66 | 8.23 | 3.07 | 8.95: 18.74, 8.9: 18.80 | yes | 2.7 / 3.2 | 2.0 | 8: 7.22 |
| good | P25 | 9 | 17.17 | 5.47 | 1.73 | 17.17 | 2.38 | 1.40 | 5.92 | 10.92 | 3.79 | 8.95: 17.21, 8.9: 17.25 | yes | 2.6 / 3.1 | 2.6 | 1: 6.08 |
| good | P50 | 9 | 16.32 | 4.86 | 2.02 | 16.32 | 3.14 | 1.61 | 6.10 | 12.79 | 4.12 | 8.95: 16.36, 8.9: 16.39 | yes | 2.5 / 3.0 | 3.9 | 4.25: 6.68 |
| good | T05 | 8.4 | 12.62 | 4.72 | 8.56 | 12.62 | 12.49 | 7.77 | 12.61 | 4.82 | 1.77 | 8.45: 12.62, 8.5: 12.63 | no | 1.8 / 2.2 | 0.0 | 8.5: 12.60 |

How to read the check columns:

- **Mesh ×2 / ×4**: the largest per-band SWR change when the segment density (λ/40 and λ/400 limits) is doubled or
  quadrupled, at the best h. It is at most 3.2 %, so the mesh does not decide anything here.
- **Run toward −X**: the same check with the near-soil run turned to −X (away from the radiator, under nothing) instead
  of −Y. It moves per-band SWR by up to 11.9 %, so the run direction, which is not specified, matters about four times
  more than the mesh.
- **Best h without 30 m** is a secondary diagnostic only, not the objective: the worst SWR over the other seven
  frequencies.

The full coarse curves (worst SWR and every band at every h) are in `results.json` → `families.<soil>/<proxy>.coarse`.

## Findings

1. **30 m decides the objective.** At 10.125 MHz the 29 m wire is about one wavelength long and presents a high
   impedance (630–915 Ω resistive on the 50 Ω side at the optima). The 30 m SWR is 9.6–23.2 over the whole sweep and 12.6–18.7 at every
   optimum, and it is the worst band at every optimum. Minimising the worst SWR over the eight bands therefore means
   minimising the 30 m SWR, which no feed height brings near a usable match. RF.Guru already says 30 m may need a
   tuner.
2. **The optimum is not interior.** For every above-soil proxy on every soil, the best feed height lies on an edge of the
   searched range (0.75 m or 9 m). It flips between the two edges with the proxy height (P05 picks 0.75 m on all three
   soils; P25 and P50 pick 9 m; P10 picks either), and the worst SWR varies by only 3.5–6 over the whole range
   (for example 17.45–23.24 for P05 on poor soil). 9 m leaves 1 m of vertical, which is a flat top at 10 m rather than an inverted-L.
3. **The return-path proxy changes the antenna.** The truncated bound T05 has an interior optimum at 8.4 m (worst SWR
   12.6–13.6), but there 40, 20, 17 and 15 m all sit at 7.8–13.5, against 1.1–3.4 on 40, 20 and 17 m for the full-length
   proxies. Which proxy is closer to a buried run is exactly the unanswered question.
4. **Without 30 m** (diagnostic), the best h scatters from 0.75 to 9 m across proxies and soils, and lands on a search
   edge in three of the fifteen cases, so no robust feed height emerges there either.

Hence **no defensible literal buried optimum**: the answer depends on the proxy, sits on search boundaries, and is
dominated by a band that cannot be matched in any variant.

## Independent check of the proxies with nec2c (`nec2c-results.json`)

nec2c 1.3 (KJ7LNW/nec2c, git 55be1e0), the same proxy geometry, copper (LD 5), Sommerfeld ground (GN 2), uniform 0.2 m
and 0.1 m segments, 4:1 applied as Zant / 4. NEC-2 feeds the centre of the vertical radiator's first segment, half a
segment above the junction where Sommerwire feeds the node. This checks the solver on **above-soil** geometry only.

| Case | Worst SWR Sommerwire | Worst SWR nec2c (0.1 m) | Worst band in both | Largest per-band SWR difference |
|---|---|---|---|---|
| poor, h 0.75 m, P05 | 17.46 | 18.97 | 30 m | 16 % |
| poor, h 9 m, P25 | 17.71 | 19.68 | 30 m | 26 % (20 m: 2.75 vs 3.45) |
| poor, h 8.4 m, T05 | 13.64 | 14.65 | 30 m | 30 % (80 m: 3.51 vs 4.55) |
| average, h 0.75 m, P10 | 18.03 | 19.82 | 30 m | 15 % |

The two codes agree on what decides the result: 30 m is the worst band in every case, nec2c's worst SWR is 7–11 %
higher in all four cases, and the low-h P05 case ranks below the high-h P25 case in both. The per-band differences
(up to 16 % for the full-length proxies with a low feed, 26–30 % for the other two) are larger than for the
dipoles in [validation/nec2c](../nec2c), and partly reflect the different feed position at the junction. They are a
further reason not to quote any single proxy figure as a design value.

## Preset decision

The RF.Guru EFOC29 preset (flat top at 8 m) now also calculates 30 m (10.125 MHz) by default; its modelled SWR there is
17.50 (+0.5 % at doubled segment density). **No 10 m mast preset was added**: a preset needs one feed height, and the
study gives none that can be defended for a buried return. Shipping a proxy would present one assumed route as the buried
installation. Anyone who wants the proxy can build it from `geometry()` in `study.js` and must label it as an above-soil
proxy.

## Not modelled

The buried run itself; the mast (assumed non-conductive); XLPE insulation; transformer loss and parasitics; the choke's
finite impedance, the station-side coax and the second choke; soil layering and moisture; sag; nearby objects; the fold-back
tuning surplus that RF.Guru supplies.
