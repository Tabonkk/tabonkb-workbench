// 临时探针2: eservice.mediatek.com 会话获取路径 (用完即删)
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const secret = JSON.parse(fs.readFileSync(path.join(BASE, '.secrets.json'), 'utf8'))['tabonkb-mtk-password'];
const allCookies = secret.split(';').map(s => s.trim()).filter(Boolean);
const out = [];
const log = (...a) => { out.push(a.join(' ')); };

log('[D] cookie names in synced string:', allCookies.map(c => c.split('=')[0]).join(', '));

function req(method, url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : null;
    const r = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search, method,
      rejectUnauthorized: false,
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }, opts.cookie ? { 'Cookie': opts.cookie } : {}, opts.referer ? { 'Referer': opts.referer } : {}, postData ? {
        'Content-Type': opts.contentType || 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      } : {})
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    });
    r.on('error', reject);
    if (postData) r.write(postData);
    r.end();
  });
}

(async () => {
  const molCookie = allCookies.map(c => c.split(';')[0]).join('; ');

  // E1: 全量 cookie 打 ES 登录页 / 工单页
  for (const url of [
    'https://eservice.mediatek.com/eservice-portal/login',
    'https://eservice.mediatek.com/eservice-portal/issue_manager/update/142846061'
  ]) {
    const r = await req('GET', url, { cookie: molCookie });
    log(`[E1] GET ${url} (MOL cookies) -> ${r.status} loc=${r.headers.location || '-'} len=${r.body.length}`);
  }

  // E2: 不带 cookie 打登录页, 看登录机制 (表单/SSO)
  const lp = await req('GET', 'https://eservice.mediatek.com/eservice-portal/login', {});
  log(`[E2] GET login (no cookie) -> ${lp.status} loc=${lp.headers.location || '-'} len=${lp.body.length} ctype=${lp.headers['content-type'] || ''}`);
  log('[E2] set-cookie:', (lp.headers['set-cookie'] || []).join(' | ').slice(0, 300));
  const forms = lp.body.match(/<form[\s\S]{0,400}?>/gi) || [];
  forms.forEach((f, i) => log(`[E2] form#${i}:`, f.replace(/\s+/g, ' ').slice(0, 300)));
  const inputs = lp.body.match(/<input[^>]*>/gi) || [];
  inputs.forEach((f, i) => log(`[E2] input#${i}:`, f.replace(/\s+/g, ' ').slice(0, 200)));
  for (const m of ['sso', 'SSO', 'cas', 'CAS', 'oauth', 'OAuth', 'mediatek.com/login', 'molauth', '_MOLAuth', 'ldap']) {
    const i = lp.body.indexOf(m);
    if (i >= 0) log(`[E2] marker "${m}" @${i}:`, lp.body.slice(Math.max(0, i - 120), i + 200).replace(/\s+/g, ' '));
  }
  log('[E2] scripts:', (lp.body.match(/<script[^>]*src="[^"]+"/gi) || []).join(' | ').slice(0, 500));
  log('[E2] body head 600:', lp.body.slice(0, 600).replace(/\s+/g, ' '));

  fs.writeFileSync(path.join(BASE, '_probe_out.txt'), out.join('\n'), 'utf8');
  console.log('probe2 done, lines=' + out.length);
})().catch(e => { fs.writeFileSync(path.join(BASE, '_probe_out.txt'), out.join('\n') + '\nFATAL ' + e.message, 'utf8'); console.log('FATAL', e.message); });
