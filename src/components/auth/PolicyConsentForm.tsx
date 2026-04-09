"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import { useToast } from "@/components/ui/Toast";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";

type PolicyConsentFormProps = {
  policies: RequiredPolicyMap;
  mustChangePassword: boolean;
};

export default function PolicyConsentForm({
  policies,
  mustChangePassword,
}: PolicyConsentFormProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [checked, setChecked] = useState<Record<PolicyDocument["kind"], boolean>>({
    service: false,
    privacy: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (pending) {
      return;
    }
    if (!checked.service || !checked.privacy) {
      setError("필수 약관에 모두 동의해 주세요.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/mm/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicePolicyId: policies.service.id,
          privacyPolicyId: policies.privacy.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "policy_outdated") {
          setError(data.message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.");
          notify("약관이 갱신되었습니다. 다시 확인해 주세요.");
          router.refresh();
          return;
        }
        if (data.error === "missing_fields") {
          setError("필수 약관에 모두 동의해 주세요.");
          return;
        }
        setError(data.message ?? "약관 동의 처리에 실패했습니다.");
        return;
      }

      setError(null);
      notify("약관 동의가 완료되었습니다.");
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
      <PolicyAgreementField
        policy={policies.service}
        checked={checked.service}
        onChange={(next) => setChecked((prev) => ({ ...prev, service: next }))}
        disabled={pending}
      />
      <PolicyAgreementField
        policy={policies.privacy}
        checked={checked.privacy}
        onChange={(next) => setChecked((prev) => ({ ...prev, privacy: next }))}
        disabled={pending}
      />
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <Button onClick={handleSubmit} loading={pending} loadingText="동의 처리 중">
        약관 동의 후 계속하기
      </Button>
    </div>
  );
}
