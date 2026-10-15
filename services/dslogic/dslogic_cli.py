"""DSLogic offline analysis CLI (JSON on stdout).

  info     <file>                       capture metadata + per-channel edge stats
  decode   <file> [--index N | --decoder ID --pins JSON [--options JSON] [--stack JSON]]
                  [--offset 0 --limit 500 --row ROW --start-s S --end-s S]
  decoders                              list available decoders
  verify-csv <file> <csv> [--index N]   compare against DSView protocol-list CSV export
"""
import argparse
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')  # 在 numpy 导入前生效，防内存压力下 OOM

# T6b：生产数据源 = 官方内核（native_client / decode_pipeline）；
# dsl_reader / srd_shim 仅在 decode_pipeline 内 DSL_ENGINE=shim 显式测试路径中惰性引用。
import native_client  # noqa: E402
from native_client import DslError, open_capture  # noqa: E402
from decode_pipeline import (DECODER_DIRS, registry, run_decode, decoder_spec_from_params,  # noqa: E402,F401
                             build_decode_output, describe_decoder, list_decoders)

_native_exe = native_client.native_exe      # 兼容：测试/外部引用 cli._native_exe
_native_pyhome = native_client.native_pyhome

def _decoder_spec(dsl, args):
    return decoder_spec_from_params(dsl, {
        'decoder': args.decoder, 'pins': json.loads(args.pins or '{}'),
        'options': json.loads(args.options or '{}'), 'stacked': json.loads(args.stack or '[]'),
        'index': args.index})


def cmd_info(a):
    dsl = open_capture(a.file)
    init, edges = dsl.load_edges()
    return dsl.info(init, edges)


def cmd_decode(a):
    dsl = open_capture(a.file)
    spec = _decoder_spec(dsl, a)
    anns, error = run_decode(dsl, spec)
    return build_decode_output(dsl, spec, anns, error, os.path.basename(a.file),
                               a.offset, a.limit if a.limit is not None else 500,
                               a.row, a.start_s, a.end_s,
                               getattr(a, 'q', None), getattr(a, 'overlap', False))


def cmd_decoders(a):
    if native_client.shim_engine():
        return {'dirs': registry().dirs, 'decoders': registry().list()}
    return {'dirs': [native_client.NATIVE_DECODER_DIR], 'decoders': list_decoders()}


def cmd_describe(a):
    d = describe_decoder(a.decoder)
    if d is None:
        raise DslError('解码器不存在: %s' % a.decoder)
    return d


def cmd_transactions(a):
    import semantics
    dsl = open_capture(a.file)
    spec = _decoder_spec(dsl, a)
    anns, error = run_decode(dsl, spec)
    init, edges = dsl.load_edges()
    data = semantics.build_transactions(dsl, spec, anns, error, init, edges)
    data['file'] = os.path.basename(a.file)
    data['decoder'] = spec['id']
    if a.start_s is not None:
        data['transactions'] = [t for t in data['transactions'] if t['t_s'] >= a.start_s]
    if a.end_s is not None:
        data['transactions'] = [t for t in data['transactions'] if t['t_s'] <= a.end_s]
    # F2: offset/limit/total 分页（默认 limit=100，上限 1000）
    total = len(data['transactions'])
    offset = max(0, int(a.offset or 0))
    limit = min(1000, max(1, int(a.limit))) if a.limit is not None else 100
    data['total'] = total
    data['offset'] = offset
    data['limit'] = limit
    data['transactions'] = data['transactions'][offset:offset + limit]
    return data


def cmd_summary(a):
    import semantics
    dsl = open_capture(a.file)
    init, edges = dsl.load_edges()
    if a.all:
        specs = [decoder_spec_from_params(dsl, {'index': i})
                 for i in range(len(dsl.decoders or []))]
    else:
        specs = [_decoder_spec(dsl, a)]
    txns, anomalies, seen = [], [], set()
    for spec in specs:
        anns, error = run_decode(dsl, spec)
        tx = semantics.build_transactions(dsl, spec, anns, error, init, edges)
        txns.extend(tx['transactions'])
        for an in tx['anomalies']:
            sig = (an['type'], an['detail'])
            if sig not in seen:
                seen.add(sig)
                anomalies.append(an)
    txns.sort(key=lambda t: t['t_s'])
    anomalies.sort(key=lambda x: x['t_s'])
    info = dsl.info(init, edges)
    text = semantics.build_summary(dsl, specs[0] if len(specs) == 1 else None,
                                   info, txns, anomalies,
                                   a.sel_start_s, a.sel_end_s, specs=specs)
    return {'file': os.path.basename(a.file), 'decoder': specs[0]['id'] if len(specs) == 1 else 'all',
            'summary': text, 'chars': len(text)}


def cmd_verify_csv(a):
    dsl = open_capture(a.file)
    spec = _decoder_spec(dsl, a)
    anns, error = run_decode(dsl, spec)
    with open(a.csv, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.reader(f))
    head, body = rows[0], rows[1:]
    col = head[2] if len(head) > 2 else ''
    row_desc = col.split(': ', 1)[1] if ': ' in col else None
    mine = [(x['t_ns'], x['texts'][0] if x['texts'] else '') for x in anns
            if row_desc is None or x['row_desc'] == row_desc]
    ref = [(round(float(r[1]), 2), r[2]) for r in body if len(r) >= 3]
    mism = [{'i': i, 'mine': m, 'ref': r} for i, (m, r) in enumerate(zip(mine, ref)) if m != r]
    return {'file': os.path.basename(a.file), 'csv': os.path.basename(a.csv), 'column': col,
            'mine': len(mine), 'ref': len(ref), 'mismatches': len(mism) + abs(len(mine) - len(ref)),
            'first_mismatches': mism[:20], 'match': not mism and len(mine) == len(ref), 'decoder_error': error}


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('info'); s.add_argument('file')
    for name in ('decode', 'verify-csv', 'transactions', 'summary'):
        s = sub.add_parser(name)
        s.add_argument('file')
        if name == 'verify-csv':
            s.add_argument('csv')
        s.add_argument('--index', type=int, default=0)
        s.add_argument('--decoder'); s.add_argument('--pins'); s.add_argument('--options'); s.add_argument('--stack')
        s.add_argument('--offset', type=int, default=0); s.add_argument('--limit', type=int, default=None)
        s.add_argument('--row'); s.add_argument('--start-s', type=float); s.add_argument('--end-s', type=float)
        s.add_argument('--q'); s.add_argument('--overlap', action='store_true')
        s.add_argument('--sel-start-s', type=float); s.add_argument('--sel-end-s', type=float)
        s.add_argument('--all', action='store_true')
    sub.add_parser('decoders')
    sd = sub.add_parser('describe'); sd.add_argument('decoder')
    a = p.parse_args()
    if getattr(a, 'stack', None):
        a.stack = json.dumps([{'id': x} if isinstance(x, str) else x for x in json.loads(a.stack)])
    fn = {'info': cmd_info, 'decode': cmd_decode, 'decoders': cmd_decoders, 'verify-csv': cmd_verify_csv,
          'transactions': cmd_transactions, 'summary': cmd_summary, 'describe': cmd_describe}[a.cmd]
    try:
        res = {'ok': True, 'data': fn(a)}
        code = 0
    except (DslError, KeyError, ValueError, OSError) as e:
        res = {'ok': False, 'error': str(e).strip("'")}
        code = 1
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stdout.write(json.dumps(res, ensure_ascii=False))
    return code


if __name__ == '__main__':
    sys.exit(main())
