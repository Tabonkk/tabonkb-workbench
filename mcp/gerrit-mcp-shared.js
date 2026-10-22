/* ==========================================================================
   Gerrit MCP Shared — 把 gerrit-mcp.js (stdio MCP server) 接入各 CLI Agent
   注册策略:
   - Hermes: `hermes mcp add tabonkb-gerrit --command <node> --args <script>` (全局 config.yaml, 幂等)
   - Pi: 走原生扩展 extensions/gerrit-portal.ts (Pi 无 MCP 能力), 不在此注册
   凭证: gerrit-mcp.js 子进程自读 data.json; 此处 spawn 时双保险注入 env
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升); 名称加 gerrit 前缀避免冲突
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const GERRIT_MCP_SERVER_NAME = 'tabonkb-gerrit';

function gerritMcpResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

function gerritMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'gerrit-mcp.js') : '',
    path.join(__dirname, 'mcp', 'gerrit-mcp.js'),
    path.join(__dirname, 'gerrit-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || '';
}

// 供 CLI spawn 时注入的 env
function buildGerritEnv(vaultBasePath) {
  const env = {};
  try {
    const base = vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench') : __dirname;
    const dataJson = path.join(base, 'data.json');
    if (fs.existsSync(dataJson)) {
      const d = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
      const g = (d && d.gerrit) || {};
      if (g.baseUrl) env.GERRIT_BASE_URL = g.baseUrl;
      if (g.username) env.GERRIT_USERNAME = g.username;
      if (g.password) env.GERRIT_PASSWORD = g.password;
    }
  } catch (e) { /* env 注入失败不致命: MCP server 仍会自读文件回退 */ }
  return env;
}

// 提示语: 引导各 CLI 在排查变更、评审记录与补丁时使用 Gerrit 工具
const GERRIT_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入公司内网 Gerrit 代码评审系统 MCP 工具 ' + GERRIT_MCP_SERVER_NAME + ':\n' +
  '1. gerrit_search_changes (检索变更: 支持 status/project/commit/branch/query 过滤)\n' +
  '2. gerrit_get_change (查看指定变更详情: 变更号、主题、提交人、分支、评审者评分与消息流)\n' +
  '3. gerrit_get_diff (查看代码变更 Diff: 支持指定文件的行级对比，或全量 Unified Patch 补丁)\n' +
  '4. gerrit_get_comments (查阅审查人在代码各行留下的详细评审讨论与修改意见)\n' +
  '5. gerrit_list_projects (获取 Gerrit 代码托管工程仓库清单)\n' +
  '【权限安全边界】当前工具严格限定为只读查阅模式。你只允许检索变更、阅读评审记录与比对补丁代码，严禁执行或建议执行任何提交评审意见 (Review)、打分 (Vote)、代码合入 (Submit) 或废弃变更 (Abandon) 操作。';

// MCP command 使用 GUI 子系统 node 副本避免 conhost 闪屏；bundle 内由 vendor-mcp-shared.js 提供
function gerritMcpGuiNodeExe(e) { return typeof mcpResolveGuiNodeExe === 'function' ? mcpResolveGuiNodeExe(e) : e; }

// ---- Hermes: 全局注册 (幂等, 异步不阻塞) ----
function ensureHermesGerritMcp(hermesBin, prefixArgs, vaultBasePath) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(GERRIT_MCP_SERVER_NAME) >= 0) { resolve({ ok: true, already: true }); return; }
        const nodeExe = gerritMcpGuiNodeExe(gerritMcpResolveNodeExe());
        const script = gerritMcpScriptPath(vaultBasePath);
        const addProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'add', GERRIT_MCP_SERVER_NAME, '--command', nodeExe, '--args', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        addProc.stdout.on('data', (d) => { out += d.toString(); });
        addProc.stderr.on('data', (d) => { out += d.toString(); });
        addProc.stdin.write('Y\n');
        addProc.stdin.end();
        const killer = setTimeout(() => { try { addProc.kill(); } catch (e) {} }, 90000);
        addProc.on('error', (e) => { clearTimeout(killer); resolve({ ok: false, error: e.message }); });
        addProc.on('close', (code) => {
          clearTimeout(killer);
          resolve({ ok: code === 0 || /Saved|Added|success/i.test(out), output: out.slice(-400) });
        });
      });
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

module.exports = {
  GERRIT_MCP_SERVER_NAME,
  GERRIT_MCP_TOOL_HINT,
  gerritMcpResolveNodeExe,
  gerritMcpScriptPath,
  buildGerritEnv,
  ensureHermesGerritMcp
};
