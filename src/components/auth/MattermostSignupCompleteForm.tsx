"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import {
  getMemberSignupActionState,
  parseMemberSignupCompleteInput,
  type MemberSignupCompleteFieldErrors,
} from "@/lib/member-signup";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";
import { sanitizeReturnTo } from "@/lib/return-to";

type Props = {
  session: {
    mmUserId: string;
    mmUsername: string;
    displayName: string;
    subjectGeneration: number;
    senderGeneration: number;
  };
  requiredPolicies: RequiredPolicyMap;
  marketingPolicy: PolicyDocument | null;
  returnTo?: string;
};

export default function MattermostSignupCompleteForm({
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
  const [fieldErrors, setFieldErrors] = useState<MemberSignupCompleteFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLInputElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);
  const actionState = getMemberSignupActionState({
    password,
    confirmPassword,
    serviceChecked: checked.service,
    privacyChecked: checked.privacy,
    marketingChecked: checked.marketing,
    hasMarketingPolicy: Boolean(marketingPolicy),
  });

  function clearError(field?: keyof MemberSignupCompleteFieldErrors) {
    if (field) {
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    } else {
      setFieldErrors({});
    }
    setFormError(null);
  }

  function focusFirstError(errors: MemberSignupCompleteFieldErrors) {
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
    if (pending || actionState.disabled) return;

    if (
      actionState.submissionChecked.service !== checked.service
      || actionState.submissionChecked.privacy !== checked.privacy
      || actionState.submissionChecked.marketing !== checked.marketing
    ) {
      setChecked(actionState.submissionChecked);
    }

    const payload = {
      password,
      confirmPassword,
      servicePolicyId: actionState.submissionChecked.service ? requiredPolicies.service.id : "",
      privacyPolicyId: actionState.submissionChecked.privacy ? requiredPolicies.privacy.id : "",
      marketingPolicyId: marketingPolicy?.id ?? null,
      marketingPolicyChecked: Boolean(marketingPolicy && actionState.submissionChecked.marketing),
      returnTo: sanitizeReturnTo(returnTo, "/"),
    };
    const parsed = parseMemberSignupCompleteInput(payload);
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
      const response = await fetch("/api/mm/signup", {
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
        if (data.error === "verification_expired") {
          setFormError("Mattermost 인증 상태가 만료되었습니다. 인증 코드를 다시 요청해 주세요.");
          return;
        }
        if (data.error === "generation_completed") {
          setFormError("선택한 기수는 회원가입을 진행할 수 없습니다.");
          return;
        }
        setFormError("회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          MM 아이디
          <Input value={session.mmUsername} disabled aria-label="MM 아이디" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          이름
          <Input value={session.displayName} disabled aria-label="이름" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          기수
          <Input
            value={formatSsafyYearLabel(session.subjectGeneration)}
            disabled
            aria-label="기수"
          />
        </label>
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
            aria-label="사이트 비밀번호"
            required
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.password))}
          />
          {fieldErrors.password ? <FormMessage variant="error">{fieldErrors.password}</FormMessage> : null}
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
            aria-label="비밀번호 확인"
            required
            aria-invalid={Boolean(fieldErrors.confirmPassword) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.confirmPassword))}
          />
          {fieldErrors.confirmPassword ? <FormMessage variant="error">{fieldErrors.confirmPassword}</FormMessage> : null}
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <PolicyAgreementField
          policy={requiredPolicies.service}
          checked={checked.service}
          onChange={(next) => {
            setChecked((previous) => ({ ...previous, service: next }));
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
            setChecked((previous) => ({ ...previous, privacy: next }));
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
              setChecked((previous) => ({ ...previous, marketing: next }));
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
        disabled={actionState.disabled}
        className="w-full"
      >
        {actionState.label}
      </Button>
    </div>
  );
}
