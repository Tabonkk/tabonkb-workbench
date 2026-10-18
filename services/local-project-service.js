/* ==========================================================================
   Local Project Service — 本地多服务器工程管理与三层差分覆盖 (pri_project/driver)
   
   支持:
   1. 192.168.1.62 (Y:) 与 192.168.1.31 (Z:) 多套源码工程自动探测与管理
   2. 三层代码拓扑与逆向穿透决议 (Reverse Resolution):
      - Tier 2 (最高覆盖权): pri_project/driver/<platform>/<project>/base/
      - Tier 1 (次高覆盖权): pri_project/driver/public/
      - Tier 0 (兜底基准): alps / vendor_w / kernel 基线源码
   3. 安全代码修改路由 (Target Routing: 禁改基线，派生客制化)
   4. 远程 SSH 编译命令装配与编译器错误提炼
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const LOCAL_SERVERS = [
  {
    id: '62',
    name: '62 服务器',
    host: '192.168.1.62',
    user: 'tankaikun',
    sshHost: '192.168.1.62',
    winRoot: 'Y:\\',
    uncRoot: '\\\\192.168.1.62\\tankaikun',
    linuxRoot: '/dfb/tankaikun/share',
    workspaces: [
      { id: 'w03-mtk', name: 'W/03-mtk-ww', relPath: 'W/03-mtk-ww', desc: 'MTK 主线 (MT6789/K82NF)' },
      { id: 'w01-sprd', name: 'W/01-sprd', relPath: 'W/01-sprd', desc: '展锐主线工程' },
      { id: 'w02-mtk', name: 'W/02-mtk-ww', relPath: 'W/02-mtk-ww', desc: 'MTK 分支工程' },
      { id: 'w04-mtk', name: 'W/04-mtk-ww', relPath: 'W/04-mtk-ww', desc: 'MTK 备用工程' },
      { id: 'a17-sprd', name: 'A17-sprd-01', relPath: 'A17/sprd/01', desc: '展锐 A17 Kernel 6.18' }
    ]
  },
  {
    id: '31',
    name: '31 服务器',
    host: '192.168.1.31',
    user: 'tankaikun',
    sshHost: '192.168.1.31',
    winRoot: 'Z:\\work',
    uncRoot: '\\\\192.168.1.31\\tankaikun\\work',
    linuxRoot: '/home/tankaikun/share/work',
    workspaces: [
      { id: '05-uw', name: 'AndroidW/05-UW', relPath: 'AndroidW/05-UW', desc: 'Android 15 (UW) 主力工程 (MT6878/MT6897/MT6989)' },
      { id: '04-vw', name: 'AndroidW/04-VW', relPath: 'AndroidW/04-VW', desc: 'Android 15 (VW) 工程' },
      { id: '01-w', name: 'AndroidW/01', relPath: 'AndroidW/01', desc: 'Android 15 基础分支 01' },
      { id: '02-w', name: 'AndroidW/02', relPath: 'AndroidW/02', desc: 'Android 15 分支 02' },
      { id: '03-w', name: 'AndroidW/03', relPath: 'AndroidW/03', desc: 'Android 15 分支 03' },
      { id: 'a20', name: 'A20', relPath: 'A20', desc: 'A20 项目工程' }
    ]
  }
];

function getWinSshBin() {
  const full = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe';
  try { if (fs.existsSync(full)) return full; } catch (_) {}
  return 'ssh';
}

function safeExistsSync(targetPath) {
  if (!targetPath) return false;
  try {
    fs.statSync(targetPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      try {
        child_process.execSync(`cmd.exe /c if exist "${targetPath}" (exit 0) else (exit 1)`, { stdio: 'ignore' });
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

function safeReaddirSync(dirPath) {
  if (!dirPath) return [];
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      try {
        const out = child_process.execSync(`cmd.exe /c dir /ad /b "${dirPath}"`, { encoding: 'utf8' });
        const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        return lines.map(name => ({
          name,
          isDirectory: () => true
        }));
      } catch (_) {
        return [];
      }
    }
    return [];
  }
}

function windowsPathToLinux(winPath) {
  if (!winPath) return '';
  let norm = String(winPath).trim().replace(/\\/g, '/');
  // 62: Y:/ -> /dfb/tankaikun/share/
  if (/^[Yy]:/i.test(norm)) {
    return norm.replace(/^[Yy]:\/?/i, '/dfb/tankaikun/share/');
  }
  // 31: Z:/work/ -> /home/tankaikun/share/work/
  if (/^[Zz]:\/work/i.test(norm)) {
    return norm.replace(/^[Zz]:\/work\/?/i, '/home/tankaikun/share/work/');
  }
  if (/^[Zz]:/i.test(norm)) {
    return norm.replace(/^[Zz]:\/?/i, '/home/tankaikun/share/');
  }
  // UNC paths
  if (norm.startsWith('//192.168.1.62/tankaikun/')) {
    return norm.replace('//192.168.1.62/tankaikun/', '/dfb/tankaikun/share/');
  }
  if (norm.startsWith('//192.168.1.31/tankaikun/work/')) {
    return norm.replace('//192.168.1.31/tankaikun/work/', '/home/tankaikun/share/work/');
  }
  return norm;
}

function linuxPathToWindows(linuxPath) {
  if (!linuxPath) return '';
  let norm = String(linuxPath).trim().replace(/\\/g, '/');
  if (norm.startsWith('/dfb/tankaikun/share/')) {
    return norm.replace('/dfb/tankaikun/share/', 'Y:\\').replace(/\//g, '\\');
  }
  if (norm.startsWith('/home/tankaikun/share/work/')) {
    return norm.replace('/home/tankaikun/share/work/', 'Z:\\work\\').replace(/\//g, '\\');
  }
  if (norm.startsWith('/home/tankaikun/share/')) {
    return norm.replace('/home/tankaikun/share/', 'Z:\\').replace(/\//g, '\\');
  }
  return norm.replace(/\//g, '\\');
}

/**
 * 通过 SSH 直接读取远端 Linux 服务器文件 (极速且杜绝 SMB 超时卡死)
 */
function readRemoteFileViaSsh(sshHost, user, linuxPath, timeoutMs = 4000) {
  if (!linuxPath) return null;
  const sshBin = getWinSshBin();
  const host = sshHost || '192.168.1.62';
  const u = user || 'tankaikun';
  const target = `${u}@${host}`;

  try {
    const escaped = linuxPath.replace(/(["`$\\])/g, '\\$1');
    const out = child_process.execFileSync(sshBin, [
      '-o', 'BatchMode=yes',
      '-o', `ConnectTimeout=${Math.max(1, Math.floor(timeoutMs / 1000))}`,
      '-q',
      target,
      `cat "${escaped}"`
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs
    });
    return out;
  } catch (err) {
    return null;
  }
}

/**
 * 通过 SSH 直接写入远端 Linux 服务器文件
 */
function writeRemoteFileViaSsh(sshHost, user, linuxPath, content, timeoutMs = 8000) {
  if (!linuxPath) throw new Error('无效的 Linux 目标路径');
  const sshBin = getWinSshBin();
  const host = sshHost || '192.168.1.62';
  const u = user || 'tankaikun';
  const target = `${u}@${host}`;

  const escaped = linuxPath.replace(/(["`$\\])/g, '\\$1');
  const dirPath = path.posix.dirname(linuxPath.replace(/\\/g, '/'));
  const escapedDir = dirPath.replace(/(["`$\\])/g, '\\$1');

  try {
    child_process.execFileSync(sshBin, [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=3',
      '-q',
      target,
      `mkdir -p "${escapedDir}" && cat > "${escaped}"`
    ], {
      input: content,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs
    });
    return true;
  } catch (err) {
    throw new Error(`SSH 写入失败: ${err.message}`);
  }
}

/**
 * 通过 SSH 在指定 Linux 目录下快速定位文件 (基于 Linux find, 比 Windows SMB 遍历快 100 倍)
 */
function findRemoteFileViaSsh(sshHost, user, searchRoots, fileName, timeoutMs = 5000) {
  if (!fileName || !searchRoots) return null;
  const sshBin = getWinSshBin();
  const host = sshHost || '192.168.1.62';
  const u = user || 'tankaikun';
  const target = `${u}@${host}`;

  const roots = (Array.isArray(searchRoots) ? searchRoots : [searchRoots]).filter(Boolean);
  if (roots.length === 0) return null;

  try {
    const escapedFileName = fileName.replace(/(["`$\\*?])/g, '\\$1');
    const rootStr = roots.map(r => `"${r.replace(/(["`$\\])/g, '\\$1')}"`).join(' ');
    const cmd = `find ${rootStr} -maxdepth 13 -type f -name "${escapedFileName}" 2>/dev/null`;
    const out = child_process.execFileSync(sshBin, [
      '-o', 'BatchMode=yes',
      '-o', `ConnectTimeout=${Math.max(1, Math.floor(timeoutMs / 1000))}`,
      '-q',
      target,
      cmd
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 5 * 1024 * 1024,
      timeout: timeoutMs
    });

    const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    // 优先返回包含 /base/ 的路径（Tier 2 定制最高优先级）
    const baseMatch = lines.find(l => l.includes('/base/'));
    if (baseMatch) return baseMatch;

    // 其次返回包含 /public/ 的路径（Tier 1 公共差分）
    const pubMatch = lines.find(l => l.includes('/public/'));
    if (pubMatch) return pubMatch;

    return lines[0];
  } catch (err) {
    return null;
  }
}

/**
 * 异步 SSH 直读远端文件 (不阻塞 UI 主线程)
 * @returns {Promise<string|null>}
 */
function readRemoteFileViaSshAsync(sshHost, user, linuxPath, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!linuxPath) return resolve(null);
    const sshBin = getWinSshBin();
    const host = sshHost || '192.168.1.62';
    const u = user || 'tankaikun';
    const escaped = String(linuxPath).replace(/(["`$\\])/g, '\\$1');
    child_process.execFile(sshBin, [
      '-o', 'BatchMode=yes',
      '-o', `ConnectTimeout=${Math.max(1, Math.floor(timeoutMs / 1000))}`,
      '-q',
      `${u}@${host}`,
      `cat "${escaped}"`
    ], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs
    }, (err, stdout) => {
      if (err && !stdout) return resolve(null);
      resolve(typeof stdout === 'string' && stdout.length > 0 ? stdout : null);
    });
  });
}

/**
 * 单次 SSH 会话完成「多级候选路径直读 + find 兜底定位」
 * 相比逐次 spawn（每次 300ms+ 连接握手），全部探测收敛到一条 SSH 连接，
 * 通常 300~800ms 内返回；命中的 Linux 路径经 stderr 通道回传。
 * @param {string} sshHost
 * @param {string} user
 * @param {{candidates?: string[], searchRoots?: string[], fileName?: string}} opts
 * @param {number} [timeoutMs]
 * @returns {Promise<{content: string, linuxPath: string}|null>}
 */
function readRemoteFileSmartAsync(sshHost, user, opts = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const candidates = [];
    (opts.candidates || []).forEach(c => { if (c && !candidates.includes(c)) candidates.push(c); });
    const roots = (Array.isArray(opts.searchRoots) ? opts.searchRoots : []).filter(Boolean);
    const fileName = opts.fileName;
    if (candidates.length === 0 && !fileName) return resolve(null);

    const esc = s => String(s).replace(/(["`$\\])/g, '\\$1');
    const parts = [];
    if (candidates.length > 0) {
      const list = candidates.map(p => `"${esc(p)}"`).join(' ');
      parts.push(`for __p in ${list}; do if [ -f "$__p" ]; then echo "$__p" >&2; cat "$__p"; exit 0; fi; done`);
    }
    if (fileName && roots.length > 0) {
      const rootStr = roots.map(r => `"${esc(r)}"`).join(' ');
      const escName = String(fileName).replace(/(["`$\\*?])/g, '\\$1');
      // 与 findRemoteFileViaSsh 同优先级：/base/ (Tier2) > /public/ (Tier1) > 首个命中
      parts.push(`__f=$(find ${rootStr} -maxdepth 13 -type f -name "${escName}" 2>/dev/null | grep '/base/' | head -n1); [ -z "$__f" ] && __f=$(find ${rootStr} -maxdepth 13 -type f -name "${escName}" 2>/dev/null | grep '/public/' | head -n1); [ -z "$__f" ] && __f=$(find ${rootStr} -maxdepth 13 -type f -name "${escName}" 2>/dev/null | head -n1); if [ -n "$__f" ]; then echo "$__f" >&2; cat "$__f"; fi`);
    }
    const cmd = parts.join('; ');

    const host = sshHost || '192.168.1.62';
    const u = user || 'tankaikun';
    child_process.execFile(getWinSshBin(), [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=4',
      '-q',
      `${u}@${host}`,
      cmd
    ], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs
    }, (err, stdout, stderr) => {
      const content = (typeof stdout === 'string' && stdout.length > 0) ? stdout : null;
      if (!content) return resolve(null);
      // stderr 最后一行以 '/' 开头者即命中路径 (ssh 警告信息不会造成干扰)
      let linuxPath = '';
      try {
        const errLines = String(stderr || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        linuxPath = errLines.filter(l => l.startsWith('/')).pop() || '';
      } catch (_) {}
      resolve({ content, linuxPath });
    });
  });
}

function safeReadFileSync(filePath, encoding = 'utf8') {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (err) {
    // 若路径在 Linux 远端服务器挂载盘 (Y: 或 Z: 或 Linux 原生路径)，透明回退到 SSH 秒级直读
    const isServerShare = /^[YyZz]:/i.test(filePath) || filePath.startsWith('/dfb/') || filePath.startsWith('/home/');
    if (isServerShare) {
      const isHost31 = /^[Zz]:/i.test(filePath) || filePath.startsWith('/home/');
      const sshHost = isHost31 ? '192.168.1.31' : '192.168.1.62';
      const linuxPath = windowsPathToLinux(filePath);
      const sshContent = readRemoteFileViaSsh(sshHost, 'tankaikun', linuxPath, 3000);
      if (typeof sshContent === 'string') {
        return sshContent;
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    if (err.code === 'EPERM' || err.code === 'EACCES') {
      try {
        return child_process.execSync(`cmd.exe /c type "${filePath}"`, { encoding, maxBuffer: 50 * 1024 * 1024 });
      } catch (cpErr) {
        throw new Error(`读取文件失败: ${cpErr.message}`);
      }
    }
    throw err;
  }
}

function safeWriteFileSync(filePath, content, encoding = 'utf8') {
  try {
    fs.writeFileSync(filePath, content, encoding);
  } catch (err) {
    // 若路径在 Linux 远端服务器挂载盘 (Y: 或 Z:)，透明回退到 SSH 秒级直写
    const isServerShare = /^[YyZz]:/i.test(filePath) || filePath.startsWith('/dfb/') || filePath.startsWith('/home/');
    if (isServerShare) {
      try {
        const isHost31 = /^[Zz]:/i.test(filePath) || filePath.startsWith('/home/');
        const sshHost = isHost31 ? '192.168.1.31' : '192.168.1.62';
        const linuxPath = windowsPathToLinux(filePath);
        writeRemoteFileViaSsh(sshHost, 'tankaikun', linuxPath, content, 6000);
        return;
      } catch (_) {}
    }

    if (err.code === 'EPERM' || err.code === 'EACCES') {
      const os = require('os');
      const tmpPath = path.join(os.tmpdir(), `wb_tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
      fs.writeFileSync(tmpPath, content, encoding);
      try {
        child_process.execSync(`cmd.exe /c copy /y "${tmpPath}" "${filePath}"`, { stdio: 'ignore' });
      } finally {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      return;
    }
    throw err;
  }
}

function getLocalProjectsCacheFile() {
  const candidates = [];
  if (typeof app !== 'undefined' && app?.vault?.adapter?.basePath) {
    candidates.push(path.join(app.vault.adapter.basePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'local-projects-cache.json'));
  }
  candidates.push('d:\\work\\Mgmt\\TabonKB\\.obsidian\\plugins\\tabonkb-workbench\\local-projects-cache.json');
  try {
    if (typeof __dirname !== 'undefined') {
      candidates.push(path.join(__dirname, 'local-projects-cache.json'));
      candidates.push(path.join(__dirname, '..', 'local-projects-cache.json'));
    }
  } catch (_) {}

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return candidates[0] || 'd:\\work\\Mgmt\\TabonKB\\.obsidian\\plugins\\tabonkb-workbench\\local-projects-cache.json';
}

const NON_PLATFORM_DIRS = new Set([

  'public', 'public_ata', 'custom', 'flashcode', 'release_camera_code',
  '.git', 'base', 'base_ata', 'pri_efuse_key', 'pri_flash_support', 'build', 'docs'
]);

const IGNORED_SCAN_DIRS = new Set([
  '.git', 'alps', 'out', 'node_modules', 'platform-tools', 'TabonNote'
]);

/**
 * 递归深度动态探测某服务器根目录下所有包含 pri_project/driver 或 prize_project/driver 的真实代码根目录
 * 支持最大深度 4 层，自动适应代码的增删改动
 */
function findDynamicWorkspaces(srvWinRoot, maxDepth = 4) {
  const workspaces = [];
  function walk(current, depth) {
    if (depth > maxDepth) return;
    try {
      let priDir = path.join(current, 'pri_project', 'driver');
      if (!safeExistsSync(priDir)) {
        priDir = path.join(current, 'prize_project', 'driver');
      }
      if (safeExistsSync(priDir)) {
        // 发现实际工程根目录！
        const rel = path.relative(srvWinRoot, current).replace(/\\/g, '/');
        workspaces.push({
          fullPath: current,
          relPath: rel,
          priDriverDir: priDir
        });
        return; // 不再向子树递归
      }

      const entries = safeReaddirSync(current);
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const name = e.name;
        if (name.startsWith('.') || IGNORED_SCAN_DIRS.has(name.toLowerCase())) continue;
        walk(path.join(current, name), depth + 1);
      }
    } catch (_) {}
  }

  walk(srvWinRoot, 1);
  return workspaces;
}

/**
 * 扫描指定工作区目录下的 pri_project/driver 平台与项目列表
 */
function scanWorkspaceProjects(priDriverDir) {
  const results = [];
  if (!safeExistsSync(priDriverDir)) return results;

  try {
    const entries = safeReaddirSync(priDriverDir);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const platformName = entry.name;
      if (NON_PLATFORM_DIRS.has(platformName.toLowerCase())) continue;

      const platformDir = path.join(priDriverDir, platformName);
      try {
        const projEntries = safeReaddirSync(platformDir);
        for (const pe of projEntries) {
          if (!pe.isDirectory()) continue;
          const projName = pe.name;
          if (projName === '1.txt' || projName.startsWith('.')) continue;

          results.push({
            platform: platformName,
            project: projName
          });
        }
      } catch (_) {}
    }
  } catch (_) {}

  return results;
}

let _cachedProjectList = null;
let _cachedTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60 秒内存缓存

/**
 * 获取所有可用本地工程扁平列表 (跨 62 与 31 服务器，支持全动态发现与实时强制刷新)
 */
function getAllAvailableLocalProjects(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cachedProjectList && _cachedProjectList.length > 0 && (now - _cachedTimestamp < CACHE_TTL_MS)) {
    return _cachedProjectList;
  }

  // 1. 若非强制刷新，优先从本地磁盘持久化缓存读取
  if (!forceRefresh) {
    try {
      const cachePath = getLocalProjectsCacheFile();
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _cachedProjectList = parsed;
          _cachedTimestamp = now;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[LocalProjectService] Failed to read disk cache:', e);
    }
  }

  // 2. 缓存失效或强制刷新时执行全动态扫描
  const list = [];
  for (const srv of LOCAL_SERVERS) {
    const srvRootExists = safeExistsSync(srv.winRoot);
    if (!srvRootExists) continue;

    const dynamicWorkspaces = findDynamicWorkspaces(srv.winRoot, 4);
    for (const ws of dynamicWorkspaces) {
      const pairs = scanWorkspaceProjects(ws.priDriverDir);
      for (const p of pairs) {
        const cleanWsId = ws.relPath.replace(/[^a-zA-Z0-9_-]/g, '_');
        const id = `${srv.id}_${cleanWsId}_${p.platform}_${p.project}`;
        const wsShort = ws.relPath.split('/').pop();
        const label = `${wsShort}/${p.project}`;
        const shortDesc = `${srv.host || srv.id} · ${p.platform}/${p.project}`;

        list.push({
          id,
          serverId: srv.id,
          serverName: srv.name,
          serverIp: srv.host,
          user: srv.user,
          sshHost: srv.sshHost,
          workspaceId: cleanWsId,
          workspaceName: ws.relPath,
          fullPathWin: ws.fullPath,
          uncPath: path.join(srv.uncRoot, ws.relPath.replace(/\//g, '\\')),
          linuxPath: `${srv.linuxRoot}/${ws.relPath}`,
          platform: p.platform,
          project: p.project,
          label,
          shortDesc,
          priDriverRel: `pri_project/driver/${p.platform}/${p.project}/base`,
          publicDriverRel: 'pri_project/driver/public'
        });
      }
    }
  }

  if (list.length > 0) {
    _cachedProjectList = list;
    _cachedTimestamp = now;
    try {
      const cachePath = getLocalProjectsCacheFile();
      fs.writeFileSync(cachePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (_) {}
    return list;
  }


  return _cachedProjectList || [];
}

/**
 * 逆向穿透决议 (Reverse Resolution):
 * 根据项目配置与相对路径，解析真实生效的源码文件
 * 优先级: Tier 2 (项目专属) > Tier 1 (公共差分) > Tier 0 (原厂基线)
 */
function resolveEffectiveFile(projectConfig, relativePath) {
  if (!projectConfig || !projectConfig.fullPathWin || !relativePath) {
    return null;
  }

  const cleanRel = relativePath.replace(/^[\\\/]+/, '').replace(/\//g, '\\');

  // Tier 2: 项目个性化客制化
  const tier2Path = path.join(
    projectConfig.fullPathWin,
    'pri_project', 'driver',
    projectConfig.platform, projectConfig.project,
    'base', cleanRel
  );
  if (safeExistsSync(tier2Path)) {
    return {
      tier: 2,
      tierName: 'Tier 2 (项目专属客制化)',
      platform: projectConfig.platform,
      project: projectConfig.project,
      fullPath: tier2Path,
      relativePath: path.join('pri_project/driver', projectConfig.platform, projectConfig.project, 'base', cleanRel).replace(/\\/g, '/'),
      isOverride: true
    };
  }

  // Tier 1: 公司公共差分
  const tier1Path = path.join(
    projectConfig.fullPathWin,
    'pri_project', 'driver',
    'public', cleanRel
  );
  if (safeExistsSync(tier1Path)) {
    return {
      tier: 1,
      tierName: 'Tier 1 (公司公共差分)',
      fullPath: tier1Path,
      relativePath: path.join('pri_project/driver/public', cleanRel).replace(/\\/g, '/'),
      isOverride: true
    };
  }

  // Tier 0: 原厂官方基线 (在 vendor_t, vendor_w, alps, idh, kernel 或仓库根目录查找)
  const candidateBaselines = [
    path.join(projectConfig.fullPathWin, cleanRel),
    path.join(projectConfig.fullPathWin, 'vendor_t', cleanRel),
    path.join(projectConfig.fullPathWin, 'vendor_t', 'bsp', cleanRel),
    path.join(projectConfig.fullPathWin, 'pri_project', 'driver', 'public', cleanRel),
    path.join(projectConfig.fullPathWin, 'pri_project', 'driver', cleanRel),
    path.join(projectConfig.fullPathWin, 'idh', cleanRel),
    path.join(projectConfig.fullPathWin, 'vendor_w', cleanRel),
    path.join(projectConfig.fullPathWin, 'alps', cleanRel),
    path.join(projectConfig.fullPathWin, 'kernel', cleanRel),
    path.join(projectConfig.fullPathWin, 'vendor_w', 'kernel', cleanRel)
  ];

  for (const bp of candidateBaselines) {
    if (safeExistsSync(bp)) {
      return {
        tier: 0,
        tierName: 'Tier 0 (原厂官方基线)',
        fullPath: bp,
        relativePath: path.relative(projectConfig.fullPathWin, bp).replace(/\\/g, '/'),
        isOverride: false
      };
    }
  }

  return {
    tier: -1,
    tierName: '未找到文件',
    fullPath: null,
    relativePath: cleanRel,
    isOverride: false
  };
}

/**
 * 安全读取实际生效源码内容 (兼容 EPERM 回退)
 */
function readEffectiveFileContent(projectConfig, relativePath) {
  const resolved = resolveEffectiveFile(projectConfig, relativePath);
  if (!resolved || !resolved.fullPath) {
    return {
      ok: false,
      error: `文件未在本地工程中找到: ${relativePath}`
    };
  }

  try {
    const content = safeReadFileSync(resolved.fullPath, 'utf8');
    return {
      ok: true,
      resolved,
      content
    };
  } catch (err) {
    return {
      ok: false,
      error: `读取失败: ${err.message}`,
      resolved
    };
  }
}

/**
 * 安全修改目标路由:
 * 严禁直接改基线！项目修改路由到 pri_project/driver/<platform>/<project>/base/，
 * 若文件未在 project 层存在，自动从基线或 public 拷贝派生一份再供修改。
 */
function routeEditTarget(projectConfig, relativePath, scope = 'project') {
  if (!projectConfig || !projectConfig.fullPathWin) {
    throw new Error('未指定有效的本地工程配置');
  }

  const cleanRel = relativePath.replace(/^[\\\/]+/, '').replace(/\//g, '\\');

  if (scope === 'public') {
    const targetPath = path.join(projectConfig.fullPathWin, 'pri_project', 'driver', 'public', cleanRel);
    return {
      targetPath,
      scope: 'public',
      targetRel: path.join('pri_project/driver/public', cleanRel).replace(/\\/g, '/')
    };
  }

  // 默认: 项目个性化
  const targetPath = path.join(
    projectConfig.fullPathWin,
    'pri_project', 'driver',
    projectConfig.platform, projectConfig.project,
    'base', cleanRel
  );

  let derived = false;
  if (!safeExistsSync(targetPath)) {
    // 寻找源文件派生
    const effective = resolveEffectiveFile(projectConfig, relativePath);
    if (effective && effective.fullPath && safeExistsSync(effective.fullPath)) {
      const dir = path.dirname(targetPath);
      if (!safeExistsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {
          try { child_process.execSync(`cmd.exe /c mkdir "${dir}"`, { stdio: 'ignore' }); } catch (_) {}
        }
      }
      try {
        fs.copyFileSync(effective.fullPath, targetPath);
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
          child_process.execSync(`cmd.exe /c copy /y "${effective.fullPath}" "${targetPath}"`, { stdio: 'ignore' });
        } else {
          throw err;
        }
      }
      derived = true;
    }
  }

  return {
    targetPath,
    scope: 'project',
    derivedFromSource: derived,
    targetRel: path.join('pri_project/driver', projectConfig.platform, projectConfig.project, 'base', cleanRel).replace(/\\/g, '/')
  };
}

/**
 * 组装该工程的远程编译命令
 */
function buildCompileCommand(projectConfig, buildType = 'driver', extraArgs = '') {
  if (!projectConfig || !projectConfig.linuxPath) {
    return 'echo "未绑定有效工程路径"';
  }
  const extra = extraArgs ? ` ${extraArgs}` : '';
  const cdCmd = `cd ${projectConfig.linuxPath}`;

  if (buildType === 'driver') {
    return `${cdCmd} && ./pri_project/build/build.sh -p ${projectConfig.platform} -m ${projectConfig.project} -k driver${extra}`;
  } else if (buildType === 'dtbo' || buildType === 'dts') {
    return `${cdCmd} && ./pri_project/build/build.sh -p ${projectConfig.platform} -m ${projectConfig.project} -k dtbo${extra}`;
  } else if (buildType === 'kernel') {
    return `${cdCmd} && ./pri_project/build/build.sh -p ${projectConfig.platform} -m ${projectConfig.project} -k kernel${extra}`;
  }
  return `${cdCmd} && ${buildType}${extra}`;
}

/**
 * 提取编译器关键错误日志 (防止海量 Warning 刷屏)
 */
function extractCompilerErrors(output) {
  if (!output) return '';
  const lines = output.split('\n');
  const errorLines = [];
  const errorRegex = /(error:|fatal error:|undefined reference to|FAILED:|make.*Error|syntax error)/i;

  for (let i = 0; i < lines.length; i++) {
    if (errorRegex.test(lines[i])) {
      // 提取前后 3 行上下文
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 4);
      errorLines.push(`--- [Error Context: Line ${i + 1}] ---`);
      for (let j = start; j < end; j++) {
        errorLines.push(lines[j]);
      }
      errorLines.push('');
      if (errorLines.length > 50) break; // 最多保留 50 块关键错误
    }
  }

  if (errorLines.length === 0) {
    return output.slice(-2000); // 无明确关键字则取尾部 2000 字符
  }
  return errorLines.join('\n');
}

module.exports = {
  LOCAL_SERVERS,
  safeExistsSync,
  safeReaddirSync,
  safeReadFileSync,
  safeWriteFileSync,
  windowsPathToLinux,
  linuxPathToWindows,
  readRemoteFileViaSsh,
  readRemoteFileViaSshAsync,
  readRemoteFileSmartAsync,
  writeRemoteFileViaSsh,
  findRemoteFileViaSsh,
  getLocalProjectsCacheFile,
  scanWorkspaceProjects,
  getAllAvailableLocalProjects,
  resolveEffectiveFile,
  readEffectiveFileContent,
  routeEditTarget,
  buildCompileCommand,
  extractCompilerErrors,
  getWinSshBin
};


