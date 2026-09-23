const { getIconPark } = require('../ui/iconpark.js');

/**
 * RssCenterView: Full-screen RSS & Tech Feed News Center for TabonKB Workbench.
 * 
 * Capabilities:
 * 1. Time range filtering: [全部] [今天] [本周] [本月]
 * 2. Keyword highlighting: Safe escaping + `<mark class="tw-search-match">`
 * 3. Reading progress persistence:
 *    - Last viewed channel (localStorage)
 *    - Read article IDs / status (localStorage)
 *    - Feed stream scroll offset (localStorage)
 *    - Time range selection (localStorage)
 * 4. Channel sidebar: All, Unread, and per-feed channels with unread badges
 * 5. Quick actions: "摘录至 Quick Note", "打开原文", "全部标为已读"
 * 6. Top search bar integration: filterKeyword(kw)
 */
class RssCenterView {
  /**
   * @param {Object} options
   * @param {import('../services/rss-service').RssService} options.rssService
   * @param {any} options.app - Obsidian App instance
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options = {}) {
    this.rssService = options.rssService;
    this.app = options.app;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.streamScrollEl = null;

    this.items = [];
    this.feeds = [];
    this.isLoading = false;
    this.error = null;
    this.lastUpdated = 0;

    // Filters and states
    this.activeChannel = this.getSavedChannel(); // 'all' | 'unread' | feedId
    this.activeTimeRange = this.getSavedTimeRange(); // 'all' | 'today' | 'week' | 'month'
    this.keyword = '';
    this.readIds = this.getSavedReadIds(); // Set of string IDs
    this.savedScrollTop = this.getSavedScrollTop();
    this.isDisposed = false;
  }

  // --- Persistence Helpers ---
  getSavedChannel() {
    try {
      if (typeof localStorage !== 'undefined') {
        const c = localStorage.getItem('tabonkb-rss-channel');
        if (c) return c;
      }
    } catch (e) {}
    return 'all';
  }

  saveChannel(channelId) {
    this.activeChannel = channelId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-rss-channel', channelId);
      }
    } catch (e) {}
  }

  getSavedTimeRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('tabonkb-rss-time-range');
        if (r && ['all', 'today', 'week', 'month'].includes(r)) return r;
      }
    } catch (e) {}
    return 'all';
  }

  saveTimeRange(range) {
    this.activeTimeRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-rss-time-range', range);
      }
    } catch (e) {}
  }

  getSavedReadIds() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-rss-read-ids');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return new Set(parsed);
        }
      }
    } catch (e) {}
    return new Set();
  }

  saveReadIds() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Cap to latest 1000 items to avoid bloating localStorage
        const arr = Array.from(this.readIds).slice(-1000);
        localStorage.setItem('tabonkb-rss-read-ids', JSON.stringify(arr));
      }
    } catch (e) {}
  }

  getSavedScrollTop() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-rss-scroll-top');
        if (s) return parseInt(s, 10) || 0;
      }
    } catch (e) {}
    return 0;
  }

  saveScrollTop(top) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-rss-scroll-top', String(Math.round(top)));
      }
    } catch (e) {}
  }

  getItemId(item) {
    return item.link || (item.feedId + ':' + item.title);
  }

  isRead(item) {
    return this.readIds.has(this.getItemId(item));
  }

  markAsRead(item) {
    const id = this.getItemId(item);
    if (!this.readIds.has(id)) {
      this.readIds.add(id);
      this.saveReadIds();
      this.updateUnreadCounts();
    }
  }

  markAllAsRead() {
    for (const item of this.items) {
      this.readIds.add(this.getItemId(item));
    }
    this.saveReadIds();
    this.render();
  }

  toggleRead(item) {
    const id = this.getItemId(item);
    if (this.readIds.has(id)) {
      this.readIds.delete(id);
    } else {
      this.readIds.add(id);
    }
    this.saveReadIds();
    this.render();
  }

  // --- Mounting & Loading ---
  mount(parentEl) {
    this.isDisposed = false;
    this.containerEl = parentEl;
    this.render();
    this.loadFeeds(false);
  }

  async loadFeeds(forceRefresh = false) {
    if (!this.rssService || this.isLoading) return;
    this.isLoading = true;
    this.error = null;
    this.updateLoadingState();

    try {
      const res = await this.rssService.fetchAllFeeds(forceRefresh);
      if (this.isDisposed) return;

      this.items = res.items || [];
      this.feeds = res.feeds || [];
      this.lastUpdated = res.lastUpdated || Date.now();
      this.error = res.error || null;
    } catch (err) {
      if (this.isDisposed) return;
      this.error = err.message || '获取 RSS 订阅资讯失败';
    } finally {
      if (!this.isDisposed) {
        this.isLoading = false;
        this.render();
        this.restoreScrollPosition();
      }
    }
  }

  filterKeyword(kw) {
    this.keyword = (kw || '').trim();
    this.renderCardsStream();
  }

  // --- Date Range Calculation ---
  filterByTimeRange(items) {
    if (this.activeTimeRange === 'all') return items;
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = now - 7 * 86400 * 1000;
    const thirtyDaysAgo = now - 30 * 86400 * 1000;

    return items.filter(item => {
      const pub = item.publishedAt ? (new Date(item.publishedAt)).getTime() : 0;
      if (!pub) return true; // Keep if no date available
      if (this.activeTimeRange === 'today') {
        return pub >= startOfToday.getTime();
      }
      if (this.activeTimeRange === 'week') {
        return pub >= sevenDaysAgo;
      }
      if (this.activeTimeRange === 'month') {
        return pub >= thirtyDaysAgo;
      }
      return true;
    });
  }

  getFilteredItems() {
    let result = [...this.items];

    // 1. Channel filter
    if (this.activeChannel === 'unread') {
      result = result.filter(item => !this.isRead(item));
    } else if (this.activeChannel !== 'all') {
      result = result.filter(item => item.feedId === this.activeChannel);
    }

    // 2. Time range filter
    result = this.filterByTimeRange(result);

    // 3. Keyword filter
    if (this.keyword) {
      const kw = this.keyword.toLowerCase();
      result = result.filter(item => {
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const feed = (item.feedName || '').toLowerCase();
        return title.includes(kw) || desc.includes(kw) || feed.includes(kw);
      });
    }

    return result;
  }

  // --- Rendering ---
  render() {
    if (!this.containerEl || this.isDisposed) return;
    this.containerEl.empty();
    this.containerEl.addClass('tw-rss-center-root');

    const layout = this.containerEl.createDiv({ cls: 'tw-rss-center' });

    // 1. Left Channel Sidebar
    this.renderChannelSidebar(layout);

    // 2. Right Main Feed Stage
    const stage = layout.createDiv({ cls: 'tw-rss-main-stage' });
    this.renderToolbar(stage);
    
    // Feed cards container
    this.streamScrollEl = stage.createDiv({ cls: 'tw-rss-stream-container' });
    this.renderCardsStream();

    // Attach scroll tracking to persist scroll progress
    let scrollTimer = null;
    this.streamScrollEl.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (this.streamScrollEl) {
          this.saveScrollTop(this.streamScrollEl.scrollTop);
        }
      }, 150);
    });
  }

  renderChannelSidebar(parentEl) {
    const sidebar = parentEl.createDiv({ cls: 'tw-rss-sidebar' });

    // Sidebar Header
    const head = sidebar.createDiv({ cls: 'tw-rss-sidebar-head' });
    head.innerHTML = `
      <div class="tw-rss-sb-title">
        <span class="tw-rss-sb-icon">${getIconPark('newspaper', 15)}</span>
        <span>资讯频道</span>
      </div>
      <button class="tw-rss-sb-cfg-btn" title="订阅源配置">${getIconPark('setting-config', 13)}</button>
    `;
    const cfgBtn = head.querySelector('.tw-rss-sb-cfg-btn');
    if (cfgBtn && this.onOpenSettings) {
      cfgBtn.onclick = () => this.onOpenSettings();
    }

    // Sidebar Channels List
    const nav = sidebar.createDiv({ cls: 'tw-rss-channels-nav' });

    // 1. "全部资讯" (All)
    const totalUnread = this.items.filter(i => !this.isRead(i)).length;
    const allBtn = nav.createDiv({
      cls: `tw-rss-chan-item ${this.activeChannel === 'all' ? 'active' : ''}`
    });
    allBtn.innerHTML = `
      <div class="tw-chan-left">
        <span class="tw-chan-icon">${getIconPark('dashboard', 13)}</span>
        <span class="tw-chan-name">全部资讯</span>
      </div>
      <div class="tw-chan-badges">
        ${totalUnread > 0 ? `<span class="tw-chan-unread-badge">${totalUnread}</span>` : ''}
        <span class="tw-chan-total-badge">${this.items.length}</span>
      </div>
    `;
    allBtn.onclick = () => {
      if (this.activeChannel !== 'all') {
        this.saveChannel('all');
        this.render();
      }
    };

    // 2. "未读动态" (Unread)
    const unreadBtn = nav.createDiv({
      cls: `tw-rss-chan-item ${this.activeChannel === 'unread' ? 'active' : ''}`
    });
    unreadBtn.innerHTML = `
      <div class="tw-chan-left">
        <span class="tw-chan-icon">${getIconPark('bell', 13)}</span>
        <span class="tw-chan-name">未读动态</span>
      </div>
      <span class="tw-chan-unread-badge primary">${totalUnread}</span>
    `;
    unreadBtn.onclick = () => {
      if (this.activeChannel !== 'unread') {
        this.saveChannel('unread');
        this.render();
      }
    };

    nav.createDiv({ cls: 'tw-rss-chan-divider' });

    // 3. Configured Feeds
    const configuredFeeds = (this.feeds && this.feeds.length > 0) ? this.feeds : (this.rssService?.getFeeds?.() || []);
    const enabledFeeds = configuredFeeds.filter(f => f.enabled !== false);

    for (const feed of enabledFeeds) {
      const feedItems = this.items.filter(i => i.feedId === feed.id);
      const unreadCount = feedItems.filter(i => !this.isRead(i)).length;

      const itemBtn = nav.createDiv({
        cls: `tw-rss-chan-item ${this.activeChannel === feed.id ? 'active' : ''}`
      });
      itemBtn.innerHTML = `
        <div class="tw-chan-left">
          <span class="tw-chan-bullet"></span>
          <span class="tw-chan-name" title="${escapeAttr(feed.name)}">${escapeHtml(feed.name)}</span>
        </div>
        <div class="tw-chan-badges">
          ${unreadCount > 0 ? `<span class="tw-chan-unread-badge">${unreadCount}</span>` : ''}
          <span class="tw-chan-total-badge">${feedItems.length}</span>
        </div>
      `;
      itemBtn.onclick = () => {
        if (this.activeChannel !== feed.id) {
          this.saveChannel(feed.id);
          this.render();
        }
      };
    }
  }

  renderToolbar(parentEl) {
    const toolbar = parentEl.createDiv({ cls: 'tw-rss-toolbar' });

    // Left: Time Range Pills
    const leftWrap = toolbar.createDiv({ cls: 'tw-rss-toolbar-left' });
    const timeFilters = [
      { id: 'all', label: '全部' },
      { id: 'today', label: '今天' },
      { id: 'week', label: '本周' },
      { id: 'month', label: '本月' }
    ];

    const timeGroup = leftWrap.createDiv({ cls: 'tw-time-filter-group' });
    for (const tf of timeFilters) {
      const btn = timeGroup.createEl('button', {
        cls: `tw-time-btn ${this.activeTimeRange === tf.id ? 'active' : ''}`,
        text: tf.label
      });
      btn.onclick = () => {
        if (this.activeTimeRange !== tf.id) {
          this.saveTimeRange(tf.id);
          this.renderToolbarTimePills(timeGroup);
          this.renderCardsStream();
        }
      };
    }

    // Right: Actions
    const rightWrap = toolbar.createDiv({ cls: 'tw-rss-toolbar-right' });

    // Last Sync Text
    if (this.lastUpdated) {
      const timeStr = formatRelativeClock(this.lastUpdated);
      const syncText = rightWrap.createSpan({ cls: 'tw-rss-sync-text' });
      syncText.textContent = `更新于 ${timeStr}`;
    }

    // "全部标为已读" Button
    const btnMarkAll = rightWrap.createEl('button', {
      cls: 'tw-rss-act-btn secondary',
      title: '将所有文章标记为已读'
    });
    btnMarkAll.innerHTML = `${getIconPark('check-square', 12)} <span>全部标为已读</span>`;
    btnMarkAll.onclick = () => this.markAllAsRead();

    // Refresh Button
    const btnRefresh = rightWrap.createEl('button', {
      cls: 'tw-rss-act-btn',
      title: '手动刷新 RSS 订阅源'
    });
    btnRefresh.innerHTML = `${getIconPark('refresh', 12)} <span>刷新</span>`;
    btnRefresh.onclick = () => {
      btnRefresh.classList.add('spinning');
      this.loadFeeds(true).finally(() => {
        setTimeout(() => btnRefresh.classList.remove('spinning'), 400);
      });
    };
  }

  renderToolbarTimePills(groupEl) {
    if (!groupEl) return;
    const btns = groupEl.querySelectorAll('.tw-time-btn');
    const timeFilters = ['all', 'today', 'week', 'month'];
    btns.forEach((btn, idx) => {
      btn.classList.toggle('active', this.activeTimeRange === timeFilters[idx]);
    });
  }

  renderCardsStream() {
    if (!this.streamScrollEl) return;
    this.streamScrollEl.empty();

    const items = this.getFilteredItems();

    // Stale banner if using cached data with error
    if (this.error && this.items.length > 0) {
      const staleEl = this.streamScrollEl.createDiv({ cls: 'tw-rss-stale-banner' });
      staleEl.innerHTML = `
        <span class="tw-stale-icon">${getIconPark('alert', 12)}</span>
        <span>${escapeHtml(this.error)}</span>
      `;
    }

    // Empty state
    if (items.length === 0) {
      const emptyEl = this.streamScrollEl.createDiv({ cls: 'tw-rss-empty-stream' });
      emptyEl.innerHTML = `
        <div class="tw-rss-empty-icon">${getIconPark('file-text', 26)}</div>
        <div class="tw-rss-empty-title">当前筛选条件下暂无资讯条目</div>
        <div class="tw-rss-empty-desc">${this.keyword ? `未匹配到关键词 "${escapeHtml(this.keyword)}"` : '所有订阅源文章均已查阅完毕'}</div>
      `;
      return;
    }

    // Cards list
    const listWrap = this.streamScrollEl.createDiv({ cls: 'tw-rss-card-stream' });
    for (const item of items) {
      this.renderFeedCard(listWrap, item);
    }
  }

  renderFeedCard(parentEl, item) {
    const isItemRead = this.isRead(item);
    const card = parentEl.createDiv({
      cls: `tw-rss-stream-card ${isItemRead ? 'read' : 'unread'}`
    });

    // Top meta row
    const topRow = card.createDiv({ cls: 'tw-rss-card-top' });
    
    const leftMeta = topRow.createDiv({ cls: 'tw-rss-top-left' });
    if (!isItemRead) {
      leftMeta.createSpan({ cls: 'tw-unread-dot', title: '未读' });
    }
    const feedChip = leftMeta.createSpan({ cls: 'tw-rss-card-feed-badge' });
    feedChip.textContent = item.feedName;

    const timeSpan = topRow.createEl('span', { cls: 'tw-rss-card-time' });
    timeSpan.textContent = item.publishedAt ? formatRelativeTime(item.publishedAt) : '';

    // Title row with keyword highlight
    const titleEl = card.createDiv({ cls: 'tw-rss-card-title' });
    titleEl.innerHTML = this.highlightText(item.title || '（无标题）');

    // Description snippet with keyword highlight
    if (item.description) {
      const descEl = card.createDiv({ cls: 'tw-rss-card-desc' });
      descEl.innerHTML = this.highlightText(item.description);
    }

    // Footer actions row
    const footer = card.createDiv({ cls: 'tw-rss-card-footer' });

    // Action: 摘录至 Quick Note
    const btnExcerpt = footer.createEl('button', {
      cls: 'tw-card-action-btn excerpt',
      title: '将本篇资讯摘要与链接保存至 00-Inbox/Quick-Notes.md'
    });
    btnExcerpt.innerHTML = `${getIconPark('clipboard-check', 11)} <span>摘录至 Quick Note</span>`;
    btnExcerpt.onclick = (e) => {
      e.stopPropagation();
      this.handleExcerptToQuickNote(item, btnExcerpt);
    };

    // Action: 打开原文
    const btnOpen = footer.createEl('button', {
      cls: 'tw-card-action-btn external',
      title: '在外部默认浏览器中打开原网页'
    });
    btnOpen.innerHTML = `${getIconPark('external', 11)} <span>打开原文</span>`;
    btnOpen.onclick = (e) => {
      e.stopPropagation();
      this.markAsRead(item);
      card.classList.remove('unread');
      card.classList.add('read');
      const dot = card.querySelector('.tw-unread-dot');
      if (dot) dot.remove();
      if (item.link) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
      }
    };

    // Action: Toggle read/unread
    const btnToggle = footer.createEl('button', {
      cls: 'tw-card-action-btn mark',
      title: isItemRead ? '标记为未读' : '标记为已读'
    });
    btnToggle.innerHTML = isItemRead 
      ? `${getIconPark('circle', 11)} <span>标为未读</span>`
      : `${getIconPark('check-circle', 11)} <span>标为已读</span>`;
    btnToggle.onclick = (e) => {
      e.stopPropagation();
      this.toggleRead(item);
    };

    // Card click: marks as read and opens original URL
    card.onclick = () => {
      this.markAsRead(item);
      card.classList.remove('unread');
      card.classList.add('read');
      const dot = card.querySelector('.tw-unread-dot');
      if (dot) dot.remove();
      if (item.link) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
      }
    };
  }

  highlightText(rawText) {
    if (!rawText) return '';
    const safe = escapeHtml(rawText);
    if (!this.keyword) return safe;

    const escapedKw = escapeRegex(this.keyword);
    const regex = new RegExp(`(${escapedKw})`, 'gi');
    return safe.replace(regex, '<mark class="tw-search-match">$1</mark>');
  }

  async handleExcerptToQuickNote(item, btnEl) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const excerptContent = `\n\n### [${item.title}](${item.link})\n- **来源**: ${item.feedName}\n- **日期**: ${todayStr}\n- **摘要**: ${item.description || '无'}\n`;

    const oldText = btnEl.innerHTML;
    try {
      const vault = this.app?.vault;
      if (vault) {
        const filePath = '00-Inbox/Quick-Notes.md';
        let file = vault.getAbstractFileByPath ? vault.getAbstractFileByPath(filePath) : null;
        if (!file && typeof vault.create === 'function') {
          // Create initial note
          const initialHeader = `# 💡 技术资讯与速记 (Quick Notes)\n\n> 自动生成自 TabonKB 研发工作台资讯中心\n`;
          file = await vault.create(filePath, initialHeader + excerptContent);
        } else if (file && typeof vault.append === 'function') {
          await vault.append(file, excerptContent);
        } else if (vault.adapter && typeof vault.adapter.append === 'function') {
          await vault.adapter.append(filePath, excerptContent);
        }
      }

      // Also copy to clipboard for convenience
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(excerptContent.trim());
      }

      btnEl.innerHTML = `${getIconPark('check-circle', 11)} <span>已摘录入库！</span>`;
      btnEl.classList.add('success');
      this.markAsRead(item);
      setTimeout(() => {
        btnEl.innerHTML = oldText;
        btnEl.classList.remove('success');
      }, 1600);
    } catch (e) {
      console.warn('[RssCenterView] Failed to append excerpt:', e);
      // Fallback: clipboard copy
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(excerptContent.trim());
      }
      btnEl.innerHTML = `${getIconPark('copy', 11)} <span>已复制到剪贴板</span>`;
      setTimeout(() => {
        btnEl.innerHTML = oldText;
      }, 1600);
    }
  }

  restoreScrollPosition() {
    if (this.streamScrollEl && this.savedScrollTop > 0) {
      setTimeout(() => {
        if (this.streamScrollEl) {
          this.streamScrollEl.scrollTop = this.savedScrollTop;
        }
      }, 50);
    }
  }

  updateUnreadCounts() {
    const totalUnread = this.items.filter(i => !this.isRead(i)).length;
    if (this.containerEl) {
      const allBadge = this.containerEl.querySelector('.tw-rss-chan-item:nth-child(1) .tw-chan-unread-badge');
      if (allBadge) allBadge.textContent = totalUnread > 0 ? String(totalUnread) : '';
      const unreadBadge = this.containerEl.querySelector('.tw-rss-chan-item:nth-child(2) .tw-chan-unread-badge');
      if (unreadBadge) unreadBadge.textContent = String(totalUnread);
    }
  }

  updateLoadingState() {
    if (this.isLoading && this.items.length === 0 && this.streamScrollEl) {
      this.streamScrollEl.innerHTML = `
        <div class="tw-rss-loading-wrap">
          <div class="tw-loading-spin"></div>
          <div class="tw-loading-text">正在拉取各渠道技术资讯...</div>
        </div>
      `;
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.containerEl) {
      this.containerEl.empty();
      this.containerEl = null;
    }
    this.streamScrollEl = null;
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
  const d = new Date(date);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} Сʱǰ`;
  if (diffSec < 86400 * 2) return '昨天';
  if (diffSec < 86400 * 3) return '前天';
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
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
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { RssCenterView };
