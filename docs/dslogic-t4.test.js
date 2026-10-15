/* DSLogic T4 smoke: 协议预设 + 解码器配置浮窗 + effDecs 合并 + transactions/summary 参数透传
   Run: node docs/dslogic-t4.test.js
   复用 t3 的最小 DOM stub；fetch 桩额外提供 /api/dslogic/describe 元数据。
*/

const path = require('path');
const PLUGIN = path.dirname(__dirname);

// ---------- DOM stub (同 t3 精简版) ----------
function makeCtx() {
  return {
    canvas: null, setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    rect() {}, roundRect() {}, clip() {}, save() {}, restore() {}, setLineDash() {},
    fillText() {}, drawImage() {}, createLinearGradient() { return { addColorStop() {} }; },
    measureText(t) { return { width: String(t).length * 6 }; },
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '', globalAlpha: 1
  };
}
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], style: {}, className: '', title: '',
    textContent: '', value: '', type: '', accept: '', placeholder: '',
    disabled: false, files: [], scrollTop: 0, selectedIndex: 0,
    _listeners: {}, _rect: null, _clientH: 200, _ctx: null, _html: '', _options: [],
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    get innerHTML() { return this._html || ''; },
    get options() { return this._options.length ? this._options : this.children.filter(c => c.tagName === 'OPTION'); },
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
    get offsetWidth() { return 220; },
    get offsetHeight() { return 160; },
    get clientHeight() { return this._clientH; },
    get clientWidth() { return (this._rect && this._rect.width) || 800; },
    setAttribute() {}, focus() {}, click() { if (this._onClickHtml) this._onClickHtml(); },
    setPointerCapture() {}, releasePointerCapture() {},
    getContext() { if (!this._ctx) { this._ctx = makeCtx(); this._ctx.canvas = this; } return this._ctx; },
    appendChild(c) {
      this.children.push(c); c.parentEl = this;
      if (c.tagName === 'OPTION' && this.tagName === 'SELECT' && this.value === '') this.value = c.value;
      return c;
    },
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
  addEventListener() {}, removeEventListener() {}
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
    { index: 0, name: 'P0', active: true, present: true, edges: 500 },
    { index: 1, name: 'P1', active: true, present: true, edges: 900 },
    { index: 2, name: 'P2', active: true, present: true, edges: 300 },
    { index: 3, name: 'P3', active: false, present: true, edges: 0 }
  ]
};
const DESC_SPI = {
  id: '0:spi', name: '0:SPI', inputs: ['logic'],
  channels: [{ id: 'clk', name: 'CLK' }],
  optional_channels: [{ id: 'miso', name: 'MISO' }, { id: 'mosi', name: 'MOSI' }, { id: 'cs', name: 'CS#' }],
  options: [{ id: 'cs_polarity', desc: 'CS# polarity', default: 'active-low', values: ['active-low', 'active-high'] },
            { id: 'wordsize', desc: 'Word size', default: 8, values: null }]
};
const DESC_I2C = {
  id: '0:i2c', name: '0:I²C', inputs: ['logic'],
  channels: [{ id: 'scl', name: 'SCL' }, { id: 'sda', name: 'SDA' }],
  optional_channels: [],
  options: [{ id: 'address_format', desc: 'Address format', default: 'unshifted', values: ['shifted', 'unshifted'] }]
};
global.fetch = async (url, opt) => {
  fetchLog.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  const u = String(url);
  const wrap = (data) => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) });
  if (u.includes('/api/dslogic/captures')) return wrap([{ name: 'a.dsl', size: 1024, mtime: 1791800000000 }]);
  if (u.includes('/api/dslogic/info')) return wrap(INFO);
  if (u.includes('/api/dslogic/describe')) return wrap(u.includes('spi') ? DESC_SPI : DESC_I2C);
  if (u.includes('/api/dslogic/wave')) return wrap({ start: 0, end: 1600, px: 100, channels: [] });
  if (u.includes('/api/dslogic/decode')) return wrap({ label: 'X', total: 0, all_annotations: 0, rows: [] });
  return { ok: false, status: 404, json: async () => ({ ok: false, error: 'unknown' }) };
};

const PRE = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'presets.js'));
const { LogicToolView } = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'logic-tool-view.js'));

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(detail).slice(0, 400)));
  if (!cond) fails++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  // ===== 预设数据 =====
  check('5 protocol presets', PRE.LA_PRESETS.length === 5 &&
        ['i2c', 'spi', 'uart', 'pd', 'ufcs'].every(k => PRE.LA_PRESETS.some(p => p.key === k)),
        PRE.LA_PRESETS.map(p => p.key));
  check('preset labels <=6 chars', PRE.LA_PRESETS.every(p => p.label.length <= 6), PRE.LA_PRESETS.map(p => p.label));
  check('preset hint+tip', PRE.LA_PRESETS.every(p => p.hint && p.tip));
  check('ufcs stacked on uart', PRE.LA_PRESETS.find(p => p.key === 'ufcs').stacked[0].id === 'ufcs');

  // 引脚建议: 活跃通道按边沿降序填入
  const i2c = PRE.LA_PRESETS.find(p => p.key === 'i2c');
  const sug = PRE.laSuggestPins(i2c, INFO.channels);
  check('suggest busiest first', sug.scl === 1 && sug.sda === 0, sug);

  // spec 构造: 缺必需引脚报错; stacked 保留
  let threw = false;
  try { PRE.laPresetSpec(i2c, { scl: 0 }, {}); } catch (_) { threw = true; }
  check('laPresetSpec missing pin throws', threw);
  const ufcsSpec = PRE.laPresetSpec(PRE.LA_PRESETS.find(p => p.key === 'ufcs'), { rxtx: 2 }, { baudrate: 230400 });
  check('laPresetSpec ufcs', ufcsSpec.id === '1:uart' && ufcsSpec.pins.rxtx === 2 &&
        ufcsSpec.options.baudrate === 230400 && ufcsSpec.stacked[0].id === 'ufcs', ufcsSpec);

  // ===== LogicToolView 集成 =====
  const ltv = new LogicToolView(null, bodyEl.createDiv(), {});
  ltv.mount();
  ltv.container.setRect({ left: 0, top: 0, right: 1280, bottom: 900, width: 1280, height: 900 });
  await sleep(40);
  await ltv.loadFile('a.dsl');
  await sleep(60);

  // effDecs: 内嵌 + 覆盖 + 自定义
  check('effDecs embedded', ltv._effDecs().length === 1 && ltv._effDecs()[0].key === 'e0' &&
        ltv._effDecs()[0].fetch.index === 0, ltv._effDecs());
  ltv._decOverrides[0] = { pins: { sda: 2, scl: 3 }, options: { address_format: 'shifted' }, stacked: [] };
  let eff = ltv._effDecs()[0];
  check('effDecs override->spec fetch', eff.fetch.decoder === '0:i2c' && eff.pins.sda === 2 &&
        !('index' in eff.fetch), eff.fetch);
  ltv._decOverrides = {};

  // 解码浮窗: 列表 + 添加区 5 预设
  ltv.decBtn.onclick();
  const pop = ltv._popoverEl;
  const itemName = (c) => ((c.children || []).find(x => (x.className || '').includes('tw-la-pop-name')) || {}).textContent || c.textContent || '';
  const names = pop.children.map(itemName);
  check('dec pop has presets', names.includes('SPI') && names.includes('UFCS') && names.includes('USB PD'), names);
  check('dec pop hint chip', pop.children.some(c => (c.className || '').includes('tw-la-pop-item') &&
        c.children.some(x => (x.className || '').includes('tw-la-pop-dim') && x.textContent.includes('MHz'))), names);

  // 打开 SPI 配置级联浮窗 (describe 元数据 -> 通道下拉+选项)
  fetchLog.length = 0;
  const spiItem = pop.children.find(c => itemName(c) === 'SPI');
  spiItem.onclick({ stopPropagation() {} });
  await sleep(40);
  const cfg = ltv._popoverEl2;
  check('cfg cascade popover opened', !!cfg && cfg !== pop && pop.parentEl === bodyEl, !!cfg);
  const sels = cfg ? cfg.children.filter(c => (c.children || []).some(x => x.tagName === 'SELECT')).length : 0;
  check('cfg pin+option selects', sels >= 5, sels);   // clk/miso/mosi/cs + cs_polarity
  check('describe fetched', fetchLog.some(c => String(c.url).includes('/describe?id=0%3Aspi') || String(c.url).includes('describe?id=0:spi')),
        fetchLog.map(c => c.url));

  // 应用 SPI 配置 -> customDecs + localStorage + decode 带 spec 参数
  fetchLog.length = 0;
  const applyBtn = cfg.children.find(c => (c.className || '').includes('tw-la-cfg-apply'));
  applyBtn.onclick({ stopPropagation() {} });
  await sleep(60);
  check('custom dec added', ltv.customDecs.length === 1 && ltv.customDecs[0].spec.id === '0:spi',
        ltv.customDecs);
  check('custom dec persisted', (JSON.parse(_ls['tw-la-decs-a.dsl'] || '[]')).length === 1);
  const decCalls = fetchLog.filter(c => String(c.url).includes('/decode')).map(c => c.body);
  check('decode uses spec params', decCalls.some(b => b && b.decoder === '0:spi' && b.pins && b.pins.clk !== undefined),
        decCalls.slice(-3));

  // 自定义解码器删除
  const customKey = ltv._effDecs().find(d => d.custom).key;
  ltv.customDecs.splice(parseInt(customKey.slice(1), 10), 1);
  ltv._saveDecCfg();
  check('custom dec removed+persist cleared', ltv.customDecs.length === 0 &&
        (JSON.parse(_ls['tw-la-decs-a.dsl'] || '[]')).length === 0);

  // 内嵌解码器覆盖持久化
  ltv._decOverrides[0] = { pins: { sda: 3, scl: 2 }, options: {}, stacked: [] };
  ltv._saveDecCfg();
  const ltv2 = new LogicToolView(null, bodyEl.createDiv(), {});
  ltv2._loadDecCfg('a.dsl');
  check('override persisted', ltv2._decOverrides[0] && ltv2._decOverrides[0].pins.sda === 3, ltv2._decOverrides);

  ltv.destroy();
  ltv2.destroy();
  console.log('\n' + fails + ' failure(s)');
  process.exit(fails ? 1 : 0);
})();
