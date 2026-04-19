"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import type { PartnerPortalSetupContext } from "@/lib/partner-portal";
import {
  getPartnerPortalSetupErrorMessage,
} from "@/lib/partner-portal-errors";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";
import {
  copyPasswordToClipboard,
  generateBrowserPassword,
  storePasswordCredential,
} from "@/lib/browser-password";

type PartnerSetupFormProps = {
  context: PartnerPortalSetupContext;
};

export default function PartnerSetupForm({ context }: PartnerSetupFormProps) {
  const { notify } = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const isLocked = Boolean(context.account.initialSetupCompletedAt);

  const handleGeneratePassword = async () => {
    if (pending || isLocked) {
      return;
    }
    const nextPassword = generateBrowserPassword(12);
    setPassword(nextPassword);
    setConfirmPassword(nextPassword);
    setFieldErrors({});
    setFormError(null);
    try {
      await copyPasswordToClipboard(nextPassword);
      notify("랜덤 비밀번호를 복사했습니다.");
    } catch {
      notify("랜덤 비밀번호를 입력했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (pending || isLocked) {
      return;
    }
    if (!password || !confirmPassword) {
      setFieldErrors({
        password: password ? undefined : "새 비밀번호를 입력해 주세요.",
        confirmPassword: confirmPassword ? undefined : "비밀번호 확인을 입력해 주세요.",
      });
      setFormError(null);
      if (!password) {
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
        if (data.error === "already_completed") {
          setFormError(message);
          return;
        }
        setFormError(message);
        return;
      }

      setFieldErrors({});
      setFormError(null);
      await storePasswordCredential({
        loginId: context.account.loginId,
        password,
        displayName: context.account.displayName,
      });
      notify("초기 설정이 완료되었습니다.");
      router.replace("/partner/login?setup=completed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          <span className="flex items-center justify-between gap-3">
            <span>새 비밀번호</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGeneratePassword}
              disabled={pending || isLocked}
            >
              <Sparkles size={16} />
              랜덤 생성
            </Button>
          </span>
          <PasswordInput
            ref={passwordRef}
            value={password}
            autoComplete="new-password"
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
            autoComplete="new-password"
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

        <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>
        {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}
      </div>

      <div className="rounded-2xl border border-border bg-surface-inset/80 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">설정 완료</p>
          <p className="text-sm leading-6 text-muted-foreground">
            완료하면 협력사 포털 로그인 화면으로 이동합니다.
          </p>
        </div>
        <Button
          className="mt-4 w-full sm:mt-0 sm:w-auto"
          onClick={handleSubmit}
          disabled={pending || isLocked}
          loading={pending}
          loadingText="설정 중"
        >
          초기 설정 완료
        </Button>
      </div>
    </div>
  );
}
