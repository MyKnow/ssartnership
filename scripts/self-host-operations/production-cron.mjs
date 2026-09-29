import { readFileSync, realpathSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadCronSchedules, invokeSelfHostCron, getSafeCronErrorCode } from '../lib/self-host-cron.mjs';

export function loadProductionCronSchedules(source, catalogSource) {
  const entries = loadCronSchedules(source);
  const approved = loadCronSchedules(catalogSource).filter(entry => !entry.path.includes('wallet'));
  if (entries.length !== approved.length || entries.some(entry => !approved.some(item => item.path === entry.path))) {
    throw new Error('PRODUCTION_CRON_SCOPE_INVALID');
  }
  return entries;
}

/** Expand only the reviewed daily/hourly/stepped-minute subset, in UTC. */
export function productionCronCalendar(schedule) {
  const match = /^(\d+|\d+-59\/\d+) (\d+|\*) \* \* \*$/u.exec(schedule);
  if (!match) throw new Error('PRODUCTION_CRON_SCHEDULE_UNSUPPORTED');
  const [start, step] = match[1].split('-59/').map(Number);
  if (start > 59 || (step !== undefined && (!Number.isInteger(step) || step < 1 || step > 59)) || (match[2] !== '*' && Number(match[2]) > 23)) throw new Error('PRODUCTION_CRON_SCHEDULE_UNSUPPORTED');
  const minutes = [];
  for (let minute = start; minute < 60; minute += step ?? 60) minutes.push(String(minute).padStart(2, '0'));
  const hour = match[2] === '*' ? '*' : match[2].padStart(2, '0');
  return `*-*-* ${hour}:${minutes.join(',')}:00 UTC`;
}

/** @param {string} source @param {string} [catalogSource] @returns {Array<{name:string,content:string}>} */
export function productionCronTimers(source, catalogSource = readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) {
  return loadProductionCronSchedules(source, catalogSource).map(({ path, schedule }) => {
    const name = path.slice('/api/cron/'.length);
    return { name, content: `[Unit]\nDescription=SSARTNERSHIP Production ${name}\n[Timer]\nOnCalendar=${productionCronCalendar(schedule)}\nAccuracySec=1s\nPersistent=false\nUnit=ssartnership-production-cron@${name}.service\n[Install]\nWantedBy=timers.target\n` };
  });
}

async function main() {
  if (process.getuid?.() !== 0 || process.argv.length !== 3 || !/^[-a-z0-9]+$/u.test(process.argv[2])) throw new Error();
  if (readFileSync('/etc/myknow/secrets/ssartnership-production/cron-owner','utf8').trim() !== 'home-production') throw new Error();
  const entries = loadProductionCronSchedules(
    readFileSync(new URL('../../deploy/self-host-operations/production-cron/schedules.json', import.meta.url), 'utf8'),
    readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
  );
  const env = parseEnv(readFileSync('/etc/myknow/secrets/ssartnership-production/app.env','utf8'));
  const result = await invokeSelfHostCron({ entries, path: `/api/cron/${process.argv[2]}`, baseUrl: 'http://127.0.0.1:3110', secret: env.CRON_SECRET });
  console.log(JSON.stringify({ completed: true, path: result.path }));
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ error: getSafeCronErrorCode(error) })); process.exitCode = 1; });
}
