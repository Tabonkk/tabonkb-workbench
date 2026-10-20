import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";
import * as child_process from "node:child_process";

// Pi 原生扩展：AI 专用 SSH 执行器 —— grep/find/ls 同名覆盖走服务器执行，remote_exec 通用命令带三档权限审查
export default function (pi: ExtensionAPI) {
  const pluginDir = path.resolve(process.cwd(), ".obsidian", "plugins", "tabonkb-workbench");
  let rex: any = null;
  let localSvc: any = null;
  try { rex = require(path.join(pluginDir, "services", "remote-exec-core.js")); } catch (e) {
    console.warn("[RemoteExec] failed to load remote-exec-core:", e);
  }
  try { localSvc = require(path.join(pluginDir, "services", "local-project-service.js")); } catch (e) {
    console.warn("[RemoteExec] failed to load local-project-service:", e);
  }

  const cwd = process.cwd();
  const grepDef = createGrepToolDefinition(cwd);
  const findDef = createFindToolDefinition(cwd);
  const lsDef = createLsToolDefinition(cwd);

  const MAX_OUT_BYTES = 50 * 1024;
  const LINE_MAX_CHARS = 500;
  const PROBE_TTL_MS = 10 * 60 * 1000;
  const PROBE_FAIL_TTL_MS = 60 * 1000;
  const PROBE_HUGE_COUNT = 1e9; // 探测自身超时 → 超大目录, calcTimeoutSec 直接给满 600s
  const LOCAL_FALLBACK_MS = 120000;
  const dirProbeCache = new Map<string, { count: number | null; at: number }>();

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

  /** 读写档写入边界: priDriverRel (项目专属层) 与 publicDriverRel (公共差分层) 的 linux 绝对路径 */
  function getWriteRoots(): string[] {
    const roots: string[] = [];
    const proj = getActiveProject();
    if (proj && proj.linuxPath) {
      const base = String(proj.linuxPath).replace(/\/+$/, "");
      for (const rel of [proj.priDriverRel, proj.publicDriverRel]) {
        if (rel) {
          const p = `${base}/${String(rel).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}`;
          if (!roots.includes(p)) roots.push(p);
        }
      }
      // 兜底: 无 rel 字段时按 platform/project 构造
      if (!roots.length && proj.platform && proj.project) {
        roots.push(`${base}/pri_project/driver/${proj.platform}/${proj.project}`);
        roots.push(`${base}/pri_project/driver/public`);
      }
    }
    return roots;
  }

  /** 远端进程清理: 本地 ssh 被杀时远端无 PTY 会残留, 另开连接按唯一标记 pkill */
  function killRemote(server: any, marker: string) {
    try {
      const sshBin = localSvc.getWinSshBin();
      const p = child_process.spawn(sshBin, rex.buildSshArgs(server, `pkill -u ${server.user} -f ${marker}`), { stdio: "ignore", windowsHide: true });
      p.on("error", () => {});
      setTimeout(() => { try { p.kill(); } catch (_) {} }, 8000);
    } catch (_) {}
  }

  interface RemoteRunResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; aborted: boolean; }

  /** 单条远端命令执行: base64 封装 + timeout 硬限时 + 本地兜底看门狗 + onUpdate 5s 回报 */
  function runRemote(server: any, shellCmd: string, timeoutSec: number, signal: AbortSignal | undefined, onUpdate: any): Promise<RemoteRunResult> {
    return new Promise((resolve) => {
      const marker = `tw_rmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const remoteCmd = rex.buildRemoteCommand({ cmd: shellCmd, timeoutSec, marker });
      const args = rex.buildSshArgs(server, remoteCmd);
      const startTime = Date.now();
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;
      let aborted = false;

      const proc = child_process.spawn(localSvc.getWinSshBin(), args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

      const cleanup = () => {
        clearTimeout(watchdog);
        clearInterval(tick);
        try { signal?.removeEventListener("abort", onAbort); } catch (_) {}
      };
      const finish = (r: RemoteRunResult) => { if (!settled) { settled = true; cleanup(); resolve(r); } };

      const watchdog = setTimeout(() => {
        timedOut = true;
        try { proc.kill(); } catch (_) {}
        killRemote(server, marker);
      }, timeoutSec * 1000 + 15000);

      const tick = setInterval(() => {
        if (typeof onUpdate === "function") {
          try {
            const el = Math.floor((Date.now() - startTime) / 1000);
            onUpdate({ content: [{ type: "text", text: `远程执行中 ${el} 秒 / 上限 ${timeoutSec} 秒` }] });
          } catch (_) {}
        }
      }, 5000);

      const onAbort = () => {
        aborted = true;
        try { proc.kill(); } catch (_) {}
        killRemote(server, marker);
      };
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }

      proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); if (stdout.length > 512 * 1024) stdout = stdout.slice(-512 * 1024); });
      proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); if (stderr.length > 128 * 1024) stderr = stderr.slice(-128 * 1024); });
      proc.on("error", (e: any) => finish({ code: null, stdout, stderr: (stderr + " " + e.message).trim(), timedOut, aborted }));
      proc.on("close", (code: number | null) => finish({ code, stdout, stderr, timedOut: timedOut || code === 124, aborted }));
    });
  }

  /** du -s --inodes 探测文件数 (15s 探测限时); 探测超时=超大目录记 1e9 并按正常 10min 缓存, 其它失败缓存 60s */
  async function probeFileCount(server: any, linuxDir: string): Promise<number | null> {
    const key = `${server.id}|${linuxDir}`;
    const c = dirProbeCache.get(key);
    if (c && Date.now() - c.at < PROBE_TTL_MS) return c.count;
    let count: number | null = null;
    try {
      const res = await runRemote(server, `du -s --inodes ${rex.shellQuote(linuxDir)} 2>/dev/null | cut -f1`, 15, undefined, undefined);
      if (res.timedOut) {
        count = PROBE_HUGE_COUNT;
      } else if (!res.aborted) {
        const n = parseInt((res.stdout || "").trim(), 10);
        if (isFinite(n) && n >= 0) count = n;
      }
    } catch (_) {}
    dirProbeCache.set(key, { count, at: count === null ? Date.now() - PROBE_TTL_MS + PROBE_FAIL_TTL_MS : Date.now() });
    return count;
  }

  /** 路径命中映射盘 → {server, linuxPath, winPath}; 否则 null 回退本地 */
  function resolveSearchTarget(input: any): { server: any; linuxPath: string; winPath: string } | null {
    if (!rex || !localSvc) return null;
    const p = String(input || "").trim();
    if (!p) return null;
    const srv = rex.resolveServer(p);
    if (!srv) return null;
    const linuxPath = localSvc.windowsPathToLinux(p);
    if (!linuxPath || !linuxPath.startsWith("/")) return null;
    return { server: srv, linuxPath: linuxPath.replace(/\/+$/, ""), winPath: localSvc.linuxPathToWindows(linuxPath) };
  }

  /** 本地回退也套 120s 保守上限: 链式 AbortController 合并外部 signal 与定时器 */
  function withLocalTimeout<T>(signal: AbortSignal | undefined, fn: (sig: AbortSignal) => Promise<T>): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => { try { ac.abort(); } catch (_) {} }, LOCAL_FALLBACK_MS);
    const onAbort = () => { try { ac.abort(); } catch (_) {} };
    if (signal) {
      if (signal.aborted) ac.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    return fn(ac.signal).finally(() => {
      clearTimeout(timer);
      try { signal?.removeEventListener("abort", onAbort); } catch (_) {}
    });
  }

  const textRes = (text: string, details?: any, isError?: boolean) =>
    ({ content: [{ type: "text", text }], details, isError });

  /** 单行截断与内置 truncateLine 一致: 500 字符 + ... [truncated] */
  function truncateLineText(line: string): { text: string; was: boolean } {
    if (line.length <= LINE_MAX_CHARS) return { text: line, was: false };
    return { text: `${line.slice(0, LINE_MAX_CHARS)}... [truncated]`, was: true };
  }

  /** 头截断与内置 truncateHead 一致: 完整行累积至 50KB */
  function capBytes(lines: string[]): { out: string[]; truncated: boolean } {
    const out: string[] = [];
    let bytes = 0;
    for (const l of lines) {
      const b = Buffer.byteLength(l, "utf-8") + (out.length > 0 ? 1 : 0);
      if (bytes + b > MAX_OUT_BYTES) return { out, truncated: true };
      out.push(l);
      bytes += b;
    }
    return { out, truncated: false };
  }

  const winify = (linuxAbs: string) => localSvc.linuxPathToWindows(linuxAbs);

  /** 远端 grep -rnI (--null 防文件名歧义), 输出转回 Windows 路径, 与内置同风格截断提示 */
  async function remoteGrep(t: any, params: any, signal: AbortSignal | undefined, onUpdate: any) {
    const effLimit = Math.max(1, params.limit ?? 100);
    const ctxLines = params.context && params.context > 0 ? Math.floor(params.context) : 0;
    const headN = ctxLines > 0 ? Math.min(20000, effLimit * (2 * ctxLines + 1)) : effLimit;
    const parts = ["grep", "-rnI", "--null", "--exclude-dir=.git"];
    if (params.ignoreCase) parts.push("-i");
    if (params.literal) parts.push("-F");
    if (params.glob) {
      const g = String(params.glob);
      parts.push(`--include=${rex.shellQuote(g.includes("/") ? g.split("/").pop() : g)}`);
    }
    if (ctxLines > 0) parts.push(`-C`, String(ctxLines));
    parts.push("-e", rex.shellQuote(params.pattern), rex.shellQuote(t.linuxPath));
    const cmdStr = parts.join(" ") + ` | head -n ${headN}`;

    const count = await probeFileCount(t.server, t.linuxPath);
    const limitSec = rex.calcTimeoutSec(count);
    const res = await runRemote(t.server, cmdStr, limitSec, signal, onUpdate);
    if (res.aborted) throw new Error("Operation aborted");

    const outLines: string[] = [];
    let matchCount = 0;
    let matchLimitReached = false;
    let linesTruncated = false;
    const rawLines = (res.stdout || "").split("\n");
    for (const raw of rawLines) {
      if (!raw || raw === "--") continue;
      const nul = raw.indexOf("\0");
      if (nul < 0) continue;
      const lpath = raw.slice(0, nul);
      const rest = raw.slice(nul + 1);
      const m = /^(\d+)([:-])(.*)$/.exec(rest);
      if (!m) continue;
      const num = m[1];
      const isMatch = m[2] === ":";
      const txt = m[3].replace(/\r/g, "");
      if (isMatch) {
        matchCount++;
        if (matchCount > effLimit) { matchLimitReached = true; break; }
      }
      const { text: tt, was } = truncateLineText(txt);
      if (was) linesTruncated = true;
      const wp = winify(lpath);
      outLines.push(isMatch ? `${wp}:${num}: ${tt}` : `${wp}-${num}- ${tt}`);
    }

    if (matchCount === 0 && !res.timedOut) {
      if (res.code && res.code > 1) {
        return textRes(`远程 grep 失败 (exit ${res.code}): ${(res.stderr || "").trim().slice(0, 400)}`, { error: res.code }, true);
      }
      return textRes("No matches found", undefined);
    }
    const capped = capBytes(outLines);
    let output = capped.out.join("\n");
    const notices: string[] = [];
    if (matchLimitReached) notices.push(`${effLimit} matches limit reached. Use limit=${effLimit * 2} for more, or refine pattern`);
    if (capped.truncated) notices.push("50.0KB limit reached");
    if (linesTruncated) notices.push(`Some lines truncated to ${LINE_MAX_CHARS} chars. Use read tool to see full lines`);
    if (res.timedOut) notices.push(`超时（上限 ${limitSec} 秒），请缩小目录范围`);
    if (notices.length) output += `\n\n[${notices.join(". ")}]`;
    return textRes(output, { remote: t.server.id, timeoutSec: limitSec, matchLimitReached: matchLimitReached ? effLimit : undefined, truncated: capped.truncated || undefined, timedOut: res.timedOut || undefined });
  }

  /** 远端 find (排除 .git/node_modules), 绝对路径转回 Windows, limit 默认 1000 */
  async function remoteFind(t: any, params: any, signal: AbortSignal | undefined, onUpdate: any) {
    const effLimit = Math.max(1, params.limit ?? 1000);
    const pat = String(params.pattern || "");
    let nameClause: string;
    if (!pat.includes("/")) {
      nameClause = `-name ${rex.shellQuote(pat)}`;
    } else {
      const base = pat.split("/").pop() || "*";
      const pathPat = pat.replace(/\*\*\//g, "");
      const full = pat.startsWith("/") ? pat : `*/${pathPat}`;
      nameClause = `\\( -name ${rex.shellQuote(base)} -o -path ${rex.shellQuote(full)} \\)`;
    }
    const cmdStr = `find ${rex.shellQuote(t.linuxPath)} \\( -name .git -o -name node_modules \\) -prune -o ${nameClause} -print 2>/dev/null | head -n ${effLimit}`;

    const count = await probeFileCount(t.server, t.linuxPath);
    const limitSec = rex.calcTimeoutSec(count);
    const res = await runRemote(t.server, cmdStr, limitSec, signal, onUpdate);
    if (res.aborted) throw new Error("Operation aborted");

    const lines = (res.stdout || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
    if (lines.length === 0 && !res.timedOut) {
      if (res.code && res.code > 1) {
        return textRes(`远程 find 失败 (exit ${res.code}): ${(res.stderr || "").trim().slice(0, 400)}`, { error: res.code }, true);
      }
      return textRes("No files found matching pattern", undefined);
    }
    const resultLimitReached = lines.length >= effLimit;
    const capped = capBytes(lines.map(winify));
    let output = capped.out.join("\n");
    const notices: string[] = [];
    if (resultLimitReached) notices.push(`${effLimit} results limit reached. Use limit=${effLimit * 2} for more, or refine pattern`);
    if (capped.truncated) notices.push("50.0KB limit reached");
    if (res.timedOut) notices.push(`超时（上限 ${limitSec} 秒），请缩小目录范围`);
    if (notices.length) output += `\n\n[${notices.join(". ")}]`;
    return textRes(output, { remote: t.server.id, timeoutSec: limitSec, resultLimitReached: resultLimitReached ? effLimit : undefined, timedOut: res.timedOut || undefined });
  }

  /** 远端 ls -1Ap (目录带 / 后缀, 与内置输出风格一致), 大小写不敏感排序 */
  async function remoteLs(t: any, params: any, signal: AbortSignal | undefined, onUpdate: any) {
    const effLimit = Math.max(1, params.limit ?? 500);
    const q = rex.shellQuote(t.linuxPath);
    const cmdStr = `if [ ! -e ${q} ]; then exit 2; elif [ ! -d ${q} ]; then exit 3; fi; ls -1Ap ${q}`;

    const count = await probeFileCount(t.server, t.linuxPath);
    const limitSec = rex.calcTimeoutSec(count);
    const res = await runRemote(t.server, cmdStr, limitSec, signal, onUpdate);
    if (res.aborted) throw new Error("Operation aborted");

    if (res.code === 2) return textRes(`Path not found: ${t.winPath}`, { error: "not_found" }, true);
    if (res.code === 3) return textRes(`Not a directory: ${t.winPath}`, { error: "not_dir" }, true);
    if (res.code && res.code !== 0 && res.code !== 124 && !(res.stdout || "").trim()) {
      return textRes(`远程 ls 失败 (exit ${res.code}): ${(res.stderr || "").trim().slice(0, 400)}`, { error: res.code }, true);
    }
    let entries = (res.stdout || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
    entries.sort((a: string, b: string) => a.replace(/\/$/, "").toLowerCase().localeCompare(b.replace(/\/$/, "").toLowerCase()));
    let entryLimitReached = false;
    if (entries.length > effLimit) { entryLimitReached = true; entries = entries.slice(0, effLimit); }
    if (entries.length === 0 && !res.timedOut) return textRes("(empty directory)", undefined);
    const capped = capBytes(entries);
    let output = capped.out.join("\n");
    const notices: string[] = [];
    if (entryLimitReached) notices.push(`${effLimit} entries limit reached. Use limit=${effLimit * 2} for more`);
    if (capped.truncated) notices.push("50.0KB limit reached");
    if (res.timedOut) notices.push(`超时（上限 ${limitSec} 秒），请缩小目录范围`);
    if (notices.length) output += `\n\n[${notices.join(". ")}]`;
    return textRes(output, { remote: t.server.id, timeoutSec: limitSec, entryLimitReached: entryLimitReached ? effLimit : undefined, timedOut: res.timedOut || undefined });
  }

  // ---- 同名覆盖内置 grep / find / ls (schema 原样复用, 模型感知不变) ----
  pi.registerTool({
    ...grepDef,
    async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) {
      const t = resolveSearchTarget(params.path);
      if (t) return remoteGrep(t, params, signal, onUpdate);
      return withLocalTimeout(signal, (sig) => grepDef.execute(id, params, sig, onUpdate, ctx));
    },
  });

  pi.registerTool({
    ...findDef,
    async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) {
      const t = resolveSearchTarget(params.path);
      if (t) return remoteFind(t, params, signal, onUpdate);
      return withLocalTimeout(signal, (sig) => findDef.execute(id, params, sig, onUpdate, ctx));
    },
  });

  pi.registerTool({
    ...lsDef,
    async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) {
      const t = resolveSearchTarget(params.path);
      if (t) return remoteLs(t, params, signal, onUpdate);
      return withLocalTimeout(signal, (sig) => lsDef.execute(id, params, sig, onUpdate, ctx));
    },
  });

  // ---- remote_exec: 通用远程命令, 三档权限审查 ----
  pi.registerTool({
    name: "remote_exec",
    label: "远程SSH命令",
    description:
      "在远程 Linux 服务器 (62→Y:盘 / 31→Z:盘) 经 SSH 执行 shell 命令, 用于大规模代码检索/编译辅助等 SMB 慢路径的加速。" +
      "命令按当前权限模式审查: 只读=仅检索类白名单; 读写(默认)=写目标限定当前工程 pri_project/driver/<platform>/<project>/ 与 public/ 及 /tmp; 完全权限=仅拦灾难级命令。" +
      "远端由 timeout 硬限时, 输出截断至 200 行/50KB。",
    parameters: Type.Object({
      command: Type.String({ description: "在服务器上执行的 shell 命令 (bash 语法)" }),
      cwd: Type.Optional(Type.String({ description: "工作目录, 支持 Windows (Y:/Z:/UNC) 或 Linux 绝对路径; 缺省为当前本地工程根" })),
      timeout_sec: Type.Optional(Type.Number({ description: "超时秒数, 60-600; 缺省按目录文件数自动估算" })),
      server: Type.Optional(Type.String({ description: "目标服务器 '62' 或 '31', 缺省按 cwd/当前工程推断" })),
    }),
    async execute(_id: string, params: any, signal: AbortSignal | undefined, onUpdate: any) {
      if (!rex || !localSvc) {
        return textRes("remote-exec 核心模块未加载", { error: "no_core" }, true);
      }
      const mode = getPermMode();
      const modeName = rex.MODE_NAMES[mode] || "读写";
      const writeRoots = getWriteRoots();

      let server = params.server ? rex.resolveServer(params.server) : null;
      let linuxCwd = "";
      if (params.cwd) {
        const c = String(params.cwd).trim();
        linuxCwd = c.startsWith("/") ? c : localSvc.windowsPathToLinux(c);
        if (!server) server = rex.resolveServer(c);
      }
      const proj = getActiveProject();
      if (!server && proj) server = rex.resolveServer(proj.serverId);
      if (!server) server = rex.resolveServer("62");
      if (!linuxCwd) linuxCwd = (proj && proj.linuxPath) || server.linuxRoot || "/";

      // linuxCwd 解析完成后审查: ctx.cwd 供 git/repo /tmp 恶意仓库防护
      const chk = rex.checkCommand(String(params.command || ""), mode, { writeRoots, cwd: linuxCwd });
      if (!chk.ok) {
        return textRes(`当前为「${modeName}」模式，不允许：${chk.reason}。可在输入框左下角切换权限模式`, { denied: true, mode }, true);
      }

      let timeoutSec = params.timeout_sec;
      if (typeof timeoutSec === "number" && isFinite(timeoutSec) && timeoutSec > 0) {
        timeoutSec = rex.clampTimeoutSec(timeoutSec); // 生产下限 60s; 测试可经 TABONKB_REMOTE_MIN_TIMEOUT 调低
      } else {
        const cnt = await probeFileCount(server, linuxCwd);
        timeoutSec = rex.calcTimeoutSec(cnt);
      }

      const cmdStr = linuxCwd ? `cd ${rex.shellQuote(linuxCwd)} && ${params.command}` : String(params.command);
      const res = await runRemote(server, cmdStr, timeoutSec, signal, onUpdate);
      if (res.aborted) throw new Error("Operation aborted");

      let out = res.stdout || "";
      if (res.stderr && res.stderr.trim()) out += `${out ? "\n" : ""}--- STDERR ---\n${res.stderr}`;

      const allLines = out.split("\n");
      const totalLines = allLines.length;
      const totalBytes = Buffer.byteLength(out, "utf-8");
      if (totalLines > 200 || totalBytes > MAX_OUT_BYTES) {
        const tailLines = allLines.slice(-200);
        let tail = tailLines.join("\n");
        if (Buffer.byteLength(tail, "utf-8") > MAX_OUT_BYTES) tail = tail.slice(-MAX_OUT_BYTES);
        out = `[输出已截断: 完整 ${totalLines} 行 / ${(totalBytes / 1024).toFixed(1)}KB, 以下为尾部]\n${tail}`;
      }

      const header = `[remote_exec · ${server.name} · ${modeName}模式] cwd: ${linuxCwd}  超时上限: ${timeoutSec}s\n`;
      const footer = res.timedOut
        ? `\n[命令执行超时（上限 ${timeoutSec} 秒）]`
        : (res.code !== 0 ? `\n[exit code ${res.code}]` : "");
      return textRes(header + out + footer, { code: res.code, timeoutSec, timedOut: res.timedOut || undefined, server: server.id }, res.timedOut || undefined);
    },
  });
}
