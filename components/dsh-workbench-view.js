/* ==========================================================================
   DSH Workbench View — DeepSeek Harness 研发工作台大项集成视图
   布局:
   - 左侧: TabonKB 知识库上下文 & 6 大 MCP 联动状态 & 研发 Prompt 快捷指令 (可折叠/拖拽)
   - 右侧: DeepSeek Harness 官方桌面智能体工作台 (工作区默认为当前知识库)
   - 遵循工作台极简美学 (Minimalist Philosophy, 标签 <= 6 字符)
   ========================================================================== */

let NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
if (!NoticeCls) {
  try {
    const obs = require('obsidian');
    NoticeCls = obs.Notice;
  } catch (_) {
    NoticeCls = class MockNotice { constructor(msg) { if (typeof console !== 'undefined') console.log('[Notice]', msg); } };
  }
}

let getIconParkFn = typeof getIconPark === 'function' ? getIconPark : null;
if (!getIconParkFn) {
  try {
    getIconParkFn = require('../ui/iconpark.js').getIconPark;
  } catch (_) {
    getIconParkFn = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class DshWorkbenchView {
  constructor(options = {}) {
    this.app = options.app || (typeof app !== 'undefined' ? app : null);
    this.plugin = options.plugin || null;
    this.contextProvider = options.contextProvider || null;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.sidebarEl = null;
    this.resizerEl = null;
    this.mainPaneEl = null;
    this.toolbarEl = null;
    this.iframeEl = null;
    this.loadingEl = null;
    this.statusBadgeEl = null;
    this.statusBadgeText = null;
    this.btnMcpStatus = null;
    this.mcpPopoverEl = null;
    this._popoverDocClick = null;
    this._popoverKeydown = null;

    this.sidebarWidth = this.getSavedSidebarWidth();
    this.isSidebarCollapsed = this.getSavedSidebarCollapsed();

    this._statusUnsub = null;
    this._authUnsub = null;
    this._activeFileUnsub = null;
    this._dshSid = '__draft__';
    this._boundOnMouseMove = null;
    this._boundOnMouseUp = null;

    this._boundOnWindowMessage = (evt) => {
      if (!evt || !evt.data) return;
      if (evt.data.type === 'tabonkb-dsh-ready') {
        this.syncThemeToIframe();
        this.sendDshCtxState();
        return;
      }
      if (evt.data.type === 'tabonkb-dsh-ctx-state-req') {
        this._dshSid = this._normalizeDshSid(evt.data.sid);
        this._migrateDshDraftTo(this._dshSid);
        this._mirrorDshCtxToAgent(this.getDshCtxState(this._dshSid), this._dshSid);
        this.sendDshCtxState();
        return;
      }
      if (evt.data.type === 'tabonkb-dsh-ctx-set') {
        this.applyDshCtxSelection(evt.data.key, evt.data.value, evt.data.sid);
        return;
      }
      if (evt.data.type === 'tabonkb-dsh-new-chat') {
        this.resetDshCtxSelections();
        return;
      }
      if (evt.data.type === 'tabonkb-dsh-open-file' && evt.data.path) {
        this.handleOpenFile(evt.data.path, evt.data.line);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this._boundOnWindowMessage);
    }
  }

  getSavedSidebarWidth() {
    try {
      if (typeof localStorage !== 'undefined') {
        const w = parseInt(localStorage.getItem('tabonkb-dsh-sidebar-width'), 10);
        if (w >= 200 && w <= 500) return w;
      }
    } catch (_) {}
    return 260;
  }

  saveSidebarWidth(w) {
    this.sidebarWidth = w;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-dsh-sidebar-width', String(w));
      }
    } catch (_) {}
  }

  getSavedSidebarCollapsed() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-dsh-sidebar-collapsed-v2');
        if (saved === '0') return false;
        if (saved === '1') return true;
        // Legacy "0" meant the old default-visible state; do not carry it forward.
        if (localStorage.getItem('tabonkb-dsh-sidebar-collapsed') === '1') return true;
      }
    } catch (_) {}
    // New installs start with the context sidebar hidden; explicit user choice wins.
    return true;
  }

  saveSidebarCollapsed(collapsed) {
    this.isSidebarCollapsed = collapsed;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-dsh-sidebar-collapsed-v2', collapsed ? '1' : '0');
      }
    } catch (_) {}
  }

  getDaemonManager() {
    if (this.plugin?.dshDaemon) return this.plugin.dshDaemon;
    try {
      const plugin = this.plugin || this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin) {
        this.plugin = plugin;
        // R11: 尊重 settings.dsh.enabled —— 显式关闭时不再隐式创建守护管理器
        if (!plugin.dshDaemon && plugin.settings && plugin.settings.dsh && plugin.settings.dsh.enabled === false) {
          return null;
        }
        if (!plugin.dshDaemon && typeof DshDaemonManager !== 'undefined') {
          const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
          plugin.dshDaemon = new DshDaemonManager({
            plugin: plugin,
            vaultBasePath: vaultPath,
            port: plugin.settings?.dsh?.port || 3080,
            profile: plugin.settings?.dsh?.profile || 'tabonkb'
          });
        }
        return plugin.dshDaemon || null;
      }
    } catch (_) {}
    return null;
  }

  mount(parentEl) {
    this.containerEl = parentEl.createDiv({ cls: 'tw-harness-tab-wrap is-full-frame' });

    // DSH 原生工作台直铺全屏, 移除左侧冗余上下文侧栏与拖拽条
    this.renderRightPane(this.containerEl);

    // 绑定守护进程事件并加载
    this.bindDaemonEvents();
    this.connectDaemon();
  }

  renderLeftSidebar(parentEl) {
    this.sidebarEl = parentEl.createDiv({ cls: 'tw-harness-kb-sidebar' });
    if (this.isSidebarCollapsed) {
      this.sidebarEl.addClass('is-collapsed');
    } else {
      this.sidebarEl.style.width = `${this.sidebarWidth}px`;
    }

    const vaultPath = this.app?.vault?.adapter?.basePath || 'D:\\work\\Mgmt\\TabonKB';
    const vaultName = (vaultPath.split(/[\\/]/).filter(Boolean).pop()) || 'TabonKB';

    // 头部: 知识库标题 + 折叠按钮
    const header = this.sidebarEl.createDiv({ cls: 'tw-harness-sb-header' });
    const titleBox = header.createDiv({ cls: 'tw-harness-sb-titlebox' });
    titleBox.innerHTML = `
      <div class="tw-harness-sb-logo" title="当前知识库工作区">${getIconPark('folder', 14)}</div>
      <div class="tw-harness-sb-title">${escapeHtml(vaultName)}</div>
    `;

    const btnCollapse = header.createEl('button', {
      cls: 'tw-harness-sb-collapse-btn',
      title: '折叠左侧上下文面板'
    });
    btnCollapse.innerHTML = getIconPark('left', 12);
    btnCollapse.onclick = () => this.toggleSidebar(true);

    // 路径卡片 (点击复制)
    const pathChip = this.sidebarEl.createDiv({
      cls: 'tw-harness-path-chip',
      title: '点击复制当前知识库绝对路径'
    });
    pathChip.innerHTML = `
      <span class="tw-harness-path-icon">${getIconPark('target', 11)}</span>
      <span class="tw-harness-path-text">${escapeHtml(vaultPath)}</span>
      <span class="tw-harness-path-copy">${getIconPark('copy', 11)}</span>
    `;
    pathChip.onclick = async () => {
      try {
        await navigator.clipboard.writeText(vaultPath);
        new NoticeCls('✓ 已复制知识库根路径: ' + vaultPath, 2000);
      } catch (_) {}
    };

    // 分组 1: MCP 插件动态挂载状态 (6大工具)
    const secMcp = this.sidebarEl.createDiv({ cls: 'tw-harness-sb-section' });
    secMcp.innerHTML = `<div class="tw-harness-sb-sec-title">${getIconPark('sliders', 12)} <span>工程 MCP 联动</span></div>`;

    const mcpList = secMcp.createDiv({ cls: 'tw-harness-mcp-list' });
    const mcps = [
      { id: 'vendor', name: '芯片平台', desc: 'MTK / 展锐原厂检索', icon: 'cpu' },
      { id: 'weknora', name: 'WeKnora', desc: 'Wiki RAG 知识检索', icon: 'database' },
      { id: 'opengrok', name: 'OpenGrok', desc: '源码符号毫秒检索', icon: 'search' },
      { id: 'gerrit', name: 'Gerrit', desc: '代码评审与变更追踪', icon: 'check-circle' },
      { id: 'drawio', name: 'DrawIO', desc: '架构图表与流程可视化', icon: 'pic' },
      { id: 'codegraph', name: 'CodeGraph', desc: '代码依赖与语义图谱', icon: 'network' }
    ];

    for (const m of mcps) {
      const item = mcpList.createDiv({ cls: 'tw-harness-mcp-item', title: `${m.name} - ${m.desc}` });
      item.innerHTML = `
        <span class="tw-harness-mcp-dot"></span>
        <span class="tw-harness-mcp-icon">${getIconPark(m.icon, 12)}</span>
        <span class="tw-harness-mcp-name">${m.name}</span>
        <span class="tw-harness-mcp-badge">就绪</span>
      `;
    }

    // 分组 2: 活跃笔记 / 资产上下文
    const secDoc = this.sidebarEl.createDiv({ cls: 'tw-harness-sb-section' });
    secDoc.innerHTML = `<div class="tw-harness-sb-sec-title">${getIconPark('file-text', 12)} <span>活跃笔记上下文</span></div>`;
    this.docCapsuleEl = secDoc.createDiv({ cls: 'tw-harness-doc-capsule' });
    this.updateActiveDocContext();

    // 分组 3: 研发 Prompt 快捷指令
    const secPrompts = this.sidebarEl.createDiv({ cls: 'tw-harness-sb-section' });
    secPrompts.innerHTML = `<div class="tw-harness-sb-sec-title">${getIconPark('lightning', 12)} <span>研发快捷指令</span></div>`;

    const chipsWrap = secPrompts.createDiv({ cls: 'tw-harness-prompt-chips' });
    const prompts = [
      { label: '知识库架构总结', prompt: '请基于当前 TabonKB 知识库目录结构，梳理主要技术模块与核心架构。' },
      { label: '检索芯片平台文档', prompt: '请调用 vendor_portal MCP 检索 MTK / 展锐平台关于 Android 驱动与 BSP 相关技术文档。' },
      { label: 'Gerrit 变更自检', prompt: '请调用 gerrit MCP 工具查询近期待评审的代码变更并生成摘要报告。' },
      { label: 'WeKnora 知识同步', prompt: '请调用 weknora MCP 自检当前知识库同步状态与索引文档数量。' }
    ];

    for (const p of prompts) {
      const chip = chipsWrap.createEl('button', {
        cls: 'tw-harness-prompt-chip',
        title: '点击复制提示词，在右侧 Harness 中直接粘贴发送'
      });
      chip.innerHTML = `
        <span class="tw-harness-chip-icon">${getIconPark('send', 10)}</span>
        <span class="tw-harness-chip-label">${escapeHtml(p.label)}</span>
      `;
      chip.onclick = async () => {
        try {
          await navigator.clipboard.writeText(p.prompt);
          new NoticeCls('✓ 已复制提示词，可在右侧 Harness 对话框中粘贴发送', 2500);
        } catch (_) {}
      };
    }
  }

  updateActiveDocContext() {
    if (!this.docCapsuleEl) return;
    const activeFile = this.app?.workspace?.getActiveFile?.();
    if (activeFile) {
      const name = activeFile.basename || activeFile.name;
      const relPath = activeFile.path;
      this.docCapsuleEl.innerHTML = `
        <div class="tw-harness-doc-item" title="点击复制相对路径: ${escapeHtml(relPath)}">
          <div class="tw-harness-doc-name">${escapeHtml(name)}</div>
          <div class="tw-harness-doc-path">${escapeHtml(relPath)}</div>
        </div>
      `;
      this.docCapsuleEl.onclick = async () => {
        try {
          await navigator.clipboard.writeText(relPath);
          new NoticeCls('✓ 已复制当前笔记路径: ' + relPath, 2000);
        } catch (_) {}
      };
    } else {
      this.docCapsuleEl.innerHTML = `
        <div class="tw-harness-doc-empty">
          <span>当前未打开具体笔记</span>
        </div>
      `;
    }
  }

  renderResizer(parentEl) {
    this.resizerEl = parentEl.createDiv({ cls: 'tw-harness-resizer' });
    this.resizerEl.setAttribute('title', '拖拽调整侧栏宽度 / 双击折叠');
    if (this.isSidebarCollapsed) this.resizerEl.style.display = 'none';

    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e) => {
      startX = e.clientX;
      startWidth = this.sidebarWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      this._boundOnMouseMove = onMouseMove;
      this._boundOnMouseUp = onMouseUp;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      const delta = e.clientX - startX;
      let newW = startWidth + delta;
      if (newW < 180) newW = 180;
      if (newW > 450) newW = 450;
      this.sidebarWidth = newW;
      if (this.sidebarEl && !this.isSidebarCollapsed) {
        this.sidebarEl.style.width = `${newW}px`;
      }
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', this._boundOnMouseMove);
      window.removeEventListener('mouseup', this._boundOnMouseUp);
      this._boundOnMouseMove = null;
      this._boundOnMouseUp = null;
      this.saveSidebarWidth(this.sidebarWidth);
    };

    this.resizerEl.addEventListener('mousedown', onMouseDown);
    this.resizerEl.ondblclick = () => {
      this.toggleSidebar(!this.isSidebarCollapsed);
    };
  }

  toggleSidebar(collapse) {
    this.isSidebarCollapsed = (typeof collapse === 'boolean') ? collapse : !this.isSidebarCollapsed;
    this.saveSidebarCollapsed(this.isSidebarCollapsed);

    if (this.sidebarEl) {
      if (this.isSidebarCollapsed) {
        this.sidebarEl.addClass('is-collapsed');
        this.sidebarEl.style.width = '0px';
        if (this.resizerEl) this.resizerEl.style.display = 'none';
        if (this.btnExpandSidebar) this.btnExpandSidebar.style.display = 'inline-flex';
      } else {
        this.sidebarEl.removeClass('is-collapsed');
        this.sidebarEl.style.width = `${this.sidebarWidth}px`;
        if (this.resizerEl) this.resizerEl.style.display = 'block';
        if (this.btnExpandSidebar) this.btnExpandSidebar.style.display = 'none';
      }
    }

    return this.toggleDshNativeSidebar(this.isSidebarCollapsed);
  }

  toggleDshNativeSidebar(collapse) {
    try {
      const doc = this.iframeEl?.contentDocument || this.iframeEl?.contentWindow?.document;
      if (doc) {
        const toggleBtn = doc.querySelector('button[class*="_toggle"]') || 
                          doc.querySelector('.hHd-Xa_toggle') ||
                          doc.querySelector('button[aria-label*="侧栏"]') ||
                          doc.querySelector('button[aria-label*="sidebar"]');
        if (toggleBtn) {
          const appFrame = doc.querySelector('[class*="_frame"]');
          const isCollapsed = appFrame ? (appFrame.hasAttribute('data-sidebar-collapsed') || !!doc.querySelector('[class*="_root"][class*="_collapsed"]')) : false;
          if (typeof collapse === 'boolean') {
            if (collapse !== isCollapsed) {
              toggleBtn.click();
            }
          } else {
            toggleBtn.click();
          }
          return true;
        }
      }
    } catch (_) {}

    try {
      if (this.iframeEl?.contentWindow) {
        this.iframeEl.contentWindow.postMessage({
          type: 'tabonkb-dsh-toggle-sidebar',
          collapse: collapse
        }, '*');
        return true;
      }
    } catch (_) {}
    return false;
  }

  renderRightPane(parentEl) {
    this.mainPaneEl = parentEl.createDiv({ cls: 'tw-harness-main-pane' });

    // 1. 顶部微工具条已按极简规范彻底移除（消弭视觉噪音，全面沉浸式呈现对话视窗）
    this.toolbarEl = null;
    this.statusBadgeEl = null;
    this.statusBadgeText = null;
    this.btnMcpStatus = null;

    // 2. 主视窗容器 (iframe + loading + error)
    this.frameWrap = this.mainPaneEl.createDiv({ cls: 'tw-dsh-studio-frame-wrap' });

    this.loadingEl = this.frameWrap.createDiv({ cls: 'tw-dsh-studio-loading' });
    this.loadingEl.innerHTML = `
      <div class="tw-dsh-spinner"></div>
      <div class="tw-dsh-loading-text">正在连接 DeepSeek Harness 智能工作台...</div>
    `;

    this.iframeEl = this.frameWrap.createEl('iframe', { cls: 'tw-dsh-studio-iframe' });
    this.iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write');
    this.iframeEl.onload = () => {
      // R6: about:blank 占位帧不结束加载态, 避免刷新瞬间闪断 spinner
      const curSrc = this.iframeEl?.getAttribute('src') || '';
      if (curSrc === 'about:blank') return;
      this.setLoading(false);
      this.injectCustomStyles();

      // DSH 原生侧栏默认隐藏/折叠 (首屏收起为 56px 图标轨, 保持会话舞台最大化)
      setTimeout(() => {
        try {
          const doc = this.iframeEl?.contentDocument || this.iframeEl?.contentWindow?.document;
          if (doc) {
            const appFrame = doc.querySelector('[class*="_frame"]');
            const isCollapsed = appFrame ? (appFrame.hasAttribute('data-sidebar-collapsed') || !!doc.querySelector('[class*="_root"][class*="_collapsed"]')) : false;
            if (!isCollapsed) {
              const toggleBtn = doc.querySelector('button[class*="_toggle"]') || doc.querySelector('.hHd-Xa_toggle');
              if (toggleBtn) toggleBtn.click();
            }
          }
        } catch (_) {}
      }, 150);
    };
  }

  syncThemeToIframe() {
    try {
      const p = this.plugin || (this.app?.plugins?.plugins?.['tabonkb-workbench']);
      if (typeof TabonKBThemeEngine !== 'undefined' && p && p.settings) {
        TabonKBThemeEngine.syncDshSkinStorage(
          p.settings.workbenchTheme || 'fresh',
          p.settings.workbenchWallpaper || 'aurora',
          p
        );
      }
    } catch (_) {}
  }

  injectCustomStyles() {
    this.syncThemeToIframe();
    setTimeout(() => this.syncThemeToIframe(), 200);
    setTimeout(() => this.syncThemeToIframe(), 650);
    try {
      const doc = this.iframeEl?.contentDocument || this.iframeEl?.contentWindow?.document;
      if (!doc || !doc.head) return;
      // 方案A: 与守护进程保持一致 —— UI 定制默认关闭 (回归 DSH 原生 Grid 布局),
      // 仅 dsh.layoutTweaks 显式 true 时才注入哈希样式
      const layoutTweaksOn = !!(this.plugin && this.plugin.settings && this.plugin.settings.dsh && this.plugin.settings.dsh.layoutTweaks === true);
      let css = '';
      if (typeof getDshCustomStyles === 'function') {
        css = getDshCustomStyles(layoutTweaksOn);
      } else {
        try {
          const dshMgr = require('../services/dsh-daemon-manager.js');
          css = dshMgr.getDshCustomStyles ? dshMgr.getDshCustomStyles(layoutTweaksOn) : '';
        } catch (_) {}
      }
      if (css) {
        let style = doc.getElementById('tabonkb-dsh-overrides');
        if (!style) {
          style = doc.createElement('style');
          style.id = 'tabonkb-dsh-overrides';
          doc.head.appendChild(style);
        }
        style.textContent = css;
        // 方案A: 定制关闭时清除历史注入的覆盖样式, 确保立即回归原生 Grid 布局
        const stale = doc.getElementById('tabonkb-dsh-overrides');
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      }

      // 确保原生侧栏折叠态彻底隐藏样式生效 (消除 56px 冗余图标轨)
      let hideStyle = doc.getElementById('tabonkb-dsh-sidebar-hide');
      if (!hideStyle) {
        let hideCss = '';
        if (typeof getDshSidebarHideStyles === 'function') {
          hideCss = getDshSidebarHideStyles();
        } else {
          try {
            const dshMgr = require('../services/dsh-daemon-manager.js');
            hideCss = dshMgr.getDshSidebarHideStyles ? dshMgr.getDshSidebarHideStyles() : '';
          } catch (_) {}
        }
        if (!hideCss) {
          hideCss = `
div[data-sidebar-collapsed] {
  grid-template-columns: 0px minmax(0px, 1fr) auto !important;
}
div[data-sidebar-collapsed] > div[class*="_sidebarCol"],
div[data-sidebar-collapsed] .hHd-Xa_root,
div[data-sidebar-collapsed] div[class*="_root"][class*="_collapsed"] {
  width: 0px !important;
  min-width: 0px !important;
  max-width: 0px !important;
  flex: 0 0 0px !important;
  overflow: hidden !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
          `.trim();
        }
        hideStyle = doc.createElement('style');
        hideStyle.id = 'tabonkb-dsh-sidebar-hide';
        hideStyle.textContent = hideCss;
        doc.head.appendChild(hideStyle);
      }

      // 双重防护：注入文件点击与提及捕获脚本 (Bridge)
      let script = doc.getElementById('tabonkb-dsh-file-bridge');
      if (!script) {
        let bridgeJs = '';
        if (typeof getDshFileBridgeScript === 'function') {
          bridgeJs = getDshFileBridgeScript();
        } else {
          try {
            const dshMgr = require('../services/dsh-daemon-manager.js');
            bridgeJs = dshMgr.getDshFileBridgeScript ? dshMgr.getDshFileBridgeScript() : '';
          } catch (_) {}
        }
        if (bridgeJs) {
          script = doc.createElement('script');
          script.id = 'tabonkb-dsh-file-bridge';
          script.textContent = bridgeJs;
          (doc.head || doc.body).appendChild(script);
        }
      }

      // 「+」菜单工程上下文桥 (与代理层注入互为冗余, 覆盖 iframe 直达加载场景)
      let ctxScript = doc.getElementById('tabonkb-dsh-ctx-bridge');
      if (ctxScript) {
        try { ctxScript.remove(); } catch (_) {}
      }
      let ctxJs = '';
      if (typeof getDshContextBridgeScript === 'function') {
        ctxJs = getDshContextBridgeScript();
      } else {
        try {
          const dshMgr = require('../services/dsh-daemon-manager.js');
          ctxJs = dshMgr.getDshContextBridgeScript ? dshMgr.getDshContextBridgeScript() : '';
        } catch (_) {}
      }
      if (ctxJs) {
        ctxScript = doc.createElement('script');
        ctxScript.id = 'tabonkb-dsh-ctx-bridge';
        ctxScript.textContent = ctxJs;
        (doc.head || doc.body).appendChild(ctxScript);
      }
    } catch (_) {}
  }

  // ---- DSH 工程上下文: 按 DSH 会话 id 分桶独立持久化 (与 pi 会话生命周期彻底解耦) ----

  _normalizeDshSid(sid) {
    const s = (typeof sid === 'string' ? sid : '').trim();
    return s || '__draft__';
  }

  _dshCtxDefaults() {
    return { opengrok: 'auto', gerrit: 'all', jira: null, localproj: null };
  }

  _dshCtxHasSelection(v) {
    return !!(v && typeof v === 'object' &&
      ((v.opengrok && v.opengrok !== 'auto') || (v.gerrit && v.gerrit !== 'all') ||
       (v.jira && v.jira.key) || (v.localproj && v.localproj.id)));
  }

  /** 旧版共享键快照 (仅供一次性迁移种子; pi 会话键此后归 pi 独占, DSH 不再读写) */
  _legacyDshCtxValues() {
    const ls = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
    let jira = null, lp = null;
    try { jira = JSON.parse(ls('tabonkb-jira-selected-issue') || 'null'); } catch (_) {}
    try { lp = JSON.parse(ls('tabonkb-local-selected-project') || 'null'); } catch (_) {}
    return {
      opengrok: ls('tabonkb-opengrok-selected-project') || 'auto',
      gerrit: ls('tabonkb-gerrit-selected-filter') || 'all',
      jira: (jira && jira.key) ? jira : null,
      localproj: (lp && lp.id) ? lp : null
    };
  }

  _readDshCtxMap() {
    let map = null;
    try { map = JSON.parse(localStorage.getItem('tabonkb-dsh-ctx-map-v1') || 'null'); } catch (_) {}
    if (!map || typeof map !== 'object') {
      map = {};
      // 一次性迁移: 旧全局共享键 → 草稿桶; __migrated 哨兵保证只执行一次
      try {
        if (!localStorage.getItem('tabonkb-dsh-ctx-migrated')) {
          const legacy = this._legacyDshCtxValues();
          if (this._dshCtxHasSelection(legacy)) map.__draft__ = legacy;
          localStorage.setItem('tabonkb-dsh-ctx-migrated', '1');
        }
      } catch (_) {}
      this._writeDshCtxMap(map);
    }
    return map;
  }

  _writeDshCtxMap(map) {
    try {
      // LRU 裁剪: 至多保留 150 个会话桶 (__draft__/__last 等元键除外)
      const keys = Object.keys(map).filter(k => !k.startsWith('__'));
      if (keys.length > 150) {
        keys.sort((a, b) => (map[a]._t || 0) - (map[b]._t || 0));
        for (let i = 0; i < keys.length - 150; i++) delete map[keys[i]];
      }
      localStorage.setItem('tabonkb-dsh-ctx-map-v1', JSON.stringify(map));
    } catch (_) {}
  }

  /** 草稿态选择的上下文迁移: 草稿发出首条消息产生会话 uuid 后, 绑定随人走 */
  _migrateDshDraftTo(skey) {
    try {
      if (!skey || skey === '__draft__') return;
      const map = this._readDshCtxMap();
      if (map.__last !== '__draft__') return;      // 仅草稿→新会话的直接转变才迁移
      if (map[skey]) return;                        // 目标桶已存在 (含显式空) 不覆盖
      const draft = map.__draft__;
      if (!this._dshCtxHasSelection(draft)) return;
      map[skey] = Object.assign({}, draft, { _t: Date.now() });
      map.__draft__ = this._dshCtxDefaults();
      this._writeDshCtxMap(map);
      this._mirrorDshCtxToAgent(map[skey], skey);
    } catch (_) {}
  }

  /** 读取指定 DSH 会话的四项工程上下文 (无桶 → 默认未选) */
  getDshCtxState(sid) {
    const skey = this._normalizeDshSid(sid);
    const map = this._readDshCtxMap();
    const e = map[skey];
    const d = this._dshCtxDefaults();
    if (!e || typeof e !== 'object') return d;
    const lp = (e.localproj && e.localproj.id) ? e.localproj : null;
    if (lp && !lp.priDriverRel && lp.platform && lp.project) {
      lp.priDriverRel = `pri_project/driver/${lp.platform}/${lp.project}/base`;
      lp.publicDriverRel = 'pri_project/driver/public';
    }
    return {
      opengrok: e.opengrok || 'auto',
      gerrit: e.gerrit || 'all',
      jira: (e.jira && e.jira.key) ? e.jira : null,
      localproj: lp
    };
  }

  /**
   * 构造 Jira 工单与本地工程的可选清单 (与抽屉面板同源):
   * - Jira: jiraService 内存缓存 → tabonkb-jira-cache-v1 → 趋势缓存
   * - 本地工程: local-project-service 扁平缓存 (磁盘 local-projects-cache.json 兜底)
   */
  getDshCtxLists() {
    let jira = [];
    try {
      const js = this.plugin?.jiraService;
      let issues = js?._cache?.issues;
      if (!issues || !issues.length) {
        const raw = localStorage.getItem('tabonkb-jira-cache-v1');
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) issues = parsed;
      }
      if ((!issues || !issues.length) && js?._trendCache?.issues) issues = js._trendCache.issues;
      if ((!issues || !issues.length) && typeof js?.getTrendCacheKeys === 'function') {
        const ks = js.getTrendCacheKeys();
        const rawTrend = localStorage.getItem(ks.data);
        const parsedTrend = rawTrend ? JSON.parse(rawTrend) : null;
        if (Array.isArray(parsedTrend)) issues = parsedTrend;
      }
      jira = (issues || []).slice(0, 120).map(i => ({
        key: i.key || '',
        summary: i.summary || '',
        status: i.status || '',
        priority: i.priority || '',
        assignee: i.assignee || i.assigneeName || '',
        url: i.url || ''
      })).filter(i => i.key);
    } catch (_) {}

    let localproj = [];
    try {
      if (typeof getAllAvailableLocalProjects === 'function') {
        localproj = getAllAvailableLocalProjects(false) || [];
      }
      if (!localproj.length) {
        const basePath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
        const cachePath = path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'local-projects-cache.json');
        if (fs.existsSync(cachePath)) {
          const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          if (Array.isArray(parsed)) localproj = parsed;
        }
      }
    } catch (_) {}
    return { jira, localproj };
  }

  /**
   * 向 DSH iframe 推送上下文状态。
   * @param {boolean} withLists 是否附带 Jira/本地工程候选清单 (913 项 ~600KB)，
   *   仅菜单打开/iframe ready 时全量推送；选择落盘回执只推 values。
   */
  sendDshCtxState(withLists = true) {
    try {
      const win = this.iframeEl && this.iframeEl.contentWindow;
      if (!win) return;
      const skey = this._normalizeDshSid(this._dshSid);
      const msg = { type: 'tabonkb-dsh-ctx-state', sid: skey, values: this.getDshCtxState(skey) };
      if (withLists) msg.lists = this.getDshCtxLists();
      win.postMessage(msg, '*');
    } catch (_) {}
  }

  /**
   * 应用来自 Harness「+」菜单的上下文选择。
   * 抽屉存活时委托其 save* 系列方法 (内部完成 localStorage/env/胶囊刷新),
   * 否则直接写入同一组键, 保证两侧一致。
   */
  /**
   * 应用来自 Harness「+」菜单的上下文选择: 写入该 DSH 会话的独立桶,
   * 并镜像到 agent 实时通道 (process.env 供 daemon/MCP 链路, active-context.json 供运行中扩展按调用读取)。
   * 不再触碰 pi 共享 localStorage 键 —— 两侧上下文彻底解耦。
   */
  applyDshCtxSelection(key, value, sid) {
    const skey = this._normalizeDshSid(sid);
    let label = '';
    try {
      const map = this._readDshCtxMap();
      const cur = this.getDshCtxState(skey);
      if (key === 'opengrok') {
        cur.opengrok = (value && value !== 'auto') ? String(value) : 'auto';
        label = `✓ OpenGrok: ${cur.opengrok === 'auto' ? 'Auto' : cur.opengrok}`;
      } else if (key === 'gerrit') {
        cur.gerrit = value || 'all';
        label = '✓ Gerrit 已更新';
      } else if (key === 'jira') {
        cur.jira = (value && value.key) ? {
          key: value.key, summary: value.summary || '', status: value.status || '',
          priority: value.priority || '', assignee: value.assignee || '', url: value.url || ''
        } : null;
        label = cur.jira ? `✓ Jira: ${cur.jira.key}` : '✓ 已清除 Jira 绑定';
      } else if (key === 'localproj') {
        cur.localproj = (value && value.id) ? value : null;
        label = cur.localproj ? `✓ 本地工程: ${cur.localproj.label || cur.localproj.project}` : '✓ 已清除本地工程';
      } else {
        return;
      }
      cur._t = Date.now();
      map[skey] = cur;
      map.__last = skey;
      this._dshSid = skey;
      this._writeDshCtxMap(map);
      this._mirrorDshCtxToAgent(cur);
    } catch (_) {}
    this.sendDshCtxState(false);
    if (label) { try { new NoticeCls(label, 1800); } catch (_) {} }
  }

  /**
   * 新对话开始: 仅重置草稿桶 (__draft__), 历史会话桶不受影响;
   * env/文件镜像同步回到未选中态。
   */
  resetDshCtxSelections() {
    try {
      const map = this._readDshCtxMap();
      const d = this._dshCtxDefaults();
      map.__draft__ = d;
      map.__last = '__draft__';
      this._dshSid = '__draft__';
      this._writeDshCtxMap(map);
      this._mirrorDshCtxToAgent(d);
      try { new NoticeCls('✓ 新对话: 上下文已重置', 1600); } catch (_) {}
    } catch (_) {}
    this.sendDshCtxState(false);
  }

  /** 将指定 DSH 会话上下文镜像到 agent 实时通道 (env + active-context.json) */
  _mirrorDshCtxToAgent(v, sid) {
    const vals = v || this._dshCtxDefaults();
    const skey = this._normalizeDshSid(sid || this._dshSid);
    try {
      if (vals.opengrok && vals.opengrok !== 'auto') process.env.OPENGROK_DEFAULT_PROJECT = vals.opengrok;
      else delete process.env.OPENGROK_DEFAULT_PROJECT;
      if (vals.gerrit && vals.gerrit !== 'all') process.env.TABONKB_GERRIT_FILTER = vals.gerrit;
      else delete process.env.TABONKB_GERRIT_FILTER;
      if (vals.jira && vals.jira.key) process.env.TABONKB_JIRA_ISSUE_JSON = JSON.stringify(vals.jira);
      else delete process.env.TABONKB_JIRA_ISSUE_JSON;
      if (vals.localproj && vals.localproj.id) process.env.TABONKB_LOCAL_PROJECT_JSON = JSON.stringify(vals.localproj);
      else delete process.env.TABONKB_LOCAL_PROJECT_JSON;
    } catch (_) {}
    try {
      const fs = require('fs');
      const path = require('path');
      const basePath = this.app?.vault?.adapter?.basePath || (typeof process !== 'undefined' ? process.cwd() : '');
      if (!basePath) return;
      const target = path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'active-context.json');
      const payload = {
        selectedLocalProject: vals.localproj || null,
        selectedJiraIssue: vals.jira || null,
        selectedProject: vals.opengrok || 'auto',
        selectedGerritFilter: vals.gerrit || 'all',
        source: 'dsh',
        sid: skey,
        updatedAt: Date.now()
      };
      // state-req 随 bridge 轮询高频触发: 同值跳过写盘 —— 先读现文件比对四字段+sid,
      // 内容一致则直接返回 (pi 侧覆写后内容不同会重新落盘, 自愈并发覆盖)
      try {
        const cur = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (cur &&
          JSON.stringify(cur.selectedLocalProject || null) === JSON.stringify(payload.selectedLocalProject) &&
          JSON.stringify(cur.selectedJiraIssue || null) === JSON.stringify(payload.selectedJiraIssue) &&
          (cur.selectedProject || 'auto') === payload.selectedProject &&
          (cur.selectedGerritFilter || 'all') === payload.selectedGerritFilter &&
          cur.sid === payload.sid && cur.source === 'dsh') {
          return;
        }
      } catch (_) {}
      fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * 解析并在右侧打开知识库文件 (用户点击 DSH 蓝色文件名时响应)
   * 采用四级级联匹配:
   * 1. 相对路径精确匹配
   * 2. metadataCache 智能链接解析 (Obsidian 原生)
   * 3. 全库文件名 (basename) 及尾部路径模糊匹配 (解决 AI 省略上层目录)
   * 4. 核心词/架构图模糊匹配 (解决 AI 微小命名偏差，如 UFCS架构图 vs UFCS识别流程)
   *
   * 分栏与标签页行为优化:
   * - 目标文件若已在某个叶子节点打开，直接激活聚焦，不重复创建；
   * - 目标文件未打开时：若右侧已存在打开的文件栏，在该栏中以「新增标签页」形式打开，避免横向持续裂开多栏；
   * - 若右侧尚无任何文件栏，则切出首个右侧垂直分栏。
   */
  async handleOpenFile(pathOrName, line = 0) {
    if (!this.app || !pathOrName) return;

    try {
      const targetFile = this.resolveVaultFile(pathOrName);
      if (!targetFile) {
        new NoticeCls(`⚠️ 知识库中未找到文件: ${pathOrName}`, 3000);
        return;
      }

      // 收集主工作区中除了当前工作台以外的所有可用叶子节点
      const candidateLeaves = [];
      if (typeof this.app.workspace?.iterateRootLeaves === 'function') {
        this.app.workspace.iterateRootLeaves(leaf => {
          if (leaf && leaf !== this.leaf && leaf.view?.getViewType?.() !== 'tabonkb-workbench-view') {
            candidateLeaves.push(leaf);
          }
        });
      }
      if (candidateLeaves.length === 0 && this.app.workspace?.getLeavesOfType) {
        const types = ['markdown', 'pdf', 'drawio', 'image', 'canvas', 'empty'];
        for (const t of types) {
          const list = this.app.workspace.getLeavesOfType(t) || [];
          for (const l of list) {
            if (l && l !== this.leaf && l.view?.getViewType?.() !== 'tabonkb-workbench-view' && !candidateLeaves.includes(l)) {
              candidateLeaves.push(l);
            }
          }
        }
      }

      // 1. 若目标文件已在某个标签页打开，直接切换聚焦
      const existingLeaf = candidateLeaves.find(l => l.view?.file?.path === targetFile.path);
      if (existingLeaf) {
        if (this.app.workspace?.setActiveLeaf) {
          this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
        }
        if (line > 0 && existingLeaf.view?.setEphemeralState) {
          existingLeaf.view.setEphemeralState({ line: line - 1 });
        }
        new NoticeCls(`✓ 已切换至已打开标签页: ${targetFile.path}`, 2500);
        return;
      }

      // 2. 若右侧有未加载内容的空标签页，优先复用
      const emptyLeaf = candidateLeaves.find(l => l.view?.getViewType?.() === 'empty');
      if (emptyLeaf && emptyLeaf.openFile) {
        await emptyLeaf.openFile(targetFile, { active: true });
        if (line > 0 && emptyLeaf.view?.setEphemeralState) {
          emptyLeaf.view.setEphemeralState({ line: line - 1 });
        }
        if (this.app.workspace?.setActiveLeaf) {
          this.app.workspace.setActiveLeaf(emptyLeaf, { focus: true });
        }
        new NoticeCls(`✓ 已在右侧打开: ${targetFile.path}`, 2500);
        return;
      }

      // 3. 目标文件未打开：
      //    如果右侧已打开过文件，在右侧已有的分栏 (Tab Group) 中新增标签页，不再横向开辟新分栏
      let targetLeaf = null;
      if (candidateLeaves.length > 0) {
        const refLeaf = candidateLeaves[candidateLeaves.length - 1];
        if (refLeaf?.parent && typeof this.app.workspace?.createLeafInParent === 'function') {
          const idx = Array.isArray(refLeaf.parent.children) ? refLeaf.parent.children.length : -1;
          targetLeaf = this.app.workspace.createLeafInParent(refLeaf.parent, idx);
        }
        if (!targetLeaf && this.app.workspace?.getLeaf) {
          if (this.app.workspace?.setActiveLeaf) {
            this.app.workspace.setActiveLeaf(refLeaf);
          }
          targetLeaf = this.app.workspace.getLeaf('tab');
        }
      }

      // 4. 若右侧完全没有任何分栏，则首次垂直分栏打开
      if (!targetLeaf && this.app.workspace?.getLeaf) {
        targetLeaf = this.app.workspace.getLeaf('split', 'vertical');
      }

      if (targetLeaf?.openFile) {
        await targetLeaf.openFile(targetFile, { active: true });
        if (line > 0 && targetLeaf.view?.setEphemeralState) {
          targetLeaf.view.setEphemeralState({ line: line - 1 });
        }
        if (this.app.workspace?.setActiveLeaf) {
          this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
        }
        new NoticeCls(`✓ 已在右侧标签页打开: ${targetFile.path}`, 2500);
      }
    } catch (err) {
      console.warn('[DSH] handleOpenFile error:', err);
      new NoticeCls(`⚠️ 打开文件失败: ${err.message}`, 3000);
    }
  }

  resolveVaultFile(pathOrName) {
    if (!this.app?.vault || !pathOrName) return null;
    const clean = pathOrName.replace(/\\/g, '/').replace(/^\.?\//, '').trim();

    // 1. 绝对相对路径精确命中
    if (this.app.vault.getAbstractFileByPath) {
      let file = this.app.vault.getAbstractFileByPath(clean);
      if (file && !file.children) return file;
    }

    // 2. Obsidian 缓存链接检索
    if (this.app.metadataCache?.getFirstLinkpathDest) {
      let file = this.app.metadataCache.getFirstLinkpathDest(clean, '');
      if (file) return file;
    }

    // 3. 全库文件比对
    const allFiles = this.app.vault.getFiles ? this.app.vault.getFiles() : [];
    if (!allFiles.length) return null;

    const lowerClean = clean.toLowerCase();
    const fileNameOnly = clean.split('/').pop().toLowerCase();

    // 3.1 尾部路径匹配 (例如 "06-Spec-Ref/INDEX.md")
    let match = allFiles.find(f => f.path && f.path.toLowerCase().endsWith(lowerClean));
    if (match) return match;

    // 3.2 纯文件名精确匹配 (例如 "INDEX-Spec.md")
    match = allFiles.find(f => f.name && f.name.toLowerCase() === fileNameOnly);
    if (match) return match;

    // 3.3 无扩展名匹配 (例如同名 .md 或 .drawio 或 .png)
    const baseNoExt = fileNameOnly.replace(/\.[^.]+$/, '');
    match = allFiles.find(f => f.basename && f.basename.toLowerCase() === baseNoExt);
    if (match) return match;

    // 3.4 语义/分词重合度模糊匹配 (解决如 "2026-09-26-UFCS架构图" 匹配 "2026-09-26-UFCS识别流程.drawio")
    const extractTokens = (str) => {
      const s = (str || '').toLowerCase();
      const latin = s.match(/[a-z0-9]+/g) || [];
      const cjk = s.match(/[\u4e00-\u9fa5]+/g) || [];
      const cjkGrams = [];
      for (const seg of cjk) {
        if (seg.length <= 2) {
          cjkGrams.push(seg);
        } else {
          for (let i = 0; i < seg.length - 1; i++) cjkGrams.push(seg.slice(i, i + 2));
        }
      }
      return [...new Set([...latin, ...cjk, ...cjkGrams])].filter(t => t.length >= 2);
    };

    const qTokens = extractTokens(fileNameOnly);
    if (qTokens.length > 0) {
      let bestMatch = null;
      let maxScore = 0;
      for (const f of allFiles) {
        const fTokens = new Set(extractTokens(f.name));
        let score = 0;
        for (const t of qTokens) {
          if (fTokens.has(t)) score++;
        }
        if (score >= 2 && score > maxScore) {
          maxScore = score;
          bestMatch = f;
        }
      }
      if (bestMatch) return bestMatch;
    }

    return null;
  }

  toggleMcpPopover(triggerBtn) {
    if (this.mcpPopoverEl) {
      this.closeMcpPopover();
      return;
    }

    if (!this.toolbarEl) return;

    this.btnMcpStatus?.addClass('is-active');

    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
    const vaultName = (vaultPath.split(/[\\/]/).filter(Boolean).pop()) || 'TabonKB';

    const popover = this.toolbarEl.createDiv({ cls: 'tw-harness-mcp-popover' });
    this.mcpPopoverEl = popover;

    // 阻止内部点击冒泡，避免触发外部监听器
    popover.onclick = (e) => e.stopPropagation();

    // 头部: 标题 + 统计徽章 + 关闭按钮
    const header = popover.createDiv({ cls: 'tw-harness-popover-header' });
    header.innerHTML = `
      <div class="tw-harness-popover-title">
        <span class="tw-harness-popover-title-icon">${getIconParkFn('sliders', 13)}</span>
        <span>工程 MCP 联动</span>
      </div>
      <div class="tw-harness-popover-head-right">
        <span class="tw-harness-popover-tag">6/6 就绪</span>
        <button class="tw-harness-popover-close-btn" title="关闭 (Esc)">
          ${getIconParkFn('close', 11)}
        </button>
      </div>
    `;

    const closeBtn = header.querySelector('.tw-harness-popover-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeMcpPopover();
    }

    // 6 大 MCP 工具列表
    const list = popover.createDiv({ cls: 'tw-harness-popover-list' });
    const mcps = [
      { id: 'vendor', name: '芯片平台', desc: 'MTK / 展锐原厂知识库', icon: 'cpu' },
      { id: 'weknora', name: 'WeKnora', desc: 'Wiki RAG 知识检索', icon: 'database' },
      { id: 'opengrok', name: 'OpenGrok', desc: '跨工程源码毫秒检索', icon: 'search' },
      { id: 'gerrit', name: 'Gerrit', desc: '代码评审与变更追踪', icon: 'check-circle' },
      { id: 'drawio', name: 'DrawIO', desc: '架构图表与流程可视化', icon: 'pic' },
      { id: 'codegraph', name: 'CodeGraph', desc: '代码依赖与语义拓扑', icon: 'network' }
    ];

    for (const m of mcps) {
      const item = list.createDiv({ cls: 'tw-harness-popover-item', title: `${m.name}: ${m.desc}` });
      item.innerHTML = `
        <span class="tw-harness-mcp-dot"></span>
        <span class="tw-harness-popover-item-icon">${getIconParkFn(m.icon, 12)}</span>
        <div class="tw-harness-popover-item-content">
          <div class="tw-harness-popover-item-title">${escapeHtml(m.name)}</div>
          <div class="tw-harness-popover-item-desc">${escapeHtml(m.desc)}</div>
        </div>
        <span class="tw-harness-popover-item-badge">就绪</span>
      `;
    }

    // 底部: 知识库工作区信息卡片 (点击复制绝对路径)
    const footer = popover.createDiv({
      cls: 'tw-harness-popover-footer',
      title: '点击复制知识库绝对路径'
    });
    footer.innerHTML = `
      <div class="tw-harness-popover-footer-left">
        <span class="tw-harness-popover-footer-icon">${getIconParkFn('folder', 11)}</span>
        <span class="tw-harness-popover-vault-name">${escapeHtml(vaultName)}</span>
        <span class="tw-harness-popover-vault-path">${escapeHtml(vaultPath)}</span>
      </div>
      <span class="tw-harness-popover-copy-icon">${getIconParkFn('copy', 11)}</span>
    `;
    footer.onclick = async () => {
      try {
        await navigator.clipboard.writeText(vaultPath);
        new NoticeCls('✓ 已复制知识库根路径: ' + vaultPath, 2000);
      } catch (_) {}
    };

    // 绑定外部点击与 Esc 键自动关闭
    this._popoverDocClick = (e) => {
      if (this.mcpPopoverEl && !this.mcpPopoverEl.contains(e.target) && !triggerBtn?.contains(e.target)) {
        this.closeMcpPopover();
      }
    };
    this._popoverKeydown = (e) => {
      if (e.key === 'Escape') {
        this.closeMcpPopover();
      }
    };

    setTimeout(() => {
      document.addEventListener('click', this._popoverDocClick);
      document.addEventListener('keydown', this._popoverKeydown);
    }, 10);
  }

  closeMcpPopover() {
    if (this._popoverDocClick) {
      document.removeEventListener('click', this._popoverDocClick);
      this._popoverDocClick = null;
    }
    if (this._popoverKeydown) {
      document.removeEventListener('keydown', this._popoverKeydown);
      this._popoverKeydown = null;
    }
    if (this.mcpPopoverEl) {
      this.mcpPopoverEl.remove();
      this.mcpPopoverEl = null;
    }
    this.btnMcpStatus?.removeClass('is-active');
  }

  setLoading(isLoading, msg) {
    if (!this.loadingEl) return;
    if (isLoading) {
      this.loadingEl.style.display = 'flex';
      const textEl = this.loadingEl.querySelector('.tw-dsh-loading-text');
      if (textEl && msg) textEl.textContent = msg;
    } else {
      this.loadingEl.style.display = 'none';
    }
  }

  updateStatusBadge(status, tooltip = '') {
    if (!this.statusBadgeEl || !this.statusBadgeText) return;
    this.statusBadgeEl.className = 'tw-dsh-badge';

    let label = status;
    if (status === 'running' || status === '就绪') {
      this.statusBadgeEl.addClass('tw-dsh-badge-running');
      label = '就绪';
    } else if (status === 'starting' || status === '启动中') {
      this.statusBadgeEl.addClass('tw-dsh-badge-starting');
      label = '启动中';
    } else if (status === 'error' || status === '异常') {
      this.statusBadgeEl.addClass('tw-dsh-badge-error');
      label = '异常';
    } else {
      this.statusBadgeEl.addClass('tw-dsh-badge-stopped');
      label = '未连接';
    }

    this.statusBadgeText.textContent = label;
    if (tooltip) this.statusBadgeEl.setAttribute('title', tooltip);
  }

  loadIframeUrl(targetUrl) {
    if (!this.iframeEl || !targetUrl) return;
    // R6: 载入成功路径必须先清掉历史错误卡片, 避免"引擎已就绪"与"启动失败"同屏
    this.clearErrorCard();
    const normalized = String(targetUrl).replace(/\/$/, '');
    const cur = String(this.iframeEl.getAttribute('src') || '').replace(/\/$/, '');
    if (cur !== normalized) {
      this.iframeEl.setAttribute('src', targetUrl);
    } else {
      // R6: 同 URL 强制重载 —— 先置 about:blank 再回填, 规避 Chromium 同源 src 赋值不触发导航
      this.setLoading(true, '正在刷新工作区...');
      this.iframeEl.setAttribute('src', 'about:blank');
      setTimeout(() => {
        if (this.iframeEl) this.iframeEl.setAttribute('src', targetUrl);
      }, 50);
    }
  }

  clearErrorCard() {
    // R6: 清除历史错误卡片 (成功连接/重连时必须调用)
    if (!this.frameWrap) return;
    const oldErr = this.frameWrap.querySelector('.tw-dsh-error-box');
    if (oldErr) oldErr.remove();
  }

  connectDaemon() {
    const daemon = this.getDaemonManager();
    if (!daemon) {
      this.setLoading(false);
      this.updateStatusBadge('未连接', '未配置 DSH 守护管理器');
      return;
    }

    // 确保知识库工作区配置写入
    daemon.ensureVaultWorkspace();

    const targetUrl = daemon.studioUrl || daemon.authUrl;
    if (daemon.status === 'running' && targetUrl) {
      this.updateStatusBadge('就绪', `DSH 引擎运行中 (端口: ${daemon.actualPort})`);
      this.loadIframeUrl(targetUrl);
    } else {
      this.setLoading(true, '正在拉起 DeepSeek Harness 引擎...');
      this.updateStatusBadge('启动中', '正在拉起本地守护进程');
      daemon.start().then((ok) => {
        const url = daemon.studioUrl || daemon.authUrl;
        // R1: 以"是否拿到可用 URL"为唯一成功判据 —— start() 返回 false 也可能是
        // 单飞复用(另有调用方在启动)而非真失败, 此时交由 status_change/auth_ready 推进
        if (url) {
          this.loadIframeUrl(url);
        } else if (daemon.status === 'starting' || daemon.status === 'running') {
          // 仍在启动/已运行但 URL 未就绪: 保持加载态等事件回调, 不弹错误卡片
          this.setLoading(true, '正在等待 DSH 引擎就绪...');
          this.updateStatusBadge(daemon.status === 'running' ? '就绪' : '启动中', daemon.statusDetail || '正在拉起本地守护进程');
        } else if (!ok) {
          const err = daemon.lastError || '未能获取鉴权凭证';
          this.setLoading(false);
          this.updateStatusBadge('异常', err);
          this.showErrorCard(err);
        }
      }).catch((err) => {
        this.setLoading(false);
        this.updateStatusBadge('异常', err.message);
        this.showErrorCard(err.message);
      });
    }
  }

  bindDaemonEvents() {
    const daemon = this.getDaemonManager();
    if (!daemon) return;

    this._statusUnsub = (evt) => {
      this.updateStatusBadge(evt.status, evt.detail);
      const url = evt.studioUrl || evt.authUrl;
      if (evt.status === 'running' && url) {
        this.loadIframeUrl(url);
      }
    };
    daemon.on('status_change', this._statusUnsub);

    this._authUnsub = (evt) => {
      const url = evt.studioUrl || evt.authUrl;
      if (url) {
        this.loadIframeUrl(url);
        this.updateStatusBadge('就绪', `已连接 (端口: ${evt.port})`);
      }
    };
    daemon.on('auth_ready', this._authUnsub);
  }

  showErrorCard(errMsg) {
    if (!this.frameWrap) return;
    const oldErr = this.frameWrap.querySelector('.tw-dsh-error-box');
    if (oldErr) oldErr.remove();

    const box = this.frameWrap.createDiv({ cls: 'tw-dsh-error-box' });
    box.innerHTML = `
      <div class="tw-dsh-error-title">⚠️ DSH 引擎启动失败</div>
      <div class="tw-dsh-error-msg">${escapeHtml(errMsg || '未知异常')}</div>
      <div class="tw-dsh-error-actions">
        <button class="tw-dsh-btn-retry">重新连接</button>
      </div>
    `;

    const btnRetry = box.querySelector('.tw-dsh-btn-retry');
    if (btnRetry) {
      btnRetry.onclick = () => {
        box.remove();
        this.handleRestart();
      };
    }
  }

  async handleReload() {
    // R6: 刷新前先清错误卡片, 并重新兑换鉴权 Cookie 后走统一载入路径
    this.clearErrorCard();
    const daemon = this.getDaemonManager();
    const url = daemon?.studioUrl || daemon?.authUrl;
    if (!url) {
      this.connectDaemon();
      return;
    }
    this.setLoading(true, '正在刷新工作区...');
    try {
      if (daemon && typeof daemon.refreshAuthCookie === 'function') {
        await daemon.refreshAuthCookie(url);
      }
    } catch (_) {}
    if (this.iframeEl) {
      this.iframeEl.setAttribute('src', 'about:blank');
      setTimeout(() => {
        if (this.iframeEl) this.iframeEl.setAttribute('src', url);
      }, 50);
    }
  }

  async handleRestart() {
    const daemon = this.getDaemonManager();
    if (!daemon) return;

    this.setLoading(true, '正在重启 DSH 守护进程与 MCP 工具...');
    this.updateStatusBadge('启动中', '正在重启服务');
    try {
      await daemon.restart();
      const url = daemon.studioUrl || daemon.authUrl;
      if (url) {
        this.loadIframeUrl(url);
      }
    } catch (err) {
      this.setLoading(false);
      this.updateStatusBadge('异常', err.message);
      this.showErrorCard(err.message);
    }
  }

  handleExternal() {
    const daemon = this.getDaemonManager();
    const url = daemon?.studioUrl || daemon?.authUrl;
    if (!url) {
      new NoticeCls('DSH 引擎尚未就绪，无法打开浏览器', 2000);
      return;
    }
    try {
      if (typeof electronModule !== 'undefined' && electronModule?.shell?.openExternal) {
        electronModule.shell.openExternal(url);
      } else if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    } catch (_) {
      window.open(url, '_blank');
    }
  }

  dispose() {
    this.closeMcpPopover();

    const daemon = this.getDaemonManager();
    if (daemon) {
      if (this._statusUnsub) daemon.off('status_change', this._statusUnsub);
      if (this._authUnsub) daemon.off('auth_ready', this._authUnsub);
    }
    this._statusUnsub = null;
    this._authUnsub = null;

    if (this._boundOnMouseMove) window.removeEventListener('mousemove', this._boundOnMouseMove);
    if (this._boundOnMouseUp) window.removeEventListener('mouseup', this._boundOnMouseUp);

    if (this._boundOnWindowMessage && typeof window !== 'undefined') {
      window.removeEventListener('message', this._boundOnWindowMessage);
      this._boundOnWindowMessage = null;
    }

    if (this.containerEl) {
      this.containerEl.empty();
      this.containerEl.remove();
      this.containerEl = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DshWorkbenchView };
}
