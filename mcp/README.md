# Sommerwire MCP server

A local, read-only [Model Context Protocol](https://modelcontextprotocol.io) server for Sommerwire. An MCP client
(Claude Code, Claude Desktop or any other stdio client) starts it as a child process and can then check, solve,
share and export Sommerwire antenna models through four tools. It runs the same engine and the same model code as the
browser app, so its figures are the figures the page shows.

- **Local and stdio only.** No HTTP listener, no hosted transport.
- **Read-only.** No tool writes a file, takes a path, runs a command, publishes or posts anything, or opens a
  network connection. Results come back as tool output only.
- **No secrets or accounts.** Nothing to configure for it to work.
- **Simulation, not measurement.** Every `solve` result says so and lists the model's assumptions, the solver's
  warnings and the approximation flags.

## Tools

Every tool takes **exactly one model source**:

| argument | what it is |
|---|---|
| `model` | a Sommerwire model as JSON: the share-link model schema (`name`, `freq`, `wires`, `sources`, `loads`, `tls`, `objects`, `seg`, `ground`, `material`, `z0`, `ins`, `boom`, `bands`, `comment`), with cells as numbers or expressions (`R/4`) |
| `share_link` | a Sommerwire share link (`https://sommerwire.app/#sw=1.d.…`, with or without `?embed=1`) or just its `#sw=` fragment |
| `maa` | the text of an MMANA-GAL `.maa` file |
| `example` | a built-in example by its menu name; the app opens with `RF.Guru EFOC29 end-fed off-centre, 80–10 m, 4:1, flat top` |

| tool | does | extra arguments |
|---|---|---|
| `validate_model` | checks the model without solving: schema, share-link bounds, expressions, wire positions, ground, and the mesh the solver would build at each frequency (segments, unknowns, mesh warnings); returns the cleaned model and its assumptions | `frequency` |
| `solve` | solves at the calculation frequency and, unless `include_bands: false`, at each of the model's bands: feed R + jX and SWR (first source), gain (total, H, V), F/B, take-off elevation and azimuth, polarization, the page's angle summary (RDF, low/high-angle windows, H/V peaks), every solver warning, and `flags` | `frequency`, `include_bands` |
| `share_link` | makes a `https://sommerwire.app/#sw=1.d.…` link that opens the model in the app (made locally; the link carries the model, the calculation frequency and the pattern view, never results) | `frequency`, `pol` (`tot`, `h`, `v`, `hv`, `all`) |
| `export_maa` | returns the `.maa` text exactly as the app's **Save .maa** writes it, plus `format_loss`: what the file does not keep | `frequency` |

The calculation frequency is `frequency` if given, else the share link's, else the model's design frequency.

### What a result means

`solve` returns `kind: "simulation"`, a `notice`, `assumptions` (ground and soil, wire material, ideal transformers,
lines, loads, insulation, boom, houses, segmentation) and `model_comment` (the model author's own description, shown as
given and not checked). Each entry of `results` carries the page's own result fields (`R`, `X`, `swr`, `z0`, `gain`,
`gainH`, `gainV`, `fb`, `el`, `az`, `pol`, `approx`, `capDb`, `N`, `nseg`, `sources`, `Pin`, `earthed`, `sum`,
`warnings`) and a `flags` summary:

| flag | meaning |
|---|---|
| `perfect_mirror_fallback` | a wire touches real ground, so the impedance was solved over a perfect mirror (as MMANA does) while the pattern uses real ground: gain is approximate |
| `gain_capped_db` | gains were lowered by this many dB because the pattern held more than the input power |
| `earthed_wires` | wires connected to the ground |
| `negative_resistance` | the feed resistance came out negative: not physical |
| `non_finite_result` | impedance or gain is not a finite number |
| `coarse_sky_grid`, `over_unity` | the angle summary's grid misses the lobe, or holds over 5 % more power than supplied |
| `uncertain` | any of the above, or the page's own "uncertain" mark |
| `warnings` | how many solver warnings there are (the texts are in `warnings`, verbatim) |

An SWR of a total mismatch is returned as the string `"Infinity"`; JSON has no infinite numbers.

### What `.maa` loses

`export_maa` lists, in `format_loss`, what reopening the file would not give back: the soil (`.maa` keeps no
permittivity or conductivity), the real-ground method, the band list, the calculation frequency and pattern view,
expressions (written as their values at the design frequency), materials MMANA-GAL has no match for, and the
Sommerwire-only extensions (transformer ratios, trap extras, lines, insulation, boom, houses) that travel as
`Sommerwire …` comment lines which Sommerwire reads back and MMANA-GAL ignores. It also reopens its own output and
compares the solver input, so any other change (for example a phase with more decimals than `.maa` keeps) is
reported too. An empty list means the file reopens in Sommerwire as the same model.

## Limits

Every input is checked before anything heavy is built, with the share-link bounds (`share.js`), and refused with a
reason (a tool error) rather than partly used:

| what | limit |
|---|---|
| one JSON-RPC message on stdin | 1 MiB (a longer line is dropped as it streams in and answered with a JSON-RPC error; the session stays open) |
| `model` as JSON, `.maa` text | 512 KiB |
| `share_link` | 64 000 characters of fragment |
| wires, sources, loads, lines, houses, bands | 3000, 64, 1000, 200, 8, 16; table cells 100 characters |
| frequency | 0.01 to 10 000 MHz |
| coordinates | 100 km |
| segments | about 25 000 at the highest frequency solved (estimated before any mesh is built) |
| house grid wires | 4000 |
| unknowns | 2500 (the engine's limit; long passive wires are coarsened first, with a warning) |
| frequencies per `solve` | the calculation frequency plus the model's bands (at most 17) |
| solve wall time | 120 s per call (`SOMMERWIRE_MCP_SOLVE_TIMEOUT_MS`, 1000 to 600000) |
| solves at a time | 1 (`SOMMERWIRE_MCP_MAX_SOLVES`, 1 to 4); a call beyond it is refused, not queued |
| solver heap | 512 MB per solve (`SOMMERWIRE_MCP_WORKER_HEAP_MB`, 64 to 4096) |

Models are strict: an unknown key anywhere is refused (not silently dropped), positions must be `w<N>b|c|e` on an
existing wire, every source/load/line value must be a finite number, and the ground type, ground method, material,
load type, roof, gutters, downpipes and boom settings must be supported values. Buried wires, wires without radius
and models without a source are refused before a solve starts. Each solve runs in its own worker thread, which is
terminated when its time runs out or the client cancels the request.

## Install

Node.js 20 or newer. From the repository root:

```bash
cd mcp
npm ci
```

This installs the pinned dependencies from `package-lock.json`: the official MCP TypeScript SDK v2 server package
(`@modelcontextprotocol/server` 2.4.0, the SDK's stable release line) and `zod` 4.6.7. The SDK client
(`@modelcontextprotocol/client` 2.4.0) is a development dependency, used by the tests only (`npm ci --omit=dev` leaves
it out). There is no build step: the server is plain JavaScript modules in `src/`. The browser app itself still has no
dependencies; nothing in `mcp/` is loaded by the page.

## Client configuration

Use absolute paths; replace `/path/to/sommerwire` with the repository folder.

**Claude Code** (add `--scope user` to make it available in every project):

```bash
claude mcp add sommerwire -- node /path/to/sommerwire/mcp/src/server.js
```

or a `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "sommerwire": { "command": "node", "args": ["/path/to/sommerwire/mcp/src/server.js"] }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`) and other stdio clients take the same `command` and `args`:

```json
{
  "mcpServers": {
    "sommerwire": {
      "command": "node",
      "args": ["/path/to/sommerwire/mcp/src/server.js"],
      "env": { "SOMMERWIRE_MCP_SOLVE_TIMEOUT_MS": "120000" }
    }
  }
}
```

**Optional hardening** with Node's permission model (Node 25 or newer also restricts the network): the server needs
read access to the repository and worker threads, nothing else.

```json
"args": ["--permission", "--allow-fs-read=/path/to/sommerwire", "--allow-worker", "/path/to/sommerwire/mcp/src/server.js"]
```

The server speaks JSON-RPC on stdin/stdout and logs to stderr. With SDK 2.4.0 it negotiates protocol version
`2025-11-25` with current clients and accepts the older `2025-06-18`, `2025-03-26` and `2024-11-05` handshakes.

## Worked example

Ask the client something like *"Validate and solve this 20 m dipole at 10 m over average ground, then give me a share
link and the .maa file"*. It calls the tools with:

```json
{ "model": { "name": "20 m dipole", "freq": 14.15, "material": 1,
    "wires": [{ "x1": 0, "y1": "-R/4*0.95", "z1": 10, "x2": 0, "y2": "R/4*0.95", "z2": 10, "r": 1, "seg": -1 }],
    "sources": [{ "pos": "w1c" }],
    "ground": { "type": 2, "eps": 13, "sigma": 0.005 } } }
```

`validate_model` (abridged):

```json
{ "ok": true, "frequencies": [14.15], "estimate": { "segments": 33, "houseWires": 0, "fMax": 14.15 },
  "mesh": [{ "f": 14.15, "segments": 26, "unknowns": 25, "warnings": [], "fits": true }] }
```

`solve` (abridged; figures rounded here, full precision in the result):

```json
{ "kind": "simulation", "notice": "Simulation, not measurement: …",
  "assumptions": ["Real ground: relative permittivity 13, conductivity 0.005 S/m, height offset 0 m; impedance method sommerfeld (homogeneous soil assumed).",
                  "Wire material: Copper.", "Feed impedance and SWR are those of the first source, against 50 ohm.", "…"],
  "results": [{ "f": 14.15, "R": 67.21, "X": -40.63, "swr": 2.104, "gain": 7.02, "fb": 0, "el": 29.5, "az": 0, "pol": "Horizontal",
                "flags": { "perfect_mirror_fallback": false, "uncertain": false, "warnings": 0, "…": "…" }, "warnings": [] }] }
```

`share_link` with `"pol": "h"` returns a 339-character `https://sommerwire.app/#sw=1.d.…` link that opens this
model in the app. `export_maa` returns `20 m dipole.maa` and reports one loss:

```json
{ "format_loss": ["Expressions are written as numbers at 14.15 MHz: w1.y1 = -R/4*0.95, w1.y2 = R/4*0.95."] }
```

The default example, `solve` with `{ "example": "RF.Guru EFOC29 end-fed off-centre, 80–10 m, 4:1, flat top" }`,
solves all eight bands (about 10 s here) with the SWRs pinned in `tests/efoc29.test.js`: 2.58, 2.86, 17.50, 3.13, 1.53,
5.88, 8.94 and 2.84, none with the perfect-mirror fallback. Like the app, it reports them as the model's figures for
the stated assumptions (ideal unun and choke, untrimmed 29 m), not as measurements.

## Tests

```bash
cd mcp
npm test            # node --test test/
```

The tests start the real server over stdio with the official SDK client: initialize, tools/list and tools/call of all
four tools; an older client's raw JSON-RPC handshake; unknown tools, methods and arguments, malformed and oversized
messages; the server under Node's permission model; EFOC29's eight bands against the pinned SWRs and against the
engine and page code loaded independently (as `tests/` loads them); ground-contact and complex-image warnings and
flags; the time budget (the worker is killed and the next call works) and the concurrency limit; strict-schema, share-bound and
ill-formed-model refusals; share links of every example decoded by `share.js` to the same solver input; `.maa` export
against the bundled model files and the format-loss report.

## How it reuses the app

`src/app.js` loads `engine.js`, `structgen.js`, `hexgen.js`, `efhwgen.js` and `share.js` unchanged into a `vm`
context, and takes the app's own model code from `index.html` by its section markers, the way the repository's tests
do: the examples, `normalize()` and `numericModel()`, the hexbeam table, `modelFromMAA()` and `maaFile()`, and the
worker's `packZ()` / `finish()`. Nothing in the browser files changed for the server. If those markers move,
`loadApp()` stops with a message naming the missing section, and the tests fail.

## Files

```
mcp/package.json, package-lock.json   pinned dependencies
mcp/src/server.js                     the MCP server: tools, stdio, message cap
mcp/src/core.js                       schemas, sources, validation, labels, share link, .maa export
mcp/src/solver.js, solve-worker.js    solves in a worker thread with time, heap and concurrency limits
mcp/src/app.js                        loads the app's code (above)
mcp/test/                             node --test, through the SDK client over stdio
```
