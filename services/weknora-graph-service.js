/* ==========================================================================
   WeKnora Graph Topology Service
   将 WeKnora Wiki 链接图谱以「瘦节点子图」形式接入工作台研发知识拓扑。
   内存策略: 服务端切片(top-N) + 7 字段瘦节点 + 磁盘缓存(TTL) + ego 封顶。
   视觉策略: 节点对象与 vault 节点完全同构, 渲染层零感知(样式沿用 Obsidian 主题)。
   ========================================================================== */

// 错误落盘日志: 渲染/合并异常写入插件目录 weknora-topo-error.log, 供离线定位
function wkTopoWriteLog(vaultBasePath, text) {
  try {
    const p = wkTopoCachePath(vaultBasePath).replace(/weknora-graph-cache\.json$/, 'weknora-topo-error.log');
    fs.appendFileSync(p, '[' + new Date().toISOString() + '] ' + String(text).slice(0, 3000) + '\n', 'utf8');
  } catch (e) { /* 日志失败不影响主流程 */ }
}

// 语义归簇: WK 节点标题/slug 关键词 → 现有工程模块 (Obsidian 原生色板)
const WK_TOPO_CLASSIFY_RULES = [
  [/charg|chg|charge|battery-charge|pd协议|快充|充电/i, 'Charger'],
  [/display|mipi|lcd|panel|lcm|oled|显示/i, 'Display'],
  [/power|pmic|功耗|休眠|电流/i, 'Power'],
  [/crash|panic|tombstone|ke死机|死机|重启|watchdog/i, 'Crash'],
  [/\bspec\b|规范|cdd|认证|cert/i, 'Spec'],
  [/\bcam\b|camera|sensor|摄像头/i, 'Camera'],
  [/build|compile|flash|toolchain|编译|烧录|lk\/abl|uboot/i, 'Toolchain'],
  [/audio|codec|录音|音频/i, 'Audio'],
  [/touch|tp\b|触摸/i, 'Touch']
];

// 独立分组模式: page_type → WK-* 模块 (色板在 MODULE_COLORS 中同族扩展)
function wkTopoGroupModule(pageType) {
  if (pageType === 'entity') return 'WK-Entity';
  if (pageType === 'concept') return 'WK-Concept';
  if (pageType === 'summary') return 'WK-Summary';
  return 'WK-Other';
}

function wkTopoClassify(title, slug) {
  const text = (title || '') + ' ' + (slug || '');
  for (const rule of WK_TOPO_CLASSIFY_RULES) {
    if (rule[0].test(text)) return rule[1];
  }
  return 'General';
}

// 凭证/地址: 复用 weknora-mcp-shared 的 config 链 (data.json + .secrets.json)
function wkTopoConfig(vaultBasePath) {
  const env = buildWeknoraEnv(vaultBasePath);
  let base = env.WEKNORA_BASE_URL || '';
  if (!base) return null;
  if (!/\/api\/v\d+$/i.test(base)) base = base.replace(/\/+$/, '') + '/api/v1';
  const key = env.WEKNORA_API_KEY || '';
  if (!key) return null;
  return { base, key, kb: env.WEKNORA_DEFAULT_KB || '' };
}

async function wkTopoHttpJson(base, key, path) {
  const res = await requestUrl({ url: base + path, method: 'GET', headers: { 'X-API-Key': key } });
  if (res.status < 200 || res.status >= 300) throw new Error('WeKnora HTTP ' + res.status + ' @ ' + path);
  return res.json;
}

// 解析 KB id: 设置里的默认库名/id 优先, 否则取第一个
async function wkTopoResolveKbId(cfg) {
  const listRes = await wkTopoHttpJson(cfg.base, cfg.key, '/knowledge-bases');
  const list = (listRes && listRes.data) || [];
  if (!list.length) throw new Error('WeKnora 无可用知识库');
  const hit = cfg.kb ? list.find(k => k.name === cfg.kb || k.id === cfg.kb) : null;
  return (hit || list[0]).id;
}

// 服务端切片拉取: overview top-N (默认 300, 硬顶 500)
async function wkTopoFetchGraph(vaultBasePath, limit) {
  const cfg = wkTopoConfig(vaultBasePath);
  if (!cfg) throw new Error('WeKnora 未配置 (Base URL / API Key)');
  const kbId = await wkTopoResolveKbId(cfg);
  const n = Math.max(50, Math.min(500, limit || 300));
  const raw = await wkTopoHttpJson(cfg.base, cfg.key,
    `/knowledgebase/${kbId}/wiki/graph?mode=overview&limit=${n}`);
  return { nodes: raw.nodes || [], edges: raw.edges || [], meta: raw.meta || {}, kbId, fetchedAt: Date.now() };
}

// ego 扩展: 一跳邻域; 实测 hub 一跳可达 298 节点/1434 边, 客户端按 link_count 封顶
async function wkTopoFetchEgo(vaultBasePath, slug, cap) {
  const cfg = wkTopoConfig(vaultBasePath);
  if (!cfg) throw new Error('WeKnora 未配置');
  const kbId = await wkTopoResolveKbId(cfg);
  const raw = await wkTopoHttpJson(cfg.base, cfg.key,
    `/knowledgebase/${kbId}/wiki/graph?mode=ego&center=${encodeURIComponent(slug)}&depth=1`);
  let nodes = raw.nodes || [];
  const keep = Math.max(20, cap || 150);
  if (nodes.length > keep) {
    nodes = nodes.slice().sort((a, b) => (b.link_count || 0) - (a.link_count || 0)).slice(0, keep);
    const kept = new Set(nodes.map(n => n.slug));
    raw.edges = (raw.edges || []).filter(e => kept.has(e.source) && kept.has(e.target));
  }
  return { nodes, edges: raw.edges || [], meta: raw.meta || {} };
}

// 单页正文懒加载 (16KB/页级别, 仅详情面板用, 不进图数据)
async function wkTopoFetchPage(vaultBasePath, slug) {
  const cfg = wkTopoConfig(vaultBasePath);
  if (!cfg) throw new Error('WeKnora 未配置');
  const kbId = await wkTopoResolveKbId(cfg);
  const p = await wkTopoHttpJson(cfg.base, cfg.key,
    `/knowledgebase/${kbId}/wiki/pages/${encodeURIComponent(slug)}`);
  return { title: p.title, pageType: p.page_type, summary: p.summary || '', content: p.content || '' };
}

async function wkTopoFetchStats(vaultBasePath) {
  const cfg = wkTopoConfig(vaultBasePath);
  if (!cfg) throw new Error('WeKnora 未配置');
  const kbId = await wkTopoResolveKbId(cfg);
  const raw = await wkTopoHttpJson(cfg.base, cfg.key, `/knowledgebase/${kbId}/wiki/stats`);
  return (raw && raw.data) || raw || {};
}

// 瘦化映射: WK 原始节点 → 与 vault 节点同构的原生对象 (无 content/attributes)
function wkTopoSlimGraph(raw, grouping) {
  const nodes = (raw.nodes || []).map(n => {
    const module = grouping === 'wk'
      ? wkTopoGroupModule(n.page_type)
      : wkTopoClassify(n.title, n.slug);
    return {
      id: 'wk:' + n.slug,
      basename: n.title || n.slug,
      title: n.title || n.slug,
      displayName: n.title || n.slug,
      type: n.page_type,
      module,
      platform: 'WeKnora',
      date: '',
      summary: '',
      shape: 'circle',
      color: (typeof MODULE_COLORS !== 'undefined' && MODULE_COLORS[module]) || '#94A3B8',
      content: '',
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 4.0,
      referenceCount: 0,
      importance: 'normal',
      isCoreAnchor: false,
      source: 'weknora',
      wkSlug: n.slug,
      wkType: n.page_type,
      wkLinks: n.link_count || 0
    };
  });
  const edges = (raw.edges || []).map((e, i) => ({
    id: 'wke_' + i,
    source: 'wk:' + e.source,
    target: 'wk:' + e.target,
    relation: 'references',
    weight: 1.0
  }));
  return { nodes, edges };
}

// 磁盘缓存: 单文件覆盖写, 进程内存不常驻
function wkTopoCachePath(vaultBasePath) {
  return vaultBasePath.replace(/[\\/]$/, '') +
    '/.obsidian/plugins/tabonkb-workbench/weknora-graph-cache.json';
}

function wkTopoCacheLoad(vaultBasePath, ttlHours) {
  try {
    const p = wkTopoCachePath(vaultBasePath);
    if (!fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const ttl = (ttlHours || 24) * 3600 * 1000;
    if (!j || !j.fetchedAt || Date.now() - j.fetchedAt > ttl) return null;
    if (!Array.isArray(j.nodes)) return null;
    return j;
  } catch (e) {
    console.warn('[TabonKB] WeKnora 拓扑缓存读取失败:', e);
    return null;
  }
}

function wkTopoCacheSave(vaultBasePath, payload) {
  try {
    fs.writeFileSync(wkTopoCachePath(vaultBasePath), JSON.stringify(payload), 'utf8');
  } catch (e) {
    console.warn('[TabonKB] WeKnora 拓扑缓存写入失败:', e);
  }
  return payload;
}

// 合并后统一重算度数/半径阶梯/簇锚点 (与 buildGraphData 第 4、5 步同规格)
function wkTopoRecomputeDegrees(graph) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const deg = new Map();
  edges.forEach(e => {
    deg.set(e.source, (deg.get(e.source) || 0) + 1);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  });
  nodes.forEach(n => {
    const d = deg.get(n.id) || 0;
    n.referenceCount = d;
    if (d >= 6) { n.importance = 'core'; n.radius = 6.5; }
    else if (d >= 3) { n.importance = 'important'; n.radius = 5.2; }
    else { n.importance = 'normal'; n.radius = 4.0; }
    n.isCoreAnchor = false;
  });
  const byModule = {};
  nodes.forEach(n => { (byModule[n.module] = byModule[n.module] || []).push(n); });
  Object.keys(byModule).forEach(mod => {
    const list = byModule[mod].slice().sort((a, b) => (b.referenceCount || 0) - (a.referenceCount || 0));
    if (list.length) {
      list[0].isCoreAnchor = true;
      list[0].importance = 'core';
      list[0].radius = 6.8;
    }
  });
  return graph;
}

// 联邦合并: vault 图 + WK 瘦子图; 总量封顶 cap (默认 800), 边去重
function wkTopoMerge(vaultGraph, wkGraph, cap) {
  const maxTotal = cap || 800;
  const nodes = (vaultGraph.nodes || []).slice();
  const have = new Set(nodes.map(n => n.id));
  let wkNodes = (wkGraph.nodes || []).filter(n => !have.has(n.id));
  const room = Math.max(0, maxTotal - nodes.length);
  if (wkNodes.length > room) {
    wkNodes = wkNodes.slice().sort((a, b) => (b.wkLinks || 0) - (a.wkLinks || 0)).slice(0, room);
  }
  const kept = new Set(wkNodes.map(n => n.id));
  nodes.push(...wkNodes);

  const edges = (vaultGraph.edges || []).slice();
  const edgeSet = new Set(edges.map(e => [e.source, e.target].sort().join('::')));
  (wkGraph.edges || []).forEach(e => {
    if (!kept.has(e.source) || !kept.has(e.target)) return;
    const key = [e.source, e.target].sort().join('::');
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ id: 'e_' + edges.length, source: e.source, target: e.target, relation: e.relation || 'references', weight: e.weight || 1.0 });
  });
  return wkTopoRecomputeDegrees({ nodes, edges });
}
