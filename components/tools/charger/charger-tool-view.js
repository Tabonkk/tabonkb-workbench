/* ==========================================================================
   ChargerToolView — TabonKB 充电分析工具主视图 (原生 JS 模块化协同中枢)
   协调 充电分析 / 放电分析 / 寄存器Dump / Power-Z 示波器四大子系统
   ========================================================================== */

let chgChargePanelRef = typeof ChargePanel !== 'undefined' ? ChargePanel : null;
let chgDischargePanelRef = typeof DischargePanel !== 'undefined' ? DischargePanel : null;
let chgIcPanelRef = typeof IcPanel !== 'undefined' ? IcPanel : null;
let chgPowerzPanelRef = typeof PowerzPanel !== 'undefined' ? PowerzPanel : null;
if (!chgChargePanelRef || !chgDischargePanelRef || !chgIcPanelRef || !chgPowerzPanelRef) {
  try {
    if (!chgChargePanelRef) chgChargePanelRef = require('./charge-panel.js').ChargePanel;
    if (!chgDischargePanelRef) chgDischargePanelRef = require('./discharge-panel.js').DischargePanel;
    if (!chgIcPanelRef) chgIcPanelRef = require('./ic-panel.js').IcPanel;
    if (!chgPowerzPanelRef) chgPowerzPanelRef = require('./powerz-panel.js').PowerzPanel;
  } catch (_) {}
}

let chgToolNotice = typeof Notice !== 'undefined' ? Notice : null;
if (!chgToolNotice) {
  try {
    chgToolNotice = require('obsidian').Notice;
  } catch (_) {
    chgToolNotice = class { constructor(msg) { console.log('[Notice]', msg); } };
  }
}

const pzIcons = (typeof PZ_OFFICIAL_ICONS !== 'undefined') ? PZ_OFFICIAL_ICONS : ((typeof window !== 'undefined' && window.PZ_OFFICIAL_ICONS) ? window.PZ_OFFICIAL_ICONS : {});

class ChargerToolView {
  constructor(app, container, options = {}) {
    this.app = app || (typeof window !== 'undefined' ? window.app : null);
    this.container = container;
    this.plugin = options.plugin || null;
    this.workbenchView = options.workbenchView || null;

    let savedTab = 'powerz';
    try {
      if (typeof localStorage !== 'undefined') {
        savedTab = localStorage.getItem('tabonkb_charger_active_tab') || 'powerz';
      }
    } catch (_) {}
    this.activeTab = savedTab;
    this.chargePanel = null;
    this.dischargePanel = null;
    this.icPanel = null;
    this.powerzPanel = null;
    this.navTabsContainer = options.navTabsContainer || null;

    this.tabButtons = {};
    this.tabPanels = {};
  }

  mount() {
    const curTab = this.activeTab;
    const isAct = (k) => (k === curTab ? 'active' : '');
    const isDisp = (k) => (k === curTab ? 'display:block' : 'display:none');

    // 1. 如果宿主提供了顶级导航插槽，则将子功能选项卡直接挂载至顶级，杜绝双层工具栏撕裂
    let navBarHtml = '';
    if (this.navTabsContainer) {
      this.navTabsContainer.innerHTML = `
        <div class="tw-chg-tabs-group">
          <button class="tw-chg-tab-btn ${isAct('charge')}" data-tab="charge">🔋 充电分析</button>
          <button class="tw-chg-tab-btn ${isAct('discharge')}" data-tab="discharge">📉 放电分析</button>
          <button class="tw-chg-tab-btn ${isAct('ic')}" data-tab="ic">🧩 IC 寄存器</button>
          <button class="tw-chg-tab-btn ${isAct('powerz')}" data-tab="powerz">⚡ Power-Z</button>
        </div>
      `;
    } else {
      navBarHtml = `
        <div class="tw-chg-nav-bar">
          <div class="tw-chg-tabs-group">
            <button class="tw-chg-tab-btn ${isAct('charge')}" data-tab="charge">🔋 充电分析</button>
            <button class="tw-chg-tab-btn ${isAct('discharge')}" data-tab="discharge">📉 放电分析</button>
            <button class="tw-chg-tab-btn ${isAct('ic')}" data-tab="ic">🧩 IC 寄存器</button>
            <button class="tw-chg-tab-btn ${isAct('powerz')}" data-tab="powerz">⚡ Power-Z</button>
          </div>
          <div class="tw-chg-nav-meta">
            <span class="tw-chg-pill-tag">原生组件</span>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <style>
        .tw-chg-tab-btn { display:inline-flex; align-items:center; gap:5px; font-weight:700; }
        .tw-chg-tab-icon { width:14px; height:14px; object-fit:contain; vertical-align:middle; display:inline-block; pointer-events:none; }
      </style>
      <div class="tw-chg-main-wrapper">
        ${navBarHtml}
        <!-- 四大子系统挂载面板 -->
        <div class="tw-chg-views-container">
          <div class="tw-chg-view-pane" id="twChargerPane_charge" style="${isDisp('charge')}"></div>
          <div class="tw-chg-view-pane" id="twChargerPane_discharge" style="${isDisp('discharge')}"></div>
          <div class="tw-chg-view-pane" id="twChargerPane_ic" style="${isDisp('ic')}"></div>
          <div class="tw-chg-view-pane" id="twChargerPane_powerz" style="${isDisp('powerz')}"></div>
        </div>
      </div>
    `;

    // 绑定 Tab 按钮与面板
    const tabsRoot = this.navTabsContainer || this.container;
    const btnGroup = tabsRoot.querySelectorAll(".tw-chg-tab-btn");
    btnGroup.forEach(btn => {
      const tabKey = btn.dataset.tab;
      this.tabButtons[tabKey] = btn;
      this.tabPanels[tabKey] = this.container.querySelector(`#twChargerPane_${tabKey}`);
      btn.addEventListener("click", () => this.switchTab(tabKey));
    });

    // 实例化四大面板
    const paneCharge = this.tabPanels.charge;
    const paneDischarge = this.tabPanels.discharge;
    const paneIc = this.tabPanels.ic;
    const panePz = this.tabPanels.powerz;

    if (paneCharge && chgChargePanelRef) {
      this.chargePanel = new chgChargePanelRef({ parent: this });
      this.chargePanel.mount(paneCharge);
    }
    if (paneDischarge && chgDischargePanelRef) {
      this.dischargePanel = new chgDischargePanelRef({ parent: this });
      this.dischargePanel.mount(paneDischarge);
    }
    if (paneIc && chgIcPanelRef) {
      this.icPanel = new chgIcPanelRef({ parent: this });
      this.icPanel.mount(paneIc);
    }
    if (panePz && chgPowerzPanelRef) {
      this.powerzPanel = new chgPowerzPanelRef(panePz, { parentView: this });
    }

    // 明确激活当前保存的 Tab
    this.switchTab(this.activeTab);
  }

  switchTab(tabKey) {
    if (!this.tabPanels[tabKey]) return;
    this.activeTab = tabKey;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb_charger_active_tab', tabKey);
      }
    } catch (_) {}

        const viewsContainer = this.container.querySelector('.tw-chg-views-container');
    if (viewsContainer) {
      viewsContainer.classList.toggle('is-powerz-active', tabKey === 'powerz');
    }

    Object.keys(this.tabButtons).forEach(k => {
      this.tabButtons[k].classList.toggle("active", k === tabKey);
    });

    Object.keys(this.tabPanels).forEach(k => {
      if (k === 'powerz') {
        this.tabPanels[k].style.display = (k === tabKey) ? "flex" : "none";
      } else {
        this.tabPanels[k].style.display = (k === tabKey) ? "block" : "none";
      }
    });

    // 触发图表重新测量重绘
    if (tabKey === 'powerz' && this.powerzPanel) {
      window.dispatchEvent(new Event('resize'));
    }
  }

  /**
   * 联动能力：从 Power-Z 实时数据流一键转入充电数据分析
   */
  switchToChargeWithData(csvContent, fileName) {
    this.switchTab('charge');
    if (this.chargePanel && typeof this.chargePanel.loadCsvText === 'function') {
      this.chargePanel.loadCsvText(csvContent, fileName);
      if (chgToolNotice) new chgToolNotice(`✓ 成功将 Power-Z 实时数据注入充电分析 (${fileName})`, 2500);
    }
  }

  /**
   * Phase 3: 直接将分析报告保存归档至 Obsidian 知识库 (10-Test-Cert/03-Power-Test/)
   */
  async saveMarkdownToVault(relPath, mdContent) {
    try {
      const adapter = this.app?.vault?.adapter;
      if (adapter) {
        const parts = relPath.replace(/\\/g, '/').split('/');
        const dir = parts.slice(0, -1).join('/');

        // 递归检查并创建目录
        if (dir && !(await adapter.exists(dir))) {
          await adapter.mkdir(dir);
        }

        await adapter.write(relPath, mdContent);
        if (chgToolNotice) new chgToolNotice(`✓ 测试报告已成功归档至: ${relPath}`, 3500);
        return { success: true, path: relPath };
      } else {
        // 无 Vault 适配器环境 (外部测试 fallback)
        const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = relPath.split('/').pop() || "report.md";
        a.click();
        URL.revokeObjectURL(url);
        return { success: true, path: relPath };
      }
    } catch (err) {
      console.error("[ChargerToolView] Failed to save markdown to vault:", err);
      if (chgToolNotice) new chgToolNotice(`✗ 归档报告失败: ${err.message}`, 3500);
      return { success: false, error: err.message };
    }
  }

  /**
   * Phase 3: 呼叫 Agent Hub 侧边栏进行技术根因分析与调优指引
   */
  invokeAgentDiagnostics(title, prompt) {
    const drawer = this.workbenchView?.agentDrawer ||
                   this.plugin?.agentDrawer ||
                   this.plugin?.activeWorkbenchView?.agentDrawer;

    if (drawer && typeof drawer.sendPrompt === 'function') {
      if (typeof drawer.isOpen === 'function' && !drawer.isOpen()) {
        drawer.open();
      }
      drawer.sendPrompt(prompt, false);
      if (chgToolNotice) new chgToolNotice(`✓ 已将「${title}」诊断上下文载入 Agent Hub 对话框`, 2000);
      return true;
    }

    // Fallback: 写入剪贴板
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt);
      if (chgToolNotice) new chgToolNotice(`✓ 已复制「${title}」诊断提示词，可直接粘贴到 Agent 对话框`, 2500);
      return true;
    }
    return false;
  }

  destroy() {
    if (this.powerzPanel && typeof this.powerzPanel.destroy === 'function') {
      this.powerzPanel.destroy();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChargerToolView };
}
