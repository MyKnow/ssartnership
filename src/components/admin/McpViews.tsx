import Link from "next/link";
import { FOCUS_RING_ON_BACKGROUND_CLASS_NAME } from "@/components/ui/focus-ring";
import Button from "@/components/ui/Button";
import { MCP_SCOPE_LABELS } from "@/lib/mcp/oauth/contracts";
import McpAuthorizationForm from "./McpAuthorizationForm";

export function McpUnavailable({message="요청을 확인할 수 없어요. AI 앱에서 연결을 다시 시작해 주세요."}:{message?:string}) {
  return <section className="grid min-w-0 gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" role="alert"><h1 className="text-xl font-bold">연결을 확인해 주세요</h1><p className="text-base leading-7 text-muted-foreground">{message}</p><Link className={`text-primary underline underline-offset-4 ${FOCUS_RING_ON_BACKGROUND_CLASS_NAME}`} href="/admin/mcp">AI 연결 관리로 돌아가기</Link></section>;
}
export function McpAuthorizeView({clientName,origin,scopes,csrf,authorization}:{clientName:string;origin:string;scopes:string[];csrf:string;authorization:string}) {
  return <section className="grid min-w-0 gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-8" aria-labelledby="mcp-consent-heading">
    <div className="grid gap-2"><p className="text-sm font-semibold text-primary">싸트너십 AI 연결</p><h1 id="mcp-consent-heading" className="text-2xl font-bold break-words">{clientName} 연결을 허용할까요?</h1><p className="text-base leading-7 text-muted-foreground">허용한 기능만 사용할 수 있고, 연결 관리에서 언제든 철회할 수 있어요.</p><p className="break-all text-sm text-muted-foreground">연결할 사이트: {origin}</p></div>
    <ul className="grid gap-3 rounded-xl bg-surface-muted p-4">{scopes.map(scope=><li key={scope} className="text-base leading-7">{MCP_SCOPE_LABELS[scope] ?? scope}</li>)}</ul>
    {scopes.includes("showcase:moderate")?<p className="text-sm leading-6 text-muted-foreground">리뷰 숨김·복원은 변경 검토 화면에서 한 번 더 승인해야 실행돼요.</p>:null}
    <McpAuthorizationForm csrf={csrf} authorization={authorization}/>
  </section>;
}
export function McpReviewView({projectTitle,body,previousHidden,hidden,approved,executed,csrf,reviewId,expiresAt}:{projectTitle:string;body:string;previousHidden:boolean;hidden:boolean;approved:boolean;executed:boolean;csrf:string;reviewId:string;expiresAt:string}) {
  return <section className="grid min-w-0 gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-8" aria-labelledby="mcp-review-heading">
    <div className="grid gap-2"><h1 id="mcp-review-heading" className="text-2xl font-bold">리뷰 공개 상태 변경 검토</h1><p className="text-base leading-7 text-muted-foreground">{projectTitle}</p></div>
    <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-surface-muted p-4 text-base leading-7">{body}</blockquote>
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-base"><dt className="text-muted-foreground">현재</dt><dd>{previousHidden?"숨김":"공개"}</dd><dt className="text-muted-foreground">변경 후</dt><dd className="font-semibold">{hidden?"숨김":"공개"}</dd><dt className="text-muted-foreground">만료</dt><dd className="break-words">{expiresAt}</dd></dl>
    {executed?<p role="status" className="text-base leading-7">변경을 실행했어요.</p>:approved?<p role="status" className="text-base leading-7">승인했어요. AI 앱으로 돌아가 실행을 요청해 주세요.</p>:<><p className="text-sm leading-6 text-muted-foreground">승인한 변경은 표시된 만료 시각 전까지만 실행할 수 있어요. 리뷰 상태가 달라지면 새 검토가 필요해요.</p><form action="/api/mcp/consent" method="post"><input type="hidden" name="purpose" value="approve"/><input type="hidden" name="reviewId" value={reviewId}/><input type="hidden" name="csrf" value={csrf}/><Button type="submit">이 변경 승인</Button></form></>}
    <Link href="/admin/mcp" className={`text-primary underline underline-offset-4 ${FOCUS_RING_ON_BACKGROUND_CLASS_NAME}`}>AI 연결 관리</Link>
  </section>;
}
