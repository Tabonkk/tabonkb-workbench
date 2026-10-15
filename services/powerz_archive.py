# -*- coding: utf-8 -*-
"""Publish a consistent read-only SQLite snapshot of an official PD or ADC recording.
The source stays at its official path. Never overwrite an existing archive.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import time
from powerz_db import database_kind, pd_summary


def signature(source):
    values = []
    for suffix in ('', '-wal', '-journal'):
        p = Path(str(source) + suffix)
        try:
            s = p.stat()
            # A read-only WAL connection may create an empty WAL; it is not a save.
            values.append((suffix, None) if suffix == '-wal' and s.st_size == 0 else (suffix, s.st_size, s.st_mtime_ns, s.st_ctime_ns))
        except FileNotFoundError:
            values.append((suffix, None))
    return values


def sha256(file):
    with open(file, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def content_sha256(file):
    # SQLite backup/checkpoint may change headers without changing any table data.
    digest = hashlib.sha256()
    with closing(sqlite3.connect(Path(file).resolve().as_uri() + '?mode=ro', uri=True, timeout=2)) as con:
        for line in con.iterdump():
            digest.update(line.encode('utf-8'))
            digest.update(b'\n')
    return digest.hexdigest()


def curve_progress(source):
    try:
        with closing(sqlite3.connect(Path(source).resolve().as_uri() + '?mode=ro', uri=True, timeout=2)) as con:
            if database_kind(con) != 'adc':
                return {'ok': False, 'error': 'Not an official curve recording'}
            count, last = con.execute('SELECT COUNT(*),MAX(Unix) FROM table_1').fetchone()
            return {'ok': True, 'totalSamples': count, 'lastSampleTime': last}
    except (sqlite3.Error, OSError, ValueError) as error:
        return {'ok': False, 'error': str(error)}


def archive(source, destination, previous=None, stage_path=None, kind='pd'):
    source = Path(source).resolve()
    destination = Path(destination).resolve()
    if source == destination or source.parent != destination.parent:
        return {'ok': False, 'status': 'error', 'error': 'Archive must be a separate file in the capture directory'}
    stage = None
    try:
        before = signature(source)
        if not source.is_file():
            return {'ok': False, 'status': 'retry', 'error': 'Source is not ready'}
        if Path(str(source) + '-journal').exists():
            return {'ok': False, 'status': 'retry', 'error': 'SQLite save transaction in progress'}
        if stage_path:
            stage_file = Path(stage_path).resolve()
            if stage_file.parent != source.parent or not stage_file.name.startswith('.powerz-archive-') or stage_file.suffix != '.tmp':
                return {'ok': False, 'status': 'error', 'error': 'Invalid snapshot staging path'}
            fd = os.open(stage_file, os.O_CREAT | os.O_EXCL | os.O_RDWR)
            stage = str(stage_file)
        else:
            fd, stage = tempfile.mkstemp(prefix='.powerz-archive-', suffix='.tmp', dir=str(source.parent))
        os.close(fd)
        deadline = time.monotonic() + (45 if kind == 'adc' else 8)
        def progress(status, remaining, total):
            if time.monotonic() > deadline:
                raise TimeoutError('SQLite snapshot is busy; retry after save')
        # SQLite handles open connections and committed WAL pages. No source writes.
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=2)) as con:
            con.execute('BEGIN')
            if database_kind(con) != kind:
                return {'ok': False, 'status': 'error', 'error': 'Unexpected official recording schema'}
            summary = pd_summary(con) if kind == 'pd' else {
                'totalSamples': con.execute('SELECT COUNT(*) FROM table_1').fetchone()[0]}
            if not summary.get('totalPackets' if kind == 'pd' else 'totalSamples'):
                return {'ok': False, 'status': 'empty', 'error': 'No recording data'}
            with closing(sqlite3.connect(stage)) as target:
                con.backup(target, pages=256, progress=progress, sleep=0.05)
                target.execute('PRAGMA journal_mode=DELETE')
                if target.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
                    raise ValueError('Snapshot integrity check failed')
        if before != signature(source):
            return {'ok': False, 'status': 'retry', 'error': 'Source changed during snapshot'}
        digest = sha256(stage)
        content_digest = content_sha256(stage)
        if previous and Path(previous).is_file() and content_sha256(previous) == content_digest:
            return {'ok': True, 'status': 'unchanged', 'file': Path(previous).name, 'sha256': digest, 'totalPackets': summary.get('totalPackets', 0), 'totalSamples': summary['totalSamples']}
        if destination.exists():
            if content_sha256(destination) == content_digest:
                return {'ok': True, 'status': 'existing', 'file': destination.name, 'sha256': digest, 'totalPackets': summary.get('totalPackets', 0), 'totalSamples': summary['totalSamples']}
            return {'ok': False, 'status': 'conflict', 'error': 'Timestamp archive already exists; no overwrite', 'file': destination.name}
        # Atomic, no-overwrite publication. A concurrent destination also rejects.
        try:
            os.link(stage, destination)
        except FileExistsError:
            if content_sha256(destination) == content_digest:
                return {'ok': True, 'status': 'existing', 'file': destination.name, 'sha256': digest, 'totalPackets': summary.get('totalPackets', 0), 'totalSamples': summary['totalSamples']}
            return {'ok': False, 'status': 'conflict', 'error': 'Timestamp archive already exists; no overwrite', 'file': destination.name}
        return {'ok': True, 'status': 'archived', 'file': destination.name, 'sha256': digest, 'totalPackets': summary.get('totalPackets', 0), 'totalSamples': summary['totalSamples']}
    except BlockingIOError as error:
        return {'ok': False, 'status': 'recording', 'error': str(error)}
    except (sqlite3.Error, OSError, TimeoutError, ValueError) as error:
        return {'ok': False, 'status': 'retry', 'error': str(error)}
    finally:
        if stage and os.path.exists(stage):
            os.unlink(stage)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('destination', nargs='?')
    parser.add_argument('--previous')
    parser.add_argument('--stage')
    parser.add_argument('--progress', action='store_true')
    parser.add_argument('--kind', choices=['pd', 'adc'], default='pd')
    args = parser.parse_args()
    if args.progress:
        result = curve_progress(args.source)
    elif args.destination:
        result = archive(args.source, args.destination, args.previous, args.stage, args.kind)
    else:
        parser.error('destination is required for a snapshot')
    print(json.dumps(result, ensure_ascii=True))


if __name__ == '__main__':
    main()
