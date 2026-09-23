const { AgentSessionManager } = require('./agent-session-manager.js');
const { getAgentBrandSvg } = require('./providers/agent-adapter-base.js');
const { PiAdapter } = require('./providers/pi-adapter.js');
const { HermesAdapter } = require('./providers/hermes-adapter.js');
const { GeminiAdapter } = require('./providers/gemini-adapter.js');
const { NiceAigcAdapter } = require('./providers/niceaigc-adapter.js');

/**
 * AgentHub: Core router and orchestrator for Multi-Agent execution in TabonKB.
 * Coordinates Pi, Codex, Gemini, and NiceAIGC with shared context and isolated sessions.
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

    this.initAdapters(options);
    this.activeAgentId = this.getSavedActiveAgent();

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
        if (saved && (saved === 'pi' || saved === 'hermes' || saved === 'gemini' || saved === 'niceaigc')) {
          return saved;
        }
      }
    } catch (e) {}
    return 'pi';
  }

  saveActiveAgent(id) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-active-agent-id', id);
      }
    } catch (e) {}
  }

  initAdapters(options) {
    const opts = {
      vaultBasePath: this.vaultBasePath,
      permissionMode: this.permissionMode
    };

    // 1. Pi Adapter
    const pi = new PiAdapter(Object.assign({}, opts, { bridge: options.bridge }));
    this.adapters.set('pi', pi);

    // 2. Hermes Adapter
    const hermes = new HermesAdapter(opts);
    this.adapters.set('hermes', hermes);

    // 3. Gemini Adapter
    const gemini = new GeminiAdapter(opts);
    this.adapters.set('gemini', gemini);

    // 4. NiceAIGC Adapter (Web/API)
    const niceaigc = new NiceAigcAdapter(Object.assign({}, opts, {
      app: options.app,
      getConfig: options.getNiceaigcConfig,
      // 会话级持久化 conversationId, 历史会话续接不丢上下文
      sessionManager: this.sessionManager
    }));
    this.adapters.set('niceaigc', niceaigc);
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
      this.listeners.get(event).delete(fn);
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
    // Unbind previous adapter listeners if any
    for (const [id, adapter] of this.adapters.entries()) {
      adapter.on('status_change', (data) => {
        if (this.activeAgentId === id) this.emit('status_change', data);
      });
      adapter.on('turn_start', (d) => {
        if (this.activeAgentId === id) this.emit('turn_start', d);
      });
      adapter.on('text_delta', (d) => {
        if (this.activeAgentId === id) this.emit('text_delta', d);
      });
      adapter.on('tool_start', (d) => {
        if (this.activeAgentId === id) this.emit('tool_start', d);
      });
      adapter.on('tool_end', (d) => {
        if (this.activeAgentId === id) this.emit('tool_end', d);
      });
      adapter.on('turn_end', (d) => {
        if (this.activeAgentId === id) this.emit('turn_end', d);
      });
      adapter.on('agent_settled', (d) => {
        if (this.activeAgentId === id) this.emit('agent_settled', d);
      });
      adapter.on('error', (d) => {
        if (this.activeAgentId === id) this.emit('error', d);
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
      { id: 'hermes', name: 'Hermes', displayName: 'Hermes CLI', icon: getAgentBrandSvg('hermes', 16), desc: '本地 Hermes 全工具智能体 · 代码/研究/浏览 (Exec)' },
      { id: 'gemini', name: 'Gemini', displayName: 'Gemini CLI', icon: getAgentBrandSvg('gemini', 16), desc: 'Google Gemini 知识融合与综合分析 (Headless)' },
      { id: 'niceaigc', name: 'NiceAIGC', displayName: 'NiceAIGC', icon: getAgentBrandSvg('niceaigc', 16), desc: 'NiceAIGC 智能大模型多模态对话 (Web/API)' }
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
      console.warn(`[AgentHub] Unknown agentId '${agentId}', fallback to 'pi'`);
      agentId = 'pi';
    }

    if (this.activeAgentId === agentId) return;

    const prevAgentId = this.activeAgentId;
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
        if (this.activeAgentId === agentId) {
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
      session: sessionData
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

  async abort() {
    return await this.getActiveAdapter().abort();
  }

  async newSession() {
    this.sessionManager.clearSession(this.activeAgentId);
    return await this.getActiveAdapter().newSession();
  }

  destroy() {
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    this.listeners.clear();
  }
}

module.exports = { AgentHub };
