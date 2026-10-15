/* ==========================================================================
   ChargePanel — 充电数据分析面板 (单文件/双文件精细评估、8大功率达标判定、图表与归档)
   ========================================================================== */

let chgCalcRef = typeof parseCSV === 'function' ? { esc, fmtNum, fmtMin, fmtClock, parseCSV, validateSummary, analyze } : null;
if (!chgCalcRef) {
  try {
    chgCalcRef = require('./charger-calc.js');
  } catch (_) {
    chgCalcRef = {
      esc: typeof esc === 'function' ? esc : v => String(v ?? ""),
      fmtNum: typeof fmtNum === 'function' ? fmtNum : (v, d = 2) => Number(v).toFixed(d),
      fmtMin: typeof fmtMin === 'function' ? fmtMin : v => String(v),
      fmtClock: typeof fmtClock === 'function' ? fmtClock : v => String(v),
      parseCSV: typeof parseCSV === 'function' ? parseCSV : () => ({ rows: [] }),
      validateSummary: typeof validateSummary === 'function' ? validateSummary : () => "",
      analyze: typeof analyze === 'function' ? analyze : () => ({})
    };
  }
}

let chgPwrStdRef = typeof POWER_STD !== 'undefined' ? { POWER_STD, standardJudge, badge } : null;
if (!chgPwrStdRef) {
  try {
    chgPwrStdRef = require('./power-standards.js');
  } catch (_) {
    chgPwrStdRef = {
      POWER_STD: typeof POWER_STD !== 'undefined' ? POWER_STD : {},
      standardJudge: typeof standardJudge === 'function' ? standardJudge : () => ({ configured: false }),
      badge: typeof badge === 'function' ? badge : () => ""
    };
  }
}

let chgChartsRef = typeof drawSingleCharts === 'function' ? { drawSingleCharts, drawCompareCharts } : null;
if (!chgChartsRef) {
  try {
    chgChartsRef = require('./charger-charts.js');
  } catch (_) {
    chgChartsRef = {
      drawSingleCharts: typeof drawSingleCharts === 'function' ? drawSingleCharts : () => {},
      drawCompareCharts: typeof drawCompareCharts === 'function' ? drawCompareCharts : () => {}
    };
  }
}

let getChgIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!getChgIconPark) {
  try {
    getChgIconPark = require('../../ui/iconpark.js').getIconPark;
  } catch (_) {
    getChgIconPark = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

class ChargePanel {
  constructor(options = {}) {
    this.parent = options.parent || null;
    this.containerEl = null;
    this.state = {
      single: null,
      singleMetrics: null,
      compareA: null,
      compareB: null,
      compareMetricsA: null,
      compareMetricsB: null
    };
  }

  mount(parentEl) {
    this.containerEl = parentEl.createDiv({ cls: 'tw-chg-page-panel active' });
    this.render();
  }

  render() {
    this.containerEl.innerHTML = `
      <!-- 1. 单文件充电分析卡片 -->
      <div class="tw-chg-card">
        <div class="tw-chg-card-head">
          <div class="tw-chg-card-title">
            <span class="tw-chg-card-title-icon">${getChgIconPark('chart-line', 14)}</span>
            <span>单文件充电深度分析</span>
          </div>
          <div class="tw-chg-card-meta">
            <span class="tw-chg-pill-tag">8大功率标准评估</span>
          </div>
        </div>
        <div class="tw-chg-card-body">
          <div class="tw-chg-upload-params-grid">
            <!-- 拖拽上传区 -->
            <div class="tw-chg-dropzone" id="singleDropzone">
              <input id="singleFile" type="file" accept=".csv,text/csv" class="tw-chg-hidden-file-input">
              <div id="singleFileStatus" class="tw-chg-dropzone-content">
                <div class="tw-chg-drop-icon">${getChgIconPark('upload', 24)}</div>
                <div class="tw-chg-drop-label">点击或拖入充电 CSV 日志</div>
                <div class="tw-chg-drop-hint">支持 Power-Z KM003C、电池分析仪、内核驱动日志</div>
              </div>
            </div>

            <!-- 参数配置区 -->
            <div class="tw-chg-config-col">
              <div class="tw-chg-field-row">
                <label class="tw-chg-field-label">充电功率档位</label>
                <select id="singlePower" class="tw-chg-field-select"></select>
              </div>
              <div class="tw-chg-field-row">
                <label class="tw-chg-field-label">电池容量 (mAh, 可选)</label>
                <input id="singleCapacity" type="number" min="1" step="1" class="tw-chg-field-input" placeholder="例如 5000">
              </div>
              <div class="tw-chg-field-hint">容量用于公司充电达标时间判定，不输入也可生成完整分析报告</div>
            </div>
          </div>

          <!-- 校验信息 -->
          <div id="singleValidation"></div>

          <!-- 操作按钮栏 -->
          <div class="tw-chg-btn-bar">
            <button id="singleGenerate" class="tw-chg-btn tw-chg-btn-primary" disabled>
              ${getChgIconPark('lightning', 13)}<span>生成分析报告</span>
            </button>
            <button id="singleExport" class="tw-chg-btn" disabled>
              ${getChgIconPark('download', 13)}<span>导出 CSV</span>
            </button>
            <button id="singleSaveVault" class="tw-chg-btn tw-chg-btn-vault" disabled title="生成标准 Markdown 归档至 10-Test-Cert/03-Power-Test/">
              ${getChgIconPark('folder-download', 13)}<span>归档到知识库</span>
            </button>
            <button id="singleAgentDiag" class="tw-chg-btn tw-chg-btn-agent" disabled title="提取当前时序特征推送到 Agent Hub 进行 AI 智能诊断">
              ${getChgIconPark('robot', 13)}<span>呼叫 Agent 诊断</span>
            </button>
            <button id="singleReset" class="tw-chg-btn tw-chg-btn-ghost">
              ${getChgIconPark('refresh', 13)}<span>重置</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. 双文件对比卡片 -->
      <div class="tw-chg-card" style="margin-top:14px">
        <div class="tw-chg-card-head">
          <div class="tw-chg-card-title">
            <span class="tw-chg-card-title-icon">${getChgIconPark('balance', 14)}</span>
            <span>双文件 A / B 对比分析</span>
          </div>
          <div class="tw-chg-card-meta">
            <span class="tw-chg-pill-tag">固件/硬件差异评估</span>
          </div>
        </div>
        <div class="tw-chg-card-body">
          <div class="tw-chg-dual-dropzone-grid">
            <!-- File A -->
            <div class="tw-chg-drop-col">
              <div class="tw-chg-drop-title">数据 A (基准机 / 修改前)</div>
              <div class="tw-chg-dropzone" id="compareDropzoneA">
                <input id="compareFileA" type="file" accept=".csv,text/csv" class="tw-chg-hidden-file-input">
                <div id="compareStatusA" class="tw-chg-dropzone-content">
                  <div class="tw-chg-drop-icon">${getChgIconPark('upload', 20)}</div>
                  <div class="tw-chg-drop-label">点击或拖入基准日志 (A)</div>
                </div>
              </div>
            </div>
            <!-- File B -->
            <div class="tw-chg-drop-col">
              <div class="tw-chg-drop-title">数据 B (对照机 / 修改后)</div>
              <div class="tw-chg-dropzone" id="compareDropzoneB">
                <input id="compareFileB" type="file" accept=".csv,text/csv" class="tw-chg-hidden-file-input">
                <div id="compareStatusB" class="tw-chg-dropzone-content">
                  <div class="tw-chg-drop-icon">${getChgIconPark('upload', 20)}</div>
                  <div class="tw-chg-drop-label">点击或拖入对照日志 (B)</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 对比参数 -->
          <div class="tw-chg-params-row" style="margin-top:12px">
            <div class="tw-chg-field-row">
              <label class="tw-chg-field-label">充电功率档位</label>
              <select id="comparePower" class="tw-chg-field-select"></select>
            </div>
            <div class="tw-chg-field-row">
              <label class="tw-chg-field-label">电池容量 (mAh, 可选)</label>
              <input id="compareCapacity" type="number" min="1" step="1" class="tw-chg-field-input" placeholder="例如 5000">
            </div>
          </div>

          <!-- 对比操作栏 -->
          <div class="tw-chg-btn-bar">
            <button id="compareGenerate" class="tw-chg-btn tw-chg-btn-primary" disabled>
              ${getChgIconPark('lightning', 13)}<span>生成对比报告</span>
            </button>
            <button id="compareSaveVault" class="tw-chg-btn tw-chg-btn-vault" disabled title="归档对比报告到 10-Test-Cert/03-Power-Test/">
              ${getChgIconPark('folder-download', 13)}<span>归档对比报告</span>
            </button>
            <button id="compareAgentDiag" class="tw-chg-btn tw-chg-btn-agent" disabled title="呼叫 Agent 进行 A/B 差异评估">
              ${getChgIconPark('robot', 13)}<span>呼叫 Agent 诊断</span>
            </button>
            <button id="compareReset" class="tw-chg-btn tw-chg-btn-ghost">
              ${getChgIconPark('refresh', 13)}<span>重置对比</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 报告呈现区域 -->
      <div id="singleReport" class="tw-chg-report"></div>
      <div id="compareReport" class="tw-chg-report"></div>
    `;

    this.initEvents();
  }

  initEvents() {
    const el = this.containerEl;
    const stds = chgPwrStdRef.POWER_STD || {};
    const optsHtml = Object.keys(stds).map(k => `<option value="${k}" ${k === "18" ? "selected" : ""}>${stds[k].label || k + "W"}</option>`).join("");

    const sPwr = el.querySelector("#singlePower");
    const cPwr = el.querySelector("#comparePower");
    if (sPwr) sPwr.innerHTML = optsHtml;
    if (cPwr) cPwr.innerHTML = optsHtml;

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

    // 1. 单文件拖拽与选择
    const sDropzone = el.querySelector("#singleDropzone");
    const sFile = el.querySelector("#singleFile");
    const sStatus = el.querySelector("#singleFileStatus");
    const sGenBtn = el.querySelector("#singleGenerate");
    const sValBox = el.querySelector("#singleValidation");

    bindDropzoneEvents(sDropzone, sFile, async (file) => {
      try {
        const content = await file.text();
        this.state.single = chgCalcRef.parseCSV(content);
        sDropzone.classList.add("has-file");
        sStatus.innerHTML = `
          <div class="tw-chg-file-card">
            <div class="tw-chg-file-card-icon">${getChgIconPark('file-csv', 22)}</div>
            <div class="tw-chg-file-card-info">
              <div class="tw-chg-file-card-name">${file.name}</div>
              <div class="tw-chg-file-card-meta">${(file.size / 1024).toFixed(1)} KB · <span class="tw-chg-text-success">✓ ${this.state.single.rows.length} 行数据已校验</span></div>
            </div>
            <button class="tw-chg-file-card-change" type="button">更换</button>
          </div>
        `;
        if (sValBox) sValBox.innerHTML = chgCalcRef.validateSummary(this.state.single);
        if (sGenBtn) sGenBtn.disabled = false;
      } catch (err) {
        sDropzone.classList.remove("has-file");
        sStatus.innerHTML = `
          <div class="tw-chg-file-card error">
            <div class="tw-chg-file-card-icon">${getChgIconPark('alert', 22)}</div>
            <div class="tw-chg-file-card-info">
              <div class="tw-chg-file-card-name">${file.name}</div>
              <div class="tw-chg-file-card-meta"><span class="tw-chg-text-error">✗ ${chgCalcRef.esc(err.message)}</span></div>
            </div>
            <button class="tw-chg-file-card-change" type="button">重选</button>
          </div>
        `;
        if (sValBox) sValBox.innerHTML = "";
        if (sGenBtn) sGenBtn.disabled = true;
      }
    });

    if (sGenBtn) {
      sGenBtn.addEventListener("click", () => this.generateSingleReport());
    }

    const sExportBtn = el.querySelector("#singleExport");
    if (sExportBtn) {
      sExportBtn.addEventListener("click", () => this.exportSingleCSV());
    }

    const sSaveVaultBtn = el.querySelector("#singleSaveVault");
    if (sSaveVaultBtn) {
      sSaveVaultBtn.addEventListener("click", () => this.saveSingleToVault());
    }

    const sAgentDiagBtn = el.querySelector("#singleAgentDiag");
    if (sAgentDiagBtn) {
      sAgentDiagBtn.addEventListener("click", () => this.diagnoseSingleWithAgent());
    }

    const sResetBtn = el.querySelector("#singleReset");
    if (sResetBtn) {
      sResetBtn.addEventListener("click", () => this.resetSingle());
    }

    // 2. 双文件对比拖拽与选择
    const initCmpDrop = (dropId, fileId, statusId, key, label) => {
      const dropEl = el.querySelector("#" + dropId);
      const fileEl = el.querySelector("#" + fileId);
      const stEl = el.querySelector("#" + statusId);
      if (!dropEl || !fileEl) return;

      bindDropzoneEvents(dropEl, fileEl, async (f) => {
        try {
          const txt = await f.text();
          this.state[key] = chgCalcRef.parseCSV(txt);
          dropEl.classList.add("has-file");
          stEl.innerHTML = `
            <div class="tw-chg-file-card">
              <div class="tw-chg-file-card-icon">${getChgIconPark('file-csv', 20)}</div>
              <div class="tw-chg-file-card-info">
                <div class="tw-chg-file-card-name">${f.name}</div>
                <div class="tw-chg-file-card-meta">${(f.size / 1024).toFixed(1)} KB · <span class="tw-chg-text-success">✓ ${this.state[key].rows.length} 行通过</span></div>
              </div>
              <button class="tw-chg-file-card-change" type="button">更换</button>
            </div>
          `;
        } catch (err) {
          dropEl.classList.remove("has-file");
          stEl.innerHTML = `
            <div class="tw-chg-file-card error">
              <div class="tw-chg-file-card-icon">${getChgIconPark('alert', 20)}</div>
              <div class="tw-chg-file-card-info">
                <div class="tw-chg-file-card-name">${f.name}</div>
                <div class="tw-chg-file-card-meta"><span class="tw-chg-text-error">✗ ${chgCalcRef.esc(err.message)}</span></div>
              </div>
              <button class="tw-chg-file-card-change" type="button">重选</button>
            </div>
          `;
          this.state[key] = null;
        }
        const cmpGen = el.querySelector("#compareGenerate");
        if (cmpGen) cmpGen.disabled = !(this.state.compareA && this.state.compareB);
      });
    };

    initCmpDrop("compareDropzoneA", "compareFileA", "compareStatusA", "compareA", "A");
    initCmpDrop("compareDropzoneB", "compareFileB", "compareStatusB", "compareB", "B");

    const cmpGenBtn = el.querySelector("#compareGenerate");
    if (cmpGenBtn) {
      cmpGenBtn.addEventListener("click", () => this.generateCompareReport());
    }

    const cmpSaveVaultBtn = el.querySelector("#compareSaveVault");
    if (cmpSaveVaultBtn) {
      cmpSaveVaultBtn.addEventListener("click", () => this.saveCompareToVault());
    }

    const cmpAgentDiagBtn = el.querySelector("#compareAgentDiag");
    if (cmpAgentDiagBtn) {
      cmpAgentDiagBtn.addEventListener("click", () => this.diagnoseCompareWithAgent());
    }

    const cmpResetBtn = el.querySelector("#compareReset");
    if (cmpResetBtn) {
      cmpResetBtn.addEventListener("click", () => this.resetCompare());
    }
  }

  // 注入数据 (支持从 Power-Z 实时注入)
  injectSamples(samples) {
    if (!samples || !samples.length) return;
    const lines = ["Time,Level,Vbat,Ibat,Tbat,Status"];
    const baseTime = samples[0].time;
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const elapsedMin = ((p.time - baseTime) / 60);
      const soc = Math.min(100, Math.max(1, Math.round(10 + (i / samples.length) * 85)));
      const vbatMv = Math.round(p.vbus * 450);
      const ibatMa = Math.round(p.ibus * 1000);
      const status = (i === samples.length - 1 && ibatMa < 100) ? "Full" : "Charging";
      lines.push(`${elapsedMin.toFixed(2)},${soc},${vbatMv},${ibatMa},${Math.round(p.temp)},${status}`);
    }
    const csvText = lines.join("\n");
    this.state.single = chgCalcRef.parseCSV(csvText);

    const sStatus = this.containerEl.querySelector("#singleFileStatus");
    if (sStatus) sStatus.innerHTML = `<span style="color:#08784f">✓ 从 Power-Z 实时注入 ${this.state.single.rows.length} 组采样点</span>`;

    const sGenBtn = this.containerEl.querySelector("#singleGenerate");
    if (sGenBtn) {
      sGenBtn.disabled = false;
      sGenBtn.click();
    }
  }

  generateSingleReport() {
    if (!this.state.single) return;
    const el = this.containerEl;
    const power = el.querySelector("#singlePower").value;
    const cap = el.querySelector("#singleCapacity").value;
    const m = chgCalcRef.analyze(this.state.single);
    this.state.singleMetrics = m;
    const judge = chgPwrStdRef.standardJudge(m, power, cap);

    const reportEl = el.querySelector("#singleReport");
    reportEl.innerHTML = this.buildSingleReportHtml(m, judge, power, cap);
    reportEl.classList.add("show");

    el.querySelector("#singleExport").disabled = false;
    el.querySelector("#singleSaveVault").disabled = false;
    el.querySelector("#singleAgentDiag").disabled = false;

    requestAnimationFrame(() => {
      chgChartsRef.drawSingleCharts(reportEl, m);
      reportEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  buildSingleReportHtml(m, judge, power, cap) {
    const kpi = (icon, label, val, note = "") => `
      <div class="tw-chg-kpi">
        <div class="tw-chg-kpi-icon">${icon}</div>
        <div>
          <div class="tw-chg-kpi-label">${label}</div>
          <div class="tw-chg-kpi-value">${val}</div>
          ${note ? `<div class="tw-chg-kpi-note">${note}</div>` : ""}
        </div>
      </div>
    `;

    const reportTable = `
      <div class="tw-chg-table-wrap">
        <table>
          <thead><tr><th>关键指标</th><th>测试结果</th><th>明细与时刻</th></tr></thead>
          <tbody>
            <tr><td>起始时间</td><td>${chgCalcRef.fmtClock(m.start.time)}</td><td>起始电量 ${m.start.Level}% · 电压 ${m.start.Vbat}mV</td></tr>
            <tr><td>50% 充电时间</td><td>${chgCalcRef.fmtMin(m.t50)}</td><td>${m.p50 ? chgCalcRef.fmtClock(m.p50.time) : "—"}</td></tr>
            <tr><td>80% 充电时间</td><td>${chgCalcRef.fmtMin(m.t80)}</td><td>${m.p80 ? chgCalcRef.fmtClock(m.p80.time) : "—"}</td></tr>
            <tr><td>100% 报百时间</td><td>${chgCalcRef.fmtMin(m.t100)}</td><td>${m.p100 ? chgCalcRef.fmtClock(m.p100.time) : "—"}</td></tr>
            <tr><td>完整充电截止</td><td>${chgCalcRef.fmtMin(m.tFull)}</td><td>${m.full ? `首次 Full: ${chgCalcRef.fmtClock(m.full.time)}` : "未发现 Full 状态"}</td></tr>
            <tr><td>截止电流</td><td>${Number.isFinite(m.cutoffI) ? chgCalcRef.fmtNum(m.cutoffI, 0) + " mA" : "—"}</td><td>${m.prevCharging ? `截止前 Charging: ${chgCalcRef.fmtClock(m.prevCharging.time)}` : "—"}</td></tr>
            <tr><td>充入容量与能量</td><td>${m.ah.toFixed(3)} Ah · ${m.wh.toFixed(2)} Wh</td><td>平均电流 ${chgCalcRef.fmtNum(m.avgI, 0)} mA · 峰值 ${chgCalcRef.fmtNum(m.peakI, 0)} mA</td></tr>
            <tr><td>电压与最高温度</td><td>${m.start.Vbat} → ${chgCalcRef.fmtNum(m.fullV || m.peakV, 0)} mV</td><td>峰值电压 ${chgCalcRef.fmtNum(m.peakV, 0)} mV · 最高温度 <b>${chgCalcRef.fmtNum(m.maxT, 1)} ℃</b></td></tr>
          </tbody>
        </table>
      </div>
    `;

    const stageTable = `
      <div class="tw-chg-table-wrap">
        <table>
          <thead><tr><th>SOC 区间</th><th>耗时</th><th>平均电流</th><th>平均电压</th><th>平均温度</th><th>最高温度</th></tr></thead>
          <tbody>
            ${m.stages.map(s => `<tr><td><b>${s.range}</b></td><td>${chgCalcRef.fmtMin(s.duration)}</td><td>${chgCalcRef.fmtNum(s.avgI, 0)} mA</td><td>${chgCalcRef.fmtNum(s.avgV, 0)} mV</td><td>${chgCalcRef.fmtNum(s.avgT, 1)} ℃</td><td>${chgCalcRef.fmtNum(s.maxT, 1)} ℃</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;

    return `
      <div class="tw-chg-report-title">
        <h3>充电单文件深度分析报告</h3>
        <span class="tw-chg-badge tw-chg-badge-info">${power}W 档位</span>
      </div>

      <div class="tw-chg-kpis">
        ${kpi("⏱️", "报百时间", chgCalcRef.fmtMin(m.t100), judge.configured ? `标准: ${chgCalcRef.fmtMin(judge.reportLimit)}` : "")}
        ${kpi("🎯", "报百达标", judge.configured ? chgPwrStdRef.badge(judge.reportPass) : "未配置容量")}
        ${kpi("✅", "Full 截止", chgCalcRef.fmtMin(m.tFull), judge.configured ? `标准: ${chgCalcRef.fmtMin(judge.fullLimit)}` : "")}
        ${kpi("🔋", "充入容量", m.ah.toFixed(3) + " Ah", `${(m.ah * 1000).toFixed(0)} mAh`)}
        ${kpi("🌡️", "最高温度", chgCalcRef.fmtNum(m.maxT, 1) + " ℃", m.maxT >= 45 ? "温升预警" : "正常")}
      </div>

      <div class="tw-chg-grid tw-chg-grid-2">
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">电量与电流变化曲线</div>
          <div class="tw-chg-chart-box"><canvas id="chargeChart"></canvas></div>
        </div>
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">温度与电压变化曲线</div>
          <div class="tw-chg-chart-box"><canvas id="tempChart"></canvas></div>
        </div>
      </div>

      <div class="tw-chg-section" style="margin-top:14px">
        <div class="tw-chg-section-head"><h3>关键指标总表</h3></div>
        <div class="tw-chg-section-body">${reportTable}</div>
      </div>

      <div class="tw-chg-section">
        <div class="tw-chg-section-head"><h3>SOC 分段区间细化</h3></div>
        <div class="tw-chg-section-body">${stageTable}</div>
      </div>
    `;
  }

  generateCompareReport() {
    if (!this.state.compareA || !this.state.compareB) return;
    const el = this.containerEl;
    const power = el.querySelector("#comparePower").value;
    const cap = el.querySelector("#compareCapacity").value;
    const a = chgCalcRef.analyze(this.state.compareA);
    const b = chgCalcRef.analyze(this.state.compareB);
    this.state.compareMetricsA = a;
    this.state.compareMetricsB = b;

    const reportEl = el.querySelector("#compareReport");
    reportEl.innerHTML = this.buildCompareReportHtml(a, b, power, cap);
    reportEl.classList.add("show");

    el.querySelector("#compareSaveVault").disabled = false;
    el.querySelector("#compareAgentDiag").disabled = false;

    requestAnimationFrame(() => {
      chgChartsRef.drawCompareCharts(reportEl, a, b);
      reportEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  buildCompareReportHtml(a, b, power, cap) {
    const kpi = (icon, label, val) => `
      <div class="tw-chg-kpi">
        <div class="tw-chg-kpi-icon">${icon}</div>
        <div>
          <div class="tw-chg-kpi-label">${label}</div>
          <div class="tw-chg-kpi-value">${val}</div>
        </div>
      </div>
    `;

    const metrics = [
      ["50% 时间", "t50", "min", a.t50, b.t50],
      ["80% 时间", "t80", "min", a.t80, b.t80],
      ["100% 报百时间", "t100", "min", a.t100, b.t100],
      ["Full 截止时间", "tFull", "min", a.tFull, b.tFull],
      ["充入容量", "ah", "Ah", a.ah, b.ah],
      ["充入能量", "wh", "Wh", a.wh, b.wh],
      ["平均电流", "avgI", "mA", a.avgI, b.avgI],
      ["峰值电流", "peakI", "mA", a.peakI, b.peakI],
      ["最高温度", "maxT", "℃", a.maxT, b.maxT]
    ];

    const trs = metrics.map(([name, k, u, av, bv]) => {
      const diff = (Number.isFinite(av) && Number.isFinite(bv)) ? bv - av : NaN;
      let verdict = "—";
      if (Number.isFinite(diff)) {
        if (["t50", "t80", "t100", "tFull", "maxT"].includes(k)) {
          verdict = diff < 0 ? "<b style='color:#08784f'>B 优于 A</b>" : diff > 0 ? "<b style='color:#b32b32'>A 优于 B</b>" : "相当";
        } else {
          verdict = diff > 0 ? "+ " + chgCalcRef.fmtNum(diff, 2) : chgCalcRef.fmtNum(diff, 2);
        }
      }
      return `
        <tr>
          <td><b>${name}</b></td>
          <td>${chgCalcRef.fmtNum(av, 2)} ${u}</td>
          <td>${chgCalcRef.fmtNum(bv, 2)} ${u}</td>
          <td>${Number.isFinite(diff) ? (diff > 0 ? "+" : "") + chgCalcRef.fmtNum(diff, 2) + " " + u : "—"}</td>
          <td>${verdict}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="tw-chg-report-title">
        <h3>双文件充电对比报告</h3>
        <span class="tw-chg-badge tw-chg-badge-info">A vs B</span>
      </div>

      <div class="tw-chg-kpis">
        ${kpi("⏱️", "A 报百", chgCalcRef.fmtMin(a.t100))}
        ${kpi("⏱️", "B 报百", chgCalcRef.fmtMin(b.t100))}
        ${kpi("✅", "A Full", chgCalcRef.fmtMin(a.tFull))}
        ${kpi("✅", "B Full", chgCalcRef.fmtMin(b.tFull))}
        ${kpi("🌡️", "最高温差", (b.maxT - a.maxT > 0 ? "+" : "") + chgCalcRef.fmtNum(b.maxT - a.maxT, 1) + " ℃")}
      </div>

      <div class="tw-chg-grid tw-chg-grid-2">
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">充电电流对比 (A vs B)</div>
          <div class="tw-chg-chart-box"><canvas id="cmpCurrent"></canvas></div>
        </div>
        <div class="tw-chg-chart-card">
          <div class="tw-chg-chart-title">温度曲线对比 (A vs B)</div>
          <div class="tw-chg-chart-box"><canvas id="cmpTemp"></canvas></div>
        </div>
      </div>

      <div class="tw-chg-section" style="margin-top:14px">
        <div class="tw-chg-section-head"><h3>关键指标对比总表</h3></div>
        <div class="tw-chg-section-body">
          <div class="tw-chg-table-wrap">
            <table>
              <thead><tr><th>指标</th><th>数据 A</th><th>数据 B</th><th>差值 (B - A)</th><th>对比结论</th></tr></thead>
              <tbody>${trs}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // Phase 3: 一键归档到知识库 10-Test-Cert/03-Power-Test/
  async saveSingleToVault() {
    const m = this.state.singleMetrics;
    if (!m) return;
    const power = this.containerEl.querySelector("#singlePower").value;
    const cap = this.containerEl.querySelector("#singleCapacity").value || "5000";
    const judge = chgPwrStdRef.standardJudge(m, power, cap);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const mdContent = `---
title: 充电测试分析报告_${power}W_${dateStr}
version: v1.0
doctype: RPT
platform: COMMON
module: CHG
created: ${new Date().toISOString().slice(0, 10)}
status: completed
tags:
  - test/charging
  - power/${power}w
  - cert/power-test
---

# 充电测试分析报告 (${power}W 档位)

> **测试元数据**：测试时间 \`${chgCalcRef.fmtClock(m.start.time)}\`，采样点数 \`${m.win.length}\`，额定功率档位 \`${power}W\`，电池容量 \`${cap} mAh\`。

## 1. 核心判定与达标结论
| 关键指标 | 测试结果 | 达标判定标准 | 判定结论 |
| :--- | :--- | :--- | :--- |
| **报百时间 (t100)** | **${chgCalcRef.fmtMin(m.t100)}** | 上限: ${judge.configured ? chgCalcRef.fmtMin(judge.reportLimit) : "未设"} | **${judge.reportPass ? "✓ 达标" : "✗ 超标"}** |
| **完整截止 (tFull)** | **${chgCalcRef.fmtMin(m.tFull)}** | 上限: ${judge.configured ? chgCalcRef.fmtMin(judge.fullLimit) : "未设"} | **${judge.fullPass ? "✓ 达标" : "✗ 超标"}** |
| **最高温升** | **${chgCalcRef.fmtNum(m.maxT, 1)} ℃** | 工业安全阈值 45.0 ℃ | **${m.maxT < 45 ? "✓ 安全" : "⚠️ 温升偏高"}** |
| **充入总容量** | **${m.ah.toFixed(3)} Ah** (${(m.ah * 1000).toFixed(0)} mAh) | — | 充入充分 |
| **充入总能量** | **${m.wh.toFixed(2)} Wh** | — | — |

## 2. SOC 分段充电区间明细
| SOC 区间 | 耗时 (min) | 平均电流 (mA) | 平均电压 (mV) | 平均温度 (℃) | 最高温度 (℃) |
| :--- | :--- | :--- | :--- | :--- | :--- |
${m.stages.map(s => `| **${s.range}** | ${chgCalcRef.fmtMin(s.duration)} | ${chgCalcRef.fmtNum(s.avgI, 0)} | ${chgCalcRef.fmtNum(s.avgV, 0)} | ${chgCalcRef.fmtNum(s.avgT, 1)} | ${chgCalcRef.fmtNum(s.maxT, 1)} |`).join("\n")}

## 3. 测试工程备注
- 本报告由 TabonKB 研发工作台充电分析引擎原生生成并自动归档。
`;

    const fileName = `ChargeTest_${power}W_${dateStr}_COMMON_CHG_RPT.md`;
    const relPath = `10-Test-Cert/03-Power-Test/${fileName}`;

    if (this.parent && typeof this.parent.saveMarkdownToVault === 'function') {
      await this.parent.saveMarkdownToVault(relPath, mdContent);
    }
  }

  // Phase 3: 呼叫 Agent 诊断单文件
  diagnoseSingleWithAgent() {
    const m = this.state.singleMetrics;
    if (!m) return;
    const power = this.containerEl.querySelector("#singlePower").value;
    const cap = this.containerEl.querySelector("#singleCapacity").value || "5000";
    const judge = chgPwrStdRef.standardJudge(m, power, cap);

    const prompt = `请作为手机电池与充电驱动专家，对以下充电测试指标进行工程诊断并分析优化方向：
- 功率档位: ${power}W, 电池容量: ${cap}mAh
- 报百时间: ${chgCalcRef.fmtMin(m.t100)} (标准限制: ${chgCalcRef.fmtMin(judge.reportLimit)}), 判定: ${judge.reportPass ? "达标" : "超标"}
- 截止时间: ${chgCalcRef.fmtMin(m.tFull)} (截止电流: ${chgCalcRef.fmtNum(m.cutoffI, 0)}mA)
- 充入容量: ${(m.ah * 1000).toFixed(0)}mAh, 能量: ${m.wh.toFixed(2)}Wh
- 温度极值: 峰值 ${chgCalcRef.fmtNum(m.maxT, 1)}℃, 电流峰值 ${chgCalcRef.fmtNum(m.peakI, 0)}mA
- 区间特征: ${m.stages.slice(0, 4).map(s => `${s.range}:${chgCalcRef.fmtMin(s.duration)}`).join(', ')}
请重点诊断恒流(CC)/恒压(CV)阶段拐点是否合理，温控降额是否触发过早，并给出驱动层 (Fuel Gauge / Charger DTS) 的调优建议。`;

    if (this.parent && typeof this.parent.invokeAgentDiagnostics === 'function') {
      this.parent.invokeAgentDiagnostics("充电测试性能诊断", prompt);
    }
  }

  saveCompareToVault() {
    const a = this.state.compareMetricsA;
    const b = this.state.compareMetricsB;
    if (!a || !b) return;
    const power = this.containerEl.querySelector("#comparePower").value;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const mdContent = `---
title: 充电双文件对比分析报告_${power}W_${dateStr}
version: v1.0
doctype: RPT
platform: COMMON
module: CHG
created: ${new Date().toISOString().slice(0, 10)}
status: completed
tags:
  - test/charging-compare
  - power/${power}w
---

# 充电双文件对比分析报告 (A vs B)

| 指标 | 数据 A | 数据 B | 差值 (B - A) | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| **100% 报百时间** | ${chgCalcRef.fmtMin(a.t100)} | ${chgCalcRef.fmtMin(b.t100)} | ${chgCalcRef.fmtMin(b.t100 - a.t100)} | ${b.t100 < a.t100 ? "B 更快" : "A 更快"} |
| **完整充电截止** | ${chgCalcRef.fmtMin(a.tFull)} | ${chgCalcRef.fmtMin(b.tFull)} | — | — |
| **充入容量** | ${(a.ah * 1000).toFixed(0)} mAh | ${(b.ah * 1000).toFixed(0)} mAh | ${((b.ah - a.ah) * 1000).toFixed(0)} mAh | — |
| **最高温度** | ${chgCalcRef.fmtNum(a.maxT, 1)} ℃ | ${chgCalcRef.fmtNum(b.maxT, 1)} ℃ | ${(b.maxT - a.maxT > 0 ? "+" : "") + chgCalcRef.fmtNum(b.maxT - a.maxT, 1)} ℃ | ${b.maxT < a.maxT ? "B 温升表现优" : "A 温升表现优"} |
`;

    const fileName = `ChargeCompare_${power}W_${dateStr}_COMMON_CHG_RPT.md`;
    const relPath = `10-Test-Cert/03-Power-Test/${fileName}`;

    if (this.parent && typeof this.parent.saveMarkdownToVault === 'function') {
      this.parent.saveMarkdownToVault(relPath, mdContent);
    }
  }

  diagnoseCompareWithAgent() {
    const a = this.state.compareMetricsA;
    const b = this.state.compareMetricsB;
    if (!a || !b) return;

    const prompt = `请对两份样机的充电测试对比数据进行驱动和硬件一致性评估：
- 数据 A: 报百 ${chgCalcRef.fmtMin(a.t100)}, 截止 ${chgCalcRef.fmtMin(a.tFull)}, 最高温 ${chgCalcRef.fmtNum(a.maxT, 1)}℃, 容量 ${(a.ah * 1000).toFixed(0)}mAh
- 数据 B: 报百 ${chgCalcRef.fmtMin(b.t100)}, 截止 ${chgCalcRef.fmtMin(b.tFull)}, 最高温 ${chgCalcRef.fmtNum(b.maxT, 1)}℃, 容量 ${(b.ah * 1000).toFixed(0)}mAh
- 核心温差: ${(b.maxT - a.maxT).toFixed(1)}℃, 报百时差: ${(b.t100 - a.t100).toFixed(1)}min
请分析两台样机产生速度和温升差异的潜在原因（如电池内阻差异、充电IC热阻、线损补偿或限流门限不一致）。`;

    if (this.parent && typeof this.parent.invokeAgentDiagnostics === 'function') {
      this.parent.invokeAgentDiagnostics("充电对比性能诊断", prompt);
    }
  }

  exportSingleCSV() {
    const m = this.state.singleMetrics;
    if (!m) return;
    const lines = ["Time,Level,Vbat,Ibat,Tbat,Status"];
    m.win.forEach(r => lines.push(`${r.Time},${r.Level},${r.Vbat},${r.Ibat},${r.Tbat},${r.Status}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Charge_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  loadCsvText(csvText, fileName = "PowerZ_Stream.csv") {
    const el = this.containerEl;
    if (!el) return;
    const sDropzone = el.querySelector("#singleDropzone");
    const sStatus = el.querySelector("#singleFileStatus");
    const sGenBtn = el.querySelector("#singleGenerate");
    const sValBox = el.querySelector("#singleValidation");
    try {
      this.state.single = chgCalcRef.parseCSV(csvText);
      if (sDropzone) sDropzone.classList.add("has-file");
      if (sStatus) {
        sStatus.innerHTML = `
          <div class="tw-chg-file-card">
            <div class="tw-chg-file-card-icon">${getChgIconPark('lightning', 22)}</div>
            <div class="tw-chg-file-card-info">
              <div class="tw-chg-file-card-name">${fileName}</div>
              <div class="tw-chg-file-card-meta"><span class="tw-chg-text-success">✓ 实时数据流注入 · ${this.state.single.rows.length} 组采样点已校验</span></div>
            </div>
            <button class="tw-chg-file-card-change" type="button">更换</button>
          </div>
        `;
      }
      if (sValBox) sValBox.innerHTML = chgCalcRef.validateSummary(this.state.single);
      if (sGenBtn) {
        sGenBtn.disabled = false;
        this.generateSingleReport();
      }
    } catch (err) {
      if (sDropzone) sDropzone.classList.remove("has-file");
      if (sStatus) {
        sStatus.innerHTML = `
          <div class="tw-chg-file-card error">
            <div class="tw-chg-file-card-icon">${getChgIconPark('alert', 22)}</div>
            <div class="tw-chg-file-card-info">
              <div class="tw-chg-file-card-name">${fileName}</div>
              <div class="tw-chg-file-card-meta"><span class="tw-chg-text-error">✗ 导入失败: ${chgCalcRef.esc(err.message)}</span></div>
            </div>
            <button class="tw-chg-file-card-change" type="button">重试</button>
          </div>
        `;
      }
    }
  }

  resetSingle() {
    this.state.single = null;
    this.state.singleMetrics = null;
    const el = this.containerEl;
    const fileEl = el.querySelector("#singleFile");
    if (fileEl) fileEl.value = "";
    const sDropzone = el.querySelector("#singleDropzone");
    if (sDropzone) sDropzone.classList.remove("has-file");
    const sStatus = el.querySelector("#singleFileStatus");
    if (sStatus) {
      sStatus.innerHTML = `
        <div class="tw-chg-drop-icon">${getChgIconPark('upload', 24)}</div>
        <div class="tw-chg-drop-label">点击或拖入充电 CSV 日志</div>
        <div class="tw-chg-drop-hint">支持 Power-Z KM003C、电池分析仪、内核驱动日志</div>
      `;
    }
    const valBox = el.querySelector("#singleValidation");
    if (valBox) valBox.innerHTML = "";
    el.querySelector("#singleGenerate").disabled = true;
    el.querySelector("#singleExport").disabled = true;
    el.querySelector("#singleSaveVault").disabled = true;
    el.querySelector("#singleAgentDiag").disabled = true;
    const r = el.querySelector("#singleReport");
    r.classList.remove("show");
    r.innerHTML = "";
  }

  resetCompare() {
    this.state.compareA = null;
    this.state.compareB = null;
    this.state.compareMetricsA = null;
    this.state.compareMetricsB = null;
    const el = this.containerEl;
    const fA = el.querySelector("#compareFileA");
    const fB = el.querySelector("#compareFileB");
    if (fA) fA.value = "";
    if (fB) fB.value = "";
    const dropA = el.querySelector("#compareDropzoneA");
    const dropB = el.querySelector("#compareDropzoneB");
    if (dropA) dropA.classList.remove("has-file");
    if (dropB) dropB.classList.remove("has-file");
    const stA = el.querySelector("#compareStatusA");
    const stB = el.querySelector("#compareStatusB");
    if (stA) {
      stA.innerHTML = `
        <div class="tw-chg-drop-icon">${getChgIconPark('upload', 20)}</div>
        <div class="tw-chg-drop-label">点击或拖入基准日志 (A)</div>
      `;
    }
    if (stB) {
      stB.innerHTML = `
        <div class="tw-chg-drop-icon">${getChgIconPark('upload', 20)}</div>
        <div class="tw-chg-drop-label">点击或拖入对照日志 (B)</div>
      `;
    }
    el.querySelector("#compareGenerate").disabled = true;
    el.querySelector("#compareSaveVault").disabled = true;
    el.querySelector("#compareAgentDiag").disabled = true;
    const r = el.querySelector("#compareReport");
    r.classList.remove("show");
    r.innerHTML = "";
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChargePanel };
}
