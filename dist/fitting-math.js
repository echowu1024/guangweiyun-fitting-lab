/* Deterministic teaching samples and ordinary least squares, in 万元 and 平方米. */
(function (root) {
  'use strict';
  const EXAMPLES = [
    { id: 'A', area: 55, price: 88, name: '小巧两居', detail: '55 ㎡ · 两居室' },
    { id: 'B', area: 80, price: 118, name: '舒适两居', detail: '80 ㎡ · 两居室' },
    { id: 'C', area: 105, price: 156, name: '紧凑三居', detail: '105 ㎡ · 三居室' },
    { id: 'D', area: 130, price: 182, name: '宽敞三居', detail: '130 ㎡ · 三居室' }
  ];

  function samples(count = 4, wrongLabel = false) {
    const data = EXAMPLES.map(house => ({ ...house }));
    let seed = 20261107;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 4; i < count; i++) {
      const area = Math.round((42 + random() * 122) * 10) / 10;
      const noise = (random() + random() + random() - 1.5) * 19;
      const price = Math.round((1.28 * area + 18 + noise) * 10) / 10;
      data.push({ id: '房源' + (i + 1), area, price, name: '成交样本' });
    }
    if (wrongLabel) data[2].price = 260;
    return data;
  }

  function predict(model, area) { return model.slope * area + model.intercept; }

  function error(data, model) {
    const sse = data.reduce((sum, point) => sum + (point.price - predict(model, point.area)) ** 2, 0);
    return { sse, mse: sse / data.length, rmse: Math.sqrt(sse / data.length) };
  }

  function leastSquares(data) {
    if (data.length < 2) throw new Error('至少需要两条样本。');
    const meanX = data.reduce((sum, p) => sum + p.area, 0) / data.length;
    const meanY = data.reduce((sum, p) => sum + p.price, 0) / data.length;
    const xx = data.reduce((sum, p) => sum + (p.area - meanX) ** 2, 0);
    const xy = data.reduce((sum, p) => sum + (p.area - meanX) * (p.price - meanY), 0);
    const slope = xx === 0 ? 0 : xy / xx;
    return { slope, intercept: meanY - slope * meanX };
  }

  function learnStep(data, model) {
    // Center and scale x for a stable learning rate, while displaying the original units.
    let a = model.slope * 50;
    let c = predict(model, 100);
    let da = 0, dc = 0;
    for (const point of data) {
      const x = (point.area - 100) / 50;
      const residual = a * x + c - point.price;
      da += 2 * residual * x / data.length;
      dc += 2 * residual / data.length;
    }
    a -= 0.16 * da;
    c -= 0.16 * dc;
    return { slope: a / 50, intercept: c - 2 * a };
  }

  function matching(data, minArea, budget) {
    return data.filter(p => p.area >= minArea && p.price <= budget)
      .sort((a, b) => a.area - b.area || a.price - b.price);
  }

  const api = { EXAMPLES, samples, predict, error, leastSquares, learnStep, matching };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FittingMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
