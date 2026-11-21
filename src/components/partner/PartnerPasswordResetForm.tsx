"use client";

import { useRef, useState } from "react";
import PortalButton, { PortalButtonLink } from "@/components/portal-v2/PortalButton";
import {
  PortalField,
  PortalInput,
  portalFieldProps,
} from "@/components/portal-v2/PortalFormControls";
import PortalFormMessage from "@/components/portal-v2/PortalFormMessage";
import { focusField } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import {
  getPartnerPortalPasswordResetErrorMessage,
} from "@/lib/partner-password-errors";

type SuccessState = {
  emailSentTo: string;
  temporaryPassword?: string | null;
};

export default function PartnerPasswordResetForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const { notify } = useToast();
  const emailRef = useRef<HTMLInputElement>(null);

  const handleReset = async () => {
    if (pending) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldError("담당자 이메일을 입력해 주세요.");
      setFormError(null);
      focusField(emailRef);
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setFieldError("이메일 형식이 올바르지 않습니다.");
      setFormError(null);
      focusField(emailRef);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/partner/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizePartnerLoginId(trimmedEmail) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? getPartnerPortalPasswordResetErrorMessage(
                data.error as Parameters<typeof getPartnerPortalPasswordResetErrorMessage>[0],
              )
            : "비밀번호 재설정에 실패했습니다.";
        if (
          data.error === "invalid_email" ||
          data.error === "not_found" ||
          data.error === "inactive_account" ||
          data.error === "setup_required"
        ) {
          setFieldError(message);
          setFormError(null);
          focusField(emailRef);
          return;
        }
        setFormError(message);
        return;
      }

      const temporaryPassword =
        typeof data.temporaryPassword === "string"
          ? data.temporaryPassword
          : null;

      setFieldError(null);
      setFormError(null);
      setSuccess({
        emailSentTo:
          typeof data.emailSentTo === "string"
            ? data.emailSentTo
            : normalizePartnerLoginId(trimmedEmail),
        temporaryPassword,
      });
      notify("임시 비밀번호 안내를 보냈습니다.");
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-pv2-control border border-pv2-border bg-pv2-grid p-4">
          <p role="status" className="pv2-label text-pv2-text">
            {success.emailSentTo}로 임시 비밀번호를 보냈습니다.
          </p>
          <p className="pv2-body text-ko-pretty text-pv2-muted">
            이메일을 확인한 뒤, 임시 비밀번호로 로그인하세요.
            로그인 후에는 반드시 새 비밀번호로 변경해야 합니다.
          </p>
          {success.temporaryPassword ? (
            <div className="rounded-pv2-control border border-dashed border-pv2-border-strong bg-pv2-surface px-4 py-3">
              <p className="pv2-caption text-pv2-muted">임시 비밀번호</p>
              <p className="mt-1 font-mono pv2-body text-pv2-text">
                {success.temporaryPassword}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <PortalButtonLink href="/partner/login" variant="primary">
            로그인 페이지
          </PortalButtonLink>
          <PortalButtonLink href="/partner/reset">다시 발급</PortalButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PortalField
        name="email"
        label="담당자 이메일"
        hint="초기 설정이 완료된 계정이라면 등록된 이메일로 임시 비밀번호가 전송됩니다."
        error={fieldError ?? undefined}
        required
      >
        <PortalInput
          {...portalFieldProps("email", {
            error: fieldError ?? undefined,
            hasHint: true,
          })}
          ref={emailRef}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldError(null);
            setFormError(null);
          }}
          placeholder="partner@example.com"
          autoComplete="email"
          inputMode="email"
          disabled={pending}
        />
      </PortalField>
      {formError ? <PortalFormMessage variant="error">{formError}</PortalFormMessage> : null}

      <div>
        <PortalButton
          variant="primary"
          onClick={handleReset}
          loading={pending}
          loadingText="임시 비밀번호 발급 중"
        >
          임시 비밀번호 받기
        </PortalButton>
      </div>
    </div>
  );
}
