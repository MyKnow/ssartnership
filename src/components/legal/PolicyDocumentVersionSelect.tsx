"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Select from "@/components/ui/Select";
import {
  getPolicyHref,
  type PolicyDocument,
  type PolicyKind,
} from "@/lib/policy-documents";
import { formatKoreanDate } from "@/lib/datetime";

export default function PolicyDocumentVersionSelect({
  kind,
  policies,
  currentVersion,
}: {
  kind: PolicyKind;
  policies: PolicyDocument[];
  currentVersion: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? undefined;

  return (
    <Select
      value={String(currentVersion)}
      onChange={(event) => {
        const nextVersion = Number(event.target.value);
        router.push(
          getPolicyHref(
            kind,
            Number.isNaN(nextVersion) ? undefined : nextVersion,
            returnTo ?? undefined,
          ),
        );
      }}
      className="min-w-[220px] sm:min-w-[280px]"
      aria-label="약관 버전 선택"
    >
      {policies.map((policy) => (
        <option key={policy.id} value={policy.version}>
          v{policy.version} · 시행 {formatKoreanDate(policy.effective_at)}
        </option>
      ))}
    </Select>
  );
}
