/* ==========================================================================
   LogicWaveView — DSLogic 波形 Canvas 视图 (T3, DSView 1:1 复刻版)
   纯渲染组件，不直接请求网络:
     - setFile(info) 装入采集元数据并重置全景视窗
     - setWaveData(data) 喂入 GET /api/dslogic/wave 的响应 data
     - setAnnotations(rows) 喂入解码注释行 [{id,label,title,stackIdx,rows:[{ss,es,texts,cls}]}]
     - setDensity(arr) 喂入全局活动密度数组 (缩略图)
   视窗变化经 onViewportNeed(start,end,px) (60ms 防抖) 通知父视图拉数据;
   行布局经 onLayout(rows, desiredH) 通知父视图同步通道名栏。

   视觉与行为参数全部移植自 DSView v1.3.2 源码:
     - pv/view/decodetrace.cpp  Colours[16]/OutlineColours[16]/DecodeColours[4]
                               六边形注释块(cap=min(w/4,5)) / instant 圆角块 /
                               draw_nodetail「Zoom in for details」/ 行首 ▶+title
     - pv/view/trace.cpp        PROBE_COLORS[8] / SquareWidth=20 / Margin=3
     - pv/view/ruler.cpp        draw_logic_tick_mark: min_period=ceil(32px→10采样量子)
                               ±精度2位标签 / 次级刻度相对偏移标签
     - pv/view/cursor.cpp       标尺底部彩色标签 + 三角箭头 + X 关闭框
     - pv/view/ruler.cpp        CursorHsbColorTable HSV 游标色
   ========================================================================== */

// ---------- DSView 官方配色常量 ----------

const LA_DECODE_COLORS = ['#ef2929', '#fce94f', '#8ae234', '#729fcf'];  // DecodeColours[4]

// DecodeTrace::Colours[16] — 注释块填充色, 索引 = (ann_type % 100) % 16
const LA_ANN_COLORS = ['#ef2929', '#f66a32', '#fcae3e', '#fbca47',
                       '#fce94f', '#cdf040', '#8ae234', '#4edc44',
                       '#55d795', '#64d1d2', '#729fcf', '#d476c4',
                       '#9d79b9', '#ad7fa8', '#c2629b', '#d7476f'];
// DecodeTrace::OutlineColours[16] — 窄块描边/竖线色
const LA_ANN_OUTLINES = ['#771414', '#7b3519', '#7e571f', '#7d6523',
                         '#7e7427', '#667820', '#45711a', '#276e22',
                         '#2a6b4a', '#326869', '#394f67', '#6a3b62',
                         '#4e3c5c', '#563f54', '#61314d', '#6b2337'];
// Trace::PROBE_COLORS[8] — 通道旗标色 (index % 8)
const LA_PROBE_COLORS = ['#505050', '#8f5202', '#cc0000', '#f57900',
                         '#edd400', '#73d216', '#3465a4', '#75507b'];

// Ruler::CursorHsbColorTable — 游标序号 → HSV 色相
const LA_CURSOR_HSV = [120, 195, 270, 345, 60, 135, 210, 285, 15, 75,
                       150, 225, 300, 30, 90, 165, 240, 315, 45, 105,
                       180, 255];

const LA_SI_PREFIXES = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G'];
const LA_FREQ_PREFIXES = ['P', 'T', 'G', 'M', 'K', '', '', '', ''];   // Ruler::FreqPrefixes



function laCursorCss(order) {   // Ruler::GetColorByCursorOrder: hsv(H,200,200,180)
  const h = LA_CURSOR_HSV[(order - 1) % LA_CURSOR_HSV.length];
  const c = laHsvN(h, 200 / 255, 200 / 255);
  return `rgba(${c[0]},${c[1]},${c[2]},0.7)`;
}
function laHsvN(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Ruler::format_time — 符号 + 定点小数 + SI 前缀单位 (t 秒, prefix 见 SIPrefixes)
function laDsvFmtTime(t, prefix, precision) {
  if (precision == null) precision = 2;
  const mult = Math.pow(10, -prefix * 3 + 21);   // -prefix*3 - FirstSIPrefixPower(-15) + 6
  const v = t * mult / 1e6;
  return (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(precision) + (LA_SI_PREFIXES[prefix] || '') + 's';
}

// Ruler::format_real_time — 按采样序号给绝对时间标签 (游标用)
function laDsvFmtRealTime(idx, rate) {
  const v1 = Math.pow(10, 12) / rate;             // ps/采样
  const dt = v1 * idx;
  if (!isFinite(dt)) return '########';
  if (dt === 0) return '0';
  let d = Math.floor(dt), zero = 0;
  while (d !== 0 && d === Math.floor(d / 10) * 10) { d = Math.floor(d / 10); zero++; }
  const prefix = Math.floor(Math.log10(dt));
  return laDsvFmtTime(d / Math.pow(10, 12 - zero), Math.floor(prefix / 3) + 1,
                      Math.max(0, Math.floor(prefix / 3) * 3 - zero));
}

// Ruler::format_freq — 周期(秒) → 频率标签 "%.2f XHz"
function laDsvFmtFreq(period, precision) {
  if (!(period > 0) || !isFinite(period)) return '########';   // View::Unknown_Str
  if (precision == null) precision = 2;
  const order = Math.ceil(Math.log10(period));
  const prefix = Math.ceil((order + 15) / 3);
  const mult = Math.pow(10, Math.max(-prefix * 3 + 15, 0));
  return (1 / (period * mult)).toFixed(precision) + (LA_FREQ_PREFIXES[prefix] || '') + 'Hz';
}
// Ruler::format_real_freq — 按采样序号差给频率
function laDsvFmtRealFreq(delta, rate) { return laDsvFmtFreq(delta / rate); }

// Ruler::draw_logic_tick_mark 移植:
//   min_period = ceil(scale*32 / (10/rate)) * (10/rate)
//   prefix     = floor(log10(scale*viewW)) → SIPrefixes[(order+15)/3]
//   tick_period 累加直到标签能放下 (typical = 文本宽+16)
//   次级刻度 = tick/10, 密集时显示相对大刻度偏移
function laDsvTicks(vStart, vEnd, rate, pxW, viewSecSpan, measurer) {
  if (!rate || !(pxW > 0) || !(vEnd > vStart)) return { ticks: [], prefix: 5 };
  const scale = (vEnd - vStart) / rate / pxW;      // 秒/像素
  const absMin = 10.0 / rate;                      // 10 采样最小周期(秒)
  const minPeriod = Math.ceil(scale * 32 / absMin) * absMin;
  const order = Math.floor(Math.log10(Math.max(1e-18, scale * pxW)));
  const prefix = Math.max(0, Math.min(8, Math.floor((order + 15) / 3)));
  const meas = measurer || ((t) => t.length * 6);
  const typicalW = meas(laDsvFmtTime(vStart / rate, prefix)) + 16;
  let tickPeriod = 0;
  do { tickPeriod += minPeriod; } while (typicalW > tickPeriod / scale && tickPeriod < 1e12);
  const minorPeriod = tickPeriod / 10;
  const minorOrder = Math.floor(Math.log10(minorPeriod));
  const minorPrefix = Math.max(0, Math.min(8, Math.floor((minorOrder + 15) / 3)));
  const incTextW = meas(laDsvFmtTime(minorPeriod, minorPrefix)) + 16;
  const firstMajor = Math.floor((vStart / rate) / tickPeriod);
  const firstMinor = Math.floor((vStart / rate) / minorPeriod + 1);
  const t0 = firstMajor * tickPeriod;
  let division = Math.round(firstMinor - firstMajor * 10) - 1;
  const ticks = [];
  let guard = 0;
  for (;;) {
    const t = t0 + division * minorPeriod;
    const majorT = t0 + Math.floor(division / 10) * tickPeriod;
    const x = (t * rate - vStart) / (vEnd - vStart) * pxW;
    if (x > pxW + 40 || ++guard > 400) break;
    if (division % 10 === 0) {
      ticks.push({ x, major: true, label: laDsvFmtTime(t, prefix), ts: t });
    } else {
      let label = null;
      if (minorPeriod / scale > 2 * typicalW) label = laDsvFmtTime(t, prefix);
      else if (minorPeriod / scale > 1.1 * incTextW || tickPeriod / scale > pxW)
        label = laDsvFmtTime(t - majorT, minorPrefix);   // 相对偏移
      ticks.push({ x, major: false, label, ts: t });
    }
    division++;
  }
  return { ticks, prefix, tickPeriod, minorPeriod };
}

// ---------- 兼容导出 (旧测试/meta 用) ----------

function laFmtTime(s) {
  if (s == null || !isFinite(s)) return '--';
  const neg = s < 0; s = Math.abs(s);
  let v, u;
  if (s >= 1)        { v = s;        u = 's';  }
  else if (s >= 1e-3) { v = s * 1e3;  u = 'ms'; }
  else if (s >= 1e-6) { v = s * 1e6;  u = 'µs'; }
  else if (s >= 1e-9) { v = s * 1e9;  u = 'ns'; }
  else               { v = s;        u = 's';  }
  const str = v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3);
  return (neg ? '-' : '') + str.replace(/\.?0+$/, '') + ' ' + u;
}

function laFmtRate(rate) {
  if (!rate) return '--';
  if (rate >= 1e9) return (rate / 1e9) + 'GHz';
  if (rate >= 1e6) return (rate / 1e6) + 'MHz';
  if (rate >= 1e3) return (rate / 1e3) + 'kHz';
  return rate + 'Hz';
}

function laNiceStep(raw) {
  if (!(raw > 0) || !isFinite(raw)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// 注释文本: DSView draw_range 选最宽能放下的变体, 放不下取最后一条
function laPickText(texts, availW, measurer) {
  if (!texts || !texts.length) return '';
  let best = '', bw = 0;
  for (const t of texts) {
    const w = measurer(t);
    if (w <= availW && w > bw) { best = t; bw = w; }
  }
  return best || texts[texts.length - 1];
}

// DecodeColours 亮度 → 黑/白文字 (get_text_colour: lightness>64 → 黑)
function laDecTextColor(stackIdx) {
  const hex = LA_DECODE_COLORS[(stackIdx || 0) % 4];
  const v = parseInt(hex.slice(1), 16);
  const r = v >> 16, g = (v >> 8) & 255, b = v & 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 > 64 ? '#000000' : '#ffffff';
}

// ---------- 视图常量 ----------

const LA_RULER_H = 40;          // DSView 标尺高度(顶部文本+刻度+底部光标标签带)
const LA_MINI_H = 30;
const LA_ANN_H = 24;
const LA_SIG_MARGIN = 7;        // View::SignalMargin
const LA_SIG_H_MAX = 56;
const LA_SIG_H_MIN = 10;
const LA_WHEEL_ZOOM = 1.25;
const LA_FETCH_DEBOUNCE = 60;
const LA_ENDCAP_W = 5;          // DecodeTrace::EndCapWidth
const LA_ARROW = 4;             // DecodeTrace::ArrowSize

const LA_FORE = 'rgba(239,240,241,0.78)';   // palette fg @ForeAlpha(200)
const LA_FORE_DIM = 'rgba(239,240,241,0.39)'; // BackAlpha(100)
const LA_BACK = '#1f1f1f';
const LA_SEL = 'rgba(17,133,209,0.28)';
const LA_MEAS_ACT = '#eeb211';              // View::Orange  (back 深色 → active_color=Orange)
const LA_MEAS_BOX = 'rgba(17,133,209,0.78)'; // View::LightBlue(17,133,209,200)

class LogicWaveView {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts || {};
    this.onViewportNeed = opts.onViewportNeed || null;  // (start,end,px)
    this.onLayout = opts.onLayout || null;              // (rows,desiredH)
    this.onCursorChange = opts.onCursorChange || null;  // ({a,b}) 通知测量区

    this.rate = 0;
    this.total = 0;
    this.chanRows = [];        // [{index,name}]
    this.annRows = [];         // [{id,label,title,stackIdx,rows:[{ss,es,texts,cls}]}]
    this.waveData = null;
    this.density = null;
    this.viewport = { start: 0, end: 0 };
    this.cursors = { a: null, b: null };
    this.measureOn = true;
    this.highlight = null;
    this.rows = [];

    this._destroyed = false;
    this._listeners = [];
    this._timers = [];
    this._raf = 0;
    this._fetchTimer = 0;
    this._drag = null;
    this._ro = null;
    this._textW = new Map();
    this._w = 0; this._h = 0;
    this._hoverPt = null;      // 悬停测量锚点 (Viewport::measure 的 _mouse_point)
    this._cursorBoxes = [];    // 标尺上光标标签的命中盒
  }

  mount() {
    this.rootEl = this.container.createDiv({ cls: 'tw-la-wv' });
    this.rulerCanvas = this._mkCanvas(this.rootEl, 'tw-la-wv-ruler');
    this.mainCanvas = this._mkCanvas(this.rootEl, 'tw-la-wv-main');
    this.miniCanvas = this._mkCanvas(this.rootEl, 'tw-la-wv-mini');

    this._on(this.mainCanvas, 'wheel', (e) => this._onWheel(e), { passive: false });
    this._on(this.mainCanvas, 'pointerdown', (e) => this._onPointerDown(e));
    this._on(this.mainCanvas, 'pointermove', (e) => this._onPointerMove(e));
    this._on(this.mainCanvas, 'pointerup', (e) => this._onPointerUp(e));
    this._on(this.mainCanvas, 'pointerleave', () => { this._drag = null; this._hoverPt = null; this.requestRedraw(); });
    this._on(this.mainCanvas, 'dblclick', () => this.resetViewport());
    this._on(this.mainCanvas, 'contextmenu', (e) => e.preventDefault());
    this._on(this.rulerCanvas, 'pointerdown', (e) => this._onRulerDown(e));
    this._on(this.miniCanvas, 'pointerdown', (e) => this._onMiniClick(e));

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.rootEl);
    }
    this._resize();
  }

  _mkCanvas(parent, cls) {
    const c = document.createElement('canvas');
    c.className = cls;
    parent.appendChild(c);
    return c;
  }

  _on(el, ev, fn, opt) {
    el.addEventListener(ev, fn, opt);
    this._listeners.push([el, ev, fn, opt]);
  }

  // ---------- 数据入口 ----------

  setFile(info, chanIdxs) {
    this._infoChannels = info.channels || [];
    this.rate = info.samplerate || 0;
    this.total = info.total_samples || 0;
    const chans = this._infoChannels;
    this.chanRows = (chanIdxs && chanIdxs.length ? chanIdxs
      : chans.filter(c => c.active).map(c => c.index))
      .map(i => ({ index: i, name: (chans[i] && chans[i].name) || String(i) }));
    this.annRows = [];
    this.waveData = null;
    this.density = null;
    this.cursors = { a: null, b: null };
    this.highlight = null;
    this.viewport = { start: 0, end: this.total };
    this._layout();
    this._scheduleFetch();
    this.requestRedraw();
  }

  setChannels(chanIdxs, info) {
    const src = info || { channels: this._infoChannels || [] };
    this.chanRows = (chanIdxs || []).map(i => ({ index: i, name: (src.channels[i] && src.channels[i].name) || String(i) }));
    this._layout();
    this._scheduleFetch();
    this.requestRedraw();
  }

  setInfoChannels(channels) { this._infoChannels = channels; }

  setWaveData(data) {
    this.waveData = data;
    this.requestRedraw();
  }

  setAnnotations(annRows) {
    this.annRows = annRows || [];
    this._layout();
    this.requestRedraw();
  }

  setDensity(arr) {
    this.density = arr;
    this.requestRedraw();
  }

  setMeasure(on) {
    this.measureOn = !!on;
    if (!on) this.cursors = { a: null, b: null };
    this.requestRedraw();
  }

  jumpTo(ss, es) {
    if (!this.total) return;
    const span = Math.max((es - ss) * 6, this.rate * 40e-6, 8);
    const mid = (ss + es) / 2;
    this._setViewport(mid - span / 2, mid + span / 2);
    this.highlight = { ss, es };
  }

  resetViewport() {
    if (!this.total) return;
    this._setViewport(0, this.total);
    this.highlight = null;
  }

  // ---------- 视窗 ----------

  _setViewport(start, end) {
    if (!this.total) { this.viewport = { start: 0, end: 0 }; return; }
    const minSpan = Math.max(4, Math.round(this.rate * 1e-6));
    let span = Math.max(minSpan, end - start);
    if (span > this.total) span = this.total;
    let s = start, e = start + span;
    if (s < 0) { s = 0; e = span; }
    if (e > this.total) { e = this.total; s = e - span; }
    if (s === this.viewport.start && e === this.viewport.end) return;
    this.viewport = { start: s, end: e };
    this._scheduleFetch();
    this.requestRedraw();
  }

  _scheduleFetch() {
    clearTimeout(this._fetchTimer);
    this._fetchTimer = setTimeout(() => {
      if (this._destroyed || !this.onViewportNeed) return;
      this.onViewportNeed(this.viewport.start, this.viewport.end, this._w || 800);
    }, LA_FETCH_DEBOUNCE);
    this._timers.push(this._fetchTimer);
  }

  // ---------- 交互 ----------

  _sampleAt(clientX, canvas) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    const w = r.width || this._w || 1;
    return this.viewport.start + (x / w) * (this.viewport.end - this.viewport.start);
  }

  _onWheel(e) {
    if (!this.total) return;
    e.preventDefault();
    const s = this._sampleAt(e.clientX, this.mainCanvas);
    const f = e.deltaY < 0 ? 1 / LA_WHEEL_ZOOM : LA_WHEEL_ZOOM;
    const { start, end } = this.viewport;
    this._setViewport(s - (s - start) * f, s + (end - s) * f);
  }

  _cursorNear(clientX) {
    // 命中波形区内的光标竖线 (±6px) → 拖拽移动
    const w = this._w || 1;
    const span = Math.max(1e-9, this.viewport.end - this.viewport.start);
    const s2x = (s) => (s - this.viewport.start) / span * w;
    const r = this.mainCanvas.getBoundingClientRect();
    const x = clientX - r.left;
    for (const k of ['a', 'b']) {
      const s = this.cursors[k];
      if (s != null && Math.abs(s2x(s) - x) <= 6) return k;
    }
    return null;
  }

  _onPointerDown(e) {
    if (!this.total) return;
    const near = this._cursorNear(e.clientX);
    this._drag = {
      x0: e.clientX, v0: { ...this.viewport }, moved: false,
      btn: e.button, sAt0: this._sampleAt(e.clientX, this.mainCanvas),
      cursor: near
    };
    try { this.mainCanvas.setPointerCapture(e.pointerId); } catch (_) {}
  }

  _onPointerMove(e) {
    const d = this._drag;
    if (!d) {
      const r = this.mainCanvas.getBoundingClientRect();
      this._hoverPt = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.requestRedraw();
      return;
    }
    this._hoverPt = null;
    if (d.cursor) {
      this.cursors[d.cursor] = Math.max(0, Math.min(this.total, Math.round(this._sampleAt(e.clientX, this.mainCanvas))));
      d.moved = true;
      this._emitCursors();
      this.requestRedraw();
      return;
    }
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) <= 3) return;
    d.moved = true;
    const span = d.v0.end - d.v0.start;
    const w = this.mainCanvas.getBoundingClientRect().width || this._w || 1;
    const ns = d.v0.start - dx / w * span;
    this._setViewport(ns, ns + span);
  }

  _onPointerUp(e) {
    const d = this._drag;
    this._drag = null;
    if (!d || d.moved) return;
    if (!this.measureOn) return;
    const s = Math.round(d.sAt0);
    if (d.btn === 0) this.cursors.a = s;
    else if (d.btn === 2) this.cursors.b = s;
    else return;
    this._emitCursors();
    this.requestRedraw();
  }

  // 标尺点击: 点光标标签 X → 删除; 点标签/近线 → 拖动; 空白处 → 在指针位放下一光标
  _onRulerDown(e) {
    if (!this.total) return;
    const r = this.rulerCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (const box of this._cursorBoxes) {
      if (box.close && x >= box.close.x0 && x <= box.close.x1 && y >= box.close.y0 && y <= box.close.y1) {
        this.cursors[box.key] = null;
        this._emitCursors();
        this.requestRedraw();
        return;
      }
    }
    const s = Math.max(0, Math.min(this.total, Math.round(this._sampleAt(e.clientX, this.rulerCanvas))));
    if (this.cursors.a == null) this.cursors.a = s;
    else if (this.cursors.b == null) this.cursors.b = s;
    else {
      const da = Math.abs(s - this.cursors.a), db = Math.abs(s - this.cursors.b);
      if (da <= db) this.cursors.a = s; else this.cursors.b = s;
    }
    this._emitCursors();
    this.requestRedraw();
  }

  _emitCursors() {
    if (this.onCursorChange) {
      try { this.onCursorChange({ a: this.cursors.a, b: this.cursors.b, rate: this.rate }); } catch (_) {}
    }
  }

  _onMiniClick(e) {
    if (!this.total) return;
    const r = this.miniCanvas.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1)));
    const mid = frac * this.total;
    const span = this.viewport.end - this.viewport.start;
    this._setViewport(mid - span / 2, mid + span / 2);
  }

  // ---------- 布局与绘制 ----------

  _resize() {
    if (!this.rootEl || this._destroyed) return;
    const rect = this.rootEl.getBoundingClientRect();
    const w = Math.max(50, Math.floor(rect.width));
    const h = Math.max(80, Math.floor(rect.height));
    if (w === this._w && h === this._h) { this.requestRedraw(); return; }
    this._w = w; this._h = h;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const setSize = (c, ch) => { c.width = Math.round(w * dpr); c.height = Math.round(ch * dpr); c.style.width = w + 'px'; c.style.height = ch + 'px'; };
    this._layout();
    setSize(this.rulerCanvas, LA_RULER_H);
    setSize(this.mainCanvas, Math.max(40, h - LA_RULER_H - LA_MINI_H));
    setSize(this.miniCanvas, LA_MINI_H);
    this._scheduleFetch();
    this.requestRedraw();
  }

  _layout() {
    const availMainH = Math.max(40, this._h - LA_RULER_H - LA_MINI_H);
    const nChan = this.chanRows.length;
    const nAnn = this.annRows.length;
    // DSView: spanY = signalHeight + 2*SignalMargin
    let chanH;
    if (nChan === 0) chanH = LA_SIG_H_MAX + 2 * LA_SIG_MARGIN;
    else {
      chanH = Math.min(LA_SIG_H_MAX + 2 * LA_SIG_MARGIN,
                       Math.floor((availMainH - nAnn * LA_ANN_H) / nChan));
      if (chanH < LA_SIG_H_MIN + 6) chanH = Math.max(16, Math.floor((availMainH - nAnn * LA_ANN_H) / nChan));
    }
    let rowsH = nChan * chanH + nAnn * LA_ANN_H;
    if (nChan + nAnn === 0) rowsH = availMainH;
    if (rowsH > availMainH) rowsH = availMainH;
    this._rowsH = rowsH;
    const rows = [];
    let y = 0;
    // DSView 布局: 解码注释行在上 (紧贴标尺), 通道波形行在下
    this.annRows.forEach((a) => {
      rows.push({ type: 'ann', id: a.id, label: a.label, title: a.title, stackIdx: a.stackIdx, y, h: LA_ANN_H });
      y += LA_ANN_H;
    });
    for (const c of this.chanRows) {
      rows.push({ type: 'chan', index: c.index, name: c.name, color: LA_PROBE_COLORS[c.index % 8], y, h: chanH });
      y += chanH;
    }
    this.rows = rows;
    this.desiredH = LA_RULER_H + rowsH + LA_MINI_H;
    if (this.onLayout) { try { this.onLayout(rows, this.desiredH); } catch (_) {} }
  }

  requestRedraw() {
    if (this._raf || this._destroyed) return;
    const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (f => setTimeout(f, 16));
    this._raf = raf(() => { this._raf = 0; this._draw(); });
  }

  _ctx2d(c) {
    const ctx = c.getContext('2d');
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  syncThemeColors(force = false) {
    const root = (this.rootEl && this.rootEl.closest && this.rootEl.closest('.tw-la-root')) || this.rootEl;
    const sig = root && root.dataset ? (root.dataset.laTheme || 'native') : 'native';
    if (!force && this._cachedLaPal && this._cachedLaSig === sig) {
      return this._cachedLaPal;
    }
    let cs = null;
    try {
      if (root && typeof getComputedStyle === 'function') cs = getComputedStyle(root);
    } catch (_) {}
    const g = (k, fb) => {
      if (!cs) return fb;
      const v = cs.getPropertyValue(k);
      return (v && v.trim()) ? v.trim() : fb;
    };
    this._cachedLaSig = sig;
    this._cachedLaPal = {
      back: g('--la-back', LA_BACK),
      fore: g('--la-fore', LA_FORE),
      foreDim: g('--la-fore-dim', LA_FORE_DIM),
      sel: g('--la-sel', LA_SEL),
      measAct: g('--la-meas-act', LA_MEAS_ACT),
      measBox: g('--la-meas-box', LA_MEAS_BOX)
    };
    return this._cachedLaPal;
  }

  _pal() {
    return this.syncThemeColors(false);
  }

  _draw() {
    if (this._destroyed || !this._w) return;
    this._drawRuler();
    this._drawMain();
    this._drawMini();
  }

  // ---------- 标尺 (DSView draw_logic_tick_mark) ----------

  _drawRuler() {
    const pal = this._pal();
    const ctx = this._ctx2d(this.rulerCanvas);
    const { start, end } = this.viewport;
    const w = this._w;
    ctx.clearRect(0, 0, w, LA_RULER_H);
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = pal.back;
    ctx.fillRect(0, 0, w, LA_RULER_H);
    const textH = 10;
    const majorY1 = textH + 15, tickY2 = LA_RULER_H - 14;
    const minorY1 = (majorY1 + tickY2) / 2;
    if (this.total && this.rate) {
      const t = laDsvTicks(start, end, this.rate, w, null,
        (s) => this._measure(ctx, s));
      ctx.strokeStyle = pal.fore;
      ctx.fillStyle = pal.fore;
      ctx.lineWidth = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const tk of t.ticks) {
        const x = Math.round(tk.x) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, tk.major ? majorY1 : minorY1);
        ctx.lineTo(x, tickY2);
        ctx.stroke();
        if (tk.label) ctx.fillText(tk.label, x, 4);
      }
    }
    // 游标标签: 标尺底部 彩色矩形 + 下三角 + 序号 + X 关闭框
    this._cursorBoxes = [];
    if (this.measureOn) {
      let order = 0;
      for (const key of ['a', 'b']) {
        const s = this.cursors[key];
        if (s == null) continue;
        order++;
        this._drawCursorLabel(ctx, s, key, order);
      }
    }
  }

  _drawCursorLabel(ctx, s, key, order) {
    const w = this._w;
    const span = Math.max(1e-9, this.viewport.end - this.viewport.start);
    const x = (s - this.viewport.start) / span * w;
    const txt = this.rate ? laDsvFmtRealTime(s, this.rate) : String(s);
    const tw = this._measure(ctx, txt) + 10;
    const labelH = 13, arrow = 6;
    const top = LA_RULER_H - labelH - 1 - arrow;
    const x0 = x - tw / 2;
    const col = laCursorCss(order);
    ctx.fillStyle = col;
    ctx.fillRect(x0, top, tw, labelH);
    ctx.beginPath();
    ctx.moveTo(x - arrow, top + labelH);
    ctx.lineTo(x + arrow, top + labelH);
    ctx.lineTo(x, LA_RULER_H - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, top + labelH / 2);
    ctx.font = '8px "Segoe UI", sans-serif';
    ctx.fillText(String(order), x, top + labelH + arrow / 2 - 1);
    ctx.font = '10px "Segoe UI", sans-serif';
    // X 关闭框 (标签右侧)
    const cx0 = x0 + tw, cs = 9;
    ctx.fillStyle = '#eea311';
    ctx.fillRect(cx0, top, cs, Math.min(cs, labelH));
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx0 + 2, top + 2); ctx.lineTo(cx0 + cs - 2, top + Math.min(cs, labelH) - 2);
    ctx.moveTo(cx0 + 2, top + Math.min(cs, labelH) - 2); ctx.lineTo(cx0 + cs - 2, top + 2);
    ctx.stroke();
    this._cursorBoxes.push({ key, close: { x0: cx0, x1: cx0 + cs, y0: top, y1: top + labelH } });
  }

  // ---------- 主区 ----------

  _drawMain() {
    const pal = this._pal();
    const ctx = this._ctx2d(this.mainCanvas);
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = this._w, h = Math.max(40, this.mainCanvas.height / dpr);
    const { start, end } = this.viewport;
    const span = Math.max(1e-9, end - start);
    const s2x = (s) => (s - start) / span * w;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal.back;
    ctx.fillRect(0, 0, w, h);
    ctx.font = '10px "Segoe UI", sans-serif';

    // 选中高亮带 (View::Blue 半透明)
    if (this.highlight) {
      const x0 = s2x(this.highlight.ss), x1 = s2x(Math.max(this.highlight.es, this.highlight.ss + 1));
      ctx.fillStyle = pal.sel;
      ctx.fillRect(x0, 0, Math.max(2, x1 - x0), h);
    }

    const wd = this.waveData ? this.waveData.channels : [];
    const byIndex = {};
    for (const c of wd) byIndex[c.index] = c;

    // ---------- 通道波形 ----------
    for (const r of this.rows) {
      if (r.type !== 'chan') continue;
      const c = byIndex[r.index];
      const mid = r.y + r.h / 2;
      const sigH = Math.min(LA_SIG_H_MAX, r.h - 2 * LA_SIG_MARGIN);
      const yHi = mid - sigH / 2 + 0.5;
      const yLo = mid + sigH / 2 + 0.5;
      // 点状轴线 (paint_back: 波形高电平高度的点线)
      ctx.strokeStyle = pal.foreDim;
      ctx.setLineDash([1, 3]);
      ctx.beginPath(); ctx.moveTo(0, yHi); ctx.lineTo(w, yHi); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = pal.fore;
      ctx.fillStyle = pal.fore;
      ctx.lineWidth = 1;
      if (!c) continue;
      if (c.mode === 'dense' && c.buckets) {
        const n = c.buckets.length;
        const d0 = this.waveData.start, d1 = this.waveData.end;
        const dw = (d1 - d0) / Math.max(1, n);
        const bwPx = Math.max(1, dw / span * w);
        const i0 = Math.max(0, Math.floor((start - d0) / dw) - 1);
        const i1 = Math.min(n, Math.ceil((end - d0) / dw) + 1);
        for (let i = i0; i < i1; i++) {
          const b = c.buckets[i];
          const x = s2x(d0 + i * dw);
          if (b === 2) ctx.fillRect(x, yHi, bwPx, sigH);
          else if (b === 1) { ctx.beginPath(); ctx.moveTo(x, yHi); ctx.lineTo(x + bwPx, yHi); ctx.stroke(); }
          else { ctx.beginPath(); ctx.moveTo(x, yLo); ctx.lineTo(x + bwPx, yLo); ctx.stroke(); }
        }
      } else if (c.mode === 'edges') {
        let lv = c.init_level;
        let px = 0, py = lv ? yHi : yLo;
        ctx.beginPath(); ctx.moveTo(px, py);
        for (const e of (c.edges || [])) {
          const x = s2x(e);
          ctx.lineTo(x, py);
          lv ^= 1; py = lv ? yHi : yLo;
          ctx.lineTo(x, py);
          px = x;
        }
        ctx.lineTo(w, py);
        ctx.stroke();
      }
    }

    // ---------- 解码注释行 (DSView draw_annotation 移植) ----------
    const samplesPerPx = span / w;
    for (const r of this.rows) {
      if (r.type !== 'ann') continue;
      const ar = this.annRows.find(a => a.id === r.id);
      if (!ar) continue;
      const cy = r.y + r.h / 2;
      const ah = r.h;                        // annotation_height = signalHeight 概念对应行高
      // nodetail 判定 (maxAnnW>100 || (maxAnnW>10 && (minAnnW>1||spp<50)) || (maxAnnW==0 && spp<10))
      let minW = Infinity, maxW = 0;
      for (const an of (ar.rows || [])) {
        const aw = (an.es - an.ss) / samplesPerPx;
        if (aw < minW) minW = aw;
        if (aw > maxW) maxW = aw;
      }
      const show = (maxW > 100) || (maxW > 10 && (minW > 1 || samplesPerPx < 50))
        || (maxW === 0 && samplesPerPx < 10);
      if (!show) { this._drawNodetail(ctx, cy, ah, w); continue; }
      // 行首标题: ▶ + title (paint_back headings)
      ctx.fillStyle = pal.fore;
      ctx.beginPath();
      ctx.moveTo(2, cy - LA_ARROW);
      ctx.lineTo(2 + LA_ARROW, cy);
      ctx.lineTo(2, cy + LA_ARROW);
      ctx.closePath();
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = pal.fore;
      ctx.fillText(String(ar.title || ar.label || ''), 2 + LA_ARROW * 2, cy - 2);

      let lastX = -1;
      const textColor = laDecTextColor(ar.stackIdx);
      for (const an of (ar.rows || [])) {
        if (an.es < start || an.ss > end) continue;
        const ax0 = Math.max(0, s2x(an.ss)), ax1 = Math.min(w, s2x(an.es));
        if (ax1 - lastX <= 0.5 && ax1 - ax0 < 1) continue;
        lastX = ax1;
        const ci = ((an.cls || 0) % 100) % 16;
        const fill = LA_ANN_COLORS[ci], outline = LA_ANN_OUTLINES[ci];
        if (an.es === an.ss) {           // instant → 圆角小药丸, 文本 = texts.back()
          const iw = Math.min(minW === Infinity ? ah : minW, ah);
          const rx = ax0 - iw / 2;
          ctx.fillStyle = fill;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(rx, cy - ah / 2, iw, ah, ah / 2); else ctx.rect(rx, cy - ah / 2, iw, ah);
          ctx.fill();
          const itxt = (an.texts && an.texts.length) ? an.texts[an.texts.length - 1] : '';
          if (itxt && iw > 8) {
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.save(); ctx.beginPath(); ctx.rect(rx, r.y, iw, ah); ctx.clip();
            ctx.fillText(itxt, ax0, cy);
            ctx.restore();
          }
          continue;
        }
        const bw = ax1 - ax0;
        if (bw < 2) {                    // <2px → 描边色竖线
          ctx.strokeStyle = outline;
          ctx.beginPath(); ctx.moveTo(ax0 + 0.5, cy - ah / 2 + 0.5); ctx.lineTo(ax0 + 0.5, cy + ah / 2 - 0.5); ctx.stroke();
          continue;
        }
        // 六边形块 (cap = min(w/4, 5))
        const cap = Math.min(bw / 4, LA_ENDCAP_W);
        const top = cy + 0.5 - ah / 2, bot = cy + 0.5 + ah / 2;
        ctx.fillStyle = fill;
        ctx.strokeStyle = pal.back;
        ctx.beginPath();
        ctx.moveTo(ax0, cy + 0.5);
        ctx.lineTo(ax0 + cap, top);
        ctx.lineTo(ax1 - cap, top);
        ctx.lineTo(ax1, cy + 0.5);
        ctx.lineTo(ax1 - cap, bot);
        ctx.lineTo(ax0 + cap, bot);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        const inner = bw - cap * 2;
        if (inner <= 4) continue;
        // DSView: 最宽能放下的变体; 否则取 texts.back() 并 ElideRight
        let txt = laPickText(an.texts, inner, (t) => this._measure(ctx, t));
        if (!txt) continue;
        if (this._measure(ctx, txt) > inner) {
          while (txt.length > 1 && this._measure(ctx, txt + '…') > inner) txt = txt.slice(0, -1);
          txt = txt.length > 1 ? txt.slice(0, -1) + '…' : txt;
        }
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.save(); ctx.beginPath(); ctx.rect(ax0 + cap, r.y, inner, ah); ctx.clip();
        ctx.fillText(txt, ax0 + bw / 2, cy);
        ctx.restore();
      }
    }

    // ---------- 游标竖线 ----------
    if (this.measureOn) {
      let order = 0;
      for (const key of ['a', 'b']) {
        const s = this.cursors[key];
        if (s == null) continue;
        order++;
        const x = s2x(s);
        if (x < -2 || x > w + 2) continue;
        ctx.strokeStyle = laCursorCss(order);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }
    }

    // ---------- 悬停测量 (Viewport::paintMeasure: 基准帽线 + 蓝色详情框) ----------
    const hm = this._hoverPt && this._hoverMeasure(this._hoverPt.x, this._hoverPt.y);
    if (hm) {
      ctx.strokeStyle = pal.measAct;
      ctx.lineWidth = 1;
      const y = hm.midY;
      ctx.beginPath();
      ctx.moveTo(hm.x0, y); ctx.lineTo(hm.x1, y);
      ctx.moveTo(hm.x0, y); ctx.lineTo(hm.x0 + 2, y - 2);
      ctx.moveTo(hm.x0, y); ctx.lineTo(hm.x0 + 2, y + 2);
      ctx.moveTo(hm.x1 - 2, y - 2); ctx.lineTo(hm.x1, y);
      ctx.moveTo(hm.x1 - 2, y + 2); ctx.lineTo(hm.x1, y);
      if (hm.s2 != null) {
        ctx.moveTo(hm.x1, y); ctx.lineTo(hm.x2, y);
        ctx.moveTo(hm.x1, y); ctx.lineTo(hm.x1 + 2, y - 2);
        ctx.moveTo(hm.x1, y); ctx.lineTo(hm.x1 + 2, y + 2);
        ctx.moveTo(hm.x2 - 2, y - 2); ctx.lineTo(hm.x2, y);
        ctx.moveTo(hm.x2 - 2, y + 2); ctx.lineTo(hm.x2, y);
      }
      ctx.stroke();
      if (this.measureOn) {
        const vals = ['宽度: ' + hm.wText, '周期: ' + hm.pText, '频率: ' + hm.fText, '占空比: ' + hm.dText];
        let tw = 0;
        ctx.font = '10px "Segoe UI", sans-serif';
        for (const v of vals) tw = Math.max(tw, this._measure(ctx, v));
        tw += 100;
        let bx = this._hoverPt.x, by = this._hoverPt.y;
        if (bx + tw > w) bx -= tw;
        if (by + 80 > h) by -= 80;
        ctx.fillStyle = pal.measBox;
        ctx.fillRect(bx, by, tw, 80);
        ctx.fillStyle = pal.measAct;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < vals.length; i++) ctx.fillText(vals[i], bx + tw - 6, by + 10 + i * 20);
        ctx.textAlign = 'left';
      }
    }
  }

  // LogicSignal::measure 移植: 命中通道行 → 前/后/再后三条边沿
  _hoverMeasure(px, py) {
    if (!this.waveData || !this.rate || !this.total) return null;
    const row = this.rows.find(r => r.type === 'chan' && py >= r.y && py <= r.y + r.h);
    if (!row) return null;
    const wd = this.waveData.channels || [];
    const c = wd.find(x => x.index === row.index);
    if (!c || c.mode !== 'edges' || !c.edges || !c.edges.length) return null;
    const span = Math.max(1e-9, this.viewport.end - this.viewport.start);
    const w = this._w || 1;
    const s = this.viewport.start + px / w * span;
    if (s > this.total) return null;
    const edges = c.edges;
    let i = 0, lo = 0, hi = edges.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (edges[m] > s) hi = m; else lo = m + 1; }
    i = lo;                                   // 第一个 > s 的边沿下标
    const i0 = i > 0 ? edges[i - 1] : 0;        // 无前边沿 → 0 (DSView index0=0)
    let i1 = null, i2 = null;
    if (i < edges.length) { i1 = edges[i]; i2 = i + 1 < edges.length ? edges[i + 1] : this.total; }
    else { if (i0 === 0) return null; i1 = this.total; i2 = 0; }
    const s2x = (v) => (v - this.viewport.start) / span * w;
    const has3 = i2 !== 0;
    const wD = Math.max(0, i1 - i0), pD = has3 ? Math.max(0, i2 - i0) : 0;
    return {
      x0: s2x(i0), x1: s2x(i1), x2: s2x(i2 || 0), s2: has3 ? i2 : null,
      midY: row.y + row.h / 2,
      wText: laDsvFmtRealTime(wD, this.rate),
      pText: has3 ? laDsvFmtRealTime(pD, this.rate) : '########',
      fText: has3 ? laDsvFmtRealFreq(pD, this.rate) : '########',
      dText: has3 ? ((i1 - i0) * 100 / (i2 - i0)).toFixed(2) + '%' : '########'
    };
  }

  // DSView draw_nodetail: 行中央 "Zoom in for details" + 斜角括线
  _drawNodetail(ctx, cy, h, w) {
    const info = 'Zoom in for details';
    const tw = this._measure(ctx, info);
    const th = 10;
    ctx.strokeStyle = pal.fore;
    ctx.fillStyle = pal.fore;
    ctx.lineWidth = 1;
    const l = (w - tw) / 2 - 8, rr = (w + tw) / 2 + 8;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(l, cy);
    ctx.moveTo(rr, cy); ctx.lineTo(w, cy);
    ctx.moveTo(l, cy); ctx.lineTo(l + 5, cy - th / 2);
    ctx.moveTo(l, cy); ctx.lineTo(l + 5, cy + th / 2);
    ctx.moveTo(rr, cy); ctx.lineTo(rr - 5, cy - th / 2);
    ctx.moveTo(rr, cy); ctx.lineTo(rr - 5, cy + th / 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info, w / 2, cy);
  }

  _measure(ctx, t) {
    let w = this._textW.get(t);
    if (w === undefined) { w = ctx.measureText(t).width; this._textW.set(t, w); }
    return w;
  }

  _drawMini() {
    const pal = this._pal();
    const ctx = this._ctx2d(this.miniCanvas);
    const w = this._w;
    ctx.clearRect(0, 0, w, LA_MINI_H);
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, w, LA_MINI_H);
    if (this.density && this.density.length) {
      const n = this.density.length;
      const mx = Math.max(1, ...this.density);
      ctx.fillStyle = 'rgba(239,240,241,0.55)';
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = this.density[i] / mx;
        if (v <= 0) continue;
        const bh = Math.max(1, v * (LA_MINI_H - 8));
        ctx.fillRect(i * bw, LA_MINI_H - 4 - bh, Math.max(1, bw), bh);
      }
    }
    if (this.total) {
      const x0 = this.viewport.start / this.total * w;
      const x1 = this.viewport.end / this.total * w;
      ctx.strokeStyle = 'rgba(239,240,241,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, 1.5, Math.max(3, x1 - x0), LA_MINI_H - 3);
      ctx.fillStyle = 'rgba(17,133,209,0.15)';
      ctx.fillRect(x0, 2, Math.max(3, x1 - x0), LA_MINI_H - 4);
    }
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._fetchTimer);
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    if (this._raf) { try { cancelAnimationFrame(this._raf); } catch (_) {} this._raf = 0; }
    if (this._ro) { try { this._ro.disconnect(); } catch (_) {} this._ro = null; }
    for (const [el, ev, fn, opt] of this._listeners) {
      try { el.removeEventListener(ev, fn, opt); } catch (_) {}
    }
    this._listeners = [];
    this.onViewportNeed = null; this.onLayout = null; this.onCursorChange = null;
    if (this.rootEl) { try { this.rootEl.remove(); } catch (_) {} this.rootEl = null; }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogicWaveView, laFmtTime, laFmtRate, laNiceStep, laDsvTicks,
                     laDsvFmtTime, laDsvFmtRealTime, laDsvFmtFreq, laDsvFmtRealFreq,
                     laPickText, laCursorCss, laDecTextColor,
                     LA_ANN_COLORS, LA_ANN_OUTLINES, LA_PROBE_COLORS, LA_DECODE_COLORS };
}
