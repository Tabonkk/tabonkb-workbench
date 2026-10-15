"""DSLogic T5 regression: summary CLI 契约（非空/≤6000/固定段落顺序/--all 合并/选区标注）。

Run: py docs/dslogic-t5.test.py
"""
import json
import os
import subprocess
import sys

PLUGIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = os.path.join(PLUGIN, 'services', 'dslogic', 'dslogic_cli.py')
CAP_DIR = r'D:\work\Mgmt\TabonKB\00-Inbox\02-Raw-Drop\Data_DSLogic'
REAL_I2C = os.path.join(CAP_DIR, '260722101909.dsl')
REAL_PD = os.path.join(CAP_DIR, '240911143422.dsl')
fails = []


def cli(*args):
    r = subprocess.run([sys.executable, CLI, *args], capture_output=True, encoding='utf-8')
    try:
        res = json.loads(r.stdout)
    except ValueError:
        raise AssertionError('CLI non-JSON output: %s %s' % (r.stdout[:300], r.stderr[:300]))
    assert res.get('ok'), 'CLI error: %s' % res
    return res['data']


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(detail)[:300]))
    if not cond:
        fails.append(name)


SECTIONS = ['## DSLogic 采集概要', '### 通道活跃', '### 异常清单', '### 聚合统计', '### 事务样本']


def section_order_ok(text):
    pos = [text.find(s) for s in SECTIONS]
    return all(p >= 0 for p in pos) and pos == sorted(pos)


def main():
    if not (os.path.exists(REAL_I2C) and os.path.exists(REAL_PD)):
        print('SKIP: real .dsl files not found')
        return

    # 1. 单解码器 summary（I2C 文件内嵌 index=0）
    r = cli('summary', REAL_I2C, '--index', '0')
    s = r['summary']
    check('summary non-empty', len(s) > 100, len(s))
    check('summary <=6000', r['chars'] <= 6000 and len(s) <= 6000, r['chars'])
    check('summary fixed sections', section_order_ok(s), s[:200])
    check('summary mentions file+rate', '260722101909.dsl' in s and 'MHz' in s)

    # 2. --all 合并（PD 文件含 i2c + usb_power_delivery 两个内嵌解码器）
    r2 = cli('summary', REAL_PD, '--all')
    s2 = r2['summary']
    check('summary --all decoder tag', r2['decoder'] == 'all', r2['decoder'])
    check('summary --all non-empty+cap', len(s2) > 100 and len(s2) <= 6000, len(s2))
    check('summary --all sections', section_order_ok(s2))
    # PD 文件里两个解码器都该出现在事务样本或统计中
    check('summary --all multi-proto', ('pd' in s2.lower() or 'usb' in s2.lower()) and
          ('i2c' in s2.lower() or 'I²C' in s2), s2[:300])

    # 3. 选区标注
    r3 = cli('summary', REAL_PD, '--all', '--sel-start-s', '0.33', '--sel-end-s', '0.34')
    check('summary sel line', '选区：0.330000' in r3['summary'], r3['summary'][:200])

    # F1. R65 样本命名冲突：ch0 名为 "SCL" 绑定 sda、ch1 名为 "SDA" 绑定 scl
    s1 = r2['summary']  # --all 结果即 R65 全解码器概要
    check('F1 naming disclaimer', '通道名来自用户，可能与实际信号不符' in s1)
    check('F1 conflict ch0 SCL->sda', '冲突：ch0 名为 "SCL"，但 0:I²C 绑定为 sda' in s1,
          [l for l in s1.split('\n') if '冲突' in l])
    check('F1 conflict ch1 SDA->scl', '冲突：ch1 名为 "SDA"，但 0:I²C 绑定为 scl' in s1,
          [l for l in s1.split('\n') if '冲突' in l])
    conf_line = next((l for l in s1.split('\n') if '命名置信度' in l), '')
    check('F1 confidence not 高', '命名置信度：低' in conf_line and '高' not in conf_line, conf_line)

    # F2. transactions 分页：limit=2 只回 2 条且 total=220
    t2 = cli('transactions', REAL_I2C, '--index', '0', '--limit', '2')
    check('F2 limit=2 len', len(t2['transactions']) == 2, len(t2['transactions']))
    check('F2 total=220', t2['total'] == 220, t2['total'])
    check('F2 offset/limit echoed', t2['offset'] == 0 and t2['limit'] == 2,
          (t2['offset'], t2['limit']))
    t2b = cli('transactions', REAL_I2C, '--index', '0', '--offset', '2', '--limit', '2')
    check('F2 offset page distinct', t2b['transactions'][0]['t_s'] > t2['transactions'][-1]['t_s'],
          (t2['transactions'][-1]['t_s'], t2b['transactions'][0]['t_s']))
    t2c = cli('transactions', REAL_I2C, '--index', '0')
    check('F2 default limit=100', t2c['limit'] == 100 and len(t2c['transactions']) == 100,
          (t2c['limit'], len(t2c['transactions'])))

    # 4. transactions 回归冒烟（t4 已详测，这里保证接口存活）
    r4 = cli('transactions', REAL_PD, '--index', '1')
    check('transactions alive', isinstance(r4['transactions'], list) and len(r4['transactions']) > 0,
          len(r4.get('transactions', [])))

    print()
    print('%d failure(s)' % len(fails))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
