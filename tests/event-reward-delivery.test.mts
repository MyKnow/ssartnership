import assert from 'node:assert/strict';
import test from 'node:test';
import { MockNotificationRepository } from '../src/lib/repositories/mock/notification-repository.mock.ts';
import { resolveEventRewardWinnerDeliveryOutcome, selectEventRewardNotificationTargets } from '../src/lib/promotions/event-reward-delivery.ts';
import { MattermostApiError } from '../src/lib/mattermost/client.ts';
const delivery = await import('../src/lib/admin-notification-ops-delivery.ts');

test('positive inbox evidence is required; unknown external never becomes reached or retryable', () => {
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([]), 'unreached');
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([{channel:'in_app',status:'failed'}]), 'unreached');
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([{channel:'in_app',status:'sent'}]), 'reached');
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([{channel:'mm',status:'pending',providerStatus:'sending'}]), 'needs_reconciliation');
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([{channel:'mm',status:'pending',providerStatus:'claimed'}]), 'pending');
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([{channel:'in_app',status:'sent'},{channel:'mm',status:'failed',providerStatus:'timeout'}]), 'needs_reconciliation');
  assert.equal(resolveEventRewardWinnerDeliveryOutcome([{channel:'in_app',status:'sent'},{channel:'mm',status:'failed',providerStatus:'failed'}]), 'unreached');
  assert.deepEqual(selectEventRewardNotificationTargets(['ok','failed','unknown','pending'], new Map([['ok','reached'],['failed','unreached'],['unknown','needs_reconciliation'],['pending','pending']])), ['failed']);
});

const run = (repo: MockNotificationRepository, suffix: string, send: () => Promise<{id:string}>) => delivery.runMattermostDeliveryAttempt({ notificationId: `notice-${suffix}`, memberId:`member-${suffix}`, send }, repo);

test('concurrent MM claims call the provider once; sent recipients never replay', async () => {
  const repo = new MockNotificationRepository(); let calls=0;
  const send=async()=>{calls++;return {id:'post'};};
  await Promise.all([run(repo,'concurrent',send),run(repo,'concurrent',send)]);
  await run(repo,'concurrent',send);
  assert.equal(calls,1);
});

test('MM known rejection retries intentionally, uncertain timeout/network/5xx does not', async () => {
  for(const [suffix,error,retries] of [['reject',new MattermostApiError('forbidden',403),true],['timeout',new MattermostApiError('timeout'),false],['network',new Error('offline'),false],['server',new MattermostApiError('unavailable',503),false],['response',new MattermostApiError('invalid_response',201),false]] as const){
    const repo=new MockNotificationRepository();let calls=0;
    const send=async()=>{calls++;if(calls===1)throw error;return {id:'post'};};
    await run(repo,suffix,send);await run(repo,suffix,send);
    assert.equal(calls,retries?2:1,suffix);
  }
});

test('MM provider success with failed sent bookkeeping remains uncertain and never replays', async () => {
  const repo=new MockNotificationRepository(); const transition=repo.transitionNotificationDelivery.bind(repo);let calls=0;
  repo.transitionNotificationDelivery=async(input)=>{if(input.transition==='sent')throw new Error('write lost');return transition(input);};
  const send=async()=>{calls++;return {id:'post'};};
  await run(repo,'ledger',send);await run(repo,'ledger',send);assert.equal(calls,1);
});

test('MM claim and sending CAS failures prevent any provider call', async () => {
  const repo=new MockNotificationRepository();let calls=0;
  repo.transitionNotificationDelivery=async()=>false;
  await run(repo,'cas',async()=>{calls++;return {id:'post'};});assert.equal(calls,0);
});

test('MM post-ID annotation failure preserves sent and never appends a second receipt', async () => {
  const repo=new MockNotificationRepository();let calls=0;
  repo.annotateSentNotificationDelivery=async()=>{throw new Error('annotation write failure');};
  const send=async()=>{calls++;return {id:'post'};};
  const first=await run(repo,'annotation',send);await run(repo,'annotation',send);
  assert.equal(first.outcome,'sent');assert.equal(calls,1);
});

test('MM stale claimed may resume, but stale sending remains reconciliation-only', async (t) => {
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-06T00:00:00Z')});
  const repo=new MockNotificationRepository();
  const input=(suffix:string)=>({notificationId:'stale-notice',memberId:suffix,channel:'mm' as const,provider:'mattermost' as const,providerCampaignId:'stale-notice',providerIdempotencyKey:`ssartnership:delivery:v2:stale-notice:mm:${suffix}`,leaseDurationSeconds:30});
  const claim=await repo.claimNotificationDelivery(input('claimed'));
  const sending=await repo.claimNotificationDelivery(input('sending'));
  await repo.transitionNotificationDelivery({deliveryId:sending.deliveryId,transition:'sending'});
  t.mock.timers.tick(31_000);
  assert.deepEqual(await repo.claimNotificationDelivery(input('claimed')),{deliveryId:claim.deliveryId,disposition:'claimed'});
  assert.deepEqual(await repo.claimNotificationDelivery(input('sending')),{deliveryId:sending.deliveryId,disposition:'needs_reconciliation'});
  t.mock.timers.tick(600_000);
  assert.equal((await repo.claimNotificationDelivery(input('sending'))).disposition,'needs_reconciliation');
});

test('reserved winner campaign identity is immutable before resume and completion', async () => {
  const repo=new MockNotificationRepository();
  const input={type:'announcement',title:'test',body:'test',targetUrl:'/events/signup-reward/winner-form',metadata:{eventRewardDrawId:'identity-draw',eventSlug:'signup-reward'},idempotencyKey:'event-reward:identity-draw:winner-notice:v1',recipientMemberIds:[],leaseDurationSeconds:30};
  const claim=await repo.claimNotificationCampaign(input);
  await assert.rejects(repo.claimNotificationCampaign({...input,metadata:{...input.metadata,eventSlug:'other'}}),/충돌/);
  await assert.rejects(repo.claimNotificationCampaign({...input,targetUrl:'/other'}),/충돌/);
  await repo.finalizeNotificationCampaign({notificationId:claim.notification.id,attemptToken:claim.attemptToken!,metadata:{...input.metadata,campaignStatus:'failed'}});
  await assert.rejects(repo.claimNotificationCampaign({...input,metadata:{...input.metadata,eventSlug:'other'}}),/충돌/);
  await assert.rejects(repo.claimNotificationCampaign({...input,metadata:{...input.metadata,eventRewardDrawId:'other'}}),/올바르지/);
  assert.equal((await repo.claimNotificationCampaign(input)).notification.id,claim.notification.id);
});
