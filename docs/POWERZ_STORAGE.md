---
title: POWER-Z 工具与数据存储
date: 2026-10-12
updated: 2026-10-12
version: v1.5
doctype: GUIDE
status: active
platform: [COMMON]
module: [CHG]
owner: ai-assisted
source: internal
tags: ["#platform/common", "#module/charger", "#doctype/guide", "#status/active"]
---

# POWER-Z 工具与数据存储

用户已确认整包迁移、固定目录和命名格式；只备份及处理本次相关文件，不提交其他改动。

- 官方工具：插件 `vendor/powerz/official/`，保留完整 DLL、Qt 插件、翻译及官方文档；41 文件 SHA-256 迁移前后一致，原 RAR 保留。
- 数据目录：`D:/work/Mgmt/TabonKB/00-Inbox/02-Raw-Drop/Data_powerZ/`。
- 最终名称：`yymmddhhmmss.db`，上海时区，取数据库最后写入时间。例如本次真实录制 `261012173920.db`。
- 工作台启动 Mtools 前设置官方 `autoSavePath`、`autoSaveName`、`LastSaveFilePath`、`analyzerPath`；用户在 Mtools 中勾选“边采集边保存”。
- **PD 操作闭环**：工作台启动官方 Mtools → 协议分析 → 保存，保留默认 `pd.sqlite`。后台自动生成日期命名的 `.sqlite` 存档，列表自动更新，Mtools 可保持打开；固定目录与官方工作文件不改。
- **曲线操作闭环**：勾选“边采集边保存”并录制 → 停止采集。后台在实际采样进度及文件元数据连续稳定10秒后生成日期 `.db` 副本，Mtools 保持打开，列表自动更新。
- 监测固定目录中的 `12位启动名称_MM_DD_HH_mm_ss.db`；保留官方工作文件，通过 SQLite backup 生成独立存档。列表读取不再改名，不更改原始 SQLite 内容。
- 同秒保存导致目标重名时，保留原文件并显示“命名待处理”，完整原因在 Tooltip/HTTP `archive.adc.pending`。不覆盖、不自行增加编号或篡改保存时间；已整理文件再次刷新不改名。
- 启动、注册表、进程检查、整理失败均返回可见错误/待处理状态。PDM 不改写 Mtools 设置；自定义文件名及协议 `.pdStream/.ufcsStream` 保留原样。PD 工作文件不移动。空库、保存中的事务/忙锁等待并报告；一致性备份支持已提交的 WAL 数据。
- 手动另存为的目录和名称仍由官方对话框控制。充电曲线严格命名整理适用于固定目录的官方自动保存；PD 保存框保留默认 `pd.sqlite` 即可，后台存档，不需关闭或刷新。未找到官方 PD 文件名预设键，不承诺保存对话框自动填入日期。`pd.sqlite` 始终供官方再次保存，已生成日期存档不覆盖。
- 温度通道未记录时，官方可能写入 `1.7e308`。读取器过滤非有限值和绝对值 >= `1e300` 的占位值，汇总和分页返回 null，CSV 留空，面板显示“温度未记录”；原始数据不变。

## 实测与验证

2026-10-12，KM003C（USB VID_5FC9/PID_0063，序列号 033618，COM36）由工作台启动 POWER-Z Lab 2.5.2。用户操作录制、停止并关闭。文件共 17,958 点，17.957 秒，1KSPS；平均电压 9.389 V、电流 1.039 A、功率 9.76 W，峰值 10.425 W。温度未记录。

本次命名前 SHA-256：`54434f81a3abf89cdabd3b23b5967e21ed86676278b001eb90468a8ace8b425e`。后续验证记录在插件 CHANGELOG 和知识库 Oplog。

回归：`node docs/powerz-storage.test.js`（真实文件整理、冲突、进程防护、占用文件、路径/注册表）；`python docs/powerz-db.test.py`（混合温度、全缺失、分页/CSV、只读哈希）。代码变更后运行 `python build.py`、`node -c main.js` 并热重载验证接口。

备份：`C:/Users/Administrator/AppData/Local/Temp/tabonkb-powerz-20261012-backup/`；实测修复前快照在 `hardware-fix-before/`。官方窗口自动化初始化失败，本次录制操作由用户完成，设备识别、文件保存和工作台数据读取由 Agent 验证。

## 修订记录

| 版本 | 日期 | 修改人 | 修改内容 | 依据 |
|---|---|---|---|---|
| v1.0 | 2026-10-12 | AI-assisted | 迁移与启动保存预设 | 用户确认及路径/注册表回归 |
| v1.1 | 2026-10-12 | AI-assisted | 官方强制后缀整理、最后写入时间命名、温度占位过滤 | 实物录制与读库 |


## PD 协议 SQLite 接入（2026-10-12）

用户保存的协议文件实测有 33 条非空 Raw BLOB 报文，378 字节原始数据，1,257 个 pd_chart 电气采样；报文设备时间 9.351–10.332 秒，跨度 0.981 秒。按最后保存时间命名 `261012180441.sqlite`。

读取器按表结构区分 ADC / PD。PD 摘要返回协议类型、真实报文数、电气采样数、原始字节及报文时间跨度；分页按 Time,rowid 排序返回原始 hex，CSV 支持相同字段。面板显示短摘要，消息类型尚未解码，接口 decoded=false。未知 SQLite 表结构明确报错，不当 CSV 解析。MCP 文件列表与分析/分页接口同步可用。

| 版本 | 日期 | 修改人 | 修改内容 | 依据 |
|---|---|---|---|---|
| v1.2 | 2026-10-12 | AI-assisted | PD 默认文件关闭后日期命名，真实报文摘要与原始 hex 读取 | 用户保存的 33 条报文及原始数据库核验 |


## PD 后台一致性存档（2026-10-12，v1.3）

用户确认：只点官方“保存”，后台检测保存完成，自动生成日期命名副本并更新列表。范围为固定 Data_powerZ 目录的默认 pd.sqlite；任意另存为路径、.pdStream/.ufcsStream 不在本轮范围。

Companion 启动即开启目录监测和每秒兜底扫描，面板关闭时仍工作。main/WAL/journal 元数据稳定 1.5 秒后调用 Python SQLite 只读事务/backup，包含已提交的 WAL 内容；暂存快照通过 quick_check 并确认源未再变动后，以拒绝覆盖的原子 hard-link 发布最终名字。备份不修改原始数据库，但 SQLite 页头可能与源文件不同；验证依据为原始表/报文逻辑内容一致。快照切为 DELETE journal 模式，自身无需事务边车。

文件名使用 main/WAL 最后保存时间（上海时区）的 yymmddhhmmss.sqlite。源文件保留，可连续保存新数据。相同内容重复保存/插件重载/SQLite checkpoint 不重复存档；同秒不同内容目标冲突时留源文件并报告，不篡改名称/覆盖旧档。表、所有电气点与 Raw BLOB 原样备份，不猜测协议消息。

面板每 1.5 秒自动更新，列表未变则保持 DOM，无闪烁；状态短标显示保存中/存档中/已存档/待存档，完整错误在 Tooltip。失败后台重试，新保存自动恢复。插件停止/卸载关闭 watcher/计时器并取消活动 helper；面板销毁停止刷新。手动“刷新”保留作辅助入口。

验证：powerz-archive.test.py（持有 WAL 写连接、只取已提交数据、源保留、完整性、去重、冲突、临时文件清理），powerz-auto-archive.test.js（不调用 GET 也存档、多次保存、面板自动更新且无 DOM 闪烁、同秒冲突/恢复、后台和面板卸载清理），以及原 storage/db 回归。编译 build.py / node -c main.js 后热重载。

| 版本 | 日期 | 修改人 | 修改内容 | 依据 |
|---|---|---|---|---|
| v1.3 | 2026-10-12 | AI-assisted | PD 保存后后台一致性副本与列表自动更新，保留官方工作文件 | 用户确认新操作闭环及后台/并发 SQLite 回归 |


## 曲线后台存档（2026-10-12，v1.4）

沿用已确认的后台日期副本方案，扩展到官方曲线自动保存文件。监测范围为固定 Data_powerZ 目录的 `12位启动名称_MM_DD_HH_mm_ss.db`；已生成 12位.db 存档、自定义名称及其他目录不作为源，不修改已有存档。

v1.4 曾以写句柄释放作门控；实物发现停止后 Mtools 仍保持写连接，该条件无法满足。本轮 v1.5 改为同时检测只读查询得到的 COUNT/MAX(Unix) 采样进度和 main/WAL/journal 元数据，连续稳定10秒后执行一致性快照。无需释放写连接，不给官方写入施加额外拒绝写句柄；采样增长时继续等待。残留 journal、忙锁、空库、异常结构等待或报错。这个完成判断是数据静止启发式，不是官方停止事件；若运行中出现超过10秒的已提交数据停顿，可能产生阶段存档，后续新增数据仍会继续存档，不覆盖旧快照。

通用 powerz_archive.py 增加 ADC 模式，原样 backup 全部表/采样数据，quick_check 验证，复核源未变化，再按最后写入时间生成上海时区 yymmddhhmmss.db，以拒绝覆盖的原子 hard-link 发布。原工作文件保留；同秒不同内容不覆盖并报告，后续保存可恢复。每源记录最后存档到隐藏 .powerz-adc-state.json，插件重载/仅 checkpoint 导致的相同内容不重复建档，状态文件损坏时已有目标仍提供拒绝覆盖保护。该索引不改变采集数据。

Companion 生命周期统一管理 PD/曲线扫描；PD 行为与接口兼容，曲线状态在 archive.adc，finalizeOn=background-after-sample-idle、adcIdleMs=10000、adcSourceRetained=true。GET captures/prepareCaptures 不再执行关闭后改名。面板复用自动刷新、稳定 DOM 和短状态，增加“采集中/曲线已存档/曲线待存档”，完整错误在 Tooltip。

验证：powerz-curve-archive.test.js 使用原实测曲线的隔离副本，持续提交新采样超过稳定阈值，确认零中途存档；停止提交但保留写连接和程序进程后确认后台自动备份、所有表和数据一致、列表自动更新；覆盖重名不覆盖、下次保存恢复、重载内容去重、卸载清理。与 PD 自动存档、读库、存储配置回归一起执行。修正后实物验证见以下v1.5记录。

| 版本 | 日期 | 修改人 | 修改内容 | 依据 |
|---|---|---|---|---|
| v1.4 | 2026-10-12 | Codex | 曲线停止后后台日期副本，写句柄门控，保留原文件，自动更新列表 | 用户“要接入”及隔离回归 |


| 版本 | 日期 | 修改人 | 修改内容 | 依据 |
|---|---|---|---|---|
| v1.5 | 2026-10-12 | Codex | 实物修正：Mtools停止仍持写句柄，改为采样COUNT/末时间及元数据稳定10秒，允许连接保持打开 | 用户已停止后的实际文件与修正后的持续写入/停止保留连接回归 |


### v1.5 实物验证结果

用户已停止并保持 Mtools PID68248 运行响应。后台日期文件在核验HTTP接口前已存在：`261012192042.db`，原工作文件 `261012184740_10_12_19_20_36.db` 保留；在线 archive.adc.status=archived、totalSamples=5987。17:39旧曲线及PD存档保持原样。

本次5,987点、5.986秒、1KSPS；电压均值0.001V、最大0.004392V，电流0.00001–0.001727A，接近零，温度未记录。不是用这些接近零的数据推断负载充电能力。全部表定义与table_1/table_1_param全部行逐项一致，源和副本quick_check均ok。源核验前后物理SHA-256均 `42e2d6e6b40f76a7c37c0a511ada73188a709d927147507c3f3e63aea8918a45`；两者逻辑内容SHA-256均 `6c70a9d06567f4989d0a3dd7670ae69838c0974cca06e890fa8a0f063dc4c411`。

证据：Temp/tabonkb-powerz-20261012-backup/adc-auto-archive-real-verification.json。修正后的曲线端到端、PD后台端到端、SQLite快照、ADC/PD读库、存储配置回归通过；build.py、node -c main.js、热重载及在线接口均通过。
