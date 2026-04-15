"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import type { PartnerPortalSetupContext } from "@/lib/partner-portal";
import {
  getPartnerPortalSetupErrorMessage,
} from "@/lib/partner-portal-errors";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";

type PartnerSetupFormProps = {
  context: PartnerPortalSetupContext;
};

export default function PartnerSetupForm({ context }: PartnerSetupFormProps) {
  const { notify } = useToast();
  const router = useRouter();
  const [verificationCode, setVerificationCode] = useState(
    context.demoVerificationCode ?? "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    verificationCode?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(
    context.isSetupComplete
      ? "이미 초기 설정이 완료된 계정입니다."
      : null,
  );
  const [pending, setPending] = useState(false);
  const verificationCodeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const isLocked = Boolean(context.account.initialSetupCompletedAt);

  const handleSubmit = async () => {
    if (pending || isLocked) {
      return;
    }
    if (!verificationCode.trim() || !password || !confirmPassword) {
      setFieldErrors({
        verificationCode: verificationCode.trim()
          ? undefined
          : "이메일 인증 코드를 입력해 주세요.",
        password: password ? undefined : "새 비밀번호를 입력해 주세요.",
        confirmPassword: confirmPassword ? undefined : "비밀번호 확인을 입력해 주세요.",
      });
      setFormError(null);
      if (!verificationCode.trim()) {
        focusField(verificationCodeRef);
      } else if (!password) {
        focusField(passwordRef);
      } else {
        focusField(confirmPasswordRef);
      }
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/partner/setup/${encodeURIComponent(context.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificationCode,
            password,
            confirmPassword,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? getPartnerPortalSetupErrorMessage(
                data.error as Parameters<typeof getPartnerPortalSetupErrorMessage>[0],
              )
            : "초기 설정에 실패했습니다.";
        if (data.error === "invalid_code") {
          setFieldErrors({ verificationCode: message });
          setFormError(null);
          focusField(verificationCodeRef);
          return;
        }
        if (data.error === "invalid_password") {
          setFieldErrors({ password: message });
          setFormError(null);
          focusField(passwordRef);
          return;
        }
        if (data.error === "password_mismatch") {
          setFieldErrors({ confirmPassword: message });
          setFormError(null);
          focusField(confirmPasswordRef);
          return;
        }
        setFormError(message);
        return;
      }

      setFieldErrors({});
      setFormError(null);
      notify("초기 설정이 완료되었습니다.");
      router.replace("/partner/login?setup=completed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          초기 설정
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          이메일 인증 코드와 새 비밀번호를 입력하면, 이 계정의 포털 접근이
          완료됩니다.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        이메일 인증 코드
        <Input
          ref={verificationCodeRef}
          value={verificationCode}
          onChange={(event) => {
            setVerificationCode(event.target.value);
            setFieldErrors((prev) => ({ ...prev, verificationCode: undefined }));
            setFormError(null);
          }}
          placeholder="인증 코드"
          autoComplete="one-time-code"
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.verificationCode) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.verificationCode))}
        />
        {fieldErrors.verificationCode ? (
          <FormMessage variant="error">{fieldErrors.verificationCode}</FormMessage>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          새 비밀번호
          <PasswordInput
            ref={passwordRef}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
              setFormError(null);
            }}
            placeholder="영문/숫자/특수문자 포함 8자 이상"
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.password))}
          />
          {fieldErrors.password ? (
            <FormMessage variant="error">{fieldErrors.password}</FormMessage>
          ) : null}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          비밀번호 확인
          <PasswordInput
            ref={confirmPasswordRef}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              setFormError(null);
            }}
            placeholder="다시 입력해 주세요"
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.confirmPassword) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.confirmPassword))}
          />
          {fieldErrors.confirmPassword ? (
            <FormMessage variant="error">{fieldErrors.confirmPassword}</FormMessage>
          ) : null}
        </label>
      </div>

      <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>
      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || isLocked}
        className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "설정 중" : "초기 설정 완료"}
      </button>

      {context.isSetupComplete ? (
        <FormMessage>
          이미 설정된 계정입니다. 필요하면 다른 데모 토큰으로 다시 테스트해
          주세요.
        </FormMessage>
      ) : null}
    </div>
  );
}
