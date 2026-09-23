# TabonKB 研发工作台 (TabonKB Workbench) - 代码变更与维护记录

> **规则约束**：任何 AI Agent 或开发者在改动工作台代码（包括 `providers/`、`components/`、`services/`、`mcp/`、`settings/`、`styles.css`、`build.py`、`browser-extension/` 等）后，**必须**在此文件中追加规范的修改记录，并执行 `python build.py` 打包与 `node -c main.js` 语法校验。

---

## 变更记录模板

```markdown
### [YYYY-MM-DD HH:mm] <type>(<scope>): <简要描述>
- **变更类型**: `fix` (修复) | `feat` (新特性) | `perf` (性能优化) | `refactor` (重构) | `style` (样式) | `docs` (文档)
- **涉及文件**:
  - `providers/xxx.js`
  - `components/xxx.js`
  - `main.js` (编译产物)
- **问题与背景**: 描述引发修改的具体现象、报错日志或需求来源
- **核心修改逻辑**: 说明代码层面的具体改动方案、数据结构调整或接口契约修正
- **构建与验证**:
  - 打包命令: `python build.py` (必须执行且通过)
  - 语法校验: `node -c main.js` (必须通过)
  - 实测结果: 针对具体改动的功能验证结论
- **执行角色**: Antigravity / <Agent Role>
```

---

## 历史变更日志

### [2026-09-23 23:10] feat(release): 正式发布 TabonKB Workbench V1.2.0
- **变更类型**: `feat`
- **涉及文件**:
  - `manifest.json` (版本提升至 1.2.0)
  - `browser-extension/manifest.json`, `popup.html`, `popup.js` (升级至 1.2.0)
  - `services/companion-server.js` (版本提升至 1.2.0)
  - `main.js` (重新全量打包)
  - `releases/tabonkb-workbench-v1.2.0/*` (生成交付离线包与源码包)
- **问题与背景**: 固化 V1.2 版本，包含 WeKnora 控制台双端口拓扑、Trace 甘特图流水线、NiceAIGC 多模态图片 attachments 挂载修复与输入延迟优化。
- **核心修改逻辑**: 统一插件清单与伴侣扩展版本号，打包产物并生成 Git Tag `v1.2.0`。
- **构建与验证**: `python build.py` 成功；`node -c main.js` 语法校验通过；生成 `tabonkb-workbench-v1.2.0.zip`。
- **执行角色**: Antigravity

### [2026-09-23 22:45] fix(niceaigc): 修复多模态图片上传崩溃、脱落与 HTTP 422 参数校验异常
- **变更类型**: `fix`
- **涉及文件**:
  - `providers/niceaigc-adapter.js`
  - `main.js` (重新打包)
  - `docs/ARCHITECTURE_AND_DESIGN_V1.0.md` (更新系统架构文档第 6 章)
- **问题与背景**: 
  1. 用户上传图片发问时，模型答复“请把图片发上来”，图片在请求中脱落丢失；
  2. 之前提问曾触发 `HTTP 422: Input should be a valid string`。
- **核心修改逻辑**:
  1. **相对 URL 崩溃修复**：`upload_url` 若以 `/` 开头自动拼接 `${baseUrl}`，修复 `new URL()` 报 `Invalid URL` 崩溃；透传用户 Cookie/Token 并注入 `'x-ms-blob-type': 'BlockBlob'`；
  2. **契约解耦与挂载**：图片文件指针挂载于 `message.metadata.attachments: [{ id, name, size, mime_type, width, height }]`，`content.parts` 保持纯文本 `[promptText]`，满足 FastAPI Pydantic schema 校验；
  3. **禁止静默降级**：上传失败时向用户显式报错，杜绝脱落吞图降级为纯文本发问。
- **构建与验证**:
  - 使用用户 116KB 真实图片端到端实测，Azure Blob PUT 返回 `201 Created`，GPT-5.6 Sol 稳定流式输出 4,674 字技术解析；
  - `python build.py; node -c main.js` 编译无错。
- **执行角色**: Antigravity

### [2026-09-23 21:15] perf(agent-drawer): 消除对话抽屉输入框打字粘滞感与卡顿
- **变更类型**: `perf`
- **涉及文件**:
  - `pi-drawer-view.js`
  - `main.js` (重新打包)
- **问题与背景**: 用户在 Agent 对话框打字时有微小卡顿感。
- **核心修改逻辑**:
  1. **草稿异步防抖落盘**：内存 `draft` 即时赋值（0ms），序列化与磁盘写入通过 600ms 防抖执行，打字期间 0 磁盘 I/O；
  2. **重排保护**：输入框高度差值 >2px 才触发布局重排；
  3. **IME 支持**：拼音录入期间跳过密集按钮与状态重算。
- **构建与验证**: 打字延迟降至原生级，`python build.py; node -c main.js` 验证通过。
- **执行角色**: Antigravity

### [2026-09-23 20:00] fix(weknora): 修复官方控制台 401 报错并完整实现处理流水线 (Trace) 甘特图
- **变更类型**: `fix` / `feat`
- **涉及文件**:
  - `components/weknora-manage/webview-embed.js`
  - `components/weknora-manage/documents-view.js`
  - `main.js` (重新打包)
- **问题与背景**: 
  1. 切换官方控制台报错 `{"error":"Unauthorized: missing authentication"}`；
  2. 文档详情抽屉无法查看官方 Trace 处理流水线。
- **核心修改逻辑**:
  1. 官方控制台自动将 8080 API 端口映射至 8088 Web 端口；注册 Electron Frame 拦截器剥除 `SAMEORIGIN` 限制；
  2. 实现与 WeKnora 官方对齐的 Trace 标签页：顶部摘要统计、任务关键词过滤搜索、5 档时间刻度尺、虚线前序等待 Lead-line 与甘特条、任务 I/O 检查面板。
- **构建与验证**: 访问 `http://192.168.1.62:8088` 成功内嵌控制台；Trace 全链路 22 个子任务精确展示。
- **执行角色**: Antigravity

### [2026-09-18 18:00] feat(release): 正式发布 TabonKB Workbench V1.1.0
- **变更类型**: `feat`
- **涉及文件**:
  - `components/jira-platform-view.js`
  - `components/rss-center-view.js`
  - `components/explore-view.js`
  - `releases/tabonkb-workbench-v1.1.0/*`
- **问题与背景**: 全新上线 Jira 研发任务协同工作区、全屏技术资讯中心与厂商技术资源探索。
- **构建与验证**: 生成 Git Tag `v1.1.0` 与发布包。
- **执行角色**: Antigravity
