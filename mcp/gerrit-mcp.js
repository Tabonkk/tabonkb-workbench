#!/usr/bin/env node
/**
 * Gerrit MCP Server (stdio JSON-RPC 2.0)
 * 把企业 Gerrit 代码评审系统 (变更检索/评审详情/代码Diff/行内评论/工程仓库)
 * 以 MCP 工具形式暴露给 Hermes / Gemini 等 stdio MCP 客户端。
 * 核心逻辑复用 services/gerrit-service.js。
 *
 * 【权限边界】只读工具链。严禁暴露任何 Review、Submit、Vote 等写操作。
 * 凭证与配置: 环境变量 GERRIT_BASE_URL / GERRIT_USERNAME / GERRIT_PASSWORD 优先, 否则自读 data.json。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let GerritService, GERRIT_TOOLS, runGerritTool;
const possibleServicePaths = [
  path.resolve(__dirname, '../services/gerrit-service.js'),
  path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/services/gerrit-service.js'),
  'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/gerrit-service.js'
];
for (const sp of possibleServicePaths) {
  if (fs.existsSync(sp)) {
    try {
      const mod = require(sp);
      GerritService = mod.GerritService;
      GERRIT_TOOLS = mod.GERRIT_TOOLS;
      runGerritTool = mod.runGerritTool;
      break;
    } catch (e) {
      console.error('[GerritMCP] Error requiring gerrit-service from ' + sp + ':', e.message);
    }
  }
}
if (!GerritService) {
  console.error('[GerritMCP] gerrit-service.js not found; tools will fail.');
}

let _service = null;
function getService() {
  if (_service) return _service;
  _service = new GerritService();
  return _service;
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
        serverInfo: { name: 'tabonkb-gerrit', version: '1.0.0' }
      }
    });
    return;
  }

  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendRpc({ jsonrpc: '2.0', id, result: { tools: GERRIT_TOOLS || [] } });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    (async () => {
      try {
        const text = await runGerritTool(toolName, args, getService());
        sendRpc({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } });
      } catch (err) {
        sendRpc({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `执行 Gerrit 工具 ${toolName} 失败: ${err.message}` }], isError: true }
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
    console.error('[GerritMCP] JSON parse error:', err.message, 'line:', trimmed.slice(0, 100));
  }
});

process.stderr.write('[GerritMCP] Server initialized and listening on stdio\n');
