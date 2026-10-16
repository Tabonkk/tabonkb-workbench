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

            // WeKnora / Notion 嵌入拦截剥除（iframe 需剥 x-frame-options 与 CSP frame-ancestors）
            if (url.includes(':8088') || url.includes(':8080') || url.includes('192.168.1.62') || url.includes('weknora')
                || url.includes('notion.so') || url.includes('notion.com') || url.includes('notion.site')) {
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
  if (window._twxCtxBridgeInstalled) return;
  window._twxCtxBridgeInstalled = true;

  var CSS = [
    '.twx-ctx-block{padding:2px 0;}',
    '.twx-sep{height:1px;background:rgba(128,128,128,.18);margin:4px 10px;}',
    '.twx-glabel{padding:3px 12px 2px;font-size:10px;font-weight:600;letter-spacing:.4px;color:#8b949e;}',
    '.twx-item{display:flex;align-items:center;gap:8px;padding:6px 10px;margin:0 4px;border-radius:6px;font-size:12px;cursor:pointer;color:inherit;}',
    '.twx-item:hover{background:rgba(128,128,128,.12);}',
    '.twx-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;}',
    '.twx-name{font-weight:500;}',
    '.twx-val{margin-left:auto;font-size:10.5px;color:#8b949e;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.twx-arrow{color:#8b949e;font-size:11px;margin-left:2px;}',
    '.twx-panel{position:fixed;z-index:2147483000;width:262px;max-height:min(340px,calc(100vh - 40px));display:flex;flex-direction:column;border-radius:10px;overflow:hidden;font-family:inherit;font-size:12px;color:inherit;',
    'background:var(--ds-background-secondary,Canvas);border:1px solid rgba(128,128,128,.25);box-shadow:0 12px 32px -4px rgba(0,0,0,.28);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);}',
    '.twx-p-search{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid rgba(128,128,128,.16);}',
    '.twx-p-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:11.5px;color:inherit;}',
    '.twx-p-nav{display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid rgba(128,128,128,.14);font-size:11px;}',
    '.twx-back{cursor:pointer;color:#8b949e;padding:1px 4px;border-radius:4px;white-space:nowrap;}',
    '.twx-back:hover{background:rgba(128,128,128,.14);color:inherit;}',
    '.twx-nav-title{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.twx-p-list{overflow-y:auto;padding:4px;flex:1;}',
    '.twx-opt{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11.5px;}',
    '.twx-opt:hover{background:rgba(128,128,128,.12);}',
    '.twx-opt.on{background:rgba(37,99,235,.14);}',
    '.twx-opt .t-main{min-width:0;flex:1;}',
    '.twx-opt .t-name{display:block;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.twx-opt .t-desc{display:block;font-size:10px;color:#8b949e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.twx-opt .t-check{color:#10B981;font-size:11px;flex:0 0 auto;}',
    '.twx-tag{display:inline-block;margin-left:5px;padding:0 5px;border-radius:5px;font-size:9.5px;font-weight:500;background:rgba(128,128,128,.14);color:#8b949e;vertical-align:1px;}',
    '.twx-arr{color:#8b949e;font-size:11px;flex:0 0 auto;}',
    '.twx-cur{display:flex;align-items:center;gap:7px;margin:0 0 5px;padding:7px 9px;border-radius:7px;border-left:2px solid #10B981;background:rgba(16,185,129,.08);font-size:11.5px;}',
    '.twx-cur-ic{color:#10B981;font-size:12px;flex:0 0 auto;}',
    '.twx-cur .t-name{color:#10B981;font-weight:600;}',
    '.twx-cur-x{flex:0 0 auto;margin-left:auto;background:transparent;border:0;cursor:pointer;color:#94A3B8;padding:2px 5px;font-size:10.5px;border-radius:4px;}',
    '.twx-cur-x:hover{background:rgba(128,128,128,.14);color:inherit;}',
    '.twx-srv{padding:5px 8px 2px;font-size:10px;font-weight:600;color:#8b949e;}',
    '.twx-gbtn{display:block;margin:6px auto 2px;padding:3px 10px;font-size:10.5px;border-radius:6px;border:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;cursor:pointer;}',
    '.twx-gbtn:hover{background:rgba(128,128,128,.12);}',
    '.twx-loading,.twx-empty{padding:16px;text-align:center;font-size:11px;color:#8b949e;}',
    '.twx-chips{display:inline-flex;align-items:center;gap:4px;margin-left:4px;}',
    '.twx-chip .t-x:hover{opacity:1 !important;}'
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

  var ctxState = { values: {}, lists: { jira: [], localproj: [] } };
  var menuEl = null;
  var panelEl = null;
  var openKey = null;
  var panelQuery = '';
  var chipsEl = null;
  // 本地工程四级递进导航状态 (与自研抽屉 localProjNavState 同构):
  // servers(服务器) > workspaces(总代码路径) > platforms(CPU平台) > projects(机型)
  var lpNav = { step: 'servers', serverId: null, workspaceName: null, platform: null };

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

  function onMenuFound(menu) {
    if (menu !== menuEl) { menuEl = menu; injectGroup(menu); }
    else if (!menuEl.querySelector('.twx-ctx-block')) injectGroup(menuEl);
    else refreshVals();
    askHost();
  }

  function injectGroup(menu) {
    if (menu.querySelector('.twx-ctx-block')) return;
    var blk = document.createElement('div');
    blk.className = 'twx-ctx-block';
    var html = '<div class="twx-sep"></div><div class="twx-glabel">上下文</div>';
    for (var i = 0; i < ROWS.length; i++) {
      var r = ROWS[i];
      html += '<div class="twx-item" data-k="' + r.key + '">' +
        '<span class="twx-dot" style="background:' + r.color + '"></span>' +
        '<span class="twx-name">' + r.name + '</span>' +
        '<span class="twx-val">' + esc(valLabel(r.key)) + '</span>' +
        '<span class="twx-arrow">›</span></div>';
    }
    blk.innerHTML = html;
    menu.appendChild(blk);
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
    var w = 262;
    var left = itemR.right - 6; // 6px 微重叠, 消除父子浮窗裂隙
    if (left + w > window.innerWidth - 8) {
      left = menuR.left - w + 6; // 视口右侧不足时向左翻转
    }
    panelEl = document.createElement('div');
    panelEl.className = 'twx-panel';
    panelEl.style.left = Math.max(8, left) + 'px';
    // 底端与「+」菜单底边对齐, 向上生长, 杜绝探出窗口下缘
    var bottomPx = window.innerHeight - menuR.bottom;
    panelEl.style.bottom = Math.max(8, bottomPx) + 'px';
    panelEl.innerHTML =
      '<div class="twx-p-search" style="display:none;"><input type="text" placeholder="搜索..." /></div>' +
      '<div class="twx-p-nav" style="display:none;"><span class="twx-back" data-act="back">‹ <i></i></span><span class="twx-nav-title"></span></div>' +
      '<div class="twx-p-list"><div class="twx-loading">加载中…</div></div>';
    document.body.appendChild(panelEl);
    // 面板内委托点击: 选项选择 / 递进下钻 / 回退 / 清除绑定
    panelEl.onclick = function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act],[data-p]') : null;
      if (!t) return;
      e.stopPropagation();
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
    nav.querySelector('.twx-back i').textContent = backText;
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
      '</span>' + (on ? '<span class="t-check">✓</span>' : '') + '</div>';
  }

  function drillRow(act, val, name, tag, desc) {
    return '<div class="twx-opt" data-act="' + act + '" data-v="' + esc(val) + '">' +
      '<span class="t-main"><span class="t-name">' + esc(name) +
      (tag ? '<span class="twx-tag">' + esc(tag) + '</span>' : '') + '</span>' +
      (desc ? '<span class="t-desc">' + esc(desc) + '</span>' : '') +
      '</span><span class="twx-arr">›</span></div>';
  }

  function curCard(name, desc, clearAct) {
    return '<div class="twx-cur"><span class="twx-cur-ic">✓</span>' +
      '<span class="t-main"><span class="t-name">已选: ' + esc(name) + '</span>' +
      (desc ? '<span class="t-desc">' + esc(desc) + '</span>' : '') + '</span>' +
      '<button type="button" class="twx-cur-x" data-act="' + clearAct + '">清除</button></div>';
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
        var hay = ((gp.project || '') + ' ' + (gp.platform || '') + ' ' + (gp.workspaceName || '') + ' ' + (gp.label || '') + ' ' + (gp.serverId || '')).toLowerCase();
        if (hay.indexOf(q) === -1) continue;
        ghtml += '<div class="twx-opt' + (isSel('localproj', gp) ? ' on' : '') + '" data-p="' + encodeURIComponent(JSON.stringify({ k: 'localproj', v: gp })) + '">' +
          '<span class="t-main"><span class="t-name">' + esc(gp.project) + '<span class="twx-tag">' + esc(gp.platform || '') + '</span><span class="twx-tag">' + esc(gp.serverId) + '服</span></span>' +
          '<span class="t-desc">' + esc(gp.serverId) + '服 › ' + esc(gp.workspaceName) + '</span></span>' +
          (isSel('localproj', gp) ? '<span class="t-check">✓</span>' : '') + '</div>';
        gcount++;
      }
      return ghtml || '<div class="twx-empty">未匹配到包含 "' + esc(q) + '" 的本地工程</div>';
    }

    // Level 1: 服务器
    if (lpNav.step === 'servers') {
      setNavHeader('', '');
      var html = '';
      if (cur && cur.id) {
        html += curCard(cur.label || cur.project, (cur.workspaceName || '') + ' · ' + (cur.platform || '') + ' · ' + (cur.serverId || '') + '服', 'clear-lp');
      } else {
        html += '<div class="twx-opt" data-act="clear-lp" style="opacity:.9;">' +
          '<span class="t-main"><span class="t-name">未指定 (默认)</span><span class="t-desc">不绑定特定工程与机型</span></span><span class="t-check">✓</span></div>';
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
      setNavHeader('服务器', (srv2.name || srv2.id) + ' (' + srv2.worder.length + '套代码)');
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
      var wsShort = (lpNav.workspaceName || '').split('/').pop();
      setNavHeader('代码路径', wsShort + ' (' + ws3.porder.length + '个平台)');
      var html3 = '';
      for (var p3 = 0; p3 < ws3.porder.length; p3++) {
        var platKey = ws3.porder[p3];
        var pl3 = ws3.pmap[platKey];
        if (q) {
          var pmatch = platKey.toLowerCase().indexOf(q) !== -1 || pl3.projects.some(function (x) { return (x.project || '').toLowerCase().indexOf(q) !== -1; });
          if (!pmatch) continue;
        }
        var isCurPlat = cur && cur.serverId === lpNav.serverId && cur.workspaceName === lpNav.workspaceName && cur.platform === platKey;
        html3 += drillRow('plat', platKey, platKey, pl3.projects.length + '款机型', lpNav.serverId + '服 › ' + lpNav.workspaceName + (isCurPlat ? ' · 当前' : ''));
      }
      return html3 || emptyWithGlobal('当前代码路径未匹配到包含 "' + esc(q) + '" 的平台');
    }

    var pl4 = ws3.pmap[lpNav.platform];
    if (!pl4) { lpNav = { step: 'platforms', serverId: lpNav.serverId, workspaceName: lpNav.workspaceName, platform: null }; return renderLocalproj(q); }

    // Level 4: 机型 SKU
    setNavHeader(lpNav.platform + '平台', lpNav.platform + ' (' + pl4.projects.length + '款机型)');
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
        (isSel('localproj', pj) ? '<span class="t-check">✓</span>' : '') + '</div>';
    }
    return html4 || emptyWithGlobal('当前平台未匹配到包含 "' + esc(q) + '" 的机型');
  }

  // ---- 输入区上下文胶囊: 克隆「完全权限」胶囊样式, 紧跟其后插入同一工具栏行 ----
  function findPermPill() {
    // 底部区域含「权限/permission」短文本的最内层元素, 向上爬到胶囊容器 (宽<220px 高<48px)
    var all = document.querySelectorAll('body *');
    var cand = null;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest && (el.closest('.twx-chips') || el.closest('.twx-panel'))) continue;
      var t = el.innerText;
      if (!t) continue;
      t = t.trim();
      if (t.length > 12 || !/(权限|permission)/i.test(t)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 30 || r.top < window.innerHeight * 0.5 || r.top > window.innerHeight) continue;
      cand = el;
    }
    if (!cand) return null;
    var pill = cand;
    while (pill.parentElement) {
      var pr = pill.parentElement.getBoundingClientRect();
      var pt = (pill.parentElement.innerText || '').trim();
      if (pt.length <= 12 && /(权限|permission)/i.test(pt) && pr.width < 220 && pr.height < 48) {
        pill = pill.parentElement;
      } else break;
    }
    return pill;
  }

  function updateCtxChips() {
    var v = ctxState.values || {};
    var defs = [];
    if (v.localproj && v.localproj.id) defs.push({ k: 'localproj', label: v.localproj.label || v.localproj.project, color: '#F59E0B' });
    if (v.jira && v.jira.key) defs.push({ k: 'jira', label: v.jira.key, color: '#0EA5E9' });
    if (v.opengrok && v.opengrok !== 'auto') defs.push({ k: 'opengrok', label: v.opengrok, color: '#10B981' });
    if (v.gerrit && v.gerrit !== 'all') defs.push({ k: 'gerrit', label: (GERRIT_LABELS[v.gerrit] || v.gerrit), color: '#6366F1' });

    var pill = defs.length ? findPermPill() : null;
    if (!defs.length || !pill) {
      if (chipsEl) { try { chipsEl.remove(); } catch (_) {} chipsEl = null; }
      return;
    }
    if (!chipsEl) {
      chipsEl = document.createElement('span');
      chipsEl.className = 'twx-chips';
      chipsEl.onclick = function (e) {
        var x = e.target && e.target.closest ? e.target.closest('.t-x') : null;
        if (!x) return;
        e.stopPropagation();
        var k = x.getAttribute('data-k');
        var def = { opengrok: 'auto', gerrit: 'all', jira: null, localproj: null };
        postSet(k, def[k] === undefined ? null : def[k]);
      };
    }
    // 紧跟权限胶囊插入 (React 重渲染位移时自动纠正)
    if (!chipsEl.isConnected || chipsEl.previousElementSibling !== pill) {
      try { pill.insertAdjacentElement('afterend', chipsEl); } catch (_) { return; }
    }
    // 逐像素克隆权限胶囊外观: 字体/颜色/背景/圆角/内边距/行高/高度
    var cs = getComputedStyle(pill);
    var chipCss = 'display:inline-flex;align-items:center;gap:4px;white-space:nowrap;cursor:default;box-sizing:border-box;' +
      'font-size:' + cs.fontSize + ';font-family:' + cs.fontFamily + ';font-weight:' + cs.fontWeight + ';' +
      'color:' + cs.color + ';background:' + cs.backgroundColor + ';border:' + cs.border + ';' +
      'border-radius:' + cs.borderRadius + ';line-height:' + cs.lineHeight + ';' +
      'padding:' + cs.paddingTop + ' ' + cs.paddingRight + ';' +
      'max-width:140px;overflow:hidden;';
    var html = '';
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      html += '<span class="twx-chip" style="' + chipCss + '">' +
        '<span class="t-dot" style="background:' + d.color + ';width:6px;height:6px;border-radius:50%;flex:0 0 auto;"></span>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;">' + esc(d.label) + '</span>' +
        '<span class="t-x" data-k="' + d.k + '" style="cursor:pointer;opacity:.55;margin-left:1px;">✕</span></span>';
    }
    chipsEl.innerHTML = html;
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

  // 面板外点击自然退出
  document.addEventListener('click', function (e) {
    if (!panelEl) return;
    if (panelEl.contains(e.target)) return;
    var t = e.target;
    if (t && t.closest && t.closest('.twx-item')) return;
    closePanel();
  }, true);

  // 委托绑定注入行的点击 (React 重渲染后仍有效)
  document.addEventListener('click', function (e) {
    var it = e.target && e.target.closest ? e.target.closest('.twx-item') : null;
    if (!it) return;
    e.stopPropagation();
    openPanel(it.getAttribute('data-k'), it);
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
        for (var i = 0; i < roots.length; i++) {
          var menu = pickMenu(roots[i]);
          if (menu) { onMenuFound(menu); break; }
        }
        // 菜单被 React 卸载/重渲染时仅释放锚点：级联面板驻留至用户选择或外点，
        // 避免点击面板选项触发 DSH 菜单外点关闭时连带销毁面板
        if (menuEl && !menuEl.isConnected) { menuEl = null; }
        else if (menuEl && !menuEl.querySelector('.twx-ctx-block')) injectGroup(menuEl);
        updateCtxChips();
      } catch (_) {}
    }, 40);
  }

  var mo = new MutationObserver(function (muts) {
    try {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes') { scheduleScan(m.target); continue; }
        var adds = m.addedNodes;
        for (var j = 0; j < adds.length; j++) {
          if (adds[j] && adds[j].nodeType === 1) scheduleScan(adds[j]);
        }
        // 子树内结构变化时, 复查已注入块是否被 React 覆盖
        if (menuEl && m.target && menuEl.contains && menuEl.contains(m.target)) scheduleScan(null);
      }
    } catch (_) {}
  });
  mo.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden']
  });

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

      // 1. 检查锁文件与已有进程
      const lock = this.readLockFile();
      if (lock && lock.port && this.isProcessAlive(lock.pid)) {
        const probe = await this.probeDshSignature(lock.port);
        if (probe.isDsh && (probe.authenticated || (lock.authUrl && lock.authUrl.includes('token=')))) {
          this.actualPort = lock.port;
          this.authUrl = lock.authUrl || `http://127.0.0.1:${lock.port}/`;
          this._ownedPid = lock.pid; // R3: 复用实例同样登记归属, 保证 stop() 能回收
          await this.refreshAuthCookie(this.authUrl);
          await this.startProxy(this.actualPort);
          this.registerBridgePorts();
          this.setStatus('running', '复用已运行实例');
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
      const proc = child_process.spawn(spawnCmd, spawnArgs, {
        cwd: this.vaultBasePath || process.cwd(),
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

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

  destroy() {
    this.stop().catch(() => {});
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
