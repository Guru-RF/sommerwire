# Common-mode rejection for EFHW transformer, choke and coax: study

Research only, 2026-11-27, branch `ai/sw-cmrr` at `bd901d9`. No engine, UI, example or test file was changed; this
document is the only addition. Nothing here is a production feature.

**No component data is used or implied.** Every choke impedance below is a sweep parameter (0 Ω to 10 kΩ, ±j1 kΩ,
±j3 kΩ, 10⁹ Ω), not a property of mix 77, mix 31 or any RF.Guru part. No CMRR figure for any ferrite, transformer or
choke appears in this study, because none was measured.

## 1. Answer in short

- **Whether:** yes for the choke, and the solver can already do it at one frequency. A dB "CMRR" number is not a
  usable input in any form; the model needs the choke's complex common-mode impedance R(f) + jX(f) and the geometry of
  the coax shield on both sides of it.
- **How:** draw the coax shield exterior as wires on both sides of the choke and put the choke there as a lumped
  series impedance. The engine's existing `R + jX` load does exactly this (section 4). What is missing for real use
  is a frequency table for that impedance, a report of the shield currents, and a way to terminate the far end of the
  coax (section 6).
- **Transformer CMRR:** for the unun as the two EFHW examples model it (antenna terminal and coax shield share the
  return), common-mode rejection is not defined: the shield is the return conductor by construction and carries the
  full feed current. A transformer contributes rejection only if it has an isolated secondary with its own
  counterpoise terminal; modelling that needs a measured three-port and an engine extension (section 5, M3).
- **The three quantities are different things** and are not convertible without the antenna model (section 2). In the
  runs below, a 3 kΩ resistive choke, which reads 29.8 dB in a 50 Ω series fixture, lowers the shield current at the
  choke by 5.6 to 16.5 dB depending on band and coax length, and a 10⁹ Ω choke still leaves a current of −12 dB
  relative to the radiator maximum on a 20 m run at 7.1 MHz.

## 2. Three quantities that get called "CMRR"

| | Mixed-mode port CMRR | Choke common-mode impedance | Feedline current suppression |
|---|---|---|---|
| What it is | Ratio of wanted to unwanted mode conversion of a three-terminal device | Series impedance the device presents to current on the outside of the shield | Change of shield current in the installed antenna |
| Belongs to | Device **and** fixture reference impedances | Device (plus fixture stray capacitance) | The whole system: device, wire geometry, ground, station end |
| Unit | dB | Ω, complex, per frequency | dB, per location on the cable |
| Measured with | Three-port VNA, mixed-mode conversion | Two-port VNA, series-through, or impedance analyser | Clamp-on RF current probe, with and without the device |
| Enters the wire model as | Not directly; only through the full three-port matrix | A lumped series load on the shield wire | It is an **output** |

**Mixed-mode port CMRR.** For a device with a single-ended port 1 (coax) and terminals 2 and 3 forming the
antenna-side pair, measured single-ended against the fixture ground in Z0:

    S_ds21 = (S21 − S31)/√2      differential response to the single-ended input
    S_cs21 = (S21 + S31)/√2      common-mode response to the single-ended input
    CMRR   = |S_ds21| / |S_cs21| = |S21 − S31| / |S21 + S31|

The differential mode is referenced to 2·Z0 (100 Ω) and the common mode to Z0/2 (25 Ω). An EFHW presents neither: the
wire end is a few kΩ (1.5 to 3 kΩ resistive part in the models here) and the common-mode path is whatever the shield
and ground are. The scalar ratio therefore does not predict current in the installation; the full complex 3×3 matrix
does, once it is connected to the antenna's own impedances.

**Choke common-mode impedance.** With the choke in series between the two ports of a Z0 system (shield exterior as the
through conductor):

    S21 = 2·Z0 / (2·Z0 + Zcm)        Zcm = 2·Z0·(1/S21 − 1)
    fixture attenuation = 20·log10 |1 + Zcm / (2·Z0)|

The attenuation figure is the same information as Zcm, expressed for a 100 Ω loop. It is often quoted as the choke's
"CMRR" or "common-mode rejection". For Zcm = 3 kΩ resistive this is 20·log10(31) = 29.8 dB, for 10 kΩ 40.1 dB (plain
arithmetic on the sweep values used below).

**Feedline current suppression.** With the choke as a series element in the shield path, linear network theory gives
for the current at the choke position (index 2) relative to the current at the feed gap (index 1):

    I2 / I1 = (Y21 / Y11) / (1 + Zc / Z22)        suppression at fixed feed current = |1 + Zc / Z22|
    I2      =  Y21·V1 / (1 + Zc / Zsc)            suppression at fixed feed voltage = |1 + Zc / Zsc|

Z22 is the impedance looking into the cut in the shield with the feed gap open, Zsc = 1/Y22 the same with the feed gap
shorted. The first form does not depend on the source impedance. Both show the point: the loop impedance that Zc is
compared with is a property of the antenna system, not 100 Ω, and it is complex. When Zc is reactive with the opposite
sign to that impedance, the denominator shrinks and the "choke" increases the current.

Even this is the current at one point. Current further along the cable is also induced by the field of the antenna
and is not bounded by the choke impedance (section 4.3).

## 3. What the solver can and cannot do today

Read from `engine.js` (`solve`, lines 775 to 1092) and confirmed by the runs in section 4.

| Need | Engine today | Evidence |
|---|---|---|
| Shield exterior carrying current | Yes, as an ordinary wire; `efhwgen.js` already does this for the 4 m / 8 m of shield up to the choke | wire 3 of both examples |
| Choke as series impedance on that wire | Yes: load type 1, `R + jX` in series at a wire begin, centre or end (lines 932 to 954) | section 4 |
| Frequency-dependent choke | **No.** Type 1 is the same at every frequency. Type 0/2 are series L–C or a parallel trap with a constant-Q coil; neither represents a ferrite choke (roughly a resistance in parallel with L and C) across a band | load fields are `pos,type,R,X` or `L,C,Q,Qc,Cp,R` |
| Ideal choke | Open wire end, as the examples use | `efhwgen.js` comment |
| Current on any wire | Computed (`segCur`, `halfRe`, `halfIm`) but only shown as the current display; no number for "shield current" is reported | return value of `solve` |
| Power lost in a load | Not reported separately; it is included in the gain (gain is against input power) | Gmax drops with resistive Zc in section 4 |
| Transformer | Ideal: the solve is done at the wire gap and R, X are divided by n afterwards (line 1072). No loss, no parasitics, no effect on currents | test: `R·n − Rant = 0` |
| Transformer as a network | **No.** There is no general N-port element. The only network is the transmission-line port system (lines 961 to 1054), a 2×2 admittance between two wire gaps | — |
| Coax differential mode | `tls` line between two gaps; does not radiate or couple, so it carries no common mode | help, "Transmission lines" |
| Coax jacket | Insulated-wire option (`ins`, thin sheath) can be applied to the shield wires; not used in the examples | `INS` handling, line 1288 |
| Coax far end at a station earth | **Not with the Sommerfeld ground.** Any wire touching the ground switches the whole impedance solve to the perfect mirror | section 4.4 (d) |
| Source impedance | Ideal voltage source. Current ratios are independent of it; absolute currents per forward watt need the transformer | — |

## 4. Tests actually run

Environment: Node v26.12.0, Linux. Existing suites first, unchanged and passing: `node --test tests/` 24 of 24,
`node --test validation/*.test.js` 17 of 17.

Models: the two shipped examples from `efhwgen.js` (EFHW8040 at 3.65 and 7.1 MHz, EFHW16080 at 1.85 and 3.65 MHz;
Sommerfeld ground, εr 5, 1 mS/m), with one added wire 4: the shield continuing past the choke position for 10 or 20 m
along −Y at the choke height, far end open. The choke is a type-1 load at `w4b`. In every run `mirrorMix` was false
and there were no warnings. The script is in the appendix.

### 4.1 Current at the choke against choke impedance

`|Ichoke/Ifeed|` in dB relative to Zc = 0 (a plain continuous shield). Negative is less current.

| Model, frequency, coax beyond choke | Z22 Ω (feed open) | 1 kΩ | 3 kΩ | 10 kΩ | +j1 kΩ | −j1 kΩ |
|---|---|---|---|---|---|---|
| EFHW8040, 3.65 MHz, 10 m | 53 − j1371 | −2.0 | −7.7 | −17.4 | **+11.3** | −4.8 |
| EFHW8040, 3.65 MHz, 20 m | 92 − j1018 | −3.3 | −10.1 | −19.9 | **+20.7** | −5.9 |
| EFHW8040, 7.1 MHz, 10 m | 55 − j462 | −7.9 | −16.5 | −26.7 | −1.3 | −10.0 |
| EFHW8040, 7.1 MHz, 20 m | 1501 − j1018 | −3.5 | −8.1 | −16.1 | +1.6 | −2.8 |
| EFHW16080, 1.85 MHz, 10 m | 54 − j1889 | −1.2 | −5.6 | −14.7 | **+6.5** | −3.7 |
| EFHW16080, 1.85 MHz, 20 m | 56 − j1438 | −1.9 | −7.4 | −17.0 | **+10.3** | −4.6 |
| EFHW16080, 3.65 MHz, 10 m | 50 − j826 | −4.2 | −11.6 | −21.7 | **+13.2** | −6.9 |
| EFHW16080, 3.65 MHz, 20 m | 87 − j467 | −7.9 | −16.4 | −26.6 | −1.1 | −9.8 |
| 50 Ω series fixture, for comparison | 100 | −20.8 | −29.8 | −40.1 | −20.0 | −20.0 |

- The same 3 kΩ gives 5.6 to 16.5 dB here against 29.8 dB in the fixture; 10 kΩ gives 14.7 to 26.7 dB against 40.1 dB.
- The shield path at the choke is capacitive in all eight cases (short, open-ended conductors), so an inductive
  +j1 kΩ raises the current in six of them, by up to 20.7 dB. With the reactance chosen to cancel the path reactance
  exactly (+j1299 Ω, 8040, 3.65 MHz, 10 m) the current rose 23.8 dB and the feed impedance moved from 3396 − j2337 to
  13164 + j2133 Ω. Magnitude |Z| alone is therefore not enough; R and X are needed separately, with the sign of X.
- Coax length sweep, EFHW8040, 3 kΩ resistive, 5 to 40 m beyond the choke: 5.8 to 13.9 dB at 3.65 MHz and 8.1 to
  23.7 dB at 7.1 MHz.

### 4.2 Effect on the antenna itself

| EFHW8040, 10 m beyond choke | Zc = 0 | 1 kΩ | 3 kΩ | 10 kΩ | 10⁹ Ω | shipped (open end, no wire 4) |
|---|---|---|---|---|---|---|
| 3.65 MHz SWR (50 Ω side) | 1.95 | 2.13 | 2.34 | 2.43 | 2.45 | 2.45 |
| 3.65 MHz power in the choke, % of input | 0 | 9.5 | 8.1 | 3.1 | 0 | – |
| 3.65 MHz peak gain, dBi | 3.72 | 3.33 | 3.40 | 3.61 | 3.74 | 3.74 |
| 7.1 MHz SWR | 2.31 | 1.90 | 2.20 | 2.37 | 2.45 | 2.45 |
| 7.1 MHz power in the choke, % of input | 0 | 20.4 | 10.0 | 3.4 | 0 | – |
| 7.1 MHz peak gain, dBi | 3.01 | 2.12 | 2.53 | 2.78 | 2.91 | 2.89 |

A finite resistive choke moves the SWR by up to 0.5 and absorbs up to a fifth of the power in these runs (largest at
300 Ω to 1 kΩ, 21 % at 300 Ω on 7.1 MHz). Both are outputs a real model would have to report; the choke's
dissipation is also its heating. The percentages are of the power into the ideal source, with a lossless transformer.

### 4.3 Current on the cable beyond the choke

Largest current on wire 4 relative to the largest current on the radiator, in dB:

| | Zc = 0 | 1 kΩ | 3 kΩ | 10 kΩ | 10⁹ Ω |
|---|---|---|---|---|---|
| EFHW8040, 3.65 MHz, 10 m | −20.0 | −21.8 | −27.3 | −36.4 | −45.1 |
| EFHW8040, 3.65 MHz, 20 m | −17.4 | −20.0 | −25.6 | −32.2 | −37.1 |
| EFHW8040, 7.1 MHz, 10 m | −8.8 | −15.7 | −23.8 | −30.2 | −31.7 |
| EFHW8040, 7.1 MHz, 20 m | −5.7 | −8.7 | −11.4 | −12.4 | **−12.1** |
| EFHW16080, 1.85 MHz, 10 m | −20.3 | −21.4 | −25.7 | −34.7 | −52.8 |
| EFHW16080, 1.85 MHz, 20 m | −17.9 | −19.7 | −25.0 | −34.5 | −51.1 |
| EFHW16080, 3.65 MHz, 10 m | −18.1 | −22.0 | −29.4 | −39.4 | −47.6 |
| EFHW16080, 3.65 MHz, 20 m | −13.1 | −20.2 | −28.1 | −35.3 | −39.2 |

The 10⁹ Ω column is the floor set by field coupling onto the cable, with no conducted current through the choke at
all. On a 20 m run at 7.1 MHz (about a half wave, in line with the shield section) that floor is −12 dB, and no choke
impedance at that one position improves on it. A single choke value cannot be turned into a current figure without
the cable route.

For reference, the shield section between feedpoint and choke carries 0.97 to 1.00 of the feed-gap current in the
shipped models (0.14 to 0.27 of the radiator maximum): it is the return conductor, as the product pages state.

### 4.4 Consistency and limit checks

| Check | Result |
|---|---|
| (a) Zc = 0 load against the same wires with no load | Identical: 3395.5 − j2337.1 Ω both |
| (b) Zc = 10⁹ Ω against a physical 5 cm gap in the wire | 3038.6 − j2979.6 against 3037.4 − j2981.3 Ω; wire-4 current 0.0385 against 0.0358 of the feed current |
| (b) the shipped model (no wire 4 at all) | 3032.8 − j2982.8 Ω: the open-end approximation is within 6 Ω here when the cable beyond is 10 m and floating |
| Reciprocity of the two gaps, \|Y12 − Y21\| / \|Y21\| | 0.07 to 0.22 % over the eight cases |
| Two-port prediction of I2/I1 against the direct solve with the load | Agree to 10⁻¹³. This is an algebraic identity for a series load, so it confirms the bookkeeping and sign conventions, not the physics |
| (c) Segmentation, DM1/DM2 400/40 → 800/80 → 1600/160 | Zsc 278.6 − j1299.4 → 276.2 − j1295.3 → 273.8 − j1290.6 Ω; \|I2/I1\| at 3 kΩ 0.3000 → 0.2973 → 0.2947. About 1 % per doubling, still drifting |
| (d) Far end of the coax taken down to the ground | `mirrorMix` true, all five wires flagged, feed impedance 2885 − j4031 Ω, gain marked approximate. The Sommerfeld solution is lost |
| (f) Ideal transformer | `R·70 − Rant = 0`: a pure division, no influence on currents |

**Not run:** any comparison with NEC (no `nec2c` binary on this machine, and none was installed), any measurement, any
other ground, any frequency sweep with a frequency-dependent choke (the engine cannot express one).

## 5. Candidate model

Staged so that each step is useful alone and can be validated before the next.

**M0, today, no code.** Shield wires on both sides of the choke, type-1 load `R + jX` at the junction, one frequency at
a time, values typed in from a measurement. Results for sweeps and for the multiband calculation are wrong because
the load does not change with frequency.

**M1, tabulated series impedance (the choke).** A load type whose R and X come from a table of measured points,
interpolated in frequency (interpolate R and X, or log |Z| and phase; never extrapolate, and refuse to calculate
outside the measured range). It is the same matrix stamp as type 1 in `solve`, so it adds no new numerics. Outputs to
add with it:
- current at the load and the largest current on named wires, relative to the largest radiator current;
- power dissipated in the load, in watts per watt of input and in dB of gain;
- a statement of what terminates the cable, since the result depends on it.

**M2, measured two-port transformer, common-return unun.** Because the unun's antenna terminal and return are the one
wire gap already solved, a measured 2×2 matrix cascades after the solve with no change to the method of moments:

    Zin = Z11 − Z12·Z21 / (Z22 + Zant)        loss = 1 − (power into Zant) / (power into Zin)

This replaces the ideal ratio and gives transformer loss and the real SWR. It adds nothing about common mode: with a
common return the shield current at the feed equals the antenna current whatever the transformer is.

**M3, N-port network across wire gaps (isolated-secondary transformers).** A transformer with an isolated secondary has
three terminals on the model side: antenna, secondary return (counterpoise terminal) and coax shield. The common-mode
path is then the inter-winding coupling, and only a measured three-port describes it. The engine's line network
solves `(Y_antenna + Y_lines)·V = J` over wire-gap ports; a general admittance stamp over two gaps, with the coax
port reduced to a source term, is the same structure and is what NEC's NT card does. This is a real engine change:
ports are created only by transmission lines today, and the source term `J` exists only for fixed-voltage ports.
Section 2's mixed-mode CMRR could then be computed from the same matrix as a cross-check, never used as an input.

**Coax.** No new element. Differential mode stays an ideal line or is left out (its loss can be applied afterwards);
common mode is the shield wire, with the jacket as insulated wire if its thickness and permittivity are known.

## 6. Measured inputs required

Nothing below is available in this repository. Without it the model stays at parameter sweeps.

**Choke (M1)**
- Complex Zcm(f), R and X separately with sign, over every band of use plus margin, on the actual part: cable type,
  turns, core stack and enclosure as sold.
- Fixture description and its stray capacitance; a few pF across the fixture caps the readable impedance at the
  upper frequencies (1 pF is 5.3 kΩ at 30 MHz).
- Unit-to-unit spread from several samples, and the temperature of the measurement. Ferrite permeability and loss
  change with temperature and from batch to batch.
- Drive level. Small-signal VNA data says nothing about behaviour at transmit power, where the dissipation of
  section 4.2 heats the core.

**Transformer (M2, M3)**
- M2: full complex two-port S-parameters from the coax connector to the antenna terminal against the shared return,
  with the method used to reach a kΩ-level port stated (resistive pad or a pair back to back, and how it was
  de-embedded). A 50 Ω port directly on the high-impedance side is not accurate enough.
- M3: three-port S-parameters (coax, antenna terminal, secondary return) against a defined reference, or failing
  that the inter-winding capacitance and leakage inductance, which give only a first-order model.
- Whether the winding is an autotransformer or isolated, and what the counterpoise terminal connects to.

**Installation**
- Route, length and height of the coax on both sides of the choke; outer diameter and jacket of the cable.
- What the far end connects to: station earth, mains earth through the equipment, a second choke, nothing. This is
  the largest unknown and it cannot be represented over the Sommerfeld ground today (section 7).
- Wire geometry and soil, as for any model.

## 7. Limits

- **Station end of the cable.** A grounded far end forces the perfect-mirror solve for the whole model. All figures
  in section 4 are for an open, floating far end, which is a choice, not a typical station. Real cables end at
  equipment with a mains earth of unknown RF impedance.
- **One load value for all frequencies.** Until M1 exists, no sweep or multiband result with a finite choke is valid.
- **Lumped choke.** No physical size, no stray capacitance from the choke body to nearby wires or ground, and no
  common-mode impedance spread along a coiled cable.
- **Linear, small signal.** No saturation, no heating, no change of the ferrite with power.
- **Segmentation.** About 1 % change per doubling in the quantities checked, not yet converged; short shield wires
  next to an 82 m radiator are the kind of geometry the help text lists as less accurate.
- **Cable beyond the choke is straight and at constant height** in these runs; a real route (down a wall, along the
  ground, indoors) changes Z22 and the coupled current.
- **Open-ended shield sections are capacitive**, which is why inductive chokes look bad here. A cable ending at a
  low-impedance earth can present an inductive path instead and reverse that conclusion. Section 4.1 shows the
  mechanism, not a rule about inductive chokes.
- **The transformer is ideal** in every run. Its loss, its parasitics and, for an isolated type, its own
  common-mode path are absent.
- **No independent check.** The numbers come from one solver. The limit checks in 4.4 test consistency, not accuracy.

## 8. Validation plan, before anything ships

1. **Solver against solver.** The same four-wire models with a lumped load in NEC-2 (`LD 4` card on the shield wire;
   `nec2c` as in `validation/nec2c/`): feed impedance and the current at the choke, for the 8040 at 3.65 and 7.1 MHz
   with Zc = 0, 1 kΩ, 3 kΩ, +j1 kΩ. This needs the binary and nothing else.
2. **Convergence.** Repeat section 4 at finer segmentation until the current ratio changes by less than a stated
   tolerance, and record the segmentation required.
3. **Choke data in, M1.** One measured choke table; check that the interpolated load reproduces single-frequency
   type-1 runs at the measured points exactly.
4. **Bench.** Feed a wire of known geometry over a known surface, with the choke in the shield path and a calibrated
   clamp-on current probe on both sides; compare measured current ratios with the model at the same positions. This
   validates the system quantity, which is the only one the user cares about.
5. **Installation.** One real EFHW8040 or EFHW16080 with a documented cable route: probe currents with the choke in
   and bypassed, at several positions along the coax, on both bands. Agreement here, within a tolerance agreed
   beforehand, is the acceptance test. Disagreement dominated by the station end would show that the far-end
   termination has to be solved first.
6. **Transformer, M2.** Measured two-port against the SWR measured at the coax with the same antenna; M3 only after
   M1 and M2 hold.

## Appendix: reproduction script

Save as a file in the repository root and run with `node`. It reproduces sections 4.1 to 4.3 for 10 and 20 m. It
was run from the repository root on 2026-11-27 and then removed; it is not part of the app or the test suites.

```js
require('./engine.js'); require('./efhwgen.js');
const MM = globalThis.MM, C = (re, im) => ({ re, im }), abs = a => Math.hypot(a.re, a.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re), add = (a, b) => C(a.re + b.re, a.im + b.im);
const sub = (a, b) => C(a.re - b.re, a.im - b.im), div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const fz = z => z.re.toFixed(0) + (z.im < 0 ? '' : '+') + z.im.toFixed(0) + 'j';
// the shipped example, plus wire 4 = coax shield beyond the choke (L4 metres along -Y at the choke height, open end)
function model(key, L4, load, src) {
  const m = globalThis.rfGuruEfhwInvL(key), ev = v => MM.evalExpr(v, MM.lambdaOf(+m.freq));
  const n = { z0: 50, material: m.material, loads: [], tls: [], ins: null, seg: { dm1: 400, dm2: 40, sc: 2, ec: 1 }, ground: Object.assign({ nf: 'sommerfeld' }, m.ground),
    wires: m.wires.map(w => ({ x1: ev(w.x1), y1: ev(w.y1), z1: ev(w.z1), x2: ev(w.x2), y2: ev(w.y2), z2: ev(w.z2), r: ev(w.r) / 1000, seg: -1 })),
    sources: [{ pos: src || 'w1b', phase: 0, mag: 1, ratio: src ? 1 : +m.sources[0].ratio }] };
  const e = n.wires[2]; n.wires.push({ x1: e.x2, y1: e.y2, z1: e.z2, x2: e.x2, y2: e.y2 - L4, z2: e.z2, r: e.r, seg: -1 });
  if (load) n.loads = [{ pos: 'w4b', type: 1, R: load[0], X: load[1] }];
  return n;
}
const gapI = (r, wire) => { const h = 2 * r.mesh.wireSegs[wire][0]; return C(r.halfRe[h], r.halfIm[h]); };   // current at the wire's begin
const wmax = (r, w) => Math.max(...r.mesh.wireSegs[w].map(s => r.segCur[s].mag));
for (const [key, f] of [['8040', 3.65], ['8040', 7.1], ['16080', 1.85], ['16080', 3.65]]) for (const L4 of [10, 20]) {
  const a = MM.solve(model(key, L4), f), b = MM.solve(model(key, L4, null, 'w4b'), f);
  const Y11 = gapI(a, 0), Y21 = gapI(a, 3), Y12 = gapI(b, 0), Y22 = gapI(b, 3), det = sub(mul(Y11, Y22), mul(Y12, Y21));
  console.log(`\nEFHW${key} ${f} MHz, ${L4} m beyond the choke: Z22 ${fz(div(Y11, det))}  Zsc ${fz(div(C(1, 0), Y22))}  reciprocity ${(abs(sub(Y12, Y21)) / abs(Y21)).toExponential(1)}`);
  let r0;
  for (const Zc of [[0, 0], [1000, 0], [3000, 0], [1e4, 0], [1e9, 0], [0, 1000]]) {
    const n = model(key, L4, Zc), r = MM.solve(n, f), g = MM.makePattern(r, n).findMax().g;
    const ratio = abs(div(gapI(r, 3), gapI(r, 0))), pred = abs(div(Y21, add(Y11, mul(det, C(Zc[0], Zc[1])))));
    r0 = r0 || ratio;
    console.log(`  Zc ${fz(C(...Zc)).padEnd(14)} |Ichoke/Ifeed| ${ratio.toFixed(4)} (two-port ${pred.toFixed(4)})  ${(20 * Math.log10(ratio / r0)).toFixed(1).padStart(6)} dB re Zc=0` +
      `  max|I4|/max|Irad| ${(20 * Math.log10(wmax(r, 3) / Math.max(wmax(r, 0), wmax(r, 1)))).toFixed(1)} dB  Pchoke/Pin ${(50 * Zc[0] * abs(gapI(r, 3)) ** 2 / r.Pin).toFixed(1)} %  Gmax ${MM.dB(g).toFixed(2)} dBi`);
  }
}
```

The −j1 kΩ column, the coax length sweep, the 300 Ω point and the checks of section 4.4 came from variants of the
same script (other `Zc` and `L4` lists, `seg` settings, a 5 cm offset of wire 4, and a fifth wire to z = 0).
