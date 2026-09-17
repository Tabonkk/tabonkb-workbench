const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

/**
 * CodexAdapter: Native integration for Codex CLI.
 * Runs non-interactive JSONL streaming via `codex exec --json`.
 * Supports thread resumption, command tool mapping, and sandbox enforcement.
 */
class CodexAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'codex',
      name: 'codex',
      displayName: 'Codex',
      icon: getAgentBrandSvg('codex', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.threadId = null;
    this.process = null;
    this.stdoutBuffer = '';
    this.knownItems = new Map(); // itemId -> state
    this.activeModelId = 'gpt-5.5';
    this.activeModelName = 'GPT-5.5';
  }

  getModelGroups() {
    return [
      {
        group: '常用模型',
        icon: '💻',
        iconPark: 'star',
        isTop: true,
        models: [
          { id: 'gpt-5.5', name: 'GPT-5.5', desc: 'Codex 旗舰代码工程模型', icon: '💻', iconPark: 'code' },
          { id: 'gpt-5.4-codex', name: 'GPT-5.4 Codex', desc: '高速精准代码生成', icon: '⚡', iconPark: 'lightning' },
          { id: 'o3-mini', name: 'o3-mini', desc: '强逻辑代码规划推演', icon: '🧠', iconPark: 'brain' }
        ]
      }
    ];
  }

  resolveCodexBinary() {
    const nodeDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\node-v24.15.0';
    const codexJs = path.join(nodeDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    const nodeExe = path.join(nodeDir, 'node.exe');

    if (fs.existsSync(nodeExe) && fs.existsSync(codexJs)) {
      return {
        cmd: nodeExe,
        prefixArgs: [codexJs]
      };
    }

    const codexCmd = path.join(nodeDir, 'codex.cmd');
    if (fs.existsSync(codexCmd)) {
      return {
        cmd: codexCmd,
        prefixArgs: []
      };
    }

    return {
      cmd: 'codex',
      prefixArgs: []
    };
  }

  async detect() {
    return new Promise((resolve) => {
      try {
        const bin = this.resolveCodexBinary();
        const proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, '--version'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let out = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.on('close', code => {
          if (code === 0) {
            this.setStatus('connected', 'Codex CLI 已就绪');
            resolve({ available: true, version: out.trim() || '0.154.0' });
          } else {
            this.setStatus('not_installed', '未检测到 Codex CLI');
            resolve({ available: false, error: 'Codex 退出码异常: ' + code });
          }
        });
        proc.on('error', err => {
          this.setStatus('not_installed', '未检测到 Codex CLI');
          resolve({ available: false, error: err.message });
        });
        proc.stdin.end();
      } catch (e) {
        this.setStatus('not_installed', '未检测到 Codex CLI');
        resolve({ available: false, error: e.message });
      }
    });
  }

  async start() {
    const check = await this.detect();
    if (check.available) {
      this.setStatus('connected', '已就绪');
      return true;
    }
    this.setStatus('not_installed', 'Codex 未安装');
    return false;
  }

  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  async send(text, contextPayload) {
    if (this.isStreaming && this.process) {
      return { success: false, error: '正在处理上一个指令，请稍候或先点击中止' };
    }

    this.isStreaming = true;
    this.setStatus('thinking', 'Codex 正在思考...');
    this.emit('turn_start');

    const bin = this.resolveCodexBinary();
    const sandbox = this.permissionMode === 'readwrite' ? 'workspace-write' : 'read-only';
    const vaultPath = this.vaultBasePath || process.cwd();

    let args = [];
    if (this.threadId) {
      // Resume existing thread session
      args = [
        ...bin.prefixArgs,
        'exec',
        'resume',
        this.threadId,
        text,
        '--json'
      ];
    } else {
      // New conversation thread
      args = [
        ...bin.prefixArgs,
        'exec',
        '--json',
        '-s', sandbox,
        '-C', vaultPath,
        text
      ];
    }

    return new Promise((resolve) => {
      try {
        this.stdoutBuffer = '';
        this.knownItems.clear();

        this.process = child_process.spawn(bin.cmd, args, {
          cwd: vaultPath,
          env: Object.assign({}, process.env, {
            CODEX_MANAGED_PACKAGE_ROOT: 'C:\\Users\\Administrator\\AppData\\Roaming\\node-v24.15.0\\node_modules\\@openai\\codex'
          }),
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');

        this.process.stdout.on('data', (chunk) => {
          this.handleStdoutChunk(chunk);
        });

        this.process.stderr.on('data', (chunk) => {
          // Stderr is used for informational logs and warnings
          const errStr = chunk.toString();
          if (errStr.includes('error:') || errStr.includes('FATAL')) {
            this.emit('error', { error: errStr });
          }
        });

        this.process.on('close', (code) => {
          this.isStreaming = false;
          this.process = null;
          this.emit('turn_end');
          this.emit('agent_settled');
          this.setStatus('connected', '已就绪');
          resolve({ success: code === 0 });
        });

        this.process.on('error', (err) => {
          this.isStreaming = false;
          this.process = null;
          this.setStatus('error', err.message);
          this.emit('error', { error: err.message });
          this.emit('agent_settled');
          resolve({ success: false, error: err.message });
        });

        // Close stdin immediately to prevent CLI waiting for stdin
        this.process.stdin.end();

      } catch (e) {
        this.isStreaming = false;
        this.process = null;
        this.setStatus('error', e.message);
        this.emit('error', { error: e.message });
        this.emit('agent_settled');
        resolve({ success: false, error: e.message });
      }
    });
  }

  handleStdoutChunk(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop(); // Keep partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;

      try {
        const event = JSON.parse(trimmed);
        this.handleEvent(event);
      } catch (e) {
        // Ignore unparseable non-JSON lines
      }
    }
  }

  handleEvent(event) {
    const type = event.type;

    if (type === 'thread.started') {
      if (event.thread_id) {
        this.threadId = event.thread_id;
      }
    } else if (type === 'turn.started') {
      this.setStatus('thinking', 'Codex 正在推理...');
    } else if (type === 'item.created' || type === 'item.updated') {
      const item = event.item;
      if (!item) return;

      if (item.type === 'command_execution') {
        const callId = item.id || `cmd_${Date.now()}`;
        if (!this.knownItems.has(callId)) {
          this.knownItems.set(callId, { startTime: Date.now() });
          this.setStatus('running_tool', `正在执行: ${item.command || '命令'}`);
          this.emit('tool_start', {
            toolCallId: callId,
            toolName: 'exec',
            args: { cmd: item.command },
            actionDesc: `正在执行: ${item.command || '命令'}`,
            startTime: Date.now()
          });
        }
      }
    } else if (type === 'item.completed') {
      const item = event.item;
      if (!item) return;

      if (item.type === 'agent_message') {
        const text = item.text || '';
        if (text) {
          this.emit('text_delta', text);
        }
      } else if (item.type === 'command_execution') {
        const callId = item.id || `cmd_${Date.now()}`;
        const prev = this.knownItems.get(callId) || { startTime: Date.now() };
        this.emit('tool_end', {
          toolCallId: callId,
          toolName: 'exec',
          durationMs: Date.now() - prev.startTime,
          isError: item.exit_code !== 0,
          output: item.output || (item.exit_code === 0 ? '执行完成' : '执行失败')
        });
        this.setStatus('thinking', 'Codex 正在归纳输出...');
      } else if (item.type === 'file_change') {
        const callId = item.id || `file_${Date.now()}`;
        this.emit('tool_start', {
          toolCallId: callId,
          toolName: 'edit',
          args: { path: item.path },
          actionDesc: `正在修改: ${item.path || '文档'}`,
          startTime: Date.now()
        });
        this.emit('tool_end', {
          toolCallId: callId,
          toolName: 'edit',
          durationMs: 180,
          isError: false,
          output: `文件修改已应用: ${item.path || ''}`
        });
      }
    } else if (type === 'turn.completed') {
      this.emit('turn_end');
    }
  }

  async abort() {
    if (this.process && !this.process.killed) {
      try {
        this.process.kill('SIGTERM');
      } catch (e) {
        try { this.process.kill('SIGKILL'); } catch (e2) {}
      }
    }
    this.isStreaming = false;
    this.process = null;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  async newSession() {
    await this.abort();
    this.threadId = null;
    this.knownItems.clear();
    this.setStatus('connected', '已重置会话');
  }
}

module.exports = { CodexAdapter };
