/* DSLogic 逻辑分析服务：管理常驻 Python 分析 worker（dslogic_worker.py，stdio NDJSON）。
   懒启动、按方法区分超时（decode 300s，其余 60s）、崩溃后在途请求自动重试一次并透出
   错误；dispose() 终止进程。只读访问采集文件；一次性 CLI（dslogic_cli.py）保留为测试入口。 */
const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 60000;
const METHOD_TIMEOUTS = { decode: 300000 };   // 大文件首次解码可能达分钟级（T8 再优化进度/清理）

class DSLogicService {
  constructor(options = {}) {
    this.options = options || {};
    this.vaultBasePath = options.vaultBasePath || '';

    this._worker = null;          // child process
    this._workerReady = false;
    this._starting = null;        // Promise while spawning
    this._startupError = null;    // sticky startup failure (e.g. 缺 numpy)
    this._buf = '';
    this._reqId = 1;
    this._pending = new Map();    // id -> {resolve,reject,timer,retried}
    this._onWorkerExit = null;
  }

  getPluginDir() {
    if (this.options.pluginDir) return path.resolve(this.options.pluginDir);
    if (this.vaultBasePath) return path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench');
    return path.basename(__dirname) === 'services' ? path.dirname(__dirname) : __dirname;
  }

  getCaptureDir() {
    const vault = this.vaultBasePath || path.resolve(this.getPluginDir(), '..', '..', '..');
    return this.options.captureDir || path.join(vault, '00-Inbox', '02-Raw-Drop', 'Data_DSLogic');
  }

  getCliPath() {
    return path.join(this.getPluginDir(), 'services', 'dslogic', 'dslogic_cli.py');
  }

  getWorkerPath() {
    return path.join(this.getPluginDir(), 'services', 'dslogic', 'dslogic_worker.py');
  }

  getStorageInfo() {
    return { captureDir: this.getCaptureDir(), nameFormat: 'yymmddhhmmss.dsl', timeZone: 'Asia/Shanghai', format: 'DSView .dsl v3' };
  }

  resolveCapturePath(fileName) {
    if (typeof fileName !== 'string' || !fileName || fileName === '.' || fileName === '..' ||
        /[\\/:\x00]/.test(fileName) || !/\.dsl$/i.test(fileName)) throw new Error('非法文件名');
    const full = path.join(this.getCaptureDir(), fileName);
    if (!fs.existsSync(full)) throw new Error('采集文件不存在: ' + fileName);
    return full;
  }

  listCaptures() {
    const dir = this.getCaptureDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(n => /\.dsl$/i.test(n))
      .map(n => {
        const st = fs.statSync(path.join(dir, n));
        return { name: n, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  // ---------- worker lifecycle ----------

  _ensureWorker() {
    if (this._startupError) return Promise.reject(new Error(this._startupError));
    if (this._worker && this._workerReady) return Promise.resolve();
    if (this._starting) return this._starting;
    const child_process = require('child_process');
    const py = this.options.pythonPath || 'py';
    this._starting = new Promise((resolve, reject) => {
      let child;
      try {
        child = child_process.spawn(py, [this.getWorkerPath()], {
          stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
          env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
        });
      } catch (e) {
        this._starting = null;
        return reject(new Error('DSLogic 分析进程启动失败: ' + e.message));
      }
      this._worker = child;
      this._workerReady = false;
      this._buf = '';
      let helloTimer = null;
      const stderrChunks = [];
      child.stderr.on('data', c => { stderrChunks.push(c); if (stderrChunks.join('').length > 4096) stderrChunks.shift(); });
      const onExit = (code, signal) => this._handleWorkerExit(code, signal, stderrChunks.join(''));
      this._onWorkerExit = onExit;
      child.on('exit', onExit);
      child.on('error', (e) => {
        this._starting = null;
        reject(new Error('DSLogic 分析进程启动失败: ' + e.message));
      });
      child.stdout.on('data', (chunk) => {
        this._buf += chunk.toString('utf8');
        let nl;
        while ((nl = this._buf.indexOf('\n')) >= 0) {
          const line = this._buf.slice(0, nl).trim();
          this._buf = this._buf.slice(nl + 1);
          if (!line) continue;
          let msg = null;
          try { msg = JSON.parse(line); } catch (_) { continue; }
          if (msg && msg.id === 0) {
            // hello / startup result
            if (msg.ok) {
              if (helloTimer) clearTimeout(helloTimer);
              this._workerReady = true;
              this._starting = null;
              resolve();
            } else {
              if (helloTimer) clearTimeout(helloTimer);
              this._startupError = (msg.error || 'DSLogic 分析进程自检失败') + '；安装依赖后请重载插件';
              const err = this._startupError;
              this._starting = null;
              try { child.kill(); } catch (_) {}
              reject(new Error(err));
            }
          } else if (msg) {
            this._dispatch(msg);
          }
        }
      });
      child.on('close', () => {});
      // 启动兜底：进程在 hello 前退出
      child.once('exit', () => {
        if (this._starting) {
          const errText = (stderrChunks.join('') || '').trim().slice(-400);
          this._starting = null;
          this._worker = null;
          reject(new Error('DSLogic 分析进程启动即退出' + (errText ? ': ' + errText : '')));
        }
      });
      // 启动兜底：hello 握手超时（python 起了但不应答）
      helloTimer = setTimeout(() => {
        if (this._starting) {
          this._starting = null;
          this._worker = null;
          try { child.kill(); } catch (_) {}
          reject(new Error('DSLogic 分析进程启动超时 (30s)，可在 T8 优化后重试'));
        }
      }, 30000);
      child.once('exit', () => clearTimeout(helloTimer));
    });
    return this._starting;
  }

  _handleWorkerExit(code, signal, stderrText) {
    const dead = this._worker;
    this._worker = null;
    this._workerReady = false;
    this._buf = '';
    const pend = [...this._pending.values()];
    this._pending.clear();
    const reason = 'DSLogic 分析进程异常退出 (code=' + code + (stderrText ? ', ' + stderrText.trim().slice(-200) : '') + ')';
    for (const p of pend) {
      clearTimeout(p.timer);
      if (!p.retried) {
        // 崩溃自动重启一次：在新 worker 上重放该请求；再次失败则把错误透出
        p.retried = true;
        this._request(p.method, p.params, p.timeoutMs, true).then(p.resolve, p.reject);
      } else {
        p.reject(new Error(reason));
      }
    }
    if (dead) { try { dead.removeAllListeners(); } catch (_) {} }
  }

  _dispatch(msg) {
    const p = this._pending.get(msg.id);
    if (!p) return;
    this._pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.data);
    else p.reject(new Error(msg.error || 'DSLogic 分析进程返回未知错误'));
  }

  // 参数显式校验：缺省回落默认值；非数字 / 非整数显式报错（T3-8 验收遗留）
  _num(v, name, { def, int = true } = {}) {
    if (v === undefined || v === null || v === '') return def;
    const n = Number(v);
    if (!Number.isFinite(n) || (int && !Number.isInteger(n)))
      throw new Error('参数 ' + name + ' 非法: 必须为数字');
    return int ? Math.trunc(n) : n;
  }

  _request(method, params, timeoutMs, retried = false) {
    timeoutMs = timeoutMs || METHOD_TIMEOUTS[method] || DEFAULT_TIMEOUT_MS;
    return this._ensureWorker().then(() => new Promise((resolve, reject) => {
      if (!this._worker || !this._workerReady) {
        return reject(new Error('DSLogic 分析进程不可用'));
      }
      const id = this._reqId++;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        // 超时后重启 worker，避免僵死进程阻塞后续请求
        try { this._worker && this._worker.kill(); } catch (_) {}
        reject(new Error('DSLogic 分析进程请求超时 (' + Math.round(timeoutMs / 1000) + 's): ' + method + '，可在 T8 优化后重试'));
      }, timeoutMs);
      this._pending.set(id, { resolve, reject, timer, retried, method, params, timeoutMs });
      try {
        this._worker.stdin.write(JSON.stringify({ id, method, params: params || {} }) + '\n');
      } catch (e) {
        this._pending.delete(id);
        clearTimeout(timer);
        reject(new Error('DSLogic 分析进程写入失败: ' + e.message));
      }
    }));
  }

  dispose() {
    for (const p of this._pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('DSLogic 服务已停止'));
    }
    this._pending.clear();
    const w = this._worker;
    this._worker = null;
    this._workerReady = false;
    if (w) {
      try { w.removeAllListeners(); } catch (_) {}
      try { w.stdin.end(); } catch (_) {}
      try { w.kill(); } catch (_) {}
    }
  }

  // ---------- one-shot CLI (kept as test entry) ----------

  _runCli(args, timeout = 120000) {
    const child_process = require('child_process');
    const py = this.options.pythonPath || 'py';
    return new Promise((resolve, reject) => {
      child_process.execFile(py, [this.getCliPath(), ...args], {
        encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout,
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
      }, (err, stdout, stderr) => {
        let res = null;
        try { res = JSON.parse(stdout || ''); } catch (_) {}
        if (res && res.ok) return resolve(res.data);
        if (res && res.error) return reject(new Error(res.error));
        reject(new Error('DSLogic 解析进程失败: ' + ((stderr || '').trim().slice(-500) || (err && err.message) || '无输出')));
      });
    });
  }

  // ---------- API ----------

  async info(fileName) {
    return this._request('info', { file: this.resolveCapturePath(fileName) });
  }

  async decode(fileName, params = {}) {
    const p = {
      file: this.resolveCapturePath(fileName),
      offset: this._num(params.offset, 'offset', { def: 0 }),
      limit: Math.min(5000, this._num(params.limit, 'limit', { def: 500 }))
    };
    if (params.decoder) {
      p.decoder = String(params.decoder);
      const js = (v, tag) => {
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch (_) { throw new Error(tag + ' 不是合法 JSON'); }
      };
      p.pins = js(params.pins, 'pins') || {};
      if (params.options) p.options = js(params.options, 'options');
      if (params.stacked) p.stacked = js(params.stacked, 'stacked');
    } else {
      p.index = this._num(params.index, 'index', { def: 0 });
    }
    if (params.row) p.row = String(params.row);
    if (params.q !== undefined && params.q !== null && String(params.q).trim() !== '')
      p.q = String(params.q);
    const ss = this._num(params.start_s, 'start_s', { int: false });
    const es = this._num(params.end_s, 'end_s', { int: false });
    if (ss !== undefined && es !== undefined && ss > es)
      throw new Error('参数非法: start_s 必须 <= end_s');
    if (ss !== undefined) p.start_s = ss;
    if (es !== undefined) p.end_s = es;
    if (params.overlap === true || params.overlap === 'true' || params.overlap === 1 || params.overlap === '1')
      p.overlap = true;
    return this._request('decode', p);
  }

  _specParams(params) {
    const p = {};
    const js = (v, tag) => {
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch (_) { throw new Error(tag + ' 不是合法 JSON'); }
    };
    if (params.decoder) {
      p.decoder = String(params.decoder);
      p.pins = js(params.pins, 'pins') || {};
      if (params.options) p.options = js(params.options, 'options');
      if (params.stacked) p.stacked = js(params.stacked, 'stacked');
    } else {
      p.index = this._num(params.index, 'index', { def: 0 });
    }
    return p;
  }

  async transactions(fileName, params = {}) {
    const p = Object.assign(this._specParams(params), { file: this.resolveCapturePath(fileName) });
    const ss = this._num(params.start_s, 'start_s', { int: false });
    const es = this._num(params.end_s, 'end_s', { int: false });
    if (ss !== undefined && es !== undefined && ss > es)
      throw new Error('参数非法: start_s 必须 <= end_s');
    if (ss !== undefined) p.start_s = ss;
    if (es !== undefined) p.end_s = es;
    // F2: offset/limit 分页（默认 limit=100，上限 1000）
    const off = this._num(params.offset, 'offset');
    const lim = this._num(params.limit, 'limit');
    if (off !== undefined) p.offset = off;
    if (lim !== undefined) p.limit = lim;
    return this._request('transactions', p);
  }

  async summary(fileName, params = {}) {
    // 未指定解码器 -> all（worker 合并全部内嵌解码器）
    const hasSpec = params.decoder || params.index !== undefined;
    const p = Object.assign(hasSpec ? this._specParams(params) : { all: true },
                           { file: this.resolveCapturePath(fileName) });
    const s0 = this._num(params.sel_start_s, 'sel_start_s', { int: false });
    const s1 = this._num(params.sel_end_s, 'sel_end_s', { int: false });
    if (s0 !== undefined) p.sel_start_s = s0;
    if (s1 !== undefined) p.sel_end_s = s1;
    return this._request('summary', p);
  }

  async wave(fileName, params = {}) {
    const p = { file: this.resolveCapturePath(fileName) };
    const start = this._num(params.start, 'start');
    const end = this._num(params.end, 'end');
    if (start !== undefined) p.start = start;
    if (end !== undefined) p.end = end;
    if (start !== undefined && end !== undefined && start > end)
      throw new Error('参数非法: start 必须 <= end');
    p.px = this._num(params.px, 'px', { def: 1000 });
    if (params.ch !== undefined && params.ch !== null && params.ch !== '') {
      p.channels = String(params.ch).split(',').map(s => s.trim()).filter(s => s !== '')
        .map(s => this._num(s, 'ch'));
    } else if (Array.isArray(params.channels)) {
      p.channels = params.channels.map(v => this._num(v, 'channels'));
    }
    return this._request('wave', p);
  }

  async importCapture(src) {
    if (typeof src !== 'string' || !src.trim()) throw new Error('src 参数必填');
    const srcPath = path.resolve(src.trim());
    if (!/\.dsl$/i.test(srcPath)) throw new Error('仅支持导入 .dsl 文件');
    if (!fs.existsSync(srcPath)) throw new Error('源文件不存在: ' + src);
    const info = await this._request('info', { file: srcPath });
    let ms = Number(info && info.trigger_time_ms) || 0;
    const st = fs.statSync(srcPath);
    if (!ms) ms = st.mtimeMs;
    // header trigger time (epoch ms) -> 上海时区 yymmddhhmmss
    const name = new Date(ms + 8 * 3600e3).toISOString().replace(/[-:T]/g, '').slice(2, 14);
    const dir = this.getCaptureDir();
    const dst = path.join(dir, name + '.dsl');
    if (fs.existsSync(dst)) {
      const crypto = require('crypto');
      const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      if (sha(srcPath) === sha(dst)) {
        return { name: name + '.dsl', existed: true, size: st.size, trigger_time_ms: ms };
      }
      throw new Error('命名冲突: 已存在同名采集文件，未覆盖');
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcPath, dst, fs.constants.COPYFILE_EXCL);
    return { name: name + '.dsl', existed: false, size: st.size, trigger_time_ms: ms };
  }

  async listDecoders() {
    return this._runCli(['decoders']);
  }

  async describeDecoder(id) {
    if (!id || typeof id !== 'string') throw new Error('解码器 id 必填');
    return this._runCli(['describe', String(id)]);
  }
}

let _dslogicInstance = null;
function getDSLogicService(options = {}) {
  if (!_dslogicInstance) _dslogicInstance = new DSLogicService(options);
  else if (options.vaultBasePath && !_dslogicInstance.vaultBasePath) _dslogicInstance.vaultBasePath = options.vaultBasePath;
  return _dslogicInstance;
}

module.exports = { DSLogicService, getDSLogicService };
