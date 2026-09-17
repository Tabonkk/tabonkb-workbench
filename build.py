import re
import os

plugin_dir = r"d:\work\Mgmt\TabonKB\.obsidian\plugins\tabonkb-workbench"

def clean_code(code):
    # Remove node requires that will be hoisted to the top or resolved locally
    code = re.sub(r"const\s+\{[^}]*\}\s*=\s*require\(['\"][^'\"]+['\"]\);?", "", code, flags=re.MULTILINE | re.DOTALL)
    code = re.sub(r"const\s+[a-zA-Z0-9_$]+\s*=\s*require\(['\"][^'\"]+['\"]\);?", "", code)
    # Remove module.exports = { ... };
    code = re.sub(r"module\.exports\s*=\s*\{[^}]*\};?", "", code, flags=re.MULTILINE | re.DOTALL)
    return code.strip()

# Read each source module
files = [
    f"{plugin_dir}\\ui\\iconpark.js",
    f"{plugin_dir}\\providers\\agent-adapter-base.js",
    f"{plugin_dir}\\pi-agent-bridge.js",
    f"{plugin_dir}\\providers\\pi-adapter.js",
    f"{plugin_dir}\\providers\\codex-adapter.js",
    f"{plugin_dir}\\providers\\gemini-adapter.js",
    f"{plugin_dir}\\providers\\niceaigc-adapter.js",
    f"{plugin_dir}\\agent-session-manager.js",
    f"{plugin_dir}\\agent-hub.js",
    f"{plugin_dir}\\agent-context-provider.js",
    f"{plugin_dir}\\pi-drawer-view.js",
    f"{plugin_dir}\\services\\jira-service.js",
    f"{plugin_dir}\\services\\rss-service.js",
    f"{plugin_dir}\\components\\jira-card.js",
    f"{plugin_dir}\\components\\rss-card.js",
    f"{plugin_dir}\\settings\\workbench-settings-tab.js",
]

module_codes = []
for fpath in files:
    with open(fpath, "r", encoding="utf-8") as f:
        cleaned = clean_code(f.read())
        module_codes.append(cleaned)

combined_modules = "\n\n".join(module_codes)

header = """const { Plugin, ItemView, Notice, PluginSettingTab, Setting, requestUrl, MarkdownRenderer, Component } = require('obsidian');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ==========================================================================
   Embedded Multi-Agent Hub Modules (Pi, Codex, Gemini for Obsidian Workbench)
   ========================================================================== */
"""

with open(f"{plugin_dir}\\main.js.bak", "r", encoding="utf-8") as f:
    main_code = f.read()

workbench_anchor = 'const VIEW_TYPE_WORKBENCH = "tabonkb-workbench-view";'
idx = main_code.find(workbench_anchor)
if idx == -1:
    print("Error: workbench_anchor not found!")
    exit(1)

workbench_part = main_code[idx:]

# 1. Update constructor instantiation to include niceaigc config, jiraCard, and rssCard
old_drawer_init = """    this.agentHub = new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge
    });
    this.agentDrawer = new PiDrawerView({
      hub: this.agentHub,
      bridge: this.agentBridge,
      contextProvider: this.contextProvider,
      onNodeFocus: (nodeId) => this.selectKnowledgeNode(nodeId)
    });"""

new_drawer_init = """    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    this.contextProvider = plugin?.contextProvider || new AgentContextProvider(this.app);
    this.agentBridge = plugin?.agentBridge || new PiAgentBridge({ vaultBasePath: vaultPath });
    this.agentHub = plugin?.agentHub || new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge,
      app: this.app,
      getNiceaigcConfig: () => {
        const p = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        return p?.settings?.niceaigc || DEFAULT_SETTINGS.niceaigc;
      }
    });
    this.agentDrawer = new PiDrawerView({
      hub: this.agentHub,
      bridge: this.agentBridge,
      contextProvider: this.contextProvider,
      app: this.app,
      onNodeFocus: (nodeId) => this.selectKnowledgeNode(nodeId)
    });

    // Jira & RSS Integration Cards
    this.jiraCard = null;
    this.rssCard = null;"""

if old_drawer_init in workbench_part:
    workbench_part = workbench_part.replace(old_drawer_init, new_drawer_init)
    print("Updated constructor in workbench_part")
else:
    print("Notice: old_drawer_init not matched, checking if already updated...")

# 2. Update onClose to dispose jiraCard and rssCard
old_on_close = """  async onClose() {
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
  }"""

new_on_close = """  async onClose() {
    if (this.jiraCard) {
      this.jiraCard.dispose();
      this.jiraCard = null;
    }
    if (this.rssCard) {
      this.rssCard.dispose();
      this.rssCard = null;
    }
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
  }"""

if old_on_close in workbench_part:
    workbench_part = workbench_part.replace(old_on_close, new_on_close)
    print("Updated onClose in workbench_part")

# 3. Add Layer 2.5: Integrations Grid (JiraCard + RssCard) right before Layer 3
old_layer3_anchor = """      // ==========================================
      // Layer 3: Knowledge Workspace (Graph + Dynamic Context Panel)
      // =========================================="""

layer2_5_and_layer3 = """      // ==========================================
      // Layer 2.5: Integrations Grid (JiraCard + RssCard)
      // ==========================================
      const integrationsGrid = wrap.createDiv({ cls: 'tw-integrations-grid' });
      
      // Clean up previous card instances if re-rendering
      if (this.jiraCard) {
        this.jiraCard.dispose();
        this.jiraCard = null;
      }
      if (this.rssCard) {
        this.rssCard.dispose();
        this.rssCard = null;
      }

      const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
      const jiraService = plugin?.jiraService || new JiraService({ app: this.app, getConfig: () => DEFAULT_SETTINGS.jira });
      const rssService = plugin?.rssService || new RssService({ app: this.app, getFeeds: () => DEFAULT_SETTINGS.rss.feeds });

      this.jiraCard = new JiraCard({
        jiraService: jiraService,
        onOpenSettings: () => {
          this.app.setting?.open?.();
          this.app.setting?.openTabById?.('tabonkb-workbench');
        }
      });
      this.jiraCard.mount(integrationsGrid);

      this.rssCard = new RssCard({
        rssService: rssService,
        onOpenSettings: () => {
          this.app.setting?.open?.();
          this.app.setting?.openTabById?.('tabonkb-workbench');
        }
      });
      this.rssCard.mount(integrationsGrid);

      // ==========================================
      // Layer 3: Knowledge Workspace (Graph + Dynamic Context Panel)
      // =========================================="""

if old_layer3_anchor in workbench_part:
    workbench_part = workbench_part.replace(old_layer3_anchor, layer2_5_and_layer3)
    print("Inserted Layer 2.5 Integrations Grid in workbench_part")
else:
    print("Warning: old_layer3_anchor not matched!")

# 4. Update TabonKBWorkbenchPlugin class
plugin_class_pattern = re.compile(
    r"module\.exports = class TabonKBWorkbenchPlugin extends Plugin \{.*?^\};",
    re.MULTILINE | re.DOTALL
)

new_plugin_class = """module.exports = class TabonKBWorkbenchPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.jiraService = new JiraService({
      app: this.app,
      getConfig: () => this.settings.jira
    });

    this.rssService = new RssService({
      app: this.app,
      getFeeds: () => this.settings.rss?.feeds || []
    });

    const vaultPath = this.app?.vault?.adapter?.basePath || '';
    this.contextProvider = new AgentContextProvider(this.app);
    this.agentBridge = new PiAgentBridge({ vaultBasePath: vaultPath });
    this.agentHub = new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge,
      app: this.app,
      getNiceaigcConfig: () => this.settings.niceaigc || DEFAULT_SETTINGS.niceaigc
    });

    this.addSettingTab(new TabonKBSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_WORKBENCH,
      (leaf) => new TabonKBWorkbenchView(leaf)
    );

    const refreshWorkbench = () => {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
      leaves.forEach(leaf => {
        if (leaf.view && typeof leaf.view.refreshVaultDocs === 'function') {
          leaf.view.refreshVaultDocs();
        }
      });
    };

    this.registerEvent(this.app.vault.on('create', refreshWorkbench));
    this.registerEvent(this.app.vault.on('delete', refreshWorkbench));
    this.registerEvent(this.app.vault.on('modify', refreshWorkbench));
    this.registerEvent(this.app.metadataCache.on('resolved', refreshWorkbench));

    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (file) {
        if (this.contextProvider) {
          this.contextProvider.setActiveFile(file);
        }
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
        leaves.forEach(leaf => {
          if (leaf.view && leaf.view.contextProvider) {
            leaf.view.contextProvider.setActiveFile(file);
          }
        });
      }
    }));

    // Add ribbon icon on left navigation bar
    this.addRibbonIcon('layout-dashboard', '打开 TabonKB 研发工作台', () => {
      this.activateView();
    });

    // Add command palette item
    this.addCommand({
      id: 'open-tabonkb-workbench',
      name: '打开研发工作台',
      callback: () => {
        this.activateView();
      },
    });

    // Add status bar item
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText('📊 TabonKB 工作台');
    statusBarItem.addClass('mod-clickable');
    statusBarItem.onClickEvent(() => {
      this.activateView();
    });
  }

  async getSecret(secretName) {
    // 1. Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}

    // 2. Try local plugin .secrets.json file
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secretsFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secretsFile)) {
          const data = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
          if (data && data[secretName]) return data[secretName];
        }
      }
    } catch (e) {}

    // 3. Fallback to memory
    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    return this._fallbackSecrets[secretName] || null;
  }

  async setSecret(secretName, value) {
    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    this._fallbackSecrets[secretName] = value;

    // 1. Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (e) {}

    // 2. Save to local .secrets.json file
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secretsFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secretsFile)) {
          try { data = JSON.parse(fs.readFileSync(secretsFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretName] = value;
        fs.writeFileSync(secretsFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (loaded && loaded.jira) {
      this.settings.jira = Object.assign({}, DEFAULT_SETTINGS.jira, loaded.jira);
    }
    if (loaded && loaded.niceaigc) {
      this.settings.niceaigc = Object.assign({}, DEFAULT_SETTINGS.niceaigc, loaded.niceaigc);
    }
    if (loaded && loaded.rss) {
      this.settings.rss = Object.assign({}, DEFAULT_SETTINGS.rss, loaded.rss);
    }
  }

  async saveSettings() {
    // Ensure token is NEVER saved in data.json
    if (this.settings.jira) {
      delete this.settings.jira.token;
      delete this.settings.jira.apiToken;
      delete this.settings.jira.pat;
    }
    if (this.settings.niceaigc) {
      delete this.settings.niceaigc.token;
      delete this.settings.niceaigc.apiKey;
    }
    await this.saveData(this.settings);

    // Notify active workbench views to refresh if config changed
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (leaf.view.jiraCard) {
          leaf.view.jiraCard.refresh(true);
        }
        if (leaf.view.rssCard) {
          leaf.view.rssCard.refresh(true);
        }
      }
    });
  }

  onunload() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (leaf.view.jiraCard) {
          leaf.view.jiraCard.dispose();
        }
        if (leaf.view.rssCard) {
          leaf.view.rssCard.dispose();
        }
        if (leaf.view.agentBridge) {
          leaf.view.agentBridge.destroy();
        }
      }
    });
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_WORKBENCH, active: true });
    }

    workspace.revealLeaf(leaf);
  }
};"""

if plugin_class_pattern.search(workbench_part):
    workbench_part = plugin_class_pattern.sub(new_plugin_class, workbench_part)
    print("Updated TabonKBWorkbenchPlugin class in workbench_part")
else:
    print("Warning: plugin_class_pattern did not match in workbench_part!")

bundled = header + "\n" + combined_modules + "\n\n\n" + workbench_part

with open(f"{plugin_dir}\\main.js", "w", encoding="utf-8") as f:
    f.write(bundled)

print("Successfully bundled all components into main.js!")
