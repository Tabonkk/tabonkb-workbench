/**
 * TabonKB Companion - Popup UI Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const serverStatusEl = document.getElementById('serverStatus');
  const siteBadgeEl = document.getElementById('siteBadge');
  const siteTitleEl = document.getElementById('siteTitle');
  const detectedInfoEl = document.getElementById('detectedInfo');
  const btnSyncNow = document.getElementById('btnSyncNow');
  const btnCopyToken = document.getElementById('btnCopyToken');
  const statusMessageEl = document.getElementById('statusMessage');

  let currentProvider = 'unisoc';
  let currentToken = '';
  let currentCookie = '';
  let isServerOnline = false;

  function showMessage(msg, isSuccess = true) {
    statusMessageEl.className = `status-message ${isSuccess ? 'success' : 'error'}`;
    statusMessageEl.textContent = msg;
    statusMessageEl.style.display = 'block';
  }

  // 1. Check Obsidian Local Server Status
  function checkServer() {
    chrome.runtime.sendMessage({ action: 'checkWorkbenchStatus' }, (res) => {
      if (res && res.success && res.data?.status === 'online') {
        isServerOnline = true;
        serverStatusEl.innerHTML = `
          <span class="status-dot online"></span>
          <span class="status-text">工作台在线 (${res.data.version || 'v1.2.0'})</span>
        `;
      } else {
        isServerOnline = false;
        serverStatusEl.innerHTML = `
          <span class="status-dot offline"></span>
          <span class="status-text">工作台未启动</span>
        `;
      }
      updateButtons();
    });
  }

  function updateButtons() {
    btnSyncNow.disabled = !currentToken || !isServerOnline;
    btnCopyToken.disabled = !currentToken;
  }

  // 2. Query Active Tab & Extract Cookies
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    const url = activeTab?.url || '';

    let domain = 'unisoc.com';
    let isTarget = false;

    if (url.includes('unisoc.com')) {
      currentProvider = 'unisoc';
      domain = 'unisoc.com';
      siteBadgeEl.className = 'badge unisoc';
      siteBadgeEl.textContent = '展锐 Uni-Support';
      siteTitleEl.textContent = '展锐页面检测';
      isTarget = true;
    } else if (url.includes('mediatek.com')) {
      currentProvider = 'mtk';
      domain = 'mediatek.com';
      siteBadgeEl.className = 'badge mtk';
      siteBadgeEl.textContent = 'MTK Online';
      siteTitleEl.textContent = 'MTK 页面检测';
      isTarget = true;
    } else {
      currentProvider = 'unisoc';
      domain = 'unisoc.com';
      siteBadgeEl.className = 'badge';
      siteBadgeEl.textContent = '未在原厂域';
      siteTitleEl.textContent = '展锐历史凭据探查';
    }

    // Query cookies for target domain
    chrome.runtime.sendMessage({ action: 'getCookies', domain }, (res) => {
      if (res && res.success && res.token) {
        currentToken = res.token;
        currentCookie = res.cookieStr;

        const masked = currentToken.length > 20
          ? `${currentToken.substring(0, 10)}...${currentToken.substring(currentToken.length - 8)}`
          : currentToken;

        detectedInfoEl.innerHTML = `
          <div style="color:#34D399;margin-bottom:3px;">🟢 已侦测到有效 Token:</div>
          <div>${masked}</div>
        `;
      } else if (res && res.cookieStr) {
        currentCookie = res.cookieStr;
        const match = currentCookie.match(/unisupport-cutomer-token=([^;]+)/);
        if (match) {
          currentToken = match[1].trim();
          detectedInfoEl.innerHTML = `
            <div style="color:#34D399;margin-bottom:3px;">🟢 已从 Cookie 提取到 Token:</div>
            <div>${currentToken.substring(0, 10)}...</div>
          `;
        } else {
          currentToken = currentCookie;
          detectedInfoEl.innerHTML = `
            <div style="color:#F59E0B;margin-bottom:3px;">🟡 发现未格式化 Cookie:</div>
            <div>${currentCookie.substring(0, 30)}...</div>
          `;
        }
      } else {
        detectedInfoEl.innerHTML = isTarget
          ? `<span style="color:#F87171;">⚠️ 未在该页面检测到登录凭据，请先在官网登录账号。</span>`
          : `<span>当前未打开展锐/MTK页面，请在下方点击直达链接前往登录。</span>`;
      }

      updateButtons();
    });
  });

  // 3. One-Click Sync Button
  btnSyncNow.addEventListener('click', () => {
    if (!currentToken) return;

    btnSyncNow.disabled = true;
    btnSyncNow.textContent = '⏳ 同步中...';

    chrome.runtime.sendMessage({
      action: 'syncToWorkbench',
      provider: currentProvider,
      token: currentToken,
      cookie: currentCookie
    }, (res) => {
      btnSyncNow.disabled = false;
      btnSyncNow.textContent = '⚡ 一键同步到 TabonKB';

      if (res && res.success) {
        showMessage(`🎉 同步成功！${res.data?.msg || '已推送到工作台'}`);
      } else {
        showMessage(`❌ 同步失败: ${res?.error || '连接超时'}`, false);
      }
    });
  });

  // 4. Copy Token Button
  btnCopyToken.addEventListener('click', async () => {
    if (!currentToken) return;
    try {
      await navigator.clipboard.writeText(currentToken);
      showMessage('📋 Token 已成功复制到系统剪贴板！');
    } catch (e) {
      showMessage('复制失败，请手动选取', false);
    }
  });

  // Initial server check
  checkServer();
});
