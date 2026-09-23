/* ==========================================================================
   WeKnora Manage View — 工作台「管理」主视图总控制器
   模块定位:
   1. 顶部总控条: 心跳状态灯 (30s 守护)、Base URL、知识库切换器
   2. SubTab 四合一路由:
      - graph (默认): Wiki 知识图谱 (LOD / 视口裁剪 / 搜索高亮 / Ego 模式)
      - documents: 知识库资产与文档表格 (分类树 / 重新索引)
      - sync: 本地笔记双向比对与批量推送
      - webview: 官方 Web 端双模嵌入
   3. 严密生命周期管理: 彻底杜绝内存泄漏
   ========================================================================== */

class WeKnoraManageView {
  /**
   * @param {object} options
   * @param {any} options.app
   * @param {any} options.plugin
   * @param {function} [options.onOpenSettings]
   */
  constructor(options = {}) {
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.plugin = options.plugin || null;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.stageEl = null;

    // WeKnora 服务实例
    this.service = new WeknoraService(this.getWeknoraConfig());

    // 状态管理
    this.activeSubTab = this.getSavedSubTab(); // 'graph' | 'documents' | 'sync' | 'webview'
    this.knowledgeBases = [];
    this.currentKbId = this.service.defaultKb || '9e350fff-b50a-47db-a773-51d736ed24b8';
    this.connectionStatus = { ok: false, checking: true, latencyMs: 0, error: '' };
    this.heartbeatTimer = null;

    // 子视图实例引用
    this.wikiGraphView = null;
    this.documentsView = null;
    this.syncView = null;
    this.webviewEmbed = null;
  }

  getWeknoraConfig() {
    let baseUrl = 'http://192.168.1.62:8080';
    let apiKey = '';
    let defaultKb = '9e350fff-b50a-47db-a773-51d736ed24b8';

    try {
      const cfg = loadConfig();
      if (cfg.baseUrl) baseUrl = cfg.baseUrl;
      if (cfg.apiKey) apiKey = cfg.apiKey;
      if (cfg.defaultKb) defaultKb = cfg.defaultKb;
    } catch (e) {}

    return { baseUrl, apiKey, defaultKb };
  }

  getSavedSubTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-manage-subtab');
        if (s === 'graph' || s === 'documents' || s === 'sync' || s === 'webview') return s;
      }
    } catch (e) {}
    return 'graph';
  }

  setSubTab(subTab) {
    if (this.activeSubTab === subTab) return;
    this.activeSubTab = subTab;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-manage-subtab', subTab);
      }
    } catch (e) {}

    this.updateSubTabButtons();
    this.mountCurrentSubView();
  }

  mount(parentEl) {
    this.containerEl = parentEl.createDiv({ cls: 'tw-weknora-manage-container' });

    // 1. 顶部总控制条
    this.renderTopControlBar();

    // 2. 核心 SubTab 切换区域
    this.stageEl = this.containerEl.createDiv({ cls: 'tw-weknora-manage-stage' });

    // 3. 初始挂载视图
    this.mountCurrentSubView();

    // 4. 初始化连通性检测与知识库拉取
    this.initConnectionAndKbs();

    // 5. 启动 30 秒心跳守护
    this.startHeartbeat();
  }

  renderTopControlBar() {
    this.topBarEl = this.containerEl.createDiv({ cls: 'tw-weknora-manage-header' });
    this.updateTopControlBar();
  }

  updateTopControlBar() {
    if (!this.topBarEl) return;

    const st = this.connectionStatus;
    let statusDotColor = '#10B981';
    let statusText = `${st.latencyMs}ms`;
    if (st.checking) {
      statusDotColor = '#F59E0B';
      statusText = '检测中...';
    } else if (!st.ok) {
      statusDotColor = '#EF4444';
      statusText = '离线';
    }

    const cfg = this.service;
    let baseDisplay = cfg.baseUrl || '192.168.1.62:8080';
    try {
      const u = new URL(baseDisplay);
      baseDisplay = u.host;
    } catch (e) {}

    // 知识库选项
    let kbOptionsHtml = '';
    if (this.knowledgeBases.length > 0) {
      kbOptionsHtml = this.knowledgeBases.map(k => {
        return `<option value="${escapeAttr(k.id)}" ${k.id === this.currentKbId ? 'selected' : ''}>${escapeHtml(k.name || k.id)}</option>`;
      }).join('');
    } else {
      kbOptionsHtml = `<option value="${escapeAttr(this.currentKbId)}">TabonKB</option>`;
    }

    this.topBarEl.innerHTML = `
      <div class="tw-manage-hb-left">
        <div class="tw-manage-conn-badge" id="btnManageConnRefresh" title="点击重新检测 WeKnora 服务状态">
          <span class="tw-manage-dot" style="background:${statusDotColor};"></span>
          <span class="tw-manage-conn-host">${escapeHtml(baseDisplay)}</span>
          <span class="tw-manage-conn-latency">(${statusText})</span>
        </div>
        <div class="tw-manage-kb-selector" title="切换当前聚焦的 WeKnora 知识库">
          <span style="font-size:11px; color:var(--text-muted);">知识库:</span>
          <select class="tw-manage-select" id="selManageKb">
            ${kbOptionsHtml}
          </select>
        </div>
      </div>

      <div class="tw-manage-hb-center">
        <div class="tw-manage-subtabs">
          <button class="tw-manage-tab-btn ${this.activeSubTab === 'graph' ? 'active' : ''}" data-tab="graph">
            <span class="tw-manage-tab-icon">${getIconPark('data-sheet', 14)}</span>
            <span>Wiki 知识图谱</span>
          </button>
          <button class="tw-manage-tab-btn ${this.activeSubTab === 'documents' ? 'active' : ''}" data-tab="documents">
            <span class="tw-manage-tab-icon">${getIconPark('folder-focus', 14)}</span>
            <span>资产文档</span>
          </button>
          <button class="tw-manage-tab-btn ${this.activeSubTab === 'sync' ? 'active' : ''}" data-tab="sync">
            <span class="tw-manage-tab-icon">${getIconPark('refresh', 14)}</span>
            <span>笔记同步</span>
          </button>
          <button class="tw-manage-tab-btn ${this.activeSubTab === 'webview' ? 'active' : ''}" data-tab="webview">
            <span class="tw-manage-tab-icon">${getIconPark('application-one', 14)}</span>
            <span>官方控制台</span>
          </button>
        </div>
      </div>

      <div class="tw-manage-hb-right">
        <button class="tw-chip" id="btnManageOpenExternal" title="在系统默认浏览器中打开当前知识库">
          <span>↗ 浏览器打开</span>
        </button>
        <button class="tw-chip" id="btnManageOpenSettings" title="打开工作台设置">
          <span>⚙️ 设置</span>
        </button>
      </div>
    `;

    // 绑定事件
    this.topBarEl.querySelectorAll('.tw-manage-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.setSubTab(tab);
      };
    });

    const connBtn = this.topBarEl.querySelector('#btnManageConnRefresh');
    if (connBtn) {
      connBtn.onclick = () => this.checkConnection(true);
    }

    const kbSelect = this.topBarEl.querySelector('#selManageKb');
    if (kbSelect) {
      kbSelect.onchange = () => {
        this.currentKbId = kbSelect.value;
        this.onKnowledgeBaseChanged();
      };
    }

    const extBtn = this.topBarEl.querySelector('#btnManageOpenExternal');
    if (extBtn) {
      extBtn.onclick = () => {
        let base = this.service.baseUrl.replace(/\/api\/v\d+$/i, '').replace(/\/+$/, '');
        if (base.includes(':8080')) base = base.replace(':8080', ':8088');
        const u = `${base}/platform/knowledge-bases/${this.currentKbId}`;
        try {
          if (typeof require !== 'undefined') {
            const { shell } = require('electron');
            if (shell?.openExternal) {
              shell.openExternal(u);
              return;
            }
          }
        } catch (e) {}
        window.open(u, '_blank');
      };
    }

    const setBtn = this.topBarEl.querySelector('#btnManageOpenSettings');
    if (setBtn) {
      setBtn.onclick = () => {
        if (this.onOpenSettings) this.onOpenSettings();
        else {
          this.app.setting?.open?.();
          this.app.setting?.openTabById?.('tabonkb-workbench');
        }
      };
    }
  }

  updateSubTabButtons() {
    if (!this.topBarEl) return;
    this.topBarEl.querySelectorAll('.tw-manage-tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (tab === this.activeSubTab) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  mountCurrentSubView() {
    if (!this.stageEl) return;

    // 清空现有视图
    this.stageEl.empty();

    if (this.activeSubTab === 'graph') {
      this.wikiGraphView = new WeKnoraWikiGraphView(this.stageEl, {
        app: this.app,
        service: this.service,
        getCurrentKbId: () => this.currentKbId
      });
      this.wikiGraphView.loadGraphData();
    } else if (this.activeSubTab === 'documents') {
      this.documentsView = new WeKnoraDocumentsView(this.stageEl, {
        app: this.app,
        service: this.service,
        getCurrentKbId: () => this.currentKbId
      });
      this.documentsView.loadDocuments();
    } else if (this.activeSubTab === 'sync') {
      this.syncView = new WeKnoraSyncView(this.stageEl, {
        app: this.app,
        plugin: this.plugin,
        service: this.service,
        getCurrentKbId: () => this.currentKbId
      });
    } else if (this.activeSubTab === 'webview') {
      this.webviewEmbed = new WeKnoraWebviewEmbed(this.stageEl, {
        getBaseUrl: () => this.service.baseUrl,
        getCurrentKbId: () => this.currentKbId
      });
    }
  }

  onKnowledgeBaseChanged() {
    if (this.activeSubTab === 'graph' && this.wikiGraphView) {
      this.wikiGraphView.loadGraphData();
    } else if (this.activeSubTab === 'documents' && this.documentsView) {
      this.documentsView.loadDocuments();
    } else if (this.activeSubTab === 'sync' && this.syncView) {
      this.syncView.startScan();
    } else if (this.activeSubTab === 'webview' && this.webviewEmbed) {
      this.mountCurrentSubView();
    }
  }

  // --------------------------------------------------------------------------
  // 心跳守护与连接检测 (30s 周期)
  // --------------------------------------------------------------------------
  async initConnectionAndKbs() {
    await this.checkConnection(false);
    await this.loadKnowledgeBases();
  }

  async checkConnection(showNotice = false) {
    this.connectionStatus.checking = true;
    this.updateTopControlBar();

    const res = await this.service.ping(4000);
    this.connectionStatus = {
      ok: res.ok,
      checking: false,
      latencyMs: res.latencyMs,
      error: res.error || ''
    };
    this.updateTopControlBar();

    if (showNotice) {
      const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
      if (NoticeCls) {
        if (res.ok) new NoticeCls(`✓ WeKnora 服务在线 (${res.latencyMs}ms)`);
        else new NoticeCls(`⚠️ WeKnora 连接异常: ${res.error || '超时'}`);
      }
    }
  }

  async loadKnowledgeBases() {
    try {
      const list = await this.service.listKnowledgeBases();
      this.knowledgeBases = list || [];
      if (this.knowledgeBases.length > 0) {
        if (!this.currentKbId || !this.knowledgeBases.some(k => k.id === this.currentKbId)) {
          this.currentKbId = this.knowledgeBases[0].id;
        }
      }
      this.updateTopControlBar();
    } catch (e) {
      console.warn('[WeKnora Manage] 获取知识库列表失败:', e);
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.checkConnection(false);
    }, 30000); // 30 秒轮询
  }

  resize() {
    if (this.activeSubTab === 'graph' && this.wikiGraphView) {
      this.wikiGraphView.resize();
    }
  }

  // --------------------------------------------------------------------------
  // 严密清理与释放
  // --------------------------------------------------------------------------
  dispose() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.wikiGraphView?.dispose();
    this.wikiGraphView = null;

    this.documentsView?.dispose();
    this.documentsView = null;

    this.syncView?.dispose();
    this.syncView = null;

    this.webviewEmbed?.dispose();
    this.webviewEmbed = null;

    if (this.containerEl) {
      this.containerEl.empty();
      this.containerEl.remove();
      this.containerEl = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraManageView };
}
