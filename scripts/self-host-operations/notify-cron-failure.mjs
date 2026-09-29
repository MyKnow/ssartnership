import { readFile, lstat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { alertDeliveryConfiguration, deliverOperationalAlert } from '../../deploy/observability/alert-delivery.mjs';
import { loadProductionCronSchedules } from './production-cron.mjs';

export async function notifyCronFailure(job) {
  if (process.getuid?.() !== 0) throw Error('OPERATOR_REQUIRED');
  const entries = loadProductionCronSchedules(
    await readFile(new URL('../../deploy/self-host-operations/production-cron/schedules.json', import.meta.url), 'utf8'),
    await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'),
  );
  if (!entries.some(entry => entry.path === `/api/cron/${job}`)) throw Error('CRON_PATH_UNKNOWN');
  const file = '/etc/myknow/secrets/ssartnership-production/monitoring/monitoring.env';
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o077)) throw Error('ALERT_CONFIG_INVALID');
  const config = alertDeliveryConfiguration(parseEnv(await readFile(file, 'utf8')));
  if (config?.kind !== 'email') throw Error('ALERT_CONFIG_INVALID');
  await deliverOperationalAlert(config, `[ssartnership] firing: ProductionCronFailed (${job})`, {
    groupKey: `production-cron-${job}`,
    alerts: [{ startsAt: new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString(), endsAt: '' }],
  });
  console.log('{"cronFailureEmailAccepted":true}');
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await notifyCronFailure(process.argv[2]); } catch { console.error('{"error":"CRON_FAILURE_EMAIL_FAILED"}'); process.exitCode = 1; }
}
