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

  // 监听来自宿主 (Obsidian) 的双击切换侧栏消息
  window.addEventListener('message', function(e) {
    if (!e || !e.data) return;
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
              const styleTag = customCss ? `\n<style id="tabonkb-dsh-overrides">\n${customCss}\n</style>\n` : '';
              const hideStyleTag = hideCss ? `\n<style id="tabonkb-dsh-sidebar-hide">\n${hideCss}\n</style>\n` : '';
              const scriptTag = bridgeJs ? `\n<script id="tabonkb-dsh-file-bridge">\n${bridgeJs}\n</script>\n` : '';
              const injectTags = `${styleTag}${hideStyleTag}${scriptTag}`;
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
  getDshFileBridgeScript
};
