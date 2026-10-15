---
title: DSLogic 逻辑分析集成架构设计
date: 2026-10-13
updated: 2026-10-14
version: v1.1
doctype: ARCH
status: active
platform: [COMMON]
module: [BUILD]
owner: ai-assisted
source: internal
tags: ["#platform/common", "#module/build", "#doctype/arch", "#status/active"]
---

# DSLogic 逻辑分析集成架构设计 v1.0

> 架构负责与功能验收：Devin。实现任务见 [DSLOGIC_TASKS.md](./DSLOGIC_TASKS.md)。
> 本文是**约束性文档**：实现者偏离本文的接口/目录/数据契约，必须先在任务文档中提出变更并获验收方同意。

## 1. 目标与边界

| 项 | 决策 |
|---|---|
| 设备 | DSLogic Plus（16 通道，FX2 + FPGA，固件 `DSLogic.fw` + `DSLogicPlus*.bin`） |
| 协议 | I2C、SPI、UART、UFCS、USB PD（全部复用 DSView 官方解码器） |
| 形态 | **DSView 搬进工作台**：采集、波形、解码、保存全部在工作台「工具」页内手动完成；官方 DSView 仅作后备 |
| 存储 | `00-Inbox/02-Raw-Drop/Data_DSLogic/yymmddhhmmss.dsl`（上海时区），之后走 `tabonkb-inbox-ingest` 入库 |
| AI | 只做**辅助分析**（人工触发），不做自动采集/自动化流程 |
| 文件格式 | 读写均为 DSView `.dsl` v3，保证官方 DSView 可打开复核 |
| **底层原则（v1.1，用户强制）** | **采集层与解码层必须是官方原版代码**：采集 / `.dsl` 加载 = `libsigrok4DSL`；解码 = `libsigrokdecode4DSL`（C 运行时 + 官方 Python 解码器）。源码只编译、不修改；自研代码仅限胶水层（进程协议、边沿索引、语义层、UI） |

非目标：DSO/示波器模式、模拟通道、AI 主动触发采集、跨平台（仅 Windows）。

## 2. P0 结论（已完成，2026-10-13）

1. `.dsl` v3 = ZIP：`header`(INI) / `session`(JSON) / `decoders`(JSON) / `L-<probe>/<block>`（每探头一份，bit-packed，LSB 为最早样本，块大小一致，末块可短）。
2. 解码器配置 `decoders[].channel` 为 `[{<解码器通道id>: <探头索引>}]`（已对照 `DSView/pv/storesession.cpp::load_decoders` 确认）。
3. 纯 Python 运行时 `srd_shim.py` 可直接执行 DSView 原版解码器，**无需编译 libsigrokdecode**：
   - 真实 I2C 采集与 DSView 导出 CSV **1689/1689 条时间戳+文本完全一致**；
   - 真实 USB PD 采集（10MHz）解出 52 条消息；UART→UFCS 叠加链路以合成数据验证通过。
4. **探头命名不可信**：两份样本中通道名均与实际信号不符（`ufcs1/ufcs2` 实为 SDA/SCL；`SCL/SDA` 名称互换）。以解码器绑定 + 信号特征为准，AI 提示词必须声明此点。
5. 采样率提示：4MHz 采 364kHz I2C 存在大量 1 样本毛刺；I2C/PD 建议 ≥10MHz。
6. （v1.1）P0–T5 阶段的 `dsl_reader.py` + `srd_shim.py` 为**过渡实现**（自研读取器 + 自研解码运行时）。按底层原则，T6 起由 `dslogic-core.exe`（官方两库）接管文件加载/采集/解码；过渡实现降级为**测试对照器**（仅在测试中与官方结果交叉比对），不再出现在生产数据路径上。

## 3. 总体架构（v1.1 目标态）

```
┌──────────────────────── Obsidian 工作台插件 (main.js, build.py 打包) ────────────────────────┐
│ ToolsView → LogicToolView  components/tools/logic/  (采集条/文件/波形/解码行/协议表/分析/存卡)   │
│ services/dslogic-service.js ── HTTP ── companion-server /api/dslogic/*  ◄── mcp/dslogic-mcp.js│
│        │ stdio NDJSON (常驻)                                                                  │
└────────┼──────────────────────────────────────────────────────────────────────────────────────┘
         ▼
 services/dslogic/dslogic_worker.py  (Python 编排层：缓存 / 分页 / semantics.py 语义层 / summary)
         │ stdio NDJSON (常驻子进程，worker 持有)
         ▼
 bin/dslogic-core/dslogic-core.exe   (C，官方原版代码 + 薄胶水)
  ├─ libsigrok4DSL        [官方] 设备枚举/配置/采集；ds_device_from_file() 加载 .dsl（session_driver）
  ├─ libsigrokdecode4DSL  [官方] srd_session_send() 驱动 vendor/dslogic/decoders/ 官方解码器（内嵌 Python3）
  ├─ edge_index.c         [自研] datafeed → 每通道边沿表（仅供波形渲染/统计，不参与解码）
  ├─ dsl_writer.c         [移植] 逐行移植 DSView/pv/storesession.cpp::save + ZipMaker（Qt 依赖替换为 minizip/C）
  └─ rpc.c                [自研] NDJSON 协议
 固件 vendor/dslogic/firmware/   解码器 vendor/dslogic/decoders/（只读）
 测试对照器（非生产）: services/dslogic/{dsl_reader.py,srd_shim.py} ← 仅 docs/dslogic-*.test.* 使用
```

关键点：**HTTP 契约（§4）不变**，worker 只把数据源从 `dsl_reader/srd_shim` 换成 `dslogic-core`，UI/MCP/T3–T5 无需改动。

### 3.1 进程与隔离原则
- **任何 C 代码不进 Obsidian 进程**（不做 N-API）：崩溃隔离、免 Electron ABI 重编、GPL 边界清晰。
- Python worker 与 dslogic-core 均为**单例常驻子进程**，由 `dslogic-service.js` 管理：懒启动、请求超时、崩溃自动重启一次、插件卸载时终止。
- 设备 USB 独占：dslogic-core 打开设备前检测 `DSView.exe` 进程，存在则返回明确错误，不抢占。

### 3.2 数据表示：边沿表（显示用抽象）
- 每通道 = `init_level` + 升序 `edges[]`（样本索引，电平翻转点）。
- v1.1：边沿表**只服务波形渲染、通道统计与 AI 摘要**；协议解码一律由官方 `libsigrokdecode4DSL` 直接消费官方 datafeed 原始样本（与 DSView `pv/data/decoderstack.cpp::decode_data` 相同的喂数方式），不经过边沿表。
- 缓存：`%TEMP%/tabonkb-dslogic-cache/<sha1(path|size|mtime|ver)>.*`，签名变化或版本常量递增即失效；需有总量上限与淘汰策略（T8）。

### 3.3 解码运行时（v1.1：官方 libsigrokdecode4DSL）
- 生产路径：`dslogic-core decode` → `srd_init(vendor/dslogic/decoders)` → `srd_inst_new` / `srd_inst_channel_set_all` / `srd_inst_option_set` / `srd_inst_stack` → `srd_session_start` → 按块 `srd_session_send(sess, abs_start, abs_end, inbuf[], inbuf_const, len, &err)` → `srd_pd_output_callback_add(SRD_OUTPUT_ANN)` 收注释。喂数格式、块大小、`inbuf_const` 用法**必须逐行对照** `DSView/pv/data/decoderstack.cpp`。
- 注释输出字段与现契约一致（`ss,es,dec,row,row_desc,ann,cls,texts[]`）；`cls/ann_type` 取 libsigrokdecode 原生值。
- Python 运行时：随 `dslogic-core` 打包嵌入式 Python 3（与编译时头文件同版本的 `python3X.dll` + 精简标准库），**不依赖用户系统 Python**。
- 下面列出的是过渡期 `srd_shim` 的语义，保留供对照测试参考：
- 实现 libsigrokdecode api_version 3 子集：`wait()` 条件 `h/l/r/f/e/n/skip`、int 位掩码 `matched`、`put()`、`register()`、`has_channel()`、`metadata(SRD_CONF_SAMPLERATE)`、`OUTPUT_ANN/PYTHON/BINARY/META`、`stacked decoders` 链式 `decode(ss, es, data)`。
- `wait()` 只在「当前样本+1 / 相关通道下一边沿 / skip 目标」之间跳转，复杂度 ∝ 边沿数。
- 解码器查找：`vendor/dslogic/decoders-local/`（本地定制，同 id 优先）→ `vendor/dslogic/decoders/`（上游只读）。
- 解码器异常：保留已产生的注释并在结果中返回 `decoder_error`，**禁止静默吞掉**。
- 输出顺序：按 `ss` 稳定排序（与 DSView 协议列表导出顺序一致，已验证）。

## 4. 接口契约

### 4.1 Python CLI / Worker 方法（JSON，UTF-8）
统一包装：成功 `{"ok": true, "data": ...}`；失败 `{"ok": false, "error": "<中文可读原因>"}`。

| 方法 | 参数 | 返回 data |
|---|---|---|
| `info` | `file` | `file,size,version,driver,samplerate,total_samples,duration_s,blocks,trigger_time_ms,trigger_pos,session{},decoders[{index,id,label,pins,options,stacked}],channels[{index,name,enabled,present,init,edges,active,first_edge_s,last_edge_s,min_pulse_samples,min_pulse_ns,one_sample_pulses}]` |
| `decode` | `file` + (`index` \| `decoder,pins,options,stacked`) + `offset,limit,row,start_s,end_s,q,overlap`（`q`：texts 子串、不区分大小写，T3 增补，已批准；`overlap:true` 时视窗过滤改为相交语义 `es>=start_s 且 ss<=end_s`，T3 返工增补） | `decoder,label,pins,options,stacked,total,all_annotations,offset,limit,counts{"dec/ann":n},rows[{i,ss,es,t_ns,dur_ns,dec,row,row_desc,ann,texts[]}],decoder_error?` |
| `decoders` | — | `dirs[], decoders[{id,name,longname,inputs,outputs}]` |
| `verify-csv` | `file,csv,index` | `mine,ref,mismatches,first_mismatches[],match` |
| `wave` (P1) | `file,start,end,px,channels[]` | `start,end,px,channels[{index,init_level,mode:"edges"|"dense",edges[]|buckets[]}]`，`dense` 时 `buckets[i]∈{0,1,2}`（2=该像素内有翻转） |
| `transactions` (P2) | `file,index\|spec,offset,limit,start_s,end_s` | 协议语义事务，见 §4.3 |
| `summary` (P3) | `file,selection?{start_s,end_s},decoders?` | AI 上下文包，见 §6 |

### 4.2 HTTP（companion-server，127.0.0.1:28123）
| 路由 | 状态 |
|---|---|
| `GET /api/dslogic/captures` | P0 ✅ |
| `GET /api/dslogic/decoders` | P0 ✅ |
| `GET /api/dslogic/info?file=` | P0 ✅ |
| `POST /api/dslogic/decode` | P0 ✅ |
| `GET /api/dslogic/wave?file=&start=&end=&px=&ch=` | P1 |
| `POST /api/dslogic/transactions` | P2 |
| `POST /api/dslogic/summary` | P3 |
| `POST /api/dslogic/import` `{src}` | P1：外部 .dsl 复制入 Data_DSLogic 并按 trigger time 命名，重名拒绝覆盖 |
| `POST /api/dslogic/capture/*` `scan|config|start|stop|status` | P4 |

`file` 只接受 Data_DSLogic 下的纯文件名（拒绝分隔符/盘符/`..`），已实现于 `resolveCapturePath`。

### 4.3 语义事务（P2）
```jsonc
// I2C
{"t_s":5.072991,"proto":"i2c","addr7":"0x5A","rw":"W","bytes":["00"],"acks":"A A","nack_addr":false,
 "repeated_start":false,"reg":"0x00","value":null,"dur_us":54.0}
// USB PD
{"t_s":0.334520,"proto":"pd","role":"SNK","msg_id":7,"rev":3,"type":"REQUEST","payload":["..."],
 "crc_ok":true,"eop_ok":true,"goodcrc_reply_us":710.0}
// UFCS
{"t_s":1.2,"proto":"ufcs","role":"SRC","msg_id":1,"type":"PING","payload":[],"crc_ok":true}
// UART: 以空闲间隔切分帧；SPI: 以 CS 有效区间切分 transfer
```
异常列表 `anomalies[]`：`addr_nack`、`crc_error`、`no_eop`、`no_goodcrc`、`glitch_dense`（1 样本脉冲密度）、`undersampled`（样本/位 < 8）、`decoder_error`。

## 5. 官方内核 dslogic-core（v1.1：采集 + 加载 + 解码）
- **官方源码（只编译、不修改）**：`07-Project/2026-dsview/DSView-master` v1.3.2 的 `libsigrok4DSL/`、`libsigrokdecode4DSL/`（C 部分）、`common/` 所需头文件，原样复制到 `native/dslogic-core/third_party/`，并在 `third_party/SOURCE.md` 记录来源版本与每个文件 SHA-256。确需打补丁（如 Windows 编译错误）时：补丁放 `native/dslogic-core/patches/*.patch` 单独保存、构建时应用，每个补丁写明原因，**不得修改协议/解码/驱动逻辑**，补丁清单须经验收方批准。
- **自研胶水（仅限）**：`rpc.c`（NDJSON）、`edge_index.c`（显示用边沿表）、`main.c`（调度）。只调用公开 API：
  - 采集/加载：`ds_lib_init`、`ds_set_firmware_resource_dir`、`ds_get_device_list`、`ds_active_device_by_index`、`ds_device_from_file`（加载 .dsl，DSView 同款 session_driver）、`ds_set_actived_device_config`、`ds_enable_device_channel_index`、`ds_trigger_*`、`ds_set_datafeed_callback`、`ds_start_collect`、`ds_stop_collect`。
  - 解码：`srd_init`、`srd_decoder_load_all`、`srd_session_new`、`srd_inst_new`、`srd_inst_channel_set_all`、`srd_inst_option_set`、`srd_inst_stack`、`srd_session_metadata_set`、`srd_session_start`、`srd_session_send`、`srd_pd_output_callback_add`、`srd_session_terminate_reset`、`srd_session_destroy`。
- **移植件（唯一非库代码的数据格式实现）**：`dsl_writer.c` 逐行移植 `DSView/pv/storesession.cpp`（保存逻辑）与 `DSView/pv/ZipMaker.cpp`，Qt 类型替换为 C/minizip，字段与块大小保持一致；代码中标注对应原文件行号。
- 构建：MSYS2 MinGW64 + CMake，依赖 glib2、libusb-1.0、zlib/minizip、python3（开发头 + 运行时）；产物与全部运行 DLL、嵌入式 Python、`vendor/dslogic/decoders` 路径配置放 `bin/dslogic-core/`。`native/dslogic-core/build.ps1` 可重复执行。
- 协议：stdio NDJSON，`{"id","method","params"}` → `{"id","ok","data"|"error"}`；异步事件 `{"event":"progress"|"done"|"error",...}`。方法：`info`、`edges`（显示用边沿表，分块）、`decode`（官方注释流，分块）、`scan/open/get_config/set_config/start/stop/status/save`。
- 写盘：写临时文件 → 校验 → 原子改名为 `yymmddhhmmss.dsl`，**重名拒绝覆盖**。
- 验收铁律：①官方 DSView v1.3.2 能打开 dslogic-core 写出的文件，且波形与解码一致；②dslogic-core 加载既有样本的解码结果与 DSView 导出 CSV 逐条一致（I2C 1689/1689 为基线）；③与过渡期 `srd_shim` 结果交叉比对，出现差异时**以官方为准**，并记录差异原因。

## 6. AI 集成（P3）
- 两条通道：
  1. **面板按钮「分析」**：对当前文件/选区生成上下文包（`summary`），经 `drawer.sendPrompt()` 进入 Agent Hub。适用所有 Agent（含无 MCP 能力的 NiceAIGC）。
  2. **MCP** `mcp/dslogic-mcp.js` + `mcp/dslogic-mcp-shared.js`，经 companion HTTP 调用，按 POWER-Z 模式注册到 Antigravity / DSH 适配器：`dslogic_list_captures`、`dslogic_get_info`、`dslogic_get_transactions`、`dslogic_get_annotations`、`dslogic_get_summary`。
- 上下文包预算：≤ 6000 中文字符。顺序：采集概况 → 通道活跃与命名可信度声明 → 异常列表（全量计数 + 前 20 条）→ 聚合统计（I2C 地址/寄存器分布、PD 消息流、UFCS 消息流）→ 选区内事务（截断并注明总数）。
- 只读：AI 工具不得写/删采集文件；AI 结论写回由用户点击「存卡」触发，生成同名 `yymmddhhmmss.md`（frontmatter 合规）放在 Data_DSLogic。

## 7. UI 约束（摘自 UI_DESIGN_SPEC，强制）
- 标签 ≤ 6 字符：`采集 停止 导入 解码 分析 存卡 测量 搜索`；禁止长段说明文字、长 URL。
- 二级配置（采样率/深度/阈值/触发/解码器参数）一律向右级联毛玻璃浮窗，4~6px 负边距微重叠、`bottom:0` 底对齐、视口越界向左翻转；即选即存即关，点外部关闭。
- 错误以短状态 + Tooltip 呈现完整原因（参照 powerz-panel）。

## 8. 目录规划
```
tabonkb-workbench/
  components/tools/logic/      logic-tool-view.js, wave-view.js, proto-table.js, capture-bar.js
  services/dslogic-service.js  (已建)
  services/dslogic/            dsl_reader.py, srd_shim.py, dslogic_cli.py (已建); dslogic_worker.py, semantics.py, dsl_writer.py
  mcp/dslogic-mcp.js, mcp/dslogic-mcp-shared.js
  native/dslogic-core/         CMakeLists.txt, build.ps1, src/, third_party/
  bin/dslogic-core/            dslogic-core.exe + DLL (构建产物)
  vendor/dslogic/decoders/     官方解码器 (已建, 只读)
  vendor/dslogic/decoders-local/ 本地定制解码器
  vendor/dslogic/firmware/     DSLogic.fw, DSLogicPlus*.bin
  docs/DSLOGIC_*.md, docs/dslogic-*.test.py
```

## 9. 风险登记
| 风险 | 等级 | 对策 |
|---|---|---|
| Python 运行时缺失 numpy | 中 | worker 启动自检，面板显示短状态「缺依赖」+ Tooltip 安装命令 |
| 密集采集（≥1M 边沿）解码慢：过渡期 shim 约 30–40µs/边沿 | 中 | v1.1 切换官方 C 运行时后复测；解码结果缓存；进度事件（T8） |
| dslogic-core 在 Windows 编译链/WinUSB 驱动 | 高 | T6a 先做无硬件的「加载+解码」内核，失败不阻塞已有功能（过渡实现继续服务，但需在 UI 标注「过渡解码」）；官方 DSView 后备 |
| 嵌入 Python 与 libsigrokdecode4DSL 版本不匹配 | 高 | 以 MSYS2 python3 头文件编译并随包携带同版本运行时；启动自检 `srd_init` + 加载 5 个目标解码器，失败显式报错 |
| 官方源码需 Windows 补丁 | 中 | patches/ 独立存放 + 验收方批准，禁止改协议/解码/驱动逻辑 |
| .dsl 写出与官方不兼容 | 高 | §5 验收铁律 + 往返测试 |
| GPL 传染 | 低 | 解码器/内核作为独立程序与数据，插件通过进程间通信调用；保留 COPYING 与来源说明 |
| 通道命名错误误导 AI | 中 | 摘要必须声明「通道名来自用户，可能与实际信号不符」，并以解码器绑定角色 + 信号特征（边沿数、周期性）交叉检查，冲突时显式列出（如「ch0 名为 SCL，但 I²C 解码器绑定为 sda」） |
