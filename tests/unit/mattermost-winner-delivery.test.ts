import { beforeEach, expect, it, vi } from "vitest";
import { MockNotificationRepository } from "@/lib/repositories/mock/notification-repository.mock";
const state=vi.hoisted(()=>({repository:null as unknown as MockNotificationRepository,post:vi.fn(),fallbacks:0,authError:null as unknown}));
vi.mock("@/lib/repositories",()=>({get notificationRepository(){return state.repository;}}));
vi.mock("@/lib/notification-templates/repository.server",()=>({resolveNotificationTemplate:async()=>({titleTemplate:"{{title}}",bodyTemplate:"{{body}}"})}));
vi.mock("@/lib/mattermost-senders/service",async(importOriginal)=>({...await importOriginal<object>(),
  withActiveMattermostSenderForGeneration:async(_generation:number,operation:(session:unknown)=>Promise<unknown>)=>{
    if(state.authError) throw state.authError;
    const session={sendDirectMessage:state.post};
    try{return await operation(session);}catch{state.fallbacks++;return operation(session);}
  },
}));
import { sendMattermostCampaignDeliveries } from "@/lib/admin-notification-ops-delivery";
import { MattermostApiError } from "@/lib/mattermost/client";
const send=()=>sendMattermostCampaignDeliveries({notificationId:"notice",notificationType:"announcement",title:"안내",body:"당첨",retrySafe:true,members:[{id:"a",mattermostUserId:"mm-a",isStaff:false,sourceYears:[],generation:15,senderGeneration:15}]});
beforeEach(()=>{delete (globalThis as {__mockNotificationStore?:unknown}).__mockNotificationStore;state.repository=new MockNotificationRepository();state.post.mockReset();state.fallbacks=0;state.authError=null;});
it("an uncertain post never escapes the sender callback to trigger fallback",async()=>{
  state.post.mockRejectedValue(new MattermostApiError("timeout"));await send();await send();expect(state.post).toHaveBeenCalledTimes(1);expect(state.fallbacks).toBe(0);
});
it("success annotation failure cannot trigger another sender or post",async()=>{
  state.post.mockResolvedValue({id:"post-a"});vi.spyOn(state.repository,"annotateSentNotificationDelivery").mockRejectedValue(new Error("write failure"));
  await send();await send();expect(state.post).toHaveBeenCalledTimes(1);expect(state.fallbacks).toBe(0);
});
it("authentication failure before any post does not invoke a recipient operation",async()=>{
  state.authError=new MattermostApiError("unauthorized",401);await send();expect(state.post).not.toHaveBeenCalled();expect(state.fallbacks).toBe(0);
});
