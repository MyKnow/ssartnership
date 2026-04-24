"use client";

import type { Ref } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowTopRightOnSquareIcon, CheckIcon } from "@heroicons/react/24/outline";
import { getFieldErrorClass } from "@/components/ui/form-field-state";
import { getPolicyHref, getPolicyKindLabel, type PolicyDocument } from "@/lib/policy-documents";
import { formatKoreanDate } from "@/lib/datetime";

type PolicyAgreementFieldProps = {
  policy: PolicyDocument;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  required?: boolean;
};

export default function PolicyAgreementField({
  policy,
  checked,
  onChange,
  disabled,
  invalid = false,
  inputRef,
  required = true,
}: PolicyAgreementFieldProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputId = `policy-${policy.kind}-${policy.version}`;
  const effectiveDate = formatKoreanDate(policy.effective_at);
  const label = getPolicyKindLabel(policy.kind);
  const agreementLabel = label.endsWith("동의") ? label : `${label} 동의`;
  const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <div className={getFieldErrorClass(
      invalid,
      "relative rounded-2xl border border-border/60 bg-surface-inset/70 p-3 pr-12 transition-colors",
    )}>
      <div className="flex min-h-9 items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl has-[:disabled]:cursor-not-allowed"
        >
          <input
            ref={inputRef}
            id={inputId}
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
            aria-invalid={invalid || undefined}
          />
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 bg-surface-control text-transparent shadow-flat transition-surface-emphasis duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover-shadow-raised active:bg-primary/10 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:hover:border-primary peer-checked:hover:bg-primary peer-checked:hover:text-primary-foreground peer-checked:active:bg-primary peer-focus-visible:border-primary/60 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15 peer-disabled:opacity-60 peer-disabled:hover:border-border/70 peer-disabled:hover:bg-surface-control  peer-checked:peer-disabled:hover:bg-primary"
          >
            <CheckIcon className="h-5 w-5 stroke-[2.4]" />
          </span>
        </label>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 self-center">
          <label
            htmlFor={inputId}
            className="min-w-0 shrink text-sm font-semibold leading-snug text-foreground"
          >
            [{required ? "필수" : "선택"}] {agreementLabel}
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex h-5 items-center rounded-full border border-border/70 bg-surface-control px-2 text-[11px] font-semibold leading-none text-foreground shadow-flat">
              v{policy.version}
            </span>
            <span className="inline-flex h-5 items-center rounded-full border border-border/70 bg-surface-control px-2 text-[11px] font-semibold leading-none text-foreground shadow-flat">
              시행 {effectiveDate}
            </span>
          </div>
        </div>
      </div>
      <Link
        href={getPolicyHref(policy.kind, policy.version, returnTo)}
        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-surface-control text-foreground shadow-flat transition-surface-emphasis duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover:text-primary hover-shadow-raised"
        aria-label={`${getPolicyKindLabel(policy.kind)} 상세 보기`}
        title="상세 보기"
      >
        <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
