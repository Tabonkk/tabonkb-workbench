/* ==========================================================================
   File Locator Core — AI 文件引用定位纯逻辑内核 (无副作用, 可直接 node 测试)
   - 百分号编码解码 / 行号拆分 / 目标分类 / 链接文本缩短 / 远程命中排序
   - 远端分层定位 bash 脚本生成 (交给 remote-exec-core 的 buildRemoteCommand 传输)
   ========================================================================== */

const OBSIDIAN_NATIVE_EXTS = new Set([
  'md', 'canvas', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'pdf'
]);

// 远端脚本安全转义 (与 remote-exec-core.shellQuote 同语义, 本模块保持零依赖)
function _sq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}
function _dq(s) {
  return '"' + String(s).replace(/([\\"$`])/g, '\\$1') + '"';
}

/**
 * 解码 AI 输出的文件链接目标:
 * - 剥离两端反引号/引号/[[wikilink]] 包裹与 file:/// 前缀
 * - 仅当存在合法 %[0-9A-Fa-f]{2} 序列才 decodeURIComponent;
 *   非法序列 (%ZZ / 孤立 %) 或整体非法时保持原样, 永不抛错
 */
function decodeTarget(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  const wiki = s.match(/^\[\[(.+)\]\]$/);
  if (wiki) s = String(wiki[1]).trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/^[`'"「『]+/, '').replace(/[`'"」』]+$/, '');
  } while (s !== prev);
  s = s.replace(/^file:\/\/\/?/i, '');
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch (_) { /* 混合合法/非法序列: 保守保持原样 */ }
  }
  return s;
}

/**
 * 拆分路径与行号: 识别 '#L85' / '#L85-L90' / ':85' / ':85:12'
 * Windows 盘符冒号 (如 'D:\x' / 'D:85') 不算行号后缀
 */
function splitLine(p) {
  const res = { path: String(p == null ? '' : p), line: null };
  const hash = res.path.match(/#L(\d+)(?:-L?(\d+))?$/i);
  if (hash) {
    res.line = parseInt(hash[1], 10);
    res.path = res.path.slice(0, hash.index);
    return res;
  }
  const colon = res.path.match(/:(\d+)(?::\d+)?$/);
  if (colon && colon.index > 1) {
    res.line = parseInt(colon[1], 10);
    res.path = res.path.slice(0, colon.index);
  }
  return res;
}

const WORKSPACE_TOP_DIRS = new Set([
  'pri_project', 'vendor_w', 'vendor_u', 'vendor_t', 'kernel', 'device',
  'vendor', 'frameworks', 'bsp', 'idh'
]);

/**
 * 目标分类:
 *  server_abs     Y:/Z:/UNC/Linux 远端绝对路径 (/dfb/, /home/tankaikun)
 *  vault_abs      落在 vaultBase 之下的绝对路径
 *  local_abs      其它本地绝对路径 (如 C:\x\a.c)
 *  rel_workspace  以工作区顶层目录开头的相对路径 (pri_project/ vendor_w/ ...)
 *  rel_partial    含目录但不属于工作区顶层的相对路径
 *  bare           纯文件名
 */
function classifyTarget(p, opts) {
  const vaultBase = String((opts && opts.vaultBase) || '')
    .trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const raw = String(p || '').trim();
  if (!raw) return 'bare';
  let norm = raw.replace(/\\/g, '/');

  if (/^\/\//.test(norm)) return 'server_abs'; // UNC
  if (/^\/dfb\//.test(norm) || /^\/home\/tankaikun(\/|$)/.test(norm)) return 'server_abs';

  const drive = norm.match(/^([A-Za-z]):(\/|$)/);
  if (drive) {
    const letter = drive[1].toUpperCase();
    if (letter === 'Y' || letter === 'Z') return 'server_abs';
    if (vaultBase) {
      const vb = vaultBase.toLowerCase();
      const n = norm.toLowerCase();
      if (n === vb || n.startsWith(vb + '/')) return 'vault_abs';
    }
    return 'local_abs';
  }
  if (norm.startsWith('/')) {
    if (vaultBase && norm.toLowerCase().startsWith(vaultBase.toLowerCase() + '/')) return 'vault_abs';
    return 'local_abs';
  }

  const rel = norm.replace(/^\.\//, '');
  const top = rel.split('/')[0].toLowerCase();
  if (WORKSPACE_TOP_DIRS.has(top)) return 'rel_workspace';
  if (rel.includes('/')) return 'rel_partial';
  return 'bare';
}

/**
 * 链接/行内代码显示文本缩短:
 * - 像路径 (含 / 或 \\ 且 >=2 段) → label = basename(:line)
 * - 不像路径 → label = 原文
 * - 省略号 ('...'/'…') 段跳过, 取最后一个有意义段
 */
function shortenPathLabel(text) {
  const raw = String(text == null ? '' : text).trim();
  const full = decodeTarget(raw);
  const sl = splitLine(full);
  const p = sl.path;
  const norm = p.replace(/\\/g, '/');
  const segs = norm.split('/').filter(s => s && s !== '.');
  const isPath = (norm.includes('/') || p.includes('\\')) && segs.length >= 2;
  if (!isPath) return { label: raw, full, line: sl.line };
  let base = '';
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (s === '..' || s === '...' || s === '…') continue;
    base = s;
    break;
  }
  if (!base) base = segs.length ? segs[segs.length - 1] : p;
  return { label: sl.line ? `${base}:${sl.line}` : base, full, line: sl.line };
}

/**
 * 远程命中排序:
 *  ① <linuxRoot>/<priDriverRel>/ 下 (项目私有定制)
 *  ② <linuxRoot>/<publicDriverRel>/ 下 (公共差分)
 *  ③ 含 kernel_device_modules-<kernelVer>/ (kernelVer 缺省时尝试从 priDriverRel 推断, 推断不到不加该级)
 *  ④ <linuxRoot>/ 下
 *  ⑤ 其它
 *  同级: 路径短者优先, 再按字典序稳定输出
 */
function rankHits(hits, ctx) {
  ctx = ctx || {};
  const root = String(ctx.projectLinuxRoot || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const pri = (root && ctx.priDriverRel) ? `${root}/${String(ctx.priDriverRel).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}` : '';
  const pub = (root && ctx.publicDriverRel) ? `${root}/${String(ctx.publicDriverRel).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}` : '';
  let kv = ctx.kernelVer ? String(ctx.kernelVer) : '';
  if (!kv && ctx.priDriverRel) {
    const m = String(ctx.priDriverRel).match(/kernel_device_modules-([\d.]+)/);
    if (m) kv = m[1];
  }
  const score = (p) => {
    const s = String(p || '').replace(/\\/g, '/');
    if (pri && s.startsWith(pri + '/')) return 0;
    if (pub && s.startsWith(pub + '/')) return 1;
    if (kv && s.includes(`/kernel_device_modules-${kv}/`)) return 2;
    if (root && s.startsWith(root + '/')) return 3;
    return 4;
  };
  return (Array.isArray(hits) ? hits : []).slice().sort((a, b) => {
    const d = score(a) - score(b);
    if (d) return d;
    const la = String(a).length - String(b).length;
    if (la) return la;
    return String(a).localeCompare(String(b));
  });
}

/**
 * 远端分层定位 bash 脚本文本:
 * (a) anchors: 逐个 [ -f "$root/<rel>" ] 精确探测, 命中输出 'HIT\t<path>'
 * (b) 若 (a) 无命中且给了 tiers: 按层顺序 find -maxdepth 14 (剪枝 .git/.repo/out),
 *     rel 含目录用 -path 通配尾缀匹配、仅文件名用 -name, 某层命中即停, 每层最多 30 条
 * 层命中输出前打 'SEC\ttier' 分段标记供调用方区分 anchor/tier 命中阶段
 * 所有插值均经引号转义; 含 * 的 tier 视为 glob (限定安全字符集, 不转义以保留展开)
 */
function buildLocateScript(opts) {
  opts = opts || {};
  const anchors = (Array.isArray(opts.anchors) ? opts.anchors : []).filter(Boolean);
  const tiers = (Array.isArray(opts.tiers) ? opts.tiers : []).filter(Boolean);
  const rel = String(opts.rel || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^(\.\.\/)+/, '');
  const fileName = String(opts.fileName || (rel ? rel.split('/').pop() : ''));

  const lines = ['hits=0'];

  if (anchors.length && rel) {
    lines.push(`for __r in ${anchors.map(_sq).join(' ')}; do`);
    lines.push(`  if [ -f "$__r"/${_sq(rel)} ]; then printf 'HIT\\t%s\\n' "$__r"/${_sq(rel)}; hits=1; fi`);
    lines.push('done');
  }

  if (tiers.length && (rel || fileName)) {
    const hasDir = rel.includes('/');
    const matcher = hasDir ? `-path ${_dq('*/' + rel)}` : `-name ${_dq(fileName)}`;
    const nameMatcher = `-name ${_dq(fileName)}`;
    const tierList = tiers.map(t => {
      const s = String(t);
      if (/[*?]/.test(s)) {
        return /^[A-Za-z0-9_.\-\/\*\?]+$/.test(s) ? s : null; // glob 层: 仅安全字符, 不转义以保留展开
      }
      return _sq(s);
    }).filter(Boolean).join(' ');
    if (tierList) {
      lines.push('if [ "$hits" -eq 0 ]; then');
      lines.push("  printf 'SEC\\ttier\\n'");
      lines.push(`  for __t in ${tierList}; do`);
      lines.push('    [ -d "$__t" ] || continue');
      lines.push(`    __o=$(find "$__t" -maxdepth 14 \\( -name .git -o -name .repo -o -name out \\) -prune -o -type f ${matcher} -print 2>/dev/null | head -n 30)`);
      if (hasDir) {
        // 中间目录写错时按裸文件名在同层兜底 (重名由调用方排序/展示, 不静默丢弃)
        lines.push(`    if [ -z "$__o" ]; then __o=$(find "$__t" -maxdepth 14 \\( -name .git -o -name .repo -o -name out \\) -prune -o -type f ${nameMatcher} -print 2>/dev/null | head -n 30); fi`);
      }
      lines.push("    if [ -n \"$__o\" ]; then printf '%s\\n' \"$__o\" | sed 's/^/HIT\\t/'; hits=1; fi");
      lines.push('    [ "$hits" -gt 0 ] && break');
      lines.push('  done');
      lines.push('fi');
    }
  }
  return lines.join('\n');
}

module.exports = {
  OBSIDIAN_NATIVE_EXTS,
  decodeTarget,
  splitLine,
  classifyTarget,
  shortenPathLabel,
  rankHits,
  buildLocateScript
};
