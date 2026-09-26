#!/usr/bin/env python3
"""Isolated VM gate benchmark; never publishes an image or deployment manifest."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time

ARCHIVE_NAME = 'baseline.tar'
GATE_IMAGE = 'ssartnership-lab-gate:baseline'
SITE_ORIGIN = 'https://build-lab.invalid'
API_ORIGIN = 'https://api.build-lab.invalid'

BASE_SHA = '308281074ed752b6cccce693d27755da13dd675f'
BASE_ARCHIVE_HASH = '27846014a638fc7305200918867ded81f3421601c14eefcdc0981ca546e65af9'

def validate_gate(gate):
    if not isinstance(gate.get('tests'), int) or gate['tests'] != 83:
        raise ValueError('Unexpected E2E inventory')
    if any(gate.get(k) != 0 for k in ('failures', 'errors', 'skipped', 'retries')):
        raise ValueError('Non-clean gate')
    if gate.get('e2eRuntime') != 'production-test-only' or gate.get('fixtureBuildDeployable') is not False:
        raise ValueError('Fixture boundary invalid')
    return {k: gate[k] for k in ('tests', 'failures', 'errors', 'skipped', 'retries', 'e2eRuntime', 'fixtureBuildDeployable')}

def cache_sources(root, run_id):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,60}', run_id):
        raise ValueError('Invalid warm source')
    result = json.loads((root / 'runs' / run_id / 'result.json').read_text())
    if result.get('valid') is not True or result.get('sha') != BASE_SHA:
        raise ValueError('Warm source must be a valid same-SHA run')
    work = root / 'runs' / run_id / 'work'
    if not all((work / item).is_dir() for item in ('.tmp/install-state/cache', '.next/cache', '.next-e2e/cache')):
        raise ValueError('Warm cache source is unavailable')
    return work


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--cpus', type=int, choices=[2, 4, 8], required=True)
    p.add_argument('--memory-mib', type=int, choices=[4096, 5120, 6144], required=True)
    p.add_argument('--run-id', required=True)
    p.add_argument('--warm-from')
    args = p.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,60}', args.run_id):
        p.error('invalid run id')
    root = Path.home() / 'build-lab'
    archive = root / ARCHIVE_NAME
    if hashlib.sha256(archive.read_bytes()).hexdigest() != BASE_ARCHIVE_HASH:
        raise ValueError('Baseline archive changed')
    target = root / 'runs' / args.run_id
    target.mkdir(parents=True, exist_ok=False)
    work = target / 'work'
    work.mkdir()
    subprocess.run(['tar', '-xf', str(archive), '-C', str(work)], check=True)
    cache_started = time.monotonic()
    if args.warm_from:
        previous = cache_sources(root, args.warm_from)
        for relative in ('.tmp/install-state/cache', '.next/cache', '.next-e2e/cache'):
            source = previous / relative
            if source.is_dir():
                shutil.copytree(source, work / relative)
    cache_prepare_seconds = round(time.monotonic() - cache_started, 3)
    name = 'ssartnership-lab-' + args.run_id
    command = ['sudo', '-n', 'docker', 'run', '--name', name, '--init', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', f'{os.getuid()}:{os.getgid()}', '--pids-limit', '1024', '--memory', f'{args.memory_mib}m', '--memory-swap', f'{args.memory_mib}m', '--cpus', str(args.cpus), '--tmpfs', '/tmp:mode=1777,size=512m', '--shm-size', '256m', '--env', 'CI_EXECUTION_PROFILE=github-amd64', '--env', 'CI_BUILD_SITE_ORIGIN=' + SITE_ORIGIN, '--env', 'CI_BUILD_SUPABASE_ORIGIN=' + API_ORIGIN, '--env', 'CI_BUILD_VAPID_PUBLIC_KEY=', '--mount', f'type=bind,src={work},dst=/work', GATE_IMAGE]
    evidence = {'sha': BASE_SHA, 'archiveSha256': BASE_ARCHIVE_HASH, 'runId': args.run_id, 'cpus': args.cpus, 'memoryMiB': args.memory_mib, 'cache': 'fresh-workspace-no-npm-or-next-cache; gate-image-prebuilt; host-page-cache-uncontrolled', 'startedAt': time.time(), 'peakContainerMemoryBytes': 0, 'peakGuestUsedMemoryBytes': 0}
    evidence.update(cacheMode='warm' if args.warm_from else 'cold', warmFrom=args.warm_from, cachePrepareSeconds=cache_prepare_seconds, protocolVersion=2)
    if args.warm_from:
        evidence['cache'] = 'same-SHA npm and both Next caches copied; new node_modules and outputs; gate-image-prebuilt; host-page-cache-uncontrolled'
    stop = threading.Event()
    def sample():
        while not stop.wait(1):
            try:
                fields = {line.split(':')[0]: int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines()}
                evidence['peakGuestUsedMemoryBytes'] = max(evidence['peakGuestUsedMemoryBytes'], fields['MemTotal'] - fields['MemAvailable'])
                r = subprocess.run(['sudo', '-n', 'docker', 'inspect', '--format', '{{.State.Pid}}', name], capture_output=True, text=True, timeout=3)
                pid = int(r.stdout.strip())
                if pid > 0:
                    cg = Path(f'/proc/{pid}/cgroup').read_text().strip().split('::', 1)[1]
                    usage = int((Path('/sys/fs/cgroup') / cg.lstrip('/') / 'memory.peak').read_text())
                    evidence['peakContainerMemoryBytes'] = max(evidence['peakContainerMemoryBytes'], usage)
            except (OSError, ValueError, IndexError, subprocess.TimeoutExpired):
                pass
    worker = threading.Thread(target=sample, daemon=True)
    worker.start()
    started = time.monotonic()
    try:
        with (target / 'gate.log').open('w') as log:
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
            try:
                code = process.wait(timeout=2400)
            except subprocess.TimeoutExpired:
                subprocess.run(['sudo', '-n', 'docker', 'stop', '--time', '10', name], capture_output=True, timeout=30)
                process.wait(timeout=30)
                code = 124
        evidence['exitCode'] = code
        state = subprocess.run(['sudo', '-n', 'docker', 'inspect', '--format', '{{json .State}}', name], capture_output=True, text=True, check=True)
        state = json.loads(state.stdout)
        evidence['oomKilled'] = state['OOMKilled']
        if code == 0 and not state['OOMKilled']:
            evidence['gate'] = validate_gate(json.loads((work / '.self-host-build/gate.json').read_text()))
            evidence['valid'] = True
        else:
            evidence['valid'] = False
    finally:
        stop.set()
        worker.join(timeout=5)
        evidence['seconds'] = round(time.monotonic() - started, 3)
        evidence['finishedAt'] = time.time()
        (target / 'result.json').write_text(json.dumps(evidence, indent=2) + '\n')
        print(json.dumps(evidence), flush=True)
    if not evidence.get('valid'):
        raise SystemExit(1)

if __name__ == '__main__':
    main()
