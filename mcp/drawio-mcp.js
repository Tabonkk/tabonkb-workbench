#!/usr/bin/env node
/**
 * Draw.io MCP（stdio，给 Hermes）
 * 自己不持有图。工具调用转发到工作台 DrawioBroker（127.0.0.1:6011）。
 */
const http = require('http');
const readline = require('readline');

const BROKER_PORT = parseInt(process.env.TABONKB_DRAWIO_BROKER_PORT || '6011', 10);

const PAGE = {
  page_id: { type: 'string', description: '按页面 id 定位。优先于 page_name 和 page_index' },
  page_name: { type: 'string', description: '按页面名称定位' },
  page_index: { type: 'number', description: '按 0 起始的页序号定位' }
};

const TOOLS = [
  {
    name: 'drawio_create',
    description: '新建一张 draw.io 图，会替换当前会话里的全部页面。xml 必须是 <mxGraphModel>…</mxGraphModel> 或完整 <mxfile>。布局保持在 x=0-800, y=0-600，形状 id 从 2 起，parent="1"，边要写 exitX/exitY/entryX/entryY。title 用简短中文或英文，只用于文件名。',
    inputSchema: {
      type: 'object',
      properties: {
        xml: { type: 'string', description: '完整 mxGraphModel 或 mxfile XML' },
        title: { type: 'string', description: '短标题，用于保存文件名' }
      },
      required: ['xml']
    }
  },
  {
    name: 'drawio_load',
    description: '把知识库里的 .drawio 读入当前会话。path 可用相对知识库根目录的路径。读入后先 drawio_get 再改。',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: '.drawio 路径' } },
      required: ['path']
    }
  },
  {
    name: 'drawio_get',
    description: '读取当前图的 XML 和 cell id。不认识结构时，先调用本工具再 drawio_edit。',
    inputSchema: { type: 'object', properties: PAGE }
  },
  {
    name: 'drawio_edit',
    description: '按 cell 增删改当前页。operations[].operation 为 add、update 或 delete。add/update 的 new_xml 必须是完整 mxCell（含 mxGeometry）。',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, PAGE, {
        operations: {
          type: 'array',
          description: '增删改操作',
          items: {
            type: 'object',
            properties: {
              operation: { type: 'string', description: 'add、update 或 delete' },
              cell_id: { type: 'string', description: 'mxCell id' },
              new_xml: { type: 'string', description: '完整 mxCell XML，add/update 必填' }
            },
            required: ['operation', 'cell_id']
          }
        }
      }),
      required: ['operations']
    }
  },
  {
    name: 'drawio_export',
    description: '把当前图写入 00-Inbox/04-Agent-Diagrams/ 下的 .drawio 和 .png。title 可选。调用后不要再输出图片 markdown，界面会在本轮结束时展示 PNG。',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string', description: '短标题，用于文件名' } }
    }
  },
  {
    name: 'drawio_list_pages',
    description: '列出当前图的全部页面（id、名称、序号、cell 数量）。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'drawio_add_page',
    description: '追加一个页面，不改已有页面。xml 可选，为该页的 mxGraphModel。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '页签名称' },
        id: { type: 'string', description: '页面 id，可省略' },
        xml: { type: 'string', description: '可选的 mxGraphModel' }
      }
    }
  },
  {
    name: 'drawio_rename_page',
    description: '重命名一个页面。page_id、page_name、page_index 至少给一个。',
    inputSchema: {
      type: 'object',
      properties: Object.assign({ new_name: { type: 'string', description: '新的页签名称' } }, PAGE),
      required: ['new_name']
    }
  },
  {
    name: 'drawio_delete_page',
    description: '删除一个页面。不能删除最后一页。page_id、page_name、page_index 至少给一个。',
    inputSchema: { type: 'object', properties: PAGE }
  }
];

function sendRpc(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function brokerCall(tool, args) {
  const payload = JSON.stringify({ tool, args: args || {} });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: BROKER_PORT,
      path: '/v1/call',
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('桥返回的不是 JSON')); }
      });
    });
    req.on('error', () => reject(new Error('工作台 Draw.io 桥未启动。请先打开 Obsidian 里的研发工作台。')));
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('绘图超时')); });
    req.write(payload);
    req.end();
  });
}

function handleRequest(req) {
  const { id, method, params } = req;
  if (id === undefined || id === null) return;
  if (method === 'initialize') {
    sendRpc({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'tabonkb-drawio', version: '1.0.0' }
      }
    });
    return;
  }
  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }
  if (method === 'tools/list') {
    sendRpc({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }
  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    brokerCall(toolName, args).then((result) => {
      sendRpc({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: result.text || '' }],
          isError: !!result.isError
        }
      });
    }).catch((err) => {
      sendRpc({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: err.message }], isError: true }
      });
    });
    return;
  }
  sendRpc({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try { handleRequest(JSON.parse(trimmed)); } catch (err) {
    process.stderr.write('[DrawioMCP] JSON parse error: ' + err.message + '\n');
  }
});
process.stderr.write('[DrawioMCP] listening on stdio, broker port ' + BROKER_PORT + '\n');
