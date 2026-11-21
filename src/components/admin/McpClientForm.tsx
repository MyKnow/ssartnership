"use client";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { FOCUS_RING_ON_BACKGROUND_CLASS_NAME } from "@/components/ui/focus-ring";
import { clientInputSchema, MCP_CLIENT_NAME_LIMIT, MCP_CALLBACK_URL_LIMIT } from "@/lib/mcp/oauth/contracts";

export default function McpClientForm({csrf}:{csrf:string}) {
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [pending,setPending]=useState(false);
  function submit(event:FormEvent<HTMLFormElement>) {
    const form=event.currentTarget, data=new FormData(form);
    const result=clientInputSchema.safeParse({name:data.get("name"),redirectUri:data.get("redirectUri")});
    if(!result.success) {
      event.preventDefault();
      const fields:Record<string,string>={};
      for(const issue of result.error.issues) {
        const name=String(issue.path[0]);
        fields[name]=name==="name"?"이름을 2~80자로 입력해 주세요.":"HTTPS 또는 이 기기의 localhost 콜백 주소를 입력해 주세요.";
      }
      setErrors(fields); const first=form.elements.namedItem(Object.keys(fields)[0]); if(first instanceof HTMLElement) first.focus();
      return;
    }
    setErrors({});setPending(true);
  }
  return <form action="/api/mcp/consent" method="post" onSubmit={submit} noValidate className="grid min-w-0 gap-4">
    <input type="hidden" name="purpose" value="register"/><input type="hidden" name="csrf" value={csrf}/>
    <div className="grid gap-2"><label htmlFor="mcp-client-name" className="text-sm font-semibold">AI 연결 이름</label><input id="mcp-client-name" name="name" maxLength={MCP_CLIENT_NAME_LIMIT} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name?"mcp-name-error":undefined} className={`min-h-11 min-w-0 rounded-xl border border-border bg-surface px-3 text-base ${FOCUS_RING_ON_BACKGROUND_CLASS_NAME}`} placeholder="예: 내 Claude 연결"/>{errors.name?<p id="mcp-name-error" className="text-sm text-danger" role="alert">{errors.name}</p>:null}</div>
    <div className="grid gap-2"><label htmlFor="mcp-callback" className="text-sm font-semibold">콜백 주소</label><input id="mcp-callback" name="redirectUri" type="url" maxLength={MCP_CALLBACK_URL_LIMIT} required aria-invalid={Boolean(errors.redirectUri)} aria-describedby="mcp-callback-help mcp-callback-error" className={`min-h-11 min-w-0 rounded-xl border border-border bg-surface px-3 text-base ${FOCUS_RING_ON_BACKGROUND_CLASS_NAME}`}/><p id="mcp-callback-help" className="text-sm leading-6 text-muted-foreground">AI 앱이 안내하는 OAuth 콜백 주소를 그대로 등록해 주세요.</p><p id="mcp-callback-error" className="text-sm text-danger" role={errors.redirectUri?"alert":undefined}>{errors.redirectUri}</p></div>
    <Button type="submit" disabled={pending}>{pending?"등록 중…":"클라이언트 등록"}</Button>
  </form>;
}
