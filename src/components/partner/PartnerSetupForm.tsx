"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import PortalButton from "@/components/portal-v2/PortalButton";
import { PortalField, portalFieldProps } from "@/components/portal-v2/PortalFormControls";
import PortalFormMessage from "@/components/portal-v2/PortalFormMessage";
import PortalPasswordInput from "@/components/portal-v2/PortalPasswordInput";
import { focusField } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { validateAuthPasswordPairDraft } from "@/lib/auth-form-validation";
import type { PartnerPortalSetupContext } from "@/lib/partner-auth/portal";
import {
  getPartnerPortalSetupErrorMessage,
} from "@/lib/partner-auth/portal-errors";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";
import {
  copyPasswordToClipboard,
  storePasswordCredential,
  tryGenerateBrowserPassword,
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
    const passwordResult = tryGenerateBrowserPassword(12);
    if (!passwordResult.ok) {
      setFieldErrors((prev) => ({
        ...prev,
        password: passwordResult.error.message,
      }));
      setFormError(null);
      focusField(passwordRef);
      return;
    }
    setPassword(passwordResult.password);
    setConfirmPassword(passwordResult.password);
    setFieldErrors({});
    setFormError(null);
    try {
      await copyPasswordToClipboard(passwordResult.password);
      notify("랜덤 비밀번호를 복사했습니다.");
    } catch {
      notify("랜덤 비밀번호를 입력했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (pending || isLocked) {
      return;
    }
    const validation = validateAuthPasswordPairDraft({
      password,
      confirmPassword,
      validatePolicy: true,
    });
    if (validation.firstInvalidField) {
      setFieldErrors(validation.fieldErrors);
      setFormError(null);
      if (validation.firstInvalidField === "password") {
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
    <div className="flex flex-col gap-4">
      <PortalField
        name="partner-setup-password"
        label="새 비밀번호"
        hint={PASSWORD_POLICY_MESSAGE}
        error={fieldErrors.password}
        required
      >
        <PortalPasswordInput
          {...portalFieldProps("partner-setup-password", {
            error: fieldErrors.password,
            hasHint: true,
          })}
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
        />
      </PortalField>
      <div>
        <PortalButton
          icon={<Sparkles className="size-4" />}
          onClick={handleGeneratePassword}
          disabled={pending || isLocked}
        >
          랜덤 생성
        </PortalButton>
      </div>

      <PortalField
        name="partner-setup-confirmPassword"
        label="비밀번호 확인"
        error={fieldErrors.confirmPassword}
        required
      >
        <PortalPasswordInput
          {...portalFieldProps("partner-setup-confirmPassword", {
            error: fieldErrors.confirmPassword,
          })}
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
        />
      </PortalField>

      {formError ? <PortalFormMessage variant="error">{formError}</PortalFormMessage> : null}

      <div className="flex flex-col gap-3 border-t border-pv2-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="pv2-caption text-ko-pretty text-pv2-muted">
          완료하면 파트너사 포털 로그인 화면으로 이동합니다.
        </p>
        <PortalButton
          variant="primary"
          className="w-full sm:w-auto"
          onClick={handleSubmit}
          disabled={pending || isLocked}
          loading={pending}
          loadingText="설정 중"
        >
          초기 설정 완료
        </PortalButton>
      </div>
    </div>
  );
}
