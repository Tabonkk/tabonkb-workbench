/**
 * @typedef {Object} JiraConfig
 * @property {'cloud' | 'datacenter'} type
 * @property {string} baseUrl
 * @property {string} [email]
 * @property {string} [secretName] - Key in SecretStorage
 * @property {string} jql
 * @property {number} refreshIntervalMinutes
 */

/**
 * @typedef {Object} DashboardIssue
 * @property {string} key
 * @property {string} summary
 * @property {string} status
 * @property {string} [priority]
 * @property {string} [assignee]
 * @property {string} [updated]
 * @property {string} url
 */

const DEFAULT_JIRA_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

/**
 * Safely encode a string to Base64 in both browser and Node.js environments,
 * properly handling non-ASCII / Unicode characters.
 * @param {string} str
 * @returns {string}
 */
function safeBase64(str) {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return btoa(str);
  }
}

/* ==========================================================================
   Standalone config helpers (Pi extension / stdio MCP 无 Obsidian app 上下文)
   凭证优先级: 环境变量 > .secrets.json > data.json
   ========================================================================== */
function jiraReadJsonSafe(fp) {
  try {
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return null;
  }
}

function jiraResolvePluginDir() {
  const path = require('path');
  const fs = require('fs');
  const cands = [
    path.resolve(__dirname, '..'),
    path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench'
  ];
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'data.json'))) return c;
  }
  return cands[0];
}

function jiraReadSecret(secretName) {
  if (!secretName) return '';
  const path = require('path');
  const cands = [
    path.join(jiraResolvePluginDir(), '.secrets.json'),
    path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/.secrets.json'
  ];
  for (const f of cands) {
    const data = jiraReadJsonSafe(f);
    if (data && data[secretName]) return String(data[secretName]).trim();
  }
  return '';
}

/**
 * Load Jira config without Obsidian context: env > data.json.
 * @param {object} [override]
 * @returns {JiraConfig}
 */
function jiraLoadConfig(override) {
  override = override || {};
  const path = require('path');
  const data = jiraReadJsonSafe(path.join(jiraResolvePluginDir(), 'data.json')) || {};
  const j = (data && data.jira) || {};
  return {
    type: (override.type || process.env.JIRA_TYPE || j.type || 'datacenter').trim(),
    baseUrl: (override.baseUrl || process.env.JIRA_BASE_URL || j.baseUrl || '').trim().replace(/\/+$/, ''),
    email: (override.email || process.env.JIRA_EMAIL || j.email || '').trim(),
    username: (override.username || process.env.JIRA_USERNAME || j.username || j.email || '').trim(),
    authType: (override.authType || process.env.JIRA_AUTH_TYPE || j.authType || 'basic').trim(),
    secretName: (override.secretName || process.env.JIRA_SECRET_NAME || j.secretName || 'tabonkb-jira-token').trim(),
    jql: override.jql || process.env.JIRA_JQL || j.jql || DEFAULT_JIRA_JQL,
    refreshIntervalMinutes: j.refreshIntervalMinutes || 5
  };
}

class JiraService {
  /**
   * @param {Object} options
   * @param {any} options.app - Obsidian App instance
   * @param {() => JiraConfig} options.getConfig - Getter for JiraConfig
   */
  constructor(options) {
    options = options || {};
    this.app = options.app;
    this.vaultBasePath = options.vaultBasePath || '';
    this.getConfig = options.getConfig || (() => jiraLoadConfig());

    // In-memory cache: { issues: DashboardIssue[], lastUpdated: number, isStale: boolean }
    this._cache = null;
    this._trendCache = null;
    this._cacheTtlMs = 5 * 60 * 1000; // 5 minutes

    // In-memory credential fallback (in case Obsidian version does not support secretStorage)
    this._memorySecret = null;

    // Load persistent offline cache from localStorage
    this.loadPersistentCache();
  }

  getTrendCacheKeys(config = null) {
    const cfg = config || (typeof this.getConfig === 'function' ? this.getConfig() : {}) || {};
    const identity = [cfg.type || 'jira', (cfg.baseUrl || '').trim().replace(/\/+$/, ''), (cfg.email || cfg.username || '').trim().toLowerCase()].join('|');
    const suffix = encodeURIComponent(identity).slice(0, 180);
    return {
      data: `tabonkb-jira-trend-cache:${suffix}`,
      time: `tabonkb-jira-trend-time:${suffix}`
    };
  }

  loadPersistentCache() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-cache-v1');
        const timeStr = localStorage.getItem('tabonkb-jira-cache-time');
        if (raw && timeStr) {
          const issues = JSON.parse(raw);
          const lastUpdated = parseInt(timeStr, 10);
          if (Array.isArray(issues) && !isNaN(lastUpdated)) {
            this._cache = {
              issues,
              lastUpdated,
              isStale: (Date.now() - lastUpdated > this._cacheTtlMs)
            };
          }
        }

        const trendKeys = this.getTrendCacheKeys();
        const rawTrend = localStorage.getItem(trendKeys.data);
        const trendTimeStr = localStorage.getItem(trendKeys.time);
        if (rawTrend && trendTimeStr) {
          const trendIssues = JSON.parse(rawTrend);
          const lastTrendUpdated = parseInt(trendTimeStr, 10);
          if (Array.isArray(trendIssues) && !isNaN(lastTrendUpdated)) {
            this._trendCache = {
              issues: trendIssues,
              lastUpdated: lastTrendUpdated,
              isStale: (Date.now() - lastTrendUpdated > this._cacheTtlMs)
            };
          }
        }
      }
    } catch (e) {}
  }

  savePersistentCache(issues, lastUpdated) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-cache-v1', JSON.stringify(issues));
        localStorage.setItem('tabonkb-jira-cache-time', String(lastUpdated));
      }
    } catch (e) {}
  }

  getCacheInfo() {
    if (!this._cache || !this._cache.lastUpdated) {
      return { hasCache: false, lastUpdated: 0, count: 0, relativeTime: '未同步', isExpired: true };
    }
    const d = new Date(this._cache.lastUpdated);
    const timeStr = isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const diffMin = Math.floor((Date.now() - this._cache.lastUpdated) / 60000);
    const rel = diffMin <= 1 ? '刚刚' : `${diffMin}分钟前`;
    return {
      hasCache: true,
      lastUpdated: this._cache.lastUpdated,
      count: this._cache.issues?.length || 0,
      timeStr,
      relativeTime: `${timeStr} (${rel})`,
      isExpired: Date.now() - this._cache.lastUpdated > this._cacheTtlMs
    };
  }

  /**
   * Safely retrieve token from Obsidian SecretStorage or memory fallback.
   * Credentials NEVER enter logs, data.json, or markdown.
   * @param {string} [secretKey]
   * @returns {Promise<string | null>}
   */
  async getCredential(secretKey = 'tabonkb-jira-token') {
    // 1. Try plugin getSecret
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.getSecret === 'function') {
        const s = await plugin.getSecret(secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 2. Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 3. Try local plugin .secrets.json
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || this.vaultBasePath || (process.cwd ? process.cwd() : '');
      const secCands = [
        vaultPath ? path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json') : '',
        path.join(jiraResolvePluginDir(), '.secrets.json'),
        path.resolve(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json')
      ].filter(Boolean);
      for (const secFile of secCands) {
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretKey]) return data[secretKey];
        }
      }
    } catch (e) {}

    // 3.5 Env fallback (MCP/extension subprocess with injected env)
    try {
      const envTok = process.env.JIRA_TOKEN || process.env.JIRA_PASSWORD || '';
      if (envTok.trim()) return envTok.trim();
    } catch (e) {}

    // 4. Try Obsidian SecretStorage (if supported)
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.getSecret === 'function') {
        const secret = await this.app.secretStorage.getSecret(secretKey);
        if (secret) return secret;
      }
    } catch (e) {}

    return this._memorySecret || null;
  }

  async setCredential(secretKey = 'tabonkb-jira-token', token) {
    this._memorySecret = token;

    // 1. Save to plugin
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.setSecret === 'function') {
        await plugin.setSecret(secretKey, token);
      }
    } catch (e) {}

    // 2. Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) localStorage.setItem('tabonkb-secret-' + secretKey, token);
        else localStorage.removeItem('tabonkb-secret-' + secretKey);
      }
    } catch (e) {}

    // 3. Save to local .secrets.json
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
        data[secretKey] = token;
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}

    // 4. Save to Obsidian SecretStorage
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.setSecret === 'function') {
        await this.app.secretStorage.setSecret(secretKey, token);
      }
    } catch (e) {}
  }

  /**
   * Strictly validate that the target URL origin matches the configured Jira origin.
   * @param {string} targetUrl
   * @param {string} baseUrl
   * @returns {boolean}
   */
  validateOrigin(targetUrl, baseUrl) {
    try {
      if (!targetUrl || !baseUrl) return false;
      const targetOrigin = new URL(targetUrl).origin.toLowerCase();
      const baseOrigin = new URL(baseUrl).origin.toLowerCase();
      return targetOrigin === baseOrigin;
    } catch (e) {
      return false;
    }
  }

  /**
   * Search issues on Jira Cloud using REST API v3
   * Priority endpoint: POST /rest/api/3/search/jql or POST /rest/api/3/search
   * Basic Auth: email + apiToken
   * @param {JiraConfig} config
   * @param {string} token - API token
   * @returns {Promise<DashboardIssue[]>}
   */
  async searchCloudIssues(config, token) {
    if (!config.baseUrl) throw new Error('Jira Cloud Base URL 未配置');
    if (!config.email) throw new Error('Jira Cloud 需要配置账号 Email');
    if (!token) throw new Error('Jira Cloud 需要配置 API Token');

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    const apiUrl = `${cleanBaseUrl}/rest/api/3/search`;

    if (!this.validateOrigin(apiUrl, cleanBaseUrl)) {
      throw new Error('Jira API 目标域名与配置的 Jira Base URL Origin 不一致，已阻止请求以保证凭据安全');
    }

    const authHeader = `Basic ${safeBase64(config.email.trim() + ':' + token.trim())}`;
    const jql = (config.jql && config.jql.trim()) || DEFAULT_JIRA_JQL;

    const requestBody = {
      jql,
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'resolutiondate', 'description', 'reporter', 'created', 'components']
    };

    const response = await this._executeRequest({
      url: apiUrl,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 401) {
      throw new Error('Jira Cloud 认证失败 (HTTP 401 Unauthorized)。请检查 Email 与 API Token 是否正确');
    }
    if (response.status === 403) {
      throw new Error('Jira Cloud 权限不足 (HTTP 403 Forbidden)。请确认该 API Token 拥有查看该项目的权限');
    }
    if (response.status === 400) {
      let msg = 'Jira Cloud JQL 查询语法错误';
      try {
        let errJson = response.json;
        if (!errJson && response.text && typeof response.text === 'string' && response.text.trim()) {
          errJson = JSON.parse(response.text);
        }
        if (errJson?.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Cloud 查询失败 (HTTP ${response.status})`);
    }

    let data = response.json;
    if (!data && response.text && typeof response.text === 'string' && response.text.trim()) {
      try { data = JSON.parse(response.text); } catch (_) { data = {}; }
    }
    data = data || {};
    const rawIssues = data.issues || [];
    return rawIssues.map(issue => this.normalizeIssue(issue, cleanBaseUrl));
  }

  /**
   * Search issues on Jira Data Center / Server using REST API v2
   * Supports both Basic Auth (username + password for Server/DC) and Bearer (PAT for DC 8.14+)
   * In Electron/Obsidian, GET requests bypass Jira Server XSRF Origin blocking (HTTP 403)
   * @param {JiraConfig} config
   * @param {string} token - Personal Access Token or Password
   * @returns {Promise<DashboardIssue[]>}
   */
  async searchDataCenterIssues(config, token) {
    if (!config.baseUrl) throw new Error('Jira Data Center Base URL 未配置');
    if (!token) throw new Error('Jira Data Center 需要配置密码、Cookie 或 PAT');

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');

    const commonHeaders = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const isCookieAuth = config.authType === 'cookie' || token.startsWith('JSESSIONID=');
    if (isCookieAuth) {
      commonHeaders['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
    } else {
      const user = (config.username || config.email || '').trim();
      if (config.authType === 'basic' || user) {
        if (!user) throw new Error('Jira Server 用户名+密码认证需要填写用户名');
        commonHeaders['Authorization'] = `Basic ${safeBase64(user + ':' + token.trim())}`;
      } else if (token.includes(':')) {
        commonHeaders['Authorization'] = `Basic ${safeBase64(token.trim())}`;
      } else {
        commonHeaders['Authorization'] = `Bearer ${token.trim()}`;
      }
    }

    const jql = (config.jql && config.jql.trim()) || DEFAULT_JIRA_JQL;
    const reqFields = 'summary,status,priority,assignee,updated,resolutiondate,description,reporter,created,components';

    // Primary attempt: GET /rest/api/2/search
    // In Electron, GET avoids Jira Server CSRF / XSRF origin check failure (Status 403)
    const getUrl = `${cleanBaseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=0&maxResults=100&fields=${reqFields}`;
    if (!this.validateOrigin(getUrl, cleanBaseUrl)) {
      throw new Error('Jira API 目标域名与配置的 Jira Base URL Origin 不一致，已阻止请求以保证凭据安全');
    }

    let response;
    try {
      response = await this._executeRequest({
        url: getUrl,
        method: 'GET',
        headers: commonHeaders
      });
    } catch (e) {
      // Fallback to POST if GET fails or URL too long
      const postUrl = `${cleanBaseUrl}/rest/api/2/search`;
      const requestBody = {
        jql,
        startAt: 0,
        maxResults: 100,
        fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'resolutiondate', 'description', 'reporter', 'created', 'components']
      };
      response = await this._executeRequest({
        url: postUrl,
        method: 'POST',
        headers: Object.assign({}, commonHeaders, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(requestBody)
      });
    }

    if (response.status === 401) {
      throw new Error('Jira 认证失败 (HTTP 401 Unauthorized)。请检查用户名和密码/Cookie 是否有效');
    }
    if (response.status === 403) {
      const denied = (response.headers?.['x-authentication-denied-reason'] || response.headers?.['X-Authentication-Denied-Reason'] || '').toLowerCase();
      const seraph = (response.headers?.['x-seraph-loginreason'] || response.headers?.['X-Seraph-Loginreason'] || '');
      if (denied.includes('captcha') || seraph.includes('AUTHENTICATION_DENIED')) {
        throw new Error(`Jira 触发了安全验证码保护 (CAPTCHA_CHALLENGE)。请在浏览器中打开 ${cleanBaseUrl}/login.jsp 登录一次并输入验证码以解除拦截；或在工作台设置中切换认证方式为「Session Cookie (JSESSIONID)」。`);
      }
      throw new Error('Jira 拒绝访问 (HTTP 403 Forbidden)。请确认密码是否正确，或账号是否拥有相关项目权限');
    }
    if (response.status === 400) {
      let msg = 'Jira JQL 查询语法错误或包含无权限字段';
      try {
        let errJson = response.json;
        if (!errJson && response.text && typeof response.text === 'string' && response.text.trim()) {
          errJson = JSON.parse(response.text);
        }
        if (errJson?.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Data Center 查询失败 (HTTP ${response.status})`);
    }

    let data = response.json;
    if (!data && response.text && typeof response.text === 'string' && response.text.trim()) {
      try { data = JSON.parse(response.text); } catch (_) { data = {}; }
    }
    data = data || {};
    const rawIssues = data.issues || [];
    return rawIssues.map(issue => this.normalizeIssue(issue, cleanBaseUrl));
  }

  /**
   * Normalize raw Jira issue to standard DashboardIssue interface.
   * UI never depends directly on raw Jira JSON.
   * @param {any} raw
   * @param {string} baseUrl
   * @returns {DashboardIssue}
   */
  normalizeIssue(raw, baseUrl) {
    if (!raw) return null;
    const key = raw.key || '';
    const fields = raw.fields || {};

    const summary = fields.summary || '（无标题）';
    const status = fields.status?.name || 'δ֪';
    const statusCategory = fields.status?.statusCategory?.key || '';
    const priority = fields.priority?.name || 'Medium';

    let assignee = '未指派';
    let assigneeName = '';
    let assigneeEmail = '';
    if (fields.assignee) {
      assignee = fields.assignee.displayName || fields.assignee.name || '已指派';
      // 账号级字段：Server 为 name，Cloud 为 accountId；供“是否本人事项”判断
      assigneeName = fields.assignee.name || fields.assignee.accountId || '';
      assigneeEmail = fields.assignee.emailAddress || '';
    }

    let reporter = 'ϵͳ';
    if (fields.reporter) {
      reporter = fields.reporter.displayName || fields.reporter.name || 'ϵͳ';
    }

    let description = '';
    if (typeof fields.description === 'string') {
      description = fields.description;
    } else if (fields.description && typeof fields.description === 'object') {
      try {
        description = JSON.stringify(fields.description);
      } catch (e) {
        description = '';
      }
    }

    const components = Array.isArray(fields.components) ? fields.components.map(c => c.name) : [];

    let updated = '';
    let rawUpdated = fields.updated || '';
    if (fields.updated) {
      try {
        const d = new Date(fields.updated);
        if (!isNaN(d.getTime())) {
          updated = formatRelativeTime(d);
        }
      } catch (e) {}
    }

    const rawResolved = fields.resolutiondate || '';

    let created = '';
    let rawCreated = fields.created || '';
    if (fields.created) {
      try {
        const d = new Date(fields.created);
        if (!isNaN(d.getTime())) {
          created = formatRelativeTime(d);
        }
      } catch (e) {}
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/browse/${encodeURIComponent(key)}`;

    return {
      key,
      summary,
      status,
      statusCategory,
      priority,
      assignee,
      assigneeName,
      assigneeEmail,
      reporter,
      description,
      components,
      created,
      updated,
      rawCreated,
      rawUpdated,
      rawResolved,
      url
    };
  }

  /**
   * Public search entrypoint with in-memory caching, persistent storage, and stale-while-error fallback.
   * Does NOT accept arbitrary URLs from caller.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ issues: DashboardIssue[], lastUpdated: number, isStale: boolean, error?: string }>}
   */
  async searchIssues(forceRefresh = false) {
    const now = Date.now();

    // 1. Check in-memory/persistent fresh cache
    if (!forceRefresh && this._cache && (now - this._cache.lastUpdated < this._cacheTtlMs)) {
      return {
        issues: this._cache.issues,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    }

    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) {
      return {
        issues: [],
        lastUpdated: this._cache?.lastUpdated || now,
        isStale: false,
        error: '未配置 Jira 服务地址，请在工作台设置中配置 Jira'
      };
    }

    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);

    if (!token) {
      return {
        issues: this._cache?.issues || [],
        lastUpdated: this._cache?.lastUpdated || now,
        isStale: !!this._cache,
        error: '未配置 Jira 认证 Token，请在工作台设置中录入'
      };
    }

    try {
      let issues = [];
      if (config.type === 'datacenter') {
        issues = await this.searchDataCenterIssues(config, token);
      } else {
        issues = await this.searchCloudIssues(config, token);
      }

      // Update fresh in-memory cache
      this._cache = {
        issues,
        lastUpdated: Date.now(),
        isStale: false
      };

      // Save persistent cache for offline-first instant loading
      this.savePersistentCache(issues, this._cache.lastUpdated);

      return {
        issues,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    } catch (err) {
      // Safe sanitized error message without credential/token leak
      const safeErrorMsg = sanitizeErrorMessage(err.message || 'Jira 请求失败');

      // Stale-While-Error fallback
      if (this._cache && this._cache.issues && this._cache.issues.length > 0) {
        return {
          issues: this._cache.issues,
          lastUpdated: this._cache.lastUpdated,
          isStale: true,
          error: safeErrorMsg
        };
      }

      return {
        issues: [],
        lastUpdated: now,
        isStale: false,
        error: safeErrorMsg
      };
    }
  }

  /**
   * Fetch user issues for trend & convergence analytics.
   * Caches in memory and localStorage for instant 0ms offline rendering.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<DashboardIssue[]>}
   */
  async getTrendIssues(forceRefresh = false) {
    const now = Date.now();
    const cacheTtl = 5 * 60 * 1000;
    if (!forceRefresh && this._trendCache && (now - this._trendCache.lastUpdated < cacheTtl)) {
      return this._trendCache.issues;
    }

    // Try persistent cache from localStorage
    try {
      if (!forceRefresh && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-trend-cache');
        const timeStr = localStorage.getItem('tabonkb-jira-trend-time');
        if (raw && timeStr) {
          const t = parseInt(timeStr, 10);
          if (!isNaN(t) && (now - t < cacheTtl)) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
              this._trendCache = { issues: list, lastUpdated: t };
              return list;
            }
          }
        }
      }
    } catch (e) {}

    // Query server for latest 100 assigned issues (both open and closed)
    try {
      const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
      if (!config || !config.baseUrl) {
        return this._trendCache?.issues || [];
      }
      const secretKey = config.secretName || 'tabonkb-jira-token';
      const token = await this.getCredential(secretKey);
      if (!token) {
        return this._trendCache?.issues || [];
      }

      const trendConfig = Object.assign({}, config, {
        jql: 'assignee = currentUser() ORDER BY updated DESC'
      });

      let issues = [];
      if (config.type === 'datacenter') {
        issues = await this.searchDataCenterIssues(trendConfig, token);
      } else {
        issues = await this.searchCloudIssues(trendConfig, token);
      }

      if (Array.isArray(issues) && issues.length > 0) {
        this._trendCache = { issues, lastUpdated: now };
        try {
          if (typeof localStorage !== 'undefined') {
            const trendKeys = this.getTrendCacheKeys(config);
            localStorage.setItem(trendKeys.data, JSON.stringify(issues));
            localStorage.setItem(trendKeys.time, String(now));
          }
        } catch (e) {}
        return issues;
      }
    } catch (err) {
      console.warn('Jira trend search failed, falling back to cache', err);
    }

    // Fallback: cached trend issues, then main cache
    try {
      if (typeof localStorage !== 'undefined') {
        const trendKeys = this.getTrendCacheKeys();
        const raw = localStorage.getItem(trendKeys.data);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}

    return this._trendCache?.issues || [];
  }

  /**
   * Get available transitions for an issue
   * @param {string} issueKey
   * @returns {Promise<Array<{id: string, name: string, to: {name: string, category: string}, hasScreen?: boolean, requiredFields?: Array<{key: string, name: string}>, fields?: any}>>}
   */
  async getTransitions(issueKey) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    // Append expand=transitions.fields to inspect transition screens and required fields
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/transitions?expand=transitions.fields`;

    const headers = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    try {
      const res = await this._executeRequest({ url, method: 'GET', headers });
      if (res.status === 200) {
        let data = res.json;
        if (!data && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
          try { data = JSON.parse(res.text); } catch (_) { data = {}; }
        }
        data = data || {};
        return (data.transitions || []).map(t => {
          const fields = t.fields || {};
          const requiredFields = [];
          const fieldList = [];
          for (const [fKey, fVal] of Object.entries(fields)) {
            const item = {
              key: fKey,
              name: fVal.name || fKey,
              required: Boolean(fVal.required),
              type: fVal.schema?.type || fVal.type || 'string',
              schema: fVal.schema || {},
              allowedValues: Array.isArray(fVal.allowedValues) ? fVal.allowedValues : [],
              hasDefaultValue: Boolean(fVal.hasDefaultValue),
              defaultValue: fVal.defaultValue
            };
            fieldList.push(item);
            if (fVal && fVal.required) {
              requiredFields.push(item);
            }
          }
          const isResolve = /解决|完成|关闭|resolve|done|close/i.test(t.name) || /done/i.test(t.to?.statusCategory?.key || '');
          return {
            id: String(t.id),
            name: t.name,
            to: {
              name: t.to?.name || t.name,
              category: t.to?.statusCategory?.key || ''
            },
            hasScreen: Boolean(t.hasScreen) || fieldList.length > 0 || isResolve,
            isResolve,
            requiredFields,
            fieldList,
            fields
          };
        });
      }
      return [];
    } catch (e) {
      console.warn(`[JiraService] Failed to get transitions for ${issueKey}:`, e);
      return [];
    }
  }

  /**
   * Execute a status transition on an issue
   * @param {string} issueKey
   * @param {string} transitionId
   * @param {string} [targetStatusName]
   * @param {object} [customFields]
   * @param {string} [commentText]
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async doTransition(issueKey, transitionId, targetStatusName, customFields = null, commentText = null) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/transitions`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    const buildPayload = (fieldsObj) => {
      const p = { transition: { id: String(transitionId) } };
      if (fieldsObj && typeof fieldsObj === 'object' && Object.keys(fieldsObj).length > 0) {
        p.fields = fieldsObj;
      }
      if (commentText && typeof commentText === 'string' && commentText.trim()) {
        p.update = {
          comment: [
            {
              add: {
                body: commentText.trim()
              }
            }
          ]
        };
      }
      return p;
    };

    const parseErrJson = (r) => {
      let j = r.json;
      if (!j && r.text && typeof r.text === 'string' && r.text.trim().length > 0) {
        try { j = JSON.parse(r.text); } catch (_) { j = null; }
      }
      return j || null;
    };

    let res = await this._executeRequest({
      url,
      method: 'POST',
      headers,
      body: JSON.stringify(buildPayload(customFields))
    });

    // Jira rejects fields absent from the transition screen (e.g. resolution
    // auto-set by a workflow post-function). Strip reported fields and retry once.
    if (![200, 201, 204].includes(res.status) && customFields && Object.keys(customFields).length > 0) {
      const errJson = parseErrJson(res);
      const unsettable = [];
      if (errJson && errJson.errors && typeof errJson.errors === 'object') {
        for (const [k, v] of Object.entries(errJson.errors)) {
          if (typeof v === 'string' && /cannot be set|not on the appropriate screen|cannot be edited|unknown/i.test(v)) {
            unsettable.push(k);
          }
        }
      }
      if (unsettable.length > 0 && unsettable.some(k => Object.prototype.hasOwnProperty.call(customFields, k))) {
        const stripped = { ...customFields };
        for (const k of unsettable) delete stripped[k];
        res = await this._executeRequest({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify(buildPayload(Object.keys(stripped).length ? stripped : null))
        });
      }
    }

    if (res.status === 204 || res.status === 200 || res.status === 201) {
      // Transition succeeded! Update local cache immediately
      if (this._cache && Array.isArray(this._cache.issues)) {
        const target = this._cache.issues.find(i => i.key === issueKey);
        if (target && targetStatusName) {
          target.status = targetStatusName;
          target.updated = '刚刚';
        }
        this.savePersistentCache(this._cache.issues, this._cache.lastUpdated);
      }
      return { success: true };
    }

    let detailMsg = '';
    const errJson = parseErrJson(res);
    const errObj = errJson;

    if (errJson) {
      const parts = [];
      if (Array.isArray(errJson.errorMessages) && errJson.errorMessages.length > 0) {
        parts.push(...errJson.errorMessages.filter(Boolean));
      }
      if (errJson.errors && typeof errJson.errors === 'object' && Object.keys(errJson.errors).length > 0) {
        for (const [k, v] of Object.entries(errJson.errors)) {
          if (v) parts.push(`${k}: ${v}`);
        }
      }
      if (errObj.message && typeof errObj.message === 'string' && !parts.includes(errObj.message)) {
        parts.push(errObj.message);
      }
      if (parts.length > 0) {
        detailMsg = parts.join('; ');
      }
    }

    if (!detailMsg) {
      if (res.status === 403) {
        detailMsg = '请检查工单工作流流转权限或 Jira CSRF/跨域配置';
      } else if (res.status === 400) {
        detailMsg = '该状态流转可能需要必填字段（如修复版本/解决结果/经办人等）或包含流转弹窗限制';
      } else {
        const cleanText = (res.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        detailMsg = cleanText.slice(0, 150) || '请检查工单工作流状态';
      }
    }

    const err = new Error(`Jira 状态流转失败 (HTTP ${res.status}): ${detailMsg}`);
    err.status = res.status;
    err.detailMsg = detailMsg;
    err.jiraError = errObj;
    throw err;
  }

  /**
   * Extract plain text from comment body (supports raw string or Jira Cloud ADF structure)
   * @param {any} body
   * @returns {string}
   */
  parseCommentBody(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object') {
      // Jira Cloud ADF (Atlassian Document Format)
      const texts = [];
      function walk(node) {
        if (!node) return;
        if (node.text) texts.push(node.text);
        if (Array.isArray(node.content)) {
          for (const child of node.content) walk(child);
          if (node.type === 'paragraph' || node.type === 'heading') texts.push('\n');
        }
      }
      walk(body);
      return texts.join('').trim();
    }
    return String(body);
  }

  /**
   * Fetch comments / activity logs for an issue
   * @param {string} issueKey
   * @returns {Promise<Array<{id: string, author: string, authorAvatar: string, body: string, created: string, createdFormatted: string, updated: string, isEdited: boolean}>>}
   */
  async getIssueComments(issueKey) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/comment?expand=renderedBody`;

    const headers = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    try {
      const res = await this._executeRequest({ url, method: 'GET', headers });
      if (res.status === 200) {
        let data = res.json;
        if (!data && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
          try { data = JSON.parse(res.text); } catch (_) { data = {}; }
        }
        data = data || {};
        const rawComments = Array.isArray(data.comments) ? data.comments : [];
        return rawComments.map(c => {
          const author = c.author?.displayName || c.author?.name || '未知用户';
          const authorAvatar = c.author?.avatarUrls?.['24x24'] || c.author?.avatarUrls?.['16x16'] || '';
          const body = this.parseCommentBody(c.renderedBody || c.body);

          let createdFormatted = '';
          if (c.created) {
            try {
              const d = new Date(c.created);
              if (!isNaN(d.getTime())) {
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                const ho = String(d.getHours()).padStart(2, '0');
                const mi = String(d.getMinutes()).padStart(2, '0');
                createdFormatted = `${yr}-${mo}-${da} ${ho}:${mi}`;
              }
            } catch (e) {}
          }
          if (!createdFormatted) createdFormatted = c.created || '';

          const isEdited = Boolean(c.updated && c.created && (new Date(c.updated).getTime() - new Date(c.created).getTime() > 10000));

          return {
            id: String(c.id),
            author,
            authorAvatar,
            body,
            created: c.created || '',
            createdFormatted,
            updated: c.updated || '',
            isEdited
          };
        });
      }
      return [];
    } catch (err) {
      console.warn(`[JiraService] Failed to get comments for ${issueKey}:`, err);
      return [];
    }
  }

  /**
   * Add a new comment to an issue
   * @param {string} issueKey
   * @param {string} commentText
   * @returns {Promise<{success: boolean, comment?: any, message?: string}>}
   */
  async addIssueComment(issueKey, commentText) {
    if (!commentText || !commentText.trim()) {
      return { success: false, message: '注释内容不能为空' };
    }

    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/comment`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    const isCloud = config.type === 'cloud';
    const trimmed = commentText.trim();
    const payload = isCloud
      ? {
          body: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: trimmed }]
            }]
          }
        }
      : {
          body: trimmed
        };

    try {
      let res = await this._executeRequest({
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      // If cloud failed with 400 on ADF format, fallback to simple body
      if (isCloud && res.status === 400) {
        res = await this._executeRequest({
          url: `${cleanBase}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`,
          method: 'POST',
          headers,
          body: JSON.stringify({ body: trimmed })
        });
      }

      if (res.status === 201 || res.status === 200) {
        let data = res.json;
        if (!data && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
          try { data = JSON.parse(res.text); } catch (_) { data = {}; }
        }
        return { success: true, comment: data };
      }

      let errMsg = `提交失败 (HTTP ${res.status})`;
      let errJson = res.json;
      if (!errJson && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
        try { errJson = JSON.parse(res.text); } catch (_) { errJson = null; }
      }
      if (errJson?.errorMessages?.length) {
        errMsg += `: ${errJson.errorMessages.join('; ')}`;
      } else if (errJson?.errors && typeof errJson.errors === 'object') {
        const errList = Object.entries(errJson.errors).map(([k, v]) => `${k}: ${v}`);
        if (errList.length) errMsg += `: ${errList.join('; ')}`;
      }
      return { success: false, message: errMsg };
    } catch (err) {
      return { success: false, message: err.message || '网络或服务异常' };
    }
  }

  /**
   * Test Jira connection with current credentials.
   * Tests user authentication via /myself endpoint first, then validates JQL query.
   * Does NOT leak token in error response.
   * @returns {Promise<{ ok: boolean, message: string, count?: number }>}
   */
  async testConnection() {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) {
      return { ok: false, message: '请先填写 Jira 服务根地址 (Base URL)' };
    }

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);

    if (!token) {
      return { ok: false, message: '请先在输入框中录入 API Token、登录密码或 Session Cookie' };
    }

    const isCloud = config.type === 'cloud';
    const myselfUrl = isCloud ? `${cleanBaseUrl}/rest/api/3/myself` : `${cleanBaseUrl}/rest/api/2/myself`;

    if (!this.validateOrigin(myselfUrl, cleanBaseUrl)) {
      return { ok: false, message: 'Jira API 目标域名与配置的 Jira Base URL Origin 不一致' };
    }

    const testHeaders = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (isCloud) {
      if (!config.email) return { ok: false, message: 'Jira Cloud 需要配置账号 Email' };
      testHeaders['Authorization'] = `Basic ${safeBase64(config.email.trim() + ':' + token.trim())}`;
    } else {
      const isCookieAuth = config.authType === 'cookie' || token.startsWith('JSESSIONID=');
      if (isCookieAuth) {
        testHeaders['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        if (config.authType === 'basic' || user) {
          if (!user) return { ok: false, message: 'Basic 认证需要填写 Jira 用户名' };
          testHeaders['Authorization'] = `Basic ${safeBase64(user + ':' + token.trim())}`;
        } else if (token.includes(':')) {
          testHeaders['Authorization'] = `Basic ${safeBase64(token.trim())}`;
        } else {
          testHeaders['Authorization'] = `Bearer ${token.trim()}`;
        }
      }
    }

    try {
      // 1. Verify User Authentication via /myself
      const myselfRes = await this._executeRequest({
        url: myselfUrl,
        method: 'GET',
        headers: testHeaders
      });

      if (myselfRes.status === 401) {
        return {
          ok: false,
          message: '认证失败 (HTTP 401 Unauthorized)。请检查用户名和密码/Token/Cookie 是否匹配。'
        };
      }
      if (myselfRes.status === 403) {
        const denied = (myselfRes.headers?.['x-authentication-denied-reason'] || myselfRes.headers?.['X-Authentication-Denied-Reason'] || '').toLowerCase();
        const seraph = (myselfRes.headers?.['x-seraph-loginreason'] || myselfRes.headers?.['X-Seraph-Loginreason'] || '');
        if (denied.includes('captcha') || seraph.includes('AUTHENTICATION_DENIED')) {
          return {
            ok: false,
            message: `Jira 触发了安全验证码保护 (CAPTCHA_CHALLENGE)。请在浏览器中打开 ${cleanBaseUrl}/login.jsp 登录一次并输入验证码以解除拦截；或在工作台设置中切换认证方式为「Session Cookie (JSESSIONID)」。`
          };
        }
        return {
          ok: false,
          message: 'Jira 拒绝访问 (HTTP 403 Forbidden)。请检查密码是否正确，或账号是否被锁定。'
        };
      }
      if (myselfRes.status !== 200) {
        return {
          ok: false,
          message: `Jira 用户信息接口返回 HTTP ${myselfRes.status}，请检查服务状态与 Base URL`
        };
      }

      let userData = myselfRes.json;
      if (!userData && myselfRes.text && typeof myselfRes.text === 'string' && myselfRes.text.trim()) {
        try { userData = JSON.parse(myselfRes.text); } catch (e) {}
      }
      userData = userData || {};
      const displayName = userData.displayName || userData.name || '已认证用户';

      // 2. Verify JQL query with searchIssues
      const searchRes = await this.searchIssues(true);
      if (searchRes.error) {
        return {
          ok: true,
          message: `账号认证成功 (${displayName})！但 JQL 查询提示: ${searchRes.error}`,
          count: 0
        };
      }

      return {
        ok: true,
        message: `连接成功！登录账号: ${displayName}，JQL 匹配到 ${searchRes.issues?.length || 0} 条事项`,
        count: searchRes.issues?.length || 0
      };
    } catch (err) {
      const errMsg = err.message || '';
      return {
        ok: false,
        message: `连接测试失败: ${sanitizeErrorMessage(errMsg)}`
      };
    }
  }

  /**
   * Internal Obsidian requestUrl executor.
   * @private
   */
  async _executeRequest(params) {
    if (typeof requestUrl === 'function') {
      try {
        const res = await requestUrl({ ...params, throw: false });
        const text = typeof res.text === 'string' ? res.text : '';
        let json = null;
        if (text && text.trim().length > 0) {
          try {
            json = JSON.parse(text);
          } catch (_) {
            json = null;
          }
        }
        return {
          status: res.status,
          text,
          json,
          headers: res.headers || {}
        };
      } catch (err) {
        if (err && typeof err.status === 'number') {
          const text = typeof err.text === 'string' ? err.text : '';
          let json = null;
          if (text && text.trim().length > 0) {
            try {
              json = JSON.parse(text);
            } catch (_) {
              json = null;
            }
          }
          return {
            status: err.status,
            text,
            json,
            headers: err.headers || {}
          };
        }
        throw err;
      }
    }
    // Node.js fallback for tests
    const https = params.url.startsWith('https') ? require('https') : require('http');
    const urlObj = new URL(params.url);

    return new Promise((resolve, reject) => {
      const req = https.request(urlObj, {
        method: params.method || 'GET',
        headers: params.headers || {}
      }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => text += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(text); } catch (_) {}
          resolve({
            status: res.statusCode,
            text,
            json,
            headers: res.headers
          });
        });
      });

      req.on('error', reject);
      if (params.body) req.write(params.body);
      req.end();
    });
  }

  /* ==========================================================================
     Agent 工具面能力 (工单详情 / 附件下载 / JQL 检索) — 供 Pi 扩展与 MCP 复用
     ========================================================================== */

  /**
   * Resolve config + token once for tool calls.
   * @returns {Promise<{config: JiraConfig, token: string}>}
   */
  async _resolveAuth() {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');
    return { config, token };
  }

  /**
   * Build shared auth headers for a Jira API call.
   * @private
   */
  _buildAuthHeaders(config, token, issueKey, extra) {
    const cleanBase = (config.baseUrl || '').trim().replace(/\/+$/, '');
    const headers = Object.assign({
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    }, extra || {});
    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey || '')}`;
    }
    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64((config.email || '') + ':' + token.trim())}`;
    } else if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
      headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
    } else {
      const user = (config.username || config.email || '').trim();
      headers['Authorization'] = (config.authType === 'basic' || user)
        ? `Basic ${safeBase64(user + ':' + token.trim())}`
        : `Bearer ${token.trim()}`;
    }
    return { headers, cleanBase, apiVersion: config.type === 'cloud' ? '3' : '2' };
  }

  /**
   * Vault base path. 优先级: Obsidian adapter > 插件目录推导 (<vault>/.obsidian/plugins/…) > cwd(若是 vault) > 显式 override。
   * MCP server / Pi extension 场景下 cwd 可能是插件目录或任意路径，插件安装位置才是可靠的 vault 锚点。
   * @private
   */
  _vaultPath() {
    const path = require('path');
    const fs = require('fs');
    const appBase = this.app?.vault?.adapter?.basePath;
    if (appBase) return appBase;
    try {
      const vaultFromPlugin = path.resolve(jiraResolvePluginDir(), '..', '..', '..');
      if (fs.existsSync(path.join(vaultFromPlugin, '.obsidian'))) return vaultFromPlugin;
    } catch (e) {}
    const cwd = process.cwd ? process.cwd() : '';
    if (cwd && fs.existsSync(path.join(cwd, '.obsidian'))) return cwd;
    return this.vaultBasePath || cwd;
  }

  /**
   * Per-issue artifact workspace under 00-Inbox/03-Quick-Note/<KEY>/
   * Logs go into attachments/, analysis products into the folder root.
   * @param {string} issueKey
   * @returns {{key: string, relDir: string, absDir: string, attachmentsDir: string}}
   */
  getIssueWorkspaceDir(issueKey) {
    const fs = require('fs');
    const path = require('path');
    const vault = this._vaultPath();
    const key = String(issueKey || 'UNKNOWN').trim().toUpperCase();
    const absDir = path.join(vault, '00-Inbox', '03-Quick-Note', key);
    const attachmentsDir = path.join(absDir, 'attachments');
    try { fs.mkdirSync(attachmentsDir, { recursive: true }); } catch (e) {}
    return {
      key,
      relDir: `00-Inbox/03-Quick-Note/${key}`,
      absDir,
      attachmentsDir,
      relAttachmentsDir: `00-Inbox/03-Quick-Note/${key}/attachments`
    };
  }

  /**
   * Custom JQL search (agent tool) — reuses configured auth, overrides only the JQL.
   * @param {string} jql
   * @param {number} [maxResults=30]
   * @returns {Promise<DashboardIssue[]>}
   */
  async searchIssuesByJql(jql, maxResults = 30) {
    const { config, token } = await this._resolveAuth();
    const cfg2 = Object.assign({}, config, { jql: (jql && jql.trim()) || config.jql || DEFAULT_JIRA_JQL });
    const issues = (config.type === 'datacenter')
      ? await this.searchDataCenterIssues(cfg2, token)
      : await this.searchCloudIssues(cfg2, token);
    return (issues || []).slice(0, Math.min(Math.max(1, maxResults | 0), 50));
  }

  /**
   * Fetch full issue detail incl. attachments and comments (agent tool).
   * @param {string} issueKey
   * @returns {Promise<object>}
   */
  async getIssueDetail(issueKey) {
    const { config, token } = await this._resolveAuth();
    const { headers, cleanBase, apiVersion } = this._buildAuthHeaders(config, token, issueKey);
    const fields = 'summary,status,priority,assignee,reporter,created,updated,description,components,labels,fixVersions,attachment,comment,resolution';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}?fields=${encodeURIComponent(fields)}`;

    const res = await this._executeRequest({ url, method: 'GET', headers });
    if (res.status !== 200) {
      let msg = `查询工单 ${issueKey} 失败 (HTTP ${res.status})`;
      try {
        const ej = res.json || (res.text ? JSON.parse(res.text) : null);
        if (ej?.errorMessages?.length) msg += `: ${ej.errorMessages.join('; ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    let data = res.json;
    if (!data && res.text) { try { data = JSON.parse(res.text); } catch (_) { data = {}; } }
    data = data || {};
    const f = data.fields || {};

    const base = this.normalizeIssue(data, cleanBase) || {};
    base.key = data.key || issueKey;
    base.labels = Array.isArray(f.labels) ? f.labels : [];
    base.fixVersions = Array.isArray(f.fixVersions) ? f.fixVersions.map(v => v.name || v) : [];
    base.resolution = f.resolution?.name || '';

    base.attachments = (Array.isArray(f.attachment) ? f.attachment : []).map(a => ({
      id: String(a.id || ''),
      filename: a.filename || `attachment-${a.id}`,
      size: a.size || 0,
      mimeType: a.mimeType || '',
      url: a.content || '',
      created: a.created || '',
      author: a.author?.displayName || a.author?.name || ''
    }));

    const rawComments = f.comment && Array.isArray(f.comment.comments) ? f.comment.comments : [];
    base.comments = rawComments.slice(-12).map(c => ({
      id: String(c.id || ''),
      author: c.author?.displayName || c.author?.name || '未知',
      created: c.created || '',
      body: this.parseCommentBody(c.body)
    }));
    base.commentCount = rawComments.length;

    return base;
  }

  /**
   * List only the attachments of an issue.
   * @param {string} issueKey
   */
  async listIssueAttachments(issueKey) {
    const detail = await this.getIssueDetail(issueKey);
    return detail.attachments || [];
  }

  /**
   * Download an issue attachment (log/screenshot/dump) into
   * 00-Inbox/03-Quick-Note/<KEY>/attachments/ and return the saved path.
   * @param {string} issueKey
   * @param {string} attachmentRef - attachment id, exact filename, or filename substring
   * @returns {Promise<{savedRelPath: string, savedAbsPath: string, filename: string, bytes: number}>}
   */
  async downloadAttachment(issueKey, attachmentRef) {
    if (!attachmentRef) throw new Error('缺少附件标识 (attachment_id 或 filename)');
    const { config, token } = await this._resolveAuth();
    const { headers, cleanBase } = this._buildAuthHeaders(config, token, issueKey);

    let target = null;
    const refStr = String(attachmentRef).trim();
    if (/^https?:\/\//i.test(refStr)) {
      target = { id: '', filename: refStr.split('/').pop().split('?')[0] || 'attachment.bin', url: refStr };
    } else {
      const detail = await this.getIssueDetail(issueKey);
      const atts = detail.attachments || [];
      target = atts.find(a => a.id === refStr)
        || atts.find(a => a.filename === refStr)
        || atts.find(a => a.filename.toLowerCase().includes(refStr.toLowerCase()));
      if (!target) {
        const names = atts.map(a => a.filename).join(', ') || '（无附件）';
        throw new Error(`工单 ${issueKey} 未找到附件 "${refStr}"。现有附件: ${names}`);
      }
    }

    if (!target.url) throw new Error(`附件 "${target.filename}" 缺少下载 URL`);
    if (!this.validateOrigin(target.url, cleanBase)) {
      throw new Error('附件 URL 与 Jira Base URL Origin 不一致，已阻止下载以保证凭据安全');
    }

    const buf = await this._downloadBinary(target.url, headers, cleanBase);

    const ws = this.getIssueWorkspaceDir(issueKey);
    const fs = require('fs');
    const path = require('path');
    let safeName = String(target.filename || 'attachment.bin')
      .replace(/[\\/:*?"<>|#^\[\]!]/g, '_')
      .replace(/\s+/g, '_')
      .trim() || 'attachment.bin';
    let destAbs = path.join(ws.attachmentsDir, safeName);
    let n = 1;
    while (fs.existsSync(destAbs)) {
      const dot = safeName.lastIndexOf('.');
      const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
      const ext = dot > 0 ? safeName.slice(dot) : '';
      destAbs = path.join(ws.attachmentsDir, `${stem}-${++n}${ext}`);
      safeName = `${stem}-${n}${ext}`;
    }
    fs.writeFileSync(destAbs, buf);

    return {
      filename: safeName,
      bytes: buf.length,
      savedAbsPath: destAbs,
      savedRelPath: `${ws.relAttachmentsDir}/${safeName}`,
      issueDir: ws.relDir
    };
  }

  /**
   * Binary GET with auth headers; follows same-origin redirects.
   * Prefers Obsidian requestUrl (arrayBuffer) then Node https/http.
   * @private
   */
  async _downloadBinary(url, headers, baseUrl, redirectsLeft = 3) {
    if (typeof requestUrl === 'function') {
      const res = await requestUrl({ url, method: 'GET', headers, throw: false });
      if (res.status >= 300 && res.status < 400 && res.headers?.location && redirectsLeft > 0) {
        const loc = new URL(res.headers.location, url).toString();
        const nextHeaders = this.validateOrigin(loc, baseUrl) ? headers : Object.assign({}, headers, { Authorization: undefined, Cookie: undefined });
        return this._downloadBinary(loc, nextHeaders, baseUrl, redirectsLeft - 1);
      }
      if (res.status !== 200) throw new Error(`附件下载失败 (HTTP ${res.status})`);
      return Buffer.from(res.arrayBuffer);
    }
    const mod = url.startsWith('https') ? require('https') : require('http');
    return new Promise((resolve, reject) => {
      const req = mod.request(url, { method: 'GET', headers }, (res) => {
        const loc = res.headers.location;
        if (res.statusCode >= 300 && res.statusCode < 400 && loc && redirectsLeft > 0) {
          res.resume();
          const nextUrl = new URL(loc, url).toString();
          const nextHeaders = this.validateOrigin(nextUrl, baseUrl) ? headers : Object.assign({}, headers, { Authorization: undefined, Cookie: undefined });
          this._downloadBinary(nextUrl, nextHeaders, baseUrl, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`附件下载失败 (HTTP ${res.statusCode})`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.end();
    });
  }
}

/* ==========================================================================
   Jira Agent 工具契约 (MCP inputSchema / Pi extension parameters 共用一份描述)
   ========================================================================== */
const JIRA_TOOLS = [
  {
    name: 'jira_search_issues',
    description: '在公司 Jira 系统中检索缺陷/任务工单。query 支持：工单号直达（如 SPE123-199）、关键词模糊检索（自动包装 text ~ "kw"）、或直接传完整 JQL 表达式（含 = / ~ / AND 等操作符时按 JQL 解析）。返回工单号/标题/状态/经办人/优先级清单。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '工单号 (如 SPE123-199)、关键词 (如 "快充 不工作") 或完整 JQL' },
        limit: { type: 'number', description: '最大返回数量，默认 20，最多 50' }
      }
    }
  },
  {
    name: 'jira_get_issue',
    description: '查阅指定 Jira 工单完整详情：标题、状态、经办人/报告人、优先级、模块组件、标签、修复版本、解决结果、完整描述、最近 12 条注释、附件清单，以及该工单在知识库的专属工作目录 (00-Inbox/03-Quick-Note/<KEY>/)。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string', description: 'Jira 工单号 (如 SPE123-199)' }
      },
      required: ['issue_key']
    }
  },
  {
    name: 'jira_get_comments',
    description: '查阅指定 Jira 工单的全部历史注释/讨论记录（含作者与时间）。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string', description: 'Jira 工单号' }
      },
      required: ['issue_key']
    }
  },
  {
    name: 'jira_list_attachments',
    description: '列出指定 Jira 工单挂载的全部附件（文件名/大小/类型/上传人），用于定位 log 日志、截图、抓包文件。只读工具。',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string', description: 'Jira 工单号' }
      },
      required: ['issue_key']
    }
  },
  {
    name: 'jira_download_attachment',
    description: '下载指定 Jira 工单的附件（log/截图/抓包/复现视频等）到知识库目录 00-Inbox/03-Quick-Note/<KEY>/attachments/ 下，返回本地绝对路径；下载后用 read/grep 等工具对日志进行分析。attachment 参数支持附件 id、完整文件名或文件名片段。',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string', description: 'Jira 工单号' },
        attachment: { type: 'string', description: '附件 id、完整文件名或文件名片段（如 "logcat" / "main.log" / "12893"）' }
      },
      required: ['issue_key', 'attachment']
    }
  }
];

function _jiraFmtIssueList(issues, jql) {
  if (!issues || issues.length === 0) return `未检索到匹配的 Jira 工单 (JQL: ${jql || '默认'})`;
  const lines = [`### Jira 工单清单 (共 ${issues.length} 条):`, ''];
  issues.forEach((i, idx) => {
    lines.push(`${idx + 1}. **\`${i.key}\`** [${i.status} · ${i.priority}] ${i.summary}`);
    lines.push(`   经办人: ${i.assignee} | 报告人: ${i.reporter} | 更新: ${i.updated || '未知'} | ${i.url}`);
  });
  return lines.join('\n');
}

function _jiraFmtIssueDetail(d, ws) {
  const lines = [
    `### 🎫 Jira 工单 ${d.key}`,
    '',
    `- **标题**: ${d.summary}`,
    `- **状态**: ${d.status}${d.resolution ? ` (解决结果: ${d.resolution})` : ''} | **优先级**: ${d.priority}`,
    `- **经办人**: ${d.assignee} | **报告人**: ${d.reporter}`,
    `- **创建**: ${d.created || d.rawCreated || '未知'} | **更新**: ${d.updated || d.rawUpdated || '未知'}`,
    `- **模块组件**: ${(d.components || []).join(', ') || '无'} | **标签**: ${(d.labels || []).join(', ') || '无'}${d.fixVersions?.length ? ` | **修复版本**: ${d.fixVersions.join(', ')}` : ''}`,
    `- **链接**: ${d.url}`,
    `- **工作目录**: ${ws.relDir}/ （附件下载到 attachments/ 子目录，分析报告请写入该目录根级）`,
    '',
    '#### 描述',
    d.description && d.description.trim() ? d.description.trim() : '*(无描述)*',
    ''
  ];
  lines.push(`#### 附件 (共 ${d.attachments.length} 个)`);
  if (d.attachments.length === 0) {
    lines.push('*(无附件)*');
  } else {
    d.attachments.forEach(a => {
      const kb = a.size > 1024 * 1024 ? `${(a.size / 1048576).toFixed(1)}MB` : `${Math.ceil(a.size / 1024)}KB`;
      lines.push(`- \`${a.id}\` **${a.filename}** (${kb}${a.mimeType ? ', ' + a.mimeType : ''}) — 上传人: ${a.author || '未知'}`);
    });
    lines.push('> 下载附件: jira_download_attachment(issue_key, attachment="文件名或id")');
  }
  lines.push('', `#### 最近注释 (共 ${d.commentCount} 条, 显示最近 ${Math.min(d.comments.length, 12)} 条)`);
  if (d.comments.length === 0) {
    lines.push('*(无注释)*');
  } else {
    d.comments.forEach(c => {
      lines.push(`- **${c.author}** (${(c.created || '').slice(0, 16).replace('T', ' ')}):`);
      lines.push(`  ${(c.body || '').split('\n').join('\n  ')}`);
    });
  }
  return lines.join('\n');
}

function _jiraFmtAttachments(atts, issueKey) {
  if (!atts || atts.length === 0) return `工单 ${issueKey} 无附件。`;
  const lines = [`### 工单 ${issueKey} 附件清单 (共 ${atts.length} 个):`, ''];
  atts.forEach((a, idx) => {
    const kb = a.size > 1024 * 1024 ? `${(a.size / 1048576).toFixed(1)}MB` : `${Math.ceil(a.size / 1024)}KB`;
    lines.push(`${idx + 1}. **${a.filename}** — id=\`${a.id}\`, ${kb}${a.mimeType ? ', ' + a.mimeType : ''}, 上传人: ${a.author || '未知'}, ${(a.created || '').slice(0, 10)}`);
  });
  return lines.join('\n');
}

async function runJiraTool(name, args, service) {
  args = args || {};
  const svc = service || new JiraService();

  switch (name) {
    case 'jira_search_issues': {
      const q = String(args.query || args.q || '').trim();
      const limit = args.limit || 20;
      let jql;
      if (!q) {
        jql = undefined; // use configured default
      } else if (/^[A-Za-z][A-Za-z0-9_]+-\d+$/.test(q)) {
        jql = `key = ${q.toUpperCase()}`;
      } else if (/[=~]|\bAND\b|\bOR\b|\bORDER BY\b/i.test(q)) {
        jql = q; // already a JQL expression
      } else {
        jql = `text ~ "${q.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
      }
      const issues = await svc.searchIssuesByJql(jql, limit);
      return _jiraFmtIssueList(issues, jql);
    }
    case 'jira_get_issue': {
      const key = String(args.issue_key || args.key || '').trim().toUpperCase();
      if (!key) throw new Error('缺少 issue_key 参数');
      const d = await svc.getIssueDetail(key);
      const ws = svc.getIssueWorkspaceDir(key);
      return _jiraFmtIssueDetail(d, ws);
    }
    case 'jira_get_comments': {
      const key = String(args.issue_key || args.key || '').trim().toUpperCase();
      if (!key) throw new Error('缺少 issue_key 参数');
      const comments = await svc.getIssueComments(key);
      if (!comments || comments.length === 0) return `工单 ${key} 无注释记录。`;
      const lines = [`### 工单 ${key} 注释 (共 ${comments.length} 条):`, ''];
      comments.forEach(c => {
        lines.push(`- **${c.author}** (${c.createdFormatted || c.created})${c.isEdited ? ' *(已编辑)*' : ''}:`);
        lines.push(`  ${(c.body || '').split('\n').join('\n  ')}`);
      });
      return lines.join('\n');
    }
    case 'jira_list_attachments': {
      const key = String(args.issue_key || args.key || '').trim().toUpperCase();
      if (!key) throw new Error('缺少 issue_key 参数');
      const atts = await svc.listIssueAttachments(key);
      return _jiraFmtAttachments(atts, key);
    }
    case 'jira_download_attachment': {
      const key = String(args.issue_key || args.key || '').trim().toUpperCase();
      if (!key) throw new Error('缺少 issue_key 参数');
      const ref = args.attachment || args.attachment_id || args.filename;
      const r = await svc.downloadAttachment(key, ref);
      const ws = svc.getIssueWorkspaceDir(key);
      return [
        `✓ 附件已下载: **${r.filename}** (${(r.bytes / 1024).toFixed(1)} KB)`,
        `- 本地绝对路径: \`${r.savedAbsPath}\``,
        `- 知识库相对路径: \`${r.savedRelPath}\``,
        `- 工单工作目录: \`${ws.relDir}/\`（分析结论/报告请写入此目录根级，日志文件保持在 attachments/ 内）`
      ].join('\n');
    }
    default:
      throw new Error(`未知的 Jira 工具: ${name}`);
  }
}

/**
 * Format date to clean relative string (e.g. 5分钟前, 2小时前, 昨天).
 * @param {Date} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 3) return `${Math.floor(diffSec / 86400)} 天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * Sanitize error message to prevent URL query parameters or token leak.
 * @param {string} msg
 * @returns {string}
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return '请求异常';
  return String(msg)
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi, '$1 ***')
    .replace(/[a-zA-Z0-9_-]{24,}/g, '***');
}

module.exports = {
  JiraService,
  JIRA_TOOLS,
  runJiraTool,
  jiraLoadConfig,
  jiraReadSecret,
  jiraResolvePluginDir,
  DEFAULT_JIRA_JQL,
  formatRelativeTime,
  sanitizeErrorMessage,
  safeBase64
};
