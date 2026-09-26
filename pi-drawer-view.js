const path = require('path');
const { AgentHub } = require('./agent-hub.js');
const { getAgentBrandSvg } = require('./providers/agent-adapter-base.js');
const { getIconPark, detectModelIconPark, detectModelBrand, getOfficialModelSvg } = require('./ui/iconpark.js');

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
    this.optGerritItem = null;
    this.optGerritDropdownPanel = null;
    this.gerritFilterEl = null;
    this.gerritSearchInput = null;
    this.gerritListEl = null;

    this.isOpenState = false;
    this.width = this.getSavedWidth();
    this.inputHeight = this.getSavedInputHeight();
    this.isDragging = false;
    this.currentAssistantMessage = null;
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

    // Header with Agent Selector Dropdown
    const activeAdapter = this.hub.getActiveAdapter();
    const header = document.createElement('div');
    header.className = 'tw-drawer-header';
    header.innerHTML = `
      <div class="tw-drawer-header-left">
        <div class="tw-agent-selector-wrap" id="twDrawerAgentSelectorWrap">
          <button class="tw-agent-selector-btn" id="twDrawerAgentSelectorBtn" title="点击切换 Agent (Pi / Codex / Gemini)">
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
      const imgEl = e.target.closest('.tw-msg-user-img, .tw-msg-content img');
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


    contentWrap.appendChild(this.messagesEl);

    // 5.5 吸顶提问复用条: 滚动离开原始气泡时钉在消息区顶部 (绝对定位, 不占 flex 流)
    this.stickyHeaderEl = document.createElement('div');
    this.stickyHeaderEl.className = 'tw-sticky-question';
    this.stickyHeaderEl.innerHTML = `
      <span class="tw-sticky-q-tag"><span class="tw-msg-user-avatar tw-msg-user-avatar--sm"></span></span>
      <span class="tw-sticky-q-text"></span>
    `;
    this.stickyHeaderEl.onclick = () => this.scrollToBottom();
    contentWrap.insertBefore(this.stickyHeaderEl, this.messagesEl);

    this._stickyAbort = new AbortController();
    this.messagesEl.addEventListener('scroll', () => {
      if (this._stickyRaf) return;
      this._stickyRaf = requestAnimationFrame(() => {
        this._stickyRaf = null;
        this.updateStickyQuestion();
        this.updateMinimapActive();
      });
    }, { signal: this._stickyAbort.signal });

    // 5.6 对话段导航条: 右侧刻度, 每条用户提问=一段, 点击跳转至该段并高亮当前视口段
    this.minimapEl = document.createElement('div');
    this.minimapEl.className = 'tw-chat-minimap';
    this.minimapEl.style.display = 'none';
    contentWrap.appendChild(this.minimapEl);

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
    window.addEventListener('resize', () => this.layoutMinimap(), { signal: this._minimapAbort.signal });

    // 6. Footer / Input Bar (Antigravity Floating Card Design - Resizable & Clean)
    const footer = document.createElement('div');
    footer.className = 'tw-drawer-footer';
    footer.innerHTML = `
      <div class="tw-drawer-input-card" id="twDrawerInputCard">
        <div class="tw-card-resizer" id="twCardResizer" title="上下拖拽调整对话框高度">
          <span class="tw-card-resizer-line"></span>
        </div>
        <div class="tw-card-image-attachments" id="twCardImageAttachments" style="display:none;"></div>
        <div class="tw-card-attachments" id="twCardAttachments" style="display:none;"></div>
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

                  <!-- 3. Jira 缺陷工单 (预留) -->
                  <div class="tw-opt-menu-item disabled" title="待接入">
                    <div class="tw-opt-item-left">
                      <span class="tw-opt-item-icon" style="color:#0EA5E9">${getIconPark('tasks', 14)}</span>
                      <span class="tw-opt-item-name">Jira 工单</span>
                    </div>
                    <div class="tw-opt-item-right">
                      <span class="tw-opt-badge-tag">待接入</span>
                    </div>
                  </div>

                  <!-- 4. 项目本地代码 (预留) -->
                  <div class="tw-opt-menu-item disabled" title="待接入">
                    <div class="tw-opt-item-left">
                      <span class="tw-opt-item-icon" style="color:#F59E0B">${getIconPark('folder', 14)}</span>
                      <span class="tw-opt-item-name">本地工程</span>
                    </div>
                    <div class="tw-opt-item-right">
                      <span class="tw-opt-badge-tag">待接入</span>
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
      { id: 'medium', label: '中', desc: '思考与速度平衡' },
      { id: 'high', label: '高', desc: '为复杂问题思考更久' },
      { id: 'max', label: '极高', desc: '为最难的问题做最深入的分析' }
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

    // Positioning: align with top of item, offset to right or left depending on boundary
    const anchorRect = anchorEl.getBoundingClientRect();
    const popoverRect = this.modelPopoverEl ? this.modelPopoverEl.getBoundingClientRect() : anchorRect;
    const topOffset = anchorRect.top - popoverRect.top;
    this.reasoningPopoverEl.style.top = `${Math.max(0, topOffset)}px`;
    this.reasoningPopoverEl.style.bottom = 'auto';

    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    if (popoverRect.right + 210 > windowWidth) {
      this.reasoningPopoverEl.style.left = 'auto';
      this.reasoningPopoverEl.style.right = '296px';
    } else {
      this.reasoningPopoverEl.style.left = '296px';
      this.reasoningPopoverEl.style.right = 'auto';
    }

    this.reasoningPopoverEl.style.display = 'flex';

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
          const isOpen = this.reasoningPopoverEl && this.reasoningPopoverEl.style.display === 'flex';
          if (isOpen) {
            this.closeReasoningPopover();
          } else {
            this.openReasoningPopover(el, modelId, modelName);
          }
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
      const map = { 'medium': '中推理', 'high': '高推理', 'max': '极高推理' };
      levelSuffix = ` (${map[reasoningEffort] || reasoningEffort})`;
    }

    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
    new NoticeCls(`✓ 已切换至模型: ${modelName}${levelSuffix}`, 2500);

    if (this.inputEl) {
      const fullLabel = `${modelName}${levelSuffix}`;
      this.inputEl.placeholder = `向 ${adapter.displayName || adapter.name} (${fullLabel}) 提问... (Enter 发送)`;
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

  getAvailableGerritFilters() {
    return [
      { id: 'all', name: '全部变更', desc: '检索全库代码评审' },
      { id: 'open', name: '开放中', desc: '当前处于评审中' },
      { id: 'merged', name: '已合入', desc: '已通过并合入主干' },
      { id: 'mine', name: '我提交', desc: '本人创建的变更单' },
      { id: 'reviewing', name: '待我审', desc: '指派给我的待评审单' }
    ];
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
          this.openProjectDropdown();
        }
      };

      this.optOpenGrokItem.addEventListener('mouseenter', () => {
        this.closeGerritDropdown();
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
          this.openGerritDropdown();
        }
      };

      this.optGerritItem.addEventListener('mouseenter', () => {
        this.closeProjectDropdown();
        this.openGerritDropdown();
      });
    }

    // 3. 悬停在其他未激活菜单项时自动收起两个子面板
    if (this.optionsPopoverEl) {
      this.optionsPopoverEl.querySelectorAll('.tw-opt-menu-item:not(#twOptOpenGrokItem):not(#twOptGerritItem)').forEach(el => {
        el.addEventListener('mouseenter', () => {
          this.closeProjectDropdown();
          this.closeGerritDropdown();
        });
      });
    }

    // 4. OpenGrok 搜索框
    if (this.projectSearchInput) {
      this.projectSearchInput.onclick = (e) => e.stopPropagation();
      this.projectSearchInput.oninput = (e) => {
        this.renderProjectPopover(e.target.value.trim());
      };
    }

    // 5. Gerrit 搜索框
    if (this.gerritSearchInput) {
      this.gerritSearchInput.onclick = (e) => e.stopPropagation();
      this.gerritSearchInput.oninput = (e) => {
        this.renderGerritPopover(e.target.value.trim());
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

  openProjectPopover() {
    if (!this.optionsPopoverEl) return;
    this.closeModelPopover();
    if (this.projectSearchInput) this.projectSearchInput.value = '';
    if (this.gerritSearchInput) this.gerritSearchInput.value = '';
    // 默认不要展开子浮窗列表
    this.closeProjectDropdown();
    this.closeGerritDropdown();
    this.optionsPopoverEl.style.display = 'flex';
  }

  closeProjectPopover() {
    if (this.optionsPopoverEl) {
      this.optionsPopoverEl.style.display = 'none';
    }
    this.closeProjectDropdown();
    this.closeGerritDropdown();
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

  updateProjectSelectorPill() {
    if (!this.optionsWrapEl) return;
    const isNiceAigc = this.hub.activeAgentId === 'niceaigc';
    if (isNiceAigc) {
      this.optionsWrapEl.style.display = 'none';
      return;
    }
    this.optionsWrapEl.style.display = 'inline-flex';

    // 1. OpenGrok 标签与状态
    const isAuto = !this.selectedProject || this.selectedProject === 'auto';
    const label = isAuto ? 'Auto' : this.selectedProject;
    if (this.projectNameEl) {
      this.projectNameEl.textContent = label;
      this.projectNameEl.title = isAuto ? 'Auto (智能推断)' : this.selectedProject;
    }

    // 2. Gerrit 标签与状态 (极简短标签 <= 6 字符)
    const gerritMap = { all: '全部', open: '开放中', merged: '已合入', mine: '我提交', reviewing: '待我审' };
    const gerritLabel = gerritMap[this.selectedGerritFilter || 'all'] || '全部';
    if (this.gerritFilterEl) {
      this.gerritFilterEl.textContent = gerritLabel;
      this.gerritFilterEl.title = `Gerrit: ${gerritLabel}`;
    }

    // 3. 激活高亮与红点逻辑 (当任意配置非默认时触发)
    const isCustomGerrit = this.selectedGerritFilter && this.selectedGerritFilter !== 'all';
    const hasCustomOption = !isAuto || isCustomGerrit;
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
      if (!isAuto) tipParts.push(`OpenGrok: ${label}`);
      if (isCustomGerrit) tipParts.push(`Gerrit: ${gerritLabel}`);
      this.optionsBtnEl.title = tipParts.length ? `选项 (${tipParts.join(' | ')})` : '选项配置';
    }
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

    // 4. Update UI labels and selector
    this.syncActiveAgentUI();

    // 5. Restore Draft
    if (this.inputEl) {
      this.inputEl.value = this.hub.sessionManager.getDraft(agentId) || '';
      const savedH = this.getSavedInputHeight();
      this.inputHeight = savedH;
      const targetH = Math.max(savedH, Math.min(500, this.inputEl.scrollHeight || savedH));
      this.inputEl.style.height = `${targetH}px`;
    }

    // 6. Restore Message History
    this.restoreSessionMessages(agentId);

    // 7. Check if installed and show warning if needed
    const adapter = this.hub.getActiveAdapter();
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

    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let modelSuffix = '';
    if (currentModel?.name) {
      let mName = currentModel.name;
      if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel.id)) {
        const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
        if (effortConfig && effortConfig.label) mName += ` · ${effortConfig.label}`;
      }
      modelSuffix = ` (${mName})`;
    }

    if (this.inputEl) {
      this.inputEl.placeholder = `向 ${meta.displayName || meta.name}${modelSuffix} 提问，输入需求或问题... (Enter 发送)`;
    }
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

    const messages = this.hub.sessionManager.getMessages(agentId);
    if (!messages || messages.length === 0) {
      // Empty state: do not render bulky welcome card (per user request)
      return;
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        this.renderPastUserMessage(msg);
      } else {
        this.renderPastAssistantMessage(msg);
      }
    }
    this.scrollToBottom();
  }

  renderPastUserMessage(msg) {
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap user';

    let badgeHtml = '';
    if (msg.badge) {
      badgeHtml = `<div class="tw-user-context-pill">${getIconPark('target', 12)} <span>${escapeHtml(msg.badge)}</span></div>`;
    }

    let imagesHtml = '';
    if (msg.images && msg.images.length > 0) {
      imagesHtml = '<div class="tw-msg-user-images">' + msg.images.map(img => {
        const src = img.dataUrl || img.path || '';
        return `<img src="${src}" class="tw-msg-user-img" alt="${escapeAttr(img.name || 'image')}" title="${escapeAttr(img.name || 'image')}" />`;
      }).join('') + '</div>';
    }

    bubbleWrap.innerHTML = `
      <div class="tw-msg-avatar">
        <div class="tw-msg-avatar-info"><span class="tw-msg-user-avatar"></span> <span class="tw-msg-author">You</span></div>
        <button class="tw-msg-copy-btn" title="复制提问内容">${getIconPark('copy', 12)} <span>复制</span></button>
      </div>
      ${badgeHtml}
      ${imagesHtml}
      ${msg.text ? `<div class="tw-msg-content" data-raw="${escapeAttr(msg.text || '')}">${escapeHtml(msg.text).replace(/\n/g, '<br>')}</div>` : ''}
    `;

    this.messagesEl.appendChild(bubbleWrap);
  }

  renderPastAssistantMessage(msg) {
    const adapter = this.hub.getActiveAdapter();
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap assistant';

    const authorName = msg.model || adapter.displayName;
    const authorIcon = adapter.id === 'hermes' ? adapter.icon : (msg.model ? getOfficialModelSvg(msg.model, 16) : adapter.icon);

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

    bubbleWrap.innerHTML = `
      <div class="tw-msg-avatar">
        <div class="tw-msg-avatar-info">
          <span class="tw-msg-brand-icon">${authorIcon}</span> 
          <span class="tw-msg-author">${escapeHtml(authorName)}</span>
        </div>
        <button class="tw-msg-copy-btn" title="一键复制回答全文">${getIconPark('copy', 12)} <span>复制</span></button>
      </div>
      <div class="tw-msg-content" data-raw="${escapeAttr(displayText || '')}"></div>
    `;

    const contentEl = bubbleWrap.querySelector('.tw-msg-content');
    this.formatMessageContent(contentEl, displayText || '');

    // Render dedicated thinking process box strictly below answer content
    if (displayThinking && displayThinking.trim().length > 0) {
      const thinkingBox = document.createElement('div');
      thinkingBox.className = 'tw-msg-thinking-box collapsed';
      thinkingBox.innerHTML = `
        <div class="tw-thinking-header">
          <div class="tw-thinking-title">
            <span class="tw-thinking-icon">${getIconPark('sparkles', 13)}</span>
            <span class="tw-thinking-title-text">思考过程</span>
            <span class="tw-thinking-status">(已完成思考 · 共 ${displayThinking.length}字 · 点击展开)</span>
          </div>
          <div class="tw-thinking-toggle">
            <span class="tw-thinking-toggle-icon">${getIconPark('right', 11)}</span>
          </div>
        </div>
        <div class="tw-thinking-body"></div>
      `;
      const bodyEl = thinkingBox.querySelector('.tw-thinking-body');
      bodyEl.textContent = displayThinking;
      const headerEl = thinkingBox.querySelector('.tw-thinking-header');
      headerEl.onclick = () => {
        thinkingBox.classList.toggle('collapsed');
        const icon = headerEl.querySelector('.tw-thinking-toggle-icon');
        if (icon) {
          icon.innerHTML = thinkingBox.classList.contains('collapsed') ? getIconPark('right', 11) : getIconPark('down', 11);
        }
      };
      bubbleWrap.appendChild(thinkingBox);
    }

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
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      } else if (e.key === 'Escape') {
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
          <button class="tw-lightbox-close" title="关闭 (Esc)">${getIconPark('close', 14)}</button>
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
    document.addEventListener('keydown', onKey);
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
    const isStreaming = (status === 'thinking' || status === 'running_tool') || !!this._sendInFlight || !!(this.hub && typeof this.hub.isStreaming === 'function' && this.hub.isStreaming());

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

      const canSend = isInstalled && (hasText || hasImages);
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

    this.hub.on('text_delta', (delta) => {
      this.appendAssistantDelta(delta);
    });

    this.hub.on('tool_start', (toolData) => {
      this.handleToolStart(toolData);
    });

    this.hub.on('tool_end', (toolData) => {
      this.handleToolEnd(toolData);
    });

    this.hub.on('agent_settled', () => {
      this.finishAssistantMessage();
    });

    this.hub.on('aborted', () => {
      this.finishAssistantMessage(true);
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
    const authorIcon = adapter.id === 'hermes' ? adapter.icon : (currentModel ? getOfficialModelSvg(currentModel.id || currentModel.name, 16) : adapter.icon);

    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap assistant';

    // 1. Avatar / Header
    const header = document.createElement('div');
    header.className = 'tw-msg-avatar';
    header.innerHTML = `
      <div class="tw-msg-avatar-info">
        <span class="tw-msg-brand-icon">${authorIcon}</span> 
        <span class="tw-msg-author">${escapeHtml(authorName)}</span>
      </div>
      <button class="tw-msg-copy-btn" title="一键复制回答全文">${getIconPark('copy', 12)} <span>复制</span></button>
    `;
    bubbleWrap.appendChild(header);

    // 2. Compact Scrollable Process Box (for tool execution & retrieval)
    const processBox = document.createElement('div');
    processBox.className = 'tw-msg-process-box';
    processBox.style.display = 'none'; // Hidden until tool execution starts

    const processHeader = document.createElement('div');
    processHeader.className = 'tw-process-header';
    processHeader.innerHTML = `
      <div class="tw-process-title">
        <span class="tw-process-icon">${getIconPark('setting-config', 13)}</span>
        <span>排查与工具检索过程</span>
        <span class="tw-process-count">(0项)</span>
      </div>
      <div class="tw-process-toggle">
        <span class="tw-process-toggle-icon">${getIconPark('down', 11)}</span>
      </div>
    `;
    processBox.appendChild(processHeader);

    const processBody = document.createElement('div');
    processBody.className = 'tw-process-body';
    processBox.appendChild(processBody);

    // Toggle collapse/expand on header click
    processHeader.onclick = () => {
      processBox.classList.toggle('collapsed');
      const icon = processHeader.querySelector('.tw-process-toggle-icon');
      if (icon) {
        icon.innerHTML = processBox.classList.contains('collapsed') ? getIconPark('right', 11) : getIconPark('down', 11);
      }
    };

    bubbleWrap.appendChild(processBox);

    // 3. Final Content container (hidden until text_delta arrives)
    const content = document.createElement('div');
    content.className = 'tw-msg-content';
    content.style.display = 'none';
    bubbleWrap.appendChild(content);

    // 4. Dedicated Thinking Process Box (placed strictly BELOW the answer content)
    const thinkingBox = document.createElement('div');
    thinkingBox.className = 'tw-msg-thinking-box';
    thinkingBox.style.display = 'none'; // Hidden until thinking arrives

    const thinkingHeader = document.createElement('div');
    thinkingHeader.className = 'tw-thinking-header';
    thinkingHeader.innerHTML = `
      <div class="tw-thinking-title">
        <span class="tw-thinking-icon">${getIconPark('sparkles', 13)}</span>
        <span class="tw-thinking-title-text">思考过程</span>
        <span class="tw-thinking-status">(思考中...)</span>
      </div>
      <div class="tw-thinking-toggle">
        <span class="tw-thinking-toggle-icon">${getIconPark('down', 11)}</span>
      </div>
    `;
    thinkingBox.appendChild(thinkingHeader);

    const thinkingBody = document.createElement('div');
    thinkingBody.className = 'tw-thinking-body';
    thinkingBox.appendChild(thinkingBody);

    thinkingHeader.onclick = () => {
      thinkingBox.classList.toggle('collapsed');
      const icon = thinkingHeader.querySelector('.tw-thinking-toggle-icon');
      if (icon) {
        icon.innerHTML = thinkingBox.classList.contains('collapsed') ? getIconPark('right', 11) : getIconPark('down', 11);
      }
    };

    bubbleWrap.appendChild(thinkingBox);

    this.messagesEl.appendChild(bubbleWrap);
    this.scrollToBottom();

    this.currentAssistantMessage = {
      wrapEl: bubbleWrap,
      contentEl: content,
      processBoxEl: processBox,
      processHeaderEl: processHeader,
      processBodyEl: processBody,
      thinkingBoxEl: thinkingBox,
      thinkingHeaderEl: thinkingHeader,
      thinkingBodyEl: thinkingBody,
      thinkingText: '',
      thinkingStartTime: null,
      isThinking: false,
      toolCount: 0,
      rawText: '',
      activeTools: new Map()
    };

    return this.currentAssistantMessage;
  }

  handleThinkingStart(data) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;
    msg.isThinking = true;
    if (!msg.thinkingStartTime) msg.thinkingStartTime = Date.now();
    msg.thinkingBoxEl.style.display = 'flex';
    msg.thinkingBoxEl.classList.add('thinking');
    msg.thinkingBoxEl.classList.remove('collapsed');
    const icon = msg.thinkingHeaderEl?.querySelector('.tw-thinking-toggle-icon');
    if (icon) icon.innerHTML = getIconPark('down', 11);
    const statusEl = msg.thinkingHeaderEl?.querySelector('.tw-thinking-status');
    if (statusEl) statusEl.textContent = '(正在深度思考...)';
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
    msg.thinkingBoxEl.style.display = 'flex';
    msg.thinkingBoxEl.classList.add('thinking');

    const statusEl = msg.thinkingHeaderEl?.querySelector('.tw-thinking-status');
    if (statusEl) {
      const elapsed = Math.max(1, Math.floor((Date.now() - msg.thinkingStartTime) / 1000));
      statusEl.textContent = `(深度思考中 ${elapsed}s · ${msg.thinkingText.length}字)`;
    }

    msg.thinkingBodyEl.textContent = msg.thinkingText;
    msg.thinkingBodyEl.scrollTop = msg.thinkingBodyEl.scrollHeight;
    this.scrollToBottom();
  }

  handleThinkingEnd(data) {
    if (!this.currentAssistantMessage) return;
    const msg = this.currentAssistantMessage;
    msg.isThinking = false;
    msg.thinkingBoxEl.classList.remove('thinking');

    // DO NOT say "已完成思考" here because tool execution or text generation is still actively running!
    if (msg.thinkingText && msg.thinkingText.trim().length > 0) {
      const statusEl = msg.thinkingHeaderEl?.querySelector('.tw-thinking-status');
      if (statusEl) {
        statusEl.textContent = `(阶段推演就绪 · ${msg.thinkingText.length}字 · 正在调用工具与撰写回复...)`;
      }
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
    }

    msg.contentEl.classList.add('streaming');
    // Direct DOM text append with pre-wrap and clean delimiters for zero flickering
    msg.contentEl.textContent = cleanAssistantMarkdown(msg.rawText);
    this.scrollToBottom();
  }

  handleToolStart({ toolCallId, toolName, args, startTime, actionDesc }) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;

    // If thinking was in progress or ready, and now tools started executing:
    if (msg.thinkingText && msg.thinkingText.trim().length > 0) {
      msg.isThinking = false;
      if (msg.thinkingBoxEl) {
        msg.thinkingBoxEl.classList.remove('thinking');
        // Auto-collapse thinking box when tools start so the user's attention stays on the running tool
        msg.thinkingBoxEl.classList.add('collapsed');
        const icon = msg.thinkingHeaderEl?.querySelector('.tw-thinking-toggle-icon');
        if (icon) icon.innerHTML = getIconPark('right', 11);
      }
      const statusEl = msg.thinkingHeaderEl?.querySelector('.tw-thinking-status');
      if (statusEl) {
        statusEl.textContent = `(阶段推演就绪 · ${msg.thinkingText.length}字 · 正在调用工具排查...)`;
      }
    }

    // Reveal process box and update count
    msg.processBoxEl.style.display = 'flex';
    msg.toolCount++;
    const countEl = msg.processHeaderEl.querySelector('.tw-process-count');
    if (countEl) countEl.textContent = `(${msg.toolCount}项)`;

    const toolCard = document.createElement('div');
    toolCard.className = 'tw-tool-card running';
    toolCard.innerHTML = `
      <span class="tw-tool-spin">${getIconPark('time', 13)}</span>
      <span class="tw-tool-desc">${escapeHtml(actionDesc || toolName)}</span>
      <span class="tw-tool-timer">0s</span>
    `;
    msg.processBodyEl.appendChild(toolCard);

    // Scroll inside process body so newest tool is visible
    msg.processBodyEl.scrollTop = msg.processBodyEl.scrollHeight;

    const timerEl = toolCard.querySelector('.tw-tool-timer');
    const start = startTime || Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (timerEl) {
        timerEl.textContent = `${elapsed}s`;
        if (elapsed > 30) {
          toolCard.classList.add('warning');
          toolCard.title = '检索耗时较长，可点击中止';
        }
      }
    }, 1000);

    this.activeToolCards.set(toolCallId, {
      el: toolCard,
      timer: timerInterval,
      startTime: start
    });

    this.scrollToBottom();
  }

  handleToolEnd({ toolCallId, toolName, durationMs, isError, error, output }) {
    const cardInfo = this.activeToolCards.get(toolCallId);
    if (!cardInfo) return;

    clearInterval(cardInfo.timer);
    this.activeToolCards.delete(toolCallId);

    const { el } = cardInfo;
    el.classList.remove('running');

    const sec = ((durationMs || 100) / 1000).toFixed(1);
    if (isError) {
      el.classList.add('error');
      el.innerHTML = `
        <span class="tw-tool-icon tw-tool-error">${getIconPark('close-circle', 13, { color: '#EF4444' })}</span>
        <span class="tw-tool-desc">${escapeHtml(toolName)} 执行失败: ${escapeHtml(error || output || '错误')}</span>
        <span class="tw-tool-timer">${sec}s</span>
      `;
    } else {
      el.classList.add('success');
      const prevDesc = el.querySelector('.tw-tool-desc')?.textContent || toolName;
      el.innerHTML = `
        <span class="tw-tool-icon tw-tool-success">${getIconPark('check', 13, { color: '#10B981' })}</span>
        <span class="tw-tool-desc">${escapeHtml(prevDesc)}</span>
        <span class="tw-tool-timer">${sec}s</span>
      `;
    }

    if (this.currentAssistantMessage && this.currentAssistantMessage.processBodyEl) {
      this.currentAssistantMessage.processBodyEl.scrollTop = this.currentAssistantMessage.processBodyEl.scrollHeight;
    }
  }

  finishAssistantMessage(isAborted = false) {
    if (!this.currentAssistantMessage) return;
    const msg = this.currentAssistantMessage;

    // Clear any running tool card timers
    for (const [id, info] of this.activeToolCards.entries()) {
      clearInterval(info.timer);
      info.el.classList.remove('running');
      info.el.classList.add('aborted');
    }
    this.activeToolCards.clear();

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

      // If this message represents an upstream channel exception (e.g. 429 concurrency limit):
      if (msg.rawText.includes('上游模型通道调用异常') || msg.rawText.includes('Concurrency limit exceeded') || msg.rawText.includes('429')) {
        const actionWrap = document.createElement('div');
        actionWrap.className = 'tw-error-actions-bar';
        actionWrap.style.cssText = 'margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;';
        actionWrap.innerHTML = `
          <button class="tw-error-switch-ds-btn" style="padding: 5px 12px; font-size: 11.5px; font-weight: 600; background: #10B981; color: #fff; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            ${getIconPark('lightning', 12)} <span>一键切至 DeepSeek 极速通道并重试</span>
          </button>
          <button class="tw-error-resend-btn" style="padding: 5px 12px; font-size: 11.5px; font-weight: 500; background: rgba(0,0,0,0.06); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
            ${getIconPark('refresh', 12)} <span>重新发送本题</span>
          </button>
        `;
        const dsBtn = actionWrap.querySelector('.tw-error-switch-ds-btn');
        if (dsBtn) {
          dsBtn.onclick = () => {
            this.selectModel('deepseek-v4-flash', 'DeepSeek V4 Flash (推荐)', 'deepseek');
            const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
            const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
            if (lastUserMsg && lastUserMsg.text) {
              this.inputEl.value = lastUserMsg.text;
              this.handleSend();
            }
          };
        }
        const resendBtn = actionWrap.querySelector('.tw-error-resend-btn');
        if (resendBtn) {
          resendBtn.onclick = () => {
            const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
            const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
            if (lastUserMsg && lastUserMsg.text) {
              this.inputEl.value = lastUserMsg.text;
              this.handleSend();
            }
          };
        }
        msg.contentEl.appendChild(actionWrap);
      }
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
          <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="tw-empty-switch-ds-btn" style="padding: 4px 10px; font-size: 11px; font-weight: 600; background: #10B981; color: #fff; border: none; border-radius: 4px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px;">
              ${getIconPark('lightning', 12)} <span>一键切至 DeepSeek 极速通道并重试</span>
            </button>
            <button class="tw-empty-retry-direct-btn" style="padding: 4px 10px; font-size: 11px; font-weight: 500; background: var(--interactive-accent, #2563EB); color: #fff; border: none; border-radius: 4px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px;">
              ${getIconPark('refresh', 12)} <span>重新发送本题</span>
            </button>
          </div>
        </div>
      `;

      const dsBtn = msg.contentEl.querySelector('.tw-empty-switch-ds-btn');
      if (dsBtn) {
        dsBtn.onclick = () => {
          this.selectModel('deepseek-v4-flash', 'DeepSeek V4 Flash (推荐)', 'deepseek');
          const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
          const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
          if (lastUserMsg && lastUserMsg.text) {
            this.inputEl.value = lastUserMsg.text;
            this.handleSend();
          }
        };
      }

      const directRetryBtn = msg.contentEl.querySelector('.tw-empty-retry-direct-btn');
      if (directRetryBtn) {
        directRetryBtn.onclick = () => {
          const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
          const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
          if (lastUserMsg && lastUserMsg.text) {
            this.inputEl.value = lastUserMsg.text;
            this.handleSend();
          }
        };
      }
    }

    // Finalize thinking box state
    if (msg.thinkingText && msg.thinkingText.trim().length > 0) {
      msg.isThinking = false;
      if (msg.thinkingBoxEl) {
        msg.thinkingBoxEl.classList.remove('thinking');
        msg.thinkingBoxEl.classList.add('collapsed');
      }
      const statusEl = msg.thinkingHeaderEl?.querySelector('.tw-thinking-status');
      if (statusEl) {
        const duration = msg.thinkingStartTime ? Math.max(1, Math.round((Date.now() - msg.thinkingStartTime) / 1000)) : 1;
        statusEl.textContent = `(已完成思考 · 共 ${msg.thinkingText.length}字 · 耗时${duration}s · 点击展开)`;
      }
      const icon = msg.thinkingHeaderEl?.querySelector('.tw-thinking-toggle-icon');
      if (icon) icon.innerHTML = getIconPark('right', 11);
    }

    // Persist to session manager
    const adapter = this.hub.getActiveAdapter();
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let authorModel = (currentModel && currentModel.name) ? currentModel.name : adapter.displayName;
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel?.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) authorModel += ` · ${effortConfig.label}`;
    }

    this.hub.sessionManager.addMessage(this.hub.activeAgentId, {
      role: 'assistant',
      text: msg.rawText,
      toolCount: msg.toolCount,
      model: authorModel,
      thinking: msg.thinkingText || ''
    });

    this.currentAssistantMessage = null;
    this.scrollToBottom();
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

  postProcessRenderedMarkdown(containerEl) {
    if (!containerEl) return;

    // 1. Add rel, target, and direct click handler to external links
    containerEl.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || a.href || '';
      const text = a.textContent || '';
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
  }

  addUserMessageBubble(userText, contextBadgeText, images = []) {
    this.removeWelcomeScreen();
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap user';

    let badgeHtml = '';
    if (contextBadgeText) {
      badgeHtml = `<div class="tw-user-context-pill">${getIconPark('target', 12)} <span>${escapeHtml(contextBadgeText)}</span></div>`;
    }

    let imagesHtml = '';
    if (images && images.length > 0) {
      imagesHtml = '<div class="tw-msg-user-images">' + images.map(img => {
        const src = img.dataUrl || img.path || '';
        return `<img src="${src}" class="tw-msg-user-img" alt="${escapeAttr(img.name || 'image')}" title="${escapeAttr(img.name || 'image')}" />`;
      }).join('') + '</div>';
    }

    bubbleWrap.innerHTML = `
      <div class="tw-msg-avatar">
        <div class="tw-msg-avatar-info"><span class="tw-msg-user-avatar"></span> <span class="tw-msg-author">You</span></div>
        <button class="tw-msg-copy-btn" title="复制提问内容">${getIconPark('copy', 12)} <span>复制</span></button>
      </div>
      ${badgeHtml}
      ${imagesHtml}
      ${userText ? `<div class="tw-msg-content" data-raw="${escapeAttr(userText || '')}">${escapeHtml(userText).replace(/\n/g, '<br>')}</div>` : ''}
    `;

    this.messagesEl.appendChild(bubbleWrap);

    // Persist to session manager
    this.hub.sessionManager.addMessage(this.hub.activeAgentId, {
      role: 'user',
      text: userText,
      badge: contextBadgeText,
      images: images && images.length > 0 ? images.map(i => ({ name: i.name, size: i.size, dataUrl: i.dataUrl })) : null
    });

    this.scrollToBottom();
  }

  async handleSend() {
    const adapter = this.hub.getActiveAdapter();
    if (adapter.status === 'not_installed') {
      return;
    }
    // 防重入：上一次提交（含检索等待）未落地前，忽略 Enter/点击
    if (this._sendInFlight) return;

    const text = this.inputEl.value.trim();
    const imagesToSend = [...(this.attachedImages || [])];
    if ((!text && imagesToSend.length === 0) || this.hub.isStreaming()) return;

    this._sendInFlight = true;
    this._abortRequested = false;
    try {

    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    this.inputEl.value = '';
    this.inputEl.style.height = `${this.inputHeight}px`;
    this.hub.sessionManager.setDraft(this.hub.activeAgentId, '');
    this.attachedImages = [];
    this.renderImageAttachments();
    this.updateSendButtonState();

    const isNiceAigc = this.hub.activeAgentId === 'niceaigc';
    const ctxInfo = (!isNiceAigc && this.contextProvider) ? this.contextProvider.getContextBadgeInfo() : null;
    const badgeLabel = (ctxInfo && ctxInfo.hasContext) ? `${ctxInfo.title} (${ctxInfo.module})` : null;

    this.addUserMessageBubble(text, badgeLabel, imagesToSend);

    // NiceAIGC does NOT bind to knowledge base; send clean user prompt without metadata
    let fullPrompt = (!isNiceAigc && this.contextProvider)
      ? this.contextProvider.formatPromptWithContext(text)
      : text;

    // OpenGrok 代码检索工程约束注入 (Pi / Hermes / Gemini 等 Agent)
    if (!isNiceAigc) {
      if (this.selectedProject && this.selectedProject !== 'auto') {
        fullPrompt += `\n\n[OpenGrok Target Project] 用户在工作台指定本次提问优先关联代码工程库为: \`${this.selectedProject}\`。若调用 opengrok_search_code 或 opengrok_read_file，请务必传入 project="${this.selectedProject}"。`;
        try { process.env.OPENGROK_DEFAULT_PROJECT = this.selectedProject; } catch (_) {}
      } else if (ctxInfo && ctxInfo.hasContext && ctxInfo.platform && ctxInfo.platform !== 'Common') {
        fullPrompt += `\n\n[OpenGrok Target Project] 当前笔记关联手机硬件平台为: ${ctxInfo.platform}。在调用 OpenGrok 工具检索时请优先匹配对应工程。`;
      }
    }

    // 非 Pi / Hermes Agent（无内置或原生 MCP vendor 工具的 Agent）此处才做插件侧前置检索注入；
    // Pi 与 Hermes 已通过 Extension / MCP 接入 vendor_portal 工具链，支持自主按需调用与执行卡片渲染
    if (text && !isNiceAigc && this.hub.activeAgentId !== 'pi' && this.hub.activeAgentId !== 'hermes') {
      try {
        const retrieval = await this.gatherRetrievalContext(text);
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
      if (res && res.success === false) {
        if (!this.currentAssistantMessage) {
          this.createAssistantMessageBubble();
        }
        this.appendAssistantDelta(`\n⚠️ 提示: ${res.error || '未收到模型回复'}`);
        this.finishAssistantMessage();
      }
    } catch (err) {
      this.createAssistantMessageBubble();
      this.appendAssistantDelta(`❌ 发送失败: ${err.message}\n请检查 ${adapter.displayName} 运行状态。`);
      this.finishAssistantMessage();
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
    this.restoreSessionMessages(agentId);
    this.closeHistoryPanel();
  }

  deleteHistorySession(sessionId) {
    const agentId = this.hub.activeAgentId;
    if (this.hub && this.hub.sessionManager) {
      const wasActive = (this.hub.sessionManager.getActiveSessionId(agentId) === sessionId);
      this.hub.sessionManager.deleteSession(agentId, sessionId);
      if (wasActive && this.messagesEl) {
        this.messagesEl.innerHTML = '';
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
    if (hours < 24) return `${hours}Сʱǰ`;
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${hh}:${mm}`;
  }

  async handleNewSession() {
    const agentId = this.hub.activeAgentId;
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }
    if (this.hub.sessionManager) {
      this.hub.sessionManager.newSession(agentId);
    }
    await this.hub.newSession();
    this.currentAssistantMessage = null;
    if (this.messagesEl) {
      this.messagesEl.innerHTML = '';
    }
    if (this.stickyHeaderEl) {
      this.stickyHeaderEl.classList.remove('visible');
    }
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
  }

  scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  // 滚动时找出当前已被滚出顶部的最新用户提问，钉到吸顶条上 (绝对定位脱流防抖动)
  updateStickyQuestion() {
    if (!this.messagesEl || !this.stickyHeaderEl) return;
    const bubbles = Array.from(this.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.user'));
    if (!bubbles.length) {
      this.stickyHeaderEl.classList.remove('visible');
      return;
    }

    const boxTop = this.messagesEl.getBoundingClientRect().top;

    // 找出所有已滚出可视区顶部的用户提问中最新的那一条
    let active = null;
    for (const b of bubbles) {
      if (b.getBoundingClientRect().top < boxTop) {
        active = b;
      } else {
        break;
      }
    }

    if (!active) {
      this.stickyHeaderEl.classList.remove('visible');
      return;
    }

    // 若该提问气泡本身还部分露在可视区顶部（用户还能直接看到原文），不重复展示吸顶条
    const contentEl = active.querySelector('.tw-msg-content');
    if (contentEl && contentEl.getBoundingClientRect().bottom > boxTop) {
      this.stickyHeaderEl.classList.remove('visible');
      return;
    }

    const textEl = active.querySelector('.tw-msg-content') || active;
    const line = (textEl.textContent || '').trim().replace(/\s+/g, ' ');
    if (!line) {
      this.stickyHeaderEl.classList.remove('visible');
      return;
    }

    const qTextEl = this.stickyHeaderEl.querySelector('.tw-sticky-q-text');
    if (qTextEl && qTextEl.textContent !== line) {
      qTextEl.textContent = line;
    }
    this.stickyHeaderEl.classList.add('visible');
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
        const delta = target.getBoundingClientRect().top - this.messagesEl.getBoundingClientRect().top;
        this.messagesEl.scrollTo({ top: this.messagesEl.scrollTop + delta - 8, behavior: 'smooth' });
        this.updateMinimapActive();
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
    const boxTop = this.messagesEl.getBoundingClientRect().top;
    let activeIdx = 0;
    for (let i = 0; i < bubbles.length; i++) {
      if (bubbles[i].getBoundingClientRect().top <= boxTop + 4) activeIdx = i;
      else break;
    }
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].classList.toggle('active', i === activeIdx);
    }
  }

  open() {
    if (this.isOpenState) return;
    this.isOpenState = true;
    this.drawerEl.style.display = 'flex';
    this.notifyToggle(true);

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

  // 7. Strip leftover private-use characters & non-printable ASCII control chars
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '');
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // 8. Clean isolated stray box characters
  cleaned = cleaned.replace(/(?:^|\s)□+(?:\s|$)/g, ' ');

  // 9. Clean excessive blank lines
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
  let out = text.replace(/([^\n\r])\r?\n\s*(\|[^\n\r]+\|\r?\n\s*\|[\s\-:|]+\|)/g, '$1\n\n$2');
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
