/* ==========================================================================
   DSLogic MCP Shared — 把 dslogic-mcp.js (stdio MCP server) 接入各 Agent
   与 powerz-mcp-shared 同构:
   1. DeepSeek Harness (DSH): 注册进 cordis.patch.yml (@deepseek-ai/dsh-mcp-client)
   2. Antigravity CLI: 注册进 ~/.gemini/config/mcp_config.json
   3. Pi Agent: 走原生扩展 / RPC 联动
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const DSLOGIC_MCP_SERVER_NAME = 'tabonkb-dslogic';

function dslogicMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'dslogic-mcp.js') : '',
    path.join(__dirname, 'mcp', 'dslogic-mcp.js'),
    path.join(__dirname, 'dslogic-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return candidates[0] || '';
}

function buildDslogicEnv(vaultBasePath) {
  return {
    TABONKB_COMPANION_URL: process.env.TABONKB_COMPANION_URL || 'http://127.0.0.1:28123'
  };
}

const DSLOGIC_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入 DSView/DSLogic 逻辑分析仪采集数据接口 ' + DSLOGIC_MCP_SERVER_NAME + ':\n' +
  '1. dslogic_list_captures (列出 Data_DSLogic 目录下官方 DSView 保存的 .dsl 采集文件)\n' +
  '2. dslogic_get_info (采样率/时长/通道活跃性/内嵌解码器)\n' +
  '3. dslogic_get_annotations (行级注解分页, 支持视窗与关键字过滤)\n' +
  '4. dslogic_get_transactions (语义事务层 + 异常清单: addr_nack/crc_error/no_goodcrc/glitch_dense 等)\n' +
  '5. dslogic_get_summary (<=6000 中文字符上下文包, 可选时间选区)\n' +
  '【规范】采集由官方 DSView 完成并手动导入工作台; 分析一律基于 .dsl 实测数据, 经 companion-server 只读访问, 不修改采集文件。';

module.exports = {
  DSLOGIC_MCP_SERVER_NAME,
  dslogicMcpScriptPath,
  buildDslogicEnv,
  DSLOGIC_MCP_TOOL_HINT
};
