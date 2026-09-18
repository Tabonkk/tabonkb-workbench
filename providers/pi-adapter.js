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

    const savedModel = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model')) || 'deepseek-v4-flash';
    const savedName = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model-name')) || 'DeepSeek V4 Flash (推荐)';
    this.activeModelId = savedModel;
    this.activeModelName = savedName;

    if (this.bridge) {
      this.setupBridgeEvents();
    }
  }

  getModelGroups() {
    return [
      {
        group: 'DeepSeek 极速直连 (推荐)',
        icon: '⚡',
        iconPark: 'lightning',
        brand: 'deepseek',
        isTop: true,
        models: [
          { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (推荐)', desc: '官方极速直连 · 毫秒响应 · 稳定无排队', icon: '⚡', iconPark: 'lightning', brand: 'deepseek' },
          { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: '官方深度推理 · 超长上下文', icon: '💎', iconPark: 'diamond', brand: 'deepseek' }
        ]
      },
      {
        group: 'OpenAI / Jojom 通道',
        icon: '🪐',
        iconPark: 'planet',
        brand: 'openai',
        models: [
          { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', desc: 'Jojom 通道 (若上游限流可随时切回 DeepSeek)', icon: '🪐', iconPark: 'planet', brand: 'openai' }
        ]
      }
    ];
  }

  async setModel(modelId, modelName) {
    this.activeModelId = modelId;
    this.activeModelName = modelName || (modelId === 'gpt-5.6-sol' ? 'GPT-5.6 Sol' : (modelId === 'deepseek-v4-pro' ? 'DeepSeek V4 Pro' : 'DeepSeek V4 Flash (推荐)'));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-active-model', this.activeModelId);
      localStorage.setItem('tabonkb-pi-active-model-name', this.activeModelName);
    }
    let provider = 'cc-switch-deep-seek';
    if (modelId === 'gpt-5.6-sol') {
      provider = 'jojom';
    }
    if (this.bridge && typeof this.bridge.setModel === 'function') {
      await this.bridge.setModel(provider, modelId);
    }
  }

  setBridge(bridge) {
    this.bridge = bridge;
    this.setupBridgeEvents();
  }

  setupBridgeEvents() {
    if (!this.bridge) return;

    // Forward bridge status
    this.bridge.on('status_change', (data) => {
      this.status = data.status;
      this.statusDetail = data.detail;
      this.emit('status_change', data);
    });

    this.bridge.on('permission_change', (mode) => {
      this.permissionMode = mode;
      this.emit('permission_change', mode);
    });

    // Forward conversational events
    this.bridge.on('turn_start', (d) => this.emit('turn_start', d));
    this.bridge.on('text_delta', (d) => this.emit('text_delta', d));
    this.bridge.on('tool_start', (d) => this.emit('tool_start', d));
    this.bridge.on('tool_end', (d) => this.emit('tool_end', d));
    this.bridge.on('turn_end', (d) => this.emit('turn_end', d));
    this.bridge.on('agent_settled', (d) => {
      this.isStreaming = false;
      this.emit('agent_settled', d);
    });
    this.bridge.on('error', (d) => this.emit('error', d));
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

  async abort() {
    if (this.bridge) {
      await this.bridge.abort();
    }
    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
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
