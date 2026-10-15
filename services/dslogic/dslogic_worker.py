"""DSLogic persistent analysis worker (NDJSON over stdin/stdout).

Protocol (one JSON object per line, UTF-8):
  request : {"id": n, "method": "info|decode|wave|close|ping", "params": {...}}
  response: {"id": n, "ok": true, "data": ...} | {"id": n, "ok": false, "error": "中文原因"}
  hello   : {"id": 0, "ok": true, "data": {"ready": true, ...}} written once on startup
            ({"id": 0, "ok": false, "error": ...} instead when a dependency is missing)

Keeps up to 4 opened captures (NativeCapture + edge tables) in an LRU keyed by
file signature. All data (info/edges/decode) comes from the official kernel
dslogic-core via native_client; dsl_reader/srd_shim are test-only
(DSL_ENGINE=shim, lazy). decode results are cached on disk in
%TEMP%/tabonkb-dslogic-cache as dec-<sha1>.json.gz, keyed by file signature +
decoder spec + engine runtime stamp + decoder directory mtimes, so paged decode
hits never re-run the protocol decoders. Read-only: never writes to capture
files.
"""
import gzip
import hashlib
import json
import os
import sys
import tempfile
from collections import OrderedDict


def _early_fail(msg):
    sys.stdout.write(json.dumps({'id': 0, 'ok': False, 'error': msg}, ensure_ascii=False) + '\n')
    sys.stdout.flush()
    sys.exit(1)


import os as _os
_os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')  # 限制 OpenBLAS 分配，防内存压力下子进程 OOM

try:
    import numpy as np
except ImportError:
    _early_fail('缺少 numpy：py -m pip install numpy')

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# T6b：info/wave/decode 数据源全部走官方内核（native_client / decode_pipeline）；
# dsl_reader / srd_shim 不再被本进程引用（仅 decode_pipeline 内 DSL_ENGINE=shim 测试路径惰性加载）。
import native_client  # noqa: E402
from native_client import DslError, open_capture  # noqa: E402
import semantics  # noqa: E402
from decode_pipeline import (DECODER_DIRS, run_decode, decoder_spec_from_params,  # noqa: E402
                             build_decode_output)

MAX_OPEN_FILES = 4
MAX_MEM_DECODE = 8
DEC_CACHE_VERSION = 5

_open = OrderedDict()      # sig -> {'dsl': DslFile, 'init': [...], 'edges': [...]}
_dec_mem = OrderedDict()   # key -> (anns, error)


def _sig(path):
    st = os.stat(path)
    return '%s|%d|%d' % (os.path.abspath(path).lower(), st.st_size, int(st.st_mtime))


def _get_file(path):
    """Open (or reuse) a capture, returning (dsl, init, edges). LRU size 4."""
    if not os.path.isfile(path):
        raise DslError('文件不存在: %s' % path)
    sig = _sig(path)
    ent = _open.get(sig)
    if ent and ent['dsl'].path == path:
        _open.move_to_end(sig)
        return ent['dsl'], ent['init'], ent['edges']
    dsl = open_capture(path)
    init, edges = dsl.load_edges()
    _open[sig] = {'dsl': dsl, 'init': init, 'edges': edges}
    _open.move_to_end(sig)
    while len(_open) > MAX_OPEN_FILES:
        _, ev = _open.popitem(last=False)
        try:
            ev['dsl'].close()
        except Exception:
            pass
    return dsl, init, edges


def _cache_dir():
    d = os.path.join(tempfile.gettempdir(), 'tabonkb-dslogic-cache')
    os.makedirs(d, exist_ok=True)
    return d


def _decoders_mtime(spec):
    """Max mtime_ns over decoder search roots and the spec's decoder package files."""
    mt = 0
    for d in DECODER_DIRS:
        try:
            mt = max(mt, os.stat(d).st_mtime_ns)
        except OSError:
            pass
    for did in [spec['id']] + [s['id'] for s in spec.get('stacked') or []]:
        dname = did.replace(':', '-')     # 目录名 0:i2c -> 0-i2c（Windows 禁冒号）
        for root in DECODER_DIRS:
            dd = os.path.join(root, dname)
            if not os.path.isdir(dd):
                continue
            for r2, _, files in os.walk(dd):
                for fn in files:
                    try:
                        mt = max(mt, os.stat(os.path.join(r2, fn)).st_mtime_ns)
                    except OSError:
                        pass
    return mt


def _runtime_stamp():
    """解码运行时指纹入缓存键：native = 内核 exe mtime；shim = RUNTIME_VERSION（仅测试）。"""
    if native_client.shim_engine():
        import srd_shim                   # 仅测试路径
        return 'shim-%s' % srd_shim.RUNTIME_VERSION
    exe = native_client.native_exe()
    try:
        return 'native-%s' % (os.stat(exe).st_mtime_ns if exe else 'missing')
    except OSError:
        return 'native-missing'


def _decode_cache_key(path, spec):
    payload = json.dumps({
        'sig': _sig(path), 'spec': spec, 'rt': _runtime_stamp(),
        'decmt': _decoders_mtime(spec), 'v': DEC_CACHE_VERSION},
        sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(payload.encode('utf-8')).hexdigest()


def _decode_cached(dsl, spec):
    """Return (anns, error): in-memory LRU -> disk json.gz -> run_decode."""
    key = _decode_cache_key(dsl.path, spec)
    hit = _dec_mem.get(key)
    if hit is not None:
        _dec_mem.move_to_end(key)
        return hit[0], hit[1]
    cp = os.path.join(_cache_dir(), 'dec-%s.json.gz' % key)
    if os.path.isfile(cp):
        try:
            with gzip.open(cp, 'rt', encoding='utf-8') as f:
                blob = json.load(f)
            anns, error = blob['anns'], blob['error']
        except Exception:
            anns = None
        if anns is not None:
            _dec_mem_put(key, anns, error)
            return anns, error
    anns, error = run_decode(dsl, spec)
    tmp = cp + '.tmp'
    try:
        with gzip.open(tmp, 'wt', encoding='utf-8') as f:
            json.dump({'anns': anns, 'error': error}, f, ensure_ascii=False)
        os.replace(tmp, cp)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    _dec_mem_put(key, anns, error)
    return anns, error


def _dec_mem_put(key, anns, error):
    _dec_mem[key] = (anns, error)
    _dec_mem.move_to_end(key)
    while len(_dec_mem) > MAX_MEM_DECODE:
        _dec_mem.popitem(last=False)


def _level_at(init, edges, s):
    return init ^ (int(np.searchsorted(edges, s, 'right')) & 1)


def m_ping(p):
    return {'ready': True, 'pid': os.getpid(), 'open_files': [e['dsl'].path for e in _open.values()],
            'dec_cache': len(_dec_mem)}


def m_info(p):
    dsl, init, edges = _get_file(p['file'])
    return dsl.info(init, edges)


def m_decode(p):
    dsl, init, edges = _get_file(p['file'])
    spec = decoder_spec_from_params(dsl, p)
    anns, error = _decode_cached(dsl, spec)
    return build_decode_output(dsl, spec, anns, error, os.path.basename(dsl.path),
                               max(0, int(p.get('offset') or 0)),
                               max(0, int(p.get('limit') if p.get('limit') is not None else 500)),
                               p.get('row'), p.get('start_s'), p.get('end_s'),
                               p.get('q'), bool(p.get('overlap')))


def m_wave(p):
    """Per-channel waveform window. Contract (DSLOGIC_ARCHITECTURE §4.1):

    Window is [start, end) in sample indices (clamped to [0, total]).
    init_level = level at `start` (an edge exactly at start is already applied).
    If the channel has <= 2*px edges inside the window -> mode "edges" with the
    edge sample indices (start <= e < end). Otherwise mode "dense": pixel i
    covers samples [start + i*w, start + (i+1)*w) with w = (end-start)/px;
    buckets[i] = 2 when an edge falls inside, else the level at bucket start.
    """
    dsl, init, edges = _get_file(p['file'])
    total = dsl.total
    start = max(0, min(int(p.get('start') or 0), total))
    end = max(start, min(int(p.get('end') if p.get('end') is not None else total), total))
    px = int(p.get('px') or 0)
    if not (1 <= px <= 4096):
        raise DslError('px 超出合法范围 1..4096: %s' % px)
    chans = p.get('channels')
    if chans is None:
        chans = [i for i in range(dsl.nprobes) if edges[i].size]
    out = []
    span = end - start
    for ci in chans:
        ci = int(ci)
        if not (0 <= ci < dsl.nprobes):
            raise DslError('通道索引越界: %s' % ci)
        e = edges[ci]
        lv = _level_at(init[ci], e, start)
        lo = int(np.searchsorted(e, start, 'left'))
        hi = int(np.searchsorted(e, end, 'left'))
        cnt = hi - lo
        item = {'index': ci, 'init_level': int(lv)}
        if cnt <= 2 * px or span <= 0:
            item['mode'] = 'edges'
            item['edges'] = e[lo:hi].tolist()
        else:
            item['mode'] = 'dense'
            pix = np.floor((e[lo:hi].astype(np.float64) - start) * px / span).astype(np.int64)
            buckets = np.zeros(px, np.uint8)
            buckets[pix] = 2
            rest = np.nonzero(buckets == 0)[0]
            bs = start + np.floor(rest.astype(np.float64) * span / px).astype(np.int64)
            buckets[rest] = (init[ci] ^ (np.searchsorted(e, bs, 'right') & 1)).astype(np.uint8)
            item['buckets'] = buckets.tolist()
        out.append(item)
    return {'start': start, 'end': end, 'px': px, 'channels': out}


def _spec_and_anns(dsl, p):
    spec = decoder_spec_from_params(dsl, p)
    anns, error = _decode_cached(dsl, spec)
    return spec, anns, error


def m_transactions(p):
    """decode 注解 -> 协议事务 + 异常清单（DSLOGIC_ARCHITECTURE §4.3）。"""
    dsl, init, edges = _get_file(p['file'])
    spec, anns, error = _spec_and_anns(dsl, p)
    data = semantics.build_transactions(dsl, spec, anns, error, init, edges)
    data['file'] = os.path.basename(dsl.path)
    data['decoder'] = spec['id']
    data['label'] = spec['label']
    # 视窗过滤（秒），便于 UI 只取可见段事务
    s0 = p.get('start_s')
    s1 = p.get('end_s')
    if s0 is not None:
        data['transactions'] = [t for t in data['transactions'] if t['t_s'] >= float(s0)]
    if s1 is not None:
        data['transactions'] = [t for t in data['transactions'] if t['t_s'] <= float(s1)]
    # F2: offset/limit/total 分页（默认 limit=100，上限 1000）
    total = len(data['transactions'])
    offset = max(0, int(p.get('offset') or 0))
    limit = p.get('limit')
    limit = min(1000, max(1, int(limit))) if limit is not None else 100
    data['total'] = total
    data['offset'] = offset
    data['limit'] = limit
    data['transactions'] = data['transactions'][offset:offset + limit]
    return data


def m_summary(p):
    """AI 上下文包（<=6000 中文字符，段落顺序见架构 §6）。可选 sel_start_s/sel_end_s 选区。
    all=true 或未指定解码器时合并文件内全部内嵌解码器的事务与异常。"""
    dsl, init, edges = _get_file(p['file'])
    if p.get('decoder') or p.get('index') is not None:
        specs = [decoder_spec_from_params(dsl, p)]
    else:
        specs = [decoder_spec_from_params(dsl, {'index': i})
                 for i in range(len(dsl.decoders or []))]
    txns, anomalies, seen_sig = [], [], set()
    for spec in specs:
        anns, error = _decode_cached(dsl, spec)
        tx = semantics.build_transactions(dsl, spec, anns, error, init, edges)
        txns.extend(tx['transactions'])
        for a in tx['anomalies']:
            sig = (a['type'], a['detail'])
            if sig not in seen_sig:      # glitch_dense/undersampled 按通道去重
                seen_sig.add(sig)
                anomalies.append(a)
    txns.sort(key=lambda t: t['t_s'])
    anomalies.sort(key=lambda a: a['t_s'])
    info = dsl.info(init, edges)
    spec0 = specs[0] if len(specs) == 1 else None
    text = semantics.build_summary(dsl, spec0, info, txns, anomalies,
                                   p.get('sel_start_s'), p.get('sel_end_s'), specs=specs)
    return {'file': os.path.basename(dsl.path),
            'decoder': spec0['id'] if spec0 else 'all',
            'summary': text, 'chars': len(text),
            'transactions': len(txns), 'anomalies': len(anomalies)}


def m_close(p):
    """Evict cached files. params: file -> only that file; absent -> all."""
    target = p.get('file')
    closed = []
    for sig in list(_open.keys()):
        if target is None or os.path.abspath(target).lower() in sig:
            ent = _open.pop(sig)
            try:
                ent['dsl'].close()
            except Exception:
                pass
            closed.append(ent['dsl'].path)
    return {'closed': closed}


METHODS = {'ping': m_ping, 'info': m_info, 'decode': m_decode, 'wave': m_wave, 'close': m_close,
           'transactions': m_transactions, 'summary': m_summary}


def _emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + '\n')
    sys.stdout.flush()


def main():
    sys.stdout.reconfigure(encoding='utf-8', newline='\n')
    sys.stdin.reconfigure(encoding='utf-8', newline='\n')
    _emit({'id': 0, 'ok': True, 'data': {'ready': True, 'pid': os.getpid()}})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except ValueError:
            _emit({'id': None, 'ok': False, 'error': '请求不是合法 JSON'})
            continue
        rid = req.get('id')
        method = req.get('method')
        fn = METHODS.get(method)
        if not fn:
            _emit({'id': rid, 'ok': False, 'error': '未知方法: %s' % method})
            continue
        try:
            _emit({'id': rid, 'ok': True, 'data': fn(req.get('params') or {})})
        except (DslError, KeyError, ValueError, OSError) as e:
            _emit({'id': rid, 'ok': False, 'error': str(e).strip("'")})
        except Exception as e:
            _emit({'id': rid, 'ok': False, 'error': '%s: %s' % (type(e).__name__, e)})
    return 0


if __name__ == '__main__':
    sys.exit(main())
