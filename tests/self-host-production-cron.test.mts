import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {productionCronTimers} from '../scripts/self-host-operations/production-cron.mjs';
test('Production timers preserve every UTC daily schedule without catch-up execution',()=>{
 const source=readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
 const entries=JSON.parse(source).crons;
 const timers=productionCronTimers(source);
 assert.equal(timers.length,entries.length);
 timers.forEach((timer,index)=>{
  const [minute,hour]=entries[index].schedule.split(' ');
  assert.equal(timer.name,entries[index].path.slice('/api/cron/'.length));
  assert.ok(timer.content.includes(`${hour.padStart(2,'0')}:${minute.padStart(2,'0')}:00 UTC`));
  assert.match(timer.content,/Persistent=false/);
 });
});
test('unsupported calendar and injected job path are rejected before installation',()=>{
 for(const entry of [{path:'/api/cron/rss',schedule:'*/5 * * * *'},{path:'/api/cron/rss\nExecStart=bad',schedule:'0 0 * * *'}]){
  assert.throws(()=>productionCronTimers(JSON.stringify({crons:[entry]})));
 }
});
