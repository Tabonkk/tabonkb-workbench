// components/idea-capture-palette.js
// 全局「记灵感」浮动捕获面板: Alt+I 全局唤起, Ctrl+I 在非编辑器环境唤起
// 样式/交互参照 explore-palette.js (body 级遮罩 + 居中毛玻璃面板)

/**
 * Ctrl+I 是否应让出给编辑器原生行为 (斜体/补全):
 * activeEl 或其祖先命中 .cm-editor / .monaco-editor → true
 */
function shouldYieldCtrlI(activeEl) {
  if (!activeEl || typeof activeEl.closest !== 'function') return false;
  return !!(activeEl.closest('.cm-editor') || activeEl.closest('.monaco-editor'));
}

/**
 * 记灵感上下文合并: overrides 显式给出的键 (含 null/'') 覆盖 base;
 * 用于 Jira 抽屉 🌱 等入口屏蔽活动文件/选区并注入 jiraKey/module
 */
function mergeCaptureContext(base, overrides) {
  const ctx = { ...(base || {}) };
  for (const k of Object.keys(overrides || {})) {
    ctx[k] = overrides[k];
  }
  return ctx;
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const IDEA_TRACK_OPTS = [
  { id: 'work', label: '工作' },
  { id: 'deep', label: '深耕' },
  { id: 'broad', label: '拓展' }
];

class IdeaCapturePalette {
  /**
   * @param {object} opts {app, topicService, getContext}
   * getContext() -> {selectedTopicId?, jiraKey?, activeFilePath?, selectionText?, selectionFromAgent?}
   */
  constructor(opts = {}) {
    this.app = opts.app;
    this.topicService = opts.topicService;
    this.getContext = opts.getContext;
    this.overlayEl = null;
    this.inputEl = null;
    this.destInputEl = null;
    this.destChipEl = null;
    this.destListEl = null;
    this.trackChipsEl = null;
    this.topics = [];
    this.target = { type: 'seed' };
    this.seedTrack = '';
    this._ctx = {};
    this._destIdx = 0;
    this._destItems = [];
    this._destroyFns = [];
  }

  isOpen() {
    return !!(this.overlayEl && this.overlayEl.isConnected);
  }

  toggle(overrides) {
    if (this.isOpen()) this.close();
    else this.open(overrides);
  }

  _listen(el, ev, fn, capture) {
    el.addEventListener(ev, fn, capture);
    this._destroyFns.push(() => el.removeEventListener(ev, fn, capture));
  }

  async open(overrides = {}) {
    if (this.isOpen()) {
      this.inputEl && this.inputEl.focus();
      return;
    }
    const o = document.createElement('div');
    o.className = 'tw-idea-overlay';
    o.innerHTML = `
      <div class="tw-idea-panel">
        <input class="tw-idea-input" type="text" placeholder="记下灵感…" />
        <div class="tw-idea-dest">
          <span class="tw-idea-dest-label">去向</span>
          <button class="tw-idea-dest-chip" type="button"></button>
          <span class="tw-idea-tracks"></span>
          <input class="tw-idea-dest-input" type="text" placeholder="搜去向…" />
        </div>
        <div class="tw-idea-dest-list"></div>
      </div>`;
    document.body.appendChild(o);
    this.overlayEl = o;
    this.inputEl = o.querySelector('.tw-idea-input');
    this.destChipEl = o.querySelector('.tw-idea-dest-chip');
    this.destInputEl = o.querySelector('.tw-idea-dest-input');
    this.destListEl = o.querySelector('.tw-idea-dest-list');
    this.trackChipsEl = o.querySelector('.tw-idea-tracks');

    // 上下文 + 默认去向
    const base = (this.getContext && this.getContext()) || {};
    this._ctx = mergeCaptureContext(base, overrides.context);
    try {
      this.topics = await this.topicService.scan();
    } catch (_) {
      this.topics = [];
    }
    let target = overrides.target;
    if (!target && typeof inferCaptureTarget === 'function') {
      target = inferCaptureTarget(this._ctx, this.topics);
    }
    this._setTarget(target || { type: 'seed' });

    // 预填: overrides.text 优先, 其次选区文本
    let text = overrides.text;
    if (text == null) text = this._ctx.selectionText || '';
    text = String(text || '').trim().slice(0, 300);
    this.inputEl.value = text;

    this._bind(o);
    this._renderDest();
    this.inputEl.focus();
    if (text) this.inputEl.select();
  }

  _bind(o) {
    this._listen(this.inputEl, 'keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
      else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); this._focusDestInput(); }
    });
    this._listen(this.destInputEl, 'focus', () => { this._destIdx = 0; this._renderDestList(); });
    this._listen(this.destInputEl, 'input', () => { this._destIdx = 0; this._renderDestList(); });
    this._listen(this.destInputEl, 'blur', () => {
      setTimeout(() => { if (this.destListEl) this.destListEl.classList.remove('open'); }, 150);
    });
    this._listen(this.destInputEl, 'keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this._moveDest(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this._moveDest(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const it = this._destItems[this._destIdx];
        if (it) this._pickTarget(it);
      } else if (e.key === 'Tab') { e.preventDefault(); this.inputEl.focus(); }
    });
    this._listen(this.destChipEl, 'click', () => this._focusDestInput());
    this._listen(this.trackChipsEl, 'click', (e) => {
      const btn = e.target.closest('[data-track]');
      if (!btn) return;
      const tr = btn.getAttribute('data-track');
      this.seedTrack = (this.seedTrack === tr) ? '' : tr;
      this._renderDest();
    });
    this._listen(o, 'keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
    }, true);
    this._listen(o, 'mousedown', (e) => {
      if (e.target === o) this.close();
    });
    this._listen(this.destListEl, 'mousedown', (e) => {
      const row = e.target.closest('[data-idx]');
      if (!row) return;
      e.preventDefault();
      const it = this._destItems[Number(row.getAttribute('data-idx'))];
      if (it) this._pickTarget(it);
    });
  }

  _focusDestInput() {
    if (this.destInputEl) {
      this.destInputEl.focus();
      this._destIdx = 0;
      this._renderDestList();
    }
  }

  _setTarget(t) {
    if (t && t.type === 'topic' && t.id) {
      const topic = (this.topics || []).find(x => x.id === t.id);
      this.target = { type: 'topic', id: t.id, title: (topic && topic.title) || t.title || t.id };
      this.seedTrack = '';
    } else {
      this.target = { type: 'seed' };
      this.seedTrack = (t && t.track) || '';
    }
  }

  _pickTarget(it) {
    this._setTarget(it);
    this._renderDest();
    if (this.destInputEl) {
      this.destInputEl.value = '';
      this.destListEl.classList.remove('open');
    }
    this.inputEl.focus();
  }

  _moveDest(d) {
    if (!this._destItems.length) return;
    this._destIdx = (this._destIdx + d + this._destItems.length) % this._destItems.length;
    this._renderDestList();
  }

  _destCandidates(q) {
    const kw = String(q || '').trim().toLowerCase();
    const items = [{ type: 'seed', icon: '🌱', label: '新种子', sub: '记入种子池' }];
    for (const t of (this.topics || []).filter(x => x.status === 'in_progress')) {
      items.push({ type: 'topic', id: t.id, icon: '📁', label: t.title, sub: `${t.module || ''} ${t.id}`.trim() });
    }
    if (!kw) return items;
    return items.filter(it => {
      const hay = it.type === 'seed'
        ? '新种子 seed 种子'
        : `${it.label} ${it.id} ${it.sub}`.toLowerCase();
      return hay.toLowerCase().includes(kw);
    });
  }

  _renderDest() {
    if (!this.destChipEl) return;
    if (this.target.type === 'topic') {
      this.destChipEl.innerHTML = `<span class="tw-idea-dest-ico">📁</span>${_esc(this.target.title)}`;
      if (this.trackChipsEl) { this.trackChipsEl.innerHTML = ''; this.trackChipsEl.style.display = 'none'; }
    } else {
      this.destChipEl.innerHTML = `<span class="tw-idea-dest-ico">🌱</span>新种子`;
      if (this.trackChipsEl) {
        this.trackChipsEl.style.display = '';
        this.trackChipsEl.innerHTML = IDEA_TRACK_OPTS.map(t =>
          `<button type="button" class="tw-idea-track${this.seedTrack === t.id ? ' on' : ''}" data-track="${t.id}">${t.label}</button>`
        ).join('');
      }
    }
  }

  _renderDestList() {
    if (!this.destListEl) return;
    this._destItems = this._destCandidates(this.destInputEl ? this.destInputEl.value : '');
    if (this._destIdx >= this._destItems.length) this._destIdx = 0;
    if (!this._destItems.length) {
      this.destListEl.classList.add('open');
      this.destListEl.innerHTML = `<div class="tw-idea-dest-empty">无匹配</div>`;
      return;
    }
    this.destListEl.classList.add('open');
    this.destListEl.innerHTML = this._destItems.map((it, i) => `
      <div class="tw-idea-dest-item${i === this._destIdx ? ' active' : ''}" data-idx="${i}">
        <span class="tw-idea-dest-ico">${it.icon}</span>
        <span class="tw-idea-dest-name">${_esc(it.label)}</span>
        <span class="tw-idea-dest-sub">${_esc(it.sub || '')}</span>
      </div>`).join('');
  }

  async _submit() {
    const text = this.inputEl ? this.inputEl.value.trim() : '';
    if (!text) return;
    const ctx = this._ctx || {};
    let source = 'manual';
    if (ctx.jiraKey) source = 'jira';
    else if (ctx.selectionFromAgent) source = 'agent';
    else if (ctx.activeFilePath) source = 'note';
    const source_ref = ctx.jiraKey
      || (ctx.activeFilePath ? `[[${String(ctx.activeFilePath).replace(/\.[^./\\]+$/, '')}]]` : '');
    const target = this.target && this.target.type === 'topic'
      ? { type: 'topic', id: this.target.id }
      : { type: 'seed', track: this.seedTrack || '' };
    try {
      const res = await this.topicService.captureIdea({
        text,
        target,
        context: { source, source_ref, module: ctx.module || '' }
      });
      if (res && res.kind === 'topic') {
        new Notice(`💡 已记入「${res.topic.title}」`);
      } else {
        new Notice('🌱 已记入种子');
      }
      this.close();
    } catch (e) {
      new Notice(`记灵感失败: ${(e && e.message) || e}`);
    }
  }

  close() {
    for (const fn of this._destroyFns.splice(0)) {
      try { fn(); } catch (_) {}
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    this.inputEl = this.destInputEl = this.destChipEl = this.destListEl = this.trackChipsEl = null;
    this._destItems = [];
    this._destIdx = 0;
  }

  dispose() {
    this.close();
  }
}

module.exports = { IdeaCapturePalette, shouldYieldCtrlI, mergeCaptureContext, IDEA_TRACK_OPTS };
