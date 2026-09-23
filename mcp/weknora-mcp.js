#!/usr/bin/env node
/**
 * WeKnora MCP Server (stdio JSON-RPC 2.0)
 * 把 WeKnora 知识库能力 (检索/问答/文档增删改查) 以 MCP 工具形式暴露给
 * Hermes / Gemini 等 stdio MCP 客户端。核心逻辑复用 services/weknora-service.js。
 * 凭证: 环境变量 WEKNORA_BASE_URL / WEKNORA_API_KEY 优先, 否则自读 data.json/.secrets.json。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let WeknoraService, WEKNORA_TOOLS, runWeknoraTool;
const possibleServicePaths = [
  path.resolve(__dirname, '../services/weknora-service.js'),
  path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/services/weknora-service.js'),
  'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/weknora-service.js'
];
for (const sp of possibleServicePaths) {
  if (fs.existsSync(sp)) {
    try {
      const mod = require(sp);
      WeknoraService = mod.WeknoraService;
      WEKNORA_TOOLS = mod.WEKNORA_TOOLS;
      runWeknoraTool = mod.runWeknoraTool;
      break;
    } catch (e) {
      console.error('[WeknoraMCP] Error requiring weknora-service from ' + sp + ':', e.message);
    }
  }
}
if (!WeknoraService) {
  console.error('[WeknoraMCP] weknora-service.js not found; tools will fail.');
}

let _service = null;
function getService() {
  if (_service) return _service;
  _service = new WeknoraService();
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
        serverInfo: { name: 'weknora', version: '1.0.0' }
      }
    });
    return;
  }

  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendRpc({ jsonrpc: '2.0', id, result: { tools: WEKNORA_TOOLS || [] } });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    (async () => {
      try {
        const text = await runWeknoraTool(toolName, args, getService());
        sendRpc({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } });
      } catch (err) {
        sendRpc({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `执行 WeKnora 工具 ${toolName} 失败: ${err.message}` }], isError: true }
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
    console.error('[WeknoraMCP] JSON parse error:', err.message, 'line:', trimmed.slice(0, 100));
  }
});

process.stderr.write('[WeknoraMCP] Server initialized and listening on stdio\n');
