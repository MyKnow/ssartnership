"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { sanitizeReturnTo } from "@/lib/return-to";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";
import {
  parseSsafySignupCompleteInput,
  type SsafySignupCompleteFieldErrors,
  type SsafySignupSessionData,
} from "@/lib/ssafy-verify/signup";

type Props = {
  session: SsafySignupSessionData;
  requiredPolicies: RequiredPolicyMap;
  marketingPolicy: PolicyDocument | null;
  returnTo?: string;
};

function getProfileSummary(session: SsafySignupSessionData) {
  const yearLabel = session.isStaff
    ? "운영진"
    : session.cohort === null
      ? "기수 미확인"
      : `${session.cohort}기`;
  const campusLabel = session.campus ?? "캠퍼스 미확인";
  return `${session.displayName} · @${session.mattermostUsername} · ${yearLabel} · ${campusLabel}`;
}

export default function SsafySignupCompleteForm({
  session,
  requiredPolicies,
  marketingPolicy,
  returnTo,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checked, setChecked] = useState({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [fieldErrors, setFieldErrors] = useState<SsafySignupCompleteFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLInputElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);

  function clearError(field?: keyof SsafySignupCompleteFieldErrors) {
    if (field) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    } else {
      setFieldErrors({});
    }
    setFormError(null);
  }

  function focusFirstError(errors: SsafySignupCompleteFieldErrors) {
    if (errors.password) {
      focusField(passwordRef);
      return;
    }
    if (errors.confirmPassword) {
      focusField(confirmPasswordRef);
      return;
    }
    if (errors.servicePolicyId) {
      focusField(serviceRef);
      return;
    }
    if (errors.privacyPolicyId) {
      focusField(privacyRef);
    }
  }

  async function handleSubmit() {
    if (pending) {
      return;
    }

    const payload = {
      password,
      confirmPassword,
      servicePolicyId: checked.service ? requiredPolicies.service.id : "",
      privacyPolicyId: checked.privacy ? requiredPolicies.privacy.id : "",
      marketingPolicyId: marketingPolicy?.id ?? null,
      marketingPolicyChecked: Boolean(marketingPolicy && checked.marketing),
      returnTo: sanitizeReturnTo(returnTo, "/"),
    };
    const parsed = parseSsafySignupCompleteInput(payload);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setFormError(null);
      focusFirstError(parsed.fieldErrors);
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/ssafy/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "invalid_request") {
          const nextFieldErrors = data.fieldErrors ?? {};
          setFieldErrors(nextFieldErrors);
          focusFirstError(nextFieldErrors);
          return;
        }
        if (data.error === "policy_outdated") {
          setFormError(data.message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.");
          router.refresh();
          return;
        }
        if (data.error === "already_registered") {
          sessionStorage.setItem("signup:alreadyRegistered", "1");
          router.replace(data.redirectTo ?? "/auth/login");
          return;
        }
        if (data.error === "signup_session_expired") {
          setFormError("인증 상태가 만료되었습니다. SSAFY 인증을 다시 진행해 주세요.");
          return;
        }
        setFormError(data.message ?? "회원가입을 완료하지 못했습니다.");
        return;
      }

      sessionStorage.setItem("signup:success", "1");
      notify("회원가입이 완료되었습니다.");
      router.replace(data.redirectTo ?? "/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="rounded-xl border border-border/60 bg-surface-inset p-4 text-sm font-medium text-foreground">
        {getProfileSummary(session)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          사이트 비밀번호
          <PasswordInput
            ref={passwordRef}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearError("password");
            }}
            placeholder="비밀번호"
            required
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
              clearError("confirmPassword");
            }}
            placeholder="비밀번호 확인"
            required
            aria-invalid={Boolean(fieldErrors.confirmPassword) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.confirmPassword))}
          />
          {fieldErrors.confirmPassword ? (
            <FormMessage variant="error">{fieldErrors.confirmPassword}</FormMessage>
          ) : null}
        </label>
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          setChecked({
            service: true,
            privacy: true,
            marketing: Boolean(marketingPolicy),
          });
          clearError();
        }}
        disabled={pending}
        className="w-full"
      >
        전체 동의하기
      </Button>

      <div className="flex flex-col gap-4">
        <PolicyAgreementField
          policy={requiredPolicies.service}
          checked={checked.service}
          onChange={(next) => {
            setChecked((prev) => ({ ...prev, service: next }));
            clearError("servicePolicyId");
          }}
          disabled={pending}
          invalid={Boolean(fieldErrors.servicePolicyId)}
          inputRef={serviceRef}
          required
        />
        <PolicyAgreementField
          policy={requiredPolicies.privacy}
          checked={checked.privacy}
          onChange={(next) => {
            setChecked((prev) => ({ ...prev, privacy: next }));
            clearError("privacyPolicyId");
          }}
          disabled={pending}
          invalid={Boolean(fieldErrors.privacyPolicyId)}
          inputRef={privacyRef}
          required
        />
        {marketingPolicy ? (
          <PolicyAgreementField
            policy={marketingPolicy}
            checked={checked.marketing}
            onChange={(next) => {
              setChecked((prev) => ({ ...prev, marketing: next }));
              clearError();
            }}
            disabled={pending}
            required={false}
          />
        ) : null}
      </div>

      {fieldErrors.servicePolicyId || fieldErrors.privacyPolicyId ? (
        <FormMessage variant="error">필수 약관에 모두 동의해 주세요.</FormMessage>
      ) : null}
      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <Button
        onClick={handleSubmit}
        loading={pending}
        loadingText="가입 처리 중"
        className="w-full"
      >
        회원가입 완료
      </Button>
    </div>
  );
}
