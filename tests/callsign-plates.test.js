// Footer callsign plates: two Belgian-style plates, Koen first, each one keyboard-reachable link with the full name
// in its accessible text, drawn locally (no remote image), hidden with the rest of the footer in ?embed=1.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), help = read('help.html'), readme = read('README.md');
function section(start, end, src = html) {
  const i = src.indexOf(start), j = src.indexOf(end, i);
  assert.ok(i >= 0 && j > i, 'section ' + start);
  return src.slice(i, j);
}
const footer = section('<footer>', '</footer>');
const plates = section('<p class="plates">', '</p>', footer);
const links = [...plates.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
const text = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('two plates in the footer credit, Koen first, each linking to the verified page', () => {
  assert.equal(links.length, 2);
  const expected = [
    ['ON9PK', 'Koen Van den Heuvel', 'https://www.qrz.com/db/ON9PK'],
    ['ON6URE', 'Joeri Van Dooren', 'https://on6ure.be/'],
  ];
  links.forEach(([, attrs, body], i) => {
    const [call, name, href] = expected[i];
    assert.match(attrs, new RegExp('href="' + href.replace(/[./]/g, '\\$&') + '"'));
    assert.match(attrs, /class="plate-link"/);
    assert.match(attrs, /target="_blank" rel="noopener"/);
    assert.match(body, new RegExp('<span class="plate-call">' + call + '</span>'));
    // the accessible name (the plate itself is aria-hidden) carries the callsign and the full name
    assert.match(body, /^<span class="plate" aria-hidden="true">/);
    const spoken = text(body.slice(body.indexOf('<span class="plate-name">')));
    assert.ok(spoken.startsWith(call + ' ' + name), spoken);
  });
  // the plates sit right after the existing byline, which keeps both full names and Joeri's inline link
  assert.ok(footer.indexOf('<p class="author">') < footer.indexOf('<p class="plates">'));
  assert.ok(footer.indexOf('<p class="plates">') < footer.indexOf('<details'));
});

test('plates are drawn locally: no remote images or copied raster assets, no inferred personal domain', () => {
  assert.doesNotMatch(plates, /<img\b|url\(|https?:\/\/(?!www\.qrz\.com\/db\/ON9PK"|on6ure\.be\/")/);
  assert.match(plates, /<path id="euStar"/);
  assert.equal((plates.match(/<use href="#euStar"/g) || []).length, 12);
  assert.equal((plates.match(/<use href="#euStars"\/>/g) || []).length, 2);
  assert.doesNotMatch(html, /koen[a-z]*\.(?:be|com|net|org|eu)/i);
});

test('plate styling: focus ring, readable colours, wraps on narrow screens, touch-sized on phones', () => {
  assert.match(html, /footer \.plate-link:focus-visible \{ outline: 2px solid var\(--accent\)/);
  assert.match(html, /footer \.plates \{ display: flex; flex-wrap: wrap;/);
  assert.match(html, /footer \.plate-call \{[^}]*color: #b3132b;/);
  assert.match(html, /footer \.plate \{[^}]*background: #ffffff;/);
  assert.match(html, /html:not\(\.embed\) footer \.plate-link \{ min-height: 44px; \}/);
  // contrast of the plate colours (WCAG relative luminance)
  const lum = hex => {
    const c = hex.match(/\w\w/g).map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(ratio('b3132b', 'ffffff') >= 4.5, 'red callsign on white');
  assert.ok(ratio('ffffff', '003399') >= 4.5, 'white B on EU blue');
  assert.ok(ratio('ecc34a', '08090c') >= 3, 'gold focus ring on the dark page');
});

test('embed still hides the footer, and the change is noted in Help and README without a version', () => {
  assert.match(html, /html\.embed \.wrap > :not\(#bandRes\):not\(#shareNote\):not\(\[data-panel="view"\]\) \{ display: none !important; \}/);
  const changes = help.slice(help.indexOf('<h2 id="h-changes">'));
  assert.match(changes.slice(0, changes.indexOf('</ul>')), /<h3>2026-11-28 · Callsign plates in the credits<\/h3>/);
  assert.match(readme, /\*\*Callsign plates\*\*/);
  assert.doesNotMatch(plates, /version \d|\bv\d+\.\d+/i);
});
