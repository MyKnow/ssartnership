"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { focusField } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type {
  PolicyDocument,
  PolicyReviewItem,
  RequiredPolicyMap,
} from "@/lib/policy-documents";

type PolicyConsentFormProps = {
  requiredPolicies: RequiredPolicyMap;
  reviewPolicies: PolicyReviewItem[];
  mustChangePassword: boolean;
};

export default function PolicyConsentForm({
  requiredPolicies,
  reviewPolicies,
  mustChangePassword,
}: PolicyConsentFormProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [checked, setChecked] = useState<Record<PolicyDocument["kind"], boolean>>({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const serviceRef = useRef<HTMLInputElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);
  const visibleRequiredPolicies = reviewPolicies.filter((item) => item.required);
  const marketingReviewPolicy =
    reviewPolicies.find((item) => item.policy.kind === "marketing")?.policy ?? null;
  const canContinue = visibleRequiredPolicies.every(
    (item) => checked[item.policy.kind],
  );
  const requiredInputRefs = {
    service: serviceRef,
    privacy: privacyRef,
  } satisfies Record<"service" | "privacy", typeof serviceRef>;

  const focusFirstRequiredPolicy = () => {
    for (const item of visibleRequiredPolicies) {
      const ref = requiredInputRefs[item.policy.kind as "service" | "privacy"];
      if (ref?.current) {
        focusField(ref);
        return;
      }
    }
  };

  const handleSubmit = async () => {
    if (pending) {
      return;
    }
    if (!canContinue) {
      setAgreementError("필수 약관에 모두 동의해 주세요.");
      setFormError(null);
      focusFirstRequiredPolicy();
      return;
    }

    setAgreementError(null);
    setFormError(null);
    setPending(true);

    try {
      const response = await fetch("/api/mm/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicePolicyId: requiredPolicies.service.id,
          privacyPolicyId: requiredPolicies.privacy.id,
          marketingPolicyId: marketingReviewPolicy?.id ?? null,
          marketingPolicyChecked: Boolean(marketingReviewPolicy && checked.marketing),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "missing_fields") {
          setAgreementError("필수 약관에 모두 동의해 주세요.");
          setFormError(null);
          focusFirstRequiredPolicy();
          return;
        }
        if (data.error === "policy_outdated") {
          setFormError(data.message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.");
          router.refresh();
          return;
        }
        setFormError(data.message ?? "약관 동의 처리에 실패했습니다.");
        return;
      }

      setAgreementError(null);
      setFormError(null);
      notify(
        marketingReviewPolicy && data.marketingAgreedAt
          ? `필수 약관 및 마케팅 정보 수신 동의가 ${formatKoreanDateTimeToMinute(data.marketingAgreedAt ?? data.agreedAt)}에 완료되었습니다.`
          : `필수 약관 동의가 ${formatKoreanDateTimeToMinute(data.agreedAt)}에 완료되었습니다.`,
      );
      router.replace(
        data.redirectTo ??
          (mustChangePassword ? "/auth/change-password" : "/"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      {reviewPolicies.length > 0 ? (
        <Button
          variant="secondary"
          onClick={() => {
            setChecked((prev) => {
              const next = { ...prev };
              for (const item of reviewPolicies) {
                next[item.policy.kind] = true;
              }
              return next;
            });
            setAgreementError(null);
            setFormError(null);
          }}
          disabled={pending}
          className="w-full"
        >
          전체 동의하기
        </Button>
      ) : null}

      <div className="flex flex-col gap-4">
        {reviewPolicies.map(({ policy, required }) => (
          <PolicyAgreementField
            key={`${policy.kind}-${policy.version}`}
            policy={policy}
            checked={checked[policy.kind]}
            onChange={(next) => {
              setChecked((prev) => ({ ...prev, [policy.kind]: next }));
              setAgreementError(null);
              setFormError(null);
            }}
            disabled={pending}
            invalid={Boolean(agreementError)}
            inputRef={
              policy.kind === "service"
                ? serviceRef
                : policy.kind === "privacy"
                  ? privacyRef
                  : undefined
            }
            required={required}
          />
        ))}
      </div>

      {agreementError ? <FormMessage variant="error">{agreementError}</FormMessage> : null}
      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <Button
        onClick={handleSubmit}
        loading={pending}
        loadingText="동의 처리 중"
        disabled={!canContinue}
        className="w-full"
      >
        계속하기
      </Button>
    </div>
  );
}
