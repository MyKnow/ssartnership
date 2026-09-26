#!/usr/bin/env python3
"""Six non-publishing GitHub measurements of the same original source SHA."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import benchmark


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('GITHUB_REF') != 'refs/heads/ci/497-pve-build-lab':
        raise RuntimeError('GitHub lab branch only')
    root = Path.home() / 'build-lab'
    root.mkdir(exist_ok=False)
    archive = root / 'baseline.tar'
    subprocess.run(['git', 'archive', '--format=tar', '--output', str(archive), benchmark.BASE_SHA], check=True)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != benchmark.BASE_ARCHIVE_HASH:
        raise ValueError('Baseline archive identity mismatch')
    source = root / 'source'
    source.mkdir()
    subprocess.run(['tar', '-xf', str(archive), '-C', str(source)], check=True)
    subprocess.run(['sudo', '-n', 'env', 'DOCKER_BUILDKIT=1', 'docker', 'build', '--platform', 'linux/amd64',
                    '--tag', benchmark.GATE_IMAGE, str(source / 'deploy/self-host-ci')], check=True)
    for repetition in (1, 2, 3):
        for mode in ('cold', 'warm'):
            name = f'gh2c5g-{mode}-{repetition}'
            sys.argv = ['benchmark.py', '--cpus', '2', '--memory-mib', '5120', '--run-id', name]
            if mode == 'warm':
                sys.argv += ['--warm-from', f'gh2c5g-cold-{repetition}']
            try:
                benchmark.main()
            finally:
                folder = root / 'runs' / name
                evidence = folder / 'evidence'
                evidence.mkdir(parents=True, exist_ok=True)
                for file in ('result.json', 'gate.log'):
                    if (folder / file).is_file():
                        shutil.copy2(folder / file, evidence / file)
                gate = folder / 'work/.self-host-build/gate.json'
                if gate.is_file():
                    shutil.copy2(gate, evidence / 'gate.json')
            subprocess.run([sys.executable, str(Path(__file__).with_name('phases.py')), name], check=True)
            shutil.copy2(folder / 'phases.json', evidence / 'phases.json')
            (evidence / 'runner.json').write_text(json.dumps({
                'environment': 'github-hosted-ubuntu-24.04', 'hostCpus': os.cpu_count(),
                'containerCpus': 2, 'containerMemoryMiB': 5120,
                'guestMemoryMetricScope': 'entire-host-not-comparable-to-dedicated-vm',
            }, indent=2) + '\n')
        # Fresh pair for the next repetition; retain all measurement evidence.
        for mode in ('cold', 'warm'):
            folder = root / 'runs' / f'gh2c5g-{mode}-{repetition}'
            result = json.loads((folder / 'result.json').read_text())
            if result.get('valid') is not True:
                raise ValueError('Cannot release failed measurement work')
            shutil.rmtree(folder / 'work')


if __name__ == '__main__':
    main()
