/**
 * ExploreCommandPalette: 探索页搜索面板 (Ctrl+F 唤起)
 * - 屏幕中央毛玻璃搜索框 + 压暗模糊遮罩
 * - 输入实时过滤, 匹配文字高亮
 * - ↑↓ 选择, Enter 执行, Esc/点击遮罩关闭
 * 挂在 document.body 顶层, 不受工作台内部 backdrop-filter 包含块影响
 */
class ExploreCommandPalette {
  /**
   * @param {object[]} commands 空查询时显示的默认项: { id, label, desc, keywords, icon, badge, run }
   * @param {function} getIconPark 图标渲染函数
   * @param {function} [onQuery] 非空查询的异步数据源: async (q) => items[]
   */
  constructor(commands = [], getIconPark = null, onQuery = null) {
    this.commands = commands;
    this.getIconPark = getIconPark;
    this.onQuery = onQuery;
    this.overlayEl = null;
    this.inputEl = null;
    this.listEl = null;
    this.activeIndex = 0;
    this.filtered = [];
    this._querySeq = 0;
    this._queryTimer = 0;
    this._history = this._loadHistory();

    this._onInputKeydown = this._onInputKeydown.bind(this);
    this._onOverlayMousedown = this._onOverlayMousedown.bind(this);
    this._onDocKeydown = this._onDocKeydown.bind(this);
  }

  get isOpen() {
    return Boolean(this.overlayEl && this.overlayEl.isConnected);
  }

  toggle() {
    if (this.isOpen) this.close(); else this.open();
  }

  open() {
    if (this.isOpen) { this.inputEl?.focus(); return; }
    this.activeIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'tw-cmdk-overlay';
    overlay.innerHTML = `
      <div class="tw-cmdk-panel" role="dialog" aria-label="命令面板">
        <div class="tw-cmdk-head">
          <div class="tw-search-wrap tw-cmdk-search-wrap">
            <svg class="tw-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input type="text" class="tw-search-input tw-cmdk-input" placeholder="Omnisearch 全文检索…" spellcheck="false" autocomplete="off">
          </div>
        </div>
        <div class="tw-cmdk-history"></div>
        <div class="tw-cmdk-list" role="listbox" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.inputEl = overlay.querySelector('.tw-cmdk-input');
    this.listEl = overlay.querySelector('.tw-cmdk-list');
    this.histEl = overlay.querySelector('.tw-cmdk-history');

    this.inputEl.addEventListener('input', () => {
      // 有异步数据源时防抖触发检索, 否则同步过滤默认命令项
      clearTimeout(this._queryTimer);
      const q = this.inputEl.value.trim();
      if (this.onQuery && q) {
        this._queryTimer = setTimeout(() => this._renderList(), 140);
      } else {
        this._renderList();
      }
      this._renderHistory();
    });
    this.inputEl.addEventListener('keydown', this._onInputKeydown);
    overlay.addEventListener('mousedown', this._onOverlayMousedown);
    document.addEventListener('keydown', this._onDocKeydown, true);

    this._renderList();
    this._renderHistory();
    requestAnimationFrame(() => this.inputEl && this.inputEl.focus());
  }

  close() {
    if (!this.overlayEl) return;
    document.removeEventListener('keydown', this._onDocKeydown, true);
    this.overlayEl.remove();
    this.overlayEl = null;
    this.inputEl = null;
    this.listEl = null;
    this.histEl = null;
  }

  _onOverlayMousedown(e) {
    if (e.target === this.overlayEl) this.close();
  }

  _onDocKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  _onInputKeydown(e) {
    // 面板打开期间吞掉全部按键, 防止底层工作台/Obsidian 热键响应
    e.stopPropagation();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = this.filtered.length;
      if (!n) return;
      this.activeIndex = (this.activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      this._syncActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = this.filtered[this.activeIndex];
      if (item) {
        this._recordQuery(this.inputEl ? this.inputEl.value : '');
        this.close();
        try { item.run(); } catch (err) { console.error('[cmdk] run failed:', err); }
      }
    }
  }

  /**
   * 搜索框下方的最近搜索字串: 空查询时显示最近 5 条, 点击回填输入框并立即检索
   */
  _renderHistory() {
    if (!this.histEl) return;
    const q = (this.inputEl ? this.inputEl.value : '').trim();
    this.histEl.innerHTML = '';
    if (q || !this._history.length) {
      this.histEl.style.display = 'none';
      return;
    }
    this.histEl.style.display = '';
    this._history.slice(0, 5).forEach(h => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tw-cmdk-hist-chip';
      chip.textContent = h;
      chip.title = h;
      chip.addEventListener('mousedown', e => e.preventDefault());
      chip.addEventListener('click', () => {
        if (!this.inputEl) return;
        this.inputEl.value = h;
        this.inputEl.focus();
        this._renderHistory();
        this._renderList();
      });
      this.histEl.appendChild(chip);
    });
  }

  _loadHistory() {
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('tabonkb-explore-palette-history') : null;
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(s => typeof s === 'string' && s.trim()).slice(0, 5) : [];
    } catch (_) { return []; }
  }

  _recordQuery(q) {
    q = String(q || '').trim();
    if (!q) return;
    this._history = [q, ...this._history.filter(s => s !== q)].slice(0, 5);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('tabonkb-explore-palette-history', JSON.stringify(this._history));
    } catch (_) {}
  }

  _matches(cmd, q) {
    if (!q) return true;
    const hay = (cmd.label + ' ' + (cmd.desc || '') + ' ' + (cmd.keywords || '')).toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  async _renderList() {
    if (!this.listEl) return;
    const q = (this.inputEl ? this.inputEl.value : '').trim();
    const seq = ++this._querySeq;

    let items;
    if (q && this.onQuery) {
      // 异步数据源 (Omnisearch): 先显示检索中占位, 结果回来后若非最新查询则丢弃
      this.listEl.style.display = '';
      this.listEl.innerHTML = `<div class="tw-cmdk-empty">检索中…</div>`;
      try {
        items = await this.onQuery(q);
      } catch (err) {
        console.error('[cmdk] query failed:', err);
        items = [];
      }
      if (seq !== this._querySeq || !this.listEl) return;
    } else {
      items = this.commands.filter(c => this._matches(c, q));
    }
    this.filtered = items || [];
    if (this.activeIndex >= this.filtered.length) this.activeIndex = Math.max(0, this.filtered.length - 1);

    if (!this.filtered.length) {
      // 空查询时整块列表隐藏 (默认命令项已精简); 有查询但无结果时保留「无匹配结果」占位
      if (!q) {
        this.listEl.style.display = 'none';
        this.listEl.innerHTML = '';
        return;
      }
      this.listEl.innerHTML = `<div class="tw-cmdk-empty">无匹配结果</div>`;
      return;
    }
    this.listEl.style.display = '';
    let lastGroup = null;
    this.listEl.innerHTML = this.filtered.map((c, i) => {
      const g = c.group || (q ? '文档' : '命令');
      const head = g !== lastGroup ? `<div class="tw-cmdk-group">${this._esc(g)}</div>` : '';
      lastGroup = g;
      return `${head}
      <div class="tw-cmdk-item ${i === this.activeIndex ? 'active' : ''} ${c.pinned ? 'pinned' : ''}" data-idx="${i}" role="option">
        <span class="tw-cmdk-item-icon">${this._icon(c.icon || 'link', 16)}</span>
        <span class="tw-cmdk-item-text">
          <span class="tw-cmdk-item-label">${this._hl(c.label, q)}</span>
          ${c.excerpt ? `<span class="tw-cmdk-item-excerpt">${this._hl(c.excerpt, q)}</span>` : ''}
          ${c.desc ? `<span class="tw-cmdk-item-desc">${this._hl(c.desc, q)}</span>` : ''}
        </span>
        ${c.badge ? `<span class="tw-cmdk-badge">${this._esc(c.badge)}</span>` : ''}
      </div>`;
    }).join('');

    for (const btn of this.listEl.querySelectorAll('.tw-cmdk-item')) {
      const idx = Number(btn.dataset.idx);
      btn.addEventListener('mousemove', () => {
        if (this.activeIndex !== idx) { this.activeIndex = idx; this._syncActive(); }
      });
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        const item = this.filtered[idx];
        if (item) {
          this._recordQuery(this.inputEl ? this.inputEl.value : '');
          this.close();
          try { item.run(); } catch (err) { console.error('[cmdk] run failed:', err); }
        }
      });
    }
  }

  _syncActive() {
    if (!this.listEl) return;
    const items = this.listEl.querySelectorAll('.tw-cmdk-item');
    items.forEach((el, i) => {
      el.classList.toggle('active', i === this.activeIndex);
    });
    const active = items[this.activeIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  _hl(text, q) {
    if (!q) return this._esc(text);
    const idx = String(text).toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return this._esc(text);
    return this._esc(text.slice(0, idx))
      + '<span class="tw-cmdk-hl">' + this._esc(text.slice(idx, idx + q.length)) + '</span>'
      + this._esc(text.slice(idx + q.length));
  }

  _icon(name, size) {
    try {
      if (typeof this.getIconPark === 'function') return this.getIconPark(name, size);
      if (typeof getIconPark === 'function') return getIconPark(name, size);
    } catch (_) {}
    return '·';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExploreCommandPalette };
}
