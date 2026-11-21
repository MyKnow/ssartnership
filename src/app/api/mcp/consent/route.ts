import { z } from "zod";
import { readSessionSecret } from "@/lib/session-secrets";
import { getMcpAdmin } from "@/lib/mcp/consent.server";
import { getMcpRuntime } from "@/lib/mcp/runtime.server";
import { verifyMcpConsentToken } from "@/lib/mcp/oauth/csrf";
import { isMcpOriginAllowed } from "@/lib/mcp/config";
import { hasMcpScopePermission } from "@/lib/mcp/oauth/service";
import { mcpJson, readMcpForm } from "@/lib/mcp/http";
export const runtime="nodejs";
export async function POST(request:Request) {
  const {config,oauth,repository,http}=getMcpRuntime();
  if(!isMcpOriginAllowed(request,config.origin,true)) return mcpJson({error:"access_denied"},403);
  const admin=await getMcpAdmin();
  if(!admin) return mcpJson({error:"access_denied"},403);
  const limited=await http.limit(request,admin.id);if(limited) return limited;
  try {
    const form=await readMcpForm(request), purpose=form.purpose;
    let binding="", authorization;
    if(purpose==="authorize") {
      authorization=await oauth.validateAuthorization(JSON.parse(form.authorization));
      binding=JSON.stringify(authorization.value);
    } else if(purpose==="register") binding="register";
    else if(purpose==="revoke") binding=z.string().uuid().parse(form.grantId);
    else if(purpose==="approve") binding=z.string().uuid().parse(form.reviewId);
    else return mcpJson({error:"invalid_request"},400);
    const nonce=verifyMcpConsentToken(readSessionSecret("admin-session"),form.csrf??"",admin.id,purpose,binding);
    if(!nonce) return mcpJson({error:"access_denied"},403);
    if(purpose==="authorize"&&authorization) {
      if(!["allow","deny"].includes(form.decision)) return mcpJson({error:"invalid_request"},400);
      const callback=new URL(authorization.value.redirect_uri);
      if(form.decision==="deny") callback.searchParams.set("error","access_denied");
      else callback.searchParams.set("code",await oauth.authorize(admin.id,authorization.value,nonce));
      if(authorization.value.state!==undefined) callback.searchParams.set("state",authorization.value.state);
      callback.searchParams.set("iss",config.origin);
      if(request.headers.get("accept")?.includes("application/json")) return mcpJson({redirectTo:callback.href});
      const href=callback.href.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      return new Response(`<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>AI 연결 확인</title><body><main><h1>연결 요청을 처리했어요</h1><p><a href="${href}" rel="noreferrer">AI 앱으로 돌아가기</a></p></main></body></html>`,{status:200,headers:{"content-type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
    }
    let destination="/admin/mcp";
    if(purpose==="register") await oauth.registerClient(admin.id,{name:form.name,redirectUri:form.redirectUri},nonce);
    if(purpose==="revoke") await repository.revokeGrant(admin.id,binding);
    if(purpose==="approve") {
      const review=await repository.getReview(binding),grant=review&&await repository.getGrant(review.grantId);
      if(!review||!grant||review.adminId!==admin.id||grant.adminId!==admin.id||!grant.scopes.includes("showcase:moderate")||!hasMcpScopePermission(admin,"showcase:moderate")) return mcpJson({error:"access_denied"},403);
      await oauth.fresh(grant);
      if(!await repository.approveReview(admin.id,binding)) return mcpJson({error:"invalid_request"},400);
      destination=`/admin/mcp/reviews/${binding}`;
    }
    return new Response(null,{status:303,headers:{Location:`${config.origin}${destination}`,"Cache-Control":"no-store"}});
  } catch { return new Response(null,{status:303,headers:{Location:`${config.origin}/admin/mcp?error=invalid_request`,"Cache-Control":"no-store"}}); }
}
