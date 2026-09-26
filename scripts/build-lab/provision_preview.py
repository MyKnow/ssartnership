#!/usr/bin/env python3
"""One-time, operator-run initialization of the empty synthetic lab database."""
import json
import os
from pathlib import Path
import subprocess
import time
from preview_deploy import validate_networks
from loopback_proxy import configure_proxy

ROOT = Path('/srv/build-lab-497')
DATA = '/etc/myknow/secrets/ssartnership-lab-497/data.env'
PROJECT = 'ssartnership-lab-497'


def run(args, timeout=60):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=timeout,
                          env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root'}).stdout


def main():
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'ssartnership-preview-lab':
        raise RuntimeError('Wrong guest')
    os.umask(0o077)
    if run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + PROJECT]).strip():
        raise RuntimeError('Existing stack requires inspection rather than initialization')
    compose = ['docker', 'compose', '--project-name', PROJECT, '--env-file', DATA,
               '-f', str(ROOT / 'source/compose.supabase.yaml'), '-f', str(ROOT / 'compose.preview.yaml')]
    config = json.loads(run([*compose, 'config', '--format', 'json']))
    if config.get('name') != PROJECT or set(config['services']) != {'db', 'rest', 'storage', 'gateway'}:
        raise ValueError('Unexpected database project')
    if any(network.get('internal') is not True for network in config['networks'].values()):
        raise ValueError('External runtime network forbidden')
    # Exclusive marker preserves failed initialization for diagnosis.
    with (ROOT / 'provision-started.json').open('x') as marker:
        json.dump({'startedAt': time.time(), 'project': PROJECT}, marker)
    run([*compose, 'pull'], timeout=1800)
    run([*compose, 'up', '-d', '--wait', '--wait-timeout', '240'], timeout=300)
    networks = [item['name'] for item in config['networks'].values()]
    validate_networks(json.loads(run(['docker', 'network', 'inspect', *networks])))
    gateway = run([*compose, 'ps', '-q', 'gateway']).strip()
    configure_proxy('api', json.loads(run(['docker', 'inspect', gateway]))[0])
    cli = ['/usr/local/bin/node', str(ROOT / 'source/scripts/self-host-database/cli.mjs')]
    run([*cli, 'migrate', '--env-file', DATA, '--project', PROJECT], timeout=660)
    run([*cli, 'smoke', '--env-file', DATA, '--project', PROJECT], timeout=180)
    # Smoke uses generated rows and Storage markers only; no source DB is read.
    result = {'project': PROJECT, 'readyAt': time.time(), 'syntheticDatabaseStorageSmoke': True,
              'externalNetworks': False, 'productionDataCopied': False}
    (ROOT / 'provision-complete.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"error":"LAB_DATABASE_PROVISIONING_FAILED"}', flush=True)
        raise SystemExit(1)
