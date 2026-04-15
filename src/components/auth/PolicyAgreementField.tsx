"use client";

import type { Ref } from "react";
import Link from "next/link";
import { getFieldErrorClass } from "@/components/ui/form-field-state";
import { getPolicyHref, getPolicyKindLabel, type PolicyDocument } from "@/lib/policy-documents";

type PolicyAgreementFieldProps = {
  policy: PolicyDocument;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

export default function PolicyAgreementField({
  policy,
  checked,
  onChange,
  disabled,
  invalid = false,
  inputRef,
}: PolicyAgreementFieldProps) {
  const inputId = `policy-${policy.kind}-${policy.version}`;

  return (
    <div className={getFieldErrorClass(
      invalid,
      "rounded-2xl border border-border/70 bg-background/70 p-4",
    )}>
      <div className="flex items-start gap-3">
        <input
          ref={inputRef}
          id={inputId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          aria-invalid={invalid || undefined}
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-foreground"
          >
            [필수] {getPolicyKindLabel(policy.kind)} 동의
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            {policy.summary ?? "약관 전문을 확인한 뒤 동의해 주세요."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              v{policy.version}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              시행 {new Date(policy.effective_at).toLocaleDateString("ko-KR")}
            </span>
            <Link
              href={getPolicyHref(policy.kind, policy.version)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:opacity-80"
            >
              상세 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
