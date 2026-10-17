import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpOAuthService, pkceChallenge } from "../src/lib/mcp/oauth/service.ts";
import { MockMcpOAuthRepository } from "../src/lib/mcp/oauth/repository.mock.ts";
import { createMcpReadService } from "../src/lib/mcp/read-service.ts";
import { createMcpModerationService } from "../src/lib/mcp/moderation-service.ts";
import { createMcpHttpService, mcpMetadata, readMcpForm } from "../src/lib/mcp/http.ts";
import { getMcpConfig } from "../src/lib/mcp/config.ts";
import { createEmptyAdminPermissionMatrix } from "../src/lib/admin-permissions.ts";
import type { AdminAccount } from "../src/lib/admin-accounts.ts";

async function fixture(scope="catalog:read") {
  const permissions=createEmptyAdminPermissionMatrix(); permissions.brands.read=true;permissions.events.read=true;permissions.events.update=true;permissions.admin_management.create=true;
  const account={id:"owner",isActive:true,permissionId:"super_admin",permissionVersion:1,mustChangePassword:false,permissions} as AdminAccount;
  const config=getMcpConfig({NEXT_PUBLIC_SITE_URL:"https://service.example"}), repository=new MockMcpOAuthRepository();
  const oauth=createMcpOAuthService({repository,resource:config.resource,getAdminAccount:async()=>account});
  const reads=createMcpReadService({getAdminAccount:async()=>account,partners:{getPublicDirectoryPartners:async()=>[],getPartnerById:async()=>null},showcase:{listOwnerFeedback:async()=>[]}});
  const moderation=createMcpModerationService({oauth,repository,showcase:{listAdminFeedback:async()=>[]},origin:config.origin});
  const audits:string[]=[]; let quota:"ok"|"blocked"|"unavailable"="ok", auditFails=false;
  const http=createMcpHttpService({config,oauth,reads,moderation,quota:async()=>quota,audit:async(_grant,tool,outcome)=>{if(auditFails)throw new Error("PRIVATE_PROVIDER_ERROR");audits.push(`${tool}:${outcome}`);}});
  const client=await oauth.registerClient(account.id,{name:"Synthetic client",redirectUri:"https://client.example/callback"});
  const verifier="v".repeat(64),code=await oauth.authorize(account.id,{client_id:client.id,redirect_uri:client.redirectUri,response_type:"code",resource:config.resource,scope,code_challenge:pkceChallenge(verifier),code_challenge_method:"S256"},randomUUID());
  const exchange={client_id:client.id,redirect_uri:client.redirectUri,grant_type:"authorization_code",resource:config.resource,code_verifier:verifier,code};
  const response=await http.token(new Request(`${config.origin}/api/mcp/oauth/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(exchange)}));
  assert.equal(response.status,200); const tokens=await response.json();
  const request=(method:string,params:unknown={},header:Record<string,string>={})=>new Request(config.resource,{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream","MCP-Protocol-Version":"2025-11-25",authorization:`Bearer ${tokens.access_token}`,...header},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  return {config,oauth,http,repository,tokens,client,account,audits,request,block:()=>{quota="blocked";},failAudit:()=>{auditFails=true;}};
}
test("HTTP metadata and Bearer challenge discover pinned OAuth endpoints; cookies/query/origin never authenticate",async()=>{
  const f=await fixture(), metadata=await mcpMetadata(f.config,true).json(); assert.equal(metadata.resource,f.config.resource);
  const response=await f.http.mcp(new Request(f.config.resource,{method:"POST",headers:{cookie:"admin_session=not-a-token"}}));
  assert.equal(response.status,401);assert.match(response.headers.get("www-authenticate")!,/oauth-protected-resource\/api\/mcp/);
  assert.equal((await f.http.mcp(f.request("tools/list",{},{origin:"https://evil.example"}))).status,403);
  assert.equal((await f.http.mcp(new Request(`${f.config.resource}?access_token=${f.tokens.access_token}`,f.request("tools/list")))).status,401);
  assert.equal((await f.http.mcp(new Request(f.config.resource,{headers:{authorization:`Bearer ${f.tokens.access_token}`}}))).status,405);
});
test("legacy stateless transport lists only scoped tools and safely audits calls",async()=>{
  const f=await fixture(), list=await f.http.mcp(f.request("tools/list"));assert.equal(list.status,200);
  const body=await list.text();const json=body.startsWith("event:")?JSON.parse(body.split("data: ")[1]):JSON.parse(body);
  assert.deepEqual(json.result.tools.map((t:{name:string})=>t.name).sort(),["get_partner","search_partners"]);
  const result=await f.http.mcp(f.request("tools/call",{name:"search_partners",arguments:{}}));assert.equal(result.status,200);
  assert.match(await result.text(),/nextOffset/);assert.deepEqual(f.audits,["search_partners:requested","search_partners:completed"]);
  await f.oauth.revokeToken(f.client.id,f.tokens.access_token);
  assert.equal((await f.http.mcp(f.request("tools/list"))).status,401);
});
test("official v2 client negotiates, lists and calls the real HTTP handler",async()=>{
  const f=await fixture();
  const client=new Client({name:"ssartnership-contract-client",version:"1.0.0"});
  const transport=new StreamableHTTPClientTransport(new URL(f.config.resource),{authProvider:{token:async()=>f.tokens.access_token},fetch:async(input,init)=>f.http.mcp(new Request(input,init))});
  try {
    await client.connect(transport);
    const tools=await client.listTools();assert.equal(tools.tools.length,2);
    const result=await client.callTool({name:"search_partners",arguments:{query:"test"}});assert.equal(result.isError,false);
  } finally { await client.close(); }
});
test("quota, byte bounds, malformed/duplicate forms and audit failure fail closed without provider details",async()=>{
  const f=await fixture();
  const form=(value:string)=>new Request(f.config.resource,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:value});
  assert.equal((await readMcpForm(form(`resource=${encodeURIComponent(f.config.resource)}&resource=${encodeURIComponent(f.config.resource)}`),f.config.resource)).resource,f.config.resource);
  await assert.rejects(()=>readMcpForm(form(`resource=${encodeURIComponent(f.config.resource)}&resource=https://other.example`),f.config.resource));
  const bad=await f.http.token(new Request(`${f.config.origin}/api/mcp/oauth/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"client_id=a&client_id=b"}));assert.equal(bad.status,400);
  const oversized=new Request(f.config.resource,{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream",authorization:`Bearer ${f.tokens.access_token}`},body:"x".repeat(17000)});
  assert.equal((await f.http.mcp(oversized)).status,413);
  f.failAudit();const result=await f.http.mcp(f.request("tools/call",{name:"search_partners",arguments:{}}));const body=await result.text();assert.match(body,/unavailable/);assert.equal(body.includes("PRIVATE_PROVIDER_ERROR"),false);
  f.block();assert.equal((await f.http.mcp(f.request("tools/list"))).status,429);
});
