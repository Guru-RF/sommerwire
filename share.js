/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* Share links: the editable model in the URL fragment, with no server.
 *
 *   https://…/index.html#sw=1.d.<base64url>
 *          version ─┘ │ └─ payload: UTF-8 JSON { app: 'sommerwire', v: 1, f, view, model }
 *            codec ───┘    d = deflate-raw (CompressionStream), j = uncompressed
 *
 * The link carries the model as it is edited (expressions such as R/4 included), the calculation frequency and the
 * pattern polarization view; never results. Opening it solves the model again, as any other model.
 * Browsers do not send the part after # to the web server, but anyone who has the link can read the model.
 *
 * A link is untrusted input. decode() bounds every step (fragment length, decompressed size, JSON), then sanitize()
 * builds a fresh model from a whitelist of fields with type, length and range checks (nothing of the parsed object is
 * copied wholesale, so keys such as __proto__ go nowhere), and estimate() bounds the work the first solve would start
 * (segments at the highest frequency solved on opening, house grid wires) before anything is loaded or calculated.
 * Needs MM (engine.js) for expressions and materials. No dependencies. */
(function (root) {
  const VERSION = 1, PREFIX = '#sw=';
  const LIMITS = {
    link: 32000,          // characters of the whole link Share will make (longer: use Save .maa)
    fragment: 64000,      // characters of the fragment decode() will look at
    json: 512 * 1024,     // bytes of JSON after decompression
    wires: 3000, sources: 64, loads: 1000, tls: 200, objects: 8, bands: 16,
    cell: 100,            // characters of one table cell (number or expression)
    pos: 32, name: 200, comment: 20000, insWires: 200,
    coord: 1e5,           // metres, any evaluated coordinate
    segments: 25000,      // estimated segments at the highest frequency solved on opening
    houseWires: 4000,     // estimated grid, gutter and downpipe wires of all houses
    fMin: 0.01, fMax: 10000   // MHz
  };
  const POL = ['tot', 'h', 'v', 'hv', 'all'];

  class ShareError extends Error {}
  const fail = msg => { throw new ShareError(msg); };
  const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const isObj = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const MMx = () => root.MM || fail('The engine is not loaded.');

  /* ---------- schema: a fresh model from whitelisted fields ---------- */
  function str(v, max, what) {
    if (typeof v !== 'string') fail(what + ' must be text.');
    if (v.length > max) fail(what + ' is longer than ' + max + ' characters.');
    return v;
  }
  // a table cell: the text as typed (number or expression), or a number
  function cell(v, what) {
    if (typeof v === 'number') { if (!Number.isFinite(v)) fail(what + ' is not a finite number.'); return v; }
    return str(v, LIMITS.cell, what);
  }
  function oneOf(v, list, what) { if (!list.includes(v)) fail(what + ' has an unsupported value.'); return v; }
  function intOf(v, list, what) {
    const n = typeof v === 'string' && /^-?\d+$/.test(v) ? +v : v;
    if (!Number.isInteger(n) || !list.includes(n)) fail(what + ' has an unsupported value.');
    return n;
  }
  function arr(v, max, what) {
    if (!Array.isArray(v)) fail(what + ' must be a list.');
    if (v.length > max) fail(what + ': ' + v.length + ' entries, at most ' + max + ' in a link.');
    return v;
  }
  function freqOf(v, what) {
    const f = typeof v === 'number' ? v : typeof v === 'string' && v.length <= 32 ? +v : NaN;
    if (!(f >= LIMITS.fMin && f <= LIMITS.fMax)) fail(what + ' must be a frequency from ' + LIMITS.fMin + ' to ' + LIMITS.fMax + ' MHz.');
    return f;
  }
  // copy the listed cell fields that are present (absent ones stay absent, as in the app)
  function cells(src, keys, what, out = {}) {
    if (!isObj(src)) fail(what + ' must be an object.');
    keys.forEach(k => { if (own(src, k) && src[k] !== undefined && src[k] !== null) out[k] = cell(src[k], what + ' ' + k); });
    return out;
  }
  const WIRE = ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'r', 'seg'];
  function sanitizeModel(m) {
    if (!isObj(m)) fail('The link holds no model.');
    const mm = MMx(), out = {};
    out.name = own(m, 'name') ? str(m.name, LIMITS.name, 'The name') : '';
    out.freq = freqOf(m.freq, 'The design frequency');
    out.comment = own(m, 'comment') && m.comment != null ? str(m.comment, LIMITS.comment, 'The comment') : '';
    out.wires = arr(m.wires, LIMITS.wires, 'Wires').map((w, i) => {
      const c = cells(w, WIRE, 'Wire ' + (i + 1));
      WIRE.forEach(k => { if (!own(c, k)) fail('Wire ' + (i + 1) + ' has no ' + k + '.'); });
      return c;
    });
    if (!out.wires.length) fail('The model has no wires.');
    out.sources = arr(own(m, 'sources') ? m.sources : [], LIMITS.sources, 'Sources').map((s, i) => {
      const o = cells(s, ['phase', 'mag', 'ratio'], 'Source ' + (i + 1));
      o.pos = str(s.pos, LIMITS.pos, 'Source ' + (i + 1) + ' position');
      return o;
    });
    out.loads = arr(own(m, 'loads') ? m.loads : [], LIMITS.loads, 'Loads').map((l, i) => {
      const o = cells(l, ['L', 'C', 'Q', 'Qc', 'Cp', 'R', 'X'], 'Load ' + (i + 1));
      o.pos = str(l.pos, LIMITS.pos, 'Load ' + (i + 1) + ' position');
      o.type = intOf(own(l, 'type') ? l.type : 0, [0, 1, 2], 'Load ' + (i + 1) + ' type');
      return o;
    });
    out.tls = arr(own(m, 'tls') ? m.tls : [], LIMITS.tls, 'Transmission lines').map((t, i) => {
      const o = cells(t, ['z0', 'vf', 'len', 'loss', 'lossF'], 'Line ' + (i + 1));
      o.p1 = str(t.p1, LIMITS.pos, 'Line ' + (i + 1) + ' end 1');
      o.p2 = str(t.p2, LIMITS.pos, 'Line ' + (i + 1) + ' end 2');
      if (own(t, 'rev')) { if (typeof t.rev !== 'boolean') fail('Line ' + (i + 1) + ' reversed must be true or false.'); o.rev = t.rev; }
      return o;
    });
    out.objects = arr(own(m, 'objects') ? m.objects : [], LIMITS.objects, 'Houses').map((h, i) => {
      const what = 'House ' + (i + 1);
      const o = cells(h, ['x', 'y', 'len', 'wid', 'eave', 'ridge', 'rot', 'grid', 'rEarth'], what, { type: 'house' });
      if (own(h, 'type')) oneOf(h.type, ['house'], what + ' type');
      if (own(h, 'roof')) o.roof = oneOf(h.roof, ['metal', 'none'], what + ' roof');
      if (own(h, 'gutters')) o.gutters = oneOf(h.gutters, ['metal', 'none'], what + ' gutters');
      if (own(h, 'pipes')) o.pipes = intOf(h.pipes, [0, 2, 4], what + ' downpipes');
      return o;
    });
    const seg = own(m, 'seg') ? m.seg : {};
    if (!isObj(seg)) fail('Segmentation must be an object.');
    // the effective values numericModel() uses (+v || default), bounded so segmentation always ends
    const SEG = { dm1: [400, 1, 20000], dm2: [40, 1, 2000], sc: [2, 0.1, 100], ec: [1, 0, 100] };
    out.seg = {};
    Object.keys(SEG).forEach(k => {
      if (!own(seg, k)) return;
      const [d, lo, hi] = SEG[k], v = typeof seg[k] === 'number' || typeof seg[k] === 'string' ? +seg[k] || d : NaN;
      if (!(v >= lo && v <= hi)) fail('Segmentation ' + k + ' must be from ' + lo + ' to ' + hi + '.');
      out.seg[k] = v;
    });
    const g = own(m, 'ground') ? m.ground : {};
    out.ground = cells(g, ['height', 'eps', 'sigma'], 'Ground');
    if (own(g, 'type')) out.ground.type = intOf(g.type, [0, 1, 2], 'Ground type');
    if (own(g, 'nf')) out.ground.nf = oneOf(g.nf, ['sommerfeld', 'complex', 'perfect'], 'Ground method');
    if (own(m, 'material')) out.material = intOf(m.material, mm.MATERIALS.map((_, i) => i), 'Wire material');
    if (own(m, 'z0')) out.z0 = cell(m.z0, 'Reference impedance');
    const ins = own(m, 'ins') ? m.ins : {};
    out.ins = cells(ins, ['t', 'er', 'tand'], 'Insulation');
    if (own(ins, 'wires') && ins.wires != null) {
      out.ins.wires = str(ins.wires, LIMITS.insWires, 'Insulated wires');
      // wire numbers beyond the limit cannot name a wire; refusing them also keeps range loops short
      if ((out.ins.wires.match(/\d+/g) || []).some(d => d.length > 5 || +d > LIMITS.wires)) fail('Insulated wires names a wire number above ' + LIMITS.wires + '.');
    }
    const boom = own(m, 'boom') ? m.boom : {};
    out.boom = cells(boom, ['d'], 'Boom');
    if (own(boom, 'mount')) out.boom.mount = oneOf(boom.mount, ['none', 'bonded', 'insulated'], 'Boom mount');
    if (own(boom, 'axis')) out.boom.axis = oneOf(boom.axis, ['x', 'y', 'z'], 'Boom axis');
    out.bands = arr(own(m, 'bands') ? m.bands : [], LIMITS.bands, 'Band frequencies').map((f, i) => freqOf(f, 'Band frequency ' + (i + 1)));
    return out;
  }

  /* ---------- resources: what opening the link would make the solver build ---------- */
  // Upper bound of the segment count of segmentLengths() in engine.js: the taper (dmin doubling to dmax) on both
  // ends plus the middle at dmax, or the explicit count.
  function wireSegments(L, mode, lambda, seg, radius) {
    if (!(L > 0) || !(radius > 0)) return 0;
    if (mode > 0) return Math.round(mode) + 1;
    const dmax = lambda / seg.dm2, dmin = Math.min(dmax, Math.max(lambda / (seg.sc * seg.dm1), 2 * radius));
    const taper = dmin > 0 && dmin < dmax ? Math.ceil(Math.log2(dmax / dmin)) + 1 : 0;
    return Math.ceil(L / dmax) + 2 + 2 * taper;
  }
  // houses: grid wires of each roof plane (see roofWires in structgen.js), gutters and downpipes
  function houseWires(o, ev) {
    const len = Math.max(0.5, ev(o.len) || 10), wid = Math.max(0.5, ev(o.wid) || 8);
    const eave = Math.max(0, ev(o.eave) || 0), ridge = Math.max(eave, ev(o.ridge) || 0);
    if (![len, wid, eave, ridge].every(v => v <= LIMITS.coord)) return Infinity;
    let n = 2 + 4;
    if (o.roof === 'metal') {
      const s = Math.max(0.1, ev(o.grid) || 1), slope = ridge > eave ? Math.hypot(wid / 2, ridge - eave) : wid;
      const nu = Math.max(1, Math.round(len / s)), nv = Math.max(1, Math.round(slope / s));
      n += (ridge > eave ? 2 : 1) * ((nv + 1) * nu + (nu + 1) * nv);
    }
    return n;
  }
  function estimate(model, freqs) {
    const mm = MMx();
    const lam = mm.lambdaOf(+model.freq), ev = v => mm.evalExpr(v, lam);
    const fMax = Math.max(...freqs.filter(f => f > 0)), lambda = mm.lambdaOf(fMax);
    const seg = { dm1: +model.seg.dm1 || 400, dm2: +model.seg.dm2 || 40, sc: +model.seg.sc || 2 };
    let segments = 0, house = 0;
    model.wires.forEach((w, i) => {
      const p = ['x1', 'y1', 'z1', 'x2', 'y2', 'z2'].map(k => ev(w[k]));
      if (p.some(v => Number.isFinite(v) && Math.abs(v) > LIMITS.coord)) fail('Wire ' + (i + 1) + ' reaches beyond ' + LIMITS.coord + ' m.');
      const n = Math.round(ev(w.seg)) || 0;
      if (Math.abs(n) > LIMITS.segments) fail('Wire ' + (i + 1) + ' asks for ' + n + ' segments.');
      if (!p.every(Number.isFinite)) return;   // the calculation reports it; it builds nothing
      segments += wireSegments(Math.hypot(p[3] - p[0], p[4] - p[1], p[5] - p[2]), n, lambda, seg, Math.abs(ev(w.r)) / 1000);
    });
    model.objects.forEach(o => { house += houseWires(o, ev); });
    if (!(house <= LIMITS.houseWires)) fail('The houses would make more than ' + LIMITS.houseWires + ' grid wires.');
    // house wires use automatic segmentation; a grid wire is short, count a full taper for each
    segments += house * wireSegments(1, -1, lambda, seg, 0.01);
    if (!(segments <= LIMITS.segments)) fail('The model would need about ' + Math.round(segments) + ' segments at ' + fMax + ' MHz, more than ' + LIMITS.segments + '.');
    return { segments, houseWires: house, fMax };
  }

  // the snapshot the app shares: { model, calcFreq, view: { pol } } -> a clean copy, checked
  function sanitize(snap) {
    if (!isObj(snap)) fail('The link holds no model.');
    const model = sanitizeModel(snap.model);
    const calcFreq = snap.calcFreq !== undefined ? freqOf(snap.calcFreq, 'The calculation frequency') : model.freq;
    const view = {};
    if (isObj(snap.view) && own(snap.view, 'pol')) view.pol = oneOf(snap.view.pol, POL, 'The pattern view');
    const est = estimate(model, [calcFreq, model.freq].concat(model.bands));
    return { model, calcFreq, view, estimate: est };
  }

  /* ---------- bytes ---------- */
  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(t) {
    let s;
    try { s = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); } catch (e) { fail('The link is damaged (not valid base64).'); }
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const canDeflate = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  // run bytes through a (de)compression stream, stopping as soon as the output passes cap
  async function through(bytes, stream, cap) {
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
    const parts = []; let total = 0;
    for (;;) {
      let r;
      try { r = await reader.read(); } catch (e) { fail('The link is damaged (the compressed data does not unpack).'); }
      if (r.done) break;
      total += r.value.length;
      if (total > cap) { try { await reader.cancel(); } catch (e) { /* already closed */ } fail('The model in the link unpacks to more than ' + Math.round(cap / 1024) + ' KiB.'); }
      parts.push(r.value);
    }
    const out = new Uint8Array(total); let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }

  const isShareHash = h => typeof h === 'string' && h.startsWith(PREFIX);

  // snapshot -> '#sw=1.d.…' (throws ShareError if the model does not fit in a link)
  async function encode(snap) {
    const s = sanitize(snap);
    const json = JSON.stringify({ app: 'sommerwire', v: VERSION, f: s.calcFreq, view: s.view, model: s.model });
    let bytes = new TextEncoder().encode(json), codec = 'j';
    if (bytes.length > LIMITS.json) fail('The model is ' + Math.round(bytes.length / 1024) + ' KiB, too large for a link.');
    if (canDeflate()) { bytes = await through(bytes, new CompressionStream('deflate-raw'), LIMITS.json); codec = 'd'; }
    return PREFIX + VERSION + '.' + codec + '.' + b64url(bytes);
  }

  // '#sw=…' -> { model, calcFreq, view } or a ShareError that says why
  async function decode(hash) {
    if (!isShareHash(hash)) fail('This is not a Sommerwire share link.');
    if (hash.length > LIMITS.fragment) fail('The link is longer than ' + LIMITS.fragment + ' characters.');
    const m = /^(\d{1,4})\.([a-z])\.([A-Za-z0-9_-]*)$/.exec(hash.slice(PREFIX.length));
    if (!m) fail('The link is damaged (unknown layout).');
    const ver = +m[1];
    if (ver !== VERSION) fail(ver > VERSION ? 'The link was made by a newer Sommerwire (link version ' + ver + '); reload the page to get the latest version.' : 'Unsupported link version ' + ver + '.');
    let bytes = unb64url(m[3]);
    if (m[2] === 'd') {
      if (!canDeflate()) fail('This browser cannot unpack compressed links; open the link in a current browser.');
      bytes = await through(bytes, new DecompressionStream('deflate-raw'), LIMITS.json);
    } else if (m[2] !== 'j') fail('The link uses an unknown encoding.');
    if (bytes.length > LIMITS.json) fail('The model in the link is larger than ' + Math.round(LIMITS.json / 1024) + ' KiB.');
    let obj;
    try { obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch (e) { fail('The link is damaged (the model is not readable).'); }
    if (!isObj(obj) || obj.app !== 'sommerwire') fail('The link does not hold a Sommerwire model.');
    if (obj.v !== VERSION) fail(typeof obj.v === 'number' && obj.v > VERSION ? 'The link was made by a newer Sommerwire; reload the page to get the latest version.' : 'Unsupported model version in the link.');
    try { return sanitize({ model: obj.model, calcFreq: own(obj, 'f') ? obj.f : undefined, view: obj.view }); }
    catch (e) { if (e instanceof ShareError) throw e; fail('The model in the link is not valid.'); }
  }

  root.SWShare = { VERSION, PREFIX, LIMITS, ShareError, isShareHash, sanitize, estimate, encode, decode, canDeflate };
})(typeof globalThis !== 'undefined' ? globalThis : self);
