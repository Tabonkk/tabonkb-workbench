#!/usr/bin/env node
/**
 * DSLogic MCP Server (stdio JSON-RPC 2.0)
 * DSView/DSLogic 采集文件的只读分析接口: 经工作台 companion-server HTTP 调用。
 * 采集本身由官方 DSView 完成并手动导入；本服务不访问设备、不写采集文件。
 * 工具集 (DSLOGIC_ARCHITECTURE §6):
 *   dslogic_list_captures    列出 Data_DSLogic 下 .dsl 文件
 *   dslogic_get_info         采集元数据: 采样率/时长/通道活跃/内嵌解码器
 *   dslogic_get_annotations  行级注解分页 (decode rows)
 *   dslogic_get_transactions 语义事务层 (I2C/PD/UFCS/UART/SPI) + 异常清单
 *   dslogic_get_summary      <=6000 中文字符 AI 上下文包 (可选时间选区)
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
    req.setTimeout(120000, () => req.destroy(new Error('companion-server 响应超时（解码大文件可能需分钟级）')));
    if (data) req.write(data);
    req.end();
  });
}

function unwrap(res) {
  if (!res || res.ok === false) throw new Error((res && (res.error || res.msg)) || 'companion 调用失败');
  return (res.data !== undefined) ? res.data : (res.result !== undefined ? res.result : res);
}

const SPEC_PROPS = {
  decoder: { type: 'string', description: '解码器 id（如 0:i2c / 1:uart / usb_power_delivery / ufcs）。与 index 二选一；缺省用 index=0' },
  pins: { type: 'object', description: '引脚映射 {角色: 探头号}，如 {"scl":0,"sda":1} / {"rxtx":2} / {"cc1":2,"cc2":3}', additionalProperties: { type: 'integer' } },
  options: { type: 'object', description: '解码器选项（如 {"baudrate":115200}）' },
  stacked: { type: 'array', description: '叠加解码器 [{id,options}]，如 ufcs 叠在 1:uart 上', items: { type: 'object' } },
  index: { type: 'integer', description: '内嵌解码器序号（文件自带配置），缺省 0' }
};

const DSLOGIC_TOOLS = [
  {
    name: 'dslogic_list_captures',
    description: '列出 Data_DSLogic 目录下全部 .dsl 采集文件（名称/大小/修改时间）。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'dslogic_get_info',
    description: '读取 .dsl 采集元数据：采样率、时长、每通道边沿数/活跃性/最小脉宽、内嵌解码器配置。',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'Data_DSLogic 下的文件名（如 260722101909.dsl）' } },
      required: ['file']
    }
  },
  {
    name: 'dslogic_get_annotations',
    description: '分页读取行级解码注解（每条含 ss/es/ann/texts）。可加 start_s/end_s 视窗或 q 关键字过滤。',
    inputSchema: {
      type: 'object',
      properties: Object.assign({ file: { type: 'string' },
        offset: { type: 'integer', default: 0 }, limit: { type: 'integer', default: 200 },
        row: { type: 'string', description: 'annotation row 名过滤' },
        q: { type: 'string', description: '文本关键字过滤' },
        start_s: { type: 'number' }, end_s: { type: 'number' } }, SPEC_PROPS),
      required: ['file']
    }
  },
  {
    name: 'dslogic_get_transactions',
    description: '语义事务层【分页】：把行级注解聚合成协议事务（I2C 地址/读写/寄存器值、PD 消息类型/GoodCRC 时延、UFCS 消息、UART 帧组、SPI CS 段），并附异常清单（addr_nack/crc_error/no_eop/no_goodcrc/glitch_dense/undersampled/decoder_error）。返回 {transactions, total, offset, limit, anomalies}，用 offset/limit 翻页（默认 limit=100，上限 1000）。',
    inputSchema: {
      type: 'object',
      properties: Object.assign({ file: { type: 'string' },
        start_s: { type: 'number' }, end_s: { type: 'number' },
        offset: { type: 'integer', default: 0, description: '事务分页偏移' },
        limit: { type: 'integer', default: 100, description: '每页事务数，上限 1000' } }, SPEC_PROPS),
      required: ['file']
    }
  },
  {
    name: 'dslogic_get_summary',
    description: 'AI 上下文包（Markdown，≤6000 中文字符）：采集概况/通道活跃/异常清单/聚合统计/事务样本。可选 sel_start_s/sel_end_s 限定时间选区。',
    inputSchema: {
      type: 'object',
      properties: Object.assign({ file: { type: 'string' },
        sel_start_s: { type: 'number' }, sel_end_s: { type: 'number' } }, SPEC_PROPS),
      required: ['file']
    }
  }
];

function sendRpc(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function jsonResult(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }

function specBody(args) {
  const b = { file: args.file };
  if (args.decoder) {
    b.decoder = args.decoder;
    if (args.pins) b.pins = args.pins;
    if (args.options) b.options = args.options;
    if (args.stacked) b.stacked = args.stacked;
  } else if (args.index !== undefined) {
    b.index = args.index;
  }
  return b;
}

async function handleToolCall(name, args) {
  args = args || {};
  if (!args.file && name !== 'dslogic_list_captures')
    return { isError: true, content: [{ type: 'text', text: 'file 参数必填' }] };
  switch (name) {
    case 'dslogic_list_captures':
      return jsonResult(unwrap(await httpJson('GET', '/api/dslogic/captures')));
    case 'dslogic_get_info':
      return jsonResult(unwrap(await httpJson('GET', '/api/dslogic/info?file=' + encodeURIComponent(args.file))));
    case 'dslogic_get_annotations': {
      const b = specBody(args);
      for (const k of ['offset', 'limit', 'row', 'q', 'start_s', 'end_s'])
        if (args[k] !== undefined) b[k] = args[k];
      b.overlap = true;
      return jsonResult(unwrap(await httpJson('POST', '/api/dslogic/decode', b)));
    }
    case 'dslogic_get_transactions': {
      const b = specBody(args);
      if (args.start_s !== undefined) b.start_s = args.start_s;
      if (args.end_s !== undefined) b.end_s = args.end_s;
      if (args.offset !== undefined) b.offset = args.offset;
      if (args.limit !== undefined) b.limit = args.limit;
      return jsonResult(unwrap(await httpJson('POST', '/api/dslogic/transactions', b)));
    }
    case 'dslogic_get_summary': {
      const b = specBody(args);
      if (!args.decoder && args.index === undefined) b.all = true;
      if (args.sel_start_s !== undefined) b.sel_start_s = args.sel_start_s;
      if (args.sel_end_s !== undefined) b.sel_end_s = args.sel_end_s;
      return jsonResult(unwrap(await httpJson('POST', '/api/dslogic/summary', b)));
    }
    default:
      return { isError: true, content: [{ type: 'text', text: 'Unknown tool: ' + name }] };
  }
}

function handleRequest(req) {
  const { id, method, params } = req;
  if (id === undefined || id === null) return;
  if (method === 'initialize') {
    sendRpc({ jsonrpc: '2.0', id, result: { protocolVersion: (params && params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'tabonkb-dslogic', version: '1.0.0' } } });
    return;
  }
  if (method === 'ping') { sendRpc({ jsonrpc: '2.0', id, result: {} }); return; }
  if (method === 'tools/list') { sendRpc({ jsonrpc: '2.0', id, result: { tools: DSLOGIC_TOOLS } }); return; }
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
  catch (e) { console.error('[DSLogic-MCP] JSON parse error:', e.message); }
});
