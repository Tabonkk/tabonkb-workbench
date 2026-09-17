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

const DEFAULT_JIRA_JQL = '(assignee = currentUser() OR watcher = currentUser()) AND resolution = Unresolved ORDER BY updated DESC';

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

class JiraService {
  /**
   * @param {Object} options
   * @param {any} options.app - Obsidian App instance
   * @param {() => JiraConfig} options.getConfig - Getter for JiraConfig
   */
  constructor(options) {
    this.app = options.app;
    this.getConfig = options.getConfig;

    // In-memory cache: { issues: DashboardIssue[], lastUpdated: number, isStale: boolean }
    this._cache = null;
    this._cacheTtlMs = 5 * 60 * 1000; // 5 minutes

    // In-memory credential fallback (in case Obsidian version does not support secretStorage)
    this._memorySecret = null;
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
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretKey]) return data[secretKey];
        }
      }
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
      maxResults: 25,
      fields: ['summary', 'status', 'priority', 'assignee', 'updated']
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
        const errJson = JSON.parse(response.text);
        if (errJson.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Cloud 查询失败 (HTTP ${response.status})`);
    }

    const data = JSON.parse(response.text);
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

    // Primary attempt: GET /rest/api/2/search
    // In Electron, GET avoids Jira Server CSRF / XSRF origin check failure (Status 403)
    const getUrl = `${cleanBaseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=0&maxResults=25&fields=summary,status,priority,assignee,updated`;
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
        maxResults: 25,
        fields: ['summary', 'status', 'priority', 'assignee', 'updated']
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
        const errJson = JSON.parse(response.text);
        if (errJson.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Data Center 查询失败 (HTTP ${response.status})`);
    }

    const data = JSON.parse(response.text);
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
    const status = fields.status?.name || '未知';
    const priority = fields.priority?.name || 'Medium';

    let assignee = '未指派';
    if (fields.assignee) {
      assignee = fields.assignee.displayName || fields.assignee.name || '已指派';
    }

    let updated = '';
    if (fields.updated) {
      try {
        const d = new Date(fields.updated);
        if (!isNaN(d.getTime())) {
          updated = formatRelativeTime(d);
        }
      } catch (e) {}
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/browse/${encodeURIComponent(key)}`;

    return {
      key,
      summary,
      status,
      priority,
      assignee,
      updated,
      url
    };
  }

  /**
   * Public search entrypoint with in-memory caching and stale-while-error fallback.
   * Does NOT accept arbitrary URLs from caller.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ issues: DashboardIssue[], lastUpdated: number, isStale: boolean, error?: string }>}
   */
  async searchIssues(forceRefresh = false) {
    const now = Date.now();

    // 1. Check in-memory fresh cache
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

      let userData = {};
      try { userData = JSON.parse(myselfRes.text); } catch (e) {}
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
        return await requestUrl(params);
      } catch (err) {
        if (err && typeof err.status === 'number') {
          return {
            status: err.status,
            text: err.text || '',
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
          resolve({
            status: res.statusCode,
            text,
            headers: res.headers
          });
        });
      });

      req.on('error', reject);
      if (params.body) req.write(params.body);
      req.end();
    });
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
  DEFAULT_JIRA_JQL,
  formatRelativeTime,
  sanitizeErrorMessage,
  safeBase64
};
