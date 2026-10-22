/* ==========================================================================
   TopicView — 任务页「专题」子页 (P1a)
   左栏: 搜索 + ＋新建 + 4 个可折叠分组 (本周聚焦/工作/深耕/拓展)
   右栏: 头部(ID·模块/进度/聚焦/归档) + 推进主控卡(Checklist/统一输入条/进展)
         + 文件舱(过程草稿 | 沉淀与参考)
   数据: services/topic-service.js (vault 07-Project/00-Personal-Topics/)
   ========================================================================== */

const {
  TOPIC_MODULE_CODES, TOPIC_TRACKS, TOPIC_TASK_FILE,
  parseWikiLink, calcProgress, calcIdle,
  buildIngestPrompt, buildDecomposePrompt, buildEvaluatePrompt,
  isoWeekKey, shouldShowWeeklyReview, buildWeeklyReviewPlan
} = require('../services/topic-service.js');
const { DBG_MODULE_DIR } = require('../services/jira-sandbox-service.js');
const { RadarService, RADAR_MODULES, RADAR_LABELS, diffRadar, quarterKey, recommendSeedsForBlank } = require('../services/radar-service.js');

const LS_SELECTED = 'tabonkb-topic-selected';
const LS_COLLAPSED = 'tabonkb-topic-collapsed';
const LS_SEEDS_OPEN = 'tabonkb-topic-seeds-open';
const LS_IDEAS_OPEN = 'tabonkb-topic-ideas-open';
const LS_WITHERED_OPEN = 'tabonkb-topic-withered-open';
const LS_WITHER_AT = 'tabonkb-topic-wither-at';
const LS_REVIEW_WEEK = 'tabonkb-topic-review-week';

const SEED_SOURCE_LABELS = { jira: 'JIRA', note: '笔记', agent: 'AI', manual: '手记' };

// P2b: 入库向导选项 / WeKnora 检索工具名 (与 mcp/weknora-mcp-shared.js 注册一致)
const INGEST_PLATFORMS = ['QCOM', 'MTK', 'UNISOC', 'EXYNOS', 'HISI', 'RK', 'AW', 'COMMON', 'MULTI'];
const INGEST_DOCTYPES = ['NOTE', 'ARCH', 'CASE', 'DBG', 'GUIDE', 'SPEC', 'REF', 'CODE', 'RPT', 'CHK', 'PLAN'];
const WEKNORA_SEARCH_TOOLS = ['weknora_search', 'weknora_read_document'];

function _touchMs(s) {
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String((s && s.touched) || ''));
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
}

function _touchLabel(s) {
  const ms = _touchMs(s);
  const days = ms ? Math.max(0, Math.floor((Date.now() - ms) / 86400000)) : 0;
  return { days, label: days === 0 ? '今日' : `${days}天前`, warn: days >= 7 };
}

function _lsGet(k) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch (_) { return null; }
}
function _lsSet(k, v) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (_) {}
}

function _notice(msg, ms) {
  try {
    if (typeof Notice !== 'undefined') new Notice(msg, ms || 2500);
  } catch (_) {}
}

class TopicView {
  constructor(opts = {}) {
    this.app = opts.app;
    this.topicService = opts.topicService;
    this.agentDrawer = opts.agentDrawer || null;

    this.el = null;
    this.hostEl = null;
    this.topics = [];
    this.seeds = [];
    this.keyword = '';
    this.selectedId = null;
    this.selectedSeedId = null;
    const _sv = _lsGet(LS_SELECTED) || '';
    if (_sv.startsWith('seed:')) this.selectedSeedId = _sv.slice(5);
    else this.selectedId = _sv || null;
    this.collapsed = new Set((_lsGet(LS_COLLAPSED) || '').split(',').filter(Boolean));
    this.seedsOpen = _lsGet(LS_SEEDS_OPEN) === '1';     // 默认折叠, 展开过才记 '1'
    this.ideasOpen = _lsGet(LS_IDEAS_OPEN) === '1';
    this.withered = [];
    this.witheredOpen = _lsGet(LS_WITHERED_OPEN) === '1';
    this.inputMode = 'step';            // 'step' | 'progress' | 'idea'
    this._inputDraft = '';
    this._seedDraft = '';
    this._timelineExpanded = false;
    this._unsub = null;
    this._createPop = null;
    this._createPopCloser = null;
    this._confirmEl = null;
    this._editingGoal = false;
    // P3: 回顾浮窗 / 雷达视图
    this.getJiraIssues = opts.getJiraIssues || null;     // 同步取已缓存工单 (不触发网络)
    this.categorizeDone = opts.categorizeDone || null;   // (issue)=>bool
    this.radarOpen = false;
    this._radarData = null;
    this._radarBusy = false;
    this._radarSvc = null;
    this._reviewEl = null;
    this._reviewKeyHandler = null;

    this._searchEl = null;
    this._groupsEl = null;
    this._mainEl = null;
    this._inputEl = null;
    this._seedInputEl = null;
  }

  /* ============================ 挂载 ============================ */

  async mount(parentEl) {
    this.hostEl = parentEl;
    this.el = parentEl.createDiv({ cls: 'tw-topic-root' });
    this._buildSkeleton();
    await this.refresh(true);
    this._unsub = this.topicService ? this.topicService.onChange(() => this.refresh(false)) : null;
    // P3: 每周首次打开自动弹出周回顾 (无可回顾内容则静默记周键)
    try {
      const lastW = _lsGet(LS_REVIEW_WEEK);
      const wk = isoWeekKey(new Date());
      const plan = buildWeeklyReviewPlan(this.topics, this.seeds, new Date());
      const hasContent = !!(plan.topics.length || plan.seeds.length || plan.ideas.length);
      if (shouldShowWeeklyReview(lastW, new Date(), hasContent)) {
        this._openReview();
      } else if (lastW !== wk && !hasContent) {
        _lsSet(LS_REVIEW_WEEK, wk);
      }
    } catch (_) {}
  }

  dispose() {
    if (this._unsub) { try { this._unsub(); } catch (_) {} this._unsub = null; }
    this._closeCreatePopover();
    this._closeConfirm();
    this._closeReview(false);
    this.el = null;
    this.hostEl = null;
    this._searchEl = this._groupsEl = this._mainEl = this._inputEl = null;
    this._seedInputEl = null;
  }

  filterKeyword(kw) {
    this.keyword = String(kw || '').trim();
    if (this._searchEl && this._searchEl.value !== this.keyword && document.activeElement !== this._searchEl) {
      this._searchEl.value = this.keyword;
    }
    this._renderGroups();
  }

  /* ============================ 数据 ============================ */

  async refresh(rebuildDetail) {
    if (!this.topicService) return;
    try {
      this.topics = await this.topicService.scan();
    } catch (e) {
      console.warn('[TopicView] scan failed:', e);
      this.topics = [];
    }
    try {
      this.seeds = (typeof this.topicService.scanSeeds === 'function') ? await this.topicService.scanSeeds() : [];
    } catch (e) {
      this.seeds = [];
    }
    try {
      this.withered = (typeof this.topicService.scanWithered === 'function') ? await this.topicService.scanWithered() : [];
    } catch (e) {
      this.withered = [];
    }
    if (!this.el) return;

    // P2b: 90 天自动枯萎 (1 小时节流)
    try {
      const last = Number(_lsGet(LS_WITHER_AT) || 0);
      if (Date.now() - last > 3600e3 && typeof this.topicService.witherStaleSeeds === 'function') {
        _lsSet(LS_WITHER_AT, String(Date.now()));
        this.topicService.witherStaleSeeds().then(n => {
          if (n > 0) {
            _notice(`🍂 ${n} 颗种子已枯萎`);
            this.refresh(false);
          }
        }).catch(e => console.warn('[TopicView] witherStaleSeeds:', e));
      }
    } catch (_) {}

    this._renderGroups();

    if (this.selectedSeedId && !this.seeds.some(s => s.id === this.selectedSeedId)) {
      this.selectedSeedId = null;
    }
    let sel = null;
    if (this.selectedSeedId) {
      this.selectedId = null;
    } else {
      sel = this.topics.find(t => t.id === this.selectedId) || null;
      if (!sel && this.topics.length) {
        sel = [...this.topics].sort((a, b) => (b.maxMtime || 0) - (a.maxMtime || 0))[0];
      }
      this.selectedId = sel ? sel.id : null;
    }
    const stored = this.selectedSeedId ? `seed:${this.selectedSeedId}` : (this.selectedId || '');
    if (stored !== (_lsGet(LS_SELECTED) || '')) _lsSet(LS_SELECTED, stored);

    const emptyNow = !sel && !this.selectedSeedId;
    const wasEmpty = this._mainEl && this._mainEl.dataset && this._mainEl.dataset.empty === '1';
    if (rebuildDetail || emptyNow !== wasEmpty || !this._mainEl || !this._mainEl.firstChild) {
      this._renderMain();
    } else {
      this._updateDetail();
    }
  }

  _selected() {
    return this.topics.find(t => t.id === this.selectedId) || null;
  }

  /* ============================ 骨架 ============================ */

  _buildSkeleton() {
    const side = this.el.createDiv({ cls: 'tw-topic-side' });

    const head = side.createDiv({ cls: 'tw-topic-side-head' });
    const searchWrap = head.createDiv({ cls: 'tw-topic-search-wrap' });
    this._searchEl = searchWrap.createEl('input', {
      cls: 'tw-topic-search',
      attr: { type: 'text', placeholder: '搜索 标题/模块/ID' }
    });
    this._searchEl.value = this.keyword;
    this._searchEl.addEventListener('input', (e) => {
      this.keyword = e.target.value.trim();
      this._renderGroups();
    });
    const addBtn = head.createEl('button', { cls: 'tw-topic-add-btn', text: '＋', attr: { title: '新建专题' } });
    addBtn.onclick = (e) => { e.stopPropagation(); this._toggleCreatePopover(addBtn); };
    // P3: 🗓 回顾 / 📡 雷达
    const revBtn = head.createEl('button', { cls: 'tw-topic-icon-btn', text: '🗓', attr: { title: '回顾' } });
    revBtn.onclick = (e) => { e.stopPropagation(); this._openReview(); };
    const radarBtn = head.createEl('button', { cls: 'tw-topic-icon-btn', text: '📡', attr: { title: '雷达' } });
    radarBtn.onclick = (e) => { e.stopPropagation(); this._toggleRadar(); };

    this._groupsEl = side.createDiv({ cls: 'tw-topic-groups' });
    this._mainEl = this.el.createDiv({ cls: 'tw-topic-main' });
  }

  /* ============================ 左栏分组 ============================ */

  _matchKw(t) {
    if (!this.keyword) return true;
    const kw = this.keyword.toLowerCase();
    return (t.title || '').toLowerCase().includes(kw)
      || (t.module || '').toLowerCase().includes(kw)
      || (t.id || '').toLowerCase().includes(kw);
  }

  _groupDefs() {
    const vis = this.topics.filter(t => this._matchKw(t));
    return [
      { id: 'star', label: '⭐ 本周聚焦', items: vis.filter(t => t.starred && t.status === 'in_progress') },
      { id: 'work', label: '💼 工作', items: vis.filter(t => t.track === 'work') },
      { id: 'deep', label: '🔬 深耕', items: vis.filter(t => t.track === 'deep') },
      { id: 'broad', label: '🧭 拓展', items: vis.filter(t => t.track === 'broad') }
    ].map(g => ({ ...g, items: [...g.items].sort((a, b) => (b.maxMtime || 0) - (a.maxMtime || 0)) }));
  }

  _renderGroups() {
    if (!this._groupsEl) return;
    this._groupsEl.empty();
    const groups = this._groupDefs();
    let any = false;
    for (const g of groups) {
      const gEl = this._groupsEl.createDiv({ cls: 'tw-topic-group' });
      const isCollapsed = this.collapsed.has(g.id);
      const head = gEl.createEl('button', { cls: `tw-topic-group-head ${isCollapsed ? 'collapsed' : ''}` });
      head.innerHTML = `<span class="tw-topic-group-arrow">${isCollapsed ? '▸' : '▾'}</span><span class="tw-topic-group-label">${escapeHtml(g.label)}</span><span class="tw-topic-group-count">${g.items.length}</span>`;
      head.onclick = () => {
        if (this.collapsed.has(g.id)) this.collapsed.delete(g.id); else this.collapsed.add(g.id);
        _lsSet(LS_COLLAPSED, [...this.collapsed].join(','));
        this._renderGroups();
      };
      if (isCollapsed) continue;
      const body = gEl.createDiv({ cls: 'tw-topic-group-body' });
      for (const t of g.items) {
        any = true;
        body.appendChild(this._buildTopicRow(t));
      }
    }
    if (!any && !this.topics.length) {
      this._groupsEl.createDiv({ cls: 'tw-topic-side-empty', text: '暂无专题' });
    } else if (!any) {
      this._groupsEl.createDiv({ cls: 'tw-topic-side-empty', text: '无匹配' });
    }
    this._renderSeedGroup();
  }

  _matchSeedKw(s) {
    if (!this.keyword) return true;
    const kw = this.keyword.toLowerCase();
    return (s.title || '').toLowerCase().includes(kw)
      || (s.module || '').toLowerCase().includes(kw)
      || (s.source_ref || '').toLowerCase().includes(kw);
  }

  _renderSeedGroup() {
    if (!this._groupsEl) return;
    const seeds = (this.seeds || []).filter(s => this._matchSeedKw(s));
    const gEl = this._groupsEl.createDiv({ cls: 'tw-topic-group tw-seed-group' });
    const head = gEl.createEl('button', { cls: `tw-topic-group-head ${this.seedsOpen ? '' : 'collapsed'}` });
    head.innerHTML = `<span class="tw-topic-group-arrow">${this.seedsOpen ? '▾' : '▸'}</span><span class="tw-topic-group-label">🌱 种子池</span><span class="tw-topic-group-count">${seeds.length}</span>`;
    head.onclick = () => {
      this.seedsOpen = !this.seedsOpen;
      _lsSet(LS_SEEDS_OPEN, this.seedsOpen ? '1' : '0');
      this._renderGroups();
    };
    if (!this.seedsOpen) return;
    const body = gEl.createDiv({ cls: 'tw-topic-group-body' });
    const growing = seeds.filter(s => s.status === 'growing')
      .sort((a, b) => ((b.waters || []).length) - ((a.waters || []).length));
    const fresh = seeds.filter(s => s.status !== 'growing')
      .sort((a, b) => _touchMs(b) - _touchMs(a));
    if (growing.length) {
      body.createDiv({ cls: 'tw-seed-sub', text: '💧 培育中' });
      for (const s of growing) body.appendChild(this._buildSeedRow(s));
    }
    if (fresh.length) {
      body.createDiv({ cls: 'tw-seed-sub', text: '🌱 新种子' });
      for (const s of fresh) body.appendChild(this._buildSeedRow(s));
    }
    if (!growing.length && !fresh.length) {
      body.createDiv({ cls: 'tw-seed-empty', text: '—' });
    }
    // P2b: 枯萎种子 (默认可折叠, 复活回种子池)
    const withered = (this.withered || []).filter(s => this._matchSeedKw(s));
    if (withered.length) {
      const wHead = body.createEl('button', {
        cls: `tw-seed-sub tw-seed-wither-head ${this.witheredOpen ? '' : 'collapsed'}`,
        text: `🍂 枯萎 ${withered.length}`
      });
      wHead.onclick = (e) => {
        e.stopPropagation();
        this.witheredOpen = !this.witheredOpen;
        _lsSet(LS_WITHERED_OPEN, this.witheredOpen ? '1' : '0');
        this._renderGroups();
      };
      if (this.witheredOpen) {
        for (const s of withered) {
          const row = body.createDiv({ cls: 'tw-seed-wither-row' });
          row.createEl('span', { cls: 'tw-seed-wither-name', text: s.title || s.id, attr: { title: s.id } });
          const bR = row.createEl('button', { cls: 'tw-topic-mini-btn', text: '复活' });
          bR.onclick = async (e) => {
            e.stopPropagation();
            try {
              await this.topicService.reviveSeed(s);
              _notice('🌱 已复活');
            } catch (err) { _notice(`复活失败: ${err.message || err}`); }
            await this.refresh(false);
          };
        }
      }
    }
  }

  _buildSeedRow(s) {
    const row = document.createElement('div');
    row.className = `tw-topic-row tw-seed-row ${s.id === this.selectedSeedId ? 'active' : ''}`;
    const top = document.createElement('div');
    top.className = 'tw-topic-row-top';
    const title = document.createElement('span');
    title.className = 'tw-topic-title';
    title.textContent = s.title || s.id;
    title.title = s.id;
    top.appendChild(title);
    const wc = document.createElement('span');
    wc.className = 'tw-seed-water-n';
    wc.textContent = `💧 ${(s.waters || []).length}`;
    top.appendChild(wc);
    row.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'tw-topic-row-meta';
    const src = document.createElement('span');
    src.className = 'tw-seed-src';
    src.textContent = SEED_SOURCE_LABELS[s.source] || s.source || '手记';
    meta.appendChild(src);
    const t = _touchLabel(s);
    const idle = document.createElement('span');
    idle.className = `tw-topic-idle ${t.warn ? 'warn' : ''}`;
    idle.textContent = t.label;
    meta.appendChild(idle);
    row.appendChild(meta);

    row.onclick = () => {
      this.selectedSeedId = s.id;
      this.selectedId = null;
      this.radarOpen = false;
      _lsSet(LS_SELECTED, `seed:${s.id}`);
      this._renderGroups();
      this._renderMain();
    };
    return row;
  }

  _buildTopicRow(t) {
    const row = document.createElement('div');
    row.className = `tw-topic-row ${t.id === this.selectedId ? 'active' : ''}`;
    const prog = calcProgress(t.steps);
    const idle = calcIdle(t.maxMtime, Date.now(), t.status);

    const top = document.createElement('div');
    top.className = 'tw-topic-row-top';
    const title = document.createElement('span');
    title.className = 'tw-topic-title';
    title.textContent = t.title || t.id;
    title.title = t.id;
    top.appendChild(title);
    const star = document.createElement('button');
    star.className = `tw-topic-star ${t.starred ? 'on' : ''}`;
    star.textContent = t.starred ? '⭐' : '☆';
    star.title = t.starred ? '取消聚焦' : '设为聚焦';
    star.onclick = async (e) => {
      e.stopPropagation();
      try {
        await this.topicService.toggleStar(t);
      } catch (err) {
        _notice(err && err.code === 'STAR_LIMIT' ? '聚焦最多 3 个' : `操作失败: ${err.message}`);
      }
      await this.refresh(false);
    };
    top.appendChild(star);
    row.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'tw-topic-row-meta';
    if (t.module) {
      const mb = document.createElement('span');
      mb.className = 'tw-topic-badge';
      mb.textContent = t.module;
      meta.appendChild(mb);
    }
    const idleEl = document.createElement('span');
    if (t.status === 'paused') {
      idleEl.className = 'tw-topic-idle paused';
      idleEl.textContent = '⏸ 暂停';
    } else if (idle.warn) {
      idleEl.className = 'tw-topic-idle warn';
      idleEl.textContent = `⏳ 搁置 ${idle.days} 天`;
    } else {
      idleEl.className = 'tw-topic-idle';
      idleEl.textContent = idle.label;
    }
    meta.appendChild(idleEl);

    const progWrap = document.createElement('span');
    progWrap.className = 'tw-topic-miniprog';
    const track = document.createElement('span');
    track.className = 'tw-topic-miniprog-track';
    const fill = document.createElement('span');
    fill.className = 'tw-topic-miniprog-fill';
    fill.style.width = `${prog.percent || 0}%`;
    track.appendChild(fill);
    progWrap.appendChild(track);
    const pct = document.createElement('span');
    pct.className = 'tw-topic-miniprog-num';
    pct.textContent = prog.total ? `${prog.done}/${prog.total}` : '—';
    progWrap.appendChild(pct);
    meta.appendChild(progWrap);

    const ideaN = (t.ideas || []).filter(i => !i.struck).length;
    if (ideaN > 0) {
      const ib = document.createElement('span');
      ib.className = 'tw-topic-ideas-n';
      ib.textContent = `💡 ${ideaN}`;
      meta.appendChild(ib);
    }
    row.appendChild(meta);

    row.onclick = () => {
      this.selectedId = t.id;
      this.selectedSeedId = null;
      this.radarOpen = false;
      _lsSet(LS_SELECTED, t.id);
      this._timelineExpanded = false;
      this._renderGroups();
      this._renderMain();
    };
    return row;
  }

  /* ============================ 新建浮窗 ============================ */

  _toggleCreatePopover(anchorEl) {
    if (this._createPop) { this._closeCreatePopover(); return; }
    this._openCreatePopover(anchorEl);
  }

  _openCreatePopover(anchorEl) {
    this._closeCreatePopover();
    const host = this.el;
    if (!host) return;
    const pop = host.createDiv({ cls: 'tw-topic-create-pop' });
    pop.innerHTML = `
      <input type="text" class="tw-topic-create-title" placeholder="专题标题" maxlength="60" />
      <div class="tw-topic-create-row">
        <select class="tw-topic-create-track">${TOPIC_TRACKS.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
        <select class="tw-topic-create-module">${TOPIC_MODULE_CODES.map(m => `<option value="${m}"${m === 'GEN' ? ' selected' : ''}>${m}</option>`).join('')}</select>
      </div>
      <input type="text" class="tw-topic-create-goal" placeholder="目标 (可选)" maxlength="80" />
    `;
    const titleInput = pop.querySelector('.tw-topic-create-title');
    const goalInput = pop.querySelector('.tw-topic-create-goal');
    const trackSel = pop.querySelector('.tw-topic-create-track');
    const modSel = pop.querySelector('.tw-topic-create-module');

    // 定位: 锚点下方, 限制在侧栏宽度内
    const hostRect = host.getBoundingClientRect();
    const aRect = anchorEl ? anchorEl.getBoundingClientRect() : null;
    if (aRect) {
      pop.style.top = Math.round(aRect.bottom - hostRect.top + 6) + 'px';
      pop.style.left = Math.max(8, Math.round(aRect.left - hostRect.left - 180)) + 'px';
    } else {
      pop.style.top = '48px';
      pop.style.left = '12px';
    }

    const submit = async () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      try {
        const t = await this.topicService.createTopic({
          title,
          track: trackSel.value,
          module: modSel.value,
          goal: goalInput.value.trim()
        });
        this.selectedId = t.id;
        _lsSet(LS_SELECTED, t.id);
        this._closeCreatePopover();
        await this.refresh(true);
      } catch (e) {
        console.warn('[TopicView] createTopic failed:', e);
        _notice(`创建失败: ${e.message || e}`);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); this._closeCreatePopover(); }
    };
    titleInput.addEventListener('keydown', onKey);
    goalInput.addEventListener('keydown', onKey);
    trackSel.addEventListener('keydown', onKey);
    modSel.addEventListener('keydown', onKey);

    this._createPop = pop;
    this._createPopCloser = (e) => {
      if (this._createPop && !this._createPop.contains(e.target) && e.target !== anchorEl) this._closeCreatePopover();
    };
    setTimeout(() => document.addEventListener('pointerdown', this._createPopCloser, true), 0);
    setTimeout(() => titleInput.focus(), 30);
  }

  _closeCreatePopover() {
    if (this._createPopCloser) {
      document.removeEventListener('pointerdown', this._createPopCloser, true);
      this._createPopCloser = null;
    }
    if (this._createPop) { this._createPop.remove(); this._createPop = null; }
  }

  /* ============================ 右栏 ============================ */

  _renderMain() {
    if (!this._mainEl) return;
    if (this._inputEl) this._inputDraft = this._inputEl.value;
    if (this._seedInputEl) this._seedDraft = this._seedInputEl.value;
    this._mainEl.empty();
    this._inputEl = null;
    this._seedInputEl = null;
    if (this.radarOpen) {
      this._mainEl.dataset.empty = '0';
      this._renderRadar();
      return;
    }
    if (this.selectedSeedId) {
      const s = (this.seeds || []).find(x => x.id === this.selectedSeedId);
      if (s) {
        this._mainEl.dataset.empty = '0';
        this._renderSeedMain(s);
        return;
      }
    }
    const t = this._selected();
    if (!t) {
      this._mainEl.dataset.empty = '1';
      const empty = this._mainEl.createDiv({ cls: 'tw-topic-empty' });
      empty.createDiv({ cls: 'tw-topic-empty-text', text: '暂无专题' });
      const btn = empty.createEl('button', { cls: 'tw-topic-empty-add', text: '＋' });
      btn.onclick = (e) => { e.stopPropagation(); this._toggleCreatePopover(btn); };
      return;
    }
    this._mainEl.dataset.empty = '0';

    this._headEl = this._mainEl.createDiv({ cls: 'tw-topic-head' });
    this._fillHead(t);

    // 区域 1: 推进主控卡
    const card = this._mainEl.createDiv({ cls: 'tw-topic-card tw-topic-master' });
    this._ideasEl = card.createDiv({ cls: 'tw-idea-area' });
    this._fillIdeas(t);
    this._itemsEl = card.createDiv({ cls: 'tw-topic-checklist-items' });
    this._fillChecklist(t);

    // 统一输入条 (常驻节点, refresh 不重建)
    const bar = card.createDiv({ cls: 'tw-topic-inputbar' });
    const mkMode = (id, label) => {
      const b = bar.createEl('button', {
        cls: `tw-topic-mode ${this.inputMode === id ? 'active' : ''}`,
        text: label
      });
      b.onclick = () => {
        this.inputMode = id;
        bar.querySelectorAll('.tw-topic-mode').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this._inputEl && this._inputEl.focus();
      };
      return b;
    };
    mkMode('step', '＋步骤');
    mkMode('progress', '⏱进展');
    mkMode('idea', '💡想法');
    this._inputEl = bar.createEl('input', {
      cls: 'tw-topic-input',
      attr: { type: 'text', placeholder: '回车提交' }
    });
    this._inputEl.value = this._inputDraft || '';
    this._inputEl.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = this._inputEl.value.trim();
      if (!v) return;
      const cur = this._selected();
      if (!cur) return;
      try {
        if (this.inputMode === 'step') await this.topicService.addStep(cur, v);
        else if (this.inputMode === 'idea') await this.topicService.addIdea(cur, v);
        else await this.topicService.addProgress(cur, v);
        this._inputEl.value = '';
        this._inputDraft = '';
        await this.refresh(false);
      } catch (err) {
        _notice(`写入失败: ${err.message || err}`);
      }
    });
    this._inputEl.addEventListener('input', () => { this._inputDraft = this._inputEl.value; });

    this._timelineEl = card.createDiv({ cls: 'tw-topic-timeline' });
    this._fillTimeline(t);

    // 区域 2: 文件舱
    this._filesEl = this._mainEl.createDiv({ cls: 'tw-topic-files' });
    this._fillFiles(t);
  }

  // refresh 时仅重绘可变区, 保留输入条文本/焦点/模式
  _updateDetail() {
    if (this.radarOpen) { this._renderMain(); return; }
    if (this.selectedSeedId) { this._renderMain(); return; }
    const t = this._selected();
    if (!t) { this._renderMain(); return; }
    if (this._headEl && !this._editingGoal) this._fillHead(t);
    if (this._ideasEl) this._fillIdeas(t);
    if (this._itemsEl) this._fillChecklist(t);
    if (this._timelineEl) this._fillTimeline(t);
    if (this._filesEl) this._fillFiles(t);
  }

  /* ============================ 想法区 ============================ */

  _fillIdeas(t) {
    const host = this._ideasEl;
    if (!host) return;
    host.empty();
    const ideas = t.ideas || [];
    if (!ideas.length) return;
    const active = ideas.filter(i => !i.struck).length;
    const hd = host.createEl('button', { cls: `tw-idea-hd ${this.ideasOpen ? '' : 'collapsed'}` });
    hd.innerHTML = `<span class="tw-idea-arrow">${this.ideasOpen ? '▾' : '▸'}</span>💡 ${active} 条想法`;
    hd.onclick = () => {
      this.ideasOpen = !this.ideasOpen;
      _lsSet(LS_IDEAS_OPEN, this.ideasOpen ? '1' : '0');
      this._fillIdeas(this._selected() || t);
    };
    if (!this.ideasOpen) return;
    const list = host.createDiv({ cls: 'tw-idea-list' });
    for (const i of ideas) {
      const row = list.createDiv({ cls: `tw-idea-row ${i.struck ? 'struck' : ''}` });
      row.createEl('span', { cls: 'tw-idea-row-text', text: i.label || i.text });
      if (i.struck) continue;
      if (i.source) row.createEl('span', { cls: 'tw-idea-row-src', text: i.source });
      const acts = row.createDiv({ cls: 'tw-idea-row-acts' });
      const mk = (label, title, fn) => {
        const b = acts.createEl('button', { cls: 'tw-idea-act', text: label, attr: { title } });
        b.onclick = async (e) => {
          e.stopPropagation();
          try { await fn(); await this.refresh(false); } catch (err) { _notice(`失败: ${err.message || err}`); }
        };
      };
      mk('→步骤', '转为步骤', () => this.topicService.ideaToStep(t, i.line));
      mk('⑂分叉', '分叉为种子', async () => {
        const seed = await this.topicService.forkIdea(t, i.line);
        if (seed) _notice('🌱 已分叉为种子');
      });
      mk('✕', '划掉', () => this.topicService.strikeIdea(t, i.line));
    }
  }

  /* ============================ 种子详情 ============================ */

  _renderSeedMain(s) {
    const head = this._mainEl.createDiv({ cls: 'tw-topic-head' });
    const r1 = head.createDiv({ cls: 'tw-topic-head-r1' });
    r1.createDiv({ cls: 'tw-topic-badge tw-seed-badge', text: '🌱 种子' });
    r1.createDiv({
      cls: `tw-topic-badge tw-seed-status-badge ${s.status === 'growing' ? 'growing' : ''}`,
      text: s.status === 'growing' ? '培育中' : '新种子'
    });
    r1.createDiv({ cls: 'tw-seed-src', text: SEED_SOURCE_LABELS[s.source] || s.source || '手记' });
    const ref = String(s.source_ref || '').trim();
    if (ref) {
      const refBtn = r1.createEl('button', { cls: 'tw-seed-ref', text: ref });
      if (/^\[\[.*\]\]$/.test(ref)) {
        refBtn.onclick = () => this._openLink(parseWikiLink(ref));
      } else if (/^https?:\/\//.test(ref)) {
        refBtn.onclick = () => { try { window.open(ref); } catch (_) {} };
      } else {
        refBtn.disabled = true;
        refBtn.classList.add('static');
      }
    }
    head.createDiv({ cls: 'tw-topic-head-title', text: s.title || s.id });

    const card = this._mainEl.createDiv({ cls: 'tw-topic-card tw-seed-card' });
    card.createDiv({ cls: 'tw-seed-sec-title', text: '想法' });
    card.createDiv({ cls: 'tw-seed-idea', text: s.idea || '(空)' });

    card.createDiv({ cls: 'tw-seed-sec-title', text: `浇水 ${(s.waters || []).length}` });
    const wl = card.createDiv({ cls: 'tw-seed-waters' });
    if (!(s.waters || []).length) {
      wl.createDiv({ cls: 'tw-seed-water-empty', text: '—' });
    }
    for (const w of (s.waters || [])) {
      const row = wl.createDiv({ cls: 'tw-seed-water-row' });
      row.createEl('span', { cls: 'tw-seed-water-time', text: w.time || '' });
      row.createEl('span', { cls: 'tw-seed-water-text', text: w.text || '' });
      if (w.auto) {
        row.createEl('span', { cls: 'tw-seed-auto-badge', text: '自动' });
        const bU = row.createEl('button', { cls: 'tw-seed-undo-btn', text: '撤销' });
        bU.onclick = async (e) => {
          e.stopPropagation();
          try {
            await this.topicService.unwater(s, w.line);
            _notice('已撤销');
          } catch (err) { _notice(`撤销失败: ${err.message || err}`); }
          await this.refresh(true);
        };
      }
    }

    const bar = card.createDiv({ cls: 'tw-topic-inputbar tw-seed-inputbar' });
    bar.createEl('span', { cls: 'tw-seed-bar-ico', text: '💧' });
    this._seedInputEl = bar.createEl('input', {
      cls: 'tw-topic-input',
      attr: { type: 'text', placeholder: '浇水…' }
    });
    this._seedInputEl.value = this._seedDraft || '';
    this._seedInputEl.addEventListener('input', () => { this._seedDraft = this._seedInputEl.value; });
    this._seedInputEl.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = this._seedInputEl.value.trim();
      if (!v) return;
      try {
        await this.topicService.water(s, v);
        this._seedDraft = '';
        await this.refresh(false);
      } catch (err) {
        _notice(`浇水失败: ${err.message || err}`);
      }
    });

    const acts = card.createDiv({ cls: 'tw-seed-actions' });
    const bW = acts.createEl('button', { cls: 'tw-seed-btn', text: '💧浇水' });
    bW.onclick = () => { if (this._seedInputEl) this._seedInputEl.focus(); };
    if (this.agentDrawer) {
      const bE = acts.createEl('button', { cls: 'tw-seed-btn', text: '✨评估', attr: { title: 'AI 评估种子' } });
      bE.onclick = () => this._sendAgentPrompt(buildEvaluatePrompt(s, { weknoraTools: WEKNORA_SEARCH_TOOLS }));
    }
    const bS = acts.createEl('button', { cls: 'tw-seed-btn', text: '🌳发芽' });
    bS.onclick = () => this._sproutDialog(s);
    const bM = acts.createEl('button', { cls: 'tw-seed-btn', text: '⤵并入' });
    bM.onclick = () => this._mergeSeed(s);
    const bD = acts.createEl('button', { cls: 'tw-seed-btn danger', text: '🍂丢弃' });
    bD.onclick = () => this._discardSeed(s);
  }

  _sproutDialog(s) {
    this._closeConfirm();
    const mask = this.el.createDiv({ cls: 'tw-topic-confirm-mask' });
    const card = mask.createDiv({ cls: 'tw-topic-confirm tw-seed-sprout' });
    card.createDiv({ cls: 'tw-topic-confirm-msg', text: '🌳 发芽为专题' });
    const r1 = card.createDiv({ cls: 'tw-seed-sprout-row' });
    r1.createEl('label', { text: '方向' });
    const trackSel = r1.createEl('select', { cls: 'tw-seed-sprout-sel' });
    for (const t of TOPIC_TRACKS) {
      const o = trackSel.createEl('option', { value: t.id, text: t.label });
      if (t.id === (s.track || 'deep')) o.selected = true;
    }
    const r2 = card.createDiv({ cls: 'tw-seed-sprout-row' });
    r2.createEl('label', { text: '模块' });
    const modSel = r2.createEl('select', { cls: 'tw-seed-sprout-sel' });
    for (const m of TOPIC_MODULE_CODES) {
      const o = modSel.createEl('option', { value: m, text: m });
      if (m === (s.module || 'GEN')) o.selected = true;
    }
    const btns = card.createDiv({ cls: 'tw-topic-confirm-btns' });
    const no = btns.createEl('button', { cls: 'tw-topic-confirm-btn', text: '取消' });
    const ok = btns.createEl('button', { cls: 'tw-topic-confirm-btn primary', text: '发芽' });
    no.onclick = () => this._closeConfirm();
    ok.onclick = async () => {
      const track = trackSel.value;
      const module = modSel.value;
      this._closeConfirm();
      try {
        const topic = await this.topicService.sprout(s, { track, module });
        _notice('🌳 已发芽为专题');
        this.selectedSeedId = null;
        this.selectedId = topic.id;
        _lsSet(LS_SELECTED, topic.id);
        await this.refresh(true);
      } catch (e) {
        _notice(`发芽失败: ${e.message || e}`);
      }
    };
    mask.addEventListener('pointerdown', (e) => { if (e.target === mask) this._closeConfirm(); });
    this._confirmEl = mask;
  }

  _mergeSeed(s) {
    let FSM = null;
    try { FSM = require('obsidian').FuzzySuggestModal; } catch (_) {}
    if (!FSM) { _notice('选择不可用'); return; }
    const topics = this.topics.filter(t => t.status === 'in_progress')
      .sort((a, b) => {
        const am = a.module === s.module ? 0 : 1;
        const bm = b.module === s.module ? 0 : 1;
        return am - bm || (b.maxMtime || 0) - (a.maxMtime || 0);
      });
    if (!topics.length) { _notice('无进行中专题'); return; }
    const self = this;
    class SeedMergePicker extends FSM {
      getItems() { return topics; }
      getItemText(t) { return `${t.title} · ${t.module || ''} · ${t.id}`; }
      onChooseItem(t) {
        (async () => {
          try {
            await self.topicService.mergeSeed(s, t);
            _notice(`⤵ 已并入「${t.title}」`);
            self.selectedSeedId = null;
            self.selectedId = t.id;
            _lsSet(LS_SELECTED, t.id);
            await self.refresh(true);
          } catch (e) { _notice(`并入失败: ${e.message || e}`); }
        })();
      }
    }
    try { new SeedMergePicker(this.app).open(); } catch (e) { _notice(`打开失败: ${e.message || e}`); }
  }

  async _discardSeed(s) {
    try {
      await this.topicService.discardSeed(s);
      _notice('已移入枯萎');
    } catch (e) {
      _notice(`丢弃失败: ${e.message || e}`);
      return;
    }
    const rest = (this.seeds || []).filter(x => x.id !== s.id);
    if (rest.length) {
      this.selectedSeedId = rest[0].id;
      this.selectedId = null;
      _lsSet(LS_SELECTED, `seed:${rest[0].id}`);
    } else {
      this.selectedSeedId = null;
      const nt = [...this.topics].sort((a, b) => (b.maxMtime || 0) - (a.maxMtime || 0))[0];
      this.selectedId = nt ? nt.id : null;
      _lsSet(LS_SELECTED, this.selectedId || '');
    }
    await this.refresh(true);
  }

  _fillHead(t) {
    this._headEl.empty();
    const prog = calcProgress(t.steps);
    const idle = calcIdle(t.maxMtime, Date.now(), t.status);

    const r1 = this._headEl.createDiv({ cls: 'tw-topic-head-r1' });
    const idBadge = r1.createDiv({ cls: 'tw-topic-badge tw-topic-id-badge', text: `${t.id} · ${t.module || 'GEN'}` });
    idBadge.title = t.dir;
    const progBadge = r1.createDiv({ cls: 'tw-topic-badge tw-topic-prog-badge', text: `推进中 ${prog.percent == null ? '—' : prog.percent + '%'}` });
    if (t.status === 'paused') {
      r1.createDiv({ cls: 'tw-topic-badge tw-topic-paused-badge', text: '⏸ 暂停' });
    }
    const actions = r1.createDiv({ cls: 'tw-topic-head-actions' });
    const starBtn = actions.createEl('button', { cls: `tw-topic-head-btn ${t.starred ? 'on' : ''}`, text: t.starred ? '⭐ 聚焦' : '☆ 聚焦' });
    starBtn.onclick = async () => {
      try {
        await this.topicService.toggleStar(t);
      } catch (err) {
        _notice(err && err.code === 'STAR_LIMIT' ? '聚焦最多 3 个' : `操作失败: ${err.message}`);
      }
      await this.refresh(false);
    };
    if (this.agentDrawer) {
      const decBtn = actions.createEl('button', { cls: 'tw-topic-head-btn', text: '✨ 拆解', attr: { title: 'AI 拆解下一步' } });
      decBtn.onclick = () => this._sendAgentPrompt(buildDecomposePrompt(t));
    }
    const archBtn = actions.createEl('button', { cls: 'tw-topic-head-btn', text: '归档' });
    archBtn.onclick = () => this._onArchive(t);

    if (idle.warn) {
      this._headEl.createDiv({ cls: 'tw-topic-idle-banner', text: `⏳ 已搁置 ${idle.days} 天` });
    }

    this._headEl.createDiv({ cls: 'tw-topic-head-title', text: t.title || t.id });

    const r3 = this._headEl.createDiv({ cls: 'tw-topic-head-r3' });
    const goalEl = r3.createDiv({ cls: 'tw-topic-goal' });
    this._fillGoal(goalEl, t);
    const pathBtn = r3.createEl('button', { cls: 'tw-topic-head-btn tw-topic-path-btn', text: '📂 路径', attr: { title: t.dir } });
    pathBtn.onclick = () => this._revealInTree(t);
  }

  _fillGoal(goalEl, t) {
    goalEl.empty();
    const span = goalEl.createDiv({ cls: 'tw-topic-goal-text', text: `🎯 ${t.goal || '填写目标'}` });
    if (!t.goal) span.classList.add('placeholder');
    span.onclick = () => {
      if (this._editingGoal) return;
      this._editingGoal = true;
      goalEl.empty();
      const input = goalEl.createEl('input', { cls: 'tw-topic-goal-input', attr: { type: 'text' } });
      input.value = t.goal || '';
      let done = false;
      const finish = async (commit) => {
        if (done) return;
        done = true;
        this._editingGoal = false;
        const v = input.value.trim();
        if (commit && v !== (t.goal || '')) {
          try { await this.topicService.setField(t, 'goal', v); } catch (e) { _notice(`保存失败: ${e.message || e}`); }
          await this.refresh(false);
          return;
        }
        this._fillGoal(goalEl, t);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
      input.focus();
      input.select();
    };
  }

  _fillChecklist(t) {
    this._itemsEl.empty();
    if (!t.steps.length) {
      this._itemsEl.createDiv({ cls: 'tw-topic-checklist-empty', text: '暂无步骤' });
      return;
    }
    for (const s of t.steps) {
      const row = this._itemsEl.createDiv({ cls: `tw-topic-check ${s.done ? 'done' : ''}` });
      const cb = row.createEl('input', { attr: { type: 'checkbox' } });
      cb.checked = !!s.done;
      cb.addEventListener('change', async () => {
        try {
          await this.topicService.toggleStep(t, s.line, cb.checked);
          await this.refresh(false);
        } catch (e) {
          _notice(`写入失败: ${e.message || e}`);
          cb.checked = !cb.checked;
        }
      });
      row.createEl('span', { cls: 'tw-topic-check-label', text: s.label || '(空)' });
    }
  }

  _fillTimeline(t) {
    this._timelineEl.empty();
    const items = t.timeline || [];
    if (!items.length) {
      this._timelineEl.createDiv({ cls: 'tw-topic-timeline-empty', text: '暂无进展' });
      return;
    }
    const showAll = this._timelineExpanded;
    const list = showAll ? items : items.slice(0, 3);
    for (const it of list) {
      const row = this._timelineEl.createDiv({ cls: 'tw-topic-timeline-item' });
      row.createEl('span', { cls: 'tw-topic-timeline-time', text: it.time || '' });
      row.createEl('span', { cls: 'tw-topic-timeline-text', text: it.text || '' });
    }
    if (items.length > 3) {
      const more = this._timelineEl.createEl('button', {
        cls: 'tw-topic-timeline-more',
        text: showAll ? '收起' : `全部 ${items.length} 条`
      });
      more.onclick = () => {
        this._timelineExpanded = !this._timelineExpanded;
        this._fillTimeline(this._selected() || t);
      };
    }
  }

  _fillFiles(t) {
    this._filesEl.empty();

    // 左: 过程草稿
    const left = this._filesEl.createDiv({ cls: 'tw-topic-filecol' });
    const lh = left.createDiv({ cls: 'tw-topic-filecol-head' });
    lh.createDiv({ cls: 'tw-topic-filecol-title', text: '📝 过程草稿' });
    const addDraft = lh.createEl('button', { cls: 'tw-topic-mini-btn', text: '＋草稿' });
    addDraft.onclick = async () => {
      try {
        const f = await this.topicService.createDraft(t);
        this._openFile(f);
        await this.refresh(false);
      } catch (e) { _notice(`创建失败: ${e.message || e}`); }
    };

    const taskRow = left.createDiv({ cls: 'tw-topic-filerow' });
    taskRow.createEl('span', { cls: 'tw-topic-filename', text: `🧭 ${TOPIC_TASK_FILE}` });
    taskRow.onclick = () => this._openFile(t.taskFile);

    const docs = this.topicService.listTopicDocs(t);
    for (const f of docs) {
      const r = left.createDiv({ cls: 'tw-topic-filerow' });
      r.createEl('span', { cls: 'tw-topic-filename', text: f.name, attr: { title: f.path } });
      const sp = r.createEl('button', { cls: 'tw-topic-mini-btn', text: '分屏' });
      sp.onclick = (e) => { e.stopPropagation(); this._openSplit(f); };
      if (this.agentDrawer) {
        const ig = r.createEl('button', { cls: 'tw-topic-mini-btn', text: '📦入库', attr: { title: '入库向导' } });
        ig.onclick = (e) => { e.stopPropagation(); this._ingestDialog(t, f); };
      }
      r.onclick = () => this._openFile(f);
    }

    // 右: 沉淀与参考
    const right = this._filesEl.createDiv({ cls: 'tw-topic-filecol' });
    const rh = right.createDiv({ cls: 'tw-topic-filecol-head' });
    rh.createDiv({ cls: 'tw-topic-filecol-title', text: '🏛️ 沉淀与参考' });
    const addRef = rh.createEl('button', { cls: 'tw-topic-mini-btn', text: '＋关联' });
    addRef.onclick = () => this._pickDoc(t);

    const pubSec = right.createDiv({ cls: 'tw-topic-filesec' });
    const pubHead = pubSec.createDiv({ cls: 'tw-topic-filesec-head' });
    pubHead.createDiv({ cls: 'tw-topic-filesec-title', text: '📗 已入库' });
    const addPub = pubHead.createEl('button', { cls: 'tw-topic-mini-btn', text: '＋成果', attr: { title: '登记已入库文档' } });
    addPub.onclick = () => this._pickPublishedDoc(t);
    this._fillLinkList(pubSec, t.published_docs, t);
    const refSec = right.createDiv({ cls: 'tw-topic-filesec' });
    refSec.createDiv({ cls: 'tw-topic-filesec-title', text: '📘 参考' });
    this._fillLinkList(refSec, t.linked_refs, t);
  }

  _fillLinkList(secEl, links, t) {
    const arr = Array.isArray(links) ? links : [];
    if (!arr.length) {
      secEl.createDiv({ cls: 'tw-topic-filerow empty', text: '—' });
      return;
    }
    for (const raw of arr) {
      const p = parseWikiLink(raw);
      const dest = this._resolveLink(p);
      const r = secEl.createDiv({ cls: `tw-topic-filerow ${dest ? '' : 'missing'}` });
      const label = p.split('/').pop().replace(/\.md$/i, '') || p;
      r.createEl('span', { cls: 'tw-topic-filename', text: label, attr: { title: p } });
      if (dest) r.onclick = () => this._openLink(p);
    }
  }

  _resolveLink(p) {
    try {
      if (this.app?.metadataCache?.getFirstLinkpathDest) {
        return this.app.metadataCache.getFirstLinkpathDest(p, '') || null;
      }
    } catch (_) {}
    try {
      const v = this.app?.vault;
      return (v?.getAbstractFileByPath?.(p) || v?.getAbstractFileByPath?.(p + '.md')) || null;
    } catch (_) { return null; }
  }

  _openLink(p) {
    try { this.app.workspace.openLinkText(p, '', false); } catch (_) {}
  }

  _openFile(file) {
    if (!file) return;
    try { this.app.workspace.openLinkText(file.path, '', false); } catch (_) {}
  }

  async _openSplit(file) {
    if (!file) return;
    try {
      let leaf = this.app.workspace.getLeaf('split', 'vertical');
      if (leaf && typeof leaf.then === 'function') leaf = await leaf;
      if (leaf && typeof leaf.openFile === 'function') await leaf.openFile(file);
    } catch (e) {
      console.warn('[TopicView] openSplit failed:', e);
      this._openFile(file);
    }
  }

  _revealInTree(t) {
    try {
      const fePlugin = this.app.internalPlugins?.getPluginById?.('file-explorer')
        || this.app.internalPlugins?.plugins?.['file-explorer'];
      const inst = fePlugin?.instance || fePlugin;
      const target = t.dirFile || this.app.vault.getAbstractFileByPath(t.dir);
      if (inst && typeof inst.revealInFolder === 'function' && target) {
        inst.revealInFolder(target);
        return;
      }
    } catch (_) {}
    this._openFile(t.taskFile);
  }

  /* ============================ 关联文档选择 ============================ */

  _pickDoc(t) {
    let FSM = null;
    try { FSM = require('obsidian').FuzzySuggestModal; } catch (_) {}
    if (!FSM) { _notice('文档选择不可用'); return; }
    let files = [];
    try { files = this.app.vault.getMarkdownFiles?.() || []; } catch (_) {}
    const self = this;
    class TopicDocPicker extends FSM {
      getItems() { return files; }
      getItemText(f) { return f.path; }
      onChooseItem(f) {
        (async () => {
          try {
            await self.topicService.addLinkedRef(t, f);
            await self.refresh(false);
          } catch (e) { _notice(`关联失败: ${e.message || e}`); }
        })();
      }
    }
    try { new TopicDocPicker(this.app).open(); } catch (e) { _notice(`打开失败: ${e.message || e}`); }
  }

  /* ============================ 归档 ============================ */

  _onArchive(t) {
    const pendingIdeas = (t.ideas || []).filter(i => !i.struck).length;
    const gate2 = () => {
      if (!pendingIdeas) { this._doArchive(t, false); return; }
      // 闸门②: 未处理想法 -> 转种子 / 仍然归档 / 取消
      this._confirmButtons(`还有 ${pendingIdeas} 条想法未处理`, [
        { text: '取消' },
        { text: '转为种子', cls: 'primary', onClick: () => this._doArchive(t, true) },
        { text: '仍然归档', cls: 'danger', onClick: () => this._doArchive(t, false) }
      ]);
    };
    const hasPublished = Array.isArray(t.published_docs) && t.published_docs.length > 0;
    if (hasPublished) gate2();
    else this._confirm('未沉淀文档，确认归档？', gate2);
  }

  async _doArchive(t, ideasToSeeds) {
    try {
      const res = await this.topicService.archive(t, { ideasToSeeds: !!ideasToSeeds });
      _notice(res && res.seedsCreated > 0 ? `✓ 已归档，${res.seedsCreated} 条想法转为种子` : '✓ 已归档');
    } catch (e) {
      _notice(`归档失败: ${e.message || e}`);
      return;
    }
    // 选中下一个专题 (最近推进优先)
    const rest = this.topics.filter(x => x.id !== t.id)
      .sort((a, b) => (b.maxMtime || 0) - (a.maxMtime || 0));
    this.selectedId = rest.length ? rest[0].id : null;
    _lsSet(LS_SELECTED, this.selectedId || '');
    await this.refresh(true);
  }

  _confirm(msg, onYes) {
    this._confirmButtons(msg, [
      { text: '取消' },
      { text: '仍然归档', cls: 'danger', onClick: onYes }
    ]);
  }

  /** 通用确认弹窗: 任意按钮列表 [{text, cls, onClick}] */
  _confirmButtons(msg, buttons) {
    this._closeConfirm();
    const mask = this.el.createDiv({ cls: 'tw-topic-confirm-mask' });
    const card = mask.createDiv({ cls: 'tw-topic-confirm' });
    card.createDiv({ cls: 'tw-topic-confirm-msg', text: msg });
    const row = card.createDiv({ cls: 'tw-topic-confirm-btns' });
    for (const b of (buttons || [])) {
      const el = row.createEl('button', { cls: `tw-topic-confirm-btn ${b.cls || ''}`, text: b.text });
      el.onclick = () => { this._closeConfirm(); if (b.onClick) b.onClick(); };
    }
    mask.addEventListener('pointerdown', (e) => { if (e.target === mask) this._closeConfirm(); });
    this._confirmEl = mask;
  }

  /* ============================ P2b: AI 与入库 ============================ */

  _sendAgentPrompt(prompt) {
    if (!this.agentDrawer || !prompt) return;
    try {
      if (typeof this.agentDrawer.isOpen === 'function' ? !this.agentDrawer.isOpen() : true) {
        this.agentDrawer.open();
      }
      this.agentDrawer.sendPrompt(prompt);
    } catch (e) {
      _notice(`发送失败: ${e.message || e}`);
    }
  }

  _fileFm(file) {
    try { return this.app?.metadataCache?.getFileCache?.(file)?.frontmatter || {}; } catch (_) { return {}; }
  }

  /** 📦入库向导: 平台/模块/类型/目录 四项 → 生成提示词填 Agent 输入框 (不发送) */
  _ingestDialog(t, file) {
    this._closeConfirm();
    const fm = this._fileFm(file);
    const mask = this.el.createDiv({ cls: 'tw-topic-confirm-mask' });
    const card = mask.createDiv({ cls: 'tw-topic-confirm tw-ingest' });
    card.createDiv({ cls: 'tw-topic-confirm-msg', text: `📦 入库 ${file.name}` });
    const mkRow = (label) => {
      const r = card.createDiv({ cls: 'tw-seed-sprout-row' });
      r.createEl('label', { text: label });
      return r;
    };
    const mkSel = (r, opts, def) => {
      const sel = r.createEl('select', { cls: 'tw-seed-sprout-sel' });
      for (const v of opts) {
        const o = sel.createEl('option', { value: v, text: v });
        if (v === def) o.selected = true;
      }
      return sel;
    };
    const selPlat = mkSel(mkRow('平台'), INGEST_PLATFORMS,
      INGEST_PLATFORMS.includes(String(fm.platform || '').toUpperCase()) ? String(fm.platform).toUpperCase() : 'COMMON');
    const selMod = mkSel(mkRow('模块'), TOPIC_MODULE_CODES,
      TOPIC_MODULE_CODES.includes(String(fm.module || '').toUpperCase()) ? String(fm.module).toUpperCase() : (t.module || 'GEN'));
    const selDoc = mkSel(mkRow('类型'), INGEST_DOCTYPES,
      INGEST_DOCTYPES.includes(String(fm.doctype || '').toUpperCase()) ? String(fm.doctype).toUpperCase() : 'NOTE');
    const rDir = mkRow('目录');
    const dirIn = rDir.createEl('input', { cls: 'tw-seed-sprout-sel tw-ingest-dir', attr: { type: 'text', placeholder: '自动' } });

    const btns = card.createDiv({ cls: 'tw-topic-confirm-btns' });
    const no = btns.createEl('button', { cls: 'tw-topic-confirm-btn', text: '取消' });
    const ok = btns.createEl('button', { cls: 'tw-topic-confirm-btn primary', text: '生成提示词' });
    no.onclick = () => this._closeConfirm();
    ok.onclick = () => {
      this._closeConfirm();
      const module = selMod.value;
      const prompt = buildIngestPrompt(t, file, {
        platform: selPlat.value,
        module,
        doctype: selDoc.value,
        targetDir: dirIn.value.trim(),
        moduleDir: (typeof DBG_MODULE_DIR === 'object' && DBG_MODULE_DIR) ? DBG_MODULE_DIR[module] : ''
      });
      this._sendAgentPrompt(prompt);
    };
    mask.addEventListener('pointerdown', (e) => { if (e.target === mask) this._closeConfirm(); });
    this._confirmEl = mask;
  }

  /** ＋成果: FSM 选库内 md → published_docs + Timeline */
  _pickPublishedDoc(t) {
    let FSM = null;
    try { FSM = require('obsidian').FuzzySuggestModal; } catch (_) {}
    if (!FSM) { _notice('文档选择不可用'); return; }
    let files = [];
    try { files = this.app.vault.getMarkdownFiles?.() || []; } catch (_) {}
    const self = this;
    class PubDocPicker extends FSM {
      getItems() { return files; }
      getItemText(f) { return f.path; }
      onChooseItem(f) {
        (async () => {
          try {
            const added = await self.topicService.addPublishedDoc(t, f);
            if (added) _notice('📦 已登记成果');
            await self.refresh(false);
          } catch (e) { _notice(`登记失败: ${e.message || e}`); }
        })();
      }
    }
    try { new PubDocPicker(this.app).open(); } catch (e) { _notice(`打开失败: ${e.message || e}`); }
  }

  _closeConfirm() {
    if (this._confirmEl) { this._confirmEl.remove(); this._confirmEl = null; }
  }

  /* ============================ P3: 周回顾 ============================ */

  _openReview() {
    this._closeReview(false);
    if (!this.el) return;
    const plan = buildWeeklyReviewPlan(this.topics, this.seeds, new Date());
    const mask = this.el.createDiv({ cls: 'tw-topic-confirm-mask' });
    const card = mask.createDiv({ cls: 'tw-topic-confirm tw-review' });
    const hd = card.createDiv({ cls: 'tw-review-head' });
    hd.createEl('span', { cls: 'tw-review-title', text: '🗓 本周回顾' });

    // ① 本周聚焦 (进行中专题 ⭐ 开关, 至多 3)
    const focusSet = new Set();
    if (plan.topics.length) {
      const sec = card.createDiv({ cls: 'tw-review-sec' });
      sec.createDiv({ cls: 'tw-review-sec-title', text: '⭐ 本周聚焦' });
      for (const f of plan.topics) {
        if (f.starred) focusSet.add(f.id);
        const row = sec.createDiv({ cls: 'tw-review-row' });
        const star = row.createEl('button', { cls: `tw-review-star ${f.starred ? 'on' : ''}`, text: f.starred ? '⭐' : '☆' });
        star.dataset.topicId = f.id;
        row.createEl('span', { cls: 'tw-review-row-text', text: f.title || f.id });
        star.onclick = () => {
          const id = f.id;
          if (focusSet.has(id)) {
            focusSet.delete(id);
            star.classList.remove('on');
            star.textContent = '☆';
          } else {
            if (focusSet.size >= 3) { _notice('聚焦最多 3 个'); return; }
            focusSet.add(id);
            star.classList.add('on');
            star.textContent = '⭐';
          }
        };
      }
    }

    // ② 培育中种子分流
    const seedActs = {};
    if (plan.seeds.length) {
      const sec = card.createDiv({ cls: 'tw-review-sec' });
      sec.createDiv({ cls: 'tw-review-sec-title', text: '💧 培育中' });
      for (const s of plan.seeds) {
        seedActs[s.id] = 'keep';
        const row = sec.createDiv({ cls: 'tw-review-row' });
        row.createEl('span', { cls: 'tw-review-row-text', text: `${s.title || s.id} · 💧${s.waterCount}` });
        const seg = row.createDiv({ cls: 'tw-review-seg' });
        for (const [act, label] of [['sprout', '发芽'], ['keep', '保留'], ['discard', '丢弃']]) {
          const b = seg.createEl('button', { cls: `tw-review-seg-btn ${act === 'keep' ? 'on' : ''}`, text: label });
          b.onclick = () => {
            seedActs[s.id] = act;
            seg.querySelectorAll('.tw-review-seg-btn').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
          };
        }
      }
    }

    // ③ 积压想法 (≥14 天)
    const ideaActs = {};
    if (plan.ideas.length) {
      const sec = card.createDiv({ cls: 'tw-review-sec' });
      sec.createDiv({ cls: 'tw-review-sec-title', text: '💡 积压想法' });
      for (const i of plan.ideas) {
        const key = `${i.topicId}#${i.line}`;
        ideaActs[key] = { ...i, action: 'keep' };
        const row = sec.createDiv({ cls: 'tw-review-row' });
        row.createEl('span', { cls: 'tw-review-row-text', text: `${i.topicTitle || i.topicId}：${i.label}`, attr: { title: i.date || '' } });
        if (i.date) row.createEl('span', { cls: 'tw-review-date', text: i.date });
        const seg = row.createDiv({ cls: 'tw-review-seg' });
        for (const [act, label] of [['step', '→步骤'], ['fork', '分叉'], ['strike', '划掉'], ['keep', '保留']]) {
          const b = seg.createEl('button', { cls: `tw-review-seg-btn ${act === 'keep' ? 'on' : ''}`, text: label });
          b.onclick = () => {
            ideaActs[key].action = act;
            seg.querySelectorAll('.tw-review-seg-btn').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
          };
        }
      }
    }

    const btns = card.createDiv({ cls: 'tw-topic-confirm-btns' });
    const skip = btns.createEl('button', { cls: 'tw-topic-confirm-btn', text: '跳过本周' });
    const done = btns.createEl('button', { cls: 'tw-topic-confirm-btn primary', text: '完成' });
    skip.onclick = () => { this._closeReview(true); };
    done.onclick = async () => {
      const focusIds = [...focusSet];
      const ideaActions = Object.values(ideaActs).map(a => ({ topicId: a.topicId, line: a.line, label: a.label, action: a.action }));
      this._closeReview(true);
      try {
        const r = await this.topicService.applyWeeklyReview({ focusIds, seedActions: seedActs, ideaActions });
        _notice(`✓ 回顾完成：聚焦 ${r.focused} · 发芽 ${r.sprouted} · 丢弃 ${r.discarded} · 想法 ${r.steps + r.forked + r.struck}`);
      } catch (e) { _notice(`回顾失败: ${e.message || e}`); }
      await this.refresh(true);
    };
    mask.addEventListener('pointerdown', (e) => { if (e.target === mask) this._closeReview(false); });
    // Esc 关闭不记周键
    this._reviewKeyHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this._closeReview(false); }
    };
    document.addEventListener('keydown', this._reviewKeyHandler, true);
    this._reviewEl = mask;
  }

  _closeReview(recordWeek) {
    if (this._reviewKeyHandler) {
      document.removeEventListener('keydown', this._reviewKeyHandler, true);
      this._reviewKeyHandler = null;
    }
    if (this._reviewEl) { this._reviewEl.remove(); this._reviewEl = null; }
    if (recordWeek) _lsSet(LS_REVIEW_WEEK, isoWeekKey(new Date()));
  }

  /* ============================ P3: 能力雷达 ============================ */

  _radar() {
    if (!this._radarSvc) {
      this._radarSvc = new RadarService({
        app: this.app,
        topicService: this.topicService,
        getJiraIssues: this.getJiraIssues,
        categorizeDone: this.categorizeDone
      });
    }
    return this._radarSvc;
  }

  _toggleRadar() {
    this.radarOpen = !this.radarOpen;
    if (!this.radarOpen) { this._renderMain(); return; }
    // 每次打开都重新 compute 一次, 并写当前季度快照
    this._radarData = null;
    this._renderMain();
    if (this._radarBusy) return;
    this._radarBusy = true;
    const svc = this._radar();
    const qNow = new Date();
    svc.compute()
      .then(radar => {
        this._radarData = {
          radar,
          quarter: quarterKey(qNow),
          prev: svc.prevQuarterSnapshot(qNow),
          recommendations: []
        };
        // 空白区种子推荐 + 写当前季度快照
        this._radarData.recommendations = recommendSeedsForBlank(radar, this.seeds || []);
        try { svc.saveSnapshot(this._radarData.quarter, radar); } catch (_) {}
      })
      .catch(e => { _notice(`雷达计算失败: ${e.message || e}`); this._radarData = null; })
      .finally(() => {
        this._radarBusy = false;
        if (this.radarOpen) this._renderRadar();
      });
  }

  _renderRadar() {
    const host = this._mainEl;
    if (!host) return;
    host.empty();
    const root = host.createDiv({ cls: 'tw-radar' });
    const hd = root.createDiv({ cls: 'tw-radar-head' });
    hd.createEl('span', { cls: 'tw-radar-title', text: '📡 能力雷达' });
    const d = this._radarData;
    if (d && d.quarter) hd.createEl('span', { cls: 'tw-radar-quarter', text: d.quarter });
    if (!d) {
      root.createDiv({ cls: 'tw-radar-loading', text: this._radarBusy ? '…' : '—' });
      return;
    }
    this._renderRadarSvg(root, d);

    // 三区 chip 列表 (有上季度快照时带 ▲▼)
    const diffMap = {};
    for (const x of diffRadar(d.radar, d.prev)) diffMap[x.code] = x.delta;
    const zoneDefs = [['familiar', '熟悉'], ['expand', '拓展'], ['blank', '空白']];
    for (const [zid, zlabel] of zoneDefs) {
      const items = d.radar.filter(r => r.zone === zid);
      const row = root.createDiv({ cls: 'tw-radar-zone' });
      row.createEl('span', { cls: 'tw-radar-zone-label', text: zlabel });
      const chips = row.createDiv({ cls: 'tw-radar-chips' });
      for (const r of items) {
        const delta = diffMap[r.code];
        const suffix = (delta === null || delta === undefined || delta === 0) ? '' : (delta > 0 ? ` ▲${delta}` : ` ▼${-delta}`);
        const tip = `${r.code} · 文档 ${r.D} · Jira ${r.J} · 近90天 ${r.A} · raw ${Number(r.raw).toFixed(1)}`;
        chips.createEl('span', { cls: `tw-radar-chip ${zid}`, text: `${r.label} ${r.score}${suffix}`, attr: { title: tip } });
      }
    }

    // 空白区种子推荐
    const recs = (d.recommendations || []);
    if (recs.length) {
      const sec = root.createDiv({ cls: 'tw-radar-rec' });
      sec.createDiv({ cls: 'tw-radar-rec-title', text: '🌱 建议' });
      for (const r of recs) {
        const line = sec.createDiv({ cls: 'tw-radar-rec-line' });
        line.createEl('span', { cls: 'tw-radar-chip blank', text: r.label });
        for (const s of r.seeds) {
          const b = line.createEl('button', { cls: 'tw-radar-rec-seed', text: s.title || s.id });
          b.onclick = () => {
            this.selectedSeedId = s.id;
            this.selectedId = null;
            this.radarOpen = false;
            this.seedsOpen = true;
            _lsSet(LS_SEEDS_OPEN, '1');
            _lsSet(LS_SELECTED, `seed:${s.id}`);
            this._renderGroups();
            this._renderMain();
          };
        }
      }
    }
  }

  _renderRadarSvg(host, data) {
    const mods = RADAR_MODULES;
    const n = mods.length;
    const size = 300;
    const cx = size / 2, cy = size / 2, R = 108;
    const scoreMap = {};
    for (const r of data.radar) scoreMap[r.code] = r;
    const pt = (i, ratio) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return `${(cx + R * ratio * Math.cos(a)).toFixed(1)},${(cy + R * ratio * Math.sin(a)).toFixed(1)}`;
    };
    const poly = (vals) => vals.map((v, i) => pt(i, v)).join(' ');
    const curVals = mods.map(m => (scoreMap[m] ? scoreMap[m].score : 0) / 100);
    // 上季度快照 (若有) → 虚线多边形
    const prev = (data.prev && typeof data.prev === 'object') ? data.prev : null;
    const hasPrev = !!prev;
    const prevVals = mods.map(m => (prev ? (prev[m] || 0) : 0) / 100);

    let rings = '';
    for (const lv of [0.25, 0.5, 0.75, 1]) {
      rings += `<polygon points="${poly(mods.map(() => lv))}" fill="none" stroke="var(--background-modifier-border,#E2E8F0)" stroke-width="0.7"/>`;
    }
    let axes = '', labels = '', dots = '';
    mods.forEach((m, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      axes += `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" stroke="var(--background-modifier-border,#E2E8F0)" stroke-width="0.7"/>`;
      const lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      labels += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="${anchor}" class="tw-radar-axlabel">${RADAR_LABELS[m] || m}</text>`;
      const r = scoreMap[m];
      if (r) {
        const [px, py] = pt(i, r.score / 100).split(',');
        dots += `<circle cx="${px}" cy="${py}" r="2.6" class="tw-radar-dot"><title>${m} · 文档 ${r.D} · Jira ${r.J} · 近90天 ${r.A} · raw ${Number(r.raw).toFixed(1)}</title></circle>`;
      }
    });
    const prevPoly = hasPrev
      ? `<polygon points="${poly(prevVals)}" fill="none" stroke="var(--text-muted,#64748B)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`
      : '';
    host.createDiv({ cls: 'tw-radar-svg' }).innerHTML =
      `<svg viewBox="0 0 ${size} ${size}" class="tw-radar-plot" role="img" aria-label="能力雷达">
        ${rings}${axes}
        ${prevPoly}
        <polygon points="${poly(curVals)}" class="tw-radar-area"/>
        ${dots}${labels}
      </svg>`;
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

module.exports = { TopicView };
