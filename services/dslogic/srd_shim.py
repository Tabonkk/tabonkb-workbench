"""Pure-Python sigrokdecode runtime for DSView (libsigrokdecode4DSL) decoders.

Runs official protocol decoders over per-channel edge lists instead of raw
samples: wait() jumps directly between edges/skip targets, so cost scales with
edge count, not sample count. Supports api_version 3 semantics used by DSView:
conditions h/l/r/f/e/n/skip, int bitmask `matched`, OUTPUT_PYTHON stacking.
"""
import importlib.util
import os
import re
import sys
import types
from bisect import bisect_left, bisect_right

RUNTIME_VERSION = 2  # bump when shim semantics change; part of decode cache key

srd = types.ModuleType('sigrokdecode')
srd.OUTPUT_ANN, srd.OUTPUT_PYTHON, srd.OUTPUT_BINARY, srd.OUTPUT_META = 0, 1, 2, 3
srd.SRD_CONF_SAMPLERATE = 10000
srd.SRD_INITIAL_PIN_SAME_AS_SAMPLE0 = 2


class EndOfData(Exception):
    pass


class Decoder:
    def register(self, output_type, **kw):
        return output_type

    def put(self, ss, es, output_id, data):
        self._sink(self, ss, es, output_id, data)

    def has_channel(self, idx):
        return idx < len(self._pins) and self._pins[idx] is not None

    def wait(self, conds=None):
        if conds is None:
            conds = [{}]
        elif isinstance(conds, dict):
            conds = [conds]
        cur = self.samplenum
        s = 0 if cur < 0 else cur + 1
        base = max(cur, 0)
        probes = {self._pins[k] for c in conds for k in c
                  if k != 'skip' and k < len(self._pins) and self._pins[k] is not None}
        skips = [base + c['skip'] for c in conds if 'skip' in c]
        total = self._total
        while True:
            if s >= total:
                raise EndOfData()
            m = 0
            for i, c in enumerate(conds):
                if self._check(c, s, base):
                    m |= 1 << i
            if m:
                self.samplenum = s
                self.matched = m
                return tuple(self._level(p, s) if p is not None else 0 for p in self._pins)
            nxt = total
            for p in probes:
                e = self._edges[p]
                j = bisect_left(e, s + 1)
                if j < len(e) and e[j] < nxt:
                    nxt = e[j]
            for k in skips:
                if s < k < nxt:
                    nxt = k
            s = nxt

    def _level(self, p, s):
        return self._init[p] ^ (bisect_right(self._edges[p], s) & 1)

    def _is_edge(self, p, s):
        e = self._edges[p]
        j = bisect_left(e, s)
        return j < len(e) and e[j] == s

    def _check(self, c, s, base):
        for k, v in c.items():
            if k == 'skip':
                if s != base + v:
                    return False
                continue
            p = self._pins[k] if k < len(self._pins) else None
            if p is None:
                return False
            lv = self._level(p, s)
            if v == 'h':
                if lv != 1: return False
            elif v == 'l':
                if lv != 0: return False
            else:
                edge = s > 0 and self._is_edge(p, s)
                if v == 'r':
                    if not (edge and lv == 1): return False
                elif v == 'f':
                    if not (edge and lv == 0): return False
                elif v == 'e':
                    if not edge: return False
                elif v == 'n':
                    if edge: return False
                else:
                    raise ValueError('unsupported wait condition: %r' % (v,))
        return True


srd.Decoder = Decoder
sys.modules['sigrokdecode'] = srd

_ID_RE = re.compile(r"^\s+id\s*=\s*['\"]([^'\"]+)['\"]", re.M)
_META_RE = {k: re.compile(r"^\s+%s\s*=\s*['\"]([^'\"]*)['\"]" % k, re.M) for k in ('name', 'longname')}
_LIST_RE = {k: re.compile(r"^\s+%s\s*=\s*\[([^\]]*)\]" % k, re.M) for k in ('inputs', 'outputs')}


class Registry:
    """Maps decoder id ('0:i2c', 'usb_power_delivery') -> package directory."""

    def __init__(self, dirs):
        self.dirs = [d for d in dirs if d and os.path.isdir(d)]
        self.index = {}
        for root in reversed(self.dirs):  # earlier dirs win
            for name in os.listdir(root):
                pd = os.path.join(root, name, 'pd.py')
                if not os.path.isfile(pd):
                    continue
                with open(pd, encoding='utf-8', errors='replace') as f:
                    src = f.read()
                m = _ID_RE.search(src)
                if not m:
                    continue
                info = {'id': m.group(1), 'dir': os.path.join(root, name)}
                for k, r in _META_RE.items():
                    mm = r.search(src)
                    info[k] = mm.group(1) if mm else ''
                for k, r in _LIST_RE.items():
                    mm = r.search(src)
                    info[k] = re.findall(r"['\"]([^'\"]+)['\"]", mm.group(1)) if mm else []
                self.index[info['id']] = info
        for root in self.dirs:
            if root not in sys.path:
                sys.path.insert(0, root)  # for `from common.srdhelper import ...`
        self._loaded = {}

    def list(self):
        return sorted(({k: v for k, v in i.items() if k != 'dir'} for i in self.index.values()), key=lambda x: x['id'])

    def describe(self, dec_id):
        """单个解码器的配置元数据（channels/optional_channels/options），供 UI 渲染配置表单。"""
        cls = self.load(dec_id)

        def chans(seq):
            return [{'id': c.get('id'), 'name': c.get('name') or c.get('id'),
                     'desc': c.get('desc') or ''} for c in seq]

        def opts(seq):
            out = []
            for o in seq:
                vals = o.get('values')
                out.append({'id': o.get('id'), 'desc': o.get('desc') or o.get('id'),
                            'default': o.get('default'),
                            'values': [v if isinstance(v, (int, float)) else str(v)
                                       for v in vals] if vals is not None else None})
            return out

        return {'id': dec_id, 'name': getattr(cls, 'name', dec_id),
                'longname': getattr(cls, 'longname', ''),
                'inputs': list(getattr(cls, 'inputs', []) or []),
                'channels': chans(getattr(cls, 'channels', ())),
                'optional_channels': chans(getattr(cls, 'optional_channels', ())),
                'options': opts(getattr(cls, 'options', ()))}

    def load(self, dec_id):
        if dec_id in self._loaded:
            return self._loaded[dec_id]
        info = self.index.get(dec_id)
        if not info:
            raise KeyError('未知解码器: %s' % dec_id)
        pkg_dir = info['dir']
        mod_name = 'dslpd_' + re.sub(r'\W', '_', os.path.basename(pkg_dir))
        spec = importlib.util.spec_from_file_location(mod_name, os.path.join(pkg_dir, '__init__.py'),
                                                      submodule_search_locations=[pkg_dir])
        mod = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = mod
        spec.loader.exec_module(mod)
        self._loaded[dec_id] = mod.Decoder
        return mod.Decoder


def _fmt_texts(strings):
    if strings and isinstance(strings[-1], int):
        val = strings[-1]
        return [str(x).replace('{$}', '%02X' % val) for x in strings[:-1]]
    return [str(x) for x in strings]


def _ann_meta(cls):
    anns = getattr(cls, 'annotations', ())
    rows = getattr(cls, 'annotation_rows', ())
    row_of = {}
    for r in rows:
        for a in r[2]:
            row_of.setdefault(a, (r[0], r[1]))
    # DSView ann_type 规则 (libsigrokdecode4DSL decoder.c get_annotations):
    # 3 元组注释首元素为数字字符串 -> ann_type=int；2 元组 -> 自增计数器(初始 7)
    auto_type = 7
    meta = []
    for i, a in enumerate(anns):
        row = row_of.get(i, (a[-2], a[-1]))
        if len(a) >= 3:
            try:
                auto_type = int(a[0])  # 3 元组覆写计数器
            except (TypeError, ValueError):
                pass
            atype = auto_type
        else:
            atype = auto_type
            auto_type += 1
        meta.append({'ann': a[-2], 'desc': a[-1], 'row': row[0], 'row_desc': row[1],
                     'cls': atype})
    return meta


def _instantiate(cls, options, samplerate):
    d = cls()
    opts = {o['id']: o['default'] for o in getattr(cls, 'options', ())}
    opts.update(options or {})
    d.options = opts
    d.samplenum = -1
    d.matched = 0
    if hasattr(d, 'metadata'):
        d.metadata(srd.SRD_CONF_SAMPLERATE, int(samplerate))
    return d


def run_stack(registry, dec_id, pins, options, stacked, edges, init, total, samplerate):
    """Run a decoder (and its stacked decoders) over edge lists.

    pins: {channel_id: probe_index}; stacked: [{'id':..., 'options':{...}}].
    Returns (annotations, error). annotations: list of dicts sorted by ss.
    """
    out = []
    chain = []
    for level, (did, opts) in enumerate([(dec_id, options)] + [(s['id'], s.get('options')) for s in (stacked or [])]):
        cls = registry.load(did)
        chain.append((did, cls, _ann_meta(cls), _instantiate(cls, opts, samplerate)))

    def make_sink(level):
        did, cls, meta, _ = chain[level]

        def sink(dec, ss, es, oid, data):
            if oid == srd.OUTPUT_ANN:
                m = meta[data[0]]
                out.append({'ss': int(ss), 'es': int(es), 'dec': did, 'row': m['row'], 'row_desc': m['row_desc'],
                            'ann': m['ann'], 'cls': m['cls'], 'texts': _fmt_texts(data[1])})
            elif oid == srd.OUTPUT_PYTHON and level + 1 < len(chain):
                chain[level + 1][3].decode(ss, es, data)
        return sink

    for level, (did, cls, meta, inst) in enumerate(chain):
        inst._sink = make_sink(level)
        inst.start()

    root_cls, root = chain[0][1], chain[0][3]
    chans = list(getattr(root_cls, 'channels', ())) + list(getattr(root_cls, 'optional_channels', ()))
    missing = [c['id'] for c in getattr(root_cls, 'channels', ()) if c['id'] not in pins]
    if missing:
        raise ValueError('解码器 %s 缺少必需通道: %s' % (dec_id, ', '.join(missing)))
    root._pins = [pins.get(c['id']) for c in chans]
    root._edges = edges
    root._init = init
    root._total = total
    error = None
    try:
        root.decode()
    except EndOfData:
        pass
    except Exception as e:  # decoder bug / malformed data: keep partial output, surface error
        error = '%s: %s' % (type(e).__name__, e)
    out.sort(key=lambda a: a['ss'])
    return out, error
