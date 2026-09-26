const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const crypto = require('crypto');

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getImageDimensions(buffer) {
  try {
    if (buffer && buffer.length > 24) {
      // PNG: 8-byte signature, then IHDR chunk (length 4, type 4 'IHDR', width 4, height 4)
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
      }
      // JPEG: SOF0/SOF2 marker
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2;
        while (offset < buffer.length - 8) {
          if (buffer[offset] !== 0xFF) break;
          const marker = buffer[offset + 1];
          if (marker === 0xC0 || marker === 0xC2) {
            return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
          }
          const len = buffer.readUInt16BE(offset + 2);
          offset += 2 + len;
        }
      }
      // GIF: GIF87a or GIF89a
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
      }
    }
  } catch (e) {}
  return { width: 1024, height: 768 };
}

function normalizeModel(modelStr) {
  if (!modelStr) return 'gpt-5-6-thinking';
  const m = modelStr.trim();
  // Protect exact slugs from backend models
  if (m === 'gpt-5.6-sol-wm' || m === 'gpt-5.6-terra-wm' || m === 'gpt-5.6-luna-wm' || m === 'gpt-6-astra-wm' || m === 'gpt-5.5-wm') {
    return m;
  }
  const lower = m.toLowerCase();
  if (lower === 'chatgpt 5.6 sol' || lower === '5.6 sol' || lower === 'gpt-5.6 sol' || lower === 'gpt-5-6-thinking') {
    return 'gpt-5-6-thinking';
  }
  if (lower === 'auto' || lower === 'gpt-5-6') return 'gpt-5-6';
  if (lower.includes('5.5') && lower.includes('codex')) return 'gpt-5.5';
  if (lower.includes('5.4') && lower.includes('codex')) return 'gpt-5.4-codex';
  if (lower.includes('4o-mini') || lower === 'gpt-4o mini') return 'gpt-4o-mini';
  if (lower === 'gpt-4o') return 'gpt-5-6';
  return m;
}

/**
 * NiceAigcAdapter: Adapts NiceAIGC (https://node7.nice188.com/ / node8.nice188.com) to the unified AgentAdapter interface.
 * Supports both Web ChatGPT /backend-api/conversation (Session Cookie) and OpenAI /v1/chat/completions,
 * automatic protocol fallback, multi-turn conversation memory, and multi-modal image attachments.
 */
class NiceAigcAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'niceaigc',
      name: 'NiceAIGC',
      displayName: 'NiceAIGC',
      icon: getAgentBrandSvg('niceaigc', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.app = options.app || null;
    this.getConfig = options.getConfig || (() => ({
      baseUrl: 'https://node7.nice188.com',
      model: 'ChatGPT 5.6 Sol',
      secretName: 'tabonkb-niceaigc-token'
    }));

    const initialConfig = this.getConfig() || {};
    this.activeModelId = options.model || initialConfig.model || 'gpt-5-6-thinking';
    this.activeModelName = options.modelDisplayName || initialConfig.modelDisplayName || 'GPT-5.6 Sol';
    this.reasoningEffort = options.reasoningEffort || initialConfig.reasoningEffort || 'max';

    // In-memory conversation history & server conversation IDs
    this.conversationHistory = [];
    this.conversationId = null;
    this.lastMessageId = null;
    // 会话持久化: conversationId 随本地 session 对象存档, 打开历史会话可续接服务端上下文
    this.sessionManager = options.sessionManager || null;
    this._boundSessionId = undefined;
    this.activeRequest = null;
    this.abortController = null;
    this._memorySecret = null;
    this._cachedUserId = null;
  }

  getModel() {
    return {
      id: this.activeModelId || 'gpt-5-6-thinking',
      name: this.activeModelName || 'GPT-5.6 Sol',
      reasoningEffort: this.reasoningEffort || 'max'
    };
  }

  setModel(modelId, displayName, reasoningEffort) {
    if (this.activeModelId !== modelId) {
      this.conversationId = null;
      this.lastMessageId = null;
    }
    this.activeModelId = modelId;
    this.activeModelName = displayName || modelId;
    if (reasoningEffort) {
      this.reasoningEffort = reasoningEffort;
    }

    if (this.app) {
      try {
        const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        if (plugin && plugin.settings) {
          if (!plugin.settings.niceaigc) plugin.settings.niceaigc = {};
          plugin.settings.niceaigc.model = modelId;
          plugin.settings.niceaigc.modelDisplayName = displayName || modelId;
          plugin.settings.niceaigc.reasoningEffort = this.reasoningEffort;
          plugin.saveSettings();
        }
      } catch (e) {
        console.warn('[NiceAigcAdapter] Failed to persist model setting:', e);
      }
    }

    this.emit('model_change', { 
      modelId, 
      displayName: this.activeModelName, 
      reasoningEffort: this.reasoningEffort 
    });
  }

  setReasoningEffort(level) {
    this.reasoningEffort = level || 'max';
    if (this.app) {
      try {
        const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        if (plugin && plugin.settings) {
          if (!plugin.settings.niceaigc) plugin.settings.niceaigc = {};
          plugin.settings.niceaigc.reasoningEffort = this.reasoningEffort;
          plugin.saveSettings();
        }
      } catch (e) {}
    }
    this.emit('model_change', { 
      modelId: this.activeModelId, 
      displayName: this.activeModelName, 
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

  supportsReasoningEffort(modelId) {
    const id = (modelId || this.activeModelId || '').toLowerCase();
    return id.includes('thinking') || id.includes('sol') || id.includes('terra') || id.includes('luna') || id.startsWith('o1') || id.startsWith('o3');
  }

  getModelGroups() {
    return [
      {
        group: '常用模型',
        brand: 'openai',
        iconPark: 'star',
        isTop: true,
        models: [
          { 
            id: 'gpt-5-6-thinking', 
            name: 'GPT-5.6 Sol', 
            desc: '思考更充分，回答更优质，推荐使用！', 
            brand: 'openai',
            supportsReasoningEffort: true 
          },
          { 
            id: 'gpt-5-6', 
            name: 'Auto', 
            desc: '自动决定使用 5.6 Instant 或 5.6 Sol', 
            brand: 'openai',
            supportsReasoningEffort: false 
          }
        ]
      },
      {
        group: 'ChatGPT Work [原生] (需企业订阅)',
        brand: 'openai',
        iconPark: 'briefcase',
        models: [
          { id: 'gpt-5.6-sol-wm', name: 'GPT-5.6 Sol', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-5.6-terra-wm', name: 'GPT-5.6 Terra', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-5.6-luna-wm', name: 'GPT-5.6 Luna', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-5.5-wm', name: 'GPT-5.5', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-6-astra-wm', name: 'GPT-6 Astra', desc: '需开通 Work 企业订阅', brand: 'openai' }
        ]
      },
      {
        group: 'Google Gemini模型 (可用推荐)',
        brand: 'gemini',
        iconPark: 'diamond',
        models: [
          { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: '超长上下文，响应极速且稳定 (推荐)', brand: 'gemini' },
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', desc: '最新超高速生成', brand: 'gemini' },
          { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: '高速高准确度', brand: 'gemini' },
          { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', desc: '复杂逻辑深度推理', brand: 'gemini' },
          { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', desc: '极速响应', brand: 'gemini' }
        ]
      },
      {
        group: 'Anthropic Claude (上游通道不稳定)',
        brand: 'claude',
        iconPark: 'code',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Claude 4.6 Sonnet', desc: '极强代码编写（上游通道可能维护中）', brand: 'claude' },
          { id: 'claude-opus-4-6', name: 'Claude 4.6 Opus', desc: '高深推理（上游通道可能维护中）', brand: 'claude' },
          { id: 'claude-opus-4-7', name: 'Claude 4.7 Opus', desc: '深度理解（上游通道可能维护中）', brand: 'claude' },
          { id: 'claude-opus-4-8', name: 'Claude 4.8 Opus', desc: '超大上下文（上游通道可能维护中）', brand: 'claude' }
        ]
      },
      {
        group: 'xAI Grok (可用推荐)',
        brand: 'grok',
        iconPark: 'lightning',
        models: [
          { id: 'grok-4.6', name: 'Grok 4.6', desc: '最新实时知识搜索与代码 (推荐)', brand: 'grok' },
          { id: 'grok-4.5', name: 'Grok 4.5', desc: '高效搜索与代码 (推荐)', brand: 'grok' }
        ]
      },
      {
        group: 'OpenAI Codex系列',
        brand: 'openai',
        iconPark: 'code',
        models: [
          { id: 'gpt-5.5', name: 'GPT-5.5-Codex', desc: '代码研发与工程专精', brand: 'openai' },
          { id: 'gpt-5.4-codex', name: 'GPT-5.4-Codex', desc: '高效精准代码生成', brand: 'openai' }
        ]
      },
      {
        group: 'OpenAI 备用模型',
        brand: 'openai',
        iconPark: 'robot',
        models: [
          { id: 'gpt-5-chat-latest', name: 'GPT-5', desc: 'OpenAI 官方通用通道', brand: 'openai' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '轻量快速经济型', brand: 'openai' }
        ]
      },
      {
        group: '更多模型',
        brand: 'openai',
        iconPark: 'folder',
        models: [
          { id: 'gpt-5-5-thinking', name: 'GPT-5.5 Thinking', desc: '带思维链深度推演', brand: 'openai' },
          { id: 'gpt-5-5-instant', name: 'GPT-5.5 Instant', desc: '即时快速回复', brand: 'openai' },
          { id: 'research', name: 'Deep Research 深入研究', desc: '多轮自主深度学术调研', brand: 'openai' }
        ]
      },
      {
        group: 'image 生图模型',
        brand: 'gemini',
        iconPark: 'pic',
        models: [
          { id: 'gemini-3-pro-image-preview-2k', name: 'Nano Banana Pro 绘图', desc: '高分辨率 2K 生成', brand: 'gemini' },
          { id: 'nano-banana-2', name: 'Nano Banana 2.0 绘图', desc: '超快生图', brand: 'gemini' },
          { id: 'gpt-image-2-1', name: 'GPT Image 2.5（通道 1）', desc: '高质量图像绘制', brand: 'openai' },
          { id: 'gpt-image-2-2', name: 'GPT Image 2.5（通道 2）', desc: '备用通道生图', brand: 'openai' }
        ]
      },
      {
        group: 'NiceScience 学术',
        brand: 'science',
        iconPark: 'degree-hat',
        models: [
          { id: 'NiceArticleNoAI-Pro', name: 'NiceArticleNoAI-Pro', desc: 'Nature/Science期刊专用降AI识别率增强版', brand: 'science' },
          { id: 'NiceArticleNoAI', name: 'NiceArticleNoAI', desc: '标准版降低文章 AI 识别率', brand: 'science' }
        ]
      }
    ];
  }

  /**
   * Safely retrieve token from Obsidian SecretStorage or memory fallback.
   * Credentials NEVER enter logs, data.json, or markdown.
   * @param {string} [secretKey]
   * @returns {Promise<string | null>}
   */
  async getCredential(secretKey = 'tabonkb-niceaigc-token') {
    // 1. Try plugin getSecret
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.getSecret === 'function') {
        const s = await plugin.getSecret(secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 2. Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 3. Try local plugin .secrets.json
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.vaultBasePath || this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretKey]) return data[secretKey];
        }
      }
    } catch (e) {}

    // 4. Try Obsidian SecretStorage (if supported)
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.getSecret === 'function') {
        const secret = await this.app.secretStorage.getSecret(secretKey);
        if (secret) return secret;
      }
    } catch (e) {}

    return this._memorySecret || null;
  }

  async setCredential(secretKey = 'tabonkb-niceaigc-token', token) {
    this._memorySecret = token;

    // 1. Save to plugin
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.setSecret === 'function') {
        await plugin.setSecret(secretKey, token);
      }
    } catch (e) {}

    // 2. Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) localStorage.setItem('tabonkb-secret-' + secretKey, token);
        else localStorage.removeItem('tabonkb-secret-' + secretKey);
      }
    } catch (e) {}

    // 3. Save to local .secrets.json
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.vaultBasePath || this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secFile)) {
          try { data = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretKey] = token;
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}

    // 4. Save to Obsidian SecretStorage
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.setSecret === 'function') {
        await this.app.secretStorage.setSecret(secretKey, token);
      }
    } catch (e) {}
  }

  /**
   * Detect whether NiceAIGC is configured and reachable.
   * @returns {Promise<{ available: boolean, error?: string }>}
   */
  async detect() {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    const token = await this.getCredential(config.secretName || 'tabonkb-niceaigc-token');
    
    if (!token) {
      this.setStatus('disconnected', '未配置登录凭据/Token');
      return { available: false, error: '未在设置中配置 NiceAIGC 会话 Token' };
    }

    this.setStatus('connected', '已就绪 (Web/API)');
    return { available: true };
  }

  /**
   * Start adapter
   * @returns {Promise<boolean>}
   */
  async start() {
    const res = await this.detect();
    if (res.available) {
      this.setStatus('connected', '已就绪');
      return true;
    }
    return false;
  }

  /**
   * Stop any ongoing streaming
   */
  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  /**
   * 发送前惰性检测本地会话是否切换 (历史面板打开/新建/重启插件):
   * 切换到另一会话时, 改用该会话存档的 conversationId, 避免服务端新开对话丢失上下文
   */
  _syncSessionConversation() {
    if (!this.sessionManager) return;
    try {
      const sid = this.sessionManager.getActiveSessionId ? this.sessionManager.getActiveSessionId('niceaigc') : null;
      const current = this._boundSessionId === undefined ? null : this._boundSessionId;
      if (sid === current) return;
      let saved = { conversationId: null, lastMessageId: null };
      if (sid && this.sessionManager.getSessionConversation) {
        saved = this.sessionManager.getSessionConversation('niceaigc') || saved;
      }
      this.conversationId = saved.conversationId || null;
      // 关键: backend-api 消息树协议续聊时 parent_message_id 必须指向该对话的叶子消息,
      // 若只恢复 conversationId 而 lastMessageId 为空, 发送时 parentId 会随机生成 → 服务端找不到父节点返回空流
      this.lastMessageId = saved.lastMessageId || null;
      // 同步重建内存对话历史: 切换/恢复会话后 v1 协议与上下文摘要才有内容可用
      try {
        if (this.sessionManager.getMessages) {
          const msgs = this.sessionManager.getMessages('niceaigc') || [];
          this.conversationHistory = msgs.slice(-20)
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.text || '') }));
        }
      } catch (e) {}
      this._boundSessionId = sid;
    } catch (e) {}
  }

  _persistConversationId() {
    if (!this.sessionManager || !this.conversationId || !this.sessionManager.setSessionConversation) return;
    try {
      this.sessionManager.setSessionConversation('niceaigc', this.conversationId, this.lastMessageId || null);
    } catch (e) {}
  }

  // GET 小工具: 拉取 JSON (对话树查询用)
  _httpGetJson(url, headers) {
    return new Promise((resolve, reject) => {
      const https = url.startsWith('https') ? require('https') : require('http');
      const urlObj = new URL(url);
      const req = https.request(urlObj, {
        method: 'GET',
        headers,
        timeout: 15000
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.end();
    });
  }

  // POST 小工具: 提交 JSON (文件上传申请/确认用)
  _httpPostJson(url, headers, data) {
    return new Promise((resolve, reject) => {
      const https = url.startsWith('https') ? require('https') : require('http');
      const urlObj = new URL(url);
      const postData = typeof data === 'string' ? data : JSON.stringify(data || {});
      const reqHeaders = Object.assign({}, headers, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      });
      const req = https.request(urlObj, {
        method: 'POST',
        headers: reqHeaders,
        timeout: 20000
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 150)}`));
            return;
          }
          try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.write(postData);
      req.end();
    });
  }

  // PUT 小工具: 提交二进制流 (文件上传预签名桶用)
  _httpPutBinary(url, headers, buffer) {
    return new Promise((resolve, reject) => {
      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (e) {
        reject(new Error(`Invalid upload URL: ${url}`));
        return;
      }
      const https = urlObj.protocol === 'https:' ? require('https') : require('http');
      const reqHeaders = Object.assign({}, headers, {
        'Content-Length': buffer.length
      });
      delete reqHeaders['host'];
      delete reqHeaders['Host'];

      const req = https.request(urlObj, {
        method: 'PUT',
        headers: reqHeaders,
        timeout: 60000
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 150)}`));
            return;
          }
          resolve(raw);
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.write(buffer);
      req.end();
    });
  }

  // 多模态图片预上传: 上传至 ChatGPT Web /backend-api/files 并取得合法附件结构
  async _uploadImageFile(baseUrl, headers, img) {
    if (!img) return null;
    let buffer = null;
    let format = 'png';
    let fileName = img.name || `image_${Date.now()}.png`;

    if (img.dataUrl) {
      const match = img.dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) return null;
      format = match[1].toLowerCase();
      const b64Data = match[2];
      buffer = Buffer.from(b64Data, 'base64');
      const ext = format === 'jpeg' ? 'jpg' : (format === 'svg+xml' ? 'svg' : format);
      if (!img.name) fileName = `image_${Date.now()}.${ext}`;
    } else if (img.path && typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        if (fs.existsSync(img.path)) {
          buffer = fs.readFileSync(img.path);
          const extMatch = img.path.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) {
            format = extMatch[1].toLowerCase();
            if (format === 'jpg') format = 'jpeg';
          }
        }
      } catch (e) {}
    }
    if (!buffer) return null;
    const dimensions = getImageDimensions(buffer);

    // 1. 请求上传预凭据
    const createUrl = `${baseUrl}/backend-api/files`;
    const createRes = await this._httpPostJson(createUrl, headers, {
      file_name: fileName,
      file_size: buffer.length,
      use_case: 'multimodal'
    });

    if (!createRes || (!createRes.file_id && !createRes.id)) {
      throw new Error('No file_id returned from files endpoint');
    }

    const fileId = createRes.file_id || createRes.id;
    let uploadUrl = createRes.upload_url;

    // 2. 若存在预签名存储桶地址，PUT 上传二进制数据
    if (uploadUrl) {
      if (uploadUrl.startsWith('/')) {
        uploadUrl = `${baseUrl}${uploadUrl}`;
      }
      const isInternalUpload = uploadUrl.startsWith(baseUrl);
      const uploadHeaders = Object.assign(
        {},
        isInternalUpload ? headers : {},
        {
          'Content-Type': `image/${format}`,
          'x-ms-blob-type': 'BlockBlob'
        }
      );
      await this._httpPutBinary(uploadUrl, uploadHeaders, buffer);

      // 3. 标记上传完成
      try {
        await this._httpPostJson(`${baseUrl}/backend-api/files/${fileId}/uploaded`, headers, {});
      } catch (e) {}
    }

    return {
      id: fileId,
      name: fileName,
      size: buffer.length,
      mime_type: `image/${format}`,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  // 从对话树取叶子节点 id: 叶子 = children 为空的节点; 优先取 assistant 消息节点 (续聊 parent_message_id 必需)
  _pickLeafNodeId(mapping) {
    try {
      const ids = Object.keys(mapping);
      if (!ids.length) return null;
      const leaves = ids.filter(id => {
        const node = mapping[id];
        return !node || !Array.isArray(node.children) || node.children.length === 0;
      });
      const pool = leaves.length ? leaves : ids;
      const isTombstone = id => !id || id === 'null' || id.startsWith('msg_tombstone');
      const assistantLeaf = pool.find(id => {
        const node = mapping[id];
        return node && node.message && node.message.author && node.message.author.role === 'assistant' && !isTombstone(id);
      });
      const picked = assistantLeaf || pool.find(id => !isTombstone(id)) || pool[pool.length - 1];
      return picked || null;
    } catch (e) { return null; }
  }

  // 兼容旧存档: 只有 conversationId 而无叶子消息 id 时, 向服务端查对话树补齐 current_node,
  // 避免续聊时 parent_message_id 随机生成导致服务端返回空流
  async _ensureLeafMessageId(baseUrl, headers) {
    if (!this.conversationId) return;
    try {
      const data = await this._httpGetJson(`${baseUrl}/backend-api/conversation/${this.conversationId}`, headers);
      const conv = (data && data.data) ? data.data : data;
      let leaf = conv && (conv.current_node || conv.current_node_id) || null;
      if (!leaf && conv && conv.mapping && typeof conv.mapping === 'object') {
        leaf = this._pickLeafNodeId(conv.mapping);
      }
      if (leaf) {
        this.lastMessageId = leaf;
        this._persistConversationId();
        console.info('[NiceAigcAdapter] Leaf message id recovered from server:', leaf);
      } else {
        console.warn('[NiceAigcAdapter] Could not resolve leaf node from conversation tree; continuation may start a new branch.');
      }
    } catch (e) {
      console.warn('[NiceAigcAdapter] Failed to recover leaf message id, will start fresh if server rejects:', e && e.message);
    }
  }

  // 调试日志: 追加写入插件目录 .niceaigc-debug.log, 用于定位服务端空流等疑难问题 (不含凭据)
  _debugLog(entry) {
    try {
      if (!this.sessionManager || !this.sessionManager._getStorageFile) return;
      const file = this.sessionManager._getStorageFile();
      if (!file) return;
      const fs = require('fs');
      const path = require('path');
      const logFile = path.join(path.dirname(file), '.niceaigc-debug.log');
      const line = JSON.stringify(Object.assign({ t: new Date().toISOString() }, entry)) + '\n';
      fs.appendFileSync(logFile, line, 'utf8');
      // 防止无限增长: 超过 512KB 截断保留后半
      const st = fs.statSync(logFile);
      if (st.size > 512 * 1024) {
        const buf = fs.readFileSync(logFile, 'utf8');
        fs.writeFileSync(logFile, buf.slice(Math.floor(buf.length / 2)), 'utf8');
      }
    } catch (e) {}
  }

  // 服务端续接失败兜底用: 把本地存档最近几轮对话压成摘要文本, 随新对话一起发给模型保住上下文
  _buildLocalContextDigest() {
    try {
      if (!this.sessionManager || !this.sessionManager.getMessages) return '';
      const msgs = this.sessionManager.getMessages('niceaigc') || [];
      const past = msgs.slice(-9, -1); // 去掉本轮刚入队的 user 消息
      if (!past.length) return '';
      // 错误/警告气泡也会被存成 assistant 消息, 带入摘要会污染上下文, 必须剔除
      const isNotice = (t) => /^\s*[⚠▲!！]/.test(t)
        || t.includes('未返回任何有效文本内容')
        || t.includes('建议点击左下角模型选择器')
        || /^\s*提示[：:]/.test(t)
        || t.includes('NiceAIGC 提示');
      const lines = past.map(m => {
        const who = m.role === 'user' ? '用户' : '助手';
        const body = String(m.text || '').replace(/\s+/g, ' ').trim();
        if (!body || (m.role !== 'user' && isNotice(body))) return '';
        return who + ': ' + (body.length > 700 ? body.slice(0, 700) + '…' : body);
      }).filter(l => l.length > 4);
      return lines.length ? '【历史对话摘要】\n' + lines.join('\n') : '';
    } catch (e) { return ''; }
  }

  /**
   * Reset conversation session
   */
  async newSession() {
    await this.abort();
    this.conversationHistory = [];
    this.conversationId = null;
    this.lastMessageId = null;
    this._boundSessionId = null;
    this.setStatus('connected', '已重置会话');
  }

  /**
   * Abort current streaming generation
   */
  async abort() {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (e) {}
      this.abortController = null;
    }
    if (this.activeRequest && typeof this.activeRequest.destroy === 'function') {
      try {
        this.activeRequest.destroy();
      } catch (e) {}
      this.activeRequest = null;
    }

    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('aborted');
    this.emit('agent_settled');
  }

  /**
   * Helper to fetch current user profile (/backend-api/me) to extract userId
   * @private
   */
  async _fetchMe(baseUrl, token, hostDomain) {
    const url = `${baseUrl}/backend-api/me`;
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node && typeof requestUrl === 'undefined';
    if (!isNode && typeof requestUrl !== 'undefined') {
      try {
        const res = await requestUrl({
          url,
          method: 'GET',
          headers: {
            'Cookie': `__Secure-next-auth.session-token=${token}`,
            'X-Site-Domain': hostDomain || '',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 TabonKB/1.0'
          }
        });
        return res.json;
      } catch (e) {
        return null;
      }
    } else {
      return new Promise(resolve => {
        try {
          const https = url.startsWith('https') ? require('https') : require('http');
          const req = https.get(url, {
            headers: {
              'Cookie': `__Secure-next-auth.session-token=${token}`,
              'X-Site-Domain': hostDomain || '',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 TabonKB/1.0'
            }
          }, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => {
              try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
            });
          });
          req.on('error', () => resolve(null));
        } catch (e) {
          resolve(null);
        }
      });
    }
  }

  /**
   * Send user prompt and stream back completion
   * @param {string} text - User prompt (may include context formatting)
   * @param {object} [contextPayload] - Snapshot from AgentContextProvider
   * @param {Array<any>} [attachments] - Attached documents or images
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async send(text, contextPayload, attachments = []) {
    // 先对齐当前本地会话存档的服务端 conversationId, 再做模型切换重置检测
    this._syncSessionConversation();
    this._contextFallbackUsed = false;
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    let baseUrl = (config.baseUrl || 'https://node7.nice188.com').trim().replace(/\/+$/, '');
    if (baseUrl.includes('nice188.cc')) {
      baseUrl = baseUrl.replace('nice188.cc', 'nice188.com');
    }
    const rawModel = this.activeModelId || config.model || 'gpt-5-6-thinking';
    const model = normalizeModel(rawModel);

    // If model changed compared to last used model, reset server conversation ID
    if (this.lastUsedModel && this.lastUsedModel !== model) {
      this.conversationId = null;
      this.lastMessageId = null;
    }
    this.lastUsedModel = model;

    const secretKey = config.secretName || 'tabonkb-niceaigc-token';
    let token = await this.getCredential(secretKey);

    if (!token) {
      const errMsg = '未配置 NiceAIGC 登录凭据，请在工作台设置中录入 Cookie / Token';
      this.emit('error', { message: errMsg });
      this.emit('agent_settled');
      return { success: false, error: errMsg };
    }

    token = token.trim();
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      token = token.slice(1, -1).trim();
    }

    this.isStreaming = true;
    this.setStatus('thinking', '正在生成...');
    this.emit('turn_start', { agentId: this.id });

    let hostDomain = '';
    try { hostDomain = new URL(baseUrl).hostname; } catch (e) {}

    // Format headers
    const isFullCookie = token.includes('=');
    let cookieHeader = '';
    let bearerHeader = token;
    let xuserid = '';
    let xtoken = '';
    let xyUuid = '';
    let sessionToken = '';

    if (isFullCookie) {
      cookieHeader = token;
      const mUid = token.match(/(?:^|;\s*)xuserid=([^;]+)/);
      if (mUid) xuserid = decodeURIComponent(mUid[1].trim());
      const mTok = token.match(/(?:^|;\s*)xtoken=([^;]+)/);
      if (mTok) xtoken = decodeURIComponent(mTok[1].trim());
      const mUuid = token.match(/(?:^|;\s*)xy_uuid_token=([^;]+)/);
      if (mUuid) xyUuid = decodeURIComponent(mUuid[1].trim());
      const mSess = token.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|sessionToken|token)=([^;]+)/);
      if (mSess) {
        sessionToken = decodeURIComponent(mSess[1].trim());
      } else {
        // Fallback default session token if user provided document.cookie without HttpOnly session-token
        sessionToken = '20zf9j0ykdgkw0dlbhlxxszdbwgztutf';
        cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; ${cookieHeader}`;
      }
      bearerHeader = sessionToken || xtoken || token;
    } else {
      sessionToken = token.trim();
      bearerHeader = sessionToken;
      cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; sessionToken=${sessionToken}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json, text/plain, */*',
      'Authorization': `Bearer ${bearerHeader.trim()}`,
      'Cookie': cookieHeader,
      'X-Auth-Token': bearerHeader.trim(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TabonKB-Workbench/1.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-Site-Domain': hostDomain
    };

    if (xuserid) headers['xuserid'] = xuserid;
    if (xtoken) headers['xtoken'] = xtoken;
    if (xyUuid) headers['xy_uuid_token'] = xyUuid;
    if (sessionToken) headers['Chatgpt-Account-Id'] = sessionToken;

    // Check for image attachments
    const imageAttachments = (attachments || []).filter(a => a && (a.dataUrl?.startsWith('data:image') || a.path?.match(/\.(png|jpg|jpeg|gif|webp)$/i)));
    let userContent = text;
    if (imageAttachments.length > 0) {
      userContent = [{ type: 'text', text }];
      for (const img of imageAttachments) {
        if (img.dataUrl) {
          userContent.push({
            type: 'image_url',
            image_url: { url: img.dataUrl }
          });
        }
      }
    }
    this.conversationHistory.push({ role: 'user', content: userContent });

    // Determine default protocol: node8.nice188.com returns 503 api_not_enabled on /v1/chat/completions,
    // so for nice188 or when configured, default to /backend-api/conversation (ChatGPT Web web-session protocol)
    const isNiceSite = baseUrl.includes('nice188') || baseUrl.includes('niceaigc');
    let useBackendApi = isNiceSite || config.protocol === 'backend-api';

    // 兼容旧存档: 续聊前补齐该对话叶子消息 id (backend-api 消息树协议必需)
    if ((isNiceSite || config.protocol === 'backend-api') && this.conversationId && !this.lastMessageId) {
      await this._ensureLeafMessageId(baseUrl, headers);
    }

    // 实际发送的提示词: 续接失败兜底重发时会被替换为 "本地摘要 + 新问题"
    let promptText = text;

    // 多模态图片预处理: 若计划走 Web 协议，先尝试通过 /backend-api/files 预上传
    let webAttachments = [];
    if (imageAttachments.length > 0 && useBackendApi) {
      try {
        for (const img of imageAttachments) {
          const attachment = await this._uploadImageFile(baseUrl, headers, img);
          if (attachment) webAttachments.push(attachment);
        }
      } catch (uploadErr) {
        console.warn('[NiceAigcAdapter] Web file upload failed:', uploadErr && uploadErr.message);
        if (isNiceSite) {
          // NiceAIGC 节点不开放 /v1 (503 api_not_enabled)，因此绝不能静默剥离图片退回纯文本发问
          throw new Error(`多模态图片上传失败: ${uploadErr.message || uploadErr}`);
        }
        useBackendApi = false; // 其它通用 OpenAI 代理尝试退避至 v1 Vision
      }
    }

    const executeRequest = async (asBackendApi) => {
      let apiUrl = '';
      let reqBody = '';

      if (asBackendApi) {
        apiUrl = `${baseUrl}/backend-api/conversation`;
        const messageId = generateUuid();
        const parentId = this.lastMessageId || generateUuid();
        this.lastMessageId = messageId;

        const messageObj = {
          id: messageId,
          author: { role: 'user' },
          content: {
            content_type: 'text',
            parts: [promptText]
          }
        };

        if (webAttachments.length > 0) {
          messageObj.metadata = {
            attachments: webAttachments.map(a => ({
              id: a.id,
              name: a.name,
              size: a.size,
              mime_type: a.mime_type,
              width: a.width,
              height: a.height
            }))
          };
        }

        const payload = {
          action: 'next',
          messages: [messageObj],
          model,
          parent_message_id: parentId,
          conversation_id: this.conversationId || undefined,
          timezone_offset_min: -480,
          history_and_training_disabled: false
        };

        if (this.supportsReasoningEffort(model)) {
          const effortConfig = this.getReasoningEffortConfig();
          payload.reasoning_effort = effortConfig.apiEffort;
          payload.thinking_effort = effortConfig.thinkingEffort;
        }

        reqBody = JSON.stringify(payload);
        this._debugLog({ type: 'request', proto: 'backend-api', conv: this.conversationId, parent: parentId, model, effort: payload.reasoning_effort || null, hasImages: imageAttachments.length > 0, attachmentCount: webAttachments.length });
      } else {
        apiUrl = baseUrl.endsWith('/chat/completions') 
          ? baseUrl 
          : (baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`);

        const historySlice = this.conversationHistory.slice(-20);
        const messages = [
          {
            role: 'system',
            content: 'You are NiceAIGC, a high-performance technical AI coding assistant integrated into the TabonKB engineering workbench. Provide clear, accurate, structured answers with clean Markdown and code snippets.'
          },
          ...historySlice
        ];

        const v1Payload = {
          model,
          messages,
          stream: true,
          temperature: 0.7
        };

        if (this.supportsReasoningEffort(model)) {
          const effortConfig = this.getReasoningEffortConfig();
          v1Payload.reasoning_effort = effortConfig.apiEffort;
        }

        reqBody = JSON.stringify(v1Payload);
      }

      let fullAssistantText = '';
      // In Obsidian desktop (Electron), Node.js http/https is available and MUST be used,
      // because browser window.fetch() silently strips the 'Cookie' header (W3C Forbidden Header spec).
      const canUseNode = typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions?.node;

      if (canUseNode) {
        await this._streamNode(apiUrl, headers, reqBody, (chunk) => {
          fullAssistantText += chunk;
          this.emit('text_delta', chunk);
        });
      } else {
        await this._streamFetch(apiUrl, headers, reqBody, (chunk) => {
          fullAssistantText += chunk;
          this.emit('text_delta', chunk);
        });
      }

      return fullAssistantText;
    };

    try {
      this.abortController = new AbortController();
      let fullAssistantText = '';

      try {
        fullAssistantText = await executeRequest(useBackendApi);
      } catch (firstErr) {
        // If server rejects cross-model conversation switching (HTTP 403 / new chat required), reset conversation and retry
        if (firstErr.code === 'MODEL_SWITCH_NEW_CHAT_REQUIRED' || firstErr.message?.includes('不支持切换') || firstErr.message?.includes('请创建新聊天')) {
          console.warn('[NiceAigcAdapter] Model family changed, auto-retrying with a fresh conversation session...');
          this.conversationId = null;
          this.lastMessageId = null;
          fullAssistantText = await executeRequest(useBackendApi);
        } else if (!isNiceSite && (firstErr.code === 'API_NOT_ENABLED' || firstErr.message?.includes('503') || firstErr.message?.includes('api_not_enabled') || (imageAttachments.length > 0 && (firstErr.message?.includes('422') || firstErr.message?.includes('404'))))) {
          // If first attempt failed with API_NOT_ENABLED or 503 or 422 with images on generic endpoint, try alternative protocol
          console.warn(`[NiceAigcAdapter] Primary protocol (${useBackendApi ? 'backend-api' : 'v1'}) unavailable, falling back to ${useBackendApi ? 'v1' : 'backend-api'}...`);
          fullAssistantText = await executeRequest(!useBackendApi);
        } else {
          throw firstErr;
        }
      }

      // 服务端续聊返回空流的自动兜底: 放弃服务端上下文, 开新对话并把本地存档摘要作为前缀重发一次
      if ((!fullAssistantText || !fullAssistantText.trim()) && this.conversationId && !this._contextFallbackUsed) {
        this._contextFallbackUsed = true;
        const digest = this._buildLocalContextDigest();
        if (digest) {
          console.warn('[NiceAigcAdapter] Continuation returned empty stream (conv=' + this.conversationId + ', parent=' + this.lastMessageId + '); retrying once as a fresh conversation with local context digest.');
          this._debugLog({ type: 'fallback_retry', conv: this.conversationId, parent: this.lastMessageId, digestLen: digest.length });
          this.setStatus('connected', '服务端续接异常，已携带本地上下文重发');
          this.conversationId = null;
          this.lastMessageId = null;
          promptText = digest + '\n\n--- 以上为本地历史对话摘要（服务端续接失败时的上下文兜底），请结合它回答下面的新问题 ---\n\n' + text;
          const lastUser = this.conversationHistory[this.conversationHistory.length - 1];
          if (lastUser && lastUser.role === 'user' && typeof lastUser.content === 'string') lastUser.content = promptText;
          try {
            fullAssistantText = await executeRequest(useBackendApi);
          } catch (retryErr) {
            console.warn('[NiceAigcAdapter] Context-digest retry failed:', retryErr && retryErr.message);
            fullAssistantText = '';
          }
        }
      }

      if (fullAssistantText && fullAssistantText.trim().length > 0) {
        fullAssistantText = cleanAssistantMarkdown(fullAssistantText);
        this.conversationHistory.push({ role: 'assistant', content: fullAssistantText });
        // 本轮流式结束, lastMessageId 已更新为最终 assistant 消息 id, 随会话落盘供下次续聊作 parent
        this._persistConversationId();
        this.isStreaming = false;
        this.setStatus('connected', '已就绪');
        this.emit('turn_end', { fullText: fullAssistantText });
        this.emit('agent_settled');
        return { success: true };
      } else {
        const activeName = this.activeModelName || model;
        console.warn('[NiceAigcAdapter] Empty text response. conv=' + this.conversationId + ' parent=' + this.lastMessageId + ' model=' + model + '\n--- raw SSE tail ---\n' + String(this._lastRawFrames || '(no frames received)').replace(/(xtoken|token|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-])/gi, '***'));
        this._debugLog({ type: 'empty_response', conv: this.conversationId, parent: this.lastMessageId, model, rawTail: String(this._lastRawFrames || '(no frames received)').slice(-1500) });
        const errMsg = `当前模型（${activeName}）未返回任何有效文本内容（上游通道可能处于维护或排队状态）。建议点击左下角模型选择器切换至「⭐ GPT-5.6 Sol」或「Google Gemini」重试。`;
        this.isStreaming = false;
        this.setStatus('connected', '已就绪');
        this.emit('error', { message: errMsg });
        this.emit('agent_settled');
        return { success: false, error: errMsg };
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: true };
      }

      this.isStreaming = false;
      this.setStatus('error', '生成异常');
      let sanitized = (err.message || '请求失败').replace(token, '***');
      if (sanitized.includes('缺少用户标识') || sanitized.includes('缺少xuserid') || sanitized.includes('缺少xtoken')) {
        sanitized = 'NiceAIGC 登录凭据缺少用户标识：当前凭据缺少 xuserid 与 xtoken。请在浏览器登录后按 F12 -> Console 执行 document.cookie，将包含 xuserid 和 xtoken 的完整 Cookie 复制并保存到工作台设置。';
      }
      this.emit('error', { message: sanitized });
      this.emit('agent_settled');
      return { success: false, error: sanitized };
    } finally {
      this.abortController = null;
      this.activeRequest = null;
    }
  }

  /**
   * Browser / Electron fetch SSE streaming
   * @private
   */
  async _streamFetch(url, headers, body, onChunk) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch (e) {}

      if (errText.includes('缺少用户标识')) {
        throw new Error('NiceAIGC 缺少用户标识：建议在浏览器登录后按 F12 复制完整 Cookie (含 xuserid 与 xtoken) 填入设置凭据');
      }
      if (errText.includes('套餐暂不支持') || errText.includes('升级订阅套餐')) {
        throw new Error('NiceAIGC 提示：当前账号套餐未开通此模型。建议在浏览器登录后复制包含 xtoken 的完整 Cookie 填入凭据，或在设置中更换模型');
      }
      if (errText.includes('白名单')) {
        throw new Error('NiceAIGC 提示：请求模型不在白名单内，请在设置中切换模型 (如: ChatGPT 5.6 Sol)');
      }
      if (response.status === 429) {
        throw new Error('NiceAIGC 提示请求过于频繁 (HTTP 429)，请稍候 3 秒重试');
      }
      if (response.status === 401) {
        throw new Error('NiceAIGC 登录凭据失效或过期 (HTTP 401: 登录态异常)，请在浏览器登录后复制最新的 Cookie / Token 并保存至设置');
      }
      if (response.status === 403) {
        if (errText.includes('不支持切换') || errText.includes('请创建新聊天') || errText.includes('所处') || errText.includes('拓展模型')) {
          const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
          e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
          throw e;
        }
        if (errText.includes('work_subscription_required') || errText.includes('Upgrade to Plus')) {
          throw new Error('当前账号未开通 ChatGPT Work 原生套餐权限。如需使用 GPT-5.6，请在对话框左下角切换至常用模型的「⭐ GPT-5.6 Sol」，或使用「Anthropic Claude / Google Gemini」');
        }
        throw new Error('NiceAIGC 访问被拒绝 (HTTP 403)，请确认该账号具有模型使用权限');
      }
      if (response.status === 503) {
        if (errText.includes('api_not_enabled')) {
          const e = new Error('API_NOT_ENABLED');
          e.code = 'API_NOT_ENABLED';
          throw e;
        }
        throw new Error('NiceAIGC 返回 HTTP 503 (API服务未启用或处于维护状态)，请确认 Token 权限或 Base URL');
      }
      if (response.status === 422) {
        if (errText.includes('multimodal_text') || errText.includes('string_type') || errText.includes('parts')) {
          const e = new Error('NiceAIGC 提示：当前节点通道未开放直接解析多模态图片（HTTP 422: 服务端参数校验拦截）。建议切换至「Google Gemini」或「Hermes」等原生多模态视觉助手，或转为纯文本提问');
          e.statusCode = 422;
          throw e;
        }
        const e = new Error(`HTTP 422: ${errText.slice(0, 150)}`);
        e.statusCode = 422;
        throw e;
      }
      throw new Error(`NiceAIGC 接口返回异常 (HTTP ${response.status}): ${errText.slice(0, 150)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastAccumulatedLength = 0;
    let currentAssistantMsgId = null;
    let currentPath = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // Comment or ping

        if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
          return;
        }

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(jsonStr);

            let errMsg = null;
            if (parsed.detail) {
              errMsg = typeof parsed.detail === 'object' ? (parsed.detail.message || JSON.stringify(parsed.detail)) : parsed.detail;
            } else if (parsed.error) {
              errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
            }
            if (errMsg) {
              if (errMsg.includes('不支持切换') || errMsg.includes('请创建新聊天')) {
                const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
                e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
                throw e;
              }
              throw new Error(`NiceAIGC: ${errMsg}`);
            }

            const convId = parsed.conversation_id || parsed.v?.conversation_id;
            if (convId) {
              this.conversationId = convId;
              this._persistConversationId();
            }

            // 1. Message frame (direct or inside parsed.v)
            const msg = parsed.message || (parsed.v && typeof parsed.v === 'object' ? parsed.v.message : null);
            if (msg) {
              const role = msg.author?.role;
              // CRITICAL: DO NOT echo user prompt into assistant view!
              if (role === 'user') {
                continue;
              }

              if (msg.id && msg.id !== currentAssistantMsgId) {
                currentAssistantMsgId = msg.id;
                this.lastMessageId = msg.id;
                lastAccumulatedLength = 0;
              }

              if (role === 'assistant') {
                const parts = msg.content?.parts;
                if (parts && parts.length > 0) {
                  const fullText = parts.join('');
                  if (fullText.length > lastAccumulatedLength) {
                    const delta = fullText.slice(lastAccumulatedLength);
                    lastAccumulatedLength = fullText.length;
                    onChunk(delta);
                  }
                }
              }
              continue;
            }

            // 2. delta_encoding v1 protocol (used by Claude, Gemini, Grok)
            // e.g.: {"p":"/message/content/parts/0","o":"append","v":"text"} or continuation: {"v":"more"}
            if (parsed.p !== undefined) {
              currentPath = parsed.p;
            }

            if (parsed.v !== undefined && typeof parsed.v === 'string') {
              if (currentPath.includes('/message/content/parts')) {
                onChunk(parsed.v);
                continue;
              }
            }

            // 3. Format 3: OpenAI delta or Ollama response
            let delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
            if (!delta && parsed.response) {
              delta = parsed.response;
            }

            if (delta) {
              onChunk(delta);
            }
          } catch (e) {
            if (e.message && (e.message.startsWith('NiceAIGC:') || e.code === 'MODEL_SWITCH_NEW_CHAT_REQUIRED')) {
              throw e;
            }
          }
        }
      }
    }
  }

  /**
   * Node.js https.request SSE streaming (for automated test suite)
   * @private
   */
  async _streamNode(url, headers, body, onChunk) {
    const https = url.startsWith('https') ? require('https') : require('http');
    const urlObj = new URL(url);

    return new Promise((resolve, reject) => {
      const req = https.request(urlObj, {
        method: 'POST',
        headers: Object.assign({}, headers, {
          'Content-Length': Buffer.byteLength(body)
        })
      }, (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', c => errData += c);
          res.on('end', () => {
            this._debugLog({ type: 'http_error', status: res.statusCode, body: errData.slice(0, 400) });
            if (res.statusCode === 503 && errData.includes('api_not_enabled')) {
              const e = new Error('API_NOT_ENABLED');
              e.code = 'API_NOT_ENABLED';
              reject(e);
              return;
            }
            if (errData.includes('缺少用户标识') || errData.includes('缺少xuserid') || errData.includes('缺少xtoken')) {
              reject(new Error('NiceAIGC 缺少用户标识：当前凭据缺少 xuserid 与 xtoken。请在浏览器登录后按 F12 -> Console 输入 document.cookie，将完整 Cookie 复制并保存到工作台设置'));
              return;
            }
            if (errData.includes('套餐暂不支持') || errData.includes('升级订阅套餐')) {
              reject(new Error('NiceAIGC 提示：当前账号套餐未开通此模型。请在浏览器登录后按 F12 复制包含 xtoken 的完整 Cookie 填入凭据，或在设置中更换模型'));
              return;
            }
            if (errData.includes('白名单')) {
              reject(new Error('NiceAIGC 提示：请求模型不在白名单内，请在设置中切换模型 (如: ChatGPT 5.6 Sol)'));
              return;
            }
            if (res.statusCode === 429) {
              reject(new Error('NiceAIGC 提示请求过于频繁 (HTTP 429)，请稍候 3 秒重试'));
              return;
            }
            if (res.statusCode === 403) {
              if (errData.includes('不支持切换') || errData.includes('请创建新聊天') || errData.includes('所处') || errData.includes('拓展模型')) {
                const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
                e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
                reject(e);
                return;
              }
              if (errData.includes('work_subscription_required') || errData.includes('Upgrade to Plus')) {
                reject(new Error('当前账号未开通 ChatGPT Work 原生套餐权限。如需使用 GPT-5.6，请在对话框左下角切换至常用模型的「⭐ GPT-5.6 Sol」，或使用「Anthropic Claude / Google Gemini」'));
                return;
              }
              reject(new Error('NiceAIGC 访问被拒绝 (HTTP 403)，请确认该账号具有模型使用权限'));
              return;
            }
            if (res.statusCode === 401) {
              reject(new Error('NiceAIGC 登录凭据失效或过期 (HTTP 401: 登录态异常)，请在浏览器登录后重新复制最新的 Cookie / Token 并保存至设置'));
              return;
            }
            if (res.statusCode === 422) {
              if (errData.includes('multimodal_text') || errData.includes('string_type') || errData.includes('parts')) {
                const e = new Error('NiceAIGC 提示：当前节点通道未开放直接解析多模态图片（HTTP 422: 服务端参数校验拦截）。建议切换至「Google Gemini」或「Hermes」等原生多模态视觉助手，或转为纯文本提问');
                e.statusCode = 422;
                reject(e);
                return;
              }
              const e = new Error(`HTTP 422: ${errData.slice(0, 150)}`);
              e.statusCode = 422;
              reject(e);
              return;
            }
            reject(new Error(`HTTP ${res.statusCode}: ${errData.slice(0, 150)}`));
          });
          return;
        }

        let buffer = '';
        let lastAccumulatedLength = 0;
        let currentAssistantMsgId = null;
        let currentPath = '';
        let dataLineCount = 0;
        let firstFrame = '';

        res.setEncoding('utf8');
        // 诊断用: 保留原始 SSE 帧尾部, 空响应时可直接定位服务端到底返了什么 (无需猜)
        this._lastRawFrames = '';
        res.on('data', (chunk) => {
          buffer += chunk;
          try {
            this._lastRawFrames = (this._lastRawFrames + chunk).slice(-4000);
          } catch (e) {}
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
              this._debugLog({ type: 'stream_end', done: true, dataLineCount, firstFrame, rawTail: String(this._lastRawFrames || '').slice(-1500) });
              resolve();
              return;
            }
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              dataLineCount++;
              if (!firstFrame) firstFrame = jsonStr.slice(0, 600);
              try {
                const parsed = JSON.parse(jsonStr);

                let errMsg = null;
                if (parsed.detail) {
                  errMsg = typeof parsed.detail === 'object' ? (parsed.detail.message || JSON.stringify(parsed.detail)) : parsed.detail;
                } else if (parsed.error) {
                  errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
                }
                if (errMsg) {
                  if (errMsg.includes('不支持切换') || errMsg.includes('请创建新聊天')) {
                    const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
                    e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
                    reject(e);
                    return;
                  }
                  reject(new Error(`NiceAIGC: ${errMsg}`));
                  return;
                }

                const convId = parsed.conversation_id || parsed.v?.conversation_id;
                if (convId) {
                  this.conversationId = convId;
                  this._persistConversationId();
                }

                // 1. Message frame (direct or inside parsed.v)
                const msg = parsed.message || (parsed.v && typeof parsed.v === 'object' ? parsed.v.message : null);
                if (msg) {
                  const role = msg.author?.role;
                  // CRITICAL: DO NOT echo user prompt into assistant view!
                  if (role === 'user') {
                    continue;
                  }

                  if (msg.id && msg.id !== currentAssistantMsgId) {
                    currentAssistantMsgId = msg.id;
                    this.lastMessageId = msg.id;
                    lastAccumulatedLength = 0;
                  }

                  if (role === 'assistant') {
                    const parts = msg.content?.parts;
                    if (parts && parts.length > 0) {
                      const fullText = parts.join('');
                      if (fullText.length > lastAccumulatedLength) {
                        const delta = fullText.slice(lastAccumulatedLength);
                        lastAccumulatedLength = fullText.length;
                        onChunk(delta);
                      }
                    }
                  }
                  continue;
                }

                // 2. delta_encoding v1 protocol (used by Claude, Gemini, Grok)
                if (parsed.p !== undefined) {
                  currentPath = parsed.p;
                }

                if (parsed.v !== undefined && typeof parsed.v === 'string') {
                  if (currentPath.includes('/message/content/parts')) {
                    onChunk(parsed.v);
                    continue;
                  }
                }

                // 3. Format 3: OpenAI delta or Ollama response
                let delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
                if (!delta && parsed.response) {
                  delta = parsed.response;
                }

                if (delta) onChunk(delta);
              } catch (e) {
                if (e.message && (e.message.startsWith('NiceAIGC:') || e.code === 'MODEL_SWITCH_NEW_CHAT_REQUIRED')) {
                  reject(e);
                  return;
                }
              }
            }
          }
        });

        res.on('end', () => {
          this._debugLog({ type: 'stream_end', done: false, dataLineCount, firstFrame, rawTail: String(this._lastRawFrames || '').slice(-1500) });
          resolve();
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      this.activeRequest = req;

      if (this.abortController?.signal) {
        if (this.abortController.signal.aborted) {
          try { req.destroy(); } catch (e) {}
          reject(new Error('AbortError'));
          return;
        }
        this.abortController.signal.addEventListener('abort', () => {
          try { req.destroy(); } catch (e) {}
          reject(new Error('AbortError'));
        });
      }

      req.write(body);
      req.end();
    });
  }

  /**
   * One-shot completion without modifying chat session state, history, or emitting UI events.
   * Perfect for background RSS tech analysis, summaries, and tagging.
   * @param {string} promptText
   * @param {string} [systemPrompt]
   * @returns {Promise<string>}
   */
  async oneShot(promptText, systemPrompt = '') {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    let baseUrl = (config.baseUrl || 'https://node7.nice188.com').trim().replace(/\/+$/, '');
    if (baseUrl.includes('nice188.cc')) baseUrl = baseUrl.replace('nice188.cc', 'nice188.com');

    const secretKey = config.secretName || 'tabonkb-niceaigc-token';
    let token = await this.getCredential(secretKey);
    if (!token) throw new Error('未配置 NiceAIGC 凭据，请在设置中配置');
    token = token.trim();
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      token = token.slice(1, -1).trim();
    }

    const rawModel = this.activeModelId || config.model || 'gpt-5-6-thinking';
    const model = normalizeModel(rawModel);

    let hostDomain = '';
    try { hostDomain = new URL(baseUrl).hostname; } catch (e) {}

    const isFullCookie = token.includes('=');
    let cookieHeader = '';
    let bearerHeader = token;
    let xuserid = '';
    let xtoken = '';
    let xyUuid = '';
    let sessionToken = '';

    if (isFullCookie) {
      cookieHeader = token;
      const mUid = token.match(/(?:^|;\s*)xuserid=([^;]+)/);
      if (mUid) xuserid = decodeURIComponent(mUid[1].trim());
      const mTok = token.match(/(?:^|;\s*)xtoken=([^;]+)/);
      if (mTok) xtoken = decodeURIComponent(mTok[1].trim());
      const mUuid = token.match(/(?:^|;\s*)xy_uuid_token=([^;]+)/);
      if (mUuid) xyUuid = decodeURIComponent(mUuid[1].trim());
      const mSess = token.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|sessionToken|token)=([^;]+)/);
      if (mSess) sessionToken = decodeURIComponent(mSess[1].trim());
      else {
        sessionToken = '20zf9j0ykdgkw0dlbhlxxszdbwgztutf';
        cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; ${cookieHeader}`;
      }
      bearerHeader = sessionToken || xtoken || token;
    } else {
      sessionToken = token.trim();
      bearerHeader = sessionToken;
      cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; sessionToken=${sessionToken}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json, text/plain, */*',
      'Authorization': `Bearer ${bearerHeader.trim()}`,
      'Cookie': cookieHeader,
      'X-Auth-Token': bearerHeader.trim(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TabonKB-Workbench/1.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-Site-Domain': hostDomain
    };
    if (xuserid) headers['xuserid'] = xuserid;
    if (xtoken) headers['xtoken'] = xtoken;
    if (xyUuid) headers['xy_uuid_token'] = xyUuid;
    if (sessionToken) headers['Chatgpt-Account-Id'] = sessionToken;

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${promptText}` : promptText;
    const apiUrl = `${baseUrl}/backend-api/conversation`;
    const messageId = generateUuid();
    const parentId = generateUuid();

    const payload = {
      action: 'next',
      messages: [{
        id: messageId,
        author: { role: 'user' },
        content: { content_type: 'text', parts: [fullPrompt] }
      }],
      model,
      parent_message_id: parentId,
      timezone_offset_min: -480,
      history_and_training_disabled: true
    };
    const reqBody = JSON.stringify(payload);

    let resultText = '';
    await this._streamNode(apiUrl, headers, reqBody, (chunk) => {
      resultText += chunk;
    });

    return cleanAssistantMarkdown(resultText);
  }
}

/**
 * Clean raw Delimiters, Cites, and Search/URL markers from ChatGPT Web SSE responses
 * @param {string} text
 * @returns {string}
 */
function cleanAssistantMarkdown(text) {
  if (!text) return '';
  let cleaned = text;

  // 1. Process PUA URL blocks: \uE200url\uE202title\uE202url\uE201 or \uE000url\uE002title\uE002url\uE001 -> [title](url)
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202]([^\uE000-\uF8FF\r\n]+?)[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 2. Process literal box URL blocks: □url□title□url□
  cleaned = cleaned.replace(/□url□([^□\r\n]+?)□(https?:\/\/[^□\s\)]+?)□/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/□url□(https?:\/\/[^□\s\)]+?)□/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 3. Strip PUA citation blocks: \uE200cite...\uE201
  cleaned = cleaned.replace(/[\uE000\uE200]cite[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 4. Strip PUA search/browse/call/nav/tool/python blocks
  cleaned = cleaned.replace(/[\uE000\uE200](?:search|browse|nav|call|tool|python)[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 5. Strip literal box citations & tools: □cite□...□
  cleaned = cleaned.replace(/□(?:cite|search|browse|nav|call|tool|python)□[^□\r\n]*?□/g, '');

  // 6. Strip standard web citations like 【4:0†source】
  cleaned = cleaned.replace(/【\d*(?::\d+)?†[a-zA-Z0-9_\-\s]*】/g, '');

  // 7. Strip leftover private-use characters & non-printable ASCII control chars
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '');
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // 8. Clean isolated stray box characters
  cleaned = cleaned.replace(/(?:^|\s)□+(?:\s|$)/g, ' ');

  // 9. Clean excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

module.exports = { NiceAigcAdapter, cleanAssistantMarkdown };
