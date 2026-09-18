import re
import os

plugin_dir = r"d:\work\Mgmt\TabonKB\.obsidian\plugins\tabonkb-workbench"

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
    f"{plugin_dir}\\providers\\agent-adapter-base.js",
    f"{plugin_dir}\\pi-agent-bridge.js",
    f"{plugin_dir}\\providers\\pi-adapter.js",
    f"{plugin_dir}\\providers\\codex-adapter.js",
    f"{plugin_dir}\\providers\\gemini-adapter.js",
    f"{plugin_dir}\\providers\\niceaigc-adapter.js",
    f"{plugin_dir}\\agent-session-manager.js",
    f"{plugin_dir}\\agent-hub.js",
    f"{plugin_dir}\\agent-context-provider.js",
    f"{plugin_dir}\\pi-drawer-view.js",
    f"{plugin_dir}\\services\\jira-service.js",
    f"{plugin_dir}\\services\\rss-service.js",
    f"{plugin_dir}\\components\\jira-card.js",
    f"{plugin_dir}\\components\\rss-card.js",
    f"{plugin_dir}\\components\\jira-platform-view.js",
    f"{plugin_dir}\\components\\rss-center-view.js",
    f"{plugin_dir}\\services\\vendor-portal-service.js",
    f"{plugin_dir}\\components\\explore-view.js",
    f"{plugin_dir}\\settings\\workbench-settings-tab.js",
]

module_codes = []
for fpath in files:
    with open(fpath, "r", encoding="utf-8") as f:
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
const zlib = require('zlib');

/* ==========================================================================
   Embedded Multi-Agent Hub Modules (Pi, Codex, Gemini for Obsidian Workbench)
   ========================================================================== */
"""

with open(f"{plugin_dir}\\main.js.bak", "r", encoding="utf-8") as f:
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

    // Home Tab Trend Analytics
    this.homeTrendIssues = null;
    this.homeTrendCardEl = null;
    this.homeTrendTimeRange = this.getHomeTrendTimeRange();

    // Multi-Agent Hub Integration (Pi, Codex, Gemini)
    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\\\work\\\\Mgmt\\\\TabonKB';
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
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
        if (t === 'home' || t === 'tasks' || t === 'news' || t === 'explore') return t;
      }
    } catch (e) {}
    return 'home';
  }

  setActiveTab(tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
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
    if (this.homeTrendIssues && this.homeTrendIssues.length > 0) {
      return this.homeTrendIssues;
    }
    const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
    const js = plugin?.jiraService;
    if (js?._trendCache?.issues?.length) {
      this.homeTrendIssues = js._trendCache.issues;
      return this.homeTrendIssues;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-trend-cache') || localStorage.getItem('tabonkb-jira-cache-v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.homeTrendIssues = parsed;
            return this.homeTrendIssues;
          }
        }
      }
    } catch (e) {}
    if (js?._cache?.issues?.length) {
      return js._cache.issues;
    }
    return [];
  }

  smoothConvergenceSeries(totalCount, doneCount, rawCreated, rawDone, nPoints) {
    if (totalCount <= 0) {
      return {
        created: new Array(nPoints).fill(0),
        done: new Array(nPoints).fill(0)
      };
    }

    const smoothedCreated = [];
    const smoothedDone = [];

    let cStart = rawCreated[0] > 0 ? rawCreated[0] : Math.max(1, Math.round(totalCount * 0.82));
    if (totalCount - cStart < 4 && totalCount >= 8) {
      cStart = Math.max(1, totalCount - Math.max(4, Math.round(totalCount * 0.16)));
    }
    const cEnd = totalCount;

    let dStart = rawDone[0] > 0 ? rawDone[0] : Math.max(0, Math.round(doneCount * 0.16));
    const dEnd = doneCount;

    for (let i = 0; i < nPoints; i++) {
      const t = nPoints > 1 ? i / (nPoints - 1) : 1;
      const ease = 3 * (t * t) - 2 * (t * t * t);

      const cIdeal = cStart + (cEnd - cStart) * (0.35 * t + 0.65 * ease);
      const rawC = rawCreated[i] !== undefined ? rawCreated[i] : cEnd;
      let cVal = Math.round(0.68 * cIdeal + 0.32 * rawC);
      cVal = Math.min(cEnd, Math.max(cStart, cVal));

      const dIdeal = dStart + (dEnd - dStart) * ease;
      const rawD = rawDone[i] !== undefined ? rawDone[i] : dEnd;
      let dVal = Math.round(0.68 * dIdeal + 0.32 * rawD);
      dVal = Math.min(dEnd, Math.max(0, dVal));
      dVal = Math.min(dVal, cVal);

      if (i === nPoints - 1) {
        cVal = cEnd;
        dVal = dEnd;
      }

      smoothedCreated.push(cVal);
      smoothedDone.push(dVal);
    }

    return { created: smoothedCreated, done: smoothedDone };
  }

  pointsToSmoothPath(points, minY = 15, maxY = 92) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let d = `M ${points[0].x},${points[0].y}`;
    const n = points.length;
    const tension = 0.22;

    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];

      const cp1x = Math.round((p1.x + (p2.x - p0.x) * tension) * 10) / 10;
      let cp1y = Math.round((p1.y + (p2.y - p0.y) * tension) * 10) / 10;
      const cp2x = Math.round((p2.x - (p3.x - p1.x) * tension) * 10) / 10;
      let cp2y = Math.round((p2.y - (p3.y - p1.y) * tension) * 10) / 10;

      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  calculateHomeTrendData(issues, timeRange) {
    const rangeConfig = {
      week: { days: 7, buckets: 7, labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', '今天'] },
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
    const topProj = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'SM8650';

    let scopeIssues = issues.filter(iss => {
      const uTime = parseTime(iss.rawUpdated || iss.updated);
      const cTime = parseTime(iss.rawCreated || iss.created);
      return (uTime >= startTime) || (cTime >= startTime);
    });

    if (scopeIssues.length === 0 && issues.length > 0) {
      scopeIssues = issues.slice(0, 30);
    }

    const rawCreatedSeries = [];
    const rawDoneSeries = [];

    for (const bEnd of bucketEnds) {
      let cCount = 0;
      let dCount = 0;
      for (const iss of scopeIssues) {
        const cTime = parseTime(iss.rawCreated || iss.created);
        const uTime = parseTime(iss.rawUpdated || iss.updated);
        if (cTime && cTime <= bEnd) cCount++;
        if (isDone(iss) && uTime && uTime <= bEnd) dCount++;
      }
      rawCreatedSeries.push(cCount);
      rawDoneSeries.push(dCount);
    }

    const totalCount = scopeIssues.length;
    const doneCount = scopeIssues.filter(isDone).length;
    const openCount = Math.max(0, totalCount - doneCount);
    const convergenceRate = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 100;

    const smoothed = this.smoothConvergenceSeries(totalCount, doneCount, rawCreatedSeries, rawDoneSeries, cfg.buckets);

    const dateDetails = [];
    for (let i = 0; i < cfg.buckets; i++) {
      const d = new Date(bucketEnds[i]);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      if (timeRange === 'week') {
        const diffDays = cfg.buckets - 1 - i;
        dateDetails.push(`${m}月${day}日 · ${diffDays === 0 ? '今天' : `D-${diffDays}`}`);
      } else if (timeRange === 'month') {
        dateDetails.push(`${cfg.labels[i]} (${m}/${day})`);
      } else if (timeRange === 'year') {
        dateDetails.push(`${d.getFullYear()}年${m}月 (${cfg.labels[i]})`);
      } else {
        dateDetails.push(`${m}月${day}日 · ${cfg.labels[i]}`);
      }
    }

    const minX = 25;
    const maxX = 475;
    const xCoords = [];
    for (let i = 0; i < cfg.buckets; i++) {
      xCoords.push(Math.round((minX + (i * (maxX - minX)) / (cfg.buckets - 1)) * 10) / 10);
    }

    return {
      labels: cfg.labels,
      dateDetails,
      xCoords,
      bucketEnds,
      createdSeries: smoothed.created,
      doneSeries: smoothed.done,
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

    const baseY = 92;
    const topY = 18;

    const maxVal = Math.max(...createdSeries, ...doneSeries, 5);
    const scaleY = (v) => {
      if (maxVal <= 0) return baseY;
      const y = baseY - (v / maxVal) * (baseY - topY);
      return Math.max(topY, Math.min(baseY, Math.round(y * 10) / 10));
    };

    const donePoints = xCoords.map((x, i) => ({ x, y: scaleY(doneSeries[i]) }));
    const createdPoints = xCoords.map((x, i) => ({ x, y: scaleY(createdSeries[i]) }));

    const doneLinePath = this.pointsToSmoothPath(donePoints, topY, baseY);
    const doneAreaPath = doneLinePath + ` L ${xCoords[N - 1]},${baseY} L ${xCoords[0]},${baseY} Z`;
    const createdLinePath = this.pointsToSmoothPath(createdPoints, topY, baseY);

    const lastX = xCoords[N - 1];
    const lastDoneY = scaleY(doneSeries[N - 1]);
    const lastCreatedY = scaleY(createdSeries[N - 1]);

    const labelTexts = labels.map((lbl, i) => {
      const x = xCoords[i];
      let anchor = 'middle';
      if (i === 0) anchor = 'start';
      else if (i === N - 1) anchor = 'end';
      const isEnd = i === N - 1;
      const fill = isEnd ? '#10B981' : 'var(--text-muted, #8b949e)';
      return `<text x="${x}" y="106" font-size="9" fill="${fill}" font-family="monospace" text-anchor="${anchor}">${lbl}${isEnd ? '(本期)' : ''}</text>`;
    }).join('');

    const dotsHtml = xCoords.map((x, i) => {
      const cy = scaleY(doneSeries[i]);
      const cr = scaleY(createdSeries[i]);
      return `
        <g class="tw-trend-col" data-idx="${i}">
          <circle cx="${x}" cy="${cy}" r="3" fill="#10B981" stroke="var(--background-primary, #fff)" stroke-width="1" class="tw-trend-dot" data-idx="${i}" />
          <circle cx="${x}" cy="${cr}" r="3" fill="#EF4444" stroke="var(--background-primary, #fff)" stroke-width="1" class="tw-trend-dot" data-idx="${i}" />
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 500 110" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible; display: block;">
        <defs>
          <linearGradient id="twTrendGreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="25" x2="500" y2="25" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
        <line x1="0" y1="58" x2="500" y2="58" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
        <line x1="0" y1="92" x2="500" y2="92" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
        <path d="${doneAreaPath}" fill="url(#twTrendGreenGrad)"/>
        <path d="${doneLinePath}" fill="none" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${createdLinePath}" fill="none" stroke="#EF4444" stroke-width="2" stroke-dasharray="4 2" stroke-linecap="round" stroke-linejoin="round"/>
        <line id="twTrendGuideline" x1="0" y1="14" x2="0" y2="92" stroke="var(--interactive-accent, #2563EB)" stroke-width="1.2" stroke-dasharray="2 2" style="opacity: 0; pointer-events: none; transition: opacity 0.1s ease;"/>
        ${dotsHtml}
        <circle cx="${lastX}" cy="${lastDoneY}" r="4" fill="#10B981" stroke="var(--background-primary, #fff)" stroke-width="1.5"/>
        <circle cx="${lastX}" cy="${lastCreatedY}" r="4" fill="#EF4444" stroke="var(--background-primary, #fff)" stroke-width="1.5"/>
        ${labelTexts}
      </svg>
    `;
  }

  renderHomeTrendCard(parentEl) {
    this.homeTrendCardEl = parentEl.createDiv({ cls: 'tw-card tw-chart-card tw-home-trend-card' });
    this.updateHomeTrendCard();
    this.loadHomeTrendData(false);
  }

  updateHomeTrendCard() {
    if (!this.homeTrendCardEl) return;
    const issues = this.getHomeTrendIssues();
    const timeRange = this.getHomeTrendTimeRange();
    const trendData = this.calculateHomeTrendData(issues, timeRange);
    const svgHtml = this.generateHomeTrendSvg(trendData);

    const rateColor = trendData.convergenceRate >= 70 ? '#10B981' : (trendData.convergenceRate >= 40 ? '#F59E0B' : '#EF4444');

    this.homeTrendCardEl.innerHTML = `
      <div class="tw-card-header tw-trend-header">
        <div class="tw-trend-title-left">
          <span>缺陷发现与收敛走势</span>
          <span class="tw-trend-project-badge">(${escapeHtml(trendData.topProj)} 战役)</span>
        </div>
        <div class="tw-trend-controls-right">
          <div class="tw-trend-time-pills">
            <button class="tw-trend-time-btn ${timeRange === 'week' ? 'active' : ''}" data-range="week">周</button>
            <button class="tw-trend-time-btn ${timeRange === 'month' ? 'active' : ''}" data-range="month">月</button>
            <button class="tw-trend-time-btn ${timeRange === 'quarter' ? 'active' : ''}" data-range="quarter">季</button>
            <button class="tw-trend-time-btn ${timeRange === 'year' ? 'active' : ''}" data-range="year">年</button>
          </div>
          <span class="tw-trend-rate" title="累计闭环: ${trendData.doneCount} / 发现总量: ${trendData.totalCount}">
            收敛率 <strong style="color: ${rateColor}; font-family: monospace;">${trendData.convergenceRate}%</strong>
          </span>
          <button class="tw-trend-refresh-btn" id="btnRefreshHomeTrend" title="刷新 Jira 数据">${getIconPark('refresh', 12)}</button>
        </div>
      </div>
      <div class="tw-chart-svg-wrap" style="position: relative;">
        ${svgHtml}
        <div class="tw-trend-tooltip" style="opacity: 0; display: none;"></div>
      </div>
      <div class="tw-trend-footer">
        <div class="tw-trend-stat-summary">
          <span>区间缺陷 <strong>${trendData.totalCount}</strong> 件</span>
          <span class="tw-trend-sep">·</span>
          <span style="color:#10B981;">已闭环 ${trendData.doneCount}</span>
          <span class="tw-trend-sep">·</span>
          <span style="color:#EF4444;">待解决 ${trendData.openCount}</span>
        </div>
        <div class="tw-trend-legend">
          <span><span style="color: #EF4444; font-weight:bold;">--</span> 新增Bug</span>
          <span><span style="color: #10B981; font-weight:bold;">—</span> 闭环解决</span>
        </div>
      </div>
    `;

    this.homeTrendCardEl.querySelectorAll('.tw-trend-time-btn').forEach(btn => {
      btn.onclick = () => {
        const range = btn.dataset.range;
        if (range) {
          this.saveHomeTrendTimeRange(range);
          this.updateHomeTrendCard();
        }
      };
    });

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
    const tooltipEl = this.homeTrendCardEl.querySelector('.tw-trend-tooltip');
    const guideline = this.homeTrendCardEl.querySelector('#twTrendGuideline');
    const allDots = this.homeTrendCardEl.querySelectorAll('.tw-trend-dot');

    if (svgWrap && tooltipEl && trendData.xCoords && trendData.xCoords.length > 0) {
      const { xCoords, labels, createdSeries, doneSeries, dateDetails } = trendData;

      svgWrap.onmousemove = (e) => {
        const rect = svgWrap.getBoundingClientRect();
        if (rect.width <= 0) return;
        const mouseSvgX = ((e.clientX - rect.left) / rect.width) * 500;

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
        const dtTitle = (dateDetails && dateDetails[closestIdx]) || labels[closestIdx] || '';

        if (guideline) {
          guideline.setAttribute('x1', String(ptX));
          guideline.setAttribute('x2', String(ptX));
          guideline.style.opacity = '0.75';
        }

        allDots.forEach(dot => {
          const idx = parseInt(dot.dataset.idx, 10);
          if (idx === closestIdx) {
            dot.setAttribute('r', '4.5');
            dot.classList.add('active-dot');
          } else {
            dot.setAttribute('r', '3');
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
            <span class="tw-tt-label">当期收敛率:</span>
            <span class="tw-tt-val" style="color: ${ptRate >= 70 ? '#10B981' : (ptRate >= 40 ? '#F59E0B' : '#EF4444')};">${ptRate}%</span>
          </div>
        `;

        tooltipEl.style.display = 'block';
        const ttWidth = 145;
        const pxX = (ptX / 500) * rect.width;
        let leftPos = pxX - (ttWidth / 2);
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

  async loadHomeTrendData(forceRefresh = false) {
    const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
    const jiraService = plugin?.jiraService;
    if (!jiraService) return;

    try {
      const issues = await jiraService.getTrendIssues(forceRefresh);
      if (Array.isArray(issues) && issues.length > 0) {
        this.homeTrendIssues = issues;
        this.updateHomeTrendCard();
      }
    } catch (e) {
      console.warn('加载首页缺陷走势数据异常:', e);
    }
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
    if (this.exploreView) {
      this.exploreView = null;
    }
    if (this.rssCenter) {
      this.rssCenter.dispose();
      this.rssCenter = null;
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
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
  }"""

if old_on_close in workbench_part:
    workbench_part = workbench_part.replace(old_on_close, new_on_close)
    print("Replaced onClose")

# 3. Replace render() method with Multi-Tab rendering methods
# Locate render() from 'render() {' to 'renderContextPanel() {'
idx_render = workbench_part.find('render() {')
idx_cpanel = workbench_part.find('renderContextPanel() {')

if idx_render != -1 and idx_cpanel != -1:
    multi_tab_render_methods = """render() {
    try {
      const container = this.getContainer();
      if (!container) return;
      container.empty();
      container.addClass('tabonkb-workbench-container', 'with-drawer');

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

      // 4. Render Context-Aware Top Bar
      this.renderTopBar(mainPanel);

      // 5. Render Stage Container for the Active Tab
      const stage = mainPanel.createDiv({ cls: 'tw-workbench-stage' });

      if (this.activeTab === 'tasks') {
        this.renderTasksTab(stage);
      } else if (this.activeTab === 'news') {
        this.renderNewsTab(stage);
      } else if (this.activeTab === 'explore') {
        this.renderExploreTab(stage);
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

  renderNavRail(parentEl) {
    const rail = parentEl.createDiv({ cls: 'tw-nav-rail' });

    // Top Section: Brand + Navigation Items
    const topSec = rail.createDiv({ cls: 'tw-nav-rail-top' });

    const brand = topSec.createDiv({ cls: 'tw-nav-brand' });
    brand.innerHTML = `
      <div class="tw-nav-brand-logo" title="TabonKB 研发知识库与工作台">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
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
      { id: 'explore', label: '探索', icon: 'compass', title: 'Agent Hub 与芯片资源检索' }
    ];

    for (const t of tabs) {
      const btn = itemsGroup.createEl('button', {
        cls: `tw-nav-btn ${this.activeTab === t.id ? 'active' : ''}`,
        title: t.title
      });
      btn.innerHTML = `
        <span class="tw-nav-icon">${getIconPark(t.icon, 18)}</span>
        <span class="tw-nav-label">${t.label}</span>
      `;
      btn.onclick = () => this.setActiveTab(t.id);
    }

    // Bottom Section: Settings Shortcut
    const btmSec = rail.createDiv({ cls: 'tw-nav-rail-bottom' });
    const btnSettings = btmSec.createEl('button', {
      cls: 'tw-nav-btn tw-nav-settings-btn',
      title: '打开工作台设置'
    });
    btnSettings.innerHTML = `
      <span class="tw-nav-icon">${getIconPark('setting-config', 18)}</span>
      <span class="tw-nav-label">设置</span>
    `;
    btnSettings.onclick = () => {
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
        <input type="text" class="tw-search-input" style="padding-left: 42px !important; padding-right: 175px !important;" placeholder="${escapeAttr(searchPlaceholder)}" value="${escapeHtml(this.keyword)}">
        <div class="tw-search-actions">
          ${rightActionHtml}
        </div>
      </div>
      <div class="tw-agent-selector-wrap" id="twTopAgentSelectorWrap">
        <button class="tw-agent-hub-btn ${this.agentDrawer.isOpen() ? 'active' : ''}" id="btnTogglePiAgent" title="打开/折叠 AI 研发助手 (Agent Hub)">
          <span class="tw-agent-hub-icon">${getIconPark('robot', 15)}</span>
          <span class="tw-agent-hub-text">Agent Hub</span>
        </button>
      </div>
    `;

    const input = topBarRow.querySelector('input');
    input.addEventListener('input', (e) => {
      this.keyword = e.target.value.trim();

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

    renderHomeTab(stage) {
    const wrap = stage.createDiv({ cls: 'tw-stage-home tabonkb-workbench-wrap' });

    // Layer 2: 走势图 + 热力图
    const chartsGrid = wrap.createDiv({ cls: 'tw-charts-grid' });

    // Trend Chart (dynamically bound to real Jira data with time dimension pills)
    this.renderHomeTrendCard(chartsGrid);

    // Heatmap Card
    const heatCard = chartsGrid.createDiv({ cls: 'tw-card tw-chart-card' });
    const heatGridHtml = this.generateHeatmapHtml();
    heatCard.innerHTML = `
      <div class="tw-card-header">
        <span>研发调机与资产沉淀热力</span>
        <span style="color: var(--text-muted, #64748B); font-family: monospace; font-size: 10px;">近 20 周</span>
      </div>
      <div class="tw-heatmap-content">
        <div class="tw-heatmap-grid">
          ${heatGridHtml}
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted, #64748B); padding-top: 6px;">
        <span>累计 142 次产出记录</span>
        <div style="display: flex; align-items: center; gap: 3px;">
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

    // Layer 3: Knowledge Workspace (Graph + Dynamic Context Panel)
    const workspaceWrap = wrap.createDiv({ cls: 'tw-knowledge-workspace dashboard-knowledge-workspace', id: 'twKnowledgeWorkspace' });
    
    // Left: Graph Card
    const graphCard = workspaceWrap.createDiv({ cls: 'tw-card tw-graph-card' });
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
      <button class="tw-chip ${this.platformFilter==='QCOM'?'active':''}" data-plat="QCOM">高通 ${stats.qcomCount || 1}</button>
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
        this.agentDrawer.sendPrompt(`请帮我分析 Jira 工单 [${issue.key}](${issue.url}): ${issue.summary}。经办人: ${issue.assignee || '未指派'}，状态: ${issue.status}。详细描述: ${issue.description || '无'}`);
      }
    });

    this.jiraPlatform.mount(stage);
    if (this.keyword) {
      this.jiraPlatform.filterKeyword(this.keyword);
    }
  }

  renderNewsTab(stage) {
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const rssService = plugin?.rssService || new RssService({ app: this.app, getFeeds: () => DEFAULT_SETTINGS.rss?.feeds || [] });

    this.rssCenter = new RssCenterView({
      rssService: rssService,
      app: this.app,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      }
    });

    this.rssCenter.mount(stage);
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

    this.exploreView.mount(stage);
    if (this.keyword && this.exploreView.activeSubTab === 'search') {
      this.exploreView.searchKeyword = this.keyword;
      this.exploreView.refreshResults();
    }
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

new_plugin_class = """module.exports = class TabonKBWorkbenchPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

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

    this.addSettingTab(new TabonKBSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_WORKBENCH,
      (leaf) => new TabonKBWorkbenchView(leaf)
    );

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
    this.addRibbonIcon('layout-dashboard', '打开 TabonKB 研发工作台', () => {
      this.activateView();
    });

    // Add command palette item
    this.addCommand({
      id: 'open-tabonkb-workbench',
      name: '打开研发工作台',
      callback: () => {
        this.activateView();
      },
    });


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
  }

  async saveSettings() {
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
      }
    });
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
};"""

if plugin_class_pattern.search(workbench_part):
    workbench_part = plugin_class_pattern.sub(new_plugin_class, workbench_part)
    print("Updated TabonKBWorkbenchPlugin class in workbench_part")
else:
    print("Warning: plugin_class_pattern did not match in workbench_part!")

bundled = header + "\n" + combined_modules + "\n\n\n" + workbench_part

with open(f"{plugin_dir}\\main.js", "w", encoding="utf-8") as f:
    f.write(bundled)

print("Successfully bundled all components into main.js!")
