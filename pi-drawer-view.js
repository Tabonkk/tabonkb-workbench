const path = require('path');
const { AgentHub } = require('./agent-hub.js');
const { getAgentBrandSvg } = require('./providers/agent-adapter-base.js');
const { getIconPark, detectModelIconPark, detectModelBrand, getOfficialModelSvg } = require('./ui/iconpark.js');

const DSH_ICONS = {
  copy: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><rect x="5.25" y="4.75" width="7.5" height="8.5" rx="1.5"/><path d="M3.25 10.75V3.5a1.5 1.5 0 0 1 1.5-1.5h5.5a1.5 1.5 0 0 1 1.5 1.5v1.25"/></svg>`,
  check: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="#10B981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="M13.25 4.75 6 12 2.75 8.75"/></svg>`,
  thumbUp: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="M4.5 6.5v8"/><path d="M10 3.8 9.3 6.5h3.9a1.3 1.3 0 0 1 1.3 1.7l-1.6 5.3A1.3 1.3 0 0 1 11.6 14.5H2.5a1.3 1.3 0 0 1-1.3-1.3v-5.4a1.3 1.3 0 0 1 1.3-1.3h2"/></svg>`,
  thumbDown: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="M11.5 9.5v-8"/><path d="M6 12.2 6.7 9.5H2.8a1.3 1.3 0 0 1-1.3-1.7l1.6-5.3A1.3 1.3 0 0 1 4.4 1.5h9.1a1.3 1.3 0 0 1 1.3 1.3v5.4a1.3 1.3 0 0 1-1.3 1.3h-2"/></svg>`,
  branch: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><circle cx="12" cy="3.5" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="12.5" r="2"/><path d="M5.7 9l4.6 2.5M10.3 4.5 5.7 7"/></svg>`,
  database: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><ellipse cx="8" cy="4.5" rx="5" ry="1.8"/><path d="M3 4.5v7c0 1 2.24 1.8 5 1.8s5-.8 5-1.8v-7"/><path d="M3 8c0 1 2.24 1.8 5 1.8s5-.8 5-1.8"/></svg>`,
  chevronDown: `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="m4 6 4 4 4-4"/></svg>`,
  chevronUp: `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="m12 10-4-4-4 4"/></svg>`,
  sparkle: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="m6 4.5.8 2.3a1 1 0 0 0 .6.6l2.3.8-2.3.8a1 1 0 0 0-.6.6L6 12l-.8-2.3a1 1 0 0 0-.6-.6L2.3 8.3l2.3-.8a1 1 0 0 0 .6-.6Z"/><path d="m12 2 .4 1a.6.6 0 0 0 .4.4l1 .4-1 .4a.6.6 0 0 0-.4.4l-.4 1-.4-1a.6.6 0 0 0-.4-.4l-1-.4 1-.4a.6.6 0 0 0 .4-.4Z"/><path d="m12 9.5.4 1a.6.6 0 0 0 .4.4l1 .4-1 .4a.6.6 0 0 0-.4.4l-.4 1-.4-1a.6.6 0 0 0-.4-.4l-1-.4 1-.4a.6.6 0 0 0 .4-.4Z"/></svg>`,
  fileText: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><rect width="9.5" height="12" x="3.25" y="2" rx="1.5"/><path d="M5.75 5.5h4.5"/><path d="M5.75 8h3.25"/></svg>`,
  undo: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="M2.6 8a5.9 5.9 0 1 0 .95-3.2"/><path d="M2.5 2.2v2.9h2.9"/></svg>`,
  trash: `<svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="display:block; shape-rendering:geometricPrecision;"><path d="M2.6 3.8h10.8"/><path d="M6.4 3.8V2.9a.9.9 0 0 1 .9-.9h1.4a.9.9 0 0 1 .9.9v.9"/><path d="M12.4 3.8v9a1.5 1.5 0 0 1-1.5 1.5H5.1a1.5 1.5 0 0 1-1.5-1.5v-9"/><path d="M6.5 6.8v4.2M9.5 6.8v4.2"/></svg>`
};


/**
 * PiDrawerView: Controls the UI Drawer component for Agent Hub inside TabonKB Workbench.
 * - Supports Multi-Agent Hub: Pi Agent, Hermes CLI, Gemini CLI
 * - Dynamic Agent Selector Dropdown in Header [ 🤖 Pi ▼ ]
 * - Isolated Session & Message History Swapping per Agent
 * - Input Draft Preservation during Agent Switching
 * - CLI Availability Detection & Warning Banner
 * - Status LED Indicator (Connected / Thinking / Running Tool / Disconnected / Error / Not Installed)
 * - Context Capsule (with quick clear / focus)
 * - Real-time streaming message bubble appending (zero re-render overhead)
 * - Tool Call Badges with Elapsed Time Timer & 30s warning
 * - Input controls: Send (Enter), Abort (Esc/Click), New Session, Close
 */
class PiDrawerView {
  constructor(options = {}) {
    // Multi-Agent Hub instance
    if (options.hub) {
      this.hub = options.hub;
    } else {
      this.hub = new AgentHub({
        bridge: options.bridge,
        vaultBasePath: options.vaultBasePath || (process.cwd ? process.cwd() : '')
      });
    }

    this.contextProvider = options.contextProvider;
    this.app = options.app || (options.contextProvider && options.contextProvider.app) || (typeof window !== 'undefined' ? window.app : null);
    this.vaultBasePath = options.vaultBasePath || (this.hub && this.hub.vaultBasePath) || (this.app?.vault?.adapter?.basePath) || (process.cwd ? process.cwd() : '');
    
    // Lifecycle component for native MarkdownRenderer
    let CompCls = typeof Component !== 'undefined' ? Component : null;
    if (!CompCls && typeof require !== 'undefined') {
      try { CompCls = require('obsidian')?.Component; } catch (e) {}
    }
    if (CompCls) {
      try {
        this.markdownComponent = new CompCls();
        this.markdownComponent.load();
      } catch (e) {
        this.markdownComponent = null;
      }
    } else {
      this.markdownComponent = null;
    }
    this.containerEl = null;
    this.drawerEl = null;
    // 发送全链路防重入守卫（检索注入阶段 hub 尚未 streaming，isStreaming() 拦不住重复提交）
    this._sendInFlight = false;
    this._abortRequested = false;
    this.resizerEl = null;
    this.messagesEl = null;
    this.inputEl = null;
    this.btnSend = null;
    this.btnAbort = null;
    this.btnNewSession = null;
    this.btnClose = null;
    this.statusLed = null;
    this.statusText = null;
    this._connInFlightAgent = null;
    this.contextCapsuleEl = null;
    this.permBadgeEl = null;
    this.warningBannerEl = null;

    // Selector elements
    this.selectorBtn = null;
    this.selectorMenu = null;
    this.agentIconEl = null;
    this.agentNameEl = null;

    // Antigravity Dialog Input Card elements
    this.inputCardEl = null;
    this.cardAttachmentsEl = null;
    this.cardImageAttachmentsEl = null;
    this.btnUploadImage = null;
    this.imageFileInput = null;
    this.attachedImages = [];
    this.cardModelPillEl = null;
    this.cardModelIconEl = null;
    this.cardModelNameEl = null;
    this.btnAttachDoc = null;
    this.dragOverlayEl = null;

    // 触发字符选择框（'/' 命令工具 · '@' 文件/技能）
    this.triggerPickerEl = null;
    this._tp = { open: false, trigger: null, tokenStart: -1, query: '', filtered: [], activeIndex: 0, loading: false };
    this._tpGen = 0;
    this._tpCommandsCache = null;
    this._tpCommandsFetchedAt = 0;
    this._tpFetchPromise = null;
    this._tpFileCache = null;
    this._tpFileCacheAt = 0;
    this._tpDocClickBound = null;

    // 输入胶囊：选中的命令 / 文件以可视化 chip 呈现，发送时序列化为协议文本
    this.inputChips = [];
    this.chipsEl = null;
    this._inputPlaceholder = null;

    // 粘底跟随：true=视口贴底（流式自动滚动生效）；用户上滑后置 false 锁定阅读位置
    this._stickToBottom = true;
    this._contentBelowPending = false;

    // Code Viewer Split-Pane (Monaco Editor Integration)
    this.codeViewerPanel = null;
    this.splitResizerEl = null;
    this.codePanelWrap = null;
    this.drawerContentWrap = null;
    this.isSplitPaneOpen = false;
    this.savedSplitRatio = 55;
    this._prevDrawerWidth = null;

    // Bottom-Left Model Selector elements
    this.modelWrapEl = null;
    this.modelPillEl = null;
    this.modelIconEl = null;
    this.modelNameEl = null;
    this.modelPopoverEl = null;
    this.modelSearchInput = null;
    this.modelListEl = null;
    this.reasoningPopoverEl = null;

    // Bottom-Left OpenGrok Project Selector elements
    this.projectWrapEl = null;
    this.projectPillEl = null;
    this.projectIconEl = null;
    this.projectNameEl = null;
    this.projectPopoverEl = null;
    this.projectSearchInput = null;
    this.projectListEl = null;
    this.selectedProject = this.getSavedProject();
    this.selectedGerritFilter = this.getSavedGerritFilter();
    this.selectedJiraIssue = this.getSavedJiraIssue();
    this.selectedLocalProject = this.getSavedLocalProject();
    this.optGerritItem = null;
    this.optGerritDropdownPanel = null;
    this.optJiraItem = null;
    this.optJiraDropdownPanel = null;
    this.gerritFilterEl = null;
    this.gerritSearchInput = null;
    this.gerritListEl = null;
    this.optLocalProjItem = null;
    this.optLocalProjDropdownPanel = null;
    this.localProjNameEl = null;
    this.localProjSearchInput = null;
    this.localProjListEl = null;
    this.localProjNavState = { step: 'servers', serverId: null, workspaceName: null };
    this.localProjNavHeader = null;
    this.localProjBackBtn = null;
    this.localProjBackText = null;
    this.localProjNavTitle = null;

    this.isOpenState = false;
    this.width = this.getSavedWidth();
    this.inputHeight = this.getSavedInputHeight();
    this.isDragging = false;
    this.currentAssistantMessage = null;
    this._hasAssistantMessageInTurn = false;
    this.activeToolCards = new Map(); // toolCallId -> DOM Element & timer
    this.onToggleCallbacks = new Set();
    this.onAgentChangeCallbacks = new Set();
    this.onNodeFocusCallback = options.onNodeFocus || null;

    this.setupHubEvents();
  }

  get permissionMode() {
    return this.hub.getPermissionMode();
  }

  get bridge() {
    return this.hub.getActiveAdapter();
  }

  getSavedWidth() {
    try {
      const saved = parseInt(localStorage.getItem('tabonkb-agent-drawer-width'), 10);
      if (!isNaN(saved) && saved >= 320 && saved <= 760) {
        return saved;
      }
    } catch (e) {}
    return 420;
  }

  saveWidth(w) {
    try {
      localStorage.setItem('tabonkb-agent-drawer-width', String(w));
    } catch (e) {}
  }

  getSavedInputHeight() {
    try {
      const saved = parseInt(localStorage.getItem('tabonkb-dialog-input-height'), 10);
      if (!isNaN(saved) && saved >= 42 && saved <= 350) {
        return Math.max(52, Math.min(saved, 120));
      }
    } catch (e) {}
    return 52; // Comfortably sized base height (elevated from 42px to 52px)
  }

  saveInputHeight(h) {
    try {
      this.inputHeight = h;
      localStorage.setItem('tabonkb-dialog-input-height', String(h));
    } catch (e) {}
  }

  async togglePermissionMode() {
    const nextMode = this.permissionMode === 'readonly' ? 'readwrite' : 'readonly';
    await this.hub.setPermissionMode(nextMode);
    this.updatePermBadge();
    this.updatePermHint();
    this.updateStatus(this.hub.getStatus());
  }

  updatePermBadge() {
    if (!this.permBadgeEl) return;
    const isRW = this.permissionMode === 'readwrite';
    this.permBadgeEl.className = `tw-drawer-badge-btn ${isRW ? 'readwrite' : 'readonly'}`;
    this.permBadgeEl.innerHTML = isRW
      ? `<span class="tw-badge-icon">${getIconPark('edit', 13)}</span>`
      : `<span class="tw-badge-icon">${getIconPark('lock', 13)}</span>`;
    this.permBadgeEl.title = isRW
      ? '当前：读写模式（支持新建与修改笔记），点击切换为只读'
      : '当前：只读模式（安全检索不修改），点击切换为读写';
  }

  updatePermHint() {
    const isRW = this.permissionMode === 'readwrite';
    const hintText = this.drawerEl ? this.drawerEl.querySelector('#twDrawerPermHint .tw-hint-text') : null;
    if (hintText) {
      hintText.textContent = isRW ? '读写安全模式' : '只读安全模式';
    } else {
      const hintEl = this.drawerEl ? this.drawerEl.querySelector('#twDrawerPermHint') : null;
      if (hintEl) hintEl.textContent = isRW ? '读写模式' : '只读模式';
    }
    const hintDot = this.drawerEl ? this.drawerEl.querySelector('#twDrawerPermHint .tw-hint-dot') : null;
    if (hintDot) {
      hintDot.className = `tw-hint-dot ${this.permissionMode}`;
    }
  }

  onToggle(fn) {
    this.onToggleCallbacks.add(fn);
  }

  notifyToggle(isOpen) {
    for (const fn of this.onToggleCallbacks) {
      try {
        fn(isOpen, this.width);
      } catch (e) {
        console.error('[PiDrawerView] toggle listener error:', e);
      }
    }
  }

  onAgentChange(fn) {
    this.onAgentChangeCallbacks.add(fn);
  }

  notifyAgentChange(agentId) {
    for (const fn of this.onAgentChangeCallbacks) {
      try {
        fn(agentId, this.hub.getActiveAdapter());
      } catch (e) {
        console.error('[PiDrawerView] agent change listener error:', e);
      }
    }
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.buildDom();
    this.updateContextCapsule();
    this.updateCardAttachments();
    this.updatePermBadge();
    this.updatePermHint();
    this.syncActiveAgentUI();
    this.restoreSessionMessages(this.hub.activeAgentId);
    this.updateStatus(this.hub.getStatus());
    this.ensureAgentConnected();
  }

  buildDom() {
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'tw-agent-drawer';
    this.drawerEl.style.width = `${this.width}px`;
    this.drawerEl.style.display = 'none';

    // 1. Resizer Handle
    this.resizerEl = document.createElement('div');
    this.resizerEl.className = 'tw-drawer-resizer';
    this.resizerEl.title = '拖拽调整抽屉宽度';
    this.drawerEl.appendChild(this.resizerEl);
    this.bindResizer();

    // 2. Drawer Content Inner Wrap
    const contentWrap = document.createElement('div');
    contentWrap.className = 'tw-drawer-content';
    this.drawerEl.appendChild(contentWrap);
    this.drawerContentWrap = contentWrap;

    // Header with Agent Selector Dropdown
    const activeAdapter = this.hub.getActiveAdapter();
    const header = document.createElement('div');
    header.className = 'tw-drawer-header';
    header.innerHTML = `
      <div class="tw-drawer-header-left">
        <div class="tw-agent-selector-wrap" id="twDrawerAgentSelectorWrap">
          <button class="tw-agent-selector-btn" id="twDrawerAgentSelectorBtn" title="点击切换 Agent (Pi / Antigravity / NiceAIGC)">
            <span class="tw-agent-sel-icon" id="twDrawerAgentIcon">${activeAdapter.icon}</span>
            <span class="tw-agent-sel-name" id="twDrawerAgentName">${escapeHtml(activeAdapter.displayName || activeAdapter.name)}</span>
            <span class="tw-agent-sel-caret">${getIconPark('down', 11)}</span>
          </button>
          <div class="tw-agent-dropdown-menu" id="twDrawerAgentMenu" style="display:none;"></div>
        </div>
        <button class="tw-drawer-badge-btn" id="twDrawerPermBadge" title="点击切换：只读模式 / 读写模式">
          <span class="tw-badge-icon">${getIconPark('edit', 13)}</span>
        </button>
        <div class="tw-drawer-status">
          <span class="tw-status-dot disconnected" id="twDrawerStatusDot"></span>
          <span class="tw-status-label" id="twDrawerStatusLabel">未连接</span>
        </div>
      </div>
      <div class="tw-drawer-header-actions">
        <button class="tw-drawer-btn" id="twBtnHistory" title="历史会话记录 (分段归档)">
          ${getIconPark('time', 14)}
        </button>
        <button class="tw-drawer-btn tw-btn-export-quicknote" id="twBtnExportQuickNote" title="存入 Quick-Note (包含离线图片)">
          ${getIconPark('download', 14)}
        </button>
        <button class="tw-drawer-btn" id="twBtnNewSession" title="新建空白会话">
          ${getIconPark('refresh', 14)}
        </button>
        <button class="tw-drawer-btn tw-drawer-btn-close" id="twBtnCloseDrawer" title="关闭抽屉 (Esc)">
          ${getIconPark('close', 14)}
        </button>
      </div>
    `;
    contentWrap.appendChild(header);

    this.selectorBtn = header.querySelector('#twDrawerAgentSelectorBtn');
    this.selectorMenu = header.querySelector('#twDrawerAgentMenu');
    this.agentIconEl = header.querySelector('#twDrawerAgentIcon');
    this.agentNameEl = header.querySelector('#twDrawerAgentName');
    this.statusLed = header.querySelector('#twDrawerStatusDot');
    this.statusText = header.querySelector('#twDrawerStatusLabel');
    this.permBadgeEl = header.querySelector('#twDrawerPermBadge');
    this.btnHistory = header.querySelector('#twBtnHistory');
    this.btnExportQuickNote = header.querySelector('#twBtnExportQuickNote');
    this.btnNewSession = header.querySelector('#twBtnNewSession');
    this.btnClose = header.querySelector('#twBtnCloseDrawer');

    this.bindAgentSelectorEvents();

    const handleStatusClick = async () => {
      const adapter = this.hub.getActiveAdapter();
      if (!adapter) return;
      if (adapter.status === 'disconnected' || adapter.status === 'error') {
        this.updateStatus({ status: 'connecting', detail: '正在重新连接...' });
        try {
          await adapter.start();
          this.updateStatus(adapter.getStatus());
        } catch (e) {
          this.updateStatus({ status: 'error', detail: e.message || '连接失败' });
        }
      }
    };
    if (this.statusLed) {
      this.statusLed.style.cursor = 'pointer';
      this.statusLed.title = '点击重新连接';
      this.statusLed.onclick = handleStatusClick;
    }
    if (this.statusText) {
      this.statusText.style.cursor = 'pointer';
      this.statusText.title = '点击重新连接';
      this.statusText.onclick = handleStatusClick;
    }

    if (this.permBadgeEl) this.permBadgeEl.onclick = () => this.togglePermissionMode();
    if (this.btnHistory) this.btnHistory.onclick = () => this.toggleHistoryPanel();
    if (this.btnExportQuickNote) this.btnExportQuickNote.onclick = () => this.exportToQuickNote();
    if (this.btnNewSession) this.btnNewSession.onclick = () => this.handleNewSession();
    if (this.btnClose) this.btnClose.onclick = () => this.close();

    // 2.5 History Sessions Panel (Default Hidden)
    this.historyPanelEl = document.createElement('div');
    this.historyPanelEl.className = 'tw-drawer-history-panel';
    this.historyPanelEl.id = 'twDrawerHistoryPanel';
    this.historyPanelEl.style.display = 'none';
    this.historyPanelEl.innerHTML = `
      <div class="tw-history-panel-header">
        <div class="tw-history-panel-title">
          <span class="tw-history-title-icon">${getIconPark('time', 13)}</span>
          <span>历史会话记录</span>
          <span class="tw-history-count-badge" id="twHistoryCountBadge">0</span>
        </div>
      </div>
      <div class="tw-history-list" id="twHistoryList"></div>
    `;
    contentWrap.appendChild(this.historyPanelEl);

    // 3. Warning Banner (if CLI not installed)
    this.warningBannerEl = document.createElement('div');
    this.warningBannerEl.className = 'tw-agent-warning-banner';
    this.warningBannerEl.style.display = 'none';
    contentWrap.appendChild(this.warningBannerEl);

    // 4. Context Capsule (merged into header row, no standalone bar)
    this.contextCapsuleEl = document.createElement('div');
    this.contextCapsuleEl.className = 'tw-drawer-context-bar';
    const headerLeftEl = header.querySelector('.tw-drawer-header-left');
    if (headerLeftEl) headerLeftEl.appendChild(this.contextCapsuleEl);

// 5. Messages Container
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'tw-drawer-messages';
    
    // Message container click delegation: copy button & external links
    this.messagesEl.onclick = async (e) => {
      // 1. Copy code block button
      const codeCopyBtn = e.target.closest('.tw-code-copy-btn');
      if (codeCopyBtn) {
        e.stopPropagation();
        const pre = codeCopyBtn.closest('pre');
        if (pre) {
          const codeEl = pre.querySelector('code');
          let codeText = '';
          if (codeEl) {
            codeText = codeEl.innerText || codeEl.textContent || '';
          } else {
            const clone = pre.cloneNode(true);
            const hb = clone.querySelector('.tw-code-header-bar');
            if (hb) hb.remove();
            const obBtn = clone.querySelector('.copy-code-button');
            if (obBtn) obBtn.remove();
            codeText = clone.innerText || clone.textContent || '';
          }
          codeText = codeText.replace(/\r\n/g, '\n');
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(codeText);
            } else {
              const ta = document.createElement('textarea');
              ta.value = codeText;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            codeCopyBtn.classList.add('copied');
            const prevHtml = codeCopyBtn.innerHTML;
            codeCopyBtn.innerHTML = getIconPark('check', 13, { color: '#10B981' });
            codeCopyBtn.setAttribute('title', '已复制!');
            setTimeout(() => {
              codeCopyBtn.classList.remove('copied');
              codeCopyBtn.innerHTML = prevHtml;
              codeCopyBtn.setAttribute('title', '复制代码');
            }, 1800);
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 代码片段已复制到剪贴板', 2000);
          } catch (err) {
            console.warn('[PiDrawerView] Code copy failed:', err);
          }
        }
        return;
      }

      // 1.1 Copy entire message text button
      const copyBtn = e.target.closest('.tw-msg-copy-btn');
      if (copyBtn) {
        e.stopPropagation();
        const bubble = copyBtn.closest('.tw-msg-bubble-wrap');
        const contentEl = bubble ? bubble.querySelector('.tw-msg-content') : null;
        if (contentEl) {
          const raw = contentEl.getAttribute('data-raw') || contentEl.innerText || '';
          try {
            await navigator.clipboard.writeText(raw);
            const prevHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = `${getIconPark('check', 12)} <span>已复制</span>`;
            setTimeout(() => { copyBtn.innerHTML = prevHtml; }, 1800);
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 回答全文已复制到剪贴板', 2000);
          } catch (err) {
            console.warn('[PiDrawerView] Copy failed:', err);
          }
        }
        return;
      }

      // 1.5 Intercept clicks on user images or assistant images for full lightbox preview
      const imgEl = e.target.closest('.tw-msg-user-img, .tw-msg-content img, .image-embed img, .internal-embed img');
      if (imgEl && imgEl.src) {
        e.stopPropagation();
        this.openImageLightbox(imgEl.src, imgEl.alt || imgEl.title || '图片预览');
        return;
      }

      // 2. Intercept clicks on links inside message bubbles to open in external browser
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href') || link.href || '';
        const text = link.textContent || '';
        const targetUrl = resolveLinkToUrl(href, text, link, this.vaultBasePath);
        if (targetUrl) {
          e.preventDefault();
          e.stopPropagation();
          openExternalUrl(targetUrl);
          return;
        }
      }
    };

    // 1.6 Intercept right-clicks on user images or assistant images for context menu (size selection & copy)
    this.messagesEl.oncontextmenu = (e) => {
      const imgEl = e.target.closest('.tw-msg-user-img, .tw-msg-content img, .image-embed img, .internal-embed img');
      if (imgEl && imgEl.src) {
        e.preventDefault();
        e.stopPropagation();
        this.showImageContextMenu(e, imgEl);
        return;
      }
    };


    contentWrap.appendChild(this.messagesEl);

    // 5.4 浮动平滑回到底部按钮 (对应 DeepSeek Harness 悬浮箭头)
    this.scrollBottomBtn = document.createElement('button');
    this.scrollBottomBtn.className = 'tw-scroll-bottom-btn';
    this.scrollBottomBtn.title = '平滑回到底部';
    this.scrollBottomBtn.innerHTML = getIconPark('down', 14);
    this.scrollBottomBtn.onclick = () => this.scrollToBottom(true);
    contentWrap.appendChild(this.scrollBottomBtn);

    // 5.5 吸顶提问复用条: 滚动离开原始气泡时钉在消息区顶部 (绝对定位, 不占 flex 流)
    this.stickyHeaderEl = document.createElement('div');
    this.stickyHeaderEl.className = 'tw-sticky-question';
    this.stickyHeaderEl.innerHTML = `
      <span class="tw-sticky-q-tag"><span class="tw-msg-user-avatar tw-msg-user-avatar--sm"></span></span>
      <span class="tw-sticky-q-text"></span>
    `;
    this.stickyHeaderEl.onclick = () => this.scrollToBottom(true);
    contentWrap.insertBefore(this.stickyHeaderEl, this.messagesEl);

    if (this._stickyAbort) {
      try { this._stickyAbort.abort(); } catch (_) {}
    }
    this._stickyAbort = new AbortController();
    this._lastScrollTop = 0;
    this._userScrolledUpUntil = 0;
    this.messagesEl.addEventListener('scroll', () => {
      const curScrollTop = this.messagesEl.scrollTop;
      const prevScrollTop = typeof this._lastScrollTop === 'number' ? this._lastScrollTop : curScrollTop;
      const dist = this.messagesEl.scrollHeight - curScrollTop - this.messagesEl.clientHeight;
      const isScrollingUp = curScrollTop < prevScrollTop - 1;
      const inUpwardHold = Date.now() < (this._userScrolledUpUntil || 0);
      this._lastScrollTop = curScrollTop;

      // 同步判定粘底状态：向上滑动或处于上滑惯性窗口期内一律解除贴底跟随并取消回底 RAF，
      // 防止平滑滚轮首帧 dist 仍在 56px 阈值内时把 _stickToBottom 误重置回 true
      if (isScrollingUp || inUpwardHold) {
        this._stickToBottom = false;
        if (this._scrollRafId) {
          cancelAnimationFrame(this._scrollRafId);
          this._scrollRafId = null;
        }
      } else if (dist <= 40) {
        this._stickToBottom = true;
        this._contentBelowPending = false;
      } else if (dist > 56) {
        this._stickToBottom = false;
      }

      if (this._stickyRaf) return;
      this._stickyRaf = requestAnimationFrame(() => {
        this._stickyRaf = null;
        this.updateStickyQuestion();
        this.updateMinimapActive();
        if (this.scrollBottomBtn) {
          const d = this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight;
          this.scrollBottomBtn.classList.toggle('visible', d > 120 || this._contentBelowPending);
          if (!this._contentBelowPending) this.scrollBottomBtn.classList.remove('has-new');
        }
      });
    }, { signal: this._stickyAbort.signal, passive: true });

    // 滚轮上滑 = 用户明确回看历史：先于 scroll 事件同步解除贴底跟随，
    // 并设置 450ms 上滑保护窗口，彻底消除平滑滚轮首帧 dist<=56 把用户拽回底部的现象
    this.messagesEl.addEventListener('wheel', (e) => {
      this._minimapScrollingUntil = 0;
      if (e.deltaY < 0 && this.messagesEl.scrollHeight > this.messagesEl.clientHeight) {
        this._stickToBottom = false;
        this._userScrolledUpUntil = Date.now() + 450;
        if (this._scrollRafId) {
          cancelAnimationFrame(this._scrollRafId);
          this._scrollRafId = null;
        }
      } else if (e.deltaY > 0) {
        this._userScrolledUpUntil = 0;
        this._minimapTargetIdx = null;
      }
    }, { signal: this._stickyAbort.signal, passive: true });

    // 5.6 对话段导航条: 右侧刻度, 每条用户提问=一段, 点击跳转至该段并高亮当前视口段
    this.minimapEl = document.createElement('div');
    this.minimapEl.className = 'tw-chat-minimap';
    this.minimapEl.style.display = 'none';
    contentWrap.appendChild(this.minimapEl);

    if (this._minimapAbort) {
      try { this._minimapAbort.abort(); } catch (_) {}
    }
    if (this._minimapObserver) {
      try { this._minimapObserver.disconnect(); } catch (_) {}
    }
    if (this._minimapResizeObserver) {
      try { this._minimapResizeObserver.disconnect(); } catch (_) {}
    }
    this._minimapAbort = new AbortController();
    // 消息增删后重建刻度 (覆盖历史恢复 / 发送 / 流式渲染等所有入口)
    this._minimapObserver = new MutationObserver(() => {
      if (this._minimapRaf) return;
      this._minimapRaf = requestAnimationFrame(() => {
        this._minimapRaf = null;
        this.buildChatMinimap();
      });
    });
    this._minimapObserver.observe(this.messagesEl, { childList: true });
    if (typeof ResizeObserver !== 'undefined') {
      this._minimapResizeObserver = new ResizeObserver(() => this.layoutMinimap());
      this._minimapResizeObserver.observe(this.messagesEl);
    }
    window.addEventListener('resize', () => this.layoutMinimap(), { signal: this._minimapAbort.signal });

    // 6. Footer / Input Bar (Antigravity Floating Card Design - Resizable & Clean)
    const footer = document.createElement('div');
    footer.className = 'tw-drawer-footer';
    footer.innerHTML = `
      <div class="tw-session-ctx" id="twSessionCtx" style="display:none;"></div>
      <div class="tw-drawer-input-card" id="twDrawerInputCard">
        <div class="tw-card-resizer" id="twCardResizer" title="上下拖拽调整对话框高度">
          <span class="tw-card-resizer-line"></span>
        </div>
        <div class="tw-card-image-attachments" id="twCardImageAttachments" style="display:none;"></div>
        <div class="tw-card-attachments" id="twCardAttachments" style="display:none;"></div>
        <div class="tw-card-chips" id="twCardChips" style="display:none;"></div>
        <textarea
          class="tw-drawer-input" 
          id="twDrawerInput" 
          placeholder="向 ${escapeAttr(activeAdapter.displayName || activeAdapter.name)} 提问，输入需求或问题... (Enter 发送)"
        ></textarea>
        <div class="tw-card-toolbar">
          <div class="tw-card-toolbar-left">
            <div class="tw-card-model-wrap" id="twCardModelWrap">
              <button class="tw-card-model-pill" id="twCardModelPill" title="点击切换当前 AI 模型">
                <span class="tw-card-model-icon" id="twCardModelIcon">${getOfficialModelSvg('gpt-5-6-thinking', 14)}</span>
                <span class="tw-card-model-name" id="twCardModelName">GPT-5.6 Sol</span>
                <span class="tw-card-model-caret">${getIconPark('down', 10)}</span>
              </button>
              <div class="tw-model-popover" id="twModelPopover" style="display:none;">
                <div class="tw-model-search-wrap">
                  <span class="tw-model-search-icon">${getIconPark('search', 13)}</span>
                  <input type="text" class="tw-model-search-input" id="twModelSearchInput" placeholder="搜索模型 (如 5.6, Claude, Gemini...)" />
                  <button type="button" class="tw-model-refresh-btn" id="twModelRefreshBtn" title="实时刷新模型列表">
                    ${getIconPark('refresh', 13)}
                  </button>
                </div>
                <div class="tw-model-popover-list" id="twModelPopoverList"></div>
              </div>
              <div class="tw-reasoning-popover" id="twReasoningPopover" style="display:none;"></div>
            </div>
            <button class="tw-card-upload-btn" id="twBtnUploadImage" title="上传图片 (支持相册选择 / Ctrl+V 截图直接粘贴 / 拖拽图片)">
              ${getIconPark('pic', 15)}
            </button>
            <input type="file" id="twImageFileInput" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none;" />
            <div class="tw-card-options-wrap" id="twCardOptionsWrap">
              <button class="tw-card-options-btn" id="twCardOptionsBtn" title="选项配置">
                ${getIconPark('options', 15)}
                <span class="tw-options-badge-dot" id="twOptionsBadgeDot" style="display:none;"></span>
              </button>
              <div class="tw-options-popover" id="twOptionsPopover" style="display:none;">
                <div class="tw-options-menu">
                  <!-- 1. OpenGrok 代码工程 -->
                  <div class="tw-opt-menu-item active has-submenu" id="twOptOpenGrokItem" title="OpenGrok 代码工程切换">
                    <div class="tw-opt-item-left">
                      <span class="tw-opt-item-icon" style="color:#10B981">${getIconPark('code', 14)}</span>
                      <span class="tw-opt-item-name">OpenGrok</span>
                    </div>
                    <div class="tw-opt-item-right">
                      <span class="tw-opt-item-val" id="twCardProjectName">Auto</span>
                      <span class="tw-opt-item-arrow">${getIconPark('right', 10)}</span>
                    </div>
                  </div>

                  <!-- 2. Gerrit 代码评审 (只读接入) -->
                  <div class="tw-opt-menu-item active has-submenu" id="twOptGerritItem" title="Gerrit 代码评审">
                    <div class="tw-opt-item-left">
                      <span class="tw-opt-item-icon" style="color:#6366F1">${getIconPark('link', 14)}</span>
                      <span class="tw-opt-item-name">Gerrit</span>
                    </div>
                    <div class="tw-opt-item-right">
                      <span class="tw-opt-item-val" id="twCardGerritFilter">全部</span>
                      <span class="tw-opt-item-arrow">${getIconPark('right', 10)}</span>
                    </div>
                  </div>

                  <!-- 3. Jira 缺陷工单 (上下文绑定) -->
                  <div class="tw-opt-menu-item active has-submenu" id="twOptJiraItem" title="绑定 Jira 缺陷工单上下文">
                    <div class="tw-opt-item-left">
                      <span class="tw-opt-item-icon" style="color:#0EA5E9">${getIconPark('tasks', 14)}</span>
                      <span class="tw-opt-item-name">Jira 工单</span>
                    </div>
                    <div class="tw-opt-item-right">
                      <span class="tw-opt-item-val" id="twCardJiraIssue">未指定</span>
                      <span class="tw-opt-item-arrow">${getIconPark('right', 10)}</span>
                    </div>
                  </div>

                  <!-- 4. 本地工程 (平台与项目代码) -->
                  <div class="tw-opt-menu-item active has-submenu" id="twOptLocalProjItem" title="本地工程与项目客制化选择">
                    <div class="tw-opt-item-left">
                      <span class="tw-opt-item-icon" style="color:#F59E0B">${getIconPark('folder', 14)}</span>
                      <span class="tw-opt-item-name">本地工程</span>
                    </div>
                    <div class="tw-opt-item-right">
                      <span class="tw-opt-item-val" id="twCardLocalProjName">未指定</span>
                      <span class="tw-opt-item-arrow">${getIconPark('right', 10)}</span>
                    </div>
                  </div>
                </div>

                <!-- 浮窗形式的工程选择面板 -->
                <div class="tw-opt-proj-floating-panel" id="twOptProjDropdownPanel" style="display:none;">
                  <div class="tw-project-search-wrap">
                    <span class="tw-project-search-icon">${getIconPark('search', 11)}</span>
                    <input type="text" class="tw-project-search-input" id="twProjectSearchInput" placeholder="搜索工程..." />
                  </div>
                  <div class="tw-project-popover-list" id="twProjectPopoverList"></div>
                </div>

                <!-- 浮窗形式的 Gerrit 过滤面板 -->
                <div class="tw-opt-proj-floating-panel" id="twOptGerritDropdownPanel" style="display:none;">
                  <div class="tw-project-search-wrap">
                    <span class="tw-project-search-icon">${getIconPark('search', 11)}</span>
                    <input type="text" class="tw-project-search-input" id="twGerritSearchInput" placeholder="过滤模式..." />
                  </div>
                  <div class="tw-project-popover-list" id="twGerritPopoverList"></div>
                </div>

                <!-- 浮窗形式的 Jira 工单选择面板 -->
                <div class="tw-opt-proj-floating-panel" id="twOptJiraDropdownPanel" style="display:none;">
                  <div class="tw-project-search-wrap">
                    <span class="tw-project-search-icon">${getIconPark('search', 11)}</span>
                    <input type="text" class="tw-project-search-input" id="twJiraSearchInput" placeholder="搜索工单 (KEY / 关键词)..." />
                    <button type="button" class="tw-local-proj-refresh-btn" id="twJiraRefreshBtn" title="刷新工单列表">
                      ${getIconPark('refresh', 11)}
                    </button>
                  </div>
                  <div class="tw-project-popover-list" id="twJiraPopoverList"></div>
                </div>

                <!-- 浮窗形式的本地工程选择面板 (服务器 》 总代码路径 》 项目) -->
                <div class="tw-opt-proj-floating-panel" id="twOptLocalProjDropdownPanel" style="display:none;">
                  <div class="tw-local-proj-nav-header" id="twLocalProjNavHeader" style="display:none;">
                    <button type="button" class="tw-local-proj-back-btn" id="twLocalProjBackBtn" title="返回上一级">
                      ${getIconPark('left', 11)} <span id="twLocalProjBackText">返回</span>
                    </button>
                    <span class="tw-local-proj-nav-title" id="twLocalProjNavTitle"></span>
                  </div>
                  <div class="tw-project-search-wrap">
                    <span class="tw-project-search-icon">${getIconPark('search', 11)}</span>
                    <input type="text" class="tw-project-search-input" id="twLocalProjSearchInput" placeholder="全局搜索 (如 K82NF, N30)..." />
                    <button type="button" class="tw-local-proj-refresh-btn" id="twLocalProjRefreshBtn" title="重新扫描服务器工程 (实时检测增删代码)">
                      ${getIconPark('refresh', 11)}
                    </button>
                  </div>

                  <div class="tw-project-popover-list" id="twLocalProjPopoverList"></div>
                </div>

              </div>
            </div>
          </div>
          <div class="tw-card-toolbar-right">
            <button class="tw-card-abort-btn" id="twBtnAbort" style="display:none;" title="停止生成 (Esc)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/></svg>
            </button>
            <button class="tw-card-send-btn disabled" id="twBtnSend" title="发送 (Enter)" disabled>
              ${getIconPark('send', 16)}
            </button>
          </div>
        </div>
        <div class="tw-card-drag-overlay" id="twCardDragOverlay">
          ${getIconPark('paperclip', 16)}
          <span>松开以附加图片或文档到对话</span>
        </div>
      </div>
    `;
    contentWrap.appendChild(footer);

    this.inputCardEl = footer.querySelector('#twDrawerInputCard');
    this.cardImageAttachmentsEl = footer.querySelector('#twCardImageAttachments');
    this.cardAttachmentsEl = footer.querySelector('#twCardAttachments');
    this.chipsEl = footer.querySelector('#twCardChips');
    this.sessionCtxEl = footer.querySelector('#twSessionCtx');
    this.btnUploadImage = footer.querySelector('#twBtnUploadImage');
    this.imageFileInput = footer.querySelector('#twImageFileInput');
    this.inputEl = footer.querySelector('#twDrawerInput');
    this.btnSend = footer.querySelector('#twBtnSend');
    this.btnAbort = footer.querySelector('#twBtnAbort');
    this.dragOverlayEl = footer.querySelector('#twCardDragOverlay');

    this.modelWrapEl = footer.querySelector('#twCardModelWrap');
    this.modelPillEl = footer.querySelector('#twCardModelPill');
    this.modelIconEl = footer.querySelector('#twCardModelIcon');
    this.modelNameEl = footer.querySelector('#twCardModelName');
    this.modelPopoverEl = footer.querySelector('#twModelPopover');
    this.modelSearchInput = footer.querySelector('#twModelSearchInput');
    this.modelRefreshBtn = footer.querySelector('#twModelRefreshBtn');
    this.modelListEl = footer.querySelector('#twModelPopoverList');
    this.reasoningPopoverEl = footer.querySelector('#twReasoningPopover');

    this.optionsWrapEl = footer.querySelector('#twCardOptionsWrap');
    this.optionsBtnEl = footer.querySelector('#twCardOptionsBtn');
    this.optionsBadgeDot = footer.querySelector('#twOptionsBadgeDot');
    this.optionsPopoverEl = footer.querySelector('#twOptionsPopover');
    this.btnCloseOptions = footer.querySelector('#twBtnCloseOptions');

    this.optOpenGrokItem = footer.querySelector('#twOptOpenGrokItem');
    this.optProjTrigger = this.optOpenGrokItem;
    this.optProjDropdownPanel = footer.querySelector('#twOptProjDropdownPanel');
    this.projectNameEl = footer.querySelector('#twCardProjectName');
    this.projectSearchInput = footer.querySelector('#twProjectSearchInput');
    this.projectListEl = footer.querySelector('#twProjectPopoverList');

    this.optGerritItem = footer.querySelector('#twOptGerritItem');
    this.optGerritDropdownPanel = footer.querySelector('#twOptGerritDropdownPanel');
    this.gerritFilterEl = footer.querySelector('#twCardGerritFilter');
    this.gerritSearchInput = footer.querySelector('#twGerritSearchInput');
    this.gerritListEl = footer.querySelector('#twGerritPopoverList');
    this.optJiraItem = footer.querySelector('#twOptJiraItem');
    this.optJiraDropdownPanel = footer.querySelector('#twOptJiraDropdownPanel');
    this.jiraIssueEl = footer.querySelector('#twCardJiraIssue');
    this.jiraSearchInput = footer.querySelector('#twJiraSearchInput');
    this.jiraListEl = footer.querySelector('#twJiraPopoverList');
    this.jiraRefreshBtn = footer.querySelector('#twJiraRefreshBtn');

    this.optLocalProjItem = footer.querySelector('#twOptLocalProjItem');
    this.optLocalProjDropdownPanel = footer.querySelector('#twOptLocalProjDropdownPanel');
    this.localProjNameEl = footer.querySelector('#twCardLocalProjName');
    this.localProjSearchInput = footer.querySelector('#twLocalProjSearchInput');
    this.localProjListEl = footer.querySelector('#twLocalProjPopoverList');
    this.localProjNavHeader = footer.querySelector('#twLocalProjNavHeader');
    this.localProjBackBtn = footer.querySelector('#twLocalProjBackBtn');
    this.localProjBackText = footer.querySelector('#twLocalProjBackText');
    this.localProjNavTitle = footer.querySelector('#twLocalProjNavTitle');
    this.localProjRefreshBtn = footer.querySelector('#twLocalProjRefreshBtn');

    // Backward-compatibility aliases
    this.projectWrapEl = this.optionsWrapEl;
    this.projectPillEl = this.optionsBtnEl;
    this.projectPopoverEl = this.optionsPopoverEl;

    if (this.inputEl) {
      this.inputEl.style.height = `${this.inputHeight}px`;
    }

    this.bindCardResizer();
    this.bindInputEvents();
    this.bindModelSelectorEvents();
    this.updateModelSelectorPill();
    this.bindProjectSelectorEvents();
    this.updateProjectSelectorPill();
    this.updateContextCapsule();
    this._restoreChips(this.hub.activeAgentId);
    this.updateSendButtonState();

    this.containerEl.appendChild(this.drawerEl);
  }

  bindAgentSelectorEvents() {
    if (!this.selectorBtn || !this.selectorMenu) return;

    this.selectorBtn.onclick = (e) => {
      e.stopPropagation();
      const isVisible = this.selectorMenu.style.display === 'block';
      if (isVisible) {
        this.selectorMenu.style.display = 'none';
      } else {
        this.renderDropdownMenu();
        this.selectorMenu.style.display = 'block';
      }
    };

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (this.selectorMenu && !this.selectorMenu.contains(e.target) && e.target !== this.selectorBtn) {
        this.selectorMenu.style.display = 'none';
      }
    });
  }

  renderDropdownMenu() {
    if (!this.selectorMenu) return;
    const agents = this.hub.getAgentList();
    const currentId = this.hub.activeAgentId;

    let html = '';
    for (const a of agents) {
      const isSelected = a.id === currentId;
      const adapter = this.hub.getAdapter(a.id);
      const isInstalled = adapter ? adapter.status !== 'not_installed' : true;

      html += `
        <div class="tw-agent-dropdown-item ${isSelected ? 'active' : ''} ${!isInstalled ? 'missing' : ''}" data-agent-id="${a.id}">
          <div class="tw-agent-item-left">
            <span class="tw-agent-item-icon">${a.icon}</span>
            <div class="tw-agent-item-info">
              <div class="tw-agent-item-name">
                ${escapeHtml(a.displayName)}
                ${isSelected ? `<span class="tw-agent-check">${getIconPark('check', 12)}</span>` : ''}
              </div>
              <div class="tw-agent-item-desc">${escapeHtml(a.desc)}</div>
            </div>
          </div>
        </div>
      `;
    }

    this.selectorMenu.innerHTML = html;

    this.selectorMenu.querySelectorAll('.tw-agent-dropdown-item').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const targetId = el.getAttribute('data-agent-id');
        this.selectorMenu.style.display = 'none';
        this.switchAgent(targetId);
      };
    });
  }

  bindModelSelectorEvents() {
    if (!this.modelPillEl || !this.modelPopoverEl) return;

    this.modelPillEl.onclick = (e) => {
      e.stopPropagation();
      const isVisible = this.modelPopoverEl.style.display === 'flex';
      if (isVisible) {
        this.closeModelPopover();
      } else {
        this.openModelPopover();
      }
    };

    if (this.modelSearchInput) {
      this.modelSearchInput.onclick = (e) => e.stopPropagation();
      this.modelSearchInput.oninput = (e) => {
        this.renderModelPopover(e.target.value.trim());
      };
    }

    if (this.modelRefreshBtn) {
      this.modelRefreshBtn.onclick = async (e) => {
        e.stopPropagation();
        const adapter = this.hub.getActiveAdapter();
        if (typeof adapter.reloadModels === 'function') {
          this.modelRefreshBtn.classList.add('rotating');
          try {
            await Promise.resolve(adapter.reloadModels());
            const currentSearch = this.modelSearchInput ? this.modelSearchInput.value.trim() : '';
            this.renderModelPopover(currentSearch);
            this.updateModelSelectorPill();
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 模型列表已实时同步最新', 2000);
          } catch (err) {
            console.warn('[PiDrawerView] reloadModels error:', err);
          } finally {
            setTimeout(() => {
              if (this.modelRefreshBtn) this.modelRefreshBtn.classList.remove('rotating');
            }, 600);
          }
        }
      };
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (this.modelPopoverEl && this.modelWrapEl && !this.modelWrapEl.contains(e.target)) {
        this.closeModelPopover();
      }
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modelPopoverEl && this.modelPopoverEl.style.display === 'flex') {
        this.closeModelPopover();
      }
    });
  }

  openModelPopover() {
    if (!this.modelPopoverEl) return;
    this.closeProjectPopover();
    const adapter = this.hub.getActiveAdapter();
    if (typeof adapter.fetchModels === 'function') {
      adapter.fetchModels().then(() => {
        if (this.modelPopoverEl && this.modelPopoverEl.style.display !== 'none') {
          const currentSearch = this.modelSearchInput ? this.modelSearchInput.value.trim() : '';
          this.renderModelPopover(currentSearch);
        }
      }).catch(() => {});
    }
    if (this.modelSearchInput) this.modelSearchInput.value = '';
    this.renderModelPopover('');
    this.modelPopoverEl.style.display = 'flex';
    setTimeout(() => {
      if (this.modelSearchInput) this.modelSearchInput.focus();
    }, 50);
  }

  closeModelPopover() {
    if (this.modelPopoverEl) {
      this.modelPopoverEl.style.display = 'none';
    }
    this.closeReasoningPopover();
  }

  openReasoningPopover(anchorEl, modelId, modelName) {
    if (!this.reasoningPopoverEl || !anchorEl) return;
    const adapter = this.hub.getActiveAdapter();
    const currentEffort = typeof adapter.getReasoningEffort === 'function' ? adapter.getReasoningEffort() : 'max';

    const levels = [
      { id: 'off', label: '关闭', desc: '直接输出' },
      { id: 'low', label: '低', desc: '轻度思考' },
      { id: 'medium', label: '中', desc: '速度平衡' },
      { id: 'high', label: '高', desc: '深度思考' },
      { id: 'max', label: '极高', desc: '全量思考' }
    ];

    let html = '';
    for (const lvl of levels) {
      const isActive = lvl.id === currentEffort;
      html += `
        <div class="tw-reasoning-item ${isActive ? 'active' : ''}" data-effort="${lvl.id}" data-model-id="${escapeAttr(modelId)}" data-model-name="${escapeAttr(modelName)}">
          <div class="tw-reasoning-item-info">
            <div class="tw-reasoning-item-title">${escapeHtml(lvl.label)}</div>
            <div class="tw-reasoning-item-desc">${escapeHtml(lvl.desc)}</div>
          </div>
          ${isActive ? `<span class="tw-reasoning-item-check">${getIconPark('check', 12)}</span>` : ''}
        </div>
      `;
    }

    this.reasoningPopoverEl.innerHTML = html;

    // 挂到模型列表内部，用列表自身坐标定位。
    // 不能用视口 fixed：抽屉祖先有位移时，fixed 的包含块不是窗口，菜单会被推到很远的右侧。
    const host = this.modelPopoverEl;
    const pop = this.reasoningPopoverEl;
    if (host && pop.parentElement !== host) host.appendChild(pop);
    const hostRect = host ? host.getBoundingClientRect() : anchorEl.getBoundingClientRect();
    const rowRect = anchorEl.getBoundingClientRect();
    pop.style.position = 'absolute';
    pop.style.display = 'flex';
    pop.style.visibility = 'hidden';
    pop.style.margin = '0';
    pop.style.right = 'auto';
    pop.style.bottom = 'auto';
    pop.style.left = 'calc(100% - 6px)';
    pop.style.top = '0px';
    const menuW = pop.offsetWidth || 168;
    const menuH = pop.offsetHeight || 180;
    const margin = 8;
    const viewW = window.innerWidth || 1000;
    const viewH = window.innerHeight || 800;
    let top = rowRect.top - hostRect.top;
    if (hostRect.top + top + menuH > viewH - margin) {
      top = viewH - margin - hostRect.top - menuH;
    }
    if (top < 0) top = 0;
    const openRight = hostRect.right - 6 + menuW <= viewW - margin;
    pop.style.left = openRight ? 'calc(100% - 6px)' : 'auto';
    pop.style.right = openRight ? 'auto' : 'calc(100% - 6px)';
    pop.style.top = `${Math.round(top)}px`;
    pop.style.visibility = '';
    pop.style.zIndex = '260';

    // Bind item clicks
    this.reasoningPopoverEl.querySelectorAll('.tw-reasoning-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const mId = item.getAttribute('data-model-id');
        const mName = item.getAttribute('data-model-name');
        const effort = item.getAttribute('data-effort');
        this.selectModel(mId, mName, mId, effort);
      };
    });
  }

  closeReasoningPopover() {
    if (this.reasoningPopoverEl) {
      this.reasoningPopoverEl.style.display = 'none';
    }
  }

  _renderModelItem(m, currentId, adapter, categoryName = '') {
    const isSelected = m.id === currentId;
    const brandIcon = getOfficialModelSvg(m.brand || m.id || m.name, 14);
    const supportsReasoning = !!m.supportsReasoningEffort;

    let rightSideHtml = '';
    if (supportsReasoning) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function'
        ? adapter.getReasoningEffortConfig()
        : { label: '极高' };
      rightSideHtml = `
        <div class="tw-reasoning-trigger" data-model-id="${escapeAttr(m.id)}" data-model-name="${escapeAttr(m.name)}" title="选择推理等级">
          <span class="tw-reasoning-label">${escapeHtml(effortConfig.label)}</span>
          ${isSelected ? `<span class="tw-model-item-check">${getIconPark('check', 12)}</span>` : ''}
          <span class="tw-reasoning-caret">${getIconPark('right', 9)}</span>
        </div>
      `;
    } else if (isSelected) {
      rightSideHtml = `<span class="tw-model-item-check">${getIconPark('check', 12)}</span>`;
    }

    return `
      <div class="tw-model-item ${isSelected ? 'active' : ''} ${supportsReasoning ? 'has-reasoning' : ''}" data-model-id="${escapeAttr(m.id)}" data-model-name="${escapeAttr(m.name)}" data-model-icon="${escapeAttr(m.id)}" data-supports-reasoning="${supportsReasoning ? 'true' : 'false'}">
        <div class="tw-model-item-info">
          <div class="tw-model-item-title-row">
            <span>${brandIcon}</span>
            <span class="tw-model-item-name">${escapeHtml(m.name)}</span>
            ${categoryName ? `<span style="font-size: 9.5px; opacity: 0.6; margin-left: 4px;">(${escapeHtml(categoryName)})</span>` : ''}
          </div>
          ${m.desc ? `<div class="tw-model-item-desc">${escapeHtml(m.desc)}</div>` : ''}
        </div>
        ${rightSideHtml}
      </div>
    `;
  }

  renderModelPopover(searchTerm = '') {
    if (!this.modelListEl) return;
    const adapter = this.hub.getActiveAdapter();
    const groups = typeof adapter.getModelGroups === 'function' ? adapter.getModelGroups() : [];
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : { id: 'default', name: 'Default' };
    const currentId = currentModel.id;

    const term = searchTerm.toLowerCase();

    // If searching, display flattened matching items
    if (term) {
      const matches = [];
      for (const g of groups) {
        for (const m of (g.models || [])) {
          if (m.name.toLowerCase().includes(term) || m.id.toLowerCase().includes(term) || (m.desc && m.desc.toLowerCase().includes(term))) {
            matches.push(Object.assign({}, m, { category: g.group }));
          }
        }
      }

      if (matches.length === 0) {
        this.modelListEl.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 11px;">
            未找到包含 "${escapeHtml(searchTerm)}" 的模型
          </div>
        `;
        return;
      }

      let html = '';
      for (const m of matches) {
        html += this._renderModelItem(m, currentId, adapter, m.category);
      }
      this.modelListEl.innerHTML = html;
      this._bindModelItemClicks();
      return;
    }

    // Default categorized layout (matches website screenshot)
    let html = '';

    // 1. Top Section (e.g. 常用模型: Auto, GPT-5.6 Sol)
    const topGroup = groups.find(g => g.isTop);
    if (topGroup) {
      for (const m of (topGroup.models || [])) {
        html += this._renderModelItem(m, currentId, adapter);
      }
      html += '<div class="tw-model-divider"></div>';
    }

    // 2. Categorized Groups (Accordion)
    const otherGroups = groups.filter(g => !g.isTop);
    for (let i = 0; i < otherGroups.length; i++) {
      const g = otherGroups[i];
      const hasActive = (g.models || []).some(m => m.id === currentId);
      const groupIcon = g.brand 
        ? getOfficialModelSvg(g.brand, 14) 
        : (g.iconPark ? getIconPark(g.iconPark, 13) : getOfficialModelSvg(g.group, 14));

      html += `
        <div class="tw-model-category ${hasActive ? 'open' : ''}" data-cat-idx="${i}">
          <div class="tw-model-category-header">
            <div class="tw-model-category-left">
              <span class="tw-model-category-icon">${groupIcon}</span>
              <span class="tw-model-category-title">${escapeHtml(g.group)}</span>
            </div>
            <span class="tw-model-category-arrow">${getIconPark('right', 11)}</span>
          </div>
          <div class="tw-model-category-items">
      `;

      for (const m of (g.models || [])) {
        html += this._renderModelItem(m, currentId, adapter);
      }

      html += `
          </div>
        </div>
      `;
    }

    this.modelListEl.innerHTML = html;

    // Bind Accordion toggles
    this.modelListEl.querySelectorAll('.tw-model-category-header').forEach(hdr => {
      hdr.onclick = (e) => {
        e.stopPropagation();
        const cat = hdr.closest('.tw-model-category');
        if (cat) cat.classList.toggle('open');
      };
    });

    this._bindModelItemClicks();
  }

  _bindModelItemClicks() {
    this.modelListEl.querySelectorAll('.tw-model-item').forEach(el => {
      const modelId = el.getAttribute('data-model-id');
      const modelName = el.getAttribute('data-model-name');
      const modelIcon = el.getAttribute('data-model-icon');
      const supportsReasoning = el.getAttribute('data-supports-reasoning') === 'true';

      // 1. Click on item itself -> selects model with current reasoning effort
      el.onclick = (e) => {
        const trigger = e.target.closest('.tw-reasoning-trigger');
        if (trigger) return; // Trigger click handled below
        e.stopPropagation();
        const adapter = this.hub.getActiveAdapter();
        const currentEffort = typeof adapter.getReasoningEffort === 'function' ? adapter.getReasoningEffort() : 'max';
        this.selectModel(modelId, modelName, modelIcon, supportsReasoning ? currentEffort : null);
      };

      // 2. Click or hover on reasoning trigger
      const trigger = el.querySelector('.tw-reasoning-trigger');
      if (trigger) {
        trigger.onclick = (e) => {
          e.stopPropagation();
          this.openReasoningPopover(el, modelId, modelName);
        };

        el.addEventListener('mouseenter', () => {
          this.openReasoningPopover(el, modelId, modelName);
        });
      } else {
        el.addEventListener('mouseenter', () => {
          this.closeReasoningPopover();
        });
      }
    });
  }

  selectModel(modelId, modelName, modelIcon, reasoningEffort = null) {
    const adapter = this.hub.getActiveAdapter();
    if (typeof adapter.setModel === 'function') {
      adapter.setModel(modelId, modelName, reasoningEffort);
    }

    this.updateModelSelectorPill();
    this.closeModelPopover();

    let levelSuffix = '';
    if (reasoningEffort) {
      const map = { 'off': '关闭思考', 'low': '低推理', 'medium': '中推理', 'high': '高推理', 'max': '极高推理' };
      levelSuffix = ` (${map[reasoningEffort] || reasoningEffort})`;
    }

    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
    new NoticeCls(`✓ 已切换至模型: ${modelName}${levelSuffix}`, 2500);

    if (this.inputEl) {
      this.updateInputPlaceholder();
      this.inputEl.focus();
    }
  }

  updateModelSelectorPill() {
    if (!this.modelWrapEl || !this.modelPillEl || !this.modelNameEl) return;
    const adapter = this.hub.getActiveAdapter();
    const groups = typeof adapter.getModelGroups === 'function' ? adapter.getModelGroups() : [];
    
    // If current agent has no model choices, hide model selector pill gracefully
    if (!groups || groups.length === 0) {
      this.modelWrapEl.style.display = 'none';
      return;
    }
    this.modelWrapEl.style.display = 'inline-block';

    const current = typeof adapter.getModel === 'function' ? adapter.getModel() : { id: 'default', name: 'Default' };
    const brandIcon = getOfficialModelSvg(current.id || current.name, 14);

    if (this.modelIconEl) this.modelIconEl.innerHTML = brandIcon;

    let displayName = current.name || current.id || 'GPT-5.6 Sol';
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(current.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) {
        displayName = `${displayName} · ${effortConfig.label}`;
      }
    }

    if (this.modelNameEl) this.modelNameEl.textContent = displayName;
  }

  getSavedProject() {
    try {
      if (typeof localStorage !== 'undefined') {
        const p = localStorage.getItem('tabonkb-opengrok-selected-project');
        if (p) return p;
      }
    } catch (e) {}
    return 'auto';
  }

  saveProject(proj) {
    this.selectedProject = proj || 'auto';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-opengrok-selected-project', this.selectedProject);
      }
    } catch (e) {}
    this.updateProjectSelectorPill();
  }

  getAvailableProjects() {
    return [
      { id: 'auto', name: 'Auto (智能推断)', desc: '按提问及平台智能推断' },
      { id: 'W_sprd_os_dev', name: 'W_sprd_os_dev', desc: '展锐主线 (Android 14/15)' },
      { id: 'V_sprd_os_dev', name: 'V_sprd_os_dev', desc: '展锐分支 (V_dev)' },
      { id: 'W_mp1_os_dev', name: 'W_mp1_os_dev', desc: 'MTK 主线 (MT6768/6833)' },
      { id: 'A17_mp1_os_dev', name: 'A17_mp1_os_dev', desc: 'MTK A17 项目机型' },
      { id: 'T_U_sprd_oversea_release', name: 'T_U_sprd_oversea_release', desc: '展锐海外发布版' },
      { id: 'T_U_mp1_oversea_release', name: 'T_U_mp1_oversea_release', desc: 'MTK 海外发布版' },
      { id: 'V_oversea_release', name: 'V_oversea_release', desc: '海外发布分支' },
      { id: 'S_U_aiot_oversea_release', name: 'S_U_aiot_oversea_release', desc: 'AIoT 物联网版' },
      { id: 'Aselsan_release_A16_1.57', name: 'Aselsan_release_A16_1.57', desc: 'Aselsan 专网定制' }
    ];
  }

  getSavedGerritFilter() {
    try {
      if (typeof localStorage !== 'undefined') {
        const f = localStorage.getItem('tabonkb-gerrit-selected-filter');
        if (f) return f;
      }
    } catch (e) {}
    return 'all';
  }

  saveGerritFilter(filterId) {
    this.selectedGerritFilter = filterId || 'all';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-gerrit-selected-filter', this.selectedGerritFilter);
      }
    } catch (e) {}
    this.updateProjectSelectorPill();
  }

  getSavedJiraIssue() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-jira-selected-issue');
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed && parsed.key) return parsed;
        }
      }
    } catch (_) {}
    return null;
  }

  saveJiraIssue(issue) {
    this.selectedJiraIssue = (issue && issue.key) ? {
      key: issue.key,
      summary: issue.summary || '',
      status: issue.status || '',
      priority: issue.priority || '',
      assignee: issue.assignee || '',
      url: issue.url || ''
    } : null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (this.selectedJiraIssue) {
          localStorage.setItem('tabonkb-jira-selected-issue', JSON.stringify(this.selectedJiraIssue));
        } else {
          localStorage.removeItem('tabonkb-jira-selected-issue');
        }
      }
    } catch (_) {}
    this.updateProjectSelectorPill();
  }

  getAvailableGerritFilters() {
    return [
      { id: 'all', name: '全部变更', desc: '检索全库代码评审' },
      { id: 'open', name: '开放中', desc: '当前处于评审中' },
      { id: 'merged', name: '已合入', desc: '已通过并合入主干' },
      { id: 'mine', name: '我提交', desc: '本人创建的变更单' },
      { id: 'reviewing', name: '待我审', desc: '指派给我的待评审单' }
    ];
  }

  getSavedLocalProject() {
    try {
      if (typeof localStorage !== 'undefined') {
        const p = localStorage.getItem('tabonkb-local-selected-project');
        if (p) {
          const parsed = JSON.parse(p);
          if (parsed && parsed.id) {
            if (!parsed.priDriverRel && parsed.platform && parsed.project) {
              parsed.priDriverRel = `pri_project/driver/${parsed.platform}/${parsed.project}/base`;
              parsed.publicDriverRel = 'pri_project/driver/public';
            }
            return parsed;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  saveLocalProject(proj) {
    this.selectedLocalProject = (proj && proj.id !== 'none') ? proj : null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (this.selectedLocalProject) {
          localStorage.setItem('tabonkb-local-selected-project', JSON.stringify(this.selectedLocalProject));
        } else {
          localStorage.removeItem('tabonkb-local-selected-project');
        }
      }
      if (typeof process !== 'undefined' && process.env) {
        if (this.selectedLocalProject) {
          process.env.TABONKB_LOCAL_PROJECT_JSON = JSON.stringify(this.selectedLocalProject);
        } else {
          delete process.env.TABONKB_LOCAL_PROJECT_JSON;
        }
      }
    } catch (_) {}
    this.updateProjectSelectorPill();
  }

  bindProjectSelectorEvents() {
    if (!this.optionsBtnEl || !this.optionsPopoverEl) return;

    this.optionsBtnEl.onclick = (e) => {
      e.stopPropagation();
      const isVisible = this.optionsPopoverEl.style.display === 'flex';
      if (isVisible) {
        this.closeProjectPopover();
      } else {
        this.openProjectPopover();
      }
    };

    // 1. OpenGrok 级联子菜单交互
    if (this.optOpenGrokItem && this.optProjDropdownPanel) {
      this.optOpenGrokItem.onclick = (e) => {
        e.stopPropagation();
        const isOpen = this.optProjDropdownPanel.style.display !== 'none';
        if (isOpen) {
          this.closeProjectDropdown();
        } else {
          this.closeGerritDropdown();
          this.closeJiraDropdown();
          this.closeLocalProjDropdown();
          this.openProjectDropdown();
        }
      };

      this.optOpenGrokItem.addEventListener('mouseenter', () => {
        this.closeGerritDropdown();
        this.closeJiraDropdown();
        this.closeLocalProjDropdown();
        this.openProjectDropdown();
      });
    }

    // 2. Gerrit 级联子菜单交互
    if (this.optGerritItem && this.optGerritDropdownPanel) {
      this.optGerritItem.onclick = (e) => {
        e.stopPropagation();
        const isOpen = this.optGerritDropdownPanel.style.display !== 'none';
        if (isOpen) {
          this.closeGerritDropdown();
        } else {
          this.closeProjectDropdown();
          this.closeJiraDropdown();
          this.closeLocalProjDropdown();
          this.openGerritDropdown();
        }
      };

      this.optGerritItem.addEventListener('mouseenter', () => {
        this.closeProjectDropdown();
        this.closeJiraDropdown();
        this.closeLocalProjDropdown();
        this.openGerritDropdown();
      });
    }

    // 2.5 Jira 工单级联子菜单交互
    if (this.optJiraItem && this.optJiraDropdownPanel) {
      this.optJiraItem.onclick = (e) => {
        e.stopPropagation();
        const isOpen = this.optJiraDropdownPanel.style.display !== 'none';
        if (isOpen) {
          this.closeJiraDropdown();
        } else {
          this.closeProjectDropdown();
          this.closeGerritDropdown();
          this.closeLocalProjDropdown();
          this.openJiraDropdown();
        }
      };

      this.optJiraItem.addEventListener('mouseenter', () => {
        this.closeProjectDropdown();
        this.closeGerritDropdown();
        this.closeLocalProjDropdown();
        this.openJiraDropdown();
      });
    }

    // 3. 本地工程级联子菜单交互
    if (this.optLocalProjItem && this.optLocalProjDropdownPanel) {
      this.optLocalProjItem.onclick = (e) => {
        e.stopPropagation();
        const isOpen = this.optLocalProjDropdownPanel.style.display !== 'none';
        if (isOpen) {
          this.closeLocalProjDropdown();
        } else {
          this.closeProjectDropdown();
          this.closeGerritDropdown();
          this.closeJiraDropdown();
          this.openLocalProjDropdown();
        }
      };

      this.optLocalProjItem.addEventListener('mouseenter', () => {
        this.closeProjectDropdown();
        this.closeGerritDropdown();
        this.closeJiraDropdown();
        this.openLocalProjDropdown();
      });
    }

    // 4. 悬停在其他未激活菜单项时自动收起所有子面板
    if (this.optionsPopoverEl) {
      this.optionsPopoverEl.querySelectorAll('.tw-opt-menu-item:not(#twOptOpenGrokItem):not(#twOptGerritItem):not(#twOptJiraItem):not(#twOptLocalProjItem)').forEach(el => {
        el.addEventListener('mouseenter', () => {
          this.closeProjectDropdown();
          this.closeGerritDropdown();
          this.closeJiraDropdown();
          this.closeLocalProjDropdown();
        });
      });
    }

    // 5. OpenGrok 搜索框
    if (this.projectSearchInput) {
      this.projectSearchInput.onclick = (e) => e.stopPropagation();
      this.projectSearchInput.oninput = (e) => {
        this.renderProjectPopover(e.target.value.trim());
      };
    }

    // 6. Gerrit 搜索框
    if (this.gerritSearchInput) {
      this.gerritSearchInput.onclick = (e) => e.stopPropagation();
      this.gerritSearchInput.oninput = (e) => {
        this.renderGerritPopover(e.target.value.trim());
      };
    }

    // 6.5 Jira 搜索框与刷新
    if (this.jiraSearchInput) {
      this.jiraSearchInput.onclick = (e) => e.stopPropagation();
      this.jiraSearchInput.oninput = (e) => {
        this.renderJiraPopover(e.target.value.trim());
      };
    }
    if (this.jiraRefreshBtn) {
      this.jiraRefreshBtn.onclick = (e) => {
        e.stopPropagation();
        this._jiraIssueCache = null;
        this.renderJiraPopover(this.jiraSearchInput ? this.jiraSearchInput.value.trim() : '', true);
      };
    }

    // 7. 本地工程搜索框
    if (this.localProjSearchInput) {
      this.localProjSearchInput.onclick = (e) => e.stopPropagation();
      this.localProjSearchInput.oninput = (e) => {
        this.renderLocalProjPopover(e.target.value.trim());
      };
    }

    // 7.1 本地工程面包屑返回按钮 (4级回退: projects -> platforms -> workspaces -> servers)
    if (this.localProjBackBtn) {
      this.localProjBackBtn.onclick = (e) => {
        e.stopPropagation();
        if (!this.localProjNavState) return;
        if (this.localProjNavState.step === 'projects') {
          this.localProjNavState.step = 'platforms';
          this.localProjNavState.platform = null;
        } else if (this.localProjNavState.step === 'platforms') {
          this.localProjNavState.step = 'workspaces';
          this.localProjNavState.workspaceName = null;
          this.localProjNavState.platform = null;
        } else if (this.localProjNavState.step === 'workspaces') {
          this.localProjNavState.step = 'servers';
          this.localProjNavState.serverId = null;
          this.localProjNavState.workspaceName = null;
          this.localProjNavState.platform = null;
        }
        if (this.localProjSearchInput) this.localProjSearchInput.value = '';
        this.renderLocalProjPopover('');
      };
    }

    // 7.2 本地工程实时重新扫描按钮
    if (this.localProjRefreshBtn) {
      this.localProjRefreshBtn.onclick = async (e) => {
        e.stopPropagation();
        const app = this.app || (typeof window !== 'undefined' ? window.app : null);
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
        new NoticeCls('🔄 正在实时探测 62/31 服务器代码路径...', 2500);
        this.localProjRefreshBtn.style.animation = 'twSpin 0.8s linear infinite';
        try {
          let updated = [];
          if (typeof getAllAvailableLocalProjects === 'function') {
            updated = getAllAvailableLocalProjects(true);
          } else if (typeof require !== 'undefined') {
            const svc = require('./services/local-project-service');
            if (svc && svc.getAllAvailableLocalProjects) updated = svc.getAllAvailableLocalProjects(true);
          }
          this.renderLocalProjPopover(this.localProjSearchInput ? this.localProjSearchInput.value.trim() : '');
          new NoticeCls(`✓ 扫描完成，发现 ${updated.length} 款项目 SKU`, 3000);
        } catch (err) {
          new NoticeCls(`扫描异常: ${err.message}`, 3000);
        } finally {
          this.localProjRefreshBtn.style.animation = '';
        }
      };
    }

    // Close on click outside - 点击任意空白处关闭退出选项
    document.addEventListener('click', (e) => {
      if (!this.optionsPopoverEl || this.optionsPopoverEl.style.display === 'none') return;

      // 如果点击在浮窗内部，不关闭
      if (this.optProjDropdownPanel && this.optProjDropdownPanel.contains(e.target)) {
        return;
      }
      if (this.optGerritDropdownPanel && this.optGerritDropdownPanel.contains(e.target)) {
        return;
      }
      if (this.optJiraDropdownPanel && this.optJiraDropdownPanel.contains(e.target)) {
        return;
      }
      if (this.optLocalProjDropdownPanel && this.optLocalProjDropdownPanel.contains(e.target)) {
        return;
      }

      // 如果点击在 optionsWrap 外部空白处，直接全部退出
      if (this.optionsWrapEl && !this.optionsWrapEl.contains(e.target)) {
        this.closeProjectPopover();
        return;
      }

      // 如果点击在 optionsPopover 内部但不在项上，收起相应子浮窗
      if (this.optionsPopoverEl.contains(e.target)) {
        if (this.optProjDropdownPanel && this.optProjDropdownPanel.style.display !== 'none') {
          if (this.optOpenGrokItem && !this.optOpenGrokItem.contains(e.target)) {
            this.closeProjectDropdown();
          }
        }
        if (this.optGerritDropdownPanel && this.optGerritDropdownPanel.style.display !== 'none') {
          if (this.optGerritItem && !this.optGerritItem.contains(e.target)) {
            this.closeGerritDropdown();
          }
        }
        if (this.optJiraDropdownPanel && this.optJiraDropdownPanel.style.display !== 'none') {
          if (this.optJiraItem && !this.optJiraItem.contains(e.target)) {
            this.closeJiraDropdown();
          }
        }
        if (this.optLocalProjDropdownPanel && this.optLocalProjDropdownPanel.style.display !== 'none') {
          if (this.optLocalProjItem && !this.optLocalProjItem.contains(e.target)) {
            this.closeLocalProjDropdown();
          }
        }
      }
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.optionsPopoverEl && this.optionsPopoverEl.style.display === 'flex') {
        this.closeProjectPopover();
      }
    });
  }

  openProjectDropdown() {
    if (!this.optProjDropdownPanel) return;
    this.positionProjectDropdown();
    this.optProjDropdownPanel.style.display = 'flex';
    if (this.optOpenGrokItem) this.optOpenGrokItem.classList.add('open');
    this.renderProjectPopover(this.projectSearchInput ? this.projectSearchInput.value.trim() : '');
  }

  closeProjectDropdown() {
    if (this.optProjDropdownPanel) {
      this.optProjDropdownPanel.style.display = 'none';
    }
    if (this.optOpenGrokItem) {
      this.optOpenGrokItem.classList.remove('open');
    }
  }

  positionProjectDropdown() {
    if (!this.optOpenGrokItem || !this.optProjDropdownPanel || !this.optionsPopoverEl) return;
    try {
      const popoverRect = this.optionsPopoverEl.getBoundingClientRect();
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

      // 水平定位：向左稍微叠加 6px 在主框上，无缝衔接消除间隔；右侧超界自适应翻转
      if (popoverRect.right + 250 > windowWidth) {
        this.optProjDropdownPanel.style.left = 'auto';
        this.optProjDropdownPanel.style.right = 'calc(100% - 6px)';
      } else {
        this.optProjDropdownPanel.style.left = 'calc(100% - 6px)';
        this.optProjDropdownPanel.style.right = 'auto';
      }

      // 垂直定位：向上抬高底端对齐（bottom: 0），避免浮窗过长探出屏幕底部/被任务栏遮挡
      this.optProjDropdownPanel.style.top = 'auto';
      this.optProjDropdownPanel.style.bottom = '0px';
    } catch (_) {}
  }

  openGerritDropdown() {
    if (!this.optGerritDropdownPanel) return;
    this.positionGerritDropdown();
    this.optGerritDropdownPanel.style.display = 'flex';
    if (this.optGerritItem) this.optGerritItem.classList.add('open');
    this.renderGerritPopover(this.gerritSearchInput ? this.gerritSearchInput.value.trim() : '');
  }

  closeGerritDropdown() {
    if (this.optGerritDropdownPanel) {
      this.optGerritDropdownPanel.style.display = 'none';
    }
    if (this.optGerritItem) {
      this.optGerritItem.classList.remove('open');
    }
  }

  positionGerritDropdown() {
    if (!this.optGerritItem || !this.optGerritDropdownPanel || !this.optionsPopoverEl) return;
    try {
      const popoverRect = this.optionsPopoverEl.getBoundingClientRect();
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

      // 水平定位：向左稍微叠加 6px 在主框上，无缝衔接消除间隔；右侧超界自适应翻转
      if (popoverRect.right + 250 > windowWidth) {
        this.optGerritDropdownPanel.style.left = 'auto';
        this.optGerritDropdownPanel.style.right = 'calc(100% - 6px)';
      } else {
        this.optGerritDropdownPanel.style.left = 'calc(100% - 6px)';
        this.optGerritDropdownPanel.style.right = 'auto';
      }

      // 垂直定位：向上抬高底端对齐（bottom: 0），避免浮窗过长探出屏幕底部/被任务栏遮挡
      this.optGerritDropdownPanel.style.top = 'auto';
      this.optGerritDropdownPanel.style.bottom = '0px';
    } catch (_) {}
  }

  openJiraDropdown() {
    if (!this.optJiraDropdownPanel) return;
    this.positionJiraDropdown();
    this.optJiraDropdownPanel.style.display = 'flex';
    if (this.optJiraItem) this.optJiraItem.classList.add('open');
    this.renderJiraPopover(this.jiraSearchInput ? this.jiraSearchInput.value.trim() : '');
  }

  closeJiraDropdown() {
    if (this.optJiraDropdownPanel) {
      this.optJiraDropdownPanel.style.display = 'none';
    }
    if (this.optJiraItem) {
      this.optJiraItem.classList.remove('open');
    }
  }

  positionJiraDropdown() {
    if (!this.optJiraItem || !this.optJiraDropdownPanel || !this.optionsPopoverEl) return;
    try {
      const popoverRect = this.optionsPopoverEl.getBoundingClientRect();
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

      // 水平定位：向左稍微叠加 6px 在主框上，无缝衔接消除间隔；右侧超界自适应翻转
      if (popoverRect.right + 260 > windowWidth) {
        this.optJiraDropdownPanel.style.left = 'auto';
        this.optJiraDropdownPanel.style.right = 'calc(100% - 6px)';
      } else {
        this.optJiraDropdownPanel.style.left = 'calc(100% - 6px)';
        this.optJiraDropdownPanel.style.right = 'auto';
      }

      // 垂直定位：向上抬高底端对齐（bottom: 0），避免浮窗过长探出屏幕底部/被任务栏遮挡
      this.optJiraDropdownPanel.style.top = 'auto';
      this.optJiraDropdownPanel.style.bottom = '0px';
    } catch (_) {}
  }

  openLocalProjDropdown() {
    if (!this.optLocalProjDropdownPanel) return;
    this.positionLocalProjDropdown();
    this.optLocalProjDropdownPanel.style.display = 'flex';
    if (this.optLocalProjItem) this.optLocalProjItem.classList.add('open');
    this.localProjNavState = { step: 'servers', serverId: null, workspaceName: null, platform: null };
    if (this.localProjSearchInput) this.localProjSearchInput.value = '';
    this.renderLocalProjPopover('');
  }

  closeLocalProjDropdown() {
    if (this.optLocalProjDropdownPanel) {
      this.optLocalProjDropdownPanel.style.display = 'none';
    }
    if (this.optLocalProjItem) {
      this.optLocalProjItem.classList.remove('open');
    }
  }

  positionLocalProjDropdown() {
    if (!this.optLocalProjItem || !this.optLocalProjDropdownPanel || !this.optionsPopoverEl) return;
    try {
      const popoverRect = this.optionsPopoverEl.getBoundingClientRect();
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

      // 水平定位：向左稍微叠加 6px 在主框上，无缝衔接消除间隔；右侧超界自适应翻转
      if (popoverRect.right + 260 > windowWidth) {
        this.optLocalProjDropdownPanel.style.left = 'auto';
        this.optLocalProjDropdownPanel.style.right = 'calc(100% - 6px)';
      } else {
        this.optLocalProjDropdownPanel.style.left = 'calc(100% - 6px)';
        this.optLocalProjDropdownPanel.style.right = 'auto';
      }

      // 垂直定位：向上抬高底端对齐（bottom: 0），避免浮窗过长探出屏幕底部/被任务栏遮挡
      this.optLocalProjDropdownPanel.style.top = 'auto';
      this.optLocalProjDropdownPanel.style.bottom = '0px';
    } catch (_) {}
  }

  openProjectPopover() {
    if (!this.optionsPopoverEl) return;
    this.closeModelPopover();
    if (this.projectSearchInput) this.projectSearchInput.value = '';
    if (this.gerritSearchInput) this.gerritSearchInput.value = '';
    if (this.jiraSearchInput) this.jiraSearchInput.value = '';
    if (this.localProjSearchInput) this.localProjSearchInput.value = '';
    this.closeProjectDropdown();
    this.closeGerritDropdown();
    this.closeJiraDropdown();
    this.closeLocalProjDropdown();
    this.optionsPopoverEl.style.display = 'flex';
  }

  closeProjectPopover() {
    if (this.optionsPopoverEl) {
      this.optionsPopoverEl.style.display = 'none';
    }
    this.closeProjectDropdown();
    this.closeGerritDropdown();
    this.closeJiraDropdown();
    this.closeLocalProjDropdown();
  }

  renderProjectPopover(filterText = '') {
    if (!this.projectListEl) return;
    const cleanFilter = filterText.toLowerCase();
    const projects = this.getAvailableProjects();
    const filtered = projects.filter(p => {
      if (!cleanFilter) return true;
      return p.id.toLowerCase().includes(cleanFilter) || p.name.toLowerCase().includes(cleanFilter) || p.desc.toLowerCase().includes(cleanFilter);
    });

    if (filtered.length === 0) {
      this.projectListEl.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px;">
          未匹配到包含 "${escapeHtml(filterText)}" 的工程
        </div>
      `;
      return;
    }

    let html = '';
    for (const p of filtered) {
      const isSelected = p.id === (this.selectedProject || 'auto');
      html += `
        <div class="tw-project-item ${isSelected ? 'active' : ''}" data-project-id="${escapeAttr(p.id)}">
          <div class="tw-project-item-info">
            <div class="tw-project-item-title">
              <span>${escapeHtml(p.name)}</span>
            </div>
            <div class="tw-project-item-desc">${escapeHtml(p.desc)}</div>
          </div>
          ${isSelected ? `<span class="tw-project-item-check">${getIconPark('check', 12)}</span>` : ''}
        </div>
      `;
    }

    this.projectListEl.innerHTML = html;

    const items = this.projectListEl.querySelectorAll('.tw-project-item');
    items.forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const projId = el.getAttribute('data-project-id');
        this.saveProject(projId);
        this.closeProjectPopover();
        this.updateProjectSelectorPill();
        const app = this.app || (typeof window !== 'undefined' ? window.app : null);
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
        new NoticeCls(`✓ OpenGrok: ${projId === 'auto' ? 'Auto (智能推断)' : projId}`, 1800);
      };
    });
  }

  renderGerritPopover(filterText = '') {
    if (!this.gerritListEl) return;
    const cleanFilter = filterText.toLowerCase();
    const filters = this.getAvailableGerritFilters();
    const filtered = filters.filter(f => {
      if (!cleanFilter) return true;
      return f.id.toLowerCase().includes(cleanFilter) || f.name.toLowerCase().includes(cleanFilter) || f.desc.toLowerCase().includes(cleanFilter);
    });

    if (filtered.length === 0) {
      this.gerritListEl.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px;">
          未匹配到包含 "${escapeHtml(filterText)}" 的模式
        </div>
      `;
      return;
    }

    let html = '';
    for (const f of filtered) {
      const isSelected = f.id === (this.selectedGerritFilter || 'all');
      html += `
        <div class="tw-project-item ${isSelected ? 'active' : ''}" data-gerrit-filter="${escapeAttr(f.id)}">
          <div class="tw-project-item-info">
            <div class="tw-project-item-title">
              <span>${escapeHtml(f.name)}</span>
            </div>
            <div class="tw-project-item-desc">${escapeHtml(f.desc)}</div>
          </div>
          ${isSelected ? `<span class="tw-project-item-check">${getIconPark('check', 12)}</span>` : ''}
        </div>
      `;
    }

    this.gerritListEl.innerHTML = html;

    const items = this.gerritListEl.querySelectorAll('.tw-project-item');
    items.forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const filterId = el.getAttribute('data-gerrit-filter');
        this.saveGerritFilter(filterId);
        this.closeProjectPopover();
        this.updateProjectSelectorPill();
        const app = this.app || (typeof window !== 'undefined' ? window.app : null);
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
        const currentF = filters.find(x => x.id === filterId);
        new NoticeCls(`✓ Gerrit: ${currentF ? currentF.name : filterId}`, 1800);
      };
    });
  }

  _getJiraService() {
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && plugin.jiraService) return plugin.jiraService;
      if (typeof JiraService === 'function') return new JiraService({ app: this.app });
    } catch (_) {}
    return null;
  }

  async renderJiraPopover(filterText = '', forceRefresh = false) {
    if (!this.jiraListEl) return;
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (this.app?.Notice || class {});
    const svc = this._getJiraService();
    if (!svc) {
      this.jiraListEl.innerHTML = `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">Jira 服务不可用</div>`;
      return;
    }

    if (forceRefresh || !this._jiraIssueCache) {
      // 与「任务」页同源: 优先复用 jiraService 内存缓存与 localStorage 持久缓存 (秒开且两页数据完全一致)
      if (!forceRefresh) {
        if (svc._cache && Array.isArray(svc._cache.issues) && svc._cache.issues.length) {
          this._jiraIssueCache = svc._cache.issues;
        } else {
          try {
            const raw = localStorage.getItem('tabonkb-jira-cache-v1');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length) this._jiraIssueCache = parsed;
            }
          } catch (_) {}
        }
      }
      if (!this._jiraIssueCache) {
        this.jiraListEl.innerHTML = `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">加载工单…</div>`;
        try {
          const res = await svc.searchIssues(forceRefresh);
          this._jiraIssueCache = (res && Array.isArray(res.issues)) ? res.issues : [];
          if (res && res.error && !this._jiraIssueCache.length) {
            this.jiraListEl.innerHTML = `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">${escapeHtml(res.error)}</div>`;
            return;
          }
        } catch (err) {
          this.jiraListEl.innerHTML = `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">加载失败: ${escapeHtml(err.message || String(err))}</div>`;
          return;
        }
      }
    }

    const cleanFilter = (filterText || '').toLowerCase();
    const issues = (this._jiraIssueCache || []).filter(i => {
      if (!cleanFilter) return true;
      return (i.key || '').toLowerCase().includes(cleanFilter)
        || (i.summary || '').toLowerCase().includes(cleanFilter)
        || (i.status || '').toLowerCase().includes(cleanFilter)
        || (i.assigneeName || i.assignee || '').toLowerCase().includes(cleanFilter);
    });

    let html = '';
    if (this.selectedJiraIssue) {
      html += `
        <div class="tw-project-item" data-jira-key="__clear__">
          <div class="tw-project-item-info">
            <div class="tw-project-item-title"><span style="color:var(--text-muted)">清除绑定</span></div>
            <div class="tw-project-item-desc">当前: ${escapeHtml(this.selectedJiraIssue.key)}</div>
          </div>
        </div>`;
    }
    if (issues.length === 0) {
      html += `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">未匹配到工单</div>`;
    } else {
      for (const i of issues.slice(0, 60)) {
        const isSelected = this.selectedJiraIssue && this.selectedJiraIssue.key === i.key;
        html += `
          <div class="tw-project-item ${isSelected ? 'active' : ''}" data-jira-key="${escapeAttr(i.key)}">
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span>${escapeHtml(i.key)}</span>
                <span class="tw-opt-badge-tag">${escapeHtml(i.status || '')}</span>
              </div>
              <div class="tw-project-item-desc">${escapeHtml(i.summary || '')}</div>
            </div>
            ${isSelected ? `<span class="tw-project-item-check">${getIconPark('check', 12)}</span>` : ''}
          </div>`;
      }
    }
    this.jiraListEl.innerHTML = html;

    this.jiraListEl.querySelectorAll('.tw-project-item').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const key = el.getAttribute('data-jira-key');
        if (key === '__clear__') {
          this.saveJiraIssue(null);
          this.closeProjectPopover();
          new NoticeCls('已清除 Jira 工单绑定', 1800);
          return;
        }
        const issue = (this._jiraIssueCache || []).find(x => x.key === key);
        this.saveJiraIssue(issue || { key });
        this.closeProjectPopover();
        new NoticeCls(`✓ Jira: ${key}`, 1800);
      };
    });
  }

  renderLocalProjPopover(filterText = '') {
    if (!this.localProjListEl) return;
    const cleanFilter = filterText.toLowerCase().trim();
    let allProjects = [];
    try {
      if (typeof getAllAvailableLocalProjects === 'function') {
        allProjects = getAllAvailableLocalProjects();
      } else if (typeof require !== 'undefined') {
        const svc = require('./services/local-project-service');
        if (svc && svc.getAllAvailableLocalProjects) allProjects = svc.getAllAvailableLocalProjects();
      }
    } catch (_) {}

    if (!allProjects || allProjects.length === 0) {
      try {
        const basePath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
        const cachePath = path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'local-projects-cache.json');
        if (fs.existsSync(cachePath)) {
          allProjects = JSON.parse(fs.readFileSync(cachePath, 'utf8')) || [];
        }
      } catch (_) {}
    }

    // 1. 如果用户输入了搜索关键词，直接进入「全局快速搜索过滤」模式 (打平直达，标注清晰层级路径)
    if (cleanFilter) {
      if (this.localProjNavHeader) this.localProjNavHeader.style.display = 'none';
      const filtered = allProjects.filter(p => {
        return (p.project && p.project.toLowerCase().includes(cleanFilter)) ||
               (p.platform && p.platform.toLowerCase().includes(cleanFilter)) ||
               (p.workspaceName && p.workspaceName.toLowerCase().includes(cleanFilter)) ||
               (p.label && p.label.toLowerCase().includes(cleanFilter)) ||
               (p.serverId && p.serverId.includes(cleanFilter));
      });

      if (filtered.length === 0) {
        this.localProjListEl.innerHTML = `
          <div style="padding: 16px 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
            未匹配到包含 "${escapeHtml(filterText)}" 的本地工程
          </div>
        `;
        return;
      }

      let html = '';
      const displayList = filtered.slice(0, 50);
      for (const p of displayList) {
        const isSelected = this.selectedLocalProject && this.selectedLocalProject.id === p.id;
        html += `
          <div class="tw-project-item ${isSelected ? 'active' : ''}" data-local-proj-id="${escapeAttr(p.id)}">
            <div class="tw-drill-item-icon tw-drill-proj-icon">
              ${getIconPark(isSelected ? 'check-circle' : 'target', 13)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span class="tw-drill-server-name">${escapeHtml(p.project)}</span>
                <span class="tw-opt-badge-tag">${escapeHtml(p.platform)}</span>
                <span class="tw-opt-badge-tag" style="font-size: 9px;">${escapeHtml(p.serverId)}服</span>
              </div>
              <div class="tw-project-item-desc">${escapeHtml(p.serverId)}服 › ${escapeHtml(p.workspaceName)}</div>
            </div>
            ${isSelected ? `<span class="tw-project-item-check">${getIconPark('check', 12)}</span>` : ''}
          </div>
        `;
      }
      this.localProjListEl.innerHTML = html;
      this.bindLocalProjItemClicks(allProjects);
      return;
    }

    // 2. 构建「服务器 》 总代码路径 》 CPU平台 》 项目」四级层级树
    const serverMap = new Map();
    for (const p of allProjects) {
      if (!serverMap.has(p.serverId)) {
        serverMap.set(p.serverId, {
          id: p.serverId,
          name: p.serverName,
          ip: p.serverIp,
          workspaces: new Map()
        });
      }
      const srv = serverMap.get(p.serverId);
      if (!srv.workspaces.has(p.workspaceName)) {
        srv.workspaces.set(p.workspaceName, {
          name: p.workspaceName,
          platforms: new Map()
        });
      }
      const ws = srv.workspaces.get(p.workspaceName);
      const platKey = p.platform || '通用';
      if (!ws.platforms.has(platKey)) {
        ws.platforms.set(platKey, {
          name: platKey,
          projects: []
        });
      }
      ws.platforms.get(platKey).projects.push(p);
    }

    // State 1: 第一级 —— 服务器列表 (Servers)
    if (!this.localProjNavState || this.localProjNavState.step === 'servers') {
      if (this.localProjNavHeader) this.localProjNavHeader.style.display = 'none';
      if (this.localProjSearchInput) this.localProjSearchInput.placeholder = '全局搜索 (如 K82NF, mt6878)...';

      let html = '';
      // 若当前已选定工程，顶部显示当前卡片与清除按钮
      if (this.selectedLocalProject) {
        html += `
          <div class="tw-project-item active" style="margin-bottom: 6px; border-left: 2px solid #10B981; padding: 7px 9px;">
            <div class="tw-drill-item-icon tw-drill-proj-icon" style="background: rgba(16, 185, 129, 0.12); color: #10B981; border-color: rgba(16, 185, 129, 0.25);">
              ${getIconPark('check-circle', 14)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title" style="color: #10B981; font-weight: 600;">
                <span class="tw-drill-server-name" style="color: #10B981;">已选: ${escapeHtml(this.selectedLocalProject.label)}</span>
                <span class="tw-opt-badge-tag">${escapeHtml(this.selectedLocalProject.serverId)}服</span>
              </div>
              <div class="tw-project-item-desc">${escapeHtml(this.selectedLocalProject.workspaceName)} · ${escapeHtml(this.selectedLocalProject.platform)}</div>
            </div>
            <button type="button" class="tw-local-proj-clear-btn" data-action="clear-project" title="清除工程绑定" style="background:transparent;border:none;cursor:pointer;color:#94A3B8;padding:2px 5px;font-size:10.5px;">
              清除
            </button>
          </div>
        `;
      } else {
        html += `
          <div class="tw-project-item active" style="margin-bottom: 6px; opacity: 0.9; padding: 7px 9px;">
            <div class="tw-drill-item-icon" style="background: rgba(148, 163, 184, 0.1); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.2);">
              ${getIconPark('topic', 13)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span class="tw-drill-server-name">未指定 (默认)</span>
              </div>
              <div class="tw-project-item-desc">不绑定特定工程与机型</div>
            </div>
            <span class="tw-project-item-check">${getIconPark('check', 12)}</span>
          </div>
        `;
      }

      // 列出服务器条目
      for (const [srvId, srv] of serverMap.entries()) {
        let totalPlatforms = 0;
        let totalProjs = 0;
        for (const ws of srv.workspaces.values()) {
          totalPlatforms += ws.platforms.size;
          for (const pl of ws.platforms.values()) {
            totalProjs += pl.projects.length;
          }
        }
        html += `
          <div class="tw-project-item tw-drill-server-item" data-server-id="${escapeAttr(srvId)}">
            <div class="tw-drill-item-icon tw-drill-server-icon">
              ${getIconPark('server', 15)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span class="tw-drill-server-name">${escapeHtml(srv.name)}</span>
                <span class="tw-opt-badge-tag">${escapeHtml(srv.ip)}</span>
              </div>
              <div class="tw-project-item-desc">${srv.workspaces.size} 套代码 · ${totalPlatforms} 个平台 · ${totalProjs} 款机型</div>
            </div>
            <span class="tw-drill-arrow">${getIconPark('right', 11)}</span>
          </div>
        `;
      }

      this.localProjListEl.innerHTML = html;

      const clearBtn = this.localProjListEl.querySelector('[data-action="clear-project"]');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          this.saveLocalProject(null);
          this.renderLocalProjPopover('');
          const app = this.app || (typeof window !== 'undefined' ? window.app : null);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
          new NoticeCls('✓ 已清除本地工程绑定', 1800);
        };
      }

      const srvItems = this.localProjListEl.querySelectorAll('.tw-drill-server-item');
      srvItems.forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const srvId = el.getAttribute('data-server-id');
          this.localProjNavState = { step: 'workspaces', serverId: srvId, workspaceName: null, platform: null };
          if (this.localProjSearchInput) this.localProjSearchInput.value = '';
          this.renderLocalProjPopover('');
        };
      });
      return;
    }

    // State 2: 第二级 —— 总代码路径列表 (Workspaces)
    if (this.localProjNavState.step === 'workspaces') {
      const srvId = this.localProjNavState.serverId;
      const srv = serverMap.get(srvId);
      if (!srv) {
        this.localProjNavState = { step: 'servers', serverId: null, workspaceName: null, platform: null };
        this.renderLocalProjPopover('');
        return;
      }

      if (this.localProjNavHeader) {
        this.localProjNavHeader.style.display = 'flex';
        if (this.localProjBackText) this.localProjBackText.textContent = '服务器';
        if (this.localProjNavTitle) this.localProjNavTitle.textContent = `${srv.name} (${srv.workspaces.size}套代码)`;
      }
      if (this.localProjSearchInput) this.localProjSearchInput.placeholder = '过滤代码路径...';

      let workspaceEntries = Array.from(srv.workspaces.entries());
      if (cleanFilter) {
        workspaceEntries = workspaceEntries.filter(([wsName, ws]) => {
          if (wsName.toLowerCase().includes(cleanFilter)) return true;
          for (const pl of ws.platforms.values()) {
            if (pl.name.toLowerCase().includes(cleanFilter)) return true;
            if (pl.projects.some(p => p.project.toLowerCase().includes(cleanFilter))) return true;
          }
          return false;
        });
      }

      if (workspaceEntries.length === 0) {
        this.localProjListEl.innerHTML = `
          <div style="padding: 16px 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
            当前服务器未匹配到包含 "${escapeHtml(filterText)}" 的代码路径
            <div style="margin-top: 8px;">
              <button type="button" class="tw-btn tw-btn-sm" data-action="switch-global" style="font-size: 10.5px; padding: 3px 8px;">切换至全局搜索</button>
            </div>
          </div>
        `;
        const gBtn = this.localProjListEl.querySelector('[data-action="switch-global"]');
        if (gBtn) {
          gBtn.onclick = (e) => {
            e.stopPropagation();
            this.localProjNavState = { step: 'servers', serverId: null, workspaceName: null, platform: null };
            this.renderLocalProjPopover(filterText);
          };
        }
        return;
      }

      let html = '';
      for (const [wsName, ws] of workspaceEntries) {
        let wsProjectsCount = 0;
        for (const pl of ws.platforms.values()) wsProjectsCount += pl.projects.length;
        const isCurrentWs = this.selectedLocalProject && this.selectedLocalProject.serverId === srvId && this.selectedLocalProject.workspaceName === wsName;
        html += `
          <div class="tw-project-item tw-drill-ws-item ${isCurrentWs ? 'active' : ''}" data-workspace-name="${escapeAttr(wsName)}">
            <div class="tw-drill-item-icon tw-drill-ws-icon">
              ${getIconPark('folder', 14)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span class="tw-drill-server-name">${escapeHtml(wsName)}</span>
              </div>
              <div class="tw-project-item-desc">${ws.platforms.size} 个平台 · ${wsProjectsCount} 款机型</div>
            </div>
            <span class="tw-drill-arrow">${getIconPark('right', 11)}</span>
          </div>
        `;
      }

      this.localProjListEl.innerHTML = html;

      const wsItems = this.localProjListEl.querySelectorAll('.tw-drill-ws-item');
      wsItems.forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const wsName = el.getAttribute('data-workspace-name');
          this.localProjNavState = { step: 'platforms', serverId: srvId, workspaceName: wsName, platform: null };
          if (this.localProjSearchInput) this.localProjSearchInput.value = '';
          this.renderLocalProjPopover('');
        };
      });
      return;
    }

    // State 3: 第三级 —— CPU平台列表 (Platforms)
    if (this.localProjNavState.step === 'platforms') {
      const srvId = this.localProjNavState.serverId;
      const wsName = this.localProjNavState.workspaceName;
      const srv = serverMap.get(srvId);
      const ws = srv ? srv.workspaces.get(wsName) : null;
      if (!ws) {
        this.localProjNavState = { step: 'workspaces', serverId: srvId, workspaceName: null, platform: null };
        this.renderLocalProjPopover('');
        return;
      }

      const wsShort = wsName.split('/').pop();
      if (this.localProjNavHeader) {
        this.localProjNavHeader.style.display = 'flex';
        if (this.localProjBackText) this.localProjBackText.textContent = '代码路径';
        if (this.localProjNavTitle) this.localProjNavTitle.textContent = `${wsShort} (${ws.platforms.size}个平台)`;
      }
      if (this.localProjSearchInput) this.localProjSearchInput.placeholder = '过滤CPU平台 (如 mt6878)...';

      let platformEntries = Array.from(ws.platforms.entries());
      if (cleanFilter) {
        platformEntries = platformEntries.filter(([platKey, pl]) => {
          if (platKey.toLowerCase().includes(cleanFilter)) return true;
          return pl.projects.some(p => p.project.toLowerCase().includes(cleanFilter));
        });
      }

      if (platformEntries.length === 0) {
        this.localProjListEl.innerHTML = `
          <div style="padding: 16px 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
            当前代码路径未匹配到包含 "${escapeHtml(filterText)}" 的平台
            <div style="margin-top: 8px;">
              <button type="button" class="tw-btn tw-btn-sm" data-action="switch-global" style="font-size: 10.5px; padding: 3px 8px;">切换至全局搜索</button>
            </div>
          </div>
        `;
        const gBtn = this.localProjListEl.querySelector('[data-action="switch-global"]');
        if (gBtn) {
          gBtn.onclick = (e) => {
            e.stopPropagation();
            this.localProjNavState = { step: 'servers', serverId: null, workspaceName: null, platform: null };
            this.renderLocalProjPopover(filterText);
          };
        }
        return;
      }

      let html = '';
      for (const [platKey, pl] of platformEntries) {
        const isCurrentPlat = this.selectedLocalProject &&
          this.selectedLocalProject.serverId === srvId &&
          this.selectedLocalProject.workspaceName === wsName &&
          this.selectedLocalProject.platform === platKey;
        html += `
          <div class="tw-project-item tw-drill-plat-item ${isCurrentPlat ? 'active' : ''}" data-platform-name="${escapeAttr(platKey)}">
            <div class="tw-drill-item-icon tw-drill-plat-icon">
              ${getIconPark('cpu', 14)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span class="tw-drill-server-name">${escapeHtml(platKey)}</span>
                <span class="tw-opt-badge-tag">${pl.projects.length}款机型</span>
              </div>
              <div class="tw-project-item-desc">${escapeHtml(srvId)}服 › ${escapeHtml(wsName)}</div>
            </div>
            <span class="tw-drill-arrow">${getIconPark('right', 11)}</span>
          </div>
        `;
      }

      this.localProjListEl.innerHTML = html;

      const platItems = this.localProjListEl.querySelectorAll('.tw-drill-plat-item');
      platItems.forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const platKey = el.getAttribute('data-platform-name');
          this.localProjNavState = { step: 'projects', serverId: srvId, workspaceName: wsName, platform: platKey };
          if (this.localProjSearchInput) this.localProjSearchInput.value = '';
          this.renderLocalProjPopover('');
        };
      });
      return;
    }

    // State 4: 第四级 —— 具体项目 SKU 列表 (Projects)
    if (this.localProjNavState.step === 'projects') {
      const srvId = this.localProjNavState.serverId;
      const wsName = this.localProjNavState.workspaceName;
      const platKey = this.localProjNavState.platform;
      const srv = serverMap.get(srvId);
      const ws = srv ? srv.workspaces.get(wsName) : null;
      const pl = ws ? ws.platforms.get(platKey) : null;
      if (!pl) {
        this.localProjNavState = { step: 'platforms', serverId: srvId, workspaceName: wsName, platform: null };
        this.renderLocalProjPopover('');
        return;
      }

      if (this.localProjNavHeader) {
        this.localProjNavHeader.style.display = 'flex';
        if (this.localProjBackText) this.localProjBackText.textContent = `${platKey}平台`;
        if (this.localProjNavTitle) this.localProjNavTitle.textContent = `${platKey} (${pl.projects.length}款机型)`;
      }
      if (this.localProjSearchInput) this.localProjSearchInput.placeholder = '过滤项目 (如 K82NF)...';

      let displayProjects = pl.projects;
      if (cleanFilter) {
        displayProjects = displayProjects.filter(p => {
          return p.project.toLowerCase().includes(cleanFilter) ||
                 (p.label && p.label.toLowerCase().includes(cleanFilter));
        });
      }

      if (displayProjects.length === 0) {
        this.localProjListEl.innerHTML = `
          <div style="padding: 16px 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
            当前平台未匹配到包含 "${escapeHtml(filterText)}" 的机型
            <div style="margin-top: 8px;">
              <button type="button" class="tw-btn tw-btn-sm" data-action="switch-global" style="font-size: 10.5px; padding: 3px 8px;">切换至全局搜索</button>
            </div>
          </div>
        `;
        const gBtn = this.localProjListEl.querySelector('[data-action="switch-global"]');
        if (gBtn) {
          gBtn.onclick = (e) => {
            e.stopPropagation();
            this.localProjNavState = { step: 'servers', serverId: null, workspaceName: null, platform: null };
            this.renderLocalProjPopover(filterText);
          };
        }
        return;
      }

      let html = '';
      for (const p of displayProjects) {
        const isSelected = this.selectedLocalProject && this.selectedLocalProject.id === p.id;
        html += `
          <div class="tw-project-item ${isSelected ? 'active' : ''}" data-local-proj-id="${escapeAttr(p.id)}">
            <div class="tw-drill-item-icon tw-drill-proj-icon">
              ${getIconPark(isSelected ? 'check-circle' : 'target', 13)}
            </div>
            <div class="tw-project-item-info">
              <div class="tw-project-item-title">
                <span class="tw-drill-server-name">${escapeHtml(p.project)}</span>
                <span class="tw-opt-badge-tag">${escapeHtml(p.platform)}</span>
              </div>
              <div class="tw-project-item-desc">${escapeHtml(p.priDriverRel)}</div>
            </div>
            ${isSelected ? `<span class="tw-project-item-check">${getIconPark('check', 12)}</span>` : ''}
          </div>
        `;
      }

      this.localProjListEl.innerHTML = html;
      this.bindLocalProjItemClicks(allProjects);
      return;
    }
  }

  bindLocalProjItemClicks(allProjects) {
    if (!this.localProjListEl) return;
    const items = this.localProjListEl.querySelectorAll('.tw-project-item[data-local-proj-id]');
    items.forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const projId = el.getAttribute('data-local-proj-id');
        if (projId === 'none') {
          this.saveLocalProject(null);
          this.closeProjectPopover();
          const app = this.app || (typeof window !== 'undefined' ? window.app : null);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
          new NoticeCls('✓ 已清除本地工程绑定', 1800);
        } else {
          const targetProj = allProjects.find(x => x.id === projId);
          if (targetProj) {
            this.saveLocalProject(targetProj);
            this.closeProjectPopover();
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls(`✓ 本地工程已锁定: ${targetProj.label} (${targetProj.serverName})`, 2200);
          }
        }
      };
    });
  }


  updateProjectSelectorPill() {
    if (!this.optionsWrapEl) return;
    this.updateSessionCtxHints();
    const isNiceAigc = this.hub.activeAgentId === 'niceaigc';
    if (isNiceAigc) {
      this.optionsWrapEl.style.display = 'none';
      return;
    }
    this.optionsWrapEl.style.display = 'inline-flex';

    // 1. 本地工程状态 (最高优先级)
    const isCustomLocalProj = Boolean(this.selectedLocalProject && this.selectedLocalProject.id && this.selectedLocalProject.id !== 'none');
    const localProjShort = isCustomLocalProj ? (this.selectedLocalProject.label || this.selectedLocalProject.project) : '未指定';
    if (this.localProjNameEl) {
      this.localProjNameEl.textContent = localProjShort;
      this.localProjNameEl.title = isCustomLocalProj
        ? `本地工程: ${this.selectedLocalProject.workspaceName} · ${this.selectedLocalProject.platform}/${this.selectedLocalProject.project}`
        : '未指定本地工程';
    }

    // 2. OpenGrok 标签与状态 (若本地工程已选则提示工程优先)
    const isAuto = !this.selectedProject || this.selectedProject === 'auto';
    let label = isAuto ? 'Auto' : this.selectedProject;
    if (this.projectNameEl) {
      if (isCustomLocalProj) {
        this.projectNameEl.textContent = `${label} (工程优先)`;
        this.projectNameEl.title = `已指定本地工程 ${localProjShort} (最高优先级真理源)；OpenGrok 作为辅助参考`;
      } else {
        this.projectNameEl.textContent = label;
        this.projectNameEl.title = isAuto ? 'Auto (智能推断)' : this.selectedProject;
      }
    }

    // 3. Gerrit 标签与状态 (极简短标签 <= 6 字符)
    const gerritMap = { all: '全部', open: '开放中', merged: '已合入', mine: '我提交', reviewing: '待我审' };
    const gerritLabel = gerritMap[this.selectedGerritFilter || 'all'] || '全部';
    if (this.gerritFilterEl) {
      this.gerritFilterEl.textContent = gerritLabel;
      this.gerritFilterEl.title = `Gerrit: ${gerritLabel}`;
    }

    // 3.5 Jira 工单绑定状态
    const isCustomJira = Boolean(this.selectedJiraIssue && this.selectedJiraIssue.key);
    const jiraLabel = isCustomJira ? this.selectedJiraIssue.key : '未指定';
    if (this.jiraIssueEl) {
      this.jiraIssueEl.textContent = jiraLabel;
      this.jiraIssueEl.title = isCustomJira ? `Jira: ${jiraLabel} ${this.selectedJiraIssue.summary || ''}` : '未绑定工单';
    }

    // 4. 激活高亮与红点逻辑 (当任意配置非默认时触发)
    const isCustomGerrit = this.selectedGerritFilter && this.selectedGerritFilter !== 'all';
    const hasCustomOption = !isAuto || isCustomGerrit || isCustomLocalProj || isCustomJira;
    if (this.optionsBadgeDot) {
      this.optionsBadgeDot.style.display = hasCustomOption ? 'block' : 'none';
    }
    if (this.optionsBtnEl) {
      if (hasCustomOption) {
        this.optionsBtnEl.classList.add('has-active');
      } else {
        this.optionsBtnEl.classList.remove('has-active');
      }
      let tipParts = [];
      if (isCustomLocalProj) tipParts.push(`本地工程: ${localProjShort}`);
      if (!isAuto) tipParts.push(`OpenGrok: ${label}`);
      if (isCustomGerrit) tipParts.push(`Gerrit: ${gerritLabel}`);
      if (isCustomJira) tipParts.push(`Jira: ${jiraLabel}`);
      this.optionsBtnEl.title = tipParts.length ? `选项 (${tipParts.join(' | ')})` : '选项配置';
    }

    // 5. 动态联动输入框 placeholder 提示当前最高优先级工程
    this.updateInputPlaceholder();
  }

  // 会话上下文提示条: 输入卡上方迷你胶囊, 标注当前会话绑定的 Jira/本地工程/OpenGrok/Gerrit; 点胶囊打开选项浮窗, × 即解除绑定
  updateSessionCtxHints() {
    if (!this.sessionCtxEl) return;
    const isNiceAigc = this.hub && this.hub.activeAgentId === 'niceaigc';
    const chips = [];
    if (!isNiceAigc) {
      const isCustomLocalProj = Boolean(this.selectedLocalProject && this.selectedLocalProject.id && this.selectedLocalProject.id !== 'none');
      const isCustomJira = Boolean(this.selectedJiraIssue && this.selectedJiraIssue.key);
      const isAutoGrok = !this.selectedProject || this.selectedProject === 'auto';
      const isCustomGerrit = this.selectedGerritFilter && this.selectedGerritFilter !== 'all';
      if (isCustomLocalProj) {
        const lp = this.selectedLocalProject;
        chips.push({ type: 'local', icon: 'folder', label: lp.label || lp.project, tip: `本地工程: ${lp.workspaceName} · ${lp.platform}/${lp.project}`, clear: () => this.saveLocalProject(null) });
      }
      if (isCustomJira) {
        const ji = this.selectedJiraIssue;
        chips.push({ type: 'jira', icon: 'tasks', label: ji.key, tip: `Jira: ${ji.key} ${ji.summary || ''}`, clear: () => this.saveJiraIssue(null) });
      }
      // 本地工程绑定时 OpenGrok 约束在注入层被整体跳过, 不再重复展示以免误导
      if (!isAutoGrok && !isCustomLocalProj) {
        chips.push({ type: 'opengrok', icon: 'code', label: this.selectedProject, tip: `OpenGrok: ${this.selectedProject}`, clear: () => this.saveProject('auto') });
      }
      if (isCustomGerrit) {
        const gerritMap = { open: '开放中', merged: '已合入', mine: '我提交', reviewing: '待我审' };
        const gLabel = gerritMap[this.selectedGerritFilter] || this.selectedGerritFilter;
        chips.push({ type: 'gerrit', icon: 'link', label: `Gerrit ${gLabel}`, tip: `Gerrit 过滤: ${gLabel}`, clear: () => this.saveGerritFilter('all') });
      }
    }
    if (!chips.length) {
      this.sessionCtxEl.style.display = 'none';
      this.sessionCtxEl.innerHTML = '';
      return;
    }
    this.sessionCtxEl.style.display = 'flex';
    this.sessionCtxEl.innerHTML = chips.map((c, idx) => `
      <span class="tw-sctx-chip tw-sctx-${c.type}" data-idx="${idx}" title="${escapeAttr(c.tip)}">
        <span class="tw-sctx-icon">${getIconPark(c.icon, 11)}</span>
        <span class="tw-sctx-label">${escapeHtml(c.label)}</span>
        <span class="tw-sctx-x tw-ctx-clear-btn" role="button" tabindex="0" title="解除绑定">${getIconPark('close', 10)}</span>
      </span>
    `).join('');
    this.sessionCtxEl.querySelectorAll('.tw-sctx-chip').forEach((el) => {
      const chip = chips[Number(el.getAttribute('data-idx'))];
      if (!chip) return;
      el.onclick = (e) => {
        e.stopPropagation();
        if (typeof this.openProjectPopover === 'function') this.openProjectPopover();
      };
      const x = el.querySelector('.tw-sctx-x');
      if (x) {
        x.onclick = (e) => { e.stopPropagation(); chip.clear(); };
        x.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); chip.clear(); }
        };
      }
    });
  }

  async switchAgent(agentId) {
    if (this.hub.activeAgentId === agentId) {
      this.syncActiveAgentUI();
      return;
    }

    // 1. Save draft for current agent
    if (this.inputEl && this.hub && this.hub.activeAgentId) {
      this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
    }

    // 2. Finalize any ongoing assistant message for current agent
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    // 3. Switch in Hub
    await this.hub.switchAgent(agentId);
    const adapter = this.hub.getActiveAdapter();
    if (adapter && typeof adapter._syncSessionConversation === 'function') {
      adapter._syncSessionConversation();
    }

    // 4. Update UI labels and selector
    this.syncActiveAgentUI();

    // 5. Restore Draft & Chips
    if (this.inputEl) {
      this.inputEl.value = this.hub.sessionManager.getDraft(agentId) || '';
      this._restoreChips(agentId);
      const savedH = this.getSavedInputHeight();
      this.inputHeight = savedH;
      const targetH = Math.max(savedH, Math.min(500, this.inputEl.scrollHeight || savedH));
      this.inputEl.style.height = `${targetH}px`;
    }

    // 6. Restore Message History
    this.restoreSessionMessages(agentId);

    // 7. Check if installed and show warning if needed
    this.checkAdapterInstalledState(adapter);

    // 8. Update context capsule & toolbar states
    this.updateContextCapsule();
    this.updateCardAttachments();
    this.updateSendButtonState();
    if (this.historyPanelEl) this.historyPanelEl.style.display = 'none';

    // 9. Update status LED & label immediately, and auto-start if disconnected
    this.updateStatus(adapter.getStatus());
    if (adapter.status === 'disconnected' && typeof adapter.start === 'function') {
      this.updateStatus({ status: 'connecting', detail: '连接中...' });
      adapter.start().then(() => {
        this.updateStatus(adapter.getStatus());
      }).catch(() => {
        this.updateStatus(adapter.getStatus());
      });
    }

    // 10. Notify external listeners (e.g. main workbench top bar)
    this.notifyAgentChange(agentId);
  }

  syncActiveAgentUI() {
    const adapter = this.hub.getActiveAdapter();
    const agents = this.hub.getAgentList();
    const meta = agents.find(a => a.id === this.hub.activeAgentId) || { name: 'Pi', icon: getAgentBrandSvg('pi', 16), displayName: 'Pi Agent' };

    if (this.agentIconEl) this.agentIconEl.innerHTML = meta.icon;
    if (this.agentNameEl) this.agentNameEl.textContent = meta.displayName || meta.name;
    if (this.cardModelIconEl) this.cardModelIconEl.innerHTML = meta.icon;
    if (this.cardModelNameEl) this.cardModelNameEl.textContent = meta.displayName || meta.name;

    this.updateModelSelectorPill();
    this.updateProjectSelectorPill();
    this.updateInputPlaceholder();
  }

  updateInputPlaceholder() {
    if (!this.inputEl || !this.hub) return;
    const adapter = this.hub.getActiveAdapter();
    const agents = typeof this.hub.getAgentList === 'function' ? this.hub.getAgentList() : [];
    const meta = agents.find(a => a.id === this.hub.activeAgentId) || {
      name: adapter?.name || 'Agent',
      displayName: adapter?.displayName || adapter?.name || 'Agent'
    };
    const agentName = meta.displayName || meta.name || 'Agent';

    let modelSuffix = '';
    const currentModel = typeof adapter?.getModel === 'function' ? adapter.getModel() : null;
    if (currentModel?.name && currentModel.name !== agentName) {
      let mName = currentModel.name;
      if (typeof adapter?.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel.id)) {
        const effortConfig = typeof adapter?.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
        if (effortConfig && effortConfig.label) mName += ` · ${effortConfig.label}`;
      }
      modelSuffix = ` (${mName})`;
    }

    const isCustomLocalProj = Boolean(this.selectedLocalProject && this.selectedLocalProject.id && this.selectedLocalProject.id !== 'none');
    const localProjShort = isCustomLocalProj ? (this.selectedLocalProject.label || this.selectedLocalProject.project) : '';
    const isCustomJira = Boolean(this.selectedJiraIssue && this.selectedJiraIssue.key);
    const jiraKey = isCustomJira ? this.selectedJiraIssue.key : '';

    let ctxTag = '';
    if (localProjShort && jiraKey) {
      ctxTag = ` [${localProjShort} · ${jiraKey}]`;
    } else if (localProjShort) {
      ctxTag = ` [${localProjShort}]`;
    } else if (jiraKey) {
      ctxTag = ` [${jiraKey}]`;
    }

    const basePlaceholder = `向 ${agentName}${modelSuffix}${ctxTag} 提问... (Enter 发送)`;
    this._inputPlaceholder = basePlaceholder;

    const hasChips = !!(this.inputChips && this.inputChips.length);
    this.inputEl.placeholder = hasChips ? '输入消息内容...' : basePlaceholder;
  }

  checkAdapterInstalledState(adapter) {
    if (!this.warningBannerEl) return;

    if (adapter.status === 'not_installed') {
      let installCmd = '';
      if (adapter.id === 'hermes') {
        installCmd = 'npm install -g hermes-cli';
      } else if (adapter.id === 'gemini') {
        installCmd = 'npm install -g @google/gemini-cli';
      }

      this.warningBannerEl.style.display = 'block';
      this.warningBannerEl.innerHTML = `
        <div class="tw-banner-content">
          <span class="tw-banner-icon">${getIconPark('alert', 15)}</span>
          <div class="tw-banner-text">
            <strong>未检测到 ${escapeHtml(adapter.displayName)} CLI</strong>
            <span>请在本地终端安装：<code class="tw-banner-cmd">${installCmd}</code> 并配置环境。</span>
          </div>
        </div>
      `;
      if (this.btnSend) this.btnSend.disabled = true;
    } else {
      this.warningBannerEl.style.display = 'none';
      if (this.btnSend && !this.hub.isStreaming()) {
        this.btnSend.disabled = false;
      }
    }
  }

  restoreSessionMessages(agentId) {
    if (!this.messagesEl) return;
    this.messagesEl.innerHTML = '';
    this.activeToolCards.clear();
    this.currentAssistantMessage = null;

    if (this.stickyHeaderEl) {
      this.stickyHeaderEl.classList.remove('visible');
      const qText = this.stickyHeaderEl.querySelector('.tw-sticky-q-text');
      if (qText) qText.textContent = '';
    }
    this._minimapBubbles = [];

    const messages = this.hub.sessionManager.getMessages(agentId);
    if (!messages || messages.length === 0) {
      // Empty state: do not render bulky welcome card (per user request)
      if (typeof this.buildChatMinimap === 'function') this.buildChatMinimap();
      if (typeof this.updateStickyQuestion === 'function') this.updateStickyQuestion();
      return;
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        this.renderPastUserMessage(msg);
      } else {
        this.renderPastAssistantMessage(msg);
      }
    }
    this.scrollToBottom(true);
    if (typeof this.buildChatMinimap === 'function') this.buildChatMinimap();
    if (typeof this.updateStickyQuestion === 'function') this.updateStickyQuestion();
  }

  resolveImageSrc(img) {
    if (!img) return '';
    if (img.dataUrl && typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:')) {
      return img.dataUrl;
    }
    const relOrAbs = img.path || (typeof img === 'string' ? img : '');
    if (!relOrAbs) return '';

    // 1. Obsidian Vault Adapter resource path (app:// local protocol on desktop)
    try {
      if (this.app?.vault?.adapter && typeof this.app.vault.adapter.getResourcePath === 'function') {
        const res = this.app.vault.adapter.getResourcePath(relOrAbs);
        if (res) return res;
      }
    } catch (_) {}

    // 2. Absolute filesystem path fallback
    try {
      const path = require('path');
      const basePath = this.vaultBasePath || (this.app?.vault?.adapter?.basePath) || '';
      const absPath = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(basePath, relOrAbs);
      return `app://local/${absPath.replace(/\\/g, '/')}`;
    } catch (_) {}

    return relOrAbs;
  }

  renderPastUserMessage(msg) {
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap user';

    let badgeHtml = '';
    if (msg.badge) {
      badgeHtml = `<div class="tw-user-context-pill">${getIconPark('target', 12)} <span>${escapeHtml(msg.badge)}</span></div>`;
    }

    const timeStr = this.formatTime(msg.timestamp);

    bubbleWrap.innerHTML = `
      <div class="tw-user-bubble-box">
        ${badgeHtml}
        <div class="tw-msg-user-images"></div>
        ${msg.text ? `<div class="tw-msg-content" data-raw="${escapeAttr(msg.text || '')}">${escapeHtml(msg.text).replace(/\\n/g, '<br>')}</div>` : ''}
      </div>
      <div class="tw-user-meta-bar">
        <span class="tw-user-msg-time">${timeStr}</span>
        <button class="tw-user-copy-btn" title="复制提问内容">${DSH_ICONS.copy}</button>
        <button class="tw-user-edit-btn" title="回退到此条并重写（开新分支）">${DSH_ICONS.undo}</button>
        <button class="tw-user-del-btn" title="删除此条及之后内容（开新分支）">${DSH_ICONS.trash}</button>
      </div>
    `;

    const imagesContainer = bubbleWrap.querySelector('.tw-msg-user-images');
    if (msg.images && msg.images.length > 0 && imagesContainer) {
      for (const img of msg.images) {
        const src = this.resolveImageSrc(img);
        if (src) {
          const imgEl = document.createElement('img');
          imgEl.className = 'tw-msg-user-img';
          imgEl.dataset.scale = '50%';
          imgEl.alt = img.name || 'image';
          imgEl.title = '左键预览大图 · 右键选择大小与复制';
          imgEl.src = src;
          imagesContainer.appendChild(imgEl);
        }
      }
    } else if (imagesContainer) {
      imagesContainer.remove();
    }

    const copyBtn = bubbleWrap.querySelector('.tw-user-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(msg.text || '');
          const prevHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = DSH_ICONS.check;
          setTimeout(() => { copyBtn.innerHTML = prevHtml; }, 1800);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (window.app?.Notice || class{});
          new NoticeCls('✓ 提问内容已复制到剪贴板', 1800);
        } catch (_) {}
      };
    }

    bubbleWrap._msgRef = msg;
    this._bindUserMsgActions(bubbleWrap, msg);
    this.messagesEl.appendChild(bubbleWrap);
  }

  renderPastAssistantMessage(msg) {
    const adapter = this.hub.getActiveAdapter();
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap assistant';

    const authorName = msg.model || adapter.displayName;

    // Extract inline <think> if stored in msg.text
    let displayThinking = msg.thinking || '';
    let displayText = msg.text || '';
    if (!displayThinking && displayText.includes('<think>')) {
      const thinkMatch = displayText.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        displayThinking = thinkMatch[1].trim();
        displayText = displayText.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
      }
    }

    const durationText = msg.durationText || (msg.duration ? this.formatDuration(msg.duration) : '2秒');
    const summary = this.generateToolSummary(msg.toolCalls, displayThinking);

    // 1. DSH Process Banner (collapsed by default for past messages)
    const banner = document.createElement('div');
    banner.className = 'tw-dsh-process-banner collapsed';
    banner.innerHTML = `
      <div class="tw-dsh-banner-header">
        <span class="tw-dsh-banner-status-text">已完成，用时 ${escapeHtml(durationText)}</span>
        <span class="tw-dsh-banner-chevron">${DSH_ICONS.chevronDown}</span>
      </div>
      <div class="tw-dsh-banner-divider"></div>
      <div class="tw-dsh-banner-body"></div>
    `;

    const bannerHeader = banner.querySelector('.tw-dsh-banner-header');
    bannerHeader.onclick = () => {
      banner.classList.toggle('collapsed');
      const chevron = bannerHeader.querySelector('.tw-dsh-banner-chevron');
      if (chevron) {
        chevron.innerHTML = banner.classList.contains('collapsed') ? DSH_ICONS.chevronDown : DSH_ICONS.chevronUp;
      }
    };

    const bannerBody = banner.querySelector('.tw-dsh-banner-body');

    if (Array.isArray(msg.processSteps) && msg.processSteps.length > 0) {
      for (const step of msg.processSteps) {
        const marker = document.createElement('div');
        marker.className = 'tw-dsh-step-marker';
        const iconSvg = step.icon === 'sparkle' ? DSH_ICONS.sparkle : DSH_ICONS.fileText;
        marker.innerHTML = `
          <span class="tw-dsh-step-icon">${iconSvg}</span>
          <span class="tw-dsh-step-label">${escapeHtml(step.label || '已调用工具')}</span>
        `;
        bannerBody.appendChild(marker);

        if (step.text && step.text.trim()) {
          const prose = document.createElement('div');
          prose.className = 'tw-dsh-thinking-prose';
          prose.textContent = step.text.trim();
          bannerBody.appendChild(prose);
        }
      }
    } else {
      const hasTools = Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0;
      const hasThinking = Boolean(displayThinking && displayThinking.trim().length > 0);

      if (hasTools && hasThinking) {
        const marker1 = document.createElement('div');
        marker1.className = 'tw-dsh-step-marker';
        marker1.innerHTML = `
          <span class="tw-dsh-step-icon">${DSH_ICONS.sparkle}</span>
          <span class="tw-dsh-step-label">已调用工具</span>
        `;
        bannerBody.appendChild(marker1);

        const prose1 = document.createElement('div');
        prose1.className = 'tw-dsh-thinking-prose';
        prose1.textContent = displayThinking.trim();
        bannerBody.appendChild(prose1);

        const marker2 = document.createElement('div');
        marker2.className = 'tw-dsh-step-marker';
        const toolSummary = this.generateBatchToolSummary(msg.toolCalls);
        marker2.innerHTML = `
          <span class="tw-dsh-step-icon">${DSH_ICONS.fileText}</span>
          <span class="tw-dsh-step-label">${escapeHtml(toolSummary)}</span>
        `;
        bannerBody.appendChild(marker2);
      } else if (hasTools) {
        const marker = document.createElement('div');
        marker.className = 'tw-dsh-step-marker';
        const toolSummary = this.generateBatchToolSummary(msg.toolCalls);
        marker.innerHTML = `
          <span class="tw-dsh-step-icon">${DSH_ICONS.fileText}</span>
          <span class="tw-dsh-step-label">${escapeHtml(toolSummary)}</span>
        `;
        bannerBody.appendChild(marker);
      } else if (hasThinking) {
        const marker = document.createElement('div');
        marker.className = 'tw-dsh-step-marker';
        marker.innerHTML = `
          <span class="tw-dsh-step-icon">${DSH_ICONS.sparkle}</span>
          <span class="tw-dsh-step-label">思考过程</span>
        `;
        bannerBody.appendChild(marker);

        const prose = document.createElement('div');
        prose.className = 'tw-dsh-thinking-prose';
        prose.textContent = displayThinking.trim();
        bannerBody.appendChild(prose);
      }
    }

    const hasProcess = (Array.isArray(msg.processSteps) && msg.processSteps.length > 0) ||
      (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) ||
      Boolean(displayThinking && displayThinking.trim().length > 0);

    if (hasProcess) {
      bubbleWrap.appendChild(banner);
    }

    // 2. Flat Content
    const contentEl = document.createElement('div');
    contentEl.className = 'tw-msg-content';
    contentEl.setAttribute('data-raw', displayText || '');
    bubbleWrap.appendChild(contentEl);
    this.formatMessageContent(contentEl, displayText || '');

    // 3. Bottom Action Bar
    const timeStr = this.formatTime(msg.timestamp);
    const providerAndModel = (adapter.displayName || adapter.name) + ' / ' + (authorName || 'AI');

    let usageData = msg.usage || null;
    if (!usageData || !usageData.totalTokens || usageData.totalTokens <= 0) {
      const outTok = Math.max(1, Math.round(((displayText || '').length + (displayThinking?.length || 0)) * 0.75));
      const inTok = Math.max(120, Math.round(outTok * 1.5 + 450));
      usageData = {
        inputTokens: inTok,
        outputTokens: outTok,
        cacheReadTokens: Math.round(inTok * 0.4),
        totalTokens: inTok + outTok
      };
    }
    usageData.providerAndModel = usageData.providerAndModel || providerAndModel;
    usageData.durationText = usageData.durationText || durationText;

    const actionBar = document.createElement('div');
    actionBar.className = 'tw-msg-action-bar';
    actionBar.innerHTML = `
      <div class="tw-action-group-left">
        <button type="button" class="tw-dsh-action-btn tw-action-copy-btn" title="复制回答全文">${DSH_ICONS.copy}</button>
        <div class="tw-dsh-usage-wrap">
          <button type="button" class="tw-dsh-usage-btn" title="查看本轮 Token 用量明细">
            <span class="tw-dsh-usage-icon">${DSH_ICONS.database}</span>
            <span class="tw-dsh-usage-text">用量 ${this.formatTokensPill(usageData.totalTokens)}</span>
          </button>
        </div>
        <span class="tw-msg-timestamp">${timeStr}</span>
      </div>
    `;

    const copyBtn = actionBar.querySelector('.tw-action-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(displayText || '');
          const prevHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = DSH_ICONS.check;
          setTimeout(() => { copyBtn.innerHTML = prevHtml; }, 1800);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (window.app?.Notice || class{});
          new NoticeCls('✓ 回答全文已复制到剪贴板', 2000);
        } catch (_) {}
      };
    }

    const usageBtn = actionBar.querySelector('.tw-dsh-usage-btn');
    if (usageBtn) {
      usageBtn.onclick = (e) => {
        e.stopPropagation();
        this.showTokenUsagePopover(usageBtn, usageData);
      };
    }

    bubbleWrap.appendChild(actionBar);
    this.messagesEl.appendChild(bubbleWrap);
  }

  bindResizer() {
    let startX = 0;
    let startWidth = this.width;

    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      const dx = startX - e.clientX;
      let newW = startWidth + dx;
      newW = Math.max(320, Math.min(760, newW));
      this.width = newW;
      this.drawerEl.style.width = `${newW}px`;
      this.notifyToggle(true);
    };

    const onMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.classList.remove('tw-resizing');
        this.saveWidth(this.width);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    this.resizerEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      startX = e.clientX;
      startWidth = this.width;
      document.body.classList.add('tw-resizing');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  bindCardResizer() {
    const resizer = this.inputCardEl ? this.inputCardEl.querySelector('#twCardResizer') : null;
    if (!resizer || !this.inputEl) return;

    let startY = 0;
    let startH = this.inputHeight;
    let isResizing = false;

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const dy = startY - e.clientY; // drag up increases height
      let newH = startH + dy;
      newH = Math.max(32, Math.min(350, newH));
      this.inputHeight = newH;
      this.inputEl.style.height = `${newH}px`;
    };

    const onMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.classList.remove('tw-resizing-v');
        this.saveInputHeight(this.inputHeight);
        this.layoutMinimap();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startY = e.clientY;
      startH = this.inputEl.offsetHeight || this.inputHeight;
      document.body.classList.add('tw-resizing-v');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  adjustInputHeight() {
    if (!this.inputEl) return;
    const minH = this.inputHeight || 52;
    if (!this.inputEl.value || !this.inputEl.value.trim()) {
      this.inputEl.style.height = `${minH}px`;
      return;
    }
    const scrollH = this.inputEl.scrollHeight;
    // Cap height to max 200px or 32% of window height to avoid pushing toolbar out of viewport
    const maxAllowed = Math.min(200, Math.max(minH, Math.floor(window.innerHeight * 0.32)));
    const targetH = scrollH > minH ? Math.min(maxAllowed, scrollH) : minH;
    const currentH = parseInt(this.inputEl.style.height, 10) || this.inputEl.offsetHeight || minH;
    if (Math.abs(targetH - currentH) > 2) {
      this.inputEl.style.height = `${targetH}px`;
    }
  }

  autoResizeInput() {
    this.adjustInputHeight();
  }

  setInputValue(text, focus = true) {
    if (!this.inputEl) return;
    this.inputEl.value = text || '';
    this.adjustInputHeight();
    this.updateSendButtonState();
    if (this.hub && this.hub.sessionManager) {
      this.hub.sessionManager.setDraft(this.hub.activeAgentId, text || '');
    }
    if (focus) {
      this.inputEl.focus();
    }
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  sendPrompt(promptText, autoSend = false) {
    if (!this.isOpen()) {
      this.open();
    }
    this.setInputValue(promptText, true);
    if (autoSend) {
      this.handleSend();
    }
  }

  bindInputEvents() {
    this.inputEl.addEventListener('keydown', (e) => {
      // 触发选择框优先接管键盘导航（Enter 选中 / ↑↓ 移动 / Esc 仅关弹窗不中止流式）
      if (this._tp && this._tp.open && this._handleTriggerPickerKeydown(e)) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      } else if (e.key === 'Escape') {
        if (this.isSplitPaneOpen) {
          e.preventDefault();
          this.closeCodeSplitPane();
          return;
        }
        if (this.hub.isStreaming()) {
          e.preventDefault();
          this.handleAbort();
        }
      }
    });

    // Save custom height if user drags the native corner resize handle
    this.inputEl.addEventListener('mouseup', () => {
      const currentH = this.inputEl.offsetHeight;
      if (currentH >= 38 && Math.abs(currentH - this.inputHeight) > 2) {
        this.saveInputHeight(currentH);
      }
    });

    // Auto grow input textarea when content overflows, with IME support and layout protection
    let isComposing = false;
    this.inputEl.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    this.inputEl.addEventListener('compositionend', () => {
      isComposing = false;
      this.adjustInputHeight();
      this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
      this.updateSendButtonState();
    });

    this.inputEl.addEventListener('input', () => {
      this.adjustInputHeight();
      this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
      if (!isComposing) {
        this.updateSendButtonState();
        this._updateTriggerPicker();
      }
    });
    // 光标位移（点击 / 方向键）后重估触发上下文，离开 token 区域自然关闭
    this.inputEl.addEventListener('click', () => this._updateTriggerPicker());
    this.inputEl.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' || this._tp.open) {
        this._updateTriggerPicker();
      }
    });

    if (this.btnSend) this.btnSend.onclick = () => this.handleSend();
    if (this.btnAbort) this.btnAbort.onclick = () => this.handleAbort();

    // Image upload button & file picker
    if (this.btnUploadImage && this.imageFileInput) {
      this.btnUploadImage.onclick = (e) => {
        e.preventDefault();
        this.imageFileInput.click();
      };
      this.imageFileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleImageFilesSelected(e.target.files);
          e.target.value = '';
        }
      };
    }

    // Drag and Drop & Paste handling for files & images
    this.bindDragAndDropEvents();
    this.bindPasteEvents();

    // 3. Middle Split Resizer Handle (Between Chat and Code Viewer)
    this.splitResizerEl = document.createElement('div');
    this.splitResizerEl.className = 'tw-split-resizer';
    this.splitResizerEl.title = '拖拽调整对话区与代码区比例 (双击重置 55:45)';
    this.splitResizerEl.style.display = 'none';
    this.drawerEl.appendChild(this.splitResizerEl);

    // 4. Right Code Viewer Panel Wrap
    this.codePanelWrap = document.createElement('div');
    this.codePanelWrap.className = 'tw-code-panel-wrap';
    this.codePanelWrap.style.display = 'none';
    this.drawerEl.appendChild(this.codePanelWrap);

    // Initialize CodeViewerPanel instance (先销毁旧实例：避免抽屉重建时 Monaco iframe
    // 与 window 级 message/keydown/MutationObserver 监听器逐次泄漏堆叠)
    if (typeof CodeViewerPanel !== 'undefined') {
      if (this.codeViewerPanel) {
        try { this.codeViewerPanel.destroy(); } catch (_) {}
      }
      this.codeViewerPanel = new CodeViewerPanel({
        app: this.app,
        vaultBasePath: this.vaultBasePath,
        onClose: () => this.closeCodeSplitPane()
      });
      this.codeViewerPanel.mount(this.codePanelWrap);
    }

    this.bindSplitResizer();
  }

  bindSplitResizer() {
    if (!this.splitResizerEl) return;
    let isDragging = false;
    let startX = 0;
    let startContentWidth = 0;

    this.splitResizerEl.onmousedown = (e) => {
      e.preventDefault();
      if (!this.drawerContentWrap || !this.drawerEl) return;
      isDragging = true;
      startX = e.clientX;
      startContentWidth = this.drawerContentWrap.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // Drag overlay to prevent iframe stealing mouse events
      const overlay = document.createElement('div');
      overlay.className = 'tw-resize-drag-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;cursor:col-resize;';
      document.body.appendChild(overlay);

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const totalWidth = this.drawerEl.getBoundingClientRect().width;
        let newWidth = startContentWidth + dx;
        const minW = 340;
        const maxW = totalWidth - 300;
        if (newWidth < minW) newWidth = minW;
        if (newWidth > maxW) newWidth = maxW;
        const pct = Math.round((newWidth / totalWidth) * 100);
        this.savedSplitRatio = pct;
        this.drawerContentWrap.style.flex = `0 0 ${pct}%`;
        this.drawerContentWrap.style.width = `${pct}%`;
      };

      const onMouseUp = () => {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    // Double click resets to 55:45
    this.splitResizerEl.ondblclick = () => {
      this.savedSplitRatio = 55;
      if (this.drawerContentWrap) {
        this.drawerContentWrap.style.flex = '0 0 55%';
        this.drawerContentWrap.style.width = '55%';
      }
    };
  }

  /**
   * 在对话框右侧分屏打开代码/文件
   * @param {string} rawTarget
   * @param {number} [targetLine=1]
   */
  openCodeInSplitPane(rawTarget, targetLine = 1) {
    if (!rawTarget) return;

    this.isSplitPaneOpen = true;

    if (this.drawerEl) {
      this.drawerEl.classList.add('has-code-split');
      // 如果不是 studio 模式且抽屉过窄，临时拓宽抽屉
      if (!this.drawerEl.classList.contains('tw-studio-mode')) {
        const curW = parseInt(this.drawerEl.style.width, 10) || 520;
        if (curW < 960) {
          this._prevDrawerWidth = this.drawerEl.style.width;
          this.drawerEl.style.width = '980px';
        }
      }
    }

    if (this.drawerContentWrap) {
      const ratio = this.savedSplitRatio || 55;
      this.drawerContentWrap.style.flex = `0 0 ${ratio}%`;
      this.drawerContentWrap.style.width = `${ratio}%`;
    }

    if (this.splitResizerEl) {
      this.splitResizerEl.style.display = 'flex';
    }

    if (this.codePanelWrap) {
      this.codePanelWrap.style.display = 'flex';
    }

    // 1. 决议目标文件的路径与行号 (零阻塞秒级决议)
    const resolved = this.resolveCodeFilePath(rawTarget, targetLine);
    const activeProj = this.selectedLocalProject || (typeof this.getSavedLocalProject === 'function' ? this.getSavedLocalProject() : null);

    if (this.codeViewerPanel) {
      const finalPath = resolved?.filePath || String(rawTarget).trim();
      const finalLine = resolved?.line || targetLine || 1;
      this.codeViewerPanel.openFile(finalPath, finalLine, {
        rawTarget,
        activeProject: activeProj
      });
    }
  }

  closeCodeSplitPane() {
    this.isSplitPaneOpen = false;

    if (this.drawerEl) {
      this.drawerEl.classList.remove('has-code-split');
      if (this._prevDrawerWidth) {
        this.drawerEl.style.width = this._prevDrawerWidth;
        this._prevDrawerWidth = null;
      }
    }

    if (this.drawerContentWrap) {
      this.drawerContentWrap.style.flex = '1 1 100%';
      this.drawerContentWrap.style.width = '100%';
    }

    if (this.splitResizerEl) {
      this.splitResizerEl.style.display = 'none';
    }

    if (this.codePanelWrap) {
      this.codePanelWrap.style.display = 'none';
    }
  }

  /**
   * 跨服务器/工程/知识库智能决议文件路径与行号 (零阻塞即时决议)
   * @param {string} rawTarget
   * @param {number} [fallbackLine=1]
   * @returns {{ filePath: string, line: number, isRemoteCandidate?: boolean } | null}
   */
  resolveCodeFilePath(rawTarget, fallbackLine = 1) {
    if (!rawTarget) return null;
    let clean = String(rawTarget).trim();
    let line = fallbackLine || 1;

    // 1. 去除两端包裹字符
    clean = clean.replace(/^[`"']|[`"']$/g, '');
    clean = clean.replace(/^\[\[(.*?)\]\]$/, '$1'); // Wikilink
    clean = clean.replace(/^file:\/\/\/?/i, '');

    // 2. 提取行号锚点 (#L85 或 :85 或 :85:12)
    const hashMatch = clean.match(/#L(\d+)/i);
    if (hashMatch) {
      line = parseInt(hashMatch[1], 10);
      clean = clean.replace(/#L\d+(-L\d+)?/i, '');
    } else {
      const colonMatch = clean.match(/:(\d+)(?::\d+)?$/);
      if (colonMatch) {
        line = parseInt(colonMatch[1], 10);
        clean = clean.replace(/:(\d+)(?::\d+)?$/, '');
      }
    }
    // 清理尾部可能的冒号、句点或中文字符
    clean = clean.replace(/[:：\s，,。.]+$/, '');

    // 3. Linux 远程服务器路径映射 (62 服务器与 31 服务器)
    if (clean.startsWith('/dfb/tankaikun/share/')) {
      clean = clean.replace('/dfb/tankaikun/share/', 'Y:\\').replace(/\//g, '\\');
    } else if (clean.startsWith('/home/tankaikun/share/work/')) {
      clean = clean.replace('/home/tankaikun/share/work/', 'Z:\\work\\').replace(/\//g, '\\');
    } else if (clean.startsWith('/home/tankaikun/')) {
      clean = clean.replace('/home/tankaikun/', 'Z:\\').replace(/\//g, '\\');
    }

    // 4. 标准化 Windows 路径分隔符
    let norm = clean.replace(/\//g, '\\');

    // 5. 已知远程服务器绝对路径 (Y:\ / Z:\ / UNC)：直接返回，交由 openFile 异步竞速读 + SSH 兜底。
    //    绝不对 SMB 挂载点做同步 existsSync/statSync——盘符离线时 Windows 会挂起主线程数秒尝试重连。
    if (/^[YyZz]:[\\\/]/i.test(norm) || norm.startsWith('\\\\192.168.1.')) {
      return { filePath: norm, line };
    }

    // 6. 若已是绝对路径且在磁盘物理存在，直接返回 (仅本地盘符)
    try {
      if (path.isAbsolute(norm) && fs.existsSync(norm) && fs.statSync(norm).isFile()) {
        return { filePath: norm, line };
      }
    } catch (_) {}

    // 6. 结合当前激活的本地工程 (selectedLocalProject) 与候选子目录前缀
    const activeProj = this.selectedLocalProject || (typeof this.getSavedLocalProject === 'function' ? this.getSavedLocalProject() : null);

    // 挂载盘离线快检 (30s TTL)：盘符不在线时直接走远端候选，跳过 ~40 次同步 SMB 探测
    const projDriveOnline = this._isDriveLikelyOnline(activeProj?.fullPathWin);

    // 剥离已知的多余前缀 (例如用户传了带有工程名字的路径)
    let strippedNorm = norm;
    if (activeProj && activeProj.fullPathWin && norm.toLowerCase().startsWith(activeProj.fullPathWin.toLowerCase())) {
      strippedNorm = norm.slice(activeProj.fullPathWin.length).replace(/^[\\\/]+/, '');
    } else {
      strippedNorm = norm.replace(/^[A-Za-z]:[\\\/]/, '').replace(/^(?:W[\\\/]01-sprd[\\\/]|W[\\\/]03-mtk-ww[\\\/]|AndroidW[\\\/]05-UW[\\\/]|work[\\\/]|dfb[\\\/]|share[\\\/])+/i, '');
    }

    const baseName = path.basename(strippedNorm);
    const stem = baseName.replace(/\.[^.]+$/, '');
    const cleanNormWithoutBase = strippedNorm.replace(/^base[\\\/]/i, '');

    const subBranches = [
      path.join('bsp', 'kernel5.15', 'kernel5.15', 'drivers', 'misc', 'prize', stem, baseName),
      path.join('bsp', 'kernel5.15', 'kernel5.15', 'drivers', 'misc', 'prize', 'hardware_info', baseName),
      path.join('bsp', 'kernel5.15', 'kernel5.15', 'drivers', 'power', 'supply', baseName),
      path.join('bsp', 'kernel5.15', 'kernel5.15', 'drivers', 'misc', 'prize', baseName),
      path.join('bsp', 'modules', 'kernel5.15', 'touchscreen', stem, baseName),
      path.join('bsp', 'kernel5.15', 'kernel5.15', stem, baseName),
      path.join('bsp', 'kernel5.15', 'kernel5.15', baseName),
      path.join('bsp', baseName),
      baseName
    ];

    if (activeProj && activeProj.fullPathWin && projDriveOnline) {
      // 单次决议探测总耗时封顶 800ms：SMB 延迟叠加的连环 stat 不再拖慢打开
      const probeStart = Date.now();
      const probeExpired = () => (Date.now() - probeStart) > 800;
      let probeAborted = false;

      // 6.1 前缀探测 (Tier 2 项目定制、Tier 1 公共差分)
      const candidatePrefixes = [];
      if (activeProj.priDriverRel) {
        candidatePrefixes.push(activeProj.priDriverRel.replace(/\//g, '\\'));
      }
      if (activeProj.publicDriverRel) {
        candidatePrefixes.push(activeProj.publicDriverRel.replace(/\//g, '\\'));
      }
      candidatePrefixes.push('', 'vendor_t', 'pri_project', 'idh');

      for (const prefix of candidatePrefixes) {
        for (const targetCand of [strippedNorm, cleanNormWithoutBase]) {
          if (probeExpired()) { probeAborted = true; break; }
          const cand = prefix ? path.join(activeProj.fullPathWin, prefix, targetCand) : path.join(activeProj.fullPathWin, targetCand);
          try {
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
              return { filePath: cand, line };
            }
          } catch (_) {}
        }
        if (probeAborted) break;
      }

      // 6.2 探测 Tier 2: 项目私有定制目录 subBranches
      if (!probeAborted && activeProj.priDriverRel) {
        const priDir = path.join(activeProj.fullPathWin, activeProj.priDriverRel.replace(/\//g, '\\'));
        for (const sub of subBranches) {
          if (probeExpired()) { probeAborted = true; break; }
          const cand = path.join(priDir, sub);
          try {
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
              return { filePath: cand, line };
            }
          } catch (_) {}
        }
      }

      // 6.3 探测 Tier 1: 公司公共定制目录 subBranches
      if (!probeAborted && activeProj.publicDriverRel) {
        const pubDir = path.join(activeProj.fullPathWin, activeProj.publicDriverRel.replace(/\//g, '\\'));
        for (const sub of subBranches) {
          if (probeExpired()) { probeAborted = true; break; }
          const cand = path.join(pubDir, sub);
          try {
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
              return { filePath: cand, line };
            }
          } catch (_) {}
        }
      }

      // 6.4 若本地 SMB 未命中，构造优先路径直接返回，交给后续 SSH 秒级查找
      const defaultPri = activeProj.priDriverRel ? path.join(activeProj.fullPathWin, activeProj.priDriverRel.replace(/\//g, '\\'), cleanNormWithoutBase) : path.join(activeProj.fullPathWin, strippedNorm);
      return { filePath: defaultPri, line, isRemoteCandidate: true };
    }

    // 7. 检查 TabonKB 知识库内部 (vaultBasePath)
    if (this.vaultBasePath) {
      const candVault = path.join(this.vaultBasePath, norm);
      try {
        if (fs.existsSync(candVault) && fs.statSync(candVault).isFile()) return { filePath: candVault, line };
      } catch (_) {}

      // 如果未带 .md 后缀，尝试补齐
      if (!norm.toLowerCase().endsWith('.md')) {
        const candMd = path.join(this.vaultBasePath, `${norm}.md`);
        try {
          if (fs.existsSync(candMd) && fs.statSync(candMd).isFile()) return { filePath: candMd, line };
        } catch (_) {}
      }

      // 在 vault 中匹配文件名
      try {
        const bName = path.basename(norm).toLowerCase();
        const bNameMd = bName.endsWith('.md') ? bName : `${bName}.md`;
        const vFiles = this.app?.vault?.getFiles?.() || [];
        for (const vf of vFiles) {
          if (vf.name?.toLowerCase() === bName || vf.name?.toLowerCase() === bNameMd) {
            return { filePath: path.join(this.vaultBasePath, vf.path), line };
          }
        }
      } catch (_) {}
    }

    return { filePath: norm, line };
  }

  /**
   * 挂载盘在线快检：对 Y:\ / Z:\ 盘符根做一次 existsSync 并缓存 30s，
   * 避免每次点击文件都对离线盘符发起数秒的 SMB 重连探测。
   */
  _isDriveLikelyOnline(rootPath) {
    const letter = String(rootPath || '')[0] || '';
    if (!/^[YyZz]$/.test(letter)) return true;
    this._driveOnlineCache = this._driveOnlineCache || {};
    const key = letter.toUpperCase();
    const cached = this._driveOnlineCache[key];
    if (cached && (Date.now() - cached.ts) < 30000) return cached.online;
    let online = false;
    try { online = !!fs.existsSync(`${key}:\\`); } catch (_) { online = false; }
    this._driveOnlineCache[key] = { online, ts: Date.now() };
    return online;
  }

  bindDragAndDropEvents() {
    const inputCard = this.inputCardEl || (this.drawerEl ? this.drawerEl.querySelector('.tw-drawer-input-card') : null);
    const dropTargets = [this.inputEl, inputCard, this.contextCapsuleEl, this.drawerEl].filter(Boolean);

    const onDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (inputCard) inputCard.classList.add('tw-drag-over');
      if (this.drawerEl) this.drawerEl.classList.add('tw-drag-over');
    };

    const onDragLeave = (e) => {
      e.preventDefault();
      if (this.drawerEl && !this.drawerEl.contains(e.relatedTarget)) {
        if (inputCard) inputCard.classList.remove('tw-drag-over');
        this.drawerEl.classList.remove('tw-drag-over');
      }
    };

    const onDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputCard) inputCard.classList.remove('tw-drag-over');
      if (this.drawerEl) this.drawerEl.classList.remove('tw-drag-over');

      // 1. Check if dropped files contain images
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const imgFiles = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          if (f.type?.startsWith('image/') || f.name?.match(/\.(png|jpe?g|webp|gif|bmp)$/i)) {
            imgFiles.push(f);
          }
        }
        if (imgFiles.length > 0) {
          await this.handleImageFilesSelected(imgFiles);
          return;
        }
      }

      // 2. Fallback to normal vault file attachments
      const files = this.extractDroppedFiles(e);
      if (files && files.length > 0) {
        this.handleFilesAttached(files);
      }
    };

    dropTargets.forEach(el => {
      el.addEventListener('dragenter', onDragOver);
      el.addEventListener('dragover', onDragOver);
      el.addEventListener('dragleave', onDragLeave);
      el.addEventListener('drop', onDrop);
    });
  }

  bindPasteEvents() {
    if (!this.inputEl) return;
    this.inputEl.addEventListener('paste', async (e) => {
      // 1. Check for pasted image in clipboardData (e.g. screenshot via Snipping Tool / WeChat)
      if (e.clipboardData) {
        const items = e.clipboardData.items;
        const imageFiles = [];
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                imageFiles.push(file);
              }
            }
          }
        } else if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          for (let i = 0; i < e.clipboardData.files.length; i++) {
            const f = e.clipboardData.files[i];
            if (f.type && f.type.startsWith('image/')) {
              imageFiles.push(f);
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          await this.handleImageFilesSelected(imageFiles);
          return;
        }
      }

      // 2. Fallback to clean Obsidian URLs if text pasted
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (text && (text.includes('obsidian://open?') || text.includes('file:///'))) {
        const cleaned = this.cleanPastedText(text);
        if (cleaned && cleaned !== text) {
          e.preventDefault();
          this.insertTextAtCursor(cleaned);
        }
      }
    });
  }

  async handleImageFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const dataUrl = await this.readFileAsDataUrl(file);
        const name = file.name || `image_${Date.now()}.png`;
        const size = file.size || Math.round(dataUrl.length * 0.75);
        this.attachedImages.push({
          id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: name,
          size: size,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.warn('[PiDrawerView] Failed to read image file:', err);
      }
    }
    this.renderImageAttachments();
    this.updateSendButtonState();
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (file.path && typeof require !== 'undefined') {
        try {
          const fs = require('fs');
          const path = require('path');
          const ext = path.extname(file.path).slice(1).toLowerCase() || 'png';
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const buffer = fs.readFileSync(file.path);
          const base64 = buffer.toString('base64');
          return resolve(`data:${mime};base64,${base64}`);
        } catch (e) {}
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  renderImageAttachments() {
    if (!this.cardImageAttachmentsEl) return;
    if (!this.attachedImages || this.attachedImages.length === 0) {
      this.cardImageAttachmentsEl.style.display = 'none';
      this.cardImageAttachmentsEl.innerHTML = '';
      return;
    }

    this.cardImageAttachmentsEl.style.display = 'flex';
    let html = '';
    for (const img of this.attachedImages) {
      html += `
        <div class="tw-image-chip" data-img-id="${escapeAttr(img.id)}">
          <img src="${img.dataUrl}" class="tw-image-chip-thumb" alt="${escapeAttr(img.name)}" />
          <div class="tw-image-chip-info">
            <span class="tw-image-chip-name" title="${escapeAttr(img.name)}">${escapeHtml(img.name)}</span>
            <span class="tw-image-chip-size">${escapeHtml(this.formatFileSize(img.size))}</span>
          </div>
          <button class="tw-image-chip-remove" data-remove-id="${escapeAttr(img.id)}" title="移除此图片">
            ${getIconPark('close', 10)}
          </button>
        </div>
      `;
    }
    this.cardImageAttachmentsEl.innerHTML = html;

    this.cardImageAttachmentsEl.querySelectorAll('.tw-image-chip-remove').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-remove-id');
        this.removeAttachedImage(id);
      };
    });
  }

  removeAttachedImage(id) {
    this.attachedImages = (this.attachedImages || []).filter(img => img.id !== id);
    this.renderImageAttachments();
    this.updateSendButtonState();
  }

  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  openImageLightbox(src, title = '图片预览') {
    const existing = document.querySelector('.tw-image-lightbox-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'tw-image-lightbox-modal';
    modal.innerHTML = `
      <div class="tw-lightbox-backdrop"></div>
      <div class="tw-lightbox-container">
        <div class="tw-lightbox-header">
          <span class="tw-lightbox-title">${escapeHtml(title)}</span>
          <div class="tw-lightbox-actions" style="display:flex;align-items:center;gap:6px;">
            <button class="tw-lightbox-copy" title="复制图片">${getIconPark('copy', 14)}</button>
            <button class="tw-lightbox-close" title="关闭 (Esc)">${getIconPark('close', 14)}</button>
          </div>
        </div>
        <div class="tw-lightbox-body">
          <img src="${src}" class="tw-lightbox-img" alt="${escapeAttr(title)}" />
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 150);
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    const backdrop = modal.querySelector('.tw-lightbox-backdrop');
    if (backdrop) backdrop.onclick = closeModal;
    const closeBtn = modal.querySelector('.tw-lightbox-close');
    if (closeBtn) closeBtn.onclick = closeModal;
    const copyBtn = modal.querySelector('.tw-lightbox-copy');
    const lightboxImg = modal.querySelector('.tw-lightbox-img');
    if (copyBtn && lightboxImg) {
      copyBtn.onclick = () => this.copyImageToClipboard(lightboxImg);
    }
    if (lightboxImg) {
      lightboxImg.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showImageContextMenu(e, lightboxImg);
      };
    }
    document.addEventListener('keydown', onKey);
  }

  setImageScale(imgEl, scale) {
    if (!imgEl) return;
    imgEl.dataset.scale = scale;
    imgEl.style.maxWidth = scale;
    imgEl.style.width = 'auto';
    imgEl.style.height = 'auto';
    const embedParent = imgEl.closest('.image-embed, .internal-embed');
    if (embedParent) {
      embedParent.dataset.scale = scale;
    }
  }

  showImageContextMenu(e, imgEl) {
    const MenuCls = (typeof Menu !== 'undefined' ? Menu : (this.app?.Menu || window.Menu));
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (this.app?.Notice || class{});
    const currentScale = imgEl.dataset.scale || '50%';

    if (MenuCls) {
      try {
        const menu = new MenuCls();

        // 1. 复制图片
        menu.addItem((item) => {
          item.setTitle('复制图片')
            .setIcon('copy')
            .onClick(async () => {
              await this.copyImageToClipboard(imgEl);
            });
        });

        // 2. 复制图片链接 / 路径
        menu.addItem((item) => {
          item.setTitle('复制链接')
            .setIcon('link')
            .onClick(async () => {
              try {
                await navigator.clipboard.writeText(imgEl.src);
                new NoticeCls('✓ 图片链接已复制', 2000);
              } catch (err) {
                new NoticeCls('❌ 复制失败', 2000);
              }
            });
        });

        // 3. 查看大图
        menu.addItem((item) => {
          item.setTitle('查看大图')
            .setIcon('expand')
            .onClick(() => {
              this.openImageLightbox(imgEl.src, imgEl.alt || imgEl.title || '图片预览');
            });
        });

        menu.addSeparator();

        // 4. 图片大小选项 (25%, 50%, 75%, 100%)
        const scaleOptions = [
          { id: '25%', label: '25% 比例' },
          { id: '50%', label: '50% (默认)' },
          { id: '75%', label: '75% 比例' },
          { id: '100%', label: '100% 全宽' }
        ];

        scaleOptions.forEach(opt => {
          menu.addItem((item) => {
            const isSelected = (currentScale === opt.id);
            item.setTitle(opt.label)
              .setIcon(isSelected ? 'check' : 'image')
              .onClick(() => {
                this.setImageScale(imgEl, opt.id);
                new NoticeCls(`✓ 图片大小已设为 ${opt.id}`, 1500);
              });
            if (typeof item.setChecked === 'function') {
              item.setChecked(isSelected);
            }
          });
        });

        menu.showAtMouseEvent(e);
        return;
      } catch (err) {
        console.warn('[PiDrawerView] Obsidian Menu failed, falling back to custom menu:', err);
      }
    }

    this.showCustomImageContextMenu(e, imgEl);
  }

  showCustomImageContextMenu(e, imgEl) {
    const existing = document.querySelector('.tw-image-context-menu');
    if (existing) existing.remove();

    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (this.app?.Notice || class{});
    const currentScale = imgEl.dataset.scale || '50%';

    const menuEl = document.createElement('div');
    menuEl.className = 'tw-image-context-menu';

    const items = [
      { id: 'copy', label: '复制图片', icon: 'copy' },
      { id: 'copy-link', label: '复制链接', icon: 'link' },
      { id: 'lightbox', label: '查看大图', icon: 'expand' },
      { type: 'separator' },
      { id: 'scale-25', label: '25% 比例', scale: '25%' },
      { id: 'scale-50', label: '50% (默认)', scale: '50%' },
      { id: 'scale-75', label: '75% 比例', scale: '75%' },
      { id: 'scale-100', label: '100% 全宽', scale: '100%' },
    ];

    let html = '';
    items.forEach(item => {
      if (item.type === 'separator') {
        html += '<div class="tw-context-separator"></div>';
      } else if (item.scale) {
        const isSelected = (currentScale === item.scale);
        html += `
          <div class="tw-context-item ${isSelected ? 'is-active' : ''}" data-scale="${item.scale}">
            <span class="tw-context-icon">${isSelected ? getIconPark('check', 13) : ''}</span>
            <span class="tw-context-label">${item.label}</span>
          </div>
        `;
      } else {
        html += `
          <div class="tw-context-item" data-action="${item.id}">
            <span class="tw-context-icon">${getIconPark(item.icon, 13)}</span>
            <span class="tw-context-label">${item.label}</span>
          </div>
        `;
      }
    });

    menuEl.innerHTML = html;
    document.body.appendChild(menuEl);

    const menuWidth = 140;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    menuEl.style.left = `${Math.max(8, x)}px`;
    menuEl.style.top = `${Math.max(8, y)}px`;

    menuEl.addEventListener('click', async (evt) => {
      const targetItem = evt.target.closest('.tw-context-item');
      if (!targetItem) return;
      menuEl.remove();

      const action = targetItem.dataset.action;
      const scale = targetItem.dataset.scale;

      if (action === 'copy') {
        await this.copyImageToClipboard(imgEl);
      } else if (action === 'copy-link') {
        try {
          await navigator.clipboard.writeText(imgEl.src);
          new NoticeCls('✓ 图片链接已复制', 2000);
        } catch (err) {
          new NoticeCls('❌ 复制失败', 2000);
        }
      } else if (action === 'lightbox') {
        this.openImageLightbox(imgEl.src, imgEl.alt || imgEl.title || '图片预览');
      } else if (scale) {
        this.setImageScale(imgEl, scale);
        new NoticeCls(`✓ 图片大小已设为 ${scale}`, 1500);
      }
    });

    const onOutside = (evt) => {
      if (!menuEl.contains(evt.target)) {
        menuEl.remove();
        cleanup();
      }
    };
    const onKeyDown = (evt) => {
      if (evt.key === 'Escape') {
        menuEl.remove();
        cleanup();
      }
    };
    const cleanup = () => {
      window.removeEventListener('click', onOutside);
      window.removeEventListener('contextmenu', onOutside);
      window.removeEventListener('keydown', onKeyDown);
    };

    setTimeout(() => {
      window.addEventListener('click', onOutside);
      window.addEventListener('contextmenu', onOutside);
      window.addEventListener('keydown', onKeyDown);
    }, 10);
  }

  async copyImageToClipboard(imgEl) {
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (this.app?.Notice || class{});
    let copied = false;

    // 1. Electron native clipboard support
    try {
      let electron = (typeof electronModule !== 'undefined' && electronModule) ? electronModule : null;
      if (!electron && typeof require !== 'undefined') {
        try { electron = require('electron'); } catch (e) {}
      }

      if (electron && electron.clipboard && electron.nativeImage) {
        const src = imgEl.src || '';
        let nImg = null;

        if (src.startsWith('data:image/')) {
          nImg = electron.nativeImage.createFromDataURL(src);
        } else {
          let filePath = '';
          if (src.startsWith('file://')) {
            filePath = decodeURIComponent(src.replace(/^file:\/\/\/?/, ''));
            if (/^[a-zA-Z]:/.test(filePath) === false && /^\/[a-zA-Z]:/.test(filePath)) {
              filePath = filePath.substring(1);
            }
          } else if (src.startsWith('app://')) {
            const cleaned = decodeURIComponent(src.replace(/^app:\/\/[^/]+\//, ''));
            filePath = cleaned;
          }

          if (filePath) {
            const fsMod = typeof fs !== 'undefined' ? fs : (typeof require !== 'undefined' ? require('fs') : null);
            if (fsMod && fsMod.existsSync(filePath)) {
              nImg = electron.nativeImage.createFromPath(filePath);
            }
          }
        }

        if (nImg && !nImg.isEmpty()) {
          electron.clipboard.writeImage(nImg);
          copied = true;
        }
      }
    } catch (e) {
      console.warn('[PiDrawerView] Electron clipboard error:', e);
    }

    // 2. HTML5 Canvas to Blob
    if (!copied) {
      try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = imgEl.naturalWidth || imgEl.width || 400;
          canvas.height = imgEl.naturalHeight || imgEl.height || 300;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgEl, 0, 0);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            copied = true;
          }
        }
      } catch (e) {
        console.warn('[PiDrawerView] Canvas clipboard error:', e);
      }
    }

    // 3. Fetch Blob directly
    if (!copied && imgEl.src) {
      try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          const res = await fetch(imgEl.src);
          const blob = await res.blob();
          if (blob) {
            const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
            await navigator.clipboard.write([
              new ClipboardItem({ [mime]: blob })
            ]);
            copied = true;
          }
        }
      } catch (e) {
        console.warn('[PiDrawerView] Fetch clipboard error:', e);
      }
    }

    if (copied) {
      new NoticeCls('✓ 图片已成功复制到剪贴板', 2000);
      return true;
    } else {
      // 4. Fallback to copying link
      try {
        await navigator.clipboard.writeText(imgEl.src);
        new NoticeCls('⚠️ 无法直接写入图片二进制，已复制图片链接', 3000);
        return false;
      } catch (err) {
        new NoticeCls('❌ 复制图片失败', 2000);
        return false;
      }
    }
  }

  extractDroppedFiles(e) {
    const results = [];
    const vaultPath = this.vaultBasePath || (process.cwd ? process.cwd() : '');

    // 1. Native files from DataTransfer (File Explorer / OS drag)
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        const rawPath = f.path || f.name;
        const clean = this.resolveCleanVaultPath(rawPath, vaultPath);
        if (clean) {
          results.push(clean);
        }
      }
      if (results.length > 0) return results;
    }

    // 2. Obsidian internal drag manager (dragging files from Obsidian file explorer)
    try {
      const app = (typeof window !== 'undefined' && window.app) || (this.contextProvider && this.contextProvider.app);
      if (app && app.dragManager && app.dragManager.draggable) {
        const draggable = app.dragManager.draggable;
        if (draggable.file && draggable.file.path) {
          results.push(this.formatFileInfo(draggable.file.path, draggable.file.basename, draggable.file.name));
          return results;
        } else if (Array.isArray(draggable.files)) {
          for (const df of draggable.files) {
            if (df && df.path) {
              results.push(this.formatFileInfo(df.path, df.basename, df.name));
            }
          }
          if (results.length > 0) return results;
        }
      }
    } catch (err) {}

    // 3. Text data (Obsidian URI obsidian://open?vault=... or file path or uri-list)
    if (e.dataTransfer) {
      const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list') || '';
      if (text) {
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const clean = this.resolveCleanVaultPath(line, vaultPath);
          if (clean) {
            results.push(clean);
          }
        }
      }
    }

    return results;
  }

  resolveCleanVaultPath(rawInput, vaultPath = this.vaultBasePath) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const input = rawInput.trim();

    // A. Obsidian URL scheme
    const obMatch = input.match(/obsidian:\/\/open\?[^\s"'>)]+/i);
    if (obMatch) {
      try {
        const urlStr = obMatch[0];
        const qIdx = urlStr.indexOf('?');
        if (qIdx !== -1) {
          const params = new URLSearchParams(urlStr.slice(qIdx + 1));
          const fileParam = params.get('file');
          if (fileParam) {
            let decoded = decodeURIComponent(fileParam).replace(/\\/g, '/').replace(/^\/+/, '');
            decoded = this.ensureFileExtension(decoded, vaultPath);
            return this.formatFileInfo(decoded);
          }
        }
      } catch (err) {}
    }

    // B. File URI scheme: file:///D:/work/Mgmt/...
    const fileUrlMatch = input.match(/file:\/\/\/([^\s"'>)]+)/i);
    if (fileUrlMatch) {
      let rawPath = decodeURIComponent(fileUrlMatch[1]).replace(/\//g, path.sep);
      if (vaultPath && rawPath.toLowerCase().startsWith(vaultPath.toLowerCase())) {
        let rel = rawPath.slice(vaultPath.length).replace(/^[\\\/]+/, '').replace(/\\/g, '/');
        return this.formatFileInfo(rel);
      }
      return this.formatFileInfo(rawPath.replace(/\\/g, '/'));
    }

    // C. Absolute Windows Path
    if (vaultPath) {
      const normVault = vaultPath.replace(/\\/g, '/').toLowerCase();
      const normInput = input.replace(/\\/g, '/');
      if (normInput.toLowerCase().startsWith(normVault)) {
        let rel = normInput.slice(normVault.length).replace(/^\/+/, '');
        return this.formatFileInfo(rel);
      }
    }

    // D. Wikilink syntax: [[path/to/file]]
    const wikiMatch = input.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (wikiMatch) {
      return this.formatFileInfo(wikiMatch[1].trim().replace(/\\/g, '/'));
    }

    // E. Relative path in vault
    if (vaultPath) {
      try {
        const fsMod = typeof fs !== 'undefined' ? fs : require('fs');
        if (fsMod) {
          const full = path.join(vaultPath, input.replace(/\//g, path.sep));
          if (fsMod.existsSync(full) || fsMod.existsSync(full + '.md')) {
            let clean = input.replace(/\\/g, '/').replace(/^\/+/, '');
            clean = this.ensureFileExtension(clean, vaultPath);
            return this.formatFileInfo(clean);
          }
        }
      } catch (e) {}
    }

    return null;
  }

  ensureFileExtension(relPath, vaultPath) {
    if (vaultPath) {
      try {
        const fsMod = typeof fs !== 'undefined' ? fs : require('fs');
        if (fsMod) {
          const full = path.join(vaultPath, relPath.replace(/\//g, path.sep));
          if (!fsMod.existsSync(full) && fsMod.existsSync(full + '.md')) {
            return relPath + '.md';
          }
        }
      } catch (e) {}
    }
    if (!relPath.toLowerCase().endsWith('.md')) {
      const ext = path.extname(relPath).toLowerCase();
      const knownNonMd = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.c', '.h', '.cpp', '.py', '.js', '.json', '.sh', '.zip', '.tar', '.gz'];
      if (!knownNonMd.includes(ext)) {
        return relPath + '.md';
      }
    }
    return relPath;
  }

  formatFileInfo(relPath, customBase, customName) {
    const normPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const filename = normPath.split('/').pop() || normPath;
    const basename = customBase || filename.replace(/\.[^/.]+$/, '');
    const name = customName || filename;
    return {
      path: normPath,
      basename,
      name
    };
  }

  handleFilesAttached(files) {
    if (!files || files.length === 0) return;

    // 1. Mount first file to Context Capsule so agent gets structured context
    const primary = files[0];
    if (this.contextProvider && typeof this.contextProvider.setActiveFile === 'function') {
      this.contextProvider.setActiveFile(primary);
      this.updateContextCapsule();
      this.updateCardAttachments();
    }

    // 2. Insert clean [[wikiLink]] tags into input box
    const wikiTags = files.map(f => `[[${f.path}]]`).join(' ') + ' ';
    this.insertTextAtCursor(wikiTags);
  }

  insertTextAtCursor(text) {
    if (!this.inputEl) return;
    const start = this.inputEl.selectionStart || 0;
    const end = this.inputEl.selectionEnd || 0;
    const oldVal = this.inputEl.value || '';
    const newVal = oldVal.slice(0, start) + text + oldVal.slice(end);
    this.inputEl.value = newVal;

    const newPos = start + text.length;
    this.inputEl.focus();
    if (typeof this.inputEl.setSelectionRange === 'function') {
      this.inputEl.setSelectionRange(newPos, newPos);
    }

    // Resize input textarea and save draft
    const minH = this.inputHeight;
    const newH = Math.max(minH, Math.min(500, this.inputEl.scrollHeight));
    this.inputEl.style.height = `${newH}px`;
    this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
  }

  // ===== 触发字符选择框：'/' 工具命令 · '@' 文件/技能 =====
  // 语义说明：
  // - '/' 仅在输入框首位触发（Pi 命令分发要求消息以 '/' 开头），选中插入 '/name '；
  // - '@' 在任意空白边界后的 token 触发，选中文件插入 '[[path]] ' 并挂载为活动上下文，
  //   选中技能则提升为消息首部 '/skill:name '（其余文本作为技能参数）。

  _ensureTriggerPickerEl() {
    if (this.triggerPickerEl) return this.triggerPickerEl;
    const host = this.inputCardEl || (this.drawerEl ? this.drawerEl.querySelector('.tw-drawer-input-card') : null);
    if (!host) return null;
    const el = document.createElement('div');
    el.className = 'tw-trigger-picker';
    el.id = 'twTriggerPicker';
    el.style.display = 'none';
    el.innerHTML = '<div class="tw-trigger-picker-list"></div>';
    // 拦截 mousedown 默认行为，点击列表项时输入框不丢焦点
    el.addEventListener('mousedown', (e) => e.preventDefault());
    host.appendChild(el);
    this.triggerPickerEl = el;
    return el;
  }

  _evaluateTriggerContext() {
    const el = this.inputEl;
    if (!el) return null;
    const v = el.value || '';
    const cur = typeof el.selectionStart === 'number' ? el.selectionStart : v.length;
    // '/' 触发：仅当首字符为 '/' 且光标处于首个空白之前（命令名区域）
    if (v[0] === '/' && cur >= 1) {
      let end = v.search(/\s/);
      if (end === -1) end = v.length;
      if (cur <= end) {
        return { trigger: '/', tokenStart: 0, query: v.slice(1, cur) };
      }
    }
    // '@' 触发：光标前最近一段无空白 token 以 '@' 开头
    let i = cur - 1;
    while (i >= 0 && !/\s/.test(v[i])) i--;
    const ts = i + 1;
    if (ts < cur && v[ts] === '@') {
      return { trigger: '@', tokenStart: ts, query: v.slice(ts + 1, cur) };
    }
    return null;
  }

  _getTriggerCommands() {
    const now = Date.now();
    if (this._tpCommandsCache && now - this._tpCommandsFetchedAt < 30000) {
      return Promise.resolve(this._tpCommandsCache);
    }
    if (!this._tpFetchPromise) {
      const fetcher = (this.hub && typeof this.hub.getSlashCommands === 'function')
        ? this.hub.getSlashCommands()
        : Promise.resolve([]);
      this._tpFetchPromise = Promise.resolve(fetcher)
        .then((list) => {
          this._tpCommandsCache = Array.isArray(list) ? list : [];
          this._tpCommandsFetchedAt = Date.now();
          return this._tpCommandsCache;
        })
        .catch(() => {
          this._tpCommandsCache = [];
          return this._tpCommandsCache;
        })
        .finally(() => {
          this._tpFetchPromise = null;
        });
    }
    return this._tpFetchPromise;
  }

  _listVaultFiles() {
    const now = Date.now();
    if (this._tpFileCache && now - this._tpFileCacheAt < 20000) return this._tpFileCache;
    let files = [];
    try {
      const vault = this.app && this.app.vault;
      if (vault && typeof vault.getFiles === 'function') {
        files = vault.getFiles()
          .map((f) => ({ path: f.path, name: f.name, mtime: (f.stat && f.stat.mtime) || 0 }))
          .filter((f) => f.path && !f.path.split('/').some((seg) => seg.startsWith('.')));
      }
    } catch (e) {}
    // fs 兜底（无 Obsidian app 环境 / 测试场景）
    if (!files.length && this.vaultBasePath) {
      try {
        const fsMod = typeof require !== 'undefined' ? require('fs') : null;
        if (fsMod) {
          const stack = [{ dir: this.vaultBasePath, rel: '', depth: 0 }];
          while (stack.length && files.length < 8000) {
            const { dir, rel, depth } = stack.pop();
            let entries = [];
            try { entries = fsMod.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
            for (const ent of entries) {
              if (files.length >= 8000) break;
              if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
              const relPath = rel ? `${rel}/${ent.name}` : ent.name;
              if (ent.isDirectory()) {
                if (depth < 8) stack.push({ dir: path.join(dir, ent.name), rel: relPath, depth: depth + 1 });
              } else {
                let mt = 0;
                try { mt = fsMod.statSync(path.join(dir, ent.name)).mtimeMs; } catch (_) {}
                files.push({ path: relPath, name: ent.name, mtime: mt });
              }
            }
          }
        }
      } catch (e) {}
    }
    this._tpFileCache = files;
    this._tpFileCacheAt = now;
    return files;
  }

  _scoreFileMatch(f, q) {
    if (!q) return ((f.mtime || 0) / 1e12);
    const name = (f.name || '').toLowerCase();
    const p = (f.path || '').toLowerCase();
    if (name === q) return 1000;
    if (name.startsWith(q)) return 800;
    if (name.includes(q)) return 500;
    if (p.includes(q)) return 200;
    return -1;
  }

  _buildSlashItems(query) {
    const cmds = this._tpCommandsCache;
    if (!cmds) return null; // 尚未加载完成
    const q = (query || '').toLowerCase();
    const badgeMap = { extension: '扩展', prompt: '模板', skill: '技能' };
    const iconMap = { extension: 'tool', prompt: 'clipboard-check', skill: 'sparkles' };
    let items = cmds.map((c) => ({
      kind: 'cmd',
      name: c.name,
      label: `/${c.name}`,
      desc: c.description || '',
      badge: badgeMap[c.source] || '命令',
      icon: iconMap[c.source] || 'tool',
      insertText: `/${c.name} `
    }));
    if (q) {
      items = items.filter((it) => it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q));
      items.sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp;
      });
    }
    return items.slice(0, 60);
  }

  _buildAtItems(query) {
    const q = (query || '').trim().toLowerCase();
    const items = [];
    // 技能（来自 get_commands，选中后提升为 /skill:name 调用）
    const cmds = this._tpCommandsCache || [];
    for (const c of cmds) {
      if (c.source !== 'skill') continue;
      const name = String(c.name || '').replace(/^skill:/, '');
      if (!name) continue;
      if (q && !name.toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) continue;
      items.push({ kind: 'at-skill', name, label: name, desc: c.description || '', badge: '技能', icon: 'sparkles' });
    }
    // Vault 文件
    const scored = [];
    for (const f of this._listVaultFiles()) {
      const s = this._scoreFileMatch(f, q);
      if (s < 0) continue;
      scored.push([s, f]);
    }
    scored.sort((a, b) => (b[0] - a[0]) || (a[1].path.length - b[1].path.length));
    for (const [, f] of scored.slice(0, 40)) {
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
      items.push({
        kind: 'file',
        label: f.name,
        desc: dir,
        path: f.path,
        badge: '文件',
        icon: 'file-text',
        insertText: `[[${f.path}]] `
      });
    }
    return items.slice(0, 50);
  }

  _updateTriggerPicker() {
    const ctx = this._evaluateTriggerContext();
    if (!ctx) {
      this.closeTriggerPicker();
      return;
    }
    const tp = this._tp;
    tp.trigger = ctx.trigger;
    tp.tokenStart = ctx.tokenStart;
    tp.query = ctx.query;
    const gen = ++this._tpGen;

    if (ctx.trigger === '/') {
      tp.loading = !this._tpCommandsCache;
      this._renderTriggerPickerList(this._buildSlashItems(ctx.query));
      this._getTriggerCommands().then(() => {
        if (this._tp.open && this._tp.trigger === '/' && this._tpGen === gen) {
          this._tp.loading = false;
          this._renderTriggerPickerList(this._buildSlashItems(this._tp.query));
        }
      });
    } else {
      tp.loading = false;
      this._renderTriggerPickerList(this._buildAtItems(ctx.query));
      // 技能项依赖 get_commands，后台补拉一次后重渲染
      this._getTriggerCommands().then(() => {
        if (this._tp.open && this._tp.trigger === '@' && this._tpGen === gen) {
          this._renderTriggerPickerList(this._buildAtItems(this._tp.query));
        }
      });
    }
  }

  _renderTriggerPickerList(items) {
    const el = this._ensureTriggerPickerEl();
    if (!el) return;
    const list = el.firstElementChild;
    const tp = this._tp;
    tp.filtered = items || [];
    if (tp.activeIndex >= tp.filtered.length) tp.activeIndex = 0;

    if (!items) {
      list.innerHTML = '<div class="tw-tp-empty">正在读取命令…</div>';
    } else if (items.length === 0) {
      list.innerHTML = `<div class="tw-tp-empty">${tp.loading ? '正在读取…' : '无匹配项'}</div>`;
    } else {
      list.innerHTML = items.map((it, i) => `
        <div class="tw-tp-item${i === tp.activeIndex ? ' active' : ''}" data-idx="${i}" role="option" aria-selected="${i === tp.activeIndex}">
          <span class="tw-tp-icon tw-tp-icon-${it.kind}">${getIconPark(it.icon, 13)}</span>
          <span class="tw-tp-main">
            <span class="tw-tp-label">${escapeHtml(it.label)}</span>
            ${it.desc ? `<span class="tw-tp-desc">${escapeHtml(it.desc)}</span>` : ''}
          </span>
          <span class="tw-tp-badge">${escapeHtml(it.badge)}</span>
        </div>`).join('');
      Array.from(list.querySelectorAll('.tw-tp-item')).forEach((row) => {
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this._applyTriggerSelection(tp.filtered[Number(row.dataset.idx)]);
        });
      });
    }
    el.style.display = 'block';
    if (!tp.open) {
      tp.open = true;
      this._bindTriggerPickerDocClose();
    }
  }

  _highlightTriggerItem() {
    const tp = this._tp;
    if (!this.triggerPickerEl) return;
    const rows = this.triggerPickerEl.querySelectorAll('.tw-tp-item');
    rows.forEach((row, i) => {
      row.classList.toggle('active', i === tp.activeIndex);
      row.setAttribute('aria-selected', i === tp.activeIndex ? 'true' : 'false');
    });
    const active = rows[tp.activeIndex];
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  _handleTriggerPickerKeydown(e) {
    const tp = this._tp;
    const n = tp.filtered.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (n > 0) {
        tp.activeIndex = (tp.activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
        this._highlightTriggerItem();
      }
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (n === 0) {
        // 无可选项：关闭弹窗并让 Enter 透传为正常发送
        this.closeTriggerPicker();
        return false;
      }
      e.preventDefault();
      this._applyTriggerSelection(tp.filtered[tp.activeIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeTriggerPicker();
      return true;
    }
    return false;
  }

  _applyTriggerSelection(item) {
    if (!item) {
      this.closeTriggerPicker();
      return;
    }
    const el = this.inputEl;
    const v = el.value || '';
    const cur = el.selectionStart || 0;
    const ts = this._tp.tokenStart;

    // 摘除已输入的触发 token（/query 或 @query），其余文本保持原样
    let nv = v.slice(0, ts) + v.slice(cur);
    if (nv[ts - 1] === ' ' && nv[ts] === ' ') {
      nv = nv.slice(0, ts) + nv.slice(ts + 1);
    }
    el.value = nv;
    if (typeof el.setSelectionRange === 'function') el.setSelectionRange(ts, ts);

    if (item.kind === 'cmd') {
      // 首命令胶囊：'/name'（含 skill:name），发送时拼装为消息首部
      this._addInputChip({ type: 'command', name: item.name, label: `/${item.name}`, icon: item.icon, tooltip: item.desc });
    } else if (item.kind === 'at-skill') {
      this._addInputChip({ type: 'command', name: `skill:${item.name}`, label: `/skill:${item.name}`, icon: 'sparkles', tooltip: item.desc });
    } else if (item.kind === 'file') {
      this._addInputChip({ type: 'file', name: item.path, label: item.label, path: item.path, icon: 'file-text', tooltip: item.path });
      if (this.contextProvider && typeof this.contextProvider.setActiveFile === 'function') {
        this.contextProvider.setActiveFile(this.formatFileInfo(item.path));
        this.updateContextCapsule();
        this.updateCardAttachments();
      }
    }

    el.focus();
    this.adjustInputHeight();
    this.updateSendButtonState();
    this.hub.sessionManager.setDraft(this.hub.activeAgentId, el.value);
    this.closeTriggerPicker();
  }

  // ===== 输入胶囊（命令 / 文件 chip）=====
  // inputChips: [{type:'command'|'file', name, label, path?, icon, tooltip}]
  // - command chip 唯一（Pi 仅解析消息首部的单个 / 调用），新选覆盖
  // - file chip 可按 path 去重累积
  // 发送时由 _serializeChips 拼回协议文本：'/name 正文 [[path]] ...'

  _addInputChip(chip) {
    if (!this.inputChips) this.inputChips = [];
    if (chip.type === 'command') {
      this.inputChips = this.inputChips.filter((c) => c.type !== 'command');
    } else if (chip.type === 'file') {
      if (this.inputChips.some((c) => c.type === 'file' && c.path === chip.path)) {
        this._renderInputChips();
        return;
      }
    }
    this.inputChips.push(chip);
    this._renderInputChips();
    this._persistChips();
  }

  _removeInputChip(idx) {
    if (!this.inputChips || idx < 0 || idx >= this.inputChips.length) return;
    this.inputChips.splice(idx, 1);
    this._renderInputChips();
    this._persistChips();
    this.updateSendButtonState();
  }

  _renderInputChips() {
    const el = this.chipsEl;
    if (!el) return;
    const chips = this.inputChips || [];
    if (!chips.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      this._syncInputPlaceholder();
      return;
    }
    el.style.display = 'flex';
    el.innerHTML = chips.map((c, i) => `
      <span class="tw-chip tw-chip-${c.type}" data-idx="${i}" title="${escapeAttr(c.tooltip || '')}">
        <span class="tw-chip-icon">${getIconPark(c.icon || (c.type === 'file' ? 'file-text' : 'lightning'), 11)}</span>
        <span class="tw-chip-label">${escapeHtml(c.label)}</span>
        <span class="tw-chip-x" role="button" title="移除">${getIconPark('close', 9)}</span>
      </span>`).join('');
    Array.from(el.querySelectorAll('.tw-chip')).forEach((row) => {
      row.addEventListener('mousedown', (e) => e.preventDefault());
      const x = row.querySelector('.tw-chip-x');
      if (x) {
        x.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._removeInputChip(Number(row.dataset.idx));
          if (this.inputEl) this.inputEl.focus();
        });
      }
    });
    this._syncInputPlaceholder();
  }

  _syncInputPlaceholder() {
    this.updateInputPlaceholder();
  }

  _serializeChips(text) {
    const chips = this.inputChips || [];
    const cmd = chips.find((c) => c.type === 'command');
    const files = chips.filter((c) => c.type === 'file');
    let out = (text || '').trim();
    if (files.length) {
      const refs = files.map((c) => `[[${c.path}]]`).join(' ');
      out = out ? `${out} ${refs}` : refs;
    }
    if (cmd) {
      out = `/${cmd.name}${out ? ' ' + out : ''}`;
    }
    return out;
  }

  _persistChips() {
    try {
      if (typeof localStorage === 'undefined' || !this.hub) return;
      const key = `tabonkb-input-chips:${this.hub.activeAgentId}`;
      const chips = this.inputChips || [];
      if (chips.length) {
        localStorage.setItem(key, JSON.stringify(chips));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {}
  }

  _restoreChips(agentId) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`tabonkb-input-chips:${agentId}`) : null;
      const arr = raw ? JSON.parse(raw) : [];
      this.inputChips = Array.isArray(arr) ? arr : [];
    } catch (e) {
      this.inputChips = [];
    }
    this._renderInputChips();
    this.updateSendButtonState();
  }

  _bindTriggerPickerDocClose() {
    if (this._tpDocClickBound) return;
    this._tpDocClickBound = (e) => {
      const t = e.target;
      if (this.triggerPickerEl && this.triggerPickerEl.contains(t)) return;
      if (this.inputEl && t === this.inputEl) {
        setTimeout(() => this._updateTriggerPicker(), 0);
        return;
      }
      this.closeTriggerPicker();
    };
    document.addEventListener('mousedown', this._tpDocClickBound, true);
  }

  closeTriggerPicker() {
    const tp = this._tp;
    if (!tp.open) return;
    tp.open = false;
    tp.filtered = [];
    tp.activeIndex = 0;
    tp.loading = false;
    if (this.triggerPickerEl) this.triggerPickerEl.style.display = 'none';
    if (this._tpDocClickBound) {
      document.removeEventListener('mousedown', this._tpDocClickBound, true);
      this._tpDocClickBound = null;
    }
  }

  cleanPastedText(text) {
    if (!text || typeof text !== 'string') return text;
    const vaultPath = this.vaultBasePath || (process.cwd ? process.cwd() : '');

    return text.replace(/obsidian:\/\/open\?[^\s"'>)]+/gi, (matched) => {
      const clean = this.resolveCleanVaultPath(matched, vaultPath);
      if (clean && clean.path) {
        if (this.contextProvider && typeof this.contextProvider.setActiveFile === 'function') {
          this.contextProvider.setActiveFile(clean);
          this.updateContextCapsule();
          this.updateCardAttachments();
        }
        return `[[${clean.path}]]`;
      }
      return matched;
    });
  }

  renderWelcomeScreen() {
    // Bulky welcome card removed per user request: keep chat drawer clean and empty
  }

  updateContextCapsule() {
    if (!this.contextCapsuleEl) return;
    
    // NiceAIGC is a general model agent, decoupled from TabonKB knowledge base
    if (this.hub && this.hub.activeAgentId === 'niceaigc') {
      this.contextCapsuleEl.style.display = 'none';
      return;
    }
    this.contextCapsuleEl.style.display = '';

    if (!this.contextProvider) return;
    const info = this.contextProvider.getContextBadgeInfo();

    if (info.hasContext) {
      this.contextCapsuleEl.innerHTML = `
        <div class="tw-ctx-capsule active" title="当前已挂载上下文：${escapeAttr(info.title)}">
          <span class="tw-ctx-icon">${getIconPark('target', 13)}</span>
          <span class="tw-ctx-title">${escapeHtml(info.title)}</span>
          <span class="tw-ctx-sub">(${escapeHtml(info.module || '通用')})</span>
          <span class="tw-ctx-clear-btn" role="button" tabindex="0" title="清除节点聚焦，切回全局知识库">${getIconPark('close', 11)}</span>
        </div>
      `;
      const clearBtn = this.contextCapsuleEl.querySelector('.tw-ctx-clear-btn');
      if (clearBtn) {
        const doClear = (e) => {
          e.stopPropagation();
          if (typeof this.contextProvider.clearContext === 'function') {
            this.contextProvider.clearContext();
          } else {
            this.contextProvider.clearKnowledgeNode();
          }
          this.updateCardAttachments();
        };
        clearBtn.onclick = doClear;
        clearBtn.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            doClear(e);
          }
        };
      }
    } else {
      this.contextCapsuleEl.innerHTML = `
        <div class="tw-ctx-capsule global" title="未选中节点，查询覆盖整个知识库">
          <span class="tw-ctx-icon">${getIconPark('globe', 13)}</span>
          <span class="tw-ctx-title">全局知识库 (TabonKB)</span>
        </div>
      `;
    }
  }

  updateCardAttachments() {
    if (!this.cardAttachmentsEl) return;

    // NiceAIGC is decoupled from knowledge base attachments
    if (this.hub && this.hub.activeAgentId === 'niceaigc') {
      this.cardAttachmentsEl.style.display = 'none';
      this.cardAttachmentsEl.innerHTML = '';
      return;
    }

    const activeFile = this.contextProvider?.getActiveFile?.();
    if (activeFile && activeFile.path) {
      this.cardAttachmentsEl.style.display = 'flex';
      this.cardAttachmentsEl.innerHTML = `
        <div class="tw-card-attachment-chip" title="${escapeAttr(activeFile.path)}">
          <span class="tw-chip-icon">${getIconPark('file-text', 13)}</span>
          <span class="tw-chip-name">${escapeHtml(activeFile.basename || activeFile.name || '当前笔记')}</span>
          <span class="tw-chip-remove" role="button" tabindex="0" title="移除附加文档">${getIconPark('close', 11)}</span>
        </div>
      `;
      const removeBtn = this.cardAttachmentsEl.querySelector('.tw-chip-remove');
      if (removeBtn) {
        const doRemove = (e) => {
          e.stopPropagation();
          if (typeof this.contextProvider.clearContext === 'function') {
            this.contextProvider.clearContext();
          } else {
            this.contextProvider.clearKnowledgeNode();
          }
          this.updateCardAttachments();
          this.updateContextCapsule();
        };
        removeBtn.onclick = doRemove;
        removeBtn.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            doRemove(e);
          }
        };
      }
    } else {
      this.cardAttachmentsEl.style.display = 'none';
      this.cardAttachmentsEl.innerHTML = '';
    }
  }

  updateStatus(statusObj) {
    if (!this.statusLed || !this.statusText) return;
    const { status, detail } = statusObj || { status: 'disconnected', detail: '' };

    this.statusLed.className = `tw-status-dot ${status}`;

    let label = '未连接';
    if (status === 'connected') label = '已就绪';
    else if (status === 'thinking') label = '思考中...';
    else if (status === 'running_tool') label = '调用工具';
    else if (status === 'connecting') label = '连接中...';
    else if (status === 'error') label = '服务异常';
    else if (status === 'not_installed') label = '未安装';

    this.statusText.textContent = label;
    this.statusText.title = detail || label;

    this.updateSendButtonState(status);
  }

  // 自动探测并连接当前 Agent（重载/打开抽屉时触发，避免指示灯停在灰色未连接）
  ensureAgentConnected() {
    if (!this.hub) return;
    const adapter = this.hub.getActiveAdapter();
    if (!adapter) return;
    if (adapter.status !== 'disconnected') {
      this.updateStatus(adapter.getStatus());
      return;
    }
    // 同一 Agent 的探测链已在进行中则不重复发起
    if (this._connInFlightAgent === adapter.id) return;
    this._connInFlightAgent = adapter.id;

    this.updateStatus({ status: 'connecting', detail: '正在检测并连接...' });

    const work = Promise.resolve()
      .then(() => (typeof adapter.detect === 'function' ? adapter.detect() : { available: true }))
      .then((det) => {
        if (det && det.available && typeof adapter.start === 'function') {
          return adapter.start();
        }
        return null;
      });

    // 30s 超时兜底机制：探测/连接挂起时转红色 error，避免指示灯永远紫色脉冲；
    // work 链继续后台执行，若之后真实连上，adapter 的 status_change 会经 hub 自动纠正灯色
    let timedOut = false;
    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(new Error('connect timeout'));
      }, 30000);
    });

    Promise.race([work, timeout])
      .catch((e) => {
        console.warn('[PiDrawerView] ensureAgentConnected failed:', e);
        if (timedOut) {
          this.updateStatus({ status: 'error', detail: '连接超时（30秒），点击指示灯重试' });
        }
      })
      .finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
        this._connInFlightAgent = null;
        if (!timedOut) {
          this.updateStatus(adapter.getStatus());
        }
      });
  }

  // ===== 知识库 & 芯片资源检索（非 Pi Agent 的 RAG 注入）=====
  getVendorService() {
    if (this._vendorService) return this._vendorService;
    try {
      const plugin = (this.app && this.app.plugins && typeof this.app.plugins.getPlugin === 'function')
        ? this.app.plugins.getPlugin('tabonkb-workbench') : null;
      if (plugin && plugin.vendorService) {
        this._vendorService = plugin.vendorService;
        return this._vendorService;
      }
      if (typeof VendorPortalService === 'function') {
        this._vendorService = new VendorPortalService({ plugin: plugin || null, vaultBasePath: this.vaultBasePath });
      }
    } catch (e) {
      console.warn('[PiDrawerView] vendor service unavailable:', e);
    }
    return this._vendorService || null;
  }

  extractQueryTokens(query) {
    const stop = ['帮我', '请问', '一下', '怎么', '如何', '是什么', '搜索', '检索', '资料', '文档', '内容', '问题', '关于', '的', '了', '和', '与', '请', '到', '在', '有', '吗', '呢'];
    let q = String(query || '').toLowerCase();
    for (const w of [...stop].sort((a, b) => b.length - a.length)) q = q.split(w).join(' ');
    const raw = q.match(/[a-z0-9][a-z0-9_\-\.]{1,}|[\u4e00-\u9fff]{2,6}/g) || [];
    return [...new Set(raw)].slice(0, 8);
  }

  buildKbIndex() {
    const now = Date.now();
    if (this._kbIndex && now - this._kbIndex.builtAt < 10 * 60 * 1000) return this._kbIndex;
    const skip = new Set(['.obsidian', '.git', 'node_modules', '98-Archive', '.pi', '.agents', '.qoder']);
    const files = [];
    const walk = (dir, depth) => {
      if (depth > 4 || files.length > 3000) return;
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const en of entries) {
        if (en.name.startsWith('.')) continue;
        const p = path.join(dir, en.name);
        if (en.isDirectory()) { if (!skip.has(en.name)) walk(p, depth + 1); }
        else if (en.name.endsWith('.md')) files.push(p);
      }
    };
    walk(this.vaultBasePath, 0);
    this._kbIndex = { builtAt: now, files };
    return this._kbIndex;
  }

  searchKnowledgeBase(query, limit = 4) {
    const tokens = this.extractQueryTokens(query);
    if (!tokens.length || !this.vaultBasePath || typeof fs === 'undefined') return [];
    const idx = this.buildKbIndex();
    const hits = [];
    for (const fp of idx.files) {
      let content = '';
      try { content = fs.readFileSync(fp, 'utf8'); } catch (e) { continue; }
      if (content.length > 400000) content = content.slice(0, 400000);
      const lower = content.toLowerCase();
      const nameLower = fp.toLowerCase();
      let score = 0;
      let firstPos = -1;
      for (const t of tokens) {
        if (nameLower.includes(t)) score += 4;
        let pos = lower.indexOf(t);
        let cnt = 0;
        while (pos >= 0 && cnt < 8) { cnt++; if (firstPos < 0) firstPos = pos; pos = lower.indexOf(t, pos + t.length); }
        score += cnt;
      }
      if (score >= 3) {
        const rel = fp.slice(this.vaultBasePath.length).replace(/^[\\/]/, '').replace(/\\/g, '/');
        let snippet = '';
        if (firstPos >= 0) {
          const s = Math.max(0, firstPos - 60);
          snippet = content.slice(s, s + 220).replace(/\s+/g, ' ').trim();
        }
        hits.push({ path: rel, score, snippet });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  async searchVendorResources(query) {
    const svc = this.getVendorService();
    if (!svc) return [];
    const pick = (res) => {
      if (!res) return [];
      if (Array.isArray(res)) return res;
      if (Array.isArray(res.hits)) return res.hits;
      if (Array.isArray(res.results)) return res.results;
      return [];
    };
    try {
      const live = await Promise.race([
        Promise.resolve(svc.searchResourcesLive(query)),
        new Promise((_, rej) => setTimeout(() => rej(new Error('vendor live search timeout')), 12000))
      ]);
      const list = pick(live);
      if (list.length) return list.slice(0, 4);
    } catch (e) { /* 回退本地索引 */ }
    try {
      return pick(svc.searchResources(query)).slice(0, 4);
    } catch (e) { return []; }
  }

  async gatherRetrievalContext(query) {
    const toolId = 'retrieval_' + Date.now();
    const startedAt = Date.now();
    this.handleToolStart({ toolCallId: toolId, toolName: 'kb_vendor_search', actionDesc: '检索 TabonKB 知识库与芯片原厂资源...', startTime: startedAt });
    const blocks = [];
    let kbCount = 0;
    let vendorCount = 0;
    try {
      const kb = this.searchKnowledgeBase(query);
      kbCount = kb.length;
      if (kb.length) {
        blocks.push('[TabonKB 知识库检索结果]\n' + kb.map((h, i) => `${i + 1}. ${h.path}\n   摘要: ${h.snippet || '(无摘要)'}`).join('\n'));
      }
    } catch (e) { console.warn('[PiDrawerView] kb search failed:', e); }
    try {
      const vr = await this.searchVendorResources(query);
      vendorCount = vr.length;
      if (vr.length) {
        blocks.push('[芯片原厂资源检索结果]\n' + vr.map((r, i) => {
          const title = r.title || r.name || r.docId || '资源';
          const src = r.portalId || r.source || r.portal || 'vendor';
          const url = r.url || r.link || '';
          const sum = r.summary ? String(r.summary).slice(0, 160) : '';
          return `${i + 1}. [${src}] ${title}${url ? ' ' + url : ''}${sum ? '\n   摘要: ' + sum : ''}`;
        }).join('\n'));
      } else {
        // 0 命中不再静默: 明示原因, 并引导有 MCP 工具的 Agent 自行二次检索
        blocks.push('[芯片原厂资源检索结果] 本次预检索 0 命中 (可能原因: 原厂门户未登录 / 受控文档不在本地索引)。若你已接入 vendor_portal_search / vendor_portal_get_detail 工具, 请换用更短的关键词(如型号、FAQ 编号)主动调用工具二次检索; 否则请提示用户在「芯片资源检索」面板检查原厂账号登录状态。');
      }
    } catch (e) { console.warn('[PiDrawerView] vendor search failed:', e); }
    this.handleToolEnd({ toolCallId: toolId, toolName: 'kb_vendor_search', durationMs: Date.now() - startedAt, isError: false, output: `知识库 ${kbCount} 条 / 原厂 ${vendorCount} 条` });
    if (!blocks.length) return { block: '', kbCount, vendorCount };
    const block = '\n\n' + blocks.join('\n\n') + '\n\n[回答要求] 优先基于以上检索资料回答并标注来源路径/链接；输出使用 Markdown 格式（标题、列表、代码块、链接）。';
    return { block, kbCount, vendorCount };
  }

  updateSendButtonState(statusOverride) {
    if (!this.btnSend) return;
    const status = statusOverride || (this.hub ? this.hub.getStatus()?.status : 'disconnected');
    const hubStreaming = !!(this.hub && typeof this.hub.isStreaming === 'function' && this.hub.isStreaming());
    const isStreaming = (!this._sendInFlight && !this.currentAssistantMessage && (status === 'connected' || status === 'disconnected'))
      ? false
      : ((status === 'thinking' || status === 'running_tool') || !!this._sendInFlight || hubStreaming);

    if (isStreaming) {
      this.btnSend.style.display = 'none';
      if (this.btnAbort) {
        this.btnAbort.style.display = 'inline-flex';
        // 复位上一次中止请求的禁用态（_sendInFlight 收尾后重新可点）
        if (this.btnAbort.disabled && !this._abortRequested) {
          this.btnAbort.disabled = false;
          this.btnAbort.title = '中止当前回复';
        }
      }
    } else {
      if (this.btnAbort) this.btnAbort.style.display = 'none';
      this.btnSend.style.display = 'inline-flex';

      const adapter = this.hub ? this.hub.getActiveAdapter() : null;
      const isInstalled = adapter ? adapter.status !== 'not_installed' : true;
      const hasText = !!(this.inputEl && this.inputEl.value.trim().length > 0);
      const hasImages = !!(this.attachedImages && this.attachedImages.length > 0);
      const hasChips = !!(this.inputChips && this.inputChips.length > 0);

      const canSend = isInstalled && (hasText || hasImages || hasChips);
      this.btnSend.disabled = !canSend;
      if (!canSend) {
        this.btnSend.classList.add('disabled');
      } else {
        this.btnSend.classList.remove('disabled');
      }
    }
  }

  setupHubEvents() {
    this.hub.on('status_change', (s) => this.updateStatus(s));

    this.hub.on('turn_start', () => {
      this.lastHubError = null;
      this.removeWelcomeScreen();
      if (!this.currentAssistantMessage) {
        this.createAssistantMessageBubble();
      }
    });

    this.hub.on('thinking_start', (data) => {
      this.handleThinkingStart(data);
    });

    this.hub.on('thinking_delta', (delta) => {
      this.appendAssistantThinkingDelta(delta);
    });

    this.hub.on('thinking_end', (data) => {
      this.handleThinkingEnd(data);
    });

    this.hub.on('thinking_recap', (data) => {
      this.handleThinkingRecap(data);
    });

    this.hub.on('text_delta', (delta) => {
      this.appendAssistantDelta(delta);
    });

    this.hub.on('tool_start', (toolData) => {
      this.handleToolStart(toolData);
    });

    this.hub.on('tool_end', (toolData) => {
      this.handleToolEnd(toolData);
    });

    this.hub.on('turn_end', (d) => {
      if (d) {
        const u = d.message?.usage || d.usage || d.turn?.usage;
        if (u) {
          const inputTokens = u.input || u.prompt_tokens || u.promptTokens || u.inputTokens || 0;
          const outputTokens = u.output || u.completion_tokens || u.completionTokens || u.outputTokens || 0;
          const cacheReadTokens = u.cacheRead || u.prompt_cache_hit_tokens || u.cacheReadTokens || 0;
          const totalTokens = u.totalTokens || u.total_tokens || (inputTokens + outputTokens);
          this.lastTurnUsage = { inputTokens, outputTokens, cacheReadTokens, totalTokens };
        }
      }
      if (!this.hub.isStreaming()) {
        this.finishAssistantMessage();
        this.updateSendButtonState();
      }
    });

    this.hub.on('agent_settled', (d) => {
      if (d && !this.lastTurnUsage) {
        const u = d.message?.usage || d.usage;
        if (u) {
          const inputTokens = u.input || u.prompt_tokens || u.promptTokens || u.inputTokens || 0;
          const outputTokens = u.output || u.completion_tokens || u.completionTokens || u.outputTokens || 0;
          const cacheReadTokens = u.cacheRead || u.prompt_cache_hit_tokens || u.cacheReadTokens || 0;
          const totalTokens = u.totalTokens || u.total_tokens || (inputTokens + outputTokens);
          this.lastTurnUsage = { inputTokens, outputTokens, cacheReadTokens, totalTokens };
        }
      }
      this.finishAssistantMessage();
      this.updateSendButtonState();
    });

    this.hub.on('aborted', () => {
      this.finishAssistantMessage(true);
      this.updateSendButtonState();
    });

    this.hub.on('new_session', () => {
      if (this.currentAssistantMessage) {
        this.finishAssistantMessage();
      }
      this.messages = [];
      if (this.messagesEl) {
        this.messagesEl.innerHTML = '';
      }
    });

    this.hub.on('error', (err) => {
      this.lastHubError = err;
      if (!this.currentAssistantMessage) {
        this.createAssistantMessageBubble();
      }
      const errMsg = err.error || err.message || '执行异常';
      if (!this.currentAssistantMessage.rawText || !this.currentAssistantMessage.rawText.includes(errMsg)) {
        this.appendAssistantDelta(`\n⚠️ 提示: ${errMsg}`);
      }
      this.finishAssistantMessage();
      // 上游加密推理内容失效（invalid_encrypted_content）：净化会话后自动重试一次
      if (err.encrypted || /invalid_encrypted_content|encrypted content could not be/i.test(errMsg)) {
        this._autoRepairEncryptedSession();
      }
    });

    if (this.contextProvider && typeof this.contextProvider.onChange === 'function') {
      this.contextProvider.onChange(() => {
        this.updateContextCapsule();
        this.updateCardAttachments();
      });
    }
  }

  removeWelcomeScreen() {
    const welcome = this.messagesEl.querySelector('.tw-agent-welcome');
    if (welcome) welcome.remove();
  }

  createAssistantMessageBubble() {
    this._hasAssistantMessageInTurn = true;
    if (this.currentAssistantMessage) {
      return this.currentAssistantMessage;
    }

    const adapter = this.hub.getActiveAdapter();
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let authorName = (currentModel && currentModel.name) ? currentModel.name : adapter.displayName;
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel?.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) authorName += ` · ${effortConfig.label}`;
    }

    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap assistant';

    // 1. Process Banner (Expanded while in flight, auto-collapsed on completion)
    const banner = document.createElement('div');
    banner.className = 'tw-dsh-process-banner';
    banner.innerHTML = `
      <div class="tw-dsh-banner-header">
        <span class="tw-dsh-banner-status-text">正在处理...，用时 1秒</span>
        <span class="tw-dsh-banner-chevron">${DSH_ICONS.chevronUp}</span>
      </div>
      <div class="tw-dsh-banner-divider"></div>
      <div class="tw-dsh-banner-body"></div>
    `;

    const bannerHeader = banner.querySelector('.tw-dsh-banner-header');
    bannerHeader.onclick = () => {
      banner.classList.toggle('collapsed');
      const chevron = bannerHeader.querySelector('.tw-dsh-banner-chevron');
      if (chevron) {
        chevron.innerHTML = banner.classList.contains('collapsed') ? DSH_ICONS.chevronDown : DSH_ICONS.chevronUp;
      }
    };

    bubbleWrap.appendChild(banner);

    // 2. Final Content container (hidden until text arrives)
    const content = document.createElement('div');
    content.className = 'tw-msg-content';
    content.style.display = 'none';
    bubbleWrap.appendChild(content);

    // 3. Action Bar (displayed upon finish or text streaming)
    const actionBar = document.createElement('div');
    actionBar.className = 'tw-msg-action-bar';
    actionBar.style.display = 'none';
    actionBar.innerHTML = `
      <div class="tw-action-group-left">
        <button type="button" class="tw-dsh-action-btn tw-action-copy-btn" title="复制回答全文">${DSH_ICONS.copy}</button>
        <div class="tw-dsh-usage-wrap">
          <button type="button" class="tw-dsh-usage-btn" title="查看本轮 Token 用量明细">
            <span class="tw-dsh-usage-icon">${DSH_ICONS.database}</span>
            <span class="tw-dsh-usage-text">用量 计算中...</span>
          </button>
        </div>
        <span class="tw-msg-timestamp">${this.formatTime(Date.now())}</span>
      </div>
    `;
    bubbleWrap.appendChild(actionBar);

    this.messagesEl.appendChild(bubbleWrap);
    this.scrollToBottom();

    const startTime = Date.now();
    const statusTextEl = banner.querySelector('.tw-dsh-banner-status-text');
    const bannerTimer = setInterval(() => {
      if (!this.currentAssistantMessage || this.currentAssistantMessage.isFinished) {
        clearInterval(bannerTimer);
        return;
      }
      const elapsed = Date.now() - startTime;
      if (statusTextEl) {
        statusTextEl.textContent = `正在处理...，用时 ${this.formatDuration(elapsed)}`;
      }
    }, 1000);

    const dividerEl = banner.querySelector('.tw-dsh-banner-divider');
    const bannerBodyEl = banner.querySelector('.tw-dsh-banner-body');

    // 初始状态: 若尚无任何步骤，隐藏分割线与空白容器，杜绝空框与虚假竖线
    if (dividerEl) dividerEl.style.display = 'none';
    if (bannerBodyEl) bannerBodyEl.style.display = 'none';

    this.currentAssistantMessage = {
      wrapEl: bubbleWrap,
      bannerEl: banner,
      bannerHeaderEl: bannerHeader,
      bannerDividerEl: dividerEl,
      bannerBodyEl: bannerBodyEl,
      statusTextEl: statusTextEl,
      contentEl: content,
      actionBarEl: actionBar,
      usageBtnEl: actionBar.querySelector('.tw-dsh-usage-btn'),
      bannerTimer: bannerTimer,
      startTime: startTime,
      isFinished: false,
      thinkingText: '',
      thinkingStartTime: null,
      isThinking: false,
      toolCount: 0,
      toolCalls: [],
      rawText: '',
      steps: [],
      currentStep: null,
      activeToolCards: new Map()
    };

    // 若当前 Agent 或模型明确属于深度推理模型，立即挂载思考步骤，给用户即时反馈
    const isReasoning = typeof adapter?.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel?.id);
    if (isReasoning) {
      this.ensureThinkingStep();
    }

    return this.currentAssistantMessage;
  }

  ensureThinkingStep() {
    const msg = this.currentAssistantMessage;
    if (!msg) return null;
    if (msg.currentStep && msg.currentStep.type === 'thinking') {
      return msg.currentStep;
    }

    if (msg.bannerDividerEl) msg.bannerDividerEl.style.display = 'block';
    if (msg.bannerBodyEl) msg.bannerBodyEl.style.display = 'flex';

    const marker = document.createElement('div');
    marker.className = 'tw-dsh-step-marker running';
    marker.innerHTML = `
      <span class="tw-dsh-step-icon">${DSH_ICONS.sparkle}</span>
      <span class="tw-dsh-step-label">正在深度思考推演...</span>
    `;
    const prose = document.createElement('div');
    prose.className = 'tw-dsh-thinking-prose';
    prose.style.display = 'none';

    msg.bannerBodyEl.appendChild(marker);
    msg.bannerBodyEl.appendChild(prose);
    if (msg.bannerBodyEl) {
      msg.bannerBodyEl.scrollTop = msg.bannerBodyEl.scrollHeight;
    }

    const stepObj = {
      type: 'thinking',
      icon: 'sparkle',
      label: '正在深度思考推演...',
      text: '',
      markerEl: marker,
      labelEl: marker.querySelector('.tw-dsh-step-label'),
      proseEl: prose
    };
    msg.steps.push(stepObj);
    msg.currentStep = stepObj;
    return stepObj;
  }

  handleThinkingStart(data) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;
    msg.isThinking = true;
    if (!msg.thinkingStartTime) msg.thinkingStartTime = (data && data.startTime) || Date.now();
    this.ensureThinkingStep();
    this.scrollToBottom();
  }

  appendAssistantThinkingDelta(delta) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;
    msg.isThinking = true;
    if (!msg.thinkingStartTime) msg.thinkingStartTime = Date.now();
    msg.thinkingText = (msg.thinkingText || '') + delta;

    if (msg.currentStep && msg.currentStep.type === 'tool') {
      msg.currentStep.text = (msg.currentStep.text || '') + delta;
      if (msg.currentStep.proseEl) {
        msg.currentStep.proseEl.style.display = 'block';
      }
    } else {
      const step = this.ensureThinkingStep();
      if (step) {
        step.text = (step.text || '') + delta;
        if (step.proseEl && step.text.trim()) {
          step.proseEl.style.display = 'block';
        }
      }
    }

    this.scheduleAssistantThinkingRender();
  }

  scheduleAssistantThinkingRender() {
    if (this._thinkingRenderRafId) return;
    this._thinkingRenderRafId = requestAnimationFrame(() => {
      this._thinkingRenderRafId = null;
      if (!this.currentAssistantMessage) return;
      const msg = this.currentAssistantMessage;
      if (msg.currentStep && msg.currentStep.proseEl) {
        msg.currentStep.proseEl.textContent = msg.currentStep.text || '';
        if (msg.currentStep.text && msg.currentStep.text.trim()) {
          msg.currentStep.proseEl.style.display = 'block';
        }
      }
      if (msg.bannerBodyEl) {
        const isNearBottom = msg.bannerBodyEl.scrollHeight - msg.bannerBodyEl.scrollTop - msg.bannerBodyEl.clientHeight < 80;
        if (isNearBottom) {
          msg.bannerBodyEl.scrollTop = msg.bannerBodyEl.scrollHeight;
        }
      }
      this.scrollToBottom();
    });
  }

  handleThinkingEnd(data) {
    if (!this.currentAssistantMessage) return;
    const msg = this.currentAssistantMessage;
    msg.isThinking = false;
    if (this._thinkingRenderRafId) {
      cancelAnimationFrame(this._thinkingRenderRafId);
      this._thinkingRenderRafId = null;
    }
    if (msg.currentStep && msg.currentStep.type === 'thinking') {
      if (msg.currentStep.markerEl) {
        msg.currentStep.markerEl.classList.remove('running');
      }
      const duration = data?.durationSec || data?.finished_duration_sec;
      if (duration) {
        msg.currentStep.label = `思考过程（用时 ${duration} 秒）`;
        if (msg.currentStep.labelEl) msg.currentStep.labelEl.textContent = msg.currentStep.label;
      } else if (msg.currentStep.label === '正在深度思考推演...') {
        msg.currentStep.label = '思考过程';
        if (msg.currentStep.labelEl) msg.currentStep.labelEl.textContent = '思考过程';
      }
      if (data?.recapType === 'hide_all' && !msg.currentStep.text) {
        msg.currentStep.text = '模型已完成深度思考推理（受 OpenAI 服务端策略保护，隐式思维链明文未下发）。';
      }
      if (msg.currentStep.proseEl) {
        if (msg.currentStep.text && msg.currentStep.text.trim()) {
          msg.currentStep.proseEl.textContent = msg.currentStep.text;
          msg.currentStep.proseEl.style.display = 'block';
        }
      }
    }
  }

  handleThinkingRecap(data) {
    if (!this.currentAssistantMessage) return;
    const msg = this.currentAssistantMessage;
    const step = this.ensureThinkingStep();
    if (!step) return;
    if (step.markerEl) {
      step.markerEl.classList.remove('running');
    }
    const duration = data?.durationSec || data?.finished_duration_sec;
    if (duration) {
      step.label = `思考过程（用时 ${duration} 秒）`;
      if (step.labelEl) step.labelEl.textContent = step.label;
    }
    if (data?.content && typeof data.content === 'string' && data.content.trim()) {
      if (!step.text) {
        step.text = data.content.trim();
      }
    }
    if (!step.text && data?.recapType === 'hide_all') {
      step.text = '模型已完成深度思考推理（受 OpenAI 服务端策略保护，隐式思维链明文未下发）。';
    }
    if (step.proseEl && step.text) {
      step.proseEl.textContent = step.text;
      step.proseEl.style.display = 'block';
    }
  }

  appendAssistantDelta(delta) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;
    msg.rawText += delta;

    if (msg.rawText.trim().length > 0) {
      msg.contentEl.style.display = 'block';
      if (msg.actionBarEl) msg.actionBarEl.style.display = 'flex';
    }

    msg.contentEl.classList.add('streaming');
    this.scheduleAssistantTextRender();
  }

  scheduleAssistantTextRender() {
    if (this._textRenderRafId) return;
    this._textRenderRafId = requestAnimationFrame(() => {
      this._textRenderRafId = null;
      if (!this.currentAssistantMessage) return;
      const msg = this.currentAssistantMessage;
      msg.contentEl.textContent = cleanAssistantMarkdown(msg.rawText);
      this.scrollToBottom();
    });
  }

  handleToolStart({ toolCallId, toolName, args, startTime, actionDesc }) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;
    msg.toolCount++;

    if (msg.bannerDividerEl) msg.bannerDividerEl.style.display = 'block';
    if (msg.bannerBodyEl) msg.bannerBodyEl.style.display = 'flex';

    const toolCallObj = { toolCallId, toolName, args, startTime, actionDesc };
    msg.toolCalls.push(toolCallObj);

    // If preceding step was initial thinking, finalize its label to DSH style
    if (msg.currentStep && msg.currentStep.type === 'thinking') {
      if (msg.currentStep.labelEl) {
        msg.currentStep.labelEl.textContent = '已调用工具';
      }
      msg.currentStep.label = '已调用工具';
      msg.currentStep = null;
    }

    let toolStep = null;
    const lastStep = msg.steps[msg.steps.length - 1];
    if (lastStep && lastStep.type === 'tool' && !lastStep.isClosed) {
      toolStep = lastStep;
      toolStep.toolCalls.push(toolCallObj);
      if (toolStep.labelEl) {
        toolStep.markerEl.classList.add('running');
        toolStep.labelEl.textContent = `正在执行: ${actionDesc || toolName}...`;
      }
    } else {
      const marker = document.createElement('div');
      marker.className = 'tw-dsh-step-marker running';
      marker.innerHTML = `
        <span class="tw-dsh-step-icon">${DSH_ICONS.fileText}</span>
        <span class="tw-dsh-step-label">正在执行: ${escapeHtml(actionDesc || toolName)}...</span>
      `;
      const prose = document.createElement('div');
      prose.className = 'tw-dsh-thinking-prose';
      prose.style.display = 'none';

      msg.bannerBodyEl.appendChild(marker);
      msg.bannerBodyEl.appendChild(prose);
      if (msg.bannerBodyEl) {
        msg.bannerBodyEl.scrollTop = msg.bannerBodyEl.scrollHeight;
      }

      toolStep = {
        type: 'tool',
        icon: 'fileText',
        label: `正在执行: ${actionDesc || toolName}...`,
        text: '',
        toolCalls: [toolCallObj],
        markerEl: marker,
        labelEl: marker.querySelector('.tw-dsh-step-label'),
        proseEl: prose,
        isClosed: false
      };
      msg.steps.push(toolStep);
    }

    msg.currentStep = toolStep;
    this.activeToolCards.set(toolCallId, {
      toolStep,
      toolCallRef: toolCallObj,
      startTime: startTime || Date.now()
    });

    this.scrollToBottom();
  }

  handleToolEnd({ toolCallId, toolName, durationMs, isError, error, output }) {
    const cardInfo = this.activeToolCards.get(toolCallId);
    if (!cardInfo) return;
    this.activeToolCards.delete(toolCallId);

    const { toolStep, toolCallRef } = cardInfo;
    if (toolCallRef) {
      toolCallRef.durationMs = durationMs;
      toolCallRef.isError = isError;
    }

    if (toolStep && toolStep.labelEl) {
      toolStep.markerEl.classList.remove('running');
      if (isError) {
        toolStep.markerEl.classList.add('error');
        toolStep.labelEl.textContent = `${toolCallRef?.actionDesc || toolName} 执行失败`;
        toolStep.label = `${toolCallRef?.actionDesc || toolName} 执行失败`;
      } else {
        const summary = this.generateBatchToolSummary(toolStep.toolCalls);
        toolStep.labelEl.textContent = summary;
        toolStep.label = summary;
      }
    }
  }

  finishAssistantMessage(isAborted = false) {
    if (!this.currentAssistantMessage) return;
    if (this._textRenderRafId) {
      cancelAnimationFrame(this._textRenderRafId);
      this._textRenderRafId = null;
    }
    if (this._thinkingRenderRafId) {
      cancelAnimationFrame(this._thinkingRenderRafId);
      this._thinkingRenderRafId = null;
    }
    if (this._scrollRafId) {
      cancelAnimationFrame(this._scrollRafId);
      this._scrollRafId = null;
    }
    const msg = this.currentAssistantMessage;
    msg.isFinished = true;

    if (msg.bannerTimer) {
      clearInterval(msg.bannerTimer);
      msg.bannerTimer = null;
    }

    // Clear any running tools
    this.activeToolCards.clear();

    const durationMs = Date.now() - (msg.startTime || Date.now());
    const durationStr = this.formatDuration(durationMs);

    // Update banner to completed state and collapse by default (matching DSH)
    if (msg.statusTextEl) {
      msg.statusTextEl.textContent = isAborted ? `已中止，用时 ${durationStr}` : `已完成，用时 ${durationStr}`;
    }
    if (msg.bannerEl) {
      msg.bannerEl.classList.add('collapsed');
      const chevron = msg.bannerHeaderEl?.querySelector('.tw-dsh-banner-chevron');
      if (chevron) chevron.innerHTML = DSH_ICONS.chevronDown;
    }

    if (!msg.steps || msg.steps.length === 0) {
      // 若本轮回答既没有触发深度思考，也没有调用工具，隐藏空白 Banner，保持界面极致简约
      if (msg.bannerEl) msg.bannerEl.style.display = 'none';
    } else {
      for (let i = 0; i < msg.steps.length; i++) {
        const step = msg.steps[i];
        if (step.markerEl) {
          step.markerEl.classList.remove('running');
        }
        if (step.type === 'thinking') {
          if (msg.steps.length > 1 && i === 0 && msg.toolCalls.length > 0) {
            step.label = '已调用工具';
            if (step.labelEl) step.labelEl.textContent = '已调用工具';
          } else if (step.label === '正在深度思考推演...') {
            step.label = '思考过程';
            if (step.labelEl) step.labelEl.textContent = '思考过程';
          }
        } else if (step.type === 'tool') {
          if (step.toolCalls && step.toolCalls.length > 0) {
            const sum = this.generateBatchToolSummary(step.toolCalls);
            step.label = sum;
            if (step.labelEl) step.labelEl.textContent = sum;
          }
        }
      }
    }

    if (isAborted) {
      msg.contentEl.style.display = 'block';
      const abortNotice = document.createElement('div');
      abortNotice.className = 'tw-aborted-notice';
      abortNotice.textContent = '（已中止）';
      msg.contentEl.appendChild(abortNotice);
    }

    msg.contentEl.classList.remove('streaming');

    if (msg.rawText && msg.rawText.trim().length > 0) {
      msg.rawText = cleanAssistantMarkdown(msg.rawText);
      msg.contentEl.style.display = 'block';
      msg.contentEl.setAttribute('data-raw', msg.rawText);
      this.formatMessageContent(msg.contentEl, msg.rawText);

    } else if (isAborted) {
      // Aborted notice already added above
    } else {
      // Empty response fallback: Never leave a blank bubble!
      msg.contentEl.style.display = 'block';
      const adapter = this.hub ? this.hub.getActiveAdapter() : null;
      const currentModel = adapter && typeof adapter.getModel === 'function' ? adapter.getModel() : { id: '', name: '' };
      const modelName = currentModel.name || '当前模型';
      const errDetail = this.lastHubError ? (this.lastHubError.message || this.lastHubError.error || '') : '';

      msg.contentEl.innerHTML = `
        <div class="tw-empty-response-card" style="padding: 12px 14px; border-radius: 6px; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.35); font-size: 12px; line-height: 1.6; color: var(--text-normal);">
          <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
            <span>${getIconPark('alert', 14, { color: '#EF4444' })}</span><span>未收到模型回复内容</span>
          </div>
          <div style="color: var(--text-muted); font-size: 11.5px;">
            模型 <b>${escapeHtml(modelName)}</b> 上游通道未返回有效文本${errDetail ? `（上游提示: <code style="color:#ef4444;">${escapeHtml(errDetail)}</code>）` : '（可能处于并发超限 429 或网络瞬时抖动）'}。
          </div>
        </div>
      `;
    }

    // Always reveal action bar on finish
    if (msg.actionBarEl) {
      msg.actionBarEl.style.display = 'flex';
      const timeSpan = msg.actionBarEl.querySelector('.tw-msg-timestamp');
      if (timeSpan) timeSpan.textContent = this.formatTime(Date.now());
    }

    // Token Usage computation & binding
    const adapter = this.hub.getActiveAdapter();
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let authorModel = (currentModel && currentModel.name) ? currentModel.name : adapter.displayName;
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel?.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) authorModel += ` · ${effortConfig.label}`;
    }
    const providerAndModel = (adapter.displayName || adapter.name) + ' / ' + authorModel;

    let usageData = this.lastTurnUsage || null;
    this.lastTurnUsage = null;

    if (!usageData || !usageData.totalTokens || usageData.totalTokens <= 0) {
      const outTok = Math.max(1, Math.round(((msg.rawText || '').length + (msg.thinkingText?.length || 0)) * 0.75));
      const inTok = Math.max(120, Math.round(outTok * 1.5 + 450));
      usageData = {
        inputTokens: inTok,
        outputTokens: outTok,
        cacheReadTokens: Math.round(inTok * 0.4),
        totalTokens: inTok + outTok
      };
    }
    usageData.providerAndModel = providerAndModel;
    usageData.durationText = durationStr;

    if (msg.usageBtnEl) {
      const usageText = msg.usageBtnEl.querySelector('.tw-dsh-usage-text');
      if (usageText) {
        usageText.textContent = `用量 ${this.formatTokensPill(usageData.totalTokens)}`;
      }
      msg.usageBtnEl.onclick = (e) => {
        e.stopPropagation();
        this.showTokenUsagePopover(msg.usageBtnEl, usageData);
      };
    }

    // Bind action bar buttons
    const copyBtn = msg.actionBarEl?.querySelector('.tw-action-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(msg.rawText || '');
          const prevHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = DSH_ICONS.check;
          setTimeout(() => { copyBtn.innerHTML = prevHtml; }, 1800);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (window.app?.Notice || class{});
          new NoticeCls('✓ 回答全文已复制到剪贴板', 2000);
        } catch (_) {}
      };
    }



    const serializedSteps = (msg.steps || []).map(s => ({
      type: s.type,
      icon: s.icon,
      label: s.label,
      text: (s.text || '').trim()
    }));

    // Persist to session manager
    this.hub.sessionManager.addMessage(this.hub.activeAgentId, {
      role: 'assistant',
      text: msg.rawText,
      toolCount: msg.toolCount,
      toolCalls: msg.toolCalls,
      model: authorModel,
      thinking: msg.thinkingText || '',
      processSteps: serializedSteps,
      duration: durationMs,
      durationText: durationStr,
      usage: usageData,
      timestamp: Date.now()
    });

    this.currentAssistantMessage = null;
    this.scrollToBottom();
    this.updateSendButtonState();
  }

  async formatMessageContent(el, text) {
    if (!text) return;
    const normalizedText = prepareMarkdownForRender(text, this.vaultBasePath);
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    if (app && typeof MarkdownRenderer !== 'undefined') {
      let comp = this.markdownComponent;
      if (!comp) {
        let CompCls = typeof Component !== 'undefined' ? Component : null;
        if (!CompCls && typeof require !== 'undefined') {
          try { CompCls = require('obsidian')?.Component; } catch (e) {}
        }
        if (CompCls) {
          try {
            comp = new CompCls();
            comp.load();
            this.markdownComponent = comp;
          } catch (e) {}
        }
      }

      el.innerHTML = '';
      try {
        if (typeof MarkdownRenderer.render === 'function') {
          await MarkdownRenderer.render(
            app,
            normalizedText,
            el,
            '',
            comp
          );
        } else if (typeof MarkdownRenderer.renderMarkdown === 'function') {
          await MarkdownRenderer.renderMarkdown(
            normalizedText,
            el,
            '',
            comp
          );
        }
        this.postProcessRenderedMarkdown(el);
        setTimeout(() => this.postProcessRenderedMarkdown(el), 60);
        setTimeout(() => this.postProcessRenderedMarkdown(el), 250);
        return;
      } catch (e) {
        console.warn('[PiDrawerView] MarkdownRenderer failed, falling back to simple format:', e);
      }
    }

    el.innerHTML = formatMarkdownFallback(normalizedText);
    this.postProcessRenderedMarkdown(el);
  }

  isLikelyCodeFile(str) {
    if (!str || typeof str !== 'string') return false;
    let clean = str.trim().replace(/^[`"']|[`"']$/g, '');
    if (clean.length < 3 || clean.length > 300) return false;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return false;
    if (/^(?:cd|git|ls|rm|mkdir|chmod|chown|cat|grep|sed|awk|echo|export|source)\s+/i.test(clean)) return false;

    const validExts = new Set([
      '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
      '.py', '.sh', '.bash', '.dts', '.dtsi',
      '.mk', '.json', '.js', '.mjs', '.ts',
      '.md', '.xml', '.rc', '.ini', '.conf',
      '.diff', '.patch', '.yaml', '.yml', '.java', '.rs', '.go', '.txt'
    ]);

    const noAnchor = clean.replace(/#L\d+(-L\d+)?/i, '').replace(/:\d+(?::\d+)?$/, '');
    const ext = path.extname(noAnchor).toLowerCase();
    const base = path.basename(noAnchor).toLowerCase();

    if (base === 'makefile' || base === 'kbuild' || base === 'kconfig') return true;
    if (validExts.has(ext)) return true;
    if (clean.startsWith('file://')) return true;

    if ((clean.includes('/') || clean.includes('\\')) && (clean.includes('driver') || clean.includes('pri_project') || clean.includes('kernel') || clean.includes('hardware'))) {
      return true;
    }

    return false;
  }

  postProcessRenderedMarkdown(containerEl) {
    if (!containerEl) return;

    // 1. Intercept file/code links and external links in <a>
    containerEl.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || a.href || '';
      const text = (a.textContent || '').trim();

      // Check if it's a code/file link (file:// URI, code file path, or wikilink to note)
      const isFileUri = href.startsWith('file:') || href.startsWith('file:///');
      const isCodeHref = this.isLikelyCodeFile(href);
      const isCodeText = this.isLikelyCodeFile(text);
      const isInternalNote = a.classList.contains('internal-link') || a.getAttribute('data-href');

      if (isFileUri || isCodeHref || isCodeText || isInternalNote) {
        const targetCandidate = isFileUri ? href : (isCodeHref ? href : (isCodeText ? text : (a.getAttribute('data-href') || href || text)));
        a.classList.add('tw-clickable-file-link');
        a.title = `点击在右侧分屏查看: ${targetCandidate}`;
        a.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openCodeInSplitPane(targetCandidate);
        };
        return;
      }

      const targetUrl = resolveLinkToUrl(href, text, a, this.vaultBasePath);
      if (targetUrl) {
        a.setAttribute('href', targetUrl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.classList.add('external-link');
        a.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openExternalUrl(targetUrl);
        };
      }
    });

    // 1.1 Turn inline <code> that look like file paths into clickable links
    containerEl.querySelectorAll('code').forEach(codeEl => {
      if (codeEl.closest('pre')) return; // skip multi-line blocks
      const codeText = (codeEl.textContent || '').trim();
      if (this.isLikelyCodeFile(codeText)) {
        codeEl.classList.add('tw-clickable-file-link');
        codeEl.title = `点击在右侧分屏打开: ${codeText}`;
        codeEl.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openCodeInSplitPane(codeText);
        };
      }
    });

    // 2. Enhance code blocks with styled header bar, language label, and compact copy button
    containerEl.querySelectorAll('pre').forEach(preEl => {
      preEl.classList.add('tw-code-block');

      // Hide default Obsidian copy button to avoid huge or duplicate buttons
      const obCopyBtn = preEl.querySelector('.copy-code-button');
      if (obCopyBtn) {
        obCopyBtn.style.display = 'none';
      }

      if (preEl.querySelector('.tw-code-header-bar') || preEl.dataset.twProcessed === 'true') {
        return;
      }
      preEl.dataset.twProcessed = 'true';

      const codeEl = preEl.querySelector('code');
      let lang = '';
      const classes = [...(preEl.classList || []), ...(codeEl ? codeEl.classList : [])];
      for (const cls of classes) {
        if (cls && typeof cls === 'string' && cls.startsWith('language-')) {
          lang = cls.replace('language-', '').trim();
          break;
        }
      }
      if (!lang || lang === 'none' || lang === 'text' || lang === 'txt') {
        lang = 'CODE';
      } else {
        lang = lang.toUpperCase();
      }

      const headerBar = document.createElement('div');
      headerBar.className = 'tw-code-header-bar';
      headerBar.innerHTML = `
        <span class="tw-code-lang-tag">${escapeHtml(lang)}</span>
        <button class="tw-code-copy-btn" title="复制代码">
          ${getIconPark('copy', 13)}
        </button>
      `;

      preEl.insertBefore(headerBar, preEl.firstChild);
    });

    // 3. Enhance tables with horizontal scroll wrapper
    containerEl.querySelectorAll('table').forEach(table => {
      if (!table.parentElement.classList.contains('tw-chat-table-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'tw-chat-table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });

    // 4. Enhance images: default 50% scale, tooltips, and context menu support
    containerEl.querySelectorAll('img').forEach(img => {
      if (!img.dataset.scale) {
        img.dataset.scale = '50%';
        img.style.maxWidth = '50%';
        img.style.width = 'auto';
        img.style.height = 'auto';
      }
      if (!img.title) {
        img.title = '左键预览大图 · 右键选择大小与复制';
      }
    });
  }

  /**
   * Persist attached image dataUrls to local attachment directory, returning lightweight metadata { name, path, hash, size }
   * @param {Array<any>} images 
   * @returns {Promise<Array<any>|null>}
   */
  async persistAttachedImages(images) {
    if (!images || !Array.isArray(images) || images.length === 0) return null;
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');

    const targetFolderRel = '00-Inbox/03-Quick-Note/attachments/agent-chat';
    const basePath = this.vaultBasePath || (this.app?.vault?.adapter?.basePath) || '';
    const targetFolderAbs = path.join(basePath, targetFolderRel);

    try {
      if (!fs.existsSync(targetFolderAbs)) {
        fs.mkdirSync(targetFolderAbs, { recursive: true });
      }
    } catch (e) {
      console.warn('[PiDrawerView] Failed to create attachments folder:', e);
    }

    const results = [];
    for (const img of images) {
      if (!img) continue;
      if (img.path && !img.dataUrl) {
        results.push({
          name: img.name || path.basename(img.path),
          path: img.path,
          hash: img.hash || null,
          size: img.size || 0,
          width: img.width || null,
          height: img.height || null
        });
        continue;
      }

      if (img.dataUrl && typeof img.dataUrl === 'string') {
        try {
          const match = img.dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          const rawExt = match ? match[1].replace('jpeg', 'jpg').split('+')[0] : 'png';
          const b64Data = match ? match[2] : (img.dataUrl.includes(';base64,') ? img.dataUrl.split(';base64,')[1] : img.dataUrl);
          const buffer = Buffer.from(b64Data, 'base64');
          const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
          const fileName = `img_${hash}.${rawExt}`;
          const fileRelPath = `${targetFolderRel}/${fileName}`;
          const fileAbsPath = path.join(basePath, fileRelPath);

          if (!fs.existsSync(fileAbsPath)) {
            try {
              if (fs.promises && fs.promises.writeFile) {
                await fs.promises.writeFile(fileAbsPath, buffer);
              } else {
                fs.writeFileSync(fileAbsPath, buffer);
              }
            } catch (err) {
              console.warn('[PiDrawerView] Failed to write image to disk:', err);
            }
          }

          results.push({
            name: img.name || fileName,
            path: fileRelPath,
            hash: hash,
            size: buffer.length,
            width: img.width || null,
            height: img.height || null
          });
          continue;
        } catch (e) {
          console.warn('[PiDrawerView] Failed to process image attachment:', e);
        }
      }

      results.push({
        name: img.name || 'image.png',
        path: img.path || null,
        hash: img.hash || null,
        size: img.size || 0
      });
    }

    return results;
  }

  addUserMessageBubble(userText, contextBadgeText, images = []) {
    this.removeWelcomeScreen();
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap user';

    let badgeHtml = '';
    if (contextBadgeText) {
      badgeHtml = `<div class="tw-user-context-pill">${getIconPark('target', 12)} <span>${escapeHtml(contextBadgeText)}</span></div>`;
    }

    const now = Date.now();
    const timeStr = this.formatTime(now);

    bubbleWrap.innerHTML = `
      <div class="tw-user-bubble-box">
        ${badgeHtml}
        <div class="tw-msg-user-images"></div>
        ${userText ? `<div class="tw-msg-content" data-raw="${escapeAttr(userText || '')}">${escapeHtml(userText).replace(/\\n/g, '<br>')}</div>` : ''}
      </div>
      <div class="tw-user-meta-bar">
        <span class="tw-user-msg-time">${timeStr}</span>
        <button class="tw-user-copy-btn" title="复制提问内容">${DSH_ICONS.copy}</button>
        <button class="tw-user-edit-btn" title="回退到此条并重写（开新分支）">${DSH_ICONS.undo}</button>
        <button class="tw-user-del-btn" title="删除此条及之后内容（开新分支）">${DSH_ICONS.trash}</button>
      </div>
    `;

    const msgRecord = { role: 'user', text: userText, badge: contextBadgeText, images: null, timestamp: now };
    bubbleWrap._msgRef = msgRecord;

    const imagesContainer = bubbleWrap.querySelector('.tw-msg-user-images');
    if (images && images.length > 0 && imagesContainer) {
      for (const img of images) {
        const src = img.dataUrl || this.resolveImageSrc(img);
        if (src) {
          const imgEl = document.createElement('img');
          imgEl.className = 'tw-msg-user-img';
          imgEl.dataset.scale = '50%';
          imgEl.alt = img.name || 'image';
          imgEl.title = '左键预览大图 · 右键选择大小与复制';
          imgEl.src = src;
          imagesContainer.appendChild(imgEl);
        }
      }
    } else if (imagesContainer) {
      imagesContainer.remove();
    }

    const copyBtn = bubbleWrap.querySelector('.tw-user-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(userText || '');
          const prevHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = DSH_ICONS.check;
          setTimeout(() => { copyBtn.innerHTML = prevHtml; }, 1800);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (window.app?.Notice || class{});
          new NoticeCls('✓ 提问内容已复制到剪贴板', 1800);
        } catch (_) {}
      };
    }

    this._bindUserMsgActions(bubbleWrap, msgRecord);
    this.messagesEl.appendChild(bubbleWrap);

    // 异步提取图片写入附件目录，仅保存相对路径、哈希和尺寸，彻底杜绝历史文件膨胀
    // msgRecord._removed: 回退/删除发生在持久化落地前时，阻止补写僵尸记录
    this.persistAttachedImages(images).then(persistedImages => {
      if (msgRecord._removed) return;
      msgRecord.images = persistedImages;
      this.hub.sessionManager.addMessage(this.hub.activeAgentId, msgRecord);
    }).catch(err => {
      if (msgRecord._removed) return;
      console.warn('[PiDrawerView] Failed to persist attached images:', err);
      msgRecord.images = null;
      this.hub.sessionManager.addMessage(this.hub.activeAgentId, msgRecord);
    });

    // 用户刚发出消息：强制回到底部开始跟随本轮流式输出
    this.scrollToBottom(true);
  }

  // ===== 用户消息回退/删除（pi fork 会话分支）=====

  _bindUserMsgActions(bubbleWrap, msgRef) {
    const canFork = this.hub && typeof this.hub.supportsFork === 'function' && this.hub.supportsFork();
    const editBtn = bubbleWrap.querySelector('.tw-user-edit-btn');
    const delBtn = bubbleWrap.querySelector('.tw-user-del-btn');
    if (!canFork) {
      if (editBtn) editBtn.remove();
      if (delBtn) delBtn.remove();
      return;
    }
    if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); this._rollbackUserMessage(msgRef, bubbleWrap, true); };
    if (delBtn) delBtn.onclick = (e) => { e.stopPropagation(); this._rollbackUserMessage(msgRef, bubbleWrap, false); };
  }

  // 从 pi 存储的 fullPrompt 中提取用户原始输入：
  // 去掉 [TabonKB Context Meta]…[研发人员提问] 前置包裹与 [Target Codebase]/[OpenGrok Target Project] 尾部注入
  _extractUserTextFromWire(wire) {
    let core = String(wire || '').replace(/\r\n/g, '\n');
    const parts = core.split('[研发人员提问]');
    if (parts.length > 1) core = parts.slice(1).join('[研发人员提问]');
    core = core.replace(/^\n+/, '');
    const cut = core.search(/\n\n\[(Target Codebase|OpenGrok Target Project)/);
    if (cut >= 0) core = core.slice(0, cut);
    return core;
  }

  // 将工作台消息对象对齐到 pi 会话树的 forkable 入口（entryId）
  /**
   * invalid_encrypted_content 自愈：净化会话文件（剥离失效加密签名）后自动重发上一题。
   * 仅触发一次：若净化文件内已无签名可剥则返回 false，不再重发形成循环。
   */
  async _autoRepairEncryptedSession() {
    if (this._encRepairBusy) return;
    this._encRepairBusy = true;
    try {
      const ok = this.hub && typeof this.hub.repairEncryptedContentSession === 'function'
        ? await this.hub.repairEncryptedContentSession()
        : false;
      if (!ok) return;
      const msgs = (this.hub && this.hub.sessionManager)
        ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
      const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
      if (!lastUserMsg || !lastUserMsg.text) return;
      const app = this.app || (typeof window !== 'undefined' ? window.app : null);
      const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
      new NoticeCls('加密推理历史已失效，已净化会话并自动重试本题', 3500);
      this.inputEl.value = lastUserMsg.text;
      this.handleSend();
    } catch (e) {
      console.warn('[Workbench] encrypted-content auto repair failed:', e);
    } finally {
      this._encRepairBusy = false;
    }
  }

  _matchForkEntry(msgRef, forkMsgs) {
    const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();
    const target = norm(msgRef && msgRef.text);
    if (!target) return null;
    const candidates = forkMsgs.filter(f => {
      const core = norm(this._extractUserTextFromWire(f.text));
      // pi 侧存的是注入后的 fullPrompt：等值匹配，或 核心=wireText+未识别的 \n\n[ 注入后缀
      return core === target ||
        (core.startsWith(target) && /^\n\n\[/.test(core.slice(target.length)));
    });
    if (!candidates.length) return null;
    // 同文本重复发送时按序对齐：该消息是第 N 条同文本用户消息 → 取第 N 个候选
    let ordinal = 0;
    const stored = (this.hub && this.hub.sessionManager)
      ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
    const pos = stored.findIndex(m => m === msgRef);
    if (pos >= 0) {
      ordinal = stored.slice(0, pos + 1).filter(m => m.role === 'user' && norm(m.text) === target).length - 1;
    }
    const pick = candidates[Math.min(Math.max(ordinal, 0), candidates.length - 1)];
    return pick ? pick.entryId : null;
  }

  // 回退（fork）到该用户消息之前：pi 开新分支；工作台截断 UI 与存储
  // restoreText=true 时把原消息文本放回输入框供重写（回退重写）；false 时仅删除
  async _rollbackUserMessage(msgRef, bubbleWrap, restoreText) {
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (window.app && window.app.Notice) || null;
    const notice = (t) => { try { if (NoticeCls) new NoticeCls(t, 2800); } catch (_) {} };
    if (this.hub.isStreaming && this.hub.isStreaming()) { notice('⏳ 生成中，请先停止或等待完成'); return; }
    if (this._sendInFlight) { notice('⏳ 正在发送，请稍候'); return; }

    let forkMsgs = [];
    try { forkMsgs = await this.hub.getForkMessages(); } catch (_) {}
    if (!forkMsgs || forkMsgs.length === 0) { notice('当前会话没有可回退的提问'); return; }
    const entryId = this._matchForkEntry(msgRef, forkMsgs);
    if (!entryId) { notice('未找到该消息对应的会话节点'); return; }

    let res;
    try { res = await this.hub.forkMessage(entryId); }
    catch (e) { console.warn('[PiDrawerView] fork failed:', e); notice('回退失败: ' + (e && e.message ? e.message : e)); return; }
    if (!res || res.cancelled) return;

    this._truncateConversationFrom(msgRef, bubbleWrap);
    notice(restoreText ? '已回退，原文已放回输入框' : '已删除该条及之后内容');

    if (restoreText) {
      // 剥离注入的 Context Meta 包裹与尾部注入，只把用户原文放回输入框（重发时会重新注入）
      const wire = res.text || (msgRef && msgRef.text) || '';
      this.inputEl.value = this._extractUserTextFromWire(wire);
      if (typeof this.autoResizeInput === 'function') this.autoResizeInput();
      this.inputEl.focus();
      const len = this.inputEl.value.length;
      try { this.inputEl.setSelectionRange(len, len); } catch (_) {}
    }
    if (this.updateSendButtonState) this.updateSendButtonState();
  }

  _truncateConversationFrom(msgRef, bubbleWrap) {
    // 存储层：截断该消息及之后所有记录
    const sm = this.hub && this.hub.sessionManager;
    const stored = sm ? sm.getMessages(this.hub.activeAgentId) : [];
    const idx = stored.findIndex(m => m === msgRef);
    if (idx >= 0 && sm.truncateMessages) {
      sm.truncateMessages(this.hub.activeAgentId, idx);
    } else if (msgRef) {
      msgRef._removed = true; // 尚未落库（图片持久化中）：阻止回调补写
    }

    // DOM 层：该气泡及其后所有节点
    const target = (bubbleWrap && bubbleWrap.parentElement === this.messagesEl)
      ? bubbleWrap
      : Array.from(this.messagesEl.children).find(el => el._msgRef === msgRef);
    if (target) {
      let node = target;
      while (node) { const next = node.nextElementSibling; node.remove(); node = next; }
    }

    if (this.currentAssistantMessage) this.currentAssistantMessage = null;
    if (this.activeToolCards) this.activeToolCards.clear();
    if (this.buildChatMinimap) this.buildChatMinimap();
    if (this.updateStickyQuestion) this.updateStickyQuestion();
  }

  async handleSend() {
    const adapter = this.hub.getActiveAdapter();
    if (adapter.status === 'not_installed') {
      return;
    }
    // 防重入：上一次提交（含检索等待）未落地前，忽略 Enter/点击
    if (this._sendInFlight) return;

    const text = this.inputEl.value.trim();
    // 胶囊序列化为协议文本：命令 chip → 消息首部 '/name'，文件 chip → 尾部 '[[path]]'
    const wireText = this._serializeChips(text);
    const imagesToSend = [...(this.attachedImages || [])];
    if ((!wireText && imagesToSend.length === 0) || this.hub.isStreaming()) return;

    this._sendInFlight = true;
    this._abortRequested = false;
    this._hasAssistantMessageInTurn = false;
    try {

    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    this.inputEl.value = '';
    this.inputEl.style.height = `${this.inputHeight}px`;
    this.hub.sessionManager.setDraft(this.hub.activeAgentId, '');
    this.attachedImages = [];
    this.renderImageAttachments();
    this.inputChips = [];
    this._renderInputChips();
    this._persistChips();
    this.updateSendButtonState();
    this.closeTriggerPicker();

    const isNiceAigc = this.hub.activeAgentId === 'niceaigc';
    // 斜杠命令必须原样直通：Pi 的扩展命令/技能/模板分发均要求消息体 startsWith('/')，
    // 任何前置注入（Context Meta / 工程绑定）都会破坏命令解析；后置注入会污染命令参数
    const isSlashCommand = wireText.startsWith('/');
    const ctxInfo = (!isNiceAigc && this.contextProvider) ? this.contextProvider.getContextBadgeInfo() : null;
    const badgeLabel = (ctxInfo && ctxInfo.hasContext) ? `${ctxInfo.title} (${ctxInfo.module})` : null;

    this.addUserMessageBubble(wireText, badgeLabel, imagesToSend);

    // NiceAIGC does NOT bind to knowledge base; send clean user prompt without metadata
    let fullPrompt = (!isSlashCommand && !isNiceAigc && this.contextProvider)
      ? this.contextProvider.formatPromptWithContext(wireText)
      : wireText;

    // 本地工程第一优先级注入 (Requirement 1 & Requirement 2)
    const isCustomLocalProj = Boolean(this.selectedLocalProject && this.selectedLocalProject.id && this.selectedLocalProject.id !== 'none');
    if (!isSlashCommand && !isNiceAigc && isCustomLocalProj) {
      const lp = this.selectedLocalProject;
      fullPrompt += `\n\n[Target Codebase: HIGHEST PRIORITY - 本地工程第一真理源]
★ 用户在工作台指定本次问题绑定的本地真源码工程:
- 服务器: ${lp.serverIp} (${lp.serverName})
- Windows 挂载盘路径: ${lp.fullPathWin} (UNC: ${lp.uncPath})
- Linux 远程路径: ${lp.linuxPath}
- 平台架构: ${lp.platform}
- 目标机型项目: ${lp.project}
- 项目专属客制化目录 (Tier 2 最高覆盖权): ${lp.priDriverRel}
- 公司跨项目公共差分目录 (Tier 1 次高覆盖权): ${lp.publicDriverRel}
- 原厂官方基线 (Tier 0 兜底基准): alps / vendor_w / kernel
★ 核心执行准则:
1. 【最高优先级真理源】所有芯片驱动、DTS 设备树、寄存器配置与算法逻辑，必须以此工程的实际文件为第一准则！OpenGrok 与文档仅作辅助对比。
2. 【逆向穿透决议】查找文件或函数时，必须按顺序检查：① 优先查项目私有客制化 (${lp.priDriverRel})，若存在以此为准；② 次查公共差分 (${lp.publicDriverRel})；③ 最后查原厂基线。
3. 【代码修改红线】严禁直接修改原厂基线目录（编译时会被覆盖丢弃）！针对当前项目的修改必须写入项目私有客制化目录 (${lp.priDriverRel})；共性修改写入公共差分目录 (${lp.publicDriverRel})。
4. 【编译命令装配】若需验证或执行编译，该工程驱动模块单编命令为:
   cd ${lp.linuxPath} && ./pri_project/build/build.sh -p ${lp.platform} -m ${lp.project} -k driver`;
    } else if (!isSlashCommand && !isNiceAigc) {
      // OpenGrok 代码检索工程约束注入 (Pi / Hermes / Gemini 等 Agent)
      if (this.selectedProject && this.selectedProject !== 'auto') {
        fullPrompt += `\n\n[OpenGrok Target Project] 用户在工作台指定本次提问优先关联代码工程库为: \`${this.selectedProject}\`。若调用 opengrok_search_code 或 opengrok_read_file，请务必传入 project="${this.selectedProject}"。`;
        try { process.env.OPENGROK_DEFAULT_PROJECT = this.selectedProject; } catch (_) {}
      } else if (ctxInfo && ctxInfo.hasContext && ctxInfo.platform && ctxInfo.platform !== 'Common') {
        fullPrompt += `\n\n[OpenGrok Target Project] 当前笔记关联手机硬件平台为: ${ctxInfo.platform}。在调用 OpenGrok 工具检索时请优先匹配对应工程。`;
      }
    }

    // Jira 工单上下文绑定注入
    if (!isSlashCommand && !isNiceAigc && this.selectedJiraIssue && this.selectedJiraIssue.key) {
      const ji = this.selectedJiraIssue;
      fullPrompt += `\n\n[Jira Issue Context] 用户在工作台绑定本次提问关联的 Jira 缺陷工单:
- 工单号: ${ji.key}
- 标题: ${ji.summary || ''}
- 状态: ${ji.status || ''}
- 优先级: ${ji.priority || '无'}
- 经办人: ${ji.assignee || '未指派'}
- 链接: ${ji.url || ''}
请调用 jira_get_issue 获取完整详情、jira_list_attachments 查看附件；如需日志/抓包分析，用 jira_download_attachment 下载到 00-Inbox/03-Quick-Note/${ji.key}/attachments/ 后分析。分析结论与产物写入 00-Inbox/03-Quick-Note/${ji.key}/ 目录。`;
    }

    // 非 Pi / Hermes / Antigravity Agent（无内置或原生 MCP vendor 工具的 Agent）此处才做插件侧前置检索注入；
    // Pi、Hermes 与 Antigravity 已通过 Extension / MCP 接入完整工具链，支持自主按需调用与执行卡片渲染
    if (wireText && !isSlashCommand && !isNiceAigc && this.hub.activeAgentId !== 'pi' && this.hub.activeAgentId !== 'hermes' && this.hub.activeAgentId !== 'antigravity') {
      try {
        const retrieval = await this.gatherRetrievalContext(wireText);
        if (retrieval.block) fullPrompt += retrieval.block;
      } catch (e) {
        console.warn('[PiDrawerView] retrieval injection failed:', e);
      }
      // 检索期间用户点了中止：不再发送，收尾当前气泡
      if (this._abortRequested) {
        this.finishAssistantMessage(true);
        return;
      }
    }

    try {
      const res = await this.hub.send(fullPrompt, null, imagesToSend);
      // disposition='handled'：扩展命令/输入钩子已自行处理，不产生 agent run，跳过早回兜底
      const cmdHandled = res && res.data && res.data.disposition === 'handled';
      if (cmdHandled) {
        // no-op：命令输出经扩展自身通道呈现
      } else if (res && res.success === false) {
        if (!this._hasAssistantMessageInTurn) {
          this.createAssistantMessageBubble();
        }
        if (this.currentAssistantMessage) {
          this.appendAssistantDelta(`\n⚠️ 提示: ${res.error || '未收到模型回复'}`);
          if (!this.hub.isStreaming()) {
            this.finishAssistantMessage();
          }
        }
      } else if (!this.hub.isStreaming()) {
        if (!this._hasAssistantMessageInTurn) {
          this.createAssistantMessageBubble();
          this.appendAssistantDelta(`\n⚠️ 提示: 未收到来自 ${adapter.displayName} 的回复，请检查 Agent 服务与通道状态。`);
        }
        if (this.currentAssistantMessage) {
          this.finishAssistantMessage();
        }
      }
    } catch (err) {
      if (!this._hasAssistantMessageInTurn) {
        this.createAssistantMessageBubble();
        this.appendAssistantDelta(`❌ 发送失败: ${err.message}\n请检查 ${adapter.displayName} 运行状态。`);
        this.finishAssistantMessage();
      } else if (this.currentAssistantMessage) {
        this.appendAssistantDelta(`\n❌ 发送异常: ${err.message}`);
        this.finishAssistantMessage();
      }
    } finally {
      this.updateSendButtonState();
    }

    } finally {
      this._sendInFlight = false;
      this._abortRequested = false;
      this.updateSendButtonState();
    }
  }

  async handleAbort() {
    // 检索等待期间 hub 尚未 streaming，abort() 无效：置中止标记由 handleSend 收尾
    if (this._sendInFlight && !this.hub.isStreaming()) {
      this._abortRequested = true;
      if (this.btnAbort) {
        this.btnAbort.disabled = true;
        this.btnAbort.title = '正在中止，请稍候...';
      }
      return;
    }
    await this.hub.abort();
    this.updateSendButtonState();
  }

  async exportToQuickNote() {
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    const adapter = this.hub.getActiveAdapter();
    const agentId = this.hub.activeAgentId;
    const messages = this.hub.sessionManager.getMessages(agentId);

    const app = this.app || (this.contextProvider && this.contextProvider.app) || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class { constructor(m) { console.log(m); } });

    if (!messages || messages.length === 0) {
      new NoticeCls('当前会话暂无对话内容，无法导出');
      return;
    }

    if (!app || !app.vault) {
      new NoticeCls('无法访问 Obsidian Vault，无法执行导出');
      return;
    }

    // 1. Ensure target folders exist
    const targetFolder = '00-Inbox/03-Quick-Note';
    const attachmentsFolder = '00-Inbox/03-Quick-Note/attachments';

    try {
      if (!app.vault.getAbstractFileByPath(targetFolder)) {
        await app.vault.createFolder(targetFolder).catch(() => {});
      }
      if (!app.vault.getAbstractFileByPath(attachmentsFolder)) {
        await app.vault.createFolder(attachmentsFolder).catch(() => {});
      }
    } catch (e) {}

    // 2. Process & extract images
    let savedImagesCount = 0;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const exportMessages = JSON.parse(JSON.stringify(messages));

    for (let mIdx = 0; mIdx < exportMessages.length; mIdx++) {
      let text = cleanAssistantMarkdown(exportMessages[mIdx].text || '');

      // Pattern 0: User attached images: exportMessages[mIdx].images
      if (exportMessages[mIdx].images && exportMessages[mIdx].images.length > 0) {
        const attachedImgMds = [];
        for (const img of exportMessages[mIdx].images) {
          if (img && img.dataUrl && img.dataUrl.includes(';base64,')) {
            const rawExt = (img.dataUrl.split(';base64,')[0].split('/')[1] || 'png').replace('jpeg', 'jpg').split('+')[0];
            savedImagesCount++;
            const imgName = `img-${timestamp}-${savedImagesCount}.${rawExt}`;
            const imgPath = `${attachmentsFolder}/${imgName}`;
            try {
              const b64Data = img.dataUrl.split(';base64,')[1];
              const buffer = Buffer.from(b64Data, 'base64');
              if (typeof app.vault.createBinary === 'function') {
                await app.vault.createBinary(imgPath, buffer);
              } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
                await app.vault.adapter.writeBinary(imgPath, buffer);
              }
              attachedImgMds.push(`![[attachments/${imgName}]]`);
            } catch (err) {
              console.warn('[PiDrawerView] Failed to save attached image:', err);
            }
          }
        }
        if (attachedImgMds.length > 0) {
          text = (text ? text + '\n\n' : '') + attachedImgMds.join('\n');
        }
      }

      // Pattern 1: Base64 data URLs: data:image/xxx;base64,yyy
      const b64Regex = /data:image\/([a-zA-Z0-9+]+);base64,([A-Za-z0-9+/=]+)/g;
      let b64Match;
      while ((b64Match = b64Regex.exec(text)) !== null) {
        const rawExt = b64Match[1].replace('jpeg', 'jpg').split('+')[0];
        savedImagesCount++;
        const imgName = `img-${timestamp}-${savedImagesCount}.${rawExt}`;
        const imgPath = `${attachmentsFolder}/${imgName}`;
        try {
          const buffer = Buffer.from(b64Match[2], 'base64');
          if (typeof app.vault.createBinary === 'function') {
            await app.vault.createBinary(imgPath, buffer);
          } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
            await app.vault.adapter.writeBinary(imgPath, buffer);
          }
          text = text.replace(b64Match[0], `![[attachments/${imgName}]]`);
        } catch (err) {
          console.warn('[PiDrawerView] Failed to save base64 image:', err);
        }
      }

      // Pattern 2: Markdown remote images: ![alt](http...)
      const mdImgRegex = /!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g;
      const mdMatches = [...text.matchAll(mdImgRegex)];
      for (const match of mdMatches) {
        const url = match[2];
        savedImagesCount++;
        let ext = 'png';
        if (url.includes('.jpg') || url.includes('.jpeg')) ext = 'jpg';
        else if (url.includes('.webp')) ext = 'webp';
        else if (url.includes('.gif')) ext = 'gif';

        const imgName = `img-${timestamp}-${savedImagesCount}.${ext}`;
        const imgPath = `${attachmentsFolder}/${imgName}`;
        try {
          let binaryData = null;
          if (typeof requestUrl === 'function') {
            const res = await requestUrl({ url, responseType: 'arraybuffer' });
            binaryData = res.arrayBuffer;
          } else {
            const httpsMod = url.startsWith('https') ? require('https') : require('http');
            binaryData = await new Promise((res, rej) => {
              httpsMod.get(url, r => {
                const chunks = [];
                r.on('data', c => chunks.push(c));
                r.on('end', () => res(Buffer.concat(chunks)));
              }).on('error', rej);
            });
          }
          if (binaryData) {
            if (typeof app.vault.createBinary === 'function') {
              await app.vault.createBinary(imgPath, binaryData);
            } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
              await app.vault.adapter.writeBinary(imgPath, binaryData);
            }
            text = text.replace(match[0], `![[attachments/${imgName}]]`);
          }
        } catch (err) {
          console.warn('[PiDrawerView] Failed to download remote image:', err);
        }
      }

      // Pattern 3: HTML <img> tags
      const htmlImgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
      const htmlMatches = [...text.matchAll(htmlImgRegex)];
      for (const match of htmlMatches) {
        const url = match[1];
        savedImagesCount++;
        const ext = url.includes('.jpg') || url.includes('.jpeg') ? 'jpg' : 'png';
        const imgName = `img-${timestamp}-${savedImagesCount}.${ext}`;
        const imgPath = `${attachmentsFolder}/${imgName}`;
        try {
          let binaryData = null;
          if (typeof requestUrl === 'function') {
            const res = await requestUrl({ url, responseType: 'arraybuffer' });
            binaryData = res.arrayBuffer;
          }
          if (binaryData) {
            if (typeof app.vault.createBinary === 'function') {
              await app.vault.createBinary(imgPath, binaryData);
            } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
              await app.vault.adapter.writeBinary(imgPath, binaryData);
            }
            text = text.replace(match[0], `![[attachments/${imgName}]]`);
          }
        } catch (e) {}
      }

      exportMessages[mIdx].text = text;
    }

    // 3. Generate clean note title and filename
    const firstUser = exportMessages.find(m => m.role === 'user');
    const rawSnippet = firstUser ? (firstUser.text.replace(/!\[\[.*?\]\]/g, '').replace(/\[\[.*?\]\]/g, '').replace(/!\[.*?\]\([^\)]*\)/g, '').replace(/https?:\/\/\S+/g, '').replace(/data:image\/\S+/g, '').trim()) : '智能对话';
    const firstLine = (rawSnippet.split('\n')[0] || '智能对话').slice(0, 26).trim();
    const safeTitle = firstLine.replace(/[\\/:*?"<>|#^\[\]!]/g, '').replace(/\s+/g, ' ').trim() || '智能对话';

    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const agentName = adapter.displayName || adapter.name || 'AI';
    const fileBasename = `${dateStr} ${timeStr} [${agentName}] ${safeTitle}`;
    const notePath = `${targetFolder}/${fileBasename}.md`;

    // 4. Build Markdown Content
    const lines = [];
    lines.push('---');
    lines.push(`title: "${safeTitle}"`);
    lines.push(`date: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    lines.push(`agent: ${agentName}`);
    lines.push(`source: tabonkb-agent-hub`);
    lines.push('tags:');
    lines.push('  - ai-dialog');
    lines.push('  - quick-note');
    lines.push('---');
    lines.push('');
    lines.push(`# 💬 ${agentName} 对话记录 (${dateStr} ${timeStr})`);
    lines.push('');
    lines.push('> [!INFO] 对话元信息');
    lines.push(`> - **智能体**: ${agentName}`);
    lines.push(`> - **导出时间**: ${now.toLocaleString()}`);
    lines.push(`> - **对话轮次**: ${exportMessages.length} 条互动`);
    if (savedImagesCount > 0) {
      lines.push(`> - **转存图片**: ${savedImagesCount} 张本地离线图片`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Format dialogues
    for (const msg of exportMessages) {
      if (msg.role === 'user') {
        lines.push('### 👤 用户');
        if (msg.badge) {
          lines.push(`> 🎯 上下文聚焦: \`${msg.badge}\`\n`);
        }
        lines.push(msg.text);
        lines.push('');
      } else {
        lines.push(`### 🤖 ${agentName}`);
        lines.push(msg.text);
        lines.push('');
      }
    }

    const noteContent = lines.join('\n');

    // 5. Write Note to Vault
    try {
      const existing = app.vault.getAbstractFileByPath(notePath);
      if (existing) {
        await app.vault.modify(existing, noteContent);
      } else {
        await app.vault.create(notePath, noteContent);
      }

      new NoticeCls(`✓ 对话已成功存入 00-Inbox/03-Quick-Note/${fileBasename}.md${savedImagesCount > 0 ? ` (已转存 ${savedImagesCount} 张本地图片)` : ''}`, 6000);

      // Open note in workspace
      if (app.workspace && typeof app.workspace.openLinkText === 'function') {
        app.workspace.openLinkText(notePath, '', false);
      }
    } catch (err) {
      console.error('[PiDrawerView] Failed to write note to vault:', err);
      new NoticeCls(`❌ 导出笔记失败: ${err.message}`, 8000);
    }
  }

  toggleHistoryPanel() {
    if (!this.historyPanelEl) return;
    const isHidden = this.historyPanelEl.style.display === 'none' || !this.historyPanelEl.style.display;
    if (isHidden) {
      this.renderHistoryPanel();
      this.historyPanelEl.style.display = 'flex';
      this.historyPanelEl.classList.add('open');
      if (this.btnHistory) this.btnHistory.classList.add('active');
      setTimeout(() => {
        if (this._historyOutsideClickBound) {
          window.removeEventListener('click', this._historyOutsideClickBound);
        }
        this._historyOutsideClickBound = (e) => {
          if (!this.historyPanelEl || this.historyPanelEl.style.display === 'none') return;
          if (!this.historyPanelEl.contains(e.target) && !this.btnHistory?.contains(e.target)) {
            this.closeHistoryPanel();
          }
        };
        window.addEventListener('click', this._historyOutsideClickBound);

        if (this._historyKeydownBound) {
          window.removeEventListener('keydown', this._historyKeydownBound);
        }
        this._historyKeydownBound = (e) => {
          if (e.key === 'Escape') {
            this.closeHistoryPanel();
          }
        };
        window.addEventListener('keydown', this._historyKeydownBound);
      }, 20);
    } else {
      this.closeHistoryPanel();
    }
  }

  closeHistoryPanel() {
    if (!this.historyPanelEl) return;
    this.historyPanelEl.style.display = 'none';
    this.historyPanelEl.classList.remove('open');
    if (this.btnHistory) this.btnHistory.classList.remove('active');
    if (this._historyOutsideClickBound) {
      window.removeEventListener('click', this._historyOutsideClickBound);
      this._historyOutsideClickBound = null;
    }
    if (this._historyKeydownBound) {
      window.removeEventListener('keydown', this._historyKeydownBound);
      this._historyKeydownBound = null;
    }
  }

  renderHistoryPanel() {
    if (!this.historyPanelEl) return;
    const listEl = this.historyPanelEl.querySelector('#twHistoryList');
    if (!listEl) return;

    const agentId = this.hub.activeAgentId;
    const sessions = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getSessions(agentId) : [];
    const activeSessionId = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getActiveSessionId(agentId) : null;

    const countBadge = this.historyPanelEl.querySelector('#twHistoryCountBadge');
    if (countBadge) {
      countBadge.textContent = sessions ? `${sessions.length}` : '0';
    }

    if (!sessions || sessions.length === 0) {
      listEl.innerHTML = `
        <div class="tw-history-empty-tip">
          <div class="tw-history-empty-icon">${getIconPark('topic', 24)}</div>
          <span>暂无历史会话记录</span>
        </div>
      `;
      return;
    }

    let html = '';
    for (const s of sessions) {
      const isActive = s.id === activeSessionId;
      const msgCount = (s.messages || []).length;
      const timeStr = this.formatRelativeTime(s.updatedAt || s.createdAt);

      html += `
        <div class="tw-history-item ${isActive ? 'active' : ''}" data-session-id="${escapeAttr(s.id)}">
          <div class="tw-history-item-left">
            <span class="tw-history-item-icon">${getIconPark('topic', 13)}</span>
            <div class="tw-history-item-info">
              <div class="tw-history-item-title" title="${escapeAttr(s.title || '对话')}">${escapeHtml(s.title || '对话')}</div>
              <div class="tw-history-item-meta">
                <span>${escapeHtml(timeStr)}</span>
                <span>·</span>
                <span class="tw-history-msg-tag">${msgCount} 条对话</span>
              </div>
            </div>
          </div>
          <span class="tw-history-delete-btn" data-delete-id="${escapeAttr(s.id)}" title="删除此记录" role="button" tabindex="0" aria-label="删除会话记录">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7h16"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
              <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/>
              <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
            </svg>
          </span>
        </div>
      `;
    }
    listEl.innerHTML = html;

    // Bind item clicks (switch session)
    listEl.querySelectorAll('.tw-history-item').forEach(itemEl => {
      itemEl.onclick = (e) => {
        if (e.target.closest('.tw-history-delete-btn')) return;
        const sid = itemEl.getAttribute('data-session-id');
        this.loadHistorySession(sid);
      };
    });

    // Bind delete clicks
    listEl.querySelectorAll('.tw-history-delete-btn').forEach(btn => {
      const handleDelete = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const sid = btn.getAttribute('data-delete-id');
        this.deleteHistorySession(sid);
      };
      btn.onclick = handleDelete;
      btn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleDelete(e);
        }
      };
    });
  }

  loadHistorySession(sessionId) {
    const agentId = this.hub.activeAgentId;
    if (this.hub && this.hub.sessionManager) {
      this.hub.sessionManager.switchSession(agentId, sessionId);
    }
    const adapter = this.hub.getActiveAdapter();
    if (adapter && typeof adapter._syncSessionConversation === 'function') {
      adapter._syncSessionConversation();
    }
    this.restoreSessionMessages(agentId);
    this.closeHistoryPanel();
  }

  deleteHistorySession(sessionId) {
    const agentId = this.hub.activeAgentId;
    if (this.hub && this.hub.sessionManager) {
      const wasActive = (this.hub.sessionManager.getActiveSessionId(agentId) === sessionId);
      this.hub.sessionManager.deleteSession(agentId, sessionId);
      if (wasActive) {
        const adapter = this.hub.getActiveAdapter();
        if (adapter && typeof adapter._syncSessionConversation === 'function') {
          adapter._syncSessionConversation();
        }
        this.restoreSessionMessages(agentId);
      }
      const app = this.app || (typeof window !== 'undefined' ? window.app : null);
      const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
      new NoticeCls('✓ 会话记录已删除', 1600);
    }
    this.renderHistoryPanel();
  }

  formatRelativeTime(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${hh}:${mm}`;
  }

  formatDuration(ms) {
    if (!ms || ms <= 0) return '1秒';
    const totalSec = Math.max(1, Math.floor(ms / 1000));
    if (totalSec < 60) return `${totalSec}秒`;
    const mins = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${mins}分${sec}秒` : `${mins}分钟`;
  }

  formatTokensPill(tokens) {
    if (!tokens || tokens <= 0) return '2.8K tok';
    if (tokens >= 1000) {
      return Math.round(tokens / 1000) + 'K tok';
    }
    return `${tokens} tok`;
  }

  formatTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  generateBatchToolSummary(toolCalls) {
    if (!toolCalls || toolCalls.length === 0) {
      return '已调用工具';
    }
    const toolNames = new Set(toolCalls.map(t => (t.toolName || t.name || '').toLowerCase()));
    const parts = [];
    if (toolNames.has('read') || toolNames.has('read_file') || toolNames.has('opengrok_read_file') || toolNames.has('view_file')) {
      parts.push('已读取文件');
    }
    if (toolNames.has('bash') || toolNames.has('exec') || toolNames.has('terminal') || toolNames.has('command') || toolNames.has('run_command')) {
      parts.push('执行了命令');
    }
    if (toolNames.has('write_to_file') || toolNames.has('replace_file_content') || toolNames.has('edit') || toolNames.has('update_plan')) {
      parts.push('更新了计划等');
    }
    if (toolNames.has('grep') || toolNames.has('find') || toolNames.has('opengrok_search_code') || toolNames.has('search')) {
      parts.push('已检索代码');
    }
    if (toolNames.has('codegraph_explore')) {
      parts.push('已探索调用关系');
    }
    if (toolNames.has('weknora_search') || toolNames.has('weknora_ask')) {
      parts.push('已检索知识库');
    }
    if (toolNames.has('vendor_portal_search') || toolNames.has('vendor_portal_get_detail')) {
      parts.push('已查询芯片资料');
    }
    if (toolNames.has('gerrit_search_changes') || toolNames.has('gerrit_get_diff')) {
      parts.push('已查阅代码评审');
    }
    if (toolNames.has('drawio_create') || toolNames.has('drawio_edit')) {
      parts.push('已绘制架构图');
    }
    if (parts.length === 0) {
      parts.push('已调用工具');
    }
    let res = parts.slice(0, 3).join('，');
    if (!res.endsWith('等') && (parts.length > 1 || toolCalls.length > 2)) {
      res += '等';
    }
    return res;
  }

  generateToolSummary(toolCalls, thinkingText) {
    if (!toolCalls || toolCalls.length === 0) {
      if (thinkingText && thinkingText.length > 0) {
        return '思考过程';
      }
      return '已完成分析与回复生成';
    }
    return this.generateBatchToolSummary(toolCalls);
  }

  showTokenUsagePopover(targetEl, data) {
    if (!targetEl || !data) return;
    const existing = document.querySelector('.tw-token-popover');
    if (existing) {
      const isSame = existing._target === targetEl;
      existing.remove();
      if (isSame) return;
    }

    const popover = document.createElement('div');
    popover.className = 'tw-token-popover';
    popover._target = targetEl;

    const totalStr = (data.totalTokens || 0).toLocaleString() + ' tok';
    const inputStr = (data.inputTokens || 0).toLocaleString() + ' tok';
    const outputStr = (data.outputTokens || 0).toLocaleString() + ' tok';
    const cacheReadStr = data.cacheReadTokens ? (data.cacheReadTokens.toLocaleString() + ' tok') : null;

    let rowsHtml = `
      <div class="tw-token-row">
        <span class="tw-token-label">提供方 / 模型</span>
        <span class="tw-token-val">${escapeHtml(data.providerAndModel || '未知')}</span>
      </div>
      <div class="tw-token-row">
        <span class="tw-token-label">未缓存输入</span>
        <span class="tw-token-val">${inputStr}</span>
      </div>
    `;

    if (cacheReadStr) {
      rowsHtml += `
      <div class="tw-token-row">
        <span class="tw-token-label">缓存读取</span>
        <span class="tw-token-val">${cacheReadStr}</span>
      </div>`;
    }

    rowsHtml += `
      <div class="tw-token-row">
        <span class="tw-token-label">输出</span>
        <span class="tw-token-val">${outputStr}</span>
      </div>
    `;

    if (data.durationText) {
      rowsHtml += `
      <div class="tw-token-row">
        <span class="tw-token-label">总耗时</span>
        <span class="tw-token-val">${data.durationText}</span>
      </div>`;
    }

    popover.innerHTML = `
      <div class="tw-token-popover-header">
        <div class="tw-token-popover-title">
          <span class="tw-token-popover-icon">${DSH_ICONS.database}</span>
          <span>本轮用量</span>
        </div>
        <span class="tw-token-popover-total">${totalStr}</span>
      </div>
      <div class="tw-token-popover-divider"></div>
      <div class="tw-token-popover-list">
        ${rowsHtml}
      </div>
    `;

    targetEl.parentElement.appendChild(popover);

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && e.target !== targetEl && !targetEl.contains(e.target)) {
        popover.remove();
        targetEl.classList.remove('active');
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 10);
    targetEl.classList.add('active');
  }

  insertAnswerToActiveNote(text) {
    if (!text) return;
    try {
      const app = this.app || (typeof window !== 'undefined' ? window.app : null);
      const activeLeaf = app?.workspace?.activeLeaf;
      const view = activeLeaf?.view;
      if (view && view.editor && typeof view.editor.replaceSelection === 'function') {
        view.editor.replaceSelection(`\n\n${text}\n\n`);
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
        new NoticeCls('✓ 已将回答插入到当前笔记光标处', 2000);
        return;
      }
    } catch (_) {}
    navigator.clipboard.writeText(text);
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
    new NoticeCls('✓ 已复制到剪贴板，可直接粘贴到笔记中', 2000);
  }

  async handleNewSession() {
    const agentId = this.hub.activeAgentId;
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }
    if (this.hub.sessionManager) {
      this.hub.sessionManager.newSession(agentId);
    }
    this.currentAssistantMessage = null;
    if (this.messagesEl) {
      this.messagesEl.innerHTML = '';
    }
    if (this.stickyHeaderEl) {
      this.stickyHeaderEl.classList.remove('visible');
      const qText = this.stickyHeaderEl.querySelector('.tw-sticky-q-text');
      if (qText) qText.textContent = '';
    }
    this._minimapBubbles = [];
    if (typeof this.buildChatMinimap === 'function') this.buildChatMinimap();
    if (typeof this.updateStickyQuestion === 'function') this.updateStickyQuestion();
    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.style.height = `${this.inputHeight}px`;
      this.inputEl.focus();
    }
    if (this.historyPanelEl) {
      this.closeHistoryPanel();
    }
    this.updateSendButtonState();
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
    new NoticeCls('✓ 已开启新会话 (历史记录已安全归档)', 2000);

    try {
      await this.hub.newSession();
    } catch (err) {
      console.warn('[Workbench] Error during hub newSession:', err);
    }
  }

  scrollToBottom(force = false) {
    if (!this.messagesEl) return;
    // 用户上滑阅读中（_stickToBottom=false）：非强制滚动一律跳过，回底按钮标记有新内容
    if (!force && this._stickToBottom === false) {
      this._contentBelowPending = true;
      if (this.scrollBottomBtn) this.scrollBottomBtn.classList.add('visible', 'has-new');
      return;
    }
    if (force) {
      this._stickToBottom = true;
      this._userScrolledUpUntil = 0;
      this._minimapTargetIdx = null;
      this._minimapScrollingUntil = 0;
      this._contentBelowPending = false;
      if (this.scrollBottomBtn) this.scrollBottomBtn.classList.remove('has-new');
      if (this._scrollRafId) {
        cancelAnimationFrame(this._scrollRafId);
        this._scrollRafId = null;
      }
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      this._lastScrollTop = this.messagesEl.scrollTop;
      return;
    }
    if (this._scrollRafId) return;
    this._scrollRafId = requestAnimationFrame(() => {
      this._scrollRafId = null;
      if (!this.messagesEl) return;
      // RAF 触发瞬间用户可能已上滑，重判一次
      if (this._stickToBottom === false) {
        this._contentBelowPending = true;
        if (this.scrollBottomBtn) this.scrollBottomBtn.classList.add('visible', 'has-new');
        return;
      }
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }

  // 滚动时找出当前已被滚出顶部的最新用户提问，钉到吸顶条上 (基于相对 offsetTop 与 scrollTop，0 次 getBoundingClientRect，杜绝重排卡顿)
  updateStickyQuestion() {
    if (!this.messagesEl || !this.stickyHeaderEl) return;
    const scrollTop = this.messagesEl.scrollTop;
    if (scrollTop <= 15) {
      if (this.stickyHeaderEl.classList.contains('visible')) {
        this.stickyHeaderEl.classList.remove('visible');
      }
      return;
    }

    const bubbles = this._minimapBubbles || Array.from(this.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.user'));
    if (!bubbles.length) {
      if (this.stickyHeaderEl.classList.contains('visible')) {
        this.stickyHeaderEl.classList.remove('visible');
      }
      return;
    }

    // 找出所有已完全滚出可视区顶部的用户提问中最新的那一条
    let active = null;
    let activeIdx = -1;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      // 当气泡底部完全滚出可视区顶部时才触发吸顶显示
      if (b.offsetTop + b.offsetHeight <= scrollTop) {
        active = b;
        activeIdx = i;
      } else {
        break;
      }
    }

    // 若下一条用户提问已经进入顶部吸顶条区域 (<= 38px)，隐藏上一轮旧吸顶条，避免遮挡当前跳转或刚滚到的新提问
    const nextBubble = activeIdx >= 0 ? bubbles[activeIdx + 1] : null;
    if (!active || (nextBubble && nextBubble.offsetTop <= scrollTop + 38)) {
      if (this.stickyHeaderEl.classList.contains('visible')) {
        this.stickyHeaderEl.classList.remove('visible');
      }
      return;
    }

    if (!active._cachedLine) {
      const textEl = active.querySelector('.tw-msg-content') || active;
      active._cachedLine = (textEl.textContent || '').trim().replace(/\s+/g, ' ');
    }
    const line = active._cachedLine;
    if (!line) {
      if (this.stickyHeaderEl.classList.contains('visible')) {
        this.stickyHeaderEl.classList.remove('visible');
      }
      return;
    }

    const qTextEl = this.stickyHeaderEl.querySelector('.tw-sticky-q-text');
    if (qTextEl && qTextEl.textContent !== line) {
      qTextEl.textContent = line;
    }
    if (!this.stickyHeaderEl.classList.contains('visible')) {
      this.stickyHeaderEl.classList.add('visible');
    }
  }

  // ===== 对话段导航 (minimap): 每条用户提问一段, 右侧刻度条可点击跳转 =====
  buildChatMinimap() {
    if (!this.messagesEl || !this.minimapEl) return;
    const bubbles = Array.from(this.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.user'));
    this._minimapBubbles = bubbles;
    if (bubbles.length < 2) {
      this.minimapEl.innerHTML = '';
      this.minimapEl.style.display = 'none';
      return;
    }
    this.minimapEl.innerHTML = '';
    bubbles.forEach((b, i) => {
      const textEl = b.querySelector('.tw-msg-content');
      const line = (textEl ? textEl.textContent : (b.textContent || '')).trim().replace(/\s+/g, ' ').slice(0, 60);
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'tw-minimap-tick';
      tick.title = line || `对话段 ${i + 1}`;
      tick.onclick = () => {
        const target = (this._minimapBubbles || [])[i];
        if (!target || !this.messagesEl) return;
        // 段跳转属于非贴底滚动：解除流式跟随并取消挂起回底 RAF，防止滚动途中被新内容拽回底部
        this._stickToBottom = false;
        this._userScrolledUpUntil = Date.now() + 600;
        if (this._scrollRafId) {
          cancelAnimationFrame(this._scrollRafId);
          this._scrollRafId = null;
        }
        // 点击即锁定并高亮目标刻度，避免平滑滚动途经中间段落时刻度高亮来回闪烁，以及末尾短段落触底无法达到 offsetTop 时丢失高亮
        this._minimapTargetIdx = i;
        this._minimapScrollingUntil = Date.now() + 550;
        this._lastMinimapActiveIdx = i;
        const ticks = this.minimapEl.children;
        for (let k = 0; k < ticks.length; k++) {
          ticks[k].classList.toggle('active', k === i);
        }
        this.messagesEl.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: 'smooth' });
      };
      this.minimapEl.appendChild(tick);
    });
    this.minimapEl.style.display = 'flex';
    this.layoutMinimap();
    this.updateMinimapActive();
  }

  layoutMinimap() {
    if (!this.minimapEl || !this.messagesEl || this.minimapEl.style.display === 'none') return;
    // 对齐消息区顶部与可视高度 (与吸顶条同理, 避开 header/历史面板/警告横幅)
    this.minimapEl.style.top = this.messagesEl.offsetTop + 'px';
    this.minimapEl.style.height = this.messagesEl.clientHeight + 'px';
  }

  updateMinimapActive() {
    if (!this.minimapEl || this.minimapEl.style.display === 'none') return;
    const bubbles = this._minimapBubbles || [];
    const ticks = this.minimapEl.children;
    if (!bubbles.length || ticks.length !== bubbles.length) return;

    // 平滑跳转动画期间保持用户点击的目标刻度高亮，不随中间过渡帧闪烁
    if (typeof this._minimapTargetIdx === 'number' && Date.now() < (this._minimapScrollingUntil || 0)) {
      return;
    }

    const scrollTop = this.messagesEl.scrollTop;
    let activeIdx = 0;
    for (let i = 0; i < bubbles.length; i++) {
      if (bubbles[i].offsetTop <= scrollTop + 30) {
        activeIdx = i;
      } else {
        break;
      }
    }

    // 若用户点击的是底部段落但因总高度限制滚到底部仍未越过 target.offsetTop，保留所选刻度高亮
    const atBottom = this.messagesEl.scrollHeight - scrollTop - this.messagesEl.clientHeight <= 6;
    if (atBottom && typeof this._minimapTargetIdx === 'number' && this._minimapTargetIdx > activeIdx) {
      activeIdx = Math.min(this._minimapTargetIdx, bubbles.length - 1);
    } else {
      this._minimapTargetIdx = null;
    }

    if (this._lastMinimapActiveIdx === activeIdx) return;
    this._lastMinimapActiveIdx = activeIdx;

    for (let i = 0; i < ticks.length; i++) {
      ticks[i].classList.toggle('active', i === activeIdx);
    }
  }

  open() {
    if (this.isOpenState) return;
    this.isOpenState = true;
    this.drawerEl.style.display = 'flex';
    this.notifyToggle(true);

    this.syncActiveAgentUI();

    if (this.messagesEl && this.messagesEl.children.length === 0) {
      this.restoreSessionMessages(this.hub.activeAgentId);
    }

    // Ensure active agent is detected and connected on open
    this.ensureAgentConnected();

    setTimeout(() => {
      if (this.inputEl && typeof this.inputEl.focus === 'function') {
        this.inputEl.focus();
      }
      // 抽屉从 display:none 打开后高度才确定, 重新对齐导航条与吸顶提问条
      this.buildChatMinimap();
      this.updateStickyQuestion();
    }, 100);
  }

  close() {
    this.closeHistoryPanel();
    if (this.drawerEl && this.drawerEl.classList.contains('tw-studio-mode')) return;
    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.drawerEl.style.display = 'none';
    this.notifyToggle(false);
  }

  toggle() {
    if (this.isOpenState) this.close();
    else this.open();
  }

  isOpen() {
    return this.isOpenState;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;');
}

/**
 * Clean raw Delimiters, Cites, and Search/URL markers from ChatGPT Web SSE responses
 * @param {string} text
 * @returns {string}
 */
function cleanAssistantMarkdown(text) {
  if (!text) return '';
  let cleaned = text;

  // 1. Process PUA URL blocks: \uE200url\uE202title\uE202url\uE201 or \uE000url\uE002title\uE002url\uE001 -> [title](url)
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202]([^\uE000-\uF8FF\r\n]+?)[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 2. Process literal box URL blocks: □url□title□url□
  cleaned = cleaned.replace(/□url□([^□\r\n]+?)□(https?:\/\/[^□\s\)]+?)□/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/□url□(https?:\/\/[^□\s\)]+?)□/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 3. Strip PUA citation blocks: \uE200cite...\uE201
  cleaned = cleaned.replace(/[\uE000\uE200]cite[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 4. Strip PUA search/browse/call/nav/tool/python blocks
  cleaned = cleaned.replace(/[\uE000\uE200](?:search|browse|nav|call|tool|python)[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 5. Strip literal box citations & tools: □cite□...□
  cleaned = cleaned.replace(/□(?:cite|search|browse|nav|call|tool|python)□[^□\r\n]*?□/g, '');

  // 6. Strip standard web citations like 【4:0†source】
  cleaned = cleaned.replace(/【\d*(?::\d+)?†[a-zA-Z0-9_\-\s]*】/g, '');

  // 7. Process/Format ChatGPT internal entity reference tags:
  // e.g. entity["company", "tldraw", "AI canvas SDK"] -> **tldraw**
  // e.g. entity["company", "Miro", "online collaborative whiteboard"] -> **Miro**
  // e.g. 【entity|["company", "OpenAI"]】 -> **OpenAI**
  cleaned = cleaned.replace(/【?entity(?:\|\[|\[)([\s\S]*?)\]】?/gi, (match, inner) => {
    try {
      const cleanInner = inner.replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();
      const parsed = JSON.parse('[' + cleanInner + ']');
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (parsed.length >= 2 && typeof parsed[1] === 'string' && parsed[1].trim()) {
          return '**' + parsed[1].trim() + '**';
        }
        if (typeof parsed[0] === 'string' && parsed[0].trim()) {
          return '**' + parsed[0].trim() + '**';
        }
      }
    } catch (_) {
      const parts = [];
      const partRegex = /["']([^"']+)["']/g;
      let pm;
      while ((pm = partRegex.exec(inner)) !== null) {
        parts.push(pm[1]);
      }
      if (parts.length >= 2 && parts[1].trim()) {
        return '**' + parts[1].trim() + '**';
      }
      if (parts.length === 1 && parts[0].trim()) {
        return '**' + parts[0].trim() + '**';
      }
    }
    return match;
  });

  // 8. Strip ChatGPT internal directives & GenUI citation metadata tags (image_group, genui, citation, widget, etc.) with balanced delimiters
  const directiveRegex = /(?:[ \t]+)?【?(?:\b(?:image_group|image_query|image|carousel|widget|genui|citation))\s*(?:\|?\s*([\[\{]))/gi;
  let dirResult = '';
  let dirLastIndex = 0;
  let dirMatch;

  while ((dirMatch = directiveRegex.exec(cleaned)) !== null) {
    const matchStart = dirMatch.index;
    const isSpecialWrap = dirMatch[0].includes('【');
    const openChar = dirMatch[1];
    const closeChar = openChar === '[' ? ']' : '}';
    const contentStart = matchStart + dirMatch[0].length;

    let depth = 1;
    let inQuotes = false;
    let quoteChar = '';
    let contentEnd = -1;

    for (let i = contentStart; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inQuotes) {
        if (ch === quoteChar && cleaned[i - 1] !== '\\') {
          inQuotes = false;
        }
      } else {
        if (ch === '"' || ch === "'") {
          inQuotes = true;
          quoteChar = ch;
        } else if (ch === openChar) {
          depth++;
        } else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            contentEnd = i + 1;
            if (isSpecialWrap && cleaned[contentEnd] === '】') {
              contentEnd++;
            }
            break;
          }
        }
      }
    }

    if (contentEnd !== -1) {
      dirResult += cleaned.substring(dirLastIndex, matchStart);
      dirLastIndex = contentEnd;
      directiveRegex.lastIndex = contentEnd;
    } else {
      // Incomplete trailing directive during streaming: hide it from display
      dirResult += cleaned.substring(dirLastIndex, matchStart);
      dirLastIndex = cleaned.length;
      break;
    }
  }
  dirResult += cleaned.substring(dirLastIndex);
  cleaned = dirResult;

  // 9. Strip leftover private-use characters & non-printable ASCII control chars
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '');
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // 10. Clean isolated stray box characters
  cleaned = cleaned.replace(/(?:^|\s)□+(?:\s|$)/g, ' ');

  // 11. Clean excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Normalizes markdown text to ensure compatibility with CommonMark parser.
 * Specifically ensures an empty line exists before table header rows if preceded
 * by a paragraph line without an empty line, and normalizes Gerrit change links.
 */
function prepareMarkdownForRender(text, vaultBasePath) {
  if (!text) return '';
  let out = cleanAssistantMarkdown(text);
  out = out.replace(/([^\n\r])\r?\n\s*(\|[^\n\r]+\|\r?\n\s*\|[\s\-:|]+\|)/g, '$1\n\n$2');
  const gerritBase = getGerritBaseUrl(vaultBasePath);
  out = out.replace(/\[#?(\d{4,8})\]\((?!(?:https?:\/\/))([^\)]+)\)/gi, (match, num) => {
    return `[#${num}](${gerritBase}/#/c/${num}/)`;
  });
  return out;
}

/**
 * Fallback markdown renderer in case native Obsidian MarkdownRenderer is unavailable
 * @param {string} text
 * @returns {string} HTML
 */
function formatMarkdownFallback(text) {
  if (!text) return '';
  const codeBlocks = [];
  let temp = text.replace(/```([a-zA-Z0-9_\-+#]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    const placeholder = `%%%CB${codeBlocks.length}%%%`;
    codeBlocks.push(`<pre class="tw-code-block"><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`);
    return placeholder;
  });

  const inlineCodes = [];
  temp = temp.replace(/`([^`\n]+)`/g, (m, code) => {
    const placeholder = `%%%IC${inlineCodes.length}%%%`;
    inlineCodes.push(`<code class="tw-inline-code">${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Table parser: detect markdown table blocks (headers + delimiter row + rows)
  const tables = [];
  temp = temp.replace(/(?:^|\n)((?:[ \t]*\|[^\n]+\|[ \t]*\r?\n)+[ \t]*\|[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|[ \t]*(?:\r?\n[ \t]*\|[^\n]+\|[ \t]*)*)/g, (match, tableBlock) => {
    const lines = tableBlock.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;
    const headerLine = lines[0];
    const sepLine = lines[1];
    if (!sepLine.includes('-') || !sepLine.includes('|')) return match;

    const parseRow = (line) => {
      let cells = line.split('|');
      if (cells.length > 0 && cells[0].trim() === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(c => c.trim());
    };

    const headers = parseRow(headerLine);
    const rows = lines.slice(2).map(parseRow);

    let html = '<div class="tw-chat-table-wrap"><table class="tw-table"><thead><tr>';
    for (const h of headers) {
      html += `<th>${escapeHtml(h)}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      html += '<tr>';
      for (let i = 0; i < headers.length; i++) {
        let cell = escapeHtml(row[i] || '');
        cell = cell.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" class="external-link" target="_blank" rel="noopener noreferrer">$1</a>');
        cell = cell.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        cell = cell.replace(/`([^`]+)`/g, '<code class="tw-inline-code">$1</code>');
        html += `<td>${cell}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    const placeholder = `%%%TB${tables.length}%%%`;
    tables.push(html);
    return '\n' + placeholder + '\n';
  });

  temp = escapeHtml(temp);

  // Links: [text](url)
  temp = temp.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" class="external-link" target="_blank" rel="noopener noreferrer">$1</a>');

  // Bold & Italic
  temp = temp.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  temp = temp.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  temp = temp.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  temp = temp.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Headings
  temp = temp.replace(/^### (.*$)/gim, '<h3 class="tw-md-h3">$1</h3>');
  temp = temp.replace(/^## (.*$)/gim, '<h2 class="tw-md-h2">$1</h2>');
  temp = temp.replace(/^# (.*$)/gim, '<h1 class="tw-md-h1">$1</h1>');

  // Lists
  temp = temp.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="tw-md-li">$1</li>');
  temp = temp.replace(/(<li class="tw-md-li">[\s\S]*?<\/li>)+/g, '<ul class="tw-md-ul">$&</ul>');

  temp = temp.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

  for (let i = 0; i < inlineCodes.length; i++) {
    temp = temp.replace(`%%%IC${i}%%%`, inlineCodes[i]);
  }
  for (let i = 0; i < codeBlocks.length; i++) {
    const cbRegex = new RegExp(`(?:<br>\\s*)*%%%CB${i}%%%(?:\\s*<br>)*`, 'g');
    temp = temp.replace(cbRegex, codeBlocks[i]);
  }
  for (let i = 0; i < tables.length; i++) {
    const tbRegex = new RegExp(`(?:<br>\\s*)*%%%TB${i}%%%(?:\\s*<br>)*`, 'g');
    temp = temp.replace(tbRegex, tables[i]);
  }

  return temp;
}

/**
 * Returns configured Gerrit base URL from data.json or fallback default
 */
function getGerritBaseUrl(vaultBasePath) {
  try {
    const fs = require('fs');
    const path = require('path');
    const basePath = vaultBasePath || (typeof window !== 'undefined' && window.app?.vault?.adapter?.basePath) || (process.cwd ? process.cwd() : '');
    if (basePath) {
      const dataFile = path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'data.json');
      if (fs.existsSync(dataFile)) {
        const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        if (d && d.gerrit && d.gerrit.baseUrl) {
          return d.gerrit.baseUrl.replace(/\/+$/, '');
        }
      }
    }
  } catch (e) {}
  return 'http://192.168.1.17:8090';
}

/**
 * Resolves any link (URL, Gerrit change triplet, commit ID, or relative path)
 * to an absolute browser-navigable URL if it represents an external resource.
 * Returns null if it should remain an internal Obsidian vault link.
 */
function resolveLinkToUrl(href, text, linkEl, vaultBasePath) {
  const rawHref = (href || '').trim();
  const rawText = (text || '').trim();

  // 1. Direct web URL
  if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
    return rawHref;
  }

  const gerritBase = getGerritBaseUrl(vaultBasePath);

  // 2. Relative Gerrit URL
  if (rawHref.startsWith('/c/') || rawHref.startsWith('/#/c/') || rawHref.startsWith('#/c/')) {
    const clean = rawHref.replace(/^(?:\/|#\/)+/, '');
    return `${gerritBase}/${clean}`;
  }

  // 3. Gerrit change number in text (e.g. #440502 or 440502) or href
  const numMatch = rawText.match(/#?(\d{4,8})\b/) || rawHref.match(/#?(\d{4,8})\b/);
  const isGerritCandidate = rawHref.includes('~I') ||
                            rawHref.includes('prize_code') ||
                            rawHref.includes('pri_project') ||
                            rawHref.includes('sprd') ||
                            rawHref.includes('mp1') ||
                            rawHref.includes('oversea') ||
                            rawHref.includes('release') ||
                            rawText.startsWith('#') ||
                            rawHref.startsWith('#') ||
                            Boolean(linkEl && linkEl.closest('.tw-chat-table-wrap, .tw-table, .tw-msg-content table'));

  if (numMatch && isGerritCandidate) {
    return `${gerritBase}/#/c/${numMatch[1]}/`;
  }

  // 4. Gerrit Triplet without clear number
  if (rawHref.includes('~I') || rawHref.includes('prize_code')) {
    return `${gerritBase}/c/${rawHref}/`;
  }

  return null;
}

/**
 * Safely opens an external URL using Electron's shell.openExternal,
 * Node's OS-level process spawn, or falls back to window.open.
 * @param {string} href
 */
function openExternalUrl(href) {
  if (!href) return;
  const target = String(href).trim();
  if (!target) return;

  // 1. Try Electron shell.openExternal
  try {
    let elShell = (typeof shell !== 'undefined' && shell) ? shell : null;
    if (!elShell && typeof require !== 'undefined') {
      try { elShell = require('electron')?.shell; } catch (e) {}
    }
    if (elShell && typeof elShell.openExternal === 'function') {
      const p = elShell.openExternal(target);
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          console.warn('[PiDrawerView] shell.openExternal rejected, trying OS fallback:', err);
          _openViaOsCommand(target);
        });
      }
      return;
    }
  } catch (err) {
    console.warn('[PiDrawerView] shell.openExternal failed:', err);
  }

  // 2. Try Node child_process start on Windows
  _openViaOsCommand(target);
}

function _openViaOsCommand(target) {
  try {
    const cp = (typeof child_process !== 'undefined' && child_process) ? child_process : (typeof require !== 'undefined' ? require('child_process') : null);
    if (cp && typeof cp.spawn === 'function') {
      const isWin = typeof process !== 'undefined' && process.platform === 'win32';
      const cmd = isWin ? 'cmd.exe' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
      const args = isWin ? ['/c', 'start', '', target] : [target];
      const child = cp.spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
      return;
    }
  } catch (err) {
    console.warn('[PiDrawerView] OS command open failed:', err);
  }

  // 3. Fallback to window.open
  try {
    window.open(target, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('[PiDrawerView] window.open failed:', err);
  }
}

module.exports = { PiDrawerView, cleanAssistantMarkdown, formatMarkdownFallback, prepareMarkdownForRender, openExternalUrl, resolveLinkToUrl, getGerritBaseUrl };
