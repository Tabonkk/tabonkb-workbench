/* ==========================================================================
   Workbench Context — DSH MCP 子进程的工作台上下文与本地工程工具
   背景: dsh-mcp-client spawn stdio 子进程时 scrub 掉 DSH_* 与含敏感名的 env,
   唯一可靠宿主标记是条目 config.env 注入的 TABONKB_MCP_HOST=dsh。
   active-context.json 是跨进程唯一通道, 但 pi 侧也会写同文件(无 source 字段),
   因此非 DSH 宿主一律不得读文件取默认值。
   供: mcp/workbench-mcp.js (stdio), gerrit-service/jira-service (绑定默认值)
   P2: project_edit_file / project_compile 写与编译能力, 经 _wbPermGate 挂
   DSH 输入栏权限档 (active-context.json permission 字段, bridge 实时上报):
   仅 readwrite/full 放行; 编译在 readwrite 档仅预置类型+受限参数, full 档任意命令。
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

// 过滤器中文名 (与 dsh-daemon-manager / pi-drawer-view 同款口径)
const DSH_GERRIT_FILTER_LABELS = { all: '全部', open: '开放中', merged: '已合入', mine: '我提交', reviewing: '待我审' };

// 「工作区内修改」档允许的预置编译类型 (非枚举值需「完全权限」档)
const WB_PRESET_BUILD_TYPES = new Set(['driver', 'dtbo', 'dts', 'kernel']);

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
      return {
        getAllAvailableLocalProjects,
        resolveEffectiveFile,
        routeEditTarget,
        buildCompileCommand,
        extractCompilerErrors,
        getWinSshBin,
        safeExistsSync,
        safeReadFileSync,
        safeWriteFileSync
      };
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
    permission: (typeof j.permission === 'string' && j.permission) ? j.permission : null,
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
  const ctx = readLiveContext() || { opengrok: 'auto', gerrit: 'all', jira: null, localProject: null, permission: null, source: null, sid: null, updatedAt: null };
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

/* ==================== 权限档 (DSH 输入栏三档胶囊) ==================== */

// DSH 权限档 → 中文档名 (与 iframe bridge readPermMode 采集口径一致)
function permLabel(p) {
  switch (String(p || '').trim()) {
    case 'readonly': return '仅可查看';
    case 'readwrite': return '工作区内修改';
    case 'full': return '完全权限';
    default: return '未侦测到';
  }
}

/**
 * 写/编译类工具的权限门: 仅 readwrite/full 放行;
 * 'readonly' / 缺失 / 未侦测 → isError 并提示在输入栏切换档位。
 * @returns {{ok:boolean, perm:string|null, ctx:object|null, error?:object}}
 */
function _wbPermGate(toolName) {
  const ctx = getHostContext(); // 非 DSH 宿主为 null → 视同未侦测到权限档
  const perm = (ctx && typeof ctx.permission === 'string' && ctx.permission) ? ctx.permission : null;
  if (perm === 'readwrite' || perm === 'full') return { ok: true, perm, ctx };
  return {
    ok: false,
    perm: null,
    ctx,
    error: {
      text: `${toolName} 被权限档拦截：当前 DSH 权限档为「${permLabel(perm)}」，本工具要求「工作区内修改」或「完全权限」。\n` +
            '请在输入栏把权限档切到「工作区内修改」或「完全权限」后重试。',
      isError: true
    }
  };
}

/* ==================== 远程编译执行器 (可注入点) ==================== */

// 测试注入点: 替换 project_compile 的真实 SSH 执行器 (传 null 复原为真实 spawn)
let _wbCompileRunner = null;
function setWorkbenchCompileRunner(fn) {
  _wbCompileRunner = (typeof fn === 'function') ? fn : null;
}

/**
 * 默认编译执行器: spawn ssh -T -o BatchMode=yes -o ConnectTimeout=20 user@host <cmd>
 * stdout 滚动截 500KB; 600s 超时 kill + taskkill 强杀进程树。
 * @returns {Promise<{ok:boolean, code:number, elapsed:number, stdout:string, stderr:string, timedOut?:boolean, spawnError?:boolean}>}
 */
function _wbSpawnCompile(opts) {
  const svc = opts.svc;
  const proj = opts.proj;
  const cmd = opts.cmd;
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let cp;
    try {
      cp = child_process.spawn(svc.getWinSshBin(), [
        '-T',
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=20',
        `${proj.user}@${proj.sshHost}`,
        cmd
      ], { windowsHide: true });
    } catch (e) {
      return resolve({ ok: false, code: -1, elapsed: 0, stdout: '', stderr: String(e && e.message || e), spawnError: true });
    }
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    };
    if (cp.stdout) cp.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 500000) stdout = stdout.slice(-500000);
    });
    if (cp.stderr) cp.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      try { cp.kill(); } catch (_) {}
      // Windows 下 ssh 进程树用 taskkill 强杀, 避免孤儿进程残留
      try { if (cp.pid) child_process.execSync(`taskkill /PID ${cp.pid} /T /F`, { stdio: 'ignore' }); } catch (_) {}
      finish({ ok: false, code: -1, elapsed: (Date.now() - startTime) / 1000, stdout, stderr, timedOut: true });
    }, 600000);
    cp.on('error', (e) => {
      finish({ ok: false, code: -1, elapsed: (Date.now() - startTime) / 1000, stdout, stderr: String(e && e.message || e), spawnError: true });
    });
    cp.on('close', (code) => {
      finish({ ok: code === 0, code: code || 0, elapsed: (Date.now() - startTime) / 1000, stdout, stderr });
    });
  });
}

/* ============================ 工具实现 ============================ */

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
  lines.push(`- 权限档: ${permLabel(ctx.permission)}${ctx.permission ? ` (${ctx.permission})` : ''}`);
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
    case 'project_edit_file': {
      // 权限闸: 仅「工作区内修改」/「完全权限」放行
      const gate = _wbPermGate('project_edit_file');
      if (!gate.ok) return gate.error;

      const filePath = String(args.file_path || '').trim();
      if (!filePath) return { text: '缺少 file_path 参数。', isError: true };
      // 路径穿越防线 (与 project_read_file 同款: '..' 段/盘符/UNC/NUL 一律拒绝)
      if (filePath.includes('\0') || /^[A-Za-z]:/.test(filePath) || /^\\\\/.test(filePath) || /^\/\//.test(filePath) ||
          filePath.split(/[\\/]/).includes('..')) {
        return { text: 'file_path 必须是工程内相对路径 (不允许 .. 或绝对路径)', isError: true };
      }
      const scope = String(args.scope || 'project').trim();
      if (scope !== 'project' && scope !== 'public') {
        return { text: `scope 仅支持 'project'(默认,当前机型客制化) 或 'public'(公司公共差分), 收到 "${args.scope}"。`, isError: true };
      }
      if (args.target_content === undefined || args.target_content === null || String(args.target_content) === '') {
        return { text: '缺少 target_content 参数 (待替换的精确原代码片段)。', isError: true };
      }
      if (args.replacement_content === undefined || args.replacement_content === null) {
        return { text: '缺少 replacement_content 参数 (可为空串表示删除该片段)。', isError: true };
      }
      const svc = wbLoadLocalProjectService();
      if (!svc) return { text: '未能加载 local-project-service 模块。', isError: true };

      // 工程解析与来源回显 (与 project_read_file 同规则)
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
        proj = gate.ctx && gate.ctx.localProject;
        if (!proj) {
          return { text: '未指定 project 且工作台当前无绑定本地工程。请先调用 workbench_context 或 project_list 取工程 id 后显式传入。', isError: true };
        }
        source = '工作台当前绑定';
      }

      // 安全修改路由: 项目修改 → pri_project/driver/<platform>/<project>/base/,
      // 共性修改 → pri_project/driver/public/; 目标不存在时从生效文件派生, 基线只读永不写入
      try {
        const route = svc.routeEditTarget(proj, filePath, scope);
        if (!route || !route.targetPath || !svc.safeExistsSync(route.targetPath)) {
          return { text: `目标文件无法创建或定位: ${(route && route.targetPath) || filePath}`, isError: true };
        }
        const raw = svc.safeReadFileSync(route.targetPath, 'utf8');
        const targetContent = String(args.target_content);
        if (!raw.includes(targetContent)) {
          return { text: `在文件 ${route.targetRel} 中未找到完全匹配的目标代码片段 (target_content)。请先使用 project_read_file 查看当前最新内容。`, isError: true };
        }
        const bakPath = `${route.targetPath}.bak`;
        svc.safeWriteFileSync(bakPath, raw, 'utf8');
        const updated = raw.replace(targetContent, String(args.replacement_content));
        svc.safeWriteFileSync(route.targetPath, updated, 'utf8');
        const msg = [
          '[代码修改成功]',
          `- 工程: ${proj.label || proj.id} (${proj.serverName || ''}) [来源: ${source}]`,
          ...(source === '工作台当前绑定' ? ['- 提示: 未显式指定 project; 若同时运行多个会话, 请先 workbench_context 取 id 后显式传入'] : []),
          `- 权限档: ${permLabel(gate.perm)}`,
          `- 目标文件: ${route.targetRel}`,
          `- 物理路径: ${route.targetPath}`,
          `- 作用域: ${route.scope === 'project' ? `项目个性化 (${proj.project || ''})` : '公司公共 (public)'}`,
          `- 基线保护: ${route.derivedFromSource ? '已自动从生效文件派生至客制化目录，基线源码保持未污染' : '修改现有客制化文件'}`,
          '- 自动备份: 已生成 .bak 备份文件',
          '- 生效提示: 下次执行 build.sh 编译时将自动覆盖基线生效。'
        ].join('\n');
        return { text: msg, isError: false };
      } catch (err) {
        return { text: `修改异常: ${err.message}`, isError: true };
      }
    }
    case 'project_compile': {
      // 权限闸: 仅「工作区内修改」/「完全权限」放行
      const gate = _wbPermGate('project_compile');
      if (!gate.ok) return gate.error;
      const perm = gate.perm;

      const buildType = String(args.build_type === undefined || args.build_type === null ? 'driver' : args.build_type).trim() || 'driver';
      const extraArgs = (args.extra_args === undefined || args.extra_args === null) ? '' : String(args.extra_args);
      if (perm === 'full') {
        // 「完全权限」档: build_type 可为任意远程命令 (buildCompileCommand 原样拼),
        // extra_args 仅拒换行与 NUL (防止截断拼入下一条命令)
        if (/[\r\n\0]/.test(buildType) || /[\r\n\0]/.test(extraArgs)) {
          return { text: 'build_type/extra_args 不允许包含换行或 NUL 字符。', isError: true };
        }
      } else {
        // 「工作区内修改」档: 仅预置编译类型 + 受限 extra_args (字母数字与 -_.=:/ 空格, ≤80 字符)
        if (!WB_PRESET_BUILD_TYPES.has(buildType)) {
          return {
            text: `当前权限档为「${permLabel(perm)}」，仅允许预置编译类型 driver/dtbo/dts/kernel；自定义远程命令需要「完全权限」档。`,
            isError: true
          };
        }
        if (extraArgs.length > 80 || !/^[-\w .=:\/]*$/.test(extraArgs)) {
          return {
            text: `当前权限档为「${permLabel(perm)}」，extra_args 仅允许字母数字与 -_.=:/ 空格且不超过 80 字符；自定义远程命令需要「完全权限」档。`,
            isError: true
          };
        }
      }

      const svc = wbLoadLocalProjectService();
      if (!svc) return { text: '未能加载 local-project-service 模块。', isError: true };

      // 工程解析与来源回显 (与 project_read_file 同规则)
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
        proj = gate.ctx && gate.ctx.localProject;
        if (!proj) {
          return { text: '未指定 project 且工作台当前无绑定本地工程。请先调用 workbench_context 或 project_list 取工程 id 后显式传入。', isError: true };
        }
        source = '工作台当前绑定';
      }

      const cmd = svc.buildCompileCommand(proj, buildType, extraArgs);
      const runner = _wbCompileRunner || _wbSpawnCompile;
      let r;
      try {
        r = await runner({ svc, proj, cmd });
      } catch (e) {
        r = { ok: false, code: -1, elapsed: 0, stdout: '', stderr: String(e && e.message || e), spawnError: true };
      }
      const elapsed = (typeof r.elapsed === 'number' ? r.elapsed : 0).toFixed(1);
      const head = `- 工程: ${proj.label || proj.id} (${proj.serverName || ''}) [来源: ${source}]\n` +
                   `${source === '工作台当前绑定' ? '- 提示: 未显式指定 project; 若同时运行多个会话, 请先 workbench_context 取 id 后显式传入\n' : ''}` +
                   `- 权限档: ${permLabel(perm)}\n- 命令: ${cmd}\n`;
      const fullOut = String(r.stdout || '') + (r.stderr ? `\n--- STDERR ---\n${r.stderr}` : '');
      if (r.spawnError) {
        return { text: `派生 SSH 进程失败: ${r.stderr || '未知错误'}\n${head}`, isError: true };
      }
      if (r.timedOut) {
        return { text: `[编译超时中断]\n${head}耗时超过 600 秒已强杀`, isError: true };
      }
      if (r.ok) {
        return {
          text: `[✓ 编译成功 (Success)]\n${head}- 退出码: 0\n- 耗时: ${elapsed} 秒\n\n日志摘要:\n${fullOut.slice(-1500)}`,
          isError: false
        };
      }
      const extractedErr = svc.extractCompilerErrors(fullOut);
      return {
        text: `[❌ 编译失败 (Exit Code ${r.code})]\n${head}- 耗时: ${elapsed} 秒\n\n【关键报错提取】:\n${extractedErr}\n\n提示: 请针对上述报错行号排查修复代码后重新执行编译。`,
        isError: true
      };
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
  },
  {
    name: 'project_edit_file',
    description: '修改本地工程代码（要求 DSH 权限档为「工作区内修改」或「完全权限」，「仅可查看」档直接拒绝）。安全目标路由：scope=project 写入 pri_project/driver/<platform>/<project>/base/（目标不存在时自动从生效文件派生），scope=public 写入 pri_project/driver/public/；原厂基线只读永不写入。target_content 必须与现文件精确匹配（先用 project_read_file 取原文），写入前自动生成 .bak 备份。project 缺省取工作台当前绑定工程。',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '工程内相对路径，如 drivers/misc/mediatek/typec/tcpc/tcpc.c' },
        target_content: { type: 'string', description: '待替换的精确原代码片段（必须与文件内容完全一致）' },
        replacement_content: { type: 'string', description: '替换后的新代码片段（空串表示删除该片段）' },
        scope: { type: 'string', description: "可选。'project'(默认,当前机型客制化) 或 'public'(公司公共差分)" },
        project: { type: 'string', description: '可选。工程 id (见 project_list / workbench_context)；缺省取工作台当前绑定' }
      },
      required: ['file_path', 'target_content', 'replacement_content']
    }
  },
  {
    name: 'project_compile',
    description: '在工程所属远程 Linux 服务器执行编译（要求 DSH 权限档非「仅可查看」）。「工作区内修改」档仅允许预置编译类型 driver/dtbo/dts/kernel 且 extra_args 仅允许字母数字与 -_.=:/ 空格；自定义远程命令需「完全权限」档。600 秒超时强杀，失败自动提取关键编译错误。project 缺省取工作台当前绑定工程。',
    inputSchema: {
      type: 'object',
      properties: {
        build_type: { type: 'string', description: "可选。'driver'(默认,驱动模块单编)/'dtbo'(设备树单编)/'dts'(同 dtbo)/'kernel'(内核全编)；「完全权限」档可为任意远程命令" },
        extra_args: { type: 'string', description: '可选。额外编译参数，如 -j32；「工作区内修改」档仅允许字母数字与 -_.=:/ 空格 (≤80 字符)' },
        project: { type: 'string', description: '可选。工程 id (见 project_list / workbench_context)；缺省取工作台当前绑定' }
      }
    }
  }
];

module.exports = {
  isDshHost,
  readLiveContext,
  getHostContext,
  gerritFilterToQuery,
  gerritFilterLabel,
  permLabel,
  resolveLocalProjectBinding,
  wbResolvePluginDir,
  wbActiveContextPath,
  wbLoadLocalProjectService,
  setWorkbenchCompileRunner,
  runWorkbenchTool,
  WORKBENCH_TOOLS,
  DSH_GERRIT_FILTER_LABELS,
  WB_PRESET_BUILD_TYPES
};
