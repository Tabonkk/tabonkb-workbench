/**
 * @typedef {Object} RssFeedConfig
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} FeedItem
 * @property {string} feedId
 * @property {string} feedName
 * @property {string} title
 * @property {string} link
 * @property {Date} [publishedAt]
 * @property {string} [description]
 */

const DEFAULT_FEEDS = [
  {
    id: 'bootlin',
    name: 'Bootlin (嵌入式内核驱动)',
    url: 'https://bootlin.com/feed/',
    category: 'kernel',
    enabled: true
  },
  {
    id: 'cnx-software',
    name: 'CNX Software (芯片与嵌入式硬件)',
    url: 'https://www.cnx-software.com/feed/',
    category: 'kernel',
    enabled: true
  },
  {
    id: 'phoronix',
    name: 'Phoronix (Linux 内核与硬件评测)',
    url: 'https://www.phoronix.com/rss.php',
    category: 'kernel',
    enabled: true
  },
  {
    id: 'lwn',
    name: 'LWN Kernel (Linux 内核前沿)',
    url: 'https://lwn.net/headlines/rss',
    category: 'kernel',
    enabled: true
  },
  {
    id: 'android-dev',
    name: 'Android Developers (官方演进)',
    url: 'https://android-developers.googleblog.com/feeds/posts/default',
    category: 'kernel',
    enabled: true
  },
  {
    id: 'embedded-artistry',
    name: 'Embedded Artistry (嵌入式架构)',
    url: 'https://embeddedartistry.com/feed/',
    category: 'kernel',
    enabled: true
  },
  {
    id: 'huggingface',
    name: 'Hugging Face (端侧模型与开源AI)',
    url: 'https://huggingface.co/blog/feed.xml',
    category: 'ai',
    enabled: true
  },
  {
    id: 'openai',
    name: 'OpenAI News (AI 前沿研究)',
    url: 'https://openai.com/news/rss.xml',
    category: 'ai',
    enabled: true
  },
  {
    id: 'simonwillison',
    name: 'Simon Willison (AI 应用实战)',
    url: 'https://simonwillison.net/atom/everything/',
    category: 'ai',
    enabled: true
  },
  {
    id: 'github-blog',
    name: 'GitHub Engineering (AI 辅助工程)',
    url: 'https://github.blog/feed/',
    category: 'ai',
    enabled: true
  }
];

class RssService {
  /**
   * @param {Object} options
   * @param {any} options.app - Obsidian App instance
   * @param {() => RssFeedConfig[]} options.getFeeds - Getter for configured feeds
   */
  constructor(options) {
    this.app = options.app;
    this.getFeeds = options.getFeeds || (() => DEFAULT_FEEDS);

    // In-memory cache: { items: FeedItem[], lastUpdated: number, isStale: boolean }
    this._cache = null;
    this._cacheTtlMs = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Strictly validate URL protocol. Only http: and https: allowed.
   * Rejects javascript:, data:, file:, obsidian:, etc.
   * @param {string} urlStr
   * @returns {boolean}
   */
  validateUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const trimmed = urlStr.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('file:') || trimmed.startsWith('obsidian:')) {
      return false;
    }
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract safe, clean plain text from raw HTML content.
   * Strips all tags, scripts, styles, decode HTML entities, and truncates to maxLen.
   * @param {string} rawHtml
   * @param {number} [maxLen=120]
   * @returns {string}
   */
  cleanHtmlToText(rawHtml, maxLen = 120) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        // Remove style and script tags before parsing text
        const sanitizedInput = rawHtml
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        const doc = parser.parseFromString(sanitizedInput, 'text/html');
        const text = (doc.body.textContent || doc.body.innerText || '').trim();
        const collapsed = text.replace(/\s+/g, ' ');
        if (collapsed.length <= maxLen) return collapsed;
        return collapsed.slice(0, maxLen) + '...';
      }
    } catch (e) {}

    // Fallback regex tag stripper
    const stripped = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (stripped.length <= maxLen) return stripped;
    return stripped.slice(0, maxLen) + '...';
  }

  /**
   * Parse XML text supporting both RSS 2.0 and Atom feeds.
   * @param {string} xmlText
   * @param {RssFeedConfig} feedConfig
   * @returns {FeedItem[]}
   */
  parseFeedXml(xmlText, feedConfig) {
    if (!xmlText || typeof xmlText !== 'string') return [];

    let doc;
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      doc = parser.parseFromString(xmlText, 'application/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        // Retry with text/xml or text/html
        doc = parser.parseFromString(xmlText, 'text/xml');
      }
    } else {
      throw new Error('DOMParser 未在当前运行环境中找到');
    }

    const items = [];

    // 1. Try RSS 2.0 (<channel> -> <item>)
    const rssItems = doc.querySelectorAll('channel > item, item');
    if (rssItems && rssItems.length > 0) {
      rssItems.forEach(el => {
        const titleEl = el.querySelector('title');
        const linkEl = el.querySelector('link');
        const pubDateEl = el.querySelector('pubDate, date, dc\\:date');
        const descEl = el.querySelector('description, summary, content, content\\:encoded');

        const title = (titleEl?.textContent || '').trim() || '（无标题）';
        const rawLink = (linkEl?.textContent || linkEl?.getAttribute('href') || '').trim();
        const safeLink = this.validateUrl(rawLink) ? rawLink : '';

        let publishedAt = null;
        if (pubDateEl?.textContent) {
          try {
            const d = new Date(pubDateEl.textContent.trim());
            if (!isNaN(d.getTime())) publishedAt = d;
          } catch (e) {}
        }

        const rawDesc = descEl?.textContent || '';
        const cleanDesc = this.cleanHtmlToText(rawDesc, 120);

        items.push({
          feedId: feedConfig.id,
          feedName: feedConfig.name,
          category: feedConfig.category || 'kernel',
          title,
          link: safeLink,
          publishedAt: publishedAt || new Date(),
          description: cleanDesc
        });
      });
      return items;
    }

    // 2. Try Atom (<feed> -> <entry>)
    const atomEntries = doc.querySelectorAll('feed > entry, entry');
    if (atomEntries && atomEntries.length > 0) {
      atomEntries.forEach(el => {
        const titleEl = el.querySelector('title');
        const linkEl = el.querySelector('link[rel="alternate"]') || el.querySelector('link');
        const updatedEl = el.querySelector('updated, published, pubDate');
        const summaryEl = el.querySelector('summary, content');

        const title = (titleEl?.textContent || '').trim() || '（无标题）';
        const rawLink = (linkEl?.getAttribute('href') || linkEl?.textContent || '').trim();
        const safeLink = this.validateUrl(rawLink) ? rawLink : '';

        let publishedAt = null;
        if (updatedEl?.textContent) {
          try {
            const d = new Date(updatedEl.textContent.trim());
            if (!isNaN(d.getTime())) publishedAt = d;
          } catch (e) {}
        }

        const rawDesc = summaryEl?.textContent || '';
        const cleanDesc = this.cleanHtmlToText(rawDesc, 120);

        items.push({
          feedId: feedConfig.id,
          feedName: feedConfig.name,
          category: feedConfig.category || 'kernel',
          title,
          link: safeLink,
          publishedAt: publishedAt || new Date(),
          description: cleanDesc
        });
      });
      return items;
    }

    return items;
  }

  /**
   * Fetch a single feed via Obsidian requestUrl without any Jira credentials.
   * @param {RssFeedConfig} feedConfig
   * @returns {Promise<FeedItem[]>}
   */
  async fetchFeed(feedConfig) {
    if (!this.validateUrl(feedConfig.url)) {
      throw new Error(`Feed URL 无效或协议不受支持 (仅允许 http/https): ${feedConfig.url}`);
    }

    const response = await this._executeRequest({
      url: feedConfig.url,
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`获取 Feed 失败: ${feedConfig.name} (HTTP ${response.status})`);
    }

    return this.parseFeedXml(response.text, feedConfig);
  }

  /**
   * Fetch all enabled feeds, merge items, sort by publishedAt desc, and update cache.
   * Supports Stale-While-Error fallback.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ items: FeedItem[], feeds: RssFeedConfig[], lastUpdated: number, isStale: boolean, error?: string }>}
   */
  async fetchAllFeeds(forceRefresh = false) {
    const now = Date.now();
    const allFeeds = typeof this.getFeeds === 'function' ? this.getFeeds() : DEFAULT_FEEDS;
    const enabledFeeds = allFeeds.filter(f => f.enabled !== false);

    // 1. Check in-memory fresh cache
    if (!forceRefresh && this._cache && (now - this._cache.lastUpdated < this._cacheTtlMs)) {
      return {
        items: this._cache.items,
        feeds: allFeeds,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    }

    if (enabledFeeds.length === 0) {
      return {
        items: [],
        feeds: allFeeds,
        lastUpdated: this._cache?.lastUpdated || now,
        isStale: false,
        error: '未启用任何 RSS 订阅源，请在工作台设置中添加或启用'
      };
    }

    try {
      const errors = [];
      const fetchPromises = enabledFeeds.map(async (feed) => {
        try {
          return await this.fetchFeed(feed);
        } catch (e) {
          console.warn(`[RssService] 获取源 [${feed.name}] 失败:`, e.message);
          errors.push(`${feed.name}: ${e.message}`);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const merged = results.flat();

      // Sort all items descending by publish date
      merged.sort((a, b) => {
        const timeA = a.publishedAt ? a.publishedAt.getTime() : 0;
        const timeB = b.publishedAt ? b.publishedAt.getTime() : 0;
        return timeB - timeA;
      });

      if (merged.length === 0 && this._cache && this._cache.items.length > 0) {
        // Network failed to yield any items but we have stale cache
        const errDetail = errors.length > 0 ? errors.join('; ') : '网络异常';
        return {
          items: this._cache.items,
          feeds: allFeeds,
          lastUpdated: this._cache.lastUpdated,
          isStale: true,
          error: `全部 RSS 源拉取失败 (${errDetail})，正在显示上次缓存`
        };
      }

      // Update fresh cache
      this._cache = {
        items: merged,
        lastUpdated: Date.now(),
        isStale: false
      };

      return {
        items: merged,
        feeds: allFeeds,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    } catch (err) {
      // Stale-While-Error fallback
      if (this._cache && this._cache.items && this._cache.items.length > 0) {
        return {
          items: this._cache.items,
          feeds: allFeeds,
          lastUpdated: this._cache.lastUpdated,
          isStale: true,
          error: `更新失败: ${err.message || '网络异常'}，正在显示历史缓存`
        };
      }

      return {
        items: [],
        feeds: allFeeds,
        lastUpdated: now,
        isStale: false,
        error: `RSS 拉取异常: ${err.message || '网络异常'}`
      };
    }
  }

  /**
   * Internal Obsidian requestUrl executor.
   * @private
   */
  async _executeRequest(params) {
    if (typeof requestUrl === 'function') {
      return await requestUrl(params);
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
      req.end();
    });
  }
}

module.exports = {
  RssService,
  DEFAULT_FEEDS
};
