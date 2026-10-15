"""解码管线：spec 构建/校验、run_decode 分发（官方内核 | 显式 shim）、
注解行格式化输出。worker 与 CLI 共用。

引擎选择（DSLOGIC_TASKS 规则 11）：
  默认 = 官方内核 dslogic-core（native_client 一次性 NDJSON 子进程）；
  DSL_ENGINE=shim 显式开启时才走 Python srd_shim，且 shim 仅用于测试。
内核缺失时抛 DslError('官方内核不可用…')，绝不静默回落。
"""
import os
import subprocess  # noqa: F401  (保留给扩展)
from collections import Counter

import native_client
from native_client import DslError, native_exe, shim_engine  # noqa: F401  re-export

DECODER_DIRS = native_client.SHIM_DECODER_DIRS   # shim registry 搜索根

_registry = None


def registry():
    """Python shim 解码器注册表 —— 仅 DSL_ENGINE=shim 测试路径使用。"""
    global _registry
    if _registry is None:
        import srd_shim                      # 仅测试路径（worker 不静态引用）
        _registry = srd_shim.Registry(DECODER_DIRS)
    return _registry


def describe_decoder(dec_id, exe=None):
    """按当前引擎取解码器元数据；不存在/不可用返回 None。"""
    if shim_engine():
        try:
            return registry().describe(dec_id)
        except Exception:
            return None
    return native_client.describe(dec_id, exe=exe)


def list_decoders(exe=None):
    """按当前引擎取解码器列表。"""
    if shim_engine():
        return registry().list()
    return native_client.list_decoders(exe=exe)


def _norm_stacked(stacked):
    out = []
    for s in stacked or []:
        if isinstance(s, dict):
            out.append({'id': s['id'], 'options': s.get('options') or {}})
        else:
            out.append({'id': s, 'options': {}})
    return out


def decoder_spec_from_params(dsl, p):
    """Build the decoder spec from a params dict (worker) — see _decoder_spec for CLI."""
    if p.get('decoder'):
        return {'id': p['decoder'], 'label': p.get('label') or p['decoder'],
                'pins': {k: int(v) for k, v in (p.get('pins') or {}).items()},
                'options': p.get('options') or {}, 'stacked': _norm_stacked(p.get('stacked'))}
    index = int(p.get('index') or 0)
    if not dsl.decoders:
        raise DslError('文件内未配置解码器，请指定 decoder 与 pins')
    if index >= len(dsl.decoders):
        raise DslError('解码器索引 %d 越界（共 %d 个）' % (index, len(dsl.decoders)))
    d = dsl.decoders[index]
    return {'id': d['id'], 'label': d.get('label', d['id']),
            'pins': {k: int(v) for c in d.get('channel', []) for k, v in c.items()},
            'options': d.get('options', {}), 'stacked': _norm_stacked(d.get('stacked decoders'))}


def _run_decode_native(dsl, spec, exe=None):
    """调用官方内核 dslogic-core 解码（一次性 NDJSON 进程）。返回 (anns, error)。
    输出字段与 srd_shim 对齐：{$} 占位符按 hex 值替换（官方在 UI 渲染期替换，shim 提前替换）。"""
    exe = exe or native_client.native_exe()
    if not exe:
        return None
    try:
        data = native_client.call('decode', {
            'file': dsl.path, 'id': spec['id'], 'pins': spec['pins'],
            'options': spec['options'], 'stacked': spec['stacked']}, exe=exe, timeout=600)
    except DslError as e:
        return [], str(e)
    anns = []
    for a in data.get('annotations', []):
        hexv = a.get('hex')
        texts = []
        for t in (a.get('texts') or []):
            if t == chr(10) and hexv is not None:
                texts.append(hexv)      # 官方 '@hex' 哨兵：DSView 渲染为数值（type_decoder.c）
            elif hexv is not None and '{$}' in t:
                texts.append(t.replace('{$}', hexv))
            else:
                texts.append(t)
        anns.append({'ss': int(a['ss']), 'es': int(a['es']), 'dec': a['dec'],
                     'row': a.get('row'), 'row_desc': a.get('row_desc'),
                     'ann': a['ann'], 'cls': a.get('cls'), 'texts': texts,
                     'inst': a.get('inst'),
                     'hex': hexv, 'num': a.get('num')})
    # 官方按解码器发射序输出（值注解常先于其 marker），契约要求按 ss 时序排列
    anns.sort(key=lambda a: (a['ss'], a['es']))
    return anns, None


def run_decode(dsl, spec):
    if not shim_engine() and not native_client.native_exe():
        raise DslError('官方内核不可用：未找到 dslogic-core（执行 native/dslogic-core/build.ps1 构建）')
    exe = native_client.native_exe()
    # 契约校验：未知解码器 / 缺失必需通道绑定 -> 显式错误（p0 验收）
    meta = describe_decoder(spec['id'], exe=exe)
    if meta is None:
        raise DslError('解码器不存在: %s' % spec['id'])
    for ch in meta['channels']:
        if ch['id'] not in spec['pins']:
            raise DslError('通道 %s 未绑定' % ch['id'])
    for s in spec['stacked']:
        if describe_decoder(s['id'], exe=exe) is None:
            raise DslError('堆叠解码器不存在: %s' % s['id'])
    for k, p in spec['pins'].items():
        if not (0 <= int(p) < dsl.nprobes):
            raise DslError('通道 %s 绑定的探头 %s 不存在' % (k, p))
    if shim_engine():
        # 显式 shim：仅测试路径（DSLOGIC_TASKS 规则 11）
        import srd_shim                    # 仅测试路径（worker 不静态引用）
        init, edges = dsl.load_edges()
        lists = [e.tolist() for e in edges]
        anns, error = srd_shim.run_stack(registry(), spec['id'], {k: int(v) for k, v in spec['pins'].items()},
                                         spec['options'], spec['stacked'], lists, init, dsl.total, dsl.samplerate)
    else:
        if not exe:
            raise DslError('官方内核不可用：未找到 dslogic-core（执行 native/dslogic-core/build.ps1 构建）')
        anns, error = _run_decode_native(dsl, spec, exe)
    rate = dsl.samplerate
    for a in anns:
        a['t_ns'] = round(a['ss'] * 1e9 / rate, 2)
        a['dur_ns'] = round((a['es'] - a['ss']) * 1e9 / rate, 2)
    return anns, error


def build_decode_output(dsl, spec, anns, error, file_name, offset=0, limit=500,
                        row=None, start_s=None, end_s=None, q=None, overlap=False):
    counts = Counter('%s/%s' % (x['dec'], x['ann']) for x in anns)
    rows = anns
    if row:
        rows = [x for x in rows if x['row'] == row]
    # overlap=True: 注释与视窗 [start_s,end_s] 相交即保留 (es>=start 且 ss<=end),
    # 用于 T3 视窗解码行, 避免起点在视窗外的长注释消失
    if start_s is not None:
        if overlap:
            rows = [x for x in rows if x['es'] >= start_s * dsl.samplerate]
        else:
            rows = [x for x in rows if x['ss'] >= start_s * dsl.samplerate]
    if end_s is not None:
        rows = [x for x in rows if x['ss'] <= end_s * dsl.samplerate]
    if q:
        ql = q.lower()
        rows = [x for x in rows if any(ql in t.lower() for t in x['texts'])]
    page = rows[offset:offset + limit]
    for i, x in enumerate(page):
        x['i'] = offset + i
    out = {'file': file_name, 'samplerate': dsl.samplerate, 'decoder': spec['id'],
           'label': spec['label'], 'pins': spec['pins'], 'options': spec['options'],
           'stacked': [s['id'] for s in spec['stacked']], 'total': len(rows), 'all_annotations': len(anns),
           'offset': offset, 'limit': limit, 'counts': dict(counts), 'rows': page}
    if error:
        out['decoder_error'] = error
    return out
