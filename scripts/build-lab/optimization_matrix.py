#!/usr/bin/env python3
"""Same-SHA cache off/on comparison on an explicitly selected VM allocation."""
import argparse
import fcntl
import json
import os
import re
import time
from resource_matrix import ROOT, VMID, guest, run


def comparison_plan(sha):
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid comparison SHA')
    cases = []
    for repetition in (1, 2, 3):
        for variant in ('off', 'on'):
            prefix = f'opt-{sha[:12]}-{variant}'
            for mode in ('cold', 'warm'):
                cases.append((f'{prefix}-{mode}-{repetition}',
                              f'{prefix}-cold-{repetition}' if mode == 'warm' else None,
                              variant == 'on'))
    return cases


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('sha')
    parser.add_argument('--cpus', type=int, choices=(2, 4, 8), required=True)
    parser.add_argument('--vm-memory-mib', type=int, choices=(6144, 8192), required=True)
    parser.add_argument('--container-memory-mib', type=int, choices=(5120, 6144), required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}', args.sha) or args.container_memory_mib >= args.vm_memory_mib:
        raise ValueError('Invalid experiment parameters')
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'myknow-pve':
        raise RuntimeError('Wrong host')
    os.umask(0o077)
    with (ROOT / 'resource-matrix.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if run(['qm', 'status', VMID]).strip() != 'status: running':
            raise RuntimeError('Select and boot the measured VM allocation first')
        config = json.loads(run(['pvesh', 'get', '/nodes/myknow-pve/qemu/4970/config', '--output-format', 'json']))
        if config['cores'] != args.cpus or int(config['memory']) != args.vm_memory_mib:
            raise RuntimeError('VM resources differ from requested comparison')
        if int(guest(['nproc', '--all']).strip()) != args.cpus:
            raise RuntimeError('Guest CPU count mismatch')
        if json.loads(guest(['/usr/bin/python3', '/usr/local/lib/build-lab-497/guest_agent.py', 'status']))['busy']:
            raise RuntimeError('Guest already has work')
        plan = comparison_plan(args.sha)
        if any((ROOT / (name + '.json')).exists() for name, _, _ in plan):
            raise RuntimeError('Existing measurements require explicit resume review')
        guest(['/usr/bin/python3', '-c',
               'from pathlib import Path; import sys; '
               'assert not any((Path("/home/builder/build-lab/runs") / name).exists() for name in sys.argv[1:]), "Existing comparison work"',
               *[name for name, _, _ in plan]])
        # Alternate off/on pairs to reduce long-run drift; never rerun a failed case.
        for name, warm_from, enabled in plan:
            unit = 'build-lab-measure-' + name
            command = ['/usr/bin/python3', '/usr/local/lib/build-lab-497/candidate.py', 'measure', args.sha,
                       '--cpus', str(args.cpus), '--memory-mib', str(args.container_memory_mib), '--run-id', name]
            if enabled:
                command += ['--stable-lab-cache']
            if warm_from:
                command += ['--warm-from', warm_from]
            guest(['systemd-run', '--unit=' + unit, '--uid=builder', '--property=WorkingDirectory=/home/builder/build-lab', *command])
            print(json.dumps({'event': 'started', 'runId': name, 'at': time.time()}), flush=True)
            deadline = time.monotonic() + 2500
            while guest(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).strip() in ('active', 'activating'):
                if time.monotonic() > deadline:
                    raise RuntimeError('Observation expired; inspect existing job before further action')
                time.sleep(15)
            result = json.loads(guest(['cat', '/home/builder/build-lab/runs/' + name + '/result.json']))
            if (result.get('valid') is not True or result.get('sha') != args.sha
                    or result.get('runId') != name or result.get('stableLabCache') != enabled):
                raise RuntimeError('Invalid comparison result; retained without retry')
            result.update(vmCpus=args.cpus, vmMemoryMiB=args.vm_memory_mib, matrixProfile='optimization')
            with (ROOT / (name + '.json')).open('x') as handle:
                json.dump(result, handle, indent=2)
            guest(['runuser', '-u', 'builder', '--', '/usr/bin/python3', '/home/builder/build-lab/phases.py', name])
            print(json.dumps({'event': 'completed', 'runId': name, 'seconds': result['seconds']}), flush=True)
            if warm_from:
                for finished in (warm_from, name):
                    guest(['runuser', '-u', 'builder', '--', '/usr/bin/python3', '/usr/local/lib/build-lab-497/cleanup_run.py', finished])
    print('{"event":"optimization-matrix-complete"}', flush=True)


if __name__ == '__main__':
    main()
