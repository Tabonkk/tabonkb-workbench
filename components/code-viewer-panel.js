/* ==========================================================================
   CodeViewerPanel — Agent 对话框右侧内嵌代码检视与编辑器组件 (双模引擎 + Notepad++ 查找)
   特性:
   1. 双模引擎架构：原生高性能内核 (零延迟即时呈现) + 本地 Monaco Editor 增强
   2. 彻底根除空白黑屏：点击文件 0 延迟秒级上屏，自动计算行号并居中聚焦目标行
   3. 完美适配工作台主题：深度集成莫兰迪/标准工程皮肤，支持亮色/深色自适应
   4. Notepad++ 风格全局查找：精准区分大小写/全词/正则，具备"在当前文件中查找"与底部结果底座
   5. 远端代码智能回退：支持本地磁盘读取及企业 OpenGrok 远端只读镜像秒级拉取
   6. 极简防御设计：默认只读模式防误触，支持一键切换编辑并 Ctrl+S 安全写回磁盘
   7. 外部双轨联动：一键调起本地 Notepad++ 或 VS Code 直达目标行
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const http = require('http');
const child_process = require('child_process');

class CodeViewerPanel {
  /**
   * @param {object} options
   * @param {any} [options.app]
   * @param {string} [options.vaultBasePath]
   * @param {function} [options.onClose]
   * @param {function} [options.onFileSaved]
   */
  constructor(options = {}) {
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.vaultBasePath = options.vaultBasePath || (this.app?.vault?.adapter?.basePath) || 'd:\\work\\Mgmt\\TabonKB';
    this.onClose = options.onClose || null;
    this.onFileSaved = options.onFileSaved || null;

    this.containerEl = null;
    this.headerEl = null;
    this.searchBarEl = null;
    this.bodyEl = null;
    this.searchDockEl = null;
    this.nativeViewerEl = null;
    this.editWrapEl = null;
    this.textareaEl = null;
    this.iframeEl = null;

    this.currentFilePath = '';
    this.currentLine = 1;
    this.currentContent = '';
    this.isReadOnly = true;
    this.isModified = false;
    this.isRemote = false;
    this.remoteSource = '';
    this.remoteLinuxPath = '';
    this.remoteServer = null;
    this.isMonacoActive = false;

    // Notepad++ 查找功能状态
    this.isSearchOpen = false;
    this.isSearchDockOpen = false;
    this.searchQuery = '';
    this.searchMode = 'normal'; // 'normal' | 'extended' | 'regex'
    this.searchOptions = {
      matchCase: false,
      wholeWord: false
    };
    this.searchMatches = []; // [{ line, col, length }]
    this.currentMatchIdx = -1;
    this.dockSearchResults = []; // [{ line, text }]
    this.dockFilterQuery = ''; // 结果二次过滤 (支持正则表达式)

    this._messageHandler = null;
    this._themeObserver = null;
    this._keyHandler = null;

    this.initMessageListener();
    this.initThemeObserver();
  }

  getTheme() {
    if (typeof document === 'undefined') return 'vs-dark';
    const isLight = document.body.classList.contains('theme-light') ||
                    document.documentElement.getAttribute('data-theme') === 'light';
    return isLight ? 'vs' : 'vs-dark';
  }

  initThemeObserver() {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    this._themeObserver = new MutationObserver(() => {
      this.syncTheme();
    });
    this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  syncTheme() {
    const theme = this.getTheme();
    if (this.nativeViewerEl) {
      if (theme === 'vs') {
        this.nativeViewerEl.classList.add('is-light-theme');
        this.nativeViewerEl.classList.remove('is-dark-theme');
      } else {
        this.nativeViewerEl.classList.add('is-dark-theme');
        this.nativeViewerEl.classList.remove('is-light-theme');
      }
    }
    if (this.editWrapEl) {
      if (theme === 'vs') {
        this.editWrapEl.classList.add('is-light-theme');
        this.editWrapEl.classList.remove('is-dark-theme');
      } else {
        this.editWrapEl.classList.add('is-dark-theme');
        this.editWrapEl.classList.remove('is-light-theme');
      }
    }
    if (this.iframeEl?.contentWindow && this.isMonacoActive) {
      try {
        this.iframeEl.contentWindow.postMessage({ type: 'set-theme', theme: theme }, '*');
      } catch (_) {}
    }
  }

  initMessageListener() {
    if (typeof window === 'undefined') return;

    this._messageHandler = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'monaco-host-ready') {
        this.isMonacoActive = true;
        this.syncToMonaco();
      } else if (data.type === 'monaco-save-request') {
        this.saveContent(data.code);
      } else if (data.type === 'monaco-content-change') {
        if (!this.isReadOnly && !this.isModified) {
          this.isModified = true;
          this.currentContent = data.code || this.currentContent;
          this.updateHeaderUI();
        }
      } else if (data.type === 'monaco-toggle-find') {
        this.toggleSearchBar();
      }
    };

    window.addEventListener('message', this._messageHandler);
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.containerEl.empty ? this.containerEl.empty() : (this.containerEl.innerHTML = '');
    this.containerEl.classList.add('tw-code-viewer-panel');

    // 1. Header Toolbar
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'tw-code-viewer-header';
    this.containerEl.appendChild(this.headerEl);

    // 2. Notepad++ Style Search Bar
    this.searchBarEl = document.createElement('div');
    this.searchBarEl.className = 'tw-code-search-bar';
    this.searchBarEl.style.display = 'none';
    this.containerEl.appendChild(this.searchBarEl);

    // 3. Body Container
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'tw-code-viewer-body';
    this.containerEl.appendChild(this.bodyEl);

    // 3.1 Native Code Viewer Element (零延迟即时显示)
    this.nativeViewerEl = document.createElement('div');
    this.nativeViewerEl.className = 'tw-code-editor-native';
    this.bodyEl.appendChild(this.nativeViewerEl);

    // 3.2 Native Edit Textarea Wrap (编辑模式备用)
    this.editWrapEl = document.createElement('div');
    this.editWrapEl.className = 'tw-code-edit-wrap';
    this.editWrapEl.style.display = 'none';
    this.editWrapEl.innerHTML = `
      <textarea class="tw-code-textarea" spellcheck="false"></textarea>
    `;
    this.textareaEl = this.editWrapEl.querySelector('textarea');
    this.textareaEl.addEventListener('input', () => {
      if (!this.isModified) {
        this.isModified = true;
        this.updateHeaderUI();
      }
      this.currentContent = this.textareaEl.value;
    });
    this.textareaEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.triggerSave();
      }
    });
    this.bodyEl.appendChild(this.editWrapEl);

    // 3.3 Background Monaco Iframe (通过本地 Companion 服务加载)
    this.initMonacoIframe();

    // 4. Notepad++ Style Bottom Search Dock
    this.searchDockEl = document.createElement('div');
    this.searchDockEl.className = 'tw-code-search-dock';
    this.searchDockEl.style.display = 'none';
    this.containerEl.appendChild(this.searchDockEl);

    // 5. Global Keyboard Shortcuts (Ctrl+F)
    this._keyHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (this.containerEl && this.containerEl.contains(e.target)) {
          e.preventDefault();
          this.toggleSearchBar();
        }
      } else if (e.key === 'Escape' && this.isSearchOpen) {
        this.closeSearchBar();
      }
    };
    window.addEventListener('keydown', this._keyHandler);

    this.renderHeader();
    this.renderSearchBar();
    this.syncTheme();
  }

  initMonacoIframe() {
    this.iframeEl = document.createElement('iframe');
    this.iframeEl.className = 'tw-code-monaco-iframe';
    this.iframeEl.setAttribute('frameborder', '0');
    this.iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write');
    this.iframeEl.style.display = 'none'; // 握手就绪前隐藏

    const hostUrl = 'http://127.0.0.1:28123/monaco/editor.html';
    this.iframeEl.src = hostUrl;
    this.bodyEl.appendChild(this.iframeEl);
  }

  renderHeader() {
    if (!this.headerEl) return;
    const baseName = this.currentFilePath ? path.basename(this.currentFilePath) : '未打开代码';
    const relDir = this.currentFilePath ? path.dirname(this.currentFilePath) : '';
    const lineLabel = this.currentLine && this.currentLine > 0 ? `L${this.currentLine}` : '';

    this.headerEl.innerHTML = `
      <div class="tw-code-header-left" title="${escapeAttr(this.currentFilePath || '')}">
        <span class="tw-code-file-icon">${getIconPark('file-code', 14)}</span>
        <span class="tw-code-file-name">${escapeHtml(baseName)}</span>
        ${lineLabel ? `<span class="tw-code-line-badge">${escapeHtml(lineLabel)}</span>` : ''}
        ${this.isRemote ? `<span class="tw-code-remote-badge" title="${escapeAttr(this.remoteSource)}">${this.remoteSource && this.remoteSource.includes('SSH') ? 'SSH' : '远端'}</span>` : ''}
        ${this.isModified ? `<span class="tw-code-dirty-dot" title="有未保存修改">●</span>` : ''}
        <span class="tw-code-file-dir">${escapeHtml(relDir)}</span>
      </div>
      <div class="tw-code-header-actions">
        <button class="tw-code-ghost-btn ${this.isSearchOpen ? 'is-active' : ''}" id="twBtnCodeSearch" title="查找 (Ctrl+F)">
          ${getIconPark('search', 13)}
          <span>查找</span>
        </button>
        <button class="tw-code-ghost-btn ${this.isReadOnly ? 'is-readonly' : 'is-editable'}" id="twBtnToggleMode" title="${this.isReadOnly ? '当前只读，点击解锁编辑' : '当前编辑中，点击切换只读'}">
          ${getIconPark(this.isReadOnly ? 'lock' : 'edit', 13)}
          <span>${this.isReadOnly ? '只读' : '编辑'}</span>
        </button>
        ${!this.isReadOnly ? `
          <button class="tw-code-ghost-btn is-save" id="twBtnSaveFile" title="保存修改 (Ctrl+S)">
            ${getIconPark('check', 13)}
            <span>保存</span>
          </button>
        ` : ''}
        <button class="tw-code-ghost-btn" id="twBtnExternalEditor" title="在外部编辑器 (Notepad++ / VS Code) 中定位打开">
          ${getIconPark('export', 13)}
          <span>外部</span>
        </button>
        <button class="tw-code-ghost-btn is-close" id="twBtnCloseCode" title="关闭 (Esc)">
          ${getIconPark('close', 13)}
        </button>
      </div>
    `;

    this.bindHeaderEvents();
  }

  bindHeaderEvents() {
    const btnSearch = this.headerEl.querySelector('#twBtnCodeSearch');
    if (btnSearch) {
      btnSearch.onclick = (e) => {
        e.stopPropagation();
        this.toggleSearchBar();
      };
    }

    const btnToggle = this.headerEl.querySelector('#twBtnToggleMode');
    if (btnToggle) {
      btnToggle.onclick = (e) => {
        e.stopPropagation();
        this.setReadOnly(!this.isReadOnly);
      };
    }

    const btnSave = this.headerEl.querySelector('#twBtnSaveFile');
    if (btnSave) {
      btnSave.onclick = (e) => {
        e.stopPropagation();
        this.triggerSave();
      };
    }

    const btnExt = this.headerEl.querySelector('#twBtnExternalEditor');
    if (btnExt) {
      btnExt.onclick = (e) => {
        e.stopPropagation();
        this.openInExternalEditor();
      };
    }

    const btnClose = this.headerEl.querySelector('#twBtnCloseCode');
    if (btnClose) {
      btnClose.onclick = (e) => {
        e.stopPropagation();
        if (typeof this.onClose === 'function') {
          this.onClose();
        }
      };
    }
  }

  updateHeaderUI() {
    this.renderHeader();
  }

  /* ==========================================================================
     Notepad++ 风格查找功能实现 (双行极简架构 + 三模检索 + 正则结果底座)
     ========================================================================== */

  renderSearchBar() {
    if (!this.searchBarEl) return;
    this.searchBarEl.innerHTML = `
      <div class="tw-search-bar-inner">
        <!-- 第 1 行：查找目标输入框 + 清除 + 匹配计数 + 上一个/下一个 + 关闭 -->
        <div class="tw-search-row tw-search-row-primary">
          <div class="tw-search-input-wrap">
            <span class="tw-cs-icon">${getIconPark('search', 13)}</span>
            <input type="text" class="tw-cs-input" placeholder="查找目标 (Enter 下一个，Shift+Enter 上一个)..." value="${escapeAttr(this.searchQuery)}">
            <button class="tw-search-clear-btn" id="twBtnClearSearch" title="清空" style="${this.searchQuery ? '' : 'display:none;'}">✕</button>
            <span class="tw-search-count-badge" id="twSearchCountBadge">${this.searchMatches.length > 0 ? `${this.currentMatchIdx + 1} / ${this.searchMatches.length}` : (this.searchQuery ? '0 处' : '')}</span>
          </div>
          <div class="tw-search-row-actions">
            <button class="tw-search-act-btn" id="twBtnFindPrev" title="查找上一个 (Shift+Enter)">${getIconPark('arrow-up', 12)}</button>
            <button class="tw-search-act-btn" id="twBtnFindNext" title="查找下一个 (Enter)">${getIconPark('arrow-down', 12)}</button>
            <button class="tw-search-act-btn is-close" id="twBtnCloseSearch" title="关闭查找栏 (Esc)">${getIconPark('close', 12)}</button>
          </div>
        </div>

        <!-- 第 2 行：Notepad++ 模式分段 (普通/扩展/正则) + 匹配条件 (大小写/全词) + 在当前文件中查找 -->
        <div class="tw-search-row tw-search-row-secondary">
          <div class="tw-search-mode-segmented">
            <button class="tw-mode-pill ${this.searchMode === 'normal' ? 'is-active' : ''}" data-mode="normal" title="普通文本精准匹配">普通</button>
            <button class="tw-mode-pill ${this.searchMode === 'extended' ? 'is-active' : ''}" data-mode="extended" title="扩展转义字符 (\\n, \\r, \\t, \\0, \\\\...)">扩展</button>
            <button class="tw-mode-pill ${this.searchMode === 'regex' ? 'is-active' : ''}" data-mode="regex" title="正则表达式匹配 (Regular Expression)">正则</button>
          </div>
          <div class="tw-search-opts-segmented">
            <button class="tw-opt-pill ${this.searchOptions.matchCase ? 'is-active' : ''}" data-opt="matchCase" title="区分大小写 (Match Case)">Aa</button>
            <button class="tw-opt-pill ${this.searchOptions.wholeWord ? 'is-active' : ''}" data-opt="wholeWord" title="全词匹配 (Whole Word)">\\b</button>
          </div>
          <button class="tw-find-all-btn" id="twBtnFindAll" title="在当前文件中查找全部匹配，展开底部结果底座">
            ${getIconPark('list-two', 12)}
            <span>在当前文件中查找</span>
          </button>
        </div>
      </div>
    `;

    this.bindSearchBarEvents();
  }

  bindSearchBarEvents() {
    const input = this.searchBarEl.querySelector('.tw-cs-input');
    const clearBtn = this.searchBarEl.querySelector('#twBtnClearSearch');

    if (input) {
      input.oninput = () => {
        this.searchQuery = input.value;
        if (clearBtn) clearBtn.style.display = this.searchQuery ? 'inline-flex' : 'none';
        // 大文件全量扫描代价高，做 160ms 防抖避免逐键卡顿
        if (this._searchDeb) clearTimeout(this._searchDeb);
        if ((this.currentContent || '').length > 1024 * 1024) {
          this._searchDeb = setTimeout(() => this.executeQuickSearch(), 160);
        } else {
          this.executeQuickSearch();
        }
      };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            this.navigateMatch(-1);
          } else {
            this.navigateMatch(1);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeSearchBar();
        }
      };
    }

    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        this.searchQuery = '';
        if (input) {
          input.value = '';
          input.focus();
        }
        clearBtn.style.display = 'none';
        this.executeQuickSearch();
      };
    }

    // 模式切换 (普通 / 扩展 / 正则)
    const modeBtns = this.searchBarEl.querySelectorAll('.tw-mode-pill');
    modeBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const mode = btn.getAttribute('data-mode');
        if (mode && this.searchMode !== mode) {
          this.searchMode = mode;
          modeBtns.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.executeQuickSearch();
        }
      };
    });

    // 选项切换 (大小写 / 全词)
    const optBtns = this.searchBarEl.querySelectorAll('.tw-opt-pill');
    optBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const opt = btn.getAttribute('data-opt');
        if (opt && typeof this.searchOptions[opt] !== 'undefined') {
          this.searchOptions[opt] = !this.searchOptions[opt];
          btn.classList.toggle('is-active', this.searchOptions[opt]);
          this.executeQuickSearch();
        }
      };
    });

    const btnPrev = this.searchBarEl.querySelector('#twBtnFindPrev');
    if (btnPrev) btnPrev.onclick = () => this.navigateMatch(-1);

    const btnNext = this.searchBarEl.querySelector('#twBtnFindNext');
    if (btnNext) btnNext.onclick = () => this.navigateMatch(1);

    const btnFindAll = this.searchBarEl.querySelector('#twBtnFindAll');
    if (btnFindAll) btnFindAll.onclick = () => this.executeFindAll();

    const btnClose = this.searchBarEl.querySelector('#twBtnCloseSearch');
    if (btnClose) btnClose.onclick = () => this.closeSearchBar();
  }

  toggleSearchBar() {
    if (this.isSearchOpen) {
      this.closeSearchBar();
    } else {
      this.openSearchBar();
    }
  }

  openSearchBar() {
    this.isSearchOpen = true;
    if (this.searchBarEl) {
      this.searchBarEl.style.display = 'block';
      const input = this.searchBarEl.querySelector('.tw-cs-input');
      if (input) {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 50);
      }
    }
    this.updateHeaderUI();
    if (this.searchQuery) {
      this.executeQuickSearch();
    }
  }

  closeSearchBar() {
    this.isSearchOpen = false;
    if (this.searchBarEl) this.searchBarEl.style.display = 'none';
    this.updateHeaderUI();
  }

  /**
   * 构建检索正则表达式 (支持 普通 / Notepad++ 扩展 / 正则表达式 模式)
   */
  buildSearchRegex() {
    if (!this.searchQuery) return null;
    let flags = this.searchOptions.matchCase ? 'g' : 'gi';
    try {
      let pattern = this.searchQuery;
      if (this.searchMode === 'normal') {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      } else if (this.searchMode === 'extended') {
        // Notepad++ 扩展模式：解析 \n, \r, \t, \0, \\ 等
        pattern = pattern
          .replace(/\\\\/g, '\u0000')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\0/g, '\0')
          .replace(/[.*+?^${}()|[\]]/g, '\\$&')
          .replace(/\u0000/g, '\\\\');
      }
      if (this.searchOptions.wholeWord) {
        pattern = `\\b(?:${pattern})\\b`;
      }
      return new RegExp(pattern, flags);
    } catch (_) {
      return null;
    }
  }

  executeQuickSearch() {
    const countBadge = this.searchBarEl?.querySelector('#twSearchCountBadge');
    const regex = this.buildSearchRegex();
    this.searchMatches = [];
    this.currentMatchIdx = -1;

    if (!regex || !this.currentContent) {
      if (countBadge) countBadge.textContent = this.searchQuery ? '0 处匹配' : '';
      return;
    }

    const lines = this.currentContent.split('\n');
    const r = new RegExp(regex.source, regex.flags);
    for (let l = 0; l < lines.length; l++) {
      const lineText = lines[l];
      let match;
      r.lastIndex = 0;
      while ((match = r.exec(lineText)) !== null) {
        this.searchMatches.push({
          line: l + 1,
          col: match.index + 1,
          length: match[0].length
        });
        if (!r.global) break;
        if (match[0].length === 0) r.lastIndex++; // 零宽匹配防死循环
      }
    }

    if (countBadge) {
      if (this.searchMatches.length === 0) {
        countBadge.textContent = '0 处匹配';
      } else {
        this.currentMatchIdx = 0;
        countBadge.textContent = `1 / ${this.searchMatches.length}`;
        this.jumpToMatch(this.searchMatches[0]);
      }
    }
  }

  navigateMatch(delta) {
    if (this.searchMatches.length === 0) return;
    this.currentMatchIdx = (this.currentMatchIdx + delta + this.searchMatches.length) % this.searchMatches.length;
    const countBadge = this.searchBarEl?.querySelector('#twSearchCountBadge');
    if (countBadge) {
      countBadge.textContent = `${this.currentMatchIdx + 1} / ${this.searchMatches.length}`;
    }
    this.jumpToMatch(this.searchMatches[this.currentMatchIdx]);
  }

  jumpToMatch(match) {
    if (!match) return;
    this.jumpToLine(match.line, match.col);
  }

  // Notepad++ 核心："在当前文件中查找"并呈现底部 dock
  executeFindAll() {
    const regex = this.buildSearchRegex();
    if (!regex || !this.currentContent) {
      if (typeof Notice !== 'undefined') new Notice('请输入有效的查找内容');
      return;
    }

    const lines = this.currentContent.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const r = new RegExp(regex.source, regex.flags);
      if (r.test(lineText)) {
        results.push({
          line: i + 1,
          text: lineText
        });
      }
    }

    this.dockSearchResults = results;
    this.dockFilterQuery = ''; // 重置二次过滤
    this.openSearchDock();
  }

  openSearchDock() {
    this.isSearchDockOpen = true;
    if (!this.searchDockEl) return;
    this.searchDockEl.style.display = 'flex';
    this.renderSearchDock();
  }

  closeSearchDock() {
    this.isSearchDockOpen = false;
    if (this.searchDockEl) this.searchDockEl.style.display = 'none';
  }

  renderSearchDock() {
    if (!this.searchDockEl) return;
    const baseName = this.currentFilePath ? path.basename(this.currentFilePath) : '文件';
    const total = this.dockSearchResults.length;

    // 二次过滤处理 (支持正则表达式)
    let filteredList = this.dockSearchResults;
    let filterRegex = null;
    if (this.dockFilterQuery) {
      try {
        filterRegex = new RegExp(this.dockFilterQuery, 'gi');
        filteredList = this.dockSearchResults.filter(item => {
          const r = new RegExp(filterRegex.source, filterRegex.flags);
          return r.test(item.text);
        });
      } catch (_) {
        const lower = this.dockFilterQuery.toLowerCase();
        filteredList = this.dockSearchResults.filter(item => item.text.toLowerCase().includes(lower));
      }
    }

    let rowsHtml = '';
    const mainRegex = this.buildSearchRegex();

    for (const item of filteredList) {
      let lineTextHtml = escapeHtml(item.text);
      if (mainRegex) {
        try {
          const r = new RegExp(mainRegex.source, mainRegex.flags);
          lineTextHtml = lineTextHtml.replace(r, match => `<span class="tw-code-search-kw">${match}</span>`);
        } catch (_) {}
      }
      if (filterRegex) {
        try {
          const fr = new RegExp(filterRegex.source, filterRegex.flags);
          lineTextHtml = lineTextHtml.replace(fr, match => `<span class="tw-code-filter-kw">${match}</span>`);
        } catch (_) {}
      }

      rowsHtml += `
        <div class="tw-search-res-row" data-line="${item.line}">
          <span class="tw-search-res-num">Line ${item.line}:</span>
          <span class="tw-search-res-code">${lineTextHtml}</span>
        </div>
      `;
    }

    this.searchDockEl.innerHTML = `
      <div class="tw-search-dock-header">
        <div class="tw-dock-header-left">
          <span class="tw-dock-icon">${getIconPark('search', 13)}</span>
          <span class="tw-dock-title">查找结果: "<strong>${escapeHtml(this.searchQuery)}</strong>" (${total} 处)</span>
        </div>
        <!-- 正则表达式二次过滤器 (解决用户：别人是带正则表达式过滤功能的) -->
        <div class="tw-dock-filter-wrap">
          <span class="tw-dock-filter-icon">${getIconPark('filter', 11)}</span>
          <input type="text" class="tw-dock-filter-input" placeholder="过滤结果 (支持正则，如 probe|init)..." value="${escapeAttr(this.dockFilterQuery || '')}">
          <button class="tw-dock-filter-clear" id="twBtnClearDockFilter" title="清空过滤" style="${this.dockFilterQuery ? '' : 'display:none;'}">✕</button>
        </div>
        <div class="tw-dock-header-actions">
          <button class="tw-dock-btn" id="twBtnClearDock" title="清空搜索结果">清空</button>
          <button class="tw-dock-btn is-close" id="twBtnCloseDock" title="关闭面板 (Esc)">✕</button>
        </div>
      </div>
      <div class="tw-search-dock-body">
        <div class="tw-search-dock-group-head">
          <span>📄 ${escapeHtml(baseName)} (${filteredList.length} / ${total} 匹配行${this.dockFilterQuery ? ' · 已正则过滤' : ''})</span>
        </div>
        <div class="tw-search-dock-list">
          ${rowsHtml || '<div class="tw-search-empty-hint">未找到匹配内容</div>'}
        </div>
      </div>
    `;

    // 绑定二次过滤事件
    const filterInput = this.searchDockEl.querySelector('.tw-dock-filter-input');
    if (filterInput) {
      filterInput.oninput = () => {
        this.dockFilterQuery = filterInput.value;
        this.renderSearchDock();
        const nextInput = this.searchDockEl.querySelector('.tw-dock-filter-input');
        if (nextInput) {
          nextInput.focus();
          nextInput.selectionStart = nextInput.selectionEnd = nextInput.value.length;
        }
      };
    }

    const btnClearFilter = this.searchDockEl.querySelector('#twBtnClearDockFilter');
    if (btnClearFilter) {
      btnClearFilter.onclick = (e) => {
        e.stopPropagation();
        this.dockFilterQuery = '';
        this.renderSearchDock();
      };
    }

    const btnClear = this.searchDockEl.querySelector('#twBtnClearDock');
    if (btnClear) {
      btnClear.onclick = () => {
        this.dockSearchResults = [];
        this.dockFilterQuery = '';
        this.renderSearchDock();
      };
    }

    const btnClose = this.searchDockEl.querySelector('#twBtnCloseDock');
    if (btnClose) {
      btnClose.onclick = () => this.closeSearchDock();
    }

    const rows = this.searchDockEl.querySelectorAll('.tw-search-res-row');
    rows.forEach(row => {
      row.onclick = () => {
        rows.forEach(r => r.classList.remove('is-active'));
        row.classList.add('is-active');
        const line = parseInt(row.getAttribute('data-line'), 10);
        this.jumpToLine(line);
      };
    });
  }

  /**
   * 跳转并聚焦高亮指定代码行
   */
  jumpToLine(line, col = 1) {
    this.currentLine = line;
    this.updateHeaderUI();

    // 1. 同步 Monaco (仅在 Monaco 实际接管显示时)
    if (this.isMonacoActive && this.iframeEl?.contentWindow && this.iframeEl.style.display !== 'none') {
      try {
        this.iframeEl.contentWindow.postMessage({
          type: 'reveal-line',
          line: line,
          col: col
        }, '*');
      } catch (_) {}
    }

    // 2. 同步原生视图 (虚拟化：瞬时滚动 + 重绘窗口 + 标记目标行)
    if (this.nativeViewerEl && this.nativeViewerEl.style.display !== 'none' && this._nv) {
      const nv = this._nv;
      nv.targetLine = line;
      const lineH = nv.lineH;
      const maxST = Math.max(0, nv.lines.length * lineH - this.nativeViewerEl.clientHeight);
      const st = (line - 1) * lineH - this.nativeViewerEl.clientHeight / 2 + lineH / 2;
      this.nativeViewerEl.scrollTop = Math.min(Math.max(0, st), maxST);
      this._renderNvWindow(true);
    }
  }

  /* ==========================================================================
     文件加载与远端智能回退
     ========================================================================== */

  /**
   * 打开指定文件并定位到指定行
   * @param {string} filePath 文件绝对路径
   * @param {number} [targetLine=1] 目标行号
   * @param {object} [extraOptions={}] 附加信息 (rawTarget, activeProject)
   */
  async openFile(filePath, targetLine = 1, extraOptions = {}) {
    if (!filePath) return;
    this.currentFilePath = filePath;
    this.currentLine = parseInt(targetLine, 10) || 1;
    this.isModified = false;
    this.isRemote = false;
    this.remoteSource = '';
    this.remoteLinuxPath = '';
    this.remoteServer = null;

    // 打开瞬间即反馈：头部文件名 + 原生视图加载态，消除"点击后等待数秒才打开"的观感
    this.updateHeaderUI();
    this._renderLoadingState();

    // 1. 本地/挂载盘异步读取 (大文件不阻塞主线程)
    //    服务器共享盘 (Y:/Z:/Linux 路径) 用 Promise.race 竞速读：SMB 离线时
    //    Windows 同步 stat 会阻塞数秒等待重连，此处 1500ms 封顶后转 SSH 直读
    let content = null;
    let localReadError = null;

    try {
      const isServerShare = /^[YyZz]:/i.test(filePath) || filePath.startsWith('/dfb/') || filePath.startsWith('/home/');
      if (isServerShare) {
        const raw = await Promise.race([
          fs.promises.readFile(filePath, 'utf8').catch(() => null),
          new Promise(r => setTimeout(() => r(null), 1500))
        ]);
        content = (typeof raw === 'string') ? raw : null;
      } else if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        content = await fs.promises.readFile(filePath, 'utf8');
      }
    } catch (err) {
      localReadError = err;
    }

    // 2. 若本地未命中，智能通过 SSH 直接秒级连接 Linux 服务器读取 (不依赖 Windows SMB 网络共享)
    if (content === null) {
      const sshResult = await this.tryFetchViaSsh(filePath, extraOptions);
      if (sshResult && typeof sshResult.content === 'string') {
        content = sshResult.content;
        this.isRemote = true;
        this.remoteSource = `${sshResult.serverName || '服务器'} · SSH直连`;
        this.remoteLinuxPath = sshResult.linuxPath;
        this.remoteServer = { host: sshResult.host, user: sshResult.user };
        if (sshResult.winPath) {
          this.currentFilePath = sshResult.winPath;
        }
      }
    }

    // 3. 若 SSH 亦未命中，智能尝试远端 OpenGrok HTTP 镜像拉取
    if (content === null) {
      const opengrokContent = await this.tryFetchFromOpenGrok(filePath, extraOptions);
      if (opengrokContent) {
        content = opengrokContent;
        this.isRemote = true;
        this.remoteSource = 'OpenGrok 远端只读';
      }
    }

    // 4. 兜底友善排查建议
    if (content === null) {
      content = `// 无法读取文件: ${filePath}
// 原因: ${localReadError ? localReadError.message : '文件不存在或网络共享已断开'}
// 
// 💡 排查建议:
// 1. 若为 Linux 服务器工程，请确认顶部工程下拉框选中了正确的工程目录。
// 2. 当前系统已开启 SSH 秒级直连 (无需依赖 Windows SMB 网络共享挂载)。
// 3. 点击右上角 [外部] 按钮，可直接调起本地 Notepad++ 或 VS Code 穿透打开。`;
    }

    this.currentContent = content;
    this.updateHeaderUI();

    // 5. 原生极速呈现 (虚拟化窗口渲染，大文件也瞬时上屏)
    this.renderNativeCodeView(content, this.currentLine);

    // 6. 同步至 Monaco 增强引擎 (小文件接管显示；大文件保留原生视图避免双重渲染闪屏)
    this.syncToMonaco();
  }

  /**
   * 尝试通过 SSH 直接从远端 Linux 服务器秒级读取 (完全不依赖 Windows SMB 共享挂载)
   * 单条 SSH 连接内完成全部候选路径探测与 find 兜底，杜绝多次 spawn 的握手叠加延迟。
   */
  async tryFetchViaSsh(filePath, extraOptions = {}) {
    try {
      const smartFn = (typeof readRemoteFileSmartAsync === 'function') ? readRemoteFileSmartAsync : null;
      if (!smartFn) return null;

      const activeProj = extraOptions.activeProject;
      const fileName = path.basename(filePath);

      let host = activeProj?.sshHost || activeProj?.serverIp;
      let user = activeProj?.user || 'tankaikun';
      let serverName = activeProj?.serverName || (activeProj?.serverId ? `${activeProj.serverId} 服务器` : '');

      const normLower = filePath.toLowerCase().replace(/\\/g, '/');
      if (!host) {
        if (normLower.startsWith('y:') || normLower.startsWith('/dfb/')) {
          host = '192.168.1.62';
          serverName = '62 服务器';
        } else if (normLower.startsWith('z:') || normLower.startsWith('/home/')) {
          host = '192.168.1.31';
          serverName = '31 服务器';
        } else {
          host = '192.168.1.62';
          serverName = '62 服务器';
        }
      }

      const w2lFn = (typeof windowsPathToLinux === 'function') ? windowsPathToLinux : (p => p.replace(/^[Yy]:/i, '/dfb/tankaikun/share/').replace(/^[Zz]:\/work/i, '/home/tankaikun/share/work/').replace(/\\/g, '/'));
      const l2wFn = (typeof linuxPathToWindows === 'function') ? linuxPathToWindows : (p => p.replace('/dfb/tankaikun/share/', 'Y:\\').replace('/home/tankaikun/share/work/', 'Z:\\work\\').replace(/\//g, '\\'));

      // 候选 Linux 路径：直达映射 -> Tier 2 项目定制 -> Tier 1 公共差分
      const candidates = [];
      const directLinuxPath = w2lFn(filePath);
      if (directLinuxPath && directLinuxPath.startsWith('/')) {
        candidates.push(directLinuxPath);
      }
      if (activeProj?.linuxPath) {
        const cleanBase = filePath.replace(/^[A-Za-z]:[\\\/]/, '').replace(/^[\\\/]+/, '').replace(/^base[\\\/]/i, '').replace(/\\/g, '/');
        if (activeProj.priDriverRel) {
          candidates.push(`${activeProj.linuxPath}/${activeProj.priDriverRel}/${cleanBase}`);
          candidates.push(`${activeProj.linuxPath}/${activeProj.priDriverRel}/bsp/kernel5.15/kernel5.15/drivers/misc/prize/hardware_info/${fileName}`);
          candidates.push(`${activeProj.linuxPath}/${activeProj.priDriverRel}/bsp/kernel5.15/kernel5.15/drivers/misc/prize/${fileName}`);
        }
        if (activeProj.publicDriverRel) {
          candidates.push(`${activeProj.linuxPath}/${activeProj.publicDriverRel}/${cleanBase}`);
          candidates.push(`${activeProj.linuxPath}/${activeProj.publicDriverRel}/bsp/kernel5.15/kernel5.15/drivers/misc/prize/hardware_info/${fileName}`);
        }
      }

      // find 兜底搜索根
      const searchRoots = [];
      if (activeProj?.linuxPath) {
        if (activeProj.platform && activeProj.project) {
          searchRoots.push(`${activeProj.linuxPath}/pri_project/driver/${activeProj.platform}/${activeProj.project}`);
        }
        searchRoots.push(`${activeProj.linuxPath}/pri_project/driver/public`);
        searchRoots.push(activeProj.linuxPath);
      } else {
        searchRoots.push('/dfb/tankaikun/share/W/01-sprd/pri_project/driver/public');
        searchRoots.push('/dfb/tankaikun/share/W/03-mtk-ww/pri_project/driver/public');
        searchRoots.push('/home/tankaikun/share/work/AndroidW/05-UW/pri_project/driver/public');
      }

      const res = await smartFn(host, user, {
        candidates,
        searchRoots,
        fileName
      }, 8000);

      if (res && typeof res.content === 'string' && res.content.length > 0) {
        const linuxPath = res.linuxPath || candidates[0] || '';
        return {
          content: res.content,
          linuxPath,
          winPath: linuxPath ? l2wFn(linuxPath) : filePath,
          serverName,
          host,
          user
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * 尝试从企业 OpenGrok 服务端读取原始文件内容
   */
  async tryFetchFromOpenGrok(filePath, extraOptions = {}) {
    try {
      const cleanTarget = extraOptions.rawTarget || path.basename(filePath);
      const activeProj = extraOptions.activeProject;
      let targetProj = 'W_sprd_os_dev';

      if (activeProj?.workspaceId?.includes('sprd') || filePath.includes('sprd')) {
        targetProj = 'W_sprd_os_dev';
      } else if (activeProj?.workspaceId?.includes('mtk') || filePath.includes('mtk')) {
        targetProj = 'W_mp1_os_dev';
      }

      // 计算相对于仓库的相对路径
      let relPath = filePath.replace(/^[A-Za-z]:[\\\/]/, '').replace(/^[\\\/]+/, '');
      if (relPath.startsWith('W\\01-sprd\\') || relPath.startsWith('W/01-sprd/')) {
        relPath = relPath.replace(/^W[\\\/]01-sprd[\\\/]/, '');
      } else if (relPath.startsWith('01\\') || relPath.startsWith('01/')) {
        relPath = relPath.replace(/^01[\\\/]/, '');
      }

      const candidates = [
        relPath,
        relPath.replace(/^pri_project\/driver\/[^\/]+\/[^\/]+\/base\//, 'pri_project/driver/public/'),
        relPath.replace(/^pri_project\/driver\/[^\/]+\/[^\/]+\/base\//, '')
      ];

      const baseName = path.basename(relPath);
      const stem = baseName.replace(/\.[^.]+$/, '');
      candidates.push(
        `pri_project/driver/public/bsp/kernel5.15/kernel5.15/drivers/misc/prize/hardware_info/${baseName}`,
        `pri_project/driver/public/bsp/kernel5.15/kernel5.15/drivers/misc/prize/${stem}/${baseName}`,
        `pri_project/driver/public/bsp/kernel5.15/kernel5.15/drivers/power/supply/${baseName}`,
        `pri_project/driver/public/bsp/kernel5.15/kernel5.15/drivers/misc/prize/${baseName}`
      );

      const uniqueCands = Array.from(new Set(candidates.filter(Boolean)));

      for (const cand of uniqueCands) {
        const url = `http://192.168.1.12:7080/source/raw/${targetProj}/${cand}`;
        const content = await new Promise((resolve) => {
          const req = http.get(url, { timeout: 2500 }, (res) => {
            if (res.statusCode !== 200) {
              resolve(null);
              return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
        });
        if (content) return content;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  _renderLoadingState() {
    if (!this.nativeViewerEl) return;
    if (this.editWrapEl) this.editWrapEl.style.display = 'none';
    if (this.iframeEl) this.iframeEl.style.display = 'none';
    this.nativeViewerEl.style.display = 'block';
    this._nv = null;
    this.nativeViewerEl.innerHTML = `
      <div class="tw-code-loading">
        <span class="tw-code-loading-dot"></span>
        <span>正在读取 ${escapeHtml(path.basename(this.currentFilePath || ''))} …</span>
      </div>
    `;
  }

  renderNativeCodeView(code, targetLine = 1) {
    if (!this.nativeViewerEl) return;

    if (!this.isReadOnly) {
      this.nativeViewerEl.style.display = 'none';
      if (this.editWrapEl) {
        this.editWrapEl.style.display = 'flex';
        this.textareaEl.value = code;
      }
      return;
    }

    if (this.editWrapEl) this.editWrapEl.style.display = 'none';
    this.nativeViewerEl.style.display = 'block';

    // 虚拟化窗口渲染：仅渲染视口附近行，上下用占位空白撑开滚动高度。
    // 大文件 (如 5.9MB/十几万行) 由 O(全量DOM) 降为 O(数百行)，杜绝打开卡顿与首屏闪白。
    const lines = (code || '').split('\n');
    this._nv = {
      lines: lines,
      lineH: 20,          // 与 .tw-code-line 的固定行高一致
      overscan: 120,      // 视口上下多渲染的行数，减少滚动重排频次
      winStart: -1,
      winEnd: -1,
      targetLine: targetLine || 0
    };

    this.nativeViewerEl.innerHTML = `
      <div class="tw-code-vport">
        <div class="tw-code-vspace-top"></div>
        <div class="tw-code-vwin"></div>
        <div class="tw-code-vspace-bot"></div>
      </div>
    `;

    // 滚动监听只绑定一次
    if (!this._nvScrollBound) {
      this._nvScrollBound = true;
      this.nativeViewerEl.addEventListener('scroll', () => {
        if (this._nvRafId) return;
        this._nvRafId = requestAnimationFrame(() => {
          this._nvRafId = null;
          this._renderNvWindow();
        });
      }, { passive: true });
    }

    // 立即定位到目标行（瞬时滚动，大文件下 smooth 会造成长距离动画漂移）
    if (targetLine && targetLine > 0) {
      const st = (targetLine - 1) * this._nv.lineH - this.nativeViewerEl.clientHeight / 2 + this._nv.lineH / 2;
      const maxST = Math.max(0, lines.length * this._nv.lineH - this.nativeViewerEl.clientHeight);
      this.nativeViewerEl.scrollTop = Math.min(Math.max(0, st), maxST);
    } else {
      this.nativeViewerEl.scrollTop = 0;
    }
    this._renderNvWindow(true);

    // 面板可能在 display:none 状态下渲染（抽屉开启动画/初始化期），待可见后补偿定位
    if (targetLine && targetLine > 0) {
      const retry = () => {
        const nv = this._nv;
        if (!nv || nv.targetLine !== targetLine || !this.nativeViewerEl) return;
        if (this.nativeViewerEl.clientHeight <= 0) return;
        const want = Math.min(Math.max(0, (targetLine - 1) * nv.lineH - this.nativeViewerEl.clientHeight / 2 + nv.lineH / 2),
                              Math.max(0, nv.lines.length * nv.lineH - this.nativeViewerEl.clientHeight));
        if (Math.abs(this.nativeViewerEl.scrollTop - want) > 4) {
          this.nativeViewerEl.scrollTop = want;
          this._renderNvWindow(true);
        }
      };
      requestAnimationFrame(retry);
      setTimeout(retry, 160);
    }
  }

  _renderNvWindow(force = false) {
    const nv = this._nv;
    const el = this.nativeViewerEl;
    if (!nv || !el) return;
    const vwin = el.querySelector('.tw-code-vwin');
    const spaceTop = el.querySelector('.tw-code-vspace-top');
    const spaceBot = el.querySelector('.tw-code-vspace-bot');
    if (!vwin || !spaceTop || !spaceBot) return;

    const lineH = nv.lineH;
    const total = nv.lines.length;
    const clientH = el.clientHeight || 400;
    const firstVis = Math.max(0, Math.floor(el.scrollTop / lineH));
    const lastVis = Math.min(total - 1, Math.ceil((el.scrollTop + clientH) / lineH));
    const start = Math.max(0, firstVis - nv.overscan);
    const end = Math.min(total - 1, lastVis + nv.overscan);

    if (!force && start === nv.winStart && end === nv.winEnd) return;
    nv.winStart = start;
    nv.winEnd = end;

    let html = '';
    for (let i = start; i <= end; i++) {
      const lineNum = i + 1;
      const isTarget = lineNum === nv.targetLine;
      html += `
        <div class="tw-code-line ${isTarget ? 'is-target-line' : ''}" data-line="${lineNum}">
          <span class="tw-line-num">${lineNum}</span>
          <span class="tw-line-text">${this.highlightLineCode(nv.lines[i])}</span>
        </div>
      `;
    }
    spaceTop.style.height = `${start * lineH}px`;
    spaceBot.style.height = `${Math.max(0, total - 1 - end) * lineH}px`;
    vwin.innerHTML = html;
  }

  highlightLineCode(text) {
    let esc = escapeHtml(text);
    // Comments
    if (/^\s*(?:\/\/|#)/.test(text)) {
      return `<span style="color:var(--code-comment, #6a9955);">${esc}</span>`;
    }
    // Strings
    esc = esc.replace(/(&quot;.*?&quot;|&#039;.*?&#039;|".*?"|'.*?')/g, '<span style="color:var(--code-string, #ce9178);">$1</span>');
    // Preprocessor (#include, #define)
    esc = esc.replace(/(#(?:include|define|ifdef|ifndef|endif|pragma|if|elif|else)\b.*?)(?=$|\/\/|\/\*)/g, '<span style="color:var(--code-macro, #c586c0);">$1</span>');
    // Keywords
    esc = esc.replace(/\b(static|int|return|void|if|else|char|const|struct|typedef|unsigned|long|bool|true|false|null|NULL|for|while|switch|case|break|continue|default|goto|sizeof|enum|union|extern|inline|compatible|reg|status|okay|disabled)\b/g, '<span style="color:var(--code-kw, #569cd6); font-weight:600;">$1</span>');
    // Numbers
    esc = esc.replace(/\b(0x[0-9a-fA-F]+|\d+)\b/g, '<span style="color:var(--code-num, #b5cea8);">$1</span>');
    return esc;
  }

  syncToMonaco() {
    if (!this.iframeEl?.contentWindow || !this.currentFilePath) return;

    // 大文件门控：超过阈值不推送 Monaco（避免 5MB+ postMessage、模型重建卡顿
    // 与原生视图→Monaco 的显示切换闪屏），保留虚拟化原生视图
    const MONACO_MAX_BYTES = 2 * 1024 * 1024;
    if ((this.currentContent || '').length > MONACO_MAX_BYTES) {
      if (this.iframeEl) this.iframeEl.style.display = 'none';
      if (this.nativeViewerEl && this.nativeViewerEl.innerHTML) {
        this.nativeViewerEl.style.display = 'block';
      }
      return;
    }

    const lang = this.detectLanguage(this.currentFilePath);
    const theme = this.getTheme();

    try {
      this.iframeEl.contentWindow.postMessage({
        type: 'open-file',
        code: this.currentContent,
        lang: lang,
        targetLine: this.currentLine,
        readOnly: this.isReadOnly,
        theme: theme
      }, '*');

      if (this.isMonacoActive) {
        this.iframeEl.style.display = 'block';
        if (this.nativeViewerEl) this.nativeViewerEl.style.display = 'none';
        if (this.editWrapEl) this.editWrapEl.style.display = 'none';
      }
    } catch (_) {}
  }

  setReadOnly(readOnly) {
    this.isReadOnly = !!readOnly;
    this.updateHeaderUI();

    // 以 Monaco 实际接管显示为准（大文件门控下 isMonacoActive 可能为 true 但 iframe 隐藏）
    const monacoShown = this.isMonacoActive && this.iframeEl && this.iframeEl.style.display !== 'none';
    if (monacoShown) {
      try {
        this.iframeEl?.contentWindow?.postMessage({
          type: 'set-readonly',
          readOnly: this.isReadOnly
        }, '*');
      } catch (_) {}
    } else {
      this.renderNativeCodeView(this.currentContent, this.currentLine);
    }
  }

  triggerSave() {
    if (this.isReadOnly || !this.currentFilePath) return;

    // 大文件走原生编辑时取 textarea 值；仅当 Monaco 真实接管显示时才向其取码
    const monacoShown = this.isMonacoActive && this.iframeEl && this.iframeEl.style.display !== 'none';
    if (!monacoShown && this.textareaEl) {
      this.saveContent(this.textareaEl.value);
      return;
    }

    try {
      if (this.iframeEl?.contentWindow) {
        this.iframeEl.contentWindow.postMessage({ type: 'request-code', reqId: Date.now() }, '*');
      }
    } catch (e) {
      console.error('[CodeViewerPanel] triggerSave failed:', e);
    }
  }

  saveContent(newContent) {
    if (!this.currentFilePath && !this.remoteLinuxPath) return;

    // 1. 若当前文件通过 SSH 远端直连打开，优先通过 SSH 写回服务器
    if (this.remoteLinuxPath && this.remoteServer) {
      try {
        let writeFn = (typeof writeRemoteFileViaSsh === 'function') ? writeRemoteFileViaSsh : null;
        if (typeof writeFn === 'function') {
          writeFn(this.remoteServer.host, this.remoteServer.user, this.remoteLinuxPath, newContent);
          this.currentContent = newContent;
          this.isModified = false;
          this.updateHeaderUI();
          if (typeof Notice !== 'undefined') {
            new Notice(`✓ 已通过 SSH 保存至服务器: ${path.basename(this.remoteLinuxPath)}`);
          }
          if (typeof this.onFileSaved === 'function') {
            this.onFileSaved(this.currentFilePath || this.remoteLinuxPath);
          }
          return;
        }
      } catch (sshErr) {
        if (typeof Notice !== 'undefined') {
          new Notice(`SSH 保存失败: ${sshErr.message}`);
        }
        return;
      }
    }

    // 2. 本地文件写回
    try {
      if (typeof safeWriteFileSync === 'function') {
        safeWriteFileSync(this.currentFilePath, newContent, 'utf8');
      } else {
        fs.writeFileSync(this.currentFilePath, newContent, 'utf8');
      }
      this.currentContent = newContent;
      this.isModified = false;
      this.updateHeaderUI();
      if (typeof Notice !== 'undefined') {
        new Notice(`已保存: ${path.basename(this.currentFilePath)}`);
      }
      if (typeof this.onFileSaved === 'function') {
        this.onFileSaved(this.currentFilePath);
      }
    } catch (err) {
      if (typeof Notice !== 'undefined') {
        new Notice(`保存失败: ${err.message}`);
      }
    }
  }

  openInExternalEditor() {
    if (!this.currentFilePath && !this.remoteLinuxPath) return;
    let filePath = this.currentFilePath;
    const line = this.currentLine || 1;

    // 若本地文件在 Windows 上不可访问，但有 SSH 远端内容，镜像至本地临时文件供外部编辑器打开
    try {
      if ((!filePath || !fs.existsSync(filePath)) && this.currentContent) {
        const os = require('os');
        const bName = path.basename(this.remoteLinuxPath || filePath || 'source.c');
        const tmpFile = path.join(os.tmpdir(), `wb_${bName}`);
        fs.writeFileSync(tmpFile, this.currentContent, 'utf8');
        filePath = tmpFile;
      }
    } catch (_) {}

    // 1. 优先探测本地 Notepad++ 安装路径
    const nppCandidates = [
      'D:\\Program Files\\Notepad++\\notepad++.exe',
      'C:\\Program Files (x86)\\Notepad++\\notepad++.exe',
      'C:\\Program Files\\Notepad++\\notepad++.exe',
      'notepad++.exe'
    ];

    let foundNpp = '';
    for (const cand of nppCandidates) {
      try {
        if (cand === 'notepad++.exe' || fs.existsSync(cand)) {
          foundNpp = cand;
          break;
        }
      } catch (_) {}
    }

    if (foundNpp) {
      try {
        const args = [`-n${line}`, filePath];
        child_process.spawn(foundNpp, args, { detached: true, stdio: 'ignore' }).unref();
        if (typeof Notice !== 'undefined') {
          new Notice(`已在 Notepad++ 打开第 ${line} 行`);
        }
        return;
      } catch (e) {
        console.warn('[CodeViewerPanel] spawn Notepad++ failed:', e);
      }
    }

    // 2. 次选探测 VS Code
    try {
      const args = ['-g', `${filePath}:${line}`];
      child_process.spawn('code.cmd', args, { detached: true, stdio: 'ignore', shell: true }).unref();
      if (typeof Notice !== 'undefined') {
        new Notice(`已在 VS Code 打开第 ${line} 行`);
      }
      return;
    } catch (_) {}

    // 3. 兜底系统默认打开
    try {
      let elShell = typeof shell !== 'undefined' ? shell : (typeof electronModule !== 'undefined' ? electronModule.shell : null);
      if (!elShell && typeof require !== 'undefined') {
        try { elShell = require('electron')?.shell; } catch (_) {}
      }
      if (elShell?.openPath) {
        elShell.openPath(filePath);
        return;
      }
    } catch (_) {}
  }

  detectLanguage(filePath) {
    if (!filePath) return 'plaintext';
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.hpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.py': 'python',
      '.sh': 'shell',
      '.bash': 'shell',
      '.dts': 'dts',
      '.dtsi': 'dts',
      '.mk': 'makefile',
      '.makefile': 'makefile',
      '.json': 'json',
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.xml': 'xml',
      '.rc': 'c',
      '.ini': 'ini',
      '.conf': 'ini',
      '.diff': 'diff',
      '.patch': 'diff',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.java': 'java',
      '.rs': 'rust',
      '.go': 'go'
    };
    const base = path.basename(filePath).toLowerCase();
    if (base === 'makefile' || base === 'kbuild' || base.endsWith('.mk')) return 'makefile';
    return map[ext] || 'plaintext';
  }

  destroy() {
    if (this._nvRafId) {
      cancelAnimationFrame(this._nvRafId);
      this._nvRafId = null;
    }
    if (this._searchDeb) {
      clearTimeout(this._searchDeb);
      this._searchDeb = null;
    }
    if (this._messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    if (this._keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._themeObserver) {
      this._themeObserver.disconnect();
      this._themeObserver = null;
    }
    if (this.iframeEl) {
      try { this.iframeEl.remove(); } catch (_) {}
      this.iframeEl = null;
    }
    if (this.containerEl) {
      this.containerEl.innerHTML = '';
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CodeViewerPanel };
}
