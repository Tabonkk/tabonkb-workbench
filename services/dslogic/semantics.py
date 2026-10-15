"""DSLogic 语义事务层：把官方解码器输出的行级注解聚合成协议事务，
并产出标准异常清单。仅依赖 decode 已产出的注解（dec/ann/row/cls/texts/
ss/es）与少量原始边沿信息（SPI CS 分段、毛刺/欠采样判定），不修改上游
解码器行为。

对外入口：
  build_transactions(dsl, spec, anns, error, init=None, edges=None)
      -> {'transactions': [...], 'anomalies': [...], 'stats': {...}}
  build_summary(dsl, spec, anns, tx, anomalies, info=None,
                sel_start_s=None, sel_end_s=None) -> markdown str (<=6000 中文字符)

事务/异常契约见 docs/DSLOGIC_ARCHITECTURE.md §4.3 / §6。
"""
import os
import re
from collections import Counter

# dec id -> 协议族。DSView 解码器 id 形如 '0:i2c'/'1:uart'/'usb_power_delivery'
_FAMILY = [
    ('ufcs', 'ufcs'),
    ('usb_power_delivery', 'pd'),
    ('i2c', 'i2c'),
    ('uart', 'uart'),
    ('spi', 'spi'),
]


def family_of(dec_id):
    d = (dec_id or '').lower()
    for key, fam in _FAMILY:
        if key in d:
            return fam
    return None


def spec_family(spec):
    """spec 对应的协议族：优先看栈顶层（如 ufcs 叠在 uart 上），否则看主解码器。"""
    stacked = spec.get('stacked') or []
    if stacked:
        fam = family_of(stacked[-1].get('id'))
        if fam:
            return fam
    return family_of(spec.get('id'))


def _first_text(row):
    ts = row.get('texts') or []
    return ts[0] if ts else ''


def _hex_of(text):
    """从 'Data write: 00' / 'AW: B4' / '00' 这类文本提取最末两位 hex。"""
    m = re.findall(r'([0-9A-Fa-f]{2})\b', text or '')
    return m[-1].upper() if m else None


def _t_s(row, rate):
    return row['ss'] / rate


# ---------------------------------------------------------------- I²C

def _i2c_transactions(rows, rate):
    """start/(repeat-start+)address..stop 为一个事务段；寄存器读 = 写段 reg +
    紧随的读段 value。"""
    txns, anomalies = [], []
    cur = None
    for r in rows:
        ann = r['ann']
        if ann in ('start', 'repeat-start'):
            if cur and cur['addr7'] is not None and not cur['done']:
                cur['done'] = True
                txns.append(cur)
            if cur and not cur['done']:
                txns.append(cur)
            cur = {'ss': r['ss'], 'es': r['es'], 'addr7': None, 'rw': None,
                   'bytes': [], 'acks': [], 'nack_addr': False,
                   'repeated_start': ann == 'repeat-start', 'done': False}
        elif cur is None:
            continue
        elif ann == 'address-write':
            t = _first_text(r)
            m = re.search(r':\s*([0-9A-Fa-f]{2})', t)
            if m and cur['addr7'] is None:
                cur['addr7'] = '0x%02X' % (int(m.group(1), 16) >> 1)
                cur['rw'] = 'W'
                cur['addr_ss'] = r['ss']
        elif ann == 'address-read':
            m = re.search(r':\s*([0-9A-Fa-f]{2})', _first_text(r))
            if m and cur['addr7'] is None:
                cur['addr7'] = '0x%02X' % (int(m.group(1), 16) >> 1)
                cur['rw'] = 'R'
                cur['addr_ss'] = r['ss']
        elif ann in ('data-write', 'data-read'):
            hx = _hex_of(_first_text(r))
            if hx:
                cur['bytes'].append(hx)
            cur['last_data_ss'] = r['ss']
        elif ann == 'ack':
            cur['acks'].append('A')
        elif ann == 'nack':
            cur['acks'].append('N')
            if cur['addr7'] is not None and not cur['bytes']:
                cur['nack_addr'] = True
                anomalies.append({'type': 'addr_nack', 't_s': round(_t_s(r, rate), 6),
                                  'detail': '地址 %s %s 被 NACK' % (cur['addr7'], cur['rw'])})
        elif ann == 'stop':
            cur['es'] = r['es']
            cur['done'] = True
            txns.append(cur)
            cur = None
    if cur and cur['addr7'] is not None:
        txns.append(cur)

    out = []
    prev_w = None
    for c in txns:
        txn = {
            't_s': round(c['ss'] / rate, 6), 'proto': 'i2c',
            'addr7': c['addr7'], 'rw': c['rw'],
            'bytes': c['bytes'], 'acks': ' '.join(c['acks']),
            'nack_addr': c['nack_addr'], 'repeated_start': c['repeated_start'],
            'dur_us': round((c['es'] - c['ss']) * 1e6 / rate, 1),
            'reg': None, 'value': None,
        }
        if c['rw'] == 'W' and c['bytes']:
            txn['reg'] = '0x' + c['bytes'][0]
            if len(c['bytes']) > 1:
                txn['value'] = ' '.join(c['bytes'][1:])
            prev_w = txn
        elif c['rw'] == 'R':
            txn['value'] = ' '.join(c['bytes']) if c['bytes'] else None
            if prev_w is not None and prev_w['addr7'] == c['addr7'] and prev_w['reg']:
                txn['reg'] = prev_w['reg']
            prev_w = None
        out.append(txn)
    return out, anomalies


# ---------------------------------------------------------------- USB PD

_PD_TYPE_RE = re.compile(r'\(r(\d)\)\s*(SRC|SNK|Cable|Reserved)\[(\d+)\]:\s*(.+)', re.I)


def _pd_transactions(rows, rate):
    """消息 = preamble..eop(或下一个 preamble)；type 行 (rN) ROLE[ID]: TYPE；
    warnings 'Bad CRC'/'No EOP' 归属当前消息；GoodCRC 应答测 eop→下一消息 preamble。"""
    msgs = []
    cur = None
    for r in rows:
        ann = r['ann']
        if ann == 'preamble':
            if cur:
                msgs.append(cur)
            cur = {'ss': r['ss'], 'es': r['es'], 'eop_ss': None, 'eop_ann': False,
                   'role': None, 'msg_id': None, 'rev': None, 'type': None,
                   'payload': [], 'crc_ok': True, 'eop_ok': True, 'warns': []}
        elif cur is None:
            continue
        else:
            cur['es'] = r['es']
            if ann == 'eop':
                cur['eop_ann'] = True
                cur['eop_ss'] = r['ss']
            elif ann in ('src', 'snk', 'cable', 'reserved'):
                m = _PD_TYPE_RE.match(_first_text(r))
                if m:
                    cur['rev'] = int(m.group(1))
                    cur['role'] = m.group(2).upper()
                    cur['msg_id'] = int(m.group(3))
                    cur['type'] = m.group(4).strip()
            elif ann == 'payload':
                cur['payload'].append(_first_text(r))
            elif ann == 'warnings':
                w = _first_text(r)
                cur['warns'].append(w)
                if 'crc' in w.lower():
                    cur['crc_ok'] = False
                if 'eop' in w.lower():
                    cur['eop_ok'] = False
    if cur:
        msgs.append(cur)

    txns, anomalies = [], []
    for i, m in enumerate(msgs):
        txn = {
            't_s': round(m['ss'] / rate, 6), 'proto': 'pd',
            'role': m['role'], 'msg_id': m['msg_id'], 'rev': m['rev'],
            'type': m['type'], 'payload': m['payload'],
            'crc_ok': m['crc_ok'], 'eop_ok': m['eop_ann'] and m['eop_ok'],
            'dur_us': round((m['es'] - m['ss']) * 1e6 / rate, 1),
        }
        if not txn['crc_ok']:
            anomalies.append({'type': 'crc_error', 't_s': txn['t_s'],
                              'detail': 'PD %s CRC 校验失败' % (m['type'] or '?')})
        if not m['eop_ann'] or not m['eop_ok']:
            anomalies.append({'type': 'no_eop', 't_s': txn['t_s'],
                              'detail': 'PD %s 缺少 EOP' % (m['type'] or '?')})
        if m['type'] and m['type'].upper() != 'GOOD CRC':
            nxt = msgs[i + 1] if i + 1 < len(msgs) else None
            if nxt and nxt['type'] and nxt['type'].upper() == 'GOOD CRC':
                txn['goodcrc_reply_us'] = round((nxt['ss'] - m['ss']) * 1e6 / rate, 1)
            else:
                txn['goodcrc_reply_us'] = None
                anomalies.append({'type': 'no_goodcrc', 't_s': txn['t_s'],
                                  'detail': 'PD %s 后无 GoodCRC 应答' % m['type']})
        txns.append(txn)
    return txns, anomalies


# ---------------------------------------------------------------- UFCS

_UFCS_TYPE_RE = re.compile(r'\(r(\d+)\)\s*(SRC|SNK|Cable|Reserved)\[(\d+)\]:\s*(.+)', re.I)


def _ufcs_transactions(rows, rate):
    """消息 = 'SOP:0xaa' 起至 'CRC:xx'；puthead 的 (rN) ROLE[ID]: TYPE 在
    src/snk/cable/reserved 行；'Bad CRC a != b' warnings -> crc_ok=False。
    注意上游 ufcs putwarn 用 putx(0,-1,...) 发射，warnings 行 ss=0 无位置，
    须按 'Bad CRC <rx> != <calc>' 中的 <rx> 与消息 'CRC:<rx>' 字段匹配归属。"""
    msgs, cur = [], None
    warns = []
    for r in rows:
        ann, t0 = r['ann'], _first_text(r)
        # ufcs putwarn 借 payload 行发射且 ss=0 无位置——先于 SOP 判断收集
        if ann == 'warnings' or (ann == 'payload' and re.match(r'Bad CRC', t0 or '', re.I)):
            warns.append(t0)
            continue
        if ann == 'data' and t0.startswith('SOP:'):
            if cur:
                msgs.append(cur)
            cur = {'ss': r['ss'], 'es': r['es'], 'role': None, 'msg_id': None,
                   'rev': None, 'type': None, 'payload': [], 'crc_ok': True,
                   'crc_field': None}
        elif cur is None:
            continue
        else:
            cur['es'] = r['es']
            if ann in ('src', 'snk', 'cable', 'reserved'):
                m = _UFCS_TYPE_RE.match(t0)
                if m:
                    cur['rev'] = int(m.group(1))
                    cur['role'] = m.group(2).upper()
                    cur['msg_id'] = int(m.group(3))
                    cur['type'] = m.group(4).strip()
            elif ann == 'crc':
                m = re.search(r'CRC:([0-9A-Fa-f]+)', t0)
                if m:
                    cur['crc_field'] = m.group(1).lower()
            elif ann == 'payload' and t0:
                cur['payload'].append(t0)
    if cur:
        msgs.append(cur)

    # 无位置 warnings 按 CRC 值挂回所属消息
    for w in warns:
        m = re.search(r'Bad CRC\s+([0-9A-Fa-f]+)\s*!=', w, re.I)
        target = None
        if m:
            target = next((x for x in msgs if x.get('crc_field') == m.group(1).lower()), None)
        if target is None and msgs:
            target = msgs[-1]
        if target is not None:
            target['crc_ok'] = False

    txns, anomalies = [], []
    for m in msgs:
        txn = {'t_s': round(m['ss'] / rate, 6), 'proto': 'ufcs',
               'role': m['role'], 'msg_id': m['msg_id'], 'rev': m['rev'],
               'type': m['type'], 'payload': m['payload'], 'crc_ok': m['crc_ok'],
               'dur_us': round((m['es'] - m['ss']) * 1e6 / rate, 1)}
        if not m['crc_ok']:
            anomalies.append({'type': 'crc_error', 't_s': txn['t_s'],
                              'detail': 'UFCS %s CRC 校验失败' % (m['type'] or '?')})
        txns.append(txn)
    return txns, anomalies


# ---------------------------------------------------------------- UART

def _uart_transactions(rows, spec, rate):
    """按空闲间隔（>20 个 bit 时长 ≈ 2 帧）把连续字节切成突发帧组；
    'Frame error'/'Parity error'/'Break' 计入组内错误。"""
    try:
        baud = float((spec.get('options') or {}).get('baudrate') or 115200)
    except (TypeError, ValueError):
        baud = 115200.0
    gap = int(rate * 20.0 / max(baud, 1.0))

    groups, cur = [], None
    for r in rows:
        if r['ann'] == 'data':
            if cur is None or r['ss'] - cur['es'] > gap:
                cur = {'ss': r['ss'], 'es': r['es'], 'bytes': [], 'errors': []}
                groups.append(cur)
            hx = _hex_of(_first_text(r)) or (_first_text(r) or '?')
            cur['bytes'].append(hx.lstrip('@'))
            cur['es'] = r['es']
        elif cur is not None and r['ann'] == 'warnings':
            cur['errors'].append(_first_text(r))
        elif cur is not None and r['ann'] == 'break':
            cur['errors'].append('BREAK')
    txns, anomalies = [], []
    for g in groups:
        txns.append({'t_s': round(g['ss'] / rate, 6), 'proto': 'uart',
                     'bytes': g['bytes'], 'count': len(g['bytes']),
                     'frame_errors': len(g['errors']),
                     'dur_us': round((g['es'] - g['ss']) * 1e6 / rate, 1)})
        for e in g['errors']:
            anomalies.append({'type': 'frame_error', 't_s': round(g['ss'] / rate, 6),
                              'detail': 'UART %s' % e})
    return txns, anomalies


# ---------------------------------------------------------------- SPI

def _level_at(init, edges, s):
    import bisect
    return init ^ (bisect.bisect_right(edges, s) & 1)


def _spi_transactions(rows, spec, rate, init, edges):
    """按 CS 有效区间切分传输（cs 引脚 bound 时）；无 CS 时退化为按间隔分组。"""
    pins = spec.get('pins') or {}
    opts = spec.get('options') or {}
    cs_ch = pins.get('cs')
    active_low = str(opts.get('cs_polarity', 'active-low')) != 'active-high'

    segs = []   # (ss, es) CS 有效区间，单位 sample
    if cs_ch is not None and edges is not None and int(cs_ch) < len(edges):
        ce = edges[int(cs_ch)]
        lv = init[int(cs_ch)]
        # CS 有效 = 电平 == (0 if active_low else 1)
        on = (lv == 0) == active_low
        seg_start = 0 if on else None
        for e in ce.tolist() if hasattr(ce, 'tolist') else ce:
            lv ^= 1
            on = (lv == 0) == active_low
            if on:
                seg_start = e
            elif seg_start is not None:
                segs.append((seg_start, e))
                seg_start = None
        if seg_start is not None:
            segs.append((seg_start, rows[-1]['es'] if rows else seg_start))

    txns, anomalies = [], []
    if segs:
        gi = 0
        for (s0, s1) in segs:
            mosi, miso = [], []
            while gi < len(rows) and rows[gi]['ss'] < s0:
                gi += 1
            j = gi
            while j < len(rows) and rows[j]['ss'] <= s1:
                r = rows[j]
                hx = _hex_of(_first_text(r))
                if hx:
                    (mosi if r['ann'] == 'mosi-data' else miso).append(hx)
                j += 1
            if mosi or miso:
                txns.append({'t_s': round(s0 / rate, 6), 'proto': 'spi',
                             'mosi': mosi, 'miso': miso,
                             'words': max(len(mosi), len(miso)),
                             'dur_us': round((s1 - s0) * 1e6 / rate, 1)})
    else:
        # 无 CS：相邻数据注解间隔 > 8 倍中位时长则切分
        dur = sorted(r['es'] - r['ss'] for r in rows if r['ann'] in ('mosi-data', 'miso-data'))
        med = dur[len(dur) // 2] if dur else 0
        maxgap = max(med * 8, int(rate * 0.001))
        cur = None
        for r in rows:
            if r['ann'] not in ('mosi-data', 'miso-data'):
                continue
            if cur is None or r['ss'] - cur['es'] > maxgap:
                cur = {'ss': r['ss'], 'es': r['es'], 'mosi': [], 'miso': []}
                txns.append(cur)
            hx = _hex_of(_first_text(r))
            if hx:
                (cur['mosi'] if r['ann'] == 'mosi-data' else cur['miso']).append(hx)
            cur['es'] = r['es']
        txns = [{'t_s': round(c['ss'] / rate, 6), 'proto': 'spi',
                 'mosi': c['mosi'], 'miso': c['miso'],
                 'words': max(len(c['mosi']), len(c['miso'])),
                 'dur_us': round((c['es'] - c['ss']) * 1e6 / rate, 1)} for c in txns]
    return txns, anomalies


# ---------------------------------------------------------------- 顶层

def _signal_anomalies(dsl, spec, init, edges):
    """glitch_dense / undersampled 从绑定了协议引脚的通道边沿统计推导。"""
    import numpy as np
    anomalies = []
    pins = (spec or {}).get('pins') or {}
    checked = set()
    for pname, ch in pins.items():
        ch = int(ch)
        if ch in checked or ch >= len(edges):
            continue
        checked.add(ch)
        e = edges[ch]
        if e.size < 4:
            continue
        dif = np.diff(e.astype(np.int64))
        tiny = int((dif <= 1).sum())          # 1 采样宽脉冲 = 毛刺
        minp = int(dif.min())
        if tiny / max(len(dif), 1) > 0.05:
            anomalies.append({'type': 'glitch_dense', 't_s': 0,
                              'detail': '通道 %d(%s) 毛刺占比 %.1f%%' % (ch, pname, tiny * 100.0 / len(dif))})
        if minp <= 2:
            anomalies.append({'type': 'undersampled', 't_s': 0,
                              'detail': '通道 %d(%s) 最小脉宽 %d 采样（%sMHz 欠采样风险）'
                                        % (ch, pname, minp, round(dsl.samplerate / 1e6))})
    return anomalies


def build_transactions(dsl, spec, anns, error=None, init=None, edges=None):
    """decode 注解 -> 事务 + 异常。anns 须按 ss 升序（decode 输出已保证）。"""
    fam = spec_family(spec)
    rate = dsl.samplerate
    rows = [a for a in anns if family_of(a.get('dec')) == fam] or list(anns)
    rows = sorted(rows, key=lambda a: a['ss'])

    if fam == 'i2c':
        txns, anomalies = _i2c_transactions(rows, rate)
    elif fam == 'pd':
        txns, anomalies = _pd_transactions(rows, rate)
    elif fam == 'ufcs':
        txns, anomalies = _ufcs_transactions(rows, rate)
    elif fam == 'uart':
        txns, anomalies = _uart_transactions(rows, spec, rate)
    elif fam == 'spi':
        txns, anomalies = _spi_transactions(rows, spec, rate, init, edges)
    else:
        txns, anomalies = [], []

    if init is not None and edges is not None:
        anomalies.extend(_signal_anomalies(dsl, spec, init, edges))
    if error:
        anomalies.append({'type': 'decoder_error', 't_s': 0, 'detail': str(error)[:200]})

    anomalies.sort(key=lambda a: a['t_s'])
    stats = {
        'proto': fam, 'count': len(txns), 'anomaly_count': len(anomalies),
        'samplerate': rate, 'duration_s': round(dsl.total / rate, 6),
    }
    if fam == 'i2c':
        stats['addresses'] = sorted({t['addr7'] for t in txns if t['addr7']})
        stats['addr_nack'] = sum(1 for a in anomalies if a['type'] == 'addr_nack')
    elif fam == 'pd':
        stats['msg_flow'] = dict(Counter(t['type'] for t in txns if t['type']))
    elif fam == 'ufcs':
        stats['msg_flow'] = dict(Counter(t['type'] for t in txns if t['type']))
    return {'transactions': txns, 'anomalies': anomalies, 'stats': stats}


# ---------------------------------------------------------------- AI 概要（T5）

def _channel_line(ch):
    flag = []
    if ch.get('active'):
        flag.append('%d 边沿' % ch.get('edges', 0))
    if ch.get('one_sample_pulses'):
        flag.append('单采样脉冲 %d' % ch['one_sample_pulses'])
    return 'ch%d "%s"%s' % (ch['index'], ch.get('name') or '?',
                           ('：' + '，'.join(flag)) if flag else '（空闲）')


# 解码器绑定角色 -> 名称中可接受的关键词（F1 命名冲突检测）
_ROLE_WORDS = {
    'sda': {'sda'}, 'scl': {'scl'},
    'clk': {'clk', 'sck'}, 'miso': {'miso'}, 'mosi': {'mosi'},
    'cs': {'cs', 'ss', 'sel', 'ce'},
    'rxtx': {'rx', 'tx', 'rxtx', 'uart', 'ufcs'},
    'rx': {'rx'}, 'tx': {'tx'},
    'cc1': {'cc'}, 'cc2': {'cc'},
}
# 名称中出现的「信号/协议词」：命中即认为名称带有信号语义，可与绑定角色对照
_SIGNAL_WORDS = {'sda', 'scl', 'clk', 'sck', 'miso', 'mosi', 'cs', 'ss', 'sel', 'ce',
                 'rx', 'tx', 'rxtx', 'uart', 'cc',
                 'i2c', 'iic', 'spi', 'ufcs', 'pd', 'usb', 'can', 'jtag', 'swd'}


def _name_words(name):
    """'ufcs1' -> {'ufcs'}, 'SCL' -> {'scl'}, '2' -> set()"""
    out = set()
    for t in re.findall(r'[a-zA-Z]+\d*', str(name or '')):
        m = re.match(r'([a-zA-Z]+)', t)
        if m:
            out.add(m.group(1).lower())
    return out


def _binding_conflicts(info, specs):
    """通道名 vs 解码器绑定角色对照。
    返回 (conflicts[list[str]], verified[set], unverifiable[set])：
    - verified:   名称含绑定角色关键词
    - conflicts:  名称含「其他」信号/协议词但不含绑定角色词（如名为 SCL 绑定为 sda）
    - unverifiable: 名称不含任何信号词（如 'int'/'2'/'ufcs1' 之外的纯数字名）"""
    chans = {c.get('index'): c for c in (info or {}).get('channels') or []}
    conflicts, verified, unverif = [], set(), set()
    for spec in specs or []:
        pins = spec.get('pins') or {}
        label = spec.get('label') or spec.get('id') or '?'
        for role, probe in pins.items():
            ch = chans.get(int(probe))
            if not ch:
                continue
            words = _name_words(ch.get('name'))
            if words & _ROLE_WORDS.get(role, {role}):
                verified.add(int(probe))
            elif words & _SIGNAL_WORDS:
                conflicts.append('ch%d 名为 "%s"，但 %s 绑定为 %s'
                                 % (int(probe), ch.get('name'), label, role))
            else:
                unverif.add(int(probe))
    return conflicts, verified, unverif


def build_summary(dsl, spec, info, txns, anomalies, sel_start_s=None, sel_end_s=None,
                  specs=None):
    """生成 <=6000 中文字符的 AI 上下文包（Markdown）。段落顺序固定：
    1 采集概况 2 通道活跃与命名置信 3 异常清单 4 聚合统计 5 选中事务。
    specs：参与解码的全部 spec（用于「名称 vs 绑定」冲突检测）；缺省取 [spec] 或
    info.decoders。"""
    rate = dsl.samplerate
    dur = dsl.total / rate
    out = []
    sel = None
    if sel_start_s is not None and sel_end_s is not None:
        s0, s1 = float(sel_start_s), float(sel_end_s)
        sel = (min(s0, s1), max(s0, s1))
        txns = [t for t in txns if sel[0] <= t['t_s'] <= sel[1]]
        anomalies = [a for a in anomalies if sel[0] <= a['t_s'] <= sel[1]]

    out.append('## DSLogic 采集概要')
    out.append('- 文件：%s' % os.path.basename(dsl.path))
    out.append('- 采样率：%g MHz｜时长：%.3f s｜通道：%d'
               % (rate / 1e6, dur, getattr(dsl, 'nprobes', 0)))
    if sel:
        out.append('- 选区：%.6f ~ %.6f s（事务 %d 条）' % (sel[0], sel[1], len(txns)))
    decs = (info or {}).get('decoders') or []
    if spec:
        out.append('- 解码器：%s（pins=%s）' % (spec.get('label') or spec.get('id'),
                                              spec.get('pins')))
    elif decs:
        out.append('- 解码器：' + '，'.join(d.get('label') or d.get('id') for d in decs))

    out.append('\n### 通道活跃')
    named = 0
    for ch in (info or {}).get('channels') or []:
        if ch.get('enabled'):
            out.append('- ' + _channel_line(ch))
            if ch.get('name') and not re.match(r'^\d+$', str(ch['name'])):
                named += 1
    # F1: 命名声明 + 名称/绑定冲突逐条列出；冲突存在时置信度不得为「高」
    specs_for_check = specs if specs is not None else ([spec] if spec else decs)
    conflicts, verified, unverif = _binding_conflicts(info, specs_for_check)
    out.append('- 声明：通道名来自用户，可能与实际信号不符；以解码器绑定角色与信号特征为准')
    for c in conflicts:
        out.append('- 冲突：' + c)
    if conflicts:
        conf = '低（存在 %d 处名称与解码器绑定冲突）' % len(conflicts)
    elif verified:
        conf = ('高（%d 个绑定通道命名一致）' % len(verified)) if not unverif else \
               ('中（%d 个命名一致，%d 个绑定通道名无法辨识信号角色）'
                % (len(verified), len(unverif)))
    elif named:
        conf = '中（已命名 %d 个通道，无解码器绑定可交叉验证）' % named
    else:
        conf = '低（通道未命名，引脚映射为推测）'
    out.append('- 命名置信度：' + conf)

    out.append('\n### 异常清单（共 %d 条）' % len(anomalies))
    for a in anomalies[:20]:
        out.append('- [%.6fs] %s：%s' % (a['t_s'], a['type'], a['detail']))
    if len(anomalies) > 20:
        out.append('- ……其余 %d 条略' % (len(anomalies) - 20))

    out.append('\n### 聚合统计')
    fam_counts = Counter(t['proto'] for t in txns)
    if fam_counts:
        out.append('- 事务数：' + '，'.join('%s %d' % (k, v) for k, v in sorted(fam_counts.items())))
    i2c = [t for t in txns if t['proto'] == 'i2c']
    if i2c:
        addrs = Counter(t['addr7'] for t in i2c if t['addr7'])
        regs = Counter(t['reg'] for t in i2c if t.get('reg'))
        out.append('- I²C 地址：' + '，'.join('%s×%d' % kv for kv in addrs.most_common(10)))
        if regs:
            out.append('- I²C 寄存器：' + '，'.join('%s×%d' % kv for kv in regs.most_common(10)))
    pd = [t for t in txns if t['proto'] in ('pd', 'ufcs')]
    for fam_name in ('pd', 'ufcs'):
        fl = Counter(t['type'] for t in pd if t['proto'] == fam_name and t['type'])
        if fl:
            out.append('- %s 消息流：%s' % (fam_name.upper(),
                       '，'.join('%s×%d' % kv for kv in fl.most_common(15))))

    out.append('\n### 事务样本（共 %d 条，示前 20）' % len(txns))
    for t in txns[:20]:
        body = {k: v for k, v in t.items() if v not in (None, [], '', False) and k != 'proto'}
        out.append('- %s %s' % (t['proto'],
                   ' '.join('%s=%s' % (k, v) for k, v in body.items())))
    if len(txns) > 20:
        out.append('- ……其余 %d 条略' % (len(txns) - 20))

    text = '\n'.join(out)
    if len(text) > 6000:
        text = text[:5950] + '\n- ……（超出 6000 字符截断，原始数据经 API 完整可查）'
    return text
