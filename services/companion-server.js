/**
 * TabonKB Workbench Companion Sync Server
 * Listens on 127.0.0.1:28123 for secure, 1-click token/cookie synchronization
 * from the TabonKB Browser Companion Extension (Chrome / Edge).
 */

class CompanionSyncServer {
  constructor(options = {}) {
    this.plugin = options.plugin;
    this.app = options.plugin?.app || options.app;
    this.port = options.port || 28123;
    this.fallbackPort = 28124;
    this.server = null;
    this.isRunning = false;
  }

  /**
   * Start local loopback HTTP server
   */
  start() {
    if (this.server) return;

    const http = require('http');

    const requestHandler = async (req, res) => {
      // 1. Set CORS headers to permit requests from browser extensions & localhost
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TabonKB-Source');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      // Preflight options
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = urlObj.pathname;

      // 2. Health check route: GET /api/status
      if (req.method === 'GET' && pathname === '/api/status') {
        const payload = {
          ok: true,
          status: 'online',
          app: 'TabonKB Workbench',
          version: this.plugin?.manifest?.version || '1.2.0',
          port: this.port,
          timestamp: Date.now()
        };
        res.writeHead(200);
        res.end(JSON.stringify(payload));
        return;
      }

      // 3. Credential Sync route: POST /api/sync-credential
      if (req.method === 'POST' && pathname === '/api/sync-credential') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
          // Guard against excessively large payloads
          if (body.length > 512 * 1024) {
            req.socket.destroy();
          }
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const provider = (data.provider || 'unisoc').toLowerCase();
            const rawToken = (data.token || data.cookie || '').trim();
            const username = (data.username || data.user || '').trim();

            if (!rawToken) {
              res.writeHead(400);
              res.end(JSON.stringify({ ok: false, msg: '未接收到有效凭据内容 (Token 或 Cookie 为空)' }));
              return;
            }

            let savedKey = '';
            let providerName = '';

            if (provider === 'unisoc') {
              providerName = '展锐 Uni-Support';
              savedKey = 'tabonkb-unisoc-password';

              // Extract pure customer token if input is a raw Cookie string or Bearer header
              let tokenToSave = rawToken;
              if (this.plugin?.vendorService && typeof this.plugin.vendorService.extractUnisocToken === 'function') {
                tokenToSave = this.plugin.vendorService.extractUnisocToken(rawToken) || rawToken;
              }

              // Save to secret storage
              if (typeof this.plugin?.setSecret === 'function') {
                await this.plugin.setSecret(savedKey, tokenToSave);
              }

              // Also persist username if provided
              if (username && this.plugin?.settings?.vendorPortals?.unisoc) {
                this.plugin.settings.vendorPortals.unisoc.username = username;
                await this.plugin.saveSettings();
              }
            } else if (provider === 'mtk') {
              providerName = 'MTK Online';
              savedKey = this.plugin?.settings?.vendorPortals?.mtk?.secretName || 'tabonkb-mtk-password';

              if (typeof this.plugin?.setSecret === 'function') {
                await this.plugin.setSecret(savedKey, rawToken);
              }

              if (username && this.plugin?.settings?.vendorPortals?.mtk) {
                this.plugin.settings.vendorPortals.mtk.username = username;
                await this.plugin.saveSettings();
              }
            } else {
              res.writeHead(400);
              res.end(JSON.stringify({ ok: false, msg: `未知服务商: ${provider}` }));
              return;
            }

            // 4. Notify user in Obsidian UI
            const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
            if (NoticeClass) {
              try {
                new NoticeClass(`🎉 ${providerName} 凭据已通过浏览器扩展成功同步！`, 5000);
              } catch (_) {}
            }

            // 5. Trigger active explore views to auto-clear error & re-run search if pending
            this.refreshActiveExploreViews(provider);

            res.writeHead(200);
            res.end(JSON.stringify({
              ok: true,
              msg: `${providerName} 凭据已成功同步至 TabonKB 工作台！`,
              provider,
              timestamp: Date.now()
            }));
          } catch (err) {
            console.error('[TabonKB Companion] Failed to sync credential:', err);
            res.writeHead(500);
            res.end(JSON.stringify({ ok: false, msg: '同步失败: ' + err.message }));
          }
        });
        return;
      }

      // 404 for other endpoints
      res.writeHead(404);
      res.end(JSON.stringify({ ok: false, msg: 'Not Found' }));
    };

    try {
      this.server = http.createServer(requestHandler);

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[TabonKB Companion] Port ${this.port} is in use, trying fallback ${this.fallbackPort}`);
          if (this.port !== this.fallbackPort) {
            this.port = this.fallbackPort;
            this.server.close();
            this.server = http.createServer(requestHandler);
            this.server.listen(this.port, '127.0.0.1', () => {
              this.isRunning = true;
              console.log(`[TabonKB Companion] Local Sync Server listening on 127.0.0.1:${this.port}`);
            });
          }
        } else {
          console.error('[TabonKB Companion] Server error:', err);
        }
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        this.isRunning = true;
        console.log(`[TabonKB Companion] Local Sync Server listening on 127.0.0.1:${this.port}`);
      });
    } catch (e) {
      console.warn('[TabonKB Companion] Failed to create HTTP sync server:', e);
    }
  }

  /**
   * Notify and refresh any active explore views in Obsidian
   */
  refreshActiveExploreViews(provider) {
    try {
      const leaves = this.app?.workspace?.getLeavesOfType('tabonkb-workbench-view') || [];
      leaves.forEach(leaf => {
        if (leaf.view && leaf.view.exploreView) {
          const ev = leaf.view.exploreView;
          // Clear previous live auth error
          ev.liveSearchError = null;
          // If search keyword exists, trigger automatic re-search
          if (ev.searchKeyword) {
            ev.executeVendorSearch(ev.searchKeyword);
          } else {
            ev.refreshResults();
          }
        }
      });
    } catch (e) {
      console.warn('[TabonKB Companion] Error refreshing explore view:', e);
    }
  }

  /**
   * Stop local server gracefully on plugin unload
   */
  stop() {
    if (this.server) {
      try {
        this.server.close(() => {
          this.isRunning = false;
          console.log('[TabonKB Companion] Local Sync Server stopped');
        });
      } catch (_) {}
      this.server = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CompanionSyncServer };
}
