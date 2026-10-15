const { AgentSessionManager } = require('./agent-session-manager.js');
const { getAgentBrandSvg } = require('./providers/agent-adapter-base.js');
const { PiAdapter } = require('./providers/pi-adapter.js');
const { NiceAigcAdapter } = require('./providers/niceaigc-adapter.js');
const { DshAdapter } = require('./providers/dsh-adapter.js');
const { AntigravityAdapter } = require('./providers/antigravity-adapter.js');

/**
 * AgentHub: Core router and orchestrator for Multi-Agent execution in TabonKB.
 * Coordinates Pi Agent, NiceAIGC, and Antigravity with shared context and isolated sessions.
 */
class AgentHub {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || '';
    this.permissionMode = options.permissionMode || this.getSavedPermissionMode();
    this.sessionManager = new AgentSessionManager({
      vaultBasePath: this.vaultBasePath,
      app: options.app
    });
    this.adapters = new Map();
    this.listeners = new Map();
    this.generation = 0;

    this.initAdapters(options);
    this.activeAgentId = this.getSavedActiveAgent();
    this.saveActiveAgent(this.activeAgentId);

    this.bindActiveAdapterEvents();
  }

  getSavedPermissionMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-agent-permission-mode');
        if (saved === 'readonly' || saved === 'readwrite') return saved;
      }
    } catch (e) {}
    return 'readwrite';
  }

  getSavedActiveAgent() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-active-agent-id');
        if (saved && (saved === 'pi' || saved === 'niceaigc' || saved === 'antigravity')) {
          return saved;
        }
      }
    } catch (e) {}

    // Fallback to SessionManager persisted lastActiveAgentId
    if (this.sessionManager && typeof this.sessionManager.getLastActiveAgentId === 'function') {
      try {
        const fromSession = this.sessionManager.getLastActiveAgentId();
        if (fromSession && (fromSession === 'pi' || fromSession === 'niceaigc' || fromSession === 'antigravity')) {
          return fromSession;
        }
      } catch (e) {}
    }

    return 'antigravity';
  }

  saveActiveAgent(id) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-active-agent-id', id);
      }
    } catch (e) {}
    if (this.sessionManager && typeof this.sessionManager.setLastActiveAgentId === 'function') {
      this.sessionManager.setLastActiveAgentId(id);
    }
  }

  initAdapters(options = {}) {
    const opts = {
      vaultBasePath: this.vaultBasePath,
      permissionMode: this.permissionMode
    };

    // 1. Pi Adapter
    const pi = new PiAdapter(Object.assign({}, opts, { bridge: options.bridge }));
    this.adapters.set('pi', pi);

    // 2. NiceAIGC Adapter (Web/API)
    const niceaigc = new NiceAigcAdapter(Object.assign({}, opts, {
      app: options.app,
      getConfig: options.getNiceaigcConfig,
      sessionManager: this.sessionManager,
      secretStorage: options.secretStorage
    }));
    this.adapters.set('niceaigc', niceaigc);

    // 3. Antigravity CLI Adapter
    const antigravity = new AntigravityAdapter(Object.assign({}, opts, {
      app: options.app,
      sessionManager: this.sessionManager
    }));
    this.adapters.set('antigravity', antigravity);

    // 4. DSH Adapter (DeepSeek Harness Headless Mode - 保留供底层与测试调用)
    const dsh = new DshAdapter(Object.assign({}, opts, {
      plugin: options.plugin || (options.app?.plugins?.getPlugin ? options.app.plugins.getPlugin('tabonkb-workbench') : null),
      app: options.app,
      vaultBasePath: this.vaultBasePath,
      sessionManager: this.sessionManager
    }));
    this.adapters.set('dsh', dsh);
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
          console.error(`[AgentHub] Error in event '${event}':`, e);
        }
      }
    }
  }

  bindActiveAdapterEvents() {
    // Forward adapter events only when activeAgentId matches and attach generation metadata
    for (const [id, adapter] of this.adapters.entries()) {
      const isCurrentActive = () => this.activeAgentId === id;

      adapter.on('status_change', (data) => {
        if (isCurrentActive()) this.emit('status_change', data);
      });
      adapter.on('turn_start', (d) => {
        if (isCurrentActive()) {
          const payload = (d && typeof d === 'object') ? Object.assign({ generation: this.generation, agentId: id }, d) : d;
          this.emit('turn_start', payload);
        }
      });
      adapter.on('thinking_start', (d) => {
        if (isCurrentActive()) this.emit('thinking_start', d);
      });
      adapter.on('thinking_delta', (d) => {
        if (isCurrentActive()) this.emit('thinking_delta', d);
      });
      adapter.on('thinking_end', (d) => {
        if (isCurrentActive()) this.emit('thinking_end', d);
      });
      adapter.on('text_delta', (d) => {
        if (isCurrentActive()) this.emit('text_delta', d);
      });
      adapter.on('tool_start', (d) => {
        if (isCurrentActive()) this.emit('tool_start', d);
      });
      adapter.on('tool_end', (d) => {
        if (isCurrentActive()) this.emit('tool_end', d);
      });
      adapter.on('turn_end', (d) => {
        if (isCurrentActive()) {
          const payload = (d && typeof d === 'object') ? Object.assign({ generation: this.generation, agentId: id }, d) : d;
          this.emit('turn_end', payload);
        }
      });
      adapter.on('agent_settled', (d) => {
        if (isCurrentActive()) {
          const payload = (d && typeof d === 'object') ? Object.assign({ generation: this.generation, agentId: id }, d) : d;
          this.emit('agent_settled', payload);
        }
      });
      adapter.on('error', (d) => {
        if (isCurrentActive()) this.emit('error', d);
      });
    }
  }

  getActiveAgentId() {
    return this.activeAgentId;
  }

  getActiveAdapter() {
    return this.adapters.get(this.activeAgentId) || this.adapters.get('pi');
  }

  getAdapter(id) {
    return this.adapters.get(id);
  }

  getAllAdapters() {
    return Array.from(this.adapters.values());
  }

  getAgentList() {
    return [
      { id: 'pi', name: 'Pi', displayName: 'Pi Agent', icon: getAgentBrandSvg('pi', 16), desc: '本地轻量快速检索与笔记维护 (RPC)' },
      { id: 'antigravity', name: 'Antigravity', displayName: 'Antigravity CLI', icon: getAgentBrandSvg('antigravity', 16), desc: 'Google 深度代理引擎与多工具调用 (CLI)' },
      { id: 'niceaigc', name: 'NiceAIGC', displayName: 'NiceAIGC', icon: getAgentBrandSvg('niceaigc', 16), desc: 'NiceAIGC 智能大模型多模态对话 (GPT/Claude)' }
    ];
  }

  isStreaming() {
    const adapter = this.getActiveAdapter();
    return !!(adapter && adapter.isStreaming);
  }

  async start() {
    return await this.getActiveAdapter().start();
  }

  async detectAll() {
    const results = {};
    for (const [id, adapter] of this.adapters.entries()) {
      results[id] = await adapter.detect();
    }
    return results;
  }

  async switchAgent(agentId) {
    if (!this.adapters.has(agentId)) {
      console.warn(`[AgentHub] Unknown agentId '${agentId}', fallback to 'antigravity'`);
      agentId = 'antigravity';
    }

    if (this.activeAgentId === agentId) return;

    const prevAgentId = this.activeAgentId;
    const prevAdapter = this.getActiveAdapter();

    // Increment generation to invalidate pending responses and stale turns
    this.generation = (this.generation || 0) + 1;
    const currentGeneration = this.generation;

    // Explicitly abort previous adapter before switching
    if (prevAdapter) {
      try {
        if (typeof prevAdapter.abort === 'function') {
          await prevAdapter.abort();
        }
      } catch (err) {
        console.warn(`[AgentHub] Failed to abort previous adapter '${prevAgentId}':`, err);
      }
    }

    this.activeAgentId = agentId;
    this.saveActiveAgent(agentId);

    const adapter = this.getActiveAdapter();
    // Auto-detect and auto-start if disconnected
    if (adapter.status === 'disconnected') {
      adapter.detect().then((det) => {
        if (det && det.available && typeof adapter.start === 'function') {
          return adapter.start();
        }
      }).then(() => {
        if (this.activeAgentId === agentId && this.generation === currentGeneration) {
          this.emit('status_change', adapter.getStatus());
        }
      }).catch((e) => {
        console.warn(`[AgentHub] Auto-start for '${agentId}' failed:`, e);
      });
    }

    let sessionData = null;
    try {
      if (typeof this.sessionManager.getActiveSession === 'function') {
        sessionData = this.sessionManager.getActiveSession(agentId);
      } else if (typeof this.sessionManager.getSession === 'function') {
        sessionData = this.sessionManager.getSession(agentId);
      }
    } catch (e) {}

    this.emit('agent_switched', {
      prevAgentId,
      newAgentId: agentId,
      adapter,
      session: sessionData,
      generation: currentGeneration
    });

    // Notify new status
    this.emit('status_change', adapter.getStatus());
  }

  getStatus() {
    return this.getActiveAdapter().getStatus();
  }

  getPermissionMode() {
    return this.permissionMode;
  }

  async setPermissionMode(mode) {
    this.permissionMode = mode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-agent-permission-mode', mode);
      }
    } catch (e) {}

    for (const adapter of this.adapters.values()) {
      await adapter.setPermissionMode(mode);
    }
    this.emit('permission_change', mode);
  }

  async send(text, contextPayload, attachments = []) {
    return await this.getActiveAdapter().send(text, contextPayload, attachments);
  }

  /**
   * 当前 Agent 可调用的斜杠命令清单（扩展命令 / 提示模板 / 技能）。
   * 适配器不支持时返回空数组。
   */
  async getSlashCommands() {
    const adapter = this.getActiveAdapter();
    if (adapter && typeof adapter.getSlashCommands === 'function') {
      try {
        const list = await adapter.getSlashCommands();
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  async abort() {
    return await this.getActiveAdapter().abort();
  }

  async newSession() {
    this.sessionManager.clearSession(this.activeAgentId);
    return await this.getActiveAdapter().newSession();
  }

  // 会话回退（fork）：仅当前适配器支持时可用（pi）；工作台消息截断由调用方负责
  async getForkMessages() {
    const adapter = this.getActiveAdapter();
    if (adapter && typeof adapter.getForkMessages === 'function') {
      return await adapter.getForkMessages();
    }
    return [];
  }

  async forkMessage(entryId) {
    const adapter = this.getActiveAdapter();
    if (adapter && typeof adapter.forkMessage === 'function') {
      return await adapter.forkMessage(entryId);
    }
    throw new Error('当前 Agent 不支持会话回退');
  }

  supportsFork() {
    const adapter = this.getActiveAdapter();
    return !!(adapter && typeof adapter.forkMessage === 'function');
  }

  // invalid_encrypted_content 自愈：仅 pi 适配器实现（剥离会话签名 + --session 恢复）
  async repairEncryptedContentSession() {
    const adapter = this.getActiveAdapter();
    if (adapter && typeof adapter.repairEncryptedContentSession === 'function') {
      return await adapter.repairEncryptedContentSession();
    }
    return false;
  }

  destroy() {
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    this.listeners.clear();
  }
}

module.exports = { AgentHub };
