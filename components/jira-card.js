/**
 * JiraCard: Native TabonKB Dashboard Card for Jira Issues
 * Follows strict lifecycle: mount, refresh, render, dispose
 */
const { getIconPark } = require('../ui/iconpark.js');

class JiraCard {
  /**
   * @param {Object} options
   * @param {import('../services/jira-service').JiraService} options.jiraService
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options) {
    this.service = options.jiraService;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.cardEl = null;
    this.isDisposed = false;
    this.isLoading = false;

    this.data = {
      issues: [],
      lastUpdated: 0,
      isStale: false,
      error: null
    };

    this.timerId = null;
    this.autoRefreshIntervalMs = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Mount card into parent DOM container
   * @param {HTMLElement} container
   */
  mount(container) {
    if (this.isDisposed) {
      this.isDisposed = false;
    }

    this.containerEl = container;
    this.cardEl = container.createDiv({ cls: 'tw-card tw-jira-card' });

    // Initial render & fetch
    this.render();
    this.refresh(false);

    // Setup periodic auto-refresh
    this._startTimer();
  }

  /**
   * Fetch latest issues and update card UI
   * @param {boolean} [force=false]
   */
  async refresh(force = false) {
    if (this.isDisposed || this.isLoading) return;

    this.isLoading = true;
    this._updateHeaderState();

    try {
      const result = await this.service.searchIssues(force);
      if (this.isDisposed) return;

      this.data = {
        issues: result.issues || [],
        lastUpdated: result.lastUpdated || Date.now(),
        isStale: !!result.isStale,
        error: result.error || null
      };
    } catch (err) {
      if (this.isDisposed) return;
      this.data.error = err.message || '获取 Jira 数据失败';
    } finally {
      if (!this.isDisposed) {
        this.isLoading = false;
        this.render();
      }
    }
  }

  /**
   * Render complete card DOM
   */
  render() {
    if (this.isDisposed || !this.cardEl) return;

    this.cardEl.empty();

    // 1. Header
    const header = this.cardEl.createDiv({ cls: 'tw-card-header tw-jira-header' });
    const countText = this.data.issues.length ? `(${this.data.issues.length})` : '';

    const titleLeft = header.createDiv({ cls: 'tw-card-header-left' });
    titleLeft.innerHTML = `
      <span class="tw-jira-title-icon">${getIconPark('target', 14)}</span>
      <span class="tw-jira-title-text">Jira 研发事项</span>
      <span class="tw-jira-count-pill">${countText}</span>
    `;

    const actionsRight = header.createDiv({ cls: 'tw-card-header-right' });
    const timeStr = this.data.lastUpdated ? formatRelativeClock(this.data.lastUpdated) : '';

    if (timeStr) {
      const timeSpan = actionsRight.createEl('span', { cls: 'tw-card-updated-time' });
      timeSpan.textContent = `更新于 ${timeStr}`;
    }

    const refreshBtn = actionsRight.createEl('button', {
      cls: `tw-card-refresh-btn ${this.isLoading ? 'spinning' : ''}`,
      title: '手动刷新 Jira 事项'
    });
    refreshBtn.innerHTML = getIconPark('refresh', 13);
    refreshBtn.onclick = (e) => {
      e.stopPropagation();
      this.refresh(true);
    };

    // 2. Body Container
    const body = this.cardEl.createDiv({ cls: 'tw-jira-body' });

    // Stale banner if data is from previous cache due to error
    if (this.data.isStale) {
      const staleBanner = body.createDiv({ cls: 'tw-card-stale-banner' });
      staleBanner.innerHTML = `
        <span class="tw-stale-icon">${getIconPark('alert', 13)}</span>
        <span class="tw-stale-text">${escapeHtml(this.data.error || '刷新失败')}，正在显示历史缓存 (${timeStr})</span>
        <button class="tw-stale-retry-btn">重试</button>
      `;
      const retryBtn = staleBanner.querySelector('.tw-stale-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
    }

    // State 1: Loading (no data yet)
    if (this.isLoading && (!this.data.issues || this.data.issues.length === 0)) {
      const loadingEl = body.createDiv({ cls: 'tw-card-loading-state' });
      loadingEl.innerHTML = `
        <div class="tw-card-spinner"></div>
        <span>正在加载 Jira 事项...</span>
      `;
      return;
    }

    // State 2: Error (no cached data)
    if (this.data.error && (!this.data.issues || this.data.issues.length === 0)) {
      const errorEl = body.createDiv({ cls: 'tw-card-error-state' });
      errorEl.innerHTML = `
        <div class="tw-card-state-icon">${getIconPark('alert', 22)}</div>
        <div class="tw-card-state-title">${escapeHtml(this.data.error)}</div>
        <div class="tw-card-state-actions">
          <button class="tw-chip tw-state-retry-btn">重试</button>
          ${this.onOpenSettings ? '<button class="tw-chip tw-state-settings-btn">检查设置</button>' : ''}
        </div>
      `;
      const retryBtn = errorEl.querySelector('.tw-state-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
      const settingsBtn = errorEl.querySelector('.tw-state-settings-btn');
      if (settingsBtn && this.onOpenSettings) settingsBtn.onclick = () => this.onOpenSettings();
      return;
    }

    // State 3: Empty
    if (!this.data.issues || this.data.issues.length === 0) {
      const emptyEl = body.createDiv({ cls: 'tw-card-empty-state' });
      emptyEl.innerHTML = `
        <div class="tw-card-state-icon" style="color:#10B981;">${getIconPark('check-circle', 22, { color: '#10B981' })}</div>
        <div class="tw-card-state-title">暂无待办或指派给您的未闭环事项</div>
        <div class="tw-card-state-sub">JQL: 未检索到匹配条目</div>
      `;
      return;
    }

    // State 4: Issue List
    const listWrap = body.createDiv({ cls: 'tw-jira-issue-list' });
    this.data.issues.forEach(issue => {
      const itemEl = listWrap.createDiv({ cls: 'tw-jira-issue-item' });

      // Left Column: Key & Summary
      const itemMain = itemEl.createDiv({ cls: 'tw-jira-item-main' });
      itemMain.innerHTML = `
        <div class="tw-jira-item-top">
          <a class="tw-jira-key" href="${escapeAttr(issue.url)}" target="_blank" rel="noopener noreferrer" title="在 Jira 中打开 ${escapeAttr(issue.key)}">
            ${escapeHtml(issue.key)}
            <span class="tw-jira-ext-icon">${getIconPark('external', 10)}</span>
          </a>
          <span class="tw-jira-summary" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.summary)}</span>
        </div>
      `;

      // Prevent card row click if clicked on key link
      const keyLink = itemMain.querySelector('.tw-jira-key');
      if (keyLink) {
        keyLink.onclick = (e) => {
          e.stopPropagation();
        };
      }

      // Right Column: Meta Badges (Status, Priority, Assignee, Updated)
      const itemMeta = itemEl.createDiv({ cls: 'tw-jira-item-meta' });
      const statusBadgeClass = resolveStatusClass(issue.status);
      const priorityClass = resolvePriorityClass(issue.priority);

      itemMeta.innerHTML = `
        <span class="tw-status-badge ${statusBadgeClass}">${escapeHtml(issue.status)}</span>
        <span class="tw-jira-priority-pill ${priorityClass}">${escapeHtml(issue.priority || 'Normal')}</span>
        <span class="tw-jira-assignee" title="经办人: ${escapeAttr(issue.assignee || '未指派')}">${getIconPark('user', 11)} <span>${escapeHtml(issue.assignee || '未指派')}</span></span>
        <span class="tw-jira-updated" title="更新时间: ${escapeAttr(issue.updated || '')}">${escapeHtml(issue.updated || '')}</span>
      `;

      // Clicking row opens Jira issue
      itemEl.onclick = () => {
        if (issue.url) {
          window.open(issue.url, '_blank', 'noopener,noreferrer');
        }
      };
    });
  }

  /**
   * Internal method to update header refresh button state without full re-render
   * @private
   */
  _updateHeaderState() {
    if (!this.cardEl) return;
    const refreshBtn = this.cardEl.querySelector('.tw-card-refresh-btn');
    if (refreshBtn) {
      refreshBtn.classList.toggle('spinning', this.isLoading);
    }
  }

  /**
   * Start auto refresh interval timer
   * @private
   */
  _startTimer() {
    this._stopTimer();
    const intervalFn = (typeof window !== 'undefined' ? window : global).setInterval || setInterval;
    this.timerId = intervalFn(() => {
      if (!this.isDisposed) {
        this.refresh(false);
      }
    }, this.autoRefreshIntervalMs);
  }

  /**
   * Stop auto refresh interval timer
   * @private
   */
  _stopTimer() {
    if (this.timerId !== null) {
      const clearFn = (typeof window !== 'undefined' ? window : global).clearInterval || clearInterval;
      clearFn(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Cleanly dispose card, cancel timers, prevent memory leaks
   */
  dispose() {
    this.isDisposed = true;
    this._stopTimer();
    if (this.cardEl) {
      if (typeof this.cardEl.remove === 'function') {
        this.cardEl.remove();
      }
      this.cardEl = null;
    }
    this.containerEl = null;
  }
}

function resolveStatusClass(statusName) {
  if (!statusName) return 'new';
  const s = statusName.toLowerCase();
  if (s.includes('progress') || s.includes('开发') || s.includes('排查') || s.includes('in progress')) return 'in-progress';
  if (s.includes('block') || s.includes('阻塞') || s.includes('reopen') || s.includes('reject')) return 'blocked';
  if (s.includes('done') || s.includes('resolve') || s.includes('闭环') || s.includes('解决') || s.includes('closed')) return 'resolved';
  return 'new';
}

function resolvePriorityClass(priority) {
  if (!priority) return 'medium';
  const p = priority.toLowerCase();
  if (p.includes('blocker') || p.includes('highest') || p.includes('urgent') || p.includes('p0')) return 'p-urgent';
  if (p.includes('high') || p.includes('p1')) return 'p-high';
  if (p.includes('low') || p.includes('lowest') || p.includes('p3')) return 'p-low';
  return 'p-medium';
}

function formatRelativeClock(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
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
  return String(str).replace(/"/g, '&quot;');
}

module.exports = { JiraCard };
