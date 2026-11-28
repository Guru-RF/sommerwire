/* Share links (share.js, index.html). Run from the repository root:  node --test tests/
 * 1. Round trip: every example (preset, generated and .maa-built), the bundled .maa files and an edited model come back
 *    as the same editable model, and the solver input (numericModel) and calculation frequency are identical.
 * 2. Resources: the segment estimate is an upper bound of the real mesh, and every example fits in a link.
 * 3. Untrusted links: malformed, unsupported, oversized and hostile links are refused with a ShareError before anything
 *    is loaded, and nothing outside the whitelist (such as __proto__) gets through.
 * 4. The page: ordinary start (no fragment, help anchors) loads the default example; a share link loads its model and
 *    calculates it; a bad link keeps the model and says why. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
['engine.js', 'hexgen.js', 'structgen.js', 'efhwgen.js', 'share.js'].forEach(f => require(path.join(ROOT, f)));
const { MM, WMStruct, SWShare } = globalThis;
const { ShareError, LIMITS } = SWShare;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function section(start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i);
  assert.ok(i >= 0 && j > i, 'section ' + start);
  return html.slice(i, j);
}
const plain = v => JSON.parse(JSON.stringify(v));

// the app's examples, normalize(), numericModel(), modelFromMAA() and hexTableModel(), in a sandbox
const app = vm.createContext({ MM, WMStruct, hexbeamFromTable: globalThis.hexbeamFromTable, rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29: globalThis.rfGuruEfoc29, clone: o => JSON.parse(JSON.stringify(o)), $: () => ({ appendChild() {} }), document: { createElement: () => ({}) } });
vm.runInContext(section('const NF_MODES', '/* ---------------- worker') + section('// G3TXQ dimension table', "$('#exampleSel').onchange"), app);
const EXAMPLES = vm.runInContext('EXAMPLES', app);
const build = ex => plain(vm.runInContext('(ex => ex.build === "hextable" ? hexTableModel(ex.centre, ex.tuned) : ex.maa ? modelFromMAA(ex.maa) : clone(ex))', app)(ex));
const solverInput = m => { app.__m = JSON.parse(JSON.stringify(m)); return plain(vm.runInContext('S.model = normalize(__m); numericModel()', app)); };
const fromFile = f => plain(vm.runInContext('modelFromMAA', app)(fs.readFileSync(path.join(ROOT, 'models', f), 'utf8')));

async function roundTrip(model, calcFreq, pol) {
  const hash = await SWShare.encode({ model, calcFreq, view: pol ? { pol } : {} });
  assert.match(hash, /^#sw=1\.d\.[A-Za-z0-9_-]+$/);
  return { hash, back: await SWShare.decode(hash) };
}
const refused = async (hash, re) => {
  await assert.rejects(SWShare.decode(hash), e => { assert.ok(e instanceof ShareError, 'ShareError, got ' + e); if (re) assert.match(e.message, re); return true; });
};
const b64 = buf => Buffer.from(buf).toString('base64url');
const raw = obj => '#sw=1.j.' + b64(JSON.stringify(obj));
const packed = obj => '#sw=1.d.' + b64(zlib.deflateRawSync(typeof obj === 'string' ? obj : JSON.stringify(obj)));
const dipole = () => ({ name: 'Dipole', freq: 14.15, wires: [{ x1: '0', y1: '-R/4', z1: '0', x2: '0', y2: 'R/4', z2: '0', r: '1', seg: '-1' }], sources: [{ pos: 'w1c', phase: 0, mag: 1 }] });
const payload = (model, extra) => Object.assign({ app: 'sommerwire', v: 1, f: 14.15, view: {}, model }, extra);

test('every example round-trips to the same solver input and calculation frequency', async () => {
  for (const ex of EXAMPLES) {
    const m = build(ex), f = (m.bands && m.bands[1]) || +m.freq;
    const { hash, back } = await roundTrip(m, f, ex.pol);
    assert.deepEqual(solverInput(back.model), solverInput(m), ex.name);
    assert.equal(back.calcFreq, f, ex.name);
    if (ex.pol) assert.equal(back.view.pol, ex.pol, ex.name);
    assert.ok(('https://koenvdh.github.io/sommerwire/' + hash).length <= LIMITS.link, ex.name + ': ' + hash.length + ' characters');
  }
});

test('opened .maa files round-trip, name and comment included', async () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'models')).filter(f => f.endsWith('.maa'))) {
    const m = fromFile(f), { back } = await roundTrip(m, +m.freq);
    assert.deepEqual(solverInput(back.model), solverInput(m), f);
    assert.equal(back.model.name, m.name); assert.equal(back.model.comment, m.comment);
  }
});

test('an edited model keeps every edit exactly: expressions, odd text, loads, lines, houses, insulation, boom', async () => {
  const m = build(EXAMPLES[0]);
  Object.assign(m, { name: 'Mine <img src=x onerror=alert(1)> & "quotes"', comment: 'line 1\nline 2 ünï ⚡ </textarea>', freq: 14.2, material: 2, z0: 75, bands: [14.1, 21.2] });
  m.wires[0].y2 = 'R/4+0.01*F'; m.wires[1].seg = '15'; m.wires[2].r = 'I/8';
  m.wires.push({ x1: '0', y1: '0', z1: '-1', x2: '0', y2: '0', z2: '-3', r: '2', seg: '-1' });
  m.sources.push({ pos: 'w4c', phase: 90, mag: '', ratio: '4' });
  m.loads = [{ pos: 'w4c', type: 2, L: 3.3, C: 47, Q: 200, Qc: 1000, Cp: 0.5, R: 0, X: 0 }];
  m.tls = [{ p1: 'w1c', p2: 'w2c', z0: 50, vf: 0.66, len: 'R/2', rev: true, loss: 1.2, lossF: 10 }];
  m.objects = [{ type: 'house', x: '0', y: '7', len: '10', wid: '8', eave: '5', ridge: '8', rot: '15', roof: 'metal', grid: '1', gutters: 'metal', pipes: 4, rEarth: 30 }];
  m.ins = { t: 0.5, er: 2.3, tand: 0.001, wires: '1-3' };
  m.boom = { d: 40, mount: 'insulated', axis: 'x' };
  m.ground = { type: 2, height: 12, eps: 5, sigma: 0.001, nf: 'complex' };
  m.seg = { dm1: 800, dm2: 80, sc: 2, ec: 1 };
  const { back } = await roundTrip(m, 21.2, 'hv');
  const normalize = vm.runInContext('normalize', app), norm = x => plain(normalize(JSON.parse(JSON.stringify(x))));
  assert.deepEqual(norm(back.model), norm(Object.assign({}, m)));
  assert.deepEqual(solverInput(back.model), solverInput(m));
  assert.equal(back.calcFreq, 21.2); assert.equal(back.view.pol, 'hv');
});

test('the segment estimate bounds the real mesh of every example at its highest solved frequency', () => {
  for (const ex of EXAMPLES) {
    const m = build(ex), s = SWShare.sanitize({ model: m });
    const num = solverInput(m), fMax = s.estimate.fMax, mesh = MM.buildMesh(num, fMax);
    assert.ok(mesh.segs.length <= s.estimate.segments, ex.name + ': ' + mesh.segs.length + ' > ' + s.estimate.segments);
    assert.ok(s.estimate.segments <= LIMITS.segments, ex.name);
  }
});

test('ordinary fragments are not share links', () => {
  for (const h of ['', '#', '#h-start', '#mixgain', '#m-maa', '#sw', '#sw1', '#SW=1.d.x', 'sw=1.d.x', null, undefined]) assert.equal(SWShare.isShareHash(h), false, String(h));
  assert.equal(SWShare.isShareHash('#sw=anything'), true);
});

test('malformed and unsupported links are refused with a reason', async () => {
  await refused('#h-start', /not a Sommerwire share link/);
  await refused('#sw=', /unknown layout/);
  await refused('#sw=1.d.', /does not unpack|not readable/);
  await refused('#sw=1.d.@@@', /unknown layout/);
  await refused('#sw=1.d.abc$', /unknown layout/);
  await refused('#sw=2.d.AAAA', /newer Sommerwire/);
  await refused('#sw=0.d.AAAA', /Unsupported link version/);
  await refused('#sw=1.x.AAAA', /unknown encoding/);
  await refused('#sw=1.d.' + b64(Buffer.from('not deflate at all')), /does not unpack/);
  const good = await SWShare.encode({ model: dipole() });
  for (const k of [0.3, 0.6, 0.9]) await refused(good.slice(0, Math.floor(good.length * k)), /damaged/);
  await refused('#sw=1.j.' + b64('{"app":"sommerwire", "v":1, '), /not readable/);
  await refused('#sw=1.j.' + b64(Buffer.from([0xff, 0xfe, 0x7b])), /not readable/);
  await refused(raw([1, 2]), /does not hold a Sommerwire model/);
  await refused(raw({ app: 'other', v: 1, model: dipole() }), /does not hold/);
  await refused(raw(payload(dipole(), { v: 7 })), /newer Sommerwire/);
  await refused(raw(payload(null)), /no model/);
});

test('oversized links and decompression bombs stop at the bounds', async () => {
  await refused('#sw=1.d.' + 'A'.repeat(LIMITS.fragment), /longer than/);
  // about 1000:1 deflate: a short link that would unpack to 20 MB
  const bomb = packed(' '.repeat(20 * 1024 * 1024));
  assert.ok(bomb.length < LIMITS.fragment, 'bomb fits in the fragment limit');
  await refused(bomb, /unpacks to more than/);
  await refused(raw(payload(dipole(), { pad: 'x'.repeat(LIMITS.json) })).slice(0, LIMITS.fragment - 1), /not readable|longer/);
  const many = dipole(); many.wires = Array.from({ length: LIMITS.wires + 1 }, () => many.wires[0]);
  await refused(packed(payload(many)), /at most 3000/);
  // too big to share: the encoder refuses too, so Share can point to Save .maa
  await assert.rejects(SWShare.encode({ model: many }), ShareError);
});

test('schema and resource checks refuse hostile values before anything is solved', async () => {
  const bad = async (edit, re) => { const m = dipole(); const p = payload(m); edit(m, p); await refused(packed(p), re); };
  await bad(m => { m.wires = 'nope'; }, /must be a list/);
  await bad(m => { m.wires = []; }, /no wires/);
  await bad(m => { delete m.wires[0].x2; }, /has no x2/);
  await bad(m => { m.wires[0].x1 = { toString: 1 }; }, /must be text/);
  await bad(m => { m.wires[0].y2 = '('.repeat(LIMITS.cell + 1); }, /longer than/);
  await bad(m => { m.wires[0].seg = '1e9'; }, /asks for/);
  await bad(m => { m.wires[0].x2 = '1e7'; }, /beyond/);
  await bad(m => { m.wires[0].y2 = 'R*1000'; m.wires[0].y1 = '-R*1000'; m.seg = { dm2: 2000 }; }, /segments/);
  await bad(m => { m.freq = 0; }, /frequency/);
  await bad(m => { m.freq = 'R'; }, /frequency/);
  await bad((m, p) => { p.f = -3; }, /calculation frequency/);
  await bad(m => { m.bands = Array(LIMITS.bands + 1).fill(14); }, /at most/);
  await bad(m => { m.bands = [1e9]; }, /frequency/);
  await bad(m => { m.seg = { sc: -1 }; }, /Segmentation sc/);
  await bad(m => { m.seg = { dm2: 1e7 }; }, /Segmentation dm2/);
  await bad(m => { m.ground = { type: 7 }; }, /Ground type/);
  await bad(m => { m.ground = { nf: 'magic' }; }, /Ground method/);
  await bad(m => { m.material = 99; }, /material/);
  await bad(m => { m.loads = [{ pos: 'w1c', type: 5 }]; }, /type/);
  await bad(m => { m.sources = [{ pos: 42 }]; }, /must be text/);
  await bad(m => { m.tls = [{ p1: 'w1c', p2: 'w1b', rev: 'yes' }]; }, /true or false/);
  await bad(m => { m.objects = [{ type: 'house', len: '400', wid: '400', roof: 'metal', grid: '0.1' }]; }, /grid wires/);
  await bad(m => { m.objects = [{ type: 'tower' }]; }, /House 1 type/);
  await bad(m => { m.ins = { t: 1, wires: '1-999999999' }; }, /wire number above/);
  await bad(m => { m.boom = { mount: 'glued' }; }, /Boom mount/);
  await bad((m, p) => { p.view = { pol: '<script>' }; }, /pattern view/);
  await bad(m => { m.name = 'n'.repeat(LIMITS.name + 1); }, /name is longer/);
});

test('only whitelisted fields come through; __proto__ and unknown keys go nowhere', async () => {
  const text = JSON.stringify(payload(dipole())).replace('"name":"Dipole"', '"name":"Dipole","__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},"script":"<b>x</b>"');
  const { model } = await SWShare.decode(packed(text));
  assert.equal(({}).polluted, undefined); assert.equal(Object.getPrototypeOf(model), Object.prototype);
  assert.deepEqual(Object.keys(model).sort(), ['bands', 'boom', 'comment', 'freq', 'ground', 'ins', 'loads', 'name', 'objects', 'seg', 'sources', 'tls', 'wires']);
  assert.equal(model.polluted, undefined); assert.equal(model.script, undefined);
});

test('table cells escape the model text they show', () => {
  const ctx = {}; vm.runInNewContext(html.match(/^function cellInput.*$/m)[0] + '; this.cellInput = cellInput;', ctx);
  const out = ctx.cellInput('"><img src=x onerror=alert(1)>&amp;', 'id="a"');
  assert.equal(out, '<input id="a" value="&quot;>&lt;img src=x onerror=alert(1)>&amp;amp;" spellcheck="false" autocomplete="off">');
});

// The page: openShared() and the start-up block, with the DOM stubbed
function page(hash) {
  const nodes = new Map(), log = [];
  const $ = id => { if (!nodes.has(id)) nodes.set(id, { value: '', hidden: true, textContent: '', open: false, showModal() { this.open = true; }, close() { this.open = false; }, click() { log.push(['click', id]); } }); return nodes.get(id); };
  const S = { model: null, calcFreq: 14.15 };
  const ctx = {
    $, S, SWShare, EXAMPLES: [{ name: 'Default' }], clone: o => JSON.parse(JSON.stringify(o)), log,
    location: { hash, href: 'https://example.test/sw/' + hash }, listeners: {},
    window: { addEventListener: (k, f) => { ctx.listeners[k] = f; } },
    localStorage: { getItem: () => null }, showTab: t => log.push(['tab', t]),
    loadModel: (m, keep) => { S.model = m; log.push(['load', m.name, keep, S.calcFreq]); },
    startWorker: () => Promise.resolve()
  };
  ctx.$('#polSel').value = 'tot'; ctx.$('#edPol').value = 'tot';
  const boot = section("startWorker().finally(", '})();\n</script>');
  vm.runInNewContext(section('function shareNote', '$(\'#shareNoteX\')') + section('// Load the model of a share link', '/* ---------------- boot') +
    'globalThis.openShared = openShared; globalThis.ready = ' + boot.replace(/;\s*$/, '') + ';', ctx);
  return ctx;
}

test('ordinary start (no fragment, or a help anchor) loads the default example and calculates it', async () => {
  for (const h of ['', '#h-start', '#mixgain']) {
    const p = page(h); await p.ready;
    assert.deepEqual(p.log.filter(l => l[0] !== 'tab'), [['load', 'Default', undefined, 14.15], ['click', '#calcBtn']], h);
    assert.equal(p.$('#shareNote').hidden, true, h);
  }
});

test('a share link opens its model, frequency and view, then calculates it like any start', async () => {
  const m = dipole(); m.name = 'Shared one';
  const h = await SWShare.encode({ model: m, calcFreq: 14.3, view: { pol: 'hv' } });
  const p = page(h); await p.ready;
  assert.deepEqual(p.log.filter(l => l[0] !== 'tab'), [['load', 'Shared one', true, 14.3], ['click', '#calcBtn']]);
  assert.equal(p.$('#polSel').value, 'hv');
  assert.equal(p.$('#shareNote').hidden, true);
});

test('a corrupt link at start says why and falls back to the default example; in a running tab it keeps the model', async () => {
  const p = page('#sw=1.d.broken!');
  await p.ready;
  assert.deepEqual(p.log.filter(l => l[0] !== 'tab'), [['load', 'Default', undefined, 14.15], ['click', '#calcBtn']]);
  assert.equal(p.$('#shareNote').hidden, false);
  assert.match(p.$('#shareNoteTxt').textContent, /could not be opened\. .*unknown layout.*default example/);
  // pasted into the running tab: a bad link leaves the model alone, a good one loads and calculates
  p.log.length = 0; p.location.hash = '#sw=2.d.AAAA'; await p.listeners.hashchange();
  assert.deepEqual(p.log, []); assert.match(p.$('#shareNoteTxt').textContent, /newer Sommerwire.*unchanged/);
  p.location.hash = await SWShare.encode({ model: dipole() }); await p.listeners.hashchange();
  assert.deepEqual(p.log, [['load', 'Dipole', true, 14.15], ['click', '#calcBtn']]);
  assert.equal(p.$('#shareNote').hidden, true);
  p.log.length = 0; p.location.hash = '#h-limits'; await p.listeners.hashchange();
  assert.deepEqual(p.log, []);
});
