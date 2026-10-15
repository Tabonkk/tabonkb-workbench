# DSLogic 协议解码器（第三方 GPL 代码）

- 来源：DreamSourceLab DSView v1.3.2 源码 `libsigrokdecode4DSL/decoders/`（本地副本 `07-Project/2026-dsview/DSView-master`）。
- 许可：GPL-3.0（见同目录 `COPYING`），各解码器文件头另有 GPLv2+ 声明，保持原样。
- 用法：由 `services/dslogic/srd_shim.py` 以纯 Python 方式加载执行，不链接 libsigrokdecode C 库。
- 维护：同步上游时整目录替换，并运行 `py docs/dslogic-p0.test.py` 回归。禁止在此目录内做私有修改；需要定制的解码器放在 `vendor/dslogic/decoders-local/`（同名优先）。
