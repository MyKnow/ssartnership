import type { RefObject } from "react";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import FormMessage from "@/components/ui/FormMessage";
import type { SignupPolicyState } from "@/components/auth/signup-form/types";
import type { RequiredPolicyMap } from "@/lib/policy-documents";

export default function SignupPoliciesSection({
  policies,
  policyChecked,
  pending,
  error,
  servicePolicyRef,
  onPolicyChange,
}: {
  policies: RequiredPolicyMap;
  policyChecked: SignupPolicyState;
  pending: boolean;
  error?: string;
  servicePolicyRef: RefObject<HTMLInputElement | null>;
  onPolicyChange: (key: keyof SignupPolicyState, checked: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">필수 약관 동의</h2>
        <p className="text-sm text-muted-foreground">
          회원가입을 진행하려면 아래 약관에 모두 동의해야 합니다.
        </p>
      </div>
      <div className="mt-4 space-y-3">
        <PolicyAgreementField
          policy={policies.service}
          checked={policyChecked.service}
          onChange={(checked) => onPolicyChange("service", checked)}
          disabled={pending}
          invalid={Boolean(error)}
          inputRef={servicePolicyRef}
        />
        <PolicyAgreementField
          policy={policies.privacy}
          checked={policyChecked.privacy}
          onChange={(checked) => onPolicyChange("privacy", checked)}
          disabled={pending}
          invalid={Boolean(error)}
        />
      </div>
      {error ? (
        <FormMessage className="mt-4" variant="error">
          {error}
        </FormMessage>
      ) : null}
    </section>
  );
}
