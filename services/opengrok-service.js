/* ==========================================================================
   OpenGrok Service — 企业内网代码搜索引擎 (OpenGrok) 客户端与工具适配
   复用入口:
   - extensions/opengrok-portal.ts (Pi Coding Agent 原生扩展)
   - mcp/opengrok-mcp.js          (Hermes CLI stdio JSON-RPC MCP Server)
   - components/explore-view.js   (工作台 UI 界面可选调用)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// 企业 OpenGrok 默认服务配置
const DEFAULT_OPENGROK_BASE_URL = 'http://192.168.1.12:7080/source';
const DEFAULT_OPENGROK_PROJECT = 'W_sprd_os_dev';

function opengrokReadJsonSafe(p) {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  } catch (e) {
    return null;
  }
}

function opengrokResolvePluginDir() {
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

function opengrokNormalizeBase(u) {
  u = (u || '').trim().replace(/\/+$/, '');
  if (!u) return DEFAULT_OPENGROK_BASE_URL;
  if (!u.endsWith('/source')) {
    u = u + '/source';
  }
  return u;
}

function opengrokLoadConfig(override) {
  override = override || {};
  const dir = opengrokResolvePluginDir();
  const data = opengrokReadJsonSafe(path.join(dir, 'data.json')) || {};
  const og = (data && data.opengrok) || {};
  const baseUrl = opengrokNormalizeBase(override.baseUrl || process.env.OPENGROK_BASE_URL || og.baseUrl || DEFAULT_OPENGROK_BASE_URL);
  const defaultProject = (override.defaultProject || process.env.OPENGROK_DEFAULT_PROJECT || og.defaultProject || DEFAULT_OPENGROK_PROJECT).trim();
  const staticDefault = (og.defaultProject || DEFAULT_OPENGROK_PROJECT).trim();
  const timeoutMs = parseInt(override.timeout || og.timeout || '15000', 10);
  return { baseUrl, defaultProject, staticDefault, timeoutMs };
}

// 工作台实时上下文: <插件目录>/active-context.json 由 UI 选择在每次变更时落盘,
// 进程级 env (spawn 快照) 可能滞后 —— 文件值 (selectedProject 非 'auto') 优先。
function opengrokReadActiveContext(dir) {
  try {
    // 测试/特殊部署可用 env 显式指定文件路径
    const override = process.env.TABONKB_ACTIVE_CONTEXT_FILE;
    if (override) {
      const j = opengrokReadJsonSafe(override);
      return (j && typeof j === 'object') ? j : null;
    }
    const d = dir || opengrokResolvePluginDir();
    const ac = opengrokReadJsonSafe(path.join(d, 'active-context.json'));
    return (ac && typeof ac === 'object') ? ac : null;
  } catch (_) { return null; }
}

// 平台/业务关键词别名字典映射表
const OPENGROK_PROJECT_ALIASES = [
  { keywords: ['sprd', '展锐', '展讯', 'unisoc', '紫光展锐'], project: 'W_sprd_os_dev' },
  { keywords: ['v_sprd', 'v展锐'], project: 'V_sprd_os_dev' },
  { keywords: ['mtk', '联发科', 'mp1', 'mediatek'], project: 'W_mp1_os_dev' },
  { keywords: ['a17', 'a17_mp1'], project: 'A17_mp1_os_dev' },
  { keywords: ['aselsan', 'a16'], project: 'Aselsan_release_A16_1.57' },
  { keywords: ['aiot', 'iot'], project: 'S_U_aiot_oversea_release' },
  { keywords: ['t_u_mp1', 'tu_mp1'], project: 'T_U_mp1_oversea_release' },
  { keywords: ['t_u_sprd', 'tu_sprd'], project: 'T_U_sprd_oversea_release' },
  { keywords: ['oversea', '海外'], project: 'V_oversea_release' }
];

class OpengrokService {
  constructor(cfg) {
    cfg = cfg || opengrokLoadConfig();
    this.baseUrl = cfg.baseUrl || DEFAULT_OPENGROK_BASE_URL;
    this.defaultProject = cfg.defaultProject || DEFAULT_OPENGROK_PROJECT;
    this.staticDefault = cfg.staticDefault || DEFAULT_OPENGROK_PROJECT;
    this.timeoutMs = cfg.timeoutMs || 15000;
    this._cachedProjects = null;
    this._cacheTime = 0;
  }

  isConfigured() {
    return !!this.baseUrl;
  }

  async _httpGet(endpoint, customTimeout) {
    const fullUrl = this.baseUrl + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
    const timeout = customTimeout || this.timeoutMs;

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

    try {
      const res = await fetchFn({
        url: fullUrl,
        method: 'GET',
        headers: {
          'User-Agent': 'TabonKB-Workbench/1.2 (OpenGrokClient)'
        },
        timeout
      });
      return {
        status: res.status,
        headers: res.headers || {},
        body: res.body || res.text || ''
      };
    } catch (err) {
      throw new Error(`连接 OpenGrok 失败 (${this.baseUrl}): ${err.message}`);
    }
  }

  // 1. 获取所有项目列表 (自动从 index.jsp 提取并缓存 10 分钟)
  async listProjects(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this._cachedProjects && (now - this._cacheTime < 600000)) {
      return this._cachedProjects;
    }

    try {
      const res = await this._httpGet('/');
      if (res.status >= 200 && res.status < 300) {
        const matches = [...res.body.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/g)].map(m => m[1]);
        const set = new Set();
        // 排除通用语言过滤器选项 (ada, asm, bzip2, c, cxx, 等)
        const langNoise = new Set(['ada', 'asm', 'bzip2', 'c', 'clojure', 'csharp', 'cxx', 'eiffel', 'elf', 'erlang', 'file', 'fortran', 'golang', 'gzip', 'haskell', 'hcl', 'jar', 'java', 'javaclass', 'javascript', 'json', 'kotlin', 'lisp', 'lua', 'man', 'pascal', 'perl', 'php', 'plaintext', 'plsql', 'powershell', 'python', 'r', 'ruby', 'rust', 'scala', 'sh', 'sql', 'swift', 'tar', 'tcl', 'terraform', 'troff', 'typescript', 'uuencoded', 'vb', 'verilog', 'xml', 'yaml', 'zip']);

        for (const m of matches) {
          const val = m.trim();
          if (val && !langNoise.has(val.toLowerCase())) {
            set.add(val);
          }
        }

        const list = Array.from(set);
        if (list.length > 0) {
          this._cachedProjects = list;
          this._cacheTime = now;
          return list;
        }
      }
    } catch (e) {
      console.warn('[OpenGrokService] Failed to fetch project list, using fallback defaults:', e.message);
    }

    // 默认兜底常用工程
    return [
      'W_sprd_os_dev',
      'V_sprd_os_dev',
      'W_mp1_os_dev',
      'A17_mp1_os_dev',
      'T_U_sprd_oversea_release',
      'T_U_mp1_oversea_release',
      'V_oversea_release',
      'S_U_aiot_oversea_release',
      'Aselsan_release_A16_1.57'
    ];
  }

  // 实时生效的圈定工程:
  // - DSH MCP 子进程侧 (TABONKB_MCP_HOST=dsh 标记; DSH_* env 已被 scrub 故不能用):
  //   env 是 daemon spawn 快照可能滞后, active-context.json 由 UI 每次变更落盘为活值
  //   —— 文件优先, 'auto'=未绑定回退静态默认;
  // - pi 扩展/宿主侧: env 是本进程自身会话的权威快照 (pi 会话或 UI 最近镜像), 文件可能
  //   被另一 surface 覆写 —— env 优先, 不回读文件。
  _effDefaultProject() {
    try {
      if (process.env.TABONKB_MCP_HOST === 'dsh') {
        const ac = opengrokReadActiveContext();
        // 只采信 DSH 侧落盘的文件 (source:'dsh'); pi 侧覆写无 source, 不当本 surface 绑定
        if (ac && ac.source === 'dsh') {
          const p = ac.selectedProject;
          if (p && p !== 'auto') return String(p);
          if ('selectedProject' in ac) return this.staticDefault;
        }
      }
      return process.env.OPENGROK_DEFAULT_PROJECT || this.defaultProject;
    } catch (_) {
      return this.defaultProject;
    }
  }

  // 2. 智能工程推断 (根据提示词/别名解析出最适合的 project 参数)
  inferProjects(hint) {
    if (!hint || typeof hint !== 'string') {
      return [this._effDefaultProject() || 'W_sprd_os_dev'];
    }
    const clean = hint.trim().toLowerCase();

    // 显式匹配完整工程名
    const all = this._cachedProjects || [];
    for (const p of all) {
      if (p.toLowerCase() === clean) return [p];
    }

    // 关键词别名映射
    const matched = [];
    for (const rule of OPENGROK_PROJECT_ALIASES) {
      for (const kw of rule.keywords) {
        if (clean.includes(kw.toLowerCase())) {
          if (!matched.includes(rule.project)) matched.push(rule.project);
        }
      }
    }

    return matched.length > 0 ? matched : [this._effDefaultProject() || 'W_sprd_os_dev'];
  }

  // 3. 核心检索接口 (支持全文 full、符号定义 defs、引用 refs、文件路径 path)
  async searchCode(params) {
    params = params || {};
    const query = (params.query || '').trim();
    if (!query) throw new Error('Search query cannot be empty');

    const type = ['full', 'defs', 'refs', 'path', 'hist'].includes(params.type) ? params.type : 'full';
    let targetProjects = [];

    if (params.project) {
      if (Array.isArray(params.project)) {
        targetProjects = params.project;
      } else if (params.project.includes(',')) {
        targetProjects = params.project.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        // 先走别名/工程推断
        targetProjects = this.inferProjects(params.project);
      }
    } else {
      // 尝试根据 query 中的平台词自动推断，推断不出取默认
      targetProjects = this.inferProjects(query);
    }

    const maxResults = Math.min(Math.max(parseInt(params.max_results || '20', 10), 1), 50);

    // 构建 OpenGrok search query
    // /source/search?full=xxx&project=p1&project=p2
    const qs = [`${type}=${encodeURIComponent(query)}`];
    for (const p of targetProjects) {
      qs.push(`project=${encodeURIComponent(p)}`);
    }

    const endpoint = `/search?${qs.join('&')}`;
    const res = await this._httpGet(endpoint);

    if (res.status !== 200) {
      throw new Error(`OpenGrok returned HTTP ${res.status}: ${res.body.slice(0, 200)}`);
    }

    return this._parseSearchResults(res.body, query, type, targetProjects, maxResults);
  }

  // 解析 OpenGrok HTML 搜索结果表格
  _parseSearchResults(html, query, type, targetProjects, maxResults) {
    const results = [];

    // 匹配摘要: Results 1 – 2 of 2
    const summaryMatch = html.match(/Searched\s+<span[^>]*>(.*?)<\/span>\s*\(Results\s*<span[^>]*>([\d\s–-]+)<\/span>\s*of\s*<span[^>]*>(\d+)<\/span>\)/i);
    const totalFound = summaryMatch ? parseInt(summaryMatch[3], 10) : 0;

    const tbodyMatch = html.match(/<tbody class="search-result">([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      return { query, type, projects: targetProjects, totalFound: 0, results: [] };
    }

    const tbodyContent = tbodyMatch[1];
    const rowRegex = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
    let currentDir = '';
    let m;

    while ((m = rowRegex.exec(tbodyContent)) !== null && results.length < maxResults) {
      const trAttr = m[1];
      const trBody = m[2];

      if (trAttr.includes('class="dir"')) {
        const dirMatch = trBody.match(/<a[^>]*href="[^"]*\/xref\/([^"/]+)\/([^"]*)"[^>]*>/i);
        if (dirMatch) currentDir = dirMatch[2] || '';
        continue;
      }

      // 文件匹配行
      const fileMatch = trBody.match(/<td class="f"><a[^>]*href="[^"]*\/xref\/([^"/]+)\/([^"#?]+)[^"]*"[^>]*>(.*?)<\/a>/i);
      const lineMatch = trBody.match(/<span class="l">(\d+)<\/span>\s*([\s\S]*?)<\/a>/i);

      if (fileMatch) {
        const project = fileMatch[1];
        const filePath = fileMatch[2];
        const fileName = fileMatch[3].replace(/<[^>]+>/g, '').trim();
        const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 0;
        let snippet = lineMatch ? lineMatch[2] : '';
        snippet = snippet
          .replace(/<b>(.*?)<\/b>/gi, '**$1**')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/\t/g, '  ')
          .trim();

        results.push({
          project,
          directory: currentDir,
          fileName,
          path: filePath,
          line: lineNum,
          snippet
        });
      }
    }

    return {
      query,
      type,
      projects: targetProjects,
      totalFound: totalFound || results.length,
      results
    };
  }

  // 4. 源码直读 (支持行范围切片与行号呈现)
  async readSourceFile(params) {
    params = params || {};
    const project = (params.project || this._effDefaultProject() || '').trim();
    let filePath = (params.file_path || params.filePath || params.path || '').trim();

    if (!project) throw new Error('Missing project parameter');
    if (!filePath) throw new Error('Missing file_path parameter');

    // 清理路径首尾斜杠及可能重复出现的 project 前缀
    filePath = filePath.replace(/^\/+/, '');
    if (filePath.startsWith(`${project}/`)) {
      filePath = filePath.slice(project.length + 1);
    }

    const startLine = Math.max(parseInt(params.start_line || '1', 10), 1);
    const endLine = Math.max(parseInt(params.end_line || String(startLine + 120), 10), startLine);

    const endpoint = `/raw/${encodeURIComponent(project)}/${filePath}`;
    const res = await this._httpGet(endpoint);

    if (res.status !== 200) {
      throw new Error(`OpenGrok raw file fetch failed (HTTP ${res.status}): ${res.body.slice(0, 150)}`);
    }

    const allLines = res.body.split(/\r?\n/);
    const totalLines = allLines.length;

    const sliceStart = startLine - 1;
    const sliceEnd = Math.min(endLine, totalLines);
    const targetSlice = allLines.slice(sliceStart, sliceEnd);

    // 格式化输出带行号的代码段
    const padLen = String(sliceEnd).length;
    const formattedLines = targetSlice.map((lineText, idx) => {
      const lineNo = sliceStart + idx + 1;
      const numStr = String(lineNo).padStart(padLen, ' ');
      return `${numStr} | ${lineText}`;
    });

    return {
      project,
      filePath,
      startLine,
      endLine: sliceEnd,
      totalLines,
      content: formattedLines.join('\n')
    };
  }

  // 5. 连通性测试
  async testConnection() {
    try {
      const projects = await this.listProjects(true);
      return {
        ok: true,
        baseUrl: this.baseUrl,
        projectsCount: projects.length,
        projects: projects.slice(0, 12)
      };
    } catch (e) {
      return {
        ok: false,
        baseUrl: this.baseUrl,
        error: e.message
      };
    }
  }
}

// 统一的 Agent MCP / Tool 声明定义 (同时提供 inputSchema 与 parameters 保持双向兼容)
const OPENGROK_TOOLS = [
  {
    name: 'opengrok_list_projects',
    label: 'OpenGrok: 列出代码工程',
    description: '列出公司 OpenGrok 代码搜索引擎中所有已索引的手机工程/平台库 (如 W_sprd_os_dev=展锐主线, W_mp1_os_dev=MTK主线等)。在不知道工程名称或需要确定可用项目时先调用此工具。',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'opengrok_search_code',
    label: 'OpenGrok: 搜索代码',
    description: '在公司内网 OpenGrok 中高速检索驱动/内核/框架源码。支持全文(full)、函数定义(defs)、符号引用(refs)及文件路径(path)。可通过 project 指定工程库或输入平台别名(如 展锐/MTK/A17)，留空将自动推断。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '检索关键词、函数名、结构体名、宏定义或文件路径 (如 da9030_battery, charger_probe, i2c_register_driver)'
        },
        type: {
          type: 'string',
          enum: ['full', 'defs', 'refs', 'path', 'hist'],
          description: '检索模式: full (全文检索, 默认), defs (符号/函数定义), refs (符号引用), path (文件名/路径匹配), hist (Git日志)'
        },
        project: {
          type: 'string',
          description: '指定检索工程。支持标准工程名 (如 W_sprd_os_dev, W_mp1_os_dev, A17_mp1_os_dev) 或平台别名 (如 "展锐", "MTK", "A17")，支持逗号分隔多工程联合检索。留空则根据问题自动推断。'
        },
        max_results: {
          type: 'number',
          description: '返回结果数量上限，默认 20 条，最多 50 条'
        }
      },
      required: ['query']
    },
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '检索关键词、函数名、结构体名、宏定义或文件路径 (如 da9030_battery, charger_probe, i2c_register_driver)'
        },
        type: {
          type: 'string',
          enum: ['full', 'defs', 'refs', 'path', 'hist'],
          description: '检索模式: full (全文检索, 默认), defs (符号/函数定义), refs (符号引用), path (文件名/路径匹配), hist (Git日志)'
        },
        project: {
          type: 'string',
          description: '指定检索工程。支持标准工程名 (如 W_sprd_os_dev, W_mp1_os_dev, A17_mp1_os_dev) 或平台别名 (如 "展锐", "MTK", "A17")，支持逗号分隔多工程联合检索。留空则根据问题自动推断。'
        },
        max_results: {
          type: 'number',
          description: '返回结果数量上限，默认 20 条，最多 50 条'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'opengrok_read_file',
    label: 'OpenGrok: 读取源码片段',
    description: '读取 OpenGrok 中指定工程与文件路径的源码内容。支持指定起止行号精准阅读驱动函数实现或配置文件，带行号格式化呈现。',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: '工程项目名 (如 W_sprd_os_dev 或 W_mp1_os_dev)'
        },
        file_path: {
          type: 'string',
          description: '文件在工程内的相对路径 (如 vendor_t/bsp/kernel5.15/drivers/power/supply/da9030_battery.c)'
        },
        start_line: {
          type: 'number',
          description: '起始行号 (从 1 开始，默认 1)'
        },
        end_line: {
          type: 'number',
          description: '结束行号 (默认 start_line + 100 行，单次最多建议读取 200 行避免超长)'
        }
      },
      required: ['project', 'file_path']
    },
    parameters: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: '工程项目名 (如 W_sprd_os_dev 或 W_mp1_os_dev)'
        },
        file_path: {
          type: 'string',
          description: '文件在工程内的相对路径 (如 vendor_t/bsp/kernel5.15/drivers/power/supply/da9030_battery.c)'
        },
        start_line: {
          type: 'number',
          description: '起始行号 (从 1 开始，默认 1)'
        },
        end_line: {
          type: 'number',
          description: '结束行号 (默认 start_line + 100 行，单次最多建议读取 200 行避免超长)'
        }
      },
      required: ['project', 'file_path']
    }
  }
];

// 格式化输出函数 (供 Agent 回复阅读)
function _opengrokFmtProjects(projects) {
  if (!projects || !projects.length) return '未在 OpenGrok 中找到任何工程项目。';
  const lines = [
    `### OpenGrok 已索引代码工程库 (${projects.length} 个):`,
    ''
  ];
  projects.forEach((p, i) => {
    let tag = '';
    if (p.includes('sprd')) tag = ' [📱 紫光展锐]';
    else if (p.includes('mp1') || p.includes('A17')) tag = ' [🚀 联发科 MTK]';
    else if (p.includes('oversea')) tag = ' [🌐 海外发布版]';
    else if (p.includes('aiot')) tag = ' [🤖 AIoT]';
    lines.push(`${i + 1}. \`${p}\`${tag}`);
  });
  lines.push('');
  lines.push('💡 **提示**：可以在 `opengrok_search_code` 中通过 `project` 参数指定上述项目，或直接输入 “展锐” / “MTK” 自动匹配。');
  return lines.join('\n');
}

function _opengrokFmtSearchResults(res) {
  const { query, type, projects, totalFound, results } = res;
  if (!results.length) {
    return `🔍 在工程 [${projects.join(', ')}] 中以模式 \`${type}\` 检索关键词「${query}」未找到匹配结果。\n建议更换更简短的关键词，或使用 opengrok_list_projects 检查工程范围。`;
  }

  const lines = [
    `### 🔍 OpenGrok 代码检索结果:「${query}」`,
    `- **检索模式**: \`${type}\` | **工程范围**: ${projects.map(p => `\`${p}\``).join(', ')}`,
    `- **匹配统计**: 共发现 **${totalFound}** 处匹配，已呈现相关度最高的前 **${results.length}** 项：`,
    ''
  ];

  results.forEach((r, idx) => {
    lines.push(`${idx + 1}. 📄 **\`${r.project}\`** / \`${r.path}\`${r.line ? ` (Line ${r.line})` : ''}`);
    if (r.snippet) {
      lines.push('   ```c');
      lines.push(`   ${r.snippet}`);
      lines.push('   ```');
    }
  });

  lines.push('');
  lines.push('💡 **下一步建议**：可以使用 `opengrok_read_file` 传入对应的 `project` 和 `file_path`，指定行号读取完整的函数实现。');
  return lines.join('\n');
}

function _opengrokFmtFileContent(res) {
  const { project, filePath, startLine, endLine, totalLines, content } = res;
  return [
    `### 📄 源码阅读: \`${project}\` / \`${filePath}\``,
    `- **行数范围**: 第 ${startLine} 行 ~ 第 ${endLine} 行 (全文件共 ${totalLines} 行)`,
    '```c',
    content,
    '```'
  ].join('\n');
}

// 统一的工具调用执行分发器
async function runOpengrokTool(name, args, service) {
  args = args || {};
  const svc = service || new OpengrokService();

  switch (name) {
    case 'opengrok_list_projects': {
      const projects = await svc.listProjects();
      return _opengrokFmtProjects(projects);
    }
    case 'opengrok_search_code': {
      const res = await svc.searchCode(args);
      return _opengrokFmtSearchResults(res);
    }
    case 'opengrok_read_file': {
      const res = await svc.readSourceFile(args);
      return _opengrokFmtFileContent(res);
    }
    default:
      throw new Error(`Unknown OpenGrok tool: ${name}`);
  }
}

module.exports = {
  OpengrokService,
  OPENGROK_TOOLS,
  DEFAULT_OPENGROK_BASE_URL,
  DEFAULT_PROJECT: DEFAULT_OPENGROK_PROJECT,
  DEFAULT_OPENGROK_PROJECT,
  runOpengrokTool,
  loadConfig: opengrokLoadConfig,
  opengrokLoadConfig,
  normalizeBase: opengrokNormalizeBase,
  opengrokNormalizeBase,
  opengrokReadActiveContext
};
