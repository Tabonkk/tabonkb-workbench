---
title: DSLogic 逻辑分析集成实施任务书
date: 2026-10-13
updated: 2026-10-14
version: v1.1
doctype: GUIDE
status: active
platform: [COMMON]
module: [BUILD]
owner: ai-assisted
source: internal
tags: ["#platform/common", "#module/build", "#doctype/guide", "#status/active"]
---

# DSLogic 逻辑分析集成实施任务书 v1.1

> **v1.1 变更（2026-10-14，用户强制要求）**：底层**采集层与解码层必须是 DSView 官方原版代码**（`libsigrok4DSL` + `libsigrokdecode4DSL`）。原 T6 拆为 T6a/T6b/T6c，新增通用规则 11；T8 改为基于官方运行时。详见架构 v1.1 §1、§3、§5。

> 架构与验收：Devin。实现：其他模型/Agent。
> 必读：[DSLOGIC_ARCHITECTURE.md](./DSLOGIC_ARCHITECTURE.md)（约束性）、[UI_DESIGN_SPEC.md](./UI_DESIGN_SPEC.md)、插件 `AGENTS.md`、根目录 `AGENTS.md`。

## 0. 通用规则（每个任务都适用，违反即验收不通过）

1. **改动必留痕**：每个任务在 `docs/CHANGELOG.md` 追加条目（时间、类型、涉及文件、背景、核心逻辑、验证结论、执行 Agent）；里程碑同步 `99-Meta/05-CHANGELOG.md` 与 `99-Meta/07-AI-Oplog/YYYY-MM.md`。
2. **编译流水线**：改 JS 后 `py build.py` → `node -c main.js`；新增 JS 模块必须加入 `build.py` 的 `files` 列表（注意依赖顺序：被依赖的在前）。禁止只改 `main.js`。
3. **热重载验证**：`curl -X POST http://127.0.0.1:28123/api/reload-plugin`，等待约 6 秒后验证接口/界面。
4. **回归**：`py docs/dslogic-p0.test.py` 必须保持全绿；每个任务新增自己的测试文件 `docs/dslogic-<任务号>.test.py|js`。
5. **禁止静默降级**：解析/解码/采集失败必须返回明确中文错误并在 UI 以短状态 + Tooltip 呈现；不得用假数据、示例数据填充界面。
6. **只读原则**：分析链路不得修改 `.dsl` 原文件；写文件只允许写入 Data_DSLogic 新文件（不覆盖）与临时缓存目录。
7. **不改上游解码器**：`vendor/dslogic/decoders/` 只读；定制放 `vendor/dslogic/decoders-local/`。
8. **UI**：标签 ≤ 6 字符；二级配置用右侧级联毛玻璃浮窗（规范 §3）；无长段说明文字。
9. **交付物**：代码 + 测试 + CHANGELOG + 验收证据（命令输出、截图放 `%TEMP%/tabonkb-dslogic-evidence/<任务号>/`，并在 CHANGELOG 注明路径）。
10. 不得 git commit/push，除非用户明确要求。
11. **官方原版铁律（v1.1）**：采集、`.dsl` 加载、协议解码三件事只能由官方 `libsigrok4DSL` / `libsigrokdecode4DSL` 完成，源码原样编译、不改逻辑；Windows 编译所需补丁放 `native/dslogic-core/patches/` 并经验收方批准。禁止新增任何自研的协议解码、采样数据解析或设备驱动代码；`srd_shim.py`/`dsl_reader.py` 只允许在测试中作为对照器使用。

## 1. 现状基线（P0 已交付）

| 文件 | 作用 |
|---|---|
| `services/dslogic/dsl_reader.py` | `.dsl` v3 解析 → 边沿表，`%TEMP%/tabonkb-dslogic-cache` 缓存 |
| `services/dslogic/srd_shim.py` | 纯 Python libsigrokdecode 运行时，支持叠加解码 |
| `services/dslogic/dslogic_cli.py` | `info / decode / decoders / verify-csv` |
| `services/dslogic-service.js` | Node 封装（目前每请求起一次 Python 进程） |
| `services/companion-server.js` | `/api/dslogic/{captures,decoders,info,decode}` |
| `vendor/dslogic/decoders/` | DSView v1.3.2 官方解码器 150 个 |
| `docs/dslogic-p0.test.py` | 14 项回归（合成 + 真实文件） |

测试样本（只读，勿移动）：
- `00-Inbox/02-Raw-Drop/Data_DSLogic/260722101909.dsl`（4MHz/40.7s，I2C@ch0 SDA/ch1 SCL，参照 CSV：`07-Project/2026-dsview/test/decoder--261013-171418.csv`）
- `D:\work\prj\R65\关机不能reset 5V.dsl`（10MHz/20.3s，I2C sda=0/scl=1，USB PD cc1=2；通道名 SCL/SDA 互换）
- DSView 源码：`07-Project/2026-dsview/DSView-master`（v1.3.2）

## 2. 任务总览与依赖

| 任务 | 阶段 | 内容 | 依赖 | 可并行 |
|---|---|---|---|---|
| **T1** | P1 | ToolsView 多工具化 | — | 与 T2/T6 并行 |
| **T2** | P1 | 常驻 Python worker + 解码缓存 + 波形窗口接口 + 导入 | — | 与 T1/T6 并行 |
| **T3** | P1 | 逻辑分析面板：文件列表 / 波形 / 解码行 / 报文表 | T1, T2 | — |
| **T4** | P2 | 5 协议预设 + 解码器配置 + 语义事务层 + 官方对比验证 | T2 | 与 T3 后半并行 |
| **T5** | P3 | AI 集成：上下文包 + 分析按钮 + MCP + 存卡 | T3, T4 | — |
| **T6a** | P4 | 官方内核构建 + `.dsl` 加载 + 官方解码（无需硬件） | — | **最优先**，可立即启动 |
| **T6b** | P4 | worker 数据源切换到官方内核；shim/reader 降为测试对照器 | T6a | — |
| **T6c** | P4 | 官方采集 + `.dsl` 写出（需实物 DSLogic Plus） | T6a | 与 T6b 并行 |
| **T7** | P4 | 采集控制 UI 与端到端实物闭环 | T3, T6b, T6c | — |
| **T8** | 横向 | 性能与缓存治理（基于官方运行时） | T6b | — |

---

## T1 ToolsView 多工具化

**背景**：`components/tools-view.js` 有 `tools` 注册表，但 `renderFrame()`、刷新、外开按钮写死 `ChargerToolView` 与充电工具 URL。

**要做**
1. `tools` 注册表新增 `{ id:'logic', name:'逻辑', fullName:'逻辑分析', version:'V0.1', icon:<iconpark 已有图标>, viewClass: LogicToolView }`；充电工具改为 `viewClass: ChargerToolView`。
2. 工具条左侧品牌区改为可切换：点击展开右侧级联浮窗列出工具（≤6 字符标签），即选即切即关；当前工具 id 持久化到 `localStorage['tabonkb-tools-active']`。
3. `renderFrame/reloadTool/dispose` 改为对当前工具实例通用调用：`new viewClass(app, frameWrapEl, { plugin, workbenchView, navTabsContainer })`，`mount()`/`destroy()`。
4. 「独立打开」仅对提供 `externalUrl` 的工具显示。
5. 先放一个 `components/tools/logic/logic-tool-view.js` 空壳（`mount` 渲染「未选文件」空态），供 T3 填充。

**验收**
- 充电工具全部功能与样式无回归（Power-Z 面板可打开、曲线可显示）。
- 切换「充电/逻辑」后重载 Obsidian 仍停留在上次工具；切换时旧视图 `destroy()` 被调用（无残留定时器/监听，用 DevTools 断点或日志证明）。
- 浮窗满足 UI 规范 §3 全部条款（截图）。

---

## T2 常驻 Python worker + 缓存 + 波形接口 + 导入

**要做**
1. `services/dslogic/dslogic_worker.py`：stdin/stdout NDJSON，`{"id":n,"method":"info|decode|wave|close|ping","params":{}}` → `{"id":n,"ok":true,"data":...}`；进程内按文件签名 LRU 缓存打开的 `DslFile` + 边沿表（最多 4 个文件）。复用 `dslogic_cli.py` 中的函数（重构为可导入，不复制粘贴）。
2. 解码结果缓存：key = sha1(文件签名 + 解码器 spec JSON + `srd_shim` 版本常量 + 解码器目录 mtime)，存 `%TEMP%/tabonkb-dslogic-cache/dec-<key>.json.gz`；`decode` 分页命中缓存时不得重新解码。
3. `wave` 方法（契约见架构 §4.1）：
   - 参数 `start,end`（样本索引）、`px`（像素宽，≤ 4096）、`channels`（默认全部 active）。
   - 窗口内边沿数 ≤ `2*px` → `mode:"edges"` 返回 `init_level`（窗口起点电平）与窗口内边沿；否则 `mode:"dense"` 返回每像素 `0/1/2`。
   - 单次调用 ≤ 50ms（260722101909.dsl 全时长、px=2000、16 通道，缓存命中后）。
4. `dslogic-service.js` 改为管理单例 worker：懒启动、每请求超时 60s、崩溃自动重启一次并把错误透出、`dispose()` 终止进程；companion `stop()` 时调用。保留 CLI 作为测试入口。
5. 新路由：`GET /api/dslogic/wave`、`POST /api/dslogic/import {src}`（绝对路径 .dsl → 复制到 Data_DSLogic，名称 = header `trigger time` 转上海时区 `yymmddhhmmss.dsl`；trigger time 为 0 时用文件 mtime；重名且 SHA-256 相同返回已存在，不同则拒绝并报「命名冲突」，不覆盖不加后缀）。
6. Python 依赖自检：worker 启动先 `import numpy`，失败返回 `{"ok":false,"error":"缺少 numpy：py -m pip install numpy"}`。

**验收**
- `docs/dslogic-t2.test.py`：wave 两种模式正确性（与直接由边沿表计算的期望逐像素比对，含窗口起点落在高/低电平、窗口边界恰为边沿）；缓存命中计时；import 命名/重名/同内容/非 .dsl 拒绝。
- 连续 20 次 `decode` 分页请求总耗时 < 首次解码耗时 + 2s。
- 杀掉 worker 进程后下一次请求自动恢复并成功。

---

## T3 逻辑分析面板

**位置**：`components/tools/logic/`：`logic-tool-view.js`（容器）、`wave-view.js`（Canvas）、`proto-table.js`（报文表），必要时 `logic-panel.css` 段落并入 `styles.css`（类名前缀 `tw-la-`）。

**布局（自上而下）**
```
[文件▾ 260722101909.dsl] [4MHz · 40.7s] [解码▾] [测量] [搜索] [分析]      ← 单行工具条
┌ 通道名栏 ┬──────────────── 波形区 (Canvas) ─────────────────┐
│ 0 SDA    │ ▁▁▔▔▁▔ ...                                        │
│ 1 SCL    │                                                   │
│ I2C      │ [S][AW:B4][A][DW:00][A][P]   ← 解码注释行          │
└──────────┴───────────────────────────────────────────────────┘
[时间轴缩略图 (全局活动密度 + 当前视窗框)]
┌ 报文表 (可折叠) : # | 时间 | 解码器 | 内容 ─────────────────────┐
```

**要做**
1. 文件下拉：列出 `/api/dslogic/captures`，最近在前；「导入」按钮调起系统文件选择（Electron `dialog` 或 `<input type=file>` 取路径）→ `/api/dslogic/import`。
2. 只显示 active 通道（有边沿）；「全部」开关可显示空通道。通道名可显示/不可编辑（P1 不改文件）。
3. 波形：鼠标滚轮以指针为中心缩放，拖拽平移，双击复位全景；视窗变化后防抖 60ms 请求 `wave`；dense 像素画实心块，edges 模式画方波。
4. 时间刻度自适应（ns/µs/ms/s），顶部标尺；两根光标（左键/右键放置）显示 Δt 与 1/Δt。
5. 解码行：对文件内配置的解码器调用 `decode`（按当前视窗 `start_s/end_s` 取注释，limit 2000），注释块按宽度选择 `texts` 中最长可容纳的一条（DSView 行为：long→short）。
6. 报文表：虚拟滚动（只渲染可视行），点击行 → 波形跳转并居中高亮；搜索框按 texts 子串过滤（服务端分页）。
7. 状态：加载中/错误/空态均为短文案 + Tooltip；错误必须显示服务端 error 原文。
8. （T2 验收遗留）`dslogic-service.js` 的请求超时按方法区分：`decode` 首次解码 ≥ 300s（或改为进度事件 + 无硬超时），`wave/info` 保持 60s；超时错误文案注明“可在 T8 优化后重试”。参数非法（px/limit/start/end 非数字、start>end）在 service 层显式报错。

**验收**
- 打开 260722101909.dsl：全景显示 ch0/ch1，缩放到 5.0729s 附近能看到 `Start / Address write: B4 / ACK / Data write: 00` 与 DSView 截图一致（提供并排截图）。
- 报文表 1689 行，点击第 12 行（Data read: 82）波形跳转到 5.07308s 附近。
- 打开 R65 文件：I2C 与 USB PD 两条解码行同时显示，PD 行出现 `REQUEST/ACCEPT/PS RDY` 等文字。
- 交互帧率：全景到 1µs/格连续缩放无明显卡顿（Performance 面板记录主线程单帧 < 16ms 的截图）。
- 关闭/切换工具后无残留请求与监听。

---

## T4 协议预设 + 解码器配置 + 语义事务层

**要做**
1. 预设（`components/tools/logic/presets.js`，纯数据）：

| 预设 | 解码器 | 通道 | 选项 | 推荐采样 |
|---|---|---|---|---|
| I2C | `0:i2c` | scl, sda | address_format=unshifted | ≥10MHz |
| SPI | `0:spi` | clk, mosi, miso?, cs? | cpol/cpha/bitorder 默认 | ≥4×时钟 |
| UART | `1:uart` | rxtx | baudrate=115200, parity=none | ≥16×波特率 |
| UFCS | `1:uart` → 叠加 `ufcs` | rxtx | 按 UFCS 规范设置 baudrate/parity（实现者需查 `vendor/dslogic/decoders/ufcs` 与规范确认，写入预设注释） | ≥2MHz |
| USB PD | `usb_power_delivery` | cc1, cc2? | fulltext=no | ≥10MHz，阈值调低 |

2. 「解码▾」浮窗：选预设 → 通道下拉（显示探头号+名称）→ 选项 → 应用；配置仅保存在工作台侧（`localStorage` 以文件名为 key），**不回写 .dsl**。
3. 自动建议：根据边沿特征给出通道建议（时钟线 = 周期稳定且边沿多；I2C SDA/SCL 判别：SCL 边沿数显著大于 SDA），仅作默认值，需用户确认。
4. `services/dslogic/semantics.py` + worker/CLI `transactions` 方法 + `POST /api/dslogic/transactions`：按架构 §4.3 输出 I2C/PD/UFCS/UART/SPI 事务与 `anomalies[]`。I2C 需识别「写寄存器地址 → 重复起始/新事务读」组合为 `{reg, value}`。
5. 一致性验证：用户需在 DSView 导出 UFCS、USB PD、SPI、UART 的协议列表 CSV（各至少一份真实采集），`verify-csv` 全部 0 差异；若出现差异，必须定位为 shim 语义问题并修复，**禁止改参照数据或放宽比对**。

**验收**
- `docs/dslogic-t4.test.py`：合成波形覆盖 5 种协议（含 UFCS CRC 正确/错误各一帧、PD GoodCRC 缺失、I2C 地址 NACK）→ 事务与异常断言。
- 真实文件：R65 文件 `transactions` 给出 PD 消息流（REQUEST→GOOD CRC→ACCEPT→PS RDY 序列）与 CRC/EOP 异常计数，并与 DSView 导出 CSV 对比（需用户提供 CSV）。
- 每种协议 `verify-csv` 报告存证。

---

## T5 AI 集成

**要做**
1. `summary` 方法 + `POST /api/dslogic/summary`：按架构 §6 生成 ≤6000 字中文 Markdown 上下文包，参数 `selection{start_s,end_s}` 可选。必须包含「通道命名来自用户，可能与实际信号不符」的声明及每通道信号特征。
2. 面板「分析」按钮：有光标选区则用选区，否则全文件；调用 `summary` 后复用 `charger-tool-view.js::invokeAgentDiagnostics` 同等逻辑（打开抽屉 → `drawer.sendPrompt(prompt, false)`；无抽屉时复制到剪贴板并提示）。提示词结尾给出分析要求模板（异常定位、时序合规、寄存器含义需引用知识库/数据手册来源）。
3. MCP：`mcp/dslogic-mcp.js`（stdio JSON-RPC，结构照抄 `mcp/powerz-mcp.js`）+ `mcp/dslogic-mcp-shared.js`（导出 `DSLOGIC_MCP_SERVER_NAME`、`DSLOGIC_MCP_TOOL_HINT`、`dslogicMcpScriptPath`）；工具：`dslogic_list_captures`、`dslogic_get_info`、`dslogic_get_summary`、`dslogic_get_transactions`（分页）、`dslogic_get_annotations`（分页、按时间窗）。注册到 `providers/antigravity-adapter.js` 与 DSH（参照 POWERZ 的注册方式与 `dsh-mcp-shared.js` 提示词段落）。`dslogic-mcp-shared.js` 加入 build.py。
4. 「存卡」：将 AI 最后一条回复 + summary 元数据写入 `Data_DSLogic/<同名>.md`（frontmatter：title、date=采集日期、doctype: DBG、platform、module、source: internal、tags），已存在则追加「## 分析 n」小节，不覆盖。

**验收**
- MCP stdio 冒烟：`echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp/dslogic-mcp.js` 返回 5 个工具；`tools/call dslogic_get_summary` 对样本返回非空。
- 在 Antigravity 与 NiceAIGC 各完成一次「分析」对话截图：AI 能指出 R65 文件中 PD 报文的 CRC/EOP 异常时间点、I2C 从机地址与寄存器读写模式。
- summary 字数上限、截断标注、命名声明的单元测试。

---

## T6a 官方内核：构建 + `.dsl` 加载 + 官方解码（无需硬件，最优先）

**目标**：用 DSView v1.3.2 官方 `libsigrok4DSL` 加载既有 `.dsl`，用官方 `libsigrokdecode4DSL` + 官方解码器解码，输出与现有 worker 契约同构的 JSON。

**要做**
1. 环境：MSYS2 MinGW64（`mingw-w64-x86_64-{gcc,cmake,pkgconf,glib2,libusb,zlib,minizip,python}`），一次性安装命令写入 `native/dslogic-core/README.md`。
2. 源码：原样复制 `libsigrok4DSL/`、`libsigrokdecode4DSL/`（C 源码与头文件）、`common/` 所需头文件到 `native/dslogic-core/third_party/`；生成 `third_party/SOURCE.md`（来源路径、版本 1.3.2、逐文件 SHA-256）。编译不过需打补丁时放 `patches/`，每个补丁写明原因，**提交验收方批准后才可合入**；禁止改协议/解码/驱动逻辑。
3. 自研胶水（仅限）：`src/main.c`、`src/rpc.c`（NDJSON）、`src/edge_index.c`（显示用边沿表）。方法：
   - `info{file}`：经 `ds_device_from_file` 打开，返回与现 `info` 契约相同的字段（采样率、样本数、通道名/启用、解码器配置）。
   - `edges{file, channels[], chunk}`：由官方 datafeed 生成每通道 `init_level + edges[]`，分块输出（显示用）。
   - `decode{file, spec{id,pins,options,stacked}}`：按 `DSView/pv/data/decoderstack.cpp::decode_data` 的方式调用 `srd_session_send` 喂官方 datafeed 原始数据；`srd_pd_output_callback_add(SRD_OUTPUT_ANN)` 收注释，逐条输出 `{ss,es,dec,row,row_desc,ann,cls,texts[]}`；解码器异常透出 `decoder_error`。
   - 启动自检：`srd_init(vendor/dslogic/decoders)` 并加载 `0:i2c/0:spi/1:uart/ufcs/usb_power_delivery`，失败输出明确中文错误。
4. 嵌入式 Python：随 `bin/dslogic-core/` 打包与编译头文件同版本的 `python3X.dll` 与精简标准库，`Py_SetPythonHome` 指向包内目录；**不得依赖用户系统 Python**。
5. 构建脚本 `native/dslogic-core/build.ps1`（应用 patches → CMake → 收集 DLL → 产物到 `bin/dslogic-core/`），可重复执行；`bin/` 产物清单写入 README。

**验收**
- `dslogic-core decode` 解码 `260722101909.dsl` 的 I2C，与 DSView CSV 逐条一致：**1689/1689**（时间戳 + 文本）。
- R65 样本（`240911143422.dsl`）I2C 与 USB PD 的注释，与过渡期 `srd_shim` 输出交叉比对：给出差异报告（条数、首批差异）；差异以官方为准并解释原因。
- 需用户提供：UFCS、USB PD、SPI、UART 各一份 DSView 导出 CSV，逐条 0 差异。
- `third_party/` 与官方源码逐文件 SHA-256 一致（补丁除外），补丁清单获批。
- 删除系统 Python 的 PATH 后 `dslogic-core` 仍能解码（证明运行时自包含）。

---

## T6b worker 数据源切换到官方内核

**要做**
1. `dslogic_worker.py` 改为持有 `dslogic-core` 常驻子进程：`info/wave/decode` 的数据全部取自内核（`wave` 基于内核 `edges`），缓存与分页逻辑保留；`semantics.py` 输入改为官方注释流。
2. HTTP 契约（架构 §4）**保持不变**，T3/T4/T5 前端与 MCP 不改动。
3. `dsl_reader.py`、`srd_shim.py` 从生产路径移除（worker 不再 import），移至 `docs/oracle/` 或保留原位但仅被测试引用；`dslogic_cli.py verify-csv` 改为调用内核。
4. 内核不可用（构建产物缺失/自检失败）时：返回明确错误「官方内核不可用」并在 UI 显示短状态，**不得静默回落到 shim**。
5. 回归测试中真实文件相关断言改为基于内核结果；新增 `docs/dslogic-t6b.test.py`：断言 worker 进程树中无 shim 调用、内核缺失时显式报错。

**验收**
- p0/t1–t5 全部测试通过（必要的断言调整需列明）；面板、分析、MCP 结果与切换前一致（差异须逐项解释）。
- 冷启动解码 R65 文件耗时给出前后对比。

---

## T6c 官方采集 + `.dsl` 写出（需实物 DSLogic Plus）

**要做**
1. 固件：`DSView/res/DSLogic.fw`、`DSLogicPlus*.bin` 复制到 `vendor/dslogic/firmware/`，`ds_set_firmware_resource_dir` 指向它。
2. 内核新增方法：`scan`、`open{index}`、`get_config`、`set_config{samplerate, depth, vth, channels[], mode: buffer|stream, trigger{pos, ch, edge}}`、`start`、`stop`、`status`、`save{name}`；事件 `progress{samples}`、`done{file}`、`error{msg}`。全部经 `ds_*` 公开 API。
3. `src/dsl_writer.c`：**逐行移植** `DSView/pv/storesession.cpp` 保存逻辑与 `DSView/pv/ZipMaker.cpp`（Qt → C/minizip），代码注释标注对应原文件行号；写临时文件 → 校验 → 原子改名 `yymmddhhmmss.dsl`，重名拒绝。
4. 打开设备前检测 `DSView.exe` 运行则报错「设备被 DSView 占用」。

**验收（需用户插入 DSLogic Plus）**
- `scan` 识别 DSLogic Plus；10MHz/16M 深度采集板上 I2C 生成 `.dsl`。
- 该文件**官方 DSView v1.3.2 能打开**，波形与解码一致（并排截图）；内核自身加载解码结果一致。
- 同一信号分别用官方 DSView 与 dslogic-core 采集，I2C 事务一致。
- buffer/stream 两模式各一次；拔线、设备被占用错误可见。

---

## T7 采集控制 UI 与端到端闭环

**要做**
1. `capture-bar.js`：工具条左侧加 `采集`/`停止`；`参数▾` 浮窗：采样率、深度、阈值、模式、触发（通道+边沿+位置）、通道启用；参数按设备返回的可选值渲染，持久化。
2. `dslogic-service.js` 管理 dslogic-core 单例进程；新路由 `/api/dslogic/capture/{scan,config,start,stop,status}`；进度轮询或 SSE。
3. 采集完成自动在列表置顶并打开；文件名规则同 T2 import（采集开始时间，上海时区）。
4. 预设联动：选择 T4 预设时给出推荐采样率与阈值提示（短标签 + Tooltip）。

**验收**
- 实物：工作台内完成「设参数 → 采集 → 自动打开 → 解码 → 分析 → 存卡」全流程录屏。
- 采集中切换工具/关闭面板：采集继续或被明确停止（二选一，需在 CHANGELOG 说明设计），不得出现僵尸进程。
- 设备未连接/被占用/USB 断开均有可见错误。

---

## T8 性能与缓存治理（基于官方运行时）

**目标**：100 万边沿级采集（如 10MHz SPI）首次解码 ≤ 15s，二次（缓存）≤ 1s；`wave` ≤ 50ms。

**要做**
- 以官方内核为基准测速（`docs/dslogic-t8-bench.py`：合成 1M 边沿 SPI 采集，输出首次/缓存耗时）；不达标时优化胶水层（喂数块大小、注释序列化、worker 缓存），**不得改官方库逻辑**。
- 解码进度事件：内核按块上报 → worker → service → 面板短状态。
- （T2 验收遗留）`%TEMP%/tabonkb-dslogic-cache` 清理：总量上限 1GB + 30 天未访问淘汰，worker 启动时执行。

**验收**：基准数据达标或给出瓶颈分析；全部回归通过；I2C CSV 仍 1689/1689。

---

## 3. 验收流程（Devin 执行）

1. 实现方提交：任务号、改动文件清单、CHANGELOG 条目、测试输出、证据路径。
2. 验收方执行：`py docs/dslogic-p0.test.py` + 任务测试 + `py build.py` + `node -c main.js` + 热重载 + 任务「验收」清单逐条复核（含界面实操）。
3. 结论记录于 `docs/CHANGELOG.md`（验收条目）与 Oplog；不通过项回退给实现方并列出复现步骤。
