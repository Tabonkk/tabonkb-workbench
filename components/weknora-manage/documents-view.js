/* ==========================================================================
   WeKnora Documents View — 知识库资产与文档运维子视图
   功能:
   1. 动态目录分类树 (全库扫描根节点: 01-Platform, 02-OS-Kernel, 03-Driver 等, 带数量 Badge)
   2. 文档资产表格 (标题、格式、大小、解析状态、更新时间)
   3. 全量数据秒级前端检索、多维过滤与精准分页
   4. 专业级文档详情抽屉 (Document Detail Drawer):
      - 完整元数据网格 (ID、格式、物理大小、存储大小、状态、时间)
      - AI 智能摘要 (Obsidian MarkdownRenderer 渲染 + WeKnora 保护图片鉴权)
      - 分块策略参数与实时切片检索 (Hybrid Search)
      - 原始技术元数据 (JSON)
      - 一键复制 ID / 路径 / 标题, 删除文档
   ========================================================================== */

function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes) || bytes === 0) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).slice(0, 19).replace('T', ' ');
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch (e) {
    return String(isoStr).slice(0, 19).replace('T', ' ');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m${secs}s`;
}

function getFriendlySpanName(name) {
  if (!name) return '未知任务';
  if (name === 'knowledge_processing') return '知识处理 (Root)';
  if (name === 'docreader') return '文档解析 (DocReader)';
  if (name === 'chunking') return '文档分块 (Chunking)';
  if (name === 'embedding') return '向量化处理 (Embedding)';
  if (name === 'multimodal') return '多模态识别 (Multimodal)';
  if (name === 'postprocess') return '后处理流水线 (Postprocess)';
  if (name === 'postprocess.question') return '问答对生成 (QA Generation)';
  if (name === 'postprocess.auto_tag') return '自动打标 (Auto Tag)';
  if (name === 'postprocess.summary') return 'AI 摘要提取 (Summary)';
  if (name === 'postprocess.wiki') return 'Wiki 拓扑提取 (Wiki Extract)';
  if (name.startsWith('multimodal.image')) {
    return name.replace('multimodal.', '图像解析: ');
  }
  if (name.startsWith('postprocess.wiki.page')) {
    return name.replace('postprocess.wiki.page', 'Wiki页面: ');
  }
  return name;
}

class WeKnoraDocumentsView {
  /**
   * @param {HTMLElement} parentEl
   * @param {object} options
   */
  constructor(parentEl, options = {}) {
    this.parentEl = parentEl;
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.service = options.service;
    this.getCurrentKbId = options.getCurrentKbId || (() => '');

    this.containerEl = null;
    this.currentPage = 1;
    this.pageSize = 20;
    this.allDocuments = []; // 全库文档缓存
    this.activeCategory = 'all';
    this.filterKeyword = '';
    this.isLoading = false;

    // 流水线 Trace 状态
    this.collapsedSpanIds = new Set();
    this.expandedDetailsSpanIds = new Set();
    this.traceFilterKeyword = '';
    this._initializedTraceCollapse = false;

    // 分类目录列表 (通过 extractCategories 动态填充)
    this.categories = [
      { id: 'all', label: '全部文档', count: 0, icon: '📁' }
    ];

    // 图片 Blob URL 缓存 (filePath -> blobUrl)
    this.imageCache = new Map();

    // 抽屉状态
    this.isDrawerOpen = false;
    this.currentDocDetail = null;
    this.currentDetailTab = 'summary'; // 'summary' | 'chunks' | 'json'

    this.handleKeyDown = (e) => {
      if (e.key === 'Escape' && this.isDrawerOpen) {
        this.closeDocDrawer();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }

    this.initDOM();
  }

  initDOM() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'tw-weknora-docs-wrap';
    this.parentEl.appendChild(this.containerEl);

    this.containerEl.innerHTML = `
      <div class="tw-docs-layout">
        <!-- 左侧分类侧栏 -->
        <div class="tw-docs-sidebar">
          <div class="tw-docs-side-title">目录分类 (Categories)</div>
          <div class="tw-docs-category-list" id="twDocsCategoryList"></div>
        </div>

        <!-- 右侧文档列表区 -->
        <div class="tw-docs-main">
          <div class="tw-docs-toolbar">
            <div class="tw-docs-search-wrap">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input type="text" class="tw-docs-search-input" id="inpDocsFilter" placeholder="搜索文档标题 / ID / 目录路径..." />
            </div>
            <div class="tw-docs-actions">
              <button class="tw-chip" id="btnDocsRefresh" title="从 WeKnora 重新拉取全量文档列表">🔄 刷新</button>
            </div>
          </div>

          <div class="tw-docs-table-wrap" id="twDocsTableContainer">
            <!-- 文档表格由 renderTable 动态填充 -->
          </div>

          <div class="tw-docs-pagination" id="twDocsPagination">
            <!-- 分页由 renderPagination 动态填充 -->
          </div>
        </div>
      </div>

      <!-- 右侧文档详情抽屉与遮罩 -->
      <div class="tw-docs-drawer-mask" id="twDocsDrawerMask"></div>
      <div class="tw-docs-drawer" id="twDocsDrawer">
        <!-- 由 renderDocDetailInDrawer 动态填充 -->
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const searchInput = this.containerEl.querySelector('#inpDocsFilter');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.filterKeyword = (e.target.value || '').trim().toLowerCase();
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      };
    }

    const refreshBtn = this.containerEl.querySelector('#btnDocsRefresh');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        this.loadDocuments().finally(() => refreshBtn.classList.remove('spinning'));
      };
    }

    const mask = this.containerEl.querySelector('#twDocsDrawerMask');
    if (mask) {
      mask.onclick = () => this.closeDocDrawer();
    }
  }

  /**
   * 动态从全库文档中提取真实的一级目录并统计文档数量
   */
  extractCategories() {
    const counts = {};
    const total = this.allDocuments.length;
    let uncategorized = 0;

    for (const d of this.allDocuments) {
      const folder = (d.folder_path || '').trim();
      if (!folder) {
        uncategorized++;
        continue;
      }
      // 提取一级根目录
      const root = folder.split('/')[0].trim();
      if (!root) {
        uncategorized++;
      } else {
        counts[root] = (counts[root] || 0) + 1;
      }
    }

    const getIconForFolder = (folderName) => {
      const f = folderName.toLowerCase();
      if (f.startsWith('01') || f.includes('platform')) return '💻';
      if (f.startsWith('02') || f.includes('kernel') || f.includes('os')) return '🐧';
      if (f.startsWith('03') || f.includes('driver')) return '⚡';
      if (f.startsWith('04') || f.includes('framework')) return '🏗️';
      if (f.startsWith('05') || f.startsWith('06') || f.includes('spec') || f.includes('standard')) return '🛡️';
      if (f.startsWith('07') || f.startsWith('08') || f.includes('tools') || f.includes('util')) return '🛠️';
      if (f.includes('hardware') || f.startsWith('09')) return '🔧';
      if (f.includes('test') || f.includes('cert') || f.startsWith('10')) return '🧪';
      return '📁';
    };

    const sortedRoots = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const list = [
      { id: 'all', label: '全部文档', count: total, icon: '📁' }
    ];

    for (const root of sortedRoots) {
      list.push({
        id: root,
        label: root,
        count: counts[root],
        icon: getIconForFolder(root)
      });
    }

    if (uncategorized > 0) {
      list.push({
        id: '__uncategorized__',
        label: '未分类 / 根目录',
        count: uncategorized,
        icon: '📄'
      });
    }

    this.categories = list;

    // 检查 activeCategory 是否仍合法
    if (this.activeCategory !== 'all' && !this.categories.some(c => c.id === this.activeCategory)) {
      this.activeCategory = 'all';
    }
  }

  renderCategorySidebar() {
    const listEl = this.containerEl.querySelector('#twDocsCategoryList');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (const cat of this.categories) {
      const item = document.createElement('button');
      item.className = `tw-docs-cat-btn ${this.activeCategory === cat.id ? 'active' : ''}`;
      item.innerHTML = `
        <span class="tw-docs-cat-icon">${cat.icon}</span>
        <span class="tw-docs-cat-label" title="${escapeHtml(cat.label)}">${escapeHtml(cat.label)}</span>
        <span class="tw-docs-cat-badge">${cat.count != null ? cat.count : 0}</span>
      `;
      item.onclick = () => {
        if (this.activeCategory === cat.id) return;
        this.activeCategory = cat.id;
        this.currentPage = 1;
        this.renderCategorySidebar();
        this.renderTable();
        this.renderPagination();
      };
      listEl.appendChild(item);
    }
  }

  async loadDocuments() {
    const kbId = this.getCurrentKbId();
    if (!kbId) return;

    this.isLoading = true;
    this.renderTableLoading();

    try {
      if (!this.service) throw new Error('WeKnora 服务未初始化');
      // 拉取知识库全量文档建立前端秒级索引
      const allDocs = await this.service.listAllKnowledge(kbId);
      this.allDocuments = allDocs || [];
      this.isLoading = false;

      this.extractCategories();
      this.renderCategorySidebar();
      this.renderTable();
      this.renderPagination();
    } catch (err) {
      this.isLoading = false;
      this.renderTableError(err.message || String(err));
    }
  }

  renderTableLoading() {
    const container = this.containerEl.querySelector('#twDocsTableContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="tw-drawer-loading" style="padding: 48px 0;">
        <div class="tw-drawer-spinner"></div>
        <span>正在拉取知识库全量文档资产...</span>
      </div>
    `;
  }

  renderTableError(errMsg) {
    const container = this.containerEl.querySelector('#twDocsTableContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="tw-drawer-error" style="padding: 36px 0;">
        <div style="font-size:26px; margin-bottom:8px;">⚠️</div>
        <div style="font-size:13px; font-weight:600; color:#EF4444; margin-bottom:6px;">未能加载文档清单</div>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:14px; font-family:monospace;">${escapeHtml(errMsg)}</div>
        <button class="tw-chip" id="btnDocsRetry" style="padding:4px 14px; cursor:pointer;">点击重试</button>
      </div>
    `;
    const retryBtn = container.querySelector('#btnDocsRetry');
    if (retryBtn) retryBtn.onclick = () => this.loadDocuments();
  }

  getFilteredDocuments() {
    let list = this.allDocuments;
    if (this.activeCategory !== 'all') {
      if (this.activeCategory === '__uncategorized__') {
        list = list.filter(d => !(d.folder_path && d.folder_path.trim()));
      } else {
        list = list.filter(d => {
          const folder = (d.folder_path || '').trim();
          return folder.startsWith(this.activeCategory) || folder.includes(this.activeCategory);
        });
      }
    }
    if (this.filterKeyword) {
      const kw = this.filterKeyword;
      list = list.filter(d =>
        (d.title || '').toLowerCase().includes(kw) ||
        (d.file_name || '').toLowerCase().includes(kw) ||
        (d.id || '').toLowerCase().includes(kw) ||
        (d.folder_path || '').toLowerCase().includes(kw)
      );
    }
    return list;
  }

  renderTable() {
    const container = this.containerEl.querySelector('#twDocsTableContainer');
    if (!container) return;

    const filtered = this.getFilteredDocuments();

    if (!filtered.length) {
      container.innerHTML = `
        <div class="tw-docs-empty" style="padding: 56px 0; text-align: center; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 8px;">📄</div>
          <div style="font-weight: 600; margin-bottom: 4px;">未找到匹配的文档条目</div>
          <div style="font-size: 11px;">分类:「${escapeHtml(this.activeCategory)}」${this.filterKeyword ? ` · 搜索:「${escapeHtml(this.filterKeyword)}」` : ''}</div>
        </div>
      `;
      return;
    }

    // 分页截取
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + this.pageSize);

    let rowsHtml = '';
    for (const d of pageItems) {
      const type = (d.file_type || d.type || 'MD').toUpperCase();
      const status = d.parse_status || 'completed';
      const isOk = status === 'published' || status === 'completed' || status === 'success';
      const statusBadge = isOk
        ? `<span class="tw-badge-status is-done">已索引</span>`
        : (status === 'processing'
            ? `<span class="tw-badge-status is-progress">解析中</span>`
            : `<span class="tw-badge-status is-block">${escapeHtml(status)}</span>`);

      const sizeStr = formatBytes(d.file_size || d.storage_size);
      const updated = formatDate(d.updated_at || d.processed_at || d.created_at);

      rowsHtml += `
        <tr class="tw-docs-row" data-id="${escapeHtml(d.id)}">
          <td class="tw-docs-td-title">
            <div class="tw-docs-title-text" title="${escapeHtml(d.title || d.file_name || '')}">
              ${escapeHtml(d.title || d.file_name || '无标题文档')}
            </div>
            ${d.folder_path ? `<div class="tw-docs-folder" title="${escapeHtml(d.folder_path)}">${escapeHtml(d.folder_path)}</div>` : ''}
          </td>
          <td><span class="tw-chip" style="font-size:10.5px; padding:1px 6px;">${escapeHtml(type)}</span></td>
          <td style="font-family:monospace; color:var(--text-muted); font-size:11px;">${sizeStr}</td>
          <td>${statusBadge}</td>
          <td style="font-size:11px; color:var(--text-muted); font-family:monospace;" title="${escapeHtml(updated)}">${updated.slice(0, 10)}</td>
          <td class="tw-docs-td-actions">
            <button class="tw-btn-mini btn-view-doc" data-id="${escapeHtml(d.id)}" title="查看文档详情、AI 摘要与切片">详情</button>
            <button class="tw-btn-mini is-danger btn-del-doc" data-id="${escapeHtml(d.id)}" title="从知识库删除此文档">删除</button>
          </td>
        </tr>
      `;
    }

    container.innerHTML = `
      <table class="tw-docs-table">
        <thead>
          <tr>
            <th style="width: 44%;">文档标题</th>
            <th style="width: 11%;">格式</th>
            <th style="width: 12%;">大小</th>
            <th style="width: 11%;">解析状态</th>
            <th style="width: 12%;">更新时间</th>
            <th style="width: 10%;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // 绑定行内按钮事件
    container.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.onclick = () => this.showDocDetail(btn.getAttribute('data-id'));
    });
    container.querySelectorAll('.btn-del-doc').forEach(btn => {
      btn.onclick = () => this.confirmDeleteDoc(btn.getAttribute('data-id'));
    });
  }

  renderPagination() {
    const pagEl = this.containerEl.querySelector('#twDocsPagination');
    if (!pagEl) return;

    const filtered = this.getFilteredDocuments();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    pagEl.innerHTML = `
      <div style="font-size:12px; color:var(--text-muted);">
        当前分类共 <b>${total}</b> 篇 · 全库 <b>${this.allDocuments.length}</b> 篇 · 每页 ${this.pageSize} 篇
      </div>
      <div class="tw-pag-controls">
        <button class="tw-chip" id="btnDocsPrev" ${this.currentPage <= 1 ? 'disabled' : ''}>← 上一页</button>
        <span style="font-size:12px; font-weight:600; font-family:monospace;">${this.currentPage} / ${totalPages}</span>
        <button class="tw-chip" id="btnDocsNext" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页 →</button>
      </div>
    `;

    const prevBtn = pagEl.querySelector('#btnDocsPrev');
    const nextBtn = pagEl.querySelector('#btnDocsNext');
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderTable();
          this.renderPagination();
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.renderTable();
          this.renderPagination();
        }
      };
    }
  }

  // ==========================================================================
  // 文档详情抽屉 (Document Detail Drawer)
  // ==========================================================================

  async showDocDetail(docId) {
    if (!docId || !this.service) return;

    const drawerEl = this.containerEl.querySelector('#twDocsDrawer');
    const maskEl = this.containerEl.querySelector('#twDocsDrawerMask');
    if (!drawerEl || !maskEl) return;

    this.isDrawerOpen = true;
    drawerEl.classList.add('is-open');
    maskEl.classList.add('is-open');

    // 1. 渲染加载中骨架
    drawerEl.innerHTML = `
      <div class="tw-docs-drawer-header">
        <div class="tw-docs-drawer-title-row">
          <span class="tw-docs-drawer-title">加载文档详情中...</span>
          <button class="tw-drawer-close-btn" id="btnCloseDocDrawer" title="关闭 (Esc)">✕</button>
        </div>
      </div>
      <div class="tw-docs-drawer-body">
        <div class="tw-drawer-loading" style="padding: 60px 0;">
          <div class="tw-drawer-spinner"></div>
          <span>正在读取 WeKnora 文档元数据与摘要...</span>
        </div>
      </div>
    `;
    const closeBtn = drawerEl.querySelector('#btnCloseDocDrawer');
    if (closeBtn) closeBtn.onclick = () => this.closeDocDrawer();

    try {
      const doc = await this.service.getKnowledge(docId);
      if (!doc) throw new Error('未获取到有效文档对象');
      this.currentDocDetail = doc;
      this.renderDocDetailInDrawer(doc);
    } catch (err) {
      drawerEl.innerHTML = `
        <div class="tw-docs-drawer-header">
          <div class="tw-docs-drawer-title-row">
            <span class="tw-docs-drawer-title">加载失败</span>
            <button class="tw-drawer-close-btn" id="btnCloseDocDrawer" title="关闭 (Esc)">✕</button>
          </div>
        </div>
        <div class="tw-docs-drawer-body">
          <div class="tw-drawer-error" style="padding: 40px 0;">
            <div style="font-size:26px; margin-bottom:8px;">⚠️</div>
            <div style="font-size:13px; font-weight:600; color:#EF4444; margin-bottom:6px;">未能加载文档详情</div>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:14px; font-family:monospace;">${escapeHtml(err.message || String(err))}</div>
            <button class="tw-chip" id="btnRetryDocDetail" style="padding:4px 14px; cursor:pointer;">重试</button>
          </div>
        </div>
      `;
      const retryBtn = drawerEl.querySelector('#btnRetryDocDetail');
      if (retryBtn) retryBtn.onclick = () => this.showDocDetail(docId);
      const closeB = drawerEl.querySelector('#btnCloseDocDrawer');
      if (closeB) closeB.onclick = () => this.closeDocDrawer();
    }
  }

  closeDocDrawer() {
    this.isDrawerOpen = false;
    const drawerEl = this.containerEl?.querySelector('#twDocsDrawer');
    const maskEl = this.containerEl?.querySelector('#twDocsDrawerMask');
    if (drawerEl) drawerEl.classList.remove('is-open');
    if (maskEl) maskEl.classList.remove('is-open');
  }

  async renderDocDetailInDrawer(doc) {
    const drawerEl = this.containerEl.querySelector('#twDocsDrawer');
    if (!drawerEl) return;

    const title = doc.title || doc.file_name || '无标题文档';
    const type = (doc.file_type || doc.type || 'MD').toUpperCase();
    const folder = doc.folder_path || '根目录 (未设置分类)';
    const status = doc.parse_status || 'completed';
    const isOk = status === 'published' || status === 'completed' || status === 'success';
    const statusBadge = isOk
      ? `<span class="tw-badge-status is-done">已完成</span>`
      : (status === 'processing'
          ? `<span class="tw-badge-status is-progress">解析中</span>`
          : `<span class="tw-badge-status is-block">${escapeHtml(status)}</span>`);

    const fileSizeStr = formatBytes(doc.file_size);
    const storageSizeStr = formatBytes(doc.storage_size);
    const updateTimeStr = formatDate(doc.updated_at || doc.processed_at || doc.created_at);
    const createTimeStr = formatDate(doc.created_at);

    drawerEl.innerHTML = `
      <div class="tw-docs-drawer-header">
        <div class="tw-docs-drawer-title-row">
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            <span class="tw-chip" style="font-size:10px; font-weight:700; padding:2px 6px; flex-shrink:0;">${escapeHtml(type)}</span>
            <span class="tw-docs-drawer-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          </div>
          <button class="tw-drawer-close-btn" id="btnCloseDocDrawer" title="关闭 (Esc)">✕</button>
        </div>

        <div class="tw-docs-drawer-toolbar">
          <div class="tw-docs-drawer-actions-left">
            <button class="tw-chip tw-docs-action-btn" id="btnCopyDocId" title="复制文档 ID">
              <span>📋 复制 ID</span>
            </button>
            <button class="tw-chip tw-docs-action-btn" id="btnCopyDocPath" title="复制相对目录路径">
              <span>📁 复制路径</span>
            </button>
          </div>
          <div class="tw-docs-drawer-actions-right">
            <button class="tw-chip tw-docs-action-btn is-danger" id="btnDrawerDelDoc" title="删除此文档条目">
              <span>🗑️ 删除</span>
            </button>
          </div>
        </div>

        <!-- 核心元数据卡片网格 -->
        <div class="tw-docs-detail-grid">
          <div class="tw-docs-meta-cell">
            <span class="tw-docs-meta-lbl">所属目录</span>
            <span class="tw-docs-meta-val" title="${escapeHtml(folder)}">${escapeHtml(folder)}</span>
          </div>
          <div class="tw-docs-meta-cell">
            <span class="tw-docs-meta-lbl">解析状态</span>
            <span class="tw-docs-meta-val">${statusBadge}</span>
          </div>
          <div class="tw-docs-meta-cell">
            <span class="tw-docs-meta-lbl">文件大小</span>
            <span class="tw-docs-meta-val font-mono">${fileSizeStr}</span>
          </div>
          <div class="tw-docs-meta-cell">
            <span class="tw-docs-meta-lbl">存储占用</span>
            <span class="tw-docs-meta-val font-mono">${storageSizeStr}</span>
          </div>
          <div class="tw-docs-meta-cell">
            <span class="tw-docs-meta-lbl">创建时间</span>
            <span class="tw-docs-meta-val font-mono" title="${createTimeStr}">${createTimeStr.slice(0, 16)}</span>
          </div>
          <div class="tw-docs-meta-cell">
            <span class="tw-docs-meta-lbl">更新时间</span>
            <span class="tw-docs-meta-val font-mono" title="${updateTimeStr}">${updateTimeStr.slice(0, 16)}</span>
          </div>
        </div>

        <!-- Tab 切换按钮 -->
        <div class="tw-docs-detail-tabs">
          <button class="tw-docs-tab-btn ${this.currentDetailTab === 'summary' ? 'active' : ''}" data-tab="summary">
            <span>📄 AI 智能摘要</span>
          </button>
          <button class="tw-docs-tab-btn ${this.currentDetailTab === 'trace' ? 'active' : ''}" data-tab="trace">
            <span>⏱️ 处理流水线 (Trace)</span>
          </button>
          <button class="tw-docs-tab-btn ${this.currentDetailTab === 'chunks' ? 'active' : ''}" data-tab="chunks">
            <span>🧩 分块与检索测试</span>
          </button>
          <button class="tw-docs-tab-btn ${this.currentDetailTab === 'json' ? 'active' : ''}" data-tab="json">
            <span>⚙️ 原始元数据</span>
          </button>
        </div>
      </div>

      <div class="tw-docs-drawer-body" id="twDocsDrawerBody">
        <!-- Tab 内容将动态注入 -->
      </div>
    `;

    // 绑定头部与控制事件
    const closeBtn = drawerEl.querySelector('#btnCloseDocDrawer');
    if (closeBtn) closeBtn.onclick = () => this.closeDocDrawer();

    const copyIdBtn = drawerEl.querySelector('#btnCopyDocId');
    if (copyIdBtn) {
      copyIdBtn.onclick = () => {
        navigator.clipboard?.writeText(doc.id);
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
        if (NoticeCls) new NoticeCls(`✓ 已复制文档 ID: ${doc.id}`);
      };
    }

    const copyPathBtn = drawerEl.querySelector('#btnCopyDocPath');
    if (copyPathBtn) {
      copyPathBtn.onclick = () => {
        const p = doc.folder_path || '';
        navigator.clipboard?.writeText(p);
        const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
        if (NoticeCls) new NoticeCls(`✓ 已复制路径: ${p || '根目录'}`);
      };
    }

    const delBtn = drawerEl.querySelector('#btnDrawerDelDoc');
    if (delBtn) {
      delBtn.onclick = () => {
        this.closeDocDrawer();
        this.confirmDeleteDoc(doc.id);
      };
    }

    drawerEl.querySelectorAll('.tw-docs-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== this.currentDetailTab) {
          this.currentDetailTab = tab;
          drawerEl.querySelectorAll('.tw-docs-tab-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-tab') === tab);
          });
          this.renderDetailTabContent(doc);
        }
      };
    });

    this.renderDetailTabContent(doc);
  }

  async renderDetailTabContent(doc) {
    const bodyEl = this.containerEl.querySelector('#twDocsDrawerBody');
    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    if (this.currentDetailTab === 'summary') {
      const summaryText = doc.description || (doc.metadata && doc.metadata.content) || '> 知识库中该文档暂未生成 AI 结构化摘要。';
      const wrap = document.createElement('div');
      wrap.className = 'tw-docs-summary-section markdown-rendered';
      bodyEl.appendChild(wrap);

      if (typeof MarkdownRenderer !== 'undefined' && MarkdownRenderer.renderMarkdown) {
        try {
          await MarkdownRenderer.renderMarkdown(summaryText, wrap, '', this.app || null);
        } catch (e) {
          wrap.textContent = summaryText;
        }
      } else {
        wrap.textContent = summaryText;
      }

      this.hydrateProtectedImages(wrap, this.getCurrentKbId());
    } else if (this.currentDetailTab === 'trace') {
      await this.renderTraceTab(doc, bodyEl);
    } else if (this.currentDetailTab === 'chunks') {
      const meta = doc.metadata || {};
      const chunkCfg = meta.process_overrides?.chunking_config || {};
      const parserRules = meta.process_overrides?.parser_engine_rules || [];

      bodyEl.innerHTML = `
        <div class="tw-docs-chunks-wrap">
          <div class="tw-docs-section-title">分块引擎与策略参数</div>
          <div class="tw-docs-chunk-params">
            <div class="tw-chunk-param-card">
              <span class="lbl">切片策略 (Strategy)</span>
              <span class="val">${escapeHtml(chunkCfg.strategy || 'auto')}</span>
            </div>
            <div class="tw-chunk-param-card">
              <span class="lbl">切片大小 (Chunk Size)</span>
              <span class="val font-mono">${chunkCfg.chunk_size || 512}</span>
            </div>
            <div class="tw-chunk-param-card">
              <span class="lbl">重叠长度 (Overlap)</span>
              <span class="val font-mono">${chunkCfg.chunk_overlap || 80}</span>
            </div>
            <div class="tw-chunk-param-card">
              <span class="lbl">父子分块 (Parent-Child)</span>
              <span class="val font-mono">${chunkCfg.enable_parent_child ? `开启 (${chunkCfg.child_chunk_size}/${chunkCfg.parent_chunk_size})` : '未开启'}</span>
            </div>
          </div>

          <div class="tw-docs-section-title" style="margin-top:20px; display:flex; justify-content:space-between; align-items:center;">
            <span>知识库混合检索与切片预览</span>
            <button class="tw-chip" id="btnRunHybridChunkTest" style="font-size:11px; padding:2px 8px; cursor:pointer;">🔍 检索此文档切片</button>
          </div>
          <div id="twDocsChunkHitsWrap" style="margin-top:10px;">
            <div style="font-size:12px; color:var(--text-muted); padding:16px 0; text-align:center;">
              点击上方按钮可触发向量+关键词混合检索，实时调取该文档在 WeKnora 中的切片命中片段
            </div>
          </div>
        </div>
      `;

      const testBtn = bodyEl.querySelector('#btnRunHybridChunkTest');
      if (testBtn) {
        testBtn.onclick = async () => {
          const hitsWrap = bodyEl.querySelector('#twDocsChunkHitsWrap');
          if (!hitsWrap) return;
          hitsWrap.innerHTML = `
            <div class="tw-drawer-loading" style="padding: 24px 0;">
              <div class="tw-drawer-spinner"></div>
              <span>正在调取切片检索...</span>
            </div>
          `;
          try {
            const kbId = this.getCurrentKbId();
            const queryText = (doc.title || doc.file_name || '').slice(0, 30);
            const hits = await this.service.hybridSearch(kbId, queryText, { match_count: 5 });
            if (!hits || !hits.length) {
              hitsWrap.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:12px 0;">未检索到相关切片。</div>`;
              return;
            }
            let hitsHtml = '';
            for (const h of hits) {
              const score = (Number(h.score) || 0).toFixed(3);
              hitsHtml += `
                <div class="tw-docs-chunk-card">
                  <div class="tw-docs-chunk-head">
                    <span class="tw-docs-chunk-title">${escapeHtml(h.knowledge_title || '文档片段')}</span>
                    <span class="tw-docs-chunk-score">相关度: ${score}</span>
                  </div>
                  <div class="tw-docs-chunk-text">${escapeHtml(h.content || '')}</div>
                </div>
              `;
            }
            hitsWrap.innerHTML = hitsHtml;
          } catch (err) {
            hitsWrap.innerHTML = `<div style="font-size:12px; color:#EF4444; padding:12px 0;">检索失败: ${escapeHtml(err.message)}</div>`;
          }
        };
      }
    } else if (this.currentDetailTab === 'json') {
      bodyEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:11px; color:var(--text-muted);">WeKnora API 完整返回载荷</span>
          <button class="tw-chip" id="btnCopyJsonDoc" style="font-size:11px; padding:2px 8px; cursor:pointer;">📋 复制 JSON</button>
        </div>
        <pre class="tw-docs-json-pre"><code>${escapeHtml(JSON.stringify(doc, null, 2))}</code></pre>
      `;
      const copyJsonBtn = bodyEl.querySelector('#btnCopyJsonDoc');
      if (copyJsonBtn) {
        copyJsonBtn.onclick = () => {
          navigator.clipboard?.writeText(JSON.stringify(doc, null, 2));
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
          if (NoticeCls) new NoticeCls(`✓ 已复制完整文档 JSON`);
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 处理流水线 (Trace) 甘特图渲染
  // --------------------------------------------------------------------------
  async renderTraceTab(doc, bodyEl) {
    bodyEl.innerHTML = `
      <div class="tw-drawer-loading" style="padding: 40px 0;">
        <div class="tw-drawer-spinner"></div>
        <span>正在拉取处理流水线 Trace 数据...</span>
      </div>
    `;

    try {
      if (!this.service || !this.service.getKnowledgeSpans) {
        throw new Error('WeKnora 服务未提供流水线接口');
      }
      const spanData = await this.service.getKnowledgeSpans(doc.id);
      if (!spanData || !spanData.trace) {
        bodyEl.innerHTML = `
          <div class="tw-docs-empty" style="padding: 40px 0; text-align: center; color: var(--text-muted);">
            <div style="font-size: 26px; margin-bottom: 8px;">⏱️</div>
            <div>该文档暂无处理流水线 Trace 记录</div>
          </div>
        `;
        return;
      }

      this.currentTraceData = spanData;
      this.renderTraceView(doc, spanData, bodyEl);
    } catch (err) {
      bodyEl.innerHTML = `
        <div class="tw-drawer-error" style="padding: 30px 0;">
          <div style="font-size:24px; margin-bottom:8px;">⚠️</div>
          <div style="font-size:13px; font-weight:600; color:#EF4444; margin-bottom:6px;">未能加载流水线 Trace</div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:14px; font-family:monospace;">${escapeHtml(err.message || String(err))}</div>
          <button class="tw-chip" id="btnRetryTrace" style="padding:4px 14px; cursor:pointer;">点击重试</button>
        </div>
      `;
      const retryBtn = bodyEl.querySelector('#btnRetryTrace');
      if (retryBtn) retryBtn.onclick = () => this.renderTraceTab(doc, bodyEl);
    }
  }

  renderTraceView(doc, spanData, bodyEl) {
    const trace = spanData.trace;
    const rootStartTime = new Date(trace.started_at).getTime();
    const rootEndTime = trace.finished_at ? new Date(trace.finished_at).getTime() : Date.now();
    const totalDurationMs = trace.duration_ms || Math.max(1, rootEndTime - rootStartTime);

    let totalTasks = 0, doneTasks = 0, runningTasks = 0, failedTasks = 0;
    let totalStages = 0, completedStages = 0;

    const countSpans = (span) => {
      totalTasks++;
      const st = span.status;
      if (st === 'done' || st === 'completed' || st === 'success') doneTasks++;
      else if (st === 'running' || st === 'processing') runningTasks++;
      else if (st === 'error' || st === 'failed') failedTasks++;

      if (span.kind === 'stage') {
        totalStages++;
        if (st === 'done' || st === 'completed' || st === 'success') completedStages++;
      }
      if (span.children) {
        for (const c of span.children) countSpans(c);
      }
    };
    countSpans(trace);

    // 默认折叠多于 8 个子节点的深层分支 (例如 multimodal 包含 46 张图片)
    if (!this._initializedTraceCollapse) {
      this._initializedTraceCollapse = true;
      const autoCollapse = (s) => {
        if (s.children && s.children.length > 8 && s.kind !== 'root') {
          this.collapsedSpanIds.add(s.span_id || s.name);
        }
        if (s.children) s.children.forEach(autoCollapse);
      };
      autoCollapse(trace);
    }

    const attempt = spanData.attempt || spanData.current_attempt || 1;
    const summaryLine = `处理流水线，总耗时 <b>${formatDuration(totalDurationMs)}</b>，主流程阶段 <b>${completedStages}/${totalStages}</b>，所有任务：运行中 <b>${runningTasks}</b> / 失败 <b>${failedTasks}</b> / 已完成 <b>${doneTasks}</b>${attempt > 1 ? `，第 <b>${attempt}</b> 次重试` : '，第 1 次执行'}`;

    bodyEl.innerHTML = `
      <div class="tw-trace-wrap">
        <!-- 顶部流水线统计摘要条 -->
        <div class="tw-trace-summary-bar">
          <div class="tw-trace-summary-text">${summaryLine}</div>
          <div class="tw-trace-bar-actions">
            <button class="tw-chip" id="btnToggleExpandAllSpans" style="font-size:11px; padding:2px 8px; cursor:pointer;">
              ${this.collapsedSpanIds.size > 0 ? '展开全部' : '折叠子任务'}
            </button>
            <button class="tw-chip" id="btnRefreshTrace" style="font-size:11px; padding:2px 8px; cursor:pointer;" title="刷新流水线">
              🔄 刷新
            </button>
          </div>
        </div>

        <!-- 任务搜索与操作提示 -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <input type="text" class="tw-docs-search-input" id="inpTraceFilter" placeholder="搜索任务名称 (例如 multimodal, wiki, question)..." 
                 value="${escapeHtml(this.traceFilterKeyword || '')}"
                 style="background:var(--background-secondary, #F8FAFC) !important; border:1px solid var(--background-modifier-border, #E2E8F0) !important; border-radius:4px; padding:3px 8px !important; font-size:11px; width:280px;" />
          <div style="font-size:10.5px; color:var(--text-muted);">
            提示: 点击任务行可展开查看 I/O 详细参数与报文
          </div>
        </div>

        <!-- 甘特图表容器 -->
        <div class="tw-trace-table-container">
          <div class="tw-trace-table-header">
            <div class="tw-trace-head-label">任务节点 / 处理阶段</div>
            <div class="tw-trace-head-ruler">
              <span class="ruler-tick">0ms</span>
              <span class="ruler-tick">${formatDuration(totalDurationMs * 0.25)}</span>
              <span class="ruler-tick">${formatDuration(totalDurationMs * 0.5)}</span>
              <span class="ruler-tick">${formatDuration(totalDurationMs * 0.75)}</span>
              <span class="ruler-tick">${formatDuration(totalDurationMs)}</span>
            </div>
          </div>

          <div class="tw-trace-rows" id="twTraceRowsList">
            <!-- 动态生成各节点行 -->
          </div>
        </div>
      </div>
    `;

    // 绑定顶部按钮
    const refreshBtn = bodyEl.querySelector('#btnRefreshTrace');
    if (refreshBtn) refreshBtn.onclick = () => this.renderTraceTab(doc, bodyEl);

    const toggleExpandBtn = bodyEl.querySelector('#btnToggleExpandAllSpans');
    if (toggleExpandBtn) {
      toggleExpandBtn.onclick = () => {
        if (this.collapsedSpanIds.size > 0) {
          this.collapsedSpanIds.clear();
        } else {
          const collectParents = (s) => {
            if (s.children && s.children.length > 0 && s.kind !== 'root') {
              this.collapsedSpanIds.add(s.span_id || s.name);
            }
            if (s.children) s.children.forEach(collectParents);
          };
          collectParents(trace);
        }
        toggleExpandBtn.textContent = this.collapsedSpanIds.size > 0 ? '展开全部' : '折叠子任务';
        this.renderTraceRows(trace, rootStartTime, totalDurationMs);
      };
    }

    const filterInput = bodyEl.querySelector('#inpTraceFilter');
    if (filterInput) {
      filterInput.oninput = (e) => {
        this.traceFilterKeyword = (e.target.value || '').trim().toLowerCase();
        this.renderTraceRows(trace, rootStartTime, totalDurationMs);
      };
    }

    this.renderTraceRows(trace, rootStartTime, totalDurationMs);
  }

  renderTraceRows(trace, rootStartTime, totalDurationMs) {
    const listEl = this.containerEl.querySelector('#twTraceRowsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const filterKw = (this.traceFilterKeyword || '').trim().toLowerCase();

    const renderSpan = (span, depth) => {
      const spanId = span.span_id || span.name || Math.random().toString();
      const hasChildren = span.children && span.children.length > 0;
      const isCollapsed = this.collapsedSpanIds.has(spanId);
      const isExpandedDetail = this.expandedDetailsSpanIds.has(spanId);

      const friendlyName = getFriendlySpanName(span.name);

      let matchesFilter = true;
      if (filterKw) {
        matchesFilter = (span.name || '').toLowerCase().includes(filterKw) || friendlyName.toLowerCase().includes(filterKw);
      }

      const spanStartTime = span.started_at ? new Date(span.started_at).getTime() : rootStartTime;
      const offsetMs = Math.max(0, spanStartTime - rootStartTime);
      const offsetPct = Math.min(99.5, Math.max(0, (offsetMs / totalDurationMs) * 100));

      const durationMs = span.duration_ms != null ? span.duration_ms : (
        span.finished_at ? Math.max(0, new Date(span.finished_at).getTime() - spanStartTime) : 0
      );
      const widthPct = Math.max(0.6, Math.min(100 - offsetPct, (durationMs / totalDurationMs) * 100));

      const st = span.status || 'done';
      const kind = span.kind || 'stage';

      const tooltip = `${friendlyName}\n节点: ${span.name}\n类型: ${kind}\n状态: ${st}\n耗时: ${formatDuration(durationMs)}\n开始: ${formatDate(span.started_at)}\n结束: ${formatDate(span.finished_at)}`;

      if (matchesFilter || !filterKw) {
        const rowEl = document.createElement('div');
        rowEl.className = 'tw-trace-row';
        rowEl.setAttribute('data-span-id', spanId);

        rowEl.innerHTML = `
          <div class="tw-trace-row-content">
            <div class="tw-trace-left-cell">
              <span class="tw-trace-indent" style="width: ${depth * 16}px;"></span>
              ${hasChildren 
                ? `<button class="tw-trace-chevron-btn" title="${isCollapsed ? '展开子任务' : '折叠子任务'}">${isCollapsed ? '▶' : '▼'}</button>` 
                : `<span class="tw-trace-chevron-placeholder"></span>`
              }
              <span class="tw-trace-status-dot is-${st}" title="状态: ${st}"></span>
              <span class="tw-trace-name" title="${escapeHtml(span.name)}">${escapeHtml(friendlyName)}</span>
              <span class="tw-trace-kind-badge kind-${kind}">${escapeHtml(kind.toUpperCase())}</span>
              <span class="tw-trace-duration">${durationMs > 0 ? formatDuration(durationMs) : (st === 'running' ? '执行中...' : '-')}</span>
            </div>

            <div class="tw-trace-right-cell">
              <div class="tw-trace-track">
                ${offsetPct > 0 ? `
                  <div class="tw-trace-lead-line" style="width: ${offsetPct}%;">
                    ${offsetPct > 18 ? `<span class="tw-trace-lead-text">+${formatDuration(offsetMs)}</span>` : ''}
                  </div>
                ` : ''}
                <div class="tw-trace-bar is-${st}" style="left: ${offsetPct}%; width: ${widthPct}%;" title="${escapeHtml(tooltip)}"></div>
              </div>
            </div>
          </div>

          ${isExpandedDetail ? `
            <div class="tw-trace-detail-panel">
              <div class="tw-trace-detail-grid">
                <div>
                  <span style="color:var(--text-muted); font-size:10px;">开始时间:</span>
                  <span style="font-family:monospace; margin-left:4px;">${formatDate(span.started_at)}</span>
                </div>
                <div>
                  <span style="color:var(--text-muted); font-size:10px;">结束时间:</span>
                  <span style="font-family:monospace; margin-left:4px;">${formatDate(span.finished_at)}</span>
                </div>
              </div>
              ${span.input ? `
                <div style="margin-top:4px;">
                  <span style="color:var(--text-muted); font-size:10px; font-weight:600;">输入参数 (Input):</span>
                  <pre class="tw-trace-json-box"><code>${escapeHtml(JSON.stringify(span.input, null, 2))}</code></pre>
                </div>
              ` : ''}
              ${span.output ? `
                <div style="margin-top:4px;">
                  <span style="color:var(--text-muted); font-size:10px; font-weight:600;">处理结果 (Output):</span>
                  <pre class="tw-trace-json-box"><code>${escapeHtml(JSON.stringify(span.output, null, 2))}</code></pre>
                </div>
              ` : ''}
              ${span.error ? `
                <div style="margin-top:4px; color:#EF4444;">
                  <span style="font-size:10px; font-weight:600;">错误信息 (Error):</span>
                  <div class="tw-trace-json-box" style="color:#EF4444; border-color:rgba(239,68,68,0.3);">${escapeHtml(span.error)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        `;

        const chevronBtn = rowEl.querySelector('.tw-trace-chevron-btn');
        if (chevronBtn) {
          chevronBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.collapsedSpanIds.has(spanId)) {
              this.collapsedSpanIds.delete(spanId);
            } else {
              this.collapsedSpanIds.add(spanId);
            }
            this.renderTraceRows(trace, rootStartTime, totalDurationMs);
          };
        }

        const rowContent = rowEl.querySelector('.tw-trace-row-content');
        if (rowContent) {
          rowContent.onclick = (e) => {
            if (e.target.closest('.tw-trace-chevron-btn')) return;
            if (this.expandedDetailsSpanIds.has(spanId)) {
              this.expandedDetailsSpanIds.delete(spanId);
            } else {
              this.expandedDetailsSpanIds.add(spanId);
            }
            this.renderTraceRows(trace, rootStartTime, totalDurationMs);
          };
        }

        listEl.appendChild(rowEl);
      }

      if (hasChildren && !isCollapsed) {
        for (const child of span.children) {
          renderSpan(child, depth + 1);
        }
      }
    };

    renderSpan(trace, 0);
  }

  async hydrateProtectedImages(containerEl, kbId) {
    if (!containerEl || !this.service) return;
    const effectiveKbId = kbId || this.getCurrentKbId() || (this.service && this.service.defaultKb);
    if (!effectiveKbId) return;
    const imgs = containerEl.querySelectorAll('img');
    if (!imgs.length) return;

    const protectedPrefixes = ['resource://', 'storage://', 'local://', 'minio://', 'cos://', 'tos://', 's3://', 'oss://', 'ks3://', 'obs://'];

    for (const img of Array.from(imgs)) {
      const src = (img.getAttribute('src') || '').trim();
      const isProtected = protectedPrefixes.some(p => src.startsWith(p));
      if (!isProtected) continue;

      img.classList.add('tw-wiki-protected-img', 'is-loading');

      if (this.imageCache.has(src)) {
        img.src = this.imageCache.get(src);
        img.classList.remove('is-loading');
        continue;
      }

      try {
        const fetchUrl = `${this.service.baseUrl}/knowledge-bases/${encodeURIComponent(effectiveKbId)}/files?file_path=${encodeURIComponent(src)}`;
        const res = await fetch(fetchUrl, {
          headers: { 'X-API-Key': this.service.apiKey }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        this.imageCache.set(src, blobUrl);

        if (img.isConnected) {
          img.src = blobUrl;
          img.classList.remove('is-loading');
        }
      } catch (err) {
        console.warn('[WeKnora Docs] 加载图片失败:', src, err.message);
        img.classList.remove('is-loading');
        img.classList.add('is-failed');
        img.title = `图片加载受阻: ${err.message}`;
      }
    }
  }

  async confirmDeleteDoc(docId) {
    if (!docId || !this.service) return;
    const ok = confirm(`确定从 WeKnora 知识库中删除文档 (ID: ${docId}) 吗？此操作不可逆。`);
    if (!ok) return;

    try {
      await this.service.deleteKnowledge(docId);
      const NoticeCls = typeof Notice !== 'undefined' ? Notice : null;
      if (NoticeCls) new NoticeCls(`✓ 已提交删除文档任务`);
      this.loadDocuments();
    } catch (err) {
      alert(`删除失败: ${err.message}`);
    }
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
    for (const bUrl of this.imageCache.values()) {
      try { URL.revokeObjectURL(bUrl); } catch (e) {}
    }
    this.imageCache.clear();
    this.containerEl?.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraDocumentsView };
}
