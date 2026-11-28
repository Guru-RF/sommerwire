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
const header = section('<header class="top">', '</header>');
const headnav = section('<div class="headnav">', '</div>', header);
const byline = section('<p class="author">', '</p>', footer);
const links = src => [...src.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
const expected = [
  ['ON9PK', 'Koen Van den Heuvel', 'https://www.qrz.com/db/ON9PK', 'QRZ.com'],
  ['ON6URE', 'Joeri Van Dooren', 'https://on6ure.be/', 'on6ure.be'],
];

test('header links place Koen and Joeri immediately before GitHub', () => {
  const headerLinks = links(headnav);
  assert.equal(headerLinks.length, 3);
  assert.match(headerLinks[2][1], /class="ghlink"/);
  expected.forEach(([call, name, href, site], i) => {
    const [, attrs, body] = headerLinks[i];
    assert.ok(attrs.includes(`href="${href}"`));
    assert.match(attrs, /class="plate-link"/);
    assert.match(attrs, /target="_blank" rel="noopener"/);
    assert.ok(attrs.includes(`aria-label="${call} ${name} (${site}, opens in a new tab)"`));
    assert.ok(body.includes(`<span class="plate-call">${call}</span>`));
    assert.match(body, /^<span class="plate" aria-hidden="true">/);
  });
});

test('footer byline links each complete callsign and name to its plate URL', () => {
  assert.doesNotMatch(footer, /class="plate[\s"-]/);
  const bylineLinks = links(byline);
  expected.forEach(([call, name, href], i) => {
    const [, attrs, body] = bylineLinks[i];
    assert.equal(body, `${call} ${name}`);
    assert.ok(attrs.includes(`href="${href}"`));
  });
});

test('plates are drawn locally: no remote images or copied raster assets, no inferred personal domain', () => {
  assert.doesNotMatch(headnav, /<img\b|url\(|https?:\/\/(?!www\.qrz\.com\/db\/ON9PK"|on6ure\.be\/"|github\.com\/Guru-RF\/sommerwire")/);
  assert.match(headnav, /<path id="euStar"/);
  assert.equal((headnav.match(/<use href="#euStar"/g) || []).length, 12);
  assert.equal((headnav.match(/<use href="#euStars"\/>/g) || []).length, 2);
  assert.doesNotMatch(html, /koen[a-z]*\.(?:be|com|net|org|eu)/i);
});

test('plate styling: focus ring, readable colours, wraps on narrow screens, touch-sized on phones', () => {
  assert.match(html, /\.headnav \.plate-link:focus-visible \{ outline: 2px solid var\(--accent\)/);
  assert.match(html, /\.headnav \{ display: flex; flex-wrap: wrap;/);
  assert.match(html, /\.headnav \.plate-call \{[^}]*color: #b3132b;/);
  assert.match(html, /\.headnav \.plate \{[^}]*background: #ffffff;/);
  assert.match(html, /html:not\(\.embed\) \.headnav \.plate-link \{ min-height: 44px; \}/);
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

test('embed still hides the header and footer, and the change is noted in Help and README without a version', () => {
  assert.match(html, /html\.embed \.wrap > :not\(#bandRes\):not\(#shareNote\):not\(\[data-panel="view"\]\) \{ display: none !important; \}/);
  const changes = section('<h2 id="h-changes">', '<h2 id="h-licence">', help);
  assert.match(changes, /<h3>2026-11-28 · Callsign plates in the header<\/h3>/);
  assert.match(readme, /\*\*Callsign plates\*\*/);
  assert.doesNotMatch(headnav, /version \d|\bv\d+\.\d+/i);
});
