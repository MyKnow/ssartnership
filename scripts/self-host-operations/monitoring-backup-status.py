#!/usr/bin/env python3
"""Publish systemd backup outcome and a verified restore timestamp, no secrets."""
import json
import os
import subprocess
import time
from pathlib import Path

OUTPUT = Path('/etc/myknow/secrets/ssartnership-production/monitoring/textfile/backup-status.prom')
RESTORE = Path('/var/lib/ssartnership-monitoring/restore-proof.json')


def collect():
    p = subprocess.run(['systemctl', 'show', 'ssartnership-production-backup.service', '-p', 'Result', '-p', 'ExecMainExitTimestamp', '-p', 'ActiveState'], capture_output=True, text=True, check=True)
    status = dict(line.split('=', 1) for line in p.stdout.splitlines() if '=' in line)
    values = {'ssartnership_production_backup_job_running': int(status['ActiveState'] == 'activating')}
    timestamp = status.get('ExecMainExitTimestamp')
    if timestamp:
        values['ssartnership_production_backup_job_success'] = int(status['Result'] == 'success')
        finished = subprocess.check_output(['date', '-d', timestamp, '+%s'], text=True).strip()
        values['ssartnership_production_backup_job_finished_seconds'] = int(finished)
    if RESTORE.exists():
        proof = json.loads(RESTORE.read_text())
        verified = proof.get('verifiedSeconds')
        if proof.get('equalityVerified') is True and isinstance(verified, (int, float)) and 0 < verified <= time.time():
            values['ssartnership_production_restore_verified_seconds'] = verified
    content = ''.join(f'{name} {value}\n' for name, value in values.items())
    temporary = OUTPUT.with_suffix('.new')
    temporary.write_text(content); temporary.chmod(0o644); temporary.replace(OUTPUT)


if __name__ == '__main__':
    os.umask(0o077)
    try:
        collect()
    except Exception:
        print('{"error":"BACKUP_STATUS_COLLECTION_FAILED"}')
        raise SystemExit(1)
