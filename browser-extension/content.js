/**
 * TabonKB Browser Companion Content Script
 * Injected on unisupport.unisoc.com and online.mediatek.com
 */

(function () {
  // Prevent duplicate injection
  if (window.__tabonkb_companion_injected) return;
  window.__tabonkb_companion_injected = true;

  const hostname = window.location.hostname || '';
  const isUnisoc = hostname.includes('unisoc.com');
  const isMtk = hostname.includes('mediatek.com');

  if (!isUnisoc && !isMtk) return;

  const provider = isUnisoc ? 'unisoc' : 'mtk';
  const providerLabel = isUnisoc ? '展锐 Uni-Support' : 'MTK Online';

  // 1. Helper to extract credentials from page context
  function getPageCredentials() {
    let token = '';
    let cookie = document.cookie || '';
    let username = '';

    // Check cookie
    const match = cookie.match(/unisupport-cutomer-token=([^;]+)/);
    if (match) {
      token = match[1].trim();
    }

    // Check localStorage
    try {
      if (!token && window.localStorage) {
        token = localStorage.getItem('unisupport-cutomer-token') ||
                localStorage.getItem('token') ||
                localStorage.getItem('admin_token') ||
                localStorage.getItem('access_token') || '';
      }

      // Detect username from localStorage if present
      const userRaw = localStorage.getItem('user') || localStorage.getItem('userInfo');
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          username = userObj.username || userObj.email || userObj.name || userObj.account || '';
        } catch (_) {
          if (typeof userRaw === 'string' && userRaw.length < 50) username = userRaw;
        }
      }
    } catch (_) {}

    return { token, cookie, username };
  }

  // 2. Toast Notification Helper
  let activeToast = null;
  function showToast(message, type = 'success', duration = 4000) {
    if (activeToast) activeToast.remove();

    const toast = document.createElement('div');
    toast.className = `tabonkb-toast ${type}`;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    activeToast = toast;

    setTimeout(() => {
      if (activeToast === toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  // 3. Render Floating UI Widget
  function initFloatingWidget() {
    const host = document.createElement('div');
    host.id = 'tabonkb-companion-host';

    let isCollapsed = sessionStorage.getItem('tabonkb_collapsed') === 'true';

    function render() {
      host.innerHTML = '';
      if (isCollapsed) {
        const badge = document.createElement('div');
        badge.className = 'tabonkb-collapsed-badge';
        badge.title = `点击展开 TabonKB 研发工作台伴侣 (${providerLabel})`;
        badge.innerHTML = '💎';
        badge.onclick = () => {
          isCollapsed = false;
          sessionStorage.setItem('tabonkb_collapsed', 'false');
          render();
        };
        host.appendChild(badge);
      } else {
        const pill = document.createElement('div');
        pill.className = 'tabonkb-float-pill';
        pill.innerHTML = `
          <div class="tabonkb-brand">
            <span class="tabonkb-gem-icon">💎</span>
            <span>TabonKB 伴侣</span>
          </div>
          <div class="tabonkb-divider"></div>
          <button class="tabonkb-sync-btn" id="tabonkb-btn-sync">
            ⚡ 一键同步到工作台
          </button>
          <button class="tabonkb-close-btn" id="tabonkb-btn-collapse" title="收起">×</button>
        `;

        pill.querySelector('#tabonkb-btn-collapse').onclick = (e) => {
          e.stopPropagation();
          isCollapsed = true;
          sessionStorage.setItem('tabonkb_collapsed', 'true');
          render();
        };

        const syncBtn = pill.querySelector('#tabonkb-btn-sync');
        syncBtn.onclick = () => handleSync(syncBtn);

        host.appendChild(pill);
      }
    }

    render();
    document.body.appendChild(host);
  }

  // 4. Handle Sync Action
  async function handleSync(btn) {
    if (btn.classList.contains('loading')) return;

    btn.classList.add('loading');
    btn.innerHTML = '⏳ 正在获取凭据...';

    // 1. Gather page credentials
    const pageCreds = getPageCredentials();

    // 2. Also query background extension cookies for full/HttpOnly cookies
    chrome.runtime.sendMessage({
      action: 'getCookies',
      domain: isUnisoc ? 'unisoc.com' : 'mediatek.com'
    }, async (resp) => {
      let finalToken = pageCreds.token || resp?.token || '';
      let finalCookie = resp?.cookieStr || pageCreds.cookie;

      // Fallback: if token still not isolated, check if cookie contains unisupport token
      if (!finalToken && finalCookie) {
        const m = finalCookie.match(/unisupport-cutomer-token=([^;]+)/);
        if (m) finalToken = m[1].trim();
      }

      if (!finalToken && !finalCookie) {
        btn.classList.remove('loading');
        btn.innerHTML = '⚡ 一键同步到工作台';
        showToast('⚠️ 未检测到有效登录凭据，请先在该页面登录账号后再点击同步！', 'warn');
        return;
      }

      btn.innerHTML = '🚀 正在推送到工作台...';

      // Send to TabonKB Obsidian sync server
      chrome.runtime.sendMessage({
        action: 'syncToWorkbench',
        provider: provider,
        token: finalToken || finalCookie,
        cookie: finalCookie,
        username: pageCreds.username
      }, (syncRes) => {
        btn.classList.remove('loading');

        if (syncRes && syncRes.success) {
          btn.classList.add('success');
          btn.innerHTML = '✅ 同步成功！';
          showToast(`🎉 <b>${providerLabel}</b> 最新凭据已秒级同步至 TabonKB 工作台！Obsidian 端已就绪。`, 'success', 4500);

          setTimeout(() => {
            btn.classList.remove('success');
            btn.innerHTML = '⚡ 一键同步到工作台';
          }, 3500);
        } else {
          // Fallback: if Obsidian is not running or port 28123 is blocked
          const errDetail = syncRes?.error || '连接超时';
          
          // Auto-copy to clipboard as graceful degradation
          const textToCopy = finalToken || finalCookie;
          if (navigator.clipboard && textToCopy) {
            navigator.clipboard.writeText(textToCopy).catch(() => {});
          }

          btn.innerHTML = '⚡ 一键同步到工作台';
          showToast(`
            ⚠️ <b>未连上本地 Obsidian 工作台</b><br>
            <span style="font-size:11px;opacity:0.9;">原因：Obsidian 尚未启动或插件未加载。<br>
            <b>已自动将 Token 复制到剪贴板</b>，您可随时在工作台粘贴！</span>
          `, 'warn', 6000);
        }
      });
    });
  }

  // 5. Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingWidget);
  } else {
    initFloatingWidget();
  }
})();
