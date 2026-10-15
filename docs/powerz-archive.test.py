# PD consistent snapshot regression with the official-style writer still open.
from contextlib import closing
import hashlib
import importlib.util
from pathlib import Path
import sqlite3
import sys
import tempfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services'))
import powerz_archive as helper

with tempfile.TemporaryDirectory(prefix='powerz-archive-test-') as folder:
    root = Path(folder)
    source = root / 'pd.sqlite'
    target = root / '261012123456.sqlite'
    writer = sqlite3.connect(source)
    try:
        writer.execute('PRAGMA journal_mode=WAL')
        writer.execute('CREATE TABLE pd_table(Time REAL,Vbus REAL,Ibus REAL,Raw BLOB)')
        writer.execute('CREATE TABLE pd_chart(Time REAL,VBUS REAL,IBUS REAL,CC1 REAL,CC2 REAL)')
        writer.commit()
        assert helper.archive(source, target)['status'] == 'empty'
        writer.execute('INSERT INTO pd_table VALUES(1,5,0.1,?)', (bytes.fromhex('458724000021'),))
        writer.commit()
        before = source.read_bytes()
        result = helper.archive(source, target)
        assert result['status'] == 'archived', result
        assert result['totalPackets'] == 1
        assert source.exists() and source.read_bytes() == before
        with closing(sqlite3.connect(target)) as con:
            assert con.execute('PRAGMA quick_check').fetchall() == [('ok',)]
            assert con.execute('SELECT hex(Raw) FROM pd_table').fetchall() == [('458724000021',)]
        assert helper.archive(source, target)['status'] == 'existing'
        # Reading an open WAL database preserves its committed state only.
        writer.execute('INSERT INTO pd_table VALUES(2,9,0.2,?)', (bytes.fromhex('87AD250000010101'),))
        unchanged = helper.archive(source, root / '261012123457.sqlite', target)
        assert unchanged['status'] == 'unchanged', unchanged
        assert not (root / '261012123457.sqlite').exists()
        writer.commit()
        second = root / '261012123458.sqlite'
        assert helper.archive(source, second, target)['status'] == 'archived'
        with closing(sqlite3.connect(second)) as con:
            assert con.execute('SELECT COUNT(*) FROM pd_table').fetchone()[0] == 2
        old_target = target.read_bytes()
        assert helper.archive(source, target)['status'] == 'conflict'
        assert target.read_bytes() == old_target
        assert not list(root.glob('.powerz-archive-*.tmp'))
    finally:
        writer.close()
    # A checkpoint changes source metadata but must not generate duplicate content.
    checkpoint_result = helper.archive(source, root / '261012123459.sqlite', second)
    assert checkpoint_result['status'] == 'unchanged', checkpoint_result
    assert source.exists()
print('PASS: open-writer WAL snapshot, committed data only, source retained, integrity, duplicate/checkpoint suppression, collision no-overwrite, temp cleanup')
