#!/usr/bin/env python3
"""T6a 返工 G2 验收测试：run_decode 的内核可用性语义。

- 内核缺失（DSLCORE_EXE 指向不存在路径）→ DslError「官方内核不可用」，不静默回落 shim
- DSL_ENGINE=shim 显式开启 → 走 srd_shim（仅测试允许）
- 默认（内核存在）→ 官方内核，注解带 inst 字段
"""
import json
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
SERV = os.path.join(os.path.dirname(HERE), 'services', 'dslogic')
sys.path.insert(0, SERV)

from dsl_reader import DslFile, DslError  # noqa: E402  (测试文件允许 import reader/shim)
import native_client  # noqa: E402
import dslogic_cli as cli  # noqa: E402

REAL_I2C = r'D:/work/prj/R65/DSLogic PLus-la-240912-133635.dsl'

fails = []


def check(name, cond, detail=''):
    ok = bool(cond)
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else '  ' + str(detail)[:300]))
    if not ok:
        fails.append(name)


class FakeDsl:
    """最小 dsl 替身：内核缺失分支在触碰文件前就应报错。"""
    path = REAL_I2C
    samplerate = 10e6
    nprobes = 16
    total = 117913088
    decoders = []


SPEC_I2C = {'id': '0:i2c', 'label': '0:i2c', 'pins': {'sda': 0, 'scl': 1},
            'options': {'address_format': 'unshifted'}, 'stacked': []}


def main():
    # ---- G2-1: 内核缺失 -> 显式报错（不回落 shim）----
    env = dict(os.environ)
    env['DSLCORE_EXE'] = r'X:\nonexistent\dslogic-core.exe'
    env.pop('DSL_ENGINE', None)
    # 同时屏蔽自动探测：把 bin/build 候选也指到不存在位置不可行（文件真实存在），
    # 但 DSLCORE_EXE 显式指定时应优先且唯一——若其不存在即视为内核不可用
    saved = dict(os.environ)
    try:
        os.environ.update(env)
        # 强制只认显式路径：临时替换 native_client.native_exe 探测以模拟「无内核」场景
        orig = native_client.native_exe
        native_client.native_exe = lambda: None
        try:
            cli.run_decode(FakeDsl(), SPEC_I2C)
            check('G2 kernel-missing raises', False, '未抛错')
        except DslError as e:
            check('G2 kernel-missing raises', '官方内核不可用' in str(e), e)
        except Exception as e:
            check('G2 kernel-missing raises', False, '错误类型不对: %r' % e)
        finally:
            native_client.native_exe = orig
    finally:
        os.environ.clear(); os.environ.update(saved)

    # ---- G2-2: DSL_ENGINE=shim 显式开启 -> shim 可用 ----
    if not os.path.exists(REAL_I2C):
        print('SKIP shim/native real-file checks (R65 absent)')
        print('\n%d failure(s)' % len(fails))
        return 1 if fails else 0
    saved = dict(os.environ)
    try:
        os.environ['DSL_ENGINE'] = 'shim'
        dsl = DslFile(REAL_I2C)
        spec = cli.decoder_spec_from_params(dsl, {'index': 0})
        anns, err = cli.run_decode(dsl, spec)
        check('G2 explicit shim works', err is None and len(anns) == 3758,
              'anns=%s err=%s' % (len(anns), err))
        check('G2 shim rows have no inst field', not any('inst' in a and a['inst'] for a in anns),
              'shim 不应输出 inst')
    finally:
        os.environ.clear(); os.environ.update(saved)

    # ---- G2-3: 默认（内核存在）-> native，带 inst ----
    saved = dict(os.environ)
    try:
        os.environ.pop('DSL_ENGINE', None)
        os.environ.pop('DSLCORE_EXE', None)
        dsl = DslFile(REAL_I2C)
        spec = cli.decoder_spec_from_params(dsl, {'index': 0})
        anns, err = cli.run_decode(dsl, spec)
        check('G2 default native works', err is None and len(anns) == 3758,
              'anns=%s err=%s' % (len(anns), err))
        check('G2 native rows carry inst', all(a.get('inst') for a in anns[:20]),
              anns[:1])
    finally:
        os.environ.clear(); os.environ.update(saved)

    # ---- G3/T6b: info/edges 数据源 = 官方内核（NativeCapture 对齐 DslFile 契约）----
    saved = dict(os.environ)
    try:
        os.environ.pop('DSL_ENGINE', None)
        os.environ.pop('DSLCORE_EXE', None)
        cap = native_client.open_capture(REAL_I2C)
        check('G3 open_capture -> NativeCapture', type(cap).__name__ == 'NativeCapture',
              type(cap).__name__)
        ref = DslFile(REAL_I2C)
        # info 键值（不含边沿增强字段）逐项对照 reader
        ni, ri = cap.info(), ref.info()
        for k in ('file', 'version', 'driver', 'samplerate', 'total_samples',
                  'duration_s', 'blocks', 'trigger_time_ms', 'trigger_pos'):
            check('G3 info.%s' % k, ni.get(k) == ri.get(k), (ni.get(k), ri.get(k)))
        check('G3 info channels', [(c['index'], c['name'], c['enabled'], c['present'])
                                   for c in ni['channels']] ==
                                  [(c['index'], c['name'], c['enabled'], c['present'])
                                   for c in ri['channels']])
        check('G3 info decoders', ni['decoders'] == ri['decoders'],
              (ni['decoders'], ri['decoders']))
        # edges 与 reader 逐通道全等（官方内核解交叉 vs Python oracle）
        ninit, nedges = cap.load_edges()
        rinit, redges = ref.load_edges()
        check('G3 edge init levels', list(ninit) == list(rinit), (ninit, rinit))
        same = all((n.shape == r.shape and (n == r).all()) for n, r in zip(nedges, redges))
        check('G3 edges per-channel equal', same and len(nedges) == len(redges),
              [(int(n.size), int(r.size)) for n, r in zip(nedges, redges)])
        # 带边沿增强的 info 关键字段对齐
        ni2 = cap.info(ninit, nedges)
        check('G3 info edge-stats', [(c.get('edges'), c.get('active'), c.get('min_pulse_ns'))
                                     for c in ni2['channels'][:4]] ==
                                    [(c.get('edges'), c.get('active'), c.get('min_pulse_ns'))
                                     for c in ref.info(rinit, redges)['channels'][:4]])
        ref.close()
    finally:
        os.environ.clear(); os.environ.update(saved)

    # ---- G3/T6b: worker 进程不再静态引用 dsl_reader/srd_shim/dslogic_cli ----
    code = ("import sys; sys.path.insert(0, %r); import dslogic_worker; "
            "print(','.join(m for m in ('dsl_reader','srd_shim','dslogic_cli') if m in sys.modules))"
            % SERV)
    import subprocess
    p = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, timeout=60)
    leaked = [m for m in p.stdout.strip().split(',') if m]
    check('G3 worker no static reader/shim/cli', p.returncode == 0 and not leaked,
          (p.returncode, p.stdout.strip(), p.stderr.strip()[-200:]))

    print('\n%d failure(s)' % len(fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
