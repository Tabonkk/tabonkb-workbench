/* ==========================================================================
   ToolsView — TabonKB 研发效能与分析工具箱主视图
   特性:
   1. 多工具注册表容器: 工具 = { id, name, fullName, version, icon, viewClass, externalUrl?, htmlRelPath? }
   2. 左侧品牌区点击/悬停唤出右侧级联毛玻璃浮窗切换工具, 选择持久化 localStorage
   3. 视图生命周期通用化: new viewClass(app, frameWrapEl, {plugin, workbenchView, navTabsContainer})
      -> mount() 挂载 / destroy() 释放, 切换即销毁旧实例杜绝残留定时器与监听
   4. 「独立打开」仅对声明 externalUrl 的工具显示
   ========================================================================== */

let ToolsNoticeCls = typeof Notice !== 'undefined' ? Notice : null;
if (!ToolsNoticeCls) {
  try {
    const obs = require('obsidian');
    ToolsNoticeCls = obs.Notice;
  } catch (_) {
    ToolsNoticeCls = class MockNotice { constructor(msg) { if (typeof console !== 'undefined') console.log('[Notice]', msg); } };
  }
}

let getToolsIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!getToolsIconPark) {
  try {
    getToolsIconPark = require('../ui/iconpark.js').getIconPark;
  } catch (_) {
    getToolsIconPark = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

let ChargerToolViewCls = typeof ChargerToolView !== 'undefined' ? ChargerToolView : null;
if (!ChargerToolViewCls) {
  try {
    ChargerToolViewCls = require('./tools/charger/charger-tool-view.js').ChargerToolView;
  } catch (_) {}
}

let LogicToolViewCls = typeof LogicToolView !== 'undefined' ? LogicToolView : null;
if (!LogicToolViewCls) {
  try {
    LogicToolViewCls = require('./tools/logic/logic-tool-view.js').LogicToolView;
  } catch (_) {}
}

const TW_TOOLS_ACTIVE_KEY = 'tabonkb-tools-active';

class ToolsView {
  constructor(options = {}) {
    this.app = options.app || (typeof app !== 'undefined' ? app : null);
    this.plugin = options.plugin || null;
    this.workbenchView = options.workbenchView || null;

    this.containerEl = null;
    this.toolbarEl = null;
    this.frameWrapEl = null;
    this.iframeEl = null;
    this.activeView = null;
    this.brandEl = null;
    this.btnExternal = null;
    this.btnReload = null;
    this.tabsSlotEl = null;
    this.switchPopoverEl = null;
    this._suppressHoverUntil = 0;

    // 工具箱注册表 (可扩展): viewClass 缺失且提供 htmlRelPath 时降级 iframe
    this.tools = [
      {
        id: 'battery-charger',
        name: '充电',
        fullName: '充电分析工具',
        version: 'V1.2.9',
        icon: 'lightning',
        badge: '就绪',
        desc: '充电放电分析 · 8大功率标准判定 · 6款 IC Dump 解码与 Diff',
        viewClass: ChargerToolViewCls,
        externalUrl: 'http://127.0.0.1:28123/tools/battery-charger',
        htmlRelPath: '.obsidian/plugins/tabonkb-workbench/ui/tools/battery-charger.html'
      },
      {
        id: 'logic',
        name: '逻辑',
        fullName: '逻辑分析',
        version: 'V0.1',
        icon: 'cpu',
        badge: '就绪',
        desc: 'DSLogic 采集回放 · 波形 · 协议解码',
        viewClass: LogicToolViewCls
      }
    ];

    this.activeToolId = this._loadActiveToolId();

    // 具名全局监听 (dispose 时移除, 杜绝残留)
    this._docPointerDown = (e) => {
      if (!this.switchPopoverEl) return;
      if (this.switchPopoverEl.contains(e.target)) return;
      if (this.brandEl && this.brandEl.contains(e.target)) return;
      this.closeSwitcher();
    };
    this._docKeyDown = (e) => {
      if (e.key === 'Escape' && this.switchPopoverEl) this.closeSwitcher();
    };
  }

  _loadActiveToolId() {
    let saved = null;
    try {
      if (typeof localStorage !== 'undefined') saved = localStorage.getItem(TW_TOOLS_ACTIVE_KEY);
    } catch (_) {}
    return this.tools.some(t => t.id === saved) ? saved : this.tools[0].id;
  }

  _saveActiveToolId() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(TW_TOOLS_ACTIVE_KEY, this.activeToolId);
    } catch (_) {}
  }

  getActiveTool() {
    return this.tools.find(t => t.id === this.activeToolId) || this.tools[0];
  }

  /**
   * 挂载至主舞台容器
   */
  async mount(parentEl) {
    this.containerEl = parentEl.createDiv({ cls: 'tw-tools-view-root' });
    this.renderToolbar();
    this.frameWrapEl = this.containerEl.createDiv({ cls: 'tw-tools-frame-wrap' });
    this._mountActiveTool();
    document.addEventListener('pointerdown', this._docPointerDown, true);
    document.addEventListener('keydown', this._docKeyDown);
  }

  /**
   * 渲染极简微型工具条 (符合 UI_DESIGN_SPEC.md 规范)
   */
  renderToolbar() {
    this.toolbarEl = this.containerEl.createDiv({ cls: 'tw-tools-toolbar' });

    // 1. 左侧: 品牌区 (点击/悬停唤出工具切换级联浮窗)
    const leftSec = this.toolbarEl.createDiv({ cls: 'tw-tools-toolbar-left' });

    this.brandEl = leftSec.createDiv({ cls: 'tw-tools-brand-tag tw-tools-brand-switch' });
    this.brandEl.title = '切换工具';
    this.brandEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.switchPopoverEl) {
        this._suppressHoverUntil = Date.now() + 350;
        this.closeSwitcher();
      } else {
        this.openSwitcher();
      }
    });
    this.brandEl.addEventListener('mouseenter', () => {
      if (!this.switchPopoverEl && Date.now() > this._suppressHoverUntil) this.openSwitcher();
    });

    // 2. 中间: 统一子功能切换选项卡 (嵌入顶级导航，消除双层工具栏撕裂)
    const midSec = this.toolbarEl.createDiv({ cls: 'tw-tools-toolbar-mid' });
    this.tabsSlotEl = midSec;

    // 3. 右侧: 极简操作按钮组
    const rightSec = this.toolbarEl.createDiv({ cls: 'tw-tools-toolbar-right' });

    // 刷新按钮
    this.btnReload = rightSec.createEl('button', {
      cls: 'tw-tools-btn',
      title: '重新加载当前分析工具'
    });
    this.btnReload.innerHTML = `${getToolsIconPark('refresh', 13)}<span>刷新</span>`;
    this.btnReload.onclick = () => {
      this.reloadTool();
      const cur = this.getActiveTool();
      if (ToolsNoticeCls) new ToolsNoticeCls(`✓ 已重新加载${cur.fullName}`, 1500);
    };

    // 外部浏览器独立打开按钮 (仅声明 externalUrl 的工具显示)
    this.btnExternal = rightSec.createEl('button', {
      cls: 'tw-tools-btn tw-tools-btn-primary',
      title: '在系统默认浏览器中独立全屏打开此工具'
    });
    this.btnExternal.innerHTML = `${getToolsIconPark('external', 13)}<span>独立打开</span>`;
    this.btnExternal.onclick = () => {
      this.openInExternal();
    };

    this._syncToolbar();
  }

  /**
   * 同步工具条动态部分 (品牌标识 / 外开按钮可见性)
   */
  _syncToolbar() {
    const curTool = this.getActiveTool();
    if (this.brandEl) {
      this.brandEl.innerHTML = `
        <span class="tw-tools-brand-icon">${getToolsIconPark(curTool.icon, 16)}</span>
        <span class="tw-tools-brand-name">${curTool.fullName}</span>
        <span class="tw-tools-brand-ver">${curTool.version}</span>
        <span class="tw-tools-brand-caret">${getToolsIconPark('down', 10)}</span>
      `;
    }
    if (this.btnExternal) {
      this.btnExternal.style.display = curTool.externalUrl ? '' : 'none';
    }
  }

  /**
   * 工具切换级联浮窗 (右侧展开, 4~6px 微重叠, bottom 对齐向上生长, 越界左翻)
   */
  openSwitcher() {
    this.closeSwitcher();
    if (!this.brandEl) return;
    const rect = this.brandEl.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'tw-tools-switch-popover';
    for (const t of this.tools) {
      const item = document.createElement('div');
      item.className = 'tw-tools-switch-item' + (t.id === this.activeToolId ? ' active' : '');
      item.title = t.desc || t.fullName;
      item.innerHTML = `
        <span class="tw-tools-switch-icon">${getToolsIconPark(t.icon, 14)}</span>
        <span class="tw-tools-switch-name">${t.name}</span>
        <span class="tw-tools-switch-ver">${t.version}</span>
        ${t.id === this.activeToolId ? `<span class="tw-tools-switch-check">${getToolsIconPark('check', 12)}</span>` : ''}
      `;
      item.onclick = () => {
        this.switchTool(t.id);
      };
      pop.appendChild(item);
    }
    document.body.appendChild(pop);
    this.switchPopoverEl = pop;

    // 水平: 右侧级联并向左叠加 6px 于品牌区; 右侧越界则向左翻转
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const w = pop.offsetWidth || 180;
    let left = rect.right - 6;
    if (left + w + 8 > winW) left = rect.left + 6 - w;
    if (left < 4) left = 4;
    pop.style.left = Math.round(left) + 'px';
    // 垂直(R4): 锚点在上半屏向下展开, 下半屏向上生长; maxHeight 保证完整落在视口内
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const spaceBelow = winH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (rect.bottom <= winH / 2) {
      pop.style.top = Math.round(rect.bottom - 4) + 'px';   // 向下展开, 4px 微重叠
      pop.style.bottom = 'auto';
      pop.style.maxHeight = Math.min(300, Math.max(60, spaceBelow)) + 'px';
    } else {
      pop.style.top = 'auto';
      pop.style.bottom = Math.max(4, Math.round(winH - rect.bottom)) + 'px';
      pop.style.maxHeight = Math.min(300, Math.max(60, spaceAbove + rect.height)) + 'px';
    }
  }

  closeSwitcher() {
    if (this.switchPopoverEl) {
      try { this.switchPopoverEl.remove(); } catch (_) {}
      this.switchPopoverEl = null;
    }
  }

  /**
   * 切换工具: 即选即切即关
   */
  switchTool(id) {
    this.closeSwitcher();
    if (!this.tools.some(t => t.id === id)) return;
    if (id === this.activeToolId && this.activeView) return;
    this.activeToolId = id;
    this._saveActiveToolId();
    this._syncToolbar();
    this._mountActiveTool();
    const cur = this.getActiveTool();
    if (ToolsNoticeCls) new ToolsNoticeCls(`✓ ${cur.fullName}`, 1500);
  }

  /**
   * 挂载当前工具视图 (原生组件优先, htmlRelPath 兜底 iframe)
   */
  _mountActiveTool() {
    this._destroyActiveView();
    if (!this.frameWrapEl) return;
    const curTool = this.getActiveTool();
    if (this.tabsSlotEl) {
      try { this.tabsSlotEl.empty(); } catch (_) { this.tabsSlotEl.innerHTML = ''; }
    }
    if (curTool.viewClass) {
      try {
        this.activeView = new curTool.viewClass(this.app, this.frameWrapEl, {
          plugin: this.plugin,
          workbenchView: this.workbenchView || this.plugin?._workbenchView,
          navTabsContainer: this.tabsSlotEl
        });
        this.activeView.mount();
        return;
      } catch (e) {
        console.error('[TabonKB ToolsView] mount tool failed:', e);
        this.activeView = null;
      }
    }
    if (curTool.htmlRelPath) {
      this.iframeEl = this.frameWrapEl.createEl('iframe', { cls: 'tw-tools-iframe' });
      this.iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write;');
      this.iframeEl.setAttribute('frameborder', '0');
      this.loadToolContent();
      return;
    }
    const empty = this.frameWrapEl.createDiv({ cls: 'tw-tools-tool-missing' });
    empty.innerHTML = `<span>${curTool.fullName} 组件缺失</span>`;
  }

  _destroyActiveView() {
    if (this.activeView) {
      if (typeof this.activeView.destroy === 'function') {
        try { this.activeView.destroy(); } catch (e) { console.warn('[TabonKB ToolsView] destroy failed:', e); }
      }
      this.activeView = null;
    }
    if (this.iframeEl) {
      try {
        this.iframeEl.srcdoc = '';
        this.iframeEl.src = 'about:blank';
        this.iframeEl.remove();
      } catch (_) {}
      this.iframeEl = null;
    }
    if (this.frameWrapEl) {
      try { this.frameWrapEl.empty(); } catch (_) { this.frameWrapEl.innerHTML = ''; }
    }
  }

  /**
   * 加载工具 HTML 内容 (iframe 降级模式)
   */
  loadToolContent() {
    if (!this.iframeEl) return;

    try {
      const fs = require('fs');
      const path = require('path');
      const basePath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
      const curTool = this.getActiveTool();
      const fullPath = path.join(basePath, curTool.htmlRelPath);

      if (fs.existsSync(fullPath)) {
        const html = fs.readFileSync(fullPath, 'utf8');
        this.iframeEl.srcdoc = html;
        return;
      }
    } catch (e) {
      console.warn('[TabonKB ToolsView] Failed to read local tool html, fallback to companion url:', e);
    }

    // 降级使用 companion 同步服务器 URL
    const curTool = this.getActiveTool();
    if (curTool.externalUrl) this.iframeEl.src = curTool.externalUrl;
  }

  /**
   * 重新载入当前工具 (亦用于外部变更 activeToolId 后的重同步)
   */
  reloadTool() {
    this._saveActiveToolId();
    this._syncToolbar();
    this._mountActiveTool();
  }

  /**
   * 在系统外部浏览器中独立打开
   */
  openInExternal() {
    try {
      let electron = null;
      try { electron = require('electron'); } catch (_) {}
      const shell = electron?.shell || (typeof window !== 'undefined' ? window.require?.('electron')?.shell : null);

      const curTool = this.getActiveTool();
      const url = curTool.externalUrl;
      if (!url) return;

      if (shell && typeof shell.openExternal === 'function') {
        shell.openExternal(url);
        if (ToolsNoticeCls) new ToolsNoticeCls(`✓ 已在系统浏览器中打开${curTool.fullName}`, 2000);
        return;
      }

      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
        if (ToolsNoticeCls) new ToolsNoticeCls(`✓ 已打开${curTool.fullName}`, 2000);
      }
    } catch (err) {
      console.error('[TabonKB ToolsView] Open external failed:', err);
      if (ToolsNoticeCls) new ToolsNoticeCls('无法调起外部浏览器', 3000);
    }
  }

  /**
   * 视图销毁处理
   */
  dispose() {
    document.removeEventListener('pointerdown', this._docPointerDown, true);
    document.removeEventListener('keydown', this._docKeyDown);
    this.closeSwitcher();
    this._destroyActiveView();
    if (this.containerEl) {
      this.containerEl.empty();
      this.containerEl = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ToolsView };
}
