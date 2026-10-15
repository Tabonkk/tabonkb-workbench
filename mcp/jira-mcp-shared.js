/* ==========================================================================
   Jira MCP Shared — 把 jira-mcp.js (stdio MCP server) 接入各 CLI Agent
   注册策略:
   - Hermes: `hermes mcp add tabonkb-jira --command <node> --args <script>` (全局 config.yaml, 幂等)
   - Pi: 走原生扩展 extensions/jira-portal.ts (Pi 无 MCP 能力), 不在此注册
   凭证: jira-mcp.js 子进程自读 data.json/.secrets.json; 此处 spawn 时双保险注入 env
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升); 名称加 jira 前缀避免冲突
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const JIRA_MCP_SERVER_NAME = 'tabonkb-jira';

function jiraMcpResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

function jiraMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'jira-mcp.js') : '',
    path.join(__dirname, 'mcp', 'jira-mcp.js'),
    path.join(__dirname, 'jira-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || '';
}

// 供 CLI spawn 时注入的 env (token 仍走 .secrets.json, env 仅传非敏感配置)
function buildJiraEnv(vaultBasePath) {
  const env = {};
  try {
    const base = vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench') : __dirname;
    const dataJson = path.join(base, 'data.json');
    if (fs.existsSync(dataJson)) {
      const d = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
      const j = (d && d.jira) || {};
      if (j.baseUrl) env.JIRA_BASE_URL = j.baseUrl;
      if (j.type) env.JIRA_TYPE = j.type;
      if (j.username) env.JIRA_USERNAME = j.username;
      if (j.email) env.JIRA_EMAIL = j.email;
      if (j.authType) env.JIRA_AUTH_TYPE = j.authType;
      if (j.secretName) env.JIRA_SECRET_NAME = j.secretName;
      if (j.jql) env.JIRA_JQL = j.jql;
    }
  } catch (e) { /* env 注入失败不致命: MCP server 仍会自读文件回退 */ }
  return env;
}

// 提示语: 引导各 CLI 在排查 Jira 缺陷工单时使用 Jira 工具链
const JIRA_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入公司内网 Jira 缺陷工单系统 MCP 工具 ' + JIRA_MCP_SERVER_NAME + ':\n' +
  '1. jira_search_issues (检索工单: 支持工单号直达/关键词/JQL)\n' +
  '2. jira_get_issue (查看工单完整详情: 标题/状态/经办人/描述/最近注释/附件清单)\n' +
  '3. jira_get_comments (查阅工单全部历史注释与讨论记录)\n' +
  '4. jira_list_attachments (列出工单附件清单: 定位 log/截图/抓包文件)\n' +
  '5. jira_download_attachment (下载工单附件到知识库 00-Inbox/03-Quick-Note/<KEY>/attachments/ 并返回本地路径)\n' +
  '【产物归档约定】凡针对某工单的排查/分析任务：日志等下载产物固定存放 00-Inbox/03-Quick-Note/<工单号>/attachments/；分析结论、复现报告、修复建议等 Markdown 产物写入 00-Inbox/03-Quick-Note/<工单号>/ 目录根级（先创建该目录再写文件）。\n' +
  '【权限安全边界】工具仅支持检索、查阅与附件下载。严禁执行或建议执行任何 Jira 写操作（新建/编辑工单、状态流转、发表评论、上传附件）。';

// ---- Hermes: 全局注册 (幂等, 异步不阻塞) ----
function ensureHermesJiraMcp(hermesBin, prefixArgs, vaultBasePath) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(JIRA_MCP_SERVER_NAME) >= 0) { resolve({ ok: true, already: true }); return; }
        const nodeExe = jiraMcpResolveNodeExe();
        const script = jiraMcpScriptPath(vaultBasePath);
        const addProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'add', JIRA_MCP_SERVER_NAME, '--command', nodeExe, '--args', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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
  JIRA_MCP_SERVER_NAME,
  JIRA_MCP_TOOL_HINT,
  jiraMcpResolveNodeExe,
  jiraMcpScriptPath,
  buildJiraEnv,
  ensureHermesJiraMcp
};
