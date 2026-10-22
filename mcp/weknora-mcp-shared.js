/* ==========================================================================
   WeKnora MCP Shared — 把 weknora-mcp.js (stdio MCP server) 接入各 CLI Agent
   注册策略:
   - Hermes: `hermes mcp add tabonkb-weknora --command <node> --args <script>` (全局 config.yaml, 幂等)
   - Pi: 走原生扩展 extensions/weknora-portal.ts (Pi 无 MCP 能力), 不在此注册
   凭证: weknora-mcp.js 子进程自读 data.json/.secrets.json; 此处 spawn 时双保险注入 env
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升); 名称加 weknora 前缀避免与 vendor 模块冲突
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const WEKNORA_MCP_SERVER_NAME = 'tabonkb-weknora';

function weknoraMcpResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

function weknoraMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'weknora-mcp.js') : '',
    path.join(__dirname, 'mcp', 'weknora-mcp.js'),
    path.join(__dirname, 'weknora-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || '';
}

// 供 CLI spawn 时注入的 env (子进程自动继承); 缺失则子进程自读文件回退
function buildWeknoraEnv(vaultBasePath) {
  const env = {};
  try {
    const base = vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench') : __dirname;
    const dataJson = path.join(base, 'data.json');
    if (fs.existsSync(dataJson)) {
      const d = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
      const w = (d && d.weknora) || {};
      if (w.baseUrl) env.WEKNORA_BASE_URL = w.baseUrl;
      if (w.defaultKb) env.WEKNORA_DEFAULT_KB = w.defaultKb;
    }
    const secJson = path.join(base, '.secrets.json');
    if (fs.existsSync(secJson)) {
      const s = JSON.parse(fs.readFileSync(secJson, 'utf8'));
      if (s['tabonkb-weknora-apikey']) env.WEKNORA_API_KEY = s['tabonkb-weknora-apikey'];
    }
  } catch (e) { /* env 注入失败不致命: MCP server 仍会自读文件回退 */ }
  return env;
}

// 提示语: 引导各 CLI 优先用 WeKnora 知识库工具
const WEKNORA_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入团队知识库 MCP 工具 ' + WEKNORA_MCP_SERVER_NAME + ' (WeKnora)。用户询问项目沉淀知识、历史排障、平台文档或知识库内容时, 默认只调用 weknora_search (混合检索, 返回片段)。不要默认调用 weknora_ask: 它会在服务端再跑一轮完整 RAG, 经常耗时数分钟。仅当用户明确要求知识库直接给出带引用的成稿、且 search 片段不够时, 才单独调用 weknora_ask。不要把 weknora_search 与 weknora_ask 放进同一次工具批次: deferred 工具不能并行, 且 ask 内部已经包含检索。需要全文再用 weknora_read_document。写入用 weknora_add_document / weknora_update_document / weknora_delete_document。';

// MCP command 使用 GUI 子系统 node 副本避免 conhost 闪屏；bundle 内由 vendor-mcp-shared.js 提供
function weknoraMcpGuiNodeExe(e) { return typeof mcpResolveGuiNodeExe === 'function' ? mcpResolveGuiNodeExe(e) : e; }

// ---- Hermes: 全局注册 (幂等, 异步不阻塞) ----
function ensureHermesWeknoraMcp(hermesBin, prefixArgs, vaultBasePath) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(WEKNORA_MCP_SERVER_NAME) >= 0) { resolve({ ok: true, already: true }); return; }
        const nodeExe = weknoraMcpGuiNodeExe(weknoraMcpResolveNodeExe());
        const script = weknoraMcpScriptPath(vaultBasePath);
        const addProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'add', WEKNORA_MCP_SERVER_NAME, '--command', nodeExe, '--args', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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
  WEKNORA_MCP_SERVER_NAME,
  WEKNORA_MCP_TOOL_HINT,
  weknoraMcpResolveNodeExe,
  weknoraMcpScriptPath,
  buildWeknoraEnv,
  ensureHermesWeknoraMcp
};
