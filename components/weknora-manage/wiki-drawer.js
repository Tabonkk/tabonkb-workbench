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
    this.onClose = options.onClose || (() => {});

    // LRU 缓存 (slug -> { title, pageType, summary, content, cachedAt })
    this.lruCache = new Map();
    this.lruMax = 50;

    // 图片 Blob URL 缓存 (filePath -> blobUrl)
    this.imageCache = new Map();

    this.currentNode = null;
    this.currentKbId = null;
    this.abortController = null;
    this.isOpen = false;

    this.initDOM();
  }

  initDOM() {
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'tw-weknora-wiki-drawer';
    this.drawerEl.style.transform = 'translateX(100%)';
    this.parentEl.appendChild(this.drawerEl);
  }

  async open(node, kbId) {
    if (!node) return;
    this.currentNode = node;
    this.currentKbId = kbId;
    this.isOpen = true;
    this.drawerEl.style.transform = 'translateX(0)';

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
    if (this.abortController) {
      try { this.abortController.abort(); } catch (e) {}
      this.abortController = null;
    }
    if (this.drawerEl) {
      this.drawerEl.style.transform = 'translateX(100%)';
    }
    this.onClose();
  }

  renderLoading(node) {
    this.drawerEl.innerHTML = `
      <div class="tw-drawer-header">
        <div class="tw-drawer-title-row">
          <span class="tw-drawer-title" title="${escapeHtml(node.title)}">${escapeHtml(node.title)}</span>
          <button class="tw-drawer-close-btn" id="btnWikiDrawerClose" title="关闭 (Esc)">✕</button>
        </div>
        <div class="tw-drawer-meta-row">
          <span class="tw-chip" style="background:${node.color}22; color:${node.color}; font-size:11px; padding:2px 8px;">
            ${escapeHtml(node.pageType || 'entity')}
          </span>
          <span class="tw-drawer-degree">关联度: ${node.degree || 0}</span>
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
      <div class="tw-drawer-header">
        <div class="tw-drawer-title-row">
          <span class="tw-drawer-title">${escapeHtml(node.title)}</span>
          <button class="tw-drawer-close-btn" id="btnWikiDrawerClose" title="关闭 (Esc)">✕</button>
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
    if (retryBtn) retryBtn.onclick = () => this.open(node, this.currentKbId);
  }

  async renderContent(node, pageData) {
    const pType = pageData.pageType || node.pageType || 'entity';
    const title = pageData.title || node.title || node.slug;
    const content = pageData.content || pageData.summary || '> 暂无正文内容。';

    this.drawerEl.innerHTML = `
      <div class="tw-drawer-header">
        <div class="tw-drawer-title-row">
          <span class="tw-drawer-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          <button class="tw-drawer-close-btn" id="btnWikiDrawerClose" title="关闭 (Esc)">✕</button>
        </div>
        <div class="tw-drawer-meta-row">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="tw-chip" style="background:${node.color}22; color:${node.color}; font-size:11px; padding:2px 8px; font-weight:600;">
              ${escapeHtml(pType)}
            </span>
            <span class="tw-drawer-degree" title="全库与该实体关联的边数量">全库度数: ${node.degree || 0}</span>
          </div>
          <button class="tw-drawer-ego-btn" id="btnWikiDrawerEgo" title="进入 Ego 模式，聚焦展示该节点的关联网络">
            <span>展开邻居</span>
          </button>
        </div>
      </div>
      <div class="tw-drawer-body">
        ${pageData.summary ? `<div class="tw-drawer-summary-box">${escapeHtml(pageData.summary)}</div>` : ''}
        <div class="tw-drawer-markdown-render markdown-rendered"></div>
      </div>
    `;

    this.bindHeaderEvents(node);

    // Ego 展开触发
    const egoBtn = this.drawerEl.querySelector('#btnWikiDrawerEgo');
    if (egoBtn) {
      egoBtn.onclick = () => this.onExpandEgo(node);
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
