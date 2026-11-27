# Sommerwire contribution history

The pull-request history of the contributions by **[ON6URE](https://on6ure.be) Joeri Van Dooren** ([RF.Guru](https://shop.rf.guru))
to Sommerwire, from the first pull request to the current verified work. Sommerwire was created and is maintained by
**ON9PK Koen Van den Heuvel**; this file only records contributions, it does not transfer or share ownership of the project.

- **Upstream:** [KoenVdH/sommerwire](https://github.com/KoenVdH/sommerwire) (the maintainer's repository)
- **Fork:** [Guru-RF/sommerwire](https://github.com/Guru-RF/sommerwire) (where the contributions are developed)

Compiled from read-only `gh` (pull-request states and timestamps on both repositories) and `git` (commit hashes and
dates). Every entry links to its record; statuses are as recorded on GitHub. Nothing here claims authorship or ownership
beyond what the linked record shows. Dates are UTC.

**Status legend**

| Status | Meaning |
|---|---|
| **Merged** | The pull request was merged as proposed. |
| **Independently adopted** | The pull request itself was closed unmerged; the maintainer addressed the same point in his own way (linked commit). |
| **Unmerged** | The pull request was closed without merging, or is still open. |
| **Research** | Study or review notes on a branch, recorded for the record only; not proposed for merging. |

## Chronology

| Date | Work | Record | Status |
|---|---|---|---|
| 2026-11-26 | Withhold misleading gain for mixed real-ground models (mirror-solved currents with a real-ground pattern) | [upstream PR #1](https://github.com/KoenVdH/sommerwire/pull/1), closed unmerged 20:04 | **Independently adopted**: the maintainer's [v1.1.1](https://github.com/KoenVdH/sommerwire/commit/8a71c60c) marks (≈) and limits such gain instead; the help [thanks Joeri van Dooren for finding this](help.html#mixgain) |
| 2026-11-26 | Invalidate stale sweep results after model edits | [upstream PR #2](https://github.com/KoenVdH/sommerwire/pull/2), merged 20:59 ([merge](https://github.com/KoenVdH/sommerwire/commit/7593c0c4)) | **Merged** |
| 2026-11-26 | Reject unsupported below-plane wires outside the contact tolerance | [upstream PR #6](https://github.com/KoenVdH/sommerwire/pull/6), merged 20:59 ([merge](https://github.com/KoenVdH/sommerwire/commit/c142d9d9)) | **Merged** |
| 2026-11-26 | Clarify complex-image approximation limits | [upstream PR #4](https://github.com/KoenVdH/sommerwire/pull/4), closed unmerged 21:06 | **Independently adopted**: [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9), "review suggestions from Joeri van Dooren (pull requests 4, 5, 7 and 8)" |
| 2026-11-26 | Report effective segment counts and guide mesh refinement | [upstream PR #5](https://github.com/KoenVdH/sommerwire/pull/5), closed unmerged 21:07 | **Independently adopted**: same [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) |
| 2026-11-26 | Preserve independent NEC benchmark runs and scope DX Commander evidence | [upstream PR #7](https://github.com/KoenVdH/sommerwire/pull/7), closed unmerged 21:07 | **Independently adopted**: same [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) |
| 2026-11-26 | Scope modeling and validation claims to the tested cases | [upstream PR #8](https://github.com/KoenVdH/sommerwire/pull/8), closed unmerged 21:07 | **Independently adopted**: same [v1.2.0](https://github.com/KoenVdH/sommerwire/commit/a65521f9) |
| 2026-11-26 | Radial and object-clearance study with review notes | [RADIAL-STUDY.md](https://github.com/Guru-RF/sommerwire/blob/ai/sw-radial-study/RADIAL-STUDY.md), commit [96b46d4](https://github.com/Guru-RF/sommerwire/commit/96b46d4) on branch `ai/sw-radial-study` | **Research** |
| 2026-11-27 | Common-mode rejection ratio (CMRR) study | [CMRR-STUDY.md](https://github.com/Guru-RF/sommerwire/blob/ai/sw-merged-latest/CMRR-STUDY.md), commit [0eab2d5](https://github.com/Guru-RF/sommerwire/commit/0eab2d5) "Add CMRR study (research only)" on branch `ai/sw-merged-latest` | **Research** |
| 2026-11-27 | Integrate the RF.Guru presets and the polarization display: the RF.Guru EFHW16080 and EFHW8040 inverted-L examples with sourced dimensions and dual-band results, the Horizontal + vertical pattern view, the angle summary and RDF, the pattern-wide polarization labels, the editor far-field views, and the regression tests for these (`node --test tests/`) | [fork PR #2](https://github.com/Guru-RF/sommerwire/pull/2), merged 11:51 into `Guru-RF/sommerwire` main ([merge](https://github.com/Guru-RF/sommerwire/commit/7ad3b3f5)) | **Merged** (fork); not present upstream as of upstream main [0b99051a](https://github.com/KoenVdH/sommerwire/commit/0b99051a) (2026-11-27) |
| 2026-11-27 | Show the H and V gain peaks (H peak, V peak, low-angle V 5–30° and high-angle H 60–90° tiles) and document the contributions (this file, the attribution checklist and the contributor credits), with their regression tests | [fork PR #3](https://github.com/Guru-RF/sommerwire/pull/3) "Show H/V gain peaks and document contributions", merged 13:49 into `Guru-RF/sommerwire` main ([merge](https://github.com/Guru-RF/sommerwire/commit/11e00cfc)) | **Merged** (fork) — the current verified work; not present upstream as of upstream main [0b99051a](https://github.com/KoenVdH/sommerwire/commit/0b99051a) (2026-11-27) |
| 2026-11-27 | RF.Guru EFOC29 example (29 m flat top, 4:1 unun, 12 m coax return to an ideal choke, seven band frequencies 80–10 m), with its regression tests | branch `ai/sw-efoc29` from fork main [11e00cfc](https://github.com/Guru-RF/sommerwire/commit/11e00cfc); not yet committed, no pull request yet | **Unmerged** (not yet proposed) |
| open | Withhold misleading gain for mixed real-ground models (same finding as upstream PR #1, kept open in the fork) | [fork PR #1](https://github.com/Guru-RF/sommerwire/pull/1) | **Unmerged** (open) |

## Also acknowledged in the help

Review contributions recorded in the maintainer's own texts, not pull requests:

- the complex-image near-ground comparisons — help, [ground models](help.html#m-ground): "Thanks to Joeri van Dooren for these comparisons."
- the mixed mirror/real-ground gain finding — help, [gain with the perfect mirror](help.html#mixgain): "Thanks to Joeri van Dooren for finding this."
- the buried-radials limitation — help, [buried radials](help.html#buried): "Thanks to Joeri van Dooren for pointing this out."
- the advice on objects near the antenna — help, [objects near the antenna](help.html#m-near): "Thanks to Joeri van Dooren for this advice."
- the copper/lossless mix-up in the first DX Commander comparison — help, [comparison with NEC-2](help.html#v-nec): "Joeri van Dooren spotted this."
- the nec2c comparison-script fixes — [validation/nec2c/README.md](validation/nec2c/README.md): "These script fixes follow suggestions by Joeri van Dooren."

## Maintenance

Review and, when a pull request changes state or a new one appears, update this file **per merge**, following the
checklist in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Record only what `gh` and `git`
show: PR number, repository, title, date, state and the linked merge or adoption commit. This is a manual checklist;
no automation writes to this repository.
