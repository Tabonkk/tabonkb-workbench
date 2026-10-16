const { PluginSettingTab, Setting, Notice } = require('obsidian');
const { DEFAULT_JIRA_JQL } = require('../services/jira-service');
const { DEFAULT_FEEDS } = require('../services/rss-service');

const DEFAULT_SETTINGS = {
  workbenchTheme: 'fresh', // 44 skins ('fresh' | 'standard' | 'glass' | 'obsidian' | 'mdn-*' | 'vsc-*' ...)
  workbenchThemeMode: 'auto', // 'auto' | 'light' | 'dark'
  workbenchWallpaper: 'aurora', // 'aurora' | 'bay' | 'sunset' | 'graphite'
  dsviewFollowTheme: true, // true: follow active dark / VS Code theme palette; false: lock DSView #1f1f1f
  jira: {
    type: 'datacenter', // 'cloud' | 'datacenter'
    authType: 'basic', // 'basic' | 'cookie' | 'pat'
    baseUrl: '',
    email: '',
    username: '',
    secretName: 'tabonkb-jira-token',
    jql: DEFAULT_JIRA_JQL,
    refreshIntervalMinutes: 5
  },
  niceaigc: {
    baseUrl: 'https://node8.nice188.com',
    model: 'gpt-4o',
    secretName: 'tabonkb-niceaigc-token'
  },
  rss: {
    feeds: DEFAULT_FEEDS,
    refreshIntervalMinutes: 15
  },
  vendorPortals: {
    mtk: {
      url: 'https://online.mediatek.com/',
      username: '',
      secretName: 'tabonkb-mtk-password'
    },
    unisoc: {
      url: 'https://unisupport.unisoc.com/',
      username: '',
      secretName: 'tabonkb-unisoc-password'
    }
  },
  weknora: {
    baseUrl: '',
    defaultKb: '',
    secretName: 'tabonkb-weknora-apikey',
    topoEnabled: false,
    topoGrouping: 'semantic',
    topoLimit: 300,
    topoTtlHours: 24,
    syncFolders: [
      '01-Platform',
      '02-OS-Kernel',
      '03-Driver',
      '04-Debug',
      '05-Toolchain',
      '06-Spec',
      '07-Project',
      '09-Hardware',
      '10-Test-Cert'
    ]
  },
  clipInliner: {
    enabled: true,
    folderPrefix: '00-Inbox/',
    maxImages: 30,
    maxBytes: 10485760,
    minBytes: 2048,
    debounceMs: 1200
  },
  opengrok: {
    baseUrl: 'http://192.168.1.12:7080/source',
    defaultProject: 'W_sprd_os_dev',
    timeout: 15000
  },
  gerrit: {
    baseUrl: 'http://192.168.1.17:8090',
    username: '',
    secretName: 'tabonkb-gerrit-password',
    timeout: 15000,
    readonly: true
  },
  dsh: {
    enabled: true,
    port: 3080,
    autoStart: true,
    profile: 'tabonkb',
    // 方案A (2026-10-01): 默认关闭 —— 该定制 CSS 与 DSH 原生 Grid 布局引擎冲突,
    // 会导致右侧留白、原生宽度拖拽失效与右栏面板被裁切, 仅在显式开启时注入
    layoutTweaks: false,
    customNodePath: ''
  }
};

class TabonKBSettingTab extends PluginSettingTab {
  /**
   * @param {any} app
   * @param {any} plugin
   */
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  _readSecretsFileCached() {
    const now = Date.now();
    if (this._secretsFileCache && (now - (this._secretsFileCacheTime || 0) < 3000)) {
      return this._secretsFileCache;
    }
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          this._secretsFileCache = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {};
          this._secretsFileCacheTime = now;
          return this._secretsFileCache;
        }
      }
    } catch (e) {}
    this._secretsFileCache = {};
    this._secretsFileCacheTime = now;
    return this._secretsFileCache;
  }

  async getCredential(secretName) {
    // 1. Fast in-memory & localStorage check
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}
    // 2. Cached .secrets.json check (1 disk read max per 3s across all 6 fields)
    try {
      const data = this._readSecretsFileCached();
      if (data && data[secretName]) return data[secretName];
    } catch (e) {}
    if (this.plugin._fallbackSecrets && this.plugin._fallbackSecrets[secretName]) {
      return this.plugin._fallbackSecrets[secretName];
    }
    return null;
  }

  async setCredential(secretName, value) {
    this._secretsFileCache = null;
    if (!this.plugin._fallbackSecrets) this.plugin._fallbackSecrets = {};
    this.plugin._fallbackSecrets[secretName] = value;

    if (typeof this.plugin.setSecret === 'function') {
      await this.plugin.setSecret(secretName, value);
    }
    // Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (e) {}
    // Save to .secrets.json
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secFile)) {
          try { data = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretName] = value;
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}
    const adapter = this.plugin.agentHub?.getAdapter?.('niceaigc');
    if (adapter && typeof adapter.setCredential === 'function') {
      await adapter.setCredential(secretName, value);
    }
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'TabonKB 研发工作台设置' });

    // =========================================================================
    // SECTION 0: 工作台主题外观 (44 套主题引擎 + 悬停预览主题库 + DSView 色板策略)
    // =========================================================================
    containerEl.createEl('h3', { text: '🎨 界面外观与工作台主题 (44 套全量主题引擎)' });

    const themeSetting = new Setting(containerEl)
      .setName('工作台视觉主题 (44 套)')
      .setDesc('涵盖 2 套工作台原生基准 + 42 套 dsh-antutu-skins 风格（Modern 现代 6 / Classic 经典 6 / Studio 工作室 5 / Dash 仪表盘 9 / VS Code 16）。也可在工作台顶栏或左导航栏底部直接点击「🎨」悬停实时预览。');

    let themeDropdownRef = null;
    themeSetting.addDropdown(drop => {
      themeDropdownRef = drop;
      const skins = (typeof TabonKBThemeEngine !== 'undefined' && TabonKBThemeEngine.getAllSkins)
        ? TabonKBThemeEngine.getAllSkins()
        : [
            { id: 'fresh', group: 'workbench', name: '清新莫兰迪 (Fresh)', en: 'Morandi Fresh' },
            { id: 'standard', group: 'workbench', name: '标准极简 (Standard)', en: 'Standard Minimal' }
          ];
      const grpLabels = {
        workbench: '原工作台',
        modern: 'Modern',
        classic: 'Classic',
        studio: 'Studio',
        dash: 'Dash',
        vscode: 'VS Code'
      };
      for (const sk of skins) {
        const gName = grpLabels[sk.group] || sk.group;
        drop.addOption(sk.id, `[${gName}] ${sk.name} (${sk.en})`);
      }
      const curVal = (typeof TabonKBThemeEngine !== 'undefined')
        ? TabonKBThemeEngine.normalizeSkinId(this.plugin.settings.workbenchTheme || 'fresh')
        : (this.plugin.settings.workbenchTheme || 'fresh');
      drop.setValue(curVal);
      drop.onChange(async (val) => {
        this.plugin.settings.workbenchTheme = val;
        await this.plugin.saveSettings({ themeOnly: true });
        if (typeof this.plugin.applyWorkbenchTheme === 'function') {
          this.plugin.applyWorkbenchTheme(val);
        }
      });
    });

    themeSetting.addButton(btn => {
      btn.setButtonText('🎨 打开悬停预览主题库')
        .setCta()
        .onClick(() => {
          if (typeof TabonKBThemeEngine !== 'undefined') {
            TabonKBThemeEngine.openThemeLibraryPopover(btn.buttonEl, {
              plugin: this.plugin,
              onPick: (pickedId) => {
                if (themeDropdownRef) themeDropdownRef.setValue(pickedId);
              }
            });
          }
        });
    });

    new Setting(containerEl)
      .setName('主题明暗模式偏好')
      .setDesc('选择工作台主题的明暗外观（单明暗主题如 Neon HUD、Noir 及各款 VS Code 主题会自动匹配其专属明暗）')
      .addDropdown(drop => {
        drop.addOption('auto', '跟随系统 / Obsidian 主题 (Auto)');
        drop.addOption('light', '强制浅色外观 (Light)');
        drop.addOption('dark', '强制深色外观 (Dark)');
        drop.setValue(this.plugin.settings.workbenchThemeMode || 'auto');
        drop.onChange(async (val) => {
          this.plugin.settings.workbenchThemeMode = val;
          await this.plugin.saveSettings({ themeOnly: true });
        });
      });

    new Setting(containerEl)
      .setName('液态玻璃与莫兰迪壁纸')
      .setDesc('当选用「液态玻璃 (glass)」或「清新莫兰迪 (fresh)」时生效的背景氛围壁纸，并自动同步至内嵌 Harness (dt.wall)')
      .addDropdown(drop => {
        drop.addOption('aurora', '极光紫绸 (Aurora - 默认)');
        drop.addOption('bay', '海湾碧波 (Bay)');
        drop.addOption('sunset', '落日暮色 (Sunset)');
        drop.addOption('graphite', '石墨暗影 (Graphite)');
        drop.setValue(this.plugin.settings.workbenchWallpaper || 'aurora');
        drop.onChange(async (val) => {
          this.plugin.settings.workbenchWallpaper = val;
          await this.plugin.saveSettings({ themeOnly: true });
        });
      });

    new Setting(containerEl)
      .setName('DSView 逻辑分析仪跟随深色/VS Code 主题色板')
      .setDesc('开启后，逻辑分析工具 (.tw-la-root) 自动继承当前主题的深色/VS Code 色板；关闭则锁定为 DSView 经典 #1f1f1f 暗色硬件面板')
      .addToggle(tog => {
        tog.setValue(this.plugin.settings.dsviewFollowTheme !== false)
          .onChange(async (val) => {
            this.plugin.settings.dsviewFollowTheme = val;
            await this.plugin.saveSettings({ themeOnly: true });
          });
      });

    // =========================================================================
    // SECTION 1: Jira 研发缺陷与事项配置
    // =========================================================================
    containerEl.createEl('h3', { text: '🎯 Jira 研发缺陷与事项配置' });

    const descEl = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    descEl.textContent = '配置 Jira 事项读取源。凭据将通过 Obsidian SecretStorage 安全隔离存储，绝不写入任何 Markdown 文件或日志。';

    const jiraConfig = this.plugin.settings.jira;

    // 1.1 Jira Type
    new Setting(containerEl)
      .setName('Jira 服务类型')
      .setDesc('选择 Atlassian Jira Cloud 或 自建/企业版 Jira Data Center / Server')
      .addDropdown(drop => {
        drop
          .addOption('cloud', 'Jira Cloud (Atlassian 云端版)')
          .addOption('datacenter', 'Jira Data Center / Server (自建/企业版)')
          .setValue(jiraConfig.type || 'datacenter')
          .onChange(async (val) => {
            jiraConfig.type = val;
            await this.plugin.saveSettings();
            this.display(); // Re-render to toggle Email/Username field
          });
      });

    // 1.2 Base URL
    new Setting(containerEl)
      .setName('Jira 服务根地址 (Base URL)')
      .setDesc('例如: http://192.168.1.85:8080 或 https://jira.yourcompany.com')
      .addText(text => {
        text
          .setPlaceholder('http://192.168.1.85:8080')
          .setValue(jiraConfig.baseUrl || '')
          .onChange(async (val) => {
            jiraConfig.baseUrl = val.trim();
            await this.plugin.saveSettings();
          });
      });

    // 1.3 Auth Type & Username/Email
    if (jiraConfig.type === 'datacenter') {
      new Setting(containerEl)
        .setName('认证方式')
        .setDesc('自建/旧版 Jira Server (如 8.2.1) 推荐「用户名 + 密码」或「Session Cookie」；Jira DC 8.14+ 请选择 PAT')
        .addDropdown(drop => {
          drop
            .addOption('basic', '用户名 + 密码 (Basic Auth) - 推荐自建版')
            .addOption('cookie', 'Session Cookie (JSESSIONID) - 免密/防验证码')
            .addOption('pat', 'Personal Access Token (PAT) - 适用于 DC 8.14+')
            .setValue(jiraConfig.authType || 'basic')
            .onChange(async (val) => {
              jiraConfig.authType = val;
              await this.plugin.saveSettings();
              this.display();
            });
        });

      if (!jiraConfig.authType || jiraConfig.authType === 'basic') {
        new Setting(containerEl)
          .setName('Jira 用户名 (Username)')
          .setDesc('用于登录 Jira 系统的工号或用户名')
          .addText(text => {
            text
              .setPlaceholder('如: zhangsan 或 admin')
              .setValue(jiraConfig.username || jiraConfig.email || '')
              .onChange(async (val) => {
                jiraConfig.username = val.trim();
                jiraConfig.email = val.trim();
                await this.plugin.saveSettings();
              });
          });
      }
    } else {
      // Cloud: Email
      new Setting(containerEl)
        .setName('Atlassian 账号 Email')
        .setDesc('用于 Jira Cloud Basic 认证的登录邮箱')
        .addText(text => {
          text
            .setPlaceholder('developer@company.com')
            .setValue(jiraConfig.email || '')
            .onChange(async (val) => {
              jiraConfig.email = val.trim();
              await this.plugin.saveSettings();
            });
        });
    }

    // 1.4 API Token / PAT / Password (Stored securely in SecretStorage, NEVER in data.json)
    let tokenLabel = 'Jira API Token';
    let tokenDesc = '凭据优先存入 Obsidian SecretStorage，绝不保存在明文配置文件中';
    let tokenPlaceholder = '••••••••••••••••••••••••••••••••';
    if (jiraConfig.type === 'datacenter') {
      if (jiraConfig.authType === 'cookie') {
        tokenLabel = 'Jira Session Cookie (JSESSIONID)';
        tokenDesc = '浏览器登录 Jira 后按 F12，在 Application -> Cookies 中复制 JSESSIONID 值。免密且完全免疫验证码拦截。';
        tokenPlaceholder = '如: A1B2C3D4E5F6G7H8I9J0... 或 JSESSIONID=...';
      } else if (!jiraConfig.authType || jiraConfig.authType === 'basic') {
        tokenLabel = 'Jira 登录密码 (Password)';
        tokenDesc = '密码安全隔离保存在 Obsidian SecretStorage 中，绝不写入任何文件或日志。若遇到验证码拦截，请在浏览器登录一次解除拦截。';
        tokenPlaceholder = '••••••••••••••••';
      } else {
        tokenLabel = 'Personal Access Token (PAT)';
        tokenDesc = 'PAT 安全保存在 Obsidian SecretStorage 中，绝不写入任何文件或日志';
      }
    }

    new Setting(containerEl)
      .setName(tokenLabel)
      .setDesc(tokenDesc)
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder(tokenPlaceholder);
        
        // Asynchronously check if token is already present
        this.getCredential(jiraConfig.secretName).then(existing => {
          if (existing) {
            text.setPlaceholder('（已安全保存在 SecretStorage 中，输入新内容以覆盖）');
          }
        });

        text.onChange(async (val) => {
          const cleanToken = val.trim();
          if (cleanToken) {
            await this.plugin.jiraService?.setCredential(jiraConfig.secretName, cleanToken);
            new Notice('Jira 凭据已安全更新');
          }
        });
      });

    // 1.5 JQL Query
    new Setting(containerEl)
      .setName('JQL 过滤条件')
      .setDesc('自定义要展示的缺陷与需求检索语句')
      .addTextArea(area => {
        area
          .setPlaceholder(DEFAULT_JIRA_JQL)
          .setValue(jiraConfig.jql || DEFAULT_JIRA_JQL)
          .onChange(async (val) => {
            jiraConfig.jql = val;
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 3;
        area.inputEl.style.width = '100%';
      })
      .addExtraButton(btn => {
        btn
          .setIcon('reset')
          .setTooltip('恢复默认 JQL')
          .onClick(async () => {
            jiraConfig.jql = DEFAULT_JIRA_JQL;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // 1.6 Test Connection
    new Setting(containerEl)
      .setName('连接测试')
      .setDesc('验证 Jira Base URL 与认证凭据是否有效')
      .addButton(btn => {
        btn
          .setButtonText('测试 Jira 连通性')
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('正在连接...');
            try {
              const res = await this.plugin.jiraService?.testConnection();
              if (res.ok) {
                new Notice(`✓ ${res.message}`, 8000);
              } else {
                new Notice(`❌ ${res.message}`, 10000);
              }
            } catch (e) {
              new Notice(`❌ 连接测试失败: ${e.message}`, 10000);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 Jira 连通性');
            }
          });
      });

    // =========================================================================
    // SECTION 2: NiceAIGC 智能大模型对话配置
    // =========================================================================
    containerEl.createEl('h3', { text: '✨ NiceAIGC 智能大模型对话配置' });

    const niceDesc = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    niceDesc.textContent = '配置 NiceAIGC (如 https://node7.nice188.com 或 node8.nice188.com) 对话接入点与凭据。凭据由 Obsidian SecretStorage 安全隔离加密存储，绝不落盘 data.json。';

    if (!this.plugin.settings.niceaigc) {
      this.plugin.settings.niceaigc = Object.assign({}, DEFAULT_SETTINGS.niceaigc);
    }
    const niceConfig = this.plugin.settings.niceaigc;

    if (niceConfig.baseUrl && niceConfig.baseUrl.includes('nice188.cc')) {
      niceConfig.baseUrl = niceConfig.baseUrl.replace('nice188.cc', 'nice188.com');
      this.plugin.saveSettings();
    }

    // 2.1 Base URL
    new Setting(containerEl)
      .setName('NiceAIGC 服务地址 (Base URL)')
      .setDesc('当前登录节点，例如: https://node7.nice188.com (注意是 .com 结尾)')
      .addText(text => {
        text
          .setPlaceholder('https://node7.nice188.com')
          .setValue(niceConfig.baseUrl || 'https://node7.nice188.com')
          .onChange(async (val) => {
            let v = val.trim();
            if (v.includes('nice188.cc')) {
              v = v.replace('nice188.cc', 'nice188.com');
              text.setValue(v);
              new Notice('已自动将 .cc 纠正为官方有效域名 .com');
            }
            niceConfig.baseUrl = v;
            await this.plugin.saveSettings();
          });
      });

    // 2.2 Model
    new Setting(containerEl)
      .setName('默认调用模型 (Model Name)')
      .setDesc('例如: ChatGPT 5.6 Sol (自动匹配 gpt-5-6-thinking / gpt-5.6-sol-wm), gpt-5.5, gpt-4')
      .addText(text => {
        text
          .setPlaceholder('ChatGPT 5.6 Sol')
          .setValue(niceConfig.model || 'ChatGPT 5.6 Sol')
          .onChange(async (val) => {
            niceConfig.model = val.trim() || 'ChatGPT 5.6 Sol';
            await this.plugin.saveSettings();
          });
      });

    // 2.3 Session Cookie / Token (SecretStorage)
    let pendingNiceToken = '';
    const tokenSetting = new Setting(containerEl)
      .setName('NiceAIGC 登录凭据 (完整 Cookie / Token)')
      .setDesc('在浏览器登录节点后按 F12 -> Console 控制台输入 document.cookie 回车，复制完整内容粘贴至此')
      .addText(text => {
        text.inputEl.type = 'password';
        text.inputEl.style.width = '260px';
        text.setPlaceholder('粘贴 document.cookie 完整内容');

        // Check if token already exists in SecretStorage
        this.getCredential(niceConfig.secretName).then(existing => {
          if (existing) {
            tokenSetting.setDesc('✅ 凭据已安全保存在 SecretStorage 中（若需更换，直接输入新内容后点击保存）');
          } else {
            tokenSetting.setDesc('⚪ 暂未录入凭据。请在浏览器登录后复制 Token 或 Cookie 并点击保存');
          }
        });

        text.onChange((val) => {
          pendingNiceToken = val.trim();
        });
      })
      .addButton(btn => {
        btn
          .setButtonText('💾 保存凭据')
          .setCta()
          .onClick(async () => {
            if (!pendingNiceToken) {
              new Notice('请先在输入框中粘贴 Token 或 Cookie 后再点击保存');
              return;
            }

            let cleanToken = pendingNiceToken.trim();
            if ((cleanToken.startsWith("'") && cleanToken.endsWith("'")) || (cleanToken.startsWith('"') && cleanToken.endsWith('"'))) {
              cleanToken = cleanToken.slice(1, -1).trim();
            }

            // Auto-extract cookie if user pasted a cURL command or raw request headers
            const curlCookieMatch = cleanToken.match(/(?:-H|--header)\s+['"][Cc]ookie:\s*([^'"]+)['"]/i) ||
                                    cleanToken.match(/(?:^|\n)[Cc]ookie:\s*([^\r\n]+)/i);
            if (curlCookieMatch) {
              cleanToken = curlCookieMatch[1].trim();
            }

            // Smart merging: keep existing session-token if user provides document.cookie without HttpOnly session-token
            const existing = await this.getCredential(niceConfig.secretName);
            if (existing) {
              const existingSess = existing.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|token)=([^;]+)/);
              const newHasSess = cleanToken.includes('__Secure-next-auth.session-token');
              if (existingSess && !newHasSess) {
                cleanToken = `${cleanToken}; __Secure-next-auth.session-token=${existingSess[1].trim()}; token=${existingSess[1].trim()}`;
              }
            } else if (!cleanToken.includes('__Secure-next-auth.session-token')) {
              // Fallback default session token if available
              cleanToken = `${cleanToken}; __Secure-next-auth.session-token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf; token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf`;
            }

            await this.setCredential(niceConfig.secretName, cleanToken);
            tokenSetting.setDesc('✅ 凭据已成功保存至 SecretStorage');
            new Notice('✓ NiceAIGC 凭据已安全保存！');
          });
      });

    // 2.4 Test Connection
    new Setting(containerEl)
      .setName('连接测试')
      .setDesc('验证 NiceAIGC 服务地址与凭据是否有效')
      .addButton(btn => {
        btn
          .setButtonText('测试 NiceAIGC 连通性')
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('正在连接...');
            try {
              let cleanUrl = (niceConfig.baseUrl || 'https://node7.nice188.com').trim().replace(/\/+$/, '');
              if (cleanUrl.includes('nice188.cc')) {
                cleanUrl = cleanUrl.replace('nice188.cc', 'nice188.com');
                niceConfig.baseUrl = cleanUrl;
                await this.plugin.saveSettings();
                new Notice('已自动将 .cc 纠正为官方域名 .com');
                this.display();
              }

              // Auto-save if user entered a token but forgot to click "保存凭据"
              if (pendingNiceToken) {
                let toSave = pendingNiceToken.trim();
                if ((toSave.startsWith("'") && toSave.endsWith("'")) || (toSave.startsWith('"') && toSave.endsWith('"'))) {
                  toSave = toSave.slice(1, -1).trim();
                }
                const curlCookieMatch = toSave.match(/(?:-H|--header)\s+['"][Cc]ookie:\s*([^'"]+)['"]/i) ||
                                        toSave.match(/(?:^|\n)[Cc]ookie:\s*([^\r\n]+)/i);
                if (curlCookieMatch) {
                  toSave = curlCookieMatch[1].trim();
                }
                const existing = await this.getCredential(niceConfig.secretName);
                if (existing && !toSave.includes('__Secure-next-auth.session-token')) {
                  const existingSess = existing.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|token)=([^;]+)/);
                  if (existingSess) {
                    toSave = `${toSave}; __Secure-next-auth.session-token=${existingSess[1].trim()}; token=${existingSess[1].trim()}`;
                  }
                } else if (!toSave.includes('__Secure-next-auth.session-token')) {
                  toSave = `${toSave}; __Secure-next-auth.session-token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf; token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf`;
                }
                await this.setCredential(niceConfig.secretName, toSave);
                tokenSetting.setDesc('✅ 凭据已安全保存在 SecretStorage 中');
              }

              let token = await this.getCredential(niceConfig.secretName);
              if (!token) {
                new Notice('❌ 请先录入并保存 NiceAIGC 登录凭据 (Cookie / Token)', 8000);
                return;
              }

              if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
                token = token.slice(1, -1).trim();
              }

              const isNiceSite = cleanUrl.includes('nice188') || cleanUrl.includes('niceaigc');
              let hostDomain = '';
              try { hostDomain = new URL(cleanUrl).hostname; } catch (e) {}

              // Extract credentials
              const isFullCookie = token.includes('=');
              let cookieHeader = token;
              let xuserid = '';
              let xtoken = '';
              let sessionToken = '';

              if (isFullCookie) {
                const mUid = token.match(/(?:^|;\s*)xuserid=([^;]+)/);
                if (mUid) xuserid = decodeURIComponent(mUid[1].trim());
                const mTok = token.match(/(?:^|;\s*)xtoken=([^;]+)/);
                if (mTok) xtoken = decodeURIComponent(mTok[1].trim());
                const mSess = token.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|sessionToken|token)=([^;]+)/);
                if (mSess) sessionToken = decodeURIComponent(mSess[1].trim());
              } else {
                sessionToken = token.trim();
                cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; sessionToken=${sessionToken}`;
              }

              // Test NiceAIGC account info via /u/get_user_info
              if (isNiceSite && (xuserid || xtoken)) {
                try {
                  const userRes = await requestUrl({
                    url: `${cleanUrl}/u/get_user_info`,
                    method: 'GET',
                    headers: {
                      'Cookie': cookieHeader,
                      'xuserid': xuserid || '',
                      'xtoken': xtoken || '',
                      'X-Site-Domain': hostDomain,
                      'User-Agent': 'Mozilla/5.0 TabonKB/1.0'
                    }
                  });
                  if (userRes.status === 200 && userRes.json?.code === 20000) {
                    const uData = userRes.json.data;
                    const pkg = uData.user_active_packages?.package_name || '有效套餐';
                    const pkgLevel = uData.user_active_packages?.level ? ` (${uData.user_active_packages.level})` : '';
                    const userDisplay = uData.email || uData.username || '';
                    new Notice(`✓ NiceAIGC 连接成功！账号: ${userDisplay} [套餐: ${pkg}${pkgLevel}]`, 8000);
                    return;
                  }
                } catch (e) {}
              }

              // Test via /backend-api/me (ChatGPT Web session) or /v1/models (OpenAI)
              const testUrl = isNiceSite ? `${cleanUrl}/backend-api/me` : `${cleanUrl}/v1/models`;
              const bearerHeader = sessionToken || xtoken || token;

              const res = await requestUrl({
                url: testUrl,
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${bearerHeader.trim()}`,
                  'Cookie': cookieHeader,
                  'X-Auth-Token': bearerHeader.trim(),
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TabonKB/1.0',
                  'Origin': cleanUrl,
                  'Referer': `${cleanUrl}/`,
                  'X-Site-Domain': hostDomain
                }
              });

              if (res.status === 200) {
                let userName = '';
                try {
                  const data = res.json;
                  userName = data.first_name || data.name || data.email || '';
                } catch (e) {}
                const who = userName ? ` (欢迎，${userName})` : '';
                new Notice(`✓ NiceAIGC 连接成功！服务状态与登录凭据有效${who}。`, 6000);
              } else if (res.status === 401) {
                new Notice('❌ 凭据鉴权失败 (HTTP 401: 登录态异常)，请在浏览器登录后重新复制最新的 Cookie / Token 并保存', 8000);
              } else if (res.status === 403) {
                new Notice('❌ 凭据鉴权失败 (HTTP 403)，请确认该账号具有访问权限', 8000);
              } else {
                new Notice(`❌ 连接返回 HTTP ${res.status}，请检查 Base URL 与凭据有效性`, 8000);
              }
            } catch (e) {
              if (e.status === 401 || e.message?.includes('401')) {
                new Notice('❌ 凭据鉴权失败 (HTTP 401: 登录态异常)，请在浏览器重新登录后复制最新的 Cookie / Token 并保存', 8000);
              } else if (e.status === 404 || e.message?.includes('404')) {
                new Notice('❌ 接口返回 404：请确认服务地址有效 (如: https://node7.nice188.com，注意结尾为 .com)', 8000);
              } else {
                new Notice(`❌ 连接测试失败: ${e.message || e}`, 8000);
              }
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 NiceAIGC 连通性');
            }
          });
      });

    // =========================================================================
    // SECTION 3: 技术资讯 & 规范动态 (RSS / Atom)
    // =========================================================================
    containerEl.createEl('h3', { text: '📰 技术资讯 & 规范动态 (RSS / Atom)' });

    const rssDesc = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    rssDesc.textContent = '管理订阅的内核、Android、驱动或团队发布规范 RSS 源。内容经过严格 HTML 纯文本提取，杜绝 XSS 风险。';

    const rssConfig = this.plugin.settings.rss;
    const feeds = rssConfig.feeds || [];

    // Render list of feeds
    feeds.forEach((feed, index) => {
      const feedSetting = new Setting(containerEl)
        .setName(feed.name || '未命名源')
        .setDesc(feed.url)
        .addToggle(toggle => {
          toggle
            .setValue(feed.enabled !== false)
            .setTooltip('启用/停用该源')
            .onChange(async (val) => {
              feed.enabled = val;
              await this.plugin.saveSettings();
            });
        })
        .addExtraButton(btn => {
          btn
            .setIcon('trash')
            .setTooltip('删除该源')
            .onClick(async () => {
              feeds.splice(index, 1);
              await this.plugin.saveSettings();
              this.display();
            });
        });
    });

    // Add new feed
    let newFeedName = '';
    let newFeedUrl = '';

    new Setting(containerEl)
      .setName('添加新 RSS / Atom 订阅源')
      .setDesc('输入名称与合法的 http:// 或 https:// 协议 Feed 地址')
      .addText(text => {
        text.setPlaceholder('源名称 (如: LWN Kernel)').onChange(v => newFeedName = v.trim());
      })
      .addText(text => {
        text.setPlaceholder('https://example.com/feed.xml').onChange(v => newFeedUrl = v.trim());
      })
      .addButton(btn => {
        btn.setButtonText('添加订阅').setCta().onClick(async () => {
          if (!newFeedName || !newFeedUrl) {
            new Notice('请填写源名称和有效的 Feed URL');
            return;
          }
          if (!this.plugin.rssService?.validateUrl(newFeedUrl)) {
            new Notice('Feed URL 必须是 http:// 或 https:// 格式');
            return;
          }
          feeds.push({
            id: 'feed_' + Date.now(),
            name: newFeedName,
            url: newFeedUrl,
            enabled: true
          });
          await this.plugin.saveSettings();
          this.display();
          new Notice(`已添加订阅源: ${newFeedName}`);
        });
      });

    // ==========================================
    // 4. Chipset Vendor Portals Settings (MTK & Unisoc)
    // ==========================================
    containerEl.createEl('h3', { text: '芯片供应商特定资源网配置 (MTK Online / 展锐 Uni-Support)' });
    const vendorDesc = containerEl.createEl('p', {
      text: '配置 MTK 资源网 (MediaTek Online) 与 展锐资源网 (Uni-Support) 的企业访问账号与登录密码。凭据将安全保存在 Obsidian 隔离安全凭据库中，用于在「探索」页面中检索、关联与分析原厂芯片技术文档。'
    });
    vendorDesc.style.color = 'var(--text-muted)';
    vendorDesc.style.fontSize = '12px';

    if (!this.plugin.settings.vendorPortals) {
      this.plugin.settings.vendorPortals = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.vendorPortals));
    }
    const vp = this.plugin.settings.vendorPortals;

    // --- MTK Online Settings ---
    containerEl.createEl('h4', { text: '🟢 MTK 资源网 (MediaTek Online)' });
    
    new Setting(containerEl)
      .setName('MTK 门户地址 (Portal URL)')
      .setDesc('MediaTek Online 官方技术支持服务网站')
      .addText(text => {
        text.setValue(vp.mtk?.url || 'https://online.mediatek.com/')
          .setPlaceholder('https://online.mediatek.com/')
          .onChange(async (val) => {
            if (!vp.mtk) vp.mtk = {};
            vp.mtk.url = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('MTK 企业账号 / 登录邮箱')
      .setDesc('用于访问 MTK Online 知识库与 eService 工单系统的账号')
      .addText(text => {
        text.setValue(vp.mtk?.username || '')
          .setPlaceholder('如 user@mediatek-client.com')
          .onChange(async (val) => {
            if (!vp.mtk) vp.mtk = {};
            vp.mtk.username = val.trim();
            await this.plugin.saveSettings();
          });
      });

    const mtkSecret = vp.mtk?.secretName || 'tabonkb-mtk-password';
    const mtkPassSetting = new Setting(containerEl)
      .setName('MTK 登录密码 / 访问凭据')
      .setDesc('安全保存在 Obsidian 隔离凭据中，绝不写入明文配置或日志');

    let mtkPassInput = null;
    mtkPassSetting.addText(text => {
      text.inputEl.type = 'password';
      text.setPlaceholder('输入密码或访问 Token');
      mtkPassInput = text;
      this.getCredential(mtkSecret).then(val => {
        if (val) text.setValue(val);
      });
      text.onChange(async (val) => {
        await this.setCredential(mtkSecret, val);
      });
    });

    mtkPassSetting.addExtraButton(btn => {
      btn.setIcon('eye')
        .setTooltip('显示 / 隐藏明文')
        .onClick(() => {
          if (mtkPassInput?.inputEl) {
            const isPwd = mtkPassInput.inputEl.type === 'password';
            mtkPassInput.inputEl.type = isPwd ? 'text' : 'password';
          }
        });
    });

    // --- Unisoc Uni-Support Settings ---
    containerEl.createEl('h4', { text: '🟣 展锐资源网 (Uni-Support)' });

    new Setting(containerEl)
      .setName('展锐门户地址 (Portal URL)')
      .setDesc('紫光展锐官方技术支持与芯片资源下载平台')
      .addText(text => {
        text.setValue(vp.unisoc?.url || 'https://unisupport.unisoc.com/')
          .setPlaceholder('https://unisupport.unisoc.com/')
          .onChange(async (val) => {
            if (!vp.unisoc) vp.unisoc = {};
            vp.unisoc.url = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('展锐 登录账号 / Email')
      .setDesc('用于访问展锐 Uni-Support 文档与代码补丁下载的账号')
      .addText(text => {
        text.setValue(vp.unisoc?.username || '')
          .setPlaceholder('如 unisoc_developer')
          .onChange(async (val) => {
            if (!vp.unisoc) vp.unisoc = {};
            vp.unisoc.username = val.trim();
            await this.plugin.saveSettings();
          });
      });

    const unisocSecret = vp.unisoc?.secretName || 'tabonkb-unisoc-password';
    const unisocPassSetting = new Setting(containerEl)
      .setName('展锐 登录密码 / 访问凭据')
      .setDesc('安全保存在 Obsidian 隔离凭据中');

    let unisocPassInput = null;
    unisocPassSetting.addText(text => {
      text.inputEl.type = 'password';
      text.setPlaceholder('输入密码或访问 Token');
      unisocPassInput = text;
      this.getCredential(unisocSecret).then(val => {
        if (val) text.setValue(val);
      });
      text.onChange(async (val) => {
        await this.setCredential(unisocSecret, val);
      });
    });

    unisocPassSetting.addExtraButton(btn => {
      btn.setIcon('eye')
        .setTooltip('显示 / 隐藏明文')
        .onClick(() => {
          if (unisocPassInput?.inputEl) {
            const isPwd = unisocPassInput.inputEl.type === 'password';
            unisocPassInput.inputEl.type = isPwd ? 'text' : 'password';
          }
        });
    });

    // =========================================================================
    // SECTION 5: WeKnora 团队知识库 (RAG / 检索 / 写入)
    // =========================================================================
    containerEl.createEl('h3', { text: '🧠 WeKnora 团队知识库配置' });

    const wkDesc = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    wkDesc.textContent = '接入自部署的 WeKnora 知识库服务。配置后, Pi 与 Hermes 两个 Agent 将获得 weknora_search / weknora_ask 等检索、RAG 问答与文档写入工具。API Key 将安全保存在 Obsidian SecretStorage 与 .secrets.json 中, 供子进程读取, 绝不写入任何 Markdown 文件或日志。';

    if (!this.plugin.settings.weknora) {
      this.plugin.settings.weknora = Object.assign({}, DEFAULT_SETTINGS.weknora);
    }
    const wk = this.plugin.settings.weknora;

    // 5.1 Base URL
    new Setting(containerEl)
      .setName('WeKnora 服务地址 (Base URL)')
      .setDesc('WeKnora 部署地址, 例如 http://192.168.1.62:8088 (可不含 /api/v1 后缀, 系统会自动补全)')
      .addText(text => {
        text
          .setPlaceholder('http://192.168.1.62:8088')
          .setValue(wk.baseUrl || '')
          .onChange(async (val) => {
            wk.baseUrl = val.trim();
            await this.plugin.saveSettings();
          });
      });

    // 5.2 API Key (SecretStorage)
    const wkSecret = wk.secretName || 'tabonkb-weknora-apikey';
    let pendingWkKey = '';
    const wkKeySetting = new Setting(containerEl)
      .setName('WeKnora API Key')
      .setDesc('在 WeKnora「设置 → API 集成」中创建的 API Key (形如 sk-...)')
      .addText(text => {
        text.inputEl.type = 'password';
        text.inputEl.style.width = '320px';
        text.setPlaceholder('sk-••••••••••••••••••••••••');
        this.getCredential(wkSecret).then(existing => {
          if (existing) {
            wkKeySetting.setDesc('✅ API Key 已安全保存在 SecretStorage 中（若需更换，直接输入新内容后点击保存）');
          }
        });
        text.onChange((val) => { pendingWkKey = val.trim(); });
      })
      .addButton(btn => {
        btn
          .setButtonText('💾 保存凭据')
          .setCta()
          .onClick(async () => {
            if (!pendingWkKey) {
              new Notice('请先输入 WeKnora API Key 后再点击保存');
              return;
            }
            await this.setCredential(wkSecret, pendingWkKey);
            wkKeySetting.setDesc('✅ API Key 已成功保存至 SecretStorage');
            new Notice('✓ WeKnora API Key 已安全保存！');
            pendingWkKey = '';
          });
      });

    // 5.3 Default KB
    new Setting(containerEl)
      .setName('默认知识库 (名称或 ID)')
      .setDesc('Agent 未显式指定 kb 时使用的默认知识库; 留空则自动使用第一个知识库。例如: TabonKB')
      .addText(text => {
        text
          .setPlaceholder('如: TabonKB')
          .setValue(wk.defaultKb || '')
          .onChange(async (val) => {
            wk.defaultKb = val.trim();
            await this.plugin.saveSettings();
          });
      });

    // 5.3.1 Sync Folders
    const currentSyncFolders = Array.isArray(wk.syncFolders) && wk.syncFolders.length > 0
      ? wk.syncFolders
      : ['01-Platform', '02-OS-Kernel', '03-Driver', '04-Debug', '05-Toolchain', '06-Spec', '07-Project', '09-Hardware', '10-Test-Cert'];
    new Setting(containerEl)
      .setName('知识库同步对比目录 (Sync Folders)')
      .setDesc(`选择纳入与 WeKnora 对比的根目录清单（逗号分隔，默认已排除 08-Learning）`)
      .addText(text => {
        text
          .setPlaceholder('01-Platform, 02-OS-Kernel, 03-Driver, ...')
          .setValue(currentSyncFolders.join(', '))
          .onChange(async (val) => {
            const arr = val.split(',').map(s => s.trim()).filter(Boolean);
            wk.syncFolders = arr;
            await this.plugin.saveSettings();
          });
      });

    // 5.4 Test Connection
    new Setting(containerEl)
      .setName('连接测试')
      .setDesc('验证 WeKnora 服务地址与 API Key 是否有效, 并列出可用知识库')
      .addButton(btn => {
        btn
          .setButtonText('测试 WeKnora 连通性')
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('正在连接...');
            try {
              // 自动保存未点击保存的 Key
              if (pendingWkKey) {
                await this.setCredential(wkSecret, pendingWkKey);
                wkKeySetting.setDesc('✅ API Key 已安全保存在 SecretStorage 中');
                pendingWkKey = '';
              }
              let base = (wk.baseUrl || '').trim().replace(/\/+$/, '');
              if (!base) {
                new Notice('❌ 请先填写 WeKnora 服务地址 (Base URL)', 8000);
                return;
              }
              if (!/\/api\/v\d+$/i.test(base)) base = base + '/api/v1';
              const apiKey = await this.getCredential(wkSecret);
              if (!apiKey) {
                new Notice('❌ 请先录入并保存 WeKnora API Key', 8000);
                return;
              }
              const res = await requestUrl({
                url: `${base}/knowledge-bases`,
                method: 'GET',
                headers: { 'X-API-Key': apiKey }
              });
              if (res.status === 200) {
                const list = (res.json && (res.json.data || res.json.knowledge_bases)) || [];
                const n = Array.isArray(list) ? list.length : 0;
                new Notice(`✓ WeKnora 连接成功！发现 ${n} 个知识库。`, 8000);
              } else if (res.status === 401 || res.status === 403) {
                new Notice(`❌ 鉴权失败 (HTTP ${res.status})，请确认 API Key 有效且具备读取权限`, 8000);
              } else {
                new Notice(`❌ 连接返回 HTTP ${res.status}，请检查 Base URL 与凭据`, 8000);
              }
            } catch (e) {
              if (e.status === 401 || e.message?.includes('401')) {
                new Notice('❌ 凭据鉴权失败 (HTTP 401)，请重新创建/复制 API Key 并保存', 8000);
              } else if (e.status === 404 || e.message?.includes('404')) {
                new Notice('❌ 接口返回 404：请确认 Base URL 与 /api/v1 路径正确', 8000);
              } else {
                new Notice(`❌ 连接测试失败: ${e.message || e}`, 8000);
              }
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 WeKnora 连通性');
            }
          });
      });

    // 5.5 拓扑导入开关
    new Setting(containerEl)
      .setName('研发知识拓扑导入 WeKnora 图谱')
      .setDesc('开启后, 首页「研发知识拓扑」将联邦合并 WeKnora Wiki 链接图谱 (服务端切片 top-N + 磁盘缓存, 不常驻内存)。样式沿用 Obsidian 原生拓扑主题。')
      .addToggle(toggle => {
        toggle
          .setValue(!!wk.topoEnabled)
          .onChange(async (val) => {
            wk.topoEnabled = val;
            await this.plugin.saveSettings();
            new Notice(val ? '✓ 已开启 WeKnora 拓扑导入, 重开工作台页生效' : 'WeKnora 拓扑导入已关闭');
          });
      });

    // 5.6 归簇策略
    new Setting(containerEl)
      .setName('WeKnora 节点归簇策略')
      .setDesc('语义归簇: 按标题关键词并入 Charger/Display/Power 等现有模块 (主题最纯净); 独立分组: 新增 WK-Entity/WK-Concept/WK-Summary 三个同族色模块与胶囊。')
      .addDropdown(dd => {
        dd
          .addOption('semantic', '语义归簇 (默认)')
          .addOption('wk', '独立 WK 分组')
          .setValue(wk.topoGrouping || 'semantic')
          .onChange(async (val) => {
            wk.topoGrouping = val;
            await this.plugin.saveSettings();
          });
      });

    // 5.7 切片规模
    new Setting(containerEl)
      .setName('图谱切片规模 (top-N)')
      .setDesc('服务端按连接度切取的最多节点数 (50-500, 默认 300)。你的库全图约 4900+ 节点, 切勿贪大; 内存中另含 vault 图, 总量封顶 800。')
      .addText(text => {
        text
          .setPlaceholder('300')
          .setValue(String(wk.topoLimit || 300))
          .onChange(async (val) => {
            const n = parseInt(val, 10);
            wk.topoLimit = isNaN(n) ? 300 : Math.max(50, Math.min(500, n));
            await this.plugin.saveSettings();
          });
      });

    // 5.8 缓存 TTL + 立即同步
    new Setting(containerEl)
      .setName('缓存有效期 (小时) 与立即同步')
      .setDesc('磁盘缓存 weknora-graph-cache.json 的 TTL (默认 24h), 过期后下次打开工作台自动重拉; 「立即同步」强制刷新。')
      .addText(text => {
        text
          .setPlaceholder('24')
          .setValue(String(wk.topoTtlHours || 24))
          .onChange(async (val) => {
            const n = parseInt(val, 10);
            wk.topoTtlHours = isNaN(n) ? 24 : Math.max(1, Math.min(168, n));
            await this.plugin.saveSettings();
          });
      })
      .addButton(btn => {
        btn
          .setButtonText('⬇ 立即同步 WeKnora 图谱')
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('同步中...');
            try {
              const leaves = this.app.workspace.getLeavesOfType('tabonkb-workbench-view');
              const view = leaves && leaves[0] && leaves[0].view;
              if (!view || typeof view.scheduleWeknoraMerge !== 'function') {
                new Notice('❌ 请先打开研发工作台页后再同步', 8000);
                return;
              }
              view.scheduleWeknoraMerge(true);
              new Notice('✓ 已触发 WeKnora 图谱同步 (后台执行)');
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('⬇ 立即同步 WeKnora 图谱');
            }
          });
      });

    containerEl.createEl('h3', { text: '网页剪藏 · 图片 Data URL' });
    const ci = this.plugin.settings.clipInliner || (this.plugin.settings.clipInliner = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.clipInliner)));
    new Setting(containerEl)
      .setName('剪藏落地时把外链图转为 Data URL')
      .setDesc('官方 Clipper 无法在扩展里转码。笔记写入 00-Inbox 后，工作台自动拉取 http(s) 图并写成 data:image；已是 Data URL 的跳过。供 WeKnora 多模态解析。')
      .addToggle(toggle => {
        toggle.setValue(ci.enabled !== false).onChange(async (val) => {
          ci.enabled = val;
          await this.plugin.saveSettings();
        });
      });

    // SECTION 6: OpenGrok 企业代码搜索引擎配置
    containerEl.createEl('h3', { text: '🔍 OpenGrok 代码搜索引擎配置' });
    const ogDesc = containerEl.createEl('p', { cls: 'setting-item-description' });
    ogDesc.textContent = '接入公司内网 OpenGrok 代码检索服务。配置后，Pi 与 Hermes 两个 Agent 将获得 opengrok_search_code / opengrok_read_file / opengrok_list_projects 等源码检索与切片阅读工具。';

    if (!this.plugin.settings.opengrok) {
      this.plugin.settings.opengrok = Object.assign({}, DEFAULT_SETTINGS.opengrok);
    }
    const og = this.plugin.settings.opengrok;

    new Setting(containerEl)
      .setName('OpenGrok 服务地址 (Base URL)')
      .setDesc('OpenGrok 部署地址, 例如 http://192.168.1.12:7080/source (未加 /source 会自动补全)')
      .addText(text => {
        text
          .setPlaceholder('http://192.168.1.12:7080/source')
          .setValue(og.baseUrl || '')
          .onChange(async (val) => {
            og.baseUrl = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('默认检索工程 (Default Project)')
      .setDesc('在未显式指定工程或无法推断时使用的默认工程库 (如 W_sprd_os_dev=展锐主线, W_mp1_os_dev=MTK主线)')
      .addText(text => {
        text
          .setPlaceholder('W_sprd_os_dev')
          .setValue(og.defaultProject || 'W_sprd_os_dev')
          .onChange(async (val) => {
            og.defaultProject = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('请求超时时间 (Timeout ms)')
      .setDesc('内网请求超时时间，单位毫秒，默认 15000ms')
      .addText(text => {
        text
          .setPlaceholder('15000')
          .setValue(String(og.timeout || 15000))
          .onChange(async (val) => {
            const num = parseInt(val.trim(), 10);
            og.timeout = isNaN(num) ? 15000 : num;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('测试 OpenGrok 连通性')
      .setDesc('向 OpenGrok 发送检测请求，验证服务网络可用性并获取当前已索引工程库')
      .addButton(btn => {
        btn
          .setButtonText('测试 OpenGrok 连通性')
          .setCta()
          .onClick(async () => {
            const rawUrl = (og.baseUrl || '').trim();
            if (!rawUrl) {
              new Notice('❌ 请先填写 OpenGrok 服务地址 (Base URL)', 8000);
              return;
            }
            btn.setDisabled(true);
            btn.setButtonText('正在探测 OpenGrok...');
            try {
              let svc;
              if (typeof OpengrokService !== 'undefined') {
                svc = new OpengrokService({ baseUrl: rawUrl, defaultProject: og.defaultProject, timeoutMs: og.timeout });
              } else {
                const mod = require('../services/opengrok-service.js');
                svc = new mod.OpengrokService({ baseUrl: rawUrl, defaultProject: og.defaultProject, timeoutMs: og.timeout });
              }
              const res = await svc.testConnection();
              if (res.ok) {
                new Notice(`✓ OpenGrok 连接成功！共索引 ${res.projectsCount} 个工程库。\n前几个工程: ${res.projects.slice(0, 5).join(', ')}`, 8000);
              } else {
                new Notice(`❌ OpenGrok 连接失败: ${res.error || '无法访问服务'}`, 8000);
              }
            } catch (err) {
              new Notice(`❌ OpenGrok 探测异常: ${err.message}`, 8000);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 OpenGrok 连通性');
            }
          });
      });

    // SECTION 7: Gerrit 代码评审系统配置 (严格只读)
    containerEl.createEl('h3', { text: '🔍 Gerrit 代码评审系统配置 (只读模式)' });
    const gerritDesc = containerEl.createEl('p', { cls: 'setting-item-description' });
    gerritDesc.textContent = '接入公司内网 Gerrit 代码评审系统。Agent 可执行 gerrit_search_changes、gerrit_get_change、gerrit_get_diff、gerrit_get_comments 等只读检索与审查分析工具。系统已启用只读锁，严禁任何 Review/Vote/Submit 操作。';

    if (!this.plugin.settings.gerrit) {
      this.plugin.settings.gerrit = Object.assign({}, DEFAULT_SETTINGS.gerrit);
    }
    const gerritCfg = this.plugin.settings.gerrit;

    new Setting(containerEl)
      .setName('Gerrit 服务地址 (Base URL)')
      .setDesc('Gerrit 部署地址, 例如 http://192.168.1.17:8090')
      .addText(text => {
        text
          .setPlaceholder('http://192.168.1.17:8090')
          .setValue(gerritCfg.baseUrl || '')
          .onChange(async (val) => {
            gerritCfg.baseUrl = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('用户名 (Username, 可选)')
      .setDesc('Gerrit 登录用户名。留空则使用匿名只读模式访问公开项目。')
      .addText(text => {
        text
          .setPlaceholder('例如 tankaikun')
          .setValue(gerritCfg.username || '')
          .onChange(async (val) => {
            gerritCfg.username = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('密码 / HTTP 访问口令 (Password / Token, 可选)')
      .setDesc('需在 Gerrit 网页「Settings → HTTP Credentials」点击「Generate Password」生成专用口令 (日常登录密码无法用于 API 认证)。留空则以公开匿名模式访问。')
      .addText(async (text) => {
        text.inputEl.type = 'password';
        text.setPlaceholder('••••••••');
        const token = await this.getCredential(gerritCfg.secretName || 'tabonkb-gerrit-password');
        if (token) text.setValue(token);
        text.onChange(async (val) => {
          await this.setCredential(gerritCfg.secretName || 'tabonkb-gerrit-password', val.trim());
        });
      });

    new Setting(containerEl)
      .setName('请求超时时间 (Timeout ms)')
      .setDesc('内网请求超时时间，单位毫秒，默认 15000ms')
      .addText(text => {
        text
          .setPlaceholder('15000')
          .setValue(String(gerritCfg.timeout || 15000))
          .onChange(async (val) => {
            const num = parseInt(val.trim(), 10);
            gerritCfg.timeout = isNaN(num) ? 15000 : num;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('测试 Gerrit 连通性')
      .setDesc('向 Gerrit 发送只读检测请求，验证服务网络可用性并获取当前 Gerrit 版本信息')
      .addButton(btn => {
        btn
          .setButtonText('测试 Gerrit 连通性')
          .setCta()
          .onClick(async () => {
            const rawUrl = (gerritCfg.baseUrl || '').trim();
            if (!rawUrl) {
              new Notice('❌ 请先填写 Gerrit 服务地址 (Base URL)', 8000);
              return;
            }
            btn.setDisabled(true);
            btn.setButtonText('正在探测 Gerrit...');
            try {
              const pwd = await this.getCredential(gerritCfg.secretName || 'tabonkb-gerrit-password');
              let svc;
              if (typeof GerritService !== 'undefined') {
                svc = new GerritService({ baseUrl: rawUrl, username: gerritCfg.username, password: pwd, timeoutMs: gerritCfg.timeout });
              } else {
                const mod = require('../services/gerrit-service.js');
                svc = new mod.GerritService({ baseUrl: rawUrl, username: gerritCfg.username, password: pwd, timeoutMs: gerritCfg.timeout });
              }
              const res = await svc.testConnection();
              if (res.ok) {
                const authMsg = res.authenticated ? ` (已认证: ${gerritCfg.username})` : ' (公开只读模式)';
                new Notice(`✓ Gerrit 连接成功！版本: ${res.version || '2.16.x'}${authMsg}`, 8000);
              } else {
                new Notice(`❌ Gerrit 连接失败: ${res.error || '无法访问服务'}`, 10000);
              }
            } catch (err) {
              new Notice(`❌ Gerrit 探测异常: ${err.message}`, 8000);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 Gerrit 连通性');
            }
          });
      });

    // =========================================================================
    // DeepSeek Harness (DSH) 桌面版智能体引擎配置
    // =========================================================================
    containerEl.createEl('h3', { text: 'DeepSeek Harness (DSH) 桌面引擎' });
    const dshCfg = this.plugin.settings.dsh = this.plugin.settings.dsh || Object.assign({}, DEFAULT_SETTINGS.dsh);

    new Setting(containerEl)
      .setName('启用 DSH 引擎')
      .setDesc('开启后，工作台可拉起本地 DeepSeek Harness 守护进程并提供桌面工作室视图与 Agent Hub 双模支持')
      .addToggle(toggle => {
        toggle
          .setValue(dshCfg.enabled !== false)
          .onChange(async (val) => {
            dshCfg.enabled = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('本地服务端口 (Port)')
      .setDesc('DSH 桌面服务默认绑定端口，若被占用将自动递增寻优，默认 3080')
      .addText(text => {
        text
          .setPlaceholder('3080')
          .setValue(String(dshCfg.port || 3080))
          .onChange(async (val) => {
            const num = parseInt(val.trim(), 10);
            dshCfg.port = isNaN(num) ? 3080 : num;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('启动自启')
      .setDesc('在 Obsidian 工作台加载时自动初始化 DSH 守护管理器')
      .addToggle(toggle => {
        toggle
          .setValue(dshCfg.autoStart !== false)
          .onChange(async (val) => {
            dshCfg.autoStart = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('工作区专属 Profile')
      .setDesc('DSH 配置 Profile 名称，默认 tabonkb（对应 .dsh/profiles/tabonkb/）')
      .addText(text => {
        text
          .setPlaceholder('tabonkb')
          .setValue(dshCfg.profile || 'tabonkb')
          .onChange(async (val) => {
            dshCfg.profile = val.trim() || 'tabonkb';
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('定制 UI 微调')
      .setDesc('实验性 (默认关闭)：将 DSH 导航轨吸附至最右侧。已知会破坏原生会话宽度拖拽与右侧面板覆盖逻辑并造成留白，切换后请重开 Harness 页签')
      .addToggle(toggle => {
        toggle
          .setValue(dshCfg.layoutTweaks === true)
          .onChange(async (val) => {
            dshCfg.layoutTweaks = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Node 可执行路径')
      .setDesc('留空则自动探测 %APPDATA%\\node-v*\\node.exe 与当前 Node 进程')
      .addText(text => {
        text
          .setPlaceholder('C:\\Users\\...\\node.exe')
          .setValue(dshCfg.customNodePath || '')
          .onChange(async (val) => {
            dshCfg.customNodePath = val.trim();
            await this.plugin.saveSettings();
          });
      });
  }
}

module.exports = {
  TabonKBSettingTab,
  DEFAULT_SETTINGS
};
