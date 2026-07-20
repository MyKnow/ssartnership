"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CertificationView from "@/components/certification/CertificationView";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import { getProductSessionId } from "@/lib/product-events";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";

type VerificationMember = {
  mattermostUsername?: string | null;
  displayName?: string | null;
  generation?: number | null;
  campus?: string | null;
  graduateVerifiedAt?: string | null;
  profileImageUrl?: string | null;
};

type BenefitUseResponse = {
  ok?: boolean;
  message?: string;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PartnerBenefitVerificationView({
  partnerId,
  partnerName,
  benefit,
  member,
  cohortCardThemes,
  initialTimestamp,
  pinConfigured,
}: {
  partnerId: string;
  partnerName: string;
  benefit: string;
  member: VerificationMember;
  cohortCardThemes: readonly CohortCardTheme[];
  initialTimestamp: string;
  pinConfigured: boolean;
}) {
  const idempotencyKeyRef = useRef<string | null>(null);
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function confirmBenefitUse() {
    if (!/^\d{4}$/.test(pin)) {
      setMessage({
        tone: "error",
        text: "제휴처 확인 PIN은 숫자 4자리로 입력해 주세요.",
      });
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey();
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/partners/${encodeURIComponent(partnerId)}/benefit-use`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            benefit,
            pin,
            idempotencyKey: idempotencyKeyRef.current,
            sessionId: getProductSessionId(),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as BenefitUseResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "혜택 이용 확인에 실패했습니다.");
      }
      setIsCompleted(true);
      setMessage({
        tone: "success",
        text: "인증 카드와 혜택이 확인되었습니다. 제휴처에 혜택을 적용해 주세요.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "혜택 이용 확인에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <AnalyticsEventOnMount
        eventName="partner_benefit_use_open"
        targetType="partner"
        targetId={partnerId}
        properties={{ source: "partner_benefit_verification" }}
        dedupeKey={`partner-benefit-use-open:${partnerId}:${benefit}`}
      />
      <CertificationView
        member={member}
        initialTimestamp={initialTimestamp}
        cohortCardThemes={cohortCardThemes}
        disableTracking
      />

      <Card className="grid min-w-0 gap-4 border-border bg-surface p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">제휴처</p>
          <p className="mt-1 break-words text-sm font-semibold text-foreground">{partnerName}</p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">선택한 혜택</p>
          <p className="mt-1 break-words text-base font-semibold text-foreground">{benefit}</p>
        </div>
        {pinConfigured ? (
          <>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              제휴처 확인 PIN
              <input
                id="partnerBenefitPin"
                name="partnerBenefitPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                value={pin}
                disabled={isCompleted}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4자리 PIN 입력"
                className="h-12 w-full rounded-2xl border border-border bg-surface-control px-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="text-xs font-normal text-muted-foreground">
                제휴처에서 관리하는 숫자 4자리 PIN입니다.
              </span>
            </label>
            {message ? (
              <p
                className={
                  message.tone === "error"
                    ? "text-sm font-medium text-danger"
                    : "text-sm font-medium text-success"
                }
              >
                {message.text}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full justify-center"
              loading={isSubmitting}
              loadingText="확인 중"
              disabled={isCompleted}
              onClick={() => {
                void confirmBenefitUse();
              }}
            >
              {isCompleted ? "혜택 이용 확인 완료" : "인증 카드와 혜택 확인"}
            </Button>
          </>
        ) : null}
      </Card>
    </div>
  );
}
