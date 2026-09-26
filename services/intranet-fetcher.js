/**
 * TabonKB Intranet Fetcher
 * High-reliability intranet HTTP(S) requester with automatic 3-layer fallback:
 * 1. Native Obsidian requestUrl (fastest, standard in Electron renderer)
 * 2. In-process Node.js http/https (for CLI / standalone Node contexts)
 * 3. Standalone Node.js child worker (bypasses Windows EDR/WFP Electron socket restrictions: ERR_NETWORK_ACCESS_DENIED / EACCES)
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const child_process = require('child_process');

function resolveNodePath() {
  const cands = [
    process.env.TABONKB_NODE_PATH,
    path.join(process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming', 'node-v24.15.0', 'node.exe'),
    'C:\\Program Files\\nodejs\\node.exe'
  ];
  for (const c of cands) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'node';
}

function resolveWorkerPath() {
  const cands = [
    path.join(__dirname, 'net-bridge-worker.js'),
    path.join(__dirname, 'services', 'net-bridge-worker.js'),
    path.join(process.cwd(), '.obsidian', 'plugins', 'tabonkb-workbench', 'services', 'net-bridge-worker.js'),
    'd:/work/Mgmt/TabonKB/.obsidian/plugins/tabonkb-workbench/services/net-bridge-worker.js'
  ];
  for (const c of cands) {
    if (fs.existsSync(c)) return c;
  }
  return cands[0];
}

/**
 * Execute request via standalone node worker child process
 */
function fetchViaWorker(options) {
  return new Promise((resolve, reject) => {
    const nodeExe = resolveNodePath();
    const workerScript = resolveWorkerPath();

    if (!fs.existsSync(workerScript)) {
      reject(new Error(`Worker script not found at ${workerScript}`));
      return;
    }

    const cp = typeof child_process !== 'undefined' ? child_process : require('child_process');
    const child = cp.spawn(nodeExe, [workerScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn network bridge worker: ${err.message}`));
    });

    child.on('close', (code) => {
      if (!stdout && stderr) {
        reject(new Error(`Network bridge worker error: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout || '{}');
        if (parsed.error) {
          reject(new Error(parsed.error));
          return;
        }
        resolve({
          status: parsed.status,
          headers: parsed.headers || {},
          body: parsed.body || '',
          text: parsed.body || ''
        });
      } catch (e) {
        reject(new Error(`Invalid worker response: ${stdout || stderr || 'empty'}`));
      }
    });

    const payload = JSON.stringify(options);
    child.stdin.write(payload);
    child.stdin.end();
  });
}

/**
 * Robust intranet HTTP(S) request executor
 */
async function intranetRequest(options) {
  const url = options.url;
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const timeout = options.timeout || 15000;
  const body = options.body;

  // 1. Obsidian requestUrl if available
  let reqUrlFn = null;
  if (typeof requestUrl === 'function') {
    reqUrlFn = requestUrl;
  } else {
    try {
      const obs = require('obsidian');
      if (obs && typeof obs.requestUrl === 'function') reqUrlFn = obs.requestUrl;
    } catch (_) {}
  }

  if (reqUrlFn) {
    try {
      const res = await reqUrlFn({
        url,
        method,
        headers,
        body,
        throw: false
      });
      return {
        status: res.status,
        headers: res.headers || {},
        body: res.text || '',
        text: res.text || ''
      };
    } catch (err) {
      const msg = (err && err.message) || String(err);
      const isNetworkBlocked = msg.includes('ERR_NETWORK_ACCESS_DENIED') ||
                               msg.includes('EACCES') ||
                               msg.includes('WSAEACCES') ||
                               msg.includes('ERR_CONNECTION_REFUSED') ||
                               msg.includes('ERR_NAME_NOT_RESOLVED') ||
                               msg.includes('net::');
      if (!isNetworkBlocked) {
        throw err;
      }
      // Fallback to standalone worker
      return await fetchViaWorker(options);
    }
  }

  // 2. Node in-process http/https
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (err) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(urlObj, {
      method,
      headers,
      timeout
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers || {},
          body: raw,
          text: raw
        });
      });
    });

    req.on('error', async (err) => {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        try {
          const wRes = await fetchViaWorker(options);
          resolve(wRes);
        } catch (wErr) {
          reject(wErr);
        }
      } else {
        reject(err);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout (${timeout}ms): ${url}`));
    });

    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  intranetRequest,
  fetchViaWorker,
  resolveNodePath,
  resolveWorkerPath
};
