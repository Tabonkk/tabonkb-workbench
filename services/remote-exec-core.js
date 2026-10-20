/* ==========================================================================
   Remote Exec Core — AI 专用 SSH 执行器纯逻辑内核 (无副作用, 可直接 node 测试)
   - 用户命令一律 base64 传输, 远端经服务器自带 timeout -k 5 硬限时
   - 权限三档: readonly 白名单(较强) / readwrite = readonly白名单 + 受限写动词
     (白名单模型, 仍非沙箱) / full 仅硬拦截灾难级命令
   ========================================================================== */

const { LOCAL_SERVERS, windowsPathToLinux, linuxPathToWindows, getWinSshBin } = require('./local-project-service.js');

/** 动态超时: clamp(60,600,60+fileCount/250) 取整; 探测失败(非有限数/负数)兜底 180 */
function calcTimeoutSec(fileCount) {
  if (typeof fileCount !== 'number' || !isFinite(fileCount) || fileCount < 0) return 180;
  return Math.max(60, Math.min(600, Math.floor(60 + fileCount / 250)));
}

/** remote_exec 显式超时夹取: [minSec, 600]; minSec 缺省取 env TABONKB_REMOTE_MIN_TIMEOUT 或 60 */
function clampTimeoutSec(requested, minSec) {
  const lo = (typeof minSec === 'number' && isFinite(minSec) && minSec > 0)
    ? Math.floor(minSec)
    : (Number(process.env.TABONKB_REMOTE_MIN_TIMEOUT) || 60);
  const n = Math.floor(Number(requested));
  if (!isFinite(n) || n <= 0) return lo;
  return Math.max(lo, Math.min(600, n));
}

/** 组装远端命令: timeout -k 5 <T> bash -c "$(echo <B64> | base64 -d)" <marker>; marker 作 $0 供 pkill -f 匹配 */
function buildRemoteCommand(opts) {
  const cmd = String((opts && opts.cmd) || '');
  const timeoutSec = Math.max(1, Math.floor((opts && opts.timeoutSec) || 60));
  const marker = (opts && opts.marker) || `tw_rmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const b64 = Buffer.from(cmd, 'utf8').toString('base64');
  return `timeout -k 5 ${timeoutSec} bash -c "$(echo ${b64} | base64 -d)" ${marker}`;
}

/** 组装 ssh.exe 参数 (BatchMode 免密 + 保活) */
function buildSshArgs(server, remoteCmd) {
  const srv = (typeof server === 'string' ? resolveServer(server) : server) || resolveServer('62');
  return [
    '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
    `${srv.user}@${srv.sshHost}`, remoteCmd
  ];
}

/** 路径/服务器号 → LOCAL_SERVERS 条目; 空值默认 62; 非映射路径返回 null */
function resolveServer(pathOrServerId) {
  const srv62 = LOCAL_SERVERS.find(s => s.id === '62') || null;
  const srv31 = LOCAL_SERVERS.find(s => s.id === '31') || null;
  if (pathOrServerId && typeof pathOrServerId === 'object' && pathOrServerId.id) return pathOrServerId;
  if (pathOrServerId === undefined || pathOrServerId === null || pathOrServerId === '') return srv62;
  const s = String(pathOrServerId).trim();
  if (s === '62' || s === srv62?.host) return srv62;
  if (s === '31' || s === srv31?.host) return srv31;
  const norm = s.replace(/\\/g, '/');
  if (/^[Yy]:/.test(norm) || norm.startsWith('//192.168.1.62/') || norm.startsWith('/dfb/')) return srv62;
  if (/^[Zz]:/.test(norm) || norm.startsWith('//192.168.1.31/') || norm.startsWith('/home/')) return srv31;
  return null;
}

/** shell 单引号安全转义 */
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

/* ---------- 命令解析辅助 ---------- */

/** 按 ; && || | 换行 在引号外切分命令段 */
function splitTopLevel(cmd) {
  const segs = [];
  let cur = '', inS = false, inD = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (inS) { cur += c; if (c === "'") inS = false; continue; }
    if (inD) { cur += c; if (c === '"') inD = false; continue; }
    if (c === '\\') { cur += c; if (i + 1 < cmd.length) cur += cmd[++i]; continue; }
    if (c === "'") { inS = true; cur += c; continue; }
    if (c === '"') { inD = true; cur += c; continue; }
    if (c === '&' && cmd[i + 1] === '&') { segs.push(cur); cur = ''; i++; continue; }
    if (c === '|' && cmd[i + 1] === '|') { segs.push(cur); cur = ''; i++; continue; }
    if (c === ';' || c === '|' || c === '\n' || c === '\r') { segs.push(cur); cur = ''; continue; }
    cur += c;
  }
  segs.push(cur);
  return segs;
}

/** 将引号内内容与转义字符替换为空格, 供操作符检测 */
function stripQuoted(s) {
  let out = '', inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inS) { if (c === "'") inS = false; out += ' '; continue; }
    if (inD) { if (c === '"') inD = false; out += ' '; continue; }
    if (c === '\\') { out += ' '; if (i + 1 < s.length) { out += ' '; i++; } continue; }
    if (c === "'") { inS = true; out += ' '; continue; }
    if (c === '"') { inD = true; out += ' '; continue; }
    out += c;
  }
  return out;
}

/** 只抹单引号内容与转义字符, 保留双引号内容 —— 双引号内 $(...)/反引号在 bash 中仍会执行 */
function stripSingleQuoted(s) {
  let out = '', inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inS) { if (c === "'") inS = false; else out += ' '; continue; }
    if (inD) {
      if (c === '"') inD = false;
      else if (c === '\\') { out += ' '; if (i + 1 < s.length) { out += ' '; i++; } }
      else out += c;
      continue;
    }
    if (c === '\\') { out += ' '; if (i + 1 < s.length) { out += ' '; i++; } continue; }
    if (c === "'") { inS = true; continue; }
    if (c === '"') { inD = true; out += c; continue; }
    out += c;
  }
  return out;
}

/** 引号/转义感知的空白分词, 返回去引号后的 token 串 */
function tokenize(seg) {
  const toks = [];
  let cur = '', has = false, inS = false, inD = false;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (inS) { if (c === "'") inS = false; else cur += c; has = true; continue; }
    if (inD) {
      if (c === '"') inD = false;
      else if (c === '\\' && i + 1 < seg.length && '"\\$`'.includes(seg[i + 1])) cur += seg[++i];
      else cur += c;
      has = true; continue;
    }
    if (c === '\\') { if (i + 1 < seg.length) { cur += seg[++i]; has = true; } continue; }
    if (c === "'") { inS = true; has = true; continue; }
    if (c === '"') { inD = true; has = true; continue; }
    if (/\s/.test(c)) { if (has) { toks.push(cur); cur = ''; has = false; } continue; }
    cur += c; has = true;
  }
  if (has) toks.push(cur);
  return toks;
}

/** 提取 > >> &> >&file <> 的文件目标 (fd 复制如 2>&1 返回 null 占位并跳过) */
function extractRedirectTargets(raw) {
  const targets = [];
  let inS = false, inD = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inS) { if (c === "'") inS = false; continue; }
    if (inD) { if (c === '"') inD = false; continue; }
    if (c === '\\') { i++; continue; }
    if (c === "'") { inS = true; continue; }
    if (c === '"') { inD = true; continue; }
    if (c === '<' && raw[i + 1] === '>') { /* <> 读写打开, 视同写重定向 */ }
    else if (c !== '>') continue;
    let j = i + 1;
    if (raw[j] === '>') j++; // >>
    if (raw[j] === '&') {
      const after = raw[j + 1] || '';
      if (/[0-9-]/.test(after) || after === '') { i = j; continue; } // 2>&1 / >&- fd 复制
      j++; // >&file 合并输出到文件
    }
    while (j < raw.length && /\s/.test(raw[j])) j++;
    let tgt = '', q = null, started = false;
    while (j < raw.length) {
      const d = raw[j];
      if (q) { if (d === q) q = null; else tgt += d; j++; continue; }
      if (d === "'" || d === '"') { q = d; j++; started = true; continue; }
      if (/[\s;|&<>]/.test(d)) break;
      tgt += d; j++; started = true;
    }
    targets.push(started ? tgt : '');
    i = Math.max(i, j - 1);
  }
  return targets;
}

/** 段内是否还有后台 & (剔除 &> >&N 等重定向形态) */
function hasBackgroundAmp(stripped) {
  const t = stripped.replace(/&>>?/g, '').replace(/>&?-?\d/g, '');
  return t.includes('&');
}

const VAR_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** 跳过 VAR=val 前缀后的命令名索引 */
function firstCmdIndex(toks, from = 0) {
  let i = from;
  while (i < toks.length && VAR_PREFIX.test(toks[i])) i++;
  return i;
}

const basename = (t) => String(t || '').replace(/^.*\//, '');

/* ---------- 写目标与灾难级判定 ---------- */

/** 归一化路径 token (去尾斜杠, 反斜杠转正) */
function normTarget(t) {
  let v = String(t || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  return v || (String(t || '').trim() === '/' ? '/' : v);
}

const PROTECTED_ROOTS = new Set([
  '/', '~', '$HOME', '${HOME}', '.', '..', '*', '/*', '~/',
  '/dfb', '/dfb/tankaikun', '/dfb/tankaikun/share',
  '/home', '/home/tankaikun', '/home/tankaikun/share', '/home/tankaikun/share/work',
  '/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/boot', '/root',
  '/opt', '/dev', '/proc', '/sys', '/var', '/mnt', '/media', '/run', '/srv'
]);

/** 目标是否为根/顶层保护区 (递归删除/改权的灾难对象) */
function isProtectedTarget(tok) {
  const v = normTarget(tok);
  if (!v) return false;
  if (PROTECTED_ROOTS.has(v)) return true;
  if (PROTECTED_ROOTS.has(v.replace(/^~/, '/home/tankaikun'))) return true;
  for (const root of ['/dfb/tankaikun/share', '/home/tankaikun/share']) {
    if (root === v || root.startsWith(v + '/')) return true;
  }
  return false;
}

/** 写目标合法性: 必须为 writeRoots 或 /tmp 内绝对路径, 禁止 ../变量/通配符展开/.git 组件 */
function writeTargetOk(tok, writeRoots) {
  const p = normTarget(tok);
  if (!p || !p.startsWith('/')) return false;
  if (/(^|\/)\.\.(\/|$)/.test(p)) return false;
  if (/(^|\/)\.git(\/|$)/.test(p)) return false; // 禁止写 .git/config、hooks 等仓库内部
  if (/[$`~*?[\]{}!#;|&<>"']/.test(p)) return false;
  const roots = (Array.isArray(writeRoots) ? writeRoots : []).concat(['/tmp']);
  return roots.some((r) => {
    const rr = normTarget(r);
    return rr && (p === rr || p.startsWith(rr + '/'));
  });
}

/** 命令名是否处于"命令位" (段首/子壳/控制关键字/find -exec/xargs 之后) */
const CMD_STARTERS = new Set(['(', '{', '!', 'then', 'do', 'else', 'elif', 'while', 'until', 'time', 'nice', 'ionice', 'stdbuf', 'command', 'builtin', 'xargs', '-exec', '-execdir', '-ok', '-okdir']);
function isCmdPosition(toks, i, firstIdx) {
  if (i === firstIdx) return true;
  return i > 0 && CMD_STARTERS.has(toks[i - 1]);
}

/** 命令位上的危险命令逐个判定 (rm -rf 顶层/chmod -R 顶层/dd of=/dev/mkfs/关机/sudo/su) */
function hardBlockSegment(toks, stripped, firstIdx, rawSeg) {
  if (/\bsudo\b/.test(stripped)) return '禁止 sudo';
  for (let i = firstIdx; i < toks.length; i++) {
    if (!isCmdPosition(toks, i, firstIdx)) continue;
    const name = basename(toks[i]);
    if (name === 'su') return '禁止 su';
    if (/^(shutdown|reboot|halt|poweroff|init|telinit)$/.test(name)) return `禁止 ${name}`;
    if (/^(mkfs|mke2fs|mkswap|fdisk|sfdisk|parted|wipefs|cryptsetup|blkdiscard|sgdisk|gdisk)/.test(name)) return `禁止磁盘工具 ${name}`;
    if (name === 'systemctl' && toks.slice(i + 1).some(t => /^(poweroff|reboot|halt|shutdown|kexec|suspend|hibernate)$/.test(t))) return '禁止 systemctl 关机类操作';
    if (name === 'dd' && toks.slice(i + 1).some(t => /^of=\/dev\//.test(t))) return '禁止 dd 写块设备';
    if (name === 'rm' || name === 'chmod' || name === 'chown' || name === 'chgrp') {
      const args = toks.slice(i + 1);
      const destructive = name === 'rm'
        ? args.some(a => /^-[^-]*[rRf]/.test(a) || /^--(recursive|force|no-preserve-root)/.test(a))
        : args.some(a => /^-[^-]*R/.test(a) || /^--recursive/.test(a));
      if (destructive && args.some(a => !a.startsWith('-') && isProtectedTarget(a))) {
        return `禁止 ${name} 递归/强制作用于根或顶层目录`;
      }
    }
  }
  for (const t of extractRedirectTargets(rawSeg || stripped)) {
    if (/^\/dev\/(sd|hd|vd|xvd|nvme|mmcblk|loop|mapper|disk)/.test(t)) return '禁止重定向写块设备';
  }
  return null;
}

/* ---------- readonly 白名单 ---------- */

const RO_CMDS = new Set([
  'grep', 'find', 'ls', 'tree', 'diff', 'wc', 'du', 'stat', 'head', 'tail',
  'file', 'zcat', 'xxd', 'cat', 'sort', 'uniq', 'cut', 'tr',
  'basename', 'dirname', 'realpath', 'readlink', 'echo', 'pwd', 'date',
  'sed', 'awk', 'git', 'repo',
  'printf', 'true', 'false', 'test', '['
]);

const GIT_RO_SUBS = new Set(['status', 'log', 'diff', 'show', 'blame', 'rev-parse', 'branch', 'ls-files', 'describe', 'shortlog', 'config']);
const REPO_RO_SUBS = new Set(['status', 'info', 'manifest', 'list']);
const GIT_VAL_FLAGS = new Set(['-C']);

/** 提取 git/repo 的子命令与其参数 (跳过 -C/--git-dir 等带值旗标) */
function splitSubcommand(toks, ci) {
  let j = ci + 1, sub = null;
  const subArgs = [];
  while (j < toks.length) {
    const t = toks[j];
    if (sub === null) {
      if (GIT_VAL_FLAGS.has(t)) { j += 2; continue; }
      if (/^--[^=]+=.*/.test(t) || /^-[a-zA-Z]./.test(t) || /^--[a-z-]+$/.test(t)) { j++; continue; }
      if (/^-[a-zA-Z]$/.test(t)) { j++; continue; }
      sub = t; j++; continue;
    }
    subArgs.push(t); j++;
  }
  return { sub, subArgs };
}

const GIT_DENY_FLAGS = /^--(config-env|exec-path|git-dir|work-tree|namespace|super-prefix)(=|$)/;
const GIT_SHARE_ROOTS = /^\/(dfb\/tankaikun\/share|home\/tankaikun\/share)(\/|$)/;

/** git 仅放行只读子命令; 注入旗标/-C 越界//tmp 有效目录一律拒绝 (readonly/readwrite 共用) */
function checkGit(toks, ci, ctx) {
  const gargs = toks.slice(ci + 1);
  for (const t of gargs) {
    if (t === '-c' || (t.startsWith('-c') && !t.startsWith('--')) || GIT_DENY_FLAGS.test(t)) {
      return 'git 禁止 -c/--config-env/--exec-path/--git-dir/--work-tree/--namespace/--super-prefix (可注入配置或重定向仓库)';
    }
  }
  for (let i = 0; i < gargs.length; i++) {
    if (gargs[i] !== '-C') continue;
    const dir = gargs[i + 1] || '';
    if (/\.\.|[$`~*?[\]{}'"|;&<>]/.test(dir)) return `git -C 目录含非法成分: '${dir}'`;
    if (dir.startsWith('/') && !GIT_SHARE_ROOTS.test(dir)) return `git -C 绝对路径必须位于共享根下: '${dir}'`;
    i++;
  }
  const { sub, subArgs } = splitSubcommand(toks, ci);
  if (!sub) return 'git 缺少子命令';
  if (!GIT_RO_SUBS.has(sub)) return `不允许 git ${sub} (仅放行只读子命令)`;
  if (subArgs.some(a => /^--output($|=)/.test(a) || /^--ext-diff/.test(a) || /^--textconv/.test(a))) {
    return 'git 禁止 --output/--ext-diff/--textconv (可写文件或执行外部命令)';
  }
  if ((sub === 'diff' || sub === 'log' || sub === 'show') && subArgs.some(a => a === '-o' || /^-o./.test(a))) {
    return `git ${sub} 禁止 -o/--output 写文件`;
  }
  if (sub === 'branch') {
    const bad = subArgs.some(a => /^-[dDmMcCfFu]/.test(a)
      || /^--(delete|move|copy|force|set-upstream|unset-upstream|edit-description|create-reflog)/.test(a));
    if (bad) return '不允许 git branch 写操作';
  }
  if (sub === 'config' && subArgs[0] !== '--get') return 'git config 仅允许 --get 查询';
  // 有效目录 (-C 绝对值或 ctx.cwd) 不得在 /tmp —— 防读写档先在 /tmp 造恶意仓库再执行
  const cIdx = gargs.indexOf('-C');
  const absC = cIdx >= 0 && String(gargs[cIdx + 1] || '').startsWith('/') ? gargs[cIdx + 1] : null;
  const effDir = absC || (ctx && ctx.cwd) || '';
  if (/^\/tmp(\/|$)/.test(effDir)) return 'git 有效工作目录不得位于 /tmp (防恶意仓库)';
  return null;
}

/** repo 仅放行 status/info/manifest/list; manifest 禁 -o/--output-file; cwd 不得在 /tmp */
function checkRepo(toks, ci, ctx) {
  const { sub, subArgs } = splitSubcommand(toks, ci);
  if (!sub || !REPO_RO_SUBS.has(sub)) return `不允许 repo ${sub || ''} (仅放行 status/info/manifest/list)`;
  if (sub === 'manifest' && subArgs.some(a => a === '-o' || /^-o./.test(a) || /^--output-file/.test(a))) {
    return 'repo manifest 禁止 -o/--output-file 写文件';
  }
  const cwd = (ctx && ctx.cwd) || '';
  if (/^\/tmp(\/|$)/.test(cwd)) return 'repo 有效工作目录不得位于 /tmp (防恶意仓库)';
  return null;
}

/* ---------- sed 脚本解析 (readonly 严格语法 / readwrite sed -i 安全扫描共用) ---------- */

/** 跳过一个 /re/ 或 \xREx 形式的地址正则, 返回结束下标或 -1 */
function sedSkipRegex(p, i) {
  let d, j;
  if (p[i] === '/') { d = '/'; j = i + 1; }
  else if (p[i] === '\\' && /[\/~%|:#]/.test(p[i + 1] || '')) { d = p[i + 1]; j = i + 2; }
  else return -1;
  while (j < p.length) { if (p[j] === '\\') { j += 2; continue; } if (p[j] === d) return j + 1; j++; }
  return -1;
}

/** 收集 sed 脚本串 (-e/--expression 值或首个位置脚本); -f 脚本文件不可审查 → error */
function sedCollectScripts(toks, ci) {
  const args = toks.slice(ci + 1);
  const scripts = [];
  const pos = [];
  let usedE = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--') { pos.push(...args.slice(k + 1)); break; }
    if (/^--expression(=|$)/.test(a)) { usedE = true; scripts.push(a === '--expression' ? (args[++k] || '') : a.split('=').slice(1).join('=')); continue; }
    if (/^--file(=|$)/.test(a)) return { scripts, pos, error: true };
    if (/^--/.test(a)) continue;
    if (/^-[^-]/.test(a)) {
      const letters = a.slice(1);
      if (letters.includes('f')) return { scripts, pos, error: true };
      const eIdx = letters.indexOf('e');
      if (eIdx >= 0) { usedE = true; scripts.push(letters.slice(eIdx + 1) || args[++k] || ''); }
      continue;
    }
    pos.push(a);
  }
  if (!usedE && pos.length) scripts.push(pos.shift());
  return { scripts, pos };
}

/** 单条 sed 语句是否为 [地址[,地址]] 后仅接 p 或 = (只读档唯一放行形态) */
function sedReadonlyPartOk(p) {
  let i = 0;
  const takeAddr = () => {
    const m = /^\d+/.exec(p.slice(i));
    if (m) { i += m[0].length; return true; }
    if (p[i] === '$') { i++; return true; }
    if (p[i] === '/' || p[i] === '\\') { const j = sedSkipRegex(p, i); if (j >= 0) { i = j; return true; } }
    return false;
  };
  takeAddr();
  if (p[i] === ',') { i++; takeAddr(); }
  return /^[p=]$/.test(p.slice(i).trim());
}

/** 只读档 sed 脚本: 每条仅允许 'addr p'/'addr =' 形式 */
function checkSedScriptReadonly(script) {
  const parts = String(script).split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return 'sed 脚本为空';
  for (const p of parts) {
    if (!sedReadonlyPartOk(p)) return `只读模式 sed 脚本仅允许 '地址p'/'地址=' 形式: '${String(p).slice(0, 40)}'`;
  }
  return null;
}

/** 定位 sed 语句的命令字母 (跳过地址/花括号/取反), 供 sed -i 安全扫描 */
function sedCmdLetterIdx(p) {
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (/[\s{},!~+\d$,]/.test(c)) { i++; continue; }
    if (c === '/' || c === '\\') {
      const j = sedSkipRegex(p, i);
      if (j >= 0) { i = j; continue; }
    }
    return { letter: c, idx: i };
  }
  return { letter: '', idx: p.length };
}

/** sed 脚本安全扫描 (readwrite sed -i 用): 禁 e/w/r/R/W 命令与 s 的 e/w 标志 */
function checkSedScriptSafe(script) {
  const parts = String(script).split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return 'sed 脚本为空';
  for (const p of parts) {
    const { letter, idx } = sedCmdLetterIdx(p);
    if (!letter) return '无法解析的 sed 脚本';
    if (/[ewrRW]/.test(letter)) return `禁止 sed ${letter} 命令 (外部读写/执行)`;
    if (letter === 's') {
      const d = p[idx + 1];
      if (!d) return 'sed s 缺少分隔符';
      let last = -1;
      for (let j = idx + 2; j < p.length; j++) {
        if (p[j] === '\\') { j++; continue; }
        if (p[j] === d) last = j;
      }
      if (last < 0) return 'sed s 缺少替换分隔符';
      if (/[ew]/.test(p.slice(last + 1))) return 'sed s 禁止 e/w 标志';
    }
  }
  return null;
}

const SED_RO_LONG = new Set([
  '--quiet', '--silent', '--regexp-extended', '--posix', '--null-data',
  '--separate', '--unbuffered', '--debug', '--expression', '--line-length', '--follow-symlinks'
]);

/** sed 只读档: 旗标白名单 + 必须 -n + 脚本严格语法 (仅 addr p/=) */
function checkSedReadonly(toks, ci) {
  const args = toks.slice(ci + 1);
  let hasN = false;
  for (const a of args) {
    if (a === '--') break;
    if (/^--/.test(a)) {
      const key = a.split('=')[0];
      if (key === '--file') return '只读模式禁止 sed -f/--file (脚本文件不可审查)';
      if (key === '--in-place') return '只读模式禁止 sed -i 原位改写';
      if (!SED_RO_LONG.has(key)) return `只读模式 sed 不允许旗标 '${key}'`;
    } else if (/^-/.test(a)) {
      const letters = a.slice(1);
      if (letters.includes('i')) return '只读模式禁止 sed -i 原位改写';
      if (letters.includes('f')) return '只读模式禁止 sed -f (脚本文件不可审查)';
      if (!/^[nrEeulsz]+$/.test(letters)) return `只读模式 sed 不允许旗标 '${a}'`;
      if (letters.includes('n')) hasN = true;
    }
  }
  if (!hasN) return '只读模式 sed 须带 -n (纯查询)';
  const { scripts, error } = sedCollectScripts(toks, ci);
  if (error) return '只读模式禁止 sed -f (脚本文件不可审查)';
  if (!scripts.length) return 'sed 缺少脚本';
  for (const s of scripts) {
    const sr = checkSedScriptReadonly(s);
    if (sr) return sr;
  }
  return null;
}

const AWK_RO_LONG = new Set([
  '--assign', '--field-separator', '--posix', '--traditional', '--lint', '--no-lint',
  '--characters-as-bytes', '--bignum', '--non-decimal-data', '--optimize', '--re-interval',
  '--version', '--help', '--sandbox', '--csv'
]);

/** awk: -i/-f/-l/-o/-p/-d/-D/-g/-E 可写文件或装载扩展一律拒绝; system()/脚本内重定向/管道拒绝 */
function checkAwkReadonly(toks, ci) {
  const args = toks.slice(ci + 1);
  for (const a of args) {
    if (a === '--') break;
    if (/^--/.test(a)) {
      const key = a.split('=')[0];
      if (!AWK_RO_LONG.has(key)) return `只读模式 awk 不允许旗标 '${key}'`;
    } else if (/^-[^-]/.test(a)) {
      const body = a.slice(1);
      if (/^F/.test(body)) continue; // -F<sep> 分隔符可为任意字符
      const letters = (/^[A-Za-z]+/.exec(body) || [''])[0];
      if (/[dDefgilop]/.test(letters)) return `只读模式 awk 不允许 -i/-f/-l/-o/-p/-d/-D/-g/-E 旗标 (文件写入或脚本不可审查)`;
    }
  }
  if (args.some(t => /system\s*\(/.test(t))) return 'awk 禁止 system()';
  if (args.some(t => />>/.test(t) || /(print|printf)\s*>/.test(t) || /\|\s*(getline|[^\s|]+)/.test(t) || /getline\s*</.test(t))) {
    return 'awk 禁止脚本内重定向/管道写';
  }
  return null;
}

/** find: 拒绝 -delete/-exec/-fprint 等副作用动作 */
function checkFindReadonly(toks, ci) {
  if (toks.slice(ci + 1).some(t => /^-(delete|exec|execdir|ok|okdir|fprint|fprintf|fls)$/.test(t))) {
    return 'find 禁止 -exec/-delete/-fprint 等副作用动作';
  }
  return null;
}

/** sort: -o/--output 写文件, --compress-program 可执行任意程序 */
function checkSortReadonly(toks, ci) {
  const args = toks.slice(ci + 1);
  if (args.some(t => /^--compress-program/.test(t))) return 'sort 禁止 --compress-program (可执行任意程序)';
  if (args.some(t => /^-o/.test(t) || /^--output/.test(t))) return 'sort 禁止 -o 写文件';
  return null;
}

/** tree: -o 输出文件视同写 */
function checkTreeReadonly(toks, ci) {
  if (toks.slice(ci + 1).some(t => t === '-o' || /^-o./.test(t) || /^--output/.test(t))) return 'tree 禁止 -o/--output 写文件';
  return null;
}

/** uniq: 第 2 个位置参数即输出文件 */
function checkUniqReadonly(toks, ci) {
  if (toks.slice(ci + 1).filter(t => !/^-/.test(t)).length > 1) return 'uniq 位置参数最多 1 个 (第 2 个为输出文件)';
  return null;
}

/** xxd: -r 回写与第 2 个位置输出文件都禁 */
function checkXxdReadonly(toks, ci) {
  const args = toks.slice(ci + 1);
  if (args.some(t => /^-[^-]/.test(t) && t.slice(1).includes('r'))) return 'xxd 禁止 -r 写文件';
  if (args.filter(t => !/^-/.test(t)).length > 1) return 'xxd 位置参数最多 1 个 (第 2 个为输出文件)';
  return null;
}

/** date: -s/--set 设置系统时间 */
function checkDateReadonly(toks, ci) {
  if (toks.slice(ci + 1).some(t => (/^-[^-]/.test(t) && t.slice(1).includes('s')) || /^--set/.test(t))) return 'date 禁止 -s/--set 设置时间';
  return null;
}

/** file: -C/--compile 编译魔数输出文件 */
function checkFileReadonly(toks, ci) {
  if (toks.slice(ci + 1).some(t => (/^-[^-]/.test(t) && t.slice(1).includes('C')) || /^--compile/.test(t))) return 'file 禁止 -C/--compile 写魔数文件';
  return null;
}

/** 只读白名单命令的逐项参数检查 (readonly/readwrite 共用) */
function checkReadonlyCmdArgs(name, toks, ci) {
  if (name === 'sed') return checkSedReadonly(toks, ci);
  if (name === 'awk') return checkAwkReadonly(toks, ci);
  if (name === 'find') return checkFindReadonly(toks, ci);
  if (name === 'sort') return checkSortReadonly(toks, ci);
  if (name === 'tree') return checkTreeReadonly(toks, ci);
  if (name === 'uniq') return checkUniqReadonly(toks, ci);
  if (name === 'xxd') return checkXxdReadonly(toks, ci);
  if (name === 'date') return checkDateReadonly(toks, ci);
  if (name === 'file') return checkFileReadonly(toks, ci);
  return null;
}

/** 段级只读检查 */
function checkReadonlySegment(seg, stripped, ctx) {
  const sq = stripSingleQuoted(seg); // 双引号内 $(...)/`...` 仍会执行, 须按单引号剥离检测
  if (/`/.test(sq)) return '只读模式禁止反引号命令替换';
  if (/\$\(/.test(sq)) return '只读模式禁止 $() 命令替换';
  if (/[<>]\(/.test(stripped)) return '只读模式禁止进程替换';
  if (/<<-?/.test(stripped)) return '只读模式禁止 here-doc';
  if (extractRedirectTargets(seg).length > 0) return '只读模式禁止输出重定向';
  if (hasBackgroundAmp(stripped)) return '只读模式禁止后台执行 &';
  const toks = tokenize(seg);
  const ci = firstCmdIndex(toks);
  if (ci >= toks.length) return '空命令段';
  const name = basename(toks[ci]);
  if (name === 'git') return checkGit(toks, ci, ctx);
  if (name === 'repo') return checkRepo(toks, ci, ctx);
  if (!RO_CMDS.has(name)) return `只读模式不允许命令 '${name}'`;
  return checkReadonlyCmdArgs(name, toks, ci);
}

/* ---------- readwrite 白名单 (只读检查 + 受限写动词; 仍非沙箱) ---------- */

/** cp/mv 的目标 = -t 值 或 最后一个位置参数; mv 的源也是写动作一并校验 */
function mvCpTargets(toks, ci, isMv) {
  const args = toks.slice(ci + 1);
  const pos = [];
  let tDir = null;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-t' || a === '--target-directory') { tDir = args[++k] || null; continue; }
    if (/^-/.test(a)) continue;
    pos.push(a);
  }
  if (tDir !== null) return isMv ? pos.concat([tDir]) : [tDir];
  if (pos.length === 0) return null;
  return isMv ? pos : [pos[pos.length - 1]];
}

/** sed -i 的位置参数 (剔除 -e/-f 脚本值与首个位置脚本) */
function sedInPlaceTargets(toks, ci) {
  const args = toks.slice(ci + 1);
  const pos = [];
  let sawScript = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-e' || a === '-f' || a === '--expression' || a === '--file') { sawScript = true; k++; continue; }
    if (/^-[ef]./.test(a) || /^--(expression|file)=/.test(a)) { sawScript = true; continue; }
    if (/^-/.test(a)) continue;
    if (!sawScript) { sawScript = true; continue; } // 首个位置参数是无 -e 时的脚本
    pos.push(a);
  }
  return pos;
}

/** 段级读写档检查: 只读白名单 + 受限写动词 (cp/mv/mkdir/touch/tee/rm/sed -i/边界内重定向), 仍非沙箱 */
function checkReadwriteSegment(seg, stripped, ctx) {
  const sq = stripSingleQuoted(seg);
  if (/`/.test(sq)) return '读写模式禁止反引号命令替换';
  if (/\$\(/.test(sq)) return '读写模式禁止 $() 命令替换';
  if (/[<>]\(/.test(stripped)) return '读写模式禁止进程替换';
  if (/<<-?/.test(stripped)) return '读写模式禁止 here-doc';
  if (hasBackgroundAmp(stripped)) return '读写模式禁止后台执行 &';
  const toks = tokenize(seg);
  const ci = firstCmdIndex(toks);
  if (ci >= toks.length) return '空命令段';
  const name = basename(toks[ci]);
  const roots = ctx && ctx.writeRoots;

  // 输出重定向目标强制落入 writeRoots//tmp (任何命令形态统一约束)
  for (const t of extractRedirectTargets(seg)) {
    if (!t) return '重定向缺少目标';
    if (/^\/dev\/(null|stdout|stderr|tty)$/.test(t)) continue;
    if (!writeTargetOk(t, roots)) return `重定向目标 '${t}' 不在允许写入范围 (writeRoots//tmp)`;
  }

  if (name === 'git' || name === 'repo') {
    return (name === 'git' ? checkGit(toks, ci, ctx) : checkRepo(toks, ci, ctx));
  }

  // sed: -i 为写动词 (脚本安全扫描 + 目标边界); 非 -i 走只读严格检查
  if (name === 'sed') {
    const flags = toks.slice(ci + 1).filter(t => /^-/.test(t));
    const hasI = flags.some(f => (/^-[^-]/.test(f) && f.includes('i')) || /^--in-place/.test(f));
    if (!hasI) return checkSedReadonly(toks, ci);
    const { scripts, error } = sedCollectScripts(toks, ci);
    if (error) return '读写模式禁止 sed -f (脚本文件不可审查)';
    if (!scripts.length) return 'sed 缺少脚本';
    for (const s of scripts) { const sr = checkSedScriptSafe(s); if (sr) return sr; }
    const targets = sedInPlaceTargets(toks, ci);
    if (!targets.length) return 'sed -i 缺少目标文件';
    for (const t of targets) {
      if (!writeTargetOk(t, roots)) return `sed 写目标 '${t}' 不在允许写入范围 (writeRoots//tmp)`;
    }
    return null;
  }

  if (name === 'cp' || name === 'mv') {
    const targets = mvCpTargets(toks, ci, name === 'mv');
    if (!targets || !targets.length) return `${name} 缺少写目标`;
    for (const t of targets) {
      if (!writeTargetOk(t, roots)) return `${name} 写目标 '${t}' 不在允许写入范围 (writeRoots//tmp)`;
    }
    return null;
  }

  if (name === 'mkdir' || name === 'touch' || name === 'tee') {
    const targets = toks.slice(ci + 1).filter(t => !/^-/.test(t));
    if (!targets.length) return `${name} 缺少写目标`;
    for (const t of targets) {
      if (!writeTargetOk(t, roots)) return `${name} 写目标 '${t}' 不在允许写入范围 (writeRoots//tmp)`;
    }
    return null;
  }

  if (name === 'rm') {
    const targets = toks.slice(ci + 1).filter(t => !/^-/.test(t));
    if (!targets.length) return 'rm 缺少目标';
    for (const t of targets) {
      if (!/\.(bak|tmp)$/.test(basename(t))) return `rm 仅限删除 writeRoots//tmp 内 *.bak/*.tmp 文件: '${t}'`;
      if (!writeTargetOk(t, roots)) return `rm 目标 '${t}' 不在允许写入范围`;
    }
    return null;
  }

  // 只读白名单命令沿用只读档逐项严格检查
  if (RO_CMDS.has(name)) return checkReadonlyCmdArgs(name, toks, ci);

  return `该命令需完全权限模式（读写模式仅放行检索类与受限写操作）: '${name}'`;
}

/* ---------- 凭据/密钥文件保护 (所有模式含 full, 防密钥进入 LLM 上下文) ---------- */

const SENSITIVE_PATH_RE = /(^|\/)\.ssh(\/|$)|(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|(^|\/)\.gnupg(\/|$)|(^|\/)\.netrc$|(^|\/)\.git-credentials$|^\/etc\/(shadow|gshadow|sudoers)$|(^|\/)\.aws\/credentials$|(^|\/)\.kube\/config$|(^|\/)\.docker\/config\.json$/;
const NO_SENSITIVE_SCAN = new Set(['echo', 'printf', 'true', 'false', 'test', '[', 'pwd', 'basename', 'dirname']);

/** 需做敏感路径判定的 token (跳过命令名/旗标/赋值; grep/find/sed/awk 的表达式参数除外) */
function sensitiveTokensToScan(toks, ci, name) {
  if (NO_SENSITIVE_SCAN.has(name)) return [];
  const args = toks.slice(ci + 1);
  const skip = new Set();
  if (name === 'grep' || name === 'rg' || name === 'egrep' || name === 'fgrep') {
    let hasPatFlag = false;
    args.forEach((a, i) => {
      if (a === '-e' || a === '--regexp') { skip.add(i + 1); hasPatFlag = true; }
      else if (/^-[^-]*e./.test(a) || /^--regexp=/.test(a)) hasPatFlag = true;
      else if (a === '-f' || a === '--file' || /^-[^-]*f./.test(a) || /^--file=/.test(a)) hasPatFlag = true;
    });
    if (!hasPatFlag) { // 无 -e/-f 时首个位置参数是 pattern
      const pi = args.findIndex(a => !/^-/.test(a));
      if (pi >= 0) skip.add(pi);
    }
  } else if (name === 'find') {
    const pred = new Set(['-name', '-iname', '-path', '-ipath', '-wholename', '-iwholename', '-regex', '-iregex', '-lname', '-ilname']);
    args.forEach((a, i) => { if (pred.has(a)) skip.add(i + 1); });
  } else if (name === 'sed') {
    let usedE = false;
    args.forEach((a, i) => {
      if (a === '-e' || a === '--expression') { skip.add(i + 1); usedE = true; }
      else if (/^--expression=/.test(a)) usedE = true;
      else if (/^-[^-]/.test(a) && a.slice(1).includes('e')) {
        usedE = true;
        if (a.endsWith('e')) skip.add(i + 1); // -ne 形态: 脚本在下一参数
      }
    });
    if (!usedE) {
      const pi = args.findIndex(a => !/^-/.test(a));
      if (pi >= 0) skip.add(pi);
    }
  } else if (name === 'awk' || name === 'gawk') {
    const valFlags = new Set(['-F', '-v', '-W', '-L', '-t', '-e']);
    let hasScriptFlag = false;
    args.forEach((a, i) => {
      if (valFlags.has(a)) { skip.add(i + 1); if (a === '-e') hasScriptFlag = true; }
      else if (/^-[^-]/.test(a) && /[feE]/.test(a.slice(1))) hasScriptFlag = true;
    });
    if (!hasScriptFlag) {
      const pi = args.findIndex(a => !/^-/.test(a));
      if (pi >= 0) skip.add(pi);
    }
  }
  const out = [];
  args.forEach((a, i) => {
    if (skip.has(i)) return;
    if (/^-/.test(a)) return;
    if (VAR_PREFIX.test(a)) return;
    out.push(a);
  });
  return out;
}

/** 段级敏感路径扫描: 文件参数与重定向目标命中凭据模式即拒 (所有模式) */
function sensitiveScanSegment(toks, ci, seg) {
  const name = basename(toks[ci] || '');
  for (const t of sensitiveTokensToScan(toks, ci, name)) {
    if (SENSITIVE_PATH_RE.test(t)) return `禁止访问凭据/密钥类文件: '${String(t).slice(0, 60)}'`;
  }
  for (const t of extractRedirectTargets(seg)) {
    if (SENSITIVE_PATH_RE.test(t)) return `禁止访问凭据/密钥类文件: '${String(t).slice(0, 60)}'`;
  }
  return null;
}

/**
 * 三档命令审查: readonly 白名单 / readwrite = readonly白名单+受限写动词(仍非沙箱) / full 仅硬拦截
 * ctx: { writeRoots: string[], cwd?: string } —— cwd 为远端 linux 工作目录, 用于 git/repo /tmp 防护
 * @returns {{ok: boolean, reason?: string}}
 */
function checkCommand(cmd, mode, ctx = {}) {
  const raw = String(cmd || '');
  if (!raw.trim()) return { ok: false, reason: '空命令' };
  const m = (mode === 'readonly' || mode === 'readwrite' || mode === 'full') ? mode : 'readwrite';
  if (/:\s*\(\s*\)\s*\{/.test(raw)) return { ok: false, reason: '疑似 fork 炸弹' };

  for (const seg of splitTopLevel(raw)) {
    const stripped = stripQuoted(seg);
    if (!stripped.trim()) continue;
    const toks = tokenize(seg);
    const firstIdx = firstCmdIndex(toks);
    const hb = hardBlockSegment(toks, stripped, firstIdx, seg);
    if (hb) return { ok: false, reason: hb };
    const sp = sensitiveScanSegment(toks, firstIdx, seg);
    if (sp) return { ok: false, reason: sp };
    if (m === 'readonly') {
      const r = checkReadonlySegment(seg, stripped, ctx);
      if (r) return { ok: false, reason: r };
    } else if (m === 'readwrite') {
      const r = checkReadwriteSegment(seg, stripped, ctx);
      if (r) return { ok: false, reason: r };
    }
  }
  return { ok: true };
}

module.exports = {
  calcTimeoutSec,
  clampTimeoutSec,
  buildRemoteCommand,
  buildSshArgs,
  resolveServer,
  shellQuote,
  checkCommand,
  // 复用 local-project-service 的路径映射, 便于扩展与测试一处引用
  windowsPathToLinux,
  linuxPathToWindows,
  getWinSshBin,
  LOCAL_SERVERS,
  MODE_NAMES: { readonly: '只读', readwrite: '读写', full: '完全权限' },
  _internals: { splitTopLevel, stripQuoted, tokenize, extractRedirectTargets, writeTargetOk, isProtectedTarget }
};
