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
    f"{plugin_dir}\\services\\local-project-service.js",
    f"{plugin_dir}\\components\\code-viewer-panel.js",
    f"{plugin_dir}\\pi-drawer-view.js",
    f"{plugin_dir}\\services\\jira-service.js",
    f"{plugin_dir}\\services\\rss-service.js",
    f"{plugin_dir}\\components\\jira-card.js",
    f"{plugin_dir}\\components\\rss-card.js",
    f"{plugin_dir}\\components\\jira-platform-view.js",
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
    f"{plugin_dir}\\components\\notion-embed.js",
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
    this.graphCanvas = null;

    // Full-page independent subsystems
    this.jiraPlatform = null;
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
    this._agentUsageExpanded = new Set();

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
    if (!this.homeTrendCardEl) return;
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
    if (!this.homeHeatCardEl) return;
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
        if (r === 'today' || r === 'week' || r === 'all') return r;
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

  collectAgentUsageStats() {
    const AGENT_NAMES = {
      pi: 'Pi Agent', antigravity: 'Antigravity', niceaigc: 'NiceAIGC',
      codex: 'Codex', gemini: 'Gemini', hermes: 'Hermes', dsh: 'DSH'
    };
    const range = this.agentUsageRange || 'week';
    const now = Date.now();
    let startTs = 0;
    if (range === 'today') {
      const d0 = new Date();
      d0.setHours(0, 0, 0, 0);
      startTs = d0.getTime();
    } else if (range === 'week') {
      startTs = now - 7 * 86400000;
    }

    const sm = this.agentHub && this.agentHub.sessionManager;
    const agentsMap = (sm && sm.agents instanceof Map) ? sm.agents : null;
    const rows = [];
    const totals = { tokens: 0, input: 0, output: 0, cache: 0, turns: 0, sessions: 0, tools: 0 };

    if (agentsMap) {
      for (const [agentId, agent] of agentsMap.entries()) {
        const row = {
          id: agentId,
          name: AGENT_NAMES[agentId] || agentId,
          tokens: 0, input: 0, output: 0, cache: 0,
          turns: 0, sessions: 0, tools: 0,
          models: new Map()
        };
        for (const sess of (agent.sessions || [])) {
          let hit = false;
          for (const m of (sess.messages || [])) {
            if (!m || m.role !== 'assistant') continue;
            const ts = m.timestamp || 0;
            if (ts < startTs) continue;
            hit = true;
            row.turns++;
            row.tools += Array.isArray(m.toolCalls) ? m.toolCalls.length : (m.toolCount || 0);
            const u = m.usage;
            if (u && (u.totalTokens > 0 || u.inputTokens > 0 || u.outputTokens > 0)) {
              const inp = Math.max(0, u.inputTokens || 0);
              const out = Math.max(0, u.outputTokens || 0);
              const cache = Math.max(0, u.cacheReadTokens || 0);
              const tot = Math.max(0, u.totalTokens || (inp + out + cache));
              row.input += inp;
              row.output += out;
              row.cache += cache;
              row.tokens += tot;
              const mName = m.model || u.providerAndModel || '未标注模型';
              const cur = row.models.get(mName) || { tokens: 0, turns: 0 };
              cur.tokens += tot;
              cur.turns += 1;
              row.models.set(mName, cur);
            }
          }
          if (hit) row.sessions++;
        }
        if (row.turns > 0) {
          rows.push(row);
          totals.tokens += row.tokens;
          totals.input += row.input;
          totals.output += row.output;
          totals.cache += row.cache;
          totals.turns += row.turns;
          totals.sessions += row.sessions;
          totals.tools += row.tools;
        }
      }
    }

    rows.sort((a, b) => b.tokens - a.tokens);
    for (const r of rows) {
      r.modelList = Array.from(r.models.entries())
        .map(([name, v]) => ({ name, tokens: v.tokens, turns: v.turns }))
        .sort((a, b) => b.tokens - a.tokens);
      r.segSum = Math.max(1, r.input + r.output + r.cache);
    }
    const maxTokens = rows.length ? Math.max(1, rows[0].tokens) : 1;
    return { rows, totals, maxTokens, range };
  }

  renderAgentUsageCard(parentEl) {
    this.agentUsageCardEl = parentEl.createDiv({ cls: 'tw-card tw-agent-usage-card' });
    this.updateAgentUsageCard();
    // Agent 回合结束后自动重算（仅在首页卡片仍挂载时），无需手动刷新
    if (!this._agentUsageBound && this.agentHub && typeof this.agentHub.on === 'function') {
      this._agentUsageBound = true;
      const schedule = () => {
        if (this.agentUsageCardEl && this.agentUsageCardEl.isConnected) {
          setTimeout(() => this.updateAgentUsageCard(), 400);
        }
      };
      this.agentHub.on('turn_end', schedule);
      this.agentHub.on('agent_settled', schedule);
    }
  }

  updateAgentUsageCard() {
    if (!this.agentUsageCardEl) return;
    const stats = this.collectAgentUsageStats();
    const range = stats.range;
    const fmt = (n) => this.fmtUsageTok(n);
    const full = (n) => (Number(n) || 0).toLocaleString();

    let bodyHtml = '';
    if (stats.rows.length === 0) {
      bodyHtml = '<div class="tw-au-empty">该周期暂无用量记录</div>';
    } else {
      const rowsHtml = stats.rows.map((r) => {
        const wIn = (r.input / r.segSum) * 100;
        const wOut = (r.output / r.segSum) * 100;
        const wCache = Math.max(0, 100 - wIn - wOut);
        const barW = r.tokens > 0 ? Math.max(2, (r.tokens / stats.maxTokens) * 100) : 0;
        const segsHtml = r.tokens > 0 ? `<span class="tw-au-seg tw-au-seg-in" style="width:${wIn.toFixed(1)}%"></span><span class="tw-au-seg tw-au-seg-out" style="width:${wOut.toFixed(1)}%"></span><span class="tw-au-seg tw-au-seg-cache" style="width:${wCache.toFixed(1)}%"></span>` : '';
        const expanded = this._agentUsageExpanded.has(r.id);
        const tip = `输入 ${full(r.input)} · 输出 ${full(r.output)} · 缓存 ${full(r.cache)}`;
        const modelsHtml = expanded ? (r.modelList.length ? r.modelList.map(m =>
          `<div class="tw-au-model-line"><span class="tw-au-model-name">${escapeHtml(m.name)}</span><span>${fmt(m.tokens)} tok · ${m.turns}轮</span></div>`
        ).join('') : '<div class="tw-au-model-line"><span class="tw-au-model-name">无模型用量记录</span><span>—</span></div>') : '';
        let icon = '';
        try { icon = getAgentBrandSvg(r.id, 12); } catch (e) {}
        return `
          <div class="tw-au-row${expanded ? ' expanded' : ''}" data-agent="${r.id}" title="${escapeHtml(tip)}">
            <span class="tw-au-name">${icon}<span>${escapeHtml(r.name)}</span></span>
            <div class="tw-au-bar-wrap"><div class="tw-au-bar" style="width:${barW.toFixed(1)}%">${segsHtml}</div></div>
            <span class="tw-au-meta"><b>${fmt(r.tokens)}</b> tok · ${r.turns}轮 · ${r.sessions}会话<span class="tw-au-caret">›</span></span>
            <div class="tw-au-models">${modelsHtml}</div>
          </div>`;
      }).join('');
      bodyHtml = `<div class="tw-au-rows">${rowsHtml}</div>`;
    }

    const t = stats.totals;
    const footerHtml = `
      <div class="tw-au-footer">
        <span class="tw-au-total">合计 <b>${fmt(t.tokens)}</b> tok · ${t.turns}轮 · ${t.sessions}会话${t.tools ? ` · ${t.tools}工具` : ''}</span>
        <span class="tw-au-legend">
          <span><i class="tw-au-dot" style="background:var(--g-blue,#2563EB)"></i>输入 ${fmt(t.input)}</span>
          <span><i class="tw-au-dot" style="background:var(--g-green,#10B981)"></i>输出 ${fmt(t.output)}</span>
          <span><i class="tw-au-dot" style="background:#8B5CF6"></i>缓存 ${fmt(t.cache)}</span>
        </span>
      </div>`;

    this.agentUsageCardEl.innerHTML = `
      <div class="tw-card-header tw-au-header">
        <span>Agent 用量</span>
        <div class="tw-trend-controls-right">
          <select class="tw-trend-range-select tw-au-range-select" title="切换统计周期">
            <option value="today" ${range === 'today' ? 'selected' : ''}>今日</option>
            <option value="week" ${range === 'week' ? 'selected' : ''}>近7天</option>
            <option value="all" ${range === 'all' ? 'selected' : ''}>全部</option>
          </select>
          <button class="tw-trend-refresh-btn" id="btnRefreshAgentUsage" title="刷新用量统计">${getIconPark('refresh', 12)}</button>
        </div>
      </div>
      ${bodyHtml}
      ${stats.rows.length ? footerHtml : ''}
    `;

    const rangeSelect = this.agentUsageCardEl.querySelector('.tw-au-range-select');
    if (rangeSelect) {
      rangeSelect.onchange = () => {
        this.saveAgentUsageRange(rangeSelect.value);
        this.updateAgentUsageCard();
      };
    }

    const refreshBtn = this.agentUsageCardEl.querySelector('#btnRefreshAgentUsage');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        this.updateAgentUsageCard();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
      };
    }

    this.agentUsageCardEl.querySelectorAll('.tw-au-row').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.agent;
        if (!id) return;
        if (this._agentUsageExpanded.has(id)) this._agentUsageExpanded.delete(id);
        else this._agentUsageExpanded.add(id);
        this.updateAgentUsageCard();
      };
    });
  }"""

if old_constructor in workbench_part:
    workbench_part = workbench_part.replace(old_constructor, new_constructor)
    print("Replaced constructor and added tab helpers")
else:
    print("Warning: old_constructor not found in workbench_part!")

# 2. Update onClose
old_on_close = """  async onClose() {
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
  }"""

new_on_close = """  async onClose() {
    this.closeHeatmapPopover();
    if (this.exploreView) {
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
      container.empty();
      this._harnessMounted = false; // 整体重建后旧挂载标记必然失效
      container.addClass('tabonkb-workbench-container', 'with-drawer');
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
      this.agentDrawer.mount(layout);

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

  getExploreSubTab() {
    if (this.exploreView && this.exploreView.activeSubTab) return this.exploreView.activeSubTab;
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-explore-subtab');
        if (s === 'ai' || s === 'search' || s === 'notion') return s;
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
      { id: 'search', label: '平台资源检索', icon: 'search' },
      { id: 'notion', label: 'Notion AI', icon: 'book' }
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

  renderNavRail(parentEl) {
    const rail = parentEl.createDiv({ cls: 'tw-nav-rail' });

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
      searchPlaceholder = '在 Jira 任务中搜索：输入 Key、摘要、经办人、状态或描述...';
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
        if (this.jiraPlatform) {
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
          this.jiraPlatform?.filterKeyword('');
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

  renderTasksTab(stage) {
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
      }
    });

    this.jiraPlatform.mount(stage);
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
    await this.loadSettings();
    this.applyWorkbenchTheme(this.settings.workbenchTheme);

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

    // Companion Sync Server for Chrome / Edge Extension (127.0.0.1:28123)
    this.companionServer = new CompanionSyncServer({ plugin: this, port: 28123 });
    this.companionServer.start();

    this.drawioBroker = new DrawioBroker({ vaultBasePath: vaultPath });
    this.drawioBroker.start();

    // DSH Daemon Manager
    if (this.settings?.dsh?.enabled !== false && typeof DshDaemonManager !== 'undefined') {
      this.dshDaemon = new DshDaemonManager({
        plugin: this,
        vaultBasePath: vaultPath,
        port: this.settings?.dsh?.port || 3080,
        profile: this.settings?.dsh?.profile || 'tabonkb'
      });
      if (this.settings?.dsh?.autoStart !== false) {
        this.dshDaemon.start().catch((e) => console.warn('[TabonKB] DSH Daemon auto-start failed:', e));
      }
    }

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

    const refreshWorkbench = () => {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
      leaves.forEach(leaf => {
        if (leaf.view && typeof leaf.view.refreshVaultDocs === 'function') {
          leaf.view.refreshVaultDocs();
        }
      });
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

    this._lastObsidianDark = typeof TabonKBThemeEngine !== 'undefined' ? TabonKBThemeEngine.isObsidianDark() : false;
    this.registerEvent(this.app.workspace.on('css-change', () => {
      const curDark = typeof TabonKBThemeEngine !== 'undefined' ? TabonKBThemeEngine.isObsidianDark() : false;
      if (this._lastObsidianDark === curDark) return;
      this._lastObsidianDark = curDark;
      this.applyWorkbenchTheme(this.settings?.workbenchTheme);
    }));


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

    if (this.companionServer) {
      this.companionServer.stop();
    }
    if (this.drawioBroker) {
      this.drawioBroker.stop();
    }
    if (this.dshDaemon) {
      this.dshDaemon.destroy();
    }
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
    workbench_part = plugin_class_pattern.sub(new_plugin_class, workbench_part)
    print("Updated TabonKBWorkbenchPlugin class in workbench_part")
else:
    print("Warning: plugin_class_pattern did not match in workbench_part!")

bundled = header + "\n" + combined_modules + "\n\n\n" + workbench_part

with open(os.path.join(plugin_dir, "main.js"), "w", encoding="utf-8") as f:
    f.write(bundled)

print("Successfully bundled all components into main.js!")
