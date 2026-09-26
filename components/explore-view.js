const { getIconPark } = require('../ui/iconpark.js');

/**
 * ExploreView: Handles the "探索" tab inside TabonKB Workbench.
 * - Sub-tab 1: [ 🤖 AI ] Full-featured Agent Hub Workspace
 * - Sub-tab 2: [ 🔍 检索 ] Chipset Vendor Resource Search (MTK Online & Unisoc Uni-Support)
 * - Vendor Account & Password Management Modal/Card
 * - Seamless cross-subtab AI prompt delivery
 */
class ExploreView {
  /**
   * @param {object} options
   * @param {any} options.app
   * @param {any} options.vendorService
   * @param {any} options.agentDrawer
   * @param {any} options.agentHub
   * @param {function} [options.onOpenSettings]
   */
  constructor(options = {}) {
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.vendorService = options.vendorService;
    this.agentDrawer = options.agentDrawer;
    this.agentHub = options.agentHub;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.activeSubTab = this.getSavedSubTab(); // 'ai' | 'search'
    // 平台独立多选: 默认两个都选中 (外框显色=选择)
    this.selectedSources = new Set(['mtk', 'unisoc']);
    // 官网联通状态 (字标显色=联通): 默认视为正常, 实检索后按 portalStatus 刷新
    this.portalStatus = { mtk: { ok: true, msg: '' }, unisoc: { ok: true, msg: '' } };
    this._sourceTabEls = {}; // 缓存两个平台 Tab 按钮 DOM, 用于检索后刷新联通态
    this.activeSource = this.computeSourceFilter(); // 'all' | 'mtk' | 'unisoc' (由 selectedSources 派生)
    this.activeChipset = 'all';
    this.activeCategory = 'all';
    this.searchKeyword = '';
    this.activeOfficialSearch = null; // Stores last official website search context
    this.expandedCardIds = new Set(); // Card IDs that have their full solutions expanded in-situ
    this.isAccountModalOpen = false;

    // Live Official Portal Search States
    this.isSearchingLive = false;
    this.liveSearchResults = [];
    this.aiOverview = null;
    this.isLiveSource = false;
    this.selectedCategoryTab = 'all';
    this.liveSearchError = null;
  }

  getSavedSubTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-explore-subtab');
        if (s === 'ai' || s === 'search') return s;
      }
    } catch (_) {}
    return 'ai';
  }

  setSubTab(subTab) {
    if (this.activeSubTab === subTab) return;
    this.activeSubTab = subTab;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-explore-subtab', subTab);
      }
    } catch (_) {}
    this.render();
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.render();
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.empty();

    const wrap = this.containerEl.createDiv({ cls: 'tw-explore-container' });

    // 子页签切换器已迁入左侧主导航二级项 (见 build.py renderNavRail), 页面顶部不再占行;
    // 切换由工作台视图 setExploreSubTab → 本实例 setSubTab() 驱动, 状态仍持久化在 localStorage

    // Stage Body: dynamically renders AI Hub or Vendor Search View
    const stageBody = wrap.createDiv({ cls: 'tw-explore-stage-body' });

    if (this.activeSubTab === 'search') {
      this.renderSearchSubView(stageBody);
    } else {
      this.renderAiSubView(stageBody);
    }
  }

  /**
   * Render Sub-view 1: Full-screen Agent Hub
   */
  renderAiSubView(parentEl) {
    const aiWrap = parentEl.createDiv({ cls: 'tw-explore-ai-pane' });
    
    if (this.agentDrawer) {
      // Mount the agent drawer in full-width studio mode
      this.agentDrawer.mount(aiWrap);
      this.agentDrawer.isOpenState = true;
      if (this.agentDrawer.drawerEl) {
        this.agentDrawer.drawerEl.style.display = 'flex';
        this.agentDrawer.drawerEl.style.width = '100%';
        this.agentDrawer.drawerEl.classList.add('tw-studio-mode');
      }
      if (this.agentDrawer.resizerEl) {
        this.agentDrawer.resizerEl.style.display = 'none';
      }
      // Scroll messages to bottom
      if (this.agentDrawer.messagesEl) {
        this.agentDrawer.messagesEl.scrollTop = this.agentDrawer.messagesEl.scrollHeight;
      }
    } else {
      aiWrap.innerHTML = `
        <div class="tw-card" style="padding: 32px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🤖</div>
          <div>Agent Hub 正在初始化...</div>
        </div>
      `;
    }
  }

  /**
   * Render Sub-view 2: Chipset Vendor Resource Search
   */
  renderSearchSubView(parentEl) {
    const searchWrap = parentEl.createDiv({ cls: `tw-explore-search-pane tw-src-${this.activeSource}` });

    // 1. Search Toolbar (Source Switcher, Keyword Input, Action Buttons)
    this.renderSearchToolbar(searchWrap);

    // 2. Results Container
    const resultsContainer = searchWrap.createDiv({ cls: 'tw-vendor-results-container' });
    this.renderResultsList(resultsContainer);

    // 3. Auto-restore live search: if there's a keyword but no cached results
    //    (happens after plugin reload or tab switch), re-trigger live search
    if (this.searchKeyword && this.liveSearchResults.length === 0 && !this.isSearchingLive) {
      setTimeout(() => this.executeInSituSearch(), 100);
    }
  }

  /**
   * Render Search Toolbar
   */
  renderSearchToolbar(parentEl) {
    const toolbar = parentEl.createDiv({ cls: 'tw-vendor-search-toolbar' });

    // Search Input Row (搜索框 + 右侧平台字标 Tab)
    const inputRow = toolbar.createDiv({ cls: 'tw-vendor-input-row' });
    inputRow.innerHTML = `
      <div class="tw-vendor-input-wrap">
        <span class="tw-vendor-search-icon">${getIconPark('search', 16)}</span>
        <input type="text" class="tw-vendor-search-input" id="twVendorSearchInput"
          placeholder="在 MTK 与 展锐 中检索：输入关键字、芯片型号、FAQ / DCC 编号后回车 (如 FAQ33702, T820, USB, LCM)..."
          value="${escapeHtml(this.searchKeyword)}">
        ${this.searchKeyword ? '<button class="tw-search-clear-btn" id="twBtnClearVendorSearch">✕</button>' : ''}
      </div>
    `;

    // 右侧: MTK / 展锐 两个平台字标 Tab: 外框显色=是否选中(默认全选), 字标显色=官网联通是否正常
    const sourceTabs = inputRow.createDiv({ cls: 'tw-source-segmented-control' });
    const sources = [
      { id: 'mtk', label: 'MTK', icon: 'platform-mtk' },
      { id: 'unisoc', label: '展锐', icon: 'platform-unisoc' }
    ];

    this._sourceTabEls = {};
    for (const s of sources) {
      const btn = sourceTabs.createEl('button', {
        cls: `tw-source-tab-btn tw-source-tab--${s.id}`
      });
      btn.innerHTML = this.getSourceIcon(s.icon, 16);
      btn.dataset.conn = (this.portalStatus[s.id] || { ok: true }).ok ? 'up' : 'down';
      btn.title = this._sourceTabTitle(s);
      if (this.selectedSources.has(s.id)) btn.classList.add('selected');
      btn.onclick = () => {
        // 独立切换该平台选中态; 至少保留一个平台被选中
        if (this.selectedSources.has(s.id)) {
          if (this.selectedSources.size <= 1) return; // 不允许全部取消
          this.selectedSources.delete(s.id);
        } else {
          this.selectedSources.add(s.id);
        }
        this.activeSource = this.computeSourceFilter();
        this._syncSourceTabsUI();
        // Re-scope platform brand tint (tw-src-*) on the search pane
        const pane = toolbar.closest('.tw-explore-search-pane');
        if (pane) {
          pane.classList.remove('tw-src-all', 'tw-src-mtk', 'tw-src-unisoc');
          pane.classList.add(`tw-src-${this.activeSource}`);
        }
        if (this.searchKeyword) {
          this.executeInSituSearch();
        } else {
          this.refreshResults();
        }
      };
      this._sourceTabEls[s.id] = btn;
    }

    const input = inputRow.querySelector('#twVendorSearchInput');
    input.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value.trim();
      if (!this.searchKeyword) {
        this.liveSearchResults = [];
        this.aiOverview = null;
        this.selectedCategoryTab = 'all';
        this.refreshResults();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeInSituSearch();
      } else if (e.key === 'Escape') {
        this.searchKeyword = '';
        input.value = '';
        this.liveSearchResults = [];
        this.aiOverview = null;
        this.selectedCategoryTab = 'all';
        this.refreshResults();
      }
    });

    const clearBtn = inputRow.querySelector('#twBtnClearVendorSearch');
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.searchKeyword = '';
        input.value = '';
        this.liveSearchResults = [];
        this.aiOverview = null;
        this.selectedCategoryTab = 'all';
        this.refreshResults();
      };
    }

    // 分类胶囊插槽: 位于搜索工具栏外框内, 由结果渲染逻辑动态填充 (空时 CSS :empty 隐藏)
    toolbar.createDiv({ cls: 'tw-cat-tabs-slot' });

    // 检索通过输入框回车触发 (keydown Enter → executeInSituSearch), 不再放独立按钮
  }

  /**
   * Source tab icon: 官方平台字标 (MTK / 紫光展锐 UNISOC 官网 logo), 其余走 iconpark
   */
  getSourceIcon(iconName, size = 14) {
    if (iconName === 'platform-mtk') return getVendorPlatformSvg('mtk', size);
    if (iconName === 'platform-unisoc') return getVendorPlatformSvg('unisoc', size);
    return getIconPark(iconName, size);
  }

  /**
   * 分类胶囊显示文案: 中英混合分类只保留英文部分 (筛选值仍用原始 category, 不受影响)
   * 例: 'Porting Guide 移植指南' → 'Porting Guide'; 纯中文分类原样保留
   */
  _catTabLabel(cat) {
    const en = cat
      .replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/g, ' ')
      .replace(/[\s&·、,，-]+$/g, '')
      .replace(/^[\s&·、,，-]+/g, '')
      .trim();
    return en || cat;
  }

  /**
   * 由多选集合派生传给 vendorService 的 sourceFilter: 两个都选/异常回退='all', 仅一个=该平台 id
   * @returns {'all'|'mtk'|'unisoc'}
   */
  computeSourceFilter() {
    if (this.selectedSources && this.selectedSources.size === 1) {
      return this.selectedSources.has('mtk') ? 'mtk' : 'unisoc';
    }
    return 'all';
  }

  /**
   * 平台 Tab 悬停提示: 同时展示选中态与联通态
   */
  _sourceTabTitle(s) {
    const selected = this.selectedSources.has(s.id);
    const conn = this.portalStatus[s.id] || { ok: true, msg: '' };
    const link = conn.ok ? '联通正常' : ('联通异常' + (conn.msg ? '：' + conn.msg : ''));
    const act = selected ? '点击取消选择' : '点击选择该平台';
    return `${s.label} 资源网 · ${selected ? '已选中' : '未选中'} · ${link} · ${act}`;
  }

  /**
   * 同步两个平台 Tab 的选中类、联通 data-conn 与 title (选择切换 / 检索后联通刷新共用)
   */
  _syncSourceTabsUI() {
    const defs = [
      { id: 'mtk', label: 'MTK' },
      { id: 'unisoc', label: '展锐' }
    ];
    for (const s of defs) {
      const btn = this._sourceTabEls && this._sourceTabEls[s.id];
      if (!btn) continue;
      const conn = this.portalStatus[s.id] || { ok: true, msg: '' };
      btn.classList.toggle('selected', this.selectedSources.has(s.id));
      btn.dataset.conn = conn.ok ? 'up' : 'down';
      btn.title = this._sourceTabTitle({ id: s.id, label: s.label });
    }
  }

  /**
   * Execute in-situ search and return results/solutions directly onto the current search page
   * @param {string} [queryOverride]
   */
  async executeInSituSearch(queryOverride) {
    const input = this.containerEl?.querySelector('#twVendorSearchInput');
    const keyword = (queryOverride !== undefined ? queryOverride : (input ? input.value : this.searchKeyword)).trim();
    this.searchKeyword = keyword;

    if (!keyword) {
      this.liveSearchResults = [];
      this.aiOverview = null;
      this.isSearchingLive = false;
      this.selectedCategoryTab = 'all';
      this.refreshResults();
      return;
    }

    this.isSearchingLive = true;
    this.liveSearchError = null;
    this.selectedCategoryTab = 'all';
    this.expandedCardIds.clear(); // 检索完默认所有工单/资料卡片全部收起
    this.refreshResults();

    try {
      const res = await this.vendorService.searchResourcesLive(
        this.searchKeyword,
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      );

      this.liveSearchResults = res.hits || [];
      this.aiOverview = res.aiOverview || null;
      this.isLiveSource = Boolean(res.isLive);
      this.liveSearchError = res.error || null;

      // 刷新两个平台字标的联通显色 (portalStatus.ok=false → 字标置灰)
      if (res.portalStatus) {
        this.portalStatus = Object.assign({ mtk: { ok: true, msg: '' }, unisoc: { ok: true, msg: '' } }, res.portalStatus);
        this._syncSourceTabsUI();
      }

      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        const qText = keyword ? `「${keyword}」` : '芯片工程资源';
        const srcText = res.isLive ? '官网直连' : '本地知识库';
        new NoticeClass(`✓ 已从 ${srcText} 为您检索出 ${this.liveSearchResults.length} 条 ${qText} 方案`, 3000);
      }
    } catch (err) {
      console.error('Live search error:', err);
      this.liveSearchError = err.message || '官网检索连接异常';
      this.liveSearchResults = this.vendorService ? this.vendorService.searchResources(
        this.searchKeyword,
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      ) : [];
    } finally {
      this.isSearchingLive = false;
      this.refreshResults();
    }
  }

  /**
   * Execute real vendor official portal search in browser and update UI status
   * @param {string} [queryOverride]
   */
  async executeVendorSearch(queryOverride) {
    return this.executeInSituSearch(queryOverride);
  }

  /**
   * Refresh and re-render the search results container
   */
  refreshResults() {
    const container = this.containerEl?.querySelector('.tw-vendor-results-container');
    if (container) {
      container.empty();
      this.renderResultsList(container);
    }
  }

  /**
   * Render results list (including active official search card & local matched resources)
   */
  renderResultsList(containerEl) {
    if (!this.vendorService) return;

    // 1. If currently fetching from official portal API, render animated searching card
    if (this.isSearchingLive) {
      const portalName = this.activeSource === 'unisoc' ? '展锐 Uni-Support' : (this.activeSource === 'mtk' ? 'MTK Online' : '芯片官方门户');
      const searchingCard = containerEl.createDiv({ cls: 'tw-card tw-live-searching-card' });
      searchingCard.innerHTML = `
        <div class="tw-live-searching-inner">
          <div class="tw-searching-spinner"></div>
          <div class="tw-searching-text-wrap">
            <div class="tw-searching-title">
              <strong>正在连接 ${portalName} 官网抓取「${escapeHtml(this.searchKeyword)}」...</strong>
            </div>
            <div class="tw-searching-desc">
              已建立企业专线连接，正在实时请求原厂 SearchService 检索全库 FAQ、DCC 技术文档、移植指南与源码工单
            </div>
          </div>
        </div>
      `;
    }

    // 2. If there was a live search error (e.g. credentials missing or network issue)
    if (this.liveSearchError && !this.isSearchingLive) {
      const errCard = containerEl.createDiv({ cls: 'tw-card tw-live-error-card' });
      errCard.innerHTML = `
        <span class="tw-error-icon">⚠️</span>
        <div class="tw-error-content">
          <div class="tw-error-title">官网实时检索提示：${escapeHtml(this.liveSearchError)}</div>
          <div class="tw-error-desc">已自动为您回退呈现本地离线工程知识库中匹配的结果</div>
        </div>
        <div class="tw-error-actions" style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <button class="tw-error-action-btn" id="twBtnFixAccountConfig">
            ${getIconPark('lock', 12)} ${this.liveSearchError.includes('展锐') ? '🔑 手动更新 Token' : '🔒 配置原厂账号密码'}
          </button>
          <button class="tw-error-action-btn tw-btn-companion-guide" id="twBtnOpenCompanionGuide" style="background: linear-gradient(135deg, #10B981, #059669); color: #FFFFFF; border: none; font-weight: 600; box-shadow: 0 2px 6px rgba(16,185,129,0.3);" title="打开 Chrome/Edge 扩展伴侣一键同步指引">
            ⚡ 浏览器伴侣一键同步
          </button>
        </div>
      `;
      const btn = errCard.querySelector('#twBtnFixAccountConfig');
      if (btn) btn.onclick = () => this.openAccountModal();
      const compBtn = errCard.querySelector('#twBtnOpenCompanionGuide');
      if (compBtn) compBtn.onclick = () => this.openCompanionGuideModal();
    }

    // 3. Official AI Overview banner (MediaTek Online style)
    if (this.aiOverview && !this.isSearchingLive) {
      const o = this.aiOverview;
      const aiCard = containerEl.createDiv({ cls: 'tw-card tw-ai-overview-card' });
      aiCard.innerHTML = `
        <div class="tw-ai-header">
          <div class="tw-ai-badge">
            <span class="tw-ai-sparkle">✨</span>
            <span class="tw-ai-badge-text">${(this.activeSource === 'unisoc' || o.portalId === 'unisoc' || /unisoc|展锐|dcc|t820|t760|t616/i.test(o.title || '')) ? '展锐 Uni-Support · 官方 AI Overview 智能速览' : 'MediaTek Online · 官方 AI Overview 智能速览'}</span>
          </div>
          <div class="tw-ai-actions">
            <button class="tw-ai-copy-btn" id="twBtnCopyAiOverview">
              ${getIconPark('copy', 12)} 复制速览
            </button>
            <button class="tw-ai-send-btn" id="twBtnSendAiToAgent">
              ${getIconPark('robot', 12)} 发送至 AI 对话
            </button>
          </div>
        </div>
        <div class="tw-ai-title">${escapeHtml(o.title)}</div>
        <div class="tw-ai-summary">${escapeHtml(o.summary)}</div>
        ${Array.isArray(o.steps) && o.steps.length > 0 ? `
          <div class="tw-ai-steps-section">
            <div class="tw-ai-steps-title">📌 原厂推荐排障步骤：</div>
            <ol class="tw-ai-steps-list">
              ${o.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ol>
          </div>
        ` : ''}
        ${o.tips ? `
          <div class="tw-ai-tips-box">
            <strong>💡 核心提示：</strong>${escapeHtml(o.tips)}
          </div>
        ` : ''}
      `;

      const copyAiBtn = aiCard.querySelector('#twBtnCopyAiOverview');
      if (copyAiBtn) {
        copyAiBtn.onclick = async () => {
          const text = `【AI 速览】${o.title}\n${o.summary}\n\n排查步骤：\n` +
            (o.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n') +
            (o.tips ? `\n\n核心提示：${o.tips}` : '');
          await navigator.clipboard.writeText(text);
          const old = copyAiBtn.innerHTML;
          copyAiBtn.innerHTML = `${getIconPark('check', 12)} 已复制`;
          setTimeout(() => { copyAiBtn.innerHTML = old; }, 2000);
          const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
          if (NoticeClass) new NoticeClass('✓ 已复制 AI Overview 速览内容到剪贴板', 2000);
        };
      }

      const sendAiBtn = aiCard.querySelector('#twBtnSendAiToAgent');
      if (sendAiBtn) {
        sendAiBtn.onclick = () => {
          const prompt = `请针对以下原厂 AI Overview 与技术方案提供深入分析和实施方案：\n` +
            `【标题】：${o.title}\n` +
            `【概述】：${o.summary}\n` +
            `【步骤】：\n` + (o.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n') +
            (o.tips ? `\n【提示】：${o.tips}` : '') +
            `\n\n请帮我补充相关代码示例、DTS 修改细节和在实际工程调试中的注意要点！`;
          this.sendPromptToAi(prompt, o.title);
        };
      }
    }

    // 4. Source of results
    let results = [];
    if (this.liveSearchResults && this.liveSearchResults.length > 0) {
      results = this.liveSearchResults;
    } else if (!this.searchKeyword) {
      results = this.vendorService.searchResources(
        '',
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      );
    } else {
      results = this.vendorService.searchResources(
        this.searchKeyword,
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      );
    }

    // 5. Category Tab Pills (渲染到搜索框外框内的插槽; 无"全部"选项, 再次点击已选分类即取消筛选)
    const catSlot = this.containerEl?.querySelector('.tw-cat-tabs-slot');
    if (catSlot) catSlot.empty();
    if (results.length > 0 && catSlot) {
      const catCounts = { all: results.length };
      for (const r of results) {
        const cat = r.category || '其它';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }

      const distinctCats = Object.keys(catCounts).filter(k => k !== 'all');
      if (distinctCats.length > 1) {
        const catBar = catSlot.createDiv({ cls: 'tw-results-cat-tabs-bar' });

        for (const cat of distinctCats) {
          const btn = catBar.createEl('button', {
            cls: `tw-cat-tab-pill ${this.selectedCategoryTab === cat ? 'active' : ''}`
          });
          btn.innerHTML = `<span>${escapeHtml(this._catTabLabel(cat))}</span><span class="tw-cat-count-badge">${catCounts[cat]}</span>`;
          btn.title = cat;
          btn.onclick = () => {
            // 再次点击已激活分类 → 取消筛选 (等效"全部")
            this.selectedCategoryTab = this.selectedCategoryTab === cat ? 'all' : cat;
            this.refreshResults();
          };
        }
      }
    }

    // Filter displayed results by category tab
    let displayedResults = results;
    if (this.selectedCategoryTab !== 'all') {
      displayedResults = results.filter(r => r.category === this.selectedCategoryTab || r.categoryType === this.selectedCategoryTab);
    }

    // Count bar
    const countBar = containerEl.createDiv({ cls: 'tw-results-count-bar' });
    const isLive = this.isLiveSource || (results.length > 0 && results[0].isOfficialLive);
    countBar.innerHTML = `
      <span>共检索到 <strong>${displayedResults.length}</strong> 条相关芯片技术资源</span>
      ${isLive ? '<span class="tw-live-badge"><span class="tw-live-dot"></span>官网实时直连</span>' : ''}
      ${this.searchKeyword ? `<span class="tw-keyword-badge">关键词: "${escapeHtml(this.searchKeyword)}"</span>` : ''}
    `;

    // If no results
    if (displayedResults.length === 0 && !this.isSearchingLive) {
      const emptyCard = containerEl.createDiv({ cls: 'tw-card tw-vendor-empty-card' });
      emptyCard.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">未检索到匹配的技术资料</div>
        <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 16px; max-width: 520px; line-height: 1.6;">
          您可以尝试调整检索关键词，或直接让 AI 为您出具完整的软硬件开发调试方案：
        </div>
        <div class="tw-empty-actions-row">
          <button class="tw-btn-ai-gen" id="twBtnAiGenerateDoc">
            ${getIconPark('robot', 13)} 让 AI 针对「${escapeHtml(this.searchKeyword || '芯片驱动调试')}」出具技术方案
          </button>
        </div>
      `;
      emptyCard.querySelector('#twBtnAiGenerateDoc').onclick = () => {
        this.sendPromptToAi(`请针对芯片平台技术问题「${this.searchKeyword || '常见驱动与外设调试'}」，帮我提供原厂级开发与调试参考指南，包括常见寄存器配置、DTS 修改要点和故障排除步骤。`, this.searchKeyword);
      };
      return;
    }

    const listWrap = containerEl.createDiv({ cls: 'tw-vendor-cards-list' });

    for (const res of displayedResults) {
      const card = listWrap.createDiv({ cls: `tw-card tw-vendor-doc-card ${res.portalId}` });
      const isExpanded = this.expandedCardIds.has(res.id);

      const isMtk = res.portalId === 'mtk';
      const isEserviceCase = res.categoryType === 'eservice_case' || res.categoryType === 'eservice';
      const portalBadge = isEserviceCase
        ? `<span class="tw-vendor-badge mtk-eservice">${getIconPark('ticket', 12)} MTK eService</span>`
        : isMtk
          ? `<span class="tw-vendor-badge mtk">${getIconPark('cpu', 12)} MTK Online</span>`
          : `<span class="tw-vendor-badge unisoc">${getIconPark('network', 12)} 展锐 Uni-Support</span>`;

      const liveBadge = res.isOfficialLive
        ? `<span class="tw-live-badge"><span class="tw-live-dot"></span>官网实时</span>`
        : '';

      const platforms = Array.isArray(res.platforms) ? res.platforms : [];
      const branches = Array.isArray(res.branches) ? res.branches : [];

      // Finder Name + Date row for header right side
      const finderDateHtml = isEserviceCase
        ? `<div class="tw-vcard-finder-date">
            ${res.finderName ? `<span class="tw-vcard-finder"><span class="tw-finder-icon">👤</span>${escapeHtml(res.finderName)}</span>` : ''}
            ${res.updated ? `<span class="tw-vcard-date">${escapeHtml(res.updated)}</span>` : ''}
          </div>`
        : `<div class="tw-vcard-date">${escapeHtml(res.updated || '')}</div>`;

      card.innerHTML = `
        <div class="tw-vcard-header">
          <div class="tw-vcard-meta">
            ${portalBadge}
            ${liveBadge}
            <span class="tw-chipset-tag">${escapeHtml(res.chipset)}</span>
            <span class="tw-category-tag">${escapeHtml(res.category)}</span>
            <span class="tw-vcard-docid">${escapeHtml(res.docId || '')}</span>
            ${isEserviceCase && res.caseStatus ? `<span class="tw-eservice-case-status-tag">${escapeHtml(res.caseStatus)}</span>` : ''}
          </div>
          ${finderDateHtml}
        </div>

        <div class="tw-vcard-title">${escapeHtml(res.title)}</div>

        ${platforms.length > 0 ? `
          <div class="tw-platform-pills-row">
            <span style="font-size: 10px; color: var(--text-muted); margin-right: 2px;">ƽ̨:</span>
            ${platforms.slice(0, 6).map(p => `<span class="tw-platform-pill">${escapeHtml(p)}</span>`).join('')}
            ${platforms.length > 6 ? `<span style="font-size: 10px; color: var(--text-muted);">+${platforms.length - 6}</span>` : ''}
          </div>
        ` : ''}

        <div class="tw-vcard-summary">${escapeHtml(res.summary)}</div>

        ${branches.length > 0 ? `
          <div class="tw-platform-pills-row" style="margin-top: 2px;">
            <span style="font-size: 10px; color: var(--text-muted); margin-right: 2px;">分支:</span>
            ${branches.slice(0, 4).map(b => `<span class="tw-branch-pill">${escapeHtml(b)}</span>`).join('')}
          </div>
        ` : ''}

        ${isExpanded && (res.detailedContentHtml || res.detailedContent) ? `
          <div class="tw-vcard-full-solution">
            <div class="tw-solution-header">
              <span class="tw-solution-badge">📋 原厂技术方案与实战排障指南</span>
              <button class="tw-solution-copy-btn" id="twBtnCopySolution-${res.id}">
                ${getIconPark('copy', 12)} 复制全部方案
              </button>
            </div>
            <div class="tw-solution-body">
              ${formatMarkdownToHtml(res.detailedContentHtml || res.detailedContent)}
            </div>
          </div>
        ` : ''}

          <div class="tw-vcard-footer">
          <div class="tw-vcard-tags">
            ${(res.tags || []).map(t => `<span class="tw-vcard-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="tw-vcard-actions">
            ${(res.detailedContent || res.detailedContentHtml ||
               (res.categoryType === 'faq' && res.docId) ||
               ((res.categoryType === 'eservice_case' || res.categoryType === 'eservice') && res.docId)) ? `
              <button class="tw-vcard-btn-expand ${isExpanded ? 'active' : ''}">
                ${isExpanded ? getIconPark('up', 13) + ' 收起工单' : getIconPark('down', 13) + ' 展开/查看工单'}
              </button>
            ` : ''}
            <button class="tw-vcard-btn-save-note" title="将此原厂技术文档保存为当前 Obsidian 库笔记">
              ${getIconPark('bookmark', 13)} 保存为笔记
            </button>
            <button class="tw-vcard-btn-ai">
              ${getIconPark('robot', 13)} <strong>AI 深度分析</strong>
            </button>
            <button class="tw-vcard-btn-open" data-url="${res.url}" title="在新窗口访问官方原帖 (备用)">
              ${getIconPark('external', 13)} 原帖 ↗
            </button>
            <button class="tw-vcard-btn-copy" data-title="${escapeHtml(res.title)}" data-url="${res.url}">
              ${getIconPark('copy', 13)} 复制引用
            </button>
          </div>
        </div>
      `;

      const expandBtn = card.querySelector('.tw-vcard-btn-expand');
      if (expandBtn) {
        expandBtn.onclick = async () => {
          if (this.expandedCardIds.has(res.id)) {
            this.expandedCardIds.delete(res.id);
            this.refreshResults();
          } else {
            // --- eService CR 工单按需加载 ---
            if (!res.detailedContent && !res.detailedContentHtml &&
                (res.categoryType === 'eservice_case' || res.categoryType === 'eservice') &&
                res.docId) {
              expandBtn.innerHTML = `<span>⏳ 加载 eService 工单详情...</span>`;
              try {
                const detail = await this.vendorService.fetchMtkEserviceCaseDetail(res.docId, null, res.url || '', res.summary || '');
                if (detail && !detail._debugOnly) {
                  res.detailedContentHtml = detail.contentHtml;
                  res.detailedContent = [
                    detail.description ? `【问题描述】\n${detail.description}` : '',
                    detail.solution ? `\n\n【解决方案】\n${detail.solution}` : ''
                  ].filter(Boolean).join('') || detail.contentHtml;
                  res.detailedContentMarkdown = res.detailedContent;
                  if (detail.finderName && !res.finderName) res.finderName = detail.finderName;
                  if (detail.status && !res.caseStatus) res.caseStatus = detail.status;
                } else {
                  // Build inline debug table so user can see exactly what happened
                  const debugRows = detail && detail.debugLog
                    ? detail.debugLog.map(d => `
                        <tr>
                          <td style="font-family:monospace;font-size:10px;padding:2px 6px;color:var(--text-muted);white-space:nowrap;">${escapeHtml(d.label)}</td>
                          <td style="font-size:10px;padding:2px 6px;font-weight:600;color:${d.status === 200 ? '#059669' : d.status === 'ERR' ? '#EF4444' : '#D97706'};">${d.status}</td>
                          <td style="font-family:monospace;font-size:10px;padding:2px 6px;color:var(--text-muted);max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(d.preview)}">${escapeHtml(d.preview.slice(0, 80))}</td>
                        </tr>`).join('')
                    : '<tr><td colspan="3" style="font-size:10px;color:var(--text-muted);padding:4px 6px;">无调试信息</td></tr>';
                  res.detailedContentHtml = `
                    <div class="tw-eservice-section">
                      <div class="tw-eservice-section-title">🔍 接口探测结果（接入调试）</div>
                      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
                        caseId: <code>${escapeHtml(res.docId)}</code> &nbsp;|&nbsp;
                        isMtoEservice: <code>${detail && detail.isMtoEservice ? 'true' : 'false'}</code>
                      </div>
                      <table style="width:100%;border-collapse:collapse;font-size:10px;">
                        <thead><tr>
                          <th style="text-align:left;padding:2px 6px;font-size:10px;color:var(--text-muted);border-bottom:1px solid var(--background-modifier-border);">接口端点</th>
                          <th style="text-align:left;padding:2px 6px;border-bottom:1px solid var(--background-modifier-border);">状态</th>
                          <th style="text-align:left;padding:2px 6px;border-bottom:1px solid var(--background-modifier-border);">响应预览</th>
                        </tr></thead>
                        <tbody>${debugRows}</tbody>
                      </table>
                      <div style="margin-top:10px;">
                        <a href="${res.url}" target="_blank" style="color:#3B82F6;font-size:11px;">在浏览器中打开工单 ↗</a>
                        &nbsp;（请将上方表格截图发给 AI，帮助确认正确接口路径）
                      </div>
                    </div>`;
                  res.detailedContent = res.detailedContentHtml;
                }
              } catch (err) {
                console.warn('Failed to load eService case detail on demand:', err);
              }
            }
            // --- FAQ 按需加载（原有逻辑保留）---
            else if (!res.detailedContent && !res.detailedContentHtml && res.categoryType === 'faq' && (res.faqInternalId || res.docId)) {
              expandBtn.innerHTML = `<span>⏳ 加载原厂完整方案...</span>`;
              try {
                if (res.portalId === 'unisoc') {
                  const idToFetch = res.faqInternalId || String(res.docId).replace(/^FAQ/i, '');
                  const detail = await this.vendorService.fetchUnisocFaqDetail(idToFetch);
                  if (detail) {
                    const qText = detail.question || '';
                    const contentHtml = detail.content || detail.answer || '';
                    res.detailedContentHtml = (qText ? `<div class="tw-faq-question-box" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(37,99,235,0.06); border-radius: 6px; border-left: 3px solid #2563EB;"><strong>【原厂提问与工程现场】：</strong><p style="margin: 4px 0 0 0;">${escapeHtml(qText)}</p></div>` : '') +
                      `<div class="tw-faq-answer-box"><strong>【官方技术解答与排障源码】：</strong>\n${contentHtml}</div>`;
                    res.detailedContent = (qText ? `【问题描述】\n${qText}\n\n` : '') + `【官方解答】\n` + (detail.content || detail.answer || '');
                    res.detailedContentMarkdown = (qText ? `### 问题描述\n${qText}\n\n### 官方解答\n` : '') + this.vendorService.convertHtmlToMarkdown(contentHtml);
                  }
                } else {
                  const detail = await this.vendorService.fetchMtkFaqDetail(res.docId, 'SW');
                  if (detail && detail.content) {
                    res.detailedContentHtml = detail.content;
                    res.detailedContent = detail.content;
                    res.detailedContentMarkdown = this.vendorService.convertHtmlToMarkdown(detail.content);
                  }
                }
              } catch (err) {
                console.warn('Failed to load FAQ detail on demand:', err);
              }
            }
            this.expandedCardIds.add(res.id);
            this.refreshResults();
          }
        };
      }

      const saveNoteBtn = card.querySelector('.tw-vcard-btn-save-note');
      if (saveNoteBtn) {
        saveNoteBtn.onclick = async () => {
          const originalHtml = saveNoteBtn.innerHTML;
          saveNoteBtn.innerHTML = `${getIconPark('refresh', 13)} 保存中...`;
          saveNoteBtn.disabled = true;
          try {
            await this.saveResourceAsVaultNote(res);
            saveNoteBtn.innerHTML = `${getIconPark('check', 13)} 已保存`;
            setTimeout(() => {
              saveNoteBtn.innerHTML = originalHtml;
              saveNoteBtn.disabled = false;
            }, 2500);
          } catch (e) {
            saveNoteBtn.innerHTML = originalHtml;
            saveNoteBtn.disabled = false;
          }
        };
      }

      const copySolutionBtn = card.querySelector(`#twBtnCopySolution-${res.id}`);
      if (copySolutionBtn) {
        copySolutionBtn.onclick = async () => {
          const textToCopy = res.detailedContentMarkdown
            || (this.vendorService ? this.vendorService.convertHtmlToMarkdown(res.detailedContentHtml || res.detailedContent) : '')
            || res.detailedContent
            || res.summary;
          await navigator.clipboard.writeText(textToCopy);
          const old = copySolutionBtn.innerHTML;
          copySolutionBtn.innerHTML = `${getIconPark('check', 12)} 已复制`;
          setTimeout(() => { copySolutionBtn.innerHTML = old; }, 2000);
          const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
          if (NoticeClass) new NoticeClass('✓ 已复制技术文档与完整方案代码', 2500);
        };
      }

      // Enable interactive copy buttons on individual code blocks
      card.querySelectorAll('.tw-code-copy-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const wrap = btn.closest('.tw-code-block-wrap');
          const codeEl = wrap ? wrap.querySelector('code') : null;
          if (codeEl) {
            await navigator.clipboard.writeText(codeEl.innerText);
            btn.innerHTML = getIconPark('check', 13, { color: '#10B981' });
            btn.setAttribute('title', '已复制!');
            setTimeout(() => {
              btn.innerHTML = getIconPark('copy', 13);
              btn.setAttribute('title', '复制代码');
            }, 1800);
          }
        };
      });

      card.querySelector('.tw-vcard-btn-ai').onclick = () => {
        this.handleSendDocToAi(res);
      };

      card.querySelector('.tw-vcard-btn-open').onclick = () => {
        window.open(res.url, '_blank');
      };

      card.querySelector('.tw-vcard-btn-copy').onclick = (e) => {
        const btn = e.currentTarget;
        const text = `[${res.title}](${res.url})`;
        navigator.clipboard.writeText(text);
        const oldText = btn.innerHTML;
        btn.innerHTML = `${getIconPark('check', 13)} 已复制`;
        setTimeout(() => { btn.innerHTML = oldText; }, 1800);
      };
    }
  }


  /**
   * Save vendor document as a markdown note in the Obsidian vault (00-Inbox)
   * @param {object} res
   */
  async saveResourceAsVaultNote(res) {
    const vault = this.app?.vault;
    if (!vault) return;

    // 按需自动补全未展开获取的详情内容，确保保存的笔记包含完整排障源码和方案
    if (!res.detailedContent && !res.detailedContentHtml) {
      if ((res.categoryType === 'eservice_case' || res.categoryType === 'eservice') && res.docId) {
        try {
          const detail = await this.vendorService?.fetchMtkEserviceCaseDetail(res.docId, null, res.url || '', res.summary || '');
          if (detail && !detail._debugOnly) {
            res.detailedContentHtml = detail.contentHtml;
            res.detailedContent = [
              detail.description ? `【问题描述】\n${detail.description}` : '',
              detail.solution ? `\n\n【解决方案】\n${detail.solution}` : ''
            ].filter(Boolean).join('') || detail.contentHtml;
            res.detailedContentMarkdown = res.detailedContent;
            if (detail.finderName && !res.finderName) res.finderName = detail.finderName;
            if (detail.status && !res.caseStatus) res.caseStatus = detail.status;
          }
        } catch (err) {
          console.warn('Auto fetch eService case detail before saving note failed:', err);
        }
      } else if (res.categoryType === 'faq' && (res.faqInternalId || res.docId)) {
        try {
          if (res.portalId === 'unisoc') {
            const idToFetch = res.faqInternalId || String(res.docId).replace(/^FAQ/i, '');
            const detail = await this.vendorService?.fetchUnisocFaqDetail(idToFetch);
            if (detail) {
              const qText = detail.question || '';
              const contentHtml = detail.content || detail.answer || '';
              res.detailedContentHtml = (qText ? `<div class="tw-faq-question-box" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(37,99,235,0.06); border-radius: 6px; border-left: 3px solid #2563EB;"><strong>【原厂提问与工程现场】：</strong><p style="margin: 4px 0 0 0;">${escapeHtml(qText)}</p></div>` : '') +
                `<div class="tw-faq-answer-box"><strong>【官方技术解答与排障源码】：</strong>\n${contentHtml}</div>`;
              res.detailedContent = (qText ? `【问题描述】\n${qText}\n\n` : '') + `【官方解答】\n` + (detail.content || detail.answer || '');
              res.detailedContentMarkdown = (qText ? `### 问题描述\n${qText}\n\n### 官方解答\n` : '') + (this.vendorService ? this.vendorService.convertHtmlToMarkdown(contentHtml) : contentHtml);
            }
          } else {
            const detail = await this.vendorService?.fetchMtkFaqDetail(res.docId, 'SW');
            if (detail && detail.content) {
              res.detailedContentHtml = detail.content;
              res.detailedContent = detail.content;
              res.detailedContentMarkdown = this.vendorService ? this.vendorService.convertHtmlToMarkdown(detail.content) : detail.content;
            }
          }
        } catch (err) {
          console.warn('Auto fetch FAQ detail before saving note failed:', err);
        }
      }
    }

    const portalIdUpper = (res.portalId || 'VENDOR').toUpperCase();
    const safeDocId = (res.docId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTitle = (res.title || 'Untitled')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    let fileBasename = '';
    if (safeDocId && cleanTitle.toLowerCase().includes(safeDocId.toLowerCase())) {
      fileBasename = `[${portalIdUpper}] ${cleanTitle}`;
    } else if (safeDocId) {
      fileBasename = `[${portalIdUpper}] [${safeDocId}] ${cleanTitle}`;
    } else {
      fileBasename = `[${portalIdUpper}] ${cleanTitle}`;
    }
    if (fileBasename.length > 80) {
      fileBasename = fileBasename.slice(0, 80).trim();
    }

    const folderPath = '00-Inbox';
    const filePath = `${folderPath}/${fileBasename}.md`;

    const solutionMarkdown = res.detailedContentMarkdown
      || (this.vendorService ? this.vendorService.convertHtmlToMarkdown(res.detailedContentHtml || res.detailedContent) : '')
      || (res.detailedContent ? res.detailedContent : '');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cleanDocTitle = (res.title || '').replace(/"/g, '\\"');
    const portalTag = (res.portalId || 'vendor').toLowerCase();

    const noteContent = `---
title: "${cleanDocTitle}"
date: "${dateStr}"
updated: "${res.updated || dateStr}"
platform: [${portalIdUpper}]
chip: [${res.chipset ? `"${res.chipset}"` : ''}]
doctype: REF
status: inbox
source: vendor
vendor: "${res.portalName || portalIdUpper}"
docId: "${res.docId || ''}"
url: "${res.url || ''}"
tags:
  - "#platform/${portalTag}"
  - "#type/vendor-doc"
  - "#stage/inbox"
owner: human
---

# ${res.title}

> **供应商**: ${res.portalName || portalIdUpper} | **芯片平台**: ${res.chipset || portalIdUpper} | **文档编号**: \`${res.docId || '无'}\`
> **官方原帖**: [${res.url || '无'}](${res.url || '#'})

## 摘要说明
${res.summary || '（无摘要）'}

${solutionMarkdown ? `## 官方解答与方案详情\n\n${solutionMarkdown}\n` : ''}
`;

    try {
      const parts = folderPath.split('/');
      let cur = '';
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        if (!vault.getAbstractFileByPath(cur)) {
          await vault.createFolder(cur);
        }
      }

      const existing = vault.getAbstractFileByPath(filePath);
      if (existing) {
        await vault.modify(existing, noteContent);
      } else {
        await vault.create(filePath, noteContent);
      }

      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        new NoticeClass(`✓ 已成功保存至 00-Inbox：${filePath}`, 4000);
      }
    } catch (err) {
      console.error('Failed to save vault note', err);
      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        new NoticeClass(`保存笔记失败: ${err.message}`, 3000);
      }
    }
  }

  /**
   * Cross-subtab Coordination: Send document context to Agent Hub and switch to AI subtab
   */
  handleSendDocToAi(doc) {
    const prompt = `请帮我深度解读此芯片原厂技术文档并给出研发方案建议：
- 供应商: ${doc.portalName}
- 芯片型号: ${doc.chipset}
- 文档编号: ${doc.docId || '未标明'}
- 资料名称: ${doc.title}
- 官方链接: ${doc.url}
- 核心内容摘要:
> ${doc.summary}

请结合实际工程开发经验，针对该技术方案在驱动移植、DTS 设备树配置、内核代码实现与排障防抖动注意事项提供详细的解答与操作代码！`;

    this.sendPromptToAi(prompt, doc.title);
  }

  /**
   * Switch to AI subtab and deliver prompt
   */
  sendPromptToAi(promptText, docTitle = '') {
    // 1. Switch subtab to AI
    this.setSubTab('ai');

    // 2. Deliver prompt to agentDrawer input
    setTimeout(() => {
      if (this.agentDrawer) {
        if (typeof this.agentDrawer.setInputValue === 'function') {
          this.agentDrawer.setInputValue(promptText, true);
        } else if (this.agentDrawer.inputEl) {
          this.agentDrawer.inputEl.value = promptText;
          this.agentDrawer.inputEl.focus();
          this.agentDrawer.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          if (typeof this.agentDrawer.updateSendButtonState === 'function') {
            this.agentDrawer.updateSendButtonState();
          }
          if (typeof this.agentDrawer.adjustInputHeight === 'function') {
            this.agentDrawer.adjustInputHeight();
          } else if (typeof this.agentDrawer.autoResizeInput === 'function') {
            this.agentDrawer.autoResizeInput();
          }
        }
        const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
        if (NoticeClass) {
          new NoticeClass(docTitle ? `✓ 已将「${docTitle}」技术上下文注入 AI 研发助手` : '✓ 已载入芯片研发指令，按 Enter 即可让 AI 深度解析', 4000);
        }
      }
    }, 150);
  }

  /**
   * Open Account Configuration Modal
   */
  async openAccountModal() {
    if (this.isAccountModalOpen) return;
    this.isAccountModalOpen = true;

    const portals = this.vendorService ? this.vendorService.getPortalsConfig() : {};
    const mtkPass = (await this.vendorService?.getCredential(portals.mtk?.secretName)) || '';
    const mtkUser = portals.mtk?.username || '';

    const unisocPass = (await this.vendorService?.getCredential(portals.unisoc?.secretName)) || '';
    const unisocUser = portals.unisoc?.username || '';

    const overlay = document.createElement('div');
    overlay.className = 'tw-modal-overlay';
    overlay.innerHTML = `
      <div class="tw-modal-card">
        <div class="tw-modal-header">
          <div class="tw-modal-title">
            <span style="font-size: 18px;">🔑</span>
            <span>芯片供应商资源网账号密码配置</span>
          </div>
          <button class="tw-modal-close" id="twBtnCloseModal">✕</button>
        </div>

        <div class="tw-modal-body">
          <div class="tw-modal-desc">
            账号密码安全存储在当前 Obsidian 隔离凭据中，绝不写入代码日志或公开笔记。录入后在检索与直达原厂门户时将自动保持登录态。
          </div>

          <!-- MTK Online Account -->
          <div class="tw-account-section">
            <div class="tw-account-sec-title">
              <span class="tw-portal-dot mtk"></span>
              <strong>MTK 资源网 (MediaTek Online)</strong>
              <span class="tw-sec-url">https://online.mediatek.com/</span>
            </div>
            <div class="tw-form-row">
              <label>企业账号 / 邮箱:</label>
              <input type="text" id="twInputMtkUser" class="tw-modal-input" placeholder="如 user@mediatek-client.com" value="${escapeHtml(mtkUser)}">
            </div>
            <div class="tw-form-row">
              <label>登录密码:</label>
              <div class="tw-pwd-wrap">
                <input type="password" id="twInputMtkPass" class="tw-modal-input" placeholder="输入密码或企业凭据" value="${escapeHtml(mtkPass)}">
                <button type="button" class="tw-pwd-toggle" data-target="twInputMtkPass">👁️</button>
              </div>
            </div>
          </div>

          <!-- Unisoc Uni-Support Account (DCC & FAQ) -->
          <div class="tw-account-section" style="margin-top: 16px;">
            <div class="tw-account-sec-title">
              <span class="tw-portal-dot unisoc"></span>
              <strong>展锐资源网 (Uni-Support: DCC & FAQ)</strong>
              <span class="tw-sec-url">https://unisupport.unisoc.com/dcc & /faq</span>
            </div>
            <div class="tw-form-row">
              <label>登录账号 / Email (可选):</label>
              <input type="text" id="twInputUnisocUser" class="tw-modal-input" placeholder="如 zengxinge@cooseagroup.com" value="${escapeHtml(unisocUser)}">
            </div>
            <div class="tw-form-row">
              <label>会话凭据 Token / Cookie (必填，用于直连):</label>
              <div class="tw-pwd-wrap">
                <input type="password" id="twInputUnisocPass" class="tw-modal-input" placeholder="粘贴 unisupport-cutomer-token 或完整 Cookie" value="${escapeHtml(unisocPass)}">
                <button type="button" class="tw-pwd-toggle" data-target="twInputUnisocPass">👁️</button>
              </div>
            </div>
            <div class="tw-token-test-row">
              <button type="button" class="tw-test-conn-btn" id="twBtnTestUnisocConn">⚡ 测试连接</button>
              <span id="twUnisocConnStatus" class="tw-conn-test-status"></span>
            </div>

            <!-- Token Extraction Guide -->
            <div class="tw-token-guide-box">
              <div class="tw-token-companion-recommend" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div>
                  <div style="font-weight: 600; color: #10B981; font-size: 13px; margin-bottom: 2px;">⚡ 极速同步（推荐）：TabonKB 浏览器伴侣扩展</div>
                  <div style="font-size: 11px; color: var(--text-muted, #94A3B8);">在 Edge / Chrome 加载伴侣扩展后，展锐官网右下角点击「一键同步」即可秒级更新凭据，告别手动复制！</div>
                </div>
                <button type="button" class="tw-btn-open-ext-guide" id="twBtnExtGuideFromAccount" style="padding: 5px 10px; font-size: 12px; background: #10B981; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; font-weight: 600;">
                  🧩 查看伴侣指引
                </button>
              </div>

              <div class="tw-token-guide-title">📌 其他手动获取展锐 Token / Cookie 方法（任选一种）：</div>
              <ol class="tw-token-guide-list">
                <li><strong>方法 1（控制台一键命令）</strong>：在已登录展锐的浏览器页面按 <code>F12</code> 打开控制台 (Console)，粘贴运行下方命令回车即可自动复制：
                  <div class="tw-copy-cmd-row">
                    <code>copy((document.cookie.match(/unisupport-cutomer-token=([^;]+)/) || [])[1] || document.cookie)</code>
                    <button type="button" class="tw-copy-cmd-btn" id="twBtnCopyConsoleCmd">复制命令</button>
                  </div>
                </li>
                <li><strong>方法 2（应用/Application）</strong>：按 F12 切换到 <code>Application (应用)</code> 标签页 -> 左侧 <code>Cookies</code> -> 点击 <code>unisoc.com</code> -> 复制 <code>unisupport-cutomer-token</code> 的值。</li>
                <li><strong>方法 3（网络/Network）</strong>：按 F12 切换到 <code>Network (网络)</code> 标签页，在页面点一下查询，点击任一请求，在 <code>Request Headers (请求标头)</code> 中复制 <code>authorization</code> 或整个 <code>cookie</code> 粘贴即可！</li>
              </ol>
            </div>
          </div>
        </div>

        <div class="tw-modal-footer">
          <button class="tw-modal-btn-cancel" id="twBtnCancelModal">取消</button>
          <button class="tw-modal-btn-save" id="twBtnSaveModal">💾 保存凭据配置</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      this.isAccountModalOpen = false;
      overlay.remove();
    };

    overlay.querySelector('#twBtnCloseModal').onclick = closeModal;
    overlay.querySelector('#twBtnCancelModal').onclick = closeModal;

    // Test Unisoc Connection
    const testBtn = overlay.querySelector('#twBtnTestUnisocConn');
    const statusEl = overlay.querySelector('#twUnisocConnStatus');
    if (testBtn && statusEl) {
      testBtn.onclick = async () => {
        const val = overlay.querySelector('#twInputUnisocPass')?.value || '';
        if (!val.trim()) {
          statusEl.textContent = '❌ 请先输入或粘贴 Token / Cookie';
          statusEl.className = 'tw-conn-test-status error';
          return;
        }
        statusEl.textContent = '⏳ 正在探测展锐 DCC / FAQ 接口...';
        statusEl.className = 'tw-conn-test-status testing';
        testBtn.disabled = true;
        try {
          const res = await this.vendorService?.testUnisocConnection(val);
          if (res && res.ok) {
            statusEl.textContent = '🟢 ' + res.msg;
            statusEl.className = 'tw-conn-test-status success';
          } else {
            statusEl.textContent = '🔴 ' + (res?.msg || '连接失败');
            statusEl.className = 'tw-conn-test-status error';
          }
        } catch (err) {
          statusEl.textContent = '🔴 探测异常: ' + err.message;
          statusEl.className = 'tw-conn-test-status error';
        } finally {
          testBtn.disabled = false;
        }
      };
    }

    // Copy Console command
    const copyCmdBtn = overlay.querySelector('#twBtnCopyConsoleCmd');
    if (copyCmdBtn) {
      copyCmdBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText("copy((document.cookie.match(/unisupport-cutomer-token=([^;]+)/) || [])[1] || document.cookie)");
          copyCmdBtn.textContent = '已复制！';
          setTimeout(() => { copyCmdBtn.textContent = '复制命令'; }, 2000);
        } catch (_) {}
      };
    }

    // Companion extension guide button inside account modal
    const extGuideBtn = overlay.querySelector('#twBtnExtGuideFromAccount');
    if (extGuideBtn) {
      extGuideBtn.onclick = () => {
        closeModal();
        this.openCompanionGuideModal();
      };
    }

    // Password visibility toggles
    overlay.querySelectorAll('.tw-pwd-toggle').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.dataset.target;
        const inputEl = overlay.querySelector('#' + targetId);
        if (inputEl) {
          inputEl.type = inputEl.type === 'password' ? 'text' : 'password';
        }
      };
    });

    // Save credentials
    overlay.querySelector('#twBtnSaveModal').onclick = async () => {
      const mtkU = overlay.querySelector('#twInputMtkUser').value.trim();
      const mtkP = overlay.querySelector('#twInputMtkPass').value;
      const uniU = overlay.querySelector('#twInputUnisocUser').value.trim();
      const uniP = overlay.querySelector('#twInputUnisocPass').value;

      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin) {
        if (!plugin.settings) plugin.settings = {};
        if (!plugin.settings.vendorPortals) plugin.settings.vendorPortals = {};
        if (!plugin.settings.vendorPortals.mtk) plugin.settings.vendorPortals.mtk = {};
        if (!plugin.settings.vendorPortals.unisoc) plugin.settings.vendorPortals.unisoc = {};

        plugin.settings.vendorPortals.mtk.username = mtkU;
        plugin.settings.vendorPortals.unisoc.username = uniU;
        await plugin.saveSettings?.();
      }

      if (this.vendorService) {
        await this.vendorService.saveCredential(portals.mtk?.secretName, mtkP);
        await this.vendorService.saveCredential(portals.unisoc?.secretName, uniP);
      }

      closeModal();
      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        new NoticeClass('✓ 芯片资源网账号凭据已安全保存！', 3500);
      }
      this.render();
    };
  }

  /**
   * Open modal explaining how to install and use TabonKB Browser Companion Extension
   */
  openCompanionGuideModal() {
    const overlay = document.createElement('div');
    overlay.className = 'tw-modal-overlay';

    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
    const pathMod = typeof path !== 'undefined' ? path : (typeof require !== 'undefined' ? require('path') : null);
    const extFolder = pathMod ? pathMod.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', 'browser-extension') : `${vaultPath}\\.obsidian\\plugins\\tabonkb-workbench\\browser-extension`;

    overlay.innerHTML = `
      <div class="tw-modal-card tw-companion-guide-modal" style="max-width: 580px;">
        <div class="tw-modal-header">
          <div class="tw-modal-title" style="display:flex;align-items:center;gap:8px;">
            <span style="font-size: 18px;">💎</span>
            <span>TabonKB 浏览器伴侣扩展安装与一键同步指引</span>
          </div>
          <button class="tw-modal-btn-close" id="twBtnCloseGuideModal">✕</button>
        </div>

        <div class="tw-modal-body" style="font-size: 13px; line-height: 1.6;">
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 8px 12px; border-radius: 6px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 6px #10B981;"></span>
              <strong style="color: #10B981;">本地同步服务已就绪 (127.0.0.1:28123)</strong>
            </div>
            <span style="font-size: 11px; color: var(--text-muted, #94A3B8);">Obsidian 端监听中</span>
          </div>

          <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-normal, #E2E8F0);">🚀 30 秒在 Edge / Chrome 中加载伴侣扩展：</div>
          <ol style="margin-left: 18px; margin-bottom: 14px; padding: 0; color: var(--text-muted, #94A3B8);">
            <li style="margin-bottom: 6px;">在浏览器中打开扩展管理页面：
              <code style="background: rgba(0,0,0,0.25); padding: 2px 5px; border-radius: 3px; color: #60A5FA;">edge://extensions</code> 或 <code style="background: rgba(0,0,0,0.25); padding: 2px 5px; border-radius: 3px; color: #60A5FA;">chrome://extensions</code>
            </li>
            <li style="margin-bottom: 6px;">在页面开启 <strong>「开发者模式」(Developer mode)</strong> 开关。</li>
            <li style="margin-bottom: 6px;">点击 <strong>「加载已解压的扩展程序」(Load unpacked)</strong> 按钮。</li>
            <li style="margin-bottom: 6px;">在弹出的文件夹选择框中，直接选择以下扩展目录：
              <div style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.2); padding: 6px 10px; border-radius: 4px; font-family: monospace; font-size: 11px; margin-top: 5px; word-break: break-all; color: #FCD34D;">
                ${escapeHtml(extFolder)}
              </div>
            </li>
          </ol>

          <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-normal, #E2E8F0);">✨ 如何一键同步：</div>
          <p style="color: var(--text-muted, #94A3B8); margin-bottom: 14px;">
            在浏览器登录 <a href="https://unisupport.unisoc.com/" target="_blank" style="color: #A00090; text-decoration: underline;">紫光展锐 Uni-Support 官网 ↗</a>，页面右下角会自动出现 <strong>「⚡ 一键同步到工作台」</strong> 浮钮，点击一下即可秒级完成凭据刷新！
          </p>
        </div>

        <div class="tw-modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button type="button" class="tw-modal-btn-cancel" id="twBtnOpenFolderInExplorer" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #A5B4FC;">
            📂 打开扩展文件夹
          </button>
          <button type="button" class="tw-modal-btn-save" id="twBtnCloseGuideModalDone">
            我知道了
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeGuide = () => overlay.remove();
    overlay.querySelector('#twBtnCloseGuideModal').onclick = closeGuide;
    overlay.querySelector('#twBtnCloseGuideModalDone').onclick = closeGuide;

    const openFolderBtn = overlay.querySelector('#twBtnOpenFolderInExplorer');
    if (openFolderBtn) {
      openFolderBtn.onclick = () => {
        try {
          const cp = typeof child_process !== 'undefined' ? child_process : require('child_process');
          cp.exec(`explorer.exe "${extFolder}"`);
        } catch (e) {
          const NoticeClass = (typeof Notice !== 'undefined') ? Notice : window.Notice;
          if (NoticeClass) new NoticeClass('扩展目录: ' + extFolder, 4000);
        }
      };
    }
  }
}

/**
 * HTML escaper helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format markdown or rich vendor HTML for inline solution display
 */
function formatMarkdownToHtml(content) {
  if (!content) return '';
  let text = String(content).trim();

  const isHtml = /<(?:div|p|ol|ul|li|span|pre|code|table|strong|b|br|h[1-6])[\s>/]/i.test(text);

  if (isHtml) {
    // 1. Remove MTK wrapper classes
    text = text.replace(/<div class="ExternalClass[^"]*">/gi, '');

    // 2. Transform MTK codeblocks:
    text = text.replace(/<div class="codeblock[^"]*">[\s\S]*?<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi, (m, lang, code) => {
      const codeLang = lang || 'sh';
      const cleanCode = code.trim();
      return `<div class="tw-code-block-wrap">
        <div class="tw-code-block-header">
          <span class="tw-code-lang">${codeLang}</span>
          <button class="tw-code-copy-btn" type="button" title="复制代码">${getIconPark('copy', 13)}</button>
        </div>
        <pre><code class="language-${codeLang}">${cleanCode}</code></pre>
      </div>`;
    });

    // Handle standalone <pre><code>...</code></pre>
    text = text.replace(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (m, lang, code) => {
      const codeLang = lang || 'text';
      const cleanCode = code.trim();
      return `<div class="tw-code-block-wrap">
        <div class="tw-code-block-header">
          <span class="tw-code-lang">${codeLang}</span>
          <button class="tw-code-copy-btn" type="button" title="复制代码">${getIconPark('copy', 13)}</button>
        </div>
        <pre><code class="language-${codeLang}">${cleanCode}</code></pre>
      </div>`;
    });

    // Handle Unisoc Quill syntax code blocks: <pre class="ql-syntax"...>...</pre>
    text = text.replace(/<pre class="ql-syntax[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi, (m, code) => {
      const cleanCode = code.trim();
      return `<div class="tw-code-block-wrap">
        <div class="tw-code-block-header">
          <span class="tw-code-lang">code</span>
          <button class="tw-code-copy-btn" type="button" title="复制代码">${getIconPark('copy', 13)}</button>
        </div>
        <pre><code class="language-c">${cleanCode}</code></pre>
      </div>`;
    });

    // 3. Highlight section headers
    text = text.replace(/(?:<span[^>]*>)?\s*\[DESCRIPTION\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title desc">📌 [DESCRIPTION] 问题描述</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[KEYWORD\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title keyword">🔑 [KEYWORD] 关键词</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[SOLUTION\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title sol">💡 [SOLUTION] 官方解决方案</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[NOTE\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title note">⚠️ [NOTE] 注意事项</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[REFERENCE\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title ref">🔗 [REFERENCE] 参考文档</div>');

    // 4. Remove empty paragraph/div spacers
    text = text.replace(/<(?:p|div)>\s*(?:&nbsp;|\s)*<\/(?:p|div)>/gi, '<div class="tw-md-spacer"></div>');

    return text;
  }

  // Pure markdown text fallback
  let html = escapeHtml(text);

  // 1. Code blocks ```lang\n...```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="tw-code-block-wrap">
      <div class="tw-code-block-header">
        <span class="tw-code-lang">${lang || 'code'}</span>
        <button class="tw-code-copy-btn" type="button" title="复制代码">${getIconPark('copy', 13)}</button>
      </div>
      <pre><code>${code.trim()}</code></pre>
    </div>`;
  });

  // 2. Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code class="tw-inline-code">$1</code>');

  // 3. Headers ###, ##, #
  html = html.replace(/^### (.*$)/gim, '<h4 class="tw-md-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="tw-md-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="tw-md-h2">$1</h2>');

  // 4. Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 5. Unordered list - item
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="tw-md-li">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)/gim, '<ul class="tw-md-ul">$1</ul>');
  html = html.replace(/<\/ul>\s*<ul class="tw-md-ul">/g, '');

  // 6. Numbered list 1. item
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="tw-md-oli">$1</li>');

  // 7. Line breaks
  html = html.replace(/\n\n/g, '<div class="tw-md-spacer"></div>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

module.exports = {
  ExploreView
};
