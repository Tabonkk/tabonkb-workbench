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
    this.listeners = new Map();
    this.process = null;
    this.stdoutBuffer = '';
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'thinking' | 'running_tool' | 'error'
    this.statusDetail = '';
    this.isStreaming = false;
    this.activeTools = new Map();
    this.requestIdCounter = 1;
    this.pendingCommands = new Map();

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

  /**
   * Determine launch executable: direct node + bundle cli.js (cleanest) or fallback to pi.cmd
   */
  resolveLaunchCommand() {
    const tools = this.permissionMode === 'readwrite'
      ? 'read,write,edit,grep,find,ls'
      : 'read,grep,find,ls';

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
          '--tools', tools
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
          '--tools', tools
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
        '--tools', tools
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

      this.process = child_process.spawn(launch.cmd, launch.args, {
        cwd: this.vaultBasePath,
        env: Object.assign({}, process.env, {
          PATH: envPath,
          Path: envPath,
          LANG: 'en_US.UTF-8',
          PYTHONIOENCODING: 'utf-8'
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
      this.setStatus('thinking', '正在思考与规划...');
      this.emit('turn_start', data);
      return;
    }

    if (type === 'agent_end' || type === 'agent_settled') {
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '已连接 (就绪)');
      this.emit('agent_settled', data);
      return;
    }

    if (type === 'turn_end') {
      this.emit('turn_end', data);
      return;
    }

    // 3. Streaming Assistant Message Updates
    if (type === 'message_update') {
      const ev = data.assistantMessageEvent;
      if (!ev) return;

      // STRICT REQUIREMENT: Suppress Chain-of-Thought (thinking_delta)
      if (typeof ev.type === 'string' && ev.type.startsWith('thinking_')) {
        return;
      }

      if (ev.type === 'text_delta' && typeof ev.delta === 'string') {
        this.emit('text_delta', ev.delta);
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
