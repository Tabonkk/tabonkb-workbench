/**
 * AgentAdapter: Standardized Abstract Base Class for Agent Hub Providers (Pi, Codex, Gemini).
 * Defines common event emitter interface, status lifecycles, and contract methods.
 */
const { getIconPark, getOfficialModelSvg } = require('../ui/iconpark.js');

class AgentAdapter {
  constructor(options = {}) {
    this.id = options.id || 'base';
    this.name = options.name || this.id;
    this.displayName = options.displayName || 'Agent';
    this.icon = options.icon || getIconPark('robot', 16);
    this.vaultBasePath = options.vaultBasePath || '';
    this.permissionMode = options.permissionMode || 'readwrite';
    this.status = 'disconnected'; // disconnected | connecting | connected | thinking | running_tool | error | not_installed
    this.statusDetail = '';
    this.listeners = new Map();
    this.isStreaming = false;
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
          console.error(`[${this.displayName}Adapter] Error in event '${event}':`, e);
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
    if (mode !== 'readonly' && mode !== 'readwrite' && mode !== 'full') return;
    if (this.permissionMode === mode) return;
    this.permissionMode = mode;
    this.emit('permission_change', mode);
  }

  getModel() {
    return {
      id: this.activeModelId || 'default',
      name: this.activeModelName || '默认模型'
    };
  }

  setModel(modelId, displayName) {
    this.activeModelId = modelId;
    this.activeModelName = displayName || modelId;
    this.emit('model_change', { modelId, displayName });
  }

  getModelGroups() {
    return [];
  }

  /**
   * Detect whether this CLI/Engine is installed and operational on this machine.
   * @returns {Promise<{ available: boolean, version?: string, path?: string, error?: string }>}
   */
  async detect() {
    return { available: true };
  }

  /**
   * Start or verify the engine
   * @returns {Promise<boolean>}
   */
  async start() {
    return true;
  }

  /**
   * Stop or kill current running process
   */
  async stop() {
    this.setStatus('disconnected', '已停止');
  }

  /**
   * Send a user message with structured context
   * @param {string} text - Raw prompt or formatted text
   * @param {object} contextPayload - Snapshot from AgentContextProvider
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async send(text, contextPayload) {
    throw new Error('Method send() must be implemented by subclass');
  }

  /**
   * Abort the current ongoing generation/tool execution
   */
  async abort() {
    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  /**
   * Start a clean conversation session
   */
  async newSession() {
    this.isStreaming = false;
    this.setStatus('connected', '已重置会话');
  }

  /**
   * Clean up all handles on plugin unload
   */
  destroy() {
    this.stop().catch(() => {});
    this.listeners.clear();
  }
}

/**
 * Returns official brand vector SVG icon for Pi, Codex, Gemini, Claude, Grok, etc.
 * @param {string} agentId - 'pi' | 'codex' | 'gemini' | 'claude' | 'grok' | 'niceaigc'
 * @param {number} size - icon width and height in pixels (default: 16)
 * @returns {string} SVG HTML string
 */
function getAgentBrandSvg(agentId, size = 16) {
  return getOfficialModelSvg(agentId, size);
}

module.exports = { AgentAdapter, getAgentBrandSvg };
