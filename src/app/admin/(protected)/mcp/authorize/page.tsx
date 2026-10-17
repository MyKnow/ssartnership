import AdminShell from "@/components/admin/AdminShell";
import { McpAuthorizeView, McpUnavailable } from "@/components/admin/McpViews";
import { getMcpAdmin, mcpConsent } from "@/lib/mcp/consent.server";
import { getMcpRuntime } from "@/lib/mcp/runtime.server";
import { hasMcpScopePermission } from "@/lib/mcp/oauth/service";
export const dynamic="force-dynamic";
export default async function McpAuthorizePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const admin=await getMcpAdmin(); let data;
  try {
    if(!admin) throw new Error("no_session");
    const {oauth,config}=getMcpRuntime(), {value,client,scopes}=await oauth.validateAuthorization(await searchParams);
    if(scopes.some(scope=>!hasMcpScopePermission(admin,scope))) throw new Error("scope_denied");
    const authorization=JSON.stringify(value);
    data={clientName:client.name,origin:config.origin,scopes,authorization,csrf:mcpConsent(admin.id,"authorize",authorization)};
  } catch { data=null; }
  return <AdminShell title="AI 연결 승인">{data?<McpAuthorizeView {...data}/>:<McpUnavailable/>}</AdminShell>;
}
