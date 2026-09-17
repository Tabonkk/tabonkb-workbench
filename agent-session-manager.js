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

    this.initAgent('pi');
    this.initAgent('codex');
    this.initAgent('gemini');
    this.initAgent('niceaigc');

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
      for (const [agentId, data] of Object.entries(rawData)) {
        const agent = this.getAgent(agentId);
        agent.draft = data.draft || '';

        // Case A: New segmented format with sessions array
        if (Array.isArray(data.sessions)) {
          agent.sessions = data.sessions;
          // By default start fresh with activeSessionId = null (default hidden)
          agent.activeSessionId = null;
        } 
        // Case B: Legacy format with flat messages array -> migrate to a segmented session
        else if (Array.isArray(data.messages) && data.messages.length > 0) {
          const firstUser = data.messages.find(m => m.role === 'user');
          const title = firstUser ? (firstUser.text || '').slice(0, 36).replace(/\n/g, ' ') : '历史对话';
          agent.sessions = [{
            id: 'sess_legacy_' + (data.updatedAt || Date.now()),
            title: title,
            createdAt: data.updatedAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            messages: data.messages
          }];
          agent.activeSessionId = null;
        } else {
          agent.sessions = [];
          agent.activeSessionId = null;
        }
        agent.updatedAt = data.updatedAt || Date.now();
      }
    }
  }

  saveSessions() {
    const payload = {};
    for (const [agentId, agent] of this.agents.entries()) {
      // Keep up to 50 sessions per agent, each session up to 100 messages
      const cleanSessions = (agent.sessions || []).slice(0, 50).map(s => ({
        id: s.id || ('sess_' + Date.now()),
        title: s.title || '对话',
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now(),
        messages: (s.messages || []).slice(-100).map(m => ({
          id: m.id || Math.random().toString(36).slice(2),
          role: m.role,
          text: m.text,
          badge: m.badge || null,
          model: m.model || null,
          images: Array.isArray(m.images) ? m.images : null,
          toolCount: m.toolCount || 0,
          timestamp: m.timestamp || Date.now()
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

    const jsonStr = JSON.stringify(payload, null, 2);

    try {
      const fs = require('fs');
      const filePath = this._getStorageFile();
      if (filePath) {
        fs.writeFileSync(filePath, jsonStr, 'utf8');
      }
    } catch (e) {
      console.warn('[AgentSessionManager] Failed to write .chat-history.json:', e);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-chat-history', jsonStr);
      }
    } catch (e) {}
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

  createSession(agentId, title = '新对话') {
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
      agent.activeSessionId = null;
    }
    agent.updatedAt = Date.now();
    this.saveSessions();
  }

  getMessages(agentId) {
    const active = this.getActiveSession(agentId);
    return active ? (active.messages || []) : [];
  }

  addMessage(agentId, msg) {
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
    this.saveSessions();
  }

  clearSession(agentId) {
    this.newSession(agentId);
  }

  clearAll() {
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
    const agent = this.getAgent(agentId);
    agent.draft = draft || '';
    this.saveSessions();
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
