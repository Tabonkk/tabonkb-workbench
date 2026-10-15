# POWER-Z temperature regression: valid readings and missing-channel sentinels.
from contextlib import closing
import hashlib
import importlib.util
import math
from pathlib import Path
import sqlite3
import tempfile

spec = importlib.util.spec_from_file_location('powerz_db', Path(__file__).resolve().parents[1] / 'services' / 'powerz_db.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
for value in (None, float('inf'), float('-inf'), float('nan'), 1.7e308, -1.7e308):
    assert reader.valid_temperature(value) is None
assert reader.valid_temperature(0.0) == 0.0
assert reader.valid_temperature(-10.5) == -10.5
with tempfile.TemporaryDirectory(prefix='powerz-db-test-') as folder:
    file = Path(folder) / 'fixture.db'
    with closing(sqlite3.connect(file)) as con, con:
        con.execute('CREATE TABLE table_1(ElapsedTime TEXT, Unix REAL, VBUS REAL, IBUS REAL, DP REAL, DM REAL, CC1 REAL, CC2 REAL, TEMP REAL, CHARGE REAL, ENERGY REAL)')
        for idx, temperature in enumerate([1.7e308, None, -1.7e308, float('inf'), -10.5, 0.0, 35.25]):
            con.execute('INSERT INTO table_1 VALUES(?,?,?,?,?,?,?,?,?,?,?)', ('', idx, 9.0, 1.0, 0, 0, 0, 0, temperature, 0, 0))
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    with closing(reader.open_db(str(file))) as con:
        result = reader.read_metrics(con)
        assert result['totalSamples'] == 7
        assert result['metrics']['temperature'] == {'min': -10.5, 'max': 35.25, 'validSamples': 3, 'unit': 'C'}
        page = reader.mode_page(con, 0, 20)
        assert [row['temp'] for row in page['items']] == [None, None, None, None, -10.5, 0.0, 35.25]
        csv = reader.mode_csv(con)['csv'].splitlines()[1:]
        assert [line.split(',')[7] for line in csv] == ['', '', '', '', '-10.5', '0.0', '35.25']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest
    with closing(sqlite3.connect(file)) as con, con:
        con.execute('DELETE FROM table_1 WHERE ABS(TEMP)<1e300')
    with closing(reader.open_db(str(file))) as con:
        assert reader.read_metrics(con)['metrics']['temperature'] == {'min': None, 'max': None, 'validSamples': 0, 'unit': 'C'}
print('PASS: mixed valid/missing temperatures, non-finite values, page/CSV parity, all-missing summary, read-only bytes')

with tempfile.TemporaryDirectory(prefix='powerz-pd-test-') as folder:
    file = Path(folder) / 'pd.sqlite'
    with closing(sqlite3.connect(file)) as con, con:
        con.execute('CREATE TABLE pd_table(Time REAL,Vbus REAL,Ibus REAL,Raw BLOB)')
        con.execute('CREATE TABLE pd_chart(Time REAL,VBUS REAL,IBUS REAL,CC1 REAL,CC2 REAL)')
    with closing(reader.open_db(str(file))) as con:
        assert reader.database_kind(con) == 'pd'
        assert reader.pd_summary(con)['hasData'] is False
        assert reader.pd_summary(con)['totalPackets'] == 0
    raw1 = bytes.fromhex('458724000021')
    raw2 = bytes.fromhex('8BAC250000018F1001A800FF')
    with closing(sqlite3.connect(file)) as con, con:
        con.executemany('INSERT INTO pd_table VALUES(?,?,?,?)', [(2.0,5.0,0.1,raw2),(1.0,0.0,0.0,raw1)])
        con.execute('INSERT INTO pd_chart VALUES(1.0,5.0,0.1,0.0,0.0)')
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    with closing(reader.open_db(str(file))) as con:
        summary = reader.pd_summary(con)
        assert summary['totalPackets'] == 2
        assert summary['totalSamples'] == 1
        assert summary['rawBytes'] == 18
        assert summary['durationSeconds'] == 1.0
        assert summary['decoded'] is False
        page = reader.pd_page(con, 1, 1)
        assert page['total'] == 2
        assert page['items'][0]['rawHex'] == raw2.hex().upper()
        assert len(page['items']) == 1
        assert reader.pd_csv(con)['csv'].splitlines()[1].endswith(raw1.hex().upper())
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest
print('PASS: empty/populated PD SQLite, BLOB hex and time order, summary/page/CSV, unchanged database bytes')
