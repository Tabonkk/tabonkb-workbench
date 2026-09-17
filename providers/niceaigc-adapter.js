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
   * Reset conversation session
   */
  async newSession() {
    await this.abort();
    this.conversationHistory = [];
    this.conversationId = null;
    this.lastMessageId = null;
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

    const executeRequest = async (asBackendApi) => {
      let apiUrl = '';
      let reqBody = '';

      if (asBackendApi) {
        apiUrl = `${baseUrl}/backend-api/conversation`;
        const messageId = generateUuid();
        const parentId = this.lastMessageId || generateUuid();
        this.lastMessageId = messageId;

        const parts = [text];
        if (imageAttachments.length > 0) {
          for (const img of imageAttachments) {
            if (img.dataUrl) {
              parts.push({
                content_type: 'image',
                asset_pointer: img.dataUrl
              });
            }
          }
        }

        const payload = {
          action: 'next',
          messages: [
            {
              id: messageId,
              author: { role: 'user' },
              content: {
                content_type: imageAttachments.length > 0 ? 'multimodal_text' : 'text',
                parts
              }
            }
          ],
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
        } else if (firstErr.code === 'API_NOT_ENABLED' || firstErr.message?.includes('503') || firstErr.message?.includes('api_not_enabled')) {
          // If first attempt failed with API_NOT_ENABLED or 503, try alternative protocol
          console.warn(`[NiceAigcAdapter] Primary protocol (${useBackendApi ? 'backend-api' : 'v1'}) unavailable, falling back to ${useBackendApi ? 'v1' : 'backend-api'}...`);
          fullAssistantText = await executeRequest(!useBackendApi);
        } else {
          throw firstErr;
        }
      }

      if (fullAssistantText && fullAssistantText.trim().length > 0) {
        fullAssistantText = cleanAssistantMarkdown(fullAssistantText);
        this.conversationHistory.push({ role: 'assistant', content: fullAssistantText });
        this.isStreaming = false;
        this.setStatus('connected', '已就绪');
        this.emit('turn_end', { fullText: fullAssistantText });
        this.emit('agent_settled');
        return { success: true };
      } else {
        const activeName = this.activeModelName || model;
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
            reject(new Error(`HTTP ${res.statusCode}: ${errData.slice(0, 150)}`));
          });
          return;
        }

        let buffer = '';
        let lastAccumulatedLength = 0;
        let currentAssistantMsgId = null;
        let currentPath = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
              resolve();
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
                    reject(e);
                    return;
                  }
                  reject(new Error(`NiceAIGC: ${errMsg}`));
                  return;
                }

                const convId = parsed.conversation_id || parsed.v?.conversation_id;
                if (convId) {
                  this.conversationId = convId;
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

        res.on('end', () => resolve());
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
