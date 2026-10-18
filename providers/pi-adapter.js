const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

let PiAgentBridgeClass = null;
try {
  PiAgentBridgeClass = require('../pi-agent-bridge.js').PiAgentBridge;
} catch (e) {}

/**
 * PiAdapter: Adapts PiAgentBridge to the unified AgentAdapter interface.
 * Preserves 100% of the existing Pi RPC streaming & tool capabilities.
 */
class PiAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'pi',
      name: 'pi',
      displayName: 'Pi',
      icon: getAgentBrandSvg('pi', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.bridge = options.bridge || null;
    if (!this.bridge) {
      const BridgeCls = (typeof PiAgentBridge !== 'undefined') ? PiAgentBridge : PiAgentBridgeClass;
      if (BridgeCls) {
        this.bridge = new BridgeCls({
          vaultBasePath: this.vaultBasePath,
          permissionMode: this.permissionMode
        });
      }
    }

    this.reasoningEffort = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-reasoning-effort')) || 'max';
    this.modelsMap = new Map();
    this.cachedGroups = [];
    this._lastMtime = 0;

    // Load models dynamically from models.json
    this.loadModelsFromDisk(true);

    let savedModel = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model')) || 'deepseek-v4-flash';
    let savedName = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model-name')) || 'DeepSeek V4 Flash (推荐)';

    // Seamless migration from outdated hardcoded gpt-5.6-sol to gpt-6-sol from models.json
    if (savedModel === 'gpt-5.6-sol' && !this.modelsMap.has('gpt-5.6-sol') && this.modelsMap.has('gpt-6-sol')) {
      savedModel = 'gpt-6-sol';
      savedName = 'gpt-6-sol';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-pi-active-model', savedModel);
        localStorage.setItem('tabonkb-pi-active-model-name', savedName);
      }
    }

    this.activeModelId = savedModel;
    this.activeModelName = savedName;

    if (this.bridge) {
      this.setupBridgeEvents();
    }
  }

  getModelsJsonPath() {
    const home = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
    const candidates = [
      path.join(home, '.pi', 'agent', 'models.json'),
      path.join(process.env.APPDATA || '', '..', '.pi', 'agent', 'models.json'),
      path.join(this.vaultBasePath || '', '.pi', 'agent', 'models.json')
    ];
    for (const c of candidates) {
      try {
        if (c && fs.existsSync(c)) return c;
      } catch (e) {}
    }
    return candidates[0];
  }

  loadModelsFromDisk(force = false) {
    const jsonPath = this.getModelsJsonPath();
    let fileStat = null;
    try {
      if (fs.existsSync(jsonPath)) {
        fileStat = fs.statSync(jsonPath);
      }
    } catch (e) {}

    if (!force && fileStat && this._lastMtime && fileStat.mtimeMs === this._lastMtime && this.cachedGroups.length > 0) {
      return this.cachedGroups;
    }

    if (fileStat) {
      this._lastMtime = fileStat.mtimeMs;
    }

    try {
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && data.providers && typeof data.providers === 'object') {
          const newGroups = [];
          const newModelsMap = new Map();

          for (const [providerKey, provider] of Object.entries(data.providers)) {
            if (!provider || typeof provider !== 'object') continue;
            const pName = provider.name || providerKey;
            let groupTitle = pName;
            let brand = 'openai';
            let iconPark = 'planet';
            let isTop = false;

            const keyLower = providerKey.toLowerCase();
            const baseLower = (provider.baseUrl || '').toLowerCase();

            if (keyLower.includes('deepseek') || baseLower.includes('deepseek')) {
              groupTitle = 'DeepSeek 极速直连 (推荐)';
              brand = 'deepseek';
              iconPark = 'lightning';
              isTop = true;
            } else if (keyLower.includes('jojom') || keyLower.includes('openai') || baseLower.includes('openai')) {
              groupTitle = 'OpenAI / Jojom 通道';
              brand = 'openai';
              iconPark = 'planet';
            } else if (keyLower.includes('anthropic') || keyLower.includes('claude')) {
              groupTitle = 'Anthropic Claude 通道';
              brand = 'anthropic';
              iconPark = 'cpu';
            } else if (keyLower.includes('gemini') || keyLower.includes('google')) {
              groupTitle = 'Google Gemini 通道';
              brand = 'gemini';
              iconPark = 'diamond';
            } else if (keyLower.includes('qwen') || baseLower.includes('dashscope') || baseLower.includes('aliyun')) {
              groupTitle = '通义千问 Qwen 通道';
              brand = 'qwen';
              iconPark = 'star';
            }

            const modelList = [];
            for (const m of (provider.models || [])) {
              if (!m || !m.id) continue;
              const id = m.id;
              let name = m.name || m.id;
              let desc = '';
              if (id === 'deepseek-v4-flash') {
                desc = '官方极速直连 · 毫秒响应 · 稳定无排队';
              } else if (id === 'deepseek-v4-pro') {
                desc = '官方深度推理 · 超长上下文';
              } else if (id.includes('sol')) {
                desc = 'Jojom 通道 (若上游限流可随时切回 DeepSeek)';
              } else {
                const ctx = m.contextWindow ? (m.contextWindow >= 1000000 ? (m.contextWindow / 1000000) + 'M' : Math.round(m.contextWindow / 1000) + 'K') : '';
                const maxOut = m.maxTokens ? (m.maxTokens >= 1000 ? Math.round(m.maxTokens / 1000) + 'K' : m.maxTokens) : '';
                desc = ctx ? `上下文 ${ctx}${maxOut ? ` · 最大输出 ${maxOut}` : ''}` : (m.api || '官方接口');
              }

              const item = {
                id: id,
                name: name,
                desc: desc,
                provider: providerKey,
                brand: brand,
                iconPark: iconPark,
                supportsReasoningEffort: m.reasoning !== false,
                thinkingLevelMap: m.thinkingLevelMap || null
              };

              newModelsMap.set(id, item);
              modelList.push(item);
            }

            if (modelList.length > 0) {
              newGroups.push({
                group: groupTitle,
                brand: brand,
                iconPark: iconPark,
                isTop: isTop,
                models: modelList
              });
            }
          }

          if (newGroups.length > 0) {
            newGroups.sort((a, b) => (b.isTop ? 1 : 0) - (a.isTop ? 1 : 0));
            this.cachedGroups = newGroups;
            this.modelsMap = newModelsMap;
            return this.cachedGroups;
          }
        }
      }
    } catch (err) {
      console.warn('[PiAdapter] Failed to load models.json from disk:', err);
    }

    // Built-in fallback groups
    if (!this.cachedGroups || this.cachedGroups.length === 0) {
      this.cachedGroups = [
        {
          group: 'DeepSeek 极速直连 (推荐)',
          icon: '⚡',
          iconPark: 'lightning',
          brand: 'deepseek',
          isTop: true,
          models: [
            { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (推荐)', desc: '官方极速直连 · 毫秒响应 · 稳定无排队', icon: '⚡', iconPark: 'lightning', brand: 'deepseek', provider: 'cc-switch-deep-seek', supportsReasoningEffort: true },
            { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: '官方深度推理 · 超长上下文', icon: '💎', iconPark: 'diamond', brand: 'deepseek', provider: 'cc-switch-deep-seek', supportsReasoningEffort: true }
          ]
        },
        {
          group: 'OpenAI / Jojom 通道',
          icon: '🪐',
          iconPark: 'planet',
          brand: 'openai',
          models: [
            { id: 'gpt-6-sol', name: 'gpt-6-sol', desc: 'Jojom 通道 (若上游限流可随时切回 DeepSeek)', icon: '🪐', iconPark: 'planet', brand: 'openai', provider: 'jojom', supportsReasoningEffort: true }
          ]
        }
      ];
      this.modelsMap.clear();
      for (const g of this.cachedGroups) {
        for (const m of g.models) {
          this.modelsMap.set(m.id, m);
        }
      }
    }

    return this.cachedGroups;
  }

  reloadModels() {
    return this.loadModelsFromDisk(true);
  }

  getModelGroups() {
    return this.loadModelsFromDisk(false);
  }

  supportsReasoningEffort(modelId) {
    this.loadModelsFromDisk(false);
    const id = modelId || this.activeModelId;
    const m = this.modelsMap ? this.modelsMap.get(id) : null;
    if (m && m.supportsReasoningEffort !== undefined) {
      return !!m.supportsReasoningEffort;
    }
    const idStr = String(id || '').toLowerCase();
    return idStr.includes('pro') || idStr.includes('flash') || idStr.includes('sol') || idStr.includes('thinking') || idStr.startsWith('o1') || idStr.startsWith('o3');
  }

  getReasoningEffort() {
    return this.reasoningEffort || 'max';
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
    return map[level] || map['max'];
  }

  setReasoningEffort(level) {
    this.reasoningEffort = level || 'max';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-reasoning-effort', this.reasoningEffort);
    }
    if (this.bridge && typeof this.bridge.setReasoningEffort === 'function') {
      this.bridge.setReasoningEffort(this.reasoningEffort);
    }
  }

  getModel() {
    return {
      id: this.activeModelId,
      name: this.activeModelName,
      reasoningEffort: this.getReasoningEffort()
    };
  }

  async setModel(modelId, modelName, reasoningEffort = null) {
    this.loadModelsFromDisk(false);
    const modelInfo = this.modelsMap ? this.modelsMap.get(modelId) : null;

    this.activeModelId = modelId;
    this.activeModelName = modelName || modelInfo?.name || modelId;

    if (reasoningEffort !== null && reasoningEffort !== undefined) {
      this.setReasoningEffort(reasoningEffort);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-active-model', this.activeModelId);
      localStorage.setItem('tabonkb-pi-active-model-name', this.activeModelName);
    }

    let provider = modelInfo?.provider || 'cc-switch-deep-seek';
    if (!modelInfo) {
      if (modelId.includes('sol') || modelId.includes('gpt')) {
        provider = 'jojom';
      }
    }

    if (this.bridge && typeof this.bridge.setModel === 'function') {
      await this.bridge.setModel(provider, modelId, this.reasoningEffort);
    }
  }

  /**
   * invalid_encrypted_content 自愈：净化会话文件后 --session 恢复
   */
  async repairEncryptedContentSession() {
    if (this.bridge && typeof this.bridge.repairEncryptedContentSession === 'function') {
      return await this.bridge.repairEncryptedContentSession();
    }
    return false;
  }

  setBridge(bridge) {
    this.bridge = bridge;
    this.setupBridgeEvents();
  }

  get isStreaming() {
    if (this.bridge) {
      return !!this.bridge.isStreaming;
    }
    return !!this._isStreaming;
  }

  set isStreaming(val) {
    this._isStreaming = !!val;
    if (this.bridge && !val) {
      this.bridge.isStreaming = false;
    }
  }

  setupBridgeEvents() {
    if (!this.bridge) return;

    // Forward bridge status
    this.bridge.on('status_change', (data) => {
      this.status = data.status;
      this.statusDetail = data.detail;
      if (data.status === 'connected' || data.status === 'disconnected' || data.status === 'error') {
        this.isStreaming = false;
      }
      this.emit('status_change', data);
    });

    this.bridge.on('permission_change', (mode) => {
      this.permissionMode = mode;
      this.emit('permission_change', mode);
    });

    // Forward conversational events
    this.bridge.on('turn_start', (d) => {
      this.isStreaming = true;
      this.emit('turn_start', d);
    });
    this.bridge.on('thinking_start', (d) => this.emit('thinking_start', d));
    this.bridge.on('thinking_delta', (d) => this.emit('thinking_delta', d));
    this.bridge.on('thinking_end', (d) => this.emit('thinking_end', d));
    this.bridge.on('text_delta', (d) => this.emit('text_delta', d));
    this.bridge.on('tool_start', (d) => this.emit('tool_start', d));
    this.bridge.on('tool_end', (d) => this.emit('tool_end', d));
    this.bridge.on('turn_end', (d) => {
      if (!this.bridge || !this.bridge.isStreaming) {
        this.isStreaming = false;
      }
      this.emit('turn_end', d);
    });
    this.bridge.on('agent_settled', (d) => {
      this.isStreaming = false;
      this.emit('agent_settled', d);
    });
    this.bridge.on('error', (d) => {
      this.isStreaming = false;
      this.emit('error', d);
    });

    // 流式交互队列：steer/follow_up 快照与入队回显、abort 队列回收
    this.bridge.on('queue_update', (d) => this.emit('queue_update', d));
    this.bridge.on('user_message', (d) => this.emit('user_message', d));
    this.bridge.on('queue_cleared', (d) => this.emit('queue_cleared', d));
  }

  getStatus() {
    if (this.bridge) {
      return this.bridge.getStatus();
    }
    return { status: this.status, detail: this.statusDetail };
  }

  async detect() {
    try {
      const appData = process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming';
      const nodeDir = path.join(appData, 'node-v24.15.0');
      const nodeExe = path.join(nodeDir, 'node.exe');
      const bundleJs = path.join(nodeDir, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'bundle', 'cli.js');
      const piCmd = path.join(nodeDir, 'pi.cmd');

      const exists = (fs.existsSync(nodeExe) && fs.existsSync(bundleJs)) || fs.existsSync(piCmd);
      if (!exists) {
        this.status = 'not_installed';
        this.statusDetail = '未检测到 Pi CLI 环境';
        return { available: false, error: '未检测到 Pi CLI 环境' };
      }
      return { available: true };
    } catch (e) {
      this.status = 'not_installed';
      return { available: false, error: e.message };
    }
  }

  async start() {
    if (!this.bridge) {
      const BridgeCls = (typeof PiAgentBridge !== 'undefined') ? PiAgentBridge : PiAgentBridgeClass;
      if (BridgeCls) {
        this.bridge = new BridgeCls({
          vaultBasePath: this.vaultBasePath,
          permissionMode: this.permissionMode
        });
        this.setupBridgeEvents();
      } else {
        this.setStatus('error', '未找到 PiAgentBridge 类');
        return false;
      }
    }
    const ok = await this.bridge.start();
    if (ok) {
      this.status = 'connected';
      this.statusDetail = '已就绪';
    }
    return ok;
  }

  async stop() {
    if (this.bridge) {
      this.bridge.destroy();
    }
    this.setStatus('disconnected', '已断开');
  }

  async send(text, contextPayload) {
    if (!this.bridge) {
      return { success: false, error: 'PiBridge 未就绪' };
    }
    this.isStreaming = true;
    return await this.bridge.sendMessage(text, contextPayload);
  }

  /**
   * 斜杠命令数据源：透传 Pi get_commands RPC（扩展命令 / 提示模板 / 技能）。
   * 进程未启动时按需拉起，与 send() 的隐式启动语义保持一致。
   */
  async getSlashCommands() {
    try {
      if (!this.bridge) {
        const ok = await this.start();
        if (!ok || !this.bridge) return [];
      }
      return await this.bridge.getCommands();
    } catch (e) {
      return [];
    }
  }

  async abort() {
    if (this.bridge) {
      await this.bridge.abort();
    }
    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  /**
   * 流式中插队纠偏（pi 原生）：当前工具结束后、下一次 LLM 调用前注入用户消息。
   */
  async steer(text) {
    if (!this.bridge || typeof this.bridge.steer !== 'function') {
      throw new Error('当前通道不支持插队纠偏');
    }
    return await this.bridge.steer(text);
  }

  /**
   * 流式中排队待办（pi 原生队列）：本轮结束后自动以新回合消费。
   */
  async followUp(text) {
    if (!this.bridge || typeof this.bridge.followUp !== 'function') {
      throw new Error('当前通道不支持排队待办');
    }
    return await this.bridge.followUp(text);
  }

  /**
   * 移除单个排队项（pi 侧为 清空+按序重投 实现）。
   */
  async removeQueuedMessage(kind, text) {
    if (!this.bridge || typeof this.bridge.removeQueuedMessage !== 'function') return;
    return await this.bridge.removeQueuedMessage(kind, text);
  }

  async getForkMessages() {
    if (!this.bridge || typeof this.bridge.getForkMessages !== 'function') return [];
    return this.bridge.getForkMessages();
  }

  async forkMessage(entryId) {
    if (!this.bridge || typeof this.bridge.forkMessage !== 'function') {
      throw new Error('当前通道不支持会话回退');
    }
    return this.bridge.forkMessage(entryId);
  }

  async newSession() {
    if (this.bridge) {
      await this.bridge.newSession();
    }
    this.isStreaming = false;
    this.setStatus('connected', '已重置会话');
  }

  async setPermissionMode(mode) {
    await super.setPermissionMode(mode);
    if (this.bridge && typeof this.bridge.setPermissionMode === 'function') {
      await this.bridge.setPermissionMode(mode);
    }
  }

  destroy() {
    if (this.bridge) {
      this.bridge.destroy();
    }
    super.destroy();
  }
}

module.exports = { PiAdapter };
