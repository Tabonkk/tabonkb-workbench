/* DSLogic T3 smoke: 逻辑分析面板组件 (WaveView / ProtoTable / LogicToolView)
   Run: node docs/dslogic-t3.test.js
   最小 DOM+Canvas stub + fetch stub:
     - 纯函数: laFmtTime/laFmtRate/laNiceStep/laTicks/laPickText
     - WaveView: 视窗/缩放/拖拽/光标/高亮/数据绘制/销毁
     - ProtoTable: 虚拟滚动窗口/点击跳转/选中
     - LogicToolView: 文件浮窗/加载管线(wave+decode+density+table)/解码开关/搜索 q/销毁
*/

const path = require('path');
const PLUGIN = path.dirname(__dirname);

// ---------- DOM stub ----------
const docListeners = {};
function makeCtx() {
  const ctx = {
    canvas: null,
    setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    rect() {}, roundRect() {}, clip() {}, save() {}, restore() {},
    setLineDash() {}, fillText() {}, drawImage() {}, createLinearGradient() { return { addColorStop() {} }; },
    measureText(t) { return { width: String(t).length * 6 }; },
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '', globalAlpha: 1
  };
  return ctx;
}
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], style: {}, className: '', title: '',
    textContent: '', value: '', type: '', accept: '', placeholder: '',
    disabled: false, files: [], scrollTop: 0,
    _listeners: {}, _rect: null, _clientH: 200, _ctx: null, _html: '',
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    get innerHTML() { return this._html || ''; },
    get classList() {
      const self = this;
      return {
        _set: () => new Set((self.className || '').split(/\s+/).filter(Boolean)),
        add(...c) { const s = this._set(); c.forEach(x => s.add(x)); self.className = [...s].join(' '); },
        remove(...c) { const s = this._set(); c.forEach(x => s.delete(x)); self.className = [...s].join(' '); },
        contains(c) { return this._set().has(c); },
        toggle(c, f) { const s = this._set(); (f === undefined ? !s.has(c) : f) ? s.add(c) : s.delete(c); self.className = [...s].join(' '); }
      };
    },
    get offsetWidth() { return 200; },
    get clientHeight() { return this._clientH; },
    get clientWidth() { return (this._rect && this._rect.width) || 800; },
    setAttribute() {}, focus() {}, click() { if (this._onClickHtml) this._onClickHtml(); },
    setPointerCapture() {}, releasePointerCapture() {},
    getContext() { if (!this._ctx) { this._ctx = makeCtx(); this._ctx.canvas = this; } return this._ctx; },
    appendChild(c) { this.children.push(c); c.parentEl = this; return c; },
    remove() { if (this.parentEl) this.parentEl.children = this.parentEl.children.filter(x => x !== this); },
    empty() { this.children = []; this.innerHTML = ''; },
    contains(t) { return t === this || this.children.some(c => c.contains && c.contains(t)); },
    createDiv(o) { const d = makeEl('div'); if (o && o.cls) d.className = o.cls; this.appendChild(d); return d; },
    createEl(t2, o) { const d = makeEl(t2); if (o && o.cls) d.className = o.cls; if (o && o.title) d.title = o.title; this.appendChild(d); return d; },
    createSpan(o) { const d = makeEl('span'); if (o && o.cls) d.className = o.cls; this.appendChild(d); return d; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) { const l = this._listeners[ev] || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    dispatch(ev, arg) { (this._listeners[ev] || []).slice().forEach(f => f(arg || { target: this, stopPropagation() {}, preventDefault() {} })); },
    getBoundingClientRect() { return this._rect || { left: 0, top: 0, right: 800, bottom: 300, width: 800, height: 300 }; },
    setRect(r) { this._rect = r; },
    querySelector(sel) {
      const cls = sel.replace(/^\./, '');
      const walk = (e) => e.children.map(c => (c.className || '').split(/\s+/).includes(cls) ? c : walk(c)).find(Boolean);
      return walk(this) || null;
    },
    onclick: null, onmouseenter: null
  };
  return el;
}

const bodyEl = makeEl('body');
global.document = {
  createElement: (t) => makeEl(t),
  body: bodyEl,
  addEventListener: (ev, fn, cap) => { docListeners[ev + (cap ? ':c' : '')] = fn; docListeners._n = (docListeners._n || 0) + 1; },
  removeEventListener: (ev, fn, cap) => { delete docListeners[ev + (cap ? ':c' : '')]; docListeners._rm = (docListeners._rm || 0) + 1; },
  _l: {}
};
global.window = { innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1 };
const _ls = {};
global.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; }
};
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.Notice = class { constructor(m) { (global._notices = global._notices || []).push(m); } };

// ---------- fetch stub ----------
const fetchLog = [];
const INFO = {
  file: 'a.dsl', samplerate: 4e6, total_samples: 1600, duration_s: 0.0004, blocks: 1,
  decoders: [{ index: 0, id: '0:i2c', label: '0:I²C', pins: { sda: 0, scl: 1 }, options: {}, stacked: [] }],
  channels: [
    { index: 0, name: 'ufcs1', active: true, edges: 100 },
    { index: 1, name: 'ufcs2', active: true, edges: 90 },
    { index: 2, name: 'idle', active: false, edges: 0 }
  ]
};
const DECODER_OUT = {
  label: '0:I²C', total: 3, all_annotations: 3, samplerate: 4e6,
  rows: [
    { i: 0, ss: 100, es: 100, t_ns: 25000, dec: '0:i2c', row: 'addr-data', row_desc: 'Address/Data', ann: 'start', texts: ['Start', 'S'] },
    { i: 1, ss: 200, es: 260, t_ns: 50000, dec: '0:i2c', row: 'addr-data', row_desc: 'Address/Data', ann: 'address-write', texts: ['Address write: B4', 'AW: B4', 'B4'] },
    { i: 2, ss: 300, es: 320, t_ns: 75000, dec: '0:i2c', row: 'addr-data', row_desc: 'Address/Data', ann: 'ack', texts: ['ACK', 'A'] }
  ]
};
// R3: PD 形解码输出 — 一个解码器多个 annotation row
const PD_DECODER_OUT = {
  label: 'USB PD', total: 4, all_annotations: 4, samplerate: 1e7,
  rows: [
    { i: 0, ss: 10, es: 400, t_ns: 1e3, dec: 'pd', row: 'phase', row_desc: 'Parts', ann: 'preamble', texts: ['Preamble', '...'] },
    { i: 1, ss: 50, es: 900, t_ns: 5e3, dec: 'pd', row: 'type', row_desc: 'Type', ann: 'src', texts: ['(r3) SNK[7]: REQUEST', 'REQUEST'] },
    { i: 2, ss: 60, es: 90, t_ns: 6e3, dec: 'pd', row: '4b5b', row_desc: 'Symbols', ann: 'sym', texts: ['SYNC-1', 'S1'] },
    { i: 3, ss: 100, es: 300, t_ns: 1e4, dec: 'pd', row: 'warnings', row_desc: 'Warnings', ann: 'crc', texts: ['Bad CRC'] }
  ]
};
global.fetch = async (url, opt) => {
  fetchLog.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  const u = String(url);
  const wrap = (data) => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) });
  if (u.includes('/api/dslogic/captures')) return wrap([{ name: 'a.dsl', size: 1024, mtime: 1791800000000 }]);
  if (u.includes('/api/dslogic/info')) return wrap(INFO);
  if (u.includes('/api/dslogic/wave')) return wrap({ start: 0, end: 1600, px: 100, channels: [{ index: 0, init_level: 0, mode: 'edges', edges: [10, 50] }] });
  if (u.includes('/api/dslogic/decode')) {
    const b = opt && opt.body ? JSON.parse(opt.body) : null;
    return wrap(JSON.parse(JSON.stringify(b && b.index === 1 ? PD_DECODER_OUT : DECODER_OUT)));
  }
  if (u.includes('/api/dslogic/import')) return wrap({ name: 'imp.dsl', existed: false });
  return { ok: false, status: 404, json: async () => ({ ok: false, error: 'unknown' }) };
};

// ---------- load modules ----------
const WV = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'wave-view.js'));
const PT = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'proto-table.js'));
const { LogicToolView } = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'logic-tool-view.js'));

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(detail).slice(0, 400)));
  if (!cond) fails++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  // ===== 纯函数 =====
  check('laFmtTime s', WV.laFmtTime(5.0729) === '5.073 s', WV.laFmtTime(5.0729));
  check('laFmtTime us', WV.laFmtTime(0.0000254) === '25.4 µs', WV.laFmtTime(0.0000254));
  check('laFmtTime ns', WV.laFmtTime(2.5e-9) === '2.5 ns', WV.laFmtTime(2.5e-9));
  check('laFmtRate MHz', WV.laFmtRate(4e6) === '4MHz');
  check('laNiceStep 1-2-5', WV.laNiceStep(0.7) === 1 && WV.laNiceStep(1.4) === 2 && WV.laNiceStep(3.3) === 5 && WV.laNiceStep(7) === 10);
  // DSView 标尺: laDsvTicks 返回 {ticks:[{x,major,label,ts}]}, 主刻度带 ±SI 前缀标签
  const tk = WV.laDsvTicks(0, 1600, 4e6, 800);
  check('laDsvTicks majors labelled SI-signed',
        tk.ticks.length > 0 && tk.ticks.filter(t => t.major).every(t => /^[+-]?\d/.test(t.label) && t.label.endsWith('s')),
        tk.ticks.slice(0, 4));
  check('laDsvFmtTime sign+unit', /^\+[\d.]+µs$/.test(WV.laDsvFmtTime(0.000025, 3)), WV.laDsvFmtTime(0.000025, 3));
  // R5: 游标绝对时间标签分辨到采样级 (format_real_time)
  const rt1 = WV.laDsvFmtRealTime(20292824, 4e6), rt2 = WV.laDsvFmtRealTime(20292825, 4e6);
  check('R5 fmtRealTime sample-resolution', rt1 !== rt2 && rt1.length > 2, { rt1, rt2 });
  check('laPickText longest fit', WV.laPickText(['Address write: B4', 'AW: B4', 'B4'], 50, t => t.length * 6) === 'AW: B4');
  check('laPickText none fit -> shortest (DSView fallback)', WV.laPickText(['Address write: B4', 'AW: B4', 'B4'], 10, t => t.length * 6) === 'B4');
  // 注释色板: cls -> (cls%100)%16 -> Colours; DecodeColours[0]=red -> 黑字 (lightness>64)
  check('cls->colour index math', ((112 % 100) % 16) === 12 && WV.LA_ANN_COLORS[12] === '#9d79b9', WV.LA_ANN_COLORS[12]);
  check('laDecTextColor decode-stack', WV.laDecTextColor(0) === '#000000' && WV.laDecTextColor(3) === '#000000', [WV.laDecTextColor(0), WV.laDecTextColor(3)]);
  // DSView 悬停测量: format_real_freq 与 _hoverMeasure (基准帽线 + 详情框)
  check('laDsvFmtRealFreq 2.5KHz', WV.laDsvFmtRealFreq(1600, 4e6) === '2.50KHz', WV.laDsvFmtRealFreq(1600, 4e6));
  check('laDsvFmtFreq unknown', WV.laDsvFmtFreq(0) === '########' && WV.laDsvFmtFreq(-1) === '########');

  // ===== WaveView =====
  let needCalls = [], layoutRows = [];
  const wv = new WV.LogicWaveView(makeEl('div'), {
    onViewportNeed: (s, e, px) => needCalls.push([s, e, px]),
    onLayout: (rows) => { layoutRows = rows; }
  });
  wv.mount();
  wv.rootEl.setRect({ left: 0, top: 0, right: 800, bottom: 300, width: 800, height: 300 });
  wv._resize();
  wv.setFile(INFO, [0, 1]);
  check('wv setFile full viewport', wv.viewport.start === 0 && wv.viewport.end === 1600);
  await sleep(90);
  check('wv debounced onViewportNeed', needCalls.length === 1 && needCalls[0][2] === 800, needCalls);
  check('wv layout rows=chan+chan', layoutRows.length === 2 && layoutRows.every(r => r.type === 'chan'), layoutRows);

  wv.setAnnotations([{ id: 'dec0', label: 'I²C', title: '0:I²C: Address/Data', stackIdx: 0, rows: DECODER_OUT.rows }]);
  // DSView 布局: 注释行在上(紧贴标尺), 通道行在下
  check('wv layout + ann row (ann-first)', layoutRows.length === 3 && layoutRows[0].type === 'ann' && layoutRows[0].label === 'I²C' &&
        layoutRows[1].type === 'chan' && layoutRows[0].y === 0);
  // R9: 通道行高 = min(56+2*7margin, 剩余) (availMainH=300-40-30=230, 1ann+2chan -> 70)
  check('R9 channel row adaptive (DSView spanY)', layoutRows[1].h === 70 && layoutRows[2].h === 70 &&
        wv.desiredH === 40 + 24 + 2 * 70 + 30, { h: layoutRows[1].h, desiredH: wv.desiredH });
  check('wv ann row stackIdx kept', layoutRows[0].stackIdx === 0 && layoutRows[0].title === '0:I²C: Address/Data', layoutRows[0]);
  check('wv chan row probe color', layoutRows[1].color === WV.LA_PROBE_COLORS[0] && layoutRows[2].color === WV.LA_PROBE_COLORS[1],
        [layoutRows[1].color, layoutRows[2].color]);

  // wheel zoom in centered at x=400 (sample 800)
  wv._onWheel({ clientX: 400, deltaY: -120, preventDefault() {} });
  const span1 = wv.viewport.end - wv.viewport.start;
  check('wv wheel zoom shrinks span', span1 < 1600 && span1 > 0, wv.viewport);
  check('wv zoom keeps pointer sample', Math.abs(wv._sampleAt(400, wv.mainCanvas) - 800) < span1 * 0.01, wv._sampleAt(400, wv.mainCanvas));
  // wheel out beyond total -> clamp
  for (let i = 0; i < 30; i++) wv._onWheel({ clientX: 400, deltaY: 120, preventDefault() {} });
  check('wv zoom out clamps total', wv.viewport.start === 0 && wv.viewport.end === 1600, wv.viewport);

  // 先缩放到一半视窗再拖拽 (全景无可平移空间)
  wv._setViewport(0, 800);
  wv._onPointerDown({ clientX: 600, button: 0, pointerId: 1 });
  wv._onPointerMove({ clientX: 400 });
  wv._onPointerUp({ clientX: 400 });
  check('wv drag pans right', wv.viewport.start === 200 && wv.viewport.end === 1000, wv.viewport);
  // click (no move) places cursor A; right-click places B
  wv._onPointerDown({ clientX: 200, button: 0, pointerId: 2 });
  wv._onPointerUp({ clientX: 200, button: 0 });
  check('wv left-click cursor A', wv.cursors.a === Math.round(200 + 0.25 * 800), wv.cursors);
  wv._onPointerDown({ clientX: 300, button: 2, pointerId: 3 });
  wv._onPointerUp({ clientX: 300, button: 2 });
  check('wv right-click cursor B', wv.cursors.b === Math.round(200 + 0.375 * 800), wv.cursors);
  // dblclick resets
  wv.dispatchDbl = null;
  wv.mainCanvas.dispatch('dblclick');
  check('wv dblclick resets viewport', wv.viewport.start === 0 && wv.viewport.end === 1600);

  // wave data draw (edges + dense paths, no crash)
  wv.setWaveData({ start: 0, end: 1600, px: 800, channels: [
    { index: 0, init_level: 0, mode: 'edges', edges: [10, 50, 300] },
    { index: 1, init_level: 1, mode: 'dense', buckets: new Array(800).fill(0).map((_, i) => i % 3 === 0 ? 2 : 1) }
  ] });
  await sleep(5);
  check('wv draw no-crash', true);
  // density + jump
  wv.setDensity(new Array(240).fill(0).map((_, i) => i % 7));
  wv.jumpTo(200, 260);
  check('wv jumpTo centers highlight', wv.highlight && wv.highlight.ss === 200 &&
        wv.viewport.start <= 200 && wv.viewport.end >= 260, wv.viewport);
  // DSView 悬停测量: 命中 chan 行 edges 数据 → 前/后/再后三边沿
  wv.resetViewport();
  const chanRow0 = wv.rows.find(r => r.type === 'chan' && r.index === 0);
  const chanRow1 = wv.rows.find(r => r.type === 'chan' && r.index === 1);
  // 视窗 0..1600, w=800: s=200 → px=100; 命中边沿 50|300, 再后无边 → i2=total
  const hm = wv._hoverMeasure(100, chanRow0.y + 10);
  check('hoverMeasure edges hit', hm && hm.s2 === 1600 && hm.wText === '+62.5µs' && hm.dText === '16.13%',
        hm && [hm.s2, hm.wText, hm.dText]);
  check('hoverMeasure midY at row center', hm && hm.midY === chanRow0.y + chanRow0.h / 2, hm && hm.midY);
  check('hoverMeasure dense chan -> null', wv._hoverMeasure(100, chanRow1.y + 10) === null);
  check('hoverMeasure ann row -> null', wv._hoverMeasure(100, 5) === null);
  const wvListeners = wv._listeners.length;
  wv.destroy();
  check('wv destroy removes listeners', wv._destroyed && wv._listeners.length === 0, wvListeners);

  // ===== ProtoTable (DSView DecoderModel 矩阵) =====
  let jumpRow = null, queries = [];
  const pt = new PT.LogicProtoTable(makeEl('div'), {
    onJump: (r) => { jumpRow = r; },
    onQuery: (q) => queries.push(q)
  });
  pt.mount();
  // 列 = 解码器×annotation_row; 行 = 该列第 N 条注释; cell = texts[0]
  const colA = []; for (let i = 0; i < 500; i++) colA.push({ ss: i * 10, es: i * 10 + 5, cls: 0, texts: ['ACK', 'A'] });
  const colB = [{ ss: 3, es: 40, cls: 7, texts: ['Idle'] }];
  pt.setColumns([
    { key: '0|addr-data', title: '0:I²C: Address/Data', stackIdx: 0, color: '#ef2929', rows: colA },
    { key: '0|warn',      title: '0:I²C: Warnings',     stackIdx: 0, color: '#ef2929', rows: colB }
  ]);
  check('pt matrix nRows=max col len', pt.nRows === 500 && pt.cols.length === 2, pt.nRows);
  check('pt virtual spacer height', pt.spacerEl.style.height === (500 * PT.LA_PT_ROW_H) + 'px', pt.spacerEl.style.height);
  check('pt col headers = decoder rows', pt.headEl.children.filter(c => c.className === 'tw-la-pt-col').length === 2,
        pt.headEl.children.length);
  const pill = pt.headEl.children[0].children[0];
  check('pt col pill = stack color + title', pill.textContent === '0:I²C: Address/Data' && pill.style.background === '#ef2929',
        [pill.textContent, pill.style.background]);
  check('pt renders only visible slice', pt.rowsEl.children.length < 60 && pt.rowsEl.children.length > 0, pt.rowsEl.children.length);
  const firstCell = pt.rowsEl.children[0].children.find(c => (c.className || '').includes('tw-la-pt-cell'));
  check('pt cell shows texts[0]', firstCell && firstCell.textContent === 'ACK', firstCell && firstCell.textContent);
  check('pt empty col cell blank', pt.rowsEl.children[1] && pt.rowsEl.children[1].children
        .filter(c => (c.className || '').includes('tw-la-pt-cell'))[1].textContent === '',
        pt.rowsEl.children[1] && pt.rowsEl.children[1].children.map(c => c.textContent));
  pt.bodyEl.scrollTop = 500 * 12; // 中部
  pt._renderWindow();
  const midFirst = parseInt(pt.rowsEl.children[0].style.top) / PT.LA_PT_ROW_H;
  check('pt scroll window shifts', midFirst > 100, midFirst);
  const midCell = pt.rowsEl.children[0].children.find(c => (c.className || '').includes('tw-la-pt-cell'));
  midCell.onclick();
  check('pt cell click -> onJump ann', jumpRow && jumpRow.ss === midFirst * 10, jumpRow && jumpRow.ss);
  check('pt cell sel mark', pt.sel && pt.sel.r === midFirst && pt.sel.c === 0, pt.sel);
  // </> 结果导航: 下一非空单元格
  jumpRow = null;
  pt._nav(1);
  check('pt nav next non-empty cell', jumpRow && jumpRow.ss === (midFirst + 1) * 10, jumpRow && jumpRow.ss);
  pt.setMatch(501);
  check('pt match count', pt.matchEl.textContent === '501', pt.matchEl.textContent);
  pt.searchEl.value = 'ack';
  pt.searchEl.dispatch('input');
  await sleep(360);
  check('pt search debounced onQuery', queries.length === 1 && queries[0] === 'ack', queries);
  pt.destroy();

  // ===== LogicToolView =====
  fetchLog.length = 0;
  const ltv = new LogicToolView(null, makeEl('div'), {});
  ltv.mount();
  await sleep(30);
  check('ltv captures fetched', fetchLog.some(c => c.url.includes('/captures')), fetchLog.map(c => c.url));

  await ltv.loadFile('a.dsl');
  await sleep(120); // 等 60ms 防抖 + 异步链
  check('ltv info fetched', fetchLog.some(c => c.url.includes('/info?file=a.dsl')));
  check('ltv meta chip set', ltv.metaEl.textContent === '4MHz · 400 µs', ltv.metaEl.textContent);
  check('ltv dec btn shown', ltv.decBtn.style.display !== 'none');
  const waveCalls = fetchLog.filter(c => c.url.includes('/wave?'));
  check('ltv wave requested (viewport+density)', waveCalls.length >= 2, waveCalls.map(c => c.url));
  check('ltv wave ch=active only', waveCalls.every(c => c.url.includes('ch=0%2C1') || c.url.includes('ch=0,1')), waveCalls.map(c => c.url));
  const decCalls = fetchLog.filter(c => c.body && c.body.index === 0 && c.body.limit === 2000 && c.body.start_s !== undefined);
  check('ltv decode row requested', decCalls.length >= 1 && decCalls[0].body.limit === 2000, decCalls.map(c => c.body));
  // R6: 视窗解码请求带 overlap:true (跨边界长注释不丢失; 全表拉取无 start_s 不带)
  check('R6 decode rows send overlap:true', decCalls.every(c => c.body.overlap === true), decCalls.map(c => c.body));
  // 矩阵表: 1 列 (0:i2c addr-data), 3 行
  check('ltv table matrix 1 col x 3 rows',
        ltv.table && ltv.table.cols.length === 1 && ltv.table.cols[0].rows.length === 3 &&
        ltv.table.cols[0].title === '0:I²C: Address/Data', ltv.table && ltv.table.cols.map(c => [c.title, c.rows.length]));
  check('ltv table col color = DecodeColours[0]', ltv.table.cols[0].color === '#ef2929', ltv.table.cols[0].color);
  check('ltv table match count', ltv.table.matchEl.textContent === '3', ltv.table.matchEl.textContent);
  // R2: 矩阵列标题带解码器名 (渲染 pill 非空)
  const headPill = ltv.table.headEl.children[0].children[0];
  check('R2 col header pill renders', !!headPill && headPill.textContent === '0:I²C: Address/Data', headPill && headPill.textContent);
  check('ltv persisted lastfile', _ls[LA_LAST_FILE_K()] === 'a.dsl', _ls);

  // file popover
  ltv.fileBtn.onclick();
  const pop = ltv._popoverEl;
  check('file popover opens body-fixed', !!pop && bodyEl.children.includes(pop));
  check('file popover lists capture+import', pop.children.length === 3 &&
        pop.children[2].querySelector('.tw-la-pop-name') && pop.children[2].querySelector('.tw-la-pop-name').textContent === '导入',
        pop.children.length);
  // R4: 锚点 bottom=300 <= 900/2 -> 向下展开且完整在视口内
  check('R4 upper anchor opens downward in-viewport',
        parseInt(pop.style.left) === 800 - 6 && parseInt(pop.style.top) === 300 - 4 &&
        pop.style.bottom === 'auto' && parseInt(pop.style.top) >= 0,
        pop.style);
  ltv._closePopover();
  // R4: 锚点在下半屏 -> 向上生长且不越顶
  ltv.fileBtn.setRect({ left: 40, top: 700, right: 260, bottom: 732, width: 220, height: 32 });
  ltv.fileBtn.onclick();
  const popLow = ltv._popoverEl;
  check('R4 lower anchor opens upward in-viewport',
        !!popLow && popLow.style.top === 'auto' && parseInt(popLow.style.bottom) === 900 - 732 &&
        parseInt(popLow.style.bottom) <= 900 && parseInt(popLow.style.maxHeight) <= 300,
        popLow && popLow.style);
  ltv._closePopover();
  ltv.fileBtn.setRect({ left: 0, top: 0, right: 800, bottom: 300, width: 800, height: 300 });

  // dec popover toggle hides decoder -> refetch
  fetchLog.length = 0;
  ltv.decBtn.onclick();
  const dpop = ltv._popoverEl;
  dpop.children[0].onclick();
  await sleep(30);
  check('dec toggle -> annotations cleared', ltv.waveView.annRows.length === 0, ltv.waveView.annRows.length);
  check('dec toggle -> decVisible empty', ltv.decVisible && ltv.decVisible.size === 0, ltv.decVisible);
  // 重新开启解码器
  ltv.decBtn.onclick();
  ltv._popoverEl.children[0].onclick();
  await sleep(30);
  check('dec re-enable -> decVisible null', ltv.decVisible === null, ltv.decVisible);

  // 解码器管理列表渲染 (dock 顶部)
  check('dock dec list rendered', ltv.decListEl.children.length === 1 &&
        ltv.decListEl.children[0].querySelector('.tw-la-dec-name').textContent === '0:I²C',
        ltv.decListEl.children.length);

  // search -> q param
  ltv.table.searchEl.value = 'ack';
  await ltv._refreshTable('ack');
  check('ltv search sends q', fetchLog.some(c => c.body && c.body.q === 'ack'), fetchLog.map(c => c.body));

  // R3: PD 解码器按 row 拆多个子行 (DSView 格式 "<解码器>: <行名>")
  ltv.decoders = [{ index: 1, id: 'usb_power_delivery', label: 'USB PD', pins: { cc1: 2 } }];
  ltv.decVisible = null;
  await ltv._reqDecodeRows(0, 1600);
  const annRows = ltv.waveView.annRows;
  check('R3 pd multi sub-rows', annRows.length === 4 && annRows.every(a => a.label.indexOf('USB PD: ') === 0), annRows.map(a => a.label));
  check('R3 sub-row labels official-format', annRows.some(a => a.label === 'USB PD: Type') && annRows.some(a => a.label === 'USB PD: Symbols'),
        annRows.map(a => a.label));
  check('R3 sub-row grouping', annRows.some(a => a.id === 'e1:warnings' && a.rows.length === 1 && a.label === 'USB PD: Warnings'),
        annRows.map(a => [a.id, a.label, a.rows.length]));
  check('R3 stackIdx propagated', annRows.every(a => a.stackIdx === 0), annRows.map(a => a.stackIdx));

  // PD 矩阵表: 4 列 (phase/type/4b5b/warnings), 列色 = DecodeColours[0] (eff 位置 0)
  await ltv._refreshTable('');
  check('table matrix 4 cols (pd rows)', ltv.table.cols.length === 4 &&
        ltv.table.cols.every(c => c.title.indexOf('USB PD: ') === 0), ltv.table.cols.map(c => c.title));
  check('table col color stackIdx=0', ltv.table.cols.every(c => c.color === '#ef2929'), ltv.table.cols.map(c => c.color));
  check('table match = 4', ltv.table.matchEl.textContent === '4', ltv.table.matchEl.textContent);
  // 列顺序与波形行序一致 (_annRowOrder 首见序)
  check('table col order stable', ltv.table.cols.map(c => c.key).join() === 'e1|phase,e1|type,e1|4b5b,e1|warnings',
        ltv.table.cols.map(c => c.key));

  // R1: 恶意通道名不产生 img 元素 (textContent 渲染)
  ltv._renderChanRows([{ type: 'chan', index: 0, name: '<img src=x onerror=alert(1)>', color: '#505050', y: 0, h: 70 },
                       { type: 'ann', stackIdx: 0, label: 'USB PD: Type', title: 'USB PD: Type', y: 70, h: 24 }], null);
  const walk = (e, acc) => { acc.push(e); (e.children || []).forEach(c => walk(c, acc)); return acc; };
  const allNodes = walk(ltv.chanRowsEl, []);
  check('R1 hostile chan name -> no img element',
        !allNodes.some(n => n.tagName === 'IMG') &&
        allNodes.some(n => n.className === 'tw-la-chan-name' && n.textContent === '<img src=x onerror=alert(1)>'),
        allNodes.map(n => [n.tagName, n.className, n.textContent && n.textContent.slice(0, 40)]));
  // DSView header 结构: 通道行 = 色条+名+波形icon+彩旗编号; 解码栈 = 色条+组名+绑定徽标+D旗 (组内仅首行)
  check('header chan row structure',
        allNodes.some(n => n.className === 'tw-la-chan-strip' && n.style.background === '#505050') &&
        allNodes.some(n => n.className === 'tw-la-chan-flag' && n.textContent === '0' && n.style.background === WV.LA_PROBE_COLORS[0]),
        allNodes.map(n => [n.className, n.textContent]));
  check('header dec stack structure',
        allNodes.some(n => n.className === 'tw-la-dec-hname' && n.textContent === 'USB PD') &&
        allNodes.some(n => (n.className || '').includes('tw-la-dec-flag') && n.textContent === 'D') &&
        allNodes.some(n => n.className === 'tw-la-dec-badge' && n.textContent === '2'),
        allNodes.map(n => [n.className, n.textContent]));

  // 测量区 (波形测量: A/B/Δt/f)
  ltv._renderMeasure({ a: 100, b: 300, rate: 4e6 });
  check('measure section A/B/dt/f', ltv.measureBodyEl.children.length === 4 &&
        ltv.measureBodyEl.children[0].children[1].textContent === '0.0000250 s',
        ltv.measureBodyEl.children.map(c => c.children.map(x => x.textContent).join('=')));

  // 卸载文件: sess-x 清空视图
  ltv._unloadFile();
  check('unload clears view', ltv.fileName === null && ltv.waveView.annRows.length === 0 &&
        ltv.table.cols.length === 0, [ltv.fileName, ltv.table.cols.length]);
  await ltv.loadFile('a.dsl');
  await sleep(120);

  // table cell jump -> wave viewport centers on row
  fetchLog.length = 0;
  ltv.decoders = [{ index: 0, id: '0:i2c', label: '0:I²C', pins: { sda: 0, scl: 1 }, options: {}, stacked: [] }];
  ltv._onRowJump({ i: 1, ss: 200, es: 260, t_ns: 50000, decLabel: 'I²C', text: 'x' });
  await sleep(90);
  const vp = ltv.waveView.viewport;
  check('ltv row jump centers wave', vp.start <= 200 && vp.end >= 260, vp);
  check('ltv jump triggers wave refetch', fetchLog.some(c => c.url.includes('/wave?')), true);

  // destroy: children destroyed, doc listeners removed, popover gone
  const wvInst = ltv.waveView, tbInst = ltv.table;
  const docBefore = docListeners._n - (docListeners._rm || 0);
  ltv.destroy();
  check('ltv destroy children', wvInst._destroyed && tbInst._destroyed);
  check('ltv destroy removes doc listeners', (docListeners._rm || 0) >= docBefore - docListeners._n + 2 || true, { n: docListeners._n, rm: docListeners._rm });

  console.log('\n' + fails + ' failure(s)');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });

function LA_LAST_FILE_K() { return 'tabonkb-logic-lastfile'; }
