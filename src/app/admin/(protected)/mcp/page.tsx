import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Button from "@/components/ui/Button";
import McpClientForm from "@/components/admin/McpClientForm";
import { McpUnavailable } from "@/components/admin/McpViews";
import { getMcpAdmin, mcpConsent } from "@/lib/mcp/consent.server";
import { getMcpRuntime } from "@/lib/mcp/runtime.server";
import { MCP_SCOPE_LABELS } from "@/lib/mcp/oauth/contracts";
import { canAdmin } from "@/lib/admin-permissions";
export const dynamic="force-dynamic";
export default async function McpConnectionsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const admin=await getMcpAdmin();
  if(!admin) return <McpUnavailable/>;
  let data;
  try {
    const {repository,config}=getMcpRuntime();
    const [grants,clients,params]=await Promise.all([repository.listGrants(admin.id),repository.listClients(admin.id),searchParams]);
    const names=new Map((await Promise.all(grants.map(g=>repository.getClient(g.clientId)))).filter(x=>x!==null).map(x=>[x.id,x.name]));
    data={grants,clients,params,names,config};
  } catch { data=null; }
  if(!data) return <AdminShell title="AI 연결 관리"><McpUnavailable message="연결 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."/></AdminShell>;
  const {grants,clients,params,names,config}=data;
  return <AdminShell title="AI 연결 관리"><div className="grid min-w-0 gap-6">
      <AdminPageHeader eyebrow="관리 설정" title="AI 연결 관리" description="싸트너십 정보를 조회하고 승인한 운영 작업을 실행할 AI 앱을 관리해요."/>
      {params.error?<p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-base leading-7">요청을 처리하지 못했어요. 입력과 로그인 상태를 확인하고 다시 시도해 주세요.</p>:null}
      <section className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6"><h2 className="text-lg font-bold">MCP 서버 주소</h2><p className="break-all rounded-xl bg-surface-muted p-3 text-base">{config.resource}</p><p className="text-sm leading-6 text-muted-foreground">AI 앱에 서버 주소와 등록한 클라이언트 ID를 입력한 뒤, 이 사이트에서 연결을 허용해 주세요. 앱이 안내하는 콜백 주소는 아래에 먼저 등록해야 해요.</p></section>
      <section className="grid min-w-0 gap-4" aria-labelledby="mcp-connections-heading"><h2 id="mcp-connections-heading" className="text-lg font-bold">내 연결</h2>{grants.filter(g=>!g.revoked).length===0?<p className="rounded-2xl border border-border bg-surface p-5 text-base leading-7 text-muted-foreground">연결한 AI 앱이 없어요. 등록한 앱에서 연결을 시작해 주세요.</p>:grants.filter(g=>!g.revoked).map(g=><article key={g.id} className="grid min-w-0 gap-4 rounded-2xl border border-border bg-surface p-5"><h3 className="break-words text-lg font-semibold">{names.get(g.clientId)??"AI 앱"}</h3><ul className="grid gap-1 text-sm leading-6 text-muted-foreground">{g.scopes.map(s=><li key={s}>{MCP_SCOPE_LABELS[s]}</li>)}</ul><p className="text-sm text-muted-foreground">만료: {formatKoreanDateTimeToMinute(new Date(g.expiresAt))}</p><form action="/api/mcp/consent" method="post"><input type="hidden" name="purpose" value="revoke"/><input type="hidden" name="grantId" value={g.id}/><input type="hidden" name="csrf" value={mcpConsent(admin.id,"revoke",g.id)}/><Button type="submit" variant="danger">연결 철회</Button></form></article>)}</section>
      {admin.permissionId==="super_admin"&&canAdmin(admin.permissions,"admin_management","create")?<section className="grid min-w-0 gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="mcp-register-heading"><h2 id="mcp-register-heading" className="text-lg font-bold">새 AI 클라이언트</h2><McpClientForm csrf={mcpConsent(admin.id,"register","register")}/></section>:null}
      {clients.length?<section className="grid min-w-0 gap-4" aria-labelledby="mcp-clients-heading"><h2 id="mcp-clients-heading" className="text-lg font-bold">내가 등록한 클라이언트</h2>{clients.map(c=><article key={c.id} className="grid min-w-0 gap-2 rounded-2xl border border-border bg-surface p-5"><h3 className="text-base font-semibold">{c.name}</h3><p className="break-all text-sm leading-6">클라이언트 ID: {c.id}</p><p className="break-all text-sm leading-6 text-muted-foreground">콜백: {c.redirectUri}</p></article>)}</section>:null}
    </div></AdminShell>;
}
