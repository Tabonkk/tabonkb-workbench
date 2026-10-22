import re
import os

_script_dir = os.path.dirname(os.path.abspath(__file__))
plugin_dir = _script_dir if os.path.exists(os.path.join(_script_dir, "main.js.bak")) else r"d:\work\Mgmt\TabonKB\.obsidian\plugins\tabonkb-workbench"

def clean_code(code):
    # Remove node requires that will be hoisted to the top or resolved locally
    code = re.sub(r"const\s+\{[^}]*\}\s*=\s*require\(['\"][^'\"]+['\"]\);?", "", code, flags=re.MULTILINE | re.DOTALL)
    code = re.sub(r"const\s+[a-zA-Z0-9_$]+\s*=\s*require\(['\"][^'\"]+['\"]\);?", "", code)
    # Remove module.exports = { ... };
    code = re.sub(r"module\.exports\s*=\s*\{[^}]*\};?", "", code, flags=re.MULTILINE | re.DOTALL)
    return code.strip()

# Read each source module
files = [
    f"{plugin_dir}\\ui\\iconpark.js",
    f"{plugin_dir}\\ui\\theme-engine.js",
    f"{plugin_dir}\\providers\\agent-adapter-base.js",
    f"{plugin_dir}\\services\\intranet-fetcher.js",
    f"{plugin_dir}\\mcp\\vendor-mcp-shared.js",
    f"{plugin_dir}\\mcp\\weknora-mcp-shared.js",
    f"{plugin_dir}\\mcp\\opengrok-mcp-shared.js",
    f"{plugin_dir}\\services\\opengrok-service.js",
    f"{plugin_dir}\\mcp\\gerrit-mcp-shared.js",
    f"{plugin_dir}\\mcp\\jira-mcp-shared.js",
    f"{plugin_dir}\\mcp\\drawio-mcp-shared.js",
    f"{plugin_dir}\\mcp\\codegraph-mcp-shared.js",
    f"{plugin_dir}\\mcp\\powerz-mcp-shared.js",
    f"{plugin_dir}\\mcp\\dslogic-mcp-shared.js",
    f"{plugin_dir}\\mcp\\dsh-mcp-shared.js",
    f"{plugin_dir}\\services\\gerrit-service.js",
    f"{plugin_dir}\\services\\drawio-broker.js",
    f"{plugin_dir}\\services\\dsh-daemon-manager.js",
    f"{plugin_dir}\\services\\powerz-service.js",
    f"{plugin_dir}\\services\\dslogic-service.js",
    f"{plugin_dir}\\pi-agent-bridge.js",
    f"{plugin_dir}\\providers\\pi-adapter.js",
    f"{plugin_dir}\\providers\\hermes-adapter.js",
    f"{plugin_dir}\\providers\\gemini-adapter.js",
    f"{plugin_dir}\\providers\\antigravity-adapter.js",
    f"{plugin_dir}\\providers\\niceaigc-adapter.js",
    f"{plugin_dir}\\providers\\dsh-adapter.js",
    f"{plugin_dir}\\agent-session-manager.js",
    f"{plugin_dir}\\agent-hub.js",
    f"{plugin_dir}\\agent-context-provider.js",
    f"{plugin_dir}\\services\\file-locator-core.js",
    f"{plugin_dir}\\services\\local-project-service.js",
    f"{plugin_dir}\\services\\workbench-context.js",
    f"{plugin_dir}\\services\\agent-version-service.js",
    f"{plugin_dir}\\services\\magpie-observability-service.js",
    f"{plugin_dir}\\components\\code-viewer-panel.js",
    f"{plugin_dir}\\pi-drawer-view.js",
    f"{plugin_dir}\\services\\jira-service.js",
    f"{plugin_dir}\\services\\rss-service.js",
    f"{plugin_dir}\\components\\jira-card.js",
    f"{plugin_dir}\\components\\rss-card.js",
    f"{plugin_dir}\\services\\topic-service.js",
    f"{plugin_dir}\\services\\jira-sandbox-service.js",
    f"{plugin_dir}\\components\\jira-platform-view.js",
    f"{plugin_dir}\\services\\radar-service.js",
    f"{plugin_dir}\\components\\topic-view.js",
    f"{plugin_dir}\\components\\rss-center-view.js",
    f"{plugin_dir}\\services\\vendor-portal-service.js",
    f"{plugin_dir}\\services\\companion-server.js",
    f"{plugin_dir}\\services\\weknora-service.js",
    f"{plugin_dir}\\services\\weknora-graph-service.js",
    f"{plugin_dir}\\components\\weknora-manage\\graph-engine.js",
    f"{plugin_dir}\\components\\weknora-manage\\wiki-drawer.js",
    f"{plugin_dir}\\components\\weknora-manage\\wiki-graph-view.js",
    f"{plugin_dir}\\components\\weknora-manage\\documents-view.js",
    f"{plugin_dir}\\components\\weknora-manage\\sync-view.js",
    f"{plugin_dir}\\components\\weknora-manage\\webview-embed.js",
    f"{plugin_dir}\\components\\weknora-manage\\manage-view.js",
    f"{plugin_dir}\\services\\clip-image-inliner.js",
    f"{plugin_dir}\\components\\explore-palette.js",
    f"{plugin_dir}\\components\\idea-capture-palette.js",
    f"{plugin_dir}\\components\\explore-view.js",
    f"{plugin_dir}\\components\\phone-competitor-view.js",
    f"{plugin_dir}\\components\\dsh-studio-view.js",
    f"{plugin_dir}\\components\\dsh-workbench-view.js",
    f"{plugin_dir}\\components\\tools\\charger\\register-db.js",
    f"{plugin_dir}\\components\\tools\\charger\\power-standards.js",
    f"{plugin_dir}\\components\\tools\\charger\\charger-calc.js",
    f"{plugin_dir}\\components\\tools\\charger\\charger-charts.js",
    f"{plugin_dir}\\components\\tools\\charger\\charge-panel.js",
    f"{plugin_dir}\\components\\tools\\charger\\discharge-panel.js",
    f"{plugin_dir}\\components\\tools\\charger\\ic-panel.js",
    f"{plugin_dir}\\components\\tools\\charger\\powerz-panel.js",
    f"{plugin_dir}\\components\\tools\\charger\\charger-tool-view.js",
    f"{plugin_dir}\\components\\tools\\logic\\presets.js",
    f"{plugin_dir}\\components\\tools\\logic\\wave-view.js",
    f"{plugin_dir}\\components\\tools\\logic\\proto-table.js",
    f"{plugin_dir}\\components\\tools\\logic\\logic-tool-view.js",
    f"{plugin_dir}\\components\\tools-view.js",
    f"{plugin_dir}\\settings\\workbench-settings-tab.js",
]

module_codes = []
for fpath in files:
    fpath_norm = fpath.replace("\\", os.sep)
    with open(fpath_norm, "r", encoding="utf-8") as f:
        cleaned = clean_code(f.read())
        module_codes.append(cleaned)

combined_modules = "\n\n".join(module_codes)

header = """const { Plugin, ItemView, Notice, PluginSettingTab, Setting, requestUrl, MarkdownRenderer, Component, Menu } = require('obsidian');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const net = require('net');
const zlib = require('zlib');
let electronModule = null;
try { electronModule = require('electron'); } catch (e) {}
const shell = electronModule ? electronModule.shell : null;

/* ==========================================================================
   Embedded Multi-Agent Hub Modules (Pi, Hermes, Gemini for Obsidian Workbench)
   ========================================================================== */
"""

with open(os.path.join(plugin_dir, "main.js.bak"), "r", encoding="utf-8") as f:
    main_code = f.read()

workbench_anchor = 'const VIEW_TYPE_WORKBENCH = "tabonkb-workbench-view";'
idx = main_code.find(workbench_anchor)
if idx == -1:
    print("Error: workbench_anchor not found!")
    exit(1)

workbench_part = main_code[idx:]

# 1. Update TabonKBWorkbenchView constructor and add tab helpers
old_constructor = """class TabonKBWorkbenchView extends ItemView {
  constructor(leaf) {
    super(leaf);
    this.currentTab = 'tasks';
    this.keyword = '';
    this.statusFilter = 'all';
    this.moduleFilter = '';
    this.platformFilter = '';
    this.omnisearchResults = null;
    this.searchDebounceTimer = null;

    this.realDocs = [];
    this.graphData = { nodes: [], edges: [] };
    this.tasksData = DEFAULT_TASKS;

    this.selectedKnowledgeNode = null;
    this.knowledgePanelMode = 'overview'; // 'overview' | 'detail'

    this.isLoadingDocs = false;
    this.graphCanvas = null;

    // Multi-Agent Hub Integration (Pi, Codex, Gemini)
    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\\\work\\\\Mgmt\\\\TabonKB';
    this.contextProvider = new AgentContextProvider(this.app);
    this.agentBridge = new PiAgentBridge({ vaultBasePath: vaultPath });
    this.agentHub = new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge
    });
    this.agentDrawer = new PiDrawerView({
      hub: this.agentHub,
      bridge: this.agentBridge,
      contextProvider: this.contextProvider,
      onNodeFocus: (nodeId) => this.selectKnowledgeNode(nodeId)
    });
  }"""

new_constructor = """class TabonKBWorkbenchView extends ItemView {
  constructor(leaf) {
    super(leaf);
    this.activeTab = this.getSavedActiveTab();
    this.currentTab = 'tasks';
    this.keyword = '';
    this.tabKeywords = {}; // 各 tab 独立缓存搜索词，切换页面时互不带入
    this.statusFilter = 'all';
    this.moduleFilter = '';
    this.platformFilter = '';
    this.omnisearchResults = null;
    this.searchDebounceTimer = null;

    this.realDocs = [];
    this.graphData = { nodes: [], edges: [] };
    this.tasksData = DEFAULT_TASKS;

    this.selectedKnowledgeNode = null;
    this.knowledgePanelMode = 'overview'; // 'overview' | 'detail'

    this.isLoadingDocs = false;
    // 并发/渲染调度状态: loadVaultDocs 在飞共享 Promise + 脏标记补扫 + 渲染合并节流
    this._docsInFlight = false;
    this._docsPromise = null;
    this._docsDirty = false;
    this._renderQueued = false;
    this._lastRefreshRenderAt = 0;
    this._refreshRenderTimer = null;
    this.graphCanvas = null;

    // Full-page independent subsystems
    this.jiraPlatform = null;
    this.topicView = null;
    this.topicService = null;
    this._ownTopicService = false;
    this.rssCenter = null;
    this.jiraCard = null;
    this.rssCard = null;
    this.weknoraManage = null;
    this.harnessView = null;
    this._harnessMounted = false; // R18: Harness 视图是否已挂载到文档树
    this.toolsView = null;

    // Home Tab Trend Analytics
    this.homeTrendIssues = null;
    this.homeTrendCardEl = null;
    this.homeTrendTimeRange = this.getHomeTrendTimeRange();

    // Home Tab Heatmap Analytics
    this.homeHeatCardEl = null;
    this.heatmapDimension = this.getSavedHeatmapDimension();
    this._selectedHeatCell = null;
    this._heatDocClickBound = null;

    // Home Tab Agent Usage Analytics
    this.agentUsageCardEl = null;
    this.agentUsageRange = this.getAgentUsageRange();
    this.agentUsageMetric = this.getAgentUsageMetric();
    this._agentUsageExpanded = new Set();
    this._auLedgerCache = null;
    this._auDayLock = null;
    this._auLastTrend = [];
    this._agyQuotaCache = null; // @deprecated 额度功能已下线，字段保留置空防残留引用

    // Magpie Observability Bridge (127.0.0.1:3425, 只读快照 + 本地兜底)
    this.magpieObs = new MagpieObservabilityService();
    this._mqMaskAccounts = false;          // 是否对账号邮箱打码
    this._mqIncludeCache = true;           // TOKEN 统计是否含缓存读取
    this._mqQuotaCollapsed = false;        // 「额度」区块是否折叠
    this._mqTrendExpanded = new Set();     // 「剩余额度走势」被折叠的卡片 key 集合 (默认全展开)
    this._mqRankTab = 'agents';            // 底部维度切换: 'agents' | 'models' | 'accounts'
    this._mqAutoRefreshSec = 0;            // 自动刷新间隔: 0(关) | 5(5秒)
    this._mqAutoRefreshTimer = null;
    this._mqLastSnapshot = null;
    this._mqRenderedOnce = false;
    this._mqFetching = null;

    // Multi-Agent Hub Integration (Pi, Hermes, Gemini)
    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\\\work\\\\Mgmt\\\\TabonKB';
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    this.plugin = plugin || null;
    this.contextProvider = plugin?.contextProvider || new AgentContextProvider(this.app);
    this.agentBridge = plugin?.agentBridge || new PiAgentBridge({ vaultBasePath: vaultPath, plugin: plugin });
    this.agentHub = plugin?.agentHub || new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge,
      app: this.app,
      getNiceaigcConfig: () => {
        const p = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        return p?.settings?.niceaigc || DEFAULT_SETTINGS.niceaigc;
      }
    });
    this.agentDrawer = new PiDrawerView({
      hub: this.agentHub,
      bridge: this.agentBridge,
      contextProvider: this.contextProvider,
      app: this.app,
      onNodeFocus: (nodeId) => this.selectKnowledgeNode(nodeId)
    });
    try { globalThis.__twBootMark && __twBootMark('view.ctor:end'); } catch (e) {}
  }

  getSavedActiveTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const t = localStorage.getItem('tabonkb-active-tab');
        if (t === 'home' || t === 'tasks' || t === 'news' || t === 'explore' || t === 'tools' || t === 'harness' || t === 'manage') return t;
      }
    } catch (e) {}
    return 'home';
  }

  setActiveTab(tab) {
    if (this.activeTab === tab) return;
    // R18: 离开 Harness 页签时显式释放视图, 避免 _harnessMounted 标记失效后泄漏事件监听
    if (this.activeTab === 'harness' && tab !== 'harness') {
      this._harnessMounted = false;
      if (this.harnessView) {
        try { this.harnessView.dispose(); } catch (_) {}
        this.harnessView = null;
      }
    }
    // 离开 Tools 页签时释放视图
    if (this.activeTab === 'tools' && tab !== 'tools') {
      if (this.toolsView) {
        try { this.toolsView.dispose(); } catch (_) {}
        this.toolsView = null;
      }
    }
    // 离开首页时停掉 Magpie 观测自动刷新定时器
    if (this.activeTab === 'home' && tab !== 'home' && typeof this._mqClearAutoRefresh === 'function') {
      this._mqClearAutoRefresh();
    }
    // 离开的页面记住自己的搜索词，进入的页面恢复各自缓存，互不串页
    if (this.activeTab) this.tabKeywords[this.activeTab] = this.keyword || '';
    this.activeTab = tab;
    this.keyword = this.tabKeywords[tab] || '';
    clearTimeout(this.searchDebounceTimer);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-active-tab', tab);
      }
    } catch (e) {}
    this.render();
  }

  getHomeTrendTimeRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('tabonkb-home-trend-range');
        if (r === 'week' || r === 'month' || r === 'quarter' || r === 'year') return r;
      }
    } catch (e) {}
    return 'month';
  }

  saveHomeTrendTimeRange(range) {
    this.homeTrendTimeRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-home-trend-range', range);
      }
    } catch (e) {}
  }

  getHomeTrendIssues() {
    const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
    const js = plugin?.jiraService;
    // 与任务页同源：优先直接复用任务页当前加载的数据集，两页统计保证完全一致
    const jpIssues = this.jiraPlatform?.issues;
    if (Array.isArray(jpIssues) && jpIssues.length > 0) {
      this.homeTrendIssues = jpIssues;
      return this.homeTrendIssues;
    }
    // 任务页尚未加载时读主缓存，任务页刷新后首页走势图实时对应
    if (js?._cache?.issues?.length) {
      this.homeTrendIssues = js._cache.issues;
      return this.homeTrendIssues;
    }
    if (this.homeTrendIssues && this.homeTrendIssues.length > 0) {
      return this.homeTrendIssues;
    }
    if (js?._trendCache?.issues?.length) {
      this.homeTrendIssues = js._trendCache.issues;
      return this.homeTrendIssues;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const cacheKeys = js?.getTrendCacheKeys ? js.getTrendCacheKeys() : null;
        const raw = cacheKeys ? localStorage.getItem(cacheKeys.data) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.homeTrendIssues = parsed;
            return this.homeTrendIssues;
          }
        }
      }
    } catch (e) {}
    return [];
  }

  pointsToLinePath(points) {
    if (!points || points.length === 0) return '';
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ');
  }

  calculateHomeTrendData(issues, timeRange, W = 500, H = 120) {
    const rangeConfig = {
      week: { days: 7, buckets: 7, labels: [] }, // 周视图横轴标签由 bucketEnds 动态生成 mm-dd 日期
      month: { days: 30, buckets: 5, labels: ['4周前', '3周前', '2周前', '上周', '本周'] },
      quarter: { days: 90, buckets: 6, labels: ['10周前', '8周前', '6周前', '4周前', '2周前', '本周'] },
      year: { days: 365, buckets: 6, labels: ['10月前', '8月前', '6月前', '4月前', '2月前', '本月'] }
    };

    const cfg = rangeConfig[timeRange] || rangeConfig.month;
    const now = Date.now();
    const startTime = now - cfg.days * 86400000;
    const stepMs = (cfg.days * 86400000) / (cfg.buckets - 1);

    const bucketEnds = [];
    for (let i = 0; i < cfg.buckets; i++) {
      bucketEnds.push(i === cfg.buckets - 1 ? now : startTime + i * stepMs);
    }

    // 周视图横轴用具体 mm-dd 日期替代 D-* 偏移量，一眼看出对应哪天
    let axisLabels = cfg.labels;
    if (timeRange === 'week') {
      axisLabels = bucketEnds.map((t) => {
        const d = new Date(t);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
    }

    const parseTime = (ts) => {
      if (!ts) return 0;
      const d = new Date(ts).getTime();
      return isNaN(d) ? 0 : d;
    };

    const isDone = (iss) => {
      const cat = (iss.statusCategory || '').toLowerCase();
      const st = (iss.status || '').toLowerCase();
      return cat === 'done' || st.includes('已解决') || st.includes('解决') || st.includes('关闭') || st.includes('resolved') || st.includes('closed');
    };

    let projectCounts = {};
    for (const iss of issues) {
      const proj = (iss.key && iss.key.includes('-')) ? iss.key.split('-')[0] : '';
      if (proj) projectCounts[proj] = (projectCounts[proj] || 0) + 1;
    }
    const topProj = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '本人 Jira';

    // The chart is a period view: only issues created in the selected range
    // are included, so the visual never invents a baseline from old cache rows.
    const scopeIssues = issues.filter(iss => {
      const cTime = parseTime(iss.rawCreated || iss.created);
      return cTime >= startTime && cTime <= now;
    });

    const rawCreatedSeries = [];
    const rawDoneSeries = [];

    for (const bEnd of bucketEnds) {
      let cCount = 0;
      let dCount = 0;
      for (const iss of scopeIssues) {
        const cTime = parseTime(iss.rawCreated || iss.created);
        const uTime = parseTime(iss.rawResolved || iss.rawUpdated || iss.updated);
        if (cTime && cTime >= startTime && cTime <= bEnd) cCount++;
        if (isDone(iss) && uTime && uTime >= startTime && uTime <= bEnd) dCount++;
      }
      rawCreatedSeries.push(cCount);
      rawDoneSeries.push(dCount);
    }

    // 逐桶新增：累计发现序列的差分，周视图即「当日新增」
    const newCreatedSeries = rawCreatedSeries.map((v, i) => (i === 0 ? v : Math.max(0, v - rawCreatedSeries[i - 1])));

    // 总量/闭环统计与任务页指标卡对齐：基于全量数据集而非图表窗口内创建的子集
    const totalCount = issues.length;
    const doneCount = issues.filter(isDone).length;
    const openCount = Math.max(0, totalCount - doneCount);
    const convergenceRate = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 100;

    const dateDetails = [];
    for (let i = 0; i < cfg.buckets; i++) {
      const d = new Date(bucketEnds[i]);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      if (timeRange === 'week') {
        const diffDays = cfg.buckets - 1 - i;
        dateDetails.push(`${m}月${day}日${diffDays === 0 ? ' · 今天' : ''}`);
      } else if (timeRange === 'month') {
        dateDetails.push(`${axisLabels[i]} (${m}/${day})`);
      } else if (timeRange === 'year') {
        dateDetails.push(`${d.getFullYear()}年${m}月 (${axisLabels[i]})`);
      } else {
        dateDetails.push(`${m}月${day}日 · ${axisLabels[i]}`);
      }
    }

    const minX = 25;
    const maxX = W - 25;
    const xCoords = [];
    for (let i = 0; i < cfg.buckets; i++) {
      xCoords.push(Math.round((minX + (i * (maxX - minX)) / (cfg.buckets - 1)) * 10) / 10);
    }

    return {
      W,
      H,
      labels: axisLabels,
      dateDetails,
      xCoords,
      bucketEnds,
      createdSeries: rawCreatedSeries,
      doneSeries: rawDoneSeries,
      newSeries: newCreatedSeries,
      scopeCount: scopeIssues.length,
      totalCount,
      doneCount,
      openCount,
      convergenceRate,
      topProj
    };
  }

  generateHomeTrendSvg(trendData) {
    const { labels, xCoords, createdSeries, doneSeries } = trendData;
    const N = labels.length;
    if (N === 0) return '';
    const W = trendData.W || 500;
    const H = trendData.H || 120;

    const baseY = H - 18;
    const topY = 18;

    const maxVal = Math.max(...createdSeries, ...doneSeries, 5);
    const scaleY = (v) => {
      if (maxVal <= 0) return baseY;
      const y = baseY - (v / maxVal) * (baseY - topY);
      return Math.max(topY, Math.min(baseY, Math.round(y * 10) / 10));
    };

    const donePoints = xCoords.map((x, i) => ({ x, y: scaleY(doneSeries[i]) }));
    const createdPoints = xCoords.map((x, i) => ({ x, y: scaleY(createdSeries[i]) }));

    const doneLinePath = this.pointsToLinePath(donePoints);
    const doneAreaPath = doneLinePath + ` L ${xCoords[N - 1]},${baseY} L ${xCoords[0]},${baseY} Z`;
    const createdLinePath = this.pointsToLinePath(createdPoints);

    const lastX = xCoords[N - 1];
    const lastDoneY = scaleY(doneSeries[N - 1]);
    const lastCreatedY = scaleY(createdSeries[N - 1]);

    const labelTexts = labels.map((lbl, i) => {
      const x = xCoords[i];
      let anchor = 'middle';
      if (i === 0) anchor = 'start';
      else if (i === N - 1) anchor = 'end';
      const isEnd = i === N - 1;
      const fill = isEnd ? 'var(--g-green, #10B981)' : 'var(--g-label-3, var(--text-muted, #8b949e))';
      return `<text x="${x}" y="${H - 4}" font-size="9" fill="${fill}" font-family="monospace" text-anchor="${anchor}">${lbl}${isEnd ? '(本期)' : ''}</text>`;
    }).join('');

    const dotsHtml = xCoords.map((x, i) => {
      const cy = scaleY(doneSeries[i]);
      const cr = scaleY(createdSeries[i]);
      return `
        <g class="tw-trend-col" data-idx="${i}">
          <circle cx="${x}" cy="${cy}" r="7" fill="transparent" class="tw-trend-hit tw-trend-hit-done" data-idx="${i}" />
          <circle cx="${x}" cy="${cr}" r="7" fill="transparent" class="tw-trend-hit tw-trend-hit-created" data-idx="${i}" />
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible; display: block;">
        <defs>
          <linearGradient id="twTrendGreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--g-green, #10B981)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="var(--g-green, #10B981)" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="${topY + 7}" x2="${W}" y2="${topY + 7}" stroke="var(--g-sep, var(--background-modifier-border, #E2E8F0))" stroke-dasharray="3 3"/>
        <line x1="0" y1="${Math.round((topY + baseY) / 2)}" x2="${W}" y2="${Math.round((topY + baseY) / 2)}" stroke="var(--g-sep, var(--background-modifier-border, #E2E8F0))" stroke-dasharray="3 3"/>
        <line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="var(--g-sep, var(--background-modifier-border, #E2E8F0))" stroke-dasharray="3 3"/>
        <path d="${doneAreaPath}" fill="url(#twTrendGreenGrad)"/>
        <path d="${doneLinePath}" fill="none" stroke="var(--g-green, #10B981)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${createdLinePath}" fill="none" stroke="var(--g-red, #EF4444)" stroke-width="2" stroke-dasharray="4 2" stroke-linecap="round" stroke-linejoin="round"/>
        <line id="twTrendGuideline" x1="0" y1="${topY - 4}" x2="0" y2="${baseY}" stroke="var(--g-blue, var(--interactive-accent, #2563EB))" stroke-width="1.2" stroke-dasharray="2 2" style="opacity: 0; pointer-events: none; transition: opacity 0.1s ease;"/>
        ${dotsHtml}
        <circle cx="${lastX}" cy="${lastDoneY}" r="3.2" fill="var(--g-green, #10B981)" class="tw-trend-latest-dot"/>
        <circle cx="${lastX}" cy="${lastCreatedY}" r="3.2" fill="var(--g-red, #EF4444)" class="tw-trend-latest-dot"/>
        ${labelTexts}
      </svg>
    `;
  }

  renderHomeTrendCard(parentEl) {
    this.homeTrendCardEl = parentEl.createDiv({ cls: 'tw-card tw-chart-card tw-home-trend-card' });
    this.updateHomeTrendCard();
    this.loadHomeTrendData(false);
    // 监听侧边栏折叠/展开、窗口缩放引起的宽度变化，按 1:1 宽度重绘避免拉伸变形
    if (this._homeTrendResizeObs) {
      try { this._homeTrendResizeObs.disconnect(); } catch (e) {}
    }
    if (typeof ResizeObserver !== 'undefined') {
      let rafId = 0;
      this._homeTrendResizeObs = new ResizeObserver(() => {
        const wrap = this.homeTrendCardEl?.querySelector('.tw-chart-svg-wrap');
        const w = wrap ? wrap.clientWidth : 0;
        if (w > 60 && Math.abs(w - (this._homeTrendW || 0)) > 4) {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => { rafId = 0; this.updateHomeTrendCard(); });
        }
      });
      this._homeTrendResizeObs.observe(this.homeTrendCardEl);
    }
  }

  updateHomeTrendCard() {
    if (!this.homeTrendCardEl || !this.homeTrendCardEl.isConnected) return;
    const issues = this.getHomeTrendIssues();
    const timeRange = this.getHomeTrendTimeRange();
    // 按容器实际像素宽度 1:1 渲染 viewBox，避免侧栏收起时 SVG 非等比拉伸导致文字/数据点变形
    const H = 120;
    const prevWrap = this.homeTrendCardEl.querySelector('.tw-chart-svg-wrap');
    const W = (prevWrap && prevWrap.clientWidth > 60) ? prevWrap.clientWidth : (this._homeTrendW || 500);
    this._homeTrendW = W;
    let trendData = this.calculateHomeTrendData(issues, timeRange, W, H);
    const svgHtml = this.generateHomeTrendSvg(trendData);

    this.homeTrendCardEl.innerHTML = `
      <div class="tw-card-header tw-trend-header">
        <div class="tw-trend-title-left">
          <span>缺陷发现与收敛走势</span>
        </div>
        <div class="tw-trend-controls-right">
          <select class="tw-trend-range-select" title="切换时间范围">
            <option value="week" ${timeRange === 'week' ? 'selected' : ''}>周</option>
            <option value="month" ${timeRange === 'month' ? 'selected' : ''}>月</option>
            <option value="quarter" ${timeRange === 'quarter' ? 'selected' : ''}>季</option>
            <option value="year" ${timeRange === 'year' ? 'selected' : ''}>年</option>
          </select>
          <button class="tw-trend-refresh-btn" id="btnRefreshHomeTrend" title="刷新 Jira 数据">${getIconPark('refresh', 12)}</button>
        </div>
      </div>
      <div class="tw-chart-svg-wrap" style="position: relative;">
        ${svgHtml}
        <div class="tw-trend-tooltip" style="opacity: 0; display: none;"></div>
      </div>
      <div class="tw-trend-footer">
        <div class="tw-trend-legend">
          <span><span style="color: var(--g-red, #EF4444); font-weight:bold;">--</span> 新增Bug</span>
          <span><span style="color: var(--g-green, #10B981); font-weight:bold;">—</span> 闭环解决</span>
        </div>
      </div>
    `;

    const rangeSelect = this.homeTrendCardEl.querySelector('.tw-trend-range-select');
    if (rangeSelect) {
      rangeSelect.onchange = () => {
        const range = rangeSelect.value;
        if (range) {
          this.saveHomeTrendTimeRange(range);
          this.updateHomeTrendCard();
        }
      };
    }

    const refreshBtn = this.homeTrendCardEl.querySelector('#btnRefreshHomeTrend');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        this.loadHomeTrendData(true).finally(() => {
          refreshBtn.classList.remove('spinning');
        });
      };
    }

    const svgWrap = this.homeTrendCardEl.querySelector('.tw-chart-svg-wrap');
    // 首次渲染时布局可能未完成，按最终实际宽度校正一次并重绘 SVG
    if (svgWrap) {
      const measured = svgWrap.clientWidth;
      if (measured > 60 && Math.abs(measured - W) > 4) {
        this._homeTrendW = measured;
        trendData = this.calculateHomeTrendData(issues, timeRange, measured, H);
        const svgEl = svgWrap.querySelector('svg');
        if (svgEl) svgEl.outerHTML = this.generateHomeTrendSvg(trendData);
      }
    }
    const tooltipEl = this.homeTrendCardEl.querySelector('.tw-trend-tooltip');
    const guideline = this.homeTrendCardEl.querySelector('#twTrendGuideline');
    const allDots = this.homeTrendCardEl.querySelectorAll('.tw-trend-hit');

    if (svgWrap && tooltipEl && trendData.xCoords && trendData.xCoords.length > 0) {
      const { xCoords, labels, createdSeries, doneSeries, newSeries, dateDetails } = trendData;
      const chartW = trendData.W || 500;

      svgWrap.onmousemove = (e) => {
        const rect = svgWrap.getBoundingClientRect();
        if (rect.width <= 0) return;
        const mouseSvgX = ((e.clientX - rect.left) / rect.width) * chartW;

        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < xCoords.length; i++) {
          const diff = Math.abs(xCoords[i] - mouseSvgX);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        const ptX = xCoords[closestIdx];
        const cVal = createdSeries[closestIdx];
        const dVal = doneSeries[closestIdx];
        const oVal = Math.max(0, cVal - dVal);
        const ptRate = cVal > 0 ? Math.round((dVal / cVal) * 100) : 100;
        const nVal = (newSeries && newSeries[closestIdx] !== undefined) ? newSeries[closestIdx] : 0;
        // 新增行文案随分桶粒度自适应：周=当日、月/季=当周、年=当月
        const newLabel = timeRange === 'week' ? '当日新增:' : (timeRange === 'year' ? '当月新增:' : '当周新增:');
        const dtTitle = (dateDetails && dateDetails[closestIdx]) || labels[closestIdx] || '';

        if (guideline) {
          guideline.setAttribute('x1', String(ptX));
          guideline.setAttribute('x2', String(ptX));
          guideline.style.opacity = '0.75';
        }

        allDots.forEach(dot => {
          const idx = parseInt(dot.dataset.idx, 10);
          if (idx === closestIdx) {
            dot.setAttribute('r', '7');
            dot.classList.add('active-dot');
          } else {
            dot.setAttribute('r', '7');
            dot.classList.remove('active-dot');
          }
        });

        tooltipEl.innerHTML = `
          <div class="tw-tt-header">${escapeHtml(dtTitle)}</div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator red"></span>
            <span class="tw-tt-label">累计发现:</span>
            <span class="tw-tt-val">${cVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator blue"></span>
            <span class="tw-tt-label">${newLabel}</span>
            <span class="tw-tt-val">${nVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator green"></span>
            <span class="tw-tt-label">闭环解决:</span>
            <span class="tw-tt-val">${dVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator orange"></span>
            <span class="tw-tt-label">待解决:</span>
            <span class="tw-tt-val">${oVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row tw-tt-footer-row">
            <span class="tw-tt-label">当期收敛率</span>
            <span class="tw-tt-val" style="color: ${ptRate >= 70 ? '#10B981' : (ptRate >= 40 ? '#F59E0B' : '#EF4444')};">${ptRate}%</span>
          </div>
        `;

        tooltipEl.style.display = 'block';
        const ttWidth = tooltipEl.offsetWidth || 145;
        const pxX = (ptX / chartW) * rect.width;
        // 浮窗放到数据点背向曲线的一侧，避免遮挡当前点与其曲线段
        let leftPos = pxX > rect.width / 2 ? (pxX - ttWidth - 14) : (pxX + 14);
        if (leftPos < 6) leftPos = 6;
        if (leftPos + ttWidth > rect.width - 6) leftPos = rect.width - ttWidth - 6;

        tooltipEl.style.left = `${leftPos}px`;
        tooltipEl.style.top = `6px`;
        tooltipEl.style.opacity = '1';
      };

      svgWrap.onmouseleave = () => {
        if (guideline) guideline.style.opacity = '0';
        if (tooltipEl) {
          tooltipEl.style.opacity = '0';
          tooltipEl.style.display = 'none';
        }
        allDots.forEach(dot => {
          dot.setAttribute('r', '3');
          dot.classList.remove('active-dot');
        });
      };
    }
  }

  // 与任务页 JiraPlatformView.getProjectJql 保持完全一致的口径（项目筛选 + 时间筛选同源），保证统计实时对应
  buildHomeTrendJql() {
    let project = 'all';
    let timeRange = 'all';
    if (this.jiraPlatform) {
      project = this.jiraPlatform.activeProject || 'all';
      timeRange = this.jiraPlatform.activeTimeRange || 'all';
    } else {
      try {
        if (typeof localStorage !== 'undefined') {
          project = localStorage.getItem('tabonkb-jira-project') || 'all';
          timeRange = localStorage.getItem('tabonkb-jira-timerange') || 'all';
        }
      } catch (e) {}
    }
    let jql = '(resolution = Unresolved OR resolutiondate >= -30d) AND (assignee = currentUser() OR watcher = currentUser() OR reporter = currentUser())';
    if (project && project !== 'all') jql += ` AND project = "${project}"`;
    const days = { week: 7, month: 30, quarter: 90, year: 365 }[timeRange];
    if (days) jql += ` AND updated >= -${days}d`;
    return `${jql} ORDER BY updated DESC`;
  }

  async loadHomeTrendData(forceRefresh = false) {
    const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
    const jiraService = plugin?.jiraService;
    if (!jiraService) return;

    try {
      // 复用任务页的主缓存链路（searchIssues），任一侧刷新两侧数据同步
      const config = typeof jiraService.getConfig === 'function' ? jiraService.getConfig() : null;
      if (config) config.jql = this.buildHomeTrendJql();
      const res = await jiraService.searchIssues(forceRefresh);
      const issues = res?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        this.homeTrendIssues = issues;
        this.updateHomeTrendCard();
        if (this.homeHeatCardEl) {
          this.updateHomeHeatmapCard();
        }
      }
    } catch (e) {
      console.warn('加载首页缺陷走势数据异常:', e);
    }
  }

  // ==========================================================================
  // Home Tab Heatmap Analytics Engine (Multi-Source Engineering Aggregator)
  // ==========================================================================

  getSavedHeatmapDimension() {
    try {
      const saved = localStorage.getItem('tabonkb-home-heat-dim');
      if (['all', 'assets', 'tuning', 'ai'].includes(saved)) return saved;
    } catch (e) {}
    return 'all';
  }

  saveHeatmapDimension(dim) {
    this.heatmapDimension = dim;
    try {
      localStorage.setItem('tabonkb-home-heat-dim', dim);
    } catch (e) {}
  }

  loadAiOplogEvents() {
    const now = Date.now();
    if (this._aiOplogCache && this._aiOplogCache.events && (now - this._aiOplogCache.at) < 15000) {
      return this._aiOplogCache.events;
    }
    const eventsByDate = {};
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (!vaultPath) return eventsByDate;
      const oplogDir = path.join(vaultPath, '99-Meta', '07-AI-Oplog');
      if (!fs.existsSync(oplogDir)) return eventsByDate;

      const files = fs.readdirSync(oplogDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const fullPath = path.join(oplogDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('|')) continue;
          const m = trimmed.match(/^\\|\\s*(\\d{4}-\\d{2}-\\d{2})[T\\s](\\d{2}:\\d{2})?\\s*\\|\\s*([^|]+)\\|\\s*([^|]+)\\|\\s*([^|]+)\\|\\s*([^|]+)/);
          if (m) {
            const dateKey = m[1];
            const time = m[2] || '';
            const level = m[3].trim();
            const action = m[4].trim();
            const target = m[5].trim();
            const detail = m[6].trim();
            if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
            eventsByDate[dateKey].push({
              type: 'ai',
              date: dateKey,
              time,
              level,
              action,
              title: target,
              detail
            });
          }
        }
      }
    } catch (e) {
      console.warn('[TabonKB Workbench] loadAiOplogEvents error:', e);
    }
    this._aiOplogCache = { at: now, events: eventsByDate };
    return eventsByDate;
  }

  getKnowledgeAssetEvents() {
    const eventsByDate = {};
    const seenPaths = new Set();
    const docs = Array.isArray(this.realDocs) ? this.realDocs : [];
    for (const doc of docs) {
      if (!doc || !doc.path) continue;
      if (doc.path.startsWith('99-Meta/') || doc.path.startsWith('.obsidian/')) continue;
      seenPaths.add(doc.path);
      let dateKey = null;
      const filename = (doc.path.split('/').pop() || '');
      const matchDate = filename.match(/(20\\d{2})[-_]?(\\d{2})[-_]?(\\d{2})/);
      if (matchDate) {
        dateKey = `${matchDate[1]}-${matchDate[2]}-${matchDate[3]}`;
      } else if (doc.mtime) {
        const d = new Date(doc.mtime);
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (dateKey) {
        if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
        eventsByDate[dateKey].push({
          type: 'assets',
          date: dateKey,
          title: doc.title || filename,
          path: doc.path,
          module: doc.module || 'General',
          doctype: doc.type || 'DOC',
          detail: doc.summary || ''
        });
      }
    }
    try {
      if (typeof this.app?.vault?.getFiles === 'function') {
        const files = this.app.vault.getFiles() || [];
        for (const file of files) {
          if (!file || !file.path || seenPaths.has(file.path)) continue;
          if (file.path.startsWith('99-Meta/') || file.path.startsWith('.obsidian/') || file.path.startsWith('.git/')) continue;
          if (file.extension !== 'pdf') continue;
          seenPaths.add(file.path);
          let dateKey = null;
          const matchDate = file.name.match(/(20\\d{2})[-_]?(\\d{2})[-_]?(\\d{2})/);
          if (matchDate) {
            dateKey = `${matchDate[1]}-${matchDate[2]}-${matchDate[3]}`;
          } else if (file.stat?.mtime) {
            const d = new Date(file.stat.mtime);
            dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          if (dateKey) {
            if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
            eventsByDate[dateKey].push({
              type: 'assets',
              date: dateKey,
              title: file.basename || file.name,
              path: file.path,
              module: 'Datasheet',
              doctype: 'PDF',
              detail: file.path
            });
          }
        }
      }
    } catch (e) {}
    return eventsByDate;
  }

  getJiraTuningEvents() {
    const eventsByDate = {};
    const issues = this.getHomeTrendIssues();
    if (!Array.isArray(issues) || issues.length === 0) return eventsByDate;

    const toDateKey = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isDone = (iss) => {
      const cat = (iss.statusCategory || '').toLowerCase();
      const st = (iss.status || '').toLowerCase();
      return cat === 'done' || st.includes('已解决') || st.includes('解决') || st.includes('关闭') || st.includes('resolved') || st.includes('closed');
    };

    for (const iss of issues) {
      const key = iss.key || '';
      const title = iss.summary || key;
      const status = iss.status || '';

      const createdKey = toDateKey(iss.rawCreated || iss.created);
      const resolvedKey = toDateKey(iss.rawResolved);
      const updatedKey = toDateKey(iss.rawUpdated || iss.updated);

      if (createdKey) {
        if (!eventsByDate[createdKey]) eventsByDate[createdKey] = [];
        eventsByDate[createdKey].push({
          type: 'tuning',
          action: 'created',
          date: createdKey,
          key,
          title,
          status,
          detail: '新增缺陷'
        });
      }

      if (resolvedKey && resolvedKey !== createdKey) {
        if (!eventsByDate[resolvedKey]) eventsByDate[resolvedKey] = [];
        eventsByDate[resolvedKey].push({
          type: 'tuning',
          action: 'resolved',
          date: resolvedKey,
          key,
          title,
          status: '已解决',
          detail: '闭环解决'
        });
      } else if (isDone(iss) && updatedKey && updatedKey !== createdKey) {
        if (!eventsByDate[updatedKey]) eventsByDate[updatedKey] = [];
        eventsByDate[updatedKey].push({
          type: 'tuning',
          action: 'resolved',
          date: updatedKey,
          key,
          title,
          status: '已解决',
          detail: '闭环解决'
        });
      }
    }
    return eventsByDate;
  }

  calculateHeatmapData() {
    const assetEvents = this.getKnowledgeAssetEvents();
    const tuningEvents = this.getJiraTuningEvents();
    const aiEvents = this.loadAiOplogEvents();
    // 「AI 协同」维度合流 Agent 用量账本（跨源: 会话历史 + pi jsonl + DSH），
    // 与 Oplog 记录并存展示——Oplog 记录代码改动，用量记录对话调机，非同源不去重
    const aiUsageEvents = (typeof this.collectAgentUsageDailyEvents === 'function') ? this.collectAgentUsageDailyEvents() : {};
    for (const [dk, evs] of Object.entries(aiUsageEvents)) {
      aiEvents[dk] = (aiEvents[dk] || []).concat(evs);
    }

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    const todayDayOfWeek = todayDate.getDay();

    const currentWeekStart = new Date(todayDate);
    currentWeekStart.setDate(todayDate.getDate() - todayDayOfWeek);

    const calStart = new Date(currentWeekStart);
    calStart.setDate(currentWeekStart.getDate() - 19 * 7);

    const daysMap = {};
    const cells = [];
    const monthCols = [];
    let lastMonth = -1;

    let totalInRange = 0;
    let activeDaysCount = 0;

    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let w = 0; w < 20; w++) {
      const colStartDate = new Date(calStart);
      colStartDate.setDate(calStart.getDate() + w * 7);
      const colMonth = colStartDate.getMonth() + 1;
      let monthLabel = '';
      if (colMonth !== lastMonth) {
        monthLabel = `${colMonth}月`;
        lastMonth = colMonth;
      }
      monthCols.push({ weekIdx: w, label: monthLabel });

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(calStart);
        cellDate.setDate(calStart.getDate() + (w * 7 + d));
        const dateKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        const isFuture = cellDate > todayDate;
        const isToday = (dateKey === todayKey);

        const assets = assetEvents[dateKey] || [];
        const tuning = tuningEvents[dateKey] || [];
        const ai = aiEvents[dateKey] || [];

        let count = 0;
        if (this.heatmapDimension === 'assets') {
          count = assets.length;
        } else if (this.heatmapDimension === 'tuning') {
          count = tuning.length;
        } else if (this.heatmapDimension === 'ai') {
          count = ai.length;
        } else {
          count = assets.length + tuning.length + ai.length;
        }

        let level = 0;
        if (!isFuture && count > 0) {
          if (count <= 2) level = 1;
          else if (count <= 4) level = 2;
          else if (count <= 7) level = 3;
          else level = 4;
        }

        if (!isFuture) {
          totalInRange += count;
          if (count > 0) activeDaysCount++;
        }

        const dayData = {
          dateKey,
          dayOfWeek: d,
          dayOfWeekName: weekdayNames[d],
          isFuture,
          isToday,
          count,
          level,
          assets,
          tuning,
          ai
        };

        daysMap[dateKey] = dayData;
        cells.push(dayData);
      }
    }

    let currentStreak = 0;
    let checkDate = new Date(todayDate);
    const todayCount = (daysMap[todayKey]?.count || 0);
    if (todayCount === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const k = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (daysMap[k] && daysMap[k].count > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      cells,
      daysMap,
      monthCols,
      totalInRange,
      activeDaysCount,
      currentStreak,
      todayKey
    };
  }

  renderHomeHeatmapCard(parentEl) {
    this.homeHeatCardEl = parentEl.createDiv({ cls: 'tw-card tw-chart-card tw-home-heat-card' });
    this.updateHomeHeatmapCard();
  }

  updateHomeHeatmapCard() {
    if (!this.homeHeatCardEl || !this.homeHeatCardEl.isConnected) return;
    const data = this.calculateHeatmapData();
    const dim = this.heatmapDimension || 'all';

    let summaryText = `近 20 周累计 ${data.totalInRange} 次研发沉淀 · 活跃 ${data.activeDaysCount} 天`;
    if (data.currentStreak > 0) {
      summaryText += ` (连续 ${data.currentStreak} 天)`;
    }

    const monthRowHtml = data.monthCols.map(col => `
      <div class="tw-heat-month-col" title="${col.label || ''}">${col.label || ''}</div>
    `).join('');

    const cellsHtml = data.cells.map(c => {
      let cls = `tw-heat-cell tw-heat-l${c.level}`;
      if (c.isToday) cls += ' tw-heat-today';
      if (c.isFuture) cls += ' tw-heat-future';

      let tip = `${c.dateKey} (${c.dayOfWeekName})`;
      if (c.count === 0) {
        tip += ' · 无研发产出';
      } else {
        const parts = [];
        if (c.assets.length) parts.push(`${c.assets.length} 文档`);
        if (c.tuning.length) parts.push(`${c.tuning.length} 调机`);
        if (c.ai.length) parts.push(`${c.ai.length} AI流水`);
        tip += ` · ${c.count} 次产出 (${parts.join(', ')})`;
      }

      return `<div class="${cls}" data-date="${c.dateKey}" title="${tip}"></div>`;
    }).join('');

    this.homeHeatCardEl.innerHTML = `
      <div class="tw-card-header tw-heat-header">
        <span>研发调机与资产沉淀热力</span>
        <div class="tw-heat-controls-right">
          <select class="tw-trend-range-select tw-heat-dim-select" title="切换统计维度">
            <option value="all" ${dim === 'all' ? 'selected' : ''}>全部综合</option>
            <option value="assets" ${dim === 'assets' ? 'selected' : ''}>知识资产</option>
            <option value="tuning" ${dim === 'tuning' ? 'selected' : ''}>研发调机</option>
            <option value="ai" ${dim === 'ai' ? 'selected' : ''}>AI 协同</option>
          </select>
        </div>
      </div>
      <div class="tw-heatmap-content">
        <div class="tw-heatmap-wrap">
          <div class="tw-heatmap-month-row">
            <div class="tw-heatmap-weekday-spacer"></div>
            <div class="tw-heatmap-months">
              ${monthRowHtml}
            </div>
          </div>
          <div class="tw-heatmap-main-row">
            <div class="tw-heatmap-weekdays">
              <span></span>
              <span>一</span>
              <span></span>
              <span>三</span>
              <span></span>
              <span>五</span>
              <span></span>
            </div>
            <div class="tw-heatmap-grid">
              ${cellsHtml}
            </div>
          </div>
        </div>
      </div>
      <div class="tw-heat-footer">
        <span class="tw-heat-summary-text">${summaryText}</span>
        <div class="tw-heat-legend">
          <span>少</span>
          <span class="tw-heat-legend-cell tw-heat-l0"></span>
          <span class="tw-heat-legend-cell tw-heat-l1"></span>
          <span class="tw-heat-legend-cell tw-heat-l2"></span>
          <span class="tw-heat-legend-cell tw-heat-l3"></span>
          <span class="tw-heat-legend-cell tw-heat-l4"></span>
          <span>多</span>
        </div>
      </div>
    `;

    const dimSelect = this.homeHeatCardEl.querySelector('.tw-heat-dim-select');
    if (dimSelect) {
      dimSelect.onchange = () => {
        this.saveHeatmapDimension(dimSelect.value);
        this.closeHeatmapPopover();
        this.updateHomeHeatmapCard();
      };
    }

    const cellEls = this.homeHeatCardEl.querySelectorAll('.tw-heat-cell');
    cellEls.forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const dateKey = el.dataset.date;
        if (!dateKey) return;
        const cellData = data.daysMap[dateKey];
        if (!cellData || cellData.isFuture) return;
        this.openHeatmapPopover(cellData, el);
      };
    });
  }

  closeHeatmapPopover() {
    if (!this.homeHeatCardEl) return;
    const existing = this.homeHeatCardEl.querySelector('.tw-heat-popover');
    if (existing) existing.remove();
    if (this._selectedHeatCell) {
      this._selectedHeatCell.classList.remove('tw-heat-selected');
      this._selectedHeatCell = null;
    }
    if (this._heatDocClickBound) {
      window.removeEventListener('click', this._heatDocClickBound);
      this._heatDocClickBound = null;
    }
  }

  openHeatmapPopover(cellData, targetEl) {
    this.closeHeatmapPopover();

    this._selectedHeatCell = targetEl;
    targetEl.classList.add('tw-heat-selected');

    const popover = document.createElement('div');
    popover.className = 'tw-heat-popover';

    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const cardRect = this.homeHeatCardEl.getBoundingClientRect();
    const cellRect = targetEl.getBoundingClientRect();
    const relLeft = cellRect.left - cardRect.left;

    if (relLeft < cardRect.width / 2) {
      popover.style.left = `${Math.max(12, Math.min(cardRect.width - 390, relLeft - 10))}px`;
      popover.style.right = 'auto';
    } else {
      const relRight = cardRect.width - (relLeft + cellRect.width);
      popover.style.right = `${Math.max(12, Math.min(cardRect.width - 390, relRight - 10))}px`;
      popover.style.left = 'auto';
    }
    popover.style.top = '40px';

    const hasItems = (cellData.count > 0);

    let sectionsHtml = '';
    if (!hasItems) {
      sectionsHtml = '<div class="tw-heat-empty-tip">该日暂无沉淀记录</div>';
    } else {
      if (cellData.assets && cellData.assets.length > 0) {
        sectionsHtml += `
          <div class="tw-heat-section">
            <div class="tw-heat-section-title">
              <span>📝 知识资产沉淀 (${cellData.assets.length})</span>
            </div>
            <div class="tw-heat-items-list">
              ${cellData.assets.map(item => `
                <div class="tw-heat-item tw-heat-item-doc" data-path="${escapeHtml(item.path)}" title="点击在知识库中打开">
                  <span class="tw-heat-item-tag doc">[${escapeHtml(item.doctype || 'DOC')}]</span>
                  <span class="tw-heat-item-name">${escapeHtml(item.title)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (cellData.tuning && cellData.tuning.length > 0) {
        sectionsHtml += `
          <div class="tw-heat-section">
            <div class="tw-heat-section-title">
              <span>🐞 研发调机排障 (${cellData.tuning.length})</span>
            </div>
            <div class="tw-heat-items-list">
              ${cellData.tuning.map(item => `
                <div class="tw-heat-item tw-heat-item-jira" data-key="${escapeHtml(item.key)}">
                  <span class="tw-heat-item-tag jira">[${escapeHtml(item.key)}]</span>
                  <span class="tw-heat-item-name" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
                  <span class="tw-heat-item-status">${escapeHtml(item.status || '')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (cellData.ai && cellData.ai.length > 0) {
        sectionsHtml += `
          <div class="tw-heat-section">
            <div class="tw-heat-section-title">
              <span>🤖 AI 协同流水 (${cellData.ai.length})</span>
            </div>
            <div class="tw-heat-items-list">
              ${cellData.ai.map(item => `
                <div class="tw-heat-item tw-heat-item-ai" title="${escapeHtml(item.detail)}">
                  <span class="tw-heat-item-tag ai">[${escapeHtml(item.level || 'L1')}]</span>
                  <span class="tw-heat-item-name">${escapeHtml(item.title || item.detail)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    popover.innerHTML = `
      <div class="tw-heat-popover-header">
        <div class="tw-heat-popover-title">
          <span class="tw-heat-popover-date">${cellData.dateKey}</span>
          <span class="tw-heat-popover-weekday">${cellData.dayOfWeekName}</span>
          <span class="tw-heat-popover-badge">${cellData.count} 项产出</span>
        </div>
        <button class="tw-heat-popover-close" title="关闭 (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="tw-heat-popover-body">
        ${sectionsHtml}
      </div>
    `;

    popover.querySelectorAll('.tw-heat-item-doc').forEach(itemEl => {
      itemEl.onclick = (e) => {
        e.stopPropagation();
        const docPath = itemEl.dataset.path;
        if (!docPath) return;
        try {
          const file = this.app?.vault?.getAbstractFileByPath(docPath);
          if (file) {
            this.app?.workspace?.getLeaf(false)?.openFile(file);
          } else {
            this.app?.workspace?.openLinkText(docPath, '', false);
          }
        } catch (err) {
          console.warn('[TabonKB Workbench] Failed to open file:', docPath, err);
        }
      };
    });

    const closeBtn = popover.querySelector('.tw-heat-popover-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.closeHeatmapPopover();
      };
    }

    this.homeHeatCardEl.appendChild(popover);

    setTimeout(() => {
      this._heatDocClickBound = (e) => {
        if (!this.homeHeatCardEl) return;
        const currentPopover = this.homeHeatCardEl.querySelector('.tw-heat-popover');
        if (!currentPopover) return;
        if (!currentPopover.contains(e.target) && !e.target.closest('.tw-heat-cell')) {
          this.closeHeatmapPopover();
        }
      };
      window.addEventListener('click', this._heatDocClickBound);
    }, 20);
  }

  // ==========================================================================
  // Home Tab Agent Usage Analytics (多 Agent Token 用量额度细分统计)
  // ==========================================================================

  getAgentUsageRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('tabonkb-agent-usage-range');
        if (r === 'today' || r === 'week' || r === 'month' || r === 'all') return r;
      }
    } catch (e) {}
    return 'week';
  }

  saveAgentUsageRange(range) {
    this.agentUsageRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-agent-usage-range', range);
      }
    } catch (e) {}
  }

  getAgentUsageMetric() {
    try {
      if (typeof localStorage !== 'undefined') {
        const m = localStorage.getItem('tabonkb-agent-usage-metric');
        if (m === 'tokens' || m === 'net' || m === 'tools') return m;
      }
    } catch (e) {}
    return 'tokens';
  }

  saveAgentUsageMetric(m) {
    this.agentUsageMetric = m;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('tabonkb-agent-usage-metric', m); } catch (e) {}
  }

  fmtUsageTok(n) {
    const v = Number(n) || 0;
    const trim = (num, div) => {
      const s = (num / div).toFixed(1);
      return s.endsWith('.0') ? s.slice(0, -2) : s;
    };
    if (v >= 1000000) return trim(v, 1000000) + 'M';
    if (v >= 1000) return trim(v, 1000) + 'k';
    return String(v);
  }

  // 剥离模型名中的思考档位后缀 → 纯净 modelName; 'None'/null/'' 归并默认
  normalizeModelName(raw, agentId) {
    let name = String(raw || '').trim();
    name = name.replace(/\\s*[·•]\\s*(极高推理|高推理|中推理|低推理|关闭思考|关闭|极高|高|中|低)\\s*$/u, '');
    name = name.replace(/\\s*\\((x?high|medium|low|max|off)\\)\\s*$/i, '');
    name = name.trim();
    if (!name || /^(none|null|undefined|未标注模型|未知)$/i.test(name)) return '默认模型';
    // 同物理模型大小写/分隔符/展示名别名归并：key 为小写 + [._空格] 统一为 -（表内 key 同形）
    const ALIASES = {
      'deepseek-flash': 'DeepSeek V4 Flash',
      'deepseek-v4-flash': 'DeepSeek V4 Flash',
      'deepseek-v4': 'DeepSeek V4',
      'deepseek': 'DeepSeek V4',
      'gemini-3-8-flash': 'Gemini 3.8 Flash',
      'gemini-3-8-flash-high': 'Gemini 3.8 Flash',
      'gpt-6-1-sol': 'GPT-6.1 Sol',
      'gpt-6-sol': 'GPT-6 Sol',
      'gpt-6-astra': 'GPT-6 Astra',
      'gpt-5-6-sol': 'GPT-5.6 Sol',
      'gpt-5-6-luna': 'GPT-5.6 Luna',
      'claude-sonnet-5-5': 'Claude Sonnet 5.5',
      'claude-sonnet-5': 'Claude Sonnet 5',
      'claude-sonnet-4-6': 'Claude Sonnet 4.6',
      'claude-sonnet-4-5': 'Claude Sonnet 4.5',
      'claude-opus-5-5': 'Claude Opus 5.5',
      'glm-5-3': 'GLM-5.3',
      'muse-spark-1-3-contributor': 'Muse Spark 1.3'
    };
    // provider 前缀（kiro/openrouter 等）仅在剥除后能命中别名时才剥，避免 swe-2 这类独立名被截断
    const keyFull = name.toLowerCase().replace(/[.\\s_]+/g, '-');
    const keyStripped = keyFull.replace(/^[a-z0-9-]+\\//i, '');
    if (ALIASES[keyFull]) return ALIASES[keyFull];
    if (ALIASES[keyStripped]) return ALIASES[keyStripped];
    return name;
  }

  // 内置离线模型定价表 (USD / 1M Tokens)
  _auModelPricing(modelKey) {
    const TABLE = {
      'deepseek-v4-flash': { in: 0.14, out: 0.28, cacheRead: 0.014, cacheWrite: 0.175 },
      'deepseek-v4':       { in: 0.55, out: 2.19, cacheRead: 0.055, cacheWrite: 0.69 },
      'deepseek':          { in: 0.55, out: 2.19, cacheRead: 0.055, cacheWrite: 0.69 },
      'gpt-6.1':           { in: 1.25, out: 10.0, cacheRead: 0.125, cacheWrite: 1.56 },
      'gpt-6':             { in: 1.25, out: 10.0, cacheRead: 0.125, cacheWrite: 1.56 },
      'gpt-5':             { in: 1.25, out: 10.0, cacheRead: 0.125, cacheWrite: 1.56 },
      'claude-opus':       { in: 15.0, out: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
      'opus':              { in: 15.0, out: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
      'claude-sonnet':     { in: 3.0, out: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
      'sonnet':            { in: 3.0, out: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
      'claude':            { in: 3.0, out: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
      'gemini-3.8-flash':  { in: 0.30, out: 2.5, cacheRead: 0.03, cacheWrite: 0.375 },
      'gemini.*flash':     { in: 0.30, out: 2.5, cacheRead: 0.03, cacheWrite: 0.375 },
      'gemini':            { in: 1.25, out: 10.0, cacheRead: 0.125, cacheWrite: 1.56 },
      'glm':               { in: 0.60, out: 2.2, cacheRead: 0.06, cacheWrite: 0.75 },
      'qwen':              { in: 0.40, out: 1.2, cacheRead: 0.04, cacheWrite: 0.5 }
    };
    const k = String(modelKey || '').toLowerCase();
    for (const key of Object.keys(TABLE)) {
      if (key.includes('*')) {
        const re = new RegExp('^' + key.replace(/\\*/g, '.*') + '$');
        if (re.test(k)) return TABLE[key];
      } else if (k.includes(key)) return TABLE[key];
    }
    return { in: 1.0, out: 3.0, cacheRead: 0.1, cacheWrite: 1.25 };
  }

  _auHomeDir() {
    try { return require('os').homedir(); } catch (e) { return process.env.USERPROFILE || ''; }
  }

  // pi 会话目录编码规则: 盘符冒号→-, 路径分隔符→-, 首尾包裹 --
  _auPiSessionDir() {
    try {
      const vault = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (!vault) return null;
      const enc = '--' + String(vault).replace(/:/g, '-').replace(/[\\\\/]/g, '-') + '--';
      return require('path').join(this._auHomeDir(), '.pi', 'agent', 'sessions', enc);
    } catch (e) { return null; }
  }

  // 解析单个 pi .jsonl: 按 user 消息分组为「用户回合组」，返回组级聚合记录
  _auParsePiJsonl(fp) {
    const groups = [];
    try {
      const fs = require('fs');
      const lines = fs.readFileSync(fp, 'utf8').split('\\n');
      let cur = null;
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith('{')) continue;
        let o; try { o = JSON.parse(t); } catch (_) { continue; }
        if (o.type !== 'message' || !o.message) continue;
        const m = o.message;
        const ts = o.timestamp ? Date.parse(o.timestamp) : 0;
        if (m.role === 'user') {
          cur = { agentId: 'pi', grpKey: fp + '|' + (o.id || ts), endTs: ts, records: [], model: null };
          groups.push(cur);
          continue;
        }
        if (m.role !== 'assistant') continue;
        if (!cur) { cur = { agentId: 'pi', grpKey: fp + '|g0', endTs: ts, records: [], model: null }; groups.push(cur); }
        const u = m.usage || {};
        const inp = Math.max(0, u.input ?? u.inputTokens ?? 0);
        const out = Math.max(0, u.output ?? u.outputTokens ?? 0);
        const cr  = Math.max(0, u.cacheRead ?? u.cacheReadTokens ?? 0);
        const cw  = Math.max(0, u.cacheWrite ?? u.cacheWriteTokens ?? 0);
        if (!(inp + out + cr + cw > 0)) { if (ts) cur.endTs = ts; continue; }
        let toolN = 0;
        if (Array.isArray(m.content)) {
          for (const p of m.content) { if (p && /tool_call|tool_use|toolCall/i.test(p.type || '')) toolN++; }
        }
        cur.records.push({
          ts, input: inp, output: out, cacheR: cr, cacheW: cw,
          reasoning: Math.max(0, u.reasoning ?? u.reasoningTokens ?? 0),
          total: Math.max(inp + out + cr + cw, u.totalTokens || u.total_tokens || 0),
          cost: Math.max(0, Number(u.cost?.total ?? 0)),
          model: m.model || null,
          toolN,
          est: false
        });
        if (ts) cur.endTs = ts;
      }
    } catch (_) {}
    return groups.filter(g => g.records.length > 0);
  }

  // 解析单个 DSH session_projcache 会话: identity.cwd 匹配当前工作区才纳入
  _auParseDshSession(fp, vaultNorm) {
    try {
      const fs = require('fs');
      const o = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const rec = o && o.record;
      if (!rec || !rec.identity) return [];
      const cwd = String(rec.identity.cwd || '').replace(/\\\\/g, '/').toLowerCase();
      if (vaultNorm && cwd && cwd !== vaultNorm) return [];
      const rows = rec.rows || {};
      const tu = rows.tokenUsage && rows.tokenUsage.val && rows.tokenUsage.val.totals;
      const ss = rows.sessionStats && rows.sessionStats.val;
      if (!tu && !ss) return [];
      const inp = Math.max(0, tu?.uncachedInputTokens || 0);
      const out = Math.max(0, tu?.outputTokens || 0);
      const cr  = Math.max(0, tu?.cacheReadTokens || 0);
      const cw  = Math.max(0, tu?.cacheWriteTokens || 0);
      const ts = (rows.sessionListMetadata && rows.sessionListMetadata.val && rows.sessionListMetadata.val.lastPromptAt) || rec.identity.createdAt || 0;
      const model = rows.modelSelection && rows.modelSelection.val && rows.modelSelection.val.lastUsed && rows.modelSelection.val.lastUsed.model;
      // 工具名 Top：从原始多帧 zstd 转录 ~/.dsh/sessions/<cwd编码>/<sid>/session.v4.jsonl.zstd 解析 tool/call
      const sessId = require('path').basename(fp, '.json');
      let toolMap = null;
      const tfp = this._auDshTranscriptPath(sessId);
      if (tfp) toolMap = this._auDshToolCounts(tfp);
      return [{
        agentId: 'dsh', grpKey: 'dsh|' + fp, ts,
        input: inp, output: out, cacheR: cr, cacheW: cw,
        reasoning: 0,
        total: inp + out + cr + cw,
        cost: 0, model: model || null,
        toolN: Math.max(0, ss?.steps || 0),
        toolMap: toolMap || null,
        turns: Math.max(1, ss?.turns || 1),
        durMs: Math.max(0, ss?.llmMs || 0),
        est: false
      }];
    } catch (_) { return []; }
  }

  // DSH 原始转录路径: ~/.dsh/sessions/<cwd编码>/<sessionId>/session.v4.jsonl.zstd
  _auDshTranscriptPath(sessId) {
    try {
      const fs = require('fs'), path = require('path');
      const vault = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (!vault || !sessId) return null;
      // DSH 目录编码与 pi 不同：盘符冒号直接删除（D:\\work → D-work），非替换为 -
      const enc = '--' + String(vault).replace(/:/g, '').replace(/[\\\\/]/g, '-') + '--';
      const fp = path.join(this._auHomeDir(), '.dsh', 'sessions', enc, sessId, 'session.v4.jsonl.zstd');
      return fs.existsSync(fp) ? fp : null;
    } catch (_) { return null; }
  }

  // 多帧 zstd 解压 + 逐行解析 tool/call → {工具名: 次数}; Node>=22.15 内置 zstd，缺能力时优雅返回空
  _auDshToolCounts(fp) {
    const map = {};
    try {
      const fs = require('fs'), zlib = require('zlib');
      if (typeof zlib.zstdDecompressSync !== 'function') return map;
      const raw = fs.readFileSync(fp);
      const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
      const offs = [0];
      let i = 4;
      while ((i = raw.indexOf(MAGIC, i)) > 0) { offs.push(i); i += 4; }
      const parts = [];
      for (let k = 0; k < offs.length; k++) {
        const end = k + 1 < offs.length ? offs[k + 1] : raw.length;
        try { parts.push(zlib.zstdDecompressSync(raw.slice(offs[k], end))); } catch (_) {}
      }
      for (const line of Buffer.concat(parts).toString('utf8').split('\\n')) {
        if (!line.includes('"tool/call"')) continue;
        try {
          const o = JSON.parse(line);
          let name = o && o.data && o.data.name;
          if (!name) continue;
          name = String(name).replace(/^mcp__[^_]+__/, '').replace(/^mcp__/, '');
          map[name] = (map[name] || 0) + 1;
        } catch (_) {}
      }
    } catch (_) {}
    return map;
  }

  // 跨源账本扫描: 10s 内存缓存 + 文件 mtimeMs 增量校验 + 首帧冷启动异步预热让出主线程
  _auLedgerScan(allowSyncColdScan = false) {
    const cache = this._auLedgerCache || (this._auLedgerCache = { at: 0, fileMtimes: {}, records: null, warming: false });
    const now = Date.now();
    if (cache.records && (now - cache.at) < 10000) return cache.records;
    // 首屏同步渲染阶段若磁盘账本尚未预热，先返回空集并用内存会话极速出首屏，后台异步完成 zstd/jsonl 扫描后自动刷新卡片
    if (!cache.records && !allowSyncColdScan && typeof window !== 'undefined' && this._isInitialRenderPass) {
      if (!cache.warming) {
        cache.warming = true;
        setTimeout(() => {
          try {
            this._auLedgerScan(true);
            if (this.agentUsageCardEl && this.agentUsageCardEl.isConnected) this.updateAgentUsageCard();
            if (this.homeHeatCardEl && this.homeHeatCardEl.isConnected) this.updateHomeHeatmapCard();
          } catch (_) {} finally {
            cache.warming = false;
          }
        }, 180);
      }
      return { piGroups: [], dsh: [] };
    }
    const out = { piGroups: [], dsh: [] };
    try {
      const fs = require('fs'); const path = require('path');
      const piDir = this._auPiSessionDir();
      if (piDir && fs.existsSync(piDir)) {
        for (const f of fs.readdirSync(piDir)) {
          if (!f.endsWith('.jsonl')) continue;
          const fp = path.join(piDir, f);
          let st; try { st = fs.statSync(fp); } catch (_) { continue; }
          const ck = 'pi:' + fp;
          const hit = cache.fileMtimes[ck];
          if (hit && hit.mtime === st.mtimeMs) { out.piGroups.push(...hit.records); continue; }
          const records = this._auParsePiJsonl(fp);
          cache.fileMtimes[ck] = { mtime: st.mtimeMs, records };
          out.piGroups.push(...records);
        }
      }
      const vaultNorm = String(this.app?.vault?.adapter?.basePath || '').replace(/\\\\/g, '/').toLowerCase();
      const dshDir = path.join(this._auHomeDir(), '.dsh', 'storages', 'session_projcache', 'sessions');
      if (fs.existsSync(dshDir)) {
        for (const f of fs.readdirSync(dshDir)) {
          if (!f.endsWith('.json')) continue;
          const fp = path.join(dshDir, f);
          let st; try { st = fs.statSync(fp); } catch (_) { continue; }
          const ck = 'dsh:' + fp;
          // 转录 zstd（工具名来源）mtime 一并纳入缓存键——转录晚于 projcache 更新时不致用陈旧工具计数
          let tm = 0;
          try {
            const tfp = this._auDshTranscriptPath(path.basename(f, '.json'));
            if (tfp) tm = fs.statSync(tfp).mtimeMs;
          } catch (_) {}
          const mkey = Math.max(st.mtimeMs, tm);
          const hit = cache.fileMtimes[ck];
          if (hit && hit.mtime === mkey) { out.dsh.push(...hit.records); continue; }
          const records = this._auParseDshSession(fp, vaultNorm);
          cache.fileMtimes[ck] = { mtime: mkey, records };
          out.dsh.push(...records);
        }
      }
    } catch (_) {}
    cache.at = now;
    cache.records = out;
    return out;
  }

  collectAgentUsageStats(rangeOverride) {
    const AGENT_NAMES = {
      pi: 'Pi Agent', antigravity: 'Antigravity', niceaigc: 'NiceAIGC',
      codex: 'Codex', gemini: 'Gemini', hermes: 'Hermes', dsh: 'Harness'
    };
    const range = rangeOverride || this.agentUsageRange || 'week';
    const now = Date.now();
    let startTs = 0;
    if (range === 'today') {
      const d0 = new Date();
      d0.setHours(0, 0, 0, 0);
      startTs = d0.getTime();
    } else if (range === 'week') {
      startTs = now - 7 * 86400000;
    } else if (range === 'month') {
      startTs = now - 30 * 86400000;
    }

    // ── 统一归一化消费记录 ──
    // {agentId, ts, in, out, cr, cw, reas, tot, net, cost, est, model, effort, durMs, toolN, toolNames, toolErrs, sessKey}
    const records = [];
    const histPiTs = [];   // 历史库中 pi 回合落库时间戳, 用于 jsonl 去重

    // 数据源 A: sessionManager 内存会话 (.chat-history.json)
    const sm = this.agentHub && this.agentHub.sessionManager;
    const agentsMap = (sm && sm.agents instanceof Map) ? sm.agents : null;
    if (agentsMap) {
      for (const [agentId, agent] of agentsMap.entries()) {
        for (const sess of (agent.sessions || [])) {
          for (const m of (sess.messages || [])) {
            if (!m || m.role !== 'assistant') continue;
            const u = m.usage;
            if (!u || !((u.totalTokens || 0) > 0 || (u.inputTokens || 0) > 0 || (u.outputTokens || 0) > 0)) continue;
            const ts = m.timestamp || 0;
            if (agentId === 'pi' && ts) histPiTs.push(ts);
            const inp = Math.max(0, u.inputTokens || 0);
            const out = Math.max(0, u.outputTokens || 0);
            const cr  = Math.max(0, u.cacheReadTokens || 0);
            const cw  = Math.max(0, u.cacheWriteTokens || 0);
            const tcs = Array.isArray(m.toolCalls) ? m.toolCalls : [];
            records.push({
              agentId, ts,
              in: inp, out, cr, cw,
              reas: Math.max(0, u.reasoningTokens || 0),
              tot: Math.max(inp + out + cr + cw, u.totalTokens || 0),
              net: Math.max(0, u.netBillableTokens ?? (inp + out + cw)),
              cost: Math.max(0, u.costUsd || 0),
              est: u.isEstimated === true,
              model: u.modelName || m.model || u.providerAndModel || null,
              effort: u.reasoningEffort || null,
              durMs: Math.max(0, m.duration || 0),
              toolN: tcs.length || (m.toolCount || 0),
              toolNames: tcs.map(t => t.toolName || t.name || 'tool'),
              toolErrs: tcs.filter(t => t.isError).length,
              sessKey: agentId + '|' + (sess.id || '')
            });
          }
        }
      }
    }

    // 数据源 B + C: 跨源账本 (mtime 增量缓存)
    const ledger = this._auLedgerScan();
    // B: pi 原生 jsonl —— 按用户回合组聚合; 与历史库重合的组整体跳过 (±15s 时间窗)
    for (const g of (ledger.piGroups || [])) {
      const endTs = g.endTs || 0;
      const dup = histPiTs.some(ht => Math.abs(ht - endTs) < 15000);
      if (dup) continue;
      const totIn = g.records.reduce((s, r) => s + r.input, 0);
      const totOut = g.records.reduce((s, r) => s + r.output, 0);
      const totCr = g.records.reduce((s, r) => s + r.cacheR, 0);
      const totCw = g.records.reduce((s, r) => s + r.cacheW, 0);
      const totReas = g.records.reduce((s, r) => s + r.reasoning, 0);
      const totCost = g.records.reduce((s, r) => s + r.cost, 0);
      const toolN = g.records.reduce((s, r) => s + r.toolN, 0);
      records.push({
        agentId: 'pi', ts: endTs,
        in: totIn, out: totOut, cr: totCr, cw: totCw, reas: totReas,
        tot: Math.max(totIn + totOut + totCr + totCw, g.records.reduce((s, r) => s + r.total, 0)),
        net: totIn + totOut + totCw,
        cost: totCost,
        est: false,
        model: g.records[g.records.length - 1].model,
        effort: null, durMs: 0,
        toolN, toolNames: [], toolErrs: 0,
        sessKey: 'pijsonl|' + g.grpKey
      });
    }
    // C: DSH 会话聚合记录
    for (const r of (ledger.dsh || [])) {
      records.push({
        agentId: 'dsh', ts: r.ts,
        in: r.input, out: r.output, cr: r.cacheR, cw: r.cacheW,
        reas: r.reasoning || 0,
        tot: r.total,
        net: r.input + r.output + r.cacheW,
        cost: r.cost || 0,
        est: r.est !== false,
        model: r.model, effort: null,
        durMs: r.durMs || 0,
        toolN: r.toolN || 0, toolNames: [], toolErrs: 0,
        toolMap: r.toolMap || null,
        sessKey: r.grpKey,
        extraTurns: Math.max(0, (r.turns || 1) - 1)
      });
    }

    // ── 聚合引擎 ──
    const inRange = records.filter(r => (r.ts || 0) >= startTs);
    const prevRange = range === 'all' ? [] : records.filter(r => (r.ts || 0) < startTs && (r.ts || 0) >= (startTs - (now - startTs)));
    const rowMap = new Map();
    const daily = new Map();   // dateKey → {in,out,cr,tot,net,tools,turns,cost}
    const hourly = new Map();  // hourKey → 同上 (today 视图 24h 桶)
    const bucketAg = new Map(); // 周期桶键(today→hourKey/其它→dayKey) → Map(agentId → acc)，Magpie 在线时用于合并未代理本地差额
    const totals = {
      tokens: 0, input: 0, output: 0, cache: 0, cacheW: 0, net: 0,
      turns: 0, sessions: 0, tools: 0, toolErrs: 0,
      costUsd: 0, savedByCacheUsd: 0, durMs: 0, durN: 0,
      exactTok: 0, estTok: 0
    };
    const sessSet = new Set();

    const dayKeyOf = (ts) => {
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const hourKeyOf = (ts) => {
      const d = new Date(ts);
      return dayKeyOf(ts) + 'T' + String(d.getHours()).padStart(2, '0');
    };

    for (const r of inRange) {
      let row = rowMap.get(r.agentId);
      if (!row) {
        row = {
          id: r.agentId, name: AGENT_NAMES[r.agentId] || r.agentId,
          tokens: 0, input: 0, output: 0, cache: 0, cacheW: 0, net: 0,
          turns: 0, sessions: 0, tools: 0, toolErrs: 0,
          costUsd: 0, savedUsd: 0, durMs: 0, durN: 0,
          exactTok: 0, estTok: 0,
          models: new Map(), toolsTop: new Map(), _sess: new Set()
        };
        rowMap.set(r.agentId, row);
      }
      const price = this._auModelPricing(r.model);
      const costUsd = r.cost > 0 ? r.cost : (r.in * price.in + r.out * price.out + r.cr * price.cacheRead + r.cw * price.cacheWrite) / 1e6;
      const savedUsd = Math.max(0, (r.cr / 1e6) * (price.in - price.cacheRead));
      const turns = 1 + (r.extraTurns || 0);
      row.turns += turns;
      row.tools += r.toolN;
      row.toolErrs += r.toolErrs;
      row.input += r.in; row.output += r.out; row.cache += r.cr; row.cacheW += r.cw;
      row.tokens += r.tot; row.net += r.net;
      row.costUsd += costUsd; row.savedUsd += savedUsd;
      // 单轮耗时 >5min 的挂起异常值封顶计入，避免个别僵尸会话拉偏平均耗时
      const durCapped = Math.min(r.durMs, 300000);
      if (durCapped > 0) { row.durMs += durCapped; row.durN += turns; }
      if (r.est) row.estTok += r.tot; else row.exactTok += r.tot;
      if (r.sessKey && !row._sess.has(r.sessKey)) { row._sess.add(r.sessKey); row.sessions++; sessSet.add(r.sessKey); }
      const mName = this.normalizeModelName(r.model, r.agentId);
      const mc = row.models.get(mName) || { tokens: 0, turns: 0, in: 0, out: 0, cr: 0, effort: r.effort || null, est: r.est };
      mc.tokens += r.tot; mc.turns += turns;
      mc.in += r.in; mc.out += r.out; mc.cr += r.cr;
      row.models.set(mName, mc);
      for (const tn of r.toolNames) row.toolsTop.set(tn, (row.toolsTop.get(tn) || 0) + 1);
      if (r.toolMap) for (const [tn, c] of Object.entries(r.toolMap)) row.toolsTop.set(tn, (row.toolsTop.get(tn) || 0) + c);

      totals.tokens += r.tot; totals.input += r.in; totals.output += r.out;
      totals.cache += r.cr; totals.cacheW += r.cw; totals.net += r.net;
      totals.turns += turns; totals.tools += r.toolN; totals.toolErrs += r.toolErrs;
      totals.costUsd += costUsd; totals.savedByCacheUsd += savedUsd;
      if (durCapped > 0) { totals.durMs += durCapped; totals.durN += turns; }
      if (r.est) totals.estTok += r.tot; else totals.exactTok += r.tot;

      const dk = r.ts ? dayKeyOf(r.ts) : null;
      if (dk) {
        const d = daily.get(dk) || { in: 0, out: 0, cr: 0, tot: 0, net: 0, tools: 0, turns: 0, cost: 0 };
        d.in += r.in; d.out += r.out; d.cr += r.cr; d.tot += r.tot; d.net += r.net; d.tools += r.toolN;
        d.turns += turns; d.cost += costUsd;
        daily.set(dk, d);
      }
      const hk2 = r.ts ? hourKeyOf(r.ts) : null;
      if (hk2) {
        const hb = hourly.get(hk2) || { in: 0, out: 0, cr: 0, tot: 0, net: 0, tools: 0, turns: 0, cost: 0 };
        hb.in += r.in; hb.out += r.out; hb.cr += r.cr; hb.tot += r.tot; hb.net += r.net; hb.tools += r.toolN;
        hb.turns += turns; hb.cost += costUsd;
        hourly.set(hk2, hb);
      }
      const bk = range === 'today' ? hk2 : dk;
      if (bk) {
        let am = bucketAg.get(bk);
        if (!am) { am = new Map(); bucketAg.set(bk, am); }
        const ad = am.get(r.agentId) || { in: 0, out: 0, cr: 0, tot: 0, net: 0, tools: 0, turns: 0, cost: 0 };
        ad.in += r.in; ad.out += r.out; ad.cr += r.cr; ad.tot += r.tot; ad.net += r.net;
        ad.tools += r.toolN; ad.turns += turns; ad.cost += costUsd;
        am.set(r.agentId, ad);
      }
    }
    totals.sessions = sessSet.size;

    const rows = Array.from(rowMap.values());
    for (const r of rows) {
      r.modelList = Array.from(r.models.entries())
        .map(([name, v]) => ({ name, tokens: v.tokens, turns: v.turns, effort: v.effort, est: v.est, in: v.in, out: v.out, cr: v.cr }))
        .sort((a, b) => b.tokens - a.tokens);
      r.toolList = Array.from(r.toolsTop.entries())
        .map(([name, n]) => ({ name, n }))
        .sort((a, b) => b.n - a.n).slice(0, 6);
      r.segSum = Math.max(1, r.input + r.output + r.cache);
      r.hitRate = (r.input + r.cache + r.cacheW) > 0 ? r.cache / (r.input + r.cache + r.cacheW) : 0;
      r.avgDurS = r.durN > 0 ? r.durMs / r.durN / 1000 : 0;
      r.toolOkRate = r.tools > 0 ? (r.tools - r.toolErrs) / r.tools : null;
      delete r._sess; delete r.models; delete r.toolsTop;
    }
    const metric = this.agentUsageMetric || 'tokens';
    const metricOf = (r) => metric === 'net' ? r.net : metric === 'tools' ? r.tools : r.tokens;
    rows.sort((a, b) => metricOf(b) - metricOf(a));
    const maxMetric = rows.length ? Math.max(1, metricOf(rows[0])) : 1;

    // 环比 (同窗口长度上一周期, range=all 时无意义置 null)
    let momPct = null;
    if (range !== 'all') {
      const prevTok = prevRange.reduce((s, r) => s + r.tot, 0);
      if (prevTok > 0) momPct = (totals.tokens - prevTok) / prevTok * 100;
    }

    // 趋势桶序列: today→24h 小时桶 / week→7 日桶 / all→30 日桶
    const trend = [];
    if (range === 'today') {
      for (let h = 23; h >= 0; h--) {
        const dt = new Date(now - h * 3600000);
        const hk = dayKeyOf(dt.getTime()) + 'T' + String(dt.getHours()).padStart(2, '0');
        const acc = hourly.get(hk) || { in: 0, out: 0, cr: 0, tot: 0, net: 0, tools: 0, turns: 0, cost: 0 };
        trend.push({ key: hk, label: String(dt.getHours()).padStart(2, '0') + ':00', ...acc });
      }
    } else {
      const days = range === 'week' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const dt = new Date(now - i * 86400000);
        const dk = dayKeyOf(dt.getTime());
        const acc = daily.get(dk) || { in: 0, out: 0, cr: 0, tot: 0, net: 0, tools: 0, turns: 0, cost: 0 };
        trend.push({ key: dk, label: (dt.getMonth() + 1) + '/' + dt.getDate(), ...acc });
      }
    }

    const cacheDenom = totals.input + totals.cache + totals.cacheW;
    const kpis = {
      tokens: totals.tokens,
      net: totals.net,
      inOutRatio: totals.output > 0 ? (totals.input / totals.output) : null,
      hitRate: cacheDenom > 0 ? totals.cache / cacheDenom : 0,
      cacheRead: totals.cache,
      savedUsd: totals.savedByCacheUsd,
      turns: totals.turns,
      sessions: totals.sessions,
      avgDurS: totals.durN > 0 ? totals.durMs / totals.durN / 1000 : 0,
      tools: totals.tools,
      toolOkRate: totals.tools > 0 ? (totals.tools - totals.toolErrs) / totals.tools : null,
      toolsPerTurn: totals.turns > 0 ? totals.tools / totals.turns : 0
    };

    return { rows, totals, kpis, trend, daily, bucketAg, maxMetric, metric, range, momPct };
  }

  // 热力图「AI 协同」维度数据源: 按日聚合的 Agent 对话事件
  collectAgentUsageDailyEvents() {
    try {
      const stats = this.collectAgentUsageStats('all');
      const out = {};
      for (const [dk, d] of (stats.daily || new Map()).entries()) {
        if (!d.tot) continue;
        out[dk] = [{
          type: 'ai',
          date: dk,
          time: '',
          level: 'L1',
          action: 'agent-usage',
          title: `Agent 对话 ${this.fmtUsageTok(d.tot)} tok`,
          detail: `输入 ${this.fmtUsageTok(d.in)} · 输出 ${this.fmtUsageTok(d.out)} · 缓存 ${this.fmtUsageTok(d.cr)}`
        }];
      }
      return out;
    } catch (e) { return {}; }
  }

  renderAgentUsageCard(parentEl) {
    this.agentUsageCardEl = parentEl.createDiv({ cls: 'tw-card tw-agent-usage-card' });
    this._mqRenderedOnce = false;
    this.updateAgentUsageCard();
    // Agent 回合结束后自动重算（仅在首页卡片仍挂载时），无需手动刷新
    if (!this._agentUsageBound && this.agentHub && typeof this.agentHub.on === 'function') {
      this._agentUsageBound = true;
      const schedule = () => {
        if (this.agentUsageCardEl && this.agentUsageCardEl.isConnected) {
          if (this._auLedgerCache) this._auLedgerCache.at = 0; // 回合结束强制作废账本缓存
          setTimeout(() => this.updateAgentUsageCard(), 400);
          this.refreshMagpieObservability(true); // 网关账本同步过期
        }
      };
      this.agentHub.on('turn_end', schedule);
      this.agentHub.on('agent_settled', schedule);
    }
  }

  // ── Magpie 观测桥接：异步非阻塞拉取只读快照，完成后重渲染（skipRemoteFetch 防死循环）──
  refreshMagpieObservability(force = false) {
    if (!this.magpieObs) return Promise.resolve(null);
    if (this._mqFetching) return this._mqFetching;
    this._mqFetching = this.magpieObs.fetchSnapshot(this.agentUsageRange, force)
      .then((snap) => {
        this._mqLastSnapshot = snap;
        const needRender = !this._mqRenderedOnce || force || (snap && snap.fromCache !== true);
        if (needRender && this.agentUsageCardEl && this.agentUsageCardEl.isConnected) {
          this.updateAgentUsageCard(true);
        }
        return snap;
      })
      .catch(() => null)
      .finally(() => { this._mqFetching = null; });
    return this._mqFetching;
  }

  _mqClearAutoRefresh() {
    if (this._mqAutoRefreshTimer) {
      clearInterval(this._mqAutoRefreshTimer);
      this._mqAutoRefreshTimer = null;
    }
    this._mqAutoRefreshSec = 0;
  }

  _mqSetAutoRefresh(sec) {
    this._mqClearAutoRefresh();
    if (sec > 0) {
      this._mqAutoRefreshSec = sec;
      this._mqAutoRefreshTimer = setInterval(() => {
        if (this.agentUsageCardEl && this.agentUsageCardEl.isConnected) {
          this.refreshMagpieObservability(true);
        }
      }, sec * 1000);
    }
  }

  // 耗时格式化: >=60s → "1m 12s / 轮"; <60s → "24.5s / 轮"
  _auFmtDur(s) {
    if (!(s > 0)) return '';
    if (s >= 60) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s / 轮`;
    return `${s.toFixed(1)}s / 轮`;
  }

  // 每日趋势: 三色堆叠柱(输入/输出/缓存读) + HTML 数值标签 + HTML x 轴 + 峰值摘要
  // —— 杜绝 SVG <text> 随容器拉伸变形; 图表容器由 CSS 锁定高度
  _auTrendChart(trend, metric) {
    if (!trend || !trend.length) return '';
    const W = 220, H = 84, HMAX = H - 4;
    const valOf = (b) => metric === 'net' ? b.net : metric === 'tools' ? b.tools : b.tot;
    const maxV = Math.max(1, ...trend.map(valOf));
    const step = W / trend.length;
    const bw = Math.min(16, Math.max(3, step * 0.6));
    let bars = '', vals = '';
    let peak = null, peakV = 0;
    const labelAll = trend.length <= 12; // >12 桶只标 ≥40% 峰值柱，避免 30 日重叠
    trend.forEach((b, i) => {
      const v = valOf(b);
      if (v > peakV) { peakV = v; peak = b; }
      const x = i * step + (step - bw) / 2;
      const tip = `${b.label} · ${metric === 'tools' ? v + ' 次工具' : this.fmtUsageTok(v) + ' tok'}\\n输入 ${this.fmtUsageTok(b.in)} · 输出 ${this.fmtUsageTok(b.out)} · 缓存 ${this.fmtUsageTok(b.cr)}`;
      let hTot = 0;
      if (metric === 'tools') {
        const h = v > 0 ? Math.max(2, (v / maxV) * HMAX) : 0;
        hTot = h;
        if (h > 0) bars += `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="#8B5CF6" opacity=".75"><title>${escapeHtml(tip)}</title></rect>`;
      } else {
        // 自底向上堆叠: 输入(蓝) → 输出(绿) → 缓存读(紫)
        const segs = [
          { h: Math.max(0, (b.in / maxV) * HMAX), fill: 'var(--g-blue, #2563EB)', op: '.9' },
          { h: Math.max(0, (b.out / maxV) * HMAX), fill: 'var(--g-green, #10B981)', op: '.9' },
          { h: Math.max(0, (b.cr / maxV) * HMAX), fill: 'rgba(139,92,246,0.45)', op: '1' }
        ];
        hTot = segs[0].h + segs[1].h + segs[2].h;
        if (hTot > 0) {
          let y = H;
          for (const s of segs) {
            if (s.h <= 0.5) continue;
            y -= s.h;
            bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${s.h.toFixed(1)}" fill="${s.fill}" opacity="${s.op}"><title>${escapeHtml(tip)}</title></rect>`;
          }
        }
      }
      if (v > 0 && (labelAll || v >= maxV * 0.4)) {
        vals += `<span class="tw-au-chart-val" style="left:${(((x + bw / 2) / W) * 100).toFixed(1)}%;bottom:${Math.min(96, ((hTot + 3) / H) * 100).toFixed(0)}%">${this.fmtUsageTok(v)}</span>`;
      }
    });
    const mid = Math.floor((trend.length - 1) / 2);
    const xaxis = `<div class="tw-au-chart-xaxis"><span>${escapeHtml(trend[0].label)}</span><span>${escapeHtml(trend[mid].label)}</span><span>${escapeHtml(trend[trend.length - 1].label)}</span></div>`;
    const peakHtml = peak ? `<div class="tw-au-chart-peak">峰值 ${escapeHtml(peak.label)} · ${this.fmtUsageTok(peakV)}${metric === 'tools' ? ' 次' : ' tok'}</div>` : '';
    // 每列一条全高透明热区（覆盖柱体与空白），承接 hover/click 浮窗定位
    let cols = '';
    trend.forEach((b, i) => {
      cols += `<span class="tw-au-day-col${this._auDayLock === i ? ' locked' : ''}" data-i="${i}" title="${escapeHtml(b.label)}"></span>`;
    });
    return `<div class="tw-au-daily-chart"><svg class="tw-au-trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg><div class="tw-au-day-cols">${cols}</div>${vals}<div class="tw-trend-tooltip tw-au-day-popover" hidden></div></div>${xaxis}${peakHtml}`;
  }

  _auHideDayPopover() {
    const p = this.agentUsageCardEl && this.agentUsageCardEl.querySelector('.tw-au-day-popover');
    if (p) p.hidden = true;
    this.agentUsageCardEl && this.agentUsageCardEl.querySelectorAll('.tw-au-day-col.locked').forEach(c => c.classList.remove('locked'));
    if (this._auDayLock != null) this._auDayLock = null;
  }

  // 日柱详情浮窗：缓存/输入/输出三色构成 + 占比 + 当日交互页脚；靠右列向左弹
  _auShowDayPopover(i) {
    const chart = this.agentUsageCardEl && this.agentUsageCardEl.querySelector('.tw-au-daily-chart');
    const pop = chart && chart.querySelector('.tw-au-day-popover');
    const b = (this._auLastTrend || [])[i];
    if (!pop || !b) return;
    const fmt = (n) => this.fmtUsageTok(n);
    const segSum = Math.max(1, (b.in || 0) + (b.out || 0) + (b.cr || 0));
    const pct = (v) => '(' + ((v / segSum) * 100).toFixed(1) + '%)';
    let head;
    if (String(b.key).indexOf('T') >= 0) {
      head = `${escapeHtml(b.label)} 时段`;
    } else {
      const wd = '日一二三四五六'[new Date(String(b.key) + 'T00:00:00').getDay()];
      head = `${escapeHtml(String(b.key))}（周${wd}）`;
    }
    const totLine = this.agentUsageMetric === 'tools' ? `${b.tools || 0} 次工具` : `共 ${fmt(b.tot)} tok`;
    pop.innerHTML = `
      <div class="tw-tt-header">${head} · ${totLine}</div>
      <div class="tw-tt-row"><span class="tw-tt-indicator" style="background:#8B5CF6"></span><span class="tw-tt-label">缓存读取:</span><span class="tw-tt-val">${fmt(b.cr)} <small>${pct(b.cr)}</small></span></div>
      <div class="tw-tt-row"><span class="tw-tt-indicator" style="background:#2563EB"></span><span class="tw-tt-label">未缓存输入:</span><span class="tw-tt-val">${fmt(b.in)} <small>${pct(b.in)}</small></span></div>
      <div class="tw-tt-row"><span class="tw-tt-indicator" style="background:#10B981"></span><span class="tw-tt-label">模型输出:</span><span class="tw-tt-val">${fmt(b.out)} <small>${pct(b.out)}</small></span></div>
      <div class="tw-tt-row tw-tt-footer-row"><span class="tw-tt-label">当日交互</span><span class="tw-tt-val">${b.turns || 0} 轮 · ${b.tools || 0} 工具${(b.cost || 0) > 0.001 ? ' · ~$' + b.cost.toFixed(2) : ''}</span></div>`;
    const n = Math.max(1, (this._auLastTrend || []).length);
    const frac = (i + 0.5) / n;
    if (frac > 0.55) {
      pop.style.left = 'auto';
      pop.style.right = `calc(${((1 - frac) * 100).toFixed(1)}% + 12px)`;
    } else {
      pop.style.right = 'auto';
      pop.style.left = `calc(${(frac * 100).toFixed(1)}% + 12px)`;
    }
    pop.style.top = '2px';
    pop.hidden = false;
  }

  // 供应商图标：优先官方品牌 SVG（icon 字段去 -color 后缀），未知供应商回退首字母徽章
  _mqProviderIcon(card, size = 14) {
    const raw = String((card && (card.icon || card.provider)) || '').toLowerCase().replace(/-color$/, '');
    const KNOWN = { claude: 1, deepseek: 1, qwen: 1, kimi: 1, doubao: 1, gemini: 1, grok: 1, antigravity: 1, openai: 1, glm: 1, minimax: 1, longcat: 1, mimo: 1, hunyuan: 1, hermes: 1, niceaigc: 1, science: 1 };
    try {
      if (raw === 'pi') return getAgentBrandSvg('pi', size);
      if (KNOWN[raw]) return getOfficialModelSvg(raw, size);
    } catch (e) {}
    const letter = escapeHtml(String((card && (card.name || card.provider)) || '?').trim().charAt(0).toUpperCase() || '?');
    return `<span class="tw-mq-qbrand-fb">${letter}</span>`;
  }

  // 单个额度窗口行: 名称 + 已用%/重置/配速 + 进度条 + 整窗容量/到期 + 剩余额度走势 SVG
  _mqWindowHtml(card, win, snap) {
    const obs = this.magpieObs;
    const used = Number(win && win.used);
    const hasUsed = Number.isFinite(used);
    const resetMs = Date.parse((win && (win.resetsAt || win.runsOutAt)) || '');
    let metaTxt = hasUsed ? `已用 ${used.toFixed(1)}%` : '';
    if (Number.isFinite(resetMs)) {
      const d = new Date(resetMs);
      metaTxt += ` · ${d.getMonth() + 1}月${d.getDate()}日重置`;
    }
    const pts = obs ? obs.findHistoryPoints(card, win, snap && snap.histories) : [];
    const pace = obs ? obs.computePace(win, pts, Date.now()) : null;
    const paceHtml = pace ? ` · <span class="tw-mq-pace is-${pace.status}">${escapeHtml(pace.label)}</span>` : '';
    const disp = win && win.display ? `<span class="tw-mq-win-disp"> · ${escapeHtml(String(win.display))}</span>` : '';
    const pct = hasUsed ? Math.max(0, Math.min(100, used)) : 0;
    const barCls = pct >= 80 ? ' is-danger' : pct >= 50 ? ' is-warn' : '';
    const holds = obs ? obs.formatWindowHolds(win, (n) => this.fmtUsageTok(n)) : '';
    const expMs = Date.parse((card && (card.expiresAt || card.planEndsAt)) || '');
    let expTxt = '';
    if (Number.isFinite(expMs)) {
      const ed = new Date(expMs);
      expTxt = `${ed.getFullYear()}年${ed.getMonth() + 1}月${ed.getDate()}日到期`;
    }
    const key = `${(card && card.provider) || ''}|${(card && card.user) || ''}|${(win && win.name) || ''}`;
    const open = !this._mqTrendExpanded.has(key);
    const plot = (open && obs) ? obs.renderQuotaPlotSvg(win, pts, Date.now()) : { svg: '', eta: null };
    const etaHtml = plot.eta ? `<div class="tw-mq-eta-text${plot.eta.safe === false ? ' is-warn' : ''}">${escapeHtml(plot.eta.text)}</div>` : '';
    return `
      <div class="tw-mq-win-row">
        <div class="tw-mq-win-top"><span class="tw-mq-win-name">${escapeHtml((win && win.name) || '窗口')}</span><span class="tw-mq-win-meta">${metaTxt}${paceHtml}${disp}</span></div>
        <div class="tw-mq-bar-track"><div class="tw-mq-bar-fill${barCls}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="tw-mq-win-sub"><span>${escapeHtml(holds)}</span><span>${escapeHtml(expTxt)}</span></div>
        <div class="tw-mq-trend-box">
          <div class="tw-mq-trend-head" data-mqtrend="${escapeHtml(key)}"><span>${open ? '▾' : '▸'} 剩余额度走势</span><span>${pts.length} 点</span></div>
          ${open ? `${plot.svg}${etaHtml}` : ''}
        </div>
      </div>`;
  }

  _mqQuotaCardHtml(card, snap) {
    const icon = this._mqProviderIcon(card, 14);
    const plan = card && card.plan ? `<span class="tw-mq-plan-tag">${escapeHtml(card.plan)}</span>` : '';
    const user = this.magpieObs ? this.magpieObs.maskUser(card && card.user, this._mqMaskAccounts) : String((card && card.user) || '');
    const wins = (card && Array.isArray(card.windows)) ? card.windows.map(w => this._mqWindowHtml(card, w, snap)).join('') : '';
    return `
      <div class="tw-mq-qcard" data-mqprov="${escapeHtml((card && card.provider) || '')}" data-mquser="${escapeHtml((card && card.user) || '')}">
        <div class="tw-mq-qcard-head">
          <span class="tw-mq-qcard-brand">${icon}${escapeHtml((card && (card.name || card.provider)) || '')}${plan}</span>
          <span class="tw-mq-qcard-user" title="${escapeHtml((card && card.user) || '')}">${escapeHtml(user)}<button class="tw-mq-card-refresh" title="刷新该账号额度">↻</button></span>
        </div>
        ${wins}
      </div>`;
  }

  // 「额度」折叠区块: 头部开关 + 账号打码 + 卡片网格
  _mqQuotaSectionHtml(snap) {
    const cards = (snap && snap.cards) || [];
    if (!cards.length) return '';
    const collapsed = this._mqQuotaCollapsed;
    const grid = collapsed ? '' : `<div class="tw-mq-quota-grid">${cards.map(c => this._mqQuotaCardHtml(c, snap)).join('')}</div>`;
    return `
      <div class="tw-mq-quota-section">
        <div class="tw-mq-sec-bar">
          <span class="tw-mq-sec-toggle" data-mqsec="1">${collapsed ? '▸' : '▾'} 额度 <i>${cards.length}</i></span>
          <button class="tw-mq-mask-btn" data-mqmask="1">${this._mqMaskAccounts ? '已打码' : '账号打码'}</button>
        </div>
        ${grid}
      </div>`;
  }

  // 网关单行（agent/model/account）归一化为本地 row 形态，供排行渲染统一消费
  _mqNormGwRow(o, kind) {
    const inV = Math.max(0, o.input || 0), outV = Math.max(0, o.output || 0);
    const crV = Math.max(0, o.cache_read || 0), cwV = Math.max(0, o.cache_write || 0);
    const timed = Math.max(0, o.timed || 0);
    return {
      id: o.id || o.model || o.account || '',
      name: o.name || o.model || o.account || o.id || '',
      sub: o.sub || '',
      iconKey: o.icon || o.provider || '',
      tokens: inV + outV + crV + cwV,
      net: inV + outV + cwV,
      input: inV, output: outV, cache: crV, cacheW: cwV,
      reas: Math.max(0, o.reasoning || 0),
      calls: Math.max(0, o.calls || 0),
      errors: Math.max(0, o.errors || 0),
      retried: Math.max(0, o.retried || 0),
      tools: 0,
      turns: Math.max(0, o.calls || 0),
      costUsd: Math.max(0, o.cost || 0),
      ttftAvg: timed > 0 ? (o.ttft_ms || 0) / timed / 1000 : 0,
      gw: true, kind
    };
  }

  // 三维排行数据: agents(网关+本地未代理差额) / models / accounts; 离线回退本地账本
  _mqRankRows(mu, stats, gwIds) {
    const tab = this._mqRankTab;
    const rows = [];
    const seen = new Set();
    if (mu) {
      if (tab === 'agents') {
        for (const a of (mu.agents || [])) {
          const r = this._mqNormGwRow(a, 'agent');
          if (r.name === r.id) { const nm = { pi: 'Pi Agent', dsh: 'Harness', antigravity: 'Antigravity', niceaigc: 'NiceAIGC', codex: 'Codex', gemini: 'Gemini', hermes: 'Hermes' }; if (nm[r.id]) r.name = nm[r.id]; }
          rows.push(r); seen.add(r.id);
        }
      } else if (tab === 'models') {
        for (const m of (mu.models || [])) { rows.push(this._mqNormGwRow(m, 'model')); seen.add(String(m.model || m.id || '').toLowerCase()); }
      } else {
        for (const a of (mu.accounts || [])) {
          const r = this._mqNormGwRow(a, 'account');
          r.name = this.magpieObs ? this.magpieObs.maskUser(a.account || a.name, this._mqMaskAccounts) : (a.account || a.name);
          rows.push(r);
        }
      }
    }
    // 本地账本：离线全量 / 在线仅未走网关的 Agent 差额（杜绝双计）
    const localRows = mu ? stats.rows.filter(r => !gwIds.has(r.id)) : stats.rows;
    if (tab === 'agents') {
      for (const r of localRows) {
        if (seen.has(r.id)) continue;
        r.gw = false; rows.push(r);
      }
    } else if (tab === 'models') {
      const merged = new Map();
      for (const r of localRows) {
        for (const m of (r.modelList || [])) {
          const key = String(m.name || '').toLowerCase();
          const acc = merged.get(key) || { id: 'lm|' + key, name: m.name, sub: '', iconKey: '', tokens: 0, net: 0, input: 0, output: 0, cache: 0, cacheW: 0, reas: 0, calls: 0, errors: 0, retried: 0, tools: 0, turns: 0, costUsd: 0, ttftAvg: 0, gw: false, kind: 'model' };
          acc.tokens += m.tokens; acc.input += m.in || 0; acc.output += m.out || 0; acc.cache += m.cr || 0;
          acc.net += (m.in || 0) + (m.out || 0); acc.turns += m.turns || 0; acc.calls += m.turns || 0;
          merged.set(key, acc);
        }
      }
      for (const r of merged.values()) { if (!seen.has(String(r.name).toLowerCase())) rows.push(r); }
    }
    rows.sort((a, b) => (b.tokens - a.tokens) || (b.calls - a.calls));
    return rows;
  }

  // 排行行展开明细: 网关行显示输入/输出/缓存/推理/调用/失败/TTFT 明细行；本地行沿用模型清单
  _mqRowExpandHtml(r, fmt, full) {
    if (r.gw) {
      const parts = [`输入 ${fmt(r.input)}`, `输出 ${fmt(r.output)}`];
      if (r.cache > 0) parts.push(`缓存 ${fmt(r.cache)}`);
      if (r.cacheW > 0) parts.push(`缓存写 ${fmt(r.cacheW)}`);
      if (r.reas > 0) parts.push(`推理 ${fmt(r.reas)}`);
      const line2 = [`${full(r.calls)} 调用`];
      if (r.errors > 0) line2.push(`${r.errors} 失败`);
      if (r.retried > 0) line2.push(`${r.retried} 重试成功`);
      if (r.ttftAvg > 0) line2.push(`TTFT ${r.ttftAvg.toFixed(1)}s`);
      if (r.costUsd > 0.001) line2.push(`~$${r.costUsd.toFixed(2)}`);
      return `<div class="tw-au-expand"><div class="tw-au-model-line"><span class="tw-au-model-name">${escapeHtml(parts.join(' · '))}</span><span class="tw-au-model-meta"><b class="mm-tok">${escapeHtml(line2.join(' · '))}</b></span></div></div>`;
    }
    const list = r.modelList || [];
    if (!list.length) {
      const fb = r.kind === 'model'
        ? `${r.turns || 0} 轮 · ${fmt(r.tokens)} tok${r.costUsd > 0.001 ? ` · ~$${r.costUsd.toFixed(2)}` : ''}`
        : '无模型用量记录';
      return `<div class="tw-au-expand"><div class="tw-au-model-line"><span class="tw-au-model-name">${escapeHtml(fb)}</span><span>—</span></div></div>`;
    }
    const modelRows = list.map(m => {
      const mw = list[0].tokens > 0 ? Math.max(3, m.tokens / list[0].tokens * 100) : 0;
      const perTurn = m.turns > 0 ? fmt(Math.round(m.tokens / m.turns)) : '—';
      const mSum = Math.max(1, (m.in || 0) + (m.out || 0) + (m.cr || 0));
      const wI = ((m.in || 0) / mSum) * 100;
      const wO = ((m.out || 0) / mSum) * 100;
      const wC = Math.max(0, 100 - wI - wO);
      return `<div class="tw-au-model-line"><span class="tw-au-model-name">${escapeHtml(m.name)}${m.effort ? `<i class="tw-au-effort">${escapeHtml(m.effort)}</i>` : ''}</span><span class="tw-au-model-bar-wrap"><span class="tw-au-mbar" style="width:${mw.toFixed(0)}%"><i class="in" style="width:${wI.toFixed(1)}%"></i><i class="out" style="width:${wO.toFixed(1)}%"></i><i class="cache" style="width:${wC.toFixed(1)}%"></i></span></span><span class="tw-au-model-meta"><b class="mm-tok">${fmt(m.tokens)}</b><i class="mm-per">${perTurn}/轮</i><i class="mm-turns">${m.turns}轮</i></span></div>`;
    }).join('');
    return `<div class="tw-au-expand">${modelRows}</div>`;
  }

  updateAgentUsageCard(skipRemoteFetch = false) {
    if (!this.agentUsageCardEl || !this.agentUsageCardEl.isConnected) return;
    // 异步非阻塞桥接 Magpie 快照 (1500ms 超时 + 8s TTL + 离线静默兜底), 绝不阻塞首屏渲染栈
    if (!skipRemoteFetch) this.refreshMagpieObservability(false);
    const stats = this.collectAgentUsageStats();
    const range = stats.range;
    const metric = stats.metric;
    const fmt = (n) => this.fmtUsageTok(n);
    const full = (n) => (Number(n) || 0).toLocaleString();
    const k = stats.kpis, t = stats.totals;

    // ── 双源融合: Magpie 网关精确账本 + 本地未代理 Agent 差额; 离线 100% 本地账本 ──
    const snap = this._mqLastSnapshot;
    const gwOnline = !!(snap && snap.online);
    // usage.period 必须与当前周期一致，防止切周期瞬间短暂渲染旧周期缓存
    const mu = (snap && snap.online && snap.usage && this.magpieObs &&
      snap.usage.period === this.magpieObs.mapPeriod(range)) ? snap.usage : null;
    const gwIds = new Set();
    if (mu && Array.isArray(mu.agents)) for (const a of mu.agents) gwIds.add(a.id);
    const ng = { input: 0, output: 0, cache: 0, cacheW: 0, turns: 0, tools: 0, toolErrs: 0, costUsd: 0, savedUsd: 0, tokens: 0, net: 0 };
    if (mu) {
      for (const r of stats.rows) {
        if (gwIds.has(r.id)) continue;
        ng.input += r.input; ng.output += r.output; ng.cache += r.cache; ng.cacheW += r.cacheW;
        ng.turns += r.turns; ng.tools += r.tools; ng.toolErrs += r.toolErrs;
        ng.costUsd += r.costUsd; ng.savedUsd += r.savedUsd; ng.tokens += r.tokens; ng.net += r.net;
      }
    }
    const tokIn = mu ? (mu.input || 0) + ng.input : t.input;
    const tokOut = mu ? (mu.output || 0) + ng.output : t.output;
    const tokCr = mu ? (mu.cache_read || 0) + ng.cache : t.cache;
    const tokCw = mu ? (mu.cache_write || 0) + ng.cacheW : t.cacheW;
    const tokReas = mu ? Math.max(0, mu.reasoning || 0) : 0;
    const callsN = mu ? (mu.calls || 0) + ng.turns : k.turns;
    const errN = mu ? (mu.errors || 0) : t.toolErrs;
    const retriedN = mu ? (mu.retried || 0) : 0;
    const costUsd = mu ? (mu.cost || 0) + ng.costUsd : t.costUsd;
    const hitDenom = tokIn + tokCr + tokCw;
    const hitPct = hitDenom > 0 ? (tokCr / hitDenom * 100) : 0;
    let savedUsd = mu ? ng.savedUsd : k.savedUsd;
    if (mu) {
      for (const m of (mu.models || [])) {
        const pr = this._auModelPricing(m.model);
        savedUsd += Math.max(0, ((m.cache_read || 0) / 1e6) * (pr.in - pr.cacheRead));
      }
    }
    const ttftAvg = (mu && (mu.timed || 0) > 0) ? (mu.ttft_ms || 0) / mu.timed / 1000 : 0;

    // ── 层1: 顶栏 = 标题 + 网关状态胶囊 + 生效价格 + 周期按钮组 + 5秒自动刷新 + 手动刷新 ──
    const rangeSeg = `
      <div class="tw-au-metric-seg" role="tablist">
        <button type="button" class="tw-au-metric-btn tw-au-range-btn${range === 'today' ? ' active' : ''}" data-r="today">今天</button>
        <button type="button" class="tw-au-metric-btn tw-au-range-btn${range === 'week' ? ' active' : ''}" data-r="week">7天</button>
        <button type="button" class="tw-au-metric-btn tw-au-range-btn${range === 'month' ? ' active' : ''}" data-r="month">30天</button>
        <button type="button" class="tw-au-metric-btn tw-au-range-btn${range === 'all' ? ' active' : ''}" data-r="all">全部</button>
      </div>`;
    const metricSeg = `
      <div class="tw-au-metric-seg" role="tablist">
        <button type="button" class="tw-au-metric-btn${metric === 'tokens' ? ' active' : ''}" data-m="tokens">总Token</button>
        <button type="button" class="tw-au-metric-btn${metric === 'net' ? ' active' : ''}" data-m="net">净计费</button>
        <button type="button" class="tw-au-metric-btn${metric === 'tools' ? ' active' : ''}" data-m="tools">工具</button>
      </div>`;
    const momHtml = stats.momPct != null
      ? `<span class="tw-au-mom">环比 <b class="${stats.momPct >= 0 ? 'tw-au-up' : 'tw-au-down'}">${stats.momPct >= 0 ? '+' : ''}${stats.momPct.toFixed(0)}%</b></span>` : '';

    // ── 层2: Magpie 同款 4 大核心 KPI ──
    const ic = (n) => { try { return getIconPark(n, 12); } catch (e) { return ''; } };
    const tokMain = this._mqIncludeCache ? (tokIn + tokOut + tokCr + tokCw) : (tokIn + tokOut);
    const kpiTokSub = `${fmt(tokIn)} 输入 · ${fmt(tokOut)} 输出`;
    const kpiCacheSub = `${hitPct.toFixed(1)}% 命中率${savedUsd > 0.001 ? `<span class="tw-au-sub-pill p-green">省 ~$${savedUsd.toFixed(1)}</span>` : ''}`;
    let kpiReasMain, kpiReasSub;
    if (tokReas > 0) {
      kpiReasMain = `${fmt(tokReas)}<i> tok</i>`;
      kpiReasSub = `输出内含 ${tokOut > 0 ? (tokReas / tokOut * 100).toFixed(1) : '0.0'}%`;
    } else if (ttftAvg > 0) {
      kpiReasMain = `${ttftAvg.toFixed(1)}<i> s</i>`;
      kpiReasSub = `平均首字延迟${mu && mu.timed ? ` · ${mu.timed} 次计时` : ''}`;
    } else {
      kpiReasMain = `${k.avgDurS > 0 ? k.avgDurS.toFixed(1) : '0.0'}<i> s</i>`;
      kpiReasSub = '平均轮次耗时';
    }
    const errPill = errN > 0 ? `<span class="tw-au-sub-pill p-red">${errN} 失败</span>` : '';
    const retryPill = retriedN > 0 ? `<span class="tw-au-sub-pill p-amber">${retriedN} 重试后成功</span>` : '';
    const kpiCallsSub = `${errPill}${retryPill}<span class="lab">${mu ? '' : `${k.sessions} 会话 · `}${t.tools} 工具</span>`;
    const kpiHtml = `
      <div class="tw-au-kpis">
        <div class="tw-au-kpi">
          <div class="tw-au-kpi-head"><span class="tw-au-kpi-label">TOKEN</span><span class="tw-mq-mini-seg"><button type="button" class="${this._mqIncludeCache ? 'active' : ''}" data-mqcache="1">含缓存</button><button type="button" class="${this._mqIncludeCache ? '' : 'active'}" data-mqcache="0">不含缓存</button></span></div>
          <b class="tw-au-kpi-val">${fmt(tokMain)}<i> tok</i></b>
          <span class="tw-au-kpi-sub"><span class="lab">${kpiTokSub}</span></span></div>
        <div class="tw-au-kpi">
          <div class="tw-au-kpi-head"><span class="tw-au-kpi-label">缓存读取</span><i class="tw-au-kpi-ic ic-purple">${ic('pie')}</i></div>
          <b class="tw-au-kpi-val">${fmt(tokCr)}<i> tok</i></b>
          <span class="tw-au-kpi-sub"><span class="lab">${kpiCacheSub}</span></span></div>
        <div class="tw-au-kpi">
          <div class="tw-au-kpi-head"><span class="tw-au-kpi-label">推理</span><i class="tw-au-kpi-ic ic-cyan">${ic('brain')}</i></div>
          <b class="tw-au-kpi-val">${kpiReasMain}</b>
          <span class="tw-au-kpi-sub"><span class="lab">${kpiReasSub}</span></span></div>
        <div class="tw-au-kpi">
          <div class="tw-au-kpi-head"><span class="tw-au-kpi-label">次调用</span><i class="tw-au-kpi-ic ic-orange">${ic('tool')}</i></div>
          <b class="tw-au-kpi-val">${full(callsN)}<i> 次</i></b>
          <span class="tw-au-kpi-sub">${kpiCallsSub}</span></div>
      </div>`;

    // ── 层3: 左分时堆叠柱状图(网关 series 优先, 合并未代理本地桶) + 右三维排行 ──
    const dayKeyOf = (ts) => {
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const hourKeyOf = (ts) => dayKeyOf(ts) + 'T' + String(new Date(ts).getHours()).padStart(2, '0');
    let trendData = stats.trend || [];
    if (mu && Array.isArray(mu.series) && mu.series.length) {
      trendData = mu.series.map(s => {
        const ts = Date.parse(s.time);
        const key = Number.isFinite(ts) ? (mu.bucket === 'hour' ? hourKeyOf(ts) : dayKeyOf(ts)) : String(s.label || '');
        const b = {
          key, label: s.label || key,
          in: Math.max(0, s.input || 0), out: Math.max(0, s.output || 0), cr: Math.max(0, s.cache_read || 0),
          tot: Math.max(0, (s.input || 0) + (s.output || 0) + (s.cache_read || 0) + (s.cache_write || 0)),
          net: Math.max(0, (s.input || 0) + (s.output || 0) + (s.cache_write || 0)),
          tools: 0, turns: Math.max(0, s.calls || 0), cost: Math.max(0, s.cost || 0)
        };
        const m = stats.bucketAg && stats.bucketAg.get(key);
        if (m) {
          for (const [agId, ad] of m.entries()) {
            if (gwIds.has(agId)) continue;
            b.in += ad.in; b.out += ad.out; b.cr += ad.cr; b.tot += ad.tot; b.net += ad.net;
            b.tools += ad.tools; b.turns += ad.turns; b.cost += ad.cost;
          }
        }
        return b;
      });
    }
    const hasData = mu ? (trendData.length > 0 || (mu.agents || []).length > 0 || stats.rows.length > 0) : stats.rows.length > 0;
    let mainHtml = '';
    if (!hasData) {
      mainHtml = '<div class="tw-au-empty">该周期暂无用量记录</div>';
    } else {
      this._auLastTrend = trendData;
      const trendTitle = range === 'today' ? '逐时用量趋势' : '每日用量趋势';
      const trendHtml = `<div class="tw-au-trend"><div class="tw-au-trend-title">${trendTitle}<span class="tw-au-mini-legend"><i class="lg-in"></i>输入<i class="lg-out"></i>输出<i class="lg-cr"></i>缓存</span>${momHtml}${metricSeg}</div>${this._auTrendChart(trendData, metric)}</div>`;

      const rankRows = this._mqRankRows(mu, stats, gwIds);
      const metricOf = (r) => metric === 'net' ? r.net : metric === 'tools' ? (r.tools || 0) : r.tokens;
      const maxMv = Math.max(1, ...rankRows.map(metricOf));
      const rowsHtml = rankRows.length ? rankRows.map((r) => {
        const segSum = Math.max(1, r.input + r.output + r.cache);
        const wIn = (r.input / segSum) * 100;
        const wOut = (r.output / segSum) * 100;
        const wCache = Math.max(0, 100 - wIn - wOut);
        const mv = metricOf(r);
        const barW = mv > 0 ? Math.max(2, (mv / maxMv) * 100) : 0;
        const segsHtml = r.tokens > 0 ? `<span class="tw-au-seg tw-au-seg-in" style="width:${wIn.toFixed(1)}%"></span><span class="tw-au-seg tw-au-seg-out" style="width:${wOut.toFixed(1)}%"></span><span class="tw-au-seg tw-au-seg-cache" style="width:${wCache.toFixed(1)}%"></span>` : '';
        const rk = `mq|${this._mqRankTab}|${r.id || r.name}`;
        const expanded = this._agentUsageExpanded.has(rk);
        let icon = '';
        if (r.gw) {
          icon = this._mqProviderIcon({ icon: r.iconKey, provider: r.iconKey, name: r.name }, 12);
        } else {
          try { icon = getAgentBrandSvg(r.id, 12); } catch (e) {}
          if (!icon) icon = this._mqProviderIcon({ icon: '', provider: '', name: r.name }, 12);
        }
        const subTxt = r.sub ? `<i class="tw-mq-row-sub">${escapeHtml(r.sub)}</i>` : '';
        const cntTxt = r.gw ? `${r.calls}调用` : `${r.turns}轮`;
        const expandHtml = expanded ? this._mqRowExpandHtml(r, fmt, full) : '';
        const tip = `输入 ${full(r.input)} · 输出 ${full(r.output)} · 缓存 ${full(r.cache)}${r.costUsd > 0.001 ? ' · ~$' + r.costUsd.toFixed(2) : ''}`;
        return `
          <div class="tw-au-row${expanded ? ' expanded' : ''}" data-rk="${escapeHtml(rk)}" title="${escapeHtml(tip)}">
            <div class="tw-au-row-main">
              <span class="tw-au-name">${icon}<span>${escapeHtml(r.name)}</span>${subTxt}</span>
              <div class="tw-au-bar-wrap"><div class="tw-au-bar" style="width:${barW.toFixed(1)}%">${segsHtml}</div></div>
              <span class="tw-au-meta"><b>${fmt(mv)}</b>${metric === 'tools' ? ' 次' : ' tok'} · ${cntTxt}<span class="tw-au-caret">›</span></span>
            </div>
            ${expandHtml}
          </div>`;
      }).join('') : (this._mqRankTab === 'accounts'
        ? '<div class="tw-au-empty">本地账本不含账号维度 · 启动 Magpie 网关后可见</div>'
        : '<div class="tw-au-empty">该周期暂无用量记录</div>');
      const rankHead = `
        <div class="tw-mq-rank-head">
          <div class="tw-au-metric-seg" role="tablist">
            <button type="button" class="tw-au-metric-btn tw-mq-tab-btn${this._mqRankTab === 'agents' ? ' active' : ''}" data-t="agents">AGENT</button>
            <button type="button" class="tw-au-metric-btn tw-mq-tab-btn${this._mqRankTab === 'models' ? ' active' : ''}" data-t="models">模型</button>
            <button type="button" class="tw-au-metric-btn tw-mq-tab-btn${this._mqRankTab === 'accounts' ? ' active' : ''}" data-t="accounts">账号</button>
          </div>
        </div>`;
      mainHtml = `<div class="tw-au-main">${trendHtml}<div class="tw-au-rank">${rankHead}${rowsHtml}</div></div>`;
    }

    // ── 层4: 页脚合计 + 精确度占比(离线)/网关调用(在线) + 等效成本 + 图例 ──
    const fusedTot = tokIn + tokOut + tokCr + tokCw;
    let footerAccHtml;
    if (mu) {
      footerAccHtml = `<i class="tw-au-acc2">网关 ${full(mu.calls || 0)} 调用 · ${mu.sessionCount || (mu.sessions || []).length || 0} 会话</i>`;
    } else {
      const totalTok = Math.max(1, t.exactTok + t.estTok);
      const exactPct = Math.round(t.exactTok / totalTok * 100);
      footerAccHtml = `<i class="tw-au-acc2">精确 ${exactPct}% / 估算 ${100 - exactPct}%</i>`;
    }
    const footerHtml = `
      <div class="tw-au-footer">
        <span class="tw-au-total">合计 <b>${fmt(fusedTot)}</b> tok ${footerAccHtml}${costUsd > 0.001 ? ` · 等效 ~$${costUsd.toFixed(2)}` : ''}</span>
        <span class="tw-au-legend">
          <span><i class="tw-au-dot" style="background:var(--g-blue,#2563EB)"></i>未缓存输入 ${fmt(tokIn)}</span>
          <span><i class="tw-au-dot" style="background:var(--g-green,#10B981)"></i>输出 ${fmt(tokOut)}</span>
          <span><i class="tw-au-dot tw-au-dot-hatch" style="background:#8B5CF6"></i>缓存读 ${fmt(tokCr)}</span>
        </span>
      </div>`;

    const quotaHtml = this._mqQuotaSectionHtml(snap);
    const statusBadge = `<span class="tw-mq-status-badge${gwOnline ? ' is-online' : ''}">${gwOnline ? 'Magpie 网关' : '本地账本'}</span>`;
    const pricePill = costUsd > 0.001 ? `<span class="tw-mq-price-pill">≈$${costUsd.toFixed(3)} 生效价格</span>` : '';

    this.agentUsageCardEl.innerHTML = `
      <div class="tw-card-header tw-au-header">
        <span>观测 · 用量与额度概览</span>
        ${statusBadge}
        ${pricePill}
        <div class="tw-trend-controls-right">
          ${rangeSeg}
          <button type="button" class="tw-mq-auto-btn${this._mqAutoRefreshSec === 5 ? ' active' : ''}" id="btnMqAuto" title="每 5 秒自动刷新">5秒</button>
          <button class="tw-trend-refresh-btn" id="btnRefreshAgentUsage" title="刷新用量统计">↻</button>
        </div>
      </div>
      ${quotaHtml}
      ${kpiHtml}
      ${mainHtml}
      ${hasData ? footerHtml : ''}
    `;

    this.agentUsageCardEl.querySelectorAll('.tw-au-range-btn').forEach(el => {
      el.onclick = () => {
        this.saveAgentUsageRange(el.dataset.r);
        this.updateAgentUsageCard();
      };
    });

    this.agentUsageCardEl.querySelectorAll('.tw-au-metric-btn[data-m]').forEach(el => {
      el.onclick = () => {
        this.saveAgentUsageMetric(el.dataset.m);
        this.updateAgentUsageCard();
      };
    });

    this.agentUsageCardEl.querySelectorAll('.tw-mq-tab-btn').forEach(el => {
      el.onclick = () => {
        this._mqRankTab = el.dataset.t || 'agents';
        this.updateAgentUsageCard(true);
      };
    });

    this.agentUsageCardEl.querySelectorAll('[data-mqcache]').forEach(el => {
      el.onclick = () => {
        this._mqIncludeCache = el.dataset.mqcache === '1';
        this.updateAgentUsageCard(true);
      };
    });

    const secToggle = this.agentUsageCardEl.querySelector('[data-mqsec]');
    if (secToggle) {
      secToggle.onclick = () => {
        this._mqQuotaCollapsed = !this._mqQuotaCollapsed;
        this.updateAgentUsageCard(true);
      };
    }
    const maskBtn = this.agentUsageCardEl.querySelector('[data-mqmask]');
    if (maskBtn) {
      maskBtn.onclick = () => {
        this._mqMaskAccounts = !this._mqMaskAccounts;
        this.updateAgentUsageCard(true);
      };
    }

    this.agentUsageCardEl.querySelectorAll('.tw-mq-trend-head').forEach(el => {
      el.onclick = () => {
        const k2 = el.dataset.mqtrend;
        if (!k2) return;
        if (this._mqTrendExpanded.has(k2)) this._mqTrendExpanded.delete(k2);
        else this._mqTrendExpanded.add(k2);
        this.updateAgentUsageCard(true);
      };
    });

    this.agentUsageCardEl.querySelectorAll('.tw-mq-card-refresh').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const card = el.closest('.tw-mq-qcard');
        if (!card || !this.magpieObs) return;
        el.classList.add('spinning');
        this.magpieObs.refreshQuotaCard(card.dataset.mqprov || '', card.dataset.mquser || '')
          .finally(() => this.refreshMagpieObservability(true));
      };
    });

    const autoBtn = this.agentUsageCardEl.querySelector('#btnMqAuto');
    if (autoBtn) {
      autoBtn.onclick = () => {
        this._mqSetAutoRefresh(this._mqAutoRefreshSec === 5 ? 0 : 5);
        this.updateAgentUsageCard(true);
      };
    }

    const refreshBtn = this.agentUsageCardEl.querySelector('#btnRefreshAgentUsage');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        if (this._auLedgerCache) this._auLedgerCache.at = 0;
        // 手动刷新走节流端点 (服务端 30s 互斥锁): 在线先 POST refresh 再重拉快照; 离线仅本地重建 + 静默重试探测
        if (mu && this.magpieObs) {
          this.magpieObs.refreshQuotaCard()
            .finally(() => this.refreshMagpieObservability(true));
        } else {
          this.updateAgentUsageCard(true);
          this.refreshMagpieObservability(true);
        }
        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
      };
    }

    // 趋势日柱: hover 即览 / click 锁定; 点击空白或再次点击取消锁定
    this.agentUsageCardEl.querySelectorAll('.tw-au-day-col').forEach(col => {
      const i = +col.dataset.i;
      col.onmouseenter = () => { if (this._auDayLock == null) this._auShowDayPopover(i); };
      col.onmouseleave = () => { if (this._auDayLock == null) this._auHideDayPopover(); };
      col.onclick = (e) => {
        e.stopPropagation();
        this._auDayLock = (this._auDayLock === i) ? null : i;
        this.agentUsageCardEl.querySelectorAll('.tw-au-day-col.locked').forEach(c => c.classList.remove('locked'));
        if (this._auDayLock == null) { this._auHideDayPopover(); }
        else { col.classList.add('locked'); this._auShowDayPopover(i); }
      };
    });
    if (!this._auDocBound) {
      this._auDocBound = true;
      this._auDocClickHandler = (e) => {
        if (this._auDayLock != null && !(e.target && e.target.closest && e.target.closest('.tw-au-daily-chart'))) this._auHideDayPopover();
      };
      document.addEventListener('click', this._auDocClickHandler, true);
    }

    this.agentUsageCardEl.querySelectorAll('.tw-au-row[data-rk]').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.rk;
        if (!id) return;
        if (this._agentUsageExpanded.has(id)) this._agentUsageExpanded.delete(id);
        else this._agentUsageExpanded.add(id);
        this.updateAgentUsageCard(true);
      };
    });

    this._mqRenderedOnce = true;
  }"""

if old_constructor in workbench_part:
    workbench_part = workbench_part.replace(old_constructor, new_constructor)
    print("Replaced constructor and added tab helpers")
else:
    print("Warning: old_constructor not found in workbench_part!")

# 1b. Update onOpen & refreshVaultDocs & loadVaultDocs to prevent main-thread starvation and double full-page teardown
old_on_open_block = """  async onOpen() {
    try {
      globalThis.__twBootMark && __twBootMark('onOpen:start');
      this.setupCustomHeader();
      this.render();
      globalThis.__twBootMark && __twBootMark('onOpen:first-render');
    } catch (err) {
      console.error('[TabonKB Workbench] Initial render failed:', err);
    }

    // 文档扫描让给空闲期: 首渲染已呈现工作台骨架, 与 Obsidian 冷启动索引争主线程
    // 毫无意义——空闲再扫, 扫完增量渲染 (数据晚到零点几秒, 可交互性大幅提前)
    const _scheduleScan = (typeof requestIdleCallback === 'function')
      ? (fn) => requestIdleCallback(fn, { timeout: 1200 })
      : (fn) => setTimeout(fn, 300);
    _scheduleScan(() => {
      this.loadVaultDocs().then(() => {
        try {
          this.render();
        } catch (err) {
          console.error('[TabonKB Workbench] Post-scan render failed:', err);
          try { wkTopoWriteLog(this.app.vault.adapter.basePath, 'POSTSCAN-RENDER: ' + (err && err.stack || err)); } catch (e) {}
        }
        globalThis.__twBootMark && __twBootMark('onOpen:postscan-render');
        globalThis.__twBootFlush && __twBootFlush(this.app?.vault?.adapter?.basePath);
      }).catch(err => {
        console.error('[TabonKB Workbench] Vault scan failed:', err);
        globalThis.__twBootFlush && __twBootFlush(this.app?.vault?.adapter?.basePath);
      });
    });
  }"""

new_on_open_block = """  async onOpen() {
    try {
      globalThis.__twBootMark && __twBootMark('onOpen:start');
      this.setupCustomHeader();
      // 让出首帧给 Obsidian 原生侧边栏文件树 (File Explorer) 完成虚拟滚动测量与绘制，消除重载时左侧文件树白屏
      await new Promise(resolve => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => setTimeout(resolve, 0));
        } else {
          setTimeout(resolve, 0);
        }
      });
      this._isInitialRenderPass = true;
      try {
        this.render();
      } finally {
        this._isInitialRenderPass = false;
      }
      globalThis.__twBootMark && __twBootMark('onOpen:first-render');

      // Ctrl+←/Ctrl+→ 隐藏/展示导航栏: 核心 Keymap 未绑定 Ctrl+方向键, document 捕获即可覆盖全部页签;
      // 输入框内保留原生跳词行为 (不劫持)
      this._navRailKeyHandler = (e) => {
        if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
        if (!this.containerEl || !this.containerEl.isConnected) return;
        const t = e.target;
        if (t && t.closest && t.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return;
        e.preventDefault();
        e.stopPropagation();
        this.setNavRailCollapsed(e.code === 'ArrowLeft');
      };
      document.addEventListener('keydown', this._navRailKeyHandler, true);
      // DSH iframe (Harness 页) 内按键到不了父文档, 由注入桥接脚本 postMessage 转发
      this._navRailMsgHandler = (e) => {
        try {
          const d = e.data;
          if (d && d.type === 'tabonkb-navrail') this.setNavRailCollapsed(d.dir === 'hide');
        } catch (_) {}
      };
      window.addEventListener('message', this._navRailMsgHandler);
    } catch (err) {
      this._isInitialRenderPass = false;
      console.error('[TabonKB Workbench] Initial render failed:', err);
    }

    // 文档扫描推迟至首屏稳定后执行，且扫描完成后仅当仍处于 home 页签且无流式任务时才局部刷新，
    // 严禁在 explore(AI助手) / harness(DSH) / tools 等页签触发二次整页 container.empty() 重建！
    setTimeout(() => {
      this.loadVaultDocs().then(() => {
        try {
          const hubBusy = !!(this.agentHub && typeof this.agentHub.isStreaming === 'function' && this.agentHub.isStreaming());
          const drawerBusy = !!(this.agentDrawer && (this.agentDrawer._sendInFlight === true ||
            (this.agentDrawer.hub && typeof this.agentDrawer.hub.isStreaming === 'function' && this.agentDrawer.hub.isStreaming())));
          if (!hubBusy && !drawerBusy && this.activeTab === 'home') {
            this.render();
          }
        } catch (err) {
          console.error('[TabonKB Workbench] Post-scan render failed:', err);
          try { wkTopoWriteLog(this.app.vault.adapter.basePath, 'POSTSCAN-RENDER: ' + (err && err.stack || err)); } catch (e) {}
        }
        globalThis.__twBootMark && __twBootMark('onOpen:postscan-render');
        globalThis.__twBootFlush && __twBootFlush(this.app?.vault?.adapter?.basePath);
      }).catch(err => {
        console.error('[TabonKB Workbench] Vault scan failed:', err);
        globalThis.__twBootFlush && __twBootFlush(this.app?.vault?.adapter?.basePath);
      });
    }, 1200);
  }"""

if old_on_open_block in workbench_part:
    workbench_part = workbench_part.replace(old_on_open_block, new_on_open_block, 1)
    print("Replaced onOpen with frame-yielding and tab-guarded post-scan render")
else:
    print("Warning: old_on_open_block not found in workbench_part!")

# 1c. Throttle loadVaultDocs full-file cachedRead fallback and yield every 25 files
old_load_vault_loop = """      const docs = [];
      for (const file of mdFiles) {
        try {
          const cache = (this.app.metadataCache && typeof this.app.metadataCache.getFileCache === 'function') 
            ? (this.app.metadataCache.getFileCache(file) || {}) 
            : {};"""

new_load_vault_loop = """      const docs = [];
      let _fallbackReads = 0;
      for (let _fIdx = 0; _fIdx < mdFiles.length; _fIdx++) {
        const file = mdFiles[_fIdx];
        if (_fIdx > 0 && _fIdx % 25 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
        try {
          const cache = (this.app.metadataCache && typeof this.app.metadataCache.getFileCache === 'function') 
            ? (this.app.metadataCache.getFileCache(file) || {}) 
            : {};"""

if old_load_vault_loop in workbench_part:
    workbench_part = workbench_part.replace(old_load_vault_loop, new_load_vault_loop, 1)
    workbench_part = workbench_part.replace(
        "if (typeof vault.cachedRead === 'function' && !summary) {",
        "if (typeof vault.cachedRead === 'function' && !summary && this.activeTab === 'home' && _fallbackReads < 15) { _fallbackReads++;",
        1,
    )
    print("Updated loadVaultDocs with time-slice yielding and capped cold-start cachedRead")
else:
    print("Warning: old_load_vault_loop not found in workbench_part!")

# 2. Update onClose
old_on_close = """  async onClose() {
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
  }"""

new_on_close = """  async _disposeViewResources() {
    // bak 后部还有一个同名 onClose() (JS 类同名方法后者覆盖), 全量清理移至此方法并由其调用,
    // 否则本块清理 (定时器/订阅/子视图/画布) 永远是死代码。
    this._disposeStageResources();
    if (this._mqAutoRefreshTimer) {
      clearInterval(this._mqAutoRefreshTimer);
      this._mqAutoRefreshTimer = null;
    }
    if (this._refreshRenderTimer) {
      clearTimeout(this._refreshRenderTimer);
      this._refreshRenderTimer = null;
    }
    if (this._auDocClickHandler) {
      document.removeEventListener('click', this._auDocClickHandler, true);
      this._auDocClickHandler = null;
      this._auDocBound = false;
    }
    if (this._navRailKeyHandler) {
      document.removeEventListener('keydown', this._navRailKeyHandler, true);
      this._navRailKeyHandler = null;
    }
    if (this._navRailMsgHandler) {
      window.removeEventListener('message', this._navRailMsgHandler);
      this._navRailMsgHandler = null;
    }
    this.closeHeatmapPopover();
    if (this.exploreView) {
      try { this.exploreView.dispose && this.exploreView.dispose(); } catch (_) {}
      this.exploreView = null;
    }
    if (this.rssCenter) {
      this.rssCenter.dispose();
      this.rssCenter = null;
    }
    if (this.phoneComp) {
      this.phoneComp.dispose();
      this.phoneComp = null;
    }
    if (this.jiraPlatform) {
      this.jiraPlatform = null;
    }
    if (this.topicView) {
      try { this.topicView.dispose && this.topicView.dispose(); } catch (_) {}
      this.topicView = null;
    }
    if (this.topicService) {
      // 插件级单例 (this._ownTopicService === false) 不得由视图 dispose
      if (this._ownTopicService !== false) {
        try { this.topicService.dispose && this.topicService.dispose(); } catch (_) {}
      }
      this.topicService = null;
    }
    this._ownTopicService = false;
    if (this.jiraCard) {
      this.jiraCard.dispose();
      this.jiraCard = null;
    }
    if (this.rssCard) {
      this.rssCard.dispose();
      this.rssCard = null;
    }
    if (this.weknoraManage) {
      this.weknoraManage.dispose();
      this.weknoraManage = null;
    }
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
    if (this._homeTrendResizeObs) {
      try { this._homeTrendResizeObs.disconnect(); } catch (e) {}
      this._homeTrendResizeObs = null;
    }
    try {
      const remainingLeaves = this.app?.workspace?.getLeavesOfType?.(VIEW_TYPE_WORKBENCH) || [];
      if (remainingLeaves.length <= 1) {
        if (typeof document !== 'undefined' && document.body) {
          document.body.classList.remove('tw-workbench-active', 'tw-has-workbench');
          const sb = document.querySelector('.status-bar');
          if (sb) sb.style.removeProperty('display');
        }
      }
    } catch (_) {}
  }"""

if old_on_close in workbench_part:
    workbench_part = workbench_part.replace(old_on_close, new_on_close)
    print("Replaced onClose")

# 2b. Rewrite renderOverviewMode: overview reflects knowledge-base state only (no fake fallbacks, no task block)
old_overview = """    // 1. Knowledge Stats 4-Grid
    const stats = this.getVaultStats();
    const nodeCount = this.graphData.nodes.length || stats.totalDocs;
    const edgeCount = this.graphData.edges.length || 128;
    const coreCount = this.graphData.nodes.filter(n => n.importance === 'core').length || 17;

    const kpiSection = wrap.createDiv();
    kpiSection.innerHTML = `
      <div class="tw-overview-section-title">
        <span>KNOWLEDGE 资产拓扑</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">全库穿透感知</span>
      </div>
      <div class="tw-kpi-grid-4">
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num">${nodeCount}</div>
          <div class="tw-kpi-box-label">知识资产 (Nodes)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#059669;">${edgeCount}</div>
          <div class="tw-kpi-box-label">知识关系 (Edges)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#D97706;">8</div>
          <div class="tw-kpi-box-label">知识模块 (Clusters)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#7C3AED;">${coreCount}</div>
          <div class="tw-kpi-box-label">核心知识 (Hubs)</div>
        </div>
      </div>
    `;

    // 2. Knowledge Composition (Progress bars)
    const compSection = wrap.createDiv();
    const modulesData = [
      { name: '充电/CHG', count: stats.modules.charger || 17, color: '#F59E0B' },
      { name: 'Spec/规范', count: stats.modules.spec || 14, color: '#10B981' },
      { name: 'Display', count: stats.modules.display || 2, color: '#3B82F6' },
      { name: 'Power', count: stats.modules.power || 2, color: '#EF4444' },
      { name: 'Crash', count: stats.modules.crash || 1, color: '#EC4899' },
      { name: 'Camera', count: stats.modules.camera || 1, color: '#8B5CF6' }
    ];

    const maxCount = Math.max(...modulesData.map(m => m.count), 1);

    let compBarsHtml = modulesData.map(m => {
      const pct = Math.round((m.count / maxCount) * 100);
      return `
        <div class="tw-comp-row">
          <span class="tw-comp-name" title="${m.name}">${m.name}</span>
          <div class="tw-comp-track">
            <div class="tw-comp-fill" style="width:${pct}%; background:${m.color};"></div>
          </div>
          <span class="tw-comp-count">${m.count}</span>
        </div>
      `;
    }).join('');

    compSection.innerHTML = `
      <div class="tw-overview-section-title">
        <span>知识构成 (COMPOSITION)</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">模块分布</span>
      </div>
      <div class="tw-comp-bar-wrap">
        ${compBarsHtml}
      </div>
    `;

    // 3. Task Stats & Closure Rate
    const taskSection = wrap.createDiv();
    taskSection.innerHTML = `
      <div class="tw-overview-section-title" style="margin-top:2px;">
        <span>TASK 研发攻坚跟踪</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">6 项聚焦</span>
      </div>
      <div class="tw-task-summary-grid">
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:var(--text-normal);">6</div>
          <div class="tw-task-mini-lbl">活跃任务</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#C2410C;">3</div>
          <div class="tw-task-mini-lbl">攻坚排查</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#B45309;">1</div>
          <div class="tw-task-mini-lbl">阻塞等原厂</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#15803D;">2</div>
          <div class="tw-task-mini-lbl">已闭环</div>
        </div>
      </div>
      <div class="tw-closure-bar-wrap">
        <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-muted);">
          <span>收敛闭环率</span>
          <span style="font-weight:700; color:#10B981; font-family:monospace;">33% (稳步推进)</span>
        </div>
        <div style="height:6px; background:var(--background-secondary, #E2E8F0); border-radius:3px; overflow:hidden;">
          <div style="width:33%; height:100%; background:#10B981; border-radius:3px;"></div>
        </div>
      </div>
    `;
"""

new_overview = """    // 1. 文档打标：命名规范后缀 _平台_模块_类型 优先（与盘点报告同口径），缺失回退路径/frontmatter
    const KNOWN_DOCTYPES = ['REF','GUIDE','NOTE','ARCH','SPEC','RPT','CHK','CASE','LOG','IDX','CODE','PLAN','DBG'];
    const PATH_MODULE_MAP = [
      ['05-charger', 'CHG'], ['08-power', 'PWR'], ['02-camera', 'CAM'], ['01-display', 'DISP'],
      ['04-usb', 'USB'], ['13-security', 'SEC'], ['10-connectivity', 'CONN'], ['03-audio', 'AUD'],
      ['02-os-kernel', 'KERN'], ['07-touch', 'TP'], ['06-sensor', 'SEN'], ['09-storage', 'STOR'],
      ['11-modem', 'MODEM'], ['12-input', 'INPUT'], ['05-toolchain', 'BUILD'], ['06-spec', 'SPEC']
    ];
    const MODULE_LABELS = { PWR: 'PWR 电源/热', CHG: 'CHG 充电', CAM: 'CAM 摄像头', KERN: 'KERN 内核', DISP: 'DISP 显示', USB: 'USB', SEC: 'SEC 安全', CONN: 'CONN 连接', AUD: 'AUD 音频', GEN: 'GEN 通用', HW: 'HW 硬件', TP: 'TP 触摸', SPEC: 'SPEC 规范', BUILD: 'BUILD 工具链', STOR: 'STOR 存储', MODEM: 'MODEM  modem', SEN: 'SEN 传感器', INPUT: 'INPUT 输入', TEST: 'TEST 测试', DBG: 'DBG 调试', PROJ: 'PROJ 项目', PLAT: 'PLAT 平台', META: 'META 治理' };
    const DOCTYPE_LABELS = { REF: 'REF 原厂/第三方原文', GUIDE: 'GUIDE 操作指南', NOTE: 'NOTE 笔记', ARCH: 'ARCH 架构', SPEC: 'SPEC 规范', RPT: 'RPT 报告', CHK: 'CHK 检查表', CASE: 'CASE 案例', LOG: 'LOG 日志', IDX: 'IDX 索引', CODE: 'CODE 代码', PLAN: 'PLAN 计划', DBG: 'DBG 调试', IMG: 'IMG 图像', DATA: 'DATA 表格', ATT: 'ATT 附件' };
    const tagOf = (d) => {
      const base = (d.path || '').split('/').pop().replace(/\\.md$/i, '');
      const toks = base.split('_');
      let platform = '', module = '', doctype = '';
      if (toks.length >= 3) {
        const t = toks[toks.length - 1].toUpperCase();
        const m = toks[toks.length - 2].toUpperCase();
        const p = toks[toks.length - 3].toUpperCase();
        if (KNOWN_DOCTYPES.includes(t)) {
          doctype = t;
          if (/^[A-Z][A-Z0-9-]{1,8}$/.test(m)) module = m;
          if (/^[A-Z][A-Z0-9-]{1,8}$/.test(p)) platform = p;
        }
      }
      if (!module) {
        const pl = (d.path || '').toLowerCase();
        const hit = PATH_MODULE_MAP.find(([k]) => pl.includes(k));
        module = hit ? hit[1] : '';
      }
      if (!doctype) doctype = (d.type && d.type !== 'DOC') ? String(d.type).toUpperCase() : '';
      if (!platform) platform = String(d.platform || '').toUpperCase();
      return { platform: platform || 'COMMON', module: module || '未打标', doctype: doctype || '未打标' };
    };
    const tagged = this.realDocs.map(d => Object.assign({ doc: d, vendor: /vendor-docs/i.test(d.path || '') }, tagOf(d)));
    // 全量资产口径：vault 全部文件（含原厂原文/附件），与盘点报告同口径
    const PATH_MODULE_RULES = [
      ['charger', 'CHG'], ['battery', 'CHG'], ['chg', 'CHG'],
      ['power', 'PWR'], ['thermal', 'PWR'], ['pmic', 'PWR'],
      ['camera', 'CAM'],
      ['kernel', 'KERN'],
      ['display', 'DISP'],
      ['usb', 'USB'], ['typec', 'USB'],
      ['security', 'SEC'], ['tee', 'SEC'],
      ['connect', 'CONN'], ['wifi', 'CONN'], ['bluetooth', 'CONN'],
      ['audio', 'AUD'],
      ['touch', 'TP'],
      ['storage', 'STOR'], ['emmc', 'STOR'],
      ['modem', 'MODEM'], ['ril', 'MODEM'],
      ['sensor', 'SEN'],
      ['input', 'INPUT'],
      ['spec', 'SPEC'],
      ['toolchain', 'BUILD'], ['compiler', 'BUILD'],
      ['crash', 'DBG'], ['panic', 'DBG'], ['debug', 'DBG'], ['trace', 'DBG'],
      ['test', 'TEST'], ['cert', 'TEST'],
      ['hardware', 'HW'], ['datasheet', 'HW'],
      ['project', 'PROJ'],
      ['platform', 'PLAT']
    ];
    const EXT_DOCTYPE = { '.pdf': 'REF', '.doc': 'REF', '.docx': 'REF', '.html': 'REF', '.htm': 'REF',
      '.png': 'IMG', '.jpg': 'IMG', '.jpeg': 'IMG', '.svg': 'IMG',
      '.csv': 'DATA', '.xlsx': 'DATA', '.xls': 'DATA',
      '.js': 'CODE', '.py': 'CODE', '.ts': 'CODE',
      '.pptx': 'RPT', '.ppt': 'RPT' };
    const allFiles = (this.app && this.app.vault && typeof this.app.vault.getFiles === 'function') ? this.app.vault.getFiles() : [];
    const fileTags = allFiles.map(f => {
      const p = (f.path || '').toLowerCase();
      const vendor = p.includes('08-vendor-docs');
      const nameNoExt = (f.name || '').replace(/\\.[^.]+$/, '');
      const toks = nameNoExt.split('_');
      const suffixed = toks.length >= 3 && KNOWN_DOCTYPES.includes(toks[toks.length - 1].toUpperCase());
      let module = '';
      if (suffixed) {
        const m = toks[toks.length - 2].toUpperCase();
        if (/^[A-Z][A-Z0-9-]{1,8}$/.test(m)) module = m;
      }
      if (!module) {
        const hit = PATH_MODULE_RULES.find(([k]) => p.includes(k));
        module = hit ? hit[1] : '';
      }
      if (!module) module = p.startsWith('99-meta') ? 'META' : (p.startsWith('00-inbox') ? 'META' : 'GEN');
      const ext = (/\\.[a-z0-9]+$/i.exec(f.name || '') || [''])[0].toLowerCase();
      let doctype;
      if (ext === '.md') doctype = suffixed ? toks[toks.length - 1].toUpperCase() : (vendor ? 'REF' : 'NOTE');
      else if (vendor) doctype = 'REF';
      else doctype = EXT_DOCTYPE[ext] || 'ATT';
      let platform = '';
      if (suffixed) platform = toks[toks.length - 3].toUpperCase();
      if (!/^[A-Z][A-Z0-9-]{0,8}$/.test(platform || '')) platform = '';
      if (!platform) {
        if (p.includes('qcom') || p.includes('qualcomm')) platform = 'QCOM';
        else if (p.includes('mtk') || p.includes('mediatek')) platform = 'MTK';
        else if (p.includes('unisoc')) platform = 'UNISOC';
        else if (p.includes('samsung') || p.includes('exynos')) platform = 'EXYNOS';
        else if (p.includes('multi')) platform = 'MULTI';
        else platform = 'COMMON';
      }
      return { module, doctype, platform, vendor };
    });
    const clusterCount = new Set(fileTags.map(t => t.module).filter(m => m && m !== 'GEN' && m !== 'META')).size;
    const doctypeCount = new Set(fileTags.map(t => t.doctype)).size;
    const vendorCount = fileTags.filter(t => t.vendor).length;

    const kpiSection = wrap.createDiv();
    kpiSection.innerHTML = `
      <div class="tw-overview-section-title">
        <span>KNOWLEDGE 资产概览</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">命名规范打标 · ${this.realDocs.length} 篇</span>
      </div>
      <div class="tw-kpi-grid-4">
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num">${allFiles.length}</div>
          <div class="tw-kpi-box-label">资产总数 (含原文)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#059669;">${vendorCount}</div>
          <div class="tw-kpi-box-label">原厂原文</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#D97706;">${clusterCount}</div>
          <div class="tw-kpi-box-label">知识模块</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#7C3AED;">${this.realDocs.length}</div>
          <div class="tw-kpi-box-label">知识文档 (md)</div>
        </div>
      </div>
    `;

    // 2. 模块 / 文档类型分布：与盘点报告同口径（命名规范标签），仅展示 count>0 降序
    const MOD_COLOR_POOL = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#8B5CF6', '#0EA5E9', '#84CC16'];
    const barBlock = (title, sub, counts) => {
      let list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      if (list.length > 8) {
        const head = list.slice(0, 7);
        const rest = list.slice(7).reduce((a, [, c]) => a + c, 0);
        list = [...head, ['其他', rest]];
      }
      const mx = Math.max(...list.map(([, c]) => c), 1);
      const rows = list.length ? list.map(([name, count], i) => {
        const pct = Math.round((count / mx) * 100);
        return `
        <div class="tw-comp-row">
          <span class="tw-comp-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
          <div class="tw-comp-track">
            <div class="tw-comp-fill" style="width:${pct}%; background:${MOD_COLOR_POOL[i % MOD_COLOR_POOL.length]};"></div>
          </div>
          <span class="tw-comp-count">${count}</span>
        </div>`;
      }).join('') : '<div class="tw-overview-empty">暂无数据</div>';
      return `
      <div class="tw-overview-section-title">
        <span>${title}</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">${sub}</span>
      </div>
      <div class="tw-comp-bar-wrap">${rows}</div>`;
    };
    const modCounts = new Map();
    for (const t of fileTags) {
      const label = MODULE_LABELS[t.module] || t.module;
      modCounts.set(label, (modCounts.get(label) || 0) + 1);
    }
    const typeCounts = new Map();
    for (const t of fileTags) {
      const label = DOCTYPE_LABELS[t.doctype] || t.doctype;
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    }

    const compSection = wrap.createDiv();
    compSection.innerHTML = barBlock('模块分布 (MODULE)', '命名规范口径', modCounts)
      + barBlock('文档类型 (DOCTYPE)', '命名规范口径', typeCounts);

    // 3. 平台分布 + 原厂只读区 + 治理活跃（纯知识库视角）
    const platCounts = new Map();
    for (const t of fileTags) platCounts.set(t.platform, (platCounts.get(t.platform) || 0) + 1);
    const vendorByPlat = new Map();
    for (const t of fileTags) if (t.vendor) vendorByPlat.set(t.platform, (vendorByPlat.get(t.platform) || 0) + 1);
    const vendorDesc = [...vendorByPlat.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p} ${c}`).join(' / ') || '暂无';
    const nowTs = Date.now();
    const added7 = this.realDocs.filter(d => d.mtime && nowTs - d.mtime <= 7 * 86400000).length;
    const added30 = this.realDocs.filter(d => d.mtime && nowTs - d.mtime <= 30 * 86400000).length;
    const untagged = tagged.filter(t => t.module === '未打标').length;
    const withSummary = this.realDocs.filter(d => d.summary && d.summary !== '（暂无详细说明）').length;
    const summaryRate = this.realDocs.length ? Math.round((withSummary / this.realDocs.length) * 100) : 0;

    const kbSection = wrap.createDiv();
    const platCells = ['QCOM', 'MTK', 'UNISOC', 'MULTI', 'COMMON'].map(pl => `
      <div class="tw-task-mini-cell">
        <div class="tw-task-mini-val" style="color:var(--text-normal);">${platCounts.get(pl) || 0}</div>
        <div class="tw-task-mini-lbl">${pl}</div>
      </div>
    `).join('');
    kbSection.innerHTML = `
      <div class="tw-overview-section-title" style="margin-top:2px;">
        <span>PLATFORM 平台分布</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">命名规范口径</span>
      </div>
      <div class="tw-task-summary-grid" style="grid-template-columns:repeat(5,1fr);">
        ${platCells}
      </div>
      <div style="margin-top:6px; padding:6px 9px; font-size:10.5px; color:var(--text-muted,#64748B); background:var(--background-secondary,#F1F5F9); border-radius:6px;">
        原厂只读区 <strong style="color:var(--text-normal);">${vendorCount}</strong> 篇 · ${escapeHtml(vendorDesc)}
      </div>
      <div class="tw-overview-section-title" style="margin-top:8px;">
        <span>ACTIVITY 活跃与治理</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">按文件_mtime_统计</span>
      </div>
      <div class="tw-task-summary-grid">
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#15803D;">${added7}</div>
          <div class="tw-task-mini-lbl">近 7 天新增</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#059669;">${added30}</div>
          <div class="tw-task-mini-lbl">近 30 天新增</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#C2410C;">${untagged}</div>
          <div class="tw-task-mini-lbl">未打标文档</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#2563EB;">${summaryRate}%</div>
          <div class="tw-task-mini-lbl">摘要完备率</div>
        </div>
      </div>
    `;
"""

if old_overview in workbench_part:
    workbench_part = workbench_part.replace(old_overview, new_overview)
    print("Replaced overview with knowledge-only stats")
else:
    print("Warning: old_overview not found in workbench_part!")

# 3. Replace render() method with Multi-Tab rendering methods
# Locate render() from 'render() {' to 'renderContextPanel() {'
idx_render = workbench_part.find('render() {')
idx_cpanel = workbench_part.find('renderContextPanel() {')

if idx_render != -1 and idx_cpanel != -1:
    multi_tab_render_methods = """render() {
    try {
      this.closeExploreSubmenu();
      this.closeManageSubmenu();
      this.closeToolsSubmenu();
      // R18: Harness 页签已挂载且 DOM 仍在文档树中 -> 复用现有视图, 不做整体重建
      // (旧实现每次 render() 都 empty() 容器 -> iframe 重新加载 -> DSH 会话丢失)
      if (this.activeTab === 'harness' && this._harnessMounted && this.harnessView &&
          this.harnessView.containerEl && this.harnessView.containerEl.isConnected) {
        const live = this.getContainer();
        if (live) {
          this.ensureStylesheet(live.ownerDocument);
          const activePlugin = this.plugin || (this.app?.plugins?.plugins?.['tabonkb-workbench']);
          const t = (activePlugin && activePlugin.settings && activePlugin.settings.workbenchTheme) || 'fresh';
          if (typeof TabonKBThemeEngine !== 'undefined' && activePlugin) {
            TabonKBThemeEngine.applyTokensToElement(live, t, activePlugin.settings?.workbenchThemeMode || 'auto', activePlugin.settings?.workbenchWallpaper || 'aurora');
          } else {
            live.removeClass('tw-theme-standard', 'tw-theme-fresh');
            live.addClass(`tw-theme-${t}`);
          }
        }
        return;
      }
      const container = this.getContainer();
      if (!container) return;
      this.ensureStylesheet(container.ownerDocument);
      this.setupCustomHeader();
      globalThis.__twRenderCount = (globalThis.__twRenderCount || 0) + 1;
      // 整页重建前释放上一页签活跃资源 (ForceGraph 仿真 rAF / ResizeObserver / document 监听)
      this._disposeStageResources();
      container.empty();
      this._harnessMounted = false; // 整体重建后旧挂载标记必然失效
      container.addClass('tabonkb-workbench-container', 'with-drawer');
      try {
        if (typeof document !== 'undefined' && document.body) {
          document.body.classList.add('tw-workbench-active', 'tw-has-workbench');
          const sb = document.querySelector('.status-bar');
          if (sb) sb.style.setProperty('display', 'none', 'important');
        }
      } catch (_) {}
      const activePlugin = this.plugin || (this.app?.plugins?.plugins?.['tabonkb-workbench']);
      const curTheme = (activePlugin && activePlugin.settings && activePlugin.settings.workbenchTheme) || 'fresh';
      if (typeof TabonKBThemeEngine !== 'undefined' && activePlugin) {
        TabonKBThemeEngine.applyTokensToElement(container, curTheme, activePlugin.settings?.workbenchThemeMode || 'auto', activePlugin.settings?.workbenchWallpaper || 'aurora');
      } else {
        container.removeClass('tw-theme-standard', 'tw-theme-fresh');
        container.addClass(`tw-theme-${curTheme}`);
      }

      // Global right-click copy menu for any selected text
      container.oncontextmenu = (e) => {
        const selection = window.getSelection()?.toString();
        if (selection && selection.trim().length > 0) {
          const MenuCls = (typeof Menu !== 'undefined' ? Menu : (this.app?.Menu || window.Menu));
          if (MenuCls) {
            const menu = new MenuCls();
            menu.addItem((item) => {
              item.setTitle('复制 (Copy)')
                .setIcon('copy')
                .onClick(async () => {
                  try {
                    await navigator.clipboard.writeText(selection);
                    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (this.app?.Notice || window.Notice);
                    if (NoticeCls) new NoticeCls('✓ 已复制到剪贴板', 2000);
                  } catch (err) {
                    console.warn('[TabonKB Workbench] Copy failed:', err);
                  }
                });
            });
            menu.showAtMouseEvent(e);
            e.preventDefault();
          }
        }
      };

      const layout = container.createDiv({ cls: 'tabonkb-workbench-layout' });

      // 1. Left Navigation Rail
      this.renderNavRail(layout);

      // 2. Main Stage Area (Top Bar + Dynamic View Stage)
      const mainPanel = layout.createDiv({ cls: 'tabonkb-workbench-main' });

      // 3. Mount Pi Agent Hub Drawer into layout (docked on right across all tabs)
      // 探索页 ai 子页由 renderExploreTab → renderAiSubView 挂载到 aiWrap (studio 全宽)，
      // 此处跳过，避免同一次 render() 内先普通模式挂载又立刻搬到 studio 容器造成二次挂载
      if (!(this.activeTab === 'explore' && this.getExploreSubTab() === 'ai')) {
        this.agentDrawer.mount(layout);
      }

      // 4. Render Context-Aware Top Bar.
      // Explore owns its own sub-navigation and search surface, so the global
      // search/Agent Hub row would only duplicate controls on that page.
      if (this.activeTab !== 'explore' && this.activeTab !== 'manage' && this.activeTab !== 'harness' && this.activeTab !== 'tools') {
        this.renderTopBar(mainPanel);
      }

      // 5. Render Stage Container for the Active Tab
      const stage = mainPanel.createDiv({ cls: 'tw-workbench-stage' });

      if (this.activeTab === 'tasks') {
        this.renderTasksTab(stage);
      } else if (this.activeTab === 'news') {
        this.renderNewsTab(stage);
      } else if (this.activeTab === 'explore') {
        stage.addClass('tw-stage-explore', 'tw-stage-fullbleed');
        mainPanel.addClass('tw-main-explore', 'tw-main-fullbleed');
        this.renderExploreTab(stage);
      } else if (this.activeTab === 'tools') {
        stage.addClass('tw-stage-tools', 'tw-stage-fullbleed');
        mainPanel.addClass('tw-main-tools', 'tw-main-fullbleed');
        this.renderToolsTab(stage);
      } else if (this.activeTab === 'harness') {
        stage.addClass('tw-stage-harness', 'tw-stage-fullbleed');
        mainPanel.addClass('tw-main-harness', 'tw-main-fullbleed');
        this.renderHarnessTab(stage);
      } else if (this.activeTab === 'manage') {
        stage.addClass('tw-stage-manage', 'tw-stage-fullbleed');
        mainPanel.addClass('tw-main-manage', 'tw-main-fullbleed');
        this.renderManageTab(stage);
      } else {
        this.renderHomeTab(stage);
      }
    } catch (err) {
      console.error('[TabonKB Workbench] Render exception:', err);
      const container = this.getContainer();
      if (container) {
        container.empty();
        const errCard = container.createDiv({ cls: 'tw-card' });
        errCard.style.padding = '32px';
        errCard.style.textAlign = 'center';
        errCard.style.maxWidth = '640px';
        errCard.style.margin = '40px auto';
        errCard.innerHTML = `
          <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
          <div style="font-size: 16px; font-weight: 600; color: #EF4444; margin-bottom: 8px;">工作台界面渲染异常</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px; font-family: monospace;">${escapeHtml(err.message || String(err))}</div>
          <button class="tw-chip" id="twBtnRetry" style="padding: 6px 18px; font-size: 12px; cursor: pointer;">点击重新初始化</button>
        `;
        const btn = errCard.querySelector('#twBtnRetry');
        if (btn) btn.onclick = () => this.refreshVaultDocs();
      }
    }
  }

  _disposeStageResources() {
    // 释放当前页签渲染产生的活跃资源: container.empty() 只清 DOM 子树,
    // ForceGraph 的 rAF 仿真/ResizeObserver/document click 闭包仍持有旧实例,
    // 叠加事件风暴重渲染会造成僵尸仿真堆积与主线程饥饿。
    if (this.graphCanvas) {
      try { this.graphCanvas.dispose && this.graphCanvas.dispose(); } catch (e) {}
      this.graphCanvas = null;
    }
    if (this._homeTrendResizeObs) {
      try { this._homeTrendResizeObs.disconnect(); } catch (e) {}
      this._homeTrendResizeObs = null;
    }
    this.homeTrendCardEl = null;
    this.homeHeatCardEl = null;
    this.agentUsageCardEl = null;
    this.contextCard = null;
    this.tableCard = null;
  }

  getExploreSubTab() {
    if (this.exploreView && this.exploreView.activeSubTab) return this.exploreView.activeSubTab;
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-explore-subtab');
        if (s === 'ai' || s === 'search') return s;
      }
    } catch (e) {}
    return 'ai';
  }

  setExploreSubTab(sub) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('tabonkb-explore-subtab', sub);
    } catch (e) {}
    if (this.exploreView) {
      // 内部持久化并重渲染探索页自身, 保留检索结果等实例状态 (不整页重绘)
      this.exploreView.setSubTab(sub);
    } else {
      this.render();
    }
    // 选定后收起子选择菜单
    this.closeExploreSubmenu();
  }

  toggleExploreSubmenu(anchorEl) {
    const container = this.getContainer ? this.getContainer() : null;
    if (!container) return;
    if (container.querySelector('.tw-explore-submenu')) {
      this.closeExploreSubmenu();
      return;
    }
    const cur = this.getExploreSubTab();
    const subs = [
      { id: 'ai', label: 'AI助手', icon: 'robot' },
      { id: 'search', label: '平台资源检索', icon: 'search' }
    ];
    const menu = container.createDiv({ cls: 'tw-explore-submenu' });
    for (const s of subs) {
      const item = menu.createEl('button', { cls: `tw-explore-submenu-item ${cur === s.id ? 'active' : ''}` });
      item.innerHTML = `
        <span class="tw-explore-submenu-icon">${getIconPark(s.icon, 15)}</span>
        <span class="tw-explore-submenu-label">${s.label}</span>
      `;
      item.onclick = () => this.setExploreSubTab(s.id);
    }
    // 对齐「探索」按钮, 紧贴侧栏右侧弹出 (top 叠加容器滚动偏移)
    const cRect = container.getBoundingClientRect();
    const aRect = anchorEl.getBoundingClientRect();
    menu.style.top = Math.round(aRect.top - cRect.top + container.scrollTop) + 'px';
    menu.style.left = Math.round(aRect.right - cRect.left + 8) + 'px';
    // 点击外部 / 再次点击触发器时关闭 (延迟挂接, 避免本次点击立即触发)
    const closer = (e) => {
      if (!menu.contains(e.target) && !anchorEl.contains(e.target)) this.closeExploreSubmenu();
    };
    this._exploreSubmenuCloser = closer;
    setTimeout(() => document.addEventListener('pointerdown', closer, true), 0);
  }

  closeExploreSubmenu() {
    if (this._exploreSubmenuCloser) {
      try { document.removeEventListener('pointerdown', this._exploreSubmenuCloser, true); } catch (e) {}
      this._exploreSubmenuCloser = null;
    }
    const container = this.getContainer ? this.getContainer() : null;
    const menu = container ? container.querySelector('.tw-explore-submenu') : null;
    if (menu) menu.remove();
  }

  getManageSubTab() {
    if (this.weknoraManage && this.weknoraManage.activeSubTab) return this.weknoraManage.activeSubTab;
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-manage-subtab');
        if (s === 'graph' || s === 'documents' || s === 'sync' || s === 'webview') return s;
      }
    } catch (e) {}
    return 'graph';
  }

  setManageSubTab(sub) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('tabonkb-manage-subtab', sub);
    } catch (e) {}
    if (this.weknoraManage) {
      // 内部持久化并重挂载对应子视图, 保留顶栏心跳/知识库等实例状态 (不整页重绘)
      this.weknoraManage.setSubTab(sub);
    } else {
      this.render();
    }
    // 选定后收起子选择菜单
    this.closeManageSubmenu();
  }

  toggleManageSubmenu(anchorEl) {
    const container = this.getContainer ? this.getContainer() : null;
    if (!container) return;
    if (container.querySelector('.tw-manage-submenu')) {
      this.closeManageSubmenu();
      return;
    }
    const cur = this.getManageSubTab();
    const subs = [
      { id: 'graph', label: 'Wiki 知识图谱', icon: 'network' },
      { id: 'documents', label: '资产文档', icon: 'file-text' },
      { id: 'sync', label: '笔记同步', icon: 'refresh' },
      { id: 'webview', label: '官方控制台', icon: 'code' }
    ];
    const menu = container.createDiv({ cls: 'tw-manage-submenu' });
    for (const s of subs) {
      const item = menu.createEl('button', { cls: `tw-manage-submenu-item ${cur === s.id ? 'active' : ''}` });
      item.innerHTML = `
        <span class="tw-manage-submenu-icon">${getIconPark(s.icon, 15)}</span>
        <span class="tw-manage-submenu-label">${s.label}</span>
      `;
      item.onclick = () => this.setManageSubTab(s.id);
    }
    // 对齐「管理」按钮, 紧贴侧栏右侧弹出 (top 叠加容器滚动偏移)
    const cRect = container.getBoundingClientRect();
    const aRect = anchorEl.getBoundingClientRect();
    menu.style.top = Math.round(aRect.top - cRect.top + container.scrollTop) + 'px';
    menu.style.left = Math.round(aRect.right - cRect.left + 8) + 'px';
    // 点击外部 / 再次点击触发器时关闭 (延迟挂接, 避免本次点击立即触发)
    const closer = (e) => {
      if (!menu.contains(e.target) && !anchorEl.contains(e.target)) this.closeManageSubmenu();
    };
    this._manageSubmenuCloser = closer;
    setTimeout(() => document.addEventListener('pointerdown', closer, true), 0);
  }

  closeManageSubmenu() {
    if (this._manageSubmenuCloser) {
      try { document.removeEventListener('pointerdown', this._manageSubmenuCloser, true); } catch (e) {}
      this._manageSubmenuCloser = null;
    }
    const container = this.getContainer ? this.getContainer() : null;
    const menu = container ? container.querySelector('.tw-manage-submenu') : null;
    if (menu) menu.remove();
  }

  toggleToolsSubmenu(anchorEl) {
    const container = this.getContainer ? this.getContainer() : null;
    if (!container) return;
    if (container.querySelector('.tw-tools-submenu')) {
      this.closeToolsSubmenu();
      return;
    }
    const subs = [
      { id: 'battery-charger', label: '充电分析', icon: 'lightning' },
      { id: 'logic', label: '逻辑分析', icon: 'cpu' }
    ];
    const menu = container.createDiv({ cls: 'tw-tools-submenu' });
    for (const s of subs) {
      const isActive = this.toolsView && this.toolsView.activeToolId === s.id;
      const item = menu.createEl('button', { cls: `tw-tools-submenu-item${isActive ? ' active' : ''}` });
      item.innerHTML = `
        <span class="tw-tools-submenu-icon">${getIconPark(s.icon, 15)}</span>
        <span class="tw-tools-submenu-label">${s.label}</span>
      `;
      item.onclick = () => {
        this.closeToolsSubmenu();
        if (this.toolsView) {
          this.toolsView.activeToolId = s.id;
          this.toolsView.reloadTool();
        }
      };
    }
    const cRect = container.getBoundingClientRect();
    const aRect = anchorEl.getBoundingClientRect();
    menu.style.top = Math.round(aRect.top - cRect.top + container.scrollTop) + 'px';
    menu.style.left = Math.round(aRect.right - cRect.left + 8) + 'px';
    const closer = (e) => {
      if (!menu.contains(e.target) && !anchorEl.contains(e.target)) this.closeToolsSubmenu();
    };
    this._toolsSubmenuCloser = closer;
    setTimeout(() => document.addEventListener('pointerdown', closer, true), 0);
  }

  closeToolsSubmenu() {
    if (this._toolsSubmenuCloser) {
      try { document.removeEventListener('pointerdown', this._toolsSubmenuCloser, true); } catch (e) {}
      this._toolsSubmenuCloser = null;
    }
    const container = this.getContainer ? this.getContainer() : null;
    const menu = container ? container.querySelector('.tw-tools-submenu') : null;
    if (menu) menu.remove();
  }

  // Ctrl+← 隐藏 / Ctrl+→ 展示 左侧导航栏: 折叠态存在视图实例上, 切页重渲染后自动恢复
  setNavRailCollapsed(collapsed) {
    this._navCollapsed = !!collapsed;
    const rail = this.containerEl && this.containerEl.querySelector('.tabonkb-workbench-layout > .tw-nav-rail');
    if (rail) rail.classList.toggle('tw-nav-collapsed', this._navCollapsed);
  }

  toggleNavRail() {
    this.setNavRailCollapsed(!this._navCollapsed);
  }

  renderNavRail(parentEl) {
    const rail = parentEl.createDiv({ cls: 'tw-nav-rail' });
    if (this._navCollapsed) rail.addClass('tw-nav-collapsed');

    // Top Section: Brand + Navigation Items
    const topSec = rail.createDiv({ cls: 'tw-nav-rail-top' });

    const brand = topSec.createDiv({ cls: 'tw-nav-brand' });
    brand.innerHTML = `
      <div class="tw-nav-brand-logo" title="TabonKB 研发知识库与工作台">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6.4 7.4h11.2"/>
          <path d="M12 7.4v10.2"/>
          <circle cx="6.4" cy="7.4" r="2" fill="currentColor" stroke="none"/>
          <circle cx="17.6" cy="7.4" r="2" fill="currentColor" stroke="none"/>
          <circle cx="12" cy="17.6" r="2.1" fill="currentColor" stroke="none"/>
        </svg>
      </div>
      <span class="tw-nav-brand-text">TabonKB</span>
    `;
    brand.onclick = () => this.setActiveTab('home');

    const itemsGroup = topSec.createDiv({ cls: 'tw-nav-items' });

    const tabs = [
      { id: 'home', label: '首页', icon: 'dashboard', title: '知识库首页与图谱' },
      { id: 'tasks', label: '任务', icon: 'tasks', title: 'Jira 协作与任务看板' },
      { id: 'news', label: '资讯', icon: 'newspaper', title: '技术资讯与规范动态' },
      { id: 'explore', label: '探索', icon: 'compass', title: 'Agent Hub 与芯片资源检索' },
      { id: 'tools', label: '工具', icon: 'tool', title: '研发效能与分析工具箱' },
      { id: 'harness', label: 'Harness', icon: 'deepseek', title: 'DeepSeek Harness 智能工作台（双击切换侧栏）' },
      { id: 'manage', label: '管理', icon: 'database', title: 'WeKnora 知识库与数据管理' }
    ];

    for (const t of tabs) {
      const btn = itemsGroup.createEl('button', {
        cls: `tw-nav-btn ${this.activeTab === t.id ? 'active' : ''}`
      });
      btn.innerHTML = `
        <span class="tw-nav-icon">${getIconPark(t.icon, 22)}</span>
        <span class="tw-nav-label">${t.label}</span>
      `;
      btn.onclick = () => this.setActiveTab(t.id);

      // Harness 页面保持 iframe 会话不变, 双击导航图标联动切换 DSH 原生侧栏 (默认隐藏/展开)
      if (t.id === 'harness') {
        btn.ondblclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.activeTab !== 'harness') {
            this.setActiveTab('harness');
          }
          if (this.harnessView) {
            this.harnessView.toggleSidebar(!this.harnessView.isSidebarCollapsed);
          }
        };
      }

      // 探索页: 已在探索页时再次点击「探索」, 弹出子选择菜单 (AI 研发助手 / 芯片资源检索), 不常驻占位
      if (t.id === 'explore') {
        btn.onclick = () => {
          if (this.activeTab !== 'explore') {
            this.setActiveTab('explore');
            return;
          }
          this.toggleExploreSubmenu(btn);
        };
      }

      // 工具页: 已在工具页时再次点击「工具」, 弹出子选择菜单 (充电分析工具等)
      if (t.id === 'tools') {
        btn.onclick = () => {
          if (this.activeTab !== 'tools') {
            this.setActiveTab('tools');
            return;
          }
          this.toggleToolsSubmenu(btn);
        };
      }

      // 管理页: 已在管理页时再次点击「管理」, 弹出子页选择菜单 (图谱/资产/同步/控制台), 与探索页同方案
      if (t.id === 'manage') {
        btn.onclick = () => {
          if (this.activeTab !== 'manage') {
            this.setActiveTab('manage');
            return;
          }
          this.toggleManageSubmenu(btn);
        };
      }
    }

    // Bottom Section: Divider + Theme Quick Switch + Settings Shortcut
    const btmSec = rail.createDiv({ cls: 'tw-nav-rail-bottom' });
    btmSec.createDiv({ cls: 'tw-nav-divider' });
    const btnTheme = btmSec.createEl('button', {
      cls: 'tw-nav-btn tw-nav-theme-btn'
    });
    btnTheme.innerHTML = `
      <span class="tw-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0 0 21 10.7"/></svg></span>
      <span class="tw-nav-label">主题</span>
    `;
    btnTheme.onclick = (e) => {
      e.stopPropagation();
      const p = this.plugin || (this.app?.plugins?.plugins?.['tabonkb-workbench']);
      if (typeof TabonKBThemeEngine !== 'undefined' && p) {
        TabonKBThemeEngine.openThemeLibraryPopover(btnTheme, p);
      }
    };
    const btnSettings = btmSec.createEl('button', {
      cls: 'tw-nav-btn tw-nav-settings-btn'
    });
    btnSettings.innerHTML = `
      <span class="tw-nav-icon">${getIconPark('setting-config', 22)}</span>
      <span class="tw-nav-label">设置</span>
    `;
    btnSettings.onclick = (e) => {
      e.stopPropagation();
      try {
        this.closeExploreSubmenu();
        this.closeManageSubmenu();
        this.closeToolsSubmenu();
        if (typeof TabonKBThemeEngine !== 'undefined') {
          TabonKBThemeEngine.closeThemeLibraryPopover(false);
        }
      } catch (_) {}
      this.app.setting?.open?.();
      this.app.setting?.openTabById?.('tabonkb-workbench');
    };

  }

  renderTopBar(parentEl) {
    const topBarRow = parentEl.createDiv({ cls: 'tw-top-bar-row' });

    let searchPlaceholder = 'Omnisearch 全文检索：输入关键词实时匹配正文，按 Enter 唤起原生大窗...';
    let rightActionHtml = `
      <button class="tw-omnisearch-btn" id="btnTriggerOmnisearch" title="唤起 Omnisearch 全库弹窗检索 (Enter)">
        <span class="tw-omni-bolt">${getIconPark('lightning', 12)}</span> Omnisearch <kbd class="tw-omni-kbd">↵</kbd>
      </button>
      <span class="tw-search-hint">ESC 清空</span>
    `;

    if (this.activeTab === 'tasks') {
      searchPlaceholder = this.getTasksSubTab() === 'topics'
        ? '在专题中搜索：输入标题、模块或目录 ID...'
        : '在 Jira 任务中搜索：输入 Key、摘要、经办人、状态或描述...';
      rightActionHtml = `<span class="tw-search-hint">ESC 清空</span>`;
    } else if (this.activeTab === 'news') {
      searchPlaceholder = '在技术资讯中搜索：输入关键词实时匹配并高亮...';
      rightActionHtml = `<span class="tw-search-hint">ESC 清空</span>`;
    } else if (this.activeTab === 'explore') {
      searchPlaceholder = '在芯片特定资源 (MTK / 展锐) 与 AI 研发数据中探索...';
      rightActionHtml = `<span class="tw-search-hint">ESC 清空</span>`;
    }

    topBarRow.innerHTML = `
      <div class="tw-search-wrap">
        <svg class="tw-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <input type="text" class="tw-search-input" style="padding-left: 44px !important; padding-right: 175px !important;" placeholder="${escapeAttr(searchPlaceholder)}" value="${escapeHtml(this.keyword)}">
        <div class="tw-search-actions">
          ${rightActionHtml}
        </div>
      </div>
      <div class="tw-agent-selector-wrap" id="twTopAgentSelectorWrap">
        <button class="tw-agent-hub-btn ${this.agentDrawer.isOpen() ? 'active' : ''}" id="btnTogglePiAgent" title="Agent Hub · AI 研发助手">
          <span class="tw-agent-hub-icon">${getIconPark('robot', 16)}</span>
        </button>
      </div>
    `;

    const input = topBarRow.querySelector('input');
    input.addEventListener('input', (e) => {
      this.keyword = e.target.value.trim();
      if (this.tabKeywords) this.tabKeywords[this.activeTab] = this.keyword;

      if (this.activeTab === 'home') {
        if (this.contextProvider) this.contextProvider.setKeyword(this.keyword);
        const tableSearchInput = document.getElementById('twTableSearchInput');
        if (tableSearchInput && tableSearchInput !== input) {
          tableSearchInput.value = this.keyword;
          const clearBtn = document.getElementById('btnTableSearchClear');
          if (clearBtn) clearBtn.style.display = this.keyword ? 'block' : 'none';
        }
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(async () => {
          await this.handleOmniSearch(this.keyword);
        }, 200);
      } else if (this.activeTab === 'tasks') {
        if (this.getTasksSubTab() === 'topics') {
          if (this.topicView) this.topicView.filterKeyword(this.keyword);
        } else if (this.jiraPlatform) {
          this.jiraPlatform.filterKeyword(this.keyword);
        }
      } else if (this.activeTab === 'news') {
        if (this.rssCenter) {
          this.rssCenter.filterKeyword(this.keyword);
        }
      } else if (this.activeTab === 'explore') {
        if (this.exploreView && this.exploreView.activeSubTab === 'search') {
          this.exploreView.searchKeyword = this.keyword;
          this.exploreView.refreshResults();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.activeTab === 'home') {
          e.preventDefault();
          this.openOmnisearchModal(this.keyword);
        }
      } else if (e.key === 'Escape') {
        this.keyword = '';
        input.value = '';
        if (this.tabKeywords) this.tabKeywords[this.activeTab] = '';
        if (this.activeTab === 'home') {
          if (this.contextProvider) this.contextProvider.setKeyword('');
          this.omnisearchResults = null;
          this.statusFilter = 'all';
          this.moduleFilter = '';
          this.platformFilter = '';
          this.render();
        } else if (this.activeTab === 'tasks') {
          if (this.getTasksSubTab() === 'topics') {
            this.topicView?.filterKeyword('');
          } else {
            this.jiraPlatform?.filterKeyword('');
          }
        } else if (this.activeTab === 'news') {
          this.rssCenter?.filterKeyword('');
        } else if (this.activeTab === 'explore') {
          if (this.exploreView && this.exploreView.activeSubTab === 'search') {
            this.exploreView.searchKeyword = '';
            this.exploreView.refreshResults();
          }
        }
      }
    });

    const btnPi = topBarRow.querySelector('#btnTogglePiAgent');
    if (btnPi) {
      btnPi.onclick = () => {
        this.agentDrawer.toggle();
      };
    }

    this.agentDrawer.onToggle((isOpen) => {
      if (btnPi) btnPi.classList.toggle('active', isOpen);
      if (this.graphCanvas && typeof this.graphCanvas.resize === 'function') {
        setTimeout(() => this.graphCanvas.resize(), 60);
        setTimeout(() => this.graphCanvas.resize(), 240);
      }
    });

    const btnOmni = topBarRow.querySelector('#btnTriggerOmnisearch');
    if (btnOmni) {
      btnOmni.onclick = () => this.openOmnisearchModal(this.keyword);
    }
  }

  ensureStylesheet(doc) {
    // 自愈: 探测当前文档是否已加载插件样式 (弹出窗口/注入失败时自动补注入)
    try {
      doc = doc || (typeof document !== 'undefined' ? document : null);
      if (!doc) return;
      const probe = doc.createElement('div');
      probe.className = 'tw-nav-rail';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.width = '0';
      probe.style.height = '0';
      (doc.body || doc.documentElement).appendChild(probe);
      const applied = !!(doc.defaultView && doc.defaultView.getComputedStyle(probe).display === 'flex');
      probe.remove();
      const existing = doc.getElementById('tw-selfheal-css');
      if (applied) {
        if (existing) existing.remove();
        return;
      }
      const cssPath = path.join(this.app.vault.adapter.basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      const st = doc.createElement('style');
      st.id = 'tw-selfheal-css';
      st.textContent = css;
      (doc.head || doc.documentElement).appendChild(st);
      console.log('[TabonKB Workbench] stylesheet missing in this window, self-heal injected');
    } catch (e) {
      console.warn('[TabonKB Workbench] stylesheet self-heal failed:', e);
    }
  }

    renderHomeTab(stage) {
    const wrap = stage.createDiv({ cls: 'tw-stage-home tabonkb-workbench-wrap' });

    // Layer 2: 走势图 + 热力图
    const chartsGrid = wrap.createDiv({ cls: 'tw-charts-grid' });

    // Trend Chart (dynamically bound to real Jira data with time dimension pills)
    this.renderHomeTrendCard(chartsGrid);

    // Heatmap Card (dynamically bound to multi-source engineering data)
    this.renderHomeHeatmapCard(chartsGrid);

    // Agent Usage Quota Strip (multi-agent token consumption breakdown)
    this.renderAgentUsageCard(wrap);

    // Layer 3: Knowledge Workspace (Graph + Dynamic Context Panel)
    const workspaceWrap = wrap.createDiv({ cls: 'tw-knowledge-workspace dashboard-knowledge-workspace', id: 'twKnowledgeWorkspace' });
    
    // Left: Graph Card (降级保护: 拓扑组件异常不拖垮整个工作台)
    const graphCard = workspaceWrap.createDiv({ cls: 'tw-card tw-graph-card' });
    try {
      this.graphCanvas = new ForceGraphCanvas(graphCard, {
        onNodeClick: (node) => {
          const nextMode = node ? 'detail' : 'overview';
          if (this.knowledgePanelMode === nextMode && this.selectedKnowledgeNode === node) {
            return;
          }
          this.selectedKnowledgeNode = node;
          this.knowledgePanelMode = nextMode;
          if (this.contextProvider) {
            if (node) this.contextProvider.setKnowledgeNode(node);
            else this.contextProvider.clearKnowledgeNode();
          }
          this.renderContextPanel();
        },
        onNodeDblClick: (node) => {
          if (node) this.openTarget(node.id, node.title);
        }
      });
      if (this.graphData.nodes.length > 0) {
        this.graphCanvas.setData(this.graphData);
      }
    } catch (gErr) {
      console.warn('[TabonKB] Topology init degraded:', gErr);
      try { wkTopoWriteLog(this.app.vault.adapter.basePath, 'GRAPHCARD: ' + (gErr && gErr.stack || gErr)); } catch (e) {}
      this.graphCanvas = null;
      graphCard.innerHTML = '<div style="padding:28px;font-size:11px;color:var(--text-muted);">拓扑组件初始化异常 (已降级, 不影响工作台其它区域), 详见插件目录 weknora-topo-error.log</div>';
    }

    // Right: Context Panel Card
    this.contextCard = workspaceWrap.createDiv({ cls: 'tw-card tw-context-panel-card' });
    this.renderContextPanel();

    // Layer 4: 快速过滤 + 任务列表 / 资料清单
    const stats = this.getVaultStats();
    const filtersBar = wrap.createDiv({ cls: 'tw-card tw-filters-bar' });
    filtersBar.innerHTML = `
      <span style="font-size:10px; color:var(--text-muted); margin-right:2px;">快速过滤:</span>
      <button class="tw-chip ${this.moduleFilter==='Charger'?'active':''}" data-mod="Charger">充电/CHG ${stats.modules.charger || 17}</button>
      <button class="tw-chip ${this.moduleFilter==='Spec'?'active':''}" data-mod="Spec">Spec/规范 ${stats.modules.spec || 14}</button>
      <button class="tw-chip ${this.moduleFilter==='Display'?'active':''}" data-mod="Display">Display ${stats.modules.display || 2}</button>
      <button class="tw-chip ${this.moduleFilter==='Crash'?'active':''}" data-mod="Crash">Crash/Panic ${stats.modules.crash || 1}</button>
      <button class="tw-chip ${this.platformFilter==='MTK'?'active':''}" data-plat="MTK">联发科 ${stats.mtkCount || 6}</button>
      <button class="tw-chip ${this.platformFilter==='QCOM'?'active':''}" data-plat="QCOM">楂橀€?${stats.qcomCount || 1}</button>
      <button class="tw-chip ${this.platformFilter==='MULTI'?'active':''}" data-plat="MULTI">多平台 ${stats.multiCount || 5}</button>
    `;

    filtersBar.querySelectorAll('[data-mod]').forEach(btn => {
      btn.onclick = () => {
        const mod = btn.dataset.mod;
        if (this.moduleFilter === mod) {
          this.moduleFilter = '';
          this.graphCanvas?.filterModule('all');
        } else {
          this.moduleFilter = mod;
          this.platformFilter = '';
          this.graphCanvas?.filterModule(mod);
        }
        if (this.contextProvider) this.contextProvider.setFilter(this.moduleFilter);
        this.currentTab = 'docs';
        this.renderTableOnly();
        filtersBar.querySelectorAll('[data-mod]').forEach(b => b.toggleClass('active', b.dataset.mod === this.moduleFilter));
      };
    });

    filtersBar.querySelectorAll('[data-plat]').forEach(btn => {
      btn.onclick = () => {
        const plat = btn.dataset.plat;
        if (this.platformFilter === plat) {
          this.platformFilter = '';
        } else {
          this.platformFilter = plat;
          this.moduleFilter = '';
        }
        if (this.contextProvider) this.contextProvider.setFilter(this.platformFilter);
        this.currentTab = 'docs';
        this.renderTableOnly();
        filtersBar.querySelectorAll('[data-plat]').forEach(b => b.toggleClass('active', b.dataset.plat === this.platformFilter));
      };
    });

    this.tableCard = wrap.createDiv({ cls: 'tw-card tw-table-card' });
    this.renderTableOnly();
  }

  getTasksSubTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-tasks-subtab');
        if (s === 'jira' || s === 'topics') return s;
      }
    } catch (e) {}
    return 'jira';
  }

  saveTasksSubTab(sub) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-tasks-subtab', sub);
      }
    } catch (e) {}
  }

  renderTasksTab(stage) {
    const sub = this.getTasksSubTab();
    const bar = stage.createDiv({ cls: 'tw-tasks-subtabs' });
    for (const [id, label] of [['jira', '问题单'], ['topics', '专题']]) {
      const btn = bar.createEl('button', { cls: `tw-tasks-subtab-btn ${sub === id ? 'active' : ''}`, text: label });
      btn.onclick = () => {
        if (this.getTasksSubTab() === id) return;
        this.saveTasksSubTab(id);
        if (this.jiraPlatform) { this.jiraPlatform = null; }
        if (this.topicView) { try { this.topicView.dispose(); } catch (_) {} this.topicView = null; }
        this.render();
      };
    }
    const host = stage.createDiv({ cls: 'tw-tasks-subhost' });

    // 非当前子页的残留视图先清理 (含整页重渲染时旧 topicView 的 vault 订阅)
    if (sub !== 'topics' && this.topicView) {
      try { this.topicView.dispose(); } catch (_) {}
      this.topicView = null;
    }
    if (sub !== 'jira' && this.jiraPlatform) {
      this.jiraPlatform = null;
    }

    if (sub === 'topics') {
      // 个人专题子页 (P1a/P1b): 数据全部落 vault 07-Project/00-Personal-Topics/
      // P1b: 优先复用插件级单例 (记灵感浮窗共用), 视图只 dispose 自建实例
      if (!this.topicService) {
        const plugin = this.plugin || this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        if (plugin && typeof plugin.getTopicService === 'function') {
          this.topicService = plugin.getTopicService();
          this._ownTopicService = false;
        } else {
          this.topicService = new TopicService({ app: this.app });
          this._ownTopicService = true;
        }
      }
      if (this.topicView) {
        try { this.topicView.dispose(); } catch (_) {}
        this.topicView = null;
      }
      this.topicView = new TopicView({
        app: this.app,
        topicService: this.topicService,
        agentDrawer: this.agentDrawer,
        // P3: 能力雷达 —— 只读 Jira 内存缓存 (jiraService._cache, 不触发网络), Done 判定沿用 JiraPlatformView.categorizeStatus
        getJiraIssues: () => {
          try {
            const plg = this.plugin || this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
            const c = plg && plg.jiraService && plg.jiraService._cache;
            return (c && Array.isArray(c.issues)) ? c.issues : [];
          } catch (e) { return []; }
        },
        categorizeDone: (issue) => {
          try {
            const jpv = this.jiraPlatform;
            if (jpv && typeof jpv.categorizeStatus === 'function') {
              return jpv.categorizeStatus(issue.status, issue.statusCategory) === 'done';
            }
          } catch (e) {}
          // 与 JiraPlatformView.categorizeStatus 的 done 判定等价 (topics 子页时 jiraPlatform 已置空)
          const s = String(issue && issue.status || '').toLowerCase();
          const cat = String(issue && issue.statusCategory || '').toLowerCase();
          return cat === 'done' || s.includes('closed') || s.includes('done') || s.includes('resolved')
            || s.includes('fixed') || s.includes('已解决') || s.includes('关闭') || s.includes('完成') || s.includes('验证通过');
        }
      });
      this.topicView.mount(host);
      if (this.keyword) {
        this.topicView.filterKeyword(this.keyword);
      }
      return;
    }

    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const jiraService = plugin?.jiraService || new JiraService({ app: this.app, getConfig: () => DEFAULT_SETTINGS.jira });

    this.jiraPlatform = new JiraPlatformView({
      jiraService: jiraService,
      app: this.app,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      },
      onAskAgent: (issue) => {
        if (!this.agentDrawer.isOpen()) {
          this.agentDrawer.open();
        }
        const kv = [`工单 ${issue.key}`, `标题: ${issue.summary || ''}`, `状态: ${issue.status || ''}`, `优先级: ${issue.priority || '无'}`, `经办人: ${issue.assignee || '未指派'}`, `模块: ${(issue.components || []).join(', ') || '无'}`].join('\\n');
        this.agentDrawer.sendPrompt(
          `请分析 Jira 工单 ${issue.key}：\\n${kv}\\n详细描述: ${issue.description || '无'}\\n\\n` +
          `请调用 jira_get_issue 获取完整详情，用 jira_list_attachments 查看附件；如有日志/抓包等附件，用 jira_download_attachment 下载到 00-Inbox/03-Quick-Note/${issue.key}/attachments/ 后分析。` +
          `分析结论与产物写入 00-Inbox/03-Quick-Note/${issue.key}/ 目录。`
        );
      },
      // P1c: 抽屉「🌱 灵感」→ 记灵感浮窗, 注入 jiraKey/推断模块, 屏蔽活动文件与选区
      onCaptureIdea: (issue) => {
        const m = (typeof inferDbgNaming === 'function') ? inferDbgNaming(issue).module : '';
        const ctx = {
          jiraKey: issue.key,
          selectedTopicId: null,
          activeFilePath: null,
          selectionText: '',
          selectionFromAgent: false
        };
        if (m && m !== 'GEN') ctx.module = m;
        if (plugin && typeof plugin.getIdeaPalette === 'function') {
          plugin.getIdeaPalette().open({ context: ctx });
        }
      },
      // P2a: 联调区 AI 按钮 -> 只填词到 Agent 输入框 (不自动发送), 用户确认后回车
      onAgentPrompt: (promptText) => {
        if (!this.agentDrawer.isOpen()) {
          this.agentDrawer.open();
        }
        this.agentDrawer.sendPrompt(promptText);
      },
      // P2a: ⚡ 波形 -> 跳工具页并选中对应工具 (一次性消费 _pendingToolId)
      onOpenTool: (toolId) => {
        this._pendingToolId = toolId || null;
        this.setActiveTab('tools');
      },
      // P2a: 升为专题 -> 切 tasks/专题子页并选中新专题
      onOpenTopic: (topicId) => {
        this.saveTasksSubTab('topics');
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('tabonkb-topic-selected', topicId);
          }
        } catch (e) {}
        if (this.jiraPlatform) {
          try { this.jiraPlatform.closeInspector(); } catch (e) {}
        }
        this.render();
      },
      topicService: (plugin && typeof plugin.getTopicService === 'function') ? plugin.getTopicService() : null
    });

    this.jiraPlatform.mount(host);
    if (this.keyword) {
      this.jiraPlatform.filterKeyword(this.keyword);
    }
  }

  getNewsSubTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-news-subtab');
        if (s === 'feed' || s === 'comp') return s;
      }
    } catch (e) {}
    return 'feed';
  }

  saveNewsSubTab(sub) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-news-subtab', sub);
      }
    } catch (e) {}
  }

  renderNewsTab(stage) {
    const sub = this.getNewsSubTab();
    const bar = stage.createDiv({ cls: 'tw-news-subtabs' });
    for (const [id, label] of [['feed', '资讯流'], ['comp', '竞品分析']]) {
      const btn = bar.createEl('button', { cls: `tw-news-subtab-btn ${sub === id ? 'active' : ''}`, text: label });
      btn.onclick = () => {
        if (this.getNewsSubTab() === id) return;
        this.saveNewsSubTab(id);
        if (this.phoneComp) { this.phoneComp.dispose(); this.phoneComp = null; }
        if (this.rssCenter) { this.rssCenter.dispose(); this.rssCenter = null; }
        this.render();
      };
    }
    const host = stage.createDiv({ cls: 'tw-news-subhost' });
    if (sub === 'comp') {
      this.phoneComp = new PhoneCompetitorView({ app: this.app });
      this.phoneComp.mount(host);
      return;
    }
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const rssService = plugin?.rssService || new RssService({ app: this.app, getFeeds: () => DEFAULT_SETTINGS.rss?.feeds || [] });

    this.rssCenter = new RssCenterView({
      plugin: plugin,
      agentDrawer: this.agentDrawer,
      rssService: rssService,
      app: this.app,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      }
    });

    this.rssCenter.mount(host);
    if (this.keyword) {
      this.rssCenter.filterKeyword(this.keyword);
    }
  }

  renderExploreTab(stage) {
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const vendorService = plugin?.vendorService || new VendorPortalService({
      app: this.app,
      getConfig: () => this.settings?.vendorPortals || DEFAULT_SETTINGS.vendorPortals
    });

    // 复用 ExploreView 实例：保留 liveSearchResults / selectedSources / expandedCardIds 等
    // 内存态，切页回来时不再因缓存为空触发 executeInSituSearch() 重发官网检索请求
    if (!this.exploreView) {
      this.exploreView = new ExploreView({
        app: this.app,
        vendorService: vendorService,
        agentDrawer: this.agentDrawer,
        agentHub: this.agentHub,
        onOpenSettings: () => {
          this.app.setting?.open?.();
          this.app.setting?.openTabById?.('tabonkb-workbench');
        }
      });
    }

    // Restore keyword BEFORE mount so renderSearchSubView sees it and auto-triggers live search
    if (this.keyword && this.exploreView.activeSubTab === 'search') {
      this.exploreView.searchKeyword = this.keyword;
    }

    this.exploreView.mount(stage);

    // If keyword was restored but liveSearchResults is empty, executeInSituSearch
    // (renderSearchSubView auto-restore handles this via setTimeout, no extra call needed)

  }

  renderManageTab(stage) {
    if (this.weknoraManage) {
      this.weknoraManage.dispose();
      this.weknoraManage = null;
    }

    this.weknoraManage = new WeKnoraManageView({
      app: this.app,
      plugin: this.plugin,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      }
    });

    this.weknoraManage.mount(stage);
  }

  renderHarnessTab(stage) {
    if (this.harnessView) {
      this.harnessView.dispose();
      this.harnessView = null;
    }

    this.harnessView = new DshWorkbenchView({
      app: this.app,
      plugin: this.plugin,
      contextProvider: this.contextProvider,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      }
    });

    this.harnessView.mount(stage);
    this._harnessMounted = true; // R18: 标记已挂载, 供 render() 复用判定
  }

  renderToolsTab(stage) {
    if (this.toolsView) {
      try { this.toolsView.dispose(); } catch (_) {}
      this.toolsView = null;
    }

    this.toolsView = new ToolsView({
      app: this.app,
      plugin: this.plugin
    });

    // P2a: Jira 抽屉「⚡ 波形」指定的一次性目标工具, 挂载前应用并沿用 localStorage 持久化
    if (this._pendingToolId) {
      try {
        if (this.toolsView.tools && this.toolsView.tools.some(t => t.id === this._pendingToolId)) {
          this.toolsView.activeToolId = this._pendingToolId;
          if (typeof this.toolsView._saveActiveToolId === 'function') this.toolsView._saveActiveToolId();
        }
      } catch (e) {}
      this._pendingToolId = null;
    }

    this.toolsView.mount(stage);
  }\n\n  """
    workbench_part = workbench_part[:idx_render] + multi_tab_render_methods + workbench_part[idx_cpanel:]
    print("Replaced render() method with Multi-Tab rendering methods")
else:
    print("Warning: could not locate render() and renderContextPanel() boundaries!")

# 4. Update TabonKBWorkbenchPlugin class
plugin_class_pattern = re.compile(
    r"module\.exports = class TabonKBWorkbenchPlugin extends Plugin \{.*?^\};",
    re.MULTILINE | re.DOTALL
)

new_plugin_class = """var TW_BRAND_ICON_OK = false;

module.exports = class TabonKBWorkbenchPlugin extends Plugin {
  async onload() {
    try { globalThis.__twBootMark && __twBootMark('onload:start'); } catch (e) {}
    await this.loadSettings();
    try { globalThis.__twBootMark && __twBootMark('onload:settings+theme'); } catch (e) {}
    this.applyWorkbenchTheme(this.settings.workbenchTheme);

    // 渲染进程死亡取证心跳: 黑屏=渲染器被杀时, 本文件保留被杀前内存曲线与渲染/刷新计数。
    // appendFileSync ~150B/10s 开销可忽略; >4MB 自动转存 .prev 保留上次崩溃现场。
    try {
      if (!globalThis.__twMemBeat) {
        globalThis.__twMemBeat = setInterval(() => {
          try {
            const fs = require('fs'), path = require('path');
            const dir = path.join(this.app?.vault?.adapter?.basePath || '', '.obsidian', 'plugins', 'tabonkb-workbench');
            const fp = path.join(dir, 'renderer-heartbeat.jsonl');
            if (fs.existsSync(fp) && fs.statSync(fp).size > 4 * 1024 * 1024) {
              try { fs.renameSync(fp, fp.replace('.jsonl', '.prev.jsonl')); } catch (_) {}
            }
            const mu = (typeof process !== 'undefined' && process.memoryUsage) ? process.memoryUsage() : {};
            const pm = (typeof performance !== 'undefined' && performance.memory) ? performance.memory : {};
            fs.appendFileSync(fp, JSON.stringify({
              t: new Date().toISOString(),
              heapMB: Math.round((mu.heapUsed || pm.usedJSHeapSize || 0) / 1048576),
              rssMB: Math.round((mu.rss || 0) / 1048576),
              extMB: Math.round((mu.external || 0) / 1048576),
              renders: globalThis.__twRenderCount || 0,
              refreshes: globalThis.__twRefreshCount || 0,
              scans: globalThis.__twScanCount || 0
            }) + String.fromCharCode(10), 'utf8');
          } catch (_) {}
        }, 10000);
        globalThis.__twMemBeat.unref && globalThis.__twMemBeat.unref();
      }
    } catch (_) {}

    this.jiraService = new JiraService({
      app: this.app,
      getConfig: () => this.settings.jira
    });

    this.rssService = new RssService({
      app: this.app,
      getFeeds: () => this.settings.rss?.feeds || []
    });

    this.vendorService = new VendorPortalService({
      app: this.app,
      getConfig: () => this.settings.vendorPortals || DEFAULT_SETTINGS.vendorPortals
    });

    const vaultPath = this.app?.vault?.adapter?.basePath || '';
    this.contextProvider = new AgentContextProvider(this.app);
    this.agentBridge = new PiAgentBridge({ vaultBasePath: vaultPath, plugin: this });
    this.agentHub = new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge,
      app: this.app,
      getNiceaigcConfig: () => this.settings.niceaigc || DEFAULT_SETTINGS.niceaigc
    });
    try { globalThis.__twBootMark && __twBootMark('onload:services+hub'); } catch (e) {}

    // Companion Sync Server for Chrome / Edge Extension (127.0.0.1:28123)
    this.companionServer = new CompanionSyncServer({ plugin: this, port: 28123 });
    this.companionServer.start();

    this.drawioBroker = new DrawioBroker({ vaultBasePath: vaultPath });
    this.drawioBroker.start();
    try { globalThis.__twBootMark && __twBootMark('onload:servers'); } catch (e) {}

    // DSH Daemon Manager
    if (this.settings?.dsh?.enabled !== false && typeof DshDaemonManager !== 'undefined') {
      this.dshDaemon = new DshDaemonManager({
        plugin: this,
        vaultBasePath: vaultPath,
        port: this.settings?.dsh?.port || 3080,
        profile: this.settings?.dsh?.profile || 'tabonkb'
      });
      if (this.settings?.dsh?.autoStart !== false) {
        // 延迟 1200ms 后台预热连接（若当前在 Harness 页签则由视图立即触发复用），避免与首屏渲染抢占主线程与进程句柄
        setTimeout(() => {
          if (this.dshDaemon) {
            this.dshDaemon.start().catch((e) => console.warn('[TabonKB] DSH Daemon auto-start failed:', e));
          }
        }, 1200);
      }
    }
    try { globalThis.__twBootMark && __twBootMark('onload:dsh'); } catch (e) {}

    this.addSettingTab(new TabonKBSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_WORKBENCH,
      (leaf) => {
        const view = new TabonKBWorkbenchView(leaf);
        view.plugin = this;
        return view;
      }
    );

    if (typeof VIEW_TYPE_DSH_STUDIO !== 'undefined' && typeof DshStudioView !== 'undefined') {
      this.registerView(
        VIEW_TYPE_DSH_STUDIO,
        (leaf) => new DshStudioView(leaf, { plugin: this })
      );
    }

    // 冷启动索引期 create/modify/resolved 会对每个文件连发——350ms 尾触发防抖，
    // 整轮索引合并为一次 loadVaultDocs；loadVaultDocs 内部另有 in-flight 闸防重入
    let _rwTimer = null;
    const refreshWorkbench = () => {
      if (_rwTimer) clearTimeout(_rwTimer);
      _rwTimer = setTimeout(() => {
        _rwTimer = null;
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
        leaves.forEach(leaf => {
          if (leaf.view && typeof leaf.view.refreshVaultDocs === 'function') {
            leaf.view.refreshVaultDocs();
          }
        });
      }, 350);
    };

    this.registerEvent(this.app.vault.on('create', refreshWorkbench));
    this.registerEvent(this.app.vault.on('delete', refreshWorkbench));
    this.registerEvent(this.app.vault.on('modify', refreshWorkbench));
    this.registerEvent(this.app.metadataCache.on('resolved', refreshWorkbench));

    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (file) {
        if (this.contextProvider) {
          this.contextProvider.setActiveFile(file);
        }
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
        leaves.forEach(leaf => {
          if (leaf.view && leaf.view.contextProvider) {
            leaf.view.contextProvider.setActiveFile(file);
          }
        });
      }
    }));

    const syncWorkbenchStatusBar = () => {
      try {
        const activeLeaf = this.app?.workspace?.activeLeaf;
        const isWorkbenchActive = activeLeaf?.view?.getViewType?.() === VIEW_TYPE_WORKBENCH;
        const leaves = this.app?.workspace?.getLeavesOfType?.(VIEW_TYPE_WORKBENCH) || [];
        const hasWorkbench = leaves.length > 0;
        if (typeof document !== 'undefined' && document.body) {
          const shouldHide = isWorkbenchActive || hasWorkbench;
          document.body.classList.toggle('tw-workbench-active', shouldHide);
          document.body.classList.toggle('tw-has-workbench', hasWorkbench);
          const sb = document.querySelector('.status-bar');
          if (sb) {
            if (shouldHide) {
              sb.style.setProperty('display', 'none', 'important');
            } else {
              sb.style.removeProperty('display');
            }
          }
        }
      } catch (err) {
        console.warn('[TabonKB Workbench] syncWorkbenchStatusBar error:', err);
      }
    };

    this.registerEvent(this.app.workspace.on('active-leaf-change', syncWorkbenchStatusBar));
    this.registerEvent(this.app.workspace.on('layout-change', syncWorkbenchStatusBar));
    setTimeout(syncWorkbenchStatusBar, 100);
    setTimeout(syncWorkbenchStatusBar, 500);

    // Add ribbon icon on left navigation bar
    // 图标注册失败不得拖垮插件加载: 捕获后回退内置图标
    try {
      this.addIcon('tabonkb-brand', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 7.4h11.2"/><path d="M12 7.4v10.2"/><circle cx="6.4" cy="7.4" r="2" fill="currentColor" stroke="none"/><circle cx="17.6" cy="7.4" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="17.6" r="2.1" fill="currentColor" stroke="none"/></svg>');
      TW_BRAND_ICON_OK = true;
      this.addRibbonIcon('tabonkb-brand', '打开 TabonKB 研发工作台', () => {
        this.activateView();
      });
    } catch (e) {
      console.warn('[TabonKB Workbench] custom brand icon failed, fallback to built-in:', e);
      TW_BRAND_ICON_OK = false;
      this.addRibbonIcon('layout-dashboard', '打开 TabonKB 研发工作台', () => {
        this.activateView();
      });
    }

    // Add command palette item
    this.addCommand({
      id: 'open-tabonkb-workbench',
      name: '打开研发工作台',
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: 'open-dsh-studio',
      name: '打开 DeepSeek Harness Studio (DSH)',
      callback: () => {
        this.activateDshStudioView();
      },
    });

    this.addCommand({
      id: 'open-tabonkb-theme-library',
      name: '打开工作台主题库 (44套主题悬停实时预览)',
      callback: () => {
        this.activateView().then(() => {
          const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
          const view = leaves[0]?.view;
          const container = view?.getContainer?.();
          const anchor = container?.querySelector('.tw-nav-theme-btn') || container;
          if (anchor && typeof TabonKBThemeEngine !== 'undefined') {
            TabonKBThemeEngine.openThemeLibraryPopover(anchor, this);
          }
        });
      },
    });

    // P1b 记灵感: Alt+I 全局唤起 (含编辑器内, 命令热键由 Obsidian 注册)
    this.addCommand({
      id: 'capture-idea',
      name: '记灵感',
      hotkeys: [{ modifiers: ['Alt'], key: 'i' }],
      callback: () => { this.getIdeaPalette().toggle(); },
    });

    // P1b Ctrl+I: Obsidian Keymap 在 window 捕获阶段先处理, document 级监听收不到——
    // 参照探索页 Ctrl+F 的 scope.register 置顶方案; 编辑器内 return undefined 让出原生斜体
    this._ideaScopeKey = null;
    try {
      const scope = this.app && this.app.scope;
      if (scope && typeof scope.register === 'function' && Array.isArray(scope.keys)) {
        const handler = scope.register(['Ctrl'], 'i', (evt, info) => {
          if (typeof shouldYieldCtrlI === 'function' && shouldYieldCtrlI(document.activeElement)) {
            return undefined; // .cm-editor/.monaco-editor 内: 不 preventDefault, 斜体/补全照常
          }
          this.getIdeaPalette().toggle();
          return false;
        });
        const pos = scope.keys.indexOf(handler);
        if (pos > 0) { scope.keys.splice(pos, 1); scope.keys.unshift(handler); }
        this._ideaScopeKey = { scope, handler };
      }
    } catch (_) {}

    this._lastObsidianDark = typeof TabonKBThemeEngine !== 'undefined' ? TabonKBThemeEngine.isObsidianDark() : false;
    this.registerEvent(this.app.workspace.on('css-change', () => {
      const curDark = typeof TabonKBThemeEngine !== 'undefined' ? TabonKBThemeEngine.isObsidianDark() : false;
      if (this._lastObsidianDark === curDark) return;
      this._lastObsidianDark = curDark;
      this.applyWorkbenchTheme(this.settings?.workbenchTheme);
    }));

    try { globalThis.__twBootMark && __twBootMark('onload:end'); } catch (e) {}

    // Debug probe: layout-ready mark + trailing flush to capture late async marks (dsh reuse ~1.5s, restore chunks)
    try {
      this.app.workspace.onLayoutReady(() => {
        try { globalThis.__twBootMark && __twBootMark('layout:ready'); } catch (e) {}
        // P2b: 自动浇水监听 + 90 天枯萎首扫 (延迟 5s)
        try { this.getTopicService()?.startAutoWater?.(); } catch (e) { console.warn('[TopicService] startAutoWater:', e); }
        this._witherTimer = setTimeout(() => {
          try {
            this.getTopicService()?.witherStaleSeeds?.().then(n => {
              try { if (n > 0 && typeof Notice !== 'undefined') new Notice(`🍂 ${n} 颗种子已枯萎`); } catch (e) {}
            }).catch(e => console.warn('[TopicService] witherStaleSeeds:', e));
          } catch (e) { console.warn('[TopicService] witherStaleSeeds:', e); }
        }, 5000);
      });
      setTimeout(() => {
        try { globalThis.__twBootFlush && __twBootFlush(this.app?.vault?.adapter?.basePath); } catch (e) {}
      }, 6500);
    } catch (e) {}
  }

  // P1b: 插件级 TopicService 懒单例 (专题视图与记灵感浮窗共用)
  getTopicService() {
    if (!this.topicService && typeof TopicService !== 'undefined') {
      this.topicService = new TopicService({ app: this.app });
    }
    return this.topicService;
  }

  getIdeaPalette() {
    if (!this.ideaPalette && typeof IdeaCapturePalette !== 'undefined') {
      this.ideaPalette = new IdeaCapturePalette({
        app: this.app,
        topicService: this.getTopicService(),
        getContext: () => this.getIdeaCaptureContext()
      });
    }
    return this.ideaPalette;
  }

  // 记灵感上下文: 工作台 tasks 子页的选中专题/选中工单 + 活动文件 + 选区
  getIdeaCaptureContext() {
    const ctx = { selectedTopicId: null, jiraKey: null, activeFilePath: null, selectionText: '', selectionFromAgent: false };
    try {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
      const view = leaves[0] && leaves[0].view;
      if (view && view.activeTab === 'tasks') {
        const sub = typeof view.getTasksSubTab === 'function' ? view.getTasksSubTab() : 'jira';
        if (sub === 'topics') {
          ctx.selectedTopicId = (view.topicView && view.topicView.selectedId) || null;
        } else {
          const iss = view.jiraPlatform && view.jiraPlatform.selectedIssue;
          ctx.jiraKey = (iss && iss.key) || null;
        }
      }
    } catch (_) {}
    try {
      const f = this.app.workspace.getActiveFile && this.app.workspace.getActiveFile();
      ctx.activeFilePath = (f && f.path) || null;
    } catch (_) {}
    try {
      const sel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
      ctx.selectionText = sel ? String(sel.toString() || '') : '';
      let node = sel && sel.anchorNode ? sel.anchorNode : null;
      if (node && node.nodeType !== 1) node = node.parentElement;
      ctx.selectionFromAgent = !!(node && node.closest && node.closest('.tw-msg-content'));
    } catch (_) {}
    return ctx;
  }

  async getSecret(secretName) {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}

    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secretsFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secretsFile)) {
          const data = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
          if (data && data[secretName]) return data[secretName];
        }
      }
    } catch (e) {}

    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    return this._fallbackSecrets[secretName] || null;
  }

  async setSecret(secretName, value) {
    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    this._fallbackSecrets[secretName] = value;

    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (e) {}

    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secretsFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secretsFile)) {
          try { data = JSON.parse(fs.readFileSync(secretsFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretName] = value;
        fs.writeFileSync(secretsFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (loaded && loaded.jira) {
      this.settings.jira = Object.assign({}, DEFAULT_SETTINGS.jira, loaded.jira);
    }
    if (loaded && loaded.niceaigc) {
      this.settings.niceaigc = Object.assign({}, DEFAULT_SETTINGS.niceaigc, loaded.niceaigc);
    }
    if (loaded && loaded.rss) {
      this.settings.rss = Object.assign({}, DEFAULT_SETTINGS.rss, loaded.rss);
    }
    if (loaded && loaded.dsh) {
      this.settings.dsh = Object.assign({}, DEFAULT_SETTINGS.dsh, loaded.dsh);
    }
  }

  async saveSettings(opts = {}) {
    if (this.settings.jira) {
      delete this.settings.jira.token;
      delete this.settings.jira.apiToken;
      delete this.settings.jira.pat;
    }
    if (this.settings.niceaigc) {
      delete this.settings.niceaigc.token;
      delete this.settings.niceaigc.apiKey;
    }
    await this.saveData(this.settings);
    this.applyWorkbenchTheme(this.settings.workbenchTheme);
    if (opts && opts.themeOnly) return;

    // Notify active workbench views to refresh if config changed
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (leaf.view.jiraPlatform) {
          leaf.view.jiraPlatform.loadIssues(true);
        }
        if (leaf.view.rssCenter) {
          leaf.view.rssCenter.loadFeeds(true);
        }
        if (leaf.view.jiraCard) {
          leaf.view.jiraCard.refresh(true);
        }
        if (leaf.view.rssCard) {
          leaf.view.rssCard.refresh(true);
        }
      }
    });
  }

  applyWorkbenchTheme(theme) {
    if (theme && this.settings) {
      this.settings.workbenchTheme = theme;
    }
    if (typeof TabonKBThemeEngine !== 'undefined') {
      TabonKBThemeEngine.applyGlobalTheme(this, theme || null);
      return;
    }
    const targetTheme = theme || this.settings?.workbenchTheme || 'fresh';
    try {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('tw-theme-fresh-active', targetTheme === 'fresh');
      }
    } catch (e) {}

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (!leaf.view.plugin) leaf.view.plugin = this;
        const container = leaf.view.getContainer ? leaf.view.getContainer() : null;
        if (container) {
          container.classList.remove('tw-theme-standard', 'tw-theme-fresh');
          container.classList.add(`tw-theme-${targetTheme}`);
        }
      }
    });
  }

  onunload() {
    if (globalThis.__twMemBeat) {
      try { clearInterval(globalThis.__twMemBeat); } catch (_) {}
      globalThis.__twMemBeat = null;
    }
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (leaf.view.rssCenter) {
          leaf.view.rssCenter.dispose();
        }
        if (leaf.view.jiraCard) {
          leaf.view.jiraCard.dispose();
        }
        if (leaf.view.rssCard) {
          leaf.view.rssCard.dispose();
        }
        if (leaf.view.agentBridge) {
          leaf.view.agentBridge.destroy();
        }
        if (leaf.view.harnessView) {
          leaf.view.harnessView.dispose();
        }
      }
    });

    // P1b: 记灵感浮窗/Ctrl+I 热键/插件级 TopicService 释放
    if (this._ideaScopeKey) {
      try { this._ideaScopeKey.scope.unregister(this._ideaScopeKey.handler); } catch (_) {}
      this._ideaScopeKey = null;
    }
    if (this.ideaPalette) {
      try { this.ideaPalette.dispose(); } catch (_) {}
      this.ideaPalette = null;
    }
    if (this._witherTimer) {
      try { clearTimeout(this._witherTimer); } catch (_) {}
      this._witherTimer = null;
    }
    if (this.topicService) {
      try { this.topicService.stopAutoWater && this.topicService.stopAutoWater(); } catch (_) {}
      try { this.topicService.dispose && this.topicService.dispose(); } catch (_) {}
      this.topicService = null;
    }

    if (this.companionServer) {
      this.companionServer.stop();
    }
    if (this.drawioBroker) {
      this.drawioBroker.stop();
    }
    if (this.dshDaemon) {
      this.dshDaemon.destroy();
    }
    try {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('tw-workbench-active', 'tw-has-workbench');
        const sb = document.querySelector('.status-bar');
        if (sb) sb.style.removeProperty('display');
      }
    } catch (_) {}
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_WORKBENCH, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async activateDshStudioView() {
    if (typeof getTabonKbWebRequestBridge === 'function') {
      try { getTabonKbWebRequestBridge()?.ensureInstalled(); } catch (_) {}
    }
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_DSH_STUDIO)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_DSH_STUDIO, active: true });
    } else {
      if (!leaf.view || typeof leaf.view.ensureRendered !== 'function') {
        await leaf.setViewState({ type: VIEW_TYPE_DSH_STUDIO, active: true });
      } else {
        leaf.view.ensureRendered();
      }
    }

    workspace.revealLeaf(leaf);
  }
};"""

if plugin_class_pattern.search(workbench_part):
    workbench_part = plugin_class_pattern.sub(lambda _: new_plugin_class, workbench_part)
    print("Updated TabonKBWorkbenchPlugin class in workbench_part")
else:
    print("Warning: plugin_class_pattern did not match in workbench_part!")

bundled = header + "\n" + combined_modules + "\n\n\n" + workbench_part

with open(os.path.join(plugin_dir, "main.js"), "w", encoding="utf-8") as f:
    f.write(bundled)

print("Successfully bundled all components into main.js!")
