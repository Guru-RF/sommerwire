# Sommerwire vs nec2c (NEC-2)

> nec2c itself is third-party software under the GPL-3.0 and is not included in this repository. Build it into
> `bin/` (instructions below); the decks, outputs and scripts in this folder are part of Sommerwire (Unlicense).

Comparison of Sommerwire's Sommerfeld ground with nec2c, the C translation of the public-domain NEC-2.
Summary of the results: Help tab → "How it was checked" → "Comparison with NEC-2".

- `decks/` – the NEC input files (`*.nec`), nec2c output (`*.out`) and `results.json` (both programs, every case).
  - `c0d1` … `c10d2`: case 0–10 of `necmp.js`, `d1` normal and `d2` double segmentation.
  - `dx.*`: DX Commander with 16 radials; `b.*`: power-balance run over perfect ground (last case run).
- `scripts/` – Node scripts that write the decks, run nec2c and Sommerwire on the same geometry, and print both.
  - `necmp.js`: dipoles at 0.3–10 m, low vertical dipole, λ/4 vertical with 16 radials at 5 cm, 0.3 m and 2 m.
  - `necdx.js`: DX Commander (models/DX Commander 16 radials.maa) on real ground, uniform segments.
  - `necdx2.js`: the same in free space, over perfect ground and over real ground.
  - `necbal.js`: power balance over perfect ground (integrated gain / 4π must be 1 for lossless wires).

- `bin/` – not in the repository: put a nec2c binary here as `bin/nec2c` (the scripts look for it there).

Run from anywhere with Node.js; the scripts use `bin/nec2c` unless `NEC2C` points at another binary:

    node validation/nec2c/scripts/necmp.js
    NEC2C=/path/to/other/nec2c node validation/nec2c/scripts/necmp.js

To build it from https://github.com/KJ7LNW/nec2c (GPL-3.0, version 1.3), in the unpacked source folder:

    clang -O2 -w -DPACKAGE_STRING='"nec2c"' -o nec2c calculations.c fields.c geometry.c ground.c input.c main.c matrix.c misc.c network.c radiation.c somnec.c shared.c -lm

Each invocation prints its new directory under `runs/`. Set `NEC2C_RUNS` to choose a different parent. The scripts launch nec2c in the run directory with short case-specific deck and output names. The versioned `decks/` contain historical evidence.

For the impedance comparisons, both solvers now use lossless conductors and sample elevations 0° through 90° inclusive in the azimuth 0° cut. The archived comparisons sampled NEC elevations 1° through 90° and Sommerwire elevations 0° through 89°. The ordinary archived DX impedance comparison used copper in Sommerwire and lossless wires in NEC. The archived balance comparison used lossless conductors in both.

The dipole center feeds use odd NEC and even Sommerwire segment counts. Two mesh densities measure sensitivity. Neither the mesh comparison nor a peak on one cut establishes full-pattern or current accuracy.

For the lossless PEC balance test, both solvers now use the same 2° polar and 5° azimuth grid and trapezoidal polar weights. Integrating the retained 14.175 MHz DX NEC output yields approximately 0.782 of accepted power. Unity is the physical expectation subject to quadrature and solver error. This discrepancy does not identify dissipation at the hub or validate either current distribution.

A fresh comparison on upstream base `b4ac07b` used nec2c 1.3 built from `KJ7LNW/nec2c` revision `55be1e0` with the command above. At 14.175 MHz over average soil, with a 0.1 m target segment length, the lossless DX case gave 50.7 + j10.2 Ω and −1.06 dBi in nec2c, versus 31.5 − j9.9 Ω and −0.03 dBi in Sommerwire. These are azimuth 0° cut peaks. NEC excites the single segment on wire 19, while Sommerwire places the source at its beginning node. The PEC DX balance run at the same frequency gave 0.782 and 1.000 respectively.

The DX scripts assume the supplied model geometry and feed. Recheck the input mapping if the model gains loads, insulation, transmission lines or a feed transformer. Capture stdout to retain the Sommerwire side of the DX and balance comparisons alongside the generated NEC files.
