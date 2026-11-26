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

nec2c refuses long file paths, so the scripts run it inside `decks/` with short file names. The scripts overwrite the files in `decks/` when run.
