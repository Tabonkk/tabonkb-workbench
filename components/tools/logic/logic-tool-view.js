/* ==========================================================================
   LogicToolView — TabonKB 逻辑分析工具主视图 (T3)
   契约: new LogicToolView(app, frameWrapEl, { plugin, workbenchView, navTabsContainer })
         mount() 挂载 / destroy() 释放全部监听/定时器/子视图
   布局: [文件▾ name.dsl] [4MHz · 40.7s] [解码▾] [测量] [搜索] [分析]
         通道名栏 | 波形区 (Canvas, 标尺+波形+解码行+缩略图)
         报文表 (虚拟滚动, 可折叠)
   数据: 全部经 companion HTTP /api/dslogic/* (fetch); 波形/解码行按视窗取数。
   ========================================================================== */

let laIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!laIconPark) {
  try {
    laIconPark = require('../../../ui/iconpark.js').getIconPark;
  } catch (_) {
    laIconPark = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

let LaWaveViewCls = typeof LogicWaveView !== 'undefined' ? LogicWaveView : null;
if (!LaWaveViewCls) {
  try { LaWaveViewCls = require('./wave-view.js').LogicWaveView; } catch (_) {}
}
let LaProtoTableCls = typeof LogicProtoTable !== 'undefined' ? LogicProtoTable : null;
if (!LaProtoTableCls) {
  try { LaProtoTableCls = require('./proto-table.js').LogicProtoTable; } catch (_) {}
}
let laFmtTimeFn = typeof laFmtTime === 'function' ? laFmtTime : null;
if (!laFmtTimeFn) {
  try { laFmtTimeFn = require('./wave-view.js').laFmtTime; } catch (_) {}
}
let LaPresets = null;
try { LaPresets = require('./presets.js'); } catch (_) {}
if (!LaPresets && typeof LA_PRESETS !== 'undefined') LaPresets = { LA_PRESETS, laSuggestPins, laPresetSpec };
let LaWaveConst = null;
try { LaWaveConst = require('./wave-view.js'); } catch (_) {}
const LA_PROBE_COLORS_ARR = (LaWaveConst && LaWaveConst.LA_PROBE_COLORS)
  || (typeof LA_PROBE_COLORS !== 'undefined' ? LA_PROBE_COLORS : null)
  || ['#505050', '#8f5202', '#cc0000', '#f57900', '#edd400', '#73d216', '#3465a4', '#75507b'];
const LA_DECODE_COLORS_ARR = (LaWaveConst && LaWaveConst.LA_DECODE_COLORS)
  || (typeof LA_DECODE_COLORS !== 'undefined' ? LA_DECODE_COLORS : null)
  || ['#ef2929', '#fce94f', '#8ae234', '#729fcf'];
const LA_ANN_COLORS_ARR = (LaWaveConst && LaWaveConst.LA_ANN_COLORS)
  || (typeof LA_ANN_COLORS !== 'undefined' ? LA_ANN_COLORS : null)
  || ['#ef2929', '#f66a32', '#fcae3e', '#fbca47', '#fce94f', '#cdf040', '#8ae234', '#4edc44',
      '#55d795', '#64d1d2', '#729fcf', '#d476c4', '#9d79b9', '#ad7fa8', '#c2629b', '#d7476f'];
let LaNoticeCls = typeof Notice !== 'undefined' ? Notice : null;
if (!LaNoticeCls) {
  try { LaNoticeCls = require('obsidian').Notice; } catch (_) {
    LaNoticeCls = class { constructor(m) { if (typeof console !== 'undefined') console.log('[Notice]', m); } };
  }
}

const LA_LAST_FILE_KEY = 'tabonkb-logic-lastfile';
const LA_API = 'http://127.0.0.1:28123';
const LA_TABLE_CHUNK = 2000;
const LA_TABLE_MAX = 20000;

class LogicToolView {
  constructor(app, container, options = {}) {
    this.app = app || (typeof window !== 'undefined' ? window.app : null);
    this.container = container;
    this.plugin = options.plugin || null;
    this.workbenchView = options.workbenchView || null;
    this.navTabsContainer = options.navTabsContainer || null;
    this.baseUrl = options.companionBaseUrl || LA_API;

    this.rootEl = null;
    this.waveView = null;
    this.table = null;

    this.fileName = null;
    this.info = null;
    this.captures = null;          // [{name,size,mtime}]
    this.showAllCh = false;
    this.measureOn = true;
    this.decVisible = null;        // Set(decoder key); null=全部可见
    this.decoders = [];            // 文件内嵌解码器 (info.decoders)
    this.customDecs = [];          // T4: 用户工作台侧添加的解码器 spec（localStorage 持久化，不回写 .dsl）
    this._decOverrides = {};       // T4: 内嵌解码器的引脚/选项覆盖 index -> {pins,options,stacked}
    this._annRowOrder = new Map(); // 'decKey|row' -> 子行排序 (跨视窗稳定)
    this._seq = 0;                 // staleness token
    this._waveTok = 0;             // R7: 波形请求递增令牌, 丢弃过期响应
    this._decTok = 0;
    this._ac = null;               // AbortController

    this._popoverEl = null;
    this._popoverEl2 = null;
    this._destroyed = false;
    this._timers = [];
    this._listeners = [];

    this._docPointerDown = (e) => {
      if (!this._popoverEl) return;
      if (this._popoverEl.contains(e.target)) return;
      if (this._popoverEl2 && this._popoverEl2.contains(e.target)) return;
      if (this._popoverAnchor && this._popoverAnchor.contains(e.target)) return;
      this._closePopover();
    };
    this._docKeyDown = (e) => {
      if (e.key === 'Escape' && (this._popoverEl || this._popoverEl2)) this._closePopover();
    };
  }

  // ---------- 基础 ----------

  mount() {
    if (this.navTabsContainer) this.navTabsContainer.innerHTML = '';
    this._ac = typeof AbortController !== 'undefined' ? new AbortController() : null;

    this.rootEl = this.container.createDiv({ cls: 'tw-la-root' });
    this._renderBar();

    this.mainEl = this.rootEl.createDiv({ cls: 'tw-la-main' });
    // ---- 左栏: DSView header 复刻 (会话标签行 + 解码器组块 + 通道行) ----
    this.chanColEl = this.mainEl.createDiv({ cls: 'tw-la-chan-col' });
    this.chanHeadEl = this.chanColEl.createDiv({ cls: 'tw-la-chan-head' });
    const sessLabel = this.chanHeadEl.createDiv({ cls: 'tw-la-sess' });
    sessLabel.appendChild(this._el('span', 'tw-la-sess-name', '逻辑分析仪'));
    this.sessCloseEl = sessLabel.createEl('button', { cls: 'tw-la-sess-x', title: '卸载当前文件' });
    this.sessCloseEl.textContent = '✕';
    this.sessCloseEl.onclick = () => this._unloadFile();
    this.chanToggleEl = this.chanHeadEl.createEl('button', { cls: 'tw-la-chan-toggle', title: '显示空通道' });
    this.chanToggleEl.textContent = '全部';
    this.chanToggleEl.onclick = () => this._toggleAllCh();
    this.chanRowsEl = this.chanColEl.createDiv({ cls: 'tw-la-chan-rows' });
    this.chanColEl.createDiv({ cls: 'tw-la-chan-foot' });

    this.waveWrapEl = this.mainEl.createDiv({ cls: 'tw-la-wave-wrap' });
    this.emptyEl = this.waveWrapEl.createDiv({ cls: 'tw-la-empty' });
    this.emptyEl.innerHTML = `<span class="tw-la-empty-icon">${laIconPark('cpu', 20)}</span><span class="tw-la-empty-text">未选文件</span>`;

    // ---- 右栏停靠: 解码器管理 + 解码结果(矩阵表) + 测量 ----
    this.dockEl = this.mainEl.createDiv({ cls: 'tw-la-dock' });
    // 解码器管理段: [+][✕][搜索框][🔍] (protocoldock)
    const decSec = this.dockEl.createDiv({ cls: 'tw-la-decsec' });
    const decBar = decSec.createDiv({ cls: 'tw-la-decbar' });
    this.decAddBtn = decBar.createEl('button', { cls: 'tw-la-ibtn tw-la-ibtn-txt', title: '添加/配置解码器' });
    this.decAddBtn.textContent = '+';
    this.decDelBtn = decBar.createEl('button', { cls: 'tw-la-ibtn tw-la-ibtn-txt', title: '隐藏全部解码器' });
    this.decDelBtn.textContent = '✕';
    const decSearchWrap = decBar.createDiv({ cls: 'tw-la-decsearch' });
    decSearchWrap.appendChild(this._el('span', 'tw-la-decsearch-ph', '解码器搜索'));
    this.decSearchBtn = this._iconBtn2(decBar, 'search', '解码器');
    this.decAddBtn.onclick = () => this._togglePopover(this.decAddBtn, (pop) => this._buildDecPop(pop));
    this.decSearchBtn.onclick = this.decAddBtn.onclick;
    decSearchWrap.onclick = this.decAddBtn.onclick;
    this.decDelBtn.onclick = () => this._hideAllDec();
    this.decListEl = decSec.createDiv({ cls: 'tw-la-decl' });

    // 解码结果: 矩阵表 (proto-table 自带 标题/搜索/匹配项/表体)
    this.tableWrapEl = this.dockEl.createDiv({ cls: 'tw-la-table-wrap' });

    // 测量段 (波形测量: 光标读数)
    const msSec = this.dockEl.createDiv({ cls: 'tw-la-meassec' });
    const msHead = msSec.createDiv({ cls: 'tw-la-meas-head' });
    msHead.appendChild(this._el('span', 'tw-la-meas-title', '波形测量'));
    this.measureBodyEl = msSec.createDiv({ cls: 'tw-la-meas-body' });
    this._renderMeasure(null);

    // 子视图
    if (LaWaveViewCls) {
      this.waveView = new LaWaveViewCls(this.waveWrapEl, {
        onViewportNeed: (s, e, px) => this._onViewportNeed(s, e, px),
        onLayout: (rows, desiredH) => this._renderChanRows(rows, desiredH),
        onCursorChange: (c) => this._renderMeasure(c)
      });
      this.waveView.mount();
    }
    if (LaProtoTableCls) {
      this.table = new LaProtoTableCls(this.tableWrapEl, {
        onJump: (row) => this._onRowJump(row),
        onQuery: (q) => this._refreshTable(q),
        onExport: () => this._exportCsv(),
        onColSettings: () => this._togglePopover(this.table && this.table.setBtn, (pop) => this._buildDecPop(pop))
      });
      this.table.mount();
      this.table.setStatus('', '');
    }
    this._allRows = [];

    // 隐藏文件选择器 (导入)
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = '.dsl';
    this._fileInput.style.display = 'none';
    this.rootEl.appendChild(this._fileInput);
    this._on(this._fileInput, 'change', () => this._onImportPicked());

    document.addEventListener('pointerdown', this._docPointerDown, true);
    document.addEventListener('keydown', this._docKeyDown);

    try {
      if (typeof TabonKBThemeEngine !== 'undefined') {
        const p = this.plugin || (this.app?.plugins?.plugins?.['tabonkb-workbench']);
        TabonKBThemeEngine.applyGlobalTheme(p, null);
      }
    } catch (_) {}
    this._init();
  }

  _renderBar() {
    this.barEl = this.rootEl.createDiv({ cls: 'tw-la-bar' });

    this.fileBtn = this.barEl.createEl('button', { cls: 'tw-la-btn tw-la-file-btn', title: '选择采集文件' });
    this._syncFileBtn();
    this.fileBtn.onclick = () => this._togglePopover(this.fileBtn, (pop) => this._buildFilePop(pop));

    this.metaEl = this.barEl.createDiv({ cls: 'tw-la-meta' });
    this.metaEl.style.display = 'none';

    this.decBtn = this.barEl.createEl('button', { cls: 'tw-la-btn', title: '解码器' });
    this.decBtn.innerHTML = `${laIconPark('options', 12)}<span>解码</span>${laIconPark('down', 10)}`;
    this.decBtn.style.display = 'none';
    this.decBtn.onclick = () => this._togglePopover(this.decBtn, (pop) => this._buildDecPop(pop));

    this.measureBtn = this.barEl.createEl('button', { cls: 'tw-la-btn on', title: '光标测量: 左键放 A / 右键放 B' });
    this.measureBtn.innerHTML = `${laIconPark('target', 12)}<span>测量</span>`;
    this.measureBtn.onclick = () => this._toggleMeasure();

    this.searchBtn = this.barEl.createEl('button', { cls: 'tw-la-btn', title: '报文搜索' });
    this.searchBtn.innerHTML = `${laIconPark('search', 12)}<span>搜索</span>`;
    this.searchBtn.onclick = () => this._toggleSearch();

    this.analyzeBtn = this.barEl.createEl('button', { cls: 'tw-la-btn', title: 'AI 分析：生成上下文包并送入 Agent Hub' });
    this.analyzeBtn.innerHTML = `${laIconPark('sparkles', 12)}<span>分析</span>`;
    this.analyzeBtn.disabled = true;
    this.analyzeBtn.onclick = () => this._onAnalyze();

    this.saveBtn = this.barEl.createEl('button', { cls: 'tw-la-btn', title: '存卡：概要+最近 AI 回复写入 Data_DSLogic/*.md' });
    this.saveBtn.innerHTML = `${laIconPark('file-text', 12)}<span>存卡</span>`;
    this.saveBtn.disabled = true;
    this.saveBtn.onclick = () => this._onSaveCard();

    const followInit = !(this.plugin && this.plugin.settings && this.plugin.settings.dsviewFollowTheme === false);
    this.themeBtn = this.barEl.createEl('button', {
      cls: `tw-la-btn ${followInit ? 'on' : ''}`,
      title: '切换 DSView 色板策略：开启时跟随当前深色/VS Code 主题色板，关闭时锁定 DSView 原生暗黑 (#1f1f1f)'
    });
    this.themeBtn.innerHTML = `${laIconPark('palette', 12)}<span>${followInit ? '主题色板' : '原生暗黑'}</span>`;
    this.themeBtn.onclick = async () => {
      const p = this.plugin || (this.app?.plugins?.plugins?.['tabonkb-workbench']);
      const cur = !(p && p.settings && p.settings.dsviewFollowTheme === false);
      const next = !cur;
      if (p && p.settings) {
        p.settings.dsviewFollowTheme = next;
        if (typeof p.saveSettings === 'function') await p.saveSettings();
      }
      this.themeBtn.classList.toggle('on', next);
      this.themeBtn.innerHTML = `${laIconPark('palette', 12)}<span>${next ? '主题色板' : '原生暗黑'}</span>`;
      if (typeof TabonKBThemeEngine !== 'undefined') {
        TabonKBThemeEngine.applyGlobalTheme(p, null);
      }
      if (this.waveView) this.waveView.requestRedraw();
    };

    this.statusEl = this.barEl.createDiv({ cls: 'tw-la-status' });
  }

  // ---------- T5: AI 分析 / 存卡 ----------

  // 选区 = 光标 A-B；无光标对时退化为当前视窗
  _selRangeS() {
    const rate = (this.info && this.info.samplerate) || 0;
    if (!rate || !this.waveView) return null;
    const c = this.waveView.cursors || {};
    if (c.a != null && c.b != null) return { s0: c.a / rate, s1: c.b / rate };
    const v = this.waveView.viewport;
    if (v && v.end > v.start) return { s0: v.start / rate, s1: v.end / rate };
    return null;
  }

  async _onAnalyze() {
    if (!this.info || this._destroyed) return;
    this._setStatus('分析中', '', 'loading');
    try {
      const sel = this._selRangeS();
      const body = { file: this.fileName, all: true };
      if (sel) { body.sel_start_s = sel.s0; body.sel_end_s = sel.s1; }
      const data = await this._fetch('/api/dslogic/summary', body);
      if (this._destroyed) return;
      this._lastSummary = data;
      const prompt = data.summary +
        '\n\n请以协议分析专家身份：1) 解读时序与各协议事务的业务含义；' +
        '2) 对异常清单逐类给出可能根因；3) 给出下一步观测/复验建议（采样率/阈值/协议字段）；' +
        '4) 寄存器含义必须引用知识库或数据手册来源，没有来源的标注「未知」。' +
        '分析完成后我将用「存卡」把结果归档。';
      const drawer = (this.workbenchView && this.workbenchView.agentDrawer)
        || (this.plugin && this.plugin.agentDrawer)
        || (this.plugin && this.plugin.activeWorkbenchView && this.plugin.activeWorkbenchView.agentDrawer);
      // F4: 记录发送时刻的会话消息序号；「存卡」只取其后完整回复
      this._analysisMark = null;
      if (drawer && typeof drawer.sendPrompt === 'function') {
        try {
          const hub = this._hub();
          const sm = hub && hub.sessionManager;
          const aid = hub && hub.activeAgentId;
          if (sm && aid && typeof sm.getMessages === 'function')
            this._analysisMark = { aid, count: (sm.getMessages(aid) || []).length };
        } catch (_) {}
      }
      if (drawer && typeof drawer.sendPrompt === 'function') {
        if (typeof drawer.isOpen === 'function' && !drawer.isOpen()) drawer.open();
        drawer.sendPrompt(prompt, false);
        this._setStatus('已送 Agent', '', 'ok');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(prompt);
        this._setStatus('已复制概要', 'Agent Hub 不可用，概要已入剪贴板', 'ok');
      } else {
        this._setStatus('发送失败', 'Agent Hub 与剪贴板均不可用', 'err');
        return;
      }
      this.saveBtn.disabled = false;
    } catch (e) {
      if (this._destroyed) return;
      this._setStatus('分析失败', e.message, 'err');
    }
  }

  _hub() {
    return (this.workbenchView && this.workbenchView.hub)
      || (this.plugin && this.plugin.agentHub)
      || (this.plugin && this.plugin.hub)
      || (this.workbenchView && this.workbenchView.agentDrawer && this.workbenchView.agentDrawer.hub)
      || null;
  }

  // F4: 只取「分析」发送时消息序号之后的完整 assistant 回复；
  // 返回 {reply} | {wait:'streaming'} | {wait:'none'} | {noSession:true}
  _analysisReply() {
    const mark = this._analysisMark;
    if (!mark) return { noSession: true };
    try {
      const hub = this._hub();
      const sm = hub && hub.sessionManager;
      if (!sm || typeof sm.getMessages !== 'function') return { noSession: true };
      if (hub && typeof hub.isStreaming === 'function' && hub.isStreaming())
        return { wait: 'streaming' };
      const msgs = sm.getMessages(mark.aid) || [];
      const after = msgs.slice(mark.count).filter(m => m && m.role === 'assistant' &&
        typeof (m.content || m.text) === 'string' && (m.content || m.text).trim());
      if (!after.length) return { wait: 'none' };
      const last = after[after.length - 1];
      return { reply: last.content || last.text };
    } catch (_) { return { noSession: true }; }
  }

  async _onSaveCard() {
    if (!this.info || !this._lastSummary) {
      this._setStatus('请先分析', '「存卡」需先点「分析」生成概要', 'err');
      return;
    }
    try {
      // F4: drawer 路径下必须已有完整回复；流式中/无回复显式提示
      const rep = this._analysisReply();
      if (rep.wait) {
        this._setStatus('等待回复', rep.wait === 'streaming'
          ? 'AI 仍在输出，完成后再存卡' : '尚无本次分析后的 AI 回复', 'err');
        return;
      }
      const reply = rep.reply || null;
      const md = this._buildCardMd(this._lastSummary, reply);
      // 与 .dsl 同目录: 优先用服务端 storage.captureDir 换算成 vault 相对路径
      let rel = '00-Inbox/02-Raw-Drop/Data_DSLogic';
      const vaultBase = (this.app && this.app.vault && this.app.vault.adapter && this.app.vault.adapter.basePath) || '';
      const capDir = (this._storageInfo && this._storageInfo.captureDir) || '';
      if (capDir && vaultBase) {
        const nb = vaultBase.replace(/\\/g, '/').replace(/\/+$/, '');
        const nc = capDir.replace(/\\/g, '/');
        if (nc.toLowerCase().startsWith(nb.toLowerCase() + '/')) rel = nc.slice(nb.length + 1);
      }
      const base = this.fileName.replace(/\.dsl$/i, '');
      const path = rel + '/' + base + '.md';
      const adapter = this.app && this.app.vault && this.app.vault.adapter;
      if (!adapter) {
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = base + '.md';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        this._setStatus('已导出卡片', '', 'ok');
        return;
      }
      let prev = '';
      if (await adapter.exists(path)) prev = await adapter.read(path);
      const finalMd = prev ? this._appendCardMd(prev, this._lastSummary, reply) : md;
      const dir = path.split('/').slice(0, -1).join('/');
      if (dir && !(await adapter.exists(dir))) await adapter.mkdir(dir);
      await adapter.write(path, finalMd);
      this._setStatus('已存卡', path, 'ok');
      if (LaNoticeCls) new LaNoticeCls('✓ 分析卡已写入 ' + path.split('/').pop(), 2200);
    } catch (e) {
      this._setStatus('存卡失败', e.message, 'err');
    }
  }

  // F3: 采集日期 = header trigger_time_ms 换算；无则用文件名 yymmddhhmmss 推断
  _captureDate() {
    const ms = this.info && this.info.trigger_time_ms;
    if (ms) {
      const d = new Date(ms);
      if (!isNaN(d)) {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      }
    }
    const m = /^(\d{2})(\d{2})(\d{2})\d{6}/.exec(this.fileName || '');
    if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // F3: 模块推断——充电协议（PD/UFCS）归 CHG，否则 GEN
  _cardModule() {
    const ids = this._effDecs().map(d => String(d.id || '').toLowerCase());
    if (ids.some(i => /usb_pd|ufcs/.test(i))) return 'CHG';
    return 'GEN';
  }

  _cardFrontmatter() {
    const info = this.info || {};
    const decs = this._effDecs().map(d => d.label || d.id).join(', ');
    const base = (this.fileName || '').replace(/\.dsl$/i, '');
    const mod = this._cardModule();
    return ['---',
      'title: DSLogic 分析 ' + base,
      'date: ' + this._captureDate(),
      'doctype: DBG',
      'platform: [COMMON]',
      'module: ' + mod,
      'source: internal',
      'status: draft',
      'tags: ["#platform/common", "#module/' + mod.toLowerCase() + '", "#doctype/dbg", "#status/draft"]',
      'type: dslogic-analysis',
      'file: ' + this.fileName,
      'samplerate: ' + (info.samplerate || ''),
      'duration_s: ' + (info.duration_s || ''),
      'decoders: ' + (decs || '-'),
      'saved_at: ' + new Date().toISOString(),
      '---', '', '# ' + this.fileName + ' 分析卡', ''].join('\n');
  }

  _buildCardMd(sum, reply) {
    return this._cardFrontmatter() + this._cardSection(sum, reply, 1);
  }

  _appendCardMd(prev, sum, reply) {
    const n = (prev.match(/## 分析 /g) || []).length + 1;
    return prev.replace(/\s*$/, '\n\n') + this._cardSection(sum, reply, n);
  }

  _cardSection(sum, reply, n) {
    let s = '## 分析 ' + n + '\n\n' + (sum.summary || '') + '\n';
    if (reply) s += '\n### AI 回复\n\n' + reply.trim() + '\n';
    else s += '\n### AI 回复\n\n（未关联：剪贴板路径或会话不可用）\n';
    return s;
  }

  // R1: .dsl/解码结果来源的字符串一律 textContent, 禁拼 innerHTML
  _el(tag, cls, text, title) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    if (title) e.title = title;
    return e;
  }
  _icon(name, size, cls) {
    const s = document.createElement('span');
    s.className = cls || 'tw-la-ic';
    s.innerHTML = laIconPark(name, size);   // 静态图标字面量, 无外部数据
    return s;
  }

  _iconBtn2(parent, icon, title) {
    const b = document.createElement('button');
    b.className = 'tw-la-ibtn';
    b.title = title || '';
    b.appendChild(this._icon(icon, 12));
    parent.appendChild(b);
    return b;
  }

  _hideAllDec() {
    if (!this._effDecs().length) return;
    this.decVisible = new Set();
    if (this.waveView) this._reqDecodeRows(this.waveView.viewport.start, this.waveView.viewport.end);
    this._renderDecList();
  }

  _unloadFile() {
    this.fileName = null; this.info = null; this.decoders = [];
    this.customDecs = []; this._decOverrides = {};
    this._seq++;
    try { localStorage.removeItem(LA_LAST_FILE_KEY); } catch (_) {}
    this._syncFileBtn();
    if (this.metaEl) this.metaEl.style.display = 'none';
    if (this.decBtn) this.decBtn.style.display = 'none';
    if (this.emptyEl) this.emptyEl.style.display = '';
    if (this.waveView) {
      this.waveView.rate = 0; this.waveView.total = 0;
      this.waveView.chanRows = []; this.waveView.annRows = [];
      this.waveView.waveData = null; this.waveView.density = null;
      this.waveView.cursors = { a: null, b: null };
      this.waveView._layout(); this.waveView.requestRedraw();
    }
    if (this.table) { this.table.setColumns([]); this.table.setMatch(null); }
    this._renderDecList();
    this._renderMeasure(null);
    this._lastSummary = null;
    if (this.analyzeBtn) this.analyzeBtn.disabled = true;
    if (this.saveBtn) this.saveBtn.disabled = true;
    this._setStatus('', '');
  }

  _renderMeasure(c) {
    if (!this.measureBodyEl) return;
    this.measureBodyEl.innerHTML = '';
    const mk = (k, v) => {
      const d = document.createElement('div');
      d.className = 'tw-la-meas-line';
      const a = document.createElement('span'); a.className = 'tw-la-meas-k'; a.textContent = k;
      const b = document.createElement('span'); b.className = 'tw-la-meas-v'; b.textContent = v;
      d.appendChild(a); d.appendChild(b);
      this.measureBodyEl.appendChild(d);
    };
    const fmt = (s) => {
      if (s == null) return '--';
      const rate = (c && c.rate) || (this.info && this.info.samplerate) || 0;
      return rate ? (s / rate).toFixed(Math.max(3, Math.ceil(Math.log10(rate)))) + ' s' : String(s);
    };
    const a = c && c.a, b = c && c.b;
    mk('A', fmt(a));
    mk('B', fmt(b));
    if (a != null && b != null && this.info && this.info.samplerate) {
      const dt = Math.abs(b - a) / this.info.samplerate;
      mk('Δt', dt.toExponential ? this._fmtTime(dt) : String(dt));
      if (dt > 0) mk('f', this._fmtRate(1 / dt));
    }
  }

  async _exportCsv() {
    if (!this.table || !this.table.cols || !this.table.cols.length) return;
    const cols = this.table.cols;
    const esc = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const head = ['#'].concat(cols.map(c => c.title));
    const lines = [head.map(esc).join(',')];
    for (let i = 0; i < this.table.nRows; i++) {
      const cells = [String(i)];
      for (const c of cols) cells.push(c.rows[i] ? (c.rows[i].texts || []) [0] || '' : '');
      lines.push(cells.map(esc).join(','));
    }
    try {
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (this.fileName || 'decode').replace(/\.dsl$/i, '') + '-decode.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this._setStatus('已导出', a.download);
    } catch (e) {
      this._setStatus('导出失败', e.message, 'err');
    }
  }

  // 解码器管理列表 (右栏顶部)
  _renderDecList() {
    if (!this.decListEl) return;
    this.decListEl.innerHTML = '';
    const effs = this._effDecs();
    if (!effs.length) return;
    for (const d of effs) {
      const on = this.decVisible === null || this.decVisible.has(d.key);
      const it = document.createElement('div');
      it.className = 'tw-la-dec-item' + (on ? '' : ' off');
      const cfg = this._iconBtn2(it, 'setting-config', '配置');
      cfg.onclick = (e) => { e.stopPropagation(); this._openDecCfg(cfg, d); };
      const del = this._iconBtn2(it, 'close', d.custom ? '删除该解码器' : '隐藏该解码器');
      del.onclick = (e) => {
        e.stopPropagation();
        if (d.custom) {
          this.customDecs.splice(parseInt(d.key.slice(1), 10), 1);
          this._saveDecCfg();
          if (this.decVisible) this.decVisible.delete(d.key);
          for (const k of [...this._annRowOrder.keys()])
            if (k.startsWith(d.key + '|')) this._annRowOrder.delete(k);
        } else {
          if (this.decVisible === null) this.decVisible = new Set(effs.map(x => x.key));
          this.decVisible.delete(d.key);
        }
        if (this.waveView) this._reqDecodeRows(this.waveView.viewport.start, this.waveView.viewport.end);
        this._refreshTable('');
        this._renderDecList();
      };
      const dot = document.createElement('span');
      dot.className = 'tw-la-dec-dot';
      dot.style.background = LA_DECODE_COLORS_ARR[effs.indexOf(d) % 4];
      it.appendChild(dot);
      it.appendChild(this._el('span', 'tw-la-dec-name', d.label || d.id));
      const pins = Object.entries(d.pins || {}).map(([k, v]) => `${k}=${v}`).join(' ');
      it.appendChild(this._el('span', 'tw-la-dec-pins', pins));
      this.decListEl.appendChild(it);
    }
  }

  _syncFileBtn() {
    this.fileBtn.innerHTML = '';
    this.fileBtn.appendChild(this._icon('file-text', 12));
    this.fileBtn.appendChild(this._el('span', 'tw-la-file-name', this.fileName || '未选文件'));
    this.fileBtn.appendChild(this._icon('down', 10));
    this.fileBtn.title = this.fileName || '选择采集文件';
  }

  // ---------- HTTP ----------

  async _fetch(path, body) {
    const opt = { signal: this._ac ? this._ac.signal : undefined };
    if (body !== undefined) {
      opt.method = 'POST';
      opt.headers = { 'Content-Type': 'application/json' };
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(this.baseUrl + path, opt);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.ok === false) throw new Error((json && json.error) || ('请求失败 ' + res.status));
    return json.data;
  }

  _setStatus(text, title, kind) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text || '';
    this.statusEl.title = title || text || '';
    this.statusEl.className = 'tw-la-status' + (kind ? ' ' + kind : '');
  }

  // ---------- 文件 ----------

  async _init() {
    try {
      const res = await fetch(this.baseUrl + '/api/dslogic/captures',
        { signal: this._ac ? this._ac.signal : undefined });
      const json = await res.json();
      if (!res.ok || !json || json.ok === false) throw new Error((json && json.error) || ('请求失败 ' + res.status));
      this.captures = json.data;
      this._storageInfo = json.storage || null;
    } catch (e) {
      this._setStatus('离线', e.message, 'err');
      return;
    }
    // 恢复上次文件
    let last = null;
    try { last = localStorage.getItem(LA_LAST_FILE_KEY); } catch (_) {}
    const list = (this.captures && this.captures.data) || this.captures || [];
    const names = new Set((Array.isArray(list) ? list : []).map(c => c.name));
    if (last && names.has(last)) this.loadFile(last);
  }

  async loadFile(name) {
    if (!name || this._destroyed) return;
    const seq = ++this._seq;
    this._setStatus('加载中', '', 'loading');
    this._closePopover();
    try {
      const info = await this._fetch('/api/dslogic/info?file=' + encodeURIComponent(name));
      if (this._destroyed || seq !== this._seq) return;
      this.fileName = name;
      this.info = info;
      this._annRowOrder = new Map();
      try { localStorage.setItem(LA_LAST_FILE_KEY, name); } catch (_) {}
      this._syncFileBtn();
      if (this.table && this.table.setRate) this.table.setRate(info.samplerate);
      this.metaEl.style.display = '';
      this.metaEl.textContent = `${this._fmtRate(info.samplerate)} · ${this._fmtTime(info.duration_s)}`;
      this.metaEl.title = `${info.channels.length} 通道 · ${info.blocks} 块`;
      this.emptyEl.style.display = 'none';
      if (this.analyzeBtn) this.analyzeBtn.disabled = false;

      // 解码器: 内嵌 + 工作台侧配置(T4) 默认全部显示; 无内嵌时也可经预设添加
      this.decoders = info.decoders || [];
      this._loadDecCfg(name);
      this.decVisible = null;
      this.decBtn.style.display = '';
      this._renderDecList();

      if (this.waveView) {
        this.waveView.setInfoChannels(info.channels);
        this.waveView.setFile(info, this._chanIdxs());
        this.waveView.setMeasure(this.measureOn);
      }
      this._loadDensity();
      this._refreshTable('');
      this._setStatus('', '');
    } catch (e) {
      if (this._destroyed || seq !== this._seq) return;
      this._setStatus('错误', e.message, 'err');
    }
  }

  _chanIdxs() {
    if (!this.info) return [];
    if (this.showAllCh) return this.info.channels.map(c => c.index);
    return this.info.channels.filter(c => c.active).map(c => c.index);
  }

  // T4: 有效解码器列表 = 内嵌(可覆盖引脚/选项) + 用户添加(预设)。entry.fetch = decode 请求参数。
  _effDecs() {
    const out = [];
    (this.decoders || []).forEach(d => {
      const ov = (this._decOverrides || {})[d.index];
      out.push({
        key: 'e' + d.index, index: d.index, id: d.id,
        label: d.label || d.id,
        pins: (ov && ov.pins) || d.pins || {},
        options: (ov && ov.options) || d.options || {},
        stacked: (ov && ov.stacked) || d.stacked || [],
        fetch: ov
          ? { decoder: d.id, pins: ov.pins, options: ov.options, stacked: ov.stacked }
          : { index: d.index }
      });
    });
    (this.customDecs || []).forEach((c, i) => {
      const s = c.spec || {};
      out.push({
        key: 'c' + i, custom: true, id: s.id, label: s.label || s.id,
        pins: s.pins || {}, options: s.options || {}, stacked: s.stacked || [],
        fetch: { decoder: s.id, pins: s.pins, options: s.options, stacked: s.stacked }
      });
    });
    return out;
  }

  _saveDecCfg() {
    if (!this.fileName) return;
    try {
      localStorage.setItem('tw-la-decs-' + this.fileName, JSON.stringify(this.customDecs || []));
      localStorage.setItem('tw-la-decov-' + this.fileName, JSON.stringify(this._decOverrides || {}));
    } catch (_) {}
  }

  _loadDecCfg(name) {
    this.customDecs = [];
    this._decOverrides = {};
    try {
      const a = JSON.parse(localStorage.getItem('tw-la-decs-' + name) || '[]');
      if (Array.isArray(a)) this.customDecs = a.filter(c => c && c.spec && c.spec.id);
      const o = JSON.parse(localStorage.getItem('tw-la-decov-' + name) || '{}');
      if (o && typeof o === 'object') this._decOverrides = o;
    } catch (_) {}
  }

  _toggleAllCh() {
    this.showAllCh = !this.showAllCh;
    this.chanToggleEl.classList.toggle('on', this.showAllCh);
    if (this.info && this.waveView) {
      this.waveView.setChannels(this._chanIdxs(), this.info);
      this._loadDensity();
    }
  }

  _toggleMeasure() {
    this.measureOn = !this.measureOn;
    this.measureBtn.classList.toggle('on', this.measureOn);
    if (this.waveView) this.waveView.setMeasure(this.measureOn);
  }

  _toggleSearch() {
    if (!this.table || !this.table.searchEl) return;
    this.table.searchEl.focus();
    this.table.searchEl.select && this.table.searchEl.select();
  }

  // ---------- 视窗数据 ----------

  _onViewportNeed(start, end, px) {
    this._reqWave(start, end, px);
    this._reqDecodeRows(start, end);
  }

  async _reqWave(start, end, px) {
    if (!this.info || this._destroyed) return;
    const seq = this._seq;
    const tok = ++this._waveTok;             // R7: 递增令牌, 过期响应直接丢弃
    const ch = this._chanIdxs().join(',');
    try {
      const data = await this._fetch(`/api/dslogic/wave?file=${encodeURIComponent(this.fileName)}` +
        `&start=${Math.round(start)}&end=${Math.round(end)}&px=${Math.round(px)}&ch=${ch}`);
      if (this._destroyed || seq !== this._seq || tok !== this._waveTok) return;
      if (this.waveView) this.waveView.setWaveData(data);
      this._setStatus('', '');
    } catch (e) {
      if (this._destroyed || seq !== this._seq || tok !== this._waveTok) return;
      this._setStatus('取数失败', e.message, 'err');
    }
  }

  async _reqDecodeRows(start, end) {
    const effs = this._effDecs();
    if (!this.info || !effs.length || this._destroyed) {
      if (this.waveView) this.waveView.setAnnotations([]);
      return;
    }
    const seq = this._seq;
    const tok = ++this._decTok;
    const rate = this.info.samplerate || 1;
    const start_s = start / rate, end_s = end / rate;
    const decs = effs.filter(d => this.decVisible === null || this.decVisible.has(d.key));
    try {
      // R6: overlap=true 让跨越视窗边界的长注释 (如 PD 报文/Type) 仍返回
      const results = await Promise.all(decs.map(d =>
        this._fetch('/api/dslogic/decode',
          Object.assign({ file: this.fileName, start_s, end_s, overlap: true, limit: 2000 }, d.fetch))));
      if (this._destroyed || seq !== this._seq || tok !== this._decTok) return;
      // R3: 每个 解码器×annotation_row 拆一个子行, 与 DSView 一致; 空子行不出现在数据中自然隐藏
      const annRows = [];
      results.forEach((d, k) => {
        const ent = decs[k];
        const groups = new Map();
        for (const r of (d.rows || [])) {
          const key = String(r.row || 'x');
          let g = groups.get(key);
          if (!g) { g = { key, desc: r.row_desc || key, rows: [] }; groups.set(key, g); }
          g.rows.push(r);
        }
        // DSView 行标签: "<解码器label>: <行名>" (如 "0:I²C: Address/Data" / "USB PD: Type")
        const decLabel = String(d.label || ent.label || ent.id || '');
        const stackIdx = effs.indexOf(ent);
        for (const g of groups.values()) {
          const oKey = ent.key + '|' + g.key;
          if (!this._annRowOrder.has(oKey)) this._annRowOrder.set(oKey, this._annRowOrder.size);
          annRows.push({
            id: ent.key + ':' + g.key,
            ord: this._annRowOrder.get(oKey),
            stackIdx,
            label: decLabel + ': ' + g.desc,
            title: decLabel + ': ' + g.desc,     // DSView Row::title() = "name: desc"
            rows: g.rows
          });
        }
      });
      annRows.sort((a, b) => a.ord - b.ord);
      if (this.waveView) this.waveView.setAnnotations(annRows);
    } catch (e) {
      if (this._destroyed || seq !== this._seq || tok !== this._decTok) return;
      this._setStatus('解码失败', e.message, 'err');
    }
  }

  _shortLabel(label) {
    return String(label || '').replace(/^\d+:/, '') || label;
  }

  async _loadDensity() {
    if (!this.info || !this.waveView || this._destroyed) return;
    const seq = this._seq;
    const total = this.info.total_samples;
    const px = 240;
    const ch = this._chanIdxs().join(',');
    try {
      const data = await this._fetch(`/api/dslogic/wave?file=${encodeURIComponent(this.fileName)}` +
        `&start=0&end=${total}&px=${px}&ch=${ch}`);
      if (this._destroyed || seq !== this._seq) return;
      const dens = new Array(px).fill(0);
      for (const c of (data.channels || [])) {
        if (c.mode === 'dense' && c.buckets) {
          for (let i = 0; i < px && i < c.buckets.length; i++) if (c.buckets[i] === 2) dens[i]++;
        } else if (c.edges) {
          for (const e of c.edges) dens[Math.min(px - 1, Math.floor(e / total * px))]++;
        }
      }
      this.waveView.setDensity(dens);
    } catch (_) { /* 缩略图失败不阻塞主流程 */ }
  }

  // ---------- 报文表 ----------

  async _refreshTable(q) {
    if (!this.table) return;
    const effs = this._effDecs();
    if (!this.info || !effs.length) {
      this.table.setColumns([]);
      this.table.setMatch(this.info ? 0 : null);
      this.table.setStatus(this.info ? '无解码' : '', '');
      return;
    }
    const seq = this._seq;
    this.table.setStatus('加载中', '');
    try {
      // DSView DecoderModel 矩阵: 列 = 解码器×annotation_row, 单元格 = texts[0]
      const colMap = new Map();   // 'decKey|row' -> col
      const colOrder = [];
      let truncated = false, totalAnn = 0;
      for (const d of effs) {
        const decLabel = String(d.label || d.id);
        const stackIdx = effs.indexOf(d);
        let offset = 0, total = Infinity;
        while (offset < total) {
          const out = await this._fetch('/api/dslogic/decode',
            Object.assign({ file: this.fileName, offset, limit: LA_TABLE_CHUNK, q: q || undefined }, d.fetch));
          if (this._destroyed || seq !== this._seq) return;
          total = out.total || 0;
          for (const r of (out.rows || [])) {
            const key = d.key + '|' + (r.row || 'x');
            let col = colMap.get(key);
            if (!col) {
              col = { key, title: decLabel + ': ' + (r.row_desc || r.row || ''), stackIdx,
                      color: LA_DECODE_COLORS_ARR[stackIdx % 4], rows: [] };
              colMap.set(key, col); colOrder.push(col);
            }
            col.rows.push(r);
            totalAnn++;
          }
          offset += LA_TABLE_CHUNK;
          if (totalAnn >= LA_TABLE_MAX) { truncated = true; break; }
        }
        if (truncated) break;
      }
      // 列内按 ss 排序; 列顺序 = _annRowOrder 首见序(与波形行一致)
      for (const col of colOrder) col.rows.sort((a, b) => a.ss - b.ss);
      colOrder.sort((a, b) => {
        const oa = this._annRowOrder.has(a.key) ? this._annRowOrder.get(a.key) : 1e9;
        const ob = this._annRowOrder.has(b.key) ? this._annRowOrder.get(b.key) : 1e9;
        return oa - ob;
      });
      this._allRows = colOrder;
      this.table.setColumns(colOrder);
      this.table.setMatch(totalAnn);
      this.table.setStatus(truncated ? '已截断' : '', truncated ? `共 ${totalAnn}+ 条, 仅载入前 ${LA_TABLE_MAX}` : '');
      this._setStatus('', '');
    } catch (e) {
      if (this._destroyed || seq !== this._seq) return;
      this.table.setStatus('错误', e.message);
      this._setStatus('取数失败', e.message, 'err');
    }
  }

  _onRowJump(row) {
    if (!row || !this.waveView) return;
    this.waveView.jumpTo(row.ss, row.es);
  }

  // ---------- 浮窗 ----------

  _togglePopover(anchor, build) {
    if (this._popoverEl) { this._closePopover(); return; }
    this._openPopover(anchor, build);
  }

  _openPopover(anchor, build) {
    this._closePopover();
    const rect = anchor.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'tw-la-popover';
    build(pop);
    document.body.appendChild(pop);
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const w = pop.offsetWidth || 200;
    let left = rect.right - 6;                       // 右级联 -6px 微重叠
    if (left + w + 8 > winW) left = rect.left + 6 - w; // 越界左翻
    if (left < 4) left = 4;
    pop.style.left = Math.round(left) + 'px';
    // R4: 锚点在上半屏向下展开, 下半屏向上生长; maxHeight 保证始终完整落在视口内
    const spaceBelow = winH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (rect.bottom <= winH / 2) {
      pop.style.top = Math.round(rect.bottom - 4) + 'px';   // 向下展开, 4px 微重叠
      pop.style.bottom = 'auto';
      pop.style.maxHeight = Math.min(300, Math.max(60, spaceBelow)) + 'px';
    } else {
      pop.style.top = 'auto';
      pop.style.bottom = Math.max(4, Math.round(winH - rect.bottom)) + 'px';  // 底边对齐锚点底
      pop.style.maxHeight = Math.min(300, Math.max(60, spaceAbove + rect.height)) + 'px';
    }
    this._popoverEl = pop;
    this._popoverAnchor = anchor;
  }

  _closePopover() {
    if (this._popoverEl) {
      try { this._popoverEl.remove(); } catch (_) {}
      this._popoverEl = null;
      this._popoverAnchor = null;
    }
    if (this._popoverEl2) {
      try { this._popoverEl2.remove(); } catch (_) {}
      this._popoverEl2 = null;
    }
  }

  // T4: 二级级联浮窗 — 从主浮窗项右侧微重叠弹出, 父浮窗保持; 底端向上对齐, 越界左翻
  _openSubPopover(anchorItem, build) {
    if (this._popoverEl2) { try { this._popoverEl2.remove(); } catch (_) {} this._popoverEl2 = null; }
    const rect = anchorItem.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'tw-la-popover';
    build(pop);
    document.body.appendChild(pop);
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const w = pop.offsetWidth || 240;
    const h = pop.offsetHeight || 120;
    let left = rect.right - 5;                          // 右级联微重叠
    if (left + w + 8 > winW) left = rect.left + 5 - w;  // 越界左翻
    if (left < 4) left = 4;
    pop.style.left = Math.round(left) + 'px';
    if (rect.bottom + h + 8 <= winH) {
      pop.style.top = Math.round(rect.bottom - h + rect.height) + 'px';   // 底端对齐项底
    } else {
      pop.style.top = 'auto';
      pop.style.bottom = '4px';
      pop.style.maxHeight = Math.min(winH - 16, Math.max(h, 200)) + 'px';
    }
    this._popoverEl2 = pop;
  }

  _buildFilePop(pop) {
    const list = (this.captures && this.captures.data) || this.captures || [];
    if (!list.length) {
      const d = document.createElement('div');
      d.className = 'tw-la-pop-item dim';
      d.textContent = '无采集文件';
      pop.appendChild(d);
    }
    for (const c of list.slice(0, 50)) {
      const it = document.createElement('div');
      it.className = 'tw-la-pop-item' + (c.name === this.fileName ? ' active' : '');
      const sz = c.size >= 1048576 ? (c.size / 1048576).toFixed(1) + 'MB' : Math.round(c.size / 1024) + 'KB';
      const dt = new Date(c.mtime);
      const ds = `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      it.appendChild(this._el('span', 'tw-la-pop-name', c.name));
      it.appendChild(this._el('span', 'tw-la-pop-dim', `${sz} · ${ds}`));
      it.title = c.name;
      it.onclick = () => { this._closePopover(); this.loadFile(c.name); };
      pop.appendChild(it);
    }
    const sep = document.createElement('div');
    sep.className = 'tw-la-pop-sep';
    pop.appendChild(sep);
    const imp = document.createElement('div');
    imp.className = 'tw-la-pop-item';
    imp.appendChild(this._icon('upload', 12, 'tw-la-pop-ic'));
    imp.appendChild(this._el('span', 'tw-la-pop-name', '导入'));
    imp.title = '复制 .dsl 到 Data_DSLogic';
    imp.onclick = () => { this._closePopover(); this._fileInput && this._fileInput.click(); };
    pop.appendChild(imp);
  }

  _buildDecPop(pop) {
    const effs = this._effDecs();
    if (!effs.length) {
      const d = document.createElement('div');
      d.className = 'tw-la-pop-item dim';
      d.textContent = '无解码器';
      pop.appendChild(d);
    }
    for (const d of effs) {
      const on = this.decVisible === null || this.decVisible.has(d.key);
      const it = document.createElement('div');
      it.className = 'tw-la-pop-item' + (on ? ' active' : '');
      const pins = Object.entries(d.pins || {}).map(([k, v]) => `${k}=${v}`).join(' ');
      const icEl = this._el('span', 'tw-la-pop-ic');
      if (on) icEl.innerHTML = laIconPark('check', 12);
      it.appendChild(icEl);
      it.appendChild(this._el('span', 'tw-la-pop-name', this._shortLabel(d.label || d.id)));
      it.appendChild(this._el('span', 'tw-la-pop-dim', pins));
      it.title = `${d.id} ${pins}`;
      it.onclick = () => {
        if (this.decVisible === null) this.decVisible = new Set(effs.map(x => x.key));
        if (this.decVisible.has(d.key)) this.decVisible.delete(d.key);
        else this.decVisible.add(d.key);
        if (effs.every(x => this.decVisible.has(x.key))) this.decVisible = null;
        this._closePopover();
        if (this.waveView) this._reqDecodeRows(this.waveView.viewport.start, this.waveView.viewport.end);
        this._refreshTable('');
        this._renderDecList();
      };
      pop.appendChild(it);
    }
    // T4: 协议预设 — 手动为无内嵌解码器的采集添加解码（工作台侧，不改 .dsl）
    if (!LaPresets || !LaPresets.LA_PRESETS) return;
    const sep = document.createElement('div');
    sep.className = 'tw-la-pop-sep';
    pop.appendChild(sep);
    const hd = document.createElement('div');
    hd.className = 'tw-la-pop-item dim';
    hd.textContent = '添加';
    pop.appendChild(hd);
    for (const p of LaPresets.LA_PRESETS) {
      const it = document.createElement('div');
      it.className = 'tw-la-pop-item';
      it.appendChild(this._el('span', 'tw-la-pop-ic'));
      it.appendChild(this._el('span', 'tw-la-pop-name', p.label));
      it.appendChild(this._el('span', 'tw-la-pop-dim', p.hint));
      it.title = p.tip;
      it.onclick = (e) => { e.stopPropagation(); this._openDecCfg(it, null, p); };
      pop.appendChild(it);
    }
  }

  // T4: 解码器配置级联浮窗 — entry(内嵌覆盖)/preset(新增) 二选一。
  // 右侧级联毛玻璃浮窗；通道下拉 = 探头号+名 + 边沿数建议；选项来自 describe 元数据。
  async _openDecCfg(anchorItem, entry, preset) {
    const rootId = entry ? entry.id : preset.dec;
    let meta;
    try {
      meta = await this._fetch('/api/dslogic/describe?id=' + encodeURIComponent(rootId));
    } catch (e) {
      this._setStatus('元数据失败', e.message, 'err');
      return;
    }
    const stackedMetas = [];
    const stackedIds = entry ? (entry.stacked || []) : (preset.stacked || []);
    for (const s of stackedIds) {
      try {
        stackedMetas.push(await this._fetch('/api/dslogic/describe?id=' + encodeURIComponent(s.id || s)));
      } catch (_) { stackedMetas.push(null); }
    }
    this._openSubPopover(anchorItem, (pop) => {
      pop.classList.add('tw-la-cfgpop');
      const head = document.createElement('div');
      head.className = 'tw-la-pop-item dim';
      head.textContent = (entry ? '配置 ' : '添加 ') + (preset ? preset.label : (entry.label || rootId));
      pop.appendChild(head);

      if (preset) {
        const h = document.createElement('div');
        h.className = 'tw-la-pop-item tw-la-cfg-hint';
        h.appendChild(this._el('span', 'tw-la-cfg-chip', preset.hint));
        h.title = preset.tip;
        pop.appendChild(h);
      }

      // ---- 引脚映射 ----
      const chans = (meta.channels || []).concat(meta.optional_channels || []);
      const reqSet = new Set((meta.channels || []).map(c => c.id));
      const suggest = LaPresets && LaPresets.laSuggestPins
        ? LaPresets.laSuggestPins(preset || { pins: chans.map(c => c.id), optPins: [] },
                                  (this.info || {}).channels || [])
        : {};
      const curPins = Object.assign({}, suggest, entry ? entry.pins : null);
      const selMap = {};
      const probeOpts = (this.info ? this.info.channels : [])
        .filter(c => c.present !== false)
        .map(c => ({ v: c.index, t: c.index + ' ' + (c.name || ''), n: c.edges || 0 }));
      for (const c of chans) {
        const required = reqSet.has(c.id);
        const row = document.createElement('div');
        row.className = 'tw-la-pop-item tw-la-cfg-row';
        row.appendChild(this._el('span', 'tw-la-cfg-k', c.name + (required ? '' : '·')));
        row.title = c.desc || c.id;
        const sel = document.createElement('select');
        sel.className = 'tw-la-cfg-sel';
        const non = document.createElement('option');
        non.value = ''; non.textContent = required ? '—' : '无';
        sel.appendChild(non);
        for (const o of probeOpts) {
          const op = document.createElement('option');
          op.value = o.v;
          op.textContent = o.t;
          sel.appendChild(op);
        }
        if (curPins[c.id] !== undefined && curPins[c.id] !== null) sel.value = String(curPins[c.id]);
        else if (required && sel.options.length > 1) sel.selectedIndex = 1;
        selMap[c.id] = sel;
        row.appendChild(sel);
        pop.appendChild(row);
      }

      // ---- 选项 ----
      const optCtrls = [];
      const decOptDefs = [{ meta, opts: entry ? entry.options : preset.options }];
      stackedMetas.forEach((sm, i) => {
        const src = entry ? (entry.stacked || [])[i] : (preset.stacked || [])[i];
        if (sm) decOptDefs.push({ meta: sm, opts: (src && src.options) || {} });
      });
      for (const dd of decOptDefs) {
        for (const o of dd.meta.options || []) {
          const row = document.createElement('div');
          row.className = 'tw-la-pop-item tw-la-cfg-row';
          row.appendChild(this._el('span', 'tw-la-cfg-k', this._shortLabel(o.desc || o.id).slice(0, 10)));
          row.title = (dd.meta.id !== rootId ? dd.meta.name + ': ' : '') + (o.desc || o.id);
          let ctrl;
          const cur = (dd.opts && dd.opts[o.id] !== undefined) ? dd.opts[o.id] : o.default;
          if (o.values && o.values.length && o.values.length <= 24) {
            ctrl = document.createElement('select');
            ctrl.className = 'tw-la-cfg-sel';
            for (const v of o.values) {
              const op = document.createElement('option');
              op.value = String(v); op.textContent = String(v);
              ctrl.appendChild(op);
            }
            ctrl.value = String(cur);
          } else {
            ctrl = document.createElement('input');
            ctrl.className = 'tw-la-cfg-in';
            ctrl.value = cur === undefined || cur === null ? '' : String(cur);
          }
          optCtrls.push({ def: o, ctrl, stackIdx: decOptDefs.indexOf(dd) });
          row.appendChild(ctrl);
          pop.appendChild(row);
        }
      }

      // ---- 应用 ----
      const ap = document.createElement('div');
      ap.className = 'tw-la-pop-item tw-la-cfg-apply';
      ap.appendChild(this._el('span', 'tw-la-pop-name', '应用'));
      ap.onclick = async (e) => {
        e.stopPropagation();
        const pinMap = {};
        for (const c of chans) {
          const v = selMap[c.id] && selMap[c.id].value;
          if (v !== '' && v !== undefined) pinMap[c.id] = parseInt(v, 10);
        }
        const coerce = (v, def) => (typeof def === 'number' && v !== '' && !isNaN(Number(v))) ? Number(v) : v;
        const rootOpts = {}, stackOpts = decOptDefs.slice(1).map(() => ({}));
        for (const oc of optCtrls) {
          const v = oc.ctrl.value;
          if (oc.stackIdx === 0) rootOpts[oc.def.id] = coerce(v, oc.def.default);
          else stackOpts[oc.stackIdx - 1][oc.def.id] = coerce(v, oc.def.default);
        }
        let spec;
        try {
          if (preset && LaPresets && LaPresets.laPresetSpec) {
            spec = LaPresets.laPresetSpec(preset, pinMap, rootOpts);
          } else {
            for (const c of (meta.channels || []))
              if (pinMap[c.id] === undefined) throw new Error('缺少必需引脚: ' + c.id);
            spec = { id: rootId, label: entry.label || rootId, pins: pinMap, options: rootOpts, stacked: [] };
          }
          spec.stacked = (entry ? entry.stacked : preset.stacked || []).map((s, i) =>
            ({ id: s.id || s, options: Object.assign({}, s.options || {}, stackOpts[i] || {}) }));
        } catch (err) {
          this._setStatus('配置失败', err.message, 'err');
          return;
        }
        if (entry && !entry.custom) {
          this._decOverrides[entry.index] = { pins: spec.pins, options: spec.options, stacked: spec.stacked };
        } else if (entry && entry.custom) {
          this.customDecs[parseInt(entry.key.slice(1), 10)] = { spec };
        } else {
          this.customDecs.push({ spec });
        }
        this._saveDecCfg();
        this._closePopover();
        this._renderDecList();
        if (this.waveView) this._reqDecodeRows(this.waveView.viewport.start, this.waveView.viewport.end);
        this._refreshTable('');
      };
      pop.appendChild(ap);
    });
  }

  // ---------- 导入 ----------

  async _onImportPicked() {
    const f = this._fileInput && this._fileInput.files && this._fileInput.files[0];
    const src = f && (f.path || '');
    if (!src) { this._setStatus('无法取路径', '仅桌面端支持导入本地文件', 'err'); return; }
    this._setStatus('导入中', '', 'loading');
    try {
      const data = await this._fetch('/api/dslogic/import', { src });
      if (this._destroyed) return;
      if (LaNoticeCls) new LaNoticeCls(data.existed ? '✓ 文件已存在' : `✓ 已导入 ${data.name}`, 1800);
      try { this.captures = await this._fetch('/api/dslogic/captures'); } catch (_) {}
      this.loadFile(data.name);
    } catch (e) {
      if (this._destroyed) return;
      this._setStatus('导入失败', e.message, 'err');
    }
  }

  // ---------- 工具函数 ----------

  _fmtRate(r) {
    if (!r) return '--';
    if (r >= 1e6) return (r / 1e6) + 'MHz';
    if (r >= 1e3) return (r / 1e3) + 'kHz';
    return r + 'Hz';
  }

  _fmtTime(s) {
    if (s == null) return '--';
    if (laFmtTimeFn) return laFmtTimeFn(s);   // 复用 wave-view 的自适应格式化
    if (s >= 60) return Math.floor(s / 60) + 'm' + Math.round(s % 60) + 's';
    if (s >= 1) return s.toFixed(1) + 's';
    if (s >= 1e-3) return (s * 1e3).toFixed(1) + 'ms';
    return (s * 1e6).toFixed(1) + 'µs';
  }

  _on(el, ev, fn, opt) {
    if (!el) return;
    el.addEventListener(ev, fn, opt);
    this._listeners.push([el, ev, fn, opt]);
  }

  // DSView header 复刻 (trace.cpp paint_label):
  //   通道行 = [10×20 色条(signal fore)] [名] [波形图标] [右侧五边形彩旗内编号]
  //   解码栈 = [10×20 色条(stack DecodeColours)] [名 "0:I²C"] [绑定通道徽标] [D 旗], 组内纵向居中
  _renderChanRows(rows, desiredH) {
    if (!this.chanRowsEl) return;
    this.chanRowsEl.innerHTML = '';
    // 解码栈分组 (stackIdx -> 首尾行)
    const stacks = new Map();
    for (const r of rows) {
      if (r.type === 'ann') {
        const k = r.stackIdx != null ? r.stackIdx : 0;
        if (!stacks.has(k)) stacks.set(k, { first: r, last: r, stackIdx: k });
        else stacks.get(k).last = r;
      }
    }
    for (const r of rows) {
      const div = document.createElement('div');
      div.className = 'tw-la-chan-row' + (r.type === 'ann' ? ' ann' : '');
      div.style.top = r.y + 'px';
      div.style.height = r.h + 'px';
      if (r.type === 'chan') {
        const strip = this._el('span', 'tw-la-chan-strip');
        strip.style.background = r.color || '#3465a4';
        div.appendChild(strip);
        div.appendChild(this._el('span', 'tw-la-chan-name', r.name));
        div.appendChild(this._icon('chart-line', 12, 'tw-la-chan-wave'));
        const flag = this._el('span', 'tw-la-chan-flag', r.index);
        flag.style.background = LA_PROBE_COLORS_ARR[r.index % 8];
        div.appendChild(flag);
        div.title = `通道 ${r.index}: ${r.name}`;
      }
      this.chanRowsEl.appendChild(div);
    }
    // 解码栈头: 不挂进被裁剪的行 div, 直接绝对定位于组中心 (DSView 标签纵向居中整个 trace)
    for (const [k, st] of stacks) {
      const midY = st.first.y + (st.last.y + st.last.h - st.first.y) / 2;
      const strip = this._el('span', 'tw-la-chan-strip');
      strip.style.background = LA_DECODE_COLORS_ARR[k % 4];
      strip.style.top = (midY - 10) + 'px'; strip.style.marginTop = '0';
      this.chanRowsEl.appendChild(strip);
      const dName = String((st.first.label || '').split(':').slice(0, -1).join(':') || st.first.label || '');
      const nameEl = this._el('span', 'tw-la-dec-hname', dName);
      nameEl.style.top = (midY - 9) + 'px'; nameEl.style.marginTop = '0';
      nameEl.style.color = LA_DECODE_COLORS_ARR[k % 4];
      nameEl.title = st.first.title || dName;
      this.chanRowsEl.appendChild(nameEl);
      const dec = this._effDecs()[k];
      const pinNos = dec ? [...new Set(Object.values(dec.pins || {}).map(Number).filter(n => !isNaN(n)))].sort((a, b) => a - b) : [];
      if (pinNos.length) {
        const badge = this._el('span', 'tw-la-dec-badge', pinNos.join(','));
        badge.style.top = (midY - 8) + 'px'; badge.style.marginTop = '0';
        this.chanRowsEl.appendChild(badge);
      }
      const flag = this._el('span', 'tw-la-chan-flag tw-la-dec-flag', 'D');
      flag.style.top = (midY - 8) + 'px'; flag.style.marginTop = '0';
      this.chanRowsEl.appendChild(flag);
    }
  }

  destroy() {
    this._destroyed = true;
    this._seq++;
    if (this._ac) { try { this._ac.abort(); } catch (_) {} this._ac = null; }
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    for (const [el, ev, fn, opt] of this._listeners) {
      try { el.removeEventListener(ev, fn, opt); } catch (_) {}
    }
    this._listeners = [];
    document.removeEventListener('pointerdown', this._docPointerDown, true);
    document.removeEventListener('keydown', this._docKeyDown);
    this._closePopover();
    if (this.waveView) { try { this.waveView.destroy(); } catch (_) {} this.waveView = null; }
    if (this.table) { try { this.table.destroy(); } catch (_) {} this.table = null; }
    if (this.navTabsContainer) { try { this.navTabsContainer.innerHTML = ''; } catch (_) {} }
    if (this.rootEl) { try { this.rootEl.remove(); } catch (_) {} this.rootEl = null; }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogicToolView };
}
