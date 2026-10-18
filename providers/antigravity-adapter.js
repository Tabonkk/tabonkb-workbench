const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const { WEKNORA_MCP_SERVER_NAME, WEKNORA_MCP_TOOL_HINT, weknoraMcpResolveNodeExe, weknoraMcpScriptPath, buildWeknoraEnv } = require('../mcp/weknora-mcp-shared.js');
const { VENDOR_MCP_SERVER_NAME, VENDOR_MCP_TOOL_HINT, vendorMcpScriptPath, buildVendorEnv } = require('../mcp/vendor-mcp-shared.js');
const { GERRIT_MCP_SERVER_NAME, GERRIT_MCP_TOOL_HINT, gerritMcpScriptPath, buildGerritEnv } = require('../mcp/gerrit-mcp-shared.js');
const { OPENGROK_MCP_SERVER_NAME, OPENGROK_MCP_TOOL_HINT, opengrokMcpScriptPath, buildOpengrokEnv } = require('../mcp/opengrok-mcp-shared.js');
const { DRAWIO_MCP_SERVER_NAME, DRAWIO_MCP_TOOL_HINT, drawioMcpScriptPath } = require('../mcp/drawio-mcp-shared.js');
const { POWERZ_MCP_SERVER_NAME, POWERZ_MCP_TOOL_HINT, powerzMcpScriptPath } = require('../mcp/powerz-mcp-shared.js');
const { DSLOGIC_MCP_SERVER_NAME, DSLOGIC_MCP_TOOL_HINT, dslogicMcpScriptPath } = require('../mcp/dslogic-mcp-shared.js');
const { JIRA_MCP_SERVER_NAME, JIRA_MCP_TOOL_HINT, jiraMcpScriptPath, buildJiraEnv } = require('../mcp/jira-mcp-shared.js');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

/**
 * 确保 Antigravity CLI 拥有 TabonKB 专有 MCP 工具与工作区信任配置 (幂等, 自动写入)
 * 配置写入 ~/.gemini/config/mcp_config.json 以及 ~/.gemini/antigravity-cli/settings.json
 */
function ensureAgyMcpServers(vaultBasePath) {
  try {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Administrator';
    const configDir = path.join(userProfile, '.gemini', 'config');
    const mcpConfigFile = path.join(configDir, 'mcp_config.json');

    const nodeExe = weknoraMcpResolveNodeExe();
    const tools = {
      [WEKNORA_MCP_SERVER_NAME]: weknoraMcpScriptPath(vaultBasePath),
      [VENDOR_MCP_SERVER_NAME]: vendorMcpScriptPath(vaultBasePath),
      [GERRIT_MCP_SERVER_NAME]: gerritMcpScriptPath(vaultBasePath),
      [OPENGROK_MCP_SERVER_NAME]: opengrokMcpScriptPath(vaultBasePath),
      [DRAWIO_MCP_SERVER_NAME]: drawioMcpScriptPath(vaultBasePath),
      [POWERZ_MCP_SERVER_NAME]: powerzMcpScriptPath(vaultBasePath),
      [DSLOGIC_MCP_SERVER_NAME]: dslogicMcpScriptPath(vaultBasePath),
      [JIRA_MCP_SERVER_NAME]: jiraMcpScriptPath(vaultBasePath)
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
    for (const [name, scriptPath] of Object.entries(tools)) {
      if (!scriptPath || !fs.existsSync(scriptPath)) continue;
      const existing = mcpConfig.mcpServers[name];
      const same = existing && existing.command === nodeExe && Array.isArray(existing.args) && existing.args[0] === scriptPath && !existing.disabled;
      if (!same) {
        mcpConfig.mcpServers[name] = {
          command: nodeExe,
          args: [scriptPath],
          disabled: false
        };
        mcpChanged = true;
      }
    }

    if (mcpChanged) {
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2), 'utf8');
    }

    // 信任工作区与自动批准 MCP 权限配置
    const cliDir = path.join(userProfile, '.gemini', 'antigravity-cli');
    const cliSettingsFile = path.join(cliDir, 'settings.json');
    let cliSettings = {};
    if (fs.existsSync(cliSettingsFile)) {
      try {
        cliSettings = JSON.parse(fs.readFileSync(cliSettingsFile, 'utf8')) || {};
      } catch (_) {
        cliSettings = {};
      }
    }

    let settingsChanged = false;
    cliSettings.trustedWorkspaces = cliSettings.trustedWorkspaces || [];
    const normalizedVault = vaultBasePath || 'D:\\work\\Mgmt\\TabonKB';
    if (!cliSettings.trustedWorkspaces.includes(normalizedVault)) {
      cliSettings.trustedWorkspaces.push(normalizedVault);
      settingsChanged = true;
    }

    cliSettings.permissions = cliSettings.permissions || {};
    cliSettings.permissions.allow = cliSettings.permissions.allow || [];
    if (!cliSettings.permissions.allow.includes('mcp(*)')) {
      cliSettings.permissions.allow.push('mcp(*)');
      settingsChanged = true;
    }

    if (settingsChanged) {
      if (!fs.existsSync(cliDir)) fs.mkdirSync(cliDir, { recursive: true });
      fs.writeFileSync(cliSettingsFile, JSON.stringify(cliSettings, null, 2), 'utf8');
    }

    return { ok: true, mcpChanged, settingsChanged };
  } catch (err) {
    console.warn('[Antigravity] MCP/Settings auto-provisioning warning:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * 从 Antigravity 本地轨迹 transcript 中提取最新回合的完整思维链 (thinking)
 * 路径: ~/.gemini/antigravity-cli/brain/<conv_id>/.system_generated/logs/transcript.jsonl
 */
function extractLatestThinking(convId, userProfile) {
  if (!convId) return { found: false, count: 0, thinking: '' };
  try {
    const root = userProfile || process.env.USERPROFILE || 'C:\\Users\\Administrator';
    const logsDir = path.join(root, '.gemini', 'antigravity-cli', 'brain', convId, '.system_generated', 'logs');
    const transcriptPath = path.join(logsDir, 'transcript.jsonl');
    const transcriptFullPath = path.join(logsDir, 'transcript_full.jsonl');

    if (!fs.existsSync(transcriptPath)) return { found: false, count: 0, thinking: '' };

    const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean);
    let lastUserIdx = -1;
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const e = JSON.parse(lines[i]);
        entries.push(e);
        if (e.type === 'USER_INPUT') lastUserIdx = i;
      } catch (_) {}
    }

    let fullLines = null;
    const thinkingParts = [];
    for (let i = lastUserIdx + 1; i < entries.length; i++) {
      const entry = entries[i];
      if (entry && entry.type === 'PLANNER_RESPONSE') {
        if (entry.truncated_fields && entry.truncated_fields.includes('thinking')) {
          if (!fullLines && fs.existsSync(transcriptFullPath)) {
            try {
              fullLines = fs.readFileSync(transcriptFullPath, 'utf8').trim().split('\n').filter(Boolean);
            } catch (_) {}
          }
          if (fullLines && fullLines[i]) {
            try {
              const fullEntry = JSON.parse(fullLines[i]);
              if (fullEntry.thinking) thinkingParts.push(fullEntry.thinking.trim());
            } catch (_) {}
          }
        } else if (entry.thinking) {
          thinkingParts.push(entry.thinking.trim());
        }
      }
    }

    const text = thinkingParts.filter(Boolean).join('\n\n---\n\n');
    return {
      found: text.length > 0,
      count: thinkingParts.length,
      thinking: text
    };
  } catch (err) {
    return { found: false, count: 0, thinking: '', error: err.message };
  }
}

/**
 * CJK 感知 Token 估算: 汉字/全角标点 ~0.65 tok, 其余 ~0.28 tok
 */
function estTokensByChars(chars) {
  return Math.ceil(Math.max(0, chars) * 0.28);
}
function estTokensFromText(s) {
  s = String(s || '');
  if (!s) return 0;
  let cjk = 0, other = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x4e00 && c <= 0x9fa5) || (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef)) cjk++;
    else other++;
  }
  return Math.ceil(cjk * 0.65 + other * 0.28);
}

/**
 * 从 transcript_full.jsonl 中提取原生 usage/token_count 字段（若 CLI 已记录）
 */
function extractNativeUsageFromTranscript(convId, userProfile) {
  if (!convId) return null;
  try {
    const root = userProfile || process.env.USERPROFILE || 'C:\\Users\\Administrator';
    const fp = path.join(root, '.gemini', 'antigravity-cli', 'brain', convId, '.system_generated', 'logs', 'transcript_full.jsonl');
    if (!fs.existsSync(fp)) return null;
    const lines = fs.readFileSync(fp, 'utf8').trim().split('\n').filter(Boolean);
    let agg = null;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const u = e && (e.usage || e.token_count || (e.result && (e.result.usage || e.result.token_count)));
        if (u && typeof u === 'object') {
          const inp = Math.max(0, u.input ?? u.inputTokens ?? u.prompt_tokens ?? u.promptTokens ?? 0);
          const out = Math.max(0, u.output ?? u.outputTokens ?? u.completion_tokens ?? u.completionTokens ?? 0);
          const cr  = Math.max(0, u.cacheRead ?? u.cacheReadTokens ?? u.prompt_cache_hit_tokens ?? 0);
          const cw  = Math.max(0, u.cacheWrite ?? u.cacheWriteTokens ?? u.cache_creation_input_tokens ?? 0);
          if (inp + out + cr + cw > 0) {
            agg = agg || { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
            agg.inputTokens += inp; agg.outputTokens += out; agg.cacheReadTokens += cr; agg.cacheWriteTokens += cw;
          }
        }
      } catch (_) {}
    }
    return agg;
  } catch (_) {
    return null;
  }
}

/**
 * AntigravityAdapter: Native integration for Google Antigravity CLI (`agy`).
 * Runs headless mode with `--output-format stream-json`.
 * Features session UUID tracking, full MCP tool dispatching (WeKnora, Vendor, Gerrit, OpenGrok, DrawIO),
 * real-time thinking process & duration streaming, and plan / accept-edits sandboxing.
 */
class AntigravityAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'antigravity',
      name: 'antigravity',
      displayName: 'Antigravity CLI',
      icon: getAgentBrandSvg('antigravity', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readwrite'
    });

    this.sessionId = null;
    this.sessionManager = options.sessionManager || null;
    this._boundSessionId = undefined;
    this.process = null;
    this.stdoutBuffer = '';
    this.activeTools = new Map();
    this.activeModelId = 'gemini-3.8-flash-high';
    this.activeModelName = 'Gemini 3.8 Flash (High)';

    // 思维链状态追踪
    this.isThinkingActive = false;
    this.thinkingStartTime = null;
    this.lastEmittedThinking = '';
    this.thinkingPollTimer = null;
    this.reasoningEffort = null;
  }

  supportsReasoningEffort(modelId) {
    const id = String(modelId || this.activeModelId || '').toLowerCase();
    return id.includes('flash') || id.includes('pro') || id.includes('thinking') || id.includes('claude') || id.includes('gemini');
  }

  getReasoningEffort() {
    if (!this.reasoningEffort) {
      if (typeof localStorage !== 'undefined') {
        this.reasoningEffort = localStorage.getItem('tabonkb-agy-reasoning-effort') || 'high';
      } else {
        this.reasoningEffort = 'high';
      }
    }
    return this.reasoningEffort;
  }

  setReasoningEffort(effort) {
    this.reasoningEffort = effort || 'high';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-agy-reasoning-effort', this.reasoningEffort);
    }
    this.emit('reasoning_effort_change', this.reasoningEffort);
  }

  getReasoningEffortConfig() {
    const level = this.getReasoningEffort();
    const map = {
      'off': { id: 'off', label: '关闭思考', desc: '直接输出，响应极速' },
      'low': { id: 'low', label: '低推理', desc: '快速轻度思考' },
      'medium': { id: 'medium', label: '中推理', desc: '思考与速度平衡' },
      'high': { id: 'high', label: '高推理', desc: '为复杂问题深度思考' },
      'max': { id: 'max', label: '极高推理', desc: '最深入复杂的全量思考' }
    };
    return map[level] || map['high'];
  }

  getModel() {
    return {
      id: this.activeModelId,
      name: this.activeModelName,
      reasoningEffort: this.getReasoningEffort()
    };
  }

  setModel(modelId, modelName, reasoningEffort = null) {
    this.activeModelId = modelId;
    this.activeModelName = modelName || modelId;
    if (reasoningEffort !== null && reasoningEffort !== undefined) {
      this.setReasoningEffort(reasoningEffort);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-agy-active-model', this.activeModelId);
      localStorage.setItem('tabonkb-agy-active-model-name', this.activeModelName);
    }
    this.emit('model_change', { modelId, displayName: this.activeModelName });
  }

  getModelGroups() {
    return [
      {
        group: 'Gemini 旗舰与高阶推理',
        icon: '🔷',
        iconPark: 'diamond',
        isTop: true,
        models: [
          { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', desc: '极速响应与高阶长上下文推理 (默认推荐)', icon: '⚡', iconPark: 'lightning', supportsReasoningEffort: true },
          { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High)', desc: '混合思维链与平衡效能', icon: '⚡', iconPark: 'lightning', supportsReasoningEffort: true },
          { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)', desc: '深度逻辑与复杂架构推演', icon: '💎', iconPark: 'diamond', supportsReasoningEffort: true }
        ]
      },
      {
        group: 'Claude 深度思考系列',
        icon: '🧠',
        iconPark: 'brain',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)', desc: '高水平编码与架构深度思考', icon: '🧠', iconPark: 'brain', supportsReasoningEffort: true },
          { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)', desc: '旗舰级最强综合分析思考', icon: '💎', iconPark: 'diamond', supportsReasoningEffort: true }
        ]
      },
      {
        group: '开源与通用大模型',
        icon: '🌐',
        iconPark: 'cloud',
        models: [
          { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)', desc: '开源千亿参数推理模型', icon: '🌐', iconPark: 'globe', supportsReasoningEffort: false }
        ]
      }
    ];
  }

  resolveBinary() {
    const candidates = [
      'C:\\Windows\\System32\\agy.exe',
      path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Administrator\\AppData\\Local', 'agy', 'bin', 'agy.exe'),
      path.join(process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming', 'Antigravity', 'bin', 'agy.exe'),
      'agy.exe',
      'agy'
    ];

    for (const c of candidates) {
      if (c === 'agy' || c === 'agy.exe' || fs.existsSync(c)) {
        return { cmd: c, prefixArgs: [] };
      }
    }

    return { cmd: 'agy', prefixArgs: [] };
  }

  async detect() {
    return new Promise((resolve) => {
      try {
        const bin = this.resolveBinary();
        const proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, '--version'], {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let out = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.on('close', (code) => {
          if (code === 0) {
            this.setStatus('connected', 'Antigravity CLI 已就绪');
            resolve({ available: true, version: out.trim() || '1.3.1' });
          } else {
            this.setStatus('not_installed', '未检测到 Antigravity CLI');
            resolve({ available: false, error: '退出码异常: ' + code });
          }
        });
        proc.on('error', (err) => {
          this.setStatus('not_installed', '未检测到 Antigravity CLI');
          resolve({ available: false, error: err.message });
        });
        proc.stdin.end();
      } catch (e) {
        this.setStatus('not_installed', '未检测到 Antigravity CLI');
        resolve({ available: false, error: e.message });
      }
    });
  }

  async start() {
    const check = await this.detect();
    if (check.available) {
      this.ensureMcpConfiguration();
      this.setStatus('connected', '已就绪');
      return true;
    }
    this.setStatus('not_installed', 'Antigravity CLI 未安装');
    return false;
  }

  ensureMcpConfiguration() {
    try {
      const res = ensureAgyMcpServers(this.vaultBasePath);
      if (!res.ok) console.warn('[Antigravity] MCP 工具注册警告:', res.error);
    } catch (e) {
      console.warn('[Antigravity] MCP 工具注册异常:', e.message);
    }
  }

  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  syncThinkingFromTranscript() {
    if (!this.sessionId) return;
    const res = extractLatestThinking(this.sessionId);
    if (res.found && res.thinking) {
      const fullText = res.thinking;
      if (fullText.length > this.lastEmittedThinking.length) {
        let delta;
        if (fullText.startsWith(this.lastEmittedThinking)) {
          delta = fullText.slice(this.lastEmittedThinking.length);
        } else {
          delta = fullText;
        }
        this.lastEmittedThinking = fullText;
        if (!this.hasEmittedThinkingStart) {
          this.hasEmittedThinkingStart = true;
          this.isThinkingActive = true;
          this.emit('thinking_start', { startTime: this.thinkingStartTime || Date.now() });
        }
        this.emit('thinking_delta', delta);
      }
    }
  }

  /**
   * 发送前或会话切换时同步当前会话对应的 conversationId:
   * 切换到另一会话或重开页面时, 恢复该会话存档的 conversationId, 传递给 agy --conversation 续接上下文
   */
  _syncSessionConversation() {
    if (!this.sessionManager) return;
    try {
      const sid = this.sessionManager.getActiveSessionId ? this.sessionManager.getActiveSessionId('antigravity') : null;
      const current = this._boundSessionId === undefined ? null : this._boundSessionId;
      if (sid === current) return;
      let saved = { conversationId: null };
      if (sid && this.sessionManager.getSessionConversation) {
        saved = this.sessionManager.getSessionConversation('antigravity') || saved;
      }
      this.sessionId = saved.conversationId || null;
      this._boundSessionId = sid;
    } catch (e) {
      console.warn('[AntigravityAdapter] Failed to sync session conversation:', e);
    }
  }

  _persistConversationId() {
    if (!this.sessionManager || !this.sessionId || !this.sessionManager.setSessionConversation) return;
    try {
      this.sessionManager.setSessionConversation('antigravity', this.sessionId, null);
    } catch (e) {
      console.warn('[AntigravityAdapter] Failed to persist conversationId:', e);
    }
  }

  async send(text, contextPayload) {
    if (this.isStreaming && this.process) {
      return { success: false, error: '正在处理上一个指令，请稍候或先点击中止' };
    }

    this._syncSessionConversation();

    this.isStreaming = true;
    this.setStatus('thinking', 'Antigravity 正在思考...');
    this.emit('turn_start');

    const bin = this.resolveBinary();
    const vaultPath = this.vaultBasePath || process.cwd();
    const execMode = this.permissionMode === 'readwrite' ? 'accept-edits' : 'plan';
    this.ensureMcpConfiguration();

    // 拼接 TabonKB 专有工具指令提示词
    const allHints = WEKNORA_MCP_TOOL_HINT + VENDOR_MCP_TOOL_HINT + GERRIT_MCP_TOOL_HINT + OPENGROK_MCP_TOOL_HINT + DRAWIO_MCP_TOOL_HINT + POWERZ_MCP_TOOL_HINT + DSLOGIC_MCP_TOOL_HINT + JIRA_MCP_TOOL_HINT;
    const promptText = text + allHints;

    const args = [
      ...bin.prefixArgs,
      '-p', promptText,
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
      '--mode', execMode
    ];

    if (this.activeModelId) {
      args.push('--model', this.activeModelId);
    }

    const effort = this.getReasoningEffort();
    const supportsReasoning = this.supportsReasoningEffort(this.activeModelId);
    const modelHasBuiltinEffort = /-(?:high|medium|low)$/i.test(this.activeModelId || '');
    if (supportsReasoning && effort !== 'off' && !modelHasBuiltinEffort) {
      args.push('--effort', effort);
    }

    if (this.sessionId) {
      args.push('--conversation', this.sessionId);
    }

    // 重置思维链生命周期与结算标识
    this.thinkingStartTime = Date.now();
    this.isThinkingActive = false;
    this.hasEmittedThinkingStart = false;
    this.hasSettledTurn = false;
    this.lastEmittedThinking = '';
    // 本轮用量载荷追踪: 输入=prompt(含 MCP 工具 hints), 输出=text/思维链/工具参数/工具回传
    this._turnUsageTrack = {
      promptChars: (promptText || '').length,
      thinkingChars: 0,
      textChars: 0,
      toolCalls: 0,
      toolParamChars: 0,
      toolOutputChars: 0
    };
    if (this.thinkingPollTimer) {
      clearInterval(this.thinkingPollTimer);
      this.thinkingPollTimer = null;
    }

    // 若当前模型支持深度思考且未显式关闭，立即激活 thinking 状态
    if (supportsReasoning && effort !== 'off') {
      this.isThinkingActive = true;
      this.hasEmittedThinkingStart = true;
      this.emit('thinking_start', { startTime: this.thinkingStartTime });
    }

    // 启动高频思维链探测轮询 (300ms)
    this.thinkingPollTimer = setInterval(() => {
      if (this.sessionId) {
        this.syncThinkingFromTranscript();
      }
    }, 300);

    return new Promise((resolve) => {
      try {
        this.stdoutBuffer = '';
        this.activeTools.clear();

        // 注入所有工具所需的环境变量 (WeKnora, Vendor, Gerrit, OpenGrok)
        const injectedEnv = Object.assign(
          {},
          process.env,
          buildWeknoraEnv(vaultPath),
          buildVendorEnv(vaultPath),
          buildGerritEnv(vaultPath),
          buildOpengrokEnv(vaultPath),
          buildJiraEnv(vaultPath),
          {
            ANTIGRAVITY_WORKSPACE: vaultPath
          }
        );

        this.process = child_process.spawn(bin.cmd, args, {
          cwd: vaultPath,
          env: injectedEnv,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');

        this.capturedStderr = '';
        this.hasEmittedError = false;

        this.process.stdout.on('data', (chunk) => {
          this.handleStdoutChunk(chunk);
        });

        this.process.stderr.on('data', (chunk) => {
          const errStr = chunk.toString();
          this.capturedStderr += errStr;
          if (errStr.includes('[ERROR]') || errStr.includes('FATAL') || /^[EW]\d{4}\s/m.test(errStr) || errStr.includes('failed:') || errStr.includes('EOF')) {
            const cleanErr = errStr.split('\n').filter(l => l.includes('failed:') || l.includes('Error') || l.includes('EOF') || l.includes('FATAL')).join('; ') || errStr;
            this.hasEmittedError = true;
            this.emit('error', { error: cleanErr.trim() });
          }
        });

        this.process.on('close', (code) => {
          if (this.thinkingPollTimer) {
            clearInterval(this.thinkingPollTimer);
            this.thinkingPollTimer = null;
          }
          this.syncThinkingFromTranscript();
          if (this.isThinkingActive) {
            this.emit('thinking_end');
            this.isThinkingActive = false;
          }
          this.isStreaming = false;
          this.process = null;
          if (code !== 0 && !this.hasEmittedError) {
            const fallbackErr = this.capturedStderr.split('\n').find(l => l.includes('failed') || l.includes('EOF') || l.includes('Error')) || this.capturedStderr.slice(-300) || `CLI 异常退出 (code: ${code})`;
            this.hasEmittedError = true;
            this.emit('error', { error: fallbackErr.trim() });
          }
          if (!this.hasSettledTurn) {
            this.hasSettledTurn = true;
            this.emit('turn_end', { usage: this._buildTurnUsage(null) });
            this.emit('agent_settled');
            this.setStatus('connected', '已就绪');
          }
          resolve({ success: code === 0 });
        });

        this.process.on('error', (err) => {
          if (this.thinkingPollTimer) {
            clearInterval(this.thinkingPollTimer);
            this.thinkingPollTimer = null;
          }
          if (this.isThinkingActive) {
            this.emit('thinking_end');
            this.isThinkingActive = false;
          }
          this.isStreaming = false;
          this.process = null;
          this.setStatus('error', err.message);
          this.emit('error', { error: err.message });
          if (!this.hasSettledTurn) {
            this.hasSettledTurn = true;
            this.emit('agent_settled');
          }
          resolve({ success: false, error: err.message });
        });

        // 立即关闭 stdin 防止管道挂起
        this.process.stdin.end();

      } catch (e) {
        if (this.thinkingPollTimer) {
          clearInterval(this.thinkingPollTimer);
          this.thinkingPollTimer = null;
        }
        if (this.isThinkingActive) {
          this.emit('thinking_end');
          this.isThinkingActive = false;
        }
        this.isStreaming = false;
        this.process = null;
        this.setStatus('error', e.message);
        this.emit('error', { error: e.message });
        if (!this.hasSettledTurn) {
          this.hasSettledTurn = true;
          this.emit('agent_settled');
        }
        resolve({ success: false, error: e.message });
      }
    });
  }

  /**
   * 构建本轮结构化 usage: 优先 transcript 原生 token 统计, 否则 CJK 感知估算
   * 输入 = promptText(含 MCP hints) + 工具回传, 输出 = 正文 + 思维链 + 工具参数
   */
  _buildTurnUsage(res) {
    const tr = this._turnUsageTrack || {};
    this._turnUsageTrack = null;
    // 1. 原生 usage 优先 (result 事件自带 / transcript_full.jsonl 提取)
    const native = (res && (res.usage || res.token_count)) || extractNativeUsageFromTranscript(this.sessionId, process.env.USERPROFILE);
    if (native && typeof native === 'object') {
      const inp = Math.max(0, native.input ?? native.inputTokens ?? native.prompt_tokens ?? 0);
      const out = Math.max(0, native.output ?? native.outputTokens ?? native.completion_tokens ?? 0);
      const cr  = Math.max(0, native.cacheRead ?? native.cacheReadTokens ?? native.prompt_cache_hit_tokens ?? 0);
      const cw  = Math.max(0, native.cacheWrite ?? native.cacheWriteTokens ?? native.cache_creation_input_tokens ?? 0);
      if (inp + out + cr + cw > 0) {
        return {
          inputTokens: inp, outputTokens: out, cacheReadTokens: cr, cacheWriteTokens: cw,
          totalTokens: inp + out + cr + cw,
          netBillableTokens: inp + out + cw,
          subTurns: 1 + (tr.toolCalls || 0),
          isEstimated: false
        };
      }
    }
    // 2. CJK 感知结构化估算 (绝不伪造缓存)
    const inputTokens = Math.max(1, Math.ceil(
      estTokensByChars(tr.promptChars || 0) +
      estTokensByChars(tr.toolOutputChars || 0) +
      (tr.toolCalls || 0) * 120 + 600
    ));
    const outputTokens = Math.max(1,
      estTokensByChars(tr.textChars || 0) +
      estTokensByChars(tr.thinkingChars || 0) +
      estTokensByChars(tr.toolParamChars || 0));
    return {
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: inputTokens + outputTokens,
      netBillableTokens: inputTokens + outputTokens,
      subTurns: 1 + (tr.toolCalls || 0),
      isEstimated: true
    };
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
        // 忽略非完整行
      }
    }
  }

  handleEvent(event) {
    if (!event || typeof event !== 'object') return;

    // 1. 初始化事件: 记录 conversation_id 用于跨回合续接，并同步探测最新思维链
    if (event.event === 'init') {
      if (event.conversation_id) {
        this.sessionId = event.conversation_id;
        this._persistConversationId();
      }
      this.syncThinkingFromTranscript();
      return;
    }

    // 2. 步骤更新事件: 文本、思考过程与工具调用流
    if (event.event === 'step_update' && event.step_update) {
      const step = event.step_update;

      // 记录最新会话 ID
      if (step.conversation_id) {
        this.sessionId = step.conversation_id;
        this._persistConversationId();
      }

      // 文本生成 / 思维链更新
      if (step.step_type === 'agent_response') {
        if (step.thinking_delta) {
          this.lastEmittedThinking += step.thinking_delta;
          if (this._turnUsageTrack) this._turnUsageTrack.thinkingChars += step.thinking_delta.length;
          this.emit('thinking_delta', step.thinking_delta);
        }
        if (step.text_delta) {
          if (this._turnUsageTrack) this._turnUsageTrack.textChars += step.text_delta.length;
          if (this.isThinkingActive) {
            this.syncThinkingFromTranscript();
            this.emit('thinking_end');
            this.isThinkingActive = false;
          }
          this.emit('text_delta', step.text_delta);
        }
      }

      // 工具调用生命周期
      else if (step.step_type === 'tool') {
        const toolInfo = step.tool_info || {};
        let toolName = step.tool_name || toolInfo.name || 'tool';

        // 智能解包 MCP 工具: call_mcp_tool -> 具体工具名 (如 weknora_search, vendor_portal_search)
        if (toolName === 'call_mcp_tool' && toolInfo.parameters && toolInfo.parameters.ToolName) {
          toolName = toolInfo.parameters.ToolName;
        }

        const stepIdx = step.step_index != null ? step.step_index : Date.now();
        const callId = `agy_tool_${stepIdx}`;

        if (step.state === 'ACTIVE') {
          if (this._turnUsageTrack) {
            this._turnUsageTrack.toolCalls += 1;
            try { this._turnUsageTrack.toolParamChars += JSON.stringify(toolInfo.parameters || {}).length; } catch (_) {}
          }
          if (this.isThinkingActive) {
            this.syncThinkingFromTranscript();
            this.emit('thinking_end');
            this.isThinkingActive = false;
          }
          this.activeTools.set(callId, {
            name: toolName,
            startTime: Date.now()
          });
          this.setStatus('running_tool', `正在调用: ${toolName}`);
          this.emit('tool_start', {
            toolCallId: callId,
            toolName: toolName,
            args: toolInfo.parameters || {},
            actionDesc: `正在调用: ${toolName}`,
            startTime: Date.now()
          });
        } else if (step.state === 'DONE') {
          const prev = this.activeTools.get(callId) || { startTime: Date.now(), name: toolName };
          const duration = step.duration_seconds ? Math.round(step.duration_seconds * 1000) : (Date.now() - prev.startTime);
          if (this._turnUsageTrack) this._turnUsageTrack.toolOutputChars += String(toolInfo.output || '').length;
          this.emit('tool_end', {
            toolCallId: callId,
            toolName: prev.name,
            durationMs: duration,
            isError: false,
            output: toolInfo.output || '调用成功'
          });
          this.setStatus('thinking', 'Antigravity 正在整理结果...');
          // 工具执行完毕，后续可能进入新一轮推演
          const eff = this.getReasoningEffort();
          if (this.supportsReasoningEffort(this.activeModelId) && eff !== 'off') {
            this.isThinkingActive = true;
            this.thinkingStartTime = Date.now();
            this.emit('thinking_start', { startTime: this.thinkingStartTime });
          }
        } else if (step.state === 'ERROR') {
          const prev = this.activeTools.get(callId) || { startTime: Date.now(), name: toolName };
          const duration = step.duration_seconds ? Math.round(step.duration_seconds * 1000) : (Date.now() - prev.startTime);
          const errMsg = (toolInfo.error && toolInfo.error.message) || '工具调用失败';
          this.emit('tool_end', {
            toolCallId: callId,
            toolName: prev.name,
            durationMs: duration,
            isError: true,
            output: errMsg
          });
          this.setStatus('thinking', 'Antigravity 正在处理异常...');
          const eff = this.getReasoningEffort();
          if (this.supportsReasoningEffort(this.activeModelId) && eff !== 'off') {
            this.isThinkingActive = true;
            this.thinkingStartTime = Date.now();
            this.emit('thinking_start', { startTime: this.thinkingStartTime });
          }
        }
      }
      return;
    }

    // 3. 最终结果结算
    if (event.event === 'result') {
      if (this.thinkingPollTimer) {
        clearInterval(this.thinkingPollTimer);
        this.thinkingPollTimer = null;
      }
      const res = event.result || {};
      if (res.conversation_id) {
        this.sessionId = res.conversation_id;
        this._persistConversationId();
      }
      this.syncThinkingFromTranscript();
      if (this.isThinkingActive) {
        this.emit('thinking_end');
        this.isThinkingActive = false;
      }
      if (res.status === 'ERROR') {
        const errMsg = res.error_message || res.error || res.message || res.response || (this.capturedStderr && this.capturedStderr.trim()) || '执行失败';
        this.hasEmittedError = true;
        this.emit('error', { error: errMsg });
      }
      if (!this.hasSettledTurn) {
        this.hasSettledTurn = true;
        this.emit('turn_end', { usage: this._buildTurnUsage(res) });
        this.emit('agent_settled');
        this.setStatus('connected', '已就绪');
      }
    }
  }

  async abort() {
    if (this.thinkingPollTimer) {
      clearInterval(this.thinkingPollTimer);
      this.thinkingPollTimer = null;
    }
    if (this.isThinkingActive) {
      this.emit('thinking_end');
      this.isThinkingActive = false;
    }
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
    if (!this.hasSettledTurn) {
      this.hasSettledTurn = true;
      this.emit('agent_settled');
    }
  }

  async newSession() {
    await this.abort();
    this.sessionId = null;
    this._boundSessionId = null;
    this.lastEmittedThinking = '';
    this.activeTools.clear();
    this.setStatus('connected', '已重置会话');
  }
}

module.exports = { AntigravityAdapter, ensureAgyMcpServers };
