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
    this.powerzService = options.powerzService || null;
    this.dslogicService = options.dslogicService || null;
  }

  getDslogicService() {
    if (this.dslogicService) return this.dslogicService;
    const vaultBasePath = this.app?.vault?.adapter?.basePath;
    if (typeof getDSLogicService === 'function') this.dslogicService = getDSLogicService({ vaultBasePath });
    else {
      const path = require('path');
      const factory = require(path.join(vaultBasePath || 'D:/work/Mgmt/TabonKB', '.obsidian', 'plugins', 'tabonkb-workbench', 'services', 'dslogic-service.js'));
      this.dslogicService = factory.getDSLogicService({ vaultBasePath });
    }
    return this.dslogicService;
  }

  getPowerzService() {
    if (this.powerzService) return this.powerzService;
    const vaultBasePath = this.app?.vault?.adapter?.basePath;
    if (typeof getPowerZService === 'function') this.powerzService = getPowerZService({ vaultBasePath });
    else {
      const path = require('path');
      const factory = require(path.join(vaultBasePath || 'D:/work/Mgmt/TabonKB', '.obsidian', 'plugins', 'tabonkb-workbench', 'services', 'powerz-service.js'));
      this.powerzService = factory.getPowerZService({ vaultBasePath });
    }
    return this.powerzService;
  }

  /**
   * Start local loopback HTTP server
   */
  start() {
    if (this.server) return;

    const http = require('http');
    try { this.getPowerzService()?.startCaptureMonitor?.(); }
    catch (err) { console.error('[PowerZ] Cannot start capture monitor:', err); }

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
          version: this.plugin?.manifest?.version || '1.3.0',
          port: this.port,
          timestamp: Date.now()
        };
        res.writeHead(200);
        res.end(JSON.stringify(payload));
        return;
      }

      // 2.05 Tools route: GET /tools/battery-charger
      if (req.method === 'GET' && (pathname === '/tools/battery-charger' || pathname === '/tools/battery-charger.html')) {
        try {
          const fs = require('fs');
          const path = require('path');
          const basePath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
          const toolHtmlPath = path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'ui', 'tools', 'battery-charger.html');
          if (fs.existsSync(toolHtmlPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.writeHead(200);
            fs.createReadStream(toolHtmlPath).pipe(res);
            return;
          }
        } catch (e) {
          console.error('[TabonKB Companion] Serve tool html failed:', e);
        }
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, msg: 'Tool not found' }));
        return;
      }

      // 2.06 Power-Z Hardware & Protocol Routes: /api/powerz/*
      if (pathname.startsWith('/api/powerz/')) {
        try {
          const pz = this.getPowerzService();

          if (!pz) {
            res.writeHead(500);
            res.end(JSON.stringify({ ok: false, error: 'PowerZService unavailable' }));
            return;
          }

          if (pathname === '/api/powerz/captures' && req.method === 'GET') {
            const normalization = await pz.prepareCaptures();
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, data: pz.listCaptures(), storage: pz.getStorageInfo(), normalization, archive: pz.getArchiveStatus() }));
            return;
          }

          if (pathname === '/api/powerz/capture-data' && req.method === 'GET') {
            const file = urlObj.searchParams.get('file') || '';
            const type = urlObj.searchParams.get('type') || 'adc';
            const offset = parseInt(urlObj.searchParams.get('offset') || '0', 10);
            const limit = parseInt(urlObj.searchParams.get('limit') || '200', 10);
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, data: await pz.readCaptureData(file, type, offset, limit) }));
            return;
          }

          if (pathname === '/api/powerz/analyze' && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                if (!payload.file) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ ok: false, error: 'file 参数必填' }));
                  return;
                }
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, data: await pz.analyzeCapture(payload.file) }));
              } catch (err) {
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
            return;
          }

          if (pathname === '/api/powerz/parse-curve' && (req.method === 'GET' || req.method === 'POST')) {
            const handleCurve = async (file, points) => {
              if (!file) {
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: 'file 参数必填' }));
                return;
              }
              const result = await pz.parseCurveData(file, points || 2500);
              res.writeHead(200);
              res.end(JSON.stringify({ ok: true, data: result }));
            };
            if (req.method === 'GET') {
              const file = urlObj.searchParams.get('file') || '';
              const points = parseInt(urlObj.searchParams.get('points') || '2500', 10);
              await handleCurve(file, points);
            } else {
              let body = '';
              req.on('data', c => { body += c; });
              req.on('end', async () => {
                try {
                  const p = JSON.parse(body || '{}');
                  await handleCurve(p.file, p.points);
                } catch (err) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ ok: false, error: err.message }));
                }
              });
            }
            return;
          }

          if (pathname === '/api/powerz/parse-pd' && (req.method === 'GET' || req.method === 'POST')) {
            const handlePd = async (file) => {
              if (!file) {
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: 'file 参数必填' }));
                return;
              }
              const result = await pz.parsePdData(file);
              res.writeHead(200);
              res.end(JSON.stringify({ ok: true, data: result }));
            };
            if (req.method === 'GET') {
              const file = urlObj.searchParams.get('file') || '';
              await handlePd(file);
            } else {
              let body = '';
              req.on('data', c => { body += c; });
              req.on('end', async () => {
                try {
                  const p = JSON.parse(body || '{}');
                  await handlePd(p.file);
                } catch (err) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ ok: false, error: err.message }));
                }
              });
            }
            return;
          }

          if (pathname === '/api/powerz/control' && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const action = payload.action || 'listCaptures';
                let result;
                let normalization;
                if (action === 'launch') result = await pz.launchOfficial(payload.tool);
                else if (action === 'listCaptures') {
                  normalization = await pz.prepareCaptures();
                  result = pz.listCaptures();
                }
                else if (action === 'openCaptureDir') result = await pz.openCaptureDir();
                else result = { ok: false, error: 'unknown action: ' + action };
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, result, normalization }));
              } catch (err) {
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
            return;
          }
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: e.message }));
          return;
        }
      }

      // 2.07 DSLogic Logic Analyzer Routes: /api/dslogic/*
      if (pathname.startsWith('/api/dslogic/')) {
        const send = (code, obj) => { res.writeHead(code); res.end(JSON.stringify(obj)); };
        try {
          const dl = this.getDslogicService();
          if (pathname === '/api/dslogic/captures' && req.method === 'GET') {
            send(200, { ok: true, data: dl.listCaptures(), storage: dl.getStorageInfo() });
            return;
          }
          if (pathname === '/api/dslogic/decoders' && req.method === 'GET') {
            send(200, { ok: true, data: await dl.listDecoders() });
            return;
          }
          if (pathname === '/api/dslogic/describe' && req.method === 'GET') {
            send(200, { ok: true, data: await dl.describeDecoder(urlObj.searchParams.get('id') || '') });
            return;
          }
          if (pathname === '/api/dslogic/info' && req.method === 'GET') {
            send(200, { ok: true, data: await dl.info(urlObj.searchParams.get('file') || '') });
            return;
          }
          if (pathname === '/api/dslogic/decode' && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                if (!payload.file) { send(400, { ok: false, error: 'file 参数必填' }); return; }
                send(200, { ok: true, data: await dl.decode(payload.file, payload) });
              } catch (err) {
                send(400, { ok: false, error: err.message });
              }
            });
            return;
          }
          if ((pathname === '/api/dslogic/transactions' || pathname === '/api/dslogic/summary')
              && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                if (!payload.file) { send(400, { ok: false, error: 'file 参数必填' }); return; }
                const fn = pathname.endsWith('summary') ? 'summary' : 'transactions';
                send(200, { ok: true, data: await dl[fn](payload.file, payload) });
              } catch (err) {
                send(400, { ok: false, error: err.message });
              }
            });
            return;
          }
          if (pathname === '/api/dslogic/wave' && req.method === 'GET') {
            try {
              const q = urlObj.searchParams;
              send(200, {
                ok: true,
                data: await dl.wave(q.get('file') || '', {
                  start: q.get('start'), end: q.get('end'),
                  px: q.get('px'), ch: q.get('ch')
                })
              });
            } catch (err) {
              send(400, { ok: false, error: err.message });
            }
            return;
          }
          if (pathname === '/api/dslogic/import' && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                send(200, { ok: true, data: await dl.importCapture(payload.src) });
              } catch (err) {
                send(400, { ok: false, error: err.message });
              }
            });
            return;
          }
          send(404, { ok: false, error: 'unknown dslogic route: ' + pathname });
        } catch (e) {
          send(400, { ok: false, error: e.message });
        }
        return;
      }

      // 2.1 Hot-reload plugin route: POST /api/reload-plugin
      if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/reload-plugin') {
        try {
          const plugins = this.app?.plugins;
          if (plugins && typeof plugins.disablePlugin === 'function' && typeof plugins.enablePlugin === 'function') {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, msg: 'Reloading tabonkb-workbench plugin...' }));
            setTimeout(async () => {
              try {
                await plugins.disablePlugin('tabonkb-workbench');
                await plugins.enablePlugin('tabonkb-workbench');
                const newP = plugins.getPlugin ? plugins.getPlugin('tabonkb-workbench') : plugins.plugins?.['tabonkb-workbench'];
                if (newP && this.app?.workspace) {
                  const leaves = this.app.workspace.getLeavesOfType('tabonkb-workbench-view');
                  leaves.forEach(l => {
                    if (l.view && typeof l.view.render === 'function') {
                      try { l.view.render(); } catch (_) {}
                    }
                  });
                }
                console.log('[TabonKB Companion] Plugin reloaded successfully via HTTP API');
              } catch (e) {
                console.error('[TabonKB Companion] Reload failed:', e);
              }
            }, 50);
            return;
          }
        } catch (e) {}
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, msg: 'Unable to reload plugin' }));
        return;
      }

      // 2.2 Local Projects route: GET /api/local-projects
      if (req.method === 'GET' && (pathname === '/api/local-projects' || pathname === '/api/diag-projects')) {
        try {
          let projs = [];
          if (typeof getAllAvailableLocalProjects === 'function') {
            projs = getAllAvailableLocalProjects();
          }
          if ((!projs || projs.length === 0) && typeof fs !== 'undefined') {
            const basePath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
            const cachePath = path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'local-projects-cache.json');
            if (fs.existsSync(cachePath)) {
              projs = JSON.parse(fs.readFileSync(cachePath, 'utf8')) || [];
            }
          }
          res.writeHead(200);
          res.end(JSON.stringify({
            ok: true,
            count: projs.length,
            sample: projs.slice(0, 5)
          }, null, 2));
          return;
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: e.message }));
          return;
        }
      }



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
            } else if (provider === 'niceaigc' || provider === 'nice188') {
              providerName = 'NiceAIGC';
              savedKey = this.plugin?.settings?.niceaigc?.secretName || 'tabonkb-niceaigc-token';

              if (typeof this.plugin?.setSecret === 'function') {
                await this.plugin.setSecret(savedKey, rawToken);
              }

              // Update fallback .secrets.json
              try {
                const fs = require('fs');
                const path = require('path');
                const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
                const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
                let secData = {};
                if (fs.existsSync(secFile)) {
                  secData = JSON.parse(fs.readFileSync(secFile, 'utf8') || '{}');
                }
                secData[savedKey] = rawToken;
                fs.writeFileSync(secFile, JSON.stringify(secData, null, 2), 'utf8');
              } catch (_) {}

              // Update baseUrl if provided (e.g. node7.nice188.com)
              if (data.url && this.plugin?.settings?.niceaigc) {
                try {
                  const urlObj = new URL(data.url);
                  const cleanBase = `${urlObj.protocol}//${urlObj.host}`;
                  if (cleanBase.includes('nice188') || cleanBase.includes('niceaigc')) {
                    this.plugin.settings.niceaigc.baseUrl = cleanBase;
                    await this.plugin.saveSettings();
                  }
                } catch (_) {}
              }

              // Invalidate adapter cache and trigger background models reload
              try {
                const adapter = this.plugin?.agentHub?.getAdapter?.('niceaigc');
                if (adapter) {
                  adapter._memorySecret = rawToken;
                  if (typeof adapter.reloadModels === 'function') {
                    adapter.reloadModels().catch(() => {});
                  }
                }
              } catch (_) {}
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
    this.powerzService?.stopCaptureMonitor?.();
    try { this.dslogicService?.dispose?.(); } catch (_) {}
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
