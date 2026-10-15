import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

// Pi 无 MCP 能力, 故用原生扩展把 Jira 工单只读/下载工具直接注册给 Pi。
// 核心 REST 逻辑复用 services/jira-service.js (与 stdio MCP 桥同一份实现)。
// 附件下载落盘约定: 00-Inbox/03-Quick-Note/<ISSUE_KEY>/attachments/
export default function (pi: ExtensionAPI) {
  let runJiraTool: any = null;
  let JiraService: any = null;
  const possiblePaths = [
    path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/jira-service.js"),
    path.resolve(__dirname, "../services/jira-service.js"),
    "d:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/jira-service.js"
  ];
  for (const sp of possiblePaths) {
    if (fs.existsSync(sp)) {
      try {
        const mod = require(sp);
        runJiraTool = mod.runJiraTool;
        JiraService = mod.JiraService;
        break;
      } catch (e) {
        console.warn("[JiraExtension] Failed to require jira-service from " + sp + ":", e);
      }
    }
  }

  let _svc: any = null;
  function getService() {
    if (_svc) return _svc;
    if (!JiraService) return null;
    // vaultBasePath 供 getIssueWorkspaceDir 定位 00-Inbox/03-Quick-Note
    _svc = new JiraService({ vaultBasePath: process.cwd() });
    return _svc;
  }

  async function call(name: string, params: any) {
    if (!runJiraTool) {
      return { content: [{ type: "text", text: "未能加载 jira-service 模块, 请检查插件安装路径。" }], details: { error: "service_not_found" } };
    }
    try {
      const text = await runJiraTool(name, params || {}, getService());
      return { content: [{ type: "text", text }], details: { tool: name } };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Jira 工具 ${name} 执行异常: ${err.message}` }], details: { error: err.message } };
    }
  }

  pi.registerTool({
    name: "jira_search_issues",
    label: "Jira: 检索工单",
    description: "在公司 Jira 系统中检索缺陷/任务工单。query 支持工单号直达 (如 SPE123-199)、关键词模糊检索、或完整 JQL 表达式。返回工单号/标题/状态/经办人/优先级清单。只读。",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "工单号 (如 SPE123-199)、关键词 (如 \"快充 不工作\") 或完整 JQL" })),
      limit: Type.Optional(Type.Number({ description: "最大返回数量，默认 20，最多 50" }))
    }),
    async execute(_id, params: any, signal) { return call("jira_search_issues", params); }
  });

  pi.registerTool({
    name: "jira_get_issue",
    label: "Jira: 工单详情",
    description: "查阅指定 Jira 工单完整详情：标题、状态、经办人、优先级、模块、标签、修复版本、完整描述、最近注释与附件清单，并告知该工单专属工作目录 (00-Inbox/03-Quick-Note/<KEY>/)。只读。",
    parameters: Type.Object({
      issue_key: Type.String({ description: "Jira 工单号 (如 SPE123-199)" })
    }),
    async execute(_id, params: any, signal) { return call("jira_get_issue", params); }
  });

  pi.registerTool({
    name: "jira_get_comments",
    label: "Jira: 注释记录",
    description: "查阅指定 Jira 工单的全部历史注释/讨论记录 (含作者与时间)。只读。",
    parameters: Type.Object({
      issue_key: Type.String({ description: "Jira 工单号" })
    }),
    async execute(_id, params: any, signal) { return call("jira_get_comments", params); }
  });

  pi.registerTool({
    name: "jira_list_attachments",
    label: "Jira: 附件清单",
    description: "列出指定 Jira 工单挂载的全部附件 (文件名/大小/类型/上传人)，用于定位 log 日志、截图、抓包文件。只读。",
    parameters: Type.Object({
      issue_key: Type.String({ description: "Jira 工单号" })
    }),
    async execute(_id, params: any, signal) { return call("jira_list_attachments", params); }
  });

  pi.registerTool({
    name: "jira_download_attachment",
    label: "Jira: 下载附件日志",
    description: "下载指定 Jira 工单的附件 (log/截图/抓包/复现视频等) 到知识库 00-Inbox/03-Quick-Note/<KEY>/attachments/ 下，返回本地绝对路径；下载后用 read/grep 等工具对日志进行分析。attachment 支持附件 id、完整文件名或文件名片段。",
    parameters: Type.Object({
      issue_key: Type.String({ description: "Jira 工单号" }),
      attachment: Type.String({ description: "附件 id、完整文件名或文件名片段 (如 \"logcat\" / \"main.log\" / \"12893\")" })
    }),
    async execute(_id, params: any, signal) { return call("jira_download_attachment", params); }
  });
}
