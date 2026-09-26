/* ==========================================================================
   Gerrit Service — 企业代码评审系统 (Gerrit) 客户端与工具适配
   支持端:
   - extensions/gerrit-portal.ts (Pi Coding Agent 原生扩展)
   - mcp/gerrit-mcp.js          (Hermes CLI stdio JSON-RPC MCP Server)
   - settings/workbench-settings-tab.js (工作台设置与连通性测试)
   - components/                (工作台 UI 可选调用)

   【权限与安全边界声明】
   用户指令严格限定：只允许 Agent 搜索、查阅与比对代码变更（Read-Only）。
   严禁提供任何 Review、打分（Vote）、合入（Submit）、放弃（Abandon）或推送（Push）方法！
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// 企业 Gerrit 默认配置
const DEFAULT_GERRIT_BASE_URL = 'http://192.168.1.17:8090';

function gerritReadJsonSafe(p) {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  } catch (e) {
    return null;
  }
}

function gerritResolvePluginDir() {
  const cands = [
    path.resolve(__dirname, '..'),
    path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench'
  ];
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'data.json'))) return c;
  }
  return cands[0];
}

function gerritNormalizeBase(u) {
  u = (u || '').trim().replace(/\/+$/, '');
  if (!u) return DEFAULT_GERRIT_BASE_URL;
  return u;
}

/**
 * 读取设置面板落盘的凭据 (SecretStorage -> .secrets.json)
 * 设置面板通过 setSecret(secretName, value) 写入 .secrets.json, data.json 仅保存 secretName 引用;
 * 故此处必须回读密文文件, 否则 Pi 扩展 / Hermes MCP 在无 override 场景下会静默退化为匿名请求。
 */
function gerritReadSecret(secretName) {
  if (!secretName) return '';
  const cands = [
    path.join(gerritResolvePluginDir(), '.secrets.json'),
    path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/.secrets.json'
  ];
  for (const f of cands) {
    const data = gerritReadJsonSafe(f);
    if (data && data[secretName]) return String(data[secretName]).trim();
  }
  return '';
}

function gerritLoadConfig(override) {
  override = override || {};
  const dir = gerritResolvePluginDir();
  const data = gerritReadJsonSafe(path.join(dir, 'data.json')) || {};
  const g = (data && data.gerrit) || {};

  const baseUrl = gerritNormalizeBase(override.baseUrl || process.env.GERRIT_BASE_URL || g.baseUrl || DEFAULT_GERRIT_BASE_URL);
  const username = (override.username || process.env.GERRIT_USERNAME || g.username || '').trim();
  const secretName = (override.secretName || g.secretName || 'tabonkb-gerrit-password').trim();
  const password = (override.password || process.env.GERRIT_PASSWORD || process.env.GERRIT_TOKEN || g.password || gerritReadSecret(secretName) || '').trim();
  const timeoutMs = parseInt(override.timeout || g.timeout || '15000', 10);
  const readonly = true; // 强制只读

  return { baseUrl, username, password, timeoutMs, readonly };
}

class GerritService {
  constructor(cfg) {
    cfg = cfg || gerritLoadConfig();
    this.baseUrl = cfg.baseUrl || DEFAULT_GERRIT_BASE_URL;
    this.username = cfg.username || '';
    this.password = cfg.password || '';
    this.timeoutMs = cfg.timeoutMs || 15000;
    this.readonly = true; // 严格只读保护
  }

  isConfigured() {
    return !!this.baseUrl;
  }

  isAuthenticated() {
    return !!(this.username && this.password);
  }

  /**
   * 执行只读 HTTP GET 请求
   * Gerrit 认证规则：若配置了用户名密码，使用 /a/ 前缀与 HTTP Basic Auth；否则走匿名端点
   */
  async _httpGet(endpoint, customTimeout) {
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // 如果配置了账号密码，且端点未以 /a/ 开头，自动拼接 /a/ 走认证请求
    if (this.isAuthenticated() && !cleanEndpoint.startsWith('/a/')) {
      cleanEndpoint = `/a${cleanEndpoint}`;
    }

    const fullUrl = `${this.baseUrl}${cleanEndpoint}`;
    const timeout = customTimeout || this.timeoutMs;

    const headers = {
      'Accept': 'application/json, text/plain, */*'
    };

    if (this.isAuthenticated()) {
      const authStr = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }

    // 使用统一的 IntranetFetcher 执行高可用请求 (自动处理 requestUrl、Node http 及子进程 Worker 旁路)
    let fetchFn = (typeof intranetRequest === 'function') ? intranetRequest : null;
    if (!fetchFn) {
      try {
        const ifetch = require('./intranet-fetcher.js');
        if (ifetch && typeof ifetch.intranetRequest === 'function') fetchFn = ifetch.intranetRequest;
      } catch (_) {}
    }

    if (!fetchFn) {
      throw new Error('未找到可用网络请求组件 (intranetRequest)');
    }

    let res;
    try {
      res = await fetchFn({
        url: fullUrl,
        method: 'GET',
        headers,
        timeout
      });
    } catch (err) {
      throw new Error(`连接 Gerrit 失败 (${this.baseUrl}): ${err.message}`);
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Gerrit 凭据鉴权失败 (HTTP ${res.status}): 用户名或访问口令无效。\n💡 提示：Gerrit REST API 要求使用专用 HTTP 密码。请在 Gerrit 网页端 (http://192.168.1.17:8090) 登录后 -> 点击右上角头像 -> Settings -> HTTP Credentials (HTTP 凭据) -> 点击「Generate Password」获取专用访问口令并保存至此。若仅查阅公开项目，可清空密码输入框。`);
    }
    if (res.status === 404) {
      throw new Error(`Gerrit 资源未找到 (404): ${endpoint}`);
    }
    if (res.status >= 400) {
      throw new Error(`Gerrit HTTP ${res.status}: ${(res.body || res.text || '').slice(0, 200)}`);
    }

    let rawData = res.body || res.text || '';
    let text = rawData;
    if (text.startsWith(")]}'\n")) {
      text = text.substring(5);
    } else if (text.startsWith(")]}'")) {
      text = text.substring(4);
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      return rawData;
    }
  }

  /**
   * 测试 Gerrit 服务连通性与版本探测
   */
  async testConnection() {
    try {
      const ver = await this._httpGet('/config/server/version', 5000);
      let versionStr = typeof ver === 'string' ? ver.trim() : JSON.stringify(ver);
      versionStr = versionStr.replace(/^"+|"+$/g, '');

      return {
        ok: true,
        version: versionStr,
        authenticated: this.isAuthenticated(),
        baseUrl: this.baseUrl,
        readonly: true
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        baseUrl: this.baseUrl
      };
    }
  }

  /**
   * 搜索代码变更 (Search Changes)
   * @param {Object} opts
   * @param {string} opts.query - Gerrit 检索表达式 (如 status:open, project:xxx, commit:xxx, message:xxx)
   * @param {number} [opts.limit=15] - 结果数量上限
   */
  async searchChanges(opts) {
    opts = opts || {};
    const q = (opts.query || 'status:open').trim();
    const limit = Math.min(Math.max(1, parseInt(opts.limit || '15', 10)), 30);

    // 参数包含附加项: CURRENT_REVISION, CURRENT_COMMIT, DETAILED_ACCOUNTS
    const u = new URL(`${this.baseUrl}/changes/`);
    u.searchParams.set('q', q);
    u.searchParams.set('n', String(limit));
    u.searchParams.append('o', 'CURRENT_REVISION');
    u.searchParams.append('o', 'CURRENT_COMMIT');
    u.searchParams.append('o', 'DETAILED_ACCOUNTS');

    const endpoint = `/changes/?${u.searchParams.toString()}`;
    const rawList = await this._httpGet(endpoint);
    const changes = Array.isArray(rawList) ? rawList : [];

    return {
      query: q,
      total: changes.length,
      baseUrl: this.baseUrl,
      changes: changes.map(c => ({
        id: c.id,
        number: c._number,
        changeId: c.change_id,
        project: c.project,
        branch: c.branch,
        subject: c.subject,
        status: c.status,
        owner: c.owner ? (c.owner.name || c.owner.username || c.owner.email || 'Unknown') : 'Unknown',
        updated: c.updated,
        created: c.created,
        insertions: c.insertions || 0,
        deletions: c.deletions || 0,
        currentRevision: c.current_revision || null,
        commitMessage: c.revisions && c.current_revision && c.revisions[c.current_revision]?.commit?.message
      }))
    };
  }

  /**
   * 获取指定 Change 详情 (Get Change Detail)
   * @param {string|number} changeId - Change 编号 (如 12345) 或 Triplet (project~branch~ChangeId)
   */
  async getChangeDetail(changeId) {
    if (!changeId) throw new Error('缺少必要参数: changeId');
    const cleanId = String(changeId).trim();

    // 请求 /detail
    const detail = await this._httpGet(`/changes/${encodeURIComponent(cleanId)}/detail`);
    return {
      id: detail.id,
      number: detail._number,
      changeId: detail.change_id,
      project: detail.project,
      branch: detail.branch,
      subject: detail.subject,
      status: detail.status,
      owner: detail.owner ? (detail.owner.name || detail.owner.username || detail.owner.email) : 'Unknown',
      created: detail.created,
      updated: detail.updated,
      insertions: detail.insertions || 0,
      deletions: detail.deletions || 0,
      currentRevision: detail.current_revision,
      labels: detail.labels || {},
      messages: (detail.messages || []).map(m => ({
        author: m.author?.name || 'CI/Robot',
        date: m.date,
        message: m.message
      })),
      baseUrl: this.baseUrl,
      reviewers: (detail.reviewers?.REVIEWER || []).map(r => r.name || r.username || r.email)
    };
  }

  /**
   * 查看变更的代码差异比对 (Get Diff / Patch)
   * @param {Object} opts
   * @param {string|number} opts.change_id - Change 编号
   * @param {string} [opts.file_path] - (可选) 具体文件相对路径
   * @param {string} [opts.revision_id='current'] - 补丁版本号 (默认当前最新 revision)
   */
  async getChangeDiff(opts) {
    opts = opts || {};
    const changeId = String(opts.change_id || '').trim();
    if (!changeId) throw new Error('缺少必要参数: change_id');
    const rev = (opts.revision_id || 'current').trim();
    const filePath = (opts.file_path || '').trim();

    if (filePath) {
      // 1. 获取单个文件的结构化 Diff
      const endpoint = `/changes/${encodeURIComponent(changeId)}/revisions/${encodeURIComponent(rev)}/files/${encodeURIComponent(filePath)}/diff`;
      const diffData = await this._httpGet(endpoint);
      return {
        changeId,
        filePath,
        revision: rev,
        type: 'file_diff',
        meta: {
          changeType: diffData.change_type,
          diffHeader: diffData.diff_header
        },
        content: diffData.content || []
      };
    } else {
      // 2. 获取整个 Change 的标准 Git Unified Patch (Base64 解码)
      const endpoint = `/changes/${encodeURIComponent(changeId)}/revisions/${encodeURIComponent(rev)}/patch`;
      const rawBase64 = await this._httpGet(endpoint);
      let patchText = '';
      try {
        patchText = Buffer.from(String(rawBase64).trim(), 'base64').toString('utf8');
      } catch (e) {
        patchText = String(rawBase64);
      }

      return {
        changeId,
        revision: rev,
        type: 'unified_patch',
        patch: patchText
      };
    }
  }

  /**
   * 获取变更下的评审评论与讨论 (Get Comments)
   * @param {string|number} changeId
   */
  async getChangeComments(changeId) {
    if (!changeId) throw new Error('缺少必要参数: changeId');
    const cleanId = String(changeId).trim();

    const commentsMap = await this._httpGet(`/changes/${encodeURIComponent(cleanId)}/comments`);
    const result = [];
    if (commentsMap && typeof commentsMap === 'object') {
      for (const [file, items] of Object.entries(commentsMap)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            result.push({
              file,
              line: item.line,
              range: item.range,
              author: item.author?.name || item.author?.username || 'Reviewer',
              message: item.message,
              updated: item.updated
            });
          }
        }
      }
    }
    return {
      changeId: cleanId,
      totalComments: result.length,
      comments: result
    };
  }

  /**
   * 列出 Gerrit 中的 Git 仓库工程 (List Projects)
   * @param {Object} [opts]
   * @param {string} [opts.query] - 项目名过滤前缀
   * @param {number} [opts.limit=25] - 上限
   */
  async listProjects(opts) {
    opts = opts || {};
    const limit = Math.min(Math.max(1, parseInt(opts.limit || '25', 10)), 50);
    const u = new URL(`${this.baseUrl}/projects/`);
    u.searchParams.set('d', ''); // 包含描述
    u.searchParams.set('n', String(limit));
    if (opts.query) {
      u.searchParams.set('p', opts.query.trim());
    }

    const projectsObj = await this._httpGet(`/projects/?${u.searchParams.toString()}`);
    const list = [];
    if (projectsObj && typeof projectsObj === 'object') {
      for (const [name, meta] of Object.entries(projectsObj)) {
        list.push({
          id: meta.id || name,
          name,
          state: meta.state || 'ACTIVE',
          description: meta.description || ''
        });
      }
    }
    return list;
  }
}

// ---- 格式化输出函数 (供 Agent 对话自然阅读) ----

function _gerritFmtChanges(res) {
  const { query, total, changes } = res;
  if (!total) {
    return `🔍 在 Gerrit 中检索表达式「${query}」未找到任何匹配变更。\n💡 建议检查搜索条件，如：\`status:open\`、\`project:xxx\`、\`commit:xxx\` 或提供更精确的关键词。`;
  }

  const baseUrl = (res.baseUrl || 'http://192.168.1.17:8090').replace(/\/+$/, '');
  const lines = [
    `### 🔍 Gerrit 代码变更检索结果:「${query}」`,
    `- **匹配统计**: 共检索到 **${total}** 条变更记录：`,
    ''
  ];

  changes.forEach((c, idx) => {
    const statusEmoji = c.status === 'MERGED' ? '✅' : (c.status === 'NEW' ? '🟡' : '⚪');
    const changeUrl = `${baseUrl}/#/c/${c.number}/`;
    lines.push(`${idx + 1}. ${statusEmoji} **[#${c.number}](${changeUrl})**: ${c.subject}`);
    lines.push(`   - **工程/分支**: \`${c.project}\` (\`${c.branch}\`) | **提交者**: ${c.owner}`);
    lines.push(`   - **变更量**: +${c.insertions} / -${c.deletions} 行 | **更新时间**: ${c.updated.slice(0, 16)}`);
    if (c.commitMessage) {
      const firstLine = c.commitMessage.split('\n')[0];
      if (firstLine && firstLine !== c.subject) {
        lines.push(`   - *Commit*: \`${firstLine.slice(0, 80)}\``);
      }
    }
  });

  lines.push('');
  lines.push('💡 **下一步建议**：可以使用 `gerrit_get_change` 传入变更号查看完整说明，或使用 `gerrit_get_diff` 查看修改的代码 Diff。');
  return lines.join('\n');
}

function _gerritFmtChangeDetail(d) {
  const baseUrl = (d.baseUrl || 'http://192.168.1.17:8090').replace(/\/+$/, '');
  const changeUrl = `${baseUrl}/#/c/${d.number}/`;
  const lines = [
    `### 📋 Gerrit 变更详情: [#${d.number}](${changeUrl}) - ${d.subject}`,
    `- **状态**: \`${d.status}\` | **工程**: \`${d.project}\` | **分支**: \`${d.branch}\``,
    `- **提交者**: ${d.owner} | **更新时间**: ${d.updated}`,
    `- **变更规模**: 增加 ${d.insertions} 行, 删除 ${d.deletions} 行`,
    ''
  ];

  if (d.reviewers && d.reviewers.length > 0) {
    lines.push(`- **审查人员**: ${d.reviewers.join(', ')}`);
  }

  // 评审评分状态 (Code-Review / Verified)
  if (d.labels && Object.keys(d.labels).length > 0) {
    lines.push('- **评审打分 (只读查阅)**:');
    for (const [label, info] of Object.entries(d.labels)) {
      const score = info.approved ? '+2' : (info.value ? (info.value > 0 ? `+${info.value}` : info.value) : '0');
      lines.push(`  - \`${label}\`: ${score}`);
    }
  }

  // 历史流转动态
  if (d.messages && d.messages.length > 0) {
    lines.push('');
    lines.push('**评审时间线动态**:');
    d.messages.slice(-5).forEach(m => {
      lines.push(`> **${m.author}** (${m.date.slice(5, 16)}): ${m.message.trim().replace(/\n+/g, ' ')}`);
    });
  }

  lines.push('');
  lines.push('💡 **下一步建议**：可以使用 `gerrit_get_diff` 传入 `change_id: "${d.number}"` 查看具体代码补丁 Diff。');
  return lines.join('\n');
}

function _gerritFmtDiff(res) {
  if (res.type === 'unified_patch') {
    return [
      `### 📝 Gerrit 代码补丁 (Unified Patch): Change #${res.changeId}`,
      '```diff',
      res.patch.length > 15000 ? `${res.patch.slice(0, 15000)}\n\n... (Diff 过长，已截断显示前 15000 字符，可指定 file_path 查看具体单文件)` : res.patch,
      '```'
    ].join('\n');
  }

  // 单文件 diff
  const lines = [
    `### 📝 Gerrit 文件 Diff: \`${res.filePath}\` (Change #${res.changeId})`,
    '```diff'
  ];

  (res.content || []).forEach(block => {
    if (block.ab) {
      block.ab.forEach(l => lines.push(` ${l}`));
    }
    if (block.a) {
      block.a.forEach(l => lines.push(`-${l}`));
    }
    if (block.b) {
      block.b.forEach(l => lines.push(`+${l}`));
    }
  });
  lines.push('```');
  return lines.join('\n');
}

function _gerritFmtComments(res) {
  if (!res.totalComments) {
    return `💬 Change #${res.changeId} 暂无行内评审评论 (Inline Comments)。`;
  }

  const lines = [
    `### 💬 Gerrit 评审评论 (共 ${res.totalComments} 条) - Change #${res.changeId}`,
    ''
  ];

  res.comments.forEach((c, idx) => {
    lines.push(`${idx + 1}. **\`${c.file}\`**${c.line ? ` (第 ${c.line} 行)` : ''} · **${c.author}** (${c.updated.slice(5, 16)}):`);
    lines.push(`   > ${c.message.trim()}`);
  });

  return lines.join('\n');
}

function _gerritFmtProjects(projects) {
  if (!projects.length) {
    return '📁 未检索到 Gerrit 项目仓库。若该 Gerrit 实例开启了严格权限限制，请在设置中配置有效账号密码凭证。';
  }

  const lines = [
    `### 📁 Gerrit 代码仓库清单 (共 ${projects.length} 个):`,
    ''
  ];

  projects.forEach((p, idx) => {
    lines.push(`${idx + 1}. **\`${p.name}\`**${p.description ? ` - ${p.description}` : ''}`);
  });

  return lines.join('\n');
}

// 统一的只读工具分发器
async function runGerritTool(name, args, service) {
  args = args || {};
  const svc = service || new GerritService();

  switch (name) {
    case 'gerrit_search_changes': {
      const res = await svc.searchChanges(args);
      return _gerritFmtChanges(res);
    }
    case 'gerrit_get_change': {
      const cid = args.change_id || args.id || args.number;
      const res = await svc.getChangeDetail(cid);
      return _gerritFmtChangeDetail(res);
    }
    case 'gerrit_get_diff': {
      const res = await svc.getChangeDiff(args);
      return _gerritFmtDiff(res);
    }
    case 'gerrit_get_comments': {
      const cid = args.change_id || args.id || args.number;
      const res = await svc.getChangeComments(cid);
      return _gerritFmtComments(res);
    }
    case 'gerrit_list_projects': {
      const res = await svc.listProjects(args);
      return _gerritFmtProjects(res);
    }
    default:
      throw new Error(`未知的 Gerrit 只读工具: ${name}`);
  }
}

// MCP 工具元数据定义 (只读，严禁任何 review/vote/submit 动作)
const GERRIT_TOOLS = [
  {
    name: 'gerrit_search_changes',
    description: '在公司 Gerrit 代码评审系统中检索变更 (Change)。支持丰富的搜索操作符：status:open (开启中), status:merged (已合入), project:xxx, branch:xxx, owner:xxx, commit:xxx, message:xxx, 或综合关键字。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gerrit 检索表达式 (如 status:open project:kernel, 或 charger, 或 commit:6a8f12)'
        },
        limit: {
          type: 'number',
          description: '返回结果数量上限，默认 15，最多 30'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'gerrit_get_change',
    description: '查阅指定 Gerrit 变更 (Change) 的完整详情。包括提交主题、分支、状态、提交人、审查人打分状态、文件修改统计及评审讨论动态。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'Gerrit 变更号 (如 "12345") 或 Triplet (如 "kernel~master~I9e81...")'
        }
      },
      required: ['change_id']
    }
  },
  {
    name: 'gerrit_get_diff',
    description: '查看 Gerrit 变更的代码差异 (Diff / Patch)。可查看整个 Change 的标准 Git Unified Patch，或指定单个文件查看逐行修改。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'Gerrit 变更号 (如 "12345")'
        },
        file_path: {
          type: 'string',
          description: '可选。具体文件路径。若留空则返回整套修改的统一 Git Unified Patch'
        },
        revision_id: {
          type: 'string',
          description: '可选。补丁版本 (默认 "current" 最新版本)'
        }
      },
      required: ['change_id']
    }
  },
  {
    name: 'gerrit_get_comments',
    description: '查阅代码评审人员在指定变更代码行中发表的讨论与审查意见 (Inline Comments)。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'Gerrit 变更号 (如 "12345")'
        }
      },
      required: ['change_id']
    }
  },
  {
    name: 'gerrit_list_projects',
    description: '列出 Gerrit 系统中托管的 Git 项目仓库清单。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '可选。项目名过滤前缀'
        },
        limit: {
          type: 'number',
          description: '最大返回仓库数量，默认 25'
        }
      }
    }
  }
];

module.exports = {
  GerritService,
  GERRIT_TOOLS,
  DEFAULT_GERRIT_BASE_URL,
  runGerritTool,
  gerritLoadConfig,
  gerritNormalizeBase
};
