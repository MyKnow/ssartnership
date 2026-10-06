import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPostgres } from "../support/isolated-postgres.mts";
const db = isolatedPostgres("ssartnership-winner-delivery");
const notification = "10000000-0000-4000-8000-000000000001";
const member = "20000000-0000-4000-8000-000000000001";
const key = `ssartnership:delivery:v2:${notification}:mm:${member}`;
const claim = (channel = "mm", provider = "mattermost", claimKey = key) => `select claim_notification_delivery('${notification}','${member}','${channel}','${provider}','campaign','${claimKey}',30)`;
const transition = (id: string, state: string) => `select transition_notification_delivery('${id}','${state}',null)`;
before(async () => {
  await db.start(); db.sql(await readFile(new URL("../fixtures/winner-delivery.sql",import.meta.url),"utf8"));
  const original = await readFile(new URL("../../supabase/migrations/20260831051425_make_notification_campaign_delivery_retry_safe.sql",import.meta.url),"utf8");
  db.sql(original.slice(original.indexOf("create or replace function public.finalize_notification_campaign("), original.indexOf("create or replace function public.claim_notification_delivery(")));
  if(process.env.TEST_WINNER_SQL_PATH) { db.sql(await readFile(process.env.TEST_WINNER_SQL_PATH,"utf8")); return; }
  const dir = new URL("../../supabase/migrations/",import.meta.url);
  for(const name of (await readdir(dir)).sort().reverse()) {
    const sql = await readFile(new URL(name,dir),"utf8");
    if(sql.includes("notification_deliveries_mattermost_v2_claim_unique")) {
      db.sql(sql.split("-- BEGIN WINNER DELIVERY")[1].split("-- END WINNER DELIVERY")[0]); return;
    }
  }
  throw new Error("Missing winner delivery migration");
});
after(()=>db.stop()); beforeEach(()=>db.sql("truncate notification_deliveries,member_notifications,notifications"));

test("concurrent Mattermost requests converge on one durable claim and one sending transition",async()=>{
  const holder=await db.transaction(claim()); const contender=db.concurrent(claim());
  try {await db.waitForLock();} finally {await holder.finish();}
  const result=await contender; assert.equal(result.code,0); assert.equal(JSON.parse(result.output).disposition,"in_progress");
  assert.equal(db.sql("select count(*) from notification_deliveries"),"1");
  const id=db.sql("select id from notification_deliveries");
  const sending=await db.transaction(transition(id,"sending")); const second=db.concurrent(transition(id,"sending"));
  try {await db.waitForLock();} finally {await sending.finish();}
  assert.equal((await second).output,"f");
});

test("stale unsent claims and definite failure retry while stale sending and unknown outcomes never replay",()=>{
  const first=JSON.parse(db.sql(claim())); const id=first.delivery_id;
  db.sql(`update notification_deliveries set updated_at=now()-interval '1 hour'`);
  assert.equal(JSON.parse(db.sql(claim())).disposition,"claimed");
  assert.equal(db.sql(transition(id,"sending")),"t");
  assert.equal(db.sql(transition(id,"failed")),"t");
  assert.equal(JSON.parse(db.sql(claim())).disposition,"claimed");
  db.sql(transition(id,"sending")); db.sql("update notification_deliveries set updated_at=now()-interval '1 hour'");
  assert.equal(JSON.parse(db.sql(claim())).disposition,"needs_reconciliation");
  assert.equal(db.sql(transition(id,"sending")),"f");
  assert.equal(JSON.parse(db.sql(claim())).disposition,"needs_reconciliation");
});

test("sent is terminal and legacy MM duplicates remain immutable by the new transition RPC",()=>{
  const id=JSON.parse(db.sql(claim())).delivery_id;
  db.sql(transition(id,"sending"));db.sql(transition(id,"sent"));
  assert.equal(JSON.parse(db.sql(claim())).disposition,"sent");assert.equal(db.sql(transition(id,"failed")),"f");
  db.sql(`insert into notification_deliveries(notification_id,member_id,channel,status,provider,provider_idempotency_key,provider_status)
    values('${notification}','${member}','mm','pending','mattermost','legacy-key','claimed'),
    ('${notification}','${member}','mm','failed','mattermost','legacy-key','failed')`);
  const legacy=db.sql("select id from notification_deliveries where provider_idempotency_key='legacy-key' and status='pending'");
  assert.equal(db.sql(transition(legacy,"sending")),"f");
  assert.equal(db.sql("select count(*) from notification_deliveries where provider_idempotency_key='legacy-key'"),"2");
});

test("provider/channel pair and exact v2 identity are mandatory; provider namespaces remain separate",()=>{
  for(const [channel,provider,claimKey] of [["push","mattermost",key],["mm","web_push",key],["mm","mattermost","arbitrary"],
    ["mm","mattermost",key.replace(member,"20000000-0000-4000-8000-000000000002")]]) {
    assert.throws(()=>db.sql(claim(channel,provider,claimKey)),/notification_delivery_claim_invalid/);
  }
  assert.throws(()=>db.sql(claim().replace("'mm'","null")),/notification_delivery_claim_invalid/);
  assert.equal(JSON.parse(db.sql(claim())).disposition,"claimed");
  assert.equal(JSON.parse(db.sql(claim("push","web_push",key))).disposition,"claimed");
  assert.equal(db.sql("select count(*) from notification_deliveries"),"2");
  assert.throws(()=>db.sql(`insert into notification_deliveries(notification_id,member_id,channel,provider,provider_idempotency_key) values('${notification}','${member}','mm','mattermost','${key}')`),/duplicate key/);
});

test("old push signature and permissions are preserved",()=>{
  const id=JSON.parse(db.sql(claim("push","web_push","old-push-key"))).delivery_id;
  assert.equal(db.sql(transition(id,"sending")),"t");assert.equal(db.sql(transition(id,"sent")),"t");
  for(const role of ["anon","authenticated"]) {
    assert.throws(()=>db.sql(`set role ${role}; ${claim()}`),/permission denied/);
    assert.throws(()=>db.sql(`set role ${role}; ${transition(id,"failed")}`),/permission denied/);
  }
  assert.equal(JSON.parse(db.sql(`set role service_role; ${claim()}`)).disposition,"claimed");
});

const draw = "30000000-0000-4000-8000-000000000001";
const campaignClaim = (slug = "test-event", target = "/events/test-event/winner-form", key = `event-reward:${draw}:winner-notice:v1`, metadata = {eventRewardDrawId:draw,eventSlug:slug}) =>
  `select claim_notification_campaign('announcement','fixture','fixture','${target}','${JSON.stringify(metadata)}',null,'${key}',array['${member}']::uuid[],30)`;

test("reserved campaign identity rejects takeover before any active or completed metadata mutation",()=>{
  const result=JSON.parse(db.sql(campaignClaim()));const id=result.notification.id; const token=result.attempt_token;
  const snapshot=()=>db.sql("select row_to_json(n) from notifications n");
  for(const completed of [false,true]) {
    if(completed) db.sql(`select finalize_notification_campaign('${id}','${token}','{"campaignStatus":"sent"}')`);
    const original=snapshot();
    assert.throws(()=>db.sql(campaignClaim("other")),/notification_campaign_idempotency_conflict/);
    assert.throws(()=>db.sql(campaignClaim("test-event","/events/other/winner-form")),/notification_campaign_idempotency_conflict/);
    assert.throws(()=>db.sql(campaignClaim("test-event","/events/test-event/winner-form",`event-reward:${draw}:winner-notice:v1`,{eventRewardDrawId:"other",eventSlug:"test-event"})),/notification_campaign_claim_invalid/);
    assert.equal(snapshot(),original);
    assert.equal(JSON.parse(db.sql(campaignClaim())).disposition,completed?"completed":"in_progress");
  }
});

test("campaign claim races have one identity and cannot replace a winner's target",async()=>{
  const holder=await db.transaction(campaignClaim()); const contender=db.concurrent(campaignClaim("test-event","/events/other/winner-form"));
  try {await db.waitForLock();} finally {await holder.finish();}
  assert.match((await contender).errors,/notification_campaign_idempotency_conflict/);
  assert.equal(db.sql("select count(*) from notifications"),"1");
  assert.equal(db.sql("select target_url from notifications"),"/events/test-event/winner-form");
});

test("generic campaigns retain the old contract and reserved metadata omissions fail before insert",()=>{
  assert.throws(()=>db.sql(`select claim_notification_campaign('announcement','fixture','fixture','/events/test','{}',null,'event-reward:missing:winner-notice:v1','{}',30)`),/notification_campaign_claim_invalid/);
  assert.equal(db.sql("select count(*) from notifications"),"0");
  assert.equal(JSON.parse(db.sql(`select claim_notification_campaign('announcement','fixture','fixture','/events/test','{}',null,'general-legacy','{}',30)`)).disposition,"claimed");
  for(const role of ["anon","authenticated"]) assert.throws(()=>db.sql(`set role ${role}; ${campaignClaim()}`),/permission denied/);
  assert.equal(JSON.parse(db.sql(`set role service_role; ${campaignClaim()}`)).disposition,"claimed");
});
