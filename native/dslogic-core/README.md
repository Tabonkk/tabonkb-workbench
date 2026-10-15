# dslogic-core —— 官方内核 worker

DSView 官方 `libsigrok4DSL`（`.dsl` 加载/回放）+ `libsigrokdecode4DSL`（协议解码）编译为常驻
NDJSON worker，供工作台生产链路使用（`services/dslogic` 经 `run_decode` 自动优先调用）。

## 目录

- `third_party/`：官方源码原样副本（**零补丁**，逐文件 SHA-256 见 `third_party/SOURCE.md`；
  如需补丁须先报验收方批准）
- `src/`：胶水层（capture / decode / edge_index / ndjson / jsonlite / main）
- `build.ps1`：可重复执行的构建+打包脚本（构建 → 收集 exe 与全部依赖 DLL →
  精简 Python 标准库 → 输出 `bin/dslogic-core/`）
- `build/`、`bin/`：构建产物，**不入库**（见插件 `.gitignore`）

## 重新构建

前置：MSYS2（UCRT64）。默认 `D:\msys64`；其他位置用 `-MsysRoot` 指定。

```powershell
powershell -ExecutionPolicy Bypass -File native/dslogic-core/build.ps1 [-MsysRoot D:\msys64] [-Clean]
```

产物布局（`bin/dslogic-core/`）：

```
dslogic-core.exe
*.dll            # 收集自 ucrt64/bin 的全部运行时依赖（glib/zlib/usb/python314 等）
python/          # 与编译头文件同版本的精简 Python 标准库
  bin/python*.dll + lib-dynload/*.pyd（按需要）
  lib/python3.14/...
```

运行时默认即自包含：exe 同目录 `python/` 为 PYTHONHOME，DLL 全部邻接，无需
`DSLCORE_PYTHON_HOME`、无需系统/MSYS2 Python。可用 `DSLCORE_EXE` 显式指定内核路径，
`DSL_ENGINE=shim` 强制回到 python 模拟层（仅测试用）。

## NDJSON 协议

- hello：`{"id":0,"ok":true,"data":{"ready":true,"engine":"..."}}`
- 请求：`{"id":n,"method":"ping|info|edges|decode|decoders|describe","params":{...}}`
- 响应：`{"id":n,"ok":true,"data":...}` / `{"id":n,"ok":false,"error":"中文原因"}`
- 解码器目录：环境变量 `DSLCORE_DECODERS`（默认 `<exe>/../../vendor/dslogic/decoders`）
