/* ==========================================================================
   WeKnora Wiki Drawer — Wiki 实体详情侧边滑出抽屉
   特性:
   1. 50 篇内存 LRU 缓存: 重复打开秒级呈现, 避免频繁网络调用
   2. Obsidian 原生渲染: 调用 MarkdownRenderer 完整呈现正文、参数表格与引用
   3. Ego 展开入口: 快速触发以当前节点为中心的子图探索
   4. 超时保护: 5 秒超时保护与 AbortController 防挂起
   ========================================================================== */

class WeKnoraWikiDrawer {
  /**
   * @param {HTMLElement} parentEl
   * @param {object} options
   */
  constructor(parentEl, options = {}) {
    this.parentEl = parentEl;
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.service = options.service;
    this.onExpandEgo = options.onExpandEgo || (() => {});
    this.onExitEgo = options.onExitEgo || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onDrawerStateChange = options.onDrawerStateChange || null;

    // LRU 缓存 (slug -> { title, pageType, summary, content, cachedAt })
    this.lruCache = new Map();
    this.lruMax = 50;

    // 图片 Blob URL 缓存 (filePath -> blobUrl)
    this.imageCache = new Map();

    this.currentNode = null;
    this.currentKbId = null;
    this.abortController = null;
    this.isOpen = false;
    this.isEgoMode = false;
    this.isEgoCenter = false;

    this.initDOM();
  }

  initDOM() {
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'tw-weknora-wiki-drawer';
    this.drawerEl.style.transform = 'translateX(100%)';
    this.parentEl.appendChild(this.drawerEl);
  }

  formatTypeLabel(type) {
    if (!type) return '实体';
    const t = String(type).toLowerCase();
    if (t === 'summary') return '文档摘要';
    if (t === 'entity') return '实体';
    if (t === 'concept') return '概念';
    if (t === 'relation') return '关系';
    if (t === 'topic') return '主题';
    return type;
  }

  async open(node, kbId, options = {}) {
    if (!node) return;
    this.currentNode = node;
    this.currentKbId = kbId;
    this.isEgoMode = options.isEgoMode || false;
    this.isEgoCenter = options.isEgoCenter || false;
    this.isOpen = true;
    this.parentEl?.classList.add('drawer-open');
    this.drawerEl.style.transform = 'translateX(0)';
    if (this.onDrawerStateChange) this.onDrawerStateChange(true);

    this.renderLoading(node);

    // 1. 检查 LRU 缓存
    const cacheKey = `${kbId}::${node.slug}`;
    if (this.lruCache.has(cacheKey)) {
      const cached = this.lruCache.get(cacheKey);
      // 挪到最新位置
      this.lruCache.delete(cacheKey);
      this.lruCache.set(cacheKey, cached);
      this.renderContent(node, cached);
      return;
    }

    // 2. 异步发起请求
    if (this.abortController) {
      try { this.abortController.abort(); } catch (e) {}
    }
    this.abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    try {
      if (!this.service) throw new Error('WeKnora 服务实例未初始化');
      const pageData = await this.service.getWikiPage(kbId, node.slug, 5000);

      // 写入 LRU 缓存
      if (this.lruCache.size >= this.lruMax) {
        const firstKey = this.lruCache.keys().next().value;
        this.lruCache.delete(firstKey);
      }
      this.lruCache.set(cacheKey, pageData);

      // 确保当前节点未被切换
      if (this.currentNode && this.currentNode.slug === node.slug) {
        this.renderContent(node, pageData);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.renderError(node, err.message || String(err));
    }
  }

  close() {
    this.isOpen = false;
    this.currentNode = null;
    this.isEgoCenter = false;
    if (this.abortController) {
      try { this.abortController.abort(); } catch (e) {}
      this.abortController = null;
    }
    if (this.drawerEl) {
      this.drawerEl.style.transform = 'translateX(100%)';
    }
    this.parentEl?.classList.remove('drawer-open');
    if (this.onDrawerStateChange) this.onDrawerStateChange(false);
    this.onClose();
  }

  renderLoading(node) {
    const pType = node.pageType || 'entity';
    const typeLabel = this.formatTypeLabel(pType);
    this.drawerEl.innerHTML = `
      <div class="tw-wiki-drawer-header">
        <div class="tw-wiki-drawer-title-row">
          <div class="tw-wiki-drawer-title" title="${escapeHtml(node.title)}">${escapeHtml(node.title)}</div>
          <button class="tw-wiki-drawer-close-btn" id="btnWikiDrawerClose" title="关闭详情面板 (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="tw-wiki-drawer-meta-row">
          <div class="tw-wiki-drawer-meta-left">
            <span class="tw-wiki-type-badge" style="background:${node.color || '#3B82F6'}1a; color:${node.color || '#3B82F6'}; border: 1px solid ${node.color || '#3B82F6'}33;">
              ${escapeHtml(typeLabel)}
            </span>
            <span class="tw-wiki-meta-pill">关联度 <strong>${node.degree || 0}</strong></span>
          </div>
        </div>
      </div>
      <div class="tw-drawer-body">
        <div class="tw-drawer-loading">
          <div class="tw-drawer-spinner"></div>
          <span>正在拉取 Wiki 知识详情...</span>
        </div>
      </div>
    `;
    this.bindHeaderEvents(node);
  }

  renderError(node, errMsg) {
    this.drawerEl.innerHTML = `
      <div class="tw-wiki-drawer-header">
        <div class="tw-wiki-drawer-title-row">
          <div class="tw-wiki-drawer-title">${escapeHtml(node.title)}</div>
          <button class="tw-wiki-drawer-close-btn" id="btnWikiDrawerClose" title="关闭详情面板 (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="tw-drawer-body">
        <div class="tw-drawer-error">
          <div style="font-size:24px; margin-bottom:8px;">⚠️</div>
          <div style="font-size:13px; font-weight:600; color:#EF4444; margin-bottom:6px;">未能加载 Wiki 内容</div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:14px; font-family:monospace;">${escapeHtml(errMsg)}</div>
          <button class="tw-chip" id="btnWikiDrawerRetry" style="padding:4px 14px; cursor:pointer;">重试</button>
        </div>
      </div>
    `;
    this.bindHeaderEvents(node);
    const retryBtn = this.drawerEl.querySelector('#btnWikiDrawerRetry');
    if (retryBtn) retryBtn.onclick = () => this.open(node, this.currentKbId, { isEgoMode: this.isEgoMode, isEgoCenter: this.isEgoCenter });
  }

  async renderContent(node, pageData) {
    const pType = pageData.pageType || node.pageType || 'entity';
    const typeLabel = this.formatTypeLabel(pType);
    const title = pageData.title || node.title || node.slug;
    const content = pageData.content || pageData.summary || '> 暂无正文内容。';

    this.drawerEl.innerHTML = `
      <div class="tw-wiki-drawer-header">
        <div class="tw-wiki-drawer-title-row">
          <div class="tw-wiki-drawer-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          <button class="tw-wiki-drawer-close-btn" id="btnWikiDrawerClose" title="关闭 (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="tw-wiki-drawer-meta-row">
          <div class="tw-wiki-drawer-meta-left">
            <span class="tw-wiki-type-badge" style="background:${node.color || '#3B82F6'}1a; color:${node.color || '#3B82F6'}; border: 1px solid ${node.color || '#3B82F6'}33;">
              ${escapeHtml(typeLabel)}
            </span>
            <span class="tw-wiki-meta-pill">关联度 <strong>${node.degree || 0}</strong></span>
            ${node.referenceCount ? `<span class="tw-wiki-meta-pill">引用 <strong>${node.referenceCount}</strong></span>` : ''}
          </div>
          <div class="tw-wiki-drawer-actions">
            ${this.getEgoButtonHtml(this.isEgoCenter, this.isEgoMode)}
          </div>
        </div>
      </div>
      <div class="tw-drawer-body">
        ${pageData.summary ? `<div class="tw-drawer-summary-box">${escapeHtml(pageData.summary)}</div>` : ''}
        <div class="tw-drawer-markdown-render markdown-rendered"></div>
      </div>
    `;

    this.bindHeaderEvents(node);

    // Ego 展开/退出触发
    const egoBtn = this.drawerEl.querySelector('#btnWikiDrawerEgo');
    if (egoBtn) {
      this.bindEgoBtnClick(egoBtn, node);
    }

    // Markdown 正文渲染
    const mdWrap = this.drawerEl.querySelector('.tw-drawer-markdown-render');
    if (mdWrap) {
      if (typeof MarkdownRenderer !== 'undefined' && MarkdownRenderer.renderMarkdown) {
        try {
          await MarkdownRenderer.renderMarkdown(content, mdWrap, '', this.app || null);
        } catch (e) {
          mdWrap.textContent = content;
        }
      } else {
        mdWrap.textContent = content;
      }
      // 异步解析 WeKnora 保护图片 (resource://, storage:// 等) 并注入带权限的 Blob URL
      this.hydrateProtectedImages(mdWrap, this.currentKbId);
    }
  }

  async hydrateProtectedImages(containerEl, kbId) {
    if (!containerEl || !this.service) return;
    const effectiveKbId = kbId || this.currentKbId || (this.service && this.service.defaultKb);
    if (!effectiveKbId) return;
    const imgs = containerEl.querySelectorAll('img');
    if (!imgs.length) return;

    const protectedPrefixes = ['resource://', 'storage://', 'local://', 'minio://', 'cos://', 'tos://', 's3://', 'oss://', 'ks3://', 'obs://'];

    for (const img of Array.from(imgs)) {
      const src = (img.getAttribute('src') || '').trim();
      const isProtected = protectedPrefixes.some(p => src.startsWith(p));
      if (!isProtected) continue;

      img.classList.add('tw-wiki-protected-img', 'is-loading');

      // 1. 检查已有 Blob 缓存
      if (this.imageCache.has(src)) {
        img.src = this.imageCache.get(src);
        img.classList.remove('is-loading');
        continue;
      }

      // 2. 向 WeKnora 发起带鉴权头的请求获取二进制，转换为 Blob URL
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
        console.warn('[WeKnora Wiki] 加载图片失败:', src, err.message);
        img.classList.remove('is-loading');
        img.classList.add('is-failed');
        img.title = `图片加载受阻 (${src}): ${err.message}`;
      }
    }
  }

  bindHeaderEvents(node) {
    const closeBtn = this.drawerEl.querySelector('#btnWikiDrawerClose');
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }
  }

  getEgoButtonHtml(isEgoCenter, isEgoMode) {
    if (isEgoCenter) {
      return `
        <button class="tw-drawer-ego-btn ego-back" id="btnWikiDrawerEgo" title="退出专注模式，返回全局图谱">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span>返回全图</span>
        </button>
      `;
    }
    return `
      <button class="tw-drawer-ego-btn" id="btnWikiDrawerEgo" title="${isEgoMode ? '切换并聚焦展示该节点的关联网络' : '进入专注模式，聚焦展示该节点的关联网络'}">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
        <span>${isEgoMode ? '切换专注' : '展开邻居'}</span>
      </button>
    `;
  }

  bindEgoBtnClick(egoBtn, node) {
    if (!egoBtn || !node) return;
    egoBtn.onclick = () => {
      if (this.isEgoCenter && this.onExitEgo) {
        this.onExitEgo();
        this.updateEgoButtonState(false, false);
      } else if (this.onExpandEgo) {
        this.onExpandEgo(node);
        this.updateEgoButtonState(true, true);
      }
    };
  }

  updateEgoButtonState(isEgoCenter, isEgoMode) {
    this.isEgoCenter = isEgoCenter;
    this.isEgoMode = isEgoMode;
    const actionsEl = this.drawerEl?.querySelector('.tw-wiki-drawer-actions');
    if (!actionsEl) return;
    actionsEl.innerHTML = this.getEgoButtonHtml(isEgoCenter, isEgoMode);
    const egoBtn = actionsEl.querySelector('#btnWikiDrawerEgo');
    if (egoBtn && this.currentNode) {
      this.bindEgoBtnClick(egoBtn, this.currentNode);
    }
  }

  dispose() {
    if (this.abortController) {
      try { this.abortController.abort(); } catch (e) {}
      this.abortController = null;
    }
    this.lruCache.clear();
    for (const bUrl of this.imageCache.values()) {
      try { URL.revokeObjectURL(bUrl); } catch (e) {}
    }
    this.imageCache.clear();
    if (this.drawerEl) {
      this.drawerEl.remove();
      this.drawerEl = null;
    }
    this.currentNode = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraWikiDrawer };
}
