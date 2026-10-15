import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

// Pi 无 MCP 能力，用原生扩展调用 62 上已建好的 CodeGraph。
export default function (pi: ExtensionAPI) {
  let runCodegraphTool: any = null;
  const servicePath = path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/codegraph-service.js");
  if (fs.existsSync(servicePath)) {
    try {
      runCodegraphTool = require(servicePath).runCodegraphTool;
    } catch (e) {
      console.warn("[CodeGraphExtension] Failed to require codegraph-service:", e);
    }
  }

  async function call(params: any) {
    if (!runCodegraphTool) {
      return { content: [{ type: "text", text: "未能加载 codegraph-service 模块，请检查插件安装路径。" }], details: { error: "service_not_found" } };
    }
    try {
      const text = await runCodegraphTool("codegraph_explore", params || {});
      return { content: [{ type: "text", text }], details: { tool: "codegraph_explore" } };
    } catch (err: any) {
      return { content: [{ type: "text", text: `CodeGraph 执行异常: ${err.message}` }], details: { error: err.message } };
    }
  }

  pi.registerTool({
    name: "codegraph_explore",
    label: "CodeGraph: 查符号与调用链",
    description: "在 192.168.1.62 上已建索引的代码图里查符号定义、调用链和相关源码。tree=kernel 查展锐 A17 6.18 内核；tree=driver 查 A17 pri_project/driver（T610/T615/T8200）；tree=mtk-kernel 查联发科 ~/share/W/03-mtk-ww/vendor_w/kernel（含 kernel-6.12 与 kernel_device_modules-6.12）；tree=mtk-driver 查联发科 pri_project/driver（mt6789/mt6855/mt6858）；tree=mtk-bootloader 查联发科 bootable（lk、lk2、preloader）。查具体函数实现和谁调用了谁时用这个工具；全库文本搜索仍用 OpenGrok。",
    parameters: Type.Object({
      query: Type.String({ description: "符号名、相对路径或要查的调用关系，例如 sprd_charger、start_kernel、mtk 驱动函数名" }),
      tree: Type.Optional(Type.String({ description: "kernel（默认，展锐 6.18 内核）、driver（A17 私有驱动）、mtk-kernel（联发科内核）、mtk-driver（联发科私有驱动）、mtk-bootloader（联发科 lk/lk2/preloader）" }))
    }),
    async execute(_id, params: any) { return call(params); }
  });
}
