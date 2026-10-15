/**
 * TabonKB Companion - Background Service Worker (Manifest V3)
 */

const DEFAULT_PORT = 28123;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    const domain = request.domain || 'unisoc.com';
    const query = request.url ? { url: request.url } : { domain };

    const handleCookies = (cookies) => {
      let token = '';
      let cookieParts = [];
      let xuserid = '';
      let xtoken = '';
      let sessionToken = '';

      for (const c of (cookies || [])) {
        cookieParts.push(`${c.name}=${c.value}`);
        if (c.name === 'unisupport-cutomer-token' || c.name === 'token' || c.name.toLowerCase().includes('token')) {
          if (!token || c.name === 'unisupport-cutomer-token') {
            token = c.value;
          }
        }
        if (c.name === 'xuserid') xuserid = c.value;
        if (c.name === 'xtoken') xtoken = c.value;
        if (c.name.includes('session-token') || c.name === 'sessionToken') sessionToken = c.value;
      }

      const cookieStr = cookieParts.join('; ');
      // For NiceAIGC, token should be the comprehensive cookie string
      if (domain.includes('nice188') || domain.includes('niceaigc') || xuserid || xtoken) {
        token = cookieStr;
      }

      sendResponse({
        success: true,
        token: token,
        cookieStr: cookieStr,
        cookies: cookies || [],
        meta: { xuserid, xtoken, sessionToken }
      });
    };

    chrome.cookies.getAll(query, (cookies) => {
      if (chrome.runtime.lastError || !cookies || cookies.length === 0) {
        // Fallback: try querying by domain if url query yielded empty
        if (request.url && domain) {
          chrome.cookies.getAll({ domain }, (fallbackCookies) => {
            handleCookies(fallbackCookies || []);
          });
          return;
        }
      }
      handleCookies(cookies || []);
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
        url: request.url || '',
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
