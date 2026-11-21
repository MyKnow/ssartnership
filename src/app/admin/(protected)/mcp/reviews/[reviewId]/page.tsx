import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { z } from "zod";
import AdminShell from "@/components/admin/AdminShell";
import { McpReviewView, McpUnavailable } from "@/components/admin/McpViews";
import { getMcpAdmin, mcpConsent } from "@/lib/mcp/consent.server";
import { getMcpRuntime } from "@/lib/mcp/runtime.server";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { hasMcpScopePermission, hashCredential } from "@/lib/mcp/oauth/service";
export const dynamic="force-dynamic";
export default async function McpReviewPage({params}:{params:Promise<{reviewId:string}>}) {
  const admin=await getMcpAdmin(); let data;
  try {
    const id=z.string().uuid().parse((await params).reviewId), {repository,oauth}=getMcpRuntime();
    const review=await repository.getReview(id),grant=review&&await repository.getGrant(review.grantId);
    if(!admin||!review||!grant||review.adminId!==admin.id||grant.adminId!==admin.id||!grant.scopes.includes("showcase:moderate")||!hasMcpScopePermission(admin,"showcase:moderate")||review.expiresAt<=Date.now()) throw new Error("unavailable");
    await oauth.fresh(grant);
    const item=(await projectShowcaseRepository.listAdminFeedback()).find(x=>x.id===review.feedbackId);
    if(!item||(!review.executed&&(item.hidden!==review.previousHidden||hashCredential(item.body)!==review.previousBodyHash))) throw new Error("stale");
    data={projectTitle:item.projectTitle,body:item.body,previousHidden:review.previousHidden,hidden:review.hidden,approved:Boolean(review.approved),executed:Boolean(review.executed),csrf:mcpConsent(admin.id,"approve",review.id),reviewId:review.id,expiresAt:formatKoreanDateTimeToMinute(new Date(review.expiresAt))};
  } catch { data=null; }
  return <AdminShell title="리뷰 변경 검토">{data?<McpReviewView {...data}/>:<McpUnavailable message="검토가 만료됐거나 상태가 달라졌어요. AI 앱에서 변경 검토를 다시 요청해 주세요."/>}</AdminShell>;
}
