/* ==========================================================================
   OpenGrok MCP Shared — 把 opengrok-mcp.js (stdio MCP server) 接入各 CLI Agent
   注册策略:
   - Hermes: `hermes mcp add tabonkb-opengrok --command <node> --args <script>` (全局 config.yaml, 幂等)
   - Pi: 走原生扩展 extensions/opengrok-portal.ts (Pi 无 MCP 能力), 不在此注册
   凭证: opengrok-mcp.js 子进程自读 data.json; 此处 spawn 时双保险注入 env
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升); 名称加 opengrok 前缀避免冲突
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const OPENGROK_MCP_SERVER_NAME = 'tabonkb-opengrok';

function opengrokMcpResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

function opengrokMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'opengrok-mcp.js') : '',
    path.join(__dirname, 'mcp', 'opengrok-mcp.js'),
    path.join(__dirname, 'opengrok-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || '';
}

// 供 CLI spawn 时注入的 env
function buildOpengrokEnv(vaultBasePath) {
  const env = {};
  try {
    const base = vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench') : __dirname;
    const dataJson = path.join(base, 'data.json');
    if (fs.existsSync(dataJson)) {
      const d = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
      const og = (d && d.opengrok) || {};
      if (og.baseUrl) env.OPENGROK_BASE_URL = og.baseUrl;
      if (og.defaultProject) env.OPENGROK_DEFAULT_PROJECT = og.defaultProject;
    }
  } catch (e) { /* env 注入失败不致命: MCP server 仍会自读文件回退 */ }
  return env;
}

// 提示语: 引导各 CLI 优先用 OpenGrok 代码检索工具
const OPENGROK_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入公司内网 OpenGrok 代码搜索引擎 MCP 工具 ' + OPENGROK_MCP_SERVER_NAME + ': ' +
  '1. opengrok_search_code (综合搜索: 全文 full / 符号定义 defs / 引用 refs / 文件路径 path)\n' +
  '2. opengrok_read_file (读取匹配文件的指定起止行号真实源码实现)\n' +
  '3. opengrok_list_projects (查看当前所有代码工程)\n' +
  '【智能工程映射】OpenGrok 代码库涵盖多个手机软硬件平台工程，你可以根据用户提问中的关键词通过 project 参数精准定位：\n' +
  '- 展锐 / 展讯 / 紫光 / sprd / unisoc: 对应 `W_sprd_os_dev` (主线) 或 `V_sprd_os_dev`\n' +
  '- 联发科 / MTK / mp1 / mediatek: 对应 `W_mp1_os_dev` (主线) 或 `T_U_mp1_oversea_release`\n' +
  '- A17 机型 / a17: 对应 `A17_mp1_os_dev`\n' +
  '- AIoT: 对应 `S_U_aiot_oversea_release`\n' +
  '凡涉及驱动源码、寄存器定义、内核函数、DTS设备树、Makefile 配置时，必须优先调用 opengrok_search_code 检索代码，再调用 opengrok_read_file 查看函数具体实现，给出精准的代码分析与行号引用。';

// ---- Hermes: 全局注册 (幂等, 异步不阻塞) ----
function ensureHermesOpengrokMcp(hermesBin, prefixArgs, vaultBasePath) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(OPENGROK_MCP_SERVER_NAME) >= 0) { resolve({ ok: true, already: true }); return; }
        const nodeExe = opengrokMcpResolveNodeExe();
        const script = opengrokMcpScriptPath(vaultBasePath);
        const addProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'add', OPENGROK_MCP_SERVER_NAME, '--command', nodeExe, '--args', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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
  OPENGROK_MCP_SERVER_NAME,
  OPENGROK_MCP_TOOL_HINT,
  opengrokMcpResolveNodeExe,
  opengrokMcpScriptPath,
  buildOpengrokEnv,
  ensureHermesOpengrokMcp
};
