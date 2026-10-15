"""Read-only parser for DSView .dsl logic captures (session format version 3).

Layout (ZIP): header (INI), session (JSON), decoders (JSON), L-<probe>/<block>
bit-packed per channel, LSB = earliest sample. Captures are converted into
per-channel edge lists (sample indices where the level toggles), cached in the
OS temp dir keyed by path/size/mtime. The source file is never modified.
"""
import configparser
import hashlib
import json
import os
import tempfile
import zipfile

import numpy as np

CACHE_VERSION = 1
_UNITS = {'hz': 1.0, 'khz': 1e3, 'mhz': 1e6, 'ghz': 1e9}


from native_client import DslError  # noqa: F401  re-export（唯一 DslError 类，worker/CLI/内核共用）


def parse_samplerate(text):
    parts = str(text).strip().split()
    if len(parts) == 2 and parts[1].lower() in _UNITS:
        return float(parts[0]) * _UNITS[parts[1].lower()]
    return float(parts[0])


class DslFile:
    def __init__(self, path):
        if not os.path.isfile(path):
            raise DslError('文件不存在: %s' % path)
        self.path = path
        try:
            self.zip = zipfile.ZipFile(path)
        except zipfile.BadZipFile:
            raise DslError('不是有效的 .dsl (ZIP) 文件')
        names = set(self.zip.namelist())
        if 'header' not in names:
            raise DslError('缺少 header，非 DSView 数据文件')
        cp = configparser.ConfigParser(interpolation=None)
        cp.read_string(self.zip.read('header').decode('utf-8', errors='replace'))
        self.version = int(cp.get('version', 'version', fallback='0'))
        if self.version != 3:
            raise DslError('暂不支持的 .dsl 版本 %s（已验证: 3）' % self.version)
        h = cp['header']
        self.header = dict(h)
        self.mode = int(h.get('device mode', '0'))
        if self.mode != 0:
            raise DslError('仅支持逻辑分析模式 (device mode=0)，当前为 %s' % self.mode)
        self.driver = h.get('driver', '')
        self.total = int(h['total samples'])
        self.nprobes = int(h['total probes'])
        self.nblocks = int(h.get('total blocks', '1'))
        self.samplerate = parse_samplerate(h['samplerate'])
        self.trigger_time_ms = int(h.get('trigger time', '0') or 0)
        self.trigger_pos = int(h.get('trigger pos', '0') or 0)
        self.session = self._json('session', {})
        self.decoders = self._json('decoders', [])
        enabled = {c.get('index'): c.get('enabled', True) for c in self.session.get('channel', [])}
        self.channels = []
        for i in range(self.nprobes):
            present = ('L-%d/0' % i) in names
            self.channels.append({'index': i, 'name': h.get('probe%d' % i, str(i)),
                                  'enabled': bool(enabled.get(i, True)) and present, 'present': present})

    def close(self):
        try:
            self.zip.close()
        except Exception:
            pass

    def _json(self, name, default):
        try:
            return json.loads(self.zip.read(name).decode('utf-8'))
        except KeyError:
            return default
        except ValueError as e:
            raise DslError('%s 段 JSON 解析失败: %s' % (name, e))

    def _cache_path(self):
        st = os.stat(self.path)
        key = '%s|%d|%d|%d' % (os.path.abspath(self.path).lower(), st.st_size, int(st.st_mtime), CACHE_VERSION)
        d = os.path.join(tempfile.gettempdir(), 'tabonkb-dslogic-cache')
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, hashlib.sha1(key.encode('utf-8')).hexdigest() + '.npz')

    def _extract_channel(self, ch):
        parts, first, prev_last, base = [], 0, None, 0
        for b in range(self.nblocks):
            name = 'L-%d/%d' % (ch, b)
            try:
                raw = np.frombuffer(self.zip.read(name), dtype=np.uint8)
            except KeyError:
                raise DslError('数据块缺失: %s' % name)
            bits = np.unpackbits(raw, bitorder='little')
            if bits.size == 0:
                continue
            if prev_last is None:
                first = int(bits[0])
            elif bits[0] != prev_last:
                parts.append(np.array([base], dtype=np.int64))
            parts.append(np.flatnonzero(bits[1:] != bits[:-1]).astype(np.int64) + 1 + base)
            prev_last = bits[-1]
            base += bits.size
        if base < self.total:
            raise DslError('通道 %d 数据长度 %d 小于 header 样本数 %d' % (ch, base, self.total))
        e = np.concatenate(parts) if parts else np.zeros(0, np.int64)
        return first, e[e < self.total]

    def load_edges(self, use_cache=True):
        """Returns (init_levels: list[int], edges: list[np.ndarray]) for every probe."""
        cp = self._cache_path()
        if use_cache and os.path.exists(cp):
            try:
                z = np.load(cp)
                if int(z['total']) == self.total:
                    return [int(x) for x in z['init']], [z['c%d' % i] for i in range(self.nprobes)]
            except Exception:
                pass
        init, edges = [], []
        for ch in self.channels:
            if ch['present']:
                f, e = self._extract_channel(ch['index'])
            else:
                f, e = 0, np.zeros(0, np.int64)
            init.append(f)
            edges.append(e)
        if use_cache:
            tmp = cp + '.tmp.npz'
            np.savez(tmp, total=np.int64(self.total), init=np.array(init, dtype=np.int8),
                     **{'c%d' % i: e for i, e in enumerate(edges)})
            os.replace(tmp, cp)
        return init, edges

    def info(self, init=None, edges=None):
        st = os.stat(self.path)
        rate = self.samplerate
        out = {
            'file': os.path.basename(self.path), 'size': st.st_size, 'version': self.version,
            'driver': self.driver, 'samplerate': rate, 'total_samples': self.total,
            'duration_s': self.total / rate if rate else None, 'blocks': self.nblocks,
            'trigger_time_ms': self.trigger_time_ms, 'trigger_pos': self.trigger_pos,
            'session': {k: self.session.get(k) for k in ('Title', 'Operation Mode', 'Sample count', 'Sample rate',
                                                         'Threshold Level', 'Channel Mode', 'Stop Options')},
            'decoders': [{'index': i, 'id': d.get('id'), 'label': d.get('label'),
                          'pins': {k: v for c in d.get('channel', []) for k, v in c.items()},
                          'options': d.get('options', {}),
                          'stacked': [s.get('id') for s in d.get('stacked decoders', [])]}
                         for i, d in enumerate(self.decoders)],
            'channels': []
        }
        for ch in self.channels:
            c = dict(ch)
            if edges is not None:
                e = edges[ch['index']]
                c['init'] = init[ch['index']]
                c['edges'] = int(e.size)
                c['active'] = bool(e.size)
                if e.size:
                    w = np.diff(e)
                    c['first_edge_s'] = float(e[0] / rate)
                    c['last_edge_s'] = float(e[-1] / rate)
                    if w.size:
                        c['min_pulse_samples'] = int(w.min())
                        c['min_pulse_ns'] = float(w.min() * 1e9 / rate)
                        c['one_sample_pulses'] = int((w == 1).sum())
            out['channels'].append(c)
        return out
