/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* The Sommerwire app code, loaded for Node without changing it.
 *
 * The browser files (engine.js, structgen.js, hexgen.js, efhwgen.js, share.js) run as they are, and the app's own
 * model helpers are taken from index.html: the examples, normalize() and numericModel() (the solver input), the
 * hexbeam table, modelFromMAA() and maaFile() (.maa open and save), and the worker's packZ() / finish() (the result
 * payload the page shows). They run in one vm context, the way the repository's tests load them, so the MCP server
 * computes exactly what the page computes. Nothing here reads anything but the repository's own files. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['engine.js', 'structgen.js', 'hexgen.js', 'efhwgen.js', 'share.js'];

function section(html, start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error('index.html no longer has the section "' + start + '"; the MCP loader needs updating.');
  return html.slice(i, j);
}

export function loadApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // only what the loaded code touches; no fs, process, require or network in the context
  const ctx = vm.createContext({
    CompressionStream, DecompressionStream, Blob, TextEncoder, TextDecoder, btoa, atob,
    console: { log() {}, warn() {}, error() {} },
    // hexTableModel and the menu code reference these only when the page builds DOM; stubs as in tests/
    $: () => ({ appendChild() {} }), document: { createElement: () => ({}) }
  });
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  const worker = section(html, 'const WORKER_SRC = `', '`;\nlet worker');
  const src = "'use strict';\n" +
    section(html, 'const NF_MODES', '/* ---------------- worker') +
    worker + '`;\n' +
    section(html, '// G3TXQ dimension table', "$('#exampleSel').onchange") +
    section(html, 'function maaFile()', 'function downloadMaa') + `
const PAY = new Function('self', 'MM', WORKER_SRC + '; return { packZ, finish };')({ postMessage() {} }, MM);
globalThis.__sommerwire = {
  EXAMPLES, DEFAULT_EXAMPLE, NF_MODES, clone, normalize, modelFromMAA, hexTableModel,
  numericModel: m => { S.model = m; try { return numericModel(); } finally { S.model = null; } },
  maaFile: m => { S.model = m; try { return maaFile(); } finally { S.model = null; } },
  buildExample: ex => (ex.build === 'hextable' ? hexTableModel(ex.centre, ex.tuned) : ex.maa ? modelFromMAA(ex.maa) : clone(ex)),
  packZ: PAY.packZ, finish: PAY.finish
};`;
  vm.runInContext(src, ctx, { filename: 'index.html (app sections)' });
  const app = ctx.__sommerwire;
  return { MM: ctx.MM, WMStruct: ctx.WMStruct, SWShare: ctx.SWShare, app, ctx };
}

// values from the vm context as plain objects of this realm
export const plain = v => JSON.parse(JSON.stringify(v));
