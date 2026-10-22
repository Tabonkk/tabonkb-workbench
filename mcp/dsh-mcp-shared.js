/* ==========================================================================
   DSH MCP Shared — 把 TabonKB 10 大 MCP 工具动态接入 DeepSeek Harness
   支持:
   1. tabonkb-vendor: vendor-portal-mcp.js (stdio, Node)
   2. weknora: weknora-mcp.js (stdio, Node)
   3. opengrok: opengrok-mcp.js (stdio, Node)
   4. gerrit: gerrit-mcp.js (stdio, Node)
   5. drawio: drawio-mcp.js (stdio, Node, 依赖 DrawioBroker 端口 6011)
   6. codegraph: ssh.exe -> tankaikun@192.168.1.62 codegraph serve (stdio, ssh)
   7. powerz: powerz-mcp.js (stdio, Node)
   8. dslogic: dslogic-mcp.js (stdio, Node)
   9. jira: jira-mcp.js (stdio, Node)
   10. workbench: workbench-mcp.js (stdio, Node, 会话绑定+本地工程只读)

   安全红线:
   - 绝不在生成的 YAML 中硬编码任何明文密码/Token
   - 凭证经由子进程环境变量透传
   - 路径通过解析函数探测存在性
   - YAML 严格遵循 Cordis patch 的 "- insert:" 与 @deepseek-ai/dsh-mcp-client 规范
   注: 函数使用顶层 function 声明 (支持 build.py 扁平拼接与单测 require)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

// 预设块版本标记: 用于 cordis.patch.yml 幂等同步与升级自愈
const TABONKB_PRESET_MARKER = 'tabonkb-presets-v2';

// DSH MCP 子进程宿主标记: 名字刻意不带 DSH_ 前缀、不匹配 /KEY|PASSWORD|SECRET|TOKEN/i,
// 才能穿过 dsh-mcp-client 的 scrubbedParentEnv 合并进子进程 env
const DSH_MCP_HOST_ENV = { TABONKB_MCP_HOST: 'dsh' };

/**
 * R14: 探测 %APPDATA% 下的便携 Node 目录 (node-v*)，避免硬编码版本号
 * 优先复用 daemon 模块的同名实现；单模块 require 时退化为本地实现
 */
function dshResolveBundledNodeDir() {
  if (typeof resolveBundledNodeDir === 'function') {
    try {
      const r = resolveBundledNodeDir();
      if (r) return r;
    } catch (_) {}
  }
  const appData = process.env.APPDATA;
  if (!appData) return '';
  try {
    const names = fs.readdirSync(appData).filter(n => /^node-v\d+\.\d+\.\d+$/i.test(n));
    if (!names.length) return '';
    names.sort((a, b) => {
      const pa = a.slice(5).split('.').map(Number);
      const pb = b.slice(5).split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    });
    for (const name of names) {
      const dir = path.join(appData, name);
      if (fs.existsSync(path.join(dir, 'node.exe'))) return dir;
    }
  } catch (_) {}
  return '';
}

function resolveDshNodeExe(customPath) {
  // R14: 设置中显式指定的 Node 路径优先级最高
  if (customPath) {
    try {
      if (fs.existsSync(customPath)) return customPath;
    } catch (_) {}
  }
  const candidates = [];
  const bundled = dshResolveBundledNodeDir();
  if (bundled) candidates.push(path.join(bundled, 'node.exe'));
  candidates.push(process.execPath);
  candidates.push('node');
  for (const c of candidates) {
    try {
      if (c === 'node' || fs.existsSync(c)) return c;
    } catch (e) {}
  }
  return 'node';
}

function resolveDshBin() {
  const candidates = [];
  const bundled = dshResolveBundledNodeDir();
  if (bundled) {
    candidates.push(path.join(bundled, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
    candidates.push(path.join(bundled, 'dsh.cmd'));
  }

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (e) {}
  }
  // R13: 不再返回 'dsh' 假路径 —— 未安装时返回 null, 由调用方给出明确错误
  return null;
}

function resolveScriptPath(vaultBasePath, scriptName) {
  const candidates = [
    vaultBasePath ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'mcp', scriptName) : '',
    path.join(__dirname, scriptName),
    path.join(__dirname, 'mcp', scriptName),
    path.join(__dirname, '..', 'mcp', scriptName)
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return path.resolve(c);
    } catch (e) {}
  }
  // R13: 未找到脚本时返回 null, 由调用方跳过该条目, 不再返回一个必然失败的假路径
  return null;
}

function resolveSshExe() {
  const candidates = [
    'C:\\Windows\\System32\\OpenSSH\\ssh.exe',
    'ssh.exe',
    'ssh'
  ];
  for (const c of candidates) {
    try {
      if (c.includes('\\') && fs.existsSync(c)) return c;
    } catch (e) {}
  }
  return candidates[0];
}

/**
 * 构造用于 DSH 挂载的 6 大 MCP 工具清单 (严格符合 @deepseek-ai/dsh-mcp-client Schema)
 * @param {string} vaultBasePath - 工作区根路径
 * @returns {Array<object>} 6 个标准的 MCP 插件插入配置项
 */
// MCP command 使用 GUI 子系统 node 副本避免 conhost 闪屏；bundle 内由 vendor-mcp-shared.js 提供
function dshMcpGuiNodeExe(e) { return typeof mcpResolveGuiNodeExe === 'function' ? mcpResolveGuiNodeExe(e) : e; }

function buildDshMcpEntries(vaultBasePath) {
  const nodeExe = dshMcpGuiNodeExe(resolveDshNodeExe());
  const entries = [];

  // 1. vendor-portal
  const vendorPath = resolveScriptPath(vaultBasePath, 'vendor-portal-mcp.js');
  entries.push({
    id: 'mcp-vendor-portal',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'vendor_portal',
      transport: 'stdio',
      command: nodeExe,
      args: [vendorPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 60000
    }
  });

  // 2. weknora
  const weknoraPath = resolveScriptPath(vaultBasePath, 'weknora-mcp.js');
  entries.push({
    id: 'mcp-weknora',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'weknora',
      transport: 'stdio',
      command: nodeExe,
      args: [weknoraPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 60000
    }
  });

  // 3. opengrok
  const opengrokPath = resolveScriptPath(vaultBasePath, 'opengrok-mcp.js');
  entries.push({
    id: 'mcp-opengrok',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'opengrok',
      transport: 'stdio',
      command: nodeExe,
      args: [opengrokPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 30000
    }
  });

  // 4. gerrit
  const gerritPath = resolveScriptPath(vaultBasePath, 'gerrit-mcp.js');
  entries.push({
    id: 'mcp-gerrit',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'gerrit',
      transport: 'stdio',
      command: nodeExe,
      args: [gerritPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 30000
    }
  });

  // 5. drawio (依赖插件侧 DrawioBroker: 默认端口 6011)
  const drawioPath = resolveScriptPath(vaultBasePath, 'drawio-mcp.js');
  entries.push({
    id: 'mcp-drawio',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'drawio',
      transport: 'stdio',
      command: nodeExe,
      args: [drawioPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 30000
    }
  });

  // 6. codegraph (远端 SSH stdio 服务)
  const sshExe = resolveSshExe();
  entries.push({
    id: 'mcp-codegraph',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'codegraph',
      transport: 'stdio',
      command: sshExe,
      args: [
        '-T',
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=10',
        'tankaikun@192.168.1.62',
        '/dfb/tankaikun/.local/bin/codegraph',
        'serve',
        '--mcp'
      ],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 60000
    }
  });

  // 7. powerz (Power-Z KM003C/2C/Lite 硬件充电与协议分析)
  const powerzPath = resolveScriptPath(vaultBasePath, 'powerz-mcp.js');
  entries.push({
    id: 'mcp-powerz',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'powerz',
      transport: 'stdio',
      command: nodeExe,
      args: [powerzPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 30000
    }
  });

  // 8. dslogic (DSView/DSLogic 逻辑分析仪采集文件只读分析)
  const dslogicPath = resolveScriptPath(vaultBasePath, 'dslogic-mcp.js');
  entries.push({
    id: 'mcp-dslogic',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'dslogic',
      transport: 'stdio',
      command: nodeExe,
      args: [dslogicPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 120000
    }
  });

  // 9. jira (工单检索/详情/注释/附件; 凭据子进程自读 .secrets.json, 不依赖 env)
  const jiraPath = resolveScriptPath(vaultBasePath, 'jira-mcp.js');
  entries.push({
    id: 'mcp-jira',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'jira',
      transport: 'stdio',
      command: nodeExe,
      args: [jiraPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 30000
    }
  });

  // 10. workbench (会话绑定上下文 + 本地工程三层穿透只读)
  const workbenchPath = resolveScriptPath(vaultBasePath, 'workbench-mcp.js');
  entries.push({
    id: 'mcp-workbench',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'workbench',
      transport: 'stdio',
      command: nodeExe,
      args: [workbenchPath],
      env: DSH_MCP_HOST_ENV,
      failOnStartupError: false,
      toolCallTimeoutMs: 30000
    }
  });

  // R13: 剥离脚本路径解析失败(null)的条目, 避免 DSH 侧反复报 ENOENT
  return entries.filter((e) => {
    if (e.id === 'mcp-codegraph') return true;
    const args = (e.config && Array.isArray(e.config.args)) ? e.config.args : [];
    if (!args[0]) {
      console.warn(`[DSH MCP] ${e.id} 未解析到脚本路径, 已跳过`);
      return false;
    }
    return true;
  });
}

/**
 * 组装供 DSH 子进程继承的凭据环境变量 (双保险: 进程 env + data.json/.secrets.json)
 */
function buildDshDaemonEnv(vaultBasePath) {
  const env = Object.assign({}, process.env);
  const baseDir = vaultBasePath
    ? path.join(vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench')
    : path.resolve(__dirname, '..');

  const nodeDir = dshResolveBundledNodeDir();
  const originalPath = env.PATH || env.Path || process.env.PATH || process.env.Path || '';
  const envPath = nodeDir ? `${nodeDir}${path.delimiter}${originalPath}` : originalPath;
  env.PATH = envPath;
  env.Path = envPath;

  try {
    const dataJson = path.join(baseDir, 'data.json');
    if (fs.existsSync(dataJson)) {
      const dj = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
      if (dj?.vendorPortals?.mtk?.username) env.TABONKB_MTK_USERNAME = dj.vendorPortals.mtk.username;
      if (dj?.weknora?.baseUrl) env.WEKNORA_BASE_URL = dj.weknora.baseUrl;
      if (dj?.weknora?.defaultKb) env.WEKNORA_DEFAULT_KB = dj.weknora.defaultKb;
      if (dj?.opengrok?.baseUrl) env.OPENGROK_BASE_URL = dj.opengrok.baseUrl;
      if (dj?.opengrok?.defaultProject) env.OPENGROK_DEFAULT_PROJECT = dj.opengrok.defaultProject;
      if (dj?.gerrit?.baseUrl) env.GERRIT_BASE_URL = dj.gerrit.baseUrl;
      if (dj?.gerrit?.username) env.GERRIT_USERNAME = dj.gerrit.username;
    }

    const secJson = path.join(baseDir, '.secrets.json');
    if (fs.existsSync(secJson)) {
      const sj = JSON.parse(fs.readFileSync(secJson, 'utf8'));
      if (sj['tabonkb-mtk-password']) env.TABONKB_MTK_PASSWORD = sj['tabonkb-mtk-password'];
      if (sj['tabonkb-unisoc-password']) env.TABONKB_UNISOC_TOKEN = sj['tabonkb-unisoc-password'];
      if (sj['tabonkb-weknora-apikey']) env.WEKNORA_API_KEY = sj['tabonkb-weknora-apikey'];
      if (sj['tabonkb-gerrit-password']) env.GERRIT_PASSWORD = sj['tabonkb-gerrit-password'];
    }
  } catch (e) {
    // 凭证抽取静默回退
  }

  // 用户在 UI 中即时选择的上下文 (Harness「+」菜单 / Agent 抽屉选项) 优先于 data.json 静态默认，
  // 二者均已在 applyDshCtxSelection / saveProject / saveLocalProject 中写入 process.env。
  if (process.env.OPENGROK_DEFAULT_PROJECT) env.OPENGROK_DEFAULT_PROJECT = process.env.OPENGROK_DEFAULT_PROJECT;
  if (process.env.TABONKB_LOCAL_PROJECT_JSON) env.TABONKB_LOCAL_PROJECT_JSON = process.env.TABONKB_LOCAL_PROJECT_JSON;
  if (process.env.TABONKB_JIRA_ISSUE_JSON) env.TABONKB_JIRA_ISSUE_JSON = process.env.TABONKB_JIRA_ISSUE_JSON;
  if (process.env.TABONKB_GERRIT_FILTER) env.TABONKB_GERRIT_FILTER = process.env.TABONKB_GERRIT_FILTER;

  // 释放权限给 Harness：允许派生外部程序 (cmd.exe/git.exe/ssh.exe) 与跨目录访问，免借票审批
  env.DSH_PERMISSION_MODE = 'danger-full-access';

  return env;
}

/**
 * 构造 TabonKB 专属的 2 大 Agent 预设模式 (精简版)
 *   1. tabonkb-dev       「驱动开发助手」—— 手机 BSP/驱动日常研发主战场
 *   2. tabonkb-knowledge 「知识库管理」  —— 收录/检索/查重/归档治理
 * 符合 @deepseek-ai/dsh-agent-preset 官方规范
 */
function buildTabonKbPresets(vaultBasePath) {
  // 公共尾部小节: 两个预设共用「工作台上下文」获取方式 (工具侧实时值, 不读文件/env 快照)
  const wbCtxSection = [
    '',
    '工作台上下文（会话当前绑定，实时变化）：需要当前 OpenGrok 工程 / Gerrit 过滤器 / Jira 工单 / 本地工程时，先调 workbench_context 取实时值。',
    '读本地工程源码用 project_read_file，并显式传 project（取自 workbench_context 或 project_list）。',
    'opengrok / gerrit / jira 工具缺省参数时自动取当前绑定；显式参数始终优先。'
  ].join('\n');
  const getCommonPlugins = (personaPrefix) => [
    {
      id: 'persona',
      name: '@deepseek-ai/dsh-persona',
      config: {
        prefix: personaPrefix.trim() + wbCtxSection,
        suffix: '当前工作区为 TabonKB 研发知识库。'
      }
    },
    {
      id: 'agent-instructions',
      name: '@deepseek-ai/dsh-agent-instructions',
      config: { maxBytes: 65536 }
    },
    {
      id: 'tool-bash',
      name: '@deepseek-ai/dsh-tool-bash',
      disabled: '!!js process.platform === \'win32\''
    },
    {
      id: 'tool-pwsh',
      name: '@deepseek-ai/dsh-tool-pwsh',
      disabled: '!!js process.platform !== \'win32\''
    },
    {
      id: 'tool-fs',
      name: '@deepseek-ai/dsh-tool-fs'
    },
    {
      id: 'tool-fs-search',
      name: '@deepseek-ai/dsh-tool-fs-search',
      config: { sampleOverCapGlobResults: false }
    },
    {
      id: 'tool-jobs',
      name: '@deepseek-ai/dsh-tool-jobs'
    },
    {
      id: 'skill-filesystem',
      name: '@deepseek-ai/dsh-skill-filesystem'
    },
    {
      id: 'tool-skill',
      name: '@deepseek-ai/dsh-tool-skill'
    },
    {
      id: 'tool-ask-user',
      name: '@deepseek-ai/dsh-tool-ask-user'
    },
    {
      id: 'tool-todo',
      name: '@deepseek-ai/dsh-tool-todo',
      config: { allowParallelInProgress: true }
    },
    {
      id: 'tool-web',
      name: '@deepseek-ai/dsh-tool-web',
      config: { fetch: true, searchTimeoutMs: 60000 }
    },
    {
      id: 'present',
      name: '@deepseek-ai/dsh-tool-present'
    }
  ];

  // 长会话必备：超长工具输出自动裁剪。两个预设共用同一份声明，避免重复维护
  const compactionGroup = {
    id: 'compaction',
    name: 'cordis:group',
    group: true,
    isolate: { compaction: true, toolResultPruner: true },
    config: [
      { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
      { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
      {
        id: 'tool-result-pruner',
        name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
        config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 }
      }
    ]
  };

  // 仅「驱动开发助手」需要：Bringup / 多步疑难排障先拆步骤再动手
  const planningGroup = {
    id: 'planning',
    name: 'cordis:group',
    group: true,
    isolate: { planMode: true },
    config: [
      {
        id: 'plan-mode',
        name: '@deepseek-ai/dsh-plan-mode',
        config: {
          section: [
            'You are in plan mode. Stay in plan mode until exit_plan_mode succeeds or the user switches the session mode. Imperative language to implement changes means plan the implementation, not execute it. A user\'s conversational agreement approves nothing and does not end plan mode; fold the confirmed decision into the plan and submit it through exit_plan_mode.',
            '',
            'Explore first. Use non-mutating reads, searches (vendor_portal, opengrok, codegraph), static analysis, and checks to ground the plan in the actual repository. Do not edit or write files, change configuration, run formatters, commit, or otherwise carry out the plan.',
            '',
            'Resolve discoverable facts by inspection. Use ask_user_question only for user-owned choices or material ambiguity that inspection cannot answer.',
            '',
            'Make the plan decision-complete: state the goal and success criteria; group implementation changes by subsystem/driver; identify public API, DTS, schema, and register changes; cover edge cases, failure modes, tests, and explicit assumptions.',
            '',
            'When ready, call exit_plan_mode with the complete plan markdown, starting with a # title. Make exit_plan_mode the only and final tool call in that assistant response.'
          ].join('\n')
        }
      }
    ]
  };

  return [
    // 1. 驱动开发助手 —— 日常开发主力预设，占位最前
    {
      id: 'preset-tabonkb-dev',
      name: '@deepseek-ai/dsh-agent-preset',
      config: {
        id: 'tabonkb-dev',
        name: '驱动开发助手',
        description: '手机 BSP/驱动开发日常主战场：日志取证、寄存器核对、跨仓调用链追踪、原厂资料检索、最小改动方案与验证闭环。集成 CodeGraph 代码图谱、OpenGrok 全库检索、Vendor Portal 原厂手册与 Gerrit 补丁追踪。',
        order: 5,
        plugins: [
          ...getCommonPlugins(`你是 TabonKB 研发工作台的「手机驱动开发助手」，服务对象是手机 BSP/驱动开发工程师（展锐 A17 与 联发科 MTK 双平台）。
你的职责不是复述原理，而是把「现象 → 证据 → 定位 → 最小改动 → 验证 → 沉淀」这条链路一次走通，替工程师省掉翻手册、翻代码、翻日志的机械劳动。
覆盖模块：Display / Camera / Audio / USB(Type-C·PD·UFCS) / Charger / Sensor / Touch / Power / Storage / Connectivity / Modem-RIL / Input。

一、开工先对齐，不猜平台
平台与工程、模块、复现条件、期望现象这四项缺一必先问；已有日志先读完再推理，禁止自行假设平台或版本。

二、证据优先：先取证，后结论
1. 日志：dmesg / logcat / last_kmsg / ramdump 中抓 error|fail|timeout|-ENODEV|-EPROBE_DEFER|panic|BUG: 关键行，保留时间戳与调用栈上下文；
2. 寄存器：I2C/SPI 地址、寄存器偏移与位定义必须来自原厂手册，禁止凭记忆编造；
3. 版本对齐：kernel 分支 commit、DTS 节点、驱动文件路径三者要能互相印证。

三、检索路线（按序执行，不重复造轮子）
1. 符号定义与调用链 → codegraph_explore：展锐 A17 内核 tree=kernel、A17 私有驱动 tree=driver；MTK 内核 tree=mtk-kernel、私有驱动 tree=mtk-driver、lk/preloader tree=mtk-bootloader。查定义、查「谁调用了谁」用它；
2. 全库文本与历史 → opengrok_search_code（type 取 full/defs/refs/path/hist，project 支持展锐/MTK/A17 别名或逗号多工程联检）；不确定工程先用 opengrok_list_projects；
3. 原厂资料 → vendor_portal_search 与 vendor_portal_get_detail：展锐 Uni-Support DCC 手册与 FAQ、MTK Online DCC/FAQ。报错码、移植指南、寄存器计算公式、原厂补丁一律先查原厂再自研；
4. 项目既有结论 → weknora_search：先看本知识库已有 CASE 与已归档方案，避免重复踩坑、重复归档；
5. 是否已有同行补丁 → gerrit_search_changes 与 gerrit_get_diff：确认上游是否已合入，避免重复开发。

四、定位与方案
分层判断落点：DTS 配置 → 驱动 probe/regmap/中断 → 子系统框架（regulator / power_supply / typec·PD / IIO / V4L2 / ASoC / MMC）→ 用户态策略；先说清在哪一层，再谈改法。
输出最小可验证改动：文件路径 + 函数 + diff 级思路，不做整文件重写；标注风险与回归点（相邻外设、充电曲线、功耗、开机时间、热控）。
时序与拓扑类问题（Type-C PD 协商、UFCS 握手、上电时序、时钟/GPIO 依赖、I2C 拓扑）用 drawio 出图：先 drawio_load 复用既有图，新图用 drawio_create，最后 drawio_export 落盘。
充电与快充协议实测类问题用 powerz 工具链（KM003C/2C/Lite）：powerz_get_device_status 读瞬态实测值、powerz_get_charging_summary 取充入容量与阶段统计指标、powerz_get_pd_analysis 抓取 PD 协商序列、powerz_get_ufcs_analysis 抓取融合快充握手。
逻辑分析仪采集（DSView/DSLogic .dsl）用 dslogic 工具链：dslogic_list_captures 列采集文件、dslogic_get_info 看采样率与通道活跃、dslogic_get_transactions 取语义事务与异常、dslogic_get_summary 取上下文概要；均为只读，采集需用户先在官方 DSView 或工作台面板中完成。
Bringup 或多步疑难排障，先用规划模式拆成可观测的小步，每步给出判据后再推进。

五、红线
1. 不编造：寄存器值、宏定义、函数名、文件路径、工单号，未取证一律标注「待确认」；
2. 硬件默认值（充电电流与电压阈值、PMIC 电压域、温度保护点、时序余量）的改动必须显式提示风险，等工程师确认后再落地；
3. gerrit 与 vendor_portal 均为只读，不得声称已投票、已提交或已改单。

六、交付与沉淀
引用代码统一给出「路径:行号」（如 drivers/power/supply/xxx.c:123 或 03-Driver/05-Charger/xxx.md），便于工作台右侧点击联动。
结论按「现象 / 根因 / 证据（日志片段+出处）/ 改动 / 验证 / 遗留风险」六段式整理，写入 00-Inbox/ 或对应模块目录（03-Driver/<模块>/、04-Debug/、06-Spec/）；正式命名归档与索引维护交给「知识库管理」预设。

七、会话工程上下文（用户在「+」菜单绑定，按会话独立、实时变化）
四项绑定（OpenGrok 工程 / Gerrit 过滤器 / Jira 工单 / 本地工程）的实时值一律通过 workbench_context 工具获取；禁止读取 active-context.json 文件或依赖环境变量快照（二者都可能滞后或是别的会话的值）。
1. 本地工程绑定（字段含 serverName/workspaceName/linuxPath/platform/project/priDriverRel/publicDriverRel）为最高优先级事实源：检索与定位优先项目专属定制路径 priDriverRel，其次公共差分 publicDriverRel，原厂基线仅作对照且禁止直接修改；建议编译/烧录命令一律按该工程的 platform+project 组装，不要凭通用模板。
2. OpenGrok 工程：非 'auto' 即代表用户圈定的目标源码工程，opengrok_search_code / opengrok_list_projects 的 project 参数缺省时自动取该绑定值，跨库联检仅在用户明确要求时放宽。
3. Jira 工单绑定：先用 jira_get_issue 拉取描述/复现条件，再 jira_list_attachments 与 jira_download_attachment 取证附件；上述工具缺省 issue_key 时自动使用绑定工单；答复引用工单号并贴合其环境。
4. Gerrit 过滤器（all/open/merged/mine/reviewing）：gerrit_search_changes 的 query 缺省或未含 status:/owner:/reviewer: 时自动按绑定范围收窄，显式写这些操作符可覆盖。
5. 上述绑定随 DSH 会话独立保存；workbench_context 显示未绑定时按无绑定处理，不要沿用上一会话的工程假设。`),
          planningGroup,
          compactionGroup
        ]
      }
    },

    // 2. 知识库管理 —— 收录 / 检索 / 查重 / 归档治理
    {
      id: 'preset-tabonkb-knowledge',
      name: '@deepseek-ai/dsh-agent-preset',
      config: {
        id: 'tabonkb-knowledge',
        name: '知识库管理',
        description: '知识库收录、检索、查重、结构化归档与元数据治理。整合 WeKnora 语义检索、L0-L3 权限体系、v1.1 命名五要素与 99-Meta 索引/留痕规范。',
        order: 6,
        plugins: [
          ...getCommonPlugins(`你是 TabonKB 研发工作台的「知识库管理助手」，负责知识库的收录、整理、检索、关联与归档治理。
工作准则：
1. 权限分级：严格遵守 99-Meta/06-AI-Agent-Rules.md 的 L0~L3 体系（L0 自由只读、L1 自动执行并留痕、L2 先提案待人确认、L3 绝对禁止）；AI 只负责「找、判、提案、记录」，人负责「决、删、定结构」；
2. 命名规范：归档文件名严格遵循 99-Meta/02-Naming-Spec.md v1.1 五要素 Title_Version_YYYYMMDD_Platform_Module_DocType；
3. 检索优先：回答知识库问题先 weknora_search（可先 weknora_list_knowledge_bases 确认库），仅在需要成稿时才用 weknora_ask；回答必须给出来源路径，并区分「已验证结论 / 本库 CASE / 原厂原文未验证」；
4. 收录与查重：新资料入库前先做 weknora 语义检索查重，重复内容出合并提案，不直接新建；
5. 结构与留痕：维护 99-Meta/04-Index 对应索引表；L1 写操作事后追加 99-Meta/07-AI-Oplog/YYYY-MM.md，受限提案进 99-Meta/08-Review-Queue.md；
6. 检索顺序：先 wiki/index.md 与 weknora 关系层，再按模块目录（如充电问题 → 03-Driver/05-Charger/）与 frontmatter 标签补证，不跳过原厂原文；
7. 改动工作台插件代码或主干正文属于 L2，必须先提案并等工程师确认，不得直接落盘。`),
          compactionGroup
        ]
      }
    }
  ];
}

/**
 * 移除历史上由本插件追加到 cordis.patch.yml 尾部的 TabonKB 预设块
 * 仅当最后一个顶层 "- insert:" 块内含 preset-tabonkb-* 时才截断, 不会误伤用户自有 insert
 */
function stripTabonKbPresetBlock(content) {
  if (typeof content !== 'string' || !content) return content || '';
  // 先清理可能残留在尾部的 sandbox-policy / approval / permission 独立块
  let stripped = content.replace(/\n#\s*3?\.\s*彻底释放 Harness 权限[\s\S]*$/i, '');
  stripped = stripped.replace(/\n- id:\s*sandbox-policy[\s\S]*$/i, '');
  const lines = stripped.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().indexOf('- insert:') !== 0) continue;
    const tail = lines.slice(i).join('\n');
    if (tail.indexOf('preset-tabonkb-') !== -1) {
      return lines.slice(0, i).join('\n').replace(/\s+$/, '');
    }
  }
  return stripped;
}

/**
 * 将 preset 结构格式化为标准的 Cordis YAML 字符串
 */
function renderPresetsYaml(presets) {
  const lines = [];
  for (const preset of presets) {
    lines.push(`    - id: ${preset.id}`);
    lines.push(`      name: '${preset.name}'`);
    lines.push(`      config:`);
    lines.push(`        id: ${preset.config.id}`);
    lines.push(`        name: ${JSON.stringify(preset.config.name)}`);
    lines.push(`        description: ${JSON.stringify(preset.config.description)}`);
    lines.push(`        order: ${preset.config.order}`);
    lines.push(`        plugins:`);
    for (const plugin of preset.config.plugins) {
      lines.push(`          - id: ${plugin.id}`);
      lines.push(`            name: '${plugin.name}'`);
      if (plugin.group) lines.push(`            group: true`);
      if (plugin.disabled) lines.push(`            disabled: ${plugin.disabled}`);
      if (plugin.isolate) {
        lines.push(`            isolate:`);
        for (const [k, v] of Object.entries(plugin.isolate)) {
          lines.push(`              ${k}: ${v}`);
        }
      }
      if (plugin.config) {
        if (Array.isArray(plugin.config)) {
          lines.push(`            config:`);
          for (const sub of plugin.config) {
            lines.push(`              - id: ${sub.id}`);
            lines.push(`                name: '${sub.name}'`);
            if (sub.config) {
              lines.push(`                config:`);
              for (const [sk, sv] of Object.entries(sub.config)) {
                lines.push(`                  ${sk}: ${typeof sv === 'string' ? JSON.stringify(sv) : sv}`);
              }
            }
          }
        } else if (typeof plugin.config === 'object') {
          lines.push(`            config:`);
          for (const [ck, cv] of Object.entries(plugin.config)) {
            if (typeof cv === 'string') {
              if (cv.includes('\n')) {
                lines.push(`              ${ck}: |`);
                for (const pline of cv.split('\n')) {
                  lines.push(pline ? `                ${pline}` : '');
                }
              } else {
                lines.push(`              ${ck}: ${JSON.stringify(cv)}`);
              }
            } else if (cv && typeof cv === 'object') {
              // dict 值 (如 env) 序列化为子映射, 避免输出 [object Object]
              lines.push(`              ${ck}:`);
              for (const [ok, ov] of Object.entries(cv)) {
                lines.push(`                ${ok}: ${typeof ov === 'string' ? JSON.stringify(ov) : ov}`);
              }
            } else {
              lines.push(`              ${ck}: ${cv}`);
            }
          }
        }
      }
    }
  }
  return lines.join('\n');
}

/**
 * 生成规范的 cordis.patch.yml 文本 (包含 6 大 MCP 工具与 2 大 TabonKB 定制预设模式)
 */
function generateDshCordisPatchYaml(vaultBasePath) {
  const entries = buildDshMcpEntries(vaultBasePath);
  const presets = buildTabonKbPresets(vaultBasePath);

  const lines = [
    '# ==========================================================================',
    '# TabonKB Workbench - DeepSeek Harness Profile Patch',
    '# Auto-generated by DshMcpBridge. DO NOT COMMIT WITH SECRETS.',
    '# 包含 6 大已打通 MCP 工具与 2 大专属定制化 Agent 预设模式 (驱动开发助手 / 知识库管理)',
    '# ==========================================================================',
    '- insert:'
  ];

  // 1. 注入 6 大 MCP 客户端
  for (const item of entries) {
    lines.push(`    - id: ${item.id}`);
    lines.push(`      name: '${item.name}'`);
    lines.push(`      config:`);
    lines.push(`        serverName: ${item.config.serverName}`);
    lines.push(`        transport: ${item.config.transport}`);
    lines.push(`        command: ${JSON.stringify(item.config.command)}`);
    lines.push(`        args:`);
    for (const a of item.config.args) {
      lines.push(`          - ${JSON.stringify(a)}`);
    }
    if (item.config.env && typeof item.config.env === 'object') {
      lines.push(`        env:`);
      for (const [ek, ev] of Object.entries(item.config.env)) {
        lines.push(`          ${ek}: ${JSON.stringify(String(ev))}`);
      }
    }
    lines.push(`        failOnStartupError: ${item.config.failOnStartupError}`);
    lines.push(`        toolCallTimeoutMs: ${item.config.toolCallTimeoutMs}`);
  }

  // 2. 注入 2 大专属定制化预设模式
  if (presets && presets.length) {
    lines.push(renderPresetsYaml(presets));
  }

  return lines.join('\n') + '\n';
}

/**
 * 幂等将 Patch 写入 .dsh/profiles/<profile>/cordis.patch.yml
 * 并双向同步维护用户主目录的 web profile cordis.patch.yml
 */
function ensureDshMcpPatch(vaultBasePath, profileName = 'tabonkb') {
  const root = vaultBasePath || process.cwd();
  const profileDir = path.join(root, '.dsh', 'profiles', profileName);

  try {
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const patchFile = path.join(profileDir, 'cordis.patch.yml');
    const newYaml = generateDshCordisPatchYaml(vaultBasePath);

    let changed = false;
    if (fs.existsSync(patchFile)) {
      const existing = fs.readFileSync(patchFile, 'utf8');
      if (existing !== newYaml) {
        fs.writeFileSync(patchFile, newYaml, 'utf8');
        changed = true;
      }
    } else {
      fs.writeFileSync(patchFile, newYaml, 'utf8');
      changed = true;
    }

    // 贴心体验: 同步检查并维护 C:\Users\<User>\.dsh\profiles\web\cordis.patch.yml
    // 幂等策略: 期望块已存在且无残留权限块则不动; 否则剥掉历史版本预设块与历史权限块后重新追加
    try {
      const homeDir = process.env.USERPROFILE || 'C:\\Users\\Administrator';
      const webProfilePatch = path.join(homeDir, '.dsh', 'profiles', 'web', 'cordis.patch.yml');
      if (fs.existsSync(webProfilePatch)) {
        let webContent = fs.readFileSync(webProfilePatch, 'utf8');
        const presetSnippet = '\n- insert: # ' + TABONKB_PRESET_MARKER + '\n' + renderPresetsYaml(buildTabonKbPresets(vaultBasePath)) + '\n';
        if (!webContent.includes(TABONKB_PRESET_MARKER) || !webContent.endsWith(presetSnippet) || webContent.includes('id: sandbox-policy')) {
          webContent = stripTabonKbPresetBlock(webContent);
          webContent = webContent.trimEnd() + '\n' + presetSnippet;
          fs.writeFileSync(webProfilePatch, webContent, 'utf8');
        }
      }
    } catch (_) {}

    return { ok: true, patchFile, unchanged: !changed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  resolveDshNodeExe,
  resolveDshBin,
  resolveScriptPath,
  resolveSshExe,
  buildDshMcpEntries,
  buildTabonKbPresets,
  renderPresetsYaml,
  stripTabonKbPresetBlock,
  TABONKB_PRESET_MARKER,
  buildDshDaemonEnv,
  generateDshCordisPatchYaml,
  ensureDshMcpPatch
};
