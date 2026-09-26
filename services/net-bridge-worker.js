/**
 * TabonKB Intranet Network Bridge Worker
 * Standalone Node.js worker process invoked when Electron/Obsidian renderer network stack
 * is blocked by Windows Filtering Platform / EDR / antivirus (ERR_NETWORK_ACCESS_DENIED / EACCES).
 * Reads JSON request from stdin, executes HTTP(S) request via standard Node network stack,
 * and writes JSON response to stdout.
 */
const http = require('http');
const https = require('https');

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
});

process.stdin.on('end', () => {
  try {
    const options = JSON.parse(buffer || '{}');
    const urlStr = options.url;
    if (!urlStr) {
      process.stdout.write(JSON.stringify({ error: 'Missing url in worker request' }));
      process.exit(1);
    }

    const urlObj = new URL(urlStr);
    const client = urlObj.protocol === 'https:' ? https : http;
    const timeout = options.timeout || 15000;

    const req = client.request(urlObj, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        const out = {
          status: res.statusCode,
          headers: res.headers,
          body
        };
        process.stdout.write(JSON.stringify(out));
        process.exit(0);
      });
    });

    req.on('error', (err) => {
      process.stdout.write(JSON.stringify({ error: err.message }));
      process.exit(1);
    });

    req.on('timeout', () => {
      req.destroy();
      process.stdout.write(JSON.stringify({ error: `Request timeout (${timeout}ms)` }));
      process.exit(1);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
});
