// Exercise the inline UI handlers with controlled worker delivery.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const html = readFileSync(require.resolve('../index.html'), 'utf8');
function section(start, end) {
  const i = html.indexOf(start), j = html.indexOf(end, i);
  assert.ok(i >= 0 && j > i);
  return html.slice(i, j);
}
function ui(parallel) {
  const nodes = {}, workers = [], jobs = [];
  const $ = id => nodes[id] ||= { contains: () => false };
  $('#swFrom').value = 1;
  $('#swTo').value = $('#swN').value = 2;
  const S = { model: { ground: {} } };
  const draws = [];
  const ctx = { $, S, workerUrl: parallel, navigator: { hardwareConcurrency: 2 },
    document: {}, performance: { now: () => 500 }, numericModel: () => S.model,
    drawSweep: () => draws.push(S.sweep), invalidateBands() {}, validateCells() {}, drawView() {}, renderVars() {}, setStatus() {},
    makeWorker() { const w = { terminate() {}, postMessage() {} }; workers.push(w); return w; },
    job() { return new Promise(resolve => jobs.push(resolve)); } };
  vm.runInNewContext(section('let calcTimer', "document.addEventListener('input'") +
    section("$('#cNf').onchange", "$('#cZ0').oninput") +
    section('let sweepRun', "$('#resBtn').onclick"), ctx);
  return { $, S, workers, jobs, draws };
}
const point = { f: 2, gain: 5, fb: 8 };
test('ground edit removes completed points from the chart and band summary input', async () => {
  const { $, S, jobs, draws } = ui(false);
  const run = $('#swRun').onclick();
  jobs[0]([point]);
  await run;
  assert.equal(S.sweep[0], point);
  $('#cNf').onchange({ target: { value: 'mirror' } });
  assert.equal(S.sweep, null);
  assert.equal(draws.at(-1), null);
});
for (const parallel of [false, true]) {
  test('late sweep delivery after material edit, workers=' + parallel, async () => {
    const { $, S, workers, jobs } = ui(parallel);
    const run = $('#swRun').onclick();
    const progress = { data: { progress: { pt: point } } };
    if (parallel) workers[0].onmessage(progress);
    $('#cMat').onchange({ target: { value: 1 } });
    const next = $('#swRun').onclick();
    if (parallel) workers[0].onmessage(progress);
    else jobs[0]([point]);
    await run;
    assert.equal(S.sweep.length, 0);
    assert.equal($('#swRun').textContent, 'Stop');
    if (parallel) {
      workers[1].onmessage(progress);
      for (let i = 0; i < 2; i++) workers[1].onmessage({ data: { ok: true } });
    } else jobs[1]([point]);
    await next;
    assert.equal(S.sweep[0], point);
  });
}
