/* POWER-Z 官方工具控制台：只管理官方程序与记录文件，不访问 USB 设备。 */
const fs = require('fs');
const path = require('path');

class PowerZService {
  constructor(options = {}) {
    this.options = options || {};
    this.vaultBasePath = options.vaultBasePath || '';
    this.pythonCmd = null;
    this._launchPromise = null;
    this._lastCaptureName = null;
    this._normalizationPromise = null;
    this._monitorTimer = null;
    this._captureWatcher = null;
    this._archivePromise = null;
    this._monitorGeneration = 0;
    this._archiveCandidate = null;
    this._lastArchivedSignature = null;
    this._monitorAbort = null;
    this._archiveRetryAt = 0;
    this._adcSources = new Map();
    this._adcArchiveStatus = { enabled: false, status: 'stopped', revision: 0 };
    this._archiveStatus = { enabled: false, status: 'stopped', revision: 0, source: 'pd.sqlite' };
  }

  getPluginDir() {
    if (this.options.pluginDir) return path.resolve(this.options.pluginDir);
    if (this.vaultBasePath) return path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench');
    return path.basename(__dirname) === 'services' ? path.dirname(__dirname) : __dirname;
  }

  getOfficialDir() {
    return this.options.officialDir || path.join(this.getPluginDir(), 'vendor', 'powerz', 'official');
  }

  getCaptureDir() {
    const vault = this.vaultBasePath || path.resolve(this.getPluginDir(), '..', '..', '..');
    return this.options.captureDir || path.join(vault, '00-Inbox', '02-Raw-Drop', 'Data_powerZ');
  }

  getStorageInfo() {
    return { officialDir: this.getOfficialDir(), captureDir: this.getCaptureDir(),
      nameFormat: 'yymmddhhmmss.db', timeZone: 'Asia/Shanghai',
      namingTime: 'last-write', finalizeOn: 'background-after-sample-idle', adcIdleMs: this.options.adcArchiveSettleMs ?? 10000, adcSourceRetained: true,
      pdNameFormat: 'yymmddhhmmss.sqlite', pdFinalizeOn: 'background-after-save',
      pdSourceRetained: true, autoSaveRequiresCheckbox: true };
  }

  static formatCaptureName(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('无效时间');
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai', year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return ['year', 'month', 'day', 'hour', 'minute', 'second'].map(k => values[k]).join('');
  }

  createCaptureName(date = new Date()) {
    const name = PowerZService.formatCaptureName(date);
    if (name === this._lastCaptureName || fs.existsSync(path.join(this.getCaptureDir(), name + '.db'))) {
      throw new Error('采集文件重名，请稍后重试');
    }
    return name;
  }

  resolveCapturePath(fileName) {
    if (typeof fileName !== 'string' || !fileName || fileName === '.' || fileName === '..' ||
        /[\\/:\x00]/.test(fileName)) throw new Error('非法文件名');
    return path.join(this.getCaptureDir(), fileName);
  }

  resolvePythonCmd() {
    if (this.pythonCmd) return this.pythonCmd;
    this.pythonCmd = this.options.pythonPath || 'py';
    return this.pythonCmd;
  }

  resolveScriptPath(fileName) {
    const candidates = [path.join(this.getPluginDir(), 'services', fileName), path.join(__dirname, fileName)];
    return candidates.find(p => fs.existsSync(p)) || candidates[0];
  }

  _execFileAsync(cmd, args, opts = {}) {
    return new Promise(resolve => {
      const child_process = require('child_process');
      try {
        child_process.execFile(cmd, args, Object.assign({
          encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30000
        }, opts), (err, stdout, stderr) => resolve({ err, stdout: stdout || '', stderr: stderr || '' }));
      } catch (err) { resolve({ err, stdout: '', stderr: err.message }); }
    });
  }

  _spawnDetached(exe, args, cwd) {
    const child_process = require('child_process');
    return new Promise((resolve, reject) => {
      const child = child_process.spawn(exe, args, {
        cwd, detached: true, stdio: 'ignore', windowsHide: false
      });
      child.once('error', reject);
      child.once('spawn', () => { child.unref(); resolve(); });
    });
  }

  async applyOfficialPrefs(captureName = this.createCaptureName()) {
    if (!/^\d{12}$/.test(captureName)) throw new Error('非法采集名称');
    const captureFile = this.resolveCapturePath(captureName + '.db');
    if (fs.existsSync(captureFile)) throw new Error('采集文件已存在，拒绝覆盖');
    fs.mkdirSync(this.getCaptureDir(), { recursive: true });
    const capDir = this.getCaptureDir().replace(/\\/g, '/');
    const key = 'HKCU\\Software\\ChargerLab\\POWER-Z\\Setting';
    const items = [
      ['analyzerPath', 'REG_SZ', capDir],
      ['LastSaveFilePath', 'REG_SZ', capDir + '/' + captureName + '.db'],
      ['autoSavePath', 'REG_SZ', capDir],
      ['autoSaveName', 'REG_SZ', captureName]
    ];
    if (this.options.samplingRateCode != null) items.push(['ChartSamplingRate', 'REG_DWORD', String(this.options.samplingRateCode)]);
    if (this.options.cacheSize != null) items.push(['ChartCacheSize', 'REG_DWORD', String(this.options.cacheSize)]);
    for (const [name, type, val] of items) {
      const result = await this._execFileAsync('reg', ['add', key, '/v', name, '/t', type, '/d', val, '/f']);
      if (result.err) throw new Error('官方设置失败 (' + name + '): ' +
        (result.stderr.trim() || result.err.message || String(result.err)));
    }
    return { captureDir: this.getCaptureDir(), captureName, captureFile, namingTime: 'last-write', presetTime: 'launch' };
  }

  async launchOfficial(tool = 'Mtools') {
    if (!['Mtools', 'PDM'].includes(tool)) return { ok: false, message: '未知官方工具' };
    if (this._launchPromise) return { ok: false, message: '正在启动，请稍候' };
    this._launchPromise = this._launchOfficial(tool);
    try { return await this._launchPromise; } finally { this._launchPromise = null; }
  }

  async _launchOfficial(tool) {
    const dir = this.getOfficialDir();
    const exe = path.join(dir, tool + '.exe');
    try {
      if (process.platform !== 'win32') throw new Error('官方工具仅支持 Windows');
      if (!fs.existsSync(exe)) throw new Error('官方程序不存在: ' + exe);
      if (this._normalizationPromise) await this._normalizationPromise;
      const processList = await this._execFileAsync('tasklist', ['/FI', 'IMAGENAME eq ' + tool + '.exe', '/FO', 'CSV', '/NH']);
      if (processList.err) throw new Error('无法确认官方工具运行状态: ' + processList.err.message);
      if (processList.stdout.toLowerCase().includes('"' + tool.toLowerCase() + '.exe"')) {
        throw new Error(tool + ' 已运行，请退出后重新启动');
      }
      let prefs = null;
      if (tool === 'Mtools') prefs = await this.applyOfficialPrefs();
      await this._spawnDetached(exe, [], dir);
      if (prefs) this._lastCaptureName = prefs.captureName;
      return { ok: true, exe, captureDir: this.getCaptureDir(), prefs };
    } catch (err) { return { ok: false, message: err.message || String(err) }; }
  }

  async openCaptureDir() {
    try {
      const dir = this.getCaptureDir();
      fs.mkdirSync(dir, { recursive: true });
      await this._spawnDetached('explorer.exe', [dir], dir);
      return { ok: true };
    } catch (err) { return { ok: false, message: err.message || String(err) }; }
  }

  getArchiveStatus() { return Object.assign({}, this._archiveStatus, { adc: Object.assign({}, this._adcArchiveStatus) }); }

  _setArchiveStatus(values) {
    const previous = JSON.stringify(this._archiveStatus);
    Object.assign(this._archiveStatus, values);
    if (JSON.stringify(this._archiveStatus) !== previous) this._archiveStatus.revision++;
  }

  startCaptureMonitor() {
    if (this._monitorTimer) return;
    fs.mkdirSync(this.getCaptureDir(), { recursive: true });
    const generation = ++this._monitorGeneration;
    this._monitorAbort = new AbortController();
    const archives = fs.readdirSync(this.getCaptureDir()).filter(file => /^\d{12}\.sqlite$/.test(file)).sort();
    this._setArchiveStatus({ enabled: true, status: 'watching', error: null, lastArchive: archives.at(-1) || null });
    this._adcSources.clear();
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(this.getCaptureDir(), '.powerz-adc-state.json'), 'utf8'));
      for (const [source, archive] of Object.entries(saved)) {
        if (/^\d{12}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}\.db$/.test(source) && /^\d{12}\.db$/.test(archive))
          this._adcSources.set(source, { lastArchive: archive });
      }
    } catch (_) { /* Existing targets still provide no-overwrite protection. */ }
    this._setAdcArchiveStatus({ enabled: true, status: 'watching', error: null });
    const tick = () => {
      if (generation !== this._monitorGeneration || this._archivePromise) return;
      this._archivePromise = this._scanArchives(generation).catch(err => {
        if (generation === this._monitorGeneration) this._setArchiveStatus({ status: 'retry', error: err.message });
      }).finally(() => { this._archivePromise = null; });
    };
    const pollMs = this.options.archivePollMs || 1000;
    this._monitorTimer = setInterval(tick, pollMs);
    this._monitorTimer.unref?.();
    try {
      this._captureWatcher = fs.watch(this.getCaptureDir(), { persistent: false }, (_, file) => {
        if (!file || /(?:^pd\.sqlite|\.db)(?:-wal|-journal)?$/i.test(String(file))) tick();
      });
      this._captureWatcher.on('error', () => { this._captureWatcher?.close(); this._captureWatcher = null; });
    } catch (_) { /* Polling remains active on filesystems without watch support. */ }
    tick();
  }

  stopCaptureMonitor() {
    ++this._monitorGeneration;
    clearInterval(this._monitorTimer);
    this._monitorTimer = null;
    this._captureWatcher?.close();
    this._captureWatcher = null;
    this._monitorAbort?.abort();
    this._monitorAbort = null;
    this._archiveCandidate = null;
    this._lastArchivedSignature = null;
    this._adcSources.clear();
    this._setAdcArchiveStatus({ enabled: false, status: 'stopped' });
    this._setArchiveStatus({ enabled: false, status: 'stopped' });
  }

  _protocolSourceState() {
    return this._captureSourceState(this.resolveCapturePath('pd.sqlite'));
  }

  _captureSourceState(source) {
    if (!fs.existsSync(source)) return null;
    const keys = [];
    let savedAt = 0;
    for (const suffix of ['', '-wal', '-journal']) {
      try {
        const stat = fs.lstatSync(source + suffix);
        if (!stat.isFile()) throw new Error('采集工作文件必须是普通文件');
        if (suffix === '-wal' && stat.size === 0) { keys.push([suffix, null]); continue; }
        keys.push([suffix, stat.size, stat.mtimeMs, stat.ctimeMs]);
        if (suffix !== '-journal') savedAt = Math.max(savedAt, stat.mtimeMs);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        keys.push([suffix, null]);
      }
    }
    return { source, signature: JSON.stringify(keys), savedAt };
  }

  async _scanProtocolArchive(generation) {
    const state = this._protocolSourceState();
    if (!state) {
      this._archiveCandidate = null;
      this._setArchiveStatus({ status: 'watching', error: null });
      return;
    }
    if (state.signature === this._lastArchivedSignature) return;
    if (this._archiveCandidate?.signature !== state.signature) {
      this._archiveCandidate = { signature: state.signature, since: Date.now() };
      this._archiveRetryAt = 0;
      this._setArchiveStatus({ status: 'saving', error: null });
      return;
    }
    const settleMs = this.options.archiveSettleMs ?? 1500;
    if (Date.now() - this._archiveCandidate.since < settleMs || Date.now() < this._archiveRetryAt) return;
    const file = PowerZService.formatCaptureName(new Date(state.savedAt)) + '.sqlite';
    this._setArchiveStatus({ status: 'archiving', error: null });
    const result = await this._snapshotProtocol(state.source, this.resolveCapturePath(file));
    if (generation !== this._monitorGeneration) return;
    const after = this._protocolSourceState();
    if (!after || after.signature !== state.signature) {
      this._archiveCandidate = null;
      this._setArchiveStatus({ status: 'saving', error: null });
      return;
    }
    if (result.ok) {
      this._lastArchivedSignature = state.signature;
      this._setArchiveStatus({ status: 'archived', lastArchive: result.file || file,
        lastSavedAt: new Date(state.savedAt).toISOString(), totalPackets: result.totalPackets, error: null });
    } else {
      this._archiveRetryAt = Date.now() + (this.options.archiveRetryMs || 3000);
      this._setArchiveStatus({ status: result.status || 'retry', error: result.error || '协议存档失败', target: file });
    }
  }

  async _snapshotProtocol(source, destination, kind = 'pd', previous = this._archiveStatus.lastArchive) {
    const script = this.resolveScriptPath('powerz_archive.py');
    const options = { timeout: kind === 'adc' ? 60000 : 12000 };
    if (this._monitorAbort) options.signal = this._monitorAbort.signal;
    const stage = path.join(this.getCaptureDir(), '.powerz-archive-' + require('crypto').randomUUID() + '.tmp');
    const args = [script, source, destination, '--stage', stage, '--kind', kind];
    if (previous) args.push('--previous', this.resolveCapturePath(previous));
    try {
      const result = await this._execFileAsync(this.resolvePythonCmd(), args, options);
      if (result.err) return { ok: false, status: 'retry', error: result.stderr.trim() || result.err.message };
      try { return JSON.parse(result.stdout.trim()); }
      catch (_) { return { ok: false, status: 'retry', error: '存档返回无效结果' }; }
    } finally {
      // This exact job's staging path is also cleaned when a helper is aborted.
      try { if (fs.existsSync(stage)) fs.unlinkSync(stage); } catch (_) {}
    }
  }

  _setAdcArchiveStatus(values) {
    const previous = JSON.stringify(this._adcArchiveStatus);
    Object.assign(this._adcArchiveStatus, values);
    if (JSON.stringify(this._adcArchiveStatus) !== previous) this._adcArchiveStatus.revision++;
  }

  async _scanArchives(generation) {
    await this._scanProtocolArchive(generation);
    if (generation !== this._monitorGeneration) return;
    try { await this._scanCurveArchives(generation); }
    catch (err) {
      if (generation === this._monitorGeneration) this._setAdcArchiveStatus({ status: 'retry', error: err.message });
    }
  }

  _saveAdcArchiveIndex() {
    const file = path.join(this.getCaptureDir(), '.powerz-adc-state.json');
    const stage = file + '.' + require('crypto').randomUUID() + '.tmp';
    try {
      const entries = [...this._adcSources].filter(([, record]) => record.lastArchive)
        .map(([source, record]) => [source, record.lastArchive]);
      fs.writeFileSync(stage, JSON.stringify(Object.fromEntries(entries)), { flag: 'wx' });
      fs.renameSync(stage, file);
    } finally { try { if (fs.existsSync(stage)) fs.unlinkSync(stage); } catch (_) {} }
  }

  async _curveProgress(source) {
    const options = { timeout: 15000 };
    if (this._monitorAbort) options.signal = this._monitorAbort.signal;
    const result = await this._execFileAsync(this.resolvePythonCmd(),
      [this.resolveScriptPath('powerz_archive.py'), source, '--progress'], options);
    if (result.err) return { ok: false, error: result.stderr.trim() || result.err.message };
    try { return JSON.parse(result.stdout.trim()); }
    catch (_) { return { ok: false, error: '曲线进度返回无效结果' }; }
  }

  async _scanCurveArchives(generation) {
    // Date archives are never treated as sources. Only the official auto-save
    // suffix is monitored; arbitrary imports/other save paths remain untouched.
    const names = fs.readdirSync(this.getCaptureDir()).filter(name =>
      /^\d{12}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}\.db$/.test(name)).sort();
    const liveNames = new Set(names);
    for (const name of this._adcSources.keys()) if (!liveNames.has(name)) this._adcSources.delete(name);
    const waiting = [];
    for (const name of names) {
      if (generation !== this._monitorGeneration) return;
      const state = this._captureSourceState(this.resolveCapturePath(name));
      if (!state) continue;
      let record = this._adcSources.get(name);
      if (!record) { record = {}; this._adcSources.set(name, record); }
      const progress = await this._curveProgress(state.source);
      if (generation !== this._monitorGeneration) return;
      if (!progress.ok) {
        waiting.push({ name, status: 'retry', error: progress.error });
        continue;
      }
      const logicalSignature = JSON.stringify([progress.totalSamples, progress.lastSampleTime]);
      const observedSignature = state.signature + logicalSignature;
      if (record.archivedSignature === observedSignature) continue;
      if (record.signature !== observedSignature) {
        Object.assign(record, { signature: observedSignature, since: Date.now(), retryAt: 0, status: 'recording', error: null });
      }
      if (Date.now() - record.since < (this.options.adcArchiveSettleMs ?? 10000) || Date.now() < (record.retryAt || 0)) {
        waiting.push({ name, status: record.status || 'saving', error: record.error });
        continue;
      }
      const file = PowerZService.formatCaptureName(new Date(state.savedAt)) + '.db';
      this._setAdcArchiveStatus({ status: 'archiving', source: name, error: null });
      const result = await this._snapshotProtocol(state.source, this.resolveCapturePath(file), 'adc', record.lastArchive || null);
      if (generation !== this._monitorGeneration) return;
      const after = this._captureSourceState(state.source);
      const afterProgress = after ? await this._curveProgress(state.source) : null;
      if (generation !== this._monitorGeneration) return;
      if (!after || after.signature !== state.signature || !afterProgress?.ok ||
          JSON.stringify([afterProgress.totalSamples, afterProgress.lastSampleTime]) !== logicalSignature) {
        record.signature = null;
        waiting.push({ name, status: 'saving' });
        continue;
      }
      if (result.ok) {
        record.archivedSignature = observedSignature;
        record.lastArchive = result.file || file;
        record.error = null;
        this._saveAdcArchiveIndex();
        this._setAdcArchiveStatus({ status: 'archived', source: name, lastArchive: record.lastArchive,
          lastSavedAt: new Date(state.savedAt).toISOString(), totalSamples: result.totalSamples, error: null });
      } else {
        Object.assign(record, { retryAt: Date.now() + (this.options.archiveRetryMs || 3000),
          status: result.status || 'retry', error: result.error });
        waiting.push({ name, status: record.status, error: record.error });
      }
    }
    if (waiting.length) {
      const issue = waiting.find(item => !['saving', 'recording'].includes(item.status));
      const current = issue || waiting[0];
      this._setAdcArchiveStatus({ status: current.status, source: current.name,
        error: current.error || null, pending: waiting });
    } else this._setAdcArchiveStatus({ pending: [], error: null });
  }

  // Kept for HTTP compatibility. Reading a list never renames a live database.
  async prepareCaptures() { return { status: 'background', renamed: [], pending: [] }; }

  listCaptures() {
    const dir = this.getCaptureDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
      return fs.readdirSync(dir)
        .filter(f => /\.(csv|txt|dat|jsonl|db|sqlite)$/i.test(f))
        .map(f => ({ name: f, path: path.join(dir, f), size: fs.statSync(path.join(dir, f)).size }))
        .sort((a, b) => b.name.localeCompare(a.name));
    } catch (err) { throw new Error("采集目录读取失败: " + err.message); }
  }

  /** 读取官方 Mtools 的 .db (SQLite, 经 python sqlite3 stdlib, 异步) */
  async readDatabase(fileName, mode = 'summary', opts = {}) {
    const script = this.resolveScriptPath('powerz_db.py');
    if (!fs.existsSync(script)) return { ok: false, error: 'powerz_db.py not found: ' + script };
    const fp = this.resolveCapturePath(fileName);
    if (!fs.existsSync(fp)) return { ok: false, error: '文件不存在: ' + fileName };
    const args = [script, fp, '--mode', mode];
    if (opts.offset != null) args.push('--offset', String(opts.offset));
    if (opts.limit != null) args.push('--limit', String(opts.limit));
    if (opts.points != null) args.push('--points', String(opts.points));
    const { err, stdout, stderr } = await this._execFileAsync(this.resolvePythonCmd(), args);
    if (err && !stdout) return { ok: false, error: String(err.message || err) };
    const out = (stdout || '').trim();
    if (!out) return { ok: false, error: (stderr || 'no output').slice(0, 300) };
    try {
      const j = JSON.parse(out.split(/\r?\n/).pop());
      if (j.error) return { ok: false, error: j.error };
      return j;
    } catch (e) {
      return { ok: false, error: 'bad JSON: ' + e.message };
    }
  }

  /** 解析采集曲线文件 (.db)，返回完整曲线点、HUD 统计与概览 (对应图2 数据记录仪) */
  async parseCurveData(fileName, points = 50000) {
    if (!fileName || typeof fileName !== 'string') return { ok: false, error: '非法文件名' };
    return await this.readDatabase(fileName, 'curve', { points });
  }

  /** 解析 PD 协议抓包文件 (.sqlite)，返回解码报文、CRC、详细字段及同步波形 (对应图3 PD协议分析仪) */
  async parsePdData(fileName) {
    if (!fileName || typeof fileName !== 'string') return { ok: false, error: '非法文件名' };
    return await this.readDatabase(fileName, 'pd_full');
  }

  /** 分析单个采集文件: 官方 .db / 导出 CSV / jsonl */
  async analyzeCapture(fileName) {
    if (/\.(db|sqlite)$/i.test(fileName)) {
      const r = await this.readDatabase(fileName, 'summary', { points: 40 });
      if (!r.ok) return r;
      return Object.assign({ ok: true, file: this.resolveCapturePath(fileName), source: 'official-db' }, r);
    }
    const fp = this.resolveCapturePath(fileName);
    if (!fs.existsSync(fp)) return { ok: false, msg: '文件不存在: ' + fp };
    const text = fs.readFileSync(fp, 'utf8');
    const r = /\.jsonl$/i.test(fileName) ? this._parseJsonl(text) : this._parseCsv(text);
    if (!r.ok) return r;
    return Object.assign({ ok: true, file: fp, source: 'text' }, r);
  }

  /** 分页读取采集文件 (供 MCP 拉取, 避免大包) */
  async readCaptureData(fileName, type = 'adc', offset = 0, limit = 200) {
    try {
      if (!fileName || /[\\/]/.test(fileName)) return { ok: false, error: '非法文件名' };
      if (/\.(db|sqlite)$/i.test(fileName)) {
        const r = await this.readDatabase(fileName, 'page', { offset, limit });
        if (r && r.ok) r.format = /\.sqlite$/i.test(fileName) ? 'sqlite' : 'db';
        return r;
      }
      const fp = this.resolveCapturePath(fileName);
      if (!fs.existsSync(fp)) return { ok: false, error: '文件不存在: ' + fileName };
      const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/).filter(s => s.trim().length > 0);
      const slice = lines.slice(offset, offset + limit);
      const items = /\.jsonl$/i.test(fp)
        ? slice.map(s => { try { return JSON.parse(s); } catch (_) { return s; } })
        : slice;
      return { ok: true, file: path.basename(fp), format: /\.jsonl$/i.test(fp) ? 'jsonl' : 'csv', total: lines.length, offset, limit, items };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  _parseCsv(csvText) {
    if (!csvText || typeof csvText !== 'string') return { ok: false, msg: 'Invalid CSV' };
    const rows = csvText.trim().split(/\r?\n/).filter(r => r.trim().length > 0);
    if (rows.length < 2) return { ok: false, msg: 'CSV too short' };
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const up = rows[i].toUpperCase();
      if (up.includes('VBUS') || up.includes('VOLT')) { headerIdx = i; break; }
    }
    const header = rows[headerIdx].split(',').map(s => s.trim().toUpperCase());
    const iV = header.findIndex(h => h.includes('VBUS') || h === 'V' || h.includes('VOLT'));
    const iI = header.findIndex(h => h.includes('IBUS') || h.includes('CURR') || h === 'I');
    const iT = header.findIndex(h => h.includes('TIME') || h === 'T');
    const samples = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const cols = rows[r].split(',');
      const num = (idx) => (idx >= 0 && cols[idx] !== undefined && !isNaN(parseFloat(cols[idx]))) ? parseFloat(cols[idx]) : 0;
      const v = num(iV), a = num(iI);
      if (iV >= 0 || iI >= 0) samples.push({ t: iT >= 0 ? num(iT) : (r - headerIdx), v, i: a, p: parseFloat((v * a).toFixed(4)) });
    }
    if (!samples.length) return { ok: false, msg: 'No valid data extracted' };
    return Object.assign({ totalSamples: samples.length }, this._summarize(samples), { downsampledCurve: this._downsample(samples, 40) });
  }

  _parseJsonl(text) {
    const samples = [];
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try {
        const o = JSON.parse(s);
        if (o && typeof o.vbus === 'number') samples.push({ t: o.time || o.t || samples.length, v: o.vbus, i: o.ibus || 0, p: o.pwr || (o.vbus * (o.ibus || 0)) });
      } catch (_) {}
    }
    if (!samples.length) return { ok: false, msg: 'No valid jsonl records' };
    return Object.assign({ totalSamples: samples.length }, this._summarize(samples), { downsampledCurve: this._downsample(samples, 40) });
  }

  _summarize(samples) {
    let minV = Infinity, maxV = -Infinity, sumV = 0, minI = Infinity, maxI = -Infinity, sumI = 0, maxP = -Infinity, sumP = 0;
    for (const p of samples) {
      if (p.v < minV) minV = p.v; if (p.v > maxV) maxV = p.v; sumV += p.v;
      if (p.i < minI) minI = p.i; if (p.i > maxI) maxI = p.i; sumI += p.i;
      if (p.p > maxP) maxP = p.p; sumP += p.p;
    }
    const n = samples.length;
    const dur = Math.abs(samples[n - 1].t - samples[0].t);
    const hours = dur / 3600;
    const avgI = sumI / n, avgP = sumP / n;
    return {
      durationSeconds: parseFloat(dur.toFixed(1)),
      metrics: {
        voltage: { min: minV, max: maxV, avg: parseFloat((sumV / n).toFixed(3)), unit: 'V' },
        current: { min: minI, max: maxI, avg: parseFloat(avgI.toFixed(3)), unit: 'A' },
        power: { peak: maxP, avg: parseFloat(avgP.toFixed(3)), unit: 'W' },
        capacityMah: parseFloat((avgI * hours * 1000).toFixed(1)),
        energyMwh: parseFloat((avgP * hours * 1000).toFixed(1))
      }
    };
  }

  _downsample(samples, points) {
    const n = samples.length;
    const step = Math.max(1, Math.floor(n / Math.max(2, points)));
    const out = [];
    for (let i = 0; i < n; i += step) out.push({ t: Math.round(samples[i].t), v: samples[i].v, i: samples[i].i, p: samples[i].p });
    return out;
  }
}

// 单例
let _powerzInstance = null;
function getPowerZService(options = {}) {
  if (!_powerzInstance) _powerzInstance = new PowerZService(options);
  return _powerzInstance;
}

module.exports = { PowerZService, getPowerZService };
