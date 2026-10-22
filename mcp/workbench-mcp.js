#!/usr/bin/env node
/**
 * Workbench MCP Server (stdio JSON-RPC 2.0)
 * 把 TabonKB 工作台会话绑定 (OpenGrok/Gerrit/Jira/本地工程) 与本地工程源码
 * 三层穿透读取以只读 MCP 工具形式暴露给 DSH。
 * 核心逻辑复用 services/workbench-context.js + services/local-project-service.js。
 * 宿主标记: 条目 config.env 注入 TABONKB_MCP_HOST=dsh (能穿过 dsh-mcp-client 的 env scrub)。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let WORKBENCH_TOOLS, runWorkbenchTool;
const possibleServicePaths = [
  path.resolve(__dirname, '../services/workbench-context.js'),
  path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/services/workbench-context.js'),
  'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/workbench-context.js'
];
for (const sp of possibleServicePaths) {
  if (fs.existsSync(sp)) {
    try {
      const mod = require(sp);
      WORKBENCH_TOOLS = mod.WORKBENCH_TOOLS;
      runWorkbenchTool = mod.runWorkbenchTool;
      break;
    } catch (e) {
      console.error('[WorkbenchMCP] Error requiring workbench-context from ' + sp + ':', e.message);
    }
  }
}
if (!runWorkbenchTool) {
  console.error('[WorkbenchMCP] workbench-context.js not found; tools will fail.');
}

// Stdio JSON-RPC 2.0 dispatcher
function sendRpc(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handleRequest(req) {
  const { id, method, params } = req;

  if (id === undefined || id === null) {
    return; // notifications
  }

  if (method === 'initialize') {
    sendRpc({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'tabonkb-workbench', version: '1.0.0' }
      }
    });
    return;
  }

  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendRpc({ jsonrpc: '2.0', id, result: { tools: WORKBENCH_TOOLS || [] } });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    (async () => {
      try {
        const r = await runWorkbenchTool(toolName, args);
        sendRpc({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: r.text }], isError: !!r.isError }
        });
      } catch (err) {
        sendRpc({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `执行 workbench 工具 ${toolName} 失败: ${err.message}` }], isError: true }
        });
      }
    })();
    return;
  }

  sendRpc({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handleRequest(JSON.parse(trimmed));
  } catch (err) {
    console.error('[WorkbenchMCP] JSON parse error:', err.message, 'line:', trimmed.slice(0, 100));
  }
});

process.stderr.write('[WorkbenchMCP] Server initialized and listening on stdio\n');
