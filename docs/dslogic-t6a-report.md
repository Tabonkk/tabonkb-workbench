# T6a 官方内核验收报告

日期：2026-10-14 ｜ 范围：`.dsl` 加载 + 协议解码（无硬件）

## 1. 交付物

- `native/dslogic-core/`：官方内核 worker（NDJSON stdio，与 `dslogic_worker.py` 信封兼容）
  - `third_party/libsigrok4DSL` + `third_party/libsigrokdecode4DSL` + `third_party/common`：官方源码原样复制，**零补丁**
  - `src/`：胶水层（capture / decode / edge_index / ndjson / jsonlite / main），不含任何官方代码修改
  - `build/dslogic-core.exe`：MinGW-UCRT64 gcc 16.2 + cmake + ninja 构建
- 生产接入：`services/dslogic/dslogic_cli.py::run_decode` 自动优先调用内核 exe（`DSLCORE_EXE` 覆盖路径，`DSL_ENGINE=shim` 强制回退），worker/HTTP/MCP 全链路随之切换到官方内核
- 缓存：`dslogic_worker` 解码缓存键加入 `eng` 字段（native/shim 隔离），`DEC_CACHE_VERSION` 升至 4

## 2. 验收项

| 项 | 结果 |
|---|---|
| I2C vs DSView CSV | **1689/1689，match=true**（`verify-csv`，`decoder--261013-171418.csv`） |
| R65 vs srd_shim（I2C `0:i2c`） | **3758/3758 逐条全等**（`{$}`/`\n` 哨兵按官方语义归一后） |
| R65 vs srd_shim（PD `usb_power_delivery`） | **474/474 逐条全等** |
| third_party SHA-256 | **70/70 文件与官方源明文一致**（`third_party/SOURCE.md`，DLP 透明加密下经白名单进程计算） |
| 去系统 Python PATH | PATH=`ucrt64\bin;System32;Windows`（无 python.org）→ decode `ok:true, 1689 注解` |
| 回归 | p0 14/14、t2 全绿、t4.py 19/19、t4.js 19/19、t5.py 10/10、t5.js 17/17、t3 87/87、test_runner 255/255 |

## 3. 喂数实现（对照 `DSView/pv/data/decoderstack.cpp`）

`src/decode.c::decode_run` 逐行对齐 `decoderstack.cpp::decode_data`：

- 定位首个 logic 解码器实例（`dec->channels || dec->opt_channels`）
- `dec_num_channels` / `dec_channelmap[j]` 决定喂数通道，`-1` → 该通道 NULL
- 每通道独立打包位流缓冲（1 bit/样本），`inbuf_const[j]` 为起始样本位值
- 绝对样本号喂入，chunk ≤ `MaxChunkSize`（16KB/通道）
- `srd_session_send` 错误透出、`srd_session_end` 收尾、session/buffer 全量清理
- 元数据：`srd_session_metadata_set(SRD_CONF_SAMPLERATE)`

## 4. R65 差异报告（官方内核 vs srd_shim）

样本：`D:/work/prj/R65/DSLogic PLus-la-240912-133635.dsl`（16ch，10MHz，117.9M 样本，内嵌 `0:i2c` sda→0/scl→1 + `usb_power_delivery` cc1→2/cc2→3）。

| 维度 | 官方内核 | srd_shim | 差异 |
|---|---|---|---|
| 注解总数（i2c / PD） | 3758 / 474 | 3758 / 474 | 无 |
| 逐注解 `ss,es,dec,row,ann,cls,texts` | — | — | **全等**（归一后） |
| `@hex` 文本 | 官方 `type_decoder.c` 把 `@9F` 转为 `str_number_hex`+`\n` 哨兵 | 提前渲染为 `9F` | 表示法差异，worker 映射 `\n`→hex 后全等 |
| `{$}` 占位符 | 原样输出 + `hex`/`num` 字段 | 提前替换为 `%02X` | 表示法差异，映射后全等 |
| 发射顺序 | 解码器发射序（值注解可先于其 marker） | ss 时序 | worker 按 `(ss,es)` 排序后全等 |
| 扩展字段 | `inst`（`0:i2c-1`） | 无 | 内核多出实例 id |

结论：数值/时序/行归属**零实质差异**；三处差异均为官方底层表示法与 shim 提前渲染的表示层差异，worker 映射层统一消解。

## 5. 环境

- MSYS2 UCRT64：`D:/msys64/ucrt64`（gcc 16.2、cmake 4.4、python 3.14.8、glib 2.90、libusb、zlib、minizip）
- `DSLCORE_PYTHON_HOME` 默认探测：`native/dslogic-core/python/` → `D:/msys64/ucrt64` → `C:/msys64/ucrt64`
- 已知无害告警：构建期 `snprintf` 截断警告（胶水层、非官方源码）
---

## 附：T6a 返工 + T6b 数据源切换（2026-10-14 21:35）

### G1 自包含产物
- `native/dslogic-core/build.ps1` 可重复执行：cmake+ninja 构建 → 收集 exe + 9 个依赖 DLL
  （glib/libusb/zlib/libpython3.14/libwinpthread/libgcc/libiconv/libintl/libpcre2）→
  UCRT64 Python 3.14 精简标准库 2614 文件 + 官方解码器 656 文件 → `bin/dslogic-core/`。
- 清洁环境验收：PATH 仅 `System32;Windows`、无 `DSLCORE_*` → `decode` I2C **1689** 注解；
  `ldd` 全部解析（非系统 DLL 均来自 `bin/dslogic-core/`，无 not found）。

### G2 显式内核语义
- `run_decode`/`open_capture` 在内核缺失时抛 `DslError('官方内核不可用…')`，不回落；
  `DSL_ENGINE=shim` 显式开启才走 Python shim（测试路径）。

### G3/T6b 数据源切内核
- 新增 `services/dslogic/native_client.py`（NDJSON 客户端 + `NativeCapture`，
  info/load_edges 全走内核）与 `decode_pipeline.py`（spec/校验/输出组装）。
- worker 不再静态引用 `dsl_reader`/`srd_shim`/`dslogic_cli`（t6 断言验证 sys.modules 干净）。
- 内核新增 `decoders`/`describe` 方法（与 shim describe 契约同构）；
  `jb_raw_js` 修复 session/decoders 原文多行 JSON 破坏 NDJSON 单行契约；
  `cap_load` 增加 v3 版本显式拒绝 + 回放尾 granule 对齐补零的幻边沿修正。
- 证据：t6 **21/21**（info 键值、decoders、edges 逐通道与 dsl_reader 全等）；
  p0 **14/14**（合成文件版本拒绝、块边界边沿、缺通道/未知解码器显式错误均复验）；
  在线 `/api/dslogic/info|wave|decode|decoders|describe` 全通，decode 1689 带 `inst:"0:i2c-1"`。

