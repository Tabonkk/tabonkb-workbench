"""官方内核 dslogic-core 的 NDJSON 客户端（生产数据源）。

worker/CLI 的 info / edges / decode / decoders / describe 全部经此调用
native/dslogic-core（一次性子进程，stdin/stdout NDJSON）。dsl_reader /
srd_shim 仅保留给 DSL_ENGINE=shim 显式测试路径，本模块不引用它们。

NativeCapture 与 dsl_reader.DslFile 鸭子类型对齐（path/total/nprobes/
samplerate/decoders/channels/session/info()/load_edges()），可无缝替换。
"""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(os.path.dirname(HERE))          # tabonkb-workbench/
NATIVE_ROOT = os.path.join(PLUGIN, 'native', 'dslogic-core')
# 内核解码器目录（DSLCORE_DECODERS）；decoders-local 仅 Python shim 使用
NATIVE_DECODER_DIR = os.path.join(PLUGIN, 'vendor', 'dslogic', 'decoders')
SHIM_DECODER_DIRS = [os.path.join(PLUGIN, 'vendor', 'dslogic', 'decoders-local'),
                     os.path.join(PLUGIN, 'vendor', 'dslogic', 'decoders')]


class DslError(Exception):
    pass


def shim_engine():
    """DSL_ENGINE=shim 显式开启测试路径（规则 11：shim 不允许静默回落）。"""
    return os.environ.get('DSL_ENGINE', '').lower() == 'shim'


def native_exe():
    """官方内核可执行文件：DSLCORE_EXE 显式指定 > bin/dslogic-core 打包产物 > build/ 开发产物。
    DSL_ENGINE=shim 显式开启时返回 None（仅测试用）。"""
    if shim_engine():
        return None
    cands = []
    if os.environ.get('DSLCORE_EXE'):
        cands.append(os.environ['DSLCORE_EXE'])
    cands += [os.path.join(NATIVE_ROOT, 'bin', 'dslogic-core', 'dslogic-core.exe'),
              os.path.join(NATIVE_ROOT, 'bin', 'dslogic-core', 'dslogic-core'),
              os.path.join(NATIVE_ROOT, 'build', 'dslogic-core.exe'),
              os.path.join(NATIVE_ROOT, 'build', 'dslogic-core')]
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None


def native_pyhome(exe=None):
    """嵌入式 Python：DSLCORE_PYTHON_HOME > exe 旁 python/（打包产物）> MSYS2 常见安装位。"""
    cands = [os.environ.get('DSLCORE_PYTHON_HOME')]
    if exe:
        cands.append(os.path.join(os.path.dirname(os.path.abspath(exe)), 'python'))
    cands += [os.path.join(NATIVE_ROOT, 'bin', 'dslogic-core', 'python'),
              os.path.join(NATIVE_ROOT, 'python'),
              'D:/msys64/ucrt64', 'C:/msys64/ucrt64']
    for c in cands:
        if not c:
            continue
        if (os.path.isfile(os.path.join(c, 'python.exe')) or
                os.path.isfile(os.path.join(c, 'bin', 'python.exe')) or
                os.path.isdir(os.path.join(c, 'lib'))):   # 打包精简标准库 lib/python3.x
            return c
    return None


def native_env(exe):
    """内核子进程环境：解码器目录 + Python home + 运行时 DLL 搜索路径。"""
    env = dict(os.environ)
    env.setdefault('DSLCORE_DECODERS', NATIVE_DECODER_DIR)
    home = native_pyhome(exe)
    if home:
        env['DSLCORE_PYTHON_HOME'] = home
        env['PATH'] = os.pathsep.join(
            [os.path.dirname(os.path.abspath(exe)),
             home, os.path.join(home, 'bin'), env.get('PATH', '')])
    else:
        env['PATH'] = os.pathsep.join(
            [os.path.dirname(os.path.abspath(exe)), env.get('PATH', '')])
    return env


def call(method, params=None, exe=None, timeout=600):
    """一次性 NDJSON 调用；返回 data；失败抛 DslError。"""
    exe = exe or native_exe()
    if not exe:
        raise DslError('官方内核不可用：未找到 dslogic-core（执行 native/dslogic-core/build.ps1 构建）')
    req = {'id': 1, 'method': method, 'params': params or {}}
    try:
        p = subprocess.run([exe], input=json.dumps(req).encode('utf-8'),
                           capture_output=True, env=native_env(exe), timeout=timeout)
    except subprocess.TimeoutExpired:
        raise DslError('官方内核超时: %s' % method)
    except OSError as e:
        raise DslError('官方内核调用失败: %s' % e)
    resp = None
    for line in (p.stdout or b'').decode('utf-8', 'replace').splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            v = json.loads(line)
        except ValueError:
            continue
        if v.get('id') == 1:
            resp = v
    if resp is None:
        err = (p.stderr or b'').decode('utf-8', 'replace').strip()
        raise DslError('官方内核无响应 (rc=%s): %s' % (p.returncode, err[-300:] or '无输出'))
    if not resp.get('ok'):
        raise DslError(resp.get('error') or '官方内核返回错误')
    return resp.get('data')


def describe(dec_id, exe=None):
    """解码器元数据；不存在返回 None。"""
    try:
        return call('describe', {'id': dec_id}, exe=exe)
    except DslError:
        return None


def list_decoders(exe=None):
    return call('decoders', {}, exe=exe).get('decoders') or []


def open_capture(path):
    """生产=NativeCapture（官方内核）；DSL_ENGINE=shim=Python reader（仅测试）。"""
    if shim_engine():
        from dsl_reader import DslFile      # noqa: E402  仅测试路径
        return DslFile(path)
    return NativeCapture(path)


class NativeCapture:
    """DslFile 鸭子类型：info/edges 全部经官方内核子进程取得。"""

    def __init__(self, path, exe=None):
        if not os.path.isfile(path):
            raise DslError('文件不存在: %s' % path)
        self.path = path
        self.exe = exe or native_exe()
        if not self.exe:
            raise DslError('官方内核不可用：未找到 dslogic-core（执行 native/dslogic-core/build.ps1 构建）')
        d = call('info', {'file': path}, exe=self.exe)
        self.version = int(d.get('version') or 0)
        self.driver = d.get('driver') or ''
        self.samplerate = float(d.get('samplerate') or 0)
        self.total = int(d.get('total_samples') or 0)
        self.nblocks = int(d.get('blocks') or 1)
        self.trigger_time_ms = int(d.get('trigger_time_ms') or 0)
        self.trigger_time = d.get('trigger_time')
        self.trigger_pos = int(d.get('trigger_pos') or 0)
        self.session = d.get('session') if isinstance(d.get('session'), dict) else {}
        self.decoders = d.get('decoders') or []
        self.channels = d.get('channels') or []
        self.nprobes = len(self.channels)
        self._init = None
        self._edges = None

    def load_edges(self):
        """(init_list, edges_list[np.uint64]) — 与 dsl_reader.load_edges 契约一致。"""
        if self._edges is not None:
            return self._init, self._edges
        chans = list(range(self.nprobes))
        init = [0] * self.nprobes
        acc = [[] for _ in chans]
        off, chunk = 0, 1 << 24
        while True:
            d = call('edges', {'file': self.path, 'channels': chans,
                               'offset': off, 'chunk': chunk}, exe=self.exe)
            more = False
            for item in d.get('channels') or []:
                c = int(item['ch'])
                if not (0 <= c < self.nprobes):
                    continue
                init[c] = int(item.get('init') or 0)
                acc[c].extend(int(x) for x in item.get('edges') or [])
                if item.get('has_more'):
                    more = True
            if not more:
                break
            off += chunk
        self._init = init
        self._edges = [np.asarray(a, dtype=np.uint64) for a in acc]
        return self._init, self._edges

    def info(self, init=None, edges=None):
        """与 dsl_reader.DslFile.info 输出键完全一致。"""
        st = os.stat(self.path)
        rate = self.samplerate
        sess = self.session
        out = {
            'file': os.path.basename(self.path), 'size': st.st_size, 'version': self.version,
            'driver': self.driver, 'samplerate': rate, 'total_samples': self.total,
            'duration_s': self.total / rate if rate else None, 'blocks': self.nblocks,
            'trigger_time_ms': self.trigger_time_ms, 'trigger_pos': self.trigger_pos,
            'session': {k: sess.get(k) for k in ('Title', 'Operation Mode', 'Sample count', 'Sample rate',
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

    def close(self):
        pass
