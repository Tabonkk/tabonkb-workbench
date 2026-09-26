const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

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
    this.activeProvider = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-provider')) || 'cc-switch-deep-seek';
    this.activeModelId = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model')) || 'deepseek-v4-flash';

    this.permissionMode = options.permissionMode || 'readwrite';
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-agent-permission-mode');
        if (saved === 'readonly' || saved === 'readwrite') {
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
    if (this.listeners.has(event)) {
      this.listeners.delete(event);
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
    const names = ['vendor-portal.ts', 'weknora-portal.ts', 'opengrok-portal.ts', 'gerrit-portal.ts', 'codegraph-portal.ts'];
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
    const baseTools = this.permissionMode === 'readwrite'
      ? 'read,write,edit,grep,find,ls'
      : 'read,grep,find,ls';
    const weknoraTools = ',weknora_list_knowledge_bases,weknora_search,weknora_ask,weknora_list_documents,weknora_read_document,weknora_add_document,weknora_update_document,weknora_delete_document';
    const opengrokTools = ',opengrok_list_projects,opengrok_search_code,opengrok_read_file';
    const gerritTools = ',gerrit_search_changes,gerrit_get_change,gerrit_get_diff,gerrit_get_comments,gerrit_list_projects';
    const codegraphTools = ',codegraph_explore';
    const tools = `${baseTools},vendor_portal_search,vendor_portal_get_detail${weknoraTools}${opengrokTools}${gerritTools}${codegraphTools}`;

    const extPaths = this.getExtensionPaths();
    const extArgs = [];
    for (const ep of extPaths) { extArgs.push('--extension', ep); }
    const modelArgs = [
      '--provider', this.activeProvider || 'cc-switch-deep-seek',
      '--model', this.activeModelId || 'deepseek-v4-flash'
    ];

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
        ...extArgs
      ],
      nodeDir: defaultNodeDir
    };
  }

  /**
   * Start the Pi RPC process
   */
  async start() {
    if (this.process && !this.process.killed) {
      return true;
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
          OPENGROK_DEFAULT_PROJECT: opengrokProject
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
        this.setStatus('error', `启动失败: ${err.message}`);
        this.emit('error', err);
      });

      this.process.on('close', (code, signal) => {
        console.log(`[PiAgentBridge] Process closed (code: ${code}, signal: ${signal})`);
        this.process = null;
        this.activeTools.clear();
        this.setStatus('disconnected', code === 0 ? '已断开连接' : `异常退出 (Code: ${code})`);
      });

      // Give 500ms to confirm initial readiness
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.process && !this.process.killed) {
        this.setStatus('connected', '已就绪');
        return true;
      }
      return false;
    } catch (err) {
      this.setStatus('error', `启动异常: ${err.message}`);
      this.emit('error', err);
      return false;
    }
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
        const { resolve } = this.pendingCommands.get(id);
        this.pendingCommands.delete(id);
        resolve(data);
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
      this.isStreaming = false;
      this.activeTools.clear();
      this._inInlineThink = false;
      this.setStatus('connected', '已连接 (就绪)');
      this.emit('agent_settled', data);
      return;
    }

    if (type === 'turn_end') {
      const msg = data.message;
      if (msg && (msg.stopReason === 'error' || msg.errorMessage)) {
        const errMsg = msg.errorMessage || '上游模型调用异常';
        this.lastTurnError = errMsg;
        if (!this.currentTurnHasText) {
          const isRateLimit = /concurrency|rate_limit|429|too many/i.test(errMsg);
          const tip = isRateLimit
            ? `💡 **原因与建议**: 上游 API 通道临时并发受限 (Rate Limit / 429)。该通道正常可用，通常等待数秒后再试即可恢复。`
            : `💡 **原因与建议**: 上游 API 接口返回错误或网络异常，请稍后点击重试或切换备选通道。`;
          const notice = `\n\n> ⚠️ **上游模型通道调用异常**\n> 错误信息: \`${errMsg}\`\n>\n> ${tip}\n`;
          this.emit('text_delta', notice);
          this.currentTurnHasText = true;
        }
        this.emit('error', { message: errMsg, stopReason: msg.stopReason });
      }
      this._inInlineThink = false;
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
      } else if (toolName === 'gerrit_list_projects') {
        actionDesc = '正在获取 Gerrit 代码工程仓库清单...';
      } else if (toolName === 'codegraph_explore') {
        const tree = args?.tree === 'driver' ? '私有驱动' : '内核';
        actionDesc = `正在查询 CodeGraph ${tree}: "${args?.query || ''}"`;
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
   * Handle text delta stream, cleanly routing inline <think>...</think> blocks to thinking_delta
   * @private
   */
  _handleTextOrThinkingDelta(chunk) {
    if (!chunk || typeof chunk !== 'string') return;
    let remaining = chunk;
    while (remaining.length > 0) {
      if (!this._inInlineThink) {
        const thinkOpenIdx = remaining.indexOf('<think>');
        if (thinkOpenIdx !== -1) {
          const before = remaining.slice(0, thinkOpenIdx);
          if (before) this.emit('text_delta', before);
          this._inInlineThink = true;
          this.emit('thinking_start', {});
          remaining = remaining.slice(thinkOpenIdx + 7);
        } else {
          this.emit('text_delta', remaining);
          break;
        }
      } else {
        const thinkCloseIdx = remaining.indexOf('</think>');
        if (thinkCloseIdx !== -1) {
          const inside = remaining.slice(0, thinkCloseIdx);
          if (inside) this.emit('thinking_delta', inside);
          this._inInlineThink = false;
          this.emit('thinking_end', {});
          remaining = remaining.slice(thinkCloseIdx + 8);
        } else {
          this.emit('thinking_delta', remaining);
          break;
        }
      }
    }
  }

  /**
   * Send JSON command to stdin
   */
  sendCommand(commandObj) {
    if (!this.process || this.process.killed) {
      throw new Error('Pi 核心进程未就绪或已断开');
    }
    const id = `req-${this.requestIdCounter++}`;
    commandObj.id = id;

    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      const line = JSON.stringify(commandObj) + '\n';
      try {
        this.process.stdin.write(line, 'utf-8');
      } catch (err) {
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

    return this.sendCommand({
      type: 'prompt',
      message: messageText
    });
  }

  /**
   * Abort current generation
   */
  async abort() {
    if (!this.process || this.process.killed) return;
    try {
      this.setStatus('thinking', '正在中止操作...');
      await this.sendCommand({ type: 'abort' });
    } catch (e) {
      console.warn('[PiAgentBridge] Abort command issue:', e);
    } finally {
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '已中止操作');
      this.emit('aborted');
    }
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
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '新会话已开启');
      this.emit('new_session');
    }
  }

  /**
   * Set model dynamically via RPC or restart
   */
  async setModel(provider, modelId) {
    this.activeProvider = provider;
    this.activeModelId = modelId;
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
      } catch (e) {
        console.warn('[PiAgentBridge] setModel RPC failed, restarting process with new model:', e);
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
