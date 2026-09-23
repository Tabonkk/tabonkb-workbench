/* ==========================================================================
   WeKnora Graph Engine — 高性能 Canvas 2D 知识图谱渲染与交互引擎
   外形参考: 蒲公英扇簇星云 + 外围茧环 (Obsidian Galaxy / Cocoon Ring Topology)
   双主题体系:
   1. 石墨疏朗 (浅底灰阶 · 疏朗宁静) [默认]
   2. 柔和科技沉浸 (浅色微光晕 · 科技质感)
   ========================================================================== */

class WeKnoraGraphEngine {
  /**
   * @param {HTMLElement} containerEl
   * @param {object} options
   */
  constructor(containerEl, options = {}) {
    this.containerEl = containerEl;
    this.onNodeClick = options.onNodeClick || (() => {});
    this.onNodeHover = options.onNodeHover || (() => {});
    this.onCanvasClick = options.onCanvasClick || (() => {});

    // 数据集合
    this.nodes = [];
    this.edges = [];
    this.nodeMap = new Map();
    this.adjMap = new Map();   // nodeId -> Set<neighborId>
    this.edgeMap = new Map();  // "source::target" -> edge

    // 变换矩阵与视口
    this.transform = { x: 0, y: 0, scale: 0.85 };
    this.width = containerEl.clientWidth || 800;
    this.height = containerEl.clientHeight || 550;

    // 交互状态
    this.hoveredNode = null;
    this.selectedNode = null;
    this.draggedNode = null;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };

    // 搜索高亮集合
    this.highlightedNodeIds = new Set();
    this.highlightedEdgeKeys = new Set();
    this.neighborNodeIds = new Set();
    this.primaryTargetNodeIds = new Set();

    // 双主题架构 (默认: 石墨疏朗 graphite)
    this.currentTheme = 'graphite';

    // 力学与视觉参数 (调优星云茧环外形)
    this.params = {
      clusterStrength: 0.08,
      repulsion: 800,
      linkDistance: 28,
      crossClusterDistance: 60,
      linkStrength: 0.20,
      centerForce: 0.005,
      friction: 0.84,
      clusterSpread: 1.0,
      nodeScale: 0.6,
      edgeOpacity: 0.50,
      fontSize: 3
    };

    // 物理仿真控制
    this.alpha = 1.0;
    this.alphaMin = 0.005;
    this.alphaDecay = 0.96;
    this.animFrameId = null;
    this.isSimulating = false;
    this.hasFitted = false;
    this.simStepCount = 0;

    // 沉浸主题备选色盘
    this.typeColors = {
      entity: '#10B981',       // 实体 - 绿色
      concept: '#F59E0B',      // 概念 - 橙色
      summary: '#3B82F6',      // 摘要 - 蓝色
      synthesis: '#8B5CF6',    // 综合 - 紫色
      default: '#64748B'       // 默认 - 灰蓝
    };

    // DOM 初始化
    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tw-weknora-graph-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.cursor = 'grab';
    this.containerEl.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  }

  resize() {
    if (!this.canvas || !this.containerEl) return;
    const rect = this.containerEl.getBoundingClientRect();
    const w = Math.max(100, Math.floor(rect.width));
    const h = Math.max(100, Math.floor(rect.height));
    this.width = w;
    this.height = h;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.requestRender();
  }

  setData(data = { nodes: [], edges: [] }) {
    this.nodes = [];
    this.edges = [];
    this.nodeMap.clear();
    this.adjMap.clear();
    this.edgeMap.clear();

    const rawNodes = data.nodes || [];
    const rawEdges = data.edges || [];

    // 1. 初始化节点对象
    rawNodes.forEach((n, i) => {
      const id = n.slug || n.id || String(i);
      const degree = Number(n.link_count || n.degree || 0);
      const pageType = (n.page_type || n.pageType || 'entity').toLowerCase();

      const nodeObj = {
        id,
        slug: n.slug || id,
        title: n.title || id,
        displayName: n.title || id,
        pageType,
        degree,
        referenceCount: degree,
        summary: n.summary || '',
        vx: 0,
        vy: 0,
        radius: 4.0,
        color: this.typeColors[pageType] || this.typeColors.default,
        isCoreAnchor: false
      };

      this.nodes.push(nodeObj);
      this.nodeMap.set(id, nodeObj);
      this.adjMap.set(id, new Set());
    });

    // 2. 建立关联边映射
    rawEdges.forEach((e) => {
      const s = e.source?.id || e.source;
      const t = e.target?.id || e.target;
      if (this.nodeMap.has(s) && this.nodeMap.has(t)) {
        const edgeObj = {
          source: s,
          target: t,
          weight: e.weight || 1
        };
        this.edges.push(edgeObj);
        this.adjMap.get(s)?.add(t);
        this.adjMap.get(t)?.add(s);
        this.edgeMap.set(`${s}::${t}`, edgeObj);
        this.edgeMap.set(`${t}::${s}`, edgeObj);
      }
    });

    // 3. 计算实际关联度数并标记顶层核心地标 (Top 10-12 枢纽常显文字, 其余仅悬停显示)
    const sorted = [...this.nodes].sort((a, b) => {
      const degA = this.adjMap.get(a.id)?.size || a.degree || 0;
      const degB = this.adjMap.get(b.id)?.size || b.degree || 0;
      return degB - degA;
    });

    const topCount = Math.min(12, Math.max(5, Math.floor(this.nodes.length * 0.05)));
    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i];
      node.degree = this.adjMap.get(node.id)?.size || node.degree || 0;
      if (i < topCount || node.degree >= 30) {
        node.isCoreAnchor = true;
      }
    }

    // 4. 应用星爆茧环 (蒲公英外向扇簇 + 核心星云 + 外围圆环) 拓扑几何布局
    this.hasFitted = false;
    this.simStepCount = 0;
    this.applyStarburstGalaxyLayout();
    this.wakeSimulation(1.0);
  }

  /**
   * 星爆茧环星云拓扑算法 (Starburst Galaxy & Cocoon Ring Layout)
   * 结构特征:
   * 1. 核心密集星云: 高度数枢纽群位于内层椭圆核心相互交织
   * 2. 外向蒲公英扇簇: 围绕各大枢纽的关联叶子节点, 沿中心放射线向外呈孔雀开屏/扇形发散
   * 3. 外围茧环 (Cocoon Ring): 孤立/度数<=1的边缘节点沿外圈圆周均匀星落分布, 形成完美的圆形星环边界
   */
  applyStarburstGalaxyLayout() {
    const spread = this.params.clusterSpread || 1.0;
    const w = this.width || 800;
    const h = this.height || 550;
    const cx = w / 2;
    const cy = h / 2;
    const N = this.nodes.length;
    if (!N) return;

    // 1. 节点度数统计
    const degMap = new Map();
    this.nodes.forEach(n => {
      const d = this.adjMap.get(n.id)?.size || n.degree || 0;
      degMap.set(n.id, d);
    });

    // 2. 划分节点层级
    const sortedNodes = [...this.nodes].sort((a, b) => degMap.get(b.id) - degMap.get(a.id));
    
    // 超级枢纽核心群 (Top Degree Hubs)
    const coreHubs = sortedNodes.filter(n => degMap.get(n.id) >= 6 || n.isCoreAnchor);
    const coreHubSet = new Set(coreHubs.map(n => n.id));

    // 次级关联枢纽
    const subHubs = sortedNodes.filter(n => !coreHubSet.has(n.id) && degMap.get(n.id) >= 3);
    const allHubSet = new Set([...coreHubSet, ...subHubs.map(n => n.id)]);

    // 核心枢纽：以内椭圆为基座分布 (R = 45 ~ 110 * spread)
    coreHubs.forEach((h, i) => {
      const ang = (i / Math.max(1, coreHubs.length)) * Math.PI * 2 + 0.5;
      const rad = (45 + (i % 3) * 32) * spread;
      h.clusterX = cx + rad * Math.cos(ang) * 1.15;
      h.clusterY = cy + rad * Math.sin(ang) * 0.92;
      h._fanSlot = 0;
    });

    // 次级枢纽：分布在次中层 (R = 110 ~ 180 * spread)
    subHubs.forEach((h, i) => {
      const ang = (i / Math.max(1, subHubs.length)) * Math.PI * 2 + 1.2;
      const rad = (110 + (i % 4) * 24) * spread;
      h.clusterX = cx + rad * Math.cos(ang) * 1.18;
      h.clusterY = cy + rad * Math.sin(ang) * 0.94;
      h._fanSlot = 0;
    });

    // 寻找叶子节点所属的最大度数枢纽
    const hubOf = new Map();
    this.edges.forEach(e => {
      const sIsHub = allHubSet.has(e.source);
      const tIsHub = allHubSet.has(e.target);
      if (sIsHub && !tIsHub) {
        if (!hubOf.has(e.target) || degMap.get(e.source) > degMap.get(hubOf.get(e.target))) {
          hubOf.set(e.target, e.source);
        }
      } else if (tIsHub && !sIsHub) {
        if (!hubOf.has(e.source) || degMap.get(e.target) > degMap.get(hubOf.get(e.source))) {
          hubOf.set(e.source, e.target);
        }
      }
    });

    // 外围茧环半长/短轴 (参考用户上图的外围星点环)
    const baseR = Math.min(w, h) * 0.44 * spread;
    const outerR_X = baseR * 1.12;
    const outerR_Y = baseR * 0.95;
    let ringIndex = 0;

    // 遍历所有节点赋予初始几何坐标
    this.nodes.forEach((n) => {
      if (allHubSet.has(n.id)) {
        n.x = n.clusterX + (Math.random() - 0.5) * 6;
        n.y = n.clusterY + (Math.random() - 0.5) * 6;
        return;
      }

      const hid = hubOf.get(n.id);
      if (hid) {
        // 放射扇簇 (蒲公英开花): 以所属枢纽为基点，沿中心向外的背向法线方向散开
        const parentHub = this.nodeMap.get(hid);
        if (parentHub && parentHub.clusterX != null) {
          const slot = parentHub._fanSlot || 0;
          parentHub._fanSlot = slot + 1;

          // 背离中心向量角
          const baseAng = Math.atan2(parentHub.clusterY - cy, parentHub.clusterX - cx);
          // 扇面张角 (每层 14 节点均匀放射)
          const ang = baseAng + ((slot % 12) - 5.5) * 0.17;
          const rad = (22 + Math.floor(slot / 12) * 15 + (slot % 3) * 4) * spread;

          n.clusterX = parentHub.clusterX + rad * Math.cos(ang);
          n.clusterY = parentHub.clusterY + rad * Math.sin(ang);
        } else {
          n.clusterX = cx;
          n.clusterY = cy;
        }
      } else {
        // 边缘弱关联/孤立点: 沿外围圆环 (Cocoon Ring) 黄金分割螺旋散布, 构成最外层完美的边界环
        ringIndex++;
        const ang = (ringIndex * 2.399963) % (Math.PI * 2);
        const jitter = (Math.random() - 0.5) * 14;
        n.clusterX = cx + (outerR_X + jitter) * Math.cos(ang);
        n.clusterY = cy + (outerR_Y + jitter) * Math.sin(ang);
      }

      n.x = n.clusterX + (Math.random() - 0.5) * 5;
      n.y = n.clusterY + (Math.random() - 0.5) * 5;
    });
  }

  setTheme(themeKey) {
    if (themeKey !== 'graphite' && themeKey !== 'immersive') {
      themeKey = 'graphite';
    }
    this.currentTheme = themeKey;
    this.hasFitted = false;
    this.simStepCount = 0;
    this.applyStarburstGalaxyLayout();
    this.wakeSimulation(0.85);
  }

  setParams(newParams = {}) {
    Object.assign(this.params, newParams);
    this.applyStarburstGalaxyLayout();
    this.wakeSimulation(0.35);
  }

  resetParams() {
    this.params = {
      clusterStrength: 0.08,
      repulsion: 800,
      linkDistance: 28,
      crossClusterDistance: 60,
      linkStrength: 0.20,
      centerForce: 0.005,
      friction: 0.84,
      clusterSpread: 1.0,
      nodeScale: 0.6,
      edgeOpacity: 0.50,
      fontSize: 3
    };
    this.setTheme('graphite');
  }

  // --------------------------------------------------------------------------
  // 物理模拟循环 (物理收敛冷却后彻底停帧, 0% CPU 占用)
  // --------------------------------------------------------------------------
  wakeSimulation(alpha = 0.3) {
    this.alpha = Math.max(this.alpha, alpha);
    if (!this.isSimulating) {
      this.isSimulating = true;
      this.tick();
    }
  }

  tick() {
    if (!this.isSimulating) return;

    this.simStepCount = (this.simStepCount || 0) + 1;

    if (this.alpha < this.alphaMin) {
      this.alpha = 0;
      this.isSimulating = false;
      this.animFrameId = null;
      if (!this.hasFitted) {
        this.fitBounds(0.78);
        this.hasFitted = true;
      }
      this.render();
      return;
    }

    this.stepPhysics();
    this.render();

    // 在第 22 步骨架形成时自动贴合适配视野
    if (this.simStepCount === 22 && !this.hasFitted) {
      this.fitBounds(0.78);
      this.hasFitted = true;
    }

    this.animFrameId = requestAnimationFrame(() => this.tick());
  }

  stepPhysics() {
    const { clusterStrength, repulsion, linkDistance, crossClusterDistance, linkStrength, centerForce, friction } = this.params;
    const w = this.width || 800;
    const h = this.height || 550;
    const cx = w / 2;
    const cy = h / 2;
    const N = this.nodes.length;

    // 1. 节点间排斥力 (保证扇簇展开与呼吸间距)
    for (let i = 0; i < N; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < N; j++) {
        const n2 = this.nodes[j];
        let dx = n2.x - n1.x;
        let dy = n2.y - n1.y;
        let d2 = dx * dx + dy * dy;
        if (!(d2 > 0.01)) {
          const ang = (i * 2.399963 + j) % (Math.PI * 2);
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        if (d < 220) {
          const force = (repulsion / (d2 + 25)) * this.alpha;
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          if (!n1.fixed) { n1.vx -= fx; n1.vy -= fy; }
          if (!n2.fixed) { n2.vx += fx; n2.vy += fy; }
        }
      }
    }

    // 2. 连线弹簧引力 (维持拓扑骨架)
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const source = this.nodeMap.get(e.source);
      const target = this.nodeMap.get(e.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const isSameModule = source.pageType === target.pageType;
      const targetDist = isSameModule ? linkDistance : crossClusterDistance;
      const strength = isSameModule ? linkStrength : (linkStrength * 0.25);

      const displacement = Math.max(-48, Math.min(48, d - targetDist));
      const force = displacement * strength * (e.weight || 1.0) * this.alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;

      if (!source.fixed) { source.vx += fx; source.vy += fy; }
      if (!target.fixed) { target.vx -= fx; target.vy -= fy; }
    }

    // 3. 向心聚拢约束与全局居中力 (维持星云轮廓)
    for (let i = 0; i < N; i++) {
      const n = this.nodes[i];
      if (n.fixed || n === this.draggedNode) continue;

      if (n.clusterX !== undefined) {
        n.vx += (n.clusterX - n.x) * clusterStrength * this.alpha;
        n.vy += (n.clusterY - n.y) * clusterStrength * this.alpha;
      }

      n.vx += (cx - n.x) * centerForce * this.alpha;
      n.vy += (cy - n.y) * centerForce * this.alpha;

      n.vx *= friction;
      n.vy *= friction;
      const maxV = 18;
      n.vx = Math.max(-maxV, Math.min(maxV, n.vx));
      n.vy = Math.max(-maxV, Math.min(maxV, n.vy));
      n.x += n.vx;
      n.y += n.vy;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 8000 || Math.abs(n.y) > 8000) {
        n.x = (n.clusterX != null) ? n.clusterX : cx;
        n.y = (n.clusterY != null) ? n.clusterY : cy;
        n.vx = 0;
        n.vy = 0;
      }
    }

    // 4. 碰撞硬防重叠 (Collision Avoidance)
    const nScale = this.params.nodeScale || 0.6;
    for (let i = 0; i < N; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < N; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const d = Math.hypot(dx, dy) || 1;
        const r1 = Math.max(1.6, Math.min(6.5, 1.6 + (n1.degree || 0) * 0.35)) * nScale;
        const r2 = Math.max(1.6, Math.min(6.5, 1.6 + (n2.degree || 0) * 0.35)) * nScale;
        const minDist = r1 + r2 + 4.0;
        if (d < minDist) {
          const overlap = (minDist - d) * 0.5;
          if (!n1.fixed) { n1.x -= (dx / d) * overlap; n1.y -= (dy / d) * overlap; }
          if (!n2.fixed) { n2.x += (dx / d) * overlap; n2.y += (dy / d) * overlap; }
        }
      }
    }

    this.alpha *= this.alphaDecay;
  }

  fitBounds(occupancy = 0.78) {
    if (this.nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
      const pad = 24;
      if (n.x - pad < minX) minX = n.x - pad;
      if (n.x + pad > maxX) maxX = n.x + pad;
      if (n.y - pad < minY) minY = n.y - pad;
      if (n.y + pad > maxY) maxY = n.y + pad;
    });
    if (minX === Infinity) return;

    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const targetW = this.width * (occupancy + 0.02);
    const targetH = this.height * occupancy;

    const scaleX = targetW / gw;
    const scaleY = targetH / gh;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.18), 2.2);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    if (!Number.isFinite(newScale) || !Number.isFinite(midX) || !Number.isFinite(midY)) return;

    this.transform.scale = newScale;
    this.transform.x = this.width / 2 - midX * newScale;
    this.transform.y = this.height / 2 - midY * newScale;
    this.requestRender();
  }

  centerGraph() {
    this.fitBounds(0.78);
  }

  requestRender() {
    if (this.isSimulating) return;
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(() => {
      this._renderPending = false;
      this.render();
    });
  }

  // --------------------------------------------------------------------------
  // Canvas 绘制流水线
  // --------------------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    // 1. 完全清除整张画布像素缓冲 (彻底消除切视口或重绘时的重影与残留虚影)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);

    const th = this.currentTheme;

    // 2. 主题背景绘制
    if (th === 'graphite') {
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // 柔和科技沉浸式
      const bgGrad = ctx.createRadialGradient(this.width/2, this.height/2, 30, this.width/2, this.height/2, Math.max(this.width, this.height) * 0.85);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(0.5, '#F9FBFE');
      bgGrad.addColorStop(1, '#F1F5F9');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      // 发丝级微网格
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const gStep = 44;
      for (let x = 0; x < this.width; x += gStep) { ctx.moveTo(x, 0); ctx.lineTo(x, this.height); }
      for (let y = 0; y < this.height; y += gStep) { ctx.moveTo(0, y); ctx.lineTo(this.width, y); }
      ctx.stroke();
      ctx.restore();
    }

    // 摄像机视口变换
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    const curScale = Math.max(0.35, this.transform.scale);
    const activeNode = this.hoveredNode || this.selectedNode;
    const hasHighlight = this.highlightedNodeIds.size > 0;
    const edgeScale = (this.params.edgeOpacity !== undefined ? this.params.edgeOpacity : 0.50) / 0.50;
    const nScale = this.params.nodeScale || 0.6;
    const fSize = Math.max(1, Math.min(5, (this.params.fontSize || 3)));

    // 视口边界裁剪
    const margin = 80;
    const vMinX = (-this.transform.x - margin) / curScale;
    const vMaxX = (this.width - this.transform.x + margin) / curScale;
    const vMinY = (-this.transform.y - margin) / curScale;
    const vMaxY = (this.height - this.transform.y + margin) / curScale;

    // 3. 绘制连线 (主题严格契合: 石墨疏朗采用高雅深墨灰 #334155, 科技沉浸采用科技蓝)
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const s = this.nodeMap.get(e.source);
      const t = this.nodeMap.get(e.target);
      if (!s || !t) continue;

      const sIn = s.x >= vMinX && s.x <= vMaxX && s.y >= vMinY && s.y <= vMaxY;
      const tIn = t.x >= vMinX && t.x <= vMaxX && t.y >= vMinY && t.y <= vMaxY;
      if (!sIn && !tIn) continue;

      const isCross = s.pageType !== t.pageType;
      const isConnected = activeNode && (e.source === activeNode.id || e.target === activeNode.id);
      const isEdgeSearchHigh = hasHighlight && (this.highlightedEdgeKeys.has(`${s.id}::${t.id}`) || this.highlightedEdgeKeys.has(`${t.id}::${s.id}`));

      let strokeColor = (th === 'graphite') ? '#9B9B9B' : '#94A3B8';
      let alpha = (isCross ? 0.10 : 0.22) * edgeScale;
      let lineWidth = 0.50 / curScale;

      if (hasHighlight) {
        if (isEdgeSearchHigh) {
          alpha = 0.88;
          strokeColor = (th === 'graphite') ? '#334155' : '#2563EB';
          lineWidth = 0.85 / curScale;
        } else {
          alpha = 0.03;
        }
      } else if (activeNode) {
        if (isConnected) {
          alpha = 0.88;
          strokeColor = (th === 'graphite') ? '#1E293B' : (activeNode.color || '#2563EB');
          lineWidth = 0.85 / curScale;
        } else {
          alpha = 0.04;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.restore();
    }

    // 4. 绘制节点
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.x < vMinX || n.x > vMaxX || n.y < vMinY || n.y > vMaxY) continue;

      const isSelected = this.selectedNode && this.selectedNode.id === n.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === n.id;
      const isNeighbor = activeNode && this.adjMap.get(activeNode.id)?.has(n.id);
      const isPrimarySearch = hasHighlight && this.primaryTargetNodeIds && this.primaryTargetNodeIds.has(n.id);
      const isSearchNeighbor = hasHighlight && this.neighborNodeIds.has(n.id);

      const deg = n.degree || 0;
      let r = Math.max(1.6, Math.min(6.5, 1.6 + deg * 0.35)) * nScale;
      
      let fill = '#9A9A9A';
      if (th === 'graphite') {
        fill = deg >= 6 ? '#4B4B4B' : (deg >= 3 ? '#6F6F6F' : '#9A9A9A');
      } else {
        fill = deg >= 6 ? '#2563EB' : (deg >= 3 ? '#0EA5E9' : (n.color || '#94A3B8'));
      }

      let alpha = 1.0;
      if (hasHighlight) {
        if (isPrimarySearch) {
          alpha = 1.0;
          r *= 1.25;
          fill = (th === 'graphite') ? '#0F172A' : '#2563EB';
        } else if (isSearchNeighbor) {
          alpha = 0.82;
          r *= 1.05;
          fill = (th === 'graphite') ? '#475569' : '#0EA5E9';
        } else {
          alpha = 0.08;
          fill = (th === 'graphite') ? '#CBD5E1' : '#E2E8F0';
        }
      } else if (activeNode) {
        if (isHovered || isSelected) {
          alpha = 1.0;
        } else if (isNeighbor) {
          alpha = 0.95;
        } else {
          alpha = 0.18;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // 选中/悬停/搜索主命中外环 (石墨疏朗为深墨色 #0F172A, 沉浸式为科技蓝)
      if (isSelected || isHovered || isPrimarySearch) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 2.4, 0, Math.PI * 2);
        ctx.strokeStyle = (th === 'graphite') ? '#0F172A' : '#2563EB';
        ctx.lineWidth = 1.0 / curScale;
        ctx.stroke();
      }

      // 核心枢纽节点微光环 (科技沉浸专属)
      if (deg >= 6 && !hasHighlight && th === 'immersive') {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4.0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
        ctx.fill();
      }

      // 节点实体圆
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8 / curScale;
      ctx.stroke();

      ctx.restore();
    }

    // 5. 绘制文字标签 (严格防覆盖与防重影: 碰撞避让 + 整数像素 + 极微描边)
    const drawnLabelBoxes = [];
    const labelCandidates = [];

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.x < vMinX || n.x > vMaxX || n.y < vMinY || n.y > vMaxY) continue;

      const isSelected = this.selectedNode && this.selectedNode.id === n.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === n.id;
      const isPrimarySearch = hasHighlight && this.primaryTargetNodeIds && this.primaryTargetNodeIds.has(n.id);
      const isCoreHub = n.isCoreAnchor && !activeNode && !hasHighlight;

      let priority = 0;
      if (isSelected) priority = 4;
      else if (isHovered) priority = 3;
      else if (isPrimarySearch) priority = 2;
      else if (isCoreHub) priority = 1;

      if (priority > 0) {
        labelCandidates.push({ node: n, priority, isSelected, isHovered, isPrimarySearch });
      }
    }

    // 优先绘制高优先级标签 (选中 > 悬停 > 搜索主命中 > 核心枢纽)
    labelCandidates.sort((a, b) => b.priority - a.priority);

    ctx.save();
    ctx.font = `600 ${fSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    for (const item of labelCandidates) {
      const n = item.node;
      let text = n.displayName || n.title || '';

      // 对过长文件/文献标题进行智能缩略，防止横向贯通遮挡多个节点
      if (text.length > 20 && !item.isSelected && !item.isHovered) {
        text = text.slice(0, 11) + '...' + text.slice(-5);
      }

      const deg = n.degree || 0;
      const r = Math.max(1.6, Math.min(6.5, 1.6 + deg * 0.35)) * nScale;
      const labelX = Math.round(n.x + r + Math.max(2, fSize * 0.4));
      const labelY = Math.round(n.y);

      // 计算文字边界盒并执行碰撞检测 (Collision Avoidance)
      const tw = ctx.measureText(text).width;
      const thBox = fSize + 2;
      const box = { x: labelX - 2, y: labelY - thBox / 2, w: tw + 4, h: thBox };

      let collided = false;
      for (const b of drawnLabelBoxes) {
        if (box.x < b.x + b.w && box.x + box.w > b.x &&
            box.y < b.y + b.h && box.y + box.h > b.y) {
          collided = true;
          break;
        }
      }

      // 若与已绘制的更高优先级标签碰撞且非选定焦点，则自动避让，绝不重叠涂抹
      if (collided && !item.isSelected && !item.isHovered) {
        continue;
      }

      drawnLabelBoxes.push(box);

      // 极细微描边光晕 (0.4~0.8px 细线, 杜绝向内侵蚀字体导致重影模糊)
      ctx.strokeStyle = (th === 'graphite') ? 'rgba(250, 250, 250, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = Math.max(0.3, Math.min(0.8, fSize * 0.18)) / curScale;
      ctx.lineJoin = 'miter';
      ctx.strokeText(text, labelX, labelY);

      let textColor = (th === 'graphite') ? '#1E293B' : '#0F172A';
      if (item.isSelected) textColor = '#2563EB';
      else if (item.isPrimarySearch) textColor = (th === 'graphite') ? '#0F172A' : '#1D4ED8';

      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, labelX, labelY);
    }
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 搜索与拓扑高亮联动 (智能过滤收敛: 严控主目标数与邻居爆炸)
  // --------------------------------------------------------------------------
  setHighlightedNodes(targetNodeIds = []) {
    this.highlightedNodeIds.clear();
    this.highlightedEdgeKeys.clear();
    this.neighborNodeIds.clear();
    this.primaryTargetNodeIds.clear();

    if (!targetNodeIds || !targetNodeIds.length) {
      this.requestRender();
      return;
    }

    // 1. 严格收敛主匹配目标 (最多 3-5 个最相关实体)
    const validTargets = targetNodeIds.filter(tid => this.nodeMap.has(tid)).slice(0, 5);
    validTargets.forEach(tid => {
      this.highlightedNodeIds.add(tid);
      this.primaryTargetNodeIds.add(tid);
    });

    // 2. 优先高亮主目标相互之间的连线
    for (let i = 0; i < validTargets.length; i++) {
      for (let j = i + 1; j < validTargets.length; j++) {
        const key1 = `${validTargets[i]}::${validTargets[j]}`;
        const key2 = `${validTargets[j]}::${validTargets[i]}`;
        if (this.edgeMap.has(key1) || this.edgeMap.has(key2)) {
          this.highlightedEdgeKeys.add(key1);
          this.highlightedEdgeKeys.add(key2);
        }
      }
    }

    // 3. 节制的邻居关联扩展 (限制每个主节点最多带出 2 个高权重邻居，总邻居上限 6 个)
    let addedNeighbors = 0;
    const maxNeighbors = 6;

    for (const tid of validTargets) {
      if (addedNeighbors >= maxNeighbors) break;
      const neighbors = Array.from(this.adjMap.get(tid) || []);
      neighbors.sort((a, b) => (this.nodeMap.get(b)?.degree || 0) - (this.nodeMap.get(a)?.degree || 0));
      for (const nid of neighbors.slice(0, 2)) {
        if (addedNeighbors >= maxNeighbors) break;
        if (!this.highlightedNodeIds.has(nid)) {
          this.neighborNodeIds.add(nid);
          this.highlightedNodeIds.add(nid);
          addedNeighbors++;
        }
        this.highlightedEdgeKeys.add(`${tid}::${nid}`);
        this.highlightedEdgeKeys.add(`${nid}::${tid}`);
      }
    }

    this.requestRender();
  }

  clearHighlight() {
    this.highlightedNodeIds.clear();
    this.highlightedEdgeKeys.clear();
    this.neighborNodeIds.clear();
    this.primaryTargetNodeIds.clear();
    this.requestRender();
  }

  // --------------------------------------------------------------------------
  // 鼠标交互事件绑定
  // --------------------------------------------------------------------------
  bindEvents() {
    this._onMouseDown = (e) => this.handleMouseDown(e);
    this._onMouseMove = (e) => this.handleMouseMove(e);
    this._onMouseUp = (e) => this.handleMouseUp(e);
    this._onWheel = (e) => this.handleWheel(e);
    this._onClick = (e) => this.handleClick(e);
    this._onDblClick = (e) => this.handleDblClick(e);

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('click', this._onClick);
    this.canvas.addEventListener('dblclick', this._onDblClick);
  }

  screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const px = sx - rect.left;
    const py = sy - rect.top;
    return {
      x: (px - this.transform.x) / this.transform.scale,
      y: (py - this.transform.y) / this.transform.scale
    };
  }

  findNodeAt(sx, sy) {
    const { x, y } = this.screenToWorld(sx, sy);
    const nScale = this.params.nodeScale || 0.6;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = n.x - x;
      const dy = n.y - y;
      const hitR = Math.max((n.radius || 4) * nScale + 4, 10);
      if (dx * dx + dy * dy <= hitR * hitR) return n;
    }
    return null;
  }

  handleMouseDown(e) {
    if (e.button !== 0) return;
    const node = this.findNodeAt(e.clientX, e.clientY);
    if (node) {
      this.draggedNode = node;
      node.fixed = true;
      this.canvas.style.cursor = 'grabbing';
      this.wakeSimulation(0.2);
    } else {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
      this.canvas.style.cursor = 'grabbing';
    }
  }

  handleMouseMove(e) {
    if (this.draggedNode) {
      const { x, y } = this.screenToWorld(e.clientX, e.clientY);
      this.draggedNode.x = x;
      this.draggedNode.y = y;
      this.draggedNode.vx = 0;
      this.draggedNode.vy = 0;
      this.wakeSimulation(0.1);
      return;
    }

    if (this.isPanning) {
      this.transform.x = e.clientX - this.panStart.x;
      this.transform.y = e.clientY - this.panStart.y;
      this.requestRender();
      return;
    }

    const hovered = this.findNodeAt(e.clientX, e.clientY);
    if (hovered !== this.hoveredNode) {
      this.hoveredNode = hovered;
      this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
      this.requestRender();
      this.onNodeHover(hovered, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  handleMouseUp() {
    if (this.draggedNode) {
      this.draggedNode.fixed = false;
      this.draggedNode = null;
      this.canvas.style.cursor = 'grab';
    }
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'grab';
    }
  }

  handleWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.18, Math.min(3.5, this.transform.scale * zoomFactor));

    this.transform.x = mouseX - (mouseX - this.transform.x) * (newScale / this.transform.scale);
    this.transform.y = mouseY - (mouseY - this.transform.y) * (newScale / this.transform.scale);
    this.transform.scale = newScale;

    this.requestRender();
  }

  handleClick(e) {
    const node = this.findNodeAt(e.clientX, e.clientY);
    if (node) {
      this.selectedNode = node;
      this.onNodeClick(node);
      this.requestRender();
    } else {
      this.selectedNode = null;
      this.onCanvasClick();
      this.requestRender();
    }
  }

  handleDblClick(e) {
    const node = this.findNodeAt(e.clientX, e.clientY);
    if (node) {
      this.focusNode(node.id);
    }
  }

  focusNode(nodeId) {
    const n = this.nodeMap.get(nodeId);
    if (!n) return;
    this.selectedNode = n;
    const scale = Math.max(1.1, this.transform.scale);
    this.transform = {
      x: this.width / 2 - n.x * scale,
      y: this.height / 2 - n.y * scale,
      scale
    };
    this.requestRender();
  }

  // --------------------------------------------------------------------------
  // 资源释放
  // --------------------------------------------------------------------------
  dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isSimulating = false;

    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);
      this.canvas.removeEventListener('wheel', this._onWheel);
      this.canvas.removeEventListener('click', this._onClick);
      this.canvas.removeEventListener('dblclick', this._onDblClick);
      this.canvas.remove();
      this.canvas = null;
    }
    this.ctx = null;
    this.nodes = [];
    this.edges = [];
    this.nodeMap.clear();
    this.adjMap.clear();
    this.edgeMap.clear();
    this.highlightedNodeIds.clear();
    this.highlightedEdgeKeys.clear();
    this.neighborNodeIds.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeKnoraGraphEngine };
}
