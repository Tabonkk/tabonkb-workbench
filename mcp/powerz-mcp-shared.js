/* ==========================================================================
   Power-Z MCP Shared — 把 powerz-mcp.js (stdio MCP server) 接入各 Agent
   支持:
   1. DeepSeek Harness (DSH): 注册进 cordis.patch.yml (@deepseek-ai/dsh-mcp-client)
   2. Antigravity CLI: 注册进 ~/.gemini/config/mcp_config.json
   3. Pi Agent: 走原生扩展 / RPC 联动
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const POWERZ_MCP_SERVER_NAME = 'tabonkb-powerz';

function powerzMcpScriptPath(vaultBasePath) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', 'powerz-mcp.js') : '',
    path.join(__dirname, 'mcp', 'powerz-mcp.js'),
    path.join(__dirname, 'powerz-mcp.js')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return candidates[0] || '';
}

function buildPowerzEnv(vaultBasePath) {
  return {
    TABONKB_COMPANION_URL: process.env.TABONKB_COMPANION_URL || 'http://127.0.0.1:28123'
  };
}

const POWERZ_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入 ChargerLAB Power-Z 官方上位机数据接口 ' + POWERZ_MCP_SERVER_NAME + ':\n' +
  '1. powerz_launch_official (唤起官方 Mtools/PDM, 启动前自动预配置)\n' +
  '2. powerz_list_captures (列出 captures 采集目录下官方 .db / PD .sqlite / CSV / jsonl)\n' +
  '3. powerz_analyze_capture (分析采集文件: 电压/电流/峰值功率/容量/能量/温度 + 降采样曲线)\n' +
  '4. powerz_get_capture_data (分页读取原始数据；PD SQLite 读取时间戳和 Raw hex)\n' +
  '【规范】充电数据分析一律基于官方工具采集的实测数据; 若 captures 无数据, 先提示用户用官方 Mtools 录制并保存到采集目录。所有数据经工作台 companion-server 读取。';

module.exports = {
  POWERZ_MCP_SERVER_NAME,
  powerzMcpScriptPath,
  buildPowerzEnv,
  POWERZ_MCP_TOOL_HINT
};
