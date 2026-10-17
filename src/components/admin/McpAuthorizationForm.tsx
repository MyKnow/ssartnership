"use client";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
export default function McpAuthorizationForm({csrf,authorization}:{csrf:string;authorization:string}) {
  const [pending,setPending]=useState(false),[error,setError]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(pending) return;
    const form=new FormData(event.currentTarget), submitter=(event.nativeEvent as SubmitEvent).submitter;
    if(!(submitter instanceof HTMLButtonElement)) return;
    form.set("decision",submitter.value);
    setPending(true);setError(false);
    try {
      const response=await fetch("/api/mcp/consent",{method:"POST",headers:{accept:"application/json","content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams([...form.entries()].map(([key,value])=>[key,String(value)])),redirect:"error"});
      const result=await response.json();
      if(!response.ok||typeof result.redirectTo!=="string") throw new Error("blocked");
      // A top-level navigation preserves the site's form-action 'self' policy.
      window.location.assign(result.redirectTo);
    } catch {setPending(false);setError(true);}
  }
  return <form action="/api/mcp/consent" method="post" onSubmit={submit} className="grid gap-3">
    <input type="hidden" name="purpose" value="authorize"/><input type="hidden" name="authorization" value={authorization}/><input type="hidden" name="csrf" value={csrf}/>
    {error?<p role="alert" className="text-sm leading-6 text-danger">연결을 처리하지 못했어요. AI 앱에서 연결을 다시 시작해 주세요.</p>:null}
    <div className="flex flex-wrap gap-3"><Button type="submit" name="decision" value="allow" disabled={pending}>{pending?"처리 중…":"연결 허용"}</Button><Button type="submit" name="decision" value="deny" variant="secondary" disabled={pending}>거절</Button></div>
  </form>;
}
