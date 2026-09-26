#!/usr/bin/env python3
"""Extract fixed timing markers from local Docker logs without persisting log text."""
from datetime import datetime
import json
from pathlib import Path
import re
import subprocess
import sys

SCRIPTS = {'install:trusted', 'check:docs', 'verify:quick', 'check:install-scripts', 'check:cross-platform', 'check:lockfile', 'validate:migrations', 'lint', 'typecheck:ci', 'test', 'audit:security', 'build'}

def markers(text):
    events = []
    for line in text.splitlines():
        match = re.match(r'(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)', line)
        if not match:
            continue
        stamp, content = match.groups()
        label = None
        script = re.fullmatch(r'> ssartnership@[^ ]+ ([a-z:-]+)', content.strip())
        if script and script[1] in SCRIPTS:
            label = script[1]
        elif 'Creating an optimized production build' in content:
            label = 'next-build-start'
        elif 'Compiled successfully' in content:
            label = 'next-compiled'
        elif 'Collecting build traces' in content:
            label = 'next-traces'
        elif re.search(r'\b83 passed \(', content):
            label = 'e2e-complete'
        if label:
            events.append({'at': datetime.fromisoformat(stamp.replace('Z', '+00:00')).timestamp(), 'marker': label})
    return sorted(events, key=lambda row: row['at'])

if __name__ == '__main__':
    run_id = sys.argv[1]
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,60}', run_id):
        raise SystemExit('Invalid run id')
    result = subprocess.run(['sudo', '-n', 'docker', 'logs', '--timestamps', 'ssartnership-lab-' + run_id], capture_output=True, text=True, check=True)
    events = markers(result.stdout + '\n' + result.stderr)
    path = Path.home() / 'build-lab/runs' / run_id / 'phases.json'
    path.write_text(json.dumps(events, indent=2) + '\n')
    print(json.dumps({'runId': run_id, 'events': events}))
