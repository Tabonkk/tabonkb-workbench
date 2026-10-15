/* ==========================================================================
   DischargePanel — 放电数据分析面板 (放电性能评估、20%低电量专项、双文件对比与归档)
   ========================================================================== */

let disCalcRef = typeof dischargeAnalyze === 'function' ? { esc, fmtNum, fmtMin, parseCSV, dischargeAnalyze, formatDischargeTime } : null;
if (!disCalcRef) {
  try {
    disCalcRef = require('./charger-calc.js');
  } catch (_) {
    disCalcRef = {
      esc: typeof esc === 'function' ? esc : v => String(v ?? ""),
      fmtNum: typeof fmtNum === 'function' ? fmtNum : (v, d = 2) => Number(v).toFixed(d),
      fmtMin: typeof fmtMin === 'function' ? fmtMin : v => String(v),
      parseCSV: typeof parseCSV === 'function' ? parseCSV : () => ({ rows: [] }),
      dischargeAnalyze: typeof dischargeAnalyze === 'function' ? dischargeAnalyze : () => ({}),
      formatDischargeTime: typeof formatDischargeTime === 'function' ? formatDischargeTime : t => String(t)
    };
  }
}

let disChartsRef = typeof drawMultiChart === 'function' ? { drawMultiChart, drawDischargeCompareChart } : null;
if (!disChartsRef) {
  try {
    disChartsRef = require('./charger-charts.js');
  } catch (_) {
    disChartsRef = {
      drawMultiChart: typeof drawMultiChart === 'function' ? drawMultiChart : () => {},
      drawDischargeCompareChart: typeof drawDischargeCompareChart === 'function' ? drawDischargeCompareChart : () => {}
    };
  }
}

let getDisIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!getDisIconPark) {
  try {
    getDisIconPark = require('../../ui/iconpark.js').getIconPark;
  } catch (_) {
    getDisIconPark = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

class DischargePanel {
  constructor(options = {}) {
    this.parent = options.parent || null;
    this.containerEl = null;
    this.state = {
      discharge: null,
      dischargeMetrics: null,
      compareA: null,
      compareB: null,
      compareMetricsA: null,
      compareMetricsB: null
    };
  }

  mount(parentEl) {
    this.containerEl = parentEl.createDiv({ cls: 'tw-chg-page-panel' });
    this.render();
  }

  render() {
    this.containerEl.innerHTML = `
      <!-- 1. 单文件放电分析卡片 -->
      <div class="tw-chg-card">
        <div class="tw-chg-card-head">
          <div class="tw-chg-card-title">
            <span class="tw-chg-card-title-icon">${getDisIconPark('chart-line', 14)}</span>
            <span>单文件放电深度分析</span>
          </div>
          <div class="tw-chg-card-meta">
            <span class="tw-chg-pill-tag">20%低电量专项诊断</span>
          </div>
        </div>
        <div class="tw-chg-card-body">
          <div class="tw-chg-dropzone" id="dischargeDropzone">
            <input id="dischargeFile" type="file" accept=".csv,text/csv" class="tw-chg-hidden-file-input">
            <div id="dischargeStatus" class="tw-chg-dropzone-content">
              <div class="tw-chg-drop-icon">${getDisIconPark('upload', 24)}</div>
              <div class="tw-chg-drop-label">点击或拖入放电日志 CSV</div>
              <div class="tw-chg-drop-hint">支持整机恒载/动态放电、内核电池记录仪日志</div>
            </div>
          </div>

          <div class="tw-chg-btn-bar" style="margin-top:14px">
            <button id="dischargeGenerate" class="tw-chg-btn tw-chg-btn-primary" disabled>
              ${getDisIconPark('lightning', 13)}<span>生成放电报告</span>
            </button>
            <button id="dischargeSaveVault" class="tw-chg-btn tw-chg-btn-vault" disabled title="归档至 10-Test-Cert/03-Power-Test/">
              ${getDisIconPark('folder-download', 13)}<span>归档到知识库</span>
            </button>
            <button id="dischargeAgentDiag" class="tw-chg-btn tw-chg-btn-agent" disabled title="呼叫 Agent 诊断低电量跌落或跳变">
              ${getDisIconPark('robot', 13)}<span>呼叫 Agent 诊断</span>
            </button>
            <button id="dischargeReset" class="tw-chg-btn tw-chg-btn-ghost">
              ${getDisIconPark('refresh', 13)}<span>重置</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. 双文件对比卡片 -->
      <div class="tw-chg-card" style="margin-top:14px">
        <div class="tw-chg-card-head">
          <div class="tw-chg-card-title">
            <span class="tw-chg-card-title-icon">${getDisIconPark('balance', 14)}</span>
            <span>双文件放电 A / B 对比分析</span>
          </div>
          <div class="tw-chg-card-meta">
            <span class="tw-chg-pill-tag">续航与低电量一致性</span>
          </div>
        </div>
        <div class="tw-chg-card-body">
          <div class="tw-chg-dual-dropzone-grid">
            <div class="tw-chg-drop-col">
              <div class="tw-chg-drop-title">放电数据 A (基准机 / 修改前)</div>
              <div class="tw-chg-dropzone" id="dcCompareDropzoneA">
                <input id="dcCompareFileA" type="file" accept=".csv,text/csv" class="tw-chg-hidden-file-input">
                <div id="dcCompareStatusA" class="tw-chg-dropzone-content">
                  <div class="tw-chg-drop-icon">${getDisIconPark('upload', 20)}</div>
                  <div class="tw-chg-drop-label">点击或拖入放电日志 (A)</div>
                </div>
              </div>
            </div>
            <div class="tw-chg-drop-col">
              <div class="tw-chg-drop-title">放电数据 B (对照机 / 修改后)</div>
              <div class="tw-chg-dropzone" id="dcCompareDropzoneB">
                <input id="dcCompareFileB" type="file" accept=".csv,text/csv" class="tw-chg-hidden-file-input">
                <div id="dcCompareStatusB" class="tw-chg-dropzone-content">
                  <div class="tw-chg-drop-icon">${getDisIconPark('upload', 20)}</div>
                  <div class="tw-chg-drop-label">点击或拖入放电日志 (B)</div>
                </div>
              </div>
            </div>
          </div>

          <div class="tw-chg-btn-bar" style="margin-top:14px">
            <button id="dcCompareGenerate" class="tw-chg-btn tw-chg-btn-primary" disabled>
              ${getDisIconPark('lightning', 13)}<span>生成对比报告</span>
            </button>
            <button id="dcCompareSaveVault" class="tw-chg-btn tw-chg-btn-vault" disabled>
              ${getDisIconPark('folder-download', 13)}<span>归档对比报告</span>
            </button>
            <button id="dcCompareAgentDiag" class="tw-chg-btn tw-chg-btn-agent" disabled>
              ${getDisIconPark('robot', 13)}<span>呼叫 Agent 诊断</span>
            </button>
            <button id="dcCompareReset" class="tw-chg-btn tw-chg-btn-ghost">
              ${getDisIconPark('refresh', 13)}<span>重置对比</span>
            </button>
          </div>
        </div>
      </div>

      <div id="dcReport" class="tw-chg-report"></div>
      <div id="dcCompareReport" class="tw-chg-report"></div>
    `;

    this.initEvents();
  }

  initEvents() {
    const el = this.containerEl;

    // 通用拖拽绑定辅助函数
    const bindDropzoneEvents = (dropzoneEl, fileInputEl, onFile) => {
      if (!dropzoneEl || !fileInputEl) return;
      dropzoneEl.addEventListener("click", (e) => {
        if (e.target.closest(".tw-chg-file-card-change")) {
          e.stopPropagation();
          fileInputEl.click();
          return;
        }
        fileInputEl.click();
      });
      dropzoneEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzoneEl.classList.add("dragover");
      });
      dropzoneEl.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove("dragover");
      });
      dropzoneEl.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          onFile(e.dataTransfer.files[0]);
        }
      });
      fileInputEl.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          onFile(e.target.files[0]);
        }
      });
    };

    // 1. 单文件放电拖拽与选择
    const fDropzone = el.querySelector("#dischargeDropzone");
    const fInput = el.querySelector("#dischargeFile");
    const fStatus = el.querySelector("#dischargeStatus");
    const genBtn = el.querySelector("#dischargeGenerate");

    bindDropzoneEvents(fDropzone, fInput, async (file) => {
      try {
        const txt = await file.text();
        this.state.discharge = disCalcRef.parseCSV(txt);
        fDropzone.classList.add("has-file");
        fStatus.innerHTML = `
          <div class="tw-chg-file-card">
            <div class="tw-chg-file-card-icon">${getDisIconPark('file-csv', 22)}</div>
            <div class="tw-chg-file-card-info">
              <div class="tw-chg-file-card-name">${file.name}</div>
              <div class="tw-chg-file-card-meta">${(file.size / 1024).toFixed(1)} KB · <span class="tw-chg-text-success">✓ 读取完成: ${this.state.discharge.rows.length} 行数据已校验</span></div>
            </div>
            <button class="tw-chg-file-card-change" type="button">更换</button>
          </div>
        `;
        if (genBtn) genBtn.disabled = false;
      } catch (err) {
        fDropzone.classList.remove("has-file");
        fStatus.innerHTML = `
          <div class="tw-chg-file-card error">
            <div class="tw-chg-file-card-icon">${getDisIconPark('alert', 22)}</div>
            <div class="tw-chg-file-card-info">
              <div class="tw-chg-file-card-name">${file.name}</div>
              <div class="tw-chg-file-card-meta"><span class="tw-chg-text-error">✗ ${disCalcRef.esc(err.message)}</span></div>
            </div>
            <button class="tw-chg-file-card-change" type="button">重选</button>
          </div>
        `;
        this.state.discharge = null;
        if (genBtn) genBtn.disabled = true;
      }
    });

    if (genBtn) {
      genBtn.addEventListener("click", () => this.generateDischargeReport());
    }

    const saveVaultBtn = el.querySelector("#dischargeSaveVault");
    if (saveVaultBtn) {
      saveVaultBtn.addEventListener("click", () => this.saveDischargeToVault());
    }

    const agentDiagBtn = el.querySelector("#dischargeAgentDiag");
    if (agentDiagBtn) {
      agentDiagBtn.addEventListener("click", () => this.diagnoseDischargeWithAgent());
    }

    const resetBtn = el.querySelector("#dischargeReset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetDischarge());
    }

    // 2. 双文件放电对比
    const initCmp = (dropId, fileId, statusId, key) => {
      const dropEl = el.querySelector("#" + dropId);
      const inp = el.querySelector("#" + fileId);
      const st = el.querySelector("#" + statusId);
      if (!dropEl || !inp) return;

      bindDropzoneEvents(dropEl, inp, async (f) => {
        try {
          const txt = await f.text();
          this.state[key] = disCalcRef.parseCSV(txt);
          dropEl.classList.add("has-file");
          st.innerHTML = `
            <div class="tw-chg-file-card">
              <div class="tw-chg-file-card-icon">${getDisIconPark('file-csv', 20)}</div>
              <div class="tw-chg-file-card-info">
                <div class="tw-chg-file-card-name">${f.name}</div>
                <div class="tw-chg-file-card-meta">${(f.size / 1024).toFixed(1)} KB · <span class="tw-chg-text-success">✓ ${this.state[key].rows.length} 行通过</span></div>
              </div>
              <button class="tw-chg-file-card-change" type="button">更换</button>
            </div>
          `;
        } catch (err) {
          dropEl.classList.remove("has-file");
          st.innerHTML = `
            <div class="tw-chg-file-card error">
              <div class="tw-chg-file-card-icon">${getDisIconPark('alert', 20)}</div>
              <div class="tw-chg-file-card-info">
                <div class="tw-chg-file-card-name">${f.name}</div>
                <div class="tw-chg-file-card-meta"><span class="tw-chg-text-error">✗ ${disCalcRef.esc(err.message)}</span></div>
              </div>
              <button class="tw-chg-file-card-change" type="button">重选</button>
            </div>
          `;
          this.state[key] = null;
        }
        const cmpGen = el.querySelector("#dcCompareGenerate");
        if (cmpGen) cmpGen.disabled = !(this.state.compareA && this.state.compareB);
      });
    };

    initCmp("dcCompareDropzoneA", "dcCompareFileA", "dcCompareStatusA", "compareA");
    initCmp("dcCompareDropzoneB", "dcCompareFileB", "dcCompareStatusB", "compareB");

    const cmpGenBtn = el.querySelector("#dcCompareGenerate");
    if (cmpGenBtn) {
      cmpGenBtn.addEventListener("click", () => this.generateCompareReport());
    }

    const cmpSaveVaultBtn = el.querySelector("#dcCompareSaveVault");
    if (cmpSaveVaultBtn) {
      cmpSaveVaultBtn.addEventListener("click", () => this.saveCompareToVault());
    }

    const cmpAgentDiagBtn = el.querySelector("#dcCompareAgentDiag");
    if (cmpAgentDiagBtn) {
      cmpAgentDiagBtn.addEventListener("click", () => this.diagnoseCompareWithAgent());
    }

    const cmpResetBtn = el.querySelector("#dcCompareReset");
    if (cmpResetBtn) {
      cmpResetBtn.addEventListener("click", () => this.resetCompare());
    }
  }

  generateDischargeReport() {
    if (!this.state.discharge) return;
    const m = disCalcRef.dischargeAnalyze(this.state.discharge);
    this.state.dischargeMetrics = m;

    const reportEl = this.containerEl.querySelector("#dcReport");
    reportEl.innerHTML = this.buildDischargeReportHtml(m);
    reportEl.classList.add("show");

    this.containerEl.querySelector("#dischargeSaveVault").disabled = false;
    this.containerEl.querySelector("#dischargeAgentDiag").disabled = false;

    requestAnimationFrame(() => {
      disChartsRef.drawMultiChart(reportEl.querySelector("#dc_soc_current"), m.r, [{ key: "Level", unit: "%" }, { key: "Ibat", unit: "mA" }]);
      disChartsRef.drawMultiChart(reportEl.querySelector("#dc_voltage_current"), m.r, [{ key: "Vbat", unit: "mV" }, { key: "Ibat", unit: "mA" }]);
      disChartsRef.drawMultiChart(reportEl.querySelector("#dc_temp_current"), m.r, [{ key: "Tbat", unit: "℃" }, { key: "Ibat", unit: "mA" }]);
      disChartsRef.drawMultiChart(reportEl.querySelector("#dc_soc_voltage"), m.r, [{ key: "Level", unit: "%" }, { key: "Vbat", unit: "mV" }]);
      reportEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  buildDischargeReportHtml(m) {
    const kpi = (icon, label, val) => `
      <div class="tw-chg-kpi">
        <div class="tw-chg-kpi-icon">${icon}</div>
        <div>
          <div class="tw-chg-kpi-label">${label}</div>
          <div class="tw-chg-kpi-value">${val}</div>
        </div>
      </div>
    `;

    const lb = m.lowBattery || {};
    const low = lb.low20 || {};
    const tail = lb.final5Min || {};
    const last = lb.last5Soc || {};

    const rangeRows = m.ranges.map(x => `
      <tr>
        <td><b>${x.range}</b></td>
        <td>${Number.isFinite(x.duration) ? (x.duration / 60).toFixed(2) + " h" : "-"}</td>
        <td>${disCalcRef.fmtNum(x.minPerPct, 1)} min/%</td>
        <td>${disCalcRef.fmtNum(x.avgCurrent, 0)} mA</td>
        <td>${disCalcRef.fmtNum(x.capacityMah, 0)} mAh</td>
        <td>${disCalcRef.fmtNum(x.mahPerPct, 1)} mAh/%</td>
        <td>${Number.isFinite(x.startV) && Number.isFinite(x.endV) ? x.startV.toFixed(0) + "→" + x.endV.toFixed(0) + " mV" : "-"}</td>
        <td>${disCalcRef.fmtNum(x.mvPerPct, 1)} mV/%</td>
        <td>${disCalcRef.fmtNum(x.energyWh, 2)} Wh</td>
        <td><span class="tw-chg-badge tw-chg-badge-${x.statusClass || 'good'}">${x.status}</span></td>
      </tr>
    `).join("");

    return `
      <div class="tw-chg-report-title">
        <h3>单文件放电分析报告</h3>
        <span class="tw-chg-badge tw-chg-badge-info">放电时长: ${(m.duration / 60).toFixed(2)} h</span>
      </div>

      <div class="tw-chg-kpis">
        ${kpi("⏱️", "放电时长", (m.duration / 60).toFixed(2) + " h")}
        ${kpi("🔋", "放电容量", (m.mah / 1000).toFixed(3) + " Ah")}
        ${kpi("⚡", "放电能量", m.wh.toFixed(2) + " Wh")}
        ${kpi("📉", "平均/峰值电流", disCalcRef.fmtNum(m.avgI, 0) + " / " + disCalcRef.fmtNum(m.peakI, 0) + " mA")}
        ${kpi("🔌", "电压范围", m.volt[0] + " ~ " + m.volt[1] + " mV")}
      </div>

      <div class="tw-chg-grid tw-chg-grid-2">
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">电量变化 + 放电电流 (含滤波)</div>
          <div class="tw-chg-chart-box"><canvas id="dc_soc_current"></canvas></div>
        </div>
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">电压变化 + 放电电流</div>
          <div class="tw-chg-chart-box"><canvas id="dc_voltage_current"></canvas></div>
        </div>
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">温度变化 + 放电电流</div>
          <div class="tw-chg-chart-box"><canvas id="dc_temp_current"></canvas></div>
        </div>
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">电量-电压对应曲线 (OVC 特性)</div>
          <div class="tw-chg-chart-box"><canvas id="dc_soc_voltage"></canvas></div>
        </div>
      </div>

      <div class="tw-chg-section" style="margin-top:14px">
        <div class="tw-chg-section-head"><h3>SOC 区间精细分析表</h3></div>
        <div class="tw-chg-section-body">
          <div class="tw-chg-table-wrap">
            <table>
              <thead><tr><th>区间</th><th>时长</th><th>速率</th><th>平均电流</th><th>放出容量</th><th>容量斜率</th><th>电压起止</th><th>压降斜率</th><th>放出能量</th><th>状态</th></tr></thead>
              <tbody>${rangeRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="tw-chg-section">
        <div class="tw-chg-section-head"><h3>20% 以下低电量专项诊断</h3></div>
        <div class="tw-chg-section-body">
          <div class="tw-chg-kpis">
            ${kpi("🪫", "关机电量", Number.isFinite(lb.shutdownSoc) ? lb.shutdownSoc.toFixed(1) + "%" : "-")}
            ${kpi("⏱️", "20%→关机时长", Number.isFinite(low.duration) ? (low.duration / 60).toFixed(2) + " h" : "-")}
            ${kpi("🔋", "20%以下容量", disCalcRef.fmtNum(low.mah, 0) + " mAh")}
            ${kpi("🔌", "关机最低电压", disCalcRef.fmtNum(low.minV, 0) + " mV")}
            ${kpi("📉", "最后5分钟压降", Number.isFinite(tail.avgV) ? tail.avgV.toFixed(0) + " mV" : "-")}
          </div>
        </div>
      </div>
    `;
  }

  generateCompareReport() {
    if (!this.state.compareA || !this.state.compareB) return;
    const a = disCalcRef.dischargeAnalyze(this.state.compareA);
    const b = disCalcRef.dischargeAnalyze(this.state.compareB);
    this.state.compareMetricsA = a;
    this.state.compareMetricsB = b;

    const reportEl = this.containerEl.querySelector("#dcCompareReport");
    reportEl.innerHTML = this.buildDischargeCompareHtml(a, b);
    reportEl.classList.add("show");

    this.containerEl.querySelector("#dcCompareSaveVault").disabled = false;
    this.containerEl.querySelector("#dcCompareAgentDiag").disabled = false;

    requestAnimationFrame(() => {
      disChartsRef.drawDischargeCompareChart(reportEl.querySelector("#dcc_soc"), a.r, b.r, "Level", "%");
      disChartsRef.drawDischargeCompareChart(reportEl.querySelector("#dcc_voltage"), a.r, b.r, "Vbat", "mV");
      disChartsRef.drawDischargeCompareChart(reportEl.querySelector("#dcc_temp"), a.r, b.r, "Tbat", "℃");
      disChartsRef.drawDischargeCompareChart(reportEl.querySelector("#dcc_current"), a.r, b.r, "Ibat", "mA", true);
      reportEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  buildDischargeCompareHtml(a, b) {
    const kpi = (icon, label, val) => `
      <div class="tw-chg-kpi">
        <div class="tw-chg-kpi-icon">${icon}</div>
        <div>
          <div class="tw-chg-kpi-label">${label}</div>
          <div class="tw-chg-kpi-value">${val}</div>
        </div>
      </div>
    `;

    return `
      <div class="tw-chg-report-title">
        <h3>放电双文件对比报告</h3>
        <span class="tw-chg-badge tw-chg-badge-info">A vs B</span>
      </div>

      <div class="tw-chg-kpis">
        ${kpi("⏱️", "A 放电时长", (a.duration / 60).toFixed(2) + " h")}
        ${kpi("⏱️", "B 放电时长", (b.duration / 60).toFixed(2) + " h")}
        ${kpi("🔋", "A 放电容量", (a.mah / 1000).toFixed(3) + " Ah")}
        ${kpi("🔋", "B 放电容量", (b.mah / 1000).toFixed(3) + " Ah")}
        ${kpi("⚡", "容量差 (B - A)", (((b.mah - a.mah) / 1000) > 0 ? "+" : "") + ((b.mah - a.mah) / 1000).toFixed(3) + " Ah")}
      </div>

      <div class="tw-chg-grid tw-chg-grid-2">
        <div class="tw-chg-chart-card"><div class="tw-chg-chart-title">SOC 电量下降对比</div><div class="tw-chg-chart-box"><canvas id="dcc_soc"></canvas></div></div>
        <div class="tw-chg-chart-card"><div class="tw-chg-chart-title">电压放电曲线对比</div><div class="tw-chg-chart-box"><canvas id="dcc_voltage"></canvas></div></div>
        <div class="tw-chg-chart-card"><div class="tw-chg-chart-title">温度曲线对比</div><div class="tw-chg-chart-box"><canvas id="dcc_temp"></canvas></div></div>
        <div class="tw-chg-chart-card"><div class="tw-chg-chart-title">放电电流对比 (绝对值滤波)</div><div class="tw-chg-chart-box"><canvas id="dcc_current"></canvas></div></div>
      </div>
    `;
  }

  // Phase 3: 归档单文件放电报告
  async saveDischargeToVault() {
    const m = this.state.dischargeMetrics;
    if (!m) return;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const mdContent = `---
title: 电池放电深度分析报告_${dateStr}
version: v1.0
doctype: RPT
platform: COMMON
module: BAT
created: ${new Date().toISOString().slice(0, 10)}
status: completed
tags:
  - test/discharge
  - cert/power-test
---

# 电池放电深度分析报告

## 1. 放电核心指标
- **总放电时长**: ${(m.duration / 60).toFixed(2)} h (${m.duration.toFixed(0)} min)
- **放出容量**: ${(m.mah / 1000).toFixed(3)} Ah (${m.mah.toFixed(0)} mAh)
- **放出总能量**: ${m.wh.toFixed(2)} Wh
- **平均负载电流**: ${disCalcRef.fmtNum(m.avgI, 0)} mA, 峰值: ${disCalcRef.fmtNum(m.peakI, 0)} mA
- **工作电压范围**: ${m.volt[0]} mV ~ ${m.volt[1]} mV
- **工作温度范围**: ${m.temp[0]} ℃ ~ ${m.temp[1]} ℃

## 2. 20% 以下低电量专项
- **关机电量**: ${m.lowBattery.shutdownSoc.toFixed(1)} %
- **20% 至关机时长**: ${(m.lowBattery.low20.duration / 60).toFixed(2)} h
- **低电量最低工作电压**: ${disCalcRef.fmtNum(m.lowBattery.low20.minV, 0)} mV
- **最后 5 分钟平均电压**: ${disCalcRef.fmtNum(m.lowBattery.final5Min.avgV, 0)} mV

## 3. SOC 区间均匀性
| 区间 | 耗时 (h) | 平均电流 (mA) | 放出容量 (mAh) | 压降率 (mV/%) | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
${m.ranges.map(r => `| **${r.range}** | ${(r.duration / 60).toFixed(2)} | ${disCalcRef.fmtNum(r.avgCurrent, 0)} | ${disCalcRef.fmtNum(r.capacityMah, 0)} | ${disCalcRef.fmtNum(r.mvPerPct, 1)} | ${r.status} |`).join("\n")}
`;

    const fileName = `DischargeTest_${dateStr}_COMMON_BAT_RPT.md`;
    const relPath = `10-Test-Cert/03-Power-Test/${fileName}`;

    if (this.parent && typeof this.parent.saveMarkdownToVault === 'function') {
      await this.parent.saveMarkdownToVault(relPath, mdContent);
    }
  }

  diagnoseDischargeWithAgent() {
    const m = this.state.dischargeMetrics;
    if (!m) return;
    const prompt = `请对以下电池放电测试数据进行 Fuel Gauge (电量计) 算法与低电量续航诊断：
- 放电总容量: ${(m.mah / 1000).toFixed(3)} Ah (${m.mah.toFixed(0)} mAh), 放电时长: ${(m.duration / 60).toFixed(2)} h
- 关机电量: ${m.lowBattery.shutdownSoc.toFixed(1)} %, 关机最低电压: ${disCalcRef.fmtNum(m.lowBattery.low20.minV, 0)} mV
- 20%以下低电量区间: 放电时长 ${(m.lowBattery.low20.duration / 60).toFixed(2)}h, 最后5分钟均压: ${disCalcRef.fmtNum(m.lowBattery.final5Min.avgV, 0)}mV
- 异常区间标记: ${m.ranges.filter(r => r.statusClass !== 'good').map(r => `${r.range}(${r.status})`).join('; ') || '无'}
请评估是否存在关机掉电陡峭、关机电压截止门限偏高或 Fuel Gauge 查表曲率偏差，并给出驱动校准建议。`;

    if (this.parent && typeof this.parent.invokeAgentDiagnostics === 'function') {
      this.parent.invokeAgentDiagnostics("放电续航与电量计诊断", prompt);
    }
  }

  saveCompareToVault() {
    const a = this.state.compareMetricsA;
    const b = this.state.compareMetricsB;
    if (!a || !b) return;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const mdContent = `---
title: 放电双文件对比分析报告_${dateStr}
version: v1.0
doctype: RPT
platform: COMMON
module: BAT
created: ${new Date().toISOString().slice(0, 10)}
status: completed
---

# 放电双文件对比分析报告 (A vs B)

| 指标 | 数据 A | 数据 B | 差值 (B - A) |
| :--- | :--- | :--- | :--- |
| **放电时长** | ${(a.duration / 60).toFixed(2)} h | ${(b.duration / 60).toFixed(2)} h | ${((b.duration - a.duration) / 60).toFixed(2)} h |
| **放出容量** | ${(a.mah / 1000).toFixed(3)} Ah | ${(b.mah / 1000).toFixed(3)} Ah | ${((b.mah - a.mah) / 1000).toFixed(3)} Ah |
| **关机电量** | ${a.lowBattery.shutdownSoc.toFixed(1)} % | ${b.lowBattery.shutdownSoc.toFixed(1)} % | ${(b.lowBattery.shutdownSoc - a.lowBattery.shutdownSoc).toFixed(1)} pp |
`;

    const fileName = `DischargeCompare_${dateStr}_COMMON_BAT_RPT.md`;
    const relPath = `10-Test-Cert/03-Power-Test/${fileName}`;

    if (this.parent && typeof this.parent.saveMarkdownToVault === 'function') {
      this.parent.saveMarkdownToVault(relPath, mdContent);
    }
  }

  diagnoseCompareWithAgent() {
    const a = this.state.compareMetricsA;
    const b = this.state.compareMetricsB;
    if (!a || !b) return;
    const prompt = `请对 A、B 两台样机的放电续航数据进行一致性差异对比：
- 样机 A: 放电 ${(a.duration / 60).toFixed(2)}h, 放出容量 ${(a.mah / 1000).toFixed(3)}Ah, 关机电量 ${a.lowBattery.shutdownSoc.toFixed(1)}%
- 样机 B: 放电 ${(b.duration / 60).toFixed(2)}h, 放出容量 ${(b.mah / 1000).toFixed(3)}Ah, 关机电量 ${b.lowBattery.shutdownSoc.toFixed(1)}%
- 续航差值: ${((b.duration - a.duration) / 60).toFixed(2)}h, 容量差异: ${((b.mah - a.mah) / 1000).toFixed(3)}Ah
请结合功耗差异和电池老化内阻评估原因。`;

    if (this.parent && typeof this.parent.invokeAgentDiagnostics === 'function') {
      this.parent.invokeAgentDiagnostics("放电续航一致性诊断", prompt);
    }
  }

  resetDischarge() {
    this.state.discharge = null;
    this.state.dischargeMetrics = null;
    const el = this.containerEl;
    const fileEl = el.querySelector("#dischargeFile");
    if (fileEl) fileEl.value = "";
    const dropzone = el.querySelector("#dischargeDropzone");
    if (dropzone) dropzone.classList.remove("has-file");
    const st = el.querySelector("#dischargeStatus");
    if (st) {
      st.innerHTML = `
        <div class="tw-chg-drop-icon">${getDisIconPark('upload', 24)}</div>
        <div class="tw-chg-drop-label">点击或拖入放电日志 CSV</div>
        <div class="tw-chg-drop-hint">支持整机恒载/动态放电、内核电池记录仪日志</div>
      `;
    }
    el.querySelector("#dischargeGenerate").disabled = true;
    el.querySelector("#dischargeSaveVault").disabled = true;
    el.querySelector("#dischargeAgentDiag").disabled = true;
    const r = el.querySelector("#dcReport");
    r.classList.remove("show");
    r.innerHTML = "";
  }

  resetCompare() {
    this.state.compareA = null;
    this.state.compareB = null;
    this.state.compareMetricsA = null;
    this.state.compareMetricsB = null;
    const el = this.containerEl;
    const fA = el.querySelector("#dcCompareFileA");
    const fB = el.querySelector("#dcCompareFileB");
    if (fA) fA.value = "";
    if (fB) fB.value = "";
    const dropA = el.querySelector("#dcCompareDropzoneA");
    const dropB = el.querySelector("#dcCompareDropzoneB");
    if (dropA) dropA.classList.remove("has-file");
    if (dropB) dropB.classList.remove("has-file");
    const stA = el.querySelector("#dcCompareStatusA");
    const stB = el.querySelector("#dcCompareStatusB");
    if (stA) {
      stA.innerHTML = `
        <div class="tw-chg-drop-icon">${getDisIconPark('upload', 20)}</div>
        <div class="tw-chg-drop-label">点击或拖入放电日志 (A)</div>
      `;
    }
    if (stB) {
      stB.innerHTML = `
        <div class="tw-chg-drop-icon">${getDisIconPark('upload', 20)}</div>
        <div class="tw-chg-drop-label">点击或拖入放电日志 (B)</div>
      `;
    }
    el.querySelector("#dcCompareGenerate").disabled = true;
    el.querySelector("#dcCompareSaveVault").disabled = true;
    el.querySelector("#dcCompareAgentDiag").disabled = true;
    const r = el.querySelector("#dcCompareReport");
    r.classList.remove("show");
    r.innerHTML = "";
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DischargePanel };
}
