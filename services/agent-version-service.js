/* ==========================================================================
   Agent Version Service — Pi / Antigravity CLI 版本探测 · 更新 · 更新日志
   
   数据通道:
   - Pi 当前版:  读 node_modules/@earendil-works/pi-coding-agent/package.json (纯 fs)
   - Pi 最新版:  npm registry /latest (https, 6s 超时)
   - Pi 更新:    spawn nodeDir/npm.cmd i -g (仅用户点击)
   - Pi 日志:    本地已装包 CHANGELOG.md; 有新版时拉 unpkg @latest/CHANGELOG.md 取增量段
   - Agy 当前版: spawn 'agy --version' (复用 adapter 候选路径)
   - Agy 更新:   spawn 'agy update' (官方唯一通道, 执行式)
   - Agy 日志:   spawn 'agy changelog' (release notes 全文)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');
const child_process = require('child_process');

const PI_PKG_NAME = '@earendil-works/pi-coding-agent';
const AGENT_VERSION_CACHE_KEY = 'tabonkb-agent-version-cache';
const AGENT_VERSION_TTL = 6 * 3600 * 1000; // 6h

class AgentVersionService {
  constructor(opts = {}) {
    this.nodeDir = opts.nodeDir || path.join(
      process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
      'node-v24.15.0'
    );
    this._inflight = {};
  }

  /* ------------------------------ 基础工具 ------------------------------ */

  static semverGt(a, b) {
    const pa = String(a || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  /** 从 markdown changelog 提取版本号大于 gtVer 的小节; 无则回退前 maxN 节 */
  static extractChangelogSections(mdText, gtVer, maxN = 5, maxChars = 6000) {
    if (!mdText) return '';
    const parts = mdText.split(/(?=^##+\s*\[?v?\d+\.\d+)/m).filter(s => /\d+\.\d+/.test(s.slice(0, 60)));
    if (!parts.length) return mdText.slice(0, maxChars);
    const newer = gtVer ? parts.filter(sec => {
      const m = sec.match(/(\d+\.\d+(?:\.\d+)?)/);
      return m && AgentVersionService.semverGt(m[1], gtVer);
    }) : [];
    const picked = newer.length ? newer : parts.slice(0, maxN);
    return picked.join('\n').slice(0, maxChars);
  }

  _httpsGet(url, timeoutMs = 6000, redirects = 2) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      try {
        const req = https.get(url, {
          headers: { 'User-Agent': 'tabonkb-workbench', 'Accept': 'application/json,*/*' },
          timeout: timeoutMs
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
            res.resume();
            this._httpsGet(res.headers.location, timeoutMs, redirects - 1).then(finish);
            return;
          }
          if (res.statusCode !== 200) { res.resume(); finish(null); return; }
          let body = '';
          res.on('data', (d) => { body += d.toString(); if (body.length > 400000) req.destroy(); });
          res.on('end', () => finish(body));
          res.on('error', () => finish(null));
        });
        req.on('timeout', () => { req.destroy(); finish(null); });
        req.on('error', () => finish(null));
      } catch (e) { finish(null); }
    });
  }

  _spawnCapture(cmd, args, timeoutMs = 10000, opts = {}) {
    return new Promise((resolve) => {
      let out = '', settled = false;
      const finish = (code) => { if (!settled) { settled = true; resolve({ code, out }); } };
      try {
        const proc = child_process.spawn(cmd, args, {
          windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
          cwd: opts.cwd || this.nodeDir, env: process.env
        });
        const timer = setTimeout(() => { try { proc.kill(); } catch (e) {} finish(-1); }, timeoutMs);
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.stderr.on('data', (d) => { out += d.toString(); });
        proc.on('close', (code) => { clearTimeout(timer); finish(code); });
        proc.on('error', () => { clearTimeout(timer); finish(-1); });
      } catch (e) { finish(-1); }
    });
  }

  _resolveAgyBinary() {
    const candidates = [
      'C:\\Windows\\System32\\agy.exe',
      path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Administrator\\AppData\\Local', 'agy', 'bin', 'agy.exe'),
      path.join(process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming', 'Antigravity', 'bin', 'agy.exe'),
      'agy.exe', 'agy'
    ];
    for (const c of candidates) {
      if (c === 'agy' || c === 'agy.exe' || fs.existsSync(c)) return c;
    }
    return 'agy';
  }

  /* ------------------------------ Pi Agent ------------------------------ */

  readPiCurrent() {
    try {
      const pkgPath = path.join(this.nodeDir, 'node_modules', ...PI_PKG_NAME.split('/'), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || null;
    } catch (e) { return null; }
  }

  readPiLocalChangelog() {
    try {
      const p = path.join(this.nodeDir, 'node_modules', ...PI_PKG_NAME.split('/'), 'CHANGELOG.md');
      return fs.readFileSync(p, 'utf8').slice(0, 60000);
    } catch (e) { return ''; }
  }

  async fetchPiLatest() {
    const body = await this._httpsGet(`https://registry.npmjs.org/${encodeURIComponent(PI_PKG_NAME)}/latest`, 6000);
    try { return JSON.parse(body).version || null; } catch (e) { return null; }
  }

  async fetchPiRemoteChangelog() {
    return await this._httpsGet(`https://unpkg.com/${PI_PKG_NAME}@latest/CHANGELOG.md`, 8000);
  }

  async execPiUpdate() {
    const npmCmd = path.join(this.nodeDir, 'npm.cmd');
    const cmd = fs.existsSync(npmCmd) ? npmCmd : 'npm.cmd';
    return await this._spawnCapture(cmd, ['i', '-g', PI_PKG_NAME], 120000, { cwd: this.nodeDir });
  }

  /* ------------------------------ Antigravity ------------------------------ */

  async fetchAgyCurrent() {
    const { code, out } = await this._spawnCapture(this._resolveAgyBinary(), ['--version'], 8000);
    if (code !== 0) return null;
    const m = out.match(/\d+\.\d+(?:\.\d+)?/);
    return m ? m[0] : null;
  }

  async fetchAgyChangelog() {
    const { code, out } = await this._spawnCapture(this._resolveAgyBinary(), ['changelog'], 10000);
    return code === 0 ? out.slice(0, 60000) : '';
  }

  async execAgyUpdate() {
    return await this._spawnCapture(this._resolveAgyBinary(), ['update'], 120000);
  }

  /* ------------------------------ 聚合入口 ------------------------------ */

  _loadCache() {
    try { return JSON.parse(localStorage.getItem(AGENT_VERSION_CACHE_KEY) || '{}'); } catch (e) { return {}; }
  }

  _saveCache(cache) {
    try { localStorage.setItem(AGENT_VERSION_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  }

  /**
   * @param {'pi'|'antigravity'} agentId
   * @returns {Promise<{current:string|null, latest:string|null, status:string, updateCmd:string, checkedAt:number, updateResult:string|null}>}
   *   status: 'latest' | 'update' | 'self' | 'missing' | 'unknown'
   */
  async getInfo(agentId, { force = false } = {}) {
    const cache = this._loadCache();
    const hit = cache[agentId];
    if (!force && hit && (Date.now() - hit.checkedAt) < AGENT_VERSION_TTL) return hit;
    if (this._inflight[agentId]) return this._inflight[agentId];

    const job = (async () => {
      let info = null;
      if (agentId === 'pi') {
        const current = this.readPiCurrent();
        const latest = await this.fetchPiLatest();
        const status = !current ? 'missing'
          : latest == null ? 'unknown'
          : AgentVersionService.semverGt(latest, current) ? 'update' : 'latest';
        info = { current, latest, status, updateCmd: `npm i -g ${PI_PKG_NAME}`, checkedAt: Date.now(), updateResult: null };
      } else if (agentId === 'antigravity') {
        const current = await this.fetchAgyCurrent();
        // agy 无只读最新版接口: 只标自更新通道, 点击「检查更新」后才有结果
        info = { current, latest: null, status: current ? 'self' : 'missing', updateCmd: 'agy update', checkedAt: Date.now(), updateResult: null };
      }
      if (info) {
        cache[agentId] = info;
        this._saveCache(cache);
      }
      return info;
    })();

    this._inflight[agentId] = job;
    try { return await job; } finally { delete this._inflight[agentId]; }
  }

  /** 更新日志: pi 优先 unpkg 增量段(>当前版), agy 全量前若干节 */
  async getChangelog(agentId) {
    if (agentId === 'pi') {
      const current = this.readPiCurrent();
      const remote = await this.fetchPiRemoteChangelog();
      if (remote) {
        const inc = AgentVersionService.extractChangelogSections(remote, current);
        if (inc) return inc;
      }
      const local = this.readPiLocalChangelog();
      return AgentVersionService.extractChangelogSections(local, null, 3) || '(暂无更新日志)';
    }
    if (agentId === 'antigravity') {
      const text = await this.fetchAgyChangelog();
      if (!text) return '(agy changelog 无输出)';
      // agy 输出形如 "1.4.0:\n· ..." —— 取前 2 个版本节
      const parts = text.split(/(?=^\d+\.\d+(?:\.\d+)?:\s*$)/m).filter(s => /^\d+\.\d+/.test(s.trim()));
      return (parts.length ? parts.slice(0, 2).join('\n') : text.slice(0, 6000)).slice(0, 6000);
    }
    return '';
  }

  /** 执行更新并返回 {ok, newVersion, output} —— 仅此入口会产生进程副作用 */
  async runUpdate(agentId) {
    const res = agentId === 'pi' ? await this.execPiUpdate() : await this.execAgyUpdate();
    const newVersion = agentId === 'pi' ? this.readPiCurrent() : await this.fetchAgyCurrent();
    // 更新后强制刷新缓存
    const cache = this._loadCache();
    delete cache[agentId];
    this._saveCache(cache);
    return { ok: res.code === 0, newVersion, output: (res.out || '').trim().slice(-2000) };
  }
}

module.exports = { AgentVersionService };
