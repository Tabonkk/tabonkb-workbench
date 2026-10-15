/* ==========================================================================
   IcPanel — 充电 IC 寄存器分析与差分对比面板 (6款芯片Bitfield解码与Agent排错)
   ========================================================================== */

let icCalcRef = typeof detectChip === 'function' ? { esc, fmtNum, fmtSmart, detectChip, parseDump, decodedField, getRegDef, regHex, bitRange, binaryDiff, fieldDelta } : null;
if (!icCalcRef) {
  try {
    icCalcRef = require('./charger-calc.js');
  } catch (_) {
    icCalcRef = {
      esc: typeof esc === 'function' ? esc : v => String(v ?? ""),
      fmtNum: typeof fmtNum === 'function' ? fmtNum : (v, d = 2) => Number(v).toFixed(d),
      fmtSmart: typeof fmtSmart === 'function' ? fmtSmart : v => String(v),
      detectChip: typeof detectChip === 'function' ? detectChip : () => null,
      parseDump: typeof parseDump === 'function' ? parseDump : () => ({ values: new Map(), occ: new Map() }),
      decodedField: typeof decodedField === 'function' ? decodedField : () => ({ raw: 0, width: 8, meaning: "" }),
      getRegDef: typeof getRegDef === 'function' ? getRegDef : () => null,
      regHex: typeof regHex === 'function' ? regHex : v => "0x" + Number(v).toString(16),
      bitRange: typeof bitRange === 'function' ? bitRange : f => `${f.hi}:${f.lo}`,
      binaryDiff: typeof binaryDiff === 'function' ? binaryDiff : () => ({ A: "", B: "" }),
      fieldDelta: typeof fieldDelta === 'function' ? fieldDelta : () => "—"
    };
  }
}

let icRegDbRef = typeof REGISTER_DB !== 'undefined' ? REGISTER_DB : null;
if (!icRegDbRef) {
  try {
    icRegDbRef = require('./register-db.js').REGISTER_DB;
  } catch (_) {
    icRegDbRef = typeof REGISTER_DB !== 'undefined' ? REGISTER_DB : {};
  }
}

let getIcIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!getIcIconPark) {
  try {
    getIcIconPark = require('../../ui/iconpark.js').getIconPark;
  } catch (_) {
    getIcIconPark = (name, size) => `<span class="icon-${name}"></span>`;
  }
}

class IcPanel {
  constructor(options = {}) {
    this.parent = options.parent || null;
    this.containerEl = null;
    this.currentDumpAnalysis = null;
    this.currentDiffAnalysis = null;
  }

  mount(parentEl) {
    this.containerEl = parentEl.createDiv({ cls: 'tw-chg-page-panel' });
    this.render();
  }

  render() {
    const chips = Object.keys(icRegDbRef || {});
    const chipOpts = `<option value="AUTO">自动识别芯片 (Auto Detect)</option>` +
      chips.map(c => `<option value="${c}">${c}</option>`).join("");

    this.containerEl.innerHTML = `
      <!-- 1. 单份 Dump 解码卡片 -->
      <div class="tw-chg-card">
        <div class="tw-chg-card-head">
          <div class="tw-chg-card-title">
            <span class="tw-chg-card-title-icon">${getIcIconPark('cpu', 14)}</span>
            <span>单份 Dump 日志解码</span>
          </div>
          <div class="tw-chg-card-meta">
            <span class="tw-chg-pill-tag">支持 6 款主流充电 IC</span>
          </div>
        </div>
        <div class="tw-chg-card-body">
          <div class="tw-chg-bar-toolbar">
            <div class="tw-chg-field-row" style="margin-bottom:0">
              <label class="tw-chg-field-label">IC 型号</label>
              <select id="icSelect" class="tw-chg-field-select">${chipOpts}</select>
            </div>
            <button id="loadSampleDumpBtn" class="tw-chg-btn" type="button">
              ${getIcIconPark('edit', 12)}<span>填入典型故障样本 (SC89896)</span>
            </button>
            <div class="tw-chg-toolbar-spacer"></div>
            <button id="parseDumpBtn" class="tw-chg-btn tw-chg-btn-primary">
              ${getIcIconPark('lightning', 13)}<span>解码 Dump</span>
            </button>
            <button id="icAgentDiagBtn" class="tw-chg-btn tw-chg-btn-agent" disabled title="提取 FAULT/STAT 寄存器呼叫 AI Agent 分析故障原因">
              ${getIcIconPark('robot', 13)}<span>呼叫 Agent 诊断</span>
            </button>
            <button id="resetDumpBtn" class="tw-chg-btn tw-chg-btn-ghost">
              ${getIcIconPark('refresh', 13)}<span>清空</span>
            </button>
          </div>

          <div class="tw-chg-textarea-wrap" style="margin-top:12px">
            <textarea id="singleDump" class="tw-chg-textarea" placeholder="粘贴内核 dump 日志，例如：
<6>[   72.779312] SC89896_INFO: dump_register reg[0x02] = 0x19
<6>[   72.780022] SC89896_INFO: dump_register reg[0x04] = 0x46
<6>[   72.780100] SC89896_INFO: dump_register reg[0x08] = 0x12
<6>[   72.780200] SC89896_INFO: dump_register reg[0x1D] = 0x88"></textarea>
          </div>
          <div id="singleDumpResult"></div>
        </div>
      </div>

      <!-- 2. 寄存器差分对比卡片 -->
      <div class="tw-chg-card" style="margin-top:14px">
        <div class="tw-chg-card-head">
          <div class="tw-chg-card-title">
            <span class="tw-chg-card-title-icon">${getIcIconPark('balance', 14)}</span>
            <span>寄存器 A / B 差分对比 (Diff)</span>
          </div>
          <div class="tw-chg-card-meta">
            <span class="tw-chg-pill-tag">逐位 Bitfield 物理量差分</span>
          </div>
        </div>
        <div class="tw-chg-card-body">
          <div class="tw-chg-bar-toolbar">
            <label class="tw-chg-checkbox-label">
              <input id="diffOnly" type="checkbox" checked> 仅显示有差异的寄存器
            </label>
            <div class="tw-chg-toolbar-spacer"></div>
            <button id="compareRegsBtn" class="tw-chg-btn tw-chg-btn-primary">
              ${getIcIconPark('lightning', 13)}<span>逐位对比</span>
            </button>
            <button id="diffAgentDiagBtn" class="tw-chg-btn tw-chg-btn-agent" disabled title="将寄存器差异提交给 AI 分析驱动行为变更">
              ${getIcIconPark('robot', 13)}<span>呼叫 Agent 诊断差异</span>
            </button>
            <button id="resetRegsBtn" class="tw-chg-btn tw-chg-btn-ghost">
              ${getIcIconPark('refresh', 13)}<span>清空对比</span>
            </button>
          </div>

          <div class="tw-chg-grid tw-chg-grid-2" style="margin-top:12px">
            <div>
              <div class="tw-chg-col-title">Dump A (正常机 / 修改前)</div>
              <textarea id="dumpA" class="tw-chg-textarea" placeholder="粘贴第一份 dump 日志 (例如正常机状态)"></textarea>
            </div>
            <div>
              <div class="tw-chg-col-title">Dump B (故障机 / 修改后)</div>
              <textarea id="dumpB" class="tw-chg-textarea" placeholder="粘贴第二份 dump 日志 (例如故障机状态)"></textarea>
            </div>
          </div>
          <div id="regCompareResult"></div>
        </div>
      </div>
    `;

    this.initEvents();
  }

  initEvents() {
    const el = this.containerEl;

    const parseBtn = el.querySelector("#parseDumpBtn");
    if (parseBtn) {
      parseBtn.addEventListener("click", () => this.parseSingleDump());
    }

    const sampleBtn = el.querySelector("#loadSampleDumpBtn");
    if (sampleBtn) {
      sampleBtn.addEventListener("click", () => this.loadSample());
    }

    const resetBtn = el.querySelector("#resetDumpBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        el.querySelector("#singleDump").value = "";
        el.querySelector("#singleDumpResult").innerHTML = "";
        el.querySelector("#icAgentDiagBtn").disabled = true;
      });
    }

    const cmpBtn = el.querySelector("#compareRegsBtn");
    if (cmpBtn) {
      cmpBtn.addEventListener("click", () => this.compareRegs());
    }

    const resetCmpBtn = el.querySelector("#resetRegsBtn");
    if (resetCmpBtn) {
      resetCmpBtn.addEventListener("click", () => {
        el.querySelector("#dumpA").value = "";
        el.querySelector("#dumpB").value = "";
        el.querySelector("#regCompareResult").innerHTML = "";
        el.querySelector("#diffAgentDiagBtn").disabled = true;
      });
    }

    const diagBtn = el.querySelector("#icAgentDiagBtn");
    if (diagBtn) {
      diagBtn.addEventListener("click", () => this.diagnoseSingleIc());
    }

    const diffDiagBtn = el.querySelector("#diffAgentDiagBtn");
    if (diffDiagBtn) {
      diffDiagBtn.addEventListener("click", () => this.diagnoseDiffWithAgent());
    }
  }

  loadSample() {
    const el = this.containerEl;
    el.querySelector("#icSelect").value = "SC89896";
    el.querySelector("#singleDump").value = `<6>[  102.341102] SC89896_INFO: dump_register reg[0x02] = 0x0D
<6>[  102.341150] SC89896_INFO: dump_register reg[0x04] = 0x46
<6>[  102.341200] SC89896_INFO: dump_register reg[0x06] = 0x04
<6>[  102.341250] SC89896_INFO: dump_register reg[0x08] = 0x86
<6>[  102.341300] SC89896_INFO: dump_register reg[0x10] = 0x01
<6>[  102.341350] SC89896_INFO: dump_register reg[0x12] = 0x00
<6>[  102.341400] SC89896_INFO: dump_register reg[0x16] = 0x24
<6>[  102.341450] SC89896_INFO: dump_register reg[0x1D] = 0x24
<6>[  102.341500] SC89896_INFO: dump_register reg[0x1E] = 0x98`;
    this.parseSingleDump();
  }

  resolveSelectedChip(textA = "", textB = "") {
    const sel = this.containerEl.querySelector("#icSelect").value;
    if (sel !== "AUTO") return { chip: sel, warning: "" };
    const a = icCalcRef.detectChip(textA);
    const b = textB ? icCalcRef.detectChip(textB) : null;
    if (textB && a && b && a !== b) {
      return { chip: null, warning: `两份日志识别到不同型号：${a} / ${b}，仅比较原始寄存器值。` };
    }
    const c = a || b;
    if (c && icRegDbRef[c]) return { chip: c, warning: "" };
    return {
      chip: null,
      warning: c ? `识别到型号 ${c}，但未内置完整定义；仅显示原始值。` : "未识别到支持的 IC 型号，请手动选择型号。"
    };
  }

  parseSingleDump() {
    const text = this.containerEl.querySelector("#singleDump").value;
    const parsed = icCalcRef.parseDump(text);
    const choice = this.resolveSelectedChip(text);
    const chip = choice.chip;

    const resEl = this.containerEl.querySelector("#singleDumpResult");
    if (!parsed.values.size) {
      resEl.innerHTML = `<div class="tw-chg-notice tw-chg-notice-bad">未匹配到寄存器数据。支持 reg[0xXX]=0xYY 或 0xXX=0xYY 格式。</div>`;
      this.containerEl.querySelector("#icAgentDiagBtn").disabled = true;
      return;
    }

    const regs = [...parsed.values.entries()].sort((a, b) => a[0] - b[0]);
    let decoded = 0;
    const fieldRows = [];
    const alerts = [];

    const regRows = regs.map(([addr, val]) => {
      const rd = icCalcRef.getRegDef(chip, addr);
      if (rd) {
        decoded++;
        rd.fields.forEach(f => {
          const d = icCalcRef.decodedField(val, f);
          const isAlert = /fault|ovp|warn|hot|cold|error|protect/i.test(f.name) && d.raw > 0;
          if (isAlert) {
            alerts.push({ reg: rd.name, field: f.name, meaning: d.meaning });
          }
          fieldRows.push(`
            <tr class="${isAlert ? 'tw-chg-tr-alert' : ''}">
              <td>0x${addr.toString(16).padStart(2, "0").toUpperCase()}</td>
              <td>${icCalcRef.esc(rd.name)}</td>
              <td>${icCalcRef.bitRange(f)}</td>
              <td><b>${icCalcRef.esc(f.name)}</b></td>
              <td>0x${d.raw.toString(16).toUpperCase()} / ${d.raw}</td>
              <td style="${isAlert ? 'color:#b32b32;font-weight:700' : ''}">${icCalcRef.esc(d.meaning)}</td>
              <td>${icCalcRef.esc(f.access)}</td>
              <td class="tw-chg-small">${icCalcRef.esc(f.desc).replace(/\n/g, "<br>")}</td>
            </tr>
          `);
        });
      }
      return `
        <tr>
          <td>0x${addr.toString(16).padStart(2, "0").toUpperCase()}</td>
          <td>${rd ? icCalcRef.esc(rd.name) : "未定义"}</td>
          <td><b>${icCalcRef.regHex(val)}</b></td>
          <td class="tw-chg-bitline">${val.toString(2).padStart(8, "0")}</td>
          <td>${parsed.occ.get(addr) > 1 ? parsed.occ.get(addr) + " 次 (取末次)" : "1 次"}</td>
        </tr>
      `;
    }).join("");

    this.currentDumpAnalysis = { chip: chip || parsed.detected, regs, alerts, text };

    resEl.innerHTML = `
      ${choice.warning ? `<div class="tw-chg-notice tw-chg-notice-warn">${icCalcRef.esc(choice.warning)}</div>` : `<div class="tw-chg-notice tw-chg-notice-good">✓ 解析完成: ${chip || "通用型号"}</div>`}
      
      <div class="tw-chg-stat-row">
        <div class="tw-chg-mini-stat">寄存器总数 <b>${regs.length}</b></div>
        <div class="tw-chg-mini-stat">手册已定义 <b>${decoded}</b></div>
        <div class="tw-chg-mini-stat">IC 识别 <b>${icCalcRef.esc(chip || parsed.detected || "未识别")}</b></div>
        ${alerts.length ? `<div class="tw-chg-mini-stat" style="border-color:#b32b32;color:#b32b32">告警字段 <b>${alerts.length}</b></div>` : ""}
      </div>

      ${alerts.length ? `
        <div class="tw-chg-notice tw-chg-notice-bad">
          <b>⚠️ 侦测到硬件告警/保护触发:</b> ${alerts.map(a => `[${a.reg} -> ${a.field}: ${a.meaning}]`).join(", ")}
        </div>
      ` : ""}

      <h4 style="margin:12px 0 6px">寄存器总览</h4>
      <div class="tw-chg-table-wrap">
        <table>
          <thead><tr><th>地址</th><th>寄存器名称</th><th>数值</th><th>二进制位 (Bits 7..0)</th><th>出现频次</th></tr></thead>
          <tbody>${regRows}</tbody>
        </table>
      </div>

      ${fieldRows.length ? `
        <h4 style="margin:16px 0 6px">Bit 字段工程含义展开</h4>
        <div class="tw-chg-table-wrap">
          <table>
            <thead><tr><th>地址</th><th>寄存器</th><th>Bits</th><th>字段名</th><th>原始值</th><th>实际工程含义</th><th>属性</th><th>手册描述</th></tr></thead>
            <tbody>${fieldRows.join("")}</tbody>
          </table>
        </div>
      ` : ""}
    `;

    this.containerEl.querySelector("#icAgentDiagBtn").disabled = false;
  }

  compareRegs() {
    const el = this.containerEl;
    const tA = el.querySelector("#dumpA").value;
    const tB = el.querySelector("#dumpB").value;
    const pA = icCalcRef.parseDump(tA);
    const pB = icCalcRef.parseDump(tB);
    const choice = this.resolveSelectedChip(tA, tB);
    const chip = choice.chip;
    const diffOnly = el.querySelector("#diffOnly").checked;
    const resEl = el.querySelector("#regCompareResult");

    if (!pA.values.size && !pB.values.size) {
      resEl.innerHTML = `<div class="tw-chg-notice tw-chg-notice-bad">Dump A 与 Dump B 均未解析出有效寄存器。</div>`;
      el.querySelector("#diffAgentDiagBtn").disabled = true;
      return;
    }

    const addrs = [...new Set([...pA.values.keys(), ...pB.values.keys()])].sort((a, b) => a - b);
    let diffCount = 0, onlyACount = 0, onlyBCount = 0;
    const cards = [];
    const diffSummary = [];

    for (const addr of addrs) {
      const va = pA.values.get(addr);
      const vb = pB.values.get(addr);
      const rd = icCalcRef.getRegDef(chip, addr);
      const name = rd ? rd.name : `REG[0x${addr.toString(16).padStart(2, "0").toUpperCase()}]`;

      const onlyA = Number.isFinite(va) && !Number.isFinite(vb);
      const onlyB = !Number.isFinite(va) && Number.isFinite(vb);
      const isDiff = Number.isFinite(va) && Number.isFinite(vb) && va !== vb;

      if (onlyA) onlyACount++;
      if (onlyB) onlyBCount++;
      if (isDiff) diffCount++;

      if (diffOnly && !onlyA && !onlyB && !isDiff) continue;

      const cls = onlyA ? "onlyA" : onlyB ? "onlyB" : isDiff ? "diff" : "same";
      const bDiff = icCalcRef.binaryDiff(va || 0, vb || 0);

      const fRows = [];
      if (rd && Number.isFinite(va) && Number.isFinite(vb)) {
        rd.fields.forEach(f => {
          const da = icCalcRef.decodedField(va, f);
          const db = icCalcRef.decodedField(vb, f);
          const fDiff = da.raw !== db.raw;
          if (fDiff) {
            diffSummary.push(`${name}.${f.name}: [${da.meaning}] -> [${db.meaning}]`);
          }
          if (!diffOnly || fDiff) {
            fRows.push(`
              <tr class="${fDiff ? 'tw-chg-diff-row' : ''}">
                <td>${icCalcRef.bitRange(f)}</td>
                <td><b>${icCalcRef.esc(f.name)}</b></td>
                <td>${icCalcRef.esc(da.meaning)}</td>
                <td>${icCalcRef.esc(db.meaning)}</td>
                <td>${fDiff ? icCalcRef.fieldDelta(da, db) : "—"}</td>
              </tr>
            `);
          }
        });
      }

      cards.push(`
        <div class="tw-chg-reg-diff-card tw-chg-reg-${cls}">
          <div class="tw-chg-reg-diff-head">
            <div>
              <div class="tw-chg-reg-diff-title">0x${addr.toString(16).padStart(2, "0").toUpperCase()} · ${icCalcRef.esc(name)}</div>
              <div class="tw-chg-reg-change">A: ${icCalcRef.regHex(va)} &nbsp;→&nbsp; B: ${icCalcRef.regHex(vb)}</div>
            </div>
            <span class="tw-chg-badge tw-chg-badge-${cls === 'same' ? 'gray' : cls === 'diff' ? 'warn' : 'info'}">
              ${onlyA ? "仅在 A 中存在" : onlyB ? "仅在 B 中存在" : isDiff ? "数值变更" : "完全一致"}
            </span>
          </div>
          <div style="padding:10px 14px">
            <div class="tw-chg-small">二进制逐位变化 (A vs B):</div>
            <div class="tw-chg-bitline">A: ${bDiff.A}</div>
            <div class="tw-chg-bitline">B: ${bDiff.B}</div>
            ${fRows.length ? `
              <div class="tw-chg-table-wrap" style="margin-top:8px">
                <table>
                  <thead><tr><th>Bits</th><th>字段名</th><th>A 配置</th><th>B 配置</th><th>物理差值</th></tr></thead>
                  <tbody>${fRows.join("")}</tbody>
                </table>
              </div>
            ` : ""}
          </div>
        </div>
      `);
    }

    this.currentDiffAnalysis = { chip, diffSummary, diffCount, total: addrs.length };

    resEl.innerHTML = `
      <div class="tw-chg-stat-row">
        <div class="tw-chg-mini-stat">对比寄存器总数 <b>${addrs.length}</b></div>
        <div class="tw-chg-mini-stat" style="color:#d88412">有差异寄存器 <b>${diffCount}</b></div>
        <div class="tw-chg-mini-stat">仅 A 存在 <b>${onlyACount}</b></div>
        <div class="tw-chg-mini-stat">仅 B 存在 <b>${onlyBCount}</b></div>
      </div>
      ${cards.join("") || `<div class="tw-chg-notice good">两份 Dump 在所选范围内无任何差异。</div>`}
    `;

    el.querySelector("#diffAgentDiagBtn").disabled = false;
  }

  diagnoseSingleIc() {
    const a = this.currentDumpAnalysis;
    if (!a) return;
    const prompt = `请对以下手机充电 IC (${a.chip}) 的寄存器 Dump 状态进行芯片驱动级诊断：
${a.alerts.length ? `硬件报警/保护字段:
${a.alerts.map(x => `- [${x.reg}] ${x.field}: ${x.meaning}`).join("\n")}
` : "未捕获到明显的硬件告警字段。"}
关键寄存器快照:
${a.regs.slice(0, 16).map(([addr, val]) => `0x${addr.toString(16).padStart(2, "0").toUpperCase()} = 0x${val.toString(16).padStart(2, "0").toUpperCase()}`).join(", ")}
请分析当前充电芯片是否处于正常使能状态 (CHG_CFG, HIZ, IINDPM, VINDPM, CV, WD 等)，是否存在热保护、输入限流或断充问题，并给出内核驱动层排查指引。`;

    if (this.parent && typeof this.parent.invokeAgentDiagnostics === 'function') {
      this.parent.invokeAgentDiagnostics("充电 IC 寄存器诊断", prompt);
    }
  }

  diagnoseDiffWithAgent() {
    const d = this.currentDiffAnalysis;
    if (!d) return;
    const prompt = `请对充电 IC (${d.chip}) 的 A/B 寄存器差异进行排错评估：
总比对寄存器数: ${d.total}, 差异项数: ${d.diffCount}
主要字段差异:
${d.diffSummary.slice(0, 20).map(x => `- ${x}`).join("\n")}
请评估两份寄存器差异对充电电流限制 (IINDPM/ICHG)、充电电压 (CV)、看门狗或路径管理 (OTG/BATFET) 的实际影响，判断导致异常的关键配置变更是哪一项。`;

    if (this.parent && typeof this.parent.invokeAgentDiagnostics === 'function') {
      this.parent.invokeAgentDiagnostics("充电 IC 差异诊断", prompt);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IcPanel };
}
