/* ==========================================================================
   Local Exec Core — AI 专用本地 cmd 执行器纯逻辑内核 (无副作用, 可直接 node 测试)
   - 单条 cmd.exe 命令: 双引号外 & | < > ; ^ 拒绝 (禁链式/管道/重定向);
     % ! ` $( 任意位置拒绝 (cmd 环境变量展开在双引号内同样生效, 故不按引号豁免)
   - 权限三档: readonly 检索类白名单 / readwrite = readonly + 受限写动词
     (写目标限定 writeRoots/vaultRoot 内绝对路径) / full 仅硬拦灾难级
   - 注意: cmd.exe 中单引号是字面字符不具保护语义, 故词法仅认双引号
   ========================================================================== */

const { clampTimeoutSec, MODE_NAMES } = require('./remote-exec-core.js');

/* ---------- cmd 词法 ---------- */

/** 词法扫描: 双引号内 &|< >;^ 视为字面, 其余位置出现即拒; % ! ` $( \r \n 任意位置拒绝 */
function lexScan(raw) {
  let inD = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\r' || c === '\n') return '禁止换行 (单条命令约束)';
    if (c === '"') { inD = !inD; continue; }
    if (inD) continue;
    if (c === '&' || c === '|' || c === '<' || c === '>' || c === ';' || c === '^') {
      return `禁止 cmd 操作符 '${c}' (不支持链式/管道/重定向)`;
    }
  }
  if (raw.indexOf('%') >= 0) return "禁止 '%' (cmd 环境变量展开在引号内同样生效, 可泄露凭据类环境变量)";
  if (raw.indexOf('!') >= 0) return "禁止 '!' (延迟环境变量展开)";
  if (raw.indexOf('`') >= 0) return '禁止反引号';
  if (raw.indexOf('$(') >= 0) return '禁止 $( 命令替换';
  return null;
}

/** 空白 + 双引号分词 (cmd 语义: 单引号为字面字符不参与分组, ^ 已在词法层拒绝) */
function tokenizeCmd(raw) {
  const toks = [];
  let cur = '', has = false, inD = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') { inD = !inD; has = true; continue; }
    if (inD) { cur += c; continue; }
    if (/\s/.test(c)) { if (has) { toks.push(cur); cur = ''; has = false; } continue; }
    cur += c; has = true;
  }
  if (has) toks.push(cur);
  return toks;
}

/** 命令名归一化: 去路径前缀、去内联 /flag (dir/b → dir)、去 .exe/.com/.bat/.cmd/.ps1 后缀, 小写 */
function cmdName(tok) {
  let n = String(tok || '');
  if (/[:\\]/.test(n)) {
    const i = Math.max(n.lastIndexOf('\\'), n.lastIndexOf('/'));
    n = n.slice(i + 1);
  }
  const sl = n.indexOf('/');
  if (sl >= 0) n = n.slice(0, sl);
  return n.toLowerCase().replace(/\.(exe|com|bat|cmd|ps1)$/, '');
}

/* ---------- Windows 路径规范化与写目标判定 ---------- */

/** 规范化: 去首尾引号 / /→\ / 去 \??\、\\?\、\\.\ 前缀 / 去尾斜杠 (C:\ → C:) */
function normWinPath(p) {
  let v = String(p || '').trim();
  v = v.replace(/^["']+|["']+$/g, '');
  v = v.replace(/\//g, '\\');
  v = v.replace(/^\\{1,2}\?{1,2}\\/, '');   // \??\ / \\?\ 扩展路径前缀
  v = v.replace(/^\\{1,2}\.\\/, '');        // \\.\ 设备命名空间
  v = v.replace(/\\+$/g, '');
  return v;
}

function isAbsWin(p) {
  return /^[a-zA-Z]:\\/.test(p) || /^\\\\/.test(p);
}

/** 规范化后是否恰等于允许写根本身 (是否拒绝由调用方按动作类型决定) */
function isRootItself(rawPath, root) {
  const a = normWinPath(rawPath).toLowerCase();
  const b = normWinPath(root).toLowerCase();
  return !!a && !!b && a === b;
}

function allRoots(ctx) {
  const roots = [];
  if (ctx && Array.isArray(ctx.writeRoots)) roots.push.apply(roots, ctx.writeRoots);
  if (ctx && ctx.vaultRoot) roots.push(ctx.vaultRoot);
  return roots;
}

/**
 * 写目标合法性: 必须 X:\ 或 \\srv\share\sub 绝对路径; 禁 .. 段/.git 组件/盘符根/共享根;
 * 前缀命中 ctx.writeRoots 或 ctx.vaultRoot (根相等亦视为命中, 删除类由 isRootItself 再拦)
 */
function localWriteTargetOk(rawPath, ctx) {
  const p = normWinPath(rawPath);
  const pl = p.toLowerCase();
  if (!p || !isAbsWin(p)) return false;
  if (/^[a-z]:$/.test(pl)) return false;                    // 盘符根 C:\ → C:
  const segs = p.split('\\').filter(Boolean);
  if (segs.some(s => s === '..')) return false;             // .. 段逃逸
  if (segs.some(s => s.toLowerCase() === '.git')) return false; // 禁写仓库内部
  if (p.startsWith('\\\\') && segs.length < 3) return false; // UNC 共享根本身视同根
  return allRoots(ctx).some(r => {
    const rr = normWinPath(r).toLowerCase();
    return !!rr && (pl === rr || pl.startsWith(rr + '\\'));
  });
}

function isRootItselfAny(rawPath, ctx) {
  return allRoots(ctx).some(r => isRootItself(rawPath, r));
}

/** 绝对路径是否位于允许写根下 (git -C 等读侧检查, 根目录本身允许) */
function underRoots(rawPath, ctx) {
  const pl = normWinPath(rawPath).toLowerCase();
  return allRoots(ctx).some(r => {
    const rr = normWinPath(r).toLowerCase();
    return !!rr && (pl === rr || pl.startsWith(rr + '\\'));
  });
}

/* ---------- 敏感凭据路径 (所有模式含 full, 防密钥/浏览器凭据进入 LLM 上下文) ---------- */

const SENS_TOKEN_RES = [
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/i,
  /(^|[\\/])\.aws[\\/]credentials$/i,
  /(^|[\\/])\.kube[\\/]config$/i,
  /(^|[\\/])\.docker[\\/]config\.json$/i,
  /(^|[\\/])\.netrc$/i,
  /(^|[\\/])\.git-credentials$/i,
  /(^|[\\/])\.gnupg([\\/]|$)/i,
  /(^|[\\/])ntuser\.dat([\\/._-]|$)/i,          // NTUSER.DAT 及其 .LOG/.TM 变体
  /(^|[\\/])system32[\\/]config([\\/]|$)/i,     // 注册表 hive 目录
  /(^|[\\/])(sam|security)$/i,                  // 直接命名 hive 文件
  /(^|[\\/])(cookies|local state|login data|web data)$/i  // 浏览器凭据库
];
// 带空格的库名在未加引号时会跨 token, 对"已扫描 token 串接"再做一次整体检测
const SENS_SPACED_RE = /(^|[\\/ ])(login data|web data)([\\/ ]|$)/i;

/** 参数位敏感路径扫描; findstr/find 的 pattern 位置与 git grep 的 pattern 位置跳过 (同 remote-exec-core 思路) */
function sensitiveScan(toks) {
  const name = cmdName(toks[0] || '');
  const args = toks.slice(1);
  const skip = new Set();
  if (name === 'findstr') {
    const patByFlag = args.some(a => /^\/[cg]/i.test(a));   // /c: 或 /g: 已给出 pattern 来源
    if (!patByFlag) {
      const pi = args.findIndex(a => !/^[-\/]/.test(a));
      if (pi >= 0) skip.add(pi);                            // 首个位置参数 = 搜索 pattern
    }
  } else if (name === 'find') {
    const pi = args.findIndex(a => !/^[-\/]/.test(a));      // find "str" files —— 首位置参数恒为 str
    if (pi >= 0) skip.add(pi);
  } else if (name === 'git') {
    const gi = args.findIndex(a => a === 'grep');
    if (gi >= 0) {
      const pi = args.findIndex((a, j) => j > gi && !/^[-\/]/.test(a));
      if (pi >= 0) skip.add(pi);                            // git grep 的首个非旗标参数为 pattern
    }
  }
  const scanned = [toks[0]];
  args.forEach((a, i) => {
    if (skip.has(i)) return;
    if (/^[-\/]/.test(a)) {
      // 带文件值的旗标: 值仍是文件路径, 提取后照扫
      // findstr /g:file /f:file /d:dir | xcopy /EXCLUDE:file | robocopy /JOB:/LOG:/UNILOG:file
      if (name === 'findstr' && /^\/[gfd]:/i.test(a)) scanned.push(a.slice(3));
      else if (name === 'xcopy' && /^\/exclude:/i.test(a)) scanned.push(a.slice(a.indexOf(':') + 1));
      else if (name === 'robocopy' && /^\/(unilog|log|job)\+?:/i.test(a)) scanned.push(a.slice(a.indexOf(':') + 1));
      return;
    }
    scanned.push(a);
  });
  for (const t of scanned) {
    const nt = String(t).replace(/\//g, '\\');
    for (const re of SENS_TOKEN_RES) {
      if (re.test(nt)) return `禁止访问凭据/密钥类文件: '${String(t).slice(0, 60)}'`;
    }
  }
  const joined = scanned.map(t => String(t).replace(/\//g, '\\')).join(' ');
  if (SENS_SPACED_RE.test(joined)) return '禁止访问凭据/密钥类文件';
  return null;
}

/* ---------- 只读档白名单 ---------- */

const RO_CMDS = new Set([
  'dir', 'type', 'findstr', 'certutil', 'fc', 'tree', 'where', 'find', 'sort',
  'more', 'whoami', 'hostname', 'ver', 'ipconfig', 'tasklist', 'attrib', 'robocopy',
  'git'
]);

const GIT_RO_SUBS = new Set(['status', 'log', 'diff', 'show', 'blame', 'ls-files', 'rev-parse', 'grep']);
const GIT_DENY_RE = /^--(config-env|exec-path|git-dir|work-tree|namespace|super-prefix|output|textconv|ext-diff)(=|$)/;

/** git 仅放行只读子命令; -c/--git-dir 等注入旗标全拒; -C 目录禁 ../变量, 绝对路径须在 vaultRoot/writeRoots 下 */
function checkGitLocal(args, ctx) {
  for (const t of args) {
    if (t === '-c' || (t.startsWith('-c') && !t.startsWith('--'))) {
      return 'git 禁止 -c (可注入任意配置)';
    }
    if (GIT_DENY_RE.test(t)) {
      return 'git 禁止 --git-dir/--work-tree/--exec-path/--output/--textconv/--ext-diff/--namespace (可注入配置/写文件/执行外部命令)';
    }
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '-C') continue;
    const dir = args[i + 1] || '';
    // ~ 不在拒集: cmd/git 均无 ~ 展开语义, 且 ADMINI~1 类 8.3 短路径合法含 ~
    if (/\.\.|[%$`*?[\]{}'"|;&<>!]/.test(dir)) return `git -C 目录含非法成分: '${dir}'`;
    if (isAbsWin(normWinPath(dir)) && !underRoots(dir, ctx)) {
      return `git -C 绝对路径须位于知识库/允许写根下: '${dir}'`;
    }
    i++;
  }
  let sub = null;
  const subArgs = [];
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (sub === null) {
      if (t === '-C') { i++; continue; }
      if (/^-/.test(t)) continue;
      sub = t;
      continue;
    }
    subArgs.push(t);
  }
  if (!sub) return 'git 缺少子命令';
  if (!GIT_RO_SUBS.has(sub)) return `不允许 git ${sub} (仅放行 status/log/diff/show/blame/ls-files/rev-parse/grep)`;
  if (subArgs.some(a => /^--(output|ext-diff|textconv)/.test(a))) {
    return 'git 禁止 --output/--ext-diff/--textconv (可写文件或执行外部命令)';
  }
  if ((sub === 'diff' || sub === 'log' || sub === 'show') && subArgs.some(a => a === '-o' || /^-o./.test(a))) {
    return `git ${sub} 禁止 -o/--output 写文件`;
  }
  return null;
}

/** 只读白名单命令的逐项参数检查 (readonly/readwrite 共用) */
function checkRoArgs(name, args, ctx) {
  if (name === 'certutil') {
    if (!/^-hashfile$/i.test(args[0] || '')) return "certutil 仅限 '-hashfile' 子命令";
    return null;
  }
  if (name === 'sort') {
    if (args.some(a => /^\/o/i.test(a))) return 'sort 禁止 /O 写文件';
    return null;
  }
  if (name === 'attrib') {
    if (!args.every(a => /^[^+\-/]/.test(a))) return 'attrib 仅限无修改旗标的查询形式 (参数须全为路径)';
    return null;
  }
  if (name === 'robocopy') {
    if (!args.some(a => /^\/l$/i.test(a))) return '只读模式 robocopy 必须带 /L (仅列举不落地)';
    if (args.some(a => /^\/(unilog|log)\+?/i.test(a))) return 'robocopy 禁止 /LOG 写日志文件';
    return null;
  }
  if (name === 'git') return checkGitLocal(args, ctx);
  return null;
}

/* ---------- 读写档受限写动词 ---------- */

const RW_WRITE_CMDS = new Set(['copy', 'xcopy', 'robocopy', 'move', 'ren', 'rename', 'mkdir', 'md', 'del', 'erase', 'rmdir', 'rd']);

function checkTarget(t, ctx, verb, isDelete) {
  if (!localWriteTargetOk(t, ctx)) return `${verb} 目标 '${t}' 不在允许写入范围 (知识库/当前工程/TEMP, 须绝对路径)`;
  if (isDelete && isRootItselfAny(t, ctx)) return `${verb} 禁止作用于允许写根本身: '${t}'`;
  return null;
}

/** 读写档写动词的写目标提取与边界校验; isDelete=true 的目标额外禁止命中写根本身 */
function checkRwWriteVerbs(name, args, ctx) {
  const pos = args.filter(a => !/^[-/]/.test(a));
  if (name === 'copy' || name === 'xcopy') {
    if (pos.length < 2) return `${name} 缺少目标 (写目标须为绝对路径)`;
    return checkTarget(pos[pos.length - 1], ctx, name, false);
  }
  if (name === 'robocopy') {
    if (args.some(a => /^\/(mir|purge|mov|move)$/i.test(a))) return 'robocopy 禁止 /MIR /PURGE /MOV /MOVE (镜像/删除类)';
    const logArg = args.find(a => /^\/(unilog|log)\+?:/i.test(a));
    if (logArg) {
      const r = checkTarget(logArg.split(':').slice(1).join(':'), ctx, 'robocopy', false);
      if (r) return `robocopy 日志${r}`;
    }
    if (pos.length < 2) return 'robocopy 缺少目标目录';
    return checkTarget(pos[1], ctx, 'robocopy', false);
  }
  if (name === 'move') {
    // move 语义: 末位位置参数=目标目录, 其余=源 (源被移除视同删除, 禁通配符防批量搬空)
    if (pos.length < 2) return 'move 缺少目标';
    for (const t of pos.slice(0, -1)) {
      if (/[*?]/.test(t)) return `move 删除/移动类目标禁止通配符: '${t}'`;
      const r = checkTarget(t, ctx, 'move', true);
      if (r) return r;
    }
    return checkTarget(pos[pos.length - 1], ctx, 'move', false); // 目标允许为写根本身 (移入根目录合法)
  }
  if (name === 'ren' || name === 'rename') {
    if (pos.length < 2) return 'ren 缺少目标';
    if (/[*?]/.test(pos[0])) return `ren 删除/移动类目标禁止通配符: '${pos[0]}'`;
    const r = checkTarget(pos[0], ctx, 'ren', true);
    if (r) return r;
    if (/[:\\/]/.test(pos[1]) || pos[1].indexOf('..') >= 0) return 'ren 新名称必须为不含路径的裸文件名';
    return null;
  }
  if (name === 'mkdir' || name === 'md') {
    if (!pos.length) return `${name} 缺少目标`;
    for (const t of pos) { const r = checkTarget(t, ctx, name, false); if (r) return r; }
    return null;
  }
  // del / erase / rd / rmdir —— 目标全部须过写边界, 禁通配符 (防 * 展开清空写根), 且禁止作用于写根本身
  if (!pos.length) return `${name} 缺少目标`;
  for (const t of pos) {
    if (/[*?]/.test(t)) return `${name} 删除/移动类目标禁止通配符: '${t}'`;
    const r = checkTarget(t, ctx, name, true);
    if (r) return r;
  }
  return null;
}

/* ---------- 只读/读写档同步拒绝集 (脚本宿主/解释器/网络与凭据敏感命令, 无法审查内嵌行为) ---------- */

const DENIED_CMDS = new Set([
  // 规格内
  'powershell', 'pwsh', 'wscript', 'cscript', 'mshta', 'rundll32', 'regsvr32', 'wmic',
  'schtasks', 'sc', 'net', 'netsh', 'reg', 'wsl', 'bash', 'sh', 'python', 'python3',
  'node', 'npm', 'pip', 'winget', 'choco', 'curl', 'wget', 'bitsadmin', 'msiexec', 'set',
  // 同类逃逸面补齐: cmd 再入/batch 流程关键字/其它解释器/下载与进程操控
  'cmd', 'command', 'start', 'call', 'for', 'forfiles', 'if', 'goto',
  'net1', 'py', 'pythonw', 'pyw', 'npx', 'pnpm', 'yarn', 'deno', 'bun', 'tsx', 'ts-node',
  'perl', 'php', 'ruby', 'java', 'javaw', 'julia', 'lua', 'zsh',
  'msbuild', 'installutil', 'regasm', 'regsvcs', 'runas', 'psexec', 'ftp', 'tftp', 'wusa', 'at',
  'taskkill', 'tskill'
]);

/* ---------- 完全权限档: 仅硬拦灾难级 ---------- */

const FULL_BLOCK_CMDS = {
  format: '禁止 format (磁盘格式化)',
  diskpart: '禁止 diskpart (磁盘分区操作)',
  bcdedit: '禁止 bcdedit (启动配置修改)',
  takeown: '禁止 takeown (所有权夺取)',
  shutdown: '禁止 shutdown',
  restart: '禁止 restart',
  set: '禁止 set (输出进程环境变量含凭据)'
};

function hardBlockFull(toks, name) {
  if (FULL_BLOCK_CMDS[name]) return FULL_BLOCK_CMDS[name];
  const args = toks.slice(1);
  if (name === 'cipher' && args.some(a => /^\/w/i.test(a))) return '禁止 cipher /w (空闲空间覆写擦除)';
  if (name === 'icacls' && args.some(a => /^\/(grant|deny|remove|setowner|reset|replace|save|restore|setintegritylevel|inheritance)/i.test(a))) {
    return '禁止 icacls 修改 ACL';
  }
  if (name === 'reg') {
    const sub = (args.find(a => !/^[-/]/.test(a)) || '').toLowerCase();
    if (['add', 'delete', 'import', 'save', 'restore', 'load', 'unload', 'copy', 'export'].indexOf(sub) >= 0) {
      return `禁止 reg ${sub} (注册表写/导出)`;
    }
  }
  if (name === 'del' || name === 'erase' || name === 'rd' || name === 'rmdir') {
    for (const t of args.filter(a => !/^[-/]/.test(a))) {
      const p = String(t).replace(/^["']+|["']+$/g, '').replace(/\//g, '\\');
      if (/^[a-zA-Z]:[\\]?$/.test(p)                     // del C:\ / del C:
        || /^[\\]+$/.test(p)                           // del \ (当前盘根)
        || /^\\\\[^\\]+\\[^\\]+[\\]?$/.test(p)         // del \\srv\share 共享根
        || /^[a-zA-Z]:\\windows[\\]?$/i.test(p)        // del C:\Windows 系统根
        || /^\\windows[\\]?$/i.test(p)) {
        return `禁止 ${name} 作用于盘符根/共享根/系统根: '${t}'`;
      }
    }
  }
  return null;
}

/* ---------- 主入口 ---------- */

/**
 * 三档本地命令审查: readonly 白名单 / readwrite = 白名单+受限写动词 / full 仅硬拦灾难级
 * ctx: { writeRoots: string[], vaultRoot?: string, cwd?: string }
 * @returns {{ok: boolean, reason?: string}}
 */
function checkLocalCommand(cmdStr, mode, ctx = {}) {
  const raw = String(cmdStr || '');
  if (!raw.trim()) return { ok: false, reason: '空命令' };
  const m = (mode === 'readonly' || mode === 'readwrite' || mode === 'full') ? mode : 'readwrite';

  const lexErr = lexScan(raw);
  if (lexErr) return { ok: false, reason: lexErr };

  const toks = tokenizeCmd(raw);
  if (!toks.length || !toks[0]) return { ok: false, reason: '空命令' };
  const name = cmdName(toks[0]);
  if (!name) return { ok: false, reason: '无法识别命令名' };

  const sp = sensitiveScan(toks);   // 凭据/密钥路径全档硬拦截
  if (sp) return { ok: false, reason: sp };

  if (m === 'full') {
    const hb = hardBlockFull(toks, name);
    return hb ? { ok: false, reason: hb } : { ok: true };
  }

  if (DENIED_CMDS.has(name)) {
    return {
      ok: false,
      reason: name === 'set'
        ? 'set 会输出进程环境变量 (含凭据), 一律禁止'
        : `只读/读写模式禁止 '${name}' (脚本宿主/解释器/网络类命令无法审查内嵌行为)`
    };
  }

  const args = toks.slice(1);
  if (m === 'readonly') {
    if (RO_CMDS.has(name)) {
      const r = checkRoArgs(name, args, ctx);
      return r ? { ok: false, reason: r } : { ok: true };
    }
    return { ok: false, reason: `只读模式不允许命令 '${name}'` };
  }

  // readwrite: 受限写动词优先 (robocopy 允许无 /L 的真实拷贝), 其余只读白名单沿用逐项检查
  if (RW_WRITE_CMDS.has(name)) {
    const r = checkRwWriteVerbs(name, args, ctx);
    return r ? { ok: false, reason: r } : { ok: true };
  }
  if (RO_CMDS.has(name)) {
    const r = checkRoArgs(name, args, ctx);
    return r ? { ok: false, reason: r } : { ok: true };
  }
  return { ok: false, reason: `该命令需完全权限模式: '${name}'` };
}

module.exports = {
  MODE_NAMES,
  clampTimeoutSec,
  checkLocalCommand,
  localWriteTargetOk,
  isRootItself,
  normWinPath,
  _internals: { lexScan, tokenizeCmd, cmdName, sensitiveScan, checkGitLocal }
};
