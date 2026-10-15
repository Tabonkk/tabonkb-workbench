import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

// Pi 原生扩展：本地多服务器工程三层差分穿透、安全修改与远程编译引擎
export default function (pi: ExtensionAPI) {
  let localSvc: any = null;
  const servicePath = path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/local-project-service.js");
  if (fs.existsSync(servicePath)) {
    try {
      localSvc = require(servicePath);
    } catch (e) {
      console.warn("[LocalProjectExtension] Failed to require local-project-service:", e);
    }
  }

  function getActiveProject() {
    try {
      const saved = process.env.TABONKB_LOCAL_PROJECT_JSON;
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    // 默认回退到列表中首个可用工程 (如 62 上的 W/03-mtk-ww)
    if (localSvc && typeof localSvc.getAllAvailableLocalProjects === 'function') {
      const list = localSvc.getAllAvailableLocalProjects();
      const k82 = list.find((p: any) => p.project === 'K82NF');
      if (k82) return k82;
      return list[0] || null;
    }
    return null;
  }

  // 1. 逆向穿透读文件
  pi.registerTool({
    name: "project_read_file",
    label: "本地工程: 逆向穿透读源码",
    description: "按照【项目私有层 > 公共差分层 > 原厂基线】的逆向穿透规则，读取本地工程中真实编译生效的源码文件。可指定行号范围。",
    parameters: Type.Object({
      file_path: Type.String({ description: "源码相对路径，如 drivers/misc/mediatek/typec/tcpc/tcpc.c 或 cust_charger.dtsi" }),
      start_line: Type.Optional(Type.Number({ description: "起始行号 (1-based，默认 1)" })),
      end_line: Type.Optional(Type.Number({ description: "结束行号 (1-based)" }))
    }),
    async execute(_id, params: any) {
      const proj = getActiveProject();
      if (!proj) {
        return { content: [{ type: "text", text: "未指定或未找到有效的本地工程配置。" }], details: { error: "no_project" } };
      }
      if (!localSvc) {
        return { content: [{ type: "text", text: "未能加载 local-project-service 模块。" }], details: { error: "service_not_found" } };
      }

      const res = localSvc.resolveEffectiveFile(proj, params.file_path);
      if (!res || !res.fullPath || !fs.existsSync(res.fullPath)) {
        return { content: [{ type: "text", text: `在工程 ${proj.label} 的项目层、公共层和基线层均未找到文件: ${params.file_path}` }], details: { error: "not_found" } };
      }

      try {
        const content = fs.readFileSync(res.fullPath, "utf8");
        const lines = content.split("\n");
        const sLine = Math.max(1, params.start_line || 1);
        const eLine = Math.min(lines.length, params.end_line || lines.length);
        const sliced = lines.slice(sLine - 1, eLine).map((l: string, idx: number) => `${sLine + idx}: ${l}`).join("\n");

        const header = `[源码文件解析成功]\n- 工程: ${proj.label} (${proj.serverName})\n- 生效层级: ${res.tierName}\n- 实际物理路径: ${res.fullPath}\n- 覆盖状态: ${res.isOverride ? '⚠️ 该文件在 pri_project/driver 中进行了客制化覆写 (以当前客制化为最终生效准则)' : '使用原厂 baseline 源码'}\n- 行号区间: [${sLine} - ${eLine}] (共 ${lines.length} 行)\n\n`;
        return { content: [{ type: "text", text: header + sliced }], details: { res } };
      } catch (err: any) {
        return { content: [{ type: "text", text: `读取文件失败: ${err.message}` }], details: { error: err.message } };
      }
    }
  });

  // 2. 安全目标路由代码修改
  pi.registerTool({
    name: "project_edit_file",
    label: "本地工程: 安全代码修改",
    description: "修改本地工程代码。严禁直接改基线！项目修改会自动写入 pri_project/driver/<platform>/<project>/base/（未存在则自动从基线派生）；共性修改写入 public/。",
    parameters: Type.Object({
      file_path: Type.String({ description: "要修改的文件相对路径，如 drivers/misc/mediatek/typec/tcpc/tcpc.c" }),
      target_content: Type.String({ description: "待替换的精确原代码片段" }),
      replacement_content: Type.String({ description: "替换后的新代码片段" }),
      scope: Type.Optional(Type.String({ description: "修改作用域: 'project' (默认，当前机型客制化) 或 'public' (公司公共差分)" }))
    }),
    async execute(_id, params: any) {
      const proj = getActiveProject();
      if (!proj || !localSvc) {
        return { content: [{ type: "text", text: "工程配置或本地服务未就绪。" }], details: { error: "no_project" } };
      }

      try {
        const route = localSvc.routeEditTarget(proj, params.file_path, params.scope || 'project');
        if (!fs.existsSync(route.targetPath)) {
          return { content: [{ type: "text", text: `目标文件无法创建或定位: ${route.targetPath}` }], details: { error: "target_missing" } };
        }

        const raw = fs.readFileSync(route.targetPath, "utf8");
        if (!raw.includes(params.target_content)) {
          return { content: [{ type: "text", text: `在文件 ${route.targetRel} 中未找到完全匹配的目标代码片段 (target_content)。请先使用 project_read_file 查看当前最新内容。` }], details: { error: "target_not_matched" } };
        }

        // 备份与替换
        const bakPath = `${route.targetPath}.bak`;
        fs.writeFileSync(bakPath, raw, "utf8");
        const updated = raw.replace(params.target_content, params.replacement_content);
        fs.writeFileSync(route.targetPath, updated, "utf8");

        const msg = `[代码修改成功]\n- 目标文件: ${route.targetRel}\n- 物理路径: ${route.targetPath}\n- 作用域: ${route.scope === 'project' ? `项目个性化 (${proj.project})` : '公司公共 (public)'}\n- 基线保护: ${route.derivedFromSource ? '已自动从原厂基线拷贝派生至客制化目录，基线源码保持未污染' : '修改现有客制化文件'}\n- 自动备份: 已生成 .bak 备份文件\n- 生效提示: 下次执行 build.sh 编译时将自动覆盖基线生效。`;
        return { content: [{ type: "text", text: msg }], details: { route } };
      } catch (err: any) {
        return { content: [{ type: "text", text: `修改异常: ${err.message}` }], details: { error: err.message } };
      }
    }
  });

  // 3. 远程 SSH 编译
  pi.registerTool({
    name: "project_compile",
    label: "本地工程: 远程编译构建",
    description: "在远程 Linux 服务器上触发当前工程编译。自动装配平台与项目参数 (如 ./pri_project/build/build.sh -p mt6878 -m N30 -k driver)。提取关键错误，过滤无关 Warning。",
    parameters: Type.Object({
      build_type: Type.Optional(Type.String({ description: "编译类型: 'driver' (默认，驱动模块单编), 'dtbo' (设备树单编), 'kernel' (内核全编), 或自定义命令" })),
      extra_args: Type.Optional(Type.String({ description: "额外编译参数，如 -j32" }))
    }),
    async execute(_id, params: any) {
      const proj = getActiveProject();
      if (!proj || !localSvc) {
        return { content: [{ type: "text", text: "工程配置或本地服务未就绪。" }], details: { error: "no_project" } };
      }

      const buildType = params.build_type || 'driver';
      const cmd = localSvc.buildCompileCommand(proj, buildType, params.extra_args || '');
      const sshBin = localSvc.getWinSshBin();

      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        const startTime = Date.now();

        const proc = child_process.spawn(sshBin, [
          '-T',
          '-o', 'BatchMode=yes',
          '-o', 'ConnectTimeout=20',
          `${proj.user}@${proj.sshHost}`,
          cmd
        ], { windowsHide: true });

        proc.stdout.on('data', (d: Buffer) => {
          stdout += d.toString();
          if (stdout.length > 500000) stdout = stdout.slice(-500000);
        });
        proc.stderr.on('data', (d: Buffer) => {
          stderr += d.toString();
        });

        const timer = setTimeout(() => {
          try { proc.kill(); } catch (_) {}
          resolve({ content: [{ type: "text", text: `[编译超时中断]\n命令: ${cmd}\n耗时超过 600 秒已强杀` }], details: { error: "timeout" } });
        }, 600000);

        proc.on('close', (code: number) => {
          clearTimeout(timer);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const fullOut = stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '');

          if (code === 0) {
            const successMsg = `[✓ 编译成功 (Success)]\n- 工程: ${proj.label}\n- 命令: ${cmd}\n- 退出码: 0\n- 耗时: ${elapsed} 秒\n\n日志摘要:\n${fullOut.slice(-1500)}`;
            resolve({ content: [{ type: "text", text: successMsg }], details: { code, elapsed } });
          } else {
            const extractedErr = localSvc.extractCompilerErrors(fullOut);
            const failMsg = `[❌ 编译失败 (Exit Code ${code})]\n- 工程: ${proj.label}\n- 命令: ${cmd}\n- 耗时: ${elapsed} 秒\n\n【关键报错提取】:\n${extractedErr}\n\n提示: 请针对上述报错行号排查修复代码后重新执行编译。`;
            resolve({ content: [{ type: "text", text: failMsg }], details: { code, elapsed, extractedErr } });
          }
        });

        proc.on('error', (err: any) => {
          clearTimeout(timer);
          resolve({ content: [{ type: "text", text: `派生 SSH 进程失败: ${err.message}` }], details: { error: err.message } });
        });
      });
    }
  });
}
