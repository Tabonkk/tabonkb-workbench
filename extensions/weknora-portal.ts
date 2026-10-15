import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

// Pi 无 MCP 能力, 故用原生扩展把 WeKnora 知识库工具直接注册给 Pi。
// 核心 REST 逻辑复用 services/weknora-service.js (与 stdio MCP 桥同一份实现)。
export default function (pi: ExtensionAPI) {
  let runWeknoraTool: any = null;
  let WeknoraService: any = null;
  const servicePath = path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/weknora-service.js");
  if (fs.existsSync(servicePath)) {
    try {
      const mod = require(servicePath);
      runWeknoraTool = mod.runWeknoraTool;
      WeknoraService = mod.WeknoraService;
    } catch (e) {
      console.warn("[WeknoraExtension] Failed to require weknora-service:", e);
    }
  }

  let _svc: any = null;
  function getService() {
    if (_svc) return _svc;
    if (!WeknoraService) return null;
    // 不传 override: service 内部 loadConfig() 会 env(WEKNORA_*) 优先, 缺失时自读 data.json/.secrets.json 回退
    _svc = new WeknoraService();
    return _svc;
  }

  async function call(name: string, params: any) {
    if (!runWeknoraTool) {
      return { content: [{ type: "text", text: "未能加载 weknora-service 模块, 请检查插件安装路径。" }], details: { error: "service_not_found" } };
    }
    try {
      const text = await runWeknoraTool(name, params || {}, getService());
      return { content: [{ type: "text", text }], details: { tool: name } };
    } catch (err: any) {
      return { content: [{ type: "text", text: `WeKnora 工具 ${name} 执行异常: ${err.message}` }], details: { error: err.message } };
    }
  }

  const KB = Type.Optional(Type.String({ description: "知识库名称或 UUID; 留空则使用默认/第一个知识库" }));

  pi.registerTool({
    name: "weknora_list_knowledge_bases",
    label: "WeKnora: 列出知识库",
    description: "列出 WeKnora 团队知识库中的全部知识库 (id / 名称 / 文档数), 用于确定后续检索/问答的 kb 参数。",
    parameters: Type.Object({}),
    async execute(_id, _params, signal) { return call("weknora_list_knowledge_bases", {}); }
  });

  pi.registerTool({
    name: "weknora_search",
    label: "WeKnora: 混合检索",
    description: "知识库默认检索。向量+关键词混合检索, 返回最相关分块与来源。询问项目知识、排障案例、平台文档时优先用本工具, 不要改调 weknora_ask。",
    parameters: Type.Object({
      query: Type.String({ description: "检索关键词或问题" }),
      kb: KB,
      match_count: Type.Optional(Type.Number({ description: "返回分块数量, 默认 5" }))
    }),
    async execute(_id, params: any, signal) { return call("weknora_search", params); }
  });

  pi.registerTool({
    name: "weknora_ask",
    label: "WeKnora: RAG 问答",
    description: "非默认路径。服务端再跑一轮 RAG 并返回带引用成稿, 经常耗时数分钟。仅当用户明确要求知识库直接作答且 weknora_search 片段不够时单独调用。不要与 weknora_search 并行。",
    parameters: Type.Object({
      query: Type.String({ description: "完整自然语言问题" }),
      kb: KB
    }),
    async execute(_id, params: any, signal) { return call("weknora_ask", params); }
  });

  pi.registerTool({
    name: "weknora_list_documents",
    label: "WeKnora: 文档清单",
    description: "分页列出某知识库中的文档条目 (标题 / id / 类型 / 解析状态 / 摘要)。",
    parameters: Type.Object({
      kb: KB,
      page: Type.Optional(Type.Number({ description: "页码, 从 1 开始" })),
      page_size: Type.Optional(Type.Number({ description: "每页条数, 默认 20" }))
    }),
    async execute(_id, params: any, signal) { return call("weknora_list_documents", params); }
  });

  pi.registerTool({
    name: "weknora_read_document",
    label: "WeKnora: 读取文档",
    description: "按 knowledge_id 读取单篇文档详情 (标题 / 摘要 / 状态 / 手工正文 Markdown 若有)。",
    parameters: Type.Object({
      knowledge_id: Type.String({ description: "文档条目 ID" })
    }),
    async execute(_id, params: any, signal) { return call("weknora_read_document", params); }
  });

  pi.registerTool({
    name: "weknora_add_document",
    label: "WeKnora: 新增文档(写)",
    description: "向知识库新增一篇 Markdown 文档。默认 status=publish 立即索引可检索; 传 draft 仅保存不索引。",
    parameters: Type.Object({
      title: Type.String({ description: "文档标题" }),
      content: Type.String({ description: "Markdown 正文" }),
      kb: KB,
      status: Type.Optional(Type.String({ description: "publish(默认) 或 draft" }))
    }),
    async execute(_id, params: any, signal) { return call("weknora_add_document", params); }
  });

  pi.registerTool({
    name: "weknora_update_document",
    label: "WeKnora: 更新文档(写)",
    description: "更新一篇已有的手工 Markdown 文档正文 (仅 type=manual; title 留空保持原标题)。",
    parameters: Type.Object({
      knowledge_id: Type.String({ description: "要更新的文档 ID" }),
      content: Type.String({ description: "新的 Markdown 正文 (整体替换)" }),
      title: Type.Optional(Type.String({ description: "新标题, 留空保持原标题" })),
      status: Type.Optional(Type.String({ description: "publish(默认) 或 draft" }))
    }),
    async execute(_id, params: any, signal) { return call("weknora_update_document", params); }
  });

  pi.registerTool({
    name: "weknora_delete_document",
    label: "WeKnora: 删除文档(写)",
    description: "删除知识库中的一篇文档条目 (不可逆, 提交后台删除任务)。",
    parameters: Type.Object({
      knowledge_id: Type.String({ description: "要删除的文档 ID" })
    }),
    async execute(_id, params: any, signal) { return call("weknora_delete_document", params); }
  });
}
