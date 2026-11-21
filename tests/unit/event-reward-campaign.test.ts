import { beforeEach, expect, it, vi } from "vitest";
import { MockNotificationRepository } from "@/lib/repositories/mock/notification-repository.mock";
const state=vi.hoisted(()=>({repository:null as unknown as MockNotificationRepository, disabled:false, mm:vi.fn(), push:vi.fn()}));
vi.mock("@/lib/repositories",()=>({get notificationRepository(){return state.repository;}}));
vi.mock("@/lib/admin-notification-ops-delivery",()=>({sendMattermostCampaignDeliveries:state.mm,sendPushCampaignDeliveries:state.push}));
vi.mock("@/lib/admin-notification-ops-utils",async(importOriginal)=>({...await importOriginal<object>(),isMattermostConfigured:()=>true}));
vi.mock("@/lib/push/config",()=>({isPushConfigured:()=>true}));
vi.mock("@/lib/push/web-push-client",()=>({getWebPush:vi.fn()}));
vi.mock("@/lib/push/audience",()=>({resolvePushAudience:async()=>({scope:"member",label:"test",memberIds:["a"],memberId:null,year:null,campus:null})}));
vi.mock("@/lib/policy-documents.server",()=>({getPolicyDocumentByKind:async()=>null}));
vi.mock("@/lib/mattermost-senders/repository",()=>({mattermostSenderRepository:{listMetadata:async()=>[{generation:15,status:"active"}]}}));
vi.mock("@/lib/mm-directory/identities",()=>({getMmUserDirectoryEntriesByAccountIds:async()=>new Map([["account-a",{mm_user_id:"mm-a",mm_username:"a",is_staff:false,source_years:[]}]])}));
vi.mock("@/lib/notification-templates/repository.server",()=>({resolveNotificationTemplate:async()=>({titleTemplate:"{{title}}",bodyTemplate:"{{body}}"})}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseAdminClient:()=>({from(table:string){const q={select:()=>q,is:()=>q,in:()=>q,eq:()=>q,order:()=>q,range:()=>q,then(resolve:(v:unknown)=>unknown){return Promise.resolve({error:null,data:table==="members"?[{id:"a",display_name:"A",generation:15,campus:"서울",mattermost_account_id:"account-a"}]:table==="push_preferences"?[{member_id:"a",enabled:true,announcement_enabled:!state.disabled,new_partner_enabled:true,expiring_partner_enabled:true,review_enabled:true,mm_enabled:true,marketing_enabled:false}]:[]}).then(resolve);}};return q;}})}));
import { sendAdminNotificationCampaign, type EventRewardCampaignDelivery } from "@/lib/admin-notification-ops";
const input={notificationType:"announcement" as const,title:"당첨 안내",body:"안내",url:"/notifications",channels:{in_app:true,push:true,mm:true},audience:{scope:"member" as const,memberIds:["a"]},confirmationText:"알림 발송",idempotencyKey:"untrusted-composer-key"};
const contract=():EventRewardCampaignDelivery=>({drawId:"draw-1",eventSlug:"signup-reward",beforeDelivery:vi.fn(async()=>["a"]),resolveDeliveryStatus:vi.fn(async()=>"sent" as const)});
beforeEach(()=>{
  delete (globalThis as {__mockNotificationStore?:unknown}).__mockNotificationStore;
  state.repository=new MockNotificationRepository();state.disabled=false;vi.clearAllMocks();
  state.mm.mockResolvedValue({targeted:1,sent:1,failed:0,skipped:0,bookkeepingErrors:[]});
  state.push.mockResolvedValue({targeted:0,sent:0,failed:0,skipped:0,bookkeepingErrors:[]});
});
it("simultaneous winner requests share one stable campaign and one provider dispatch",async()=>{
  const claim=vi.spyOn(state.repository,"claimNotificationCampaign");const c=contract();
  const result=await Promise.all([sendAdminNotificationCampaign(input,"manual",c),sendAdminNotificationCampaign(input,"manual",c)]);
  expect(new Set(result.map(r=>r.notificationId)).size).toBe(1);expect(result.some(r=>r.campaignDisposition==="in_progress")).toBe(true);
  expect(state.mm).toHaveBeenCalledTimes(1);expect(c.beforeDelivery).toHaveBeenCalledTimes(1);
  expect(claim).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:"event-reward:draw-1:winner-notice:v1"}));
  const completed=await sendAdminNotificationCampaign(input,"manual",contract());expect(completed.campaignDisposition).toBe("completed");expect(state.mm).toHaveBeenCalledTimes(1);
});
it("association failure stops external effects and leaves the same key recoverable",async()=>{
  const c=contract();c.beforeDelivery=vi.fn(async()=>{throw new Error("association failed");});
  await expect(sendAdminNotificationCampaign(input,"manual",c)).rejects.toThrow("association failed");expect(state.mm).not.toHaveBeenCalled();
  const retry=await sendAdminNotificationCampaign(input,"manual",contract());expect(retry.campaignDisposition).toBe("in_progress");expect(state.mm).not.toHaveBeenCalled();
});
it("winner evidence failure does not finalize aggregate totals as sent",async()=>{
  const c=contract();c.resolveDeliveryStatus=vi.fn(async()=>{throw new Error("ledger unknown");});
  await expect(sendAdminNotificationCampaign(input,"manual",c)).rejects.toThrow("ledger unknown");
  const retry=await sendAdminNotificationCampaign(input,"manual",contract());expect(retry.campaignDisposition).toBe("in_progress");
});
it("withdrawn channels stay empty and no-target winner campaign remains retryable",async()=>{
  state.disabled=true;const c=contract();c.resolveDeliveryStatus=vi.fn(async()=>"failed" as const);
  const first=await sendAdminNotificationCampaign(input,"manual",c);
  expect(state.mm).toHaveBeenCalledWith(expect.objectContaining({members:[],retrySafe:true}));
  expect(state.push).toHaveBeenCalledWith(expect.objectContaining({subscriptions:[],retrySafe:true}));
  const second=await sendAdminNotificationCampaign(input,"manual",c);expect(second.notificationId).toBe(first.notificationId);expect(second.campaignDisposition).toBe("resumed");
});
it("pre-send evidence filters external targets without changing the stable identity",async()=>{
  const c=contract();c.beforeDelivery=vi.fn(async()=>[]);await sendAdminNotificationCampaign(input,"manual",c);
  expect(state.mm).toHaveBeenCalledWith(expect.objectContaining({members:[]}));expect(state.push).toHaveBeenCalledWith(expect.objectContaining({subscriptions:[]}));
});
it("completed campaigns with mismatched draw identity cannot be reused",async()=>{
  const first=await sendAdminNotificationCampaign(input,"manual",contract());
  await state.repository.updateNotificationMetadata(first.notificationId,{adminOperationIdempotencyKey:"event-reward:draw-1:winner-notice:v1",campaignStatus:"sent",eventRewardDrawId:"other",eventSlug:"signup-reward"});
  state.mm.mockClear();await expect(sendAdminNotificationCampaign(input,"manual",contract())).rejects.toThrow(/일치하지 않아|충돌/);expect(state.mm).not.toHaveBeenCalled();
});
