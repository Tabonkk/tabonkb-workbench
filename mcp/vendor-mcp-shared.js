/* ==========================================================================
   Vendor MCP Shared — 把 vendor-portal-mcp.js (stdio MCP server) 接入各 CLI Agent
   注册策略:
   - Hermes: `hermes mcp add tabonkb-vendor --command <node> --args <script>` (全局 config.yaml, 幂等)
   - Gemini: 合并写 <vault>/.gemini/settings.json 的 mcpServers (项目级, 隔离)
   - Pi: 保留原 --extension vendor-portal.ts 通道, 不走 MCP
   凭证: MCP server 子进程继承 CLI env + 自读 data.json/.secrets.json, 此处双保险注入
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const VENDOR_MCP_SERVER_NAME = 'tabonkb-vendor';

function vendorMcpResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

// Windows 下第三方 CLI (agy/gemini/hermes/dsh) 拉起 MCP stdio 子进程时不带 CREATE_NO_WINDOW；
// node.exe 是控制台子系统 (Subsystem=3)，每次拉起都会分配一个 conhost 窗口造成 CMD 黑框闪屏。
// 生成同内容的 GUI 子系统副本 (Subsystem 3→2)，子进程不再分配控制台，stdin/stdout 管道不受影响。
// 副本与源同目录 (node-gui.exe)，按 size+mtime 校验缓存；任何失败回退原 node 路径。
function mcpResolveGuiNodeExe(nodeExe) {
  try {
    if (process.platform !== 'win32' || !nodeExe || !fs.existsSync(nodeExe)) return nodeExe;
    const guiExe = path.join(path.dirname(nodeExe), 'node-gui.exe');
    const srcStat = fs.statSync(nodeExe);
    try {
      const g = fs.statSync(guiExe);
      if (g.size === srcStat.size && g.mtimeMs >= srcStat.mtimeMs) return guiExe;
    } catch (_) {}
    const buf = fs.readFileSync(nodeExe);
    if (buf.length < 0x400 || buf.readUInt16LE(0) !== 0x5A4D) return nodeExe; // 'MZ'
    const pe = buf.readUInt32LE(0x3C);
    if (pe + 94 > buf.length || buf.readUInt32LE(pe) !== 0x00004550) return nodeExe; // 'PE\0\0'
    const subOff = pe + 4 + 20 + 68; // OptionalHeader.Subsystem (PE32/PE32+ 同偏移)
    if (buf.readUInt16LE(subOff) !== 3) return nodeExe; // 仅控制台子系统需要转换
    buf.writeUInt16LE(2, subOff); // IMAGE_SUBSYSTEM_WINDOWS_GUI
    fs.writeFileSync(guiExe + '.tmp', buf);
    fs.renameSync(guiExe + '.tmp', guiExe);
    return guiExe;
  } catch (_) { return nodeExe; }
}

function vendorMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'vendor-portal-mcp.js') : '',
    path.join(__dirname, 'mcp', 'vendor-portal-mcp.js'),
    path.join(__dirname, 'vendor-portal-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || '';
}

// 供 CLI spawn 时注入的凭证 env (MCP 子进程自动继承)
function buildVendorEnv(vaultBasePath) {
  const env = {};
  try {
    const base = vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench') : __dirname;
    const dataJson = path.join(base, 'data.json');
    if (fs.existsSync(dataJson)) {
      const d = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
      const uname = (d && d.vendorPortals && d.vendorPortals.mtk && d.vendorPortals.mtk.username) || '';
      if (uname) env.TABONKB_MTK_USERNAME = uname;
    }
    const secJson = path.join(base, '.secrets.json');
    if (fs.existsSync(secJson)) {
      const s = JSON.parse(fs.readFileSync(secJson, 'utf8'));
      if (s['tabonkb-mtk-password']) env.TABONKB_MTK_PASSWORD = s['tabonkb-mtk-password'];
      if (s['tabonkb-unisoc-password']) env.TABONKB_UNISOC_TOKEN = s['tabonkb-unisoc-password'];
    }
  } catch (e) { /* env 注入失败不致命: MCP server 仍会自读文件回退 */ }
  return env;
}

// 提示语: 提高各 CLI 对 vendor 工具的调用意愿并严禁使用外部 web 工具访问原厂
const VENDOR_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入专有芯片原厂 MCP 工具 ' + VENDOR_MCP_SERVER_NAME + ': vendor_portal_search (检索 MTK/展锐原厂技术资料) 与 vendor_portal_get_detail (按 FAQ/DCC 编号调取方案正文)。\n⚠️ 特别警示：MediaTek Online (online.mediatek.com) 与紫光展锐 Uni-Support (unisupport.unisoc.com) 均为企业保密内部支持门户，外部通用网页抓取工具 (web_extract, fetch) 会触发 SSRF 阻断报错，通用搜索引擎 (web_search) 也无法检索内网文档并会导致权限拒绝！凡用户提及 MTK / 展锐官网、芯片文档、眼图测试、寄存器配置、Kernel Panic 或驱动移植，严禁调用 web_extract 或 web_search，必须且仅能使用 vendor_portal_search 检索！';

// ---- Hermes: 全局注册 (幂等, 异步不阻塞) ----
function ensureHermesVendorMcp(hermesBin, prefixArgs, vaultBasePath) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(VENDOR_MCP_SERVER_NAME) >= 0) { resolve({ ok: true, already: true }); return; }
        const nodeExe = mcpResolveGuiNodeExe(vendorMcpResolveNodeExe());
        const script = vendorMcpScriptPath(vaultBasePath);
        const addProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'add', VENDOR_MCP_SERVER_NAME, '--command', nodeExe, '--args', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        addProc.stdout.on('data', (d) => { out += d.toString(); });
        addProc.stderr.on('data', (d) => { out += d.toString(); });
        addProc.stdin.write('Y\n');
        addProc.stdin.end();
        const killer = setTimeout(() => { try { addProc.kill(); } catch (e) {} }, 90000);
        addProc.on('error', (e) => { clearTimeout(killer); resolve({ ok: false, error: e.message }); });
        addProc.on('close', (code) => {
          clearTimeout(killer);
          resolve({ ok: code === 0 || /Saved/i.test(out), output: out.slice(-400) });
        });
      });
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

// ---- Gemini: 项目级 settings.json 合并 (隔离, 不碰用户全局) ----
function ensureGeminiVendorMcp(vaultBasePath) {
  try {
    const dir = path.join(vaultBasePath || '', '.gemini');
    const file = path.join(dir, 'settings.json');
    let cfg = {};
    if (fs.existsSync(file)) {
      try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { cfg = {}; }
    }
    cfg.mcpServers = cfg.mcpServers || {};
    const nodeExe = mcpResolveGuiNodeExe(vendorMcpResolveNodeExe());
    const script = vendorMcpScriptPath(vaultBasePath);
    const cur = cfg.mcpServers[VENDOR_MCP_SERVER_NAME];
    const same = cur && cur.command === nodeExe && Array.isArray(cur.args) && cur.args[0] === script;
    if (same) return { ok: true, changed: false };
    cfg.mcpServers[VENDOR_MCP_SERVER_NAME] = { command: nodeExe, args: [script] };
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
    return { ok: true, changed: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

module.exports = {
  VENDOR_MCP_SERVER_NAME,
  VENDOR_MCP_TOOL_HINT,
  mcpResolveGuiNodeExe,
  vendorMcpResolveNodeExe,
  vendorMcpScriptPath,
  buildVendorEnv,
  ensureHermesVendorMcp,
  ensureGeminiVendorMcp
};
