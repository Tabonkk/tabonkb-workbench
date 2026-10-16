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

function escapeAttr(str) {
  return escapeHtml(str);
}

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(56, 189, 248, ${alpha})`;
  if (hex.startsWith('rgba')) return hex;
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 银河全景雷达导航仪 HUD (Spaceship Galaxy Radar Mini-map)
 * 具备微缩星系点阵拓扑、摄像机实时视锥取景框以及点击/拖拽空间飞跃能力
 */
class WeKnoraGraphRadar {
  /**
   * @param {HTMLElement} parentEl - 画布容器
   * @param {WeKnoraGraphEngine} graphEngine - 图谱引擎
   */
  constructor(parentEl, graphEngine) {
    this.parentEl = parentEl;
    this.graphEngine = graphEngine;
    this.isCollapsed = false;
    this.radarWidth = 140;
    this.radarHeight = 100;
    this.radarEl = null;
    this.canvasEl = null;
    this.radarCtx = null;
    this._isDragging = false;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.radarEl = document.createElement('div');
    this.radarEl.className = 'tw-graph-radar-hud';
    this.radarEl.innerHTML = `
      <div class="tw-radar-header" title="点击折叠/展开银河全景雷达">
        <div class="tw-radar-title-wrap">
          <span class="tw-radar-blip"></span>
          <span class="tw-radar-title">RADAR</span>
        </div>
        <button class="tw-radar-toggle-btn" id="btnToggleRadar" title="折叠/展开">─</button>
      </div>
      <div class="tw-radar-body">
        <canvas class="tw-radar-canvas" width="${this.radarWidth}" height="${this.radarHeight}"></canvas>
      </div>
    `;
    this.parentEl.appendChild(this.radarEl);

    this.canvasEl = this.radarEl.querySelector('.tw-radar-canvas');
    this.radarCtx = this.canvasEl.getContext('2d');
  }

  bindEvents() {
    const toggleBtn = this.radarEl.querySelector('#btnToggleRadar');
    const headerEl = this.radarEl.querySelector('.tw-radar-header');

    const doToggle = (e) => {
      e.stopPropagation();
      this.isCollapsed = !this.isCollapsed;
      this.radarEl.classList.toggle('collapsed', this.isCollapsed);
      if (toggleBtn) toggleBtn.textContent = this.isCollapsed ? '⤢' : '─';
      if (!this.isCollapsed) this.render();
    };

    if (toggleBtn) toggleBtn.onclick = doToggle;
    if (headerEl) headerEl.onclick = doToggle;

    // 点击与拖拽雷达小地图触发空间跃迁
    this.canvasEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._isDragging = true;
      this.handleRadarInteraction(e);
    });

    this._onWindowMouseMove = (e) => {
      if (this._isDragging && !this.isCollapsed) {
        this.handleRadarInteraction(e);
      }
    };
    this._onWindowMouseUp = () => {
      this._isDragging = false;
    };

    window.addEventListener('mousemove', this._onWindowMouseMove);
    window.addEventListener('mouseup', this._onWindowMouseUp);

    // 挂载到引擎渲染流水线完成钩子
    if (this.graphEngine) {
      this.graphEngine.onRenderCallback = () => {
        if (!this.isCollapsed) {
          this.render();
        }
      };
    }
  }

  handleRadarInteraction(e) {
    if (!this.canvasEl || !this.graphEngine) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const rx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ry = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const bounds = this.graphEngine.getGraphBounds();
    const cw = this.radarWidth;
    const ch = this.radarHeight;

    const scale = Math.min((cw - 18) / bounds.width, (ch - 18) / bounds.height);
    const offsetX = (cw - bounds.width * scale) / 2;
    const offsetY = (ch - bounds.height * scale) / 2;

    const worldX = bounds.minX + (rx - offsetX) / scale;
    const worldY = bounds.minY + (ry - offsetY) / scale;

    this.graphEngine.flyToWorld(worldX, worldY, 400);
  }

  render() {
    if (this.isCollapsed || !this.radarCtx || !this.graphEngine) return;
    const ctx = this.radarCtx;
    const cw = this.radarWidth;
    const ch = this.radarHeight;

    ctx.clearRect(0, 0, cw, ch);

    const bounds = this.graphEngine.getGraphBounds();
    const scale = Math.min((cw - 18) / bounds.width, (ch - 18) / bounds.height);
    const offsetX = (cw - bounds.width * scale) / 2;
    const offsetY = (ch - bounds.height * scale) / 2;

    const toRadarX = (wx) => offsetX + (wx - bounds.minX) * scale;
    const toRadarY = (wy) => offsetY + (wy - bounds.minY) * scale;

    const th = this.graphEngine.currentTheme || 'cosmic';

    // 1. 战术雷达网格背景
    ctx.save();
    ctx.strokeStyle = (th === 'cosmic') ? 'rgba(56, 189, 248, 0.14)' : 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 0.5;

    // 十字刻度线
    const midX = cw / 2;
    const midY = ch / 2;
    ctx.beginPath();
    ctx.moveTo(midX, 4); ctx.lineTo(midX, ch - 4);
    ctx.moveTo(4, midY); ctx.lineTo(cw - 4, midY);
    ctx.stroke();

    // 距离同心圆环
    ctx.beginPath();
    ctx.arc(midX, midY, Math.min(cw, ch) * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2. 绘制微缩星系点阵
    const nodes = this.graphEngine.nodes || [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      const rx = toRadarX(n.x);
      const ry = toRadarY(n.y);
      if (rx < 0 || rx > cw || ry < 0 || ry > ch) continue;

      const isCore = n.isCoreAnchor || (n.degree && n.degree >= 6);
      ctx.fillStyle = n.color || ((th === 'cosmic') ? '#38BDF8' : '#2563EB');
      ctx.globalAlpha = isCore ? 0.95 : 0.60;
      ctx.beginPath();
      ctx.arc(rx, ry, isCore ? 1.8 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 绘制当前视野视锥取景框 (Camera Frustum Box)
    const vp = this.graphEngine.getWorldViewport();
    const rx1 = toRadarX(vp.left);
    const ry1 = toRadarY(vp.top);
    const rx2 = toRadarX(vp.right);
    const ry2 = toRadarY(vp.bottom);

    const bx = Math.max(0, Math.min(rx1, rx2));
    const by = Math.max(0, Math.min(ry1, ry2));
    const bw = Math.min(cw, Math.abs(rx2 - rx1));
    const bh = Math.min(ch, Math.abs(ry2 - ry1));

    ctx.save();
    ctx.strokeStyle = (th === 'cosmic') ? '#38BDF8' : '#2563EB';
    ctx.lineWidth = 1.2;
    ctx.fillStyle = (th === 'cosmic') ? 'rgba(56, 189, 248, 0.16)' : 'rgba(37, 99, 235, 0.12)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    // 视野中心十字微准星
    const vcx = bx + bw / 2;
    const vcy = by + bh / 2;
    if (vcx >= 0 && vcx <= cw && vcy >= 0 && vcy <= ch) {
      ctx.strokeStyle = (th === 'cosmic') ? '#BAE6FD' : '#1D4ED8';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(vcx - 3, vcy); ctx.lineTo(vcx + 3, vcy);
      ctx.moveTo(vcx, vcy - 3); ctx.lineTo(vcx, vcy + 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  dispose() {
    if (this._onWindowMouseMove) {
      window.removeEventListener('mousemove', this._onWindowMouseMove);
      this._onWindowMouseMove = null;
    }
    if (this._onWindowMouseUp) {
      window.removeEventListener('mouseup', this._onWindowMouseUp);
      this._onWindowMouseUp = null;
    }
    if (this.graphEngine && this.graphEngine.onRenderCallback) {
      this.graphEngine.onRenderCallback = null;
    }
    this.radarEl?.remove();
    this.radarEl = null;
    this.canvasEl = null;
    this.radarCtx = null;
  }
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
    this.getKnowledgeBases = options.getKnowledgeBases || (() => []);
    this.getConnectionStatus = options.getConnectionStatus || (() => ({ ok: true, latencyMs: 0, checking: false }));
    this.onCheckConnection = options.onCheckConnection || (() => {});
    this.onKnowledgeBaseChanged = options.onKnowledgeBaseChanged || (() => {});
    this.onOpenExternal = options.onOpenExternal || (() => {});
    this.onOpenSettings = options.onOpenSettings || (() => {});

    this.containerEl = null;
    this.graphEngine = null;
    this.wikiDrawer = null;
    this.tooltip = null;
    this.radarHud = null;
    this.settingsPopover = null;

    // 数据与状态
    this.currentLimit = 300;
    this.graphData = null;
    this.backupFullGraphData = null; // 用于退出 Ego 模式时快速还原
    this.isEgoMode = false;
    this.egoCenterNode = null;
    this.searchKeyword = '';
    this.searchDebounceTimer = null;
    this.isSearchExpanded = false;

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

    // 2. 画布容器
    this.canvasContainerEl = document.createElement('div');
    this.canvasContainerEl.className = 'tw-weknora-canvas-container';
    this.containerEl.appendChild(this.canvasContainerEl);

    // 3. 悬停 Tooltip 浮层
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tw-graph-tooltip';
    this.canvasContainerEl.appendChild(this.tooltip);

    // 4. 初始化图谱引擎 (默认使用科技星云 immersive)
    this.graphEngine = new WeKnoraGraphEngine(this.canvasContainerEl, {
      onNodeClick: (node) => this.handleNodeClick(node),
      onNodeHover: (node, pos) => this.handleNodeHover(node, pos),
      onCanvasClick: () => this.handleCanvasClick()
    });
    const defaultTheme = this.graphEngine?.currentTheme || 'immersive';
    this.canvasContainerEl.dataset.theme = defaultTheme;
    this.containerEl.dataset.theme = defaultTheme;

    // 4.5 初始化银河全景雷达导航仪 HUD
    this.radarHud = new WeKnoraGraphRadar(this.canvasContainerEl, this.graphEngine);

    // 5. 初始化侧边 Wiki 抽屉
    this.wikiDrawer = new WeKnoraWikiDrawer(this.containerEl, {
      app: this.app,
      service: this.service,
      onExpandEgo: (node) => this.enterEgoMode(node),
      onExitEgo: () => this.exitEgoMode(),
      onClose: () => {
        if (this.graphEngine) {
          this.graphEngine.selectedNode = null;
          this.graphEngine.viewportPaddingRight = 0;
          this.graphEngine.fitBounds(0.96, true);
          this.graphEngine.requestRender();
        }
      },
      onDrawerStateChange: (isOpen) => {
        if (this.graphEngine) {
          this.graphEngine.viewportPaddingRight = isOpen ? 380 : 0;
        }
      }
    });

    // 6. 视觉与力学配置面板
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
          const input = this.toolbarEl?.querySelector('.tw-graph-search-input');
          if (input) input.value = '';
          this.handleSearch('');
        }
        if (this.isSearchExpanded) {
          this.isSearchExpanded = false;
          this.toolbarEl?.querySelector('#graphSearchHud')?.classList.remove('expanded');
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
      const searchHud = this.toolbarEl?.querySelector('#graphSearchHud');
      if (searchHud && this.isSearchExpanded && !this.searchKeyword) {
        if (!searchHud.contains(e.target)) {
          this.isSearchExpanded = false;
          searchHud.classList.remove('expanded');
        }
      }
    };
    document.addEventListener('click', this._onDocClick);
  }

  renderToolbar() {
    const st = this.getConnectionStatus ? this.getConnectionStatus() : { ok: true, latencyMs: 0, checking: false };
    let statusDotColor = '#10B981';
    let statusText = `${st.latencyMs || 0}ms`;
    if (st.checking) {
      statusDotColor = '#F59E0B';
      statusText = '检测中...';
    } else if (!st.ok) {
      statusDotColor = '#EF4444';
      statusText = '离线';
    }

    this.toolbarEl.innerHTML = `
      <div class="tw-graph-tb-left">
        <div class="tw-graph-search-hud ${this.isSearchExpanded ? 'expanded' : ''}" id="graphSearchHud">
          <button class="tw-graph-search-toggle-btn" id="btnGraphSearchToggle" title="搜索 Wiki 实体 / 概念">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </button>
          <div class="tw-graph-search-input-wrap">
            <input type="text" class="tw-graph-search-input" id="graphSearchInput" placeholder="搜索 Wiki 实体 / 概念 (Enter 聚焦)..." value="${escapeHtml(this.searchKeyword)}" />
            <button class="tw-graph-search-clear" id="btnGraphSearchClear" title="清空搜索 (Esc)" style="display:${this.searchKeyword ? 'inline-flex' : 'none'};">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="tw-graph-search-dropdown" id="graphSearchDropdown" style="display:none;"></div>
        </div>
        <div class="tw-graph-ego-hud" id="graphEgoHud" style="display:${this.isEgoMode && this.egoCenterNode ? 'inline-flex' : 'none'};">
          <span class="tw-graph-ego-badge">⚡ 专注</span>
          <span class="tw-graph-ego-title" id="graphEgoTitle" title="${this.egoCenterNode ? escapeAttr(this.egoCenterNode.title) : ''}">中心: <strong>${this.egoCenterNode ? escapeHtml(this.egoCenterNode.title) : ''}</strong></span>
          <button class="tw-graph-ego-exit-btn" id="btnExitEgoMode" title="退出专注模式">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="tw-graph-tb-right">
        <div class="tw-graph-hud-pill">
          <div class="tw-manage-conn-badge" id="btnGraphConnRefresh" title="WeKnora 服务 (点击重新检测)">
            <span class="tw-manage-dot" style="background:${statusDotColor};"></span>
            <span class="tw-manage-conn-latency">${statusText}</span>
          </div>
          <div class="tw-graph-divider"></div>
          <button class="tw-chip tw-chip-subtle" id="btnGraphCenter" title="居中还原画布">
            <span>🎯 居中</span>
          </button>
          <button class="tw-chip tw-chip-subtle" id="btnGraphRefresh" title="重新从 WeKnora 获取图谱">
            <span>🔄 刷新</span>
          </button>
          <button class="tw-chip tw-chip-subtle" id="btnGraphSettings" title="打开图谱配置">
            <span>⚙ 配置</span>
          </button>
          <div class="tw-graph-divider"></div>
          <button class="tw-chip tw-chip-icon tw-chip-subtle" id="btnGraphOpenExternal" title="在系统默认浏览器中打开当前知识库">
            <span>↗</span>
          </button>
        </div>
      </div>
    `;

    // 绑定连接重新检测
    const connBtn = this.toolbarEl.querySelector('#btnGraphConnRefresh');
    if (connBtn) {
      connBtn.onclick = () => {
        if (this.onCheckConnection) this.onCheckConnection(true);
      };
    }

    // 绑定 Ego 专注模式退出
    const egoExitBtn = this.toolbarEl.querySelector('#btnExitEgoMode');
    if (egoExitBtn) {
      egoExitBtn.onclick = (e) => {
        e.stopPropagation();
        this.exitEgoMode();
      };
    }

    // 绑定搜索与展开/收起
    const searchHud = this.toolbarEl.querySelector('#graphSearchHud');
    const searchToggleBtn = this.toolbarEl.querySelector('#btnGraphSearchToggle');
    const searchInput = this.toolbarEl.querySelector('.tw-graph-search-input');
    const clearBtn = this.toolbarEl.querySelector('#btnGraphSearchClear');

    if (searchToggleBtn && searchHud && searchInput) {
      searchToggleBtn.onclick = (e) => {
        e.stopPropagation();
        this.isSearchExpanded = !this.isSearchExpanded;
        searchHud.classList.toggle('expanded', this.isSearchExpanded);
        if (this.isSearchExpanded) {
          searchInput.focus();
        } else if (!this.searchKeyword) {
          // 收起无搜索词
        } else {
          this.executeSearch(searchInput.value, true);
        }
      };
    }

    if (searchInput) {
      searchInput.onfocus = () => {
        if (!this.isSearchExpanded) {
          this.isSearchExpanded = true;
          searchHud?.classList.add('expanded');
        }
      };
      searchInput.oninput = (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
        this.debounceSearch(val);
      };
      searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          this.executeSearch(searchInput.value, true);
        } else if (e.key === 'Escape') {
          this.hideSearchDropdown();
          if (this.isSearchExpanded && !searchInput.value) {
            this.isSearchExpanded = false;
            searchHud?.classList.remove('expanded');
          }
        }
      };
    }
    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        clearBtn.style.display = 'none';
        this.hideSearchDropdown();
        this.handleSearch('');
      };
    }

    // 点击搜索框外区域自动关闭推荐浮层
    this._onDocClickCloseSearch = (e) => {
      if (!this.toolbarEl?.querySelector('#graphSearchHud')?.contains(e.target)) {
        this.hideSearchDropdown();
      }
    };
    document.addEventListener('click', this._onDocClickCloseSearch);

    // 居中还原
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

    // 配置弹窗切换
    const settingsBtn = this.toolbarEl.querySelector('#btnGraphSettings');
    if (settingsBtn) {
      settingsBtn.onclick = (e) => {
        e.stopPropagation();
        this.settingsPopover?.classList.toggle('open');
      };
    }

    // 外部浏览器打开
    const extBtn = this.toolbarEl.querySelector('#btnGraphOpenExternal');
    if (extBtn) {
      extBtn.onclick = () => {
        if (this.onOpenExternal) this.onOpenExternal();
      };
    }
  }

  updateConnStatus() {
    if (!this.toolbarEl) return;
    const st = this.getConnectionStatus ? this.getConnectionStatus() : { ok: true, latencyMs: 0, checking: false };
    let statusDotColor = '#10B981';
    let statusText = `${st.latencyMs || 0}ms`;
    if (st.checking) {
      statusDotColor = '#F59E0B';
      statusText = '检测中...';
    } else if (!st.ok) {
      statusDotColor = '#EF4444';
      statusText = '离线';
    }

    const dotEl = this.toolbarEl.querySelector('.tw-manage-dot');
    if (dotEl) dotEl.style.background = statusDotColor;
    const latencyEl = this.toolbarEl.querySelector('.tw-manage-conn-latency');
    if (latencyEl) latencyEl.textContent = statusText;

    // 同步配置弹窗内的知识库选择下拉列表
    const kbs = this.getKnowledgeBases ? this.getKnowledgeBases() : [];
    const curKbId = this.getCurrentKbId ? this.getCurrentKbId() : '';
    const kbSelect = this.settingsPopover?.querySelector('#spKbSelect');
    if (kbSelect && kbs.length > 0) {
      const currentSelected = kbSelect.value;
      kbSelect.innerHTML = kbs.map(k => {
        return `<option value="${escapeAttr(k.id)}" ${k.id === (curKbId || currentSelected) ? 'selected' : ''}>${escapeHtml(k.name || k.id)}</option>`;
      }).join('');
    }
  }

  getLegendHtml() {
    return '';
  }

  updateLegend() {
    // 兼容调用: 图谱已全面升级多彩天体光谱, 不再占用工具栏显示过时度数图例
  }

  // --------------------------------------------------------------------------
  // 图谱视觉与力学配置面板
  // --------------------------------------------------------------------------
  renderSettingsPopover() {
    if (!this.settingsPopover) return;
    const curTheme = this.graphEngine?.currentTheme || 'immersive';
    const params = this.graphEngine?.params || {
      clusterSpread: 1.15,
      repulsion: 1800,
      nodeScale: 0.75,
      fontSize: 3.2,
      edgeOpacity: 0.50,
      clusterStrength: 0.07,
      centerForce: 0.003
    };

    const themeDescs = {
      immersive: '科技星云 · 微光蓝调',
      cosmic: '深空星系 · 瑰丽沉浸',
      graphite: '石墨银河 · 疏朗纸墨'
    };

    const kbs = this.getKnowledgeBases ? this.getKnowledgeBases() : [];
    const curKbId = this.getCurrentKbId ? this.getCurrentKbId() : '';
    let kbOptionsHtml = '';
    if (kbs.length > 0) {
      kbOptionsHtml = kbs.map(k => {
        return `<option value="${escapeAttr(k.id)}" ${k.id === curKbId ? 'selected' : ''}>${escapeHtml(k.name || k.id)}</option>`;
      }).join('');
    } else {
      kbOptionsHtml = `<option value="${escapeAttr(curKbId)}">TabonKB</option>`;
    }

    this.settingsPopover.innerHTML = `
      <div class="tw-popover-header">
        <span class="tw-popover-title">图谱配置</span>
        <span class="tw-popover-subtitle">Config</span>
      </div>

      <!-- 1. 知识库选择 (TabonKB) -->
      <div class="tw-popover-row">
        <span class="tw-popover-label">知识库</span>
        <select class="tw-popover-select" id="spKbSelect">
          ${kbOptionsHtml}
        </select>
      </div>

      <!-- 2. 节点数量上限 -->
      <div class="tw-popover-row">
        <span class="tw-popover-label">节点上限</span>
        <select class="tw-popover-select" id="spLimitSelect">
          <option value="100" ${this.currentLimit === 100 ? 'selected' : ''}>100 节点</option>
          <option value="300" ${this.currentLimit === 300 ? 'selected' : ''}>300 节点</option>
          <option value="500" ${this.currentLimit === 500 ? 'selected' : ''}>500 节点</option>
          <option value="800" ${this.currentLimit === 800 ? 'selected' : ''}>800 节点</option>
          <option value="1000" ${this.currentLimit === 1000 ? 'selected' : ''}>1000 节点</option>
          <option value="1500" ${this.currentLimit === 1500 ? 'selected' : ''}>1500 节点</option>
          <option value="2000" ${this.currentLimit === 2000 ? 'selected' : ''}>2000 节点</option>
        </select>
      </div>

      <!-- 3. 视觉样式选择 (样式作为配置的一个设置项) -->
      <div class="tw-popover-row">
        <span class="tw-popover-label">样式方案</span>
        <select class="tw-popover-select" id="spThemeSelect">
          <option value="workbench" ${curTheme==='workbench'?'selected':''}>跟随工作台主题 (动态映射)</option>
          <option value="immersive" ${curTheme==='immersive'?'selected':''}>科技星云 (清新蓝调)</option>
          <option value="cosmic" ${curTheme==='cosmic'?'selected':''}>深空星系 (沉浸瑰丽)</option>
          <option value="graphite" ${curTheme==='graphite'?'selected':''}>石墨银河 (疏朗纸墨)</option>
        </select>
      </div>

      <!-- 4. 力学微调 -->
      <div class="tw-popover-divider"></div>
      <div class="tw-popover-section-title">
        <span>力学微调</span>
        <span style="font-size:10px; color:var(--text-muted, #64748B);">实时生效</span>
      </div>

      <div class="tw-setting-row" data-param="clusterSpread">
        <div class="tw-setting-label">
          <span class="tw-setting-title">星团展开</span>
          <span id="valSpread" style="font-family:monospace; font-weight:600;">${params.clusterSpread}x</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngSpread" min="0.5" max="2.4" step="0.05" value="${params.clusterSpread}">
      </div>

      <div class="tw-setting-row" data-param="repulsion">
        <div class="tw-setting-label">
          <span class="tw-setting-title">呼吸斥力</span>
          <span id="valRep" style="font-family:monospace; font-weight:600;">${params.repulsion}</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngRep" min="200" max="3200" step="50" value="${params.repulsion}">
      </div>

      <div class="tw-setting-row" data-param="nodeScale">
        <div class="tw-setting-label">
          <span class="tw-setting-title">星核缩放</span>
          <span id="valNodeScale" style="font-family:monospace; font-weight:600;">${params.nodeScale}x</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngNodeScale" min="0.3" max="2.0" step="0.05" value="${params.nodeScale}">
      </div>

      <div class="tw-setting-row" data-param="fontSize">
        <div class="tw-setting-label">
          <span class="tw-setting-title">文字大小</span>
          <span id="valFontSize" style="font-family:monospace; font-weight:600;">${params.fontSize || 3.2}px</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngFontSize" min="1" max="5" step="0.5" value="${params.fontSize || 3.2}">
      </div>

      <div class="tw-setting-row" data-param="edgeOpacity">
        <div class="tw-setting-label">
          <span class="tw-setting-title">星轨显隐</span>
          <span id="valEdgeOpacity" style="font-family:monospace; font-weight:600;">${params.edgeOpacity}</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngEdgeOpacity" min="0.1" max="1.0" step="0.05" value="${params.edgeOpacity}">
      </div>

      <div class="tw-setting-row" data-param="clusterStrength">
        <div class="tw-setting-label">
          <span class="tw-setting-title">星团凝聚</span>
          <span id="valCluster" style="font-family:monospace; font-weight:600;">${params.clusterStrength}</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngCluster" min="0.02" max="0.20" step="0.01" value="${params.clusterStrength}">
      </div>

      <div class="tw-setting-row" data-param="centerForce">
        <div class="tw-setting-label">
          <span class="tw-setting-title">居中引力</span>
          <span id="valCenter" style="font-family:monospace; font-weight:600;">${params.centerForce}</span>
        </div>
        <input type="range" class="tw-setting-slider" id="rngCenter" min="0.001" max="0.020" step="0.001" value="${params.centerForce}">
      </div>

      <div class="tw-popover-footer-btns">
        <button class="tw-chip" id="btnResetPhysics" style="flex:1; justify-content:center; cursor:pointer;">
          恢复默认
        </button>
        <button class="tw-chip" id="spBtnOpenWorkbenchSettings" style="flex:1; justify-content:center; cursor:pointer;" title="打开工作台主设置面板">
          ⚙️ 设置
        </button>
      </div>
    `;

    // 绑定知识库切换
    const kbSelect = this.settingsPopover.querySelector('#spKbSelect');
    if (kbSelect) {
      kbSelect.onchange = () => {
        const newKb = kbSelect.value;
        if (this.onKnowledgeBaseChanged) this.onKnowledgeBaseChanged(newKb);
        else this.loadGraphData();
      };
    }

    // 绑定节点上限切换
    const limitSelect = this.settingsPopover.querySelector('#spLimitSelect');
    if (limitSelect) {
      limitSelect.onchange = () => {
        this.currentLimit = parseInt(limitSelect.value, 10) || 300;
        this.loadGraphData();
      };
    }

    // 绑定主题切换
    const themeSelect = this.settingsPopover.querySelector('#spThemeSelect');
    if (themeSelect) {
      themeSelect.onchange = (e) => {
        const themeKey = e.target.value;
        this.graphEngine?.setTheme(themeKey);
        this.canvasContainerEl.dataset.theme = themeKey;
        this.containerEl.dataset.theme = themeKey;
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
        const defTh = this.graphEngine?.currentTheme || 'immersive';
        this.canvasContainerEl.dataset.theme = defTh;
        this.containerEl.dataset.theme = defTh;
        this.renderSettingsPopover();
      };
    }

    // 打开工作台设置
    const setBtn = this.settingsPopover.querySelector('#spBtnOpenWorkbenchSettings');
    if (setBtn) {
      setBtn.onclick = () => {
        this.settingsPopover?.classList.remove('open');
        if (this.onOpenSettings) this.onOpenSettings();
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

    if (matchedIds.length > 0) {
      this.hideSearchDropdown();
      if (shouldFocusFirst) {
        this.graphEngine?.focusNode(matchedIds[0]);
        const node = this.graphEngine?.nodeMap?.get(matchedIds[0]);
        if (node) this.handleNodeClick(node);
      }
    } else {
      // 本地画布未匹配到节点（超出初始上限未加载）：自动触发全库深搜与子图透传
      this.executeRemoteSearch(keyword, shouldFocusFirst);
    }
  }

  async executeRemoteSearch(keyword, autoEnter = false) {
    const kbId = this.getCurrentKbId();
    if (!kbId || !this.service?.searchWiki || !keyword) return;

    try {
      const res = await this.service.searchWiki(kbId, keyword, 5);
      const pages = res?.pages || [];

      if (pages.length === 0) {
        this.hideSearchDropdown();
        if (autoEnter) {
          new Notice(`知识库全库未找到与「${keyword}」匹配的知识点`);
        }
        return;
      }

      if (autoEnter) {
        // 用户按回车直接聚焦：穿透拉取首个匹配知识点的 1 跳关联子图网络！
        const topHit = pages[0];
        this.hideSearchDropdown();
        new Notice(`已从全库定位「${topHit.title}」，正在拉取关联网络...`, 2000);
        await this.enterEgoMode({
          id: topHit.slug || topHit.id,
          slug: topHit.slug,
          title: topHit.title,
          pageType: topHit.page_type || 'entity',
          page_type: topHit.page_type || 'entity'
        });
        const nodeObj = this.graphEngine?.nodeMap?.get(topHit.slug || topHit.id) || {
          id: topHit.slug || topHit.id,
          slug: topHit.slug,
          title: topHit.title,
          pageType: topHit.page_type || 'entity'
        };
        this.handleNodeClick(nodeObj);
      } else {
        // 用户输入中：渲染极简下拉提示浮层
        this.renderSearchDropdown(pages);
      }
    } catch (err) {
      console.warn('[WeKnora Search] 远程深搜失败:', err);
    }
  }

  renderSearchDropdown(pages) {
    const dropdown = this.toolbarEl?.querySelector('#graphSearchDropdown');
    if (!dropdown) return;

    if (!pages || pages.length === 0) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const typeLabels = {
      entity: '实体',
      concept: '概念',
      summary: '摘要',
      synthesis: '综合'
    };

    dropdown.innerHTML = pages.map(p => {
      const typeLabel = typeLabels[p.page_type] || '实体';
      return `
        <div class="tw-graph-search-item" data-slug="${escapeAttr(p.slug)}" title="${escapeAttr(p.title)}">
          <span class="tw-search-item-badge tw-badge-${escapeAttr(p.page_type || 'entity')}">${escapeHtml(typeLabel)}</span>
          <span class="tw-search-item-title">${escapeHtml(p.title)}</span>
          <span class="tw-search-item-hint">全库</span>
        </div>
      `;
    }).join('');

    dropdown.querySelectorAll('.tw-graph-search-item').forEach((itemEl, idx) => {
      itemEl.onclick = async (e) => {
        e.stopPropagation();
        const p = pages[idx];
        if (!p) return;
        this.hideSearchDropdown();
        new Notice(`正在拉取「${p.title}」的关联子图...`, 1500);
        await this.enterEgoMode({
          id: p.slug || p.id,
          slug: p.slug,
          title: p.title,
          pageType: p.page_type || 'entity',
          page_type: p.page_type || 'entity'
        });
        const nodeObj = this.graphEngine?.nodeMap?.get(p.slug || p.id) || {
          id: p.slug || p.id,
          slug: p.slug,
          title: p.title,
          pageType: p.page_type || 'entity'
        };
        this.handleNodeClick(nodeObj);
      };
    });

    dropdown.style.display = 'flex';
  }

  hideSearchDropdown() {
    const dropdown = this.toolbarEl?.querySelector('#graphSearchDropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
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

      if (this.graphEngine) {
        this.graphEngine.isEgoMode = true;
        this.graphEngine.viewportPaddingRight = (this.wikiDrawer && this.wikiDrawer.isOpen) ? 380 : 0;
        this.graphEngine.setData(egoData);
      }
      this.clearLoadingPlaceholder();

      this.updateEgoBanner();

      // 如果侧边抽屉当前正显示该中心节点，同步更新为返回全图按钮
      if (this.wikiDrawer && this.wikiDrawer.isOpen && this.wikiDrawer.currentNode?.id === centerNode.id) {
        this.wikiDrawer.updateEgoButtonState(true, true);
      }
    } catch (err) {
      new Notice(`Ego 模式展开失败: ${err.message}`);
      this.clearLoadingPlaceholder();
    }
  }

  exitEgoMode() {
    if (!this.isEgoMode) return;
    this.isEgoMode = false;
    this.egoCenterNode = null;
    if (this.graphEngine) {
      this.graphEngine.isEgoMode = false;
      this.graphEngine.viewportPaddingRight = (this.wikiDrawer && this.wikiDrawer.isOpen) ? 380 : 0;
    }
    this.updateEgoBanner();

    // 如果侧边抽屉当前打开，同步还原其展开按钮状态
    if (this.wikiDrawer && this.wikiDrawer.isOpen) {
      this.wikiDrawer.updateEgoButtonState(false, false);
    }

    if (this.backupFullGraphData) {
      this.graphData = this.backupFullGraphData;
      this.graphEngine?.setData(this.backupFullGraphData);
      this.backupFullGraphData = null;
    } else {
      this.loadGraphData();
    }
  }

  updateEgoBanner() {
    const egoHud = this.toolbarEl?.querySelector('#graphEgoHud');
    const egoTitle = this.toolbarEl?.querySelector('#graphEgoTitle');
    const exitBtn = this.toolbarEl?.querySelector('#btnExitEgoMode');

    if (!this.isEgoMode || !this.egoCenterNode) {
      if (egoHud) egoHud.style.display = 'none';
      return;
    }
    const node = this.egoCenterNode;
    const neighborCount = Math.max(0, (this.graphEngine?.nodes?.length || 1) - 1);
    if (egoTitle) {
      egoTitle.title = node.title;
      egoTitle.innerHTML = `中心: <strong>${escapeHtml(node.title)}</strong> (${neighborCount}项)`;
    }
    if (egoHud) egoHud.style.display = 'inline-flex';

    if (exitBtn) {
      if (!exitBtn.querySelector('svg')) {
        exitBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
      }
      exitBtn.onclick = (e) => {
        e.stopPropagation();
        this.exitEgoMode();
      };
    }
  }

  // --------------------------------------------------------------------------
  // 点击与交互处理
  // --------------------------------------------------------------------------
  handleNodeClick(node) {
    const kbId = this.getCurrentKbId();
    const isEgoCenter = this.isEgoMode && this.egoCenterNode?.id === node.id;
    this.wikiDrawer?.open(node, kbId, {
      isEgoMode: this.isEgoMode,
      isEgoCenter: isEgoCenter
    });
  }

  handleNodeHover(node, pos) {
    if (!this.tooltip) return;
    if (!node || !pos) {
      this.tooltip.style.display = 'none';
      return;
    }

    const wrapRect = this.canvasContainerEl.getBoundingClientRect();
    const tooltipWidth = 260;
    const tooltipHeight = 110;

    let x = pos.clientX - wrapRect.left + 16;
    let y = pos.clientY - wrapRect.top + 16;

    // 边缘智能翻转检测，防止超出画布边界
    if (x + tooltipWidth > wrapRect.width - 12) {
      x = pos.clientX - wrapRect.left - tooltipWidth - 12;
    }
    if (y + tooltipHeight > wrapRect.height - 12) {
      y = pos.clientY - wrapRect.top - tooltipHeight - 12;
    }

    const titleText = node.displayName || node.title || node.slug;
    const nodeColor = node.color || '#38BDF8';
    const tagBg = hexToRgba(nodeColor, 0.16);
    const tagBorder = hexToRgba(nodeColor, 0.40);

    this.tooltip.innerHTML = `
      <div class="tw-hud-header">
        <span class="tw-hud-badge" style="background:${tagBg}; color:${nodeColor}; border:1px solid ${tagBorder};">
          <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:${nodeColor}; box-shadow:0 0 4px ${nodeColor};"></span>
          ${escapeHtml(node.pageType || 'entity')}
        </span>
        ${node.isCoreAnchor ? '<span class="tw-hud-core-tag">⭐ 核心枢纽</span>' : ''}
      </div>
      <div class="tw-hud-title">${escapeHtml(titleText)}</div>
      <div class="tw-hud-meta">
        <span>引力连线: <strong>${node.degree || 0}</strong></span>
        ${node.referenceCount ? `<span>引用: <strong>${node.referenceCount}</strong></span>` : ''}
      </div>
      ${node.summary ? `<div class="tw-hud-summary">${escapeHtml(node.summary)}</div>` : ''}
      <div class="tw-hud-hint">
        <span>🖱 单击展开抽屉</span>
        <span>⚡ 双击空间跃迁</span>
      </div>
    `;
    this.tooltip.style.left = `${Math.max(8, x)}px`;
    this.tooltip.style.top = `${Math.max(8, y)}px`;
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
    if (this._onDocClickCloseSearch) {
      document.removeEventListener('click', this._onDocClickCloseSearch);
      this._onDocClickCloseSearch = null;
    }
    this.highlightCache.clear();
    this.radarHud?.dispose();
    this.graphEngine?.dispose();
    this.wikiDrawer?.dispose();
    this.containerEl?.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraWikiGraphView };
}
