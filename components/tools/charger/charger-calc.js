/* ==========================================================================
   Charger Calc — 充电与放电数据解析、统计指标与 IC 寄存器解码核心引擎
   ========================================================================== */

let calcRegDbRef = typeof REGISTER_DB !== 'undefined' ? REGISTER_DB : null;
if (!calcRegDbRef) {
  try {
    calcRegDbRef = require('./register-db.js').REGISTER_DB;
  } catch (_) {
    calcRegDbRef = {};
  }
}

let calcReqFieldsRef = typeof REQUIRED_CSV_FIELDS !== 'undefined' ? REQUIRED_CSV_FIELDS : null;
if (!calcReqFieldsRef) {
  try {
    calcReqFieldsRef = require('./power-standards.js').REQUIRED_CSV_FIELDS;
  } catch (_) {
    calcReqFieldsRef = ["Time","Level","Vbat","Ibat","Tbat","Status"];
  }
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function fmtNum(v, d = 2) {
  return Number.isFinite(v) ? v.toFixed(d) : "—";
}

function fmtMin(v) {
  if (!Number.isFinite(v)) return "—";
  const s = Math.round(v * 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}小时${String(m).padStart(2, "0")}分${String(sec).padStart(2, "0")}秒` : `${m}分${String(sec).padStart(2, "0")}秒`;
}

function fmtClock(ms) {
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function parseTime(s) {
  s = String(s ?? "").trim();
  let m = s.match(/^(\d{4})[_-](\d{2})[_-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], m[7] ? Number(("0." + m[7])) * 1000 : 0).getTime();
  }
  const t = Date.parse(s.replace(/_/g, "-"));
  return Number.isFinite(t) ? t : NaN;
}

function csvSplitLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const lines = text.split("\n").filter(x => x.trim() !== "");
  if (lines.length < 2) throw new Error("CSV 没有有效数据行");
  const headers = csvSplitLine(lines[0]).map(x => x.trim());
  const missing = calcReqFieldsRef.filter(k => !headers.includes(k));
  if (missing.length) throw new Error("缺少必要字段：" + missing.join(", "));
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const rows = [];
  let badTime = 0, badNumeric = 0, zeroVoltage = 0;
  for (let i = 1; i < lines.length; i++) {
    const a = csvSplitLine(lines[i]);
    if (a.length < headers.length) continue;
    const t = parseTime(a[idx.Time]);
    if (!Number.isFinite(t)) { badTime++; continue; }
    const r = {
      Time: a[idx.Time],
      time: t,
      Level: Number(a[idx.Level]),
      Vbat: Number(a[idx.Vbat]),
      Ibat: Number(a[idx.Ibat]),
      Tbat: Number(a[idx.Tbat]),
      Status: String(a[idx.Status] ?? "").trim()
    };
    if (![r.Level, r.Vbat, r.Ibat, r.Tbat].every(Number.isFinite)) { badNumeric++; continue; }
    if (r.Vbat === 0) { zeroVoltage++; continue; }
    rows.push(r);
  }
  if (rows.length < 2) throw new Error(zeroVoltage ? `有效数据不足（已忽略 ${zeroVoltage} 行电池电压为 0 的异常数据）` : "有效数据不足");
  rows.sort((a, b) => a.time - b.time);
  let nonIncreasing = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].time <= rows[i - 1].time) nonIncreasing++;
  }
  return { headers, rows, quality: { badTime, badNumeric, zeroVoltage, nonIncreasing } };
}

function validateSummary(data) {
  const r = data.rows;
  const charging = r.filter(x => /^charging$/i.test(x.Status)).length;
  const full = r.filter(x => /^full$/i.test(x.Status)).length;
  return `
    <div class="tw-chg-notice tw-chg-notice-good">✓ 文件检查通过，有效样本 ${r.length} 行，可以生成分析报告。</div>
    <div class="tw-chg-validation-grid">
      <div class="tw-chg-vcard"><b>✓ 数据行数</b>${r.length} 行</div>
      <div class="tw-chg-vcard"><b>✓ 必要字段</b>${calcReqFieldsRef.join(", ")}</div>
      <div class="tw-chg-vcard"><b>✓ 时间顺序</b>${data.quality.nonIncreasing ? "存在 " + data.quality.nonIncreasing + " 个非递增点" : "完全单调递增"}</div>
      <div class="tw-chg-vcard"><b>✓ Charging 行数</b>${charging} 行</div>
      <div class="tw-chg-vcard"><b>✓ Full 截止点</b>${full} 行${full ? "（首次 Full 为截止点）" : "（未发现 Full 状态）"}</div>
      <div class="tw-chg-vcard"><b>✓ 脏数据过滤</b>时间异常 ${data.quality.badTime} / 数值异常 ${data.quality.badNumeric} / 0V剔除 ${data.quality.zeroVoltage || 0}</div>
    </div>
  `;
}

function analyze(data) {
  const rows = data.rows;
  let startIdx = rows.findIndex(x => /^charging$/i.test(x.Status));
  if (startIdx < 0) startIdx = 0;
  const start = rows[startIdx];
  const startTime = start.time;
  const firstAt = p => rows.find((x, i) => i >= startIdx && x.Level >= p);
  const p50 = firstAt(50), p80 = firstAt(80), p100 = firstAt(100);
  const fullIdx = rows.findIndex((x, i) => i >= startIdx && /^full$/i.test(x.Status));
  const full = fullIdx >= 0 ? rows[fullIdx] : null;
  let prevCharging = null;
  if (fullIdx >= 0) {
    for (let i = fullIdx - 1; i >= startIdx; i--) {
      if (/^charging$/i.test(rows[i].Status)) {
        prevCharging = rows[i];
        break;
      }
    }
  }
  const endIdx = fullIdx >= 0 ? fullIdx : rows.length - 1;
  const win = rows.slice(startIdx, endIdx + 1);
  const elapsed = x => x ? (x.time - startTime) / 60000 : NaN;
  let ah = 0, wh = 0;
  for (let i = startIdx + 1; i <= endIdx; i++) {
    const a = rows[i - 1], b = rows[i];
    const dt = (b.time - a.time) / 3600000;
    if (!(dt > 0 && dt < 1)) continue;
    const ia = Math.max(0, a.Ibat) / 1000, ib = Math.max(0, b.Ibat) / 1000;
    const va = a.Vbat / 1000, vb = b.Vbat / 1000;
    ah += (ia + ib) / 2 * dt;
    wh += ((ia * va) + (ib * vb)) / 2 * dt;
  }
  const avg = (arr, key) => arr.length ? arr.reduce((s, x) => s + x[key], 0) / arr.length : NaN;
  const max = (arr, key) => arr.length ? Math.max(...arr.map(x => x[key])) : NaN;
  const stages = [];
  for (let lo = 0; lo < 100; lo += 10) {
    const hi = lo + 10;
    const a = rows.find((x, i) => i >= startIdx && x.Level >= Math.max(lo, start.Level));
    const b = rows.find((x, i) => i >= startIdx && x.Level >= hi);
    const seg = win.filter(x => x.Level >= lo && x.Level < hi);
    stages.push({
      range: `${lo}-${hi}%`,
      duration: a && b ? (b.time - a.time) / 60000 : NaN,
      avgI: avg(seg, "Ibat"),
      avgV: avg(seg, "Vbat"),
      avgT: avg(seg, "Tbat"),
      maxT: max(seg, "Tbat")
    });
  }
  return {
    start, p50, p80, p100, full, prevCharging,
    t50: elapsed(p50), t80: elapsed(p80), t100: elapsed(p100), tFull: elapsed(full),
    ah, wh, avgI: avg(win, "Ibat"), peakI: max(win, "Ibat"), avgV: avg(win, "Vbat"), peakV: max(win, "Vbat"), maxT: max(win, "Tbat"),
    cutoffI: prevCharging ? prevCharging.Ibat : NaN, fullV: prevCharging ? prevCharging.Vbat : NaN, stages, win
  };
}

// ================= 放电分析核心计算 =================
function dischargeIntegrateRows(rows) {
  if (!rows || rows.length < 2) return { mah: NaN, wh: NaN, duration: NaN, avgCurrent: NaN };
  let mah = 0, wh = 0;
  for (let i = 1; i < rows.length; i++) {
    const dt = (rows[i].time - rows[i - 1].time) / 3600000;
    if (!(dt > 0)) continue;
    const cur = (Math.abs(Number(rows[i].Ibat)) + Math.abs(Number(rows[i - 1].Ibat))) / 2;
    const vol = (Number(rows[i].Vbat) + Number(rows[i - 1].Vbat)) / 2 / 1000;
    if (!Number.isFinite(cur) || !Number.isFinite(vol)) continue;
    mah += cur * dt;
    wh += cur * dt * vol / 1000;
  }
  const duration = (rows[rows.length - 1].time - rows[0].time) / 60000;
  const avgCurrent = duration > 0 ? mah / (duration / 60) : NaN;
  return { mah, wh, duration, avgCurrent };
}

function dischargeMedian(values) {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function dischargeWindowStats(rows) {
  if (!rows || !rows.length) return { duration: NaN, mah: NaN, wh: NaN, avgCurrent: NaN, startV: NaN, endV: NaN, deltaV: NaN, minV: NaN, avgV: NaN, startLevel: NaN, endLevel: NaN, socSpan: NaN };
  const integ = dischargeIntegrateRows(rows);
  const start = rows[0], end = rows[rows.length - 1];
  const volts = rows.map(x => Number(x.Vbat)).filter(Number.isFinite);
  const avgV = Number.isFinite(integ.mah) && integ.mah > 0 && Number.isFinite(integ.wh)
    ? integ.wh / (integ.mah / 1000) * 1000
    : (volts.length ? volts.reduce((a, b) => a + b, 0) / volts.length : NaN);
  return {
    ...integ,
    startV: Number(start.Vbat),
    endV: Number(end.Vbat),
    deltaV: Number(end.Vbat) - Number(start.Vbat),
    minV: volts.length ? Math.min(...volts) : NaN,
    avgV,
    startLevel: Number(start.Level),
    endLevel: Number(end.Level),
    socSpan: Math.abs(Number(start.Level) - Number(end.Level))
  };
}

function dischargeAnalyze(data) {
  const r = data.rows.filter(x => /discharge/i.test(x.Status) || true);
  const start = r[0], end = r[r.length - 1];
  const whole = dischargeIntegrateRows(r);
  const duration = (end.time - start.time) / 60000;
  const mah = Number.isFinite(whole.mah) ? whole.mah : 0;
  const wh = Number.isFinite(whole.wh) ? whole.wh : 0;
  const avgI = duration > 0 ? mah / (duration / 60) : r.reduce((a, x) => a + Math.abs(x.Ibat), 0) / r.length;
  const peakI = Math.max(...r.map(x => Math.abs(x.Ibat)));
  const ranges = [];
  for (let hi = 100; hi > 0; hi -= 10) {
    const lo = hi - 10;
    let ai = r.findIndex(x => Number(x.Level) <= hi && Number(x.Level) > lo);
    let bi = -1, rangeLabel = hi + "-" + lo + "%";
    if (ai >= 0) bi = r.findIndex((x, i) => i >= ai && Number(x.Level) <= lo);
    if (hi === 10 && ai >= 0 && bi < 0 && Number.isFinite(Number(end.Level)) && Number(end.Level) < 10) {
      bi = r.length - 1;
      rangeLabel = `10-${Number(end.Level).toFixed(Number.isInteger(Number(end.Level)) ? 0 : 1)}%（关机）`;
    }
    const a = ai >= 0 ? r[ai] : null, b = bi >= 0 ? r[bi] : null;
    const seg = (a && b && bi >= ai) ? r.slice(ai, bi + 1) : [];
    const stats = dischargeWindowStats(seg);
    const startV = a ? Number(a.Vbat) : NaN, endV = b ? Number(b.Vbat) : NaN;
    const socSpan = a && b ? Math.abs(Number(a.Level) - Number(b.Level)) : NaN;
    const rangeDuration = a && b ? Math.max(0, (b.time - a.time) / 60000) : NaN;
    const capacityMah = stats.mah, energyWh = stats.wh;
    const avgCurrent = Number.isFinite(stats.avgCurrent) ? stats.avgCurrent : NaN;
    const deltaV = Number.isFinite(startV) && Number.isFinite(endV) ? endV - startV : NaN;
    ranges.push({
      hi, lo, range: rangeLabel, duration: rangeDuration, socSpan, avgCurrent, startV, endV, deltaV, capacityMah, energyWh,
      minPerPct: Number.isFinite(rangeDuration) && socSpan > 0 ? rangeDuration / socSpan : NaN,
      mahPerPct: Number.isFinite(capacityMah) && socSpan > 0 ? capacityMah / socSpan : NaN,
      mvPerPct: Number.isFinite(deltaV) && socSpan > 0 ? Math.abs(deltaV) / socSpan : NaN
    });
  }
  const mid = ranges.filter(x => x.hi <= 90 && x.lo >= 20 && Number.isFinite(x.mahPerPct));
  const baselineMahPerPct = dischargeMedian(mid.map(x => x.mahPerPct));
  const baselineMvPerPct = dischargeMedian(mid.map(x => x.mvPerPct));
  ranges.forEach(x => {
    x.capacityDeviation = Number.isFinite(baselineMahPerPct) && baselineMahPerPct > 0 && Number.isFinite(x.mahPerPct)
      ? (x.mahPerPct - baselineMahPerPct) / baselineMahPerPct * 100 : NaN;
    const tags = []; let cls = "good";
    const lowRange = x.hi <= 20;
    if (lowRange && Number.isFinite(baselineMvPerPct) && baselineMvPerPct > 0 && Number.isFinite(x.mvPerPct) && x.mvPerPct > baselineMvPerPct * 1.6) {
      tags.push("末端掉压快"); cls = "bad";
    }
    if (Number.isFinite(x.capacityDeviation)) {
      if (x.capacityDeviation >= 20) { tags.push("SOC偏慢"); cls = "bad"; }
      else if (x.capacityDeviation >= 10) { tags.push("SOC偏慢"); if (cls === "good") cls = "warn"; }
      else if (x.capacityDeviation <= -20) { tags.push("SOC偏快"); cls = "bad"; }
      else if (x.capacityDeviation <= -10) { tags.push("SOC偏快"); if (cls === "good") cls = "warn"; }
    }
    if (Number.isFinite(x.avgCurrent) && Number.isFinite(avgI) && avgI > 0 && x.avgCurrent > avgI * 1.25) {
      tags.push("负载偏高"); if (cls === "good") cls = "warn";
    }
    x.status = tags.length ? tags.join(" / ") : "正常";
    x.statusClass = cls;
  });
  const low20StartIndex = r.findIndex(x => Number(x.Level) <= 20);
  const low20Rows = low20StartIndex >= 0 ? r.slice(low20StartIndex) : [];
  const low20 = dischargeWindowStats(low20Rows);
  const last5Target = Math.min(Number(start.Level), Number(end.Level) + 5);
  const last5StartIndex = r.findIndex(x => Number(x.Level) <= last5Target);
  const last5Rows = last5StartIndex >= 0 ? r.slice(last5StartIndex) : [];
  const last5Soc = dischargeWindowStats(last5Rows);
  const final5MinRows = r.filter(x => x.time >= end.time - 5 * 60000);
  const final5Min = dischargeWindowStats(final5MinRows);
  const minMax = k => [Math.min(...r.map(x => x[k])), Math.max(...r.map(x => x[k]))];
  return {
    r, start, end, duration, ranges, volt: minMax("Vbat"), temp: minMax("Tbat"), curr: minMax("Ibat"), mah, wh, avgI, peakI,
    baselineMahPerPct, baselineMvPerPct, lowBattery: { low20, last5Soc, final5Min, shutdownSoc: Number(end.Level) }
  };
}

function movingAverage(rows, key, windowSize = 15, useAbs = false) {
  const n = rows.length, w = Math.max(3, Math.min(windowSize, n || 3)), half = Math.floor(w / 2), out = [];
  for (let i = 0; i < n; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      const raw = Number(rows[j][key]);
      if (!Number.isFinite(raw)) continue;
      sum += useAbs ? Math.abs(raw) : raw;
      count++;
    }
    out.push(count ? sum / count : NaN);
  }
  return out;
}

function formatDischargeTime(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "-";
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

// ================= IC 寄存器解析核心计算 =================
function detectChip(text) {
  const up = String(text).toUpperCase();
  const db = calcRegDbRef || {};
  for (const c of Object.keys(db)) {
    if (up.includes(c.toUpperCase())) return c;
  }
  const m = up.match(/\b(?:SC|UPM)\d+[A-Z0-9]*\b/);
  return m ? m[0] : null;
}

function parseDump(text) {
  const values = new Map(), occ = new Map();
  const re = /reg(?:ister)?\s*\[\s*(0x[0-9a-f]+)\s*\]\s*=\s*(0x[0-9a-f]+)/ig;
  let m;
  while ((m = re.exec(text))) {
    const a = parseInt(m[1], 16), v = parseInt(m[2], 16) & 0xFF;
    values.set(a, v);
    occ.set(a, (occ.get(a) || 0) + 1);
  }
  if (!values.size) {
    const re2 = /(0x[0-9a-f]{1,4})\s*(?:=|:)\s*(0x[0-9a-f]{1,2})/ig;
    while ((m = re2.exec(text))) {
      const a = parseInt(m[1], 16), v = parseInt(m[2], 16) & 0xFF;
      values.set(a, v);
      occ.set(a, (occ.get(a) || 0) + 1);
    }
  }
  return { values, occ, detected: detectChip(text) };
}

function fieldRaw(regVal, f) {
  const width = f.hi - f.lo + 1;
  return (regVal >>> f.lo) & ((1 << width) - 1);
}

function parseEnum(desc, raw, width) {
  const lines = String(desc || "").split(/\n/);
  for (let line of lines) {
    line = line.trim().replace(/[–—]/g, "-");
    let m = line.match(/^((?:0x)?[0-9A-Fa-f]+h?|[01]+)\s*(?::|=|\s-\s)\s*(.+)$/);
    if (!m) continue;
    const tok = m[1];
    if (/[~～]/.test(tok)) continue;
    let val;
    if (/^0x/i.test(tok)) val = parseInt(tok, 16);
    else if (/h$/i.test(tok)) val = parseInt(tok.slice(0, -1), 16);
    else if (/^[01]+$/.test(tok)) val = parseInt(tok, 2);
    else continue;
    if (val === raw) return m[2].trim();
  }
  return "";
}

function fmtSmart(v) {
  if (!Number.isFinite(v)) return "—";
  return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function decodedField(regVal, f) {
  const raw = fieldRaw(regVal, f);
  const width = f.hi - f.lo + 1;
  let physical = null, meaning = "";
  if (f.split_weights) {
    let v = Number(f.split_weights.offset || 0);
    const weights = f.split_weights.weights || {};
    for (let bit = f.lo; bit <= f.hi; bit++) {
      if ((regVal >> bit) & 1) v += Number(weights[String(bit)] || 0);
    }
    physical = { value: v, unit: f.split_weights.unit || "" };
    meaning = `${fmtSmart(v)} ${physical.unit}`.trim();
  } else if (f.physical) {
    const v = raw * Number(f.physical.gain || 0) + Number(f.physical.offset || 0);
    physical = { value: v, unit: f.physical.unit || "" };
    meaning = `${fmtSmart(v)} ${physical.unit}`.trim();
  } else {
    meaning = parseEnum(f.desc, raw, width);
  }
  if (!meaning) meaning = `${raw} (0b${raw.toString(2).padStart(width, "0")})`;
  return { raw, width, meaning, physical };
}

function getRegDef(chip, addr) {
  const db = calcRegDbRef || {};
  return chip && db[chip] ? db[chip][addr.toString(16).padStart(2, "0").toUpperCase()] || null : null;
}

function regHex(v) {
  return Number.isFinite(v) ? "0x" + v.toString(16).padStart(2, "0").toUpperCase() : "缺失";
}

function bitRange(f) {
  return f.hi === f.lo ? String(f.hi) : `${f.hi}:${f.lo}`;
}

function binaryDiff(a, b) {
  let A = "", B = "";
  for (let bit = 7; bit >= 0; bit--) {
    const ca = (a >> bit) & 1, cb = (b >> bit) & 1, chg = ca !== cb;
    A += chg ? `<span class="tw-chg-bit-changed">${ca}</span>` : ca;
    B += chg ? `<span class="tw-chg-bit-changed">${cb}</span>` : cb;
    if (bit > 0) { A += " "; B += " "; }
  }
  return { A, B };
}

function fieldDelta(da, db) {
  if (da?.physical && db?.physical && da.physical.unit === db.physical.unit) {
    const d = db.physical.value - da.physical.value;
    return `${d > 0 ? "+" : ""}${fmtSmart(d)} ${da.physical.unit}`;
  }
  return "—";
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esc, fmtNum, fmtMin, fmtClock, parseTime, csvSplitLine, parseCSV, validateSummary, analyze,
    dischargeIntegrateRows, dischargeMedian, dischargeWindowStats, dischargeAnalyze, movingAverage, formatDischargeTime,
    detectChip, parseDump, fieldRaw, parseEnum, fmtSmart, decodedField, getRegDef, regHex, bitRange, binaryDiff, fieldDelta
  };
}
