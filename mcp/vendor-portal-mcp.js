#!/usr/bin/env node
/**
 * Vendor Portal MCP Server
 * Exposes Unisoc Uni-Support (DCC / FAQ) and MediaTek Online (MTO) documentation search
 * and detail retrieval tools to Model Context Protocol (MCP) clients (such as Gemini CLI).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 1. Locate VendorPortalService and seed resources
let VendorPortalServiceClass = null;
let SeedResources = [];

const possibleServicePaths = [
  path.resolve(__dirname, '../services/vendor-portal-service.js'),
  path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/services/vendor-portal-service.js'),
  'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/vendor-portal-service.js'
];

for (const sp of possibleServicePaths) {
  if (fs.existsSync(sp)) {
    try {
      const mod = require(sp);
      VendorPortalServiceClass = mod.VendorPortalService;
      SeedResources = mod.SEED_VENDOR_RESOURCES || [];
      break;
    } catch (e) {
      console.error('[VendorPortalMCP] Error requiring VendorPortalService from ' + sp + ':', e.message);
    }
  }
}

// 2. Credential retrieval helper
function getSecretFromFile(key) {
  const secretPaths = [
    path.resolve(__dirname, '../.secrets.json'),
    path.resolve(process.cwd(), '.secrets.json'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/.secrets.json',
    'd:/work/Mgmt/TabonKB/.secrets.json'
  ];

  for (const sp of secretPaths) {
    if (fs.existsSync(sp)) {
      try {
        const data = JSON.parse(fs.readFileSync(sp, 'utf8'));
        if (data && data[key]) return data[key];
      } catch (_) {}
    }
  }
  return '';
}

function getMtkUsername() {
  if (process.env.TABONKB_MTK_USERNAME) return process.env.TABONKB_MTK_USERNAME;
  const dataJsonPaths = [
    path.resolve(__dirname, '../data.json'),
    path.resolve(process.cwd(), '.obsidian/plugins/tabonkb-workbench/data.json'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/data.json'
  ];
  for (const dp of dataJsonPaths) {
    if (fs.existsSync(dp)) {
      try {
        const data = JSON.parse(fs.readFileSync(dp, 'utf8'));
        if (data?.vendorPortals?.mtk?.username) return data.vendorPortals.mtk.username;
      } catch (_) {}
    }
  }
  return '';
}

function getServiceInstance() {
  if (!VendorPortalServiceClass) {
    throw new Error('VendorPortalService class could not be loaded.');
  }

  const s = new VendorPortalServiceClass({
    app: {},
    manifest: {},
    getConfig: () => ({
      mtk: {
        username: getMtkUsername()
      }
    })
  });

  s.getCredential = async (key) => {
    if (key === 'tabonkb-unisoc-password') {
      return process.env.TABONKB_UNISOC_TOKEN || process.env.UNISOC_TOKEN || getSecretFromFile('tabonkb-unisoc-password') || '';
    }
    if (key === 'tabonkb-mtk-password') {
      return process.env.TABONKB_MTK_PASSWORD || process.env.MTK_PASSWORD || getSecretFromFile('tabonkb-mtk-password') || '';
    }
    return '';
  };

  return s;
}

// 3. Tool Definitions
const TOOLS = [
  {
    name: 'vendor_portal_search',
    description: '检索芯片原厂官方技术资料库（紫光展锐 Uni-Support DCC 手册 / FAQ 与 联发科 MediaTek Online FAQ / DCC / Quick Start，以及 MTK eService Case 问题单）。支持查询驱动移植、配置指南、外设接口（USB/充电/Camera/UFS/PCIe/PMIC/DTS等）排障、官方 FAQ 问答与 eService Case 案例。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "检索关键词，如 'charge', 'usb', 'camera', 'pmic', 驱动错误信息，或具体 FAQ 编号"
        },
        vendor: {
          type: 'string',
          description: "指定芯片供应商: 'unisoc' (紫光展锐), 'mtk' (联发科), 或 'all' (全部原厂，默认)",
          enum: ['unisoc', 'mtk', 'all']
        },
        category: {
          type: 'string',
          description: "资料分类: 'all' (全部), 'dcc' (规格手册/移植指南), 'faq' (实战排障与问答)",
          enum: ['all', 'dcc', 'faq']
        }
      },
      required: ['query']
    }
  },
  {
    name: 'vendor_portal_get_detail',
    description: '根据原厂文档编号或 FAQ 编号调取完整技术方案、原厂工程师解答现场日志与源码补丁（支持展锐 FAQ/DCC 与 MTK FAQ）。',
    inputSchema: {
      type: 'object',
      properties: {
        docId: {
          type: 'string',
          description: "文档编号或 FAQ 编号（如 'FAQ202479985'、'FAQ202681939'、'107852'、'FAQ28912'）"
        },
        vendor: {
          type: 'string',
          description: "原厂类别: 'unisoc' (紫光展锐) 或 'mtk' (联发科)",
          enum: ['unisoc', 'mtk']
        }
      },
      required: ['docId', 'vendor']
    }
  }
];

// 4. Tool Execution Handlers
async function executeSearch(params) {
  const service = getServiceInstance();
  const q = (params.query || '').trim();
  const v = params.vendor || 'all';
  const cat = params.category || 'all';

  const res = await service.searchResourcesLive(q, v, '', cat);
  const hits = res.hits || [];
  const lines = [];

  // Show portal status notices if any portal failed authentication
  if (res.portalStatus?.mtk && !res.portalStatus.mtk.ok && (v === 'mtk' || v === 'all')) {
    lines.push(`> ⚠️ **【MTK Online 状态】**：${res.portalStatus.mtk.msg}`);
  }
  if (res.portalStatus?.unisoc && !res.portalStatus.unisoc.ok && (v === 'unisoc' || v === 'all')) {
    lines.push(`> ⚠️ **【展锐 Uni-Support 状态】**：${res.portalStatus.unisoc.msg}`);
  }

  if (hits.length === 0) {
    const errorSuffix = lines.length > 0 ? '\n' + lines.join('\n') : '';
    return `原厂知识库与实时门户中未检索到与「${q}」相关的官方资料。建议更换关键词或指定更精确的芯片/接口名称。${errorSuffix}`;
  }

  if (lines.length > 0) {
    lines.push('');
  }

  lines.push(`### 官方原厂检索结果 (共 ${hits.length} 条资源，${res.isLive ? '官网实时直连' : '本地工程库'}):`);

  if (res.aiOverview) {
    lines.push(`\n> **【官方速览】${res.aiOverview.title}**`);
    lines.push(`> ${res.aiOverview.summary}`);
    if (Array.isArray(res.aiOverview.steps) && res.aiOverview.steps.length > 0) {
      lines.push(`> 原厂推荐步骤: ${res.aiOverview.steps.slice(0, 3).join('; ')}`);
    }
    lines.push('');
  }

  hits.slice(0, 10).forEach((h, idx) => {
    lines.push(`**${idx + 1}. [${h.portalName}] ${h.title}**`);
    lines.push(`   - 编号: \`${h.docId || '无'}\` | 分类: \`${h.category || '技术资料'}\` | 芯片平台: \`${h.chipset || '通用'}\` | 发布更新: ${h.updated || '未知'}`);
    if (h.summary) {
      const cleanSummary = h.summary.replace(/\s+/g, ' ').trim();
      lines.push(`   - 摘要: ${cleanSummary.slice(0, 200)}${cleanSummary.length > 200 ? '...' : ''}`);
    }
    lines.push(`   - 官网直链: ${h.url}`);
    lines.push('');
  });

  if (hits.length > 10) {
    lines.push(`...（其余 ${hits.length - 10} 条资料已省略）`);
  }
  lines.push(`💡 提示：如需获取某篇 FAQ 或手册的完整排障步骤、寄存器计算公式或代码补丁，请调用 \`vendor_portal_get_detail\` 工具传入对应编号。`);

  return lines.join('\n');
}

async function executeGetDetail(params) {
  const service = getServiceInstance();
  const docId = (params.docId || '').trim();
  let vendor = (params.vendor || '').trim().toLowerCase();

  // Intelligent vendor auto-correction based on docId pattern
  if (/^faq20\d{5,8}/i.test(docId) || /^\d{5,7}$/.test(docId) || /^cr\d+/i.test(docId) || /^dcc/i.test(docId)) {
    vendor = 'unisoc';
  } else if (/^faq0\d+/i.test(docId) || /^mto/i.test(docId)) {
    vendor = 'mtk';
  }

  const isUnisoc = vendor === 'unisoc' || /unisoc|展锐/i.test(vendor);

  if (isUnisoc) {
    let faqDetail = await service.fetchUnisocFaqDetail(docId);
    if (!faqDetail && SeedResources.length > 0) {
      const found = SeedResources.find((s) => s.portalId === 'unisoc' && (
        String(s.docId || '').toLowerCase() === String(docId).toLowerCase() ||
        String(s.id || '').toLowerCase() === String(docId).toLowerCase()
      ));
      if (found) {
        faqDetail = {
          title: found.title,
          number: found.docId,
          username: 'Unisoc FAE Engineer',
          approvedate: found.updated,
          clickcountcust: 120,
          content: found.detailedContent || found.summary
        };
      }
    }

    if (faqDetail) {
      const qText = faqDetail.question || '';
      const cText = service.convertHtmlToMarkdown(faqDetail.content || faqDetail.answer || '');
      const sections = [
        `# 展锐官方技术问答: ${faqDetail.title || docId}`,
        `- **工单编号**: \`${faqDetail.number || docId}\``,
        `- **责任工程师**: ${faqDetail.username || 'Unisoc Support Engineer'}`,
        `- **审核日期**: ${service.safeFormatDate(faqDetail.approvedate || faqDetail.adddatetime)}`,
        `- **累计查阅**: ${faqDetail.clickcountcust || 0} 次`,
        `- **官方知识库链接**: https://unisupport.unisoc.com/faq`,
        qText ? `\n## 📌 【工程现场与问题描述】\n${qText}` : '',
        `\n## 💡 【官方解决方案与排障代码】\n${cText}`
      ].filter(Boolean);

      const resultMarkdown = sections.join('\n');
      return resultMarkdown.length > 30000 ? resultMarkdown.slice(0, 30000) + '\n\n...(内容过长已截断)' : resultMarkdown;
    }

    // Check if it's a Unisoc DCC document
    try {
      const dccRes = await service.searchUnisocLive(docId, 'dcc');
      const matchedDcc = (dccRes.hits || []).find(h => String(h.docId) === docId || String(h.id).includes(docId));
      if (matchedDcc && matchedDcc.detailedContentMarkdown) {
        return matchedDcc.detailedContentMarkdown;
      }
    } catch (_) {}

    return `未能在展锐官方 FAQ 库中查找到编号为「${docId}」的在线正文。如果是 DCC 技术规范手册，请参考 DCC 检索结果前往 https://unisupport.unisoc.com/dcc 查阅原版文档。`;
  } else {
    // MTK
    let detail = null;
    let mtkErr = '';
    try {
      detail = await service.fetchMtkFaqDetail(docId, 'SW');
    } catch (e) {
      mtkErr = e.message;
      console.error('[VendorPortalMCP] MTK live fetch notice:', e.message);
    }

    if (!detail && SeedResources.length > 0) {
      const found = SeedResources.find((s) => s.portalId === 'mtk' && (
        String(s.docId || '').toLowerCase() === String(docId).toLowerCase() ||
        String(s.id || '').toLowerCase() === String(docId).toLowerCase()
      ));
      if (found) {
        detail = {
          title: found.title,
          content: found.detailedContent || found.summary
        };
      }
    }

    if (detail && detail.content) {
      const cText = service.convertHtmlToMarkdown(detail.content);
      const sections = [
        `# MTK Online 官方技术解答: ${docId}`,
        `- **标题**: ${detail.title || docId}`,
        `- **官方原帖链接**: https://online.mediatek.com/apps/faq/detail?faqid=${docId}`,
        `\n## 💡 【方案内容】\n${cText}`
      ];
      const resultMarkdown = sections.join('\n');
      return resultMarkdown.length > 30000 ? resultMarkdown.slice(0, 30000) + '\n\n...(内容过长已截断)' : resultMarkdown;
    }

    if (mtkErr) {
      return `调取 MTK 工单 [${docId}] 失败：${mtkErr}。请在工作台账号配置中录入 MTK 账号密码或使用浏览器扩展伴侣同步。`;
    }

    return `未能在 MTK Online 中查找到工单 [${docId}] 的详情。如需访问线上实时工单，请在设置中录入 MTK 账号密码。`;
  }
}

// 5. Stdio JSON-RPC 2.0 Dispatcher
function sendRpc(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handleRequest(req) {
  const { id, method, params } = req;

  // Handle Notifications
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      // client confirmed initialization
    }
    return;
  }

  // Handle Calls
  if (method === 'initialize') {
    const protocolVersion = params?.protocolVersion || '2024-11-05';
    sendRpc({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'vendor-portal',
          version: '1.0.0'
        }
      }
    });
    return;
  }

  if (method === 'ping') {
    sendRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendRpc({
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS
      }
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    (async () => {
      try {
        let textResult = '';
        if (toolName === 'vendor_portal_search') {
          textResult = await executeSearch(args);
        } else if (toolName === 'vendor_portal_get_detail') {
          textResult = await executeGetDetail(args);
        } else {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        sendRpc({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: textResult
              }
            ],
            isError: false
          }
        });
      } catch (err) {
        sendRpc({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error executing tool ${toolName}: ${err.message}`
              }
            ],
            isError: true
          }
        });
      }
    })();
    return;
  }

  // Method not found
  sendRpc({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  });
}

// 6. Setup Stdio Reader
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    handleRequest(req);
  } catch (err) {
    console.error('[VendorPortalMCP] JSON parse error:', err.message, 'line:', trimmed.slice(0, 100));
  }
});

process.stderr.write('[VendorPortalMCP] Server initialized and listening on stdio\n');
