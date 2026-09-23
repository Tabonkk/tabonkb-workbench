const { getIconPark } = require('../ui/iconpark.js');
const { formatRelativeTime } = require('../services/jira-service.js');

/**
 * JiraPlatformView: Full-screen Jira Management Platform for TabonKB.
 * Features:
 * - Kanban Board (4 workflow columns) & Table List view toggle
 * - Instant offline caching (sub-10ms load) + sync status tracking
 * - Preset JQL quick tabs (All Unresolved, Assigned to me, High priority, Recent)
 * - In-App Status Transitions [To Do] [In Progress] [In Review] [Done]
 * - Issue Inspector side drawer with Markdown link copy & Agent Hub dispatch
 * - Local keyword filtering & real-time search match
 */
/**
 * 优先级等级分类: 兼容 Jira 中/英文字标 (致命(Fatal) / 严重(Major) / 一般(Normal) / 次要(Minor) 等),
 * 返回四档胶囊样式类: p-urgent 红 / p-high 橙 / p-medium 蓝 / p-low 绿
 */
function resolveKanbanPriorityClass(priority) {
  if (!priority) return 'p-medium';
  const p = priority.toLowerCase();
  if (p.includes('blocker') || p.includes('fatal') || p.includes('critical') || p.includes('highest') || p.includes('urgent') || p.includes('p0') || p.includes('\u7d27\u6025') || p.includes('\u81f4\u547d') || p.includes('\u6700\u9ad8') || p.includes('\u4e25\u91cd\u963b\u585e')) return 'p-urgent';
  if (p.includes('major') || p.includes('high') || p.includes('p1') || p.includes('\u4e25\u91cd') || p.includes('\u9ad8')) return 'p-high';
  if (p.includes('minor') || p.includes('trivial') || p.includes('low') || p.includes('p3') || p.includes('p4') || p.includes('\u6b21\u8981') || p.includes('\u8f7b\u5fae') || p.includes('\u4f4e')) return 'p-low';
  return 'p-medium';
}

class JiraPlatformView {
  constructor(options = {}) {
    this.jiraService = options.jiraService;
    this.app = options.app;
    this.onOpenSettings = options.onOpenSettings;
    this.onAskAgent = options.onAskAgent;

    this.containerEl = null;
    this.issues = [];
    this.filteredIssues = [];
    this.isLoading = false;
    this.error = null;

    // View & preset states
    this.currentView = this.getSavedViewMode();
    this.activeProject = this.getSavedProject();
    this.activeTimeRange = this.getSavedTimeRange();
    this.keyword = '';
    this.selectedIssue = null;
    this.isTransitioning = false;
  }

  getSavedViewMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('tabonkb-jira-view-mode');
        if (v === 'kanban' || v === 'table') return v;
      }
    } catch (e) {}
    return 'kanban';
  }

  saveViewMode(mode) {
    this.currentView = mode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-view-mode', mode);
      }
    } catch (e) {}
  }

  getSavedProject() {
    try {
      if (typeof localStorage !== 'undefined') {
        const p = localStorage.getItem('tabonkb-jira-project');
        if (p) return p;
      }
    } catch (e) {}
    return 'all';
  }

  saveProject(project) {
    this.activeProject = project;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-project', project);
      }
    } catch (e) {}
  }

  getSavedTimeRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const tr = localStorage.getItem('tabonkb-jira-timerange');
        if (tr) return tr;
      }
    } catch (e) {}
    return 'all';
  }

  saveTimeRange(range) {
    this.activeTimeRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-timerange', range);
      }
    } catch (e) {}
  }

  // 从已加载事项中提取项目 key（SEX90-526 → SEX90），去重排序供下拉选择
  getProjectKeys() {
    const set = new Set();
    for (const it of this.issues) {
      const m = /^(.+)-\d+$/.exec(it.key || '');
      if (m) set.add(m[1]);
    }
    return [...set].sort();
  }

  getProjectJql(project, timeRange = this.activeTimeRange) {
    // 只采集与当前用户相关的事项（经办/关注/提报任一命中），避免拉全公司工单；
    // 同时纳入近 30 天内已解决/关闭的事项，让看板「已完成」列能呈现闭环结果
    let baseJql = '(resolution = Unresolved OR resolutiondate >= -30d) AND (assignee = currentUser() OR watcher = currentUser() OR reporter = currentUser())';
    if (project && project !== 'all') {
      baseJql += ` AND project = "${project}"`;
    }

    if (timeRange && timeRange !== 'all') {
      switch (timeRange) {
        case 'week':
          baseJql += ' AND updated >= -7d';
          break;
        case 'month':
          baseJql += ' AND updated >= -30d';
          break;
        case 'quarter':
          baseJql += ' AND updated >= -90d';
          break;
        case 'year':
          baseJql += ' AND updated >= -365d';
          break;
      }
    }

    return `${baseJql} ORDER BY updated DESC`;
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.render();
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    if (config) {
      config.jql = this.getProjectJql(this.activeProject, this.activeTimeRange);
    }
    // Offline-first load: render from cache first, then refresh if expired
    this.loadIssues(false);
  }

  async loadIssues(forceRefresh = false) {
    if (!this.jiraService) return;
    this.isLoading = true;
    this.error = null;
    this.updateLoadingState();

    try {
      const res = await this.jiraService.searchIssues(forceRefresh);
      if (res.error) {
        if (!res.issues || res.issues.length === 0) {
          this.error = res.error;
          this.syncWarning = null;
        } else {
          this.syncWarning = res.error;
          this.issues = res.issues || [];
          this.applyKeywordFilter();
          if (forceRefresh && typeof Notice !== 'undefined') {
            new Notice(`⚠️ Jira 刷新受阻: ${res.error}`, 8000);
          }
        }
      } else {
        this.syncWarning = null;
        this.issues = res.issues || [];
        this.applyKeywordFilter();
        if (forceRefresh && typeof Notice !== 'undefined') {
          new Notice(`✓ Jira 数据已成功同步 (共 ${this.issues.length} 条事项)`, 4000);
        }
      }
    } catch (err) {
      this.error = err.message || '加载 Jira 任务失败';
      if (forceRefresh && typeof Notice !== 'undefined') {
        new Notice(`❌ Jira 加载异常: ${this.error}`, 8000);
      }
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  filterKeyword(keyword) {
    this.keyword = (keyword || '').trim().toLowerCase();
    this.applyFilters();
    this.renderStage();
    this.renderMetricsBar(this.containerEl?.querySelector('.tw-jira-platform'));
  }

  setTimeRange(range) {
    if (this.activeTimeRange === range) return;
    this.saveTimeRange(range);

    // 同步时间下拉框选中值
    const timeSelect = this.containerEl?.querySelector('.tw-jira-time-select');
    if (timeSelect) timeSelect.value = range;

    // 1. Instant client-side filtering for 0-latency feedback
    this.applyFilters();
    this.renderStage();
    this.renderMetricsBar(this.containerEl?.querySelector('.tw-jira-platform'));

    // 2. Refresh from server with updated JQL for 100% full accuracy
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    if (config) {
      config.jql = this.getProjectJql(this.activeProject, range);
    }
    this.loadIssues(true);
  }

  applyKeywordFilter() {
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.issues];

    // 1. Time range filter (Week, Month, Quarter, Year)
    if (this.activeTimeRange && this.activeTimeRange !== 'all') {
      const now = Date.now();
      let maxAgeMs = 0;
      switch (this.activeTimeRange) {
        case 'week': maxAgeMs = 7 * 86400000; break;
        case 'month': maxAgeMs = 30 * 86400000; break;
        case 'quarter': maxAgeMs = 90 * 86400000; break;
        case 'year': maxAgeMs = 365 * 86400000; break;
      }

      if (maxAgeMs > 0) {
        result = result.filter(issue => {
          let issueTime = 0;
          if (issue.rawUpdated) {
            const d = new Date(issue.rawUpdated).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issue.rawCreated) {
            const d = new Date(issue.rawCreated).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issueTime === 0 && issue.updated) {
            const d = new Date(issue.updated).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issueTime === 0 && issue.created) {
            const d = new Date(issue.created).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issueTime > 0) {
            return (now - issueTime) <= maxAgeMs;
          }
          return true;
        });
      }
    }

    // 2. Keyword text search
    if (this.keyword) {
      const kw = this.keyword;
      result = result.filter(issue => {
        const k = (issue.key || '').toLowerCase();
        const s = (issue.summary || '').toLowerCase();
        const a = (issue.assignee || '').toLowerCase();
        const st = (issue.status || '').toLowerCase();
        const d = (issue.description || '').toLowerCase();
        return k.includes(kw) || s.includes(kw) || a.includes(kw) || st.includes(kw) || d.includes(kw);
      });
    }

    this.filteredIssues = result;
  }

  categorizeStatus(statusName, statusCategory) {
    const s = (statusName || '').toLowerCase();
    const cat = (statusCategory || '').toLowerCase();

    if (cat === 'done' || s.includes('closed') || s.includes('done') || s.includes('resolved') || s.includes('fixed') || s.includes('已解决') || s.includes('关闭') || s.includes('完成') || s.includes('验证通过')) {
      return 'done';
    }
    if (s.includes('review') || s.includes('verify') || s.includes('verification') || s.includes('测试') || s.includes('评审') || s.includes('待验')) {
      return 'review';
    }
    if (cat === 'indeterminate' || s.includes('progress') || s.includes('developing') || s.includes('处理') || s.includes('进行中') || s.includes('开发中')) {
      return 'inprogress';
    }
    return 'todo';
  }

  // 经办人是否为本账户（Server 比 username，Cloud 比 accountId/email）
  isAssignedToMe(issue) {
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    const me = String(config.username || '').toLowerCase();
    const myEmail = String(config.email || '').toLowerCase();
    if (!me && !myEmail) return true; // 无法确定当前账号时不过滤
    // 旧缓存无账号字段时不过滤，强制刷新后自动精确
    if (issue.assigneeName === undefined && issue.assigneeEmail === undefined) return true;
    const name = String(issue.assigneeName || '').toLowerCase();
    const email = String(issue.assigneeEmail || '').toLowerCase();
    if (name && ((me && name === me) || (myEmail && name === myEmail))) return true;
    if (email && myEmail && email === myEmail) return true;
    // 兼容 displayName 直接存在 username 配置里的情况
    if (me && String(issue.assignee || '').toLowerCase() === me) return true;
    return false;
  }

  getGroupedIssues() {
    const groups = {
      todo: [],
      inprogress: [],
      review: [],
      done: []
    };

    for (const issue of this.filteredIssues) {
      const groupKey = this.categorizeStatus(issue.status, issue.statusCategory);
      // 进行中阶段（待办/处理中）只统计经办人为本账户的事项，他人经办的不纳入这两列
      if ((groupKey === 'todo' || groupKey === 'inprogress') && !this.isAssignedToMe(issue)) continue;
      groups[groupKey].push(issue);
    }
    return groups;
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.empty();
    this.containerEl.addClass('tw-jira-platform-root');

    const platformWrap = this.containerEl.createDiv({ cls: 'tw-jira-platform' });

    // 1. Header Console Toolbar
    this.renderHeaderConsole(platformWrap);

    // 1.5 Sync Warning Banner (when refresh failed and offline cache is shown)
    this.renderWarningBanner(platformWrap);

    // 2. Metrics Bar
    this.renderMetricsBar(platformWrap);

    // 3. Stage Container (Kanban or Table)
    this.stageContainer = platformWrap.createDiv({ cls: 'tw-jira-stage-container' });
    this.renderStage();

    // 4. Inspector Drawer Mountpoint
    this.inspectorContainer = platformWrap.createDiv({ cls: 'tw-jira-inspector-overlay' });
    this.inspectorContainer.style.display = 'none';
  }

  renderWarningBanner(parentEl) {
    if (!this.syncWarning) return;
    const banner = parentEl.createDiv({ cls: 'tw-jira-sync-warning-banner' });
    banner.innerHTML = `
      <div class="tw-jira-warn-left">
        <span class="tw-jira-warn-icon">⚠️</span>
        <div class="tw-jira-warn-msg">
          <strong>Jira 数据未能实时刷新（当前展示离线缓存）：</strong>
          <span class="tw-jira-warn-desc">${escapeHtml(this.syncWarning)}</span>
        </div>
      </div>
      <div class="tw-jira-warn-actions">
        <button class="tw-jira-warn-btn" id="twBtnOpenJiraSettings">🔑 打开设置更新凭据 / 密码</button>
        <button class="tw-jira-warn-btn-retry" id="twBtnRetrySync">🔄 重试刷新</button>
      </div>
    `;
    const btnSet = banner.querySelector('#twBtnOpenJiraSettings');
    if (btnSet) {
      btnSet.onclick = () => {
        this.app?.setting?.open?.();
        this.app?.setting?.openTabById?.('tabonkb-workbench');
      };
    }
    const btnRetry = banner.querySelector('#twBtnRetrySync');
    if (btnRetry) {
      btnRetry.onclick = () => this.loadIssues(true);
    }
  }

  renderHeaderConsole(parentEl) {
    const consoleEl = parentEl.createDiv({ cls: 'tw-jira-console' });

    const leftWrap = consoleEl.createDiv({ cls: 'tw-jira-console-left' });
    
    // 1. Project Selector (全部 + 各 Jira 项目，下拉选择)
    const projWrap = leftWrap.createDiv({ cls: 'tw-jira-project-wrap' });
    const projLabel = projWrap.createSpan({ cls: 'tw-jira-time-label' });
    projLabel.innerHTML = `${getIconPark('folder', 12)} 项目:`;
    const projSelect = projWrap.createEl('select', {
      cls: 'tw-jira-project-select',
      title: '按 Jira 项目筛选任务'
    });
    const projectKeys = this.getProjectKeys();
    // 当前选中项目不在已加载列表中时临时补入，避免选择丢失
    if (this.activeProject !== 'all' && !projectKeys.includes(this.activeProject)) {
      projectKeys.unshift(this.activeProject);
    }
    const optAll = projSelect.createEl('option', { text: '全部', value: 'all' });
    if (this.activeProject === 'all') optAll.selected = true;
    for (const pk of projectKeys) {
      const opt = projSelect.createEl('option', { text: pk, value: pk });
      if (pk === this.activeProject) opt.selected = true;
    }
    projSelect.onchange = () => {
      const v = projSelect.value || 'all';
      if (v === this.activeProject) return;
      this.saveProject(v);
      const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
      if (config) {
        config.jql = this.getProjectJql(v, this.activeTimeRange);
      }
      this.loadIssues(true);
    };

    // 2. Time Dimension Filter: 全部 / 周 / 月 / 季 / 年
    const timeRanges = [
      { id: 'all', label: '全部', title: '不限时间范围' },
      { id: 'week', label: '周', title: '近 1 周 (7天内活跃)' },
      { id: 'month', label: '月', title: '近 1 月 (30天内活跃)' },
      { id: 'quarter', label: '季', title: '近 1 季 (90天内活跃)' },
      { id: 'year', label: '年', title: '近 1 年 (365天内活跃)' }
    ];

    const timeGroup = leftWrap.createDiv({ cls: 'tw-jira-time-group' });
    const timeLabel = timeGroup.createSpan({ cls: 'tw-jira-time-label' });
    timeLabel.innerHTML = `${getIconPark('time', 12)} 时间:`;

    const timeSelect = timeGroup.createEl('select', {
      cls: 'tw-jira-time-select',
      title: '按活跃时间范围筛选任务'
    });
    for (const tr of timeRanges) {
      const opt = timeSelect.createEl('option', { text: tr.label, value: tr.id });
      opt.setAttribute('title', tr.title);
      if (this.activeTimeRange === tr.id) opt.selected = true;
    }
    timeSelect.onchange = () => this.setTimeRange(timeSelect.value);

    // Right Controls
    const rightWrap = consoleEl.createDiv({ cls: 'tw-jira-console-right' });

    // Last Sync Info
    const cacheInfo = this.jiraService ? this.jiraService.getCacheInfo() : null;
    const syncInfoEl = rightWrap.createDiv({ cls: 'tw-jira-sync-info' });
    const isErrorOrStale = !!this.syncWarning || cacheInfo?.isExpired;
    syncInfoEl.innerHTML = `
      <span class="tw-sync-dot ${isErrorOrStale ? 'stale' : 'fresh'}"></span>
      <span class="tw-sync-text">${this.syncWarning ? '同步受阻 (缓存中)' : '上次同步: ' + (cacheInfo?.timeStr || '刚刚')}</span>
    `;
    if (this.syncWarning) {
      syncInfoEl.setAttribute('title', `同步失败原因: ${this.syncWarning}`);
    }

    // Refresh Button
    const btnRefresh = rightWrap.createEl('button', {
      cls: 'tw-jira-icon-btn',
      title: '强制刷新 Jira 任务'
    });
    btnRefresh.innerHTML = `${getIconPark('refresh', 13)} <span>刷新</span>`;
    btnRefresh.onclick = () => {
      btnRefresh.classList.add('spinning');
      this.loadIssues(true).finally(() => {
        setTimeout(() => btnRefresh.classList.remove('spinning'), 400);
      });
    };

    // View Switcher (Kanban vs Table)
    const viewSwitch = rightWrap.createDiv({ cls: 'tw-jira-view-switcher' });
    const btnKanban = viewSwitch.createEl('button', {
      cls: `tw-view-btn ${this.currentView === 'kanban' ? 'active' : ''}`,
      title: '看板模式'
    });
    btnKanban.innerHTML = `${getIconPark('dashboard', 13)} <span>看板</span>`;
    btnKanban.onclick = () => {
      if (this.currentView !== 'kanban') {
        this.saveViewMode('kanban');
        this.render();
      }
    };

    const btnTable = viewSwitch.createEl('button', {
      cls: `tw-view-btn ${this.currentView === 'table' ? 'active' : ''}`,
      title: '列表模式'
    });
    btnTable.innerHTML = `${getIconPark('file-text', 13)} <span>列表</span>`;
    btnTable.onclick = () => {
      if (this.currentView !== 'table') {
        this.saveViewMode('table');
        this.render();
      }
    };

    // Open Web Jira Button
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    if (config?.baseUrl) {
      const btnWeb = rightWrap.createEl('button', {
        cls: 'tw-jira-icon-btn secondary',
        title: '在浏览器中打开 Jira'
      });
      btnWeb.innerHTML = `${getIconPark('external', 12)} <span>Jira 网页</span>`;
      btnWeb.onclick = () => {
        window.open(config.baseUrl, '_blank');
      };
    }
  }

  renderMetricsBar(parentEl) {
    if (!parentEl) return;
    // 幂等渲染：搜索/筛选/流转等局部刷新会高频调用本方法，
    // 若不清理旧节点，每次按键都会 append 一整行统计卡片，把页面纵向撑爆
    parentEl.querySelectorAll(':scope > .tw-jira-metrics-bar').forEach(el => el.remove());
    const metricsEl = parentEl.createDiv({ cls: 'tw-jira-metrics-bar' });
    // 局部刷新时 createDiv 会追加到容器末尾，需重新插回看板之前（工具栏之下）
    if (this.stageContainer && this.stageContainer.parentElement === parentEl) {
      parentEl.insertBefore(metricsEl, this.stageContainer);
    }
    const groups = this.getGroupedIssues();
    const total = this.filteredIssues.length;

    metricsEl.innerHTML = `
      <div class="tw-jira-metric-chip total">
        <span class="tw-metric-num">${total}</span>
        <span class="tw-metric-label">当前总数</span>
      </div>
      <div class="tw-jira-metric-chip todo">
        <span class="tw-metric-num">${groups.todo.length}</span>
        <span class="tw-metric-label">待办事项</span>
      </div>
      <div class="tw-jira-metric-chip inprogress">
        <span class="tw-metric-num">${groups.inprogress.length}</span>
        <span class="tw-metric-label">处理中</span>
      </div>
      <div class="tw-jira-metric-chip review">
        <span class="tw-metric-num">${groups.review.length}</span>
        <span class="tw-metric-label">评审 / 验证</span>
      </div>
      <div class="tw-jira-metric-chip done">
        <span class="tw-metric-num">${groups.done.length}</span>
        <span class="tw-metric-label">已完成</span>
      </div>
    `;
  }

  renderStage() {
    if (!this.stageContainer) return;
    this.stageContainer.empty();

    if (this.error && this.issues.length === 0) {
      this.renderError(this.stageContainer);
      return;
    }

    if (this.currentView === 'kanban') {
      this.renderKanbanView(this.stageContainer);
    } else {
      this.renderTableView(this.stageContainer);
    }
  }

  renderKanbanView(parentEl) {
    const kanbanEl = parentEl.createDiv({ cls: 'tw-jira-kanban-board' });
    const groups = this.getGroupedIssues();

    const columns = [
      { key: 'todo', title: '待办事项 (To Do)', color: '#6B7280', items: groups.todo },
      { key: 'inprogress', title: '处理中 (In Progress)', color: '#3B82F6', items: groups.inprogress },
      { key: 'review', title: '评审 / 测试 (Review)', color: '#F59E0B', items: groups.review },
      { key: 'done', title: '已完成 (Done)', color: '#10B981', items: groups.done }
    ];

    for (const col of columns) {
      // 评审/测试列无工单时自动隐藏（部分 Jira 工作流无独立评审态），有工单时自动回归
      if (col.key === 'review' && col.items.length === 0) continue;
      const colEl = kanbanEl.createDiv({ cls: `tw-kanban-column tw-col-${col.key}` });
      
      // Column Header
      const headEl = colEl.createDiv({ cls: 'tw-kanban-col-head' });
      headEl.innerHTML = `
        <div class="tw-col-title-wrap">
          <span class="tw-col-dot" style="background-color: ${col.color}"></span>
          <span class="tw-col-title">${escapeHtml(col.title)}</span>
        </div>
        <span class="tw-col-badge">${col.items.length}</span>
      `;

      // Cards container
      const cardsList = colEl.createDiv({ cls: 'tw-kanban-cards-list' });
      if (col.items.length === 0) {
        cardsList.createDiv({
          cls: 'tw-kanban-empty',
          text: '暂无此状态工单'
        });
      } else {
        for (const issue of col.items) {
          this.renderKanbanCard(cardsList, issue);
        }
      }
    }
  }

  renderKanbanCard(parentEl, issue) {
    const card = parentEl.createDiv({ cls: 'tw-kanban-card' });
    
    // Priority badge class (中/英双语字标 → 四档颜色)
    const pCls = resolveKanbanPriorityClass(issue.priority);

    // Component tags
    const compHtml = (issue.components || []).map(c => `<span class="tw-card-comp-tag">${escapeHtml(c)}</span>`).join('');

    card.innerHTML = `
      <div class="tw-kcard-header">
        <span class="tw-kcard-key">${escapeHtml(issue.key)}</span>
        <span class="tw-kcard-priority ${pCls}">${escapeHtml(issue.priority || 'Medium')}</span>
      </div>
      <div class="tw-kcard-summary" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.summary)}</div>
      ${compHtml ? `<div class="tw-kcard-comps">${compHtml}</div>` : ''}
      <div class="tw-kcard-footer">
        <div class="tw-kcard-assignee">
          <span class="tw-assignee-avatar">${escapeHtml((issue.assignee || '?').slice(0, 1))}</span>
          <span class="tw-assignee-name">${escapeHtml(issue.assignee || '未指派')}</span>
        </div>
        <span class="tw-kcard-time" title="更新时间">${escapeHtml(issue.updated || '')}</span>
      </div>
    `;

    card.onclick = () => {
      const sel = window.getSelection()?.toString();
      if (sel && sel.trim().length > 0) return;
      this.openInspector(issue);
    };
  }

  renderTableView(parentEl) {
    const tableWrap = parentEl.createDiv({ cls: 'tw-jira-table-wrap' });
    if (this.filteredIssues.length === 0) {
      tableWrap.createDiv({ cls: 'tw-jira-empty-hint', text: '未找到匹配的工单' });
      return;
    }

    const table = tableWrap.createEl('table', { cls: 'tw-jira-data-table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 110px;">编号 (Key)</th>
          <th>事项摘要 (Summary)</th>
          <th style="width: 120px;">״̬</th>
          <th style="width: 90px;">优先级</th>
          <th style="width: 110px;">经办人</th>
          <th style="width: 100px;">更新时间</th>
          <th style="width: 100px; text-align: right;">操作</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    for (const issue of this.filteredIssues) {
      const tr = tbody.createEl('tr', { cls: 'tw-jira-table-row' });
      
      const pCls = resolveKanbanPriorityClass(issue.priority);

      tr.innerHTML = `
        <td><span class="tw-table-key">${escapeHtml(issue.key)}</span></td>
        <td><span class="tw-table-summary" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.summary)}</span></td>
        <td><span class="tw-table-status-pill">${escapeHtml(issue.status)}</span></td>
        <td><span class="tw-kcard-priority ${pCls}">${escapeHtml(issue.priority || 'Medium')}</span></td>
        <td><span class="tw-table-assignee">${escapeHtml(issue.assignee || '未指派')}</span></td>
        <td><span class="tw-table-time">${escapeHtml(issue.updated || '')}</span></td>
        <td style="text-align: right;">
          <button class="tw-table-act-btn" title="查看详情与状态流转">详情</button>
        </td>
      `;

      tr.querySelector('.tw-table-act-btn').onclick = (e) => {
        e.stopPropagation();
        this.openInspector(issue);
      };
      tr.onclick = () => {
        const sel = window.getSelection()?.toString();
        if (sel && sel.trim().length > 0) return;
        this.openInspector(issue);
      };
    }
  }

  renderError(parentEl) {
    const errBox = parentEl.createDiv({ cls: 'tw-jira-error-box' });
    errBox.innerHTML = `
      <div class="tw-jira-err-icon">${getIconPark('alert', 28)}</div>
      <div class="tw-jira-err-title">Jira 任务加载异常</div>
      <div class="tw-jira-err-desc">${escapeHtml(this.error)}</div>
      <div class="tw-jira-err-actions">
        <button class="tw-btn-retry" id="btnJiraRetry">${getIconPark('refresh', 13)} 重新尝试</button>
        <button class="tw-btn-cfg" id="btnJiraOpenCfg">${getIconPark('setting-config', 13)} 检查配置</button>
      </div>
    `;

    const btnRetry = errBox.querySelector('#btnJiraRetry');
    if (btnRetry) btnRetry.onclick = () => this.loadIssues(true);
    const btnCfg = errBox.querySelector('#btnJiraOpenCfg');
    if (btnCfg && this.onOpenSettings) btnCfg.onclick = () => this.onOpenSettings();
  }

  updateLoadingState() {
    // If loading without cached issues, show clean spinner
    if (this.isLoading && (!this.issues || this.issues.length === 0) && this.stageContainer) {
      this.stageContainer.innerHTML = `
        <div class="tw-jira-loading-wrap">
          <div class="tw-loading-spin"></div>
          <div class="tw-loading-text">正在同步 Jira 任务列表...</div>
        </div>
      `;
    }
  }

  // ==========================================
  // Issue Inspector Drawer (Side Drawer)
  // ==========================================
  openInspector(issue) {
    this.selectedIssue = issue;
    if (!this.inspectorContainer) return;
    this.inspectorContainer.empty();
    this.inspectorContainer.style.display = 'flex';

    const drawer = this.inspectorContainer.createDiv({ cls: 'tw-jira-inspector-drawer' });

    // 1. Header
    const head = drawer.createDiv({ cls: 'tw-inspector-header' });
    head.innerHTML = `
      <div class="tw-ins-head-left">
        <span class="tw-ins-key">${escapeHtml(issue.key)}</span>
        <span class="tw-ins-status-badge">${escapeHtml(issue.status)}</span>
      </div>
      <button class="tw-ins-close-btn" title="关闭 (Esc)">${getIconPark('close', 14)}</button>
    `;
    head.querySelector('.tw-ins-close-btn').onclick = () => this.closeInspector();

    // 2. Content Body
    const body = drawer.createDiv({ cls: 'tw-inspector-body' });

    // Summary
    body.createEl('h2', { cls: 'tw-ins-summary', text: issue.summary });

    // Transitions Section (Status Flow Buttons)
    const transSec = body.createDiv({ cls: 'tw-ins-transitions-sec' });
    transSec.innerHTML = `
      <div class="tw-ins-sec-title">
        <span>${getIconPark('refresh', 12)}</span>
        <span>可视化状态流转 (端内快速操作无需跳转网页)</span>
      </div>
      <div class="tw-transitions-btn-group" id="twTransitionBtnGroup">
        <span class="tw-trans-loading">正在检测可用工作流...</span>
      </div>
      <div class="tw-trans-inline-form-container" id="twTransInlineFormContainer" style="display:none;"></div>
      <div class="tw-trans-feedback" id="twTransFeedback" style="display:none;"></div>
    `;

    // Load available transitions
    this.loadAndRenderTransitions(
      issue,
      transSec.querySelector('#twTransitionBtnGroup'),
      transSec.querySelector('#twTransInlineFormContainer'),
      transSec.querySelector('#twTransFeedback')
    );

    // Meta Grid
    const metaGrid = body.createDiv({ cls: 'tw-ins-meta-grid' });
    metaGrid.innerHTML = `
      <div class="tw-meta-item">
        <span class="tw-meta-label">经办人</span>
        <span class="tw-meta-val">${escapeHtml(issue.assignee || '未指派')}</span>
      </div>
      <div class="tw-meta-item">
        <span class="tw-meta-label">报告人</span>
        <span class="tw-meta-val">${escapeHtml(issue.reporter || 'ϵͳ')}</span>
      </div>
      <div class="tw-meta-item">
        <span class="tw-meta-label">优先级</span>
        <span class="tw-meta-val">${escapeHtml(issue.priority || 'Medium')}</span>
      </div>
      <div class="tw-meta-item">
        <span class="tw-meta-label">更新时间</span>
        <span class="tw-meta-val">${escapeHtml(issue.updated || 'δ֪')}</span>
      </div>
      ${issue.created ? `
        <div class="tw-meta-item">
          <span class="tw-meta-label">创建时间</span>
          <span class="tw-meta-val">${escapeHtml(issue.created)}</span>
        </div>
      ` : ''}
      ${(issue.components && issue.components.length > 0) ? `
        <div class="tw-meta-item full">
          <span class="tw-meta-label">模块组件</span>
          <span class="tw-meta-val">${escapeHtml(issue.components.join(', '))}</span>
        </div>
      ` : ''}
    `;

    // Description Section
    const descSec = body.createDiv({ cls: 'tw-ins-desc-sec' });
    descSec.createDiv({ cls: 'tw-ins-sec-title', text: '工单详细描述 (Description)' });
    const descBox = descSec.createDiv({ cls: 'tw-ins-desc-box' });
    if (issue.description && issue.description.trim()) {
      descBox.innerHTML = escapeHtml(issue.description).replace(/\n/g, '<br>');
    } else {
      descBox.innerHTML = '<span class="tw-ins-desc-empty">暂无详细描述说明</span>';
    }

    // Activity Log & Comments Section
    const activitySec = body.createDiv({ cls: 'tw-ins-activity-sec' });
    activitySec.innerHTML = `
      <div class="tw-ins-sec-header">
        <div class="tw-ins-sec-title">
          <span>${getIconPark('topic', 13)}</span>
          <span>活动日志与注释</span>
          <span class="tw-ins-comments-count" id="twInsCommentsCount"></span>
        </div>
        <button class="tw-ins-refresh-comments-btn" id="twBtnRefreshComments" title="刷新注释列表">
          ${getIconPark('refresh', 12)}
        </button>
      </div>

      <!-- Add comment box -->
      <div class="tw-ins-add-comment-box">
        <textarea class="tw-ins-comment-input" id="twInsCommentInput" placeholder="添加注释 (支持多行排查记录，Ctrl+Enter 快捷提交)..." rows="3"></textarea>
        <div class="tw-ins-comment-actions">
          <span class="tw-ins-comment-tip">Ctrl+Enter 快速提交至 Jira</span>
          <button class="tw-ins-submit-comment-btn" id="twBtnSubmitComment" disabled>
            ${getIconPark('send', 12)} <span>提交注释</span>
          </button>
        </div>
      </div>

      <!-- Comments list -->
      <div class="tw-ins-comments-list" id="twInsCommentsList">
        <div class="tw-ins-comments-loading">
          <div class="tw-loading-spin"></div>
          <span>正在加载活动日志与注释...</span>
        </div>
      </div>
    `;

    const commentsListEl = activitySec.querySelector('#twInsCommentsList');
    const commentsCountEl = activitySec.querySelector('#twInsCommentsCount');
    const commentInput = activitySec.querySelector('#twInsCommentInput');
    const btnSubmitComment = activitySec.querySelector('#twBtnSubmitComment');
    const btnRefreshComments = activitySec.querySelector('#twBtnRefreshComments');

    if (commentInput && btnSubmitComment) {
      commentInput.addEventListener('input', () => {
        btnSubmitComment.disabled = !commentInput.value.trim();
      });

      commentInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (!btnSubmitComment.disabled) {
            btnSubmitComment.click();
          }
        }
      });

      btnSubmitComment.onclick = async () => {
        const text = commentInput.value.trim();
        if (!text) return;
        btnSubmitComment.disabled = true;
        const prevHtml = btnSubmitComment.innerHTML;
        btnSubmitComment.innerHTML = `<span class="tw-loading-spin"></span> <span>提交中...</span>`;
        try {
          const res = await this.jiraService.addIssueComment(issue.key, text);
          if (res && res.success) {
            commentInput.value = '';
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 注释已成功提交至 Jira', 3000);
            await this.loadAndRenderComments(issue, commentsListEl, commentsCountEl);
          } else {
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls(`❌ 提交注释失败: ${res?.message || '未知错误'}`, 5000);
          }
        } catch (err) {
          const app = this.app || (typeof window !== 'undefined' ? window.app : null);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
          new NoticeCls(`❌ 提交注释异常: ${err.message}`, 5000);
        } finally {
          btnSubmitComment.innerHTML = prevHtml;
          btnSubmitComment.disabled = !commentInput.value.trim();
        }
      };
    }

    if (btnRefreshComments) {
      btnRefreshComments.onclick = () => {
        this.loadAndRenderComments(issue, commentsListEl, commentsCountEl);
      };
    }

    this.loadAndRenderComments(issue, commentsListEl, commentsCountEl);

    // 3. Actions Footer
    const footer = drawer.createDiv({ cls: 'tw-inspector-footer' });

    // Copy Markdown Link Button
    const btnCopy = footer.createEl('button', { cls: 'tw-ins-action-btn primary' });
    btnCopy.innerHTML = `${getIconPark('copy', 12)} <span>复制 Markdown 引用</span>`;
    btnCopy.onclick = () => {
      const mdLink = `[${issue.key}](${issue.url}): ${issue.summary}`;
      navigator.clipboard.writeText(mdLink);
      btnCopy.classList.add('copied');
      btnCopy.querySelector('span').textContent = '已复制引用！';
      setTimeout(() => {
        btnCopy.classList.remove('copied');
        btnCopy.querySelector('span').textContent = '复制 Markdown 引用';
      }, 1500);
    };

    // Add to 00-Inbox/03-Quick-Note Button
    const btnQuickNote = footer.createEl('button', {
      cls: 'tw-ins-action-btn quicknote',
      title: '将此问题与排查上下文存入 00-Inbox/03-Quick-Note 进行复杂排查记录'
    });
    btnQuickNote.innerHTML = `${getIconPark('file-text', 12)} <span>存入 Quick-Note</span>`;
    btnQuickNote.onclick = async () => {
      await this.exportIssueToQuickNote(issue, btnQuickNote);
    };

    // Ask Agent Hub Button
    const btnAgent = footer.createEl('button', { cls: 'tw-ins-action-btn secondary' });
    btnAgent.innerHTML = `${getIconPark('robot', 13)} <span>向 Agent 提问此工单</span>`;
    btnAgent.onclick = () => {
      if (this.onAskAgent) {
        this.onAskAgent(issue);
        this.closeInspector();
      }
    };

    // Open Web Jira Button
    if (issue.url) {
      const btnExt = footer.createEl('button', { cls: 'tw-ins-action-btn tertiary' });
      btnExt.innerHTML = `${getIconPark('external', 12)} <span>网页打开</span>`;
      btnExt.onclick = () => window.open(issue.url, '_blank');
    }

    // Backdrop click
    this.inspectorContainer.onclick = (e) => {
      if (e.target === this.inspectorContainer) this.closeInspector();
    };
  }

  async loadAndRenderTransitions(issue, containerEl, formContainerEl, feedbackEl) {
    if (!containerEl || !this.jiraService) return;

    let transitions = [];
    try {
      transitions = await this.jiraService.getTransitions(issue.key);
    } catch (e) {
      console.warn('[JiraPlatformView] Failed to fetch transitions:', e);
    }

    // If API returned available transitions, render them
    if (transitions && transitions.length > 0) {
      containerEl.innerHTML = '';
      for (const t of transitions) {
        const hasReq = Array.isArray(t.requiredFields) && t.requiredFields.length > 0;
        const btn = containerEl.createEl('button', {
          cls: `tw-trans-btn${t.hasScreen || hasReq || t.isResolve ? ' has-screen' : ''}`,
          text: `→ ${t.name}`
        });

        if (hasReq) {
          btn.title = `包含必填项: ${t.requiredFields.map(f => f.name).join(', ')}`;
        } else if (t.isResolve) {
          btn.title = '端内流转并设置解决结果';
        } else if (t.hasScreen) {
          btn.title = '此流转包含专属字段设置';
        }

        btn.onclick = () => {
          // If the form is already open for this transition, clicking again closes it
          if (formContainerEl && formContainerEl.style.display !== 'none' && formContainerEl.dataset.currentTransId === String(t.id)) {
            formContainerEl.style.display = 'none';
            formContainerEl.innerHTML = '';
            btn.classList.remove('active-trans');
            return;
          }

          // If transition needs inputs (isResolve, hasScreen, or has fields)
          if (t.isResolve || t.hasScreen || (t.fieldList && t.fieldList.length > 0)) {
            this.renderInlineTransitionForm(issue, t, btn, formContainerEl, feedbackEl);
          } else {
            this.handleDoTransition(issue, t, btn, formContainerEl, feedbackEl);
          }
        };
      }
      return;
    }

    // Fallback standard workflow buttons if server doesn't support transition enumeration
    containerEl.innerHTML = `
      <button class="tw-trans-btn" data-target="To Do">← 待办 (To Do)</button>
      <button class="tw-trans-btn" data-target="In Progress">→ 进行中 (In Progress)</button>
      <button class="tw-trans-btn" data-target="In Review">→ 评审 (Review)</button>
      <button class="tw-trans-btn" data-target="Done">✓ 完成 (Done)</button>
    `;

    containerEl.querySelectorAll('.tw-trans-btn').forEach(btn => {
      const target = btn.getAttribute('data-target');
      if (target.toLowerCase() === issue.status.toLowerCase()) {
        btn.classList.add('current');
        btn.disabled = true;
      }
      btn.onclick = () => {
        const isDone = target === 'Done';
        const tObj = { id: target, name: target, isResolve: isDone };
        if (isDone) {
          this.renderInlineTransitionForm(issue, tObj, btn, formContainerEl, feedbackEl);
        } else {
          this.handleDoTransition(issue, tObj, btn, formContainerEl, feedbackEl);
        }
      };
    });
  }

  renderInlineTransitionForm(issue, transition, btnEl, formContainerEl, feedbackEl, prefillError = '') {
    if (!formContainerEl) return;

    const transitionId = typeof transition === 'object' ? transition.id : transition;
    const targetName = typeof transition === 'object' ? transition.name : transition;
    const fields = transition?.fields || {};
    const fieldList = transition?.fieldList || [];
    const isResolve = transition?.isResolve || /解决|完成|关闭|resolve|done|close/i.test(targetName);

    // Track active transition ID
    formContainerEl.dataset.currentTransId = String(transitionId);

    // Highlight active button
    const group = btnEl?.parentElement;
    if (group) {
      group.querySelectorAll('.tw-trans-btn').forEach(b => b.classList.remove('active-trans'));
    }
    if (btnEl) btnEl.classList.add('active-trans');

    // Hide fallback guidance banner if open
    if (feedbackEl) {
      feedbackEl.style.display = 'none';
    }

    formContainerEl.style.display = 'block';

    const renderedKeys = new Set(['comment']);

    // 1. Resolution field (if transition is to resolve or resolution is in fields)
    const showResolution = isResolve || Boolean(fields.resolution);
    let resolutionHtml = '';
    if (showResolution) {
      renderedKeys.add('resolution');
      let resolutionOptions = [];
      if (fields.resolution?.allowedValues && fields.resolution.allowedValues.length > 0) {
        resolutionOptions = fields.resolution.allowedValues.map(v => ({
          id: v.id,
          name: v.name || v.value,
          label: v.name || v.value
        }));
      } else {
        resolutionOptions = [
          { id: '1', name: 'Fixed', label: 'Fixed (已修复 / 已解决)' },
          { id: '2', name: 'Done', label: 'Done (已完成)' },
          { id: '3', name: 'Won\'t Fix', label: 'Won\'t Fix (不予修复)' },
          { id: '4', name: 'Cannot Reproduce', label: 'Cannot Reproduce (无法重现)' },
          { id: '5', name: 'Duplicate', label: 'Duplicate (重复工单)' },
          { id: '6', name: 'Incomplete', label: 'Incomplete (信息不全)' }
        ];
      }

      resolutionHtml = `
        <div class="tw-trans-form-item" data-item-key="resolution">
          <label class="tw-trans-form-label">解决结果 (Resolution) <span class="tw-req-star">*</span></label>
          <select class="tw-trans-form-select" id="twSelectResolution" data-field-key="resolution" data-field-type="resolution" required>
            ${resolutionOptions.map((opt, i) => `
              <option value="${escapeAttr(opt.name)}" data-id="${escapeAttr(opt.id || '')}" ${i === 0 ? 'selected' : ''}>
                ${escapeHtml(opt.label)}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }

    // 2. Dynamic fields from fieldList
    let dynamicFieldsHtml = '';
    for (const f of fieldList) {
      if (renderedKeys.has(f.key)) continue;
      renderedKeys.add(f.key);

      const fKey = f.key;
      const fName = f.name || fKey;
      const isReq = Boolean(f.required);
      const allowed = Array.isArray(f.allowedValues) ? f.allowedValues : [];
      const fType = f.type || 'string';

      let inputHtml = '';
      if (allowed.length > 0) {
        // Select dropdown
        inputHtml = `
          <select class="tw-trans-form-select" data-field-key="${escapeAttr(fKey)}" data-field-type="${escapeAttr(fType)}" ${isReq ? 'required' : ''}>
            <option value="">${isReq ? `-- 请选择 ${escapeHtml(fName)} (必填) --` : `-- 请选择 ${escapeHtml(fName)}（可选）--`}</option>
            ${allowed.map(v => {
              const optVal = v.id || v.value || v.name;
              const optId = v.id || '';
              const optLabel = v.name || v.value || v.id;
              return `<option value="${escapeAttr(optVal)}" data-id="${escapeAttr(optId)}" data-value="${escapeAttr(v.value || v.name || '')}">${escapeHtml(optLabel)}</option>`;
            }).join('')}
          </select>
        `;
      } else if (fType === 'date' || fType === 'datetime') {
        const todayStr = isReq ? new Date().toISOString().slice(0, 10) : '';
        inputHtml = `
          <input type="date" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="${escapeAttr(fType)}" value="${todayStr}" ${isReq ? 'required' : ''}>
        `;
      } else if (fType === 'number') {
        inputHtml = `
          <input type="number" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="number" placeholder="输入数字..." ${isReq ? 'required' : ''}>
        `;
      } else if (fType === 'user') {
        inputHtml = `
          <input type="text" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="user" placeholder="留空保持原值..." ${isReq ? 'required' : ''}>
        `;
      } else {
        if (/描述|说明|原因|detail|reason/i.test(fName)) {
          inputHtml = `
            <textarea class="tw-trans-form-textarea" data-field-key="${escapeAttr(fKey)}" data-field-type="string" rows="2" placeholder="输入 ${escapeHtml(fName)}..." ${isReq ? 'required' : ''}></textarea>
          `;
        } else {
          inputHtml = `
            <input type="text" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="string" placeholder="输入 ${escapeHtml(fName)}..." ${isReq ? 'required' : ''}>
          `;
        }
      }

      dynamicFieldsHtml += `
        <div class="tw-trans-form-item" data-item-key="${escapeAttr(fKey)}">
          <label class="tw-trans-form-label">
            <span>${escapeHtml(fName)}</span>
            ${isReq ? '<span class="tw-req-star">*</span>' : '<span style="color:var(--text-muted);font-weight:normal;font-size:10.5px;">(可选)</span>'}
          </label>
          ${inputHtml}
        </div>
      `;
    }

    // 3. Fallback: if prefillError mentions a specific field (e.g. customfield_10839) that was not in fieldList
    let extraMissingFieldHtml = '';
    const matchCf = prefillError.match(/(customfield_\d+|[a-zA-Z0-9_-]+)(?::|\s+is required|\s+为必填)/i);
    if (matchCf && matchCf[1]) {
      const missingKey = matchCf[1];
      if (!renderedKeys.has(missingKey)) {
        renderedKeys.add(missingKey);
        extraMissingFieldHtml = `
          <div class="tw-trans-form-item has-error" data-item-key="${escapeAttr(missingKey)}">
            <label class="tw-trans-form-label">
              <span>必填字段: <strong>${escapeHtml(missingKey)}</strong></span>
              <span class="tw-req-star">*</span>
            </label>
            <input type="text" class="tw-trans-form-input has-error" data-field-key="${escapeAttr(missingKey)}" data-field-type="string" placeholder="请输入 ${escapeHtml(missingKey)} 的内容或选项..." required>
          </div>
        `;
      }
    }

    formContainerEl.innerHTML = `
      <div class="tw-trans-inline-form">
        <div class="tw-trans-form-header">
          <div class="tw-trans-form-title">
            <span class="tw-trans-form-icon">⚡</span>
            <span>端内流转：<strong>${escapeHtml(issue.key)}</strong> → <span class="tw-trans-target-badge">${escapeHtml(targetName)}</span></span>
          </div>
          <button class="tw-trans-form-close" id="twBtnCloseTransForm" title="取消并关闭">✕</button>
        </div>

        <div class="tw-trans-form-body">
          ${prefillError ? `
            <div class="tw-trans-form-error" style="display:block;">
              <strong>⚠️ Jira 校验提示:</strong> ${escapeHtml(prefillError.replace(/^Jira 状态流转失败 \(HTTP \d+\):\s*/, ''))}
            </div>
          ` : ''}

          ${resolutionHtml}
          ${dynamicFieldsHtml}
          ${extraMissingFieldHtml}

          <div class="tw-trans-form-item">
            <label class="tw-trans-form-label">流转说明 / 备注 (Comment)</label>
            <textarea class="tw-trans-form-textarea" id="twTextareaComment" rows="2" placeholder="可选：填写本次处理说明、验证结论或备注..."></textarea>
          </div>

          <div class="tw-trans-form-error" id="twFormError" style="display: none;"></div>
        </div>

        <div class="tw-trans-form-footer">
          <button class="tw-trans-submit-btn" id="twBtnSubmitTrans">
            🚀 确认变更为「${escapeHtml(targetName)}」
          </button>
          <button class="tw-trans-cancel-btn" id="twBtnCancelTrans">
            取消
          </button>
        </div>
      </div>
    `;

    const closeForm = () => {
      formContainerEl.style.display = 'none';
      formContainerEl.innerHTML = '';
      delete formContainerEl.dataset.currentTransId;
      if (btnEl) btnEl.classList.remove('active-trans');
    };

    formContainerEl.querySelector('#twBtnCloseTransForm').onclick = closeForm;
    formContainerEl.querySelector('#twBtnCancelTrans').onclick = closeForm;

    const submitBtn = formContainerEl.querySelector('#twBtnSubmitTrans');
    submitBtn.onclick = async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = '正在提交 Jira 流转...';
      const errorEl = formContainerEl.querySelector('#twFormError');
      if (errorEl) errorEl.style.display = 'none';

      const customFields = {};
      const formItems = formContainerEl.querySelectorAll('[data-field-key]');
      let missingRequired = false;

      for (const el of formItems) {
        const key = el.dataset.fieldKey;
        const type = el.dataset.fieldType;
        const val = el.value?.trim();

        // Validate required field
        if (el.hasAttribute('required') && !val) {
          missingRequired = true;
          el.classList.add('has-error');
          continue;
        } else {
          el.classList.remove('has-error');
        }

        if (!val) continue;

        if (key === 'resolution') {
          const opt = el.options ? el.options[el.selectedIndex] : null;
          const id = opt?.dataset?.id;
          customFields.resolution = id ? { id } : { name: val };
        } else if (type === 'option') {
          const opt = el.options ? el.options[el.selectedIndex] : null;
          const id = opt?.dataset?.id;
          const valueName = opt?.dataset?.value || val;
          // In Jira Server, select custom fields accept { id } or { value: val }
          customFields[key] = id ? { id } : { value: valueName };
        } else if (type === 'array') {
          const opt = el.options ? el.options[el.selectedIndex] : null;
          const id = opt?.dataset?.id;
          const valueName = opt?.dataset?.value || val;
          if (key === 'fixVersions') {
            customFields[key] = id ? [{ id }] : [{ name: val }];
          } else {
            customFields[key] = id ? [{ id }] : [{ value: valueName }];
          }
        } else if (type === 'number') {
          customFields[key] = Number(val);
        } else if (type === 'user') {
          customFields[key] = { name: val };
        } else if (type === 'date') {
          customFields[key] = val.replace(/\//g, '-');
        } else if (type === 'datetime') {
          try {
            const d = new Date(val);
            customFields[key] = !isNaN(d.getTime()) ? d.toISOString() : val;
          } catch (_) {
            customFields[key] = val;
          }
        } else {
          customFields[key] = val;
        }
      }

      if (missingRequired) {
        submitBtn.disabled = false;
        submitBtn.textContent = `🚀 确认变更为「${escapeHtml(targetName)}」`;
        if (errorEl) {
          errorEl.style.display = 'block';
          errorEl.innerHTML = `<strong>请填写或选择所有标有 * 号的必填项！</strong>`;
        }
        return;
      }

      const commentInput = formContainerEl.querySelector('#twTextareaComment');
      const commentText = commentInput ? commentInput.value.trim() : '';

      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || window.Notice);

      try {
        await this.jiraService.doTransition(issue.key, transitionId, targetName, customFields, commentText);
        issue.status = targetName;
        issue.updated = '刚刚';
        this.renderStage();
        this.renderMetricsBar(this.containerEl.querySelector('.tw-jira-platform'));

        if (NoticeClass) {
          new NoticeClass(`✓ ${issue.key} 状态已成功变更为「${targetName}」`, 3500);
        }
        closeForm();
        setTimeout(() => {
          this.openInspector(issue);
        }, 500);
      } catch (err) {
        console.error('[Jira] 端内流转提交异常:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = `🚀 确认变更为「${escapeHtml(targetName)}」`;

        if (errorEl) {
          errorEl.style.display = 'block';
          const cleanMsg = err.detailMsg || err.message || '流转失败，请检查输入';
          errorEl.innerHTML = `
            <strong>流转未成功:</strong> ${escapeHtml(cleanMsg.replace(/^Jira 状态流转失败 \(HTTP \d+\):\s*/, ''))}
          `;
        }
      }
    };
  }

  async handleDoTransition(issue, transition, btnEl, formContainerEl, feedbackEl) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const oldText = btnEl.textContent;
    btnEl.textContent = '正在流转...';
    btnEl.disabled = true;

    const transitionId = typeof transition === 'object' ? transition.id : transition;
    const targetName = typeof transition === 'object' ? transition.name : transition;

    // Reset feedback banner if visible
    if (feedbackEl) {
      feedbackEl.innerHTML = '';
      feedbackEl.style.display = 'none';
    }

    const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || window.Notice);

    try {
      await this.jiraService.doTransition(issue.key, transitionId, targetName);
      issue.status = targetName;
      issue.updated = '刚刚';
      this.renderStage();
      this.renderMetricsBar(this.containerEl.querySelector('.tw-jira-platform'));
      btnEl.textContent = `✓ 已变更为 ${targetName}`;
      if (NoticeClass) {
        new NoticeClass(`✓ ${issue.key} 状态已流转为「${targetName}」`, 3000);
      }
      setTimeout(() => {
        this.openInspector(issue);
      }, 600);
    } catch (err) {
      console.error(`[Jira] 状态流转异常:`, err);
      btnEl.textContent = oldText;
      btnEl.disabled = false;

      const detailMsg = err.detailMsg || err.message || '流转失败';
      const isHttp400 = err.status === 400 || /HTTP 400/i.test(err.message);

      if (isHttp400 && formContainerEl) {
        // Automatically open the inline form so the user can fill in the missing required field directly in Obsidian!
        this.renderInlineTransitionForm(issue, transition, btnEl, formContainerEl, feedbackEl, detailMsg);
        if (NoticeClass) {
          new NoticeClass(`需要补充必填项：请直接在下方表单中选择并提交`, 5000);
        }
      } else {
        if (NoticeClass) {
          new NoticeClass(`流转失败: ${detailMsg}`, 7000);
        }
        if (feedbackEl) {
          feedbackEl.style.display = 'block';
          feedbackEl.innerHTML = `
            <div class="tw-trans-guidance-card">
              <div class="tw-trans-guidance-header">
                <span class="tw-trans-guidance-badge">流转受阻</span>
                <span class="tw-trans-guidance-target">目标状态: <strong>${escapeHtml(targetName)}</strong></span>
              </div>
              <div class="tw-trans-guidance-msg">${escapeHtml(detailMsg)}</div>
            </div>
          `;
        }
      }
    } finally {
      this.isTransitioning = false;
      if (btnEl && !btnEl.textContent.startsWith('✓')) {
        btnEl.disabled = false;
        btnEl.textContent = oldText;
      }
    }
  }

  async loadAndRenderComments(issue, listEl, countEl) {
    if (!listEl || !this.jiraService) return;
    listEl.innerHTML = `
      <div class="tw-ins-comments-loading">
        <div class="tw-loading-spin"></div>
        <span>正在加载活动日志与注释...</span>
      </div>
    `;

    try {
      const comments = await this.jiraService.getIssueComments(issue.key);
      if (countEl) {
        countEl.textContent = `(${comments.length})`;
      }

      if (!comments || comments.length === 0) {
        listEl.innerHTML = `
          <div class="tw-ins-comments-empty">
            <span class="tw-empty-icon">${getIconPark('info-circle', 13)}</span>
            <span>暂无注释记录，您可在上方输入框添加第一条处理注释</span>
          </div>
        `;
        return;
      }

      let html = '';
      for (const c of comments) {
        const initial = (c.author || '用').charAt(0).toUpperCase();
        const avatarHtml = c.authorAvatar
          ? `<img src="${c.authorAvatar}" class="tw-ins-comment-avatar" alt="${escapeAttr(c.author)}" />`
          : `<span class="tw-ins-comment-avatar text">${escapeHtml(initial)}</span>`;

        html += `
          <div class="tw-ins-comment-card" data-comment-id="${escapeAttr(c.id)}">
            <div class="tw-ins-comment-head">
              ${avatarHtml}
              <div class="tw-ins-comment-meta">
                <span class="tw-ins-comment-author">${escapeHtml(c.author)}</span>
                <span class="tw-ins-comment-action">添加了评论</span>
                <span class="tw-ins-comment-dot">·</span>
                <span class="tw-ins-comment-time">${escapeHtml(c.createdFormatted || c.created)}</span>
                ${c.isEdited ? '<span class="tw-ins-comment-edited">已编辑</span>' : ''}
              </div>
            </div>
            <div class="tw-ins-comment-body">${escapeHtml(c.body).replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }
      listEl.innerHTML = html;
    } catch (err) {
      console.warn('[JiraPlatformView] Failed to load comments:', err);
      listEl.innerHTML = `
        <div class="tw-ins-comments-error">
          <span>加载注释失败: ${escapeHtml(err.message)}</span>
        </div>
      `;
    }
  }

  async exportIssueToQuickNote(issue, btnEl = null) {
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class { constructor(m) { console.log(m); } });

    if (!app || !app.vault) {
      new NoticeCls('无法访问 Obsidian Vault，无法执行存入操作');
      return;
    }

    const targetFolder = '00-Inbox/03-Quick-Note';
    try {
      if (!app.vault.getAbstractFileByPath(targetFolder)) {
        await app.vault.createFolder(targetFolder).catch(() => {});
      }
    } catch (e) {}

    // Fetch comments for richer note context
    let comments = [];
    try {
      if (this.jiraService && typeof this.jiraService.getIssueComments === 'function') {
        comments = await this.jiraService.getIssueComments(issue.key);
      }
    } catch (e) {
      console.warn('[JiraPlatformView] Failed to fetch comments for Quick-Note:', e);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const fullTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const safeSummary = (issue.summary || 'Jira工单')
      .replace(/[\\/:*?"<>|#^\[\]!]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const fileBasename = `${dateStr} [${issue.key}] ${safeSummary.slice(0, 36).trim()}`;
    const notePath = `${targetFolder}/${fileBasename}.md`;

    // Check if note already exists
    const existingFile = app.vault.getAbstractFileByPath(notePath);
    if (existingFile) {
      if (app.workspace && typeof app.workspace.openLinkText === 'function') {
        app.workspace.openLinkText(notePath, '', false);
      }
      new NoticeCls(`✓ 该工单笔记已存在，已为您在编辑器中打开: ${fileBasename}.md`, 4000);
      if (btnEl) {
        btnEl.classList.add('copied');
        const oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = `${getIconPark('check', 12)} <span>已在编辑器打开</span>`;
        setTimeout(() => {
          btnEl.classList.remove('copied');
          btnEl.innerHTML = oldHtml;
        }, 1800);
      }
      return;
    }

    // Build rich Markdown
    const lines = [];
    lines.push('---');
    lines.push(`title: "[${issue.key}] ${safeSummary}"`);
    lines.push(`date: ${fullTimeStr}`);
    lines.push(`type: jira-issue`);
    lines.push(`jira_key: "${issue.key}"`);
    lines.push(`jira_url: "${issue.url || ''}"`);
    lines.push(`status: "${issue.status || ''}"`);
    lines.push(`priority: "${issue.priority || 'Medium'}"`);
    lines.push(`assignee: "${issue.assignee || '未指派'}"`);
    lines.push(`reporter: "${issue.reporter || 'ϵͳ'}"`);
    lines.push('tags:');
    lines.push('  - jira');
    lines.push('  - quick-note');
    lines.push('  - troubleshooting');
    lines.push('---');
    lines.push('');
    lines.push(`# 🎯 [${issue.key}] ${issue.summary}`);
    lines.push('');
    lines.push('> [!INFO] 工单元数据卡片');
    lines.push(`> - **工单编号**: \`${issue.key}\``);
    lines.push(`> - **当前状态**: \`${issue.status || '未知'}\``);
    lines.push(`> - **优先级**: \`${issue.priority || 'Medium'}\``);
    lines.push(`> - **经办人**: ${issue.assignee || '未指派'}`);
    lines.push(`> - **报告人**: ${issue.reporter || '系统'}`);
    if (issue.components && issue.components.length > 0) {
      lines.push(`> - **模块组件**: ${issue.components.join(', ')}`);
    }
    if (issue.created) lines.push(`> - **创建时间**: ${issue.created}`);
    if (issue.updated) lines.push(`> - **更新时间**: ${issue.updated}`);
    if (issue.url) lines.push(`> - **Jira 链接**: [在浏览器中直达工单](${issue.url})`);
    lines.push('');
    lines.push('## 📋 工单详细描述 (Description)');
    lines.push('');
    lines.push(issue.description && issue.description.trim() ? issue.description.trim() : '*(暂无详细描述)*');
    lines.push('');

    // Comments & Activity Log
    lines.push('## 💬 活动日志与注释历史 (Comments)');
    lines.push('');
    if (comments && comments.length > 0) {
      for (const c of comments) {
        lines.push(`> [!NOTE] 👤 ${c.author} · ${c.createdFormatted || c.created}${c.isEdited ? ' *(已编辑)*' : ''}`);
        const bodyLines = (c.body || '').split('\n');
        for (const bl of bodyLines) {
          lines.push(`> ${bl}`);
        }
        lines.push('');
      }
    } else {
      lines.push('*(暂无历史注释记录)*\n');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 🛠️ 排查与处理过程记录 (Troubleshooting Log)');
    lines.push('');
    lines.push('> [!TIP] 复杂问题处理记录');
    lines.push('> 在此记录该复杂技术问题的排查思路、日志分析、抓包对比、测试复现条件与代码修复方案。');
    lines.push('');
    lines.push('### 1. 现象复现与抓包/日志分析');
    lines.push('- **测试条件/版本**: ');
    lines.push('- **复现概率**: ');
    lines.push('- **核心日志/抓包片段**: ');
    lines.push('```text');
    lines.push('// 粘贴关键 log 或堆栈信息');
    lines.push('```');
    lines.push('');
    lines.push('### 2. 根因分析 (Root Cause)');
    lines.push('- ');
    lines.push('');
    lines.push('### 3. 处理方案与代码修复 (Fix & Solution)');
    lines.push('- [ ] 临时规避方案 (Workaround)');
    lines.push('- [ ] 核心代码改动 (Code Changes)');
    lines.push('- [ ] 自动化测试 / 验证闭环结果');
    lines.push('');

    const noteContent = lines.join('\n');

    try {
      await app.vault.create(notePath, noteContent);
      new NoticeCls(`✓ 已成功存入 00-Inbox/03-Quick-Note/${fileBasename}.md 并已在编辑器中打开`, 4000);

      // Open in workspace
      if (app.workspace && typeof app.workspace.openLinkText === 'function') {
        app.workspace.openLinkText(notePath, '', false);
      }

      if (btnEl) {
        btnEl.classList.add('copied');
        const oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = `${getIconPark('check', 12)} <span>已存入笔记！</span>`;
        setTimeout(() => {
          btnEl.classList.remove('copied');
          btnEl.innerHTML = oldHtml;
        }, 1800);
      }
    } catch (err) {
      console.error('[JiraPlatformView] Failed to save Quick-Note:', err);
      new NoticeCls(`❌ 存入 Quick-Note 失败: ${err.message}`, 5000);
    }
  }

  closeInspector() {
    if (this.inspectorContainer) {
      this.inspectorContainer.style.display = 'none';
      this.inspectorContainer.empty();
    }
    this.selectedIssue = null;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { JiraPlatformView };
