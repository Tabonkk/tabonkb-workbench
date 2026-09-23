# TabonKB Workbench 开发者与 Agent 协作准则

> **注意**：本文件是当前目录（`tabonkb-workbench` 插件）的专属规则。在此目录内工作时，AI Agent 与开发者必须无条件执行以下约定。

## 1. 改动必留痕规则 (Mandatory Changelog)
凡是对本插件目录内的源码、配置、样式等做出的任何改动，**必须**在以下文件中记录修改条目：
[`docs/CHANGELOG.md`](./docs/CHANGELOG.md)

每条记录需明确：
- **时间与类型**（`fix` / `feat` / `perf` / `refactor` / `style` / `docs`）
- **改动文件列表**
- **问题原因与背景**
- **核心修改逻辑与机理**
- **验证与测试结论**

## 2. 源码修改与编译打包流水线
本插件源码位于 `providers/`、`components/`、`services/`、`mcp/`、`settings/` 等子模块中，最终由 `build.py` 合并打包至 `main.js`。
因此：
1. **修改源码后必须执行构建**：
   ```powershell
   python build.py
   ```
2. **构建后必须验证语法**：
   ```powershell
   node -c main.js
   ```
3. **禁止直接只改 `main.js` 而不改源文件**，否则下次执行 `build.py` 时修改会被覆盖丢失！

## 3. 防退化与禁止静默降级原则
- **协议错误可见性**：如遇上游 API 报错或文件上传失败，绝不允许静默丢弃图片/参数退回纯文本发问；必须显式向用户抛出真实错误。
- **配置持久化**：涉及用户凭据与设置变动，必须通过 `saveSettings()` 规范持久化，不得修改用户已有且有效的第三方 Token。
