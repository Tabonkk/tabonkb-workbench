/* ==========================================================================
   Draw.io MCP Shared — 把 drawio-mcp.js 接入 Hermes
   Hermes: hermes mcp add tabonkb-drawio
   Pi: 走 extensions/drawio-portal.ts，不在此注册
   图的进程由插件里的 DrawioBroker 持有，本文件只负责注册和提示语
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const DRAWIO_MCP_SERVER_NAME = 'tabonkb-drawio';

function drawioMcpResolveNodeExe() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'node-v24.15.0', 'node.exe'));
  candidates.push('node');
  for (const c of candidates) {
    if (c === 'node' || fs.existsSync(c)) return c;
  }
  return 'node';
}

function drawioMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'drawio-mcp.js') : '',
    path.join(__dirname, 'mcp', 'drawio-mcp.js'),
    path.join(__dirname, 'drawio-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || '';
}

const DRAWIO_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入绘图工具 tabonkb-drawio，需要画流程图、架构图、状态机时使用，不要打开浏览器，也不要把图写到别的目录：\n' +
  '1. drawio_create：用 mxGraphModel 或 mxfile XML 新建。另给一个短 title 作为文件名。\n' +
  '2. drawio_load：读取已有 .drawio。之后先 drawio_get 再改。\n' +
  '3. drawio_get / drawio_edit：读取结构，再按 cell 增删改。\n' +
  '4. drawio_list_pages / drawio_add_page / drawio_rename_page / drawio_delete_page：多页。\n' +
  '5. drawio_export：写入 00-Inbox/04-Agent-Diagrams/ 的 .drawio 与 PNG。\n' +
  '回合结束时系统会关掉绘图进程，并把 PNG 显示在对话里。回复里说明图已生成即可，不要自己输出图片 markdown。';

// MCP command 使用 GUI 子系统 node 副本避免 conhost 闪屏；bundle 内由 vendor-mcp-shared.js 提供
function drawioMcpGuiNodeExe(e) { return typeof mcpResolveGuiNodeExe === 'function' ? mcpResolveGuiNodeExe(e) : e; }

function ensureHermesDrawioMcp(hermesBin, prefixArgs, vaultBasePath) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(DRAWIO_MCP_SERVER_NAME) >= 0) { resolve({ ok: true, already: true }); return; }
        const nodeExe = drawioMcpGuiNodeExe(drawioMcpResolveNodeExe());
        const script = drawioMcpScriptPath(vaultBasePath);
        const addProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'add', DRAWIO_MCP_SERVER_NAME, '--command', nodeExe, '--args', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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

module.exports = {
  DRAWIO_MCP_SERVER_NAME,
  DRAWIO_MCP_TOOL_HINT,
  drawioMcpResolveNodeExe,
  drawioMcpScriptPath,
  ensureHermesDrawioMcp
};
