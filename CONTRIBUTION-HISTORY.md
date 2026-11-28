# Sommerwire contribution history

This RF.Guru edition of Sommerwire was made by **ON9PK Koen Van den Heuvel** and
**[ON6URE](https://on6ure.be) Joeri Van Dooren** ([RF.Guru](https://shop.rf.guru)).
Koen created Sommerwire with Claude Opus 5.5 in November 2026 and maintains the upstream project.
Joeri co-developed the RF.Guru edition and contributed fixes and reviews upstream. [Upstream repository](https://github.com/KoenVdH/sommerwire) · [RF.Guru repository](https://github.com/Guru-RF/sommerwire)

The RF.Guru entries follow the first-parent merge history through 28 November 2026. The upstream entries use the
GitHub PR states and closure times recorded on 26–27 November and the merge and adoption commits included in this
checkout. Dates and times are UTC. GitHub updates the PR lists as work lands.
[Verified RF.Guru base](https://github.com/Guru-RF/sommerwire/commit/f3d0362d) · [Live merges into RF.Guru main](https://github.com/Guru-RF/sommerwire/pulls?q=is%3Apr+is%3Amerged+base%3Amain) · [All upstream PRs](https://github.com/KoenVdH/sommerwire/pulls?q=is%3Apr)

## Original app and upstream maintenance

Koen’s first release included the thin-wire solver with Sommerfeld ground, 3D editor, MMANA-GAL file exchange,
pattern plots, sweeps, Smith chart and optimizer. It shipped with examples, Help and runnable NEC-2 comparisons.
Koen subsequently added lossy transmission lines, ideal baluns, insulated wire, telescoping elements and boom
corrections. [Original release](https://github.com/KoenVdH/sommerwire/commit/2019b921) · [Line and wire models](https://github.com/KoenVdH/sommerwire/commit/f9fbb9c9) · [Tube elements](https://github.com/KoenVdH/sommerwire/commit/ee7f8b92)

## Joeri’s upstream reports and fixes

The upstream records are from Koen’s repository. **Merged** credits Joeri’s change as merged by Koen.
**Independently implemented** credits Joeri’s finding or review and Koen’s implementation. The PRs marked closed
were closed without a merge.

| Record (26 November 2026) | What the user saw or the review found | Upstream outcome |
|---|---|---|
| [PR #1](https://github.com/KoenVdH/sommerwire/pull/1), closed without merge at 20:04 | Joeri found, reproduced and documented the excessive gain from pairing mirror-solved currents with real-ground reflection. He submitted a patch to hide the affected patterns and gain. | **Adopted by hand, with a different implementation.** Koen confirmed the reproduction and credited Joeri, then kept the readout, marked it approximate (≈) and scaled down excess radiated power. [Koen’s closing comment](https://github.com/KoenVdH/sommerwire/pull/1#issuecomment-7202269562) · [v1.1.1](https://github.com/KoenVdH/sommerwire/commit/8a71c60c) · [Worked example](help.html#mixgain) |
| [PR #2](https://github.com/KoenVdH/sommerwire/pull/2), merged 20:59 | After a model edit, completed or still-running sweeps could leave old points on the chart and in the band summary. | **Merged.** Joeri cleared the results and invalidated outstanding work on edit. [Merge 7593c0c4](https://github.com/KoenVdH/sommerwire/commit/7593c0c4) |
| [PR #6](https://github.com/KoenVdH/sommerwire/pull/6), merged 20:59 | The solver could warn about a buried or crossing wire and still return an impedance for unsupported geometry. | **Merged.** Joeri added a check against the ground plane after the height offset, preserving the ground-contact tolerance. [Merge c142d9d9](https://github.com/KoenVdH/sommerwire/commit/c142d9d9) |
| [Issue #3](https://github.com/KoenVdH/sommerwire/issues/3) | An optimizer trial that brought a wire into contact with the soil could score better because the whole model switched to the perfect mirror. | **Independently implemented.** Koen excluded such trials when the starting model had a full ground solve and marked approximate gain in the optimizer and sweep summary. [v1.3.0](https://github.com/KoenVdH/sommerwire/commit/b4cd485d) |

### Model limits, validation and Help

| Record (26 November 2026) | Joeri’s review | Upstream outcome |
|---|---|---|
| [PR #4](https://github.com/KoenVdH/sommerwire/pull/4), closed 21:06 | Near the soil, complex-image results could depart substantially from Sommerfeld before a user saw a warning. | **Independently implemented.** Koen extended the height warning and documented the comparisons. [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) · [Ground models](help.html#m-ground) |
| [PR #5](https://github.com/KoenVdH/sommerwire/pull/5), closed 21:07 | Users needed to see the effective segment counts after automatic coarsening and how to check mesh sensitivity. | **Independently implemented.** Koen added counts and refinement guidance. [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) |
| [PR #7](https://github.com/KoenVdH/sommerwire/pull/7), closed 21:07 | Comparison runs could overwrite earlier output. The DX Commander comparison used copper in Sommerwire and lossless wire in nec2c. | **Independently implemented.** Koen isolated the runs, aligned the sampling and reran with lossless wire in both programs. [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) · [Rerun](https://github.com/KoenVdH/sommerwire/commit/3aaa2138) · [Archived decks](https://github.com/KoenVdH/sommerwire/commit/e60e5a7a) |
| [PR #8](https://github.com/KoenVdH/sommerwire/pull/8), closed 21:07 | The description of the ground kernel, segmentation and validation implied more than the comparisons tested. | **Independently implemented.** Koen documented the reduced kernel, comparable segmentation, interpolation spot checks and reactance sensitivity. [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) |

Koen also credited Joeri’s advice on raised radials, wires that trigger the mirror fallback even when disconnected,
and testing nearby objects by varying their placement. [Issue #9](https://github.com/KoenVdH/sommerwire/issues/9) · [Issue #10](https://github.com/KoenVdH/sommerwire/issues/10) · [Koen’s changes](https://github.com/KoenVdH/sommerwire/commit/b4cd485d) · [Buried radials](help.html#buried) · [Nearby objects](help.html#m-near)

The Help credits Joeri for spotting the mismatched wire materials, and the validation notes credit his script review.
The corrected DX Commander comparison still leaves uncertainty at the hub. Koen also added Joeri’s RF.Guru articles
on approaching a model to the Help. [NEC-2 comparison](help.html#v-nec) · [Validation scripts](validation/nec2c/README.md) · [Help addition](https://github.com/KoenVdH/sommerwire/commit/7854496)

## Joeri’s RF.Guru edition work

These PR numbers belong to the fork. Each merge link identifies what entered RF.Guru `main`. The fork’s first
integration below builds on [Koen’s upstream revision of 27 November](https://github.com/KoenVdH/sommerwire/commit/0b99051a).

| Merged (UTC) | Fork pull request | What landed |
|---|---|---|
| 27 Nov 2026 11:51 | [#2 Integrate RF.Guru presets and polarization display](https://github.com/Guru-RF/sommerwire/pull/2) · [Merge 7ad3b3f5](https://github.com/Guru-RF/sommerwire/commit/7ad3b3f5) | EFHW16080 and EFHW8040 inverted-L examples with sourced dimensions and dual-band results. Added horizontal + vertical pattern overlays, per-band angle summaries, receiving directivity factor (RDF), whole-pattern polarization labels and far-field views in the editor, with regression tests. |
| 27 Nov 2026 13:49 | [#3 Show H/V gain peaks and document contributions](https://github.com/Guru-RF/sommerwire/pull/3) · [Merge 11e00cfc](https://github.com/Guru-RF/sommerwire/commit/11e00cfc) | Separate H and V peak gains and directions, low-angle V and high-angle H tiles and their tests. Added this ledger, contributor credits and the PR checklist. |
| 27 Nov 2026 16:12 | [#4 Add RF.Guru EFOC29 4:1 unun preset](https://github.com/Guru-RF/sommerwire/pull/4) · [Merge b7d8d4d6](https://github.com/Guru-RF/sommerwire/commit/b7d8d4d6) | A separate RF.Guru example alongside Koen’s EFOC29. It models a 29 m flat top, ideal 4:1 unun and 12 m of coax shield up to an ideal choke, initially at seven frequencies. |
| 27 Nov 2026 16:31 | [#5 Add 30 m to EFOC29 band results](https://github.com/Guru-RF/sommerwire/pull/5) · [Merge 58586b2d](https://github.com/Guru-RF/sommerwire/commit/58586b2d) | Added 30 m as the **eighth band**. Separately published a [10 m mast study](validation/efoc29-mast/README.md) with above-soil proxies, a truncated return and a nec2c check. The buried case remains unsupported and the study yielded no mast preset. |
| 28 Nov 2026 02:44 | [#6 Stage antenna results and speed up repeated solves](https://github.com/Guru-RF/sommerwire/pull/6) · [Merge 97d7937a](https://github.com/Guru-RF/sommerwire/commit/97d7937a) | Show impedance and SWR before the far-field results, calculate plot detail on demand, reuse matching Sommerfeld interpolation tables and use blocked LU factorization for large matrices. Regression tests compare the staged, cached and blocked paths with their references. |
| 28 Nov 2026 10:18 | [#7 Show polarization-aware DX and high-angle gain](https://github.com/Guru-RF/sommerwire/pull/7) · [Merge 9ddfcd69](https://github.com/Guru-RF/sommerwire/commit/9ddfcd69) | Both H and V peaks in the 5–30° DX and 60–90° high-angle windows. Each highlights the modelled polarization when one is identified. The NVIS label is reserved for amateur bands from 160 m through 30 m. |
| 28 Nov 2026 10:53 | [#8 Add tuner profiles for SWR colors](https://github.com/Guru-RF/sommerwire/pull/8) · [Merge 7f3f4d48](https://github.com/Guru-RF/sommerwire/commit/7f3f4d48) | No-tuner, internal-tuner and external-tuner thresholds colour the existing SWR values in the readout, band buttons and sweep summary. |
| 28 Nov 2026 11:34 | [#9 Share editable antenna models by link](https://github.com/Guru-RF/sommerwire/pull/9) · [Merge f3d0362d](https://github.com/Guru-RF/sommerwire/commit/f3d0362d) | Share the editable model in a URL fragment. Opening the link validates the model and recalculates its results locally. |
| 28 Nov 2026 12:41 | [#10 Add RF.Guru and Koen themes and expand project credits](https://github.com/Guru-RF/sommerwire/pull/10) · [Merge dd208e61](https://github.com/Guru-RF/sommerwire/commit/dd208e615548cde7b6adf82e67ebc46e0d1faf41) | RF.Guru became the default theme, with Koen’s original look still selectable. Expanded the contributor credits and added dated change notes in Help. |
| 28 Nov 2026 12:42 | [#11 Record the merged theme contribution](https://github.com/Guru-RF/sommerwire/pull/11) · [Merge 12db47bc](https://github.com/Guru-RF/sommerwire/commit/12db47bc378acfeaa1dd99e045eebaba6318a29e) | Recorded #10’s merge in this ledger. |
| 28 Nov 2026 13:01 | [#12 Use RF.Guru styling and open on EFOC29](https://github.com/Guru-RF/sommerwire/pull/12) · [Merge 648009e4](https://github.com/Guru-RF/sommerwire/commit/648009e438b2c0addb72b5f8904d4cfc86932963) | Removed theme switching and edition version labels, kept dated site changes, and made the eight-band RF.Guru EFOC29 preset the default when no shared model is supplied. |
| 28 Nov 2026 13:21 | [#14 Embed the rotating antenna and align band cards](https://github.com/Guru-RF/sommerwire/pull/14) · [Merge c7bbab48](https://github.com/Guru-RF/sommerwire/commit/c7bbab48281a7f2e644252f6ad498e6499384d21) | Added a read-only embedded 3D view using existing share links and aligned the dashboard’s band cards below their heading. |
| 28 Nov 2026 15:49 | [#16 Improve the Sommerwire phone layout](https://github.com/Guru-RF/sommerwire/pull/16) · [Merge ae7de18a](https://github.com/Guru-RF/sommerwire/commit/ae7de18a2b35acbd16973cdbaa60e70201e7e3ea) | Improved the full app on phones with larger controls, sticky section tabs, readable results and touch-friendly 3D editing. |
| 28 Nov 2026 16:44 | [#18 Add local MCP, callsign plates and fork licence scope](https://github.com/Guru-RF/sommerwire/pull/18) · [Merge 955d4c41](https://github.com/Guru-RF/sommerwire/commit/955d4c4187d27e26a81246b07904a016dfa1472e) | Added the read-only local MCP tools and linked callsign plates; documented the Apache-2.0 offer for original RF.Guru contributions while preserving the upstream Unlicense and earlier grants. |

The fork’s proposal to withhold mixed-ground gain was recorded open on 27 November. It has no merge in the RF.Guru
history above. [Fork PR #1 and current status](https://github.com/Guru-RF/sommerwire/pull/1)

## Research on other branches

These studies are available at their recorded commits, outside the RF.Guru base documented above.

- 26 November 2026. Joeri’s radial and object-clearance study and review notes on `ai/sw-radial-study`. [Study at 96b46d4](https://github.com/Guru-RF/sommerwire/blob/96b46d481f1f5c9cd08d3012dd4e615419570503/RADIAL-STUDY.md)
- 27 November 2026. Joeri’s common-mode rejection ratio (CMRR) study for the EFHW transformer, choke and coax on `ai/sw-merged-latest`. [Study at 0eab2d5](https://github.com/Guru-RF/sommerwire/blob/0eab2d56cff9472c055516244b8a84efad35bf15/CMRR-STUDY.md)

## Maintenance

Review this ledger and the two footer disclosures on every merge using the [PR checklist](.github/PULL_REQUEST_TEMPLATE.md).
Compare the [live RF.Guru merge list](https://github.com/Guru-RF/sommerwire/pulls?q=is%3Apr+is%3Amerged+base%3Amain)
with `git log --first-parent origin/main`. For one PR, `gh pr view <number> -R <owner>/sommerwire --json state,mergedAt,mergeCommit,url`
reads its GitHub record. Record each PR’s repository, number, contribution and observed state.
Once merged, record its UTC date and merge commit at the next ledger update. For a closed upstream proposal,
link the maintainer’s implementation before crediting adoption. Update the relevant person’s footer summary when
the work changes that account. GitHub supplies the live audit trail while this file preserves the reviewed attribution.
