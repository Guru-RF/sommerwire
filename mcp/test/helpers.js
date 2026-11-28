// Test helpers: start the real server over stdio with the official SDK client, or talk raw JSON-RPC to it.
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export const MCP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(MCP_DIR, '..');
export const SERVER = path.join(MCP_DIR, 'src', 'server.js');

export async function connect(env = {}) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], cwd: MCP_DIR, env: Object.assign({ PATH: process.env.PATH }, env), stderr: 'pipe' });
  const client = new Client({ name: 'sommerwire-mcp-test', version: '0.0.0' });
  await client.connect(transport);
  return { client, transport, close: () => client.close() };
}
// call a tool; the structured result (the server sends the same JSON as text)
export async function call(client, name, args, opts) {
  const r = await client.callTool({ name, arguments: args }, opts);
  const text = r.content[0].text;
  // the server's own results are JSON; the SDK's schema refusals ("Input validation error: …") are plain text
  let data;
  try { data = JSON.parse(text); } catch (e) { assert.ok(r.isError, 'non-JSON text only on errors'); data = { error: text }; }
  return { isError: !!r.isError, data, raw: r };
}

// raw JSON-RPC lines over stdio, for what an SDK client would not send (old protocol versions, oversized lines)
export function rawServer(env = {}, nodeArgs = []) {
  const p = spawn(process.execPath, nodeArgs.concat([SERVER]), { cwd: MCP_DIR, env: Object.assign({ PATH: process.env.PATH }, env), stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const waiting = [], got = [];
  p.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);   // every stdout line must be JSON-RPC
      const w = waiting.findIndex(x => x.pred(msg));
      if (w >= 0) waiting.splice(w, 1)[0].resolve(msg); else got.push(msg);
    }
  });
  p.stderr.resume();
  const next = pred => {
    const i = got.findIndex(pred);
    if (i >= 0) return Promise.resolve(got.splice(i, 1)[0]);
    return new Promise(resolve => waiting.push({ pred, resolve }));
  };
  return {
    proc: p,
    send: obj => p.stdin.write((typeof obj === 'string' ? obj : JSON.stringify(obj)) + '\n'),
    reply: id => next(m => m.id === id),
    next,
    close: () => new Promise(res => { p.once('exit', res); p.stdin.end(); })
  };
}

// The app's own code, loaded the way the repository's tests load it (tests/efoc29.test.js), independent of mcp/src
export function appForParity() {
  const require = createRequire(import.meta.url);
  ['engine.js', 'structgen.js', 'hexgen.js', 'efhwgen.js', 'share.js'].forEach(f => require(path.join(ROOT, f)));
  const { MM, WMStruct, SWShare } = globalThis;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const section = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); return html.slice(i, j); };
  const ctx = vm.createContext({ MM, WMStruct, hexbeamFromTable: globalThis.hexbeamFromTable, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29: globalThis.rfGuruEfoc29,
    clone: o => JSON.parse(JSON.stringify(o)), $: () => ({ appendChild() {} }), document: { createElement: () => ({}) } });
  vm.runInContext(section('const NF_MODES', '/* ---------------- worker') + section('// G3TXQ dimension table', "$('#exampleSel').onchange"), ctx);
  const EXAMPLES = vm.runInContext('EXAMPLES', ctx);
  const plain = v => JSON.parse(JSON.stringify(v));
  return {
    MM, SWShare, EXAMPLES, html,
    build: ex => plain(vm.runInContext('(ex => ex.build === "hextable" ? hexTableModel(ex.centre, ex.tuned) : ex.maa ? modelFromMAA(ex.maa) : clone(ex))', ctx)(ex)),
    numeric: m => { ctx.__m = JSON.parse(JSON.stringify(m)); return plain(vm.runInContext('S.model = normalize(__m); numericModel()', ctx)); },
    fromMAA: t => plain(vm.runInContext('modelFromMAA', ctx)(t))
  };
}

export const dipole = (extra = {}) => Object.assign({ name: 'Test dipole', freq: 14.15,
  wires: [{ x1: 0, y1: '-R/4', z1: 10, x2: 0, y2: 'R/4', z2: 10, r: 1, seg: -1 }], sources: [{ pos: 'w1c', phase: 0, mag: 1 }],
  ground: { type: 2, eps: 13, sigma: 0.005 } }, extra);
