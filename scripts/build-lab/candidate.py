#!/usr/bin/env python3
"""Prepare an exact public lab revision, or measure its immutable gate image."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import benchmark

REPOSITORY = 'https://github.com/MyKnow/ssartnership.git'
REF = 'refs/heads/ci/497-pve-build-lab'


def validate_candidate(record, sha):
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or record.get('sha') != sha:
        raise ValueError('Candidate SHA mismatch')
    if not isinstance(record.get('archiveSha256'), str) or not re.fullmatch(r'[a-f0-9]{64}', record['archiveSha256']):
        raise ValueError('Candidate archive hash invalid')
    if not isinstance(record.get('gateImageId'), str) or not re.fullmatch(r'sha256:[a-f0-9]{64}', record['gateImageId']):
        raise ValueError('Candidate gate image must be immutable')
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('prepare', 'measure'))
    parser.add_argument('sha')
    parser.add_argument('--cpus', type=int, choices=(2, 4, 8))
    parser.add_argument('--memory-mib', type=int, choices=(4096, 5120, 6144))
    parser.add_argument('--run-id')
    parser.add_argument('--warm-from')
    parser.add_argument('--stable-lab-cache', action='store_true')
    args = parser.parse_args()
    if os.getuid() == 0 or not re.fullmatch(r'[a-f0-9]{40}', args.sha):
        raise ValueError('Invalid candidate invocation')
    if subprocess.check_output(['hostname', '-s'], text=True).strip() != 'ssartnership-build-lab':
        raise RuntimeError('Wrong guest')
    root = Path.home() / 'build-lab'
    folder = root / 'candidates' / args.sha
    archive = folder / 'source.tar'
    receipt = folder / 'candidate.json'
    if args.action == 'prepare':
        folder.mkdir(parents=True, exist_ok=False)
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(Path.home()), 'GIT_CONFIG_NOSYSTEM': '1',
               'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0'}
        def run(command, cwd=folder, timeout=1200):
            return subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True,
                                  check=True, timeout=timeout).stdout
        repo = folder / 'repo'
        run(['git', 'init', '--quiet', str(repo)])
        run(['git', '-c', 'core.hooksPath=/dev/null', 'fetch', '--depth=1', REPOSITORY, REF], cwd=repo)
        if run(['git', 'rev-parse', 'FETCH_HEAD'], cwd=repo).strip() != args.sha:
            raise ValueError('Lab branch changed before candidate preparation')
        run(['git', 'archive', '--format=tar', '--output', str(archive), args.sha], cwd=repo)
        source = folder / 'source'
        source.mkdir()
        run(['tar', '-xf', str(archive), '-C', str(source)])
        tag = 'ssartnership-lab-gate:' + args.sha
        run(['sudo', '-n', 'env', 'DOCKER_BUILDKIT=1', 'docker', 'build', '--platform', 'linux/amd64',
             '--tag', tag, str(source / 'deploy/self-host-ci')])
        image = run(['sudo', '-n', 'docker', 'image', 'inspect', '--format', '{{.Id}}', tag]).strip()
        record = validate_candidate({'sha': args.sha, 'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                                     'gateImageId': image}, args.sha)
        receipt.write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps(record), flush=True)
        return
    if args.cpus is None or args.memory_mib is None or args.run_id is None:
        raise ValueError('Measurement requires fixed resources and run id')
    record = validate_candidate(json.loads(receipt.read_text()), args.sha)
    benchmark.BASE_SHA = args.sha
    benchmark.BASE_ARCHIVE_HASH = record['archiveSha256']
    benchmark.ARCHIVE_NAME = str(archive.relative_to(root))
    benchmark.GATE_IMAGE = record['gateImageId']
    sys.argv = ['benchmark.py', '--cpus', str(args.cpus), '--memory-mib', str(args.memory_mib), '--run-id', args.run_id]
    if args.warm_from:
        sys.argv += ['--warm-from', args.warm_from]
    if args.stable_lab_cache:
        sys.argv += ['--stable-lab-cache']
    benchmark.main()


if __name__ == '__main__':
    main()
