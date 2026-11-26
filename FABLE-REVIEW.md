# Independent review of RADIAL-STUDY.md

Reviewed 2026-11-26 at revision `776e959`, against `RADIAL-STUDY.md` (sha256 `c9746676…`) and `radial-scratch/`.

## Verdict

**The study's main recommendations stand, but three of its numerical statements do not, and its clearance section supports less than it says.**

- **Sources:** every Severns figure the study quotes matches the papers. What it leaves out is several measurement limits the author states himself, and three measured data sets that bear directly on a 16-radial vertical.
- **DX Commander:** the 16 wires, 5 m length and 5 cm height are confined to example decks and one regression case. Nothing in the solver depends on them. They do set the edge of what has been validated.
- **Reproduction:** both scratch scripts reproduce byte-identically. The elevated comparison with Part 3 is better than the study reports once the mesh is converged, but it tests the wire solution, not the ground loss.
- **Radial/ground:** the study's own doubt about "raise it a few centimetres" is confirmed and can be stated more strongly. Against Severns's measured surface series the stand-in misses most of the effect of radial count.
- **Clearance:** the single "pass" at 40 m is a sampling coincidence, and the "passes everywhere" result for the horizontal wire is a symmetry null. No distance in that table should be quoted.

## What I checked, and what I could not

| Check | Status |
|---|---|
| Nine Severns PDFs, fetched from the author's site and read in full | Done. Text extracted with `pdftotext`; three figures read by eye from rendered pages. |
| `probe.js` and `dx.js` rerun on Node v26.12.0 and diffed | Identical to `results.csv` and `dx-final.csv`. |
| Solver code paths for ground contact and buried wires | Read `engine.js:348–384` and `693–734`; confirmed by running. |
| My own probes | Scripts and outputs are in `fable-scratch/` (untracked). Run as `node fable-scratch/<script>.js "$PWD" <section>`. |
| nec2c rerun | **Not done.** No `nec2c` binary on this machine or in `validation/nec2c/bin/`. I used the archived `decks/results.json` only. |
| NEC-4 or NEC-5 | **No access.** The only NEC-4 numbers here are the ones Severns printed. |
| Weber's 1997 radial-current paper (source of Elevated II Fig. 38) | **Not accessed.** Only Severns's summary was read. |
| The app's user interface | **Not driven.** All solver observations are at the `MM.solve` level. |
| Herdr handoff described in the study | Not used and not retried. The study's last section is now out of date. |

I did not modify product code, commit, or publish. The only files added are this one and `fable-scratch/`.

## 1. Severns sources

All quoted values check out: page ranges, antennas, wire gauges, frequencies, soil values, the Part 3 impedance table, the Part 7 sector losses, the Part 6 0.4–1.0 dB range, and the note that Elevated I Fig. 6 is a surface measurement.

The corrections are omissions.

**Measurement limits the study should carry**

- **Part 1.** The ±0.05 dB figure is short-term repeatability. Severns's own estimate for the A-B comparisons is "probably within a few tenths of a dB". He also says the receiver at about 2.25 λ is "in the far field but not by much" and that the groundwave was still significant. The feed choke was above 3 kΩ at 7.2 MHz.
- **Part 2.** The four-radial run was made in a week of heavy rain, and the later runs eight days on after the soil had dried. Severns calls a four-radial system "really flaky", sensitive to layout, moisture and feedline placement.
- **Part 4.** The zero-radial reference is a 4 ft stake plus Heliax buried 6 inches, which acts as one random radial. The receive point was 1.8 λ away, not the 2.25 λ of Part 1.
- **Part 5.** Power was set with Bird 43 wattmeters, which Part 1 names as the limiting factor of that method. The receive antenna was a 10 ft wire by the house about 700 ft away, with trees inside 50 ft. The 16-radial point was anomalous in all three runs. Severns changed site, frequency and method because of this experiment. Treat it as qualitative.
- **Part 6.** Measured in midsummer on dried soil. Severns says the numbers "must not be taken as absolutes".
- **Part 7.** The left and right sectors should be identical. They differ by 0.12 dB at 7.2 MHz and 0.32 dB at 28.5 MHz, which is a direct empirical floor for single differences.
- **Elevated II, Fig. 38.** These are Weber's measurements on his own 80 m antenna, republished. They are third-party data, not from the N6LF range.

**Measured data the study does not use**

| Source | Configuration | Measured |
|---|---|---|
| Part 2, Table 4 | 16 surface radials, 33 ft / 21 ft, SteppIR re-resonated | 40.5 Ω / 42.8 Ω; +3.76 / +3.95 dB over four 33 ft radials |
| Part 3, Table 1 | 16 surface radials, 33 ft, fixed 33.5 ft tube | 56.1 + j6.2 Ω |
| Part 6, Tables 3 and 5 (C5) | 16 surface radials, 33 ft, four bands | 43.5 / 51.2 / 48.9 / 51.6 Ω; +0.4 / +0.5 / +0.2 / −0.5 dB against four radials per band |
| Part 4, Fig. 2 (read by eye) | λ/4 vertical, 16 → 64 radials | about +0.4 dB (the text gives 0.9 dB for 8 → 64) |

Three measurements of 16 × 33 ft surface radials on one site give 40.5, 43.5 and 56.1 Ω. That spread is the best argument for the study's first priority.

**Statements by Severns that cut both ways**

- Part 4 says outright that ground loss is not the feed resistance minus 36 Ω and "should not be assumed". This backs the study against the count-to-ohms schedule in help more directly than the study's own reasoning does.
- Part 4 also concludes that efficiency is "pretty much the same whether buried or on the surface". This is an assertion, with no buried trial in the series. The study is right that no burial correction is established, but it should quote the sentence, because it is the nearest thing to support for the help text.
- Part 2 warns that NEC with wires millimetres above ground changes substantially for a 1 mm height change, and that he tuned his model to fit. This applies to any few-centimetre stand-in.
- Elevated I says NEC-2-based programs "do not properly model the ground-antenna interaction" for verticals close to ground. Sommerwire's only ground validation is against NEC-2.

## 2. DX Commander assumptions

**Confined to data, as the study says.** `engine.js`, `hexgen.js` and `structgen.js` contain no match for "radial" or "commander". The 16 × 5 m × 5 cm numbers appear only in:

- the two example decks (`index.html:647–648`, `models/DX Commander 16 radials.maa`);
- the regression case `gp(0.05)` in `validation/nec2c/scripts/necmp.js`, which uses 1 mm wires, not the deck's 0.8 mm.

Three things the study should add:

- **The validation envelope is DX-shaped.** The only radial-over-real-ground check is 16 × 5 m at 5 cm, 0.3 m and 2 m, soil 13/0.005, 7.1 MHz, against NEC-2. The claim at `index.html:302` that wires a few centimetres up "come out right" rests on that one geometry and some low dipoles.
- **The ground-fed example has no earth loss.** It touches z = 0, has no load, and so runs entirely on the perfect-mirror fallback: 40.89 + j10.38 Ω at 7.15 MHz with the warning shown. The study describes the deck but not this.
- **The 20 m numbers in the study are mesh artefacts.** See section 3.

## 3. Reproduction and my probes

All results below are **model predictions** from the checked-in engine unless a column says measured.

### DX deck: the 14.175 MHz values are not converged

| Segments per 5 m | 7.1 MHz | 14.175 MHz |
|---|---:|---:|
| 8 | 44.83 − j31.74 | 12.01 − j80.13 |
| 16 | 45.49 − j27.93 | 23.36 − j37.80 |
| 32 (study's value) | 46.05 − j25.84 | 31.03 − j18.47 |
| 64 | 46.35 − j24.74 | 36.32 − j6.93 |
| Deck as shipped (auto mesh) | 46.65 − j23.21 | 41.73 + j5.90 |

The study reports the 7.1 MHz reactance drift but quotes 31.03 − j18.47 Ω at 14.175 MHz without comment. Resistance there triples across the meshes the script itself ran. The feed is on a steep fan resonance, about 0.2 Ω of reactance per kHz, so a shift in resonance of under 1% moves it this far. The eight-versus-sixteen difference at 20 m (about 0.5 Ω) probably survives; the absolute values do not.

### Part 3 elevated comparison: better than stated, and less informative

Soil 30/0.015, bare lossless wire, as in the study.

| Height | Measured | 32 seg | 64 seg | 256 seg | Extrapolated X |
|---|---:|---:|---:|---:|---:|
| 6 in | 43 + j6.4 | 40.28 + j3.97 | 40.43 + j6.55 | 40.62 + j8.43 | about +9.1 |
| 12 in | 40.6 + j0.08 | 38.90 − j3.72 | 39.04 − j1.11 | 39.20 + j0.78 | about +1.4 |
| 48 in | 34.8 − j9.7 | 34.38 − j15.94 | 34.49 − j13.28 | 34.61 − j11.38 | about −10.8 |

- Reactance converges at first order, halving the error per doubling. The study's "remaining difference of −3.58 Ω at 48 inches" is mesh error; the converged difference is about −1.1 Ω.
- The near-exact match at 6 inches and 64 segments is a coincidence. Converged, the model is about 2.7 Ω high in X and 2.4 Ω low in R.
- **The agreement does not test the ground model.** At 48 inches, 6 inches of radiator length moves the result by 1.6 Ω and 8 Ω. Changing soil from 13/0.005 to 30/0.02 moves it by 1.7 Ω in each part. Unmodelled insulation, base plate and leads are the same size as the residual.

**Transmission can be compared, contrary to the study.** Differences between heights at 8° are the same observable as Severns's normalised |S21|, subject to his finite-range caveat.

| Step | Measured, Part 3 Fig. 2 (read by eye, ±0.1 dB) | Model, gain at 8° |
|---|---:|---:|
| 6 in → 12 in | about +0.25 dB | +0.13 dB |
| 6 in → 48 in | about +0.9 dB | +0.52 dB |
| surface → 6 in | about +5.0 dB | not modelled (see below) |

The model gets the sign and a little over half the size. The shortfall of 0.1–0.4 dB is within Severns's "few tenths".

### Is a wire a few centimetres up a stand-in for a surface radial?

Part 3's surface count series against the same antenna modelled at 5 mm and 5 cm. Gain is relative to four radials.

| Radials | Measured Z (Ω) | Measured gain | Model at 5 mm | Model at 5 cm |
|---|---:|---:|---:|---:|
| 4 | 137 + j14.9 | 0 dB | 56.2 + j75.3, 0 dB | 42.0 + j18.6, 0 dB |
| 8 | 85.5 + j8.0 | | 41.9 + j34.0, +1.23 | 38.4 + j7.4, +0.37 |
| 16 | 56.1 + j6.2 | | 38.4 + j16.3, +1.60 | 37.8 + j3.6, +0.42 |
| 32 | 42.9 + j2.1 | | 38.1 + j11.6, +1.67 | 37.6 + j2.4, +0.41 |
| 64 | 39.7 − j1.2 | +5.8 dB | 37.4 + j8.0, +1.73 | 37.3 + j2.5, +0.42 |

- At 5 cm the model shows 0.42 dB from 4 to 64 radials against 5.8 dB measured, and nothing at all from 16 to 64 against roughly 0.4 dB measured.
- For 16 radials, the case the examples use, the model's 38 Ω sits below all three measured values (40.5, 43.5, 56.1 Ω).
- The study says the 137 Ω surface measurement "supplies no accuracy score for the 5 cm case". I disagree. It is the most relevant measurement available, and it shows that the stand-in fails for sparse radials and understates the benefit of adding more.
- Caveats: model reactances here are not mesh-converged, and Severns's wires were insulated and lying in grass at an unknown effective height.

### Sommerwire against Severns's published NEC-4 model at 5 mm

Part 2, Tables 9 and 10: four #12 radials 5 mm above 0.01/14 soil, 7.2 MHz, 0.1 m segments. This is a code-to-code check the study did not use.

| Radial length | NEC-4 (Severns) | Sommerwire |
|---|---:|---:|
| 10.0 m | 83.15 + j0.03 Ω, −4.41 dBi | 57.1 − j24.1 Ω, −2.79 dBi |
| 8.84 m | 54.59 + j0.00 Ω, −2.12 dBi | 43.0 − j15.8 Ω, −1.10 dBi |
| 6.4 m | 49.91 − j0.02 Ω, −0.70 dBi | 48.9 + j1.2 Ω, −0.61 dBi |

The codes agree for short radials and part by 26 Ω and 1.6 dB for the lossy quarter-wave case. Sommerwire's resistance for the 10 m row runs 71, 111, 99, 58, 45, 38 Ω at heights of 1, 2, 3, 5, 7 and 10 mm, so no height reproduces NEC-4. I cannot say which code is right: Severns tuned his model, the wire loss setting is not given, and I have no NEC-4. It is an **open discrepancy in a regime the product describes as handled**.

### Ground contact and buried wires

The study's description of the switch is correct, and stronger in practice than it reads.

| Case (four radials at 48 in, soil 13/0.005) | Z (Ω) | Gain at 8° |
|---|---:|---:|
| Isolated | 33.01 − j17.51 | −3.40 dBi |
| Plus a detached 2 m rod touching z = 0, at 50, 200 or 1000 m | 35.04 − j13.09 | −3.58 dBi |
| Same rod 1 cm above ground | 33.01 − j17.51 | −3.40 dBi |
| Perfect mirror selected explicitly | 35.04 − j13.09 | −3.58 dBi |

- A grounded rod a kilometre away changes the answer by 4.9 Ω, exactly as the explicit mirror does. The warning is issued.
- Here the fallback gives **higher** resistance and **lower** gain. Help lines 197–203 describe the fallback, for touching radials, as too little resistance and too much gain. The direction depends on the geometry, which supports removing the categorical statement.
- **New: radials at z = 0 do not solve.** With four or sixteen radials at z = 0, `MM.solve` throws "Singular matrix — check that wires connect properly". Help says such radials "behave like a perfect ground screen". The engine does not produce that result, at least through this entry point.
- A fan placed at −0.1 m returns 38.29 + j10.48 Ω with only per-wire warnings. A detached buried wire leaves the answer unchanged. Both confirm that finite numbers after the warning mean nothing.

### Nearby objects

The study's table values reproduce. Its interpretation does not hold up.

**The 40 m "pass" is aliasing.** The change toward −x oscillates with gap at a period of about λ/2 (21 m). The study sampled at 20, 40 and 80 m. A 4 m sweep of the same long vertical:

| Gap (m) | ΔZ (Ω) | Worst of the two bearings (dB) | Worst over all azimuths at 8° (dB) |
|---|---:|---:|---:|
| 34 | 1.36 | 1.74 | 2.28 |
| 38 | 1.14 | 1.45 | 1.98 |
| 40 (study) | 1.05 | 0.40 | 1.89 |
| 46 | 0.83 | 1.38 | 1.83 |
| 62 | 0.47 | 0.38 | 1.24 |
| 90 | 0.20 | 0.64 | 0.86 |
| 130 | 0.08 | 0.48 | 0.51 |

- At 40 m the pass disappears if the object is 0.47 λ or 0.49 λ long instead of 0.48 λ (0.82 and 0.95 dB), or if the frequency is 7.0 MHz instead of 7.2 MHz (1.47 dB).
- Two bearings understate the change by up to a factor of five. Over all azimuths, a resonant vertical needs about 130 m (3 λ) to fall to 0.5 dB.
- ΔZ decays smoothly and is the only well-behaved column.

**The horizontal wire result is a symmetry null.** A wire along y centred on the x axis cannot be driven in its half-wave mode by this antenna. Moving it shows real, if modest, coupling:

| Half-wave wire at 1.2 m height, 0.5 m gap | ΔZ (Ω) | All-azimuth change (dB) |
|---|---:|---:|
| Along y, centred (study) | 0.07 | 0.01 |
| Along y, one end opposite the tip | 0.61 | 0.26 |
| Parallel beside a radial | 2.25 | 0.62 |
| Sloping up at 45° from beyond the tip | 4.17 | 2.94 |

The parallel wire fails the study's own criterion at 0.5 m and 2 m. The sloping wire still fails at 20 m.

**What the section supports.** A resonant, lossless, floating vertical conductor is a strong scatterer out to several wavelengths, and a short rod is not. Nothing else. Real fences, towers and downpipes are earthed, and an earthed object forces the mirror fallback, so the solver cannot model them at all. That is the binding limit, and the study should lead with it.

## 4. What kind of evidence each claim is

| Claim | Kind |
|---|---|
| Four radials at 48 in ≈ 64 on the surface (+5.9 against +5.8 dB) | Measured: one site, good soil, 7.2 MHz, three runs |
| Surface to 6 in gains about 5 dB with four radials | Measured, read from Fig. 2 |
| Shortening four surface radials from 33 ft to about 23 ft gains about 2.8 dB | Measured, wet soil |
| A 180° fan costs 0.4–1.9 dB at 7.2 MHz depending on bearing | Measured |
| Feed impedance of four elevated radials at 6–48 in | Measured, and modelled within about 1–3 Ω; weak test of ground loss |
| Gain change with height for elevated radials | Model gives sign and roughly half the measured size |
| Radial count effect near the surface | Model at 5 mm to 5 cm contradicts measurement |
| NEC-2 agreement for 16 × 5 m at 5 cm | Code-to-code, archived, not rerun |
| NEC-4 agreement at 5 mm | Code-to-code, disagrees for quarter-wave radials |
| Clearance distances | Model only, aliased, one frequency, no measurement |
| Buried radials, burial depth, insulation, soil layering | Unsupported by measurement and by solver |
| Earthed nearby objects, ground rods, unchoked coax shields | Unsupported by solver |
| Ohms of ground loss from radial count | Unsupported; Severns says not derivable from feed resistance |
| Which code is right at the DX hub | Unsupported; needs a third reference |

## 5. Prioritized corrections

**For RADIAL-STUDY.md**

1. **Withdraw the clearance pass/fail conclusions.** Replace the table's reading with the fine sweep, an all-azimuth metric, and length and frequency sensitivity. Drop the horizontal-wire result or relabel it as a symmetry null. State first that earthed objects cannot be modelled.
2. **Fix the DX 14.175 MHz numbers.** Either quote the deck as shipped (41.73 + j5.90 Ω) with the mesh series, or remove them.
3. **Rewrite the elevated comparison.** Give the converged values, remove the "−3.58 Ω" residual, add the length and soil sensitivities, and say the comparison does not test ground loss. Add the gain-versus-height comparison with Fig. 2.
4. **Add the surface count series and take a position.** The 5 cm stand-in contradicts measurement for sparse radials and understates the count effect for dense ones. "Supplies no accuracy score" should go.
5. **Add the omitted measurement limits and the three 16-radial data sets** from section 1, including Severns's "few tenths of a dB" and his surface-equals-buried assertion.
6. **Record the NEC-4 discrepancy at 5 mm** as an open validation gap.
7. **Note that the ground-fed DX example has zero earth loss**, and replace the stale "review status" section.

**For product text, to be decided by the maintainer; I changed nothing**

1. **`help.html:197–203`.** The description of radials at z = 0 does not match the engine, which throws a singular-matrix error in my probe. Verify in the UI before rewording. The direction of the fallback error is not fixed and should not be stated as such.
2. **`help.html:293` and `index.html:302`.** "Usually a close stand-in" and "come out right" are not supported for radials near the surface. Limit the claim to what was checked: NEC-2 agreement at 5 cm and above for one geometry.
3. **Count-to-ohms schedule.** The study wants it removed. Severns's data does not contradict the 5–15 Ω range for 16–32 radials, since the three measurements imply roughly 4–20 Ω over 36 Ω, but it cannot be derived from them either. Requalifying it with the measured spread is as defensible as removal.
4. **Mirror fallback visibility.** I agree with the study's second priority. One distant earthed wire silently changes the whole model's physics; the warning names wires but not the consequence for the antenna.

## 6. Still open

- Rerun the nec2c cases, including the Part 3 geometry and the 5 mm case, once a binary is available.
- A NEC-4 or NEC-5 run of Severns's Table 9 model with stated wire loss, to settle the 5 mm discrepancy.
- A convergence study of reactance for wires below 5 cm; first-order convergence suggests the junction or source treatment, not the ground integrals.
- Whether `MM.parseMAA` output is meant to be passed straight to `MM.solve`. It returned strings and gave NaN until converted, as the study also found.
