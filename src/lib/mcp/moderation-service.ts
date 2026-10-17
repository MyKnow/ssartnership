import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ProjectShowcaseRepository } from "../project-showcase/repository.ts";
import type { McpGrant, McpOAuthRepository } from "./oauth/contracts.ts";
import type { createMcpOAuthService } from "./oauth/service.ts";
import { hasMcpScopePermission, hashCredential, McpOAuthError } from "./oauth/service.ts";

export const moderationListSchema = z.strictObject({ hidden: z.boolean().optional(), offset: z.number().int().min(0).max(500).default(0), limit: z.number().int().min(1).max(100).default(20) });
export const moderationPreviewSchema = z.strictObject({ feedbackId: z.string().min(1).max(120).regex(/^[a-z0-9_-]+$/i), hidden: z.boolean() });
export const moderationCommitSchema = z.strictObject({ reviewId: z.string().uuid() });
export function createMcpModerationService(deps: {
  oauth: ReturnType<typeof createMcpOAuthService>; repository: McpOAuthRepository;
  showcase: Pick<ProjectShowcaseRepository,"listAdminFeedback">; origin: string; now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  async function authorize(grant: McpGrant) {
    const account = await deps.oauth.fresh(grant);
    if (!grant.scopes.includes("showcase:moderate") || !hasMcpScopePermission(account,"showcase:moderate")) throw new McpOAuthError("access_denied");
  }
  return {
    async list(grant: McpGrant, input: unknown) {
      await authorize(grant);
      const parsed = moderationListSchema.safeParse(input);
      if (!parsed.success) return { ok:false,code:"invalid_input" };
      const {offset,limit,hidden} = parsed.data;
      const items = await deps.showcase.listAdminFeedback({hidden});
      return { ok:true,data:{ items:items.slice(offset,offset+limit).map(({id,projectTitle,body,hidden})=>({id,projectTitle,body,hidden})), nextOffset:items.length>offset+limit?offset+limit:null } };
    },
    async preview(grant: McpGrant, input: unknown) {
      await authorize(grant);
      const parsed = moderationPreviewSchema.safeParse(input);
      if (!parsed.success) return { ok:false,code:"invalid_input" };
      const item = (await deps.showcase.listAdminFeedback()).find(x=>x.id === parsed.data.feedbackId);
      if (!item) return { ok:false,code:"not_found" };
      const review = { id:randomUUID(),grantId:grant.id,adminId:grant.adminId,clientId:grant.clientId,feedbackId:item.id,previousHidden:item.hidden,previousBodyHash:hashCredential(item.body),hidden:parsed.data.hidden,expiresAt:now()+5*60_000 };
      await deps.repository.createReview(review);
      return { ok:true,data:{ reviewId:review.id,approvalUrl:`${deps.origin}/admin/mcp/reviews/${review.id}`,expiresAt:review.expiresAt,projectTitle:item.projectTitle,body:item.body,before:{hidden:item.hidden},after:{hidden:review.hidden},requiresHumanApproval:true } };
    },
    async commit(grant: McpGrant,input: unknown) {
      await authorize(grant);
      const parsed = moderationCommitSchema.safeParse(input);
      if (!parsed.success) return { ok:false,code:"invalid_input" };
      const result = await deps.repository.commitReview(grant.adminId,grant.id,grant.clientId,parsed.data.reviewId);
      return result === "executed" || result === "replayed" ? { ok:true,data:{status:result} } : { ok:false,code:result };
    },
  };
}
