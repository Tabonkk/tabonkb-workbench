# TabonKB 研发工作台插件版本发布标准操作规程 (Release Workflow SOP)

> **文档定位**：本规程是 TabonKB 研发工作台插件（`.obsidian/plugins/tabonkb-workbench/`）进行版本打包、质量验证、变更审计与 Git 远程发布的**官方标准流程**。所有 AI Agent 与人类开发者在执行版本发布时必须严格遵循。

---

## 1. 核心原则与准入条件 (Pre-flight Checklist)

在触发版本发布之前，必须满足以下前置准入条件：

1. **工作树审查**：
   - 运行 `git status` 检查当前改动。
   - 严格区分“真实源代码”与“本地临时运行时文件”。
   - 运行时临时生成的文件（如 `.startup-profile.json`、`active-context.json`、`*.log`、`.chat-history.json`）必须列入 `.gitignore`，**严禁污染提交到 Git 仓库**。
2. **源码模块完整性**：
   - 若新增了服务或模块文件（如 `services/agent-version-service.js`、`components/xxx.js`），必须确认已在 `build.py` 的 `files` 数组中完成注册。
   - **禁止直接手工只修改 `main.js`**，一切修改必须在各子模块中落地，由构建脚本自动编译合并。
3. **零缺陷准入**：
   - 静态语法检查与全量自动化单元测试必须 **100% 全绿（Zero Failures）** 才能进入发布流程。

---

## 2. 版本号命名规范 (Semantic Versioning)

遵循语义化版本规范 `vMajor.Minor.Patch`：

| 变更级别 | 示例 | 触发场景 |
|---|---|---|
| **Minor (次版本大特性)** | `v1.5.0` → `v1.6.0` | 累积了多项重大新特性、系统性架构重构、全新服务模块引入或全局视觉交互全面重塑。 |
| **Patch (修订/补丁版本)** | `v1.6.0` → `v1.6.1` | 偶发缺陷紧急修复、微小文案修正或小范围样式微调。 |

> [!NOTE]
> 在日常开发调试过程中，每次修改应在 `docs/CHANGELOG.md` 中按小版本递增留痕（如 `[1.5.1]` ~ `[1.5.22]`）；当用户明确指示“发布下一个版本”时，将该阶段的所有工作收敛发布为一个正式里程碑版本（如 `v1.6.0`）。

---

## 3. 标准发布七步流水线 (7-Step Release Pipeline)

工作目录均在插件根目录：`d:\work\Mgmt\TabonKB\.obsidian\plugins\tabonkb-workbench\`。

```mermaid
flowchart TD
    A["步骤 1: 检查工作区 & 过滤临时文件 (.gitignore)"] --> B["步骤 2: 同步升级版本号 (manifest.json & test_runner.js)"]
    B --> C["步骤 3: 运行打包构建与语法检查 (py build.py & node -c)"]
    C --> D["步骤 4: 运行全量单元测试 (node docs/test_runner.js)"]
    D -->|全部通过 (PASS)| E["步骤 5: 登记三级变更日志 (CHANGELOG.md / 05-CHANGELOG / 07-Oplog)"]
    D -->|存在失败 (FAIL)| X["终止发布并排查修复"]
    E --> F["步骤 6: Git 暂存、规范化提交与附注打标 (git commit & tag)"]
    F --> G["步骤 7: 推送远程仓库并核验 (git push origin main --tags)"]
```

---

### 步骤 1：工作区清理与 `.gitignore` 准入检查

检查并清理运行时生成的调试文件：

```powershell
git status
```

- 若发现 `.startup-profile.json`、`active-context.json` 等非源码文件处于 Untracked 状态，检查并更新 `.gitignore` 确保其被正确忽略。
- 确认所有新增的合法源码文件（如 `services/xxx.js`）已被 `git` 识别。

---

### 步骤 2：版本号规范与双文件同步升级

必须同步修改以下 **两个文件**，保持版本号完全一致：

1. **`manifest.json`**：
   ```json
   {
     "id": "tabonkb-workbench",
     "name": "TabonKB 研发工作台",
     "version": "1.6.0",
     ...
   }
   ```
2. **`docs/test_runner.js`**（Suite 1 中的版本号断言）：
   ```javascript
   assert(manifest.version === '1.6.0', 'manifest.json has version 1.6.0');
   ```

---

### 步骤 3：打包构建与静态语法校验

运行构建脚本将模块代码打包至 `main.js`，并执行语法校验：

```powershell
py build.py
node -c main.js
```

> [!IMPORTANT]
> **Windows 环境 Python 运行提示**：
> 在 Windows 环境下，直接输入 `python build.py` 可能会触发系统默认的 WindowsApps 商店别名存根导致报错。推荐一律使用 Python 启动器 **`py build.py`**。
> 执行构建时，检查终端输出，必须出现 `Successfully bundled all components into main.js!` 且无 Python `SyntaxWarning` 语法警告。
> `node -c main.js` 执行后无任何报错输出即代表 AST 校验通过。

---

### 步骤 4：全量自动化单元测试验证

运行单元测试套件：

```powershell
node docs/test_runner.js
```

- 预期结果输出：
  ```text
  ===============================================================
     TEST RESULTS SUMMARY: 392 Passed, 0 Failed (Total: 392)
     STATUS: ALL SELF-TEST SUITES PASSED! [V1.0.0 RELEASE READY]
  ===============================================================
  ```
- **红线要求**：必须达到 **0 Failed**；若有任何一项用例失败，必须立即定位并修复问题，重复步骤 3 和步骤 4，严禁跳过或注销测试！

---

### 步骤 5：三级变更与审计日志登记

版本发布作为里程碑事件，必须在三个层级完成留痕与审计同步：

#### 5.1 插件级变更日志 (`docs/CHANGELOG.md`)
在文件最顶端追加 `## [x.y.z] - YYYY-MM-DD` 结构化条目：
```markdown
## [1.6.0] - 2026-10-18
### Released
- **正式发布 TabonKB 研发工作台 V1.6.0 里程碑版本**：
  - **涉及文件**：manifest.json, build.py, main.js, services/..., pi-drawer-view.js, styles.css, docs/test_runner.js
  - **问题背景**：阶段性功能迭代与体验打磨全面完成，发布正式里程碑版本并推送至远程仓库。
  - **核心修改逻辑**：
    1. ...（总结核心功能与重构亮点）
    2. ...
  - **验证状态**：py build.py 打包通过；node -c main.js 语法验证通过；全量 392 项自动化单元测试 100% 全绿 PASS。
  - **执行 Agent**：<Agent名称>
```

#### 5.2 知识库全局变更日志 (`99-Meta/05-CHANGELOG.md`)
在表格最上方插入一条发布记录：
```markdown
| 2026-10-18 | tooling | **正式发布 TabonKB 研发工作台 V1.6.0**：发布里程碑大版本。1) ...；2) ...；全量 392 项单测 100% 全绿并推送到远程仓库 | 整理工作台代码发布下一个版本并提交远程仓库 | <Agent名称> |
```

#### 5.3 知识库全局 AI 操作日志 (`99-Meta/07-AI-Oplog/YYYY-MM.md`)
在当月操作日志表格最上方插入一条 L1 级别的 release 审计记录：
```markdown
| 2026-10-18T16:00 | L1 | release | .obsidian/plugins/tabonkb-workbench/ | 整理工作台源码，正式发布 TabonKB Workbench v1.6.0 里程碑版本并推送代码：1. manifest.json 与 test_runner.js 版本升至 1.6.0；2. ...；3. py build.py + node -c + 392 项单测全绿；4. 同步更新 CHANGELOG.md；5. 提交 git commit 并通过 git push 推送至远程仓库 origin/main | 用户指令：工作台插件代码整理发布下一个版本，并将代码提交远程仓库；AGENTS.md§2 | 1.00 | auto | B-YYYYMMDD-REL-XX |
```

---

### 步骤 6：Git 暂存、规范化提交与附注打标

1. **暂存所有变更**：
   ```powershell
   git add .
   ```
2. **检查暂存清单**：
   ```powershell
   git status
   ```
   确认暂存列表中无多余临时文件。
3. **提交 Commit**（严格遵循 `feat(release)` 规范与多行说明）：
   ```powershell
   git commit -m "feat(release): release TabonKB Workbench v1.6.0" -m "- 升级版本至 v1.6.0 (manifest.json, test_runner.js, docs/CHANGELOG.md)
   - 新增 Agent 版本探测与自更新服务 (services/agent-version-service.js)
   - Mermaid 流程图工业级视觉美学系统性重塑
   - 技术卡片与代码美学打磨 (#A31515 酒红行内参数、代码框顶栏微缩)
   - 会话流控与高韧性架构 (Steer 转向、Follow-up 队列、异常中断恢复)
   - Agent 用量效能看板深度重构 (三源合流精准统计、趋势柱状图悬停浮窗)
   - DeepSeek Harness 生态交互精修 (「+」菜单四级递进工程上下文)
   - 全量 392 项自动化单元测试 100% 全绿 PASS"
   ```
4. **创建附注标签 (Annotated Tag)**：
   ```powershell
   git tag -a v1.6.0 -m "TabonKB Workbench v1.6.0"
   ```

---

### 步骤 7：远程推送与流水线验证

推送代码分支与标签至 GitHub 远程仓库：

```powershell
git push origin main --tags
```

推送成功后执行最终工作区核验：
```powershell
git status
```
确保输出：
```text
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

---

## 4. 常见问题与排错手册 (Troubleshooting)

### Q1: `python build.py` 无任何输出或退出码为 1
- **原因**：Windows 应用执行别名（`AppData\Local\Microsoft\WindowsApps\python.exe`）接管了 python 命令但未关联真实解释器。
- **解法**：使用 `py build.py`（系统标准 Python 启动器 `C:\WINDOWS\py.exe`）。

### Q2: `build.py` 报错 `SyntaxWarning: invalid escape sequence`
- **原因**：Python 3.12+ 对非 raw string 多行注释中的反斜杠（如 `D:\work`）实施严格转义检查。
- **解法**：在多行模板代码注释中将单个反斜杠双写转义（如 `D:\\work`）。

### Q3: `node docs/test_runner.js` 报错 `manifest.json has version ... [FAIL]`
- **原因**：只修改了 `manifest.json`，遗漏了 `docs/test_runner.js` 对应 Suite 1 里的断言行。
- **解法**：同步修改 `docs/test_runner.js` 对应断言中的期望版本号，重新测试。

### Q4: 提交前发现有 `.startup-profile.json` 或 `active-context.json` 变动
- **原因**：Obsidian 在运行态下由工作台插件写入的诊断打点与当前用户激活上下文状态文件。
- **解法**：确认已在 `.gitignore` 中加入这两个文件，使用 `git restore` 或 `git clean` 清理，严禁提交到远端仓库。

---

## 5. 快速执行指令速查表 (Quick Reference)

```powershell
# 1. 确保在插件目录
cd d:\work\Mgmt\TabonKB\.obsidian\plugins\tabonkb-workbench

# 2. 修改版本号
# 编辑 manifest.json 和 docs/test_runner.js 匹配新版本号（如 1.6.0）

# 3. 编译打包与静态语法校验
py build.py
node -c main.js

# 4. 全量单测验证
node docs/test_runner.js

# 5. 登记三级日志：
# - .obsidian/plugins/tabonkb-workbench/docs/CHANGELOG.md
# - 99-Meta/05-CHANGELOG.md
# - 99-Meta/07-AI-Oplog/YYYY-MM.md

# 6. Git 提交与打标
git add .
git commit -m "feat(release): release TabonKB Workbench vX.Y.Z" -m "详细发布说明..."
git tag -a vX.Y.Z -m "TabonKB Workbench vX.Y.Z"

# 7. 推送至远程仓库
git push origin main --tags
git status
```
