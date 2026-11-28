/* Sommerwire MCP — RF.Guru fork contribution, Apache-2.0. The upstream Sommerwire app by ON9PK Koen Van den Heuvel remains under the Unlicense. See the repository LICENSE for scope. */
/* Solves run in a worker thread each, at most BUDGET.concurrency at a time (further calls are refused, not queued),
 * under a wall-time budget and a heap limit. A job that runs out of time, or whose request is cancelled, is stopped
 * by terminating its thread, so no runaway factorization outlives its request. */
import { Worker } from 'node:worker_threads';
import { BUDGET, InputError } from './core.js';

let running = 0;
export const activeSolves = () => running;

export function solveInWorker(model, freqs, { signal, timeoutMs = BUDGET.solveMs } = {}) {
  if (running >= BUDGET.concurrency) return Promise.reject(new InputError('The server is already running ' + running + ' solve(s), its limit; try again when it finishes.'));
  running++;
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./solve-worker.js', import.meta.url), {
      workerData: { model, freqs }, stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: BUDGET.workerHeapMb, maxYoungGenerationSizeMb: 64 }
    });
    // the worker's own output must never reach stdout, which carries the protocol
    w.stdout.resume(); w.stderr.resume();
    let settled = false;
    const end = (fn, v) => {
      if (settled) return; settled = true; running--;
      clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort);
      w.terminate().catch(() => {});
      fn(v);
    };
    const timer = setTimeout(() => end(reject, new InputError('The solve took longer than its ' + Math.round(timeoutMs / 1000) + ' s budget and was stopped. Solve fewer frequencies (include_bands: false) or use coarser segmentation.')), timeoutMs);
    const onAbort = () => end(reject, new InputError('The solve was cancelled.'));
    if (signal) { if (signal.aborted) return onAbort(); signal.addEventListener('abort', onAbort, { once: true }); }
    w.on('message', m => { if (m && m.done) end(resolve, m.results); });
    w.on('error', e => end(reject, new Error('The solver stopped: ' + ((e && e.message) || e))));
    w.on('exit', code => end(reject, new Error('The solver thread ended early (code ' + code + ').')));
  });
}
