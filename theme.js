// Sommerwire themes: "rfguru" (default on the RF.Guru fork) or "koen" (Koen's original look, which follows the OS
// light/dark setting). Loaded synchronously in <head> of index.html and help.html so the page paints in the right theme.
// The choice is kept in localStorage when the browser allows it; if storage is blocked the theme still switches for
// the open page and the next visit starts on the default. Only the look changes: no model, result or solver setting.
(function (root) {
  'use strict';
  const KEY = 'sw-skin', THEMES = ['rfguru', 'koen'], DEFAULT = 'rfguru';
  const ICONS = { rfguru: 'brand/icon-rfguru.svg', koen: 'brand/icon.svg' };
  const valid = t => THEMES.includes(t);
  function stored() {
    try { const t = root.localStorage.getItem(KEY); return valid(t) ? t : null; } catch (e) { return null; }
  }
  function apply(t) {
    if (!valid(t)) t = DEFAULT;
    const doc = root.document, el = doc.documentElement;
    if (el.dataset.skin !== t) el.dataset.skin = t;
    const icon = doc.querySelector('link[rel="icon"]');
    if (icon && icon.getAttribute('href') !== ICONS[t]) icon.setAttribute('href', ICONS[t]);
    doc.querySelectorAll('[data-skin-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skinBtn === t)));
    return t;
  }
  // returns true when the choice was saved for later visits
  function set(t) {
    t = apply(t);
    try { root.localStorage.setItem(KEY, t); return true; } catch (e) { return false; }
  }
  function bind() {
    // the visible Theme switch: one button per theme, the current one pressed
    root.document.querySelectorAll('[data-skin-btn]').forEach(b => b.addEventListener('click', () => set(b.dataset.skinBtn)));
  }
  apply(stored() || DEFAULT);
  const ready = () => { apply(root.document.documentElement.dataset.skin); bind(); };
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', ready);
  else ready();
  // another open Sommerwire page (the app or standalone Help) changed the theme
  root.addEventListener('storage', e => { if (e.key === KEY) apply(valid(e.newValue) ? e.newValue : DEFAULT); });
  root.SWTheme = { THEMES, DEFAULT, KEY, get: () => root.document.documentElement.dataset.skin, set, apply };
})(typeof window !== 'undefined' ? window : globalThis);
