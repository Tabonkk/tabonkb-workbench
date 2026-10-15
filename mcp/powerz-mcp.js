#!/usr/bin/env node
/**
 * Power-Z MCP Server (stdio JSON-RPC 2.0)
 * 官方上位机数据接口: 通过 HTTP 调用工作台 companion-server, 提供
 *   1. 唤起官方 Mtools / PDM
 *   2. 列出 / 分析 captures 采集数据 (官方 .db / PD .sqlite / CSV / jsonl)
 *   3. 分页读取原始数据
 * 采集本身由官方工具完成, 本服务不访问设备。
 */

const http = require('http');

const COMPANION_BASE = process.env.TABONKB_COMPANION_URL || 'http://127.0.0.1:28123';

function httpJson(method, path, body) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(path, COMPANION_BASE); } catch (e) { reject(e); return; }
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
    }, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf || '{}')); }
        catch (e) { reject(new Error('Companion returned non-JSON: ' + buf.slice(0, 200))); }
      });
    });
    req.on('error', (e) => reject(new Error('无法连接工作台 companion-server (' + COMPANION_BASE + '): ' + e.message + '。请确认 Obsidian 工作台插件已启用。')));
    req.setTimeout(15000, () => req.destroy(new Error('companion-server 响应超时')));
    if (data) req.write(data);
    req.end();
  });
}

function unwrap(res) {
  if (!res || res.ok === false) throw new Error((res && (res.error || res.msg)) || 'companion 调用失败');
  return (res.data !== undefined) ? res.data : (res.result !== undefined ? res.result : res);
}

const POWERZ_TOOLS = [
  {
    name: 'powerz_launch_official',
    description: '唤起官方免安装上位机: Mtools (数据记录/协议分析) 或 PDM (协议诱骗)。启动前会自动预配置采样率/缓存/协议分析目录/保存路径。',
    inputSchema: { type: 'object', properties: { tool: { type: 'string', enum: ['Mtools', 'PDM'], default: 'Mtools' } } }
  },
  {
    name: 'powerz_list_captures',
    description: '列出 captures 采集目录下所有可分析文件 (官方 Mtools 的 .db、PD .sqlite、导出 CSV、工作台 jsonl)。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'powerz_analyze_capture',
    description: '分析指定采集文件 (官方 .db / PD .sqlite / CSV / jsonl), 返回宏观电气统计 (最高/最低/平均电压电流、峰值功率、容量 mAh、能量 mWh、温度) 与降采样曲线；PD SQLite 返回真实报文数量、原始字节和报文时间跨度，暂不解码消息类型。',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'captures 目录下的文件名' } },
      required: ['file']
    }
  },
  {
    name: 'powerz_get_capture_data',
    description: '分页读取采集文件的原始/规范化数据, 避免一次性返回过大内容。',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'captures 目录下的文件名' },
        type: { type: 'string', enum: ['adc'], default: 'adc' },
        offset: { type: 'integer', default: 0 },
        limit: { type: 'integer', default: 200 }
      },
      required: ['file']
    }
  }
];

function sendRpc(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function jsonResult(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }

async function handleToolCall(name, args) {
  args = args || {};
  switch (name) {
    case 'powerz_launch_official': {
      const res = await httpJson('POST', '/api/powerz/control', { action: 'launch', tool: args.tool || 'Mtools' });
      return jsonResult(unwrap(res));
    }
    case 'powerz_list_captures':
      return jsonResult(unwrap(await httpJson('GET', '/api/powerz/captures')));
    case 'powerz_analyze_capture': {
      if (!args.file) return { isError: true, content: [{ type: 'text', text: 'file 参数必填' }] };
      return jsonResult(unwrap(await httpJson('POST', '/api/powerz/analyze', { file: args.file })));
    }
    case 'powerz_get_capture_data': {
      if (!args.file) return { isError: true, content: [{ type: 'text', text: 'file 参数必填' }] };
      const q = 'file=' + encodeURIComponent(args.file) + '&type=' + (args.type || 'adc') +
        '&offset=' + (args.offset || 0) + '&limit=' + (args.limit || 200);
      return jsonResult(unwrap(await httpJson('GET', '/api/powerz/capture-data?' + q)));
    }
    default:
      return { isError: true, content: [{ type: 'text', text: 'Unknown tool: ' + name }] };
  }
}

function handleRequest(req) {
  const { id, method, params } = req;
  if (id === undefined || id === null) return;
  if (method === 'initialize') {
    sendRpc({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'tabonkb-powerz', version: '3.0.0' } } });
    return;
  }
  if (method === 'ping') { sendRpc({ jsonrpc: '2.0', id, result: {} }); return; }
  if (method === 'tools/list') { sendRpc({ jsonrpc: '2.0', id, result: { tools: POWERZ_TOOLS } }); return; }
  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    handleToolCall(name, toolArgs)
      .then(res => sendRpc({ jsonrpc: '2.0', id, result: res }))
      .catch(err => sendRpc({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: err.message || String(err) }] } }));
    return;
  }
  sendRpc({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', line => {
  line = line.trim();
  if (!line) return;
  try { handleRequest(JSON.parse(line)); }
  catch (e) { console.error('[PowerZ-MCP] JSON parse error:', e.message); }
});
