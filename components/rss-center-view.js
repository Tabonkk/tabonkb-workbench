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
   * @param {any} [options.plugin] - TabonKB Workbench Plugin instance
   * @param {any} [options.agentDrawer] - Pi Agent Hub Drawer instance
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options = {}) {
    this.rssService = options.rssService;
    this.app = options.app;
    this.plugin = options.plugin || null;
    this.agentDrawer = options.agentDrawer || null;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.streamScrollEl = null;

    this.items = [];
    this.feeds = [];
    this.isLoading = false;
    this.error = null;
    this.lastUpdated = 0;

    // Filters and states
    this.activeChannel = this.getSavedChannel(); // 'all' | 'unread' | 'cat:kernel' | 'cat:ai' | feedId
    this.activeTimeRange = this.getSavedTimeRange(); // 'all' | 'today' | 'week' | 'month'
    this.keyword = '';
    this.readIds = this.getSavedReadIds(); // Set of string IDs
    this.savedScrollTop = this.getSavedScrollTop();
    this.summarizingIds = new Set(); // IDs currently running AI summary
    this.isDisposed = false;
  }

  isGroupCollapsed(groupId) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(`tabonkb-rss-collapse-${groupId}`) === 'true';
      }
    } catch (e) {}
    return false;
  }

  toggleGroupCollapse(groupId) {
    const next = !this.isGroupCollapsed(groupId);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`tabonkb-rss-collapse-${groupId}`, String(next));
      }
    } catch (e) {}
    this.render();
  }

  getSavedSummary(item) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`tabonkb-rss-sum:${this.getItemId(item)}`);
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {}
    return null;
  }

  saveSummary(item, summaryObj) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`tabonkb-rss-sum:${this.getItemId(item)}`, JSON.stringify(summaryObj));
      }
    } catch (e) {}
  }

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

  getItemCategory(item) {
    if (item.category) return item.category;
    const feed = (this.feeds || []).find(f => f.id === item.feedId);
    return feed?.category || 'kernel';
  }

  getFilteredItems() {
    let result = [...this.items];

    // 1. Channel / Category filter
    if (this.activeChannel === 'unread') {
      result = result.filter(item => !this.isRead(item));
    } else if (this.activeChannel === 'cat:kernel') {
      result = result.filter(item => this.getItemCategory(item) === 'kernel');
    } else if (this.activeChannel === 'cat:ai') {
      result = result.filter(item => this.getItemCategory(item) === 'ai');
    } else if (this.activeChannel !== 'all') {
      result = result.filter(item => item.feedId === this.activeChannel);
    }

    // 3. Time range filter
    result = this.filterByTimeRange(result);

    // 4. Keyword filter
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

    // 3. Configured Feeds grouped by Category with Collapsible Chevrons
    const configuredFeeds = (this.feeds && this.feeds.length > 0) ? this.feeds : (this.rssService?.getFeeds?.() || []);
    const enabledFeeds = configuredFeeds.filter(f => f.enabled !== false);
    const kernelFeeds = enabledFeeds.filter(f => f.category !== 'ai');
    const aiFeeds = enabledFeeds.filter(f => f.category === 'ai');

    const renderFeedGroup = (groupId, title, groupFeeds) => {
      if (!groupFeeds || groupFeeds.length === 0) return;
      const isCollapsed = this.isGroupCollapsed(groupId);
      const groupItems = this.items.filter(i => this.getItemCategory(i) === groupId);
      const groupUnread = groupItems.filter(i => !this.isRead(i)).length;
      const isCatActive = this.activeChannel === `cat:${groupId}`;

      const groupHead = nav.createDiv({
        cls: `tw-rss-chan-group-head ${isCatActive ? 'active' : ''}`
      });

      groupHead.innerHTML = `
        <div class="tw-group-head-left">
          <button class="tw-group-toggle-btn" title="${isCollapsed ? '展开分组' : '折叠分组'}">
            ${getIconPark(isCollapsed ? 'right' : 'down', 11)}
          </button>
          <span class="tw-group-title-text" title="点击筛选本分类全部资讯">${title}</span>
        </div>
        <div class="tw-chan-badges">
          ${groupUnread > 0 ? `<span class="tw-chan-unread-badge">${groupUnread}</span>` : ''}
          <span class="tw-chan-total-badge">${groupItems.length}</span>
        </div>
      `;

      const toggleBtn = groupHead.querySelector('.tw-group-toggle-btn');
      if (toggleBtn) {
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          this.toggleGroupCollapse(groupId);
        };
      }

      groupHead.onclick = () => {
        if (this.activeChannel !== `cat:${groupId}`) {
          this.saveChannel(`cat:${groupId}`);
          this.render();
        }
      };

      if (!isCollapsed) {
        const subWrap = nav.createDiv({ cls: 'tw-rss-group-items' });
        for (const feed of groupFeeds) {
          const feedItems = this.items.filter(i => i.feedId === feed.id);
          const unreadCount = feedItems.filter(i => !this.isRead(i)).length;

          const itemBtn = subWrap.createDiv({
            cls: `tw-rss-chan-item sub-item ${this.activeChannel === feed.id ? 'active' : ''}`
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
          itemBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.activeChannel !== feed.id) {
              this.saveChannel(feed.id);
              this.render();
            }
          };
        }
      }
    };

    renderFeedGroup('kernel', '📱 手机底层与内核', kernelFeeds);
    renderFeedGroup('ai', '🧠 端侧 AI 前沿', aiFeeds);
  }

  renderToolbar(parentEl) {
    const toolbar = parentEl.createDiv({ cls: 'tw-rss-toolbar' });

    // Left: Time Range Pills (Single row, clean, minimalist)
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
    const itemCat = this.getItemCategory(item);
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

    // Category tag
    const catChip = leftMeta.createSpan({
      cls: `tw-rss-cat-badge ${itemCat === 'ai' ? 'ai' : 'kernel'}`
    });
    catChip.textContent = itemCat === 'ai' ? '端侧 AI' : '底层内核';

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

    // AI Summary host container
    const summaryHost = card.createDiv({ cls: 'tw-rss-summary-host' });
    this.renderSummaryBox(summaryHost, item);

    // Footer actions row
    const footer = card.createDiv({ cls: 'tw-rss-card-footer' });

    // 1. Action: ⚡ 重点提炼
    const hasSummary = !!this.getSavedSummary(item);
    const isSummarizing = this.summarizingIds.has(this.getItemId(item));
    const btnSummary = footer.createEl('button', {
      cls: `tw-card-action-btn summary ${hasSummary ? 'active' : ''} ${isSummarizing ? 'loading' : ''}`,
      title: '使用 NiceAIGC 提炼核心技术点与手机研发启示'
    });
    btnSummary.innerHTML = `${getIconPark('lightning', 11)} <span>${isSummarizing ? '提炼中...' : (hasSummary ? '已提炼' : '提炼重点')}</span>`;
    btnSummary.onclick = (e) => {
      e.stopPropagation();
      this.handleAiSummary(item, summaryHost, btnSummary);
    };

    // 2. Action: 💬 联动研读 (Agent Hub)
    const btnAgent = footer.createEl('button', {
      cls: 'tw-card-action-btn agent',
      title: '将本篇资讯带入 Agent Hub 智能助手开展深入研读与技术分析'
    });
    btnAgent.innerHTML = `${getIconPark('topic', 11)} <span>联动研读</span>`;
    btnAgent.onclick = (e) => {
      e.stopPropagation();
      this.handleAskAgent(item);
    };

    // 3. Action: 📥 归档入库
    const btnArchive = footer.createEl('button', {
      cls: 'tw-card-action-btn archive',
      title: '按照知识库规范将本篇资讯生成笔记卡片归档至 00-Inbox/02-Raw-Drop'
    });
    btnArchive.innerHTML = `${getIconPark('download', 11)} <span>归档入库</span>`;
    btnArchive.onclick = (e) => {
      e.stopPropagation();
      this.handleArchiveToInbox(item, btnArchive);
    };

    // 4. Action: 打开原文
    const btnOpen = footer.createEl('button', {
      cls: 'tw-card-action-btn external',
      title: '在外部默认浏览器中打开原网页'
    });
    btnOpen.innerHTML = `${getIconPark('external', 11)} <span>原文</span>`;
    btnOpen.onclick = (e) => {
      e.stopPropagation();
      this.markAsRead(item);
      card.classList.remove('unread');
      card.classList.add('read');
      const dot = card.querySelector('.tw-unread-dot');
      if (dot) dot.remove();
      if (item.link) {
        openExternalUrlSafe(item.link);
      }
    };

    // 5. Action: Toggle read/unread
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
        openExternalUrlSafe(item.link);
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

  renderSummaryBox(hostEl, item) {
    hostEl.empty();
    const itemId = this.getItemId(item);
    const isSummarizing = this.summarizingIds.has(itemId);
    const summary = this.getSavedSummary(item);

    if (isSummarizing) {
      const box = hostEl.createDiv({ cls: 'tw-rss-ai-summary-box loading' });
      box.innerHTML = `
        <div class="tw-ai-sum-loading">
          <div class="tw-loading-spin mini"></div>
          <span>正在结合手机底层与端侧 AI 研发专家视角提炼核心结论与技术要点...</span>
        </div>
      `;
      return;
    }

    if (!summary) return;

    const box = hostEl.createDiv({ cls: 'tw-rss-ai-summary-box' });
    box.onclick = (e) => e.stopPropagation();

    box.innerHTML = `
      <div class="tw-ai-sum-header">
        <div class="tw-ai-sum-title">
          <span class="tw-ai-sum-tag">⚡ AI 重点提炼</span>
          <span class="tw-ai-sum-model">NiceAIGC · 研发专家视角</span>
        </div>
        <button class="tw-ai-sum-reload-btn" title="重新提炼">${getIconPark('refresh', 11)} <span>重新提炼</span></button>
      </div>
      <div class="tw-ai-sum-body">
        <div class="tw-ai-sum-item">
          <span class="tw-ai-sum-icon">📌</span>
          <div class="tw-ai-sum-content">
            <span class="tw-ai-sum-label">核心结论：</span>
            <span class="tw-ai-sum-text">${escapeHtml(summary.core || '无')}</span>
          </div>
        </div>
        <div class="tw-ai-sum-item">
          <span class="tw-ai-sum-icon">⚙️</span>
          <div class="tw-ai-sum-content">
            <span class="tw-ai-sum-label">底层技术点：</span>
            <span class="tw-ai-sum-text">${escapeHtml(summary.tech || '无')}</span>
          </div>
        </div>
        <div class="tw-ai-sum-item">
          <span class="tw-ai-sum-icon">💡</span>
          <div class="tw-ai-sum-content">
            <span class="tw-ai-sum-label">手机研发启示：</span>
            <span class="tw-ai-sum-text">${escapeHtml(summary.insight || '无')}</span>
          </div>
        </div>
      </div>
    `;

    const reloadBtn = box.querySelector('.tw-ai-sum-reload-btn');
    if (reloadBtn) {
      reloadBtn.onclick = (e) => {
        e.stopPropagation();
        this.handleAiSummary(item, hostEl, null, true);
      };
    }
  }

  async handleAiSummary(item, hostEl, btnSummary, forceRefresh = false) {
    const itemId = this.getItemId(item);
    if (this.summarizingIds.has(itemId)) return;

    const existing = this.getSavedSummary(item);
    if (existing && !forceRefresh) {
      if (hostEl.firstChild) {
        hostEl.empty();
        if (btnSummary) btnSummary.classList.remove('active');
      } else {
        this.renderSummaryBox(hostEl, item);
        if (btnSummary) btnSummary.classList.add('active');
      }
      return;
    }

    this.summarizingIds.add(itemId);
    if (btnSummary) {
      btnSummary.classList.add('loading');
      const textSpan = btnSummary.querySelector('span');
      if (textSpan) textSpan.textContent = '提炼中...';
    }
    this.renderSummaryBox(hostEl, item);

    try {
      const adapter = this.plugin?.agentHub?.adapters?.get('niceaigc') || 
                      this.plugin?.agentHub?.getAdapter?.('niceaigc');
      if (!adapter || typeof adapter.oneShot !== 'function') {
        throw new Error('NiceAIGC 适配器未就绪或未在设置中配置 Token');
      }

      const systemPrompt = `你是一位专注于手机系统底层（Linux/Android 内核、BSP、驱动框架、SoC 芯片架构）与端侧 AI（端侧模型部署、NPU 算力推理、AI 系统赋能）的资深技术专家。请对给出的技术资讯进行高度凝练的中文重点提炼。
输出要求：必须且仅输出标准 JSON 格式，严禁返回任何 markdown 代码围栏，严禁任何多余解释说明：
{
  "core": "核心技术结论或重大进展（1-2句客观事实）",
  "tech": "核心底层技术点、架构变动或底层实现机制（精炼聚焦）",
  "insight": "对手机研发、系统优化、驱动调试或端侧AI落地的工程启示与价值"
}`;

      const userPrompt = `【资讯标题】: ${item.title}
【所属渠道】: ${item.feedName}
【原文链接】: ${item.link || '无'}
【资讯摘要】: ${item.description || '无'}
请提炼重点。`;

      const responseText = await adapter.oneShot(userPrompt, systemPrompt);
      let parsed = null;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.warn('[RssCenterView] Failed to parse summary JSON:', err, responseText);
      }

      if (!parsed || (!parsed.core && !parsed.tech && !parsed.insight)) {
        const clean = (responseText || '').replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = {
          core: clean.slice(0, 160) || item.title,
          tech: '详见原文底层架构与实现细节',
          insight: '对手机系统工程与端侧应用具有技术参考价值'
        };
      }

      this.saveSummary(item, parsed);
      this.markAsRead(item);
    } catch (err) {
      console.error('[RssCenterView] AI Summary failed:', err);
      hostEl.empty();
      const errBox = hostEl.createDiv({ cls: 'tw-rss-ai-summary-box error' });
      errBox.innerHTML = `
        <span class="tw-ai-err-text">提炼失败: ${escapeHtml(err.message || '网络连接或服务异常')}</span>
        <button class="tw-ai-sum-retry-btn">重试</button>
      `;
      const retryBtn = errBox.querySelector('.tw-ai-sum-retry-btn');
      if (retryBtn) {
        retryBtn.onclick = (e) => {
          e.stopPropagation();
          this.handleAiSummary(item, hostEl, btnSummary, true);
        };
      }
      return;
    } finally {
      this.summarizingIds.delete(itemId);
      if (btnSummary) {
        btnSummary.classList.remove('loading');
        btnSummary.classList.add('active');
        const textSpan = btnSummary.querySelector('span');
        if (textSpan) textSpan.textContent = '已提炼';
      }
      this.renderSummaryBox(hostEl, item);
    }
  }

  handleAskAgent(item) {
    const drawer = this.agentDrawer || this.plugin?.agentDrawer;
    if (!drawer) {
      console.warn('[RssCenterView] agentDrawer not found');
      return;
    }

    if (!drawer.isOpen()) {
      drawer.open();
    }

    const summary = this.getSavedSummary(item);
    let prompt = `请帮我深入研读并分析这篇技术资讯：
【标题】：${item.title}
【来源】：${item.feedName}
【原文链接】：${item.link}
【摘要】：${item.description || '无'}
`;
    if (summary) {
      prompt += `
【前期重点提炼】：
- 核心结论：${summary.core}
- 底层技术点：${summary.tech}
- 手机研发启示：${summary.insight}
`;
    }
    prompt += `
请从手机底层架构、Linux/Android 内核机制、或端侧 AI 部署的角度，帮我详细拆解其技术原理、潜在瓶颈以及对手机研发工程的实际借鉴意义。`;

    if (typeof drawer.setInputValue === 'function') {
      drawer.setInputValue(prompt, true);
    } else if (drawer.inputEl) {
      drawer.inputEl.value = prompt;
      drawer.inputEl.focus();
      drawer.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof drawer.updateSendButtonState === 'function') {
        drawer.updateSendButtonState();
      }
      if (typeof drawer.adjustInputHeight === 'function') {
        drawer.adjustInputHeight();
      } else if (typeof drawer.autoResizeInput === 'function') {
        drawer.autoResizeInput();
      }
    }
  }

  async handleArchiveToInbox(item, btnEl) {
    const itemCat = this.getItemCategory(item);
    const isAi = itemCat === 'ai';
    const platform = 'COMMON';
    const module = isAi ? 'GEN' : 'KERN';
    const docType = 'NOTE';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    const dateDashed = `${yyyy}-${mm}-${dd}`;

    const rawTitle = (item.title || 'Tech-Article').trim();
    let safeTitle = rawTitle
      .replace(/[\\/:*?"<>|#%&]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 42);
    if (!safeTitle) safeTitle = 'Tech-Article';

    const filename = `${safeTitle}_v1.0_${yyyymmdd}_${platform}_${module}_${docType}.md`;
    const folderPath = '00-Inbox/02-Raw-Drop';
    const fullPath = `${folderPath}/${filename}`;

    const summary = this.getSavedSummary(item);
    let summarySection = '';
    if (summary) {
      summarySection = `## ⚡ AI 重点提炼

- **核心结论**: ${summary.core || '无'}
- **底层技术点**: ${summary.tech || '无'}
- **手机研发启示**: ${summary.insight || '无'}

---

`;
    }

    const fileContent = `---
title: "${rawTitle.replace(/"/g, '\\"')}"
date: ${dateDashed}
updated: ${dateDashed}
platform: [${platform}]
module: [${module}]
doctype: ${docType}
version: v1.0
status: draft
source: "${item.feedName}"
url: "${item.link || ''}"
tags:
  - news/rss
  - ${isAi ? 'ai/edge-ai' : 'kernel/bsp'}
---

# ${rawTitle}

> **来源**: [${item.feedName}](${item.link || '#'})  
> **成文日期**: ${dateDashed}  
> **归档位置**: ${folderPath} (待进一步细化或关联项目)

${summarySection}## 📰 原文摘要

${item.description || '无原文摘要'}

---
*原文链接*: [${item.link}](${item.link})
`;

    const oldHtml = btnEl.innerHTML;
    try {
      const vault = this.app?.vault;
      if (!vault) throw new Error('Obsidian Vault 未就绪');

      const existing = vault.getAbstractFileByPath ? vault.getAbstractFileByPath(fullPath) : null;
      if (existing) {
        btnEl.innerHTML = `${getIconPark('check-circle', 11)} <span>已存在此笔记</span>`;
      } else {
        await vault.create(fullPath, fileContent);
        btnEl.innerHTML = `${getIconPark('check-circle', 11)} <span>已归档至 00-Inbox!</span>`;
      }
      btnEl.classList.add('success');
      this.markAsRead(item);
      setTimeout(() => {
        btnEl.innerHTML = oldHtml;
        btnEl.classList.remove('success');
      }, 1800);
    } catch (err) {
      console.warn('[RssCenterView] Failed to archive to inbox:', err);
      btnEl.innerHTML = `${getIconPark('alert', 11)} <span>归档失败</span>`;
      setTimeout(() => {
        btnEl.innerHTML = oldHtml;
      }, 1800);
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
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
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

function openExternalUrlSafe(href) {
  if (!href) return;
  const target = String(href).trim();
  if (!target) return;

  // 1. Try global openExternalUrl (from pi-drawer-view.js in bundled environment)
  if (typeof openExternalUrl === 'function') {
    try {
      openExternalUrl(target);
      return;
    } catch (e) {}
  }

  // 2. Try Electron shell
  try {
    let elShell = (typeof shell !== 'undefined' && shell) ? shell : null;
    if (!elShell && typeof require !== 'undefined') {
      try { elShell = require('electron')?.shell; } catch (e) {}
    }
    if (elShell && typeof elShell.openExternal === 'function') {
      elShell.openExternal(target);
      return;
    }
  } catch (e) {}

  // 3. Try window.open
  try {
    window.open(target, '_blank', 'noopener,noreferrer');
  } catch (e) {}

  // 4. Try OS command on Windows
  try {
    const cp = (typeof child_process !== 'undefined' && child_process) ? child_process : (typeof require !== 'undefined' ? require('child_process') : null);
    if (cp && typeof cp.spawn === 'function' && typeof process !== 'undefined' && process.platform === 'win32') {
      cp.spawn('cmd.exe', ['/c', 'start', '', target], { detached: true, windowsHide: true });
    }
  } catch (e) {}
}

module.exports = { RssCenterView };
