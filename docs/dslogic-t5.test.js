/* DSLogic T5 smoke: MCP stdio (initialize/tools/list + tools/call) + 「分析」按钮
   (选区→summary→drawer.sendPrompt / 剪贴板回退) + 「存卡」(frontmatter+编号追加)。
   Run: node docs/dslogic-t5.test.js
   复用 t4 的最小 DOM stub。
*/

const path = require('path');
const { spawn } = require('child_process');
const PLUGIN = path.dirname(__dirname);
const MCP_JS = path.join(PLUGIN, 'mcp', 'dslogic-mcp.js');

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(detail).slice(0, 400)));
  if (!cond) fails++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- DOM stub (同 t4) ----------
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
    _listeners: {}, _rect: null, _clientH: 200, _ctx: null, _html: '',
    getContext() { if (!this._ctx) { this._ctx = makeCtx(); this._ctx.canvas = this; } return this._ctx; },
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
    appendChild(c) { this.children.push(c); c.parentEl = this; return c; },
    remove() { if (this.parentEl) { const i = this.parentEl.children.indexOf(this); if (i >= 0) this.parentEl.children.splice(i, 1); this.parentEl = null; } },
    get parentElement() { return this.parentEl; },
    get clientWidth() { return (this._rect && this._rect.width) || 800; },
    get offsetWidth() { return 220; },
    focus() {}, click() {}, setPointerCapture() {}, releasePointerCapture() {},
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
    querySelector() { return null; },
    setAttribute() {}, onclick: null, onmouseenter: null
  };
  return el;
}
const bodyEl = makeEl('body');
global.document = { createElement: (t) => makeEl(t), body: bodyEl, addEventListener() {}, removeEventListener() {} };
global.window = { innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1 };
const _ls = {};
global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.Notice = class { constructor(m) { (global._notices = global._notices || []).push(m); } };
let _clip = null;
try {
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async (t) => { _clip = t; } } }, configurable: true });
} catch (_) { global.navigator = { clipboard: { writeText: async (t) => { _clip = t; } } }; }

// ---------- fetch stub ----------
const fetchLog = [];
const INFO = {
  file: 'a.dsl', samplerate: 4e6, total_samples: 1600, duration_s: 0.0004, blocks: 1,
  decoders: [{ index: 0, id: '0:i2c', label: '0:I²C', pins: { sda: 0, scl: 1 }, options: {}, stacked: [] }],
  channels: [
    { index: 0, name: 'SCL', active: true, present: true, edges: 500 },
    { index: 1, name: 'SDA', active: true, present: true, edges: 900 }
  ]
};
const SUMMARY = { summary: '## DSLogic 采集概要\n- 文件：a.dsl\n\n### 通道活跃\n\n### 异常清单（共 0 条）\n\n### 聚合统计\n\n### 事务样本（共 0 条，示前 20）', chars: 120, transactions: 0, anomalies: 0 };
global.fetch = async (url, opt) => {
  fetchLog.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  const u = String(url);
  const wrap = (data, extra) => ({ ok: true, status: 200, json: async () => Object.assign({ ok: true, data }, extra) });
  if (u.includes('/api/dslogic/captures')) return wrap([{ name: 'a.dsl', size: 1024, mtime: 1791800000000 }],
    { storage: { captureDir: 'D:\\vault\\00-Inbox\\02-Raw-Drop\\Data_DSLogic' } });
  if (u.includes('/api/dslogic/info')) return wrap(INFO);
  if (u.includes('/api/dslogic/summary')) return wrap(SUMMARY);
  if (u.includes('/api/dslogic/wave')) return wrap({ start: 0, end: 1600, px: 100, channels: [] });
  if (u.includes('/api/dslogic/decode')) return wrap({ label: 'X', total: 0, all_annotations: 0, rows: [] });
  return { ok: false, status: 404, json: async () => ({ ok: false, error: 'unknown' }) };
};

// ---------- MCP stdio ----------
function mcpSession() {
  const proc = spawn(process.execPath, [MCP_JS], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = [];
  const waiters = [];
  let buf = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!l) continue;
      try { const msg = JSON.parse(l); lines.push(msg); waiters.splice(0).forEach(w => w()); } catch (_) {}
    }
  });
  const send = (msg) => proc.stdin.write(JSON.stringify(msg) + '\n');
  const waitFor = (pred, ms = 15000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('MCP wait timeout')), ms);
    const tick = () => { const m = lines.find(pred); if (m) { clearTimeout(t); res(m); } };
    waiters.push(tick); tick();
  });
  return { proc, send, waitFor, lines };
}

(async () => {
  // ===== 1. MCP stdio 冒烟 =====
  const mcp = mcpSession();
  mcp.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
  mcp.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const init = await mcp.waitFor(m => m.id === 1);
  check('MCP initialize', init.result && init.result.serverInfo && init.result.serverInfo.name === 'tabonkb-dslogic', init);
  const list = await mcp.waitFor(m => m.id === 2);
  const tools = (list.result && list.result.tools) || [];
  const expected = ['dslogic_list_captures', 'dslogic_get_info', 'dslogic_get_annotations',
                    'dslogic_get_transactions', 'dslogic_get_summary'];
  check('MCP 5 tools registered', tools.length === 5 && expected.every(n => tools.some(t => t.name === n)),
        tools.map(t => t.name));
  // F2: transactions 工具分页声明
  const txnTool = tools.find(t => t.name === 'dslogic_get_transactions') || {};
  const txnProps = (txnTool.inputSchema && txnTool.inputSchema.properties) || {};
  check('F2 MCP txn paging', /分页/.test(txnTool.description || '') &&
        txnProps.offset && txnProps.limit, txnTool.description);

  // tools/call -> companion HTTP（离线时应返回 isError 而非崩溃）
  mcp.send({ jsonrpc: '2.0', id: 3, method: 'tools/call',
             params: { name: 'dslogic_get_info', arguments: { file: '240911143422.dsl' } } });
  const call = await mcp.waitFor(m => m.id === 3);
  const hasContent = !!(call.result && Array.isArray(call.result.content) && call.result.content.length);
  check('MCP tools/call returns content', hasContent, call);
  if (hasContent && !call.result.isError) {
    const data = JSON.parse(call.result.content[0].text);
    check('MCP get_info payload', data.samplerate > 0 && Array.isArray(data.channels), data.samplerate);
  } else {
    check('MCP get_info payload (companion offline, graceful isError)', call.result && call.result.isError === true,
          call.result && call.result.content);
  }
  mcp.proc.kill();

  // ===== 2. 「分析」按钮 =====
  const { LogicToolView } = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'logic-tool-view.js'));

  const sent = { text: null, auto: null, opened: false };
  const drawer = {
    isOpen() { return false; },
    open() { sent.opened = true; },
    sendPrompt(t, auto) { sent.text = t; sent.auto = auto; }
  };
  // F4: 消息数组可变——分析时刻快照序号，存卡只取其后完整回复
  const msgs = [
    { role: 'user', text: '分析这个' },
    { role: 'assistant', text: 'AI 结论：I²C 通讯正常' }
  ];
  let _streaming = false;
  const wv = {
    agentDrawer: drawer,
    hub: { activeAgentId: 'agy',
           isStreaming: () => _streaming,
           sessionManager: { getMessages: () => msgs } }
  };
  const ltv = new LogicToolView(null, bodyEl.createDiv(), { workbenchView: wv });
  ltv.mount();
  await sleep(30);
  check('analyze disabled before load', ltv.analyzeBtn.disabled === true);
  await ltv.loadFile('a.dsl');
  await sleep(50);
  check('analyze enabled after load', ltv.analyzeBtn.disabled === false);

  // 光标选区 -> summary 带 sel 字段
  fetchLog.length = 0;
  ltv.waveView.cursors = { a: 100, b: 500 };
  await ltv._onAnalyze();
  await sleep(10);
  const sumCall = fetchLog.find(c => String(c.url).includes('/summary'));
  check('summary called with sel', sumCall && Math.abs(sumCall.body.sel_start_s - 0.000025) < 1e-9 &&
        Math.abs(sumCall.body.sel_end_s - 0.000125) < 1e-9 && sumCall.body.all === true, sumCall && sumCall.body);
  check('drawer.sendPrompt got summary+prompt', sent.text && sent.text.includes('## DSLogic 采集概要') &&
        sent.text.includes('协议分析专家'), sent.text && sent.text.slice(0, 80));
  check('sendPrompt non-autosend + drawer opened', sent.auto === false && sent.opened === true);
  check('saveBtn enabled after analyze', ltv.saveBtn.disabled === false);
  // F5: 提示词含寄存器来源要求
  check('F5 prompt requires source citation', sent.text.includes('寄存器含义必须引用') &&
        sent.text.includes('「未知」'), sent.text.slice(-200));
  // F4: 分析时记录消息序号
  check('F4 analysis mark recorded', ltv._analysisMark && ltv._analysisMark.count === 2 &&
        ltv._analysisMark.aid === 'agy', ltv._analysisMark);

  // ===== 3. 剪贴板回退（无 drawer） =====
  _clip = null;
  const ltv2 = new LogicToolView(null, bodyEl.createDiv(), {});
  ltv2.mount();
  await sleep(30);
  ltv2.fileName = 'a.dsl'; ltv2.info = INFO;
  await ltv2._onAnalyze();
  check('clipboard fallback', _clip && _clip.includes('## DSLogic 采集概要'), _clip && _clip.slice(0, 60));
  check('clipboard status shown', ltv2.statusEl.textContent.includes('已复制'), ltv2.statusEl.textContent);

  // ===== 4. 「存卡」 =====
  const written = {};
  const fakeApp = { vault: { adapter: {
    basePath: 'D:\\vault',
    exists: async (p) => p in written,
    read: async (p) => written[p],
    write: async (p, c) => { written[p] = c; },
    mkdir: async () => {}
  } } };
  ltv.app = fakeApp;
  const cardPath = '00-Inbox/02-Raw-Drop/Data_DSLogic/a.md';

  // F4: 流式中 -> 显式「等待回复」，不落盘
  _streaming = true;
  await ltv._onSaveCard();
  check('F4 streaming -> 等待回复', ltv.statusEl.textContent.includes('等待回复') &&
        !(cardPath in written), ltv.statusEl.textContent);
  // F4: 无标记后回复 -> 显式「等待回复」
  _streaming = false;
  await ltv._onSaveCard();
  check('F4 no reply -> 等待回复', ltv.statusEl.textContent.includes('等待回复') &&
        !(cardPath in written), ltv.statusEl.textContent);
  // F4: 标记后新增完整回复 -> 只存标记后的回复
  msgs.push({ role: 'assistant', text: 'AI 结论：R65 PD 异常定位' });
  await ltv._onSaveCard();
  const md = written[cardPath];
  check('card written to Data_DSLogic/<name>.md', !!md, Object.keys(written));
  // F3: frontmatter 合规字段
  check('F3 frontmatter required', !!md && ['title:', 'date:', 'doctype: DBG',
        'platform: [COMMON]', 'module: GEN', 'source: internal', 'status: draft', 'tags:']
        .every(k => md.includes(k)), md && md.slice(0, 400));
  check('F3 date from trigger/file', !!md && /^date: \d{4}-\d{2}-\d{2}$/m.test(md),
        md && md.split('\n').find(l => l.startsWith('date:')));
  check('card ext fields kept', !!md && md.includes('type: dslogic-analysis') && md.includes('file: a.dsl'));
  check('F4 card has post-mark reply only', !!md && md.includes('AI 结论：R65 PD 异常定位') &&
        !md.includes('AI 结论：I²C 通讯正常'), md && md.slice(-200));
  check('card has 编号', !!md && md.includes('## 分析 1'));
  // 第二次存卡追加编号，不覆盖
  await ltv._onSaveCard();
  check('card appends 分析 2', written[cardPath].includes('## 分析 2') && written[cardPath].includes('## 分析 1'));

  // 未分析先存卡 -> 错误可见
  const ltv3 = new LogicToolView(null, bodyEl.createDiv(), {});
  ltv3.mount();
  ltv3.fileName = 'a.dsl'; ltv3.info = INFO;
  await ltv3._onSaveCard();
  check('saveCard before analyze -> err', ltv3.statusEl.textContent.includes('请先分析'), ltv3.statusEl.textContent);

  // ===== 5. F6 预设提示 =====
  const PRE = require(path.join(PLUGIN, 'components', 'tools', 'logic', 'presets.js'));
  const pi2c = PRE.LA_PRESETS.find(p => p.key === 'i2c');
  check('F6 i2c >=10MHz', pi2c.hint === '≥10MHz' && pi2c.tip.includes('≥10MHz'), pi2c.tip);
  const ppd = PRE.LA_PRESETS.find(p => p.key === 'pd');
  check('F6 pd swing+threshold', ppd.tip.includes('1.1V') && /0\.55.*0\.6/.test(ppd.tip), ppd.tip);
  const puf = PRE.LA_PRESETS.find(p => p.key === 'ufcs');
  check('F6 ufcs 8N1+baud ladder+training', puf.tip.includes('8N1') && puf.tip.includes('115200') &&
        puf.tip.includes('57600') && puf.tip.includes('0xAA'), puf.tip);

  ltv.destroy(); ltv2.destroy(); ltv3.destroy();
  console.log('\n' + fails + ' failure(s)');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
