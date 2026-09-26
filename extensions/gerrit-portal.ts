import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

// Pi 无 MCP 能力, 故用原生扩展把 Gerrit 代码评审只读工具直接注册给 Pi。
// 核心 REST 逻辑复用 services/gerrit-service.js (与 stdio MCP 桥同一份实现)。
// 【安全边界】只读工具链。严禁提供任何 Review、Submit、Vote、Abandon 接口。
export default function (pi: ExtensionAPI) {
  let runGerritTool: any = null;
  let GerritService: any = null;
  const possiblePaths = [
    path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/gerrit-service.js"),
    path.resolve(__dirname, "../services/gerrit-service.js"),
    "d:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/gerrit-service.js"
  ];
  for (const sp of possiblePaths) {
    if (fs.existsSync(sp)) {
      try {
        const mod = require(sp);
        runGerritTool = mod.runGerritTool;
        GerritService = mod.GerritService;
        break;
      } catch (e) {
        console.warn("[GerritExtension] Failed to require gerrit-service from " + sp + ":", e);
      }
    }
  }

  let _svc: any = null;
  function getService() {
    if (_svc) return _svc;
    if (!GerritService) return null;
    _svc = new GerritService();
    return _svc;
  }

  async function call(name: string, params: any) {
    if (!runGerritTool) {
      return { content: [{ type: "text", text: "未能加载 gerrit-service 模块, 请检查插件安装路径。" }], details: { error: "service_not_found" } };
    }
    try {
      const text = await runGerritTool(name, params || {}, getService());
      return { content: [{ type: "text", text }], details: { tool: name } };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Gerrit 工具 ${name} 执行异常: ${err.message}` }], details: { error: err.message } };
    }
  }

  pi.registerTool({
    name: "gerrit_search_changes",
    label: "Gerrit: 检索代码变更",
    description: "检索企业 Gerrit 系统中的代码评审变更 (Changes)。支持状态过滤 (open/merged/abandoned)、工程名过滤、分支、提交号及通用搜索关键词。严格只读。",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "检索关键词或 Gerrit 查询表达式 (如 \"status:open branch:main\", \"camera driver\", \"owner:self\")" })),
      status: Type.Optional(Type.String({ description: "变更状态过滤: open (评审中, 默认), merged (已合入), abandoned (已废弃), all (全部)" })),
      project: Type.Optional(Type.String({ description: "指定代码工程仓库 (如 sprd/kernel, mtk/platform)" })),
      branch: Type.Optional(Type.String({ description: "指定目标 Git 分支" })),
      limit: Type.Optional(Type.Number({ description: "最大返回结果数量，默认 15 条，最多 50 条" }))
    }),
    async execute(_id, params: any, signal) { return call("gerrit_search_changes", params); }
  });

  pi.registerTool({
    name: "gerrit_get_change",
    label: "Gerrit: 查看变更详情",
    description: "查阅指定 Gerrit 变更的完整元数据，包括 Change-Id、提交者、主题、当前分支、评审人投票评分 (Code-Review) 以及讨论留言流。严格只读。",
    parameters: Type.Object({
      change_id: Type.String({ description: "Gerrit 变更号 (如 \"12345\") 或 Change-Id 字符串 (如 \"I1a2b3c4d...\")" })
    }),
    async execute(_id, params: any, signal) { return call("gerrit_get_change", params); }
  });

  pi.registerTool({
    name: "gerrit_get_diff",
    label: "Gerrit: 查看代码 Diff 与补丁",
    description: "查阅 Gerrit 代码变更的实际差异 (Diff)。若指定 file_path 则返回文件级逐行添加/删除对比；若未指定则返回该 Revision 的全量 Unified Git Patch。严格只读。",
    parameters: Type.Object({
      change_id: Type.String({ description: "Gerrit 变更号 (如 \"12345\")" }),
      revision_id: Type.Optional(Type.String({ description: "PatchSet 版本号 (如 \"1\", \"2\") 或 \"current\" (默认当前最新版本)" })),
      file_path: Type.Optional(Type.String({ description: "可选。指定文件路径 (如 drivers/power/supply/charger.c)。留空则返回全量 Git Patch" }))
    }),
    async execute(_id, params: any, signal) { return call("gerrit_get_diff", params); }
  });

  pi.registerTool({
    name: "gerrit_get_comments",
    label: "Gerrit: 查阅代码行内评审意见",
    description: "查阅代码评审人员在指定变更代码行中发表的讨论与审查意见 (Inline Comments)。只读工具。",
    parameters: Type.Object({
      change_id: Type.String({ description: "Gerrit 变更号 (如 \"12345\")" })
    }),
    async execute(_id, params: any, signal) { return call("gerrit_get_comments", params); }
  });

  pi.registerTool({
    name: "gerrit_list_projects",
    label: "Gerrit: 列出代码仓库",
    description: "列出 Gerrit 系统中托管的 Git 项目仓库清单。只读工具。",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "可选。项目名过滤前缀" })),
      limit: Type.Optional(Type.Number({ description: "最大返回仓库数量，默认 25" }))
    }),
    async execute(_id, params: any, signal) { return call("gerrit_list_projects", params); }
  });
}
