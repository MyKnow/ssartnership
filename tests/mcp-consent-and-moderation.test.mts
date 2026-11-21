import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMcpConsentToken, verifyMcpConsentToken } from "../src/lib/mcp/oauth/csrf.ts";
import { getMcpConfig, isMcpOriginAllowed } from "../src/lib/mcp/config.ts";
import { createMcpOAuthService } from "../src/lib/mcp/oauth/service.ts";
import { MockMcpOAuthRepository } from "../src/lib/mcp/oauth/repository.mock.ts";
import { createMcpModerationService } from "../src/lib/mcp/moderation-service.ts";
import { createEmptyAdminPermissionMatrix } from "../src/lib/admin-permissions.ts";
import type { AdminAccount } from "../src/lib/admin-accounts.ts";

test("consent binds actor, purpose, exact request and expiry; rejects tamper and wrong environment", () => {
  const secret="s".repeat(40), now=100000, token=createMcpConsentToken(secret,"owner","authorize","client/request",now);
  assert.ok(verifyMcpConsentToken(secret,token,"owner","authorize","client/request",now));
  for (const args of [["other","authorize","client/request"],["owner","approve","client/request"],["owner","authorize","other"]]) assert.equal(verifyMcpConsentToken(secret,token,...args as [string,string,string],now),null);
  assert.equal(verifyMcpConsentToken(secret,token+"x","owner","authorize","client/request",now),null);
  assert.equal(verifyMcpConsentToken("different",token,"owner","authorize","client/request",now),null);
  assert.equal(verifyMcpConsentToken(secret,token,"owner","authorize","client/request",now+600001),null);
});
test("origin is pinned and consent requires exact origin, even when request URL host is forged", () => {
  assert.throws(()=>getMcpConfig({NODE_ENV:"production"}));
  assert.throws(()=>getMcpConfig({NEXT_PUBLIC_SITE_URL:"https://service.example/path"}));
  const config=getMcpConfig({NEXT_PUBLIC_SITE_URL:"https://service.example"});
  assert.equal(config.resource,"https://service.example/api/mcp");
  assert.equal(isMcpOriginAllowed(new Request("https://evil.example",{headers:{origin:"https://service.example"}}),config.origin,true),true);
  for (const origin of ["null","https://evil.example","https://service.example:8443"]) assert.equal(isMcpOriginAllowed(new Request(config.resource,{headers:{origin}}),config.origin),false);
  assert.equal(isMcpOriginAllowed(new Request(config.resource),config.origin,true),false);
});
async function fixture() {
  let clock=Date.now(), hidden=false, calls=0;
  const permissions=createEmptyAdminPermissionMatrix(); permissions.events.update=true;
  const account={id:"owner",isActive:true,permissionId:"super_admin",permissionVersion:1,mustChangePassword:false,permissions} as AdminAccount;
  const showcase={listAdminFeedback:async()=>[{id:"feedback-1",projectId:"project-1",projectTitle:"Synthetic project",body:"Anonymous review",hidden,createdAt:"NEVER_RETURN"}],setFeedbackHidden:async(input:{hidden:boolean})=>{calls++;hidden=input.hidden;}};
  const repository=new MockMcpOAuthRepository(showcase,()=>clock);
  const grant={id:randomUUID(),adminId:account.id,clientId:randomUUID(),permissionVersion:1,scopes:["showcase:moderate"],resource:"https://service.example/api/mcp",createdAt:clock,expiresAt:clock+1000000};
  await repository.createGrant(grant,{kind:"code",hash:"synthetic",grantId:grant.id,expiresAt:clock+100});
  const oauth=createMcpOAuthService({repository,resource:grant.resource,getAdminAccount:async()=>account,now:()=>clock});
  const service=createMcpModerationService({oauth,repository,showcase,origin:"https://service.example",now:()=>clock});
  return {account,repository,grant,service,externalChange:()=>{hidden=true;},calls:()=>calls,advance:()=>{clock+=300001;}};
}
test("moderation requires human approval, binds grant/client/actor and executes once under concurrency",async()=>{
  const f=await fixture();
  assert.equal(JSON.stringify(await f.service.list(f.grant,{})).includes("NEVER_RETURN"),false);
  const preview=await f.service.preview(f.grant,{feedbackId:"feedback-1",hidden:true});
  assert.ok(preview.ok && preview.data);
  const input={reviewId:preview.data.reviewId};
  assert.deepEqual(await f.service.commit(f.grant,input),{ok:false,code:"forbidden"});
  assert.equal(await f.repository.approveReview("other",input.reviewId),false);
  await f.repository.approveReview(f.grant.adminId,input.reviewId);
  assert.deepEqual(await f.service.commit({...f.grant,clientId:randomUUID()},input),{ok:false,code:"forbidden"});
  const results=await Promise.all([f.service.commit(f.grant,input),f.service.commit(f.grant,input)]);
  assert.deepEqual(results.map(x=>x.data?.status).sort(),["executed","replayed"]);
  assert.equal(f.calls(),1);
});
test("stale review, expiry, scope loss and permission revocation cannot write",async()=>{
  for (const change of ["state","expiry","permission","scope"] as const) {
    const f=await fixture(), preview=await f.service.preview(f.grant,{feedbackId:"feedback-1",hidden:true});
    assert.ok(preview.ok && preview.data); await f.repository.approveReview(f.grant.adminId,preview.data.reviewId);
    if(change==="state") f.externalChange(); if(change==="expiry") f.advance(); if(change==="permission") f.account.permissions.events.update=false; if(change==="scope") f.grant.scopes=[];
    const result=await f.service.commit(f.grant,{reviewId:preview.data.reviewId}).catch(()=>({ok:false}));
    assert.equal(result.ok,false); assert.equal(f.calls(),0);
  }
});
