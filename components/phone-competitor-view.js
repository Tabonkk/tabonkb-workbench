/* ==========================================================================
   PhoneCompetitorView — 手机竞品分析页(资讯页子页签)
   数据源: 07-Project/2026-Phone-Competitor-DB/phones.json (由 export_phone_db.py 导出)
   ========================================================================== */

const PHONE_DB_JSON_PATH = '07-Project/2026-Phone-Competitor-DB/phones.json';

const COMP_TIER_ORDER = ['入门', '中端', '中高端', '高端', '旗舰', '折叠屏'];
const COMP_TIER_COLORS = {
  '入门': '#94A3B8',
  '中端': '#38BDF8',
  '中高端': '#818CF8',
  '高端': '#F59E0B',
  '旗舰': '#EF4444',
  '折叠屏': '#10B981'
};
const COMP_BRAND_COLORS = ['#2563EB', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9', '#F97316', '#14B8A6', '#EC4899', '#64748B', '#84CC16', '#6366F1'];

class PhoneCompetitorView {
  constructor(opts = {}) {
    this.app = opts.app;
    this.phones = [];
    this.meta = null;
    this.loadError = '';
    this.filters = { brand: 'all', tier: 'all', region: 'all', year: 'all', kw: '', verifiedOnly: false };
    this.sortKey = 'releaseDate';
    this.sortDesc = true;
    this.compareIds = [];
    this.detailPhone = null;
    this.el = null;
    this._chartW = 0;
    this._resizeObs = null;
    this._rafId = 0;
  }

  async mount(parentEl) {
    this.el = parentEl.createDiv({ cls: 'tw-comp-root' });
    await this.loadData();
    this.render();
    this.bindChartTooltip();
    if (typeof ResizeObserver !== 'undefined' && this.el) {
      this._resizeObs = new ResizeObserver(() => {
        const wrap = this.el.querySelector('.tw-comp-charts');
        const w = wrap ? wrap.clientWidth : 0;
        if (w > 60 && Math.abs(w - (this._chartW || 0)) > 8) {
          if (this._rafId) cancelAnimationFrame(this._rafId);
          this._rafId = requestAnimationFrame(() => { this._rafId = 0; this.renderCharts(); });
        }
      });
      this._resizeObs.observe(this.el);
    }
  }

  dispose() {
    if (this._resizeObs) { try { this._resizeObs.disconnect(); } catch (e) {} this._resizeObs = null; }
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.unbindChartTooltip();
    this.hideChartTooltip();
    if (this._tipEl && this._tipEl.parentElement) this._tipEl.parentElement.removeChild(this._tipEl);
    this.el = null;
  }

  /* ---------------- 图表 hover 数值提示 (SVG <title> 原生 tooltip 在 Electron 下不可靠) ---------------- */

  bindChartTooltip() {
    if (!this.el) return;
    this._tipMove = (e) => {
      const rect = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (rect) this.showChartTooltip(e, rect.getAttribute('data-tip'));
      else this.hideChartTooltip();
    };
    this.el.addEventListener('mousemove', this._tipMove);
    // 兜底: 鼠标快速移出/切子页签时 mouseleave 可能不触发, 用 document 级监听兼容隐藏
    this._docTipMove = (e) => {
      if (!this._tipEl || !this._tipEl.classList.contains('visible')) return;
      if (this.el && !this.el.contains(e.target)) this.hideChartTooltip();
    };
    this._hideTip = () => this.hideChartTooltip();
    document.addEventListener('mousemove', this._docTipMove, true);
    window.addEventListener('blur', this._hideTip);
  }

  unbindChartTooltip() {
    if (this.el && this._tipMove) this.el.removeEventListener('mousemove', this._tipMove);
    if (this._docTipMove) document.removeEventListener('mousemove', this._docTipMove, true);
    if (this._hideTip) window.removeEventListener('blur', this._hideTip);
    this._tipMove = this._docTipMove = this._hideTip = null;
  }

  showChartTooltip(e, text) {
    if (!this._tipEl) {
      this._tipEl = document.createElement('div');
      this._tipEl.className = 'tw-comp-tooltip';
      document.body.appendChild(this._tipEl);
    }
    if (this._tipEl.textContent !== text) this._tipEl.textContent = text;
    this._tipEl.classList.add('visible');
    const pad = 14;
    const tw = this._tipEl.offsetWidth, th = this._tipEl.offsetHeight;
    let x = e.clientX + pad, y = e.clientY - th - 8;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
    if (y < 8) y = e.clientY + pad;
    this._tipEl.style.left = x + 'px';
    this._tipEl.style.top = y + 'px';
  }

  hideChartTooltip() {
    if (this._tipEl) this._tipEl.classList.remove('visible');
  }

  async loadData() {
    try {
      const raw = await this.app.vault.adapter.read(PHONE_DB_JSON_PATH);
      const data = JSON.parse(raw);
      this.phones = Array.isArray(data.phones) ? data.phones : [];
      this.meta = { exportedAt: data.exportedAt || '', count: data.count || this.phones.length };
      this.loadError = '';
    } catch (e) {
      this.phones = [];
      this.meta = null;
      this.loadError = '无法读取竞品数据: ' + PHONE_DB_JSON_PATH + '。请先运行 07-Project/2026-Phone-Competitor-DB/scripts/export_phone_db.py 生成。';
    }
  }

  /* ---------------- 过滤 / 统计 ---------------- */

  getFiltered() {
    const f = this.filters;
    const kw = f.kw.toLowerCase();
    let list = this.phones.filter(p => {
      if (f.brand !== 'all' && p.brand !== f.brand) return false;
      if (f.tier !== 'all' && p.tier !== f.tier) return false;
      if (f.region !== 'all' && !(p.region || '').includes(f.region)) return false;
      if (f.year !== 'all' && !(p.releaseDate || '').startsWith(f.year)) return false;
      if (f.verifiedOnly && p.verifyStatus !== '已核验') return false;
      if (kw) {
        const hay = `${p.model} ${p.brand} ${p.series} ${p.soc}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    const dir = this.sortDesc ? -1 : 1;
    const key = this.sortKey;
    list.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === 'releaseDate') { va = va || ''; vb = vb || ''; return va < vb ? -dir : va > vb ? dir : 0; }
      va = (va === null || va === undefined) ? -1 : va;
      vb = (vb === null || vb === undefined) ? -1 : vb;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return list;
  }

  median(nums) {
    const arr = nums.filter(v => typeof v === 'number').sort((a, b) => a - b);
    if (!arr.length) return 0;
    const m = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[m] : Math.round((arr[m - 1] + arr[m]) / 2);
  }

  distinctCounts(field) {
    const map = new Map();
    for (const p of this.phones) {
      const v = p[field] || '未知';
      map.set(v, (map.get(v) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  /* ---------------- 渲染 ---------------- */

  render() {
    if (!this.el) return;
    this.el.empty();

    const header = this.el.createDiv({ cls: 'tw-comp-header' });
    header.createSpan({ cls: 'tw-comp-title', text: '手机竞品分析' });
    if (this.meta) {
      header.createSpan({ cls: 'tw-comp-meta', text: `数据 ${this.meta.count} 款 · 导出于 ${this.meta.exportedAt}` });
    }
    const reloadBtn = header.createEl('button', { cls: 'tw-comp-reload', title: '重新加载 phones.json' });
    reloadBtn.innerHTML = `${typeof getIconPark === 'function' ? getIconPark('refresh', 12) : '↻'} 重新加载`;
    reloadBtn.onclick = async () => {
      reloadBtn.classList.add('spinning');
      await this.loadData();
      reloadBtn.classList.remove('spinning');
      this.render();
    };

    if (this.loadError) {
      const empty = this.el.createDiv({ cls: 'tw-comp-empty' });
      empty.createDiv({ text: this.loadError });
      return;
    }

    this.renderFilterBar();
    this.renderKpis();
    this.el.createDiv({ cls: 'tw-comp-charts' });
    this.renderCharts();
    this.renderTable();
    this.renderCompare();
    this.renderDetail();
  }

  renderFilterBar() {
    const bar = this.el.createDiv({ cls: 'tw-comp-filterbar' });

    const chips = bar.createDiv({ cls: 'tw-comp-chips' });
    const brands = this.distinctCounts('brand');
    const mkChip = (label, value, count) => {
      const c = chips.createEl('button', { cls: `tw-comp-chip ${this.filters.brand === value ? 'active' : ''}` });
      c.textContent = count === undefined ? label : `${label} ${count}`;
      c.onclick = () => { this.filters.brand = value; this.render(); };
    };
    mkChip('全部', 'all');
    for (const [b, n] of brands) mkChip(b, b, n);

    const selects = bar.createDiv({ cls: 'tw-comp-selects' });
    const mkSelect = (label, key, options) => {
      const wrap = selects.createDiv({ cls: 'tw-comp-select-wrap' });
      wrap.createSpan({ cls: 'tw-comp-select-label', text: label });
      const sel = wrap.createEl('select', { cls: 'tw-comp-select' });
      for (const [val, txt] of options) {
        const opt = sel.createEl('option', { value: val, text: txt });
        if (this.filters[key] === val) opt.selected = true;
      }
      sel.onchange = () => { this.filters[key] = sel.value; this.render(); };
    };
    mkSelect('档位:', 'tier', [['all', '全部'], ...COMP_TIER_ORDER.map(t => [t, t])]);
    mkSelect('区域:', 'region', [['all', '全部'], ...this.distinctCounts('region').slice(0, 6).map(([r]) => [r, r])]);
    const years = [...new Set(this.phones.map(p => (p.releaseDate || '').slice(0, 4)).filter(y => y.length === 4))].sort().reverse();
    mkSelect('年份:', 'year', [['all', '全部'], ...years.map(y => [y, y])]);

    const kwInput = bar.createEl('input', { cls: 'tw-comp-search', type: 'text', placeholder: '搜型号 / 系列 / SoC...' });
    kwInput.value = this.filters.kw;
    let timer = 0;
    kwInput.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { this.filters.kw = kwInput.value.trim(); this.render(); }, 200);
    };

    const verLabel = bar.createEl('label', { cls: 'tw-comp-verified' });
    const verBox = verLabel.createEl('input', { type: 'checkbox' });
    verBox.checked = this.filters.verifiedOnly;
    verBox.onchange = () => { this.filters.verifiedOnly = verBox.checked; this.render(); };
    verLabel.createSpan({ text: '仅已核验' });
  }

  renderKpis() {
    const list = this.getFiltered();
    const row = this.el.createDiv({ cls: 'tw-comp-kpis' });
    const mk = (label, value, unit) => {
      const card = row.createDiv({ cls: 'tw-comp-kpi' });
      card.createDiv({ cls: 'tw-comp-kpi-val', text: String(value) });
      card.createDiv({ cls: 'tw-comp-kpi-label', text: unit ? `${label} (${unit})` : label });
    };
    mk('机型数', list.length);
    mk('品牌数', new Set(list.map(p => p.brand)).size);
    mk('电池中位', this.median(list.map(p => p.battery)), 'mAh');
    mk('快充峰值', Math.max(0, ...list.map(p => p.wiredW || 0)), 'W');
    mk('发布价中位', this.median(list.map(p => p.launchPrice)), '元');
  }

  /* ---------------- 图表 ---------------- */

  renderCharts() {
    const wrap = this.el ? this.el.querySelector('.tw-comp-charts') : null;
    if (!wrap) return;
    wrap.empty();
    const list = this.getFiltered();
    const W = Math.max(320, wrap.clientWidth || this._chartW || 640);
    this._chartW = W;
    const halfW = Math.max(280, Math.floor((W - 12) / 2));

    wrap.createDiv({ cls: 'tw-comp-chart-card', text: '' }).innerHTML = this.chartReleaseTimeline(list, halfW);
    wrap.createDiv({ cls: 'tw-comp-chart-card', text: '' }).innerHTML = this.chartBrandTier(list, halfW);
    wrap.createDiv({ cls: 'tw-comp-chart-card', text: '' }).innerHTML = this.chartHistogram(list, 'wiredW', '有线快充分布 (W)', [
      [0, 33, '<33'], [33, 66, '33-66'], [67, 100, '67-100'], [101, 150, '101-150'], [151, 999, '150+']
    ], halfW);
    wrap.createDiv({ cls: 'tw-comp-chart-card', text: '' }).innerHTML = this.chartHistogram(list, 'battery', '电池容量分布 (mAh)', [
      [0, 3999, '<4000'], [4000, 4999, '4000-5000'], [5000, 5999, '5000-6000'], [6000, 7999, '6000-8000'], [8000, 99999, '8000+']
    ], halfW);
  }

  svgFrame(W, H, inner) {
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;">${inner}</svg>`;
  }

  chartTitle(text) {
    return `<div class="tw-comp-chart-title">${text}</div>`;
  }

  tipPct(v, total) {
    if (!total) return '0%';
    const pct = (v / total) * 100;
    return (pct >= 10 ? Math.round(pct) : pct.toFixed(1)) + '%';
  }

  chartReleaseTimeline(list, W) {
    const H = 170;
    const buckets = new Map();
    for (const p of list) {
      const d = p.releaseDate || '';
      const m = /^(\d{4})-?(\d{2})?/.exec(d);
      if (!m) continue;
      const q = m[2] ? Math.floor((parseInt(m[2], 10) - 1) / 3) + 1 : 1;
      const key = `${m[1]}Q${q}`;
      if (!buckets.has(key)) buckets.set(key, {});
      const b = buckets.get(key);
      b[p.brand] = (b[p.brand] || 0) + 1;
    }
    const keys = [...buckets.keys()].sort();
    const title = this.chartTitle('发布节奏(季度 × 品牌)');
    if (!keys.length) return title + `<div class="tw-comp-chart-empty">暂无数据</div>`;
    const topBrands = this.distinctCounts('brand').slice(0, 5).map(([b]) => b);
    const colorOf = b => COMP_BRAND_COLORS[Math.max(0, topBrands.indexOf(b))] || '#94A3B8';
    const maxTotal = Math.max(...keys.map(k => Object.values(buckets.get(k)).reduce((a, b) => a + b, 0)));
    const baseY = H - 26, topY = 14;
    const bw = Math.min(34, Math.max(8, Math.floor((W - 60) / keys.length) - 6));
    let inner = '';
    keys.forEach((k, i) => {
      const x = 34 + i * ((W - 60) / keys.length) + ((W - 60) / keys.length - bw) / 2;
      let y = baseY;
      const b = buckets.get(k);
      for (const brand of topBrands) {
        const v = b[brand] || 0;
        if (!v) continue;
        const h = (v / maxTotal) * (baseY - topY);
        y -= h;
        inner += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="${colorOf(brand)}" rx="1.5" data-tip="${k} ${brand}: ${v} 款 (${this.tipPct(v, list.length)})"><title>${k} ${brand}: ${v}</title></rect>`;
      }
      const other = Object.entries(b).filter(([br]) => !topBrands.includes(br)).reduce((a, [, v]) => a + v, 0);
      if (other) {
        const h = (other / maxTotal) * (baseY - topY);
        y -= h;
        inner += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="#94A3B8" rx="1.5" data-tip="${k} 其他: ${other} 款 (${this.tipPct(other, list.length)})"><title>${k} 其他: ${other}</title></rect>`;
      }
      if (i % Math.ceil(keys.length / 8) === 0) {
        inner += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" font-size="8.5" text-anchor="middle" fill="var(--text-muted,#8b949e)" font-family="monospace">${k}</text>`;
      }
    });
    inner += `<line x1="30" y1="${baseY}" x2="${W - 10}" y2="${baseY}" stroke="var(--background-modifier-border,#E2E8F0)"/>`;
    const legend = topBrands.map(b => `<span><i style="background:${colorOf(b)}"></i>${b}</span>`).join('') + `<span><i style="background:#94A3B8"></i>其他</span>`;
    return title + `<div class="tw-comp-chart-body">${this.svgFrame(W, H, inner)}</div><div class="tw-comp-chart-legend">${legend}</div>`;
  }

  chartBrandTier(list, W) {
    const H = 170;
    const title = this.chartTitle('品牌 × 档位');
    const brands = [...new Set(list.map(p => p.brand))].map(b => [b, list.filter(p => p.brand === b).length]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!brands.length) return title + `<div class="tw-comp-chart-empty">暂无数据</div>`;
    const rowH = Math.min(20, Math.floor((H - 16) / brands.length));
    const maxV = Math.max(...brands.map(([, n]) => n));
    const barArea = W - 110;
    let inner = '';
    brands.forEach(([brand, total], i) => {
      const y = 8 + i * rowH + 2;
      const tiers = COMP_TIER_ORDER.map(t => [t, list.filter(p => p.brand === brand && p.tier === t).length]).filter(([, n]) => n > 0);
      let x = 76;
      inner += `<text x="72" y="${y + rowH / 2 - 2}" font-size="9" text-anchor="end" fill="var(--text-normal,#333)">${brand}</text>`;
      for (const [t, n] of tiers) {
        const w = (n / maxV) * (barArea - 40);
        inner += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rowH - 6}" fill="${COMP_TIER_COLORS[t] || '#94A3B8'}" rx="1.5" data-tip="${brand} · ${t}: ${n} 款 (${this.tipPct(n, total)})"><title>${brand} ${t}: ${n}</title></rect>`;
        x += w;
      }
      inner += `<text x="${x + 5}" y="${y + rowH / 2 - 2}" font-size="8.5" fill="var(--text-muted,#8b949e)" font-family="monospace">${total}</text>`;
    });
    const legend = COMP_TIER_ORDER.map(t => `<span><i style="background:${COMP_TIER_COLORS[t]}"></i>${t}</span>`).join('');
    return title + `<div class="tw-comp-chart-body">${this.svgFrame(W, H, inner)}</div><div class="tw-comp-chart-legend">${legend}</div>`;
  }

  chartHistogram(list, field, titleText, segments, W) {
    const H = 170;
    const title = this.chartTitle(titleText);
    const counts = segments.map(([lo, hi]) => list.filter(p => {
      const v = p[field];
      return typeof v === 'number' && v >= lo && v <= hi;
    }).length);
    const missing = list.length - counts.reduce((a, b) => a + b, 0);
    const maxV = Math.max(1, ...counts);
    const baseY = H - 26, topY = 16;
    const slot = (W - 50) / segments.length;
    const bw = Math.min(52, slot - 12);
    let inner = '';
    segments.forEach(([lo, hi, label], i) => {
      const v = counts[i];
      const h = (v / maxV) * (baseY - topY);
      const x = 34 + i * slot + (slot - bw) / 2;
      inner += `<rect x="${x.toFixed(1)}" y="${(baseY - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="#2563EB" opacity="0.75" rx="2" data-tip="${label}: ${v} 款 (${this.tipPct(v, list.length)})"><title>${label}: ${v}</title></rect>`;
      inner += `<text x="${(x + bw / 2).toFixed(1)}" y="${(baseY - h - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="var(--text-normal,#333)" font-family="monospace">${v}</text>`;
      inner += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" font-size="8.5" text-anchor="middle" fill="var(--text-muted,#8b949e)" font-family="monospace">${label}</text>`;
    });
    inner += `<line x1="30" y1="${baseY}" x2="${W - 10}" y2="${baseY}" stroke="var(--background-modifier-border,#E2E8F0)"/>`;
    const foot = missing > 0 ? `<div class="tw-comp-chart-legend"><span>未标注 ${missing} 款</span></div>` : '';
    return title + `<div class="tw-comp-chart-body">${this.svgFrame(W, H, inner)}</div>${foot}`;
  }

  /* ---------------- 表格 / 对比 / 详情 ---------------- */

  renderTable() {
    const list = this.getFiltered();
    const box = this.el.createDiv({ cls: 'tw-comp-tablewrap' });
    const table = box.createEl('table', { cls: 'tw-comp-table' });
    const thead = table.createEl('thead');
    const hrow = thead.createEl('tr');
    const cols = [
      ['model', '型号'], ['tier', '档位'], ['releaseDate', '发布'], ['soc', 'SoC'],
      ['battery', '电池'], ['wiredW', '有线'], ['wirelessW', '无线'], ['launchPrice', '发布价'], ['verifyStatus', '核验']
    ];
    hrow.createEl('th', { cls: 'tw-comp-th-cmp', text: '对比' });
    for (const [key, label] of cols) {
      const th = hrow.createEl('th', { cls: `tw-comp-th ${this.sortKey === key ? 'sorted' : ''}`, text: label + (this.sortKey === key ? (this.sortDesc ? ' ↓' : ' ↑') : '') });
      th.onclick = () => {
        if (this.sortKey === key) this.sortDesc = !this.sortDesc;
        else { this.sortKey = key; this.sortDesc = true; }
        this.render();
      };
    }
    const tbody = table.createEl('tbody');
    for (const p of list) {
      const tr = tbody.createEl('tr');
      const tdCmp = tr.createEl('td');
      const cb = tdCmp.createEl('input', { type: 'checkbox' });
      cb.checked = this.compareIds.includes(p.id);
      cb.onchange = () => {
        if (cb.checked) {
          if (this.compareIds.length >= 4) { cb.checked = false; return; }
          this.compareIds.push(p.id);
        } else {
          this.compareIds = this.compareIds.filter(id => id !== p.id);
        }
        this.renderCompare();
      };
      const tdModel = tr.createEl('td', { cls: 'tw-comp-td-model' });
      tdModel.createDiv({ cls: 'tw-comp-model', text: p.model || '(无名)' });
      tdModel.createDiv({ cls: 'tw-comp-sub', text: `${p.brand}${p.series ? ' · ' + p.series : ''}` });
      tr.createEl('td', { text: p.tier || '' });
      tr.createEl('td', { cls: 'tw-comp-mono', text: p.releaseDate || '' });
      tr.createEl('td', { text: p.soc || '' });
      tr.createEl('td', { cls: 'tw-comp-mono', text: p.battery !== null ? `${p.battery}` : '-' });
      tr.createEl('td', { cls: 'tw-comp-mono', text: p.wiredW !== null ? `${p.wiredW}W` : '-' });
      tr.createEl('td', { cls: 'tw-comp-mono', text: p.wirelessW !== null ? `${p.wirelessW}W` : '-' });
      tr.createEl('td', { cls: 'tw-comp-mono', text: p.launchPrice !== null ? `¥${p.launchPrice}` : '未发布' });
      const st = tr.createEl('td');
      const dotCls = p.verifyStatus === '已核验' ? 'ok' : (p.verifyStatus === '待核实' ? 'warn' : 'mute');
      st.innerHTML = `<span class="tw-comp-vdot ${dotCls}"></span>${p.verifyStatus}`;
      tr.onclick = (e) => {
        if (e.target.tagName === 'INPUT') return;
        this.detailPhone = p;
        this.renderDetail();
      };
    }
    if (!list.length) {
      box.createDiv({ cls: 'tw-comp-empty', text: '当前筛选无匹配机型' });
    }
  }

  renderCompare() {
    const old = this.el.querySelector('.tw-comp-compare');
    if (old) old.remove();
    if (!this.compareIds.length) return;
    const phones = this.compareIds.map(id => this.phones.find(p => p.id === id)).filter(Boolean);
    const box = this.el.createDiv({ cls: 'tw-comp-compare' });
    // 对比托盘始终位于机型表之后、详情面板之前
    const detailEl = this.el.querySelector('.tw-comp-detail');
    if (detailEl) this.el.insertBefore(box, detailEl);
    const head = box.createDiv({ cls: 'tw-comp-compare-head' });
    head.createSpan({ cls: 'tw-comp-title', text: `对比台 (${phones.length}/4)` });
    const clear = head.createEl('button', { cls: 'tw-comp-reload', text: '清空' });
    clear.onclick = () => { this.compareIds = []; this.render(); };

    const rows = [
      ['档位', p => p.tier], ['发布', p => p.releaseDate], ['区域', p => p.region], ['SoC', p => p.soc],
      ['电池 mAh', p => p.battery, 'max'], ['有线 W', p => p.wiredW, 'max'], ['无线 W', p => p.wirelessW, 'max'],
      ['屏幕', p => p.screen], ['RAM/ROM', p => `${p.ram} / ${p.rom}`],
      ['发布价', p => p.launchPrice, 'min'], ['现价', p => p.currentPrice, 'min'], ['核验', p => p.verifyStatus]
    ];
    const table = box.createEl('table', { cls: 'tw-comp-table tw-comp-compare-table' });
    const hrow = table.createEl('thead').createEl('tr');
    hrow.createEl('th', { text: '参数' });
    for (const p of phones) hrow.createEl('th', { text: p.model });
    const tbody = table.createEl('tbody');
    for (const [label, get, best] of rows) {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { cls: 'tw-comp-cmp-label', text: label });
      const vals = phones.map(get);
      let bestIdx = -1;
      if (best) {
        const nums = vals.map(v => typeof v === 'number' ? v : null);
        const target = best === 'max' ? Math.max(...nums.filter(v => v !== null)) : Math.min(...nums.filter(v => v !== null));
        if (nums.filter(v => v !== null).length) bestIdx = nums.indexOf(target);
      }
      vals.forEach((v, i) => {
        const td = tr.createEl('td', { text: v === null || v === undefined || v === '' ? '-' : String(v) });
        if (i === bestIdx) td.addClass('tw-comp-best');
      });
    }
  }

  renderDetail() {
    const old = this.el.querySelector('.tw-comp-detail');
    if (old) old.remove();
    if (!this.detailPhone) return;
    const p = this.detailPhone;
    const panel = this.el.createDiv({ cls: 'tw-comp-detail' });
    const head = panel.createDiv({ cls: 'tw-comp-detail-head' });
    head.createSpan({ cls: 'tw-comp-title', text: p.model || '(无名)' });
    const close = head.createEl('button', { cls: 'tw-comp-reload', text: '关闭' });
    close.onclick = () => { this.detailPhone = null; this.renderDetail(); };
    const fields = [
      ['品牌 / 子品牌', `${p.brand}${p.subBrand ? ' / ' + p.subBrand : ''}`], ['档位 / 系列', `${p.tier} / ${p.series || '-'}`],
      ['发布日期', p.releaseDate || '-'], ['区域', p.region || '-'], ['SoC', p.soc || '-'],
      ['电池', p.battery !== null ? `${p.battery} mAh` : '-'], ['有线快充', p.wiredW !== null ? `${p.wiredW} W` : '-'],
      ['无线快充', p.wirelessW !== null ? `${p.wirelessW} W` : '-'], ['屏幕', p.screen || '-'],
      ['RAM / ROM', `${p.ram || '-'} / ${p.rom || '-'}`], ['发布价', p.launchPrice !== null ? `¥${p.launchPrice}` : '未发布'],
      ['现价', p.currentPrice !== null ? `¥${p.currentPrice}` : '-'], ['核验状态', p.verifyStatus],
      ['备注', p.notes || '-'], ['更新于', p.updatedAt || '-']
    ];
    const body = panel.createDiv({ cls: 'tw-comp-detail-body' });
    for (const [k, v] of fields) {
      const row = body.createDiv({ cls: 'tw-comp-detail-row' });
      row.createSpan({ cls: 'tw-comp-detail-k', text: k });
      row.createSpan({ cls: 'tw-comp-detail-v', text: v });
    }
  }
}
