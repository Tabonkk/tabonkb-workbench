const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const { buildVendorEnv, ensureGeminiVendorMcp, VENDOR_MCP_TOOL_HINT } = require('../mcp/vendor-mcp-shared.js');
const { buildFileRefHint } = require('../mcp/file-ref-hint-shared.js');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const crypto = require('crypto');

/**
 * GeminiAdapter: Native integration for Google Gemini CLI.
 * Runs headless mode with `--output-format stream-json`.
 * Features session UUID tracking, tool event mapping, and plan/auto_edit sandboxing.
 */
class GeminiAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'gemini',
      name: 'gemini',
      displayName: 'Gemini',
      icon: getAgentBrandSvg('gemini', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readwrite'
    });

    this.sessionId = null;
    this.process = null;
    this.stdoutBuffer = '';
    this.activeTools = new Map();
    this.activeModelId = 'gemini-2.5-flash';
    this.activeModelName = 'Gemini 2.5 Flash';
  }

  getModelGroups() {
    return [
      {
        group: 'Gemini 系列',
        icon: '🔷',
        iconPark: 'diamond',
        isTop: true,
        models: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '极速响应与轻量推演', icon: '⚡', iconPark: 'lightning' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: '深度逻辑与复杂多模态任务', icon: '💎', iconPark: 'diamond' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '超长上下文旗舰版', icon: '🔷', iconPark: 'diamond' }
        ]
      }
    ];
  }

  generateSessionId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'gemini-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  resolveGeminiBinary() {
    const nodeDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\node-v24.15.0';
    const geminiJs = path.join(nodeDir, 'node_modules', '@google', 'gemini-cli', 'bundle', 'gemini.js');
    const nodeExe = path.join(nodeDir, 'node.exe');

    if (fs.existsSync(nodeExe) && fs.existsSync(geminiJs)) {
      return {
        cmd: nodeExe,
        prefixArgs: [geminiJs]
      };
    }

    const geminiCmd = path.join(nodeDir, 'gemini.cmd');
    if (fs.existsSync(geminiCmd)) {
      return {
        cmd: geminiCmd,
        prefixArgs: []
      };
    }

    return {
      cmd: 'gemini',
      prefixArgs: []
    };
  }

  async detect() {
    return new Promise((resolve) => {
      try {
        const bin = this.resolveGeminiBinary();
        const proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, '--version'], {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let out = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.on('close', code => {
          if (code === 0) {
            this.setStatus('connected', 'Gemini CLI 已就绪');
            resolve({ available: true, version: out.trim() || '0.59.0' });
          } else {
            this.setStatus('not_installed', '未检测到 Gemini CLI');
            resolve({ available: false, error: 'Gemini 退出码异常: ' + code });
          }
        });
        proc.on('error', err => {
          this.setStatus('not_installed', '未检测到 Gemini CLI');
          resolve({ available: false, error: err.message });
        });
        proc.stdin.end();
      } catch (e) {
        this.setStatus('not_installed', '未检测到 Gemini CLI');
        resolve({ available: false, error: e.message });
      }
    });
  }

  async start() {
    const check = await this.detect();
    if (check.available) {
      this.ensureVendorMcp();
      this.setStatus('connected', '已就绪');
      return true;
    }
    this.setStatus('not_installed', 'Gemini 未安装');
    return false;
  }

  // 写项目级 .gemini/settings.json 注册芯片检索 MCP server (幂等, 失败不阻断)
  ensureVendorMcp() {
    try {
      const res = ensureGeminiVendorMcp(this.vaultBasePath);
      if (!res.ok) console.warn('[Gemini] vendor MCP 注册失败:', res.error);
    } catch (e) { console.warn('[Gemini] vendor MCP 注册异常:', e.message); }
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
    this.setStatus('thinking', 'Gemini 正在思考...');
    this.emit('turn_start');

    const bin = this.resolveGeminiBinary();
    const vaultPath = this.vaultBasePath || process.cwd();
    // 三档映射: readonly→plan / readwrite→auto_edit / full→yolo
    const approvalMode = this.permissionMode === 'readonly' ? 'plan'
      : (this.permissionMode === 'full' ? 'yolo' : 'auto_edit');
    this.ensureVendorMcp();

    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
    }

    const promptText = text + VENDOR_MCP_TOOL_HINT + buildFileRefHint(this.vaultBasePath);
    const args = [
      ...bin.prefixArgs,
      '--skip-trust',
      '--session-id', this.sessionId,
      '--approval-mode', approvalMode,
      '-o', 'stream-json',
      '-p', promptText
    ];

    return new Promise((resolve) => {
      try {
        this.stdoutBuffer = '';
        this.activeTools.clear();

        this.process = child_process.spawn(bin.cmd, args, {
          cwd: vaultPath,
          env: Object.assign({}, process.env, buildVendorEnv(vaultPath), {
            GEMINI_CLI_TRUST_WORKSPACE: 'true'
          }),
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');

        this.process.stdout.on('data', (chunk) => {
          this.handleStdoutChunk(chunk);
        });

        this.process.stderr.on('data', (chunk) => {
          const errStr = chunk.toString();
          if (errStr.includes('[ERROR]') || errStr.includes('FATAL')) {
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

        // Close stdin immediately
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
    this.stdoutBuffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;

      try {
        const event = JSON.parse(trimmed);
        this.handleEvent(event);
      } catch (e) {
        // Ignore unparseable lines
      }
    }
  }

  handleEvent(event) {
    const type = event.type;

    if (type === 'message') {
      if (event.content) {
        this.emit('text_delta', event.content);
      }
    } else if (type === 'tool_use') {
      const toolId = event.tool_id || `tool_${Date.now()}`;
      this.activeTools.set(toolId, {
        name: event.tool_name,
        startTime: Date.now()
      });
      this.setStatus('running_tool', `正在调用: ${event.tool_name || '工具'}`);
      this.emit('tool_start', {
        toolCallId: toolId,
        toolName: event.tool_name || 'tool',
        args: event.parameters || {},
        actionDesc: `正在调用: ${event.tool_name || '工具'}`,
        startTime: Date.now()
      });
    } else if (type === 'tool_result') {
      const toolId = event.tool_id;
      const prev = this.activeTools.get(toolId) || { startTime: Date.now(), name: 'tool' };
      this.emit('tool_end', {
        toolCallId: toolId,
        toolName: prev.name,
        durationMs: Date.now() - prev.startTime,
        isError: event.status === 'error',
        output: event.output || (event.status === 'error' ? (event.error?.message || '调用失败') : '调用成功')
      });
      this.setStatus('thinking', 'Gemini 正在整理结果...');
    } else if (type === 'result') {
      if (event.status === 'error') {
        this.emit('error', { error: event.error?.message || '执行异常' });
      }
      this.emit('turn_end');
    } else if (type === 'error') {
      this.emit('error', { error: event.message || 'Gemini 错误' });
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
    this.sessionId = this.generateSessionId();
    this.activeTools.clear();
    this.setStatus('connected', '已重置会话');
  }
}

module.exports = { GeminiAdapter };
