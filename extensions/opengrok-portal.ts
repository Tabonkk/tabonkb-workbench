import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

// Pi 无 MCP 能力, 故用原生扩展把 OpenGrok 代码搜索引擎工具直接注册给 Pi。
// 核心 REST 逻辑复用 services/opengrok-service.js (与 stdio MCP 桥同一份实现)。
export default function (pi: ExtensionAPI) {
  let runOpengrokTool: any = null;
  let OpengrokService: any = null;
  const servicePath = path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/opengrok-service.js");
  if (fs.existsSync(servicePath)) {
    try {
      const mod = require(servicePath);
      runOpengrokTool = mod.runOpengrokTool;
      OpengrokService = mod.OpengrokService;
    } catch (e) {
      console.warn("[OpenGrokExtension] Failed to require opengrok-service:", e);
    }
  }

  let _svc: any = null;
  function getService() {
    if (_svc) return _svc;
    if (!OpengrokService) return null;
    // 不传 override: service 内部 loadConfig() 会从 env(OPENGROK_*) 优先, 缺失时自读 data.json 回退
    _svc = new OpengrokService();
    return _svc;
  }

  async function call(name: string, params: any) {
    if (!runOpengrokTool) {
      return { content: [{ type: "text", text: "未能加载 opengrok-service 模块, 请检查插件安装路径。" }], details: { error: "service_not_found" } };
    }
    try {
      const text = await runOpengrokTool(name, params || {}, getService());
      return { content: [{ type: "text", text }], details: { tool: name } };
    } catch (err: any) {
      return { content: [{ type: "text", text: `OpenGrok 工具 ${name} 执行异常: ${err.message}` }], details: { error: err.message } };
    }
  }

  pi.registerTool({
    name: "opengrok_list_projects",
    label: "OpenGrok: 列出代码工程",
    description: "列出公司 OpenGrok 代码搜索引擎中所有已索引的手机工程/平台库 (如 W_sprd_os_dev=展锐主线, W_mp1_os_dev=MTK主线等)。在不知道工程名称或需要确定可用项目时先调用此工具。",
    parameters: Type.Object({}),
    async execute(_id, _params, signal) { return call("opengrok_list_projects", {}); }
  });

  pi.registerTool({
    name: "opengrok_search_code",
    label: "OpenGrok: 搜索代码",
    description: "在公司内网 OpenGrok 中高速检索驱动/内核/框架源码。支持全文(full)、函数定义(defs)、符号引用(refs)及文件路径(path)。可通过 project 指定工程库或输入平台别名(如 展锐/MTK/A17)，留空将自动推断。",
    parameters: Type.Object({
      query: Type.String({ description: "检索关键词、函数名、结构体名、宏定义或文件路径 (如 da9030_battery, charger_probe, i2c_register_driver)" }),
      type: Type.Optional(Type.String({ description: "检索模式: full (全文检索, 默认), defs (符号/函数定义), refs (符号引用), path (文件名/路径匹配), hist (Git日志)" })),
      project: Type.Optional(Type.String({ description: "指定检索工程。支持标准工程名 (如 W_sprd_os_dev, W_mp1_os_dev, A17_mp1_os_dev) 或平台别名 (如 \"展锐\", \"MTK\", \"A17\")，支持逗号分隔多工程联合检索。留空则根据问题自动推断。" })),
      max_results: Type.Optional(Type.Number({ description: "返回结果数量上限，默认 20 条，最多 50 条" }))
    }),
    async execute(_id, params: any, signal) { return call("opengrok_search_code", params); }
  });

  pi.registerTool({
    name: "opengrok_read_file",
    label: "OpenGrok: 读取源码片段",
    description: "读取 OpenGrok 中指定工程与文件路径的源码内容。支持指定起止行号精准阅读驱动函数实现或配置文件，带行号格式化呈现。",
    parameters: Type.Object({
      project: Type.String({ description: "工程项目名 (如 W_sprd_os_dev 或 W_mp1_os_dev)" }),
      file_path: Type.String({ description: "文件在工程内的相对路径 (如 vendor_t/bsp/kernel5.15/drivers/power/supply/da9030_battery.c)" }),
      start_line: Type.Optional(Type.Number({ description: "起始行号 (从 1 开始，默认 1)" })),
      end_line: Type.Optional(Type.Number({ description: "结束行号 (默认 start_line + 100 行，单次最多建议读取 200 行避免超长)" }))
    }),
    async execute(_id, params: any, signal) { return call("opengrok_read_file", params); }
  });
}
