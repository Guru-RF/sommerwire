// The stdio protocol with a real client: initialize, tools/list, tools/call through the official SDK client, an older
// client's handshake as raw JSON-RPC, and messages the server must contain (oversized, malformed, unknown).
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, call, rawServer, ROOT } from './helpers.js';

const TOOLS = ['validate_model', 'solve', 'share_link', 'export_maa'];

test('SDK client: initialize, list the four read-only tools, call each', async () => {
  const { client, close } = await connect();
  try {
    assert.equal(client.getServerVersion().name, 'sommerwire');
    assert.ok(client.getServerCapabilities().tools, 'tools capability');
    assert.equal(client.getNegotiatedProtocolVersion(), '2025-11-25', 'the SDK client and server agree on the latest version they share');
    assert.match(client.getInstructions(), /not measurements/);
    console.log('negotiated protocol version:', client.getNegotiatedProtocolVersion());
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), TOOLS.slice().sort());
    for (const t of tools) {
      assert.deepEqual(t.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, t.name);
      assert.equal(t.inputSchema.type, 'object');
      assert.equal(t.inputSchema.additionalProperties, false, t.name + ': unknown arguments refused');
      for (const k of ['model', 'share_link', 'maa', 'example']) assert.ok(t.inputSchema.properties[k], t.name + ' takes ' + k);
    }
    const ex = { example: 'Half-wave dipole, 20 m' };
    const v = await call(client, 'validate_model', ex); assert.equal(v.isError, false); assert.equal(v.data.ok, true);
    const s = await call(client, 'solve', ex); assert.equal(s.isError, false); assert.equal(s.data.kind, 'simulation');
    assert.deepEqual(s.raw.structuredContent, s.data, 'structured content = text content');
    const l = await call(client, 'share_link', ex); assert.equal(l.isError, false); assert.match(l.data.url, /^https:\/\/sommerwire\.app\/#sw=1\.d\./);
    const m = await call(client, 'export_maa', ex); assert.equal(m.isError, false); assert.match(m.data.maa, /\*\*\*Wires\*\*\*/);
  } finally { await close(); }
});

test('raw JSON-RPC: an older client (2025-06-18) initializes and lists tools; stdout carries only JSON-RPC', async () => {
  const s = rawServer();
  try {
    s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '0' } } });
    const init = await s.reply(1);
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'sommerwire');
    s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    s.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.deepEqual((await s.reply(2)).result.tools.map(t => t.name).sort(), TOOLS.slice().sort());
    // unknown tool, unknown method, bad arguments: answered, not fatal
    s.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'rm_rf', arguments: {} } });
    const r3 = await s.reply(3); assert.ok(r3.error || r3.result.isError, 'unknown tool refused');
    s.send({ jsonrpc: '2.0', id: 4, method: 'shell/exec', params: {} });
    assert.ok((await s.reply(4)).error, 'unknown method refused');
    s.send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'solve', arguments: { example: 'Half-wave dipole, 20 m', path: '/etc/passwd' } } });
    const r5 = await s.reply(5); assert.ok(r5.error || r5.result.isError, 'unknown argument refused');
    // malformed JSON, then an oversized line (2 MiB), then the session still answers
    s.send('{"jsonrpc":"2.0","id":6,"method":');
    s.send(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'validate_model', arguments: { maa: 'x'.repeat(2 * 1024 * 1024) } } }));
    const dropped = await s.next(m => m.id === null && m.error && /larger than/.test(m.error.message));
    assert.equal(dropped.error.code, -32600);
    s.send({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'validate_model', arguments: { example: 'Half-wave dipole, 20 m' } } });
    const r8 = await s.reply(8);
    assert.equal(r8.result.isError, undefined); assert.equal(r8.result.structuredContent.ok, true);
  } finally { await s.close(); }
});

// Node's permission model (network restricted from Node 25): read access to the repository and worker threads only;
// no network, no file writes, no child processes. The server initializes and solves under it.
const major = +process.versions.node.split('.')[0];
test('runs with read-only file access, no network, no child processes (Node permission model)', { skip: major < 25 && 'needs Node 25+ for network restriction' }, async () => {
  const s = rawServer({}, ['--permission', '--allow-fs-read=' + ROOT, '--allow-worker']);
  try {
    s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'raw', version: '0' } } });
    assert.equal((await s.reply(1)).result.serverInfo.name, 'sommerwire');
    s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'solve', arguments: { example: 'Half-wave dipole, 20 m' } } });
    const r = await s.reply(2);
    assert.equal(r.result.structuredContent.ok, true);
    assert.ok(r.result.structuredContent.results[0].swr > 1);
    s.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'share_link', arguments: { example: 'Half-wave dipole, 20 m' } } });
    assert.match((await s.reply(3)).result.structuredContent.url, /#sw=1\.d\./);
  } finally { await s.close(); }
});

test('raw JSON-RPC: the 2025-03-26 and 2024-11-05 handshakes are accepted as such', async () => {
  for (const v of ['2025-03-26', '2024-11-05']) {
    const s = rawServer();
    try {
      s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v, capabilities: {}, clientInfo: { name: 'raw', version: '0' } } });
      assert.equal((await s.reply(1)).result.protocolVersion, v);
      s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'validate_model', arguments: { example: 'Half-wave dipole, 20 m' } } });
      assert.equal((await s.reply(2)).result.structuredContent.ok, true, v);
    } finally { await s.close(); }
  }
});
