import { chmod, readFile, rename, rm, writeFile } from 'node:fs/promises';

/**
 * node-exporter textfile output for Production cron runs. One file per job so
 * a run rewrites only its own series; the service is already serialized by
 * flock. A metrics failure never changes the job's exit status.
 */
export const PRODUCTION_CRON_TEXTFILE_DIR = '/etc/myknow/secrets/ssartnership-production/monitoring/textfile';

const JOB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Expected run interval for the reviewed daily/hourly/stepped-minute subset. */
export function productionCronIntervalSeconds(schedule) {
  const match = /^(\d+|\d+-59\/(\d+)) (\d+|\*) \* \* \*$/u.exec(schedule);
  if (!match) throw new Error('PRODUCTION_CRON_SCHEDULE_UNSUPPORTED');
  if (match[2]) {
    const step = Number(match[2]);
    if (!Number.isInteger(step) || step < 1 || step > 59) throw new Error('PRODUCTION_CRON_SCHEDULE_UNSUPPORTED');
    return step * 60;
  }
  return match[3] === '*' ? 3600 : 86400;
}

function assertJob(job) {
  if (typeof job !== 'string' || !JOB.test(job) || job.length > 64) throw new Error('PRODUCTION_CRON_JOB_INVALID');
  return job;
}

/** Reads the last success timestamp from a previous textfile for the same job. */
export function previousProductionCronSuccess(content, job) {
  assertJob(job);
  const pattern = new RegExp(`^ssartnership_production_cron_last_success_seconds\\{cron="${job}"\\} (\\d+)$`, 'mu');
  const match = typeof content === 'string' ? pattern.exec(content) : null;
  return match ? Number(match[1]) : 0;
}

export function renderProductionCronMetrics({ job, schedule, success, now, previousSuccess = 0 }) {
  assertJob(job);
  const seconds = Math.floor(now / 1000);
  const labels = `{cron="${job}"}`;
  const values = [
    ['last_run_seconds', 'Unix time the last run finished.', seconds],
    ['last_result', 'Last run result: 1 success, 0 failure.', success ? 1 : 0],
    ['last_success_seconds', 'Unix time of the last successful run; 0 before the first success.', success ? seconds : Math.max(0, Math.floor(previousSuccess))],
    ['interval_seconds', 'Expected interval from schedules.json.', productionCronIntervalSeconds(schedule)],
  ];
  return values.map(([name, help, value]) => `# HELP ssartnership_production_cron_${name} ${help}\n# TYPE ssartnership_production_cron_${name} gauge\nssartnership_production_cron_${name}${labels} ${value}\n`).join('');
}

/** Atomically replaces the job's textfile (tmp + rename, world-readable for node-exporter). */
export async function recordProductionCronOutcome({ job, schedule, success, now = Date.now(), directory = PRODUCTION_CRON_TEXTFILE_DIR }) {
  assertJob(job);
  const file = `${directory}/production-cron-${job}.prom`;
  let previousSuccess = 0;
  try { previousSuccess = previousProductionCronSuccess(await readFile(file, 'utf8'), job); } catch { /* First run or unreadable file. */ }
  const content = renderProductionCronMetrics({ job, schedule, success, now, previousSuccess });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, content, { mode: 0o644 });
    // The unit runs with UMask=0077; node-exporter reads as an unprivileged user.
    await chmod(temporary, 0o644);
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
