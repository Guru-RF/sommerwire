// The embeddable presentation (index.html?embed=1, optionally followed by a #sw= share fragment) and the band strip
// layout of the normal app. Run from the repository root:  node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), help = read('help.html'), readme = read('README.md');
function section(start, end, src = html) {
  const i = src.indexOf(start), j = src.indexOf(end, i);
  assert.ok(i >= 0 && j > i, 'section ' + start);
  return src.slice(i, j);
}
const style = section('<style>', '</style>');
const HAM = [[3.5, 3.8, '80m'], [7.0, 7.2, '40m'], [10.1, 10.15, '30m'], [14.0, 14.35, '20m'], [18.068, 18.168, '17m'], [21.0, 21.45, '15m'], [24.89, 24.99, '12m'], [28.0, 29.7, '10m']];
const EFOC = [3.6, 7.1, 10.125, 14.175, 18.118, 21.225, 24.94, 28.5];

test('the flag is read from the query only, before the page draws, and only ?embed=1 turns it on', () => {
  const flag = html.match(/<script>\n\/\/ \?embed=1[\s\S]*?<\/script>/)[0];
  assert.ok(html.indexOf(flag) < html.indexOf('<style>'), 'set in <head>, before the styles apply');
  const code = flag.replace(/<\/?script>/g, '');
  const run = search => { const cls = new Set(); vm.runInNewContext(code, { URLSearchParams, location: { search }, document: { documentElement: { classList: { add: c => cls.add(c) } } } }); return cls.has('embed'); };
  assert.equal(run('?embed=1'), true);
  assert.equal(run('?x=2&embed=1'), true);
  for (const s of ['', '?embed=0', '?embed=true', '?embed', '?skin=koen', '?embedx=1']) assert.equal(run(s), false, s);
  // the share fragment stays the model's only carrier: the link format is unchanged
  assert.match(read('share.js'), /const VERSION = 1, PREFIX = '#sw=';/);
});

test('the presentation CSS shows only the band pickers, a share-link error and the 3D view', () => {
  assert.match(style, /html\.embed \.wrap > :not\(#bandRes\):not\(#shareNote\):not\(\[data-panel="view"\]\) \{ display: none !important; \}/);
  assert.match(style, /html\.embed \[data-panel="view"\] \.card > :not\(\.edgrid\), html\.embed \.edside, html\.embed #edCoord \{ display: none !important; \}/);
  // one row of pickers that scrolls inside itself; the page never scrolls sideways
  assert.match(style, /html\.embed, html\.embed body \{ height: 100%; margin: 0; overflow: hidden; \}/);
  assert.match(style, /html\.embed \.bandgrid \{ display: flex; flex-wrap: nowrap;[^}]*overflow-x: auto;/);
  assert.match(style, /html\.embed \.bandres button \{ flex: 1 0 auto;[^}]*white-space: nowrap;/);
  // the view fills the frame; vertical touch moves still scroll the host page
  assert.match(style, /html\.embed \.view3d \{ height: 100%; aspect-ratio: auto; max-height: none; touch-action: pan-y; \}/);
  // the pickers come before the view in the page, so the label and the row sit above it
  assert.ok(html.indexOf('<div class="bandres" id="bandRes"') < html.indexOf('<section class="panel" data-panel="view"'));
});

test('the normal band strip: label on its own row, buttons in equal responsive columns, note on its own row', () => {
  assert.match(style, /\.bandres \{ display: grid;/);
  assert.match(style, /\.bandgrid \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 34em\), 1fr\)\);/);
  assert.match(style, /\.bandres button \{[^}]*text-align: left;[^}]*min-width: 0;/);
  assert.match(style, /#bandAntenna \{[^}]*font-weight: 600;/);
  assert.doesNotMatch(style, /\.bandres \{ display: flex; flex-wrap: wrap;/, 'no inline label that offsets the first button');
});

// renderBands and its helpers, run against stub nodes
function strip({ embed = false, bands = EFOC, calcFreq = 3.6, rows = null, f0 } = {}) {
  const nodes = {};
  const $ = id => nodes[id] ||= { innerHTML: '', hidden: true, textContent: '' };
  const S = { model: { name: 'RF.Guru EFOC29', bands }, calcFreq, bandRes: rows && { rows }, embedF0: f0 };
  const ctx = { $, S, fmt: (x, d = 2) => x.toFixed(d), swrClass: () => 'good', bandsFor: () => HAM,
    document: { documentElement: { classList: { contains: c => embed && c === 'embed' } } } };
  vm.runInNewContext(section('function renderBands', "$('#bandRes').onclick"), ctx);
  ctx.renderBands();
  return { box: nodes['#bandRes'], title: nodes['#bandAntenna'], ctx };
}
const buttons = h => [...h.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map(m => ({ attrs: m[1], text: m[2] }));

test('presentation pickers: all eight EFOC29 bands as short names, frequency in the title and accessible name, no results', () => {
  const { box, title } = strip({ embed: true, f0: 3.6, rows: EFOC.map(f => ({ f, swr: 2, R: 50, X: 0, fb: 1 })) });
  assert.equal(box.hidden, false);
  assert.equal(title.hidden, true, 'no antenna name in the presentation');
  assert.match(box.innerHTML, /^<span class="k" id="bandsK">Bands<\/span><div class="bandgrid" role="group" aria-labelledby="bandsK">/);
  const b = buttons(box.innerHTML);
  assert.deepEqual(b.map(x => x.text), ['80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m']);
  assert.match(b[0].attrs, /class="on" aria-pressed="true" data-band="3.6" title="80 m, 3.6 MHz" aria-label="80 m, 3.6 MHz"/);
  assert.match(b[7].attrs, /aria-pressed="false" data-band="28.5" title="10 m, 28.5 MHz"/);
  assert.doesNotMatch(box.innerHTML, /SWR|RDF|F\/B|Ω|Not calculated/);
});

test('presentation pickers: a single-frequency link gets one picker; an off-band frequency is added in order', () => {
  let b = buttons(strip({ embed: true, bands: [], calcFreq: 14.2, f0: 14.2 }).box.innerHTML);
  assert.deepEqual(b.map(x => x.text), ['20m']);
  assert.match(b[0].attrs, /class="on"/);
  // outside every amateur band: the frequency itself is the label
  b = buttons(strip({ embed: true, bands: [], calcFreq: 12.345, f0: 12.345 }).box.innerHTML);
  assert.deepEqual(b.map(x => x.text), ['12.345']);
  assert.match(b[0].attrs, /aria-label="12.345 MHz"/);
  // a link that opened EFOC29 at 3.65 MHz keeps a picker for it between 80 m and 40 m
  b = buttons(strip({ embed: true, calcFreq: 3.65, f0: 3.65 }).box.innerHTML);
  assert.deepEqual(b.map(x => x.text), ['80m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m']);
  assert.match(b[1].attrs, /class="on"[^>]*data-band="3.65" title="80 m, 3.65 MHz"/);
  // the normal app never adds a frequency to the model's bands
  assert.equal(buttons(strip({ calcFreq: 3.65, f0: 3.65 }).box.innerHTML).length, 8);
  assert.equal(strip({ bands: [], calcFreq: 14.2, f0: 14.2 }).box.hidden, true);
});

test('normal band strip markup: name, label, grid of detailed buttons, note', () => {
  const rows = EFOC.map(f => ({ f, swr: 1.5, R: 40, X: -3, fb: 2.5, sum: { rdf: { sky: { rdf: 7 } } } }));
  const { box, title } = strip({ calcFreq: 7.1, rows });
  assert.equal(title.textContent, 'RF.Guru EFOC29'); assert.equal(title.hidden, false);
  assert.match(box.innerHTML, /^<span class="k" id="bandsK">Bands<\/span><div class="bandgrid" role="group" aria-labelledby="bandsK"><button/);
  assert.match(box.innerHTML, /<\/button><\/div><span class="note" title="RDF assumes/);
  const b = buttons(box.innerHTML);
  assert.equal(b.length, 8);
  assert.match(b[1].text, /^7\.1 MHz · SWR <span class="good">1\.50<\/span> · 40\.0 − j3\.0 Ω · F\/B 2\.5 dB · RDF 7\.00 dB$/);
  assert.match(b[1].attrs, /class="on" aria-pressed="true" data-band="7.1" title="Use 7.1 MHz as the calculation frequency"/);
  assert.match(strip().box.innerHTML, /<span class="note">Not calculated for the current model yet\.<\/span>$/);
});

// calculate() with the presentation flag: only the frequency on show is solved
function ui(embed) {
  const nodes = {}, jobs = [];
  const $ = id => nodes[id] ||= { contains: () => false, innerHTML: '', hidden: false, value: '', checked: true };
  const S = { model: { name: 'm', v: 1, bands: [3.6, 7.1] }, calcFreq: 3.6, history: [], dirty: true, embedF0: 3.6 };
  const ctx = { $, $$: () => [], S, fmt: (x, d = 2) => x.toFixed(d), swrClass: () => 'good', bandsFor: () => HAM,
    numericModel: () => ({ v: S.model.v }), invalidateSweep() {}, validateCells() {}, drawView() {}, renderVars() {}, setStatus() {},
    renderResults() {}, renderReadout() {}, drawPatterns() {}, drawSmith() {}, drawEdPolar() {}, setSweepDefaults() {}, showWarnings() {},
    performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {},
    document: { documentElement: { classList: { contains: c => embed && c === 'embed' } } },
    job: msg => new Promise(resolve => jobs.push({ msg, resolve })) };
  vm.runInNewContext(section('let calcTimer', "document.addEventListener('input'") + section('async function calculate', 'const GNAME'), ctx);
  const answer = i => jobs[i].resolve({ f: jobs[i].msg.f, R: 50, X: 1, swr: 1.2, z0: 50, warnings: [], sources: [] });
  return { ctx, S, $, jobs, answer, flush: () => new Promise(setImmediate) };
}

test('presentation: a calculation solves only the frequency on show; a picker click solves that one and marks it', async () => {
  const { ctx, S, $, jobs, answer, flush } = ui(true);
  let run = ctx.calculate(); answer(0); await run; await flush();
  assert.equal(jobs.length, 1, 'no background band solves');
  assert.equal(S.bandRes, undefined);
  const picker = band => ({ dataset: { band }, classList: { toggle() {} }, setAttribute(name, value) { this[name] = value; } });
  const previous = picker('3.6'), current = picker('7.1');
  ctx.$$ = () => [previous, current];
  $('#bandRes').onclick({ target: { closest: () => current } });
  assert.equal(S.calcFreq, 7.1); assert.equal($('#cFreq').value, 7.1);
  assert.equal(previous['aria-pressed'], 'false');
  assert.equal(current['aria-pressed'], 'true', 'marked before the result arrives without replacing the button');
  run = ctx.calculate(); answer(1); await run; await flush();
  assert.equal(jobs.length, 2); assert.equal(jobs[1].msg.f, 7.1);
  // the normal app still solves the other bands after the main result
  const n = ui(false); run = n.ctx.calculate(); n.answer(0); await n.flush();
  assert.equal(n.jobs.length, 2); n.answer(1); await run;
});

test('presentation is read-only and quiet: rotate only, no edit keys, no wheel capture, no storage', () => {
  const boot = section('/* ---------------- boot', '})();\n</script>');
  assert.match(boot, /const EMBED = isEmbed\(\);/);
  assert.match(boot, /if \(EMBED\) setMode\('rotate'\);/);
  assert.match(boot, /let tab = null; if \(!EMBED\) try \{ tab = localStorage\.getItem\('wm-tab'\); \}/);
  assert.match(boot, /showTab\(!EMBED && tab && [^)]*\) \? tab : 'view'\);/);
  assert.match(html, /if \(!isEmbed\(\)\) try \{ localStorage\.setItem\('wm-tab', name\); \}/);
  assert.match(html, /let saved = null; if \(!isEmbed\(\)\) try \{ saved = localStorage\.getItem\('sw-spin'\); \}/);
  assert.match(html, /cb\.checked = saved === null \? !reduce : saved === '1';/, 'turns unless reduced motion is preferred');
  assert.match(html, /if \(\$\('\[data-panel="view"\]'\)\.hidden \|\| isEmbed\(\)\) return;/);
  assert.match(html, /box\.addEventListener\('wheel', e => \{ if \(isEmbed\(\)\) return; e\.preventDefault\(\);/);
  assert.match(html, /if \(ED\.mode === 'rotate' \|\| isEmbed\(\) \|\| e\.altKey/);
  // every storage access outside the presentation guard is the spin checkbox, which the presentation hides
  const unguarded = html.split('\n').filter(l => /localStorage/.test(l) && !/isEmbed\(\)|EMBED/.test(l));
  assert.deepEqual(unguarded.map(l => l.trim().slice(0, 40)), ["cb.onchange = () => { try { localStorage"]);
  // no messaging with the host page and no reach into it
  assert.doesNotMatch(html, /window\.parent|parent\.postMessage|top\.postMessage|addEventListener\('message'/);
});

test('presentation boot: the default EFOC29 or the shared model, a picker for its frequency, the 3D view, no storage', async () => {
  const ctxFor = (hash, embed) => {
    const log = [], nodes = new Map();
    const $ = id => { if (!nodes.has(id)) nodes.set(id, { value: '', hidden: true, textContent: '', click() { log.push(['click', id]); } }); return nodes.get(id); };
    const S = { model: null, calcFreq: 14.15 };
    const ctx = { $, S, log, EMBED: embed, DEFAULT_EXAMPLE: 0, location: { hash },
      SWShare: { isShareHash: h => h.startsWith('#sw='), decode: async () => ({ model: { name: 'Shared', freq: 7 }, calcFreq: 7.05, view: {} }) },
      openShared: async () => { S.calcFreq = 7.05; log.push(['load', 'Shared']); return true; },
      loadExample: () => { S.calcFreq = 3.6; log.push(['load', 'EFOC29']); },
      localStorage: { getItem() { throw new Error('storage touched'); } },
      showTab: t => log.push(['tab', t]), renderBands: () => log.push(['bands', S.embedF0]),
      startWorker: () => Promise.resolve(), window: { addEventListener() {} } };
    vm.runInNewContext('globalThis.ready = ' + section('startWorker().finally(', '})();\n</script>').replace(/;\s*$/, '') + ';', ctx);
    return ctx;
  };
  let c = ctxFor('', true); await c.ready;
  assert.deepEqual(c.log, [['load', 'EFOC29'], ['bands', 3.6], ['tab', 'view'], ['click', '#calcBtn']]);
  c = ctxFor('#sw=1.d.x', true); await c.ready;
  assert.deepEqual(c.log, [['load', 'Shared'], ['bands', 7.05], ['tab', 'view'], ['click', '#calcBtn']]);
});

test('docs: README embedding section, dated What changed entry, footer credit; no guessed PR numbers', () => {
  const emb = section('## Embedding', '\n## ', readme);
  assert.match(emb, /https:\/\/sommerwire\.app\/\?embed=1/);
  assert.match(emb, /<iframe[^>]*src="https:\/\/sommerwire\.app\/\?embed=1"[^>]*title="[^"]+"[^>]*loading="lazy"/);
  assert.match(emb, /#sw=/); assert.match(emb, /\?embed=1#sw=/);
  assert.match(emb, /postMessage/); assert.match(emb, /storage/i);
  const sec = section('<h2 id="h-changes">', '<h2 id="h-licence">', help);
  const first = section('<h3>2026-11-28 · Embeddable 3D view', '<h3>2026-11-28 · One theme', sec);
  assert.match(first, /\?embed=1/); assert.match(first, /Bands/);
  assert.doesNotMatch(first, /pull\/\d+/, 'no PR number before there is one');
  assert.match(section('<footer>', '</footer>'), /embeddable 3D view/i);
});
