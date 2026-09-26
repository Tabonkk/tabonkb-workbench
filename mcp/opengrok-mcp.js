#!/usr/bin/env node
/**
 * OpenGrok MCP Server (stdio JSON-RPC 2.0)
 * 把 OpenGrok 企业内网代码搜索引擎能力 (工程发现/代码检索/源码切片读取)
 * 以 MCP 工具形式暴露给 Hermes / Gemini 等 stdio MCP 客户端。
 * 核心逻辑复用 services/opengrok-service.js。
 * 凭证与配置: 环境变量 OPENGROK_BASE_URL / OPENGROK_DEFAULT_PROJECT 优先, 否则自读 data.json。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let OpengrokService, OPENGROK_TOOLS, runOpengrokTool;
const possibleServicePaths = [
  path.resolve(__dirname, '../services/opengrok-service.js'),
  path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/services/opengrok-service.js'),
  'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/opengrok-service.js'
];
for (const sp of possibleServicePaths) {
  if (fs.existsSync(sp)) {
    try {
      const mod = require(sp);
      OpengrokService = mod.OpengrokService;
      OPENGROK_TOOLS = mod.OPENGROK_TOOLS;
      runOpengrokTool = mod.runOpengrokTool;
      break;
    } catch (e) {
      console.error('[OpenGrokMCP] Error requiring opengrok-service from ' + sp + ':', e.message);
    }
  }
}
if (!OpengrokService) {
  console.error('[OpenGrokMCP] opengrok-service.js not found; tools will fail.');
}

let _service = null;
function getService() {
  if (_service) return _service;
  _service = new OpengrokService();
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
        serverInfo: { name: 'tabonkb-opengrok', version: '1.0.0' }
      }
    });
    return;
  }

  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendRpc({ jsonrpc: '2.0', id, result: { tools: OPENGROK_TOOLS || [] } });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    (async () => {
      try {
        const text = await runOpengrokTool(toolName, args, getService());
        sendRpc({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } });
      } catch (err) {
        sendRpc({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `执行 OpenGrok 工具 ${toolName} 失败: ${err.message}` }], isError: true }
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
    console.error('[OpenGrokMCP] JSON parse error:', err.message, 'line:', trimmed.slice(0, 100));
  }
});

process.stderr.write('[OpenGrokMCP] Server initialized and listening on stdio\n');
