/* ==========================================================================
   WeKnora Wiki Graph View — 知识图谱交互与控制子视图
   核心功能:
   1. 首页「研发知识拓扑」同款 8 套主题视觉方案与实时力学微调配置面板
   2. 默认采用「石墨疏朗 (浅底灰阶 · 疏朗宁静)」高雅灰阶风格
   3. 核心节点排版策略 (Anti-Smear): 仅保留 Top 枢纽节点常显文字, 其余仅悬停显示
   4. 搜索防抖 (300ms) + 5 秒高亮缓存 + 关联拓扑高亮
   5. 节点上限截断控制 (100 / 200 / 300 / 500)
   6. Ego 专注模式状态机 (最多 30 个邻居, 支持无缝返回全图)
   7. 抽屉联动展示 Wiki 详情
   ========================================================================== */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class WeKnoraWikiGraphView {
  /**
   * @param {HTMLElement} parentEl
   * @param {object} options
   */
  constructor(parentEl, options = {}) {
    this.parentEl = parentEl;
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.service = options.service;
    this.getCurrentKbId = options.getCurrentKbId || (() => '');

    this.containerEl = null;
    this.graphEngine = null;
    this.wikiDrawer = null;
    this.tooltip = null;
    this.settingsPopover = null;

    // 数据与状态
    this.currentLimit = 300;
    this.graphData = null;
    this.backupFullGraphData = null; // 用于退出 Ego 模式时快速还原
    this.isEgoMode = false;
    this.egoCenterNode = null;
    this.searchKeyword = '';
    this.searchDebounceTimer = null;

    // 高亮缓存 (key -> { result: string[], timestamp: number })
    this.highlightCache = new Map();
    this.highlightCacheTtl = 5000;

    this.initDOM();
  }

  initDOM() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'tw-weknora-graph-view-wrap';
    this.parentEl.appendChild(this.containerEl);

    // 1. 顶部控制栏
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'tw-weknora-graph-toolbar';
    this.containerEl.appendChild(this.toolbarEl);

    // 2. Ego 模式提示横幅 (初始隐藏)
    this.egoBannerEl = document.createElement('div');
    this.egoBannerEl.className = 'tw-weknora-ego-banner';
    this.egoBannerEl.style.display = 'none';
    this.containerEl.appendChild(this.egoBannerEl);

    // 3. 画布容器
    this.canvasContainerEl = document.createElement('div');
    this.canvasContainerEl.className = 'tw-weknora-canvas-container';
    this.containerEl.appendChild(this.canvasContainerEl);

    // 4. 悬停 Tooltip 浮层
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tw-graph-tooltip';
    this.canvasContainerEl.appendChild(this.tooltip);

    // 5. 初始化图谱引擎 (默认使用石墨疏朗 graphite)
    this.graphEngine = new WeKnoraGraphEngine(this.canvasContainerEl, {
      onNodeClick: (node) => this.handleNodeClick(node),
      onNodeHover: (node, pos) => this.handleNodeHover(node, pos),
      onCanvasClick: () => this.handleCanvasClick()
    });

    // 6. 初始化侧边 Wiki 抽屉
    this.wikiDrawer = new WeKnoraWikiDrawer(this.containerEl, {
      app: this.app,
      service: this.service,
      onExpandEgo: (node) => this.enterEgoMode(node),
      onClose: () => {
        if (this.graphEngine) {
          this.graphEngine.selectedNode = null;
          this.graphEngine.requestRender();
        }
      }
    });

    // 7. 视觉与力学配置面板
    this.settingsPopover = document.createElement('div');
    this.settingsPopover.className = 'tw-graph-settings-popover';
    this.containerEl.appendChild(this.settingsPopover);
    this.renderSettingsPopover();

    // 渲染工具栏内容
    this.renderToolbar();

    // 监听全局事件
    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (this.settingsPopover?.classList.contains('open')) {
          this.settingsPopover.classList.remove('open');
        }
        if (this.wikiDrawer?.isOpen) this.wikiDrawer.close();
        if (this.searchKeyword) {
          const input = this.toolbarEl.querySelector('.tw-graph-search-input');
          if (input) input.value = '';
          this.handleSearch('');
        }
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    this._onDocClick = (e) => {
      const btn = this.toolbarEl?.querySelector('#btnGraphSettings');
      if (this.settingsPopover && this.settingsPopover.classList.contains('open')) {
        if (!this.settingsPopover.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
          this.settingsPopover.classList.remove('open');
        }
      }
    };
    document.addEventListener('click', this._onDocClick);
  }

  renderToolbar() {
    this.toolbarEl.innerHTML = `
      <div class="tw-graph-tb-left">
        <div class="tw-graph-search-box">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input type="text" class="tw-graph-search-input" placeholder="搜索 Wiki 实体 / 概念 (Enter 聚焦)..." value="${escapeHtml(this.searchKeyword)}" />
          <button class="tw-graph-search-clear" id="btnGraphSearchClear" title="清空搜索 (Esc)" style="display:${this.searchKeyword ? 'block' : 'none'};">✕</button>
        </div>
        <div class="tw-graph-limit-box" title="控制渲染节点数量, 减轻系统负载">
          <span style="font-size:11px; color:var(--text-muted);">显示上限:</span>
          <select class="tw-graph-limit-select" id="selGraphLimit">
            <option value="100" ${this.currentLimit === 100 ? 'selected' : ''}>100 节点</option>
            <option value="200" ${this.currentLimit === 200 ? 'selected' : ''}>200 节点</option>
            <option value="300" ${this.currentLimit === 300 ? 'selected' : ''}>300 节点 (推荐)</option>
            <option value="500" ${this.currentLimit === 500 ? 'selected' : ''}>500 节点 (高配)</option>
          </select>
        </div>
      </div>
      <div class="tw-graph-tb-right">
        <div class="tw-graph-legend" id="graphLegend">
          ${this.getLegendHtml()}
        </div>
        <div class="tw-graph-actions">
          <button class="tw-chip" id="btnGraphSettings" title="打开图谱视觉与力学配置 (主题、斥力、字号微调)">
            <span>⚙ 配置</span>
          </button>
          <button class="tw-chip" id="btnGraphCenter" title="居中还原画布">
            <span>🎯 适应屏幕</span>
          </button>
          <button class="tw-chip" id="btnGraphRefresh" title="重新从 WeKnora 获取图谱">
            <span>🔄 刷新</span>
          </button>
        </div>
      </div>
    `;

    // 绑定搜索与清除
    const searchInput = this.toolbarEl.querySelector('.tw-graph-search-input');
    const clearBtn = this.toolbarEl.querySelector('#btnGraphSearchClear');
    if (searchInput) {
      searchInput.oninput = (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
        this.debounceSearch(val);
      };
      searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          this.executeSearch(searchInput.value, true);
        }
      };
    }
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (searchInput) searchInput.value = '';
        clearBtn.style.display = 'none';
        this.handleSearch('');
      };
    }

    // 节点上限切换
    const limitSelect = this.toolbarEl.querySelector('#selGraphLimit');
    if (limitSelect) {
      limitSelect.onchange = () => {
        this.currentLimit = parseInt(limitSelect.value, 10) || 300;
        this.loadGraphData();
      };
    }

    // 配置弹窗切换
    const settingsBtn = this.toolbarEl.querySelector('#btnGraphSettings');
    if (settingsBtn) {
      settingsBtn.onclick = (e) => {
        e.stopPropagation();
        this.settingsPopover?.classList.toggle('open');
      };
    }

    // 适应屏幕居中
    const centerBtn = this.toolbarEl.querySelector('#btnGraphCenter');
    if (centerBtn) {
      centerBtn.onclick = () => {
        this.graphEngine?.centerGraph();
      };
    }

    // 刷新
    const refreshBtn = this.toolbarEl.querySelector('#btnGraphRefresh');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        this.loadGraphData().finally(() => refreshBtn.classList.remove('spinning'));
      };
    }
  }

  getLegendHtml() {
    const th = this.graphEngine?.currentTheme || 'graphite';
    if (th === 'graphite') {
      return `
        <span class="tw-legend-item"><span class="tw-legend-dot" style="background:#4B4B4B;"></span>核心枢纽 (度数≥6)</span>
        <span class="tw-legend-item"><span class="tw-legend-dot" style="background:#6F6F6F;"></span>骨干关联 (3-5)</span>
        <span class="tw-legend-item"><span class="tw-legend-dot" style="background:#9A9A9A;"></span>扇簇与外环 (1-2)</span>
      `;
    }
    return `
      <span class="tw-legend-item"><span class="tw-legend-dot" style="background:#2563EB;"></span>核心枢纽</span>
      <span class="tw-legend-item"><span class="tw-legend-dot" style="background:#0EA5E9;"></span>骨干分支</span>
      <span class="tw-legend-item"><span class="tw-legend-dot" style="background:#94A3B8;"></span>扇簇与外环</span>
    `;
  }

  updateLegend() {
    const legendEl = this.toolbarEl?.querySelector('#graphLegend');
    if (legendEl) {
      legendEl.innerHTML = this.getLegendHtml();
    }
  }

  // --------------------------------------------------------------------------
  // 图谱视觉与力学配置面板
  // --------------------------------------------------------------------------
  renderSettingsPopover() {
    if (!this.settingsPopover) return;
    const curTheme = this.graphEngine?.currentTheme || 'graphite';
    const params = this.graphEngine?.params || {
      clusterSpread: 1.0,
      repulsion: 800,
      nodeScale: 0.6,
      fontSize: 3,
      edgeOpacity: 0.50,
      clusterStrength: 0.08,
      centerForce: 0.005
    };

    const themeDescs = {
      graphite: '浅底灰阶 · 疏朗宁静',
      immersive: '浅色微光晕 · 科技质感'
    };

    this.settingsPopover.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--background-modifier-border, #E2E8F0); padding-bottom:6px; margin-bottom:8px;">
        <span style="font-weight:600; color:var(--text-normal, #0F172A); font-size:12px;">图谱视觉与力学配置</span>
        <span style="font-size:10px; color:var(--text-muted, #64748B); font-family:monospace;">Parameters & Theme</span>
      </div>

      <!-- 1. Theme Selection Dropdown (仅保留用户精选的双主题) -->
      <div style="margin-bottom:10px;">
        <div style="font-weight:600; font-size:11px; margin-bottom:5px; color:var(--text-normal, #0F172A); display:flex; justify-content:space-between; align-items:center;">
          <span>视觉方案选择</span>
          <span style="font-size:10px; color:var(--interactive-accent, #2563EB); font-weight:normal;" id="spActiveThemeDesc">${themeDescs[curTheme] || ''}</span>
        </div>
        <select class="tw-settings-theme-select" id="spThemeSelect">
          <option value="graphite" ${curTheme==='graphite'?'selected':''}>石墨疏朗 (浅底灰阶 · 疏朗宁静)</option>
          <option value="immersive" ${curTheme==='immersive'?'selected':''}>柔和科技沉浸 (浅色微光晕 · 科技质感)</option>
        </select>
      </div>

      <!-- 2. Topology Parameters Section -->
      <div style="border-top:1px solid var(--background-modifier-border, #E2E8F0); padding-top:8px; display:flex; flex-direction:column; gap:6px;">
        <div style="font-weight:600; font-size:11px; color:var(--text-normal, #0F172A); display:flex; justify-content:space-between;">
          <span>力学与视觉微调</span>
          <span style="font-size:10px; color:var(--text-muted, #64748B);">实时渲染生效</span>
        </div>

        <!-- Cluster Spread -->
        <div class="tw-setting-row" data-param="clusterSpread">
          <div class="tw-setting-label">
            <span class="tw-setting-title">簇群间距 (Cluster Spread)</span>
            <span id="valSpread" style="font-family:monospace; font-weight:600;">${params.clusterSpread}x</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngSpread" min="0.4" max="2.2" step="0.1" value="${params.clusterSpread}">
        </div>

        <!-- Repulsion -->
        <div class="tw-setting-row" data-param="repulsion">
          <div class="tw-setting-label">
            <span class="tw-setting-title">节点呼吸斥力 (Repulsion)</span>
            <span id="valRep" style="font-family:monospace; font-weight:600;">${params.repulsion}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngRep" min="40" max="1200" step="20" value="${params.repulsion}">
        </div>

        <!-- Node Scale -->
        <div class="tw-setting-row" data-param="nodeScale">
          <div class="tw-setting-label">
            <span class="tw-setting-title">节点大小缩放 (Node Scale)</span>
            <span id="valNodeScale" style="font-family:monospace; font-weight:600;">${params.nodeScale}x</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngNodeScale" min="0.4" max="2.2" step="0.1" value="${params.nodeScale}">
        </div>

        <!-- Font Size -->
        <div class="tw-setting-row" data-param="fontSize">
          <div class="tw-setting-label">
            <span class="tw-setting-title">图谱文字大小 (Font Size)</span>
            <span id="valFontSize" style="font-family:monospace; font-weight:600;">${params.fontSize || 3}px</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngFontSize" min="1" max="5" step="0.5" value="${params.fontSize || 3}">
        </div>

        <!-- Edge Opacity -->
        <div class="tw-setting-row" data-param="edgeOpacity">
          <div class="tw-setting-label">
            <span class="tw-setting-title">连线显隐粗细 (Edge Opacity)</span>
            <span id="valEdgeOpacity" style="font-family:monospace; font-weight:600;">${params.edgeOpacity}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngEdgeOpacity" min="0.1" max="1.0" step="0.05" value="${params.edgeOpacity}">
        </div>

        <!-- Cluster Force -->
        <div class="tw-setting-row" data-param="clusterStrength">
          <div class="tw-setting-label">
            <span class="tw-setting-title">向心聚合力 (Cluster Force)</span>
            <span id="valCluster" style="font-family:monospace; font-weight:600;">${params.clusterStrength}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngCluster" min="0.02" max="0.20" step="0.01" value="${params.clusterStrength}">
        </div>

        <!-- Center Force -->
        <div class="tw-setting-row" data-param="centerForce">
          <div class="tw-setting-label">
            <span class="tw-setting-title">全局居中力 (Center Pull)</span>
            <span id="valCenter" style="font-family:monospace; font-weight:600;">${params.centerForce}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngCenter" min="0.001" max="0.020" step="0.001" value="${params.centerForce}">
        </div>
      </div>

      <button class="tw-chip" id="btnResetPhysics" style="margin-top:8px; width:100%; text-align:center; padding:6px 0; justify-content:center; cursor:pointer;">
        恢复默认推荐参数
      </button>
    `;

    // 绑定主题切换
    const themeSelect = this.settingsPopover.querySelector('#spThemeSelect');
    if (themeSelect) {
      themeSelect.onchange = (e) => {
        const themeKey = e.target.value;
        this.graphEngine?.setTheme(themeKey);
        const descEl = this.settingsPopover.querySelector('#spActiveThemeDesc');
        if (descEl) descEl.textContent = themeDescs[themeKey] || '';
        this.updateLegend();
      };
    }

    // 绑定参数滑动条
    const bindSlider = (id, paramKey, valId, unit = '') => {
      const slider = this.settingsPopover.querySelector(`#${id}`);
      const valLabel = this.settingsPopover.querySelector(`#${valId}`);
      if (!slider || !valLabel) return;
      slider.oninput = (e) => {
        const num = parseFloat(e.target.value);
        valLabel.textContent = `${num}${unit}`;
        this.graphEngine?.setParams({ [paramKey]: num });
      };
    };

    bindSlider('rngSpread', 'clusterSpread', 'valSpread', 'x');
    bindSlider('rngRep', 'repulsion', 'valRep');
    bindSlider('rngNodeScale', 'nodeScale', 'valNodeScale', 'x');
    bindSlider('rngFontSize', 'fontSize', 'valFontSize', 'px');
    bindSlider('rngEdgeOpacity', 'edgeOpacity', 'valEdgeOpacity');
    bindSlider('rngCluster', 'clusterStrength', 'valCluster');
    bindSlider('rngCenter', 'centerForce', 'valCenter');

    // 恢复默认参数
    const resetBtn = this.settingsPopover.querySelector('#btnResetPhysics');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.graphEngine?.resetParams();
        this.renderSettingsPopover();
        this.updateLegend();
      };
    }
  }

  // --------------------------------------------------------------------------
  // 数据加载与状态处理
  // --------------------------------------------------------------------------
  async loadGraphData() {
    const kbId = this.getCurrentKbId();
    if (!kbId) return;

    this.renderLoadingPlaceholder('正在加载知识图谱...');
    try {
      if (!this.service) throw new Error('WeKnora 服务未就绪');
      const data = await this.service.getWikiGraph(kbId, this.currentLimit, 10000);

      this.graphData = data;
      this.isEgoMode = false;
      this.egoCenterNode = null;
      this.updateEgoBanner();

      this.graphEngine.setData(data);
      this.clearLoadingPlaceholder();

      // 若有搜索词则重新应用高亮
      if (this.searchKeyword) {
        this.executeSearch(this.searchKeyword, false);
      }
    } catch (err) {
      console.warn('[WeKnora] 拉取图谱失败, 尝试读取磁盘缓存:', err);
      const cached = this.tryLoadDiskCache();
      if (cached && cached.nodes && cached.nodes.length) {
        this.graphData = cached;
        this.graphEngine.setData(cached);
        this.clearLoadingPlaceholder();
      } else {
        this.renderErrorPlaceholder(err.message || String(err));
      }
    }
  }

  tryLoadDiskCache() {
    try {
      if (typeof require !== 'undefined') {
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app?.vault?.adapter?.basePath || '';
        const p = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', 'weknora-graph-cache.json');
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
      }
    } catch (e) {}
    return null;
  }

  renderLoadingPlaceholder(text) {
    let el = this.containerEl.querySelector('.tw-graph-placeholder');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tw-graph-placeholder';
      this.containerEl.appendChild(el);
    }
    el.innerHTML = `
      <div class="tw-drawer-spinner" style="margin-bottom:12px;"></div>
      <div style="font-size:13px; color:var(--text-muted);">${escapeHtml(text)}</div>
    `;
    el.style.display = 'flex';
  }

  clearLoadingPlaceholder() {
    const el = this.containerEl.querySelector('.tw-graph-placeholder');
    if (el) el.style.display = 'none';
  }

  renderErrorPlaceholder(errMsg) {
    let el = this.containerEl.querySelector('.tw-graph-placeholder');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tw-graph-placeholder';
      this.containerEl.appendChild(el);
    }
    el.innerHTML = `
      <div style="font-size:28px; margin-bottom:8px;">⚠️</div>
      <div style="font-size:14px; font-weight:600; color:#EF4444; margin-bottom:6px;">图谱加载受阻</div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:16px; font-family:monospace;">${escapeHtml(errMsg)}</div>
      <button class="tw-chip" id="btnGraphRetry" style="padding:6px 18px; cursor:pointer;">重试连接</button>
    `;
    el.style.display = 'flex';
    const retryBtn = el.querySelector('#btnGraphRetry');
    if (retryBtn) retryBtn.onclick = () => this.loadGraphData();
  }

  // --------------------------------------------------------------------------
  // 搜索防抖与高亮缓存
  // --------------------------------------------------------------------------
  debounceSearch(val) {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.handleSearch(val);
    }, 300);
  }

  handleSearch(val) {
    this.searchKeyword = (val || '').trim();
    this.executeSearch(this.searchKeyword, false);
  }

  executeSearch(keyword, shouldFocusFirst = false) {
    if (!keyword) {
      this.graphEngine?.clearHighlight();
      return;
    }

    const norm = keyword.toLowerCase();

    // 检查高亮缓存
    const now = Date.now();
    const cached = this.highlightCache.get(norm);
    let matchedIds = [];

    if (cached && (now - cached.timestamp < this.highlightCacheTtl)) {
      matchedIds = cached.result;
    } else {
      // 智能分级排序优化:
      // Tier 1: 精确匹配标题或 slug (1000 分 + 度数权重)
      // Tier 2: 标题前缀匹配 (500 分 + 度数权重)
      // Tier 3: 词内子串匹配 (100 分 + 度数权重)
      const allNodes = this.graphEngine?.nodes || [];
      const scoreNode = (n) => {
        const t = (n.title || '').toLowerCase();
        const s = (n.slug || '').toLowerCase();
        if (t === norm || s === norm) return 1000 + (n.degree || 0);
        if (t.startsWith(norm) || s.startsWith(norm)) return 500 + (n.degree || 0);
        if (t.includes(norm) || s.includes(norm)) return 100 + (n.degree || 0);
        return 0;
      };

      const scored = allNodes
        .map(n => ({ id: n.id, score: scoreNode(n) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      // 严格截断: 主搜索目标限制取最相关的 Top 3~5 个核心实体 (防止数十个泛匹配节点导致全图大面积爆亮)
      matchedIds = scored.slice(0, 5).map(item => item.id);

      this.highlightCache.set(norm, { result: matchedIds, timestamp: now });
    }

    this.graphEngine?.setHighlightedNodes(matchedIds);

    if (shouldFocusFirst && matchedIds.length > 0) {
      this.graphEngine?.focusNode(matchedIds[0]);
      const node = this.graphEngine?.nodeMap?.get(matchedIds[0]);
      if (node) this.handleNodeClick(node);
    }
  }

  // --------------------------------------------------------------------------
  // Ego 专注模式
  // --------------------------------------------------------------------------
  async enterEgoMode(centerNode) {
    if (!centerNode) return;
    const kbId = this.getCurrentKbId();
    if (!kbId) return;

    this.renderLoadingPlaceholder(`正在构建「${centerNode.title}」的 Ego 关联子图...`);

    if (!this.isEgoMode) {
      this.backupFullGraphData = this.graphData;
    }

    try {
      const egoData = await this.service.getWikiEgo(kbId, centerNode.slug, 30, 1, 8000);

      this.isEgoMode = true;
      this.egoCenterNode = centerNode;
      this.graphData = egoData;

      this.graphEngine.setData(egoData);
      this.graphEngine.focusNode(centerNode.id);
      this.clearLoadingPlaceholder();

      this.updateEgoBanner();
    } catch (err) {
      new Notice(`Ego 模式展开失败: ${err.message}`);
      this.clearLoadingPlaceholder();
    }
  }

  exitEgoMode() {
    if (!this.isEgoMode) return;
    this.isEgoMode = false;
    this.egoCenterNode = null;
    this.updateEgoBanner();

    if (this.backupFullGraphData) {
      this.graphData = this.backupFullGraphData;
      this.graphEngine.setData(this.backupFullGraphData);
      this.backupFullGraphData = null;
    } else {
      this.loadGraphData();
    }
  }

  updateEgoBanner() {
    if (!this.isEgoMode || !this.egoCenterNode) {
      this.egoBannerEl.style.display = 'none';
      return;
    }
    const node = this.egoCenterNode;
    const neighborCount = Math.max(0, (this.graphEngine?.nodes?.length || 1) - 1);
    this.egoBannerEl.innerHTML = `
      <div class="tw-ego-banner-content">
        <span class="tw-ego-badge">🎯 Ego 专注模式</span>
        <span class="tw-ego-title">中心节点: <strong>${escapeHtml(node.title)}</strong> (展示关联: ${neighborCount} 项)</span>
      </div>
      <button class="tw-ego-exit-btn" id="btnExitEgoMode" title="退出 Ego 模式，返回全库宏观图谱">
        <span>← 返回全局图谱</span>
      </button>
    `;
    this.egoBannerEl.style.display = 'flex';

    const exitBtn = this.egoBannerEl.querySelector('#btnExitEgoMode');
    if (exitBtn) exitBtn.onclick = () => this.exitEgoMode();
  }

  // --------------------------------------------------------------------------
  // 点击与交互处理
  // --------------------------------------------------------------------------
  handleNodeClick(node) {
    const kbId = this.getCurrentKbId();
    this.wikiDrawer?.open(node, kbId);
  }

  handleNodeHover(node, pos) {
    if (!this.tooltip) return;
    if (!node || !pos) {
      this.tooltip.style.display = 'none';
      return;
    }

    const wrapRect = this.canvasContainerEl.getBoundingClientRect();
    const x = Math.min(pos.clientX - wrapRect.left + 14, wrapRect.width - 240);
    const y = Math.min(pos.clientY - wrapRect.top + 14, wrapRect.height - 85);

    const titleText = node.displayName || node.title || node.slug;
    this.tooltip.innerHTML = `
      <div style="font-weight:600; color:#1E293B; margin-bottom:3px; font-size:11.5px; line-height:1.3;">${escapeHtml(titleText)}</div>
      <div style="font-size:10px; color:#64748B; margin-bottom:4px; font-family:monospace; display:flex; gap:6px; align-items:center;">
        <span class="tw-type-tag" style="padding:1px 5px; border-radius:3px; background:#F1F5F9; color:#475569; border:1px solid #E2E8F0; font-weight:600;">${escapeHtml(node.pageType || 'entity')}</span>
        <span>关联度数: <strong style="color:#0F172A;">${node.degree || 0}</strong></span>
      </div>
      ${node.summary ? `<div style="font-size:10.5px; color:#475569; line-height:1.35; max-height:44px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(node.summary)}</div>` : ''}
    `;
    this.tooltip.style.left = `${Math.max(10, x)}px`;
    this.tooltip.style.top = `${Math.max(10, y)}px`;
    this.tooltip.style.display = 'block';
  }

  handleCanvasClick() {
    if (this.tooltip) this.tooltip.style.display = 'none';
  }

  resize() {
    this.graphEngine?.resize();
  }

  dispose() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this._onDocClick) {
      document.removeEventListener('click', this._onDocClick);
      this._onDocClick = null;
    }
    this.highlightCache.clear();
    this.graphEngine?.dispose();
    this.wikiDrawer?.dispose();
    this.containerEl?.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraWikiGraphView };
}
