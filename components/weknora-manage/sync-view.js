/* ==========================================================================
   WeKnora Sync View — 本地笔记与远端知识库双向同步与冲突比对
   特性:
   1. 双向比对表格 (本地新增 / 本地更新 / 远端更新 / 一致)
   2. 忽略机制 (忽略后从正常列表中隐藏，可在“已忽略”视图中查看并随时恢复)
   3. 批量推送影响范围预览浮层 (防误覆盖)
   4. 目录层级 (folder_path) 自动绑定与智能纠偏
   5. 支持 PDF 与 Markdown (超大文档自动转走文件流绕过 20 万字符限制)
   ========================================================================== */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ALL_SYNC_CANDIDATE_FOLDERS = [
  '01-Platform',
  '02-OS-Kernel',
  '03-Driver',
  '04-Debug',
  '05-Toolchain',
  '06-Spec',
  '07-Project',
  '08-Learning',
  '09-Hardware',
  '10-Test-Cert'
];

const DEFAULT_SYNC_FOLDERS = [
  '01-Platform',
  '02-OS-Kernel',
  '03-Driver',
  '04-Debug',
  '05-Toolchain',
  '06-Spec',
  '07-Project'
]; // 默认排除 08-Learning

class WeKnoraSyncView {
  /**
   * @param {HTMLElement} parentEl
   * @param {object} options
   */
  constructor(parentEl, options = {}) {
    this.parentEl = parentEl;
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.plugin = options.plugin || (this.app?.plugins?.getPlugin?.('tabonkb-workbench')) || (this.app?.plugins?.plugins?.['tabonkb-workbench']) || null;
    this.service = options.service;
    this.getCurrentKbId = options.getCurrentKbId || (() => '');

    this.containerEl = null;
    this.diffItems = []; // { file, title, path, folderPath, localMtime, remoteMtime, status, remoteDoc, isIgnored }
    this.selectedPaths = new Set();
    this.isScanning = false;
    this.isPushing = false;
    this.remoteDocsCache = null;

    // 目录范围设置 (默认排除 08-Learning，支持用户自由选择)
    this.enabledFolders = this.loadEnabledFolders();

    // 忽略与视图筛选状态
    this.ignoredPaths = this.loadIgnoredPaths();
    this.viewMode = 'active'; // 'active' (正常未忽略) | 'ignored' (已忽略)
    this.statusFilter = 'pending'; // 默认仅展示待推送项 ('pending' | 'all' | 'LOCAL_NEW' | 'LOCAL_UPDATED' | 'SYNCED')
    this.searchKeyword = '';

    this.initDOM();
  }

  loadEnabledFolders() {
    try {
      const fromSettings = this.plugin?.settings?.weknora?.syncFolders;
      if (Array.isArray(fromSettings) && fromSettings.length > 0) {
        const s = new Set(fromSettings);
        s.delete('08-Learning'); // 08-Learning 不纳入上传
        return s;
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-sync-folders');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const s = new Set(parsed);
            s.delete('08-Learning');
            return s;
          }
        }
      }
    } catch (e) {}
    return new Set(DEFAULT_SYNC_FOLDERS);
  }

  saveEnabledFolders() {
    const list = Array.from(this.enabledFolders);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-sync-folders', JSON.stringify(list));
      }
      if (this.plugin?.settings?.weknora) {
        this.plugin.settings.weknora.syncFolders = list;
        this.plugin.saveSettings?.();
      }
    } catch (e) {}
  }

  loadIgnoredPaths() {
    try {
      const fromSettings = this.plugin?.settings?.weknora?.ignoredSyncPaths;
      if (Array.isArray(fromSettings) && fromSettings.length > 0) {
        return new Set(fromSettings);
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-sync-ignored-paths');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return new Set(parsed);
        }
      }
    } catch (e) {}
    return new Set();
  }

  saveIgnoredPaths() {
    const list = Array.from(this.ignoredPaths);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-sync-ignored-paths', JSON.stringify(list));
      }
      if (this.plugin?.settings?.weknora) {
        this.plugin.settings.weknora.ignoredSyncPaths = list;
        this.plugin.saveSettings?.();
      }
    } catch (e) {}
  }

  ignorePath(path) {
    if (!path) return;
    this.ignoredPaths.add(path);
    this.selectedPaths.delete(path);
    this.saveIgnoredPaths();
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
    if (NoticeCls) new NoticeCls('已忽略该笔记，不再在同步列表中显示');
    this.renderAll();
  }

  unignorePath(path) {
    if (!path) return;
    this.ignoredPaths.delete(path);
    this.saveIgnoredPaths();
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
    if (NoticeCls) new NoticeCls('已恢复该笔记至同步列表');
    this.renderAll();
  }

  initDOM() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'tw-weknora-sync-wrap';
    this.parentEl.appendChild(this.containerEl);

    this.containerEl.innerHTML = `
      <div class="tw-sync-header">
        <div class="tw-sync-summary-left">
          <div class="tw-sync-title">Vault 本地笔记与 WeKnora 知识库同步</div>
          <div class="tw-sync-desc">检测 Obsidian 本地工程文档 (Markdown / PDF) 与 WeKnora 团队知识库文档的差异与版本状态</div>
        </div>
        <div class="tw-sync-actions-right" id="twSyncHeaderActions">
          <!-- 动态操作按钮 -->
        </div>
      </div>

      <div class="tw-sync-kpi-bar" id="twSyncKpiBar">
        <!-- 统计徽章 -->
      </div>

      <div class="tw-sync-filter-bar" id="twSyncFilterBar">
        <!-- 快速过滤与搜索框 -->
      </div>

      <div class="tw-sync-folder-bar" id="twSyncFolderBar">
        <!-- 同步目录范围勾选 -->
      </div>

      <div class="tw-sync-table-wrap" id="twSyncTableWrap">
        <!-- 比对表格 -->
      </div>

      <!-- 批量推送预览浮层 -->
      <div class="tw-sync-modal-mask" id="twSyncModalMask" style="display:none;">
        <div class="tw-sync-modal" id="twSyncModalContent"></div>
      </div>
    `;

    this.renderHeaderActions();
    this.startScan();
  }

  renderAll() {
    this.renderHeaderActions();
    this.renderKpiBar();
    this.renderFilterBar();
    this.renderFolderBar();
    this.renderTable();
  }

  renderHeaderActions() {
    const actionsEl = this.containerEl.querySelector('#twSyncHeaderActions');
    if (!actionsEl) return;

    if (this.viewMode === 'ignored') {
      actionsEl.innerHTML = `
        <button class="tw-chip" id="btnSyncScan" title="扫描本地与远端差异">🔍 重新扫描比对</button>
        <button class="tw-chip is-cta" id="btnBatchUnignore" title="将勾选的笔记批量移出忽略列表">♻️ 批量恢复</button>
        <button class="tw-chip" id="btnBackActive" title="返回正常同步列表">👈 返回同步列表</button>
      `;

      const scanBtn = actionsEl.querySelector('#btnSyncScan');
      if (scanBtn) scanBtn.onclick = () => this.startScan(true);

      const backBtn = actionsEl.querySelector('#btnBackActive');
      if (backBtn) backBtn.onclick = () => {
        this.viewMode = 'active';
        this.statusFilter = 'pending';
        this.renderAll();
      };

      const unignoreBtn = actionsEl.querySelector('#btnBatchUnignore');
      if (unignoreBtn) unignoreBtn.onclick = () => {
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
        const selected = Array.from(this.selectedPaths);
        if (!selected.length) {
          if (NoticeCls) new NoticeCls('请先勾选需要恢复的笔记');
          return;
        }
        selected.forEach(p => this.ignoredPaths.delete(p));
        this.selectedPaths.clear();
        this.saveIgnoredPaths();
        if (NoticeCls) new NoticeCls(`已批量恢复 ${selected.length} 篇笔记至同步列表`);
        this.renderAll();
      };
    } else {
      actionsEl.innerHTML = `
        <button class="tw-chip" id="btnSyncScan" title="扫描本地与远端差异">🔍 重新扫描比对</button>
        <button class="tw-chip" id="btnBatchIgnore" title="将勾选的笔记批量加入忽略列表">🙈 批量忽略</button>
        <button class="tw-chip is-cta" id="btnSyncBatchPush" title="将选中的待推送笔记发布到 WeKnora">🚀 批量推送入库</button>
      `;

      const scanBtn = actionsEl.querySelector('#btnSyncScan');
      if (scanBtn) scanBtn.onclick = () => this.startScan(true);

      const pushBtn = actionsEl.querySelector('#btnSyncBatchPush');
      if (pushBtn) pushBtn.onclick = () => this.openBatchPushPreview();

      const ignoreBtn = actionsEl.querySelector('#btnBatchIgnore');
      if (ignoreBtn) ignoreBtn.onclick = () => {
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
        const selected = Array.from(this.selectedPaths);
        if (!selected.length) {
          if (NoticeCls) new NoticeCls('请先勾选需要忽略的笔记');
          return;
        }
        selected.forEach(p => this.ignoredPaths.add(p));
        this.selectedPaths.clear();
        this.saveIgnoredPaths();
        if (NoticeCls) new NoticeCls(`已批量忽略 ${selected.length} 篇笔记`);
        this.renderAll();
      };
    }
  }

  async startScan(forceRefreshRemote = true) {
    if (this.isScanning) return;
    this.isScanning = true;
    this.renderLoading();

    const kbId = this.getCurrentKbId();
    try {
      // 1. 获取 WeKnora 远端全部文档清单 (支持本地切换目录时复用远端缓存，毫秒级即时比对)
      if (forceRefreshRemote || !this.remoteDocsCache) {
        this.remoteDocsCache = this.service ? await this.service.listAllKnowledge(kbId) : [];
      }
      const remoteDocs = this.remoteDocsCache || [];
      const remoteMap = new Map();
      remoteDocs.forEach(d => {
        const titleKey = (d.title || d.file_name || '').trim().toLowerCase();
        if (titleKey) {
          remoteMap.set(titleKey, d);
          if (titleKey.endsWith('.md')) {
            remoteMap.set(titleKey.slice(0, -3), d);
          } else if (titleKey.endsWith('.pdf')) {
            remoteMap.set(titleKey.slice(0, -4), d);
          }
        }
      });

      // 2. 扫描本地 Obsidian Markdown 与 PDF 文件 (基于用户已勾选的目录范围)
      const supportedExts = new Set(['md', 'pdf']);
      const allFiles = this.app?.vault?.getFiles?.() || [];
      const vaultFiles = allFiles.filter(f => supportedExts.has((f.extension || '').toLowerCase()));

      const targetFiles = vaultFiles.filter(f => {
        return Array.from(this.enabledFolders).some(folder => f.path.startsWith(folder + '/') || f.path.startsWith(folder));
      });

      this.diffItems = [];
      this.selectedPaths.clear();

      for (const f of targetFiles) {
        const ext = (f.extension || '').toLowerCase();
        const baseTitle = f.basename.trim().toLowerCase();
        const fullName = f.name.trim().toLowerCase();
        const localMtime = f.stat?.mtime || 0;
        const remoteDoc = remoteMap.get(fullName) || remoteMap.get(baseTitle);

        // 计算本地所属目录 (如 03-Driver/04-USB/01-Arch-Principle)
        const localFolder = (f.parent?.path && f.parent.path !== '/') 
          ? f.parent.path 
          : (f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '');

        let status = 'LOCAL_NEW';
        let remoteMtime = 0;

        if (remoteDoc) {
          remoteMtime = remoteDoc.updated_at ? new Date(remoteDoc.updated_at).getTime() : 0;
          const remoteFolder = (remoteDoc.folder_path || '').trim();
          const folderMismatch = Boolean(localFolder && (!remoteFolder || remoteFolder !== localFolder));

          if (folderMismatch) {
            status = 'LOCAL_UPDATED'; // 目录不一致，需同步纠偏至正确目录
          } else if (localMtime > remoteMtime + 5000) {
            status = 'LOCAL_UPDATED'; // 本地笔记在推送后有新编辑，需重新推送更新
          } else {
            // 单向推送模型：Obsidian 为工程知识库唯一真源，远端时间由 WeKnora 接收创建生成，远端时间>=本地时间是正常已同步状态
            status = 'SYNCED';
          }
        }

        const isIgnored = this.ignoredPaths.has(f.path);
        const item = {
          file: f,
          title: ext === 'pdf' ? f.name : f.basename,
          path: f.path,
          folderPath: localFolder,
          localMtime,
          remoteMtime,
          status,
          remoteDoc,
          isIgnored
        };

        this.diffItems.push(item);
        if (!isIgnored && (status === 'LOCAL_NEW' || status === 'LOCAL_UPDATED')) {
          this.selectedPaths.add(f.path);
        }
      }

      this.isScanning = false;
      this.renderAll();
    } catch (err) {
      this.isScanning = false;
      this.renderError(err.message || String(err));
    }
  }

  renderLoading() {
    const tableWrap = this.containerEl.querySelector('#twSyncTableWrap');
    if (tableWrap) {
      tableWrap.innerHTML = `
        <div class="tw-drawer-loading" style="padding: 48px 0;">
          <div class="tw-drawer-spinner"></div>
          <span>正在扫描本地 Vault 笔记与 WeKnora 远端差异...</span>
        </div>
      `;
    }
  }

  renderError(msg) {
    const tableWrap = this.containerEl.querySelector('#twSyncTableWrap');
    if (tableWrap) {
      tableWrap.innerHTML = `
        <div class="tw-drawer-error" style="padding: 32px 0;">
          <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
          <div style="font-size: 13px; font-weight:600; color: #EF4444; margin-bottom: 6px;">比对扫描异常</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace; margin-bottom: 12px;">${escapeHtml(msg)}</div>
          <button class="tw-chip" id="btnSyncRetry">重试</button>
        </div>
      `;
      const retryBtn = tableWrap.querySelector('#btnSyncRetry');
      if (retryBtn) retryBtn.onclick = () => this.startScan();
    }
  }

  renderFolderBar() {
    const folderEl = this.containerEl.querySelector('#twSyncFolderBar');
    if (!folderEl) return;

    let chipsHtml = '';
    ALL_SYNC_CANDIDATE_FOLDERS.forEach(folder => {
      const isChecked = this.enabledFolders.has(folder);
      chipsHtml += `
        <button class="tw-chip tw-folder-toggle-chip ${isChecked ? 'is-active' : ''}" 
                data-folder="${escapeHtml(folder)}" 
                style="${isChecked ? 'background:rgba(2,132,199,0.12); color:#0284c7; border-color:#0284c7; font-weight:600;' : 'opacity:0.6;'}"
                title="${isChecked ? '已纳入同步比对，点击取消勾选' : '未纳入同步，点击勾选纳入比对'}">
          ${isChecked ? '✓ ' : '+ '}${escapeHtml(folder)}
        </button>
      `;
    });

    folderEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:8px 12px; margin-bottom:12px; background:var(--background-secondary); border:1px solid var(--background-modifier-border); border-radius:6px; font-size:12px;">
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
          <span style="font-weight:600; color:var(--text-normal); margin-right:4px;">📁 同步目录范围 (${this.enabledFolders.size}/${ALL_SYNC_CANDIDATE_FOLDERS.length}):</span>
          ${chipsHtml}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <a href="#" id="btnResetDefaultFolders" style="font-size:11px; color:var(--text-muted); text-decoration:underline;">重置推荐</a>
          <a href="#" id="btnSelectAllFolders" style="font-size:11px; color:var(--text-muted); text-decoration:underline;">全选</a>
        </div>
      </div>
    `;

    folderEl.querySelectorAll('.tw-folder-toggle-chip').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const f = btn.getAttribute('data-folder');
        if (this.enabledFolders.has(f)) {
          if (this.enabledFolders.size <= 1) {
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
            if (NoticeCls) new NoticeCls('至少保留一个同步目录');
            return;
          }
          this.enabledFolders.delete(f);
        } else {
          this.enabledFolders.add(f);
        }
        this.saveEnabledFolders();
        this.renderFolderBar();
        this.startScan(false);
      };
    });

    const btnReset = folderEl.querySelector('#btnResetDefaultFolders');
    if (btnReset) {
      btnReset.onclick = (e) => {
        e.preventDefault();
        this.enabledFolders = new Set(DEFAULT_SYNC_FOLDERS);
        this.saveEnabledFolders();
        this.renderFolderBar();
        this.startScan(false);
      };
    }

    const btnAll = folderEl.querySelector('#btnSelectAllFolders');
    if (btnAll) {
      btnAll.onclick = (e) => {
        e.preventDefault();
        this.enabledFolders = new Set(ALL_SYNC_CANDIDATE_FOLDERS);
        this.saveEnabledFolders();
        this.renderFolderBar();
        this.startScan(false);
      };
    }
  }

  renderKpiBar() {
    const kpiEl = this.containerEl.querySelector('#twSyncKpiBar');
    if (!kpiEl) return;

    let newCount = 0, updateCount = 0, syncedCount = 0, ignoredCount = 0;
    this.diffItems.forEach(item => {
      if (this.ignoredPaths.has(item.path)) {
        ignoredCount++;
      } else {
        if (item.status === 'LOCAL_NEW') newCount++;
        else if (item.status === 'LOCAL_UPDATED') updateCount++;
        else if (item.status === 'SYNCED') syncedCount++;
      }
    });

    kpiEl.innerHTML = `
      <div class="tw-sync-kpi-item tw-sync-kpi-btn ${this.viewMode === 'active' && this.statusFilter === 'LOCAL_NEW' ? 'is-active' : ''}" data-status="LOCAL_NEW" title="点击过滤：仅看本地新增">
        <span class="tw-sync-kpi-val" style="color:#10B981;">${newCount}</span>
        <span class="tw-sync-kpi-lbl">本地新增 (待入库)</span>
      </div>
      <div class="tw-sync-kpi-item tw-sync-kpi-btn ${this.viewMode === 'active' && this.statusFilter === 'LOCAL_UPDATED' ? 'is-active' : ''}" data-status="LOCAL_UPDATED" title="点击过滤：仅看本地待更新">
        <span class="tw-sync-kpi-val" style="color:#0284C7;">${updateCount}</span>
        <span class="tw-sync-kpi-lbl">本地待更新</span>
      </div>
      <div class="tw-sync-kpi-item tw-sync-kpi-btn ${this.viewMode === 'active' && this.statusFilter === 'SYNCED' ? 'is-active' : ''}" data-status="SYNCED" title="点击过滤：仅看双向一致已入库">
        <span class="tw-sync-kpi-val" style="color:var(--text-muted);">${syncedCount}</span>
        <span class="tw-sync-kpi-lbl">双向一致 (已入库)</span>
      </div>
      <div class="tw-sync-kpi-item tw-sync-kpi-btn ${this.viewMode === 'ignored' ? 'is-active' : ''}" data-mode="ignored" title="点击切换：查看已忽略的笔记列表 (${ignoredCount} 篇)">
        <span class="tw-sync-kpi-val" style="color:var(--text-muted);">${ignoredCount}</span>
        <span class="tw-sync-kpi-lbl">🙈 已忽略</span>
      </div>
    `;

    kpiEl.querySelectorAll('.tw-sync-kpi-btn').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.getAttribute('data-mode');
        const st = btn.getAttribute('data-status');
        if (mode === 'ignored') {
          if (this.viewMode === 'ignored') {
            this.viewMode = 'active';
            this.statusFilter = 'pending';
          } else {
            this.viewMode = 'ignored';
            this.statusFilter = 'all';
          }
        } else if (st) {
          this.viewMode = 'active';
          this.statusFilter = (this.statusFilter === st) ? 'pending' : st;
        }
        this.renderAll();
      };
    });
  }

  renderFilterBar() {
    const filterEl = this.containerEl.querySelector('#twSyncFilterBar');
    if (!filterEl) return;

    let totalActive = 0, pendingCount = 0, syncedCount = 0, ignoredCount = 0;
    this.diffItems.forEach(item => {
      if (this.ignoredPaths.has(item.path)) {
        ignoredCount++;
      } else {
        totalActive++;
        if (item.status === 'LOCAL_NEW' || item.status === 'LOCAL_UPDATED') {
          pendingCount++;
        } else if (item.status === 'SYNCED') {
          syncedCount++;
        }
      }
    });

    filterEl.innerHTML = `
      <div class="tw-sync-filter-left">
        <button class="tw-chip ${this.viewMode === 'active' && this.statusFilter === 'pending' ? 'is-active' : ''}" id="btnFilterPending">待推送 (${pendingCount})</button>
        <button class="tw-chip ${this.viewMode === 'active' && this.statusFilter === 'all' ? 'is-active' : ''}" id="btnFilterAll">全部正常 (${totalActive})</button>
        <button class="tw-chip ${this.viewMode === 'active' && this.statusFilter === 'SYNCED' ? 'is-active' : ''}" id="btnFilterSynced">已同步 (${syncedCount})</button>
        <button class="tw-chip ${this.viewMode === 'ignored' ? 'is-active' : ''}" id="btnFilterIgnored">🙈 查看已忽略 (${ignoredCount})</button>
      </div>
      <div class="tw-sync-filter-right">
        <input type="text" class="tw-sync-search" id="inputSyncSearch" placeholder="🔍 快速检索标题或路径..." value="${escapeHtml(this.searchKeyword || '')}" />
      </div>
    `;

    const btnPending = filterEl.querySelector('#btnFilterPending');
    if (btnPending) btnPending.onclick = () => {
      this.viewMode = 'active';
      this.statusFilter = 'pending';
      this.renderAll();
    };

    const btnAll = filterEl.querySelector('#btnFilterAll');
    if (btnAll) btnAll.onclick = () => {
      this.viewMode = 'active';
      this.statusFilter = 'all';
      this.renderAll();
    };

    const btnSynced = filterEl.querySelector('#btnFilterSynced');
    if (btnSynced) btnSynced.onclick = () => {
      this.viewMode = 'active';
      this.statusFilter = 'SYNCED';
      this.renderAll();
    };

    const btnIgnored = filterEl.querySelector('#btnFilterIgnored');
    if (btnIgnored) btnIgnored.onclick = () => {
      this.viewMode = 'ignored';
      this.statusFilter = 'all';
      this.renderAll();
    };

    const searchInput = filterEl.querySelector('#inputSyncSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchKeyword = e.target.value.trim();
        this.renderTable();
      };
    }
  }

  renderTable() {
    const tableWrap = this.containerEl.querySelector('#twSyncTableWrap');
    if (!tableWrap) return;

    let items = this.diffItems;

    if (this.viewMode === 'ignored') {
      items = items.filter(i => this.ignoredPaths.has(i.path));
    } else {
      items = items.filter(i => !this.ignoredPaths.has(i.path));
      if (this.statusFilter === 'pending') {
        items = items.filter(i => i.status === 'LOCAL_NEW' || i.status === 'LOCAL_UPDATED');
      } else if (this.statusFilter !== 'all') {
        items = items.filter(i => i.status === this.statusFilter);
      }
    }

    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      items = items.filter(i => (i.title || '').toLowerCase().includes(kw) || (i.path || '').toLowerCase().includes(kw));
    }

    if (!items.length) {
      if (this.viewMode === 'ignored') {
        tableWrap.innerHTML = `
          <div style="padding: 48px 0; text-align: center; color: var(--text-muted);">
            <div style="font-size: 24px; margin-bottom: 8px;">🙈</div>
            <div style="font-weight:600; margin-bottom: 4px;">暂无已忽略的笔记</div>
            <div style="font-size: 11px;">在正常同步列表中点击某篇笔记右侧的「忽略」后，将归集在此处。</div>
          </div>
        `;
      } else if (this.searchKeyword) {
        tableWrap.innerHTML = `
          <div style="padding: 48px 0; text-align: center; color: var(--text-muted);">
            <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
            <div>未找到与关键词「${escapeHtml(this.searchKeyword)}」匹配的笔记</div>
          </div>
        `;
      } else if (this.statusFilter === 'pending') {
        tableWrap.innerHTML = `
          <div style="padding: 48px 0; text-align: center; color: var(--text-muted);">
            <div style="font-size: 28px; margin-bottom: 8px;">🎉</div>
            <div style="font-weight:600; font-size: 14px; margin-bottom: 4px; color: var(--text-normal);">所有笔记均已同步完成</div>
            <div style="font-size: 12px;">当前没有待新增或待更新的工程笔记。可点击「全部正常」或「已同步」查看已入库内容。</div>
          </div>
        `;
      } else {
        tableWrap.innerHTML = `
          <div style="padding: 48px 0; text-align: center; color: var(--text-muted);">
            <div style="font-size: 24px; margin-bottom: 8px;">📂</div>
            <div>未发现符合同步规则的工程笔记 (当前已勾选目录: ${escapeHtml(Array.from(this.enabledFolders).join(', '))})</div>
          </div>
        `;
      }
      return;
    }

    let rowsHtml = '';
    for (const item of items) {
      const isChecked = this.selectedPaths.has(item.path);
      const localDate = item.localMtime ? new Date(item.localMtime).toLocaleDateString() : '-';
      const remoteDate = item.remoteMtime ? new Date(item.remoteMtime).toLocaleDateString() : '-';

      let statusBadge = '';
      let actionBtns = '';

      if (this.viewMode === 'ignored') {
        statusBadge = `<span class="tw-badge-status" style="background:var(--background-modifier-border,#E2E8F0); color:var(--text-muted);">已忽略</span>`;
        actionBtns = `
          <button class="tw-btn-mini btn-single-unignore" data-path="${escapeHtml(item.path)}" title="恢复此笔记至正常同步列表">恢复</button>
          <button class="tw-btn-mini btn-single-push" data-path="${escapeHtml(item.path)}" title="手动推送此笔记至 WeKnora">推送</button>
        `;
      } else {
        if (item.status === 'LOCAL_NEW') {
          statusBadge = `<span class="tw-badge-status is-done">本地新增</span>`;
        } else if (item.status === 'LOCAL_UPDATED') {
          statusBadge = `<span class="tw-badge-status is-progress">本地待更新</span>`;
        } else {
          statusBadge = `<span class="tw-badge-status">已同步</span>`;
        }

        actionBtns = `
          <button class="tw-btn-mini btn-single-push" data-path="${escapeHtml(item.path)}" title="推送此笔记至 WeKnora">推送</button>
          <button class="tw-btn-mini btn-single-ignore" data-path="${escapeHtml(item.path)}" title="忽略此笔记，不纳入同步">忽略</button>
        `;
      }

      rowsHtml += `
        <tr class="tw-sync-row" data-path="${escapeHtml(item.path)}">
          <td style="width: 40px; text-align:center;">
            <input type="checkbox" class="chk-sync-item" data-path="${escapeHtml(item.path)}" ${isChecked ? 'checked' : ''} />
          </td>
          <td>
            <div style="font-weight:600; color:var(--text-normal);">${escapeHtml(item.title)}</div>
            <div style="font-size:10.5px; color:var(--text-muted); font-family:monospace;">${escapeHtml(item.path)}</div>
          </td>
          <td style="font-size:11px; font-family:monospace; color:var(--text-muted);">${localDate}</td>
          <td style="font-size:11px; font-family:monospace; color:var(--text-muted);">${remoteDate}</td>
          <td>${statusBadge}</td>
          <td style="white-space: nowrap;">${actionBtns}</td>
        </tr>
      `;
    }

    tableWrap.innerHTML = `
      <table class="tw-docs-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align:center;">
              <input type="checkbox" id="chkSyncAll" ${this.selectedPaths.size > 0 && items.every(i => this.selectedPaths.has(i.path)) ? 'checked' : ''} />
            </th>
            <th style="width: 40%;">文件名 / 本地路径</th>
            <th style="width: 15%;">本地修改时间</th>
            <th style="width: 15%;">远端修改时间</th>
            <th style="width: 15%;">同步状态</th>
            <th style="width: 15%;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // 绑定 Checkbox 事件
    const allChk = tableWrap.querySelector('#chkSyncAll');
    if (allChk) {
      allChk.onchange = (e) => {
        const checked = e.target.checked;
        items.forEach(i => {
          if (checked) this.selectedPaths.add(i.path);
          else this.selectedPaths.delete(i.path);
        });
        tableWrap.querySelectorAll('.chk-sync-item').forEach(c => {
          c.checked = checked;
        });
      };
    }

    tableWrap.querySelectorAll('.chk-sync-item').forEach(c => {
      c.onchange = (e) => {
        const p = c.getAttribute('data-path');
        if (e.target.checked) this.selectedPaths.add(p);
        else this.selectedPaths.delete(p);
      };
    });

    tableWrap.querySelectorAll('.btn-single-push').forEach(b => {
      b.onclick = () => {
        const p = b.getAttribute('data-path');
        const item = this.diffItems.find(i => i.path === p);
        if (item) this.pushDocuments([item]);
      };
    });

    tableWrap.querySelectorAll('.btn-single-ignore').forEach(b => {
      b.onclick = () => {
        const p = b.getAttribute('data-path');
        this.ignorePath(p);
      };
    });

    tableWrap.querySelectorAll('.btn-single-unignore').forEach(b => {
      b.onclick = () => {
        const p = b.getAttribute('data-path');
        this.unignorePath(p);
      };
    });
  }

  // 批量推送预览浮层
  openBatchPushPreview() {
    const selected = this.diffItems.filter(i => this.selectedPaths.has(i.path) && !this.ignoredPaths.has(i.path));
    if (!selected.length) {
      const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
      if (NoticeCls) new NoticeCls('请先勾选需要推送的笔记');
      return;
    }

    let newCount = 0, updateCount = 0;
    selected.forEach(i => {
      if (i.status === 'LOCAL_NEW') newCount++;
      else updateCount++;
    });

    const mask = this.containerEl.querySelector('#twSyncModalMask');
    const modal = this.containerEl.querySelector('#twSyncModalContent');
    if (!mask || !modal) return;

    modal.innerHTML = `
      <div style="font-size:15px; font-weight:700; margin-bottom:10px;">批量推送影响范围确认</div>
      <div style="font-size:12.5px; color:var(--text-muted); line-height:1.6; margin-bottom:16px;">
        即将把选中的 <strong>${selected.length}</strong> 篇本地笔记发布至 WeKnora 知识库：<br/>
        • <strong>${newCount}</strong> 篇将作为新文档入库<br/>
        • <strong>${updateCount}</strong> 篇将更新远端已有文档<br/>
        发布状态默认为 <code>publish</code>（自动绑定目标分类目录并建立向量索引）。
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="tw-chip" id="btnCancelBatchPush">取消</button>
        <button class="tw-chip is-cta" id="btnConfirmBatchPush">确认开始推送</button>
      </div>
    `;

    mask.style.display = 'flex';

    modal.querySelector('#btnCancelBatchPush').onclick = () => {
      mask.style.display = 'none';
    };
    modal.querySelector('#btnConfirmBatchPush').onclick = () => {
      mask.style.display = 'none';
      this.pushDocuments(selected);
    };
  }

  async pushDocuments(items = []) {
    if (!items.length || this.isPushing) return;
    this.isPushing = true;
    const kbId = this.getCurrentKbId();

    const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
    let successCount = 0;
    let failCount = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      try {
        const ext = (item.file.extension || '').toLowerCase();
        const folderPath = item.folderPath || ((item.file.parent?.path && item.file.parent.path !== '/') 
          ? item.file.parent.path 
          : (item.file.path.includes('/') ? item.file.path.substring(0, item.file.path.lastIndexOf('/')) : ''));

        if (ext === 'pdf') {
          if (item.status === 'LOCAL_UPDATED' && item.remoteDoc?.id) {
            try { await this.service.deleteKnowledge(item.remoteDoc.id); } catch (delErr) { console.warn('删除旧版文件失败:', delErr); }
          }
          const arrayBuffer = await this.app.vault.readBinary(item.file);
          await this.service.uploadFile(kbId, item.file.name, arrayBuffer, 'application/pdf', folderPath);
        } else {
          const content = await this.app.vault.read(item.file);
          // 若内容超过 180,000 字符（如含内联 Base64 图片），通过文件上传接口规避 Weknora 20万字符限制
          if (content.length > 180000) {
            if (item.status === 'LOCAL_UPDATED' && item.remoteDoc?.id) {
              try { await this.service.deleteKnowledge(item.remoteDoc.id); } catch (delErr) { console.warn('删除旧版文件失败:', delErr); }
            }
            const arrayBuffer = await this.app.vault.readBinary(item.file);
            await this.service.uploadFile(kbId, item.file.name, arrayBuffer, 'text/markdown; charset=utf-8', folderPath);
          } else {
            if (item.status === 'LOCAL_NEW') {
              await this.service.createManual(kbId, item.title, content, 'publish', folderPath);
            } else if (item.remoteDoc) {
              await this.service.updateManual(item.remoteDoc.id, content, item.title, 'publish', kbId, folderPath);
            }
          }
        }
        successCount++;
      } catch (e) {
        console.warn(`[WeKnora Sync] 推送 ${item.title} 失败:`, e);
        failCount++;
      }
    }

    this.isPushing = false;
    if (NoticeCls) {
      new NoticeCls(`推送完成！成功: ${successCount} 篇, 失败: ${failCount} 篇`);
    }
    this.startScan();
  }

  dispose() {
    this.containerEl?.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraSyncView };
}
