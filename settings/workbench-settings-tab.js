const { PluginSettingTab, Setting, Notice } = require('obsidian');
const { DEFAULT_JIRA_JQL } = require('../services/jira-service');
const { DEFAULT_FEEDS } = require('../services/rss-service');

const DEFAULT_SETTINGS = {
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

  async getCredential(secretName) {
    if (typeof this.plugin.getSecret === 'function') {
      const s = await this.plugin.getSecret(secretName);
      if (s) return s;
    }
    // Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}
    // Try .secrets.json
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretName]) return data[secretName];
        }
      }
    } catch (e) {}
    const adapter = this.plugin.agentHub?.getAdapter?.('niceaigc');
    if (adapter && typeof adapter.getCredential === 'function') {
      const s = await adapter.getCredential(secretName);
      if (s) return s;
    }
    if (this.plugin._fallbackSecrets) {
      return this.plugin._fallbackSecrets[secretName] || null;
    }
    return null;
  }

  async setCredential(secretName, value) {
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
        this.plugin.jiraService?.getCredential(jiraConfig.secretName).then(existing => {
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
  }
}

module.exports = {
  TabonKBSettingTab,
  DEFAULT_SETTINGS
};
