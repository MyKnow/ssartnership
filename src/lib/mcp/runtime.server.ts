import "server-only";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getAdminAccountByIdUncached } from "@/lib/admin-accounts";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { selectRuntimeDataAccess, createUnavailableDataAccessProxy } from "@/lib/runtime-data-access";
import { allowsLocalFixtures } from "@/lib/local-fixture-policy.mjs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/client-ip";
import { createInMemoryRateLimiter } from "@/lib/in-memory-rate-limit";
import { MockMcpOAuthRepository } from "./oauth/repository.mock";
import { SupabaseMcpOAuthRepository } from "./oauth/repository.supabase";
import type { McpOAuthRepository } from "./oauth/contracts";
import { createMcpOAuthService, hashCredential } from "./oauth/service";
import { getMcpConfig } from "./config";
import { createMcpModerationService } from "./moderation-service";
import { createMcpHttpService } from "./http";
import { mcpReadService } from "./read-service.server";

const selection=selectRuntimeDataAccess({capability:"admin"});
const local=selection.source === "mock" && allowsLocalFixtures(process.env);
// Shared by fixture pages and route bundles; never selected in a deployed build.
const globals=globalThis as typeof globalThis & {ssartnershipMcpMock?:MockMcpOAuthRepository};
export const mcpOAuthRepository: McpOAuthRepository = local
  ? globals.ssartnershipMcpMock ??= new MockMcpOAuthRepository(projectShowcaseRepository)
  : selection.source === "supabase" ? new SupabaseMcpOAuthRepository()
    : createUnavailableDataAccessProxy<McpOAuthRepository>({...selection,source:"unavailable"});
const localQuota=createInMemoryRateLimiter({maxAttempts:120,windowMs:60_000,blockMs:60_000,maxBuckets:1000});
export function getMcpRuntime() {
  const config=getMcpConfig();
  const oauth=createMcpOAuthService({repository:mcpOAuthRepository,resource:config.resource,getAdminAccount:getAdminAccountByIdUncached});
  const moderation=createMcpModerationService({oauth,repository:mcpOAuthRepository,showcase:projectShowcaseRepository,origin:config.origin});
  const http=createMcpHttpService({config,oauth,reads:mcpReadService,moderation,
    async quota(request,identity) {
      const key=hashCredential(identity?`mcp:admin:${identity}`:`mcp:ip:${getClientIp(request.headers) ?? "unknown"}`);
      if(local) return localQuota.consume(key).ok?"ok":"blocked";
      try {
        const {data,error}=await getSupabaseAdminClient().rpc("mcp_consume_quota",{p_key:key,p_limit:identity?120:60});
        return error?"unavailable":data===true?"ok":"blocked";
      } catch { return "unavailable"; }
    },
    async audit(grant,tool,outcome) {
      if(local) return;
      const {error}=await getSupabaseAdminClient().from("admin_audit_logs").insert({request_id:randomUUID(),actor_type:"admin",actor_id:grant.adminId,action:"mcp_tool_call",path:"/api/mcp",target_type:"mcp_connection",target_id:grant.id,properties:{tool,outcome,clientId:grant.clientId}});
      if(error) throw new Error("mcp_audit_unavailable");
    },
    afterWrite() {
      revalidatePath("/admin/events/project-showcase/feedback");
      revalidatePath("/(site)/events/project-showcase","layout");
    },
  });
  return {config,oauth,moderation,http,repository:mcpOAuthRepository};
}
