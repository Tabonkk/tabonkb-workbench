/* ==========================================================================
   Workbench Context — DSH MCP 子进程的只读工作台上下文与本地工程工具
   背景: dsh-mcp-client spawn stdio 子进程时 scrub 掉 DSH_* 与含敏感名的 env,
   唯一可靠宿主标记是条目 config.env 注入的 TABONKB_MCP_HOST=dsh。
   active-context.json 是跨进程唯一通道, 但 pi 侧也会写同文件(无 source 字段),
   因此非 DSH 宿主一律不得读文件取默认值。
   供: mcp/workbench-mcp.js (stdio), gerrit-service/jira-service (绑定默认值)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

// 过滤器中文名 (与 dsh-daemon-manager / pi-drawer-view 同款口径)
const DSH_GERRIT_FILTER_LABELS = { all: '全部', open: '开放中', merged: '已合入', mine: '我提交', reviewing: '待我审' };

function isDshHost() {
  try { return process.env.TABONKB_MCP_HOST === 'dsh'; } catch (_) { return false; }
}

function wbReadJsonSafe(p) {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  } catch (_) {
    return null;
  }
}

function wbResolvePluginDir() {
  const cands = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname),
    path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench'
  ];
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'data.json'))) return c;
  }
  return cands[0];
}

function wbActiveContextPath() {
  const override = process.env.TABONKB_ACTIVE_CONTEXT_FILE;
  if (override) return override;
  return path.join(wbResolvePluginDir(), 'active-context.json');
}

// 延迟加载 local-project-service: bundle 内为全局函数, 独立进程按路径探测
function wbLoadLocalProjectService() {
  try {
    if (typeof getAllAvailableLocalProjects === 'function') {
      return { getAllAvailableLocalProjects, resolveEffectiveFile };
    }
    const cands = [
      path.join(__dirname, 'local-project-service.js'),
      path.join(__dirname, 'services', 'local-project-service.js'),
      path.join(__dirname, '..', 'services', 'local-project-service.js'),
      path.join(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench', 'services', 'local-project-service.js'),
      'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/local-project-service.js'
    ];
    for (const c of cands) {
      let m = null;
      try { if (fs.existsSync(c)) m = require(c); } catch (_) {}
      if (m && typeof m.getAllAvailableLocalProjects === 'function') return m;
    }
  } catch (_) {}
  return null;
}

/**
 * 读取并规范化 active-context.json。
 * 仅 DSH 宿主可读; 且文件必须是 DSH 侧所写 (source === 'dsh') —— pi 抽屉覆写
 * 同文件但不带 source, 视为未绑定而非本 surface 的值, 一律返回 null。
 * 未绑定项: opengrok 'auto' / gerrit 'all' / jira null / localProject null。
 */
function readLiveContext() {
  if (!isDshHost()) return null;
  const j = wbReadJsonSafe(wbActiveContextPath());
  if (!j || typeof j !== 'object') return null;
  if (j.source !== 'dsh') return null;
  return {
    opengrok: (typeof j.selectedProject === 'string' && j.selectedProject) ? j.selectedProject : 'auto',
    gerrit: (typeof j.selectedGerritFilter === 'string' && j.selectedGerritFilter) ? j.selectedGerritFilter : 'all',
    jira: (j.selectedJiraIssue && j.selectedJiraIssue.key) ? j.selectedJiraIssue : null,
    localProject: (j.selectedLocalProject && typeof j.selectedLocalProject === 'object' && j.selectedLocalProject.id) ? j.selectedLocalProject : null,
    source: j.source || null,
    sid: j.sid || null,
    updatedAt: j.updatedAt || null
  };
}

/**
 * 把 active-context 中可能残缺的 selectedLocalProject 回查为完整工程记录。
 * 完整记录判定: 有 fullPathWin 且 priDriverRel; 否则按 id -> server/workspace/platform/project
 * 到 getAllAvailableLocalProjects() 回查; 仍失败时若自带 fullPathWin 则补默认 rel 兜底
 * (仅作后备, 不弱化正常回查路径)。
 */
function resolveLocalProjectBinding(lp) {
  if (!lp || typeof lp !== 'object') return null;
  if (lp.fullPathWin && lp.priDriverRel) return lp;
  const svc = wbLoadLocalProjectService();
  let list = [];
  try { list = (svc && svc.getAllAvailableLocalProjects()) || []; } catch (_) {}
  let hit = null;
  if (lp.id) hit = list.find(p => p.id === lp.id) || null;
  if (!hit && (lp.platform || lp.project)) {
    hit = list.find(p =>
      (!lp.serverId || p.serverId === lp.serverId) &&
      (!lp.serverName || p.serverName === lp.serverName) &&
      (!lp.workspaceName || p.workspaceName === lp.workspaceName) &&
      (!lp.workspaceId || p.workspaceId === lp.workspaceId) &&
      (!lp.platform || p.platform === lp.platform) &&
      (!lp.project || p.project === lp.project)) || null;
  }
  if (hit) return hit;
  // 后备钩子: ctx 自带 fullPathWin/platform/project 但回查无果 (如离屏测试树)
  if (lp.fullPathWin && lp.platform && lp.project) {
    return Object.assign({
      priDriverRel: `pri_project/driver/${lp.platform}/${lp.project}/base`,
      publicDriverRel: 'pri_project/driver/public'
    }, lp);
  }
  return lp;
}

/**
 * DSH 宿主的当前绑定视图; 非 DSH 宿主返回 null。
 * localProject 已回查为完整工程记录 (可行时)。
 */
function getHostContext() {
  if (!isDshHost()) return null;
  const ctx = readLiveContext() || { opengrok: 'auto', gerrit: 'all', jira: null, localProject: null, source: null, sid: null, updatedAt: null };
  if (ctx.localProject) ctx.localProject = resolveLocalProjectBinding(ctx.localProject);
  return ctx;
}

/** 工作台 Gerrit 过滤器 -> Gerrit 查询表达式; all/未知 -> '' */
function gerritFilterToQuery(filterId) {
  switch (String(filterId || '').trim()) {
    case 'open': return 'status:open';
    case 'merged': return 'status:merged';
    case 'mine': return 'owner:self';
    case 'reviewing': return 'reviewer:self status:open';
    default: return '';
  }
}

function gerritFilterLabel(filterId) {
  return DSH_GERRIT_FILTER_LABELS[String(filterId || '').trim()] || String(filterId || 'all');
}

/* ============================ 只读工具实现 ============================ */

function _wbCtxText(ctx) {
  const lines = ['### 工作台会话绑定 (DSH)'];
  lines.push(`- OpenGrok 工程: ${ctx.opengrok && ctx.opengrok !== 'auto' ? '`' + ctx.opengrok + '`' : '未绑定 (auto)'}`);
  lines.push(`- Gerrit 过滤器: ${ctx.gerrit && ctx.gerrit !== 'all' ? `${gerritFilterLabel(ctx.gerrit)} (${ctx.gerrit})` : '未绑定 (all)'}`);
  const j = ctx.jira;
  lines.push(`- Jira 工单: ${j ? '`' + j.key + '` ' + (j.summary || '') + ` [${[j.status, j.priority].filter(Boolean).join(' · ')}]` + (j.assignee ? ` (经办: ${j.assignee})` : '') : '未绑定'}`);
  const lp = ctx.localProject;
  if (lp) {
    lines.push(`- 本地工程: **${lp.label || lp.id}** (${lp.serverName || ''})`);
    lines.push(`  - id: \`${lp.id || ''}\` | workspaceName: ${lp.workspaceName || ''} | platform: ${lp.platform || ''} | project: ${lp.project || ''}`);
    lines.push(`  - linuxPath: \`${lp.linuxPath || '(未知)'}\``);
    if (lp.linuxPath && lp.priDriverRel) lines.push(`  - 项目层 (客制化, 优先): \`${lp.linuxPath}/${lp.priDriverRel}\``);
    if (lp.linuxPath && lp.publicDriverRel) lines.push(`  - 公共层 (公司差分): \`${lp.linuxPath}/${lp.publicDriverRel}\``);
    lines.push('  - 其余相对路径按原厂基线解析 (基线只读, 禁止直接修改)');
  } else {
    lines.push('- 本地工程: 未绑定');
  }
  const age = ctx.updatedAt ? Math.max(0, Math.round((Date.now() - ctx.updatedAt) / 1000)) : null;
  lines.push(`- 会话: sid=${ctx.sid || '(无)'} | updatedAt=${ctx.updatedAt || '(无)'}${age !== null ? ` (距今 ${age}s)` : ''}`);
  lines.push('');
  lines.push('绑定值来自工作台当前所选会话; 若同时运行多个会话, 调用 project_* 工具时请显式传 project 参数。');
  return lines.join('\n');
}

async function runWorkbenchTool(name, args) {
  args = args || {};
  switch (name) {
    case 'workbench_context': {
      if (!isDshHost()) {
        return { text: '当前进程不是 DSH MCP 宿主 (缺少 TABONKB_MCP_HOST=dsh), 无工作台会话绑定可取。', isError: true };
      }
      return { text: _wbCtxText(getHostContext()), isError: false };
    }
    case 'project_list': {
      const svc = wbLoadLocalProjectService();
      if (!svc) return { text: '未能加载 local-project-service 模块。', isError: true };
      let list = [];
      try { list = svc.getAllAvailableLocalProjects() || []; } catch (e) {
        return { text: `工程列表获取失败: ${e.message}`, isError: true };
      }
      const q = String(args.query || '').trim().toLowerCase();
      if (q) {
        list = list.filter(p => [p.id, p.label, p.platform, p.project, p.serverName, p.workspaceName]
          .some(v => String(v || '').toLowerCase().includes(q)));
      }
      const limit = Math.min(Math.max(1, parseInt(args.limit || '20', 10) || 20), 50);
      const shown = list.slice(0, limit);
      if (!shown.length) return { text: `未检索到本地工程${q ? ` (query="${args.query}")` : ''}。`, isError: false };
      const lines = [`### 可用本地工程 (共 ${list.length} 个, 显示 ${shown.length} 个):`, ''];
      shown.forEach((p, i) => {
        lines.push(`${i + 1}. \`${p.id}\`  **${p.label}**  — ${p.serverName} · ${p.platform}/${p.project}`);
      });
      lines.push('', 'project_read_file 的 project 参数请填上面反引号内的 id。');
      return { text: lines.join('\n'), isError: false };
    }
    case 'project_read_file': {
      const filePath = String(args.file_path || '').trim();
      if (!filePath) return { text: '缺少 file_path 参数。', isError: true };
      // 路径穿越防线: 仅允许工程内相对路径 ('..' 段/盘符/UNC/NUL 一律拒绝)
      if (filePath.includes('\0') || /^[A-Za-z]:/.test(filePath) || /^\\\\/.test(filePath) || /^\/\//.test(filePath) ||
          filePath.split(/[\\/]/).includes('..')) {
        return { text: 'file_path 必须是工程内相对路径 (不允许 .. 或绝对路径)', isError: true };
      }
      const svc = wbLoadLocalProjectService();
      if (!svc) return { text: '未能加载 local-project-service 模块。', isError: true };

      let proj = null;
      let source = '';
      const pid = String(args.project || '').trim();
      if (pid) {
        let list = [];
        try { list = svc.getAllAvailableLocalProjects() || []; } catch (_) {}
        proj = list.find(p => p.id === pid) || null;
        if (!proj) {
          return { text: `未找到工程 "${pid}"。请先用 project_list 查看可用工程 id 后再显式传入。`, isError: true };
        }
        source = '显式参数';
      } else {
        const ctx = getHostContext();
        proj = ctx && ctx.localProject;
        if (!proj) {
          return { text: '未指定 project 且工作台当前无绑定本地工程。请先调用 workbench_context 或 project_list 取工程 id 后显式传入。', isError: true };
        }
        source = '工作台当前绑定';
      }

      const res = svc.resolveEffectiveFile(proj, filePath);
      if (!res || !res.fullPath || !fs.existsSync(res.fullPath)) {
        return { text: `在工程 ${proj.label || proj.id} 的项目层、公共层和基线层均未找到文件: ${filePath}`, isError: true };
      }

      try {
        const content = fs.readFileSync(res.fullPath, 'utf8');
        const lines = content.split('\n');
        const sLine = Math.max(1, parseInt(args.start_line || '1', 10) || 1);
        let eLine;
        let truncNote = '';
        if (args.end_line) {
          eLine = Math.min(lines.length, parseInt(args.end_line, 10) || lines.length);
        } else {
          eLine = Math.min(lines.length, sLine - 1 + 2000);
          if (eLine < lines.length) truncNote = ` (未指定 end_line, 按上限截取前 2000 行, 总行数 ${lines.length})`;
        }
        const sliced = lines.slice(sLine - 1, eLine).map((l, idx) => `${sLine + idx}: ${l}`).join('\n');
        const header = [
          '[源码文件解析成功]',
          `- 工程: ${proj.label || proj.id} (${proj.serverName || ''}) [来源: ${source}]`,
          ...(source === '工作台当前绑定' ? ['- 提示: 未显式指定 project; 若同时运行多个会话, 请先 workbench_context 取 id 后显式传入'] : []),
          `- 生效层级: ${res.tierName}`,
          `- 实际物理路径: ${res.fullPath}`,
          `- 覆盖状态: ${res.isOverride ? '⚠️ 该文件在 pri_project/driver 中进行了客制化覆写 (以当前客制化为最终生效准则)' : '使用原厂 baseline 源码 (只读)'}`,
          `- 行号区间: [${sLine} - ${eLine}] (共 ${lines.length} 行)${truncNote}`,
          ''
        ].join('\n');
        return { text: header + sliced, isError: false };
      } catch (err) {
        return { text: `读取文件失败: ${err.message}`, isError: true };
      }
    }
    default:
      throw new Error(`未知的 workbench 工具: ${name}`);
  }
}

const WORKBENCH_TOOLS = [
  {
    name: 'workbench_context',
    description: '读取工作台当前会话绑定的实时上下文：OpenGrok 圈定工程、Gerrit 过滤器、Jira 工单、本地工程（含三层源码目录的 linux 绝对路径）。绑定值随 UI 选择实时变化，需要当前绑定先调本工具。只读工具。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'project_list',
    description: '列出全部可用本地源码工程（id/label/服务器/平台/机型），供挑选 project_read_file 的 project 参数。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '可选。按 id/label/platform/project 子串过滤' },
        limit: { type: 'number', description: '最大返回数量，默认 20，最多 50' }
      }
    }
  },
  {
    name: 'project_read_file',
    description: '按【项目专属层 priDriverRel > 公司公共层 publicDriverRel > 原厂基线】逆向穿透规则读取本地工程实际生效的源码文件，带行号。project 缺省时取工作台当前绑定工程；多会话并行时建议显式传 project (id 见 project_list / workbench_context)。只读工具，基线层禁止修改。',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '源码相对路径，如 drivers/misc/mediatek/typec/tcpc/tcpc.c 或 cust_charger.dtsi' },
        project: { type: 'string', description: '可选。工程 id (见 project_list / workbench_context)；缺省取工作台当前绑定' },
        start_line: { type: 'number', description: '起始行号 (1-based，默认 1)' },
        end_line: { type: 'number', description: '结束行号 (1-based)；缺省时最多返回 2000 行' }
      },
      required: ['file_path']
    }
  }
];

module.exports = {
  isDshHost,
  readLiveContext,
  getHostContext,
  gerritFilterToQuery,
  gerritFilterLabel,
  resolveLocalProjectBinding,
  wbResolvePluginDir,
  wbActiveContextPath,
  wbLoadLocalProjectService,
  runWorkbenchTool,
  WORKBENCH_TOOLS,
  DSH_GERRIT_FILTER_LABELS
};
