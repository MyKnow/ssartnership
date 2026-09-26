#!/usr/bin/env python3
"""PVE-only bounded transfer between the two lab guests, without guest secrets."""
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import subprocess
import sys
import time
from artifact import validate_artifact

ROOT = Path('/var/lib/build-lab-497')
BUILD = 'builder@10.77.49.10'
PREVIEW = 'builder@10.77.49.20'
SSH_OPTIONS = ['-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'UserKnownHostsFile=' + str(ROOT / 'known_hosts'), '-i', str(ROOT / 'transfer_key')]


def run(args, timeout=60):
    def limit_file_size():
        resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024**3, 2 * 1024**3))
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=timeout,
                          preexec_fn=limit_file_size if args[0] == 'scp' else None).stdout


def guest_result(sha):
    envelope = json.loads(run(['qm', 'guest', 'exec', '4970', '--timeout', '30', '--', '/usr/bin/python3', '/usr/local/lib/build-lab-497/guest_agent.py', 'result', sha]))
    if envelope.get('exitcode') != 0 or envelope.get('exited') != 1 or envelope.get('out-truncated'):
        raise RuntimeError('Artifact observation failed')
    value = json.loads(envelope['out-data'])
    if value.get('status') != 'ready':
        raise RuntimeError('Build artifact not ready')
    return validate_artifact(value['artifact'], sha)


def main():
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'myknow-pve':
        raise RuntimeError('Wrong host')
    if len(sys.argv) != 2 or not re.fullmatch(r'[a-f0-9]{40}', sys.argv[1]):
        raise ValueError('Invalid requested SHA')
    sha = sys.argv[1]
    os.umask(0o077)
    receipt = guest_result(sha)
    destination = ROOT / 'deliveries' / sha
    destination.mkdir(parents=True, exist_ok=False)
    archive = destination / 'app.tar'
    transfer_started = time.time()
    # Bandwidth is capped at 8 MiB/s and both endpoints are fixed lab addresses.
    run(['scp', '-l', '65536', *SSH_OPTIONS, BUILD + ':/home/builder/build-lab/requests/' + sha + '/app.tar', str(archive)], timeout=300)
    if archive.stat().st_size > 2 * 1024**3:
        raise ValueError('Artifact exceeds transfer budget')
    checksum = hashlib.sha256()
    with archive.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024**2), b''):
            checksum.update(chunk)
    if checksum.hexdigest() != receipt['archiveSha256']:
        raise ValueError('Transferred artifact mismatch')
    status = run(['qm', 'status', '4971']).strip()
    if status == 'status: stopped':
        run(['/usr/local/sbin/build-lab-497-network'])
        run(['qm', 'start', '4971'], timeout=90)
    elif status != 'status: running':
        raise RuntimeError('Unexpected Preview state')
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            run(['ssh', *SSH_OPTIONS, PREVIEW, 'true'], timeout=15)
            break
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            time.sleep(5)
    else:
        raise RuntimeError('Preview SSH unavailable')
    run(['ssh', *SSH_OPTIONS, PREVIEW, 'mkdir -p -m 700 /home/builder/build-lab-incoming'])
    run(['scp', '-l', '65536', *SSH_OPTIONS, str(archive), PREVIEW + ':/home/builder/build-lab-incoming/' + sha + '.tar'], timeout=300)
    run(['ssh', *SSH_OPTIONS, PREVIEW, 'sudo -n install -m 600 /home/builder/build-lab-incoming/' + sha + '.tar /srv/build-lab-497/incoming/' + sha + '.tar'])
    transfer_finished = time.time()
    output = run(['ssh', *SSH_OPTIONS, PREVIEW, 'sudo -n python3 /usr/local/lib/build-lab-497/preview_deploy.py ' + sha + ' ' + receipt['archiveSha256']], timeout=480)
    deployed = json.loads(output)
    if deployed.get('sha') != sha or deployed.get('environment') != 'synthetic-lab' or deployed.get('externalEgress') is not False:
        raise RuntimeError('Deployment receipt mismatch')
    result = {**receipt, 'deployed': True, 'transferStartedAt': transfer_started, 'transferFinishedAt': transfer_finished, 'preview': deployed}
    (destination / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"error":"LAB_ARTIFACT_TRANSFER_OR_DEPLOYMENT_FAILED"}', flush=True)
        raise SystemExit(1)
