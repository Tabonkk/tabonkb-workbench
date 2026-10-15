# -*- coding: utf-8 -*-
"""
ChargerLAB Mtools recording (.db, SQLite) reader.

Mtools saves recordings as a standard SQLite database:
  table_1(ElapsedTime TEXT, Unix REAL, VBUS REAL, IBUS REAL, DP REAL, DM REAL,
          CC1 REAL, CC2 REAL, TEMP REAL, CHARGE REAL, ENERGY REAL)
  table_1_param(name TEXT, Unix TEXT, StartTime TEXT, SamplingRate TEXT)

This helper never fabricates data. It reads the DB and prints JSON to stdout.

Usage:
  python powerz_db.py <file.db> [--mode summary|meta|page|csv]
                      [--offset N] [--limit M] [--points K]
"""
import sys
import os
import json
import sqlite3
import argparse
import math


def valid_temperature(value):
    # Mtools uses extreme floating-point values for an unrecorded channel.
    return value if isinstance(value, (int, float)) and math.isfinite(value) and abs(value) < 1e300 else None


def open_db(path):
    return sqlite3.connect('file:%s?mode=ro' % path.replace('\\', '/'), uri=True)


def read_param(con):
    try:
        row = con.execute('SELECT name, Unix, StartTime, SamplingRate FROM table_1_param LIMIT 1').fetchone()
    except Exception:
        row = None
    if not row:
        return {'name': None, 'unix': None, 'startTime': None, 'samplingRate': None}
    return {'name': row[0], 'unix': row[1], 'startTime': row[2], 'samplingRate': row[3]}


def read_metrics(con):
    q = ('SELECT COUNT(*), MIN(Unix), MAX(Unix), MIN(VBUS), MAX(VBUS), AVG(VBUS), '
         'MIN(IBUS), MAX(IBUS), AVG(IBUS), MAX(VBUS*IBUS), AVG(VBUS*IBUS), '
         'MIN(CASE WHEN ABS(TEMP) < 1e300 THEN TEMP END), '
         'MAX(CASE WHEN ABS(TEMP) < 1e300 THEN TEMP END), '
         'COUNT(CASE WHEN ABS(TEMP) < 1e300 THEN 1 END) FROM table_1')
    c = con.execute(q).fetchone()
    count = c[0] or 0
    unix_min = c[1] if c[1] is not None else 0.0
    unix_max = c[2] if c[2] is not None else 0.0
    dur = round(unix_max - unix_min, 3)
    hours = dur / 3600.0
    avg_i = c[8] or 0.0
    avg_p = c[10] or 0.0
    return {
        'totalSamples': count,
        'durationSeconds': dur,
        'metrics': {
            'voltage': {'min': c[3], 'max': c[4], 'avg': round(c[5] or 0, 3), 'unit': 'V'},
            'current': {'min': c[6], 'max': c[7], 'avg': round(avg_i, 3), 'unit': 'A'},
            'power': {'peak': round(c[9] or 0, 3), 'avg': round(avg_p, 3), 'unit': 'W'},
            'temperature': {'min': valid_temperature(c[11]), 'max': valid_temperature(c[12]), 'validSamples': c[13], 'unit': 'C'},
            'capacityMah': round(avg_i * hours * 1000, 1),
            'energyMwh': round(avg_p * hours * 1000, 1)
        }
    }


def read_curve(con, points):
    count = con.execute('SELECT COUNT(*) FROM table_1').fetchone()[0] or 0
    if count == 0:
        return []
    step = max(1, count // max(2, points))
    curve = []
    for i, (u, v, a, p) in enumerate(con.execute('SELECT Unix, VBUS, IBUS, VBUS*IBUS FROM table_1')):
        if i % step == 0:
            curve.append({'t': round(u, 2), 'v': round(v or 0, 3), 'i': round(a or 0, 3), 'p': round(p or 0, 3)})
    return curve


def mode_summary(con):
    out = {'hasData': True, 'columns': ['t', 'vbus', 'ibus', 'dp', 'dm', 'cc1', 'cc2', 'temp', 'charge', 'energy']}
    out.update(read_metrics(con))
    out['param'] = read_param(con)
    out['downsampledCurve'] = read_curve(con, 40)
    return out


def mode_meta(con):
    m = read_metrics(con)
    return {'param': read_param(con), 'columns': ['ElapsedTime', 'Unix', 'VBUS', 'IBUS', 'DP', 'DM', 'CC1', 'CC2', 'TEMP', 'CHARGE', 'ENERGY'],
            'totalSamples': m['totalSamples'], 'durationSeconds': m['durationSeconds']}


def mode_page(con, offset, limit):
    total = con.execute('SELECT COUNT(*) FROM table_1').fetchone()[0] or 0
    items = []
    q = ('SELECT Unix, VBUS, IBUS, DP, DM, CC1, CC2, TEMP, CHARGE, ENERGY '
         'FROM table_1 ORDER BY Unix LIMIT ? OFFSET ?')
    for r in con.execute(q, (limit, offset)):
        items.append({'t': round(r[0] or 0, 3), 'vbus': r[1], 'ibus': r[2], 'dp': r[3], 'dm': r[4],
                      'cc1': r[5], 'cc2': r[6], 'temp': valid_temperature(r[7]), 'charge': r[8], 'energy': r[9]})
    return {'total': total, 'offset': offset, 'limit': limit, 'items': items, 'param': read_param(con)}


def mode_csv(con):
    lines = ['Time,VBUS(V),IBUS(A),DP(V),DM(V),CC1(V),CC2(V),TEMP(C),CHARGE(Ah),ENERGY(Wh)']
    for r in con.execute('SELECT Unix, VBUS, IBUS, DP, DM, CC1, CC2, TEMP, CHARGE, ENERGY FROM table_1 ORDER BY Unix'):
        values = list(r)
        values[7] = valid_temperature(values[7])
        lines.append(','.join('' if x is None else str(x) for x in values))
    return {'csv': '\n'.join(lines)}


def database_kind(con):
    tables = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if 'pd_table' in tables:
        return 'pd'
    if 'table_1' in tables:
        return 'adc'
    raise ValueError('unsupported official recording schema')


import zlib


CTRL_MSGS = {
    1: 'GoodCRC', 2: 'GotoMin', 3: 'Accept', 4: 'Reject', 5: 'Ping', 6: 'PS_RDY',
    7: 'Get_Source_Cap', 8: 'Get_Sink_Cap', 9: 'DR_Swap', 10: 'PR_Swap',
    11: 'VCONN_Swap', 12: 'Wait', 13: 'Soft_Reset', 14: 'Data_Reset', 16: 'Not_Supported',
    17: 'Get_Source_Cap_Extended', 18: 'Get_Status', 19: 'FR_Swap', 20: 'Get_PPS_Status',
    21: 'Get_Country_Codes', 22: 'Get_Sink_Cap_Extended', 23: 'Get_Source_Info', 24: 'Get_Revision'
}
DATA_MSGS = {
    1: 'Source_Capabilities', 2: 'Request', 3: 'BIST', 4: 'Sink_Capabilities',
    5: 'Battery_Status', 6: 'Alert', 7: 'Get_Country_Info', 8: 'Enter_USB', 15: 'Vendor_Defined'
}


def decode_pd_raw(raw, time_sec, vbus, ibus, idx):
    if not raw or len(raw) < 8:
        return {
            'index': idx, 'sop': 'SOP', 'msgName': 'Raw', 'msgType': 0, 'msgId': 0,
            'direction': 'UNKNOWN', 'objCount': 0, 'rev': 'V1', 'elapsed': '0:00:00.000',
            'elapsedSeconds': round(time_sec or 0, 6), 'vbus': round(vbus or 0, 3), 'ibus': round(ibus or 0, 3),
            'dataHex': raw.hex().upper() if raw else '', 'headerHex': '0x0000', 'crcHex': '0x00000000',
            'note': '', 'fields': {}, 'dataObjects': []
        }
    payload = raw[6:]
    hdr = payload[0] | (payload[1] << 8)
    msg_type = hdr & 0x1F
    data_role = (hdr >> 5) & 1
    spec_rev = (hdr >> 6) & 3
    pwr_role = (hdr >> 8) & 1
    msg_id = (hdr >> 9) & 7
    obj_cnt = (hdr >> 12) & 7
    ext = (hdr >> 15) & 1
    rev_str = 'V%d' % (spec_rev + 1)

    msg_name = (DATA_MSGS if obj_cnt > 0 else CTRL_MSGS).get(msg_type, 'Msg_%d' % msg_type)
    direction = 'SRC->SNK' if pwr_role == 1 else 'SRC<-SNK'
    crc = zlib.crc32(payload) & 0xFFFFFFFF
    data_hex = ' '.join('%02X' % b for b in payload)

    # Format H:MM:SS.mmm
    ms = int(round((time_sec or 0) * 1000))
    s = ms // 1000
    rem_ms = ms % 1000
    m = s // 60
    rem_s = s % 60
    h = m // 60
    rem_m = m % 60
    elapsed_str = '%d:%02d:%02d.%03d' % (h, rem_m, rem_s, rem_ms)

    note = ''
    data_objects = []
    if msg_name == 'Request' and len(payload) >= 6:
        rdo = payload[2] | (payload[3] << 8) | (payload[4] << 16) | (payload[5] << 24)
        pos = (rdo >> 28) & 7
        volt_20mv = (rdo >> 9) & 0x7FF
        curr_50ma = rdo & 0x7F
        volt = volt_20mv * 20 / 1000.0
        curr = curr_50ma * 50 / 1000.0
        note = 'Position:%d PPS?:%.2fV,%.1fA...' % (pos, volt, curr)
        data_objects.append({
            'type': 'RDO', 'position': pos, 'voltage': volt, 'current': curr,
            'hex': '0x%08X' % rdo, 'desc': 'Position %d: %.2fV, %.2fA' % (pos, volt, curr)
        })
    elif msg_name == 'Source_Capabilities' and obj_cnt > 0:
        pdo_descs = []
        for k in range(obj_cnt):
            if 2 + (k + 1) * 4 <= len(payload):
                pdo = payload[2 + k * 4] | (payload[3 + k * 4] << 8) | (payload[4 + k * 4] << 16) | (payload[5 + k * 4] << 24)
                pdo_type = (pdo >> 30) & 3
                if pdo_type == 0:
                    v = ((pdo >> 10) & 0x3FF) * 50 / 1000.0
                    cur = (pdo & 0x3FF) * 10 / 1000.0
                    pdo_descs.append('Fixed %.1fV %.2fA' % (v, cur))
                    data_objects.append({'type': 'Fixed', 'pos': k + 1, 'voltage': v, 'current': cur, 'power': round(v * cur, 1), 'hex': '0x%08X' % pdo})
                elif pdo_type == 3:
                    min_v = ((pdo >> 8) & 0xFF) * 100 / 1000.0
                    max_v = ((pdo >> 17) & 0xFF) * 100 / 1000.0
                    max_cur = (pdo & 0x7F) * 50 / 1000.0
                    pdo_descs.append('PPS %.1f-%.1fV %.2fA' % (min_v, max_v, max_cur))
                    data_objects.append({'type': 'PPS', 'pos': k + 1, 'minVoltage': min_v, 'maxVoltage': max_v, 'current': max_cur, 'power': round(max_v * max_cur, 1), 'hex': '0x%08X' % pdo})
                else:
                    data_objects.append({'type': 'Other', 'pos': k + 1, 'hex': '0x%08X' % pdo})
        note = '%d PDOs (%s)' % (obj_cnt, ', '.join(pdo_descs[:2]) + ('...' if len(pdo_descs) > 2 else ''))
    elif msg_name == 'Vendor_Defined' and obj_cnt > 0 and len(payload) >= 6:
        vdm_hdr = payload[2] | (payload[3] << 8) | (payload[4] << 16) | (payload[5] << 24)
        svid = (vdm_hdr >> 16) & 0xFFFF
        cmd = vdm_hdr & 0x1F
        note = 'SVID:0x%04X CMD:%d' % (svid, cmd)
        data_objects.append({'type': 'VDM', 'svid': '0x%04X' % svid, 'cmd': cmd, 'hex': '0x%08X' % vdm_hdr})

    return {
        'index': idx,
        'sop': 'SOP',
        'msgName': msg_name,
        'msgType': msg_type,
        'msgId': msg_id,
        'direction': direction,
        'objCount': obj_cnt,
        'rev': rev_str,
        'elapsed': elapsed_str,
        'elapsedSeconds': round(time_sec or 0, 6),
        'vbus': round(vbus or 0, 3),
        'ibus': round(ibus or 0, 3),
        'dataHex': data_hex,
        'headerHex': '0x%04X' % hdr,
        'crcHex': '0x%08X' % crc,
        'note': note,
        'fields': {
            'headerHex': '0x%04X' % hdr,
            'extended': ext,
            'objects': obj_cnt,
            'msgId': msg_id,
            'powerRole': pwr_role,
            'specRev': spec_rev,
            'dataRole': data_role,
            'msgType': msg_type
        },
        'dataObjects': data_objects
    }


def pd_full(con):
    packets = []
    first_t = None
    last_t = None
    for idx, (t, v, a, raw) in enumerate(con.execute('SELECT Time, Vbus, Ibus, Raw FROM pd_table ORDER BY Time, rowid'), 1):
        if first_t is None:
            first_t = t
        last_t = t
        item = decode_pd_raw(raw, t, v, a, idx)
        if item:
            packets.append(item)
    tables = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    chart = []
    if 'pd_chart' in tables:
        for r in con.execute('SELECT Time, VBUS, IBUS, CC1, CC2 FROM pd_chart ORDER BY Time'):
            chart.append({
                't': round(r[0] or 0, 3),
                'vbus': round(r[1] or 0, 3),
                'ibus': round(r[2] or 0, 3),
                'cc1': round(r[3] or 0, 3),
                'cc2': round(r[4] or 0, 3)
            })
    dur = round((last_t - first_t), 3) if first_t is not None and last_t is not None else 0
    return {
        'protocol': 'pd',
        'totalPackets': len(packets),
        'totalSamples': len(chart),
        'durationSeconds': dur,
        'packets': packets,
        'chart': chart
    }


def pd_page(con, offset, limit):
    total = con.execute('SELECT COUNT(*) FROM pd_table').fetchone()[0]
    items = []
    for idx, (t, v, a, raw) in enumerate(con.execute('SELECT Time,Vbus,Ibus,Raw FROM pd_table ORDER BY Time,rowid LIMIT ? OFFSET ?', (limit, offset)), offset + 1):
        if raw is not None and not isinstance(raw, bytes):
            raise ValueError('PD Raw is not a BLOB')
        decoded = decode_pd_raw(raw, t, v, a, idx)
        if decoded:
            items.append(decoded)
        else:
            items.append({'t': t, 'vbus': v, 'ibus': a, 'rawHex': raw.hex().upper() if raw is not None else None,
                          'rawBytes': len(raw) if raw is not None else 0, 'decoded': False})
    return {'protocol': 'pd', 'total': total, 'offset': offset, 'limit': limit, 'items': items}


def pd_summary(con):
    total, packets, first, last, raw_bytes = con.execute(
        'SELECT COUNT(*),COUNT(CASE WHEN length(Raw)>0 THEN 1 END),MIN(Time),MAX(Time),COALESCE(SUM(length(Raw)),0) FROM pd_table').fetchone()
    tables = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    chart_samples = con.execute('SELECT COUNT(*) FROM pd_chart').fetchone()[0] if 'pd_chart' in tables else 0
    return {'protocol': 'pd', 'hasData': packets > 0, 'totalPackets': packets, 'totalRows': total,
            'totalSamples': chart_samples, 'rawBytes': raw_bytes, 'decoded': True,
            'packetTimeRange': {'start': first, 'end': last},
            'durationSeconds': round(last-first, 6) if first is not None and last is not None else 0,
            'packetPreview': pd_page(con, 0, 5)['items']}


def pd_csv(con):
    lines = ['Time,VBUS(V),IBUS(A),RawHex']
    for t, v, a, raw in con.execute('SELECT Time,Vbus,Ibus,Raw FROM pd_table ORDER BY Time,rowid'):
        if raw is not None and not isinstance(raw, bytes):
            raise ValueError('PD Raw is not a BLOB')
        lines.append(','.join('' if x is None else str(x) for x in (t, v, a, raw.hex().upper() if raw is not None else None)))
    return {'protocol': 'pd', 'csv': '\n'.join(lines)}


def mode_curve(con, max_points=50000):
    count = con.execute('SELECT COUNT(*) FROM table_1').fetchone()[0] or 0
    step = max(1, count // max(2, max_points))
    points = []
    overview_step = max(1, count // 200)
    overview = []
    latest = None

    q = 'SELECT ElapsedTime, Unix, VBUS, IBUS, DP, DM, CC1, CC2, TEMP, CHARGE, ENERGY FROM table_1 ORDER BY Unix'
    for i, r in enumerate(con.execute(q)):
        pt = {
            't': round(r[1] or 0, 3),
            'elapsed': r[0] or '',
            'v': round(r[2] or 0, 6),
            'i': round(r[3] or 0, 6),
            'p': round((r[2] or 0) * (r[3] or 0), 4),
            'dp': round(r[4] or 0, 3),
            'dm': round(r[5] or 0, 3),
            'cc1': round(r[6] or 0, 3),
            'cc2': round(r[7] or 0, 3),
            'temp': valid_temperature(r[8]),
            'charge': r[9] or 0,
            'energy': r[10] or 0
        }
        latest = pt
        if i % step == 0:
            points.append(pt)
        if i % overview_step == 0:
            overview.append({'t': pt['t'], 'v': pt['v'], 'i': pt['i']})

    metrics = read_metrics(con)
    param = read_param(con)
    return {
        'protocol': 'adc',
        'param': param,
        'metrics': metrics['metrics'],
        'totalSamples': count,
        'durationSeconds': metrics['durationSeconds'],
        'points': points,
        'overview': overview,
        'latest': latest or {}
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--mode', default='summary', choices=['summary', 'meta', 'page', 'csv', 'curve', 'pd_full', 'full'])
    ap.add_argument('--offset', type=int, default=0)
    ap.add_argument('--limit', type=int, default=200)
    ap.add_argument('--points', type=int, default=50000)
    args, _ = ap.parse_known_args()

    if not os.path.exists(args.file):
        print(json.dumps({'error': 'file not found: ' + args.file}))
        sys.exit(2)
    try:
        con = open_db(args.file)
        kind = database_kind(con)
        if kind == 'pd':
            if args.mode in ('pd_full', 'full'):
                out = pd_full(con)
            elif args.mode in ('summary', 'meta'):
                out = pd_summary(con)
            elif args.mode == 'page':
                out = pd_page(con, args.offset, args.limit)
            else:
                out = pd_csv(con)
        elif kind == 'adc':
            if args.mode in ('curve', 'curve_full', 'full'):
                out = mode_curve(con, args.points)
            elif args.mode == 'summary':
                out = mode_summary(con)
            elif args.mode == 'meta':
                out = mode_meta(con)
            elif args.mode == 'csv':
                out = mode_csv(con)
            else:
                out = mode_page(con, args.offset, args.limit)
        else:
            raise ValueError('unsupported schema')
        con.close()
        out['ok'] = True
        print(json.dumps(out, ensure_ascii=True))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
