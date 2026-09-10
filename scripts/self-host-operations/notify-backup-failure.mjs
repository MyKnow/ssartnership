import { readFile, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { alertDeliveryConfiguration, deliverOperationalAlert } from '../../deploy/observability/alert-delivery.mjs';

export async function notifyBackupFailure() {
  if (process.getuid?.() !== 0) throw Error('OPERATOR_REQUIRED');
  const file = '/etc/myknow/secrets/ssartnership-production/monitoring/monitoring.env';
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o077)) throw Error('ALERT_CONFIG_INVALID');
  const config = alertDeliveryConfiguration(parseEnv(await readFile(file, 'utf8')));
  if (config?.kind !== 'email') throw Error('ALERT_CONFIG_INVALID');
  await deliverOperationalAlert(config, '[ssartnership] firing: BackupFailed (critical)', {
    groupKey: 'daily-production-backup',
    alerts: [{ startsAt: new Date().toISOString(), endsAt: '' }],
  });
  console.log('{"backupFailureEmailAccepted":true}');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await notifyBackupFailure(); } catch { console.error('{"error":"BACKUP_FAILURE_EMAIL_FAILED"}'); process.exitCode = 1; }
}
