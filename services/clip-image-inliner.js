/**
 * ClipImageInliner — 剪藏笔记落地后，把 http(s) 图片转成 data URL。
 * 官方 Web Clipper 模板无法在扩展里 fetch+base64；本模块在 Vault 侧补这一步，
 * 使 WeKnora 能按 Data URL 路径做多模态解析。
 *
 * 约束对齐 WeKnora image_resolver：单图 ≤ 10MB，单篇最多 30 张。
 */
const { Notice, requestUrl } = require('obsidian');

const DEFAULT_CLIP_INLINER = {
  enabled: true,
  folderPrefix: '00-Inbox/',
  maxImages: 30,
  maxBytes: 10 * 1024 * 1024,
  minBytes: 2048,
  debounceMs: 1200
};

const MD_IMG_RE = /!\[([^\]]*)\]\((<)?((?:https?:)?\/\/[^)\s>]+)(>)?\)/gi;
const HTML_IMG_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(?!data:)((?:https?:)?\/\/[^"']+)\2/gi;
const FRONTMATTER_URL_RE = /^url:\s*["']?(\S+?)["']?\s*$/m;

function looksLikeImageMagic(buf) {
  if (!buf || buf.byteLength < 12) return '';
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image/png';
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg';
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'image/gif';
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
      u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) return 'image/webp';
  return '';
}

function toBase64(arrayBuffer) {
  if (typeof Buffer !== 'undefined') return Buffer.from(arrayBuffer).toString('base64');
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function absolutize(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  return url;
}

function collectRemoteUrls(markdown) {
  const urls = [];
  const seen = new Set();
  const add = (raw) => {
    if (!raw || raw.startsWith('data:')) return;
    const fetchUrl = absolutize(raw);
    if (!/^https?:\/\//i.test(fetchUrl)) return;
    if (seen.has(fetchUrl)) return;
    seen.add(fetchUrl);
    urls.push({ raw, fetchUrl });
  };
  markdown.replace(MD_IMG_RE, (_m, _alt, _lt, src) => { add(src); return _m; });
  markdown.replace(HTML_IMG_RE, (_m, _pre, _q, src) => { add(src); return _m; });
  return urls;
}

function replaceUrl(markdown, from, dataUrl) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const protoLess = from.replace(/^https?:/i, '');
  const re = new RegExp(
    '("|\')(' + escaped + '|' + protoLess.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\1' +
    '|' + escaped + '|' + protoLess.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'gi'
  );
  return markdown.replace(re, (m, quote) => (quote ? quote + dataUrl + quote : dataUrl));
}

class ClipImageInliner {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this._timers = new Map();
    this._busy = new Set();
  }

  cfg() {
    return Object.assign({}, DEFAULT_CLIP_INLINER, this.plugin.settings?.clipInliner || {});
  }

  start() {
    this._statusEl = this.plugin.addStatusBarItem();
    this._statusEl.addClass('mod-clickable');
    this._statusEl.setText('');
    this.plugin.registerEvent(this.app.vault.on('create', (file) => this.schedule(file)));
    this.plugin.registerEvent(this.app.vault.on('modify', (file) => this.schedule(file)));
    this.plugin.addCommand({
      id: 'tabonkb-inline-clip-images',
      name: '把当前笔记的外链图片转为 Data URL',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.processFile(file, { force: true });
        return true;
      }
    });
  }

  isTarget(file, force) {
    if (!file || file.extension !== 'md') return false;
    if (force) return true;
    const cfg = this.cfg();
    if (!cfg.enabled) return false;
    const prefix = cfg.folderPrefix || '00-Inbox/';
    return file.path.replace(/\\/g, '/').startsWith(prefix);
  }

  schedule(file) {
    if (!this.isTarget(file, false)) return;
    const prev = this._timers.get(file.path);
    if (prev) clearTimeout(prev);
    const wait = this.cfg().debounceMs || 1200;
    const t = setTimeout(() => {
      this._timers.delete(file.path);
      this.processFile(file, { force: false }).catch((err) => {
        console.warn('[ClipImageInliner]', file.path, err);
      });
    }, wait);
    this._timers.set(file.path, t);
  }

  async processFile(file, opts) {
    const force = !!(opts && opts.force);
    if (!this.isTarget(file, force)) return 0;
    if (this._busy.has(file.path)) return 0;
    this._busy.add(file.path);
    try {
      const md = await this.app.vault.read(file);
      const remote = collectRemoteUrls(md);
      if (!remote.length) {
        if (force) new Notice('没有可转换的外链图片（已是 Data URL 或文中无图）');
        return 0;
      }
      const cfg = this.cfg();
      const cap = Math.min(cfg.maxImages || 30, remote.length);
      const overflow = remote.length - cap;
      const referer = this._referer(md);
      const mapping = new Map();
      let converted = 0;
      let failed = 0;
      const name = file.basename || file.name;
      new Notice(`剪藏图片：开始转换「${name}」共 ${cap} 张`, 4000);
      this._setStatus(`剪藏图片 0/${cap}`);
      for (let i = 0; i < cap; i++) {
        const item = remote[i];
        this._setStatus(`剪藏图片 ${i + 1}/${cap}`);
        const dataUrl = await this._fetchAsDataUrl(item.fetchUrl, referer, cfg);
        if (!dataUrl) { failed++; continue; }
        mapping.set(item.raw, dataUrl);
        converted++;
      }
      if (converted) {
        let next = md;
        for (const [url, dataUrl] of mapping) next = replaceUrl(next, url, dataUrl);
        if (next !== md) await this.app.vault.modify(file, next);
      }
      const extra = overflow > 0 ? `，超出上限 ${overflow} 张未处理` : '';
      new Notice(`剪藏图片：成功 ${converted}，失败 ${failed}${extra}`, failed ? 8000 : 5000);
      this._setStatus(failed ? `剪藏图片 失败 ${failed}` : '');
      if (!failed && this._statusEl) {
        setTimeout(() => { if (this._statusEl) this._statusEl.setText(''); }, 4000);
      }
      return converted;
    } finally {
      this._busy.delete(file.path);
    }
  }

  _setStatus(text) {
    if (!this._statusEl) return;
    this._statusEl.setText(text ? '🖼 ' + text : '');
  }

  _referer(md) {
    const m = md.match(FRONTMATTER_URL_RE);
    if (m) return m[1];
    const link = md.match(/https?:\/\/[^\s)>"']+/);
    return link ? link[0] : '';
  }

  async _fetchAsDataUrl(url, referer, cfg) {
    try {
      const headers = {
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 TabonKB-ClipInliner'
      };
      if (referer) {
        try { headers.Referer = new URL(referer).origin + '/'; } catch (e) {}
      }
      const res = await requestUrl({ url, method: 'GET', headers, throw: false });
      if (!res || res.status >= 400) return null;
      const buf = res.arrayBuffer;
      if (!buf || buf.byteLength < (cfg.minBytes || 0)) return null;
      if (buf.byteLength > (cfg.maxBytes || 10 * 1024 * 1024)) return null;
      let mime = '';
      const ct = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '';
      if (typeof ct === 'string' && ct.toLowerCase().startsWith('image/')) {
        mime = ct.split(';')[0].trim().toLowerCase();
      }
      if (!mime) mime = looksLikeImageMagic(buf);
      if (!mime || !mime.startsWith('image/')) return null;
      if (mime === 'image/svg+xml') return null;
      return `data:${mime};base64,${toBase64(buf)}`;
    } catch (err) {
      console.warn('[ClipImageInliner] fetch failed', url, err);
      return null;
    }
  }
}

module.exports = { ClipImageInliner, DEFAULT_CLIP_INLINER, collectRemoteUrls };
