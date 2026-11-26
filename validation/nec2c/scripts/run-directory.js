const fs = require('fs');
const path = require('path');

module.exports = function createRunDirectory(script) {
  const parent = path.resolve(process.env.NEC2C_RUNS || path.join(__dirname, '../runs'));
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, path.basename(script, '.js') + '-'));
  console.log('Benchmark output:', dir);
  return dir;
};
