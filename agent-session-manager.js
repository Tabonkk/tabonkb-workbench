/**
 * AgentSessionManager: Isolates and persists multi-agent conversations independently.
 * Ensures switching between Pi, Codex, Gemini, and NiceAIGC keeps messages, active tool state,
 * and context perfectly intact across session reloads, app restarts, and agent switches.
 */
class AgentSessionManager {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || (process.cwd ? process.cwd() : '');
    this.app = options.app || null;
    this.agents = new Map();
    this.lastActiveAgentId = null;
    this._saveDebounceTimer = null;
    this._isWriting = false;
    this._pendingWritePayload = null;

    this.initAgent('pi');
    this.initAgent('codex');
    this.initAgent('gemini');
    this.initAgent('niceaigc');
    this.initAgent('antigravity');

    this.loadSessions();
  }

  _getStorageFile() {
    try {
      const path = require('path');
      const basePath = this.vaultBasePath || this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (basePath) {
        return path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', '.chat-history.json');
      }
    } catch (e) {}
    return null;
  }

  initAgent(agentId) {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, {
        agentId,
        activeSessionId: null,
        sessions: [],
        draft: '',
        currentAssistantMessage: null,
        activeToolCards: new Map(),
        // 会话级上下文绑定 (OpenGrok/Gerrit/Jira/本地工程): 尚无会话对象 (新会话待发首条消息) 时的暂存区
        pendingContext: null,
        updatedAt: Date.now()
      });
    }
    return this.agents.get(agentId);
  }

  getAgent(agentId) {
    if (!this.agents.has(agentId)) {
      return this.initAgent(agentId);
    }
    return this.agents.get(agentId);
  }

  loadSessions() {
    let rawData = null;

    // 1. Try reading from .chat-history.json
    try {
      const fs = require('fs');
      const filePath = this._getStorageFile();
      if (filePath && fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content) {
          rawData = JSON.parse(content);
        }
      }
    } catch (e) {
      console.warn('[AgentSessionManager] Failed to read .chat-history.json:', e);
    }

    // 2. Fallback to localStorage
    if (!rawData) {
      try {
        if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem('tabonkb-chat-history');
          if (stored) {
            rawData = JSON.parse(stored);
          }
        }
      } catch (e) {}
    }

    if (rawData && typeof rawData === 'object') {
      if (rawData._meta && rawData._meta.lastActiveAgentId) {
        this.lastActiveAgentId = rawData._meta.lastActiveAgentId;
      }
      for (const [agentId, data] of Object.entries(rawData)) {
        if (agentId === '_meta') continue;
        const agent = this.getAgent(agentId);
        agent.draft = data.draft || '';

        // Case A: New segmented format with sessions array
        if (Array.isArray(data.sessions)) {
          agent.sessions = data.sessions;
          if (data.activeSessionId && agent.sessions.some(s => s.id === data.activeSessionId)) {
            agent.activeSessionId = data.activeSessionId;
          } else if (agent.sessions.length > 0) {
            agent.activeSessionId = agent.sessions[0].id;
          } else {
            agent.activeSessionId = null;
          }
        } 
        // Case B: Legacy format with flat messages array -> migrate to a segmented session
        else if (Array.isArray(data.messages) && data.messages.length > 0) {
          const firstUser = data.messages.find(m => m.role === 'user');
          const title = firstUser ? (firstUser.text || '').slice(0, 36).replace(/\n/g, ' ') : '历史对话';
          const legacySession = {
            id: 'sess_legacy_' + (data.updatedAt || Date.now()),
            title: title,
            createdAt: data.updatedAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            messages: data.messages
          };
          agent.sessions = [legacySession];
          agent.activeSessionId = legacySession.id;
        } else {
          agent.sessions = [];
          agent.activeSessionId = null;
        }
        agent.updatedAt = data.updatedAt || Date.now();
      }
      // 历史假估算 usage 自愈清洗 (旧公式 in=max(120,out*1.5+450)/cache=in*0.4 凭空捏造缓存且不计入合计)
      this._migrateLegacyFakeUsage();
    }
  }

  /**
   * CJK 感知 Token 估算: 汉字/全角标点 ~0.65 tok, 其余 ~0.28 tok
   */
  _estimateTokensFromText(s) {
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
   * 检测并清洗旧版假估算 usage 记录:
   * 旧公式特征 inp === max(120, round(out*1.5+450)) 且 cache === round(inp*0.4) 且 tot === inp+out。
   * 命中后按消息真实 text/thinking/toolCalls 重新估算, 缓存归零, 补标 isEstimated。
   */
  _migrateLegacyFakeUsage() {
    let touched = 0;
    for (const agent of this.agents.values()) {
      for (const sess of (agent.sessions || [])) {
        for (const m of (sess.messages || [])) {
          if (!m || m.role !== 'assistant' || !m.usage || m.usage.isEstimated === true) continue;
          const u = m.usage;
          const inp = u.inputTokens || 0, out = u.outputTokens || 0, cache = u.cacheReadTokens || 0, tot = u.totalTokens || 0;
          const fakeIn = Math.max(120, Math.round(out * 1.5 + 450));
          if (inp === fakeIn && cache === Math.round(inp * 0.4) && tot === inp + out) {
            const tCalls = Array.isArray(m.toolCalls) ? m.toolCalls : [];
            let toolChars = 0;
            for (const tc of tCalls) {
              try { toolChars += JSON.stringify(tc.args || {}).length + String(tc.output || '').length; } catch (_) {}
            }
            const outputTokens = Math.max(1,
              this._estimateTokensFromText(m.text) +
              this._estimateTokensFromText(m.thinking) +
              Math.ceil(toolChars * 0.28));
            const inputTokens = Math.max(1, Math.ceil(outputTokens * 1.6 + tCalls.length * 120 + 600));
            m.usage = {
              inputTokens,
              outputTokens,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: inputTokens + outputTokens,
              netBillableTokens: inputTokens + outputTokens,
              subTurns: 1 + tCalls.length,
              isEstimated: true,
              migratedFakeUsage: true,
              providerAndModel: u.providerAndModel || null,
              durationText: u.durationText || null
            };
            touched++;
          } else if (tot > 0 && (inp + out + cache + (u.cacheWriteTokens || 0)) > tot) {
            // 非假公式但分项相加大于合计 → 归一化兜底, 杜绝页脚悖论
            u.totalTokens = inp + out + cache + (u.cacheWriteTokens || 0);
            touched++;
          }
        }
      }
    }
    if (touched > 0) {
      try { console.info('[AgentSessionManager] Migrated/normalized legacy usage records:', touched); } catch (_) {}
      // 避免在构造函数同步加载栈中阻塞写盘，统一走防抖延迟落盘
      this.saveSessionsDebounced(1500);
    }
  }

  saveSessionsDebounced(delay = 500) {
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
    }
    this._saveDebounceTimer = setTimeout(() => {
      this._saveDebounceTimer = null;
      this.saveSessions();
    }, delay);
  }

  serializeSessions() {
    const payload = {
      _meta: {
        lastActiveAgentId: this.lastActiveAgentId || this.getMostRecentActiveAgentId(),
        updatedAt: Date.now()
      }
    };
    for (const [agentId, agent] of this.agents.entries()) {
      // Keep up to 50 sessions per agent, each session up to 100 messages
      const cleanSessions = (agent.sessions || []).slice(0, 50).map(s => ({
        id: s.id || ('sess_' + Date.now()),
        title: s.title || '对话',
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now(),
        // 服务端会话 ID (NiceAIGC conversation_id / 叶子消息链): 必须随白名单序列化, 否则落盘即丢无法续接
        conversationId: s.conversationId || null,
        lastMessageId: s.lastMessageId || null,
        // 会话级上下文绑定快照: 随会话持久化, 切换/新建会话时恢复或复位
        context: s.context || null,
        messages: (s.messages || []).slice(-100).map(m => ({
          id: m.id || Math.random().toString(36).slice(2),
          role: m.role,
          text: m.text,
          badge: m.badge || null,
          model: m.model || null,
          // 彻底剔除体积巨大的 base64 dataUrl, 仅持久化轻量元数据 (相对路径/哈希/尺寸)
          images: Array.isArray(m.images) ? m.images.map(img => {
            if (!img) return null;
            return {
              name: img.name || 'image',
              path: img.path || null,
              hash: img.hash || null,
              size: img.size || 0,
              width: img.width || null,
              height: img.height || null
            };
          }).filter(Boolean) : null,
          toolCount: m.toolCount || 0,
          toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls : null,
          timestamp: m.timestamp || Date.now(),
          thinking: m.thinking || '',
          duration: m.duration || null,
          durationText: m.durationText || null,
          usage: m.usage || null,
          processSteps: Array.isArray(m.processSteps) ? m.processSteps : null,
          // 中止/中断标记必须入白名单，否则落盘即丢（历史恢复误显示"已完成"且 PlanBar 误弹）
          aborted: m.aborted === true,
          interrupted: m.interrupted === true
        }))
      }));

      payload[agentId] = {
        agentId,
        activeSessionId: agent.activeSessionId,
        sessions: cleanSessions,
        draft: agent.draft || '',
        updatedAt: agent.updatedAt || Date.now()
      };
    }

    return JSON.stringify(payload, null, 2);
  }

  saveSessions(forceAsync = false) {
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = null;
    }
    const jsonStr = this.serializeSessions();
    const isBrowser = typeof window !== 'undefined';
    if (forceAsync || isBrowser) {
      return this._queueWrite(jsonStr);
    } else {
      return this._writeSync(jsonStr);
    }
  }

  saveSessionsAsync() {
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = null;
    }
    const jsonStr = this.serializeSessions();
    return this._queueWrite(jsonStr);
  }

  saveSessionsSync() {
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = null;
    }
    const jsonStr = this.serializeSessions();
    return this._writeSync(jsonStr);
  }

  _writeSync(jsonStr) {
    try {
      const fs = require('fs');
      const filePath = this._getStorageFile();
      if (filePath) {
        fs.writeFileSync(filePath, jsonStr, 'utf8');
      }
    } catch (e) {
      console.warn('[AgentSessionManager] Failed to write .chat-history.json synchronously:', e);
    }
    try {
      if (typeof localStorage !== 'undefined' && jsonStr.length < 1.5 * 1024 * 1024) {
        localStorage.setItem('tabonkb-chat-history', jsonStr);
      }
    } catch (_) {}
  }

  _queueWrite(jsonStr) {
    this._pendingWritePayload = jsonStr;
    if (this._isWriting) {
      return this._writePromise || Promise.resolve();
    }
    this._writePromise = this._flushWriteQueue();
    return this._writePromise;
  }

  async _flushWriteQueue() {
    if (this._isWriting) return;
    this._isWriting = true;

    while (this._pendingWritePayload) {
      const jsonStr = this._pendingWritePayload;
      this._pendingWritePayload = null;

      try {
        const fs = require('fs');
        const filePath = this._getStorageFile();
        if (filePath) {
          if (fs.promises && typeof fs.promises.writeFile === 'function') {
            await fs.promises.writeFile(filePath, jsonStr, 'utf8');
          } else {
            await new Promise((resolve) => {
              fs.writeFile(filePath, jsonStr, 'utf8', () => resolve());
            });
          }
        }
      } catch (e) {
        console.warn('[AgentSessionManager] Failed to write .chat-history.json asynchronously:', e);
      }

      try {
        if (typeof localStorage !== 'undefined' && jsonStr.length < 1.5 * 1024 * 1024) {
          localStorage.setItem('tabonkb-chat-history', jsonStr);
        }
      } catch (_) {}
    }

    this._isWriting = false;
    this._writePromise = null;
  }

  getSessions(agentId) {
    const agent = this.getAgent(agentId);
    return (agent.sessions || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getActiveSession(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent.activeSessionId) return null;
    return agent.sessions.find(s => s.id === agent.activeSessionId) || null;
  }

  getSession(agentId) {
    return this.getActiveSession(agentId) || {
      id: null,
      agentId,
      messages: this.getMessages(agentId),
      draft: this.getDraft(agentId)
    };
  }

  getActiveSessionId(agentId) {
    const agent = this.getAgent(agentId);
    return agent.activeSessionId;
  }

  setLastActiveAgentId(agentId) {
    if (agentId && typeof agentId === 'string') {
      this.lastActiveAgentId = agentId;
      this.saveSessionsDebounced(300);
    }
  }

  getMostRecentActiveAgentId() {
    let latestAgentId = null;
    let latestTime = 0;
    for (const [agentId, agent] of this.agents.entries()) {
      let time = agent.updatedAt || 0;
      const activeSess = this.getActiveSession(agentId);
      if (activeSess) {
        if (activeSess.updatedAt && activeSess.updatedAt > time) time = activeSess.updatedAt;
        if (Array.isArray(activeSess.messages) && activeSess.messages.length > 0) {
          const lastMsg = activeSess.messages[activeSess.messages.length - 1];
          if (lastMsg && lastMsg.timestamp && lastMsg.timestamp > time) {
            time = lastMsg.timestamp;
          }
        }
      }
      if (time > latestTime) {
        latestTime = time;
        latestAgentId = agentId;
      }
    }
    return latestAgentId || 'antigravity';
  }

  getLastActiveAgentId() {
    if (this.lastActiveAgentId) return this.lastActiveAgentId;
    return this.getMostRecentActiveAgentId();
  }

  createSession(agentId, title = '新对话') {
    this.lastActiveAgentId = agentId;
    const agent = this.getAgent(agentId);
    const newSession = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // 新会话物化时接管待发区的上下文绑定 (无待发即为默认未选中)
      context: agent.pendingContext || null,
      messages: []
    };
    agent.pendingContext = null;
    agent.sessions.unshift(newSession);
    agent.activeSessionId = newSession.id;
    agent.updatedAt = Date.now();
    this.saveSessions();
    return newSession;
  }

  switchSession(agentId, sessionId) {
    this.lastActiveAgentId = agentId;
    const agent = this.getAgent(agentId);
    agent.activeSessionId = sessionId;
    agent.updatedAt = Date.now();
    this.saveSessions();
    return this.getActiveSession(agentId);
  }

  newSession(agentId) {
    const agent = this.getAgent(agentId);
    agent.activeSessionId = null;
    agent.currentAssistantMessage = null;
    agent.activeToolCards.clear();
    agent.draft = '';
    agent.pendingContext = null;
    agent.updatedAt = Date.now();
    this.saveSessions();
  }

  deleteSession(agentId, sessionId) {
    const agent = this.getAgent(agentId);
    agent.sessions = agent.sessions.filter(s => s.id !== sessionId);
    if (agent.activeSessionId === sessionId) {
      agent.activeSessionId = agent.sessions.length > 0 ? agent.sessions[0].id : null;
    }
    agent.updatedAt = Date.now();
    this.saveSessions();
  }

  getMessages(agentId) {
    const active = this.getActiveSession(agentId);
    return active ? (active.messages || []) : [];
  }

  // 服务端会话状态 (NiceAIGC conversation_id + last_message_id): 随会话持久化, 保证打开历史会话后能续接上下文
  // backend-api 消息树协议: 续聊时 parent_message_id 必须指向该对话最后一条 assistant 消息, 两者缺一不可
  setSessionConversation(agentId, convId, lastMsgId) {
    const active = this.getActiveSession(agentId);
    if (!active) return;
    if (active.conversationId === (convId || null) && (active.lastMessageId || null) === (lastMsgId || null)) return;
    active.conversationId = convId || null;
    active.lastMessageId = lastMsgId || null;
    active.updatedAt = Date.now();
    this.saveSessions();
  }

  // 会话级上下文绑定 (OpenGrok/Gerrit/Jira/本地工程快照): 有活跃会话写到 session.context,
  // 无会话 (新建待首条消息) 暂存 agent.pendingContext, 由 createSession 接管物化
  setSessionContext(agentId, ctx) {
    const agent = this.getAgent(agentId);
    const active = this.getActiveSession(agentId);
    if (active) {
      active.context = ctx || null;
      active.updatedAt = Date.now();
    } else {
      agent.pendingContext = ctx || null;
    }
    this.saveSessionsDebounced(400);
  }

  getSessionContext(agentId) {
    const active = this.getActiveSession(agentId);
    if (active) return active.context || null;
    const agent = this.getAgent(agentId);
    return agent.pendingContext || null;
  }

  getSessionConversation(agentId) {
    const active = this.getActiveSession(agentId);
    if (!active) return { conversationId: null, lastMessageId: null };
    return {
      conversationId: active.conversationId || null,
      lastMessageId: active.lastMessageId || null
    };
  }

  addMessage(agentId, msg, immediate = false) {
    this.lastActiveAgentId = agentId;
    const agent = this.getAgent(agentId);
    let active = this.getActiveSession(agentId);
    if (!active) {
      const title = (msg.text || '').trim().slice(0, 36).replace(/\n/g, ' ') || 
                    (msg.images && msg.images.length > 0 ? `[图片] ${msg.images[0].name || ''}`.trim() : '新对话');
      active = this.createSession(agentId, title);
    } else if (active.title === '新对话' && msg.role === 'user') {
      const title = (msg.text || '').trim().slice(0, 36).replace(/\n/g, ' ') || 
                    (msg.images && msg.images.length > 0 ? `[图片] ${msg.images[0].name || ''}`.trim() : '');
      if (title) active.title = title;
    }

    active.messages.push(msg);
    active.updatedAt = Date.now();
    agent.updatedAt = Date.now();
    if (immediate) {
      this.saveSessions();
    } else {
      this.saveSessionsDebounced(500);
    }
  }

  // 会话回退（pi fork）：移除 fromIndex 起及其后所有消息，与 pi 侧分支截断保持一致
  truncateMessages(agentId, fromIndex) {
    const active = this.getActiveSession(agentId);
    if (!active || !Array.isArray(active.messages)) return 0;
    if (!(fromIndex >= 0) || fromIndex >= active.messages.length) return 0;
    const removed = active.messages.length - fromIndex;
    active.messages.splice(fromIndex);
    active.updatedAt = Date.now();
    this.saveSessions();
    return removed;
  }

  clearSession(agentId) {
    this.newSession(agentId);
  }

  clearAll() {
    this.lastActiveAgentId = null;
    for (const agent of this.agents.values()) {
      agent.sessions = [];
      agent.activeSessionId = null;
      agent.currentAssistantMessage = null;
      agent.activeToolCards.clear();
      agent.draft = '';
      agent.updatedAt = Date.now();
    }
    this.saveSessions();
  }

  getDraft(agentId) {
    return this.getAgent(agentId).draft || '';
  }

  setDraft(agentId, draft) {
    this.lastActiveAgentId = agentId;
    const agent = this.getAgent(agentId);
    agent.draft = draft || '';
    this.saveSessionsDebounced(600);
  }

  getCurrentAssistant(agentId) {
    return this.getAgent(agentId).currentAssistantMessage;
  }

  setCurrentAssistant(agentId, msg) {
    const agent = this.getAgent(agentId);
    agent.currentAssistantMessage = msg;
    agent.updatedAt = Date.now();
  }
}

module.exports = { AgentSessionManager };
