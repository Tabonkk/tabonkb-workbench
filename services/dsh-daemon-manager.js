/* ==========================================================================
   DSH Daemon Manager — DeepSeek Harness 本地守护进程生命周期管理器
   功能:
   1. 进程生命周期: 拉起、守护、保活与优雅/强制回收 (Windows taskkill /T /F)
   2. 端口分配与签名防伪: 默认 3080，探测 3080~3090；带签名握手验证，避免误复用无关服务
   3. 锁文件机制: .dsh/profiles/<profile>/daemon.lock 协调多窗口与僵尸实例自愈
   4. 动态凭据与 Patch 挂载: 启动前自动调用 DshMcpBridge 生成 cordis.patch.yml 并通过 --patch 载入
   5. 认证 URL 捕获: 实时捕获 stdout 中的 launchToken URL 供 Studio 视窗直接加载

   注: 遵循双运行形态约束 (支持单测 require 与 build.py 拼接全局提升)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const child_process = require('child_process');

/**
 * R14: 探测 %APPDATA% 下的便携 Node 目录 (node-v*)，避免硬编码版本号 node-v24.15.0
 */
function resolveBundledNodeDir() {
  const appData = process.env.APPDATA;
  if (!appData) return '';
  try {
    const entries = fs.readdirSync(appData).filter(n => /^node-v\d+\.\d+\.\d+$/i.test(n));
    if (!entries.length) return '';
    entries.sort((a, b) => {
      const pa = a.slice(5).split('.').map(Number);
      const pb = b.slice(5).split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    });
    for (const name of entries) {
      const dir = path.join(appData, name);
      if (fs.existsSync(path.join(dir, 'node.exe'))) return dir;
    }
  } catch (_) {}
  return '';
}

// 导入 MCP bridge 辅助 (打包态由 build.py 剥离, 依赖前面模块已提升的全局函数)
let dshMcpShared = null;
try {
  dshMcpShared = require('../mcp/dsh-mcp-shared.js');
} catch (e) {}

/**
 * TabonKB 全局统一 Electron WebRequest 桥接器
 * 核心职责:
 * 1. 规避 Electron session.webRequest 监听器相互覆盖的问题 (单监听器多路复用)
 * 2. 自动处理 WeKnora 跨域/嵌入拦截头 (x-frame-options / content-security-policy)
 * 3. 自动规避 Chromium 对 127.0.0.1 跨源 iframe 吞掉 SameSite=Strict Cookie 的安全限制:
 *    - 响应阶段 (onHeadersReceived): 捕获 dsh-auth-* 鉴权 Cookie 并重写 SameSite 属性为 None; Secure
 *    - 请求阶段 (onBeforeSendHeaders): 为发往 127.0.0.1 的请求强制注入对应端口的 DSH 鉴权 Cookie 请求头
 */
function getTabonKbWebRequestBridge() {
  if (typeof window === 'undefined') return null;
  if (!window._tabonkbWebRequestBridge) {
    const bridge = {
      installed: false,
      dshCookies: new Map(), // port (string) -> cookiePair (string)
      // R7: DSH 端口白名单 —— 只有明确注册过的本机端口才允许被改写响应头/注入 Cookie，
      // 避免任意 localhost 服务(其它开发服务器)被误注入 dsh Cookie 或剥除安全响应头
      dshPorts: new Set(),
      registerDshPort(port) {
        if (port === undefined || port === null || port === '') return;
        this.dshPorts.add(String(port));
      },
      isDshUrl(rawUrl) {
        if (!rawUrl) return false;
        const url = String(rawUrl);
        if (!/https?:\/\/(127\.0\.0\.1|localhost)([:/]|$)/i.test(url)) return false;
        const portMatch = url.match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)/i);
        const port = portMatch ? portMatch[1] : '';
        if (!port) return false;
        if (this.dshPorts.has(port)) return true;
        // 兜底窗口: 桥尚未注册端口时仅放行 DSH 默认端口区间, 保证首帧加载不被拦
        if (this.dshPorts.size === 0) {
          const n = parseInt(port, 10);
          return n >= 3080 && n <= 3130;
        }
        return false;
      },
      setDshCookie(port, cookieStr) {
        if (!cookieStr) return;
        const p = String(port || 'latest');
        this.dshCookies.set(p, cookieStr);
        this.dshCookies.set('latest', cookieStr);
      },
      getDshCookie(port) {
        const p = String(port || '');
        return this.dshCookies.get(p) || this.dshCookies.get('latest') || null;
      },
      ensureInstalled() {
        if (this.installed) return;
        let electron = null;
        try {
          electron = typeof require !== 'undefined' ? require('electron') : null;
        } catch (_) {}
        if (!electron && typeof window !== 'undefined' && window.require) {
          try { electron = window.require('electron'); } catch (_) {}
        }
        if (!electron) return;
        const sess = electron.remote?.session?.defaultSession || electron.session?.defaultSession;
        if (!sess || !sess.webRequest) return;
        this.installed = true;

        // 1. 统一处理 onHeadersReceived
        try {
          sess.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
            const headers = Object.assign({}, details.responseHeaders);
            const url = (details.url || '').toLowerCase();

            // WeKnora 嵌入拦截剥除（iframe 需剥 x-frame-options 与 CSP frame-ancestors）
            if (url.includes(':8088') || url.includes(':8080') || url.includes('192.168.1.62') || url.includes('weknora')) {
              for (const k of Object.keys(headers)) {
                const lk = k.toLowerCase();
                if (lk === 'x-frame-options' || lk === 'content-security-policy') {
                  delete headers[k];
                }
              }
            }

            // DSH 引擎拦截与 Cookie 捕获 (R7: 仅白名单端口)
            if (this.isDshUrl(details.url)) {
              for (const k of Object.keys(headers)) {
                const lk = k.toLowerCase();
                if (lk === 'x-frame-options' || lk === 'content-security-policy') {
                  delete headers[k];
                }
              }

              let setCookieKey = null;
              for (const k of Object.keys(headers)) {
                if (k.toLowerCase() === 'set-cookie') {
                  setCookieKey = k;
                  break;
                }
              }

              if (setCookieKey && headers[setCookieKey]) {
                const list = Array.isArray(headers[setCookieKey]) ? headers[setCookieKey] : [headers[setCookieKey]];
                for (const c of list) {
                  if (c && c.includes('dsh-auth-')) {
                    const cookiePair = c.split(';')[0].trim();
                    const portMatch = details.url.match(/(?:127\.0\.0\.1|localhost):(\d+)/i);
                    const port = portMatch ? portMatch[1] : 'latest';
                    this.setDshCookie(port, cookiePair);
                  }
                }
                headers[setCookieKey] = list.map(c =>
                  c.replace(/;\s*SameSite=Strict/i, '; SameSite=None; Secure')
                   .replace(/;\s*SameSite=Lax/i, '; SameSite=None; Secure')
                );
              }
            }

            callback({ cancel: false, responseHeaders: headers });
          });
        } catch (e) {
          console.warn('[WebRequestBridge] onHeadersReceived error:', e);
        }

        // 2. 统一处理 onBeforeSendHeaders (强制注入 Cookie)
        try {
          sess.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
            const headers = Object.assign({}, details.requestHeaders);
            const url = details.url || '';

            if (this.isDshUrl(url)) {
              const portMatch = url.match(/(?:127\.0\.0\.1|localhost):(\d+)/i);
              const port = portMatch ? portMatch[1] : '';
              const cookieToInject = this.getDshCookie(port);

              if (cookieToInject) {
                let cookieKey = 'Cookie';
                for (const k of Object.keys(headers)) {
                  if (k.toLowerCase() === 'cookie') {
                    cookieKey = k;
                    break;
                  }
                }

                const existing = headers[cookieKey] || '';
                const cookieName = cookieToInject.split('=')[0];

                if (!existing) {
                  headers[cookieKey] = cookieToInject;
                } else if (!existing.includes(cookieName + '=')) {
                  headers[cookieKey] = `${existing}; ${cookieToInject}`;
                } else {
                  // 更新已有可能失效的旧 JWT Token
                  const regex = new RegExp(`${cookieName}=[^;]+`);
                  headers[cookieKey] = existing.replace(regex, cookieToInject);
                }
              }
            }

            callback({ cancel: false, requestHeaders: headers });
          });
        } catch (e) {
          console.warn('[WebRequestBridge] onBeforeSendHeaders error:', e);
        }
      }
    };
    window._tabonkbWebRequestBridge = bridge;
  }
  return window._tabonkbWebRequestBridge;
}

/**
 * TabonKB 定制化: DeepSeek Harness 导航栏右侧吸附 CSS (实验性, 默认关闭)
 *
 * 方案A (2026-10-01): 经源码级根因定位, 本定制与 DSH 原生布局引擎互斥,
 * 默认不再注入 (dsh.layoutTweaks 默认 false, 仅显式设为 true 时启用)。
 * 根因: DSH AppFrame 是 CSS Grid, 列宽 / 拖拽手柄位置 / 右栏折叠全部由 JS 以
 * 内联样式写入 (grid-template-columns, handle.left, data-rightbar-collapsed),
 * 右侧面板是 position:absolute + transform 滑入的覆盖层 (轨道只决定中栏是否让位);
 * 本函数将其整体改写为 flex + order + position:relative 并 !important 覆盖
 * --dsh-chat-content-width, 造成:
 *   1) 会话滚动视口/输入区被 min(920px, …) 二次钳制且脱离原生变量链 → 大屏右侧留白;
 *   2) 原生会话宽度拖拽手柄错位且拖动无效 (写 --dsh-chat-user-width 被架空);
 *   3) handle[data-side="sidebar"] 被 display:none → 原生侧栏调宽被禁用;
 *   4) 右栏轨道归零时 overflow:hidden 会裁掉已打开的面板 (原生为覆盖层, 不受轨道宽度影响)。
 * 如需重新启用, 请在设置中显式打开「定制 UI 微调」并自行承担上述偏差。
 * 注意: 必须严格限定为 #root 顶层主框架，严禁使用宽松后代选择器污染内部 ChatView、Conversation 及消息组件
 */
function getDshCustomStyles(enable = false) {
  // 方案A: 默认关闭 —— 仅当调用方显式传入 true 时才注入
  // (旧语义 enable !== false 已废弃, 因为它让"未配置"也等同于开启)
  if (enable !== true) return '';
  return `
/* ==========================================================================
   TabonKB DSH Custom Overrides: Right-Docked Navigation Rail & Full-Width Chat
   ========================================================================== */

/* 1. AppFrame 主框架容器：限定为包含侧栏与会话视窗的主框架，采用 flex-direction: row 配合 order 进行显式列排序 */
#root > .pI_x6G_frame,
#root .pI_x6G_frame,
#root div[class*="_frame"]:has(> div[class*="_sidebarCol"]) {
  display: flex !important;
  flex-direction: row !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  position: relative !important;
}

/* 2. 居中主会话视窗：排布为第 1 列 (order: 1)，占据剩余可用宽度，随右侧栏展开弹性收缩并自然左移 */
#root .pI_x6G_centerCol,
#root div[class*="_frame"]:has(> div[class*="_sidebarCol"]) > div[class*="_centerCol"] {
  order: 1 !important;
  flex: 1 1 0% !important;
  min-width: 0 !important;
  width: auto !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

/* 3. 右侧辅助栏 (文件树、文档预览、终端等)：置于会话视窗与最右侧导航轨之间 (order: 2) */
#root .pI_x6G_rightbarCol,
#root div[class*="_frame"]:has(> div[class*="_sidebarCol"]) > div[class*="_rightbarCol"] {
  order: 2 !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  min-width: 0 !important;
  transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1), flex-basis 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

/* 3.1 当右侧辅助栏折叠/关闭时：彻底归零宽度，不占用会话空间 */
#root .pI_x6G_frame[data-rightbar-collapsed] .pI_x6G_rightbarCol,
#root div[class*="_frame"][data-rightbar-collapsed] div[class*="_rightbarCol"],
#root div[class*="_rightbarCol"]:not(:has(div[data-sidebar-right-open])) {
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  flex: 0 0 0px !important;
  overflow: hidden !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* 3.1 当右侧辅助栏折叠/关闭时：隐藏未打开面板，严禁使用后代:has选择器误伤面板自身 */
#root div[class*="_rightbarCol"] div[class*="_panel"]:not([data-sidebar-right-open]),
#root div[class*="_rightbarCol"] div[data-sidebar-right-session][hidden] {
  display: none !important;
}

/* 3.2 当右侧辅助栏展开时：取消 position: absolute 脱标浮层，使其以真实物理宽度参与 Flex 排布 */
#root .pI_x6G_frame:not([data-rightbar-collapsed]) .pI_x6G_rightbarCol,
#root div[class*="_rightbarCol"]:has(div[data-sidebar-right-open]) {
  flex: 0 0 auto !important;
  width: auto !important;
  display: flex !important;
  border-left: 0.5px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.12)) !important;
  border-right: 0.5px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.12)) !important;
  overflow: visible !important;
  z-index: 15 !important;
}

#root div[class*="_rightbarCol"] div[data-sidebar-right-open],
#root div[class*="_rightbarCol"] .P3OORG_panel[data-sidebar-right-open],
#root div[class*="_rightbarCol"] div[class*="_panel"][data-sidebar-right-open] {
  display: flex !important;
  flex-direction: column !important;
  position: relative !important;
  top: auto !important;
  bottom: auto !important;
  right: auto !important;
  left: auto !important;
  height: 100% !important;
  pointer-events: auto !important;
}

/* 3.3 全屏模式独立悬浮遮罩 */
#root div[class*="_rightbarCol"] div[data-sidebar-right-panel="fullscreen"] {
  position: fixed !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 100 !important;
}

/* 4. DSH 导航轨与会话侧栏：吸附于视窗最右侧 (order: 3)，确保层级优先且不被抽屉遮挡 */
#root .pI_x6G_sidebarCol,
#root div[class*="_frame"]:has(> div[class*="_sidebarCol"]) > div[class*="_sidebarCol"] {
  order: 3 !important;
  flex: 0 0 auto !important;
  height: 100% !important;
  position: relative !important;
  z-index: 20 !important;
  border-left: 0.5px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.12)) !important;
  border-right: none !important;
}

/* 5. 核心防错保护：严禁 ChatView 内部被错误排布，坚决保持垂直列流排布 */
#root div[class*="_centerCol"] div[class*="_frame"],
#root div[class*="ChatView"],
#root div[class*="EvIC1a"],
#root div[class*="wSkVaW_root"],
#root div[class*="wSkVaW_body"],
#root div[class*="wSkVaW_viewArea"],
#root div[class*="wSkVaW_scrollBody"] {
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

/* 6. 会话流宽度自适应与居中排布：扩充可用宽度至 920px，并在右侧栏展开时自然左移 */
#root div[class*="wSkVaW_body"] {
  --dsh-chat-content-width: min(920px, calc(100% - 48px)) !important;
  --dsh-composer-card-max-width: min(952px, calc(100% - 32px)) !important;
}

#root div[class*="EvIC1a_column"],
#root div[class*="_centerCol"] div[class*="_column"],
#root div[class*="wSkVaW_body"] > div {
  width: 100% !important;
  max-width: min(920px, calc(100% - 48px)) !important;
  margin: 0 auto !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

/* 7. 隐藏原左侧吸附时的拖拽分隔手柄，并将右侧拖拽手柄向左平移侧栏宽度以精确对齐抽屉左边缘 */
#root .pI_x6G_handle[data-side="sidebar"],
#root div[class*="_handle"][data-side="sidebar"] {
  display: none !important;
}

#root .pI_x6G_handle[data-side="rightbar"],
#root div[class*="_handle"][data-side="rightbar"] {
  transform: translateX(-56px) !important;
  z-index: 25 !important;
}

#root div[class*="_frame"]:not([data-sidebar-collapsed]) div[class*="_handle"][data-side="rightbar"] {
  transform: translateX(-280px) !important;
}

/* 8. 折叠/展开侧栏按钮图标水平翻转 (适应右侧吸附形态) */
#root .hHd-Xa_toggle .hHd-Xa_panelIcon,
#root button[class*="_toggle"] svg[class*="_panelIcon"],
#root button[data-tooltip*="侧栏"] svg,
#root button[data-tooltip*="sidebar"] svg {
  transform: scaleX(-1);
}

/* ==========================================================================
   R5 后备选择器 (hash 无关): DSH 前端构建哈希变化时上面的 pI_x6G_/hHd-Xa_ 类名会失效,
   此处以 [class$="_xxx"] 后缀匹配兜底, 保证右侧吸附布局与折叠隐藏依然成立
   ========================================================================== */
#root div[class$="_frame"]:has(> div[class$="_sidebarCol"]) {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: row !important;
  overflow: hidden !important;
}
#root div[class$="_frame"]:has(> div[class$="_sidebarCol"]) > div[class$="_centerCol"] {
  order: 1 !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  height: 100% !important;
}
#root div[class$="_frame"]:has(> div[class$="_sidebarCol"]) > div[class$="_rightbarCol"] {
  order: 2 !important;
  min-width: 0 !important;
  height: 100% !important;
}
#root div[class$="_frame"]:has(> div[class$="_sidebarCol"]) > div[class$="_sidebarCol"] {
  order: 3 !important;
  flex: 0 0 auto !important;
  height: 100% !important;
}
#root div[class$="_rightbarCol"] div[class$="_panel"]:not([data-sidebar-right-open]),
#root div[class$="_rightbarCol"] div[data-sidebar-right-session][hidden] {
  display: none !important;
}
`.trim();
}

/**
 * TabonKB 定制化: DeepSeek Harness 原生侧栏折叠态彻底隐藏样式
 * 消除折叠后残留的 56px 冗余图标轨，让会话区域 100% 铺满视窗；
 * 展开态 (280px 会话列表) 保持完全原生，不受任何影响。
 */
function getDshSidebarHideStyles() {
  return `
/* TabonKB: 当 DSH 原生侧栏处于折叠/收起态时，彻底归零宽度并隐藏 56px 图标轨，使会话视窗 100% 铺满 */
div[data-sidebar-collapsed] {
  grid-template-columns: 0px minmax(0px, 1fr) auto !important;
}
div[data-sidebar-collapsed] > div[class*="_sidebarCol"],
div[data-sidebar-collapsed] .hHd-Xa_root,
div[data-sidebar-collapsed] div[class*="_root"][class*="_collapsed"] {
  width: 0px !important;
  min-width: 0px !important;
  max-width: 0px !important;
  flex: 0 0 0px !important;
  overflow: hidden !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`.trim();
}

/**
 * TabonKB 定制化: DeepSeek Harness 会话中文件链接点击事件桥接脚本
 * 捕获 Markdown 渲染的文件链接与提及点击，通过 postMessage 传递至 Obsidian 宿主
 * 实现自然在右侧工作区打开相应笔记、架构图表或技术文档
 */
function getDshFileBridgeScript() {
  return `
(function() {
  if (window._tabonkbFileBridgeInstalled) return;
  window._tabonkbFileBridgeInstalled = true;

  // 0. 注入原生侧栏折叠态彻底隐藏样式 (消除 56px 冗余图标轨)
  var hideCss = [
    'div[data-sidebar-collapsed] {',
    '  grid-template-columns: 0px minmax(0px, 1fr) auto !important;',
    '}',
    'div[data-sidebar-collapsed] > div[class*="_sidebarCol"],',
    'div[data-sidebar-collapsed] .hHd-Xa_root,',
    'div[data-sidebar-collapsed] div[class*="_root"][class*="_collapsed"] {',
    '  width: 0px !important;',
    '  min-width: 0px !important;',
    '  max-width: 0px !important;',
    '  flex: 0 0 0px !important;',
    '  overflow: hidden !important;',
    '  border: none !important;',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  opacity: 0 !important;',
    '  visibility: hidden !important;',
    '  pointer-events: none !important;',
    '}'
  ].join('\\n');
  var hideStyleTag = document.createElement('style');
  hideStyleTag.id = 'tabonkb-dsh-sidebar-hide';
  hideStyleTag.textContent = hideCss;
  (document.head || document.documentElement).appendChild(hideStyleTag);

  // 1. Markdown 内部文件链接点击事件桥接
  document.addEventListener('click', function(e) {
    const linkEl = e.target.closest('button[class*="fileLink"], button[class*="fileMention"], a[class*="fileLink"], a[href], [data-file-path]');
    if (!linkEl) return;

    let target = linkEl.getAttribute('data-file-path') || linkEl.title || linkEl.getAttribute('href') || '';
    if (!target) {
      target = (linkEl.textContent || '').trim();
    }
    if (!target) return;

    // 清理 target
    target = target.replace(/^@["']?|["']?$/g, '').trim();
    if (/^[a-z]+:\\/\\//i.test(target) || /^mailto:/i.test(target) || target.startsWith('#')) return;

    let line = 0;
    const hashIdx = target.indexOf('#');
    if (hashIdx !== -1) {
      const frag = target.slice(hashIdx + 1);
      const m = /^L([1-9]\\d*)/i.exec(frag);
      if (m) line = parseInt(m[1], 10);
      target = target.slice(0, hashIdx);
    }

    if (/\\.[a-zA-Z0-9_-]+$/.test(target) || target.includes('/') || target.includes('\\\\')) {
      // 拦截并彻底阻止 DSH 内部事件分发与冒泡（防止 DSH 内部右侧面板弹出，造成与 Obsidian 标签页双开的视觉冗余）
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'tabonkb-dsh-open-file',
            path: target,
            line: line
          }, '*');
        }
      } catch (err) {
        console.warn('[TabonKB FileBridge] postMessage error:', err);
      }
    }
  }, true);

  // 2. DSH 原生侧栏控制桥接: 默认隐藏/折叠 + 监听外部双击切换指令
  function findDshToggleBtn() {
    return document.querySelector('button[class*="_toggle"]') || 
           document.querySelector('.hHd-Xa_toggle') ||
           document.querySelector('button[aria-label*="侧栏"]') ||
           document.querySelector('button[aria-label*="sidebar"]');
  }

  function isDshSidebarCollapsed() {
    var appFrame = document.querySelector('[class*="_frame"]');
    if (appFrame && appFrame.hasAttribute('data-sidebar-collapsed')) return true;
    return !!document.querySelector('[class*="_root"][class*="_collapsed"]');
  }

  // 默认初始自动收起侧栏 (DSH 初始默认为 280px 展开态)
  var hasAutoCollapsed = false;
  function ensureDefaultCollapsed() {
    if (hasAutoCollapsed) return true;
    var btn = findDshToggleBtn();
    if (btn) {
      if (!isDshSidebarCollapsed()) {
        btn.click();
      }
      hasAutoCollapsed = true;
      return true;
    }
    return false;
  }

  if (!ensureDefaultCollapsed()) {
    var observer = new MutationObserver(function() {
      if (ensureDefaultCollapsed()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function() { observer.disconnect(); }, 15000);
  }

  // 3. 实时应用来自宿主工作台的主题消息 (跨源 postMessage + localStorage 同步)
  function applyTabonKbDshTheme(payload) {
    if (!payload || !payload.css) return;
    try {
      var skinId = payload.skinId || 'glass';
      var wallId = payload.wallId || 'aurora';
      var mode = payload.mode || 'light';
      document.documentElement.dataset.akSkin = skinId;
      document.documentElement.dataset.akWall = wallId;
      document.documentElement.style.colorScheme = mode;
      if (document.body) {
        document.body.dataset.theme = mode;
      }
      var styleEl = document.getElementById('tabonkb-dsh-theme-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'tabonkb-dsh-theme-style';
        (document.head || document.documentElement).appendChild(styleEl);
      }
      styleEl.textContent = payload.css;
      try {
        localStorage.setItem('dt.skin', skinId);
        localStorage.setItem('dt.wall', wallId);
        localStorage.removeItem('dsh.antutu.off');
        window.dispatchEvent(new StorageEvent('storage', { key: 'dt.skin', newValue: skinId }));
      } catch (_) {}
    } catch (_) {}
  }

  // Keep #tabonkb-dsh-theme-style at the end of <head> so DSH dynamic style tags do not override it
  try {
    var headObserver = new MutationObserver(function() {
      var st = document.getElementById('tabonkb-dsh-theme-style');
      if (st && document.head && document.head.lastElementChild !== st) {
        document.head.appendChild(st);
      }
    });
    if (document.head) {
      headObserver.observe(document.head, { childList: true });
    }
  } catch (_) {}

  // 监听来自宿主 (Obsidian) 的双击切换侧栏与主题同步消息
  window.addEventListener('message', function(e) {
    if (!e || !e.data) return;
    if (e.data.type === 'tabonkb-dsh-apply-theme') {
      applyTabonKbDshTheme(e.data);
      return;
    }
    if (e.data.type === 'tabonkb-dsh-toggle-sidebar') {
      var btn = findDshToggleBtn();
      if (!btn) return;
      var collapsed = isDshSidebarCollapsed();
      if (typeof e.data.collapse === 'boolean') {
        if (e.data.collapse !== collapsed) {
          btn.click();
        }
      } else {
        btn.click();
      }
    }
  });

  // 4. 选区右键: 拦截 Obsidian/Electron 原生菜单 (其 Copy role 自带不可去除的 Ctrl+C accelerator),
  //    改为极简单项「复制」自绘菜单; 输入框/可编辑区保持原生菜单 (需要粘贴/剪切等)
  var _twCopyMenu = null;
  function closeTwCopyMenu() {
    if (_twCopyMenu && _twCopyMenu.parentNode) _twCopyMenu.parentNode.removeChild(_twCopyMenu);
    _twCopyMenu = null;
  }
  function isEditableTarget(t) {
    if (!t || !t.closest) return false;
    return !!t.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [data-lexical-editor]');
  }
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function() { document.execCommand('copy'); });
        return;
      }
    } catch (_) {}
    try { document.execCommand('copy'); } catch (_) {}
  }
  document.addEventListener('contextmenu', function(e) {
    if (isEditableTarget(e.target)) return;
    var sel = window.getSelection && window.getSelection();
    var text = sel ? sel.toString() : '';
    if (!text || !text.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    closeTwCopyMenu();
    var m = document.createElement('div');
    m.id = 'tabonkb-copy-menu';
    m.textContent = '\u590d\u5236';
    m.style.cssText = 'position:fixed;z-index:2147483647;padding:6px 18px;font-size:13px;line-height:20px;border-radius:8px;cursor:pointer;user-select:none;'
      + 'color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-specific-menu,rgba(255,255,255,.96));'
      + 'box-shadow:0 6px 20px rgba(0,0,0,.14),0 0 0 .5px rgba(128,128,128,.25);backdrop-filter:blur(16px);';
    m.onmouseenter = function() { m.style.background = 'var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))'; };
    m.onmouseleave = function() { m.style.background = 'var(--dsw-specific-menu,rgba(255,255,255,.96))'; };
    m.onmousedown = function(ev) { ev.preventDefault(); };
    m.onclick = function(ev) { ev.stopPropagation(); copyText(text); closeTwCopyMenu(); };
    m.oncontextmenu = function(ev) { ev.preventDefault(); };
    document.body.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(e.clientX, window.innerWidth - w - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(e.clientY, window.innerHeight - h - 4)) + 'px';
    _twCopyMenu = m;
  }, true);
  document.addEventListener('mousedown', function(e) {
    if (_twCopyMenu && !_twCopyMenu.contains(e.target)) closeTwCopyMenu();
  }, true);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeTwCopyMenu(); }, true);
  window.addEventListener('blur', closeTwCopyMenu);
  window.addEventListener('wheel', closeTwCopyMenu, { passive: true, capture: true });

  // 5. 快捷键桥接: Ctrl+← 隐藏 / Ctrl+→ 展示 工作台导航栏 (iframe 内按键到不了父文档, 转 postMessage)
  document.addEventListener('keydown', function(e) {
    if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    try { window.parent.postMessage({ type: 'tabonkb-navrail', dir: e.code === 'ArrowLeft' ? 'hide' : 'show' }, '*'); } catch (_) {}
  }, true);

  // Notify parent Obsidian Workbench that DSH iframe bridge is ready for theme sync
  function notifyReady() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'tabonkb-dsh-ready' }, '*');
      }
    } catch (_) {}
  }
  notifyReady();
  setTimeout(notifyReady, 150);
  setTimeout(notifyReady, 500);
})();
`.trim();
}

/**
 * TabonKB 定制化: DSH「+」菜单注入工程上下文配置项桥接脚本
 * - MutationObserver 侦测原生「+」弹出菜单 (识别 文件/file/压缩/compact/权限/模型 等特征词)
 * - 菜单尾部追加「上下文」分组: OpenGrok / Gerrit / Jira 工单 / 本地工程 (与自研 Agent 抽屉同源)
 * - 点击项右侧级联出自研毛玻璃面板 (外置 DOM, 不受 React 重渲染影响), 选项即选即关
 * - 选项数据与当前值全部经 postMessage 与宿主双向同步, 不落 iframe 侧 localStorage
 */
function getDshContextBridgeScript() {
  return `
(function () {
  if (window._twxCtxBridgeCleanup) {
    try { window._twxCtxBridgeCleanup(); } catch (_) {}
  }
  window._twxCtxBridgeInstalled = true;

  var CSS = [
    '._3e4SsG_item,.twx-item{transition:background-color .12s ease,color .12s ease!important;}',
    // 分组标题：统一与原生 _3e4SsG_sectionTitle 样式，两端对齐带极简范围提示
    '._3e4SsG_sectionTitle,.twx-sec-title{display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:22px!important;padding:5px 8px 3px!important;font-size:11px!important;font-weight:500!important;line-height:16px!important;letter-spacing:.2px!important;color:var(--dsw-alias-label-tertiary,#8b949e)!important;background:transparent!important;user-select:none!important;box-sizing:border-box!important;}',
    '._3e4SsG_sectionTitle:not(:first-child),.twx-sec-title{border-top:.5px solid rgba(128,128,128,.12)!important;margin-top:4px!important;padding-top:5px!important;}',
    '.twx-sec-name{font-weight:600!important;color:inherit!important;}',
    // 滚动微角标：提示当前显示子项范围，支持点击与滚轮交互
    '.twx-sec-badge{display:inline-flex!important;align-items:center!important;font-size:9.5px!important;font-weight:500!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;color:var(--dsw-alias-label-tertiary,#9ca3af)!important;background:rgba(128,128,128,.08)!important;padding:1px 5px!important;border-radius:4px!important;cursor:pointer!important;transition:all .12s ease!important;}',
    '.twx-sec-badge:hover{background:rgba(128,128,128,.18)!important;color:var(--dsw-alias-label-primary,#111827)!important;}',
    // 上下文分组子项按钮：完全复刻原生 _3e4SsG_item 尺寸与状态（不设 !important，确保可被隐藏规则覆盖）
    '.twx-item{display:flex;align-items:center;gap:7px;width:100%;min-height:34px;height:34px;padding:6px 8px;margin:0;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-md,6px);background:transparent;cursor:pointer;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#111827);text-align:left;}',
    '.twx-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08))!important;}',
    '.twx-dot{width:7px!important;height:7px!important;border-radius:50%!important;flex:0 0 auto!important;}',
    '.twx-name{font-weight:500!important;color:inherit!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;flex:0 0 auto!important;}',
    '.twx-val{margin-left:auto!important;font-size:12px!important;color:var(--dsw-alias-label-tertiary,#8b949e)!important;max-width:120px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:right!important;}',
    '.twx-arrow{color:var(--dsw-alias-label-tertiary,#9ca3af)!important;font-size:12px!important;margin-left:2px!important;flex:0 0 auto!important;}',
    // 菜单容器外廓约束：固定紧凑高度 ~280px，彻底消除外层冗余纵向滚动条，充足 headroom 避免高 DPI 截断
    '._3e4SsG_viewport,[role="listbox"]{overflow-y:hidden!important;overflow-x:hidden!important;max-height:none!important;}',
    '.twx-plus-menu{background:rgba(255,255,255,.97)!important;backdrop-filter:blur(28px) saturate(180%)!important;-webkit-backdrop-filter:blur(28px) saturate(180%)!important;max-height:380px!important;}',
    '.twx-panel{position:fixed;z-index:2147483000;width:280px;max-height:min(380px,calc(100vh - 40px));display:flex;flex-direction:column;border-radius:12px;overflow:hidden;font-family:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#111827);background:rgba(255,255,255,.97)!important;border:1px solid var(--dsw-alias-border-secondary,rgba(0,0,0,.08));box-shadow:0 16px 36px -4px rgba(0,0,0,.14),0 0 1px 1px rgba(0,0,0,.04);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);}',
    '.twx-p-search{display:flex;align-items:center;padding:7px 8px 5px;}',
    '.twx-search-box{display:flex;align-items:center;gap:6px;width:100%;padding:5px 9px;border-radius:7px;background:rgba(128,128,128,.06);border:1px solid rgba(128,128,128,.12);transition:border-color .15s ease,background-color .15s ease,box-shadow .15s ease;}',
    '.twx-search-box:focus-within{border-color:rgba(16,185,129,.45);background:rgba(128,128,128,.1);box-shadow:0 0 0 2px rgba(16,185,129,.12);}',
    '.twx-search-ic{color:#8b949e;flex:none;opacity:.8;}',
    '.twx-search-box input{flex:1;min-width:0;border:0!important;outline:0!important;box-shadow:none!important;background:transparent;font-size:12px;color:inherit;font-family:inherit;line-height:18px;}',
    '.twx-search-box input::placeholder{color:var(--dsw-alias-label-tertiary,#9ca3af);opacity:.75;}',
    '.twx-p-nav{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid rgba(128,128,128,.08);font-size:11.5px;color:var(--dsw-alias-label-primary,#111827);}',
    '.twx-back{display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:var(--dsw-alias-label-secondary,#64748b);font-weight:500;padding:2px 6px;border-radius:5px;font-style:normal;transition:all .12s ease;user-select:none;}',
    '.twx-back:hover{color:var(--dsw-alias-label-primary,#0f172a);background:rgba(128,128,128,.08);}',
    '.twx-back i,.twx-back span{font-style:normal!important;font-family:inherit;}',
    '.twx-nav-title{flex:1;min-width:0;font-weight:500;font-size:12px;color:var(--dsw-alias-label-primary,#111827);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace,inherit;}',
    '.twx-p-list{overflow-y:auto;padding:3px 2px 5px;flex:1;}',
    '.twx-p-list::-webkit-scrollbar{width:5px;}',
    '.twx-p-list::-webkit-scrollbar-thumb{background:rgba(128,128,128,.2);border-radius:3px;}',
    '.twx-opt{display:flex;align-items:center;gap:7px;padding:6px 9px;margin:1px 4px;border-radius:7px;cursor:pointer;font-size:12px;transition:background-color .12s ease;}',
    '.twx-opt:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));}',
    '.twx-opt.on{background:rgba(37,99,235,.08);}',
    '.twx-opt .t-main{min-width:0;flex:1;}',
    '.twx-opt .t-name{display:block;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35;color:var(--dsw-alias-label-primary,#111827);}',
    '.twx-opt .t-desc{display:block;font-size:11px;color:var(--dsw-alias-label-secondary,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;margin-top:2px;}',
    '.twx-opt .t-check{color:#10B981;font-size:11px;flex:0 0 auto;display:inline-flex;align-items:center;}',
    '.twx-tag{display:inline-block;margin-left:6px;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:500;background:rgba(128,128,128,.1);color:var(--dsw-alias-label-secondary,#6b7280);vertical-align:middle;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}',
    '.twx-arr{color:#9ca3af;font-size:11px;flex:0 0 auto;display:inline-flex;align-items:center;}',
    '.twx-cur{position:relative;display:flex;flex-direction:column;gap:3px;margin:4px 6px 6px;padding:6px 26px 6px 8px;border-radius:8px;background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);font-size:11.5px;}',
    '.twx-cur-top{display:flex;align-items:center;gap:5px;min-width:0;}',
    '.twx-cur-badge{display:inline-flex;align-items:center;gap:3px;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:600;color:#059669;background:rgba(16,185,129,.12);flex:none;}',
    '.twx-cur-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#111827);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}',
    '.twx-cur-desc{font-size:11px;color:var(--dsw-alias-label-secondary,#6b7280);line-height:1.35;padding-left:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.twx-cur-clear-btn{position:absolute;top:6px;right:6px;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:none;outline:none;background:transparent;border-radius:4px;cursor:pointer;color:var(--dsw-alias-label-secondary,#9ca3af);transition:color .12s ease,background-color .12s ease,transform .1s ease;}',
    '.twx-cur-clear-btn:hover{color:#ef4444;background:rgba(239,68,68,.12);}',
    '.twx-cur-clear-btn:active{transform:scale(0.92);}',
    '.twx-srv{padding:5px 8px 2px;font-size:10px;font-weight:600;color:#8b949e;}',
    '.twx-gbtn{display:block;margin:6px auto 2px;padding:3px 10px;font-size:10.5px;border-radius:6px;border:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;cursor:pointer;}',
    '.twx-gbtn:hover{background:rgba(128,128,128,.12);}',
    '.twx-loading,.twx-empty{padding:16px;text-align:center;font-size:11px;color:#8b949e;}',
    '.twx-chips{display:inline-flex;align-items:center;gap:2px;margin-left:2px;vertical-align:middle;flex:none;}',
    '.twx-chip{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 6px;margin:0;border-radius:var(--dsw-radius-sm,6px);border:none;outline:none;background:transparent;color:var(--dsw-alias-label-secondary,var(--dsw-text-secondary,var(--ds-text-secondary,#515154)));font-family:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;box-sizing:border-box;max-width:180px;white-space:nowrap;user-select:none;transform:translateZ(0);transition:background-color .12s ease,color .12s ease;}',
    '.twx-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));color:var(--dsw-alias-label-primary,var(--ds-text-primary,#111827));}',
    '.twx-chip:focus-visible{outline:2px solid var(--dsw-alias-border-focus,#2563eb);outline-offset:1px;}',
    '@media (prefers-color-scheme:dark){.twx-panel,.twx-plus-menu{background:rgba(26,26,30,.97)!important;border-color:rgba(255,255,255,.1);box-shadow:0 16px 36px -4px rgba(0,0,0,.45),0 0 1px 1px rgba(255,255,255,.06);color:#f3f4f6;}.twx-item{color:#f3f4f6!important;}.twx-sec-badge{color:#9ca3af!important;background:rgba(255,255,255,.08)!important;}.twx-sec-badge:hover{color:#f3f4f6!important;background:rgba(255,255,255,.16)!important;}.twx-search-box{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);}.twx-search-box:focus-within{background:rgba(255,255,255,.08);border-color:rgba(52,211,153,.5);box-shadow:0 0 0 2px rgba(16,185,129,.2);}.twx-p-nav{border-color:rgba(255,255,255,.08);color:#f3f4f6;}.twx-back{color:#94a3b8;}.twx-back:hover{color:#f8fafc;background:rgba(255,255,255,.08);}.twx-nav-title{color:#f3f4f6;}.twx-cur{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.25);}.twx-cur-badge{color:#34d399;background:rgba(16,185,129,.16);}.twx-cur-name{color:#f3f4f6;}.twx-cur-desc{color:#9ca3af;}.twx-cur-clear-btn{color:#9ca3af;background:transparent;border:none;}.twx-cur-clear-btn:hover{color:#f87171;background:rgba(239,68,68,.18);}.twx-opt:hover{background:rgba(255,255,255,.06);}.twx-opt .t-name{color:#f3f4f6;}.twx-opt .t-desc{color:#9ca3af;}.twx-chip{color:var(--dsw-alias-label-secondary,var(--dsw-text-secondary,var(--ds-text-secondary,#9ca3af)));}.twx-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,var(--ds-text-primary,#f3f4f6));}}',
    '.dark .twx-panel,[data-theme="dark"] .twx-panel,.dark .twx-plus-menu,[data-theme="dark"] .twx-plus-menu{background:rgba(26,26,30,.97)!important;border-color:rgba(255,255,255,.1);box-shadow:0 16px 36px -4px rgba(0,0,0,.45),0 0 1px 1px rgba(255,255,255,.06);color:#f3f4f6;}',
    '.dark .twx-item,[data-theme="dark"] .twx-item{color:#f3f4f6!important;}',
    '.dark .twx-sec-badge,[data-theme="dark"] .twx-sec-badge{color:#9ca3af!important;background:rgba(255,255,255,.08)!important;}',
    '.dark .twx-sec-badge:hover,[data-theme="dark"] .twx-sec-badge:hover{color:#f3f4f6!important;background:rgba(255,255,255,.16)!important;}',
    '.dark .twx-search-box,[data-theme="dark"] .twx-search-box{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);}',
    '.dark .twx-search-box:focus-within,[data-theme="dark"] .twx-search-box:focus-within{background:rgba(255,255,255,.08);border-color:rgba(52,211,153,.5);box-shadow:0 0 0 2px rgba(16,185,129,.2);}',
    '.dark .twx-p-nav,[data-theme="dark"] .twx-p-nav{border-color:rgba(255,255,255,.08);color:#f3f4f6;}',
    '.dark .twx-back,[data-theme="dark"] .twx-back{color:#94a3b8;}',
    '.dark .twx-back:hover,[data-theme="dark"] .twx-back:hover{color:#f8fafc;background:rgba(255,255,255,.08);}',
    '.dark .twx-nav-title,[data-theme="dark"] .twx-nav-title{color:#f3f4f6;}',
    '.dark .twx-cur,[data-theme="dark"] .twx-cur{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.25);}',
    '.dark .twx-cur-badge,[data-theme="dark"] .twx-cur-badge{color:#34d399;background:rgba(16,185,129,.16);}',
    '.dark .twx-cur-name,[data-theme="dark"] .twx-cur-name{color:#f3f4f6;}',
    '.dark .twx-cur-desc,[data-theme="dark"] .twx-cur-desc{color:#9ca3af;}',
    '.dark .twx-cur-clear-btn,[data-theme="dark"] .twx-cur-clear-btn{color:#9ca3af;background:transparent;border:none;}',
    '.dark .twx-cur-clear-btn:hover,[data-theme="dark"] .twx-cur-clear-btn:hover{color:#f87171;background:rgba(239,68,68,.18);}',
    '.dark .twx-opt:hover,[data-theme="dark"] .twx-opt:hover{background:rgba(255,255,255,.06);}',
    '.dark .twx-opt .t-name,[data-theme="dark"] .twx-opt .t-name{color:#f3f4f6;}',
    '.dark .twx-opt .t-desc,[data-theme="dark"] .twx-opt .t-desc{color:#9ca3af;}',
    '.dark .twx-chip,[data-theme="dark"] .twx-chip{color:var(--dsw-alias-label-secondary,var(--dsw-text-secondary,var(--ds-text-secondary,#9ca3af)));}',
    '.dark .twx-chip:hover,[data-theme="dark"] .twx-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,var(--ds-text-primary,#f3f4f6));}',
    '.twx-chip-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;color:currentColor;}',
    '.twx-chip-icon svg{width:14px;height:14px;display:block;}',
    '.twx-chip-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;}',
    // 终极隐藏兜底（位于样式表最末尾，保证最高层叠权重，彻底消除 ghost 占位空白）
    '[data-twx-hidden="true"],.twx-item[data-twx-hidden="true"],._3e4SsG_item[data-twx-hidden="true"],button[data-twx-hidden="true"]{display:none!important;height:0!important;min-height:0!important;max-height:0!important;padding:0!important;margin:0!important;border:none!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important;visibility:hidden!important;}'
  ].join('\\n');

  var styleEl = document.createElement('style');
  styleEl.id = 'twx-ctx-style';
  styleEl.textContent = CSS;
  (document.head || document.documentElement).appendChild(styleEl);

  var OG_PROJECTS = [
    { id: 'auto', name: 'Auto', desc: '按提问及平台智能推断' },
    { id: 'W_sprd_os_dev', name: 'W_sprd_os_dev', desc: '展锐主线' },
    { id: 'V_sprd_os_dev', name: 'V_sprd_os_dev', desc: '展锐分支' },
    { id: 'W_mp1_os_dev', name: 'W_mp1_os_dev', desc: 'MTK 主线' },
    { id: 'A17_mp1_os_dev', name: 'A17_mp1_os_dev', desc: 'MTK A17' },
    { id: 'T_U_sprd_oversea_release', name: 'T_U_sprd_oversea', desc: '展锐海外' },
    { id: 'T_U_mp1_oversea_release', name: 'T_U_mp1_oversea', desc: 'MTK 海外' },
    { id: 'V_oversea_release', name: 'V_oversea_release', desc: '海外分支' },
    { id: 'S_U_aiot_oversea_release', name: 'S_U_aiot_oversea', desc: 'AIoT 版' },
    { id: 'Aselsan_release_A16_1.57', name: 'Aselsan_A16', desc: '专网定制' }
  ];
  var GERRIT_FILTERS = [
    { id: 'all', name: '全部', desc: '检索全库代码评审' },
    { id: 'open', name: '开放中', desc: '当前处于评审中' },
    { id: 'merged', name: '已合入', desc: '已通过并合入主干' },
    { id: 'mine', name: '我提交', desc: '本人创建的变更单' },
    { id: 'reviewing', name: '待我审', desc: '指派给我的待评审单' }
  ];
  var ROWS = [
    { key: 'opengrok', name: 'OpenGrok', color: '#10B981' },
    { key: 'gerrit', name: 'Gerrit', color: '#6366F1' },
    { key: 'jira', name: 'Jira 工单', color: '#0EA5E9' },
    { key: 'localproj', name: '本地工程', color: '#F59E0B' }
  ];
  var GERRIT_LABELS = { all: '全部', open: '开放中', merged: '已合入', mine: '我提交', reviewing: '待我审' };
  // 胶囊小图标 (14×14 规范, stroke=currentColor 跟随主题文字色): 项目=文件夹 / Jira=工单 / OpenGrok=代码 / Gerrit=代码评审
  var CHIP_ICONS = {
    localproj: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h3.6l1.4 1.8h6a1 1 0 0 1 1 1v6.2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/></svg>',
    jira: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2" width="11" height="12" rx="1.5"/><path d="M5 5.2h6M5 8h6M5 10.8h3.8"/></svg>',
    opengrok: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5 1.8 8 5 11.5M11 4.5 14.2 8 11 11.5"/></svg>',
    gerrit: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="4" r="1.8"/><circle cx="4.5" cy="12" r="1.8"/><circle cx="11.5" cy="8" r="1.8"/><path d="M4.5 5.8v4.4M6.2 11.5c2.3-.3 3.8-1.5 4.3-2.3"/></svg>'
  };

  var ctxState = { values: {}, lists: { jira: [], localproj: [] } };
  var menuEl = null;
  var panelEl = null;
  var openKey = null;
  var panelQuery = '';
  var chipsEl = null;
  // 本地工程四级递进导航状态 (与自研抽屉 localProjNavState 同构):
  // servers(服务器) > workspaces(总代码路径) > platforms(CPU平台) > projects(机型)
  var lpNav = { step: 'servers', serverId: null, workspaceName: null, platform: null };

  // 「添加」「指令」「上下文」三组统一 2 行限高窗口与独立平滑滚轮/点击步进
  var groupOffsets = { add: 0, cmd: 0, ctx: 0 };
  var groupItems = { add: [], cmd: [], ctx: [] };

  function updateGroupVisibility(grp) {
    var items = groupItems[grp] || [];
    var off = groupOffsets[grp] || 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item) continue;
      if (i >= off && i <= off + 1) {
        item.removeAttribute('data-twx-hidden');
        item.style.removeProperty('display');
        item.style.removeProperty('height');
        item.style.removeProperty('min-height');
        item.style.removeProperty('padding');
        item.style.removeProperty('margin');
        item.style.removeProperty('visibility');
      } else {
        item.setAttribute('data-twx-hidden', 'true');
        item.style.setProperty('display', 'none', 'important');
        item.style.setProperty('height', '0px', 'important');
        item.style.setProperty('min-height', '0px', 'important');
        item.style.setProperty('padding', '0px', 'important');
        item.style.setProperty('margin', '0px', 'important');
        item.style.setProperty('visibility', 'hidden', 'important');
      }
    }
    if (menuEl) {
      var badge = menuEl.querySelector('[data-twx-badge="' + grp + '"]');
      if (badge && items.length > 0) {
        var start = Math.min(off + 1, items.length);
        var end = Math.min(off + 2, items.length);
        badge.textContent = start + '-' + end + '/' + items.length;
      }
      var lb = menuEl.querySelector('[role="listbox"]') || menuEl.querySelector('._3e4SsG_viewport') || menuEl;
      if (lb && lb.scrollTop > 0) lb.scrollTop = 0;
    }
  }

  function setupGroupBadges(titleEl, grp, labelText) {
    if (!titleEl) return;
    titleEl.setAttribute('data-twx-title-grp', grp);
    var badge = titleEl.querySelector('.twx-sec-badge');
    if (!badge) {
      titleEl.innerHTML = '<span class="twx-sec-name">' + esc(labelText) + '</span>' +
        '<span class="twx-sec-badge" data-twx-badge="' + grp + '" title="滚轮滑动或点击切换">' +
        (groupOffsets[grp] + 1) + '-' + (groupOffsets[grp] + 2) + '/4</span>';
      badge = titleEl.querySelector('.twx-sec-badge');
      if (badge) {
        badge.onclick = function (e) {
          e.stopPropagation();
          var items = groupItems[grp] || [];
          var maxOff = Math.max(0, items.length - 2);
          groupOffsets[grp] = groupOffsets[grp] >= maxOff ? 0 : maxOff;
          updateGroupVisibility(grp);
        };
      }
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function askHost() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'tabonkb-dsh-ctx-state-req' }, '*');
      }
    } catch (_) {}
  }

  window.addEventListener('message', function (e) {
    if (!e || !e.data) return;
    if (e.data.type === 'tabonkb-dsh-ctx-state') {
      ctxState.values = e.data.values || {};
      if (e.data.lists) ctxState.lists = e.data.lists;
      refreshVals();
      updateCtxChips();
      if (panelEl) renderPanelList();
    }
  });

  function valLabel(key) {
    var v = ctxState.values || {};
    if (key === 'opengrok') return (!v.opengrok || v.opengrok === 'auto') ? 'Auto' : String(v.opengrok);
    if (key === 'gerrit') return GERRIT_LABELS[v.gerrit] || '全部';
    if (key === 'jira') return (v.jira && v.jira.key) ? v.jira.key : '未指定';
    if (key === 'localproj') return (v.localproj && v.localproj.label) ? v.localproj.label : '未指定';
    return '';
  }

  function refreshVals() {
    if (!menuEl) return;
    var nodes = menuEl.querySelectorAll('.twx-item');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-k');
      var ve = nodes[i].querySelector('.twx-val');
      if (ve) ve.textContent = valLabel(k);
    }
  }

  // ---- 「+」菜单识别与注入 ----
  var MENU_KEYS = ['文件', 'file', '目标', 'goal', '压缩', 'compact', '权限', 'permission', '模型', 'model', '下载', 'export', '添加', '指令'];
  function looksLikeAttachMenu(el) {
    if (!el || el.nodeType !== 1) return false;
    // 先做廉价的几何/定位过滤, 只有「底部浮层」才读取 innerText (避免高频 mutation 下的强制排版)
    var r = el.getBoundingClientRect();
    if (r.width < 150 || r.height < 110) return false;
    if (r.top < window.innerHeight * 0.25) return false;
    var cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    var t = (el.innerText || '').toLowerCase();
    if (t.length < 20 || t.length > 3000) return false;
    var hits = 0;
    for (var i = 0; i < MENU_KEYS.length; i++) {
      if (t.indexOf(MENU_KEYS[i]) !== -1) hits++;
    }
    return hits >= 4;
  }

  function pickMenu(root) {
    // 只在「新增/属性变化的子树」内查找菜单, 避免全文档 innerText 扫描造成流式渲染卡顿
    var best = null, bestArea = 1e12;
    function consider(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.closest && el.closest('.twx-panel')) return;
      if (!looksLikeAttachMenu(el)) return;
      var a = el.offsetWidth * el.offsetHeight;
      if (a < bestArea) { bestArea = a; best = el; }
    }
    consider(root);
    if (root && root.querySelectorAll) {
      var inner = root.querySelectorAll('*');
      for (var i = 0; i < inner.length; i++) consider(inner[i]);
    }
    return best;
  }

  function isDarkTheme() {
    return document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains('dark') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function applyMenuOpacity(m) {
    if (!m || m.nodeType !== 1) return;
    if (m.dataset.twxStyled === 'true') return;
    m.dataset.twxStyled = 'true';
    m.classList.add('twx-plus-menu');
    var bg = isDarkTheme() ? 'rgba(26, 26, 30, 0.97)' : 'rgba(255, 255, 255, 0.97)';
    m.style.setProperty('background', bg, 'important');
    m.style.setProperty('backdrop-filter', 'blur(28px) saturate(180%)', 'important');
    m.style.setProperty('-webkit-backdrop-filter', 'blur(28px) saturate(180%)', 'important');
  }

  function onMenuFound(menu) {
    if (menu !== menuEl) {
      menuEl = menu;
      groupOffsets.add = 0;
      groupOffsets.cmd = 0;
      groupOffsets.ctx = 0;
      applyMenuOpacity(menu);
      injectGroup(menu);
    } else if (!menuEl.querySelector('.twx-sec-title')) {
      applyMenuOpacity(menuEl);
      injectGroup(menuEl);
    } else {
      applyMenuOpacity(menuEl);
      refreshVals();
    }
    askHost();
  }

  function injectGroup(menu) {
    applyMenuOpacity(menu);
    var listbox = menu.querySelector('[role="listbox"]') || menu.querySelector('._3e4SsG_viewport') || menu;
    if (!listbox) return;

    // 清理历史旧版残留容器
    var legacyGroup = listbox.querySelector('.twx-ctx-group');
    if (legacyGroup) { try { legacyGroup.remove(); } catch (_) {} }
    var legacyBlock = listbox.querySelector('.twx-ctx-block');
    if (legacyBlock) { try { legacyBlock.remove(); } catch (_) {} }

    // 1. 扫描 listbox 内部的原生子项，按标题分类到 add 和 cmd
    var children = Array.from(listbox.children);
    var currentGroup = 'add';
    var addItems = [];
    var cmdItems = [];
    var addTitle = null;
    var cmdTitle = null;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.classList && child.classList.contains('twx-sec-title')) continue;
      if (child.classList && child.classList.contains('twx-item')) continue;

      var text = (child.innerText || '').trim();
      var isTitle = child.getAttribute('role') === 'presentation' ||
        (child.classList && child.classList.contains('_3e4SsG_sectionTitle')) ||
        text === '添加' || text.startsWith('添加') ||
        text === '指令' || text.startsWith('指令');

      if (isTitle) {
        if (text.indexOf('添加') !== -1 || (!addTitle && text.indexOf('指令') === -1)) {
          currentGroup = 'add';
          addTitle = child;
          setupGroupBadges(child, 'add', '添加');
        } else if (text.indexOf('指令') !== -1 || addTitle) {
          currentGroup = 'cmd';
          cmdTitle = child;
          setupGroupBadges(child, 'cmd', '指令');
        }
      } else if (child.tagName === 'BUTTON' || (child.getAttribute && child.getAttribute('role') === 'option')) {
        child.setAttribute('data-twx-grp', currentGroup);
        if (currentGroup === 'add') {
          child.setAttribute('data-twx-idx', String(addItems.length));
          addItems.push(child);
        } else {
          child.setAttribute('data-twx-idx', String(cmdItems.length));
          cmdItems.push(child);
        }
      }
    }

    groupItems.add = addItems;
    groupItems.cmd = cmdItems;

    // 2. 注入第三组：上下文 (结构与前两组完全对称同源)
    var ctxTitle = listbox.querySelector('.twx-sec-title[data-twx-title-grp="ctx"]');
    if (!ctxTitle) {
      ctxTitle = document.createElement('div');
      ctxTitle.className = '_3e4SsG_sectionTitle twx-sec-title';
      ctxTitle.setAttribute('role', 'presentation');
      setupGroupBadges(ctxTitle, 'ctx', '上下文');
      listbox.appendChild(ctxTitle);

      var ctxItems = [];
      for (var j = 0; j < ROWS.length; j++) {
        var r = ROWS[j];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.className = '_3e4SsG_item twx-item';
        btn.setAttribute('data-twx-grp', 'ctx');
        btn.setAttribute('data-twx-idx', String(j));
        btn.setAttribute('data-k', r.key);
        btn.innerHTML =
          '<span class="twx-dot" style="background:' + r.color + '"></span>' +
          '<span class="_3e4SsG_itemName twx-name">' + r.name + '</span>' +
          '<span class="_3e4SsG_itemDescription twx-val">' + esc(valLabel(r.key)) + '</span>' +
          '<span class="twx-arrow">›</span>';
        listbox.appendChild(btn);
        ctxItems.push(btn);
      }
      groupItems.ctx = ctxItems;
    } else {
      var ctxEls = listbox.querySelectorAll('.twx-item[data-twx-grp="ctx"]');
      groupItems.ctx = Array.from(ctxEls);
    }

    // 3. 初始只展示各组前 2 项
    updateGroupVisibility('add');
    updateGroupVisibility('cmd');
    updateGroupVisibility('ctx');
  }

  // ---- 级联选项面板 (自有 DOM, 非 React 托管) ----
  function openPanel(key, itemEl) {
    if (openKey === key && panelEl) { closePanel(); return; }
    closePanel();
    openKey = key;
    panelQuery = '';
    lpNav = { step: 'servers', serverId: null, workspaceName: null, platform: null };
    var itemR = itemEl.getBoundingClientRect();
    var menuR = (menuEl && menuEl.isConnected) ? menuEl.getBoundingClientRect() : itemR;
    var w = 280;
    var isChip = itemEl && itemEl.classList && itemEl.classList.contains('twx-chip');
    var left, bottomPx;
    if (isChip) {
      left = itemR.left;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      bottomPx = window.innerHeight - itemR.top + 6;
    } else {
      left = itemR.right - 6; // 6px 微重叠, 消除父子浮窗裂隙
      if (left + w > window.innerWidth - 8) {
        left = menuR.left - w + 6; // 视口右侧不足时向左翻转
      }
      bottomPx = window.innerHeight - menuR.bottom;
    }
    panelEl = document.createElement('div');
    panelEl.className = 'twx-panel';
    panelEl.style.left = Math.max(8, left) + 'px';
    panelEl.style.bottom = Math.max(8, bottomPx) + 'px';
    panelEl.innerHTML =
      '<div class="twx-p-search" style="display:none;"><div class="twx-search-box">' +
        '<svg class="twx-search-ic" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/></svg>' +
        '<input type="text" placeholder="搜索..." spellcheck="false" autocomplete="off" />' +
      '</div></div>' +
      '<div class="twx-p-nav" style="display:none;"><span class="twx-back" data-act="back"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5L5.5 8 10 12.5"/></svg><span></span></span><span class="twx-nav-title"></span></div>' +
      '<div class="twx-p-list"><div class="twx-loading">加载中…</div></div>';
    document.body.appendChild(panelEl);
    // 阻止面板内任何指针与鼠标事件冒泡至 document，防止触发 DSH 原生外点关闭逻辑造成左侧主菜单消失
    var stopEvt = function (e) { e.stopPropagation(); };
    panelEl.addEventListener('pointerdown', stopEvt, true);
    panelEl.addEventListener('pointerdown', stopEvt, false);
    panelEl.addEventListener('mousedown', stopEvt, true);
    panelEl.addEventListener('mousedown', stopEvt, false);
    panelEl.addEventListener('pointerup', stopEvt, false);
    panelEl.addEventListener('mouseup', stopEvt, false);

    panelEl.onclick = function (e) {
      e.stopPropagation();
      var t = e.target && e.target.closest ? e.target.closest('[data-act],[data-p]') : null;
      if (!t) return;
      handlePanelAction(t);
    };
    if (key === 'jira' || key === 'localproj') {
      var sw = panelEl.querySelector('.twx-p-search');
      sw.style.display = 'flex';
      var inp = sw.querySelector('input');
      inp.placeholder = key === 'localproj' ? '全局搜索 (如 K82NF, mt6878)...' : '搜索工单...';
      inp.oninput = function () { panelQuery = inp.value.trim().toLowerCase(); renderPanelList(); };
      inp.onclick = function (e) { e.stopPropagation(); };
      setTimeout(function () { try { inp.focus(); } catch (_) {} }, 30);
    }
    askHost();
    renderPanelList();
  }

  function closePanel() {
    if (panelEl) { try { panelEl.remove(); } catch (_) {} }
    panelEl = null;
    openKey = null;
    panelQuery = '';
  }

  function postSet(key, value) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'tabonkb-dsh-ctx-set', key: key, value: value }, '*');
      }
    } catch (_) {}
  }

  // 面板动作分发: data-p=最终选择项(JSON) / data-act=导航或清除动作
  function handlePanelAction(t) {
    var act = t.getAttribute('data-act');
    if (act === 'back') { lpBack(); renderPanelList(); return; }
    if (act === 'srv') { lpNav = { step: 'workspaces', serverId: t.getAttribute('data-v'), workspaceName: null, platform: null }; panelQuery = ''; clearSearch(); renderPanelList(); return; }
    if (act === 'ws') { lpNav = { step: 'platforms', serverId: lpNav.serverId, workspaceName: t.getAttribute('data-v'), platform: null }; panelQuery = ''; clearSearch(); renderPanelList(); return; }
    if (act === 'plat') { lpNav = { step: 'projects', serverId: lpNav.serverId, workspaceName: lpNav.workspaceName, platform: t.getAttribute('data-v') }; panelQuery = ''; clearSearch(); renderPanelList(); return; }
    if (act === 'gsearch') { lpNav = { step: 'servers', serverId: null, workspaceName: null, platform: null }; renderPanelList(); return; }
    if (act === 'clear-lp') { postSet('localproj', null); closePanel(); return; }
    if (act === 'clear-jira') { postSet('jira', null); closePanel(); return; }
    var raw = t.getAttribute('data-p');
    if (!raw) return;
    var payload = null;
    try { payload = JSON.parse(decodeURIComponent(raw)); } catch (_) {}
    if (!payload) return;
    postSet(payload.k, payload.v);
    closePanel();
  }

  function clearSearch() {
    var inp = panelEl && panelEl.querySelector('.twx-p-search input');
    if (inp) inp.value = '';
  }

  function lpBack() {
    if (lpNav.step === 'projects') lpNav = { step: 'platforms', serverId: lpNav.serverId, workspaceName: lpNav.workspaceName, platform: null };
    else if (lpNav.step === 'platforms') lpNav = { step: 'workspaces', serverId: lpNav.serverId, workspaceName: null, platform: null };
    else lpNav = { step: 'servers', serverId: null, workspaceName: null, platform: null };
    panelQuery = '';
    clearSearch();
  }

  function setNavHeader(backText, title) {
    var nav = panelEl && panelEl.querySelector('.twx-p-nav');
    if (!nav) return;
    if (!title) { nav.style.display = 'none'; return; }
    nav.style.display = 'flex';
    var labelEl = nav.querySelector('.twx-back span') || nav.querySelector('.twx-back i');
    if (labelEl) labelEl.textContent = backText || '返回';
    nav.querySelector('.twx-nav-title').textContent = title;
  }

  function isSel(key, idOrObj) {
    var v = ctxState.values || {};
    if (key === 'opengrok') return (v.opengrok || 'auto') === idOrObj;
    if (key === 'gerrit') return (v.gerrit || 'all') === idOrObj;
    if (key === 'jira') return !!(v.jira && idOrObj && v.jira.key === idOrObj.key);
    if (key === 'localproj') return !!(v.localproj && idOrObj && v.localproj.id === idOrObj.id);
    return false;
  }

  function optRow(name, desc, on, payload) {
    return '<div class="twx-opt' + (on ? ' on' : '') + '" data-p="' + encodeURIComponent(JSON.stringify(payload)) + '">' +
      '<span class="t-main"><span class="t-name">' + esc(name) + '</span>' +
      (desc ? '<span class="t-desc">' + esc(desc) + '</span>' : '') +
      '</span>' + (on ? '<span class="t-check"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6"/></svg></span>' : '') + '</div>';
  }

  function drillRow(act, val, name, tag, desc) {
    return '<div class="twx-opt" data-act="' + act + '" data-v="' + esc(val) + '">' +
      '<span class="t-main"><span class="t-name">' + esc(name) +
      (tag ? '<span class="twx-tag">' + esc(tag) + '</span>' : '') + '</span>' +
      (desc ? '<span class="t-desc">' + esc(desc) + '</span>' : '') +
      '</span><span class="twx-arr"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5l4.5 4.5L6 12.5"/></svg></span></div>';
  }

  function curCard(name, desc, clearAct) {
    return '<div class="twx-cur">' +
      '<button type="button" class="twx-cur-clear-btn" data-act="' + clearAct + '" title="清除当前绑定" aria-label="清除当前绑定">' +
        '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>' +
      '</button>' +
      '<div class="twx-cur-top">' +
        '<span class="twx-cur-badge"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>已选</span>' +
        '<span class="twx-cur-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
      '</div>' +
      (desc ? '<div class="twx-cur-desc" title="' + esc(desc) + '">' + esc(desc) + '</div>' : '') +
    '</div>';
  }

  function emptyWithGlobal(msg) {
    return '<div class="twx-empty">' + msg + '<button type="button" class="twx-gbtn" data-act="gsearch">切换至全局搜索</button></div>';
  }

  function renderPanelList() {
    if (!panelEl) return;
    var listEl = panelEl.querySelector('.twx-p-list');
    var html = '';
    var q = panelQuery;
    if (openKey === 'opengrok') {
      setNavHeader('', '');
      for (var i = 0; i < OG_PROJECTS.length; i++) {
        var p = OG_PROJECTS[i];
        html += optRow(p.name, p.desc, isSel('opengrok', p.id), { k: 'opengrok', v: p.id });
      }
    } else if (openKey === 'gerrit') {
      setNavHeader('', '');
      for (var j = 0; j < GERRIT_FILTERS.length; j++) {
        var f = GERRIT_FILTERS[j];
        html += optRow(f.name, f.desc, isSel('gerrit', f.id), { k: 'gerrit', v: f.id });
      }
    } else if (openKey === 'jira') {
      setNavHeader('', '');
      var issues = (ctxState.lists && ctxState.lists.jira) || [];
      var bound = ctxState.values && ctxState.values.jira;
      if (bound && bound.key) {
        html += curCard(bound.key, (bound.summary || '') + (bound.status ? ' · ' + bound.status : ''), 'clear-jira');
      }
      var shown = 0;
      for (var m = 0; m < issues.length; m++) {
        var it = issues[m];
        var hay = ((it.key || '') + ' ' + (it.summary || '') + ' ' + (it.status || '') + ' ' + (it.assignee || '')).toLowerCase();
        if (q && hay.indexOf(q) === -1) continue;
        html += optRow(it.key + '  ' + (it.summary || ''), (it.status || '') + (it.priority ? ' · ' + it.priority : ''), isSel('jira', it), { k: 'jira', v: it });
        if (++shown >= 60) break;
      }
      if (!shown && !html) html = '<div class="twx-empty">无工单数据</div>';
    } else if (openKey === 'localproj') {
      html = renderLocalproj(q);
    }
    listEl.innerHTML = html || '<div class="twx-empty">无可用选项</div>';
  }

  // 本地工程: 「服务器 > 总代码路径 > CPU平台 > 机型」四级递进 (与抽屉 localProjNavState 同构)
  function renderLocalproj(q) {
    var projs = (ctxState.lists && ctxState.lists.localproj) || [];
    var cur = ctxState.values && ctxState.values.localproj;
    if (!projs.length) {
      setNavHeader('', '');
      return '<div class="twx-empty">无工程缓存</div>';
    }

    // 聚合层级树
    var smap = {}, sorder = [];
    for (var i = 0; i < projs.length; i++) {
      var p = projs[i];
      if (!smap[p.serverId]) { smap[p.serverId] = { id: p.serverId, name: p.serverName, ip: p.serverIp, wmap: {}, worder: [] }; sorder.push(p.serverId); }
      var srv = smap[p.serverId];
      if (!srv.wmap[p.workspaceName]) { srv.wmap[p.workspaceName] = { name: p.workspaceName, pmap: {}, porder: [] }; srv.worder.push(p.workspaceName); }
      var ws = srv.wmap[p.workspaceName];
      var pk = p.platform || '通用';
      if (!ws.pmap[pk]) { ws.pmap[pk] = { name: pk, projects: [] }; ws.porder.push(pk); }
      ws.pmap[pk].projects.push(p);
    }

    // 顶层输入搜索词 → 全局打平过滤直达机型
    if (q && lpNav.step === 'servers') {
      setNavHeader('', '');
      var ghtml = '';
      var gcount = 0;
      for (var g = 0; g < projs.length && gcount < 50; g++) {
        var gp = projs[g];
        var srvIp = gp.serverIp || (smap[gp.serverId] && smap[gp.serverId].ip) || (gp.serverId ? ('192.168.1.' + gp.serverId) : '');
        var hay = ((gp.project || '') + ' ' + (gp.platform || '') + ' ' + (gp.workspaceName || '') + ' ' + (gp.label || '') + ' ' + srvIp + ' ' + (gp.serverId || '')).toLowerCase();
        if (hay.indexOf(q) === -1) continue;
        ghtml += '<div class="twx-opt' + (isSel('localproj', gp) ? ' on' : '') + '" data-p="' + encodeURIComponent(JSON.stringify({ k: 'localproj', v: gp })) + '">' +
          '<span class="t-main"><span class="t-name">' + esc(gp.project) + '<span class="twx-tag">' + esc(gp.platform || '') + '</span>' + (srvIp ? ('<span class="twx-tag">' + esc(srvIp) + '</span>') : '') + '</span>' +
          '<span class="t-desc">' + (srvIp ? (esc(srvIp) + ' › ') : '') + esc(gp.workspaceName) + '</span></span>' +
          (isSel('localproj', gp) ? '<span class="t-check"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6"/></svg></span>' : '') + '</div>';
        gcount++;
      }
      return ghtml || '<div class="twx-empty">未匹配到包含 "' + esc(q) + '" 的本地工程</div>';
    }

    // Level 1: 服务器
    if (lpNav.step === 'servers') {
      setNavHeader('', '');
      var html = '';
      if (cur && cur.id) {
        var curIp = cur.serverIp || (smap[cur.serverId] && smap[cur.serverId].ip) || (cur.serverId ? ('192.168.1.' + cur.serverId) : '');
        html += curCard(cur.label || cur.project, (cur.workspaceName || '') + ' · ' + (cur.platform || '') + (curIp ? (' · ' + curIp) : ''), 'clear-lp');
      } else {
        html += '<div class="twx-opt" data-act="clear-lp" style="opacity:.9;">' +
          '<span class="t-main"><span class="t-name">未指定 (默认)</span><span class="t-desc">不绑定特定工程与机型</span></span><span class="t-check"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6"/></svg></span></div>';
      }
      for (var s = 0; s < sorder.length; s++) {
        var sv = smap[sorder[s]];
        var totPlat = 0, totProj = 0;
        for (var w = 0; w < sv.worder.length; w++) {
          var wsv = sv.wmap[sv.worder[w]];
          totPlat += wsv.porder.length;
          for (var pp = 0; pp < wsv.porder.length; pp++) totProj += wsv.pmap[wsv.porder[pp]].projects.length;
        }
        html += drillRow('srv', sv.id, sv.name || (sv.id + ' 服务器'), sv.ip, sv.worder.length + ' 套代码 · ' + totPlat + ' 个平台 · ' + totProj + ' 款机型');
      }
      return html;
    }

    var srv2 = smap[lpNav.serverId];
    if (!srv2) { lpNav = { step: 'servers', serverId: null, workspaceName: null, platform: null }; return renderLocalproj(q); }

    // Level 2: 总代码路径
    if (lpNav.step === 'workspaces') {
      setNavHeader('返回', srv2.ip || srv2.name || srv2.id);
      var html2 = '';
      for (var w2 = 0; w2 < srv2.worder.length; w2++) {
        var wsName = srv2.worder[w2];
        var ws2 = srv2.wmap[wsName];
        if (q) {
          var wmatch = wsName.toLowerCase().indexOf(q) !== -1;
          if (!wmatch) {
            for (var pk2 = 0; pk2 < ws2.porder.length; pk2++) {
              var pl2 = ws2.pmap[ws2.porder[pk2]];
              if (pl2.name.toLowerCase().indexOf(q) !== -1 || pl2.projects.some(function (x) { return (x.project || '').toLowerCase().indexOf(q) !== -1; })) { wmatch = true; break; }
            }
          }
          if (!wmatch) continue;
        }
        var wProjCount = 0;
        for (var pk3 = 0; pk3 < ws2.porder.length; pk3++) wProjCount += ws2.pmap[ws2.porder[pk3]].projects.length;
        var isCurWs = cur && cur.serverId === lpNav.serverId && cur.workspaceName === wsName;
        html2 += drillRow('ws', wsName, wsName, isCurWs ? '当前' : '', ws2.porder.length + ' 个平台 · ' + wProjCount + ' 款机型');
      }
      return html2 || emptyWithGlobal('当前服务器未匹配到包含 "' + esc(q) + '" 的代码路径');
    }

    var ws3 = srv2.wmap[lpNav.workspaceName];
    if (!ws3) { lpNav = { step: 'workspaces', serverId: lpNav.serverId, workspaceName: null, platform: null }; return renderLocalproj(q); }

    // Level 3: CPU 平台
    if (lpNav.step === 'platforms') {
      var wsShort = (lpNav.workspaceName || '').split('/').pop() || lpNav.workspaceName;
      setNavHeader('返回', wsShort);
      var html3 = '';
      for (var p3 = 0; p3 < ws3.porder.length; p3++) {
        var platKey = ws3.porder[p3];
        var pl3 = ws3.pmap[platKey];
        if (q) {
          var pmatch = platKey.toLowerCase().indexOf(q) !== -1 || pl3.projects.some(function (x) { return (x.project || '').toLowerCase().indexOf(q) !== -1; });
          if (!pmatch) continue;
        }
        var isCurPlat = cur && cur.serverId === lpNav.serverId && cur.workspaceName === lpNav.workspaceName && cur.platform === platKey;
        var srvIp3 = srv2.ip || (lpNav.serverId ? ('192.168.1.' + lpNav.serverId) : '');
        html3 += drillRow('plat', platKey, platKey, pl3.projects.length + '款机型', (srvIp3 ? (srvIp3 + ' › ') : '') + lpNav.workspaceName + (isCurPlat ? ' · 当前' : ''));
      }
      return html3 || emptyWithGlobal('当前代码路径未匹配到包含 "' + esc(q) + '" 的平台');
    }

    var pl4 = ws3.pmap[lpNav.platform];
    if (!pl4) { lpNav = { step: 'platforms', serverId: lpNav.serverId, workspaceName: lpNav.workspaceName, platform: null }; return renderLocalproj(q); }

    // Level 4: 机型 SKU
    setNavHeader('返回', lpNav.platform);
    var html4 = '';
    for (var p4 = 0; p4 < pl4.projects.length; p4++) {
      var pj = pl4.projects[p4];
      if (q) {
        var pjm = (pj.project || '').toLowerCase().indexOf(q) !== -1 || (pj.label || '').toLowerCase().indexOf(q) !== -1;
        if (!pjm) continue;
      }
      html4 += '<div class="twx-opt' + (isSel('localproj', pj) ? ' on' : '') + '" data-p="' + encodeURIComponent(JSON.stringify({ k: 'localproj', v: pj })) + '">' +
        '<span class="t-main"><span class="t-name">' + esc(pj.project) + '<span class="twx-tag">' + esc(pj.platform || '') + '</span></span>' +
        '<span class="t-desc">' + esc(pj.priDriverRel || '') + '</span></span>' +
        (isSel('localproj', pj) ? '<span class="t-check"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6"/></svg></span>' : '') + '</div>';
    }
    return html4 || emptyWithGlobal('当前平台未匹配到包含 "' + esc(q) + '" 的机型');
  }

  // ---- 输入区上下文胶囊: 克隆「完全权限」胶囊样式, 紧跟其后插入同一工具栏行 ----
  function insideOverlay(el) {
    // 判定候选是否落在某个浮层内 (权限下拉菜单 / 「+」菜单等):
    // 祖先 textContent 含权限选项文案, 或祖先本身命中「+」菜单特征
    var n = el;
    for (var d = 0; n && d < 12; n = n.parentElement, d++) {
      var t = n.textContent;
      if (t && t.length < 300 && (t.indexOf('仅可查看') !== -1 || t.indexOf('工作区内修改') !== -1)) return true;
      if (d > 0 && looksLikeAttachMenu(n)) return true;
    }
    return false;
  }

  var cachedPermAnchor = null;
  function findPermPill() {
    if (cachedPermAnchor && cachedPermAnchor.pill && cachedPermAnchor.pill.isConnected) {
      return cachedPermAnchor;
    }
    // 底部工具栏上含「权限/permission/full access」短文本的按钮元素;
    // 仅扫描 button 元素，杜绝 querySelectorAll('body *') 引发的全量同步重排与慢速闪烁
    var buttons = document.querySelectorAll('button');
    var cand = null, bestTop = -1;
    for (var i = 0; i < buttons.length; i++) {
      var el = buttons[i];
      if (el.closest && (el.closest('.twx-chips') || el.closest('.twx-panel'))) continue;
      var t = el.textContent;
      if (!t) continue;
      t = t.trim();
      if (t.length > 20 || !/(权限|permission|full\s*access|read\s*only|workspace\s*write)/i.test(t)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 30 || r.top < window.innerHeight * 0.4 || r.top > window.innerHeight) continue;
      if (insideOverlay(el)) continue;
      if (r.top > bestTop) { bestTop = r.top; cand = el; }
    }
    if (!cand) return null;
    var pill = cand;
    while (pill.parentElement) {
      var pr = pill.parentElement.getBoundingClientRect();
      var pt = (pill.parentElement.textContent || '').trim();
      if (pt.length <= 20 && /(权限|permission|full\s*access|read\s*only|workspace\s*write)/i.test(pt) && pr.width < 220 && pr.height < 48) {
        pill = pill.parentElement;
      } else break;
    }
    cachedPermAnchor = { pill: pill, textEl: cand };
    return cachedPermAnchor;
  }

  function updateCtxChips() {
    var v = ctxState.values || {};
    var defs = [];
    if (v.localproj && v.localproj.id) defs.push({ k: 'localproj', label: v.localproj.label || v.localproj.project, tip: '本地工程: ' + (v.localproj.workspaceName || '') + ' · ' + (v.localproj.platform || '') });
    if (v.jira && v.jira.key) defs.push({ k: 'jira', label: v.jira.key, tip: 'Jira: ' + (v.jira.summary || '') });
    if (v.opengrok && v.opengrok !== 'auto') defs.push({ k: 'opengrok', label: v.opengrok, tip: 'OpenGrok: ' + v.opengrok });
    if (v.gerrit && v.gerrit !== 'all') defs.push({ k: 'gerrit', label: (GERRIT_LABELS[v.gerrit] || v.gerrit), tip: 'Gerrit 过滤: ' + (GERRIT_LABELS[v.gerrit] || v.gerrit) });

    var anchor = defs.length ? findPermPill() : null;
    if (!defs.length || !anchor) {
      if (chipsEl) { try { chipsEl.remove(); } catch (_) {} chipsEl = null; }
      return;
    }
    var pill = anchor.pill;
    if (!chipsEl) {
      chipsEl = document.createElement('span');
      chipsEl.className = 'twx-chips';
      chipsEl.onclick = function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.twx-chip') : null;
        if (!btn) return;
        var k = btn.getAttribute('data-k');
        if (k) {
          e.stopPropagation();
          openPanel(k, btn);
        }
      };
    }
    // 紧跟权限胶囊插入同一工具栏行 (React 重渲染位移时自动纠正)
    if (!chipsEl.isConnected || chipsEl.previousElementSibling !== pill) {
      try { pill.insertAdjacentElement('afterend', chipsEl); } catch (_) { return; }
    }
    var html = '';
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      html += '<button type="button" class="twx-chip" data-k="' + d.k + '" title="' + esc(d.tip || d.label) + '">' +
        '<span class="twx-chip-icon">' + (CHIP_ICONS[d.k] || '') + '</span>' +
        '<span class="twx-chip-label">' + esc(d.label) + '</span></button>';
    }
    if (chipsEl._lastHtml !== html) {
      chipsEl._lastHtml = html;
      chipsEl.innerHTML = html;
    }
  }

  window.addEventListener('resize', updateCtxChips);

  // ---- 新对话侦测: 点击「新对话/新建对话/New Chat」类按钮 或 路由回到应用根路径 ----
  var NEWCHAT_RE = /^\s*(新对话|新建对话|新会话|new\s+chat|new\s+conversation)\s*$/i;
  var lastHref = '';
  function notifyNewChat() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'tabonkb-dsh-new-chat' }, '*');
      }
    } catch (_) {}
  }
  document.addEventListener('click', function (e) {
    var el = e.target;
    for (var d = 0; el && d < 5; el = el.parentElement, d++) {
      var tx = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) ||
        (el.nodeType === 1 && el.children.length <= 3 ? (el.innerText || '').trim() : '');
      if (tx && NEWCHAT_RE.test(tx)) { notifyNewChat(); return; }
    }
  }, true);

  function checkRoute() {
    var cur = location.href;
    if (cur === lastHref) return;
    var prev = lastHref; lastHref = cur;
    if (!prev) return;
    // 新会话判定: 回到无会话段的应用根路径 (path 或 hash 路由)
    var path = location.pathname || '/';
    var hash = location.hash || '';
    var bare = (path === '/' || path === '/index.html') && (hash === '' || hash === '#/' || hash === '#');
    if (bare) notifyNewChat();
  }
  try {
    var _ps = history.pushState, _rs = history.replaceState;
    history.pushState = function () { var r = _ps.apply(this, arguments); setTimeout(checkRoute, 0); return r; };
    history.replaceState = function () { var r = _rs.apply(this, arguments); setTimeout(checkRoute, 0); return r; };
    window.addEventListener('popstate', function () { setTimeout(checkRoute, 0); });
    setInterval(checkRoute, 1200);
    lastHref = location.href;
  } catch (_) {}

  // 核心守卫：在 window 捕获阶段拦截指针与键盘事件。
  // 若事件目标位于自研级联面板 .twx-panel 内，立即终止事件传播 (stopImmediatePropagation)，
  // 阻止该事件到达 document 捕获阶段，从而彻底杜绝 DSH 原生 MenuView 中
  // document.addEventListener("pointerdown", onPointerDown, true)
  // 因判定 target 不在原生菜单内而触发 onDismiss() 导致左侧「+」主菜单被错误销毁的 Bug。
  function onWindowPointerDown(e) {
    if (panelEl && panelEl.contains(e.target)) {
      e.stopImmediatePropagation();
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        try { e.target.focus(); } catch (_) {}
      }
    }
  }
  window.addEventListener('pointerdown', onWindowPointerDown, true);

  // 键盘 Escape 键优先关闭级联面板并阻止向上冒泡至 DSH 原生菜单
  function onWindowKeyDown(e) {
    if (e.key === 'Escape' && panelEl) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closePanel();
    }
  }
  window.addEventListener('keydown', onWindowKeyDown, true);

  // 面板外点击自然退出 (双重侦听 pointerdown 与 click，保证与 DSH 原生菜单关闭无缝同步)
  function onOutsideDismiss(e) {
    if (!panelEl) return;
    if (panelEl.contains(e.target)) return;
    var t = e.target;
    if (t && t.closest && (t.closest('.twx-item') || t.closest('.twx-chip') || t.closest('.twx-panel'))) return;
    closePanel();
  }
  document.addEventListener('pointerdown', onOutsideDismiss, true);
  document.addEventListener('click', onOutsideDismiss, true);

  // 委托绑定注入行的点击 (React 重渲染后仍有效)
  document.addEventListener('pointerdown', function (e) {
    var it = e.target && e.target.closest ? e.target.closest('.twx-item') : null;
    if (it) e.stopPropagation();
  }, true);

  document.addEventListener('click', function (e) {
    var it = e.target && e.target.closest ? e.target.closest('.twx-item') : null;
    if (!it) return;
    e.stopPropagation();
    openPanel(it.getAttribute('data-k'), it);
  }, true);

  // 鼠标滚轮滑动：悬停在任意分组区域（标题或子项）时，滑动下拉/上滑展示该组其他子项
  var wheelAccum = { add: 0, cmd: 0, ctx: 0 };
  var lastWheelStep = 0;

  document.addEventListener('wheel', function (e) {
    if (!menuEl || !menuEl.isConnected) return;
    var target = e.target;
    if (!target) return;
    if (!menuEl.contains(target)) return;

    var grp = null;
    var itemEl = target.closest('[data-twx-grp]');
    if (itemEl) {
      grp = itemEl.getAttribute('data-twx-grp');
    } else {
      var titleEl = target.closest('._3e4SsG_sectionTitle, .twx-sec-title');
      if (titleEl && titleEl.getAttribute('data-twx-title-grp')) {
        grp = titleEl.getAttribute('data-twx-title-grp');
      }
    }
    // 鼠标位于分组标题、子项间隙或菜单内边距时，基于 clientY 命中最近的分组
    if (!grp && menuEl) {
      var titles = menuEl.querySelectorAll('[data-twx-title-grp]');
      for (var ti = titles.length - 1; ti >= 0; ti--) {
        var tr = titles[ti].getBoundingClientRect();
        if (e.clientY >= tr.top - 2) {
          grp = titles[ti].getAttribute('data-twx-title-grp');
          break;
        }
      }
      if (!grp) grp = 'add';
    }
    if (!grp) return;

    var items = groupItems[grp] || [];
    var maxOff = Math.max(0, items.length - 2);
    if (maxOff <= 0) return;

    e.preventDefault();
    e.stopPropagation();

    var lb = menuEl.querySelector('[role="listbox"]') || menuEl.querySelector('._3e4SsG_viewport') || menuEl;
    if (lb && lb.scrollTop > 0) lb.scrollTop = 0;

    var now = Date.now();
    wheelAccum[grp] += e.deltaY;

    if (Math.abs(wheelAccum[grp]) >= 20 && (now - lastWheelStep > 40)) {
      lastWheelStep = now;
      if (wheelAccum[grp] > 0) {
        if (groupOffsets[grp] < maxOff) {
          groupOffsets[grp]++;
          updateGroupVisibility(grp);
        }
      } else {
        if (groupOffsets[grp] > 0) {
          groupOffsets[grp]--;
          updateGroupVisibility(grp);
        }
      }
      wheelAccum[grp] = 0;
    }
  }, { passive: false });

  // 键盘方向键联动：如果高亮项超出当前可见的 2 项，自动调整 offset 滚动使其可见
  document.addEventListener('keydown', function (e) {
    if (!menuEl || !menuEl.isConnected) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    setTimeout(function () {
      if (!menuEl) return;
      var activeEl = menuEl.querySelector('._3e4SsG_item._3e4SsG_active, [role="option"][aria-selected="true"]');
      if (!activeEl) return;
      var grp = activeEl.getAttribute('data-twx-grp');
      var idxStr = activeEl.getAttribute('data-twx-idx');
      if (!grp || idxStr == null) return;
      var idx = parseInt(idxStr, 10);
      var cur = groupOffsets[grp] || 0;
      if (idx < cur) {
        groupOffsets[grp] = idx;
        updateGroupVisibility(grp);
      } else if (idx > cur + 1) {
        groupOffsets[grp] = idx - 1;
        updateGroupVisibility(grp);
      }
    }, 20);
  }, true);

  var scanQueued = false;
  var pendingRoots = [];
  function scheduleScan(root) {
    if (root) pendingRoots.push(root);
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(function () {
      scanQueued = false;
      var roots = pendingRoots; pendingRoots = [];
      try {
        if (!menuEl || !menuEl.isConnected) {
          for (var i = 0; i < roots.length; i++) {
            var menu = pickMenu(roots[i]);
            if (menu) { onMenuFound(menu); break; }
          }
        }
        // 菜单被 React 卸载/重渲染时仅释放锚点：级联面板驻留至用户选择或外点，
        // 避免点击面板选项触发 DSH 菜单外点关闭时连带销毁面板
        if (menuEl && !menuEl.isConnected) {
          menuEl = null;
        } else if (menuEl) {
          var unmapped = menuEl.querySelector('button._3e4SsG_item:not([data-twx-grp])');
          if (!menuEl.querySelector('.twx-sec-title') || unmapped) injectGroup(menuEl);
        }
        updateCtxChips();
      } catch (_) {}
    }, 40);
  }

  var mo = new MutationObserver(function (muts) {
    try {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        var tgt = m.target;
        if (!tgt || tgt.nodeType !== 1) continue;

        // 1. 彻底跳过自研面板、胶囊及注入项内部变动
        if (tgt.closest && (tgt.closest('.twx-chips') || tgt.closest('.twx-panel') || tgt.closest('.twx-sec-title') || tgt.closest('.twx-item') || tgt.closest('.twx-plus-menu'))) continue;

        // 2. 彻底跳过原生 Tooltip、气泡、发送/停止按钮区域 (杜绝悬停发送图标导致的全页面慢速重排与闪烁)
        if (tgt.getAttribute && (tgt.getAttribute('role') === 'tooltip' || tgt.getAttribute('data-portal') === 'true')) continue;
        if (tgt.closest && tgt.closest('[role="tooltip"], [class*="tooltip"], [class*="bubble"]')) continue;
        if (tgt.closest && tgt.closest('button[class*="send"], button[class*="stop"], button[aria-label*="发送"], button[aria-label*="终止"], button[aria-label*="Stop"], [class*="_send"]')) continue;

        // 3. 属性变动过滤
        if (m.type === 'attributes') {
          var aname = m.attributeName;
          if (aname && aname.indexOf('twx') !== -1) continue;
          if (aname === 'class' || aname === 'style') {
            // 忽略消息气泡流、输入框内部的样式/光标变动
            if (tgt.closest && tgt.closest('[class*="Message"], [class*="scrollBody"], pre, code, textarea, input')) continue;
          }
          scheduleScan(tgt);
          continue;
        }

        // 4. 节点新增过滤
        var adds = m.addedNodes;
        for (var j = 0; j < adds.length; j++) {
          var an = adds[j];
          if (an && an.nodeType === 1) {
            if (an.closest && (an.closest('.twx-chips') || an.closest('.twx-panel') || an.closest('.twx-sec-title') || an.closest('.twx-item') || an.closest('.twx-plus-menu') || an.closest('[role="tooltip"]'))) continue;
            scheduleScan(an);
          }
        }
        // 子树内结构变化时, 复查已注入块是否被 React 覆盖
        if (menuEl && tgt && menuEl.contains && menuEl.contains(tgt)) scheduleScan(null);
      }
    } catch (_) {}
  });
  mo.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden']
  });

  window._twxCtxBridgeCleanup = function () {
    try { mo.disconnect(); } catch (_) {}
    window.removeEventListener('pointerdown', onWindowPointerDown, true);
    window.removeEventListener('keydown', onWindowKeyDown, true);
    document.removeEventListener('pointerdown', onOutsideDismiss, true);
    document.removeEventListener('click', onOutsideDismiss, true);
    window.removeEventListener('resize', updateCtxChips);
    if (panelEl) { try { panelEl.remove(); } catch (_) {} }
    if (chipsEl) { try { chipsEl.remove(); } catch (_) {} }
    if (styleEl) { try { styleEl.remove(); } catch (_) {} }
  };

  askHost();
  setTimeout(askHost, 800);
  setTimeout(updateCtxChips, 400);
})();
`.trim();
}

class DshDaemonManager {
  constructor(options = {}) {
    this.plugin = options.plugin || null;
    this.vaultBasePath = options.vaultBasePath || (process.cwd ? process.cwd() : '');
    this.preferredPort = options.port || 3080;
    this.profile = options.profile || 'tabonkb';
    this.status = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
    this.statusDetail = '';
    this.actualPort = null;
    this.authUrl = null;
    this.authCookie = null;
    this.proxyPort = null;
    this.proxyServer = null;
    this.studioUrl = null;
    this.process = null;
    this.lastError = null;
    this.listeners = new Map();
    this._isStarting = false;
    this._startPromise = null; // R1: 单飞启动 Promise, 并发调用复用同一实例
    this._ownedPid = null;     // R3: 本管理器实际持有(拉起/复用)的 DSH pid, 供 stop 兜底回收
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(fn);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (e) {
          console.error(`[DshDaemonManager] Error in event '${event}':`, e);
        }
      }
    }
  }

  setStatus(status, detail = '') {
    if (this.status === status && this.statusDetail === detail) return;
    this.status = status;
    this.statusDetail = detail;
    this.emit('status_change', {
      status,
      detail,
      port: this.actualPort,
      proxyPort: this.proxyPort,
      studioUrl: this.studioUrl,
      authUrl: this.authUrl
    });
  }

  getStatus() {
    return {
      status: this.status,
      detail: this.statusDetail,
      port: this.actualPort,
      proxyPort: this.proxyPort,
      studioUrl: this.studioUrl,
      authUrl: this.authUrl,
      pid: this.process ? this.process.pid : null
    };
  }

  ensureVaultWorkspace(customBasePath, options = {}) {
    const allowPrune = options.allowPrune === true;
    try {
      const osModule = typeof require !== 'undefined' ? require('os') : (typeof os !== 'undefined' ? os : null);
      const homedir = osModule ? osModule.homedir() : (process.env.USERPROFILE || 'C:\\Users\\Administrator');
      const storageDir = path.join(homedir, '.dsh', 'storages');
      const wsFile = path.join(storageDir, 'workspace.json');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      let realVaultPath = customBasePath || this.vaultBasePath || (process.cwd ? process.cwd() : 'D:\\work\\Mgmt\\TabonKB');
      try {
        if (fs.realpathSync && fs.realpathSync.native) {
          realVaultPath = fs.realpathSync.native(realVaultPath);
        } else if (fs.realpathSync) {
          realVaultPath = fs.realpathSync(realVaultPath);
        }
      } catch (_) {
        realVaultPath = path.resolve(realVaultPath);
      }

      let data = {
        unit: { name: 'workspace', version: 2 },
        global: { initialized: true, workspaceIds: [], archivedSessionIds: [], pinnedSessionIds: [] },
        tables: { workspaces: {} }
      };

      if (fs.existsSync(wsFile)) {
        try {
          data = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
        } catch (_) {}
      }
      if (!data.global) data.global = { initialized: true, workspaceIds: [], archivedSessionIds: [], pinnedSessionIds: [] };
      if (!data.tables) data.tables = { workspaces: {} };
      if (!data.tables.workspaces) data.tables.workspaces = {};
      if (!Array.isArray(data.global.workspaceIds)) data.global.workspaceIds = [];

      // R4: 增量 upsert —— 只维护本知识库对应的那一条工作区记录,
      // 默认不再全量覆盖 tables.workspaces(原实现会清掉用户其它工作区与会话绑定)
      let foundId = null;
      let foundWs = null;
      for (const [id, ws] of Object.entries(data.tables.workspaces)) {
        if (ws && ws.path && path.resolve(ws.path).toLowerCase() === path.resolve(realVaultPath).toLowerCase()) {
          foundId = id;
          foundWs = ws;
          break;
        }
      }

      const now = new Date().toISOString();
      if (!foundId) {
        foundId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'tabonkb-default-vault-workspace';
      }

      const prev = foundWs || {};
      const nextEntry = {
        path: realVaultPath,
        title: 'TabonKB 知识库',
        sessionIds: Array.isArray(prev.sessionIds) ? [...new Set(prev.sessionIds)] : [],
        createdAt: prev.createdAt || now,
        // R4: 仅在内容有实质变化时刷新 updatedAt, 避免每次启动都写盘触发 DSH 侧重载
        updatedAt: (prev.path === realVaultPath && prev.title === 'TabonKB 知识库') ? (prev.updatedAt || now) : now
      };

      data.tables.workspaces[foundId] = nextEntry;

      if (allowPrune) {
        // R4: 显式开关 —— 仅当调用方明确要求清理时才裁剪其它工作区
        data.tables.workspaces = { [foundId]: nextEntry };
        data.global.workspaceIds = [foundId];
      } else if (!data.global.workspaceIds.includes(foundId)) {
        data.global.workspaceIds.push(foundId);
      }
      data.global.defaultWorkspaceId = foundId;

      // R4: 内容无变化则跳过写盘, 保持文件 mtime 稳定
      const nextJson = JSON.stringify(data, null, 2);
      let prevJson = '';
      try { prevJson = fs.readFileSync(wsFile, 'utf8'); } catch (_) {}
      const changed = prevJson !== nextJson;
      if (changed) {
        fs.writeFileSync(wsFile, nextJson, 'utf8');
      }
      return { ok: true, workspaceId: foundId, path: realVaultPath, changed };
    } catch (e) {
      console.warn('[TabonKB] ensureVaultWorkspace failed:', e);
      return { ok: false, error: e.message };
    }
  }

  getLockFilePath() {
    const root = this.vaultBasePath || process.cwd();
    return path.join(root, '.dsh', 'profiles', this.profile, 'daemon.lock');
  }

  readLockFile() {
    try {
      const p = this.getLockFilePath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {}
    return null;
  }

  writeLockFile(data) {
    try {
      const p = this.getLockFilePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // R17: 先写临时文件再 rename, 避免并发读/进程崩溃时读到半截 JSON
      const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, p);
    } catch (e) {
      console.warn('[DshDaemonManager] Failed to write lockfile:', e.message);
    }
  }

  clearLockFile() {
    try {
      const p = this.getLockFilePath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {}
  }

  isProcessAlive(pid) {
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * R3: 进程树强杀
   * Windows 使用 taskkill /T /F 连带回收 dsh 拉起的 MCP 孙子进程;
   * POSIX 优先杀进程组, 失败则退化为单进程 SIGKILL
   */
  killTree(pid) {
    if (!pid) return false;
    try {
      if (process.platform === 'win32') {
        child_process.execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        try { process.kill(-pid, 'SIGKILL'); } catch (_) { process.kill(pid, 'SIGKILL'); }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * R7: 将当前实际端口(后端 + 代理)注册进 WebRequest 白名单
   */
  registerBridgePorts() {
    try {
      const bridge = typeof getTabonKbWebRequestBridge === 'function' ? getTabonKbWebRequestBridge() : null;
      if (!bridge || typeof bridge.registerDshPort !== 'function') return;
      if (this.actualPort) bridge.registerDshPort(this.actualPort);
      if (this.proxyPort) bridge.registerDshPort(this.proxyPort);
    } catch (_) {}
  }

  /**
   * 探测端口是否为合法的 DSH 服务 (签名防伪校验)
   * 实测验证依据: DSH 未带 Token 请求必返回 401 且包含 "dsh web authentication required"
   */
  probeDshSignature(port, timeoutMs = 1500) {
    return new Promise((resolve) => {
      const httpLib = typeof http !== 'undefined' ? http : (typeof require !== 'undefined' ? require('http') : null);
      if (!httpLib) return resolve({ ok: false, isDsh: false });
      const req = httpLib.request({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET'
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c.toString('utf8'); });
        res.on('end', () => {
          // 401 且包含签名特征证明 100% 为 DSH
          if (res.statusCode === 401 && body.includes('dsh web authentication required')) {
            resolve({ ok: true, isDsh: true, port, authenticated: false });
          } else if (res.statusCode === 200 || res.statusCode === 302) {
            // R20: 200/302 不再直接视为 DSH —— 必须命中响应体或 Set-Cookie 特征,
            // 否则认定为端口被其它服务占用, 避免误接管(adopt)非 DSH 进程
            const rawCookie = res.headers['set-cookie'];
            const cookieList = Array.isArray(rawCookie) ? rawCookie : (rawCookie ? [rawCookie] : []);
            const hasAuthCookie = cookieList.some(c => c && c.includes('dsh-auth-'));
            const looksDsh = hasAuthCookie || /dsh|deepseek/i.test(body) || /<div\s+id=["']root["']/i.test(body);
            if (looksDsh) {
              resolve({ ok: true, isDsh: true, port, authenticated: true, hasAuthCookie });
            } else {
              resolve({ ok: false, isDsh: false, port, statusCode: res.statusCode, error: 'signature-mismatch' });
            }
          } else {
            resolve({ ok: false, isDsh: false, port, statusCode: res.statusCode });
          }
        });
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve({ ok: false, isDsh: false, error: 'timeout' });
      });

      req.on('error', (err) => {
        resolve({ ok: false, isDsh: false, error: err.message });
      });

      req.end();
    });
  }

  /**
   * 检查端口是否被 TCP 占用
   */
  isPortInUse(port) {
    return new Promise((resolve) => {
      const netLib = typeof net !== 'undefined' ? net : (typeof require !== 'undefined' ? require('net') : null);
      if (!netLib) return resolve(false);
      const server = netLib.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close(() => resolve(false));
      });
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * 寻找可用端口区间 (preferredPort ~ preferredPort + 10)
   */
  async getAvailablePort(startPort = 3080, maxPort = 3090) {
    for (let p = startPort; p <= maxPort; p++) {
      const inUse = await this.isPortInUse(p);
      if (!inUse) return p;
    }
    return startPort;
  }

  resolveNode() {
    // R14: 优先使用用户在设置中指定的 Node 路径
    const custom = (this.plugin && this.plugin.settings && this.plugin.settings.dsh && this.plugin.settings.dsh.customNodePath) || '';
    if (typeof resolveDshNodeExe === 'function') {
      return resolveDshNodeExe(custom);
    }
    if (dshMcpShared?.resolveDshNodeExe) {
      return dshMcpShared.resolveDshNodeExe(custom);
    }
    if (custom && fs.existsSync(custom)) return custom;
    const nodeDir = resolveBundledNodeDir();
    const nodeExe = nodeDir ? path.join(nodeDir, 'node.exe') : '';
    return nodeExe && fs.existsSync(nodeExe) ? nodeExe : 'node';
  }

  resolveBin() {
    if (typeof resolveDshBin === 'function') {
      return resolveDshBin();
    }
    if (dshMcpShared?.resolveDshBin) {
      return dshMcpShared.resolveDshBin();
    }
    const nodeDir = resolveBundledNodeDir();
    const binJs = nodeDir ? path.join(nodeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js') : '';
    // R13: 找不到就返回 null, 由 start() 抛出明确错误, 不再伪装成可执行的 'dsh' 命令
    return binJs && fs.existsSync(binJs) ? binJs : null;
  }

  /**
   * 通过 Node 原生 http 预请求兑换并缓存 DSH 鉴权 Cookie
   * 实测依据: Node 原生请求不受 Chromium 跨源 iframe 的 SameSite=Strict 阻断，
   * 兑换后同时存入 WebRequestBridge 和 Electron Cookie 仓，实现 100% 免登载入
   */
  async refreshAuthCookie(authUrl = this.authUrl) {
    const targetUrl = authUrl || this.authUrl;
    if (!targetUrl) return null;
    return new Promise((resolve) => {
      try {
        const httpLib = typeof http !== 'undefined' ? http : (typeof require !== 'undefined' ? require('http') : null);
        if (!httpLib) return resolve(null);
        const req = httpLib.get(targetUrl, { agent: false }, (res) => {
          res.resume(); // R8: 消费响应体, 避免 keep-alive 连接/句柄悬挂
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            const list = Array.isArray(setCookie) ? setCookie : [setCookie];
            const dshCookie = list.find(c => c.includes('dsh-auth-'));
            if (dshCookie) {
              const cookiePair = dshCookie.split(';')[0].trim();
              this.authCookie = cookiePair;
              const portMatch = targetUrl.match(/127\.0\.0\.1:(\d+)/);
              const port = portMatch ? portMatch[1] : (this.actualPort || 'latest');

              if (typeof getTabonKbWebRequestBridge === 'function') {
                const bridge = getTabonKbWebRequestBridge();
                if (bridge) {
                  bridge.setDshCookie(port, cookiePair);
                  bridge.ensureInstalled();
                }
              } else if (typeof window !== 'undefined' && window._tabonkbWebRequestBridge) {
                window._tabonkbWebRequestBridge.setDshCookie(port, cookiePair);
                window._tabonkbWebRequestBridge.ensureInstalled();
              }

              // 尝试通过 Electron cookies.set 双重固化
              try {
                let electron = null;
                try { electron = typeof require !== 'undefined' ? require('electron') : null; } catch (_) {}
                if (!electron && typeof window !== 'undefined' && window.require) {
                  try { electron = window.require('electron'); } catch (_) {}
                }
                const sess = electron?.remote?.session?.defaultSession || electron?.session?.defaultSession;
                if (sess?.cookies?.set) {
                  const [cName, cVal] = cookiePair.split('=');
                  sess.cookies.set({
                    url: `http://127.0.0.1:${port}/`,
                    name: cName,
                    value: cVal,
                    path: '/'
                  }).catch(() => {});
                }
              } catch (_) {}

              resolve(cookiePair);
              return;
            }
          }
          resolve(null);
        });
        req.setTimeout(3000, () => {
          req.destroy();
          resolve(null);
        });
        req.on('error', () => resolve(null));
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * 启动本地免登反向代理 (Loopback Proxy)
   * 根本解决 Chromium 对 127.0.0.1 跨源 iframe 吞掉 SameSite=Strict Cookie 的安全限制：
   * 1. iframe 直连本地代理，由 Node 代理层无条件向 DSH 后端注入 Cookie、Host、Same-Origin 等鉴权头；
   * 2. 剥除 X-Frame-Options 与 Content-Security-Policy 响应头；
   * 3. 支持 WebSocket / HTTP Upgrade 协议穿透。
   */
  async startProxy(backendPort) {
    if (this.proxyServer && this.proxyPort) {
      return this.proxyPort;
    }
    const proxyPort = await this.getAvailablePort(backendPort + 10, backendPort + 30);
    return new Promise((resolve, reject) => {
      const httpLib = typeof http !== 'undefined' ? http : require('http');
      const netLib = typeof net !== 'undefined' ? net : require('net');

      const server = httpLib.createServer((clientReq, clientRes) => {
        const forwardHeaders = Object.assign({}, clientReq.headers);
        forwardHeaders['host'] = `127.0.0.1:${backendPort}`;

        if (this.authCookie) {
          const existing = forwardHeaders['cookie'] || '';
          const cookieName = this.authCookie.split('=')[0];
          if (!existing.includes(cookieName + '=')) {
            forwardHeaders['cookie'] = existing ? `${existing}; ${this.authCookie}` : this.authCookie;
          } else {
            const regex = new RegExp(`${cookieName}=[^;]+`);
            forwardHeaders['cookie'] = existing.replace(regex, this.authCookie);
          }
        }

        if (forwardHeaders['origin']) {
          forwardHeaders['origin'] = `http://127.0.0.1:${backendPort}`;
        }
        if (forwardHeaders['sec-fetch-site']) {
          forwardHeaders['sec-fetch-site'] = 'same-origin';
        }

        const reqPath = clientReq.url || '/';
        const isHtmlReq = reqPath === '/' || reqPath.startsWith('/?') || reqPath.startsWith('/index.html');
        if (isHtmlReq) {
          forwardHeaders['accept-encoding'] = 'identity';
          delete forwardHeaders['if-none-match'];
          delete forwardHeaders['if-modified-since'];
        }

        const proxyReq = httpLib.request({
          hostname: '127.0.0.1',
          port: backendPort,
          path: clientReq.url,
          method: clientReq.method,
          headers: forwardHeaders
        }, (dshRes) => {
          const resHeaders = Object.assign({}, dshRes.headers);
          delete resHeaders['x-frame-options'];
          delete resHeaders['content-security-policy'];

          const setCookie = resHeaders['set-cookie'];
          if (setCookie) {
            const list = Array.isArray(setCookie) ? setCookie : [setCookie];
            for (const c of list) {
              if (c.includes('dsh-auth-')) {
                this.authCookie = c.split(';')[0].trim();
              }
            }
          }

          const contentType = (resHeaders['content-type'] || '').toLowerCase();
          const isSuccessfulHtml = dshRes.statusCode === 200 && (isHtmlReq || contentType.includes('text/html'));

          if (isSuccessfulHtml) {
            const htmlChunks = [];
            dshRes.on('data', chunk => { htmlChunks.push(chunk); });
            dshRes.on('end', () => {
              const rawHtml = Buffer.concat(htmlChunks).toString('utf8');
              // 方案A: UI 定制默认关闭, 仅 dsh.layoutTweaks 显式 true 时注入 (回归 DSH 原生 Grid 布局)
              const layoutTweaksOn = !!(this.plugin && this.plugin.settings && this.plugin.settings.dsh && this.plugin.settings.dsh.layoutTweaks === true);
              const customCss = typeof getDshCustomStyles === 'function' ? getDshCustomStyles(layoutTweaksOn) : '';
              const bridgeJs = typeof getDshFileBridgeScript === 'function' ? getDshFileBridgeScript() : '';
              const hideCss = typeof getDshSidebarHideStyles === 'function' ? getDshSidebarHideStyles() : '';
              // 方案A: 定制关闭时不再注入空 style 标签, 避免残留 #tabonkb-dsh-overrides 覆盖原生布局
              let themeTag = '';
              try {
                const te = (typeof TabonKBThemeEngine !== 'undefined') ? TabonKBThemeEngine : (typeof window !== 'undefined' ? window.TabonKBThemeEngine : null);
                if (te && typeof te.buildDshThemePayload === 'function') {
                  const payload = te.buildDshThemePayload(this.plugin, null);
                  if (payload && payload.css) {
                    const initJs = `try{document.documentElement.dataset.akSkin=${JSON.stringify(payload.skinId)};document.documentElement.dataset.akWall=${JSON.stringify(payload.wallId)};document.documentElement.style.colorScheme=${JSON.stringify(payload.mode)};localStorage.setItem("dt.skin",${JSON.stringify(payload.skinId)});localStorage.setItem("dt.wall",${JSON.stringify(payload.wallId)});localStorage.removeItem("dsh.antutu.off");}catch(_){}`;
                    themeTag = `\n<script id="tabonkb-dsh-theme-init">${initJs}</script>\n<style id="tabonkb-dsh-theme-style">\n${payload.css}\n</style>\n`;
                  }
                }
              } catch (_) {}
              const styleTag = customCss ? `\n<style id="tabonkb-dsh-overrides">\n${customCss}\n</style>\n` : '';
              const hideStyleTag = hideCss ? `\n<style id="tabonkb-dsh-sidebar-hide">\n${hideCss}\n</style>\n` : '';
              const scriptTag = bridgeJs ? `\n<script id="tabonkb-dsh-file-bridge">\n${bridgeJs}\n</script>\n` : '';
              const ctxJs = typeof getDshContextBridgeScript === 'function' ? getDshContextBridgeScript() : '';
              const ctxTag = ctxJs ? `\n<script id="tabonkb-dsh-ctx-bridge">\n${ctxJs}\n</script>\n` : '';
              const injectTags = `${styleTag}${hideStyleTag}${themeTag}${scriptTag}${ctxTag}`;
              delete resHeaders['etag'];
              delete resHeaders['last-modified'];
              resHeaders['cache-control'] = 'no-store, no-cache, must-revalidate';
              let modifiedHtml = rawHtml;
              if (modifiedHtml.includes('</head>')) {
                modifiedHtml = modifiedHtml.replace('</head>', `${injectTags}</head>`);
              } else {
                modifiedHtml += injectTags;
              }
              delete resHeaders['content-length'];
              delete resHeaders['content-encoding'];
              resHeaders['content-type'] = 'text/html; charset=utf-8';
              clientRes.writeHead(dshRes.statusCode, resHeaders);
              clientRes.end(modifiedHtml);
            });
            return;
          }

          clientRes.writeHead(dshRes.statusCode, resHeaders);
          dshRes.pipe(clientRes);
        });

        proxyReq.on('error', (err) => {
          if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
            clientRes.end(`[DSH Proxy] 服务连接异常: ${err.message}`);
          }
        });

        clientReq.pipe(proxyReq);
      });

      server.on('upgrade', (req, socket, head) => {
        const proxySocket = netLib.connect(backendPort, '127.0.0.1', () => {
          const headers = Object.assign({}, req.headers);
          headers['host'] = `127.0.0.1:${backendPort}`;
          if (this.authCookie) {
            headers['cookie'] = this.authCookie;
          }
          if (headers['origin']) {
            headers['origin'] = `http://127.0.0.1:${backendPort}`;
          }
          if (headers['sec-fetch-site']) {
            headers['sec-fetch-site'] = 'same-origin';
          }
          const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
          proxySocket.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
          if (head && head.length) proxySocket.write(head);
          proxySocket.pipe(socket);
          socket.pipe(proxySocket);
        });
        proxySocket.on('error', () => socket.destroy());
      });

      server.on('error', (err) => {
        console.error('[DshDaemonManager] Proxy error:', err);
        reject(err);
      });

      server.listen(proxyPort, '127.0.0.1', () => {
        this.proxyPort = proxyPort;
        this.proxyServer = server;
        this.studioUrl = `http://127.0.0.1:${proxyPort}/`;
        resolve(proxyPort);
      });
    });
  }

  /**
   * 启动或连接现有的 DSH 守护实例
   */
  async start() {
    if (this.status === 'running' && this.actualPort) {
      if (!this.proxyServer) {
        await this.startProxy(this.actualPort);
      }
      this.registerBridgePorts();
      return true;
    }
    // R1: 单飞(single-flight) —— 插件 autoStart 与 Harness 页签几乎同时调用 start(),
    // 原实现在 _isStarting 时直接 return false, 被视图当成"启动失败"弹出错误卡片。
    // 现在并发调用复用同一个 Promise, 双方都拿到真实启动结果。
    if (this._startPromise) {
      return this._startPromise;
    }
    this._startPromise = this._doStart().finally(() => {
      this._startPromise = null;
    });
    return this._startPromise;
  }

  async _doStart() {
    this._isStarting = true;
    this.setStatus('starting', '正在启动 DSH 引擎...');

    try {
      this.ensureVaultWorkspace();

      // 1. 检查锁文件与已有进程 (热重载秒级复用: 只要锁文件进程存活且签名确认为 DSH 即直接复用)
      const lock = this.readLockFile();
      if (lock && lock.port && this.isProcessAlive(lock.pid)) {
        const probe = await this.probeDshSignature(lock.port);
        if (probe.isDsh && (probe.authenticated || (lock.authUrl && lock.authUrl.includes('token=')) || lock.authCookie)) {
          this.actualPort = lock.port;
          this.authUrl = lock.authUrl || `http://127.0.0.1:${lock.port}/`;
          if (lock.authCookie && !this.authCookie) this.authCookie = lock.authCookie;
          this._ownedPid = lock.pid; // R3: 复用实例同样登记归属, 保证显式 stop()/restart() 能回收
          await this.refreshAuthCookie(this.authUrl);
          await this.startProxy(this.actualPort);
          this.registerBridgePorts();
          this.setStatus('running', '复用已运行实例');
          try { globalThis.__twBootMark && __twBootMark('dsh:lock-reused'); } catch (_) {}
          this._isStarting = false;
          this.emit('auth_ready', { authUrl: this.authUrl, studioUrl: this.studioUrl, port: this.actualPort, adopted: true });
          return true;
        } else if (probe.isDsh) {
          // 旧进程无认证 token, 统一走 killTree 清理后重新拉起
          this.killTree(lock.pid);
        }
      }
      this.clearLockFile();

      // 2. 准备 MCP 动态 Patch 配置
      let patchPath = '';
      if (typeof ensureDshMcpPatch === 'function') {
        const r = ensureDshMcpPatch(this.vaultBasePath, this.profile);
        if (r.ok) patchPath = r.patchFile;
      } else if (dshMcpShared?.ensureDshMcpPatch) {
        const r = dshMcpShared.ensureDshMcpPatch(this.vaultBasePath, this.profile);
        if (r.ok) patchPath = r.patchFile;
      }

      // 3. 分配端口
      const targetPort = await this.getAvailablePort(this.preferredPort, this.preferredPort + 10);
      this.actualPort = targetPort;

      // 4. 解析可执行路径与参数
      const nodeExe = this.resolveNode();
      const binPath = this.resolveBin();
      if (!binPath) {
        // R13: 路径解析失败必须明确报错, 不再退化为 'dsh' 命令导致的 ENOENT 迷雾
        throw new Error('未找到 DSH 可执行文件 (@deepseek-ai/dsh)，请检查 Node/DSH 安装或在设置中指定 Node 路径');
      }
      const isJs = binPath.endsWith('.js');

      const spawnCmd = isJs ? nodeExe : binPath;
      const spawnArgs = isJs ? [binPath] : [];

      spawnArgs.push('--profile', 'web');
      if (patchPath && fs.existsSync(patchPath)) {
        spawnArgs.push('--patch', patchPath);
      }
      spawnArgs.push('--port', String(targetPort));
      spawnArgs.push('--no-open');

      // 5. 组装环境变量 (透传 MCP 所需凭据并注入 Node 到 PATH)
      let env = Object.assign({}, process.env);
      if (typeof buildDshDaemonEnv === 'function') {
        env = buildDshDaemonEnv(this.vaultBasePath);
      } else if (dshMcpShared?.buildDshDaemonEnv) {
        env = dshMcpShared.buildDshDaemonEnv(this.vaultBasePath);
      }
      const appData = process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming';
      const nodeDir = resolveBundledNodeDir() || path.join(appData, 'node-v24.15.0');
      const originalPath = env.PATH || env.Path || process.env.PATH || process.env.Path || '';
      const envPath = nodeDir ? `${nodeDir}${path.delimiter}${originalPath}` : originalPath;
      env.PATH = envPath;
      env.Path = envPath;

      // 6. 拉起子进程
      try { globalThis.__twBootMark && __twBootMark('dsh:cold-spawn'); } catch (_) {}
      const proc = child_process.spawn(spawnCmd, spawnArgs, {
        cwd: this.vaultBasePath || process.cwd(),
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      try { proc.unref(); } catch (_) {}
      this.process = proc;
      this._ownedPid = proc.pid; // R3: 登记归属, 供 stop()/失败路径回收整棵进程树
      let stdoutBuffer = '';

      proc.stdout.setEncoding('utf8');
      proc.stderr.setEncoding('utf8');

      const checkAuthUrl = (chunk) => {
        stdoutBuffer += chunk;
        // 捕获启动 Token URL: dsh web: http://127.0.0.1:<port>/?token=<token>
        const match = stdoutBuffer.match(/dsh web:\s+(https?:\/\/127\.0\.0\.1:\d+\/\S+)/i) ||
                      stdoutBuffer.match(/(https?:\/\/127\.0\.0\.1:\d+\/\?token=[a-zA-Z0-9_-]+)/i);
        if (match && (!this.authUrl || !this.authUrl.includes('token='))) {
          this.authUrl = match[1];
          this.writeLockFile({
            pid: proc.pid,
            port: targetPort,
            version: '0.2.0-rc.2',
            authUrl: this.authUrl,
            startedAt: Date.now()
          });
          this.setStatus('running', '就绪');
          this.refreshAuthCookie(this.authUrl).then(() => this.startProxy(targetPort)).then(() => {
            this.registerBridgePorts();
            this.emit('auth_ready', { authUrl: this.authUrl, studioUrl: this.studioUrl, port: targetPort });
          }).catch(() => {});
        }
      };

      proc.stdout.on('data', checkAuthUrl);
      proc.stderr.on('data', (chunk) => {
        const text = chunk.trim();
        console.warn('[DshDaemonManager] stderr:', text);
        if (text && !text.includes('IO is still pending')) {
          this.lastError = text.slice(0, 200);
        }
        checkAuthUrl(chunk);
      });

      proc.on('close', (code) => {
        // R2: 身份校验 —— 只有仍然是当前进程时才允许清理状态,
        // 避免被 abort/restart 淘汰的旧进程事件覆盖新会话状态
        if (this.process !== proc) return;
        const wasRunning = this.status === 'running';
        this.process = null;
        this._ownedPid = null;
        this.actualPort = null;
        if (this.proxyServer) {
          try { this.proxyServer.close(); } catch (_) {}
          this.proxyServer = null;
          this.proxyPort = null;
          this.studioUrl = null;
        }
        this.clearLockFile();
        const errDetail = code === 0 ? '已正常退出' : `异常退出 (码: ${code})${this.lastError ? ': ' + this.lastError : ''}`;
        this.setStatus('stopped', errDetail);
        this.emit('exit', { code, wasRunning });
      });

      proc.on('error', (err) => {
        // R2: 身份校验, 防止过期进程的 error 事件污染当前状态
        if (this.process !== proc) return;
        this.lastError = err.message;
        this.process = null;
        this._ownedPid = null;
        if (this.proxyServer) {
          try { this.proxyServer.close(); } catch (_) {}
          this.proxyServer = null;
          this.proxyPort = null;
          this.studioUrl = null;
        }
        this.clearLockFile();
        this.setStatus('error', `启动失败: ${err.message}`);
        this.emit('error', { error: err.message });
      });

      // 7. 轮询等待服务启动并捕获认证 URL (最长等待 45 秒，遇子进程提前退出立即中断)
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (this.authUrl && this.authUrl.includes('token=')) {
          await this.refreshAuthCookie(this.authUrl);
          await this.startProxy(targetPort);
          this.registerBridgePorts();
          this.setStatus('running', '就绪');
          this.emit('auth_ready', { authUrl: this.authUrl, studioUrl: this.studioUrl, port: targetPort });
          break;
        }

        // 进程提前死掉立即中断，不浪费时间
        if (!this.process && !this.authUrl) {
          throw new Error(this.lastError || 'DSH 子进程启动后异常退出');
        }

        const probe = await this.probeDshSignature(targetPort);
        if (probe.isDsh && probe.authenticated) {
          if (!this.authUrl) this.authUrl = `http://127.0.0.1:${targetPort}/`;
          this.writeLockFile({
            pid: proc.pid,
            port: targetPort,
            version: '0.2.0-rc.2',
            authUrl: this.authUrl,
            startedAt: Date.now()
          });
          await this.refreshAuthCookie(this.authUrl);
          await this.startProxy(targetPort);
          this.registerBridgePorts();
          this.setStatus('running', '就绪');
          this.emit('auth_ready', { authUrl: this.authUrl, studioUrl: this.studioUrl, port: targetPort });
          break;
        }
      }

      if (!this.authUrl || (!this.authUrl.includes('token=') && this.status !== 'running')) {
        throw new Error(this.lastError || '未能捕获 DSH 认证 Token，服务未完全就绪');
      }

      this._isStarting = false;
      return this.status === 'running';
    } catch (err) {
      this._isStarting = false;
      this.lastError = err.message;
      this.setStatus('error', err.message);
      // R3: 启动失败必须回收已拉起的进程树, 否则残留 dsh + MCP 子进程占用端口
      const failedPid = this._ownedPid || (this.process && this.process.pid);
      if (failedPid) this.killTree(failedPid);
      this.process = null;
      this._ownedPid = null;
      if (this.proxyServer) {
        try { this.proxyServer.close(); } catch (_) {}
        this.proxyServer = null;
        this.proxyPort = null;
        this.studioUrl = null;
      }
      this.clearLockFile();
      return false;
    }
  }

  /**
   * 停止守护进程 (Windows taskkill /T /F 确保无子进程残留)
   */
  async stop() {
    this.clearLockFile();
    if (this.proxyServer) {
      try { this.proxyServer.close(); } catch (_) {}
      this.proxyServer = null;
      this.proxyPort = null;
      this.studioUrl = null;
    }
    // R3: 归属 pid 优先 —— 复用(adopt)来的实例没有 this.process, 原实现会静默不杀进程
    const pid = this._ownedPid || (this.process && this.process.pid);
    if (!pid) {
      this.process = null;
      this._ownedPid = null;
      this.actualPort = null;
      this.authUrl = null;
      this.setStatus('stopped', '已停止');
      return true;
    }

    this.killTree(pid);

    this.process = null;
    this._ownedPid = null;
    this.actualPort = null;
    this.authUrl = null;
    this.setStatus('stopped', '已停止');
    return true;
  }

  async restart() {
    await this.stop();
    await new Promise(r => setTimeout(r, 500));
    return await this.start();
  }

  /**
   * 插件卸载/热重载时默认仅解绑当前前端代理与事件监听器，保留后台 DSH 守护进程与 daemon.lock，
   * 使重载后 _doStart() 可在 <50ms 内秒级热复用，彻底消除每次重载 8~10s 的冷启动与主线程 taskkill 阻塞。
   * 如需彻底强杀后台守护进程，显式传入 destroy(true) 或调用 stop() / restart()。
   */
  destroy(killDaemon = false) {
    if (killDaemon) {
      this.stop().catch(() => {});
      this.listeners.clear();
      return;
    }
    if (this.proxyServer) {
      try { this.proxyServer.close(); } catch (_) {}
      this.proxyServer = null;
      this.proxyPort = null;
      this.studioUrl = null;
    }
    if (this.process) {
      try {
        if (this.process.stdout) this.process.stdout.removeAllListeners();
        if (this.process.stderr) this.process.stderr.removeAllListeners();
        this.process.removeAllListeners();
        if (typeof this.process.unref === 'function') this.process.unref();
      } catch (_) {}
      this.process = null;
    }
    this._ownedPid = null;
    this._startPromise = null;
    this._isStarting = false;
    this.listeners.clear();
  }
}

module.exports = {
  DshDaemonManager,
  getTabonKbWebRequestBridge,
  getDshCustomStyles,
  getDshSidebarHideStyles,
  getDshFileBridgeScript,
  getDshContextBridgeScript
};
