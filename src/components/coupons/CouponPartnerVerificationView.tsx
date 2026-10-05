"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CertificationView from "@/components/certification/CertificationView";
import { getProductSessionId } from "@/lib/product-events";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";
import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";
import { isFourDigitPin } from "@/lib/validation";

type VerificationMember = {
  mattermostUsername?: string | null;
  displayName?: string | null;
  generation?: number | null;
  campus?: string | null;
  graduateVerifiedAt?: string | null;
  profileImageUrl?: string | null;
};

type RedeemResponse = {
  ok?: boolean;
  message?: string;
};

export default function CouponPartnerVerificationView({
  item,
  member,
  cohortCardThemes,
  partnerReturnHref,
}: {
  item: AvailableAdCoupon;
  member: VerificationMember;
  cohortCardThemes: readonly CohortCardTheme[];
  /** Sanitized same-origin path back to the partner the coupon came from. */
  partnerReturnHref: string;
}) {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isRedeemed, setIsRedeemed] = useState(false);

  async function verifyCoupon() {
    if (!item.issueId || !isFourDigitPin(password)) {
      setMessage({ tone: "error", text: "제휴처 확인 PIN은 숫자 4자리로 입력해 주세요." });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/coupon-issues/${encodeURIComponent(item.issueId)}/redeem`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            sessionId: getProductSessionId(),
            onsitePassword: password,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as RedeemResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "쿠폰 확인에 실패했습니다.");
      }
      setIsRedeemed(true);
      setMessage({
        tone: "success",
        text: "인증 카드와 쿠폰이 확인되었습니다. 혜택을 적용해 주세요.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "쿠폰 확인에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <CertificationView
        member={member}
        initialTimestamp={new Date().toISOString()}
        cohortCardThemes={cohortCardThemes}
        disableTracking
      />

      <Card className="grid min-w-0 gap-4 border-border bg-surface p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">제휴처</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{item.coupon.partnerName}</p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">쿠폰</p>
          <p className="mt-1 text-base font-semibold text-foreground">{item.coupon.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.coupon.discountLabel || "쿠폰 혜택"}
          </p>
        </div>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          제휴처 확인 PIN
          <input
            id="couponPartnerCheckDigits"
            name="couponPartnerCheckDigits"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            value={password}
            onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="4자리 PIN 입력"
            className="pin-mask h-12 w-full rounded-2xl border border-border bg-surface-control px-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-xs font-normal text-muted-foreground">
            제휴처에서 확인할 숫자 4자리 PIN입니다.
          </span>
        </label>
        {message ? (
          <p className={message.tone === "error" ? "text-sm font-medium text-danger" : "text-sm font-medium text-success"}>
            {message.text}
          </p>
        ) : null}
        {isRedeemed ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button href="/coupons" variant="secondary" className="w-full justify-center">
              쿠폰함으로
            </Button>
            <Button href={partnerReturnHref} className="w-full justify-center">
              제휴처로 돌아가기
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="w-full justify-center"
            loading={isSubmitting}
            loadingText="확인 중"
            onClick={() => {
              void verifyCoupon();
            }}
          >
            인증 카드와 쿠폰 확인
          </Button>
        )}
      </Card>
    </div>
  );
}
