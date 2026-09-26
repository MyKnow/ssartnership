#!/usr/bin/env python3
"""Build one reviewed branch SHA in the lab guest; publish only a local archive."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import benchmark
from build_profile import load_profile

REPOSITORY = 'https://github.com/MyKnow/ssartnership.git'
REF = 'refs/heads/ci/497-pve-build-lab'


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'[a-f0-9]{40}', sys.argv[1]) or os.getuid() == 0:
        raise ValueError('Invalid lab build request')
    sha = sys.argv[1]
    profile = load_profile()
    root = Path.home() / 'build-lab'
    request = root / 'requests' / sha
    request.mkdir(parents=True, exist_ok=False)
    started = time.time()
    env = {'PATH': '/usr/bin:/bin', 'HOME': str(Path.home()), 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0', 'DOCKER_BUILDKIT': '1'}
    def run(args, *, cwd=request, timeout=1200):
        with (request / 'preparation.log').open('a') as log:
            subprocess.run(args, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=timeout, check=True)
    repo = request / 'repo'
    run(['git', 'init', '--quiet', str(repo)])
    run(['git', '-c', 'core.hooksPath=/dev/null', 'fetch', '--depth=1', REPOSITORY, REF], cwd=repo)
    head = subprocess.run(['git', 'rev-parse', 'FETCH_HEAD'], cwd=repo, env=env, capture_output=True, text=True, check=True).stdout.strip()
    if head != sha:
        raise ValueError('Branch moved before source acquisition')
    archive = request / 'source.tar'
    run(['git', 'archive', '--format=tar', '--output', str(archive), sha], cwd=repo)
    source = request / 'source'
    source.mkdir()
    run(['tar', '-xf', str(archive), '-C', str(source)])
    stages = {'sourceReadyAt': time.time()}
    gate_tag = 'ssartnership-lab-gate:' + sha
    run(['sudo', '-n', 'env', 'DOCKER_BUILDKIT=1', 'docker', 'build', '--platform', 'linux/amd64', '--tag', gate_tag, str(source / 'deploy/self-host-ci')])
    image_id = subprocess.run(['sudo', '-n', 'docker', 'image', 'inspect', '--format', '{{.Id}}', gate_tag],
                              capture_output=True, text=True, check=True).stdout.strip()
    stages['gateImageReadyAt'] = time.time()
    benchmark.BASE_SHA = sha
    benchmark.BASE_ARCHIVE_HASH = hashlib.sha256(archive.read_bytes()).hexdigest()
    benchmark.ARCHIVE_NAME = str(archive.relative_to(root))
    benchmark.GATE_IMAGE = image_id
    benchmark.SITE_ORIGIN = 'http://127.0.0.1:3100'
    benchmark.API_ORIGIN = 'http://127.0.0.1:54321'
    run_id = 'request-' + sha
    sys.argv = ['benchmark.py', '--cpus', str(profile['cpus']), '--memory-mib', str(profile['containerMemoryMiB']), '--run-id', run_id]
    if profile['stableLabCache']:
        sys.argv += ['--stable-lab-cache']
    previous_file = root / 'latest-success.json'
    if profile['reuseCache'] and previous_file.is_file():
        previous = json.loads(previous_file.read_text())
        previous_run = previous.get('runId', '')
        context = benchmark.build_cache_context(source, image_id)
        try:
            prior = benchmark.cache_sources(root, previous_run, context=context, cross_sha=True)
            prior_result = json.loads((prior.parent / 'result.json').read_text())
            if bool(prior_result.get('stableLabCache', False)) == profile['stableLabCache']:
                sys.argv += ['--warm-from', previous_run, '--warm-cross-sha']
        except (OSError, ValueError, KeyError):
            # Cache incompatibility is a miss. Never omit any gate or reuse outputs.
            pass
    stages['gateStartedAt'] = time.time()
    benchmark.main()
    stages['gateFinishedAt'] = time.time()
    work = root / 'runs' / run_id / 'work'
    tag = 'ssartnership-lab-app:' + sha
    packaging = time.monotonic()
    stages['packagingStartedAt'] = time.time()
    run(['sudo', '-n', 'env', 'DOCKER_BUILDKIT=1', 'docker', 'build', '--platform', 'linux/amd64', '--label', 'org.opencontainers.image.revision=' + sha, '--tag', tag, '--file', str(work / 'deploy/self-host-ci/App.Dockerfile'), str(work)])
    output = request / 'app.tar'
    run(['sudo', '-n', 'docker', 'save', '--output', str(output), tag])
    # Archive content is public build output, never an operational env file.
    run(['sudo', '-n', 'chmod', '0644', str(output)])
    result = {'sha': sha, 'image': tag, 'archiveSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'startedAt': started, 'finishedAt': time.time(), 'packagingSeconds': time.monotonic() - packaging, 'deployed': False}
    result['stages'] = stages
    (request / 'artifact.json').write_text(json.dumps(result, indent=2) + '\n')
    pending = root / 'latest-success.pending'
    pending.write_text(json.dumps({'runId': run_id, 'sha': sha}) + '\n')
    pending.replace(previous_file)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
