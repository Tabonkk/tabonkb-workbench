/* ==========================================================================
   Notion AI Embed — Notion AI 官方页面嵌入组件（探索页子项）
   特性:
   1. 内嵌 https://app.notion.com/ai（Notion AI 官方入口）
   2. Electron 环境下经 WebRequestBridge 剥除 notion 域名的 x-frame-options / CSP
   3. 顶部工具栏: 地址指示/编辑、刷新重载、系统浏览器打开
   4. 加载占位符: iframe 加载期间显示动效
   ========================================================================== */

const NOTION_AI_DEFAULT_URL = 'https://app.notion.com/ai';

class NotionAiEmbed {
  /**
   * @param {HTMLElement} parentEl
   * @param {object} options
   */
  constructor(parentEl, options = {}) {
    this.parentEl = parentEl;
    this.defaultUrl = options.url || NOTION_AI_DEFAULT_URL;
    this.containerEl = null;
    this.iframeEl = null;

    // 确保 Electron 响应头拦截器已安装（notion 域名豁免在 dsh-daemon-manager 白名单内）
    try {
      if (typeof getTabonKbWebRequestBridge === 'function') {
        getTabonKbWebRequestBridge()?.ensureInstalled?.();
      }
    } catch (_) {}

    this.initDOM();
  }

  _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  initDOM() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'tw-weknora-webview-wrap tw-notion-embed-wrap';
    this.parentEl.appendChild(this.containerEl);

    this.containerEl.innerHTML = `
      <div class="tw-webview-topbar">
        <div class="tw-webview-url-box">
          <span style="color:#8B8B8B; font-size:12px; margin-right:2px;">●</span>
          <input type="text" class="tw-webview-url-input" value="${this._esc(this.defaultUrl)}" title="按回车键前往指定地址" />
        </div>
        <div class="tw-webview-actions">
          <button class="tw-chip" data-act="reload" title="重新加载网页">🔄 刷新</button>
          <button class="tw-chip is-cta" data-act="external" title="在系统默认外部浏览器中打开">↗ 浏览器打开</button>
        </div>
      </div>
      <div class="tw-webview-frame-container">
        <div class="tw-webview-loading">
          <div class="tw-drawer-spinner" style="margin-bottom:10px;"></div>
          <span>正在连接 Notion AI...</span>
        </div>
        <iframe class="tw-weknora-iframe" src="${this._esc(this.defaultUrl)}" frameborder="0"
          allow="clipboard-read; clipboard-write"></iframe>
      </div>
    `;

    this.iframeEl = this.containerEl.querySelector('iframe');
    const loadingEl = this.containerEl.querySelector('.tw-webview-loading');
    const urlInput = this.containerEl.querySelector('.tw-webview-url-input');

    if (this.iframeEl && loadingEl) {
      this.iframeEl.onload = () => { loadingEl.style.display = 'none'; };
    }
    if (urlInput) {
      urlInput.onkeydown = (e) => {
        if (e.key === 'Enter' && urlInput.value.trim()) {
          if (loadingEl) loadingEl.style.display = 'flex';
          this.iframeEl.src = urlInput.value.trim();
        }
      };
    }
    const reloadBtn = this.containerEl.querySelector('[data-act="reload"]');
    if (reloadBtn) {
      reloadBtn.onclick = () => {
        if (loadingEl) loadingEl.style.display = 'flex';
        this.iframeEl.src = urlInput ? urlInput.value.trim() : this.defaultUrl;
      };
    }
    const extBtn = this.containerEl.querySelector('[data-act="external"]');
    if (extBtn) {
      extBtn.onclick = () => {
        const u = urlInput ? urlInput.value.trim() : this.defaultUrl;
        try {
          if (typeof require !== 'undefined') {
            const { shell } = require('electron');
            if (shell && shell.openExternal) { shell.openExternal(u); return; }
          }
        } catch (e) {}
        window.open(u, '_blank');
      };
    }
  }

  dispose() {
    if (this.iframeEl) this.iframeEl.src = 'about:blank';
    if (this.containerEl) this.containerEl.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotionAiEmbed };
}
