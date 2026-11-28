#!/usr/bin/env node
/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* Sommerwire MCP server: local, stdio, read-only. Four tools, all without side effects: validate_model, solve,
 * share_link and export_maa. No network, no files written, no paths or commands taken from a client.
 * Run:  node mcp/src/server.js   (an MCP client starts it; it speaks JSON-RPC on stdin/stdout, logs on stderr). */
import { Transform } from 'node:stream';
import { createRequire } from 'node:module';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { BUDGET, InputError, SourceShape, FreqArg, POLS, SIMULATION_NOTICE, DEFAULT_EXAMPLE_NAME, resolveSource, prepare, meshCheck,
  assumptions, flags, shareLink, exportMaa, jsonSafe, MAX_UNKNOWNS } from './core.js';
import { solveInWorker } from './solver.js';

const VERSION = createRequire(import.meta.url)('../package.json').version;
const log = (...a) => process.stderr.write('[sommerwire-mcp] ' + a.join(' ') + '\n');

/* ---------- results ---------- */
const ok = data => { const d = jsonSafe(data); return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }], structuredContent: d }; };
const refused = (msg, extra) => { const d = jsonSafe(Object.assign({ ok: false, error: msg }, extra)); return { isError: true, content: [{ type: 'text', text: JSON.stringify(d, null, 2) }], structuredContent: d }; };
// every tool error is a tool result (isError), never a crash; unexpected ones are logged with their stack
const guarded = fn => async (args, ctx) => {
  try { return await fn(args || {}, ctx); } catch (e) {
    if (e instanceof InputError) return refused(e.message);
    log('unexpected error:', (e && e.stack) || e);
    return refused('Internal error: ' + ((e && e.message) || String(e)));
  }
};
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const SOURCE_HELP = ' Give exactly one model source: model (Sommerwire model JSON, the share-link schema), share_link, maa (.maa text) or example (built-in, by name).';

const server = new McpServer({ name: 'sommerwire', title: 'Sommerwire antenna modeller', version: VERSION }, {
  instructions: 'Sommerwire models wire antennas with a thin-wire method-of-moments solver. Results are simulations for the model as given, not measurements: report the warnings, flags and assumptions with any figure. The tools are read-only and run locally; nothing is published or written.'
});

server.registerTool('validate_model', {
  title: 'Validate a Sommerwire model',
  description: 'Check a model without solving it: schema, share-link bounds, expressions, wire positions, ground, and the mesh the solver would build at each frequency (segments, unknowns, mesh warnings).' + SOURCE_HELP,
  inputSchema: z.strictObject(Object.assign({}, SourceShape, { frequency: FreqArg.optional().describe('Calculation frequency in MHz; default: the link\'s, else the design frequency.') })),
  annotations: READ_ONLY
}, guarded(async args => {
  const r = await resolveSource(args), p = prepare(r), mesh = meshCheck(p.num, p.freqs);
  const tooBig = mesh.filter(m => !m.fits);
  return ok({ ok: true, source: r.source, name: p.edit.name, design_frequency: +p.edit.freq, calc_frequency: r.calcFreq, bands: p.edit.bands, frequencies: p.freqs, view: r.view,
    counts: { wires: p.userWires, house_wires: p.houseWires, sources: p.num.sources.length, loads: p.num.loads.length, lines: p.num.tls.length },
    estimate: r.estimate, mesh,
    notes: tooBig.length ? ['At ' + tooBig.map(m => m.f + ' MHz').join(', ') + ' the mesh has more than ' + MAX_UNKNOWNS + ' unknowns: the solver will cut long passive wires coarser, or refuse the model if that is not enough.'] : [],
    assumptions: assumptions(p.edit, p.num), model: r.model });
}));

server.registerTool('solve', {
  title: 'Solve a Sommerwire model',
  description: 'Solve the model at the calculation frequency and, unless include_bands is false, at each of its band frequencies: feed impedance, SWR, gain, F/B, take-off angle, polarization and the page\'s angle summary, with every solver warning and the approximation flags. Simulation, not measurement.' + SOURCE_HELP,
  inputSchema: z.strictObject(Object.assign({}, SourceShape, {
    frequency: FreqArg.optional().describe('Calculation frequency in MHz; default: the link\'s, else the design frequency.'),
    include_bands: z.boolean().optional().describe('Also solve the model\'s band frequencies (default true).')
  })),
  annotations: READ_ONLY
}, guarded(async (args, ctx) => {
  const r = await resolveSource(args), p = prepare(r);
  const freqs = args.include_bands === false ? [r.calcFreq] : p.freqs.slice(0, BUDGET.frequencies);
  const t0 = Date.now();
  const results = await solveInWorker(p.num, freqs, { signal: ctx && ctx.mcpReq && ctx.mcpReq.signal });
  return ok({ ok: true, kind: 'simulation', notice: SIMULATION_NOTICE, source: r.source, name: p.edit.name, calc_frequency: r.calcFreq, frequencies: freqs,
    assumptions: assumptions(p.edit, p.num), model_comment: p.edit.comment || null,
    results: results.map(x => (x.error ? { f: x.f, error: x.error } : Object.assign({ flags: flags(x) }, x))),
    elapsed_ms: Date.now() - t0 });
}));

server.registerTool('share_link', {
  title: 'Make a Sommerwire share link',
  description: 'Encode the model, the calculation frequency and the pattern view as a https://sommerwire.app/#sw=… link that opens the model in the browser app. Made locally; nothing is uploaded.' + SOURCE_HELP,
  inputSchema: z.strictObject(Object.assign({}, SourceShape, {
    frequency: FreqArg.optional().describe('Calculation frequency in MHz the link opens with; default: the link\'s, else the design frequency.'),
    pol: z.enum(POLS).optional().describe('Pattern view the link opens with (tot, h, v, hv, all).')
  })),
  annotations: READ_ONLY
}, guarded(async args => {
  const r = await resolveSource(args);
  prepare(r);
  return ok(Object.assign({ ok: true, source: r.source }, await shareLink(r, args.pol)));
}));

server.registerTool('export_maa', {
  title: 'Export a Sommerwire model as .maa',
  description: 'Return the model as MMANA-GAL .maa text, exactly as the app\'s Save .maa writes it, with a report of what the .maa format loses (soil, ground method, bands, expressions, Sommerwire-only extensions). Returns text only; writes no file.' + SOURCE_HELP,
  inputSchema: z.strictObject(Object.assign({}, SourceShape, { frequency: FreqArg.optional().describe('Calculation frequency in MHz (reported as lost when it differs from the design frequency).') })),
  annotations: READ_ONLY
}, guarded(async args => {
  const r = await resolveSource(args);
  return ok(Object.assign({ ok: true, source: r.source }, exportMaa(r)));
}));

/* ---------- stdio, with a cap on one message ---------- */
// Only complete lines reach the transport. A line longer than BUDGET.messageBytes is dropped as it streams in (never
// buffered past the cap) and answered with a JSON-RPC error; the session stays open.
function lineCap(max, onDrop) {
  let held = [], len = 0, dropping = false;
  return new Transform({
    transform(chunk, enc, cb) {
      const out = [];
      let start = 0;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] !== 10) continue;
        if (dropping) onDrop();
        else if (len + i + 1 - start > max) onDrop();
        else { held.push(chunk.subarray(start, i + 1)); out.push(Buffer.concat(held)); }
        held = []; len = 0; dropping = false; start = i + 1;
      }
      const rest = chunk.subarray(start);
      if (!dropping && rest.length) {
        if (len + rest.length > max) { dropping = true; held = []; len = 0; }
        else { held.push(Buffer.from(rest)); len += rest.length; }
      }
      cb(null, out.length ? Buffer.concat(out) : undefined);
    }
  });
}
const stdin = process.stdin.pipe(lineCap(BUDGET.messageBytes, () => {
  log('dropped a message larger than ' + BUDGET.messageBytes + ' bytes');
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Message larger than ' + BUDGET.messageBytes + ' bytes; it was dropped.' } }) + '\n');
}));
const transport = new StdioServerTransport(stdin, process.stdout, { maxBufferSize: BUDGET.messageBytes * 2 });
transport.onerror = e => log('transport error:', (e && e.message) || e);
process.on('uncaughtException', e => log('uncaught:', (e && e.stack) || e));
process.on('unhandledRejection', e => log('unhandled rejection:', (e && e.stack) || e));
await server.connect(transport);
process.stdin.on('end', () => process.exit(0));
log('ready (v' + VERSION + ', default example "' + DEFAULT_EXAMPLE_NAME + '", solve budget ' + BUDGET.solveMs / 1000 + ' s, ' + BUDGET.concurrency + ' at a time)');
