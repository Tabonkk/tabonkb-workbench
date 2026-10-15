/* ==========================================================================
   WeKnora Service — 封装 WeKnora REST API (X-API-Key 鉴权) 为可复用客户端
   被两处 require 复用:
   - mcp/weknora-mcp.js      (stdio JSON-RPC MCP server, 供 Hermes/Gemini 调用)
   - extensions/weknora-portal.ts (Pi 原生扩展, Pi 无 MCP 能力)
   凭证解析优先级: 显式 override > 环境变量 > data.json/.secrets.json
   注: 本文件独立运行 (Node 24 全局 fetch), 不进入 build.py 扁平打包列表
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const WEKNORA_SECRET_NAME = 'tabonkb-weknora-apikey';

function readJsonSafe(p) {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  } catch (e) {
    return null;
  }
}

// 定位插件目录 (兼容从 __dirname / cwd / 绝对路径三种入口)
function resolvePluginDir() {
  const cands = [
    path.resolve(__dirname, '..'),
    path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench'
  ];
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'data.json')) || fs.existsSync(path.join(c, '.secrets.json'))) return c;
  }
  return cands[0];
}

// 规范化 Base URL: 去掉尾斜杠; 若只给了主机则补 /api/v1
function normalizeBase(u) {
  u = (u || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (/\/api\/v\d+$/i.test(u)) return u;
  return u + '/api/v1';
}

function loadConfig(override) {
  override = override || {};
  const dir = resolvePluginDir();
  const data = readJsonSafe(path.join(dir, 'data.json')) || {};
  const secrets = readJsonSafe(path.join(dir, '.secrets.json')) || {};
  const w = (data && data.weknora) || {};
  const baseUrl = normalizeBase(override.baseUrl || process.env.WEKNORA_BASE_URL || w.baseUrl || '');
  const apiKey = (override.apiKey || process.env.WEKNORA_API_KEY || secrets[WEKNORA_SECRET_NAME] || '').trim();
  const defaultKb = override.defaultKb || process.env.WEKNORA_DEFAULT_KB || w.defaultKb || '';
  return { baseUrl, apiKey, defaultKb };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s) { return UUID_RE.test(String(s || '')); }

function unwrapData(r) {
  if (r && typeof r === 'object' && 'data' in r) return r.data;
  return r;
}
function unwrapList(r) {
  let d = unwrapData(r);
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    if (Array.isArray(d.list)) return d.list;
    if (Array.isArray(d.items)) return d.items;
  }
  return [];
}

class WeknoraService {
  constructor(cfg) {
    cfg = cfg || loadConfig();
    this.baseUrl = cfg.baseUrl;
    this.apiKey = cfg.apiKey;
    this.defaultKb = cfg.defaultKb;
  }

  isConfigured() { return !!(this.baseUrl && this.apiKey); }

  async _req(method, endpoint, body, timeoutMs = 10000) {
    if (!this.baseUrl) throw new Error('WeKnora Base URL 未配置 (设置页或 WEKNORA_BASE_URL)');
    if (!this.apiKey) throw new Error('WeKnora API Key 未配置 (设置页或 WEKNORA_API_KEY)');
    const url = this.baseUrl + endpoint;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const opts = {
      method,
      headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${endpoint}: ${text.slice(0, 300)}`);
      try { return JSON.parse(text); } catch (e) { return { data: text, success: true }; }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async ping(timeoutMs = 4000) {
    const t0 = Date.now();
    try {
      await this._req('GET', '/knowledge-bases', undefined, timeoutMs);
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, error: err.message || String(err) };
    }
  }

  async getWikiGraph(kb, limit = 300, timeoutMs = 10000) {
    const id = await this.resolveKbId(kb);
    const n = Math.max(20, Math.min(2500, limit || 300));
    const raw = await this._req('GET', `/knowledgebase/${id}/wiki/graph?mode=overview&limit=${n}`, undefined, timeoutMs);
    return {
      nodes: raw.nodes || [],
      edges: raw.edges || [],
      meta: raw.meta || {},
      kbId: id
    };
  }

  async searchWiki(kb, query, limit = 10, timeoutMs = 8000) {
    const id = await this.resolveKbId(kb);
    const q = (query || '').trim();
    if (!q) return { pages: [], total: 0 };
    const raw = await this._req('GET', `/knowledgebase/${id}/wiki/search?q=${encodeURIComponent(q)}`, undefined, timeoutMs);
    const pages = (raw && raw.pages) || [];
    return {
      pages: pages.slice(0, limit),
      total: (raw && raw.total != null) ? raw.total : pages.length
    };
  }

  async getWikiEgo(kb, slug, cap = 30, depth = 1, timeoutMs = 8000) {
    const id = await this.resolveKbId(kb);
    const raw = await this._req('GET', `/knowledgebase/${id}/wiki/graph?mode=ego&center=${encodeURIComponent(slug)}&depth=${depth}`, undefined, timeoutMs);
    let nodes = raw.nodes || [];
    const keep = Math.max(10, cap || 30);
    let centerNode = nodes.find(n => n.slug === slug);
    if (!centerNode) {
      centerNode = { slug, title: slug.split('/').pop(), page_type: 'entity', link_count: (raw.edges || []).length };
    }
    if (nodes.length > keep) {
      let otherNodes = nodes.filter(n => n.slug !== slug);
      otherNodes.sort((a, b) => (b.link_count || 0) - (a.link_count || 0));
      otherNodes = otherNodes.slice(0, keep - 1);
      nodes = [centerNode, ...otherNodes];
      const kept = new Set(nodes.map(n => n.slug));
      raw.edges = (raw.edges || []).filter(e => kept.has(e.source) && kept.has(e.target));
    } else {
      nodes = [centerNode, ...nodes.filter(n => n.slug !== slug)];
    }
    return {
      nodes,
      edges: raw.edges || [],
      meta: raw.meta || {},
      kbId: id,
      totalNeighbors: Math.max(0, (raw.nodes || []).length - (centerNode ? 1 : 0))
    };
  }

  async getWikiPage(kb, slug, timeoutMs = 5000) {
    const id = await this.resolveKbId(kb);
    const p = await this._req('GET', `/knowledgebase/${id}/wiki/pages/${encodeURIComponent(slug)}`, undefined, timeoutMs);
    return {
      title: p.title || slug,
      pageType: p.page_type || 'entity',
      summary: p.summary || '',
      content: p.content || '',
      slug: p.slug || slug
    };
  }

  async getWikiStats(kb, timeoutMs = 5000) {
    const id = await this.resolveKbId(kb);
    const raw = await this._req('GET', `/knowledgebase/${id}/wiki/stats`, undefined, timeoutMs);
    return (raw && raw.data) || raw || {};
  }

  // 知识库名/ID -> UUID; 留空则用默认或第一个
  async resolveKbId(kb) {
    if (kb && isUuid(kb)) return kb;
    const kbs = await this.listKnowledgeBases();
    if (!kb) {
      if (this.defaultKb) return await this.resolveKbId(this.defaultKb);
      if (kbs.length) return kbs[0].id;
      throw new Error('未发现任何知识库, 请先在 WeKnora 中创建');
    }
    const needle = String(kb).toLowerCase();
    let m = kbs.find((k) => (k.name || '').toLowerCase() === needle);
    if (!m) m = kbs.find((k) => (k.name || '').toLowerCase().includes(needle));
    if (m) return m.id;
    throw new Error(`知识库「${kb}」未找到, 可用: ${kbs.map((k) => k.name).join(', ') || '(空)'}`);
  }

  async listKnowledgeBases() {
    const r = await this._req('GET', '/knowledge-bases');
    return unwrapList(r).map((k) => ({
      id: k.id,
      name: k.name,
      description: k.description || '',
      knowledge_count: k.knowledge_count,
      chunk_count: k.chunk_count,
      capabilities: k.capabilities
    }));
  }

  async hybridSearch(kb, query, opts) {
    opts = opts || {};
    const id = await this.resolveKbId(kb);
    const body = {
      query_text: query,
      vector_threshold: opts.vector_threshold != null ? opts.vector_threshold : 0.5,
      keyword_threshold: opts.keyword_threshold != null ? opts.keyword_threshold : 0.3,
      match_count: opts.match_count != null ? opts.match_count : 5
    };
    const r = await this._req('POST', `/knowledge-bases/${id}/hybrid-search`, body);
    return unwrapList(r);
  }

  async listKnowledge(kb, page, pageSize) {
    const id = await this.resolveKbId(kb);
    const p = page || 1, ps = pageSize || 20;
    const r = await this._req('GET', `/knowledge-bases/${id}/knowledge?page=${p}&page_size=${ps}`);
    return { list: unwrapList(r), total: (r && (r.total != null ? r.total : (r.data && r.data.total))) };
  }

  async listAllKnowledge(kb) {
    const pageSize = 100;
    const all = [];
    let total = Infinity;
    for (let page = 1; page <= 40 && all.length < total; page++) {
      const res = await this.listKnowledge(kb, page, pageSize);
      const list = res.list || [];
      if (res.total != null) total = Number(res.total) || list.length;
      all.push(...list);
      if (!list.length || list.length < pageSize) break;
    }
    return all;
  }

  async getKnowledge(kid) {
    const r = await this._req('GET', `/knowledge/${kid}`);
    return unwrapData(r);
  }

  async getKnowledgeSpans(kid) {
    const r = await this._req('GET', `/knowledge/${kid}/spans`);
    return unwrapData(r);
  }

  async createManual(kb, title, content, status, folderPath = '') {
    const id = await this.resolveKbId(kb);
    const r = await this._req('POST', `/knowledge-bases/${id}/knowledge/manual`, {
      title, content, status: status || 'publish'
    });
    const doc = unwrapData(r);
    if (doc?.id && folderPath) {
      try {
        await this.moveToFolder(id, [doc.id], folderPath);
        doc.folder_path = folderPath;
      } catch (mErr) {
        console.warn(`[WeKnora] moveToFolder 失败 (${folderPath}):`, mErr);
      }
    }
    return doc;
  }

  async updateManual(kid, content, title, status, kb = '', folderPath = '') {
    const r = await this._req('PUT', `/knowledge/manual/${kid}`, {
      title: title || '', content, status: status || 'publish'
    });
    const doc = unwrapData(r);
    if (folderPath && kb) {
      try {
        const id = await this.resolveKbId(kb);
        await this.moveToFolder(id, [kid], folderPath);
        if (doc) doc.folder_path = folderPath;
      } catch (mErr) {
        console.warn(`[WeKnora] moveToFolder (update) 失败 (${folderPath}):`, mErr);
      }
    }
    return doc;
  }

  async deleteKnowledge(kid) {
    return this._req('DELETE', `/knowledge/${kid}`);
  }

  async moveToFolder(kb, knowledgeIds, folderPath) {
    const id = await this.resolveKbId(kb);
    const r = await this._req('POST', '/knowledge/folder', {
      kb_id: id,
      knowledge_ids: Array.isArray(knowledgeIds) ? knowledgeIds : [knowledgeIds],
      folder_path: folderPath || ''
    });
    return unwrapData(r);
  }

  async uploadFile(kb, filename, bufferOrArrayBuffer, mimeType = 'application/octet-stream', folderPath = '') {
    const id = await this.resolveKbId(kb);
    const url = this.baseUrl + `/knowledge-bases/${id}/knowledge/file`;
    const fd = new FormData();
    const blob = new Blob([bufferOrArrayBuffer], { type: mimeType });
    fd.append('file', blob, filename);
    if (folderPath) {
      fd.append('fileName', `${folderPath}/${filename}`);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 60000) : null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey
        },
        body: fd,
        signal: controller ? controller.signal : undefined
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} POST /knowledge-bases/${id}/knowledge/file: ${text.slice(0, 300)}`);
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { parsed = { data: text, success: true }; }

      const kid = parsed?.data?.id;
      if (kid && folderPath) {
        try {
          await this.moveToFolder(id, [kid], folderPath);
          if (parsed.data) parsed.data.folder_path = folderPath;
        } catch (mErr) {
          console.warn(`[WeKnora] moveToFolder (upload fallback) 失败 (${folderPath}):`, mErr);
        }
      }
      return parsed;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // 问答: 建会话 -> knowledge-chat (SSE), 汇总 answer + references
  async ask(kb, query) {
    const id = await this.resolveKbId(kb);
    const sess = await this._req('POST', '/sessions', {
      knowledge_base_id: id,
      title: 'tabonkb-workbench-mcp',
      description: 'auto-created by TabonKB workbench',
      session_strategy: {
        max_rounds: 5, enable_rewrite: true, fallback_strategy: 'FIXED_RESPONSE',
        fallback_response: '未能从知识库中检索到相关内容。', embedding_top_k: 10,
        keyword_threshold: 0.5, vector_threshold: 0.7
      }
    });
    const sid = (unwrapData(sess) || {}).id || (sess && sess.data && sess.data.id);
    if (!sid) throw new Error('创建 WeKnora 会话失败: ' + JSON.stringify(sess).slice(0, 200));
    const result = await this._sseChat(sid, query, [id]);
    return result;
  }

  async _sseChat(sid, query, kbIds) {
    const url = this.baseUrl + `/knowledge-chat/${sid}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ query, channel: 'api', knowledge_base_ids: kbIds })
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`); }
    if (!res.body) throw new Error('WeKnora 问答未返回流');

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buf = '';
    let answer = '';
    let references = [];
    let streamError = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let ev; try { ev = JSON.parse(payload); } catch (e) { continue; }
        const rt = ev.response_type;
        if (rt === 'answer' || rt === 'final_answer') {
          if (ev.content) answer += ev.content;
        } else if (rt === 'references') {
          references = ev.knowledge_references || (ev.data && ev.data.knowledge_references) || references;
        } else if (rt === 'error') {
          streamError = ev.content || 'WeKnora 问答返回错误';
        }
      }
    }
    if (!answer && streamError) throw new Error(streamError);
    return { answer, references: references || [], session_id: sid };
  }
}

/* --------------------------------------------------------------------------
   工具 schema (JSON Schema) 与 handler: stdio MCP 与 Pi 扩展共用同一套定义
   -------------------------------------------------------------------------- */

const KB_PARAM = { type: 'string', description: "知识库名称或 UUID; 留空则使用默认/第一个知识库 (可用 weknora_list_knowledge_bases 查看)" };

const WEKNORA_TOOLS = [
  {
    name: 'weknora_list_knowledge_bases',
    description: '列出 WeKnora 知识库中的全部知识库 (id / 名称 / 文档数 / 能力), 用于确定后续检索/问答工具的 kb 参数。',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'weknora_search',
    description: '知识库默认检索。在指定 WeKnora 知识库中做向量+关键词混合检索, 返回最相关的文档分块片段 (含来源文档标题与 knowledge_id)。询问项目知识、排障案例、平台文档时优先用本工具, 不要改调 weknora_ask。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词或问题, 如 "USB 橙屏" / "charge PMIC" / 报错信息' },
        kb: KB_PARAM,
        match_count: { type: 'number', description: '返回分块数量, 默认 5' }
      },
      required: ['query']
    }
  },
  {
    name: 'weknora_ask',
    description: '非默认路径。基于 WeKnora 知识库再跑一轮服务端 RAG, 返回带引用的成稿, 经常耗时数分钟。仅当用户明确要求知识库直接作答且 weknora_search 片段不够时单独调用。不要与 weknora_search 并行。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '要提问的完整自然语言问题' },
        kb: KB_PARAM
      },
      required: ['query']
    }
  },
  {
    name: 'weknora_list_documents',
    description: '分页列出某知识库中的文档条目 (标题 / id / 类型 / 解析状态 / 摘要), 用于浏览知识库内容清单。',
    inputSchema: {
      type: 'object',
      properties: {
        kb: KB_PARAM,
        page: { type: 'number', description: '页码, 从 1 开始, 默认 1' },
        page_size: { type: 'number', description: '每页条数, 默认 20' }
      },
      required: []
    }
  },
  {
    name: 'weknora_read_document',
    description: '按 knowledge_id 读取单篇文档详情 (标题 / 摘要 / 状态 / 手工正文 Markdown 若有)。',
    inputSchema: {
      type: 'object',
      properties: { knowledge_id: { type: 'string', description: '文档条目 ID (来自检索/列表结果中的 knowledge_id)' } },
      required: ['knowledge_id']
    }
  },
  {
    name: 'weknora_add_document',
    description: '向知识库新增一篇 Markdown 文档 (写入工具)。默认 status=publish 立即分块索引可检索; 传 draft 仅保存不索引。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '文档标题' },
        content: { type: 'string', description: 'Markdown 正文' },
        kb: KB_PARAM,
        status: { type: 'string', enum: ['publish', 'draft'], description: 'publish(默认, 立即索引) 或 draft(草稿不索引)' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'weknora_update_document',
    description: '更新一篇已有的手工 Markdown 文档正文 (写入工具)。仅适用于 type=manual 的条目; title 留空则保持原标题。',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_id: { type: 'string', description: '要更新的文档 ID' },
        content: { type: 'string', description: '新的 Markdown 正文 (整体替换)' },
        title: { type: 'string', description: '新标题, 留空保持原标题' },
        status: { type: 'string', enum: ['publish', 'draft'], description: 'publish(默认, 重新索引) 或 draft' }
      },
      required: ['knowledge_id', 'content']
    }
  },
  {
    name: 'weknora_delete_document',
    description: '删除知识库中的一篇文档条目 (写入工具, 不可逆)。提交后台删除任务。',
    inputSchema: {
      type: 'object',
      properties: { knowledge_id: { type: 'string', description: '要删除的文档 ID' } },
      required: ['knowledge_id']
    }
  }
];

function _fmtKbList(kbs) {
  if (!kbs.length) return '当前没有可访问的知识库。';
  const lines = [`### WeKnora 知识库 (共 ${kbs.length} 个):`, ''];
  kbs.forEach((k, i) => {
    const caps = k.capabilities ? Object.keys(k.capabilities).filter((c) => k.capabilities[c]).join('/') : '';
    lines.push(`${i + 1}. **${k.name}**`);
    lines.push(`   - ID: \`${k.id}\` | 文档数: ${k.knowledge_count != null ? k.knowledge_count : '?'} | 能力: ${caps || '通用'}`);
    if (k.description) lines.push(`   - 描述: ${String(k.description).slice(0, 120)}`);
  });
  return lines.join('\n');
}

function _fmtSearch(hits, query) {
  if (!hits.length) return `知识库中未检索到与「${query}」相关的内容。建议更换关键词, 或用 weknora_list_knowledge_bases 确认知识库。`;
  const lines = [`### WeKnora 检索结果 (关键词「${query}」, 命中 ${hits.length} 条):`, ''];
  hits.forEach((h, i) => {
    const snippet = String(h.content || '').replace(/\s+/g, ' ').trim();
    lines.push(`**${i + 1}. ${h.knowledge_title || '未知文档'}** (相关度 ${(Number(h.score) || 0).toFixed(3)})`);
    lines.push(`   - knowledge_id: \`${h.knowledge_id || h.id || ''}\` | 分块 #: ${h.chunk_index != null ? h.chunk_index : '-'}`);
    lines.push(`   - 内容: ${snippet.slice(0, 600)}${snippet.length > 600 ? '...' : ''}`);
    lines.push('');
  });
  lines.push('💡 需要完整上下文可用 weknora_read_document 传入 knowledge_id。不要为此再调用 weknora_ask。');
  return lines.join('\n');
}

function _fmtAsk(r) {
  const lines = ['### WeKnora 问答', '', (r.answer || '(无答案内容)'), ''];
  const refs = Array.isArray(r.references) ? r.references : [];
  if (refs.length) {
    lines.push('---');
    lines.push(`**引用来源 (${refs.length}):**`);
    refs.slice(0, 12).forEach((ref, i) => {
      const t = ref.knowledge_title || ref.title || ref.name || ref.doc_title || '来源';
      const seg = ref.chunk_id || ref.id || '';
      lines.push(`${i + 1}. ${t}${seg ? ` (\`${seg}\`)` : ''}`);
    });
  }
  return lines.join('\n');
}

function _fmtDocList(res) {
  const list = res.list || [];
  if (!list.length) return '该知识库暂无文档条目。';
  const lines = [`### 文档清单 (本页 ${list.length} 条${res.total != null ? ', 总计 ' + res.total : ''}):`, ''];
  list.forEach((d, i) => {
    lines.push(`${i + 1}. **${d.title || d.file_name || '无标题'}**`);
    lines.push(`   - id: \`${d.id}\` | 类型: ${d.file_type || d.type || '-'} | 解析: ${d.parse_status || '-'} | 启用: ${d.enable_status || '-'}`);
    if (d.folder_path) lines.push(`   - 目录: ${d.folder_path}`);
    if (d.description) lines.push(`   - 摘要: ${String(d.description).replace(/\s+/g, ' ').slice(0, 160)}`);
  });
  return lines.join('\n');
}

function _fmtDocDetail(d) {
  if (!d) return '未找到该文档详情。';
  const lines = [`# ${d.title || d.file_name || '文档'}`, ''];
  lines.push(`- **id**: \`${d.id}\``);
  lines.push(`- **类型**: ${d.file_type || d.type || '-'} | **解析状态**: ${d.parse_status || '-'} | **启用**: ${d.enable_status || '-'}`);
  if (d.folder_path) lines.push(`- **目录**: ${d.folder_path}`);
  if (d.description) lines.push(`\n## 摘要\n${d.description}`);
  const body = d.metadata && d.metadata.content;
  if (body) lines.push(`\n## 正文 (Markdown)\n${body}`);
  else lines.push(`\n> 该文档为解析型文件, 正文以分块形式存储。请用 weknora_search 检索其内容片段。`);
  return lines.join('\n');
}

async function runWeknoraTool(name, args, service) {
  args = args || {};
  const svc = service || new WeknoraService();
  if (!svc.isConfigured()) {
    return '⚠️ WeKnora 未配置。请在工作台设置中填写 Base URL 与 API Key (或设置环境变量 WEKNORA_BASE_URL / WEKNORA_API_KEY)。';
  }
  switch (name) {
    case 'weknora_list_knowledge_bases':
      return _fmtKbList(await svc.listKnowledgeBases());
    case 'weknora_search':
      return _fmtSearch(await svc.hybridSearch(args.kb, args.query, { match_count: args.match_count }), args.query);
    case 'weknora_ask':
      return _fmtAsk(await svc.ask(args.kb, args.query));
    case 'weknora_list_documents':
      return _fmtDocList(await svc.listKnowledge(args.kb, args.page, args.page_size));
    case 'weknora_read_document':
      return _fmtDocDetail(await svc.getKnowledge(args.knowledge_id));
    case 'weknora_add_document': {
      const r = await svc.createManual(args.kb, args.title, args.content, args.status);
      return `✅ 已新增文档「${args.title}」\n- id: \`${(r && r.id) || '?'}\`\n- 状态: ${args.status || 'publish'}${args.status === 'draft' ? ' (草稿, 未索引)' : ' (已提交索引, 稍后可检索)'}`;
    }
    case 'weknora_update_document': {
      const r = await svc.updateManual(args.knowledge_id, args.content, args.title, args.status);
      return `✅ 已更新文档 \`${args.knowledge_id}\`${(r && r.id) ? ` (id: ${r.id})` : ''}\n- 状态: ${args.status || 'publish'}`;
    }
    case 'weknora_delete_document': {
      const r = await svc.deleteKnowledge(args.knowledge_id);
      return `🗑 已提交删除文档 \`${args.knowledge_id}\` 的任务${(r && r.success) ? ' (成功)' : ''}`;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = {
  WeknoraService,
  WEKNORA_TOOLS,
  WEKNORA_SECRET_NAME,
  runWeknoraTool,
  loadConfig,
  normalizeBase
};
