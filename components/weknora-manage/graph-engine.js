/* ==========================================================================
   WeKnora Graph Engine — 高性能 Canvas 2D 银河知识图谱渲染与交互引擎
   视觉架构参考: Obsidian Galaxy View (NASA Eyes on Asteroids 启发)
   三大主题体系:
   1. 深空星系 (cosmic) — 经典深空暗黑、恒星光晕与瑰丽星轨 [推荐默认]
   2. 石墨银河 (graphite) — 浅底灰阶、纸墨星图与高雅疏朗
   3. 科技星云 (immersive) — 清新蓝调、明亮微光与科技质感
   ========================================================================== */

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(56, 189, 248, ${alpha})`;
  if (hex.startsWith('rgba')) return hex;
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

    // 星空背景与领域星云集合
    this.starDust = [];
    this.domainClusters = [];
    this.initStarField();

    // 摄像机空间平滑运镜飞跃状态 (Cinematic Camera Fly-to)
    this._cameraAnimId = null;

    // 星座连线穿梭光子脉冲流状态 (Traveling Photon Waves)
    this.photonTime = 0;
    this._photonAnimId = null;

    // 渲染完成通知钩子 (用于同步全景雷达导航仪 HUD)
    this.onRenderCallback = null;

    // 主题体系 (默认: 科技星云 immersive, 兼具 cosmic / graphite)
    this.currentTheme = 'immersive';

    // 专注模式与视口右侧避让边距
    this.isEgoMode = false;
    this.viewportPaddingRight = 0;

    // 力学与视觉参数 (调优银河星系与星团外形)
    this.params = {
      clusterStrength: 0.07,
      repulsion: 1800,
      linkDistance: 32,
      crossClusterDistance: 130,
      linkStrength: 0.20,
      centerForce: 0.003,
      friction: 0.85,
      clusterSpread: 1.15,
      nodeScale: 0.75,
      edgeOpacity: 0.50,
      fontSize: 3.2
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

  initStarField() {
    this.starDust = [];
    let seed = 42;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // 3 层深度视差星海设计 (3-Tier Parallax Celestial Starfield)
    // Layer 0: 远景深空星团 (Deep Background) — 100 颗, 极微视差 (speed: 0.06), 细微冷灰/淡紫, 营造宇宙无穷纵深
    for (let i = 0; i < 100; i++) {
      this.starDust.push({
        layer: 0,
        speed: 0.06,
        x: rand() * 2400,
        y: rand() * 1600,
        size: 0.4 + rand() * 0.6,
        baseAlpha: 0.12 + rand() * 0.18,
        color: rand() > 0.6 ? '#93C5FD' : (rand() > 0.3 ? '#C4B5FD' : '#E2E8F0'),
        twinkleSpeed: 0,
        phase: 0
      });
    }

    // Layer 1: 中景星际星尘 (Mid-depth Stardust) — 80 颗, 中速视差 (speed: 0.18), 伴随温和呼吸微光
    for (let i = 0; i < 80; i++) {
      this.starDust.push({
        layer: 1,
        speed: 0.18,
        x: rand() * 2400,
        y: rand() * 1600,
        size: 0.8 + rand() * 0.9,
        baseAlpha: 0.20 + rand() * 0.30,
        color: rand() > 0.6 ? '#67E8F9' : (rand() > 0.3 ? '#A78BFA' : '#FFFFFF'),
        twinkleSpeed: 1.0 + rand() * 1.6,
        phase: rand() * Math.PI * 2
      });
    }

    // Layer 2: 近景闪烁星芒 (Foreground Stellar Micro-points) — 40 颗, 较高视差 (speed: 0.42), 恒星级光彩与高频呼吸闪烁
    for (let i = 0; i < 40; i++) {
      this.starDust.push({
        layer: 2,
        speed: 0.42,
        x: rand() * 2400,
        y: rand() * 1600,
        size: 1.2 + rand() * 1.1,
        baseAlpha: 0.35 + rand() * 0.45,
        color: rand() > 0.6 ? '#38BDF8' : (rand() > 0.3 ? '#FDE047' : '#FFFFFF'),
        twinkleSpeed: 2.0 + rand() * 2.5,
        phase: rand() * Math.PI * 2
      });
    }
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

    // 4. 动态自适应物理冷却与阻尼 (大节点规模自适应加速收敛)
    if (this.nodes.length >= 1200) {
      this.alphaDecay = 0.91;
      this.alphaMin = 0.010;
    } else if (this.nodes.length >= 700) {
      this.alphaDecay = 0.93;
      this.alphaMin = 0.008;
    } else {
      this.alphaDecay = 0.96;
      this.alphaMin = 0.005;
    }

    // 5. 应用星爆茧环 (蒲公英外向扇簇 + 核心星云 + 外围圆环) 拓扑几何布局
    this.hasFitted = false;
    this.simStepCount = 0;
    this.applyStarburstGalaxyLayout();
    this.wakeSimulation(1.0);
  }

  /**
   * 依据节点语义特征或天体光谱分配领域星系色彩 (多彩深空天体光谱)
   */
  getDomainColor(hub, index = 0, usedColors = new Set()) {
    if (!hub) return '#38BDF8';
    const text = `${hub.displayName || ''} ${hub.title || ''} ${hub.slug || ''} ${hub.id || ''}`.toLowerCase();
    
    let matchedColor = null;
    if (text.includes('charg') || text.includes('power') || text.includes('pmic') || text.includes('buck') || text.includes('boost') || text.includes('vbus') || text.includes('vbat') || text.includes('battery') || text.includes('电') || text.includes('充')) {
      matchedColor = '#F59E0B'; // 恒星烈焰金 (Solar Amber)
    } else if (text.includes('usb') || text.includes('typec') || text.includes('type-c') || text.includes('pd') || text.includes('cc') || text.includes('i2c') || text.includes('spi') || text.includes('bus') || text.includes('uart') || text.includes('gpio') || text.includes('协议')) {
      matchedColor = '#06B6D4'; // 赛博星云青 (Cyan / Aquamarine)
    } else if (text.includes('kernel') || text.includes('linux') || text.includes('driver') || text.includes('bsp') || text.includes('rk') || text.includes('android') || text.includes('dts') || text.includes('core') || text.includes('驱动') || text.includes('内核')) {
      matchedColor = '#10B981'; // 极光翡翠绿 (Aurora Emerald)
    } else if (text.includes('ic') || text.includes('hardware') || text.includes('schematic') || text.includes('pcb') || text.includes('datasheet') || text.includes('reg') || text.includes('chip') || text.includes('硬件') || text.includes('芯片') || text.includes('器件')) {
      matchedColor = '#8B5CF6'; // 恒星耀斑紫 (Royal Violet)
    } else if (text.includes('spec') || text.includes('standard') || text.includes('test') || text.includes('cert') || text.includes('cts') || text.includes('vts') || text.includes('规范') || text.includes('标准') || text.includes('测试') || text.includes('认证')) {
      matchedColor = '#EC4899'; // 超新星玫红 (Supernova Rose)
    } else if (text.includes('thermal') || text.includes('temp') || text.includes('heat') || text.includes('sensor') || text.includes('ntc') || text.includes('温') || text.includes('热')) {
      matchedColor = '#F97316'; // 炽热等离子橙 (Plasma Orange)
    } else if (text.includes('arch') || text.includes('guide') || text.includes('overview') || text.includes('system') || text.includes('doc') || text.includes('wiki') || text.includes('架构') || text.includes('概述') || text.includes('系统')) {
      matchedColor = '#6366F1'; // 深空靛蓝 (Deep Indigo)
    }

    const celestialSpectrum = [
      '#F59E0B', // 琥珀金
      '#06B6D4', // 青霓虹
      '#10B981', // 翡翠绿
      '#8B5CF6', // 极光紫
      '#EC4899', // 玫瑰粉
      '#6366F1', // 靛蓝
      '#F97316', // 烈焰橙
      '#14B8A6'  // 碧绿
    ];

    if (matchedColor && !usedColors.has(matchedColor)) {
      usedColors.add(matchedColor);
      return matchedColor;
    }
    for (const c of celestialSpectrum) {
      if (!usedColors.has(c)) {
        usedColors.add(c);
        return c;
      }
    }
    const fallback = matchedColor || celestialSpectrum[index % celestialSpectrum.length];
    return fallback;
  }

  /**
   * 银河旋臂盘面与星团拓扑算法 (Galactic Disc & Spiral Arm Topology)
   * 彻底解耦 300+ 节点的中心“黑毛球”死结:
   * 1. 领域星核定位 (Domain Centroids): 依据拓扑连通度与核心枢纽, 将图谱拆解为 5~8 个独立领域星团 (如 Charger, USB, Kernel, Spec 等), 沿大半径主盘面展开 (R = 130 ~ 260)
   * 2. 旋臂对数发散 (Spiral Arm Dispersion): 围绕各大枢纽的关联叶子节点, 沿阿基米德/对数螺旋展开, 呈星系旋臂流动, 预留充分呼吸间隔
   * 3. 外围星际茧环 (Kuiper Belt / Outer Halo): 弱关联与孤立星体在最外层轨道 (R = 340 ~ 500) 黄金分割均匀列阵
   */
  applyStarburstGalaxyLayout() {
    const spread = this.params.clusterSpread || 1.15;
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

    // 2. 提取超级枢纽与领域主核 (Top Degree Hubs)
    const sortedNodes = [...this.nodes].sort((a, b) => degMap.get(b.id) - degMap.get(a.id));
    
    // 选取领域主星核 (Top 6~10 个最高度数节点作为星系各大旋臂的引力中心)
    const maxHubCount = Math.min(10, Math.max(5, Math.floor(N / 25)));
    const coreHubs = sortedNodes.filter((n, idx) => (idx < maxHubCount && degMap.get(n.id) >= 4) || n.isCoreAnchor);
    const coreHubSet = new Set(coreHubs.map(n => n.id));

    // 次级关联支架枢纽
    const subHubs = sortedNodes.filter(n => !coreHubSet.has(n.id) && degMap.get(n.id) >= 3);
    const allHubSet = new Set([...coreHubSet, ...subHubs.map(n => n.id)]);

    // 领域星核沿大盘面螺旋展开 (消除中心扎堆堆叠, R = 130 ~ 260)
    const coreCount = Math.max(1, coreHubs.length);
    coreHubs.forEach((h, i) => {
      const ang = (i / coreCount) * Math.PI * 2 + 0.35;
      const rad = (130 + (i % 2) * 55 + (i % 3) * 20) * spread;
      h.clusterX = cx + rad * Math.cos(ang) * 1.12;
      h.clusterY = cy + rad * Math.sin(ang) * 0.94;
      h._fanSlot = 0;
      h._hubId = h.id;
    });

    // 次级枢纽分布在领域星核的外侧伴随轨道
    subHubs.forEach((h, i) => {
      const ang = (i / Math.max(1, subHubs.length)) * Math.PI * 2 + 1.1;
      const rad = (180 + (i % 3) * 45) * spread;
      h.clusterX = cx + rad * Math.cos(ang) * 1.15;
      h.clusterY = cy + rad * Math.sin(ang) * 0.95;
      h._fanSlot = 0;
      h._hubId = h.id;
    });

    // 3. 将所有节点关联至最近/最高权重的主导星核
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

    // 组建领域星云集合 (Domain Nebula Clusters) 与多彩天体光谱分配
    const clusterMap = new Map();
    const usedColors = new Set();
    coreHubs.forEach((hub, idx) => {
      const color = this.getDomainColor(hub, idx, usedColors);
      hub.color = color;
      hub.clusterColor = color;
      hub._hubId = hub.id;
      clusterMap.set(hub.id, {
        hub,
        color,
        nodes: [hub]
      });
    });

    // 次级关联支架枢纽颜色分配与归属绑定
    subHubs.forEach((sh, idx) => {
      let bestCore = null;
      let maxDeg = -1;
      const neighbors = this.adjMap.get(sh.id);
      if (neighbors) {
        for (const nId of neighbors) {
          if (coreHubSet.has(nId)) {
            const d = degMap.get(nId) || 0;
            if (d > maxDeg) {
              maxDeg = d;
              bestCore = this.nodeMap.get(nId);
            }
          }
        }
      }

      if (bestCore) {
        sh.color = bestCore.clusterColor;
        sh.clusterColor = bestCore.clusterColor;
        sh._hubId = bestCore.id;
        if (clusterMap.has(bestCore.id)) {
          clusterMap.get(bestCore.id).nodes.push(sh);
        }
      } else {
        const color = this.getDomainColor(sh, coreHubs.length + idx, usedColors);
        sh.color = color;
        sh.clusterColor = color;
        sh._hubId = sh.id;
        clusterMap.set(sh.id, {
          hub: sh,
          color,
          nodes: [sh]
        });
      }
    });

    // 4. 外围星际茧环 (Kuiper Belt)
    const baseR = Math.min(w, h) * 0.52 * spread;
    const outerR_X = baseR * 1.15;
    const outerR_Y = baseR * 0.96;
    let ringIndex = 0;

    // 5. 遍历并为所有节点赋予螺旋盘面几何初始位置与天体色彩
    this.nodes.forEach((n) => {
      if (allHubSet.has(n.id)) {
        n.x = n.clusterX + (Math.random() - 0.5) * 6;
        n.y = n.clusterY + (Math.random() - 0.5) * 6;
        return;
      }

      const hid = hubOf.get(n.id);

      if (hid && this.nodeMap.has(hid)) {
        const parentHub = this.nodeMap.get(hid);
        const slot = parentHub._fanSlot || 0;
        parentHub._fanSlot = slot + 1;

        // 继承主星核或所属星团的领域天体色彩
        const clusterColor = parentHub.clusterColor || parentHub.color || '#38BDF8';
        n.color = clusterColor;
        n.clusterColor = clusterColor;
        n._hubId = parentHub._hubId || parentHub.id;

        const effectiveClusterHubId = parentHub._hubId || parentHub.id;
        if (clusterMap.has(effectiveClusterHubId)) {
          clusterMap.get(effectiveClusterHubId).nodes.push(n);
        } else if (clusterMap.has(parentHub.id)) {
          clusterMap.get(parentHub.id).nodes.push(n);
        }

        // 阿基米德对数旋臂发散 (Spiral Arm Outward Dispersion)
        const baseAng = Math.atan2(parentHub.clusterY - cy, parentHub.clusterX - cx);
        // 旋臂角微偏移: 随序号渐进卷曲
        const armCurl = Math.sin(slot * 0.38) * 0.42;
        const armSpread = ((slot % 8) - 3.5) * 0.16;
        const ang = baseAng + armCurl + armSpread;
        // 距离随序号开方扩展, 杜绝向中心挤压
        const rad = (24 + Math.sqrt(slot + 1) * 16 + (slot % 3) * 5) * spread;

        n.clusterX = parentHub.clusterX + rad * Math.cos(ang);
        n.clusterY = parentHub.clusterY + rad * Math.sin(ang);
      } else {
        // 外围弱关联星点: 沿星际茧环黄金分割螺旋列阵 (柯伊伯带银灰星尘)
        n.color = '#94A3B8';
        n.clusterColor = '#94A3B8';
        n._hubId = null;
        ringIndex++;
        const ang = (ringIndex * 2.399963) % (Math.PI * 2);
        const jitter = (Math.random() - 0.5) * 16;
        n.clusterX = cx + (outerR_X + jitter) * Math.cos(ang);
        n.clusterY = cy + (outerR_Y + jitter) * Math.sin(ang);
      }

      n.x = n.clusterX + (Math.random() - 0.5) * 6;
      n.y = n.clusterY + (Math.random() - 0.5) * 6;
    });

    this.domainClusters = Array.from(clusterMap.values());
  }

  setTheme(themeKey) {
    if (themeKey !== 'cosmic' && themeKey !== 'graphite' && themeKey !== 'immersive') {
      themeKey = 'cosmic';
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
      clusterStrength: 0.07,
      repulsion: 1800,
      linkDistance: 32,
      crossClusterDistance: 130,
      linkStrength: 0.20,
      centerForce: 0.003,
      friction: 0.85,
      clusterSpread: 1.15,
      nodeScale: 0.75,
      edgeOpacity: 0.50,
      fontSize: 3.2
    };
    this.setTheme('immersive');
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
        this.fitBounds(0.96);
        this.hasFitted = true;
      }
      this.render();
      return;
    }

    this.stepPhysics();
    this.render();

    // 在第 22 步骨架形成时自动贴合适配视野 (适度放大展示)
    if (this.simStepCount === 22 && !this.hasFitted) {
      this.fitBounds(0.96);
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

    // 1. 节点间排斥力 (保证扇簇展开与呼吸间距, 跨领域集群实施强化斥力)
    const maxRepDistBase = N >= 1000 ? 180 : (N >= 600 ? 220 : 320);
    for (let i = 0; i < N; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < N; j++) {
        const n2 = this.nodes[j];
        let dx = n2.x - n1.x;
        if (dx > maxRepDistBase || dx < -maxRepDistBase) continue;
        let dy = n2.y - n1.y;
        if (dy > maxRepDistBase || dy < -maxRepDistBase) continue;

        let d2 = dx * dx + dy * dy;
        if (!(d2 > 0.01)) {
          const ang = (i * 2.399963 + j) % (Math.PI * 2);
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const isCrossCluster = n1._hubId && n2._hubId && n1._hubId !== n2._hubId;
        const maxRepDist = isCrossCluster ? maxRepDistBase : (maxRepDistBase * 0.75);
        if (d < maxRepDist) {
          const repFactor = isCrossCluster ? (repulsion * 1.6) : repulsion;
          const force = (repFactor / (d2 + 30)) * this.alpha;
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
      const isSameCluster = source._hubId && source._hubId === target._hubId;
      const isSameModule = source.pageType === target.pageType;
      
      const targetDist = isSameCluster ? linkDistance : (isSameModule ? (linkDistance * 1.4) : crossClusterDistance);
      const strength = isSameCluster ? linkStrength : (linkStrength * 0.16);

      const displacement = Math.max(-50, Math.min(50, d - targetDist));
      const force = displacement * strength * (e.weight || 1.0) * this.alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;

      if (!source.fixed) { source.vx += fx; source.vy += fy; }
      if (!target.fixed) { target.vx -= fx; target.vy -= fy; }
    }

    // 3. 向心聚拢约束、盘面旋臂切向微力与全局居中力
    for (let i = 0; i < N; i++) {
      const n = this.nodes[i];
      if (n.fixed || n === this.draggedNode) continue;

      if (n.clusterX !== undefined) {
        n.vx += (n.clusterX - n.x) * clusterStrength * this.alpha;
        n.vy += (n.clusterY - n.y) * clusterStrength * this.alpha;
      }

      // 星系盘面切向旋转微力 (Tangential Galactic Spin) — 驱散死板收拢, 展开螺旋盘面
      const toCenterX = n.x - cx;
      const toCenterY = n.y - cy;
      const distFromCenter = Math.hypot(toCenterX, toCenterY) || 1;
      if (distFromCenter > 20 && distFromCenter < 500) {
        const tangentX = -toCenterY / distFromCenter;
        const tangentY = toCenterX / distFromCenter;
        n.vx += tangentX * 0.05 * this.alpha;
        n.vy += tangentY * 0.05 * this.alpha;
      }

      n.vx += (cx - n.x) * centerForce * this.alpha;
      n.vy += (cy - n.y) * centerForce * this.alpha;

      n.vx *= friction;
      n.vy *= friction;
      const maxV = 16;
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

    // 4. 碰撞硬防重叠 (Collision Hard Avoidance)
    const nScale = this.params.nodeScale || 0.65;
    for (let i = 0; i < N; i++) {
      const n1 = this.nodes[i];
      const r1 = Math.max(1.8, Math.min(7.2, 1.8 + (n1.degree || 0) * 0.38)) * nScale;
      for (let j = i + 1; j < N; j++) {
        const n2 = this.nodes[j];
        const r2 = Math.max(1.8, Math.min(7.2, 1.8 + (n2.degree || 0) * 0.38)) * nScale;
        const minDist = r1 + r2 + 6.0;
        const dx = n2.x - n1.x;
        if (dx > minDist || dx < -minDist) continue;
        const dy = n2.y - n1.y;
        if (dy > minDist || dy < -minDist) continue;

        const d = Math.hypot(dx, dy) || 1;
        if (d < minDist) {
          const overlap = (minDist - d) * 0.5;
          if (!n1.fixed) { n1.x -= (dx / d) * overlap; n1.y -= (dy / d) * overlap; }
          if (!n2.fixed) { n2.x += (dx / d) * overlap; n2.y += (dy / d) * overlap; }
        }
      }
    }

    this.alpha *= this.alphaDecay;
  }

  /**
   * 平滑空间运镜飞跃 (Cinematic Camera Fly-to)
   * @param {number} targetX - 目标视口 X 偏移
   * @param {number} targetY - 目标视口 Y 偏移
   * @param {number} targetScale - 目标缩放比例
   * @param {number} duration - 飞跃耗时 (ms)
   */
  flyTo(targetX, targetY, targetScale, duration = 650) {
    this.cancelCameraAnimation();

    const startX = this.transform.x;
    const startY = this.transform.y;
    const startScale = this.transform.scale;
    const startTime = performance.now();

    const animateCamera = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Ease-out cubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);

      this.transform.x = startX + (targetX - startX) * ease;
      this.transform.y = startY + (targetY - startY) * ease;
      this.transform.scale = startScale + (targetScale - startScale) * ease;

      this.render();

      if (progress < 1.0) {
        this._cameraAnimId = requestAnimationFrame(animateCamera);
      } else {
        this._cameraAnimId = null;
      }
    };

    this._cameraAnimId = requestAnimationFrame(animateCamera);
  }

  cancelCameraAnimation() {
    if (this._cameraAnimId) {
      cancelAnimationFrame(this._cameraAnimId);
      this._cameraAnimId = null;
    }
  }

  startPhotonStream() {
    if (this._photonAnimId || this.isSimulating) return;
    const runPulse = () => {
      const activeNode = this.hoveredNode || this.selectedNode;
      const hasHighlight = this.highlightedNodeIds.size > 0;
      if (!activeNode && !hasHighlight) {
        this._photonAnimId = null;
        return;
      }
      this.photonTime = (this.photonTime || 0) + 0.022;
      this.render();
      this._photonAnimId = requestAnimationFrame(runPulse);
    };
    this._photonAnimId = requestAnimationFrame(runPulse);
  }

  stopPhotonStream() {
    if (this._photonAnimId) {
      cancelAnimationFrame(this._photonAnimId);
      this._photonAnimId = null;
    }
  }

  fitBounds(occupancy = 0.96, smooth = false, viewportPaddingRight = null) {
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

    // 如果抽屉打开，可用视口宽度减去右侧抽屉宽度 (例如 380px)
    const pr = viewportPaddingRight !== null ? viewportPaddingRight : (this.viewportPaddingRight || 0);
    const effWidth = Math.max(300, this.width - pr);

    const targetW = effWidth * (occupancy + 0.02);
    const targetH = this.height * occupancy;

    const scaleX = targetW / gw;
    const scaleY = targetH / gh;
    let rawScale = Math.min(scaleX, scaleY) * 1.25;

    // 专注模式 (Ego Mode) 下节点更聚焦，按用户图示放大尺寸展示
    if (this.isEgoMode) {
      rawScale = Math.max(rawScale * 1.6, 1.45);
    }

    const newScale = Math.min(Math.max(rawScale, 0.22), 3.2);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    if (!Number.isFinite(newScale) || !Number.isFinite(midX) || !Number.isFinite(midY)) return;

    // 水平中心对齐至有效可用视口区域 (避开右侧抽屉遮挡)
    const targetX = effWidth / 2 - midX * newScale;
    const targetY = this.height / 2 - midY * newScale;

    if (smooth) {
      this.flyTo(targetX, targetY, newScale, 700);
    } else {
      this.transform.scale = newScale;
      this.transform.x = targetX;
      this.transform.y = targetY;
      this.requestRender();
    }
  }

  centerGraph() {
    this.fitBounds(0.96, true);
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
  // Canvas 绘制流水线 (Galaxy View 沉浸级渲染流水线)
  // --------------------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    // 1. 完全清除整张画布像素缓冲
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);

    const th = this.currentTheme;

    // 2. 主题背景绘制
    if (th === 'cosmic') {
      // 深空星系经典暗夜渐变 (Galaxy Deep Space)
      const bgGrad = ctx.createRadialGradient(this.width / 2, this.height / 2, 40, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.9);
      bgGrad.addColorStop(0, '#0E1424');
      bgGrad.addColorStop(0.5, '#0A0E1A');
      bgGrad.addColorStop(1, '#06080F');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (th === 'graphite') {
      // 石墨银河高雅浅灰渐变
      const bgGrad = ctx.createRadialGradient(this.width / 2, this.height / 2, 40, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.85);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(0.7, '#F9FAFB');
      bgGrad.addColorStop(1, '#F3F4F6');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // 科技星云明快蓝调
      const bgGrad = ctx.createRadialGradient(this.width / 2, this.height / 2, 30, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.85);
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

    // 2.5 多层深度视差星海渲染 (3-Tier Parallax Celestial Starfield & Twinkle)
    if (th === 'cosmic' && this.starDust && this.starDust.length > 0) {
      const W = this.width || 800;
      const H = this.height || 550;
      const fieldW = Math.max(W * 1.8, 2400);
      const fieldH = Math.max(H * 1.8, 1600);
      const pTime = this.photonTime || 0;

      ctx.save();
      for (let i = 0; i < this.starDust.length; i++) {
        const s = this.starDust[i];
        // 视差位移计算 (无缝环形环绕)
        let sx = (s.x + this.transform.x * s.speed) % fieldW;
        if (sx < 0) sx += fieldW;
        let sy = (s.y + this.transform.y * s.speed) % fieldH;
        if (sy < 0) sy += fieldH;

        // 仅在当前画布可见范围内绘制
        if (sx > W + 8 || sy > H + 8) continue;

        // 呼吸闪烁微光
        let alpha = s.baseAlpha;
        if (s.twinkleSpeed > 0) {
          const tw = Math.sin(pTime * s.twinkleSpeed + s.phase);
          alpha = Math.max(0.06, s.baseAlpha + tw * 0.20);
        }

        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();

        // 近景高亮恒星绘制微型衍射十字芒或微光晕
        if (s.layer === 2 && s.size > 1.8 && alpha > 0.45) {
          ctx.globalAlpha = alpha * 0.35;
          ctx.beginPath();
          ctx.arc(sx, sy, s.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 摄像机视口变换
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    const curScale = Math.max(0.35, this.transform.scale);
    // 视距分级细节控制 (Zoom-LOD: far 宏观星系 / mid 星座系统 / near 行星表面)
    const lodTier = curScale < 0.65 ? 'far' : (curScale > 1.35 ? 'near' : 'mid');
    const activeNode = this.hoveredNode || this.selectedNode;
    const hasHighlight = this.highlightedNodeIds.size > 0;
    const edgeScale = (this.params.edgeOpacity !== undefined ? this.params.edgeOpacity : 0.50) / 0.50;
    const nScale = this.params.nodeScale || 0.65;
    const fSize = Math.max(1, Math.min(5, (this.params.fontSize || 3)));
    const cx = (this.width || 800) / 2;
    const cy = (this.height || 550) / 2;

    // 视口边界裁剪
    const margin = 100;
    const vMinX = (-this.transform.x - margin) / curScale;
    const vMaxX = (this.width - this.transform.x + margin) / curScale;
    const vMinY = (-this.transform.y - margin) / curScale;
    const vMaxY = (this.height - this.transform.y + margin) / curScale;

    // 4. 绘制领域星云纱幕 (Domain Nebula Veils)
    if (this.domainClusters && this.domainClusters.length > 0) {
      ctx.save();
      for (const cluster of this.domainClusters) {
        if (!cluster.hub || cluster.nodes.length < 2) continue;
        const h = cluster.hub;
        if (h.x < vMinX - 350 || h.x > vMaxX + 350 || h.y < vMinY - 350 || h.y > vMaxY + 350) continue;

        const nebulaR = Math.max(100, Math.min(280, Math.sqrt(cluster.nodes.length) * 42)) * (this.params.clusterSpread || 1.15);
        const grad = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, nebulaR);
        const baseCol = cluster.color || '#38BDF8';

        if (th === 'cosmic') {
          grad.addColorStop(0, hexToRgba(baseCol, 0.12));
          grad.addColorStop(0.5, hexToRgba(baseCol, 0.04));
          grad.addColorStop(1, hexToRgba(baseCol, 0));
        } else if (th === 'graphite') {
          grad.addColorStop(0, 'rgba(226, 232, 240, 0.40)');
          grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.18)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          grad.addColorStop(0, hexToRgba(baseCol, 0.08));
          grad.addColorStop(0.5, hexToRgba(baseCol, 0.02));
          grad.addColorStop(1, hexToRgba(baseCol, 0));
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, nebulaR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. 绘制弧形星轨连线 (Curved Link Filaments)
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const s = this.nodeMap.get(e.source);
      const t = this.nodeMap.get(e.target);
      if (!s || !t) continue;

      const sIn = s.x >= vMinX && s.x <= vMaxX && s.y >= vMinY && s.y <= vMaxY;
      const tIn = t.x >= vMinX && t.x <= vMaxX && t.y >= vMinY && t.y <= vMaxY;
      if (!sIn && !tIn) continue;

      const isCross = (s._hubId && t._hubId && s._hubId !== t._hubId);
      const isConnected = activeNode && (e.source === activeNode.id || e.target === activeNode.id);
      const isEdgeSearchHigh = hasHighlight && (this.highlightedEdgeKeys.has(`${s.id}::${t.id}`) || this.highlightedEdgeKeys.has(`${t.id}::${s.id}`));

      // 计算贝塞尔曲线外拱控制点 (消除中心线段纠缠)
      const midX = (s.x + t.x) * 0.5;
      const midY = (s.y + t.y) * 0.5;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const len = Math.hypot(dx, dy) || 1;

      let nx = -dy / len;
      let ny = dx / len;
      const toMidX = midX - cx;
      const toMidY = midY - cy;
      if (nx * toMidX + ny * toMidY < 0) {
        nx = -nx;
        ny = -ny;
      }
      const curvature = len < 14 ? 0 : Math.min(28, Math.max(3, len * 0.13));
      const ctrlX = midX + nx * curvature;
      const ctrlY = midY + ny * curvature;

      let strokeColor, alpha, lineWidth;
      if (th === 'cosmic') {
        strokeColor = isCross ? '#64748B' : (s.color || '#38BDF8');
        alpha = (isCross ? 0.12 : 0.22) * edgeScale;
        lineWidth = 0.55 / curScale;
      } else if (th === 'graphite') {
        strokeColor = isCross ? '#CBD5E1' : '#94A3B8';
        alpha = (isCross ? 0.12 : 0.25) * edgeScale;
        lineWidth = 0.50 / curScale;
      } else {
        strokeColor = isCross ? '#CBD5E1' : (s.color || '#38BDF8');
        alpha = (isCross ? 0.14 : 0.25) * edgeScale;
        lineWidth = 0.50 / curScale;
      }

      if (hasHighlight) {
        if (isEdgeSearchHigh) {
          alpha = 0.95;
          strokeColor = (th === 'cosmic') ? (s.color || '#38BDF8') : (th === 'graphite' ? '#1E293B' : '#2563EB');
          lineWidth = 1.2 / curScale;
        } else {
          alpha = 0.02;
        }
      } else if (activeNode) {
        if (isConnected) {
          alpha = 0.95;
          strokeColor = (th === 'cosmic') ? (activeNode.color || s.color || '#38BDF8') : (th === 'graphite' ? '#0F172A' : (activeNode.color || '#2563EB'));
          lineWidth = 1.1 / curScale;
        } else {
          alpha = 0.03;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      if (curvature > 0) {
        ctx.quadraticCurveTo(ctrlX, ctrlY, t.x, t.y);
      } else {
        ctx.lineTo(t.x, t.y);
      }
      ctx.stroke();

      // 处于激活高亮状态时增加发光星轨光晕与流动光子脉冲 (Traveling Photon Stream)
      if (isConnected || isEdgeSearchHigh) {
        ctx.globalAlpha = alpha * 0.35;
        ctx.lineWidth = lineWidth * 2.8;
        ctx.stroke();

        // 计算穿梭光子在贝塞尔曲线上的运动坐标
        const pulseSpeed = 0.55;
        const pProgress = (((this.photonTime || 0) * pulseSpeed + (i % 8) * 0.125) % 1.0);
        const tP = pProgress;
        const invT = 1 - tP;
        const pX = (curvature > 0)
          ? (invT * invT * s.x + 2 * invT * tP * ctrlX + tP * tP * t.x)
          : (s.x + (t.x - s.x) * tP);
        const pY = (curvature > 0)
          ? (invT * invT * s.y + 2 * invT * tP * ctrlY + tP * tP * t.y)
          : (s.y + (t.y - s.y) * tP);

        // 绘制穿梭光子星芒
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(pX, pY, 1.8 / curScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = (th === 'cosmic') ? (activeNode?.color || s.color || '#38BDF8') : '#2563EB';
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(pX, pY, 3.8 / curScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. 绘制恒星节点与发光星核 (Stellar Nodes & Bloom)
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.x < vMinX || n.x > vMaxX || n.y < vMinY || n.y > vMaxY) continue;

      const isSelected = this.selectedNode && this.selectedNode.id === n.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === n.id;
      const isNeighbor = activeNode && this.adjMap.get(activeNode.id)?.has(n.id);
      const isPrimarySearch = hasHighlight && this.primaryTargetNodeIds && this.primaryTargetNodeIds.has(n.id);
      const isSearchNeighbor = hasHighlight && this.neighborNodeIds.has(n.id);

      const deg = n.degree || 0;
      let r = Math.max(1.8, Math.min(7.2, 1.8 + deg * 0.38)) * nScale;

      let baseColor;
      if (th === 'cosmic') {
        baseColor = n.color || (deg >= 6 ? '#38BDF8' : (deg >= 3 ? '#818CF8' : '#60A5FA'));
      } else if (th === 'graphite') {
        baseColor = deg >= 6 ? '#334155' : (deg >= 3 ? '#64748B' : (n.color || '#94A3B8'));
      } else {
        baseColor = n.color || (deg >= 6 ? '#2563EB' : (deg >= 3 ? '#0EA5E9' : '#64748B'));
      }

      let alpha = 1.0;
      if (hasHighlight) {
        if (isPrimarySearch) {
          alpha = 1.0;
          r *= 1.3;
          baseColor = (th === 'cosmic') ? (n.color || '#38BDF8') : (th === 'graphite' ? '#0F172A' : '#2563EB');
        } else if (isSearchNeighbor) {
          alpha = 0.85;
          r *= 1.08;
          baseColor = (th === 'cosmic') ? (n.color || '#818CF8') : (th === 'graphite' ? '#475569' : '#0EA5E9');
        } else {
          alpha = 0.06;
          baseColor = (th === 'cosmic') ? '#334155' : '#CBD5E1';
        }
      } else if (activeNode) {
        if (isHovered || isSelected) {
          alpha = 1.0;
          r *= 1.25;
        } else if (isNeighbor) {
          alpha = 0.95;
          r *= 1.05;
        } else {
          alpha = (th === 'cosmic') ? 0.12 : 0.16;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      const isSuperHub = deg >= 6 || n.isCoreAnchor;

      // A. 恒星 Bloom 外围光晕 (Bloom Halo)
      if ((isSuperHub || isSelected || isHovered || isPrimarySearch) && alpha > 0.3) {
        const haloMul = (isSelected || isHovered || isPrimarySearch) ? 3.4 : (deg >= 15 ? 3.0 : 2.4);
        const haloR = r * haloMul;
        const glowGrad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, haloR);
        const glowAlpha = (th === 'cosmic') ? 0.40 : 0.22;
        glowGrad.addColorStop(0, hexToRgba(baseColor, glowAlpha));
        glowGrad.addColorStop(0.5, hexToRgba(baseColor, glowAlpha * 0.35));
        glowGrad.addColorStop(1, hexToRgba(baseColor, 0));
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      // B. 超级地标天体轨道环 (Orbital Celestial Ring)
      if (isSuperHub && !hasHighlight && alpha > 0.3) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(baseColor, (th === 'cosmic') ? 0.35 : 0.25);
        ctx.lineWidth = 0.7 / curScale;
        ctx.stroke();
      }

      // C. 恒星实体星核 (3D Radial Gradient Stellar Core)
      const coreGrad = ctx.createRadialGradient(n.x - r * 0.28, n.y - r * 0.28, 0, n.x, n.y, r);
      if (th === 'cosmic') {
        coreGrad.addColorStop(0, '#FFFFFF'); // 恒星聚变热白核心
        coreGrad.addColorStop(0.45, baseColor);
        coreGrad.addColorStop(1, hexToRgba(baseColor, 0.85));
      } else if (th === 'graphite') {
        coreGrad.addColorStop(0, '#F8FAFC');
        coreGrad.addColorStop(0.45, baseColor);
        coreGrad.addColorStop(1, '#0F172A');
      } else {
        coreGrad.addColorStop(0, '#FFFFFF');
        coreGrad.addColorStop(0.5, baseColor);
        coreGrad.addColorStop(1, '#1E40AF');
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // 恒星边缘明晰细描边
      ctx.strokeStyle = (th === 'cosmic') ? 'rgba(255, 255, 255, 0.45)' : '#FFFFFF';
      ctx.lineWidth = 0.75 / curScale;
      ctx.stroke();

      // D. 选中/悬停/主搜索命中焦点外环
      if (isSelected || isHovered || isPrimarySearch) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3.6, 0, Math.PI * 2);
        ctx.strokeStyle = (th === 'cosmic') ? (baseColor || '#38BDF8') : (th === 'graphite' ? '#0F172A' : '#2563EB');
        ctx.lineWidth = 1.2 / curScale;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 7. 绘制文字标签 (严格防覆盖与防重影: 碰撞避让 + 整数像素 + 极微描边)
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
      else if (isCoreHub) {
        // 宏观远景 (far) 仅显示最高度数核心地标，近景 (near) 显示全部核心地标
        if (lodTier === 'far') {
          priority = (n.degree >= 12) ? 1 : 0;
        } else {
          priority = 1;
        }
      } else if (lodTier === 'near' && n.degree >= 3) {
        // 近景行星视界下，次级骨干星点也自动浮现标签
        priority = 1;
      }

      if (priority > 0) {
        labelCandidates.push({ node: n, priority, isSelected, isHovered, isPrimarySearch });
      }
    }

    labelCandidates.sort((a, b) => b.priority - a.priority);

    ctx.save();
    ctx.font = `600 ${fSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    for (const item of labelCandidates) {
      const n = item.node;
      let text = n.displayName || n.title || '';

      if (text.length > 20 && !item.isSelected && !item.isHovered) {
        text = text.slice(0, 11) + '...' + text.slice(-5);
      }

      const deg = n.degree || 0;
      const r = Math.max(1.8, Math.min(7.2, 1.8 + deg * 0.38)) * nScale;
      const labelX = Math.round(n.x + r + Math.max(2, fSize * 0.4));
      const labelY = Math.round(n.y);

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

      if (collided && !item.isSelected && !item.isHovered) {
        continue;
      }

      drawnLabelBoxes.push(box);

      // 文字颜色与描边 (暗色背景用深墨外描边, 浅色背景用纯白外描边)
      let textColor, strokeColor;
      if (th === 'cosmic') {
        textColor = '#F8FAFC';
        strokeColor = '#06080F';
        if (item.isSelected) textColor = (n.color || '#38BDF8');
        else if (item.isPrimarySearch) textColor = (n.color || '#38BDF8');
      } else if (th === 'graphite') {
        textColor = '#0F172A';
        strokeColor = 'rgba(250, 250, 250, 0.95)';
        if (item.isSelected) textColor = '#2563EB';
        else if (item.isPrimarySearch) textColor = '#0F172A';
      } else {
        textColor = '#0F172A';
        strokeColor = 'rgba(255, 255, 255, 0.95)';
        if (item.isSelected) textColor = '#2563EB';
        else if (item.isPrimarySearch) textColor = '#1D4ED8';
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(0.4, Math.min(1.0, fSize * 0.22)) / curScale;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, labelX, labelY);

      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, labelX, labelY);
    }
    ctx.restore();

    // 8. 自动启停高亮光子脉冲流动 (有高亮或交互悬停时自启, 空闲时 0% CPU 停帧)
    if (activeNode || hasHighlight) {
      this.startPhotonStream();
    } else {
      this.stopPhotonStream();
    }

    ctx.restore();
    ctx.restore();

    if (this.onRenderCallback) {
      this.onRenderCallback();
    }
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

    if (this.highlightedNodeIds.size > 0) {
      this.startPhotonStream();
    }

    this.requestRender();
  }

  clearHighlight() {
    this.highlightedNodeIds.clear();
    this.highlightedEdgeKeys.clear();
    this.neighborNodeIds.clear();
    this.primaryTargetNodeIds.clear();
    if (!this.hoveredNode && !this.selectedNode) {
      this.stopPhotonStream();
    }
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
    this._onMouseLeave = () => this.handleMouseLeave();

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('click', this._onClick);
    this.canvas.addEventListener('dblclick', this._onDblClick);
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);
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
    const nScale = this.params.nodeScale || 0.65;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = n.x - x;
      const dy = n.y - y;
      const deg = n.degree || 0;
      const r = Math.max(1.8, Math.min(7.2, 1.8 + deg * 0.38)) * nScale;
      const hitR = Math.max(r + 5.5, 10);
      if (dx * dx + dy * dy <= hitR * hitR) return n;
    }
    return null;
  }

  handleMouseDown(e) {
    if (e.button !== 0) return;
    this.cancelCameraAnimation();
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
      if (hovered) {
        this.startPhotonStream();
      } else if (!this.selectedNode && this.highlightedNodeIds.size === 0) {
        this.stopPhotonStream();
      }
      this.requestRender();
      this.onNodeHover(hovered, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  handleMouseLeave() {
    if (this.hoveredNode) {
      this.hoveredNode = null;
      if (!this.selectedNode && this.highlightedNodeIds.size === 0) {
        this.stopPhotonStream();
      }
      this.requestRender();
      this.onNodeHover(null);
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
    this.cancelCameraAnimation();
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
      this.startPhotonStream();
      this.onNodeClick(node);
      this.requestRender();
    } else {
      this.selectedNode = null;
      if (!this.hoveredNode && this.highlightedNodeIds.size === 0) {
        this.stopPhotonStream();
      }
      this.onCanvasClick();
      this.requestRender();
    }
  }

  handleDblClick(e) {
    const node = this.findNodeAt(e.clientX, e.clientY);
    if (node) {
      this.focusNode(node.id, 1.45);
    }
  }

  focusNode(nodeId, targetZoom = null) {
    const n = this.nodeMap.get(nodeId);
    if (!n) return;
    this.selectedNode = n;
    const scale = targetZoom || Math.max(1.30, this.transform.scale);
    const targetX = this.width / 2 - n.x * scale;
    const targetY = this.height / 2 - n.y * scale;
    this.flyTo(targetX, targetY, scale, 650);
    this.startPhotonStream();
  }

  /**
   * 计算知识图谱全量节点的世界坐标外接包围盒 (用于小地图雷达与视野自适应)
   * @returns {{minX: number, maxX: number, minY: number, maxY: number, width: number, height: number, centerX: number, centerY: number}}
   */
  getGraphBounds() {
    if (!this.nodes || this.nodes.length === 0) {
      return { minX: -200, maxX: 200, minY: -150, maxY: 150, width: 400, height: 300, centerX: 0, centerY: 0 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    if (minX === Infinity) {
      return { minX: -200, maxX: 200, minY: -150, maxY: 150, width: 400, height: 300, centerX: 0, centerY: 0 };
    }
    const pad = 36;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  /**
   * 获取摄像机当前视口在世界坐标系中的边界矩形 (用于雷达视锥取景框)
   * @returns {{left: number, top: number, width: number, height: number, right: number, bottom: number}}
   */
  getWorldViewport() {
    const s = this.transform.scale || 1;
    const left = -this.transform.x / s;
    const top = -this.transform.y / s;
    const width = this.width / s;
    const height = this.height / s;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
  }

  /**
   * 平滑将摄像机视野居中对齐到指定世界坐标 (如雷达小地图点击跳转)
   * @param {number} wx - 世界坐标 X
   * @param {number} wy - 世界坐标 Y
   * @param {number} duration - 飞跃耗时
   */
  flyToWorld(wx, wy, duration = 450) {
    const s = this.transform.scale || 0.85;
    const targetX = this.width / 2 - wx * s;
    const targetY = this.height / 2 - wy * s;
    this.flyTo(targetX, targetY, s, duration);
  }

  // --------------------------------------------------------------------------
  // 资源释放
  // --------------------------------------------------------------------------
  dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this._cameraAnimId) {
      cancelAnimationFrame(this._cameraAnimId);
      this._cameraAnimId = null;
    }
    if (this._photonAnimId) {
      cancelAnimationFrame(this._photonAnimId);
      this._photonAnimId = null;
    }
    this.isSimulating = false;
    this.onRenderCallback = null;

    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);
      this.canvas.removeEventListener('wheel', this._onWheel);
      this.canvas.removeEventListener('click', this._onClick);
      this.canvas.removeEventListener('dblclick', this._onDblClick);
      this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
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
