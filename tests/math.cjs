const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const M = require('../src/fitting-math.js');

const close = (actual, expected, tolerance = 1e-8) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const data = M.samples(4);
const model = M.leastSquares(data);
close(model.slope, 1.28);
close(model.intercept, 17.6);
close(M.error(data, model).mse, 6);
close(M.predict(model, 92), 135.36);
assert.deepEqual(M.matching(data, 90, 160).map(p => p.id), ['C']);
assert.deepEqual(M.matching(data, 170, 50), []);
close(M.predict(M.leastSquares(M.samples(4, true)), 92), 161.152);
assert.deepEqual(M.samples(160).slice(0, 40), M.samples(40));
assert.deepEqual(M.samples(40).slice(0, 4), data);

for (const count of [4, 40, 160]) {
  for (const wrong of [false, true]) {
    const samples = M.samples(count, wrong);
    assert.equal(new Set(samples.map(p => p.id)).size, count);
    assert(samples.every(p => Number.isFinite(p.price) && Number.isFinite(p.area)));
    let current = { slope: 0.2, intercept: -30 };
    let previousLoss = M.error(samples, current).mse;
    for (let i = 0; i < 240; i++) {
      current = M.learnStep(samples, current);
      const loss = M.error(samples, current).mse;
      assert(loss <= previousLoss + 1e-9, 'every gradient step must decrease loss');
      previousLoss = loss;
    }
    close(current.slope, M.leastSquares(samples).slope, 1e-6);
    close(current.intercept, M.leastSquares(samples).intercept, 1e-4);
  }
}
const standalone = fs.readFileSync(path.join(__dirname, '../downloads/广微云_拟合实验室.html'), 'utf8');
assert(!/<script[^>]+src=/.test(standalone));
assert(!/<link[^>]+rel="stylesheet"/.test(standalone));
assert(standalone.includes('data:image/jpeg;base64,'));
for (const match of standalone.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
console.log(JSON.stringify({ status: 'passed', knownOLS: true, decreasingLoss: '6 datasets × 240 steps', sampleGrowth: true, matching: true, wrongLabelEffect: true, standaloneScripts: true }));

