// ADC snapshots detect stable committed sample progress while Mtools keeps its connection open.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { PowerZService } = require('../services/powerz-service.js');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const python = process.env.POWERZ_TEST_PYTHON || 'py';
const plugin = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await test()) return; await delay(50); }
  throw new Error(message + ': timeout');
}
(async () => {
  if (process.platform !== 'win32') throw new Error('Windows test required');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'powerz-curve-archive-test-'));
  const raw = '261012100000_10_12_12_34_59.db';
  const source = path.join(dir, raw);
  fs.copyFileSync('D:/work/Mgmt/TabonKB/00-Inbox/02-Raw-Drop/Data_powerZ/261012173920.db', source);
  const stamp = second => { const date = new Date(`2026-10-12T11:30:${second}Z`); fs.utimesSync(source, date, date); };
  stamp('10');
  const original = fs.readFileSync(source);
  const writerCode = `import sqlite3,sys,threading,time
c=sqlite3.connect(sys.argv[1])
c.execute("SELECT COUNT(*) FROM table_1").fetchone()
stop=threading.Event()
threading.Thread(target=lambda: (sys.stdin.readline(), stop.set()), daemon=True).start()
print("READY", flush=True)
while not stop.is_set():
    c.execute("INSERT INTO table_1 SELECT ElapsedTime,(SELECT MAX(Unix)+1 FROM table_1),VBUS,IBUS,DP,DM,CC1,CC2,TEMP,CHARGE,ENERGY FROM table_1 LIMIT 1")
    c.commit()
    time.sleep(0.05)
print("STOPPED", flush=True)
sys.stdin.readline()
c.close()`;
  const writer = spawn(python, ['-u', '-c', writerCode, source], { windowsHide: true });
  let output = '', errors = '';
  writer.stdout.on('data', chunk => output += chunk.toString());
  writer.stderr.on('data', chunk => errors += chunk.toString());
  const service = new PowerZService({ captureDir: dir, pythonPath: python, archivePollMs: 80, adcArchiveSettleMs: 700, archiveSettleMs: 150, archiveRetryMs: 150 });
  const context = { require, URL, console, getPowerZService: () => service };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(plugin, 'services/companion-server.js'), 'utf8') + '\nthis.Server = CompanionSyncServer;', context);
  const server = new context.Server({ port: 28296, powerzService: service });
  let browser, reloaded;
  try {
    await until(() => output.includes('READY'), 'open official-style writer: ' + errors);
    server.start();
    await until(() => service.getArchiveStatus().adc.status === 'recording', 'detect live writer');
    await delay(1200); // Far longer than settle threshold; writer idle but still live.
    assert(!fs.readdirSync(dir).some(name => /^\d{12}\.db$/.test(name)), 'growing samples must not be archived');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<div id="twChargerPane_powerz"></div>');
    await page.addScriptTag({ path: path.join(plugin, 'components/tools/charger/powerz-panel.js') });
    await page.evaluate(() => { window.panel = new PowerzPanel(document.querySelector('#twChargerPane_powerz'), { companionBaseUrl: 'http://127.0.0.1:28296', refreshIntervalMs: 80 }); });
    await page.waitForFunction(() => document.querySelector('#pzArchiveState').textContent === '采集中');
    writer.stdin.write('\n');
    await until(() => output.includes('STOPPED'), 'stop samples while writer remains open');
    stamp('10');
    const stoppedBytes = fs.readFileSync(source);
    await until(() => fs.existsSync(path.join(dir, '261012193010.db')), 'archive while original write connection remains open');
    assert.equal(writer.exitCode, null, 'app remains running');
    await page.waitForFunction(() => document.querySelector('#pzList').textContent.includes('261012193010.db'));
    await page.waitForFunction(() => document.querySelector('#pzLog').textContent.includes('曲线已存档'));
    const data = await service.analyzeCapture('261012193010.db');
    const capturedCount = data.totalSamples;
    assert(capturedCount > 17958);
    assert.deepEqual(fs.readFileSync(source), stoppedBytes);
    const verify = JSON.parse(execFileSync(python, ['-c', 'import sqlite3,sys,json; a=sqlite3.connect(sys.argv[1]); b=sqlite3.connect(sys.argv[2]); print(json.dumps({"same":list(a.iterdump())==list(b.iterdump()),"integrity":b.execute("PRAGMA quick_check").fetchone()[0]}))', source, path.join(dir, '261012193010.db')], { encoding: 'utf8' }));
    assert.deepEqual(verify, { same: true, integrity: 'ok' });
    // Different content saved in the same second does not overwrite the archive.
    const archiveBytes = fs.readFileSync(path.join(dir, '261012193010.db'));
    execFileSync(python, ['-c', 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("INSERT INTO table_1 SELECT ElapsedTime,(SELECT MAX(Unix)+1 FROM table_1),VBUS,IBUS,DP,DM,CC1,CC2,TEMP,CHARGE,ENERGY FROM table_1 LIMIT 1"); c.commit(); c.close()', source]);
    stamp('10');
    await until(() => service.getArchiveStatus().adc.status === 'conflict', 'same-second conflict');
    assert.deepEqual(fs.readFileSync(path.join(dir, '261012193010.db')), archiveBytes);
    stamp('11');
    await until(() => service.getArchiveStatus().adc.lastArchive === '261012193011.db', 'recover next save');
    assert.equal((await service.analyzeCapture('261012193011.db')).totalSamples, capturedCount + 1);
    // Companion restart and metadata/checkpoint-only changes still deduplicate.
    server.stop();
    await until(() => !service._archivePromise, 'stop completes');
    stamp('12');
    reloaded = new PowerZService({ captureDir: dir, pythonPath: python, archivePollMs: 80, adcArchiveSettleMs: 700, archiveRetryMs: 150 });
    reloaded.startCaptureMonitor();
    await until(() => reloaded.getArchiveStatus().adc.lastArchive === '261012193011.db', 'persistent per-source dedup');
    assert(!fs.existsSync(path.join(dir, '261012193012.db')));
    reloaded.stopCaptureMonitor();
    await page.evaluate(() => window.panel.destroy());
    assert.equal(await page.evaluate(() => window.panel._refreshTimer), null);
    assert(!fs.readdirSync(dir).some(name => name.startsWith('.powerz-archive-')));
    console.log('PASS: continuous sample growth never archived, sample stop with write connection and app still open, background date snapshot, all rows/schema identical, source retained, automatic panel update, collision/recovery, restart dedup, unload cleanup');
  } finally { server.stop(); reloaded?.stopCaptureMonitor(); writer.stdin.end('\n'); if (browser) await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
