// End-to-end background PD save detection and panel refresh, no manual GET trigger.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { PowerZService } = require('../services/powerz-service.js');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const plugin = path.resolve(__dirname, '..');
const python = process.env.POWERZ_TEST_PYTHON || 'py';
async function until(test, description, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error(description + ': timeout');
}
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'powerz-auto-archive-test-'));
  const source = path.join(dir, 'pd.sqlite');
  const original = 'D:/work/Mgmt/TabonKB/00-Inbox/02-Raw-Drop/Data_powerZ/261012180441.sqlite';
  fs.copyFileSync(original, source);
  const stamp = second => { const date = new Date(`2026-10-12T10:30:${second}Z`); fs.utimesSync(source, date, date); };
  const appendPacket = () => execFileSync(python, ['-c', 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("INSERT INTO pd_table VALUES(11.0,9.0,1.0,?)",(bytes.fromhex("458724000021"),)); c.commit(); c.close()', source]);
  stamp('10');
  const originalBytes = fs.readFileSync(source);
  const service = new PowerZService({ captureDir: dir, pythonPath: python, archivePollMs: 80, archiveSettleMs: 150, archiveRetryMs: 150 });
  const context = { require, URL, console, getPowerZService: () => service };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(plugin, 'services/companion-server.js'), 'utf8') + '\nthis.Server = CompanionSyncServer;', context);
  const server = new context.Server({ port: 28295, powerzService: service });
  let browser = null;
  try {
    server.start();
    await until(() => service.getArchiveStatus().lastArchive === '261012183010.sqlite', 'background archive without API reads');
    assert(fs.existsSync(path.join(dir, '261012183010.sqlite')));
    assert.deepEqual(fs.readFileSync(source), originalBytes);
    assert.equal((await service.analyzeCapture('261012183010.sqlite')).totalPackets, 33);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<div id="twChargerPane_powerz"></div>');
    await page.addScriptTag({ path: path.join(plugin, 'components/tools/charger/powerz-panel.js') });
    await page.evaluate(() => { window.panel = new PowerzPanel(document.querySelector('#twChargerPane_powerz'), { companionBaseUrl: 'http://127.0.0.1:28295', refreshIntervalMs: 80 }); });
    await page.waitForFunction(() => document.querySelector('#pzList').textContent.includes('261012183010.sqlite'));
    const firstElement = await page.locator('.pz-item').first().elementHandle();
    await new Promise(resolve => setTimeout(resolve, 350));
    assert(await firstElement.evaluate(el => el.isConnected), 'unchanged polls must preserve DOM');
    appendPacket(); stamp('11');
    await until(() => service.getArchiveStatus().lastArchive === '261012183011.sqlite', 'second save with workfile retained');
    await page.waitForFunction(() => document.querySelector('#pzList').textContent.includes('261012183011.sqlite'));
    assert.equal((await service.analyzeCapture('261012183011.sqlite')).totalPackets, 34);
    const previousArchiveBytes = fs.readFileSync(path.join(dir, '261012183011.sqlite'));
    // A second, different recording in the same named second cannot overwrite.
    appendPacket(); stamp('11');
    await until(() => service.getArchiveStatus().status === 'conflict', 'visible collision');
    await page.waitForFunction(() => document.querySelector('#pzLog').textContent.includes('PD 待存档'));
    assert.deepEqual(fs.readFileSync(path.join(dir, '261012183011.sqlite')), previousArchiveBytes);
    assert(fs.existsSync(source));
    stamp('12');
    await until(() => service.getArchiveStatus().lastArchive === '261012183012.sqlite', 'next save recovers after collision');
    await page.waitForFunction(() => document.querySelector('#pzList').textContent.includes('261012183012.sqlite'));
    assert.equal((await service.analyzeCapture('261012183012.sqlite')).totalPackets, 35);
    await page.evaluate(() => window.panel.destroy());
    assert.equal(await page.evaluate(() => window.panel._refreshTimer), null);
    server.stop();
    assert.equal(service.getArchiveStatus().enabled, false);
    appendPacket(); stamp('13');
    await new Promise(resolve => setTimeout(resolve, 500));
    assert(!fs.existsSync(path.join(dir, '261012183013.sqlite')), 'unload must stop snapshots');
    assert(!fs.readdirSync(dir).some(name => name.startsWith('.powerz-archive-')));
    // Cancellation also removes this job's staging file without touching archives.
    const cancelling = new PowerZService({ captureDir: dir });
    cancelling._monitorAbort = new AbortController();
    cancelling._execFileAsync = async (_, args, opts) => {
      const stage = args[args.indexOf('--stage') + 1];
      fs.writeFileSync(stage, 'incomplete snapshot');
      return new Promise(resolve => opts.signal.addEventListener('abort', () => resolve({ err: new Error('aborted'), stderr: '', stdout: '' }), { once: true }));
    };
    const cancelled = cancelling._snapshotProtocol(source, path.join(dir, '261012183014.sqlite'));
    cancelling.stopCaptureMonitor();
    assert.equal((await cancelled).ok, false);
    assert(!fs.readdirSync(dir).some(name => name.startsWith('.powerz-archive-')));

    console.log('PASS: server-start background archive without GET, retained source, multiple saves, automatic panel update/no flicker, same-second no-overwrite, error recovery, timer/watcher shutdown');
  } finally { server.stop(); if (browser) await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
