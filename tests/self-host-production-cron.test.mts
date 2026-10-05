import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {productionCronTimers, productionCronCalendar, loadProductionCronSchedules} from '../scripts/self-host-operations/production-cron.mjs';
const source = readFileSync(new URL('../deploy/self-host-operations/production-cron/schedules.json',import.meta.url),'utf8');
test('self-host schedules cover every approved non-Wallet job without catch-up execution',()=>{
 const timers=productionCronTimers(source);
 assert.equal(timers.length,11);
 assert.ok(timers.every(t=>!t.name.includes('wallet') && t.content.includes('Persistent=false')));
 assert.ok(timers.find(t=>t.name==='rss')?.content.includes('*:02,17,32,47:00 UTC'));
 assert.ok(timers.find(t=>t.name==='mattermost-sender-health')?.content.includes('*:01,06,11,16,21,26,31,36,41,46,51,56:00 UTC'));
 assert.ok(timers.find(t=>t.name==='push-expiring-partners')?.content.includes('00:00:00 UTC'));
});
test('calendar preserves hourly and daily boundaries and rejects unsupported semantics',()=>{
 assert.equal(productionCronCalendar('10 * * * *'),'*-*-* *:10:00 UTC');
 assert.equal(productionCronCalendar('40 18 * * *'),'*-*-* 18:40:00 UTC');
 for(const schedule of ['60 * * * *','0 24 * * *','0 * * * 1','0 * 1 * *','*/0 * * * *','1-59/0 * * * *','0\nExecStart=bad']) assert.throws(()=>productionCronCalendar(schedule));
});
test('unknown, missing, duplicate or excluded job stops the scheduler before installation',()=>{
 const entries=JSON.parse(source).crons;
 for (const crons of [entries.slice(1),[...entries,entries[0]],[...entries,{path:'/api/cron/reconcile-apple-wallet-passes',schedule:'0 0 * * *'}],entries.map((v: {path:string,schedule:string},i:number)=>i===0?{...v,path:'/api/cron/unknown'}:v)]) {
  assert.throws(()=>loadProductionCronSchedules(JSON.stringify({...JSON.parse(source),crons})),/PRODUCTION_CRON_SCOPE_INVALID/);
 }
});

test('Cron failure CLI executes through both canonical and installed symlink paths',()=>{
 const directory=mkdtempSync(join(tmpdir(),'ssart-cron-entrypoint-'));
 try {
  const target=fileURLToPath(new URL('../scripts/self-host-operations',import.meta.url));
  const linked=join(directory,'current');
  symlinkSync(target,linked,'junction');
  for(const root of [target,linked]) {
   const result=spawnSync(process.execPath,[join(root,'notify-cron-failure.mjs'),'not-a-production-job'],{encoding:'utf8',timeout:10000});
   assert.equal(result.error,undefined);
   assert.equal(result.status,1,'invalid job must reach validation, never exit as a no-op');
   assert.equal(result.stdout,'');
   assert.equal(result.stderr.trim(),'{"error":"CRON_FAILURE_EMAIL_FAILED"}');
  }
 } finally {rmSync(directory,{recursive:true,force:true});}
});
