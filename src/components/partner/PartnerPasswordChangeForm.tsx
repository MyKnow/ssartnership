"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import PortalButton from "@/components/portal-v2/PortalButton";
import { PortalField, portalFieldProps } from "@/components/portal-v2/PortalFormControls";
import PortalFormMessage from "@/components/portal-v2/PortalFormMessage";
import PortalPasswordInput from "@/components/portal-v2/PortalPasswordInput";
import { focusField } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { validateAuthPasswordChangeDraft } from "@/lib/auth-form-validation";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";
import {
  copyPasswordToClipboard,
  tryGenerateBrowserPassword,
} from "@/lib/browser-password";
import { getPartnerPortalPasswordChangeErrorMessage } from "@/lib/partner-password-errors";

export default function PartnerPasswordChangeForm({
  mustChangePassword,
  successRedirectHref = "/partner",
}: {
  mustChangePassword: boolean;
  successRedirectHref?: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    nextPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { notify } = useToast();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const nextPasswordRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleGeneratePassword = async () => {
    if (pending) {
      return;
    }
    const passwordResult = tryGenerateBrowserPassword(12);
    if (!passwordResult.ok) {
      setFieldErrors((prev) => ({
        ...prev,
        nextPassword: passwordResult.error.message,
      }));
      setFormError(null);
      focusField(nextPasswordRef);
      return;
    }
    setNextPassword(passwordResult.password);
    setFieldErrors((prev) => ({ ...prev, nextPassword: undefined }));
    setFormError(null);
    try {
      await copyPasswordToClipboard(passwordResult.password);
      if (!mountedRef.current) {
        return;
      }
      notify("랜덤 비밀번호를 복사했습니다.");
    } catch {
      if (!mountedRef.current) {
        return;
      }
      notify("랜덤 비밀번호를 입력했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (pending) {
      return;
    }
    const validation = validateAuthPasswordChangeDraft({
      currentPassword,
      nextPassword,
      validatePolicy: true,
    });
    if (validation.firstInvalidField) {
      setFieldErrors(validation.fieldErrors);
      setFormError(null);
      focusField(
        validation.firstInvalidField === "currentPassword"
          ? currentPasswordRef
          : nextPasswordRef,
      );
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/partner/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!mountedRef.current) {
        return;
      }
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? getPartnerPortalPasswordChangeErrorMessage(
                data.error as Parameters<
                  typeof getPartnerPortalPasswordChangeErrorMessage
                >[0],
              )
            : "비밀번호 변경에 실패했습니다.";
        if (data.error === "wrong_password") {
          setFieldErrors({ currentPassword: message });
          setFormError(null);
          focusField(currentPasswordRef);
          return;
        }
        if (data.error === "invalid_password") {
          setFieldErrors({ nextPassword: message });
          setFormError(null);
          focusField(nextPasswordRef);
          return;
        }
        setFormError(message);
        return;
      }

      setFieldErrors({});
      setFormError(null);
      notify("비밀번호가 변경되었습니다.");
      window.location.replace(successRedirectHref);
    } finally {
      if (mountedRef.current) {
        setPending(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {mustChangePassword ? (
        <PortalFormMessage variant="info">
          임시 비밀번호로 로그인한 상태입니다. 지금 새 비밀번호를 설정해야 계속
          이용할 수 있습니다.
        </PortalFormMessage>
      ) : null}

      <PortalField
        name="partner-password-currentPassword"
        label="현재 비밀번호"
        error={fieldErrors.currentPassword}
        required
      >
        <PortalPasswordInput
          {...portalFieldProps("partner-password-currentPassword", {
            error: fieldErrors.currentPassword,
          })}
          ref={currentPasswordRef}
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
            setFormError(null);
          }}
          placeholder="현재 비밀번호"
          autoComplete="current-password"
          disabled={pending}
        />
      </PortalField>

      <PortalField
        name="partner-password-nextPassword"
        label="새 비밀번호"
        hint={PASSWORD_POLICY_MESSAGE}
        error={fieldErrors.nextPassword}
        required
      >
        <PortalPasswordInput
          {...portalFieldProps("partner-password-nextPassword", {
            error: fieldErrors.nextPassword,
            hasHint: true,
          })}
          ref={nextPasswordRef}
          value={nextPassword}
          onChange={(event) => {
            setNextPassword(event.target.value);
            setFieldErrors((prev) => ({ ...prev, nextPassword: undefined }));
            setFormError(null);
          }}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          autoComplete="new-password"
          disabled={pending}
        />
      </PortalField>
      <div>
        <PortalButton
          icon={<Sparkles className="size-4" />}
          onClick={handleGeneratePassword}
          disabled={pending}
        >
          랜덤 생성
        </PortalButton>
      </div>

      {formError ? <PortalFormMessage variant="error">{formError}</PortalFormMessage> : null}

      <div className="flex flex-col gap-3 border-t border-pv2-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="pv2-caption text-ko-pretty text-pv2-muted">
          저장하면 설정된 프로필 화면으로 이동합니다.
        </p>
        <PortalButton
          variant="primary"
          className="w-full sm:w-auto"
          onClick={handleSubmit}
          loading={pending}
          loadingText="변경 중"
        >
          비밀번호 변경
        </PortalButton>
      </div>
    </div>
  );
}
