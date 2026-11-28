/* Sommerwire MCP — RF.Guru fork contribution, Apache-2.0. The upstream Sommerwire app by ON9PK Koen Van den Heuvel remains under the Unlicense. See the repository LICENSE for scope. */
/* One solve job in its own thread: the app's numeric model at each frequency, through the engine and the page's own
 * result payload (packZ + finish from index.html). The parent kills the thread when the time budget runs out. */
import { parentPort, workerData } from 'node:worker_threads';
import { loadApp } from './app.js';

// a plain copy of a vm-context object; Infinity (an SWR of a total mismatch) and NaN kept as text, not lost to null
const copy = v => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? (Number.isNaN(x) ? 'NaN' : x > 0 ? 'Infinity' : '-Infinity') : x)));

const { MM, app } = loadApp();
const { model, freqs } = workerData;
const results = [];
for (const f of freqs) {
  const t0 = Date.now();
  try {
    const res = MM.solve(model, f), z = app.packZ(res, model, f);
    const out = copy(app.finish(z, res, model, null, null));
    delete out.segs;    // per-segment currents for the 3D view: large, and not needed here
    out.ms = Date.now() - t0;
    results.push(out);
  } catch (e) {
    results.push({ f, error: String((e && e.message) || e) });
  }
  parentPort.postMessage({ progress: results.length, of: freqs.length });
}
parentPort.postMessage({ done: true, results });
