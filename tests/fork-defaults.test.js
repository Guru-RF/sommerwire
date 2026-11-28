// RF.Guru edition defaults: RF.Guru is the only theme (no switch, no stored or URL choice), the edition shows no
// version number, and an ordinary visit opens the existing RF.Guru EFOC29 eight-band example; share links still win.
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
const header = section('<header class="top">', '</header>'), footer = section('<footer>', '</footer>');
const boot = section('/* ---------------- boot', '})();\n</script>');

test('one theme: both pages are RF.Guru from the markup, with no theme script, switch or Koen look', () => {
  assert.ok(html.startsWith('<html data-skin="rfguru">\n<meta charset="utf-8">'), 'no doctype added: the app keeps its rendering mode');
  assert.match(help, /^<!doctype html>\n<html lang="en" data-skin="rfguru">/);
  for (const page of [html, help]) {
    assert.match(page, /<link rel="icon" href="brand\/icon-rfguru\.svg" type="image\/svg\+xml">/);
    assert.doesNotMatch(page, /theme\.js|SWTheme|data-skin-btn|skinpick|data-skin="koen"/);
  }
  // "Koen (original)" survives only as history in What changed, never as a control
  assert.doesNotMatch(html, /Koen \(original\)/);
  assert.doesNotMatch(help.replace(section('<h2 id="h-changes">', '<h2 id="h-licence">', help), ''), /Koen \(original\)/);
  assert.equal(fs.existsSync(path.join(ROOT, 'theme.js')), false);
  assert.ok(fs.existsSync(path.join(ROOT, 'brand/icon-rfguru.svg')));
  // the existing RF.Guru palettes are reused unchanged
  assert.match(html, /html:root\[data-skin="rfguru"\] \{[^}]*--bg: #08090c; --panel: #13161d; --ink: #e2e8f0;[^}]*--accent: #ecc34a;[^}]*--cta: #e5a823;/);
  assert.match(help, /html:root\[data-skin="rfguru"\] \{\n  --bg: #08090c; --panel: #13161d; --ink: #e2e8f0;[^}]*--accent: #ecc34a;/);
});

test('the RF.Guru header stays: adapted mark, RF.Guru edition, What changed and the fork on GitHub; Koen\'s header block is gone', () => {
  assert.doesNotMatch(header, /class="brand"|brand-mark|Wire Antenna Modeler/);
  const rf = header.slice(header.indexOf('<div class="brand-rf">'));
  assert.match(rf, /<svg class="rf-mark"/);
  assert.match(rf, /<h1>Sommer<b>wire<\/b><\/h1><span class="rf-sub"><a href="https:\/\/shop\.rf\.guru"[^>]*>RF\.Guru<\/a> edition<\/span><small class="ver"><a href="#h-changes" class="changeslink">What changed<\/a><\/small>/);
  assert.match(header, /<a class="ghlink" href="https:\/\/github\.com\/Guru-RF\/sommerwire" /);
  assert.match(html, /:root\[data-skin="rfguru"\] \.brand-rf \{ display: flex;/);
});

test('a stored legacy theme choice is cleared and nothing reads a theme from storage or the URL', () => {
  assert.match(boot, /if \(!EMBED\) try \{ localStorage\.removeItem\('sw-skin'\); \} catch \(e\) \{/);
  assert.equal((html.match(/sw-skin/g) || []).length, 1, 'only the removal');
  // the only query parameter read is the presentation flag (?embed=1), never a theme
  assert.equal((html.match(/location\.search|URLSearchParams|searchParams/g) || []).length, 2);
  assert.match(html, /if \(new URLSearchParams\(location\.search\)\.get\('embed'\) === '1'\) document\.documentElement\.classList\.add\('embed'\);/);
  assert.doesNotMatch(html, /dataset\.skin|setAttribute\('data-skin'|\.skin\s*=/);
  // removing the key works where storage is allowed and is silent where it is blocked
  const line = boot.match(/^if \(!EMBED\) try \{ localStorage\.removeItem\('sw-skin'\);.*$/m)[0];
  const store = new Map([['sw-skin', 'koen'], ['wm-tab', 'sweep']]);
  vm.runInNewContext(line, { EMBED: false, localStorage: { removeItem: k => store.delete(k) } });
  assert.deepEqual([...store.keys()], ['wm-tab']);
  assert.doesNotThrow(() => vm.runInNewContext(line, { EMBED: false, localStorage: { removeItem() { throw new Error('SecurityError'); } } }));
  // the presentation (?embed=1) leaves storage alone
  vm.runInNewContext(line, { EMBED: true, localStorage: { removeItem() { throw new Error('touched'); } } });
});

test('no edition version: no badge, constant or footer version; What changed keeps its dated history', () => {
  assert.doesNotMatch(html, /SW_VERSION|SW_DATE|swVer/);
  assert.doesNotMatch(header, /\bv\d+\.\d+|version \d/i);
  // the footer keeps the historic upstream fix identifier (Koen's v1.1.1) but shows no edition version
  assert.doesNotMatch(footer.replace(/\bv1\.1\.1\b/g, ''), /\bv\d+\.\d+|version \d/i);
  assert.match(footer, /Koen’s v1\.1\.1 fix/);
  const sec = section('<h2 id="h-changes">', '<h2 id="h-licence">', help);
  assert.doesNotMatch(sec, /version \d/i);
  const heads = [...sec.matchAll(/<h3>([^<]*)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(heads, ['2026-11-28 · Callsign plates in the header', '2026-11-28 · Phone layout', '2026-11-28 · Embeddable 3D view, tidier band strip', '2026-11-28 · One theme, EFOC29 first', '2026-11-28 · Themes', '2026-11-28 · Model sharing and staged results', '2026-11-27']);
  assert.match(sec, /<b>RF\.Guru<\/b> is the only theme/);
  assert.match(sec, /opens the <b>RF\.Guru EFOC29<\/b> example with its eight bands/);
  // the share-link format number is the model encoding, not an edition version, and stays
  assert.match(read('share.js'), /const VERSION = 1, PREFIX = '#sw=';/);
  // What changed is linked from the header and the footer and opens the Help notes
  assert.equal((html.match(/class="changeslink"/g) || []).length, 2);
  assert.match(html, /\$\$\('\.changeslink'\)\.forEach\(a => a\.addEventListener\('click', showChanges\)\)/);
  assert.match(help, /<a href="#h-changes">What changed<\/a>/);
  const ledger = read('CONTRIBUTION-HISTORY.md');
  for (const [, pr] of sec.matchAll(/href="(https:\/\/github\.com\/Guru-RF\/sommerwire\/pull\/\d+)"/g)) {
    assert.ok(ledger.includes('](' + pr + ')'), 'cited PR is a recorded merge: ' + pr);
  }
});

// the app's examples and loadExample(), with the page stubbed
function appSandbox() {
  require(path.join(ROOT, 'engine.js')); require(path.join(ROOT, 'hexgen.js'));
  require(path.join(ROOT, 'structgen.js')); require(path.join(ROOT, 'efhwgen.js'));
  const nodes = {}, log = [];
  const ctx = vm.createContext({
    MM: globalThis.MM, WMStruct: globalThis.WMStruct, hexbeamFromTable: globalThis.hexbeamFromTable,
    rfGuruEfhwInvL: globalThis.rfGuruEfhwInvL, rfGuruEfoc29: globalThis.rfGuruEfoc29, clone: o => JSON.parse(JSON.stringify(o)),
    $: q => (nodes[q] = nodes[q] || { value: 'tot' }), loadModel: m => log.push(m), drawPatterns() {}
  });
  vm.runInContext(section('const NF_MODES', '/* ---------------- worker') + section('// G3TXQ dimension table', "$('#exampleSel').onchange"), ctx);
  return { ctx, nodes, log, run: c => vm.runInContext(c, ctx) };
}

test('an ordinary visit opens the existing RF.Guru EFOC29 eight-band example, exactly as the Examples menu does', () => {
  const { nodes, log, run } = appSandbox();
  const i = run('DEFAULT_EXAMPLE');
  assert.match(run('EXAMPLES[' + i + '].name'), /^RF\.Guru EFOC29 /);
  run('loadExample(DEFAULT_EXAMPLE)');
  const m = JSON.parse(JSON.stringify(log[0]));
  assert.deepEqual(m, JSON.parse(JSON.stringify(Object.assign(globalThis.rfGuruEfoc29(), { pol: 'hv' }))), 'the preset from efhwgen.js, not a copy');
  assert.deepEqual(m.bands, [3.6, 7.1, 10.125, 14.175, 18.118, 21.225, 24.94, 28.5]);
  assert.equal(nodes['#polSel'].value, 'hv');
  // the menu and the start use the same loader; the geometry exists once, in efhwgen.js
  assert.match(html, /\$\('#exampleSel'\)\.onchange = e => \{\n  if \(e\.target\.value === ''\) return;\n  loadExample\(\+e\.target\.value\); e\.target\.value = '';\n\};/);
  assert.match(boot, /if \(!shared\) loadExample\(DEFAULT_EXAMPLE\);/);
  assert.equal((html.match(/rfGuruEfoc29\(\)/g) || []).length, 1);
});

test('README, Help and the PR checklist describe one theme, the EFOC29 start and no version number', () => {
  assert.match(readme, /\*\*RF\.Guru theme\*\*: the only look of this edition/);
  assert.match(readme, /\*\*Opens on the RF\.Guru EFOC29\*\*/);
  assert.doesNotMatch(readme, /Koen \(original\)|\*\*Themes\*\*|version under the name/);
  assert.match(readme, /<https:\/\/github\.com\/Guru-RF\/sommerwire>/);
  assert.match(readme, /<https:\/\/github\.com\/KoenVdH\/sommerwire>/);
  assert.doesNotMatch(help, /the version you are running/);
  assert.doesNotMatch(read('.github/PULL_REQUEST_TEMPLATE.md'), /SW_VERSION|SW_DATE|Koen \(original\)|footer version/);
});

test('the single theme touches no solver, model or share-link code', () => {
  for (const f of ['engine.js', 'share.js', 'efhwgen.js', 'structgen.js', 'hexgen.js']) assert.doesNotMatch(read(f), /data-skin|SWTheme|sw-skin/);
});
