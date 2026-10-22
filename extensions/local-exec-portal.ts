import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as child_process from "node:child_process";

// Pi 原生扩展：本地 cmd 执行器 —— local_exec 单命令三档权限审查
export default function (pi: ExtensionAPI) {
  const pluginDir = path.resolve(process.cwd(), ".obsidian", "plugins", "tabonkb-workbench");
  let lex: any = null;
  let localSvc: any = null;
  try { lex = require(path.join(pluginDir, "services", "local-exec-core.js")); } catch (e) {
    console.warn("[LocalExec] failed to load local-exec-core:", e);
  }
  try { localSvc = require(path.join(pluginDir, "services", "local-project-service.js")); } catch (e) {
    console.warn("[LocalExec] failed to load local-project-service:", e);
  }

  const vaultRoot = process.env.TABONKB_VAULT_PATH || process.cwd();
  const MAX_OUT_BYTES = 50 * 1024;

  /** 当前本地工程 (env 优先, active-context.json 兜底) */
  function getActiveProject(): any {
    try {
      const saved = process.env.TABONKB_LOCAL_PROJECT_JSON;
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    try {
      const f = path.join(pluginDir, "active-context.json");
      if (fs.existsSync(f)) {
        const j = JSON.parse(fs.readFileSync(f, "utf8"));
        if (j && j.selectedLocalProject) return j.selectedLocalProject;
      }
    } catch (_) {}
    // 与 local-project-portal 一致: 回退到缓存工程列表首项
    if (localSvc && typeof localSvc.getAllAvailableLocalProjects === "function") {
      try {
        const list = localSvc.getAllAvailableLocalProjects();
        const k82 = (list || []).find((p: any) => p.project === "K82NF");
        return k82 || (list || [])[0] || null;
      } catch (_) {}
    }
    return null;
  }

  function getPermMode(): string {
    const m = process.env.TABONKB_PERM_MODE || "";
    return m === "readonly" || m === "full" ? m : "readwrite";
  }

  /** 读写档写入边界: 知识库根/TEMP + 当前工程 priDriverRel/publicDriverRel 的 Windows 绝对路径 (fullPathWin 与 uncPath 双形态)
   *  每个根同时补 realpathSync.native 长路径形态: os.tmpdir() 返回 ADMINI~1 类 8.3 短名,
   *  写根前缀为字符串比较, 不补则长路径同目录被误拒 */
  function getWriteRoots(): string[] {
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
          // 兜底: 无 rel 字段时按 platform/project 构造
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

  interface LocalRunResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; aborted: boolean; }

  /** Windows 进程树终止: taskkill /T /F 连子进程一起杀 (防 robocopy/xcopy 等子进程残留为孤儿); /T 已含父进程本身 */
  function killTree(pid: number | undefined) {
    if (!pid) return;
    try {
      child_process.spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => {});
    } catch (_) {}
  }

  /** 单条本地命令执行: cmd.exe /d /s /c + 本地看门狗硬限时 + onUpdate 5s 回报 + AbortSignal 杀进程树 */
  function runLocal(cmdStr: string, cwdAbs: string, timeoutSec: number, signal: AbortSignal | undefined, onUpdate: any): Promise<LocalRunResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      // 中文 Windows cmd 管道输出为 GBK(CP936): chcp 只影响控制台渲染不改管道编码,
      // 须按 Buffer 收集(防跨 chunk 截断双字节) 再一次性 GBK 解码; ASCII 与 GBK 兼容无回归
      const outChunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      let outBytes = 0, errBytes = 0;
      const OUT_CAP = 512 * 1024, ERR_CAP = 128 * 1024;
      const dec = () => new TextDecoder("gbk", { fatal: false });
      let settled = false;
      let timedOut = false;
      let aborted = false;

      let proc: any;
      try {
        proc = child_process.spawn("cmd.exe", ["/d", "/s", "/c", cmdStr], { cwd: cwdAbs, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      } catch (e: any) {
        resolve({ code: null, stdout: "", stderr: e.message || String(e), timedOut: false, aborted: false });
        return;
      }

      const cleanup = () => {
        clearTimeout(watchdog);
        clearInterval(tick);
        try { signal?.removeEventListener("abort", onAbort); } catch (_) {}
      };
      const finish = (r: LocalRunResult) => { if (!settled) { settled = true; cleanup(); resolve(r); } };
      const finishDec = (code: number | null) => {
        const d = dec();
        let so = Buffer.concat(outChunks), se = Buffer.concat(errChunks);
        if (so.length > OUT_CAP) so = so.subarray(so.length - OUT_CAP);
        if (se.length > ERR_CAP) se = se.subarray(se.length - ERR_CAP);
        finish({ code, stdout: d.decode(so), stderr: d.decode(se), timedOut, aborted });
      };

      const watchdog = setTimeout(() => {
        timedOut = true;
        killTree(proc.pid);
      }, timeoutSec * 1000 + 5000);

      const tick = setInterval(() => {
        if (typeof onUpdate === "function") {
          try {
            const el = Math.floor((Date.now() - startTime) / 1000);
            onUpdate({ content: [{ type: "text", text: `本地执行中 ${el} 秒 / 上限 ${timeoutSec} 秒` }] });
          } catch (_) {}
        }
      }, 5000);

      const onAbort = () => {
        aborted = true;
        killTree(proc.pid);
      };
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }

      proc.stdout.on("data", (d: Buffer) => { outChunks.push(d); outBytes += d.length; while (outBytes > OUT_CAP && outChunks.length > 1) outBytes -= (outChunks.shift() as Buffer).length; });
      proc.stderr.on("data", (d: Buffer) => { errChunks.push(d); errBytes += d.length; while (errBytes > ERR_CAP && errChunks.length > 1) errBytes -= (errChunks.shift() as Buffer).length; });
      proc.on("error", (e: any) => { errChunks.push(Buffer.from(` ${e.message}`, "utf-8")); errBytes += e.message.length + 1; finishDec(null); });
      proc.on("close", finishDec);
    });
  }

  const textRes = (text: string, details?: any, isError?: boolean) =>
    ({ content: [{ type: "text", text }], details, isError });

  // ---- local_exec: 本地 cmd 单命令, 三档权限审查 ----
  pi.registerTool({
    name: "local_exec",
    label: "本地执行命令",
    description:
      "在本地 Windows 以 cmd.exe 执行单条命令（不支持管道/重定向/链式）。审查同 remote_exec 三档：只读=仅检索类白名单；读写=写目标限定知识库/当前工程/TEMP；完全权限=仅拦灾难级。适合本地文件搬运/哈希校验/目录列举。",
    parameters: Type.Object({
      command: Type.String({ description: "在本地执行的 cmd 命令 (单条, 不支持 & | < > ; ^ 链接; 含空格路径直接加双引号, 不要写成 \\\" 转义形式)" }),
      cwd: Type.Optional(Type.String({ description: "工作目录, Windows 绝对/相对路径 (相对则基于知识库根); 缺省为知识库根" })),
      timeout_sec: Type.Optional(Type.Number({ description: "超时秒数, 10-600; 缺省 120" })),
    }),
    async execute(_id: string, params: any, signal: AbortSignal | undefined, onUpdate: any) {
      if (!lex) {
        return textRes("local-exec 核心模块未加载", { error: "no_core" }, true);
      }
      const mode = getPermMode();
      const modeName = lex.MODE_NAMES[mode] || "读写";
      const writeRoots = getWriteRoots();

      let cwdAbs = vaultRoot;
      if (params.cwd) {
        const c = String(params.cwd).trim();
        cwdAbs = path.isAbsolute(c) ? path.resolve(c) : path.resolve(vaultRoot, c);
      }
      if (!fs.existsSync(cwdAbs)) {
        return textRes(`cwd 不存在: ${cwdAbs}`, { error: "bad_cwd" }, true);
      }

      const chk = lex.checkLocalCommand(String(params.command || ""), mode, { writeRoots, vaultRoot, cwd: cwdAbs });
      if (!chk.ok) {
        return textRes(`当前为「${modeName}」模式，不允许：${chk.reason}。可在输入框左下角切换权限模式`, { denied: true, mode }, true);
      }

      let timeoutSec = 120;
      if (typeof params.timeout_sec === "number" && isFinite(params.timeout_sec) && params.timeout_sec > 0) {
        timeoutSec = lex.clampTimeoutSec(params.timeout_sec, 10);
      }

      const res = await runLocal(String(params.command), cwdAbs, timeoutSec, signal, onUpdate);
      if (res.aborted) throw new Error("Operation aborted");

      let out = res.stdout || "";
      if (res.stderr && res.stderr.trim()) out += `${out ? "\n" : ""}--- STDERR ---\n${res.stderr}`;

      const allLines = out.split("\n");
      const totalLines = allLines.length;
      const totalBytes = Buffer.byteLength(out, "utf-8");
      if (totalLines > 200 || totalBytes > MAX_OUT_BYTES) {
        let tail = allLines.slice(-200).join("\n");
        if (Buffer.byteLength(tail, "utf-8") > MAX_OUT_BYTES) tail = tail.slice(-MAX_OUT_BYTES);
        out = `[输出已截断: 完整 ${totalLines} 行 / ${(totalBytes / 1024).toFixed(1)}KB, 以下为尾部]\n${tail}`;
      }

      const header = `[local_exec · ${modeName}模式] cwd: ${cwdAbs}  超时上限: ${timeoutSec}s\n`;
      const footer = res.timedOut
        ? `\n[命令执行超时（上限 ${timeoutSec} 秒）]`
        : (res.code !== 0 ? `\n[exit code ${res.code}]` : "");
      return textRes(header + out + footer, { code: res.code, timeoutSec, timedOut: res.timedOut || undefined }, res.timedOut || undefined);
    },
  });
}
