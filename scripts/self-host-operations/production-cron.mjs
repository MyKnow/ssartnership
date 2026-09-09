import { readFileSync, realpathSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadCronSchedules, invokeSelfHostCron, getSafeCronErrorCode } from '../lib/self-host-cron.mjs';

/** @param {string} source @returns {Array<{name:string,content:string}>} */
export function productionCronTimers(source) {
  return loadCronSchedules(source).map(({path,schedule})=>{
    const match=/^(\d+) (\d+) \* \* \*$/u.exec(schedule);
    if(!match)throw new Error('PRODUCTION_CRON_DAILY_SCHEDULE_REQUIRED');
    const name=path.slice('/api/cron/'.length);
    return {name,content:`[Unit]\nDescription=SSARTNERSHIP Production ${name}\n[Timer]\nOnCalendar=*-*-* ${match[2].padStart(2,'0')}:${match[1].padStart(2,'0')}:00 UTC\nAccuracySec=1s\nPersistent=false\nUnit=ssartnership-production-cron@${name}.service\n[Install]\nWantedBy=timers.target\n`};
  });
}

async function main() {
  if(process.getuid?.()!==0||process.argv.length!==3||!/^[-a-z0-9]+$/u.test(process.argv[2]))throw new Error();
  if(readFileSync('/etc/myknow/secrets/ssartnership-production/cron-owner','utf8').trim()!=='home-production')throw new Error();
  const entries=loadCronSchedules(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
  const env=parseEnv(readFileSync('/etc/myknow/secrets/ssartnership-production/app.env','utf8'));
  const result=await invokeSelfHostCron({entries,path:`/api/cron/${process.argv[2]}`,baseUrl:'http://127.0.0.1:3110',secret:env.CRON_SECRET});
  console.log(JSON.stringify({completed:true,path:result.path}));
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(JSON.stringify({error:getSafeCronErrorCode(error)}));process.exitCode=1;});
}
