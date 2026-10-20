/**
 * MagpieObservabilityService
 * 安全桥接本机 Magpie 网关 (127.0.0.1:3425) 的只读内存快照接口，
 * 提供订阅额度卡片、配速计算、OLS 线性回归耗尽预测、走势 SVG 生成与网关用量融合。
 *
 * 红线约束：
 *  - 自动刷新/首页打开只允许读取纯内存快照端点
 *    (GET /v1/magpie/quotas/cards、/v1/magpie/quotas?kept=1、/v1/magpie/quotas/history、/v1/magpie/usage)；
 *  - 严禁在自动轮询中不带 ?kept=1 请求 /v1/magpie/quotas 触发上游厂商轮询；
 *  - 仅用户手动点击刷新时才调用 POST /v1/magpie/quotas/refresh（服务端自带 30s 互斥锁）；
 *  - 1500ms 短超时 + 全异步非阻塞 + 离线静默兜底（返回 lastGood 缓存）。
 */
class MagpieObservabilityService {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:3425').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || 1500;
    // /v1/magpie/usage 服务端需扫描会话账本聚合，实测延迟 1.6s~8s；
    // 额度卡/历史为纯内存快照(~ms级)仍走 1500ms，usage 单独放宽且全异步不阻塞首屏
    this.usageTimeoutMs = options.usageTimeoutMs || 5000;
    this.cacheTtlMs = options.cacheTtlMs || 8000;
    this._snapshotCache = {
      at: 0,
      online: false,
      cards: [],
      histories: [],
      usageByPeriod: {},
      lastGoodCards: [],
      lastGoodHistories: []
    };
  }

  /**
   * 映射工作台周期到 Magpie 周期参数
   * workbench: 'today' | 'week' | 'month' | 'all'
   * magpie:    'today' | '7d'   | '30d'   | 'all'
   */
  mapPeriod(range) {
    if (range === 'today') return 'today';
    if (range === 'week' || range === '7d') return '7d';
    if (range === 'month' || range === '30d') return '30d';
    return 'all';
  }

  /**
   * 轻量异步 HTTP JSON 请求 (基于 Node 内置 http，1500ms 超时，绝不抛异常)
   */
  requestJson(method, urlPath, timeoutMs = this.timeoutMs) {
    return new Promise((resolve) => {
      try {
        const http = require('http');
        const urlObj = new URL(urlPath, this.baseUrl);
        const req = http.request(
          {
            hostname: urlObj.hostname,
            port: urlObj.port || 3425,
            path: urlObj.pathname + urlObj.search,
            method: method || 'GET',
            timeout: timeoutMs,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'TabonKB-Workbench-Observability/1.0'
            }
          },
          (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  resolve({ ok: true, status: res.statusCode, data: JSON.parse(raw) });
                  return;
                } catch (_) {}
              }
              resolve({ ok: false, status: res.statusCode || 0, data: null });
            });
          }
        );
        req.on('timeout', () => {
          try { req.destroy(); } catch (_) {}
          resolve({ ok: false, status: 0, data: null, timeout: true });
        });
        req.on('error', () => {
          resolve({ ok: false, status: 0, data: null });
        });
        req.end();
      } catch (_) {
        resolve({ ok: false, status: 0, data: null });
      }
    });
  }

  /**
   * 获取只读观测快照（纯内存读取：/v1/magpie/quotas/cards + /v1/magpie/quotas/history + /v1/magpie/usage）
   * 绝不触发上游厂商 API 请求
   */
  async fetchSnapshot(range = 'week', force = false) {
    const period = this.mapPeriod(range);
    const now = Date.now();
    if (!force && this._snapshotCache.at > 0 && (now - this._snapshotCache.at) < this.cacheTtlMs && this._snapshotCache.usageByPeriod[period]) {
      return {
        online: this._snapshotCache.online,
        cards: this._snapshotCache.cards,
        histories: this._snapshotCache.histories,
        usage: this._snapshotCache.usageByPeriod[period] || null,
        fromCache: true
      };
    }

    const [cardsRes, keptRes, histRes, usageRes] = await Promise.all([
      this.requestJson('GET', '/v1/magpie/quotas/cards'),
      this.requestJson('GET', '/v1/magpie/quotas?kept=1'),
      this.requestJson('GET', '/v1/magpie/quotas/history?days=30'),
      this.requestJson('GET', `/v1/magpie/usage?period=${encodeURIComponent(period)}`, this.usageTimeoutMs)
    ]);

    const online = Boolean(cardsRes.ok || keptRes.ok || usageRes.ok);
    let rawCards = [];
    if (cardsRes.ok && cardsRes.data && Array.isArray(cardsRes.data.data)) {
      rawCards = cardsRes.data.data;
    } else if (keptRes.ok && keptRes.data && Array.isArray(keptRes.data.data)) {
      rawCards = keptRes.data.data;
    }

    // 合并 keptRes 中的 Holds / LastServedAt 信息（如果 cards 中未带）
    if (rawCards.length > 0 && keptRes.ok && keptRes.data && Array.isArray(keptRes.data.data)) {
      const keptMap = new Map();
      for (const kq of keptRes.data.data) {
        keptMap.set(`${kq.provider || ''}|${String(kq.user || '').toLowerCase()}`, kq);
      }
      for (const c of rawCards) {
        const match = keptMap.get(`${c.provider || ''}|${String(c.user || '').toLowerCase()}`);
        if (match) {
          if (!c.lastServedAt && match.lastServedAt) c.lastServedAt = match.lastServedAt;
          if (Array.isArray(c.windows) && Array.isArray(match.windows)) {
            c.windows.forEach((w, idx) => {
              const mw = match.windows.find(x => x.name === w.name) || match.windows[idx];
              if (mw) {
                if (!w.holds && mw.holds) w.holds = mw.holds;
                if (!w.holdsWhy && mw.holdsWhy) w.holdsWhy = mw.holdsWhy;
                if (!w.remaining && mw.remaining) w.remaining = mw.remaining;
              }
            });
          }
        }
      }
    }

    const histories = (histRes.ok && histRes.data && Array.isArray(histRes.data.data))
      ? histRes.data.data
      : this._snapshotCache.lastGoodHistories;

    if (online) {
      this._snapshotCache.at = now;
      this._snapshotCache.online = true;
      this._snapshotCache.cards = rawCards;
      this._snapshotCache.histories = histories;
      if (rawCards.length > 0) this._snapshotCache.lastGoodCards = rawCards;
      if (histories && histories.length > 0) this._snapshotCache.lastGoodHistories = histories;
      if (usageRes.ok && usageRes.data) {
        this._snapshotCache.usageByPeriod[period] = usageRes.data;
      }
    } else {
      this._snapshotCache.online = false;
    }

    return {
      online,
      cards: online ? rawCards : this._snapshotCache.lastGoodCards,
      histories: online ? histories : this._snapshotCache.lastGoodHistories,
      usage: (usageRes.ok && usageRes.data) ? usageRes.data : (this._snapshotCache.usageByPeriod[period] || null),
      fromCache: false
    };
  }

  /**
   * 手动触发单个账号或全量卡片刷新 (对应 POST /v1/magpie/quotas/refresh，服务端自带 30s 节流)
   */
  async refreshQuotaCard(provider = '', user = '') {
    let qs = '';
    if (provider) {
      qs = `?provider=${encodeURIComponent(provider)}&user=${encodeURIComponent(user || '')}`;
    }
    const res = await this.requestJson('POST', `/v1/magpie/quotas/refresh${qs}`, 8000);
    this._snapshotCache.at = 0;
    return res.ok;
  }

  /**
   * 在 /v1/magpie/quotas/history 返回的 [{provider,user,lines:[{name,points}]}] 结构中，
   * 定位某张额度卡片某个窗口对应的折线采样点数组。
   */
  findHistoryPoints(card, win, histories) {
    const arr = Array.isArray(histories) ? histories : [];
    const prov = String((card && card.provider) || '').toLowerCase();
    const user = String((card && card.user) || '').toLowerCase();
    const wname = String((win && win.name) || '').toLowerCase();
    const cands = arr.filter(h => String(h.provider || '').toLowerCase() === prov);
    const entry = cands.find(h => String(h.user || '').toLowerCase() === user) || cands[0];
    if (!entry) return [];
    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    const line = lines.find(l => String(l.name || '').toLowerCase() === wname)
      || lines.find(l => {
        const ln = String(l.name || '').toLowerCase();
        return ln && wname && (ln.includes(wname) || wname.includes(ln));
      })
      || lines[0];
    return (line && Array.isArray(line.points)) ? line.points : [];
  }

  /**
   * 账号脱敏打码 (与 Magpie maskUser 一致:保留首尾字符)
   */
  maskUser(user, masked = false) {
    const s = String(user || '').trim();
    if (!s || !masked) return s;
    const atIdx = s.indexOf('@');
    if (atIdx > 1) {
      const local = s.slice(0, atIdx);
      const domain = s.slice(atIdx);
      return local[0] + '***' + local[local.length - 1] + domain;
    }
    if (s.length <= 3) return s[0] + '**';
    return s.slice(0, 2) + '***' + s.slice(-1);
  }

  /**
   * 推断窗口周期起点与终点 (复刻 Magpie windowCycle / window_pace.go)
   * resetsAt 缺失时回退 runsOutAt（WorkBuddy Credits 窗口语义：用尽日即窗口终点）
   */
  inferWindowCycle(win, points = [], nowMs = Date.now()) {
    const resetMs = win && (win.resetsAt || win.runsOutAt) ? Date.parse(win.resetsAt || win.runsOutAt) : NaN;
    let startMs = win && win.startsAt ? Date.parse(win.startsAt) : NaN;
    if (!Number.isFinite(startMs) && Array.isArray(points) && points.length > 0) {
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].start) {
          const t = Date.parse(points[i].start);
          if (Number.isFinite(t)) { startMs = t; break; }
        }
      }
    }
    if (!Number.isFinite(startMs) && Number.isFinite(resetMs)) {
      const name = String((win && win.name) || '').toLowerCase();
      let spanMs = 30 * 86400000; // 默认月度 30 天
      if (name.includes('5h') || name.includes('5 小时') || name.includes('5-hour') || name.includes('five')) {
        spanMs = 5 * 3600000;
      } else if (name.includes('week') || name.includes('周') || name.includes('7d')) {
        spanMs = 7 * 86400000;
      } else if (name.includes('day') || name.includes('日') || name.includes('24h') || name === 'daily') {
        spanMs = 86400000;
      }
      startMs = resetMs - spanMs;
    }
    if (!Number.isFinite(startMs) || !Number.isFinite(resetMs) || resetMs <= startMs) {
      return null;
    }
    return { start: startMs, reset: resetMs, now: nowMs };
  }

  /**
   * 计算配速 (复刻 Magpie internal/provider/window_pace.go: Pace = Used% - Even%)
   */
  computePace(win, points = [], nowMs = Date.now()) {
    if (!win || win.unlimited) return null;
    const used = Number(win.used);
    if (!Number.isFinite(used)) return null;
    const cycle = this.inferWindowCycle(win, points, nowMs);
    if (!cycle) return null;
    if (nowMs <= cycle.start || nowMs >= cycle.reset) return null;
    const elapsedShare = (nowMs - cycle.start) / (cycle.reset - cycle.start);
    if (elapsedShare < 0.02) return null; // 刚重置前 2% 周期不报配速
    const evenPct = elapsedShare * 100;
    const diff = Math.round(used - evenPct);
    const sign = diff > 0 ? '+' : '';
    return {
      diff,
      evenPct,
      label: `配速 ${sign}${diff}%`,
      status: diff > 15 ? 'fast' : diff < -10 ? 'slow' : 'even'
    };
  }

  /**
   * 提取当前重置周期内的折线采样点 (复刻 Magpie cycleSegments)
   */
  extractCurrentCyclePoints(points = [], cycle = null, currentLeft = null, nowMs = Date.now()) {
    const valid = (points || [])
      .map(p => ({
        t: Date.parse(p.at),
        left: Number(p.left),
        start: p.start ? Date.parse(p.start) : NaN,
        resetsAt: p.resetsAt ? Date.parse(p.resetsAt) : NaN
      }))
      .filter(p => Number.isFinite(p.t) && Number.isFinite(p.left));

    let cur = [];
    for (let i = 0; i < valid.length; i++) {
      const p = valid[i];
      if (cycle && p.t < cycle.start - 300000) continue;
      if (cur.length > 0) {
        const prev = cur[cur.length - 1];
        // 检测周期重置跳变：剩余额度暴涨 > 20% 或 reset 时间后移超过间隔 + 5 分钟
        const refilled = (p.left - prev.left) > 20;
        const resetMoved = Number.isFinite(prev.resetsAt) && Number.isFinite(p.resetsAt) &&
          (p.resetsAt - prev.resetsAt) > ((p.t - prev.t) + 300000);
        if (refilled || resetMoved) cur = [];
      }
      cur.push(p);
    }

    if (Number.isFinite(currentLeft)) {
      if (cur.length === 0 || Math.abs(nowMs - cur[cur.length - 1].t) > 10000) {
        cur.push({ t: nowMs, left: Math.max(0, Math.min(100, currentLeft)) });
      }
    }
    return cur;
  }

  /**
   * OLS 一元线性回归预测耗尽时间 (完整移植 Magpie app.js:quotaEta)
   */
  computeQuotaEta(points = [], cycle = null, nowMs = Date.now()) {
    if (!cycle || !Array.isArray(points) || points.length < 2) return null;
    const span = points[points.length - 1].t - points[0].t;
    if (span < 10 * 60 * 1000) return null; // 至少需要 10 分钟跨度的采样点

    const t0 = points[0].t;
    const n = points.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of points) {
      const x = p.t - t0;
      const y = p.left;
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const denom = n * sxx - sx * sx;
    if (denom <= 0) return null;
    const slope = (n * sxy - sx * sy) / denom; // 每毫秒剩余百分比变化率
    const cur = points[n - 1];

    if (cur.left <= 0) return null;
    // 斜率 >= 0 或预测耗尽时间超过重置时间 -> 能撑到重置
    if (slope >= 0) {
      return { safe: true, text: '按此速度，能撑到重置' };
    }
    const outMs = cur.t - cur.left / slope;
    if (!Number.isFinite(outMs) || outMs <= nowMs) return null;
    if (outMs >= cycle.reset) {
      return { safe: true, text: '按此速度，能撑到重置' };
    }
    const dt = new Date(outMs);
    const timeStr = `${dt.getMonth() + 1}月${dt.getDate()}日 ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return { safe: false, outMs, text: `按此速度，将于 ${timeStr} 耗尽` };
  }

  /**
   * 绘制 300×60 剩余额度走势 SVG (完整移植 Magpie app.js:drawQuotaPlot)
   */
  renderQuotaPlotSvg(win, rawPoints = [], nowMs = Date.now()) {
    const used = Number(win && win.used);
    const currentLeft = Number.isFinite(used) ? Math.max(0, Math.min(100, 100 - used)) : null;
    const cycle = this.inferWindowCycle(win, rawPoints, nowMs);
    const pts = this.extractCurrentCyclePoints(rawPoints, cycle, currentLeft, nowMs);
    if (pts.length < 2 && !cycle) {
      return { svg: '', eta: null };
    }

    const W = 300, H = 60, padX = 3, padY = 5;
    const pw = W - padX * 2, ph = H - padY * 2;
    const tMin = cycle ? Math.min(cycle.start, pts[0] ? pts[0].t : cycle.start) : pts[0].t;
    const tMax = cycle ? Math.max(cycle.reset, nowMs) : Math.max(pts[pts.length - 1].t, nowMs + 60000);
    const tSpan = Math.max(1, tMax - tMin);

    const xOf = (t) => padX + Math.max(0, Math.min(1, (t - tMin) / tSpan)) * pw;
    const yOf = (left) => padY + (1 - Math.max(0, Math.min(100, left)) / 100) * ph;

    // 1. 理想匀速消耗参考虚线 (从周期起点 100% 到重置终点 0%)
    let evenLine = '';
    if (cycle) {
      evenLine = `<line class="tw-mq-qc-even" x1="${xOf(cycle.start).toFixed(1)}" y1="${yOf(100).toFixed(1)}" x2="${xOf(cycle.reset).toFixed(1)}" y2="${yOf(0).toFixed(1)}" />`;
    }

    // 2. 当前时刻竖线
    let nowLine = '';
    if (cycle && nowMs >= cycle.start && nowMs <= cycle.reset) {
      const nx = xOf(nowMs).toFixed(1);
      nowLine = `<line class="tw-mq-qc-now" x1="${nx}" y1="${padY}" x2="${nx}" y2="${H - padY}" />`;
    }

    // 3. 实测剩余额度折线与渐变填充
    let pathD = '', areaD = '', lastDot = '';
    if (pts.length >= 1) {
      const coords = pts.map(p => [xOf(p.t), yOf(p.left)]);
      if (coords.length === 1 && cycle) {
        coords.unshift([xOf(cycle.start), yOf(100)]);
      }
      if (coords.length >= 2) {
        pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
        const firstX = coords[0][0].toFixed(1);
        const lastX = coords[coords.length - 1][0].toFixed(1);
        const baseY = (H - padY).toFixed(1);
        areaD = `${pathD} L${lastX},${baseY} L${firstX},${baseY} Z`;
      }
      const last = coords[coords.length - 1];
      lastDot = `<circle class="tw-mq-qc-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.8" />`;
    }

    const eta = this.computeQuotaEta(pts, cycle, nowMs);
    const svg = `
      <svg class="tw-mq-qc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line class="tw-mq-qc-grid" x1="${padX}" y1="${yOf(50).toFixed(1)}" x2="${W - padX}" y2="${yOf(50).toFixed(1)}" />
        ${evenLine}
        ${nowLine}
        ${areaD ? `<path class="tw-mq-qc-area" d="${areaD}" />` : ''}
        ${pathD ? `<path class="tw-mq-qc-line" d="${pathD}" />` : ''}
        ${lastDot}
      </svg>`;
    return { svg, eta, cycle };
  }

  /**
   * 格式化整窗容量预估文案 (复刻 Magpie window_holds.go 文案逻辑)
   */
  formatWindowHolds(win, fmtTokFn) {
    if (!win) return '';
    const fmt = typeof fmtTokFn === 'function' ? fmtTokFn : (n) => String(n);
    if (win.holds && (win.holds.tokens > 0 || win.holds.calls > 0)) {
      const parts = [];
      if (win.holds.tokens > 0) parts.push(`≈${fmt(win.holds.tokens)} tok`);
      if (win.holds.cost > 0.01) parts.push(`~$${Number(win.holds.cost).toFixed(2)}`);
      else if (win.holds.calls > 0) parts.push(`${win.holds.calls} 次调用`);
      return `整窗：${parts.join(' · ')}`;
    }
    return '整窗：数据不足';
  }
}

module.exports = { MagpieObservabilityService };
