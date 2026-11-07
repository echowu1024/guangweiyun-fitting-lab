/* House-price fitting explainer. All examples and calculations run locally. */
(function () {
  'use strict';
  const M = window.FittingMath;
  const format = (n, digits = 1) => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const stages = [
    { title: '一套房子，就是一个点', note: '面积是输入，成交价是已知答案。先点选 A、B、C、D 看一看。', next: '这些点大致向右上方排列，面积与价格之间可能有规律。' },
    { title: '让直线更贴近这些点', note: '拖动直线两端的圆点，或调节滑块。看看红色误差线和误差数值怎样变化。', next: '学习时，程序反复比较预测与已知答案，再调整公式里的两个数。' },
    { title: '给新面积，读出一个预测', note: '从面积轴往上，遇到直线，再向左读价格。蓝色交点就是新预测。', next: '预测使用学到的公式。筛选房源使用样本里已有的面积和成交价。' },
    { title: '一个错误标签会怎样？', note: '把 C 的价格误标为 260 万，观察重新拟合后的直线与新房价预测。', next: '训练会努力贴近给定的答案。答案标错了，学到的规律也会受影响。' }
  ];
  let active = null;

  class FittingLab {
    constructor(container) {
      this.container = container;
      this.phase = 0;
      this.count = 4;
      this.wrongLabel = false;
      this.model = { slope: 0.65, intercept: 40 };
      this.trained = false;
      this.selected = 'A';
      this.predictionArea = 92;
      this.minArea = 90;
      this.budget = 160;
      this.showErrors = true;
      this.iteration = 0;
      this.running = false;
      this.frame = 0;
      this.lastTick = 0;
      this.drag = null;
      this.events = new AbortController();
      this.build();
      this.observer = new ResizeObserver(() => this.draw());
      this.observer.observe(this.svg);
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); }, { signal: this.events.signal });
      window.addEventListener('hashchange', () => { if (!this.root.isConnected) this.destroy(); }, { signal: this.events.signal });
      this.refresh();
    }

    get data() { return M.samples(this.count, this.wrongLabel); }
    get baseline() { return M.leastSquares(M.samples(this.count, false)); }
    el(id) { return this.root.querySelector('[data-fit="' + id + '"]'); }

    build() {
      this.container.innerHTML = `<section class="fit-lab" aria-label="拟合实验室">
        <header class="fit-heading"><div><h1>把数据里的规律，画出来</h1><p>从四套房子开始，亲手试一试机器怎样“学习”。</p></div><div class="fit-heading-actions"><button class="fit-button" data-fit="reset">重新演示</button><button class="fit-button" data-fit="fullscreen">全屏讲解</button></div></header>
        <nav class="fit-steps" role="tablist" aria-label="拟合讲解步骤">${['看见数据', '动手拟合', '预测与选房', '数据与标注'].map((name, i) => `<button type="button" role="tab" data-stage="${i}" aria-selected="${i === 0}"><span>第 ${i + 1} 步</span>${name}</button>`).join('')}</nav>
        <div class="fit-workbench"><div><section class="fit-chart-card" aria-label="面积与房价坐标图"><div class="fit-chart-top"><h2>面积与成交价</h2><div class="fit-sample-count" aria-label="样本数量"><span>样本</span>${[4, 40, 160].map(n => `<button type="button" data-count="${n}" aria-pressed="${n === 4}">${n} 套</button>`).join('')}</div></div>
        <svg class="fit-chart" data-fit="chart" role="img" aria-label="房子面积和价格的散点图"></svg>
        <div class="fit-legend"><span><i class="fit-swatch"></i>已知成交样本</span><span data-fit="line-legend" hidden><i class="fit-swatch line"></i>当前模型</span><span data-fit="predict-legend" hidden><i class="fit-swatch predict"></i>新面积的预测</span></div><div class="fit-chart-note" data-fit="chart-note"></div></section>
        <div class="fit-house-list" aria-label="四套示例房子">${M.EXAMPLES.map(h => `<button type="button" class="fit-house" data-house-card="${h.id}" aria-pressed="${h.id === 'A'}"><span>${h.id}</span><div><strong>${h.name}</strong><small>${h.area} ㎡ · <b data-price="${h.id}">${h.price}</b> 万元</small></div></button>`).join('')}</div></div>
        <aside class="fit-side" data-fit="side" aria-label="实验操作"></aside></div>
        <div class="fit-next"><p data-fit="takeaway"></p><button class="fit-button primary" data-fit="next">下一步 →</button></div>
        <details class="fit-teacher"><summary>讲师提示与概念说明</summary><p>建议按四步演示。先点 A—D，把面积和价格对应到坐标轴；再让学员试着移动直线，观察误差；用“自动拟合”展示反复调整；最后预测一套新面积，并试一次错误标注。</p><p>本例采用一元线性回归。最小二乘法最小化的是各样本的<strong>竖向预测误差平方和</strong>，界面显示的“均方误差”是平方和除以样本数。本例的特征是面积，标签是成交价。自动演示使用真实的梯度下降更新，内部对面积做缩放以保持调整稳定。</p><p>四套房子和扩展样本均为课堂虚构，假设来自同一区域、同一时期。真实房价还与地段、楼龄等因素有关。人工标注是监督学习的一种数据来源，部分任务也能从数据本身构造训练目标。可将培训稿中的“需要贴标签”表述为“监督学习通常需要已知答案”。</p><p>交互节奏参考 <a href="https://github.com/xman61/agent-car-anatomy" target="_blank" rel="noopener">汽车智能体解剖台</a>；数学说明参照 <a href="https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm" target="_blank" rel="noopener">NIST 最小二乘说明</a>。</p></details>
        <p data-fit="announce" class="sr-only" role="status" aria-live="polite"></p></section>`;
      this.root = this.container.querySelector('.fit-lab');
      this.svg = this.el('chart');
      this.root.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => this.setStage(Number(b.dataset.stage)));
      this.root.querySelectorAll('[data-count]').forEach(b => b.onclick = () => this.setCount(Number(b.dataset.count)));
      this.root.querySelectorAll('[data-house-card]').forEach(b => b.onclick = () => this.selectHouse(b.dataset.houseCard));
      this.el('next').onclick = () => this.setStage((this.phase + 1) % 4);
      this.el('reset').onclick = () => {
        this.pause(); this.phase = 0; this.count = 4; this.wrongLabel = false;
        this.model = { slope: 0.65, intercept: 40 }; this.trained = false; this.selected = 'A';
        this.predictionArea = 92; this.minArea = 90; this.budget = 160; this.iteration = 0;
        this.refresh(); this.announce('已回到四套房子的初始演示。');
      };
      this.el('fullscreen').onclick = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else this.root.requestFullscreen?.().catch(() => this.announce('可使用浏览器全屏进行讲解。'));
      };
      document.addEventListener('fullscreenchange', () => {
        this.el('fullscreen').textContent = document.fullscreenElement === this.root ? '退出全屏' : '全屏讲解';
      }, { signal: this.events.signal });
      this.svg.addEventListener('click', e => {
        const point = e.target.closest('[data-point]');
        if (point) this.selectHouse(point.dataset.point);
      });
      this.svg.addEventListener('pointerdown', e => this.beginDrag(e));
      this.svg.addEventListener('pointermove', e => this.moveDrag(e));
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        this.svg.addEventListener(event, () => { this.drag = null; this.svg.style.touchAction = 'pan-y'; });
      }
    }

    setStage(phase) {
      this.pause();
      this.phase = phase;
      if (phase >= 2 && !this.trained) {
        this.model = M.leastSquares(this.data);
        this.trained = true;
      }
      this.refresh();
      this.announce(stages[phase].title);
    }

    setCount(count) {
      this.pause(); this.count = count; this.iteration = 0;
      if (this.phase >= 2) { this.model = M.leastSquares(this.data); this.trained = true; }
      else this.trained = false;
      this.refresh(); this.announce('现在有 ' + count + ' 套成交样本。');
    }

    selectHouse(id) {
      this.selected = id;
      this.update();
      const point = this.data.find(p => p.id === id);
      this.announce(point.id + '，面积 ' + point.area + ' 平方米，成交价 ' + point.price + ' 万元。');
    }

    refresh() {
      this.root.querySelectorAll('[data-stage]').forEach(b => b.setAttribute('aria-selected', Number(b.dataset.stage) === this.phase));
      this.root.querySelectorAll('[data-count]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.count) === this.count));
      this.el('takeaway').textContent = stages[this.phase].next;
      this.el('next').textContent = this.phase === 3 ? '回到第一步 →' : '下一步 →';
      this.el('line-legend').hidden = this.phase === 0;
      this.el('predict-legend').hidden = this.phase < 2;
      const common = `<h2>${stages[this.phase].title}</h2><p>${stages[this.phase].note}</p>`;
      const formula = `<div class="fit-model"><small>当前公式 · 价格单位为万元</small><div data-fit="formula"></div></div>`;
      const controls = `<label class="fit-control"><span>面积每增加 1 ㎡ <output data-fit="slope-output"></output></span><input data-fit="slope" aria-label="直线斜率" type="range" min="0.2" max="2.4" step="0.01"></label><label class="fit-control"><span>整条线的上下位置 <output data-fit="intercept-output"></output></span><input data-fit="intercept" aria-label="直线截距" type="range" min="-30" max="90" step="0.01"></label>`;
      const learning = `<div class="fit-learning-actions"><button class="fit-button primary" data-fit="learn">自动拟合</button><button class="fit-button" data-fit="step">单步调整</button></div><label class="fit-check"><input data-fit="errors" type="checkbox" ${this.showErrors ? 'checked' : ''}>显示到直线的竖向误差</label><div class="fit-score">均方误差 <span>（万元²）</span><div><strong data-fit="mse"></strong></div><small data-fit="learning-state"></small></div>`;
      const prediction = `<label class="fit-control"><span>新房子的面积 <output data-fit="area-output"></output></span><input data-fit="area" aria-label="预测面积" type="range" min="35" max="180" step="1" value="${this.predictionArea}"></label><div class="fit-result"><span>按当前模型预测的总价</span><strong data-fit="prediction"></strong></div><p data-fit="coverage"></p>`;
      if (this.phase === 0) this.el('side').innerHTML = common + `<div class="fit-model"><small>选中房子的已知信息</small><div data-fit="selected-detail"></div></div><p>横轴记录面积，纵轴记录成交价。一个点同时带着两个数。</p><p>这些成交价，就是这次监督学习使用的“标签”。</p>`;
      if (this.phase === 1) this.el('side').innerHTML = common + controls + formula + learning;
      if (this.phase === 2) this.el('side').innerHTML = common + prediction + formula + `<details open><summary style="cursor:pointer;font-size:13px">按我的条件找房</summary><label class="fit-field">至少多大 <span><input data-fit="min-area" aria-label="最小房屋面积" type="number" min="35" max="180" value="${this.minArea}"> ㎡</span></label><label class="fit-field">总价预算 <span><input data-fit="budget" aria-label="购房预算" type="number" min="1" max="400" value="${this.budget}"> 万元</span></label><div class="fit-matches" data-fit="matches" aria-live="polite"></div></details>`;
      if (this.phase === 3) this.el('side').innerHTML = common + `<button class="fit-button primary" data-fit="wrong">${this.wrongLabel ? '恢复 C 的正确标签' : '把 C 误标为 260 万'}</button><p style="margin-top:12px" data-fit="quality-note"></p>` + prediction + formula + `<div class="fit-learning-actions"><button class="fit-button" data-fit="learn">重新拟合</button></div>`;
      this.bindControls();
      this.update();
    }

    bindControls() {
      for (const key of ['slope', 'intercept']) {
        const input = this.el(key);
        if (input) input.oninput = () => {
          this.pause(); this.model[key] = Number(input.value); this.trained = false; this.iteration = 0; this.update();
        };
      }
      if (this.el('learn')) this.el('learn').onclick = () => this.running ? this.pause() : this.startLearning();
      if (this.el('step')) this.el('step').onclick = () => { this.pause(); this.learnOnce(); this.update(); };
      if (this.el('errors')) this.el('errors').onchange = e => { this.showErrors = e.target.checked; this.draw(); };
      if (this.el('area')) this.el('area').oninput = e => { this.predictionArea = Number(e.target.value); this.update(); };
      if (this.el('wrong')) this.el('wrong').onclick = () => {
        this.pause(); this.wrongLabel = !this.wrongLabel; this.selected = 'C'; this.trained = false; this.iteration = 0;
        this.refresh(); this.startLearning();
      };
      for (const [key, property] of [['min-area', 'minArea'], ['budget', 'budget']]) {
        if (this.el(key)) this.el(key).oninput = e => {
          if (!e.target.validity.valid || e.target.value === '') return;
          this[property] = Number(e.target.value); this.updateMatches(); this.draw();
        };
      }
    }

    update() {
      const selected = this.data.find(p => p.id === this.selected) || this.data[0];
      this.root.querySelectorAll('[data-house-card]').forEach(b => {
        b.classList.toggle('selected', b.dataset.houseCard === this.selected);
        b.setAttribute('aria-pressed', b.dataset.houseCard === this.selected);
      });
      this.root.querySelectorAll('[data-price]').forEach(b => { b.textContent = this.data.find(p => p.id === b.dataset.price).price; });
      if (this.el('selected-detail')) this.el('selected-detail').textContent = `${selected.id} · ${selected.name}，${selected.area} ㎡，${selected.price} 万元`;
      if (this.el('formula')) this.el('formula').textContent = `价格 ≈ ${format(this.model.slope, 2)} × 面积 ${this.model.intercept < 0 ? '−' : '+'} ${format(Math.abs(this.model.intercept), 1)}`;
      if (this.el('slope')) {
        this.el('slope').value = this.model.slope;
        this.el('slope-output').textContent = `约 ${format(this.model.slope, 2)} 万元`;
        this.el('intercept').value = this.model.intercept;
        this.el('intercept-output').textContent = format(this.model.intercept) + ' 万元';
      }
      if (this.el('mse')) this.el('mse').textContent = format(M.error(this.data, this.model).mse, 2);
      if (this.el('learning-state')) this.el('learning-state').textContent = this.trained ? '已收敛到最小二乘解附近。' : this.iteration ? `已调整 ${this.iteration} 次。每次调整都使用全部当前样本。` : '误差越小，当前直线越贴近这些样本。';
      if (this.el('learn')) this.el('learn').textContent = this.running ? '暂停学习' : this.trained ? '重播拟合' : '自动拟合';
      if (this.el('prediction')) {
        this.el('area-output').textContent = this.predictionArea + ' ㎡';
        this.el('prediction').textContent = format(M.predict(this.model, this.predictionArea)) + ' 万元';
        const min = Math.min(...this.data.map(p => p.area)), max = Math.max(...this.data.map(p => p.area));
        this.el('coverage').textContent = this.predictionArea < min || this.predictionArea > max ? `这个面积超出样本的 ${format(min, 0)}—${format(max, 0)} ㎡范围。可以借机讲解“外推”。` : `模型把 ${this.predictionArea} ㎡代入公式，得到蓝色交点的价格。`;
      }
      if (this.el('quality-note')) this.el('quality-note').textContent = this.wrongLabel ? 'C 原价 156 万，现在标签写成了 260 万。灰色虚线保留正确标签下的拟合结果。' : 'C 的已知成交价是 156 万。先观察当前的预测，再改动这个标签。';
      this.updateMatches(); this.draw();
    }

    updateMatches() {
      if (!this.el('matches')) return;
      const matches = M.matching(this.data, this.minArea, this.budget);
      this.el('matches').innerHTML = matches.length ? `符合条件的房源共 ${matches.length} 套，先列出面积最接近需求的三套。` + matches.slice(0, 3).map(p => `<button type="button" data-match="${p.id}">${p.id} · ${format(p.area, 0)} ㎡ · ${format(p.price, 0)} 万元</button>`).join('') : '当前样本里还没有同时满足面积和预算的房源。可以调整条件或增加样本。';
      this.el('matches').querySelectorAll('[data-match]').forEach(b => b.onclick = () => this.selectHouse(b.dataset.match));
    }

    learnOnce() {
      this.model = M.learnStep(this.data, this.model); this.iteration++;
      const gap = M.error(this.data, this.model).mse - M.error(this.data, M.leastSquares(this.data)).mse;
      this.trained = gap < 0.0001;
    }

    startLearning() {
      if (this.trained) { this.model = { slope: 0.65, intercept: 40 }; this.iteration = 0; this.trained = false; }
      this.running = true; this.lastTick = 0; this.announce('开始逐步调整直线。');
      const tick = now => {
        if (!this.root.isConnected) { this.destroy(); return; }
        if (!this.running) return;
        if (now - this.lastTick >= 65) {
          this.lastTick = now; this.learnOnce(); this.update();
          if (this.trained || this.iteration >= 240) {
            this.running = false; this.update(); this.announce('拟合完成，观察当前直线和预测价格。'); return;
          }
        }
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick); this.update();
    }

    pause() {
      this.running = false; cancelAnimationFrame(this.frame);
      if (this.el('learn')) this.el('learn').textContent = '自动拟合';
    }

    beginDrag(event) {
      const handle = event.target.closest('[data-handle]');
      if (!handle || this.phase !== 1) return;
      event.preventDefault(); this.pause();
      this.drag = { id: event.pointerId, end: handle.dataset.handle, model: { ...this.model } };
      this.svg.style.touchAction = 'none'; this.svg.setPointerCapture(event.pointerId);
    }

    moveDrag(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const rect = this.svg.getBoundingClientRect();
      const y = this.axes.invertY((event.clientY - rect.top) * this.axes.height / rect.height);
      const leftArea = 50, rightArea = 150;
      const fixedArea = this.drag.end === 'left' ? rightArea : leftArea;
      const changingArea = this.drag.end === 'left' ? leftArea : rightArea;
      const fixedPrice = M.predict(this.drag.model, fixedArea);
      const slope = clamp((y - fixedPrice) / (changingArea - fixedArea), 0.2, 2.4);
      this.model = { slope, intercept: clamp(fixedPrice - slope * fixedArea, -30, 90) };
      this.trained = false; this.iteration = 0; this.update();
    }

    draw() {
      const width = this.svg.clientWidth;
      if (width < 100) return;
      const height = this.svg.clientHeight;
      const margin = { left: width < 500 ? 48 : 59, right: 22, top: 36, bottom: 45 };
      const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
      const prediction = M.predict(this.model, this.predictionArea);
      const maxY = Math.ceil(Math.max(300, this.phase >= 2 ? prediction + 25 : 0, ...this.data.map(p => p.price + 25)) / 50) * 50;
      const x = value => margin.left + (value - 30) / 150 * plotW;
      const y = value => margin.top + plotH - value / maxY * plotH;
      this.axes = { height, invertY: pixel => (margin.top + plotH - pixel) / plotH * maxY };
      this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      let picture = `<defs><clipPath id="fit-plot-clip"><rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}"/></clipPath></defs><text x="${margin.left}" y="18" fill="#51675a" font-size="12">价格（万元）</text>`;
      for (let value = 0; value <= maxY; value += 50) picture += `<line x1="${margin.left}" y1="${y(value)}" x2="${width - margin.right}" y2="${y(value)}" stroke="#e4e8df"/><text x="${margin.left - 10}" y="${y(value) + 4}" text-anchor="end" font-size="11" fill="#718071">${value}</text>`;
      for (let value = width < 500 ? 60 : 30; value <= 180; value += width < 500 ? 40 : 30) picture += `<line x1="${x(value)}" y1="${margin.top}" x2="${x(value)}" y2="${y(0)}" stroke="#edf0e8"/><text x="${x(value)}" y="${y(0) + 22}" text-anchor="middle" font-size="11" fill="#718071">${value}</text>`;
      picture += `<text x="${width - margin.right}" y="${height - 4}" text-anchor="end" font-size="12" fill="#51675a">面积（㎡）</text><g clip-path="url(#fit-plot-clip)">`;
      const matches = this.phase === 2 ? M.matching(this.data, this.minArea, this.budget).slice(0, 3).map(p => p.id) : [];
      if (this.phase === 2) picture += `<rect x="${x(this.minArea)}" y="${y(this.budget)}" width="${Math.max(0, x(180) - x(this.minArea))}" height="${Math.max(0, y(0) - y(this.budget))}" fill="#bfd8aa" opacity=".17"/>`;
      if (this.phase >= 1 && this.showErrors) {
        for (const point of this.data) picture += `<line x1="${x(point.area)}" y1="${y(point.price)}" x2="${x(point.area)}" y2="${y(M.predict(this.model, point.area))}" stroke="#bd7f70" stroke-width="${this.count > 40 ? 1 : 1.4}" opacity="${this.count > 40 ? 0.35 : 0.65}"/>`;
      }
      if (this.phase === 3 && this.wrongLabel) {
        picture += `<line x1="${x(30)}" y1="${y(M.predict(this.baseline, 30))}" x2="${x(180)}" y2="${y(M.predict(this.baseline, 180))}" stroke="#7d8d81" stroke-width="2" stroke-dasharray="5 5"/><circle cx="${x(105)}" cy="${y(156)}" r="7" fill="white" stroke="#7d8d81"/><text x="${x(105) + 11}" y="${y(156) + 4}" font-size="11" fill="#607264">C 原价 156 万</text>`;
      }
      if (this.phase >= 1) picture += `<line x1="${x(30)}" y1="${y(M.predict(this.model, 30))}" x2="${x(180)}" y2="${y(M.predict(this.model, 180))}" stroke="#b87a30" stroke-width="3"/>`;
      for (const point of this.data) {
        const base = point.id.length === 1, selected = point.id === this.selected;
        if (matches.includes(point.id)) picture += `<circle cx="${x(point.area)}" cy="${y(point.price)}" r="11" fill="none" stroke="#b87a30" stroke-width="2"/>`;
        picture += `<circle data-point="${point.id}" cx="${x(point.area)}" cy="${y(point.price)}" r="${selected ? 9 : base ? 6.5 : 3.5}" fill="${selected ? '#245c4b' : '#72a58a'}" stroke="${selected ? '#e0ead5' : '#fffef9'}" stroke-width="${selected ? 4 : 1}" opacity="${base ? 1 : 0.72}" style="cursor:pointer"><title>${point.id}，${point.area} ㎡，${point.price} 万元</title></circle>`;
        if (base) picture += `<text x="${x(point.area) + 11}" y="${y(point.price) - 11}" font-size="13" font-weight="bold" fill="#365e4c">${point.id}</text>`;
      }
      if (this.phase >= 2) {
        const px = x(this.predictionArea), py = y(prediction);
        picture += `<path d="M${px},${y(0)} V${py} H${margin.left}" fill="none" stroke="#206f8b" stroke-width="1.7" stroke-dasharray="5 4"/><circle cx="${px}" cy="${py}" r="8" fill="#206f8b" stroke="white" stroke-width="3"/>`;
        const labelX = clamp(px + 14, margin.left + 10, width - 155);
        const labelY = clamp(py - 20, margin.top + 20, y(0) - 20);
        picture += `<rect x="${labelX - 6}" y="${labelY - 17}" width="137" height="25" rx="6" fill="#eaf3f5"/><text x="${labelX}" y="${labelY}" font-size="12" fill="#205e74">${this.predictionArea} ㎡ ≈ ${format(prediction)} 万</text>`;
      }
      if (this.phase === 1) for (const [end, area] of [['left', 50], ['right', 150]]) picture += `<circle class="fit-handle" data-handle="${end}" cx="${x(area)}" cy="${y(M.predict(this.model, area))}" r="15" fill="#b87a30" opacity=".08"/><circle class="fit-handle" data-handle="${end}" cx="${x(area)}" cy="${y(M.predict(this.model, area))}" r="7" fill="#fff9e6" stroke="#b87a30" stroke-width="2.5"/>`;
      picture += '</g>';
      this.svg.innerHTML = picture;
      this.svg.setAttribute('aria-label', `${this.count} 套房子的面积与成交价散点图，横轴面积，纵轴价格。${this.phase >= 1 ? '当前直线斜率 ' + format(this.model.slope, 2) + '，截距 ' + format(this.model.intercept) + '。' : ''}`);
      const point = this.data.find(p => p.id === this.selected) || this.data[0];
      this.el('chart-note').textContent = this.phase === 0 ? `${point.id} 的位置是（${point.area} ㎡，${point.price} 万元）。同一批样本中，面积较大的房子通常价格更高。` : this.phase === 1 ? `${point.id} 的已知价格为 ${point.price} 万，直线预测 ${format(M.predict(this.model, point.area))} 万。竖向差距是 ${format(Math.abs(point.price - M.predict(this.model, point.area)))} 万。` : this.phase === 2 ? `蓝色虚线把 ${this.predictionArea} ㎡与预测价格连接起来。淡绿色区域对应当前面积和预算条件，金色圈标出匹配的房源。` : this.wrongLabel ? 'C 的标签被改高，重新拟合的直线也发生变化。灰色虚线是正确标签下的结果。' : '面积是特征，成交价是标签。试着改动 C 的标签，观察直线。';
    }

    announce(message) { this.el('announce').textContent = message; }
    destroy() {
      this.pause(); this.observer?.disconnect(); this.events.abort();
    }
  }

  window.Fitting = {
    render(container = document.getElementById('content')) {
      active?.destroy(); active = new FittingLab(container);
    }
  };
})();

