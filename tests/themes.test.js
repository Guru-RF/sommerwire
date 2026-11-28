// Themes: RF.Guru by default, Koen's original look selectable, the choice kept across reloads and Help,
// graceful when storage is blocked, and the look only (no model, solver or share-link change).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), help = read('help.html'), themeJs = read('theme.js');

// a minimal browser for theme.js: one <html>, a favicon link, theme selects and a localStorage that may refuse
function browser({ stored = null, blocked = false, selects = 1 } = {}) {
  const store = new Map(stored == null ? [] : [['sw-skin', stored]]);
  const listeners = {};
  const icon = { href: 'brand/icon.svg', getAttribute() { return this.href; }, setAttribute(_, v) { this.href = v; } };
  // each "page area" has one switch: a button per theme
  const btns = [];
  const sel = Array.from({ length: selects }, () => {
    const group = ['rfguru', 'koen'].map(v => {
      const b = { dataset: { skinBtn: v }, attrs: {}, handlers: [], setAttribute(k, x) { this.attrs[k] = x; },
        addEventListener(ev, fn) { if (ev === 'click') this.handlers.push(fn); } };
      btns.push(b); return b;
    });
    return {
      get value() { return group.find(b => b.attrs['aria-pressed'] === 'true')?.dataset.skinBtn; },
      choose: v => group.find(b => b.dataset.skinBtn === v).handlers.forEach(fn => fn())
    };
  });
  const document = {
    readyState: 'complete', documentElement: { dataset: {} },
    querySelector: q => (q === 'link[rel="icon"]' ? icon : null),
    querySelectorAll: q => (q === '[data-skin-btn]' ? btns : []),
    addEventListener() {}
  };
  const localStorage = {
    getItem(k) { if (blocked) throw new Error('SecurityError'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (blocked) throw new Error('SecurityError'); store.set(k, String(v)); }
  };
  const window = { document, localStorage, addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); } };
  vm.runInNewContext(themeJs, { window, globalThis: window });
  return { window, document, store, icon, sel, fire: (ev, e) => (listeners[ev] || []).forEach(fn => fn(e)) };
}

test('first visit opens in the RF.Guru theme with its icon', () => {
  const b = browser();
  assert.equal(b.document.documentElement.dataset.skin, 'rfguru');
  assert.equal(b.window.SWTheme.DEFAULT, 'rfguru');
  assert.equal(b.icon.href, 'brand/icon-rfguru.svg');
  assert.equal(b.sel[0].value, 'rfguru');
  assert.equal(b.store.size, 0, 'nothing is written until the visitor chooses');
});

test('a chosen theme is saved and restored on the next load; unknown values fall back to RF.Guru', () => {
  const b = browser({ selects: 2 });
  b.sel[0].choose('koen');
  assert.equal(b.document.documentElement.dataset.skin, 'koen');
  assert.equal(b.store.get('sw-skin'), 'koen');
  assert.equal(b.sel[1].value, 'koen', 'every theme selector on the page follows');
  assert.equal(b.icon.href, 'brand/icon.svg');
  assert.equal(browser({ stored: 'koen' }).document.documentElement.dataset.skin, 'koen');
  assert.equal(browser({ stored: 'neon' }).document.documentElement.dataset.skin, 'rfguru');
});

test('blocked storage: the theme still switches for the open page and the next visit starts on RF.Guru', () => {
  const b = browser({ blocked: true });
  assert.equal(b.document.documentElement.dataset.skin, 'rfguru');
  assert.equal(b.window.SWTheme.set('koen'), false);
  assert.equal(b.document.documentElement.dataset.skin, 'koen');
  assert.equal(browser({ blocked: true }).document.documentElement.dataset.skin, 'rfguru');
});

test('a theme change in another Sommerwire page (app or Help) is followed', () => {
  const b = browser();
  b.fire('storage', { key: 'sw-skin', newValue: 'koen' });
  assert.equal(b.document.documentElement.dataset.skin, 'koen');
  b.fire('storage', { key: 'sw-skin', newValue: null });
  assert.equal(b.document.documentElement.dataset.skin, 'rfguru');
});

test('app and Help load theme.js in <head> and show a labelled Theme switch with both looks', () => {
  for (const page of [html, help]) {
    const head = page.slice(0, page.search(/<\/head>|<style>/));
    assert.match(head, /<script src="theme\.js"><\/script>/);
    assert.match(page, /<div class="skinpick" role="group" aria-labelledby="skinLbl"[^>]*><span id="skinLbl">Theme<\/span><span class="seg"><button type="button" data-skin-btn="rfguru" aria-pressed="false">RF\.Guru<\/button><button type="button" data-skin-btn="koen" aria-pressed="false">Koen \(original\)<\/button><\/span><\/div>/);
  }
  // in the app the switch sits in the header, outside the toolbar that wraps on small screens
  const header = html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>'));
  assert.ok(header.indexOf('class="skinpick"') < header.indexOf('<div class="toolbar">'));
  assert.ok(fs.existsSync(path.join(ROOT, 'brand/icon-rfguru.svg')));
});

test('RF.Guru header: adapted mark, title with RF.Guru under it, GitHub link to the fork; Koen keeps the original header', () => {
  const header = html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>'));
  const rf = header.slice(header.indexOf('<div class="brand-rf">'));
  assert.match(rf, /<svg class="rf-mark"/);
  assert.match(rf, /<h1>Sommer<b>wire<\/b><\/h1><span class="rf-sub"><a href="https:\/\/shop\.rf\.guru"[^>]*>RF\.Guru<\/a> edition<\/span>/);
  assert.match(header, /<a class="ghlink" href="https:\/\/github\.com\/Guru-RF\/sommerwire" /);
  // Koen's original brand block is still there, unchanged, for the Koen theme
  assert.match(header, /<div class="brand-text"><h1>Sommerwire<\/h1><span>Wire Antenna Modeler<\/span><small class="ver" id="swVer"><\/small><\/div><\/div>/);
  assert.match(html, /:root\[data-skin="rfguru"\] \.brand \{ display: none; \}/);
  assert.match(html, /html:root\[data-skin="rfguru"\] \{[^}]*--bg: #08090c; --panel: #13161d; --ink: #e2e8f0;[^}]*--accent: #ecc34a;[^}]*--cta: #e5a823;/);
  // Koen's light palette and OS dark rules are kept as they were
  assert.match(html, /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \{\n  --bg: #0f151b;/);
  assert.match(html, /:root \{\n  --bg: #eef1f4; --panel: #ffffff;/);
});

test('canvases redraw when the theme changes', () => {
  assert.match(html, /new MutationObserver\(\(\) => \{ drawView\(\); drawPatterns\(\); drawSweep\(\); drawOpt\(\); drawEdPolar\(\); \}\)\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \['data-theme', 'data-skin'\] \}\)/);
});

test('What changed: dated notes in Help, linked from the header and the footer, with no speculative PR numbers', () => {
  assert.match(help, /<a href="#h-changes">What changed<\/a>/);
  const sec = help.slice(help.indexOf('<h2 id="h-changes">'), help.indexOf('<h2 id="h-licence">'));
  assert.ok(sec.length > 0);
  const m = html.match(/const SW_VERSION = '([\d.]+)', SW_DATE = '(\d{4}-\d{2}-\d{2})'/);
  assert.ok(sec.includes('<h3>' + m[2] + ' · version ' + m[1] + ' · Themes</h3>'), 'the newest entry matches the app version and date');
  const ledger = read('CONTRIBUTION-HISTORY.md');
  for (const [, pr] of sec.matchAll(/href="(https:\/\/github\.com\/Guru-RF\/sommerwire\/pull\/\d+)"/g)) {
    assert.ok(ledger.includes('](' + pr + ')'), 'cited PR is a recorded merge: ' + pr);
  }
  assert.equal((html.match(/class="changeslink"/g) || []).length, 2);
});

test('README documents both themes and the fork and upstream links', () => {
  const readme = read('README.md');
  assert.match(readme, /\*\*Themes\*\*: \*\*RF\.Guru\*\*[\s\S]*\*\*Koen \(original\)\*\*/);
  assert.match(readme, /<https:\/\/github\.com\/Guru-RF\/sommerwire>/);
  assert.match(readme, /<https:\/\/github\.com\/KoenVdH\/sommerwire>/);
});

test('themes touch no solver, model or share-link code', () => {
  for (const f of ['engine.js', 'share.js', 'efhwgen.js', 'structgen.js', 'hexgen.js']) assert.doesNotMatch(read(f), /data-skin|SWTheme|sw-skin/);
  assert.doesNotMatch(themeJs, /SWShare|location\.hash|S\.model|worker/i);
});
