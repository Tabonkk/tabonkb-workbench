/* ==========================================================================
   DSH Studio View — DeepSeek Harness 全功能桌面工作室嵌入视图 (模式 A)
   特性:
   1. 独立 Obsidian ItemView (VIEW_TYPE_DSH_STUDIO = 'tabonkb-dsh-studio')，支持分屏/多屏
   2. 原生内嵌官方 Web 控制台，支持全功能插件管理、Creator Mode 与复杂轨迹画布
   3. 极简微工具条 (28px): 状态徽标 (<=6字) + 4个纯图标动作 (刷新/重启/新窗/浏览器)
   4. 零 Electron 钩子侵入: 实测证实 DSH 无 XFO/CSP 限制，原生安全内嵌
   5. 状态双向感知: 自动监听 DshDaemonManager 状态与认证 URL

   注: 遵循双运行形态约束 (单测 require 与 build.py 全局类拼接)
   ========================================================================== */

const { ItemView } = require('obsidian');
const { getTabonKbWebRequestBridge } = require('../services/dsh-daemon-manager.js');

const VIEW_TYPE_DSH_STUDIO = 'tabonkb-dsh-studio';

class DshStudioView extends ItemView {
  constructor(leaf, options = {}) {
    super(leaf);
    this.plugin = options.plugin || null;
    this.iframeEl = null;
    this.loadingEl = null;
    this.statusBadgeEl = null;
    this._statusUnsub = null;
    this._authUnsub = null;
    this._isRendered = false;
  }

  getViewType() {
    return VIEW_TYPE_DSH_STUDIO;
  }

  getDisplayText() {
    return 'DSH 工作室';
  }

  getIcon() {
    return 'bot';
  }

  getContainer() {
    return this.contentEl || 
      (this.containerEl && this.containerEl.querySelector && this.containerEl.querySelector('.view-content')) || 
      this.containerEl;
  }

  ensureRendered() {
    const container = this.getContainer();
    if (!this._isRendered || !container || !container.querySelector('.tw-dsh-studio-toolbar')) {
      this.onOpen();
    }
  }

  async onOpen() {
    try {
      const container = this.getContainer();
      if (!container) return;
      container.empty();
      container.addClass('tw-dsh-studio-view');
      this._isRendered = true;

      this.renderLayout(container);
      this.bindDaemonEvents();

      // 确保 WebRequest 桥接器激活
      if (typeof getTabonKbWebRequestBridge === 'function') {
        try {
          getTabonKbWebRequestBridge()?.ensureInstalled();
        } catch (_) {}
      }

      // 确保守护进程启动并加载 URL
      const daemon = this.getDaemonManager();
      if (daemon) {
        const targetUrl = daemon.studioUrl || daemon.authUrl;
        if (daemon.status === 'running' && targetUrl) {
          this.updateStatusBadge('就绪', `DSH 引擎运行中 (端口: ${daemon.actualPort})`);
          this.loadIframeUrl(targetUrl);
        } else {
          this.setLoading(true, '正在连接 DSH 引擎...');
          this.updateStatusBadge('启动中', '正在拉起服务');
          daemon.start().then((ok) => {
            const url = daemon.studioUrl || daemon.authUrl;
            // R1: 以"是否拿到可用 URL"为唯一成功判据 —— start() 返回 false 也可能是
            // 单飞复用(插件 autoStart 正在启动)而非真失败
            if (url) {
              this.loadIframeUrl(url);
            } else if (daemon.status === 'starting' || daemon.status === 'running') {
              this.setLoading(true, '正在等待 DSH 引擎就绪...');
              this.updateStatusBadge(daemon.status === 'running' ? '就绪' : '启动中', daemon.statusDetail || '正在拉起服务');
            } else if (!ok) {
              const err = daemon.lastError || '启动超时或未能获取鉴权凭证';
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
      } else {
        this.setLoading(false);
        this.updateStatusBadge('未就绪', '未检测到守护管理器');
      }
    } catch (err) {
      console.error('[DshStudioView] onOpen error:', err);
    }
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

  renderLayout(container) {
    const root = container || this.getContainer();
    if (!root) return;

    // 1. 顶部 28px 极简微工具条
    const toolbar = root.createDiv({ cls: 'tw-dsh-studio-toolbar' });

    // 左侧: 状态微标
    const leftBox = toolbar.createDiv({ cls: 'tw-dsh-studio-left' });
    this.statusBadgeEl = leftBox.createDiv({ cls: 'tw-dsh-badge tw-dsh-badge-starting' });
    this.statusBadgeEl.createSpan({ cls: 'tw-dsh-badge-dot' });
    this.statusBadgeText = this.statusBadgeEl.createSpan({ cls: 'tw-dsh-badge-text', text: '启动中' });
    this.statusBadgeEl.setAttribute('title', 'DSH 守护进程状态 (点击重启)');
    this.statusBadgeEl.onclick = () => {
      this.handleRestart();
    };

    // 右侧: 纯图标动作按钮组 (12~14px 图标，无文字噪音)
    const rightActions = toolbar.createDiv({ cls: 'tw-dsh-studio-actions' });

    // 动作 1: 刷新视窗
    const btnReload = rightActions.createDiv({ cls: 'tw-dsh-icon-btn', attr: { title: '刷新网页视窗' } });
    btnReload.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
    btnReload.onclick = () => {
      this.handleReload();
    };

    // 动作 2: 重启引擎
    const btnRestart = rightActions.createDiv({ cls: 'tw-dsh-icon-btn', attr: { title: '重启 DSH 守护进程' } });
    btnRestart.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>`;
    btnRestart.onclick = () => {
      this.handleRestart();
    };

    // 动作 3: 弹出独立窗口 (多屏开发支持)
    const btnPopout = rightActions.createDiv({ cls: 'tw-dsh-icon-btn', attr: { title: '在独立窗口打开 (多屏支持)' } });
    btnPopout.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>`;
    btnPopout.onclick = () => {
      this.handlePopoutWindow();
    };

    // 动作 4: 默认浏览器打开
    const btnExternal = rightActions.createDiv({ cls: 'tw-dsh-icon-btn is-cta', attr: { title: '在系统默认浏览器打开' } });
    btnExternal.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>`;
    btnExternal.onclick = () => {
      this.handleOpenExternal();
    };

    // 2. 主体 iframe 容器
    this.frameWrap = root.createDiv({ cls: 'tw-dsh-studio-frame-wrap' });
    const frameWrap = this.frameWrap;

    // 加载动画提示
    this.loadingEl = frameWrap.createDiv({ cls: 'tw-dsh-studio-loading' });
    this.loadingEl.innerHTML = `<div class="tw-dsh-spinner"></div><span class="tw-dsh-loading-msg">正在加载 DSH 工作室...</span>`;

    // iframe
    if (frameWrap.createEl) {
      this.iframeEl = frameWrap.createEl('iframe', { cls: 'tw-dsh-studio-iframe' });
    } else if (typeof document !== 'undefined' && document.createElement) {
      this.iframeEl = document.createElement('iframe');
      this.iframeEl.className = 'tw-dsh-studio-iframe';
      frameWrap.appendChild(this.iframeEl);
    }
    if (this.iframeEl) {
      this.iframeEl.setAttribute('frameborder', '0');
      this.iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write');
      this.iframeEl.onload = () => {
        const src = this.iframeEl.getAttribute('src') || this.iframeEl.src;
        if (src && src.startsWith('http')) {
          this.setLoading(false);
        }
      };
    }
  }

  showErrorCard(msg = '') {
    if (!this.frameWrap) return;
    this.setLoading(false);
    let errEl = this.frameWrap.querySelector('.tw-dsh-error-box');
    if (!errEl) {
      errEl = this.frameWrap.createDiv({ cls: 'tw-dsh-error-box' });
    }
    errEl.empty();
    errEl.createDiv({ cls: 'tw-dsh-error-title', text: 'DSH 引擎未能启动' });
    errEl.createDiv({ cls: 'tw-dsh-error-msg', text: msg || '启动超时或未能获取鉴权凭证' });
    const btnBox = errEl.createDiv({ cls: 'tw-dsh-error-actions' });
    const btnRetry = btnBox.createEl('button', { cls: 'mod-cta', text: '重试启动' });
    btnRetry.onclick = () => {
      errEl.remove();
      this.handleRestart();
    };
  }

  clearErrorCard() {
    if (!this.frameWrap) return;
    const errEl = this.frameWrap.querySelector('.tw-dsh-error-box');
    if (errEl) errEl.remove();
  }

  setLoading(isLoading, msg = '') {
    if (!this.loadingEl) return;
    if (isLoading) {
      this.loadingEl.style.display = 'flex';
      const textEl = this.loadingEl.querySelector('.tw-dsh-loading-msg');
      if (textEl && msg) textEl.textContent = msg;
    } else {
      this.loadingEl.style.display = 'none';
    }
  }

  async loadIframeUrl(url) {
    if (!this.iframeEl || !url) return;
    this.clearErrorCard();
    this.setLoading(true, '正在连接 DSH 控制台...');

    const daemon = this.getDaemonManager();
    let targetUrl = url;
    if (daemon) {
      try {
        if (!daemon.authCookie && daemon.authUrl) {
          await daemon.refreshAuthCookie(daemon.authUrl);
        }
        if (daemon.actualPort && !daemon.proxyServer) {
          await daemon.startProxy(daemon.actualPort);
        }
        if (daemon.studioUrl) {
          targetUrl = daemon.studioUrl;
        }
      } catch (_) {}
    }

    const currentSrc = this.iframeEl.getAttribute('src') || this.iframeEl.src || '';
    if (currentSrc === targetUrl) {
      this.iframeEl.src = 'about:blank';
      setTimeout(() => {
        if (this.iframeEl) this.iframeEl.src = targetUrl;
      }, 50);
    } else {
      this.iframeEl.src = targetUrl;
    }
  }

  updateStatusBadge(label, tooltip = '') {
    if (!this.statusBadgeEl || !this.statusBadgeText) return;
    this.statusBadgeText.textContent = label;

    this.statusBadgeEl.classList.remove('tw-dsh-badge-running', 'tw-dsh-badge-starting', 'tw-dsh-badge-stopped', 'tw-dsh-badge-error');
    if (label.includes('就绪') || label.includes('运行')) {
      this.statusBadgeEl.classList.add('tw-dsh-badge-running');
    } else if (label.includes('启动')) {
      this.statusBadgeEl.classList.add('tw-dsh-badge-starting');
    } else if (label.includes('停止')) {
      this.statusBadgeEl.classList.add('tw-dsh-badge-stopped');
    } else {
      this.statusBadgeEl.classList.add('tw-dsh-badge-error');
    }

    if (tooltip) {
      this.statusBadgeEl.setAttribute('title', tooltip);
    }

    this.statusBadgeEl.onclick = () => {
      const tip = this.statusBadgeEl.getAttribute('title') || 'DSH 状态';
      try {
        const { Notice } = require('obsidian');
        new Notice(`[DSH] ${this.statusBadgeText.textContent}: ${tip}`, 5000);
      } catch (_) {}
      if (this.statusBadgeText.textContent.includes('异常') || this.statusBadgeText.textContent.includes('停止')) {
        this.handleRestart();
      }
    };
  }

  bindDaemonEvents() {
    const daemon = this.getDaemonManager();
    if (!daemon) return;

    this._statusUnsub = daemon.on('status_change', (data) => {
      const portDesc = data.port ? ` (端口: ${data.port})` : '';
      if (data.status === 'running') {
        this.clearErrorCard();
        this.updateStatusBadge('就绪', `DSH 引擎运行中${portDesc}`);
      } else if (data.status === 'starting') {
        this.clearErrorCard();
        this.updateStatusBadge('启动中', `正在连接或拉起子进程${portDesc}`);
      } else if (data.status === 'stopped') {
        this.updateStatusBadge('已停止', data.detail || '服务已停止');
        if (data.detail && data.detail.includes('异常')) {
          this.showErrorCard(data.detail);
        }
      } else {
        const err = data.detail || daemon.lastError || '服务运行异常';
        this.updateStatusBadge('异常', err);
        this.showErrorCard(err);
      }
    });

    this._authUnsub = daemon.on('auth_ready', (data) => {
      const url = data?.studioUrl || data?.authUrl;
      if (url) {
        this.clearErrorCard();
        this.loadIframeUrl(url);
      }
    });
  }

  async handleReload() {
    const daemon = this.getDaemonManager();
    if (daemon) {
      try {
        await daemon.refreshAuthCookie(daemon.authUrl);
        if (daemon.actualPort && !daemon.proxyServer) {
          await daemon.startProxy(daemon.actualPort);
        }
      } catch (_) {}
    }
    const url = daemon?.studioUrl || daemon?.authUrl || (daemon?.actualPort ? `http://127.0.0.1:${daemon.actualPort}/` : '');
    if (this.iframeEl && url) {
      this.clearErrorCard();
      this.setLoading(true, '重新加载视窗...');
      this.iframeEl.src = 'about:blank';
      setTimeout(() => {
        if (this.iframeEl) this.iframeEl.src = url;
      }, 50);
    }
  }

  async handleRestart() {
    const daemon = this.getDaemonManager();
    if (!daemon) return;
    this.clearErrorCard();
    this.setLoading(true, '正在重启 DSH 引擎...');
    this.updateStatusBadge('启动中', '正在重启进程');
    const ok = await daemon.restart();
    if (!ok) {
      const err = daemon.lastError || '重启失败';
      this.setLoading(false);
      this.updateStatusBadge('异常', err);
      this.showErrorCard(err);
    }
  }

  handlePopoutWindow() {
    const daemon = this.getDaemonManager();
    const url = daemon?.authUrl || (daemon?.actualPort ? `http://127.0.0.1:${daemon.actualPort}/` : '');
    if (url) {
      window.open(url, '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no');
    }
  }

  handleOpenExternal() {
    const daemon = this.getDaemonManager();
    const url = daemon?.authUrl || (daemon?.actualPort ? `http://127.0.0.1:${daemon.actualPort}/` : '');
    if (!url) return;
    try {
      const electron = typeof require !== 'undefined' ? require('electron') : null;
      if (electron?.shell?.openExternal) {
        electron.shell.openExternal(url);
        return;
      }
    } catch (_) {}
    window.open(url, '_blank');
  }

  async onClose() {
    if (this._statusUnsub) this._statusUnsub();
    if (this._authUnsub) this._authUnsub();
    if (this.iframeEl) {
      this.iframeEl.src = 'about:blank';
    }
  }
}

module.exports = {
  DshStudioView,
  VIEW_TYPE_DSH_STUDIO
};
