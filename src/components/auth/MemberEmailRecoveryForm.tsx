"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { normalizeMemberEmail } from "@/lib/member-domain";

type Step = "password" | "email" | "code";

export default function MemberEmailRecoveryForm() {
  const router = useRouter();
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetMessage() {
    setMessage(null);
    setFieldErrors({});
  }

  async function startRecovery() {
    if (pending) return;
    const nextErrors: Record<string, string> = {};
    if (!identifier.trim()) nextErrors.identifier = "아이디 또는 이메일을 입력해 주세요.";
    if (!password) nextErrors.password = "기존 사이트 비밀번호를 입력해 주세요.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      focusField(nextErrors.identifier ? identifierRef : passwordRef);
      return;
    }
    setPending(true);
    resetMessage();
    try {
      const response = await fetch("/api/member/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "복구 세션을 시작하지 못했습니다.");
      setPassword("");
      setStep("email");
      setMessage("15분 안에 이메일을 등록하고 인증해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "복구 세션을 시작하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function sendCode() {
    if (pending) return;
    const normalizedEmail = normalizeMemberEmail(email);
    if (!normalizedEmail) {
      setFieldErrors({ email: "이메일 주소를 확인해 주세요." });
      focusField(emailRef);
      return;
    }
    setPending(true);
    resetMessage();
    try {
      const response = await fetch("/api/member/recovery/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "인증 코드를 보내지 못했습니다.");
      if (data.alreadyVerified) {
        router.replace(data.redirectTo ?? "/");
        router.refresh();
        return;
      }
      setEmail(normalizedEmail);
      setStep("code");
      setMessage("이메일로 보낸 6자리 코드를 입력해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 코드를 보내지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    if (pending) return;
    if (!/^\d{6}$/.test(code)) {
      setFieldErrors({ code: "6자리 인증 코드를 입력해 주세요." });
      focusField(codeRef);
      return;
    }
    setPending(true);
    resetMessage();
    try {
      const response = await fetch("/api/member/recovery/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "이메일 인증을 완료하지 못했습니다.");
      router.replace(data.redirectTo ?? "/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이메일 인증을 완료하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 grid gap-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Mattermost를 사용할 수 없지만 기존 사이트 비밀번호를 알고 있다면, 15분 제한 복구 세션에서 이메일 로그인을 추가할 수 있습니다.
      </p>

      {step === "password" ? (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void startRecovery();
          }}
        >
          <label className="grid gap-2 text-sm font-medium text-foreground">
            기존 아이디 또는 이메일
            <Input
              ref={identifierRef}
              autoComplete="username"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                resetMessage();
              }}
              aria-invalid={Boolean(fieldErrors.identifier) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.identifier))}
            />
            {fieldErrors.identifier ? <FormMessage variant="error">{fieldErrors.identifier}</FormMessage> : null}
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            기존 사이트 비밀번호
            <PasswordInput
              ref={passwordRef}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                resetMessage();
              }}
              aria-invalid={Boolean(fieldErrors.password) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.password))}
            />
            {fieldErrors.password ? <FormMessage variant="error">{fieldErrors.password}</FormMessage> : null}
          </label>
          <Button type="submit" loading={pending} loadingText="확인 중">
            기존 비밀번호 확인
          </Button>
        </form>
      ) : null}

      {step === "email" || step === "code" ? (
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            로그인에 사용할 이메일
            <Input
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              disabled={step === "code"}
              onChange={(event) => {
                setEmail(event.target.value);
                resetMessage();
              }}
              aria-invalid={Boolean(fieldErrors.email) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.email))}
            />
            {fieldErrors.email ? <FormMessage variant="error">{fieldErrors.email}</FormMessage> : null}
          </label>
          {step === "code" ? (
            <label className="grid gap-2 text-sm font-medium text-foreground">
              6자리 인증 코드
              <Input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  resetMessage();
                }}
                aria-invalid={Boolean(fieldErrors.code) || undefined}
                className={getFieldErrorClass(Boolean(fieldErrors.code))}
              />
              {fieldErrors.code ? <FormMessage variant="error">{fieldErrors.code}</FormMessage> : null}
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={step === "code" ? "secondary" : "primary"} loading={pending} loadingText="전송 중" onClick={sendCode}>
              {step === "code" ? "인증 코드 다시 보내기" : "인증 코드 보내기"}
            </Button>
            {step === "code" ? (
              <Button type="button" loading={pending} loadingText="확인 중" onClick={verifyCode}>
                이메일 인증 및 전환
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
      <p className="text-sm text-muted-foreground">
        기존 비밀번호를 모르면 <Link className="font-medium underline underline-offset-4" href="/auth/signup/graduate?kind=recovery">기존 회원 복구 신청</Link>을 이용해 주세요.
      </p>
    </div>
  );
}
