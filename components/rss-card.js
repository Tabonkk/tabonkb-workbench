/**
 * RssCard: Native TabonKB Dashboard Card for Tech Feeds & RSS
 * Follows strict lifecycle: mount, refresh, render, dispose
 * Pure plain-text description, NO raw innerHTML rendering for feeds.
 */
const { getIconPark } = require('../ui/iconpark.js');

class RssCard {
  /**
   * @param {Object} options
   * @param {import('../services/rss-service').RssService} options.rssService
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options) {
    this.service = options.rssService;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.cardEl = null;
    this.isDisposed = false;
    this.isLoading = false;
    this.currentTab = 'all'; // 'all' or feedId

    this.data = {
      items: [],
      feeds: [],
      lastUpdated: 0,
      isStale: false,
      error: null
    };

    this.timerId = null;
    this.autoRefreshIntervalMs = 15 * 60 * 1000; // 15 minutes
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
    this.cardEl = container.createDiv({ cls: 'tw-card tw-rss-card' });

    // Initial render & fetch
    this.render();
    this.refresh(false);

    // Setup periodic auto-refresh
    this._startTimer();
  }

  /**
   * Fetch latest feeds and update card UI
   * @param {boolean} [force=false]
   */
  async refresh(force = false) {
    if (this.isDisposed || this.isLoading) return;

    this.isLoading = true;
    this._updateHeaderState();

    try {
      const result = await this.service.fetchAllFeeds(force);
      if (this.isDisposed) return;

      this.data = {
        items: result.items || [],
        feeds: result.feeds || [],
        lastUpdated: result.lastUpdated || Date.now(),
        isStale: !!result.isStale,
        error: result.error || null
      };
    } catch (err) {
      if (this.isDisposed) return;
      this.data.error = err.message || '获取 RSS 资讯失败';
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
    const header = this.cardEl.createDiv({ cls: 'tw-card-header tw-rss-header' });
    const titleLeft = header.createDiv({ cls: 'tw-card-header-left' });
    titleLeft.innerHTML = `
      <span class="tw-rss-title-icon">${getIconPark('newspaper', 14)}</span>
      <span class="tw-rss-title-text">技术资讯 & 规范动态</span>
    `;

    const actionsRight = header.createDiv({ cls: 'tw-card-header-right' });
    const timeStr = this.data.lastUpdated ? formatRelativeClock(this.data.lastUpdated) : '';

    if (timeStr) {
      const timeSpan = actionsRight.createEl('span', { cls: 'tw-card-updated-time' });
      timeSpan.textContent = `更新于 ${timeStr}`;
    }

    const refreshBtn = actionsRight.createEl('button', {
      cls: `tw-card-refresh-btn ${this.isLoading ? 'spinning' : ''}`,
      title: '手动刷新所有 RSS 订阅源'
    });
    refreshBtn.innerHTML = getIconPark('refresh', 13);
    refreshBtn.onclick = (e) => {
      e.stopPropagation();
      this.refresh(true);
    };

    // 2. Tabs Bar (All + Enabled Feeds)
    const enabledFeeds = (this.data.feeds || []).filter(f => f.enabled !== false);
    const tabsBar = this.cardEl.createDiv({ cls: 'tw-rss-tabs-bar' });

    // All Tab
    const allTabBtn = tabsBar.createEl('button', {
      cls: `tw-tab-btn ${this.currentTab === 'all' ? 'active' : ''}`,
      text: `全部 (${this.data.items.length})`
    });
    allTabBtn.onclick = () => {
      this.currentTab = 'all';
      this.render();
    };

    // Individual Feed Tabs
    enabledFeeds.forEach(feed => {
      const count = this.data.items.filter(item => item.feedId === feed.id).length;
      const feedTabBtn = tabsBar.createEl('button', {
        cls: `tw-tab-btn ${this.currentTab === feed.id ? 'active' : ''}`,
        text: `${feed.name} (${count})`
      });
      feedTabBtn.onclick = () => {
        this.currentTab = feed.id;
        this.render();
      };
    });

    // 3. Body Container
    const body = this.cardEl.createDiv({ cls: 'tw-rss-body' });

    // Stale Banner if data is from cache
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

    // State 1: Loading
    if (this.isLoading && (!this.data.items || this.data.items.length === 0)) {
      const loadingEl = body.createDiv({ cls: 'tw-card-loading-state' });
      loadingEl.innerHTML = `
        <div class="tw-card-spinner"></div>
        <span>正在拉取最新技术资讯...</span>
      `;
      return;
    }

    // State 2: Error
    if (this.data.error && (!this.data.items || this.data.items.length === 0)) {
      const errorEl = body.createDiv({ cls: 'tw-card-error-state' });
      errorEl.innerHTML = `
        <div class="tw-card-state-icon">${getIconPark('alert', 22)}</div>
        <div class="tw-card-state-title">${escapeHtml(this.data.error)}</div>
        <div class="tw-card-state-actions">
          <button class="tw-chip tw-state-retry-btn">重试</button>
          ${this.onOpenSettings ? '<button class="tw-chip tw-state-settings-btn">管理订阅源</button>' : ''}
        </div>
      `;
      const retryBtn = errorEl.querySelector('.tw-state-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
      const settingsBtn = errorEl.querySelector('.tw-state-settings-btn');
      if (settingsBtn && this.onOpenSettings) settingsBtn.onclick = () => this.onOpenSettings();
      return;
    }

    // Filter items according to active tab
    const filteredItems = this.currentTab === 'all'
      ? this.data.items
      : this.data.items.filter(item => item.feedId === this.currentTab);

    // State 3: Empty
    if (!filteredItems || filteredItems.length === 0) {
      const emptyEl = body.createDiv({ cls: 'tw-card-empty-state' });
      emptyEl.innerHTML = `
        <div class="tw-card-state-icon" style="color:var(--text-muted);">${getIconPark('file-text', 22)}</div>
        <div class="tw-card-state-title">当前源暂无最新文章</div>
      `;
      return;
    }

    // State 4: Feed Item List
    const listWrap = body.createDiv({ cls: 'tw-rss-item-list' });
    filteredItems.forEach(item => {
      const itemEl = listWrap.createDiv({ cls: 'tw-rss-item' });

      // Header row: Feed Name Chip + Relative Time
      const topRow = itemEl.createDiv({ cls: 'tw-rss-item-top' });
      
      const feedBadge = topRow.createEl('span', { cls: 'tw-rss-feed-badge' });
      feedBadge.textContent = item.feedName;

      const timeSpan = topRow.createEl('span', { cls: 'tw-rss-item-time' });
      timeSpan.textContent = item.publishedAt ? formatRelativeTime(item.publishedAt) : '';

      // Title row
      const titleEl = itemEl.createEl('div', { cls: 'tw-rss-item-title' });
      titleEl.textContent = item.title;

      // Safe Description row (Plain text rendered safely, NEVER raw innerHTML)
      if (item.description) {
        const descEl = itemEl.createEl('div', { cls: 'tw-rss-item-desc' });
        descEl.textContent = item.description;
      }

      // Click to open URL in external browser
      itemEl.onclick = () => {
        if (item.link && (item.link.startsWith('http://') || item.link.startsWith('https://'))) {
          window.open(item.link, '_blank', 'noopener,noreferrer');
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

function formatRelativeClock(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatRelativeTime(date) {
  if (!date) return '';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 2) return '昨天';
  if (diffSec < 86400 * 3) return '前天';
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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

module.exports = { RssCard };
