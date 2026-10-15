# Power-Z 模块改造方案（P0 → P1）

> 目标：工作台能采集**真实**的 ADC 遥测与**真实**的 PD/UFCS 协议报文，并通过 MCP 把这些数据与协议包提供给 Agent Hub 的 Agent 做分析。
>
> 本文档为**固化方案**，实施前不再变更设计口径；实施过程中如遇与官方资料冲突，以官方资料（`07-Project/2026-powerZ/`）为准并回填本文档。

---

## 0. 目标与验收标准（Definition of Done）

| 编号 | 验收项 | 判定方式 |
|---|---|---|
| DoD-1 | 接入实体 KM003C，点「⏺ 记录」得到**真实** ADC（VBUS/IBUS/CC1/CC2/DP/DM/温度） | 对比官方 Mtools.exe 同步读数一致 |
| DoD-2 | 得到**真实** PD/UFCS 报文（非阈值伪造） | 报文 `raw` 与官方 PDM/分析仪一致，可被 `pd data=` 注入样本解码复现 |
| DoD-3 | Agent 通过 MCP 能列出并分析采集数据 | `powerz_list_captures` → `powerz_analyze_capture` 返回统计+报文摘要 |
| DoD-4 | 全仓无伪报文路径 | 不存在 `generatePdHandshakePackets` / `generateUfcsHandshakePackets` / `.*Keepalive` |
| DoD-5 | 无数据即空态 | 未接设备时 HUD 全 0、报文列表空态、契约为「待机空闲」 |
| DoD-6 | 构建与测试全绿 | `python build.py` + `node -c main.js` + `node docs/test_runner.js` |

**数据源决策**：改用**官方虚拟串口（CDC）自动上传协议**（`02/03`，模式位可同时携带 PD/UFCS），因为它是唯一能同时拿到**真实 ADC + 真实 PD/UFCS 报文流**的官方通路；HID（`hiddemo.cpp`）仅作为 ADC 位域/缩放的参照实现。

---

## 1. 现状问题清单（本方案的改造依据）

| 编号 | 问题 | 证据 |
|---|---|---|
| P-1 | PD/UFCS 报文是**依据 VBUS 阈值伪造**的，不是解码 | `services/powerz-service.js:699-961`（`generatePdHandshakePackets` 等） |
| P-2 | 报文详情面板为**静态硬编码**，与所选报文无关 | `components/tools/charger/powerz-panel.js:2392-2489`、`2542-2558` |
| P-3 | 硬件链路实际不通：依赖不存在的 `km003c`/`hid` 包；`spawn('python')` 指向 Store 桩 | `services/km003c_worker.py:15-20`、`services/powerz-service.js:192` |
| P-4 | 打包后 `__dirname` 变为插件根目录，worker 脚本路径失效 | `services/powerz-service.js:186` + `build.py` 仅合并 `.js` |
| P-5 | `getStatus()` 每 200ms 无条件重启 worker，造成进程风暴 | `services/powerz-service.js:548-550`、`powerz-panel.js:2748` |
| P-6 | MCP 与 UI **不共享状态**（独立进程各自 `new PowerZService`） | `mcp/powerz-mcp.js:34-45` |
| P-7 | 采集/分析接口未暴露为 MCP 工具 | `powerz-mcp.js` 仅 6 个工具，缺 `launchOfficial/listCaptures/analyzeCapture` |
| P-8 | 诱骗指令与官方不符 | `powerz-panel.js:1911-1935` |
| P-9 | 硬编码绝对路径与逆向密钥 | `powerz-service.js:20-23`、`141-142` |
| P-10 | 导入只保留 VBUS/IBUS，丢弃 CC/DP/DM/温度 | `powerz-service.js:1101-1139` |
| P-11 | 测试把“伪报文生成”当期望行为 | `docs/test_runner.js:802-803` |

**可保留基座**：UI 布局/配色/4 视图/示波器绘制、companion-server `/api/powerz/*` 路由骨架、MCP stdio 骨架、`launchOfficial`+captures 目录的“官方工具联动”思路。

---

## 2. 目标架构

```
                       ┌───────────────────────────────────────────┐
   实体 KM003C ──USB──▶ │ 虚拟串口 CDC (官方自动上传协议 02/03)      │
                       └───────────────┬───────────────────────────┘
                                       │ pyserial (worker)
                       ┌───────────────▼───────────────────────────┐
                       │ services/km003c_worker.py                  │
                       │  - 解析 4B 包头 + N×20B adc_queue_data_t   │
                       │  - 透出 adc / pd_raw / ufcs_raw (JSON行)   │
                       └───────────────┬───────────────────────────┘
                                       │ stdio JSON-lines
                       ┌───────────────▼───────────────────────────┐
                       │ services/powerz-service.js (单例)          │
                       │  - buffer(ADC) / pdPackets / ufcsPackets   │
                       │  - decodePdFrame() / decodeUfcsFrame()     │
                       │  - 落盘 *.adc.jsonl / *.pd.jsonl / *.meta  │
                       └───────┬───────────────────────┬───────────┘
                               │                       │
              ┌────────────────▼─────────┐   ┌─────────▼──────────────────┐
              │ companion-server          │   │ UI powerz-panel.js          │
              │ /api/powerz/*  (HTTP)     │◀──│ (fetch 200ms 轮询)          │
              └────────────────┬─────────┘   └────────────────────────────┘
                               │ HTTP (127.0.0.1:28123)
              ┌────────────────▼──────────────────────────────────────────┐
              │ mcp/powerz-mcp.js (独立 stdio 进程，走 HTTP 复用同一实例) │
              └────────────────┬──────────────────────────────────────────┘
                               │ MCP
                    Agent Hub (DSH / Antigravity / Pi / Gemini)
```

**关键架构原则**
1. 数据真源唯一 = CDC worker；JS 侧只做解析/落盘/分发，不造数。
2. 状态唯一实例 = `powerz-service` 单例（插件进程内）；MCP 通过 HTTP 复用，不再各自 new。
3. 原始字节优先落盘（`*.raw.bin`/`jsonl`），解码可重放、可回归测试。

---

## 3. 阶段 P0：真实数据 + Agent 可用（必做）

### P0-1 重写硬件 worker 为官方 CDC 协议

**文件**：`services/km003c_worker.py`（整体重写）

实施要点：
1. **依赖**：`pyserial`。首启缺失时自动 `py -m pip install --user pyserial`；失败输出明确 `{"error": "..."}`，**禁止静默降级**。
2. **解释器解析**（改在 `powerz-service.js` 侧）：新增 `resolvePythonCmd()`，优先级：
   `settings.powerz.pythonPath` → `py` → `%LOCALAPPDATA%\Programs\Python\Python3xx\python.exe` → `python`；
   逐个用 `-c "import serial"` 探测，取首个可用者。不直接 `spawn('python')`。
3. **worker 路径解析**：`path.join(vaultBasePath, '.obsidian','plugins','tabonkb-workbench','services','km003c_worker.py')`（`vaultBasePath` 由 `getPowerZService({vaultBasePath})` 传入），**不再用 `__dirname`**。
4. **串口打开**：`serial.Serial(port, baudrate=115200, timeout=0.05)`（官方说明“虚拟串口无需设置波特率”，波特率仅为占位）；`port` 由 `serial.tools.list_ports` 匹配 `5FC9`/`POWER-Z`/首个 USB 串口。
5. **开流/维持/停流**：发 `02 00 <mode> <rate>`；模式高 4 位 `0=ADC/1=ADC+PD/2=ADC+UFCS/3=ADC+PD&UFCS`，速率低 4 位 `0=4Hz/1=10/2=50/3=1k`；每 <1h 周期补发 `02`；`03` 停流。
6. **接收解析**：4 字节包头 `cdc_cmd_t` + N×20 字节 `adc_queue_data_t`（小端）。按 `obj` 字段与总长做**残帧缓存**（官方明确高采样率下包长会变化）。
7. **PD/UFCS 报文段**：原样透出 `{"pd_raw":"<hex>","ts":...}` / `{"ufcs_raw":...}`，**解码交给 JS 侧**（worker 不做猜测）。
8. **stdio 契约**（保持与 service 侧兼容）：
   `{"status":"connected",...}`、`{"status":"disconnected"}`、`{"adc":{...}}`、`{"pd_raw":"..."}`、`{"ufcs_raw":"..."}`、`{"status":"trigger_result","cmd":...,"resp":...}`。
9. **删除**：所有 `km003c.*` 猜测 API、`ATT_PD_TRACE`、`CMD_ENABLE_PD_MONITOR` 等。

**验收**：worker 常驻；50Hz 下 1s 内上报约 50 条 `adc`；拔出设备输出 `disconnected` 且不退出（热插拔守护）。

---

### P0-2 Service 去伪存真 + 接真流

**文件**：`services/powerz-service.js`

1. **删除伪报文**：`generatePdHandshakePackets`、`generateUfcsHandshakePackets`、`onVbusStepChange`、`appendPdKeepalive`、`appendUfcsKeepalive`，及 `processProtocolStream` 中的全部调用。
2. **`handleWorkerMessage`**：
   - `msg.adc` → 更新 `latestSnapshot`，`isRecording` 时压 `buffer`（时间取设备 `Time`/`ts`）。
   - `msg.pd_raw`/`msg.ufcs_raw` → `decodePdFrame()`/`decodeUfcsFrame()`（P1-2）后 push 对应 packet 数组，并更新 `currentPdContract`/`currentUfcsContract`。
3. **`getStatus()`（`:544-560`）**：移除无条件 `startHardwareWorker()`；仅当 `workerProc` 为空、`deviceInfo.connected`、且距上次尝试 > 3s 才重启（消除 P-5 进程风暴）。
4. **`probeHardwareAsync`**：保留 VID 探测；去掉硬编码 `firmware:'V1.9.9'` 与 `authenticated:true`（改为 worker 上报或 `null`）。
5. **触发动作真实化**：`togglePdRecord/ufcsRecord/renegotiate` 改为向 worker 发 `02 00 1x/2x`（含协议）或 PDM 指令，**不再生成报文**。
6. **配置化 + 落盘**：
   - `OFFICIAL_DIR`/`CAPTURE_DIR` 由 `vaultBasePath + '07-Project/2026-powerZ/...'` 推导（允许设置项覆盖）。
   - 移除内嵌 AES 密钥（CDC 方案不需要）。
   - 记录停止时写 `<CaptureDir>/<name>.adc.jsonl`、`<name>.pd.jsonl`、`<name>.ufcs.jsonl`、`<name>.meta.json`。

**验收**：断开时 HUD 全 0、列表空态、契约「待机空闲」；记录时 `buffer`/`pdPackets` 真实增长。

---

### P0-3 MCP 状态共享 + 采集类工具

**文件**：`mcp/powerz-mcp.js`、`mcp/powerz-mcp-shared.js`、`services/companion-server.js`

1. **MCP 走 HTTP**：`const base = process.env.TABONKB_COMPANION_URL || 'http://127.0.0.1:28123'`；既有 6 个工具改调 `GET/POST base + '/api/powerz/*'`；HTTP 不可用返回**明确错误**（禁止静默回退到空实例）。
2. **`buildPowerzEnv()`** 注入 `TABONKB_COMPANION_URL`。
3. **companion-server 新增路由**：
   - `GET  /api/powerz/captures` → `listCaptures()`
   - `POST /api/powerz/analyze` `{file, opts}` → `analyzeCapture(file)`
   - `POST /api/powerz/launch` `{tool}` → `launchOfficial`
   - `GET  /api/powerz/capture-data?file=&type=&offset=&limit=` → 分页读取
4. **MCP 新增工具**：
   - `powerz_launch_official(tool: 'Mtools'|'PDM')`
   - `powerz_list_captures()`
   - `powerz_analyze_capture(file, durationSeconds?, points?)` → `{summary, pd, ufcs, curve}`
   - `powerz_get_capture_data(file, type:'adc'|'pd'|'ufcs', offset?, limit?)` → 分页（防 Token 爆炸）
   - `powerz_export_pd_trace(file)` → 归一化 PD 报文 JSON
5. 更新 `POWERZ_MCP_TOOL_HINT`。

**验收**：UI 记录中的状态下，Agent 调 `powerz_get_charging_summary` 读到与 UI 一致的数据（同一实例）。

---

### P0-4 UI 真数据渲染 + 空态

**文件**：`components/tools/charger/powerz-panel.js`

1. `renderPdDetail`（`:2392-2489`）废弃硬编码常量，改为按选中报文 `raw` 解码渲染；未解码前显示「原始 hex + 未解码」。
2. `renderUfcsDetail`（`:2542-2558`）去掉常量厂商码/步进，改为真实解码结果。
3. 保留 4 视图与示波器；`executeProtocolTrigger` 暂留并在 P1-1 对齐。

**验收**：切换不同 PD 报文，详情随之变化；无报文时为空态。

---

## 4. 阶段 P1：功能完整与官方对齐

### P1-1 诱骗指令对齐官方 PDM 协议
**文件**：`components/tools/charger/powerz-panel.js:1911-1935`、worker trigger 分支

修正映射：
| UI 动作 | 现状（错误） | 官方（正确） |
|---|---|---|
| PD 固定档 | `pd req=1 3000` | `pd req=<pos>,cur=<mA>` |
| PD PPS/AVS | — | `pd req=<pos>,volt=<mV>,cur=<mA>` |
| UFCS | `ufcs volt=<v> curr=<c>` | `ufcs req=<n>,volt=<mV>,cur=<mA>` |
| QC3 | `qc3 volt=<v>` | `qc3 volt=<mV>`（正确） |
| 全协议盲测 | `auto detect` | `entry list`（完整为 `entry list+`） |
| 前置 | 无 | 先 `pdm open`；`entry pd` 等 `ready`；`pd pdo` 查能力；`pd cmd=?`/`pd data=` 原样注入 |

### P1-2 PD/UFCS 真实解码器
**新增** `services/pd-decoder.js`（纯函数，便于单测）— 已于 P0 阶段先行落地基础能力（ADC 记录解码、PD 线帧/PDO 解码），后续在 P1 补齐 UFCS 解码。
- 报文头位域（参照 `hiddemo.cpp`）：`msgType[0:4] / numObj[12:14] / msgId[9:11] / pwrRole[8] / specRev[6:7] / dataRole[5]`。
- SOP/SOP'/SOP'' 映射；PDO 解码（Fixed/APDO/PPS）。
- UFCS 按 `translations/cmd.pdf` 与 UFCS 手册解。
- 复用点：worker 输出在 JS 侧解码；UI 详情；MCP `pd.jsonl` 生成。

### P1-3 官方 Mtools CSV 归一化导入
**文件**：`powerz-service.js:importCsvText`
- 兼容前置信息行与非标准表头；保留 CC1/CC2/DP/DM/TEMP；可与 `*.adc.jsonl` 互转。

### P1-4 MCP 接入 DSH/Pi/Gemini + 设置项
- 参照 `providers/antigravity-adapter.js:7,29`，在 `dsh-adapter.js`/`pi-adapter.js`/`gemini-adapter.js` 注册 `tabonkb-powerz`。
- `settings/workbench-settings-tab.js` 增加 `powerz.officialDir/captureDir/pythonPath/serialPort`。

### P1-5 配置/合规清理
- 去除绝对路径与逆向密钥；`data.json` 兼容旧值；更新文档与提示词。

---

## 5. Agent Hub 数据接口契约

**落盘根目录**：`07-Project/2026-powerZ/captures/`

```
<name>.adc.jsonl   {"t":0.02,"vbus":9.002,"ibus":3.062,"pwr":27.57,"temp":42.1,"cc1":1.65,"cc2":1.65,"dp":0.0,"dm":0.0,"rate":50}
<name>.pd.jsonl    {"ts":0.42,"sop":"SOP","msgType":2,"msg":"Request","msgId":3,"pwrRole":1,"dataRole":0,"specRev":2,
                    "numObj":1,"raw":"00 82 10 2C B1 04 23","objects":[{"raw":"0x...","decoded":{"kind":"Fixed","v":9.0,"i":3.0}}]}
<name>.ufcs.jsonl  {"ts":..,"stage":"能力请求","cmd":..,"raw":"..","decoded":{..}}
<name>.meta.json   {"model":"KM003C","sn":"033618","firmware":"..","rate":50,"mode":"PD","startedAt":..,"endedAt":..}
```

**返回策略**：MCP 一律返回结构化 JSON；大数据用 `getChargingSummary` 式降采样；原始报文用 `offset/limit` 分页。

---

## 6. 验证与治理（每步必做）

1. 代码改动后：`python build.py` → `node -c main.js`；UI 改动先用 `ui/tools/battery-charger.html` 本地预览。
2. `node docs/test_runner.js`：删除 P-11 类“伪报文生成”断言，改为**解码器黄金样例**（用官方样本 `pd data=0082102CB10423` 断言解出 Request Fixed 9V）。
3. 按 `AGENTS.md` 模板在 `docs/CHANGELOG.md` 追加每条改动；重大特性同步 `99-Meta/05-CHANGELOG.md` 与 `99-Meta/07-AI-Oplog/`。
4. 热重载：`POST /api/reload-plugin`。
5. 无实体设备时的回归：用官方 exe 导出 CSV + 录制的原始串口字节流做回放测试。

---

## 7. 实施顺序与依赖

```
P0-1 (worker: 装pyserial + 解释器/路径解析 + CDC协议)
   └─▶ P0-2 (service 去伪接真 + 落盘)
          ├─▶ P0-4 (UI 真渲染)
          └─▶ P0-3 (MCP 走 HTTP + 采集工具)
                 └─▶ P1-2 (PD/UFCS 解码器)
                        ├─▶ P1-1 (诱骗指令对齐)
                        ├─▶ P1-3 (CSV 导入归一化)
                        └─▶ P1-4 (多适配器 + 设置项)
                               └─▶ P1-5 (配置/合规清理)
```

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| `pyserial` 安装失败（无网/权限） | 引导脚本 + 明确报错；降级 PowerShell `System.IO.Ports`（仅低采样率） |
| 串口速率受限（官方 ~200KB/s） | 1kSPS 时分页/落盘，UI 仅保留近 N 点 |
| CC/DP/DM LSB 文档矛盾（0.1mV vs 示例 1mV） | 实测校准并用单测固定常量 |
| 无实体设备无法端到端 | 官方 CSV + 原始串口字节流回放测试 |
| MCP 进程早于 companion-server 启动 | 返回明确“服务未就绪”提示，并提示重试 |

---

## 附录 A：官方协议速查（实现直接可用）

**4 字节 `MsgHeader`（HID/USER/CDC 通用）**
```
ctrl  : type:7(CMD) extend:1 id:8 att:15
data  : type:7 extend:1 id:8 obj:10
header: att:15 next:1 chunk:6 size:10
```
- Ctrl：`CMD_SYNC=1 CONNECT=2 DISCONNECT=3 RESET=4 ACCEPT=5 REJECT=6 FINISHED=7 JUMP_APROM=8 JUMP_DFU=9 GET_STATUS=10 ERROR=11 GET_DATA=0x0C GET_FILE=13`
- Data：`CMD_HEAD=64 CMD_PUT_DATA=65`
- Attribute：`ATT_ADC=0x001 ATT_ADC_QUEUE=0x002 ATT_ADC_QUEUE_10K=0x004 ATT_SETTINGS=0x008 ATT_PD_PACKET=0x010 ATT_PD_STATUS=0x020 ATT_QC_PACKET=0x040`

**HID 读取 ADC 帧示例（`hiddemo.cpp`）**
```
head.ctrl.type = CMD_GET_DATA; head.ctrl.att = ATT_ADC;  // 0x0C 00 02 00
响应: [MsgHeader(4B)][head_ext(4B)][AdcData(…)]
缩放: Vbus/1e6, Ibus/1e6 (V/A); Vdp/1e4, Vcc1/1e4
```

**`AdcData_TypeDef`（HID）**
```
int32 Vbus, Ibus, Vbus_avg, Ibus_avg, Vbus_ori_avg, Ibus_ori_avg;
int16 Temp; uint16 Vcc1, Vcc2, Vdp, Vdm, Vdd; uint8 Rate:2, n[3];
```

**CDC 自动上传包头 `cdc_cmd_t`**
```
type:7 zero:1 att:8 obj:8 crc:8
0x01 周期同步 | 0x02 开传 | 0x03 停传
发: 02 00 <mode><rate>
  mode 高4位: 0=仅ADC 1=ADC+PD 2=ADC+UFCS 3=ADC+PD&UFCS
  rate 低4位: 0=4Hz 1=10 2=50 3=1k 4=1万(保留)
收: 4B 包头 + N×20B 数据
```

**`adc_queue_data_t`（20B，小端）**
```
uint32 Time; int32 Vbus(uV); int32 Ibus(uA); uint16 Vcc1; uint16 Vcc2; uint16 Vdp; uint16 Vdm;
示例: 68 F9 88 00 = 8976744 = 8.976744V ; 2F DF EF FF = -1056977 = -1.056977A(反向)
```

**PDM 指令集（虚拟串口）**
```
pdm open | pdm close
pdm set type=<0自动/1 PD3.0/2 PD3.1/3私有PPS>,em=<0/1/2>,sink=<0/1>
entry pd | entry ufcs | entry qc | entry fcp | entry scp | entry afc | entry vfcp | entry sfcp | entry tfcp
entry bc | entry apple | entry list | entry list+ | reset
pd pdo
pd req=<pos>,cur=<mA>
pd req=<pos>,volt=<mV>,cur=<mA>
pd cmd=<n>            (Control Message, 参考 PD Protocol Layer)
pd data=<SOP><Header><Objects...>   (原始注入; 不含 CRC; SOP 00/01/02)
qc <5V|9V|12V|20V> | qc3 volt=<mV> | qc3 inc=<n> | qc3 dec=<n>
fcp <5V|9V|12V> | scp volt=<mV>,cur=<mA> | afc <5V|9V|12V>
ufcs req=<n>,volt=<mV>,cur=<mA> | ufcs pdo | ufcs cmd=<n>
```
> 注：`pd data=` 仅能控制 Header 的 `Extended/NumObj/MessageType`，`MessageID/PowerRole/SpecRev/DataRole` 由设备状态机决定。

---

## 附录 B：参考资料索引（`07-Project/2026-powerZ/`）

- `KM003C HID接口/hiddemo_vs2019_for km系列/hiddemo.cpp` — HID 协议与 ADC 结构体
- `KM003C HID接口/Km002c3c接口说明.docx` — MsgHeader / CMD / ATT 定义
- `KM003C HID接口/免CDC驱动.docx` — CDC 自动上传与包头
- `KM003C HID接口/KM003C 系列使用虚拟串口触发协议说明书(实验).pdf` — PDM 指令
- `POWER-Z KM003C 上位机免安装板/doc/获取ADC数据新命令.pdf` — `02/03` 与 `adc_queue_data_t`
- `POWER-Z KM003C 上位机免安装板/doc/如何使用PDM功能发送自定义数据.pdf` — `pd data=` 帧格式
- `POWER-Z KM003C 上位机免安装板/doc/KM003C_002C_Virtual_Serial_Port_Protocol_Trigger_Bilingual.pdf` — 中英对照指令表
