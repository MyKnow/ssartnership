"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";

type Message = {
  tone: "error" | "info";
  text: string;
};

export default function GraduatePasswordResetForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function sendCode() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/graduate-verification/password-reset/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "인증 코드를 보내지 못했습니다.");
      }
      setCodeSent(true);
      setMessage({
        tone: "info",
        text: data.message ?? "해당 이메일 계정이 있으면 인증 코드를 보냈습니다.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "인증 코드를 보내지 못했습니다.",
      });
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/graduate-verification/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "이메일 인증을 완료하지 못했습니다.");
      }
      setMessage({
        tone: "info",
        text: data.message ?? "계정이 있으면 비밀번호 재설정 링크를 이메일로 보냈습니다.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "이메일 인증을 완료하지 못했습니다.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 grid gap-4">
      <p className="text-sm text-muted-foreground">
        수료생 이메일로 6자리 인증 코드를 확인한 뒤 새 비밀번호 설정 링크를 보냅니다.
      </p>
      <label className="grid gap-2 text-sm font-medium text-foreground">
        수료생 이메일
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
      </label>
      {codeSent ? (
        <label className="grid gap-2 text-sm font-medium text-foreground">
          6자리 인증 코드
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={codeSent ? "secondary" : "primary"}
          loading={pending}
          loadingText="전송 중"
          onClick={sendCode}
        >
          {codeSent ? "인증 코드 다시 보내기" : "인증 코드 보내기"}
        </Button>
        {codeSent ? (
          <Button
            type="button"
            loading={pending}
            loadingText="확인 중"
            onClick={verifyCode}
          >
            이메일 인증하기
          </Button>
        ) : null}
      </div>
      {message ? <FormMessage variant={message.tone}>{message.text}</FormMessage> : null}
    </div>
  );
}
