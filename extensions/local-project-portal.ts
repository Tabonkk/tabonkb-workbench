import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as crypto from "node:crypto";
import * as child_process from "node:child_process";

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

  // 本地写边界内核 (local_copy/local_move 共用 local_exec 的写根判定)
  let lexCore: any = null;
  const lexPath = path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/local-exec-core.js");
  if (fs.existsSync(lexPath)) {
    try {
      lexCore = require(lexPath);
    } catch (e) {
      console.warn("[LocalProjectExtension] Failed to require local-exec-core:", e);
    }
  }

  const vaultRoot = process.env.TABONKB_VAULT_PATH || process.cwd();

  function getPermMode(): string {
    const m = process.env.TABONKB_PERM_MODE || "";
    return m === "readonly" || m === "full" ? m : "readwrite";
  }

  /** 写目标边界: 知识库根/TEMP + 当前工程 priDriverRel/publicDriverRel (与 local-exec-portal 同规则)
   *  各根同时补 realpathSync.native 长路径形态 (os.tmpdir() 返回 ADMINI~1 类 8.3 短名, 前缀比较需双形态) */
  function getLocalWriteRoots(): string[] {
    const roots: string[] = [vaultRoot, os.tmpdir()];
    const proj = getActiveProject();
    if (proj) {
      const bases = [proj.fullPathWin, proj.uncPath]
        .filter((b: any) => !!b)
        .map((b: any) => String(b).replace(/[\\/]+$/, ""));
      const rels = [proj.priDriverRel, proj.publicDriverRel]
        .filter((r: any) => !!r)
        .map((r: any) => String(r).replace(/\//g, "\\").replace(/^\\+|\\+$/g, ""));
      for (const base of bases) {
        if (rels.length) {
          for (const rel of rels) roots.push(`${base}\\${rel}`);
        } else if (proj.platform && proj.project) {
          roots.push(`${base}\\pri_project\\driver\\${proj.platform}\\${proj.project}`);
          roots.push(`${base}\\pri_project\\driver\\public`);
        }
      }
    }
    for (const r of roots.slice()) {
      try {
        const rp = fs.realpathSync.native(r);
        if (!roots.includes(rp)) roots.push(rp);
      } catch (_) {}
    }
    return roots.filter((r, i) => roots.indexOf(r) === i);
  }

  const textRes = (text: string, details?: any, isError?: boolean) =>
    ({ content: [{ type: "text", text }], details, isError });

  /** 流式 sha256 + 字节数 (复制后一步校验) */
  function sha256File(p: string): Promise<{ sha: string; bytes: number }> {
    return new Promise((resolve, reject) => {
      const h = crypto.createHash("sha256");
      let bytes = 0;
      const s = fs.createReadStream(p);
      s.on("data", (d: Buffer) => { bytes += d.length; h.update(d); });
      s.on("error", reject);
      s.on("end", () => resolve({ sha: h.digest("hex"), bytes }));
    });
  }

  /** local_copy/local_move 共用的目标校验: 返回 {dst} 或 {err} */
  function resolveCopyTarget(src: string, dstIn: string): { dst?: string; err?: any } {
    const ctx = { writeRoots: getLocalWriteRoots(), vaultRoot };
    if (!lexCore.localWriteTargetOk(dstIn, ctx)) {
      return { err: textRes(`目标不在允许写入范围 (知识库/当前工程/TEMP): ${dstIn}`, { denied: true }, true) };
    }
    let dst = lexCore.normWinPath(dstIn);
    try {
      if (fs.existsSync(dst) && fs.statSync(dst).isDirectory()) {
        // 写根本身即目录: 必须显式给文件名, 不允许把根目录当目标
        if (lexCore.isRootItself(dst, vaultRoot) || ctx.writeRoots.some((r: string) => lexCore.isRootItself(dst, r))) {
          return { err: textRes(`目标为允许写根目录本身，请给出文件名: ${dst}`, { denied: true }, true) };
        }
        // 目标是已存在的普通目录 → 拷入同名文件
        dst = path.join(dst, path.basename(src));
        if (!lexCore.localWriteTargetOk(dst, ctx)) {
          return { err: textRes(`目标不在允许写入范围: ${dst}`, { denied: true }, true) };
        }
      }
    } catch (_) {}
    return { dst };
  }

  function getActiveProject() {
    try {
      const saved = process.env.TABONKB_LOCAL_PROJECT_JSON;
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    // active-context.json 兜底: env 为 spawn 快照可能滞后, 文件由 UI 每次变更落盘 (与 local-exec/remote-exec 同规则)
    try {
      const f = path.resolve(process.cwd(), ".obsidian", "plugins", "tabonkb-workbench", "active-context.json");
      if (fs.existsSync(f)) {
        const j = JSON.parse(fs.readFileSync(f, "utf8"));
        if (j && j.selectedLocalProject) return j.selectedLocalProject;
      }
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

  // 4. 字节级本地文件复制 (PDF/二进制搬运), 写目标限定写根
  pi.registerTool({
    name: "local_copy",
    label: "本地文件: 字节级复制",
    description: "将本地文件逐字节复制到目标路径（字节级复制不改 MD5/SHA256，适合 PDF/二进制等任意文件搬运）。写目标限定知识库/当前工程/TEMP；目标为已存在目录时拷入同名文件；父目录自动创建；完成后返回目标字节数与 sha256 一步校验。只读模式拒绝执行。",
    parameters: Type.Object({
      src: Type.String({ description: "源文件绝对路径 (必须已存在且为文件)" }),
      dst: Type.String({ description: "目标绝对路径 (知识库/当前工程/TEMP 内; 为已存在目录时拷入同名文件)" }),
      overwrite: Type.Optional(Type.Boolean({ description: "目标已存在时是否覆盖, 缺省 false" }))
    }),
    async execute(_id: string, params: any) {
      if (!lexCore) {
        return textRes("local-exec-core 模块未加载。", { error: "no_core" }, true);
      }
      if (getPermMode() === "readonly") {
        return textRes("当前为「只读」模式，不允许 local_copy。可在输入框左下角切换权限模式", { denied: true, mode: "readonly" }, true);
      }
      const src = String(params.src || "").trim();
      const dstIn = String(params.dst || "").trim();
      if (!src || !dstIn) {
        return textRes("缺少 src/dst 参数。", { error: "bad_args" }, true);
      }
      let st: any = null;
      try { st = fs.statSync(src); } catch (_) {}
      if (!st || !st.isFile()) {
        return textRes(`源不存在或不是文件: ${src}`, { error: "src_not_file" }, true);
      }
      const t = resolveCopyTarget(src, dstIn);
      if (t.err) return t.err;
      const dst = t.dst as string;
      const overwrite = params.overwrite === true;
      if (fs.existsSync(dst) && !overwrite) {
        return textRes(`目标已存在，置 overwrite:true 覆盖: ${dst}`, { error: "exists" }, true);
      }
      try {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
        const { sha, bytes } = await sha256File(dst);
        const msg = `[字节级复制完成]\n- 源: ${src}\n- 目标: ${dst}\n- 字节数: ${bytes}\n- SHA256: ${sha}\n(与源文件逐字节一致，可对照校验)`;
        return textRes(msg, { bytes, sha256: sha, src, dst });
      } catch (e: any) {
        return textRes(`复制失败: ${e.message}`, { error: e.message }, true);
      }
    }
  });

  // 5. 字节级本地文件移动 (优先 rename, 跨盘回退复制+删源)
  pi.registerTool({
    name: "local_move",
    label: "本地文件: 字节级移动",
    description: "将本地文件逐字节移动到目标路径（字节级内容不变，MD5/SHA256 保持一致）。优先 rename，跨盘自动回退为复制+删源。写目标限定知识库/当前工程/TEMP；父目录自动创建；完成后返回目标字节数与 sha256 一步校验。只读模式拒绝执行。",
    parameters: Type.Object({
      src: Type.String({ description: "源文件绝对路径 (必须已存在且为文件)" }),
      dst: Type.String({ description: "目标绝对路径 (知识库/当前工程/TEMP 内; 为已存在目录时移入同名文件)" }),
      overwrite: Type.Optional(Type.Boolean({ description: "目标已存在时是否覆盖, 缺省 false" }))
    }),
    async execute(_id: string, params: any) {
      if (!lexCore) {
        return textRes("local-exec-core 模块未加载。", { error: "no_core" }, true);
      }
      if (getPermMode() === "readonly") {
        return textRes("当前为「只读」模式，不允许 local_move。可在输入框左下角切换权限模式", { denied: true, mode: "readonly" }, true);
      }
      const src = String(params.src || "").trim();
      const dstIn = String(params.dst || "").trim();
      if (!src || !dstIn) {
        return textRes("缺少 src/dst 参数。", { error: "bad_args" }, true);
      }
      let st: any = null;
      try { st = fs.statSync(src); } catch (_) {}
      if (!st || !st.isFile()) {
        return textRes(`源不存在或不是文件: ${src}`, { error: "src_not_file" }, true);
      }
      // local_move 会删除源文件 (rename 或 copy+unlink): 非 full 档下源也必须在写根内, 否则构成写根外任意文件删除原语
      if (getPermMode() !== "full" && !lexCore.localWriteTargetOk(src, { writeRoots: getLocalWriteRoots(), vaultRoot })) {
        return textRes(`local_move 会删除源文件，源须在写根内（知识库/当前工程/TEMP）；跨位置搬运请用 local_copy: ${src}`, { denied: true, mode: getPermMode() }, true);
      }
      const t = resolveCopyTarget(src, dstIn);
      if (t.err) return t.err;
      const dst = t.dst as string;
      const overwrite = params.overwrite === true;
      if (fs.existsSync(dst) && !overwrite) {
        return textRes(`目标已存在，置 overwrite:true 覆盖: ${dst}`, { error: "exists" }, true);
      }
      try {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        try {
          fs.renameSync(src, dst);
        } catch (_) {
          // 跨盘/占用失败回退: 复制后删源
          fs.copyFileSync(src, dst);
          fs.unlinkSync(src);
        }
        const { sha, bytes } = await sha256File(dst);
        const msg = `[字节级移动完成]\n- 源: ${src}\n- 目标: ${dst}\n- 字节数: ${bytes}\n- SHA256: ${sha}\n(与源文件逐字节一致，可对照校验)`;
        return textRes(msg, { bytes, sha256: sha, src, dst });
      } catch (e: any) {
        return textRes(`移动失败: ${e.message}`, { error: e.message }, true);
      }
    }
  });
}
