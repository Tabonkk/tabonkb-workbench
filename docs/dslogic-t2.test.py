"""DSLogic T2 regression: persistent worker, wave window, decode cache, import.

Run: py docs/dslogic-t2.test.py
- Worker level (stdio NDJSON): wave edges/dense pixel-exact vs reference computed
  directly from the edge table (window start on high/low level, boundary edges),
  decode paging on cache hits, close/ping.
- Service level (node -e): import naming/conflict/same-content/non-.dsl rules,
  worker kill -> next request auto-recovers, mid-request crash -> retry once.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile

import numpy as np

PLUGIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKER = os.path.join(PLUGIN, 'services', 'dslogic', 'dslogic_worker.py')
SERVICE_JS = os.path.join(PLUGIN, 'services', 'dslogic-service.js').replace('\\', '/')
VAULT = os.path.dirname(os.path.dirname(os.path.dirname(PLUGIN)))  # .../TabonKB
sys.path.insert(0, os.path.join(PLUGIN, 'services', 'dslogic'))
from dsl_reader import DslFile  # noqa: E402

REAL_I2C = os.path.join(VAULT, '00-Inbox', '02-Raw-Drop', 'Data_DSLogic', '260722101909.dsl')
REAL_PD = os.path.join(VAULT, '00-Inbox', '02-Raw-Drop', 'Data_DSLogic', '240911143422.dsl')
RATE = 4_000_000
fails = []


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(detail)[:500]))
    if not cond:
        fails.append(name)


class Worker:
    def __init__(self):
        self.p = subprocess.Popen([sys.executable, WORKER], stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  text=True, encoding='utf-8', bufsize=1)
        hello = json.loads(self.p.stdout.readline())
        assert hello.get('ok'), hello
        self._id = 0

    def call(self, method, params=None):
        self._id += 1
        self.p.stdin.write(json.dumps({'id': self._id, 'method': method, 'params': params or {}}) + '\n')
        self.p.stdin.flush()
        while True:
            r = json.loads(self.p.stdout.readline())
            if r.get('id') == self._id:
                return r

    def close(self):
        try:
            self.p.stdin.close()
            self.p.wait(timeout=10)
        except Exception:
            self.p.kill()


def write_dsl(path, chans, block_bytes=4096, rate=RATE, trig_ms=1784686749692, names=None, decoders=None):
    n = chans[0].size
    nblk = -(-n // (block_bytes * 8))
    hdr = ['[version]', 'version = 3', '[header]', 'driver = DSLogic', 'device mode = 0',
           'capturefile = data', 'total samples = %d' % n, 'total probes = %d' % len(chans),
           'total blocks = %d' % nblk, 'samplerate = 4 MHz', 'trigger time = %d' % trig_ms,
           'trigger pos = 0']
    hdr += ['probe%d = %s' % (i, (names or {}).get(i, str(i))) for i in range(len(chans))]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('header', '\n'.join(hdr) + '\n')
        z.writestr('session', json.dumps({'Version': 3, 'channel': [
            {'index': i, 'enabled': True, 'name': str(i)} for i in range(len(chans))]}))
        z.writestr('decoders', json.dumps(decoders or []))
        for ci, c in enumerate(chans):
            packed = np.packbits(c, bitorder='little').tobytes()
            for b in range(nblk):
                z.writestr('L-%d/%d' % (ci, b), packed[b * block_bytes:(b + 1) * block_bytes])


def bits_to_edges(init, bits):
    e = np.flatnonzero(bits[1:] != bits[:-1]).astype(np.int64) + 1
    if bits.size and bits[0] != init:
        e = np.concatenate([[0], e])
    return e


def ref_wave(init, edges, start, end, px):
    """Straightforward per-pixel reference computed directly from the edge table.

    Integer math throughout: pixel(e) = (e-start)*px//span; bucket i covers
    [start+i*span//px, start+(i+1)*span//px); level(s) counts edges <= s.
    """
    ein = [e for e in edges if start <= e < end]
    lv = init ^ (sum(1 for e in edges if e <= start) & 1)
    if len(ein) <= 2 * px or end - start <= 0:
        return {'index': None, 'init_level': lv, 'mode': 'edges', 'edges': ein}
    span = end - start
    buckets = []
    for i in range(px):
        lo = start + (i * span) // px
        hi = start + ((i + 1) * span) // px
        if any((e - start) * px // span == i for e in ein):
            buckets.append(2)
        else:
            buckets.append(init ^ (sum(1 for e in edges if e <= lo) & 1))
    return {'index': None, 'init_level': lv, 'mode': 'dense', 'buckets': buckets}


def wave_case(wk, f, name, init, edges, start, end, px, chan=0):
    r = wk.call('wave', {'file': f, 'start': start, 'end': end, 'px': px, 'channels': [chan]})
    if not r.get('ok'):
        check('wave ' + name, False, r)
        return
    got = r['data']['channels'][0]
    exp = ref_wave(init, edges, start, end, px)
    exp['index'] = chan
    check('wave ' + name, got == exp, {'got': got, 'exp': exp})


def node_eval(script, env=None, timeout=240):
    e = dict(os.environ)
    e.update(env or {})
    r = subprocess.run(['node', '-e', script], capture_output=True, encoding='utf-8',
                       env=e, timeout=timeout)
    line = (r.stdout or '').strip().splitlines()
    if not line:
        return {'fatal': 'no output', 'stderr': (r.stderr or '')[-400:]}
    try:
        return json.loads(line[-1])
    except ValueError:
        return {'fatal': 'bad json', 'stdout': r.stdout[-400:], 'stderr': r.stderr[-400:]}


def main():
    tmp = tempfile.mkdtemp(prefix='dslogic-t2-')

    # ---- synthetic capture for wave tests ----
    n = 200
    ch0 = np.zeros(n, np.uint8); ch0[10:20] = 1; ch0[30:40] = 1; ch0[50:60] = 1  # init0 edges[10,20,30,40,50,60]
    ch1 = np.ones(n, np.uint8); ch1[8:20] = 0                                  # init1 edges[8,20]
    ch2 = np.tile(np.repeat([0, 1], 2), n // 4 + 1)[:n].astype(np.uint8)       # init0 edges every 2 samples
    ch3 = np.ones(n, np.uint8)                                                 # constant, 0 edges
    f = os.path.join(tmp, 'wave.dsl')
    write_dsl(f, [ch0, ch1, ch2, ch3])
    e0 = bits_to_edges(0, ch0).tolist()
    e1 = bits_to_edges(1, ch1).tolist()
    e2 = bits_to_edges(0, ch2).tolist()

    wk = Worker()
    wave_case(wk, f, 'edges win-start high', 0, e0, 15, 35, 10)
    wave_case(wk, f, 'edges win-start low', 0, e0, 25, 45, 10)
    wave_case(wk, f, 'edges edge-at-start', 0, e0, 20, 35, 10)
    wave_case(wk, f, 'edges edge-at-end', 0, e0, 10, 20, 10)
    wave_case(wk, f, 'edges init1 win0', 1, e1, 0, 4, 4, chan=1)
    wave_case(wk, f, 'edges init1 edge-at-start', 1, e1, 8, 15, 4, chan=1)
    wave_case(wk, f, 'edges empty-chan', 1, [], 0, 100, 8, chan=3)
    wave_case(wk, f, 'dense full', 0, e2, 0, n, 8, chan=2)
    wave_case(wk, f, 'dense sub-window', 0, e2, 33, 171, 16, chan=2)
    wave_case(wk, f, 'dense edge-at-bounds', 0, e2, 4, 68, 10, chan=2)

    r = wk.call('wave', {'file': f, 'start': 0, 'end': n, 'px': 8})
    got = [c['index'] for c in r['data']['channels']] if r.get('ok') else r
    check('wave default channels = active only', got == [0, 1, 2], got)

    r = wk.call('wave', {'file': f, 'start': 0, 'end': n, 'px': 5000})
    check('wave px>4096 rejected', not r.get('ok') and 'px' in r.get('error', ''), r)
    r = wk.call('wave', {'file': f, 'channels': [9], 'px': 10})
    check('wave bad channel rejected', not r.get('ok'), r)
    r = wk.call('ping')
    check('ping', r.get('ok') and r['data']['ready'], r)
    r = wk.call('close', {'file': f})
    check('close evicts file', r.get('ok') and r['data']['closed'], r)
    r = wk.call('info', {'file': f})
    check('info after close reopens', r.get('ok') and r['data']['total_samples'] == n, r)

    # ---- real file: wave timing + decode cache timing ----
    if os.path.exists(REAL_I2C):
        wk.call('info', {'file': REAL_I2C})  # warm edge cache
        t0 = time.perf_counter()
        r = wk.call('wave', {'file': REAL_I2C, 'start': 0, 'end': 162820096, 'px': 2000})
        t_wave = time.perf_counter() - t0
        check('real wave ok', r.get('ok') and len(r['data']['channels']) == 2, r if not r.get('ok') else 'ok')
        check('real wave <=50ms (cache warm)', t_wave <= 0.05, '%.1fms' % (t_wave * 1000))
        # dense window on ch1 vs reference computed from the real edge table
        r = wk.call('wave', {'file': REAL_I2C, 'start': 4359000, 'end': 4379000, 'px': 64, 'channels': [1]})
        dsl = DslFile(REAL_I2C)
        init_r, edges_r = dsl.load_edges()
        exp = ref_wave(init_r[1], edges_r[1].tolist(), 4359000, 4379000, 64)
        dsl.zip.close()
        if r.get('ok'):
            exp['index'] = 1
            check('real dense pixel-exact', r['data']['channels'][0] == exp,
                  {'got': str(r['data']['channels'][0])[:300], 'exp': str(exp)[:300]})
        else:
            check('real dense pixel-exact', False, r)

        t0 = time.perf_counter()
        r0 = wk.call('decode', {'file': REAL_I2C, 'index': 0, 'offset': 0, 'limit': 50})
        t_first = time.perf_counter() - t0
        check('decode first ok', r0.get('ok') and r0['data']['total'] == 1689, r0 if not r0.get('ok') else 'ok')
        t0 = time.perf_counter()
        ok_all, rows_ok = True, True
        prev = None
        for i in range(20):
            off = (i * 80) % 1600
            rr = wk.call('decode', {'file': REAL_I2C, 'index': 0, 'offset': off, 'limit': 50})
            if not (rr.get('ok') and rr['data']['offset'] == off):
                ok_all = False
            if rr.get('ok') and prev is not None and rr['data']['rows'] and rr['data']['rows'] == prev:
                rows_ok = False
            prev = rr['data']['rows'] if rr.get('ok') else None
        t_pages = time.perf_counter() - t0
        check('decode 20 paged ok', ok_all, 'ok' if ok_all else 'fail')
        check('decode 20 paged < first+2s', t_pages < t_first + 2.0,
              'first=%.2fs pages=%.2fs' % (t_first, t_pages))
        # cache-hit correctness vs fresh CLI (different process, same answer)
        r_cli = subprocess.run([sys.executable, os.path.join(os.path.dirname(WORKER), 'dslogic_cli.py'),
                                'decode', REAL_I2C, '--index', '0', '--offset', '160', '--limit', '10'],
                               capture_output=True, encoding='utf-8')
        rr = wk.call('decode', {'file': REAL_I2C, 'index': 0, 'offset': 160, 'limit': 10})
        same = rr.get('ok') and json.loads(r_cli.stdout)['data']['rows'] == rr['data']['rows']
        check('cached rows == CLI rows', same, 'mismatch')
    else:
        print('SKIP real file tests (absent)')

    # ---- R6: decode overlap 语义 (es>=start_s 且 ss<=end_s) ----
    if os.path.exists(REAL_PD):
        rp = wk.call('decode', {'file': REAL_PD, 'index': 1, 'offset': 0, 'limit': 2000})
        if rp.get('ok') and rp['data']['rows']:
            rate = rp['data']['samplerate']
            long_ann = next((x for x in rp['data']['rows'] if x['es'] - x['ss'] > rate * 0.0004), None)
            if long_ann:
                mid_s = (long_ann['ss'] + long_ann['es']) / 2 / rate
                win = {'start_s': mid_s - 0.0001, 'end_s': mid_s + 0.0001}  # ±100µs < ann 半宽
                r_no = wk.call('decode', {'file': REAL_PD, 'index': 1, 'limit': 2000, **win})
                r_ov = wk.call('decode', {'file': REAL_PD, 'index': 1, 'limit': 2000, 'overlap': True, **win})
                key = lambda x: (x['ss'], x['es'], x['ann'])
                in_no = any(key(x) == key(long_ann) for x in r_no['data']['rows'])
                in_ov = any(key(x) == key(long_ann) for x in r_ov['data']['rows'])
                check('overlap keeps spanning ann (R6)', r_ov.get('ok') and in_ov and not in_no,
                      {'ss': long_ann['ss'], 'es': long_ann['es'], 'mid_s': mid_s,
                       'in_no': in_no, 'in_ov': in_ov})
            else:
                check('overlap keeps spanning ann (R6)', False, 'no ann >2ms in PD decode')
        else:
            check('overlap keeps spanning ann (R6)', False, rp if not rp.get('ok') else 'no rows')
    else:
        print('SKIP overlap test (PD file absent)')

    wk.close()

    # ---- service level: import rules + worker recovery ----
    imp_dir = os.path.join(tmp, 'captures')
    src = os.path.join(tmp, 'src.dsl')
    write_dsl(src, [ch0], trig_ms=1784686749692)  # -> 260722101909.dsl expected name

    js_pre = ("const path=require('path'),fs=require('fs');"
              "const {DSLogicService}=require('%s');"
              "const svc=new DSLogicService({vaultBasePath:'%s',"
              "  captureDir:process.env.IMP_DIR||undefined});"
              "(async()=>{" % (SERVICE_JS, VAULT.replace('\\', '/')))
    env = {'IMP_DIR': imp_dir, 'SRC': src, 'REAL': REAL_I2C.replace('\\', '/')}

    out = node_eval(js_pre + """
      const r1 = await svc.importCapture(process.env.SRC);
      const r2 = await svc.importCapture(process.env.SRC);
      const other = process.env.IMP_DIR + '/other.dsl';
      fs.copyFileSync(process.env.SRC, other);
      const buf = Buffer.from('x'); fs.appendFileSync(other, buf); // same trig, diff content
      let r3; try { r3 = await svc.importCapture(other); } catch(e) { r3 = {error: e.message}; }
      let r4; try { r4 = await svc.importCapture(process.env.IMP_DIR + '/x.txt'); } catch(e) { r4 = {error: e.message}; }
      let r5; try { r5 = await svc.importCapture(process.env.IMP_DIR + '/nope.dsl'); } catch(e) { r5 = {error: e.message}; }
      svc.dispose();
      console.log(JSON.stringify({r1, r2, r3, r4, r5}));
    })().catch(e=>{console.log(JSON.stringify({fatal:String(e&&e.message||e)}))});
    """, env)
    check('import names by trigger time', out.get('r1', {}).get('name') == '260722101909.dsl' and not out['r1'].get('existed'), out)
    check('import same content -> existed', out.get('r2', {}).get('existed') is True, out)
    check('import naming conflict rejected', '命名冲突' in out.get('r3', {}).get('error', ''), out)
    check('import non-.dsl rejected', '.dsl' in out.get('r4', {}).get('error', ''), out)
    check('import missing src rejected', '不存在' in out.get('r5', {}).get('error', ''), out)
    if out.get('r1', {}).get('name'):
        imported = os.path.join(imp_dir, out['r1']['name'])
        if os.path.exists(imported):
            d = DslFile(imported)
            check('imported readable', d.total == n, d.total)
            d.zip.close()
        else:
            check('imported readable', False, imported)

    # trigger time = 0 falls back to file mtime
    src2 = os.path.join(tmp, 'src0.dsl')
    write_dsl(src2, [ch0], trig_ms=0)
    env2 = dict(env); env2['SRC2'] = src2
    out = node_eval(js_pre + """
      const r = await svc.importCapture(process.env.SRC2);
      svc.dispose();
      console.log(JSON.stringify(r));
    })().catch(e=>{console.log(JSON.stringify({fatal:String(e&&e.message||e)}))});
    """, env2)
    expect_name = time.strftime('%y%m%d%H%M%S', time.gmtime(os.path.getmtime(src2) + 8 * 3600)) + '.dsl'
    check('import trigger=0 uses mtime', out.get('name') == expect_name, (out.get('name'), expect_name))

    # kill recovery + mid-request retry (uses real file when present)
    if os.path.exists(REAL_I2C):
        env3 = dict(env)
        env3.pop('IMP_DIR', None)  # default captureDir = vault Data_DSLogic
        out = node_eval(js_pre + """
          const f = require('path').basename(process.env.REAL); // Data_DSLogic 下纯文件名
          const i1 = await svc.info(f);
          const pid1 = svc._worker.pid;
          svc._worker.kill();
          await new Promise(r=>setTimeout(r,300));
          const i2 = await svc.info(f);
          const pid2 = svc._worker.pid;
          const p = svc.decode(f, {index:0, limit:5});
          setTimeout(()=>{ try{svc._worker.kill();}catch(e){} }, 400);
          const d = await p;
          svc.dispose();
          console.log(JSON.stringify({i1:i1.total_samples, i2:i2.total_samples, restarted: pid2!==pid1,
                                      retry_rows: d.rows && d.rows.length}));
        })().catch(e=>{console.log(JSON.stringify({fatal:String(e&&e.message||e)}))});
        """, env3)
        check('worker kill -> next request recovers', out.get('i2') == 162820096 and out.get('restarted'), out)
        check('mid-request crash -> retry once ok', out.get('retry_rows') == 5, out)

        # T3-8: per-method timeouts + explicit param errors (service layer)
        out = node_eval(js_pre + """
          const f = require('path').basename(process.env.REAL);
          const tryCall = async (fn) => { try { await fn(); return null; } catch(e) { return e.message; } };
          const errs = {
            waveStartEnd: await tryCall(()=>svc.wave(f,{start:5,end:2})),
            wavePx:       await tryCall(()=>svc.wave(f,{px:'abc'})),
            wavePxFloat:  await tryCall(()=>svc.wave(f,{px:2.5})),
            waveCh:       await tryCall(()=>svc.wave(f,{ch:'0,x'})),
            waveChArr:    await tryCall(()=>svc.wave(f,{channels:[0,'q']})),
            decLimit:     await tryCall(()=>svc.decode(f,{index:0,limit:'x'})),
            decIndex:     await tryCall(()=>svc.decode(f,{index:'q'})),
            decRange:     await tryCall(()=>svc.decode(f,{index:0,start_s:2,end_s:1}))
          };
          const okWave = await svc.wave(f,{start:0,end:200,px:4,ch:'0'});
          const svc2 = new DSLogicService({});
          svc2._worker = { stdin: { write(){} } };
          svc2._workerReady = true;
          const rDec = svc2._request('decode', {}); rDec.catch(()=>{});
          const rInf = svc2._request('info', {});   rInf.catch(()=>{});
          await new Promise(r=>setTimeout(r,0)); // 等 _ensureWorker().then 注册进 _pending
          const pend = [...svc2._pending.values()];
          const dto = pend.find(p=>p.method==='decode').timeoutMs;
          const ito = pend.find(p=>p.method==='info').timeoutMs;
          svc2.dispose();
          svc.dispose();
          console.log(JSON.stringify({errs, dto, ito, okWave: okWave.channels.length}));
        })().catch(e=>{console.log(JSON.stringify({fatal:String(e&&e.message||e)}))});
        """, env3)
        er = out.get('errs', {})
        check('svc wave start>end rejected', er.get('waveStartEnd') and 'start 必须 <= end' in er['waveStartEnd'], er)
        check('svc wave px=abc rejected', er.get('wavePx') and 'px 非法' in er['wavePx'], er)
        check('svc wave px=2.5 rejected', er.get('wavePxFloat') and 'px 非法' in er['wavePxFloat'], er)
        check('svc wave ch=0,x rejected', er.get('waveCh') and 'ch 非法' in er['waveCh'], er)
        check('svc wave channels non-int rejected', er.get('waveChArr') and 'channels 非法' in er['waveChArr'], er)
        check('svc decode limit=x rejected', er.get('decLimit') and 'limit 非法' in er['decLimit'], er)
        check('svc decode index=q rejected', er.get('decIndex') and 'index 非法' in er['decIndex'], er)
        check('svc decode start_s>end_s rejected', er.get('decRange') and 'start_s 必须 <= end_s' in er['decRange'], er)
        check('svc valid wave still works', out.get('okWave') == 1, out)
        check('decode timeout = 300s', out.get('dto') == 300000, out.get('dto'))
        check('info timeout = 60s', out.get('ito') == 60000, out.get('ito'))
    else:
        print('SKIP service recovery (real file absent)')

    print('\n%d failure(s)' % len(fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
