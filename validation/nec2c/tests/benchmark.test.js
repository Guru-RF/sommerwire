const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('each invocation preserves each case and leaves the archive untouched', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nec-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const suite = path.join(root, 'validation/nec2c');
  fs.cpSync(path.join(__dirname, '../scripts'), path.join(suite, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(suite, 'decks'));
  fs.mkdirSync(path.join(root, 'models'));
  fs.writeFileSync(path.join(root, 'models/DX Commander 16 radials.maa'), '');
  fs.writeFileSync(path.join(root, 'engine.js'), `
    process.setMaxListeners(0);
    globalThis.MM = {
      parseMAA: () => ({ material: 1, wires: [] }),
      solve: m => {
        if (m.material !== 0) throw Error('conductor-loss mismatch');
        return { sources: [{ R: 1, X: 0 }] };
      },
      makePattern: () => {
        const samples = [];
        const balance = process.argv[1].endsWith('necbal.js');
        process.once('exit', () => {
          const expected = [];
          if (balance) {
            for (let theta = 0; theta <= 90; theta += 2)
              for (let az = 0; az < 360; az += 5) expected.push([90-theta, az]);
          } else {
            for (let el = 0; el <= 90; el++) expected.push([el, 0]);
          }
          require('node:assert/strict').deepEqual(samples, expected);
        });
        return { gain: (el, az) => { samples.push([el, az]); return { tot: 1 }; } };
      }
    };
  `);
  const fake = path.join(root, 'fake-nec.js');
  fs.writeFileSync(fake, `require('node:child_process').execFileSync = (binary, args, {cwd}) => {
    const path = require('node:path');
    const fs = require('fs');
    const input = fs.readFileSync(path.join(cwd, args[0].slice(2)), 'utf8');
    const balance = process.argv[1].endsWith('necbal.js');
    const grid = balance ? 'RP 0 46 73 1000 0 0 2 5' : 'RP 0 91 1 1000 0 0 1 0';
    require('node:assert/strict').ok(input.split('\\n').includes(grid));
    const wire = input.match(/^EX 0 (\\d+)/m)[1];
    fs.writeFileSync(path.join(cwd, args[1].slice(2)), 'ANTENNA INPUT PARAMETERS\\n' +
      wire + ' 1 0 0 0 0 1 0 0 0\\nRADIATION PATTERNS\\n0 0 0 0 0 0 0 0\\n');
  };`);
  const runs = path.join(root, 'runs');
  for (const [script, cases] of [['necmp', 22], ['necdx', 6], ['necdx2', 6], ['necbal', 4]]) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const before = new Set(fs.existsSync(runs) ? fs.readdirSync(runs) : []);
      execFileSync(process.execPath, ['--require', fake, path.join(suite, 'scripts', script + '.js')], {
        env: { ...process.env, NEC2C: fake, NEC2C_RUNS: runs }
      });
      assert.deepEqual(fs.readdirSync(path.join(suite, 'decks')), []);
      const fresh = fs.readdirSync(runs).filter(name => !before.has(name));
      assert.equal(fresh.length, 1);
      const files = fs.readdirSync(path.join(runs, fresh[0]));
      for (const ext of ['.nec', '.out']) assert.equal(files.filter(f => f.endsWith(ext)).length, cases);
    }
  }
});
