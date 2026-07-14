"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { isValidEmail } from "@/lib/validation";

export default function ManualMemberEmailResetForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function requestReset() {
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setMessage({ tone: "error", text: "이메일 주소를 확인해 주세요." });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/member-password-action/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "비밀번호 재설정 요청을 처리하지 못했습니다.");
      setMessage({ tone: "info", text: data.message ?? "해당 이메일 계정이 있으면 비밀번호 재설정 링크를 보냈습니다." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "비밀번호 재설정 요청을 처리하지 못했습니다." });
    } finally {
      setPending(false);
    }
  }

  return <div className="mt-5 grid gap-4"><p className="text-sm text-muted-foreground">관리자가 이메일로 초대한 회원은 인증된 이메일에서 비밀번호 재설정 링크를 받을 수 있습니다.</p><label className="grid gap-2 text-sm font-medium text-foreground">가입 이메일<Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label><Button type="button" onClick={requestReset} loading={pending} loadingText="전송 중">재설정 링크 보내기</Button>{message ? <FormMessage variant={message.tone}>{message.text}</FormMessage> : null}</div>;
}
