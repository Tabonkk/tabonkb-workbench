# TabonKB 研发工作台浏览器伴侣扩展 (TabonKB Companion)

本扩展是专为 **TabonKB 研发工作台** 打造的浏览器轻量伴侣，用于一键提取并同步 **紫光展锐 Uni-Support (DCC & FAQ)** 以及 **MTK Online** 平台的登录认证凭据（Token / Cookie），解决原厂凭据频繁失效、手动 F12 复制繁琐的痛点。

---

## 🚀 30 秒安装步骤（支持 Microsoft Edge 与 Google Chrome）

本扩展为开源离线扩展，无需通过应用商店，直接使用浏览器的「开发者模式」即可一键加载：

### 第一步：打开浏览器的扩展管理页
- **Microsoft Edge**：在地址栏输入并回车访问：`edge://extensions`
- **Google Chrome**：在地址栏输入并回车访问：`chrome://extensions`

### 第二步：开启开发者模式
- 在页面左侧或右上角，找到并勾选开启 **「开发者模式」(Developer mode)** 开关。

### 第三步：加载扩展程序
- 点击页面上方出现的 **「加载已解压的扩展程序」(Load unpacked)** 按钮；
- 在弹出的文件选择器中，选中当前这个文件夹：
  ```
  D:\work\Mgmt\TabonKB\.obsidian\plugins\tabonkb-workbench\browser-extension
  ```
- 点击确定，浏览器扩展栏即刻出现 **💎 TabonKB 伴侣** 图标！

---

## 💡 如何使用（极速同步）

### 方式一：网页浮钮一键同步（最推荐）
1. 在浏览器中打开并登录 [紫光展锐 Uni-Support (unisupport.unisoc.com)](https://unisupport.unisoc.com/)；
2. 登录成功后，页面右下角会自动浮现一个胶囊挂件：**`[ 💎 TabonKB 伴侣 | ⚡ 一键同步到工作台 ]`**；
3. **点击「⚡ 一键同步到工作台」**：
   - 伴侣扩展会自动提取当前的有效 Token，并通过本地安全回环接口直接推送到 Obsidian 工作台；
   - 提示 `✅ 同步成功！`，Obsidian 端会立即解除失效警告并重新发起实时抓取！

### 方式二：点击浏览器右上角图标弹窗
1. 点击浏览器工具栏右上角的 **💎 TabonKB 图标**；
2. 弹出面板会自动展示检测到的 Token 内容及工作台连接状态；
3. 点击 **「⚡ 一键同步到 TabonKB」**，或点击 **「📋 复制 Token」** 即可。

---

## 🔒 安全与隐私机制说明
- **仅本机回环通信**：伴侣服务严格监听在 `127.0.0.1:28123` 本机地址，外部局域网及公网完全不可访问；
- **免除杀毒误报**：使用浏览器官方 Extension API 规范提取已登录 Cookie，不访问本地敏感文件，合规安全；
- **优雅降级**：若点击同步时未打开 Obsidian，扩展会自动将 Token 写入您的系统剪贴板，方便您随时粘贴使用。
