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
          processSteps: Array.isArray(m.processSteps) ? m.processSteps : null
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
      messages: []
    };
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
