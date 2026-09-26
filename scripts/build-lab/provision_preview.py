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


def validate_config(config):
    if config.get('name') != PROJECT or set(config.get('services', {})) != {'db', 'rest', 'storage', 'gateway'}:
        raise ValueError('Unexpected database project')
    networks = config.get('networks', {})
    if not networks or any(network.get('internal') is not True for network in networks.values()):
        raise ValueError('External runtime network forbidden')
    for service in config['services'].values():
        if service.get('ports') or service.get('network_mode'):
            raise ValueError('Published ports and alternate network modes forbidden')


def run(args, timeout=60, input=None):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=timeout,
                          input=input,
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
    validate_config(config)
    seed_file = ROOT / 'seed-preview.sql'
    if seed_file.is_symlink() or not seed_file.is_file():
        raise ValueError('Synthetic seed file must be installed first')
    seed_sql = seed_file.read_text()
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
    # Fixed synthetic rows only. SQL aborts atomically if application data exists.
    run([*compose, 'exec', '-T', 'db', 'psql', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1',
         '--username', 'postgres', '--dbname', 'postgres'],
        input=seed_sql, timeout=60)
    result = {'project': PROJECT, 'readyAt': time.time(), 'syntheticDatabaseStorageSmoke': True,
              'syntheticPartnerId': '00000497-0000-4000-8000-000000000003',
              'externalNetworks': False, 'productionDataCopied': False}
    (ROOT / 'provision-complete.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"error":"LAB_DATABASE_PROVISIONING_FAILED"}', flush=True)
        raise SystemExit(1)
