#!/usr/bin/env python3
"""Fixed lab guest operations invoked only through the PVE guest agent."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from artifact import validate_artifact


def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=20).stdout


def busy():
    units = run(['systemctl', 'list-units', '--all', '--plain', '--no-legend', 'build-lab-*.service'])
    for line in units.splitlines():
        fields = line.split()
        if len(fields) < 4 or not fields[0].startswith('build-lab-'):
            raise RuntimeError('Unknown unit observation')
        if fields[2] in ('active', 'activating', 'deactivating'):
            return True
    return bool(run(['docker', 'ps', '--filter', 'name=ssartnership-lab-', '--format', '{{.Names}}']).strip())


def main():
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'ssartnership-build-lab':
        raise RuntimeError('Wrong guest')
    args = sys.argv[1:]
    if args == ['status']:
        return {'busy': busy()}
    if len(args) == 2 and args[0] == 'result' and re.fullmatch(r'[a-f0-9]{40}', args[1]):
        sha = args[1]
        receipt = Path('/home/builder/build-lab/requests') / sha / 'artifact.json'
        if not receipt.exists():
            return {'status': 'pending' if busy() else 'failed', 'sha': sha}
        if receipt.is_symlink() or receipt.stat().st_size > 8192:
            raise ValueError('Invalid artifact receipt')
        return {'status': 'ready', 'artifact': validate_artifact(json.loads(receipt.read_text()), sha)}
    if len(args) != 2 or args[0] != 'launch' or not re.fullmatch(r'[a-f0-9]{40}', args[1]):
        raise ValueError('Unsupported request')
    sha = args[1]
    with open('/run/build-lab-launch.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if busy():
            raise RuntimeError('Guest is busy')
        worker = Path('/usr/local/lib/build-lab-497/request_build.py')
        if not worker.is_file() or worker.stat().st_uid != 0 or worker.stat().st_mode & 0o022:
            raise RuntimeError('Untrusted worker file')
        run(['systemd-run', '--unit=build-lab-request-' + sha, '--uid=builder', '--property=WorkingDirectory=/home/builder/build-lab', '/usr/bin/python3', str(worker), sha])
        return {'acceptedSha': sha}


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Exception:
        print('{"error":"LAB_GUEST_OBSERVATION_OR_ACTION_FAILED"}')
        raise SystemExit(1)
