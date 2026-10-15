import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as http from "node:http";

// Pi 无 MCP。工具转发到工作台 DrawioBroker（127.0.0.1:6011），图不在本进程里。
const BROKER_PORT = 6011;

function callBroker(tool: string, params: any) {
  const payload = JSON.stringify({ tool, args: params || {} });
  return new Promise<{ content: { type: string; text: string }[]; details: any }>((resolve) => {
    const req = http.request({
      host: "127.0.0.1",
      port: BROKER_PORT,
      path: "/v1/call",
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try {
          const data = JSON.parse(raw);
          resolve({
            content: [{ type: "text", text: data.text || "完成" }],
            details: { tool, isError: !!data.isError }
          });
        } catch (e) {
          resolve({
            content: [{ type: "text", text: "绘图桥返回无法解析" }],
            details: { error: "bad_json" }
          });
        }
      });
    });
    req.on("error", () => {
      resolve({
        content: [{ type: "text", text: "工作台 Draw.io 桥未启动。请先打开 Obsidian 里的研发工作台。" }],
        details: { error: "broker_offline" }
      });
    });
    req.setTimeout(120000, () => {
      req.destroy();
      resolve({
        content: [{ type: "text", text: "绘图超时" }],
        details: { error: "timeout" }
      });
    });
    req.write(payload);
    req.end();
  });
}

const pageFields = {
  page_id: Type.Optional(Type.String({ description: "按页面 id 定位" })),
  page_name: Type.Optional(Type.String({ description: "按页面名称定位" })),
  page_index: Type.Optional(Type.Number({ description: "按 0 起始页序号定位" }))
};

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "drawio_create",
    label: "Draw.io: 新建图",
    description: "新建一张 draw.io 图，替换当前会话的全部页面。xml 为 mxGraphModel 或 mxfile。布局放在 800x600 内，形状 id 从 2 起，parent 为 1。title 是短文件名。不要打开浏览器。",
    parameters: Type.Object({
      xml: Type.String({ description: "完整 mxGraphModel 或 mxfile XML" }),
      title: Type.Optional(Type.String({ description: "短标题，用于文件名" }))
    }),
    async execute(_id, params: any) { return callBroker("drawio_create", params); }
  });

  pi.registerTool({
    name: "drawio_load",
    label: "Draw.io: 读取文件",
    description: "把 .drawio 读入当前会话。path 可相对知识库根目录。读入后先 drawio_get 再改。",
    parameters: Type.Object({
      path: Type.String({ description: ".drawio 路径" })
    }),
    async execute(_id, params: any) { return callBroker("drawio_load", params); }
  });

  pi.registerTool({
    name: "drawio_get",
    label: "Draw.io: 读取当前图",
    description: "读取当前图 XML 与 cell id。改图前如果不认识结构，先调用本工具。",
    parameters: Type.Object(pageFields),
    async execute(_id, params: any) { return callBroker("drawio_get", params); }
  });

  pi.registerTool({
    name: "drawio_edit",
    label: "Draw.io: 改图",
    description: "按 cell 增删改。operation 为 add、update 或 delete。add/update 的 new_xml 必须是含 mxGeometry 的完整 mxCell。",
    parameters: Type.Object({
      ...pageFields,
      operations: Type.Array(Type.Object({
        operation: Type.String({ description: "add、update 或 delete" }),
        cell_id: Type.String({ description: "mxCell id" }),
        new_xml: Type.Optional(Type.String({ description: "完整 mxCell XML，add/update 必填" }))
      }), { description: "增删改操作列表" })
    }),
    async execute(_id, params: any) { return callBroker("drawio_edit", params); }
  });

  pi.registerTool({
    name: "drawio_export",
    label: "Draw.io: 导出",
    description: "把当前图写到 00-Inbox/04-Agent-Diagrams/ 的 .drawio 和 PNG。不要再输出图片 markdown。",
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "短标题，用于文件名" }))
    }),
    async execute(_id, params: any) { return callBroker("drawio_export", params); }
  });

  pi.registerTool({
    name: "drawio_list_pages",
    label: "Draw.io: 页面列表",
    description: "列出当前图的页面 id、名称、序号和 cell 数量。",
    parameters: Type.Object({}),
    async execute(_id, params: any) { return callBroker("drawio_list_pages", params); }
  });

  pi.registerTool({
    name: "drawio_add_page",
    label: "Draw.io: 新增页面",
    description: "追加页面，不改已有页面。",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "页签名称" })),
      id: Type.Optional(Type.String({ description: "页面 id" })),
      xml: Type.Optional(Type.String({ description: "可选 mxGraphModel" }))
    }),
    async execute(_id, params: any) { return callBroker("drawio_add_page", params); }
  });

  pi.registerTool({
    name: "drawio_rename_page",
    label: "Draw.io: 重命名页面",
    description: "重命名页面。page_id、page_name、page_index 至少给一个。",
    parameters: Type.Object({
      ...pageFields,
      new_name: Type.String({ description: "新的页签名称" })
    }),
    async execute(_id, params: any) { return callBroker("drawio_rename_page", params); }
  });

  pi.registerTool({
    name: "drawio_delete_page",
    label: "Draw.io: 删除页面",
    description: "删除一个页面，不能删除最后一页。",
    parameters: Type.Object(pageFields),
    async execute(_id, params: any) { return callBroker("drawio_delete_page", params); }
  });
}
