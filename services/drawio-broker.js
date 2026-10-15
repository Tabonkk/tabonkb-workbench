/**
 * Draw.io 按回合桥。
 * 插件进程内拉起 next-ai-drawio-mcp（DRAWIO_HEADLESS=1），
 * 对本机 127.0.0.1:6011 提供 /v1/call。Pi 扩展与 Hermes MCP 都打这个口。
 * 回合结束时导出到 00-Inbox/04-Agent-Diagrams/ 并关掉子进程。
 * PNG 依赖隐藏预览页，不在工作台上留面板。
 */
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const DRAWIO_BROKER_PORT = 6011;
const DRAWIO_ENTRY_FALLBACK = 'D:\\work\\Mgmt\\lora\\code\\next-ai-draw-io\\packages\\mcp-server\\dist\\index.js';
const DRAWIO_TOOL_MAP = {
  drawio_create: 'create_new_diagram',
  drawio_load: 'load_diagram',
  drawio_get: 'get_diagram',
  drawio_edit: 'edit_diagram',
  drawio_list_pages: 'list_pages',
  drawio_add_page: 'add_page',
  drawio_rename_page: 'rename_page',
  drawio_delete_page: 'delete_page'
};

function drawioResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

function drawioResolveEntry() {
  if (process.env.TABONKB_DRAWIO_MCP_ENTRY && fs.existsSync(process.env.TABONKB_DRAWIO_MCP_ENTRY)) {
    return process.env.TABONKB_DRAWIO_MCP_ENTRY;
  }
  if (fs.existsSync(DRAWIO_ENTRY_FALLBACK)) return DRAWIO_ENTRY_FALLBACK;
  return '';
}

function drawioSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function drawioMcpText(result) {
  const parts = result && result.content;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (p && p.text) || '').join('\n').trim();
}

function drawioSlug(title) {
  const raw = String(title || 'diagram').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, '-');
  const cut = raw.slice(0, 40).replace(/-+$/g, '');
  return cut || 'diagram';
}

function drawioLocalDay() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

class DrawioMcpClient {
  constructor(proc) {
    this.proc = proc;
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    proc.stdout.on('data', (chunk) => this._onData(chunk));
    proc.on('exit', () => {
      for (const [, waiter] of this.pending) waiter.reject(new Error('draw.io 进程已退出'));
      this.pending.clear();
    });
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    let nl;
    while ((nl = this.buf.indexOf(0x0a)) >= 0) {
      const line = this.buf.slice(0, nl).toString('utf8').replace(/\r$/, '').trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const waiter = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(msg.error.message || 'MCP 调用失败'));
        else waiter.resolve(msg.result);
      }
    }
  }

  request(method, params, timeoutMs) {
    const id = this.nextId++;
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`draw.io 工具超时: ${method}`));
      }, timeoutMs || 90000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
    });
  }

  notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params: params || {} }) + '\n');
  }
}

class DrawioBroker {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || '';
    this.port = DRAWIO_BROKER_PORT;
    this.server = null;
    this.child = null;
    this.client = null;
    this.previewUrl = '';
    this.previewPort = 0;
    this.sessionId = '';
    this.title = '';
    this.artifact = null;
    this.exportedRel = '';
    this.previewHost = null;
    this._chain = Promise.resolve();
    this._idle = null;
    this._starting = null;
  }

  start() {
    if (this.server) return;
    globalThis.__tabonkbDrawioBroker = this;
    this.server = http.createServer((req, res) => this._onHttp(req, res));
    this.server.listen(this.port, '127.0.0.1');
  }

  enqueue(fn) {
    const run = this._chain.then(fn, fn);
    this._chain = run.then(() => {}, () => {});
    return run;
  }

  call(tool, args) {
    return this.enqueue(() => this._call(tool, args || {}));
  }

  finishTurn() {
    return this.enqueue(() => this._finishTurn());
  }

  async stop() {
    try { await this.finishTurn(); } catch (e) {}
    if (this.server) {
      try { this.server.close(); } catch (e) {}
      this.server = null;
    }
  }

  _touch() {
    if (this._idle) clearTimeout(this._idle);
    this._idle = setTimeout(() => { this.finishTurn(); }, 10 * 60 * 1000);
  }

  _onHttp(req, res) {
    const send = (code, payload) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'GET' && req.url === '/health') {
      send(200, { ok: true, session: !!this.child });
      return;
    }
    if (req.method !== 'POST' || (req.url !== '/v1/call' && req.url !== '/v1/finish')) {
      send(404, { ok: false, text: '未知接口' });
      return;
    }
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) {
        send(413, { ok: false, text: '图数据过大' });
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      let data = {};
      try { data = body ? JSON.parse(body) : {}; } catch (e) {
        send(400, { ok: false, text: '请求不是 JSON' });
        return;
      }
      const job = req.url === '/v1/finish'
        ? this.finishTurn().then((art) => ({ ok: true, text: art && art.relPng ? art.relPng : '', relPng: art && art.relPng || '' }))
        : this.call(String(data.tool || ''), data.args || {});
      job.then((result) => send(200, result)).catch((err) => {
        send(200, { ok: false, isError: true, text: err.message || String(err) });
      });
    });
  }

  async _call(tool, args) {
    this._touch();
    if (args && args.title) this.title = String(args.title);
    if (tool === 'drawio_export') return this._export(args);
    const upstream = DRAWIO_TOOL_MAP[tool];
    if (!upstream) return { ok: false, isError: true, text: `未知绘图工具: ${tool}` };
    await this._ensureSession();
    const forwarded = Object.assign({}, args);
    delete forwarded.title;
    if (tool === 'drawio_load' && forwarded.path) {
      forwarded.path = this._resolveVaultPath(forwarded.path);
    }
    const result = await this.client.request('tools/call', { name: upstream, arguments: forwarded }, 90000);
    const text = drawioMcpText(result);
    const isError = !!(result && result.isError) || /^Error:/.test(text);
    return { ok: !isError, isError, text: text || (isError ? '绘图工具没有返回内容' : '完成') };
  }

  async _finishTurn() {
    if (this._idle) { clearTimeout(this._idle); this._idle = null; }
    let rel = this.exportedRel || '';
    if (this.child && !rel) {
      try {
        const exported = await this._export({});
        if (exported && exported.relPng) rel = exported.relPng;
      } catch (e) {}
    }
    await this._shutdownChild();
    return rel ? { relPng: rel } : null;
  }

  async _ensureSession() {
    if (this.child && this.client && this.previewUrl) return;
    if (this._starting) return this._starting;
    this._starting = this._startSession();
    try { await this._starting; } finally { this._starting = null; }
  }

  async _startSession() {
    const entry = drawioResolveEntry();
    if (!entry) throw new Error('未找到 next-ai-drawio MCP。请确认 ' + DRAWIO_ENTRY_FALLBACK);
    const nodeExe = drawioResolveNodeExe();
    const child = child_process.spawn(nodeExe, [entry], {
      cwd: this.vaultBasePath || process.cwd(),
      env: Object.assign({}, process.env, { DRAWIO_HEADLESS: '1', PORT: '6002' }),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    this.child = child;
    this.client = new DrawioMcpClient(child);
    child.stderr.on('data', (buf) => {
      const line = buf.toString().trim();
      if (line) console.warn('[DrawioMCP]', line.slice(0, 400));
    });
    child.on('exit', () => {
      if (this.child === child) {
        this.child = null;
        this.client = null;
        this.previewUrl = '';
      }
    });
    await this.client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'tabonkb-drawio-broker', version: '1.0.0' }
    }, 20000);
    this.client.notify('notifications/initialized', {});
    const started = await this.client.request('tools/call', { name: 'start_session', arguments: {} }, 20000);
    const text = drawioMcpText(started);
    const found = text.match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/?\?mcp=([^\s]+)/);
    if (!found) throw new Error(text || '绘图会话没有返回预览地址');
    this.previewPort = parseInt(found[1], 10);
    this.sessionId = found[2];
    this.previewUrl = `http://127.0.0.1:${this.previewPort}/?mcp=${this.sessionId}`;
  }

  _resolveVaultPath(filePath) {
    const raw = String(filePath || '').trim();
    if (!raw) return raw;
    if (path.isAbsolute(raw)) return raw;
    return path.join(this.vaultBasePath || process.cwd(), raw);
  }

  _allocArtifact() {
    if (this.artifact) return this.artifact;
    const vault = this.vaultBasePath || process.cwd();
    const dir = path.join(vault, '00-Inbox', '04-Agent-Diagrams');
    fs.mkdirSync(dir, { recursive: true });
    const slug = drawioSlug(this.title);
    const day = drawioLocalDay();
    let base = `${day}-${slug}`;
    let n = 2;
    while (fs.existsSync(path.join(dir, base + '.drawio')) || fs.existsSync(path.join(dir, base + '.png'))) {
      base = `${day}-${slug}-${n++}`;
    }
    this.artifact = {
      drawio: path.join(dir, base + '.drawio'),
      png: path.join(dir, base + '.png'),
      relPng: `00-Inbox/04-Agent-Diagrams/${base}.png`.replace(/\\/g, '/'),
      relDrawio: `00-Inbox/04-Agent-Diagrams/${base}.drawio`.replace(/\\/g, '/')
    };
    return this.artifact;
  }

  async _export(args) {
    if (args && args.title) this.title = String(args.title);
    await this._ensureSession();
    const art = this._allocArtifact();
    const drawioResult = await this.client.request('tools/call', {
      name: 'export_diagram',
      arguments: { path: art.drawio, format: 'drawio' }
    }, 30000);
    const drawioText = drawioMcpText(drawioResult);
    if ((drawioResult && drawioResult.isError) || /^Error:/.test(drawioText)) {
      return { ok: false, isError: true, text: drawioText || '导出 .drawio 失败' };
    }
    let pngNote = '';
    const ready = await this._openPreview();
    if (!ready) {
      pngNote = 'PNG 预览页未就绪，已保存 .drawio。';
    } else {
      const pngResult = await this.client.request('tools/call', {
        name: 'export_diagram',
        arguments: { path: art.png, format: 'png' }
      }, 40000);
      const pngText = drawioMcpText(pngResult);
      if ((pngResult && pngResult.isError) || /^Error:/.test(pngText) || !fs.existsSync(art.png)) {
        pngNote = pngText || 'PNG 导出失败，已保存 .drawio。';
      }
    }
    if (fs.existsSync(art.png)) {
      this.exportedRel = art.relPng;
    }
    const lines = [
      `源文件: ${art.relDrawio}`,
      fs.existsSync(art.png) ? `预览: ${art.relPng}` : pngNote,
      '图会在本轮回复末尾显示。不要再输出图片 markdown。'
    ];
    return { ok: true, isError: false, text: lines.filter(Boolean).join('\n'), relPng: this.exportedRel || '' };
  }

  async _openPreview() {
    if (!this.previewUrl) return false;
    if (!this.previewHost) this.previewHost = this._mountPreview(this.previewUrl);
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      try {
        const state = await this._getJson(`http://127.0.0.1:${this.previewPort}/api/state?sessionId=${encodeURIComponent(this.sessionId)}`);
        if (state && state.ready) return true;
      } catch (e) {}
      await drawioSleep(400);
    }
    return false;
  }

  _mountPreview(url) {
    const BW = (typeof electronModule !== 'undefined' && electronModule && electronModule.BrowserWindow) ? electronModule.BrowserWindow : null;
    if (typeof BW === 'function') {
      try {
        const win = new BW({
          show: false,
          width: 1400,
          height: 900,
          skipTaskbar: true,
          focusable: false,
          webPreferences: { nodeIntegration: false, contextIsolation: true, backgroundThrottling: false }
        });
        if (win.webContents && typeof win.webContents.setBackgroundThrottling === 'function') {
          win.webContents.setBackgroundThrottling(false);
        }
        win.loadURL(url);
        return { close() { try { win.destroy(); } catch (e) {} } };
      } catch (e) {}
    }
    if (typeof document !== 'undefined' && document.body) {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;left:-2400px;top:0;width:1400px;height:900px;border:0;opacity:0.02;pointer-events:none;';
      frame.src = url;
      document.body.appendChild(frame);
      return { close() { try { frame.remove(); } catch (e) {} } };
    }
    return { close() {} };
  }

  _getJson(url) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(4000, () => { req.destroy(); reject(new Error('state timeout')); });
    });
  }

  async _shutdownChild() {
    this._closePreview();
    const child = this.child;
    this.child = null;
    this.client = null;
    this.previewUrl = '';
    this.sessionId = '';
    this.previewPort = 0;
    this.artifact = null;
    this.exportedRel = '';
    this.title = '';
    if (!child || !child.pid) return;
    try { child.kill(); } catch (e) {}
    if (process.platform === 'win32') {
      try {
        child_process.spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch (e) {}
    }
    await drawioSleep(50);
  }

  _closePreview() {
    if (this.previewHost) {
      try { this.previewHost.close(); } catch (e) {}
      this.previewHost = null;
    }
  }
}

async function tabonkbSettleDrawio() {
  const broker = globalThis.__tabonkbDrawioBroker;
  if (!broker || typeof broker.finishTurn !== 'function') return null;
  try { return await broker.finishTurn(); } catch (e) { return null; }
}

module.exports = { DrawioBroker, tabonkbSettleDrawio, DRAWIO_BROKER_PORT };
