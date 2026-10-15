/* ==========================================================================
   Charger Charts — 原生 Canvas 多轴曲线、示波器与交互渲染引擎
   ========================================================================== */

let movingAverageRef = typeof movingAverage === 'function' ? movingAverage : null;
let formatDischargeTimeRef = typeof formatDischargeTime === 'function' ? formatDischargeTime : null;
if (!movingAverageRef || !formatDischargeTimeRef) {
  try {
    const calc = require('./charger-calc.js');
    if (!movingAverageRef) movingAverageRef = calc.movingAverage;
    if (!formatDischargeTimeRef) formatDischargeTimeRef = calc.formatDischargeTime;
  } catch (_) {
    if (!movingAverageRef) movingAverageRef = (r, k) => r.map(x => x[k]);
    if (!formatDischargeTimeRef) formatDischargeTimeRef = t => String(t);
  }
}

function ensureChartTip(canvas) {
  const box = canvas.parentElement;
  let tip = box.querySelector(".tw-chg-chart-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tw-chg-chart-tip";
    box.appendChild(tip);
  }
  return tip;
}

function canvasChart(canvas, series, opts = {}) {
  if (!canvas) return;
  const box = canvas.parentElement;
  const tip = ensureChartTip(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function draw() {
    const rect = box.getBoundingClientRect();
    canvas.width = Math.max(300, rect.width) * dpr;
    canvas.height = Math.max(180, rect.height) * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width, H = rect.height;
    const p = { l: 50, r: 50, t: 22, b: 34 };
    const w = W - p.l - p.r, h = H - p.t - p.b;

    const allX = series.flatMap(s => s.data.map(d => d.x)).filter(Number.isFinite);
    if (!allX.length) return;
    const xmin = Math.min(...allX);
    const xmax = Math.max(...allX) || 1;
    const axes = [...new Set(series.map(s => s.axis || "left"))];
    const yRange = {};

    for (const ax of axes) {
      const vals = series.filter(s => (s.axis || "left") === ax).flatMap(s => s.data.map(d => d.y)).filter(Number.isFinite);
      let mn = Math.min(...vals), mx = Math.max(...vals);
      if (mn === mx) { mn -= 1; mx += 1; }
      const pad = (mx - mn) * 0.08;
      yRange[ax] = [mn - pad, mx + pad];
    }

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(120, 130, 150, 0.2)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#7a8295";
    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";

    for (let i = 0; i <= 5; i++) {
      const y = p.t + h * i / 5;
      ctx.beginPath();
      ctx.moveTo(p.l, y);
      ctx.lineTo(W - p.r, y);
      ctx.stroke();
      const [mn, mx] = yRange.left || yRange[axes[0]];
      ctx.fillText((mx - (mx - mn) * i / 5).toFixed(opts.leftDigits ?? 0), 4, y + 4);
    }

    if (yRange.right) {
      const [mn, mx] = yRange.right;
      for (let i = 0; i <= 5; i++) {
        const y = p.t + h * i / 5;
        const txt = (mx - (mx - mn) * i / 5).toFixed(opts.rightDigits ?? 0);
        ctx.fillText(txt, W - p.r + 6, y + 4);
      }
    }

    ctx.fillText("时间 (min)", Math.max(p.l, W / 2 - 24), H - 7);
    const colors = ["#5968e8", "#e18b2f", "#18a06e", "#c04693"];

    series.forEach((s, si) => {
      const [mn, mx] = yRange[s.axis || "left"];
      ctx.strokeStyle = colors[si % colors.length];
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      s.data.forEach((d, i) => {
        const x = p.l + (d.x - xmin) / (xmax - xmin || 1) * w;
        const y = p.t + (mx - d.y) / (mx - mn) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    series.forEach((s, si) => {
      ctx.fillStyle = colors[si % colors.length];
      ctx.fillRect(p.l + si * 145, p.t - 15, 10, 3);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`${s.name} (${s.unit || ""})`, p.l + 14 + si * 145, p.t - 9);
    });

    canvas._chart = { p, w, h, xmin, xmax, yRange, series, colors };
  }

  function pointer(ev) {
    const c = canvas._chart;
    if (!c) return;
    const r = canvas.getBoundingClientRect();
    const mx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const xval = c.xmin + Math.max(0, Math.min(c.w, mx - c.p.l)) / c.w * (c.xmax - c.xmin);
    let nearest = null, nd = Infinity;
    const base = c.series[0].data;
    for (const d of base) {
      const dd = Math.abs(d.x - xval);
      if (dd < nd) { nd = dd; nearest = d; }
    }
    if (!nearest) return;
    const lines = [`时间：${nearest.x.toFixed(2)} min`];
    c.series.forEach(s => {
      let n = s.data.reduce((best, d) => Math.abs(d.x - nearest.x) < Math.abs(best.x - nearest.x) ? d : best, s.data[0]);
      lines.push(`${s.name}：${Number(n.y).toFixed(s.digits ?? 1)} ${s.unit || ""}`);
    });
    tip.innerHTML = lines.join("<br>");
    tip.style.display = "block";
    const left = Math.min(r.width - 150, Math.max(5, mx + 10));
    tip.style.left = left + "px";
    tip.style.top = "35px";
  }

  canvas.addEventListener("mousemove", pointer);
  canvas.addEventListener("touchmove", pointer, { passive: true });
  canvas.addEventListener("mouseleave", () => { tip.style.display = "none"; });

  draw();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(draw).observe(box);
  }
}

function drawSingleCharts(container, m) {
  if (!container || !m || !m.win) return;
  const t0 = m.start.time;
  const pts = m.win.map(x => ({ x: (x.time - t0) / 60000, I: x.Ibat, V: x.Vbat, T: x.Tbat }));

  const c1 = container.querySelector("#chargeChart");
  if (c1) {
    canvasChart(c1, [
      { name: "电池电流", unit: "mA", axis: "left", digits: 0, data: pts.map(p => ({ x: p.x, y: p.I })) },
      { name: "电池电压", unit: "mV", axis: "right", digits: 0, data: pts.map(p => ({ x: p.x, y: p.V })) }
    ], { leftDigits: 0, rightDigits: 0 });
  }

  const c2 = container.querySelector("#tempChart");
  if (c2) {
    canvasChart(c2, [
      { name: "电池温度", unit: "°C", axis: "left", digits: 1, data: pts.map(p => ({ x: p.x, y: p.T })) },
      { name: "电池电流", unit: "mA", axis: "right", digits: 0, data: pts.map(p => ({ x: p.x, y: p.I })) }
    ], { leftDigits: 1, rightDigits: 0 });
  }
}

function drawCompareCharts(container, a, b) {
  if (!container || !a || !b) return;
  const toSeries = (m, key) => m.win.map(x => ({ x: (x.time - m.start.time) / 60000, y: x[key] }));

  const c1 = container.querySelector("#cmpCurrent");
  if (c1) {
    canvasChart(c1, [
      { name: "数据 A", unit: "mA", data: toSeries(a, "Ibat"), digits: 0 },
      { name: "数据 B", unit: "mA", data: toSeries(b, "Ibat"), digits: 0 }
    ], { leftDigits: 0 });
  }

  const c2 = container.querySelector("#cmpTemp");
  if (c2) {
    canvasChart(c2, [
      { name: "数据 A", unit: "°C", data: toSeries(a, "Tbat"), digits: 1 },
      { name: "数据 B", unit: "°C", data: toSeries(b, "Tbat"), digits: 1 }
    ], { leftDigits: 1 });
  }
}

// ================= 放电多轴与对比 Canvas 引擎 =================
function drawMultiChart(canvas, rows, series) {
  if (!canvas || !rows || !rows.length) return;
  const c = canvas, ctx = c.getContext("2d");
  const tip = ensureChartTip(canvas);
  let pinned = false, lastRatio = -1;

  function draw(ratio = -1) {
    const W = c.clientWidth, H = c.clientHeight;
    const dpr = window.devicePixelRatio || 2;
    const pad = { l: 45, r: series.length > 1 ? 45 : 18, t: 26, b: 24 };
    c.width = Math.max(1, W * dpr);
    c.height = Math.max(1, H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pw = Math.max(1, W - pad.l - pad.r);
    const ph = Math.max(1, H - pad.t - pad.b);
    const colors = ["#5a67e8", "#17a36f", "#e08d24", "#d9424a"];

    series.forEach((s, idx) => {
      const vals = rows.map(x => Number(x[s.key])).filter(Number.isFinite);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const isRight = idx === 1;

      ctx.beginPath();
      rows.forEach((x, i) => {
        const v = Number(x[s.key]);
        if (!Number.isFinite(v)) return;
        const px = pad.l + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * pw;
        const py = pad.t + (mx - v) / (mx - mn || 1) * ph;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 1.6;
      ctx.stroke();

      if (s.key === "Ibat") {
        const mv = movingAverageRef(rows, "Ibat", 15, true);
        ctx.beginPath();
        mv.forEach((v, i) => {
          const px = pad.l + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * pw;
          const py = pad.t + (mx - v) / (mx - mn || 1) * ph;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.strokeStyle = colors[idx % colors.length];
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillText(`${s.key} (${mn.toFixed(1)}~${mx.toFixed(1)}${s.unit})`, isRight ? W - pad.r - 80 : pad.l, 14);
    });

    if (ratio >= 0) {
      const x = pad.l + ratio * pw;
      ctx.strokeStyle = "#4b5563";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, H - pad.b);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    c._geom = { pad, pw, W, H };
  }

  function showAt(ev, lock = false) {
    const r = c.getBoundingClientRect(), g = c._geom;
    if (!g) return;
    const mx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const ratio = Math.max(0, Math.min(1, (mx - g.pad.l) / g.pw));
    lastRatio = ratio;
    if (lock) pinned = true;
    draw(ratio);
    const idx = Math.max(0, Math.min(rows.length - 1, Math.round(ratio * (rows.length - 1))));
    const item = rows[idx];
    let tipHtml = `<b>时间:</b> ${formatDischargeTimeRef(item.time)}<br>`;
    series.forEach(s => {
      tipHtml += `<b>${s.key}:</b> ${Number(item[s.key]).toFixed(1)} ${s.unit}<br>`;
    });
    tip.innerHTML = tipHtml;
    tip.style.display = "block";
    tip.style.left = Math.min(Math.max(5, g.pad.l + ratio * g.pw + 10), Math.max(5, r.width - 200)) + "px";
    tip.style.top = "30px";
  }

  c.onmousemove = e => { if (!pinned) showAt(e, false); };
  c.onclick = e => showAt(e, true);
  c.onmouseleave = () => { if (!pinned) { tip.style.display = "none"; draw(-1); } };
  c.ondblclick = () => { pinned = false; lastRatio = -1; tip.style.display = "none"; draw(-1); };

  draw();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => draw(lastRatio)).observe(c.parentElement);
  }
}

function drawDischargeCompareChart(canvas, aRows, bRows, key, unit, useAbs = false) {
  if (!canvas || !aRows || !bRows) return;
  const c = canvas, ctx = c.getContext("2d");
  const tip = ensureChartTip(canvas);
  let pinned = false, lastRatio = -1;
  const val = x => useAbs ? Math.abs(Number(x[key])) : Number(x[key]);

  function draw(ratio = -1) {
    const W = c.clientWidth, H = c.clientHeight;
    const dpr = window.devicePixelRatio || 2;
    const pad = { l: 42, r: 18, t: 28, b: 24 };
    c.width = Math.max(1, W * dpr);
    c.height = Math.max(1, H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pw = Math.max(1, W - pad.l - pad.r);
    const ph = Math.max(1, H - pad.t - pad.b);
    const all = aRows.concat(bRows).map(val).filter(Number.isFinite);
    const mn = Math.min(...all), mx = Math.max(...all);

    const line = (rows, color) => {
      ctx.beginPath();
      rows.forEach((x, i) => {
        const v = val(x);
        if (!Number.isFinite(v)) return;
        const px = pad.l + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * pw;
        const py = pad.t + (mx - v) / (mx - mn || 1) * ph;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const filtered = (rows, color) => {
      const vs = movingAverageRef(rows, key, 15, useAbs);
      ctx.beginPath();
      vs.forEach((v, i) => {
        const px = pad.l + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * pw;
        const py = pad.t + (mx - v) / (mx - mn || 1) * ph;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    line(aRows, "#5a67e8");
    line(bRows, "#d88412");
    if (key === "Ibat") {
      filtered(aRows, "#5a67e8");
      filtered(bRows, "#d88412");
    }

    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#5a67e8"; ctx.fillText("A", 6, 14);
    ctx.fillStyle = "#d88412"; ctx.fillText("B", 24, 14);
    ctx.fillStyle = "#555"; ctx.fillText(`${mn.toFixed(1)} ~ ${mx.toFixed(1)} ${unit}${key === "Ibat" ? " (虚线=15点滤波)" : ""}`, 44, 14);

    if (ratio >= 0) {
      const x = pad.l + ratio * pw;
      ctx.strokeStyle = "#4b5563";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, H - pad.b);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    c._dccGeom = { pad, pw, W, H };
  }

  function nearest(rows, ratio) {
    return rows[Math.max(0, Math.min(rows.length - 1, Math.round(ratio * (rows.length - 1))))];
  }

  function showAt(ev, lock = false) {
    const r = c.getBoundingClientRect(), g = c._dccGeom;
    if (!g) return;
    const mx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const ratio = Math.max(0, Math.min(1, (mx - g.pad.l) / g.pw));
    lastRatio = ratio;
    if (lock) pinned = true;
    draw(ratio);
    const A = nearest(aRows, ratio), B = nearest(bRows, ratio);
    const one = (n, x) => `<b>${n}</b> ${formatDischargeTimeRef(x.time)}<br>SOC ${Number(x.Level).toFixed(0)}% · V ${Number(x.Vbat).toFixed(0)}mV · I ${Number(x.Ibat).toFixed(0)}mA · T ${Number(x.Tbat).toFixed(1)}℃`;
    tip.innerHTML = one("A: ", A) + "<br>" + one("B: ", B);
    tip.style.display = "block";
    tip.style.left = Math.min(Math.max(5, g.pad.l + ratio * g.pw + 10), Math.max(5, r.width - 250)) + "px";
    tip.style.top = "34px";
  }

  c.onmousemove = e => { if (!pinned) showAt(e, false); };
  c.onclick = e => showAt(e, true);
  c.onmouseleave = () => { if (!pinned) { tip.style.display = "none"; draw(-1); } };
  c.ondblclick = () => { pinned = false; lastRatio = -1; tip.style.display = "none"; draw(-1); };

  draw();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => draw(lastRatio)).observe(c.parentElement);
  }
}

// ================= Power-Z ChargerLAB 示波器与微型协议画布 =================
function drawPowerzScope(canvas, samples, pzState) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width, h = rect.height;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padLeft = 45;
  const padRight = 45;
  const padTop = 15;
  const padBottom = 26;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const ch = (pzState && pzState.channels) ? pzState.channels : { charge: true, power: true, dpdm: true, cc: true, temp: false, energy: false };

  // 1. 动态自适应量程计算
  let maxV = 12.0;
  let maxI = 3.5;
  let maxP = 40.0;
  if (samples && samples.length > 0) {
    for (let k = 0; k < samples.length; k++) {
      if (samples[k].vbus > 12.0) maxV = 24.0;
      if (samples[k].ibus > 3.5) maxI = 6.0;
      if (samples[k].pwr > 40.0) maxP = 100.0;
    }
  }

  // 2. 绘制暗色工业网格与 Y 轴刻度
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  const gridRows = 5;
  for (let r = 0; r <= gridRows; r++) {
    const y = padTop + (r / gridRows) * plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    const volt = (maxV - (r / gridRows) * maxV).toFixed(3);
    ctx.fillStyle = "#18a058";
    ctx.font = "10px Consolas, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${volt}V`, padLeft - 6, y + 3);

    const cur = (maxI - (r / gridRows) * maxI).toFixed(3);
    ctx.fillStyle = "#e05a70";
    ctx.textAlign = "left";
    ctx.fillText(`${cur}A`, w - padRight + 6, y + 3);
  }

  const gridCols = 6;
  for (let c = 0; c <= gridCols; c++) {
    const x = padLeft + (c / gridCols) * plotW;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();
  }

  // 图表内原生图例 (In-Chart Legend)
  let legX = padLeft + 12;
  const legY = padTop + 14;
  if (ch.charge !== false) {
    ctx.fillStyle = "#18a058";
    ctx.fillRect(legX, legY - 8, 8, 8);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 10px Consolas, monospace";
    ctx.textAlign = "left";
    ctx.fillText("VBUS", legX + 12, legY);
    legX += 54;

    ctx.fillStyle = "#e05a70";
    ctx.fillRect(legX, legY - 8, 8, 8);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("IBUS", legX + 12, legY);
    legX += 54;
  }
  if (ch.power) {
    ctx.fillStyle = "#2080f0";
    ctx.fillRect(legX, legY - 8, 8, 8);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("PWR", legX + 12, legY);
    legX += 48;
  }

  // 水印 POWER-Z (微透)
  ctx.save();
  ctx.font = "900 24px Consolas, monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  ctx.textAlign = "right";
  ctx.fillText("POWER-Z", w - padRight - 12, h - padBottom - 12);
  ctx.restore();

  // 3. 空闲/未连接状态提示处理
  if (!samples || samples.length < 2) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!pzState || !pzState.isConnected) {
      ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#8c98b2";
      ctx.fillText("🔌 等待连接 ChargerLAB Power-Z 硬件设备...", w / 2, h / 2 - 10);
      ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#5d6980";
      ctx.fillText("请使用 Type-C 数据线将 KM003C / KM002C 连入电脑 USB 端口", w / 2, h / 2 + 14);
    } else {
      ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#00e676";
      ctx.fillText("⚡ KM003C 物理硬件已就绪，正在同步高精度遥测推流...", w / 2, h / 2);
    }
    ctx.restore();
    ctx.restore();
    return;
  }

  const zoom = (pzState && pzState.zoom) ? pzState.zoom : 1.0;
  const windowCount = Math.min(samples.length, Math.round(300 / zoom));
  const pts = samples.slice(-windowCount);

  // 底部时间轴刻度
  if (pts.length >= 2) {
    const tStart = pts[0].time;
    const tEnd = pts[pts.length - 1].time;
    ctx.fillStyle = "#707d99";
    ctx.font = "10px Consolas, monospace";
    for (let c = 0; c <= gridCols; c++) {
      const x = padLeft + (c / gridCols) * plotW;
      const tAt = tStart + (c / gridCols) * (tEnd - tStart);
      ctx.textAlign = c === 0 ? "left" : c === gridCols ? "right" : "center";
      const s = Math.floor(tAt % 60);
      const m = Math.floor((tAt / 60) % 60);
      ctx.fillText(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, x, h - 8);
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(padLeft, padTop, plotW, plotH);
  ctx.clip();

  // 4. 各通道曲线渲染 (严格受控于顶部 Pills 开关状态)

  // (1) CHARGE 主通道: VBUS 绿色荧光曲线
  if (ch.charge !== false) {
    ctx.beginPath();
    ctx.strokeStyle = "#00e676";
    ctx.shadowColor = "rgba(0,230,118,0.4)";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const y = padTop + plotH - (pts[i].vbus / maxV) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // IBUS 红色珊瑚曲线
    ctx.beginPath();
    ctx.strokeStyle = "#ff5252";
    ctx.shadowColor = "rgba(255,82,82,0.4)";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const y = padTop + plotH - (pts[i].ibus / maxI) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // (2) POWER 通道: 功率金色流光曲线
  if (ch.power) {
    ctx.beginPath();
    ctx.strokeStyle = "#ffd54f";
    ctx.shadowColor = "rgba(255,213,79,0.45)";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const y = padTop + plotH - (pts[i].pwr / maxP) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // (3) DP/DM 通道: 差分数据线电压曲线 (DP 青蓝 / DM 暖橙)
  if (ch.dpdm) {
    // DP: #00e5ff
    ctx.beginPath();
    ctx.strokeStyle = "#00e5ff";
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const dpVal = pts[i].dp !== undefined ? pts[i].dp : 0;
      const y = padTop + plotH - (dpVal / 3.6) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // DM: #ff9100
    ctx.beginPath();
    ctx.strokeStyle = "#ff9100";
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const dmVal = pts[i].dm !== undefined ? pts[i].dm : 0;
      const y = padTop + plotH - (dmVal / 3.6) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // (4) CC1/CC2 通道: 配置通道握手曲线 (CC1 薰衣紫 / CC2 亮紫)
  if (ch.cc) {
    // CC1: #ba68c8
    ctx.beginPath();
    ctx.strokeStyle = "#ba68c8";
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const cc1Val = pts[i].cc1 !== undefined ? pts[i].cc1 : 0;
      const y = padTop + plotH - (cc1Val / 5.0) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // CC2: #7c4dff
    ctx.beginPath();
    ctx.strokeStyle = "#7c4dff";
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 4]);
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const cc2Val = pts[i].cc2 !== undefined ? pts[i].cc2 : 0;
      const y = padTop + plotH - (cc2Val / 5.0) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // (5) TEMP 通道: 温度曲线 (墨绿/青翠)
  if (ch.temp) {
    ctx.beginPath();
    ctx.strokeStyle = "#26a69a";
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < pts.length; i++) {
      const x = padLeft + (i / (pts.length - 1)) * plotW;
      const tVal = pts[i].temp !== undefined ? pts[i].temp : 30;
      const y = padTop + plotH - (tVal / 80.0) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // (6) 十字光标动态探针
  if (pzState && pzState.mouseX >= padLeft && pzState.mouseX <= w - padRight) {
    const relX = pzState.mouseX - padLeft;
    const idx = Math.max(0, Math.min(pts.length - 1, Math.round((relX / plotW) * (pts.length - 1))));
    const activePt = pts[idx];
    const snapX = padLeft + (idx / (pts.length - 1)) * plotW;

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(snapX, padTop);
    ctx.lineTo(snapX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    if (ch.charge !== false) {
      const snapYv = padTop + plotH - (activePt.vbus / maxV) * plotH;
      const snapYi = padTop + plotH - (activePt.ibus / maxI) * plotH;
      ctx.fillStyle = "#00e676";
      ctx.beginPath(); ctx.arc(snapX, snapYv, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff5252";
      ctx.beginPath(); ctx.arc(snapX, snapYi, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (ch.power) {
      const snapYp = padTop + plotH - (activePt.pwr / maxP) * plotH;
      ctx.fillStyle = "#ffd54f";
      ctx.beginPath(); ctx.arc(snapX, snapYp, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
  ctx.restore();
}

function drawPdMiniScope(canvas, pzState) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width, h = rect.height;
  if (w <= 0 || h <= 0) return;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padLeft = 46;
  const padRight = 50;
  const padTop = 16;
  const padBottom = 22;
  const plotW = Math.max(10, w - padLeft - padRight);
  const plotH = Math.max(10, h - padTop - padBottom);

  // 1. 绘制工业暗色网格与 3 轴刻度
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  const rows = 5;
  for (let r = 0; r <= rows; r++) {
    const y = padTop + (r / rows) * plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    // 左轴: VBUS (0.000V ~ 10.000V)
    const vVal = (10.0 - (r / rows) * 10.0).toFixed(3);
    ctx.fillStyle = "#00e5ff";
    ctx.font = "9px Consolas, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${vVal}V`, padLeft - 5, y + 3);

    // 右轴: IBUS (0.000A ~ 4.000A)
    const iVal = (4.0 - (r / rows) * 4.0).toFixed(3);
    ctx.fillStyle = "#ff5252";
    ctx.textAlign = "left";
    ctx.fillText(`${iVal}A`, w - padRight + 4, y + 3);

    // 最右轴: CC1/CC2 (0.00V ~ 4.00V)
    const ccVal = (4.0 - (r / rows) * 4.0).toFixed(2);
    ctx.fillStyle = "#ba68c8";
    ctx.textAlign = "right";
    ctx.fillText(`${ccVal}V`, w - 2, y + 3);
  }

  const cols = 5;
  for (let c = 0; c <= cols; c++) {
    const x = padLeft + (c / cols) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();
  }

  // 底部时间轴刻度
  ctx.fillStyle = "#707d99";
  ctx.font = "9px Consolas, monospace";
  ctx.textAlign = "center";
  const tLabels = ["00:00:00.0", "00:00:20.0", "00:00:40.0", "00:01:00.0", "00:01:20.0", "00:01:40.0"];
  for (let c = 0; c <= cols; c++) {
    const x = padLeft + (c / cols) * plotW;
    ctx.fillText(tLabels[c] || "", x, h - 6);
  }

  if (!pzState || !pzState.pdPackets || pzState.pdPackets.length === 0) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#63708a";
    ctx.fillText("🔌 等待连接设备捕获 PD 时序信号...", padLeft + plotW / 2, padTop + plotH / 2);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(padLeft, padTop, plotW, plotH);
  ctx.clip();

  // 2. CC1 BMC 脉冲包 (紫色 #ba68c8)
  const ccZeroY = padTop + plotH - (0.4 / 4.0) * plotH;
  const ccHighY = padTop + plotH - (3.25 / 4.0) * plotH;
  ctx.strokeStyle = "#ba68c8";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(padLeft, ccZeroY);
  const pulseStart = padLeft + plotW * 0.18;
  const pulseEnd = padLeft + plotW * 0.38;
  for (let x = padLeft; x <= w - padRight; x += 2) {
    let y = ccZeroY;
    if (x >= pulseStart && x <= pulseEnd) {
      const freq = (x - pulseStart) * 0.45;
      y = (Math.sin(freq) > 0) ? ccHighY : ccZeroY;
    }
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 3. VBUS 阶跃曲线 (青绿 #00e5ff: 5.0V -> 9.0V)
  const v5Y = padTop + plotH - (5.0 / 10.0) * plotH;
  const v9Y = padTop + plotH - (9.0 / 10.0) * plotH;
  const vStepX = padLeft + plotW * 0.35;
  const vRampEnd = padLeft + plotW * 0.48;
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(padLeft, v5Y);
  ctx.lineTo(vStepX, v5Y);
  for (let x = vStepX; x <= vRampEnd; x++) {
    const progress = (x - vStepX) / (vRampEnd - vStepX);
    const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    ctx.lineTo(x, v5Y - (v5Y - v9Y) * eased);
  }
  ctx.lineTo(w - padRight, v9Y);
  ctx.stroke();

  // 4. IBUS 阶跃曲线 (珊瑚红 #ff5252: 0.0A -> 2.18A)
  const i0Y = padTop + plotH;
  const i2Y = padTop + plotH - (2.18 / 4.0) * plotH;
  const iStepX = padLeft + plotW * 0.44;
  const iRampEnd = padLeft + plotW * 0.56;
  ctx.strokeStyle = "#ff5252";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(padLeft, i0Y);
  ctx.lineTo(iStepX, i0Y);
  for (let x = iStepX; x <= iRampEnd; x++) {
    const progress = (x - iStepX) / (iRampEnd - iStepX);
    const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    ctx.lineTo(x, i0Y - (i0Y - i2Y) * eased);
  }
  ctx.lineTo(w - padRight, i2Y);
  ctx.stroke();

  // 5. 官方标记 Source Cap 绿色事件戳
  const markerX = padLeft + plotW * 0.72;
  ctx.strokeStyle = "#18a058";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(markerX, padTop);
  ctx.lineTo(markerX, padTop + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // 标记文字 (Source Cap)
  ctx.fillStyle = "#18a058";
  ctx.font = "bold 10px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText("Source Cap", markerX, h - 7);

  ctx.restore();
}

function drawUfcsMiniScope(canvas, pzState) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width, h = rect.height;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let y = 20; y < h; y += 35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let x = 30; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }

  if (!pzState || !pzState.ufcsPackets || pzState.ufcsPackets.length === 0) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#63708a";
    ctx.fillText("等待连接设备进行 UFCS 握手捕获...", w / 2, h / 2);
    ctx.restore();
    return;
  }

  // 10mV/10mA 阶梯步进曲线
  ctx.strokeStyle = "#00e676";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const steps = 12;
  for (let s = 0; s <= steps; s++) {
    const x1 = 20 + (s / steps) * (w - 40);
    const x2 = 20 + ((s + 1) / steps) * (w - 40);
    const volt = 5.0 + (s / steps) * 4.2;
    const y = h - ((volt / 11) * (h - 30) + 15);
    if (s === 0) ctx.moveTo(x1, y); else ctx.lineTo(x1, y);
    ctx.lineTo(x2, y);
  }
  ctx.stroke();

  ctx.font = "10px Consolas, monospace";
  ctx.fillStyle = "#00e676"; ctx.fillText("UFCS 10mV/Step 动态调压轨迹 (5.0V → 9.2V)", 14, 20);
  ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ensureChartTip, canvasChart, drawSingleCharts, drawCompareCharts,
    drawMultiChart, drawDischargeCompareChart,
    drawPowerzScope, drawPdMiniScope, drawUfcsMiniScope
  };
}
