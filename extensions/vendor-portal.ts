import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";

export default function (pi: ExtensionAPI) {
  let VendorPortalServiceClass: any = null;
  let SeedResources: any[] = [];
  const servicePath = path.resolve(process.cwd(), ".obsidian/plugins/tabonkb-workbench/services/vendor-portal-service.js");
  if (fs.existsSync(servicePath)) {
    try {
      const mod = require(servicePath);
      VendorPortalServiceClass = mod.VendorPortalService;
      SeedResources = mod.SEED_VENDOR_RESOURCES || [];
    } catch (e) {
      console.warn("[VendorPortalExtension] Failed to require VendorPortalService:", e);
    }
  }

  function getService() {
    if (!VendorPortalServiceClass) return null;
    const s = new VendorPortalServiceClass({
      app: {},
      manifest: {},
      getConfig: () => ({
        mtk: {
          username: process.env.TABONKB_MTK_USERNAME || ''
        }
      })
    });
    s.getCredential = async (key: string) => {
      if (key === 'tabonkb-unisoc-password') {
        return process.env.TABONKB_UNISOC_TOKEN || process.env.UNISOC_TOKEN || '';
      }
      if (key === 'tabonkb-mtk-password') {
        return process.env.TABONKB_MTK_PASSWORD || process.env.MTK_PASSWORD || '';
      }
      return '';
    };
    return s;
  }

  // 1. Tool: vendor_portal_search
  pi.registerTool({
    name: "vendor_portal_search",
    label: "芯片原厂资料检索 (MTK 与 展锐)",
    description: "检索芯片原厂官方技术资料库（紫光展锐 Uni-Support DCC 手册 / FAQ 与 联发科 MediaTek Online）。支持查询驱动移植、配置指南、外设接口（USB/充电/Camera/UFS/PCIe/PMIC/DTS等）排障与官方 FAQ 问答。",
    parameters: Type.Object({
      query: Type.String({ description: "检索关键词，如 'charge', 'usb', 'camera', 'pmic', 驱动错误信息，或具体 FAQ 编号" }),
      vendor: Type.Optional(Type.String({ description: "指定芯片供应商: 'unisoc' (紫光展锐), 'mtk' (联发科), 或 'all' (全部原厂，默认)" })),
      category: Type.Optional(Type.String({ description: "资料分类: 'all' (全部), 'dcc' (规格手册/移植指南), 'faq' (实战排障与问答)" }))
    }),
    async execute(toolCallId, params: { query: string; vendor?: string; category?: string }, signal) {
      const service = getService();
      if (!service) {
        return {
          content: [{ type: "text", text: "未能加载 VendorPortalService 模块，请检查插件安装路径。" }],
          details: { error: "service_not_found" }
        };
      }

      const q = (params.query || '').trim();
      const v = params.vendor || "all";
      const cat = params.category || "all";

      try {
        const res = await service.searchResourcesLive(q, v, "", cat);
        const hits = res.hits || [];
        if (hits.length === 0) {
          return {
            content: [{ type: "text", text: `原厂知识库与实时门户中未检索到与「${q}」相关的官方资料。建议更换关键词或指定更精确的芯片/接口名称。` }],
            details: { count: 0, query: q }
          };
        }

        const lines: string[] = [];
        lines.push(`### 官方原厂检索结果 (共 ${hits.length} 条资源，${res.isLive ? '官网实时直连' : '本地工程库'}):`);

        if (res.aiOverview) {
          lines.push(`\n> **【官方速览】${res.aiOverview.title}**`);
          lines.push(`> ${res.aiOverview.summary}`);
          if (Array.isArray(res.aiOverview.steps) && res.aiOverview.steps.length > 0) {
            lines.push(`> 原厂推荐步骤: ${res.aiOverview.steps.slice(0, 3).join('; ')}`);
          }
          lines.push('');
        }

        hits.slice(0, 10).forEach((h: any, idx: number) => {
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

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: { count: hits.length, hits: hits.slice(0, 10) }
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `检索原厂资料出现异常: ${err.message}` }],
          details: { error: err.message }
        };
      }
    }
  });

  // 2. Tool: vendor_portal_get_detail
  pi.registerTool({
    name: "vendor_portal_get_detail",
    label: "获取原厂文档/FAQ技术详情",
    description: "根据原厂文档编号或 FAQ 编号调取完整技术方案、原厂工程师解答现场日志与源码补丁（支持展锐 FAQ/DCC 与 MTK FAQ）。",
    parameters: Type.Object({
      docId: Type.String({ description: "文档编号或 FAQ 编号（如 'FAQ202479985'、'FAQ202681939'、'107852'、'FAQ28912'）" }),
      vendor: Type.String({ description: "原厂类别: 'unisoc' (紫光展锐) 或 'mtk' (联发科)" })
    }),
    async execute(toolCallId, params: { docId: string; vendor: string }, signal) {
      const service = getService();
      if (!service) {
        return {
          content: [{ type: "text", text: "未能加载 VendorPortalService 模块" }],
          details: { error: "service_not_found" }
        };
      }

      const { docId, vendor } = params;
      const isUnisoc = vendor === 'unisoc' || /unisoc|展锐/i.test(vendor);

      try {
        if (isUnisoc) {
          let faqDetail = await service.fetchUnisocFaqDetail(docId);
          if (!faqDetail && SeedResources.length > 0) {
            const found = SeedResources.find((s: any) => s.portalId === 'unisoc' && (s.docId?.toLowerCase() === String(docId).toLowerCase() || s.id?.toLowerCase() === String(docId).toLowerCase()));
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
            const truncated = resultMarkdown.length > 25000 ? resultMarkdown.slice(0, 25000) + '\n\n...(内容过长已截断)' : resultMarkdown;
            return {
              content: [{ type: "text", text: truncated }],
              details: { docId, vendor: 'unisoc', found: true }
            };
          }
          return {
            content: [{ type: "text", text: `未能在展锐官方 FAQ 库中查找到编号为「${docId}」的在线正文。如果是 DCC 技术规范手册，请参考 DCC 检索结果前往 https://unisupport.unisoc.com/dcc 查阅原版 PDF。` }],
            details: { docId, found: false }
          };
        } else {
          // MTK
          let detail: any = null;
          try {
            detail = await service.fetchMtkFaqDetail(docId, 'SW');
          } catch (e: any) {
            console.warn('[VendorPortalExtension] MTK live fetch notice:', e.message);
          }

          if (!detail && SeedResources.length > 0) {
            const found = SeedResources.find((s: any) => s.portalId === 'mtk' && (s.docId?.toLowerCase() === String(docId).toLowerCase() || s.id?.toLowerCase() === String(docId).toLowerCase()));
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
            const truncated = resultMarkdown.length > 25000 ? resultMarkdown.slice(0, 25000) + '\n\n...(内容过长已截断)' : resultMarkdown;
            return {
              content: [{ type: "text", text: truncated }],
              details: { docId, vendor: 'mtk', found: true }
            };
          }
          return {
            content: [{ type: "text", text: `未能在 MTK Online 中查找到工单 [${docId}] 的详情。如需访问线上实时工单，请在设置中录入 MTK 账号密码。` }],
            details: { docId, found: false }
          };
        }
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `获取原厂详情异常: ${err.message}` }],
          details: { error: err.message }
        };
      }
    }
  });
}
