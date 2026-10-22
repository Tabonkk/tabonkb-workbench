/* ==========================================================================
   TopicService — 个人专题 (Personal Topics) 数据层
   数据全部落在 vault: 07-Project/00-Personal-Topics/<YYYYMMDD-短标题>/00-TASK.md
   - 纯函数区 (parseTaskBody/toggleStep/addStep/addProgress/…) 零依赖, 可直接 node 测试
   - 正文写入走 app.vault.process 原子读改写, frontmatter 走 processFrontMatter,
     只动目标行/目标章节, 未知章节与用户手写内容逐字节保留 (含 CRLF/LF 风格)
   ========================================================================== */

const TOPIC_ROOT_DEFAULT = '07-Project/00-Personal-Topics';
const TOPIC_TASK_FILE = '00-TASK.md';
const TOPIC_MODULE_CODES = ['DISP', 'CAM', 'AUD', 'USB', 'CHG', 'SNS', 'TP', 'PWR', 'STOR', 'CONN', 'MODEM', 'INPUT', 'SEC', 'KERN', 'BUILD', 'HW', 'GEN', 'AI', 'WB'];
const TOPIC_TRACKS = [
  { id: 'work', label: '工作' },
  { id: 'deep', label: '深耕' },
  { id: 'broad', label: '拓展' }
];
const TOPIC_STAR_LIMIT = 3;

/* ------------------------------ 时间格式化 ------------------------------ */

function _pad2(n) { return String(n).padStart(2, '0'); }

function fmtTopicDate(d) {
  d = (d instanceof Date) ? d : new Date(d);
  return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
}

function fmtTopicYmd(d) {
  d = (d instanceof Date) ? d : new Date(d);
  return `${d.getFullYear()}${_pad2(d.getMonth() + 1)}${_pad2(d.getDate())}`;
}

function fmtTopicTime(d) {
  d = (d instanceof Date) ? d : new Date(d);
  return `${fmtTopicDate(d)} ${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
}

function fmtTopicHm(d) {
  d = (d instanceof Date) ? d : new Date(d);
  return `${_pad2(d.getHours())}${_pad2(d.getMinutes())}`;
}

function _topicNow(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && input.trim()) {
    const d = new Date(input.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/* ------------------------------ 行级解析 ------------------------------ */

// 将文本拆为行记录 [{start, contentEnd, end}], contentEnd 不含行尾, end 含行尾;
// 保留原始字节坐标, 供定点替换/插入而不惊动其余字节 (CRLF/LF 混合也安全)
function _splitLinesKeepEnds(text) {
  const lines = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const start = i;
    let j = i;
    while (j < n && text[j] !== '\n' && text[j] !== '\r') j++;
    const contentEnd = j;
    if (j < n && text[j] === '\r' && text[j + 1] === '\n') j += 2;
    else if (j < n) j += 1;
    lines.push({ start, contentEnd, end: j });
    i = j;
  }
  return lines;
}

function _detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function _lineContent(text, ln) {
  return text.slice(ln.start, ln.contentEnd);
}

// '## 执行步骤 (Checklist)' → { level:2, name:'执行步骤 (Checklist)' }
function _parseHeading(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line.trim());
  if (!m) return null;
  return { level: m[1].length, name: m[2].trim() };
}

const _SECTION_KEYS = [
  { key: 'steps', prefixes: ['执行步骤'] },
  { key: 'ideas', prefixes: ['想法'] },
  { key: 'timeline', prefixes: ['进展日志'] },
  { key: 'waters', prefixes: ['浇水'] }
];

function _sectionKeyOfHeading(name) {
  for (const s of _SECTION_KEYS) {
    for (const p of s.prefixes) {
      if (name.startsWith(p)) return s.key;
    }
  }
  return null;
}

// 返回 [{key, headLine, headEnd(offset, 含行尾), endLine(下一个 ## 的行号或 lines.length)}]
function _scanSections(text, lines) {
  const sections = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const h = _parseHeading(_lineContent(text, lines[i]));
    if (h && h.level <= 2) {
      if (cur) cur.endLine = i;
      const key = (h.level === 2) ? _sectionKeyOfHeading(h.name) : null;
      cur = { key, headLine: i, headEnd: lines[i].end, endLine: lines.length };
      sections.push(cur);
    }
  }
  return sections;
}

const _RE_CHECKBOX = /^(\s*[-*+]\s*)\[( |x|X)\]\s*(.*)$/;
const _RE_LIST_ITEM = /^\s*[-*+]\s/;
const _RE_TIMELINE_ITEM = /^\s*[-*+]\s*\*\*\[([^\]]*)\]\*\*\s*(.*)$/;
const _RE_IDEA_PREFIX = /^(?:💡\s*)?(?:\*\*\[([^\]]*)\]\*\*\s*)?/;

// 解析想法条目内容 (去掉列表符后的文本):
// '💡 **[2026-10-21]** 内容 · 来源' / '~~💡 **[…]** 内容 · 来源~~' / 任意文本
// → { struck, date, label, source }
function _parseIdeaContent(content) {
  let s = String(content || '').trim();
  let struck = false;
  if (s.length >= 4 && s.startsWith('~~') && s.endsWith('~~')) {
    struck = true;
    s = s.slice(2, -2).trim();
  }
  const m = _RE_IDEA_PREFIX.exec(s);
  const date = (m && m[1]) ? m[1].trim() : '';
  const rest = s.slice(m[0].length).trim();
  let label = rest, source = '';
  const dot = rest.lastIndexOf(' · ');
  if (dot >= 0) {
    label = rest.slice(0, dot).trim();
    source = rest.slice(dot + 3).trim();
  }
  return { struck, date, label, source };
}

/**
 * 解析 00-TASK.md 正文 (frontmatter 不在此处理)
 * → { steps:[{line,done,label}], ideas:[{line,text}], timeline:[{time,text}] }
 * 仅识别以「执行步骤」「想法」「进展日志」开头的 ## 章节; 章节外复选框不计入 steps
 */
function parseTaskBody(text) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const out = { steps: [], ideas: [], timeline: [] };

  for (const sec of sections) {
    if (!sec.key) continue;
    for (let i = sec.headLine + 1; i < sec.endLine; i++) {
      const raw = _lineContent(text, lines[i]);
      if (sec.key === 'steps') {
        const m = _RE_CHECKBOX.exec(raw);
        if (m) {
          out.steps.push({ line: i, done: m[2] !== ' ', label: m[3] });
        }
      } else if (sec.key === 'ideas') {
        if (_RE_LIST_ITEM.test(raw)) {
          const content = raw.replace(_RE_LIST_ITEM, '').trim();
          const meta = _parseIdeaContent(content);
          out.ideas.push({ line: i, text: content, label: meta.label, date: meta.date, source: meta.source, struck: meta.struck });
        }
      } else if (sec.key === 'timeline') {
        const m = _RE_TIMELINE_ITEM.exec(raw);
        if (m) {
          out.timeline.push({ time: (m[1] || '').trim(), text: (m[2] || '').trim() });
        } else if (_RE_LIST_ITEM.test(raw)) {
          out.timeline.push({ time: '', text: raw.replace(_RE_LIST_ITEM, '').trim() });
        }
      }
    }
  }
  return out;
}

/**
 * 切换指定行(0 基)复选框状态; 该行无复选框时原样返回
 * 只改写目标行字节, 其余内容与行尾风格完全保留
 */
function toggleStep(text, lineIndex, done) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const ln = lines[lineIndex];
  if (!ln) return text;
  const content = _lineContent(text, ln);
  const m = /^(\s*[-*+]\s*\[)( |x|X)(\].*)$/.exec(content);
  if (!m) return text;
  const replaced = m[1] + (done ? 'x' : ' ') + m[3];
  return text.slice(0, ln.start) + replaced + text.slice(ln.contentEnd);
}

function _findSection(sections, key) {
  return sections.find(s => s.key === key) || null;
}

function _appendSection(text, eol, title, firstLine) {
  let out = text;
  if (out.length && !out.endsWith('\n')) out += eol;
  if (out.trim().length) out += eol; // 与上文隔一空行
  out += `## ${title}` + eol + firstLine + eol;
  return out;
}

/**
 * 在 Checklist 章节最后一个条目之后追加 `- [ ] label`;
 * 不越过下一个 ## 标题; 章节缺失时文末补建
 */
function addStep(text, label) {
  text = String(text == null ? '' : text);
  const eol = _detectEol(text);
  const itemLine = `- [ ] ${label}`;
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const sec = _findSection(sections, 'steps');

  if (!sec) {
    return _appendSection(text, eol, '执行步骤 (Checklist)', itemLine);
  }

  // 找章节内最后一个列表条目
  let lastItemLine = -1;
  for (let i = sec.headLine + 1; i < sec.endLine; i++) {
    if (_RE_LIST_ITEM.test(_lineContent(text, lines[i]))) lastItemLine = i;
  }

  if (lastItemLine >= 0) {
    const ln = lines[lastItemLine];
    const pos = ln.end;
    const sep = (ln.end === ln.contentEnd) ? eol : ''; // 末行无行尾时先补行尾
    return text.slice(0, pos) + sep + itemLine + eol + text.slice(pos);
  }
  // 空章节: 插到标题行之后
  const headLn = lines[sec.headLine];
  const pos = headLn.end;
  const sep = (headLn.end === headLn.contentEnd) ? eol : '';
  return text.slice(0, pos) + sep + itemLine + eol + text.slice(pos);
}

/**
 * 在 Timeline 章节顶部插入 `- **[YYYY-MM-DD HH:mm]** label` (最新在上);
 * 章节缺失时文末补建
 */
function addProgress(text, label, now) {
  text = String(text == null ? '' : text);
  const eol = _detectEol(text);
  const ts = fmtTopicTime(_topicNow(now));
  const itemLine = `- **[${ts}]** ${label}`;
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const sec = _findSection(sections, 'timeline');

  if (!sec) {
    return _appendSection(text, eol, '进展日志 (Timeline)', itemLine);
  }
  const headLn = lines[sec.headLine];
  const pos = headLn.end;
  const sep = (headLn.end === headLn.contentEnd) ? eol : '';
  return text.slice(0, pos) + sep + itemLine + eol + text.slice(pos);
}

/* ------------------------------ 想法 (Ideas) ------------------------------ */

// 判断 lineIndex 是否落在指定章节内的列表条目行
function _sectionItemAt(text, lines, sections, key, lineIndex) {
  const sec = _findSection(sections, key);
  if (!sec || lineIndex <= sec.headLine || lineIndex >= sec.endLine) return null;
  const ln = lines[lineIndex];
  if (!ln) return null;
  const raw = _lineContent(text, ln);
  if (!_RE_LIST_ITEM.test(raw)) return null;
  return { sec, ln, raw, content: raw.replace(_RE_LIST_ITEM, '').trim() };
}

/**
 * 在 Ideas 章节顶部插入 `- 💡 **[YYYY-MM-DD]** label · source` (最新在上);
 * 章节缺失时文末补建
 */
function addIdea(text, label, now, source) {
  text = String(text == null ? '' : text);
  const eol = _detectEol(text);
  const d = fmtTopicDate(_topicNow(now));
  const itemLine = `- 💡 **[${d}]** ${String(label)}${source ? ` · ${source}` : ''}`;
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const sec = _findSection(sections, 'ideas');
  if (!sec) {
    return _appendSection(text, eol, '想法 (Ideas)', itemLine);
  }
  const headLn = lines[sec.headLine];
  const pos = headLn.end;
  const sep = (headLn.end === headLn.contentEnd) ? eol : '';
  return text.slice(0, pos) + sep + itemLine + eol + text.slice(pos);
}

/**
 * 想法转步骤: 删除 Ideas 章节内未划掉的目标行 (含行尾),
 * 并将其 label 追加为 Checklist 的 `- [ ] label`; 非法目标行原样返回
 */
function ideaToStep(text, lineIndex) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const hit = _sectionItemAt(text, lines, sections, 'ideas', lineIndex);
  if (!hit) return text;
  const meta = _parseIdeaContent(hit.content);
  if (meta.struck || !meta.label) return text;
  const without = text.slice(0, hit.ln.start) + text.slice(hit.ln.end);
  return addStep(without, meta.label);
}

/**
 * 划掉想法: 行内容包成 `~~…~~`; 已划掉/非法行幂等原样返回
 */
function strikeIdea(text, lineIndex) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const hit = _sectionItemAt(text, lines, sections, 'ideas', lineIndex);
  if (!hit) return text;
  const meta = _parseIdeaContent(hit.content);
  if (meta.struck) return text;
  const marker = /^(\s*[-*+]\s*)/.exec(hit.raw)[1];
  const replaced = `${marker}~~${hit.content}~~`;
  return text.slice(0, hit.ln.start) + replaced + text.slice(hit.ln.contentEnd);
}

/**
 * 删除 Ideas 章节内目标列表行 (含行尾); 非法行原样返回
 */
function removeIdeaLine(text, lineIndex) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const hit = _sectionItemAt(text, lines, sections, 'ideas', lineIndex);
  if (!hit) return text;
  return text.slice(0, hit.ln.start) + text.slice(hit.ln.end);
}

/* ------------------------------ 种子 (Seeds) ------------------------------ */

/**
 * 解析种子文件正文 → { idea, waters:[{time,text}] }
 */
function parseSeedBody(text) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const out = { idea: '', waters: [] };
  const ideaSec = _findSection(sections, 'ideas');
  if (ideaSec) {
    const parts = [];
    for (let i = ideaSec.headLine + 1; i < ideaSec.endLine; i++) {
      parts.push(_lineContent(text, lines[i]));
    }
    out.idea = parts.join('\n').trim();
  }
  const waterSec = _findSection(sections, 'waters');
  if (waterSec) {
    for (let i = waterSec.headLine + 1; i < waterSec.endLine; i++) {
      const raw = _lineContent(text, lines[i]);
      const m = _RE_TIMELINE_ITEM.exec(raw);
      let w = null;
      if (m) w = { time: (m[1] || '').trim(), text: (m[2] || '').trim() };
      else if (_RE_LIST_ITEM.test(raw)) w = { time: '', text: raw.replace(_RE_LIST_ITEM, '').trim() };
      if (w) {
        w.auto = / ·auto\s*$/.test(w.text);
        w.line = i;
        out.waters.push(w);
      }
    }
  }
  return out;
}

/**
 * 在「浇水」章节顶部插入 `- **[YYYY-MM-DD HH:mm]** label` (最新在上); 缺失补建
 */
function addWater(text, label, now) {
  text = String(text == null ? '' : text);
  const eol = _detectEol(text);
  const ts = fmtTopicTime(_topicNow(now));
  const itemLine = `- **[${ts}]** ${label}`;
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const sec = _findSection(sections, 'waters');
  if (!sec) {
    return _appendSection(text, eol, '浇水', itemLine);
  }
  const headLn = lines[sec.headLine];
  const pos = headLn.end;
  const sep = (headLn.end === headLn.contentEnd) ? eol : '';
  return text.slice(0, pos) + sep + itemLine + eol + text.slice(pos);
}

/** seed 且浇水 ≥3 → growing, 其余原样 */
function seedEffectiveStatus(status, waterCount) {
  if (status === 'seed' && (waterCount || 0) >= 3) return 'growing';
  return status;
}

function isJiraKey(str) {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(String(str || '').trim());
}

/** P2a: 在专题列表中按 jira 数组命中工单号 (大小写不敏感) */
function findTopicByJira(topics, key) {
  const k = String(key || '').trim().toUpperCase();
  if (!k || !Array.isArray(topics)) return null;
  for (const t of topics) {
    const arr = Array.isArray(t && t.jira) ? t.jira : [];
    if (arr.some(j => String(j || '').trim().toUpperCase() === k)) return t;
  }
  return null;
}

/**
 * 记灵感去向推断: 选中专题(进行中) > jiraKey 命中的进行中专题 > 新种子
 */
function inferCaptureTarget(ctx, topics) {
  const list = Array.isArray(topics) ? topics : [];
  const sel = ctx && ctx.selectedTopicId;
  if (sel) {
    const t = list.find(t => t.id === sel && t.status === 'in_progress');
    if (t) return { type: 'topic', id: t.id };
  }
  const jk = ctx && ctx.jiraKey;
  if (jk) {
    const low = String(jk).toLowerCase();
    const t = list.find(t => t.status === 'in_progress'
      && Array.isArray(t.jira)
      && t.jira.some(j => String(j).toLowerCase() === low));
    if (t) return { type: 'topic', id: t.id };
  }
  return { type: 'seed' };
}

/* ------------------------------ P2b: 提示词 ------------------------------ */

/**
 * 入库向导提示词: 走 tabonkb-inbox-ingest 技能, L2 先呈裁决待确认;
 * 成功后回写专题 published_docs + 进展日志, 不删原草稿
 */
function buildIngestPrompt(topic, file, opts) {
  const o = opts || {};
  const t = topic || {};
  const filePath = (file && file.path) || String(file || '');
  const dirHint = o.targetDir
    ? `目标目录 ${o.targetDir}`
    : `由技能按 01-Directory-Spec 裁决，模块目录建议 ${o.moduleDir ? `03-Driver/${o.moduleDir}/` : '请按 01-Directory-Spec 裁决'}`;
  return [
    `请使用 tabonkb-inbox-ingest 技能，将过程草稿入库：`,
    `待入库文件：${filePath}（所属专题目录 ${t.dir || ''}）；`,
    `元数据：platform=${o.platform || ''}、module=${o.module || ''}、doctype=${o.doctype || 'NOTE'}；`,
    `${dirHint}；`,
    `命名严格按 99-Meta/02-Naming-Spec.md v1.2 规范执行；`,
    `L2 流程：先向我呈现归类裁决、目标路径、文件名与标签清单，待我确认后再执行；`,
    `入库成功后：把正式文档的 wikilink（[[新路径去扩展名]]）追加到 ${t.dir || ''}/00-TASK.md frontmatter 的 published_docs 数组，并向「进展日志」追加一条「📦 入库：[[新路径]]」；`,
    `入库不删除专题内的原草稿，保留过程记录。`
  ].join('\n');
}

/** ✨拆解提示词: 注入专题上下文, 3–7 条子步骤, 确认后才追加 Checklist */
function buildDecomposePrompt(topic) {
  const t = topic || {};
  const todo = (t.steps || []).filter(s => !s.done).map(s => `- [ ] ${s.label || s.text || ''}`).join('\n') || '(无)';
  const done = (t.steps || []).filter(s => s.done).map(s => `- [x] ${s.label || s.text || ''}`).join('\n') || '(无)';
  const recent = (t.timeline || []).slice(0, 3).map(x => `- ${x.time || ''} ${x.text || x.label || ''}`.trimEnd()).join('\n') || '(无)';
  const refs = (t.linked_refs || []).join('、') || '(无)';
  const pubs = (t.published_docs || []).join('、') || '(无)';
  return [
    `请为专题「${t.title || t.id}」拆解下一步行动：`,
    `目标：${t.goal || '未填写'}；方向 ${t.track || 'work'}、模块 ${t.module || 'GEN'}；主文件 ${t.dir}/${TOPIC_TASK_FILE}。`,
    `未完成步骤：\n${todo}\n已完成步骤：\n${done}`,
    `最近进展：\n${recent}`,
    `关联参考：${refs}；已入库成果：${pubs}。`,
    `请给出 3–7 条下一步可执行的子步骤（每条动词开头、可验证），以清单形式回复并等我确认；确认后才可追加到 ${t.dir}/${TOPIC_TASK_FILE} 的「## 执行步骤 (Checklist)」。`,
    `如有补充思路，可自行追加到「## 想法 (Ideas)」章节；其它修改请先提案。`
  ].join('\n');
}

/** ✨评估提示词: 查重(WeKnora) / 定位(空字段才写 fm) / 拆解 / 结论记浇水 */
function buildEvaluatePrompt(seed, opts) {
  const s = seed || {};
  const o = opts || {};
  const tools = Array.isArray(o.weknoraTools) && o.weknoraTools.length ? o.weknoraTools.join(' / ') : '';
  const searchLine = tools
    ? `用 ${tools} 检索「知识库里已有什么」并列出命中文档`
    : '请使用可用的 WeKnora 检索工具检索「知识库里已有什么」并列出命中文档';
  const waters = (s.waters || []).map(w => `- ${w.time || ''} ${w.text || ''}`).join('\n') || '(无)';
  return [
    `请评估这颗灵感种子：${s.path || ''}`,
    `标题：${s.title || ''}；来源 ${s.source || 'manual'}${s.source_ref ? `（${s.source_ref}）` : ''}。`,
    `想法全文：\n${s.idea || '(空)'}`,
    `已有浇水：\n${waters}`,
    `请按以下步骤评估：`,
    `1. 查重：${searchLine}；`,
    `2. 定位：判断更像 深耕/拓展 及对应模块，只写入种子 frontmatter 中为空的 track/module 字段；`,
    `3. 拆解：若值得做，给出前 3 个步骤；`,
    `4. 将评估结论作为一条浇水记录追加到「## 浇水」章节顶部，格式 "- **[YYYY-MM-DD HH:mm]** ✨评估：…"（计入浇水次数）；`,
    `不得改动「想法」原文，除上述两处外不要修改其它内容。`
  ].join('\n');
}

/* ------------------------------ P2b: 自动浇水 / 枯萎 ------------------------------ */

const AUTO_WATER_ROOTS = [
  '01-Platform/', '02-OS-Kernel/', '03-Driver/', '04-Debug/', '05-Toolchain/',
  '06-Spec/', '08-Learning/01-Materials/', '09-Hardware/', '10-Test-Cert/'
];

/** 文档路径是否落在自动浇水监视范围 (md + 范围内 + 不在专题区) */
function isAutoWaterDocPath(path, rootPath) {
  const p = String(path || '');
  if (!/\.md$/i.test(p)) return false;
  const rp = String(rootPath || '').replace(/\/+$/, '');
  if (rp && (p === rp || p.startsWith(rp + '/'))) return false;
  return AUTO_WATER_ROOTS.some(r => p.startsWith(r));
}

const _KW_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that']);

/** 种子关键词: ASCII/数字词 (≥3, 去停用词) + CJK bigram, 小写去重 */
function seedKeywords(text) {
  const s = String(text || '').toLowerCase();
  const out = new Set();
  for (const m of s.matchAll(/[a-z0-9_]+/g)) {
    const w = m[0];
    if (w.length >= 3 && !_KW_STOP.has(w)) out.add(w);
  }
  for (const m of s.matchAll(/[一-鿿]+/g)) {
    const run = m[0];
    if (run.length === 1) { out.add(run); continue; }
    for (let i = 0; i + 2 <= run.length; i++) out.add(run.slice(i, i + 2));
  }
  return [...out];
}

/** 命中 = 模块相同(大小写不敏感) 且关键词得分 ≥3 (ASCII 2分 / CJK bigram 1分) */
function seedMatchesDoc(seed, doc) {
  const sm = String((seed && seed.module) || '').trim().toLowerCase();
  if (!sm) return false;
  const dm = (doc && doc.module) || [];
  const arr = Array.isArray(dm) ? dm : [dm];
  if (!arr.some(m => String(m || '').trim().toLowerCase() === sm)) return false;
  const kws = seedKeywords(`${(seed && seed.title) || ''}\n${(seed && seed.idea) || ''}`);
  const dt = String((doc && doc.text) || '').toLowerCase();
  let score = 0;
  for (const k of kws) {
    if (!dt.includes(k)) continue;
    score += /^[a-z0-9_]+$/.test(k) ? 2 : 1;
  }
  return score >= 3;
}

/** 浇水条目文本以 ` ·auto` 结尾 = 自动浇水 */
function isAutoWater(water) {
  return / ·auto\s*$/.test(String((water && water.text) || ''));
}

/** 删除「浇水」章节内指定行号的列表行; 非法行原样返回 */
function removeWaterLine(text, lineIndex) {
  text = String(text == null ? '' : text);
  const lines = _splitLinesKeepEnds(text);
  const sections = _scanSections(text, lines);
  const sec = _findSection(sections, 'waters');
  if (!sec) return text;
  const i = Number(lineIndex);
  if (!Number.isInteger(i) || i <= sec.headLine || i >= sec.endLine) return text;
  const raw = _lineContent(text, lines[i]);
  if (!_RE_LIST_ITEM.test(raw)) return text;
  return text.slice(0, lines[i].start) + text.slice(lines[i].end);
}

/** 种子 90 天未触碰 → 枯萎 (touched 缺失用 created, 都缺 false) */
function shouldWitherSeed(seed, nowMs) {
  const st = String((seed && seed.status) || 'seed');
  if (st !== 'seed' && st !== 'growing') return false;
  const ref = String((seed && (seed.touched || seed.created)) || '');
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(ref);
  if (!m) return false;
  const ms = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  return (now - ms) >= 90 * 86400000;
}

/* ------------------------------ P3: 周回顾 ------------------------------ */

/** ISO 8601 周键 'YYYY-Www' (周一为起点, 本周四决定 ISO 年, 正确处理跨年) */
function isoWeekKey(date) {
  const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date || Date.now());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // 对齐到本周四
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function shouldShowWeeklyReview(lastKey, now, hasContent) {
  if (!hasContent) return false;
  return String(lastKey || '') !== isoWeekKey(now);
}

/** 周回顾数据计划: topics=全部进行中专题(含 starred) / seeds=growing 按浇水降序取 3 / ideas=未划掉且 ≥14 天最旧在前取 5 */
function buildWeeklyReviewPlan(topics, seeds, now) {
  const nowMs = _topicNow(now).getTime();
  const inProg = (topics || []).filter(t => t.status === 'in_progress');
  const topicRows = inProg.map(t => ({ id: t.id, title: t.title, starred: !!t.starred }));
  const seedRows = (seeds || []).filter(s => s.status === 'growing')
    .sort((a, b) => ((b.waters || []).length) - ((a.waters || []).length))
    .slice(0, 3)
    .map(s => ({ id: s.id, title: s.title, waterCount: (s.waters || []).length }));
  const stale = [];
  for (const t of inProg) {
    for (const i of (t.ideas || [])) {
      if (i.struck) continue;
      const ms = Date.parse(String(i.date || '').replace(' ', 'T'));
      if (isNaN(ms)) continue;
      if (nowMs - ms >= 14 * 86400000) {
        stale.push({ topicId: t.id, topicTitle: t.title, line: i.line, label: i.label, date: i.date });
      }
    }
  }
  stale.sort((a, b) => Date.parse(String(a.date).replace(' ', 'T')) - Date.parse(String(b.date).replace(' ', 'T')));
  return { topics: topicRows, seeds: seedRows, ideas: stale.slice(0, 5) };
}

/* ------------------------------ 派生字段 ------------------------------ */

function calcProgress(steps) {
  const total = Array.isArray(steps) ? steps.length : 0;
  const done = total ? steps.filter(s => s && s.done).length : 0;
  return { done, total, percent: total ? Math.round((done / total) * 100) : null };
}

function calcIdle(maxMtimeMs, nowMs, status) {
  const now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
  const mt = (typeof maxMtimeMs === 'number' && isFinite(maxMtimeMs)) ? maxMtimeMs : now;
  const days = Math.max(0, Math.floor((now - mt) / 86400000));
  return {
    days,
    label: days === 0 ? '今日推进' : `${days}天前`,
    warn: days >= 7 && status !== 'paused'
  };
}

/* ------------------------------ 命名与链接 ------------------------------ */

const _ILLEGAL_DIR_CHARS = /[\\/:*?"<>|#%&]/g;

/**
 * '2026-10-20' 日期串 + 标题 → 'YYYYMMDD-短标题'
 * 去除 \ / : * ? " < > | # % & 与首尾空白, 空白转 -, 标题部分最多 40 字符
 */
function sanitizeTopicDirName(title, dateStr) {
  const ymd = String(dateStr || '').replace(/-/g, '');
  let safe = String(title == null ? '' : title)
    .replace(_ILLEGAL_DIR_CHARS, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (safe.length > 40) safe = safe.slice(0, 40).replace(/-+$/g, '');
  return safe ? `${ymd}-${safe}` : ymd;
}

/**
 * '[[a/b.md|别名]]' → 'a/b.md'; 去 |别名 与 #锚点; 无括号字符串原样返回
 */
function parseWikiLink(str) {
  let s = String(str == null ? '' : str).trim();
  const m = /^\[\[(.*)\]\]$/.exec(s);
  if (m) s = m[1].trim();
  const pipe = s.indexOf('|');
  if (pipe >= 0) s = s.slice(0, pipe).trim();
  const hash = s.indexOf('#');
  if (hash >= 0) s = s.slice(0, hash).trim();
  return s;
}

/**
 * 聚焦上限守卫: 已有 ≥3 个 starred 且进行中的专题时,
 * 仅允许对当前已聚焦项取消 (返回 true), 新聚焦返回 false
 */
function canStar(topics, topic) {
  if (!topic || topic.starred) return true;
  const id = topic.id;
  const count = (Array.isArray(topics) ? topics : [])
    .filter(t => t && t.starred && t.status === 'in_progress' && t.id !== id)
    .length;
  return count < TOPIC_STAR_LIMIT;
}

/* ------------------------------ TopicService ------------------------------ */

function _isFolder(af) { return !!af && Array.isArray(af.children); }
function _isFile(af) { return !!af && !Array.isArray(af.children) && typeof af.extension === 'string'; }

function _yamlStr(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function _yamlList(arr) {
  if (!Array.isArray(arr) || !arr.length) return '[]';
  return `[${arr.map(s => `"${_yamlStr(s)}"`).join(', ')}]`;
}

class TopicService {
  constructor(opts = {}) {
    this.app = opts.app;
    this.rootPath = opts.rootPath || TOPIC_ROOT_DEFAULT;
    this._cbs = new Set();
    this._eventRefs = [];
    this._debounceTimer = null;
  }

  /* ---------- 基础访问 ---------- */

  _vault() { return this.app && this.app.vault; }

  _fileCache(file) {
    try {
      return this.app?.metadataCache?.getFileCache?.(file) || null;
    } catch (_) { return null; }
  }

  _fm(file) {
    return this._fileCache(file)?.frontmatter || {};
  }

  _taskFileOfDir(dirFile) {
    const kids = dirFile && dirFile.children;
    if (!Array.isArray(kids)) return null;
    return kids.find(c => c.name === TOPIC_TASK_FILE && _isFile(c)) || null;
  }

  _maxMtime(folder) {
    let max = 0;
    const walk = (f) => {
      if (_isFile(f)) {
        const mt = f.stat?.mtime || 0;
        if (mt > max) max = mt;
      } else if (_isFolder(f)) {
        for (const c of f.children) walk(c);
      }
    };
    walk(folder);
    return max;
  }

  async _pathExists(p) {
    try {
      const ad = this._vault()?.adapter;
      if (ad && typeof ad.exists === 'function') return await ad.exists(p);
    } catch (_) {}
    try { return !!this._vault()?.getAbstractFileByPath?.(p); } catch (_) { return false; }
  }

  async _ensureFolder(p) {
    if (await this._pathExists(p)) return;
    try { await this._vault().createFolder(p); } catch (_) {}
  }

  async _uniqueChildName(parentPath, baseName, suffix = '') {
    let stem = baseName;
    let n = 1;
    while (await this._pathExists(`${parentPath}/${stem}${suffix}`)) {
      n += 1;
      stem = `${baseName}-${n}`;
    }
    return `${stem}${suffix}`;
  }

  async _moveFile(file, newPath) {
    const fmApi = this.app?.fileManager;
    if (fmApi && typeof fmApi.renameFile === 'function') {
      await fmApi.renameFile(file, newPath);
    } else {
      await this._vault().rename(file, newPath);
    }
  }

  /* ---------- 扫描 ---------- */

  async scan() {
    const topics = [];
    const vault = this._vault();
    const root = vault?.getAbstractFileByPath?.(this.rootPath);
    if (!_isFolder(root)) return topics;

    for (const dir of root.children) {
      if (!_isFolder(dir)) continue;
      if (!dir.name || dir.name.startsWith('_')) continue; // _Archived / _Seeds 等非专题目录
      const taskFile = this._taskFileOfDir(dir);
      if (!taskFile) continue;

      const fm = this._fm(taskFile);
      let parsed = { steps: [], ideas: [], timeline: [] };
      try {
        const body = await vault.read(taskFile);
        parsed = parseTaskBody(body);
      } catch (_) {}

      topics.push({
        id: dir.name,
        dir: dir.path,
        dirFile: dir,
        taskFile,
        title: fm.title || dir.name,
        track: fm.track || 'work',
        module: fm.module || '',
        status: fm.status || 'in_progress',
        starred: !!fm.starred,
        goal: fm.goal || '',
        jira: Array.isArray(fm.jira) ? fm.jira : [],
        published_docs: Array.isArray(fm.published_docs) ? fm.published_docs : [],
        linked_refs: Array.isArray(fm.linked_refs) ? fm.linked_refs : [],
        steps: parsed.steps,
        ideas: parsed.ideas,
        timeline: parsed.timeline,
        maxMtime: this._maxMtime(dir)
      });
    }
    return topics;
  }

  /* ---------- 创建 ---------- */

  async createTopic(opts = {}) {
    const vault = this._vault();
    const now = new Date();
    const title = String(opts.title || '').trim() || '未命名专题';
    const track = TOPIC_TRACKS.some(t => t.id === opts.track) ? opts.track : 'work';
    const module = String(opts.module || 'GEN');
    const goal = String(opts.goal || '').trim();
    const ts = fmtTopicTime(now);

    await this._ensureFolder(this.rootPath);
    const dirName = await this._uniqueChildName(this.rootPath, sanitizeTopicDirName(title, fmtTopicYmd(now)));
    const dirPath = `${this.rootPath}/${dirName}`;
    await this._ensureFolder(dirPath);

    const content = [
      '---',
      `title: "${_yamlStr(title)}"`,
      `track: ${track}`,
      `module: ${module}`,
      'status: in_progress',
      'starred: false',
      `created: ${fmtTopicDate(now)}`,
      `updated: ${ts}`,
      `goal: "${_yamlStr(goal)}"`,
      `jira: ${_yamlList(opts.jira)}`,
      'published_docs: []',
      `linked_refs: ${_yamlList(opts.linked_refs)}`,
      '---',
      '',
      '## 执行步骤 (Checklist)',
      '',
      '## 想法 (Ideas)',
      '',
      '## 进展日志 (Timeline)',
      `- **[${ts}]** 创建专题`,
      ''
    ].join('\n');

    const file = await vault.create(`${dirPath}/${TOPIC_TASK_FILE}`, content);
    return { id: dirName, dir: dirPath, title, track, module, goal, taskFile: file };
  }

  /* ---------- 正文写回 (原子 process) ---------- */

  async _processBody(file, fn) {
    const vault = this._vault();
    if (typeof vault.process === 'function') {
      await vault.process(file, (text) => fn(String(text)));
    } else {
      const text = await vault.read(file);
      await vault.modify(file, fn(String(text)));
    }
  }

  async _setFm(file, patch) {
    const fmApi = this.app?.fileManager;
    if (fmApi && typeof fmApi.processFrontMatter === 'function') {
      await fmApi.processFrontMatter(file, (fm) => {
        for (const k of Object.keys(patch)) fm[k] = patch[k];
      });
    }
  }

  async _touchUpdated(file) {
    await this._setFm(file, { updated: fmtTopicTime(new Date()) });
  }

  async toggleStep(topic, lineIndex, done) {
    const file = topic && topic.taskFile;
    if (!file) return;
    await this._processBody(file, (text) => toggleStep(text, lineIndex, done));
    await this._touchUpdated(file);
  }

  async addStep(topic, label) {
    const file = topic && topic.taskFile;
    if (!file || !String(label || '').trim()) return;
    await this._processBody(file, (text) => addStep(text, String(label).trim()));
    await this._touchUpdated(file);
  }

  async addProgress(topic, label) {
    const file = topic && topic.taskFile;
    if (!file || !String(label || '').trim()) return;
    await this._processBody(file, (text) => addProgress(text, String(label).trim(), new Date()));
    await this._touchUpdated(file);
  }

  async setField(topic, key, value) {
    const file = topic && topic.taskFile;
    if (!file) return;
    await this._setFm(file, { [key]: value, updated: fmtTopicTime(new Date()) });
  }

  async toggleStar(topic) {
    const topics = await this.scan();
    const cur = topics.find(t => t.id === topic.id) || topic;
    const want = !cur.starred;
    if (want && !canStar(topics, cur)) {
      const err = new Error('聚焦最多 3 个');
      err.code = 'STAR_LIMIT';
      throw err;
    }
    const file = cur.taskFile || topic.taskFile;
    if (file) await this._setFm(file, { starred: want });
    return want;
  }

  /* ---------- 归档 ---------- */

  async archive(topic, opts = {}) {
    const vault = this._vault();
    const dirPath = topic && topic.dir;
    if (!dirPath) return { archivedPath: '', seedsCreated: 0 };
    const archiveRoot = `${this.rootPath}/_Archived`;
    await this._ensureFolder(archiveRoot);
    const file = topic.taskFile;
    if (file) {
      await this._setFm(file, { status: 'done', updated: fmtTopicTime(new Date()) });
    }
    const folder = vault.getAbstractFileByPath(dirPath);
    if (!folder) return { archivedPath: '', seedsCreated: 0 };
    const name = await this._uniqueChildName(archiveRoot, topic.id);
    const archivedPath = `${archiveRoot}/${name}`;
    await vault.rename(folder, archivedPath);
    // P2b 闸门②: 未划掉想法转种子 (source_ref 指向归档后的 00-TASK)
    let seedsCreated = 0;
    if (opts.ideasToSeeds) {
      const pending = (topic.ideas || []).filter(i => !i.struck);
      const ref = `[[${archivedPath}/00-TASK]]`;
      for (const idea of pending) {
        try {
          await this.createSeed({
            text: idea.label || idea.text || '',
            source: 'note',
            source_ref: ref,
            track: topic.track,
            module: topic.module
          });
          seedsCreated++;
        } catch (e) { console.warn('[TopicService] ideasToSeeds failed:', e); }
      }
    }
    return { archivedPath, seedsCreated };
  }

  /** P2b: 手工登记成果 → published_docs (去重, [[去扩展名路径]]) + Timeline 📦 入库 */
  async addPublishedDoc(topic, file) {
    const tfile = topic && topic.taskFile;
    const path = (file && file.path) || String(file || '');
    if (!tfile || !path) return false;
    const linkPath = path.replace(/\.md$/i, '');
    const link = `[[${linkPath}]]`;
    const cur = Array.isArray(topic.published_docs) ? topic.published_docs : [];
    const exists = cur.some(s => parseWikiLink(s).replace(/\.md$/i, '') === linkPath);
    if (exists) return false;
    await this._setFm(tfile, { published_docs: [...cur, link] });
    await this._processBody(tfile, (t) => addProgress(t, `📦 入库：${link}`, new Date()));
    await this._touchUpdated(tfile);
    return true;
  }

  /* ---------- 关联与草稿 ---------- */

  async addLinkedRef(topic, file) {
    const tfile = typeof file === 'string' ? vaultFileOf(this._vault(), file) : file;
    const path = (tfile && tfile.path) || (typeof file === 'string' ? file : '');
    if (!path) return;
    const linkPath = path.replace(/\.md$/i, '');
    const link = `[[${linkPath}]]`;
    const cur = Array.isArray(topic.linked_refs) ? topic.linked_refs : [];
    const exists = cur.some(s => parseWikiLink(s).replace(/\.md$/i, '') === linkPath);
    if (exists) return;
    await this._setFm(topic.taskFile, { linked_refs: [...cur, link], updated: fmtTopicTime(new Date()) });
  }

  async createDraft(topic) {
    const vault = this._vault();
    const now = new Date();
    const name = `草稿-${fmtTopicYmd(now)}-${fmtTopicHm(now)}.md`;
    const path = `${topic.dir}/${name}`;
    const file = await vault.create(path, '# 草稿\n');
    return file;
  }

  /* ---------- 目录内文件清单 (顶层, 不递归) ---------- */

  listTopicDocs(topic) {
    const kids = topic?.dirFile?.children;
    if (!Array.isArray(kids)) return [];
    return kids
      .filter(c => _isFile(c) && c.extension === 'md' && c.name !== TOPIC_TASK_FILE && c.name !== '00-SEED.md')
      .sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0));
  }

  /* ---------- 变更订阅 ---------- */

  onChange(cb) {
    if (typeof cb !== 'function') return () => {};
    this._cbs.add(cb);
    this._ensureListeners();
    return () => {
      this._cbs.delete(cb);
      if (!this._cbs.size) this._teardownListeners();
    };
  }

  _ensureListeners() {
    if (this._eventRefs.length) return;
    const vault = this._vault();
    if (!vault || typeof vault.on !== 'function') return;
    const rel = (file) => this._schedule(file);
    for (const ev of ['create', 'modify', 'delete']) {
      this._eventRefs.push(vault.on(ev, rel));
    }
    this._eventRefs.push(vault.on('rename', (file, oldPath) => {
      this._schedule(file);
      if (typeof oldPath === 'string') this._schedule({ path: oldPath });
    }));
    const mc = this.app?.metadataCache;
    if (mc && typeof mc.on === 'function') {
      this._eventRefs.push(mc.on('changed', (file) => this._schedule(file)));
    }
  }

  _teardownListeners() {
    const vault = this._vault();
    const mc = this.app?.metadataCache;
    for (const ref of this._eventRefs) {
      try { vault && vault.offref && vault.offref(ref); } catch (_) {}
      try { mc && mc.offref && mc.offref(ref); } catch (_) {}
    }
    this._eventRefs = [];
    if (this._debounceTimer) { clearTimeout(this._debounceTimer); this._debounceTimer = null; }
  }

  _schedule(file) {
    const p = (file && file.path) || (typeof file === 'string' ? file : '');
    if (!p) return;
    if (p !== this.rootPath && !p.startsWith(this.rootPath + '/')) return;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      for (const cb of [...this._cbs]) {
        try { cb(); } catch (e) { console.warn('[TopicService] onChange error:', e); }
      }
    }, 300);
  }

  dispose() {
    this._teardownListeners();
    this.stopAutoWater();
    this._cbs.clear();
  }

  /* ---------- 种子 (Seeds) ---------- */

  _seedRoot() {
    return `${this.rootPath}/_Seeds`;
  }

  /** 扫描 _Seeds 顶层 md (忽略 _Withered 等子目录), 跳过终态种子 */
  async scanSeeds() {
    const out = [];
    const vault = this._vault();
    const root = vault?.getAbstractFileByPath?.(this._seedRoot());
    if (!_isFolder(root)) return out;
    for (const f of root.children) {
      if (!_isFile(f) || f.extension !== 'md') continue;
      const fm = this._fm(f);
      let parsed = { idea: '', waters: [] };
      try { parsed = parseSeedBody(await vault.read(f)); } catch (_) {}
      const status = seedEffectiveStatus(fm.status || 'seed', parsed.waters.length);
      if (status === 'sprouted' || status === 'merged' || status === 'withered') continue;
      out.push({
        id: f.name,
        path: f.path,
        file: f,
        title: fm.title || f.name.replace(/\.md$/i, ''),
        track: fm.track || '',
        module: fm.module || '',
        status,
        source: fm.source || 'manual',
        source_ref: fm.source_ref || '',
        created: fm.created || '',
        touched: fm.touched || '',
        idea: parsed.idea,
        waters: parsed.waters
      });
    }
    return out;
  }

  /** 新建种子: _Seeds/YYYYMMDD-短标题.md (短标题 ≤30 字, 重名加 -2) */
  async createSeed(opts = {}) {
    const vault = this._vault();
    const now = new Date();
    const text = String(opts.text || '').trim();
    const firstLine = (text.split('\n')[0] || '未命名灵感').trim() || '未命名灵感';
    const title = firstLine.slice(0, 60);
    await this._ensureFolder(this.rootPath);
    await this._ensureFolder(this._seedRoot());
    const fileName = await this._uniqueChildName(
      this._seedRoot(),
      sanitizeTopicDirName(firstLine.slice(0, 30), fmtTopicYmd(now)),
      '.md'
    );
    const content = [
      '---',
      `title: "${_yamlStr(title)}"`,
      `track: ${opts.track || ''}`,
      `module: ${opts.module || ''}`,
      'status: seed',
      `source: ${opts.source || 'manual'}`,
      `source_ref: "${_yamlStr(opts.source_ref || '')}"`,
      `created: ${fmtTopicDate(now)}`,
      `touched: ${fmtTopicTime(now)}`,
      '---',
      '',
      '## 想法',
      text,
      '',
      '## 浇水',
      ''
    ].join('\n');
    const file = await vault.create(`${this._seedRoot()}/${fileName}`, content);
    return { id: fileName, path: file.path, file, title };
  }

  /** 浇水: 正文追加记录 + 刷新 touched; 第 3 次起升 growing */
  async water(seed, label, now) {
    const file = (seed && seed.file) || vaultFileOf(this._vault(), seed && seed.path);
    const text = String(label || '').trim();
    if (!file || !text) return;
    const at = _topicNow(now);
    let waterCount = Array.isArray(seed.waters) ? seed.waters.length : -1;
    if (waterCount < 0) {
      try { waterCount = parseSeedBody(await this._vault().read(file)).waters.length; } catch (_) { waterCount = 0; }
    }
    await this._processBody(file, (t) => addWater(t, text, at));
    const patch = { touched: fmtTopicTime(at) };
    if (seedEffectiveStatus(seed.status || 'seed', waterCount + 1) === 'growing') {
      patch.status = 'growing';
    }
    await this._setFm(file, patch);
  }

  /** P2b: 撤销一条浇水; 撤销后 <3 且 fm status 为 growing → 回落 seed */
  async unwater(seed, lineIndex) {
    const file = (seed && seed.file) || vaultFileOf(this._vault(), seed && seed.path);
    if (!file) return;
    await this._processBody(file, (t) => removeWaterLine(t, lineIndex));
    let count = 0;
    try { count = parseSeedBody(await this._vault().read(file)).waters.length; } catch (_) {}
    const patch = { touched: fmtTopicTime(new Date()) };
    let fmStatus = '';
    try { fmStatus = String(this._fm(file).status || ''); } catch (_) {}
    if (count < 3 && (fmStatus === 'growing' || (seed && seed.status === 'growing'))) {
      patch.status = 'seed';
    }
    await this._setFm(file, patch);
  }

  /** 发芽: 种子 → 专题 (浇水记录迁入 Timeline, 原种子移入专题目录为 00-SEED.md) */
  async sprout(seed, opts = {}) {
    const vault = this._vault();
    const now = new Date();
    const seedFile = (seed && seed.file) || vaultFileOf(vault, seed && seed.path);
    if (!seedFile) throw new Error('种子文件不存在');
    const goal = String(seed.idea || seed.title || '').split('\n')[0].trim().slice(0, 80);
    const extra = {};
    const ref = String(seed.source_ref || '').trim();
    if (isJiraKey(ref)) extra.jira = [ref];
    else if (/\[\[.*\]\]/.test(ref)) extra.linked_refs = [ref];
    const topic = await this.createTopic({
      title: seed.title || '未命名专题',
      track: opts.track || seed.track || 'deep',
      module: opts.module || seed.module || 'GEN',
      goal,
      ...extra
    });
    const tfile = topic.taskFile;
    const waters = [...(Array.isArray(seed.waters) ? seed.waters : [])].reverse();
    for (const w of waters) {
      await this._processBody(tfile, (t) => addProgress(t, `💧 ${w.text}`, w.time || fmtTopicTime(now)));
    }
    await this._processBody(tfile, (t) => addProgress(t, '发芽自种子', now));
    // 发芽专题以「发芽自种子」为源点, 移除 createTopic 的样板「创建专题」条目
    await this._processBody(tfile, (t) => {
      const ls = _splitLinesKeepEnds(t);
      const sec = _findSection(_scanSections(t, ls), 'timeline');
      if (!sec) return t;
      for (let i = sec.headLine + 1; i < sec.endLine; i++) {
        const m = _RE_TIMELINE_ITEM.exec(_lineContent(t, ls[i]));
        if (m && (m[2] || '').trim() === '创建专题') {
          return t.slice(0, ls[i].start) + t.slice(ls[i].end);
        }
      }
      return t;
    });
    await this._setFm(seedFile, { status: 'sprouted', touched: fmtTopicTime(now) });
    const seedName = await this._uniqueChildName(topic.dir, '00-SEED', '.md');
    await this._moveFile(seedFile, `${topic.dir}/${seedName}`);
    return topic;
  }

  /** 并入专题: 种子置 merged 并移入 <专题目录>/_seeds/, 专题 Ideas 顶部记录并入 */
  async mergeSeed(seed, topic) {
    const seedFile = (seed && seed.file) || vaultFileOf(this._vault(), seed && seed.path);
    const tfile = topic && topic.taskFile;
    if (!seedFile || !tfile) return;
    const now = new Date();
    await this._setFm(seedFile, { status: 'merged', touched: fmtTopicTime(now) });
    const seedsDir = `${topic.dir}/_seeds`;
    await this._ensureFolder(seedsDir);
    const stem = String(seed.id || seedFile.name || 'seed').replace(/\.md$/i, '');
    const name = await this._uniqueChildName(seedsDir, stem, '.md');
    await this._moveFile(seedFile, `${seedsDir}/${name}`);
    const ref = `${seedsDir}/${name}`.replace(/\.md$/i, '');
    await this._processBody(tfile, (t) => addIdea(t, seed.title || stem, now, `并入 [[${ref}]]`));
    await this._touchUpdated(tfile);
  }

  /** 丢弃: 置 withered 并移入 _Seeds/_Withered/ (不物理删除) */
  async discardSeed(seed) {
    const seedFile = (seed && seed.file) || vaultFileOf(this._vault(), seed && seed.path);
    if (!seedFile) return;
    await this._setFm(seedFile, { status: 'withered', touched: fmtTopicTime(new Date()) });
    const wdir = `${this._seedRoot()}/_Withered`;
    await this._ensureFolder(wdir);
    const stem = String(seed.id || seedFile.name || 'seed').replace(/\.md$/i, '');
    const name = await this._uniqueChildName(wdir, stem, '.md');
    await this._moveFile(seedFile, `${wdir}/${name}`);
  }

  /* ---------- P2b: 自动浇水 ---------- */

  _docMeta(file) {
    let fm = {};
    try { fm = this._fm(file) || {}; } catch (_) { fm = {}; }
    const module = Array.isArray(fm.module) ? fm.module : (fm.module ? [fm.module] : []);
    const tags = Array.isArray(fm.tags) ? fm.tags.join(' ') : String(fm.tags || '');
    return { module, text: `${file.name} ${fm.title || ''} ${tags}` };
  }

  /** 监视范围内新文档 → 对匹配种子自动浇水, 返回浇水数 */
  async autoWaterForDoc(path, now) {
    const p = String(path || '');
    if (!isAutoWaterDocPath(p, this.rootPath)) return 0;
    const file = vaultFileOf(this._vault(), p);
    if (!file) return 0;
    const doc = this._docMeta(file);
    const linkPath = p.replace(/\.md$/i, '');
    const label = `关联：[[${linkPath}]] ·auto`;
    const seeds = await this.scanSeeds();
    let n = 0;
    for (const s of seeds) {
      if (s.status !== 'seed' && s.status !== 'growing') continue;
      if (!seedMatchesDoc(s, doc)) continue;
      if ((s.waters || []).some(w => String(w.text || '').includes(`[[${linkPath}]]`))) continue;
      try { await this.water(s, label, now); n++; } catch (e) { console.warn('[TopicService] autoWater failed:', e); }
    }
    return n;
  }

  /** 工单关闭 → source_ref 相等直接浇水 / 同模块 + 关键词 ≥3 浇水, 返回浇水数 */
  async autoWaterForIssue(issue, now) {
    const key = String((issue && issue.key) || '').trim();
    if (!key) return 0;
    let infer = (typeof inferDbgNaming === 'function') ? inferDbgNaming : null;
    if (!infer) {
      try { infer = require('./jira-sandbox-service.js').inferDbgNaming; } catch (_) {}
    }
    const mod = infer ? String(infer(issue).module || '') : '';
    const summary = String((issue && issue.summary) || '');
    const label = `工单 ${key} 已关闭 ·auto`;
    const seeds = await this.scanSeeds();
    let n = 0;
    for (const s of seeds) {
      if (s.status !== 'seed' && s.status !== 'growing') continue;
      const refHit = String(s.source_ref || '').trim().toUpperCase() === key.toUpperCase();
      let kwHit = false;
      if (!refHit && mod && mod !== 'GEN'
          && String(s.module || '').trim().toUpperCase() === mod) {
        const kws = seedKeywords(`${s.title || ''}\n${s.idea || ''}`);
        const dt = summary.toLowerCase();
        let score = 0;
        for (const k of kws) if (dt.includes(k)) score += /^[a-z0-9_]+$/.test(k) ? 2 : 1;
        kwHit = score >= 3;
      }
      if (!refHit && !kwHit) continue;
      // 去重: 已有同工单关闭记录 (key 大小写不敏感) 则跳过
      const keyU = key.toUpperCase();
      if ((s.waters || []).some(w => String(w.text || '').toUpperCase().includes(`工单 ${keyU} 已关闭`))) continue;
      try { await this.water(s, label, now); n++; } catch (e) { console.warn('[TopicService] autoWaterIssue failed:', e); }
    }
    return n;
  }

  /** 挂接 vault create/rename + metadataCache changed; create 先入 _pendingDocs 等 fm 就绪 */
  startAutoWater() {
    if (this._awRefs && this._awRefs.length) return;
    this._awRefs = [];
    this._pendingDocs = new Set();
    const vault = this._vault();
    if (!vault || typeof vault.on !== 'function') return;
    const kick = (p) => {
      Promise.resolve(this.autoWaterForDoc(p)).catch(e => console.warn('[TopicService] autoWaterForDoc:', e));
    };
    this._awRefs.push(vault.on('create', (f) => {
      try {
        const p = f && f.path;
        if (isAutoWaterDocPath(p, this.rootPath)) this._pendingDocs.add(p);
      } catch (_) {}
    }));
    this._awRefs.push(vault.on('rename', (f) => {
      try {
        const p = f && f.path;
        if (!isAutoWaterDocPath(p, this.rootPath)) return;
        this._pendingDocs.delete(p);
        kick(p); // rename: 元数据已缓存, 立即处理
      } catch (_) {}
    }));
    const mc = this.app && this.app.metadataCache;
    if (mc && typeof mc.on === 'function') {
      this._awRefs.push(mc.on('changed', (f) => {
        try {
          const p = f && f.path;
          if (!p || !this._pendingDocs.has(p)) return;
          this._pendingDocs.delete(p);
          kick(p);
        } catch (_) {}
      }));
    }
  }

  stopAutoWater() {
    const vault = this._vault();
    const mc = this.app && this.app.metadataCache;
    for (const ref of (this._awRefs || [])) {
      try { vault && vault.offref && vault.offref(ref); } catch (_) {}
      try { mc && mc.offref && mc.offref(ref); } catch (_) {}
    }
    this._awRefs = [];
    this._pendingDocs = new Set();
  }

  /* ---------- P2b: 枯萎 / 复活 ---------- */

  /** 90 天未触碰的 seed/growing → 移入 _Withered (不删除), 返回数量 */
  async witherStaleSeeds(now) {
    const nowMs = (now instanceof Date) ? now.getTime() : (now ? new Date(now).getTime() : Date.now());
    const seeds = await this.scanSeeds();
    let n = 0;
    for (const s of seeds) {
      if (!shouldWitherSeed(s, nowMs)) continue;
      try { await this.discardSeed(s); n++; } catch (e) { console.warn('[TopicService] wither failed:', e); }
    }
    return n;
  }

  /** 只扫 _Seeds/_Withered/ 顶层 md */
  async scanWithered() {
    const out = [];
    const vault = this._vault();
    const wroot = vault && vault.getAbstractFileByPath(`${this._seedRoot()}/_Withered`);
    if (!_isFolder(wroot)) return out;
    for (const f of wroot.children) {
      if (!_isFile(f) || f.extension !== 'md') continue;
      const fm = this._fm(f);
      let parsed = { idea: '', waters: [] };
      try { parsed = parseSeedBody(await vault.read(f)); } catch (_) {}
      out.push({
        id: f.name, path: f.path, file: f,
        title: fm.title || f.name.replace(/\.md$/i, ''),
        track: fm.track || '', module: fm.module || '',
        status: fm.status || 'withered',
        source: fm.source || 'manual', source_ref: fm.source_ref || '',
        created: fm.created || '', touched: fm.touched || '',
        idea: parsed.idea, waters: parsed.waters
      });
    }
    return out;
  }

  /** 复活: fm status=seed + touched 刷新, 移回 _Seeds/ (重名加后缀) */
  async reviveSeed(seed) {
    const seedFile = (seed && seed.file) || vaultFileOf(this._vault(), seed && seed.path);
    if (!seedFile) return;
    await this._setFm(seedFile, { status: 'seed', touched: fmtTopicTime(new Date()) });
    const stem = String(seed.id || seedFile.name || 'seed').replace(/\.md$/i, '');
    const name = await this._uniqueChildName(this._seedRoot(), stem, '.md');
    await this._moveFile(seedFile, `${this._seedRoot()}/${name}`);
  }

  /* ---------- P3: 周回顾执行 ---------- */

  /**
   * applyWeeklyReview({focusIds, seedActions, ideaActions})
   * focusIds ≤3 (超出忽略+warn), 重置进行中专题 starred;
   * seedActions {id: 'sprout'|'keep'|'discard'};
   * ideaActions [{topicId,line,action}] 同专题按行号降序执行防错位, 单项失败仅 warn 继续
   */
  async applyWeeklyReview(plan = {}) {
    const res = { focused: 0, sprouted: 0, discarded: 0, steps: 0, forked: 0, struck: 0 };

    // 1) 聚焦重置 (直接 _setFm; 先取消不在集合内的 star, 再设置集合内 star)
    let focusIds = Array.isArray(plan.focusIds) ? plan.focusIds : [];
    if (focusIds.length > 3) {
      console.warn('[TopicService] weeklyReview focusIds >3, truncated');
      focusIds = focusIds.slice(0, 3);
    }
    const focusSet = new Set(focusIds);
    const topics = (await this.scan()).filter(t => t.status === 'in_progress');
    for (const t of topics) {
      if (!!t.starred && !focusSet.has(t.id)) {
        try { await this._setFm(t.taskFile, { starred: false }); res.focused++; }
        catch (e) { console.warn('[TopicService] review unfocus failed:', t.id, e); }
      }
    }
    for (const t of topics) {
      if (!t.starred && focusSet.has(t.id)) {
        try { await this._setFm(t.taskFile, { starred: true }); res.focused++; }
        catch (e) { console.warn('[TopicService] review focus failed:', t.id, e); }
      }
    }

    // 2) 培育中种子分流
    const acts = plan.seedActions || {};
    const seeds = await this.scanSeeds();
    for (const sid of Object.keys(acts)) {
      const act = acts[sid];
      if (act === 'keep' || !act) continue;
      const s = seeds.find(x => x.id === sid);
      if (!s) continue;
      try {
        if (act === 'sprout') {
          await this.sprout(s, { track: s.track || 'deep', module: s.module || 'GEN' });
          res.sprouted++;
        } else if (act === 'discard') {
          await this.discardSeed(s);
          res.discarded++;
        }
      } catch (e) { console.warn('[TopicService] review seed failed:', sid, e); }
    }

    // 3) 积压想法处置 (同专题按行号降序 + 每次重扫并以 label 复核行号:
    //    ideaToStep 会在 Checklist(位于 Ideas 之前) 插入一行, 使后续想法行号 +1)
    const byTopic = new Map();
    for (const a of (plan.ideaActions || [])) {
      if (!a || !a.topicId || a.action === 'keep') continue;
      if (!byTopic.has(a.topicId)) byTopic.set(a.topicId, []);
      byTopic.get(a.topicId).push(a);
    }
    for (const [tid, list] of byTopic.entries()) {
      list.sort((x, y) => (y.line || 0) - (x.line || 0));
      for (const a of list) {
        try {
          const topic = (await this.scan()).find(t => t.id === tid);
          if (!topic) continue;
          const ideas = topic.ideas || [];
          let target = ideas.find(i => i.line === a.line);
          if ((!target || (a.label && target.label !== a.label)) && a.label) {
            target = ideas.find(i => i.label === a.label); // 行号已位移 → 按 label 复核
          }
          if (!target) continue;
          const line = target.line;
          if (a.action === 'step') { await this.ideaToStep(topic, line); res.steps++; }
          else if (a.action === 'fork') { await this.forkIdea(topic, line); res.forked++; }
          else if (a.action === 'strike') { await this.strikeIdea(topic, line); res.struck++; }
        } catch (e) { console.warn('[TopicService] review idea failed:', tid, a.line, e); }
      }
    }
    return res;
  }

  /* ---------- 专题想法 (Ideas) ---------- */

  async addIdea(topic, label, source) {
    const file = topic && topic.taskFile;
    const text = String(label || '').trim();
    if (!file || !text) return;
    await this._processBody(file, (t) => addIdea(t, text, new Date(), source || ''));
    await this._touchUpdated(file);
  }

  async ideaToStep(topic, lineIndex) {
    const file = topic && topic.taskFile;
    if (!file) return;
    await this._processBody(file, (t) => ideaToStep(t, lineIndex));
    await this._touchUpdated(file);
  }

  async strikeIdea(topic, lineIndex) {
    const file = topic && topic.taskFile;
    if (!file) return;
    await this._processBody(file, (t) => strikeIdea(t, lineIndex));
    await this._touchUpdated(file);
  }

  /** 想法分叉为种子: 以 label 建种 (source=note), 成功后删除原想法行 */
  async forkIdea(topic, lineIndex) {
    const file = topic && topic.taskFile;
    if (!file) return null;
    const body = await this._vault().read(file);
    const parsed = parseTaskBody(body);
    const idea = (parsed.ideas || []).find(i => i.line === lineIndex);
    if (!idea || idea.struck || !idea.label) return null;
    const seed = await this.createSeed({
      text: idea.label,
      source: 'note',
      source_ref: `[[${topic.dir}/00-TASK]]`,
      track: topic.track || '',
      module: topic.module || ''
    });
    await this._processBody(file, (t) => removeIdeaLine(t, lineIndex));
    await this._touchUpdated(file);
    return seed;
  }

  /* ---------- P2a: Jira 升为专题 ---------- */

  async findTopicByJira(key) {
    const topics = await this.scan();
    return findTopicByJira(topics, key);
  }

  /**
   * 工单升为专题: 建专题(track=work, jira=[KEY]) → 沙盒子项整体迁入 →
   * 草稿 disposition=topic → 00-TASK 追加 Timeline/步骤
   */
  async promoteFromJira(issue, opts = {}) {
    const vault = this._vault();
    const key = String(issue && issue.key || '').trim();
    if (!key) throw new Error('缺少工单号');
    const summary = String(issue && issue.summary || '').trim();
    const module = String(opts.module || 'GEN') || 'GEN';
    const title = `[${key}] ${summary.slice(0, 60)}`;
    const topic = await this.createTopic({
      title, track: 'work', module, goal: summary, jira: [key]
    });

    // 沙盒直接子项 (文件与文件夹) 逐个迁入专题目录顶层
    const sandboxDir = String(opts.sandboxDir || '').replace(/\/+$/, '');
    let dbgFile = null;
    if (sandboxDir && vault) {
      const folder = vault.getAbstractFileByPath(sandboxDir);
      if (_isFolder(folder)) {
        for (const child of [...(folder.children || [])]) {
          const stem = String(child.name || '').replace(/\.[^.]+$/, '');
          const ext = _isFile(child) ? String(child.name).slice(stem.length) : '';
          const newName = await this._uniqueChildName(topic.dir, stem, ext);
          const newPath = `${topic.dir}/${newName}`;
          const isDbg = _isFile(child) && /_DBG.*\.md$/i.test(child.name);
          await this._moveFile(child, newPath);
          if (isDbg) {
            try { dbgFile = vault.getAbstractFileByPath(newPath) || dbgFile; } catch (_) {}
          }
        }
        if ((folder.children || []).length === 0) {
          try { await vault.delete(folder); } catch (_) {}
        }
      }
    }

    // 移入的 DBG 草稿置 disposition: topic (updated 存在才刷新)
    if (dbgFile) {
      const fmApi = this.app && this.app.fileManager;
      if (fmApi && typeof fmApi.processFrontMatter === 'function') {
        const today = fmtTopicDate(new Date());
        await fmApi.processFrontMatter(dbgFile, (fm) => {
          fm.disposition = 'topic';
          if (fm.updated !== undefined) fm.updated = today;
        });
      }
    }

    // 00-TASK.md: Timeline「源自 Jira」(+草稿 wikilink) + Checklist 一步
    const ref = dbgFile ? ` [[${String(dbgFile.path).replace(/\.[^.]+$/, '')}]]` : '';
    await this._processBody(topic.taskFile, (t) => addProgress(t, `源自 Jira ${key}：${summary}${ref}`, new Date()));
    await this._processBody(topic.taskFile, (t) => addStep(t, `梳理 ${key} 排查结论，明确专题目标`));
    await this._touchUpdated(topic.taskFile);
    return topic;
  }

  /** 升为专题入口: 已有专题直接返回不重复创建 */
  async ensureTopicFromJira(issue, opts = {}) {
    const key = String(issue && issue.key || '').trim();
    const existing = await this.findTopicByJira(key);
    if (existing) return { topic: existing, created: false };
    const topic = await this.promoteFromJira(issue, opts);
    return { topic, created: true };
  }

  /** 记灵感统一入口: 按 target 写专题想法或建种子 */
  async captureIdea(opts = {}) {
    const text = String(opts.text || '').trim();
    if (!text) return null;
    const ctx = opts.context || {};
    const target = opts.target || { type: 'seed' };
    if (target.type === 'topic' && target.id) {
      const topic = (await this.scan()).find(t => t.id === target.id);
      if (!topic) throw new Error(`专题不存在: ${target.id}`);
      await this.addIdea(topic, text, ctx.source_ref || '');
      return { kind: 'topic', topic };
    }
    const seed = await this.createSeed({
      text,
      track: target.track || '',
      module: ctx.module || '',
      source: ctx.source || 'manual',
      source_ref: ctx.source_ref || ''
    });
    return { kind: 'seed', seed };
  }
}

function vaultFileOf(vault, path) {
  try { return vault?.getAbstractFileByPath?.(path) || null; } catch (_) { return null; }
}

module.exports = {
  TOPIC_ROOT_DEFAULT,
  TOPIC_TASK_FILE,
  TOPIC_MODULE_CODES,
  TOPIC_TRACKS,
  TOPIC_STAR_LIMIT,
  fmtTopicDate,
  fmtTopicYmd,
  fmtTopicTime,
  parseTaskBody,
  toggleStep,
  addStep,
  addProgress,
  addIdea,
  ideaToStep,
  strikeIdea,
  removeIdeaLine,
  parseSeedBody,
  addWater,
  seedEffectiveStatus,
  isJiraKey,
  findTopicByJira,
  inferCaptureTarget,
  calcProgress,
  calcIdle,
  sanitizeTopicDirName,
  parseWikiLink,
  canStar,
  buildIngestPrompt,
  buildDecomposePrompt,
  buildEvaluatePrompt,
  AUTO_WATER_ROOTS,
  isAutoWaterDocPath,
  seedKeywords,
  seedMatchesDoc,
  isAutoWater,
  removeWaterLine,
  shouldWitherSeed,
  isoWeekKey,
  shouldShowWeeklyReview,
  buildWeeklyReviewPlan,
  TopicService
};
