#!/usr/bin/env node
/**
 * Jira MCP Server (stdio JSON-RPC 2.0)
 * 把企业 Jira 工单系统 (检索/详情/注释/附件清单/附件下载落盘)
 * 以 MCP 工具形式暴露给 Hermes / Gemini 等 stdio MCP 客户端。
 * 核心逻辑复用 services/jira-service.js。
 *
 * 【权限边界】检索+下载落盘，不提供任何 Jira 写操作 (无新增/编辑/流转/评论)。
 * 凭证与配置: 环境变量 JIRA_BASE_URL / JIRA_USERNAME / JIRA_TOKEN 优先,
 * 否则自读 data.json (jira 段) 与 .secrets.json。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let JiraService, JIRA_TOOLS, runJiraTool;
const possibleServicePaths = [
  path.resolve(__dirname, '../services/jira-service.js'),
  path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/services/jira-service.js'),
  'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/jira-service.js'
];
for (const sp of possibleServicePaths) {
  if (fs.existsSync(sp)) {
    try {
      const mod = require(sp);
      JiraService = mod.JiraService;
      JIRA_TOOLS = mod.JIRA_TOOLS;
      runJiraTool = mod.runJiraTool;
      break;
    } catch (e) {
      console.error('[JiraMCP] Error requiring jira-service from ' + sp + ':', e.message);
    }
  }
}
if (!JiraService) {
  console.error('[JiraMCP] jira-service.js not found; tools will fail.');
}

let _service = null;
function getService() {
  if (_service) return _service;
  _service = new JiraService({ vaultBasePath: process.cwd() });
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
        serverInfo: { name: 'tabonkb-jira', version: '1.0.0' }
      }
    });
    return;
  }

  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendRpc({ jsonrpc: '2.0', id, result: { tools: JIRA_TOOLS || [] } });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    (async () => {
      try {
        const text = await runJiraTool(toolName, args, getService());
        sendRpc({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } });
      } catch (err) {
        sendRpc({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `执行 Jira 工具 ${toolName} 失败: ${err.message}` }], isError: true }
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
    console.error('[JiraMCP] JSON parse error:', err.message, 'line:', trimmed.slice(0, 100));
  }
});

process.stderr.write('[JiraMCP] Server initialized and listening on stdio\n');
