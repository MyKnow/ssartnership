#!/usr/bin/env python3
"""Deploy a host-delivered artifact only inside the synthetic Preview VM."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
from loopback_proxy import configure_proxy

ROOT = Path('/srv/build-lab-497')
SECRETS = '/etc/myknow/secrets/ssartnership-lab-497'


def validate_request(sha, digest):
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or not re.fullmatch(r'[a-f0-9]{64}', digest):
        raise ValueError('Invalid artifact identity')
    return 'ssartnership-lab-app:' + sha


def validate_image(image, sha):
    labels = image.get('Config', {}).get('Labels') or {}
    if labels.get('org.opencontainers.image.revision') != sha:
        raise ValueError('Image revision mismatch')


def validate_networks(networks):
    if not networks or any(network.get('Internal') is not True for network in networks):
        raise ValueError('Runtime egress isolation is required')


def run(args, *, timeout=60, env=None):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=timeout, env=env).stdout


def main():
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'ssartnership-preview-lab':
        raise RuntimeError('Wrong guest')
    if len(sys.argv) != 3:
        raise ValueError('Expected commit and archive hash')
    sha, digest = sys.argv[1:]
    tag = validate_request(sha, digest)
    os.umask(0o077)
    with open('/run/build-lab-preview-deploy.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        archive = ROOT / 'incoming' / (sha + '.tar')
        if archive.is_symlink() or not archive.is_file() or archive.stat().st_size > 2 * 1024**3:
            raise ValueError('Invalid archive file')
        checksum = hashlib.sha256()
        with archive.open('rb') as handle:
            for chunk in iter(lambda: handle.read(1024**2), b''):
                checksum.update(chunk)
        if checksum.hexdigest() != digest:
            raise ValueError('Archive checksum mismatch')
        started = time.time()
        run(['docker', 'load', '--input', str(archive)], timeout=300)
        image = json.loads(run(['docker', 'image', 'inspect', tag]))[0]
        validate_image(image, sha)
        image_id = image['Id']
        env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'SELF_HOST_IMAGE': tag, 'SELF_HOST_RUNTIME_ENV_FILE': SECRETS + '/app.env', 'SELF_HOST_APP_PORT': '3100'}
        compose = ['docker', 'compose', '--project-name', 'ssartnership-lab-497', '--env-file', SECRETS + '/data.env', '-f', str(ROOT / 'source/compose.supabase.yaml'), '-f', str(ROOT / 'source/compose.yaml'), '-f', str(ROOT / 'compose.preview.yaml')]
        compose += ['-f', str(ROOT / 'compose.app.yaml')]
        config = json.loads(run([*compose, 'config', '--format', 'json'], env=env))
        if any(network.get('internal') is not True for network in config['networks'].values()):
            raise ValueError('Compose isolation mismatch')
        if set(config['services']) != {'db', 'rest', 'storage', 'gateway', 'app'}:
            raise ValueError('Unexpected service contract')
        # Inspect already-provisioned networks before introducing app code.
        # A Compose declaration alone cannot prove an existing network is offline.
        network_names = [network['name'] for network in config['networks'].values()]
        validate_networks(json.loads(run(['docker', 'network', 'inspect', *network_names])))
        # The database is provisioned separately; deployment cannot run migrations.
        run([*compose, 'up', '-d', '--no-deps', '--pull', 'never', 'app'], env=env, timeout=120)
        container = run([*compose, 'ps', '-q', 'app'], env=env).strip()
        inspection = json.loads(run(['docker', 'inspect', container]))[0]
        if inspection['Image'] != image_id:
            raise ValueError('Running image mismatch')
        network_ids = list(inspection['NetworkSettings']['Networks'])
        validate_networks(json.loads(run(['docker', 'network', 'inspect', *network_ids])))
        configure_proxy('app', inspection)
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen('http://127.0.0.1:3100/api/health', timeout=3) as response:
                    if response.status == 200:
                        break
            except (OSError, TimeoutError):
                pass
            time.sleep(2)
        else:
            raise RuntimeError('Preview readiness deadline exceeded')
        result = {'sha': sha, 'imageId': image_id, 'archiveSha256': digest, 'deployStartedAt': started, 'readyAt': time.time(), 'externalEgress': False, 'environment': 'synthetic-lab'}
        receipts = ROOT / 'receipts'
        receipts.mkdir(mode=0o700, exist_ok=True)
        (receipts / (sha + '.json')).write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Compose/docker output may contain the synthetic runtime environment.
        print('{"error":"LAB_PREVIEW_DEPLOYMENT_FAILED"}', flush=True)
        raise SystemExit(1)
