"""DSLogic P0 regression: .dsl reader + pure-Python decoder runtime.

Run: py docs/dslogic-p0.test.py
- Synthetic .dsl (multi-block, block-boundary edges): I2C, UART->UFCS stacking, error paths.
- Real-file regression (skipped when files are absent): DSView CSV 1:1 match, USB PD decode.
"""
import json
import os
import subprocess
import sys
import tempfile
import zipfile

import numpy as np

PLUGIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = os.path.join(PLUGIN, 'services', 'dslogic', 'dslogic_cli.py')
REAL_I2C = r'C:\Users\Administrator\Desktop\DSLogic PLus-la-260722-101909.dsl'
REAL_I2C_CSV = r'D:\work\Mgmt\TabonKB\07-Project\2026-dsview\test\decoder--261013-171418.csv'
REAL_PD = r'D:\work\prj\R65\关机不能reset 5V.dsl'
RATE = 4_000_000
fails = []


def cli(*args):
    r = subprocess.run([sys.executable, CLI, *args], capture_output=True, encoding='utf-8')
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise AssertionError('CLI non-JSON output: %s %s' % (r.stdout[:300], r.stderr[:300]))


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(detail)))
    if not cond:
        fails.append(name)


def i2c_wave(n, bytes_, bit=40):
    scl = np.ones(n, np.uint8); sda = np.ones(n, np.uint8)
    t = 1000 + 3  # odd offset so edges straddle 8-sample bytes
    sda[t:] = 0; t += bit // 2            # START: SDA falls while SCL high
    for b in bytes_:
        for k in list(range(7, -1, -1)) + ['ack']:
            scl[t:] = 0
            v = 0 if k == 'ack' else (b >> k) & 1
            sda[t + bit // 4:] = v
            scl[t + bit // 2:] = 1
            t += bit
    scl[t:] = 0; sda[t + bit // 4:] = 0; scl[t + bit // 2:] = 1
    sda[t + bit:] = 1                     # STOP: SDA rises while SCL high
    return scl, sda


def crc8(data):
    c = 0
    for x in data:
        c ^= x
        for _ in range(8):
            c = ((c << 1) ^ 0x29) if c & 0x80 else (c << 1)
        c &= 0xff
    return c


def uart_wave(n, start, bytes_, baud=115200):
    w = np.ones(n, np.uint8)
    spb = RATE / baud
    t = float(start)
    for b in bytes_:
        bits = [0] + [(b >> i) & 1 for i in range(8)] + [1]
        for v in bits:
            w[int(round(t)):int(round(t + spb))] = v
            t += spb
        t += spb * 2
    return w


def write_dsl(path, chans, block_bytes=4096, version=3, names=None, decoders=None):
    n = chans[0].size
    nblk = -(-n // (block_bytes * 8))
    hdr = ['[version]', 'version = %d' % version, '[header]', 'driver = DSLogic', 'device mode = 0',
           'capturefile = data', 'total samples = %d' % n, 'total probes = %d' % len(chans),
           'total blocks = %d' % nblk, 'samplerate = 4 MHz', 'trigger time = 1784686749692', 'trigger pos = 0']
    hdr += ['probe%d = %s' % (i, (names or {}).get(i, str(i))) for i in range(len(chans))]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('header', '\n'.join(hdr) + '\n')
        z.writestr('session', json.dumps({'Version': 3, 'Sample rate': str(RATE), 'channel': [
            {'index': i, 'enabled': True, 'name': str(i)} for i in range(len(chans))]}))
        z.writestr('decoders', json.dumps(decoders or []))
        for ci, c in enumerate(chans):
            packed = np.packbits(c, bitorder='little').tobytes()
            for b in range(nblk):
                z.writestr('L-%d/%d' % (ci, b), packed[b * block_bytes:(b + 1) * block_bytes])


def main():
    tmp = tempfile.mkdtemp(prefix='dslogic-test-')
    n = 4096 * 8 * 3 - 8 * 100  # 3 blocks, last one partial
    scl, sda = i2c_wave(n, [0xB4, 0x57])
    ufcs = [0xAA, 0x22, 0x08, 0x00]
    ufcs.append(crc8(ufcs[1:]))
    uart = uart_wave(n, 33000, ufcs)
    # Force an edge exactly on a block boundary
    edge_ch = np.zeros(n, np.uint8); edge_ch[4096 * 8:] = 1
    decs = [{'id': '0:i2c', 'label': '0:I2C', 'channel': [{'sda': 1}, {'scl': 0}],
             'options': {'address_format': 'unshifted'}, 'stacked decoders': []},
            {'id': '1:uart', 'label': 'UFCS', 'channel': [{'rxtx': 2}], 'options': {'baudrate': 115200},
             'stacked decoders': [{'id': 'ufcs', 'options': {}}]}]
    f = os.path.join(tmp, 'synthetic.dsl')
    write_dsl(f, [scl, sda, uart, edge_ch], decoders=decs)

    r = cli('info', f)
    check('info ok', r.get('ok'), r)
    if r.get('ok'):
        d = r['data']
        check('info total samples', d['total_samples'] == n, d['total_samples'])
        check('info block-boundary edge', d['channels'][3]['edges'] == 1 and d['channels'][3]['init'] == 0,
              d['channels'][3])
        expect_scl = int((np.diff(scl.astype(int)) != 0).sum())
        check('info SCL edge count', d['channels'][0]['edges'] == expect_scl, (d['channels'][0], expect_scl))
        check('info decoders listed', [x['id'] for x in d['decoders']] == ['0:i2c', '1:uart'], d['decoders'])

    r = cli('decode', f, '--index', '0')
    texts = [x['texts'][0] for x in r['data']['rows']] if r.get('ok') else r
    check('i2c decode sequence', texts == ['Start', 'Address write: B4', 'Write', 'ACK', 'Data write: 57', 'ACK', 'Stop'], texts)

    r = cli('decode', f, '--index', '1', '--limit', '1000')
    ok = r.get('ok')
    ufcs_rows = [x for x in r['data']['rows'] if x['dec'] == 'ufcs'] if ok else []
    check('uart->ufcs stacked decode', ok and any('PING' in ' '.join(x['texts']) for x in ufcs_rows), r if not ok else ufcs_rows)
    check('ufcs crc ok', ok and not any('CRC!' in x['texts'] for x in ufcs_rows), ufcs_rows)

    r = cli('decode', f, '--decoder', '0:i2c', '--pins', '{"scl": 0}')
    check('missing channel -> explicit error', not r.get('ok') and 'sda' in r.get('error', ''), r)
    r = cli('decode', f, '--decoder', 'no_such', '--pins', '{}')
    check('unknown decoder -> explicit error', not r.get('ok') and 'no_such' in r.get('error', ''), r)
    bad = os.path.join(tmp, 'bad.dsl'); open(bad, 'wb').write(b'not a zip')
    r = cli('info', bad)
    check('non-zip -> explicit error', not r.get('ok'), r)
    v2 = os.path.join(tmp, 'v2.dsl'); write_dsl(v2, [scl], version=2)
    r = cli('info', v2)
    check('unsupported version -> explicit error', not r.get('ok') and '版本' in r.get('error', ''), r)

    if os.path.exists(REAL_I2C) and os.path.exists(REAL_I2C_CSV):
        r = cli('verify-csv', REAL_I2C, REAL_I2C_CSV)
        check('real I2C vs DSView CSV 1:1', r.get('ok') and r['data']['match'] and r['data']['ref'] == 1689, r)
    else:
        print('SKIP real I2C (file absent)')
    if os.path.exists(REAL_PD):
        r = cli('decode', REAL_PD, '--index', '1', '--limit', '0')
        c = r['data']['counts'] if r.get('ok') else {}
        check('real PD decode', r.get('ok') and not r['data'].get('decoder_error') and
              c.get('usb_power_delivery/src', 0) + c.get('usb_power_delivery/snk', 0) == 52, r if not r.get('ok') else c)
    else:
        print('SKIP real PD (file absent)')

    print('\n%d failure(s)' % len(fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
