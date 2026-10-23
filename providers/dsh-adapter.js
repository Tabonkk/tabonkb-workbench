/* ==========================================================================
   DSH Adapter — DeepSeek Harness Headless Mode 适配器 (模式 B)
   特性:
   1. 继承 AgentAdapter 抽象基类，对齐 Agent Hub 事件总线契约
   2. 采用 dsh --profile headless --json 流式事件解析
   3. 完整支持 DeepSeek CoT (Reasoning Content) 思考链增量与折叠
   4. 完整支持 MCP 工具调用事件与原厂/代码/画图/评审友好文案映射
   5. 多轮会话持久化与 session-id 自动接续
   6. 遵循双运行形态约束 (单测 require 与 build.py 全局类拼接)
   ========================================================================== */

const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const { buildVendorEnv } = require('../mcp/vendor-mcp-shared.js');
const { buildWeknoraEnv } = require('../mcp/weknora-mcp-shared.js');
const { buildOpengrokEnv } = require('../mcp/opengrok-mcp-shared.js');
const { buildGerritEnv } = require('../mcp/gerrit-mcp-shared.js');
const { buildJiraEnv } = require('../mcp/jira-mcp-shared.js');
const { buildFileRefHint } = require('../mcp/file-ref-hint-shared.js');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

class DshAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'dsh',
      name: 'dsh',
      displayName: 'DSH',
      icon: getAgentBrandSvg('deepseek', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readwrite'
    });
    this.plugin = options.plugin || null;
    this.process = null;
    this.stdoutBuffer = '';
    this.lastStderr = null;
    // R9: 世代号 —— abort()/新 send() 递增, 使在途进程回调自我作废
    this._turnToken = 0;
    this.currentSessionId = null;
    this.currentToolCallId = null;
    this.currentToolName = null;
    this.currentToolStartTime = null;
    this.isThinkingActive = false;
    this.selectedModel = { id: 'deepseek-chat', name: 'deepseek-chat (V3)' };
  }

  resolveBinary() {
    const candidates = [];
    if (process.env.DSH_CLI_PATH) candidates.push(process.env.DSH_CLI_PATH);
    const nodeDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'node-v24.15.0') : '';
    if (nodeDir) {
      const nodeExe = path.join(nodeDir, 'node.exe');
      const binJs = path.join(nodeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
      if (fs.existsSync(nodeExe) && fs.existsSync(binJs)) {
        return { nodeExe, binJs, ok: true };
      }
    }
    // Fallback: check global npm path
    const fallbackNode = process.execPath || 'node';
    return { nodeExe: fallbackNode, binJs: '', ok: false };
  }

  async detect() {
    const bin = this.resolveBinary();
    if (!bin.ok) {
      return { available: false, error: '未找到 @deepseek-ai/dsh 安装包或 Node.js 环境' };
    }
    return {
      available: true,
      version: '0.2.0-rc.2',
      path: bin.binJs
    };
  }

  async start() {
    const detected = await this.detect();
    if (!detected.available) {
      this.setStatus('not_installed', 'DSH 未就绪');
      return false;
    }
    this.setStatus('connected', '就绪');
    return true;
  }

  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  getModelGroups() {
    return [
      {
        group: 'DeepSeek 官方模型',
        isTop: true,
        iconPark: 'star',
        models: [
          { id: 'deepseek-chat', name: 'deepseek-chat (V3)', desc: '通用快速对话模型', supportsReasoningEffort: false },
          { id: 'deepseek-reasoner', name: 'deepseek-reasoner (R1)', desc: '深度推理模型', supportsReasoningEffort: true }
        ]
      }
    ];
  }

  getModel() {
    return this.selectedModel || { id: 'deepseek-chat', name: 'deepseek-chat (V3)' };
  }

  setModel(modelId, displayName) {
    this.selectedModel = { id: modelId, name: displayName || modelId };
    this.emit('model_change', { modelId, displayName });
  }

  supportsReasoningEffort(modelId) {
    const id = modelId || (this.selectedModel && this.selectedModel.id) || '';
    return id.includes('reasoner') || id.includes('r1');
  }

  setReasoningEffort(level) {
    this.reasoningEffort = level || 'max';
    this.emit('model_change', {
      modelId: this.selectedModel ? this.selectedModel.id : 'deepseek-reasoner',
      displayName: this.selectedModel ? this.selectedModel.name : 'deepseek-reasoner',
      reasoningEffort: this.reasoningEffort
    });
  }

  getReasoningEffort() {
    return this.reasoningEffort || 'max';
  }

  getReasoningEffortConfig() {
    const level = this.reasoningEffort || 'max';
    const map = {
      'medium': { id: 'medium', label: '中', desc: '思考与速度平衡', apiEffort: 'medium', thinkingEffort: 'standard' },
      'high': { id: 'high', label: '高', desc: '为复杂问题思考更久', apiEffort: 'high', thinkingEffort: 'extended' },
      'max': { id: 'max', label: '极高', desc: '为最难的问题做最深入的分析', apiEffort: 'max', thinkingEffort: 'max' }
    };
    return map[level] || map['max'];
  }

  getActionDesc(cleanToolName, input = {}) {
    if (cleanToolName === 'vendor_portal_search') {
      const q = input.query || '';
      const v = input.vendor && input.vendor !== 'all' ? ` (${input.vendor})` : '';
      return `正在检索芯片原厂资料${v}: "${q}"`;
    }
    if (cleanToolName === 'vendor_portal_get_detail') {
      return `正在调取原厂技术方案: ${input.docId || ''}`;
    }
    if (cleanToolName === 'weknora_search' || cleanToolName === 'weknora_ask') {
      return `正在检索团队知识库: "${input.query || ''}"`;
    }
    if (cleanToolName === 'opengrok_search_code') {
      const p = input.project ? ` [${input.project}]` : '';
      return `正在检索 OpenGrok 代码${p}: "${input.query || ''}"`;
    }
    if (cleanToolName === 'opengrok_read_file') {
      const f = input.file_path ? path.basename(input.file_path) : '';
      return `正在阅读 OpenGrok 源码: ${f || input.file_path || ''}`;
    }
    if (cleanToolName === 'gerrit_search_changes') {
      return `正在检索 Gerrit 代码评审: "${input.query || ''}"`;
    }
    if (cleanToolName === 'gerrit_get_change' || cleanToolName === 'gerrit_get_diff') {
      return `正在查阅 Gerrit 评审详情: #${input.change_id || ''}`;
    }
    if (cleanToolName.startsWith('drawio_')) {
      return '正在操作 Draw.io 图表';
    }
    if (cleanToolName.startsWith('codegraph_')) {
      return `正在查询 CodeGraph 代码知识图谱: "${input.query || ''}"`;
    }
    return `正在执行: ${cleanToolName}`;
  }

  handleEvent(event) {
    if (!event || typeof event !== 'object') return;

    if (event.type === 'session') {
      if (event.sessionId) {
        this.currentSessionId = event.sessionId;
      }
      return;
    }

    if (event.type === 'usage') {
      const u = event.usage || event;
      const input = u.input || u.prompt_tokens || u.inputTokens || 0;
      const output = u.output || u.completion_tokens || u.outputTokens || 0;
      const cacheRead = u.cacheRead || u.prompt_cache_hit_tokens || u.cacheReadTokens || 0;
      const totalTokens = u.totalTokens || u.total_tokens || (input + output);
      this.emit('turn_end', { usage: { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, totalTokens } });
      return;
    }

    if (event.type === 'status') {
      if (event.phase === 'turn_start') {
        this.setStatus('thinking', 'DSH 正在思考');
        this.emit('turn_start');
      } else if (event.phase === 'turn_end') {
        if (this.isThinkingActive) {
          this.emit('thinking_end');
          this.isThinkingActive = false;
        }
        let usage = null;
        if (event.usage) {
          const u = event.usage;
          const input = u.input || u.prompt_tokens || u.inputTokens || 0;
          const output = u.output || u.completion_tokens || u.outputTokens || 0;
          const cacheRead = u.cacheRead || u.prompt_cache_hit_tokens || u.cacheReadTokens || 0;
          const totalTokens = u.totalTokens || u.total_tokens || (input + output);
          usage = { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, totalTokens };
        }
        this.emit('turn_end', usage ? { usage } : undefined);
      }
      return;
    }

    if (event.type === 'thinking') {
      if (!this.isThinkingActive) {
        this.emit('thinking_start');
        this.isThinkingActive = true;
      }
      if (typeof event.text === 'string' && event.text) {
        this.emit('thinking_delta', event.text);
      }
      return;
    }

    if (event.type === 'text') {
      if (this.isThinkingActive) {
        this.emit('thinking_end');
        this.isThinkingActive = false;
      }
      if (typeof event.text === 'string') {
        this.emit('text_delta', event.text);
      }
      return;
    }

    if (event.type === 'tool_call') {
      if (this.isThinkingActive) {
        this.emit('thinking_end');
        this.isThinkingActive = false;
      }
      const rawName = event.tool || '';
      const cleanToolName = rawName.replace(/^mcp__[a-zA-Z0-9_-]+__/, '');
      const toolCallId = event.callId || `dsh_tool_${Date.now()}`;
      this.currentToolCallId = toolCallId;
      this.currentToolName = cleanToolName;
      this.currentToolStartTime = Date.now();

      const actionDesc = this.getActionDesc(cleanToolName, event.input);
      this.setStatus('running_tool', actionDesc);
      this.emit('tool_start', {
        toolCallId,
        toolName: cleanToolName,
        args: event.input,
        startTime: this.currentToolStartTime,
        actionDesc
      });
      return;
    }

    if (event.type === 'tool_result') {
      const toolCallId = event.callId || this.currentToolCallId || `dsh_tool_${Date.now()}`;
      const toolName = this.currentToolName || 'tool';
      const durationMs = Date.now() - (this.currentToolStartTime || Date.now());

      this.emit('tool_end', {
        toolCallId,
        toolName,
        durationMs,
        isError: event.status === 'error',
        output: typeof event.result === 'string' ? event.result : JSON.stringify(event.result || '')
      });
      this.currentToolCallId = null;
      this.currentToolName = null;
      this.setStatus('thinking', 'DSH 正在分析结果');
      return;
    }

    if (event.type === 'final') {
      if (this.isThinkingActive) {
        this.emit('thinking_end');
        this.isThinkingActive = false;
      }
      return;
    }
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      this.handleStdoutLine(line);
    }
  }

  handleStdoutLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const event = JSON.parse(trimmed);
      this.handleEvent(event);
      return;
    } catch (_) {}

    // R12: 非 JSON 行并不都是回答正文 —— 过滤启动/日志噪声, 避免污染聊天区
    if (trimmed.startsWith('{') || trimmed.startsWith('session_id:')) return;
    if (/^(loading|loaded|starting|started|info|warn|warning|debug|trace|verbose)\b[:\s]/i.test(trimmed)) return;
    if (/^\[[a-z0-9 _-]+\]/i.test(trimmed)) return;
    if (/(IO is still pending|--port\s+\d+|dsh web:)/i.test(trimmed)) return;
    this.emit('text_delta', trimmed + '\n');
  }

  async send(text, contextPayload) {
    if (this.isStreaming) {
      await this.abort();
    }
    const bin = this.resolveBinary();
    if (!bin.ok) {
      const err = 'DSH 未安装或路径未找到';
      this.emit('error', { error: err });
      this.emit('agent_settled');
      return { success: false, error: err };
    }

    const patchPath = path.join(this.vaultBasePath || '', '.dsh', 'profiles', 'tabonkb', 'cordis.patch.yml');
    const spawnArgs = [bin.binJs, '--profile', 'headless'];
    if (fs.existsSync(patchPath)) {
      spawnArgs.push('--patch', patchPath);
    }
    if (this.currentSessionId) {
      spawnArgs.push('--session-id', this.currentSessionId);
    }
    spawnArgs.push('--json', '-');

    this.isStreaming = true;
    this.isThinkingActive = false;
    this.stdoutBuffer = '';
    this.setStatus('thinking', 'DSH 正在思考');

    const env = Object.assign(
      {},
      process.env,
      typeof buildVendorEnv === 'function' ? buildVendorEnv(this.vaultBasePath) : {},
      typeof buildWeknoraEnv === 'function' ? buildWeknoraEnv(this.vaultBasePath) : {},
      typeof buildOpengrokEnv === 'function' ? buildOpengrokEnv(this.vaultBasePath) : {},
      typeof buildGerritEnv === 'function' ? buildGerritEnv(this.vaultBasePath) : {},
      typeof buildJiraEnv === 'function' ? buildJiraEnv(this.vaultBasePath) : {}
    );

    // R9: 世代号 —— abort()/新一轮 send() 后递增, 旧进程的回调据此自我作废
    const token = ++this._turnToken;

    return new Promise((resolve) => {
      let proc = null;
      try {
        proc = child_process.spawn(bin.nodeExe, spawnArgs, {
          cwd: this.vaultBasePath || process.cwd(),
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        });
        this.process = proc;

        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');

        proc.stdout.on('data', (chunk) => {
          if (token !== this._turnToken) return;
          this.handleStdout(chunk);
        });
        proc.stderr.on('data', (chunk) => {
          if (token !== this._turnToken) return;
          const msg = chunk.toString().trim();
          if (!msg) return;
          // R10: stderr 一律视为异常信号(原实现含 !isStreaming 条件, 正常流式期间永远不报)
          if (/fatal|panic|error|exception|ENOENT|EACCES|refused|denied/i.test(msg)) {
            this.lastStderr = msg;
            this.emit('error', { error: msg });
          }
        });

        // R2: 身份校验 —— 只有当前进程/当前世代的事件才允许落定状态
        proc.on('error', (err) => {
          if (this.process !== proc || token !== this._turnToken) return;
          this.finish(false, err.message, resolve);
        });
        proc.on('close', (code) => {
          if (this.process !== proc || token !== this._turnToken) return;
          this.finish(code === 0, code === 0 ? '' : `DSH exited with code ${code}`, resolve);
        });

        proc.stdin.write(text + buildFileRefHint(this.vaultBasePath), 'utf8');
        proc.stdin.end();
      } catch (err) {
        this.finish(false, err.message, resolve);
      }
    });
  }

  async finish(success, error, resolve) {
    // R10: 进程非零退出但调用方没给出原因时, 回退到已采集的 stderr 首条异常
    if (!success && !error && this.lastStderr) {
      error = this.lastStderr;
    }
    this.lastStderr = null;
    await this._settleDrawioArtifact();
    if (this.stdoutBuffer) {
      this.handleStdoutLine(this.stdoutBuffer);
      this.stdoutBuffer = '';
    }
    if (this.currentToolCallId) {
      this.emit('tool_end', {
        toolCallId: this.currentToolCallId,
        toolName: this.currentToolName || 'tool',
        durationMs: Date.now() - (this.currentToolStartTime || Date.now()),
        isError: !success
      });
      this.currentToolCallId = null;
    }
    if (this.isThinkingActive) {
      this.emit('thinking_end');
      this.isThinkingActive = false;
    }
    this.isStreaming = false;
    this.process = null;
    this.emit('turn_end');
    this.emit('agent_settled');
    this.setStatus(success ? 'connected' : 'error', error || '就绪');
    resolve({ success, ...(error ? { error } : {}) });
  }

  async abort() {
    // R9: 递增世代号使在途进程的全部回调作废, 避免旧进程事件污染新会话
    this._turnToken++;
    const proc = this.process;
    this.process = null;

    if (proc && !proc.killed) {
      const exited = new Promise((res) => {
        try {
          proc.once('close', res);
          proc.once('error', res);
        } catch (_) { res(); }
      });
      try {
        if (process.platform === 'win32') {
          // 用异步 spawn 而非 execSync, 避免 taskkill 阻塞 Obsidian 渲染线程
          const killer = child_process.spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true });
          killer.on('error', () => {});
        } else {
          proc.kill('SIGKILL');
        }
      } catch (_) {
        try { proc.kill(); } catch (_) {}
      }
      // R9: 同步等待进程真正退出(最多 1.5s), 消除"旧进程仍在跑就发新消息"的竞态
      await Promise.race([exited, new Promise((r) => setTimeout(r, 1500))]);
    }

    this.isStreaming = false;
    this.isThinkingActive = false;
    this.currentToolCallId = null;
    await this._settleDrawioArtifact();
    this.setStatus('connected', '就绪');
    this.emit('agent_settled');
  }

  async newSession() {
    await this.abort();
    this.currentSessionId = null;
    this.setStatus('connected', '新会话就绪');
  }

  async _settleDrawioArtifact() {
    if (typeof tabonkbSettleDrawio !== 'function') return;
    try {
      const art = await tabonkbSettleDrawio();
      if (art && art.relPng) this.emit('text_delta', `\n\n![[${art.relPng}]]\n`);
    } catch (_) {}
  }
}

module.exports = { DshAdapter };
