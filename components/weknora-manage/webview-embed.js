/* ==========================================================================
   WeKnora Webview Embed — 官方 Web 控制台双模嵌入组件
   特性:
   1. 100% 完整原汁原味 WeKnora 官方 Web 体验 (拖拽上传大文件、智能体编排)
   2. 智能端口适配: 自动将后端纯 API 端口 (:8080) 转换为 Web 控制台端口 (:8088)
   3. 权限拦截规避: 自动在 Electron 环境中剥除 x-frame-options 限制
   4. 顶部工具栏: 地址指示/编辑、端口快捷切换 (8088/8080)、刷新重载、一键系统默认浏览器打开
   5. 加载占位符: iframe 加载期间显示优雅动效
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
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

/**
 * 在 Electron 环境下拦截响应头，规避 X-Frame-Options: SAMEORIGIN 限制
 */
function setupIframeBypass() {
  try {
    if (typeof window === 'undefined') return;
    if (window._weknoraHeaderHookInstalled) return;

    let electron = null;
    try {
      electron = typeof require !== 'undefined' ? require('electron') : null;
    } catch (e) {
      return;
    }
    if (!electron) return;
    const sess = electron.remote?.session?.defaultSession || electron.session?.defaultSession;
    if (!sess || !sess.webRequest) return;

    window._weknoraHeaderHookInstalled = true;
    sess.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
      const responseHeaders = Object.assign({}, details.responseHeaders);
      const url = (details.url || '').toLowerCase();
      if (url.includes(':8088') || url.includes(':8080') || url.includes('192.168.1.62') || url.includes('weknora')) {
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['Content-Security-Policy'];
      }
      callback({ cancel: false, responseHeaders });
    });
  } catch (err) {
    // 忽略特定运行时环境限制
  }
}

class WeKnoraWebviewEmbed {
  /**
   * @param {HTMLElement} parentEl
   * @param {object} options
   */
  constructor(parentEl, options = {}) {
    this.parentEl = parentEl;
    this.getBaseUrl = options.getBaseUrl || (() => 'http://192.168.1.62:8088');
    this.getCurrentKbId = options.getCurrentKbId || (() => '');

    this.containerEl = null;
    this.iframeEl = null;
    this.activePort = '8088'; // 默认 8088 为 Web 控制台端口

    setupIframeBypass();
    this.initDOM();
  }

  initDOM() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'tw-weknora-webview-wrap';
    this.parentEl.appendChild(this.containerEl);

    const targetUrl = this.computeUrl(this.activePort);

    this.containerEl.innerHTML = `
      <div class="tw-webview-topbar">
        <div class="tw-webview-url-box">
          <span style="color:#10B981; font-size:12px; margin-right:2px;">●</span>
          <input type="text" class="tw-webview-url-input" id="inpWebviewUrl" value="${escapeAttr(targetUrl)}" title="按回车键前往指定控制台地址" />
        </div>
        <div class="tw-webview-actions">
          <div class="tw-webview-port-switch" title="切换控制台端口：8088为Web前端界面，8080为后端纯API接口">
            <button class="tw-chip tw-port-btn ${this.activePort === '8088' ? 'active' : ''}" data-port="8088">8088 (Web端)</button>
            <button class="tw-chip tw-port-btn ${this.activePort === '8080' ? 'active' : ''}" data-port="8080">8080 (API端)</button>
          </div>
          <button class="tw-chip" id="btnWebviewReload" title="重新加载网页">🔄 刷新</button>
          <button class="tw-chip is-cta" id="btnWebviewExternal" title="在系统默认外部浏览器中打开当前页面">↗ 浏览器打开</button>
        </div>
      </div>

      <div class="tw-webview-hint-bar" id="twWebviewHintBar">
        <span>💡 <b>提示</b>：WeKnora 官方 Web 控制台运行于 <b>8088</b> 端口（8080 为后端 API 接口）。若控制台要求登录或需完整浏览器特性，可随时点击右上角「↗ 浏览器打开」。</span>
        <button class="tw-hint-close" id="btnCloseWebviewHint">✕</button>
      </div>

      <div class="tw-webview-frame-container">
        <div class="tw-webview-loading" id="twWebviewLoading">
          <div class="tw-drawer-spinner" style="margin-bottom:10px;"></div>
          <span>正在连接 WeKnora 官方控制台...</span>
        </div>
        <iframe class="tw-weknora-iframe" id="twWeknoraIframe" src="${escapeAttr(targetUrl)}" frameborder="0"></iframe>
      </div>
    `;

    this.iframeEl = this.containerEl.querySelector('#twWeknoraIframe');
    const loadingEl = this.containerEl.querySelector('#twWebviewLoading');
    const urlInput = this.containerEl.querySelector('#inpWebviewUrl');

    if (this.iframeEl && loadingEl) {
      this.iframeEl.onload = () => {
        loadingEl.style.display = 'none';
      };
    }

    if (urlInput) {
      urlInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const newUrl = urlInput.value.trim();
          if (newUrl) {
            if (loadingEl) loadingEl.style.display = 'flex';
            if (this.iframeEl) this.iframeEl.src = newUrl;
          }
        }
      };
    }

    // 端口切换按钮
    this.containerEl.querySelectorAll('.tw-port-btn').forEach(btn => {
      btn.onclick = () => {
        const port = btn.getAttribute('data-port');
        if (port && port !== this.activePort) {
          this.activePort = port;
          this.containerEl.querySelectorAll('.tw-port-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-port') === port);
          });
          const newUrl = this.computeUrl(port);
          if (urlInput) urlInput.value = newUrl;
          if (loadingEl) loadingEl.style.display = 'flex';
          if (this.iframeEl) this.iframeEl.src = newUrl;
        }
      };
    });

    const reloadBtn = this.containerEl.querySelector('#btnWebviewReload');
    if (reloadBtn) {
      reloadBtn.onclick = () => {
        if (loadingEl) loadingEl.style.display = 'flex';
        const currentUrl = urlInput ? urlInput.value.trim() : this.computeUrl(this.activePort);
        if (this.iframeEl) this.iframeEl.src = currentUrl;
      };
    }

    const extBtn = this.containerEl.querySelector('#btnWebviewExternal');
    if (extBtn) {
      extBtn.onclick = () => {
        const u = urlInput ? urlInput.value.trim() : this.computeUrl(this.activePort);
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

    const hintCloseBtn = this.containerEl.querySelector('#btnCloseWebviewHint');
    const hintBar = this.containerEl.querySelector('#twWebviewHintBar');
    if (hintCloseBtn && hintBar) {
      hintCloseBtn.onclick = () => {
        hintBar.style.display = 'none';
      };
    }
  }

  computeUrl(port = '8088') {
    let base = this.getBaseUrl().replace(/\/api\/v\d+$/i, '').replace(/\/+$/, '');
    
    // 如果包含端口号，按传入的 port 重写；若无端口则视情况追加
    if (base.includes(':8080') || base.includes(':8088')) {
      base = base.replace(/:8080|:8088/, `:${port}`);
    } else if (port === '8088' && !base.includes(':')) {
      base = `${base}:8088`;
    }

    const kbId = this.getCurrentKbId();
    if (kbId) {
      return `${base}/platform/knowledge-bases/${kbId}`;
    }
    return `${base}/platform/knowledge-bases`;
  }

  dispose() {
    if (this.iframeEl) {
      this.iframeEl.src = 'about:blank';
    }
    this.containerEl?.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraWebviewEmbed };
}
