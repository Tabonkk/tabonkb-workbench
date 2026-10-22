'use strict';
/* ============================================================================
 * radar-service.js — 能力雷达 (P3)
 * 纯数据计算: 文档权重 + 已关闭 Jira 工单 + 近 90 天活跃 → 各模块 0-100 相对归一化;
 * 三区: familiar(≥40) / expand(有进行中专题或 ≥15) / blank;
 * 季度快照 localStorage (保留最近 8 个季度), 供上季度 diff 与虚线对比。
 * 全部为可测试纯函数 + RadarService (collectDocs/collectJiraClosed/compute/快照)。
 * ============================================================================ */

// 模块码以 99-Meta/02-Naming-Spec.md §1.3 为准: 全部代码去掉 GEN
const RADAR_MODULES = ['DISP', 'CAM', 'AUD', 'USB', 'CHG', 'SNS', 'TP', 'PWR', 'STOR', 'CONN', 'MODEM', 'INPUT', 'SEC', 'KERN', 'BUILD', 'HW', 'AI', 'WB'];
const RADAR_LABELS = {
  DISP: '显示', CAM: '相机', AUD: '音频', USB: 'USB', CHG: '充电', SNS: '传感',
  TP: '触控', PWR: '电源', STOR: '存储', CONN: '连接', MODEM: '基带', INPUT: '输入',
  SEC: '安全', KERN: '内核', BUILD: '构建', HW: '硬件', AI: 'AI', WB: '工作台'
};
const RADAR_DOC_WEIGHTS = {
  ARCH: 3, GUIDE: 2.5, CASE: 2.5, RPT: 2, DBG: 2, CODE: 1.5,
  SPEC: 1, CHK: 1, NOTE: 1, REF: 0.5, PLAN: 0.5
};
const RADAR_WEIGHTS = { doc: 0.6, jira: 0.3, act: 0.1 };
const RADAR_ZONE_FAMILIAR = 40;
const RADAR_ZONE_EXPAND = 15;
const ACTIVE_DAYS = 90;
const RADAR_SNAPSHOT_KEY = 'tabonkb-radar-snapshots';
const RADAR_SNAPSHOT_KEEP = 8;

// collectDocs 排除目录前缀 (另加 topicService.rootPath 个人专题区)
const RADAR_EXCLUDE_DIRS = ['00-Inbox/', '98-Archive/', '99-Meta/', '11-Assets/', 'wiki/', '.obsidian/'];

const _up = (c) => String(c || '').trim().toUpperCase();
const DAY_MS = 86400000;

/**
 * computeRadar({docs, jiraClosed, topics, nowMs, weights})
 * docs: [{module:string|string[], doctype, ts(ms)}] —— module 数组中每个命中模块各计一次
 * jiraClosed: {CHG: 3, ...} —— 已关闭工单按模块的计数 (GEN/空已由调用方剔除)
 * 返回 [{code,label,score,raw,D,J,A,active,zone}]，顺序同 RADAR_MODULES
 */
function computeRadar(input = {}) {
  const w = Object.assign({}, RADAR_WEIGHTS, input.weights || {});
  const nowMs = (input.nowMs != null && Number.isFinite(input.nowMs)) ? input.nowMs : Date.now();
  const stats = {};
  for (const code of RADAR_MODULES) stats[code] = { D: 0, J: 0, A: 0 };

  for (const d of (input.docs || [])) {
    const dw = RADAR_DOC_WEIGHTS[_up(d && d.doctype)] || 0;
    const mods = Array.isArray(d && d.module) ? d.module : (d && d.module ? [d.module] : []);
    const ts = Number(d && d.ts);
    const isAct = dw > 0 && Number.isFinite(ts) && (nowMs - ts) <= ACTIVE_DAYS * DAY_MS;
    for (const m of mods) {
      const c = _up(m);
      if (!stats[c]) continue;
      stats[c].D += dw;
      if (isAct) stats[c].A += 1;
    }
  }

  const jm = input.jiraClosed || {};
  for (const code of RADAR_MODULES) {
    const n = Number(jm[code]);
    if (Number.isFinite(n)) stats[code].J = n;
  }

  const activeTopicModules = new Set(
    (input.topics || []).filter(t => t && t.status === 'in_progress').map(t => _up(t.module))
  );

  const raws = RADAR_MODULES.map(c => w.doc * stats[c].D + w.jira * stats[c].J + w.act * stats[c].A);
  const maxRaw = raws.reduce((m, x) => Math.max(m, x), 0);

  return RADAR_MODULES.map((code, i) => {
    const raw = raws[i];
    const score = maxRaw > 0 ? Math.round(raw / maxRaw * 100) : 0;
    const active = activeTopicModules.has(code);
    const zone = score >= RADAR_ZONE_FAMILIAR ? 'familiar'
      : (active || score >= RADAR_ZONE_EXPAND ? 'expand' : 'blank');
    return {
      code, label: RADAR_LABELS[code] || code, score, raw,
      D: stats[code].D, J: stats[code].J, A: stats[code].A,
      active, zone
    };
  });
}

function quarterKey(date) {
  const d = (date instanceof Date) ? date : new Date(date || Date.now());
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function prevQuarterKey(key) {
  const m = /^(\d{4})-Q([1-4])$/.exec(String(key || ''));
  if (!m) return '';
  let y = +m[1];
  let q = +m[2] - 1;
  if (q === 0) { q = 4; y -= 1; }
  return `${y}-Q${q}`;
}

/** current 每项附加 delta (无 prev 快照或快照缺该 code → null, 表示无可比数据) */
function diffRadar(current, prevSnapshot) {
  const prev = (prevSnapshot && typeof prevSnapshot === 'object') ? prevSnapshot : null;
  return (current || []).map(r => Object.assign({}, r, {
    delta: (prev && prev[r.code] != null) ? (r.score - prev[r.code]) : null
  }));
}

/** 空白区种子推荐: zone==='blank' 模块, 同 module 的 seed/growing 种子, growing 在前再按浇水降序, 每模块 ≤3 */
function recommendSeedsForBlank(radar, seeds) {
  const out = [];
  for (const r of (radar || [])) {
    if (r.zone !== 'blank') continue;
    const list = (seeds || [])
      .filter(s => _up(s && s.module) === r.code && (s.status === 'seed' || s.status === 'growing'))
      .sort((a, b) => {
        const ga = a.status === 'growing' ? 0 : 1, gb = b.status === 'growing' ? 0 : 1;
        return (ga - gb) || ((b.waters || []).length - (a.waters || []).length);
      })
      .slice(0, 3);
    out.push({ code: r.code, label: r.label || RADAR_LABELS[r.code] || r.code, seeds: list });
  }
  return out;
}

class RadarService {
  constructor(opts = {}) {
    this.app = opts.app || null;
    this.topicService = opts.topicService || null;
    this.getJiraIssues = opts.getJiraIssues || null;   // 同步返回已缓存工单数组 (不触发网络)
    this.categorizeDone = opts.categorizeDone || null; // (issue)=>bool, 缺省按 statusCategory/status
    this.storage = opts.storage || ((typeof localStorage !== 'undefined') ? localStorage : null);
  }

  _isDone(issue) {
    if (typeof this.categorizeDone === 'function') {
      try { return !!this.categorizeDone(issue); } catch (_) { return false; }
    }
    const cat = String(issue && issue.statusCategory || '').toLowerCase();
    const s = String(issue && issue.status || '').toLowerCase();
    return cat === 'done' || s.includes('closed') || s.includes('done') || s.includes('resolved') || s.includes('已解决') || s.includes('关闭') || s.includes('完成');
  }

  /** 遍历库内 md: 排除 Inbox/Archive/Meta/Assets/wiki/.obsidian 与个人专题区; module 或 doctype 缺失跳过; ts=fm.updated|date→mtime */
  async collectDocs() {
    const vault = this.app && this.app.vault;
    const files = (vault && typeof vault.getMarkdownFiles === 'function') ? vault.getMarkdownFiles() : [];
    const rootPath = this.topicService ? String(this.topicService.rootPath || '').replace(/\/+$/, '') : '';
    const out = [];
    for (const f of files) {
      const p = String(f && f.path || '');
      if (!p) continue;
      if (RADAR_EXCLUDE_DIRS.some(d => p.startsWith(d))) continue;
      if (rootPath && p.startsWith(rootPath + '/')) continue;
      let fm = {};
      try {
        fm = (this.app.metadataCache && this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
      } catch (_) { fm = {}; }
      const module = Array.isArray(fm.module) ? fm.module.map(_up) : (fm.module ? [_up(fm.module)] : []);
      const doctype = _up(fm.doctype);
      if (!module.length || !doctype) continue;
      let ts = NaN;
      for (const k of ['updated', 'date']) {
        if (fm[k]) {
          const t = Date.parse(String(fm[k]).replace(' ', 'T'));
          if (!isNaN(t)) { ts = t; break; }
        }
      }
      if (isNaN(ts)) ts = (f.stat && f.stat.mtime) || 0;
      out.push({ module, doctype, ts });
    }
    return out;
  }

  /** 已缓存工单中 Done 的 → inferDbgNaming 归模块计数 {CHG:n,...}; GEN/无法推断丢弃; 缺省返回 {} */
  collectJiraClosed() {
    const counts = {};
    let issues = [];
    try { issues = (this.getJiraIssues && this.getJiraIssues()) || []; } catch (_) { issues = []; }
    let infer = (typeof inferDbgNaming === 'function') ? inferDbgNaming : null;
    if (!infer) {
      try { infer = require('./jira-sandbox-service.js').inferDbgNaming; } catch (_) { infer = null; }
    }
    for (const i of issues) {
      if (!this._isDone(i)) continue;
      const m = infer ? _up(infer(i).module) : '';
      if (!m || m === 'GEN' || !RADAR_MODULES.includes(m)) continue;
      counts[m] = (counts[m] || 0) + 1;
    }
    return counts;
  }

  /** 汇总计算: collectDocs + collectJiraClosed + topicService.scan() → computeRadar */
  async compute(nowMs) {
    const docs = await this.collectDocs();
    const jiraClosed = this.collectJiraClosed();
    let topics = [];
    try { topics = this.topicService ? await this.topicService.scan() : []; }
    catch (e) { console.warn('[Radar] scan:', e); }
    return computeRadar({ docs, jiraClosed, topics, nowMs });
  }

  /* ---------- 季度快照 (localStorage, 最近 8 个季度) ---------- */

  loadSnapshots() {
    if (!this.storage) return {};
    try { return JSON.parse(this.storage.getItem(RADAR_SNAPSHOT_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  saveSnapshot(qKey, radar) {
    if (!this.storage || !qKey) return;
    const snaps = this.loadSnapshots();
    const snap = {};
    for (const r of (radar || [])) snap[r.code] = r.score;
    snaps[qKey] = snap;
    // 只保留最近 8 个季度
    const keys = Object.keys(snaps).sort();
    while (keys.length > RADAR_SNAPSHOT_KEEP) {
      delete snaps[keys.shift()];
    }
    try { this.storage.setItem(RADAR_SNAPSHOT_KEY, JSON.stringify(snaps)); } catch (_) {}
  }

  /** 上一个季度的快照 {code:score} 或 null */
  prevQuarterSnapshot(nowDate) {
    const snaps = this.loadSnapshots();
    const key = prevQuarterKey(quarterKey(nowDate || new Date()));
    return (key && snaps[key]) ? snaps[key] : null;
  }
}

module.exports = {
  RADAR_MODULES,
  RADAR_LABELS,
  RADAR_DOC_WEIGHTS,
  RADAR_WEIGHTS,
  RADAR_ZONE_FAMILIAR,
  RADAR_ZONE_EXPAND,
  ACTIVE_DAYS,
  RADAR_SNAPSHOT_KEY,
  RADAR_SNAPSHOT_KEEP,
  RADAR_EXCLUDE_DIRS,
  computeRadar,
  quarterKey,
  prevQuarterKey,
  diffRadar,
  recommendSeedsForBlank,
  RadarService
};
