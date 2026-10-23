const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const { WEKNORA_MCP_SERVER_NAME, WEKNORA_MCP_TOOL_HINT, weknoraMcpResolveNodeExe, weknoraMcpScriptPath, buildWeknoraEnv } = require('../mcp/weknora-mcp-shared.js');
const { VENDOR_MCP_SERVER_NAME, VENDOR_MCP_TOOL_HINT, vendorMcpScriptPath, buildVendorEnv } = require('../mcp/vendor-mcp-shared.js');
const { GERRIT_MCP_SERVER_NAME, GERRIT_MCP_TOOL_HINT, gerritMcpScriptPath, buildGerritEnv } = require('../mcp/gerrit-mcp-shared.js');
const { OPENGROK_MCP_SERVER_NAME, OPENGROK_MCP_TOOL_HINT, opengrokMcpScriptPath, buildOpengrokEnv } = require('../mcp/opengrok-mcp-shared.js');
const { DRAWIO_MCP_SERVER_NAME, DRAWIO_MCP_TOOL_HINT, drawioMcpScriptPath } = require('../mcp/drawio-mcp-shared.js');
const { POWERZ_MCP_SERVER_NAME, POWERZ_MCP_TOOL_HINT, powerzMcpScriptPath } = require('../mcp/powerz-mcp-shared.js');
const { DSLOGIC_MCP_SERVER_NAME, DSLOGIC_MCP_TOOL_HINT, dslogicMcpScriptPath } = require('../mcp/dslogic-mcp-shared.js');
const { JIRA_MCP_SERVER_NAME, JIRA_MCP_TOOL_HINT, jiraMcpScriptPath, buildJiraEnv } = require('../mcp/jira-mcp-shared.js');
const { buildFileRefHint } = require('../mcp/file-ref-hint-shared.js');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

/**
 * 确保 Antigravity CLI 拥有 TabonKB 专有 MCP 工具与工作区信任配置 (幂等, 自动写入)
 * 配置写入 ~/.gemini/config/mcp_config.json 以及 ~/.gemini/antigravity-cli/settings.json
 */
// MCP command 使用 GUI 子系统 node 副本避免 conhost 闪屏；bundle 内由 vendor-mcp-shared.js 提供
function agyMcpGuiNodeExe(e) { return typeof mcpResolveGuiNodeExe === 'function' ? mcpResolveGuiNodeExe(e) : e; }

function ensureAgyMcpServers(vaultBasePath) {
  try {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Administrator';
    const configDir = path.join(userProfile, '.gemini', 'config');
    const mcpConfigFile = path.join(configDir, 'mcp_config.json');

    const nodeExe = agyMcpGuiNodeExe(weknoraMcpResolveNodeExe());
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
 * agy 模型元数据表：权威 id/名称列表来自 `agy models`（refreshModels 动态拉取），
 * 本地仅登记 desc/icon/effort 标注；未登记 id 走 _familyMeta 按前缀归入家族分组兜底。
 */
const AGY_MODEL_META = {
  'gemini-3.8-flash-high':    { desc: '极速响应与高阶长上下文推理 (默认推荐)', icon: '⚡', iconPark: 'lightning', supportsReasoningEffort: true },
  'gemini-3.8-flash-medium':  { desc: '速度与推理深度均衡档', icon: '⚡', iconPark: 'lightning', supportsReasoningEffort: true },
  'gemini-3.8-flash-low':     { desc: '轻量推理，极速低成本', icon: '⚡', iconPark: 'lightning', supportsReasoningEffort: true },
  'claude-sonnet-4-6':        { desc: '高水平编码与架构深度思考', icon: '🧠', iconPark: 'brain', supportsReasoningEffort: true },
  'claude-opus-4-6-thinking': { desc: '旗舰级最强综合分析思考', icon: '🧠', iconPark: 'brain', supportsReasoningEffort: true },
  'gpt-oss-120b-medium':      { desc: '开源千亿参数推理模型', icon: '🌐', iconPark: 'globe', supportsReasoningEffort: false }
};

/** 家族分组展示元数据（渲染顺序即数组顺序） */
const AGY_MODEL_GROUP_META = {
  'gemini':  { group: 'Gemini 旗舰与高阶推理', icon: '🔷', iconPark: 'diamond', isTop: true },
  'claude':  { group: 'Claude 深度思考系列', icon: '🧠', iconPark: 'brain' },
  'gpt-oss': { group: '开源与通用大模型', icon: '🌐', iconPark: 'cloud' },
  'other':   { group: '其他模型', icon: '📦', iconPark: 'box' }
};

/** CLI 不可达时的兜底静态列表（与 agy 1.4.2 `agy models` 对齐） */
const AGY_MODEL_FALLBACK = [
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' },
  { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' }
];

/** UI effort → 型号档位映射：off 无对应变体取最低档 low；xhigh/max 封顶 high */
const AGY_EFFORT_TIER_MAP = { off: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };

function agyModelFamily(id) {
  const s = String(id || '').toLowerCase();
  if (s.startsWith('gemini')) return 'gemini';
  if (s.startsWith('claude')) return 'claude';
  if (s.startsWith('gpt-oss') || s.startsWith('gpt_oss')) return 'gpt-oss';
  return 'other';
}

/** 解析 `agy models` 输出：每行 `id<TAB>名称`，跳过 Fetching/空行 */
function parseAgyModelsOutput(out) {
  const list = [];
  for (const line of String(out || '').split('\n')) {
    const t = line.trim();
    if (!t || /^fetching/i.test(t)) continue;
    const parts = t.split(/\t| {2,}/);
    const id = parts[0].trim();
    if (!id || /\s/.test(id)) continue;
    list.push({ id, name: (parts[1] || id).trim() });
  }
  return list;
}

/**
 * agy 各模型上下文窗口（`agy models` 不暴露，按厂商公称值登记；未登记模型返回 0 则不显示占比）。
 */
const AGY_CONTEXT_WINDOWS = {
  'gemini': 1048576,
  'claude': 200000,
  'gpt-oss': 131072
};

/**
 * 从 transcript_full.jsonl 尾部倒查最后一条带 token 计账的条目（PLANNER_RESPONSE），
 * input_tokens + cache_read_tokens + output_tokens 即当时上下文长度（与 pi calculateContextTokens 同口径）。
 */
function extractLatestContextTokens(convId, userProfile) {
  if (!convId) return null;
  try {
    const root = userProfile || process.env.USERPROFILE || 'C:\\Users\\Administrator';
    const fp = path.join(root, '.gemini', 'antigravity-cli', 'brain', convId, '.system_generated', 'logs', 'transcript_full.jsonl');
    if (!fs.existsSync(fp)) return null;
    const lines = fs.readFileSync(fp, 'utf8').trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || !line.startsWith('{')) continue;
      try {
        const e = JSON.parse(line);
        const inp = Math.max(0, e.input_tokens ?? e.inputTokens ?? 0);
        const cr = Math.max(0, e.cache_read_tokens ?? e.cacheReadTokens ?? 0);
        const out = Math.max(0, e.output_tokens ?? e.outputTokens ?? 0);
        if (inp + cr + out > 0) return inp + cr + out;
      } catch (_) {}
    }
    return null;
  } catch (_) {
    return null;
  }
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
    // 恢复上次选中模型（重载持久化）
    try {
      if (typeof localStorage !== 'undefined') {
        const savedId = localStorage.getItem('tabonkb-agy-active-model');
        if (savedId) {
          this.activeModelId = savedId;
          this.activeModelName = localStorage.getItem('tabonkb-agy-active-model-name') || savedId;
        }
      }
    } catch (_) {}

    // 思维链状态追踪
    this.isThinkingActive = false;
    this.thinkingStartTime = null;
    this.lastEmittedThinking = '';
    this.thinkingPollTimer = null;
    this.reasoningEffort = null;

    // 动态模型列表：_remoteModels 为 `agy models` 权威结果（localStorage 缓存防首屏空态）
    this._remoteModels = null;
    this._modelsFetchedAt = 0;
    this._modelsFetching = null;
    this._hydrateModelsCache();
  }

  _hydrateModelsCache() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = JSON.parse(localStorage.getItem('tabonkb-agy-models') || 'null');
      if (raw && Array.isArray(raw.models) && raw.models.length) {
        this._remoteModels = raw.models;
      }
    } catch (_) {}
  }

  /**
   * 拉取 `agy models` 权威模型列表（15s 超时、5min TTL、并发去重）。
   * 成功后：缓存 localStorage + 校正失效选中模型 + 广播 model_list_change。
   */
  refreshModels(force = false) {
    if (this._modelsFetching) return this._modelsFetching;
    if (!force && this._modelsFetchedAt && Date.now() - this._modelsFetchedAt < 5 * 60 * 1000) {
      return Promise.resolve(this._remoteModels);
    }
    this._modelsFetching = new Promise((resolve) => {
      let proc = null;
      const finish = (list) => {
        this._modelsFetching = null;
        if (list && list.length) {
          this._remoteModels = list;
          this._modelsFetchedAt = Date.now();
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('tabonkb-agy-models', JSON.stringify({ at: this._modelsFetchedAt, models: list }));
            }
          } catch (_) {}
          this._reconcileActiveModel();
          this.emit('model_list_change', { models: list });
        }
        resolve(this._remoteModels);
      };
      try {
        const bin = this.resolveBinary();
        proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, 'models'], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore']
        });
        let out = '';
        const timer = setTimeout(() => { try { proc.kill(); } catch (_) {} }, 15000);
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.on('close', () => { clearTimeout(timer); finish(parseAgyModelsOutput(out)); });
        proc.on('error', () => { clearTimeout(timer); finish(null); });
      } catch (_) {
        finish(null);
      }
    });
    return this._modelsFetching;
  }

  /** 选中模型已不在上游列表（如版本下架）→ 自动切到首个可用模型，避免 --model 发送必败 */
  _reconcileActiveModel() {
    if (!this._remoteModels || !this._remoteModels.length) return;
    if (this._remoteModels.some(m => m.id === this.activeModelId)) return;
    const first = this._remoteModels[0];
    console.warn(`[Antigravity] 模型 ${this.activeModelId} 已不在 agy models 列表，自动切换至 ${first.id}`);
    this.setModel(first.id, first.name);
  }

  supportsReasoningEffort(modelId) {
    const id = String(modelId || this.activeModelId || '').toLowerCase();
    return id.includes('flash') || id.includes('pro') || id.includes('thinking') || id.includes('claude') || id.includes('gemini');
  }

  /**
   * 型号内建推理档位：-low/-medium/-high 后缀 = 该变体固定 tier，
   * `--effort` 必须与之精确相等否则 agy 报 conflicts 拒绝（实测）。
   * 发送路径对这些变体直接省略 --effort；UI 据此显示固定档位徽标而非可选器。
   */
  builtinEffortTier(modelId) {
    const m = /-(?:high|medium|low)$/i.exec(String(modelId || this.activeModelId || ''));
    return m ? m[0].slice(1).toLowerCase() : null;
  }

  mapEffortToTier(effort) {
    return AGY_EFFORT_TIER_MAP[String(effort || 'high').toLowerCase()] || 'high';
  }

  /**
   * 档位族变体表：id 为 base（gemini-3.8-flash）或带档后缀均可，返回 {low,medium,high}→远端真实 id。
   * 无变体（非档位族/上游未提供）返回 null。
   */
  _tierVariants(id) {
    const s = String(id || '');
    const m = /-(?:low|medium|high)$/i.exec(s);
    const base = m ? s.slice(0, -m[0].length) : s;
    if (!base) return null;
    const src = (Array.isArray(this._remoteModels) && this._remoteModels.length) ? this._remoteModels : AGY_MODEL_FALLBACK;
    const tiers = {};
    for (const r of src) {
      const rid = String(r.id || '');
      const t = /-(low|medium|high)$/i.exec(rid);
      if (t && rid.slice(0, -t[0].length).toLowerCase() === base.toLowerCase()) tiers[t[1].toLowerCase()] = rid;
    }
    return Object.keys(tiers).length ? tiers : null;
  }

  /** id + effort → 实际应发送的具体型号 id（档位族折叠逻辑在此收束） */
  _resolveTierModelId(id, effort) {
    const tiers = this._tierVariants(id);
    if (!tiers) return String(id || '');
    const want = this.mapEffortToTier(effort);
    return tiers[want] || tiers.high || tiers.medium || tiers.low || String(id || '');
  }

  /** 档位族折叠型号返回其真实可用档位列表（如 ['low','medium','high']），否则 null */
  getModelTierLevels(id) {
    const tiers = this._tierVariants(id);
    return tiers ? ['low', 'medium', 'high'].filter(t => tiers[t]) : null;
  }

  /**
   * UI 档位标签：具体变体 id → 固定档位；档位族 base id → 当前 effort 映射档位；
   * 非档位族返回 null。
   */
  getModelEffortConfig(modelId) {
    const map = {
      low: { id: 'low', label: '低推理' },
      medium: { id: 'medium', label: '中推理' },
      high: { id: 'high', label: '高推理' }
    };
    const tier = this.builtinEffortTier(modelId) ||
      (this._tierVariants(modelId) ? this.mapEffortToTier(this.getReasoningEffort()) : null);
    return tier ? map[tier] : null;
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

  _applyEffort(effort) {
    this.reasoningEffort = effort || 'high';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-agy-reasoning-effort', this.reasoningEffort);
    }
    this.emit('reasoning_effort_change', this.reasoningEffort);
  }

  setReasoningEffort(effort) {
    this._applyEffort(effort);
    // 当前型号为档位族变体 → 重定向到对应 tier 变体（档位 = 型号切换）
    const resolved = this._resolveTierModelId(this.activeModelId, this.reasoningEffort);
    if (resolved && resolved !== this.activeModelId) {
      this.activeModelId = resolved;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-agy-active-model', resolved);
      }
      this.emit('model_change', { modelId: resolved, displayName: this.activeModelName });
    }
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
    // effort 先落账但不 retarget（此时 id 还是旧型号）；再由 _resolveTierModelId 收束到具体变体
    if (reasoningEffort !== null && reasoningEffort !== undefined) {
      this._applyEffort(reasoningEffort);
    }
    const resolved = this._resolveTierModelId(modelId, this.getReasoningEffort());
    this.activeModelId = resolved;
    this.activeModelName = modelName || resolved;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-agy-active-model', resolved);
      localStorage.setItem('tabonkb-agy-active-model-name', this.activeModelName);
    }
    this.emit('model_change', { modelId: resolved, displayName: this.activeModelName });
  }

  /**
   * 模型分组：权威列表 = `agy models` 远端结果（localStorage 缓存亦可）；
   * CLI 不可达时回落 AGY_MODEL_FALLBACK。未登记 id 按前缀入家族分组、desc 降级。
   * 每次调用顺手触发 TTL 过期检查（后台静默刷新）。
   */
  getModelGroups() {
    const remote = Array.isArray(this._remoteModels) && this._remoteModels.length ? this._remoteModels : null;
    const list = remote || AGY_MODEL_FALLBACK;
    if (remote) this.refreshModels();

    // 档位族折叠：gemini-3.8-flash-{low,medium,high} → 单一「Gemini 3.8 Flash」条目，
    // tiers 记录各档位真实 id，等级切换由 reasoning 浮层驱动 setModel 解析
    const collapsed = [];
    const tierSeen = new Map();
    for (const m of list) {
      const t = /-(low|medium|high)$/i.exec(String(m.id || ''));
      if (t) {
        const base = m.id.slice(0, -t[0].length);
        let entry = tierSeen.get(base);
        if (!entry) {
          entry = { id: base, name: String(m.name || base).replace(/\s*\((?:low|medium|high)\)\s*$/i, ''), tiers: {} };
          tierSeen.set(base, entry);
          collapsed.push(entry);
        }
        entry.tiers[t[1].toLowerCase()] = m.id;
      } else {
        collapsed.push({ id: m.id, name: m.name });
      }
    }

    const buckets = {};
    for (const m of collapsed) {
      const fam = agyModelFamily(m.id);
      // 元数据回退链：base id → 任一档位变体（high 优先）→ 家族默认
      const meta = AGY_MODEL_META[m.id]
        || (m.tiers && (AGY_MODEL_META[m.tiers.high] || AGY_MODEL_META[m.tiers.medium] || AGY_MODEL_META[m.tiers.low]))
        || null;
      const item = {
        id: m.id,
        name: m.name || m.id,
        desc: meta ? meta.desc : '',
        icon: meta ? meta.icon : (AGY_MODEL_GROUP_META[fam] || {}).icon || '✦',
        iconPark: meta ? meta.iconPark : (AGY_MODEL_GROUP_META[fam] || {}).iconPark || 'cpu',
        supportsReasoningEffort: meta ? meta.supportsReasoningEffort : this.supportsReasoningEffort(m.id)
      };
      if (m.tiers) item.tiers = m.tiers;
      (buckets[fam] = buckets[fam] || []).push(item);
    }

    const order = ['gemini', 'claude', 'gpt-oss', 'other'];
    return order
      .filter(f => buckets[f] && buckets[f].length)
      .map(f => Object.assign({}, AGY_MODEL_GROUP_META[f], { models: buckets[f] }));
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
      this.refreshModels(true).catch(() => {});
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
   * agy 无 RPC 状态通道：上下文占用读 transcript_full.jsonl 尾条 token 计账，
   * contextWindow 取内置公称窗口表（未知模型返回 0 → UI 不显示占比）。
   * 手动压缩不支持：print 模式实测 `/compact` 被当用户消息、`compact` stream event 被拒收，
   * 压缩仅存在于交互 TUI 与自动阈值路径，故不实现 compact()。
   */
  getContextWindow() {
    const id = String(this.activeModelId || '').toLowerCase();
    for (const key of Object.keys(AGY_CONTEXT_WINDOWS)) {
      if (id.includes(key)) return AGY_CONTEXT_WINDOWS[key];
    }
    return 0;
  }

  async getContextUsage() {
    this._syncSessionConversation();
    const tokens = extractLatestContextTokens(this.sessionId, process.env.USERPROFILE);
    const win = this.getContextWindow();
    if (tokens === null && !win) return null;
    return {
      tokens,
      contextWindow: win,
      percent: (typeof tokens === 'number' && win > 0) ? (tokens / win) * 100 : null
    };
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
    // 三档映射: readonly→plan; readwrite/full→accept-edits (本 CLI 无更激进档)
    const execMode = this.permissionMode === 'readonly' ? 'plan' : 'accept-edits';
    this.ensureMcpConfiguration();

    // 拼接 TabonKB 专有工具指令提示词
    const allHints = WEKNORA_MCP_TOOL_HINT + VENDOR_MCP_TOOL_HINT + GERRIT_MCP_TOOL_HINT + OPENGROK_MCP_TOOL_HINT + DRAWIO_MCP_TOOL_HINT + POWERZ_MCP_TOOL_HINT + DSLOGIC_MCP_TOOL_HINT + JIRA_MCP_TOOL_HINT + buildFileRefHint(vaultPath);
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
    // 内建档位变体（-low/-medium/-high 后缀）省略 --effort：agy 要求与后缀精确相等否则报错
    if (supportsReasoning && effort !== 'off' && !this.builtinEffortTier(this.activeModelId)) {
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

      // 每步 DONE 携带原生 usage（snake_case）：per-call 口径 = 当时上下文长度 → 广播给 Ctx 胶囊
      if (step.state === 'DONE' && step.usage && typeof step.usage === 'object') {
        this.emit('context_usage', step.usage);
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
            output: toolInfo.output || ''
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
