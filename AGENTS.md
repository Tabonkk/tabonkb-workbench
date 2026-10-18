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
   py build.py
   ```
2. **构建后必须验证语法**：
   ```powershell
   node -c main.js
   ```
3. **禁止直接只改 `main.js` 而不改源文件**，否则下次执行 `build.py` 时修改会被覆盖丢失！

## 3. 防退化与禁止静默降级原则
- **协议错误可见性**：如遇上游 API 报错或文件上传失败，绝不允许静默丢弃图片/参数退回纯文本发问；必须显式向用户抛出真实错误。
- **配置持久化**：涉及用户凭据与设置变动，必须通过 `saveSettings()` 规范持久化，不得修改用户已有且有效的第三方 Token。

## 4. 版本发布标准操作规程 (Release Workflow SOP)
当用户要求发布新版本或将代码发布提交至远程仓库时，**必须严格遵循标准发布流水线**：
详细规范文档：[`docs/RELEASE_WORKFLOW.md`](./docs/RELEASE_WORKFLOW.md)

**核心七步流水线**：
1. **工作区清理与过滤**：核查 `git status`，确保 `.startup-profile.json`、`active-context.json` 等运行时产物由 `.gitignore` 过滤，严禁误提。
2. **版本号双向同步**：同步修改 `manifest.json` 与 `docs/test_runner.js`（Suite 1 中的版本号断言）。
3. **编译打包与语法强校验**：执行 `py build.py`（Windows 优先使用 `py` 启动器）与 `node -c main.js`。
4. **全量自动化单元测试**：执行 `node docs/test_runner.js`，必须 100% 全绿 PASS（0 Failures）方可发布。
5. **三级变更与审计日志登记**：
   - 插件日志：[`docs/CHANGELOG.md`](./docs/CHANGELOG.md)
   - 知识库全局日志：[`../../../99-Meta/05-CHANGELOG.md`](../../../99-Meta/05-CHANGELOG.md)
   - 全局 AI 操作日志：[`../../../99-Meta/07-AI-Oplog/YYYY-MM.md`](../../../99-Meta/07-AI-Oplog/)
6. **Git 规范化提交与打标**：
   - `git add .`
   - `git commit -m "feat(release): release TabonKB Workbench vX.Y.Z" -m "详细说明..."`
   - `git tag -a vX.Y.Z -m "TabonKB Workbench vX.Y.Z"`
7. **远程推送与工作区核验**：
   - `git push origin main --tags`
   - 确认 `git status` 提示 `working tree clean`。

