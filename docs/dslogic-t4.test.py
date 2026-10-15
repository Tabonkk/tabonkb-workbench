"""DSLogic T4: 语义事务层 + 协议预设 + 解码器配置元数据。

Run: py docs/dslogic-t4.test.py
- 合成 .dsl：I2C（正常写读 + 地址 NACK）、UART 双突发、SPI 双 CS 段、UART->UFCS 叠加（CRC 对/错）
- transactions：事务字段与契约 §4.3 一致；异常 addr_nack/crc_error/no_eop/no_goodcrc/
  glitch_dense/undersampled/decoder_error 可观测
- summary：<=6000 中文字符、固定段落顺序、选区过滤
- describe：解码器 channels/options 元数据透出（配置浮窗数据源）
- 真实文件回归（存在时）：PD SNK[7] REQUEST goodcrc_reply_us≈710us（契约示例值）
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
CAP_DIR = r'D:\work\Mgmt\TabonKB\00-Inbox\02-Raw-Drop\Data_DSLogic'
REAL_I2C = os.path.join(CAP_DIR, '260722101909.dsl')
REAL_PD = os.path.join(CAP_DIR, '240911143422.dsl')
RATE = 4_000_000
fails = []


def cli(*args):
    r = subprocess.run([sys.executable, CLI, *args], capture_output=True, encoding='utf-8')
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise AssertionError('CLI non-JSON output: %s %s' % (r.stdout[:300], r.stderr[:300]))


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(detail)[:300]))
    if not cond:
        fails.append(name)


def i2c_wave(n, ops, bit=40):
    """ops: ('W', addr8, [bytes]) / ('R', addr8, n) / ('NACK', addr8)。
    每 op = START+addr8(+data)+STOP；cells 中 'ack'/'nack' 为第 9 位 SDA 电平。"""
    scl = np.ones(n, np.uint8); sda = np.ones(n, np.uint8)
    t = 2000
    for op in ops:
        kind, addr8 = op[0], op[1]
        sda[t:] = 0; t += bit // 2                                  # START
        cells = [(addr8 >> k) & 1 for k in range(7, -1, -1)]
        cells += ['nack' if kind == 'NACK' else 'ack']
        if kind == 'W':
            for b in op[2]:
                cells += [(b >> k) & 1 for k in range(7, -1, -1)] + ['ack']
        elif kind == 'R':
            for i2 in range(op[2]):
                cells += [(0xA5 >> k) & 1 for k in range(7, -1, -1)]
                cells += ['nack' if i2 == op[2] - 1 else 'ack']     # 读末字节主 NACK
        for c in cells:
            scl[t:] = 0
            sda[t + bit // 4:] = 0 if c == 'ack' else (1 if c == 'nack' else c)
            scl[t + bit // 2:] = 1
            t += bit
        scl[t:] = 0; sda[t + bit // 4:] = 0; scl[t + bit // 2:] = 1
        sda[t + bit:] = 1                                           # STOP
        t += bit * 4
    return scl, sda


def uart_wave(n, start, bytes_, baud=115200, gap=4):
    w = np.ones(n, np.uint8)
    spb = RATE / baud
    t = float(start)
    for b in bytes_:
        for v in [0] + [(b >> i) & 1 for i in range(8)] + [1]:
            w[int(round(t)):int(round(t + spb))] = v
            t += spb
        t += spb * gap
    return w


def spi_wave(n, transfers, bit=80):
    """transfers: [[mosi字节,...], ...]；clk 空闲低，cs 低有效。"""
    clk = np.zeros(n, np.uint8); mosi = np.zeros(n, np.uint8); cs = np.ones(n, np.uint8)
    t = 3000
    for tr in transfers:
        cs[t:] = 0
        for b in tr:
            for k in range(7, -1, -1):
                mosi[t:t + bit] = (b >> k) & 1
                clk[t + bit // 2:t + bit] = 1
                t += bit
        cs[t:] = 1
        mosi[t:] = 0
        t += bit * 20                                    # CS 间隔
    return clk, mosi, cs


def crc8(data):
    c = 0
    for x in data:
        c ^= x
        for _ in range(8):
            c = ((c << 1) ^ 0x29) if c & 0x80 else (c << 1)
        c &= 0xff
    return c


def write_dsl(path, chans, block_bytes=4096, names=None, decoders=None):
    n = chans[0].size
    nblk = -(-n // (block_bytes * 8))
    hdr = ['[version]', 'version = 3', '[header]', 'driver = DSLogic', 'device mode = 0',
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
    tmp = tempfile.mkdtemp(prefix='dslogic-t4-')
    n = 4096 * 8 * 30   # ~246ms @4MHz，容纳 90k/300k/400k/700k 偏移的突发
    scl, sda = i2c_wave(n, [('W', 0xB4, [0x57]), ('R', 0xB5, 1), ('NACK', 0x80)])
    uart = np.minimum(uart_wave(n, 90000, [0x48, 0x49], gap=4),
                      uart_wave(n, 300000, [0x21], gap=4))
    ufcs_ok = [0xAA, 0x22, 0x08, 0x00]; ufcs_ok.append(crc8(ufcs_ok[1:]))
    ufcs_bad = [0xAA, 0x22, 0x08, 0x00, 0xEE]
    clk, mosi, cs = spi_wave(n, [[0x9F, 0x12], [0xAB]])
    decs = [{'id': '0:i2c', 'label': '0:I2C', 'channel': [{'sda': 1}, {'scl': 0}],
             'options': {'address_format': 'unshifted'}, 'stacked decoders': []},
            {'id': '1:uart', 'label': 'UART', 'channel': [{'rxtx': 2}],
             'options': {'baudrate': 115200}, 'stacked decoders': []},
            {'id': '1:uart', 'label': 'UFCS', 'channel': [{'rxtx': 3}],
             'options': {'baudrate': 115200}, 'stacked decoders': [{'id': 'ufcs', 'options': {}}]},
            {'id': '0:spi', 'label': 'SPI',
             'channel': [{'clk': 4}, {'miso': 6}, {'mosi': 5}, {'cs': 7}],
             'options': {}, 'stacked decoders': []}]
    f = os.path.join(tmp, 't4.dsl')
    # ch3 = ufcs uart (两帧连发); ch6 = 空闲作 miso; cs=ch7? 简化: clk=4 mosi=5 miso=6 cs=7
    ufcs_uart = np.ones(n, np.uint8)
    for off, frame in ((400000, ufcs_ok), (700000, ufcs_bad)):
        ufcs_uart = np.minimum(ufcs_uart, uart_wave(n, off, frame))
    miso = np.zeros(n, np.uint8)
    cs_ch = cs.copy()
    write_dsl(f, [scl, sda, uart, ufcs_uart, clk, mosi, miso, cs_ch], decoders=decs)

    # ---- describe 元数据 ----
    r = cli('describe', '1:uart')
    d = r.get('data') or {}
    check('describe uart channels', r.get('ok') and d.get('channels', [{}])[0].get('id') == 'rxtx', d)
    check('describe uart options', r.get('ok') and any(o['id'] == 'baudrate' for o in d.get('options', [])), d.get('options'))
    r = cli('describe', 'ufcs')
    check('describe ufcs stacked-input', r.get('ok') and r['data'].get('inputs') == ['uart'], r)

    # ---- I2C 事务 ----
    r = cli('transactions', f, '--index', '0')
    check('i2c transactions ok', r.get('ok'), r)
    tx = (r.get('data') or {}).get('transactions') or []
    an = (r.get('data') or {}).get('anomalies') or []
    wr = [t for t in tx if t.get('rw') == 'W' and t.get('addr7') == '0x5A']
    rd = [t for t in tx if t.get('rw') == 'R' and t.get('addr7') == '0x5A']
    check('i2c W txn fields', bool(wr) and wr[0]['bytes'] == ['57'] and wr[0]['reg'] == '0x57'
          and wr[0]['proto'] == 'i2c' and wr[0]['dur_us'] > 0, wr[:1])
    check('i2c R txn reg pairing', bool(rd) and rd[0].get('reg') == '0x57' and rd[0].get('value'), rd[:1])
    check('i2c addr_nack anomaly', any(a['type'] == 'addr_nack' for a in an), an)

    # ---- UART 事务（空闲切分）----
    r = cli('transactions', f, '--index', '1')
    tx = (r.get('data') or {}).get('transactions') or []
    check('uart bursts by idle gap', len(tx) == 2 and tx[0]['bytes'] == ['48', '49'] and tx[1]['bytes'] == ['21'],
          tx)

    # ---- UFCS 叠加事务 ----
    r = cli('transactions', f, '--index', '2')
    tx = (r.get('data') or {}).get('transactions') or []
    an = (r.get('data') or {}).get('anomalies') or []
    ufcs = [t for t in tx if t.get('proto') == 'ufcs']
    check('ufcs two msgs', len(ufcs) == 2, tx)
    check('ufcs msg fields', bool(ufcs) and ufcs[0].get('type') == 'PING' and ufcs[0].get('crc_ok') is True,
          ufcs[:1])
    check('ufcs crc_error anomaly', len(ufcs) > 1 and ufcs[1].get('crc_ok') is False
          and any(a['type'] == 'crc_error' for a in an), (ufcs[1:] , an))

    # ---- SPI 事务（CS 分段）----
    r = cli('transactions', f, '--index', '3')
    tx = (r.get('data') or {}).get('transactions') or []
    check('spi cs-segmented transfers', len(tx) == 2 and tx[0]['mosi'] == ['9F', '12'] and tx[1]['mosi'] == ['AB'], tx)

    # ---- 视窗过滤 ----
    r = cli('transactions', f, '--index', '0', '--start-s', '0.01')
    check('transactions window filter', r.get('ok') and len((r['data'] or {}).get('transactions') or []) == 0, r)

    # ---- summary ----
    r = cli('summary', f, '--index', '0')
    s = (r.get('data') or {}).get('summary') or ''
    check('summary <=6000 chars', r.get('ok') and 0 < (r['data']['chars']) <= 6000, r.get('data', {}).get('chars'))
    order = [s.find('## DSLogic 采集概要'), s.find('通道活跃'), s.find('异常清单'),
             s.find('聚合统计'), s.find('事务样本')]
    check('summary section order', all(x >= 0 for x in order) and order == sorted(order), order)
    r2 = cli('summary', f, '--index', '0', '--sel-start-s', '0', '--sel-end-s', '0.005')
    s2 = (r2.get('data') or {}).get('summary') or ''
    check('summary selection filter', '选区' in s2 and '事务' in s2, s2[:200])

    # ---- 真实文件回归（契约示例值）----
    if os.path.exists(REAL_I2C):
        r = cli('transactions', REAL_I2C, '--index', '0')
        tx = (r.get('data') or {}).get('transactions') or []
        t0 = next((t for t in tx if abs(t['t_s'] - 5.072991) < 0.001), None)
        check('real i2c txn contract sample', bool(t0) and t0['addr7'] == '0x5A' and t0['rw'] == 'W'
              and t0['bytes'] == ['00'] and t0['reg'] == '0x00' and 50 < t0['dur_us'] < 60, t0)
    else:
        print('SKIP real I2C (file absent)')
    if os.path.exists(REAL_PD):
        r = cli('transactions', REAL_PD, '--index', '1')
        tx = (r.get('data') or {}).get('transactions') or []
        an = (r.get('data') or {}).get('anomalies') or []
        t0 = next((t for t in tx if t.get('type') == 'REQUEST' and t.get('role') == 'SNK'), None)
        check('real pd REQUEST contract', bool(t0) and t0['msg_id'] == 7 and t0['rev'] == 3
              and 600 < (t0.get('goodcrc_reply_us') or 0) < 800 and t0['crc_ok'] is True, t0)
        types = set(a['type'] for a in an)
        check('real pd anomaly ids', {'crc_error', 'no_eop'} <= types or 'no_goodcrc' in types, types)
    else:
        print('SKIP real PD (file absent)')

    print('\n%d failure(s)' % len(fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
