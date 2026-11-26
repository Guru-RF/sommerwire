# Sommerwire physics review

Baseline: `776e959`. Synthesis of the Claude Fable and Codex Astra reviews. This is a review of numerical predictions, not a validation against a built antenna.

## What the model solves

Sommerwire is a browser-native thin-wire Method of Moments solver, not a port of NEC-2 or an assumed-current pattern calculator. It uses MININEC-style pulse currents, point matching and a reduced kernel. The coupled matrix yields port currents and impedances from ideal gap excitations. It models conductor skin effect and lumped losses; ideal transmission-line ports are lossless and do not radiate. Draw the shield exterior, mast and other current paths explicitly if they matter. See `README.md:59–69`, `engine.js:774–859` and `engine.js:906–948`.

| Mode | Current and impedance solve | Radiated field |
| --- | --- | --- |
| Free space | Direct wire interactions | Direct field over the sphere |
| Perfect ground | Perfect conducting image | Direct plus perfect image above the plane |
| Real soil, elevated wires, default | Quasi-static image plus tabulated/interpolated Sommerfeld half-space remainder | Polarization-dependent Fresnel reflection; sky wave only |
| Real soil, elevated wires, optional approximations | Complex-depth image or perfect mirror | Fresnel reflection from selected soil |
| Real soil with a ground-connected mesh node | Whole-model perfect-mirror fallback can affect electrically separate wires | Fresnel reflection still uses selected soil |

See `engine.js:594–658`, `engine.js:712–751`, `engine.js:997–1043`. The displayed gain is 4π times radiation intensity divided by net accepted input power over all driven ports, not realized gain at a transmitter. Headline SWR represents the first source. Standalone polar/3D views are peak-scaled; held 2D overlays share a reference (`index.html:1642`, `index.html:1735`). A similar silhouette is not proof of similar absolute gain.

## Highest-priority finding: inconsistent ground and power reference

A mirror impedance solve can produce very different accepted power from a self-consistent lossy-soil solve while the pattern still uses the real-soil Fresnel coefficients. Fable reported a 20 m-band dipole at 1 m over average soil: roughly 4.9 Ω and 10.29 dBi with the mirror approximation, with integrated sky-wave power about 1.8 times accepted input power. Adding an electrically separate earthed wire reportedly triggers the same hazard in the default ground mode; the engine warns about the fallback but still presents numeric gain. Treat these as review observations to reproduce in a deterministic test, not as benchmark tolerances. A positive feed resistance does not rule out this inconsistency. The optional complex-image method can also be substantially wrong above the current 0.01λ warning threshold; a single cutoff is not an accuracy guarantee.

## What the evidence supports

- `validation/nec2c/scripts/necmp.js` compares 11 cases at two mesh densities against nec2c. It checks feed R+jX and the sampled peak on one azimuth cut, not full patterns, null depth, polarization or current distribution. NEC uses odd segment counts for center excitation while Sommerwire uses an even mesh with a center node; call these comparable refinements, not identical discretizations.
- The fine-mesh 14.05 MHz dipole at 0.3 m over average soil is a useful positive control: archived results are 100.27 + j54.95 Ω (nec2c) and 100.14 + j53.44 Ω (Sommerwire), with −5.77 and about −5.78 dBi cut peaks. Sommerwire’s complex-image result is much farther away. This supports the default Sommerfeld treatment for that geometry; agreement to hundredths of a dB is not a physical uncertainty estimate.
- At 7.1 MHz with elevated radials at 0.3 m, archived Sommerwire X changes from −52.93 to −48.60 Ω on refinement while the gain peaks already agree closely. The residual reactance difference cannot be attributed solely to the basis functions without isolating the cause. Two densities do not establish convergence or an error bound (`validation/nec2c/decks/results.json`).
- Astra integrated the retained PEC DX Commander output and obtained a radiated-to-accepted ratio of 0.781508, despite NEC’s printed 100% efficiency; Fable independently reported approximately 0.782 and a Sommerwire ratio near unity. That is evidence of numerical inconsistency for the retained NEC case, not physical loss at the hub or proof that Sommerwire currents are correct. The DX scripts overwrite outputs; the ordinary impedance comparison also mixes Sommerwire copper with a NEC deck lacking a conductor-loss card. The dedicated balance comparison uses lossless Sommerwire wires (`validation/nec2c/scripts/necdx2.js`, `validation/nec2c/scripts/necbal.js`, `validation/nec2c/decks/b.out`).
- No calibrated installed impedance, conductor-current, efficiency, or field data were found. The comparison does not establish behavior for buried wires, layered soil, ground wave, crowded junctions generally, or installations with omitted feed hardware. Automatic coarsening also needs a model-specific sensitivity check. Fresh nec2c runs were not confirmed; the committed outputs and reviewers’ probes are distinct evidence.

## Against RF.Guru’s modeling guidance

[Why We Use Simplified Antenna Models—and When We Use NEC](https://shop.rf.guru/pages/why-we-use-simplified-antenna-models-and-when-we-use-nec): Sommerwire is the coupled-current tool to use when the geometry or loads change the currents. Its README should replace “come out right” with the actual geometries and observables benchmarked.

[Modeling Antenna Patterns with Python](https://shop.rf.guru/pages/modeling-antennas-with-python-no-nec-or-mmana-required): Both approaches phase-sum element contributions; the lightweight example prescribes currents, while Sommerwire solves them. Relative patterns explain lobe movement; absolute gain requires a defensible power reference and modeled losses.

[The Limits of NEC](https://shop.rf.guru/pages/the-limitations-of-nec): Solver agreement, mesh convergence and measurement answer different questions. Similar solvers can omit the same parts of the installed system. Report the geometry, soil, source reference plane and losses before comparing predictions with measurements.

## First PR: make ground-model validity explicit

1. Reproduce the mixed-ground failure with a deterministic regression. Exercise explicit mirror and the earthed-wire fallback, plus controls for free space, PEC and elevated default Sommerfeld. Capture effective ground treatments and the power or gain symptom before changing the solver or UI.
2. Make the effective impedance and far-field methods visible separately. Protect users from presenting an inconsistent absolute gain as physically valid. Exercise the actual output paths (normal calculations, direct pattern/elevation displays, and any sweeps or optimizer objectives that would still consume misleading absolute gain). If retaining relative pattern shape, label it as indicative. Do not silently replace real soil with PEC for all outputs or present a forced normalization as a physics correction.
3. Scope claims in README/help to verified use cases and explain ideal TL, accepted versus realized gain, and the limits of the DX power-balance check. Preserve the elevated Sommerfeld baseline. If integration over angle is used as a diagnostic, distinguish quadrature error and modeled losses from a passivity violation; do not require the sky-wave integral to equal accepted power over lossy ground.

Defer a true ground-contact/buried-wire formulation and broad Sommerfeld-table or meshing changes. After Astra’s candidate, Fable should independently challenge the physics, tests and user-facing behavior before publication.

## Candidate review: Astra implementation, Fable verification

Astra’s guard retains the current solve, impedance and SWR but withholds patterns and pattern-derived metrics for real-soil Fresnel output paired with mirror-solved currents. Fable independently reproduced the baseline failure at 14.05 MHz: approximately 4.90 Ω, 10.30 dBi and 1.816 times accepted power, both with explicit mirror and with an isolated grounded stub. Fable reported bit-identical unaffected results across 23 comparison cases and verified the main guard interactions in headless Chromium using an instrumented scratch copy.

Before marking the PR ready:

- Make the numerical repro executable independently of the production guard. The current five tests verify controls and withholding; the excess-power assertion is unreachable for the guarded cases. Do not expose an unguarded production output merely to test it.
- Decide whether to withhold all affected patterns or retain a clearly labeled indicative relative shape. The current policy hides several built-in example patterns. A power ratio below one is not proof of validity: at 3 m the mirror case still overstates gain with a ratio near 0.83.
- Address or document stale sweep results after a ground-method change, and reconcile the fallback and pattern warning text. Low-height complex-image accuracy and buried wires remain separate limitations, not fixed by this candidate.
