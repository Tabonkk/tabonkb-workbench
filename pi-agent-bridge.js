const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

// MCP shared modules for TabonKB services
const { WEKNORA_MCP_SERVER_NAME, WEKNORA_MCP_TOOL_HINT, weknoraMcpResolveNodeExe, weknoraMcpScriptPath, buildWeknoraEnv } = require('./mcp/weknora-mcp-shared.js');
const { VENDOR_MCP_SERVER_NAME, VENDOR_MCP_TOOL_HINT, vendorMcpScriptPath, buildVendorEnv } = require('./mcp/vendor-mcp-shared.js');
const { GERRIT_MCP_SERVER_NAME, GERRIT_MCP_TOOL_HINT, gerritMcpScriptPath, buildGerritEnv } = require('./mcp/gerrit-mcp-shared.js');
const { OPENGROK_MCP_SERVER_NAME, OPENGROK_MCP_TOOL_HINT, opengrokMcpScriptPath, buildOpengrokEnv } = require('./mcp/opengrok-mcp-shared.js');
const { DRAWIO_MCP_SERVER_NAME, DRAWIO_MCP_TOOL_HINT, drawioMcpScriptPath } = require('./mcp/drawio-mcp-shared.js');

/**
 * 确保 Pi Agent 拥有 TabonKB 专有 MCP 工具配置 (幂等, 自动写入)
 * 配置写入 ~/.pi/agent/mcp.json
 */
function ensurePiMcpServers(vaultBasePath) {
  try {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Administrator';
    const piAgentDir = path.join(userProfile, '.pi', 'agent');
    const mcpConfigFile = path.join(piAgentDir, 'mcp.json');

    const nodeExe = weknoraMcpResolveNodeExe();
    const tools = {
      [WEKNORA_MCP_SERVER_NAME]: {
        script: weknoraMcpScriptPath(vaultBasePath),
        description: '知识库全文检索与多模态内容提取（Weknora 引擎）',
        env: buildWeknoraEnv(vaultBasePath)
      },
      [VENDOR_MCP_SERVER_NAME]: {
        script: vendorMcpScriptPath(vaultBasePath),
        description: '芯片原厂技术资料检索（紫光展锐 Unisoc、联发科 MTK）',
        env: buildVendorEnv(vaultBasePath)
      },
      [GERRIT_MCP_SERVER_NAME]: {
        script: gerritMcpScriptPath(vaultBasePath),
        description: 'Gerrit 代码审查平台集成（提交查询、评审意见、CI 状态）',
        env: buildGerritEnv(vaultBasePath)
      },
      [OPENGROK_MCP_SERVER_NAME]: {
        script: opengrokMcpScriptPath(vaultBasePath),
        description: 'OpenGrok 源码全局搜索与交叉引用',
        env: buildOpengrokEnv(vaultBasePath)
      },
      [DRAWIO_MCP_SERVER_NAME]: {
        script: drawioMcpScriptPath(vaultBasePath),
        description: 'Draw.io 图表操作（导出、渲染、SVG 生成）',
        env: {}
      }
    };

    let mcpConfig = { mcpServers: {} };
    if (fs.existsSync(mcpConfigFile)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf8')) || { mcpServers: {} };
      } catch (_) {
        mcpConfig = { mcpServers: {} };
      }
    }
    mcpConfig.mcpServers = mcpConfig.mcpServers || {};

    let mcpChanged = false;
    for (const [name, config] of Object.entries(tools)) {
      if (!config.script || !fs.existsSync(config.script)) continue;
      
      const existing = mcpConfig.mcpServers[name];
      const same = existing 
        && existing.command === nodeExe 
        && Array.isArray(existing.args) 
        && existing.args[0] === config.script;
      
      if (!same) {
        mcpConfig.mcpServers[name] = {
          command: nodeExe,
          args: [config.script],
          env: Object.assign({}, config.env, {
            TABONKB_VAULT_PATH: vaultBasePath,
            TABONKB_VAULT_NAME: path.basename(vaultBasePath)
          }),
          description: config.description
        };
        mcpChanged = true;
      }
    }

    if (mcpChanged) {
      if (!fs.existsSync(piAgentDir)) fs.mkdirSync(piAgentDir, { recursive: true });
      fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2), 'utf8');
    }

    return { ok: true, mcpChanged };
  } catch (err) {
    console.warn('[PiAgentBridge] MCP auto-provisioning warning:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * PiAgentBridge: Manages the headless Pi Coding Agent via stdin/stdout JSONL RPC.
 * - Spawns Node running Pi CLI bundle with restricted tools: read, grep, find, ls
 * - Enforces read-only safety guard
 * - Handles line buffering and encoding
 * - Filters out Chain-of-Thought (thinking_delta)
 * - Emits clean events for UI consumption
 */
class PiAgentBridge {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || (process.cwd ? process.cwd() : 'd:\\work\\Mgmt\\TabonKB');
    this.plugin = options.plugin || null;
    this.listeners = new Map();
    this.process = null;
    this.stdoutBuffer = '';
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'thinking' | 'running_tool' | 'error'
    this.statusDetail = '';
    this.isStreaming = false;
    this.activeTools = new Map();
    this.requestIdCounter = 1;
    this.pendingCommands = new Map();
    this.currentTurnHasText = false;
    this.lastTurnError = null;
    this._inInlineThink = false;
    this._thinkParserBuffer = '';
    this._sessionFileSynced = false;
    this.activeProvider = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-provider')) || 'cc-switch-deep-seek';
    this.activeModelId = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model')) || 'deepseek-v4-flash';
    this.activeReasoningEffort = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-reasoning-effort')) || 'max';

    // 三档权限: readonly(只读) / readwrite(读写, 默认) / full(完全权限); 旧存档 'readwrite' 语义保留为读写档
    this.permissionMode = ['readonly', 'readwrite', 'full'].includes(options.permissionMode) ? options.permissionMode : 'readwrite';
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-agent-permission-mode');
        if (saved === 'readonly' || saved === 'readwrite' || saved === 'full') {
          this.permissionMode = saved;
        }
      }
    } catch (e) {}

    // Default bundle path verified on system
    const appData = process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming';
    const defaultNodeDir = path.join(appData, 'node-v24.15.0');
    const defaultNodeExe = path.join(defaultNodeDir, 'node.exe');

    let resolvedNode = options.nodePath;
    if (!resolvedNode || resolvedNode === 'node') {
      if (fs.existsSync(defaultNodeExe)) {
        resolvedNode = defaultNodeExe;
      } else {
        resolvedNode = 'node';
      }
    }
    this.customNodePath = resolvedNode;
    this.nodeDir = defaultNodeDir;

    this.piBundlePath = options.piBundlePath || path.join(
      defaultNodeDir,
      'node_modules',
      '@earendil-works',
      'pi-coding-agent',
      'dist',
      'bundle',
      'cli.js'
    );

    // Register cleanup hooks for window unload
    this.bindGlobalUnloadHooks();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      if (fn) {
        handlers.delete(fn);
        if (handlers.size === 0) {
          this.listeners.delete(event);
        }
      } else {
        this.listeners.delete(event);
      }
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (e) {
          console.error(`[PiAgentBridge] Error in event handler '${event}':`, e);
        }
      }
    }
  }

  setStatus(status, detail = '') {
    if (this.status === status && this.statusDetail === detail) return;
    this.status = status;
    this.statusDetail = detail;
    this.emit('status_change', { status, detail });
  }

  getStatus() {
    return { status: this.status, detail: this.statusDetail };
  }

  getPermissionMode() {
    return this.permissionMode;
  }

  async setPermissionMode(mode) {
    if (mode !== 'readonly' && mode !== 'readwrite' && mode !== 'full') return;
    if (this.permissionMode === mode) return;
    this.permissionMode = mode;
    this.emit('permission_change', mode);
    if (this.process) {
      this.destroy();
      await this.start();
    }
  }

  bindGlobalUnloadHooks() {
    this._unloadHandler = () => {
      this.destroy();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._unloadHandler);
      window.addEventListener('unload', this._unloadHandler);
    }
  }

  // 返回所有可用的 Pi 原生扩展路径 (vendor-portal + weknora-portal + opengrok-portal + gerrit-portal + codegraph-portal)
  // 优先级: .pi/extensions > plugin/extensions; 供 --extension 多次传入
  getExtensionPaths() {
    const names = ['vendor-portal.ts', 'weknora-portal.ts', 'opengrok-portal.ts', 'gerrit-portal.ts', 'jira-portal.ts', 'codegraph-portal.ts', 'drawio-portal.ts', 'local-project-portal.ts', 'remote-exec-portal.ts'];
    const result = [];
    for (const name of names) {
      const candidates = [
        path.join(this.vaultBasePath, '.pi', 'extensions', name),
        path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'extensions', name)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) { result.push(c); break; }
      }
    }
    return result;
  }

  getExtensionPath() {
    const list = this.getExtensionPaths();
    return list.length ? list[0] : null;
  }

  /**
   * Determine launch executable: direct node + bundle cli.js (cleanest) or fallback to pi.cmd
   */
  resolveLaunchCommand() {
    // baseTools: 只读档无 write/edit; 读写与完全权限档保留本地写能力
    const baseTools = this.permissionMode === 'readonly'
      ? 'read,grep,find,ls'
      : 'read,write,edit,grep,find,ls';
    const weknoraTools = ',weknora_list_knowledge_bases,weknora_search,weknora_ask,weknora_list_documents,weknora_read_document,weknora_add_document,weknora_update_document,weknora_delete_document';
    const opengrokTools = ',opengrok_list_projects,opengrok_search_code,opengrok_read_file';
    const gerritTools = ',gerrit_search_changes,gerrit_get_change,gerrit_get_diff,gerrit_get_comments,gerrit_list_projects';
    const jiraTools = ',jira_search_issues,jira_get_issue,jira_get_comments,jira_list_attachments,jira_download_attachment';
    const codegraphTools = ',codegraph_explore';
    const drawioTools = ',drawio_create,drawio_load,drawio_get,drawio_edit,drawio_export,drawio_list_pages,drawio_add_page,drawio_rename_page,drawio_delete_page';
    // project_edit_file/project_compile 仅非只读档放行; remote_exec 各档均注册由 checkCommand 把关
    const localProjectTools = this.permissionMode === 'readonly'
      ? ',project_read_file'
      : ',project_read_file,project_edit_file,project_compile';
    const tools = `${baseTools},remote_exec,vendor_portal_search,vendor_portal_get_detail${weknoraTools}${opengrokTools}${gerritTools}${jiraTools}${codegraphTools}${drawioTools}${localProjectTools}`;

    const extPaths = this.getExtensionPaths();
    const extArgs = [];
    for (const ep of extPaths) { extArgs.push('--extension', ep); }
    const modelArgs = [
      '--provider', this.activeProvider || 'cc-switch-deep-seek',
      '--model', this.activeModelId || 'deepseek-v4-flash'
    ];
    if (this.activeReasoningEffort) {
      modelArgs.push('--thinking', this.activeReasoningEffort);
    }
    const resumeFile = this._getSavedSessionFile();
    const sessionArgs = resumeFile ? ['--session', resumeFile] : [];

    const defaultNodeDir = this.nodeDir || path.join(
      process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
      'node-v24.15.0'
    );
    const defaultNodeExe = path.join(defaultNodeDir, 'node.exe');
    let nodeCmd = this.customNodePath;
    if ((!nodeCmd || nodeCmd === 'node') && fs.existsSync(defaultNodeExe)) {
      nodeCmd = defaultNodeExe;
      this.customNodePath = nodeCmd;
    }

    if (fs.existsSync(this.piBundlePath)) {
      return {
        cmd: nodeCmd,
        args: [
          this.piBundlePath,
          '--mode', 'rpc',
          '--tools', tools,
          ...modelArgs,
          ...sessionArgs,
          ...extArgs
        ],
        nodeDir: defaultNodeDir
      };
    }

    // Fallback: try pi.cmd directly
    const piCmd = path.join(defaultNodeDir, 'pi.cmd');
    if (fs.existsSync(piCmd)) {
      return {
        cmd: piCmd,
        args: [
          '--mode', 'rpc',
          '--tools', tools,
          ...modelArgs,
          ...sessionArgs,
          ...extArgs
        ],
        nodeDir: defaultNodeDir
      };
    }

    // Fallback: try pi command via cmd.exe
    return {
      cmd: 'cmd.exe',
      args: [
        '/c', 'pi',
        '--mode', 'rpc',
        '--tools', tools,
        ...modelArgs,
        ...sessionArgs,
        ...extArgs
      ],
      nodeDir: defaultNodeDir
    };
  }

  _vaultSessionKey() {
    return String(this.vaultBasePath || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  _getSessionFileMap() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-pi-session-files');
        const map = raw ? JSON.parse(raw) : {};
        return (map && typeof map === 'object') ? map : {};
      }
    } catch (e) {}
    return {};
  }

  _getSavedSessionFile() {
    const file = this._getSessionFileMap()[this._vaultSessionKey()];
    if (!file || !fs.existsSync(file)) return null;
    try {
      const firstLine = String(fs.readFileSync(file, 'utf-8')).split('\n', 1)[0];
      const header = JSON.parse(firstLine);
      const fileCwd = String(header.cwd || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
      if (fileCwd && fileCwd === this._vaultSessionKey()) return file;
    } catch (e) {}
    return null;
  }

  _saveSessionFile(file) {
    if (!file || typeof localStorage === 'undefined') return;
    try {
      const key = this._vaultSessionKey();
      const map = this._getSessionFileMap();
      if (map[key] === file) return;
      map[key] = file;
      localStorage.setItem('tabonkb-pi-session-files', JSON.stringify(map));
    } catch (e) {}
  }

  async _syncSessionFile() {
    if (!this.process || this.process.killed) return;
    try {
      const res = await this.sendCommand({ type: 'get_state' });
      const data = (res && res.data) || {};
      if (data.sessionFile) this._saveSessionFile(data.sessionFile);
      // fork / 会话恢复后 pi 活跃模型会回退到分支内最后一条 model_change——
      // 以用户当前选择的模型为准重新声明，不做任何自动切换模型的尝试
      const cur = data.model || {};
      if (this.activeModelId && cur.id && cur.id !== this.activeModelId) {
        try {
          await this.sendCommand({ type: 'set_model', provider: this.activeProvider, modelId: this.activeModelId });
          if (this.activeReasoningEffort) {
            try { await this.sendCommand({ type: 'set_thinking_level', level: this.activeReasoningEffort }); } catch (_) {}
          }
        } catch (e) {
          console.warn('[PiAgentBridge] re-assert selected model failed:', e);
        }
      }
    } catch (e) {}
  }

  /**
   * 净化会话文件：剥离 assistant 消息中 thinking 块的 thinkingSignature。
   * 上游对过期加密推理内容报 invalid_encrypted_content(400)，剥离后重放恢复。
   * 写回前留 .bak 备份。返回剥离的签名数。
   */
  _stripSessionSignatures(file) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      let stripped = 0;
      const out = raw.split('\n').map((line) => {
        if (!line.trim()) return line;
        try {
          const entry = JSON.parse(line);
          const msg = entry && entry.message;
          if (msg && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part && typeof part === 'object' && 'thinkingSignature' in part) {
                delete part.thinkingSignature;
                stripped++;
              }
            }
          }
          return JSON.stringify(entry);
        } catch (e) { return line; }
      });
      if (stripped > 0) {
        try { fs.writeFileSync(file + '.bak', raw); } catch (_) {}
        fs.writeFileSync(file, out.join('\n'));
      }
      return stripped;
    } catch (e) {
      console.warn('[PiAgentBridge] strip session signatures failed:', e);
      return 0;
    }
  }

  /**
   * invalid_encrypted_content 自愈：停进程 → 净化会话文件 → --session 重启恢复。
   * 保留全部对话上下文，仅剥离失效的加密推理签名。返回 true=已修复可重发。
   */
  async repairEncryptedContentSession() {
    let file = null;
    try {
      const res = await this.sendCommand({ type: 'get_state' });
      file = res && res.data && res.data.sessionFile;
    } catch (e) {}
    if (!file) file = this._getSavedSessionFile();
    if (!file || !fs.existsSync(file)) return false;
    this.destroy();
    const stripped = this._stripSessionSignatures(file);
    // 恢复锚点已在 localStorage 指向该文件，start() 会带 --session 加载净化后的会话
    const ok = await this.start();
    return !!(ok && stripped > 0);
  }

  /**
   * Start the Pi RPC process
   */
  async start() {
    if (this.process && !this.process.killed) {
      return true;
    }

    // Auto-provision TabonKB MCP servers for Pi Agent (idempotent)
    try {
      ensurePiMcpServers(this.vaultBasePath);
    } catch (e) {
      console.warn('[PiAgentBridge] MCP auto-provisioning skipped:', e.message);
    }

    this.setStatus('connecting', '正在启动 Pi 核心引擎...');
    const launch = this.resolveLaunchCommand();

    try {
      const nodeDir = launch.nodeDir || this.nodeDir || path.join(
        process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
        'node-v24.15.0'
      );
      const originalPath = process.env.PATH || process.env.Path || '';
      const envPath = nodeDir ? `${nodeDir}${path.delimiter}${originalPath}` : originalPath;

      // Extract vendor portal credentials
      let unisocToken = process.env.TABONKB_UNISOC_TOKEN || '';
      let mtkUsername = process.env.TABONKB_MTK_USERNAME || '';
      let mtkPassword = process.env.TABONKB_MTK_PASSWORD || '';

      try {
        const plugin = this.plugin || (typeof window !== 'undefined' && (window.app?.plugins?.getPlugin?.('tabonkb-workbench') || window.app?.plugins?.plugins?.['tabonkb-workbench']));
        if (plugin) {
          if (typeof plugin.getSecret === 'function') {
            if (!unisocToken) unisocToken = (await plugin.getSecret('tabonkb-unisoc-password')) || '';
            if (!mtkPassword) mtkPassword = (await plugin.getSecret('tabonkb-mtk-password')) || '';
          }
          if (plugin.settings?.vendorPortals?.mtk?.username && !mtkUsername) {
            mtkUsername = plugin.settings.vendorPortals.mtk.username;
          }
        }
      } catch (_) {}

      if (!unisocToken && typeof localStorage !== 'undefined') {
        unisocToken = localStorage.getItem('tabonkb-secret-tabonkb-unisoc-password') || '';
      }
      if (!mtkPassword && typeof localStorage !== 'undefined') {
        mtkPassword = localStorage.getItem('tabonkb-secret-tabonkb-mtk-password') || '';
      }

      try {
        const secCandidates = [
          path.join(this.vaultBasePath, '.secrets.json'),
          path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json')
        ];
        for (const secPath of secCandidates) {
          if (fs.existsSync(secPath)) {
            const sdata = JSON.parse(fs.readFileSync(secPath, 'utf8'));
            if (!unisocToken && sdata['tabonkb-unisoc-password']) unisocToken = sdata['tabonkb-unisoc-password'];
            if (!mtkPassword && sdata['tabonkb-mtk-password']) mtkPassword = sdata['tabonkb-mtk-password'];
          }
        }
      } catch (_) {}

      try {
        if (!mtkUsername) {
          const dataJsonPath = path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'data.json');
          if (fs.existsSync(dataJsonPath)) {
            const dj = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            mtkUsername = dj?.vendorPortals?.mtk?.username || '';
          }
        }
      } catch (_) {}

      // Extract WeKnora knowledge-base config + credential (env > plugin.getSecret > localStorage > .secrets.json > data.json)
      let weknoraBase = process.env.WEKNORA_BASE_URL || '';
      let weknoraKey = process.env.WEKNORA_API_KEY || '';
      let weknoraKb = process.env.WEKNORA_DEFAULT_KB || '';
      try {
        const plugin = this.plugin || (typeof window !== 'undefined' && (window.app?.plugins?.getPlugin?.('tabonkb-workbench') || window.app?.plugins?.plugins?.['tabonkb-workbench']));
        if (plugin) {
          if (!weknoraBase && plugin.settings?.weknora?.baseUrl) weknoraBase = plugin.settings.weknora.baseUrl;
          if (!weknoraKb && plugin.settings?.weknora?.defaultKb) weknoraKb = plugin.settings.weknora.defaultKb;
          if (!weknoraKey && typeof plugin.getSecret === 'function') {
            weknoraKey = (await plugin.getSecret('tabonkb-weknora-apikey')) || '';
          }
        }
      } catch (_) {}
      if (!weknoraKey && typeof localStorage !== 'undefined') {
        weknoraKey = localStorage.getItem('tabonkb-secret-tabonkb-weknora-apikey') || '';
      }
      try {
        const secCandidates = [
          path.join(this.vaultBasePath, '.secrets.json'),
          path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json')
        ];
        for (const secPath of secCandidates) {
          if (fs.existsSync(secPath)) {
            const sdata = JSON.parse(fs.readFileSync(secPath, 'utf8'));
            if (!weknoraKey && sdata['tabonkb-weknora-apikey']) weknoraKey = sdata['tabonkb-weknora-apikey'];
          }
        }
      } catch (_) {}
      // Extract OpenGrok code search config (env > plugin.settings > data.json)
      let opengrokBase = process.env.OPENGROK_BASE_URL || '';
      let opengrokProject = process.env.OPENGROK_DEFAULT_PROJECT || '';
      try {
        const plugin = this.plugin || (typeof window !== 'undefined' && (window.app?.plugins?.getPlugin?.('tabonkb-workbench') || window.app?.plugins?.plugins?.['tabonkb-workbench']));
        if (plugin) {
          if (!opengrokBase && plugin.settings?.opengrok?.baseUrl) opengrokBase = plugin.settings.opengrok.baseUrl;
          if (!opengrokProject && plugin.settings?.opengrok?.defaultProject) opengrokProject = plugin.settings.opengrok.defaultProject;
        }
      } catch (_) {}
      try {
        if (!opengrokBase || !opengrokProject) {
          const dataJsonPath = path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'data.json');
          if (fs.existsSync(dataJsonPath)) {
            const dj = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            if (!opengrokBase) opengrokBase = dj?.opengrok?.baseUrl || '';
            if (!opengrokProject) opengrokProject = dj?.opengrok?.defaultProject || '';
          }
        }
      } catch (_) {}

      this.process = child_process.spawn(launch.cmd, launch.args, {
        cwd: this.vaultBasePath,
        env: Object.assign({}, process.env, {
          PATH: envPath,
          Path: envPath,
          LANG: 'en_US.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          TABONKB_UNISOC_TOKEN: unisocToken,
          TABONKB_MTK_USERNAME: mtkUsername,
          TABONKB_MTK_PASSWORD: mtkPassword,
          WEKNORA_BASE_URL: weknoraBase,
          WEKNORA_API_KEY: weknoraKey,
          WEKNORA_DEFAULT_KB: weknoraKb,
          OPENGROK_BASE_URL: opengrokBase,
          OPENGROK_DEFAULT_PROJECT: opengrokProject,
          TABONKB_PERM_MODE: this.permissionMode
        }),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdin.setDefaultEncoding('utf-8');
      this.process.stdout.setEncoding('utf-8');
      this.process.stderr.setEncoding('utf-8');

      this.process.stdout.on('data', (chunk) => {
        this.handleStdoutChunk(chunk);
      });

      this.process.stderr.on('data', (chunk) => {
        const errText = chunk.toString();
        // Ignore cosmetic warnings, log real errors
        if (errText.toLowerCase().includes('error')) {
          console.warn('[PiAgentBridge stderr]:', errText);
        }
      });

      this.process.on('error', (err) => {
        console.error('[PiAgentBridge] Process error:', err);
        this._rejectAllPendingCommands(err);
        this.setStatus('error', `启动失败: ${err.message}`);
        this.emit('error', err);
      });

      this.process.on('close', (code, signal) => {
        console.log(`[PiAgentBridge] Process closed (code: ${code}, signal: ${signal})`);
        this.process = null;
        this.activeTools.clear();
        this._flushTextOrThinkingBuffer();
        this._rejectAllPendingCommands(new Error(`Pi 进程已关闭 (code: ${code}, signal: ${signal})`));
        this.setStatus('disconnected', code === 0 ? '已断开连接' : `异常退出 (Code: ${code})`);
      });

      // Give 500ms to confirm initial readiness
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.process && !this.process.killed) {
        this.setStatus('connected', '已就绪');
        this._sessionFileSynced = false;
        this._syncSessionFile();
        return true;
      }
      this._rejectAllPendingCommands(new Error('Pi 进程启动后立即退出'));
      return false;
    } catch (err) {
      this._rejectAllPendingCommands(err);
      this.setStatus('error', `启动异常: ${err.message}`);
      this.emit('error', err);
      return false;
    }
  }

  /**
   * Reject and clear all in-flight RPC promises when process dies or is destroyed
   * @private
   */
  _rejectAllPendingCommands(error) {
    if (!this.pendingCommands || this.pendingCommands.size === 0) return;
    const err = error instanceof Error ? error : new Error(String(error || 'Pi 核心进程已断开或退出'));
    for (const [id, pending] of this.pendingCommands.entries()) {
      try {
        if (pending && typeof pending.reject === 'function') {
          pending.reject(err);
        }
      } catch (_) {}
    }
    this.pendingCommands.clear();
  }

  /**
   * Flush any remaining partial chunks from incremental thinking/text buffer
   * @private
   */
  _flushTextOrThinkingBuffer() {
    if (this._thinkParserBuffer && this._thinkParserBuffer.length > 0) {
      const remaining = this._thinkParserBuffer;
      this._thinkParserBuffer = '';
      if (this._inInlineThink) {
        this.emit('thinking_delta', remaining);
        this.emit('thinking_end', {});
      } else {
        this.emit('text_delta', remaining);
      }
    }
    this._inInlineThink = false;
  }

  /**
   * Line buffering and JSONL parsing
   */
  handleStdoutChunk(chunk) {
    this.stdoutBuffer += chunk;
    let newlineIdx;
    while ((newlineIdx = this.stdoutBuffer.indexOf('\n')) !== -1) {
      let line = this.stdoutBuffer.substring(0, newlineIdx);
      this.stdoutBuffer = this.stdoutBuffer.substring(newlineIdx + 1);
      if (line.endsWith('\r')) {
        line = line.substring(0, line.length - 1);
      }
      line = line.trim();
      if (!line) continue;

      try {
        const message = JSON.parse(line);
        this.handleRpcMessage(message);
      } catch (err) {
        console.warn('[PiAgentBridge] JSON parse failed for line:', line.substring(0, 100), err);
      }
    }
  }

  /**
   * Dispatch RPC events and command responses
   */
  handleRpcMessage(data) {
    const type = data.type;

    // 1. Command responses
    if (type === 'response') {
      const id = data.id;
      if (id && this.pendingCommands.has(id)) {
        const { resolve, reject } = this.pendingCommands.get(id);
        this.pendingCommands.delete(id);
        if (data.error || data.success === false) {
          if (reject) reject(new Error(data.error || data.message || '命令执行失败'));
        } else {
          resolve(data);
        }
      }
      return;
    }

    // 2. Lifecycle & Agent State Events
    if (type === 'agent_start') {
      this.isStreaming = true;
      this.setStatus('thinking', '正在思考与规划...');
      this.emit('agent_start', data);
      return;
    }

    if (type === 'turn_start') {
      this.isStreaming = true;
      this.currentTurnHasText = false;
      this.lastTurnError = null;
      this._inInlineThink = false;
      this._thinkParserBuffer = '';
      this.setStatus('thinking', '正在思考与规划...');
      this.emit('turn_start', data);
      return;
    }

    if (type === 'auto_retry_start') {
      const attempt = data.attempt || 1;
      const maxAttempts = data.maxAttempts || 3;
      const errMsg = data.errorMessage || '';
      const retryDesc = errMsg ? `正在重试 (${attempt}/${maxAttempts}): ${errMsg.slice(0, 30)}...` : `正在重试请求 (${attempt}/${maxAttempts})...`;
      this.setStatus('thinking', retryDesc);
      return;
    }

    if (type === 'agent_end' || type === 'agent_settled') {
      if (type === 'agent_end' && data && data.willRetry) {
        return;
      }
      this.isStreaming = false;
      this.activeTools.clear();
      this._flushTextOrThinkingBuffer();
      this.setStatus('connected', '已就绪');
      this.emit('agent_settled', data);
      this._settleDrawioArtifact();
      return;
    }

    if (type === 'queue_update') {
      // Pi 原生 steer/followUp 队列快照：入队、被消费（message_start 前）与 clear_queue 均会广播
      this.emit('queue_update', {
        steering: Array.isArray(data.steering) ? data.steering.slice() : [],
        followUp: Array.isArray(data.followUp) ? data.followUp.slice() : []
      });
      return;
    }

    if (type === 'compaction_start') {
      this.setStatus('thinking', '正在压缩上下文...');
      this.emit('compaction_start', data);
      return;
    }

    if (type === 'compaction_end') {
      this.setStatus('connected', '已就绪');
      this.emit('compaction_end', data);
      return;
    }

    if (type === 'message_start') {
      // 用户消息回显：prompt / steer / followUp 被实际写入会话树时触发，供 UI 对账去重
      const m = data.message;
      if (m && m.role === 'user') {
        const text = Array.isArray(m.content)
          ? m.content.filter(p => p && p.type === 'text').map(p => p.text || '').join('\n')
          : (typeof m.content === 'string' ? m.content : '');
        this.emit('user_message', { text });
      }
      return;
    }

    if (type === 'turn_end') {
      const msg = data.message;
      if (msg && (msg.stopReason === 'error' || msg.errorMessage)) {
        const errMsg = msg.errorMessage || '上游模型调用异常';
        this.lastTurnError = errMsg;
        if (!this.currentTurnHasText) {
          const isRateLimit = /concurrency|rate_limit|429|too many/i.test(errMsg);
          const isDedup = /reconciliation_required|could not be confirmed|do not submit it again/i.test(errMsg);
          const isEncrypted = /invalid_encrypted_content|encrypted content could not be|could not be verified/i.test(errMsg);
          const tip = isEncrypted
            ? `💡 **原因与建议**: 会话历史中的加密推理内容已过期失效，已自动净化并重新尝试本题。`
            : isDedup
            ? `💡 **原因与建议**: 上游网关去重保护（reconciliation_required）拒绝了请求——同会话重发同一上下文大概率再次被拒，建议开新会话后重发或切换备选通道。`
            : isRateLimit
              ? `💡 **原因与建议**: 上游 API 通道临时并发受限 (Rate Limit / 429)。该通道正常可用，通常等待数秒后再试即可恢复。`
              : `💡 **原因与建议**: 上游 API 接口返回错误或网络异常，请稍后重试或切换备选通道。`;
          const notice = `\n\n> ⚠️ **上游模型通道调用异常**\n> 错误信息: \`${errMsg}\`\n>\n> ${tip}\n`;
          this.emit('text_delta', notice);
          this.currentTurnHasText = true;
        }
        this.emit('error', {
          message: errMsg,
          stopReason: msg.stopReason,
          encrypted: /invalid_encrypted_content|encrypted content could not be|could not be verified/i.test(errMsg)
        });
      }
      this._flushTextOrThinkingBuffer();
      this.emit('turn_end', data);
      return;
    }

    // 3. Streaming Assistant Message Updates
    if (type === 'message_update') {
      const ev = data.assistantMessageEvent;
      if (!ev) return;

      // Handle native thinking / CoT events (DeepSeek, Anthropic, OpenAI reasoning)
      if (typeof ev.type === 'string' && ev.type.startsWith('thinking_')) {
        if (ev.type === 'thinking_start') {
          this.emit('thinking_start', ev);
        } else if (ev.type === 'thinking_delta' && typeof ev.delta === 'string') {
          if (ev.delta.length > 0) {
            this.emit('thinking_delta', ev.delta);
          }
        } else if (ev.type === 'thinking_end') {
          this.emit('thinking_end', ev);
        }
        return;
      }

      if (ev.type === 'text_delta' && typeof ev.delta === 'string') {
        if (ev.delta.length > 0) {
          this.currentTurnHasText = true;
        }
        this._handleTextOrThinkingDelta(ev.delta);
      }
      return;
    }

    // 4. Tool Execution Events
    if (type === 'tool_execution_start') {
      const { toolCallId, toolName, args } = data;
      const startTime = Date.now();
      this.activeTools.set(toolCallId, { toolName, args, startTime });

      let actionDesc = '正在执行工具';
      if (toolName === 'read') {
        const p = args?.path || '';
        actionDesc = `正在读取: ${path.basename(p) || p}`;
      } else if (toolName === 'write') {
        const p = args?.path || '';
        actionDesc = `正在创建/写入: ${path.basename(p) || p}`;
      } else if (toolName === 'edit') {
        const p = args?.path || '';
        actionDesc = `正在修改编辑: ${path.basename(p) || p}`;
      } else if (toolName === 'grep') {
        const pat = args?.pattern || '';
        actionDesc = `正在检索: "${pat}"`;
      } else if (toolName === 'find') {
        const pat = args?.pattern || '';
        actionDesc = `正在查找: "${pat}"`;
      } else if (toolName === 'ls') {
        actionDesc = `正在查看目录清单`;
      } else if (toolName === 'vendor_portal_search') {
        const q = args?.query || '';
        const v = args?.vendor && args.vendor !== 'all' ? ` (${args.vendor})` : '';
        actionDesc = `正在检索芯片原厂资料${v}: "${q}"`;
      } else if (toolName === 'vendor_portal_get_detail') {
        const docId = args?.docId || '';
        const v = args?.vendor ? ` [${args.vendor}]` : '';
        actionDesc = `正在调取原厂技术方案${v}: ${docId}`;
      } else if (toolName === 'weknora_search') {
        actionDesc = `正在检索团队知识库: "${args?.query || ''}"`;
      } else if (toolName === 'weknora_ask') {
        actionDesc = `正在向知识库提问: "${args?.query || ''}"`;
      } else if (toolName === 'weknora_list_knowledge_bases') {
        actionDesc = '正在列出知识库...';
      } else if (toolName === 'weknora_list_documents') {
        actionDesc = '正在查看知识库文档清单...';
      } else if (toolName === 'weknora_read_document') {
        actionDesc = `正在读取知识文档: ${args?.knowledge_id || ''}`;
      } else if (toolName === 'weknora_add_document') {
        actionDesc = `正在写入知识库: ${args?.title || ''}`;
      } else if (toolName === 'weknora_update_document') {
        actionDesc = `正在更新知识文档: ${args?.knowledge_id || ''}`;
      } else if (toolName === 'weknora_delete_document') {
        actionDesc = `正在删除知识文档: ${args?.knowledge_id || ''}`;
      } else if (toolName === 'opengrok_search_code') {
        const q = args?.query || '';
        const p = args?.project ? ` [${args.project}]` : '';
        actionDesc = `正在检索 OpenGrok 代码${p}: "${q}"`;
      } else if (toolName === 'opengrok_read_file') {
        const f = args?.file_path ? path.basename(args.file_path) : '';
        actionDesc = `正在阅读 OpenGrok 源码: ${f || args?.file_path || ''}`;
      } else if (toolName === 'opengrok_list_projects') {
        actionDesc = '正在获取 OpenGrok 代码工程清单...';
      } else if (toolName === 'gerrit_search_changes') {
        const q = args?.query || (args?.project ? `工程: ${args.project}` : '');
        actionDesc = `正在检索 Gerrit 代码评审${q ? `: "${q}"` : ''}`;
      } else if (toolName === 'gerrit_get_change') {
        actionDesc = `正在查阅 Gerrit 评审详情: #${args?.change_id || ''}`;
      } else if (toolName === 'gerrit_get_diff') {
        const f = args?.file_path ? ` (${path.basename(args.file_path)})` : '';
        actionDesc = `正在查阅 Gerrit 代码变更 Diff: #${args?.change_id || ''}${f}`;
      } else if (toolName === 'gerrit_get_comments') {
        actionDesc = `正在查阅 Gerrit 行内评审意见: #${args?.change_id || ''}`;
      } else if (toolName === 'jira_search_issues') {
        actionDesc = `检索 Jira 工单: ${args?.query || '默认 JQL'}`;
      } else if (toolName === 'jira_get_issue') {
        actionDesc = `读取 Jira 工单详情: ${args?.issue_key || ''}`;
      } else if (toolName === 'jira_get_comments') {
        actionDesc = `读取 Jira 注释: ${args?.issue_key || ''}`;
      } else if (toolName === 'jira_list_attachments') {
        actionDesc = `列出 Jira 附件: ${args?.issue_key || ''}`;
      } else if (toolName === 'jira_download_attachment') {
        actionDesc = `下载 Jira 附件: ${args?.issue_key || ''} · ${args?.attachment || ''}`;
      } else if (toolName === 'gerrit_list_projects') {
        actionDesc = '正在获取 Gerrit 代码工程仓库清单...';
      } else if (toolName === 'codegraph_explore') {
        const tree = args?.tree === 'mtk-bootloader' ? '联发科 bootloader' : (args?.tree === 'mtk-kernel' ? '联发科内核' : (args?.tree === 'mtk-driver' ? '联发科私有驱动' : (args?.tree === 'driver' ? '展锐私有驱动' : '展锐内核')));
        actionDesc = `正在查询 CodeGraph ${tree}: "${args?.query || ''}"`;
      } else if (toolName === 'drawio_create' || toolName === 'drawio_edit' || toolName === 'drawio_add_page') {
        actionDesc = '正在绘制图表';
      } else if (toolName === 'drawio_export') {
        actionDesc = '正在导出图表';
      } else if (toolName === 'drawio_load' || toolName === 'drawio_get' || toolName === 'drawio_list_pages') {
        actionDesc = '正在读取图表';
      } else if (String(toolName || '').indexOf('drawio_') === 0) {
        actionDesc = '正在更新图表';
      }

      this.setStatus('running_tool', actionDesc);
      this.emit('tool_start', { toolCallId, toolName, args, startTime, actionDesc });
      return;
    }

    if (type === 'tool_execution_end') {
      const { toolCallId, toolName, result, error } = data;
      const info = this.activeTools.get(toolCallId);
      const durationMs = info ? (Date.now() - info.startTime) : 0;
      this.activeTools.delete(toolCallId);

      const isError = !!error || (result && result.isError);
      this.emit('tool_end', {
        toolCallId,
        toolName,
        result,
        error,
        isError,
        durationMs
      });

      if (this.activeTools.size > 0) {
        const nextTool = this.activeTools.values().next().value;
        this.setStatus('running_tool', `正在执行: ${nextTool.toolName}`);
      } else if (this.isStreaming) {
        this.setStatus('thinking', '正在整理分析回复...');
      }
      return;
    }
  }

  /**
   * Handle text delta stream, cleanly routing inline <think>...</think> blocks to thinking_delta.
   * Uses an incremental parser buffer to prevent tag splits across chunk boundaries (e.g. "<thi" and "nk>").
   * @private
   */
  _handleTextOrThinkingDelta(chunk) {
    if (!chunk || typeof chunk !== 'string') return;
    this._thinkParserBuffer = (this._thinkParserBuffer || '') + chunk;

    const OPEN_TAG = '<think>';
    const CLOSE_TAG = '</think>';

    while (this._thinkParserBuffer.length > 0) {
      if (!this._inInlineThink) {
        const openIdx = this._thinkParserBuffer.indexOf(OPEN_TAG);
        if (openIdx !== -1) {
          const before = this._thinkParserBuffer.slice(0, openIdx);
          if (before) this.emit('text_delta', before);
          this._inInlineThink = true;
          this.emit('thinking_start', {});
          this._thinkParserBuffer = this._thinkParserBuffer.slice(openIdx + OPEN_TAG.length);
        } else {
          // Check if buffer ends with a partial prefix of '<think>' (length 1 to 6)
          let matchedLen = 0;
          const maxCheck = Math.min(OPEN_TAG.length - 1, this._thinkParserBuffer.length);
          for (let len = maxCheck; len >= 1; len--) {
            if (this._thinkParserBuffer.endsWith(OPEN_TAG.slice(0, len))) {
              matchedLen = len;
              break;
            }
          }

          if (matchedLen > 0) {
            const safeText = this._thinkParserBuffer.slice(0, this._thinkParserBuffer.length - matchedLen);
            if (safeText) this.emit('text_delta', safeText);
            this._thinkParserBuffer = this._thinkParserBuffer.slice(this._thinkParserBuffer.length - matchedLen);
            break;
          } else {
            this.emit('text_delta', this._thinkParserBuffer);
            this._thinkParserBuffer = '';
            break;
          }
        }
      } else {
        const closeIdx = this._thinkParserBuffer.indexOf(CLOSE_TAG);
        if (closeIdx !== -1) {
          const inside = this._thinkParserBuffer.slice(0, closeIdx);
          if (inside) this.emit('thinking_delta', inside);
          this._inInlineThink = false;
          this.emit('thinking_end', {});
          this._thinkParserBuffer = this._thinkParserBuffer.slice(closeIdx + CLOSE_TAG.length);
        } else {
          // Check if buffer ends with a partial prefix of '</think>' (length 1 to 7)
          let matchedLen = 0;
          const maxCheck = Math.min(CLOSE_TAG.length - 1, this._thinkParserBuffer.length);
          for (let len = maxCheck; len >= 1; len--) {
            if (this._thinkParserBuffer.endsWith(CLOSE_TAG.slice(0, len))) {
              matchedLen = len;
              break;
            }
          }

          if (matchedLen > 0) {
            const safeText = this._thinkParserBuffer.slice(0, this._thinkParserBuffer.length - matchedLen);
            if (safeText) this.emit('thinking_delta', safeText);
            this._thinkParserBuffer = this._thinkParserBuffer.slice(this._thinkParserBuffer.length - matchedLen);
            break;
          } else {
            this.emit('thinking_delta', this._thinkParserBuffer);
            this._thinkParserBuffer = '';
            break;
          }
        }
      }
    }
  }

  /**
   * Send JSON command to stdin
   */
  sendCommand(commandObj, timeoutMs = 15000) {
    if (!this.process || this.process.killed) {
      throw new Error('Pi 核心进程未就绪或已断开');
    }
    const id = `req-${this.requestIdCounter++}`;
    commandObj.id = id;

    return new Promise((resolve, reject) => {
      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (this.pendingCommands.has(id)) {
            this.pendingCommands.delete(id);
            reject(new Error(`Pi 命令执行超时 (${timeoutMs}ms): ${commandObj.type}`));
          }
        }, timeoutMs);
      }
      this.pendingCommands.set(id, {
        resolve: (data) => {
          if (timer) clearTimeout(timer);
          resolve(data);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        }
      });
      const line = JSON.stringify(commandObj) + '\n';
      try {
        this.process.stdin.write(line, 'utf-8');
      } catch (err) {
        if (timer) clearTimeout(timer);
        this.pendingCommands.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a prompt message
   */
  async sendMessage(messageText) {
    if (!this.process || this.process.killed) {
      const ok = await this.start();
      if (!ok) throw new Error('无法连接到 Pi Agent 进程');
    }

    this.isStreaming = true;
    this.setStatus('thinking', '正在理解上下文...');

    const res = await this.sendCommand({
      type: 'prompt',
      message: messageText
    });
    if (res && res.data && res.data.disposition === 'handled') {
      this.isStreaming = false;
      this.setStatus('connected', '已就绪');
    } else if (!this._sessionFileSynced) {
      this._sessionFileSynced = true;
      this._syncSessionFile();
    }
    return res;
  }

  /**
   * Fetch invocable commands via get_commands RPC (extension commands / prompt templates / skills)
   * Returns [] when the process is down or the command fails; never throws.
   */
  async getCommands() {
    if (!this.process || this.process.killed) return [];
    try {
      const res = await this.sendCommand({ type: 'get_commands' }, 8000);
      const list = res && res.data && res.data.commands;
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('[PiAgentBridge] get_commands failed:', e);
      return [];
    }
  }

  /**
   * 会话统计（含 contextUsage：当前上下文 tokens / 窗口 / 占比）。
   * compact 后首个 LLM 响应前 pi 返回 tokens:null —— 压缩前 usage 不可信。
   */
  async getSessionStats() {
    if (!this.process || this.process.killed) return null;
    try {
      const res = await this.sendCommand({ type: 'get_session_stats' }, 8000);
      return (res && res.data) || null;
    } catch (e) {
      console.warn('[PiAgentBridge] get_session_stats failed:', e);
      return null;
    }
  }

  /**
   * 手动压缩会话上下文（pi RPC compact，内部走 LLM 摘要，耗时较长故放宽超时）。
   */
  async compact(customInstructions) {
    if (!this.process || this.process.killed) {
      throw new Error('Pi 核心进程未就绪或已断开');
    }
    return await this.sendCommand({ type: 'compact', customInstructions }, 120000);
  }

  /**
   * 流式中插队纠偏：pi 在当前工具执行完、下一次 LLM 调用前把该消息注入本轮。
   * @param {string} messageText 用户纠偏内容（原始 wireText，不做上下文注入）
   */
  async steer(messageText) {
    if (!this.process || this.process.killed) {
      throw new Error('Pi 核心进程未就绪或已断开');
    }
    return await this.sendCommand({ type: 'steer', message: messageText });
  }

  /**
   * 流式中排队待办：pi 在本轮完全结束（无剩余工具/插队消息）后自动以新回合消费。
   * @param {string} messageText 用户排队内容
   */
  async followUp(messageText) {
    if (!this.process || this.process.killed) {
      throw new Error('Pi 核心进程未就绪或已断开');
    }
    return await this.sendCommand({ type: 'follow_up', message: messageText });
  }

  /**
   * 清空 pi 侧 steer/followUp 队列，返回被移除的 {steering, followUp} 文本数组。
   * abort 必须搭配本方法：pi 的 abort 不清队列，残留项会污染下一次运行。
   */
  async clearQueue() {
    if (!this.process || this.process.killed) return { steering: [], followUp: [] };
    try {
      const res = await this.sendCommand({ type: 'clear_queue' });
      const d = (res && res.data) || {};
      return {
        steering: Array.isArray(d.steering) ? d.steering : [],
        followUp: Array.isArray(d.followUp) ? d.followUp : []
      };
    } catch (e) {
      return { steering: [], followUp: [] };
    }
  }

  /**
   * 移除单个排队项：pi 仅支持整体清空，采用 清空→按原序重投剩余项 实现。
   * @param {'steer'|'follow'} kind 队列类型
   * @param {string} text 排队项原文（queue_update 快照中的文本）
   */
  async removeQueuedMessage(kind, text) {
    const cleared = await this.clearQueue();
    const steering = cleared.steering.slice();
    const followUp = cleared.followUp.slice();
    const list = kind === 'steer' ? steering : followUp;
    const idx = list.indexOf(text);
    if (idx >= 0) list.splice(idx, 1);
    for (const t of steering) {
      try { await this.sendCommand({ type: 'steer', message: t }); } catch (_) {}
    }
    for (const t of followUp) {
      try { await this.sendCommand({ type: 'follow_up', message: t }); } catch (_) {}
    }
  }

  /**
   * Abort current generation
   */
  async abort() {
    if (!this.process || this.process.killed) return;
    try {
      this.setStatus('thinking', '正在中止操作...');
      await this.sendCommand({ type: 'abort' });
      // 回收未消费的插队/排队消息（pi abort 不清队列），交回 UI 层回填输入框
      const cleared = await this.clearQueue();
      if (cleared.steering.length || cleared.followUp.length) {
        this.emit('queue_cleared', cleared);
      }
    } catch (e) {
      console.warn('[PiAgentBridge] Abort command issue:', e);
    } finally {
      this._flushTextOrThinkingBuffer();
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '已中止操作');
      this._settleDrawioArtifact().finally(() => {
        this.emit('aborted');
      });
    }
  }

  async _settleDrawioArtifact() {
    if (typeof tabonkbSettleDrawio !== 'function') return;
    try {
      const art = await tabonkbSettleDrawio();
      if (art && art.relPng) {
        this.emit('text_delta', `\n\n![[${art.relPng}]]\n`);
      }
    } catch (e) {}
  }

  /**
   * Reset session
   */
  async newSession() {
    if (!this.process || this.process.killed) {
      await this.start();
      this.emit('new_session');
      return;
    }

    try {
      await this.sendCommand({ type: 'new_session' });
    } catch (e) {
      console.warn('[PiAgentBridge] New session failed, restarting process:', e);
      this.destroy();
      await this.start();
    } finally {
      this._flushTextOrThinkingBuffer();
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '新会话已开启');
      await this._syncSessionFile();
      this._sessionFileSynced = true;
      this.emit('new_session');
    }
  }

  /**
   * Set model dynamically via RPC or restart
   */
  async setModel(provider, modelId, thinkingLevel) {
    this.activeProvider = provider;
    this.activeModelId = modelId;
    if (thinkingLevel !== undefined && thinkingLevel !== null) {
      this.activeReasoningEffort = thinkingLevel;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-pi-reasoning-effort', thinkingLevel);
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-active-provider', provider);
      localStorage.setItem('tabonkb-pi-active-model', modelId);
    }
    if (this.process && !this.process.killed) {
      try {
        await this.sendCommand({
          type: 'set_model',
          provider: provider,
          modelId: modelId
        });
        if (this.activeReasoningEffort) {
          try {
            await this.sendCommand({
              type: 'set_thinking_level',
              level: this.activeReasoningEffort
            });
          } catch (_) {}
        }
      } catch (e) {
        console.warn('[PiAgentBridge] setModel RPC failed, restarting process with new model:', e);
        this.destroy();
        await this.start();
      }
    }
  }

  /**
   * 会话分支（fork）：列出可回退的用户消息入口 [{entryId, text}]
   */
  async getForkMessages() {
    if (!this.process || this.process.killed) return [];
    try {
      const res = await this.sendCommand({ type: 'get_fork_messages' });
      return (res && res.data && res.data.messages) || [];
    } catch (e) {
      console.warn('[PiAgentBridge] get_fork_messages failed:', e);
      return [];
    }
  }

  /**
   * 会话分支（fork）：回退到指定用户消息之前并开新分支，返回该消息原文供重写。
   * fork 后 pi 切换到新的分支会话文件，需刷新恢复锚点。
   */
  async forkMessage(entryId) {
    const res = await this.sendCommand({ type: 'fork', entryId });
    const data = (res && res.data) || {};
    this._sessionFileSynced = false;
    await this._syncSessionFile();
    this.isStreaming = false;
    this.activeTools.clear();
    this.setStatus('connected', '已就绪');
    return data;
  }

  /**
   * Set thinking / reasoning level dynamically via RPC
   */
  async setReasoningEffort(level) {
    this.activeReasoningEffort = level;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-reasoning-effort', level);
    }
    if (this.process && !this.process.killed) {
      try {
        await this.sendCommand({
          type: 'set_thinking_level',
          level: level
        });
      } catch (e) {
        console.warn('[PiAgentBridge] set_thinking_level RPC failed, restarting process:', e);
        this.destroy();
        await this.start();
      }
    }
  }

  /**
   * Destroy child process and clean up hooks
   */
  destroy() {
    if (typeof window !== 'undefined' && this._unloadHandler) {
      window.removeEventListener('beforeunload', this._unloadHandler);
      window.removeEventListener('unload', this._unloadHandler);
    }

    this._flushTextOrThinkingBuffer();
    this._rejectAllPendingCommands(new Error('Pi 核心进程已停止服务'));

    if (this.process) {
      const pid = this.process.pid;
      try {
        // Closing stdin causes Pi to immediately and cleanly exit with 0
        this.process.stdin.end();
        this.process.kill('SIGTERM');
      } catch (e) {}

      // Windows process tree fallback cleanup
      if (process.platform === 'win32' && pid) {
        setTimeout(() => {
          try {
            child_process.exec(`taskkill /pid ${pid} /T /F`, () => {});
          } catch (e) {}
        }, 1200);
      }
      this.process = null;
    }
    this.setStatus('disconnected', '已停止服务');
  }
}

module.exports = { PiAgentBridge };
