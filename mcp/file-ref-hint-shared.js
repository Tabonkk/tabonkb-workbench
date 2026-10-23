/* ==========================================================================
   File Reference Hint Shared — 统一向各 CLI Agent 注入「文件引用格式」硬规则
   目的: Agent 回答中引用源码文件时必须给出完整绝对路径 (含中间目录),
         禁止裸文件名/省略层级/凭记忆拼目录, 否则点击链接无法定位文件。
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升);
       名称统一加 fileRef 前缀避免与其它模块冲突。
   ========================================================================== */

const fs = require('fs');
const path = require('path');

/** 读取 active-context.json 中的当前选中工程 (失败返回 null, 永不抛错) */
function fileRefReadActiveProject(vaultBasePath) {
  try {
    const base = String(vaultBasePath || '').trim();
    if (!base) return null;
    const file = path.join(base, '.obsidian', 'plugins', 'tabonkb-workbench', 'active-context.json');
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw && raw.selectedLocalProject ? raw.selectedLocalProject : null;
  } catch (_) {
    return null;
  }
}

/**
 * 构造文件引用格式系统指令 (拼在用户 prompt 末尾, 与既有 *-mcp-shared 的 HINT 同语义)
 * @param {string} [vaultBasePath] vault 根目录, 用于读取当前工程锚点
 * @returns {string}
 */
function buildFileRefHint(vaultBasePath) {
  const proj = fileRefReadActiveProject(vaultBasePath);
  const win = (proj && proj.fullPathWin) ? proj.fullPathWin : 'Y:\\01';
  const lin = (proj && proj.linuxPath) ? proj.linuxPath : '/dfb/tankaikun/share/01';
  const priRel = (proj && proj.priDriverRel) ? proj.priDriverRel : 'pri_project/driver/<platform>/<project>/base';
  const sampleWin = `${win}\\${String(priRel).replace(/\//g, '\\')}\\kernel\\kernel_device_modules-6.12\\drivers\\...`;
  return '\n\n[系统指令] 文件引用格式 (强制):\n'
    + '1. 回答中提及任何源码/配置/日志文件时, 必须输出完整绝对路径 (含全部中间目录), 禁止只写裸文件名或省略层级;\n'
    + `2. Windows 侧写成 ${win}\\... 形式, Linux 侧写成 ${lin}/... 形式, 行号用 :NN 后缀 (如 x.c:118);\n`
    + '3. 路径必须取自本轮 read/grep/opengrok 工具返回的真实路径, 禁止凭记忆拼接或猜测目录;\n'
    + `4. 当前工程根: ${win} <-> ${lin}; 常用树: vendor_w (内核主线), ${priRel} (项目定制, 其下仍含 kernel/kernel_device_modules-<ver>/drivers/...);\n`
    + `5. 示例: ${sampleWin}`;
}

module.exports = { buildFileRefHint, fileRefReadActiveProject };
