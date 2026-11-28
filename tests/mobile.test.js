// The phone layout of the full app (640 px and narrower): one stylesheet block that never reaches the ?embed=1
// presentation or a larger screen, the tab bar and its keys, and touch in the 3D editor.
// Run from the repository root:  node --test tests/
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
const PHONE = '@media (max-width: 640px) {';
const phone = style.slice(style.lastIndexOf(PHONE) + PHONE.length, style.lastIndexOf('}'));
// the rules of the phone block as [selectors, declarations], comments removed
const rules = [...phone.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2].trim()]);
const decl = sel => { const r = rules.find(([s]) => s.split(',').map(x => x.trim()).includes(sel)); assert.ok(r, 'rule ' + sel); return r[1]; };

test('the page is laid out at the width of the device', () => {
  const head = html.slice(0, html.indexOf('<style>'));
  assert.match(head, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.doesNotMatch(head, /user-scalable|maximum-scale/, 'pinch zoom of the page stays available');
  assert.match(help, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

test('the phone block is the last thing in the stylesheet and every rule in it leaves the presentation alone', () => {
  assert.equal(style.split(PHONE).length, 2, 'one phone block');
  assert.ok(style.lastIndexOf(PHONE) > style.lastIndexOf('html.embed '), 'after the presentation rules');
  assert.match(style.trimEnd(), /\}\n\}$/, 'nothing follows the block');
  assert.ok(rules.length > 40);
  for (const [sel] of rules) for (const s of sel.split(',')) assert.match(s.trim(), /^html:not\(\.embed\)( |$)/, s.trim());
  // and outside the block nothing mentions it: larger screens keep every rule they had
  assert.doesNotMatch(style.slice(0, style.lastIndexOf(PHONE)).replace(/\/\*[\s\S]*?\*\//g, ''), /:not\(\.embed\)/);
  // nothing is hidden on a phone (only the scrollbar of the tab strip, which still scrolls)
  for (const [sel, d] of rules) if (sel !== 'html:not(.embed) nav.tabs::-webkit-scrollbar') assert.doesNotMatch(d, /display:\s*none|visibility:\s*hidden/, sel);
});

test('nothing widens the page: cards, panels and two-up grids are one bounded column; tables scroll in their frame', () => {
  assert.match(decl('html:not(.embed) .card'), /grid-template-columns: minmax\(0, 1fr\);/);
  for (const s of ['.panel', '.grid2']) assert.ok(rules.some(([sel, d]) => sel.includes('html:not(.embed) ' + s) && /minmax\(0, 1fr\)/.test(d)), s);
  assert.match(style, /\.tscroll \{ overflow-x: auto;/);
  assert.match(style, /\.wrap \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(decl('html:not(.embed) dialog'), /max-height: calc\(100dvh - 24px\); overflow: auto;/);
  // every editor table sits in its own scrolling frame
  for (const id of ['wireTbl', 'srcTbl', 'loadTbl', 'tlTbl', 'objTbl', 'resTbl', 'varTbl', 'goalTbl', 'optTbl'])
    assert.match(html, new RegExp('<div class="tscroll"><table[^>]*id="' + id + '"'), id);
});

test('touch targets: 44 px controls, 16 px typed text, larger tick boxes inside 44 px labels', () => {
  assert.match(decl('html:not(.embed) button'), /min-height: 44px;/);
  const typed = rules.find(([s]) => s.includes('input:not([type="checkbox"]):not([type="file"])') && s.includes('textarea'));
  assert.match(typed[1], /font-size: 16px; min-height: 44px;/);
  assert.match(decl('html:not(.embed) input[type="checkbox"]'), /width: 20px !important; height: 20px;/);
  assert.match(decl('html:not(.embed) label.fld:has(> input[type="checkbox"])'), /min-height: 44px;/);
  assert.match(decl('html:not(.embed) .bandres button'), /min-height: 44px;/);
  assert.match(decl('html:not(.embed) .tab'), /min-height: 46px;/);
});

test('phone flow: examples and Calculate at the top, frequency and SWR lead the readout, the tab bar stays on screen', () => {
  assert.match(decl('html:not(.embed) header.top > .toolbar > #exampleSel'), /grid-column: 1 \/ -1;/);
  assert.match(decl('html:not(.embed) header.top > .toolbar > #calcBtn'), /grid-column: span 3;/);
  assert.match(decl('html:not(.embed) .readout'), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  // the tiles the order rules name: 1 Frequency, 3 SWR, 8 Polarization
  const tiles = [...section('<section class="readout"', '</section>').matchAll(/<div class="ro[^"]*"><div class="k"[^>]*>([^<]*)</g)].map(m => m[1]);
  assert.equal(tiles.length, 12, 'every readout tile is still in the page');
  assert.deepEqual([tiles[0], tiles[2], tiles[7]], ['Frequency', 'SWR 50 Ω', 'Polarization']);
  assert.match(decl('html:not(.embed) .ro:nth-child(1)'), /order: -2;/);
  assert.match(decl('html:not(.embed) .ro:nth-child(3)'), /order: -1;/);
  const nav = decl('html:not(.embed) nav.tabs');
  assert.match(nav, /position: sticky; top: 0; bottom: 0;/);
  assert.match(nav, /background: var\(--bg\);/);
  assert.match(decl('html:not(.embed)'), /scroll-padding-block: 60px;/, 'focused controls and Help anchors clear the pinned bar');
  // the 3D view follows the mode buttons; its settings follow it, in the page's own focus order
  assert.match(decl('html:not(.embed) [data-panel="view"] .edgrid'), /display: contents;/);
  assert.match(decl('html:not(.embed) [data-panel="view"] #viewBox'), /order: 1;/);
  assert.match(decl('html:not(.embed) [data-panel="view"] > .card > .row:nth-child(2)'), /order: 2;/);
  assert.match(decl('html:not(.embed) .view3d'), /aspect-ratio: 1 \/ 1; max-height: min\(560px, 62vh\);/);
  const view = section('<section class="panel" data-panel="view"', '</section>');
  assert.ok(view.indexOf('data-mode="select"') < view.indexOf('id="edPlane"') && view.indexOf('id="edPlane"') < view.indexOf('id="viewBox"'));
});

// the tab code, run against stub nodes
function tabs({ sticky = false, navTop = 0, panelTop = 60, gap = '12px' } = {}) {
  const names = ['geometry', 'view', 'calc', 'pattern', 'sweep', 'opt', 'help'];
  const log = [], handlers = {};
  const attrs = o => Object.assign(o, { attr: {}, setAttribute(k, v) { this.attr[k] = v; }, getAttribute(k) { return this.attr[k]; } });
  const tabEls = names.map(n => attrs({ dataset: { tab: n }, focus(o) { doc.activeElement = this; log.push(['focus', n, o && o.preventScroll]); }, click() { this.onclick(); },
    getBoundingClientRect: () => ({ left: 0, right: 10 }) }));
  const panels = Object.fromEntries(names.map(n => [n, attrs({ dataset: { panel: n }, hidden: true, getBoundingClientRect: () => ({ top: panelTop }) })]));
  const nav = { scrollWidth: 100, clientWidth: 100, scrollLeft: 0, offsetHeight: 48, parentElement: {}, getBoundingClientRect: () => ({ left: 0, right: 100, top: navTop, bottom: navTop + 48 }),
    addEventListener: (t, f) => { handlers[t] = f; } };
  const doc = { activeElement: null };
  const $ = s => { if (s === 'nav.tabs') return nav; let m = s.match(/^\.tab\[data-tab="(\w+)"\]$/); if (m) return tabEls[names.indexOf(m[1])]; m = s.match(/^\[data-panel="(\w+)"\]$/); return m ? panels[m[1]] : {}; };
  const $$ = s => s === '.tab' ? tabEls : s === '[data-panel]' ? Object.values(panels) : [];
  const ctx = { $, $$, S: {}, document: doc, isEmbed: () => false, localStorage: { setItem() {} }, requestAnimationFrame() {},
    renderTables() {}, renderInspector() {}, loadHelp() {}, getComputedStyle: el => el === nav ? { position: sticky ? 'sticky' : 'static' } : { rowGap: gap },
    window: { scrollBy: (x, y) => log.push(['scrollBy', x, y]), addEventListener() {}, matchMedia: null }, MutationObserver: class { observe() {} } };
  vm.runInNewContext(section('function showTab', '// "What changed" (header and footer)'), ctx);
  const key = (k, extra = {}) => { const e = { key: k, prevented: false, preventDefault() { this.prevented = true; }, ...extra }; handlers.keydown(e); return e; };
  return { ctx, tabEls, panels, nav, doc, log, key, names };
}

test('tabs name their panels and the arrow keys, Home and End move between them', () => {
  const { tabEls, panels, doc, key, ctx, log } = tabs();
  assert.equal(tabEls[2].id, 'tab-calc');
  assert.equal(panels.calc.attr.role, 'tabpanel');
  assert.equal(panels.calc.attr['aria-labelledby'], 'tab-calc');
  assert.equal(tabEls[2].attr['aria-controls'], panels.calc.id);
  assert.match(html, /<nav class="tabs" role="tablist" aria-label="Sections">/);
  const sel = () => tabEls.filter(t => t.attr['aria-selected'] === 'true').map(t => t.dataset.tab);
  doc.activeElement = tabEls[1];
  assert.equal(key('ArrowRight').prevented, true);
  assert.deepEqual(sel(), ['calc']); assert.equal(doc.activeElement, tabEls[2]); assert.equal(panels.calc.hidden, false); assert.equal(ctx.S.tab, 'calc');
  key('ArrowLeft'); key('ArrowLeft'); key('ArrowLeft'); assert.deepEqual(sel(), ['help'], 'wraps round');
  key('ArrowRight'); assert.deepEqual(sel(), ['geometry']);
  key('End'); assert.deepEqual(sel(), ['help']); key('Home'); assert.deepEqual(sel(), ['geometry']);
  assert.ok(log.filter(l => l[0] === 'focus').every(l => l[2] === true), 'moving focus does not scroll the page');
  // other keys, modified keys and keys pressed elsewhere are left alone
  assert.equal(key('a').prevented, false); assert.equal(key('ArrowRight', { ctrlKey: true }).prevented, false);
  doc.activeElement = {}; assert.equal(key('ArrowRight').prevented, false); assert.deepEqual(sel(), ['geometry']);
  // every tab stays reachable with Tab, as before: no tab is taken out of the focus order
  assert.doesNotMatch(html, /tabindex/i);
});

test('choosing a tab moves the page only on a phone and only while the tab bar is pinned away from its place', () => {
  // desktop: the bar is not sticky
  let t = tabs({ sticky: false, navTop: 500, panelTop: 900 }); t.tabEls[3].click();
  assert.deepEqual(t.log.filter(l => l[0] === 'scrollBy'), []);
  // phone, bar in its own place (panel starts one gap below it)
  t = tabs({ sticky: true, navTop: 300, panelTop: 360 }); t.tabEls[3].click();
  assert.deepEqual(t.log.filter(l => l[0] === 'scrollBy'), []);
  // phone, bar pinned at the bottom (panel still below the screen): the panel comes up under the bar
  t = tabs({ sticky: true, navTop: 692, panelTop: 1100 }); t.tabEls[3].click();
  assert.deepEqual(t.log.filter(l => l[0] === 'scrollBy'), [['scrollBy', 0, 1100 - 48 - 12]]);
  assert.equal(t.panels.pattern.hidden, false);
  // phone, bar pinned at the top deep in a long panel: back to the start of the new one
  t = tabs({ sticky: true, navTop: 0, panelTop: -2000 }); t.tabEls[0].click();
  assert.deepEqual(t.log.filter(l => l[0] === 'scrollBy'), [['scrollBy', 0, -2000 - 48 - 12]]);
  // opening a tab from code (the start, What changed) never moves the page
  t = tabs({ sticky: true, navTop: 692, panelTop: 1100 }); t.ctx.showTab('calc');
  assert.deepEqual(t.log.filter(l => l[0] === 'scrollBy'), []);
});

test('the selected tab is kept in view inside the tab strip without moving the page', () => {
  const t = tabs();
  Object.assign(t.nav, { scrollWidth: 620, clientWidth: 360, scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, right: 360, top: 0, bottom: 48 }) });
  t.tabEls[6].getBoundingClientRect = () => ({ left: 560, right: 620 });
  t.ctx.showTab('help');
  assert.equal(t.nav.scrollLeft, 620 - 360 + 12);
  t.tabEls[0].getBoundingClientRect = () => ({ left: -200, right: -110 });
  t.ctx.showTab('geometry');
  assert.equal(t.nav.scrollLeft, 272 - 200 - 12);
  assert.deepEqual(t.log.filter(l => l[0] === 'scrollBy'), []);
});

test('3D editor touch: a finger on empty space turns the view in Select mode; mouse and the presentation as before', () => {
  const input = section('(function edInput() {', '/* auto-rotate');
  assert.match(input, /ED\.touch = e\.pointerType === 'touch';/);
  assert.match(input, /selectDown\(sx, sy\);\n[^\n]*\n\s*if \(ED\.touch && !ED\.drag\) orbit = \{ x: e\.clientX, y: e\.clientY, yaw: V\.yaw, pitch: V\.pitch, pan: false,/);
  // unchanged: the rotate / presentation / right-drag / Alt+drag orbit, two-finger pinch, wheel
  assert.match(input, /if \(ED\.mode === 'rotate' \|\| isEmbed\(\) \|\| e\.altKey \|\| e\.button === 1 \|\| e\.button === 2\) \{/);
  assert.match(input, /if \(ptrs\.size === 2\) \{\n\s*const \[a, b\] = \[\.\.\.ptrs\.values\(\)\]; pinch = /);
  // a finger hits wire ends and wires from further away; a mouse keeps its 10 px and 7 px
  assert.match(html, /function hitEnd\(sx, sy, skip\) \{\n  let best = null, bd = ED\.touch \? 22 : 10;/);
  assert.match(html, /function hitWire\(sx, sy\) \{\n  let best = null, bd = ED\.touch \? 16 : 7;/);
  assert.match(html, /select: '[^']*On a touch screen, drag empty space to rotate and pinch to zoom\.'/);
  // the canvases still take the gestures themselves; the presentation still lets vertical swipes scroll its host
  assert.match(style, /\.canvasbox \{[^}]*touch-action: none; \}/);
  assert.match(style, /html\.embed \.view3d \{[^}]*touch-action: pan-y; \}/);
});

test('docs: README feature entry and the dated What changed entry', () => {
  assert.match(section('## Features', '\n## ', readme), /\*\*Phone layout\*\*: up to 640 px wide/);
  const sec = section('<h2 id="h-changes">', '<h2 id="h-licence">', help);
  const first = section('<h3>2026-11-28 · Phone layout</h3>', '<h3>2026-11-28 · Embeddable 3D view', sec);
  assert.match(first, /640 px/); assert.match(first, /arrow keys, Home and End/); assert.match(first, /<code>\?embed=1<\/code> presentation are unchanged/);
  assert.doesNotMatch(first, /pull\/\d+|version \d/i);
});
