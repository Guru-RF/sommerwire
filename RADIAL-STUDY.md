# What Sommerwire can infer about an HF vertical's radials

**Keep both named DX Commander examples and the simpler 16-radial benchmark.** At revision `776e959`, the 16 wires, 5 m length and 5 cm height describe particular input decks. The actionable problem is in the interpretation of the results, especially the suggestion that raising a wire a few centimetres approximates burial. A second problem is using radial count alone to assign a loss resistance. Neither rule follows from the measurements.

## Source and history

| Where | Evidence and consequence |
|---|---|
| Initial import `2019b92` | Already contains both examples in `sommerwire/index.html`, the 35-wire MAA file and the NEC comparison scripts. The Git record establishes inclusion, but does not establish who measured the geometry or whether an installation had those dimensions. |
| Current `index.html:647–648` and `models/DX Commander 16 radials.maa` | First example has 19 wires and a ground return. The second raises the element hub to 0.11 m and connects it via source wire 19 to a radial hub at 0.05 m. Wires 20–35 form a 22.5° fan, radius 5 m, wire radius 0.8 mm. Nominal file frequency 7.150 MHz. The original ground-fed example's tiny hub mismatch described in help should not be silently introduced into the raised deck. |
| `e6d6a0b`, `77aee4a` | Serving from the root moved the application. The later DX change moved the menu entry to multi-band HF by editing the band classifier. Neither change sets radial design policy. |
| `validation/nec2c/scripts/necmp.js:39–41` | Generates a simple quarter-wave radiator for regression. It shares radial dimensions with the example but has no multi-element hub. README line 84 reports nec2c 44.9 − j35.9 Ω versus Sommerwire 44.2 − j38.5 Ω and peak gains −1.21 versus −1.18 dBi at 7.1 MHz. These are archived code-to-code results. |
| `necdx.js`, `necdx2.js`, `necbal.js` in the same directory | Independently identifiable full-hub benchmarks. Help line 272 reports 10–16 Ω disagreement in resistance persisting without soil. Lossless perfect-ground integrated power ratios of 1.000 versus 0.81/0.78 implicate numerical treatment of the crowded hub. Conservation is a necessary check and cannot determine the physical feed impedance by itself. Keep the discrepancy visible. |
| `engine.js`, `hexgen.js`, `structgen.js`, example declarations | Solver meshes supplied wires. Generators create hexbeam or structure geometry. Other example fans have different counts, lengths, slopes and elevations. No DX-specific solver branch, general radial generator imposing this fan, or universal clearance setting was located. |
| `674bc09` | Added the buried-radial warning, including the resistance heuristics. Retain the physical limitation and revise the advice below. |

Reproduce the history with `git show 2019b92:sommerwire/index.html | rg 'DX Commander'`, `git log --follow -- 'models/DX Commander 16 radials.maa'`, `git show 674bc09 -- help.html`, `git show 77aee4a`, and `rg -in 'radial|commander' engine.js hexgen.js structgen.js index.html validation/nec2c/scripts`.

## Measured evidence and its reference plane

All nine papers below were available through the author's archive. The papers provide plotted curves and selected tables. Original VNA traces, complete soil profiles and run-by-run uncertainty budgets were unavailable in the material examined. Soil values from another run are proxies. None of these comparisons establishes a burial depth correction.

- **Part 1, pp. 21–25, Figs. 2, 7–12.** A VNA drove the vertical and measured transmission back through a receiving loop just over 300 ft away on a 40 ft mast, about 8° elevation at 7.2 MHz. Feed impedance was calibrated open/short/load at the antenna before and after each run. A terminated feed checked stray coupling. Short-term transmission repeatability approached ±0.05 dB over 2–3 thermally stable hours. This is a directional link measurement with a finite-distance receiver. Repeatability supplies no absolute efficiency calibration. [Experimental setup](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Jan-Feb%202009%20ground%20systems%20part%201.pdf)
- **Part 2, pp. 48–50, Figs. 1–4.** A 34 ft telescoping vertical, about 1 inch mean diameter, fed against four equal insulated #18 wires lying on soil at 7.2 MHz. Feed choked and base isolated in the first experiment. Trimming from 33 toward 23 ft improved transmission by about 2.8 dB relative to 33 ft. Tests continued to 18 ft. Probe-derived site average εr ≈ 30, σ ≈ 0.015 S/m. The eight-wire and retuned-vertical runs have different controls. Fig. 2's current maximum along the wire explains why a free-space quarter wavelength can be electrically long on soil. [Sparse surface screens](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Jan-Feb%202009%20Ground%20systems%20part-2.pdf)
- **Part 3, pp. 29–30, Figs. 1–3, Tables 1–2.** A 33.5 ft tubular vertical, 7.2 MHz, 33 ft insulated #18 radials, isolated base and choked feed. Surface count fell from 64 to 32, 16, 8 and 4. Then the base and four radials rose together to 6, 12 and 48 inches. Three runs on different days. Relative to four on the surface, 64 surface gave +5.8 dB and four at 48 inches +5.9 dB. Fig. 3 is a **calculation**. The measured normalized currents at 48 inches ranged from 0.235 to 0.271 per ampere total. Fig. 4 specifies 0.015 S/m and εr 30 for its model. Segment two used different lengths and its own reference in Table 4. [Surface versus elevated](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Mar-Apr%202009%20Ground%20systems%20part-3.pdf)
- **Part 4, pp. 39–40, Figs. 2–4.** At 7.2 MHz the author compared several radiator designs, re-resonating the adjustable antennas as counts changed. Added 0/4/8/16/32/64 surface wires of 33 ft, #18. The reference for each radiator was its stake-only case. Site average εr 30, σ 0.020 S/m. Directional transmission and resonant input resistance respond differently. Fig. 4 varies soil by calculation. This experiment cannot define a table of ground-loss ohms from radial count. [Multiple radiator designs](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20May-Jun%202009%20Ground%20systems%20part-4.pdf)
- **Part 5, pp. 15–17, Fig. 2 and Table 1.** A 125 ft wire vertical on a narrow ridge, 1.8–2.0 MHz, 4 through 64 insulated 130 ft #12 wires on the surface, some descending the slopes. Shield and two 4 ft stakes bonded to an 18 inch disk. The buried conductors in this description are the stakes. Received amplitude was corrected for mismatch at 50 W forward power. Analyzer resolution about ±0.1 dB, stated base impedance accuracy better than 1%. This terrain and receiving setup differ from Part 1. [160 m ridge experiment](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Jul-Aug%202009%20Ground%20systems%20part-5.pdf)
- **Part 6, pp. 19–22, Tables 1–3, 7 and 9.** Adjustable SteppIR, 7.2/14.2/21.2/28.5 MHz, insulated stranded #18 lengths 33/16.8/11.3/8.4 ft respectively. Surface C2 combined four per band. Against that reference, 32 surface wires all 33 ft long (C4) improved transmission by 0.4–1.0 dB depending on band. The elevated experiment used a base at 6 ft and a distinct set of comparisons. Feed and control cable chokes appear in Fig. 4A. Multiband return currents depend on which wires coexist. [Multiband tests](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Nov-Dec%202009%20ground%20systems%20part-6.pdf)
- **Part 7, pp. 18–19, Figs. 1–2, Tables 1–2.** Reference fan of 32 × 33 ft around 360°. At 7.2 MHz the 180° fan pointed toward the receiver gave −0.42 dB, away −1.91 dB, left/right −0.82/−0.94 dB. At 28.5 MHz the away case gave −3.23 dB. Azimuth and electrical length matter even when the measured quantity and site stay fixed. [Missing sectors](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Jan-Feb%202010%20Ground%20systems%20part%207.pdf)
- **Elevated systems I, p. 34, Figs. 4–6.** The measured current profile in Fig. 6 actually concerns four 33 ft wires on the surface at 7.2 MHz. The surrounding design study uses NEC4D, generally lossless #12 and spot frequencies of 3.65 or 7.2 MHz. A curve appearing in this article does not by itself constitute an elevated measurement. [Elevated systems I](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20Mar-Apr%202012%20Elevated%20Gnd%20systems%20part%201.pdf)
- **Elevated systems II, pp. 27, 30–31, Figs. 38–42.** Fig. 38 gives radial current division at K5IU at 3.528 and 3.816 MHz on four elevated radials. Fig. 40 instead calculates pattern changes at 7.2 MHz, 8 ft elevation and 22° takeoff. Figs. 41–42 perturb the lengths of opposing pairs. The discussion of an unchoked descending shield explains an additional return path. No object separation threshold follows from those figures. [Elevated systems II](https://www.antennasbyn6lf.com/ARRL_articles/QEX%20May-Jun%202012%20Elevated%20Gnd%20Systems%20part%202.pdf)

## Solver boundaries

Positive-height wires in air can couple to the flat homogeneous half-space. The default real-ground branch in `engine.js:712` uses Sommerfeld terms when the near-field option is omitted. Wire mesh, finite radius, junctions, material, insulation and soil representation still limit accuracy. An insulated wire laid in grass spans air, dielectric and soil at variable separation. Assigning its centreline a uniform 0.05 m changes the experiment.

With ground enabled, the node test is |z| < 0.0001 m after the model height offset. A contact node anywhere can switch the **entire impedance solution** to a perfect image while the pattern still uses real-ground reflection (`engine.js:366–384, 712–734`). A detached downpipe ending on earth can therefore change the solution method for the antenna itself. A matched structural test needs an additional control computed with the same mirror treatment. Underground endpoints below −0.0001 m trigger a warning. The solver has no transmitted-field soil-wire kernel or insulation/soil contact calculation. A finite number printed after a warning has no validated buried-wire interpretation.

An ideal gap and radial wires omit the shield exterior. A differential transmission-line network represents port-to-port behavior. To investigate common mode, add an exterior conductor with the physical route, terminations and measured complex choke impedance versus frequency at its installed location. If it touches earth the contact limitation returns. A single series resistor can explore loss sensitivity given an independently estimated value. It cannot reconstruct spatial current division, re-radiation or the installed pattern.

## Reproducible numerical evidence

Node v26.12.0, repository root, no dependencies. Both scripts call the checked-in engine. All usable outputs are in metres, MHz, S/m, ohms and dBi. Reproduce into temporary files and compare:

```sh
node radial-scratch/probe.js > /tmp/radial-probe.csv
diff radial-scratch/results.csv /tmp/radial-probe.csv
node radial-scratch/dx.js > /tmp/radial-dx.csv
diff radial-scratch/dx-final.csv /tmp/radial-dx.csv
```

The initial scratch DX invocation passed MAA strings into the numeric solver and produced NaNs (`radial-scratch/dx.csv`, discarded). The corrected script converts coordinates and radii before solving. Use `dx-final.csv` for conclusions.

**Full named deck.** Remove alternate radials for a symmetric eight-wire control, preserving source, hub and radiator geometry. Both models use the file's copper setting. At 7.1 MHz, εr 13, σ 0.005, 32 segments per radial, eight gave 46.52 − j45.13 Ω and sixteen 46.05 − j25.84 Ω. At 14.175 MHz the respective values were 31.57 − j18.04 and 31.03 − j18.47 Ω. At 7.1 MHz the sixteen-wire X changed from −31.74 to −27.93 to −25.84 Ω at 8/16/32 segments. Changing the soil to 30/0.020 shifted the finest sixteen-wire X to −19.52 Ω. A change in input resistance does not uniquely measure earth loss.

**Elevated measured comparison.** Part 3 segment one inspired a 33.5 ft vertical and four 33 ft horizontal wires. Assumptions are lossless bare wire, 1 inch radiator diameter, 1.024 mm radial diameter, perfectly symmetric fan, no coax, point feed at radiator base, homogeneous soil 30/0.015. The paper used insulated wires and tubing. Below, R + jX in Ω is the same observable in both columns. No impedance uncertainty for individual Part 3 entries was established here.

| Height | Part 3 Table 1 | Sommerwire, 32 segments per wire | Sommerwire, 64 |
|---|---:|---:|---:|
| 6 in | 43 + j6.4 | 40.28 + j3.97 | 40.43 + j6.55 |
| 12 in | 40.6 + j0.08 | 38.90 − j3.72 | 39.04 − j1.11 |
| 48 in | 34.8 − j9.7 | 34.38 − j15.94 | 34.49 − j13.28 |

The decline in R and X is reproduced across these three heights. The finest mesh still shifts X by about 2.6 Ω. At 48 inches the remaining X difference is −3.58 Ω. Precision below a few ohms would need further mesh and physical feed studies. At 5 cm and 32 segments, changing soil from 5/0.001 through 13/0.005 to 30/0.020 changes R from 37.03 to 40.45 to 42.40 Ω and X from +4.71 to +15.15 to +18.76 Ω. The Part 3 four-wire surface measurement was 137 + j14.9 Ω. It is a different boundary condition and supplies no accuracy score for the 5 cm case. No direct comparison of far-field dBi with measured link S21 was made.

## Spacing from a nearby conductor

The screening criterion chosen for this study is |ΔZ| ≤ 2 Ω **and** maximum absolute change in gain at 8° elevation along +x and −x ≤ 0.5 dB. Both differences use the isolated antenna at identical soil, frequency and mesh. These are design tolerances for two bearings, with no implication for personal safety, all-angle pattern fidelity or received-field uncertainty.

Use the four-wire antenna at 1.2192 m, 7.2 MHz (λ = 41.64 m), soil 13/0.005. Spacing is shortest **centreline** distance from the nearest radial tip, not mast-to-mast distance. Place the object's lower end beyond +x at radial height. Every object is a 5 mm radius lossless wire. The short rod is 2 m (0.048λ) vertical. The long vertical and horizontal wires are 0.48λ (19.99 m), candidates for half-wave re-radiation without any asserted exact resonant frequency. The horizontal wire runs along y, centred opposite the tip. The pair adds a second identical long vertical at −x. Positive gaps are floating, unbonded. At zero gap a separate vertical shares the radial tip and becomes bonded. No object touches soil.

| Gap m (λ) | Long vertical, ΔZ magnitude Ω / worst gain change dB | Mirrored pair, Ω / dB |
|---|---:|---:|
| 0.5 (.012) | 11.18 / 3.62 | 31.60 / 2.57 |
| 2 (.048) | 9.54 / 3.57 | 29.70 / 2.94 |
| 5 (.120) | 7.10 / 3.00 | 20.48 / 1.97 |
| 10 (.240) | 4.85 / 1.20 | 8.94 / 0.88 |
| 20 (.480) | 2.73 / 0.58 | 5.47 / 0.80 |
| 40 (.961) | 1.05 / 0.40 | 2.07 / 1.14 |
| 80 (1.921) | 0.27 / 0.69 | 0.53 / 1.08 |

At 32 segments the short vertical and transverse horizontal passed at all seven sampled gaps from 0.5–80 m. For the single long vertical only the 40 m sample passed. At 64 segments the 20/40/80 m directional changes were 0.61/0.42/0.68 dB, preserving the pass then fail. The mirrored pair passed nowhere on this grid. Symmetry can remove front/back imbalance while both bearings still differ from the isolated control. The bonded vertical gave 35.94 − j15.47 Ω versus the isolated 33.01 − j17.51 Ω. It is a different circuit. No continuous clearance interval is established between samples. The results do not cover wires parallel to a radial, actual fences, trees, buildings, soil-contact posts, other frequencies or dimensions. The distance to the nearest object alone cannot specify clearance.

## Priorities and validation gates

1. **Correct user-facing claims first.** In help lines 197–203 and 293 remove the unsupported count-to-resistance schedule (2 Ω for 120, 5–15 Ω for 16–32, 30+ Ω for one rod) unless accompanied by calibration for the particular site and observable. Replace “usually a close stand-in” with an explicit positive-height sensitivity example. Replace categorical predictions of gain/resistance error direction with a statement of the fallback and missing losses. Preserve the warning, example-specific assumed loads, above-ground capability and named decks. Qualify “come out right” in index line 302 and corresponding README/help claims with the tested cases and mesh limits.
2. **Make the active ground mode and unsupported geometry visible in results and exports.** Validate elevated, surface, buried and detached-ground-contact cases separately. Check for any affected node after height offset, verify model-wide mirror switching, and mark below-interface results unusable. Keep alternate-ground calculations opt-in and identifiable.
3. **Validate measurements before fitting policies.** Replicate the Part 3 feed geometry, insulation, choke, measured site soil and current fractions. Record mesh sequences until ΔR and ΔX meet a stated tolerance. Compare directional transmission only after adding the receive geometry and matching or accepted-power correction. For burial obtain same-site paired surface/depth trials and an independently verified solver supporting the interface. Preserve uncertainty in depth, moisture and return conductors. Seek third-party hub impedance/current measurements before assigning fault to a specific solver.
4. **Treat clearance as a per-installation sweep.** Measure actual dimensions, bonds, feedline current and choke impedance. Sweep frequency across resonance, gap and angle on a finer grid, both polarizations and azimuths, with soil and mesh repeats. Validate induced current and directional field against a matched no-object or removable-object field trial. A universal distance or efficiency correction is unsupported.

## Independent review status for Hermes

The approved Herdr request to create a visible no-focus tab in the inherited workspace with this worktree as cwd returned `server_not_running` at `/home/ure/.config/herdr/sessions/rtest/herdr.sock`. No tab or pane ID was returned. Fable was not started, the report was not delivered, and no FABLE-REVIEW.md exists from this handoff. The pending review is to check the original figure conditions, reproduce a representative numerical probe, and challenge applicability and the clearance criterion against the exact RADIAL-STUDY.md in this worktree.
