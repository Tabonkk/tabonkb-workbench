/* Pi 原生扩展调用：Windows 上通过 SSH stdio 跑 62 上的 codegraph explore。 */
const child_process = require('child_process');
const fs = require('fs');

const CODEGRAPH_TREES = {
  kernel: {
    label: '展锐 6.18 内核',
    path: '/dfb/tankaikun/share/A17/sprd/01/kernel-6.18/kernel6.18'
  },
  driver: {
    label: 'A17 项目私有驱动',
    path: '/dfb/tankaikun/share/A17/sprd/01/pri_project/driver'
  }
};

function codegraphShQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function codegraphSshBin() {
  const full = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe';
  try { if (fs.existsSync(full)) return full; } catch (e) {}
  return 'ssh';
}

function runCodegraphTool(name, params) {
  if (name !== 'codegraph_explore') {
    return Promise.resolve('未知 CodeGraph 工具: ' + name);
  }
  const treeKey = (params && params.tree) || 'kernel';
  const tree = CODEGRAPH_TREES[treeKey];
  if (!tree) {
    return Promise.resolve('tree 只能是 kernel（展锐 6.18 内核）或 driver（pri_project/driver）。');
  }
  const query = String((params && params.query) || '').trim();
  if (!query) return Promise.resolve('query 不能为空。请给符号名、路径或要查的调用关系。');

  const remote = [
    '/dfb/tankaikun/.local/bin/codegraph',
    'explore',
    codegraphShQuote(query.slice(0, 2000)),
    '--path', codegraphShQuote(tree.path),
    '--max-files', '8'
  ].join(' ');

  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let settled = false;
    const finish = (text) => { if (!settled) { settled = true; resolve(text); } };
    const proc = child_process.spawn(codegraphSshBin(), [
      '-T',
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=20',
      'tankaikun@192.168.1.62',
      remote
    ], { windowsHide: true });
    const killer = setTimeout(() => { try { proc.kill(); } catch (e) {} finish('CodeGraph 查询超时（120s）'); }, 120000);
    proc.stdout.on('data', (d) => {
      out += d.toString();
      if (out.length > 180000) out = out.slice(0, 180000) + '\n...[truncated]';
    });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => { clearTimeout(killer); finish('CodeGraph 调用失败: ' + e.message); });
    proc.on('close', (code) => {
      clearTimeout(killer);
      if (code !== 0 && !out.trim()) finish('CodeGraph 退出码 ' + code + '\n' + err.slice(-800));
      else finish(out.trim() || err.trim() || '(无输出)');
    });
  });
}

module.exports = { CODEGRAPH_TREES, runCodegraphTool };
