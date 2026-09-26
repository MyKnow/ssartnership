#!/usr/bin/env python3
"""Host-driven VM allocation matrix. Run after exploratory guest jobs finish."""
import fcntl
import json
import os
from pathlib import Path
import subprocess
import time

VMID = '4970'
ROOT = Path('/var/lib/build-lab-497')


def run(args, timeout=60):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=timeout).stdout


def guest(args):
    data = json.loads(run(['qm', 'guest', 'exec', VMID, '--timeout', '30', '--', *args], timeout=40))
    if data.get('exited') != 1 or data.get('exitcode') != 0 or data.get('out-truncated'):
        raise RuntimeError('Guest execution failed')
    return data.get('out-data', '')


def wait_agent():
    until = time.monotonic() + 180
    while time.monotonic() < until:
        try:
            run(['qm', 'agent', VMID, 'ping'], timeout=15)
            return
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            time.sleep(5)
    raise RuntimeError('Guest agent unavailable')


def main():
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'myknow-pve':
        raise RuntimeError('Wrong host')
    os.umask(0o077)
    ROOT.mkdir(exist_ok=True)
    lock = (ROOT / 'resource-matrix.lock').open('w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    # Do not compete with live measurement, requests, or a previous matrix.
    status = run(['qm', 'status', VMID]).strip()
    if status == 'status: running':
        if json.loads(guest(['/usr/bin/python3', '/usr/local/lib/build-lab-497/guest_agent.py', 'status']))['busy']:
            raise RuntimeError('Existing guest work must finish first')
    elif status != 'status: stopped':
        raise RuntimeError('Unknown VM state')
    for cpus in (2, 4, 8):
        if run(['qm', 'status', VMID]).strip() == 'status: running':
            run(['qm', 'shutdown', VMID, '--timeout', '120'], timeout=130)
        if run(['qm', 'status', VMID]).strip() != 'status: stopped':
            raise RuntimeError('Shutdown not confirmed')
        run(['qm', 'set', VMID, '--cores', str(cpus), '--memory', '6144'])
        run(['/usr/local/sbin/build-lab-497-network'])
        boot = time.time()
        run(['qm', 'start', VMID], timeout=90)
        wait_agent()
        ready = time.time()
        guest_config = json.loads(run(['pvesh', 'get', '/nodes/myknow-pve/qemu/4970/config', '--output-format', 'json']))
        if int(guest(['nproc', '--all']).strip()) != cpus:
            raise RuntimeError('Guest CPU count mismatch')
        if guest_config['cores'] != cpus or int(guest_config['memory']) != 6144:
            raise RuntimeError('Resource allocation mismatch')
        for repetition in (1, 2, 3):
            for mode in ('cold', 'warm'):
                run_id = f'vm{cpus}c6g-{mode}-{repetition}'
                unit = 'build-lab-measure-' + run_id
                args = ['/usr/bin/python3', '/usr/local/lib/build-lab-497/benchmark.py', '--cpus', str(cpus), '--memory-mib', '5120', '--run-id', run_id]
                if mode == 'warm':
                    args += ['--warm-from', f'vm{cpus}c6g-cold-{repetition}']
                guest(['systemd-run', '--unit=' + unit, '--uid=builder', '--property=WorkingDirectory=/home/builder/build-lab', *args])
                print(json.dumps({'event': 'started', 'runId': run_id, 'at': time.time()}), flush=True)
                deadline = time.monotonic() + 2500
                while True:
                    state = guest(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).strip()
                    if state not in ('active', 'activating'):
                        break
                    if time.monotonic() > deadline:
                        raise RuntimeError('Observation deadline exceeded; inspect existing job')
                    time.sleep(15)
                result = json.loads(guest(['cat', '/home/builder/build-lab/runs/' + run_id + '/result.json']))
                if result.get('valid') is not True or result.get('runId') != run_id:
                    raise RuntimeError('Measurement failed; retained for diagnosis')
                result.update(vmCpus=cpus, vmMemoryMiB=6144, bootRequestedAt=boot, guestAgentReadyAt=ready)
                (ROOT / (run_id + '.json')).write_text(json.dumps(result, indent=2) + '\n')
                guest(['runuser', '-u', 'builder', '--', '/usr/bin/python3', '/home/builder/build-lab/phases.py', run_id])
                print(json.dumps({'event': 'completed', 'runId': run_id, 'seconds': result['seconds']}), flush=True)
            # Both runs are complete. Preserve evidence while bounding disk use.
            for finished in (f'vm{cpus}c6g-cold-{repetition}', f'vm{cpus}c6g-warm-{repetition}'):
                guest(['runuser', '-u', 'builder', '--', '/usr/bin/python3', '/usr/local/lib/build-lab-497/cleanup_run.py', finished])
    print('{"event":"vm-cpu-matrix-complete"}', flush=True)


if __name__ == '__main__':
    main()
