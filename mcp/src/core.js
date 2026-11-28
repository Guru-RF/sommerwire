/* Sommerwire — by ON9PK Koen Van den Heuvel. Free and unencumbered software released into the public domain (see LICENSE, https://unlicense.org). */
/* What the MCP tools do, without the protocol: strict argument schemas, one model source turned into the app's
 * editable model, validation with the share-link bounds, assumptions and labels, share links and .maa export.
 * Solving runs in an isolated worker (see solver.js); everything here is bounded and synchronous or nearly so. */
import * as z from 'zod';
import { loadApp, plain } from './app.js';

export const { MM, SWShare, app } = loadApp();
const { LIMITS } = SWShare;
export const SHARE_BASE = 'https://sommerwire.app/';
export const MAX_UNKNOWNS = 2500;   // the engine's own limit (engine.js)

/* ---------- budgets ---------- */
const envInt = (name, def, lo, hi) => {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(name + ' must be an integer from ' + lo + ' to ' + hi + '.');
  return n;
};
export const BUDGET = {
  messageBytes: 1024 * 1024,                    // one JSON-RPC line on stdin
  modelBytes: LIMITS.json,                       // the model argument as JSON, as a share link's payload
  maaBytes: LIMITS.json,                         // .maa text
  linkChars: LIMITS.fragment + 256,              // a share link (URL plus fragment)
  segments: LIMITS.segments, houseWires: LIMITS.houseWires, unknowns: MAX_UNKNOWNS,
  frequencies: 1 + LIMITS.bands,                 // the calculation frequency and the model's bands
  solveMs: envInt('SOMMERWIRE_MCP_SOLVE_TIMEOUT_MS', 120000, 1000, 600000),
  concurrency: envInt('SOMMERWIRE_MCP_MAX_SOLVES', 1, 1, 4),
  workerHeapMb: envInt('SOMMERWIRE_MCP_WORKER_HEAP_MB', 512, 64, 4096)
};

/* ---------- schemas (the share-link whitelist, strict: unknown keys are refused, not dropped) ---------- */
const Cell = z.union([z.number().finite(), z.string().max(LIMITS.cell)]).describe('A number, or the text of a table cell (number or expression such as R/4; R = wavelength, I = inch, F = foot).');
const Pos = z.string().max(LIMITS.pos).describe('Position on a wire: w<number> then b (begin), c (centre) or e (end), e.g. w1c.');
const Freq = z.union([z.number(), z.string().max(32)]);
const Wire = z.strictObject({ x1: Cell, y1: Cell, z1: Cell, x2: Cell, y2: Cell, z2: Cell, r: Cell.describe('Radius in mm.'), seg: Cell.describe('Segments: -1 automatic taper, 0 uniform, N fixed.') });
const Source = z.strictObject({ pos: Pos, phase: Cell.optional().describe('Degrees; default 0.'), mag: Cell.optional().describe('Volts; default 1.'), ratio: Cell.optional().describe('Ideal lossless transformer ratio (Balun) on the source, e.g. 4 or 49.') });
const Load = z.strictObject({ pos: Pos, type: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('0 series LC, 1 R + jX, 2 parallel LC (trap).'),
  L: Cell.optional(), C: Cell.optional(), Q: Cell.optional(), Qc: Cell.optional(), Cp: Cell.optional(), R: Cell.optional(), X: Cell.optional() });
const Line = z.strictObject({ p1: Pos, p2: Pos, z0: Cell.optional(), vf: Cell.optional(), len: Cell.optional(), loss: Cell.optional(), lossF: Cell.optional(), rev: z.boolean().optional() });
const House = z.strictObject({ type: z.literal('house').optional(), x: Cell.optional(), y: Cell.optional(), len: Cell.optional(), wid: Cell.optional(), eave: Cell.optional(), ridge: Cell.optional(),
  rot: Cell.optional(), grid: Cell.optional(), rEarth: Cell.optional(), roof: z.enum(['metal', 'none']).optional(), gutters: z.enum(['metal', 'none']).optional(),
  pipes: z.union([z.literal(0), z.literal(2), z.literal(4)]).optional() });
const SegNum = z.union([z.number(), z.string().max(32)]).optional();
export const ModelSchema = z.strictObject({
  name: z.string().max(LIMITS.name).optional(),
  freq: Freq.describe('Design frequency in MHz (' + LIMITS.fMin + ' to ' + LIMITS.fMax + '); expressions with R use its wavelength.'),
  comment: z.string().max(LIMITS.comment).optional(),
  wires: z.array(Wire).min(1).max(LIMITS.wires),
  sources: z.array(Source).max(LIMITS.sources).optional(),
  loads: z.array(Load).max(LIMITS.loads).optional(),
  tls: z.array(Line).max(LIMITS.tls).optional(),
  objects: z.array(House).max(LIMITS.objects).optional(),
  seg: z.strictObject({ dm1: SegNum, dm2: SegNum, sc: SegNum, ec: SegNum }).optional(),
  ground: z.strictObject({ type: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('0 free space, 1 perfect ground, 2 real ground.'),
    height: Cell.optional(), eps: Cell.optional(), sigma: Cell.optional(), nf: z.enum(['sommerfeld', 'complex', 'perfect']).optional().describe('Real-ground method for the impedance.') }).optional(),
  material: z.number().int().min(0).max(MM.MATERIALS.length - 1).optional().describe('Wire material: ' + MM.MATERIALS.map((m, i) => i + ' ' + m.name).join(', ') + '.'),
  z0: Cell.optional().describe('Reference impedance for SWR, ohm.'),
  ins: z.strictObject({ t: Cell.optional(), er: Cell.optional(), tand: Cell.optional(), wires: z.string().max(LIMITS.insWires).optional() }).optional(),
  boom: z.strictObject({ d: Cell.optional(), mount: z.enum(['none', 'bonded', 'insulated']).optional(), axis: z.enum(['x', 'y', 'z']).optional() }).optional(),
  bands: z.array(Freq).max(LIMITS.bands).optional()
}).describe('A Sommerwire model as the app edits it (the share-link model schema).');

export const EXAMPLE_NAMES = app.EXAMPLES.map(e => e.name);
export const DEFAULT_EXAMPLE_NAME = EXAMPLE_NAMES[app.DEFAULT_EXAMPLE];
export const SourceShape = {
  model: ModelSchema.optional(),
  share_link: z.string().max(BUDGET.linkChars).optional().describe('A Sommerwire share link (https://…/#sw=1.…) or just its #sw= fragment.'),
  maa: z.string().max(BUDGET.maaBytes).optional().describe('The text of an MMANA-GAL .maa file.'),
  example: z.enum(EXAMPLE_NAMES).optional().describe('A built-in example by name. The app opens with "' + DEFAULT_EXAMPLE_NAME + '".')
};
export const FreqArg = z.number().min(LIMITS.fMin).max(LIMITS.fMax);
export const POLS = ['tot', 'h', 'v', 'hv', 'all'];

export class InputError extends Error {}
const fail = m => { throw new InputError(m); };

/* ---------- one source -> the app's editable model ---------- */
function fragmentOf(link) {
  const t = link.trim(), i = t.indexOf('#sw=');
  if (i < 0) fail('share_link holds no #sw= fragment.');
  if (i > 0 && !/^https?:\/\/[^\s#]+$/.test(t.slice(0, i))) fail('share_link must be a link (http or https) or a bare #sw= fragment.');
  return t.slice(i);
}
const shareFail = e => { if (e instanceof SWShare.ShareError || (e && e.constructor && e.constructor.name === 'ShareError')) fail(e.message); throw e; };

// -> { model, calcFreq, view, estimate, source }
export async function resolveSource(args) {
  const given = ['model', 'share_link', 'maa', 'example'].filter(k => args[k] !== undefined);
  if (given.length !== 1) fail('Give exactly one model source: model, share_link, maa or example' + (given.length ? ' (got ' + given.join(', ') + ').' : '.'));
  const kind = given[0];
  let snap;
  try {
    if (kind === 'share_link') {
      const s = await SWShare.decode(fragmentOf(args.share_link));
      snap = { model: s.model, calcFreq: s.calcFreq, view: s.view };
    } else if (kind === 'model') {
      if (Buffer.byteLength(JSON.stringify(args.model)) > BUDGET.modelBytes) fail('The model is larger than ' + BUDGET.modelBytes / 1024 + ' KiB as JSON.');
      // the app always writes phase and magnitude on a source; absent here, they get the app's defaults (0°, 1 V)
      snap = { model: Object.assign({}, args.model, args.model.sources ? { sources: args.model.sources.map(s => Object.assign({ phase: 0, mag: 1 }, s)) } : {}) };
    } else if (kind === 'maa') {
      let m;
      try { m = app.modelFromMAA(args.maa); } catch (e) { fail('The .maa text could not be read: ' + (e.message || e)); }
      snap = { model: plain(m) };
    } else {
      const ex = app.EXAMPLES[EXAMPLE_NAMES.indexOf(args.example)];
      snap = { model: plain(app.buildExample(ex)), view: ex.pol ? { pol: ex.pol } : {} };
    }
    if (args.frequency !== undefined) snap.calcFreq = args.frequency;
    // the share bounds: whitelist, lengths, ranges, coordinates, segment and house-wire estimate at every frequency
    const s = SWShare.sanitize(snap);
    return { model: plain(s.model), calcFreq: s.calcFreq, view: plain(s.view), estimate: plain(s.estimate), source: kind };
  } catch (e) { return shareFail(e); }
}

/* ---------- validation beyond the share bounds: what the solver would refuse or ignore ---------- */
const POS_RE = /^\s*w\s*(\d+)\s*([bce])\s*$/i;
export function prepare(r) {
  const edit = app.normalize(plain(r.model));
  let num;
  try { num = plain(app.numericModel(edit)); } catch (e) { fail(e.message || String(e)); }
  const total = num.wires.length, user = edit.wires.length;
  const posOk = (p, what) => {
    const m = POS_RE.exec(String(p));
    if (!m) fail(what + ' "' + p + '" is not a wire position such as w1c.');
    if (+m[1] < 1 || +m[1] > total) fail(what + ' "' + p + '" names wire ' + m[1] + ', but the model has ' + total + ' wires.');
  };
  edit.sources.forEach((s, i) => posOk(s.pos, 'Source ' + (i + 1)));
  edit.loads.forEach((l, i) => posOk(l.pos, 'Load ' + (i + 1)));
  edit.tls.forEach((t, i) => { posOk(t.p1, 'Line ' + (i + 1) + ' end 1'); posOk(t.p2, 'Line ' + (i + 1) + ' end 2'); });
  if (!edit.sources.length) fail('The model has no source, so there is no feed impedance to solve for.');
  num.wires.forEach((w, i) => { if (!(Math.abs(w.r) > 0)) fail('Wire ' + (i + 1) + ' has no radius.'); });
  // every number the solver takes must be finite (the page's own fields always are; a link or argument may not be)
  // (num is a JSON copy: a NaN or Infinity there has become null)
  const finite = (o, what) => Object.keys(o).forEach(k => { if (o[k] === null || (typeof o[k] === 'number' && !Number.isFinite(o[k]))) fail(what + ' ' + k + ' is not a finite number.'); });
  num.sources.forEach((x, i) => finite(x, 'Source ' + (i + 1)));
  num.loads.forEach((x, i) => finite(x, 'Load ' + (i + 1)));
  num.tls.forEach((x, i) => finite(x, 'Line ' + (i + 1)));
  finite(num.ground, 'Ground'); finite(num.seg, 'Segmentation');
  if (num.ins) finite(num.ins, 'Insulation');
  if (num.boom) finite(num.boom, 'Boom');
  // buried wires: the engine refuses them; say so before any work
  if (num.ground.type > 0) {
    const h = num.ground.height, b = num.wires.findIndex(w => w.z1 + h <= -1e-4 || w.z2 + h <= -1e-4);
    if (b >= 0) fail('Wire ' + (b + 1) + ' extends below ground after the height offset. Buried wires and wires crossing the ground plane are not supported.');
  }
  const freqs = [r.calcFreq].concat(edit.bands.filter(f => Math.abs(f - r.calcFreq) > 1e-9));
  const uniq = freqs.filter((f, i) => freqs.findIndex(g => Math.abs(g - f) < 1e-9) === i);
  return { edit, num, freqs: uniq, userWires: user, houseWires: total - user };
}

// the mesh the solver would build at each frequency (cheap: bounded by the share estimate), no matrix
export function meshCheck(num, freqs) {
  return freqs.map(f => {
    const mesh = MM.buildMesh(num, f);
    return { f, segments: mesh.segs.length, unknowns: mesh.bases.length, warnings: mesh.warnings.slice(),
      fits: mesh.bases.length <= MAX_UNKNOWNS };
  });
}

/* ---------- labels: what the figures are, and what they assume ---------- */
export const SIMULATION_NOTICE = 'Simulation, not measurement: figures from Sommerwire\'s thin-wire method-of-moments model (MININEC style, Sommerfeld/complex-image/perfect-mirror ground as chosen) for the model as given. Real antennas differ with construction, surroundings, feed line and soil; verify with measurement before relying on them.';
export function assumptions(edit, num) {
  const g = num.ground, out = [];
  out.push(g.type === 0 ? 'Free space: no ground.' : g.type === 1 ? 'Perfect ground (lossless mirror) at height offset ' + g.height + ' m.'
    : 'Real ground: relative permittivity ' + g.eps + ', conductivity ' + g.sigma + ' S/m, height offset ' + g.height + ' m; impedance method ' + g.nf + ' (homogeneous soil assumed).');
  out.push('Wire material: ' + MM.MATERIALS[num.material].name + '.');
  out.push('Feed impedance and SWR are those of the first source, against ' + num.z0 + ' ohm.');
  num.sources.forEach((s, i) => { if (s.ratio !== 1) out.push('Source ' + (i + 1) + ' (' + s.pos + ') has an ideal lossless ' + s.ratio + ':1 impedance transformer (Balun ' + s.ratio + '): its own loss, bandwidth and stray coupling are not modelled.'); });
  if (num.loads.length) out.push(num.loads.length + ' lumped load(s) as entered (ideal components with the stated Q).');
  if (num.tls.length) out.push(num.tls.length + ' transmission line(s) as ideal network elements: they do not radiate and their outside (shield) current is not modelled.');
  if (num.ins) out.push('Insulation ' + num.ins.t + ' mm, er ' + num.ins.er + ' (thin-sheath approximation).');
  if (num.boom) out.push('Boom correction (' + num.boom.mount + ', ' + num.boom.d + ' mm): DL6WU/G3SEK curve fit; the boom itself is not modelled.');
  if (edit.objects.length) out.push(edit.objects.length + ' house(s) as wire grids (metal roof, gutters, downpipes as entered).');
  out.push('Segmentation dm1 ' + num.seg.dm1 + ', dm2 ' + num.seg.dm2 + ', sc ' + num.seg.sc + ', ec ' + num.seg.ec + '.');
  out.push('The model comment, when present, is the model author\'s description; it is shown as given and not checked.');
  return out;
}
// the flags that make figures approximate, from one result payload
export function flags(r) {
  const s = r.sum || {};
  return {
    perfect_mirror_fallback: !!r.approx,
    gain_capped_db: r.capDb > 0 ? r.capDb : 0,
    earthed_wires: (r.earthed || []).map(w => 'w' + (w + 1)),
    negative_resistance: r.R < 0,
    non_finite_result: ![r.R, r.X, r.gain].every(Number.isFinite),
    coarse_sky_grid: !!s.coarse, over_unity: !!s.overUnity,
    uncertain: !!(r.approx || s.uncertain || r.R < 0 || ![r.R, r.X, r.gain].every(Number.isFinite)),
    warnings: (r.warnings || []).length
  };
}

/* ---------- share link ---------- */
export async function shareLink(r, pol) {
  const view = pol ? { pol } : r.view;
  let hash;
  try { hash = await SWShare.encode({ model: r.model, calcFreq: r.calcFreq, view }); } catch (e) { shareFail(e); }
  const url = SHARE_BASE + hash;
  if (url.length > LIMITS.link) fail('This model needs a link of ' + url.length + ' characters, more than the ' + LIMITS.link + ' a link can safely carry. Use export_maa instead.');
  return { url, fragment: hash, length: url.length, calc_frequency: r.calcFreq, view,
    notes: ['The link carries the editable model, the calculation frequency and the pattern view; never results. Opening it solves the model again in the browser.',
      'Anyone with the link can read the model (it is in the URL fragment, which browsers do not send to the server).'] };
}

/* ---------- .maa export with a format-loss report ---------- */
const isPlainNumber = v => typeof v === 'number' || (typeof v === 'string' && /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(v));
function diffNumeric(a, b, at, out, lim = 40) {
  if (out.length >= lim) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a)))) out.push(at + ': ' + a + ' -> ' + b);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) { out.push(at + ': ' + (Array.isArray(a) ? a.length : typeof a) + ' entries -> ' + (Array.isArray(b) ? b.length : typeof b)); return; }
    a.forEach((x, i) => diffNumeric(x, b[i], at + '[' + i + ']', out, lim)); return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => { if (k !== 'name') diffNumeric(a[k], b[k], at ? at + '.' + k : k, out, lim); });
    return;
  }
  if (a !== b) out.push(at + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b));
}
export function exportMaa(r) {
  const { edit, num } = prepare(r);
  const f = plain(app.maaFile(edit));
  const loss = [];
  // not in the .maa format at all
  if (num.ground.type === 2 && (num.ground.eps !== 13 || num.ground.sigma !== 0.005)) loss.push('Soil: .maa stores no permittivity or conductivity; ' + num.ground.eps + ' / ' + num.ground.sigma + ' S/m are lost (MMANA and Sommerwire reopen it with 13 / 0.005).');
  if (num.ground.type === 2 && num.ground.nf !== 'sommerfeld') loss.push('Ground method "' + num.ground.nf + '" is not stored; the file reopens with Sommerfeld.');
  if (edit.bands.length) loss.push('Band list (' + edit.bands.join(', ') + ' MHz) is not stored.');
  if (Math.abs(r.calcFreq - +edit.freq) > 1e-9) loss.push('Calculation frequency ' + r.calcFreq + ' MHz is not stored; the file opens at its design frequency ' + (+edit.freq) + ' MHz.');
  if (r.view && r.view.pol) loss.push('Pattern view "' + r.view.pol + '" is not stored.');
  // expressions are written as their values
  const exprCells = [];
  edit.wires.forEach((w, i) => ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'r', 'seg'].forEach(k => { if (!isPlainNumber(w[k])) exprCells.push('w' + (i + 1) + '.' + k + ' = ' + w[k]); }));
  if (exprCells.length) loss.push('Expressions are written as numbers at ' + (+edit.freq) + ' MHz: ' + exprCells.slice(0, 12).join(', ') + (exprCells.length > 12 ? ' …' : '') + '.');
  if (num.material > 3) loss.push('MMANA-GAL reads material ' + MM.MATERIALS[num.material].name + ' as its nearest own material; a "Sommerwire MAT" comment line keeps it for Sommerwire.');
  if (edit.objects.length || num.tls.length || num.ins || num.boom || num.sources.some(s => s.ratio !== 1) || num.loads.some(l => l.Qc || l.Cp))
    loss.push('Transformer ratios, trap extras, lines, insulation, boom and houses travel as "Sommerwire …" comment lines: Sommerwire reads them back, MMANA-GAL ignores them.');
  // what actually changes when the file is opened again: numeric solver input before and after
  let changed = [];
  try {
    const back = app.normalize(plain(app.modelFromMAA(f.text)));
    back.ground.eps = edit.ground.eps; back.ground.sigma = edit.ground.sigma; back.ground.nf = edit.ground.nf;   // reported above
    diffNumeric(num, plain(app.numericModel(back)), '', changed);
  } catch (e) { changed = ['The exported file does not reopen: ' + (e.message || e)]; }
  if (changed.length) loss.push('Reopening the file changes the solver input: ' + changed.join('; ') + (changed.length >= 40 ? ' …' : '') + '.');
  return { file_name: f.name, maa: f.text, bytes: Buffer.byteLength(f.text), format_loss: loss, lossless: !loss.length,
    notes: ['The text is returned only; nothing is written to disk.'] };
}

/* ---------- JSON out: no Infinity or NaN surprises ---------- */
export const jsonSafe = v => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? (Number.isNaN(x) ? null : x > 0 ? 'Infinity' : '-Infinity') : x)));
