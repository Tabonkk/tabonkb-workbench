/* ==========================================================================
   CodeGraph MCP Shared — 把 62 上的 codegraph serve 接入 Hermes
   注册策略:
   - Hermes: `hermes mcp add codegraph-kernel|codegraph-driver --command ssh --args ...`
     stdio 转到 tankaikun@192.168.1.62 上已 init 的两棵树
   - Pi: 无 MCP，走 extensions/codegraph-portal.ts
   注: 函数必须用顶层 function 声明 (build.py 扁平拼接依赖提升)
   ========================================================================== */

const fs = require('fs');
const child_process = require('child_process');

const CODEGRAPH_MCP_SERVERS = [
  {
    name: 'codegraph-kernel',
    label: '展锐 6.18 内核 (unisoc + GKI common + u-boot + unisoc-modules)',
    path: '/dfb/tankaikun/share/A17/sprd/01/kernel-6.18/kernel6.18'
  },
  {
    name: 'codegraph-driver',
    label: 'A17 项目私有驱动 (T610 / T615 / T8200)',
    path: '/dfb/tankaikun/share/A17/sprd/01/pri_project/driver'
  }
];

const CODEGRAPH_MCP_TOOL_HINT = '\n\n[系统指令] 你已接入 A17 展锐本机代码图 CodeGraph，查已建图源码的符号定义和调用链时优先用它。\n' +
  '1. MCP server codegraph-kernel 的 codegraph_explore：内核 ~/share/A17/sprd/01/kernel-6.18/kernel6.18。充电、LPM、CP DVFS、sprd_charger、unisoc/drivers 走这里。\n' +
  '2. MCP server codegraph-driver 的 codegraph_explore：项目私有驱动 ~/share/A17/sprd/01/pri_project/driver（T610/T615/T8200）。\n' +
  'OpenGrok 仍负责全库文本搜索。CodeGraph 只覆盖上面两棵已索引的树。用符号名、路径或短问题查询，例如 sprd_charger、drivers/power/supply。';

function codegraphSshExe() {
  const full = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe';
  try { if (fs.existsSync(full)) return full; } catch (e) {}
  return 'ssh';
}

function codegraphRemoteServeArgs(projectPath) {
  return [
    '-T',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    'tankaikun@192.168.1.62',
    '/dfb/tankaikun/.local/bin/codegraph',
    'serve', '--mcp', '--path', projectPath
  ];
}

function ensureOneHermesCodegraph(hermesBin, prefixArgs, spec) {
  return new Promise((resolve) => {
    try {
      const pre = Array.isArray(prefixArgs) ? prefixArgs : [];
      const listProc = child_process.spawn(hermesBin, [...pre, 'mcp', 'list'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let listOut = '';
      listProc.stdout.on('data', (d) => { listOut += d.toString(); });
      listProc.stderr.on('data', (d) => { listOut += d.toString(); });
      listProc.on('error', (e) => resolve({ ok: false, name: spec.name, error: e.message }));
      listProc.on('close', () => {
        if (listOut.indexOf(spec.name) >= 0) { resolve({ ok: true, already: true, name: spec.name }); return; }
        const addProc = child_process.spawn(hermesBin, [
          ...pre, 'mcp', 'add', spec.name,
          '--connect-timeout', '90',
          '--command', codegraphSshExe(),
          '--args',
          ...codegraphRemoteServeArgs(spec.path)
        ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        addProc.stdout.on('data', (d) => { out += d.toString(); });
        addProc.stderr.on('data', (d) => { out += d.toString(); });
        addProc.stdin.write('Y\n');
        addProc.stdin.end();
        const killer = setTimeout(() => { try { addProc.kill(); } catch (e) {} }, 150000);
        addProc.on('error', (e) => { clearTimeout(killer); resolve({ ok: false, name: spec.name, error: e.message }); });
        addProc.on('close', (code) => {
          clearTimeout(killer);
          resolve({
            ok: code === 0 || /Saved|Added|success/i.test(out),
            name: spec.name,
            output: out.slice(-500)
          });
        });
      });
    } catch (e) { resolve({ ok: false, name: spec.name, error: e.message }); }
  });
}

function ensureHermesCodegraphMcp(hermesBin, prefixArgs) {
  let chain = Promise.resolve([]);
  for (const spec of CODEGRAPH_MCP_SERVERS) {
    chain = chain.then((results) => ensureOneHermesCodegraph(hermesBin, prefixArgs, spec).then((r) => results.concat([r])));
  }
  return chain.then((results) => ({ ok: results.every((r) => r.ok), results }));
}

module.exports = {
  CODEGRAPH_MCP_SERVERS,
  CODEGRAPH_MCP_TOOL_HINT,
  codegraphSshExe,
  codegraphRemoteServeArgs,
  ensureOneHermesCodegraph,
  ensureHermesCodegraphMcp
};
