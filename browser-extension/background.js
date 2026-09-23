/**
 * TabonKB Companion - Background Service Worker (Manifest V3)
 */

const DEFAULT_PORT = 28123;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    const domain = request.domain || 'unisoc.com';
    chrome.cookies.getAll({ domain }, (cookies) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      let token = '';
      let cookieParts = [];
      for (const c of (cookies || [])) {
        cookieParts.push(`${c.name}=${c.value}`);
        if (c.name === 'unisupport-cutomer-token' || c.name === 'token' || c.name.toLowerCase().includes('token')) {
          if (!token || c.name === 'unisupport-cutomer-token') {
            token = c.value;
          }
        }
      }
      
      sendResponse({
        success: true,
        token: token,
        cookieStr: cookieParts.join('; '),
        cookies: cookies || []
      });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'syncToWorkbench') {
    const port = request.port || DEFAULT_PORT;
    const url = `http://127.0.0.1:${port}/api/sync-credential`;
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TabonKB-Source': 'browser-companion-extension'
      },
      body: JSON.stringify({
        provider: request.provider || 'unisoc',
        token: request.token || '',
        cookie: request.cookie || '',
        username: request.username || '',
        timestamp: Date.now()
      })
    })
      .then(async (res) => {
        const json = await res.json();
        sendResponse({ success: res.ok, data: json });
      })
      .catch((err) => {
        sendResponse({
          success: false,
          error: `无法连接到本地 Obsidian 工作台 (127.0.0.1:${port}): ${err.message}`
        });
      });

    return true; // Keep channel open for async response
  }

  if (request.action === 'checkWorkbenchStatus') {
    const port = request.port || DEFAULT_PORT;
    fetch(`http://127.0.0.1:${port}/api/status`)
      .then(async (res) => {
        const json = await res.json();
        sendResponse({ success: res.ok, data: json });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});
