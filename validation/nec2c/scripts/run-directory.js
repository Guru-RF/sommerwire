// Each script run writes its NEC decks and outputs to a new folder under validation/nec2c/runs/
// (or under $NEC2C_RUNS), so the archived files in decks/ are never overwritten.
const fs = require('fs'), path = require('path');
module.exports = function runDirectory(script) {
  const parent = path.resolve(process.env.NEC2C_RUNS || path.join(__dirname, '../runs'));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(parent, path.basename(script, '.js') + '-' + stamp);
  fs.mkdirSync(dir, { recursive: true });
  console.log('Writing to ' + dir);
  return dir;
};
