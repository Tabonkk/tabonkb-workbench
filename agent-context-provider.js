/**
 * AgentContextProvider: Standardizes and maintains TabonKB Workbench contextual state.
 * - Schema: tabonkb-context-v1
 * - Tracks selected knowledge graph node, active filter, query keyword, and current note
 * - Formats prompt with dual-layer representation (JSON schema block + human-readable guidance)
 * - Extensible without modifying prompt templates
 */
class AgentContextProvider {
  constructor(app = null) {
    this.app = app;
    this.selectedNode = null;
    this.activeFilter = '';
    this.searchKeyword = '';
    this.activeFile = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  notifyChange() {
    for (const fn of this._listeners) {
      try {
        fn(this.getContextSnapshot());
      } catch (e) {
        console.error('[AgentContextProvider] listener error:', e);
      }
    }
  }

  setKnowledgeNode(node) {
    if (!node) {
      this.selectedNode = null;
    } else {
      this.selectedNode = {
        id: node.id || node.title,
        title: node.title || node.displayName || node.id,
        displayName: node.displayName || node.title,
        module: node.module || 'General',
        platform: node.platform || 'COMMON',
        type: node.type || 'unknown',
        path: node.path || '',
        referenceCount: node.referenceCount || (node.connections ? node.connections.length : 0),
        connections: Array.isArray(node.connections) ? node.connections : []
      };
    }
    this.notifyChange();
  }

  clearKnowledgeNode() {
    this.selectedNode = null;
    this.notifyChange();
  }

  clearActiveFile() {
    this.activeFile = null;
    this.notifyChange();
  }

  clearContext() {
    this.selectedNode = null;
    this.activeFile = null;
    this.notifyChange();
  }

  setFilter(filter) {
    this.activeFilter = filter || '';
    this.notifyChange();
  }

  setKeyword(kw) {
    this.searchKeyword = kw || '';
    this.notifyChange();
  }

  setActiveFile(file) {
    if (!file) {
      this.activeFile = null;
    } else {
      const p = file.path || '';
      const base = file.basename || (p ? p.split('/').pop().replace(/\.[^/.]+$/, '') : '文档');
      const name = file.name || (p ? p.split('/').pop() : base);
      this.activeFile = {
        path: p,
        basename: base,
        name: name
      };
    }
    this.notifyChange();
  }

  /**
   * Generates a standard machine-readable context snapshot (tabonkb-context-v1)
   */
  getContextSnapshot() {
    return {
      schema: "tabonkb-context-v1",
      timestamp: Date.now(),
      target: this.selectedNode ? {
        id: this.selectedNode.id,
        title: this.selectedNode.title,
        displayName: this.selectedNode.displayName,
        module: this.selectedNode.module,
        platform: this.selectedNode.platform,
        type: this.selectedNode.type,
        path: this.selectedNode.path,
        referenceCount: this.selectedNode.referenceCount,
        linkedNotes: this.selectedNode.connections
      } : null,
      workbench: {
        activeFilter: this.activeFilter || 'all',
        query: this.searchKeyword || ''
      },
      activeNote: this.activeFile ? {
        path: this.activeFile.path,
        name: this.activeFile.name
      } : null
    };
  }

  /**
   * Returns short UI capsule display info
   */
  getContextBadgeInfo() {
    if (this.selectedNode) {
      return {
        hasContext: true,
        type: 'graph_node',
        title: this.selectedNode.displayName || this.selectedNode.title,
        module: this.selectedNode.module,
        platform: this.selectedNode.platform,
        subtext: `知识节点 · ${this.selectedNode.module} · ${this.selectedNode.referenceCount} 关联`
      };
    }
    if (this.activeFile) {
      let mod = '文档';
      if (this.activeFile.path) {
        const parts = this.activeFile.path.split('/');
        if (parts.length > 1) {
          mod = parts[parts.length - 2].replace(/^[0-9]+-/, '');
        }
      }
      return {
        hasContext: true,
        type: 'active_file',
        title: this.activeFile.basename || this.activeFile.name,
        module: mod,
        platform: '',
        subtext: `当前文档 · ${this.activeFile.path}`
      };
    }
    return {
      hasContext: false,
      type: 'vault',
      title: '整个知识库 (TabonKB)',
      module: 'All',
      platform: '',
      subtext: '全局 Vault 范围 (只读模式)'
    };
  }

  /**
   * Formats prompt with dual-layer representation:
   * 1. Machine-readable JSON block
   * 2. Clear human/LLM instructions
   * 3. User request
   */
  formatPromptWithContext(userPrompt) {
    const snapshot = this.getContextSnapshot();

    if (!snapshot.target && !snapshot.activeNote) {
      return userPrompt;
    }

    const jsonBlock = JSON.stringify(snapshot, null, 2);

    let contextSummary = '';
    if (snapshot.target) {
      contextSummary = `【当前聚焦知识图谱节点】
- 节点名称: ${snapshot.target.title}
- 归属模块: ${snapshot.target.module}
- 关联平台: ${snapshot.target.platform}
- 节点类型: ${snapshot.target.type}
- 对应文档: ${snapshot.target.path || '（未绑定具体文件）'}
- 关联知识点: ${snapshot.target.linkedNotes.length > 0 ? snapshot.target.linkedNotes.join(', ') : '暂无直接关联'}`;
    } else if (snapshot.activeNote) {
      contextSummary = `【当前活动文档】
- 文档路径: ${snapshot.activeNote.path}`;
    }

    return `[TabonKB Context Meta]
\`\`\`json
${jsonBlock}
\`\`\`

${contextSummary}

[文件引用] 引用文件一律用绝对路径：服务器 Y:\... / Z:\work\...，知识库 D:\work\Mgmt\TabonKB\...；禁止相对路径与省略号；行号写作 路径:行号。界面会自动缩短显示。

[研发人员提问]
${userPrompt}`;
  }
}

module.exports = { AgentContextProvider };
