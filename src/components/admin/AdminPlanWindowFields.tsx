"use client";

import { useEffect, useId, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  isPartnerPlanWindowOrderValid,
  PARTNER_COMPANY_PLAN_DEFINITIONS,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";

type AdminPlanWindowFieldsProps = {
  initialPlanTier: PartnerCompanyPlanTier;
  initialPlanStartedAt: string;
  initialPlanExpiresAt: string;
};

export default function AdminPlanWindowFields({
  initialPlanTier,
  initialPlanStartedAt,
  initialPlanExpiresAt,
}: AdminPlanWindowFieldsProps) {
  const [planTier, setPlanTier] = useState(initialPlanTier);
  const [planStartedAt, setPlanStartedAt] = useState(initialPlanStartedAt);
  const [planExpiresAt, setPlanExpiresAt] = useState(initialPlanExpiresAt);
  const expiresAtRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const hasInvalidWindow =
    planTier !== "basic" &&
    !isPartnerPlanWindowOrderValid({ planStartedAt, planExpiresAt });

  useEffect(() => {
    expiresAtRef.current?.setCustomValidity(
      hasInvalidWindow ? "만료일은 시작일과 같거나 이후여야 합니다." : "",
    );
  }, [hasInvalidWindow]);

  return (
    <>
      <label className="grid gap-2 text-sm font-medium text-foreground">
        플랜
        <Select
          name="planTier"
          value={planTier}
          onChange={(event) =>
            setPlanTier(event.currentTarget.value as PartnerCompanyPlanTier)
          }
        >
          {PARTNER_COMPANY_PLAN_DEFINITIONS.map((definition) => (
            <option key={definition.tier} value={definition.tier}>
              {definition.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-foreground">
        시작일
        <Input
          name="planStartedAt"
          type="date"
          value={planStartedAt}
          onChange={(event) => setPlanStartedAt(event.currentTarget.value)}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-foreground">
        만료일
        <Input
          ref={expiresAtRef}
          name="planExpiresAt"
          type="date"
          min={
            planTier !== "basic" && planStartedAt
              ? planStartedAt
              : undefined
          }
          value={planExpiresAt}
          aria-describedby={hasInvalidWindow ? errorId : undefined}
          onChange={(event) => setPlanExpiresAt(event.currentTarget.value)}
        />
      </label>
      {hasInvalidWindow ? (
        <p id={errorId} className="text-sm text-danger md:col-span-3" role="alert">
          만료일은 시작일과 같거나 이후여야 합니다.
        </p>
      ) : null}
    </>
  );
}
