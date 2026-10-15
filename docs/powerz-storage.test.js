'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PowerZService } = require('../services/powerz-service.js');

async function main() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'powerz-storage-test-'));
  const vault = path.join(fixture, 'vault with spaces');
  const service = new PowerZService({ vaultBasePath: vault });
  const official = path.join(vault, '.obsidian', 'plugins', 'tabonkb-workbench', 'vendor', 'powerz', 'official');
  assert.equal(service.getOfficialDir(), official);
  assert.equal(service.getCaptureDir(), path.join(vault, '00-Inbox', '02-Raw-Drop', 'Data_powerZ'));
  assert.equal(new PowerZService().getPluginDir(), path.resolve(__dirname, '..'));
  assert.equal(PowerZService.formatCaptureName(new Date('2026-10-12T04:34:56Z')), '261012123456');
  assert.equal(PowerZService.formatCaptureName(new Date('2026-10-11T16:00:00Z')), '261012000000');
  assert.throws(() => PowerZService.formatCaptureName(new Date('invalid')), /无效/);

  fs.mkdirSync(official, { recursive: true });
  fs.mkdirSync(service.getCaptureDir(), { recursive: true });
  // Placeholders are never executed; process spawning is stubbed below.
  fs.writeFileSync(path.join(official, 'Mtools.exe'), '');
  fs.writeFileSync(path.join(official, 'PDM.exe'), '');
  fs.writeFileSync(path.join(service.getCaptureDir(), '261012123456.db'), 'existing recording');
  assert.throws(() => service.createCaptureName(new Date('2026-10-12T04:34:56Z')), /重名/);
  assert.equal(fs.readFileSync(path.join(service.getCaptureDir(), '261012123456.db'), 'utf8'), 'existing recording');
  service._lastCaptureName = '261012123457';
  assert.throws(() => service.createCaptureName(new Date('2026-10-12T04:34:57Z')), /重名/);
  service._lastCaptureName = null;
  for (const name of ['../outside.db', '..\\outside.db', 'C:outside.db', '..', 'bad\0.db']) {
    assert.throws(() => service.resolveCapturePath(name), /非法/);
  }

  const calls = [];
  service._execFileAsync = async (cmd, args) => { calls.push({ cmd, args }); return { err: null, stdout: '', stderr: '' }; };
  const prefs = await service.applyOfficialPrefs('261012123458');
  assert.equal(prefs.captureFile, path.join(service.getCaptureDir(), '261012123458.db'));
  assert.equal(calls.length, 4);
  const values = Object.fromEntries(calls.map(c => [c.args[3], c.args[7]]));
  const slashDir = service.getCaptureDir().replace(/\\/g, '/');
  assert.equal(values.autoSavePath, slashDir);
  assert.equal(values.autoSaveName, '261012123458');
  assert.equal(values.LastSaveFilePath, slashDir + '/261012123458.db');
  assert.equal(values.analyzerPath, slashDir);
  assert(calls.every(c => c.cmd === 'reg' && c.args[8] === '/f'));
  await assert.rejects(service.applyOfficialPrefs('261012123456'), /拒绝覆盖/);
  await assert.rejects(service.applyOfficialPrefs('yyMMddhhmmss'), /非法/);

  let spawned = 0;
  service._spawnDetached = async () => { spawned++; };
  service._execFileAsync = async cmd => cmd === 'tasklist'
    ? { err: null, stdout: '', stderr: '' }
    : { err: new Error('access denied'), stdout: '', stderr: 'access denied' };
  const failed = await service.launchOfficial();
  assert.equal(failed.ok, false);
  assert.match(failed.message, /官方设置失败/);
  assert.equal(spawned, 0);

  service._execFileAsync = async () => ({ err: null, stdout: '"Mtools.exe","123"', stderr: '' });
  const running = await service.launchOfficial();
  assert.equal(running.ok, false);
  assert.match(running.message, /已运行/);
  assert.equal(spawned, 0);

  calls.length = 0;
  service._execFileAsync = async (cmd, args) => { calls.push({ cmd, args }); return { err: null, stdout: '', stderr: '' }; };
  assert.equal((await service.launchOfficial('PDM')).ok, true);
  assert.equal(spawned, 1);
  assert.equal(calls.filter(c => c.cmd === 'reg').length, 0);
  assert.equal((await service.launchOfficial('invalid')).ok, false);

  service._spawnDetached = async () => { throw new Error('spawn blocked'); };
  const spawnFailure = await service.launchOfficial('Mtools');
  assert.equal(spawnFailure.ok, false);
  assert.match(spawnFailure.message, /spawn blocked/);
  assert.equal(service._launchPromise, null);

  const empty = new PowerZService({ vaultBasePath: path.join(fixture, 'empty') });
  assert.deepEqual(empty.listCaptures(), []);
  assert.equal(empty.getStorageInfo().captureDir, empty.getCaptureDir());
  assert.equal(empty.getStorageInfo().namingTime, 'last-write');

  // Listing is read-only; neither active nor released curve workfiles are moved.
  const finalizer = new PowerZService({ captureDir: path.join(fixture, "vault's recordings") });
  fs.mkdirSync(finalizer.getCaptureDir(), { recursive: true });
  const raw = '261012100000_10_12_12_34_59.db';
  fs.writeFileSync(finalizer.resolveCapturePath(raw), 'source retained');
  assert.deepEqual(await finalizer.prepareCaptures(), { status: 'background', renamed: [], pending: [] });
  assert.equal(fs.readFileSync(finalizer.resolveCapturePath(raw), 'utf8'), 'source retained');
  assert.equal(finalizer.getStorageInfo().finalizeOn, 'background-after-sample-idle');
  assert.equal(finalizer.getStorageInfo().adcSourceRetained, true);

  // PD working file is retained; background archive owns its lifecycle.
  const pdDir = path.join(fixture, 'pd recordings');
  const pdService = new PowerZService({ captureDir: pdDir });
  fs.mkdirSync(pdDir, { recursive: true });
  fs.writeFileSync(path.join(pdDir, 'pd.sqlite'), 'official workfile');
  assert.deepEqual((await pdService.prepareCaptures()).renamed, []);
  assert.equal(fs.readFileSync(path.join(pdDir, 'pd.sqlite'), 'utf8'), 'official workfile');
  assert(pdService.listCaptures().some(f => f.name === 'pd.sqlite'));
  assert.equal(pdService.getStorageInfo().pdFinalizeOn, 'background-after-save');
  console.log('PASS: PD workfile retained; background archive metadata');

  console.log('PASS: curve source retained; listing does not finalize/rename; background completion metadata');

  console.log('PASS: portable paths, Shanghai timestamps, collision protection, filename boundaries, registry values, failure handling, running-process guard, PDM isolation, empty-directory metadata');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
