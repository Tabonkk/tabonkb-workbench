// services/jira-sandbox-service.js
// 问题单排查沙盒 (P1c): 一单一目录 00-Inbox/03-Quick-Note/{KEY}/,
// 首次「开始排查建档」生成 _DBG.md 草稿 (命名遵循 99-Meta/02-Naming-Spec v1.2 NAM-03)

const DBG_SANDBOX_ROOT = '00-Inbox/03-Quick-Note';

// 平台关键词 (不区分大小写, 取首个命中)
const DBG_PLATFORM_RULES = [
  ['MTK', /mtk|联发科|mt\d{4}/i],
  ['QCOM', /qcom|qualcomm|高通|sm\d{4}/i],
  ['UNISOC', /unisoc|展锐|ums\d+|sc\d{4}|紫光/i],
  ['EXYNOS', /exynos|三星/i],
  ['HISI', /hisi|海思|hi\d{4}/i],
  ['RK', /rockchip|瑞芯微|rk\d{4}/i],
  ['AW', /allwinner|全志/i]
];

// 模块关键词 (同一层文本命中多个时按书写顺序取第一个)
const DBG_MODULE_RULES = [
  ['CHG', /充电|charger|charging|battery|电池|电量计|gauge/i],
  ['USB', /usb|typec|type-c|\bpd\b/i],
  ['DISP', /显示|屏|lcd|oled|mipi|display/i],
  ['CAM', /相机|摄像|camera|isp/i],
  ['AUD', /音频|声音|喇叭|audio|speaker|codec/i],
  ['TP', /触摸|tp\b|touch/i],
  ['SNS', /传感|sensor|gyro|加速度/i],
  ['PWR', /功耗|休眠|唤醒|suspend|power|待机/i],
  ['STOR', /存储|emmc|ufs|storage/i],
  ['CONN', /蓝牙|wifi|wi-fi|bluetooth|nfc|gps|connectivity/i],
  ['MODEM', /modem|ril|基带|通话/i],
  ['INPUT', /按键|input|振动|马达/i],
  ['SEC', /安全|tee|security/i],
  ['KERN', /内核|kernel|panic|死机|重启|watchdog/i],
  ['BUILD', /编译|build|toolchain/i],
  ['HW', /硬件|电路|原理图/i]
];

// v1.2 标签映射
const DBG_PLATFORM_TAG = {
  QCOM: 'qcom', MTK: 'mtk', UNISOC: 'unisoc', EXYNOS: 'exynos',
  HISI: 'hisi', RK: 'rockchip', AW: 'allwinner', COMMON: 'common'
};
const DBG_MODULE_TAG = {
  DISP: 'display', CAM: 'camera', AUD: 'audio', USB: 'usb', CHG: 'charger',
  SNS: 'sensor', TP: 'touch', PWR: 'power', STOR: 'storage', CONN: 'connectivity',
  MODEM: 'modem', INPUT: 'input', SEC: 'security', KERN: 'kernel',
  BUILD: 'build', HW: 'hardware', GEN: 'general'
};

// P2a: 模块 -> 03-Driver 目录映射 (GEN/KERN/BUILD/HW 无直接对应, 按 01-Directory-Spec 裁决)
const DBG_MODULE_DIR = {
  DISP: '01-Display', CAM: '02-Camera', AUD: '03-Audio', USB: '04-USB',
  CHG: '05-Charger', SNS: '06-Sensor', TP: '07-Touch', PWR: '08-Power',
  STOR: '09-Storage', CONN: '10-Connectivity', MODEM: '11-Modem-RIL',
  INPUT: '12-Input-Misc', SEC: '13-Security-TEE'
};

// NAM-03 非法字符: ASCII \ / : * ? " < > | # % & ^ [ ] ! + 全角标点
const _RE_DBG_ILLEGAL = /[\\/:*?"<>|#%&^[\]!，。；：！？（）【】「」、“”‘’《》]/g;

function _dbgClean(s) {
  return String(s || '')
    .replace(_RE_DBG_ILLEGAL, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function _inferFromText(text, rules) {
  const s = String(text || '');
  if (!s) return '';
  for (const [code, re] of rules) {
    if (re.test(s)) return code;
  }
  return '';
}

/**
 * 平台/模块推断: 只在 components + summary + description 内按关键词推断;
 * components 优先于 summary, summary 优先于 description; 推不出 → COMMON/GEN
 */
function _compNames(components) {
  if (!Array.isArray(components)) return String(components || '');
  return components
    .map(c => (c && typeof c === 'object') ? String(c.name || c.value || '') : String(c || ''))
    .filter(Boolean)
    .join(' ');
}

function inferDbgNaming(issue) {
  const iss = issue || {};
  const comps = _compNames(iss.components);
  const layers = [comps, iss.summary, iss.description].map(x => String(x || ''));
  let platform = 'COMMON';
  let module = 'GEN';
  for (const txt of layers) {
    const p = _inferFromText(txt, DBG_PLATFORM_RULES);
    if (p) { platform = p; break; }
  }
  for (const txt of layers) {
    const m = _inferFromText(txt, DBG_MODULE_RULES);
    if (m) { module = m; break; }
  }
  return { platform, module };
}

/** 标题 = {KEY}-{简称}; 简称 ≤24 字符; 摘要为空只剩 KEY */
function sanitizeDbgTitle(key, summary) {
  const k = String(key || '').trim();
  const short = _dbgClean(summary).slice(0, 24).replace(/-+$/g, '');
  return short ? `${k}-${short}` : k;
}

function _dbgYmd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function _dbgDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** {标题}_v0.1_{YYYYMMDD}_{platform}_{module}_DBG.md, 总长 ≤80, 超长只截标题且保留 KEY */
function buildDbgFileName(issue, now, naming) {
  const iss = issue || {};
  const nm = naming || inferDbgNaming(iss);
  const d = (now instanceof Date) ? now : (now ? new Date(now) : new Date());
  const key = String(iss.key || 'UNKNOWN').trim() || 'UNKNOWN';
  const suffix = `_v0.1_${_dbgYmd(d)}_${nm.platform}_${nm.module}_DBG.md`;
  let title = sanitizeDbgTitle(key, iss.summary);
  const maxTitle = 80 - suffix.length;
  if (title.length > maxTitle) {
    title = title.slice(0, Math.max(maxTitle, key.length)).replace(/-+$/g, '');
    if (title.length < key.length) title = key;
  }
  return `${title}${suffix}`;
}

/** 沙盒目录 00-Inbox/03-Quick-Note/{KEY} (KEY 按同规则清理) */
function sandboxDirPath(key) {
  return `${DBG_SANDBOX_ROOT}/${_dbgClean(key)}`;
}

function _dbgYamlStr(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * DBG 草稿正文: v1.2 frontmatter + 工单元数据卡片 + 详细描述 + 活动日志
 * + 四个固定排查章节 (复现现象 / 源码调用链 / 验证结论 / Patch)
 */
function buildDbgNoteContent(issue, comments, now, naming) {
  const iss = issue || {};
  const nm = naming || inferDbgNaming(iss);
  const d = (now instanceof Date) ? now : (now ? new Date(now) : new Date());
  const dateStr = _dbgDate(d);
  const summary = String(iss.summary || '').trim();

  const lines = [];
  lines.push('---');
  lines.push(`title: "[${iss.key || ''}] ${_dbgYamlStr(summary)}"`);
  lines.push(`date: ${dateStr}`);
  lines.push(`updated: ${dateStr}`);
  lines.push(`platform: [${nm.platform}]`);
  lines.push(`module: [${nm.module}]`);
  lines.push('doctype: DBG');
  lines.push('version: v0.1');
  lines.push('status: draft');
  lines.push('tags:');
  lines.push(`  - "#platform/${DBG_PLATFORM_TAG[nm.platform] || 'common'}"`);
  lines.push(`  - "#module/${DBG_MODULE_TAG[nm.module] || 'general'}"`);
  lines.push('  - "#doctype/dbg"');
  lines.push('  - "#status/draft"');
  lines.push('source: internal');
  lines.push('owner: human');
  lines.push(`jira_key: "${iss.key || ''}"`);
  lines.push(`jira_url: "${_dbgYamlStr(iss.url || '')}"`);
  lines.push('related: []');
  lines.push('---');
  lines.push('');
  lines.push(`# 🎯 [${iss.key}] ${summary}`);
  lines.push('');
  lines.push('> [!INFO] 工单元数据卡片');
  lines.push(`> - **工单编号**: \`${iss.key}\``);
  lines.push(`> - **当前状态**: \`${iss.status || '未知'}\``);
  lines.push(`> - **优先级**: \`${iss.priority || 'Medium'}\``);
  lines.push(`> - **经办人**: ${iss.assignee || '未指派'}`);
  lines.push(`> - **报告人**: ${iss.reporter || '系统'}`);
  const compStr = _compNames(iss.components);
  if (compStr) {
    lines.push(`> - **模块组件**: ${compStr}`);
  }
  if (iss.created) lines.push(`> - **创建时间**: ${iss.created}`);
  if (iss.updated) lines.push(`> - **更新时间**: ${iss.updated}`);
  if (iss.url) lines.push(`> - **Jira 链接**: [在浏览器中直达工单](${iss.url})`);
  lines.push('');
  lines.push('## 📋 工单详细描述 (Description)');
  lines.push('');
  lines.push(iss.description && String(iss.description).trim() ? String(iss.description).trim() : '*(暂无详细描述)*');
  lines.push('');
  lines.push('## 💬 活动日志与注释历史 (Comments)');
  lines.push('');
  if (comments && comments.length > 0) {
    for (const c of comments) {
      lines.push(`> [!NOTE] 👤 ${c.author} · ${c.createdFormatted || c.created}${c.isEdited ? ' *(已编辑)*' : ''}`);
      const bodyLines = String(c.body || '').split('\n');
      for (const bl of bodyLines) {
        lines.push(`> ${bl}`);
      }
      lines.push('');
    }
  } else {
    lines.push('*(暂无历史注释记录)*');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## 复现现象');
  lines.push('- 测试条件/版本: ');
  lines.push('- 复现概率: ');
  lines.push('- 核心日志/抓包片段: ');
  lines.push('```text');
  lines.push('```');
  lines.push('');
  lines.push('## 源码调用链');
  lines.push('- ');
  lines.push('');
  lines.push('## 验证结论');
  lines.push('- ');
  lines.push('');
  lines.push('## Patch');
  lines.push('- ');
  lines.push('');
  return lines.join('\n');
}

/* ============================ P2a: 联调提示词与工具路由 ============================ */

function _promptCtx(issue, ctx) {
  const iss = issue || {};
  const c = ctx || {};
  const naming = inferDbgNaming(iss);
  const key = String(iss.key || '').trim();
  return {
    iss,
    key,
    summary: String(iss.summary || '').trim(),
    module: c.module || naming.module,
    platform: c.platform || naming.platform,
    sandboxDir: c.sandboxDir || sandboxDirPath(key || 'UNKNOWN'),
    draftPath: c.draftPath || ''
  };
}

function _dbgRef(ctx) {
  return ctx.draftPath ? `（草稿 ${ctx.draftPath}）` : `（${ctx.sandboxDir}/ 下 *_DBG.md 草稿）`;
}

/** 📎 附件: 列出并下载附件到 {KEY}/attachments/, 清单追加到「复现现象」 */
function buildAttachmentPrompt(issue, ctx) {
  const p = _promptCtx(issue, ctx);
  return [
    `请协助整理 Jira 工单 ${p.key} 的排查附件：`,
    `1. 调用 jira_list_attachments 列出工单 ${p.key} 的全部附件；`,
    `2. 对其中的日志、抓包、截图等排查相关附件，用 jira_download_attachment 下载到 ${p.sandboxDir}/attachments/（attachments 目录不存在请先创建；若沙盒目录不存在请先创建）；`,
    `3. 将附件清单（文件名 / 大小 / 类型）追加记录到沙盒排查草稿的「## 复现现象」章节${_dbgRef(p)}；`,
    `只在 ${p.sandboxDir}/ 沙盒目录内写入，不要修改其它位置的文件。`
  ].join('\n');
}

/** 🔍 源码: opengrok 检索调用链, 整理到「源码调用链」 */
function buildSourcePrompt(issue, ctx) {
  const p = _promptCtx(issue, ctx);
  return [
    `请协助梳理 Jira 工单 ${p.key} 的源码调用链：`,
    `1. 围绕工单摘要「${p.summary}」与模块 ${p.module}，先调用 opengrok_list_projects 确认相关工程；`,
    `2. 用 opengrok_search_code 检索关键函数与符号，用 opengrok_read_file 阅读关键函数实现；`,
    `3. 将调用链（函数名、文件:行号）整理后追加到沙盒排查草稿的「## 源码调用链」章节${_dbgRef(p)}；`,
    `4. 给出结论前必须引用真实文件与行号，禁止臆造。`,
    `若沙盒目录 ${p.sandboxDir}/ 不存在请先创建，只在沙盒目录内写入。`
  ].join('\n');
}

/** 🌿 提交: gerrit 检索同类补丁, 结论到「Patch」 */
function buildGerritPrompt(issue, ctx) {
  const p = _promptCtx(issue, ctx);
  return [
    `请协助排查 Jira 工单 ${p.key} 相关的 Gerrit 变更：`,
    `1. 用 gerrit_search_changes 以工单号 ${p.key} 与关键字「${p.summary}」检索相关变更；`,
    `2. 必要时用 gerrit_get_diff / gerrit_get_comments 查看补丁内容与评审意见；`,
    `3. 判断上游是否已有同类补丁，将结论追加到沙盒排查草稿的「## Patch」章节${_dbgRef(p)}；`,
    `若沙盒目录 ${p.sandboxDir}/ 不存在请先创建，只在沙盒目录内写入。`
  ].join('\n');
}

/** 提炼CASE: 走 tabonkb-inbox-ingest 技能, L2 先呈裁决再执行 */
function buildCasePrompt(issue, ctx) {
  const p = _promptCtx(issue, ctx);
  const modDir = DBG_MODULE_DIR[p.module];
  const landing = modDir
    ? `03-Driver/${modDir}/04-Debug-Case/`
    : '03-Driver/<模块目录>/04-Debug-Case/（该模块无直接对应目录，请按 01-Directory-Spec 裁决模块目录）';
  const input = p.draftPath
    ? `${p.sandboxDir}/（排查草稿 ${p.draftPath}，含 attachments/ 附件）`
    : `${p.sandboxDir}/（含 attachments/ 附件）`;
  return [
    `请使用 tabonkb-inbox-ingest 技能，将 Jira 工单 ${p.key} 的排查沙盒提炼为 CASE 文档并入库。`,
    `输入：${input}；`,
    `产出：CASE 文档，命名严格按 99-Meta/02-Naming-Spec.md v1.2——{标题}_v1.0_{YYYYMMDD}_{平台}_{模块}_CASE.md；平台/模块优先取排查草稿 frontmatter 的 platform/module，取不到再按 ${p.platform}/${p.module} 推断；`,
    `落位：${landing}；`,
    `请补齐 #issue/ 标签及其它必填元数据；`,
    `L2 流程：先向我呈现归类裁决、目标路径、文件名与标签清单，待我确认后再执行；执行后按规范写 Oplog 与索引。`
  ].join('\n');
}

/** ⚡ 波形路由: CHG/PWR → 充电分析, 其余 → 逻辑分析 */
function toolIdForModule(module) {
  const m = String(module || '').toUpperCase();
  return (m === 'CHG' || m === 'PWR') ? 'battery-charger' : 'logic';
}

function _sbxIsFolder(n) {
  return !!(n && Array.isArray(n.children));
}
function _sbxIsFile(n) {
  return !!(n && !Array.isArray(n.children) && typeof n.path === 'string');
}

class JiraSandboxService {
  constructor(opts = {}) {
    this.app = opts.app;
  }

  _vault() {
    return this.app && this.app.vault;
  }

  dirPath(key) {
    return sandboxDirPath(key);
  }

  async exists(key) {
    const vault = this._vault();
    if (!vault) return false;
    try {
      return _sbxIsFolder(vault.getAbstractFileByPath(this.dirPath(key)));
    } catch (_) {
      return false;
    }
  }

  /** 递归列出沙盒目录下全部文件: md 排前, 其余按 mtime 降序, 上限 50 */
  async list(key) {
    const vault = this._vault();
    const dir = vault && vault.getAbstractFileByPath(this.dirPath(key));
    if (!_sbxIsFolder(dir)) return [];
    const out = [];
    const walk = (f) => {
      for (const c of (f.children || [])) {
        if (_sbxIsFile(c)) out.push(c);
        else if (_sbxIsFolder(c)) walk(c);
      }
    };
    walk(dir);
    out.sort((a, b) => {
      const am = String(a.extension || '').toLowerCase() === 'md' ? 0 : 1;
      const bm = String(b.extension || '').toLowerCase() === 'md' ? 0 : 1;
      if (am !== bm) return am - bm;
      return ((b.stat && b.stat.mtime) || 0) - ((a.stat && a.stat.mtime) || 0);
    });
    return out.slice(0, 50);
  }

  async _pathExists(p) {
    const vault = this._vault();
    if (!vault) return false;
    try { if (vault.getAbstractFileByPath(p)) return true; } catch (_) {}
    try { if (vault.adapter && vault.adapter.exists) return await vault.adapter.exists(p); } catch (_) {}
    return false;
  }

  async _ensureFolder(p) {
    const vault = this._vault();
    const parts = String(p).split('/');
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!(await this._pathExists(cur))) {
        try { await vault.createFolder(cur); } catch (_) {}
      }
    }
  }

  /** 目录顶层第一个含 _DBG 的 md 草稿 */
  _findDbgFile(dir) {
    for (const c of (dir.children || [])) {
      if (_sbxIsFile(c) && /_DBG.*\.md$/i.test(c.name)) return c;
    }
    return null;
  }

  /** P2a: 沙盒目录内首个含 _DBG 的 md 草稿, 无则 null */
  async findDraft(key) {
    const vault = this._vault();
    const dir = vault && vault.getAbstractFileByPath(this.dirPath(key));
    if (!_sbxIsFolder(dir)) return null;
    return this._findDbgFile(dir);
  }

  /** P2a: 读草稿 frontmatter 的分流状态 */
  async readDisposition(key) {
    const draft = await this.findDraft(key);
    let fm = {};
    if (draft) {
      try { fm = this.app?.metadataCache?.getFileCache?.(draft)?.frontmatter || {}; } catch (_) { fm = {}; }
    }
    return { disposition: String(fm.disposition || ''), closed_at: String(fm.closed_at || '') };
  }

  /** P2a: 写分流状态; closed 时写 closed_at=今日; 无草稿抛 NO_DRAFT */
  async setDisposition(key, value, now) {
    const draft = await this.findDraft(key);
    if (!draft) throw new Error('NO_DRAFT');
    const d = (now instanceof Date) ? now : (now ? new Date(now) : new Date());
    const fmApi = this.app && this.app.fileManager;
    if (!(fmApi && typeof fmApi.processFrontMatter === 'function')) throw new Error('NO_FM_API');
    await fmApi.processFrontMatter(draft, (fm) => {
      fm.disposition = value;
      if (value === 'closed') fm.closed_at = _dbgDate(d);
      if (fm.updated !== undefined) fm.updated = _dbgDate(d);
    });
  }

  async _writeDbg(issue, comments, now, dirPath) {
    const vault = this._vault();
    const naming = inferDbgNaming(issue);
    const base = buildDbgFileName(issue, now, naming);
    let name = base;
    let n = 1;
    while (await this._pathExists(`${dirPath}/${name}`)) {
      n += 1;
      name = base.replace(/_DBG\.md$/i, `_DBG-${n}.md`);
    }
    const content = buildDbgNoteContent(issue, comments, now, naming);
    return vault.create(`${dirPath}/${name}`, content);
  }

  /**
   * 开始排查建档: 目录不存在 → 建目录 + DBG 草稿;
   * 目录已存在且有 DBG 草稿 → 返回已有草稿 (created:false);
   * 目录存在但无草稿 → 补建一份
   */
  async create(issue, comments, now) {
    const vault = this._vault();
    const dirPath = this.dirPath(issue.key);
    const existing = vault.getAbstractFileByPath(dirPath);
    if (!_sbxIsFolder(existing)) {
      await this._ensureFolder(dirPath);
      const file = await this._writeDbg(issue, comments, now, dirPath);
      return { created: true, folder: dirPath, file };
    }
    const dbg = this._findDbgFile(existing);
    if (dbg) return { created: false, folder: dirPath, file: dbg };
    const file = await this._writeDbg(issue, comments, now, dirPath);
    return { created: true, folder: dirPath, file };
  }

  /** 强制新建一份 DBG 草稿 (重名 …_DBG-2.md) */
  async createDraft(issue, comments, now) {
    const dirPath = this.dirPath(issue.key);
    await this._ensureFolder(dirPath);
    return this._writeDbg(issue, comments, now, dirPath);
  }
}

module.exports = {
  DBG_SANDBOX_ROOT,
  DBG_PLATFORM_TAG,
  DBG_MODULE_TAG,
  DBG_MODULE_DIR,
  inferDbgNaming,
  sanitizeDbgTitle,
  buildDbgFileName,
  sandboxDirPath,
  buildDbgNoteContent,
  buildAttachmentPrompt,
  buildSourcePrompt,
  buildGerritPrompt,
  buildCasePrompt,
  toolIdForModule,
  JiraSandboxService
};
