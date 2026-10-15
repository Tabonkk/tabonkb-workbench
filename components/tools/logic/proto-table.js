/* ==========================================================================
   LogicProtoTable — DSLogic 解码结果表 (T3, DSView ProtocolDock 复刻)
   DSView DecoderModel 矩阵结构:
     - 横表头: 每个解码器×annotation_row 一列 (标题 = "decLabel: rowDesc")
     - 竖表头: 序号 (该列内第 N 条注释)
     - 单元格: ann.annotations().at(0) —— texts[0] (最长变体)
   交互: 点击单元格经 onJump(ann) 跳转波形; 搜索防抖 onQuery(q) 服务端过滤;
         </> 在结果间前后导航; 匹配项计数。
   ========================================================================== */

let laPtIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!laPtIconPark) {
  try {
    laPtIconPark = require('../../../ui/iconpark.js').getIconPark;
  } catch (_) {
    laPtIconPark = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

const LA_PT_ROW_H = 22;
const LA_PT_BUFFER = 6;
const LA_PT_IDX_W = 34;

class LogicProtoTable {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts || {};
    this.onJump = opts.onJump || null;
    this.onQuery = opts.onQuery || null;
    this.onExport = opts.onExport || null;
    this.onColSettings = opts.onColSettings || null;

    this.cols = [];            // [{key,title,stackIdx,rows:[{ss,es,texts,cls,i}]}]
    this.nRows = 0;            // max 列长
    this.sel = null;           // {r,c}
    this.status = { text: '', title: '' };
    this.matchCount = null;

    this._destroyed = false;
    this._listeners = [];
    this._timers = [];
    this._searchTimer = 0;
  }

  mount() {
    this.rootEl = this.container.createDiv({ cls: 'tw-la-pt' });

    // 标题行: ⚙ 💾 解码结果 ↗
    const titleRow = this.rootEl.createDiv({ cls: 'tw-la-pt-titlerow' });
    this.setBtn = this._iconBtn(titleRow, 'setting-config', '列设置');
    this.saveBtn = this._iconBtn(titleRow, 'download', '导出 CSV');
    titleRow.createDiv({ cls: 'tw-la-pt-title' }).textContent = '解码结果';
    this.navBtn = this._iconBtn(titleRow, 'target', '定位选中');
    this._on(this.setBtn, 'click', () => { if (this.onColSettings) this.onColSettings(); });
    this._on(this.saveBtn, 'click', () => { if (this.onExport) this.onExport(); });
    this._on(this.navBtn, 'click', () => this._revealSel());

    // 搜索行: < 🔍 [edit] >
    const searchRow = this.rootEl.createDiv({ cls: 'tw-la-pt-searchrow' });
    this.preBtn = this._iconBtn(searchRow, 'left', '上一个');
    this._iconBtn(searchRow, 'search', '搜索');
    this.searchEl = searchRow.createEl('input', { cls: 'tw-la-pt-search' });
    this.searchEl.type = 'search';
    this.searchEl.placeholder = '查找';
    this._on(this.searchEl, 'input', () => this._onSearchInput());
    this._on(this.searchEl, 'keydown', (e) => {
      if (e.key === 'Enter') this._nav(e.shiftKey ? -1 : 1);
    });
    this.nxtBtn = this._iconBtn(searchRow, 'right', '下一个');
    this._on(this.preBtn, 'click', () => this._nav(-1));
    this._on(this.nxtBtn, 'click', () => this._nav(1));

    // 匹配项
    const matchRow = this.rootEl.createDiv({ cls: 'tw-la-pt-matchrow' });
    matchRow.createEl('span', { cls: 'tw-la-pt-match-t' }).textContent = '匹配项';
    this.matchEl = matchRow.createEl('span', { cls: 'tw-la-pt-match-v' });

    // 矩阵表格
    this.bodyEl = this.rootEl.createDiv({ cls: 'tw-la-pt-body' });
    this.spacerEl = this.bodyEl.createDiv({ cls: 'tw-la-pt-spacer' });
    this.headEl = this.bodyEl.createDiv({ cls: 'tw-la-pt-thead' });
    this.rowsEl = this.bodyEl.createDiv({ cls: 'tw-la-pt-rows' });
    this._on(this.bodyEl, 'scroll', () => this._renderWindow());
    this._renderCols();
  }

  _iconBtn(parent, icon, title) {
    const b = parent.createEl('button', { cls: 'tw-la-pt-ibtn', title: title || '' });
    const ic = document.createElement('span');
    ic.className = 'tw-la-ic';
    ic.innerHTML = laPtIconPark(icon, 12);   // 静态图标字面量
    b.appendChild(ic);
    return b;
  }

  _on(el, ev, fn, opt) {
    el.addEventListener(ev, fn, opt);
    this._listeners.push([el, ev, fn, opt]);
  }

  _onSearchInput() {
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      if (this._destroyed || !this.onQuery) return;
      this.onQuery(this.searchEl.value || '');
    }, 300);
    this._timers.push(this._searchTimer);
  }

  getQuery() { return this.searchEl ? this.searchEl.value || '' : ''; }

  setRate(rate) { this._rate = rate || 0; }

  // 列定义: cols=[{key,title,stackIdx,color,rows:[ann]}]
  setColumns(cols) {
    this.cols = cols || [];
    this.nRows = this.cols.reduce((m, c) => Math.max(m, (c.rows || []).length), 0);
    this.sel = null;
    if (this.spacerEl) this.spacerEl.style.height = (this.nRows * LA_PT_ROW_H) + 'px';
    this._renderCols();
    this._renderWindow();
  }

  setStatus(text, title) {
    this.status = { text: text || '', title: title || '' };
    this._renderCols();
  }

  setMatch(n) {
    this.matchCount = n;
    if (this.matchEl) this.matchEl.textContent = (n == null ? '' : String(n));
  }

  totalRows() { return this.nRows; }

  _renderCols() {
    if (!this.headEl) return;
    this.headEl.innerHTML = '';
    let x = LA_PT_IDX_W;
    for (const c of this.cols) {
      const w = Math.max(96, this._colW(c));
      const h = document.createElement('div');
      h.className = 'tw-la-pt-col';
      h.style.left = x + 'px';
      h.style.width = w + 'px';
      h.title = c.title || '';
      const pill = document.createElement('div');
      pill.className = 'tw-la-pt-colpill';
      pill.style.background = c.color || '#394f67';
      pill.style.color = this._pillText(c.color);
      pill.textContent = c.title || '';
      h.appendChild(pill);
      this.headEl.appendChild(h);
      c._x = x; c._w = w;
      x += w;
    }
    const idxHead = document.createElement('div');
    idxHead.className = 'tw-la-pt-col tw-la-pt-colidx';
    idxHead.style.left = '0px'; idxHead.style.width = LA_PT_IDX_W + 'px';
    idxHead.textContent = '';
    this.headEl.appendChild(idxHead);
    this.bodyEl.style.minWidth = x + 'px';
    this.headEl.style.width = x + 'px';
    this.spacerEl.style.width = x + 'px';
    this.rowsEl.style.width = x + 'px';
  }

  _colW(c) {
    const t = c.title || '';
    return Math.max(96, Math.min(260, 12 + t.length * 7));
  }

  _pillText(color) {
    const m = /^#?([0-9a-f]{6})/i.exec(color || '');
    if (!m) return '#fff';
    const v = parseInt(m[1], 16);
    const lum = (Math.max(v >> 16, (v >> 8) & 255, v & 255) + Math.min(v >> 16, (v >> 8) & 255, v & 255)) / 2;
    return lum > 128 ? '#000' : '#fff';
  }

  _cellAt(r, c) {
    const col = this.cols[c];
    if (!col || !col.rows) return null;
    return col.rows[r] || null;
  }

  _renderWindow() {
    if (!this.rowsEl || this._destroyed) return;
    const vh = this.bodyEl.clientHeight || 200;
    const st = this.bodyEl.scrollTop || 0;
    const i0 = Math.max(0, Math.floor(st / LA_PT_ROW_H) - LA_PT_BUFFER);
    const i1 = Math.min(this.nRows, Math.ceil((st + vh) / LA_PT_ROW_H) + LA_PT_BUFFER);
    this.rowsEl.innerHTML = '';
    for (let i = i0; i < i1; i++) {
      const row = document.createElement('div');
      row.className = 'tw-la-pt-row' + (i % 2 ? ' alt' : '');
      row.style.top = (i * LA_PT_ROW_H) + 'px';
      row.style.height = LA_PT_ROW_H + 'px';
      const num = document.createElement('span');
      num.className = 'tw-la-pt-i';
      num.textContent = String(i);
      num.style.width = LA_PT_IDX_W + 'px';
      row.appendChild(num);
      for (let c = 0; c < this.cols.length; c++) {
        const col = this.cols[c];
        const cell = document.createElement('span');
        cell.className = 'tw-la-pt-cell';
        cell.style.left = (col._x || 0) + 'px';
        cell.style.width = (col._w || 96) + 'px';
        const an = this._cellAt(i, c);
        if (an) {
          cell.textContent = (an.texts && an.texts[0]) || '';
          cell.title = cell.textContent;
          const ri = i, ci = c;
          cell.onclick = () => this._select(ri, ci, true);
          if (this.sel && this.sel.r === i && this.sel.c === c) cell.classList.add('sel');
        }
        row.appendChild(cell);
      }
      this.rowsEl.appendChild(row);
    }
  }

  _select(r, c, jump) {
    this.sel = { r, c };
    this._renderWindow();
    const an = this._cellAt(r, c);
    if (jump && an && this.onJump) this.onJump(an);
  }

  _revealSel() {
    if (!this.sel) return;
    const y = this.sel.r * LA_PT_ROW_H;
    if (y < this.bodyEl.scrollTop || y + LA_PT_ROW_H > this.bodyEl.scrollTop + this.bodyEl.clientHeight)
      this.bodyEl.scrollTop = Math.max(0, y - LA_PT_ROW_H * 2);
    this._renderWindow();
  }

  // </> 结果导航: 按行主序扫过非空单元格
  _nav(dir) {
    if (!this.nRows || !this.cols.length) return;
    const cells = [];
    for (let r = 0; r < this.nRows; r++)
      for (let c = 0; c < this.cols.length; c++)
        if (this._cellAt(r, c)) cells.push({ r, c });
    if (!cells.length) return;
    let pos = 0;
    if (this.sel) {
      const cur = cells.findIndex(k => k.r === this.sel.r && k.c === this.sel.c);
      pos = cur < 0 ? 0 : (cur + dir + cells.length) % cells.length;
    }
    const nxt = cells[pos];
    this._select(nxt.r, nxt.c, true);
    this._revealSel();
  }

  // 选中某条注释 (波形联动/外部跳转)
  selectAnnotation(an) {
    for (let c = 0; c < this.cols.length; c++) {
      const idx = (this.cols[c].rows || []).indexOf(an);
      if (idx >= 0) { this._select(idx, c, false); this._revealSel(); return; }
    }
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._searchTimer);
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    for (const [el, ev, fn, opt] of this._listeners) {
      try { el.removeEventListener(ev, fn, opt); } catch (_) {}
    }
    this._listeners = [];
    this.onJump = null; this.onQuery = null; this.onExport = null; this.onColSettings = null;
    if (this.rootEl) { try { this.rootEl.remove(); } catch (_) {} this.rootEl = null; }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogicProtoTable, LA_PT_ROW_H };
}
