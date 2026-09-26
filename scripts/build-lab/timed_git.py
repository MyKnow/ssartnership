#!/usr/bin/env python3
"""Opt-in PATH shim for canonical lab releases; records actual push, not prepush."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

GIT = '/usr/bin/git'
BRANCH = 'ci/497-pve-build-lab'
REMOTE = 'https://github.com/MyKnow/ssartnership.git'


def validate_push(args, branch, remote):
    if args != ['push', '--no-verify', 'origin', BRANCH] or branch != BRANCH or remote != REMOTE:
        raise ValueError('Only the canonical isolated lab release push is accepted')


def capture(*args):
    return subprocess.check_output([GIT, *args], text=True).strip()


def main():
    args = sys.argv[1:]
    if not args or args[0] != 'push':
        os.execv(GIT, [GIT, *args])
    validate_push(args, capture('branch', '--show-current'), capture('remote', 'get-url', '--push', 'origin'))
    sha = capture('rev-parse', 'HEAD')
    if not re.fullmatch('[a-f0-9]{40}', sha):
        raise ValueError('Invalid commit identity')
    root = Path(capture('rev-parse', '--show-toplevel'))
    folder = root / '.tmp/build-lab/push-events'
    folder.mkdir(parents=True, mode=0o700, exist_ok=True)
    # Exclusive evidence preserves failed first attempts instead of overwriting them.
    with (folder / (sha + '.json')).open('x') as handle:
        os.chmod(handle.fileno(), 0o600)
        record = {'sha': sha, 'branch': BRANCH, 'pushStartedAt': time.time()}
        json.dump(record, handle)
        handle.flush()
        started = time.monotonic()
        result = subprocess.run([GIT, *args])
        record.update(pushFinishedAt=time.time(), pushSeconds=time.monotonic() - started,
                      exitCode=result.returncode)
        handle.seek(0)
        json.dump(record, handle)
        handle.truncate()
    return result.returncode


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print('LAB_PUSH_TIMING_FAILED', file=sys.stderr)
        raise SystemExit(1)
